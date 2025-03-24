import {
  boolean,
  pgTable,
  pgView,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { ulid } from "ulid";
import { docTimestamps } from "./_shared_fields";
import { InferSelectModel, InferSelectViewModel } from "drizzle-orm";

export const users = pgTable("users", {
  id: varchar("id", { length: 50 })
    .primaryKey()
    .$defaultFn(() => ulid()),

  first_name: varchar("first_name", { length: 255 }).notNull(),
  last_name: varchar("last_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  is_active: boolean("is_active").notNull().default(true),
  password: varchar("password", { length: 255 }).notNull(),
  avatar_url: varchar("avatar_url", { length: 255 }).notNull(),
  email_verified_at: timestamp("email_verified_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),

  last_login_at: timestamp("last_login_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  ...docTimestamps,
});

export type User = InferSelectModel<typeof users>;

export const userClientViews = pgView("auth_user").as((qb) =>
  qb
    .select({
      id: users.id,
      email: users.email,
      first_name: users.first_name,
      last_name: users.last_name,
      avatar_url: users.avatar_url,
      email_verified_at: users.email_verified_at,
      last_login_at: users.last_login_at,
      created_at: users.created_at,
      updated_at: users.updated_at,
    })
    .from(users),
);

export type UserClient = InferSelectViewModel<typeof userClientViews>;
