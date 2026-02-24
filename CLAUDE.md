# abeTahta - Proje Hatirlatici

## Genel Bilgi
- **Ne**: AI destekli beyaz tahta uygulamasi (whiteboard + AI + real-time collaboration)
- **Prensip**: "Kullanici tahtayi gorur, Claude veriyi gorur. Ikisi ayni gercekligi farkli pencerelerden okur/yazar"
- **Stack**: Next.js 15, React 19, tldraw, Yjs, Express 5, Socket.IO, PostgreSQL 16, Redis 7, Zustand

## Monorepo Yapisi
```
D:\AbeTahta\
├── packages/web/          # Next.js frontend (:3000)
│   ├── app/
│   │   ├── layout.tsx           # Root layout + AuthProvider
│   │   ├── page.tsx             # Redirect: token → dashboard, else → login
│   │   ├── dashboard/page.tsx   # Proje listesi, olusturma, bildirim
│   │   ├── board/[id]/page.tsx  # Tahta sayfasi (dynamic import TldrawCanvas)
│   │   └── (auth)/login/page.tsx # Login formu
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── TldrawCanvas.tsx   # 926 satir - Ana canvas + draw.io-stil UI
│   │   │   ├── TemplatePanel.tsx  # 8 sablon (flowchart, kanban, SWOT, mindmap...)
│   │   │   ├── ExportPanel.tsx    # PNG/JSON export + clipboard
│   │   │   └── MiniMap.tsx        # Canvas mini-map + tikla-git navigasyon
│   │   ├── ai/
│   │   │   └── AIPanel.tsx        # AI chat paneli + ornek promptlar
│   │   └── ui/
│   │       └── NotificationBell.tsx # Bildirim ikonu + badge
│   ├── hooks/
│   │   ├── useCollaboration.ts    # Yjs cursor/presence/selection (shape sync YOK!)
│   │   └── useNotifications.ts    # Socket.IO bildirim dinleyici
│   ├── lib/
│   │   ├── api.ts                 # ApiClient (private fields, token, credentials)
│   │   ├── tahta-dsl.ts           # 712 satir - 15+ komut DSL parser
│   │   └── socket.ts              # Socket.IO singleton
│   └── store/
│       └── auth.ts                # Zustand auth store (login, register, logout)
│
├── packages/server/       # Express API (:4000) + WebSocket (:4001)
│   └── src/
│       ├── index.ts               # Express + Socket.IO + CORS + helmet + routes
│       ├── routes/
│       │   ├── auth.ts            # register, login, refresh, me (Zod validation, bcrypt, JWT)
│       │   ├── boards.ts          # CRUD + uyelik kontrol + tldraw_data kayit
│       │   ├── projects.ts        # CRUD + transaction + uye yonetimi + otomatik ilk tahta
│       │   ├── elements.ts        # CRUD 25+ alan + history tracking + batch create
│       │   ├── connections.ts     # CRUD + duplicate kontrol + element dogrulama
│       │   ├── claude.ts          # 7 endpoint (board data, summary, flow, CRUD, analiz, yorum)
│       │   ├── ai.ts              # Anthropic SDK + tahta baglami + DSL system prompt
│       │   └── notifications.ts   # CRUD + okunmamis sayisi + toplu okundu
│       ├── middleware/
│       │   ├── auth.ts            # JWT + cookie/header token + Claude API key auth
│       │   └── errorHandler.ts    # AppError + asyncHandler
│       ├── models/
│       │   ├── db.ts              # PostgreSQL Pool + transaction helper
│       │   └── redis.ts           # ioredis + cache helpers + board invalidation (SCAN)
│       ├── lib/
│       │   ├── logger.ts          # pino + child loggers (db, redis, ws, http, socket)
│       │   └── notify.ts          # createNotification + Socket.IO push
│       └── ws/
│           └── server.ts          # y-websocket server (:4001)
│
├── database-schema.sql    # 10 tablo: users, projects, project_members, boards,
│                          #   elements (25+ kolon), connections, comments (is_ai, threading),
│                          #   history (before/after JSONB), templates, notifications
│                          # 13 index (GIN on elements.content), auto updated_at triggers
├── docker-compose.yml     # PostgreSQL 16 + Redis 7 (volumes + healthchecks)
└── package.json           # Monorepo workspaces, concurrently dev
```

## Mevcut Ozellikler (TAMAMLANAN)

