'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { type UserProfile } from '@/lib/dashboard-supabase';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import ChatFolderGrid from './ChatFolderGrid';
import ProjectDetailView from './ProjectDetailView';
import { MODEL_CONFIG } from './ChatInput';

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  project_id?: number | null;
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

async function fetchChatCompletion(model: string, history: { role: string; content: string }[], signal?: AbortSignal) {
  const name = model.toLowerCase();

  // 1. Nhóm Gemini (Gemini 3.5 Flash, 3.1 Lite...)
  if (name.includes('gemini') || name.includes('google')) {
    const geminiModel = model.replace('google/', '');
    const geminiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
    
    let systemInstruction = undefined;
    const contents = [];
    
    for (const m of history) {
      if (m.role === 'system') {
        systemInstruction = {
          parts: [{ text: m.content }]
        };
      } else {
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { systemInstruction } : {}),
      }),
      signal,
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
  }

  // 2. Model Auto (Auto Free) -> OpenRouter
  if (name.includes('auto') || name.includes('free') || name.includes('openrouter')) {
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
      signal,
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

  // 3. Nhóm GPT & Claude (GPT-4o Mini, Claude 4.5 Haiku...) -> ShopAIKey
  const apiKey = process.env.NEXT_PUBLIC_SHOPAIKEY_API_KEY || '';
  const response = await fetch('https://api.shopaikey.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: history,
    }),
    signal,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ShopAIKey request failed with status ${response.status}: ${errText}`);
  }

  const resData = await response.json();
  const reply = resData.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('ShopAIKey returned an empty response.');
  }
  return reply;
}

export default function AIChat({ profile }: AIChatProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const isSendingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    isSendingRef.current = false;
  };
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
  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [chatSummaryText, setChatSummaryText] = useState('');

  // Read URL search params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const queryTab = searchParams.get('tab');
      const querySessionId = searchParams.get('session_id');
      const queryFolderId = searchParams.get('folderId');

      if (queryTab === 'ai_chat' && !querySessionId && !queryFolderId) {
        const lastId = localStorage.getItem('lastActiveChatId');
        if (lastId) {
          const params = new URLSearchParams(window.location.search);
          params.set('session_id', lastId);
          router.replace(`${window.location.pathname}?${params.toString()}`);
          return;
        }
      }

      if (queryTab === 'ai_chat' && querySessionId) {
        localStorage.setItem('lastActiveChatId', querySessionId);
      }
    }

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
            setPendingSessionProjectId(parsedData.projectId || null);
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
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch projects, departments, teams, skills
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: projData } = await supabase.from('projects').select('id, name, type, created_by');
        setProjects(projData || []);

        const { data: deptData } = await supabase.from('departments').select('id, name');
        setDepartments(deptData || []);

        const { data: teamData } = await supabase.from('teams').select('id, name, department_id');
        setTeams(teamData || []);

        const { data: skillData } = await supabase
          .from('skill_library')
          .select('id, title, team_id, markdown_content')
          .eq('status', 'approved')
          .eq('skill_type', 'workflow');
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
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastActiveChatId');
      }
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lastActiveChatId');
    }
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

  const handleSummarizeChat = async () => {
    if (messages.length === 0) return;

    // Validate that session belongs to a project before summarizing
    const activeSessionObj = sessions.find(s => s.id === activeSessionId);
    const projectId = activeSessionObj?.project_id || null;
    if (!projectId) {
      setToast({
        message: "Vui lòng gán đoạn chat này vào một Dự án (Chung hoặc Cá nhân) trước khi tổng hợp.",
        type: 'warning'
      });
      return;
    }

    setIsSummarizing(true);
    setChatSummaryText('');
    setIsSummaryModalOpen(true);
    try {
      const systemPrompt = `Bạn là một chuyên gia đúc kết tri thức dự án. Hãy tóm tắt lịch sử đoạn chat được cung cấp theo ĐÚNG cấu trúc Markdown dưới đây. Tuyệt đối không thêm phần mở bài hay kết bài dư thừa. Nếu một mục không có thông tin, hãy ghi 'Không có thông tin'.

Hãy đọc lại toàn bộ phiên hội thoại phía trên và tạo một bản tổng hợp trạng thái công việc (Project Handover) bằng Markdown.

YÊU CẦU:
- Chỉ ghi thông tin thực sự xuất hiện trong cuộc hội thoại.
- Không suy đoán hoặc tự bổ sung.
- Nếu một mục chưa có thông tin thì ghi "Chưa có".

