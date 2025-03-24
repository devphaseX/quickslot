import { Env } from "hono";
import { Session, User, UserClient } from "../db/schema";

interface AppEnv extends Env {
  Variables: {
    user: UserClient;
    session: Session;
  };
}

export { type AppEnv };