### Backend (Neredeyse Tam)
- [x] Auth: JWT + Cookie + Refresh Token + Zod validation
- [x] Proje: CRUD + uyelik + rol yonetimi + transaction
- [x] Tahta: CRUD + tldraw_data JSONB kayit + uyelik kontrol
- [x] Element: 25+ alan, history tracking, batch create, Redis invalidation
- [x] Baglanti: CRUD + duplicate kontrol + element dogrulama
- [x] Claude API: 7 endpoint (board, summary, flow, element CRUD, analiz, yorum)
- [x] AI Chat: Anthropic SDK, tahta baglami, DSL system prompt
- [x] Bildirim: DB + Socket.IO gercek zamanli push
- [x] Cache: Redis get/set/del + board invalidation (SCAN)
- [x] Log: pino + 5 child logger
- [x] WebSocket: y-websocket server (:4001)

### Frontend (Cogu Tam)
- [x] Canvas: draw.io-stil menu, toolbar, sol/sag panel (926 satir)
- [x] DSL: 15+ komut, Turkce+Ingilizce alias, 7 ornek (712 satir)
- [x] Sablonlar: 8 sablon (flowchart, kanban, SWOT, mindmap, timeline...)
- [x] Export: PNG (normal/HD) + JSON + clipboard
- [x] MiniMap: Canvas-based, tikla-git navigasyon
- [x] AI Chat: Mesajlasma + ornek promptlar + hata yonetimi
- [x] Bildirim: Bell icon + badge + panel
- [x] Auth: Login sayfasi + Zustand store
- [x] Dashboard: Proje listesi + olusturma

## KRITIK EKSIKLER (Yapilacaklar)

### Faz 1 - Temel (Oncelik: Yuksek)
- [ ] **Shape Sync YOK** - useCollaboration sadece cursor/presence. Shapes senkronize OLMUYOR
- [ ] **AI → Canvas kopuk** - AI yanit veriyor ama canvas'a sekil cizemiyor. DSL parser var ama AI ile bagli degil
- [x] **Register sayfasi** - packages/web/app/(auth)/register/page.tsx MEVCUT

### Faz 2 - UX (Oncelik: Orta)
- [ ] **Yorum UI YOK** - Backend comments CRUD var, frontend panel yok
- [ ] **Uye yonetimi UI YOK** - Backend endpoint var, frontend yok
- [ ] **History UI YOK** - Backend history tablosu var, frontend goruntuleme yok
- [ ] **Kisayollar eksik** - ShortcutsModal var ama cogu kisayol bagli degil

### Faz 3 - Ileri (Oncelik: Dusuk)
- [ ] AI Agent canvas entegrasyonu (dogrudan sekil cizdirme)
- [ ] Custom tldraw shapes (KanbanShape, TimelineShape...)
- [ ] Offline-first + PWA
- [ ] Import destegi (Mermaid, draw.io XML, Excalidraw JSON)

## MUTLAK KURALLAR

### KURAL 1: KANITLANMADAN "BITTI" DEME
- Dosya degistirdiysen → son halini oku ve degisikligi GOSTER
- Komut calistirdiysan → ciktiyi goster, hata var mi kontrol et

### KURAL 2: HER DEGISIKLIK TEST EDILMELI
- Kod degistirdiysen → build kontrol et
- Build kirildiysa → duzelt

### KURAL 3: BASARISIZLIK KABUL EDILEBILIR — GIZLEMEK EDILEMEZ
- Calismiyorsa acikca soyle
- Alternatif oner

## Build/Test Komutlari
```bash
npm run dev                          # Tum servisler (web:3000, api:4000, ws:4001)
cd packages/web && npm run build     # Frontend build
cd packages/server && npm run build  # Backend build
npx tsc --noEmit                     # TypeScript tip kontrolu
```

## Portlar
| Servis | Port |
|--------|------|
| Next.js Web | 3000 |
| Express API | 4000 |
| y-websocket | 4001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## Anahtar Teknik Bilgiler
- tldraw UI tamamen gizli, custom draw.io-stil UI kullaniliyor
- tldraw_data JSONB olarak boards tablosuna kaydediliyor (auto-save 2s debounce)
- DSL parser KUTU/DAIRE/OK/NOT/GRAFIK/GRID/TIMELINE/KANBAN komutlarini destekliyor
- Yjs Y.Doc + awareness bagli ama sadece cursor icin — getShapesMap() tanimli ama KULLANILMIYOR
- Claude API authenticateClaude middleware ile x-claude-api-key header kullanir
- Element history: before_state/after_state JSONB olarak kaydediliyor
