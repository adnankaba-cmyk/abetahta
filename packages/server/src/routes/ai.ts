import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import rateLimit from 'express-rate-limit';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { aiLogger } from '../lib/logger.js';

export const aiRoutes = Router();
aiRoutes.use(authenticate);

// AI API pahali — kullanici basina 20 istek / dakika
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI istek limiti asildi. 1 dakika sonra tekrar deneyin.' },
});

// ─── Prompt Modülleri ───────────────────────────────────────────

const PROMPT_BASE = `Sen abeTahta uygulamasının AI asistanısın. Türkçe yanıt ver. Kısa ve öz ol.
Çizim isteklerinde MUTLAKA \`\`\`dsl kod bloğu kullan. Açıklama metnini minimum tut — kod bloğu yeterli.

YASAK — bunları YAPMA:
- Kendi komut isimleri UYDURMA (CREATE_X, ADD_X, DRAW_X gibi komutlar YOK)
- Fonksiyon çağrısı formatı kullanma (ADD_NUCLEUS(), CREATE_CELL() gibi)
- Sadece aşağıda tanımlı DSL komutlarını kullan: SEKIL, NOT, YAZI, BAG, CIZGI, RESIM, CERCEVE, KUTU, DAIRE, OK, BASLANGIC, BITIS, ISLEM, KARAR
- \`\`\`dsl bloğu içinde SADECE DSL komutları olmalı. Madde işareti (•, -, *), açıklama cümlesi, başlık veya boş satır KOYMA
- Geçerli renkler SADECE: black, grey, red, light-red, blue, light-blue, green, light-green, yellow, orange, violet, light-violet, white`;

const PROMPT_DSL = `DSL KOMUTLARI (\`\`\`dsl bloğunda):
- KUTU x,y w,h "metin" [renk] — Dikdörtgen (alias: RECTANGLE, BOX)
- DAIRE x,y r "metin" [renk] — Daire (alias: CIRCLE, ELLIPSE)
- OK x1,y1 -> x2,y2 [renk] — Ok (alias: ARROW)
- CIZGI x1,y1 -- x2,y2 [renk] — Çizgi (alias: LINE)
- YAZI x,y "metin" [boyut] — Metin (alias: TEXT)
- NOT x,y "metin" [renk] — Yapışkan not (alias: NOTE)
- YILDIZ x,y r "metin" [renk] — Yıldız (alias: STAR)
- BASLANGIC x,y "metin" — Başlangıç (yeşil elips, alias: START)
- BITIS x,y "metin" — Bitiş (kırmızı elips, alias: END)
- ISLEM x,y "metin" — İşlem kutusu (mavi, alias: PROCESS)
- KARAR x,y "metin" — Karar elması (sarı, alias: DECISION)
Renkler: kirmizi/red yesil/green mavi/blue sari/yellow turuncu/orange mor/violet siyah/black

LİSTE/İÇERİK yazdırma:
- Birden fazla öğe istendiğinde her öğeyi ayrı NOT veya KUTU olarak yaz
- Öğeleri yatay veya dikey hizala, aralık 120-150px bırak
- Başlık için YAZI, öğeler için NOT veya KUTU kullan
Örnek: "kıtaları yaz" →
\`\`\`dsl
YAZI 300,100 "Dünya Kıtaları" 24
NOT 200,200 "Asya" sari
NOT 400,200 "Avrupa" mavi
NOT 600,200 "Afrika" turuncu
\`\`\``;

