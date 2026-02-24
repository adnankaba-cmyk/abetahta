# TAHTA LANG - Zamansal Grafik Programlama Dili

## VİZYON

**TahtaLang**, Mirage.js'in veri katmanı mimarisinden, D3.js'in zamansal animasyonlarından ve GraphQL SDL'in deklaratif yapısından ilham alan, görsel içerik oluşturmak için tasarlanmış bir **Domain Specific Language (DSL)**'dir.

### İlham Kaynakları

1. **Mirage.js** - In-memory veritabanı, model/factory/serializer katmanları
2. **D3.js Timeline** - Zaman bazlı animasyon ve interpolasyon
3. **GraphQL SDL** - Deklaratif şema tanımı, tip sistemi
4. **Mermaid.js** - Metin tabanlı diyagram oluşturma

---

## TEMEL PRENSİPLER

### 1. Zamansal Farkındalık (Temporal Awareness)
Her nesne zaman damgası taşır. Oluşturulma, değiştirilme, silinme anları kaydedilir.

### 2. Çift Yönlü Dönüşüm (Bidirectional Transformation)
- **Kod → Görsel:** DSL kodu çalıştırılınca canvas'ta şekiller oluşur
- **Görsel → Kod:** Canvas'ta çizilen her şey otomatik olarak DSL koduna dönüşür

### 3. Parça Parça Kayıt (Incremental Persistence)
Her işlem veritabanına anında kaydedilir. Undo/redo için history tablosu kullanılır.

### 4. Semantic Model (Anlamsal Model)
Sadece koordinat değil, anlam da kaydedilir: "Bu bir başlangıç noktası", "Bu bir karar kutusu"

---

## DİL YAPISI

### Tip Sistemi

```tahta
// Temel Tipler
type Point = { x: number, y: number }
type Size = { width: number, height: number }
type Color = string | "kirmizi" | "yesil" | "mavi" | ...
type Timestamp = ISO8601 string

// Meta Bilgi (her nesne için)
type Meta = {
  id: UUID
  createdAt: Timestamp
  createdBy: User
  updatedAt: Timestamp
  updatedBy: User
  version: number
}
```

### Nesne Tanımları

```tahta
// Temel Şekiller
shape Box {
  position: Point
  size: Size
  text?: string
  color?: Color
  fill?: Color
  radius?: number
}

shape Circle {
  center: Point
  radius: number
  text?: string
  color?: Color
}

shape Diamond {
  position: Point
  size: Size
  text?: string
  color?: Color
}

// Bağlantılar
connection Arrow {
  from: Shape | Point
  to: Shape | Point
  label?: string
  style?: "solid" | "dashed" | "dotted"
  curve?: "straight" | "curved" | "step"
}

// Metin
text Label {
  position: Point
  content: string
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  align?: "left" | "center" | "right"
}

// Yapışkan Not
note Sticky {
  position: Point
  content: string
  color?: "yellow" | "blue" | "green" | "pink"
}
```

### Akış Diyagramı Kısayolları

```tahta
// Önceden tanımlı şablonlar
flow Start extends Circle {
  radius: 30
  color: "yesil"
  text: "Başla"
}

flow End extends Circle {
  radius: 30
  color: "kirmizi"
  text: "Bitir"
}

flow Process extends Box {
  size: { width: 150, height: 70 }
  color: "mavi"
}

flow Decision extends Diamond {
  size: { width: 120, height: 120 }
  color: "sari"
}

flow IO extends Box {
  // Parallelogram için skew
  skew: 15
  color: "turuncu"
}
```

---

## SÖZ DİZİMİ (SYNTAX)

### Temel Komutlar

```tahta
// Nesne oluşturma
create Box "Kutu1" at (100, 100) size (200, 80) {
  text: "Başlangıç"
  color: "yesil"
  fill: "acik_yesil"
}

// Bağlantı oluşturma
connect "Kutu1" -> "Kutu2" {
  label: "Evet"
  style: "solid"
}

// Grup oluşturma
group "AnaGrup" {
  create Box "A" at (0, 0) ...
  create Box "B" at (100, 0) ...
}

// Koşullu oluşturma
if condition {
  create ...
}

// Döngü
repeat 5 times with i {
  create Box "Item${i}" at (0, i * 60) ...
}
```

### Zaman Komutları

```tahta
// Belirli zamanda oluştur
at "2024-01-15T10:00:00Z" {
  create Box "Milestone1" ...
}

// Zamanlı animasyon
animate "Kutu1" {
  from: { opacity: 0 }
  to: { opacity: 1 }
  duration: 500ms
  easing: "ease-in-out"
}

// Sıralı oluşturma
sequence {
  delay: 200ms
  create Box "Step1" ...
  create Box "Step2" ...
  create Box "Step3" ...
}

// Timeline tanımlama
timeline "Proje Aşamaları" {
  "2024-01": create Box "Analiz" ...
  "2024-02": create Box "Tasarım" ...
  "2024-03": create Box "Geliştirme" ...
}
```

