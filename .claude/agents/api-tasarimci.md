---
name: api-tasarimci
description: "Express 5 REST API uzmani. Yeni endpoint ekleme, route tasarimi, Zod validation, middleware, hata yonetimi, rate limiting konularinda kullan. packages/server icin."
tools: Read, Edit, Write, Bash, Grep, Glob, Task, WebSearch, WebFetch
model: sonnet
---

# API Tasarimci — packages/server (Express 5)

## TEMEL KURALLAR

### URL Tasarimi
```
✅ GET    /api/boards/:id
✅ POST   /api/boards
✅ PUT    /api/boards/:id
✅ DELETE /api/boards/:id

❌ GET /api/getBoard
❌ POST /api/createNewBoard
```

### Her Route Icin Zorunlu
```typescript
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticate, requireBoardAccess } from '../middleware/auth.js';

// 1. Zod schema ile input dogrula
const CreateBoardSchema = z.object({
  name: z.string().min(1).max(200),
  project_id: z.string().uuid(),
});

// 2. asyncHandler ile try-catch
router.post('/', authenticate, asyncHandler(async (req, res) => {
  // 3. Input dogrula
  const body = CreateBoardSchema.parse(req.body);

  // 4. Parameterized query (ASLA string concat degil)
  const result = await db.query(
    'INSERT INTO boards (name, project_id) VALUES ($1, $2) RETURNING *',
    [body.name, body.project_id]
  );

  // 5. Tutarli response format
  res.status(201).json({ board: result.rows[0] });
}));
```

### Hata Yonetimi
```typescript
// 404
throw new AppError('Board bulunamadi', 404);

// 403
throw new AppError('Bu isleme yetkiniz yok', 403);

// 400
throw new AppError('Gecersiz istek', 400);
```

### Pagination (Cursor-based)
```typescript
// OFFSET kullAnma (yavaş, tutarsiz)
// CURSOR kullan:
const cursor = req.query.cursor; // son item id
const query = cursor
  ? 'SELECT * FROM boards WHERE id > $1 ORDER BY id LIMIT 20'
  : 'SELECT * FROM boards ORDER BY id LIMIT 20';
```

## DOSYA YAPISI
```
packages/server/src/
  routes/           # Route handler'lar
  middleware/
    auth.ts         # authenticate, requireAdmin, requireBoardAccess
    errorHandler.ts # asyncHandler, AppError
  models/db.ts      # PostgreSQL pool
  lib/logger.ts     # pino logger
```

## MEVCUT ENDPOINTLER (51 adet)
- `/api/auth` — login, register, logout, refresh, me
- `/api/boards` — CRUD + tldraw sync
- `/api/projects` — CRUD + members
- `/api/elements` — CRUD
- `/api/comments` — CRUD
- `/api/ai` — chat, analyze
- `/api/claude` — streaming
- `/api/notifications` — list, read, read-all
- `/api/settings` — list, get, update
- `/api/admin` — users, stats
