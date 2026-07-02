/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { authenticateRequest, AuthError } from "@/lib/api-auth";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { rawChat, thread_id } = body;

    if (!rawChat) return NextResponse.json({ error: "Missing chat data" }, { status: 400 });

    const systemPrompt = `Bạn là Chuyên gia Kỹ thuật Đúc kết Prompt.
Nhiệm vụ: Đọc hội thoại thô, trích xuất TẤT CẢ các kỹ năng (Skill/SOP) riêng biệt có trong đó.
QUY TẮC:
1. Trả về một MẢNG JSON (Array) chứa nhiều object. Nếu chỉ có 1 chủ đề, trả về mảng 1 phần tử.
2. Mỗi object phải tuân thủ cấu trúc sau:
{
  "title": "Tên kỹ năng",
  "main_category": "Phân loại vào: Dev, Marketing, Sales, Ops",
  "tags": ["Từ khóa 1", "Từ khóa 2", "Từ khóa 3"],
  "prompt_content": "Viết dưới dạng Prompt Template (VD: 'Hãy viết email cho [Khách hàng]...')"
}`;

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Server misconfiguration: missing GEMINI_API_KEY" }, { status: 500 });
    }

    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: rawChat }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    const geminiData = await geminiResponse.json();

    let extractedSkills = [];
    try {
      const rawOutput = geminiData.candidates[0].content.parts[0].text;
      const cleanJsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
      extractedSkills = JSON.parse(cleanJsonStr);

      if (extractedSkills.extracted_skills) {
        extractedSkills = extractedSkills.extracted_skills;
      } else if (!Array.isArray(extractedSkills)) {
        extractedSkills = [extractedSkills];
      }
    } catch (parseError) {
      console.error("Lỗi Parse JSON từ Gemini:", parseError);
      return NextResponse.json({ error: "AI trả về định dạng sai" }, { status: 500 });
    }

    const insertPayload = extractedSkills.map((skill: any) => ({
      title: skill.title || "Untitled Skill",
      category: skill.main_category || "Uncategorized",
      tags: skill.tags || [],
      prompt_content: skill.prompt_content || "",
      author_id: user.email,
      status: "pending",
      source_thread_id: thread_id,
    }));

    const { error: insertError } = await supabase.from("skill_library").insert(insertPayload);

    if (insertError) {
      console.error("Lỗi Insert Supabase:", insertError);
      return NextResponse.json({ error: "Lỗi lưu Database" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Đã trích xuất thành công ${extractedSkills.length} skills`,
      skills_added: extractedSkills.length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Lỗi hệ thống API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
