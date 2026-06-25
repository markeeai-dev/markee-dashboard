'use client';

import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile, Conversation } from '@/lib/dashboard-supabase';
import { InjectPanel } from './InjectPanel';

interface Props {
  conversations: Conversation[];
  activeConvId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  profile: UserProfile;
}

function groupConversations(convs: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const homNay: Conversation[] = [];
  const homQua: Conversation[] = [];
  const truocDo: Conversation[] = [];

  for (const c of convs) {
    const d = new Date(c.updated_at);
    if (d >= today) {
      homNay.push(c);
    } else if (d >= yesterday) {
      homQua.push(c);
    } else {
      truocDo.push(c);
    }
  }

  return { homNay, homQua, truocDo };
}

export function ChatSidebar({ conversations, activeConvId, loading, onSelect, onNew, onDelete, profile }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const grouped = groupConversations(conversations);

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  }

  return (
    <aside className="w-[280px] shrink-0 border-r border-markee-border bg-white flex flex-col">
      <div className="p-3 border-b border-markee-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-markee-primary" />
            <span className="text-sm font-semibold text-markee-text">AI Chat</span>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-markee-primary text-white text-xs font-semibold hover:bg-markee-hover transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Mới</span>
          </button>
        </div>
        <p className="text-[11px] text-markee-sub leading-tight">Inject asset từ Library để AI có context chính xác</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-markee-border rounded w-16" />
                <div className="h-8 bg-markee-bg rounded-lg" />
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center">
            <MessageSquare className="w-8 h-8 text-markee-sub mx-auto mb-2 opacity-40" />
            <p className="text-xs text-markee-sub">Chưa có hội thoại nào</p>
          </div>
        ) : (
          <div className="p-2 space-y-4">
            {grouped.homNay.length > 0 && (
              <div>
                <div className="px-2 mb-1 text-[10px] font-semibold text-markee-sub uppercase tracking-wider">Hôm nay</div>
                {grouped.homNay.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeConvId}
                    confirmDelete={confirmDeleteId === c.id}
                    onSelect={() => onSelect(c.id)}
                    onDelete={(e) => handleDeleteClick(e, c.id)}
                  />
                ))}
              </div>
            )}

            {grouped.homQua.length > 0 && (
              <div>
                <div className="px-2 mb-1 text-[10px] font-semibold text-markee-sub uppercase tracking-wider">Hôm qua</div>
                {grouped.homQua.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeConvId}
                    confirmDelete={confirmDeleteId === c.id}
                    onSelect={() => onSelect(c.id)}
                    onDelete={(e) => handleDeleteClick(e, c.id)}
                  />
                ))}
              </div>
            )}

            {grouped.truocDo.length > 0 && (
              <div>
                <div className="px-2 mb-1 text-[10px] font-semibold text-markee-sub uppercase tracking-wider">Trước đó</div>
                {grouped.truocDo.map((c) => (
                  <ConversationItem
                    key={c.id}
                    conv={c}
                    isActive={c.id === activeConvId}
                    confirmDelete={confirmDeleteId === c.id}
                    onSelect={() => onSelect(c.id)}
                    onDelete={(e) => handleDeleteClick(e, c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <InjectPanel profile={profile} />
    </aside>
  );
}

function ConversationItem({
  conv,
  isActive,
  confirmDelete,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  isActive: boolean;
  confirmDelete: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-2.5 py-2 rounded-lg transition-all cursor-pointer group ${
        isActive
          ? 'bg-markee-primary/5 border border-markee-primary/20'
          : 'hover:bg-markee-bg border border-transparent'
      }`}
    >
      <div className="text-[13px] font-semibold text-markee-text truncate leading-snug">{conv.title}</div>
      <div className="flex items-center justify-between mt-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-markee-primary/60" />
          <span className="text-[10px] text-markee-sub">{conv.model}</span>
        </div>
        <span
          role="button"
          tabIndex={0}
          onClick={onDelete}
          onKeyDown={(e) => { if (e.key === 'Enter') onDelete(e as unknown as React.MouseEvent); }}
          className={`opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer ${
            confirmDelete ? 'text-red-500 opacity-100' : 'text-markee-sub hover:text-red-500'
          }`}
        >
          <Trash2 className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
}
