# abeTahta — PROJE DURUMU

> **Son Guncelleme:** 2026-02-27 (shape sync onaylandi, logout bug duzeltildi)
> **Guncelleme Protokolu:** Bu dosya her oturum basinda okunur. Her onemli degisiklikten sonra guncellenir.

---

## 1. PROJE AMACI

**abeTahta** = AI destekli beyaz tahta uygulamasi (whiteboard + AI + real-time collaboration)

> "Kullanici tahtayi gorur, Claude veriyi gorur. Ikisi ayni gercekligi farkli pencerelerden okur/yazar."

**3 Temel Vaat:**
1. **Beyaz tahta** — Kullanicilar cizim yapabilir (draw.io benzeri)
2. **AI destekli** — AI, tahta uzerinde aktif islem yapabilir (sekil cizdirme, duzenleme)
3. **Gercek zamanli isbirligi** — Birden fazla kullanici ayni anda calisabilir

**Stack:** Next.js 15, React 19, tldraw 4.4, Yjs 13.6, Express 5, Socket.IO 4.8, PostgreSQL 16, Redis 7, Zustand 5

---

## 2. NE YAPILDI (Calisan Ozellikler)

| # | Ozellik | Durum | Not |
|---|---------|-------|-----|
| 1 | Auth (JWT + Cookie + Refresh + Zod) | CALISIYOR | 8 test, bcrypt 12-round |
| 2 | Backend CRUD API (51 endpoint, 10 route) | CALISIYOR | Parameterized SQL, transaction |
| 3 | PostgreSQL + Redis altyapisi | CALISIYOR | Pool, cache, healthcheck |
| 4 | Canvas (draw.io-stil UI, tldraw) | CALISIYOR | Cizim, tasima, boyutlandirma |
| 5 | Sablonlar (8 adet: flowchart, kanban, SWOT...) | CALISIYOR | Tek tikla uygulama |
| 6 | Export (PNG normal/HD, JSON, clipboard) | CALISIYOR | |
| 7 | MiniMap navigasyon | CALISIYOR | Tikla-git |
| 8 | AI sohbet (Anthropic SDK, chat paneli) | CALISIYOR | API key gerekli |
| 9 | Mermaid → canvas (SVG image olarak) | CALISIYOR | Ama duzenlenemez (resim) |
| 19 | **DSL v2 (Board Language v2)** | CALISIYOR | 20+ geo tip, isimli referans, goreceli konum, layout, ok binding |
| 20 | **Mekansal farkindalik** | CALISIYOR | Bos/dolu bolge analizi, yogunluk grid, AI'a konum bilgisi |
| 21 | **AI → Canvas DSL pipeline** | CALISIYOR | Intent router → backend prompt → DSL v2 parser → executor → tldraw |
| 10 | Bildirim (DB + Socket.IO push) | CALISIYOR | Bell icon, badge, panel |
| 11 | Cursor/presence sync (Yjs awareness) | CALISIYOR | Diger kullanicinin cursor'u gorunur |
| 12 | Admin paneli (6 tab) | CALISIYOR | AI, FastMode, Board, UI, Users, System |
| 13 | Dashboard (proje listesi + olusturma) | CALISIYOR | |
| 14 | Login + Register | CALISIYOR | Tek kullanici modu destegi |
| 15 | Auto-save (tldraw_data JSONB, 2s debounce) | CALISIYOR | |
| 22 | **FAZ0: Board erisim kontrolu** | CALISIYOR | requireBoardAccess middleware — comments, ai, claude, websocket |
| 23 | **FAZ0: Rate limiting** | CALISIYOR | Global 200/dk + AI chat 20/dk |
| 24 | **FAZ0: Graceful shutdown** | CALISIYOR | SIGTERM/SIGINT → HTTP, Socket.IO, DB, Redis temiz kapanis |
| 25 | **FAZ0: WebSocket board auth** | CALISIYOR | y-websocket'te UUID board erisim kontrolu |
| 26 | **FAZ0: Claude route board-scoped** | CALISIYOR | ensureBoardExists + element varlik kontrolu |
| 16 | Custom shapes (Kanban, Timeline, SWOT) | KOD VAR | Canli test edilmemis |
| 17 | Import (draw.io, Excalidraw, Mermaid) | KOD VAR | Canli test edilmemis |
| 18 | Offline-first (IndexedDB + SW) | KOD VAR | Tam entegrasyon belirsiz |

---

## 3. NE YAPILMADI (Eksik / Kopuk Ozellikler)

### KRITIK KOPUKLUKLAR (Projenin deger onerisi bunlarda kirilmis)

