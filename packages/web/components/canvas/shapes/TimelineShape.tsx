/**
 * Timeline Custom Shape
 * Yatay zaman çizelgesi — olaylar kronolojik sırada gösterilir.
 */

import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw';

type TimelineProps = {
  w: number;
  h: number;
  events: { label: string; detail?: string; color?: string }[];
  lineColor: string;
};

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    timeline: TimelineProps;
  }
}

export type TimelineShape = TLBaseShape<'timeline', TimelineProps>;

export class TimelineShapeUtil extends ShapeUtil<TimelineShape> {
  static override type = 'timeline' as string;

  getDefaultProps(): TimelineProps {
    return {
      w: 700,
      h: 180,
      events: [
        { label: 'Baslangic', detail: 'Proje basliyor', color: '#10B981' },
        { label: 'Gelistirme', detail: 'Kodlama', color: '#3B82F6' },
        { label: 'Test', detail: 'QA sureci', color: '#F59E0B' },
        { label: 'Yayin', detail: 'Production', color: '#EF4444' },
      ],
      lineColor: '#6366F1',
    };
  }

  getGeometry(shape: TimelineShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override canResize() { return true; }

  component(shape: TimelineShape) {
    const { w, h, events, lineColor } = shape.props;
    const padding = 40;
    const lineY = h * 0.5;
    const eventSpacing = (w - padding * 2) / Math.max(events.length - 1, 1);

    return (
      <HTMLContainer>
        <div style={{
          width: w,
          height: h,
          background: 'white',
          border: '2px solid #E5E7EB',
          borderRadius: '8px',
          position: 'relative',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          pointerEvents: 'all',
        }}>
          {/* Main line */}
          <div style={{
            position: 'absolute',
            left: padding,
            right: padding,
            top: lineY - 2,
            height: '4px',
            background: lineColor,
            borderRadius: '2px',
          }} />

          {/* Events */}
          {events.map((event, i) => {
            const x = padding + i * eventSpacing;
            const isAbove = i % 2 === 0;

            return (
              <div key={i} style={{
                position: 'absolute',
                left: x - 50,
                top: isAbove ? lineY - 70 : lineY + 16,
                width: '100px',
                textAlign: 'center',
              }}>
                {/* Dot */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: isAbove ? '100%' : '-16px',
                  transform: 'translateX(-50%)',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: event.color || lineColor,
                  border: '3px solid white',
                  boxShadow: '0 0 0 2px ' + (event.color || lineColor),
                }} />

                {/* Label */}
                <div style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#1F2937',
                  marginBottom: isAbove ? '4px' : undefined,
                  marginTop: isAbove ? undefined : '4px',
                }}>
                  {event.label}
                </div>
                {event.detail && (
                  <div style={{
                    fontSize: '10px',
                    color: '#6B7280',
                  }}>
                    {event.detail}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: TimelineShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
