import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticate, generateTokens, verifyRefreshToken, JWT_SECRET } from '../src/middleware/auth.js';

describe('generateTokens', () => {
  const payload = { userId: 'test-123', email: 'test@test.com', role: 'member' };

  it('accessToken ve refreshToken üretir', () => {
    const tokens = generateTokens(payload);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(typeof tokens.accessToken).toBe('string');
    expect(typeof tokens.refreshToken).toBe('string');
  });

  it('accessToken geçerli JWT', () => {
    const tokens = generateTokens(payload);
    const decoded = jwt.verify(tokens.accessToken, JWT_SECRET) as any;
    expect(decoded.userId).toBe('test-123');
    expect(decoded.email).toBe('test@test.com');
    expect(decoded.role).toBe('member');
  });

  it('refreshToken geçerli JWT', () => {
    const tokens = generateTokens(payload);
    const decoded = verifyRefreshToken(tokens.refreshToken);
    expect(decoded.userId).toBe('test-123');
  });
});

describe('authenticate middleware', () => {
  // SINGLE_USER_MODE'u test suresi boyunca devre disi birak
  const originalEnv = process.env.SINGLE_USER_MODE;

  beforeEach(() => {
    process.env.SINGLE_USER_MODE = 'false';
  });

  afterEach(() => {
    process.env.SINGLE_USER_MODE = originalEnv;
  });

  function createReqRes(token?: string) {
    const req = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      cookies: {},
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();
    return { req, res, next };
  }

  it('geçerli token ile next() çağırır', () => {
    const tokens = generateTokens({ userId: 'u1', email: 'a@b.com', role: 'member' });
    const { req, res, next } = createReqRes(tokens.accessToken);

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('u1');
  });

  it('token yoksa 401 döner', () => {
    const { req, res, next } = createReqRes();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('geçersiz token ile 401 döner', () => {
    const { req, res, next } = createReqRes('invalid-token');

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('süresi dolmuş token ile 401 döner', () => {
    const expired = jwt.sign(
      { userId: 'u1', email: 'a@b.com', role: 'member' },
      JWT_SECRET,
      { expiresIn: '0s' }
    );
    const { req, res, next } = createReqRes(expired);

    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('SINGLE_USER_MODE aktifken JWT kontrolsuz gecis yapar', () => {
    process.env.SINGLE_USER_MODE = 'true';
    const { req, res, next } = createReqRes(); // token yok ama...

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.userId).toBe('00000000-0000-0000-0000-000000000001');
  });
});
