import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** JWT token'ı header veya cookie'den çöz */
function extractToken(req: Request): string | null {
  // 1. Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // 2. Cookie fallback
  return (req.cookies?.accessToken as string) ?? null;
}

/** Tek kullanıcı modu aktif mi? (her istekte process.env'den okunur — test edilebilirlik icin) */
export function isSingleUserMode(): boolean {
  return process.env.SINGLE_USER_MODE === 'true';
}

const SINGLE_USER_PAYLOAD: AuthPayload = {
  userId: '00000000-0000-0000-0000-000000000001',
  email: process.env.SINGLE_USER_EMAIL || 'admin@abetahta.local',
  role: 'admin',
};

/** @deprecated SINGLE_USER_MODE sabiti — kullanmak yerine isSingleUserMode() cagiriniz */
export const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true';

/** Kullanıcı JWT doğrulama middleware'i */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Tek kullanıcı modunda auth atla
  if (isSingleUserMode()) {
    req.user = SINGLE_USER_PAYLOAD;
    next();
    return;
  }

  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ error: 'Yetkilendirme başlığı eksik' });
    return;
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
  }
}

export { SINGLE_USER_PAYLOAD };

/** Access + refresh token üret */
export function generateTokens(payload: AuthPayload) {
  const accessOpts: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as any };
  const accessToken = jwt.sign(payload, JWT_SECRET, accessOpts);

  const refreshOpts: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any };
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, refreshOpts);

  return { accessToken, refreshToken } as const;
}

/** Refresh token doğrula */
export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload;
}

/** Claude API key doğrulama middleware'i */
export function authenticateClaude(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-claude-api-key'];

  if (!apiKey || apiKey !== process.env.CLAUDE_API_KEY) {
    res.status(401).json({ error: 'Geçersiz Claude API key' });
    return;
  }

  req.user = {
    userId: 'claude-ai',
    email: 'claude@abetahta.local',
    role: 'admin',
  };

  next();
}
