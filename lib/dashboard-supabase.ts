import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ALL_TRACK_DB_VALUES } from "./org-structure";

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
  team_track?: string | null;
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

const DEFAULT_PAGE_SIZE = 8;

export const COST_PER_THOUSAND_TOKENS = 0.015;

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

export function removeVietnameseTones(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export async function fetchApprovedSkills(page = 0, pageSize = DEFAULT_PAGE_SIZE, userEmail?: string, searchTerm = "", teamTrack = "", skillType = ""): Promise<PaginatedSkills> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count, team_track", { count: "exact" }).eq("status", "approved").not("skill_type", "ilike", "wip");

  if (skillType && skillType !== "Tất cả") {
    const dbType = skillType.toLowerCase();
    if (dbType === "context pack") {
      query = query.or("skill_type.ilike.context pack,skill_type.ilike.context_pack");
    } else {
      query = query.ilike("skill_type", dbType);
    }
  }

  if (teamTrack && teamTrack !== "Tất cả") {
    if (teamTrack === "Khác") {
      query = query.or(`team_track.is.null,team_track.eq.,team_track.not.in.(${ALL_TRACK_DB_VALUES.map((t) => `"` + t + `"`).join(",")})`);
    } else {
      query = query.eq("team_track", teamTrack);
    }
  }

  const normalizedSearch = searchTerm.trim();

  // If there's no search term, use fast server-side range query
  if (!normalizedSearch) {
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

  // If there is a search term, retrieve matching candidates (bounded) to filter in memory diacritics-insensitively
  const { data, error } = await query.order("created_at", { ascending: false }).limit(500);

  if (error) {
    console.error("Error fetching approved skills for search:", error);
    return { items: [], total: 0, hasMore: false, nextPage: page };
  }

  const rows = (data || []) as SkillLibraryRow[];
  const authorMap = await getAuthorNameMap(rows.map((skill) => skill.author_id));
  const likedSkillIds = await getLikedSkillIds(
    userEmail,
    rows.map((skill) => skill.id),
  );

  const normalizedItems = rows.map((row) => normalizeSkill(row, authorMap, likedSkillIds));
  const cleanSearch = removeVietnameseTones(normalizedSearch);

  const filteredItems = normalizedItems.filter((item) => {
    const cleanTitle = removeVietnameseTones(item.title);
    const cleanCategory = removeVietnameseTones(item.category);
    const cleanAuthor = removeVietnameseTones(item.authorName);
    return cleanTitle.includes(cleanSearch) || cleanCategory.includes(cleanSearch) || cleanAuthor.includes(cleanSearch);
  });

  const slicedItems = filteredItems.slice(from, to + 1);
  const total = filteredItems.length;

  return {
    items: slicedItems,
    total,
    hasMore: to + 1 < total,
    nextPage: page + 1,
  };
}

export async function fetchTrendingSkills(limit = 5, userEmail?: string): Promise<SkillCard[]> {
  const { data, error } = await supabase
    .from("skill_library")
    .select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count")
    .eq("status", "approved")
    .eq("skill_type", "workflow")
    .order("likes_count", { ascending: false, nullsFirst: false })
    .limit(100);

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

export async function fetchTeamTracks(): Promise<string[]> {
  const { data, error } = await supabase.from("skill_library").select("team_track").eq("status", "approved").eq("skill_type", "workflow");

  if (error) {
    console.error("Error fetching team tracks:", error);
    return [];
  }

  const tracks = Array.from(new Set(data?.map((d) => d.team_track).filter(Boolean)));
  return tracks.sort();
}

export async function fetchMyWorkspaceSkills(email: string): Promise<SkillCard[]> {
  const { data, error } = await supabase.from("skill_library").select("id, created_at, title, markdown_content, category, author_id, status, skill_type, likes_count, downloads_count, team_track").eq("author_id", email).not("skill_type", "ilike", "wip").order("created_at", { ascending: false });

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

export interface LibraryCounts {
  byType: Record<string, number>;
  byTrack: Record<string, number>;
  total: number;
}

export async function fetchLibraryCounts(userEmail?: string): Promise<LibraryCounts> {
  let query = supabase.from("skill_library").select("skill_type, team_track").eq("status", "approved").not("skill_type", "ilike", "wip");

  if (userEmail) {
    query = query.eq("author_id", userEmail);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching library counts:", error);
    return { byType: {}, byTrack: {}, total: 0 };
  }

  const byType: Record<string, number> = {};
  const byTrack: Record<string, number> = {};
  let total = 0;

  const knownTracks = ALL_TRACK_DB_VALUES;
  let trackSum = 0;

  (data || []).forEach((row) => {
    total++;

    // Normalize skill_type
    const rawType = row.skill_type || "";
    let typeKey = rawType.toLowerCase();
    if (typeKey === "context_pack" || typeKey === "context pack") typeKey = "context pack"; // Keep UI key
    if (typeKey) {
      byType[typeKey] = (byType[typeKey] || 0) + 1;
    }

    // Normalize team_track
    const track = (row.team_track || "").trim();
    if (track && knownTracks.includes(track)) {
      byTrack[track] = (byTrack[track] || 0) + 1;
      trackSum += 1;
    }
  });

  byTrack["Khác"] = total - trackSum;

  return { byType, byTrack, total };
}

export async function toggleSkillVote(skillId: number, userEmail: string) {
  const { data, error } = await supabase.rpc("toggle_like", {
    p_skill_id: skillId,
    p_user_email: userEmail,
  });

  if (error) throw error;
  return data as { id: number; liked: boolean };
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
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/approve-skill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ skillId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lỗi duyệt skill" }));
    throw new Error(err.error || "Lỗi duyệt skill");
  }
  const result = await res.json();
  return result.data;
}

export async function rejectSkill(skillId: number) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/reject-skill", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ skillId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lỗi từ chối skill" }));
    throw new Error(err.error || "Lỗi từ chối skill");
  }
  const result = await res.json();
  return result.data;
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
    costUsd: (totalTokens / 1000) * COST_PER_THOUSAND_TOKENS,
  };
}

