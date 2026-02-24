# abeTahta - Mimari Tasarım Dokümanı
## Gerçek Zamanlı Görsel İşbirliği Platformu

**Versiyon:** 1.0  
**Tarih:** 21 Şubat 2026  
**Hazırlayan:** Adnan Kaba + Claude Opus 4.6  

---

## 1. PROJENİN TANIMI

**abeTahta**, birden fazla kullanıcının internet üzerinden eş zamanlı olarak çalıştığı, 
görsel bir proje yönetim ve tasarım platformudur.

### Temel İlke
> **Kullanıcı tahtayı görür, Claude datayı görür.**  
> **İkisi aynı gerçekliği farklı pencereden okur/yazar.**

### Ne Yapacak?
- Sonsuz whiteboard canvas (yakınlaştır/uzaklaştır, kaydır)
- Akış diyagramları (kutular, oklar, karar noktaları)
- Yapışkan notlar (renkli, boyutlandırılabilir)
- Kontrol listeleri (todo/yapılacaklar)
- Serbest çizim
- Metin kutuları
- Resim/dosya ekleme
- Gruplama ve katmanlar
- Gerçek zamanlı çok kullanıcılı düzenleme
- Claude AI entegrasyonu (datayı okur, analiz eder, önerir, yazar)

### Kim Kullanacak?
- Adnan ve ekibi (9 kişi)
- İleride müşteriler ve dış paydaşlar
- Claude AI (arka plan katılımcısı)

---

## 2. KULLANICI DENEYİMİ

```
┌──────────────────────────────────────────────────────────────┐
│  abeTahta                        🔍 Ara   👤 Adnan   ⚙️     │
├──────────┬───────────────────────────────────┬───────────────┤
│          │                                   │               │
│ PROJELER │        ANA CANVAS                 │  ÖZELLİKLER  │
│          │                                   │               │
│ ▼ ERP    │   ┌───────┐      ┌───────┐       │  Seçili: Not  │
│   Modül A│   │ NOT   │─────▶│ GÖREV │       │  Renk: Sarı   │
│   Modül B│   │ Fikir │      │ Sprint│       │  Boyut: 200px │
│   Akışlar│   └───────┘      └───┬───┘       │  Atanan: Ahmet│
│          │                      │            │  Durum: Aktif │
│ ▼ Müşteri│                 ┌────▼────┐      │               │
│   Teklif │                 │ KARAR   │      │ YORUMLAR      │
│   Sözleşm│                 │ Noktası │      │ Adnan: tamam  │
│          │                 └────┬────┘      │ Claude: öneri │
│ ▼ Genel  │                      │            │               │
│   Fikirler                 ┌────▼────┐      │ GEÇMİŞ        │
│   Toplantı│                │ SONUÇ   │      │ 14:30 taşındı │
│          │                 └─────────┘      │ 14:28 renk    │
│          │                                   │ 14:25 oluştur │
│ TAKIM 🟢 │   ┌──────────────────┐           │               │
│ Adnan    │   │  ☑ Veritabanı    │           │ CLAUDE 🤖     │
│ Ahmet 🟢 │   │  ☐ API tasarımı  │           │ "Bu akışta    │
│ Mehmet🟢 │   │  ☐ Test          │           │  hata kontrol │
│ Claude🤖 │   │  ☐ Deploy        │           │  noktası      │
│          │   └──────────────────┘           │  eksik"       │
├──────────┴───────────────────────────────────┴───────────────┤
│ 🔲 Seç  ✏️ Çiz  📝 Not  📋 Liste  ◇ Şekil  → Ok  🔍 75%   │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. SİSTEM MİMARİSİ

```
                         İNTERNET
                            │
              ┌─────────────┼─────────────┐
              │             │             │
         Adnan 🖥️     Ahmet 📱     Mehmet 💻
         (Chrome)     (Tablet)     (Laptop)
              │             │             │
              └─────────────┼─────────────┘
                            │
                     HTTPS + WSS
                            │
               ┌────────────▼────────────┐
               │      NGINX              │
               │   (Reverse Proxy)       │
               │   SSL Termination       │
               └────────────┬────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
   ┌────────▼─────┐ ┌──────▼──────┐ ┌──────▼──────┐
   │  NEXT.JS     │ │  YJS        │ │  REST API   │
   │  (Port 3000) │ │  WEBSOCKET  │ │  (Port 4000)│
   │              │ │  SERVER     │ │             │
   │  Sayfalar    │ │  (Port 4001)│ │  CRUD       │
   │  SSR         │ │             │ │  Auth       │
   │  Static      │ │  Gerçek     │ │  Claude     │
   │              │ │  zamanlı    │ │  Entegre    │
   └──────────────┘ │  senkron    │ └──────┬──────┘
                    └──────┬──────┘        │
                           │               │
                    ┌──────▼───────────────▼──┐
                    │       DATA LAYER        │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │   PostgreSQL      │  │
                    │  │                   │  │
                    │  │ • Kullanıcılar    │  │
                    │  │ • Projeler        │  │
                    │  │ • Tahtalar        │  │
                    │  │ • Elemanlar       │  │
                    │  │ • Bağlantılar     │  │
                    │  │ • Yorumlar        │  │
                    │  │ • Versiyon Log    │  │
                    │  └───────────────────┘  │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │   Redis           │  │
                    │  │                   │  │
                    │  │ • Aktif oturumlar │  │
                    │  │ • Cursor pozisyon │  │
                    │  │ • Online durumu   │  │
                    │  │ • Yjs doc cache   │  │
                    │  └───────────────────┘  │
                    └─────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    CLAUDE API     │
                    │                   │
                    │  GET /board/data  │
                    │  → Tüm tahtayı   │
                    │    JSON olarak    │
                    │    okur           │
                    │                   │
                    │  POST /board/edit │
                    │  → Eleman ekler,  │
                    │    günceller      │
                    │                   │
                    │  POST /board/     │
                    │       analyze     │
                    │  → Akış analizi,  │
                    │    öneri üretir   │
                    └───────────────────┘
