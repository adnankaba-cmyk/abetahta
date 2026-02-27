/**
 * DSL v2 birim testleri
 *
 * Parser, Resolver ve isDslV2 fonksiyonlari test edilir.
 * Executor tldraw Editor gerektirdigi icin mock ile test edilir.
 * Layout engine saf matematik fonksiyonlari oldugu icin dogrudan test edilir.
 */

import { describe, it, expect } from 'vitest';
import { parseDslV2 } from '../lib/dsl-v2/parser';
import { isDslV2 } from '../lib/dsl-v2';
import { ShapeRegistry, resolveRelativePosition } from '../lib/dsl-v2/resolver';
import { layoutRow, layoutColumn, layoutGrid } from '../lib/dsl-v2/layout-engine';

// ─── isDslV2 ────────────────────────────────────────────────

describe('isDslV2 — v2 komut tespiti', () => {
  it('SEKIL komutu v2 olarak algilar', () => {
    expect(isDslV2('SEKIL baslik rectangle 100,50 800,70 "Test"')).toBe(true);
  });

  it('BAG komutu v2 olarak algilar', () => {
    expect(isDslV2('BAG ok1 kutu1 -> kutu2 ""')).toBe(true);
  });

  it('ALTINA komutu v2 olarak algilar', () => {
    expect(isDslV2('ALTINA baslik 40')).toBe(true);
  });

  it('YANINA komutu v2 olarak algilar', () => {
    expect(isDslV2('YANINA sol 30')).toBe(true);
  });

  it('SATIR komutu v2 olarak algilar', () => {
    expect(isDslV2('SATIR 100,200 40 {')).toBe(true);
  });

  it('SUTUN komutu v2 olarak algilar', () => {
    expect(isDslV2('SUTUN 100,200 40 {')).toBe(true);
  });

  it('GRID komutu v2 olarak algilar', () => {
    expect(isDslV2('GRID 0,0 3 20 {')).toBe(true);
  });

  it('GRUPLA komutu v2 olarak algilar', () => {
    expect(isDslV2('GRUPLA a,b,c')).toBe(true);
  });

  it('v1 kodu v2 olarak algilamaz', () => {
    expect(isDslV2('KUTU 100,100 200,80 "Test"')).toBe(false);
  });

  it('bos kod v2 degildir', () => {
    expect(isDslV2('')).toBe(false);
  });

  it('normal metin v2 degildir', () => {
    expect(isDslV2('Bu normal bir metin')).toBe(false);
  });

  it('buyuk/kucuk harf farki yok', () => {
    expect(isDslV2('sekil k rectangle 0,0 100,50 "test"')).toBe(true);
  });
});

// ─── parseDslV2 — SEKIL ─────────────────────────────────────

describe('parseDslV2 — SEKIL komutu', () => {
  it('basit rectangle parse eder', () => {
    const result = parseDslV2('SEKIL k rectangle 100,200 300,80 "Merhaba"');
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
    const node = result.nodes[0];
    expect(node.kind).toBe('SHAPE');
    if (node.kind === 'SHAPE') {
      expect(node.name).toBe('k');
      expect(node.geo).toBe('rectangle');
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.w).toBe(300);
      expect(node.h).toBe(80);
      expect(node.text).toBe('Merhaba');
    }
  });

  it('props blogu ile parse eder', () => {
    const result = parseDslV2('SEKIL k ellipse 0,0 120,120 "Daire" { renk: blue, dolgu: solid }');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'SHAPE') {
      expect(node.props.renk).toBe('blue');
      expect(node.props.dolgu).toBe('solid');
    }
  });

  it('gecersiz geo tipinde hata uretir', () => {
    const result = parseDslV2('SEKIL k ucgen 0,0 100,100 "Test"');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.nodes).toHaveLength(0);
  });

  it('eksik parametre ile hata uretir', () => {
    const result = parseDslV2('SEKIL k');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('negatif koordinatlar ile calisir', () => {
    const result = parseDslV2('SEKIL k rectangle -100,-200 300,80 "Test"');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'SHAPE') {
      expect(node.x).toBe(-100);
      expect(node.y).toBe(-200);
    }
  });
});

