'use client';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  model?: string;
}

function formatContent(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

export function MessageBubble({ role, content, time, model }: Props) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-2 mb-1 ml-1">
            <div className="w-5 h-5 rounded-full bg-markee-primary/10 flex items-center justify-center text-[10px] font-bold text-markee-primary">
              M
            </div>
            <span className="text-[10px] font-semibold text-markee-text">Markee AI</span>
            {model && (
              <span className="text-[9px] text-markee-sub bg-markee-border/40 px-1 rounded">{model}</span>
            )}
          </div>
        )}

        <div
          className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-markee-primary text-white rounded-br-md'
              : 'bg-white border border-markee-border text-markee-text rounded-bl-md shadow-sm'
          }`}
          dangerouslySetInnerHTML={{ __html: formatContent(content) }}
        />

        <div className={`text-[10px] text-markee-sub mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
          {time || ''}
        </div>
      </div>
    </div>
  );
}
