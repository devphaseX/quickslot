import { Hono } from "hono";
import { AppEnv } from "./internals/types/appenv";
import authRoutes from "./routes/auth/auth.routes";
import { handle } from "hono/vercel";
import StatusCodes from "http-status";
import { errorResponse } from "./internals/lib/response";
import { ResponseErrorCode } from "./internals/enums/response_codes";

const app = new Hono<AppEnv>().basePath("/api");

const v1 = app.basePath("v1").route("/auth", authRoutes);

const appRouter = app.route("/v1", v1);

appRouter.onError(async (err, c) => {
  console.error(err);

  return errorResponse(
    c,
    "We ran into an error while processing your request.",
    {
      status_code: StatusCodes.INTERNAL_SERVER_ERROR,
      error_code: ResponseErrorCode.INTERNAL_SERVER_ERROR,
    },
  );
});

export const httpHandler = handle(appRouter);

export type AppRouter = typeof appRouter;

export default appRouter;
