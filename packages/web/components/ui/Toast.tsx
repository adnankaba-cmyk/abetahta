'use client';

import { useToastStore, type ToastType } from '@/store/toast';
import { X } from 'lucide-react';

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#F0FDF4', border: '#86EFAC', text: '#166534', icon: '✓' },
  error:   { bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', icon: '✕' },
  warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', icon: '!' },
  info:    { bg: '#EFF6FF', border: '#93C5FD', text: '#1E40AF', icon: 'i' },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      right: '16px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '380px',
    }}>
      {toasts.map((t) => {
        const c = COLORS[t.type];
        return (
          <div
            key={t.id}
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <span style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: c.border,
              color: c.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold',
              flexShrink: 0,
            }}>
              {c.icon}
            </span>
            <span style={{ flex: 1, fontSize: '13px', color: c.text, fontWeight: 500 }}>
              {t.message}
            </span>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: c.text,
                opacity: 0.6,
                flexShrink: 0,
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