function getPeriodStart(period: AnalyticsPeriod) {
  if (period === "all") return null;

  const now = new Date();
  const vnNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  vnNow.setDate(vnNow.getDate() - (period === "7d" ? 6 : 29));
  vnNow.setHours(0, 0, 0, 0);
  return vnNow.toISOString();
}

function formatChartDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value + "T00:00:00"));
}

function formatToolName(name: string): string {
  const lower = name.toLowerCase().trim();
  if (lower === "chatgpt") return "ChatGPT";
  if (lower === "claude") return "Claude";
  if (lower === "gemini") return "Gemini";
  return lower.charAt(0).toUpperCase() + lower.slice(1);
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
    const toolRaw = session.ai_tool || "Khác";
    const tool = toolRaw.toLowerCase().trim();

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
      .map(([name, value]) => ({ name: formatToolName(name), value }))
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

export interface Project {
  id: number;
  created_at: string;
  created_by: string;
  name: string;
  logCount?: number;
  authorName?: string;
  members?: { email: string; name: string; avatarColor: string }[];
  master_summary?: string | null;
  last_summarized_at?: string | null;
  lastWipCreatedAt?: string | null;
}

export interface AISession {
  id: number;
  created_at: string;
  ai_tool: string | null;
  task_type: string | null;
  prompt_content: string | null;
  tokens_used: number | null;
  author_id: string;
  authorName?: string;
  avatarColor?: string;
  project_id: number | null;
  tier: string | null;
  title?: string;
  team_track?: string | null;
}

export async function fetchAllUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from("users").select("*").order("email", { ascending: true });
  if (error) {
    console.error("Error fetching all users:", error);
    return [];
  }
  return data || [];
}

export async function updateUserRole(userId: number, role: UserRole) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/update-user-role", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ userId, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lỗi cập nhật quyền" }));
    throw new Error(err.error || "Lỗi cập nhật quyền");
  }
}

