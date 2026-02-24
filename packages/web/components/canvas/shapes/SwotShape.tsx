/**
 * SWOT Analysis Custom Shape
 * 2x2 grid: Strengths, Weaknesses, Opportunities, Threats
 */

import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw';

type SwotProps = {
  w: number;
  h: number;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  title: string;
};

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    swot: SwotProps;
  }
}

export type SwotShape = TLBaseShape<'swot', SwotProps>;

export class SwotShapeUtil extends ShapeUtil<SwotShape> {
  static override type = 'swot' as string;

  getDefaultProps(): SwotProps {
    return {
      w: 500,
      h: 400,
      strengths: ['Guclu takim', 'Teknoloji altyapisi'],
      weaknesses: ['Sinirli butce', 'Az deneyim'],
      opportunities: ['Buyuyen pazar', 'Yeni trendler'],
      threats: ['Rekabet', 'Yasal degisiklikler'],
      title: 'SWOT Analizi',
    };
  }

  getGeometry(shape: SwotShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override canResize() { return true; }

  component(shape: SwotShape) {
    const { w, h, strengths, weaknesses, opportunities, threats, title } = shape.props;
    const titleH = 36;
    const cellW = w / 2;
    const cellH = (h - titleH) / 2;

    const quadrants = [
      { label: 'Guclü Yanlar', items: strengths, bg: '#ECFDF5', color: '#065F46', icon: 'S' },
      { label: 'Zayif Yanlar', items: weaknesses, bg: '#FEF2F2', color: '#991B1B', icon: 'W' },
      { label: 'Firsatlar', items: opportunities, bg: '#EFF6FF', color: '#1E40AF', icon: 'O' },
      { label: 'Tehditler', items: threats, bg: '#FFFBEB', color: '#92400E', icon: 'T' },
    ];

    return (
      <HTMLContainer>
        <div style={{
          width: w,
          height: h,
          background: 'white',
          border: '2px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'hidden',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          pointerEvents: 'all',
        }}>
          {/* Title */}
          <div style={{
            height: titleH,
            background: '#1F2937',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '700',
            letterSpacing: '1px',
          }}>
            {title}
          </div>

          {/* 2x2 Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            height: h - titleH,
          }}>
            {quadrants.map((q, i) => (
              <div key={i} style={{
                background: q.bg,
                padding: '10px 12px',
                borderRight: i % 2 === 0 ? '1px solid #E5E7EB' : undefined,
                borderBottom: i < 2 ? '1px solid #E5E7EB' : undefined,
                overflow: 'hidden',
              }}>
                {/* Quadrant header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '4px',
                    background: q.color,
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}>
                    {q.icon}
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: q.color,
                  }}>
                    {q.label}
                  </span>
                </div>

                {/* Items */}
                {q.items.map((item, j) => (
                  <div key={j} style={{
                    fontSize: '11px',
                    color: '#374151',
                    padding: '3px 0',
                    borderBottom: j < q.items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : undefined,
                  }}>
                    • {item}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: SwotShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
