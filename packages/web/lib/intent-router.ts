/**
 * Intent Router — AI chat mesajlarını yerel olarak sınıflandırır.
 * Basit istekler AI'a gitmeden yerel olarak çözülür → token tasarrufu.
 */

import type { ContextStrategy } from './ai-agent';

// ─── Types ──────────────────────────────────────────────────────

export type IntentType =
  | 'DRAW_SIMPLE'    // Yerel DSL, API yok
  | 'DRAW_COMPLEX'   // AI + DSL/Mermaid prompt
  | 'DRAW_LAYOUT'    // AI + DSL v2 + mekansal farkindalik
  | 'ACTION'         // AI + actions prompt + seçili şekiller
  | 'ANALYZE'        // AI + analiz prompt + özet
  | 'TEMPLATE'       // Şablona yönlendir, API yok
  | 'CHAT';          // AI + minimum prompt, shape yok

export interface IntentResult {
  type: IntentType;
  contextStrategy: ContextStrategy;
  params?: {
    shapeType?: string;
    color?: string;
    text?: string;
    templateId?: string;
    size?: 'normal' | 'buyuk' | 'kucuk';
  };
}

// ─── Pattern Tables ─────────────────────────────────────────────

// Şablon eşleştirme (en yüksek öncelik)
const TEMPLATE_PATTERNS: Array<[RegExp, string]> = [
  [/\bkanban\b/i, 'kanban'],
  [/\bswot\b/i, 'swot'],
  [/\borg(anizasyon)?\s*(şeması|semasi|chart)\b/i, 'org-chart'],
  [/\b(mindmap|zihin\s*harita(sı|si))\b/i, 'mindmap'],
  [/\b(timeline|zaman\s*çizelge(si)?)\b/i, 'timeline'],
  [/\b(user.?journey|kullanıcı\s*yolculu(ğu|gu))\b/i, 'user-journey'],
  [/\b(toplantı|meeting)\s*(not(ları|lari)?)\b/i, 'meeting-notes'],
];

// Action kalıpları (seçili shape varken)
const ACTION_KEYWORDS = /\b(taşı|tasi|move|sil|delete|kaldır|kaldir|boyutlandır|boyutlandir|resize|renk\s*(değiştir|degistir)|recolor|hizala|align|dağıt|dagit|distribute|grupla|group|seç|sec|select)\b/i;

// Basit çizim (tam mesaj basit bir şekil isteği)
const SIMPLE_DRAW_RE = /^(bir\s+)?(büyük\s+|küçük\s+|kucuk\s+|buyuk\s+)?(kırmızı|kirmizi|mavi|yeşil|yesil|sarı|sari|turuncu|mor|siyah|beyaz|gri)?\s*(kutu|kare|dikdörtgen|daire|çember|cember|not|yapışkan|yapiskan|metin|yazı|yazi|box|rectangle|circle|square|note|text)\s*(çiz|ciz|ekle|oluştur|olustur|yap|koy)?\s*$/i;

// Canvas'a içerik yazma/ekleme
const CANVAS_WRITE_KEYWORDS = /(?:tahtaya|canvas'?a|board'?a)\s*(yaz|ekle|koy|çiz|ciz|oluştur|olustur|listele|sırala|sirala)|(?:yaz|ekle|koy|listele|sırala|sirala)\s*(?:tahtaya|canvas'?a|board'?a)/i;

// İçerik oluşturma: "notlar halinde yaz", "liste olarak ekle", "kartlara yaz" vb.
const CONTENT_CREATE_KEYWORDS = /\b(notlar?\s*(halinde|olarak)|liste\s*(halinde|olarak)|kartlar?\s*(halinde|olarak)|kutular?\s*(halinde|olarak))\s*(yaz|ekle|oluştur|olustur|çiz|ciz|koy)\b/i;

// Sondaki "listele/sırala" → her zaman canvas yazma amacı taşır
const TRAILING_LIST_KEYWORDS = /\b(listele|sırala|sirala)\s*$/i;

// Türkçe çoğul/belirtme eki + canvas fiili: "ilçelerini yaz", "isimlerini ekle", "gezegenlerini listele"
const TRAILING_CREATE_KEYWORDS = /\w+(leri|ları|lerini|larını|ini|ını|ünü|unu|sini|sını|sünü|sunu)\s+(yaz|ekle|oluştur|olustur|listele|sırala|sirala)\s*$/i;

