'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, Medal, Search, ThumbsUp, BookOpen } from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type AdminOverviewMetrics,
  type AnalyticsPeriod,
  approveSkill,
  downloadSkillMarkdown,
  fetchAdminOverviewMetrics,
  fetchApprovedSkills,
  fetchMyWorkspaceSkills,
  fetchPendingSkills,
  fetchTrendingSkills,
  getCurrentUserProfile,
  rejectSkill,
  signInWithGoogle,
  signOut,
  toggleSkillVote,
  type PaginatedSkills,
  type SkillCard,
  type UserProfile,
  type AppUser,
  type Project,
  type AISession,
  type UserRole,
  fetchAllUsers,
  updateUserRole,
  fetchProjects,
  fetchProjectSessions,
  fetchProjectMembers,
  fetchProjectSessionsForUser,
  createNewProject,
} from '@/lib/dashboard-supabase';
import UserGuideModal from './UserGuideModal';

const PAGE_SIZE = 9;
const TOOL_COLORS = ['#E3000F', '#FF3344', '#f59e0b', '#a855f7', '#059669', '#0d9488'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function stripMarkdown(value: string, maxLength = 180) {
  const plainText = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s>*-]+/gm, '')
    .replace(/[*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return `${plainText.slice(0, maxLength).trim()}...`;
}

function StatusPill({ status }: { status: SkillCard['status'] }) {
  const label =
    status === 'approved' ? 'Đã duyệt' : status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt';
  const className =
    status === 'approved'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : status === 'rejected'
        ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20';

  return <span className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
}

function roleLabel(role: UserProfile['role']) {
  return role === 'admin' ? 'Quản trị viên' : 'Người dùng';
}

function StatCard({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'yellow';
}) {
  const tones = {
    blue: {
      line: 'bg-markee-primary',
      card: 'from-red-50/50 to-white shadow-slate-100 hover:from-red-50',
    },
    green: {
      line: 'bg-emerald-600',
      card: 'from-emerald-50/50 to-white shadow-slate-100 hover:from-emerald-50',
    },
    orange: {
      line: 'bg-orange-500',
      card: 'from-orange-50/50 to-white shadow-slate-100 hover:from-orange-50',
    },
    purple: {
      line: 'bg-purple-500',
      card: 'from-purple-50/50 to-white shadow-slate-100 hover:from-purple-50',
    },
    yellow: {
      line: 'bg-yellow-500',
      card: 'from-yellow-50/50 to-white shadow-slate-100 hover:from-yellow-50',
    },
  };
  const currentTone = tones[tone];

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-markee-border bg-gradient-to-r p-6 pl-7 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${currentTone.card}`}
    >
      <div className={`absolute left-3 top-4 bottom-4 w-1 rounded-full ${currentTone.line}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-markee-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-markee-text">{value}</p>
      <p className="mt-1 text-xs text-markee-sub">{note}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-markee-border bg-white p-6 shadow-sm transition-all duration-300 ease-in-out hover:shadow-md">
      <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-markee-muted">{title}</h3>
      {children}
    </div>
  );
}

