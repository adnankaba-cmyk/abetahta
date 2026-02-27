-- ============================================
-- abeTahta - Tam Veritabanı Şeması
-- Versiyon: 2.0
-- Tarih: 2026-02-27
-- Tablolar: 16
-- Kaynak: migrations/ klasörü ile senkronize
-- Kullanım: psql -U postgres -d abetahta -f database-schema.sql
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. USERS - Kullanıcılar
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    role            VARCHAR(20) DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    is_active       BOOLEAN DEFAULT true,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- 2. PROJECTS - Projeler
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color           VARCHAR(7) DEFAULT '#3B82F6',
    icon            VARCHAR(50) DEFAULT 'folder',
    is_archived     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

-- ============================================
-- 3. PROJECT_MEMBERS - Proje Üyeleri
-- ============================================
CREATE TABLE IF NOT EXISTS project_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_pm_user ON project_members(user_id);

-- ============================================
-- 4. BOARDS - Tahtalar
-- ============================================
CREATE TABLE IF NOT EXISTS boards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    viewport_x      FLOAT DEFAULT 0,
    viewport_y      FLOAT DEFAULT 0,
    viewport_zoom   FLOAT DEFAULT 1,
    excalidraw_data JSONB DEFAULT '{}',
    tldraw_data     JSONB DEFAULT '{}',
    is_locked       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boards_project ON boards(project_id);

-- ============================================
-- 5. ELEMENTS - Tahta Elemanları
-- ============================================
CREATE TABLE IF NOT EXISTS elements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN (
                        'note', 'shape', 'text', 'checklist', 'image',
                        'flowchart_node', 'drawing', 'group', 'frame'
                    )),
    x               FLOAT NOT NULL DEFAULT 0,
    y               FLOAT NOT NULL DEFAULT 0,
    width           FLOAT NOT NULL DEFAULT 200,
    height          FLOAT NOT NULL DEFAULT 150,
    rotation        FLOAT DEFAULT 0,
    fill_color      VARCHAR(30) DEFAULT '#FFFFFF',
    stroke_color    VARCHAR(30) DEFAULT '#000000',
    stroke_width    FLOAT DEFAULT 1,
    opacity         FLOAT DEFAULT 1 CHECK (opacity >= 0 AND opacity <= 1),
    border_radius   FLOAT DEFAULT 0,
    font_family     VARCHAR(100) DEFAULT 'Inter',
    font_size       FLOAT DEFAULT 14,
    font_weight     VARCHAR(10) DEFAULT 'normal',
    text_align      VARCHAR(10) DEFAULT 'left',
    content         JSONB DEFAULT '{}',
    z_index         INTEGER DEFAULT 0,
    parent_id       UUID REFERENCES elements(id) ON DELETE SET NULL,
    is_locked       BOOLEAN DEFAULT false,
    is_visible      BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),
    status          VARCHAR(30) DEFAULT 'none' CHECK (status IN (
                        'none', 'todo', 'in_progress', 'review', 'done', 'blocked'
                    )),
    priority        VARCHAR(10) DEFAULT 'none' CHECK (priority IN (
                        'none', 'low', 'medium', 'high', 'urgent'
                    )),
    tags            TEXT[] DEFAULT '{}',
    due_date        DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elements_board    ON elements(board_id);
CREATE INDEX IF NOT EXISTS idx_elements_type     ON elements(type);
CREATE INDEX IF NOT EXISTS idx_elements_parent   ON elements(parent_id);
CREATE INDEX IF NOT EXISTS idx_elements_assigned ON elements(assigned_to);
CREATE INDEX IF NOT EXISTS idx_elements_status   ON elements(status);
CREATE INDEX IF NOT EXISTS idx_elements_content  ON elements USING GIN(content);
CREATE INDEX IF NOT EXISTS idx_elements_tags     ON elements USING GIN(tags);

-- ============================================
-- 6. CONNECTIONS - Bağlantılar
-- ============================================
CREATE TABLE IF NOT EXISTS connections (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    source_id       UUID NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    target_id       UUID NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    label           VARCHAR(200) DEFAULT '',
    line_type       VARCHAR(20) DEFAULT 'straight' CHECK (line_type IN (
                        'straight', 'curved', 'elbow', 'step'
                    )),
    source_anchor   VARCHAR(20) DEFAULT 'auto',
    target_anchor   VARCHAR(20) DEFAULT 'auto',
    stroke_color    VARCHAR(30) DEFAULT '#374151',
    stroke_width    FLOAT DEFAULT 2,
    arrow_start     BOOLEAN DEFAULT false,
    arrow_end       BOOLEAN DEFAULT true,
    waypoints       JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_board  ON connections(board_id);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_id);

-- ============================================
-- 7. COMMENTS - Yorumlar
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    element_id      UUID NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    body            TEXT NOT NULL,
    is_ai           BOOLEAN DEFAULT false,
    parent_id       UUID REFERENCES comments(id) ON DELETE CASCADE,
    is_resolved     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_element ON comments(element_id);

-- ============================================
-- 8. HISTORY - Versiyon Geçmişi
-- ============================================
CREATE TABLE IF NOT EXISTS history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    element_id      UUID REFERENCES elements(id) ON DELETE SET NULL,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(20) NOT NULL CHECK (action IN (
                        'create', 'update', 'delete', 'move', 'resize', 'style'
                    )),
    before_state    JSONB,
    after_state     JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_history_board   ON history(board_id);
CREATE INDEX IF NOT EXISTS idx_history_element ON history(element_id);
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);

