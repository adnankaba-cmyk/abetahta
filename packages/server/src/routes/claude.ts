import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticateClaude } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { cache } from '../models/redis.js';

export const claudeRoutes = Router();
claudeRoutes.use(authenticateClaude);

/** Board varlik kontrolu — Claude route'lari icin */
async function ensureBoardExists(boardId: string): Promise<void> {
  const result = await db.query('SELECT id FROM boards WHERE id = $1', [boardId]);
  if (result.rows.length === 0) {
    throw new AppError('Tahta bulunamadi', 404);
  }
}

// ============================================
// GET /api/claude/board/:id
// Tam tahta verisi - Claude'un gördüğü veri
// ============================================
claudeRoutes.get(
  '/board/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.id;

    // Cache kontrol
    const cached = await cache.get(`board:${boardId}:full`);
    if (cached) {
      res.json(cached);
      return;
    }

    const board = await db.query('SELECT * FROM boards WHERE id = $1', [boardId]);
    if (board.rows.length === 0) {
      throw new AppError('Tahta bulunamadı', 404);
    }

    const elements = await db.query(
      `SELECT e.*,
              u.display_name as assigned_to_name,
              c.display_name as created_by_name
       FROM elements e
       LEFT JOIN users u ON u.id = e.assigned_to
       LEFT JOIN users c ON c.id = e.created_by
       WHERE e.board_id = $1
       ORDER BY e.z_index`,
      [boardId]
    );

    const connections = await db.query(
      'SELECT * FROM connections WHERE board_id = $1',
      [boardId]
    );

    const comments = await db.query(
      `SELECT c.*, u.display_name as user_name
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.element_id IN (SELECT id FROM elements WHERE board_id = $1)
       ORDER BY c.created_at`,
      [boardId]
    );

    const response = {
      board: board.rows[0],
      elements: elements.rows,
      connections: connections.rows,
      comments: comments.rows,
      meta: {
        element_count: elements.rows.length,
        connection_count: connections.rows.length,
        comment_count: comments.rows.length,
        fetched_at: new Date().toISOString(),
      },
    };

    await cache.set(`board:${boardId}:full`, response, 30);
    res.json(response);
  })
);

// ============================================
// GET /api/claude/board/:id/summary
// Özet bilgi - hızlı bakış
// ============================================
claudeRoutes.get(
  '/board/:id/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.id;

    const board = await db.query('SELECT id, name, project_id FROM boards WHERE id = $1', [boardId]);
    if (board.rows.length === 0) {
      throw new AppError('Tahta bulunamadı', 404);
    }

    // Tür dağılımı
    const typeCount = await db.query(
      `SELECT type, COUNT(*) as count FROM elements WHERE board_id = $1 GROUP BY type`,
      [boardId]
    );

    // Durum dağılımı
    const statusCount = await db.query(
      `SELECT status, COUNT(*) as count FROM elements
       WHERE board_id = $1 AND status != 'none'
       GROUP BY status`,
      [boardId]
    );

    // Atama dağılımı
    const assigneeCount = await db.query(
      `SELECT u.display_name, COUNT(*) as task_count
       FROM elements e
       JOIN users u ON u.id = e.assigned_to
       WHERE e.board_id = $1
       GROUP BY u.display_name`,
      [boardId]
    );

    // Öncelik dağılımı
    const priorityCount = await db.query(
      `SELECT priority, COUNT(*) as count FROM elements
       WHERE board_id = $1 AND priority != 'none'
       GROUP BY priority`,
      [boardId]
    );

    res.json({
      board: board.rows[0],
      summary: {
        by_type: typeCount.rows,
        by_status: statusCount.rows,
        by_assignee: assigneeCount.rows,
        by_priority: priorityCount.rows,
      },
    });
  })
);

// ============================================
// GET /api/claude/board/:id/flow
// Sadece flowchart düğümleri ve bağlantılar
// ============================================
claudeRoutes.get(
  '/board/:id/flow',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.id as string;
    await ensureBoardExists(boardId);

    const nodes = await db.query(
      `SELECT id, content, x, y, status, assigned_to
       FROM elements
       WHERE board_id = $1 AND type = 'flowchart_node'
       ORDER BY y, x`,
      [boardId]
    );

    const connections = await db.query(
      `SELECT source_id, target_id, label, line_type
       FROM connections
       WHERE board_id = $1`,
      [boardId]
    );

    res.json({
      nodes: nodes.rows,
      connections: connections.rows,
      meta: {
        node_count: nodes.rows.length,
        connection_count: connections.rows.length,
      },
    });
  })
);