export async function fetchProjects(userEmail?: string, isAdmin = false): Promise<Project[]> {
  const projectsQuery = supabase.from("projects").select("*").order("created_at", { ascending: false });

  if (!isAdmin && userEmail) {
    const { data: userProjectIds } = await supabase
      .from("skill_library")
      .select("project_id")
      .eq("author_id", userEmail)
      .eq("skill_type", "wip");

    const memberProjectIds = new Set((userProjectIds || []).map((p) => p.project_id).filter(Boolean));

    const { data: allProjects, error: projectsError } = await projectsQuery;
    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return [];
    }

    const filteredProjects = (allProjects || []).filter(
      (p) => p.created_by === userEmail || memberProjectIds.has(p.id)
    );

    return await enrichProjectData(filteredProjects);
  }

  const { data: projectsData, error: projectsError } = await projectsQuery;
  if (projectsError) {
    console.error("Error fetching projects:", projectsError);
    return [];
  }

  return await enrichProjectData(projectsData || []);
}

async function enrichProjectData(projectsData: Record<string, unknown>[]): Promise<Project[]> {

  const { data: wips, error: wipsError } = await supabase.from("skill_library").select("project_id, author_id, created_at").eq("skill_type", "wip");

  const projectCounts = new Map<number, number>();
  const projectMemberEmails = new Map<number, Set<string>>();
  const projectLastWip = new Map<number, string>();
  const allMemberEmails = new Set<string>();

  if (!wipsError && wips) {
    wips.forEach((s) => {
      if (s.project_id) {
        projectCounts.set(s.project_id, (projectCounts.get(s.project_id) || 0) + 1);

        if (s.author_id) {
          if (!projectMemberEmails.has(s.project_id)) {
            projectMemberEmails.set(s.project_id, new Set());
          }
          projectMemberEmails.get(s.project_id)!.add(s.author_id);
          allMemberEmails.add(s.author_id);
        }

        if (s.created_at) {
          const currentLatest = projectLastWip.get(s.project_id);
          if (!currentLatest || new Date(s.created_at) > new Date(currentLatest)) {
            projectLastWip.set(s.project_id, s.created_at);
          }
        }
      }
    });
  }

  projectsData.forEach((p) => {
    if (p.created_by) {
      allMemberEmails.add(p.created_by as string);
    }
  });

  const emailsArray = Array.from(allMemberEmails);
  const userMap = new Map<string, { name: string; avatarColor: string }>();
  if (emailsArray.length > 0) {
    const { data: userData } = await supabase.from("users").select("email, full_name, avatar_color").in("email", emailsArray);

    userData?.forEach((u) => {
      if (u.email) {
        userMap.set(u.email, {
          name: u.full_name || getEmailName(u.email),
          avatarColor: u.avatar_color || "#E3000F",
        });
      }
    });
  }

  return projectsData.map((p) => {
    const pid = p.id as number;
    const createdBy = (p.created_by as string) || "";
    const emailsSet = projectMemberEmails.get(pid) || new Set<string>();
    const membersList = Array.from(emailsSet).map((email) => {
      const u = userMap.get(email);
      return {
        email,
        name: u?.name || getEmailName(email),
        avatarColor: u?.avatarColor || "#E3000F",
      };
    });

    return {
      ...p,
      id: pid,
      created_by: createdBy,
      logCount: projectCounts.get(pid) || 0,
      authorName: userMap.get(createdBy)?.name || getEmailName(createdBy),
      members: membersList,
      lastWipCreatedAt: projectLastWip.get(pid) || null,
    } as unknown as Project;
  });
}

export async function fetchProjectSessions(projectId: number, page = 0, pageSize = 20): Promise<{ items: AISession[]; total: number; hasMore: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase.from("ai_sessions").select("*", { count: "exact" }).eq("project_id", projectId).order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching project sessions:", error);
    return { items: [], total: 0, hasMore: false };
  }

  const rows = (data || []) as AISession[];
  const authorEmails = rows.map((s) => s.author_id);

  const { data: userData } = await supabase.from("users").select("email, full_name, avatar_color").in("email", authorEmails);

  const userMap = new Map<string, { name: string; avatarColor: string }>();
  userData?.forEach((u) => {
    if (u.email) {
      userMap.set(u.email, {
        name: u.full_name || getEmailName(u.email),
        avatarColor: u.avatar_color || "#E3000F",
      });
    }
  });

  const items = rows.map((row) => {
    const u = userMap.get(row.author_id);
    return {
      ...row,
      authorName: u?.name || getEmailName(row.author_id),
      avatarColor: u?.avatarColor || "#E3000F",
    };
  });

  const total = count || 0;

  return {
    items,
    total,
    hasMore: to + 1 < total,
  };
}

