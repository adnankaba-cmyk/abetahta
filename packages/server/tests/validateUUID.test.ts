import { describe, it, expect, vi } from 'vitest';
import { validateUUID } from '../src/middleware/validateUUID.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('validateUUID middleware', () => {
  const middleware = validateUUID('id');

  function callMiddleware(value: string) {
    const req = {} as any;
    const res = {} as any;
    const next = vi.fn();
    middleware(req, res, next, value);
    return next;
  }

  it('geçerli UUID kabul eder', () => {
    const next = callMiddleware('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    expect(next).toHaveBeenCalledWith();
  });

  it('küçük harf UUID kabul eder', () => {
    const next = callMiddleware('550e8400-e29b-41d4-a716-446655440000');
    expect(next).toHaveBeenCalledWith();
  });

  it('büyük harf UUID kabul eder', () => {
    const next = callMiddleware('550E8400-E29B-41D4-A716-446655440000');
    expect(next).toHaveBeenCalledWith();
  });

  it('geçersiz UUID reddeder', () => {
    const next = callMiddleware('not-a-uuid');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const err = next.mock.calls[0][0] as AppError;
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Gecersiz');
  });

  it('boş string reddeder', () => {
    const next = callMiddleware('');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('SQL injection girişimini reddeder', () => {
    const next = callMiddleware("'; DROP TABLE users; --");
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });

  it('kısa UUID reddeder', () => {
    const next = callMiddleware('550e8400-e29b-41d4');
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
  });
});
