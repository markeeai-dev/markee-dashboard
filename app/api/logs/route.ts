import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Admin Client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration env variables.");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// GET: Lấy lịch sử biến động số dư của một app cụ thể từ bảng balance_history kèm theo bộ lọc days
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get("app_id");
    const days = searchParams.get("days") || "all";

    if (!appId) {
      return NextResponse.json({ error: "Thiếu tham số app_id" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const parsedAppId = isNaN(Number(appId)) ? appId : Number(appId);

    // 1. Khởi tạo query truy vấn bảng balance_history
    let query = supabaseAdmin
      .from("balance_history")
      .select("*")
      .eq("app_id", parsedAppId)
      .order("synced_at", { ascending: false });

    // 2. Áp dụng bộ lọc thời gian
    if (days !== "all") {
      const now = new Date();
      if (days === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        query = query.gte("synced_at", startOfToday.toISOString());
      } else if (days === "7days") {
        const limitDate = new Date();
        limitDate.setDate(now.getDate() - 7);
        query = query.gte("synced_at", limitDate.toISOString());
      } else if (days === "30days") {
        const limitDate = new Date();
        limitDate.setDate(now.getDate() - 30);
        query = query.gte("synced_at", limitDate.toISOString());
      }
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error("Lỗi khi lấy log từ balance_history:", logsError);
      return NextResponse.json({ error: logsError.message }, { status: 500 });
    }

    return NextResponse.json(logs || []);
  } catch (error: any) {
    console.error("Lỗi GET /api/logs:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
