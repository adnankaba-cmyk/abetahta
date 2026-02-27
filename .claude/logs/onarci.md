# Onarıcı Logları

> Bu dosya onarci ana ajanı ve alt ajanlarının onarım kayıtlarını içerir.
> Her onarım sonunda buraya yazılır.

---

## 2026-02-24 ONARIM: İlk Tam Sistem Onarımı
**Komutan**: onarci
**Alt Ajanlar**: onarci-db, onarci-kod-yapisi, onarci-frontend, onarci-baglanti
**Önce**: ~35 sorun
**Sonra**: 0 hata (TSC + Build temiz)
**Onarım Oranı**: %100 (kritik hatalar), kalan sadece bilgilendirme seviyesi

### KRİTİK DÜZELTMELER (Kırık İşlevsellik):

1. **comments.ts:35,71,98** — `(req as any).user?.id` → `req.user?.userId`
   - AuthPayload'da alan `userId`, `id` değil. Tüm yorum CRUD'u NULL user_id ile çalışıyordu.
   - Durum: ✅ DÜZELTİLDİ

2. **useCollaboration.ts:39,137** — `ydocRef.current` → `useState<Y.Doc>`
   - ydoc useRef olarak dönüyordu → React re-render tetiklenmiyordu → useTldrawYjsSync hiç ydoc alamıyordu → shape sync ÇALIŞMIYORDU.
   - Durum: ✅ DÜZELTİLDİ

3. **claude.ts:184,250** — `'claude-ai'` literal → `NULL` (FK constraint ihlali)
   - `created_by` kolonuna UUID yerine string yazılıyordu → INSERT patlar.
   - Durum: ✅ DÜZELTİLDİ (onarci-db tarafından)

4. **elements.ts batch + history** — Üyelik kontrolü eklendi
   - Durum: ✅ DÜZELTİLDİ (onarci-db tarafından)

### TEMİZLİK:

5. **utils.ts** — 5 kullanılmayan export silindi (debounce, sleep, deepClone, formatDate, groupBy)
6. **ai-agent.ts:23** — Kullanılmayan `createShapeId` import kaldırıldı
7. **dashboard/page.tsx:159** — `(err as any).message` → proper error handling
8. **4 store dosyası** — 'use client' direktifi eklendi (auth, board, toast, notifications)

### TARAMADA TESPİT EDİLEN (bilgi seviyesi, aktif bug değil):

- 7 kullanılmayan bileşen: BottomToolbar, ShortcutsPanel, TemplatePanel, LeftPanel, RightPanel, TimelinePlayer, Button
- 1 kullanılmayan store: board.ts
- 19 backend endpoint frontend'den çağrılmıyor (hazır ama UI yok)
- AI system prompt `dsl` bloku tanımlıyor ama frontend sadece `mermaid` işliyor
- Y.Map isim tutarsızlığı: `tldraw-shapes` vs `shapes` (aktif bug değil, getShapesMap kullanılmıyor)
- Refresh token yenileme frontend'de eksik

### DOĞRULAMA:
- [x] Web TSC: 0 hata
- [x] Server TSC: 0 hata
- [x] Web Build: BAŞARILI
- [x] Server Build: BAŞARILI
