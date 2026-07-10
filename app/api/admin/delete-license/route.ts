import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);

    const { licenseId } = await req.json();
    if (!licenseId) {
      return NextResponse.json({ error: "Missing licenseId" }, { status: 400 });
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

    const { error } = await supabase
      .from("ai_licenses")
      .delete()
      .eq("id", licenseId);

    if (error) {
      return NextResponse.json({ error: "Lỗi xóa bản quyền" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("delete-license error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
