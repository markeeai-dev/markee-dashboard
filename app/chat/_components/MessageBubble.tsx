'use client';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  model?: string;
}

function formatContent(text: string): string {
  let result = text;

  // Code blocks (must run before inline code)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre class="bg-gray-100 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>${escaped.trim()}</code></pre>`;
  });

  // Inline code
  result = result.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono">$1</code>');

  // Bold
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-markee-primary underline">$1</a>');

  // Headers
  result = result.replace(/^### (.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1">$1</h4>');
  result = result.replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-3 mb-1">$1</h3>');
  result = result.replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold mt-3 mb-1">$1</h2>');

  // Unordered lists
  result = result.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Ordered lists
  result = result.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Line breaks
  result = result.replace(/\n/g, '<br/>');

  return result;
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
          className={`message-enter px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-markee-primary text-white rounded-br-md'
              : 'bg-white border border-markee-border text-markee-text rounded-bl-md shadow-sm prose-a:text-markee-primary'
          }`}
          dangerouslySetInnerHTML={{ __html: formatContent(content) }}
        />

        {time && (
          <div className={`text-[10px] text-markee-sub mt-0.5 ${isUser ? 'text-right mr-1' : 'ml-1'}`}>
            {time}
          </div>
        )}
      </div>
    </div>
  );
}
