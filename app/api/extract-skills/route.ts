/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rawChat, author_id, thread_id } = body;

    if (!rawChat) return NextResponse.json({ error: "Missing chat data" }, { status: 400 });

    // 1. CÂU LỆNH HƯỚNG DẪN GEMINI TRẢ VỀ "MẢNG" (MULTIPLE SKILLS)
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

    // 2. GỌI GEMINI API
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: rawChat }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json", // Ép Gemini trả về JSON chuẩn
        },
      }),
    });

    const geminiData = await geminiResponse.json();

    // 3. XỬ LÝ DỮ LIỆU GEMINI TRẢ VỀ (CHỐNG LỖI)
    let extractedSkills = [];
    try {
      const rawOutput = geminiData.candidates[0].content.parts[0].text;
      // Dọn dẹp markdown rác nếu Gemini lỡ trả về (```json ... ```)
      const cleanJsonStr = rawOutput.replace(/```json\n?|\n?```/g, "").trim();
      extractedSkills = JSON.parse(cleanJsonStr);

      // Nếu nó không trả về mảng mà trả về object bọc ngoài, tự bóc tách
      if (extractedSkills.extracted_skills) {
        extractedSkills = extractedSkills.extracted_skills;
      } else if (!Array.isArray(extractedSkills)) {
        extractedSkills = [extractedSkills];
      }
    } catch (parseError) {
      console.error("Lỗi Parse JSON từ Gemini:", parseError);
      return NextResponse.json({ error: "AI trả về định dạng sai" }, { status: 500 });
    }

    // 4. CHUẨN BỊ PAYLOAD VÀ BULK INSERT VÀO SUPABASE
    const insertPayload = extractedSkills.map((skill: any) => ({
      title: skill.title || "Untitled Skill",
      category: skill.main_category || "Uncategorized",
      tags: skill.tags || [],
      prompt_content: skill.prompt_content || "",
      author_id: author_id,
      status: "pending", // Đợi duyệt trên Dashboard
      source_thread_id: thread_id, // Lưu lại ID gốc để đối chiếu
    }));

    const { error: insertError } = await supabase.from("skill_library").insert(insertPayload); // Insert cả mảng cùng lúc

    if (insertError) {
      console.error("Lỗi Insert Supabase:", insertError);
      return NextResponse.json({ error: "Lỗi lưu Database" }, { status: 500 });
    }

    // 5. TRẢ VỀ THÀNH CÔNG CHO EXTENSION
    return NextResponse.json({
      success: true,
      message: `Đã trích xuất thành công ${extractedSkills.length} skills`,
      skills_added: extractedSkills.length,
    });
  } catch (error) {
    console.error("Lỗi hệ thống API:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
