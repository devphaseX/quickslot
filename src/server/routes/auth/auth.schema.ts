import { z, type TypeOf } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { User, users } from "@/server/internals/db/schema";

export const registerUserSchema = createInsertSchema(users, {
  first_name: z.string().min(1).max(255),
  last_name: z.string().min(1).max(255),
  email: z.string().email(),
})
  .pick({ first_name: true, last_name: true, email: true })
  .extend({
    password: z.string().min(8),
    confirm_password: z.string(),
  })
  .refine(({ confirm_password, password }) => confirm_password === password, {
    message: "password not a match",
    path: ["confirm_password"],
  });

export type RegisterUserPayload = Pick<
  z.infer<typeof registerUserSchema>,
  "first_name" | "last_name" | "email"
> &
  Pick<User, "password_hash" | "password_salt">;

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1).optional(),
});

export const verifyEmailSchema = z.object({
  code: z.string().min(1).max(255),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
  token: z.string().min(12),
});

export const forgetPasswordSchema = z.object({ email: z.string().email() });
export const verifyForgetPasswordCodeSchema = z.object({
  token: z.string().min(12),
});

export const getRecoveryCodesSchema = z.object({ password: z.string().min(1) });

export const requestChangeEmailSchema = z.object({ email: z.string().email() });
export const confirmChangeEmailSchema = z.object({ code: z.string().min(6) });
