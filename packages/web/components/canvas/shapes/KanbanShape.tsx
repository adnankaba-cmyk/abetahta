/**
 * Kanban Board Custom Shape
 * Sütunlu kanban tahtası — her sütunda kartlar barındırır.
 */

import { HTMLContainer, Rectangle2d, ShapeUtil, TLBaseShape } from 'tldraw';

type KanbanProps = {
  w: number;
  h: number;
  columns: string[];
  cards: string[][];
  headerColor: string;
};

declare module 'tldraw' {
  interface TLGlobalShapePropsMap {
    kanban: KanbanProps;
  }
}

export type KanbanShape = TLBaseShape<'kanban', KanbanProps>;

export class KanbanShapeUtil extends ShapeUtil<KanbanShape> {
  static override type = 'kanban' as string;

  getDefaultProps(): KanbanProps {
    return {
      w: 600,
      h: 400,
      columns: ['Yapilacak', 'Devam Eden', 'Tamamlanan'],
      cards: [
        ['Gorev 1', 'Gorev 2'],
        ['Gorev 3'],
        ['Gorev 4'],
      ],
      headerColor: '#6366F1',
    };
  }

  getGeometry(shape: KanbanShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override canResize() { return true; }
  override canEdit() { return true; }

  component(shape: KanbanShape) {
    const { w, h, columns, cards, headerColor } = shape.props;
    const colW = w / columns.length;

    return (
      <HTMLContainer>
        <div style={{
          width: w,
          height: h,
          background: '#F9FAFB',
          border: '2px solid #E5E7EB',
          borderRadius: '8px',
          display: 'flex',
          overflow: 'hidden',
          fontFamily: 'Segoe UI, Arial, sans-serif',
          pointerEvents: 'all',
        }}>
          {columns.map((col, ci) => (
            <div key={ci} style={{
              width: colW,
              borderRight: ci < columns.length - 1 ? '1px solid #E5E7EB' : undefined,
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Column header */}
              <div style={{
                padding: '8px 12px',
                background: headerColor,
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                textAlign: 'center',
              }}>
                {col}
                <span style={{
                  background: 'rgba(255,255,255,0.3)',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '11px',
                  marginLeft: '6px',
                }}>
                  {cards[ci]?.length || 0}
                </span>
              </div>

              {/* Cards */}
              <div style={{
                flex: 1,
                padding: '8px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}>
                {(cards[ci] || []).map((card, ki) => (
                  <div key={ki} style={{
                    background: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    fontSize: '12px',
                    color: '#374151',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}>
                    {card}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: KanbanShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />;
  }
}
