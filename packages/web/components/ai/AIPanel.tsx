'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from 'tldraw';
import { api } from '@/lib/api';
import { processAIResponse, applyCodeDirect, extractMermaid, extractDsl, applyMermaidToCanvas } from '@/lib/ai-canvas-bridge';
import { executeDsl } from '@/lib/tahta-dsl';
import { MERMAID_EXAMPLES } from '@/lib/mermaid-renderer';
import { serializeCanvasState, serializeSmartContext, extractActions, executeAgentActions } from '@/lib/ai-agent';
import { classifyIntent, buildLocalDsl } from '@/lib/intent-router';
import { applyTemplateById } from '@/components/canvas/TemplatePanel';

interface AIPanelProps {
  editor: Editor | null;
  boardId: string;
  isVisible: boolean;
  onClose: () => void;
  /** Canvas üzerinde son tıklanan nokta (sayfa koordinatları) */
  canvasAnchor?: { x: number; y: number } | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  rawResponse?: string; // Orijinal AI yaniti (code block'lar dahil)
  timestamp: Date;
  shapesAdded?: number;
  actionsExecuted?: number;
}

const EXAMPLE_PROMPTS = [
  'Bu tahtayı analiz et',
  'Akış diyagramı oluştur: Kullanıcı girişi',
  'Güneş sistemi ders içeriği oluştur',
  'Seçili şekilleri hizala',
  'Proje zaman çizelgesi tasarla',
];

// Mermaid örnek listesi
const MERMAID_EXAMPLE_LIST: { label: string; code: string }[] = [
  { label: 'Akis Diyagrami', code: MERMAID_EXAMPLES.flowchart },
  { label: 'Kullanici Girisi', code: MERMAID_EXAMPLES.login },
  { label: 'Siparis Sureci', code: MERMAID_EXAMPLES.process },
  { label: 'Hata Yonetimi', code: MERMAID_EXAMPLES.errorHandling },
  { label: 'Mikroservisler', code: MERMAID_EXAMPLES.microservices },
  { label: 'Durum Akisi', code: MERMAID_EXAMPLES.stateFlow },
  { label: 'DevOps Pipeline', code: MERMAID_EXAMPLES.devops },
  { label: 'Organizasyon', code: MERMAID_EXAMPLES.orgChart },
];

