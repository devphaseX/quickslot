import { Cache } from "cache-manager";
import crypto from "crypto";
import { encodeBase32NoPadding } from "@oslojs/encoding";
import { cache } from "./cache";

export enum TokenType {
  ACCESS = "access",
  REFRESH = "refresh",
  VERIFY_EMAIL = "verify_email",
  VERIFY_FORGET_PASSWORD_EMAIL = "verify_forget_password_email",
  RESET_PASSWORD = "reset_password",
}

type WithTokenPayloadFields<Payload> = TokenPayload & Payload;

export type TokenMetadata = {
  [TokenType.VERIFY_FORGET_PASSWORD_EMAIL]: WithTokenPayloadFields<{
    email: string;
  }>;
};

export type TokenPayload = {
  user_id: string;
  email: string;
  type: TokenType;
  data?: Buffer | string;
  expires_at: Date;
};

const DEFAULT_TTL = 60 * 60; // 1 hour in seconds

export class TokenCache {
  private cache: Cache;
  constructor(cacheInstance: Cache) {
    this.cache = cacheInstance;
  }

  async createToken(
    userId: string,
    email: string,
    type: TokenType,
    data?: string | Buffer,
    expiresInSeconds?: number,
  ): Promise<string> {
    const token = encodeBase32NoPadding(crypto.randomBytes(32));

    const expires_in = expiresInSeconds || DEFAULT_TTL;
    const expires_at = new Date(Date.now() + expires_in * 1000);

    const payload: TokenPayload = {
      user_id: userId,
      email,
      type,
      data,
      expires_at,
    };

    try {
      await this.cache.set(
        token,
        payload,
        (expiresInSeconds || DEFAULT_TTL) * 1000,
      ); //cache manager store ttl in milliseconds
      return token;
    } catch (error) {
      console.error("Failed to store token in cache:", error); // More detailed error logging
      throw new Error("Failed to store token in cache.");
    }
  }

  async verifyToken<Payload extends TokenPayload = TokenPayload>(
    token: string,
  ): Promise<Payload | null> {
    try {
      const payload = await this.cache.get<Payload>(token);
      if (!payload) {
        return null;
      }

      if (payload.expires_at < new Date()) {
        await this.cache.del(token);
        return null;
      }

      return payload;
    } catch (error) {
      console.error("Failed to verify token:", error);
      return null; // Treat cache errors as invalid tokens
    }
  }

  async invalidateToken(token: string): Promise<boolean> {
    try {
      await this.cache.del(token);
      return true; // cache-manager del doesn't confirm deletion
    } catch (error) {
      console.error("Failed to invalidate token:", error);
      return false;
    }
  }
}

export const tokenCache = new TokenCache(cache);