// Layout/yerleştirme (mekansal farkindalik gerektiren zengin icerik)
const LAYOUT_KEYWORDS = /\b(yerleştir|yerlestir|düzenle|duzenle|dizayn\s*et|tasarla|ders\s*içeri[gğ]i|poster\s*(yap|oluştur|olustur|hazırla|hazirla)|sunum\s*(yap|oluştur|olustur|hazırla|hazirla)|sayfa\s*tasarla|resimlerle|görsellerle|gorsellerle|konu\s*anlat|infografi[kğ]|tahtaya\s*(yerleştir|yerlestir|dizayn|düzenle|duzenle))\b/i;

// Karmaşık çizim
const COMPLEX_DRAW_KEYWORDS = /\b(akış\s*diyagram|flowchart|diyagram\s*(çiz|ciz|oluştur|olustur|yap)|şema\s*(çiz|ciz|oluştur|olustur)|süreç|sequence|class\s*diagram|er\s*diagram|veri\s*modeli|mimari|architecture|network|ağ\s*topoloji|deployment)\b/i;

// Analiz — "analiz et" EVET ama "analiz tablosu çiz" HAYIR
const ANALYZE_KEYWORDS = /\b(özetle|ozetle|summarize|incele|review|tahta(yı|yi)?\s*(anlat|açıkla|acikla|analiz)|ne\s+var|neler\s+var|say|count|rapor|report)\b/i;
// "analiz" kelimesi tek basina veya "analiz et" formu — ama cizim fiili yoksa
const ANALYZE_WORD = /\banaliz\b/i;
// Çizim fiilleri — bunlarla birlikte gelen "analiz" DRAW_COMPLEX'e yönlenmeli
const DRAW_VERBS = /\b(çiz|ciz|oluştur|olustur|yap|ekle|koy)\b/i;

// ─── Color Extractor ────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  kirmizi: 'red', kırmızı: 'red', red: 'red',
  yesil: 'green', yeşil: 'green', green: 'green',
  mavi: 'blue', blue: 'blue',
  sari: 'yellow', sarı: 'yellow', yellow: 'yellow',
  turuncu: 'orange', orange: 'orange',
  mor: 'violet', violet: 'violet',
  siyah: 'black', black: 'black',
  gri: 'grey', grey: 'grey',
  beyaz: 'white', white: 'white',
};

function extractColor(msg: string): string | undefined {
  const lc = msg.toLowerCase();
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lc.includes(key)) return val;
  }
  return undefined;
}

// ─── Shape Type Extractor ───────────────────────────────────────

function extractShapeType(msg: string): string | undefined {
  const lc = msg.toLowerCase();
  if (/kutu|kare|dikdörtgen|box|rectangle|square/.test(lc)) return 'kutu';
  if (/daire|çember|cember|circle|oval/.test(lc)) return 'daire';
  if (/not|yapışkan|yapiskan|sticky|note/.test(lc)) return 'not';
  if (/metin|yazı|yazi|text/.test(lc)) return 'yazi';
  return undefined;
}

function extractSize(msg: string): 'buyuk' | 'kucuk' | 'normal' {
  const lc = msg.toLowerCase();
  if (/büyük|buyuk|large|big/.test(lc)) return 'buyuk';
  if (/küçük|kucuk|small|tiny/.test(lc)) return 'kucuk';
  return 'normal';
}

function extractQuotedText(msg: string): string | undefined {
  const m = /["'«]([^"'»]+)["'»]/.exec(msg);
  return m ? m[1] : undefined;
}

// Soru kalıpları — bunlar CHAT'e yönlendirilmeli, TEMPLATE'e değil
const QUESTION_RE = /\?\s*$|\b(nedir|ne\s*demek|nasıl|nasil|ne\s*işe\s*yarar|ne\s*ise\s*yarar|açıkla|acikla|anlat(?!\s*(?:tahtay|canvas))|neden|ne\s*zaman|hangi(si|leri)?|fark(ı|i)\s*ne|karşılaştır|karsilastir|karsılastır|karsilastir|önem(i|li)|onemi)\b/i;

// ─── Main Classifier ────────────────────────────────────────────

