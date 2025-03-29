import { db } from "@/server/internals/db";
import { users } from "@/server/internals/db/schema";
import { eq, ilike, sql, SQL } from "drizzle-orm";
import { RegisterUserPayload } from "../auth/auth.schema";

export const getAuthUser = async (
  params: Partial<{ id: string; email: string }>,
) => {
  if (!Object.keys(params).length) {
    throw new Error("no params provided");
  }

  const query: SQL[] = [];

  if (params.id) {
    query.push(eq(users.id, params.id));
  }

  if (params.email) {
    query.push(ilike(users.email, params.email));
  }

  const [user] = await db
    .select({
      id: users.id,
      first_name: users.first_name,
      last_name: users.last_name,
      email: users.email,
      email_verified_at: users.email_verified_at,
      is_active: users.is_active,
      last_login_at: users.last_login_at,
      avatar_url: users.avatar_url,
      created_at: users.created_at,
      updated_at: users.updated_at,
    } satisfies Partial<Record<keyof User, unknown> & { preference: unknown }>)
    .from(users)
    .where(sql.join(query, " OR "));

  return user;
};

export type AuthUser = Awaited<ReturnType<typeof getAuthUser>>;

export const getUser = async (
  params: Partial<{ id: string; email: string }>,
) => {
  if (!Object.keys(params).length) {
    throw new Error("no params provided");
  }

  const query: SQL[] = [];

  if (params.id) {
    query.push(eq(users.id, params.id));
  }

  if (params.email) {
    query.push(ilike(users.email, params.email));
  }

  const [user] = await db.select().from(users).where(sql.join(query, " OR "));

  return user;
};

export type User = Awaited<ReturnType<typeof getUser>>;

export const createUser = async (payload: RegisterUserPayload) => {
  const [user] = await db
    .insert(users)
    .values({
      ...payload,
    })
    .returning();

  return user;
};

export type CreateUser = Awaited<ReturnType<typeof createUser>>;

export const updateUser = async (id: string, payload: Partial<User>) => {
  const [user] = await db
    .update(users)
    .set({
      ...payload,
    })
    .where(eq(users.id, id))
    .returning();

  return user;
};

export const setUserAsVerified = async (id: string) => {
  return updateUser(id, { email_verified_at: new Date(), is_active: true });
};