```

---

## 4. VERİTABANI ŞEMASI

### 4.1 Temel Tablolar

```sql
-- ============================================
-- KULLANICILAR
-- ============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    role            VARCHAR(20) DEFAULT 'member',  -- admin, member, viewer
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJELER (Üst düzey organizasyon)
-- ============================================
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    owner_id        UUID REFERENCES users(id),
    color           VARCHAR(7) DEFAULT '#3B82F6',
    icon            VARCHAR(50) DEFAULT 'folder',
    is_archived     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJE ÜYELERİ
-- ============================================
CREATE TABLE project_members (
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'editor',  -- owner, editor, viewer
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- ============================================
-- TAHTALAR (Her projede birden fazla tahta)
-- ============================================
CREATE TABLE boards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    viewport_x      FLOAT DEFAULT 0,       -- Son görüntüleme pozisyonu
    viewport_y      FLOAT DEFAULT 0,
    viewport_zoom   FLOAT DEFAULT 1.0,
    is_locked       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ELEMANLAR (Tahtadaki tüm nesneler)
-- Bu tablonun tasarımı KRİTİK
-- ============================================
CREATE TABLE elements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    
    -- TİP: note, shape, text, checklist, image, 
    --       flowchart_node, drawing, group, frame
    type            VARCHAR(30) NOT NULL,
    
    -- POZİSYON & BOYUT
    x               FLOAT NOT NULL DEFAULT 0,
    y               FLOAT NOT NULL DEFAULT 0,
    width           FLOAT DEFAULT 200,
    height          FLOAT DEFAULT 100,
    rotation        FLOAT DEFAULT 0,
    
    -- GÖRÜNÜM
    fill_color      VARCHAR(30) DEFAULT '#FFFFFF',
    stroke_color    VARCHAR(30) DEFAULT '#000000',
    stroke_width    FLOAT DEFAULT 1,
    opacity         FLOAT DEFAULT 1.0,
    border_radius   FLOAT DEFAULT 0,
    font_size       FLOAT DEFAULT 14,
    font_family     VARCHAR(50) DEFAULT 'Inter',
    text_align      VARCHAR(10) DEFAULT 'left',
    
    -- İÇERİK
    content         JSONB DEFAULT '{}',
    /*
      İçerik örnekleri:
      
      NOT tipi:
      {"title": "Fikir", "body": "Detaylı açıklama..."}
      
      CHECKLIST tipi:
      {"title": "Görevler", "items": [
        {"id": "1", "text": "Veritabanı", "checked": true},
        {"id": "2", "text": "API", "checked": false}
      ]}
      
      FLOWCHART_NODE tipi:
      {"label": "Başlangıç", "node_type": "start|process|decision|end"}
      
      SHAPE tipi:
      {"shape": "rectangle|circle|diamond|triangle"}
      
      TEXT tipi:
      {"text": "Serbest metin içeriği"}
      
      IMAGE tipi:
      {"url": "https://...", "alt": "açıklama"}
      
      DRAWING tipi:
      {"paths": [{"points": [[x,y],...], "color": "#000", "width": 2}]}
    */
    
    -- KATMAN & GRUPLAMA
    z_index         INT DEFAULT 0,
    parent_id       UUID REFERENCES elements(id),  -- Gruplama için
    is_locked       BOOLEAN DEFAULT false,
    is_visible      BOOLEAN DEFAULT true,
    
    -- META
    created_by      UUID REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),     -- Görev atama
    status          VARCHAR(20) DEFAULT 'active',   -- active, done, archived
    tags            TEXT[] DEFAULT '{}',
    due_date        TIMESTAMPTZ,
    priority        INT DEFAULT 0,                  -- 0=normal, 1=yüksek, 2=acil
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BAĞLANTILAR (Elemanlar arası oklar/çizgiler)
-- ============================================
CREATE TABLE connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    
    source_id       UUID REFERENCES elements(id) ON DELETE CASCADE,
    target_id       UUID REFERENCES elements(id) ON DELETE CASCADE,
    
    -- Bağlantı noktaları (top, right, bottom, left)
    source_anchor   VARCHAR(10) DEFAULT 'bottom',
    target_anchor   VARCHAR(10) DEFAULT 'top',
    
    -- GÖRÜNÜM
    line_type       VARCHAR(20) DEFAULT 'straight', -- straight, curved, step
    stroke_color    VARCHAR(30) DEFAULT '#6B7280',
    stroke_width    FLOAT DEFAULT 2,
    stroke_style    VARCHAR(10) DEFAULT 'solid',    -- solid, dashed, dotted
    arrow_start     BOOLEAN DEFAULT false,
    arrow_end       BOOLEAN DEFAULT true,
    
    -- ETİKET
    label           VARCHAR(500),
    label_position  FLOAT DEFAULT 0.5,  -- 0-1 arası, çizgi üzerinde konum
    
    -- Ara noktalar (kıvrımlı çizgiler için)
    waypoints       JSONB DEFAULT '[]',
    /* [{"x": 100, "y": 200}, ...] */
    
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- YORUMLAR (Herhangi bir elemana yorum)
-- ============================================
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id      UUID REFERENCES elements(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    body            TEXT NOT NULL,
    is_ai           BOOLEAN DEFAULT false,  -- Claude'dan mı geldi?
    parent_id       UUID REFERENCES comments(id),  -- Yanıt için
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VERSİYON GEÇMİŞİ (Her değişiklik kaydedilir)
-- ============================================
CREATE TABLE history (
    id              BIGSERIAL PRIMARY KEY,
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    
    action          VARCHAR(20) NOT NULL,  -- create, update, delete, move, connect
    element_id      UUID,
    
    -- Değişiklik detayı
    before_state    JSONB,
    after_state     JSONB,
    
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ŞABLONLAR (Hazır tahta şablonları)
-- ============================================
CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50),  -- flowchart, kanban, brainstorm, meeting
    thumbnail_url   VARCHAR(500),
    content         JSONB NOT NULL,  -- Tüm elemanlar ve bağlantılar
    is_public       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- İNDEKSLER (Performans için kritik)
-- ============================================
CREATE INDEX idx_elements_board ON elements(board_id);
CREATE INDEX idx_elements_type ON elements(board_id, type);
CREATE INDEX idx_elements_parent ON elements(parent_id);
CREATE INDEX idx_elements_assigned ON elements(assigned_to);
CREATE INDEX idx_elements_status ON elements(board_id, status);
CREATE INDEX idx_elements_content ON elements USING GIN(content);
CREATE INDEX idx_connections_board ON connections(board_id);
CREATE INDEX idx_connections_source ON connections(source_id);
CREATE INDEX idx_connections_target ON connections(target_id);
CREATE INDEX idx_comments_element ON comments(element_id);
CREATE INDEX idx_history_board ON history(board_id, created_at DESC);
CREATE INDEX idx_history_element ON history(element_id);
```

---

## 5. CLAUDE DATA GÖRÜNÜMÜ

Claude API'den bir tahta çağrıldığında şunu görür:

```json
{
  "board": {
    "id": "b-123",
    "name": "ERP Modül Tasarımı",
    "project": "Dinamo ERP v5"
  },
  "elements": [
    {
      "id": "e-1",
      "type": "flowchart_node",
      "x": 100, "y": 50,
      "content": {
        "label": "Sipariş Girişi",
        "node_type": "start"
      },
      "status": "active",
      "assigned_to": "Ahmet",
      "connections_out": ["e-2"]
    },
    {
      "id": "e-2",
      "type": "flowchart_node",
      "x": 100, "y": 200,
      "content": {
        "label": "Stok Kontrolü",
        "node_type": "decision"
      },
      "connections_out": ["e-3", "e-4"]
    },
    {
      "id": "e-3",
      "type": "flowchart_node",
      "x": 300, "y": 350,
      "content": {
        "label": "Üretim Emri",
        "node_type": "process"
      },
      "assigned_to": "Mehmet",
      "status": "done"
    },
    {
      "id": "e-10",
      "type": "checklist",
      "x": 500, "y": 50,
      "content": {
        "title": "Sprint Görevleri",
        "items": [
          {"id": "1", "text": "DB şeması", "checked": true},
          {"id": "2", "text": "API endpoint", "checked": false},
          {"id": "3", "text": "Frontend form", "checked": false}
        ]
      }
    },
    {
      "id": "e-20",
      "type": "note",
      "x": 500, "y": 300,
      "content": {
        "title": "DİKKAT",
        "body": "Stok negatife düşerse üretim emri otomatik oluşturulmalı"
      },
      "priority": 2,
      "tags": ["kritik", "stok"]
    }
  ],
  "connections": [
    {"source": "e-1", "target": "e-2", "label": ""},
    {"source": "e-2", "target": "e-3", "label": "Stok yetersiz"},
    {"source": "e-2", "target": "e-4", "label": "Stok yeterli"}
  ],
  "team_online": ["Adnan", "Ahmet"],
  "recent_changes": [
    {"user": "Ahmet", "action": "moved e-2", "time": "2 dk önce"},
    {"user": "Adnan", "action": "added note e-20", "time": "5 dk önce"}
  ]
}
```

**Claude bu datayı gördüğünde:**
- Akış diyagramının mantığını analiz edebilir
- Eksik bağlantıları tespit edebilir
- Hata kontrol noktası önerebilir
- Yeni eleman ekleyebilir (POST ile)
- Görev durumlarını raporlayabilir
- Darboğazları belirleyebilir

---

## 6. TEKNOLOJİ YIĞINI

### Frontend
| Teknoloji | Kullanım | Neden |
|-----------|----------|-------|
| **Next.js 15** | Uygulama framework | SSR + SPA, routing, API routes |
| **React 19** | UI kütüphanesi | Komponent tabanlı, dev ekosistemi |
| **tldraw** | Canvas motoru | Açık kaynak whiteboard, sürükle/bırak, zoom/pan |
| **Yjs** | CRDT senkronizasyon | Çakışmasız gerçek zamanlı ortak düzenleme |
| **Tailwind CSS** | Stil | Hızlı, tutarlı UI |
| **Zustand** | State yönetimi | Hafif, basit |
| **Lucide Icons** | İkonlar | Temiz, tutarlı ikon seti |

### Backend
| Teknoloji | Kullanım | Neden |
|-----------|----------|-------|
| **Node.js 22** | Runtime | WebSocket native, hızlı I/O |
| **Express.js** | REST API | Olgun, stabil, middleware desteği |
| **y-websocket** | Yjs senkronizasyon | Kanıtlanmış CRDT WebSocket sunucusu |
| **Socket.io** | Bildirimler, presence | Online durumu, cursor takibi |
| **JWT + bcrypt** | Auth | Token bazlı kimlik doğrulama |
| **Multer + S3** | Dosya yükleme | Resim ve dosya depolama |

### Database
| Teknoloji | Kullanım | Neden |
|-----------|----------|-------|
| **PostgreSQL 16** | Ana veritabanı | JSONB desteği, güvenilirlik, Adnan'ın SQL bilgisi |
| **Redis 7** | Cache + realtime state | Cursor pozisyonları, oturum, pub/sub |

### DevOps
| Teknoloji | Kullanım |
|-----------|----------|
| **Docker** | Konteynerizasyon |
| **Nginx** | Reverse proxy, SSL |
| **GitHub** | Kaynak kodu yönetimi |

### AI Entegrasyon
| Teknoloji | Kullanım |
|-----------|----------|
| **Claude API** | Data analizi, öneri, eleman oluşturma |
| **REST endpoints** | Claude için özel okuma/yazma API'leri |

---

## 7. GERÇEK ZAMANLI SENKRONİZASYON

### Nasıl Çalışır?

```
Adnan bir notu taşır (x:100→300)
        │
        ▼
Yjs lokal belgeyi günceller
        │
        ▼
y-websocket değişikliği sunucuya gönderir
        │
        ├──▶ Ahmet'in tarayıcısı: Yjs güncellemeyi alır → not 300'e kayar
        ├──▶ Mehmet'in tarayıcısı: Aynı güncelleme → not 300'e kayar
        └──▶ PostgreSQL: Kalıcı kayıt (debounced, her 2 saniyede)
```

### Çakışma Durumu (CRDT'nin Gücü)
```
Adnan notu sağa taşır (x: 100→300) ──┐
                                       ├──▶ Yjs CRDT birleştirir
Ahmet aynı anda renk değiştirir ──────┘     → Not hem sağda hem yeni renkte
                                             → Çakışma YOK
```

---

## 8. API ENDPOINT'LERİ

### 8.1 Claude için Özel Endpoint'ler

```
GET    /api/claude/board/:id          → Tüm tahta datasını JSON olarak al
GET    /api/claude/board/:id/summary  → Özet (eleman sayıları, durumlar)
GET    /api/claude/board/:id/flow     → Sadece akış diyagramı ve bağlantıları
POST   /api/claude/board/:id/element  → Yeni eleman ekle
PUT    /api/claude/element/:id        → Eleman güncelle
POST   /api/claude/board/:id/analyze  → AI analiz sonucu kaydet
POST   /api/claude/board/:id/comment  → Yorum ekle
```

### 8.2 Kullanıcı API'leri

```
-- AUTH
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh

-- PROJELER
GET    /api/projects
POST   /api/projects
PUT    /api/projects/:id
DELETE /api/projects/:id

-- TAHTALAR
GET    /api/projects/:id/boards
POST   /api/projects/:id/boards
PUT    /api/boards/:id
DELETE /api/boards/:id

-- ELEMANLAR (WebSocket üzerinden de çalışır)
GET    /api/boards/:id/elements
POST   /api/boards/:id/elements
PUT    /api/elements/:id
DELETE /api/elements/:id
POST   /api/elements/:id/duplicate

-- BAĞLANTILAR
POST   /api/boards/:id/connections
PUT    /api/connections/:id
DELETE /api/connections/:id

-- YORUMLAR
GET    /api/elements/:id/comments
POST   /api/elements/:id/comments

-- GEÇMİŞ
GET    /api/boards/:id/history
POST   /api/boards/:id/undo

-- ŞABLONLAR
GET    /api/templates
POST   /api/templates
POST   /api/templates/:id/apply
```

---

## 9. MODÜL PLANI (GELİŞTİRME AŞAMALARI)

### Faz 1 — Temel (2-3 hafta)
- [x] Mimari tasarım ✅
- [ ] Veritabanı kurulumu
- [ ] Auth sistemi (login/register)
- [ ] Proje ve tahta CRUD
- [ ] Temel canvas (pan, zoom)
- [ ] Dikdörtgen, daire, metin ekleme
- [ ] Sürükle/bırak, boyutlandır

### Faz 2 — Gerçek Zamanlı (1-2 hafta)
- [ ] Yjs entegrasyonu
- [ ] WebSocket sunucusu
- [ ] Çok kullanıcılı eş zamanlı düzenleme
- [ ] Cursor takibi (kim nerede)
- [ ] Online/offline durumu

### Faz 3 — Zengin İçerik (2 hafta)
- [ ] Yapışkan notlar
- [ ] Kontrol listeleri
- [ ] Akış diyagramı elemanları (başlangıç, süreç, karar, bitiş)
- [ ] Oklar ve bağlantılar
- [ ] Serbest çizim
- [ ] Resim yükleme

### Faz 4 — Claude Entegrasyonu (1 hafta)
- [ ] Claude API endpoint'leri
- [ ] Tahta data okuma
- [ ] AI analiz ve öneri
- [ ] Claude'dan eleman ekleme
- [ ] Yorum sistemi

### Faz 5 — Gelişmiş (2 hafta)
- [ ] Şablonlar
- [ ] Versiyon geçmişi ve geri alma
- [ ] Dışa aktarma (PNG, PDF, JSON)
- [ ] Arama
- [ ] Bildirimler
- [ ] Gruplama ve katmanlar

### Faz 6 — Polish (1 hafta)
- [ ] Performans optimizasyonu
- [ ] Mobil uyumluluk
- [ ] Tema (karanlık/açık)
- [ ] Klavye kısayolları
- [ ] Erişilebilirlik

---

## 10. GÜVENLİK

- JWT token bazlı kimlik doğrulama (access + refresh token)
- Proje bazlı yetkilendirme (owner/editor/viewer)
- Rate limiting (API istekleri)
- XSS koruması (içerik sanitizasyonu)
- CORS yapılandırması
- HTTPS zorunlu
- SQL injection koruması (parameterized queries)
- Dosya yükleme validasyonu (tip, boyut)
- WebSocket bağlantı doğrulama

---

## 11. DEPLOYMENT

### Geliştirme Ortamı
```
Windows (D:\abeTahta)
├── Node.js + npm
├── PostgreSQL (lokal veya Docker)
├── Redis (Docker)
└── .env dosyası
```

### Üretim Ortamı
```
VPS veya Cloud (Hetzner, DigitalOcean, vs.)
├── Docker Compose
│   ├── next-app
│   ├── api-server
│   ├── ws-server
│   ├── postgresql
│   ├── redis
│   └── nginx
└── SSL (Let's Encrypt)
```

---

## 12. DOSYA YAPISI

```
D:\abeTahta\
│
├── 📁 docs/                    # Dokümanlar
│   ├── 01-MIMARI-TASARIM.md
│   ├── 02-API-DOKUMANI.md
│   └── 03-KULLANIM-KILAVUZU.md
│
├── 📁 packages/
│   ├── 📁 web/                 # Next.js frontend
│   │   ├── 📁 app/             # App router sayfaları
│   │   ├── 📁 components/      # React bileşenleri
│   │   │   ├── 📁 canvas/      # Canvas/whiteboard bileşenleri
│   │   │   ├── 📁 elements/    # Not, liste, şekil bileşenleri
│   │   │   ├── 📁 panels/      # Sol panel, sağ panel
│   │   │   ├── 📁 toolbar/     # Araç çubuğu
│   │   │   └── 📁 ui/          # Genel UI bileşenleri
│   │   ├── 📁 lib/             # Yardımcı fonksiyonlar
│   │   ├── 📁 hooks/           # React hooks
│   │   ├── 📁 store/           # Zustand store
│   │   ├── 📁 styles/          # CSS/Tailwind
│   │   └── 📁 public/          # Statik dosyalar
│   │
│   └── 📁 server/              # Backend
│       ├── 📁 src/
│       │   ├── 📁 routes/      # API rotaları
│       │   ├── 📁 middleware/   # Auth, validation
│       │   ├── 📁 models/      # DB modelleri
│       │   ├── 📁 services/    # İş mantığı
│       │   ├── 📁 ws/          # WebSocket sunucusu
│       │   ├── 📁 claude/      # Claude entegrasyon
│       │   └── 📁 utils/       # Yardımcılar
│       └── 📁 db/
│           ├── migrations/     # DB migration dosyaları
│           └── seeds/          # Test verileri
│
├── 📁 docker/                  # Docker yapılandırması
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   └── Dockerfile.server
│
├── .env.example
├── .gitignore
├── package.json                # Monorepo root
├── README.md
└── turbo.json                  # Turborepo yapılandırması
```

---

## SONUÇ

Bu mimari:
- ✅ Gerçek zamanlı çok kullanıcılı çalışmayı destekler
- ✅ Claude AI'ın tüm datayı okumasını/yazmasını sağlar  
- ✅ Ölçeklenebilir (10 kullanıcıdan 1000'e)
- ✅ Modern, kanıtlanmış teknolojiler kullanır
- ✅ Adım adım geliştirilebilir (Faz 1'den 6'ya)

**Sonraki adım:** Faz 1 kodlamaya başlamak.
