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
  const [adminTab, setAdminTab] = useState<'overview' | 'library'>('overview');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  async function loadProfile() {
    setLoading(true);

    try {
      setProfile(await getCurrentUserProfile());
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
    <div className="min-h-screen bg-markee-bg text-markee-text">
      <header className="flex items-center justify-between border-b border-markee-border bg-white px-5 py-4 shadow-xs">
        <div className="flex items-center gap-3">
          <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-8 h-8 shrink-0" />
          <div>
            <div className="text-sm font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</div>
            <div className="text-xs text-markee-muted">
              {profile.displayName} · {roleLabel(profile.role)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="text-markee-primary border border-markee-primary hover:bg-markee-primary/10 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Hướng dẫn cài đặt</span>
          </button>
          <button
            type="button"
            onClick={() => signOut().then(() => setProfile(null))}
            className="rounded-lg border border-markee-border bg-white px-3 py-2 text-xs font-semibold text-markee-text hover:bg-markee-bg transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

      {profile.role === 'admin' ? (
        <div>
          <nav className="mx-auto flex max-w-7xl gap-2 px-5 pt-5">
            <button
              type="button"
              onClick={() => setAdminTab('overview')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                adminTab === 'overview'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
              }`}
            >
              Tổng quan & Duyệt bài
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('library')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                adminTab === 'library'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
              }`}
            >
              Thư viện kỹ năng
            </button>
          </nav>

          {adminTab === 'overview' ? (
            <AdminDashboard
              profile={profile}
              onSkillModerated={() => setLibraryRefreshKey((key) => key + 1)}
            />
          ) : (
            <UserDashboard profile={profile} refreshKey={libraryRefreshKey} />
          )}
        </div>
      ) : (
        <UserDashboard profile={profile} />
      )}
    </div>
  );
}
