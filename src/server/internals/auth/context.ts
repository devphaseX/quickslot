import { getContext } from "hono/context-storage";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { Session, UserClient } from "../db/schema";
import { AppEnv } from "../types/appenv";
import { Context } from "hono";
import { JwtToken } from "./token";
import { getEnv } from "../env";

export const setAuthSession = (user: UserClient, session: Session) => {
  const ctx = getContext<AppEnv>();
  ctx.set("user", user);
  ctx.set("session", session);
};

export const getAuthSession = () => {
  const ctx = getContext<AppEnv>();
  const user = ctx.get("user");
  const session = ctx.get("session");
  return { user, session };
};

export const setAuthenicationCookie = (
  c: Context<AppEnv>,
  token: { access: JwtToken; refresh?: JwtToken },
) => {
  const isProd = getEnv("ENV") === "production";
  setCookie(c, getEnv("ACCESS_TOKEN_COOKIE_NAME"), token.access.token, {
    maxAge: token.access.expiresIn.seconds(),
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? "Strict" : "Lax",
    path: "/",
  });

  if (token.refresh) {
    setCookie(c, getEnv("REFRESH_TOKEN_COOKIE_NAME"), token.refresh.token, {
      maxAge: token.refresh.expiresIn.seconds(),
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "Strict" : "Lax",
      path: getEnv("REFRESH_PATH"),
    });
  }
};

export const clearAuthenicationCookie = (c: Context) => {
  const now = new Date();
  const isProd = getEnv("ENV") === "production";
  deleteCookie(c, getEnv("ACCESS_TOKEN_COOKIE_NAME"), {
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? "Strict" : "Lax",
    path: "/",
  });

  deleteCookie(c, getEnv("REFRESH_TOKEN_COOKIE_NAME"), {
    secure: isProd,
    httpOnly: true,
    sameSite: isProd ? "Strict" : "Lax",
    path: getEnv("REFRESH_PATH"),
  });
};

export const getRefreshTokenCookie = (c: Context) =>
  getCookie(c, getEnv("REFRESH_TOKEN_COOKIE_NAME"));

export const getAccessTokenCookie = (c: Context) =>
  getCookie(c, getEnv("ACCESS_TOKEN_COOKIE_NAME"));