-- ============================================
-- 9. TEMPLATES - Şablonlar
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50) DEFAULT 'general',
    thumbnail_url   VARCHAR(500),
    data            JSONB NOT NULL DEFAULT '{}',
    is_public       BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. NOTIFICATIONS - Bildirimler
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

-- ============================================
-- 11. SETTINGS - Uygulama Ayarları (key-value)
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL DEFAULT '',
    category        VARCHAR(50) NOT NULL DEFAULT 'system',
    type            VARCHAR(20) NOT NULL DEFAULT 'string',  -- string, number, boolean, json, secret
    label           VARCHAR(200) NOT NULL DEFAULT '',
    description     TEXT DEFAULT '',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 12. BOARD_SNAPSHOTS - Tahta Anlık Görüntüleri
-- ============================================
CREATE TABLE IF NOT EXISTS board_snapshots (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name            VARCHAR(200),
    snapshot_data   JSONB NOT NULL,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_board ON board_snapshots(board_id);

-- ============================================
-- 13. AI_CONVERSATIONS - AI Konuşma Geçmişi
-- ============================================
CREATE TABLE IF NOT EXISTS ai_conversations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    messages        JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conv_board ON ai_conversations(board_id);

-- ============================================
-- 14. ACTIVE_SESSIONS - Aktif Kullanıcı Oturumları (Presence)
-- ============================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    session_id      VARCHAR(100) NOT NULL,
    user_name       VARCHAR(200),
    user_color      VARCHAR(20),
    cursor_x        FLOAT,
    cursor_y        FLOAT,
    last_seen       TIMESTAMPTZ DEFAULT NOW(),
    connected_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_board     ON active_sessions(board_id);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON active_sessions(last_seen);

-- ============================================
-- 15. DSL_SCRIPTS - DSL Şema Scriptleri
-- ============================================
CREATE TABLE IF NOT EXISTS dsl_scripts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    code            TEXT NOT NULL,
    compiled_shapes JSONB,
    last_run_at     TIMESTAMPTZ,
    run_count       INTEGER DEFAULT 0,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dsl_scripts_board ON dsl_scripts(board_id);

-- ============================================
-- 16. SHAPE_TIMELINE - Şekil Zaman Serisi
-- ============================================
CREATE TABLE IF NOT EXISTS shape_timeline (
    id              BIGSERIAL PRIMARY KEY,
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    shape_id        VARCHAR(100) NOT NULL,
    event_type      VARCHAR(20) NOT NULL,
    event_data      JSONB NOT NULL,
    timestamp       TIMESTAMPTZ DEFAULT NOW(),
    user_id         UUID REFERENCES users(id),
    session_id      VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_timeline_board ON shape_timeline(board_id);
CREATE INDEX IF NOT EXISTS idx_timeline_shape ON shape_timeline(shape_id);
CREATE INDEX IF NOT EXISTS idx_timeline_time  ON shape_timeline(timestamp);

-- ============================================
-- AUTO-UPDATE TRİGGERLERİ
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_users_updated        BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_projects_updated     BEFORE UPDATE ON projects     FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_boards_updated       BEFORE UPDATE ON boards       FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_elements_updated     BEFORE UPDATE ON elements     FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_connections_updated  BEFORE UPDATE ON connections  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_comments_updated     BEFORE UPDATE ON comments     FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_ai_conv_updated      BEFORE UPDATE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER trg_dsl_scripts_updated  BEFORE UPDATE ON dsl_scripts  FOR EACH ROW EXECUTE FUNCTION update_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================
-- STALe SESSION TEMİZLEME
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM active_sessions WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SEED: Varsayılan ayarlar
-- ============================================
INSERT INTO settings (key, value, category, type, label, description) VALUES
    ('ai.model',          'claude-sonnet-4-6',          'ai', 'string',  'AI Model',         'Kullanılacak Claude model adı'),
    ('ai.api_key',        '',                           'ai', 'secret',  'API Key',          'Claude API anahtarı'),
    ('ai.max_tokens',     '4096',                       'ai', 'number',  'Max Token',        'AI yanıtı için maksimum token'),
    ('ai.temperature',    '0.7',                        'ai', 'number',  'Sıcaklık',         'AI yaratıcılık seviyesi (0.0-1.0)'),
    ('board.auto_save',   '2000',                       'board', 'number','Otomatik Kayıt',   'Kaydetme bekleme süresi (ms)'),
    ('board.grid',        'true',                       'board', 'boolean','Grid',            'Tahta grid çizgilerini göster'),
    ('ui.theme',          'light',                      'ui', 'string',  'Tema',             'Uygulama teması (light/dark)'),
    ('ui.language',       'tr',                         'ui', 'string',  'Dil',              'Arayüz dili'),
    ('users.max_users',   '1',                          'users', 'number','Maks Kullanıcı',  'Sisteme kayıt olabilecek max kullanıcı'),
    ('users.allow_registration', 'false',               'users', 'boolean','Kayıt İzni',     'Yeni kullanıcı kaydına izin ver'),
    ('fast.enabled',      'false',                      'fast', 'boolean','Hızlı Mod',       'AI + tek kullanıcı hızlı çalışma modu')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SEED: İlk admin kullanıcı
-- Şifre: admin123 (bcrypt hash — gerçek ortamda değiştirilmeli)
-- ============================================
INSERT INTO users (email, password_hash, display_name, role)
VALUES (
    'adnan.kaba@abeerp.com',
    '$2b$10$placeholder_hash_change_this',
    'Adnan Kaba',
    'admin'
) ON CONFLICT (email) DO NOTHING;
