'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Editor, TLShape } from 'tldraw';

interface TimelinePlayerProps {
  editor: Editor | null;
  isVisible: boolean;
  onClose: () => void;
}

interface ShapeEvent {
  shape: TLShape;
  timestamp: number;
  createdByName: string;
}

export function TimelinePlayer({ editor, isVisible, onClose }: TimelinePlayerProps) {
  const [events, setEvents] = useState<ShapeEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const originalOpacities = useRef<Map<string, number>>(new Map());

  // Event'leri yükle
  const loadEvents = useCallback(() => {
    if (!editor) return;

    const shapes = editor.getCurrentPageShapes();
    const shapesWithTime = shapes
      .filter(s => (s.meta as any)?.createdAt)
      .map(s => ({
        shape: s,
        timestamp: new Date((s.meta as any).createdAt).getTime(),
        createdByName: (s.meta as any).createdByName || 'Anonim',
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    setEvents(shapesWithTime);
    setCurrentIndex(0);
    setProgress(0);
  }, [editor]);

  useEffect(() => {
    if (isVisible) {
      loadEvents();
    }
  }, [isVisible, loadEvents]);

  // Oynat
  const play = useCallback(() => {
    if (!editor || events.length === 0) return;
    setIsPlaying(true);

    // Tüm shape'leri gizle
    originalOpacities.current.clear();
    events.forEach(({ shape }) => {
      originalOpacities.current.set(shape.id, shape.opacity);
      editor.updateShape({ id: shape.id, type: shape.type, opacity: 0 });
    });

    // Sırayla göster
    let idx = currentIndex;
    const showNext = () => {
      if (idx >= events.length) {
        setIsPlaying(false);
        setProgress(100);
        return;
      }

      const event = events[idx];
      editor.updateShape({
        id: event.shape.id,
        type: event.shape.type,
        opacity: originalOpacities.current.get(event.shape.id) || 1,
      });

      setCurrentIndex(idx);
      setProgress(((idx + 1) / events.length) * 100);
      idx++;

      playbackRef.current = setTimeout(showNext, 400 / speed);
    };

    showNext();
  }, [editor, events, currentIndex, speed]);

  // Durdur
  const pause = useCallback(() => {
    if (playbackRef.current) {
      clearTimeout(playbackRef.current);
    }
    setIsPlaying(false);
  }, []);

  // Reset
  const reset = useCallback(() => {
    pause();
    if (!editor) return;

    // Tüm shape'leri geri getir
    events.forEach(({ shape }) => {
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        opacity: originalOpacities.current.get(shape.id) || 1,
      });
    });

    setCurrentIndex(0);
    setProgress(0);
  }, [editor, events, pause]);

  // Slider ile git
  const seekTo = useCallback((percent: number) => {
    if (!editor || events.length === 0) return;
    pause();

    const targetIndex = Math.floor((percent / 100) * events.length);

    // Hedef index'e kadar olan shape'leri göster, sonrakileri gizle
    events.forEach((event, idx) => {
      const shouldShow = idx <= targetIndex;
      editor.updateShape({
        id: event.shape.id,
        type: event.shape.type,
        opacity: shouldShow ? (originalOpacities.current.get(event.shape.id) || 1) : 0,
      });
    });

    setCurrentIndex(targetIndex);
    setProgress(percent);
  }, [editor, events, pause]);

  if (!isVisible) return null;

  const currentEvent = events[currentIndex];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'white',
        padding: '12px',
        overflow: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Zaman Serisi Oynatıcı
        </h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#666' }}
        >
          ×
        </button>
      </div>

      {/* Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px', color: '#666' }}>
        <span>Toplam: {events.length} nesne</span>
        <span>
          {currentEvent && (
            <>
              {currentIndex + 1}/{events.length} - {currentEvent.createdByName} -{' '}
              {new Date(currentEvent.timestamp).toLocaleString('tr-TR')}
            </>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: '#E5E7EB',
          borderRadius: '4px',
          marginBottom: '12px',
          cursor: 'pointer',
          position: 'relative',
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const percent = ((e.clientX - rect.left) / rect.width) * 100;
          seekTo(Math.max(0, Math.min(100, percent)));
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '4px',
            transition: 'width 0.1s',
          }}
        />
        {/* Marker noktaları */}
        {events.map((_, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${((idx + 1) / events.length) * 100}%`,
              top: '-2px',
              width: '4px',
              height: '12px',
              background: idx <= currentIndex ? '#764ba2' : '#D1D5DB',
              borderRadius: '2px',
              transform: 'translateX(-50%)',
            }}
          />
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', alignItems: 'center' }}>
        {/* Reset */}
        <button
          onClick={reset}
          style={{
            background: '#F3F4F6',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Başa
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? pause : play}
          style={{
            background: isPlaying ? '#EF4444' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Speed */}
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          title="Oynatma hızı"
          style={{
            background: '#F3F4F6',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={4}>4x</option>
        </select>
      </div>

      {/* Event mini-list */}
      {events.length > 0 && (
        <div style={{ marginTop: '12px', maxHeight: '100px', overflowY: 'auto', fontSize: '11px', color: '#666' }}>
          {events.slice(Math.max(0, currentIndex - 2), currentIndex + 3).map((event, idx) => {
            const realIdx = Math.max(0, currentIndex - 2) + idx;
            const isCurrent = realIdx === currentIndex;
            return (
              <div
                key={event.shape.id}
                style={{
                  padding: '4px 8px',
                  background: isCurrent ? '#E0E7FF' : 'transparent',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>{realIdx + 1}. {event.shape.type}</span>
                <span>{event.createdByName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
