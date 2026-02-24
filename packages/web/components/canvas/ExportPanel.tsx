'use client';

import { useState } from 'react';
import { Editor } from 'tldraw';
import { uiLog } from '@/lib/logger';
import { toast } from '@/store/toast';

interface ExportPanelProps {
  editor: Editor | null;
  isVisible: boolean;
  onClose: () => void;
  boardName: string;
}

export function ExportPanel({ editor, isVisible, onClose, boardName }: ExportPanelProps) {
  const [format, setFormat] = useState<'png' | 'json'>('png');
  const [quality, setQuality] = useState<'normal' | 'high'>('normal');
  const [background, setBackground] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const exportCanvas = async () => {
    if (!editor) return;
    setIsExporting(true);

    try {
      const shapes = editor.getCurrentPageShapes();

      if (shapes.length === 0) {
        toast.warning('Tahtada sekil yok!');
        setIsExporting(false);
        return;
      }

      const shapeIds = shapes.map(s => s.id);
      const fileName = `${boardName || 'tahta'}-${new Date().toISOString().slice(0,10)}`;

      if (format === 'png') {
        const result = await editor.toImage(shapeIds, {
          format: 'png',
          quality: quality === 'high' ? 1 : 0.8,
          scale: quality === 'high' ? 2 : 1,
          background: background,
        });

        if (result && result.blob) {
          const url = URL.createObjectURL(result.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } else if (format === 'json') {
        const snapshot = editor.getSnapshot();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      onClose();
    } catch (err) {
      uiLog.error('Export hatasi:', err);
      toast.error('Disa aktarma sirasinda hata olustu');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async () => {
    if (!editor) return;
    setIsExporting(true);

    try {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) {
        toast.warning('Tahtada sekil yok!');
        setIsExporting(false);
        return;
      }

      const shapeIds = shapes.map(s => s.id);
      const result = await editor.toImage(shapeIds, {
        format: 'png',
        quality: 1,
        scale: 2,
        background: true,
      });

      if (result && result.blob) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': result.blob })
        ]);
        toast.success('Panoya kopyalandi!');
      }
    } catch (err) {
      uiLog.error('Kopyalama hatasi:', err);
      toast.error('Panoya kopyalanamadi');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '340px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: 1003,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📤 Disa Aktar
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Format */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
            Format
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['png', 'json'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: format === f ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: format === f ? '#EFF6FF' : 'white',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: format === f ? '600' : '400',
                  color: format === f ? '#3B82F6' : '#666',
                }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Quality (only for PNG) */}
        {format === 'png' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '8px', color: '#333' }}>
              Kalite
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setQuality('normal')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: quality === 'normal' ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: quality === 'normal' ? '#EFF6FF' : 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Normal (1x)
              </button>
              <button
                onClick={() => setQuality('high')}
                style={{
                  flex: 1,
                  padding: '8px',
                  border: quality === 'high' ? '2px solid #3B82F6' : '1px solid #E5E7EB',
                  borderRadius: '8px',
                  background: quality === 'high' ? '#EFF6FF' : 'white',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Yuksek (2x)
              </button>
            </div>
          </div>
        )}

        {/* Background */}
        {format !== 'json' && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={background}
                onChange={(e) => setBackground(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              Arka plan dahil
            </label>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={copyToClipboard}
            disabled={isExporting}
            style={{
              flex: 1,
              padding: '12px',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              background: 'white',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            📋 Kopyala
          </button>
          <button
            onClick={exportCanvas}
            disabled={isExporting}
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              borderRadius: '8px',
              background: isExporting ? '#9CA3AF' : 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
              color: 'white',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            {isExporting ? '⏳ Bekle...' : '💾 Indir'}
          </button>
        </div>
      </div>
    </div>
  );
}
