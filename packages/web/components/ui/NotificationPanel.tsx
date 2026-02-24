'use client';

import { useRouter } from 'next/navigation';
import { useNotificationStore, type Notification } from '@/store/notifications';
import { CheckCheck, Trash2 } from 'lucide-react';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az once';
  if (mins < 60) return `${mins}dk once`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}sa once`;
  return `${Math.floor(hours / 24)}g once`;
}

const TYPE_ICONS: Record<string, string> = {
  board_invite: '📋',
  comment: '💬',
  mention: '📢',
  system: '⚙️',
};

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const router = useRouter();
  const { notifications, isLoading, markAsRead, markAllRead, deleteNotification } =
    useNotificationStore();

  function handleClick(n: Notification) {
    if (!n.is_read) markAsRead(n.id);
    const boardId = n.data?.boardId as string | undefined;
    if (boardId) {
      onClose();
      router.push(`/board/${boardId}`);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '8px',
        width: '360px',
        maxHeight: '480px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        zIndex: 1001,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Bildirimler</span>
        <button
          onClick={() => { markAllRead(); }}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <CheckCheck size={14} />
          Tumunu oku
        </button>
      </div>

      {/* List */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {isLoading && (
          <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            Yukleniyor...
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: '13px' }}>
            Bildirim yok
          </div>
        )}

        {notifications.map((n) => (
          <NotificationItem
            key={n.id}
            notification={n}
            onRead={() => handleClick(n)}
            onDelete={() => deleteNotification(n.id)}
          />
        ))}
      </div>
    </div>
  );
}

function NotificationItem({
  notification: n,
  onRead,
  onDelete,
}: {
  notification: Notification;
  onRead: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onRead}
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid #F3F4F6',
        cursor: 'pointer',
        background: n.is_read ? 'white' : '#F0F7FF',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '2px' }}>
        {TYPE_ICONS[n.type] || '🔔'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: n.is_read ? 400 : 600,
          color: '#1F2937',
          marginBottom: '2px',
        }}>
          {n.title}
        </div>
        {n.message && (
          <div style={{
            fontSize: '12px',
            color: '#6B7280',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {n.message}
          </div>
        )}
        <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
          {timeAgo(n.created_at)}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#D1D5DB',
          padding: '4px',
          flexShrink: 0,
        }}
        title="Sil"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
