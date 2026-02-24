# AbeTahta - Bütünlük ve Güçlendirme Planı

## MEVCUT DURUM ANALİZİ

### Güçlü Yanlar
- ✅ Modern stack (Next.js 15, Express 5, PostgreSQL 16)
- ✅ Monorepo yapısı (npm workspaces)
- ✅ JWT authentication sistemi
- ✅ tldraw entegrasyonu (çizim çalışıyor)
- ✅ Veritabanına kaydetme (tldraw_data JSONB)
- ✅ Claude AI endpoint'leri hazır
- ✅ Temel DSL parser var

### Zayıf Yanlar
- ❌ DSL çok ilkel (sadece koordinat bazlı)
- ❌ Zaman kaydı yok (timeline)
- ❌ Çift yönlü dönüşüm yok (canvas → kod)
- ❌ Semantic tipler eksik
- ❌ Realtime sync tam değil (Yjs hazır ama entegre değil)
- ❌ Playback basit (sadece opacity animasyonu)

---

## GÜÇLENDİRME HARİTASI

```
┌─────────────────────────────────────────────────────────────────┐
│                        AbeTahta 2.0                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│  │  TahtaLang  │   │  Timeline   │   │  Semantic   │          │
│  │   Engine    │◄──┤   Service   │◄──┤   Layer     │          │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│         │                 │                 │                  │
│         ▼                 ▼                 ▼                  │
│  ┌─────────────────────────────────────────────────────┐      │
│  │              Unified Shape Store                     │      │
│  │  (tldraw shapes + meta + timeline + semantics)      │      │
│  └──────────────────────────┬──────────────────────────┘      │
│                             │                                  │
│         ┌───────────────────┼───────────────────┐             │
│         ▼                   ▼                   ▼             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐         │
│  │   Canvas    │   │  Database   │   │   Export    │         │
│  │  (tldraw)   │   │ (PostgreSQL)│   │ (SVG/Video) │         │
│  └─────────────┘   └─────────────┘   └─────────────┘         │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## MODÜL DETAYLARI

### 1. TahtaLang Engine

**Amaç:** Deklaratif grafik dili ile şekil oluşturma

**Dosya Yapısı:**
```
packages/web/lib/tahta-lang/
├── core/
│   ├── lexer.ts           # Token üretici
│   ├── parser.ts          # AST oluşturucu
│   ├── ast.ts             # AST tipleri
│   └── errors.ts          # Hata tipleri
├── runtime/
│   ├── interpreter.ts     # AST → Shape
│   ├── generator.ts       # Shape → DSL
│   ├── context.ts         # Çalışma ortamı
│   └── stdlib.ts          # Standart fonksiyonlar
├── templates/
│   ├── flowchart.ts       # Akış diyagramı
│   ├── orgchart.ts        # Organizasyon şeması
│   ├── mindmap.ts         # Zihin haritası
│   ├── kanban.ts          # Kanban tahtası
│   └── timeline.ts        # Zaman çizelgesi
└── index.ts               # Public API
```

**API:**
```typescript
// Kullanım
import { TahtaLang } from '@/lib/tahta-lang';

const engine = new TahtaLang(editor);

// Parse & Execute
await engine.execute(`
  create Box "Test" at (100, 100) size (200, 80) {
    text: "Merhaba"
    color: "mavi"
  }
`);

// Generate from canvas
const code = engine.generate();
```

---

### 2. Timeline Service

**Amaç:** Her değişikliği zaman damgasıyla kaydetme

**Veritabanı:**
```sql
-- Her shape değişikliği
CREATE TABLE shape_events (
  id BIGSERIAL PRIMARY KEY,
  board_id UUID NOT NULL,
  shape_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(20) NOT NULL,  -- create, update, delete
  shape_data JSONB NOT NULL,         -- Tam shape verisi
  diff_data JSONB,                   -- Sadece değişen alanlar
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID,
  sequence_num BIGINT NOT NULL       -- Board içi sıra
);

