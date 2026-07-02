import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { authenticateRequest, AuthError } from '@/lib/api-auth';

const openai = createOpenAI({
  apiKey: process.env.SHOPAIKEY_API_KEY,
  baseURL: process.env.SHOPAIKEY_BASE_URL,
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
    const { user, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { messages, conversationId, sessionId, model: requestedModel } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Missing messages' }, { status: 400 });
    }

    if (sessionId) {
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', user.email)
        .single();

      if (error || !session) {
        return Response.json({ error: 'Session not found or access denied' }, { status: 403 });
      }
    } else if (conversationId) {
      const { data: conversation, error } = await supabase
        .from('conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('user_id', user.email)
        .single();

      if (error || !conversation) {
        return Response.json({ error: 'Conversation not found or access denied' }, { status: 403 });
      }
    }

    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === 'user'
    );
    const userContent = lastUserMessage
      ? typeof lastUserMessage.content === 'string'
        ? lastUserMessage.content
        : JSON.stringify(lastUserMessage.content)
      : '';

    if (userContent) {
      if (sessionId) {
        await supabase.from('chat_messages').insert({
          session_id: sessionId,
          role: 'user',
          content: userContent,
        });
      } else if (conversationId) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'user',
          content: userContent,
        });
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
    }

    const modelName = requestedModel || 'gpt-4o';

    const result = streamText({
      model: openai(modelName),
      system: SYSTEM_PROMPT,
      messages,
      onFinish: async ({ text }) => {
        if (!text) return;

        if (sessionId) {
          await supabase.from('chat_messages').insert({
            session_id: sessionId,
            role: 'assistant',
            content: text,
          });
        } else if (conversationId) {
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
    if (error instanceof AuthError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error('Chat API error:', error);
    return Response.json(
      { error: 'Lỗi hệ thống AI Chat' },
      { status: 500 }
    );
  }
}
