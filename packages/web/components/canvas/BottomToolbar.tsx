'use client';

import { Editor } from 'tldraw';

interface BottomToolbarProps {
  editor: Editor | null;
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
}

export function BottomToolbar({ editor, showMiniMap, onToggleMiniMap }: BottomToolbarProps) {
  const zoomIn = () => {
    if (!editor) return;
    editor.zoomIn();
  };

  const zoomOut = () => {
    if (!editor) return;
    editor.zoomOut();
  };

  const zoomToFit = () => {
    if (!editor) return;
    editor.zoomToFit({ animation: { duration: 300 } });
  };

  const zoomTo100 = () => {
    if (!editor) return;
    editor.resetZoom();
  };

  const currentZoom = editor ? Math.round(editor.getZoomLevel() * 100) : 100;

  // Shape navigation
  const shapes = editor ? editor.getCurrentPageShapes() : [];
  const selectedIds = editor ? editor.getSelectedShapeIds() : [];
  const currentIndex = selectedIds.length > 0
    ? shapes.findIndex(s => s.id === selectedIds[0])
    : -1;

  const selectShape = (index: number) => {
    if (!editor || shapes.length === 0) return;
    const shape = shapes[index];
    if (shape) {
      editor.select(shape.id);
      editor.zoomToSelection({ animation: { duration: 200 } });
    }
  };

  const prevShape = () => {
    if (shapes.length === 0) return;
    const newIndex = currentIndex <= 0 ? shapes.length - 1 : currentIndex - 1;
    selectShape(newIndex);
  };

  const nextShape = () => {
    if (shapes.length === 0) return;
    const newIndex = currentIndex >= shapes.length - 1 ? 0 : currentIndex + 1;
    selectShape(newIndex);
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'white',
        padding: '8px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      {/* Zoom Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={zoomOut}
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Uzaklastir"
        >
          -
        </button>

        <button
          onClick={zoomTo100}
          style={{
            minWidth: '56px',
            height: '32px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '500',
          }}
          title="100%"
        >
          {currentZoom}%
        </button>

        <button
          onClick={zoomIn}
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Yakinlastir"
        >
          +
        </button>

        <button
          onClick={zoomToFit}
          style={{
            width: '32px',
            height: '32px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Tume Sigdir"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: '#E5E7EB' }} />

      {/* Shape Navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={prevShape}
          disabled={shapes.length === 0}
          style={{
            width: '28px',
            height: '28px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: shapes.length > 0 ? 'pointer' : 'not-allowed',
            opacity: shapes.length > 0 ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Onceki"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <span style={{ fontSize: '12px', color: '#666', minWidth: '48px', textAlign: 'center' }}>
          {shapes.length > 0 ? `${currentIndex + 1}/${shapes.length}` : '0/0'}
        </span>

        <button
          onClick={nextShape}
          disabled={shapes.length === 0}
          style={{
            width: '28px',
            height: '28px',
            border: '1px solid #E5E7EB',
            borderRadius: '6px',
            background: 'white',
            cursor: shapes.length > 0 ? 'pointer' : 'not-allowed',
            opacity: shapes.length > 0 ? 1 : 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Sonraki"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '24px', background: '#E5E7EB' }} />

      {/* MiniMap Toggle */}
      <button
        onClick={onToggleMiniMap}
        style={{
          width: '32px',
          height: '32px',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          background: showMiniMap ? '#10B981' : 'white',
          color: showMiniMap ? 'white' : '#333',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        title={showMiniMap ? 'Mini Haritayi Gizle' : 'Mini Haritayi Goster'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="12" y="12" width="8" height="8" rx="1" />
        </svg>
      </button>
    </div>
  );
}
