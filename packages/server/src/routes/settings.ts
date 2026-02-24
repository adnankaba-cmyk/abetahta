import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { logger } from '../lib/logger.js';

const settingsLogger = logger.child({ module: 'settings' });

export const settingsRoutes = Router();
settingsRoutes.use(authenticate);

// GET /api/settings — Tüm ayarları getir (kategori filtresi opsiyonel)
settingsRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.query;

    let query = 'SELECT key, value, category, type, label, description, updated_at FROM settings';
    const params: string[] = [];

    if (category) {
      query += ' WHERE category = $1';
      params.push(category as string);
    }

    query += ' ORDER BY category, key';

    const result = await db.query(query, params);

    // Secret değerleri maskele
    const settings = result.rows.map((row: { key: string; value: string; category: string; type: string; label: string; description: string; updated_at: string }) => ({
      ...row,
      value: row.type === 'secret' && row.value ? '••••••••' : row.value,
    }));

    settingsLogger.info({ count: settings.length, category: category || 'all' }, 'Settings okundu');
    res.json({ settings });
  })
);

// GET /api/settings/:key — Tek ayar getir
settingsRoutes.get(
  '/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const result = await db.query(
      'SELECT key, value, category, type, label, description, updated_at FROM settings WHERE key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      throw new AppError(`Ayar bulunamadı: ${key}`, 404);
    }

    const setting = result.rows[0];
    if (setting.type === 'secret' && setting.value) {
      setting.value = '••••••••';
    }

    res.json({ setting });
  })
);

// PUT /api/settings — Toplu ayar güncelle
settingsRoutes.put(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { settings } = req.body as { settings: Record<string, string> };

    if (!settings || typeof settings !== 'object') {
      throw new AppError('settings objesi zorunlu', 400);
    }

    const updated: string[] = [];

    await db.transaction(async (client) => {
      for (const [key, value] of Object.entries(settings)) {
        // Secret alan boş gelirse (masked) güncelleme atla
        if (value === '••••••••') continue;

        const result = await client.query(
          'UPDATE settings SET value = $1 WHERE key = $2 RETURNING key',
          [String(value), key]
        );

        if (result.rows.length > 0) {
          updated.push(key);
        }
      }
    });

    settingsLogger.info({ updated, count: updated.length }, 'Settings guncellendi');
    res.json({ updated, count: updated.length });
  })
);

// PUT /api/settings/:key — Tek ayar güncelle
settingsRoutes.put(
  '/:key',
  asyncHandler(async (req: Request, res: Response) => {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined) {
      throw new AppError('value zorunlu', 400);
    }

    const result = await db.query(
      'UPDATE settings SET value = $1 WHERE key = $2 RETURNING key, value, category, type, label',
      [String(value), key]
    );

    if (result.rows.length === 0) {
      throw new AppError(`Ayar bulunamadı: ${key}`, 404);
    }

    settingsLogger.info({ key, category: result.rows[0].category }, 'Setting guncellendi');
    res.json({ setting: result.rows[0] });
  })
);