| # | Sorun | Detay | Dosya |
|---|-------|-------|-------|
| 1 | ~~DSL pipeline KOPUK~~ **COZULDU** | DSL v2 pipeline calisiyor. v1 basit komutlar icin AI bazen DSL yerine JS/Python donduruyor (prompt sorunu) | dsl-v2/, ai-canvas-bridge.ts, ai.ts |
| 2 | **Mermaid = resim** | Diyagram tek SVG image → kutu/ok AYRI AYRI duzenlenemez | ai-canvas-bridge.ts |
| 3 | ~~Shape sync BELIRSIZ~~ **COZULDU** | 2 sekme testi yapildi — sekiller gercek zamanli sync oluyor, presence (2 kisi) gorunuyor | useCollaboration.ts, useTldrawYjsSync.ts |
| 4 | **AI agent TEST YOK** | ai-agent.ts (455 satir): MOVE, RESIZE, DELETE kodu var ama hic test edilmemis | ai-agent.ts |
| 5 | ~~Rate limiting YOK~~ **COZULDU** | Global rate limit aktif (200 req/dk), AI chat icin ozel limiter (20 req/dk) | index.ts, ai.ts |

### EKSIK OZELLIKLER

| # | Ozellik | Neden Eksik |
|---|---------|-------------|
| 6 | Error boundaries (error.tsx, not-found.tsx, loading.tsx) | Dosyalar olusturulmamis |
| 7 | ESLint config | eslint.config.js eksik — linting calismiyor |
| 8 | CI/CD pipeline | GitHub Actions yok |
| 9 | Production Dockerfile | docker/ dizini bos |
| 10 | i18n (coklu dil) | Hardcoded Turkce |
| 11 | a11y (erisebilirlik) | ARIA labels, keyboard nav eksik |
| 12 | E2E testler | Playwright/Cypress yok |
| 13 | API dokumantasyonu | Swagger/OpenAPI yok |
| 14 | Backup stratejisi | pg_dump otomasyonu yok |
| 15 | database-schema.sql GUNCEL DEGIL | 10 tablo var, gercek DB 16 tablo |

---

## 4. PUANLAR

| Kategori | Puan | Degisim |
|----------|------|---------|
| Backend | 9.5/10 | |
| Guvenlik (FAZ0 sonrasi) | 6/10 | 2→6 (board auth, rate limit, graceful shutdown) |
| Canvas (temel cizim) | 8/10 | |
| Kod kalitesi (TypeScript strict) | 7/10 | |
| AI entegrasyonu | 6/10 | |
| Gercek zamanli isbirligi | 4/10 | |
| Test coverage (%5.9) | 2/10 | |
| DevOps | 2/10 | |
| Gercek zamanli isbirligi | 8/10 | 4→8 (shape sync onaylandi, presence calisiyor) |
| **GENEL (kullanici deneyimi)** | **7/10** | 6→7 |

---

## 5. KLASOR YAPISI

