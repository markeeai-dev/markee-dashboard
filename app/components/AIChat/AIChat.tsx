'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { type UserProfile } from '@/lib/dashboard-supabase';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import ChatFolderGrid from './ChatFolderGrid';
import ProjectDetailView from './ProjectDetailView';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface Message {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface AIChatProps {
  profile: UserProfile;
}

function generateUUID() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function fetchChatCompletion(model: string, history: { role: string; content: string }[]) {
  if (model.startsWith('google/')) {
    const geminiModel = model.replace('google/', '');
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    
    const contents = history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API request failed with status ${response.status}: ${errText}`);
    }

    const resData = await response.json();
    const reply = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      throw new Error('Gemini API returned an empty response.');
    }
    return reply;
  } else {
    const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        'X-Title': 'Markee AI',
      },
      body: JSON.stringify({
        model: model,
        messages: history,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter request failed with status ${response.status}: ${errText}`);
    }

    const resData = await response.json();
    const reply = resData.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('OpenRouter returned an empty response.');
    }
    return reply;
  }
}

export default function AIChat({ profile }: AIChatProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [selectedModel, setSelectedModel] = useState('openrouter/free');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [disabledModels, setDisabledModels] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string; department_id: number }[]>([]);
  const [skills, setSkills] = useState<{ id: number; title: string; team_id: number; markdown_content: string }[]>([]);

  const [pendingSessionProjectId, setPendingSessionProjectId] = useState<number | null>(null);
  const [pendingKnowledgeProjectName, setPendingKnowledgeProjectName] = useState<string | null>(null);
  const [initialMsgToSend, setInitialMsgToSend] = useState<string | null>(null);
  const [hiddenContext, setHiddenContext] = useState<{ title: string; content: string } | null>(null);

  // Read URL search params
  useEffect(() => {
    const queryProjectId = searchParams.get('project_id');
    const queryInitialMsg = searchParams.get('initial_msg');
    const querySessionId = searchParams.get('session_id');
    const folderId = searchParams.get('folderId');

    if (queryProjectId) {
      setPendingSessionProjectId(Number(queryProjectId));
    }

    if (querySessionId) {
      setActiveSessionId(querySessionId);
    } else {
      setActiveSessionId(null);
    }

    if (folderId) {
      // If we are looking at a folder, don't keep any chat open
      setActiveSessionId(null);
    }

    if (queryInitialMsg) {
      setInitialMsgToSend(queryInitialMsg);
      // Clear params from URL silently
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams]);

  // Context Injection from Kho Tri Thức
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pending = sessionStorage.getItem('markee_pending_knowledge');
      if (pending) {
        try {
          const parsedData = JSON.parse(pending);
          if (parsedData && parsedData.content) {
            // Chuyển sang trạng thái "New Chat" (Pending session)
            setActiveSessionId(null);
            setMessages([]);
            
            // Kích hoạt hiển thị Badge Dự án (Silent Update)
            setPendingSessionProjectId(null);
            setPendingKnowledgeProjectName(parsedData.projectName || null);

            // Lưu nội dung summary vào hiddenContext, ĐỂ TRỐNG thẻ textarea
            setHiddenContext({
              title: parsedData.title || 'Bản tóm tắt tri thức',
              content: parsedData.content
            });
            setInputValue('');

            // Xóa data để tránh lặp lại
            sessionStorage.removeItem('markee_pending_knowledge');
          }
        } catch (e) {
          console.error('Error parsing pending knowledge:', e);
        }
      }
    }
  }, [profile?.authUser?.id]);

  // Dismiss toast automatically
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch projects, departments, teams, skills
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: projData } = await supabase.from('projects').select('id, name');
        setProjects(projData || []);

        const { data: deptData } = await supabase.from('departments').select('id, name');
        setDepartments(deptData || []);

        const { data: teamData } = await supabase.from('teams').select('id, name, department_id');
        setTeams(teamData || []);

        const { data: skillData } = await supabase
          .from('skill_library')
          .select('id, title, team_id, markdown_content')
          .eq('status', 'approved');
        setSkills(skillData || []);
      } catch (e) {
        console.error('Error fetching chat popover metadata:', e);
      }
    };
    fetchMetadata();
  }, []);

  const handleUpdateSessionProject = async (sessionId: string, projectId: number | null) => {
    if (sessionId === 'pending') {
      setPendingSessionProjectId(projectId);
      return;
    }
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ project_id: projectId })
        .eq('id', sessionId);

      if (error) throw error;

      // Cập nhật state cục bộ
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, project_id: projectId } : s))
      );
    } catch (e) {
      console.error('Error updating session project:', e);
      setToast({ message: 'Lỗi khi cập nhật dự án cho phiên chat', type: 'error' });
    }
  };

  // Load chat sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      if (!profile?.authUser?.id) return;
      setLoadingSessions(true);
      try {
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', profile.authUser.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setSessions(data || []);
        if (data && data.length > 0) {
          const params = new URLSearchParams(window.location.search);
          const querySessionId = params.get('session_id');
          if (querySessionId && data.some(s => s.id === querySessionId)) {
            setActiveSessionId(querySessionId);
          } else {
            setActiveSessionId(null);
          }
        }
      } catch (e) {
        console.error('Error loading chat sessions:', e);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadSessions();
  }, [profile?.authUser?.id]);

  // Personal Folders (type = 'PERSONAL') state & actions
  const [personalFolders, setPersonalFolders] = useState<{ id: number; name: string }[]>([]);

  const loadPersonalFolders = async () => {
    if (!profile?.email) return;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('type', 'PERSONAL')
        .eq('created_by', profile.email)
        .order('name', { ascending: true });
      if (error) throw error;
      setPersonalFolders(data || []);
    } catch (e) {
      console.error('Error loading personal folders:', e);
    }
  };

  useEffect(() => {
    if (profile?.email) {
      loadPersonalFolders();
    }
  }, [profile?.email]);

  const handleCreateFolder = async (name: string) => {
    if (!profile?.email) return;
    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          name,
          type: 'PERSONAL',
          created_by: profile.email
        });
      if (error) throw error;
      setToast({ message: 'Tạo thư mục mới thành công!', type: 'success' });
      await loadPersonalFolders();
    } catch (e) {
      console.error('Error creating folder:', e);
      setToast({ message: 'Lỗi khi tạo thư mục', type: 'error' });
    }
  };

  const handleRenameFolder = async (id: number, newName: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: newName })
        .eq('id', id);
      if (error) throw error;
      setToast({ message: 'Đổi tên thư mục thành công!', type: 'success' });
      await loadPersonalFolders();
    } catch (e) {
      console.error('Error renaming folder:', e);
      setToast({ message: 'Lỗi khi đổi tên thư mục', type: 'error' });
    }
  };

  const handleDeleteFolder = async (id: number) => {
    try {
      await supabase
        .from('chat_sessions')
        .update({ project_id: null })
        .eq('project_id', id);

      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setToast({ message: 'Xóa thư mục thành công!', type: 'success' });
      await loadPersonalFolders();
    } catch (e) {
      console.error('Error deleting folder:', e);
      setToast({ message: 'Lỗi khi xóa thư mục', type: 'error' });
    }
  };

  // Load messages when active session changes
  useEffect(() => {
    const loadMessages = async () => {
      if (!activeSessionId) {
        setMessages([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', activeSessionId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (e) {
        console.error('Error loading chat messages:', e);
      }
    };

    loadMessages();
  }, [activeSessionId]);

  const exitFolderView = () => {
    setPendingSessionProjectId(null);
  };

  const handleSelectSession = (id: string | null) => {
    exitFolderView();
    if (!id) {
      setActiveSessionId(null);
      setMessages([]);
      setIsSidebarOpen(false);
      const params = new URLSearchParams(window.location.search);
      params.delete('session_id');
      params.delete('folderId');
      router.replace(`${window.location.pathname}?${params.toString()}`);
      return;
    }
    setActiveSessionId(id);
    setIsSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('folderId');
    params.set('tab', 'ai_chat');
    params.set('session_id', id);
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const handleCreateSession = () => {
    setActiveSessionId(null);
    setMessages([]);
    setPendingSessionProjectId(null);
    setIsSidebarOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete('folderId');
    params.delete('session_id');
    params.set('tab', 'ai_chat');
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      // Delete messages first due to foreign key
      await supabase.from('chat_messages').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);
      if (error) throw error;

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setActiveSessionId(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('Error deleting chat session:', e);
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ title: newTitle.trim() })
        .eq('id', sessionId);

      if (error) throw error;

      // Cập nhật lại UI ngay lập tức
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle.trim() } : s))
      );
    } catch (e) {
      console.error('Error renaming chat session:', e);
    }
  };

  const handleInjectPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  const handleSendMessage = async () => {
    const content = inputValue.trim();
    if (!content) return;
    setInputValue('');
    await sendMessageContent(content);
  };

  const sendMessageContent = async (content: string) => {
    if (isGenerating) return;

    // Lớp bảo vệ 1: Clear state ngay tức thì để UI cập nhật giấu badge ngay lập tức
    const localPendingProjectName = pendingKnowledgeProjectName;
    setPendingKnowledgeProjectName(null);
    setHiddenContext(null);

    setIsGenerating(true);

    let currentSessionId = activeSessionId;

    try {
      // 1. Create a new session if none is selected
      if (!currentSessionId) {
        if (!profile?.authUser?.id) return;
        const newSessionId = generateUUID();
        
        let finalProjectId = pendingSessionProjectId;
        if (localPendingProjectName) {
          try {
            // A. Check if Personal Project already exists
            const { data: existingProj, error: queryErr } = await supabase
              .from('projects')
              .select('id')
              .eq('type', 'PERSONAL')
              .eq('created_by', profile.email)
              .eq('name', localPendingProjectName)
              .maybeSingle();

            if (queryErr) console.error('Error querying personal project:', queryErr);

            if (existingProj) {
              finalProjectId = existingProj.id;
            } else {
              // Create new Personal Project
              const { data: newProj, error: createProjErr } = await supabase
                .from('projects')
                .insert({
                  name: localPendingProjectName,
                  type: 'PERSONAL',
                  created_by: profile.email
                })
                .select('id')
                .single();

              if (createProjErr) {
                console.error('Error creating personal project:', createProjErr);
                throw createProjErr;
              }
              finalProjectId = newProj.id;

              // Refresh personal folders list in background
              await loadPersonalFolders();
            }
          } catch (projErr) {
            console.error('Failed to handle lazy-creation of project:', projErr);
          }
        }

        const { data: newSess, error: sessErr } = await supabase
          .from('chat_sessions')
          .insert({
            id: newSessionId,
            title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
            user_id: profile.authUser.id,
            project_id: finalProjectId
          })
          .select('*')
          .single();

        if (sessErr) throw sessErr;
        currentSessionId = newSessionId;
        setSessions((prev) => [newSess, ...prev]);
        setActiveSessionId(newSessionId);
        setPendingSessionProjectId(null);

        // C. Redirect to Chat session UI via search params
        const params = new URLSearchParams(window.location.search);
        params.delete('folderId');
        params.set('tab', 'ai_chat');
        params.set('session_id', newSessionId);
        router.replace(`${window.location.pathname}?${params.toString()}`);
      }

      // 2. Insert user message to Supabase
      const { error: userMsgErr } = await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content,
      });
      if (userMsgErr) throw userMsgErr;

      // 3. Update local state
      const newUserMsg: Message = { role: 'user', content };
      setMessages((prev) => [...prev, newUserMsg]);

      // 4. Update session title if it was the default title
      const activeSessionObj = sessions.find((s) => s.id === currentSessionId);
      if (activeSessionObj && activeSessionObj.title === 'Đoạn chat mới') {
        const truncatedTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        await supabase
          .from('chat_sessions')
          .update({ title: truncatedTitle })
          .eq('id', currentSessionId);

        setSessions((prev) =>
          prev.map((s) => (s.id === currentSessionId ? { ...s, title: truncatedTitle } : s))
        );
      }

      // 5. Build context history for OpenRouter
      const history = [...messages, newUserMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      if (hiddenContext) {
        const combinedContent = `[Tri thức nền tảng:\n${hiddenContext.content}]\n\n--- Yêu cầu hiện tại:\n${content}`;
        if (history.length > 0) {
          history[history.length - 1].content = combinedContent;
        }
        setHiddenContext(null);
      }

      // 6. Fetch from API with priority-based Auto-Fallback
      const fallbackList = [
        'claude-3-haiku-20240307',
        'gpt-4o-mini',
        'google/gemini-3.5-flash',
        'google/gemini-3.1-flash-lite',
        'openrouter/free'
      ];

      let aiReply = '';
      const currentDisabled = new Set(disabledModels);

      const runFetchWithFallback = async (model: string): Promise<{ reply: string; finalModel: string }> => {
        try {
          const reply = await fetchChatCompletion(model, history);
          return { reply, finalModel: model };
        } catch (error) {
          console.warn(`Lỗi API model ${model}:`, error);
          currentDisabled.add(model);
          setDisabledModels(new Set(currentDisabled));

          // Tìm model tiếp theo khả dụng
          const nextModel = fallbackList.find(m => !currentDisabled.has(m));
          if (!nextModel) {
            throw new Error("Tất cả các model trong chuỗi dự phòng đều thất bại.");
          }

          // Cảnh báo Toast về việc Fallback
          setToast({
            message: `${model} đang bận, đã tự động dùng ${nextModel}`,
            type: 'warning'
          });

          return runFetchWithFallback(nextModel);
        }
      };

      const result = await runFetchWithFallback(selectedModel);
      aiReply = result.reply;

      // Nếu có sự thay đổi model so với model ban đầu được chọn
      if (result.finalModel !== selectedModel) {
        setSelectedModel(result.finalModel);
      }

      // 7. Insert AI response to Supabase
      const { error: aiMsgErr } = await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        role: 'assistant',
        content: aiReply,
      });
      if (aiMsgErr) throw aiMsgErr;

      // 8. Update local state with assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: aiReply }]);
    } catch (e) {
      console.error('Error sending message/getting reply:', e);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Có lỗi xảy ra trong quá trình xử lý. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.',
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateSessionAndSend = async (content: string, projectId: number) => {
    if (isGenerating) return;
    setIsGenerating(true);

    try {
      if (!profile?.authUser?.id) return;
      const newSessionId = generateUUID();
      const title = content === 'Đoạn chat mới' ? 'Đoạn chat mới' : content.slice(0, 30) + (content.length > 30 ? '...' : '');

      const { data: newSess, error: sessErr } = await supabase
        .from('chat_sessions')
        .insert({
          id: newSessionId,
          title,
          user_id: profile.authUser.id,
          project_id: projectId
        })
        .select('*')
        .single();

      if (sessErr) throw sessErr;

      setSessions((prev) => [newSess, ...prev]);
      setActiveSessionId(newSessionId);

      if (content !== 'Đoạn chat mới') {
        const { error: userMsgErr } = await supabase.from('chat_messages').insert({
          session_id: newSessionId,
          role: 'user',
          content,
        });
        if (userMsgErr) throw userMsgErr;

        const newUserMsg: Message = { role: 'user', content };
        setMessages([newUserMsg]);

        const params = new URLSearchParams(window.location.search);
        params.delete('folderId');
        params.set('tab', 'ai_chat');
        params.set('session_id', newSessionId);
        router.replace(`${window.location.pathname}?${params.toString()}`);

        const history = [newUserMsg];
        let aiReply = '';
        const currentDisabled = new Set(disabledModels);
        const fallbackList = [
          'claude-3-haiku-20240307',
          'gpt-4o-mini',
          'google/gemini-3.5-flash',
          'google/gemini-3.1-flash-lite',
          'openrouter/free'
        ];

        const runFetchWithFallback = async (model: string): Promise<{ reply: string; finalModel: string }> => {
          try {
            const reply = await fetchChatCompletion(model, history);
            return { reply, finalModel: model };
          } catch (error) {
            console.warn(`Lỗi API model ${model}:`, error);
            currentDisabled.add(model);
            setDisabledModels(new Set(currentDisabled));
            const nextModel = fallbackList.find(m => !currentDisabled.has(m));
            if (!nextModel) throw new Error("Tất cả các model đều thất bại.");
            return runFetchWithFallback(nextModel);
          }
        };

        const result = await runFetchWithFallback(selectedModel);
        aiReply = result.reply;

        await supabase.from('chat_messages').insert({
          session_id: newSessionId,
          role: 'assistant',
          content: aiReply,
        });

        setMessages((prev) => [...prev, { role: 'assistant', content: aiReply }]);
      } else {
        setMessages([]);
        const params = new URLSearchParams(window.location.search);
        params.delete('folderId');
        params.set('tab', 'ai_chat');
        params.set('session_id', newSessionId);
        router.replace(`${window.location.pathname}?${params.toString()}`);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Lỗi khi tạo phiên trò chuyện', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Tự động gửi tin nhắn ban đầu từ trang dự án nếu có
  useEffect(() => {
    if (initialMsgToSend && profile?.authUser?.id) {
      const msg = initialMsgToSend;
      setInitialMsgToSend(null);
      sendMessageContent(msg);
    }
  }, [initialMsgToSend, profile?.authUser?.id]);

  const activeSession = activeSessionId 
    ? (sessions.find((s) => s.id === activeSessionId) || null)
    : { id: 'pending', title: 'Đoạn chat mới', created_at: '', project_id: pendingSessionProjectId };

  return (
    <div className="flex h-[calc(100vh-64px)] w-full overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-xs relative">
      {/* Overlay cho ChatSidebar trên Mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Thông báo Toast của AIChat */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : toast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {toast.type === 'success' && <span>✅</span>}
          {toast.type === 'error' && <span>❌</span>}
          {toast.type === 'warning' && <span>⚠️</span>}
          <span>{toast.message}</span>
        </div>
      )}

      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onDeleteSession={handleDeleteSession}
        onInjectPrompt={handleInjectPrompt}
        onRenameSession={handleRenameSession}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        projects={projects}
        personalFolders={personalFolders}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
      />
      
      {loadingSessions ? (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
          Đang tải phiên trò chuyện...
        </div>
      ) : searchParams.get('tab') === 'chat-folders' ? (
        <ChatFolderGrid
          personalFolders={personalFolders}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />
      ) : (searchParams.get('folderId') && !activeSessionId) ? (
        <ProjectDetailView
          folderId={Number(searchParams.get('folderId'))}
          personalFolders={personalFolders}
          sessions={sessions}
          onSelectSession={handleSelectSession}
          onRenameFolder={handleRenameFolder}
          onCreateSessionAndSend={handleCreateSessionAndSend}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          disabledModels={disabledModels}
          hiddenContext={hiddenContext}
          setHiddenContext={setHiddenContext}
          projects={projects}
          departments={departments}
          teams={teams}
          skills={skills}
        />
      ) : (
        <ChatWindow
          messages={messages}
          inputValue={inputValue}
          setInputValue={setInputValue}
          onSendMessage={handleSendMessage}
          hiddenContext={hiddenContext}
          setHiddenContext={setHiddenContext}
          isGenerating={isGenerating}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          disabledModels={disabledModels}
          projects={projects}
          departments={departments}
          teams={teams}
          skills={skills}
          activeSession={activeSession}
          onUpdateSessionProject={handleUpdateSessionProject}
          personalFolders={personalFolders}
          pendingKnowledgeProjectName={pendingKnowledgeProjectName}
          onClearPendingKnowledgeProjectName={() => setPendingKnowledgeProjectName(null)}
        />
      )}
    </div>
  );
}