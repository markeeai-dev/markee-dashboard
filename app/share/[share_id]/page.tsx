'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/contexts/AuthContext';
import { MarkdownRenderer } from '@/app/components/AIChat/MarkdownRenderer';
import { Laptop, User, Zap, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attached_knowledge?: {
    id: string;
    title: string;
  } | null;
  created_at: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

export default function ShareChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user: profile } = useAuth();
  
  const share_id = params.share_id as string;
  
  const [session, setSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    const fetchSharedChat = async () => {
      if (!share_id) return;
      try {
        setLoading(true);
        setErrorMsg(null);

        // 1. Fetch chat session by share_id
        const { data: sessionData, error: sessionError } = await supabase
          .from('chat_sessions')
          .select('id, title, created_at')
          .eq('share_id', share_id)
          .single();

        if (sessionError || !sessionData) {
          throw new Error('Đoạn chat được chia sẻ không tồn tại hoặc đã bị thu hồi.');
        }

        setSession(sessionData);

        // 2. Fetch all messages in that session
        const { data: messagesData, error: messagesError } = await supabase
          .from('chat_messages')
          .select('id, role, content, attached_knowledge, created_at')
          .eq('session_id', sessionData.id)
          .order('created_at', { ascending: true });

        if (messagesError) {
          throw new Error('Không thể tải các tin nhắn của đoạn chat này.');
        }

        setMessages(messagesData || []);
      } catch (err: any) {
        console.error('Error fetching shared chat:', err);
        setErrorMsg(err.message || 'Đã có lỗi xảy ra khi tải dữ liệu.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedChat();
  }, [share_id]);

  // Clone/Copy chat to current user's session list
  const handleCloneChat = async () => {
    if (!profile?.authUser?.id) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_clone_token', share_id);
      }
      router.push(`/?show_login=true`);
      return;
    }

    try {
      setCloning(true);
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/chat/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          token: share_id,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi nhân bản đoạn chat.');
      }

      console.log('Nhân bản chat thành công:', resData);
      
      // Chuyển hướng người dùng về trang chat chính với session mới vừa clone
      router.push(`/?tab=ai_chat&session_id=${resData.new_session_id}`);
    } catch (err: any) {
      console.error('Error cloning chat:', err);
      alert(err.message || 'Lỗi trong quá trình nhân bản đoạn chat.');
    } finally {
      setCloning(false);
    }
  };

  // Helper render user content inside bubbles
  const renderUserContent = (text: string) => {
    const lines = text.split('\n');
    const mainLines = lines.filter(line => !line.startsWith('📎 Đính kèm:') && !line.includes('--- DỮ LIỆU FILE ĐÍNH KÈM:'));
    return (
      <p className="whitespace-pre-wrap break-words">{mainLines.join('\n').trim()}</p>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-markee-primary animate-spin" />
        <p className="text-xs text-slate-500 font-semibold">Đang tải cuộc trò chuyện được chia sẻ...</p>
      </div>
    );
  }

  if (errorMsg || !session) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center shadow-xl space-y-6">
          <div className="w-12 h-12 rounded-full bg-red-50 text-markee-primary flex items-center justify-center border border-red-100 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Không thể xem cuộc trò chuyện</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">{errorMsg}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-5 py-2.5 rounded-xl transition-all shadow-md"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Quay lại Dashboard</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-800 font-sans">
      {/* Sticky Header */}
      <header className="h-16 border-b border-slate-200/80 px-6 bg-white flex items-center justify-between sticky top-0 z-50 shadow-2xs shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 transition-colors"
            title="Quay lại Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="h-5 w-[1px] bg-slate-200" />
          <div>
            <h2 className="text-xs font-bold text-slate-800 line-clamp-1 max-w-[180px] sm:max-w-[300px] md:max-w-[450px]">
              {session.title}
            </h2>
            <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Cuộc trò chuyện được chia sẻ công khai</p>
          </div>
        </div>

        <div>
          <button
            onClick={handleCloneChat}
            disabled={cloning}
            className="bg-markee-primary hover:bg-markee-hover text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 flex items-center gap-1.5 border-0 cursor-pointer disabled:opacity-50"
          >
            {cloning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 fill-white" />
            )}
            <span>Tiếp tục trò chuyện</span>
          </button>
        </div>
      </header>

      {/* Main chat messages viewport */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-8 overflow-y-auto space-y-6 md:space-y-8">
        
        {/* Top banner notification */}
        <div className="bg-slate-100 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed flex items-center justify-between gap-4">
          <p>
            Đây là bản lưu trữ <strong>Chỉ đọc (Read-only)</strong> của cuộc trò chuyện. Bạn có thể nhấn <strong>Tiếp tục trò chuyện</strong> để sao chép toàn bộ nội dung này sang tài khoản của bạn và tiếp tục tương tác với AI.
          </p>
        </div>

        {/* Messages List */}
        <div className="space-y-6 md:space-y-8 w-full min-w-0">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div key={msg.id || index} className={`flex gap-3.5 w-full min-w-0 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0 select-none shadow-3xs">
                    <Laptop className="h-4 w-4" />
                  </div>
                )}

                <div className={`max-w-[88%] md:max-w-[75%] min-w-0 overflow-hidden rounded-2xl px-4 py-3 text-xs leading-relaxed ${isUser
                  ? 'bg-red-50/50 border border-red-100 text-slate-800 rounded-tr-none'
                  : 'bg-slate-50/50 border border-slate-200 text-slate-800 rounded-tl-none shadow-3xs'
                  }`}>
                  {isUser ? (
                    <div className="space-y-2">
                      {renderUserContent(msg.content)}
                      {msg.attached_knowledge && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg shadow-3xs max-w-full w-fit">
                          <span>📎</span>
                          <span className="font-semibold text-[10px] select-none text-slate-500">Đính kèm:</span>
                          <span className="font-bold text-[10px] truncate max-w-[180px] md:max-w-[240px] text-slate-700" title={msg.attached_knowledge.title}>
                            {msg.attached_knowledge.title}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full min-w-0 wrap-break-word text-xs">
                      <MarkdownRenderer content={msg.content.replace(/\n{3,}/g, '\n\n')} />
                    </div>
                  )}
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 select-none shadow-3xs">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
