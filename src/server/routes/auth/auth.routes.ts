import { Context, Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  forgetPasswordSchema,
  loginUserSchema,
  refreshTokenSchema,
  registerUserSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  verifyForgetPasswordCodeSchema,
} from "./auth.schema";
import { validateErrorHook } from "@/server/internals/utils/validate_formatter";
import {
  createUser,
  getAuthUser,
  getUser,
  setUserAsVerified,
  updateUser,
} from "../users/user.service";
import {
  errorResponse,
  successResponse,
} from "@/server/internals/lib/response";
import { ResponseErrorCode } from "@/server/internals/enums/response_codes";
import StatusCodes from "http-status";
import { hash, verify } from "@/server/internals/lib/password_hash";
import { getEnv } from "@/server/internals/env";
import {
  clearAuthenicationCookie,
  getRefreshTokenCookie,
  setAuthenicationCookie,
} from "@/server/internals/auth/context";
import tryit from "@/server/internals/utils/tryit";
import {
  JwtAccessPayload,
  JwtRefreshPayload,
} from "@/server/internals/auth/jwt";
import {
  JwtToken,
  signToken,
  verifyToken,
} from "@/server/internals/auth/token";
import {
  createSession,
  deleteSession,
  validateSession,
} from "../session/session.services";
import {
  tokenCache,
  TokenMetadata,
  TokenType,
} from "@/server/internals/lib/token";
import { createDate, TimeSpan } from "oslo";
import { auth, authMiddleware } from "@/server/internals/auth/auth";
import { Session } from "@/server/internals/db/schema";
import { AppEnv } from "@/server/internals/types/appenv";
import {
  sendEmailJob,
  TemplateType,
} from "@/server/async_tasks/send_email_job/send_email_job_queue";

const app = new Hono<AppEnv>();

app.post(
  "/sign-up",
  zValidator(
    "json",
    registerUserSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    const payload = c.req.valid("json");

    if (await getAuthUser({ email: payload.email })) {
      return errorResponse(c, "email not available", {
        status_code: StatusCodes.CONFLICT,
        error_code: ResponseErrorCode.AUTH_EMAIL_ALREADY_EXISTS,
      });
    }

    const { hash: password_hash, salt } = await hash(payload.password);
    const password_salt = salt.toString("base64");

    const newUser = await createUser({
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      password_hash,
      password_salt,
    });

    const token = await tokenCache.createToken(
      newUser.id,
      newUser.email,
      TokenType.VERIFY_EMAIL,
      JSON.stringify({
        email: payload.email,
      }),
    );

    await sendEmailJob({
      to: [
        {
          email: newUser.email,
          name: `${newUser.first_name} ${newUser.last_name}`,
        },
      ],

      subject: "Verify your email",
      template: TemplateType.VERIFY_USER_EMAIL,
      data: {
        email: newUser.email,
        name: `${newUser.first_name} ${newUser.last_name}`,
        token,
      },
    });

    return successResponse(
      c,
      undefined,
      StatusCodes.CREATED,
      "user account created successfully",
    );
  },
);

