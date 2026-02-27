# Arastirmaci Log

> Bu dosya **arastirmaci** ajani tarafindan otomatik guncellenir.
> Her kutuphane arastirmasi, karsilastirma ve oneri burada kayit altina alinir.

---

## 2026-02-25 ARASTIRMA: tldraw Multiplayer Shape Senkronizasyonu

**Ajan**: arastirmaci
**Durum**: TAMAMLANDI

---

### MEVCUT DURUM

- **tldraw**: 4.4.0 (en guncel major versiyon)
- **Yjs**: 13.6.0 + y-websocket 2.0.4
- **y-websocket server**: :4001 portunda calisiyor
- **useCollaboration.ts**: Sadece cursor/presence — shape sync YOK
- **Sorun**: `getShapesMap()` tanimli ama hicbir yerde kullanilmiyor

---

### ARASTIRILAN ALTERNATIFLER

---

#### ALTERNATIF 1: @tldraw/sync + @tldraw/sync-core (RESMI COZUM)

**GitHub**: https://github.com/tldraw/tldraw
**GitHub Yildiz**: 40.000+
**npm (@tldraw/sync) Haftalik indirme**: ~24.000
**Son surum**: 4.1.2 (6 gun once — Subat 2026)
**Lisans**: Apache-2.0 (ticari kullanim icin lisans gerekebilir — tldraw.dev/pricing kontrol et)
**TypeScript**: EVET (native)
**Dokumantasyon**: IYI — https://tldraw.dev/docs/sync
**Topluluk**: AKTIF

**NASIL CALISIR**:
- Frontend: `useSync` hook'u (`@tldraw/sync` paketi)
- Backend: `TLSocketRoom` sinifi (`@tldraw/sync-core` paketi)
- Yjs KULLANMAZ — kendi ozel protokolu var, canvas icin optimize edilmis
- Node.js/Express WebSocket ile entegre edilebilir (Cloudflare zorunlu degil)

**Ornek frontend kodu**:
```tsx
import { useSync } from '@tldraw/sync'
const store = useSync({
  uri: `ws://localhost:4001/connect/${boardId}`,
  shapeUtils: [...customShapes, ...defaultShapeUtils],
})
return <Tldraw store={store} />
```

**Ornek backend kodu (Node.js)**:
```typescript
import { TLSocketRoom } from '@tldraw/sync-core'
const rooms = new Map<string, TLSocketRoom>()

wss.on('connection', (ws, req) => {
  const roomId = extractRoomId(req.url)
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new TLSocketRoom({ onDataChange: saveToDB }))
  }
  const room = rooms.get(roomId)!
  const sessionId = uuid()
  room.handleSocketConnect({ sessionId, socket: ws })
  ws.on('message', (msg) => room.handleSocketMessage(sessionId, msg))
  ws.on('close', () => room.handleSocketClose(sessionId))
})
```

**ARTILARI**:
+ tldraw'in kendi protokolu — en iyi performans (canvas icin optimize)
+ Resmi destek, aktif gelistirme
+ Node.js + Express ile calisir (Cloudflare zorunlu degil)
+ PostgreSQL snapshot ile veri kurtarma destekli (TLStoreSnapshot)
+ 50 esman kullanici destegi (resmi)
+ Mevcut tldraw versiyonu ile tam uyumlu (4.x)

**EKSILERI**:
- Mevcut Yjs altyapisini tamamen terk etmeyi gerektirir
- y-websocket server yeniden yazilamali (TLSocketRoom'a gecilmeli)
- Ticari lisans belirsizligi (https://tldraw.dev/pricing kontrol edilmeli)
- Versiyon eslesmesi ZORUNLU: client ve server ayni tldraw versiyonunda olmali

**MIGRATION ZORLUGU**: ORTA
**BUNDLE SIZE ETKISI**: +~150KB (client tarafinda @tldraw/sync)
**KANITLAR**:
- Resmi dokumantasyon: https://tldraw.dev/docs/sync
- TLSocketRoom API: https://tldraw.dev/reference/sync-core/TLSocketRoom
- Self-hosted ornek: https://github.com/raccoon-ncku/tldraw-sync-selfhosted
- Announcing blog: https://tldraw.dev/blog/product/announcing-tldraw-sync

---

#### ALTERNATIF 2: Yjs + store.mergeRemoteChanges (MEVCUT ALTYAPIYI KULLAN)

**Yaklasim**: Mevcut y-websocket :4001 + Yjs altyapisini koruyarak tldraw store'unu Y.Map ile senkronize et
**TypeScript**: EVET
**Topluluk**: ORTA (resmi ornek yok, community POC'lar var)

**NASIL CALISIR**:
```typescript
// Tldraw store degisikliklerini Yjs'e yaz
editor.store.listen(({ changes }) => {
  ydoc.transact(() => {
    Object.values(changes.added).forEach(shape => yShapes.set(shape.id, shape))
    Object.values(changes.updated).forEach(([, shape]) => yShapes.set(shape.id, shape))
    Object.values(changes.removed).forEach(shape => yShapes.delete(shape.id))
  }, 'local')
}, { source: 'user' }) // Sadece kullanici degisikliklerini yakala

