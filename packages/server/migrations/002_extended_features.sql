-- AbeTahta Ek Tablolar
-- Migration: 002_extended_features
-- Tarih: 2026-02-22
-- DSL scriptleri, timeline, snapshots, AI konuşmaları

-- DSL Scriptleri
CREATE TABLE IF NOT EXISTS dsl_scripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  code TEXT NOT NULL,
  compiled_shapes JSONB,
  last_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsl_scripts_board ON dsl_scripts(board_id);

-- Shape Timeline (zaman serisi)
CREATE TABLE IF NOT EXISTS shape_timeline (
  id BIGSERIAL PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  shape_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(20) NOT NULL,
  event_data JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_timeline_board ON shape_timeline(board_id);
CREATE INDEX IF NOT EXISTS idx_timeline_shape ON shape_timeline(shape_id);
CREATE INDEX IF NOT EXISTS idx_timeline_time ON shape_timeline(timestamp);

-- Board Snapshots
CREATE TABLE IF NOT EXISTS board_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name VARCHAR(200),
  snapshot_data JSONB NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_board ON board_snapshots(board_id);

-- AI Konuşma Geçmişi
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_board ON ai_conversations(board_id);

-- Aktif Oturumlar (presence tracking)
CREATE TABLE IF NOT EXISTS active_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  session_id VARCHAR(100) NOT NULL,
  user_name VARCHAR(200),
  user_color VARCHAR(20),
  cursor_x FLOAT,
  cursor_y FLOAT,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_board ON active_sessions(board_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON active_sessions(last_seen);

-- Stale session cleanup
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM active_sessions WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;
