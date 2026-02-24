/**
 * Mermaid.js SVG Renderer (v10 - Pure SVG)
 *
 * Mermaid kodunu mermaid.js ile SVG'ye render eder.
 * Layout tamamen mermaid.js'e birakilir — parse/extract yok.
 */

'use client';

import mermaid from 'mermaid';
import { aiLog } from './logger';

/** Client-side singleton — SSR'da mermaid calistirilmaz */
let initialized = false;

function ensureInit() {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
    flowchart: {
      useMaxWidth: false,
      htmlLabels: true,
      curve: 'basis',
      padding: 15,
      nodeSpacing: 50,
      rankSpacing: 80,
    },
  });
  initialized = true;
}

// ─── Tipler ───

export interface MermaidSVGResult {
  svg: string | null;
  error?: string;
}

/**
 * Mermaid kodunu SVG'ye render eder.
 * Tum layout mermaid.js tarafindan yapilir — biz sadece SVG string aliriz.
 */
export async function renderMermaidSVG(code: string): Promise<MermaidSVGResult> {
  ensureInit();

  if (typeof window === 'undefined') {
    return { svg: null, error: 'SSR ortaminda mermaid render edilemez' };
  }

  try {
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { svg } = await mermaid.render(id, code);

    aiLog.info('Mermaid SVG render basarili, uzunluk:', svg.length);
    return { svg };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    aiLog.error('Mermaid render hatasi:', msg);
    return { svg: null, error: msg };
  }
}

// ─── Ornekler ───

export const MERMAID_EXAMPLES = {
  flowchart: `graph TD
  A[Basla] --> B{Karar?}
  B -->|Evet| C[Islem Yap]
  B -->|Hayir| D[Kontrol]
  C --> E[Bitir]
  D --> B`,

  login: `graph TD
  START[Giris Sayfasi] --> INPUT[Kullanici Bilgileri]
  INPUT --> CHECK{Dogrulama}
  CHECK -->|Basarili| DASH[Dashboard]
  CHECK -->|Hatali| ERR[Hata Mesaji]
  ERR --> INPUT
  DASH --> END[Oturum Acik]`,

  process: `graph LR
  SIP[Siparis Al] --> STOK{Stok Kontrol}
  STOK -->|Var| HAZIRLAMA[Hazirlama]
  STOK -->|Yok| TEDARIK[Tedarik]
  TEDARIK --> HAZIRLAMA
  HAZIRLAMA --> KARGO[Kargoya Ver]
  KARGO --> TESLIM[Teslim Edildi]`,

  database: `graph TD
  APP[Uygulama] --> API[API Katmani]
  API --> AUTH{Yetki Kontrol}
  AUTH -->|Yetkili| DB[(Veritabani)]
  AUTH -->|Yetkisiz| ERR[403 Hata]
  DB --> CACHE[(Onbellek)]
  CACHE --> API`,

  devops: `graph LR
  DEV[Gelistirici] --> GIT[Git Push]
  GIT --> CI[CI Build]
  CI --> TEST[Test]
  TEST -->|Basarili| STAGE[Staging]
  TEST -->|Basarisiz| DEV
  STAGE --> PROD[Production]`,

  orgChart: `graph TD
  CEO[CEO] --> CTO[Teknoloji]
  CEO --> CMO[Pazarlama]
  CEO --> CFO[Finans]
  CTO --> DEV[Gelistirme]
  CTO --> OPS[Operasyon]
  CMO --> DIG[Dijital]
  CMO --> PR[Halkla Iliski]`,

  errorHandling: `graph TD
  REQ[Istek] --> TRY{Dene}
  TRY -->|Basarili| RES[Yanit]
  TRY -->|Hata| CATCH[Yakala]
  CATCH --> LOG[Logla]
  LOG --> RETRY{Tekrar?}
  RETRY -->|Evet| TRY
  RETRY -->|Hayir| ERR[Hata Yaniti]`,

  microservices: `graph LR
  GW((API Gateway)) --> USR[Kullanici Servisi]
  GW --> ORD[Siparis Servisi]
  GW --> PAY[Odeme Servisi]
  USR --> DB1[(Kullanici DB)]
  ORD --> DB2[(Siparis DB)]
  PAY --> DB3[(Odeme DB)]
  ORD --> PAY`,

  stateFlow: `graph LR
  IDLE[Bosta] --> LOAD[Yukleniyor]
  LOAD --> OK[Basarili]
  LOAD --> ERR[Hata]
  ERR --> LOAD
  OK --> IDLE
  ERR --> IDLE`,
};