-- Snapshot'lar (önemli anlar)
CREATE TABLE board_snapshots (
  id UUID PRIMARY KEY,
  board_id UUID NOT NULL,
  name VARCHAR(200),
  description TEXT,
  full_state JSONB NOT NULL,         -- Tam tahta durumu
  thumbnail_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
```

**API:**
```typescript
// packages/server/src/services/timeline.ts
class TimelineService {
  // Event kaydet
  async recordEvent(boardId: string, event: ShapeEvent): Promise<void>

  // Belirli ana git
  async rewindTo(boardId: string, timestamp: Date): Promise<BoardState>

  // İki an arasındaki değişiklikler
  async getEventsBetween(boardId: string, from: Date, to: Date): Promise<ShapeEvent[]>

  // Oynatma için event stream
  async *playback(boardId: string, speed: number): AsyncGenerator<ShapeEvent>
}
```

---

### 3. Semantic Layer

**Amaç:** Shape'lere anlam katma

**Tipler:**
```typescript
// Akış diyagramı semantiği
type FlowchartSemantics = {
  nodeType: 'start' | 'end' | 'process' | 'decision' | 'io' | 'connector'
  incoming: string[]    // Gelen bağlantı ID'leri
  outgoing: string[]    // Giden bağlantı ID'leri
  branchLabel?: string  // "Evet" / "Hayır"
}

// Organizasyon şeması semantiği
type OrgChartSemantics = {
  role: 'executive' | 'manager' | 'employee'
  department?: string
  reportsTo?: string    // Üst shape ID
  directReports: string[] // Alt shape ID'leri
}

// Kanban semantiği
type KanbanSemantics = {
  column: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  assignee?: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  dueDate?: Date
  labels: string[]
}
```

**Shape Meta Genişletme:**
```typescript
interface EnhancedShapeMeta {
  // Mevcut
  createdAt: string
  createdBy: string
  createdByName: string
  updatedAt: string

  // Yeni
  semanticType?: string           // 'flowchart' | 'orgchart' | 'kanban' | 'generic'
  semanticData?: object           // Tipe göre semantic bilgi
  dslSource?: string              // Bu shape'i oluşturan DSL satırı
  dslScriptId?: string            // Hangi script'ten geldi
  tags?: string[]                 // Etiketler
  linkedShapes?: string[]         // İlişkili shape'ler
}
```

---

### 4. Unified Shape Store

**Amaç:** tldraw, timeline ve semantic verileri birleştiren merkezi store

```typescript
// packages/web/store/shapes.ts
import { create } from 'zustand';

interface ShapeStore {
  // Shape data
  shapes: Map<string, EnhancedShape>

  // Timeline
  events: ShapeEvent[]
  currentTime: Date
  isPlaying: boolean
  playbackSpeed: number

  // Semantic
  semanticIndex: Map<string, string[]>  // type → shape IDs

  // Actions
  createShape(shape: EnhancedShape): void
  updateShape(id: string, updates: Partial<EnhancedShape>): void
  deleteShape(id: string): void

  // Timeline actions
  play(): void
  pause(): void
  seekTo(time: Date): void
  setSpeed(speed: number): void

  // Semantic actions
  setSemanticType(id: string, type: string, data: object): void
  findBySemanticType(type: string): EnhancedShape[]

  // DSL actions
  executeCode(code: string): Promise<void>
  generateCode(): string
}
```

---

## FRONTEND GÜNCELLEMELERİ

### Yeni UI Bileşenleri

```
components/
├── dsl/
│   ├── DSLEditor.tsx          # Monaco tabanlı editör
│   │   ├── Syntax highlighting
│   │   ├── Autocomplete
│   │   ├── Error underlining
│   │   └── Code folding
│   ├── DSLToolbar.tsx         # Run, Format, Examples
│   ├── DSLOutput.tsx          # Console output
│   └── DSLSplitView.tsx       # Editor + Canvas yan yana
│
├── timeline/
│   ├── TimelinePlayer.tsx     # Ana player bileşeni
│   │   ├── Play/Pause/Stop
│   │   ├── Speed control (0.5x, 1x, 2x, 4x)
│   │   ├── Progress bar
│   │   └── Time display
│   ├── TimelineTrack.tsx      # Shape event'leri görsel track
│   ├── TimelineMarker.tsx     # Snapshot/önemli an işaretçisi
│   └── TimelineExport.tsx     # GIF/MP4 export dialog
│
├── semantic/
│   ├── SemanticPanel.tsx      # Sağ panel - shape detayları
│   ├── SemanticTypeSelector.tsx
│   ├── SemanticRelationEditor.tsx
│   └── SemanticSearch.tsx     # Tip bazlı arama
│
└── toolbar/
    ├── MainToolbar.tsx        # Üst toolbar
    │   ├── DSL toggle
    │   ├── Timeline toggle
    │   ├── Semantic toggle
    │   └── Export menu
    └── QuickActions.tsx       # Hızlı template butonları
```

### Sayfa Güncellemeleri

**board/[id]/page.tsx:**
```tsx
export default function BoardPage() {
  const [view, setView] = useState<'canvas' | 'split' | 'code'>('canvas');
  const [showTimeline, setShowTimeline] = useState(false);
  const [showSemantic, setShowSemantic] = useState(false);

  return (
    <div className="h-screen flex flex-col">
      <MainToolbar
        view={view}
        onViewChange={setView}
        showTimeline={showTimeline}
        onTimelineToggle={() => setShowTimeline(!showTimeline)}
        showSemantic={showSemantic}
        onSemanticToggle={() => setShowSemantic(!showSemantic)}
      />

      <div className="flex-1 flex">
        {/* Sol: Canvas veya Split View */}
        <div className="flex-1">
          {view === 'canvas' && <TldrawCanvas />}
          {view === 'split' && <DSLSplitView />}
          {view === 'code' && <DSLEditor />}
        </div>

        {/* Sağ: Semantic Panel */}
        {showSemantic && <SemanticPanel />}
      </div>

      {/* Alt: Timeline */}
      {showTimeline && <TimelinePlayer />}
    </div>
  );
}
```

---

## BACKEND GÜNCELLEMELERİ

### Yeni Route'lar

```typescript
// packages/server/src/routes/dsl.ts
router.post('/parse', authenticate, parseDSL);
router.post('/execute', authenticate, executeDSL);
router.get('/generate/:boardId', authenticate, generateDSL);
router.get('/templates', getTemplates);
router.post('/templates', authenticate, saveTemplate);

// packages/server/src/routes/timeline.ts
router.get('/:boardId/events', authenticate, getEvents);
router.post('/:boardId/events', authenticate, recordEvent);
router.get('/:boardId/snapshots', authenticate, getSnapshots);
router.post('/:boardId/snapshots', authenticate, createSnapshot);
router.get('/:boardId/playback', authenticate, streamPlayback);  // SSE

// packages/server/src/routes/semantic.ts
router.get('/:boardId/shapes', authenticate, getSemanticShapes);
router.put('/shapes/:shapeId/semantic', authenticate, updateSemantic);
router.get('/:boardId/search', authenticate, searchBySemantic);
router.get('/:boardId/relations', authenticate, getRelations);
```

### Yeni Service'ler

```typescript
// packages/server/src/services/
├── dsl.service.ts        # DSL işlemleri
├── timeline.service.ts   # Timeline işlemleri
├── semantic.service.ts   # Semantic işlemleri
├── export.service.ts     # Export işlemleri (SVG, PNG, GIF)
└── template.service.ts   # Template yönetimi
```

---

## VERİTABANI MİGRASYONLARI

### Migration 001: DSL Scripts
```sql
-- 001_create_dsl_scripts.sql
CREATE TABLE dsl_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  run_count INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dsl_scripts_board ON dsl_scripts(board_id);
```

### Migration 002: Shape Events
```sql
-- 002_create_shape_events.sql
CREATE TABLE shape_events (
  id BIGSERIAL PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  shape_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('create', 'update', 'delete', 'move', 'resize', 'style')),
  shape_data JSONB NOT NULL,
  diff_data JSONB,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(100),
  sequence_num BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shape_events_board ON shape_events(board_id);
CREATE INDEX idx_shape_events_shape ON shape_events(shape_id);
CREATE INDEX idx_shape_events_time ON shape_events(created_at);
CREATE INDEX idx_shape_events_seq ON shape_events(board_id, sequence_num);
```

### Migration 003: Board Snapshots
```sql
-- 003_create_board_snapshots.sql
CREATE TABLE board_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(200),
  description TEXT,
  full_state JSONB NOT NULL,
  shape_count INTEGER,
  thumbnail_url VARCHAR(500),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_snapshots_board ON board_snapshots(board_id);
CREATE INDEX idx_snapshots_time ON board_snapshots(created_at);
```

### Migration 004: Semantic Fields
```sql
-- 004_add_semantic_fields.sql
ALTER TABLE elements ADD COLUMN semantic_type VARCHAR(50);
ALTER TABLE elements ADD COLUMN semantic_data JSONB DEFAULT '{}';
ALTER TABLE elements ADD COLUMN dsl_source TEXT;
ALTER TABLE elements ADD COLUMN dsl_script_id UUID REFERENCES dsl_scripts(id);
ALTER TABLE elements ADD COLUMN tags TEXT[] DEFAULT '{}';

CREATE INDEX idx_elements_semantic ON elements(semantic_type);
CREATE INDEX idx_elements_tags ON elements USING GIN(tags);
```

---

---

## 5. AI ENTEGRASYONU (Claude)

### Mevcut Durum
- `/api/claude/*` endpoint'leri hazır (7 endpoint)
- Backend'de Claude API key auth var
- Ama frontend'de AI paneli YOK

### Eklenecekler

**AI Panel Bileşeni:**
```
components/ai/
├── AIPanel.tsx           # Sağ panel - AI asistan
├── AIChat.tsx            # Sohbet arayüzü
├── AISuggestions.tsx     # Otomatik öneriler
├── AIActions.tsx         # Hızlı eylemler
└── AIHistory.tsx         # Geçmiş komutlar
```

**AI Özellikleri:**
```typescript
// AI Komutları
"Bu diyagramı analiz et"
"Eksik adımları öner"
"Akış diyagramını optimize et"
"Bu şekli açıkla"
"Benzer şablonlar öner"
"Hataları bul"
"Dokümantasyon oluştur"
```

**AI Panel UI:**
```tsx
<AIPanel>
  <AIChat
    onSendMessage={async (msg) => {
      const response = await api.post('/api/claude/board/:id/analyze', { prompt: msg });
      // AI yanıtını göster ve/veya canvas'a uygula
    }}
  />
  <AISuggestions shapes={selectedShapes} />
  <AIActions>
    <button>🔍 Analiz Et</button>
    <button>💡 Öner</button>
    <button>🎨 Otomatik Düzenle</button>
    <button>📝 Dokümante Et</button>
  </AIActions>
</AIPanel>
```

**Yeni API Endpoint'leri:**
```
POST /api/claude/board/:id/chat      # Serbest sohbet
POST /api/claude/board/:id/suggest   # Shape önerileri
POST /api/claude/board/:id/layout    # Otomatik düzenleme
POST /api/claude/board/:id/document  # Dokümantasyon üret
POST /api/claude/dsl/generate        # DSL kodu üret
POST /api/claude/dsl/explain         # DSL kodunu açıkla
```

---

## 6. REALTIME COLLABORATION (Çoklu Kullanıcı)

### Mevcut Durum
- Socket.IO sunucusu var (port 4001)
- Yjs ve y-websocket paketleri yüklü
- Ama canvas'ta sync YOK

### Mimari

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Kullanıcı  │     │  Kullanıcı  │     │  Kullanıcı  │
│      A      │     │      B      │     │      C      │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    WebSocket      │    WebSocket      │
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                   y-websocket Server                │
│                    (Port 4001)                      │
├─────────────────────────────────────────────────────┤
│                      Yjs Doc                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  Y.Map('shapes')     - Tüm shape'ler       │   │
│  │  Y.Map('awareness')  - Cursor pozisyonları │   │
│  │  Y.Array('history')  - Undo/redo stack     │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Bileşenler

**Collaboration Hook:**
```typescript
// packages/web/hooks/useCollaboration.ts
function useCollaboration(boardId: string, userId: string) {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);

  // Bağlantı kur
  useEffect(() => {
    const ydoc = new Y.Doc();
    const wsProvider = new WebsocketProvider(
      'ws://localhost:4001',
      `board-${boardId}`,
      ydoc
    );

    // Awareness (cursor takibi)
    wsProvider.awareness.setLocalState({
      id: odası,
      name: userName,
      color: userColor,
      cursor: null
    });

    // Peer değişikliklerini dinle
    wsProvider.awareness.on('change', () => {
      const states = Array.from(wsProvider.awareness.getStates().values());
      setPeers(states.filter(s => s.id !== userId));
    });

    return () => wsProvider.destroy();
  }, [boardId, userId]);

  return { doc, peers, awareness };
}
```

**Cursor Bileşeni:**
```tsx
// components/collaboration/RemoteCursors.tsx
function RemoteCursors({ peers }: { peers: Peer[] }) {
  return (
    <>
      {peers.map(peer => (
        <div
          key={peer.id}
          className="absolute pointer-events-none z-50"
          style={{
            left: peer.cursor?.x,
            top: peer.cursor?.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor SVG */}
          <svg width="24" height="24" style={{ color: peer.color }}>
            <path d="M0,0 L0,14 L4,10 L8,18 L10,17 L6,9 L12,9 Z" fill="currentColor" />
          </svg>
          {/* İsim etiketi */}
          <span
            className="absolute left-4 top-4 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap"
            style={{ backgroundColor: peer.color }}
          >
            {peer.name}
          </span>
        </div>
      ))}
    </>
  );
}
```

**Presence Paneli:**
```tsx
// components/collaboration/PresencePanel.tsx
function PresencePanel({ peers }: { peers: Peer[] }) {
  return (
    <div className="absolute top-2 right-2 flex -space-x-2">
      {peers.map(peer => (
        <div
          key={peer.id}
          className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-medium"
          style={{ backgroundColor: peer.color }}
          title={peer.name}
        >
          {peer.name.charAt(0).toUpperCase()}
        </div>
      ))}
      <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs">
        +{peers.length}
      </div>
    </div>
  );
}
```

### Sync Stratejisi

**CRDT (Conflict-free Replicated Data Type):**
```typescript
// Shape ekleme - çakışma olmaz
yShapes.set(shapeId, shapeData);