// ============================================
// POST /api/claude/board/:id/element
// Claude yeni eleman oluşturur
// ============================================
claudeRoutes.post(
  '/board/:id/element',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.id as string;
    const { type, x, y, width, height, content, assigned_to, status, priority } = req.body;

    if (!type) {
      throw new AppError('type zorunlu', 400);
    }

    // Board varlik kontrolu
    const boardCheck = await db.query('SELECT id FROM boards WHERE id = $1', [boardId]);
    if (boardCheck.rows.length === 0) {
      throw new AppError('Board bulunamadi', 404);
    }

    const result = await db.query(
      `INSERT INTO elements (board_id, type, x, y, width, height, content, created_by, assigned_to, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [boardId, type, x ?? 0, y ?? 0, width ?? 200, height ?? 150,
       JSON.stringify(content || {}), req.user?.userId || 'claude-ai',
       assigned_to, status ?? 'none', priority ?? 'none']
    );

    await cache.invalidateBoard(boardId);
    res.status(201).json({ element: result.rows[0] });
  })
);

// ============================================
// PUT /api/claude/element/:id
// Claude eleman günceller
// ============================================
claudeRoutes.put(
  '/element/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body;

    // Element'in board'unu bul — erişim kontrolü için
    const elementCheck = await db.query(
      'SELECT board_id FROM elements WHERE id = $1',
      [req.params.id]
    );
    if (elementCheck.rows.length === 0) {
      throw new AppError('Eleman bulunamadı', 404);
    }
    // Board var mı kontrol et (basit varlık kontrolü — Claude route'u ayrı key ile korunuyor)
    const boardCheck = await db.query('SELECT id FROM boards WHERE id = $1', [elementCheck.rows[0].board_id]);
    if (boardCheck.rows.length === 0) {
      throw new AppError('Board bulunamadı', 404);
    }

    const fields: string[] = [];
    const values: string[] = [];
    let idx = 1;

    const allowed = ['content', 'status', 'priority', 'assigned_to', 'tags', 'x', 'y', 'width', 'height'];

    for (const field of allowed) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = $${idx}`);
        values.push(field === 'content' ? JSON.stringify(updates[field]) : updates[field]);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError('Güncellenecek alan yok', 400);
    }

    values.push(req.params.id as string);
    const result = await db.query(
      `UPDATE elements SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Eleman bulunamadı', 404);
    }

    await cache.invalidateBoard(result.rows[0].board_id);
    res.json({ element: result.rows[0] });
  })
);

// ============================================
// POST /api/claude/board/:id/analyze
// Claude analiz sonucu yazar
// ============================================
claudeRoutes.post(
  '/board/:id/analyze',
  asyncHandler(async (req: Request, res: Response) => {
    const boardId = req.params.id as string;
    await ensureBoardExists(boardId);
    const { analysis_type, findings, suggestions } = req.body;

    // Analiz sonucunu note olarak tahta'ya ekle
    const result = await db.query(
      `INSERT INTO elements (board_id, type, x, y, width, height, content, created_by)
       VALUES ($1, 'note', 50, 50, 400, 300, $2, NULL)
       RETURNING *`,
      [
        boardId,
        JSON.stringify({
          title: `AI Analizi: ${analysis_type || 'Genel'}`,
          body: findings || '',
          suggestions: suggestions || [],
          color: '#E0F2FE',
          is_ai_generated: true,
          generated_at: new Date().toISOString(),
        }),
      ]
    );

    await cache.invalidateBoard(boardId);
    res.status(201).json({ element: result.rows[0] });
  })
);

// ============================================
// POST /api/claude/board/:id/comment
// Claude yorum ekler
// ============================================
claudeRoutes.post(
  '/board/:id/comment',
  asyncHandler(async (req: Request, res: Response) => {
    const { element_id, body } = req.body;

    if (!element_id || !body) {
      throw new AppError('element_id ve body zorunlu', 400);
    }

    // Element varlik kontrolu
    const elCheck = await db.query('SELECT id FROM elements WHERE id = $1', [element_id]);
    if (elCheck.rows.length === 0) {
      throw new AppError('Element bulunamadi', 404);
    }

    const result = await db.query(
      `INSERT INTO comments (element_id, body, is_ai)
       VALUES ($1, $2, true)
       RETURNING *`,
      [element_id, body]
    );

    res.status(201).json({ comment: result.rows[0] });
  })
);
