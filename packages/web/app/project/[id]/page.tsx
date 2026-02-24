'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';

interface Member {
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Board {
  id: string;
  name: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_role: string;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, isChecking } = useRequireAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('editor');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || isChecking || !user) return;
    loadProject();
  }, [projectId, isChecking, user]);

  const loadProject = useCallback(async () => {
    try {
      const data = await api.get<{ project: Project; members: Member[]; boards: Board[] }>(
        `/api/projects/${projectId}`
      );
      setProject(data.project);
      setMembers(data.members);
      setBoards(data.boards);
    } catch {
      setError('Proje yuklenemedi');
    }
  }, [projectId]);

  const handleAddMember = useCallback(async () => {
    if (!newMemberEmail.trim() || isAddingMember) return;

    setIsAddingMember(true);
    setError(null);
    setSuccess(null);

    try {
      await api.post(`/api/projects/${projectId}/members`, {
        email: newMemberEmail.trim(),
        role: newMemberRole,
      });
      setSuccess(`${newMemberEmail} eklendi`);
      setNewMemberEmail('');
      loadProject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uye eklenemedi');
    } finally {
      setIsAddingMember(false);
    }
  }, [newMemberEmail, newMemberRole, isAddingMember, projectId, loadProject]);

  if (isChecking || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const isOwnerOrAdmin = project.member_role === 'owner' || project.member_role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:underline text-sm"
            >
              Dashboard
            </button>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-800">{project.name}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Proje Bilgisi */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold mb-2">Proje Bilgileri</h2>
          <p className="text-sm text-gray-600">{project.description || 'Aciklama yok'}</p>
          <p className="text-xs text-gray-400 mt-2">
            Olusturulma: {new Date(project.created_at).toLocaleDateString('tr-TR')}
          </p>
        </section>

        {/* Tahtalar */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold mb-4">Tahtalar ({boards.length})</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {boards.map((board) => (
              <button
                key={board.id}
                onClick={() => router.push(`/board/${board.id}`)}
                className="text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <div className="font-medium text-sm">{board.name}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(board.created_at).toLocaleDateString('tr-TR')}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Üyeler */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold mb-4">Uyeler ({members.length})</h2>

          {/* Üye listesi */}
          <div className="space-y-3 mb-6">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-medium">
                    {member.display_name?.substring(0, 2).toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{member.display_name}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  member.role === 'owner' ? 'bg-purple-100 text-purple-700' :
                  member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {member.role === 'owner' ? 'Sahip' :
                   member.role === 'admin' ? 'Yonetici' :
                   member.role === 'editor' ? 'Duzenleyici' : 'Izleyici'}
                </span>
              </div>
            ))}
          </div>

          {/* Üye ekleme */}
          {isOwnerOrAdmin && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-medium mb-3">Uye Ekle</h3>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-3">{error}</div>
              )}
              {success && (
                <div className="bg-green-50 text-green-600 text-sm rounded-lg p-3 mb-3">{success}</div>
              )}

              <div className="flex gap-2">
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
                  placeholder="kullanici@email.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="editor">Duzenleyici</option>
                  <option value="admin">Yonetici</option>
                  <option value="viewer">Izleyici</option>
                </select>
                <button
                  onClick={handleAddMember}
                  disabled={isAddingMember || !newMemberEmail.trim()}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isAddingMember ? '...' : 'Ekle'}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
