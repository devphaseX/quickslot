import { timestamp } from "drizzle-orm/pg-core";

export const docTimestamps = {
  created_at: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).defaultNow(),

  updated_at: timestamp("updated_at", {
    mode: "date",
    withTimezone: true,
  })
    .defaultNow()
    .$onUpdateFn(() => new Date()),
};