```
D:\AbeTahta\
├── CLAUDE.md                          # Proje talimatlari
├── PROJE_DURUMU.md                    # BU DOSYA — her oturum basinda oku
├── README.md                          # Proje tanitimi + hizli baslangic
├── package.json                       # Monorepo root (workspaces)
├── docker-compose.yml                 # PostgreSQL 16 + Redis 7
├── database-schema.sql                # Ana DB semasi (GUNCEL DEGIL — 10/16 tablo)
├── gereksiz/                          # Arsivlenmis eski dokumanlar
│
├── .claude/
│   ├── agents/                        # 8 ajan tanimi + Genel_durum.md
│   └── logs/                          # Ajan calisma kayitlari
│
├── packages/server/                   # BACKEND — Express 5 (:4000) + WS (:4001)
│   └── src/
│       ├── index.ts                   # [215] Ana giris + middleware + Socket.IO + graceful shutdown
│       ├── routes/                    # [10 dosya, 51+ endpoint]
│       │   ├── auth.ts               # [287] 9 endpoint — register, login, refresh, users
│       │   ├── projects.ts           # [174] 6 endpoint — CRUD + uyelik
│       │   ├── boards.ts             # [184] 5 endpoint — CRUD + tldraw_data
│       │   ├── elements.ts           # [220] 5 endpoint — CRUD + batch + history
│       │   ├── connections.ts        # [198] 4 endpoint — CRUD + duplicate
│       │   ├── claude.ts             # [292] 7 endpoint — Claude API
│       │   ├── ai.ts                 # [181] 1 endpoint — AI chat + DSL prompt
│       │   ├── comments.ts           # [112] 4 endpoint — CRUD + threading
│       │   ├── notifications.ts      # [93]  5 endpoint — CRUD + okunmamis
│       │   └── settings.ts           # [121] 4 endpoint — CRUD
│       ├── middleware/                # auth.ts, errorHandler.ts, validateUUID.ts
│       ├── models/                    # db.ts (PostgreSQL), redis.ts
│       ├── lib/                       # logger.ts (pino), notify.ts
│       └── ws/server.ts               # y-websocket (:4001)
│
├── packages/web/                      # FRONTEND — Next.js 15 (:3000)
│   ├── app/                           # 8 sayfa (App Router)
│   │   ├── layout.tsx                 # Root layout + AuthProvider
│   │   ├── page.tsx                   # Auth redirect
│   │   ├── dashboard/page.tsx         # Proje listesi
│   │   ├── board/[id]/page.tsx        # Canvas sayfasi
│   │   ├── project/[id]/page.tsx      # Proje detay + uyeler
│   │   ├── admin/page.tsx             # [755] Admin paneli (6 tab)
│   │   └── (auth)/                    # login + register
│   │
│   ├── components/                    # 23 component
│   │   ├── canvas/
│   │   │   ├── TldrawCanvas.tsx       # [1,236] ANA CANVAS — MONOLITH (refactor gerekli)
│   │   │   ├── TemplatePanel.tsx      # [382] 8 sablon
│   │   │   ├── HistoryPanel.tsx       # [285] Gecmis goruntuleme
│   │   │   ├── CommentPanel.tsx       # [275] Yorum paneli
│   │   │   ├── ExportPanel.tsx        # [268] Export
│   │   │   ├── BottomToolbar.tsx      # [239] Araç cubugu
│   │   │   ├── MiniMap.tsx            # [202] Navigasyon
│   │   │   ├── ShortcutsPanel.tsx     # [125] Kisayollar
│   │   │   └── shapes/               # KanbanShape, TimelineShape, SwotShape
│   │   ├── ai/AIPanel.tsx             # AI chat paneli
│   │   ├── collaboration/             # RemoteCursors, PresenceAvatars
│   │   ├── panels/                    # LeftPanel, RightPanel
│   │   ├── providers/                 # AuthProvider, PWARegister
│   │   └── ui/                        # Button, NotificationBell, Toast
│   │
│   ├── hooks/                         # 5 hook
│   │   ├── useCollaboration.ts        # [147] Yjs cursor/presence (shape sync DEGIL)
│   │   ├── useTldrawYjsSync.ts        # [144] tldraw↔Yjs shape sync (AKTIF MI BELIRSIZ)
│   │   ├── useRequireAuth.ts          # [51]  Auth guard
│   │   ├── useNotifications.ts        # [54]  Socket.IO bildirim
│   │   └── useServiceWorker.ts        # [15]  PWA
│   │
│   ├── lib/                           # 12 utility
│   │   ├── ai-agent.ts                # [455] AI agent: serialize, actions, execute + spatial strateji
│   │   ├── ai-canvas-bridge.ts        # [250] DSL v1/v2 router + Mermaid → SVG → canvas
│   │   ├── board-spatial.ts           # [270] Mekansal farkindalik: bos/dolu bolge analizi
│   │   ├── tahta-dsl.ts               # [712] DSL v1 parser (basit komutlar)
│   │   ├── dsl-v2/                    # DSL v2 altyapisi (Board Language v2)
│   │   │   ├── index.ts              # Public API: executeDslV2, isDslV2
│   │   │   ├── types.ts              # AST node tipleri
│   │   │   ├── parser.ts             # Satir → AST parser
│   │   │   ├── resolver.ts           # Isimli referans + goreceli konum
│   │   │   ├── executor.ts           # AST → tldraw shape olusturucu
│   │   │   ├── layout-engine.ts      # SATIR/SUTUN/GRID/AKIS layout
│   │   │   └── smart-position.ts     # Akilli yerlestirme + cakisma onleme
│   │   ├── mermaid-renderer.ts        # [142] Mermaid SVG render
│   │   ├── offline-sync.ts            # [158] IndexedDB + pending queue
│   │   ├── api.ts                     # [77]  ApiClient
│   │   ├── socket.ts                  # [34]  Socket.IO singleton
│   │   ├── logger.ts                  # [30]  pino loggers
│   │   └── importers/                 # drawio.ts, excalidraw.ts, mermaid.ts
│   │
│   └── store/                         # Zustand: auth, notifications, board, toast
│
└── migrations/                        # 4 SQL migration dosyasi (001-004)
```

---

## 6. KULLANILAN SISTEMLER

### Altyapi

