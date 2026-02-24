'use client';

import { useState, useCallback, useEffect } from 'react';
import { api } from '@/lib/api';

interface HistoryEntry {
  id: string;
  board_id: string;
  element_id: string | null;
  user_id: string | null;
  action: string;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  user_name: string | null;
  created_at: string;
}

interface HistoryPanelProps {
  boardId: string;
  isVisible: boolean;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  create: { label: 'Olusturuldu', color: '#065F46', bg: '#ECFDF5' },
  update: { label: 'Guncellendi', color: '#92400E', bg: '#FFFBEB' },
  delete: { label: 'Silindi', color: '#991B1B', bg: '#FEF2F2' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Az once';
  if (diffMin < 60) return `${diffMin} dk once`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} sa once`;
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function getChangedFields(before: Record<string, any> | null, after: Record<string, any> | null): string[] {
  if (!before || !after) return [];
  const changed: string[] = [];
  const skipFields = ['id', 'board_id', 'created_by', 'created_at', 'updated_at'];

  for (const key of Object.keys(after)) {
    if (skipFields.includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed;
}

export function HistoryPanel({ boardId, isVisible, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ history: HistoryEntry[] }>(
        `/api/elements/history/${boardId}?limit=${limit}`
      );
      setEntries(data.history);
    } catch {
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [boardId, limit]);

  useEffect(() => {
    if (isVisible) loadHistory();
  }, [isVisible, loadHistory]);

  if (!isVisible) return null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'white',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: '#6366F1',
        padding: '12px 16px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Gecmis</span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={loadHistory}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Yenile"
          >
            Yenile
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* History list */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '8px',
      }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px', fontSize: '13px' }}>
            Yukleniyor...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px', fontSize: '13px' }}>
            Henuz gecmis kaydi yok
          </div>
        ) : (
          <>
            {entries.map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, color: '#333', bg: '#F3F4F6' };
              const changedFields = getChangedFields(entry.before_state, entry.after_state);
              const isExpanded = expandedId === entry.id;

              return (
                <div
                  key={entry.id}
                  style={{
                    borderBottom: '1px solid #F3F4F6',
                    padding: '10px 8px',
                  }}
                >
                  {/* Entry summary row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: entry.action === 'update' ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      if (entry.action === 'update') {
                        setExpandedId(isExpanded ? null : entry.id);
                      }
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: actionInfo.color,
                      flexShrink: 0,
                    }} />

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: actionInfo.bg,
                          color: actionInfo.color,
                          fontWeight: '600',
                        }}>
                          {actionInfo.label}
                        </span>
                        <span style={{ fontSize: '12px', color: '#374151', fontWeight: '500' }}>
                          {entry.user_name || 'Bilinmeyen'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px', fontSize: '11px', color: '#9CA3AF' }}>
                        <span>{formatTime(entry.created_at)}</span>
                        {changedFields.length > 0 && (
                          <span>{changedFields.length} alan degisti</span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator for updates */}
                    {entry.action === 'update' && changedFields.length > 0 && (
                      <span style={{
                        fontSize: '10px',
                        color: '#9CA3AF',
                        transform: isExpanded ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}>
                        ▶
                      </span>
                    )}
                  </div>

                  {/* Expanded diff view */}
                  {isExpanded && entry.before_state && entry.after_state && (
                    <div style={{
                      marginTop: '8px',
                      marginLeft: '16px',
                      background: '#F9FAFB',
                      border: '1px solid #E5E7EB',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '11px',
                      fontFamily: 'Consolas, monospace',
                    }}>
                      {changedFields.map((field) => {
                        const before = entry.before_state![field];
                        const after = entry.after_state![field];
                        return (
                          <div key={field} style={{ marginBottom: '6px' }}>
                            <div style={{ color: '#6366F1', fontWeight: '600', marginBottom: '2px' }}>
                              {field}
                            </div>
                            <div style={{ color: '#DC2626', textDecoration: 'line-through' }}>
                              - {typeof before === 'object' ? JSON.stringify(before) : String(before ?? 'null')}
                            </div>
                            <div style={{ color: '#16A34A' }}>
                              + {typeof after === 'object' ? JSON.stringify(after) : String(after ?? 'null')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Load more */}
            {entries.length >= limit && (
              <button
                onClick={() => setLimit(prev => prev + 50)}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#F3F4F6',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: '#6366F1',
                  fontWeight: '500',
                  marginTop: '8px',
                }}
              >
                Daha fazla yukle
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