function ConfirmationModal({
  open,
  action,
  title,
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  action: 'approved' | 'rejected' | null;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  if (!open || !action) return null;

  const isApprove = action === 'approved';
  const actionText = isApprove ? 'phê duyệt' : 'từ chối';
  const buttonClass = isApprove
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : 'bg-markee-primary hover:bg-markee-hover text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-markee-border bg-white p-6 shadow-2xl">
        <div className={`mb-5 h-1.5 w-16 rounded-full ${isApprove ? 'bg-emerald-600' : 'bg-markee-primary'}`} />
        <h2 className="text-lg font-bold text-markee-text">
          {isApprove ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-markee-muted">
          Bạn có chắc chắn muốn {actionText} kỹ năng <span className="font-semibold text-markee-text">"{title}"</span> không?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-markee-border bg-white px-4 py-2.5 text-sm font-semibold text-markee-text transition-colors hover:bg-markee-bg disabled:opacity-60"
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors disabled:opacity-60 ${buttonClass}`}
          >
            {busy ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillCardItem({
  skill,
  userEmail,
  showStatus = false,
  allowVoting = true,
}: {
  skill: SkillCard;
  userEmail: string;
  showStatus?: boolean;
  allowVoting?: boolean;
}) {
  const [likes, setLikes] = useState(skill.likes_count || 0);
  const [downloads, setDownloads] = useState(skill.downloads_count || 0);
  const [liked, setLiked] = useState(Boolean(skill.likedByCurrentUser));
  const [busyAction, setBusyAction] = useState<'vote' | 'download' | null>(null);
  const summary = stripMarkdown(skill.markdown_content || '');

  async function handleVote() {
    setBusyAction('vote');
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikes((value) => Math.max(0, value + (nextLiked ? 1 : -1)));

    try {
      const result = await toggleSkillVote(skill.id, userEmail);
      setLiked(result.liked);
    } catch (error) {
      setLiked(liked);
      setLikes((value) => Math.max(0, value + (nextLiked ? -1 : 1)));
      console.error('Error voting skill:', error);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDownload() {
    setBusyAction('download');
    setDownloads((value) => value + 1);

    try {
      await downloadSkillMarkdown({ ...skill, likes_count: likes, downloads_count: downloads + 1 });
    } catch (error) {
      setDownloads((value) => Math.max(0, value - 1));
      console.error('Error downloading skill:', error);
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <article className="rounded-xl border border-markee-border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-markee-primary hover:shadow-md">
      <div className="mb-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-markee-text">{skill.title}</h3>
          <p className="mt-1 text-xs text-markee-sub">
            {skill.category || 'Kỹ năng'} · {skill.authorName}
          </p>
        </div>
        {showStatus && <StatusPill status={skill.status} />}
      </div>

      <p className="mb-5 min-h-12 text-sm leading-6 text-markee-muted">{summary || 'Chưa có mô tả nội dung.'}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-markee-sub">
          <span>{likes} tim</span>
          <span>·</span>
          <span>{downloads} tải</span>
        </div>
        <div className="flex gap-2">
          {allowVoting && (
            <button
              type="button"
              onClick={handleVote}
              disabled={busyAction !== null}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors disabled:opacity-60 ${
                liked
                  ? 'bg-red-50 border-markee-primary text-markee-primary font-medium'
                  : 'bg-white border-gray-300 text-gray-500 hover:border-markee-primary hover:text-markee-primary'
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" fill={liked ? 'currentColor' : 'none'} />
              Hữu ích
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-markee-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-markee-hover disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            Tải về
          </button>
        </div>
      </div>
    </article>
  );
}

function TrendingSkills({ skills }: { skills: SkillCard[] }) {
  return (
    <aside className="self-start rounded-xl border border-markee-border bg-white p-4 w-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Kỹ năng nổi bật</h2>
      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {skills.slice(0, 5).map((skill, index) => (
          <div key={skill.id} className="flex items-start gap-3 border-b border-markee-border pb-3 last:border-b-0 last:pb-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-markee-light/20 text-xs font-bold text-markee-primary">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-markee-text">{skill.title}</div>
              <div className="mt-1 text-xs text-markee-sub">{skill.score} điểm tương tác</div>
            </div>
          </div>
        ))}
        {skills.length === 0 && <div className="text-xs text-markee-sub">Chưa có kỹ năng đã duyệt.</div>}
      </div>
    </aside>
  );
}

function PaginationControls({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFirstPage = page <= 0;
  const isLastPage = page >= totalPages - 1;

  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={isFirstPage}
        className="inline-flex items-center gap-1.5 rounded-xl border border-markee-border bg-white px-3 py-2 text-xs font-semibold text-markee-text transition-colors hover:bg-markee-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Trang trước
      </button>
      <div className="rounded-xl border border-markee-border bg-markee-bg px-4 py-2 text-xs font-semibold text-markee-muted">
        Trang {page + 1} trên {totalPages}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={isLastPage}
        className="inline-flex items-center gap-1.5 rounded-xl border border-markee-border bg-white px-3 py-2 text-xs font-semibold text-markee-text transition-colors hover:bg-markee-bg disabled:cursor-not-allowed disabled:opacity-40"
      >
        Trang sau
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function UserDashboard({
  profile,
  refreshKey = 0,
  mode = 'full',
}: {
  profile: UserProfile;
  refreshKey?: number;
  mode?: 'full' | 'library-only';
}) {
  const [activeView, setActiveView] = useState<'library' | 'workspace'>('library');
  const [library, setLibrary] = useState<PaginatedSkills>({ items: [], total: 0, hasMore: false, nextPage: 0 });
  const [workspaceSkills, setWorkspaceSkills] = useState<SkillCard[]>([]);
  const [trendingSkills, setTrendingSkills] = useState<SkillCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const isLibraryOnly = mode === 'library-only';

  const [workspaceTab, setWorkspaceTab] = useState<'approved' | 'pending'>('approved');

  const approvedWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'approved');
  }, [workspaceSkills]);

  const pendingWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'pending');
  }, [workspaceSkills]);

  async function loadInitialData() {
    setLoading(true);

    try {
      if (isLibraryOnly) {
        const skills = await fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm);
        setLibrary(skills);
        return;
      }

      const [skills, trending, workspace] = await Promise.all([
        fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm),
        fetchTrendingSkills(5, profile.email),
        fetchMyWorkspaceSkills(profile.email),
      ]);

      setLibrary(skills);
      setTrendingSkills(trending);
      setWorkspaceSkills(workspace);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [profile.email, refreshKey, page, debouncedSearchTerm, isLibraryOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const displayedSkills = !isLibraryOnly && activeView === 'workspace'
    ? (workspaceTab === 'approved' ? approvedWorkspaceSkills : pendingWorkspaceSkills)
    : library.items;

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Thư viện kỹ năng</h1>
          <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Danh sách chính chỉ hiển thị kỹ năng đã được duyệt.</p>
        </div>
        {!isLibraryOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveView('library')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeView === 'library' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
              }`}
            >
              Thư viện chung
            </button>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${
                activeView === 'workspace' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
              }`}
            >
              Không gian của tôi
            </button>
          </div>
        )}
      </section>

      {(isLibraryOnly || activeView === 'library') && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-markee-sub" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm kiếm kỹ năng, danh mục hoặc người tạo..."
            className="w-full rounded-xl border border-markee-border bg-white py-3 pl-11 pr-4 text-sm text-markee-text outline-none transition-colors placeholder:text-markee-sub focus:border-markee-primary"
          />
        </div>
      )}

      <div className={`grid gap-4 ${!isLibraryOnly && activeView === 'library' ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
        <section className="space-y-4">
          {!isLibraryOnly && activeView === 'workspace' && (
            <div className="flex gap-2 border-b border-markee-border pb-3">
              <button
                type="button"
                onClick={() => setWorkspaceTab('approved')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  workspaceTab === 'approved'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                }`}
              >
                Kỹ năng đã duyệt ({approvedWorkspaceSkills.length})
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceTab('pending')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  workspaceTab === 'pending'
                    ? 'bg-amber-500/10 text-amber-700 border border-amber-500/30'
                    : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                }`}
              >
                Kỹ năng đang chờ duyệt ({pendingWorkspaceSkills.length})
              </button>
            </div>
          )}
          {loading ? (
            <div className="rounded-lg border border-markee-border bg-white p-8 text-center text-sm text-markee-muted">Đang tải dữ liệu...</div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {displayedSkills.map((skill) => (
                  <SkillCardItem
                    key={skill.id}
                    skill={skill}
                    userEmail={profile.email}
                    showStatus={!isLibraryOnly && activeView === 'workspace'}
                    allowVoting={isLibraryOnly || activeView === 'library'}
                  />
                ))}
              </div>

              {displayedSkills.length === 0 && (
                <div className="rounded-lg border border-markee-border bg-white p-8 text-center text-sm text-markee-muted">
                  Chưa có skill để hiển thị.
                </div>
              )}

              {(isLibraryOnly || activeView === 'library') && library.total > PAGE_SIZE && (
                <PaginationControls page={page} total={library.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
              )}
            </>
          )}
        </section>

        {!isLibraryOnly && activeView === 'library' && <TrendingSkills skills={trendingSkills} />}
      </div>
    </main>
  );
}

function AdminOverview({
  metrics,
  period,
  onPeriodChange,
}: {
  metrics: AdminOverviewMetrics;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
}) {
  const periodOptions: { id: AnalyticsPeriod; label: string }[] = [
    { id: '7d', label: '7 ngày' },
    { id: '30d', label: '30 ngày' },
    { id: 'all', label: 'Tất cả' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-markee-text">Tổng quan quản trị</h2>
          <p className="text-xs text-markee-muted">Theo dõi mức sử dụng AI và đóng góp kỹ năng của đội ngũ.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-markee-border bg-white p-1">
          {periodOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPeriodChange(option.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                period === option.id ? 'bg-markee-primary text-white' : 'text-markee-muted hover:bg-markee-bg'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Tổng token" value={formatNumber(metrics.totalTokens)} note="Dữ liệu từ extension" tone="blue" />
        <StatCard label="Chi phí ước tính" value={formatCurrency(metrics.costUsd)} note="Token × 0.015 USD" tone="green" />
        <StatCard label="Lượt sử dụng" value={formatNumber(metrics.totalSessions)} note="Số phiên AI được ghi nhận" tone="orange" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <ChartCard title="Xu hướng token theo ngày">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.dailyTokens} margin={{ top: 14, right: 24, left: 18, bottom: 12 }}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#E3000F" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#E3000F" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#666666" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} />
                <YAxis stroke="#666666" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} tickMargin={12} width={48} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#E5E5E5',
                    borderRadius: '0.75rem',
                    color: '#1A1A1A',
                  }}
                  itemStyle={{ color: '#1A1A1A' }}
                  labelStyle={{ color: '#1A1A1A' }}
                  formatter={(value: number) => [formatNumber(value), 'Token']}
                />
                <Area type="monotone" dataKey="tokens" stroke="#E3000F" strokeWidth={2} fill="url(#tokenGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Tỷ lệ công cụ AI">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics.toolUsage}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={1}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {metrics.toolUsage.map((entry, index) => (
                    <Cell key={entry.name} fill={TOOL_COLORS[index % TOOL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#E5E5E5',
                    borderRadius: '0.75rem',
                    color: '#1A1A1A',
                  }}
                  itemStyle={{ color: '#1A1A1A' }}
                  labelStyle={{ color: '#1A1A1A' }}
                  formatter={(value: number) => [formatNumber(value), 'Token']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {metrics.toolUsage.slice(0, 5).map((tool, index) => (
              <div key={tool.name} className="flex items-center justify-between text-xs text-markee-muted">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: TOOL_COLORS[index % TOOL_COLORS.length] }} />
                  {tool.name}
                </span>
                <span>{formatNumber(tool.value)}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      <div className="rounded-xl border border-markee-border bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Bảng xếp hạng đóng góp kỹ năng</h3>
        <div className="max-h-[320px] overflow-y-auto pr-1">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            {metrics.contributors.map((person, index) => (
              <div key={person.email} className="rounded-xl border border-markee-border bg-markee-bg p-3 flex flex-col justify-between min-h-[90px] transition-all hover:border-markee-sub">
                <div className="mb-2 flex items-center justify-between">
                  <Medal
                    className={`h-5 w-5 ${
                      index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  />
                  <span className="text-xs font-bold text-markee-sub">#{index + 1}</span>
                </div>
                <div>
                  <div className="truncate text-sm font-semibold text-markee-text" title={person.name}>{person.name}</div>
                  <div className="mt-1 text-xs text-markee-muted">{person.count} kỹ năng đã duyệt</div>
                </div>
              </div>
            ))}
            {metrics.contributors.length === 0 && <div className="col-span-full text-sm text-markee-muted py-4 text-center">Chưa có dữ liệu đóng góp.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

function AdminDashboard({
  profile,
  onSkillModerated,
}: {
  profile: UserProfile;
  onSkillModerated?: () => void;
}) {
  const [pendingSkills, setPendingSkills] = useState<SkillCard[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<number | null>(null);
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics>({
    totalTokens: 0,
    costUsd: 0,
    totalSessions: 0,
    dailyTokens: [],
    toolUsage: [],
    contributors: [],
  });
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approved' | 'rejected' | null>(null);

  const selectedSkill = useMemo(
    () => pendingSkills.find((skill) => skill.id === selectedSkillId) || pendingSkills[0],
    [pendingSkills, selectedSkillId]
  );

  async function loadAdminData() {
    setLoading(true);

    try {
      const [pending, overview] = await Promise.all([fetchPendingSkills(), fetchAdminOverviewMetrics(period)]);
      setPendingSkills(pending);
      setMetrics(overview);
      setSelectedSkillId(pending[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }

  async function moderateSkill(status: 'approved' | 'rejected') {
    if (!selectedSkill) return;

    setActionBusy(true);

    try {
      if (status === 'approved') {
        await approveSkill(selectedSkill.id);
      } else {
        await rejectSkill(selectedSkill.id);
      }

      if (status === 'approved') {
        const overview = await fetchAdminOverviewMetrics(period);
        setMetrics(overview);
        onSkillModerated?.();
      }

      setPendingSkills((skills) => skills.filter((skill) => skill.id !== selectedSkill.id));
      setSelectedSkillId(null);
      setPendingAction(null);
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, [period]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Khu vực quản trị</h1>
          <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Duyệt kỹ năng và theo dõi hoạt động AI của đội ngũ.</p>
        </div>
      </section>

      <AdminOverview metrics={metrics} period={period} onPeriodChange={setPeriod} />

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-markee-border bg-white p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Kỹ năng chờ duyệt</h2>
          <div className="space-y-2">
            {loading && <div className="text-xs text-markee-sub">Đang tải...</div>}
            {!loading &&
              pendingSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSelectedSkillId(skill.id)}
                  className={`block w-full rounded-lg border p-3 text-left transition-all ${
                    selectedSkill?.id === skill.id
                      ? 'border-markee-primary bg-red-50 text-markee-primary font-semibold'
                      : 'border-markee-border bg-markee-bg text-markee-text hover:bg-white'
                  }`}
                >
                  <div className="truncate text-xs font-semibold">{skill.title}</div>
                  <div className="mt-1 text-xs text-markee-muted">
                    {skill.category || 'Kỹ năng'} · {skill.authorName}
                  </div>
                </button>
              ))}
            {!loading && pendingSkills.length === 0 && <div className="text-xs text-markee-sub">Không còn kỹ năng chờ duyệt.</div>}
          </div>
        </div>

        <div className="rounded-lg border border-markee-border bg-white p-4">
          {selectedSkill ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-markee-text">{selectedSkill.title}</h2>
                  <p className="mt-1 text-xs text-markee-muted">
                    {selectedSkill.category || 'Prompt'} · {selectedSkill.authorName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingAction('rejected')}
                    disabled={actionBusy}
                    className="rounded-lg bg-markee-primary hover:bg-markee-hover px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction('approved')}
                    disabled={actionBusy}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 transition-colors"
                  >
                    Phê duyệt
                  </button>
                </div>
              </div>
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-markee-border bg-markee-bg p-4 text-xs leading-6 text-markee-text">
                {selectedSkill.markdown_content}
              </pre>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-markee-sub">Chọn một kỹ năng chờ duyệt để xem trước.</div>
          )}
        </div>
      </section>

      <ConfirmationModal
        open={Boolean(pendingAction)}
        action={pendingAction}
        title={selectedSkill?.title || ''}
        busy={actionBusy}
        onCancel={() => {
          if (!actionBusy) setPendingAction(null);
        }}
        onConfirm={() => {
          if (pendingAction) moderateSkill(pendingAction);
        }}
      />
    </main>
  );
}

export default function RoleDashboard() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'library' | 'projects' | 'users'>('overview');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  async function loadProfile() {
    setLoading(true);

    try {
      const p = await getCurrentUserProfile();
      setProfile(p);
      if (p && p.role === 'user') {
        setActiveTab('library');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-markee-bg text-sm text-markee-muted">Đang kiểm tra đăng nhập...</div>;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-markee-bg p-5 text-markee-text">
        <div className="w-full max-w-sm rounded-xl border border-markee-border bg-white p-6 text-center shadow-lg">
          <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</h1>
          <p className="mt-2 text-sm text-markee-muted">Đăng nhập Google để mở dashboard theo role.</p>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="mt-5 w-full rounded-lg bg-markee-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-markee-hover transition-colors"
          >
            Đăng nhập Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-markee-bg text-markee-text font-sans">
      {/* Sidebar (Cột trái) */}
      <aside className="w-64 bg-white border-r border-markee-border flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-markee-border flex items-center gap-3">
          <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-8 h-8 shrink-0" />
          <div>
            <div className="text-sm font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</div>
            <div className="text-[10px] text-markee-muted uppercase tracking-wider font-semibold">Center Console</div>
          </div>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-markee-border bg-markee-bg/20 flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner"
            style={{ backgroundColor: profile.dbUser?.avatar_color || '#E3000F' }}
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-markee-text truncate">{profile.displayName}</div>
            <div className="text-xs text-markee-muted truncate capitalize">{roleLabel(profile.role)}</div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 flex-1 space-y-1">
          {profile.role === 'admin' && (
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
            >
              <span>📊</span>
              <span>Tổng quan</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'library'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
            }`}
          >
            <span>📚</span>
            <span>Thư viện kỹ năng</span>
          </button>

          {profile.role === 'admin' && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('projects')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'projects'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
              >
                <span>📁</span>
                <span>Quản lý Dự án</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
              >
                <span>👥</span>
                <span>Quản lý User</span>
              </button>
            </>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-markee-border px-6 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="text-markee-primary border border-markee-primary hover:bg-markee-primary/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            <span>Hướng dẫn cài đặt</span>
          </button>
          <button
            type="button"
            onClick={() => signOut().then(() => setProfile(null))}
            className="rounded-lg border border-markee-border bg-white px-3.5 py-1.5 text-xs font-semibold text-markee-text hover:bg-markee-bg transition-colors shadow-xs cursor-pointer"
          >
            Đăng xuất
          </button>
        </header>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && profile.role === 'admin' && (
            <AdminDashboard
              profile={profile}
              onSkillModerated={() => setLibraryRefreshKey((key) => key + 1)}
            />
          )}

          {activeTab === 'library' && (
            <UserDashboard profile={profile} refreshKey={libraryRefreshKey} />
          )}

          {activeTab === 'projects' && profile.role === 'admin' && (
            <ProjectManagement profile={profile} />
          )}

          {activeTab === 'users' && profile.role === 'admin' && (
            <UserManagement />
          )}
        </div>
      </div>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}

function UserOverviewOnly({ profile }: { profile: UserProfile }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('7d');
  const [metrics, setMetrics] = useState<AdminOverviewMetrics>({
    totalTokens: 0,
    costUsd: 0,
    totalSessions: 0,
    dailyTokens: [],
    toolUsage: [],
    contributors: [],
  });
  const [loading, setLoading] = useState(true);

  async function loadOverviewData() {
    setLoading(true);
    try {
      const overview = await fetchAdminOverviewMetrics(period);
      setMetrics(overview);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOverviewData();
  }, [period]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Tổng quan hoạt động</h1>
          <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Theo dõi hoạt động AI của đội ngũ.</p>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải dữ liệu...</div>
      ) : (
        <AdminOverview metrics={metrics} period={period} onPeriodChange={setPeriod} />
      )}
    </main>
  );
}

function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'loading', duration = 3000) {
    setToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(current => current?.message === message ? null : current);
      }, duration);
    }
  }

  async function handleRoleChange(userId: number, newRole: UserRole) {
    showToast('Đang lưu thay đổi...', 'loading');
    try {
      await updateUserRole(userId, newRole);
      setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast('Đã cập nhật quyền thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật quyền người dùng', 'error');
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${
          toast.type === 'loading'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'loading' && <span className="animate-spin mr-1">⏳</span>}
          {toast.type === 'success' && <span className="mr-1">✓</span>}
          {toast.type === 'error' && <span className="mr-1">⚠️</span>}
          {toast.message}
        </div>
      )}

      <section>
        <h1 className="text-lg font-bold text-markee-text">Quản lý người dùng</h1>
        <p className="text-xs text-markee-muted">Phân quyền vai trò và quản trị danh sách người dùng hệ thống.</p>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách người dùng...</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-markee-border bg-white shadow-xs">
          <table className="w-full border-collapse text-left text-sm text-markee-text">
            <thead className="bg-markee-bg text-xs font-semibold uppercase tracking-wider text-markee-muted border-b border-markee-border">
              <tr>
                <th className="px-6 py-4">Tên người dùng</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Phòng ban (Team)</th>
                <th className="px-6 py-4">Vai trò (Role)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-markee-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-markee-bg/20 transition-colors">
                  <td className="px-6 py-4 font-semibold text-markee-text">{user.full_name || 'Chưa cập nhật'}</td>
                  <td className="px-6 py-4 text-markee-muted">{user.email}</td>
                  <td className="px-6 py-4 text-markee-muted">{user.team || '—'}</td>
                  <td className="px-6 py-4">
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className="rounded-lg border border-markee-border bg-white px-3 py-1.5 text-xs font-medium text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-markee-sub">Không tìm thấy người dùng nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function PromptText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const shouldTruncate = text.length > 180 || text.split('\n').length > 3;
  
  if (!shouldTruncate) {
    return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>;
  }
  
  const displayText = expanded
    ? text
    : text.slice(0, 180) + '...';
    
  return (
    <div>
      <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>
      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs font-bold text-markee-primary hover:text-markee-hover cursor-pointer"
      >
        {expanded ? 'Thu gọn ↑' : 'Xem thêm ↓'}
      </button>
    </div>
  );
}

const softBgClasses = [
  'bg-red-50 text-red-600 border-red-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-sky-50 text-sky-600 border-sky-100',
  'bg-purple-50 text-purple-600 border-purple-100',
  'bg-pink-50 text-pink-600 border-pink-100',
];

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

function ProjectManagement({ profile }: { profile: UserProfile }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Modal logs and members states
  const [members, setMembers] = useState<{ email: string; name: string; avatarColor: string }[]>([]);
  const [activeMemberEmail, setActiveMemberEmail] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [logs, setLogs] = useState<AISession[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Create project states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // AI Tool filter state
  const [selectedTool, setSelectedTool] = useState<string>('Tất cả');

  const selectedMember = useMemo(
    () => members.find(m => m.email === activeMemberEmail) || null,
    [members, activeMemberEmail]
  );

  const filteredLogs = useMemo(() => {
    if (selectedTool === 'Tất cả') return logs;
    return logs.filter(log => {
      const toolLower = (log.ai_tool || '').toLowerCase();
      if (selectedTool === 'ChatGPT') return toolLower.includes('gpt') || toolLower.includes('chatgpt');
      if (selectedTool === 'Gemini') return toolLower.includes('gemini') || toolLower.includes('google');
      if (selectedTool === 'Claude') return toolLower.includes('claude') || toolLower.includes('anthropic');
      return false;
    });
  }, [logs, selectedTool]);

  function showToast(message: string, type: 'success' | 'error' | 'loading', duration = 3000) {
    setToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(current => current?.message === message ? null : current);
      }, duration);
    }
  }

  async function handleCreateProject() {
    const trimmedName = projectName.trim();
    if (!trimmedName) return;
    setIsCreating(true);
    try {
      const newProject = await createNewProject(trimmedName, profile.email);
      const projectWithAuthor: Project = {
        ...newProject,
        logCount: 0,
        authorName: profile.displayName || profile.email.split('@')[0],
        members: []
      };
      setProjects(prev => [projectWithAuthor, ...prev]);
      showToast('Tạo dự án mới thành công!', 'success');
      setIsCreateModalOpen(false);
      setProjectName('');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tạo dự án mới', 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserLogs(projId: number, userEmail: string, isInitial = false) {
    setLogsLoading(true);
    const nextPage = isInitial ? 0 : page + 1;
    try {
      const result = await fetchProjectSessionsForUser(projId, userEmail, nextPage, 20);
      if (isInitial) {
        setLogs(result.items);
      } else {
        setLogs(prev => [...prev, ...result.items]);
      }
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleOpenProject(project: Project) {
    setSelectedProject(project);
    setMembers([]);
    setActiveMemberEmail(null);
    setLogs([]);
    setPage(0);
    setHasMore(false);
    setSelectedTool('Tất cả');
    setMembersLoading(true);

    try {
      const activeMembers = await fetchProjectMembers(project.id);
      setMembers(activeMembers);
      if (activeMembers.length > 0) {
        const firstEmail = activeMembers[0].email;
        setActiveMemberEmail(firstEmail);
        loadUserLogs(project.id, firstEmail, true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMembersLoading(false);
    }
  }

  function handleSelectMember(email: string) {
    setActiveMemberEmail(email);
    setLogs([]);
    setPage(0);
    setSelectedTool('Tất cả');
    setHasMore(false);
    if (selectedProject) {
      loadUserLogs(selectedProject.id, email, true);
    }
  }

  function handleLoadMore() {
    if (selectedProject && activeMemberEmail) {
      loadUserLogs(selectedProject.id, activeMemberEmail, false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${
          toast.type === 'loading'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'loading' && <span className="animate-spin mr-1">⏳</span>}
          {toast.type === 'success' && <span className="mr-1">✓</span>}
          {toast.type === 'error' && <span className="mr-1">⚠️</span>}
          {toast.message}
        </div>
      )}

      <section className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Quản lý Dự án</h1>
          <p className="text-xs text-markee-muted">Quản trị các dự án hoạt động AI của toàn bộ hệ thống.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <span>➕</span>
          <span>Tạo dự án</span>
        </button>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách dự án...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {projects.map((project) => {
            const updateDate = new Date(project.created_at).toLocaleDateString('vi-VN', {
              day: 'numeric',
              month: 'numeric',
            });

            return (
              <div
                key={project.id}
                onClick={() => handleOpenProject(project)}
                className="group cursor-pointer rounded-xl border-t-4 border-t-markee-primary border-x border-b border-gray-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between min-h-[190px]"
              >
                <div className="space-y-4">
                  {/* Header */}
                  <div>
                    <h3 className="text-lg font-bold text-markee-text truncate group-hover:text-markee-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-xs text-markee-muted truncate mt-1">
                      Dự án theo dõi hoạt động AI. Tạo bởi {project.authorName}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 border-y border-gray-100 py-3">
                    <div>
                      <div className="font-bold text-markee-text text-sm md:text-base">
                        {project.logCount || 0}
                      </div>
                      <div className="text-[9px] font-bold text-markee-muted uppercase tracking-wider">
                        LOGS
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-markee-text text-sm md:text-base">
                        {project.members?.length || 0}
                      </div>
                      <div className="text-[9px] font-bold text-markee-muted uppercase tracking-wider">
                        MEMBERS
                      </div>
                    </div>
                    <div>
                      <div className="font-bold text-markee-text text-sm md:text-base">
                        {updateDate}
                      </div>
                      <div className="text-[9px] font-bold text-markee-muted uppercase tracking-wider">
                        UPDATE
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Stacked Avatars */}
                <div className="flex items-center justify-between mt-4">
                  <div className="flex -space-x-2 overflow-hidden">
                    {project.members && project.members.slice(0, 4).map((m, idx) => (
                      <div
                        key={m.email}
                        title={m.name}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[10px] font-bold shadow-2xs shrink-0 select-none ${
                          softBgClasses[idx % softBgClasses.length]
                        }`}
                      >
                        {getInitials(m.name)}
                      </div>
                    ))}
                    {project.members && project.members.length > 4 && (
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-[10px] font-bold shadow-2xs shrink-0 select-none">
                        +{project.members.length - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-markee-muted group-hover:text-markee-primary transition-colors font-medium">
                    Xem chi tiết →
                  </span>
                </div>
              </div>
            );
          })}
          {projects.length === 0 && (
            <div className="col-span-3 text-center py-10 text-sm text-markee-sub">Chưa có dự án nào được tạo.</div>
          )}
        </div>
      )}

      {/* Activity Log Timeline Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-5xl w-full h-[80vh] max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="border-b border-markee-border px-6 py-4 flex items-center justify-between bg-markee-bg/10 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-markee-text">Lịch sử làm việc: {selectedProject.name}</h2>
                <p className="text-xs text-markee-muted mt-0.5">Timeline ghi nhận các phiên làm việc của dự án được lọc theo thành viên.</p>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Flex Split (Sidebar + Timeline) */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left sidebar: Members */}
              <aside className="w-64 border-r border-markee-border bg-markee-bg/10 flex flex-col overflow-y-auto p-4 shrink-0">
                <h3 className="text-[11px] font-bold text-markee-muted uppercase tracking-wider mb-3">Thành viên hoạt động</h3>
                
                {membersLoading ? (
                  <div className="text-xs text-markee-sub py-4">Đang tải thành viên...</div>
                ) : (
                  <div className="space-y-1">
                    {members.map((member) => (
                      <button
                        key={member.email}
                        onClick={() => handleSelectMember(member.email)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold text-left transition-all cursor-pointer ${
                          activeMemberEmail === member.email
                            ? 'bg-markee-primary text-white shadow-xs'
                            : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0"
                          style={{
                            backgroundColor:
                              activeMemberEmail === member.email
                                ? 'rgba(255, 255, 255, 0.2)'
                                : member.avatarColor || '#E3000F',
                          }}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate">{member.name}</span>
                      </button>
                    ))}
                    {members.length === 0 && (
                      <div className="text-xs text-markee-sub py-4">Dự án chưa có hoạt động nào.</div>
                    )}
                  </div>
                )}
              </aside>

              {/* Right content: Timeline */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* AI Tool Filter Pills */}
                {!membersLoading && members.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pb-4 border-b border-gray-100">
                    <span className="text-xs font-semibold text-markee-muted mr-1">Lọc công cụ:</span>
                    {['Tất cả', 'ChatGPT', 'Gemini', 'Claude'].map((tool) => {
                      const isActive = selectedTool === tool;
                      return (
                        <button
                          key={tool}
                          onClick={() => setSelectedTool(tool)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isActive
                              ? 'bg-markee-primary text-white shadow-xs'
                              : 'bg-gray-100 text-markee-muted hover:bg-gray-200 hover:text-markee-text'
                          }`}
                        >
                          {tool}
                        </button>
                      );
                    })}
                  </div>
                )}

                {membersLoading || (logsLoading && logs.length === 0) ? (
                  <div className="text-center py-10 text-sm text-markee-sub">Đang tải nhật ký hoạt động...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-markee-sub">
                    {logs.length === 0 ? 'Không có log hoạt động nào.' : `Không có log hoạt động nào sử dụng ${selectedTool}.`}
                  </div>
                ) : (
                  <div className="relative border-l-2 border-markee-border pl-6 ml-3 space-y-8">
                    {filteredLogs.map((log) => {
                      const dateStr = new Date(log.created_at).toLocaleString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      });

                      // AI Tool Badge color mapping
                      let toolBadgeClass = "bg-gray-100 text-gray-700 border border-gray-200";
                      const toolLower = (log.ai_tool || '').toLowerCase();
                      if (toolLower.includes('gpt') || toolLower.includes('chatgpt')) {
                        toolBadgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                      } else if (toolLower.includes('claude') || toolLower.includes('anthropic')) {
                        toolBadgeClass = "bg-orange-50 text-orange-700 border border-orange-200";
                      } else if (toolLower.includes('gemini') || toolLower.includes('google')) {
                        toolBadgeClass = "bg-sky-50 text-sky-700 border border-sky-200";
                      }

                      // Tier Badge color mapping
                      const tierLower = (log.tier || '').toLowerCase();
                      const isPro = tierLower.includes('pro') || tierLower.includes('plus') || tierLower.includes('premium');
                      const tierBadgeClass = isPro
                        ? "bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded text-xs"
                        : "bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs";

                      return (
                        <div key={log.id} className="relative">
                          {/* Timeline Bullet Node */}
                          <div
                            className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs"
                            style={{ backgroundColor: selectedMember?.avatarColor || '#E3000F' }}
                          />
                          
                          {/* Log Item Header */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-markee-text">{dateStr}</span>
                            <span className="text-markee-muted">— đã sử dụng</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${toolBadgeClass}`}>
                              {log.ai_tool || 'AI Tool'}
                            </span>
                            <span className={tierBadgeClass}>
                              {log.tier || 'Free'}
                            </span>
                          </div>

                          {/* Prompt content block */}
                          {log.prompt_content && (
                            <div className="mt-2.5">
                              <blockquote className="px-4 py-3 bg-markee-bg border-l-4 border-markee-primary/30 text-markee-text text-sm rounded-r-lg">
                                <div className="flex items-center gap-1.5 text-xs text-markee-muted mb-1.5 font-semibold">
                                  <span>🪙</span>
                                  <span>{log.tokens_used || 0} tokens</span>
                                </div>
                                <PromptText text={log.prompt_content} />
                              </blockquote>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Load More Button */}
                {hasMore && (
                  <div className="text-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={logsLoading}
                      className="px-5 py-2 border border-markee-border rounded-xl bg-white text-markee-text hover:bg-markee-bg font-semibold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-60"
                    >
                      {logsLoading ? 'Đang tải...' : 'Tải thêm hoạt động'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end bg-markee-bg/10 shrink-0">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-text hover:bg-markee-bg rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Tạo dự án mới</h2>
              <p className="text-xs text-markee-muted mt-1">Vui lòng nhập tên cho dự án mới của bạn.</p>
            </div>
            <div>
              <label htmlFor="projectNameInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                Tên dự án
              </label>
              <input
                id="projectNameInput"
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Nhập tên dự án..."
                className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateProject();
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setProjectName('');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateProject}
                disabled={isCreating || !projectName.trim()}
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                {isCreating ? 'Đang tạo...' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
