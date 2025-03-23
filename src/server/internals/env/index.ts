import dotenv from "dotenv";
import z from "zod";

dotenv.config();

const envSchema = z.object({
  ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().min(1).max(5).default("3000"),
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32).max(128),
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
