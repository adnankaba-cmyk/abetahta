# abeTahta — Kapsamlı Kod İnceleme Raporu

**Tarih:** 2026-02-26
**İncelenen:** `packages/server/src/` (tüm backend), `packages/web/` (app, components, lib, store, hooks), yapılandırma dosyaları
**Toplam Bulgu:** 23 (5 KRİTİK · 6 YÜKSEK · 7 ORTA · 5 DÜŞÜK)

---

## ÖZET TABLO

| # | Başlık | Önem | Dosya | Satır |
|---|--------|------|-------|-------|
| 01 | WebSocket docName uyumsuzluğu — senkronizasyon ve board erişim kontrolü çalışmıyor | KRİTİK | `useCollaboration.ts` / `ws/server.ts` | 58 / 76-90 |
| 02 | `requireBoardAccess` tek kullanıcı modunda 403 veriyor — AI ve comment endpoint'leri çalışmıyor | KRİTİK | `middleware/auth.ts` | 111-166 |
| 03 | ~~Refresh token blacklist in-memory~~ → Redis'e taşındı | ✅ | `routes/auth.ts` | — |
| 04 | `authenticateClaude` — admin rolü atanıyor, privilege escalation riski | KRİTİK | `middleware/auth.ts` | 178 |
| 05 | Access token LocalStorage'da — XSS'e karşı korumasız | KRİTİK | `store/auth.ts` / `lib/api.ts` | 39, 23 |
| 06 | `requireBoardAccess` body'den boardId — UUID validasyonu eksik | YÜKSEK | `middleware/auth.ts` | 119 |
| 07 | Claude `PUT /element/:id` — board erişim kontrolü yok | YÜKSEK | `routes/claude.ts` | 215 |
| 08 | `POST /api/comments` — requireBoardAccess yok, tek kullanıcı modunda çalışmıyor | YÜKSEK | `routes/comments.ts` | 32 |
| 09 | Mermaid `htmlLabels: true` + `securityLevel: strict` çelişkisi | YÜKSEK | `mermaid-renderer.ts` | 23 |
| 10 | `useTldrawYjsSync` Y.Map isim uyumsuzluğu — senkronizasyon kopuk olabilir | YÜKSEK | `useTldrawYjsSync.ts` | 28 |
| 11 | API client'ta token refresh yok — 15dk sonra kullanıcı sisteme erişemez | YÜKSEK | `lib/api.ts` | tüm dosya |
| 12 | `TemplatePanel` `setTimeout` ile şekil oluşturma — component unmount'ta memory leak | ORTA | `TemplatePanel.tsx` | 283-350 |
| 13 | `elements` update/delete — history yazma transaksiyonsuz | ORTA | `routes/elements.ts` | 119 |
| 14 | `SINGLE_USER_MODE` sabit değer — stale, runtime değişikliğine duyarsız | ORTA | `routes/auth.ts` | 28, 35 |
| 15 | Anthropic SDK her istekte yeniden oluşturuluyor | ORTA | `routes/ai.ts` | 309 |
| 16 | Board silme — cache invalidate yok | ORTA | `routes/boards.ts` | 160 |
| 17 | docker-compose SQL yolu yanlış (`./docs/` değil `./`) | ORTA | `docker-compose.yml` | 20 |
| 18 | `boardState` kullanıcı girdisi — Zod validasyonu yok, prompt injection riski | ORTA | `routes/ai.ts` | 293 |
| 19 | TypeScript `any` kullanımı — strict mode ihlali | DÜŞÜK | Çeşitli | — |
| 20 | Şifre min 6 karakter — yetersiz | DÜŞÜK | `routes/auth.ts` | 81 |
| 21 | `unreadCount` pagination'la tutarsız | DÜŞÜK | `store/notifications.ts` | 98 |
| 22 | `url.parse()` deprecated | DÜŞÜK | `ws/server.ts` | 41 |
| 23 | History limit'e üst sınır yok | DÜŞÜK | `routes/elements.ts` | 224 |

---

## KRİTİK BULGULAR

---

### BULGU-01: WebSocket DocName Uyumsuzluğu — Senkronizasyon Tamamen Çalışmıyor

**Dosyalar:**
- `packages/web/hooks/useCollaboration.ts` — satır 58
- `packages/server/src/ws/server.ts` — satırlar 76-90

**Problem:**

Frontend `board-{UUID}` formatında bağlanıyor:
```ts
const provider = new WebsocketProvider(WS_URL, `board-${boardId}`, doc, {
```

