import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { applyUUIDValidation } from '../middleware/validateUUID.js';
import { cache } from '../models/redis.js';

export const connectionRoutes = Router();
connectionRoutes.use(authenticate);
applyUUIDValidation(connectionRoutes);

// ---- POST /api/connections ----
connectionRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const {
      board_id,
      source_id,
      target_id,
      line_type = 'straight',
      stroke_color = '#9ca3af',
      stroke_width = 2,
      label,
    } = req.body;

    if (!board_id || !source_id || !target_id) {
      throw new AppError('board_id, source_id, target_id zorunlu', 400);
    }

    if (source_id === target_id) {
      throw new AppError('Aynı element\'e bağlanamaz', 400);
    }

    // Proje üyeliği kontrolü
    const memberCheck = await db.query(
      `SELECT 1 FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [board_id, req.user!.userId]
    );
    if (memberCheck.rows.length === 0) {
      throw new AppError('Bu tahtaya bağlantı ekleme yetkiniz yok', 403);
    }

    // Verify elements exist and belong to the board
    const sourceResult = await db.query(
      'SELECT id FROM elements WHERE id = $1 AND board_id = $2',
      [source_id, board_id]
    );
    const targetResult = await db.query(
      'SELECT id FROM elements WHERE id = $1 AND board_id = $2',
      [target_id, board_id]
    );

    if (!sourceResult.rows.length || !targetResult.rows.length) {
      throw new AppError('Element(ler) bulunamadı', 404);
    }

    // Check if connection already exists
    const existingResult = await db.query(
      'SELECT id FROM connections WHERE board_id = $1 AND source_id = $2 AND target_id = $3',
      [board_id, source_id, target_id]
    );

    if (existingResult.rows.length) {
      throw new AppError('Bu bağlantı zaten mevcut', 400);
    }

    const result = await db.query(
      `INSERT INTO connections (
        board_id, source_id, target_id, line_type, stroke_color, stroke_width, label, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8
      ) RETURNING *`,
      [board_id, source_id, target_id, line_type, stroke_color, stroke_width, label || null, req.user!.userId]
    );

    // Cache invalidate
    await cache.invalidateBoard(board_id);

    res.status(201).json({
      success: true,
      connection: result.rows[0],
    });
  })
);

// ---- GET /api/connections?board_id=X ----
connectionRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { board_id } = req.query;

    if (!board_id) {
      throw new AppError('board_id parametresi gerekli', 400);
    }

    // Proje üyeliği kontrolü
    const memberCheck = await db.query(
      `SELECT 1 FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [board_id, req.user!.userId]
    );
    if (memberCheck.rows.length === 0) {
      throw new AppError('Bu tahtanın bağlantılarını görme yetkiniz yok', 403);
    }

    const result = await db.query(
      'SELECT * FROM connections WHERE board_id = $1 ORDER BY created_at DESC',
      [board_id]
    );

    res.json({
      success: true,
      connections: result.rows,
      count: result.rows.length,
    });
  })
);

// ---- DELETE /api/connections/:id ----
connectionRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // Üyelik kontrolü ile bağlantı getir
    const result = await db.query(
      `SELECT c.board_id FROM connections c
       JOIN boards b ON b.id = c.board_id
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE c.id = $1`,
      [id, req.user!.userId]
    );

    if (!result.rows.length) {
      throw new AppError('Bağlantı bulunamadı veya yetkiniz yok', 404);
    }

    const board_id = result.rows[0].board_id;

    await db.query('DELETE FROM connections WHERE id = $1', [id]);

    // Cache invalidate
    await cache.invalidateBoard(board_id);

    res.json({
      success: true,
      message: 'Bağlantı silindi',
    });
  })
);

// ---- PUT /api/connections/:id ----
connectionRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { line_type, stroke_color, stroke_width, label } = req.body;

    // Üyelik kontrolü ile bağlantı getir
    const result = await db.query(
      `SELECT c.board_id FROM connections c
       JOIN boards b ON b.id = c.board_id
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE c.id = $1`,
      [id, req.user!.userId]
    );

    if (!result.rows.length) {
      throw new AppError('Bağlantı bulunamadı veya yetkiniz yok', 404);
    }

    const board_id = result.rows[0].board_id;

    const updateResult = await db.query(
      `UPDATE connections SET
        line_type = COALESCE($2, line_type),
        stroke_color = COALESCE($3, stroke_color),
        stroke_width = COALESCE($4, stroke_width),
        label = COALESCE($5, label),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [id, line_type, stroke_color, stroke_width, label]
    );

    // Cache invalidate
    await cache.invalidateBoard(board_id);

    res.json({
      success: true,
      connection: updateResult.rows[0],
    });
  })
);
