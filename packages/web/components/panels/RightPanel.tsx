'use client';

import { useState } from 'react';
import { X, History, User, Calendar, Tag, Flag } from 'lucide-react';

interface ElementContent {
  title?: string;
  label?: string;
  body?: string;
  [key: string]: unknown;
}

interface Element {
  id: string;
  type: string;
  content: ElementContent;
  assigned_to?: string;
  assigned_to_name?: string;
  status?: string;
  priority?: number;
  tags?: string[];
  due_date?: string;
  created_at: string;
  updated_at: string;
}

interface Comment {
  id: string;
  body: string;
  user_name?: string;
  is_ai: boolean;
  created_at: string;
}

interface RightPanelProps {
  element: Element | null;
  comments?: Comment[];
  onClose: () => void;
  onUpdate?: (id: string, updates: Partial<Element>) => void;
  onAddComment?: (elementId: string, body: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_progress', label: 'Devam Ediyor', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'done', label: 'Tamamlandi', color: 'bg-green-100 text-green-700' },
  { value: 'blocked', label: 'Engellendi', color: 'bg-red-100 text-red-700' },
];

const PRIORITY_OPTIONS = [
  { value: 0, label: 'Normal', color: 'text-gray-500' },
  { value: 1, label: 'Yuksek', color: 'text-orange-500' },
  { value: 2, label: 'Acil', color: 'text-red-500' },
];

export default function RightPanel({
  element,
  comments = [],
  onClose,
  onUpdate,
  onAddComment,
}: RightPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState<'properties' | 'comments' | 'history'>('properties');

  if (!element) return null;

  const handleStatusChange = (status: string) => {
    onUpdate?.(element.id, { status });
  };

  const handlePriorityChange = (priority: number) => {
    onUpdate?.(element.id, { priority });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    onAddComment?.(element.id, newComment.trim());
    setNewComment('');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Ozellikler</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setActiveTab('properties')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'properties'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Ozellikler
        </button>
        <button
          onClick={() => setActiveTab('comments')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'comments'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Yorumlar ({comments.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-sm font-medium ${
            activeTab === 'history'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Gecmis
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'properties' && (
          <div className="space-y-4">
            {/* Element Type */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase">Tur</label>
              <p className="mt-1 text-sm text-gray-900 capitalize">{element.type.replace('_', ' ')}</p>
            </div>

            {/* Title/Label */}
            {(element.content?.title || element.content?.label) && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase">Baslik</label>
                <p className="mt-1 text-sm text-gray-900">
                  {element.content.title || element.content.label}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                <Flag className="w-3 h-3" /> Durum
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      element.status === opt.value
                        ? opt.color
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                <Tag className="w-3 h-3" /> Oncelik
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handlePriorityChange(opt.value)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      element.priority === opt.value
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assigned To */}
            {element.assigned_to_name && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                  <User className="w-3 h-3" /> Atanan
                </label>
                <p className="mt-1 text-sm text-gray-900">{element.assigned_to_name}</p>
              </div>
            )}

            {/* Due Date */}
            {element.due_date && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Bitis Tarihi
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(element.due_date)}</p>
              </div>
            )}

            {/* Dates */}
            <div className="pt-4 border-t border-gray-100">
              <div className="text-xs text-gray-400">
                Olusturulma: {formatDate(element.created_at)}
              </div>
              <div className="text-xs text-gray-400">
                Guncelleme: {formatDate(element.updated_at)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="space-y-4">
            {/* Comment List */}
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Henuz yorum yok</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${
                      comment.is_ai ? 'bg-purple-500' : 'bg-blue-500'
                    }`}
                  >
                    {comment.is_ai ? 'AI' : comment.user_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {comment.is_ai ? 'Claude' : comment.user_name || 'Kullanici'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{comment.body}</p>
                  </div>
                </div>
              ))
            )}

            {/* Add Comment */}
            <div className="pt-4 border-t border-gray-100">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Yorum yaz..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={3}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="mt-2 w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Yorum Ekle
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="text-sm text-gray-400 text-center py-8">
            <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Gecmis kayitlari yakinda...</p>
          </div>
        )}
      </div>
    </div>
  );
}
