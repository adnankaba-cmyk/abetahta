# abeTahta - Mimari Tasarım Belgesi

## 1. Genel Bakış

**abeTahta** gerçek zamanlı, görsel işbirliği platformudur.

**Temel Prensip:** "Kullanıcı tahtayı görür, Claude veriyi görür. İkisi aynı gerçekliği farklı pencerelerden okur/yazar."

## 2. Teknoloji Stack

### Frontend
| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| Next.js | 15 | SSR + SPA, routing, API routes |
| React | 19 | Component-based UI |
| tldraw | latest | Açık kaynak whiteboard engine |
| Yjs | latest | CRDT - çakışmasız gerçek zamanlı sync |
| Tailwind CSS | 4 | Styling |
| Zustand | latest | State management |
| Lucide Icons | latest | İkon seti |

### Backend
| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| Node.js | 22 | WebSocket native, hızlı I/O |
| Express.js | 5 | REST API |
| y-websocket | latest | Yjs senkronizasyon sunucusu |
| Socket.io | latest | Presence, bildirimler |
| JWT + bcrypt | - | Kimlik doğrulama |

### Veritabanı
| Teknoloji | Versiyon | Amaç |
|-----------|----------|------|
| PostgreSQL | 16 | Ana veritabanı (JSONB) |
| Redis | 7 | Cache, real-time state, pub/sub |

### AI
| Teknoloji | Amaç |
|-----------|------|
| Claude API | Veri okuma/yazma (REST) |

## 3. Sistem Mimarisi

```
Kullanıcılar (Tarayıcı)
    ↕ HTTPS + WebSocket
NGINX (Reverse Proxy, SSL)
    ↕
[Next.js :3000]  [Yjs WS :4001]  [REST API :4000]
    ↕
[PostgreSQL :5432]  [Redis :6379]
    ↕ REST API
Claude API
```

## 4. Gerçek Zamanlı Senkronizasyon

1. Kullanıcı eleman taşır → Yjs yerel dokümanı günceller
2. y-websocket tüm istemcilere yayınlar
3. Tüm istemciler anında güncellemeyi alır
4. PostgreSQL'e debounced yazma (2 saniyede bir)
5. CRDT çakışmasız birleştirme sağlar

## 5. Claude API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | /api/claude/board/:id | Tam tahta verisi (JSON) |
| GET | /api/claude/board/:id/summary | Eleman sayıları, durumlar |
| GET | /api/claude/board/:id/flow | Sadece flowchart düğümleri |
| POST | /api/claude/board/:id/element | Yeni eleman oluştur |
| PUT | /api/claude/element/:id | Eleman güncelle |
| POST | /api/claude/board/:id/analyze | AI analiz sonuçları |
| POST | /api/claude/board/:id/comment | Yorum ekle |

## 6. Veritabanı Tabloları

1. **users** - Kullanıcılar
2. **projects** - Projeler
3. **project_members** - Proje üyeleri
4. **boards** - Tahtalar
5. **elements** - Tüm canvas nesneleri (KRİTİK)
6. **connections** - Oklar/çizgiler
7. **comments** - Yorumlar (AI dahil)
8. **history** - Versiyon takibi
9. **templates** - Şablonlar

Detay: `docs/database-schema.sql`

## 7. Geliştirme Aşamaları

| Faz | Süre | İçerik |
|-----|------|--------|
| 1 - Temel | 2-3 hafta | DB, Auth, Proje/Tahta CRUD, Temel canvas |
| 2 - Gerçek Zamanlı | 1-2 hafta | Yjs, WebSocket, Çoklu kullanıcı |
| 3 - Zengin İçerik | 2 hafta | Not, checklist, flowchart, çizim |
| 4 - Claude Entegrasyonu | 1 hafta | Claude API endpoints |
| 5 - İleri | 2 hafta | Şablonlar, versiyon, export |
| 6 - Polish | 1 hafta | Performans, tema, kısayollar |

**Toplam: 9-11 hafta**
