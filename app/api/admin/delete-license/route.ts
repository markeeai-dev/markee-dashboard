import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);
    await requireAdmin(supabase, user.email);

    const { licenseId } = await req.json();
    if (!licenseId) {
      return NextResponse.json({ error: "Missing licenseId" }, { status: 400 });
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
