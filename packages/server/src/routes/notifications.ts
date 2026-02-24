import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { applyUUIDValidation } from '../middleware/validateUUID.js';

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
applyUUIDValidation(notificationRoutes);

// ---- GET /api/notifications ----
notificationRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === 'true';

    const where = unreadOnly
      ? 'WHERE user_id = $1 AND is_read = false'
      : 'WHERE user_id = $1';

    const result = await db.query(
      `SELECT * FROM notifications ${where}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user!.userId, limit, offset]
    );

    res.json({ notifications: result.rows });
  })
);

// ---- GET /api/notifications/unread-count ----
notificationRoutes.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user!.userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  })
);

// ---- PUT /api/notifications/read-all ----
notificationRoutes.put(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user!.userId]
    );

    res.json({ message: 'Tüm bildirimler okundu' });
  })
);

// ---- PUT /api/notifications/:id/read ----
notificationRoutes.put(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bildirim bulunamadı', 404);
    }

    res.json({ notification: result.rows[0] });
  })
);

// ---- DELETE /api/notifications/:id ----
notificationRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Bildirim bulunamadı', 404);
    }

    res.json({ message: 'Bildirim silindi' });
  })
);
