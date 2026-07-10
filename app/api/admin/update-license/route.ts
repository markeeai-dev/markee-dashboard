import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);
    const body = await req.json();
    const { licenseId, updates } = body;

    if (!licenseId || !updates) {
      return NextResponse.json({ error: "Missing licenseId or updates" }, { status: 400 });
    }

    // 1. Kiểm tra xem user có phải admin/super_admin không
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .select("role")
      .eq("email", user.email)
      .single();

    const isAdminUser = !userErr && userData && ["admin", "super_admin"].includes(userData.role);

    // 2. Query thông tin license để lấy email chủ sở hữu
    const { data: licenseData, error: licenseQueryErr } = await supabase
      .from("ai_licenses")
      .select("email")
      .eq("id", licenseId)
      .single();

    if (licenseQueryErr || !licenseData) {
      return NextResponse.json({ error: "Không tìm thấy thông tin bản quyền" }, { status: 404 });
    }

    const isOwner = user.email === licenseData.email;

    // 3. Nếu không phải Admin/Super Admin và cũng không phải Owner -> Chặn 403
    if (!isAdminUser && !isOwner) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const allowedKeys = ["ai_tool", "plan_name", "monthly_cost", "expiration_date", "status"];
    const filteredUpdates: Record<string, unknown> = {};

    for (const key of allowedKeys) {
      if (key in updates) {
        filteredUpdates[key] = updates[key];
      }
    }

    if ("expiration_date" in filteredUpdates && filteredUpdates.expiration_date) {
      const expDate = new Date((filteredUpdates.expiration_date as string) + "T23:59:59");
      filteredUpdates.status = expDate >= new Date() ? "Active" : "Expired";
    }

    const { data, error } = await supabase
      .from("ai_licenses")
      .update(filteredUpdates)
      .eq("id", licenseId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "Lỗi cập nhật bản quyền" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("update-license error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
