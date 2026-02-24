import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';

export const commentRoutes = Router();
commentRoutes.use(authenticate);

// GET /api/comments/element/:elementId
// Bir element'in tüm yorumlarını getir
commentRoutes.get(
  '/element/:elementId',
  asyncHandler(async (req: Request, res: Response) => {
    const { elementId } = req.params;

    const result = await db.query(
      `SELECT c.*, u.display_name as user_name, u.avatar_url
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.element_id = $1
       ORDER BY c.created_at ASC`,
      [elementId]
    );

    res.json({ comments: result.rows });
  })
);

// POST /api/comments
// Yeni yorum ekle
commentRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { element_id, body, parent_id } = req.body;
    const userId = (req as any).user?.id;

    if (!element_id || !body) {
      throw new AppError('element_id ve body zorunlu', 400);
    }

    // Element'in var olduğunu kontrol et
    const element = await db.query('SELECT id, board_id FROM elements WHERE id = $1', [element_id]);
    if (element.rows.length === 0) {
      throw new AppError('Element bulunamadi', 404);
    }

    const result = await db.query(
      `INSERT INTO comments (element_id, user_id, body, is_ai, parent_id)
       VALUES ($1, $2, $3, false, $4)
       RETURNING *`,
      [element_id, userId, body, parent_id || null]
    );

    // Kullanıcı adını da döndür
    const comment = result.rows[0];
    const user = await db.query('SELECT display_name, avatar_url FROM users WHERE id = $1', [userId]);
    comment.user_name = user.rows[0]?.display_name;
    comment.avatar_url = user.rows[0]?.avatar_url;

    res.status(201).json({ comment });
  })
);

// PUT /api/comments/:id
// Yorum güncelle (sadece kendi yorumunu)
commentRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { body } = req.body;
    const userId = (req as any).user?.id;

    if (!body) {
      throw new AppError('body zorunlu', 400);
    }

    const result = await db.query(
      `UPDATE comments SET body = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [body, id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Yorum bulunamadi veya yetki yok', 404);
    }

    res.json({ comment: result.rows[0] });
  })
);

// DELETE /api/comments/:id
// Yorum sil (sadece kendi yorumunu)
commentRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const result = await db.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Yorum bulunamadi veya yetki yok', 404);
    }

    res.json({ deleted: true });
  })
);
