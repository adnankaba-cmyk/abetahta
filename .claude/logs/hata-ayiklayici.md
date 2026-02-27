# Hata Ayiklayici Log

> Bu dosya **hata-ayiklayici** ajani tarafindan otomatik guncellenir.
> Her hata tespiti, kok neden analizi ve duzeltme burada kayit altina alinir.

---

## [2026-02-24] HATA AYIKLAMA: Bilinen Sorunlar Duzeltmesi

Ajan: hata-ayiklayici
Durum: KISMI (2 gercek sorun duzeltildi, 2 rapor hatali)

### Arastirma Bulgusu — Rapor Tutarsizliklari

#### Sorun 1 — mermaid-renderer.ts:19 securityLevel:'loose' XSS

- Durum: RAPOR HATALI
- Gercek: Dosya okundu, `securityLevel: 'strict'` zaten mevcut (satir 22)
- `'loose'` deger hic kullanilmamis, duzeltme gerekmedi

#### Sorun 2 — mermaid-parser.ts recursive DFS stack overflow

- Durum: RAPOR HATALI
- Gercek: `mermaid-parser.ts` dosyasi proje kaynaginda mevcut degil
- `packages/web/lib/` ve alt dizinleri taranarak dogrulandi
- Mermaid isleme `mermaid-renderer.ts` (render) ve `importers/mermaid.ts` (import) ile yapiliyor, DFS kodu yok

### Duzeltilen Hatalar

#### Sorun 3 — 'as any' tip kaybi

Raporda ai-canvas-bridge.ts:148 olarak belirtilmis, gercekte TldrawCanvas.tsx'de.

- Dosya: `packages/web/components/canvas/TldrawCanvas.tsx`
- Kok Neden: tldraw shape API'si generic tip parametresi gerektiriyor, ancak union tipli yapilarda `as any` ile bypass edilmis
- Duzeltmeler:

  - Satir 4: `TLGeoShape`, `TLShapePartial` importlari `@tldraw/editor`'dan eklendi
  - Satir 205-213: `addShape` icinde geo props `Partial<TLGeoShape['props']>` ile tiplendi, `createShape<TLGeoShape>` generic kullanildi
  - Satir 667: `(item as any).header` kaldirildi, `item.header` kullanildi (MenuItem tipi zaten `header?: boolean` iceriyor)
  - Satir 874: `updateShape(...) as any` → `as TLShapePartial<TLShape>` (renk guncelleme)
  - Satir 901-904: `shape.props as any` → `as Record<string, unknown>`, `updateShape as any` → `as TLShapePartial<TLShape>` (boyut guncelleme)
  - Satir 933: `updateShape(...) as any` → `as TLShapePartial<TLShape>` (font guncelleme)

#### Sorun 4 — TldrawCanvas.tsx openFile DOM temizlenmesi eksik

- Dosya: `packages/web/components/canvas/TldrawCanvas.tsx`, satir 229-264
- Kok Neden: Kullanici dosya secim dialogunu iptal ederse `change` event tetiklenmiyor, `input.remove()` cagirilmiyor, DOM'da orphan `<input>` elementi birikiyordu
- Cozum:

  - `cleanup()` fonksiyonu olusturuldu (`document.body.contains` kontroluyle guvenli temizleme)
  - `input.addEventListener('cancel', cleanup)` eklendi (modern tarayicilar destekler)
  - `change` event handler'inda da `cleanup()` kullanildi
  - Onceki tek `input.remove()` cift temizleme riskine karsi `contains` kontrollu `cleanup()` ile degistirildi

### Dogrulama

- [x] Tum dosyalar Edit sonrasi okunarak degisiklikler dogrulandi
- [x] `packages/web && npx tsc --noEmit` — BASARILI (hata yok)
- [x] `packages/server && npx tsc --noEmit` — BASARILI (hata yok)
- [x] mermaid-renderer.ts zaten guvenli (`securityLevel: 'strict'`)
- [x] TldrawCanvas.tsx: `as any` kullanim sayisi 7'den 3'e dusuruldu
- [x] openFile: iptal durumunda DOM temizleme eklendi

Not: `window as any` (satir 990) yalnizca `NODE_ENV !== 'production'` kosulunda calisir, uretim guvenligi riski tasimaz, minimal degisiklik prensibi geregince dokunulmadi.

---