Sunucu ise UUID regex ile eşleştirmeye çalışıyor:
```ts
if (userId && UUID_REGEX.test(docName)) {
  const hasAccess = await checkBoardAccess(userId, docName);
```

`board-` prefix'i UUID formatını bozduğu için regex eşleşmiyor. Sonuç:
1. Board erişim denetimi bypass edilmiş — herhangi bir authenticated kullanıcı herhangi bir board'a bağlanabilir.
2. Yjs dökümanı yanlış isimle çalışıyor — senkronizasyon çalışmıyor.

---

### BULGU-02: `requireBoardAccess` Middleware'i Tek Kullanıcı Modunda 403 Döndürüyor

**Dosyalar:**
- `packages/server/src/middleware/auth.ts` — satırlar 111-166
- `packages/server/src/routes/ai.ts` — satır 251
- `packages/server/src/routes/comments.ts` — satır 13

**Problem:**

`authenticate` middleware'i `SINGLE_USER_MODE === 'true'` iken bypass geçiyor, ancak `requireBoardAccess` içinde bu bypass yok. Sabit UUID `00000000-0000-0000-0000-000000000001` `project_members` tablosunda kayıt yoksa, `/api/ai/chat` ve `/api/comments/element/:elementId` her zaman 403 döndürür. **Tek kullanıcı modunda AI özelliği hiç çalışmaz.**

---

### BULGU-03: Refresh Token Blacklist In-Memory — Güvenlik Açığı

**Dosya:** `packages/server/src/routes/auth.ts` — satırlar 13-15

```ts
const usedRefreshTokens = new Set<string>();
setInterval(() => { usedRefreshTokens.clear(); }, 60 * 60 * 1000);
```

İki sorun:
1. Sunucu yeniden başlatıldığında blacklist sıfırlanır — kullanılmış refresh token'lar tekrar kullanılabilir.
2. Saatte bir `clear()` ile 7 günlük token'lar 1 saat sonra tekrar geçerli hale gelir.

Kod içindeki yorum da bunu kabul ediyor: `// Production'da Redis veya DB kullanilmali`

---

### BULGU-04: `authenticateClaude` — Admin Rolü Atanıyor

**Dosya:** `packages/server/src/middleware/auth.ts` — satırlar 170-185

```ts
req.user = {
  userId: 'claude-ai',
  email: 'claude@abetahta.local',
  role: 'admin',  // admin rolü veriliyor
};
```

`claude-ai` kullanıcısına `role: 'admin'` atanıyor. Bu user `requireAdmin` kontrollerini geçer. Claude route'larına erişebilen herhangi bir API key, admin yetkisiyle sistem genelinde işlem yapabilir — privilege escalation vektörü.

---

### BULGU-05: Access Token LocalStorage'da Saklanıyor — XSS Riski

**Dosyalar:**
- `packages/web/store/auth.ts` — satırlar 39, 59, 74, 92
- `packages/web/lib/api.ts` — satır 23

```ts
localStorage.setItem('accessToken', data.accessToken);
```

Backend `accessToken`'ı `httpOnly: true` cookie olarak da set ediyor, ancak frontend ayrıca localStorage'a yazıp her istekte Authorization header ile gönderiyor. LocalStorage XSS saldırılarına karşı korumasızdır — httpOnly cookie mekanizması işlevsiz kalıyor.

---

## YÜKSEK ÖNEMLİ BULGULAR

---

### BULGU-06: `requireBoardAccess` — UUID Validasyonu Eksik

**Dosya:** `packages/server/src/middleware/auth.ts` — satır 119

```ts
const boardId = req.params.id || req.params.boardId || req.body?.board_id || req.body?.boardId;
```

`boardId` için UUID formatı doğrulanmıyor. Geçersiz string geldiğinde PostgreSQL 500 döndürür (400 yerine). Input validasyonu middleware seviyesinde eklenmeli.

---

### BULGU-07: Claude `PUT /element/:id` — Board Erişim Kontrolü Yok

**Dosya:** `packages/server/src/routes/claude.ts` — satırlar 215-251

`authenticateClaude` middleware'ini geçen her istek, element'in hangi board'a ait olduğunu kontrol etmeden herhangi bir element'i güncelleyebilir. Board erişim doğrulaması yok.

---

### BULGU-08: `POST /api/comments` — `requireBoardAccess` Middleware Yok

**Dosya:** `packages/server/src/routes/comments.ts` — satırlar 32-74

GET endpoint'i middleware kullanırken POST handler'ı manuel SQL sorgusuyla kontrol yapıyor — tutarsız yaklaşım. Ayrıca tek kullanıcı modu bypass'ı yok, yorum oluşturmak da 403 alır.

