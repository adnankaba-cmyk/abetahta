import { describe, it, expect, vi } from 'vitest';
import { AppError, errorHandler } from '../src/middleware/errorHandler.js';

describe('AppError', () => {
  it('varsayılan statusCode 500', () => {
    const err = new AppError('test');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err.message).toBe('test');
  });

  it('özel statusCode kabul eder', () => {
    const err = new AppError('not found', 404);
    expect(err.statusCode).toBe(404);
  });

  it('isOperational false olabilir', () => {
    const err = new AppError('critical', 500, false);
    expect(err.isOperational).toBe(false);
  });

  it('Error instance\'ı', () => {
    const err = new AppError('test', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('errorHandler', () => {
  function createRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res as any;
  }

  it('AppError doğru status ve mesaj döner', () => {
    const res = createRes();
    const err = new AppError('Tahta bulunamadı', 404);

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Tahta bulunamadı',
      status: 404,
    });
  });

  it('bilinmeyen hata 500 döner', () => {
    const res = createRes();
    const err = new Error('Beklenmeyen hata');

    errorHandler(err, {} as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Sunucu hatası',
      status: 500,
    });
  });
});
