-- ============================================
-- abeTahta - Veritabanı Şeması
-- Versiyon: 1.0
-- Tarih: 21 Şubat 2026
-- ============================================

-- UUID desteği
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- KULLANICILAR
-- ============================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    avatar_url      VARCHAR(500),
    role            VARCHAR(20) DEFAULT 'member',
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    last_seen_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJELER
-- ============================================
CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    owner_id        UUID REFERENCES users(id),
    color           VARCHAR(7) DEFAULT '#3B82F6',
    icon            VARCHAR(50) DEFAULT 'folder',
    is_archived     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJE ÜYELERİ
-- ============================================
CREATE TABLE project_members (
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    role            VARCHAR(20) DEFAULT 'editor',
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (project_id, user_id)
);

-- ============================================
-- TAHTALAR
-- ============================================
CREATE TABLE boards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    thumbnail_url   VARCHAR(500),
    viewport_x      FLOAT DEFAULT 0,
    viewport_y      FLOAT DEFAULT 0,
    viewport_zoom   FLOAT DEFAULT 1.0,
    tldraw_data     JSONB,
    is_locked       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ELEMANLAR
-- ============================================
CREATE TABLE elements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    type            VARCHAR(30) NOT NULL,
    x               FLOAT NOT NULL DEFAULT 0,
    y               FLOAT NOT NULL DEFAULT 0,
    width           FLOAT DEFAULT 200,
    height          FLOAT DEFAULT 100,
    rotation        FLOAT DEFAULT 0,
    fill_color      VARCHAR(30) DEFAULT '#FFFFFF',
    stroke_color    VARCHAR(30) DEFAULT '#000000',
    stroke_width    FLOAT DEFAULT 1,
    opacity         FLOAT DEFAULT 1.0,
    border_radius   FLOAT DEFAULT 0,
    font_size       FLOAT DEFAULT 14,
    font_family     VARCHAR(50) DEFAULT 'Inter',
    font_weight     VARCHAR(10) DEFAULT 'normal',
    text_align      VARCHAR(10) DEFAULT 'left',
    content         JSONB DEFAULT '{}',
    z_index         INT DEFAULT 0,
    parent_id       UUID REFERENCES elements(id),
    is_locked       BOOLEAN DEFAULT false,
    is_visible      BOOLEAN DEFAULT true,
    created_by      UUID REFERENCES users(id),
    assigned_to     UUID REFERENCES users(id),
    status          VARCHAR(20) DEFAULT 'none',
    tags            TEXT[] DEFAULT '{}',
    due_date        TIMESTAMPTZ,
    priority        VARCHAR(20) DEFAULT 'none',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BAĞLANTILAR
-- ============================================
CREATE TABLE connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    source_id       UUID REFERENCES elements(id) ON DELETE CASCADE,
    target_id       UUID REFERENCES elements(id) ON DELETE CASCADE,
    source_anchor   VARCHAR(10) DEFAULT 'bottom',
    target_anchor   VARCHAR(10) DEFAULT 'top',
    line_type       VARCHAR(20) DEFAULT 'straight',
    stroke_color    VARCHAR(30) DEFAULT '#6B7280',
    stroke_width    FLOAT DEFAULT 2,
    stroke_style    VARCHAR(10) DEFAULT 'solid',
    arrow_start     BOOLEAN DEFAULT false,
    arrow_end       BOOLEAN DEFAULT true,
    label           VARCHAR(500),
    label_position  FLOAT DEFAULT 0.5,
    waypoints       JSONB DEFAULT '[]',
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- YORUMLAR
-- ============================================
CREATE TABLE comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    element_id      UUID REFERENCES elements(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    body            TEXT NOT NULL,
    is_ai           BOOLEAN DEFAULT false,
    parent_id       UUID REFERENCES comments(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VERSİYON GEÇMİŞİ
-- ============================================
CREATE TABLE history (
    id              BIGSERIAL PRIMARY KEY,
    board_id        UUID REFERENCES boards(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(20) NOT NULL,
    element_id      UUID,
    before_state    JSONB,
    after_state     JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ŞABLONLAR
-- ============================================
CREATE TABLE templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    category        VARCHAR(50),
    thumbnail_url   VARCHAR(500),
    content         JSONB NOT NULL,
    is_public       BOOLEAN DEFAULT false,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- İNDEKSLER
-- ============================================
CREATE INDEX idx_elements_board ON elements(board_id);
CREATE INDEX idx_elements_type ON elements(board_id, type);
CREATE INDEX idx_elements_parent ON elements(parent_id);
CREATE INDEX idx_elements_assigned ON elements(assigned_to);
CREATE INDEX idx_elements_status ON elements(board_id, status);
CREATE INDEX idx_elements_content ON elements USING GIN(content);
CREATE INDEX idx_connections_board ON connections(board_id);
CREATE INDEX idx_connections_source ON connections(source_id);
CREATE INDEX idx_connections_target ON connections(target_id);
CREATE INDEX idx_comments_element ON comments(element_id);
CREATE INDEX idx_history_board ON history(board_id, created_at DESC);
CREATE INDEX idx_history_element ON history(element_id);
CREATE INDEX idx_boards_project ON boards(project_id);
CREATE INDEX idx_projects_owner ON projects(owner_id);

-- ============================================
-- UPDATED_AT OTOMATİK GÜNCELLEME
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_projects_updated BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_boards_updated BEFORE UPDATE ON boards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_elements_updated BEFORE UPDATE ON elements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_connections_updated BEFORE UPDATE ON connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_comments_updated BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- BİLDİRİMLER
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type            VARCHAR(50) NOT NULL,
    title           VARCHAR(255) NOT NULL,
    message         TEXT,
    data            JSONB DEFAULT '{}',
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