| Sistem | Versiyon | Amac |
|--------|----------|------|
| Node.js | >=22.0.0 | Runtime |
| TypeScript | 5.7.0 | Tip guvenligi (strict mode) |
| Docker Compose | - | PostgreSQL + Redis konteyner yonetimi |

### Backend

| Sistem | Versiyon | Amac |
|--------|----------|------|
| Express | 5.0.0 | Web framework |
| PostgreSQL | 16.12 | Ana veritabani (19 tablo, JSONB) |
| Redis | 7.4.7 | Cache (TTL 300s, board 30s) |
| Anthropic SDK | 0.78.0 | Claude AI API |
| Yjs + y-websocket | 13.6 / 2.0 | CRDT real-time sync |
| Socket.IO | 4.8.0 | Bildirim + event push |
| JWT + bcryptjs | 9.0 / 2.4 | Auth + sifreleme |
| Zod | 3.23.0 | Input validation (SADECE auth'ta) |
| pino | 10.3.1 | Structured logging |

### Frontend

| Sistem | Versiyon | Amac |
|--------|----------|------|
| Next.js | 15.1.0 | React framework (App Router) |
| React | 19.0.0 | UI |
| tldraw | 4.4.0 | Canvas engine (gizli UI, custom draw.io-stil) |
| Zustand | 5.0.0 | State management (4 store) |
| Tailwind CSS | 4.0.0 | Stil (PostCSS) |
| Mermaid.js | 11.12.3 | Diyagram render |
| Lucide React | 0.460.0 | Ikonlar |

### Test / Kalite

| Sistem | Durum |
|--------|-------|
| Vitest | 48 test (27 web + 21 server) — %5.9 coverage |
| ESLint | BOZUK (config eksik) |
| Prettier | YOK |
| Husky | YOK |
| E2E | YOK |
| CI/CD | YOK |

### Portlar

| Servis | Port |
|--------|------|
| Next.js Web | 3000 |
| Express API | 4000 |
| y-websocket | 4001 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## 7. FAZA GORE ILERLEME

```
Faz 1 — Temel Altyapi:    [###################-] %90
Faz 2 — AI/Canvas + UX:   [#############-------] %65
Faz 3 — Ileri Ozellikler: [--------------------] %0
```

### Acil Yapilacaklar
1. ~~DSL pipeline'i bagla~~ TAMAMLANDI (DSL v2 pipeline)
2. Shape sync dogrula (2 tarayici testi)
3. ~~Rate limiting uygula~~ TAMAMLANDI (global + AI chat limiter)
4. ESLint config olustur
5. database-schema.sql guncelle
6. v1 DSL prompt iyilestir (AI bazen DSL yerine JS/Python donduruyor)
7. Service/repository layer ekle (route'larda SQL direkt yaziliyor)
8. TldrawCanvas.tsx refactor (1236 satirlik monolith)

---

## 8. GUNCELLEME PROTOKOLU

### Bu Dosya Ne Zaman Guncellenir?

| Tetikleyici | Kim Gunceller |
|-------------|---------------|
| Yeni ozellik eklendikten sonra | Gelistirici (Claude) — ilgili bolumu guncelle |
| Bug fix sonrasi (kritik ise) | Gelistirici — "yapildi/yapilmadi" tablosunu guncelle |
| Yeni dosya/klasor eklendikten sonra | Gelistirici — klasor yapisi agacini guncelle |
| Her oturum BASINDA | Oku (degisiklik varsa guncelle) |
| Her oturum SONUNDA | Oturumda ne yapildiysa yansit |
| `proje-takipci` ajani calistirildiginda | Ajan — tam yeniden analiz + guncelleme |

### Guncelleme Kurallari
1. **"Son Guncelleme" tarihini degistir** (dosyanin basindaki tarih)
2. **Sadece degisen bolumu guncelle** — tum dosyayi yeniden yazma
3. **"Yapildi" tablosuna yeni satir ekle** — ozellik tamamlandiginda
4. **"Yapilmadi" tablosundan satir cikar** — sorun cozuldugunde
5. **Puanlari yeniden hesapla** — buyuk degisikliklerden sonra

### Komut
```
# Manuel guncelleme icin:
proje-takipci ajani calistir → bu dosyayi yeniden olusturur
```

---

> **Detayli bilgi icin:**
> - `.claude/agents/Genel_durum.md` — Elestirel degerlendirme, endpoint listesi, DB detaylari
> - `CLAUDE.md` — Proje kurallari, teknik bilgiler, mutlak kurallar
> - `gereksiz/` — Arsivlenmis eski dokumanlar (MIMARI_INCELEME, CODE_REVIEW_RAPORU, PLAN, KLASOR_YAPISI, 01-MIMARI-TASARIM)
