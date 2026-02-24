'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from 'tldraw';
import { api } from '@/lib/api';

interface Comment {
  id: string;
  element_id: string;
  user_id: string | null;
  body: string;
  is_ai: boolean;
  parent_id: string | null;
  user_name: string | null;
  created_at: string;
}

interface CommentPanelProps {
  editor: Editor | null;
  boardId: string;
  isVisible: boolean;
  onClose: () => void;
}

export function CommentPanel({ editor, boardId, isVisible, onClose }: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedElementLabel, setSelectedElementLabel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Seçili shape değiştiğinde yorumları yükle
  useEffect(() => {
    if (!editor || !isVisible) return;

    const handleSelectionChange = () => {
      const selected = editor.getSelectedShapes();
      if (selected.length === 1) {
        const shape = selected[0];
        setSelectedElementId(shape.id);
        setSelectedElementLabel(
          (shape.props as any)?.text?.slice(0, 30) ||
          (shape.props as any)?.richText?.[0]?.children?.[0]?.text?.slice(0, 30) ||
          shape.type
        );
        loadComments(shape.id);
      } else {
        setSelectedElementId(null);
        setSelectedElementLabel('');
        setComments([]);
      }
    };

    handleSelectionChange(); // İlk yükleme
    const cleanup = editor.sideEffects.registerAfterChangeHandler('instance_page_state', handleSelectionChange);
    return cleanup;
  }, [editor, isVisible]);

  const loadComments = useCallback(async (elementId: string) => {
    try {
      const data = await api.get<{ comments: Comment[] }>(`/api/comments/element/${elementId}`);
      setComments(data.comments);
    } catch {
      // Element backend'de olmayabilir — sorun değil
      setComments([]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || !selectedElementId || isLoading) return;

    setIsLoading(true);
    try {
      const data = await api.post<{ comment: Comment }>('/api/comments', {
        element_id: selectedElementId,
        body: input.trim(),
      });
      setComments(prev => [...prev, data.comment]);
      setInput('');
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      // Hata
    } finally {
      setIsLoading(false);
    }
  }, [input, selectedElementId, isLoading]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await api.del(`/api/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch {
      // Hata
    }
  }, []);

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
        background: '#F59E0B',
        padding: '12px 16px',
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Yorumlar</span>
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

      {/* Seçili element bilgisi */}
      {selectedElementId ? (
        <div style={{
          padding: '8px 16px',
          background: '#FFFBEB',
          borderBottom: '1px solid #FDE68A',
          fontSize: '12px',
          color: '#92400E',
        }}>
          Secili: <strong>{selectedElementLabel}</strong>
        </div>
      ) : (
        <div style={{
          padding: '16px',
          textAlign: 'center',
          color: '#999',
          fontSize: '13px',
        }}>
          Yorum eklemek icin bir sekil secin
        </div>
      )}

      {/* Yorumlar listesi */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {comments.length === 0 && selectedElementId && (
          <div style={{ textAlign: 'center', color: '#999', fontSize: '13px', padding: '20px' }}>
            Henuz yorum yok
          </div>
        )}

        {comments.map((comment) => (
          <div
            key={comment.id}
            style={{
              background: comment.is_ai ? '#EFF6FF' : '#F9FAFB',
              border: `1px solid ${comment.is_ai ? '#BFDBFE' : '#E5E7EB'}`,
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '4px',
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: '600',
                color: comment.is_ai ? '#1D4ED8' : '#374151',
              }}>
                {comment.is_ai ? 'AI Asistan' : (comment.user_name || 'Anonim')}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: '#9CA3AF' }}>
                  {new Date(comment.created_at).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {!comment.is_ai && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#9CA3AF',
                      fontSize: '12px',
                      padding: '0 2px',
                    }}
                    title="Sil"
                  >
                    x
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#374151', whiteSpace: 'pre-wrap' }}>
              {comment.body}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {selectedElementId && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          gap: '8px',
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Yorum yaz..."
            style={{
              flex: 1,
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '13px',
              outline: 'none',
            }}
            disabled={isLoading}
          />
          <button
            onClick={handleSubmit}
            disabled={isLoading || !input.trim()}
            style={{
              background: isLoading || !input.trim() ? '#D1D5DB' : '#F59E0B',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: 'bold',
            }}
          >
            Ekle
          </button>
        </div>
      )}
    </div>
  );
}
