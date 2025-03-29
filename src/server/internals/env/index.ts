import dotenv from "dotenv";
import z from "zod";
import { isSupportedTimeUnit, parseStrTimeUnit } from "../lib/timeunit";

dotenv.config();

const envSchema = z.object({
  ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().min(1).max(5).default("3000"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32).max(128),
  AUTH_REFRESH_EXPIRES_IN: z
    .string()
    .refine(isSupportedTimeUnit, { message: "invalid time unit value" })
    .transform((value) => parseStrTimeUnit(value)),

  AUTH_EXPIRES_IN: z
    .string()
    .refine(isSupportedTimeUnit, { message: "invalid time unit value" })
    .transform((value) => parseStrTimeUnit(value)),

  ACCESS_TOKEN_COOKIE_NAME: z.string().min(1).max(128).default("access_token"),
  REFRESH_TOKEN_COOKIE_NAME: z
    .string()
    .min(1)
    .max(128)
    .default("refresh_token"),

  REFRESH_PATH: z.string().min(1).max(128).default("/refresh"),
  APP_ORIGIN: z.string().url().default("http://localhost:3000"),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),

  MAIL_TRAP_API_KEY: z.string().min(1),
  MAIL_SENDER_EMAIL: z.string().email(),
  MAIL_SENDER_NAME: z.string().min(1),
  MAIL_TRAP_ACCOUNT_ID: z.string().min(1),
  AUTH_ISSUER: z.string().min(1),
});

const parsedEnv = envSchema.parse(process.env);

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}

export const getEnv = <K extends keyof z.infer<typeof envSchema>>(
  key: K,
  defaultValue?: K,
) => {
  return parsedEnv[key] ?? defaultValue;
};
