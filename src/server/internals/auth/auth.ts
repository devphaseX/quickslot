import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { AppEnv } from "../types/appenv";
import {
  getAccessTokenCookie,
  getAuthSession,
  setAuthSession,
} from "./context";
import { errorResponse } from "../lib/response";
import StatusCodes from "http-status";
import { JwtAccessPayload } from "./jwt";
import { getEnv } from "../env";
import { verifyToken } from "./token";
import tryit from "../utils/tryit";
import { getAuthUser } from "@/server/routes/users/user.service";
import { getUserWithSession } from "@/server/routes/session/session.services";

export const authMiddleware = (allowNonVerifiedAccount = false) =>
  createMiddleware<AppEnv>(async (c, next) => {
    let token = getAccessTokenCookie(c)?.trim();
    let isHeaderToken = false;

    if (!token) {
      token = c.req.header("Authorization")?.trim();
      isHeaderToken = true;
    }

    if (!token) {
      return errorResponse(c, "Missing authentication token", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    if (isHeaderToken && token.startsWith("Bearer")) {
      return errorResponse(
        c,
        "Invalid authentication type. Use 'Bearer' token",
        { status_code: StatusCodes.UNAUTHORIZED },
      );
    }

    if (isHeaderToken) {
      [, token] = token.split(/\b\s+\b/);
    }

    if (!token) {
      return errorResponse(c, "Invalid Bearer token", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const [payload, err] = await tryit(
      verifyToken<JwtAccessPayload>(token, getEnv("AUTH_SECRET")),
    );

    if (err) {
      return errorResponse(c, err.message, {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    const auth = await getUserWithSession(payload.user_id, payload.session_id);
    if (!auth) {
      return errorResponse(c, "unauthorized", {
        status_code: StatusCodes.UNAUTHORIZED,
      });
    }

    if (!(allowNonVerifiedAccount || auth.user.email_verified_at)) {
      return errorResponse(c, "email not verified", {
        status_code: StatusCodes.FORBIDDEN,
      });
    }

    setAuthSession(auth.user, auth.session);
    await next();
  });

export const auth = () => {
  const session = getAuthSession();

  if (!session?.session) {
    throw new HTTPException(StatusCodes.UNAUTHORIZED, {
      message: "unauthorized",
    });
  }

  return session;
};