// ─── parseDslV2 — NOT ───────────────────────────────────────

describe('parseDslV2 — NOT komutu', () => {
  it('basit not parse eder', () => {
    const result = parseDslV2('NOT n1 200,300 "Yapistirici not"');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('NOTE');
    if (node.kind === 'NOTE') {
      expect(node.name).toBe('n1');
      expect(node.x).toBe(200);
      expect(node.y).toBe(300);
      expect(node.text).toBe('Yapistirici not');
    }
  });

  it('renk props ile parse eder', () => {
    const result = parseDslV2('NOT n1 0,0 "Test" { renk: yellow }');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'NOTE') {
      expect(node.props.renk).toBe('yellow');
    }
  });
});

// ─── parseDslV2 — YAZI ──────────────────────────────────────

describe('parseDslV2 — YAZI komutu', () => {
  it('basit yazi parse eder', () => {
    const result = parseDslV2('YAZI t1 50,100 "Baslik"');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('TEXT');
    if (node.kind === 'TEXT') {
      expect(node.name).toBe('t1');
      expect(node.text).toBe('Baslik');
    }
  });

  it('boyut props ile parse eder', () => {
    const result = parseDslV2('YAZI t1 50,100 "Buyuk" { boyut: xl }');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'TEXT') {
      expect(node.props.boyut).toBe('xl');
    }
  });
});

// ─── parseDslV2 — CIZGI ─────────────────────────────────────

describe('parseDslV2 — CIZGI komutu', () => {
  it('iki nokta arasinda cizgi parse eder', () => {
    const result = parseDslV2('CIZGI c1 100,100 -- 300,200');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('LINE');
    if (node.kind === 'LINE') {
      expect(node.x1).toBe(100);
      expect(node.y1).toBe(100);
      expect(node.x2).toBe(300);
      expect(node.y2).toBe(200);
    }
  });
});

// ─── parseDslV2 — BAG ───────────────────────────────────────

describe('parseDslV2 — BAG komutu', () => {
  it('kaynak -> hedef ok parse eder', () => {
    const result = parseDslV2('BAG ok1 kutu1 -> kutu2 "etiket"');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('ARROW');
    if (node.kind === 'ARROW') {
      expect(node.fromName).toBe('kutu1');
      expect(node.toName).toBe('kutu2');
      expect(node.label).toBe('etiket');
    }
  });

  it('etiket olmadan parse eder', () => {
    const result = parseDslV2('BAG ok1 a -> b ""');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'ARROW') {
      expect(node.label).toBe('');
    }
  });
});

// ─── parseDslV2 — GRUPLA ────────────────────────────────────

