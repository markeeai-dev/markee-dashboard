'use client';

import React, { useState } from 'react';
import { Search, Plus, SlidersHorizontal, Folder, Edit3, Trash2, MoreVertical } from 'lucide-react';
import Link from 'next/link';

interface FolderItem {
  id: number;
  name: string;
  created_at?: string;
}

interface ChatFolderGridProps {
  personalFolders: FolderItem[];
  onCreateFolder: (name: string) => Promise<void>;
  onRenameFolder: (id: number, newName: string) => Promise<void>;
  onDeleteFolder: (id: number) => Promise<void>;
}

export default function ChatFolderGrid({
  personalFolders,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: ChatFolderGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const filteredFolders = personalFolders
    .filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      return 0; // Default sort
    });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;
    await onCreateFolder(folderNameInput.trim());
    setFolderNameInput('');
    setIsCreateModalOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolder || !folderNameInput.trim()) return;
    await onRenameFolder(selectedFolder.id, folderNameInput.trim());
    setFolderNameInput('');
    setIsEditModalOpen(false);
    setSelectedFolder(null);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedFolder) return;
    await onDeleteFolder(selectedFolder.id);
    setIsDeleteModalOpen(false);
    setSelectedFolder(null);
  };

  return (
    <div className="flex-1 bg-white flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-100 px-8 py-5 flex items-center justify-between shrink-0 bg-slate-50/40">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="text-lg">📂</span> Dự án
          </h1>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Quản lý và sắp xếp các phiên hội thoại cá nhân của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortBy(prev => prev === 'name' ? 'date' : 'name')}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 transition-all cursor-pointer bg-white"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Sắp xếp: {sortBy === 'name' ? 'Tên A-Z' : 'Mới nhất'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFolderNameInput('');
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs hover:shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo dự án mới</span>
          </button>
        </div>
      </div>

      {/* Body container */}
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm kiếm thư mục..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 bg-slate-50/30 focus:outline-none focus:border-slate-400 focus:bg-white font-medium transition-all"
          />
        </div>

        {/* Folders Grid */}
        {filteredFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 rounded-2xl bg-slate-50/30">
            <Folder className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-xs text-slate-400 font-bold">Không tìm thấy thư mục nào</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-3 text-xs text-markee-primary font-bold hover:underline"
            >
              Tạo thư mục đầu tiên của bạn
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredFolders.map(folder => (
              <div
                key={folder.id}
                className="group relative border border-slate-200 hover:border-slate-350 rounded-2xl p-5 bg-white hover:bg-slate-50/30 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between min-h-30 cursor-pointer"
              >
                {/* 3-dots actions */}
                <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setActiveMenuId(activeMenuId === folder.id ? null : folder.id)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {activeMenuId === folder.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                      <div className="absolute right-0 mt-1 z-50 w-28 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 text-xs text-slate-700 font-semibold animate-in fade-in slide-in-from-top-1 duration-100">
                        <button
                          onClick={() => {
                            setSelectedFolder(folder);
                            setFolderNameInput(folder.name);
                            setIsEditModalOpen(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-0 font-semibold text-slate-700"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Đổi tên</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFolder(folder);
                            setIsDeleteModalOpen(true);
                            setActiveMenuId(null);
                          }}
                          className="w-full text-left px-3.5 py-1.5 hover:bg-red-50 text-red-650 hover:text-red-755 transition-colors flex items-center gap-1.5 cursor-pointer bg-transparent border-0 font-semibold text-red-650"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Card Link */}
                <Link
                  href={`?tab=ai_chat&folderId=${folder.id}`}
                  scroll={false}
                  className="flex-1 flex flex-col justify-between"
                >
                  <div className="space-y-1.5 pr-6">
                    <span className="text-lg">📁</span>
                    <h3 className="font-bold text-slate-800 text-sm leading-tight truncate group-hover:text-slate-900">
                      {folder.name}
                    </h3>
                  </div>
                  <div className="mt-4 text-[10px] text-slate-400 font-bold tracking-tight">
                    Cập nhật mới đây
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal 1: Tạo thư mục */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
              <span>📁</span> Tạo dự án mới
            </h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Tên dự án..."
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-semibold"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl cursor-pointer"
                >
                  Tạo mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Đổi tên thư mục */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5">
              <span>✏️</span> Đổi tên thư mục
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="Tên thư mục mới..."
                value={folderNameInput}
                onChange={(e) => setFolderNameInput(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-slate-400 font-semibold"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedFolder(null);
                  }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Xóa dự án  */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <span>🗑️</span> Xóa dự án
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-5">
              Bạn có chắc chắn muốn xóa dự án <strong className="text-slate-800 font-bold">&quot;{selectedFolder?.name}&quot;</strong>? Việc này sẽ gỡ liên kết tất cả các đoạn chat trong dự án này (không xóa tin nhắn).
            </p>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedFolder(null);
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer"
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
