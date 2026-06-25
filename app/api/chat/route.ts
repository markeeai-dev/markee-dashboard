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

const SYSTEM_PROMPT = `Ban la Markee AI Assistant - tro ly AI chuyen nghiep cua Markee AI Ops Center.

Vai tro cua ban:
1. Tro giup nguoi dung tao prompt chat luong cao cho cac tac vu Marketing, Sales, Dev, Ops
2. Goi y cai thien quy trinh lam viec voi AI
3. Tra loi nhanh, chinh xac, bang tieng Viet
4. Khi duoc inject asset tu Library, su dung kien thuc do de dua ra cau tra loi chinh xac nhat

Dinh dang:
- Tra loi ngan gon, co cau truc ro rang
- Dung markdown de dinh dang (tieu de, danh sach, in dam)
- Luon uu tien tieng Viet, chi dung tieng Anh cho thuat ngu ky thuat`;

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
