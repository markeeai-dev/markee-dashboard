import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "admin" | "user";
export type SkillStatus = "pending" | "approved" | "rejected";

export interface AppUser {
  id: number;
  email: string;
  full_name: string | null;
  team?: string | null;
  avatar_color?: string | null;
  role: UserRole | null;
}

export interface UserProfile {
  authUser: User;
  email: string;
  displayName: string;
  role: UserRole;
  dbUser: AppUser | null;
}

export interface SkillLibraryRow {
  id: number;
  created_at: string;
  title: string;
  markdown_content: string;
  category: string | null;
  author_id: string;
  status: SkillStatus;
  skill_type?: string | null;
  likes_count: number | null;
  downloads_count: number | null;
}

export interface SkillCard extends SkillLibraryRow {
  authorName: string;
  score: number;
  likedByCurrentUser?: boolean;
}

export interface PaginatedSkills {
  items: SkillCard[];
  total: number;
  hasMore: boolean;
  nextPage: number;
}

export type AnalyticsPeriod = "7d" | "30d" | "all";

export interface DailyTokenPoint {
  date: string;
  tokens: number;
}

export interface ToolUsagePoint {
  name: string;
  value: number;
}

export interface ContributorPoint {
  email: string;
  name: string;
  count: number;
}

export interface AdminOverviewMetrics {
  totalTokens: number;
  costUsd: number;
  totalSessions: number;
  dailyTokens: DailyTokenPoint[];
  toolUsage: ToolUsagePoint[];
  contributors: ContributorPoint[];
}

const DEFAULT_PAGE_SIZE = 12;

function getEmailName(email: string) {
  return email.split("@")[0] || email;
}

function getGoogleName(user: User) {
  const metadata = user.user_metadata || {};
  return metadata.full_name || metadata.name || metadata.preferred_username || (user.email ? getEmailName(user.email) : "User");
}

function normalizeSkill(row: SkillLibraryRow, authorMap: Map<string, string>, likedSkillIds = new Set<number>()): SkillCard {
  const likes = row.likes_count ?? 0;
  const downloads = row.downloads_count ?? 0;

  return {
    ...row,
    likes_count: likes,
    downloads_count: downloads,
    authorName: authorMap.get(row.author_id) || getEmailName(row.author_id),
    score: likes + downloads,
    likedByCurrentUser: likedSkillIds.has(row.id),
  };
}

async function getLikedSkillIds(userEmail: string | undefined, skillIds: number[]) {
  const likedSkillIds = new Set<number>();

  if (!userEmail || skillIds.length === 0) return likedSkillIds;

  const { data, error } = await supabase.from("user_likes").select("skill_id").eq("user_email", userEmail).in("skill_id", skillIds);

  if (error) {
    console.error("Error fetching liked skills:", error);
    return likedSkillIds;
  }

  data?.forEach((row) => {
    if (typeof row.skill_id === "number") likedSkillIds.add(row.skill_id);
  });

  return likedSkillIds;
}

async function getAuthorNameMap(authorEmails: string[]) {
  const emails = Array.from(new Set(authorEmails.filter(Boolean)));
  const authorMap = new Map<string, string>();

  if (emails.length === 0) return authorMap;

  const { data, error } = await supabase.from("users").select("email, full_name").in("email", emails);

  if (error) {
    console.error("Error fetching skill authors:", error);
    return authorMap;
  }

  data?.forEach((user) => {
    if (user.email && user.full_name) {
      authorMap.set(user.email, user.full_name);
    }
  });

  return authorMap;
}

