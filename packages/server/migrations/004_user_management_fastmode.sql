-- Migration: 004_user_management_fastmode
-- Tarih: 2026-02-23
-- Açıklama: Kullanıcı yönetimi, kaydetme seçenekleri, hızlı mod ayarları

-- Kullanıcı Yönetimi ayarları
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('users.max_users', '1', 'users', 'number', 'Maks Kullanici', 'Sisteme kayıt olabilecek maksimum kullanıcı sayısı'),
  ('users.allow_registration', 'false', 'users', 'boolean', 'Kayit Izni', 'Yeni kullanıcı kaydına izin ver'),
  ('users.session_timeout', '480', 'users', 'number', 'Oturum Suresi (dk)', 'Oturum zaman aşımı süresi (dakika)')
ON CONFLICT (key) DO NOTHING;

-- Kaydetme tercihleri (board kategorisi altına ek)
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('board.auto_save_enabled', 'true', 'board', 'boolean', 'Otomatik Kaydetme', 'Değişiklikleri otomatik kaydet'),
  ('board.save_on_close', 'true', 'board', 'boolean', 'Kapatirken Kaydet', 'Tahtayı kapatırken otomatik kaydet'),
  ('board.backup_enabled', 'false', 'board', 'boolean', 'Yedekleme', 'Periyodik yedekleme yap'),
  ('board.backup_interval', '30', 'board', 'number', 'Yedek Araligi (dk)', 'Yedekleme aralığı (dakika)')
ON CONFLICT (key) DO NOTHING;

-- Hızlı Mod ayarları
INSERT INTO settings (key, value, category, type, label, description) VALUES
  ('fast.enabled', 'false', 'fast', 'boolean', 'Hizli Mod', 'AI + tek kullanıcı hızlı çalışma modu'),
  ('fast.ai_model', 'claude-haiku-4-5-20251001', 'fast', 'string', 'Hizli AI Model', 'Hızlı modda kullanılacak model (düşük gecikme)'),
  ('fast.ai_max_tokens', '2048', 'fast', 'number', 'Hizli Max Token', 'Hızlı modda maksimum token (düşük = hızlı)'),
  ('fast.auto_apply_dsl', 'true', 'fast', 'boolean', 'DSL Otomatik Uygula', 'AI yanıtındaki DSL komutlarını otomatik canvas''a uygula'),
  ('fast.skip_confirmations', 'true', 'fast', 'boolean', 'Onay Atlama', 'İşlem onay diyaloglarını atla'),
  ('fast.auto_save_interval', '500', 'fast', 'number', 'Hizli Kayit (ms)', 'Hızlı modda otomatik kaydetme aralığı'),
  ('fast.minimal_ui', 'false', 'fast', 'boolean', 'Minimal Arayuz', 'Gereksiz panelleri gizle, sadece tahta + AI göster')
ON CONFLICT (key) DO NOTHING;
