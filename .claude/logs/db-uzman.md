# DB Uzman Log

> Bu dosya **db-uzman** ajani tarafindan otomatik guncellenir.
> Her migration, sorgu optimizasyonu ve sema degisikligi burada kayit altina alinir.

---

## [2026-02-24] KONTROL: Veritabani Durum

**Ajan**: db-uzman
**Durum**: BASARILI (Uyarilarla)

### Baglanti Durumu

| Servis        | Durum    | Detay                                        |
| ------------- | -------- | -------------------------------------------- |
| PostgreSQL 16 | SAGLIKLI | abetahta-db container, 2 gundir calisiyor    |
| Redis 7       | SAGLIKLI | abetahta-redis container, 2 gundir calisiyor |

- PostgreSQL 16.12 (Alpine), port 5432
- Redis 7.4.7, port 6379
- Veritabani boyutu: 9.191 kB

### Tablo Durumu

**Gercek DB'de 16 tablo var. database-schema.sql'de 10 tanim var.**

| Tablo            | Kayit                | Durum |
| ---------------- | -------------------- | ----- |
| users            | 6 canli / 34 silinen | Aktif |
| projects         | 3                    | Aktif |
| project_members  | 3                    | Aktif |
| boards           | 4 canli / 21 silinen | Aktif |
| elements         | 0                    | Bos   |
| connections      | 0                    | Bos   |
| comments         | 0                    | Bos   |
| history          | 0                    | Bos   |
| templates        | 0                    | Bos   |
| notifications    | 0 canli / 8 silinen  | Aktif |
| settings         | 37                   | Aktif |
| active_sessions  | 0                    | Bos   |
| ai_conversations | 0                    | Bos   |
| board_snapshots  | 0                    | Bos   |
| dsl_scripts      | 0                    | Bos   |
| shape_timeline   | 0                    | Bos   |

### Sema Uyumsuzlugu (KRITIK BULGU)

**database-schema.sql'de tanimlanmayan 6 ekstra tablo gercek DB'de mevcut:**

1. `active_sessions` - Canli tahta oturumlarini tutuyor (cursor, user_color vs.)
2. `ai_conversations` - AI sohbet gecmisi (board_id bazli, messages JSONB)
3. `board_snapshots` - Tahta anlik yedekleri (snapshot_data JSONB)
4. `dsl_scripts` - DSL betikleri ve derlenmis sonuclari
5. `settings` - 37 satir sistem ayari (key-value)
6. `shape_timeline` - Sekil degisiklik zaman serisi

Bu tablolar muhtemelen sonradan el ile eklendi. `database-schema.sql` guncellenmedi.

### Index Durumu

- Schema.sql'de 14 index tanimi var.
- Gercek DB'de 46 index var (32 ekstra: primary key + ek eklemeler).
- Ekstra dikkat ceken indexler:
  - `idx_elements_tags` - GIN index (schema.sql'de YOK)
  - `idx_users_email` - schema.sql'de YOK
  - `idx_pm_project`, `idx_pm_user` - schema.sql'de YOK
  - `idx_history_created` - schema.sql'de YOK
  - 4 yeni tablo icin 10+ index (schema.sql'de YOK)

### Trigger Durumu

7 trigger aktif. Schema.sql'de tanimli 6 trigger mevcut.

- Ekstra: `settings_updated_at` (settings tablosu icin, schema.sql'de YOK)
- Trigger isimleri schema.sql'deki isimlerden farkli: `tr_*` degil `trg_*` prefix kullanilmis.

### Redis Durumu

- PING: PONG (baglanti basarili)
- Versiyon: 7.4.7
- Uptime: 2 gun
- Cache anahtari sayisi: 0 (bos, dev ortami)

### Ozet ve Oneriler

| Konu                      | Oncelik | Aciklama                                                                        |
| ------------------------- | ------- | ------------------------------------------------------------------------------- |
| Schema.sql guncellenmeli  | YUKSEK  | 6 ekstra tablo + ek indexler dokumane edilmemis                                 |
| boards tablosu temizligi  | DUSUK   | 21 silinen (dead tuple) - VACUUM oneriliyor                                     |
| users tablosu temizligi   | DUSUK   | 34 silinen (dead tuple) - VACUUM oneriliyor                                     |
| elements tablosu bos      | BILGI   | tldraw_data JSONB boards tablosunda tutuluyor, elements kullanilmiyor olabilir  |

---
