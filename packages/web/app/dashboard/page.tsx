'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Folder, LayoutGrid, LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/store/auth';
import { log } from '@/lib/logger';
import { toast } from '@/store/toast';
import { NotificationBell } from '@/components/ui/NotificationBell';

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  board_count: number;
  member_count: number;
  updated_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isChecking } = useRequireAuth();
  const logout = useAuthStore((s) => s.logout);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!isChecking && user) loadProjects();
  }, [isChecking, user]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function loadProjects() {
    try {
      const data = await api.get<{ projects: Project[] }>('/api/projects');
      setProjects(data.projects);
    } catch {
      router.push('/login');
    }
  }

  async function createProject() {
    if (!newName.trim()) return;
    try {
      const data = await api.post<{ project: Project }>('/api/projects', { name: newName.trim() });
      setProjects([data.project, ...projects]);
      setNewName('');
      setIsCreating(false);
    } catch (err) {
      log.error('Proje oluşturma hatası:', err);
    }
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-600">abeTahta</h1>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500">{user.display_name}</span>
            )}
            <NotificationBell />
            <button
              onClick={() => router.push('/admin')}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 px-2 py-2 text-sm transition-colors"
              title="Yonetim Paneli"
            >
              ⚙️
            </button>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Yeni Proje
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-gray-400 hover:text-red-500 px-2 py-2 text-sm transition-colors"
              title="Çıkış Yap"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <LayoutGrid size={20} className="text-gray-400" />
          <h2 className="text-lg font-semibold">Projeler</h2>
        </div>

        {/* Yeni Proje Modal */}
        {isCreating && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3">
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createProject()}
              placeholder="Proje adı..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={createProject}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              Oluştur
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="text-gray-500 px-3 py-2 text-sm"
            >
              İptal
            </button>
          </div>
        )}

        {/* Proje Grid */}
        {projects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Folder size={48} className="mx-auto mb-3 opacity-50" />
            <p>Henüz proje yok. İlk projenizi oluşturun!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={async () => {
                  try {
                    const boards = await api.get<{ id: string }[]>(`/api/boards?project_id=${project.id}`);
                    if (boards.length > 0) {
                      router.push(`/board/${boards[0].id}`);
                    } else {
                      toast.warning('Bu proje icinde tahta bulunamadi');
                    }
                  } catch (err) {
                    toast.error('Tahta yuklenemedi: ' + (err as any).message);
                  }
                }}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
                    style={{ backgroundColor: project.color }}
                  >
                    {project.name[0]}
                  </div>
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-xs text-gray-400">
                      {project.board_count} tahta · {project.member_count} üye
                    </p>
                  </div>
                </div>
                {project.description && (
                  <p className="text-sm text-gray-500 line-clamp-2">{project.description}</p>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/project/${project.id}`);
                  }}
                  className="mt-3 text-xs text-blue-600 hover:underline"
                >
                  Ayarlar & Uyeler
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
