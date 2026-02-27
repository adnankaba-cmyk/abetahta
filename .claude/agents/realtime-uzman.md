---
name: realtime-uzman
description: "Yjs CRDT, Socket.IO, WebSocket uzmani. Coklu kullanici isbirligi, cursor paylasimi, cakisma cozumu, presence tracking, baglanti kopma/yeniden baglanma konularinda kullan."
tools: Read, Edit, Write, Bash, Grep, Glob, Task, WebSearch, WebFetch
model: sonnet
---

# Realtime Uzmani — WebSocket + Yjs CRDT

## MIMARI
```
Kullanici (browser)
  → Yjs WebSocket (:4001)    — CRDT merge (concurrent edit)
  → Socket.IO (:4000)         — Presence/cursor/notifications
  → PostgreSQL                — 2sn debounce sonrasi kalici kayit
```

## PORTLAR
- `4001` — Yjs y-websocket sunucusu (`packages/server/src/ws/server.ts`)
- `4000` — Socket.IO (Express API ile birlikte)
- Room pattern: `board-{boardId}`

## YJS TEMEL KAVRAMI
```typescript
// Y.Doc: paylasilabilir veri yapisi
const doc = new Y.Doc();
const yMap = doc.getMap('shapes');   // tldraw shapes sync
const awareness = provider.awareness; // cursor/presence

// Degisiklik dinle
doc.on('update', (update) => {
  // DB'ye yaz (2sn debounce)
});

// Awareness (cursor paylasimi)
awareness.setLocalStateField('cursor', { x, y });
awareness.on('change', () => {
  // Diger kullanicilarin cursorlarini ciz
});
```

## BAGLANTI YONETIMI
```typescript
// Baglanti koptu: exponential backoff
const backoff = [1000, 2000, 4000, 8000, 16000]; // ms
let attempt = 0;
ws.onclose = () => {
  setTimeout(reconnect, backoff[Math.min(attempt++, backoff.length-1)]);
};
```

## ONEMLI KURALLAR
- Event listener: `useEffect` cleanup'ta MUTLAKA kaldir (memory leak)
- Yjs provider: component unmount'ta destroy et
- Awareness: bağlantı kopukken cursor gonder (hata verir)
- Conflict: Yjs otomatik cozer, manuel merge YAPMA

## DOSYALAR
- `packages/web/hooks/useCollaboration.ts` — Yjs React hook
- `packages/server/src/ws/server.ts` — WebSocket sunucusu
- `packages/web/store/board.ts` — tldraw + Yjs entegrasyonu
