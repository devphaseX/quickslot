export type JwtPayload = { [key: string]: unknown };

export interface JwtAccessPayload extends JwtPayload {
  user_id: string;
  session_id: string;
}

export interface JwtRefreshPayload extends JwtPayload {
  session_id: string;
}
