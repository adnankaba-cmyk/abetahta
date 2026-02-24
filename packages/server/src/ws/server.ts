import { WebSocketServer } from 'ws';
import http from 'http';
import dotenv from 'dotenv';
import { wsLogger } from '../lib/logger.js';
// @ts-ignore - y-websocket utils
import { setupWSConnection } from 'y-websocket/bin/utils';

dotenv.config({ path: '../../.env' });

const PORT = parseInt(process.env.WS_PORT || '4001');
const HOST = process.env.WS_HOST || '0.0.0.0';

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'abeTahta WS' }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Yjs bağlantısını kur
  // URL formatı: ws://localhost:4001/board-{boardId}
  setupWSConnection(ws, req, {
    // Doküman kalıcılığı için callback
    docName: req.url?.slice(1) || 'default',
  });

  wsLogger.info({ url: req.url }, 'Yeni bağlantı');

  ws.on('close', () => {
    wsLogger.info({ url: req.url }, 'Bağlantı kapandı');
  });
});

server.listen(PORT, HOST, () => {
  wsLogger.info({ host: HOST, port: PORT }, 'abeTahta WebSocket Server başlatıldı');
});