const PROMPT_DSL_V2 = `DSL v2 KOMUTLARI (\`\`\`dsl bloğunda):

SEKIL <ad> <tip> <x>,<y> <g>,<y> "metin" { ozellikler }
  tip: rectangle, ellipse, diamond, triangle, pentagon, hexagon, octagon,
       star, rhombus, oval, trapezoid, cloud, heart, x-box, check-box,
       arrow-right, arrow-left, arrow-up, arrow-down
  ozellikler: renk (SADECE: black|grey|red|light-red|blue|light-blue|green|light-green|yellow|orange|violet|light-violet|white — BASKA RENK YOK),
              dolgu (solid|semi|none), cizgi (solid|dashed|dotted|draw),
              boyut (s|m|l|xl), font (sans|serif|mono|draw), donme (0-360)

NOT <ad> <x>,<y> "metin" { renk: yellow }
YAZI <ad> <x>,<y> "metin" { boyut: xl, font: sans }
RESIM <ad> <x>,<y> <g>,<y> <url>
CERCEVE <ad> <x>,<y> <g>,<y> "baslik"
BAG <ad> <kaynak_ad> -> <hedef_ad> "etiket" { renk: black, cizgi: dashed }
CIZGI <ad> <x1>,<y1> -- <x2>,<y2> { cizgi: dashed }

GORECELI KONUM:
  ALTINA <ref_ad> <ofset>  — sonraki shape referans altina yerlesir
  YANINA <ref_ad> <ofset>  — sonraki shape referans yanina yerlesir

LAYOUT:
  SATIR <x>,<y> <aralik> { ... }     — Yatay dizilim
  SUTUN <x>,<y> <aralik> { ... }     — Dikey dizilim
  GRID <x>,<y> <sutun> <aralik> { ... }  — Izgara
  AKIS <x>,<y> <LR|TB> <aralik> { ... }  — Oklu akis

GRUPLA <ad1>,<ad2>,<ad3>

ONEMLI KURALLAR:
1. Her sekle benzersiz ad ver (Turkce/Ingilizce, bosluksuz)
2. BAG icin onceden tanimli sekil adlari kullan
3. Koordinatlar piksel. Standart: baslik 800x70, kutu 180x60, not 200x200
4. Mekansal analiz verilmisse bos bolgelere yerlestir
5. Mevcut icerikle cakismamaya dikkat et
6. Baslik ustte, icerik ortada, notlar altta, gorseller yanda olsun
7. DSL blogu icinde SADECE DSL komutlari yaz — aciklama metni, madde isareti, bos satir YASAK
8. Detayli bilgi NOT icine yaz (NOT seklinin metni birden fazla satir olabilir: \\n ile ayir)
9. Kullanici icerik verdiyse, o icerigi OLDUGU GIBI yerlestir — kendin bilgi EKLEME veya CIKARMA

ICERIK YERLESTIRME MODU:
Kullanici uzun bir metin/icerik verdiyse:
- Ana baslik: SEKIL ile buyuk rectangle (800x70, renk: blue)
- Alt basliklar: SEKIL ile orta rectangle (400x50, renk: light-blue)
- Her bilgi paragrafi: NOT ile (max 80 karakter, fazlasi \\n ile bol)
- Onemli terimler: SEKIL ile renkli kutular
- Iliskiler: BAG ile oklar
- ALTINA/YANINA kullanarak duzgunce hizala
- GRID veya SUTUN kullanarak duzgun layout olustur

Ornek — "Gunes Sistemi":
\`\`\`dsl
SEKIL baslik rectangle 100,50 800,70 "Gunes Sistemi" { renk: blue, dolgu: solid, boyut: xl }
ALTINA baslik 40
SEKIL gunes ellipse 0,0 120,120 "Gunes" { renk: orange, dolgu: solid }
YANINA gunes 30
SEKIL merkur ellipse 0,0 60,60 "Merkur" { renk: grey, dolgu: solid }
YANINA merkur 30
SEKIL venus ellipse 0,0 80,80 "Venus" { renk: orange, dolgu: semi }
ALTINA baslik 250
NOT n1 0,0 "Merkur: En kucuk gezegen\\nGunese en yakin\\n58 milyon km" { renk: grey }
YANINA n1 30
NOT n2 0,0 "Venus: En sicak gezegen\\nKalin atmosfer\\n108 milyon km" { renk: orange }
BAG b1 merkur -> n1 "" { cizgi: dashed }
BAG b2 venus -> n2 "" { cizgi: dashed }
\`\`\``;

const PROMPT_SPATIAL = `MEKANSAL FARKINDALIK:
Tahta durumu "Mekansal Analiz" bolumunde verilmistir.
- Bos Bolgeler listesinden uygun alani sec
- Mevcut nesnelerle cakismaktan kacin
- Ortalama aralik degerini kullanarak tutarli bosluk birak
- Viewport icinde kal
- Yeni icerik eklerken mevcut icerik yapisini bozma
- Baslik her zaman ustte, detaylar altta, gorseller yanda olsun
- Mevcut Nesneler listesindeki koordinatlari referans al`;

