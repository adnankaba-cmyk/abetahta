'use client';

import { useState } from 'react';
import { Editor, createShapeId } from 'tldraw';
import { toRichText } from '@tldraw/editor';

interface TemplatePanelProps {
  editor: Editor | null;
  isVisible: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

interface TemplateShape {
  type: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  geo?: string;
  color?: string;
  text?: string;
  endX?: number;
  endY?: number;
}

interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  shapes: TemplateShape[];
}

// Export: AI intent router'dan erişim için
export { type Template, type TemplateShape };

/**
 * Template ID ile şablonu bul ve editor'a uygula.
 * AIPanel intent router'dan çağrılır — API kullanmadan yerel şablon.
 */
export function applyTemplateById(editor: Editor, templateId: string): { applied: boolean; shapeCount: number; name: string } {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) return { applied: false, shapeCount: 0, name: '' };

  const now = new Date().toISOString();
  const viewportBounds = editor.getViewportScreenBounds();
  const camera = editor.getCamera();
  const centerX = (-camera.x + viewportBounds.w / 2 / camera.z);
  const centerY = (-camera.y + viewportBounds.h / 2 / camera.z);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  template.shapes.forEach(s => {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + (s.w || 100));
    maxY = Math.max(maxY, s.y + (s.h || 100));
  });
  const baseX = centerX - (maxX - minX) / 2 - minX;
  const baseY = centerY - (maxY - minY) / 2 - minY;

  let count = 0;
  for (const shape of template.shapes) {
    const id = createShapeId();
    if (shape.type === 'geo') {
      editor.createShape({
        id, type: 'geo',
        x: baseX + shape.x, y: baseY + shape.y,
        props: {
          geo: shape.geo || 'rectangle', w: shape.w || 100, h: shape.h || 60,
          fill: 'solid', color: shape.color || 'black', dash: 'draw', size: 'm',
          richText: shape.text ? toRichText(shape.text) : undefined,
        } as any,
        meta: { createdAt: now, template: template.id },
      });
      count++;
    } else if (shape.type === 'note') {
      editor.createShape({
        id, type: 'note',
        x: baseX + shape.x, y: baseY + shape.y,
        props: { color: shape.color || 'yellow', size: 'm', richText: shape.text ? toRichText(shape.text) : toRichText('') } as any,
        meta: { createdAt: now, template: template.id },
      });
      count++;
    } else if (shape.type === 'arrow') {
      editor.createShape({
        id, type: 'arrow',
        x: baseX + shape.x, y: baseY + shape.y,
        props: {
          start: { x: 0, y: 0 },
          end: { x: (shape.endX || shape.x + 50) - shape.x, y: (shape.endY || shape.y + 50) - shape.y },
          color: shape.color || 'black', arrowheadEnd: 'arrow', arrowheadStart: 'none',
        } as any,
        meta: { createdAt: now, template: template.id },
      });
      count++;
    }
  }

  return { applied: true, shapeCount: count, name: template.name };
}

