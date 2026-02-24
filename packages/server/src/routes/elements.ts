import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { applyUUIDValidation } from '../middleware/validateUUID.js';
import { cache } from '../models/redis.js';

export const elementRoutes = Router();
elementRoutes.use(authenticate);
applyUUIDValidation(elementRoutes);

// ---- POST /api/elements ----
elementRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      board_id, type, x, y, width, height, rotation,
      fill_color, stroke_color, stroke_width, opacity, border_radius,
      font_family, font_size, font_weight, text_align,
      content, z_index, parent_id, assigned_to, status, priority, tags, due_date,
    } = req.body;

    if (!board_id || !type) {
      throw new AppError('board_id ve type zorunlu', 400);
    }

    // Proje üyeliği kontrolü
    const member = await db.query(
      `SELECT 1 FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [board_id, req.user!.userId]
    );
    if (member.rows.length === 0) {
      throw new AppError('Bu tahtaya eleman ekleme yetkiniz yok', 403);
    }

    const result = await db.query(
      `INSERT INTO elements (
        board_id, type, x, y, width, height, rotation,
        fill_color, stroke_color, stroke_width, opacity, border_radius,
        font_family, font_size, font_weight, text_align,
        content, z_index, parent_id, created_by,
        assigned_to, status, priority, tags, due_date
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24, $25
      ) RETURNING *`,
      [
        board_id, type, x ?? 0, y ?? 0, width ?? 200, height ?? 150, rotation ?? 0,
        fill_color, stroke_color, stroke_width, opacity, border_radius,
        font_family, font_size, font_weight, text_align,
        JSON.stringify(content || {}), z_index ?? 0, parent_id, req.user!.userId,
        assigned_to, status, priority, tags ?? [], due_date,
      ]
    );

    // Cache invalidate
    await cache.invalidateBoard(board_id);

    res.status(201).json({ element: result.rows[0] });
  })
);

// ---- PUT /api/elements/:id ----
elementRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Mevcut elemanı al — üyelik kontrolü ile
    const existing = await db.query(
      `SELECT e.* FROM elements e
       JOIN boards b ON b.id = e.board_id
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE e.id = $1`,
      [req.params.id, req.user!.userId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Eleman bulunamadı veya yetkiniz yok', 404);
    }

    const current = existing.rows[0];
    const updates = req.body;

    // Dinamik güncelleme
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const allowedFields = [
      'x', 'y', 'width', 'height', 'rotation',
      'fill_color', 'stroke_color', 'stroke_width', 'opacity', 'border_radius',
      'font_family', 'font_size', 'font_weight', 'text_align',
      'content', 'z_index', 'parent_id', 'is_locked', 'is_visible',
      'assigned_to', 'status', 'priority', 'tags', 'due_date',
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${paramIdx}`);
        values.push(field === 'content' ? JSON.stringify(updates[field]) : updates[field]);
        paramIdx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError('Güncellenecek alan yok', 400);
    }

    values.push(req.params.id);
    const result = await db.query(
      `UPDATE elements SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    // History kaydı
    await db.query(
      `INSERT INTO history (board_id, element_id, user_id, action, before_state, after_state)
       VALUES ($1, $2, $3, 'update', $4, $5)`,
      [
        current.board_id,
        req.params.id,
        req.user!.userId,
        JSON.stringify(current),
        JSON.stringify(result.rows[0]),
      ]
    );

    await cache.invalidateBoard(current.board_id);

    res.json({ element: result.rows[0] });
  })
);

// ---- DELETE /api/elements/:id ----
elementRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Üyelik kontrolü ile eleman getir
    const existing = await db.query(
      `SELECT e.* FROM elements e
       JOIN boards b ON b.id = e.board_id
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE e.id = $1`,
      [req.params.id, req.user!.userId]
    );

    if (existing.rows.length === 0) {
      throw new AppError('Eleman bulunamadı veya yetkiniz yok', 404);
    }

    const current = existing.rows[0];

    // History kaydı
    await db.query(
      `INSERT INTO history (board_id, element_id, user_id, action, before_state)
       VALUES ($1, $2, $3, 'delete', $4)`,
      [current.board_id, req.params.id, req.user!.userId, JSON.stringify(current)]
    );

    await db.query('DELETE FROM elements WHERE id = $1', [req.params.id]);
    await cache.invalidateBoard(current.board_id);

    res.json({ message: 'Eleman silindi' });
  })
);

// ---- POST /api/elements/batch ----
elementRoutes.post(
  '/batch',
  asyncHandler(async (req: Request, res: Response) => {
    const { elements } = req.body;

    if (!Array.isArray(elements) || elements.length === 0) {
      throw new AppError('elements dizisi boş', 400);
    }

    const results = await db.transaction(async (client) => {
      const created = [];
      for (const el of elements) {
        const result = await client.query(
          `INSERT INTO elements (board_id, type, x, y, width, height, content, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [el.board_id, el.type, el.x ?? 0, el.y ?? 0, el.width ?? 200, el.height ?? 150,
           JSON.stringify(el.content || {}), req.user!.userId]
        );
        created.push(result.rows[0]);
      }
      return created;
    });

    res.status(201).json({ elements: results });
  })
);

// ---- GET /api/elements/history/:boardId ----
// Tahta geçmişi
elementRoutes.get(
  '/history/:boardId',
  asyncHandler(async (req: Request, res: Response) => {
    const { boardId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await db.query(
      `SELECT h.*, u.display_name as user_name
       FROM history h
       LEFT JOIN users u ON u.id = h.user_id
       WHERE h.board_id = $1
       ORDER BY h.created_at DESC
       LIMIT $2`,
      [boardId, limit]
    );

    res.json({ history: result.rows });
  })
);