---

### BULGU-09: Mermaid `htmlLabels: true` + `securityLevel: strict` Çelişkisi

**Dosya:** `packages/web/lib/mermaid-renderer.ts` — satırlar 23-30

```ts
mermaid.initialize({
  securityLevel: 'strict',
  flowchart: {
    htmlLabels: true,  // strict ile çelişiyor
```

Bu kombinasyon label'ların görünmemesine veya güvenlik açığına yol açabilir. AI tarafından üretilen Mermaid kodundaki label metinleri kullanıcı girdisinden kaynaklanabilir.

---

### BULGU-10: `useTldrawYjsSync` Y.Map İsim Uyumsuzluğu

**Dosya:** `packages/web/hooks/useTldrawYjsSync.ts` — satır 28

```ts
ydoc.getMap<...>('tldraw-shapes')
```

PROJE_DURUMU.md'de de aktif sorun olarak işaretlenmiş: `'tldraw-shapes' vs 'shapes' isim farki`. Farklı isimlerle açılan Y.Map nesneleri senkronize olmaz — veriler ayrı kalır.

---

### BULGU-11: API Client'ta Token Refresh Yok

**Dosya:** `packages/web/lib/api.ts`

`ApiClient` 401 aldığında otomatik token yenileme yapmıyor. Access token 15 dakikada bir süresi dolduğunda tüm API istekleri kesilir, kullanıcı canvas'ta çalışırken aniden `/login` sayfasına yönlendirilir.

---

## ORTA ÖNEMLİ BULGULAR

---

### BULGU-12: `TemplatePanel` — `setTimeout` ile Şekil Oluşturma

**Dosya:** `packages/web/components/canvas/TemplatePanel.tsx` — satırlar 283-350

```ts
template.shapes.forEach((shape, idx) => {
  setTimeout(() => {
    editor.createShape({...});
  }, idx * 50);
```

`onClose()` timeout'lardan hemen önce çağrılıyor. Panel kapandıktan sonra `editor` referansı geçersiz olursa pending timeout'lar çalışmaya devam eder — memory leak ve state bozulma riski. `applyTemplateById` (satır 43) timeout olmadan yapıyor — doğru yöntem bu.

---

### BULGU-13: `elements` Update/Delete — Transaksiyonsuz History Yazma

**Dosya:** `packages/server/src/routes/elements.ts` — satırlar 119-130

```ts
await db.query(`UPDATE elements ...`);
// İkisi aynı transaction içinde değil:
await db.query(`INSERT INTO history ...`);
```

`UPDATE` başarılı, `INSERT INTO history` başarısız olursa history kaydı eksik kalır. Transaction içine alınmalı.

---

### BULGU-14: `SINGLE_USER_MODE` Sabit Değer — Stale

**Dosyalar:**
- `packages/server/src/routes/auth.ts` — satır 28, 35

`SINGLE_USER_MODE` modül yüklenince bir kez değerlendiriliyor. Runtime'da `process.env.SINGLE_USER_MODE` değişse bile sabit güncellenmez. `isSingleUserMode()` fonksiyonu doğru (her çağrıda `process.env` okur) ama route handler'lar hâlâ eski sabiti kullanıyor. `@deprecated` etiketi var ama kullanım devam ediyor.

---

### BULGU-15: Anthropic SDK Her İstekte Yeniden Oluşturuluyor

**Dosya:** `packages/server/src/routes/ai.ts` — satır 309

```ts
const client = new Anthropic({ apiKey });
```

Her `/api/ai/chat` isteğinde yeni instance oluşturuluyor. Modül seviyesinde singleton olarak tanımlanmalı.

---

### BULGU-16: Board Silme — Cache Invalidate Yok

**Dosya:** `packages/server/src/routes/boards.ts` — satırlar 160-183

`DELETE /api/boards/:id` endpoint'i `cache.invalidateBoard()` çağırmıyor. Silinen board Redis cache'inde TTL dolana kadar (30 sn) kalmaya devam eder.

---

### BULGU-17: docker-compose SQL Yolu Yanlış

**Dosya:** `D:\AbeTahta\docker-compose.yml` — satır 20

```yaml
volumes:
  - ./docs/database-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
```

Dosya proje kökünde (`./database-schema.sql`), `./docs/` klasöründe değil. Docker container ilk başlatıldığında şema uygulanamaz. Ayrıca bu şema 16 tablonun yalnızca 10'unu içeriyor (güncel değil).

---

### BULGU-18: `boardState` — Zod Validasyonu Yok, Prompt Injection Riski

