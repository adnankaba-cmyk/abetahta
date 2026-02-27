# abeTahta - Changelog
---
## [2026-02-27] Ajan Sistemi Optimizasyonu (99aae21)
- FEAT: settings.json — git commit/push/pull/checkout/merge/stash izinleri eklendi
- FEAT: settings.json — npx vitest/tsx/prettier, curl/psql/redis-cli/pg_isready eklendi
- SEC:  settings.json — git push --force ve git reset --hard engellendi
- FIX:  hooks.json — tsc check absolute path ile duzeltildi (root'ta tsconfig yoktu, hic calismiyordu)
- FEAT: hooks.json — sessionStart hook eklendi (PROJE_DURUMU.md otomatik okunuyor)
- FIX:  proje-takipci.md — permissionMode:plan kaldirildi, Write/Edit izni eklendi
- UPDATE: 11 ajan dosyasi guncellendi: description, absolute path, vitest, gercekci icerik
- FEAT: onarci ailesi 5 uzman ajan tanimlandi ve absolute path ile guncellendi

## [2026-02-27] database-schema.sql 10 → 16 Tablo (0cd21a4)
- DOCS: database-schema.sql tamamen yeniden yazildi (v2.0)
- FEAT: 6 eksik tablo eklendi: settings, board_snapshots, ai_conversations, active_sessions, dsl_scripts, shape_timeline
- FIX: notifications tablosu tamamlandi
- FIX: Tum CREATE TABLE IF NOT EXISTS ile idempotent hale getirildi
- FIX: Trigger'lar DO...EXCEPTION WHEN duplicate_object ile guvenliklestirildi
- FEAT: 11 varsayilan settings seed kaydi eklendi
- SYNC: docs/database-schema.sql ile senkronize edildi (Docker init)

## [2026-02-27] ESLint Config Kurulumu — Web + Server (041403a)
- FIX (web): board/[id]/page.tsx — apostrophe escape (react/no-unescaped-entities)
- FIX (web): AIPanel.tsx — 2 apostrophe escape
- FIX (web): ai-canvas-bridge.ts — prefer-const (let → const/let ayristirma)
- FEAT (server): eslint, @eslint/js, typescript-eslint devDependencies eklendi
- FEAT (server): eslint.config.mjs olusturuldu (typescript-eslint flat config)
- FEAT (server): package.json'a lint scripti eklendi
- FIX (server): auth.ts — declare global → declare module 'express-serve-static-core'
- FIX (server): ws/server.ts — @ts-ignore → @ts-expect-error
- FIX (server): ws/server.ts — useless-assignment duzeltildi (null → uninitialized)
- Sonuc: web 0 hata, server 0 hata (1 kabuledilebilir uyari)

## [2026-02-26] Smart Placement — İkinci Sorgu Akıllı Yerleştirme
- BUG: İkinci AI sorgusunda yeni şekiller eski şekillerin üstüne biniyordu
- FIX: `computeSmartAnchor()` — buildSpatialMap + findBestPlacement kullanıyor
  - Gerçek tahta gibi: sağda, solda, altta — nerede boşluk varsa oraya koyar
  - Sadece alta atmak yerine en büyük boş bölgeyi buluyor
  - İlk sorgu: tahta boş → undefined (varsayılan konum)
  - İkinci sorgu: spatial analiz → en uygun boş bölge
- processAIResponse artık DSL ve Mermaid için smartAnchor kullanıyor
- Doğrulama: tsc --noEmit temiz

---
## [2026-02-26] Test Muhendisi — DSL v2 Birim Testleri Eklendi

### Test Sonuclari
- server: 3 dosya, 21 test — GECTI
- web: 3 dosya, 87 test — GECTI (yeni: 60 DSL v2 testi)
- tsc --noEmit (server): TEMIZ
- tsc --noEmit (web): TEMIZ
- npm run build (web): BASARILI

### Yeni Test Dosyasi
- packages/web/tests/dsl-v2.test.ts (60 test)
  - isDslV2: 12 test (komut tespiti, harf duyarsizligi)
  - parseDslV2 - SEKIL: 5 test (koordinat, props, hata)
  - parseDslV2 - NOT/YAZI/CIZGI/BAG/GRUPLA: 9 test
  - parseDslV2 - ALTINA/YANINA/USTUNE: 4 test
  - parseDslV2 - Coklu satir/yorum: 5 test
  - ShapeRegistry: 8 test (kayit, sorgu, getLast, getByNames)
  - resolveRelativePosition: 4 test (below/right/above/null)
  - layoutRow/layoutColumn/layoutGrid: 11 test
  - parseDslV2 - CERCEVE/RESIM: 3 test

### Not
- layoutRow dikey ortalama yapiyor (maxH - s.h) / 2 — testler buna gore yazildi
- executor.ts ve ai.ts: browser/Editor gerektirdigi icin test kapsami disinda
---
## [2026-02-26] DSL v2 Bug Fix — Üst Üste Binme + Model Düzeltmesi
- BUG 1: ALTINA/YANINA referans bulunamayınca 0,0'a düşme → son shape altına fallback (executor.ts)
- BUG 2: NOT/TEXT bounds yanlış → sabit boyut 200x200/300x40 (executor.ts)
- BUG 3: LAYOUT children anchor yok → anchorPoint geçirildi (executor.ts)
- BUG 4: fixOverlappingShapes() eklendi (ai-canvas-bridge.ts)
- Model: haiku → claude-sonnet-4-6 geri alındı (ai.ts)
- DRAW_COMPLEX'ten mermaid prompt çıkarıldı (ai.ts)
- Doğrulama: tsc --noEmit temiz, build başarılı

## [2026-02-26] DSL v1 English Aliases + Color Validation
- tahta-dsl.ts: CMD_ALIASES + normalizeLine() (RECTANGLE→KUTU vb.)
- executor.ts: safeColor() — geçersiz renkler crash yerine fallback
- ai.ts: YASAK kuralları + geçerli renk listesi

---
## [2026-02-26] Ajan Sistemi v2.0 Kuruldu
Kurulan: 10 ajan, 5 log, settings, MCP, hooks, 6 command
---

---
## [2026-02-26] Kod İncelemesi — DSL v2 + AI Bridge Güncellemeleri

### İncelenen Dosyalar
- packages/server/src/routes/ai.ts (+241/-81 satır)
- packages/web/lib/dsl-v2/executor.ts (yeni dosya, 520 satır)
- packages/web/lib/dsl-v2/resolver.ts (yeni dosya, 85 satır)
- packages/web/lib/ai-canvas-bridge.ts (+158/-7 satır)

### Otomatik Kontroller
- TypeScript (packages/web): 0 hata (arsiv+auth dosyalari haric — onceden mevcut)
- TypeScript (packages/server): 0 hata
- Build: BASARISIZ — .next/types/app/(auth)/login/page.ts bulunamadi (onceden mevcut sorun)
- Lint: ESLint config yok, next lint interaktif kurulum istiyor (onceden mevcut sorun)

### Bulgular
- UYARI: executor.ts'te getLast() fallback 5 case'de tekrarlaniyor (DRY ihlali)
- UYARI: fixOverlappingShapes'te type assertion (dslResult as {...}) gereksiz (interface genisletilmeli)
- ONAY: as any kullanimlari tldraw API zorunlulugu — kacinilamaz
- ONAY: isHaiku logic tamamen kaldirildi — temiz
- ONAY: DRAW_COMPLEX artik mermaid icermiyor — dogru
- ONAY: getLast() implementasyonu dogru ve guvenli
- ONAY: fixOverlappingShapes while(attempts<10) ile sonsuz dongu korunmus
- ONAY: Sessiz catch'ler kritik olmayan islemler (binding, zoom, overlap) — kabul edilebilir

### Karar
ONAYLANDI — 7.5/10

---
## [2026-02-27] Tahta Temizleme Bug Fix — Canvas Focus Bagimliligi Kaldirildi
- BUG: Temizle butonu `setCurrentTool('eraser')` cagiriyordu — sekil silmiyordu
- BUG: Delete tusu canvas focus olmadanda calismiyordu — UX sorunu
- FIX: `deleteShapes([...getCurrentPageShapeIds()])` ile direkt silme
- FIX: Confirm dialog eklendi — kullanicidan onay isteniyor
- FIX: Canvas focus bagimliligi kaldirildi
- Dosya: `packages/web/components/canvas/TldrawCanvas.tsx`
- Commit: `29a03c3`
- Dogrulama: tsc --noEmit temiz, Playwright browser testi gecti

