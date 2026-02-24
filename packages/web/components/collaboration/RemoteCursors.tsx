'use client';

import { Peer } from '@/hooks/useCollaboration';

interface RemoteCursorsProps {
  peers: Peer[];
}

export function RemoteCursors({ peers }: RemoteCursorsProps) {
  return (
    <>
      {peers.map(peer => {
        if (!peer.cursor) return null;

        return (
          <div
            key={peer.id}
            className="absolute pointer-events-none z-[9999] transition-all duration-75"
            style={{
              left: peer.cursor.x,
              top: peer.cursor.y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            {/* Cursor SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
            >
              <path
                d="M5.65376 3.15088C4.97441 2.86647 4.24494 3.44377 4.40577 4.16268L8.04121 19.8936C8.20204 20.6126 9.11258 20.8672 9.58842 20.2986L13.3 15.6L18.1 17.1C18.8 17.3 19.5 16.8 19.4 16.1L17.9 4.30001C17.8 3.60001 17 3.20001 16.4 3.50001L5.65376 3.15088Z"
                fill={peer.color}
                stroke="white"
                strokeWidth="1.5"
              />
            </svg>

            {/* İsim etiketi */}
            <div
              className="absolute left-5 top-5 px-2 py-0.5 rounded text-xs text-white whitespace-nowrap font-medium shadow-md"
              style={{ backgroundColor: peer.color }}
            >
              {peer.name}
            </div>
          </div>
        );
      })}
    </>
  );
}
