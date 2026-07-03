'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Trash2,
  MessageSquare,
  Pencil,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  MoreHorizontal,
} from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  project_id?: number | null;
}

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string | null) => void;
  onCreateSession: () => void;
  onDeleteSession: (id: string) => void;
  onInjectPrompt: (prompt: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  projects: { id: number; name: string }[];
  personalFolders?: { id: number; name: string }[];
  onCreateFolder?: (name: string) => Promise<void>;
  onRenameFolder?: (id: number, newName: string) => Promise<void>;
  onDeleteFolder?: (id: number) => Promise<void>;
}

export default function ChatSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onDeleteSession,
  onRenameSession,
  isOpen = false,
  projects,
  personalFolders = [],
}: ChatSidebarProps) {
  const searchParams = useSearchParams();
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Sidebar Collapse state (Default expanded)
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Lịch sử chat group state
  const [groupBy, setGroupBy] = useState<'None' | 'Date' | 'Project'>('None');
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);

  const handleSaveRename = (id: string) => {
    if (editTitle.trim() !== '') {
      onRenameSession(id, editTitle);
    }
    setEditingSessionId(null);
  };

  // Date categorization helper
  const getGroupLabelByDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Hôm qua';
    if (diffDays <= 7) return '7 ngày trước';
    return 'Tháng trước & cũ hơn';
  };

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;
    const dateStr = new Date(session.created_at).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit',
    });

    if (isCollapsed) {
      return (
        <div
          key={session.id}
          className={`relative flex items-center justify-center rounded-xl p-2.5 transition-all text-xs cursor-pointer border ${isActive
              ? 'bg-white border-slate-200 text-markee-primary font-bold shadow-xs'
              : 'hover:bg-slate-100 border-transparent text-slate-600'
            }`}
          onClick={() => onSelectSession(session.id)}
          title={session.title || 'Phiên chat mới'}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
        </div>
      );
    }

    return (
      <div
        key={session.id}
        className={`group relative flex items-center justify-between rounded-xl px-3 py-2.5 transition-all text-xs cursor-pointer border ${isActive
            ? 'bg-white border-slate-200 text-markee-primary font-bold shadow-xs'
            : 'hover:bg-slate-100 border-transparent text-slate-600 hover:text-slate-900'
          }`}
        onClick={() => {
          if (!isEditing) onSelectSession(session.id);
        }}
      >
        <div className="min-w-0 flex-1 pr-6">
          {isEditing ? (
            <input
              type="text"
              autoFocus
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => handleSaveRename(session.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(session.id);
                if (e.key === 'Escape') setEditingSessionId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs text-slate-900 px-2 py-1 bg-white border border-red-300 rounded outline-none focus:border-red-500 font-normal"
            />
          ) : (
            <>
              <div className="truncate text-xs font-semibold">{session.title || 'Phiên chat mới'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-normal">{dateStr}</div>
            </>
          )}
        </div>

        {/* Nút thao tác */}
        {!isEditing && (
  <div className={`absolute right-2 z-50 flex items-center pl-1 ${isActive ? 'bg-white opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
    <div className="relative">
      {/* Nút 3 chấm (Click để toggle) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === session.id ? null : session.id); // Toggle đóng mở
        }}
        className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-all cursor-pointer border-0 bg-transparent"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Menu xổ xuống (Chỉ hiện khi openMenuId khớp) */}
      {openMenuId === session.id && (
        <>
          {/* Lớp phủ ẩn để click ra ngoài là đóng menu */}
          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
          
          <div className="absolute right-0 top-full mt-1 flex flex-col bg-white border border-slate-200 shadow-xl rounded-lg w-28 z-50 py-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditTitle(session.title);
                setEditingSessionId(session.id);
                setOpenMenuId(null); // Đóng menu sau khi click
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-sm text-slate-700 w-full cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Đổi tên</span>
            </button>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSessionToDelete(session.id);
                setOpenMenuId(null); // Đóng menu sau khi click
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-sm text-red-600 w-full cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa</span>
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
      </div>
    );
  };

  const renderSessionList = () => {
    const displayedSessions = sessions;

    if (displayedSessions.length === 0) {
      return (
        <div className="text-center py-8 text-xs text-slate-400 italic">
          {isCollapsed ? 'Trống' : 'Chưa có phiên chat nào'}
        </div>
      );
    }

    if (groupBy === 'None' || isCollapsed) {
      return (
        <div className="space-y-1">
          {displayedSessions.map((session) => renderSessionItem(session))}
        </div>
      );
    }

    if (groupBy === 'Date') {
      const groups: Record<string, typeof sessions> = {
        'Hôm nay': [],
        'Hôm qua': [],
        '7 ngày trước': [],
        'Tháng trước & cũ hơn': []
      };

      displayedSessions.forEach(s => {
        const label = getGroupLabelByDate(s.created_at);
        groups[label].push(s);
      });

      const order = ['Hôm nay', 'Hôm qua', '7 ngày trước', 'Tháng trước & cũ hơn'];
      return (
        <div className="space-y-4">
          {order.map(label => {
            const list = groups[label];
            if (list.length === 0) return null;
            return (
              <div key={label} className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 bg-slate-200/40 rounded-md">
                  {label}
                </div>
                {list.map(session => renderSessionItem(session))}
              </div>
            );
          })}
        </div>
      );
    }

    if (groupBy === 'Project') {
      const groups: Record<string, typeof sessions> = {};
      displayedSessions.forEach(s => {
        const projId = s.project_id;
        const projName = projId ? (projects.find(p => p.id === projId)?.name || 'Dự án không xác định') : 'Không thuộc dự án';
        if (!groups[projName]) {
          groups[projName] = [];
        }
        groups[projName].push(s);
      });

      return (
        <div className="space-y-4">
          {Object.entries(groups).map(([projName, list]) => (
            <div key={projName} className="space-y-1">
              <div className="text-[10px] font-bold text-slate-500 px-2 py-1 bg-slate-200/40 rounded-md truncate max-w-full block" title={projName}>
                📁 {projName}
              </div>
              {list.map(session => renderSessionItem(session))}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 border-r border-slate-200 bg-slate-50 flex flex-col h-full select-none transition-all duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'w-16 md:w-16' : 'w-80 md:w-80'} shrink-0`}>



        {/* Header */}
        {!isCollapsed ? (
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={onCreateSession}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-markee-primary hover:bg-markee-hover text-white py-2.5 px-3 text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer border-0"
            >
              <Plus className="h-4 w-4" />
              <span>Đoạn chat mới</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="p-2 rounded-xl hover:bg-slate-250 hover:bg-slate-200/60 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0 border-0"
              title="Thu nhỏ Sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 border-b border-slate-200 flex flex-col items-center gap-4 bg-slate-50 shrink-0">
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-0"
              title="Mở rộng Sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCreateSession}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-markee-primary hover:bg-markee-hover text-white transition-all cursor-pointer shadow-sm border-0"
              title="Đoạn chat mới"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Lịch sử chat list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">


          {/* Thư mục Chat Link Button */}
          {!isCollapsed ? (
            <div className="mb-3 px-1">
              <Link
                href="?tab=chat-folders"
                scroll={false}
                onClick={() => onSelectSession(null)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 transition-all text-xs font-semibold border ${searchParams.get('tab') === 'chat-folders'
                    ? 'bg-markee-primary text-white border-markee-primary shadow-md shadow-red-100'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span>📂</span>
                  <span>Dự án</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full group-hover:bg-slate-250 transition-colors">
                  {personalFolders.length}
                </span>
              </Link>
            </div>
          ) : (
            <div className="mb-3 flex justify-center">
              <Link
                href="?tab=chat-folders"
                scroll={false}
                onClick={() => onSelectSession(null)}
                className={`p-2 rounded-xl border flex items-center justify-center transition-all ${searchParams.get('tab') === 'chat-folders'
                    ? 'bg-markee-primary text-white border-markee-primary shadow-md shadow-red-100'
                    : 'bg-white hover:bg-slate-55 hover:bg-slate-50 border-slate-200 text-slate-500'
                  }`}
                title={`Dự án (${personalFolders.length})`}
              >
                <span>📂</span>
              </Link>
            </div>
          )}

          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between relative shrink-0">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" />
                <span>Lịch sử trò chuyện ({sessions.length})</span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
                  className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                  title="Gom nhóm Lịch sử"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>

                {isGroupMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-45" onClick={() => setIsGroupMenuOpen(false)} />
                    <div className="absolute right-0 top-6 z-50 w-44 bg-white border border-slate-200 rounded-lg shadow-xl py-1 text-[11px] font-semibold text-slate-700">
                      <button
                        type="button"
                        onClick={() => { setGroupBy('None'); setIsGroupMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between bg-transparent border-0 cursor-pointer ${groupBy === 'None' ? 'text-markee-primary font-bold' : ''}`}
                      >
                        <span>Mặc định</span>
                        {groupBy === 'None' && <span className="text-[10px]">✓</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setGroupBy('Date'); setIsGroupMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between bg-transparent border-0 cursor-pointer ${groupBy === 'Date' ? 'text-markee-primary font-bold' : ''}`}
                      >
                        <span>Theo Ngày</span>
                        {groupBy === 'Date' && <span className="text-[10px]">✓</span>}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setGroupBy('Project'); setIsGroupMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between bg-transparent border-0 cursor-pointer ${groupBy === 'Project' ? 'text-markee-primary font-bold' : ''}`}
                      >
                        <span>Theo Dự án</span>
                        {groupBy === 'Project' && <span className="text-[10px]">✓</span>}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {renderSessionList()}
        </div>
      </aside>

      {/* MODAL XÁC NHẬN XÓA */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/40 transition-opacity">
          <div className="bg-white w-105 rounded-3xl p-6 shadow-2xl mx-4 transform transition-all border border-slate-100 max-w-sm">
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Bạn muốn xoá cuộc trò chuyện?</h3>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              Thao tác này sẽ xoá đoạn chat này khỏi lịch sử trò chuyện.
            </p>

            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setSessionToDelete(null)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer border-0 bg-transparent"
              >
                Huỷ
              </button>
              <button
                onClick={() => {
                  onDeleteSession(sessionToDelete);
                  setSessionToDelete(null);
                }}
                className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm hover:shadow rounded-full transition-all cursor-pointer border-0"
              >
                Xoá
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}