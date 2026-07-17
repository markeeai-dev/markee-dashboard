import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateRequest } from "@/lib/api-auth";
import crypto from "crypto";

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

export async function POST(req: Request) {
  try {
    let user: { id: string; email: string } | null = null;
    let supabaseClient: any = null;

    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const authResult = await authenticateRequest(req);
      user = authResult.user;
      supabaseClient = authResult.supabase;
    } else {
      // Đọc session token từ cookie
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/sb-[\w-]*auth-token(?:-code)?=([^;]+)/);
      let token = null;
      if (match) {
        try {
          const decoded = decodeURIComponent(match[1]);
          if (decoded.startsWith("[")) {
            const parsed = JSON.parse(decoded);
            token = parsed[0] || null;
          } else {
            token = decoded;
          }
        } catch (e) {
          console.error("Lỗi parse session cookie:", e);
        }
      }

      if (token) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseAnonKey) {
          const spClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
          });
          const { data: { user: authUser }, error } = await spClient.auth.getUser(token);
          if (!error && authUser) {
            user = { id: authUser.id, email: authUser.email! };
            supabaseClient = spClient;
          }
        }
      }
    }

    if (!user || !supabaseClient) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const { projectId } = payload;

    if (!projectId) {
      return NextResponse.json({ error: "Thiếu projectId" }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Kiểm tra dự án tồn tại
    const { data: project, error: fetchError } = await supabaseAdmin
      .from("projects")
      .select("id, created_by, share_token")
      .eq("id", projectId)
      .single();

    if (fetchError || !project) {
      return NextResponse.json({ error: "Không tìm thấy dự án" }, { status: 404 });
    }

    // 2. Kiểm tra quyền sở hữu (chỉ người tạo hoặc admin mới được chia sẻ)
    const { data: userDb } = await supabaseAdmin
      .from("users")
      .select("role")
      .eq("email", user.email)
      .maybeSingle();

    const isAdmin = userDb && ["admin", "super_admin"].includes(userDb.role);
    if (project.created_by !== user.email && !isAdmin) {
      return NextResponse.json({ error: "Bạn không có quyền chia sẻ dự án này" }, { status: 403 });
    }

    let share_token = project.share_token;

    // 3. Nếu chưa có share_token, tạo mới và lưu vào DB
    if (!share_token) {
      share_token = crypto.randomUUID();
      const { error: updateError } = await supabaseAdmin
        .from("projects")
        .update({ share_token })
        .eq("id", projectId);

      if (updateError) {
        console.error("Lỗi khi cập nhật share_token:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
    }

    const origin = new URL(req.url).origin;
    // Format link: /shared/project/[token]
    const shareUrl = `${origin}/shared/project/${share_token}`;

    return NextResponse.json({ shareUrl, share_token });
  } catch (error: any) {
    console.error("Lỗi POST /api/share/project:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
