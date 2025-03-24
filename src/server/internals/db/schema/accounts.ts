import { pgTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";

export const accounts = pgTable(
  "accounts",
  {
    user_id: varchar("user_id", { length: 50 })
      .references(() => users.id, {
        onDelete: "cascade",
      })
      .notNull(),

    type: varchar("type", { length: 50 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    provider_id: varchar("provider_id", { length: 50 }).notNull(),
    access_token: varchar("access_token", { length: 255 }).notNull(),
    refresh_token: varchar("refresh_token", { length: 255 }).notNull(),
    expires_at: timestamp("expires_at").notNull(),
    token_type: varchar("token_type", { length: 50 }),
    scope: varchar("scope", { length: 255 }).notNull(),
  },
  (t) => [uniqueIndex("accounts_user_id_provider").on(t.user_id, t.provider)],
);
