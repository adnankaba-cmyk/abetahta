'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/store/toast';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';

interface Setting {
  key: string;
  value: string;
  category: string;
  type: string;
  label: string;
  description: string;
  updated_at: string;
}

interface UserInfo {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  avatar_url: string | null;
  last_seen_at: string | null;
  created_at: string;
}

type TabKey = 'ai' | 'board' | 'ui' | 'system' | 'users' | 'fast';

const TABS: { key: TabKey; label: string; icon: string; color: string }[] = [
  { key: 'ai', label: 'AI Ayarlari', icon: '🤖', color: '#8B5CF6' },
  { key: 'fast', label: 'Hizli Mod', icon: '⚡', color: '#F97316' },
  { key: 'board', label: 'Tahta', icon: '📋', color: '#3B82F6' },
  { key: 'ui', label: 'Gorunum', icon: '🎨', color: '#F59E0B' },
  { key: 'users', label: 'Kullanicilar', icon: '👥', color: '#10B981' },
  { key: 'system', label: 'Sistem', icon: '⚙️', color: '#EF4444' },
];

const AI_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-6',
];

const THEMES = [
  { value: 'light', label: 'Acik' },
  { value: 'dark', label: 'Koyu' },
];

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

const BOARD_TOOLS = [
  { value: 'select', label: 'Sec' },
  { value: 'draw', label: 'Ciz' },
  { value: 'hand', label: 'Tasi' },
];

const ROLES = [
  { value: 'admin', label: 'Admin', color: '#EF4444' },
  { value: 'member', label: 'Uye', color: '#3B82F6' },
  { value: 'viewer', label: 'Izleyici', color: '#6B7280' },
];