export const TEMPLATES: Template[] = [
  {
    id: 'flowchart-basic',
    name: 'Temel Akis Diyagrami',
    icon: '📊',
    category: 'Diyagram',
    shapes: [
      { type: 'geo', geo: 'ellipse', x: 200, y: 50, w: 120, h: 60, color: 'green', text: 'Baslangic' },
      { type: 'geo', geo: 'rectangle', x: 200, y: 150, w: 120, h: 60, color: 'blue', text: 'Islem 1' },
      { type: 'geo', geo: 'diamond', x: 200, y: 250, w: 120, h: 80, color: 'yellow', text: 'Karar?' },
      { type: 'geo', geo: 'rectangle', x: 50, y: 370, w: 120, h: 60, color: 'blue', text: 'Evet' },
      { type: 'geo', geo: 'rectangle', x: 350, y: 370, w: 120, h: 60, color: 'blue', text: 'Hayir' },
      { type: 'geo', geo: 'ellipse', x: 200, y: 480, w: 120, h: 60, color: 'red', text: 'Bitis' },
      // Baglantilar (oklar)
      { type: 'arrow', x: 260, y: 110, endX: 260, endY: 150, color: 'black' }, // Baslangic -> Islem
      { type: 'arrow', x: 260, y: 210, endX: 260, endY: 250, color: 'black' }, // Islem -> Karar
      { type: 'arrow', x: 200, y: 290, endX: 110, endY: 370, color: 'black' }, // Karar -> Evet
      { type: 'arrow', x: 320, y: 290, endX: 410, endY: 370, color: 'black' }, // Karar -> Hayir
      { type: 'arrow', x: 110, y: 430, endX: 200, endY: 480, color: 'black' }, // Evet -> Bitis
      { type: 'arrow', x: 410, y: 430, endX: 320, endY: 480, color: 'black' }, // Hayir -> Bitis
    ]
  },
  {
    id: 'org-chart',
    name: 'Organizasyon Semasi',
    icon: '👥',
    category: 'Organizasyon',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 250, y: 50, w: 150, h: 70, color: 'violet', text: 'CEO' },
      { type: 'geo', geo: 'rectangle', x: 50, y: 170, w: 130, h: 60, color: 'blue', text: 'CTO' },
      { type: 'geo', geo: 'rectangle', x: 250, y: 170, w: 130, h: 60, color: 'green', text: 'CFO' },
      { type: 'geo', geo: 'rectangle', x: 450, y: 170, w: 130, h: 60, color: 'orange', text: 'CMO' },
      { type: 'geo', geo: 'rectangle', x: 0, y: 280, w: 100, h: 50, color: 'light-blue', text: 'Dev Team' },
      { type: 'geo', geo: 'rectangle', x: 120, y: 280, w: 100, h: 50, color: 'light-blue', text: 'QA Team' },
      { type: 'geo', geo: 'rectangle', x: 250, y: 280, w: 100, h: 50, color: 'light-green', text: 'Finans' },
      { type: 'geo', geo: 'rectangle', x: 450, y: 280, w: 100, h: 50, color: 'yellow', text: 'Marketing' },
      // Baglantilar
      { type: 'arrow', x: 325, y: 120, endX: 115, endY: 170, color: 'grey' }, // CEO -> CTO
      { type: 'arrow', x: 325, y: 120, endX: 315, endY: 170, color: 'grey' }, // CEO -> CFO
      { type: 'arrow', x: 325, y: 120, endX: 515, endY: 170, color: 'grey' }, // CEO -> CMO
      { type: 'arrow', x: 115, y: 230, endX: 50, endY: 280, color: 'grey' }, // CTO -> Dev
      { type: 'arrow', x: 115, y: 230, endX: 170, endY: 280, color: 'grey' }, // CTO -> QA
      { type: 'arrow', x: 315, y: 230, endX: 300, endY: 280, color: 'grey' }, // CFO -> Finans
      { type: 'arrow', x: 515, y: 230, endX: 500, endY: 280, color: 'grey' }, // CMO -> Marketing
    ]
  },
  {
    id: 'kanban',
    name: 'Kanban Tahtasi',
    icon: '📋',
    category: 'Proje',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 50, y: 50, w: 180, h: 40, color: 'grey', text: 'YAPILACAK' },
      { type: 'geo', geo: 'rectangle', x: 250, y: 50, w: 180, h: 40, color: 'grey', text: 'DEVAM EDEN' },
      { type: 'geo', geo: 'rectangle', x: 450, y: 50, w: 180, h: 40, color: 'grey', text: 'TAMAMLANDI' },
      { type: 'note', x: 60, y: 110, color: 'yellow', text: 'Gorev 1' },
      { type: 'note', x: 60, y: 220, color: 'yellow', text: 'Gorev 2' },
      { type: 'note', x: 260, y: 110, color: 'light-blue', text: 'Gorev 3' },
      { type: 'note', x: 460, y: 110, color: 'light-green', text: 'Gorev 4' },
      { type: 'note', x: 460, y: 220, color: 'light-green', text: 'Gorev 5' },
    ]
  },
  {
    id: 'swot',
    name: 'SWOT Analizi',
    icon: '🎯',
    category: 'Strateji',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 50, y: 50, w: 200, h: 150, color: 'green', text: 'GUCLUYONLER\n\n- Madde 1\n- Madde 2' },
      { type: 'geo', geo: 'rectangle', x: 270, y: 50, w: 200, h: 150, color: 'red', text: 'ZAYIF YONLER\n\n- Madde 1\n- Madde 2' },
      { type: 'geo', geo: 'rectangle', x: 50, y: 220, w: 200, h: 150, color: 'blue', text: 'FIRSATLAR\n\n- Madde 1\n- Madde 2' },
      { type: 'geo', geo: 'rectangle', x: 270, y: 220, w: 200, h: 150, color: 'orange', text: 'TEHDITLER\n\n- Madde 1\n- Madde 2' },
    ]
  },
  {
    id: 'timeline',
    name: 'Zaman Cizelgesi',
    icon: '📅',
    category: 'Planlama',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 50, y: 150, w: 600, h: 8, color: 'grey', text: '' },
      { type: 'geo', geo: 'ellipse', x: 50, y: 130, w: 50, h: 50, color: 'green', text: 'Q1' },
      { type: 'geo', geo: 'ellipse', x: 200, y: 130, w: 50, h: 50, color: 'blue', text: 'Q2' },
      { type: 'geo', geo: 'ellipse', x: 350, y: 130, w: 50, h: 50, color: 'orange', text: 'Q3' },
      { type: 'geo', geo: 'ellipse', x: 500, y: 130, w: 50, h: 50, color: 'red', text: 'Q4' },
      { type: 'note', x: 30, y: 200, color: 'light-green', text: 'Planlama\nArastirma' },
      { type: 'note', x: 180, y: 200, color: 'light-blue', text: 'Gelistirme\nTest' },
      { type: 'note', x: 330, y: 200, color: 'yellow', text: 'Beta\nLansman' },
      { type: 'note', x: 480, y: 200, color: 'light-red', text: 'Buyume\nOlcekleme' },
    ]
  },
  {
    id: 'mindmap',
    name: 'Zihin Haritasi',
    icon: '🧠',
    category: 'Dusunce',
    shapes: [
      { type: 'geo', geo: 'ellipse', x: 250, y: 200, w: 140, h: 80, color: 'violet', text: 'ANA FIKIR' },
      { type: 'geo', geo: 'ellipse', x: 50, y: 80, w: 100, h: 50, color: 'blue', text: 'Konu 1' },
      { type: 'geo', geo: 'ellipse', x: 450, y: 80, w: 100, h: 50, color: 'green', text: 'Konu 2' },
      { type: 'geo', geo: 'ellipse', x: 50, y: 320, w: 100, h: 50, color: 'orange', text: 'Konu 3' },
      { type: 'geo', geo: 'ellipse', x: 450, y: 320, w: 100, h: 50, color: 'red', text: 'Konu 4' },
      { type: 'note', x: 0, y: 150, color: 'light-blue', text: 'Alt konu' },
      { type: 'note', x: 500, y: 150, color: 'light-green', text: 'Alt konu' },
    ]
  },
  {
    id: 'user-journey',
    name: 'Kullanici Yolculugu',
    icon: '🚶',
    category: 'UX',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 50, y: 50, w: 120, h: 60, color: 'green', text: 'Kesfet' },
      { type: 'geo', geo: 'rectangle', x: 200, y: 50, w: 120, h: 60, color: 'blue', text: 'Degerlendir' },
      { type: 'geo', geo: 'rectangle', x: 350, y: 50, w: 120, h: 60, color: 'orange', text: 'Satin Al' },
      { type: 'geo', geo: 'rectangle', x: 500, y: 50, w: 120, h: 60, color: 'violet', text: 'Kullan' },
      { type: 'geo', geo: 'rectangle', x: 650, y: 50, w: 120, h: 60, color: 'red', text: 'Onerme' },
      { type: 'note', x: 50, y: 140, color: 'light-green', text: 'Reklam\nSosyal Medya' },
      { type: 'note', x: 200, y: 140, color: 'light-blue', text: 'Inceleme\nDemo' },
      { type: 'note', x: 350, y: 140, color: 'yellow', text: 'Odeme\nKayit' },
      { type: 'note', x: 500, y: 140, color: 'light-violet', text: 'Onboarding\nDestek' },
      { type: 'note', x: 650, y: 140, color: 'light-red', text: 'Referans\nPuan' },
    ]
  },
  {
    id: 'meeting-notes',
    name: 'Toplanti Notlari',
    icon: '📝',
    category: 'Toplanti',
    shapes: [
      { type: 'geo', geo: 'rectangle', x: 50, y: 30, w: 400, h: 50, color: 'blue', text: 'TOPLANTI: [Baslik]' },
      { type: 'geo', geo: 'rectangle', x: 50, y: 100, w: 180, h: 30, color: 'grey', text: 'Tarih: __/__/____' },
      { type: 'geo', geo: 'rectangle', x: 250, y: 100, w: 200, h: 30, color: 'grey', text: 'Katilimcilar:' },
      { type: 'note', x: 50, y: 160, color: 'yellow', text: 'GUNDEM\n\n1. Madde\n2. Madde\n3. Madde' },
      { type: 'note', x: 270, y: 160, color: 'light-blue', text: 'KARARLAR\n\n- Karar 1\n- Karar 2' },
      { type: 'note', x: 50, y: 340, color: 'light-green', text: 'AKSIYONLAR\n\n[ ] Gorev 1 - Sorumlu\n[ ] Gorev 2 - Sorumlu' },
      { type: 'note', x: 270, y: 340, color: 'light-red', text: 'SONRAKI ADIMLAR\n\n- Tarih:\n- Konu:' },
    ]
  }
];

