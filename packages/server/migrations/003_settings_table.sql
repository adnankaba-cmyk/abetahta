-- Settings tablosu - Uygulama ayarları (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'system',
  type VARCHAR(20) NOT NULL DEFAULT 'string',  -- string, number, boolean, json, secret
  label VARCHAR(200) NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Varsayılan ayarlar — AI
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('ai.model', 'claude-sonnet-4-20250514', 'ai', 'string', 'AI Model', 'Kullanılacak Claude model adı'),
  ('ai.api_key', '', 'ai', 'secret', 'API Key', 'Claude API anahtarı'),
  ('ai.max_tokens', '4096', 'ai', 'number', 'Max Token', 'AI yanıtı için maksimum token sayısı'),
  ('ai.temperature', '0.7', 'ai', 'number', 'Sıcaklık', 'AI yaratıcılık seviyesi (0.0 - 1.0)'),
  ('ai.system_prompt', '', 'ai', 'json', 'System Prompt', 'AI için özel sistem promptu (boşsa varsayılan kullanılır)')
ON CONFLICT (key) DO NOTHING;

-- Varsayılan ayarlar — Tahta
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('board.background', 'white', 'board', 'string', 'Arka Plan', 'Varsayılan tahta arka plan rengi'),
  ('board.grid', 'true', 'board', 'boolean', 'Grid Göster', 'Tahta üzerinde grid çizgilerini göster'),
  ('board.snap', 'true', 'board', 'boolean', 'Snap', 'Nesneleri grid''e yapıştır'),
  ('board.auto_save', '2000', 'board', 'number', 'Otomatik Kaydetme (ms)', 'Değişiklik sonrası kaydetme bekleme süresi'),
  ('board.default_tool', 'select', 'board', 'string', 'Varsayılan Araç', 'Tahta açıldığında seçili araç')
ON CONFLICT (key) DO NOTHING;

-- Varsayılan ayarlar — Görünüm
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('ui.theme', 'light', 'ui', 'string', 'Tema', 'Uygulama teması (light/dark)'),
  ('ui.language', 'tr', 'ui', 'string', 'Dil', 'Arayüz dili'),
  ('ui.font_size', '14', 'ui', 'number', 'Font Boyutu', 'Varsayılan yazı tipi boyutu'),
  ('ui.show_minimap', 'true', 'ui', 'boolean', 'Mini Harita', 'Mini haritayı göster'),
  ('ui.show_shapes_panel', 'true', 'ui', 'boolean', 'Şekiller Paneli', 'Sol şekiller panelini göster'),
  ('ui.show_format_panel', 'true', 'ui', 'boolean', 'Biçim Paneli', 'Sağ biçim panelini göster')
ON CONFLICT (key) DO NOTHING;

-- Varsayılan ayarlar — Sistem
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('sys.db_host', 'localhost', 'system', 'string', 'DB Host', 'PostgreSQL sunucu adresi'),
  ('sys.db_port', '5432', 'system', 'number', 'DB Port', 'PostgreSQL port numarası'),
  ('sys.db_name', 'abetahta', 'system', 'string', 'DB Adı', 'Veritabanı adı'),
  ('sys.redis_host', 'localhost', 'system', 'string', 'Redis Host', 'Redis sunucu adresi'),
  ('sys.redis_port', '6379', 'system', 'number', 'Redis Port', 'Redis port numarası'),
  ('sys.api_port', '4000', 'system', 'number', 'API Port', 'Backend API port numarası'),
  ('sys.log_level', 'info', 'system', 'string', 'Log Seviyesi', 'Loglama seviyesi (debug/info/warn/error)')
ON CONFLICT (key) DO NOTHING;

-- Trigger: updated_at otomatik güncelle
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_settings_updated_at();
