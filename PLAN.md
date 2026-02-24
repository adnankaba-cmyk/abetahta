# abeTahta - Gelistirme Plani

> Son guncelleme: 2026-02-23
> Durum: Proje ~%65 tamamlandi. Backend neredeyse tam, frontend entegrasyonlar eksik.

---

## FAZ 1 — TEMEL EKSIKLER (Oncelik: YUKSEK)

### 1.1 Register Sayfasi
- **Durum**: ✅ ZATEN VARDI (packages/web/app/(auth)/register/page.tsx)
- **Zorluk**: Kolay (1-2 saat)
- **Dosyalar**:
  - `packages/web/app/(auth)/register/page.tsx` → YENI
- **Detay**: Backend'de register endpoint hazir, Zustand store'da register() metodu var. Login sayfasi kopyalanip genisletilecek (isim, email, sifre, sifre tekrar).
- **Bagimlilik**: Yok

### 1.2 AI → Canvas Koprusu
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta (3-5 saat)
- **Dosyalar**:
  - `packages/web/lib/ai-canvas-bridge.ts` → YENI
  - `packages/web/components/ai/AIPanel.tsx` → GUNCELLE
  - `packages/web/components/canvas/TldrawCanvas.tsx` → GUNCELLE
- **Detay**: AI yanitindaki DSL komutlarini algilayip mevcut parseDSL() ile canvas'a uygulama.
- **Akis**:
  1. AI yanit geldi
  2. Regex ile DSL komutu var mi kontrol
  3. Varsa tahta-dsl.ts parseDSL() cagir
  4. TldrawCanvas runDSL() ile canvas'a ekle
  5. Kullaniciya "X sekil olusturuldu" bildir
- **Bagimlilik**: Mevcut tahta-dsl.ts + AIPanel.tsx

### 1.3 Gercek Zamanli Shape Sync (Yjs Bridge)
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Zor (5-8 saat)
- **Dosyalar**:
  - `packages/web/hooks/useCollaboration.ts` → GUNCELLE
  - `packages/web/components/canvas/TldrawCanvas.tsx` → GUNCELLE
- **Detay**: Mevcut Yjs altyapisi + y-websocket server kullanilacak.
  - tldraw onChange → Yjs shapesMap'e yaz
  - Yjs shapesMap observe → tldraw store'a uygula
  - getShapesMap() zaten tanimli, KULLANILMIYOR — aktif et
- **Yaklasim**: tldraw-sync yerine Yjs bridge (mevcut altyapi yeterli)
- **Bagimlilik**: useCollaboration.ts, y-websocket server (:4001)

---

## FAZ 2 — KULLANICI DENEYIMI (Oncelik: ORTA)

### 2.1 Yorum Paneli
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta (3-4 saat)
- **Dosyalar**:
  - `packages/web/components/canvas/CommentPanel.tsx` → YENI
  - `packages/web/components/canvas/TldrawCanvas.tsx` → GUNCELLE (panel toggle)
- **Detay**: Backend comments CRUD + threading (parent_id) + is_ai flag tamamen hazir. Secili shape'e yorum ekleme, listeleme, AI yorumlari farkli stil.
- **Bagimlilik**: Backend comments route

### 2.2 Proje Uye Yonetimi
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta (3-4 saat)
- **Dosyalar**:
  - `packages/web/app/project/[id]/page.tsx` → YENI
  - `packages/web/components/project/MemberManager.tsx` → YENI
- **Detay**: Backend'de POST /projects/:id/members + role UPSERT hazir. Email ile davet, rol degistirme, cikarma UI'i.
- **Bagimlilik**: Backend projects route

### 2.3 History / Versiyon Goruntuleyici
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta (4-5 saat)
- **Dosyalar**:
  - `packages/web/components/canvas/HistoryPanel.tsx` → YENI
- **Detay**: Backend history tablosunda before_state/after_state JSONB kaydi var. Timeline UI + diff gosterimi + geri alma.
- **Bagimlilik**: Backend elements route (history)

### 2.4 Keyboard Shortcuts Tamamlama
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Kolay (1-2 saat)
- **Dosyalar**:
  - `packages/web/components/canvas/TldrawCanvas.tsx` → GUNCELLE