export default function AdminPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('ai');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersActive, setUsersActive] = useState(0);
  const { user } = useAuthStore();
  const router = useRouter();

  // Ayarları yükle
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.get<{ settings: Setting[] }>('/api/settings');
      setSettings(data.settings);
      const vals: Record<string, string> = {};
      data.settings.forEach(s => { vals[s.key] = s.value; });
      setEditedValues(vals);
    } catch (err) {
      toast.error('Ayarlar yuklenemedi: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Kullanıcıları yükle
  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get<{ users: UserInfo[]; total: number; active: number }>('/api/auth/users');
      setUsers(data.users);
      setUsersTotal(data.total);
      setUsersActive(data.active);
    } catch {
      // Sessizce geç — yetki yoksa kullanıcılar gösterilmez
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadUsers();
  }, [loadSettings, loadUsers]);

  const handleChange = (key: string, value: string) => {
    setEditedValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const changed: Record<string, string> = {};
      settings.forEach(s => {
        if (editedValues[s.key] !== s.value) {
          changed[s.key] = editedValues[s.key];
        }
      });

      if (Object.keys(changed).length === 0) {
        toast.info('Degisiklik yok');
        setIsSaving(false);
        return;
      }

      const result = await api.put<{ updated: string[]; count: number }>('/api/settings', { settings: changed });
      toast.success(`${result.count} ayar guncellendi`);
      await loadSettings();
    } catch (err) {
      toast.error('Kayit basarisiz: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    } finally {
      setIsSaving(false);
    }
  };

  // Kullanıcı rolü değiştir
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await api.put<{ user: UserInfo }>(`/api/auth/users/${userId}/role`, { role: newRole });
      toast.success('Rol guncellendi');
      await loadUsers();
    } catch (err) {
      toast.error('Rol degistirilemedi: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // Kullanıcı aktif/pasif
  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await api.put<{ user: UserInfo }>(`/api/auth/users/${userId}/status`, { is_active: !currentActive });
      toast.success(currentActive ? 'Kullanici deaktif edildi' : 'Kullanici aktif edildi');
      await loadUsers();
    } catch (err) {
      toast.error((err instanceof Error ? err.message : 'Hata'));
    }
  };

  // Hızlı Mod toggle — tek tıkla aç/kapat
  const handleFastModeToggle = async () => {
    const currentVal = editedValues['fast.enabled'] || 'false';
    const newVal = currentVal === 'true' ? 'false' : 'true';
    handleChange('fast.enabled', newVal);
    // Hemen kaydet
    try {
      await api.put<{ updated: string[]; count: number }>('/api/settings', {
        settings: { 'fast.enabled': newVal }
      });
      toast.success(newVal === 'true' ? 'Hizli Mod AKTIF' : 'Hizli Mod KAPALI');
      await loadSettings();
    } catch (err) {
      toast.error('Hizli mod degistirilemedi: ' + (err instanceof Error ? err.message : ''));
    }
  };

  // Kategoriye göre filtrele
  const filteredSettings = settings.filter(s => s.category === activeTab);

  // Değişiklik var mı?
  const hasChanges = settings.some(s => editedValues[s.key] !== s.value);

  // Hızlı mod aktif mi?
  const fastModeEnabled = editedValues['fast.enabled'] === 'true';

  // Zaman formatı
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'Hic';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Simdi';
    if (mins < 60) return `${mins}dk once`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}sa once`;
    const days = Math.floor(hours / 24);
    return `${days}g once`;
  };

  // Input render
  const renderInput = (setting: Setting) => {
    const value = editedValues[setting.key] ?? setting.value;

    // Select tipi kontrolü
    if (setting.key === 'ai.model' || setting.key === 'fast.ai_model') {
      return (
        <select value={value} onChange={e => handleChange(setting.key, e.target.value)} style={selectStyle}>
          {AI_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      );
    }
    if (setting.key === 'ui.theme') {
      return (
        <select value={value} onChange={e => handleChange(setting.key, e.target.value)} style={selectStyle}>
          {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      );
    }
    if (setting.key === 'sys.log_level') {
      return (
        <select value={value} onChange={e => handleChange(setting.key, e.target.value)} style={selectStyle}>
          {LOG_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      );
    }
    if (setting.key === 'board.default_tool') {
      return (
        <select value={value} onChange={e => handleChange(setting.key, e.target.value)} style={selectStyle}>
          {BOARD_TOOLS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      );
    }

    // Boolean
    if (setting.type === 'boolean') {
      return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => handleChange(setting.key, e.target.checked ? 'true' : 'false')}
            style={{ width: '18px', height: '18px', accentColor: '#3B82F6' }}
          />
          <span style={{ fontSize: '13px', color: value === 'true' ? '#059669' : '#9CA3AF' }}>
            {value === 'true' ? 'Aktif' : 'Pasif'}
          </span>
        </label>
      );
    }

    // Secret
    if (setting.type === 'secret') {
      return (
        <input
          type="password"
          value={value}
          onChange={e => handleChange(setting.key, e.target.value)}
          placeholder="API Key giriniz..."
          style={inputStyle}
        />
      );
    }

    // Number
    if (setting.type === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={e => handleChange(setting.key, e.target.value)}
          style={inputStyle}
        />
      );
    }

    // JSON (system prompt gibi uzun alan)
    if (setting.type === 'json') {
      return (
        <textarea
          value={value}
          onChange={e => handleChange(setting.key, e.target.value)}
          placeholder={setting.description}
          rows={4}
          style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'Consolas, monospace', fontSize: '12px' }}
        />
      );
    }

    // String (default)
    return (
      <input
        type="text"
        value={value}
        onChange={e => handleChange(setting.key, e.target.value)}
        style={inputStyle}
      />
    );
  };

  // Kullanıcılar tab'ı render
  const renderUsersTab = () => (
    <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
      {/* Özet Kartları */}
      <div style={{ padding: '20px', borderBottom: '1px solid #E5E7EB', display: 'flex', gap: '16px' }}>
        <div style={{
          flex: 1, padding: '16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #BBF7D0',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#16A34A' }}>{usersTotal}</div>
          <div style={{ fontSize: '12px', color: '#4ADE80' }}>Toplam Kullanici</div>
        </div>
        <div style={{
          flex: 1, padding: '16px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#2563EB' }}>{usersActive}</div>
          <div style={{ fontSize: '12px', color: '#60A5FA' }}>Aktif (son 15dk)</div>
        </div>
        <div style={{
          flex: 1, padding: '16px', background: '#FFF7ED', borderRadius: '8px', border: '1px solid #FED7AA',
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#EA580C' }}>
            {editedValues['users.max_users'] || '1'}
          </div>
          <div style={{ fontSize: '12px', color: '#FB923C' }}>Maks Kapasite</div>
        </div>
      </div>

      {/* Kullanıcı Ayarları */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>Kullanici Ayarlari</h3>
      </div>
      <div style={{ padding: '8px 0', borderBottom: '1px solid #E5E7EB' }}>
        {filteredSettings.map((setting, idx) => (
          <div key={setting.key} style={{
            padding: '12px 20px',
            borderBottom: idx < filteredSettings.length - 1 ? '1px solid #F3F4F6' : 'none',
            display: 'flex', alignItems: 'center', gap: '16px',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{setting.label}</div>
              <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{setting.description}</div>
            </div>
            <div style={{ minWidth: '200px' }}>{renderInput(setting)}</div>
          </div>
        ))}
      </div>

      {/* Kullanıcı Listesi */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#374151' }}>
          Kayitli Kullanicilar ({users.length})
        </h3>
      </div>
      <div>
        {users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
            Kayitli kullanici yok
          </div>
        ) : (
          users.map((u, idx) => {
            const isOnline = u.last_seen_at && (new Date().getTime() - new Date(u.last_seen_at).getTime()) < 15 * 60 * 1000;
            const isSelf = u.id === user?.id;
            return (
              <div key={u.id} style={{
                padding: '14px 20px',
                borderBottom: idx < users.length - 1 ? '1px solid #F3F4F6' : 'none',
                display: 'flex', alignItems: 'center', gap: '12px',
                opacity: u.is_active ? 1 : 0.5,
              }}>
                {/* Avatar */}
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isOnline ? '#10B981' : '#D1D5DB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '14px', fontWeight: '600',
                  position: 'relative',
                }}>
                  {u.display_name.charAt(0).toUpperCase()}
                  {isOnline && (
                    <div style={{
                      position: 'absolute', bottom: '-1px', right: '-1px',
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#10B981', border: '2px solid white',
                    }} />
                  )}
                </div>

                {/* Bilgiler */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                    {u.display_name}
                    {isSelf && <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '6px' }}>(sen)</span>}
                    {!u.is_active && <span style={{ fontSize: '11px', color: '#EF4444', marginLeft: '6px' }}>deaktif</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{u.email}</div>
                </div>

                {/* Son görülme */}
                <div style={{ fontSize: '12px', color: '#9CA3AF', minWidth: '80px', textAlign: 'right' }}>
                  {formatTime(u.last_seen_at)}
                </div>

                {/* Rol */}
                <select
                  title={`${u.display_name} rolu`}
                  value={u.role}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  disabled={isSelf}
                  style={{
                    ...selectStyle,
                    width: '110px',
                    fontSize: '12px',
                    padding: '4px 8px',
                    color: ROLES.find(r => r.value === u.role)?.color || '#374151',
                  }}
                >
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>

                {/* Aktif/Pasif */}
                {!isSelf && (
                  <button
                    onClick={() => handleToggleActive(u.id, u.is_active)}
                    style={{
                      padding: '4px 10px', border: '1px solid #E5E7EB', borderRadius: '4px',
                      background: u.is_active ? '#FEF2F2' : '#F0FDF4',
                      color: u.is_active ? '#DC2626' : '#16A34A',
                      cursor: 'pointer', fontSize: '11px',
                    }}
                  >
                    {u.is_active ? 'Deaktif' : 'Aktif'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // Hızlı Mod tab'ı — üst kısımda büyük toggle
  const renderFastModeTab = () => (
    <div>
      {/* Büyük toggle kartı */}
      <div style={{
        background: fastModeEnabled ? '#FFF7ED' : 'white',
        borderRadius: '8px',
        border: `2px solid ${fastModeEnabled ? '#F97316' : '#E5E7EB'}`,
        padding: '24px',
        marginBottom: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: fastModeEnabled ? '#EA580C' : '#374151' }}>
            ⚡ Hizli Mod {fastModeEnabled ? 'AKTIF' : 'KAPALI'}
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            AI + tek kullanici hizli calisma modu. Dusuk gecikme, otomatik DSL uygulama, minimal arayuz.
          </div>
          {fastModeEnabled && (
            <div style={{ fontSize: '12px', color: '#F97316', marginTop: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span>Model: {editedValues['fast.ai_model'] || 'haiku'}</span>
              <span>Token: {editedValues['fast.ai_max_tokens'] || '2048'}</span>
              <span>Kayit: {editedValues['fast.auto_save_interval'] || '500'}ms</span>
            </div>
          )}
        </div>
        <button
          onClick={handleFastModeToggle}
          style={{
            padding: '12px 28px',
            border: 'none',
            borderRadius: '8px',
            background: fastModeEnabled ? '#EF4444' : '#F97316',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '700',
            transition: 'all 0.2s',
          }}
        >
          {fastModeEnabled ? 'KAPAT' : 'AKTIF ET'}
        </button>
      </div>

      {/* Ayar detayları */}
      <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #E5E7EB', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E5E7EB', background: '#FAFAFA' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
            ⚡ Hizli Mod Detaylari
          </h2>
        </div>
        <div style={{ padding: '8px 0' }}>
          {filteredSettings.filter(s => s.key !== 'fast.enabled').map((setting, idx, arr) => (
            <div key={setting.key} style={{
              padding: '16px 20px',
              borderBottom: idx < arr.length - 1 ? '1px solid #F3F4F6' : 'none',
              display: 'flex', alignItems: 'flex-start', gap: '16px',
              opacity: fastModeEnabled ? 1 : 0.5,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
                  {setting.label}
                </div>
                <div style={{ fontSize: '12px', color: '#9CA3AF' }}>{setting.description}</div>
                <div style={{ fontSize: '10px', color: '#D1D5DB', marginTop: '2px' }}>{setting.key}</div>
              </div>
              <div style={{ minWidth: '280px', maxWidth: '400px' }}>
                {renderInput(setting)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F9FAFB' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙️</div>
          <div style={{ color: '#6B7280', fontSize: '14px' }}>Ayarlar yukleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'Segoe UI, Arial, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #E5E7EB',
        padding: '16px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => router.push('/dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#6B7280' }}
            title="Dashboard'a don"
          >
            ←
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#111827' }}>
            Yonetim Paneli
          </h1>
          {user && (
            <span style={{ fontSize: '13px', color: '#9CA3AF', marginLeft: '8px' }}>
              {user.display_name} ({user.role})
            </span>
          )}
          {fastModeEnabled && (
            <span style={{
              fontSize: '11px', color: '#F97316', background: '#FFF7ED',
              padding: '2px 8px', borderRadius: '10px', border: '1px solid #FDBA74',
              fontWeight: '600',
            }}>
              ⚡ HIZLI MOD
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { loadSettings(); loadUsers(); }}
            style={{
              padding: '8px 16px',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              fontSize: '13px',
              color: '#374151',
            }}
          >
            Yenile
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderRadius: '6px',
              background: hasChanges ? '#3B82F6' : '#D1D5DB',
              color: 'white',
              cursor: hasChanges ? 'pointer' : 'not-allowed',
              fontSize: '13px',
              fontWeight: '600',
            }}
          >
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '24px',
          background: 'white',
          borderRadius: '8px',
          padding: '4px',
          border: '1px solid #E5E7EB',
          flexWrap: 'wrap',
        }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: '1 1 auto',
                padding: '10px 12px',
                border: 'none',
                borderRadius: '6px',
                background: activeTab === tab.key ? tab.color : 'transparent',
                color: activeTab === tab.key ? 'white' : '#6B7280',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.key ? '600' : '400',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'users' ? renderUsersTab() :
         activeTab === 'fast' ? renderFastModeTab() : (
          <div style={{
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #E5E7EB',
              background: '#FAFAFA',
            }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#111827' }}>
                {TABS.find(t => t.key === activeTab)?.icon} {TABS.find(t => t.key === activeTab)?.label}
              </h2>
            </div>

            <div style={{ padding: '8px 0' }}>
              {filteredSettings.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
                  Bu kategoride ayar bulunamadi
                </div>
              ) : (
                filteredSettings.map((setting, idx) => (
                  <div
                    key={setting.key}
                    style={{
                      padding: '16px 20px',
                      borderBottom: idx < filteredSettings.length - 1 ? '1px solid #F3F4F6' : 'none',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '16px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
                        {setting.label}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {setting.description}
                      </div>
                      <div style={{ fontSize: '10px', color: '#D1D5DB', marginTop: '2px' }}>
                        {setting.key}
                      </div>
                    </div>
                    <div style={{ minWidth: '280px', maxWidth: '400px' }}>
                      {renderInput(setting)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Changes indicator */}
        {hasChanges && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: '#FEF3C7',
            border: '1px solid #FCD34D',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Kaydedilmemis degisiklikler var</span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '4px',
                background: '#F59E0B',
                color: 'white',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        )}

        {/* Footer info */}
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#F9FAFB',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          fontSize: '12px',
          color: '#9CA3AF',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>abeTahta Yonetim Paneli {fastModeEnabled ? '⚡ Hizli Mod Aktif' : ''}</span>
          <span>{settings.length} ayar | {usersTotal} kullanici</span>
        </div>
      </div>
    </div>
  );
}

// Styles
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid #D1D5DB',
  borderRadius: '6px',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'white',
  cursor: 'pointer',
};