## 1. TỔNG QUAN DỰ ÁN
- Mục tiêu chính
- Trạng thái hiện tại
- Những quyết định đã chốt

## 2. KIẾN TRÚC & TIÊU CHUẨN KỸ THUẬT
- Công nghệ sử dụng
- Cấu trúc dự án / Module liên quan
- Quy tắc code
- Quy tắc UI/UX
- Quy ước đặt tên (nếu có)

## 3. TRI THỨC RÚT RA
- Những vấn đề đã gặp
- Nguyên nhân
- Cách giải quyết
- Quy trình chuẩn để áp dụng về sau
- Những lưu ý quan trọng

## 4. CÔNG VIỆC ĐANG LÀM DỞ
- TODO
- Các lỗi còn tồn tại
- Các ý tưởng chưa thực hiện
- Những việc cần xác nhận

## 5. BƯỚC TIẾP THEO
Liệt kê theo thứ tự ưu tiên những việc nên làm ngay khi mở lại dự án.`;

      const chatHistoryText = messages.map(m => `${m.role === 'user' ? 'Người dùng' : 'AI'}: ${m.content}`).join('\n\n');
      
      const summary = await fetchChatCompletion(selectedModel, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Hãy tóm tắt lịch sử đoạn chat sau đây:\n\n${chatHistoryText}` }
      ]);
      setChatSummaryText(summary);
    } catch (e) {
      console.error('Error summarizing chat:', e);
      setToast({ message: 'Lỗi khi tổng hợp cuộc trò chuyện', type: 'error' });
      setIsSummaryModalOpen(false);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSaveSummaryAsWip = async () => {
    if (!chatSummaryText || !activeSessionId || !profile?.email) return;
    try {
      const activeSessionObj = sessions.find(s => s.id === activeSessionId);
      const projectId = activeSessionObj?.project_id || null;
      const sessionTitle = activeSessionObj?.title || 'Phiên chat';

      if (!projectId) {
        setToast({ message: 'Phiên chat này chưa thuộc dự án nào. Vui lòng gán dự án trước khi lưu.', type: 'error' });
        return;
      }

      // 1. Fetch current project's master_summary
      const { data: projectData, error: fetchErr } = await supabase
        .from('projects')
        .select('master_summary')
        .eq('id', projectId)
        .single();

      if (fetchErr || !projectData) {
        throw new Error('Không tìm thấy thông tin dự án.');
      }

      // 2. Parse current summaries
      let currentSummaries: any[] = [];
      if (projectData.master_summary) {
        try {
          const parsed = typeof projectData.master_summary === 'string'
            ? JSON.parse(projectData.master_summary)
            : projectData.master_summary;
          if (Array.isArray(parsed)) {
            currentSummaries = parsed;
          }
        } catch (e) {
          console.error("Error parsing existing master_summary:", e);
        }
      }

      // 3. Construct new summary item
      const insights = chatSummaryText
        .split('\n')
        .map(line => line.replace(/^-\s*|^\*\s*|^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);
      const finalInsights = insights.length > 0 ? insights : [chatSummaryText];

      const newSummaryItem = {
        title: "Tổng hợp từ đoạn chat",
        insights: finalInsights,
        contributors: profile.displayName || profile.email,
        author: profile.displayName || profile.email,
        model: "Từ chat AI center",
        tool: "Từ chat AI center",
        timestamp: new Date().toISOString()
      };

      // Prepend to array
      const updatedSummaries = [newSummaryItem, ...currentSummaries];

      // 4. Update project master_summary
      const { error: updateErr } = await supabase
        .from('projects')
        .update({
          master_summary: JSON.stringify(updatedSummaries)
        })
        .eq('id', projectId);

      if (updateErr) throw updateErr;

      setToast({ message: 'Lưu vào Kho tri thức thành công!', type: 'success' });
      setIsSummaryModalOpen(false);
    } catch (e) {
      console.error('Error saving WIP:', e);
      setToast({ message: 'Lỗi khi lưu vào Kho tri thức', type: 'error' });
    }
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
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Snapshot and clear state immediately so UI badge disappears at once
    const localHiddenContext = hiddenContext;
    const localStagedFile = stagedFile;
    setPendingKnowledgeProjectName(null);
    setHiddenContext(null);
    setStagedFile(null);  // Dọn dẹp ngay, không chờ API

    // Đọc nội dung file (nếu có) bằng FileReader trước khi gửi
    let enrichedContent = content;
    if (localStagedFile) {
      try {
        const fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string ?? '');
          reader.onerror = () => reject(reader.error);
          reader.readAsText(localStagedFile);
        });
        if (fileText) {
          enrichedContent = `${content}\n\n--- DỮ LIỆU FILE ĐÍNH KÈM: ${localStagedFile.name} ---\n${fileText}`;
        }
      } catch (readErr) {
        console.error('Lỗi đọc file đính kèm:', readErr);
      }
    }

    // Short display label in DB/UI (do not store full file content in DB)
    const dbContent = localStagedFile
      ? `${content}\n\n📎 Đính kèm: ${localStagedFile.name}`
      : content;

    let currentSessionId = activeSessionId;

    try {
      // 1. Create a new session if none is selected
      if (!currentSessionId) {
        if (!profile?.authUser?.id) return;
        const newSessionId = generateUUID();
        const finalProjectId = pendingSessionProjectId;

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

        const params = new URLSearchParams(window.location.search);
        params.delete('folderId');
        params.set('tab', 'ai_chat');
        params.set('session_id', newSessionId);
        router.replace(`${window.location.pathname}?${params.toString()}`);
      }

      // 2. Insert user message to Supabase (display label, not full file content)
      const { error: userMsgErr } = await supabase.from('chat_messages').insert({
        session_id: currentSessionId,
        role: 'user',
        content: dbContent,
      });
      if (userMsgErr) throw userMsgErr;

      // 3. Update local state (show display label in chat bubble)
      const newUserMsg: Message = { role: 'user', content: dbContent };
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

      // 5. Build context history — use enrichedContent (with file text) for AI only
      const history: { role: string; content: string }[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: enrichedContent },
      ];

      if (localHiddenContext) {
        history.unshift({
          role: 'system',
          content: `Bạn là trợ lý AI. Dưới đây là ngữ cảnh của dự án hiện tại: ${localHiddenContext.content}. Hãy dựa vào thông tin này để trả lời câu hỏi của người dùng.`
        });
      }

      // 6. Fetch from API with priority-based Auto-Fallback
      const fallbackList = [
        'deepseek-v4-flash',
        'gpt-4o-mini',
        'google/gemini-3.5-flash',
        'google/gemini-3.1-flash-lite',
        'openrouter/free'
      ];

      let aiReply = '';
      const currentDisabled = new Set(disabledModels);

      const runFetchWithFallback = async (model: string): Promise<{ reply: string; finalModel: string }> => {
        try {
          const reply = await fetchChatCompletion(model, history, abortControllerRef.current?.signal);
          return { reply, finalModel: model };
        } catch (error: any) {
          if (error?.name === 'AbortError') {
            throw error;
          }

          console.warn(`Lỗi API model ${model}:`, error);
          currentDisabled.add(model);
          setDisabledModels(new Set(currentDisabled));

          const nextModel = fallbackList.find(m => !currentDisabled.has(m));
          if (!nextModel) {
            throw new Error("Tất cả các model trong chuỗi dự phòng đều thất bại.");
          }

          // Cập nhật model dropdown ngay lập tức khi fallback
          setSelectedModel(nextModel);

          const currentModelName = MODEL_CONFIG[model] || model;
          const nextModelName = MODEL_CONFIG[nextModel] || nextModel;
          setToast({
            message: `${currentModelName} quá tải. Đang dùng ${nextModelName}`,
            type: 'warning'
          });

          return runFetchWithFallback(nextModel);
        }
      };

      const result = await runFetchWithFallback(selectedModel);
      aiReply = result.reply;

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
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.log('User stopped the generation.');
        return;
      }
      console.error('Error sending message/getting reply:', e);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '❌ Có lỗi xảy ra trong quá trình xử lý. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.',
        },
      ]);
    } finally {
      abortControllerRef.current = null;
      isSendingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleCreateSessionAndSend = async (content: string, projectId: number) => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setIsGenerating(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const localHiddenContext = hiddenContext;
    const localStagedFile = stagedFile;
    setPendingKnowledgeProjectName(null);
    setHiddenContext(null);
    setStagedFile(null);  // Dọn dẹp ngay lập tức

    // Đọc nội dung file (nếu có) bằng FileReader trước khi gửi
    let enrichedContent = content;
    if (localStagedFile && content !== 'Đoạn chat mới') {
      try {
        const fileText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string ?? '');
          reader.onerror = () => reject(reader.error);
          reader.readAsText(localStagedFile);
        });
        if (fileText) {
          enrichedContent = `${content}\n\n--- DỮ LIỆU FILE ĐÍNH KÈM: ${localStagedFile.name} ---\n${fileText}`;
        }
      } catch (readErr) {
        console.error('Lỗi đọc file đính kèm:', readErr);
      }
    }

    const dbContent = (localStagedFile && content !== 'Đoạn chat mới')
      ? `${content}\n\n📎 Đính kèm: ${localStagedFile.name}`
      : content;

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
          content: dbContent,
        });
        if (userMsgErr) throw userMsgErr;

        const newUserMsg: Message = { role: 'user', content: dbContent };
        setMessages([newUserMsg]);

        const params = new URLSearchParams(window.location.search);
        params.delete('folderId');
        params.set('tab', 'ai_chat');
        params.set('session_id', newSessionId);
        router.replace(`${window.location.pathname}?${params.toString()}`);

        // History dùng enrichedContent để AI đọc được nội dung file
        const history: { role: string; content: string }[] = [{
          role: 'user',
          content: enrichedContent
        }];

        if (localHiddenContext) {
          history.unshift({
            role: 'system',
            content: `Bạn là trợ lý AI. Dưới đây là ngữ cảnh của dự án hiện tại: ${localHiddenContext.content}. Hãy dựa vào thông tin này để trả lời câu hỏi của người dùng.`
          });
        }
        let aiReply = '';
        const currentDisabled = new Set(disabledModels);
        const fallbackList = [
          'deepseek-v4-flash',
          'gpt-4o-mini',
          'google/gemini-3.5-flash',
          'google/gemini-3.1-flash-lite',
          'openrouter/free'
        ];

        const runFetchWithFallback = async (model: string): Promise<{ reply: string; finalModel: string }> => {
          try {
            const reply = await fetchChatCompletion(model, history, abortControllerRef.current?.signal);
            return { reply, finalModel: model };
          } catch (error: any) {
            if (error?.name === 'AbortError') {
              throw error;
            }

            console.warn(`Lỗi API model ${model}:`, error);
            currentDisabled.add(model);
            setDisabledModels(new Set(currentDisabled));
            const nextModel = fallbackList.find(m => !currentDisabled.has(m));
            if (!nextModel) throw new Error("Tất cả các model đều thất bại.");

            // Cập nhật model dropdown ngay lập tức khi fallback
            setSelectedModel(nextModel);

            const currentModelName = MODEL_CONFIG[model] || model;
            const nextModelName = MODEL_CONFIG[nextModel] || nextModel;
            setToast({
              message: `${currentModelName} quá tải. Đang dùng ${nextModelName}`,
              type: 'warning'
            });

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
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.log('User stopped the generation.');
        return;
      }
      console.error(e);
      setToast({ message: 'Lỗi khi tạo phiên trò chuyện', type: 'error' });
    } finally {
      abortControllerRef.current = null;
      isSendingRef.current = false;
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
        <div className={`fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-lg border transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
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
          globalProjects={projects.filter((p: any) => p.type === 'WIP_GLOBAL')}
          personalProjects={personalFolders}
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
          stagedFile={stagedFile}
          setStagedFile={setStagedFile}
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
          onStopGeneration={handleStopGeneration}
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
          onSummarizeChat={handleSummarizeChat}
          stagedFile={stagedFile}
          setStagedFile={setStagedFile}
        />
      )}

      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-3xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-1.5 shrink-0">
              <span>📝</span> Tổng hợp nội dung hội thoại
            </h3>
            
            <div className="flex-1 overflow-y-auto min-h-60 border border-slate-100 rounded-xl p-4 bg-slate-50 text-xs text-slate-700 leading-relaxed font-medium">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center h-full py-20 space-y-3">
                  <span className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 font-bold">Đang tổng hợp nội dung cuộc trò chuyện bằng AI...</p>
                </div>
              ) : (
                <div className="prose prose-slate max-w-none text-xs whitespace-pre-wrap">
                  {chatSummaryText || 'Không có nội dung tóm tắt.'}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 text-xs font-bold mt-4 shrink-0">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl cursor-pointer"
              >
                Đóng
              </button>
               {!isSummarizing && chatSummaryText && (
                <button
                  type="button"
                  onClick={handleSaveSummaryAsWip}
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl cursor-pointer"
                >
                  Lưu vào Kho tri thức
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}