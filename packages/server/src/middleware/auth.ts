import type { Request, Response, NextFunction } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import dotenv from 'dotenv';
import { db } from '../models/db.js';

dotenv.config({ path: '../../.env' });

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error('FATAL: JWT_SECRET ve JWT_REFRESH_SECRET .env dosyasinda tanimlanmali. Fallback kullanilmayacak.');
}

export const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthPayload;
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
  const accessOpts: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as StringValue };
  const accessToken = jwt.sign(payload, JWT_SECRET, accessOpts);

  const refreshOpts: SignOptions = { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as StringValue };
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, refreshOpts);

  return { accessToken, refreshToken } as const;
}

/** Refresh token doğrula */
export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_REFRESH_SECRET) as AuthPayload;
}

/** Admin role kontrolu middleware'i — authenticate'den sonra kullan */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Bu islem icin admin yetkisi gerekli' });
    return;
  }
  next();
}

/**
 * Board erisim kontrolu — kullanicinin board'un projesinde uyesi olup olmadigini dogrular.
 * boardId'yi su sirada arar: req.params.id → req.params.boardId → req.body.board_id → req.body.boardId
 * Element-based erisim: req.params.elementId varsa, element'in board'una bakar.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireBoardAccess(req: Request, res: Response, next: NextFunction): void {
  // Tek kullanıcı modunda board erişim kontrolünü atla
  if (isSingleUserMode()) {
    next();
    return;
  }

  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'Yetkilendirme gerekli' });
    return;
  }

  // Board ID bul
  const rawBoardId = req.params.id || req.params.boardId || req.body?.board_id || req.body?.boardId;
  const boardId = rawBoardId;
  const elementId = req.params.elementId;

  // UUID formatı doğrula (elementId yoksa)
  if (boardId && !elementId && !UUID_REGEX.test(boardId)) {
    res.status(400).json({ error: 'Geçersiz board ID formatı' });
    return;
  }

  if (!boardId && !elementId) {
    // Ne boardId ne elementId var — bu middleware uygulanmamali, gecis ver
    next();
    return;
  }

  const checkAccess = async () => {
    if (elementId && !boardId) {
      // Element uzerinden board bul, sonra erisim kontrol et
      const elResult = await db.query('SELECT board_id FROM elements WHERE id = $1', [elementId]);
      if (elResult.rows.length === 0) {
        res.status(404).json({ error: 'Element bulunamadi' });
        return;
      }
      const elBoardId = elResult.rows[0].board_id;
      const access = await db.query(
        `SELECT 1 FROM boards b
         JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
         WHERE b.id = $1`,
        [elBoardId, userId]
      );
      if (access.rows.length === 0) {
        res.status(403).json({ error: 'Bu board\'a erisim yetkiniz yok' });
        return;
      }
      next();
    } else {
      // Board ID ile dogrudan kontrol
      const access = await db.query(
        `SELECT 1 FROM boards b
         JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
         WHERE b.id = $1`,
        [boardId, userId]
      );
      if (access.rows.length === 0) {
        res.status(403).json({ error: 'Bu board\'a erisim yetkiniz yok' });
        return;
      }
      next();
    }
  };

  checkAccess().catch(() => {
    res.status(500).json({ error: 'Erisim kontrolu sirasinda hata olustu' });
  });
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
