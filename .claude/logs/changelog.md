# abeTahta — Değişiklik Günlüğü (Changelog)

> Bu dosya tüm ajanlar tarafından otomatik güncellenir.
> Her değişiklik, test sonucu ve doğrulama burada kayıt altına alınır.

---

## [2026-02-22] PROJE BAŞLANGIÇ
**Ajan**: proje-takipci
**Durum**: ⏳ BAŞLATILDI

**Açıklama**: abeTahta proje ajan sistemi kuruldu. 6 ajan oluşturuldu:
- gelistirici: Kod yazma ve değiştirme (doğrulama zorunlu)
- test-muhendisi: Test yazma ve çalıştırma (geçmeden bitmez)
- hata-ayiklayici: Debugging ve kök neden analizi
- kod-inceleyici: Kalite ve güvenlik incelemesi
- db-uzman: PostgreSQL şema ve sorgu yönetimi
- kalite-gardiyan: Tüm işlerin son doğrulaması
- proje-takipci: İlerleme takibi ve durum raporu

**Sonraki Adım**: Phase 1 başlatılacak — Docker, .env, PostgreSQL, Redis kurulumu
---

---

## [2026-02-24] KOD INCELEME — Mermaid Binding Entegrasyonu
**Ajan**: kod-inceleyici
**Durum**: TAMAMLANDI — DUZELTME GEREKLI

**Incelenen Dosyalar**:
- packages/web/lib/ai-canvas-bridge.ts (305 satir)
- packages/web/lib/mermaid-renderer.ts (278 satir)
- packages/web/lib/mermaid-parser.ts (534 satir)
- packages/web/components/canvas/TldrawCanvas.tsx (1226 satir)

**Otomatik Kontrol Sonuclari**:
- TypeScript (packages/web): HATA YOK (kendi tsconfig ile temiz)
- TypeScript (kok dizin): 80+ hata (arsiv/ ve kok tsconfig kaynakli — hedef dosyalarla ilgisiz)
- Lint: YAPILANDIRMA EKSIK (next lint interaktif prompt istiyor)
- Build: BASARILI (4 themeColor uyarisi)
- Test: TANIMSIZ (test scripti yok)

**Kritik Bulgular**:
1. [GUVENLIK] mermaid-renderer.ts:19 — securityLevel: 'loose' XSS riski
2. [KRITIK] mermaid-parser.ts:362-374 — iceice cagri (DFS) stack overflow riski
3. [UYARI] ai-canvas-bridge.ts:148 — props 'as any' tip kaybı
4. [UYARI] TldrawCanvas.tsx:253 — openFile'da DOM elementleri temizlenmiyor
5. [UYARI] mermaid-parser.ts / mermaid-renderer.ts — iki ayri MERMAID_EXAMPLES sabiti

**Kalite Skoru**: 6/10
**Onay Durumu**: DUZELTME GEREKLI

---

## [2026-02-24] TEST MUHENDISI — Test Kostu ve Duzeltme
**Ajan**: test-muhendisi
**Durum**: TAMAMLANDI — TUM TESTLER GECTI

**Degisiklikler**:

### Duzeltilen: packages/server/src/middleware/auth.ts
- `SINGLE_USER_MODE` sabiti modul seviyesinde ataniyordu — test ortaminda env mock calismiyor
- `isSingleUserMode()` fonksiyonu eklendi: her cagirda `process.env.SINGLE_USER_MODE` okur
- `authenticate()` fonksiyonu artik `isSingleUserMode()` kullanarak test edilebilir hale geldi
- Eski `SINGLE_USER_MODE` sabiti `@deprecated` olarak birakildi (geri uyumluluk)

### Duzeltilen: packages/server/tests/auth.test.ts
- `beforeEach` / `afterEach` ile `process.env.SINGLE_USER_MODE = 'false'` set ediliyor
- 4 basarisiz test duzeltildi (hepsi gecti)
- Yeni test eklendi: `SINGLE_USER_MODE aktifken JWT kontrolsuz gecis yapar`
- Test sayisi: 7 → 8

### Eklenen: packages/web/vitest.config.ts
- Web paketi icin Vitest yapilandirmasi olusturuldu (onceden yoktu)

### Eklenen: packages/web/package.json — test scripti
- `"test": "vitest run"` ve `"test:watch": "vitest"` eklendi

### Eklenen: packages/web/tests/mermaid-parser.test.ts (23 test)
- `parseMermaid()` birim testleri
- Node tipi tespiti (rectangle, diamond, ellipse, oval, cylinder, flag)
- Yon belirleme (TD, LR, BT)
- Kenar tipleri (arrow, line)
- Dongu (cycle) yonetimi
- Gercek dunya ornekleri (login akisi, org-chart)

### Eklenen: packages/web/tests/ai-canvas-bridge.test.ts (14 test)
- `extractMermaid()` birim testleri (fenced blok, auto-detect, forceMermaid)
- `applyMermaidToCanvas()` mock editor ile hata yonetimi
- `processAIResponse()` null editor ve mermaid-yok durumlari
- `applyCodeDirect()` donus degeri dogrulamasi

### Eklenen: packages/web/tests/mermaid-renderer.test.ts (13 test)
- `MERMAID_EXAMPLES` sabitlerinin varlik ve format kontrolu
- `extractMermaidLayout()` mock ile hata yonetimi senaryolari

**Test Sonuclari**:
- packages/server: 21/21 GECTI (0 basarisiz)
- packages/web:   50/50 GECTI (0 basarisiz)
- TOPLAM:         71/71 GECTI

**Build Durumu**:
- packages/server — npm run build: BASARILI
- packages/web    — npm run build: BASARILI (4 themeColor uyarisi — kritik degil)
- packages/server — npx tsc --noEmit: HATA YOK
- packages/web    — npx tsc --noEmit: HATA YOK

---

## [2026-02-24] PROJE DURUM RAPORU
**Ajan**: proje-takipci
**Durum**: ✅ RAPOR URETILDI

**Ortam Durumu**:
- Node.js: v24.6.0 ✅
- Docker: CALISIYOR ✅
- PostgreSQL: UP, saglikli (:5432) ✅
- Redis: UP, saglikli (:6379) ✅
- Git: ❌ DEPO YOK (git init yapilmamis)

**Build Durumu**:
- packages/web — TypeScript: HATA YOK ✅
- packages/server — TypeScript: HATA YOK ✅
- packages/web — Build: BASARILI ✅ (4 themeColor uyarisi)
- packages/server — Build: BASARILI ✅

**Test Durumu**:
- packages/server: 21/21 GECTI ✅
- packages/web: 50/50 GECTI ✅
- TOPLAM: 71/71 GECTI ✅

**Phase Ilerleme**:
- Phase 1 (Temel): %85 ████████████████░░░░
- Phase 2 (UX): %0 ░░░░░░░░░░░░░░░░░░░░
- Phase 3 (Ileri): %0 ░░░░░░░░░░░░░░░░░░░░

**Acik Sorunlar**:
1. [ACIL] Git deposu yok — tum kod versiyonlanmamis
2. [GUVENLIK] mermaid-renderer.ts:19 — securityLevel:'loose' XSS riski
3. [YUKSEK] Shape Sync yok — sekiller senkronize olmuyor
4. [YUKSEK] AI → Canvas entegrasyonu dogrulanmamis
5. [ORTA] mermaid-parser.ts recursive DFS — stack overflow riski

**Oncelikli Sonraki Adimlar**:
1. git init + ilk commit
2. Guvenlik duzeltmesi (securityLevel:'strict')
3. AI → Canvas zincirini dogrula
4. Shape Sync entegrasyonu
