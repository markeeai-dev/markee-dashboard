import { NextResponse } from "next/server";
import { authenticateRequest, requireAdmin, AuthError } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const { user, supabase } = await authenticateRequest(req);
    await requireAdmin(supabase, user.email);

    const body = await req.json();
    const { licenseId, updates } = body;

    if (!licenseId || !updates) {
      return NextResponse.json({ error: "Missing licenseId or updates" }, { status: 400 });
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