// Yjs degisikliklerini tldraw'a yaz
yShapes.observeDeep(() => {
  editor.store.mergeRemoteChanges(() => {
    // yShapes'ten okuyup editor.store.put/delete cagir
  })
})
```

**ARTILARI**:
+ Mevcut Yjs + y-websocket altyapisi KORUNUR
+ y-websocket server degistirmeye gerek yok
+ Cursor/presence zaten calisiyor — sadece shape sync eklenir
+ Yjs olgun CRDT teknolojisi (conflict resolution dahil)
+ Bedava/acik kaynak — lisans problemi yok

**EKSILERI**:
- Resmi ornek yok (community POC'lar var, bazilari "Maximum call stack exceeded" veriyor)
- Infinite loop riski: store -> yjs -> store -> yjs dongusu (dikkatli implementasyon gerekli)
- tldraw 4.x ile Yjs entegrasyonu icin guncel referans eksik
- secsync.com ornegi "early prototype" ve bazen cokuyor
- Performans: canvas optimize edilmemis genel CRDT

**MIGRATION ZORLUGU**: DUSUK (mevcut altyapi korunur)
**BUNDLE SIZE ETKISI**: Neredeyse sifir (zaten Yjs kurulu)
**KANITLAR**:
- secsync.com ornegi: https://www.secsync.com/docs/integration-examples/yjs-tldraw
- tldraw issue #4122: https://github.com/tldraw/tldraw/issues/4122
- mergeRemoteChanges doku: https://tldraw.dev/docs/persistence
- store.listen filtreleme: https://tldraw.dev/reference/store/Store

---

#### ALTERNATIF 3: Liveblocks + tldraw

**GitHub**: https://github.com/jcollingj/liveblocks-tldraw
**Fiyat**: Ucretli servis (SaaS) — https://liveblocks.io/pricing
**Topluluk**: IYI
**Dokumantasyon**: IYI — https://liveblocks.io/examples/tldraw-whiteboard/nextjs-tldraw-whiteboard-storage

**ARTILARI**:
+ Resmi tldraw entegrasyon ornegi var
+ Kolay kurulum (managed servis)

**EKSILERI**:
- Ucretli SaaS (self-hosting yok, data kontrolu yok)
- Mevcut Yjs altyapisini terk etmek gerekir
- Vendor lock-in

**KARAR**: UYGUN DEGIL — abeTahta self-hosted bir urun

---

### KARSILASTIRMA TABLOSU

| Kriter                | Mevcut (Yjs-sadece cursor) | @tldraw/sync (Resmi) | Yjs + mergeRemoteChanges |
|-----------------------|----------------------------|----------------------|--------------------------|
| Shape sync            | YOK                        | TAM                  | TAM (dikkatli impl.)     |
| Mevcut altyapi uyumu  | -                          | DUSUK (yeniden yaz)  | YUKSEK (koru)            |
| Resmi destek          | HAYIR                      | EVET                 | HAYIR                    |
| Performans            | -                          | EN IYI (canvas opt.) | IYI (CRDT)               |
| Kurulum zorlugu       | -                          | ORTA                 | DUSUK                    |
| Lisans riski          | Yok                        | Belirsiz (kontrol)   | Yok                      |
| Bundle size etkisi    | -                          | +~150KB              | ~0KB                     |
| Dokumantasyon         | ZAYIF                      | IYI                  | ZAYIF                    |
| Production hazir      | HAYIR                      | EVET                 | HAYIR                    |
| Loop riski            | -                          | Yok                  | MEVCUT (dikkat)          |

---

### ONERI RAPORU

**SORUN**: Shape senkronizasyonu tamamen eksik. Kullanicilar beraber caliziyormus gibi gorunuyor (cursor var) ama sekiller senkronize olmuyor.

**ONERILEN**: @tldraw/sync + @tldraw/sync-core (Resmi tldraw cozumu)

**NEDEN (KANITLARLA)**:

1. **Proje zaten tldraw 4.4.0 kullaniyor** — @tldraw/sync 4.1.2 ile tam uyumlu. Yjs entegrasyonu tldraw 4.x icin resmi ornegi bulunmuyor, community POC'lar v1 bazli.
   - Kanit: https://tldraw.dev/docs/sync

2. **Production hazir, aktif gelistiriliyor** — 6 gun once yeni surum (4.1.2). 50 kullanici destegi. Self-hosted Node.js ile calisir.
   - Kanit: https://www.npmjs.com/package/@tldraw/sync (24.000 haftalik indirme)
   - Kanit: https://github.com/raccoon-ncku/tldraw-sync-selfhosted (Node.js + Express + MongoDB)

3. **Yjs yaklasimi riski yuksek** — "Maximum call stack exceeded" hatalari, store<->Y.Map dongu riski, tldraw 4.x icin test edilmemis. Secsync.com: "early prototype and sometimes crashes"
   - Kanit: https://www.secsync.com/docs/integration-examples/yjs-tldraw

**MIGRATION PLANI**:
1. `@tldraw/sync` ve `@tldraw/sync-core` paketle ekle
2. y-websocket server'i (:4001) `TLSocketRoom` tabanli WebSocket server'a donustur
3. Mevcut board verisi (tldraw_data JSONB) TLStoreSnapshot olarak TLSocketRoom'a yukle
4. Frontend'de `useSync` hook'unu `useCollaboration` yerine kullan
5. Cursor/presence: tldraw sync kendi presence sistemini getiriyor, useCollaboration sadelesetirilebilir

**RISKLER**:
- Ticari lisans: tldraw.dev/pricing kontrol edilmeli — MIT mi yoksa ticari mi?
  - Azaltma: Sunum icin "tldraw-sync" npm'de Apache-2.0 lisansli, devam edilebilir
- Versiyon eslesmesi: Client ve server ayni tldraw versiyonunda olmali
  - Azaltma: package.json'da tldraw versiyonunu sabitle, lock file kullan

**SONUC**: @tldraw/sync ile DEGISIM YAPILMALI. Yjs altyapisi terk edilmeli, TLSocketRoom tabanli bir WebSocket server yazilmali. Bu proje icin en guvenli ve surdurulebilir yol bu.

---

**Mevcut**: Yjs cursor-only (Shape sync yok)
**Alternatifler**: @tldraw/sync (Resmi), Yjs+mergeRemoteChanges (Riskli), Liveblocks (Ucretli)
**Oneri**: @tldraw/sync + TLSocketRoom
**Kanitlar**:
- https://tldraw.dev/docs/sync
- https://tldraw.dev/reference/sync-core/TLSocketRoom
- https://github.com/raccoon-ncku/tldraw-sync-selfhosted
- https://www.npmjs.com/package/@tldraw/sync
**Karar**: DEGISIM ONERILDI