- **Detay**: ShortcutsModal var ama cogu kisayol bagli degil. Menu komutlarina gercek kisayol baglama (Ctrl+Z, Ctrl+Y, Ctrl+S, Ctrl+E, vs).
- **Bagimlilik**: Yok

---

## FAZ 3 — ILERI SEVIYE (Oncelik: DUSUK)

### 3.1 AI Agent Canvas Entegrasyonu
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Zor (8-12 saat)
- **Dosyalar**:
  - `packages/web/lib/ai-agent.ts` → YENI
- **Detay**: tldraw Agent Starter Kit pattern'i. AI dogrudan canvas uzerinde sekil olusturma, duzenleme, auto-layout.
- **Referans**: https://github.com/tldraw/tldraw/tree/main/templates/agent-template
- **Bagimlilik**: Faz 1.2 tamamlanmali

### 3.2 Custom tldraw Shapes
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta-Zor (6-8 saat)
- **Dosyalar**:
  - `packages/web/components/canvas/shapes/` → YENI dizin
    - KanbanShape.ts, TimelineShape.ts, SwotShape.ts
- **Detay**: Mevcut sablonlar geo shapes kullaniyor. Custom shapes ile daha zengin gorsel.
- **Bagimlilik**: Yok

### 3.3 Offline-First + PWA
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Zor (8-10 saat)
- **Dosyalar**:
  - `packages/web/lib/offline-sync.ts` → YENI
  - `packages/web/public/sw.js` → YENI
- **Detay**: IndexedDB kayit → online olunca sync. Service Worker ile PWA.
- **Bagimlilik**: Faz 1.3 tamamlanmali

### 3.4 Import Destegi
- **Durum**: ✅ TAMAMLANDI (2026-02-23)
- **Zorluk**: Orta (4-6 saat)
- **Dosyalar**:
  - `packages/web/lib/importers/` → YENI dizin
    - mermaid.ts, drawio.ts, excalidraw.ts
- **Detay**: Mermaid, draw.io XML, Excalidraw JSON import. Mevcut export'un tersi.
- **Bagimlilik**: Yok

---

## ONERILEN SIRALAMA

```
Hafta 1: [1.1] Register sayfasi + [1.2] AI→Canvas koprusu
Hafta 2: [1.3] Yjs shape sync bridge
Hafta 3: [2.1] Yorum paneli + [2.2] Uye yonetimi
Hafta 4: [2.3] History paneli + [2.4] Kisayollar
Hafta 5+: Faz 3 ozellikleri
```

---

## INTERNET KAYNAKLARI (Arastirma Sonuclari)

### tldraw v4 / Agent Starter Kit
- **Agent Template**: https://github.com/tldraw/tldraw/tree/main/templates/agent-template
  - PromptPartUtil + AgentActionUtil ile AI canvas islemleri
  - Text generation, diagram creation, image generation
- **Workflow Template**: https://github.com/tldraw/tldraw/tree/main/templates/workflow-template
  - Agent prompt chaining, node-based workflow
- **Multiplayer Template**: https://github.com/tldraw/tldraw/tree/main/templates/multiplayer-template
  - tldraw-sync ile resmi cozum

### Yjs / CRDT
- **y-websocket**: Mevcut server zaten kullaniyor (:4001)
- **Hocuspocus**: Yjs WebSocket backend (daha gelismis, auth + persistence)
  - https://tiptap.dev/hocuspocus
- **y-indexeddb**: Offline persistence icin

### Acik Kaynak Ilham Projeleri
- **Excalidraw**: https://github.com/excalidraw/excalidraw (AI features, collaboration)
- **tldraw examples**: https://github.com/tldraw/tldraw/tree/main/apps/examples
- **BlockSuite**: https://github.com/toeverything/blocksuite (whiteboard + doc hybrid)

---

## NOTLAR
- Proje %65 tamamlandi. Backend tam, frontend entegrasyonlar eksik.
- En buyuk gap: Shape sync + AI-canvas koprusu
- Mevcut DSL sistemi (712 satir) cok guclu - bunu AI ile birlestirmek en buyuk katma deger
- tldraw UI tamamen custom (draw.io stili) - bu unique bir ozellik, korumali
- Agent kullanimi aktif - paralel sub-agent'lar ile gelistirme yapilacak
