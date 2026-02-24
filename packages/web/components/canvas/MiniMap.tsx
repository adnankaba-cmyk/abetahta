'use client';

import { useEffect, useRef, useState } from 'react';
import { Editor } from 'tldraw';

interface MiniMapProps {
  editor: Editor | null;
  isVisible: boolean;
}

export function MiniMap({ editor, isVisible }: MiniMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, w: 100, h: 100 });

  useEffect(() => {
    if (!editor || !isVisible || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const shapes = editor.getCurrentPageShapes();
      if (shapes.length === 0) return;

      // Clear canvas
      ctx.fillStyle = '#F9FAFB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate bounds
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      shapes.forEach(shape => {
        const bounds = editor.getShapePageBounds(shape);
        if (bounds) {
          minX = Math.min(minX, bounds.x);
          minY = Math.min(minY, bounds.y);
          maxX = Math.max(maxX, bounds.x + bounds.w);
          maxY = Math.max(maxY, bounds.y + bounds.h);
        }
      });

      // Add padding
      const padding = 50;
      minX -= padding;
      minY -= padding;
      maxX += padding;
      maxY += padding;

      const contentW = maxX - minX;
      const contentH = maxY - minY;

      // Scale to fit
      const scaleX = canvas.width / contentW;
      const scaleY = canvas.height / contentH;
      const scale = Math.min(scaleX, scaleY) * 0.9;

      const offsetX = (canvas.width - contentW * scale) / 2;
      const offsetY = (canvas.height - contentH * scale) / 2;

      // Draw shapes
      shapes.forEach(shape => {
        const bounds = editor.getShapePageBounds(shape);
        if (!bounds) return;

        const x = (bounds.x - minX) * scale + offsetX;
        const y = (bounds.y - minY) * scale + offsetY;
        const w = bounds.w * scale;
        const h = bounds.h * scale;

        // Color based on shape type
        const colors: Record<string, string> = {
          geo: '#3B82F6',
          note: '#F59E0B',
          arrow: '#10B981',
          text: '#8B5CF6',
          draw: '#6B7280',
        };
        ctx.fillStyle = colors[shape.type] || '#9CA3AF';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x, y, Math.max(w, 3), Math.max(h, 3));
      });

      // Draw viewport rectangle
      const camera = editor.getCamera();
      const viewportBounds = editor.getViewportScreenBounds();

      const vpX = (-camera.x - minX) * scale + offsetX;
      const vpY = (-camera.y - minY) * scale + offsetY;
      const vpW = (viewportBounds.w / camera.z) * scale;
      const vpH = (viewportBounds.h / camera.z) * scale;

      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(vpX, vpY, vpW, vpH);

      setViewport({ x: vpX, y: vpY, w: vpW, h: vpH });
    };

    // Initial draw
    draw();

    // Update on camera change
    const interval = setInterval(draw, 200);

    return () => clearInterval(interval);
  }, [editor, isVisible]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editor || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert click to page coordinates and pan there
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    shapes.forEach(shape => {
      const bounds = editor.getShapePageBounds(shape);
      if (bounds) {
        minX = Math.min(minX, bounds.x);
        minY = Math.min(minY, bounds.y);
        maxX = Math.max(maxX, bounds.x + bounds.w);
        maxY = Math.max(maxY, bounds.y + bounds.h);
      }
    });

    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentW = maxX - minX;
    const contentH = maxY - minY;

    const canvas = canvasRef.current;
    const scaleX = canvas.width / contentW;
    const scaleY = canvas.height / contentH;
    const scale = Math.min(scaleX, scaleY) * 0.9;

    const offsetX = (canvas.width - contentW * scale) / 2;
    const offsetY = (canvas.height - contentH * scale) / 2;

    const pageX = (x - offsetX) / scale + minX;
    const pageY = (y - offsetY) / scale + minY;

    const viewportBounds = editor.getViewportScreenBounds();
    const camera = editor.getCamera();

    editor.setCamera({
      x: -pageX + viewportBounds.w / 2 / camera.z,
      y: -pageY + viewportBounds.h / 2 / camera.z,
      z: camera.z,
    });
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        right: '20px',
        width: '180px',
        height: '120px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        zIndex: 800,
        border: '1px solid #E5E7EB',
      }}
    >
      <canvas
        ref={canvasRef}
        width={180}
        height={120}
        onClick={handleClick}
        style={{ cursor: 'crosshair', display: 'block' }}
      />
      <div
        style={{
          position: 'absolute',
          top: '4px',
          left: '4px',
          fontSize: '9px',
          color: '#666',
          background: 'rgba(255,255,255,0.8)',
          padding: '2px 4px',
          borderRadius: '2px',
        }}
      >
        Mini Harita
      </div>
    </div>
  );
}