// Shape güncelleme - son yazan kazanır + merge
yShapes.get(shapeId).set('x', newX);
yShapes.get(shapeId).set('y', newY);

// Shape silme - tombstone
yShapes.delete(shapeId);
```

**Undo/Redo:**
```typescript
const undoManager = new Y.UndoManager(yShapes, {
  trackedOrigins: new Set([provider.doc.clientID])
});

// Undo
undoManager.undo();

// Redo
undoManager.redo();
```

---

## UYGULAMA TAKVİMİ (Güncellenmiş)

### Hafta 1: Temel Altyapı
- [ ] Veritabanı migration'ları
- [ ] Timeline service (backend)
- [ ] Shape event kayıt mekanizması
- [ ] Temel API endpoint'leri

### Hafta 2: TahtaLang v2
- [ ] Yeni lexer/parser
- [ ] Gelişmiş AST yapısı
- [ ] Template sistemi (flowchart, orgchart)
- [ ] Çift yönlü dönüşüm

### Hafta 3: Timeline UI
- [ ] TimelinePlayer komponenti
- [ ] Playback kontrolları
- [ ] Snapshot yönetimi
- [ ] Event visualization

### Hafta 4: Semantic Layer
- [ ] SemanticPanel komponenti
- [ ] Tip seçici ve ilişki editörü
- [ ] Semantic search
- [ ] Auto-detection

### Hafta 5: Entegrasyon & Polish
- [ ] DSL Editor (Monaco)
- [ ] Split view modu
- [ ] Export özellikleri
- [ ] Performans optimizasyonu
- [ ] Dokümantasyon

---

## BAŞARI KRİTERLERİ

### Fonksiyonel
- [ ] DSL kodu yazarak diyagram oluşturabilmeli
- [ ] Canvas'ta çizilen her şey DSL koduna dönüşmeli
- [ ] Timeline slider ile geçmişe gidebilmeli
- [ ] Oynat butonuyla animasyon izlenebilmeli
- [ ] Semantic tip atanabilmeli ve aranabilmeli

### Performans
- [ ] 1000+ shape'li tahtada <100ms render
- [ ] Timeline playback 60fps
- [ ] DSL parse <50ms

### Kullanılabilirlik
- [ ] DSL syntax highlighting
- [ ] Autocomplete önerileri
- [ ] Anlamlı hata mesajları
- [ ] Örnek şablonlar

---

## KAYNAKLAR

- [Mirage.js Documentation](https://miragejs.com/)
- [D3.js Timeline](https://d3js.org/)
- [GraphQL SDL](https://graphql.org/learn/schema/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [tldraw Documentation](https://tldraw.dev/)

---

*Plan Versiyonu: 1.0*
*Tarih: 22 Şubat 2026*
*Durum: ONAY BEKLİYOR*
