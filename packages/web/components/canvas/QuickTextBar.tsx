'use client';

/**
 * QuickTextBar v2 — Canvas altinda sabit metin girisi.
 *
 * Ozellikler:
 * - Sekil tipi secici (not, kutu, daire, elmas, yildiz, metin)
 * - Madde listesi destegi (- ile baslayan satirlar → bulletList)
 * - Textarea: Shift+Enter yeni satir, Enter gonder
 * - idle mod: Yaz → Enter → secili sekil tipinde olustur
 * - inject mod: Yaz → sekle tikla → metin icine yaz
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Editor, toRichText } from '@tldraw/editor';
import { toast } from '@/store/toast';

interface QuickTextBarProps {
  editor: Editor | null;
}

type Mode = 'idle' | 'inject';

interface ShapeOption {
  id: string;
  icon: string;
  label: string;
}

const SHAPE_OPTIONS: ShapeOption[] = [
  { id: 'note', icon: '📝', label: 'Not' },
  { id: 'rectangle', icon: '▭', label: 'Kutu' },
  { id: 'ellipse', icon: '○', label: 'Daire' },
  { id: 'diamond', icon: '◇', label: 'Elmas' },
  { id: 'star', icon: '★', label: 'Yıldız' },
  { id: 'text', icon: 'T', label: 'Metin' },
];

/**
 * textToRichText — Madde listesi ve coklu satir destegi.
 *
 * - ile baslayan satirlar → ProseMirror bulletList
 * Coklu satir (liste degil) → ayri paragraflar
 * Tek satir → toRichText fallback
 */
function textToRichText(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  if (lines.length === 0) return toRichText('');

  // Madde tespiti: tum satirlar - veya * veya • ile basliyor mu?
  const isBulletList = lines.length > 1 && lines.every(l => /^[-*•]\s/.test(l));
  const isNumberedList = lines.length > 1 && lines.every(l => /^\d+[.)]\s/.test(l));

  if (isBulletList || isNumberedList) {
    return {
      type: 'doc',
      content: [{
        type: 'bulletList',
        content: lines.map(line => ({
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: line.replace(/^[-*•]\s*/, '').replace(/^\d+[.)]\s*/, '') }],
          }],
        })),
      }],
    };
  }

  // Coklu satir ama liste degil → ayri paragraflar
  if (lines.length > 1) {
    return {
      type: 'doc',
      content: lines.map(line => ({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      })),
    };
  }

  // Tek satir → toRichText kullan
  return toRichText(text.trim());
}

