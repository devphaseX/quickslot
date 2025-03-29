import { Hono } from "hono";
import { AppEnv } from "./internals/types/appenv";
import authRoutes from "./routes/auth/auth.routes";
import { handle } from "hono/vercel";

const app = new Hono<AppEnv>().basePath("/api");

const v1 = app.basePath("v1").route("/auth", authRoutes);

const appRouter = app.route("/v1", v1);

export const httpHandler = handle(appRouter);

export type AppRouter = typeof appRouter;

export default appRouter;
