'use client';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/dashboard-supabase';
import {
  createConversation,
  deleteConversation,
  fetchConversations,
  fetchMessages,
  type ChatMessage as DBChatMessage,
  type Conversation,
} from '@/lib/dashboard-supabase';
import { ChatSidebar } from './ChatSidebar';
import { ChatMain } from './ChatMain';
import type { ModelKey } from './types';

interface Props {
  profile: UserProfile;
}

export default function ChatShell({ profile }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [dbMessages, setDbMessages] = useState<DBChatMessage[]>([]);
  const [model, setModel] = useState<ModelKey>('gemini');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  async function loadConversations() {
    const data = await fetchConversations(profile.email);
    setConversations(data);
    setSidebarLoading(false);

    if (data.length === 0) {
      const newConv = await createConversation(profile.email);
      if (newConv) {
        setConversations([newConv]);
        setActiveConvId(newConv.id);
      }
    } else if (!activeConvId) {
      setActiveConvId(data[0].id);
    }
  }

  async function loadMessages(convId: string) {
    setLoadingMessages(true);
    setDbMessages([]);
    const msgs = await fetchMessages(convId);
    setDbMessages(msgs);
    setLoadingMessages(false);
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId);
    }
  }, [activeConvId]);

  async function handleNewConversation() {
    const conv = await createConversation(profile.email);
    if (conv) {
      setConversations((prev) => [conv, ...prev]);
      setActiveConvId(conv.id);
    }
  }

  async function handleDeleteConversation(id: string) {
    const ok = await deleteConversation(id);
    if (!ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConvId === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setActiveConvId(remaining[0].id);
      } else {
        const newConv = await createConversation(profile.email);
        if (newConv) {
          setConversations([newConv]);
          setActiveConvId(newConv.id);
        } else {
          setActiveConvId(null);
        }
      }
    }
  }

  const activeConversation = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex flex-1 min-h-0">
      <ChatSidebar
        conversations={conversations}
        activeConvId={activeConvId}
        loading={sidebarLoading}
        onSelect={setActiveConvId}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
        profile={profile}
      />

      <ChatMain
        profile={profile}
        conversationId={activeConvId}
        conversationTitle={activeConversation?.title || 'Hoi thoai moi'}
        dbMessages={dbMessages}
        messagesLoading={loadingMessages}
        model={model}
        onModelChange={setModel}
        onMessagesReload={() => {
          if (activeConvId) loadMessages(activeConvId);
          loadConversations();
        }}
      />
    </div>
  );
}
