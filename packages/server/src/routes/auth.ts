import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from '../models/db.js';
import { generateTokens, verifyRefreshToken, authenticate, isSingleUserMode, SINGLE_USER_PAYLOAD } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { redis } from '../models/redis.js';
import { z } from 'zod';

export const authRoutes = Router();

const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 gün (saniye)

async function markRefreshTokenUsed(token: string): Promise<void> {
  // Token hash'ini key olarak kullan (token çok uzun olabilir)
  const key = `rt:used:${Buffer.from(token).toString('base64').slice(0, 64)}`;
  await redis.setex(key, REFRESH_TOKEN_TTL, '1');
}

async function isRefreshTokenUsed(token: string): Promise<boolean> {
  const key = `rt:used:${Buffer.from(token).toString('base64').slice(0, 64)}`;
  const val = await redis.get(key);
  return val !== null;
}

// Brute force korumasi: login/register icin 5 deneme / 15dk
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Cok fazla deneme. 15 dakika sonra tekrar deneyin.' },
});

// ---- GET /api/auth/mode — Tek kullanıcı modu bilgisi ----
authRoutes.get('/mode', (_req: Request, res: Response) => {
  res.json({ singleUser: isSingleUserMode() });
});

// ---- POST /api/auth/auto-login — Tek kullanıcı otomatik giriş ----
authRoutes.post(
  '/auto-login',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!isSingleUserMode()) {
      throw new AppError('Tek kullanıcı modu aktif değil', 403);
    }

    // Kullanıcıyı oluştur veya getir
    const email = SINGLE_USER_PAYLOAD.email;
    const name = process.env.SINGLE_USER_NAME || 'Admin';

    let result = await db.query('SELECT id, email, display_name, role FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      // İlk kez — kullanıcı oluştur
      const hash = await bcrypt.hash('single-user-mode', 12);
      result = await db.query(
        `INSERT INTO users (id, email, password_hash, display_name, role)
         VALUES ($1, $2, $3, $4, 'admin')
         ON CONFLICT (email) DO UPDATE SET display_name = $4
         RETURNING id, email, display_name, role`,
        [SINGLE_USER_PAYLOAD.userId, email, hash, name]
      );
    }

    const user = result.rows[0];
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
      ...tokens,
    });
  })
);

// Validation şemaları
const registerSchema = z.object({
  email: z.string().email('Geçerli email giriniz'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı'),
  display_name: z.string().min(2, 'İsim en az 2 karakter olmalı').max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ---- POST /api/auth/register ----
authRoutes.post(
  '/register',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = registerSchema.parse(req.body);

    // Email kontrolü
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      throw new AppError('Bu email zaten kayıtlı', 409);
    }

    // Şifre hash
    const passwordHash = await bcrypt.hash(data.password, 12);

    // Kullanıcı oluştur
    const result = await db.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, role, created_at`,
      [data.email, passwordHash, data.display_name]
    );

    const user = result.rows[0];
    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
      ...tokens,
    });
  })
);

// ---- POST /api/auth/login ----
authRoutes.post(
  '/login',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const data = loginSchema.parse(req.body);

    const result = await db.query(
      'SELECT id, email, password_hash, display_name, role FROM users WHERE email = $1 AND is_active = true',
      [data.email]
    );

    if (result.rows.length === 0) {
      throw new AppError('Email veya şifre hatalı', 401);
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(data.password, user.password_hash);

    if (!validPassword) {
      throw new AppError('Email veya şifre hatalı', 401);
    }

    // Son görülme güncelle
    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [user.id]);

    const tokens = generateTokens({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Cookie olarak token'ı set et
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 dakika
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
      ...tokens,
    });
  })
);

// ---- POST /api/auth/refresh ----
authRoutes.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token eksik', 400);
    }

    // Token rotation: ayni refresh token tekrar kullanilamaz (Redis blacklist)
    if (await isRefreshTokenUsed(refreshToken)) {
      throw new AppError('Refresh token zaten kullanildi (replay attack?)', 401);
    }

    const payload = verifyRefreshToken(refreshToken);

    // Eski token'i Redis blacklist'e ekle
    await markRefreshTokenUsed(refreshToken);

    const tokens = generateTokens({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    res.json(tokens);
  })
);

// ---- GET /api/auth/users — Tüm kullanıcıları listele (admin) ----
authRoutes.get(
  '/users',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'admin') {
      throw new AppError('Yetki yok', 403);
    }

    const result = await db.query(
      `SELECT id, email, display_name, role, is_active, avatar_url, last_seen_at, created_at
       FROM users ORDER BY created_at ASC`
    );

    // Aktif oturum sayısı (son 15dk)
    const activeResult = await db.query(
      `SELECT COUNT(*) as active_count FROM users WHERE last_seen_at > NOW() - INTERVAL '15 minutes' AND is_active = true`
    );

    res.json({
      users: result.rows,
      total: result.rows.length,
      active: parseInt(activeResult.rows[0].active_count),
    });
  })
);

// ---- PUT /api/auth/users/:id/role — Kullanıcı rolü değiştir ----
authRoutes.put(
  '/users/:id/role',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'admin') {
      throw new AppError('Yetki yok', 403);
    }

    const { role } = req.body;
    if (!['admin', 'member', 'viewer'].includes(role)) {
      throw new AppError('Geçersiz rol', 400);
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, display_name, role',
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({ user: result.rows[0] });
  })
);

// ---- PUT /api/auth/users/:id/status — Kullanıcı aktif/pasif ----
authRoutes.put(
  '/users/:id/status',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user!.role !== 'admin') {
      throw new AppError('Yetki yok', 403);
    }

    // Kendini deaktif edemez
    if (req.params.id === req.user!.userId) {
      throw new AppError('Kendinizi deaktif edemezsiniz', 400);
    }

    const { is_active } = req.body;
    const result = await db.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, display_name, role, is_active',
      [is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({ user: result.rows[0] });
  })
);

// ---- GET /api/auth/me ----
authRoutes.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      'SELECT id, email, display_name, avatar_url, role, created_at FROM users WHERE id = $1',
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    res.json({ user: result.rows[0] });
  })
);