export async function fetchProjectMembers(projectId: number): Promise<{ email: string; name: string; avatarColor: string }[]> {
  const { data, error } = await supabase.from("ai_sessions").select("author_id").eq("project_id", projectId);

  if (error || !data) return [];

  const emails = Array.from(new Set(data.map((d) => d.author_id).filter(Boolean)));
  if (emails.length === 0) return [];

  const { data: userData } = await supabase.from("users").select("email, full_name, avatar_color").in("email", emails);

  const userMap = new Map<string, { name: string; avatarColor: string }>();
  userData?.forEach((u) => {
    if (u.email) {
      userMap.set(u.email, {
        name: u.full_name || getEmailName(u.email),
        avatarColor: u.avatar_color || "#E3000F",
      });
    }
  });

  return emails.map((email) => {
    const u = userMap.get(email);
    return {
      email,
      name: u?.name || getEmailName(email),
      avatarColor: u?.avatarColor || "#E3000F",
    };
  });
}

export async function fetchProjectSessionsForUser(projectId: number, authorId: string, page = 0, pageSize = 20): Promise<{ items: AISession[]; total: number; hasMore: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase.from("ai_sessions").select("*", { count: "exact" }).eq("project_id", projectId).eq("author_id", authorId).order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching project sessions for user:", error);
    return { items: [], total: 0, hasMore: false };
  }

  const rows = (data || []) as AISession[];
  const authorEmails = rows.map((s) => s.author_id);

  const { data: userData } = await supabase.from("users").select("email, full_name, avatar_color").in("email", authorEmails);

  const userMap = new Map<string, { name: string; avatarColor: string }>();
  userData?.forEach((u) => {
    if (u.email) {
      userMap.set(u.email, {
        name: u.full_name || getEmailName(u.email),
        avatarColor: u.avatar_color || "#E3000F",
      });
    }
  });

  const items = rows.map((row) => {
    const u = userMap.get(row.author_id);
    return {
      ...row,
      authorName: u?.name || getEmailName(row.author_id),
      avatarColor: u?.avatarColor || "#E3000F",
    };
  });

  const total = count || 0;

  return {
    items,
    total,
    hasMore: to + 1 < total,
  };
}

export async function createNewProject(name: string, userEmail: string): Promise<Project> {
  const { data, error } = await supabase.from("projects").insert({ name, created_by: userEmail }).select("*").single();

  if (error) throw error;
  return data as Project;
}

export interface AILicense {
  id: number;
  created_at: string;
  email: string;
  ai_tool: string;
  plan_name: string;
  monthly_cost: number;
  expiration_date: string;
  status: string | null;
  weekly_used?: string;
  usagePercent?: number;
}

export interface AIUsageStat {
  id: number;
  created_at: string;
  email: string;
  ai_tool: string;
  weekly_used: string;
  reset_time: string;
}

export async function fetchAILicenses(): Promise<AILicense[]> {
  const { data, error } = await supabase.from("ai_licenses").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching AI licenses:", error);
    return [];
  }
  return data || [];
}

export async function fetchAIUsageStats(): Promise<AIUsageStat[]> {
  const { data, error } = await supabase.from("ai_usage_stats").select("*").order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching AI usage stats:", error);
    return [];
  }
  return data || [];
}

export async function createAILicense(license: { email: string; ai_tool: string; plan_name: string; monthly_cost: number; expiration_date: string; status?: string }): Promise<AILicense> {
  const expDate = new Date(license.expiration_date + "T23:59:59");
  const payload = {
    ...license,
    status: license.status || (expDate >= new Date() ? "Active" : "Expired"),
  };
  const { data, error } = await supabase.from("ai_licenses").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

export async function renewAILicense(id: number, newExpirationDate: string): Promise<AILicense> {
  const { data, error } = await supabase
    .from("ai_licenses")
    .update({
      expiration_date: newExpirationDate,
      status: "Active",
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateAILicense(
  id: number,
  updates: {
    ai_tool: string;
    plan_name: string;
    monthly_cost: number;
    expiration_date: string;
    status?: string | null;
  },
): Promise<AILicense> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/update-license", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ licenseId: id, updates }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lỗi cập nhật bản quyền" }));
    throw new Error(err.error || "Lỗi cập nhật bản quyền");
  }
  const result = await res.json();
  return result.data;
}

