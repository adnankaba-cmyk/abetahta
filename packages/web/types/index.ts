// ============================================
// abeTahta - Tip Tanımları
// ============================================

export type ElementType =
  | 'note'
  | 'shape'
  | 'text'
  | 'checklist'
  | 'image'
  | 'flowchart_node'
  | 'drawing'
  | 'group'
  | 'frame';

export type ElementStatus = 'none' | 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';
export type Priority = 'none' | 'low' | 'medium' | 'high' | 'urgent';
export type ProjectRole = 'owner' | 'editor' | 'viewer';
export type UserRole = 'admin' | 'member' | 'viewer';

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: UserRole;
  is_active: boolean;
  last_seen_at?: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  color: string;
  icon: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  viewport_x: number;
  viewport_y: number;
  viewport_zoom: number;
  is_locked: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Element {
  id: string;
  board_id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill_color: string;
  stroke_color: string;
  stroke_width: number;
  opacity: number;
  border_radius: number;
  font_family: string;
  font_size: number;
  font_weight: string;
  text_align: string;
  content: Record<string, any>;
  z_index: number;
  parent_id?: string;
  is_locked: boolean;
  is_visible: boolean;
  created_by?: string;
  assigned_to?: string;
  status: ElementStatus;
  priority: Priority;
  tags: string[];
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  board_id: string;
  source_id: string;
  target_id: string;
  label: string;
  line_type: 'straight' | 'curved' | 'elbow' | 'step';
  source_anchor: string;
  target_anchor: string;
  stroke_color: string;
  stroke_width: number;
  arrow_start: boolean;
  arrow_end: boolean;
  waypoints: Array<{ x: number; y: number }>;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  element_id: string;
  user_id?: string;
  body: string;
  is_ai: boolean;
  parent_id?: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

// Claude API yanıt tipleri
export interface ClaudeBoardData {
  board: Board;
  elements: Element[];
  connections: Connection[];
  comments: Comment[];
  meta: {
    element_count: number;
    connection_count: number;
    comment_count: number;
    fetched_at: string;
  };
}

export interface ClaudeBoardSummary {
  board: Pick<Board, 'id' | 'name' | 'project_id'>;
  summary: {
    by_type: Array<{ type: string; count: number }>;
    by_status: Array<{ status: string; count: number }>;
    by_assignee: Array<{ display_name: string; task_count: number }>;
    by_priority: Array<{ priority: string; count: number }>;
  };
}
