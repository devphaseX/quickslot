import { db } from "@/server/internals/db";
import {
  Session,
  sessions,
  User,
  UserClient,
  userClientViews,
  users,
} from "@/server/internals/db/schema";
import { getEnv } from "@/server/internals/env";
import {
  and,
  desc,
  eq,
  getTableColumns,
  getViewSelectedFields,
  sql,
} from "drizzle-orm";
import {
  PgColumn,
  PgTableWithColumns,
  SelectedFields,
  pgTable,
} from "drizzle-orm/pg-core";

type SessionValidationResult =
  | { session: Session; user: UserClient; refreshed: boolean }
  | { session: null; user: null };

export async function validateSession(
  id: string,
): Promise<SessionValidationResult> {
  const row = await db
    .select({
      session: getTableColumns(sessions),
      user: getViewSelectedFields(userClientViews),
    })
    .from(sessions)
    .innerJoin(userClientViews, eq(userClientViews.id, sessions.user_id))
    .where(eq(sessions.id, id));

  if (row.length === 0) {
    return { session: null, user: null };
  }

  const [{ session, user }] = row;

  if (Date.now() >= Number(session.expires_at)) {
    await deleteSession(session.id, session.user_id);
    return { session: null, user: null };
  }

  let refreshed = false;
  if (
    session.expires_at &&
    Date.now() >=
      session.expires_at.getTime() -
        Math.trunc(getEnv("AUTH_REFRESH_EXPIRES_IN").milliseconds() / 2) //session past half expiration time
  ) {
    session.expires_at = new Date(
      Date.now() + getEnv("AUTH_REFRESH_EXPIRES_IN").milliseconds(),
    );

    await db
      .update(sessions)
      .set({
        expires_at: session.expires_at,
      })
      .where(eq(sessions.id, session.id));

    refreshed = true;
  }

  return { session, refreshed, user };
}

export const getUserWithSession = async (userId: string, sessionId: string) => {
  const [auth] = await db
    .select({
      session: getTableColumns(sessions),
      user: getViewSelectedFields(userClientViews),
    })
    .from(userClientViews)
    .innerJoin(sessions, eq(users.id, sessions.user_id))
    .where(and(eq(users.id, userId), eq(sessions.id, sessionId)));

  return auth;
};

export const getSession = async (sessionId: string) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));

  return session;
};

export const updateSessionLastActivity = async (
  sessionId: string,
  ip?: string | null,
) => {
  const [updatedLastUsedSession] = await db
    .update(sessions)
    .set({
      last_activity_at: new Date(),
      ip: sql<string>`coalesce(${ip}, ${sessions.ip})`,
    })
    .where(eq(sessions.id, sessionId))
    .returning();

  return !!updatedLastUsedSession;
};

export const getSessions = (userId: string, activeSessionId?: string) => {
  return db
    .select({
      id: sessions.id,
      expires_at: sessions.expires_at,
      user_agent: sessions.user_agent,
      last_activity_at: sessions.last_activity_at,
      ip: sessions.ip,
      user_id: sessions.user_id,
      is_current: sql<boolean>`${sessions.id} = ${activeSessionId ?? ""}`,
      created_at: sessions.created_at,
      updated_at: sessions.updated_at,
    } satisfies Partial<Record<keyof Session, any>> & Record<string, any>)
    .from(sessions)
    .where(eq(sessions.user_id, userId))
    .orderBy(desc(sessions.created_at));
};

export const deleteSession = async (sessionId: string, userId: string) => {
  const [deletedSession] = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.user_id, userId)))
    .returning();

  return !!deletedSession;
};
