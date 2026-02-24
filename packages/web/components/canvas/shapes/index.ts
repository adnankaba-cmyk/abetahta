export { KanbanShapeUtil, type KanbanShape } from './KanbanShape';
export { TimelineShapeUtil, type TimelineShape } from './TimelineShape';
export { SwotShapeUtil, type SwotShape } from './SwotShape';

import { KanbanShapeUtil } from './KanbanShape';
import { TimelineShapeUtil } from './TimelineShape';
import { SwotShapeUtil } from './SwotShape';

/** Tüm custom shape util'leri — Tldraw shapeUtils prop'una ver */
export const customShapeUtils = [KanbanShapeUtil, TimelineShapeUtil, SwotShapeUtil];