export async function cancelAILicense(id: number): Promise<AILicense> {
  const { data, error } = await supabase.from("ai_licenses").update({ status: "Canceled" }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteAILicense(id: number): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/delete-license", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ licenseId: id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lỗi xóa bản quyền" }));
    throw new Error(err.error || "Lỗi xóa bản quyền");
  }
}


export async function fetchUserAILicenses(email: string): Promise<AILicense[]> {
  const { data, error } = await supabase.from("ai_licenses").select("*").eq("email", email).order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching user AI licenses:", error);
    return [];
  }
  return data || [];
}

export async function fetchUserAIUsageStats(email: string): Promise<AIUsageStat[]> {
  const { data, error } = await supabase.from("ai_usage_stats").select("*").eq("email", email).order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching user AI usage stats:", error);
    return [];
  }
  return data || [];
}

export async function updateProjectSummary(projectId: number, summaryJson: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({
      master_summary: summaryJson,
      last_summarized_at: new Date().toISOString(),
    })
    .eq("id", projectId);
  if (error) throw error;
}

export async function fetchCurationStats(): Promise<{ rawSessions: number; wipDrafts: number; knowledgeHub: number }> {
  const { count: sessionCount } = await supabase.from("ai_sessions").select("*", { count: "exact", head: true });

  const { count: wipCount } = await supabase.from("skill_library").select("*", { count: "exact", head: true }).eq("skill_type", "wip");

  const { data: projects } = await supabase.from("projects").select("master_summary");

  let summaryCount = 0;
  if (projects) {
    projects.forEach((p) => {
      if (p.master_summary) {
        try {
          const parsed = JSON.parse(p.master_summary);
          if (Array.isArray(parsed)) {
            summaryCount += parsed.length;
          }
        } catch {
          // ignore
        }
      }
    });
  }

  return {
    rawSessions: sessionCount || 0,
    wipDrafts: wipCount || 0,
    knowledgeHub: summaryCount,
  };
}

export async function fetchProjectWIPMembers(projectId: number): Promise<{ email: string; name: string; avatarColor: string }[]> {
  const { data, error } = await supabase.from("skill_library").select("author_id").eq("project_id", projectId).eq("skill_type", "wip");

  if (error || !data) return [];

  const emails = Array.from(new Set(data.map((d) => d.author_id).filter(Boolean)));
  if (emails.length === 0) return [];

  const { data: userData } = await supabase.from("users").select("email, full_name, avatar_color").in("email", emails);

  const userMap = new Map<string, { name: string; avatarColor: string }>();
  userData?.forEach((u) => {
    if (u.email) {
      userMap.set(u.email, {
        name: u.full_name || u.email.split("@")[0],
        avatarColor: u.avatar_color || "#E3000F",
      });
    }
  });

  return emails.map((email) => {
    const u = userMap.get(email);
    return {
      email,
      name: u?.name || email.split("@")[0],
      avatarColor: u?.avatarColor || "#E3000F",
    };
  });
}

export async function fetchProjectWIPsForUser(projectId: number, authorId: string, page = 0, pageSize = 20): Promise<{ items: AISession[]; total: number; hasMore: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase.from("skill_library").select("*", { count: "exact" }).eq("project_id", projectId).eq("skill_type", "wip").eq("author_id", authorId).order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching project WIPs for user:", error);
    return { items: [], total: 0, hasMore: false };
  }

  const items: AISession[] = (data || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    ai_tool: row.category || "WIP Draft",
    task_type: "WIP",
    prompt_content: row.markdown_content,
    tokens_used: row.session_tokens || 0,
    author_id: row.author_id,
    project_id: row.project_id,
    tier: "WIP",
    title: row.title,
    team_track: row.team_track,
  }));

  const total = count || 0;
  return {
    items,
    total,
    hasMore: to + 1 < total,
  };
}

