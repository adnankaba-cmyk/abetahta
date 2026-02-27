'use client';

import { useRef, useCallback, useState } from 'react';
import { DrawIoEmbed, DrawIoEmbedRef, EventExport, EventSave } from 'react-drawio';

interface DrawioEditorProps {
  onInsert: (svgData: string, xml: string) => void;
  onClose: () => void;
  initialXml?: string;
}

/**
 * draw.io editörünü iframe olarak gösterir.
 * Kullanıcı çizimini bitirince SVG olarak tldraw canvas'a aktarılır.
 */
export function DrawioEditor({ onInsert, onClose, initialXml }: DrawioEditorProps) {
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [saving, setSaving] = useState(false);
  const lastXmlRef = useRef<string>('');

  // Save tetiklendiğinde SVG export iste
  const handleSave = useCallback((data: EventSave) => {
    lastXmlRef.current = data.xml;
    setSaving(true);
    // SVG export tetikle (UniqueActionProps: action alanı otomatik eklenir)
    drawioRef.current?.exportDiagram({
      format: 'svg',
      spin: true,
      transparent: true,
    });
  }, []);

  // Export tamamlandığında SVG'yi gönder
  const handleExport = useCallback((data: EventExport) => {
    setSaving(false);
    if (data.data) {
      onInsert(data.data, lastXmlRef.current);
    }
  }, [onInsert]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 5000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Üst bar */}
      <div style={{
        height: '40px',
        background: '#1a1a2e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        color: 'white',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>draw.io Editor</span>
          <span style={{ fontSize: '11px', color: '#8888aa' }}>1000+ sekil kutuphanesi</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {saving && <span style={{ fontSize: '11px', color: '#ffd700' }}>SVG olusturuluyor...</span>}
          <button
            onClick={onClose}
            style={{
              background: '#444',
              border: 'none',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Kapat (ESC)
          </button>
        </div>
      </div>

      {/* draw.io iframe */}
      <div style={{ flex: 1, position: 'relative' }}>
        <DrawIoEmbed
          ref={drawioRef}
          xml={initialXml}
          exportFormat="xmlsvg"
          urlParameters={{
            ui: 'kennedy',
            dark: false,
            spin: true,
            libraries: true,
            saveAndExit: true,
            noExitBtn: false,
            grid: true,
            lang: 'tr',
          }}
          onSave={handleSave}
          onExport={handleExport}
          onClose={() => onClose()}
        />
      </div>
    </div>
  );
}
