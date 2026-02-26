import { WebSocketServer } from 'ws';
import http from 'http';
import url from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { wsLogger } from '../lib/logger.js';
// @ts-ignore - y-websocket utils
import { setupWSConnection } from 'y-websocket/bin/utils';

dotenv.config({ path: '../../.env' });

const PORT = parseInt(process.env.WS_PORT || '4001');
const HOST = process.env.WS_HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET;
const SINGLE_USER_MODE = process.env.SINGLE_USER_MODE === 'true';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'abeTahta WS' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // ── Auth: Tek kullanici modu degilse JWT dogrula ──
  if (!SINGLE_USER_MODE) {
    const parsed = url.parse(req.url || '', true);
    const token = parsed.query.token as string | undefined;

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
      jwt.verify(token, JWT_SECRET);
    } catch {
      wsLogger.warn({ url: req.url }, 'WS baglanti reddedildi: gecersiz token');
      ws.close(4401, 'Unauthorized: invalid token');
      return;
    }
  }

  // ── DocName: URL path'inden al, query param'lari temizle ──
  const parsed = url.parse(req.url || '', true);
  const docName = (parsed.pathname?.slice(1)) || 'default';

  // Basit sanitization: sadece alfanumerik, tire, alt cizgi
  if (!/^[\w-]+$/.test(docName)) {
    wsLogger.warn({ docName }, 'WS reddedildi: gecersiz docName');
    ws.close(4400, 'Bad Request: invalid document name');
    return;
  }

  // Yjs baglantisini kur
  setupWSConnection(ws, req, { docName });

  wsLogger.info({ docName }, 'Yeni baglanti');

  ws.on('close', () => {
    wsLogger.info({ docName }, 'Baglanti kapandi');
  });
});

server.listen(PORT, HOST, () => {
  wsLogger.info({ host: HOST, port: PORT }, 'abeTahta WebSocket Server baslatildi');
});
