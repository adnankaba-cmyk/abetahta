import { WebSocketServer } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { wsLogger } from '../lib/logger.js';
import { db } from '../models/db.js';
// @ts-expect-error - y-websocket utils has no type declarations
import { setupWSConnection } from 'y-websocket/bin/utils';

dotenv.config({ path: '../../.env' });

const PORT = parseInt(process.env.WS_PORT || '4001');
const HOST = process.env.WS_HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET;
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true';

/** Board ID formatindaki docName'den board erisimini kontrol et */
async function checkBoardAccess(userId: string, boardId: string): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT 1 FROM boards b
       JOIN project_members pm ON pm.project_id = b.project_id AND pm.user_id = $2
       WHERE b.id = $1`,
      [boardId, userId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'abeTahta WS' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws, req) => {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(req.url || '/', 'ws://localhost');
  } catch {
    ws.close(4400, 'Bad Request: invalid URL');
    return;
  }
  let userId: string;

  // ── Auth: Tek kullanici modu degilse JWT dogrula ──
  if (!SINGLE_USER_MODE) {
    const token = parsedUrl.searchParams.get('token') ?? undefined;

    if (!token) {
      wsLogger.warn({ url: req.url }, 'WS baglanti reddedildi: token yok');
      ws.close(4401, 'Unauthorized: token required');
      return;
    }

    if (!JWT_SECRET) {
      wsLogger.error('JWT_SECRET tanimli degil');
      ws.close(4500, 'Server configuration error');
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      wsLogger.warn({ url: req.url }, 'WS baglanti reddedildi: gecersiz token');
      ws.close(4401, 'Unauthorized: invalid token');
      return;
    }
  } else {
    userId = '00000000-0000-0000-0000-000000000001';
  }

  // ── DocName: URL path'inden al, query param'lari temizle ──
  const docName = (parsedUrl.pathname?.slice(1)) || 'default';

  // Basit sanitization: sadece alfanumerik, tire, alt cizgi
  if (!/^[\w-]+$/.test(docName)) {
    wsLogger.warn({ docName }, 'WS reddedildi: gecersiz docName');
    ws.close(4400, 'Bad Request: invalid document name');
    return;
  }

  // ── Board erisim kontrolu: "board-{UUID}" veya saf UUID formatinda board ID çikar ──
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const BOARD_PREFIX_REGEX = /^board-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

  let boardId: string | null = null;
  const prefixMatch = BOARD_PREFIX_REGEX.exec(docName);
  if (prefixMatch) {
    boardId = prefixMatch[1];
  } else if (UUID_REGEX.test(docName)) {
    boardId = docName;
  }

  if (userId && boardId) {
    const hasAccess = await checkBoardAccess(userId, boardId);
    if (!hasAccess) {
      wsLogger.warn({ docName, boardId, userId }, 'WS reddedildi: board erisim yetkisi yok');
      ws.close(4403, 'Forbidden: no board access');
      return;
    }
  }

  // Yjs baglantisini kur
  setupWSConnection(ws, req, { docName });

  wsLogger.info({ docName, userId }, 'Yeni baglanti');

  ws.on('close', () => {
    wsLogger.info({ docName }, 'Baglanti kapandi');
  });
});

server.listen(PORT, HOST, () => {
  wsLogger.info({ host: HOST, port: PORT }, 'abeTahta WebSocket Server baslatildi');
});
