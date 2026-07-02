import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface AuthResult {
  user: { id: string; email: string };
  supabase: SupabaseClient;
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header", 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new AuthError("Empty bearer token", 401);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AuthError("Server misconfiguration: missing Supabase env vars", 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new AuthError("Invalid or expired token", 401);
  }

  return { user: { id: user.id, email: user.email! }, supabase };
}

export async function requireAdmin(supabase: SupabaseClient, email: string): Promise<void> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", email)
    .single();

  if (error || !data || data.role !== "admin") {
    throw new AuthError("Admin access required", 403);
  }
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}
