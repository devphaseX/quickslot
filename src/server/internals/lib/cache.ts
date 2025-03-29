import { Keyv } from "keyv";
import KeyvRedis from "@keyv/redis";
import { createCache } from "cache-manager";
import { getEnv } from "../env";

export const cache = createCache({
  stores: [
    new Keyv({
      store: new KeyvRedis(getEnv("REDIS_URL")),
    }),
  ],
});
