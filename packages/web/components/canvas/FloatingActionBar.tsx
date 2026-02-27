'use client';

/**
 * FloatingActionBar — Secili sekillerin ustunde beliren mini toolbar.
 * Figma tarz: Bagla, Hizala, Renk, Kopyala, Sil, Agac Duzenle.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tldraw/editor';
import { smartAutoConnect, autoLayoutTree } from '@/lib/canvas-utils';
import { toast } from '@/store/toast';

interface FloatingActionBarProps {
  editor: Editor | null;
}

interface BarPosition {
  top: number;
  left: number;
}

const COLORS = [
  { name: 'black', hex: '#1e1e1e' },
  { name: 'red', hex: '#e03131' },
  { name: 'orange', hex: '#f08c00' },
  { name: 'yellow', hex: '#ffc078' },
  { name: 'green', hex: '#2f9e44' },
  { name: 'blue', hex: '#1971c2' },
  { name: 'violet', hex: '#7048e8' },
];

const ALIGNS = [
  { label: 'Sol', value: 'left' },
  { label: 'Sag', value: 'right' },
  { label: 'Ust', value: 'top' },
  { label: 'Alt', value: 'bottom' },
  { label: 'Yatay Orta', value: 'center-horizontal' },
  { label: 'Dikey Orta', value: 'center-vertical' },
] as const;

export function FloatingActionBar({ editor }: FloatingActionBarProps) {
  const [position, setPosition] = useState<BarPosition | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [showAlignMenu, setShowAlignMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);
  const rafRef = useRef<number>(0);
  const barRef = useRef<HTMLDivElement>(null);

  const recalculate = useCallback(() => {
    if (!editor) {
      setPosition(null);
      setSelectedCount(0);
      return;
    }

    const shapes = editor.getSelectedShapes();
    const count = shapes.length;
    setSelectedCount(count);

    if (count === 0) {
      setPosition(null);
      return;
    }

    const pageBounds = editor.getSelectionPageBounds();
    if (!pageBounds) {
      setPosition(null);
      return;
    }

    const screenTL = editor.pageToScreen({ x: pageBounds.x, y: pageBounds.y });
    const screenTR = editor.pageToScreen({ x: pageBounds.x + pageBounds.w, y: pageBounds.y });

    const barWidth = 340;
    const barHeight = 40;
    const centerX = (screenTL.x + screenTR.x) / 2;
    const rawTop = screenTL.y - barHeight - 12;
    const rawLeft = centerX - barWidth / 2;

    // Viewport clamp
    const vb = editor.getViewportScreenBounds();
    const top = Math.max(vb.y + 4, Math.min(rawTop, vb.y + vb.h - barHeight - 4));
    const left = Math.max(vb.x + 4, Math.min(rawLeft, vb.x + vb.w - barWidth - 4));

    setPosition({ top, left });
  }, [editor]);

  // Store listener — tum degisikliklerde pozisyon guncelle
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.store.listen(
      () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(recalculate);
      },
      { source: 'all', scope: 'all' },
    );

    return () => {
      unsubscribe();
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, recalculate]);

  // Dismenu dismiss: disari tikla
  useEffect(() => {
    if (!showAlignMenu && !showColorMenu) return;

    const handleOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setShowAlignMenu(false);
        setShowColorMenu(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAlignMenu(false);
        setShowColorMenu(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showAlignMenu, showColorMenu]);

  if (!editor || !position) return null;

  // ─── Actions ──────────────────────────────────────────

  const handleConnect = () => {
    if (selectedCount < 2) {
      toast.info('En az 2 sekil secin');
      return;
    }
    smartAutoConnect(editor);
    closeMenus();
  };

  const handleAlign = (alignment: string) => {
    const ids = editor.getSelectedShapeIds();
    if (ids.length < 2) {
      toast.info('En az 2 sekil secin');
      return;
    }
    editor.alignShapes(ids, alignment as 'left' | 'right' | 'top' | 'bottom' | 'center-horizontal' | 'center-vertical');
    closeMenus();
  };

  const handleColor = (color: string) => {
    const shapes = editor.getSelectedShapes();
    for (const shape of shapes) {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        props: { color } as Record<string, unknown>,
      });
    }
    closeMenus();
  };

  const handleDuplicate = () => {
    editor.duplicateShapes(editor.getSelectedShapeIds());
    closeMenus();
  };

  const handleDelete = () => {
    editor.deleteShapes(editor.getSelectedShapeIds());
    closeMenus();
  };

  const handleLayout = () => {
    if (selectedCount < 2) {
      toast.info('En az 2 sekil secin');
      return;
    }
    autoLayoutTree(editor);
    closeMenus();
  };

  const closeMenus = () => {
    setShowAlignMenu(false);
    setShowColorMenu(false);
  };

  // ─── Render ───────────────────────────────────────────

  const btnStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '13px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '3px',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s ease',
  };

  const btnHoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = '#F3F4F6';
  };
  const btnHoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
  };

  return (
    <div
      ref={barRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        border: '1px solid #E0E0E0',
        padding: '4px 6px',
        pointerEvents: 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Bagla — 2+ shapes */}
      {selectedCount >= 2 && (
        <button onClick={handleConnect} style={btnStyle} onMouseEnter={btnHoverIn} onMouseLeave={btnHoverOut} title="Otomatik okla bagla (C)">
          <span style={{ fontSize: '14px' }}>🔗</span>
          <span style={{ fontSize: '11px' }}>Bagla</span>
        </button>
      )}

      {/* Hizala — 2+ shapes */}
      {selectedCount >= 2 && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowAlignMenu(!showAlignMenu); setShowColorMenu(false); }}
            style={btnStyle}
            onMouseEnter={btnHoverIn}
            onMouseLeave={btnHoverOut}
            title="Hizala"
          >
            <span style={{ fontSize: '14px' }}>⬆</span>
            <span style={{ fontSize: '11px' }}>Hizala</span>
          </button>
          {showAlignMenu && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: 'white',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                border: '1px solid #E0E0E0',
                padding: '4px',
                zIndex: 510,
              }}
            >
              {ALIGNS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => handleAlign(a.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 12px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textAlign: 'left',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F3F4F6')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {selectedCount >= 2 && (
        <div style={{ width: '1px', height: '20px', background: '#E0E0E0', margin: '0 2px' }} />
      )}

      {/* Renk */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => { setShowColorMenu(!showColorMenu); setShowAlignMenu(false); }}
          style={btnStyle}
          onMouseEnter={btnHoverIn}
          onMouseLeave={btnHoverOut}
          title="Renk degistir"
        >
          <span style={{ fontSize: '14px' }}>🎨</span>
          <span style={{ fontSize: '11px' }}>Renk</span>
        </button>
        {showColorMenu && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '4px',
              background: 'white',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              border: '1px solid #E0E0E0',
              padding: '8px',
              display: 'flex',
              gap: '6px',
              zIndex: 510,
            }}
          >
            {COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => handleColor(c.name)}
                title={c.name}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  border: '2px solid white',
                  background: c.hex,
                  cursor: 'pointer',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.15)',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '20px', background: '#E0E0E0', margin: '0 2px' }} />

      {/* Kopyala */}
      <button onClick={handleDuplicate} style={btnStyle} onMouseEnter={btnHoverIn} onMouseLeave={btnHoverOut} title="Cogalt (Ctrl+D)">
        <span style={{ fontSize: '14px' }}>📋</span>
        <span style={{ fontSize: '11px' }}>Kopya</span>
      </button>

      {/* Sil */}
      <button onClick={handleDelete} style={btnStyle} onMouseEnter={(e) => { e.currentTarget.style.background = '#FEF2F2'; }} onMouseLeave={btnHoverOut} title="Sil (Delete)">
        <span style={{ fontSize: '14px' }}>🗑</span>
        <span style={{ fontSize: '11px', color: '#DC2626' }}>Sil</span>
      </button>

      {/* Agac Duz — 2+ shapes */}
      {selectedCount >= 2 && (
        <>
          <div style={{ width: '1px', height: '20px', background: '#E0E0E0', margin: '0 2px' }} />
          <button onClick={handleLayout} style={btnStyle} onMouseEnter={btnHoverIn} onMouseLeave={btnHoverOut} title="Agac duzeni (Ctrl+Shift+L)">
            <span style={{ fontSize: '14px' }}>🌳</span>
            <span style={{ fontSize: '11px' }}>Duzen</span>
          </button>
        </>
      )}
    </div>
  );
}
