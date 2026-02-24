import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { boardRoutes } from './routes/boards.js';
import { elementRoutes } from './routes/elements.js';
import { connectionRoutes } from './routes/connections.js';
import { claudeRoutes } from './routes/claude.js';
import { aiRoutes } from './routes/ai.js';
import { notificationRoutes } from './routes/notifications.js';
import { commentRoutes } from './routes/comments.js';
import { settingsRoutes } from './routes/settings.js';
import { errorHandler } from './middleware/errorHandler.js';
import { db } from './models/db.js';
import { logger, httpLogger, socketLogger } from './lib/logger.js';
import { setIO } from './lib/notify.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './middleware/auth.js';

dotenv.config({ path: '../../.env' });

const app = express();
const httpServer = createServer(app);

// CORS origins - callback function ile dinamik kontrol
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3002'];
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Origin yoksa (same-origin req) veya izin verilen listede ise izin ver
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'production') {
      httpLogger.warn({ origin }, 'CORS reddedilen origin');
      callback(new Error('CORS: Origin izin listesinde degil'));
    } else {
      httpLogger.warn({ origin }, 'CORS: Bilinmeyen origin (dev modda izin verildi)');
      callback(null, true);
    }
  },
  credentials: true
};

// Socket.IO - Presence & Notifications
const io = new SocketIO(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// ---- Middleware ----
app.use(helmet());
app.use(cors(corsOptions));
app.use(pinoHttp({ logger: httpLogger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---- Health Check ----
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'abeTahta API',
    timestamp: new Date().toISOString(),
  });
});

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/elements', elementRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/claude', claudeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/settings', settingsRoutes);

// ---- Socket.IO Events ----
setIO(io);

io.on('connection', (socket) => {
  socketLogger.info({ socketId: socket.id }, 'Bağlandı');

  // Kullanici kimlik dogrulama — JWT token ile bildirim odasi
  socket.on('authenticate', (token: string) => {
    if (!token) return;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      socket.join(`user:${payload.userId}`);
      socket.data.userId = payload.userId;
      socketLogger.debug({ socketId: socket.id, userId: payload.userId }, 'Kullanıcı odasına katıldı');
    } catch {
      socketLogger.warn({ socketId: socket.id }, 'Socket authenticate: geçersiz token');
    }
  });

  socket.on('join-board', (boardId: string) => {
    socket.join(`board:${boardId}`);
    socket.to(`board:${boardId}`).emit('user-joined', {
      socketId: socket.id,
      timestamp: Date.now(),
    });
  });

  socket.on('leave-board', (boardId: string) => {
    socket.leave(`board:${boardId}`);
    socket.to(`board:${boardId}`).emit('user-left', {
      socketId: socket.id,
    });
  });

  socket.on('cursor-move', (data: { boardId: string; x: number; y: number; userId: string }) => {
    socket.to(`board:${data.boardId}`).emit('cursor-update', {
      userId: data.userId,
      x: data.x,
      y: data.y,
    });
  });

  socket.on('disconnect', () => {
    socketLogger.info({ socketId: socket.id }, 'Ayrıldı');
  });
});

// ---- Error Handler ----
app.use(errorHandler);

// ---- Start Server ----
const PORT = parseInt(process.env.API_PORT || '4000');
const HOST = process.env.API_HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT, env: process.env.NODE_ENV || 'development' }, 'abeTahta API Server başlatıldı');
});

export { app, io };
