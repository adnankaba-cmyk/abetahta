-- ============================================
-- abeTahta - Veritabanı Şeması
-- PostgreSQL 16+
-- Oluşturma: psql -U postgres -d abetahta -f database-schema.sql
-- ============================================

-- UUID eklentisi
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. USERS - Kullanıcılar
-- ============================================
CREATE TABLE users (
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

CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 2. PROJECTS - Projeler
-- ============================================
CREATE TABLE projects (
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

CREATE INDEX idx_projects_owner ON projects(owner_id);

-- ============================================
-- 3. PROJECT_MEMBERS - Proje Üyeleri
-- ============================================
CREATE TABLE project_members (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'editor' CHECK (role IN ('owner', 'editor', 'viewer')),
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, user_id)
);

CREATE INDEX idx_pm_project ON project_members(project_id);
CREATE INDEX idx_pm_user ON project_members(user_id);

-- ============================================
-- 4. BOARDS - Tahtalar
-- ============================================
CREATE TABLE boards (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    viewport_x      FLOAT DEFAULT 0,
    viewport_y      FLOAT DEFAULT 0,
    viewport_zoom   FLOAT DEFAULT 1,
    excalidraw_data JSONB DEFAULT '{}',  -- Excalidraw canvas verisi (eski uyumluluk)
    tldraw_data     JSONB DEFAULT '{}',  -- tldraw canvas verisi
    is_locked       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boards_project ON boards(project_id);

-- ============================================
-- 5. ELEMENTS - Tahta Elemanları (KRİTİK TABLO)
-- ============================================
CREATE TABLE elements (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL CHECK (type IN (
                        'note', 'shape', 'text', 'checklist', 'image',
                        'flowchart_node', 'drawing', 'group', 'frame'
                    )),
    -- Pozisyon
    x               FLOAT NOT NULL DEFAULT 0,
    y               FLOAT NOT NULL DEFAULT 0,
    width           FLOAT NOT NULL DEFAULT 200,
    height          FLOAT NOT NULL DEFAULT 150,
    rotation        FLOAT DEFAULT 0,

    -- Görünüm
    fill_color      VARCHAR(30) DEFAULT '#FFFFFF',
    stroke_color    VARCHAR(30) DEFAULT '#000000',
    stroke_width    FLOAT DEFAULT 1,
    opacity         FLOAT DEFAULT 1 CHECK (opacity >= 0 AND opacity <= 1),
    border_radius   FLOAT DEFAULT 0,
    font_family     VARCHAR(100) DEFAULT 'Inter',
    font_size       FLOAT DEFAULT 14,
    font_weight     VARCHAR(10) DEFAULT 'normal',
    text_align      VARCHAR(10) DEFAULT 'left',

    -- İçerik (Esnek JSONB yapısı)
    content         JSONB DEFAULT '{}',
    /*
      note:           { "title": "...", "body": "...", "color": "yellow" }
      shape:          { "shape_type": "rectangle|circle|diamond|triangle" }
      text:           { "text": "...", "rich_text": [...] }
      checklist:      { "title": "...", "items": [{"text":"...", "done": false}] }
      image:          { "url": "...", "alt": "..." }
      flowchart_node: { "label": "...", "node_type": "start|process|decision|end|io" }
      drawing:        { "paths": [...], "tool": "pen|marker|eraser" }
      group:          { "name": "...", "collapsed": false }
      frame:          { "name": "...", "clip_content": true }
    */

    -- Katman & Hiyerarşi
    z_index         INTEGER DEFAULT 0,
    parent_id       UUID REFERENCES elements(id) ON DELETE SET NULL,
    is_locked       BOOLEAN DEFAULT false,
    is_visible      BOOLEAN DEFAULT true,

    -- Atama & İş Takibi
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

    -- Zaman
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_elements_board ON elements(board_id);
CREATE INDEX idx_elements_type ON elements(type);
CREATE INDEX idx_elements_parent ON elements(parent_id);
CREATE INDEX idx_elements_assigned ON elements(assigned_to);
CREATE INDEX idx_elements_status ON elements(status);
CREATE INDEX idx_elements_content ON elements USING GIN(content);
CREATE INDEX idx_elements_tags ON elements USING GIN(tags);

-- ============================================
-- 6. CONNECTIONS - Bağlantılar (Oklar/Çizgiler)
-- ============================================
CREATE TABLE connections (
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

CREATE INDEX idx_connections_board ON connections(board_id);
CREATE INDEX idx_connections_source ON connections(source_id);
CREATE INDEX idx_connections_target ON connections(target_id);

-- ============================================
-- 7. COMMENTS - Yorumlar
-- ============================================
CREATE TABLE comments (
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

CREATE INDEX idx_comments_element ON comments(element_id);

-- ============================================
-- 8. HISTORY - Versiyon Geçmişi
-- ============================================
CREATE TABLE history (
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

CREATE INDEX idx_history_board ON history(board_id);
CREATE INDEX idx_history_element ON history(element_id);
CREATE INDEX idx_history_created ON history(created_at DESC);

-- ============================================
-- 9. TEMPLATES - Şablonlar
-- ============================================
CREATE TABLE templates (
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
-- AUTO-UPDATE TRİGGERLERİ
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_boards_updated BEFORE UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_elements_updated BEFORE UPDATE ON elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_connections_updated BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_comments_updated BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED: İlk admin kullanıcı
-- ============================================
-- Şifre: admin123 (bcrypt hash)
-- Gerçek ortamda değiştirilmeli
INSERT INTO users (email, password_hash, display_name, role)
VALUES (
    'adnan.kaba@abeerp.com',
    '$2b$10$placeholder_hash_change_this',
    'Adnan Kaba',
    'admin'
) ON CONFLICT (email) DO NOTHING;