export function QuickTextBar({ editor }: QuickTextBarProps) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [shapeType, setShapeType] = useState('note');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef(text);
  const shapeTypeRef = useRef(shapeType);
  const dropdownRef = useRef<HTMLDivElement>(null);
  textRef.current = text;
  shapeTypeRef.current = shapeType;

  // Dropdown disina tiklaninca kapat
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [dropdownOpen]);

  // Secili sekil tipine gore shape olustur
  const createShapeAtPoint = useCallback((x: number, y: number, content: string) => {
    if (!editor || !content.trim()) return;

    const richText = textToRichText(content);

    if (shapeType === 'note') {
      editor.createShape({
        type: 'note' as const,
        x: x - 100,
        y: y - 50,
        props: {
          richText,
          color: 'yellow',
          size: 'm',
          font: 'sans',
        } as Record<string, unknown>,
      });
    } else if (shapeType === 'text') {
      editor.createShape({
        type: 'text' as const,
        x,
        y,
        props: {
          richText,
          size: 'm',
          font: 'sans',
        } as Record<string, unknown>,
      });
    } else {
      // geo shapes: rectangle, ellipse, diamond, star
      editor.createShape({
        type: 'geo' as const,
        x: x - 100,
        y: y - 50,
        props: {
          geo: shapeType,
          w: 200,
          h: 100,
          fill: 'solid',
          richText,
        } as Record<string, unknown>,
      });
    }
  }, [editor, shapeType]);

  // idle: Enter → viewport merkezinde sekil olustur
  const createShapeAtCenter = useCallback(() => {
    if (!editor || !text.trim()) return;

    const center = editor.getViewportScreenCenter();
    const page = editor.screenToPage(center);

    createShapeAtPoint(page.x, page.y, text);

    // Zoom to new shape
    const allShapes = editor.getCurrentPageShapes();
    const last = allShapes[allShapes.length - 1];
    if (last) {
      editor.select(last.id);
      editor.zoomToSelection({ animation: { duration: 200 } });
      editor.selectNone();
    }

    setText('');
  }, [editor, text, createShapeAtPoint]);

  // inject: sekle tiklayinca metin ekle
  useEffect(() => {
    if (mode !== 'inject' || !editor) return;

    const container = document.querySelector('.tl-container') as HTMLElement | null;
    if (!container) return;

    const handleClick = (e: PointerEvent) => {
      const currentText = textRef.current.trim();
      if (!currentText) {
        toast.info('Once metin yazin');
        setMode('idle');
        return;
      }

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });
      const hitShape = editor.getShapeAtPoint(pagePoint, { hitInside: true });

      if (hitShape) {
        const props = hitShape.props as Record<string, unknown>;
        if ('richText' in props || 'text' in props) {
          const richText = textToRichText(currentText);
          editor.updateShape({
            id: hitShape.id,
            type: hitShape.type,
            props: { richText } as Record<string, unknown>,
          });
          toast.success('Metin eklendi');
        } else {
          toast.error('Bu sekil metin desteklemiyor');
        }
      } else {
        // Bos alana tikla → secili sekil tipinde olustur
        const currentShapeType = shapeTypeRef.current;
        const richText = textToRichText(currentText);

        if (currentShapeType === 'note') {
          editor.createShape({
            type: 'note' as const,
            x: pagePoint.x - 100,
            y: pagePoint.y - 50,
            props: { richText, color: 'yellow', size: 'm', font: 'sans' } as Record<string, unknown>,
          });
        } else if (currentShapeType === 'text') {
          editor.createShape({
            type: 'text' as const,
            x: pagePoint.x,
            y: pagePoint.y,
            props: { richText, size: 'm', font: 'sans' } as Record<string, unknown>,
          });
        } else {
          editor.createShape({
            type: 'geo' as const,
            x: pagePoint.x - 100,
            y: pagePoint.y - 50,
            props: { geo: currentShapeType, w: 200, h: 100, fill: 'solid', richText } as Record<string, unknown>,
          });
        }
        toast.success('Sekil olusturuldu');
      }

      setText('');
      setMode('idle');
    };

    container.addEventListener('pointerdown', handleClick, true);
    return () => container.removeEventListener('pointerdown', handleClick, true);
  }, [mode, editor]);

  // Textarea auto-height
  const adjustHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = 80; // ~4 satir
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
      e.preventDefault();
      if (mode === 'idle') {
        createShapeAtCenter();
      } else {
        toast.info('Sekle tiklayin veya ESC ile iptal edin');
      }
    }
    if (e.key === 'Escape') {
      setText('');
      setMode('idle');
      setDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  const toggleInjectMode = () => {
    if (!text.trim()) {
      toast.info('Once metin yazin');
      return;
    }
    setMode(mode === 'inject' ? 'idle' : 'inject');
  };

  const selectShape = (id: string) => {
    setShapeType(id);
    setDropdownOpen(false);
    inputRef.current?.focus();
  };

  if (!editor) return null;

  const isInject = mode === 'inject';
  const selectedShape = SHAPE_OPTIONS.find(s => s.id === shapeType) ?? SHAPE_OPTIONS[0];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '4px',
        pointerEvents: 'auto',
      }}
    >
      {/* inject mode indicator */}
      {isInject && (
        <div
          style={{
            position: 'absolute',
            top: '-28px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '11px',
            color: '#D97706',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            background: 'rgba(255,255,255,0.95)',
            padding: '2px 8px',
            borderRadius: '4px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          }}
        >
          Sekle tiklayin — ESC iptal
        </div>
      )}

      {/* Shape type selector */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          title={`Sekil: ${selectedShape.label}`}
          style={{
            width: '34px',
            height: '34px',
            border: '1px solid #CACACA',
            borderRadius: '8px',
            background: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#F0F7FF';
            e.currentTarget.style.borderColor = '#93C5FD';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.borderColor = '#CACACA';
          }}
        >
          {selectedShape.icon}
        </button>

        {/* Dropdown popup */}
        {dropdownOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '0',
              background: 'white',
              border: '1px solid #E0E0E0',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              padding: '4px',
              minWidth: '130px',
              zIndex: 300,
            }}
          >
            {SHAPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => selectShape(opt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '6px 10px',
                  border: 'none',
                  borderRadius: '4px',
                  background: opt.id === shapeType ? '#EFF6FF' : 'transparent',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontFamily: 'system-ui, sans-serif',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (opt.id !== shapeType) e.currentTarget.style.background = '#F5F5F5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = opt.id === shapeType ? '#EFF6FF' : 'transparent';
                }}
              >
                <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Textarea */}
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Metin yaz → Enter gonder, Shift+Enter yeni satir"
        rows={1}
        style={{
          width: '340px',
          padding: '8px 12px',
          fontSize: '13px',
          fontFamily: 'system-ui, sans-serif',
          border: isInject ? '2px solid #F59E0B' : '1px solid #CACACA',
          borderRadius: '8px',
          background: 'white',
          boxShadow: isInject
            ? '0 0 12px rgba(245,158,11,0.4)'
            : '0 2px 8px rgba(0,0,0,0.1)',
          outline: 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          resize: 'none',
          overflow: 'hidden',
          lineHeight: '1.4',
          minHeight: '34px',
          maxHeight: '80px',
        }}
      />

      {/* Inject mode toggle button */}
      <button
        onClick={toggleInjectMode}
        title={isInject ? 'Iptal (ESC)' : 'Sekle metin ekle'}
        style={{
          width: '34px',
          height: '34px',
          border: isInject ? '2px solid #F59E0B' : '1px solid #CACACA',
          borderRadius: '8px',
          background: isInject ? '#FEF3C7' : 'white',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isInject) {
            e.currentTarget.style.background = '#F0F7FF';
            e.currentTarget.style.borderColor = '#93C5FD';
          }
        }}
        onMouseLeave={(e) => {
          if (!isInject) {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.borderColor = '#CACACA';
          }
        }}
      >
        {isInject ? '✕' : '↗'}
      </button>
    </div>
  );
}