export async function fetchProjectWIPs(projectId: number, page = 0, pageSize = 20): Promise<{ items: AISession[]; total: number; hasMore: boolean }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase.from("skill_library").select("*", { count: "exact" }).eq("project_id", projectId).eq("skill_type", "wip").order("created_at", { ascending: false }).range(from, to);

  if (error) {
    console.error("Error fetching project WIPs:", error);
    return { items: [], total: 0, hasMore: false };
  }

  const items: AISession[] = (data || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    ai_tool: row.category || "WIP Draft",
    task_type: "WIP",
    prompt_content: row.markdown_content,
    tokens_used: row.session_tokens || 0,
    author_id: row.author_id,
    project_id: row.project_id,
    tier: "WIP",
    title: row.title,
    team_track: row.team_track,
  }));

  const total = count || 0;
  return {
    items,
    total,
    hasMore: to + 1 < total,
  };
}

export async function fetchMyWIPs(email: string): Promise<AISession[]> {
  const { data, error } = await supabase
    .from("skill_library")
    .select("*")
    .eq("author_id", email)
    .eq("skill_type", "wip")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching my WIPs:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    ai_tool: row.category || "WIP Draft",
    task_type: "WIP",
    prompt_content: row.markdown_content,
    tokens_used: row.session_tokens || 0,
    author_id: row.author_id,
    project_id: row.project_id,
    tier: "WIP",
    title: row.title,
    team_track: row.team_track,
  }));
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  project_id: number | null;
  model: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  injected_assets: { id: number; title: string }[];
  created_at: string;
}

export async function fetchConversations(email: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", email)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching conversations:", error);
    return [];
  }
  return data || [];
}

export async function createConversation(email: string, title?: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      user_id: email,
      title: title || 'Hoi thoai moi',
      model: 'gemini',
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating conversation:", error);
    return null;
  }
  return data;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting conversation:", error);
    return false;
  }
  return true;
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error updating conversation title:", error);
  }
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
  return (data || []).map((m) => ({
    ...m,
    injected_assets: m.injected_assets || [],
  }));
}

export async function insertMessage(msg: {
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  injected_assets?: { id: number; title: string }[];
}): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("messages")
    .insert(msg)
    .select()
    .single();

  if (error) {
    console.error("Error inserting message:", error);
    return null;
  }
  return data;
}

export async function fetchInjectAssets(email: string, search?: string): Promise<{ id: number; title: string; category: string }[]> {
  let query = supabase
    .from("skill_library")
    .select("id, title, category")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching inject assets:", error);
    return [];
  }
  return data || [];
}

// === AIChat Session Functions (chat_sessions / chat_messages tables) ===

export interface ChatSessionRow {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function fetchChatSessions(userId: string): Promise<ChatSessionRow[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching chat sessions:', error);
    return [];
  }
  return data || [];
}

export async function createChatSession(
  userId: string,
  title?: string
): Promise<ChatSessionRow | null> {
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      id,
      user_id: userId,
      title: title || 'Phiên trò chuyện mới',
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating chat session:', error);
    return null;
  }
  return data;
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const { error: msgErr } = await supabase
    .from('chat_messages')
    .delete()
    .eq('session_id', sessionId);

  if (msgErr) {
    console.error('Error deleting chat messages:', msgErr);
    return false;
  }

  const { error } = await supabase
    .from('chat_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) {
    console.error('Error deleting chat session:', error);
    return false;
  }
  return true;
}

export async function updateChatSessionTitle(
  sessionId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from('chat_sessions')
    .update({ title })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating session title:', error);
    return false;
  }
  return true;
}

export async function fetchChatMessages(
  sessionId: string
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
  return data || [];
}

export async function insertChatMessage(msg: {
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<ChatMessageRow | null> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert(msg)
    .select()
    .single();

  if (error) {
    console.error('Error inserting chat message:', error);
    return null;
  }
  return data;
}

export async function fetchLegacyConversationsAsSessions(
  userId: string,
  userEmail: string
): Promise<ChatSessionRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userEmail)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    user_id: userId,
    title: c.title || 'Hội thoại cũ',
    created_at: c.created_at,
  }));
}

