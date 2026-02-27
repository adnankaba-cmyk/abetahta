/**
 * MASTER CHECK — 20 Test
 *
 * Buyuk degisikliklerden sonra bu dosya calistirilir.
 * 10 Islev Testi + 10 Calisma Testi
 *
 * Calistirma: cd packages/server && npx vitest run tests/master-check.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';

// httpLogger mock — errorHandler icindeki logger.error() vitest'i kirletmesin
// vi.mock factory hoisted oldugundan inline tanimlanmali
vi.mock('../src/lib/logger.js', () => {
  const ml = (): Record<string, unknown> => {
    const l: Record<string, unknown> = {
      error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn(), fatal: vi.fn(),
    };
    l.child = vi.fn(() => ml());
    return l;
  };
  return {
    httpLogger: ml(),
    logger: ml(),
    socketLogger: ml(),
    wsLogger: ml(),
    dbLogger: ml(),
    redisLogger: ml(),
    aiLogger: ml(),
  };
});

import {
  authenticate,
  generateTokens,
  verifyRefreshToken,
  requireAdmin,
  requireBoardAccess,
  authenticateClaude,
  isSingleUserMode,
  JWT_SECRET,
  SINGLE_USER_PAYLOAD,
} from '../src/middleware/auth.js';
import { AppError, errorHandler, asyncHandler } from '../src/middleware/errorHandler.js';
import { validateUUID } from '../src/middleware/validateUUID.js';

// ═══════════════════════════════════════════════════
// BOLUM 1: ISLEV TESTLERI (10 test)
// ═══════════════════════════════════════════════════

// -- Helper: mock req/res/next --
function mockReqRes(overrides: Record<string, unknown> = {}) {
  const req = {
    headers: {},
    cookies: {},
    params: {},
    body: {},
    user: undefined as any,
    ...overrides,
  } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('ISLEV 1: JWT token uretimi ve dogrulama', () => {
  const payload = { userId: 'user-abc', email: 'test@test.com', role: 'member' };

  it('accessToken ve refreshToken uretir, ikisi de gecerli JWT', () => {
    const tokens = generateTokens(payload);

    // Access token dogrula
    const accessDecoded = jwt.verify(tokens.accessToken, JWT_SECRET) as any;
    expect(accessDecoded.userId).toBe('user-abc');
    expect(accessDecoded.email).toBe('test@test.com');

    // Refresh token dogrula
    const refreshDecoded = verifyRefreshToken(tokens.refreshToken);
    expect(refreshDecoded.userId).toBe('user-abc');
  });
});

describe('ISLEV 2: authenticate middleware — token yok/gecersiz/gecerli', () => {
  const origSingleUser = process.env.SINGLE_USER_MODE;

  beforeEach(() => { process.env.SINGLE_USER_MODE = 'false'; });
  afterEach(() => { process.env.SINGLE_USER_MODE = origSingleUser; });

  it('gecerli token → next() + req.user set', () => {
    const token = generateTokens({ userId: 'u1', email: 'a@b.com', role: 'member' }).accessToken;
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${token}` } });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe('u1');
  });

  it('token yok → 401', () => {
    const { req, res, next } = mockReqRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('gecersiz token → 401', () => {
    const { req, res, next } = mockReqRes({ headers: { authorization: 'Bearer invalid' } });
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('ISLEV 3: SINGLE_USER_MODE bypass', () => {
  const origSingleUser = process.env.SINGLE_USER_MODE;

  afterEach(() => { process.env.SINGLE_USER_MODE = origSingleUser; });

  it('SINGLE_USER_MODE=true → token olmadan gecis, sabit userId', () => {
    process.env.SINGLE_USER_MODE = 'true';
    const { req, res, next } = mockReqRes();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(req.user.role).toBe('admin');
  });

  it('isSingleUserMode() dogru deger doner', () => {
    process.env.SINGLE_USER_MODE = 'true';
    expect(isSingleUserMode()).toBe(true);

    process.env.SINGLE_USER_MODE = 'false';
    expect(isSingleUserMode()).toBe(false);
  });
});

describe('ISLEV 4: requireAdmin middleware', () => {
  it('admin role → next()', () => {
    const { req, res, next } = mockReqRes();
    req.user = { userId: 'u1', email: 'a@b.com', role: 'admin' };

    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('member role → 403', () => {
    const { req, res, next } = mockReqRes();
    req.user = { userId: 'u1', email: 'a@b.com', role: 'member' };

    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('user yok → 403', () => {
    const { req, res, next } = mockReqRes();
    req.user = undefined;

    requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('ISLEV 5: requireBoardAccess middleware — auth kontrolu', () => {
  const origSingleUser = process.env.SINGLE_USER_MODE;

  beforeEach(() => { process.env.SINGLE_USER_MODE = 'false'; });
  afterEach(() => {
    if (origSingleUser === undefined) {
      delete process.env.SINGLE_USER_MODE;
    } else {
      process.env.SINGLE_USER_MODE = origSingleUser;
    }
  });

  it('userId yok → 401', () => {
    const { req, res, next } = mockReqRes({ params: { id: 'board-123' } });
    req.user = undefined;

    requireBoardAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('boardId ve elementId yok → next() (middleware atlanir)', () => {
    const { req, res, next } = mockReqRes();
    req.user = { userId: 'u1', email: 'a@b.com', role: 'member' };

    requireBoardAccess(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('ISLEV 6: authenticateClaude middleware', () => {
  const origKey = process.env.CLAUDE_API_KEY;

  beforeEach(() => { process.env.CLAUDE_API_KEY = 'test-claude-key'; });
  afterEach(() => { process.env.CLAUDE_API_KEY = origKey; });

  it('dogru API key → next() + claude user set', () => {
    const { req, res, next } = mockReqRes({
      headers: { 'x-claude-api-key': 'test-claude-key' },
    });

    authenticateClaude(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe('claude-ai');
    expect(req.user.role).toBe('admin');
  });

  it('yanlis API key → 401', () => {
    const { req, res, next } = mockReqRes({
      headers: { 'x-claude-api-key': 'wrong-key' },
    });

    authenticateClaude(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('API key yok → 401', () => {
    const { req, res, next } = mockReqRes();

    authenticateClaude(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('ISLEV 7: AppError sinifi', () => {
  it('varsayilan 500, custom statusCode, Error instance', () => {
    const err1 = new AppError('test');
    expect(err1.statusCode).toBe(500);
    expect(err1.isOperational).toBe(true);
    expect(err1).toBeInstanceOf(Error);

    const err2 = new AppError('not found', 404);
    expect(err2.statusCode).toBe(404);

    const err3 = new AppError('fatal', 500, false);
    expect(err3.isOperational).toBe(false);
  });
});

describe('ISLEV 8: errorHandler — AppError vs bilinmeyen hata', () => {
  it('AppError → dogru status + mesaj', () => {
    const { res } = mockReqRes();
    const err = new AppError('Bulunamadi', 404);

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Bulunamadi', status: 404 });
  });

  it('generic Error → 500 + genel mesaj', () => {
    const { res } = mockReqRes();

    errorHandler(new Error('boom'), {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sunucu hatası', status: 500 });
  });
});

describe('ISLEV 9: asyncHandler — hatayi next() ile iletir', () => {
  it('Promise reject → next(error) cagirilir', async () => {
    const testError = new AppError('async hata', 400);
    const handler = asyncHandler(async () => { throw testError; });

    const { req, res, next } = mockReqRes();
    handler(req, res, next);

    // asyncHandler icindeki catch microtask, bir tick bekle
    await new Promise((r) => setTimeout(r, 10));
    expect(next).toHaveBeenCalledWith(testError);
  });

  it('basarili async handler → normal calisir', async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.json({ ok: true });
    });

    const { req, res, next } = mockReqRes();
    handler(req, res, next);

    await new Promise((r) => setTimeout(r, 10));
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('ISLEV 10: validateUUID', () => {
  it('gecerli UUID → next()', () => {
    const validator = validateUUID('id');
    const next = vi.fn();

    validator({} as any, {} as any, next, 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(next).toHaveBeenCalledWith(); // no error arg
  });

  it('gecersiz UUID → next(AppError 400)', () => {
    const validator = validateUUID('id');
    const next = vi.fn();

    validator({} as any, {} as any, next, 'not-a-uuid');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(400);
  });

  it('bos string → next(AppError 400)', () => {
    const validator = validateUUID('boardId');
    const next = vi.fn();

    validator({} as any, {} as any, next, '');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});


// ═══════════════════════════════════════════════════
// BOLUM 2: CALISMA TESTLERI (10 test)
// ═══════════════════════════════════════════════════

describe('CALISMA 1: Middleware zincirleme calisiyor', () => {
  it('authenticate + requireAdmin zinciri — admin gecis, member 403', () => {
    // Admin
    const token = generateTokens({ userId: 'admin1', email: 'a@b.com', role: 'admin' }).accessToken;
    const origSingle = process.env.SINGLE_USER_MODE;
    process.env.SINGLE_USER_MODE = 'false';

    const { req: req1, res: res1, next: next1 } = mockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    authenticate(req1, res1, next1);
    expect(next1).toHaveBeenCalled();

    const next2 = vi.fn();
    requireAdmin(req1, res1, next2);
    expect(next2).toHaveBeenCalled();

    // Member — admin middleware reddeder
    const memberToken = generateTokens({ userId: 'm1', email: 'b@b.com', role: 'member' }).accessToken;
    const { req: req3, res: res3, next: next3 } = mockReqRes({
      headers: { authorization: `Bearer ${memberToken}` },
    });
    authenticate(req3, res3, next3);
    expect(next3).toHaveBeenCalled();

    const { res: res4 } = mockReqRes();
    const next4 = vi.fn();
    requireAdmin(req3, res4, next4);
    expect(res4.status).toHaveBeenCalledWith(403);
    expect(next4).not.toHaveBeenCalled();

    process.env.SINGLE_USER_MODE = origSingle;
  });
});

describe('CALISMA 2: Route modulleri import edilebilir', () => {
  it('tum route modulleri Router dondurir', async () => {
    const modules = await Promise.all([
      import('../src/routes/auth.js'),
      import('../src/routes/projects.js'),
      import('../src/routes/boards.js'),
      import('../src/routes/elements.js'),
      import('../src/routes/connections.js'),
      import('../src/routes/notifications.js'),
      import('../src/routes/comments.js'),
      import('../src/routes/settings.js'),
    ]);

    for (const mod of modules) {
      const routerKey = Object.keys(mod).find(k => k.endsWith('Routes'));
      expect(routerKey).toBeTruthy();
    }
  });
});

describe('CALISMA 3: Middleware modulleri export kontrol', () => {
  it('auth.ts gerekli fonksiyonlari export eder', () => {
    expect(typeof authenticate).toBe('function');
    expect(typeof generateTokens).toBe('function');
    expect(typeof verifyRefreshToken).toBe('function');
    expect(typeof requireAdmin).toBe('function');
    expect(typeof requireBoardAccess).toBe('function');
    expect(typeof authenticateClaude).toBe('function');
    expect(typeof isSingleUserMode).toBe('function');
    expect(JWT_SECRET).toBeTruthy();
    expect(SINGLE_USER_PAYLOAD).toBeDefined();
    expect(SINGLE_USER_PAYLOAD.userId).toBe('00000000-0000-0000-0000-000000000001');
  });
});

describe('CALISMA 4: errorHandler modulu export kontrol', () => {
  it('AppError, errorHandler, asyncHandler export edilir', () => {
    expect(typeof AppError).toBe('function');
    expect(typeof errorHandler).toBe('function');
    expect(typeof asyncHandler).toBe('function');
  });
});

describe('CALISMA 5: validateUUID modulu export kontrol', () => {
  it('validateUUID fonksiyonu export edilir', () => {
    expect(typeof validateUUID).toBe('function');
    // Factory pattern — fonksiyon dondurur
    const validator = validateUUID('id');
    expect(typeof validator).toBe('function');
  });
});

describe('CALISMA 6: JWT_SECRET env tabanli', () => {
  it('JWT_SECRET bos degil', () => {
    expect(JWT_SECRET).toBeTruthy();
    expect(typeof JWT_SECRET).toBe('string');
    expect(JWT_SECRET.length).toBeGreaterThan(5);
  });
});

describe('CALISMA 7: Token suresi gecerli', () => {
  it('accessToken exp claim icerir', () => {
    const tokens = generateTokens({ userId: 'u1', email: 'a@b.com', role: 'member' });
    const decoded = jwt.decode(tokens.accessToken) as any;

    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();
    // exp > iat (gelecekte sona erecek)
    expect(decoded.exp).toBeGreaterThan(decoded.iat);
  });

  it('refreshToken daha uzun sureli', () => {
    const tokens = generateTokens({ userId: 'u1', email: 'a@b.com', role: 'member' });
    const access = jwt.decode(tokens.accessToken) as any;
    const refresh = jwt.decode(tokens.refreshToken) as any;

    const accessLifetime = access.exp - access.iat;
    const refreshLifetime = refresh.exp - refresh.iat;

    // Refresh token, access'ten daha uzun olmali
    expect(refreshLifetime).toBeGreaterThan(accessLifetime);
  });
});

describe('CALISMA 8: Cookie fallback calisiyor', () => {
  const origSingleUser = process.env.SINGLE_USER_MODE;

  beforeEach(() => { process.env.SINGLE_USER_MODE = 'false'; });
  afterEach(() => { process.env.SINGLE_USER_MODE = origSingleUser; });

  it('Authorization header yoksa cookie\'den token alir', () => {
    const token = generateTokens({ userId: 'cookie-user', email: 'c@b.com', role: 'member' }).accessToken;
    const { req, res, next } = mockReqRes({
      headers: {},  // Authorization yok
      cookies: { accessToken: token },
    });

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.userId).toBe('cookie-user');
  });
});

describe('CALISMA 9: SINGLE_USER_PAYLOAD sabitleri dogru', () => {
  it('sabit UUID, email, admin role', () => {
    expect(SINGLE_USER_PAYLOAD.userId).toBe('00000000-0000-0000-0000-000000000001');
    expect(SINGLE_USER_PAYLOAD.email).toContain('@');
    expect(SINGLE_USER_PAYLOAD.role).toBe('admin');
  });
});

describe('CALISMA 10: Suresi dolmus token reddedilir', () => {
  const origSingleUser = process.env.SINGLE_USER_MODE;

  beforeEach(() => { process.env.SINGLE_USER_MODE = 'false'; });
  afterEach(() => { process.env.SINGLE_USER_MODE = origSingleUser; });

  it('expired token → 401', () => {
    const expired = jwt.sign(
      { userId: 'u1', email: 'a@b.com', role: 'member' },
      JWT_SECRET,
      { expiresIn: '0s' }
    );
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${expired}` } });

    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('baska secret ile imzali token → 401', () => {
    const wrongToken = jwt.sign(
      { userId: 'u1', email: 'a@b.com', role: 'member' },
      'completely-wrong-secret',
      { expiresIn: '1h' }
    );
    const { req, res, next } = mockReqRes({ headers: { authorization: `Bearer ${wrongToken}` } });

    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
