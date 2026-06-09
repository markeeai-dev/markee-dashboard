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
const TOOL_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#f43f5e'];

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
      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
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
      line: 'bg-blue-500',
      card: 'from-blue-500/10 shadow-blue-950/30 hover:from-blue-500/15',
    },
    green: {
      line: 'bg-emerald-500',
      card: 'from-emerald-500/10 shadow-emerald-950/30 hover:from-emerald-500/15',
    },
    orange: {
      line: 'bg-orange-500',
      card: 'from-orange-500/10 shadow-orange-950/30 hover:from-orange-500/15',
    },
    purple: {
      line: 'bg-purple-500',
      card: 'from-purple-500/10 shadow-purple-950/30 hover:from-purple-500/15',
    },
    yellow: {
      line: 'bg-yellow-500',
      card: 'from-yellow-500/10 shadow-yellow-950/30 hover:from-yellow-500/15',
    },
  };
  const currentTone = tones[tone];

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-r via-slate-900/70 to-slate-900 p-6 pl-7 shadow-lg shadow-black/40 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-slate-800/40 hover:shadow-xl ${currentTone.card}`}
    >
      <div className={`absolute left-3 top-4 bottom-4 w-1 rounded-full ${currentTone.line}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
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
    <div className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-lg shadow-black/35 transition-all duration-300 ease-in-out hover:bg-slate-900 hover:shadow-xl hover:shadow-black/45">
      <h3 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</h3>
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
    ? 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-950/40'
    : 'bg-rose-500 hover:bg-rose-400 shadow-rose-950/40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/60">
        <div className={`mb-5 h-1.5 w-16 rounded-full ${isApprove ? 'bg-emerald-400' : 'bg-rose-400'}`} />
        <h2 className="text-lg font-bold text-white">
          {isApprove ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Bạn có chắc chắn muốn {actionText} kỹ năng <span className="font-semibold text-slate-200">"{title}"</span> không?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
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
    <article className="rounded-xl border border-slate-700 bg-slate-900/95 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-500 hover:bg-slate-900 hover:shadow-lg hover:shadow-indigo-950/20">
      <div className="mb-4 flex justify-between items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-semibold leading-6 text-slate-100">{skill.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {skill.category || 'Kỹ năng'} · {skill.authorName}
          </p>
        </div>
        {showStatus && <StatusPill status={skill.status} />}
      </div>

      <p className="mb-5 min-h-12 text-sm leading-6 text-slate-400">{summary || 'Chưa có mô tả nội dung.'}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400">
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
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                liked
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/20'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              Hữu ích
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-60"
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
    <aside className="self-start rounded-xl border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Kỹ năng nổi bật</h2>
      <div className="space-y-3">
        {skills.slice(0, 3).map((skill, index) => (
          <div key={skill.id} className="flex items-start gap-3 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-500/20 text-xs font-bold text-indigo-300">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-slate-200">{skill.title}</div>
              <div className="mt-1 text-xs text-slate-500">{skill.score} điểm tương tác</div>
            </div>
          </div>
        ))}
        {skills.length === 0 && <div className="text-xs text-slate-500">Chưa có kỹ năng đã duyệt.</div>}
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" />
        Trang trước
      </button>
      <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-400">
        Trang {page + 1} trên {totalPages}
      </div>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={isLastPage}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
        fetchTrendingSkills(3, profile.email),
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

  const displayedSkills = !isLibraryOnly && activeView === 'workspace' ? workspaceSkills : library.items;

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white">Thư viện kỹ năng</h1>
          <p className="text-xs text-slate-400">Xin chào {profile.displayName}. Danh sách chính chỉ hiển thị kỹ năng đã được duyệt.</p>
        </div>
        {!isLibraryOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveView('library')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                activeView === 'library' ? 'bg-indigo-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Thư viện chung
            </button>
            <button
              type="button"
              onClick={() => setActiveView('workspace')}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                activeView === 'workspace' ? 'bg-indigo-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              Không gian của tôi
            </button>
          </div>
        )}
      </section>

      {(isLibraryOnly || activeView === 'library') && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Tìm kiếm kỹ năng, danh mục hoặc người tạo..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-indigo-500"
          />
        </div>
      )}

      <div className={`grid gap-4 ${!isLibraryOnly && activeView === 'library' ? 'lg:grid-cols-[1fr_320px]' : ''}`}>
        <section className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">Đang tải dữ liệu...</div>
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
                <div className="rounded-lg border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">
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
          <h2 className="text-base font-bold text-white">Tổng quan quản trị</h2>
          <p className="text-xs text-slate-400">Theo dõi mức sử dụng AI và đóng góp kỹ năng của đội ngũ.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-900 p-1">
          {periodOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onPeriodChange(option.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                period === option.id ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:bg-slate-800'
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
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickMargin={12} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatNumber} tickMargin={12} width={48} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff' }}
                  formatter={(value: number) => [formatNumber(value), 'Token']}
                />
                <Area type="monotone" dataKey="tokens" stroke="#818cf8" strokeWidth={2} fill="url(#tokenGradient)" />
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
                  stroke="rgba(15, 23, 42, 0.35)"
                  strokeWidth={1}
                >
                  {metrics.toolUsage.map((entry, index) => (
                    <Cell key={entry.name} fill={TOOL_COLORS[index % TOOL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111827',
                    borderColor: '#374151',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                  }}
                  itemStyle={{ color: '#ffffff' }}
                  labelStyle={{ color: '#ffffff' }}
                  formatter={(value: number) => [formatNumber(value), 'Token']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-2">
            {metrics.toolUsage.slice(0, 5).map((tool, index) => (
              <div key={tool.name} className="flex items-center justify-between text-xs text-slate-400">
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

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Bảng xếp hạng đóng góp kỹ năng</h3>
        <div className="grid gap-2 md:grid-cols-5">
          {metrics.contributors.map((person, index) => (
            <div key={person.email} className="rounded-xl border border-slate-800 bg-slate-950 p-3">
              <div className="mb-3 flex items-center justify-between">
                <Medal
                  className={`h-5 w-5 ${
                    index === 0 ? 'text-yellow-300' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-300' : 'text-slate-600'
                  }`}
                />
                <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
              </div>
              <div className="truncate text-sm font-semibold text-slate-100">{person.name}</div>
              <div className="mt-1 text-xs text-slate-500">{person.count} kỹ năng đã duyệt</div>
            </div>
          ))}
          {metrics.contributors.length === 0 && <div className="text-sm text-slate-500">Chưa có dữ liệu đóng góp.</div>}
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
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d');
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
          <h1 className="text-lg font-bold text-white">Khu vực quản trị</h1>
          <p className="text-xs text-slate-400">Xin chào {profile.displayName}. Duyệt kỹ năng và theo dõi hoạt động AI của đội ngũ.</p>
        </div>
      </section>

      <AdminOverview metrics={metrics} period={period} onPeriodChange={setPeriod} />

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Kỹ năng chờ duyệt</h2>
          <div className="space-y-2">
            {loading && <div className="text-xs text-slate-500">Đang tải...</div>}
            {!loading &&
              pendingSkills.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => setSelectedSkillId(skill.id)}
                  className={`block w-full rounded-lg border p-3 text-left ${
                    selectedSkill?.id === skill.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 bg-slate-950'
                  }`}
                >
                  <div className="truncate text-xs font-semibold text-slate-200">{skill.title}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {skill.category || 'Kỹ năng'} · {skill.authorName}
                  </div>
                </button>
              ))}
            {!loading && pendingSkills.length === 0 && <div className="text-xs text-slate-500">Không còn kỹ năng chờ duyệt.</div>}
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          {selectedSkill ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">{selectedSkill.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedSkill.category || 'Prompt'} · {selectedSkill.authorName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingAction('rejected')}
                    disabled={actionBusy}
                    className="rounded-lg border border-rose-800 bg-rose-950 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900 disabled:opacity-60"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction('approved')}
                    disabled={actionBusy}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                  >
                    Phê duyệt
                  </button>
                </div>
              </div>
              <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs leading-6 text-slate-300">
                {selectedSkill.markdown_content}
              </pre>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-slate-500">Chọn một kỹ năng chờ duyệt để xem trước.</div>
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
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">Đang kiểm tra đăng nhập...</div>;
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
        <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 text-center">
          <h1 className="text-lg font-bold text-white">Markee AI Ops</h1>
          <p className="mt-2 text-sm text-slate-400">Đăng nhập Google để mở dashboard theo role.</p>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="mt-5 w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400"
          >
            Đăng nhập Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-4">
        <div>
          <div className="text-sm font-bold text-white">Markee AI Ops</div>
          <div className="text-xs text-slate-500">
            {profile.displayName} · {roleLabel(profile.role)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border border-indigo-500/30 hover:border-indigo-500/50"
          >
            <BookOpen className="w-4 h-4" />
            <span>Hướng dẫn cài đặt</span>
          </button>
          <button
            type="button"
            onClick={() => signOut().then(() => setProfile(null))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
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
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                adminTab === 'overview'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/30'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              Tổng quan & Duyệt bài
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('library')}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                adminTab === 'library'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-950/30'
                  : 'border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
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
            <UserDashboard profile={profile} refreshKey={libraryRefreshKey} mode="library-only" />
          )}
        </div>
      ) : (
        <UserDashboard profile={profile} />
      )}
    </div>
  );
}
