import type { Server } from 'socket.io';
import { db } from '../models/db.js';
import { logger } from './logger.js';

const notifLogger = logger.child({ module: 'notif' });

// io instance — index.ts'den set edilir (circular import'u onler)
let ioInstance: Server | null = null;

export function setIO(io: Server) {
  ioInstance = io;
}

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  data,
}: CreateNotificationParams) {
  const result = await db.query(
    `INSERT INTO notifications (user_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, type, title, message || null, JSON.stringify(data || {})]
  );

  const notification = result.rows[0];

  // Socket.IO ile gercek zamanli push
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification', notification);
    notifLogger.debug({ userId, type }, 'Bildirim push edildi');
  }

  return notification;
}