const CATEGORIES = ['Tumu', 'Diyagram', 'Organizasyon', 'Proje', 'Strateji', 'Planlama', 'Dusunce', 'UX', 'Toplanti'];

export function TemplatePanel({ editor, isVisible, onClose, userId, userName }: TemplatePanelProps) {
  const [selectedCategory, setSelectedCategory] = useState('Tumu');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = TEMPLATES.filter(t => {
    const matchesCategory = selectedCategory === 'Tumu' || t.category === selectedCategory;
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const applyTemplate = (template: Template) => {
    if (!editor) return;

    const now = new Date().toISOString();

    // Viewport merkezini hesapla
    const viewportBounds = editor.getViewportScreenBounds();
    const camera = editor.getCamera();
    const centerX = (-camera.x + viewportBounds.w / 2 / camera.z);
    const centerY = (-camera.y + viewportBounds.h / 2 / camera.z);

    // Şablonun boyutlarını hesapla
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    template.shapes.forEach(s => {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x + (s.w || 100));
      maxY = Math.max(maxY, s.y + (s.h || 100));
    });
    const templateW = maxX - minX;
    const templateH = maxY - minY;

    // Şablonu merkeze yerleştir
    const baseX = centerX - templateW / 2 - minX;
    const baseY = centerY - templateH / 2 - minY;

    // Tüm şekilleri doğrudan oluştur — setTimeout yok (memory leak riski)
    template.shapes.forEach((shape) => {
        const id = createShapeId();
        if (shape.type === 'geo') {
          editor.createShape({
            id,
            type: 'geo',
            x: baseX + shape.x,
            y: baseY + shape.y,
            props: {
              geo: shape.geo || 'rectangle',
              w: shape.w || 100,
              h: shape.h || 60,
              fill: 'solid',
              color: shape.color || 'black',
              dash: 'draw',
              size: 'm',
              richText: shape.text ? toRichText(shape.text) : undefined,
            } as any,
            meta: { createdAt: now, createdBy: userId, createdByName: userName, template: template.id },
          });
        } else if (shape.type === 'note') {
          editor.createShape({
            id,
            type: 'note',
            x: baseX + shape.x,
            y: baseY + shape.y,
            props: {
              color: shape.color || 'yellow',
              size: 'm',
              richText: shape.text ? toRichText(shape.text) : toRichText(''),
            } as any,
            meta: { createdAt: now, createdBy: userId, createdByName: userName, template: template.id },
          });
        } else if (shape.type === 'arrow') {
          editor.createShape({
            id,
            type: 'arrow',
            x: baseX + shape.x,
            y: baseY + shape.y,
            props: {
              start: { x: 0, y: 0 },
              end: { x: (shape.endX || shape.x + 50) - shape.x, y: (shape.endY || shape.y + 50) - shape.y },
              color: shape.color || 'black',
              arrowheadEnd: 'arrow',
              arrowheadStart: 'none',
            } as any,
            meta: { createdAt: now, createdBy: userId, createdByName: userName, template: template.id },
          });
        }
      });

    onClose();
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px', borderBottom: '1px solid #E5E7EB' }}>

        {/* Search */}
        <input
          type="text"
          placeholder="Sablon ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            fontSize: '13px',
            outline: 'none',
          }}
        />
      </div>

      {/* Categories */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: '12px',
              fontSize: '11px',
              cursor: 'pointer',
              background: selectedCategory === cat ? '#3B82F6' : '#F3F4F6',
              color: selectedCategory === cat ? 'white' : '#666',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template Grid */}
      <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              style={{
                padding: '12px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                background: 'white',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = '#3B82F6';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(59,130,246,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = '#E5E7EB';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '6px' }}>{template.icon}</div>
              <div style={{ fontSize: '12px', fontWeight: '500', color: '#333' }}>{template.name}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{template.shapes.length} eleman</div>
            </button>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
            Sablon bulunamadi
          </div>
        )}
      </div>
    </div>
  );
}
