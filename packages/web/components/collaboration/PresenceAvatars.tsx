'use client';

import { Peer } from '@/hooks/useCollaboration';

interface PresenceAvatarsProps {
  peers: Peer[];
  isConnected: boolean;
  myColor: string;
  userName: string;
}

export function PresenceAvatars({ peers, isConnected, myColor, userName }: PresenceAvatarsProps) {
  const allUsers = [
    { id: 'me', name: userName, color: myColor, isMe: true },
    ...peers.map(p => ({ ...p, isMe: false }))
  ];

  return (
    <div className="flex items-center gap-2">
      {/* Bağlantı durumu */}
      <div className="flex items-center gap-1.5 mr-2">
        <div
          className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          title={isConnected ? 'Bağlı' : 'Bağlantı yok'}
        />
        <span className="text-xs text-gray-500">
          {isConnected ? 'Canlı' : 'Çevrimdışı'}
        </span>
      </div>

      {/* Kullanıcı avatarları */}
      <div className="flex -space-x-2">
        {allUsers.slice(0, 5).map((user, idx) => (
          <div
            key={user.id}
            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold shadow-sm transition-transform hover:scale-110 hover:z-10 ${
              user.isMe ? 'ring-2 ring-blue-400 ring-offset-1' : ''
            }`}
            style={{
              backgroundColor: user.color,
              zIndex: allUsers.length - idx
            }}
            title={user.isMe ? `${user.name} (Sen)` : user.name}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
        ))}

        {/* Fazla kullanıcı sayısı */}
        {allUsers.length > 5 && (
          <div
            className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-gray-600 text-xs font-semibold"
            title={`${allUsers.length - 5} kişi daha`}
          >
            +{allUsers.length - 5}
          </div>
        )}
      </div>

      {/* Toplam kullanıcı sayısı */}
      {allUsers.length > 1 && (
        <span className="text-xs text-gray-500 ml-1">
          {allUsers.length} kişi
        </span>
      )}
    </div>
  );
}