### Veri Bağlama (Data Binding)

```tahta
// JSON verisinden grafik oluştur
data sales = [
  { month: "Ocak", value: 120 },
  { month: "Şubat", value: 180 },
  { month: "Mart", value: 150 }
]

chart BarChart from sales {
  x: month
  y: value
  position: (100, 100)
  size: (400, 300)
}

// API'den veri çek
fetch "https://api.example.com/data" as projectData
render projectData with template "KanbanBoard"
```

---

## VERİTABANI ŞEMASI GÜNCELLEMELERİ

### Yeni Tablo: `dsl_scripts`

```sql
CREATE TABLE dsl_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code TEXT NOT NULL,
  compiled_shapes JSONB,  -- Parse edilmiş shape listesi
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Yeni Tablo: `shape_timeline`

```sql
CREATE TABLE shape_timeline (
  id BIGSERIAL PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  shape_id VARCHAR(100) NOT NULL,  -- tldraw shape ID
  event_type VARCHAR(20) NOT NULL,  -- create, update, delete, move, resize
  event_data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(100),

  INDEX idx_timeline_board (board_id),
  INDEX idx_timeline_shape (shape_id),
  INDEX idx_timeline_time (timestamp)
);
```

### Güncelleme: `elements` tablosuna DSL alanları

```sql
ALTER TABLE elements ADD COLUMN dsl_source TEXT;  -- Bu elemanı oluşturan DSL kodu
ALTER TABLE elements ADD COLUMN dsl_script_id UUID REFERENCES dsl_scripts(id);
ALTER TABLE elements ADD COLUMN semantic_type VARCHAR(50);  -- start, end, process, decision, io
ALTER TABLE elements ADD COLUMN semantic_data JSONB;  -- Ek anlamsal bilgi
```

---

## MİMARİ DEĞİŞİKLİKLER

### 1. DSL Parser Modülü

```
packages/web/lib/tahta-lang/
├── lexer.ts          # Tokenizer
├── parser.ts         # AST oluşturucu
├── ast.ts            # AST tip tanımları
├── interpreter.ts    # AST → tldraw shapes
├── generator.ts      # tldraw shapes → DSL kodu
├── validator.ts      # Söz dizimi kontrolü
├── stdlib.ts         # Standart kütüphane (flow, chart, etc.)
└── index.ts          # Public API
```

### 2. Timeline Service

```
packages/server/src/services/
├── timeline.ts       # Zaman serisi kayıt/sorgulama
├── playback.ts       # Oynatma mantığı
└── snapshot.ts       # Anlık görüntü kaydetme
```

### 3. Yeni API Endpoint'leri

```
POST   /api/dsl/parse         # DSL kodunu parse et, hata kontrolü
POST   /api/dsl/execute       # DSL kodunu çalıştır, shape'ler oluştur
GET    /api/dsl/generate/:boardId  # Board'dan DSL kodu üret
GET    /api/timeline/:boardId       # Zaman serisi verisi
POST   /api/timeline/:boardId/playback  # Oynatma başlat
GET    /api/snapshots/:boardId      # Anlık görüntüler listesi
POST   /api/snapshots/:boardId      # Yeni snapshot oluştur
```

### 4. Frontend Bileşenleri

```
components/
├── dsl/
│   ├── DSLEditor.tsx         # Monaco editor ile DSL editörü
│   ├── DSLPreview.tsx        # Anlık önizleme
│   ├── DSLErrorPanel.tsx     # Hata gösterimi
│   └── DSLExamples.tsx       # Örnek şablonlar
├── timeline/
│   ├── TimelinePlayer.tsx    # Video player benzeri kontroller
│   ├── TimelineSlider.tsx    # Zaman kaydırıcı
│   ├── TimelineMarkers.tsx   # Önemli anlar işaretçileri
│   └── TimelineExport.tsx    # Video/GIF export
└── semantic/
    ├── SemanticPanel.tsx     # Nesne anlamsal bilgisi
    ├── SemanticTypes.tsx     # Tip seçici
    └── SemanticRelations.tsx # İlişki tanımlama