export async function signInWithGoogle() {
  const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !user.email) {
    if (authError) {
      if (authError.name !== "AuthSessionMissingError" && !authError.message.includes("Auth session missing")) {
        console.error("Error fetching auth user:", authError);
      }
    }
    return null;
  }

  const { data: dbUser, error: profileError } = await supabase.from("users").select("id, email, full_name, team, avatar_color, role").eq("email", user.email).maybeSingle();

  if (profileError) {
    console.error("Error fetching app user profile:", profileError);
  }

  const fullName = dbUser?.full_name || getGoogleName(user);

  return {
    authUser: user,
    email: user.email,
    displayName: fullName,
    role: dbUser?.role === "admin" ? "admin" : "user",
    dbUser: dbUser || null,
  };
}

export async function fetchApprovedSkills(page = 0, pageSize = DEFAULT_PAGE_SIZE, userEmail?: string, searchTerm = ""): Promise<PaginatedSkills> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count", { count: "exact" }).eq("status", "approved");

  const normalizedSearch = searchTerm.trim();

  if (normalizedSearch) {
    query = query.or(`title.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%,author_id.ilike.%${normalizedSearch}%`);
  }

  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching approved skills:", error);
    return { items: [], total: 0, hasMore: false, nextPage: page };
  }

  const rows = (data || []) as SkillLibraryRow[];
  const authorMap = await getAuthorNameMap(rows.map((skill) => skill.author_id));
  const likedSkillIds = await getLikedSkillIds(
    userEmail,
    rows.map((skill) => skill.id),
  );
  const total = count || 0;

  return {
    items: rows.map((row) => normalizeSkill(row, authorMap, likedSkillIds)),
    total,
    hasMore: to + 1 < total,
    nextPage: page + 1,
  };
}

export async function fetchTrendingSkills(limit = 5, userEmail?: string): Promise<SkillCard[]> {
  const { data, error } = await supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count").eq("status", "approved").order("likes_count", { ascending: false, nullsFirst: false }).limit(100);

  if (error) {
    console.error("Error fetching trending skills:", error);
    return [];
  }

  const rows = (data || []) as SkillLibraryRow[];
  const authorMap = await getAuthorNameMap(rows.map((skill) => skill.author_id));
  const likedSkillIds = await getLikedSkillIds(
    userEmail,
    rows.map((skill) => skill.id),
  );

  return rows
    .map((row) => normalizeSkill(row, authorMap, likedSkillIds))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function fetchMyWorkspaceSkills(email: string): Promise<SkillCard[]> {
  const { data, error } = await supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count").eq("author_id", email).order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching workspace skills:", error);
    return [];
  }

  const rows = (data || []) as SkillLibraryRow[];
  const authorMap = await getAuthorNameMap(rows.map((skill) => skill.author_id));
  const likedSkillIds = await getLikedSkillIds(
    email,
    rows.map((skill) => skill.id),
  );
  return rows.map((row) => normalizeSkill(row, authorMap, likedSkillIds));
}

export async function toggleSkillVote(skillId: number, userEmail: string) {
  const { data: existingLike, error: existingError } = await supabase.from("user_likes").select("id").eq("user_email", userEmail).eq("skill_id", skillId).maybeSingle();

  if (existingError) throw existingError;

  if (existingLike) {
    const { error: deleteError } = await supabase.from("user_likes").delete().eq("id", existingLike.id);
    if (deleteError) throw deleteError;

    const { error: decrementError } = await supabase.rpc("decrement_like", { skill_id_param: skillId });
    if (decrementError) throw decrementError;

    return { id: skillId, liked: false };
  }

  const { error: insertError } = await supabase.from("user_likes").insert({
    user_email: userEmail,
    skill_id: skillId,
  });

  if (insertError) throw insertError;

  const { error: incrementError } = await supabase.rpc("increment_like", { skill_id: skillId });
  if (incrementError) throw incrementError;

  return { id: skillId, liked: true };
}

export async function recordSkillDownload(skillId: number) {
  const { error } = await supabase.rpc("increment_download", { skill_id: skillId });
  if (error) throw error;
  return { id: skillId };
}