app.post(
  "/sign-in",
  zValidator(
    "json",
    loginUserSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    let userAgent = c.req.header("User-Agent");
    const { email, password } = c.req.valid("json");

    const user = await getUser({ email });

    if (!user) {
      return errorResponse(c, "invalid credentials", {
        status_code: StatusCodes.NOT_FOUND,
        error_code: ResponseErrorCode.AUTH_USER_NOT_FOUND,
      });
    }

    if (!user.password_hash) {
      return errorResponse(c, "invalid credentials", {
        status_code: StatusCodes.NOT_FOUND,
        error_code: ResponseErrorCode.AUTH_USER_NOT_FOUND,
      });
    }

    const passwordCheckPass = await verify(
      password,
      user.password_hash!,
      Buffer.from(user.password_salt!, "base64"),
    );

    if (!passwordCheckPass) {
      return errorResponse(c, "invalid credentials", {
        status_code: StatusCodes.NOT_FOUND,
        error_code: ResponseErrorCode.AUTH_USER_NOT_FOUND,
      });
    }

    if (!user.email_verified_at) {
      const token = await tokenCache.createToken(
        user.id,
        user.email,
        TokenType.VERIFY_EMAIL,
        JSON.stringify({
          email: user.email,
        }),
      );

      await sendEmailJob({
        to: [
          {
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
          },
        ],

        subject: "Verify your email",
        template: TemplateType.VERIFY_USER_EMAIL,
        data: {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          token,
        },
      });

      return errorResponse(
        c,
        "Please verify your email address.  We've sent a verification link to your email address.",
        {
          status_code: StatusCodes.FORBIDDEN,
          error_code: ResponseErrorCode.AUTH_USER_NOT_VERIFIED,
        },
      );
    }

    const session = await createSession({
      user_id: user.id,
      user_agent: c.req.header("User-Agent") ?? "",
      ip: "",
      expires_at: createDate(new TimeSpan(30, "d")),
    });

    return setUserAuthToken(c, session, { shouldGenerateRefreshToken: true });
  },
);

type AuthResponse = {
  access_token: string;
  access_token_expires_at: string;
  refresh_token?: string;
  refresh_token_expires_at?: string;
};

async function setUserAuthToken(
  c: Context<AppEnv>,
  session: Session,
  options?: { shouldGenerateRefreshToken?: boolean },
) {
  const DEFAULT_OPTION: Partial<NonNullable<typeof options>> = {
    shouldGenerateRefreshToken: false,
  };
  options = { ...DEFAULT_OPTION, ...options };

  const accessToken = await signToken<JwtAccessPayload>(
    { user_id: session.user_id, session_id: session.id },
    getEnv("AUTH_SECRET"),
    getEnv("AUTH_EXPIRES_IN"),
    { issuer: getEnv("AUTH_ISSUER") },
  );

  const response: AuthResponse = {
    access_token: accessToken.token,
    access_token_expires_at: createDate(accessToken.expiresIn).toISOString(),
  };

  let refreshToken: JwtToken | undefined = undefined;

  if (options.shouldGenerateRefreshToken) {
    refreshToken = await signToken<JwtRefreshPayload>(
      { user_id: session.user_id, session_id: session.id },
      getEnv("AUTH_SECRET"),
      getEnv("AUTH_REFRESH_EXPIRES_IN"),
      { issuer: getEnv("AUTH_ISSUER") },
    );

    response.refresh_token = refreshToken.token;
    response.refresh_token_expires_at = createDate(
      refreshToken.expiresIn,
    ).toISOString();
  }

  setAuthenicationCookie(c, { access: accessToken, refresh: refreshToken });
  return successResponse(c, {
    data: response,
  });
}

