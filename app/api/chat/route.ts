import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages } from 'ai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const gemini = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const SYSTEM_PROMPT = `Bạn là Markee AI Assistant — trợ lý AI chuyên nghiệp của Markee AI Ops Center.

Vai trò của bạn:
1. Trợ giúp người dùng tạo prompt chất lượng cao cho các tác vụ Marketing, Sales, Dev, Ops
2. Gợi ý cải thiện quy trình làm việc với AI
3. Trả lời nhanh, chính xác, bằng tiếng Việt
4. Khi được inject asset từ Library, sử dụng kiến thức đó để đưa ra câu trả lời chính xác nhất

Định dạng:
- Trả lời ngắn gọn, có cấu trúc rõ ràng
- Dùng markdown để định dạng (tiêu đề, danh sách, in đậm)
- Luôn ưu tiên tiếng Việt, chỉ dùng tiếng Anh cho thuật ngữ kỹ thuật`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, conversationId } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Missing messages' }, { status: 400 });
    }

    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === 'user'
    );

    if (lastUserMessage && conversationId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage.content),
      });

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);
    }

    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: gemini('gemini-2.0-flash'),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      onFinish: async ({ text }) => {
        if (conversationId && text) {
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: text,
          });

          await supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Loi he thong AI Chat' },
      { status: 500 }
    );
  }
}
