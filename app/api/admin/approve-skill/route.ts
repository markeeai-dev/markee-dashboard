import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);
    await requireAdmin(supabase, user.email);

    const { skillId } = await req.json();
    if (!skillId) {
      return NextResponse.json({ error: "Missing skillId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("skill_library")
      .update({ status: "approved" })
      .eq("id", skillId)
      .select("id, status")
      .single();

    if (error) {
      return NextResponse.json({ error: "Lỗi duyệt skill" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("approve-skill error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