const PROMPT_MERMAID = `MERMAID (\`\`\`mermaid bloğunda):
Akış/süreç/organizasyon diyagramları için kullan. Otomatik layout yapar.
graph TD
  A[Başla] --> B{Karar?}
  B -->|Evet| C[İşlem]

NE ZAMAN HANGİSİ:
- İlişkisel yapılar → \`\`\`mermaid
- Hassas koordinat → \`\`\`dsl`;

const PROMPT_ACTIONS = `AGENT KOMUTLARI (\`\`\`actions bloğunda — mevcut şekilleri düzenle):
MOVE id dx,dy | MOVETO id x,y | RESIZE id w,h | RECOLOR id renk
DELETE id | SELECT id1,id2 | ALIGN direction | DISTRIBUTE direction
GROUP | LABEL id "metin" | ZINDEX id front|back
Shape ID formatı: "shape:xxxxx" — canvas bilgisindeki id'leri aynen kullan.`;

const PROMPT_ANALYZE = `Tahtayı analiz ederken:
- Şekil sayısı ve tiplerini belirt
- Yapısal önerilerde bulun, eksik bağlantıları tespit et
- İyileştirme önerileri sun`;

// Geriye uyumluluk: intent gelmezse tam prompt
const SYSTEM_PROMPT_FULL = [PROMPT_BASE, PROMPT_DSL, PROMPT_MERMAID, PROMPT_ACTIONS, PROMPT_ANALYZE].join('\n\n');

// ─── Dynamic Prompt Builder ─────────────────────────────────────

type AIIntent = 'DRAW_SIMPLE' | 'DRAW_COMPLEX' | 'DRAW_LAYOUT' | 'ACTION' | 'ANALYZE' | 'CHAT';

function isValidIntent(v: unknown): v is AIIntent {
  return typeof v === 'string' &&
    ['DRAW_SIMPLE', 'DRAW_COMPLEX', 'DRAW_LAYOUT', 'ACTION', 'ANALYZE', 'CHAT'].includes(v);
}

function buildSystemPrompt(intent: AIIntent): string {
  switch (intent) {
    case 'DRAW_LAYOUT':
      return [PROMPT_BASE, PROMPT_DSL_V2, PROMPT_SPATIAL].join('\n\n');
    case 'DRAW_COMPLEX':
      return [PROMPT_BASE, PROMPT_DSL_V2].join('\n\n');
    case 'DRAW_SIMPLE':
      return [PROMPT_BASE, PROMPT_DSL_V2].join('\n\n');
    case 'ACTION':
      return [PROMPT_BASE, PROMPT_ACTIONS].join('\n\n');
    case 'ANALYZE':
      return [PROMPT_BASE, PROMPT_ANALYZE, PROMPT_SPATIAL].join('\n\n');
    case 'CHAT':
      return PROMPT_BASE;
    default:
      return SYSTEM_PROMPT_FULL;
  }
}

// ─── Board Context Builder ──────────────────────────────────────

interface ShapeInfo {
  id: string; type: string; x: number; y: number;
  w?: number; h?: number; text?: string; color?: string; geo?: string;
  meta?: { source?: string; label?: string; texts?: string[] };
}

interface BoardState {
  shapeCount?: number;
  selectedIds?: string[];
  viewport?: { x: number; y: number; w: number; h: number };
  shapes?: ShapeInfo[];
  summary?: { byType: Record<string, number>; totalText: number };
}

