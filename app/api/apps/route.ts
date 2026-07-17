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

// 1. GET: Lấy danh sách apps từ bảng apps
export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Lấy tất cả ứng dụng từ bảng apps
    const { data: appsData, error: appsError } = await supabaseAdmin
      .from("apps")
      .select("*")
      .order("created_at", { ascending: false });

    if (appsError) {
      console.error("Lỗi khi lấy danh sách apps:", appsError);
      return NextResponse.json({ error: appsError.message }, { status: 500 });
    }

    const appsWithStats = (appsData || []).map((app) => ({
      id: app.id,
      name: app.name,
      secret_key: app.secret_key || "",
      app_url: app.app_url || null,
      status: app.status || "active",
      total_granted: Number(app.total_granted || 0),
      total_used: Number(app.total_used || 0),
      balance: Number(app.balance || 0),
      created_at: app.created_at ? app.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    }));

    return NextResponse.json(appsWithStats);
  } catch (error: any) {
    console.error("Lỗi GET /api/apps:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// 2. POST: Tạo mới App (nhận secret_key thủ công từ client)
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { name, app_url, secret_key } = payload;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Tên ứng dụng là bắt buộc" }, { status: 400 });
    }

    if (!secret_key || !secret_key.trim()) {
      return NextResponse.json({ error: "Secret Key là bắt buộc" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: newApp, error: insertError } = await supabaseAdmin
      .from("apps")
      .insert({
        name: name.trim(),
        app_url: app_url ? app_url.trim() : null,
        secret_key: secret_key.trim(),
        total_granted: 0,
        total_used: 0,
        balance: 0,
        status: "active"
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Lỗi khi insert app:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    console.log("Đã tạo app mới:", newApp);

    return NextResponse.json({
      id: newApp.id,
      name: newApp.name,
      secret_key: newApp.secret_key,
      app_url: newApp.app_url,
      status: newApp.status,
      total_granted: 0,
      total_used: 0,
      balance: 0,
      created_at: newApp.created_at ? newApp.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    });
  } catch (error: any) {
    console.error("Lỗi POST /api/apps:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// 3. PUT: Sửa tên ứng dụng, link web, và secret_key (nếu có)
export async function PUT(request: Request) {
  try {
    const payload = await request.json();
    const { id, name, app_url, secret_key } = payload;

    if (!id || !name || !name.trim()) {
      return NextResponse.json({ error: "Thiếu id ứng dụng hoặc tên mới" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Chuẩn bị dữ liệu update
    const updateData: any = {
      name: name.trim(),
      app_url: app_url ? app_url.trim() : null,
    };

    // Chỉ cập nhật secret_key mới nếu admin có cung cấp (không bỏ trống)
    if (secret_key && secret_key.trim()) {
      updateData.secret_key = secret_key.trim();
    }

    const { data: updatedApp, error: updateError } = await supabaseAdmin
      .from("apps")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Lỗi khi cập nhật app:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: updatedApp.id,
      name: updatedApp.name,
      secret_key: updatedApp.secret_key,
      app_url: updatedApp.app_url,
      status: updatedApp.status,
      total_granted: Number(updatedApp.total_granted || 0),
      total_used: Number(updatedApp.total_used || 0),
      balance: Number(updatedApp.balance || 0),
      created_at: updatedApp.created_at ? updatedApp.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
    });
  } catch (error: any) {
    console.error("Lỗi PUT /api/apps:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// 4. DELETE: Xóa ứng dụng/API Key
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Thiếu id ứng dụng cần xóa" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const parsedId = isNaN(Number(id)) ? id : Number(id);

    // Xóa tất cả lịch sử biến động số dư liên quan trước khi xóa app để tránh lỗi foreign key constraint
    await supabaseAdmin
      .from("balance_history")
      .delete()
      .eq("app_id", parsedId);

    // Thực hiện xóa dòng trong bảng apps
    const { error: deleteError } = await supabaseAdmin
      .from("apps")
      .delete()
      .eq("id", parsedId);

    if (deleteError) {
      console.error("Lỗi khi xóa app:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Xóa API Key thành công" });
  } catch (error: any) {
    console.error("Lỗi DELETE /api/apps:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