export function classifyIntent(
  message: string,
  hasSelectedShapes: boolean,
  shapeCount: number,
): IntentResult {
  const trimmed = message.trim();
  const isQuestion = QUESTION_RE.test(trimmed);

  // 1. Template eşleştirme (soru cümlelerinde atla)
  if (!isQuestion) {
    for (const [pattern, templateId] of TEMPLATE_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          type: 'TEMPLATE',
          contextStrategy: 'none',
          params: { templateId },
        };
      }
    }
  }

  // 2. Action (seçili shape varken)
  if (hasSelectedShapes && ACTION_KEYWORDS.test(trimmed)) {
    return { type: 'ACTION', contextStrategy: 'selected' };
  }

  // 3. Basit çizim (kısa, tek şekil)
  if (SIMPLE_DRAW_RE.test(trimmed)) {
    return {
      type: 'DRAW_SIMPLE',
      contextStrategy: 'none',
      params: {
        shapeType: extractShapeType(trimmed),
        color: extractColor(trimmed),
        text: extractQuotedText(trimmed),
        size: extractSize(trimmed),
      },
    };
  }

  // 3b. Layout/yerleştirme (mekansal farkindalik)
  if (LAYOUT_KEYWORDS.test(trimmed)) {
    return { type: 'DRAW_LAYOUT', contextStrategy: 'spatial' };
  }

  // 3c. Uzun icerik (150+ karakter) — kullanici icerik veriyor, AI yerlestirmeli
  if (trimmed.length > 150) {
    return { type: 'DRAW_LAYOUT', contextStrategy: 'spatial' };
  }

  // 4a. Canvas'a yazma (tahtaya yaz, ekle, listele)
  if (CANVAS_WRITE_KEYWORDS.test(trimmed)) {
    return { type: 'DRAW_COMPLEX', contextStrategy: 'viewport' };
  }

  // 4b. İçerik oluşturma (notlar halinde yaz, liste olarak ekle, Xlerini yaz, listele)
  if (CONTENT_CREATE_KEYWORDS.test(trimmed) || TRAILING_CREATE_KEYWORDS.test(trimmed) || TRAILING_LIST_KEYWORDS.test(trimmed)) {
    return { type: 'DRAW_COMPLEX', contextStrategy: 'viewport' };
  }

  // 4c. Karmaşık çizim
  if (COMPLEX_DRAW_KEYWORDS.test(trimmed)) {
    return { type: 'DRAW_COMPLEX', contextStrategy: 'viewport' };
  }

  // 5. Analiz — çizim fiiliyle birlikte geliyorsa DRAW_COMPLEX'e yönlendir
  if (ANALYZE_KEYWORDS.test(trimmed) || (ANALYZE_WORD.test(trimmed) && !DRAW_VERBS.test(trimmed))) {
    return { type: 'ANALYZE', contextStrategy: 'summary' };
  }

  // 6. Default: CHAT
  return { type: 'CHAT', contextStrategy: 'none' };
}

// ─── Local DSL Generator ────────────────────────────────────────

export function buildLocalDsl(
  params: IntentResult['params'],
  anchor?: { x: number; y: number } | null,
): string | null {
  if (!params?.shapeType) return null;

  const x = anchor?.x || 200;
  const y = anchor?.y || 200;
  const color = params.color ? ` ${Object.entries(COLOR_MAP).find(([, v]) => v === params.color)?.[0] || ''}` : '';
  const text = params.text || defaultText(params.shapeType);
  const sizeMultiplier = params.size === 'buyuk' ? 1.6 : params.size === 'kucuk' ? 0.7 : 1;

  switch (params.shapeType) {
    case 'kutu': {
      const w = Math.round(150 * sizeMultiplier);
      const h = Math.round(100 * sizeMultiplier);
      return `KUTU ${x},${y} ${w},${h} "${text}"${color}`;
    }
    case 'daire': {
      const r = Math.round(50 * sizeMultiplier);
      return `DAIRE ${x},${y} ${r} "${text}"${color}`;
    }
    case 'not':
      return `NOT ${x},${y} "${text}"${color || ' sari'}`;
    case 'yazi':
      return `YAZI ${x},${y} "${text}"`;
    default:
      return null;
  }
}

function defaultText(shapeType: string): string {
  switch (shapeType) {
    case 'kutu': return 'Kutu';
    case 'daire': return 'Daire';
    case 'not': return 'Not';
    case 'yazi': return 'Metin';
    default: return '';
  }
}
