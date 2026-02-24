import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { applyUUIDValidation } from '../middleware/validateUUID.js';
import { httpLogger } from '../lib/logger.js';

export const boardRoutes = Router();
boardRoutes.use(authenticate);
applyUUIDValidation(boardRoutes);

// ---- GET /api/boards (list) ----
boardRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { project_id } = req.query;
    const userId = req.user!.userId;

    // Sadece kullanıcının üyesi olduğu projelerin tahtalarını getir
    const result = project_id
      ? await db.query(
          `SELECT b.id, b.project_id, b.name, b.description
           FROM boards b
           JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
           WHERE b.project_id = $1
           ORDER BY b.created_at DESC`,
          [project_id, userId]
        )
      : await db.query(
          `SELECT b.id, b.project_id, b.name, b.description
           FROM boards b
           JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $1
           ORDER BY b.created_at DESC`,
          [userId]
        );

    res.json(result.rows);
  })
);

// ---- GET /api/boards/:id ----
boardRoutes.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Üyelik kontrolü ile birlikte tahta getir
    const board = await db.query(
      `SELECT b.* FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [req.params.id, userId]
    );

    if (board.rows.length === 0) {
      throw new AppError('Tahta bulunamadı veya yetkiniz yok', 404);
    }

    // Elemanları getir
    const elements = await db.query(
      'SELECT * FROM elements WHERE board_id = $1 ORDER BY z_index',
      [req.params.id]
    );

    // Bağlantıları getir
    const connections = await db.query(
      'SELECT * FROM connections WHERE board_id = $1',
      [req.params.id]
    );

    res.json({
      board: board.rows[0],
      elements: elements.rows,
      connections: connections.rows,
    });
  })
);

// ---- POST /api/boards ----
boardRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { project_id, name, description } = req.body;
    const userId = req.user!.userId;

    if (!project_id || !name) {
      throw new AppError('project_id ve name zorunlu', 400);
    }

    // Proje üyeliği kontrolü
    const member = await db.query(
      'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
      [project_id, userId]
    );
    if (member.rows.length === 0) {
      throw new AppError('Bu projeye tahta ekleme yetkiniz yok', 403);
    }

    const result = await db.query(
      `INSERT INTO boards (project_id, name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [project_id, name, description || null, userId]
    );

    res.status(201).json({ board: result.rows[0] });
  })
);

// ---- PUT /api/boards/:id ----
boardRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { name, description, viewport_x, viewport_y, viewport_zoom, tldraw_data } = req.body;

    // Üyelik kontrolü
    const check = await db.query(
      `SELECT b.id FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [req.params.id, userId]
    );
    if (check.rows.length === 0) {
      throw new AppError('Tahta bulunamadı veya yetkiniz yok', 404);
    }

    // tldraw data varsa onu kaydet
    if (tldraw_data !== undefined) {
      httpLogger.debug({ size: JSON.stringify(tldraw_data).length }, 'tldraw_data alındı');
      const result = await db.query(
        `UPDATE boards SET tldraw_data = $2, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [req.params.id, JSON.stringify(tldraw_data)]
      );

      res.json({ board: result.rows[0] });
      return;
    }

    // Normal guncelleme
    const result = await db.query(
      `UPDATE boards SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         viewport_x = COALESCE($4, viewport_x),
         viewport_y = COALESCE($5, viewport_y),
         viewport_zoom = COALESCE($6, viewport_zoom),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, name, description, viewport_x, viewport_y, viewport_zoom]
    );

    res.json({ board: result.rows[0] });
  })
);

// ---- DELETE /api/boards/:id ----
boardRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;

    // Sadece proje sahibi veya admin silebilir
    const result = await db.query(
      `DELETE FROM boards
       WHERE id = $1
         AND project_id IN (
           SELECT project_id FROM project_members
           WHERE user_id = $2 AND role IN ('owner', 'admin')
         )
       RETURNING id`,
      [req.params.id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Tahta bulunamadı veya silme yetkiniz yok', 404);
    }

    res.json({ message: 'Tahta silindi' });
  })
);