function buildBoardContext(boardState: BoardState): string {
  let ctx = `\n\n[Canvas Durumu]`;
  ctx += `\nToplam: ${boardState.shapeCount || 0} nesne`;

  if (boardState.selectedIds?.length) {
    ctx += `\nSeçili: ${boardState.selectedIds.join(', ')}`;
  }
  if (boardState.viewport) {
    const v = boardState.viewport;
    ctx += `\nViewport: x=${v.x} y=${v.y} w=${v.w} h=${v.h}`;
  }

  // Summary modu: sadece tip sayilari
  if (boardState.summary) {
    const s = boardState.summary;
    const types = Object.entries(s.byType).map(([t, c]) => `${c} ${t}`).join(', ');
    ctx += `\nİçerik: ${types}`;
    if (s.totalText > 0) ctx += ` (${s.totalText} metin içeren)`;
  }

  // Detayli shape listesi
  if (boardState.shapes?.length) {
    ctx += '\nŞekiller:';
    for (const s of boardState.shapes) {
      let line = `  ${s.id} [${s.type}${s.geo ? ':' + s.geo : ''}] x=${s.x} y=${s.y}`;
      if (s.w) line += ` w=${s.w}`;
      if (s.h) line += ` h=${s.h}`;
      if (s.color) line += ` renk=${s.color}`;
      if (s.text) line += ` metin="${s.text.slice(0, 40)}"`;
      if (s.meta?.source === 'drawio') {
        line += ` [draw.io`;
        if (s.meta.label) line += `: "${s.meta.label}"`;
        if (s.meta.texts?.length) line += ` | ${s.meta.texts.slice(0, 10).join(', ')}`;
        line += `]`;
      }
      ctx += '\n' + line;
    }
  }

  return ctx;
}

// ─── POST /api/ai/chat ─────────────────────────────────────────

aiRoutes.post(
  '/chat',
  aiLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { message, boardId, boardState, spatialText, intent: rawIntent } = req.body;
    const intent: AIIntent | null = isValidIntent(rawIntent) ? rawIntent : null;

    aiLogger.info({ boardId, intent, messageLength: message?.length }, 'AI chat istegi alindi');

    if (!message) {
      throw new AppError('message zorunlu', 400);
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || apiKey === 'your_claude_api_key_here') {
      aiLogger.error('Claude API key ayarlanmamis');
      throw new AppError('Claude API key ayarlanmamış. .env dosyasında CLAUDE_API_KEY değerini güncelleyin.', 503);
    }

    // Board context — CHAT intent'inde DB sorgusu atla
    let boardContext = '';
    if (boardId && intent !== 'CHAT') {
      try {
        const board = await db.query('SELECT name, description FROM boards WHERE id = $1', [boardId]);
        if (board.rows.length > 0) {
          boardContext += `\nTahta: "${board.rows[0].name}"`;
          if (board.rows[0].description) {
            boardContext += ` — ${board.rows[0].description}`;
          }
        }

        const elements = await db.query(
          `SELECT type, COUNT(*) as count FROM elements WHERE board_id = $1 GROUP BY type`,
          [boardId]
        );
        if (elements.rows.length > 0) {
          boardContext += '\nTahta içeriği: ' + elements.rows.map((r: { count: number; type: string }) => `${r.count} ${r.type}`).join(', ');
        }
      } catch {
        // DB hatası olursa context olmadan devam et
      }
    }

    // Frontend'den gelen akıllı canvas state
    if (boardState && intent !== 'CHAT') {
      boardContext += buildBoardContext(boardState);
    }

    // Mekansal analiz verisi (DRAW_LAYOUT ve ANALYZE icin)
    if (spatialText && typeof spatialText === 'string') {
      boardContext += '\n\n' + spatialText;
    }

    const userMessage = boardContext
      ? `[Tahta Bağlamı]${boardContext}\n\n[Kullanıcı Mesajı]\n${message}`
      : message;

    // Dinamik prompt seç
    const systemPrompt = intent ? buildSystemPrompt(intent) : SYSTEM_PROMPT_FULL;

    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6-20250514';

    aiLogger.info({ model, intent: intent || 'full', promptSize: systemPrompt.length }, 'Claude API cagriliyor');

    const response = await client.messages.create({
      model,
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '2048'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const assistantText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    aiLogger.info({
      intent: intent || 'full',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      responseLength: assistantText.length,
      hasDSL: assistantText.includes('```dsl'),
      hasMermaid: assistantText.includes('```mermaid'),
      hasActions: assistantText.includes('```actions'),
    }, 'Claude yanit dondu');

    res.json({
      response: assistantText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  })
);
