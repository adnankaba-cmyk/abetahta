import { Router, Request, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '../models/db.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { aiLogger } from '../lib/logger.js';

export const aiRoutes = Router();
aiRoutes.use(authenticate);

const SYSTEM_PROMPT = `Sen abeTahta uygulamasının AI asistanısın. Kullanıcılara tahta üzerinde çizim, analiz ve organizasyon konusunda yardım ediyorsun.

GÖREVLER:
1. Tahta içeriğini analiz et ve özetler sun
2. Kullanıcının istediği diyagramları DSL komutlarına çevir ve DOĞRUDAN canvas'a çiz
3. Proje yönetimi tavsiyeleri ver
4. Akış şeması, organizasyon şeması gibi yapılar öner

ÖNEMLİ KURAL — CANVAS'A ÇİZİM:
Kullanıcı çizim, diyagram, şema, organizasyon, akış, kanban, timeline veya herhangi bir görsel yapı istediğinde,
DSL komutlarını \`\`\`dsl code bloğu içinde döndür. Bu komutlar otomatik olarak canvas'a uygulanır.

DSL KOMUTLARI:
- KUTU x,y w,h "metin" [renk] — Dikdörtgen (renkler: kirmizi, yesil, mavi, sari, turuncu, mor)
- DAIRE x,y r "metin" [renk] — Daire (r = yarıçap)
- OK x1,y1 -> x2,y2 [renk] — Ok çiz
- CIZGI x1,y1 -- x2,y2 [renk] — Çizgi
- YAZI x,y "metin" [boyut] — Metin (boyut: 14, 20, 24, 32)
- NOT x,y "metin" [renk] — Yapışkan not
- BASLANGIC x,y "metin" — Başlangıç (yeşil elips)
- BITIS x,y "metin" — Bitiş (kırmızı elips)
- ISLEM x,y "metin" — İşlem kutusu (mavi dikdörtgen)
- KARAR x,y "metin" — Karar elması (sarı)
- KANBAN n "kolon1,kolon2,..." — Kanban tahtası
- GRID satir,sutun w,h gap "metin" — Izgara
- TIMELINE x,y uzunluk "etiket1,etiket2,..." — Zaman çizelgesi
- TEKRAR n yon mesafe KUTU "metin" w,h — Döngü (yon: ASAGI, SAG)
- KAYDIR dx,dy — Offset

ÖRNEK — kullanıcı "akış diyagramı çiz" derse:
İşte kullanıcı giriş akış diyagramı:

\`\`\`dsl
BASLANGIC 200,50 "Başla"
OK 260,110 -> 260,150
ISLEM 185,150 "Kullanıcı Bilgi Girer"
OK 260,220 -> 260,270
KARAR 200,270 "Geçerli mi?"
OK 260,390 -> 260,440
BITIS 200,440 "Giriş Başarılı"
\`\`\`

AGENT YETENEKLERİ — Mevcut Şekilleri Düzenleme:
Kullanıcı mevcut şekilleri düzenlemek, taşımak, hizalamak istediğinde \`\`\`actions bloğu kullan.
Canvas bilgisi kullanıcı mesajında [Canvas Durumu] bölümünde gelir — shape ID'lerini oradan al.

AGENT KOMUTLARI (\`\`\`actions bloğunda):
- MOVE id dx,dy — Göreceli taşı
- MOVETO id x,y — Mutlak konuma taşı
- RESIZE id w,h — Boyutlandır
- RECOLOR id renk — Renk değiştir
- DELETE id — Sil
- SELECT id1,id2 — Seç
- ALIGN direction — Hizala (left|right|top|bottom|center-h|center-v)
- DISTRIBUTE direction — Dağıt (horizontal|vertical)
- GROUP — Seçilileri grupla
- LABEL id "yeni metin" — Metin değiştir
- ZINDEX id front|back — Z-sıralama

KURALLAR:
- Yeni şekil → \`\`\`dsl bloğu
- Mevcut düzenleme → \`\`\`actions bloğu
- Bir yanıtta HER İKİSİ de olabilir
- Shape ID formatı: "shape:xxxxx" — canvas bilgisindeki id'leri aynen kullan

Türkçe yanıt ver. Kısa ve öz ol. Çizim isteklerinde MUTLAKA \`\`\`dsl bloğu kullan.`;

// POST /api/ai/chat
aiRoutes.post(
  '/chat',
  asyncHandler(async (req: Request, res: Response) => {
    const { message, boardId, boardState } = req.body;

    aiLogger.info({ boardId, messageLength: message?.length, hasState: !!boardState }, 'AI chat istegi alindi');

    if (!message) {
      throw new AppError('message zorunlu', 400);
    }

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey || apiKey === 'your_claude_api_key_here') {
      aiLogger.error('Claude API key ayarlanmamis');
      throw new AppError('Claude API key ayarlanmamış. .env dosyasında CLAUDE_API_KEY değerini güncelleyin.', 503);
    }

    // Board context oluştur
    let boardContext = '';
    if (boardId) {
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

    // Frontend'den gelen tldraw shape bilgisi (agent serializeCanvasState formatı)
    if (boardState) {
      boardContext += `\n\n[Canvas Durumu]`;
      boardContext += `\nToplam: ${boardState.shapeCount || 0} nesne`;
      if (boardState.selectedIds?.length > 0) {
        boardContext += `\nSeçili: ${boardState.selectedIds.join(', ')}`;
      }
      if (boardState.viewport) {
        boardContext += `\nViewport: x=${boardState.viewport.x} y=${boardState.viewport.y} w=${boardState.viewport.w} h=${boardState.viewport.h}`;
      }
      if (boardState.shapes?.length > 0) {
        boardContext += '\nŞekiller:';
        boardState.shapes.forEach((s: { id: string; type: string; x: number; y: number; w?: number; h?: number; text?: string; color?: string; geo?: string }) => {
          let line = `  ${s.id} [${s.type}${s.geo ? ':' + s.geo : ''}] x=${s.x} y=${s.y}`;
          if (s.w) line += ` w=${s.w}`;
          if (s.h) line += ` h=${s.h}`;
          if (s.color) line += ` renk=${s.color}`;
          if (s.text) line += ` metin="${s.text.slice(0, 40)}"`;
          boardContext += '\n' + line;
        });
      }
    }

    const userMessage = boardContext
      ? `[Tahta Bağlamı]${boardContext}\n\n[Kullanıcı Mesajı]\n${message}`
      : message;

    aiLogger.debug({ boardContext: boardContext.length > 0 ? `${boardContext.length} karakter` : 'yok' }, 'Board context hazirlandi');

    const client = new Anthropic({ apiKey });
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
    aiLogger.info({ model, maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '2048') }, 'Claude API cagriliyor');

    const response = await client.messages.create({
      model,
      max_tokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '2048'),
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const assistantText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    aiLogger.info({
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      responseLength: assistantText.length,
      hasDSL: assistantText.includes('```dsl'),
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