app.post(
  "/refresh",
  zValidator(
    "json",
    refreshTokenSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    let { refresh_token } = c.req.valid("json");
    refresh_token ??= getRefreshTokenCookie(c);

    if (!refresh_token) {
      return errorResponse(c, "missing refresh token", {
        status_code: StatusCodes.BAD_REQUEST,
      });
    }

    const [token, err] = await tryit(
      verifyToken<JwtRefreshPayload>(refresh_token, getEnv("AUTH_SECRET")),
    );

    if (err) {
      return errorResponse(c, err.message, {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const sessionResult = await validateSession(token.session_id);
    if (!(sessionResult.session && sessionResult.user)) {
      return errorResponse(c, "invalid or expired token", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    return setUserAuthToken(c, sessionResult.session, {
      shouldGenerateRefreshToken: sessionResult.refreshed,
    });
  },
);

app.post(
  "/verify-email",
  zValidator(
    "json",
    verifyEmailSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    const { code } = c.req.valid("json");

    const token = await tokenCache.verifyToken(code);

    if (!(token && token.type === TokenType.VERIFY_EMAIL)) {
      return errorResponse(c, "invalid or expired token", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const user = await getUser({ email: token.email });
    if (!user) {
      return errorResponse(c, "invalid or expired token", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    if (user.email_verified_at) {
      return errorResponse(c, "user verified already", {
        status_code: StatusCodes.FORBIDDEN,
      });
    }

    await setUserAsVerified(user.id);
    return successResponse(c, null, StatusCodes.OK, "user email verified");
  },
);

app.post(
  "/password/forget",
  zValidator(
    "json",
    forgetPasswordSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    const { email } = c.req.valid("json");
    const user = await getAuthUser({ email });

    if (!user) {
      return successResponse(
        c,
        undefined,
        StatusCodes.OK,
        "You will received a mail containing your reset link if we found your account",
      );
    }

    const token = await tokenCache.createToken(
      user.id,
      email,
      TokenType.VERIFY_FORGET_PASSWORD_EMAIL,
      JSON.stringify({
        email,
      }),
      new TimeSpan(1, "d").seconds(),
    );

    await sendEmailJob({
      to: [
        {
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
        },
      ],

      subject: "Forgot Password",
      template: TemplateType.VERIFY_FORGOT_PASSWORD,
      data: {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        token,
      },
    });

    return successResponse(
      c,
      undefined,
      StatusCodes.OK,
      "You will received a mail containing your reset link if we found your account",
    );
  },
);

app.post(
  "/password/verify-email",
  zValidator(
    "json",
    verifyForgetPasswordCodeSchema,
    validateErrorHook("invalid request body"),
  ),
  async (c) => {
    const payload = c.req.valid("json");

    const authPayload = await tokenCache.verifyToken<
      TokenMetadata[TokenType.VERIFY_FORGET_PASSWORD_EMAIL]
    >(payload.token);

    if (!authPayload) {
      return errorResponse(c, "Invalid token or expired", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const user = await getAuthUser({ email: authPayload.email });

    if (!(user && user.id === authPayload.user_id)) {
      return errorResponse(c, "Invalid token or expired", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    if (!user.email_verified_at) {
      await setUserAsVerified(user.id);
    }

    await tokenCache.invalidateToken(payload.token);

    const expiresIn = new TimeSpan(1, "h");
    const resetPasswordToken = await tokenCache.createToken(
      user.id,
      user.email,
      TokenType.RESET_PASSWORD,
      undefined,
      expiresIn.seconds(),
    );

    return successResponse(
      c,
      {
        data: {
          reset_token: resetPasswordToken,
          reset_token_expired_at: createDate(expiresIn),
        },
      },
      StatusCodes.OK,
    );
  },
);

app.post(
  "/password/reset",
  zValidator("json", resetPasswordSchema),
  async (c) => {
    const payload = c.req.valid("json");
    const resetToken = await tokenCache.verifyToken(payload.token);

    if (!resetToken) {
      return errorResponse(c, "Invalid token or expired", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const user = await getUser({ email: resetToken.email });

    if (!(user && user.id === resetToken.user_id)) {
      return errorResponse(c, "Invalid token or expired", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    if (user.password_hash && user.password_salt) {
      const newPasswordSameWithOld = await verify(
        payload.password,
        user.password_hash,
        Buffer.from(user.password_salt),
      );

      if (newPasswordSameWithOld) {
        return errorResponse(
          c,
          "The new password must be different from the old password.",
          { status_code: StatusCodes.FORBIDDEN },
        );
      }
    }

    const { hash: password_hash, salt } = await hash(payload.password);

    await updateUser(user.id, {
      password_hash,
      password_salt: salt.toString("base64"),
    });

    await tokenCache.invalidateToken(payload.token);

    return successResponse(
      c,
      undefined,
      StatusCodes.OK,
      "password resetted successfully",
    );
  },
);

app.delete("/logout", authMiddleware(), async (c) => {
  const { session } = auth();
  clearAuthenicationCookie(c);
  await deleteSession(session.id, session.user_id);

  return successResponse(c, undefined, StatusCodes.OK, "logout successful");
});

export default app;
