import { Router, Request, Response } from 'express';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { applyUUIDValidation } from '../middleware/validateUUID.js';

export const projectRoutes = Router();
projectRoutes.use(authenticate);
applyUUIDValidation(projectRoutes);

// ---- GET /api/projects ----
projectRoutes.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      `SELECT p.*, pm.role as member_role,
              (SELECT COUNT(*) FROM boards WHERE project_id = p.id) as board_count,
              (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $1
       WHERE p.is_archived = false
       ORDER BY p.updated_at DESC`,
      [req.user!.userId]
    );

    res.json({ projects: result.rows });
  })
);

// ---- POST /api/projects ----
projectRoutes.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, color, icon } = req.body;

    if (!name || name.trim().length === 0) {
      throw new AppError('Proje adı zorunlu', 400);
    }

    const project = await db.transaction(async (client) => {
      // Proje oluştur
      const result = await client.query(
        `INSERT INTO projects (name, description, owner_id, color, icon)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [name.trim(), description || null, req.user!.userId, color || '#3B82F6', icon || 'folder']
      );

      const project = result.rows[0];

      // Sahibi üye olarak ekle
      await client.query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [project.id, req.user!.userId]
      );

      // İlk tahta oluştur
      await client.query(
        `INSERT INTO boards (project_id, name, created_by)
         VALUES ($1, 'Ana Tahta', $2)`,
        [project.id, req.user!.userId]
      );

      return project;
    });

    res.status(201).json({ project });
  })
);

// ---- GET /api/projects/:id ----
projectRoutes.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      `SELECT p.*, pm.role as member_role
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = $2
       WHERE p.id = $1`,
      [req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Proje bulunamadı', 404);
    }

    // Üyeleri getir
    const members = await db.query(
      `SELECT u.id, u.display_name, u.email, u.avatar_url, pm.role, pm.joined_at
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1`,
      [req.params.id]
    );

    // Tahtaları getir
    const boards = await db.query(
      `SELECT * FROM boards WHERE project_id = $1 ORDER BY created_at`,
      [req.params.id]
    );

    res.json({
      project: result.rows[0],
      members: members.rows,
      boards: boards.rows,
    });
  })
);

// ---- PUT /api/projects/:id ----
projectRoutes.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description, color, icon } = req.body;

    const result = await db.query(
      `UPDATE projects SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         color = COALESCE($4, color),
         icon = COALESCE($5, icon)
       WHERE id = $1 AND owner_id = $6
       RETURNING *`,
      [req.params.id, name, description, color, icon, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Proje bulunamadı veya yetkiniz yok', 404);
    }

    res.json({ project: result.rows[0] });
  })
);

// ---- DELETE /api/projects/:id ----
projectRoutes.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await db.query(
      'UPDATE projects SET is_archived = true WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user!.userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Proje bulunamadı veya yetkiniz yok', 404);
    }

    res.json({ message: 'Proje arşivlendi' });
  })
);

// ---- POST /api/projects/:id/members ----
projectRoutes.post(
  '/:id/members',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, role } = req.body;

    const user = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (user.rows.length === 0) {
      throw new AppError('Kullanıcı bulunamadı', 404);
    }

    await db.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO UPDATE SET role = $3`,
      [req.params.id, user.rows[0].id, role || 'editor']
    );

    res.json({ message: 'Üye eklendi' });
  })
);