export async function downloadSkillMarkdown(skill: SkillCard) {
  const blob = new Blob([skill.markdown_content || ""], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeTitle = skill.title.replace(/[\\/:*?"<>|]/g, "-").trim() || `skill-${skill.id}`;

  link.href = url;
  link.download = `${safeTitle}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return recordSkillDownload(skill.id);
}

export async function fetchPendingSkills(): Promise<SkillCard[]> {
  const { data, error } = await supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count").eq("status", "pending").order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending skills:", error);
    return [];
  }

  const rows = (data || []) as SkillLibraryRow[];
  const authorMap = await getAuthorNameMap(rows.map((skill) => skill.author_id));
  return rows.map((row) => normalizeSkill(row, authorMap));
}

export async function updateSkillStatus(skillId: number, status: Extract<SkillStatus, "approved" | "rejected">) {
  const { data, error } = await supabase.from("skill_library").update({ status }).eq("id", skillId).select("id, status").single();

  if (error) throw error;
  return data;
}

export async function approveSkill(skillId: number) {
  return updateSkillStatus(skillId, "approved");
}

export async function rejectSkill(skillId: number) {
  return updateSkillStatus(skillId, "rejected");
}

export async function fetchTeamTokenKpi() {
  const { data, error } = await supabase.from("ai_sessions").select("tokens_used");

  if (error) {
    console.error("Error fetching team token KPI:", error);
    return { totalTokens: 0, costUsd: 0 };
  }

  const totalTokens = (data || []).reduce((sum, session) => sum + (session.tokens_used || 0), 0);

  return {
    totalTokens,
    costUsd: totalTokens * 0.015,
  };
}

function getPeriodStart(period: AnalyticsPeriod) {
  if (period === "all") return null;

  const date = new Date();
  date.setDate(date.getDate() - (period === "7d" ? 6 : 29));
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

export async function fetchAdminOverviewMetrics(period: AnalyticsPeriod): Promise<AdminOverviewMetrics> {
  const periodStart = getPeriodStart(period);

  let sessionQuery = supabase.from("ai_sessions").select("created_at, ai_tool, tokens_used, author_id").order("created_at", { ascending: true });

  if (periodStart) {
    sessionQuery = sessionQuery.gte("created_at", periodStart);
  }

  const [sessionResult, contributorResult] = await Promise.all([sessionQuery, supabase.from("skill_library").select("author_id").eq("status", "approved")]);

  if (sessionResult.error) {
    console.error("Error fetching admin sessions:", sessionResult.error);
  }

  if (contributorResult.error) {
    console.error("Error fetching contributors:", contributorResult.error);
  }

  const sessions = sessionResult.data || [];
  const approvedSkills = contributorResult.data || [];
  const dailyMap = new Map<string, number>();
  const toolMap = new Map<string, number>();
  const contributorMap = new Map<string, number>();

  sessions.forEach((session) => {
    const tokens = session.tokens_used || 0;
    const dayKey = new Date(session.created_at).toISOString().slice(0, 10);
    const tool = session.ai_tool || "Khác";

    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + tokens);
    toolMap.set(tool, (toolMap.get(tool) || 0) + tokens);
  });

  approvedSkills.forEach((skill) => {
    const email = skill.author_id || "unknown";
    contributorMap.set(email, (contributorMap.get(email) || 0) + 1);
  });

  const contributorEmails = Array.from(contributorMap.keys());
  const authorMap = await getAuthorNameMap(contributorEmails);
  const totalTokens = sessions.reduce((sum, session) => sum + (session.tokens_used || 0), 0);

  return {
    totalTokens,
    costUsd: totalTokens * 0.015,
    totalSessions: sessions.length,
    dailyTokens: Array.from(dailyMap.entries()).map(([date, tokens]) => ({
      date: formatChartDate(date),
      tokens,
    })),
    toolUsage: Array.from(toolMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    contributors: Array.from(contributorMap.entries())
      .map(([email, count]) => ({
        email,
        name: authorMap.get(email) || getEmailName(email),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