```

---

## ÇIFT YÖNLÜ DÖNÜŞÜM ALGORİTMASI

### Canvas → DSL (Shape'ten Kod Üretme)

```typescript
function generateDSL(shapes: TLShape[]): string {
  const lines: string[] = [];

  // Shape'leri semantic type'a göre grupla
  const grouped = groupBySemanticType(shapes);

  // Her grup için uygun syntax üret
  for (const [type, items] of grouped) {
    if (type === 'flowchart') {
      lines.push(generateFlowchartDSL(items));
    } else if (type === 'chart') {
      lines.push(generateChartDSL(items));
    } else {
      lines.push(generateGenericDSL(items));
    }
  }

  // Bağlantıları ekle
  const connections = findConnections(shapes);
  lines.push(generateConnectionsDSL(connections));

  return lines.join('\n\n');
}
```

### DSL → Canvas (Koddan Shape Üretme)

```typescript
async function executeDSL(code: string, editor: Editor): Promise<void> {
  // 1. Lexical analysis
  const tokens = tokenize(code);

  // 2. Parse to AST
  const ast = parse(tokens);

  // 3. Validate
  const errors = validate(ast);
  if (errors.length > 0) throw new DSLError(errors);

  // 4. Interpret - timeline aware
  const timeline = new Timeline();
  for (const node of ast.statements) {
    const shapes = interpret(node, timeline);

    // 5. Animate creation based on timeline
    for (const shape of shapes) {
      await timeline.scheduleCreation(shape, editor);
    }
  }
}
```

---

## UYGULAMA PLANI

### Faz 1: Temel DSL (1-2 hafta)
- [ ] Lexer ve Parser implementasyonu
- [ ] Temel komutlar: create, connect, group
- [ ] Akış diyagramı şablonları
- [ ] DSL Editör UI (Monaco)
- [ ] Hata gösterimi

### Faz 2: Çift Yönlü Dönüşüm (1 hafta)
- [ ] Shape → DSL generator
- [ ] Otomatik kod güncelleme
- [ ] Sync mekanizması

### Faz 3: Zaman Sistemi (1-2 hafta)
- [ ] Timeline veritabanı tablosu
- [ ] Event kayıt mekanizması
- [ ] Playback service
- [ ] Timeline UI bileşenleri

### Faz 4: Gelişmiş Özellikler (2+ hafta)
- [ ] Data binding (JSON/API)
- [ ] Chart oluşturma
- [ ] Template sistemi
- [ ] Export (video, GIF, SVG)

---

## ÖRNEK KULLANIM SENARYOLARI

### Senaryo 1: Akış Diyagramı

```tahta
// Sipariş İşleme Akışı
flow diagram "Siparis" {
  start "Başla" at (200, 50)

  process "Sipariş Al" at (200, 150)
  decision "Stok var mı?" at (200, 270)

  // Evet dalı
  process "Hazırla" at (350, 380)
  process "Kargola" at (350, 480)
  end "Tamamlandı" at (350, 580)

  // Hayır dalı
  process "Tedarik Et" at (50, 380)

  // Bağlantılar
  connect start -> "Sipariş Al"
  connect "Sipariş Al" -> decision
  connect decision -> "Hazırla" label "Evet"
  connect decision -> "Tedarik Et" label "Hayır"
  connect "Tedarik Et" -> decision
  connect "Hazırla" -> "Kargola"
  connect "Kargola" -> end
}
```

### Senaryo 2: Zaman Serisi Animasyon

```tahta
// 2024 Satış Grafiği - Animasyonlu
timeline animate duration 3s {

  at 0ms: create text "2024 Satış Raporu" at (400, 30) size xl

  at 500ms: sequence delay 200ms {
    create bar "Q1" at (100, 400) height 120 color "mavi" label "Q1: 120K"
    create bar "Q2" at (200, 400) height 180 color "yesil" label "Q2: 180K"
    create bar "Q3" at (300, 400) height 150 color "turuncu" label "Q3: 150K"
    create bar "Q4" at (400, 400) height 220 color "mor" label "Q4: 220K"
  }

  at 2s: create arrow trend from (100, 280) to (400, 180) {
    color: "kirmizi"
    label: "+83% büyüme"
  }

  at 2.5s: create note at (500, 200) {
    content: "Rekor yıl!"
    color: "yellow"
  }
}
```

### Senaryo 3: Organizasyon Şeması

```tahta
// Şirket organizasyonu
org chart "AcmeCorp" {
  ceo "Ahmet Yılmaz" {
    title: "CEO"
    avatar: "https://..."
  }

  under ceo {
    cto "Mehmet Demir" { title: "CTO" }
    cfo "Ayşe Kaya" { title: "CFO" }
    coo "Fatma Öz" { title: "COO" }
  }

  under cto {
    "Ali Veli" { title: "Yazılım Müdürü" }
    "Can Yücel" { title: "DevOps Müdürü" }
  }

  style {
    boxWidth: 180
    boxHeight: 80
    levelGap: 100
    siblingGap: 40
  }
}
```

---

## SONUÇ

**TahtaLang**, abeTahta projesini basit bir whiteboard'dan **programlanabilir, zamansal farkındalığa sahip, çift yönlü dönüşüm yapabilen** bir platforma dönüştürecek.

Bu yaklaşım:
1. **Tekrarlanabilirlik** - Aynı diyagramı tekrar oluşturmak için kodu çalıştır
2. **Versiyon Kontrolü** - DSL kodu Git'te saklanabilir
3. **Otomasyon** - API'den veri çekip otomatik grafik oluştur
4. **Eğitim** - Animasyonlu sunumlar için ideal
5. **İşbirliği** - Kod paylaşarak diyagram paylaş

---

*Belge Versiyonu: 1.0*
*Tarih: 22 Şubat 2026*
*Yazar: Claude Opus 4.5 + Adnan Kaba*
