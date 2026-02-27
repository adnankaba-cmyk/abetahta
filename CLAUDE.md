# abeTahta - CLAUDE.md

## PROJE
abeTahta - Gercek zamanli gorsel isbirligi platformu.
Kullanici tahtayi gorur, Claude veriyi gorur - ikisi ayni gercekligi farkli pencerelerden okur ve yazar.

Stack: Next.js 15, React 19, tldraw, Yjs, Express 5, Socket.IO, PostgreSQL 16, Redis 7, Zustand, Tailwind 4
Portlar: 3000 (web), 4000 (API), 4001 (WebSocket)
Monorepo: npm workspaces - packages/web + packages/server
Admin: adnan.kaba@abeerp.com / admin123

## DEMIR KURALLAR

### 1. KANITLA
Yaptim demek yasak. Her degisiklik sonrasi:
1. Dosyayi oku
2. npx tsc --noEmit
3. npm run build
4. Test calistir
5. .claude/logs/changelog.md ye yaz

### 2. ONCE OKU
Hicbir dosyayi degistirmeden ONCE oku. errors.md oku.

### 3. KARAR SORMA
DB sema, yeni bagimlilik, mimari degisim icin onay al.

### 4. LOG TUT
.claude/logs/ altinda 5 dosya: changelog, sessions, errors, decisions, verifications

### 5. AYNI HATAYI TEKRARLAMA

## KOD STANDARTLARI
- Tum kod Ingilizce
- TypeScript strict, any yasak
- Server Components varsayilan
- Parameterized SQL, cursor-based pagination
- Commit: feat:, fix:, refactor:, docs:

## VERITABANI (16 Tablo)
users, projects, project_members, boards, elements (JSONB content), connections, comments, history, templates, notifications, settings, sessions, board_snapshots, element_versions, tags, element_tags

## GUVENLIK (FAZ0 — 2026-02-26)
- requireBoardAccess middleware: comments, ai, claude, websocket route'larinda aktif
- Rate limiting: global 200/dk, AI chat 20/dk
- Graceful shutdown: SIGTERM/SIGINT → HTTP, Socket.IO, DB, Redis temiz kapanis
- WebSocket board auth: y-websocket UUID erisim kontrolu

## FAZLAR
Faz 0: Guvenlik yamalari (TAMAMLANDI)
Faz 1: Docker, Auth, CRUD, Canvas (%90)
Faz 2: AI/Canvas + UX (%65)
Faz 3-6: Ileri ozellikler, Polish (%0)