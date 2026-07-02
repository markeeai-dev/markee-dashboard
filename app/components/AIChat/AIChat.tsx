'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { supabase } from '@/lib/supabase';
import { type UserProfile } from '@/lib/dashboard-supabase';
import type { ChatSessionRow, ChatMessageRow } from '@/lib/dashboard-supabase';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';

interface AIChatProps {
  profile: UserProfile;
}

// Convert DB message rows to UIMessage[] for useChat.setMessages
function dbToUiMessages(msgs: ChatMessageRow[]): UIMessage[] {
  return msgs
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    }));
}

// Convert UIMessage[] to display-friendly {id, role, content}[] for ChatWindow
function uiToDisplayMessages(msgs: UIMessage[]): { id: string; role: 'user' | 'assistant'; content: string }[] {
  return msgs.map((m) => {
    const textPart = m.parts?.find((p) => p.type === 'text');
    const content = textPart && 'text' in textPart ? (textPart as { text: string }).text : '';
    return { id: m.id, role: m.role as 'user' | 'assistant', content };
  });
}

export default function AIChat({ profile }: AIChatProps) {
  // --- State ---
  const [sessions, setSessions] = useState<ChatSessionRow[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');

  // --- Refs for cleanup ---
  const mountedRef = useRef(true);
  const loadMessagesAbortRef = useRef<AbortController | null>(null);
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;
  const sendingRef = useRef(false);

  // --- DB-loaded messages (UI-authoritative baseline) ---
  const [dbMessages, setDbMessages] = useState<ChatMessageRow[]>([]);

  // --- useChat: streaming, optimistic UI, error handling ---
  const {
    messages: aiMessages,
    sendMessage,
    status,
    setMessages,
    error: chatError,
  } = useChat({
    id: activeSessionId || undefined,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: () => ({ sessionId: activeSessionId, model: selectedModel }),
    }),
    onFinish: () => {
      // Reload DB messages to get the persisted assistant message with its real ID
      if (activeSessionId && mountedRef.current) {
        loadDbMessages(activeSessionId);
      }
    },
  });

  // --- Load sessions on mount + when user changes ---
  useEffect(() => {
    mountedRef.current = true;
    const loadSessions = async () => {
      if (!profile?.authUser?.id) {
        setLoadingSessions(false);
        return;
      }

      try {
        // Load new sessions + legacy conversations in parallel
        const [newSessions, legacySessions] = await Promise.all([
          supabase
            .from('chat_sessions')
            .select('*')
            .eq('user_id', profile.authUser.id)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
              if (error) throw error;
              return (data || []) as ChatSessionRow[];
            }),
          supabase
            .from('conversations')
            .select('*')
            .eq('user_id', profile.email || profile.authUser.email)
            .order('updated_at', { ascending: false })
            .then(({ data, error }) => {
              if (error || !data) return [] as ChatSessionRow[];
              return data.map((c) => ({
                id: c.id,
                user_id: profile.authUser.id,
                title: c.title || 'Hội thoại cũ',
                created_at: c.created_at,
              })) as ChatSessionRow[];
            }),
        ]);

        if (!mountedRef.current) return;

        // Merge: new sessions first, then legacy (dedupe by id)
        const newIds = new Set(newSessions.map((s) => s.id));
        const merged = [...newSessions];
        for (const ls of legacySessions) {
          if (!newIds.has(ls.id)) merged.push(ls);
        }
        merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setSessions(merged);
        if (merged.length > 0 && !activeSessionId) {
          setActiveSessionId(merged[0].id);
        }
      } catch (e) {
        console.error('Error loading chat sessions:', e);
      } finally {
        if (mountedRef.current) setLoadingSessions(false);
      }
    };

    loadSessions();

    return () => {
      mountedRef.current = false;
      loadMessagesAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.authUser?.id]);

  // --- Load DB messages when active session changes ---
  const loadDbMessages = useCallback(async (sessionId: string) => {
    // Cancel any prior in-flight load
    loadMessagesAbortRef.current?.abort();
    const controller = new AbortController();
    loadMessagesAbortRef.current = controller;

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const msgs = (data || []) as ChatMessageRow[];
      setDbMessages(msgs);
      setMessages(dbToUiMessages(msgs));
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('Error loading chat messages:', e);
      }
    }
  }, [setMessages]);

  // Also try to load from legacy messages table if session is a legacy conversation
  const loadLegacyMessages = useCallback(async (conversationId: string) => {
    loadMessagesAbortRef.current?.abort();
    const controller = new AbortController();
    loadMessagesAbortRef.current = controller;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const msgs = ((data || []) as { id: string; role: string; content: string; created_at: string }[])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          session_id: conversationId,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          created_at: m.created_at,
        })) as ChatMessageRow[];

      setDbMessages(msgs);
      setMessages(dbToUiMessages(msgs));
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error('Error loading legacy messages:', e);
      }
    }
  }, [setMessages]);

  useEffect(() => {
    if (activeSessionId) {
      // Try new table first, fall back to legacy
      loadDbMessages(activeSessionId);
    } else {
      setDbMessages([]);
      setMessages([]);
    }
  }, [activeSessionId, loadDbMessages, setMessages]);

  // --- Session CRUD ---
  const handleCreateSession = useCallback(async () => {
    if (!profile?.authUser?.id) return;
    setCreateError(null);

    try {
      const id = crypto.randomUUID();
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          id,
          user_id: profile.authUser.id,
          title: 'Phiên trò chuyện mới',
        })
        .select('*')
        .single();

      if (error) throw error;

      const newSession = data as ChatSessionRow;
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tạo phiên chat mới';
      setCreateError(msg);
      console.error('Error creating chat session:', e);
    }
  }, [profile?.authUser?.id]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      // Delete messages first (FK constraint), then the session
      const { error: msgErr } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);

      // Also try to delete from legacy messages table
      await supabase.from('messages').delete().eq('conversation_id', sessionId);

      if (msgErr) {
        console.error('Error deleting messages:', msgErr);
        // Continue to try session delete anyway
      }

      const { error: sessErr } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      // Also try legacy conversations table
      await supabase.from('conversations').delete().eq('id', sessionId);

      if (sessErr) {
        // If we can't delete from chat_sessions, it might be a legacy-only session
        // Try just conversations
        const { error: convErr } = await supabase
          .from('conversations')
          .delete()
          .eq('id', sessionId);
        if (convErr) {
          console.error('Error deleting session:', sessErr, convErr);
          return;
        }
      }

      // Compute remaining once to avoid stale closure
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);

        // If we deleted the active session, pick the next one
        if (activeSessionId === sessionId) {
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
          } else {
            setActiveSessionId(null);
          }
        }

        return remaining;
      });
    } catch (e) {
      console.error('Error deleting chat session:', e);
    }
  }, [activeSessionId]);

  const handleRenameSession = useCallback(async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const trimmed = newTitle.trim();

      // Try new table first
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: trimmed })
        .eq('id', sessionId);

      if (error) {
        // Fall back to legacy conversations table
        const { error: convErr } = await supabase
          .from('conversations')
          .update({ title: trimmed })
          .eq('id', sessionId);
        if (convErr) throw convErr;
      }

      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
    } catch (e) {
      console.error('Error renaming chat session:', e);
    }
  }, []);

  // --- Send message ---
  const handleSendMessage = useCallback(() => {
    const content = inputValue.trim();

    if (!content) return;
    if (sendingRef.current) return;
    if (status !== 'ready') return;

    sendingRef.current = true;
    setInputValue('');

    if (!activeSessionId) {
      const doCreateAndSend = async () => {
        if (!profile?.authUser?.id) {
          sendingRef.current = false;
          return;
        }
        try {
          const id = crypto.randomUUID();
          const { data, error } = await supabase
            .from('chat_sessions')
            .insert({
              id,
              user_id: profile.authUser.id,
              title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
            })
            .select('*')
            .single();

          if (error) throw error;

          const newSession = data as ChatSessionRow;
          setSessions((prev) => [newSession, ...prev]);
          setActiveSessionId(newSession.id);

          sendMessage({
            parts: [{ type: 'text', text: content }],
            role: 'user',
          });
        } catch (e) {
          console.error('Auto-create session failed:', e);
          setInputValue(content);
        } finally {
          sendingRef.current = false;
        }
      };
      doCreateAndSend();
      return;
    }

    sendMessage({
      parts: [{ type: 'text', text: content }],
      role: 'user',
    });
    sendingRef.current = false;
  }, [inputValue, status, activeSessionId, profile?.authUser?.id, sendMessage]);

  // --- Inject prompt from sidebar ---
  const handleInjectPrompt = useCallback((prompt: string) => {
    setInputValue(prompt);
  }, []);

  // --- Derived display state ---
  const isGenerating = status === 'submitted' || status === 'streaming';

  // Messages to display: if useChat has in-flight/streaming messages, use them;
  // otherwise fall back to the DB-loaded baseline
  const displayMessages = aiMessages.length > 0
    ? uiToDisplayMessages(aiMessages)
    : [];

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        loadingSessions={loadingSessions}
        onSelectSession={setActiveSessionId}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onInjectPrompt={handleInjectPrompt}
        onRenameSession={handleRenameSession}
        createError={createError}
      />

      {loadingSessions ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Đang tải phiên trò chuyện...
        </div>
      ) : (
        <ChatWindow
          messages={displayMessages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          chatError={chatError?.message || null}
        />
      )}
    </div>
  );
}