describe('parseDslV2 — GRUPLA komutu', () => {
  it('uc ismi gruplar', () => {
    const result = parseDslV2('GRUPLA a,b,c');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('GROUP');
    if (node.kind === 'GROUP') {
      expect(node.names).toEqual(['a', 'b', 'c']);
    }
  });

  it('tek isimle hata verir', () => {
    const result = parseDslV2('GRUPLA a');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── parseDslV2 — ALTINA/YANINA ─────────────────────────────

describe('parseDslV2 — Goreceli konum komutlari', () => {
  it('ALTINA parse eder', () => {
    const result = parseDslV2('ALTINA baslik 40');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('RELATIVE');
    if (node.kind === 'RELATIVE') {
      expect(node.direction).toBe('below');
      expect(node.refName).toBe('baslik');
      expect(node.offset).toBe(40);
    }
  });

  it('YANINA parse eder', () => {
    const result = parseDslV2('YANINA sol 30');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'RELATIVE') {
      expect(node.direction).toBe('right');
      expect(node.refName).toBe('sol');
      expect(node.offset).toBe(30);
    }
  });

  it('USTUNE parse eder', () => {
    const result = parseDslV2('USTUNE alt 20');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'RELATIVE') {
      expect(node.direction).toBe('above');
    }
  });

  it('varsayilan offset 40 kullanilir', () => {
    const result = parseDslV2('ALTINA baslik');
    // Tek parametre bile calisabilir, offset=40 default
    const node = result.nodes[0];
    if (node && node.kind === 'RELATIVE') {
      expect(node.offset).toBe(40);
    }
  });
});

// ─── parseDslV2 — Coklu satir / yorum ───────────────────────

describe('parseDslV2 — Coklu satir ve yorumlar', () => {
  it('bos satirlari atlar', () => {
    const result = parseDslV2('\nSEKIL k rectangle 0,0 100,50 "Test"\n\n');
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('// yorum satirlarini atlar', () => {
    const result = parseDslV2('// Bu bir yorumdur\nSEKIL k rectangle 0,0 100,50 "Test"');
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('# yorum satirlarini atlar', () => {
    const result = parseDslV2('# yorum\nNOT n1 0,0 "Test"');
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(1);
  });

  it('bilinmeyen komut hata uretir', () => {
    const result = parseDslV2('BILINMEYEN_KOMUT bir seyler');
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('coklu gecerli komut parse eder', () => {
    const code = [
      'SEKIL baslik rectangle 100,50 800,70 "Baslik"',
      'ALTINA baslik 40',
      'SEKIL kutu1 rectangle 0,0 180,60 "Kutu 1"',
      'YANINA kutu1 30',
      'SEKIL kutu2 rectangle 0,0 180,60 "Kutu 2"',
      'BAG ok1 kutu1 -> kutu2 ""',
    ].join('\n');

    const result = parseDslV2(code);
    expect(result.errors).toHaveLength(0);
    expect(result.nodes).toHaveLength(6);
  });
});

// ─── ShapeRegistry ──────────────────────────────────────────

describe('ShapeRegistry — isimli sekil kayit/sorgu', () => {
  function makeId(n: string): string { return `shape:${n}` as any; }

  it('sekil kaydeder ve geri alir', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 100, y: 200, w: 150, h: 80 });
    const shape = reg.get('a');
    expect(shape).toBeDefined();
    expect(shape!.x).toBe(100);
    expect(shape!.y).toBe(200);
  });

  it('olmayan sekli undefined dondurur', () => {
    const reg = new ShapeRegistry();
    expect(reg.get('yok')).toBeUndefined();
  });

  it('has() dogru sonuc dondurur', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 0, y: 0, w: 100, h: 50 });
    expect(reg.has('a')).toBe(true);
    expect(reg.has('b')).toBe(false);
  });

  it('getLast() son kaydi dondurur', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 0, y: 0, w: 100, h: 50 });
    reg.register('b', { id: makeId('b') as any, name: 'b', x: 200, y: 0, w: 100, h: 50 });
    const last = reg.getLast();
    expect(last!.name).toBe('b');
  });

  it('bos registry getLast() undefined dondurur', () => {
    const reg = new ShapeRegistry();
    expect(reg.getLast()).toBeUndefined();
  });

  it('getByNames() birden fazla sekli dondurur', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 0, y: 0, w: 100, h: 50 });
    reg.register('b', { id: makeId('b') as any, name: 'b', x: 200, y: 0, w: 100, h: 50 });
    reg.register('c', { id: makeId('c') as any, name: 'c', x: 400, y: 0, w: 100, h: 50 });
    const shapes = reg.getByNames(['a', 'c']);
    expect(shapes).toHaveLength(2);
    expect(shapes.map(s => s.name)).toEqual(['a', 'c']);
  });

  it('getByNames() olmayan isimleri atlar', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 0, y: 0, w: 100, h: 50 });
    const shapes = reg.getByNames(['a', 'yok']);
    expect(shapes).toHaveLength(1);
  });

  it('getAllIds() tum id listesini dondurur', () => {
    const reg = new ShapeRegistry();
    reg.register('a', { id: makeId('a') as any, name: 'a', x: 0, y: 0, w: 100, h: 50 });
    reg.register('b', { id: makeId('b') as any, name: 'b', x: 0, y: 0, w: 100, h: 50 });
    expect(reg.getAllIds()).toHaveLength(2);
  });
});

