# abeTahta

Gerçek zamanlı görsel işbirliği ve proje yönetim platformu.

**"Kullanıcı tahtayı görür, Claude veriyi görür. İkisi aynı gerçekliği okur/yazar."**

## Hızlı Başlangıç

### Ön Gereksinimler
- Node.js 22+
- Docker Desktop (PostgreSQL ve Redis için)
- Git

### 1. Veritabanlarını Başlat
```bash
docker compose up -d
```
Bu komut PostgreSQL 16 ve Redis 7'yi başlatır, schema otomatik uygulanır.

### 2. Environment Ayarla
```bash
cp .env.example .env
# .env dosyasını düzenle: şifreler, JWT secret, Claude API key
```

### 3. Bağımlılıkları Kur
```bash
npm install
```

### 4. Geliştirme Sunucularını Başlat
```bash
npm run dev
```
Bu komut 3 sunucuyu aynı anda başlatır:
- **Web (Next.js):** http://localhost:3000
- **API (Express):** http://localhost:4000
- **WebSocket (Yjs):** ws://localhost:4001

## Proje Yapısı

```
D:\AbeTahta\
├── docs/                      # Belgeler
│   ├── 01-MIMARI-TASARIM.md   # Mimari belge
│   └── database-schema.sql    # PostgreSQL şeması
├── packages/
│   ├── web/                   # Next.js 15 Frontend
│   │   ├── app/               # App Router sayfaları
│   │   ├── components/        # React bileşenleri
│   │   ├── lib/               # API client, utils
│   │   ├── store/             # Zustand state
│   │   └── types/             # TypeScript tipleri
│   └── server/                # Node.js Backend
│       ├── src/routes/        # API endpoint'leri
│       ├── src/middleware/     # Auth, error handling
│       ├── src/models/        # DB, Redis bağlantıları
│       ├── src/ws/            # Yjs WebSocket sunucu
│       └── src/claude/        # Claude entegrasyonu
├── docker-compose.yml         # PostgreSQL + Redis
├── .env.example               # Ortam değişkenleri
└── package.json               # Monorepo root
```

## Teknoloji Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | Next.js 15, React 19, tldraw, Yjs, Tailwind, Zustand |
| Backend | Node.js 22, Express 5, Socket.IO, y-websocket |
| Veritabanı | PostgreSQL 16 (JSONB), Redis 7 |
| AI | Claude API (REST) |

## API Endpoints

### Auth
- `POST /api/auth/register` - Kayıt
- `POST /api/auth/login` - Giriş
- `POST /api/auth/refresh` - Token yenile
- `GET /api/auth/me` - Profil

### Projects
- `GET /api/projects` - Proje listesi
- `POST /api/projects` - Yeni proje
- `GET /api/projects/:id` - Proje detay
- `PUT /api/projects/:id` - Güncelle
- `POST /api/projects/:id/members` - Üye ekle

### Boards
- `GET /api/boards/:id` - Tahta + elemanlar
- `POST /api/boards` - Yeni tahta
- `PUT /api/boards/:id` - Güncelle

### Elements
- `POST /api/elements` - Yeni eleman
- `PUT /api/elements/:id` - Güncelle
- `DELETE /api/elements/:id` - Sil
- `POST /api/elements/batch` - Toplu oluştur

### Claude API
- `GET /api/claude/board/:id` - Tam veri
- `GET /api/claude/board/:id/summary` - Özet
- `GET /api/claude/board/:id/flow` - Flowchart
- `POST /api/claude/board/:id/element` - Eleman oluştur
- `PUT /api/claude/element/:id` - Eleman güncelle
- `POST /api/claude/board/:id/analyze` - Analiz yaz
- `POST /api/claude/board/:id/comment` - Yorum ekle

## Lisans

Özel - Tüm hakları saklıdır. © abeerp.com
