import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { redirect, notFound } from "next/navigation";
import SharedProjectClient from "./SharedProjectClient";

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

async function getSessionUser() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const authCookie = allCookies.find(c => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
  if (!authCookie) return null;

  try {
    const decoded = decodeURIComponent(authCookie.value);
    let token = null;
    if (decoded.startsWith("[")) {
      const parsed = JSON.parse(decoded);
      token = parsed[0] || null;
    } else {
      token = decoded;
    }

    if (token) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const spClient = createClient(supabaseUrl!, supabaseAnonKey!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await spClient.auth.getUser(token);
      if (!error && user) {
        return user;
      }
    }
  } catch (e) {
    console.error("Lỗi xác thực session ở Server Component:", e);
  }
  return null;
}

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedProjectPage({ params }: PageProps) {
  const { token } = await params;

  // 1. Kiểm tra session user ở Server-side (nếu có cookie auth)
  const user = await getSessionUser();

  const supabaseAdmin = getSupabaseAdmin();

  // 2. Fetch dự án bằng Service Role Key
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("id, name, created_at, created_by, master_summary, last_summarized_at")
    .eq("share_token", token)
    .single();

  if (projectError || !project) {
    notFound();
  }

  // 3. Nếu Server-side phát hiện đã đăng nhập -> redirect thẳng về Dashboard
  if (user) {
    redirect(`/?tab=projects&open_modal_id=${project.id}`);
  }

  // 4. Render Client Component để xử lý check session trên client (cho các trường hợp lưu session ở localStorage) và render UI
  return (
    <SharedProjectClient
      project={{
        id: project.id,
        name: project.name,
        created_at: project.created_at,
        created_by: project.created_by,
        master_summary: project.master_summary,
        last_summarized_at: project.last_summarized_at
      }}
    />
  );
}
