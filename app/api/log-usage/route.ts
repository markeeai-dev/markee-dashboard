import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "API deprecated: api_logs has been replaced by ShopAIKey billing balance balance_history." },
    { status: 410 }
  );
}
