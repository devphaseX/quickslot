import { getEnv } from "../env";

export const isProd = getEnv("ENV") === "production";