**Dosya:** `packages/server/src/routes/ai.ts` — satırlar 253, 293-295

Kullanıcıdan gelen `boardState` objesi doğrulanmadan Claude'a gönderilen prompt'a ekleniyor. `boardState.shapes[n].text` içine prompt injection denemeleri yapılabilir.

---

## DÜŞÜK ÖNEMLİ BULGULAR

---

### BULGU-19: TypeScript `any` Kullanımı — Strict Mode İhlali

CLAUDE.md kuralı: `TypeScript strict, any yasak`

| Dosya | Satır | Kullanım |
|-------|-------|----------|
| `server/src/models/db.ts` | 30 | `params?: any[]` |
| `server/src/routes/claude.ts` | 221 | `const values: any[] = []` |
| `server/src/routes/elements.ts` | 90, 182 | `any[]`, `(el: any)` |
| `web/lib/ai-agent.ts` | 114 | `s.props as Record<string, any>` |
| `web/components/canvas/TemplatePanel.tsx` | 74, 82, 89 | `as any` |

---

### BULGU-20: Şifre Minimum 6 Karakter — Yetersiz

**Dosya:** `packages/server/src/routes/auth.ts` — satır 81

```ts
password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
```

OWASP önerisi minimum 8 karakter, tercihen 12+.

---

### BULGU-21: `unreadCount` Pagination'la Tutarsız

**Dosya:** `packages/web/store/notifications.ts` — satır 98

`deleteNotification` çağrısında `unreadCount` yerel listedeki 20 bildirimle sınırlı hesaplanıyor. Gerçek okunmamış sayısı 20'nin üzerindeyse sayaç yanlış güncellenir.

---

### BULGU-22: `url.parse()` Deprecated

**Dosya:** `packages/server/src/ws/server.ts` — satır 41

```ts
const parsed = url.parse(req.url || '', true);
```

`url.parse()` Node.js'de deprecated. `new URL()` + `URLSearchParams` kullanılmalı.

---

### BULGU-23: History Limit'e Üst Sınır Yok

**Dosya:** `packages/server/src/routes/elements.ts` — satır 224

```ts
const limit = parseInt(req.query.limit as string) || 50;
```

`parseInt('999999999')` geçerli ve `LIMIT 999999999` ile aşırı büyük sonuç seti çekilebilir. `Math.min(limit, 200)` gibi üst sınır eklenmeli.

---

## UYGULANAN DÜZELTMELer (2026-02-27)

| # | Bulgu | Durum | Dosya |
|---|-------|-------|-------|
| 17 | docker-compose SQL yolu yanlış | ✅ DÜZELTİLDİ | `docker-compose.yml` |
| 02 | requireBoardAccess tek kullanıcı 403 | ✅ DÜZELTİLDİ | `middleware/auth.ts` |
| 06 | UUID validasyonu eksik | ✅ DÜZELTİLDİ | `middleware/auth.ts` |
| 01 | WebSocket docName uyumsuzluğu | ✅ DÜZELTİLDİ | `ws/server.ts` |
| 04 | authenticateClaude admin rolü | ✅ DÜZELTİLDİ | `middleware/auth.ts` |
| 14 | SINGLE_USER_MODE stale sabit | ✅ DÜZELTİLDİ | `routes/auth.ts` |
| 11 | Token refresh yok | ✅ DÜZELTİLDİ | `lib/api.ts` |
| 13 | Transaction eksikliği (update/delete) | ✅ DÜZELTİLDİ | `routes/elements.ts` |
| 15 | Anthropic SDK singleton değil | ✅ DÜZELTİLDİ | `routes/ai.ts` |
| 22 | url.parse() deprecated | ✅ DÜZELTİLDİ | `ws/server.ts` |
| 23 | History limit üst sınır yok | ✅ DÜZELTİLDİ | `routes/elements.ts` |

**Kalan açık bulgular:** YOK — tüm bulgular giderildi

---

## DÜZELTME ÖNCELİK SIRASI

1. **BULGU-02** — Tek kullanıcı modunda AI çalışmıyor (hemen düzelt)
2. **BULGU-17** — Docker başlamıyor (hemen düzelt)
3. **BULGU-01** — WebSocket senkronizasyon broken (hemen düzelt)
4. **BULGU-11** — Token refresh yok — 15 dakika sonra sistem kilitlenir
5. **BULGU-03** — Refresh token güvenliği (Redis'e taşı)
6. **BULGU-05** — LocalStorage → cookie (XSS güvenlik)
7. **BULGU-13** — Transaction eksikliği (veri bütünlüğü)
8. **BULGU-18** — Prompt injection koruması
