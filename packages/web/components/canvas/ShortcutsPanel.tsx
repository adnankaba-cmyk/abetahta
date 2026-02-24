'use client';

interface ShortcutsPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'Genel', items: [
    { keys: ['Ctrl', 'Z'], description: 'Geri al' },
    { keys: ['Ctrl', 'Y'], description: 'Yeniden yap' },
    { keys: ['Ctrl', 'C'], description: 'Kopyala' },
    { keys: ['Ctrl', 'V'], description: 'Yapistir' },
    { keys: ['Ctrl', 'X'], description: 'Kes' },
    { keys: ['Ctrl', 'A'], description: 'Tumunu sec' },
    { keys: ['Delete'], description: 'Sil' },
    { keys: ['Ctrl', 'D'], description: 'Cogalt' },
  ]},
  { category: 'Araclar', items: [
    { keys: ['V'], description: 'Secim araci' },
    { keys: ['H'], description: 'El araci (pan)' },
    { keys: ['D'], description: 'Kalem' },
    { keys: ['E'], description: 'Silgi' },
    { keys: ['R'], description: 'Dikdortgen' },
    { keys: ['O'], description: 'Elips' },
    { keys: ['A'], description: 'Ok' },
    { keys: ['T'], description: 'Metin' },
    { keys: ['N'], description: 'Not' },
  ]},
  { category: 'Gorunum', items: [
    { keys: ['Ctrl', '+'], description: 'Yakinlastir' },
    { keys: ['Ctrl', '-'], description: 'Uzaklastir' },
    { keys: ['Ctrl', '0'], description: 'Tuma sigdir' },
    { keys: ['Ctrl', '1'], description: '%100 zoom' },
    { keys: ['Space'], description: 'Surukleme modu' },
  ]},
  { category: 'Duzenleme', items: [
    { keys: ['Ctrl', 'G'], description: 'Grupla' },
    { keys: ['Ctrl', 'Shift', 'G'], description: 'Grubu coz' },
    { keys: ['Ctrl', ']'], description: 'One getir' },
    { keys: ['Ctrl', '['], description: 'Arkaya gonder' },
    { keys: ['Ctrl', 'L'], description: 'Kilitle' },
  ]},
];

export function ShortcutsPanel({ isVisible, onClose }: ShortcutsPanelProps) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        maxHeight: '80vh',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        zIndex: 1003,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⌨️ Klavye Kisayollari
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          {SHORTCUTS.map(section => (
            <div key={section.category}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '600', color: '#3B82F6', textTransform: 'uppercase' }}>
                {section.category}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {section.items.map((shortcut, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#666' }}>{shortcut.description}</span>
                    <div style={{ display: 'flex', gap: '3px' }}>
                      {shortcut.keys.map((key, kidx) => (
                        <kbd
                          key={kidx}
                          style={{
                            padding: '2px 6px',
                            background: '#F3F4F6',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#333',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '11px', color: '#666', textAlign: 'center' }}>
        Ipucu: <kbd style={{ padding: '1px 4px', background: '#E5E7EB', borderRadius: '2px', fontSize: '10px' }}>?</kbd> tusuna basarak bu paneli acabilirsiniz
      </div>
    </div>
  );
}