// ─── resolveRelativePosition ────────────────────────────────

describe('resolveRelativePosition — goreceli konum hesaplama', () => {
  function makeRegistry(shapes: Array<{ name: string; x: number; y: number; w: number; h: number }>) {
    const reg = new ShapeRegistry();
    for (const s of shapes) {
      reg.register(s.name, { id: `shape:${s.name}` as any, ...s });
    }
    return reg;
  }

  it('below: referans altina yerlestir', () => {
    const reg = makeRegistry([{ name: 'a', x: 100, y: 50, w: 200, h: 80 }]);
    const pos = resolveRelativePosition({ direction: 'below', refName: 'a', offset: 20 }, reg, 150, 60);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(100);
    expect(pos!.y).toBe(50 + 80 + 20); // ref.y + ref.h + offset = 150
  });

  it('right: referans yanina yerlestir', () => {
    const reg = makeRegistry([{ name: 'a', x: 100, y: 50, w: 200, h: 80 }]);
    const pos = resolveRelativePosition({ direction: 'right', refName: 'a', offset: 30 }, reg, 150, 60);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(100 + 200 + 30); // ref.x + ref.w + offset = 330
    expect(pos!.y).toBe(50);
  });

  it('above: referans ustune yerlestir', () => {
    const reg = makeRegistry([{ name: 'a', x: 100, y: 200, w: 200, h: 80 }]);
    const pos = resolveRelativePosition({ direction: 'above', refName: 'a', offset: 10 }, reg, 150, 60);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBe(100);
    expect(pos!.y).toBe(200 - 60 - 10); // ref.y - nodeH - offset = 130
  });

  it('olmayan referans ile null dondurur', () => {
    const reg = makeRegistry([]);
    const pos = resolveRelativePosition({ direction: 'below', refName: 'yok', offset: 20 }, reg, 100, 50);
    expect(pos).toBeNull();
  });
});

// ─── Layout Engine ──────────────────────────────────────────

describe('layoutRow — yatay dizilim', () => {
  // Dikkat: layoutRow dikey ortalama yapar (maxH - s.h) / 2
  // maxH = max(50, 60, 40) = 60
  const shapes = [
    { id: 'a' as any, w: 100, h: 50 }, // dikey offset = (60-50)/2 = 5
    { id: 'b' as any, w: 150, h: 60 }, // dikey offset = (60-60)/2 = 0
    { id: 'c' as any, w: 80, h: 40 },  // dikey offset = (60-40)/2 = 10
  ];

  it('ilk sekil x baslangic koordinatinda, y ortalamali', () => {
    const positions = layoutRow(shapes, 50, 100, 20);
    expect(positions[0].x).toBe(50);
    // y = startY + (maxH - s.h) / 2 = 100 + (60-50)/2 = 105
    expect(positions[0].y).toBe(105);
  });

  it('her sekil oncekinin saginda', () => {
    const positions = layoutRow(shapes, 0, 0, 20);
    expect(positions[1].x).toBe(0 + 100 + 20); // a.w + gap = 120
    expect(positions[2].x).toBe(0 + 100 + 20 + 150 + 20); // 290
  });

  it('esit yukseklikte y sabit kalir', () => {
    // Tum sekiller ayni yukseklikte ise ortalama offset = 0
    const equalShapes = [
      { id: 'a' as any, w: 100, h: 60 },
      { id: 'b' as any, w: 150, h: 60 },
    ];
    const positions = layoutRow(equalShapes, 0, 200, 20);
    for (const p of positions) {
      expect(p.y).toBe(200); // offset yok
    }
  });

  it('bos dizi bos sonuc dondurur', () => {
    expect(layoutRow([], 0, 0, 20)).toHaveLength(0);
  });
});

