'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef, useState } from 'react';
import { Layers, RefreshCw, Sparkle } from 'lucide-react';
import type { UserProfile, ChatMessage as DBChatMessage } from '@/lib/dashboard-supabase';
import { ModelSelector } from './ModelSelector';
import { CoachBar } from './CoachBar';
import { Composer } from './Composer';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import type { ModelKey } from './types';
import type { UIMessage } from 'ai';

function getMessageText(m: UIMessage): string {
  const textPart = m.parts?.find((p) => p.type === 'text');
  if (textPart && 'text' in textPart) return (textPart as { text: string }).text;
  return '';
}

interface Props {
  profile: UserProfile;
  conversationId: string | null;
  conversationTitle: string;
  dbMessages: DBChatMessage[];
  messagesLoading: boolean;
  model: ModelKey;
  onModelChange: (model: ModelKey) => void;
  onMessagesReload: () => void;
}

export function ChatMain({
  conversationId,
  conversationTitle,
  dbMessages,
  messagesLoading,
  model,
  onModelChange,
  onMessagesReload,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [coachVisible, setCoachVisible] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const initialMessages: UIMessage[] = dbMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      parts: [{ type: 'text' as const, text: m.content }],
    }));

  const {
    messages: aiMessages,
    sendMessage,
    status,
    setMessages,
    error,
  } = useChat({
    id: conversationId || undefined,
    transport: new DefaultChatTransport({
      api: '/api/chat',
      body: conversationId ? { conversationId } : undefined,
    }),
    messages: initialMessages,
    onFinish: () => {
      onMessagesReload();
    },
  });

  useEffect(() => {
    if (conversationId && dbMessages.length > 0) {
      const msgs: UIMessage[] = dbMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          parts: [{ type: 'text' as const, text: m.content }],
        }));
      setMessages(msgs);
    } else if (conversationId && dbMessages.length === 0) {
      setMessages([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiMessages, status]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || status !== 'ready') return;
    sendMessage({
      parts: [{ type: 'text' as const, text: inputValue }],
      role: 'user' as const,
    });
    setInputValue('');
    setCoachVisible(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputValue(e.target.value);
    setCoachVisible(e.target.value.length >= 5);
  }

  const isLoading = status === 'submitted' || status === 'streaming';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-markee-bg/50">
      <div className="h-12 bg-white border-b border-markee-border px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-markee-primary shrink-0" />
          <span className="text-sm font-semibold text-markee-text truncate">{conversationTitle}</span>
          {messagesLoading && (
            <RefreshCw className="w-3 h-3 text-markee-sub animate-spin" />
          )}
        </div>
        <ModelSelector model={model} onChange={onModelChange} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="w-6 h-6 text-markee-primary animate-spin mx-auto mb-2" />
              <p className="text-sm text-markee-sub">Đang tải hội thoại...</p>
            </div>
          </div>
        ) : !conversationId ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-xs">
              <Sparkle className="w-10 h-10 text-markee-primary/20 mx-auto mb-3" />
              <p className="text-sm font-semibold text-markee-text mb-1">Bắt đầu hội thoại mới</p>
              <p className="text-xs text-markee-sub">Tạo hội thoại mới hoặc chọn một hội thoại có sẵn để bắt đầu</p>
            </div>
          </div>
        ) : aiMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <Sparkle className="w-10 h-10 text-markee-primary/20 mx-auto mb-3" />
              <p className="text-sm font-semibold text-markee-text mb-2">Chào mừng đến Markee AI Chat</p>
              <p className="text-xs text-markee-sub leading-relaxed">
                Hãy gửi câu hỏi hoặc yêu cầu của bạn. AI sẽ phản hồi dựa trên kiến thức đã được huấn luyện.
                Bạn có thể inject asset từ Library để AI có thêm bối cảnh chính xác.
              </p>
            </div>
          </div>
        ) : (
          <div>
            {aiMessages.map((m) => (
              <MessageBubble
                key={m.id}
                role={m.role as 'user' | 'assistant'}
                content={getMessageText(m)}
                model={m.role === 'assistant' ? 'Gemini 2.0 Flash' : undefined}
              />
            ))}
            {isLoading && <TypingIndicator />}
            {error && (
              <div className="text-center py-3">
                <span className="text-xs text-red-500 bg-red-50 px-3 py-1 rounded-full">
                  Lỗi kết nối. Thử lại.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <CoachBar input={inputValue} visible={coachVisible} />

      <Composer
        input={inputValue}
        isLoading={isLoading}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onInputValueChange={setInputValue}
      />
    </div>
  );
}
