import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

function getModelInstance(modelName: string) {
  const name = modelName.toLowerCase();

  // 1. Nhóm Gemini
  if (name.includes("gemini") || name.includes("google")) {
    const apiKey = process.env.GEMINI_API_KEY;
    const google = createGoogleGenerativeAI({ apiKey });
    const actualModel = modelName.startsWith("google/") ? modelName.replace("google/", "") : modelName;
    return google(actualModel);
  }

  // 2. Model Auto (OpenRouter)
  if (name.includes("auto") || name.includes("free") || name.includes("openrouter")) {
    const apiKey = process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
    const openrouter = createOpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
    return openrouter(modelName);
  }

  // 3. Nhóm GPT & Claude (ShopAIKey)
  const apiKey = process.env.NEXT_PUBLIC_SHOPAIKEY_API_KEY || process.env.SHOPAIKEY_API_KEY || process.env.OPENAI_API_KEY;
  const shopaikey = createOpenAI({
    apiKey,
    baseURL: "https://api.shopaikey.com/v1",
  });
  return shopaikey(modelName);
}

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { projectId, featureName, wipLogsContent, model: requestedModel } = body;
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase.from("projects").select("id, created_by").eq("id", projectId).single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Dự án không tồn tại" }, { status: 404 });
    }

    let hasAccess = project.created_by === user.email;

    if (!hasAccess) {
      const { data: wipCount } = await supabase.from("skill_library").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("author_id", user.email).eq("skill_type", "wip");

      hasAccess = (wipCount?.length ?? 0) > 0;
    }

    if (!hasAccess) {
      try {
        await requireAdmin(supabase, user.email);
        hasAccess = true;
      } catch {
        // not admin, no access
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Bạn không có quyền truy cập dự án này" }, { status: 403 });
    }

    let combinedContent = "";
    if (Array.isArray(wipLogsContent) && wipLogsContent.length > 0) {
      combinedContent = wipLogsContent.join("\n\n---\n\n");
    } else if (typeof wipLogsContent === "string" && wipLogsContent.trim().length > 0) {
      combinedContent = wipLogsContent;
    } else {
      const { data: wipSkills, error: fetchError } = await supabase.from("skill_library").select("title, markdown_content, author_id, session_tokens").eq("project_id", projectId).eq("skill_type", "wip");

      if (fetchError) {
        console.error("Error fetching WIP skills:", fetchError);
        return NextResponse.json({ error: "Lỗi cơ sở dữ liệu khi tải WIP" }, { status: 500 });
      }

      if (!wipSkills || wipSkills.length === 0) {
        return NextResponse.json({ error: "Không tìm thấy bản tóm tắt công việc (WIP) nào để tổng hợp." }, { status: 404 });
      }

      combinedContent = wipSkills.map((s) => `### Tiêu đề: ${s.title}\n\n${s.markdown_content || ""}`).join("\n\n---\n\n");
    }

    const systemPrompt = `Bạn là một Chuyên gia Tổng hợp Tri thức Dự án. Đọc các nhật ký làm việc (WIP logs) và tổng hợp thành một tài liệu duy nhất.
YÊU CẦU:
1. CHỈ xuất ra Markdown theo đúng định dạng mẫu.
2. KHÔNG thêm lời chào, giải thích, token, hay metadata.
3. Gộp thông tin trùng lặp, giữ lại mục tiêu và quyết định.

ĐỊNH DẠNG MẪU:

**Mục đích:** Đây là bản tri thức duy nhất để dev, product và các team liên quan có thể hiểu nhanh phạm vi, quyết định thiết kế và bước tiếp theo mà không cần đọc lại toàn bộ log chat.

### 1. Mục tiêu sản phẩm
- [Liệt kê các mục tiêu chính từ logs]
- [Kết nối ngắn gọn các luồng làm việc]

### 2. Quyết định UX/UI đã chốt
- [Các quyết định về thiết kế, tính năng đã được thống nhất]
- [Cấu trúc hoặc thay đổi quan trọng]

### 3. Việc cần làm tiếp theo (Next Steps)
- [Các hành động cụ thể cần thực hiện tiếp theo]
- [Các vấn đề còn tồn đọng cần giải quyết]`;

    const modelName = requestedModel || "google/gemini-3.5-flash";
    let text = "";
    try {
      const modelInstance = getModelInstance(modelName);
      const aiResponse = await generateText({
        model: modelInstance as any,
        system: systemPrompt,
        prompt: combinedContent,
        temperature: 0.2,
      });
      text = aiResponse.text;
    } catch (aiError: any) {
      console.error("AI Generation Error in summarize-project:", aiError);
      return NextResponse.json({ error: `Lỗi gọi API AI (${modelName}): ${aiError.message || aiError}` }, { status: 502 });
    }

    const defaultTitle = featureName ? `Tri thức tính năng: ${featureName}` : "Tổng hợp tri thức dự án";

    return NextResponse.json({
      success: true,
      title: defaultTitle,
      markdown: text,
      content: text,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Internal Server Error in summarize-project:", error);
    return NextResponse.json({ error: "Lỗi hệ thống nội bộ" }, { status: 500 });
  }
}