export function AIPanel({ editor, boardId, isVisible, onClose, canvasAnchor }: AIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mermaid Code Editor state
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeInput, setCodeInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = useCallback(async (prompt?: string) => {
    const text = prompt || input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const anchor = canvasAnchor || undefined;
      const selectedIds = editor ? editor.getSelectedShapeIds() : [];
      const shapeCount = editor ? editor.getCurrentPageShapes().length : 0;

      // Intent sınıflandırma (yerel, AI yok)
      const intent = classifyIntent(text, selectedIds.length > 0, shapeCount);

      // ── DRAW_SIMPLE: Yerel DSL, API çağrısı yok ──
      if (intent.type === 'DRAW_SIMPLE' && editor) {
        const dslCode = buildLocalDsl(intent.params, anchor);
        if (dslCode) {
          const result = executeDsl(editor, dslCode, anchor);
          const sysMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'system',
            content: result.applied
              ? `${result.shapeCount} sekil eklendi. (yerel, API kullanilmadi)`
              : `Hata: ${result.errors.join(', ')}`,
            timestamp: new Date(),
            shapesAdded: result.shapeCount,
          };
          setMessages(prev => [...prev, sysMsg]);
          setIsLoading(false);
          return;
        }
        // DSL oluşturulamadıysa AI'a devam et
      }

      // ── TEMPLATE: Şablon uygula, API yok ──
      if (intent.type === 'TEMPLATE' && intent.params?.templateId && editor) {
        const result = applyTemplateById(editor, intent.params.templateId);
        if (result.applied) {
          const sysMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'system',
            content: `"${result.name}" sablonu uygulandi: ${result.shapeCount} sekil eklendi. (yerel, API kullanilmadi)`,
            timestamp: new Date(),
            shapesAdded: result.shapeCount,
          };
          setMessages(prev => [...prev, sysMsg]);
          setIsLoading(false);
          return;
        }
        // Şablon bulunamadıysa AI'a devam et
      }

      // ── API çağrısı gereken intent'ler ──
      const smartContext = editor
        ? serializeSmartContext(editor, intent.contextStrategy)
        : null;

      const data = await api.post<{ response: string }>('/api/ai/chat', {
        message: text,
        boardId,
        boardState: smartContext,
        spatialText: smartContext?.spatialText || undefined,
        intent: intent.type,
      });

      // 1. Mermaid/DSL varsa canvas'a uygula
      const { displayText, bridgeResult } = await processAIResponse(editor, data.response, anchor);

      // 2. Actions varsa canvas üzerinde düzenleme yap
      let actionsExecuted = 0;
      let finalText = displayText || data.response;
      const actionsResult = editor ? extractActions(finalText) : null;
      if (actionsResult && editor) {
        const agentResult = await executeAgentActions(editor, actionsResult.actions);
        actionsExecuted = agentResult.executed;
        finalText = actionsResult.cleanText;
        if (agentResult.executed > 0) {
          finalText += `\n\n${agentResult.executed} islem canvas'a uygulandi.`;
        }
        if (agentResult.errors.length > 0) {
          finalText += `\nHatalar: ${agentResult.errors.join(', ')}`;
        }
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalText,
        rawResponse: data.response,
        timestamp: new Date(),
        shapesAdded: bridgeResult?.shapeCount,
        actionsExecuted,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Bir hata oluştu';

      if (errorText.includes('API key')) {
        setError('Claude API key ayarlanmamış. .env dosyasını kontrol edin.');
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, editor, boardId, canvasAnchor]);

  // Mermaid kodunu doğrudan canvas'a uygula
  const handleRunCode = useCallback(async () => {
    if (!editor || !codeInput.trim()) return;

    const anchor = canvasAnchor || undefined;
    const result = await applyCodeDirect(editor, codeInput.trim(), 'mermaid', anchor);

    const sysMessage: Message = {
      id: Date.now().toString(),
      role: 'system',
      content: result.applied
        ? `Mermaid kodu calisti: ${result.shapeCount} sekil eklendi.`
        : `Mermaid hatasi: ${result.errors.join(', ')}`,
      timestamp: new Date(),
      shapesAdded: result.shapeCount,
    };
    setMessages(prev => [...prev, sysMessage]);
  }, [editor, codeInput, canvasAnchor]);

  // Mesajdaki code block'u tekrar canvas'a uygula
  const handleApplyCodeBlock = useCallback(async (rawText: string) => {
    if (!editor) return;
    const anchor = canvasAnchor || undefined;

    // Mermaid dene
    const mermaid = extractMermaid(rawText);
    if (mermaid) {
      const result = await applyMermaidToCanvas(editor, mermaid.mermaidCode, anchor);
      const sysMsg: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: result.applied
          ? `Mermaid tekrar uygulandi: ${result.shapeCount} sekil eklendi.`
          : `Mermaid hatasi: ${result.errors.join(', ')}`,
        timestamp: new Date(),
        shapesAdded: result.shapeCount,
      };
      setMessages(prev => [...prev, sysMsg]);
      return;
    }

    // DSL dene
    const dsl = extractDsl(rawText);
    if (dsl) {
      const result = executeDsl(editor, dsl.dslCode, anchor);
      const sysMsg: Message = {
        id: Date.now().toString(),
        role: 'system',
        content: result.applied
          ? `DSL tekrar uygulandi: ${result.shapeCount} sekil eklendi.`
          : `DSL hatasi: ${result.errors.join(', ')}`,
        timestamp: new Date(),
        shapesAdded: result.shapeCount,
      };
      setMessages(prev => [...prev, sysMsg]);
    }
  }, [editor, canvasAnchor]);

  // Mesajda code block var mi kontrol
  const hasCodeBlock = (raw?: string): boolean => {
    if (!raw) return false;
    return raw.includes('```mermaid') || raw.includes('```dsl');
  };

  // Örnek kodu yükle
  const loadExample = useCallback((example: typeof MERMAID_EXAMPLE_LIST[0]) => {
    setCodeInput(example.code);
    setShowCodeEditor(true);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      style={{
        width: '100%',
        maxHeight: '85%',
        background: 'white',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '16px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>AI Asistan</span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setShowCodeEditor(!showCodeEditor)}
            title="Mermaid Kod Editoru"
            style={{
              background: showCodeEditor ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {'</>'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 8px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '8px 16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Code Editor Panel */}
      {showCodeEditor && (
        <div style={{
          borderBottom: '1px solid #e5e7eb',
          background: '#1e1e2e',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          maxHeight: '50%',
        }}>
          {/* Örnekler */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Mermaid</span>
            <select
              title="Ornek Sec"
              value=""
              onChange={e => {
                const idx = parseInt(e.target.value);
                if (!isNaN(idx)) loadExample(MERMAID_EXAMPLE_LIST[idx]);
              }}
              style={{
                background: '#2d2d44',
                color: '#e2e8f0',
                border: '1px solid #4a4a6a',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                flex: 1,
                minWidth: '100px',
              }}
            >
              <option value="">Ornek sec...</option>
              {MERMAID_EXAMPLE_LIST.map((ex, idx) => (
                <option key={idx} value={idx}>{ex.label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleRunCode}
              disabled={!codeInput.trim() || !editor}
              style={{
                background: codeInput.trim() ? '#10B981' : '#4a4a6a',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: codeInput.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Calistir
            </button>
          </div>

          {/* Kod giriş alanı */}
          <textarea
            value={codeInput}
            onChange={e => setCodeInput(e.target.value)}
            placeholder={'graph TD\n  A[Basla] --> B{Karar?}\n  B -->|Evet| C[Islem]\n  B -->|Hayir| D[Bitir]'}
            style={{
              background: '#2d2d44',
              color: '#e2e8f0',
              border: '1px solid #4a4a6a',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '12px',
              fontFamily: 'Consolas, Monaco, monospace',
              resize: 'vertical',
              minHeight: '100px',
              maxHeight: '250px',
              outline: 'none',
              lineHeight: '1.5',
            }}
            spellCheck={false}
          />
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 && !showCodeEditor && (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            <p style={{ marginBottom: '16px' }}>Merhaba! Tahtanız hakkında sorular sorabilirsiniz.</p>

            {/* Hızlı Örnekler */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Kod Yapistir
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {MERMAID_EXAMPLE_LIST.slice(0, 4).map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => loadExample(ex)}
                    style={{
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: '#1D4ED8',
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ fontSize: '11px', color: '#999', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              AI ile Sor
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSubmit(prompt)}
                  style={{
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
            }}
          >
            <div
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#f3f4f6',
                color: msg.role === 'user' ? 'white' : '#333',
                padding: '10px 14px',
                borderRadius: msg.role === 'user'
                  ? '12px 12px 4px 12px'
                  : '12px 12px 12px 4px',
                fontSize: '14px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}
            >
              {msg.content}
            </div>
            {msg.shapesAdded && msg.shapesAdded > 0 && (
              <div
                style={{
                  background: '#ECFDF5',
                  color: '#065F46',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {msg.shapesAdded} sekil canvas&apos;a eklendi
              </div>
            )}
            {msg.actionsExecuted && msg.actionsExecuted > 0 && (
              <div
                style={{
                  background: '#EFF6FF',
                  color: '#1E40AF',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {msg.actionsExecuted} duzenleme uygulandi
              </div>
            )}
            {msg.role === 'assistant' && hasCodeBlock(msg.rawResponse) && (
              <button
                type="button"
                onClick={() => msg.rawResponse && handleApplyCodeBlock(msg.rawResponse)}
                style={{
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: '#166534',
                  cursor: 'pointer',
                  marginTop: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: '600',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M12 8v8m-4-4h8" />
                </svg>
                Canvas&apos;a Tekrar Uygula
              </button>
            )}
            <div
              style={{
                fontSize: '10px',
                color: '#999',
                marginTop: '4px',
                textAlign: msg.role === 'user' ? 'right' : 'left',
              }}
            >
              {msg.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ alignSelf: 'flex-start' }}>
            <div
              style={{
                background: '#f3f4f6',
                padding: '12px 16px',
                borderRadius: '12px 12px 12px 4px',
                display: 'flex',
                gap: '4px',
              }}
            >
              <span style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'typing 1s infinite' }} />
              <span style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'typing 1s infinite 0.2s' }} />
              <span style={{ width: '8px', height: '8px', background: '#999', borderRadius: '50%', animation: 'typing 1s infinite 0.4s' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          gap: '8px',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Bir şey sorun..."
          style={{
            flex: 1,
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '14px',
            outline: 'none',
          }}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={isLoading || !input.trim()}
          style={{
            background: isLoading || !input.trim() ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 16px',
            cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Gönder
        </button>
      </div>

      <style jsx>{`
        @keyframes typing {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
