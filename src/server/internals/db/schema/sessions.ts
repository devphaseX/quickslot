import { integer, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { users } from "./users";
import { docTimestamps } from "./_shared_fields";
import { InferSelectModel } from "drizzle-orm";

export const sessions = pgTable("sessions", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .$defaultFn(() => ulid()),

  user_id: varchar("user_id", { length: 50 })
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  user_agent: varchar("user_agent", { length: 255 }),

  version: integer("version").default(1),
  expires_at: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }),
  ip: varchar("ip", { length: 50 }),

  last_activity_at: timestamp("last_activity_at", {
    mode: "date",
    withTimezone: true,
  }),

  ...docTimestamps,
});

export type Session = InferSelectModel<typeof sessions>;
