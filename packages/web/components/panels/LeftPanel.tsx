'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronRight, Folder, Grid3X3, Users, Plus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  color: string;
  boards: Board[];
}

interface Board {
  id: string;
  name: string;
}

interface LeftPanelProps {
  projects: Project[];
  currentBoardId?: string;
  onCreateBoard?: (projectId: string) => void;
}

export default function LeftPanel({ projects, currentBoardId, onCreateBoard }: LeftPanelProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [onlineUsers] = useState([
    { id: '1', name: 'Adnan', color: '#3B82F6' },
    { id: '2', name: 'Ahmet', color: '#10B981' },
  ]);

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <Link href="/dashboard" className="text-lg font-bold text-blue-600">
          abeTahta
        </Link>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Projeler</span>
        </div>

        <div className="space-y-1">
          {projects.map((project) => (
            <div key={project.id}>
              {/* Project Header */}
              <button
                onClick={() => toggleProject(project.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 text-left"
              >
                {expandedProjects.has(project.id) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-sm font-medium text-gray-700 truncate">{project.name}</span>
              </button>

              {/* Boards */}
              {expandedProjects.has(project.id) && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {project.boards.map((board) => (
                    <Link
                      key={board.id}
                      href={`/board/${board.id}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                        board.id === currentBoardId
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Grid3X3 className="w-4 h-4" />
                      <span className="truncate">{board.name}</span>
                    </Link>
                  ))}
                  {onCreateBoard && (
                    <button
                      onClick={() => onCreateBoard(project.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 w-full"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Yeni Tahta</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Online Users */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-500 uppercase">Online</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {onlineUsers.map((user) => (
            <div
              key={user.id}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