describe('layoutColumn — dikey dizilim', () => {
  const shapes = [
    { id: 'a' as any, w: 100, h: 50 },
    { id: 'b' as any, w: 100, h: 60 },
    { id: 'c' as any, w: 100, h: 40 },
  ];

  it('ilk sekil baslangic koordinatinda', () => {
    const positions = layoutColumn(shapes, 100, 50, 20);
    expect(positions[0].x).toBe(100);
    expect(positions[0].y).toBe(50);
  });

  it('her sekil oncekinin altinda', () => {
    const positions = layoutColumn(shapes, 0, 0, 10);
    expect(positions[1].y).toBe(0 + 50 + 10); // a.h + gap = 60
    expect(positions[2].y).toBe(0 + 50 + 10 + 60 + 10); // 130
  });

  it('x koordinati sabit kalir', () => {
    const positions = layoutColumn(shapes, 300, 0, 10);
    for (const p of positions) {
      expect(p.x).toBe(300);
    }
  });
});

describe('layoutGrid — izgara dizilim', () => {
  const shapes = Array.from({ length: 6 }, (_, i) => ({
    id: `s${i}` as any,
    w: 100,
    h: 80,
  }));

  it('3 sutunlu grid dogru konumlanir', () => {
    const positions = layoutGrid(shapes, 0, 0, 3, 20);
    // Ilk satir: 0,1,2
    expect(positions[0]).toEqual({ x: 0, y: 0 });
    expect(positions[1]).toEqual({ x: 120, y: 0 }); // 100 + 20
    expect(positions[2]).toEqual({ x: 240, y: 0 });
    // Ikinci satir: 3,4,5
    expect(positions[3]).toEqual({ x: 0, y: 100 }); // 80 + 20
    expect(positions[4]).toEqual({ x: 120, y: 100 });
    expect(positions[5]).toEqual({ x: 240, y: 100 });
  });

  it('2 sutunlu grid 3 satir olusturur', () => {
    const positions = layoutGrid(shapes, 0, 0, 2, 10);
    expect(positions[0]).toEqual({ x: 0, y: 0 });
    expect(positions[1]).toEqual({ x: 110, y: 0 });
    expect(positions[2]).toEqual({ x: 0, y: 90 }); // 80 + 10
    expect(positions[3]).toEqual({ x: 110, y: 90 });
  });

  it('bos dizi bos sonuc dondurur', () => {
    expect(layoutGrid([], 0, 0, 3, 20)).toHaveLength(0);
  });
});

// ─── parseDslV2 — CERCEVE ───────────────────────────────────

describe('parseDslV2 — CERCEVE komutu', () => {
  it('cerceve parse eder', () => {
    const result = parseDslV2('CERCEVE f1 0,0 800,600 "Ana Cerceve"');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('FRAME');
    if (node.kind === 'FRAME') {
      expect(node.name).toBe('f1');
      expect(node.w).toBe(800);
      expect(node.h).toBe(600);
      expect(node.title).toBe('Ana Cerceve');
    }
  });

  it('baslik olmadan isim kullanir', () => {
    const result = parseDslV2('CERCEVE f1 0,0 400,300');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    if (node.kind === 'FRAME') {
      expect(node.title).toBe('f1');
    }
  });
});

// ─── parseDslV2 — RESIM ─────────────────────────────────────

describe('parseDslV2 — RESIM komutu', () => {
  it('url ile resim parse eder', () => {
    const result = parseDslV2('RESIM img1 100,200 400,300 https://example.com/image.png');
    expect(result.errors).toHaveLength(0);
    const node = result.nodes[0];
    expect(node.kind).toBe('IMAGE');
    if (node.kind === 'IMAGE') {
      expect(node.name).toBe('img1');
      expect(node.x).toBe(100);
      expect(node.y).toBe(200);
      expect(node.w).toBe(400);
      expect(node.h).toBe(300);
      expect(node.url).toBe('https://example.com/image.png');
    }
  });
});
