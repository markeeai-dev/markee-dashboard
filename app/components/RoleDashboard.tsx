'use client';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */


import { useEffect, useMemo, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Download, Medal, Search, ThumbsUp, BookOpen, Plus, X, Folder, User, Edit, Trash2, ArrowLeftRight, Settings } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
  fetchLibraryCounts,
  removeVietnameseTones,
  type LibraryCounts,
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
  createNewProject,
  type AILicense,
  type AIUsageStat,
  fetchAILicenses,
  fetchAIUsageStats,
  createAILicense,
  renewAILicense,
  fetchUserAILicenses,
  fetchUserAIUsageStats,
  updateProjectSummary,
  fetchTeamTracks,
  fetchCurationStats,
  cancelAILicense,
  updateAILicense,
  deleteAILicense,
  fetchProjectWIPMembers,
  fetchProjectWIPsForUser,
  fetchProjectWIPs,
  fetchMyWIPs,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';
import { DEPARTMENT_TRACKS, mapTrackDisplayToDbValue } from '@/lib/org-structure';
import UserGuideModal from './UserGuideModal';
import AIChat from './AIChat/AIChat';

const PAGE_SIZE = 6;
const TOOL_COLORS = ['#E3000F', '#FF3344', '#f59e0b', '#a855f7', '#059669', '#0d9488'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
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

  return <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{label}</span>;
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
      className={`group relative overflow-hidden rounded-xl border border-markee-border bg-linear-to-r p-6 pl-7 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md ${currentTone.card}`}
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
          Bạn có chắc chắn muốn {actionText} kỹ năng <span className="font-semibold text-markee-text">&quot;{title}&quot;</span> không?
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

function getSkillTrackName(skill: SkillCard): string {
  return skill.team_track || 'Khác';
}

function SkillCardItem({
  skill,
  userEmail,
  showStatus = false,
  allowVoting = true,
  onPreview,
}: {
  skill: SkillCard;
  userEmail: string;
  showStatus?: boolean;
  allowVoting?: boolean;
  onPreview: () => void;
}) {
  const [likes, setLikes] = useState(skill.likes_count || 0);
  const [downloads, setDownloads] = useState(skill.downloads_count || 0);
  const [liked, setLiked] = useState(Boolean(skill.likedByCurrentUser));
  const [busyAction, setBusyAction] = useState<'vote' | 'download' | null>(null);
  const summary = stripMarkdown(skill.markdown_content || '');

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

  const rawType = skill.skill_type || 'Workflow';
  const typeName = rawType === 'context_pack' ? 'Context Pack' : rawType.charAt(0).toUpperCase() + rawType.slice(1);
  const trackName = getSkillTrackName(skill);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between h-full min-h-55">
      <div>
        {/* Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
              {typeName}
            </span>
            <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
              {showStatus ? skill.status : 'APPROVED'}
            </span>
          </div>
        </div>

        {/* Title & Body */}
        <div className="mt-3.5">
          <h3
            onClick={onPreview}
            className="font-bold text-base text-gray-900 line-clamp-1 hover:text-markee-primary transition-colors cursor-pointer"
          >
            {skill.title}
          </h3>
          <p className="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed min-h-10">
            {summary || 'Chưa có mô tả nội dung.'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-400">
          <div className="flex items-center gap-1">
            <Folder className="h-3 w-3 text-gray-400" />
            <span className="font-medium text-gray-500">{trackName}</span>
          </div>
          <span className="text-gray-300">•</span>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-gray-400" />
            <span className="text-gray-500 truncate max-w-25">{skill.authorName}</span>
          </div>
          <span className="text-gray-300">•</span>
          <span className="font-mono text-gray-400">v1.0.0</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onPreview}
            className="flex-1 sm:flex-none inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Preview
          </button>
          {skill.status !== 'pending' && (
            <button
              type="button"
              onClick={handleDownload}
              disabled={busyAction !== null}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-markee-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-markee-hover disabled:opacity-60 cursor-pointer"
            >
              Tải xuống
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function TrendingSkills({ skills }: { skills: SkillCard[] }) {
  return (
    <aside className="self-start rounded-xl border border-markee-border bg-white p-4 w-full">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-markee-muted">Kỹ năng nổi bật</h2>
      <div className="space-y-3 max-h-87.5 overflow-y-auto pr-1">
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
         {page + 1} / {totalPages}
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

  const [workspaceTab, setWorkspaceTab] = useState<'approved' | 'pending' | 'wip'>('approved');
  const [wips, setWips] = useState<AISession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [wipPage, setWipPage] = useState(0);

  const [activeEditWip, setActiveEditWip] = useState<AISession | null>(null);
  const [editWipTitle, setEditWipTitle] = useState('');
  const [editWipContent, setEditWipContent] = useState('');
  const [editWipTrack, setEditWipTrack] = useState('');
  const [isEditingWip, setIsEditingWip] = useState(false);

  const [activeMoveWip, setActiveMoveWip] = useState<AISession | null>(null);
  const [moveWipProjectId, setMoveWipProjectId] = useState<number | ''>('');
  const [isMovingWip, setIsMovingWip] = useState(false);

  const [activeDeleteWip, setActiveDeleteWip] = useState<AISession | null>(null);
  const [isDeletingWip, setIsDeletingWip] = useState(false);

  const [deletingWipIds, setDeletingWipIds] = useState<number[]>([]);
  const [wipToast, setWipToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  function showWipToast(message: string, type: 'success' | 'error' | 'loading', duration = 3000) {
    setWipToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setWipToast(current => current?.message === message ? null : current);
      }, duration);
    }
  }

  async function handleDeleteWip() {
    if (!activeDeleteWip) return;
    setIsDeletingWip(true);
    try {
      const { error } = await supabase.from('skill_library').delete().eq('id', activeDeleteWip.id).eq('author_id', profile.email);
      if (error) throw error;

      showWipToast('Xóa phiên AI thành công!', 'success');
      
      const targetId = activeDeleteWip.id;
      setDeletingWipIds(prev => [...prev, targetId]);
      setActiveDeleteWip(null);

      setTimeout(() => {
        setWips(prev => prev.filter(w => w.id !== targetId));
        setDeletingWipIds(prev => prev.filter(id => id !== targetId));
      }, 500);
    } catch (err) {
      console.error('Error deleting WIP:', err);
      showWipToast('Lỗi khi xóa phiên AI', 'error');
    } finally {
      setIsDeletingWip(false);
    }
  }

  async function handleMoveWip() {
    if (!activeMoveWip || !moveWipProjectId) return;
    setIsMovingWip(true);
    try {
      const { error } = await supabase.from('skill_library').update({ project_id: moveWipProjectId }).eq('id', activeMoveWip.id).eq('author_id', profile.email);
      if (error) throw error;

      showWipToast('Chuyển dự án thành công!', 'success');
      
      const targetId = activeMoveWip.id;
      setDeletingWipIds(prev => [...prev, targetId]);
      setActiveMoveWip(null);
      setMoveWipProjectId('');

      setTimeout(() => {
        setWips(prev => prev.filter(w => w.id !== targetId));
        setDeletingWipIds(prev => prev.filter(id => id !== targetId));
      }, 500);
    } catch (err) {
      console.error('Error moving WIP:', err);
      showWipToast('Lỗi khi chuyển dự án', 'error');
    } finally {
      setIsMovingWip(false);
    }
  }

  async function handleEditWip() {
    if (!activeEditWip) return;
    setIsEditingWip(true);
    try {
      const { error } = await supabase
        .from('skill_library')
        .update({ 
          title: editWipTitle, 
          markdown_content: editWipContent, 
          team_track: editWipTrack 
        })
        .eq('id', activeEditWip.id)
        .eq('author_id', profile.email);
      
      if (error) throw error;

      showWipToast('Cập nhật phiên AI thành công!', 'success');

      setWips(prev => prev.map(w => w.id === activeEditWip.id ? {
        ...w,
        title: editWipTitle,
        prompt_content: editWipContent,
        team_track: editWipTrack,
      } : w));

      setActiveEditWip(null);
    } catch (err) {
      console.error('Error editing WIP:', err);
      showWipToast('Lỗi khi sửa phiên AI', 'error');
    } finally {
      setIsEditingWip(false);
    }
  }


  const [selectedTrack, setSelectedTrack] = useState('Tất cả');
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState('Tất cả');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<SkillCard | null>(null);

  const [uploadType, setUploadType] = useState('Prompt');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadProject, setUploadProject] = useState('');
  const [uploadContent, setUploadContent] = useState('');

  const [counts, setCounts] = useState<LibraryCounts>({ byType: {}, byTrack: {}, total: 0 });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploadModalOpen(false);
    setUploadTitle('');
    setUploadContent('');
  };

  const approvedWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'approved');
  }, [workspaceSkills]);

  const pendingWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'pending');
  }, [workspaceSkills]);

  const loadRequestIdRef = useRef(0);

  async function loadInitialData() {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);

    try {
      const dbTrack = mapTrackDisplayToDbValue(selectedTrack);
      const isWorkspace = !isLibraryOnly && activeView === 'workspace';
      const countsPromise = fetchLibraryCounts(isWorkspace ? profile.email : undefined);

      if (isLibraryOnly) {
        const [skills, libCounts] = await Promise.all([
          fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm, dbTrack, selectedType),
          countsPromise,
        ]);
        if (requestId !== loadRequestIdRef.current) return;
        setLibrary(skills);
        setCounts(libCounts);
        return;
      }

      const [skills, trending, workspace, userWips, allProjects, libCounts] = await Promise.all([
        fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm, dbTrack, selectedType),
        fetchTrendingSkills(5, profile.email),
        fetchMyWorkspaceSkills(profile.email),
        fetchMyWIPs(profile.email),
        fetchProjects(profile.email, profile.role === 'admin'),
        countsPromise,
      ]);

      if (requestId !== loadRequestIdRef.current) return;
      setLibrary(skills);
      setTrendingSkills(trending);
      setWorkspaceSkills(workspace);
      setWips(userWips);
      setProjects(allProjects);
      setCounts(libCounts);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [profile.email, refreshKey, page, debouncedSearchTerm, isLibraryOnly, selectedTrack, selectedType, activeView]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setWipPage(0);
  }, [workspaceTab]);

  const displayedSkills = !isLibraryOnly && activeView === 'workspace'
    ? (workspaceTab === 'approved' 
        ? approvedWorkspaceSkills.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) 
        : pendingWorkspaceSkills.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE))
    : library.items;

  const WIP_PAGE_SIZE = 8;
  const displayedWips = useMemo(() => {
    const start = wipPage * WIP_PAGE_SIZE;
    return wips.slice(start, start + WIP_PAGE_SIZE);
  }, [wips, wipPage]);

  return (
    <main className="mx-auto max-w-7xl p-5">
      <div className="flex h-full w-full gap-6">
        {/* Left Column: Sidebar Filters */}
        <aside className="w-64 shrink-0 pr-2 space-y-6 hidden md:block border-r border-gray-100">
          {/* Nhóm 1 - LOẠI TÀI SẢN */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Loại tài sản</h3>
            <div className="flex flex-col gap-1">
              {["Tất cả", "Prompt", "Skill", "SOP", "Context Pack", "Workflow", "Checklist"].map((type) => {
                const isActive = selectedType === type;
                const count = type === "Tất cả" ? counts.total : (counts.byType[type.toLowerCase()] || 0);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setPage(0);
                      setSelectedType(type);
                    }}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between w-full ${
                      isActive
                        ? "font-bold text-markee-primary bg-red-50"
                        : "text-gray-500 hover:text-markee-primary hover:bg-gray-50"
                    }`}
                  >
                    <span>{type}</span>
                    <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-medium py-0.5 px-2 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nhóm 2 - PHÒNG BAN */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2.5">Phòng ban</h3>
            <div className="flex flex-col gap-1">
              {/* "Tất cả" button */}
              <button
                key="all"
                type="button"
                onClick={() => {
                  setPage(0);
                  setSelectedTrack('Tất cả');
                  setSelectedPosition(null);
                  setExpandedTracks(new Set());
                }}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between w-full ${
                  selectedTrack === 'Tất cả'
                    ? "font-bold text-markee-primary bg-red-50"
                    : "text-gray-500 hover:text-markee-primary hover:bg-gray-50"
                }`}
              >
                <span className="truncate mr-2">Tất cả</span>
                <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-medium py-0.5 px-2 rounded-full shrink-0">
                  {counts.total}
                </span>
              </button>

              {/* Department tracks with expandable positions */}
              {DEPARTMENT_TRACKS.map((track) => {
                const isTrackActive = selectedTrack === track.displayLabel;
                const isExpanded = expandedTracks.has(track.dbValue);
                const trackCount = counts.byTrack[track.dbValue] || 0;

                return (
                  <div key={track.dbValue}>
                    {/* Track header */}
                    <button
                      type="button"
                      onClick={() => {
                        if (isTrackActive && selectedPosition === null) {
                          // Already filtering by this entire track — just toggle expand/collapse
                          setExpandedTracks((prev) => {
                            const next = new Set(prev);
                            if (next.has(track.dbValue)) {
                              next.delete(track.dbValue);
                            } else {
                              next.add(track.dbValue);
                            }
                            return next;
                          });
                        } else {
                          // Filter by this entire track + expand positions
                          setPage(0);
                          setSelectedTrack(track.displayLabel);
                          setSelectedPosition(null);
                          setExpandedTracks((prev) => {
                            const next = new Set(prev);
                            next.add(track.dbValue);
                            return next;
                          });
                        }
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between w-full ${
                        isTrackActive && !selectedPosition
                          ? "font-bold text-markee-primary bg-red-50"
                          : "text-gray-500 hover:text-markee-primary hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate mr-2">
                        <ChevronDown
                          size={12}
                          className={`shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                        />
                        <span>{track.displayLabel}</span>
                      </span>
                      <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-medium py-0.5 px-2 rounded-full shrink-0">
                        {trackCount}
                      </span>
                    </button>

                    {/* Position list (expandable) */}
                    {isExpanded && (
                      <div className="ml-5 border-l border-gray-100 pl-3 mt-0.5 space-y-0.5">
                        {track.positions.map((pos) => {
                          const isPosActive = selectedPosition === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => {
                                setPage(0);
                                setSelectedTrack(track.displayLabel);
                                setSelectedPosition(pos.id);
                              }}
                              className={`text-left px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer block w-full ${
                                isPosActive
                                  ? "font-semibold text-markee-primary bg-red-50 border-l-2 border-markee-primary"
                                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-l-2 border-transparent"
                              }`}
                            >
                              {pos.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* "Khác" button (flat, no positions) */}
              <button
                key="other"
                type="button"
                onClick={() => {
                  setPage(0);
                  setSelectedTrack('Khác');
                  setSelectedPosition(null);
                  setExpandedTracks(new Set());
                }}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between w-full ${
                  selectedTrack === 'Khác'
                    ? "font-bold text-markee-primary bg-red-50"
                    : "text-gray-500 hover:text-markee-primary hover:bg-gray-50"
                }`}
              >
                <span className="truncate mr-2">Khác</span>
                <span className="ml-auto bg-slate-100 text-slate-500 text-[10px] font-medium py-0.5 px-2 rounded-full shrink-0">
                  {counts.byTrack["Khác"] || 0}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Right Column: Main Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header section */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-markee-text">Thư viện kỹ năng</h1>
              <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Danh sách chính chỉ hiển thị kỹ năng đã được duyệt.</p>
            </div>
            {!isLibraryOnly && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('library');
                    setPage(0);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'library' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                  }`}
                >
                  Thư viện chung
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('workspace');
                    setPage(0);
                  }}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'workspace' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                  }`}
                >
                  Không gian của tôi
                </button>
              </div>
            )}
          </section>

          {/* Search Bar & Buttons */}
          {(isLibraryOnly || activeView === 'library') && (
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-markee-sub" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Tìm kiếm kỹ năng, danh mục hoặc người tạo..."
                  className="w-full rounded-xl border border-markee-border bg-white py-3 pl-11 pr-4 text-sm text-markee-text outline-none transition-colors placeholder:text-markee-sub focus:border-markee-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-press inline-flex items-center gap-1.5 rounded-xl bg-markee-primary px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-markee-hover cursor-pointer shadow-sm shrink-0"
              >
                <Plus className="h-4 w-4" />
                Upload Asset
              </button>
            </div>
          )}

          <div className="space-y-4">
            {!isLibraryOnly && activeView === 'workspace' && (
              <div className="flex gap-2 border-b border-markee-border pb-3">
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('approved');
                    setPage(0);
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    workspaceTab === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                  }`}
                >
                  Kỹ năng đã duyệt ({approvedWorkspaceSkills.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('pending');
                    setPage(0);
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    workspaceTab === 'pending'
                      ? 'bg-amber-500/10 text-amber-700 border border-amber-500/30'
                      : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                  }`}
                >
                  Kỹ năng đang chờ duyệt ({pendingWorkspaceSkills.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceTab('wip');
                    setWipPage(0);
                  }}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    workspaceTab === 'wip'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
                  }`}
                >
                  Tóm tắt phiên AI ({wips.length})
                </button>
              </div>
            )}
            
            {loading ? (
              <div className="rounded-lg border border-markee-border bg-white p-8 text-center text-sm text-markee-muted">Đang tải dữ liệu...</div>
            ) : (
              <>
                {!isLibraryOnly && activeView === 'workspace' && workspaceTab === 'wip' ? (
                  <>
                    <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
                      {displayedWips.map((wip) => {
                        const isDeleting = deletingWipIds.includes(wip.id);
                        const project = projects.find(p => p.id === wip.project_id);
                        return (
                          <div 
                            key={wip.id} 
                            className={`bg-white border border-markee-border rounded-xl p-5 shadow-xs relative flex flex-col justify-between transition-all duration-500 ease-out hover:shadow-md ${
                              isDeleting 
                                ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden' 
                                : ''
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="text-xs text-markee-muted flex items-center gap-1.5 flex-wrap">
                                    <span>📅</span>
                                    <span>{new Date(wip.created_at).toLocaleDateString('vi-VN')}</span>
                                    {wip.team_track && (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-100">
                                        {wip.team_track}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-sm font-bold text-markee-text leading-snug mt-1">
                                    {wip.title || 'Không có tiêu đề'}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  <button
                                    type="button"
                                    title="Sửa"
                                    onClick={() => {
                                      setActiveEditWip(wip);
                                      setEditWipTitle(wip.title || '');
                                      setEditWipContent(wip.prompt_content || '');
                                      setEditWipTrack(wip.team_track || '');
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white"
                                  >
                                    <Edit className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Chuyển Dự án"
                                    onClick={() => {
                                      setActiveMoveWip(wip);
                                      setMoveWipProjectId('');
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white"
                                  >
                                    <ArrowLeftRight className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Xóa"
                                    onClick={() => {
                                      setActiveDeleteWip(wip);
                                    }}
                                    className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-red-600 cursor-pointer bg-white"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3.5 p-3 rounded-lg bg-markee-bg text-markee-text text-xs font-mono line-clamp-4 overflow-hidden text-ellipsis whitespace-pre-wrap leading-relaxed border border-markee-border/60">
                                {wip.prompt_content ? wip.prompt_content : 'Không có nội dung'}
                              </div>
                            </div>

                            <div className="border-t border-markee-border/60 mt-4 pt-3 flex items-center justify-between text-[11px] text-markee-muted">
                              <div className="flex items-center gap-1.5">
                                <span>📁 Dự án:</span>
                                <span className="font-semibold text-markee-text truncate max-w-37.5">{project?.name || 'Khác / Chưa phân loại'}</span>
                              </div>
                              <div>
                                🪙 <span className="font-semibold">{wip.tokens_used || 0}</span> tokens
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {wips.length > WIP_PAGE_SIZE && (
                      <div className="mt-6 flex justify-center">
                        <PaginationControls
                          page={wipPage}
                          total={wips.length}
                          pageSize={WIP_PAGE_SIZE}
                          onPageChange={setWipPage}
                        />
                      </div>
                    )}

                    {wips.length === 0 && (
                      <div className="rounded-lg border border-markee-border bg-white p-8 text-center text-sm text-markee-muted">
                        Chưa có phiên AI nào được ghi nhận.
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
                      {displayedSkills.map((skill) => (
                        <SkillCardItem
                          key={skill.id}
                          skill={skill}
                          userEmail={profile.email}
                          showStatus={!isLibraryOnly && activeView === 'workspace'}
                          allowVoting={isLibraryOnly || activeView === 'library'}
                          onPreview={() => setPreviewSkill(skill)}
                        />
                      ))}
                    </div>

                    {displayedSkills.length === 0 && (
                      <div className="rounded-lg border border-markee-border bg-white p-8 text-center text-sm text-markee-muted">
                        Chưa có skill để hiển thị.
                      </div>
                    )}
                  </>
                )}

                {(isLibraryOnly || activeView === 'library') && library.total > PAGE_SIZE && (
                  <PaginationControls page={page} total={library.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
                )}
                {!isLibraryOnly && activeView === 'workspace' && workspaceTab === 'approved' && approvedWorkspaceSkills.length > PAGE_SIZE && (
                  <PaginationControls page={page} total={approvedWorkspaceSkills.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
                )}
                {!isLibraryOnly && activeView === 'workspace' && workspaceTab === 'pending' && pendingWorkspaceSkills.length > PAGE_SIZE && (
                  <PaginationControls page={page} total={pendingWorkspaceSkills.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload Asset Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200 modal-backdrop">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-markee-primary" />
                + Upload Asset — 2 Step Flow
              </h3>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-5">
              {/* Row 1 (Steps) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-red-50/50 border border-red-100 p-3 flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-markee-primary text-white text-[10px] font-bold flex items-center justify-center">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-900">Step 1: Paste content</div>
                    <div className="text-[10px] text-gray-500">Dán nội dung tài sản thô</div>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 flex items-center gap-2.5 opacity-70">
                  <div className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 text-[10px] font-bold flex items-center justify-center">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-bold text-gray-700">Step 2: AI classify & governance</div>
                    <div className="text-[10px] text-gray-500">AI phân loại và kiểm duyệt</div>
                  </div>
                </div>
              </div>

              {/* Row 2 (Asset Type - Clickable) */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  ASSET TYPE GỢI Ý
                </label>
                <div className="flex flex-wrap gap-2">
                  {["Prompt", "Skill", "SOP", "KB", "Context Pack", "Workflow", "Checklist"].map((type) => {
                    const isActive = uploadType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setUploadType(type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                          isActive
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3 (Inputs) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Nhập tiêu đề tài sản..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    PROJECT
                  </label>
                  <select
                    value={uploadProject}
                    onChange={(e) => setUploadProject(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Không có dự án</option>
                    <option value="Project Alpha">Project Alpha</option>
                    <option value="Project Beta">Project Beta</option>
                    <option value="System SOC Portal">System SOC Portal</option>
                    <option value="Marketing Campaign A">Marketing Campaign A</option>
                  </select>
                </div>
              </div>

              {/* Row 4 (Textarea) */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  CONTENT *
                </label>
                <textarea
                  required
                  rows={6}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Dán hoặc nhập nội dung tài sản chi tiết vào đây..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <div />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setUploadTitle('');
                      setUploadContent('');
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                  >
                    AI classify -&gt;
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Asset Modal */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200 modal-backdrop">
          <div className="w-full max-w-3xl h-[85vh] rounded-xl bg-white p-6 shadow-xl relative flex flex-col justify-between animate-in zoom-in-95 duration-200">
            <div>
              <button
                onClick={() => setPreviewSkill(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex flex-wrap gap-2 items-center mb-3">
                <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                  {previewSkill.skill_type || 'Workflow'}
                </span>
                <span className="text-xs text-gray-400">·</span>
                <span className="text-xs text-gray-500 font-medium">Tác giả: {previewSkill.authorName}</span>
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 mb-4">{previewSkill.title}</h3>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 leading-relaxed font-sans mb-5">
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-800 leading-6">
                {previewSkill.markdown_content}
              </pre>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 shrink-0">
              <button
                onClick={() => setPreviewSkill(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  downloadSkillMarkdown(previewSkill);
                  setPreviewSkill(null);
                }}
                className="rounded-lg bg-markee-primary px-4 py-2 text-xs font-semibold text-white hover:bg-markee-hover transition-colors cursor-pointer"
              >
                Tải về Markdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit WIP Modal */}
      {activeEditWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Sửa tóm tắt phiên AI</h3>
              <button
                type="button"
                onClick={() => setActiveEditWip(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label htmlFor="userEditWipTitleInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Tiêu đề phiên AI
                </label>
                <input
                  id="userEditWipTitleInput"
                  type="text"
                  value={editWipTitle}
                  onChange={(e) => setEditWipTitle(e.target.value)}
                  placeholder="Nhập tiêu đề..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                />
              </div>

              <div>
                <label htmlFor="userEditWipTrackSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Phòng ban (Track)
                </label>
                <select
                  id="userEditWipTrackSelect"
                  value={editWipTrack}
                  onChange={(e) => setEditWipTrack(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                >
                  <option value="">Khác (Chưa phân loại)</option>
                  <option value="Track 1: SI Delivery">Track 1: SI Delivery</option>
                  <option value="Track 2: Marketing">Track 2: Marketing</option>
                  <option value="Track 3: Dev + DevOps">Track 3: Dev + DevOps</option>
                  <option value="Track 4: AI Team">Track 4: AI Team</option>
                  <option value="Track 5: Sales">Track 5: Sales</option>
                </select>
              </div>

              <div>
                <label htmlFor="userEditWipContentInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Nội dung Markdown
                </label>
                <textarea
                  id="userEditWipContentInput"
                  rows={10}
                  value={editWipContent}
                  onChange={(e) => setEditWipContent(e.target.value)}
                  placeholder="Nhập nội dung markdown của phiên AI..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary font-mono"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveEditWip(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleEditWip}
                disabled={isEditingWip || !editWipTitle.trim() || !editWipContent.trim()}
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isEditingWip ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move WIP Modal */}
      {activeMoveWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Chuyển Dự án</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveMoveWip(null);
                  setMoveWipProjectId('');
                }}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-markee-muted leading-relaxed">
                Bạn đang chuyển phiên AI <span className="font-bold text-markee-text">&quot;{activeMoveWip.title || 'Không có tiêu đề'}&quot;</span> sang một dự án khác.
              </p>
              
              <div>
                <label htmlFor="userMoveWipProjectSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Chọn Dự án đích
                </label>
                <select
                  id="userMoveWipProjectSelect"
                  value={moveWipProjectId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMoveWipProjectId(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                >
                  <option value="">-- Chọn Dự án --</option>
                  {projects
                    .filter((p) => p.id !== activeMoveWip.project_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveMoveWip(null);
                  setMoveWipProjectId('');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleMoveWip}
                disabled={isMovingWip || !moveWipProjectId}
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isMovingWip ? 'Đang chuyển...' : 'Xác nhận Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete WIP Modal */}
      {activeDeleteWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-red-600">Xác nhận Xóa</h3>
              <button
                type="button"
                onClick={() => setActiveDeleteWip(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-xs text-markee-muted leading-relaxed">
                Bạn có chắc chắn muốn xóa phiên AI <span className="font-bold text-markee-text">&quot;{activeDeleteWip.title || 'Không có tiêu đề'}&quot;</span>? 
                Hành động này không thể hoàn tác.
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveDeleteWip(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteWip}
                disabled={isDeletingWip}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingWip ? 'Đang xóa...' : 'Xác nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {wipToast && (
        <div className={`fixed bottom-5 right-5 z-60 px-4.5 py-3 rounded-xl shadow-xl flex items-center gap-2 border text-xs font-semibold animate-in slide-in-from-bottom-5 duration-300 ${
          wipToast.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : wipToast.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {wipToast.type === 'success' && <span>✅</span>}
          {wipToast.type === 'error' && <span>❌</span>}
          {wipToast.type === 'loading' && <span className="animate-spin">⏳</span>}
          <span>{wipToast.message}</span>
        </div>
      )}
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
        <StatCard label="Chi phí ước tính" value={formatCurrency(metrics.costUsd)} note="Token × 0.015 USD (Quy đổi)" tone="green" />
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
        <div className="max-h-80 overflow-y-auto pr-1">
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-5">
            {metrics.contributors.map((person, index) => (
              <div key={person.email} className="rounded-xl border border-markee-border bg-markee-bg p-3 flex flex-col justify-between min-h-22.5 transition-all hover:border-markee-sub">
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
        <div className="rounded-lg border border-markee-border bg-white p-4 h-[calc(100vh-200px)] overflow-y-auto">
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

        <div className="rounded-lg border border-markee-border bg-white p-4 h-[calc(100vh-200px)] flex flex-col">
          {selectedSkill ? (
            <>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 shrink-0">
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
              <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded-lg border border-markee-border bg-markee-bg p-4 text-xs leading-6 text-markee-text">
                {selectedSkill.markdown_content}
              </pre>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-markee-sub my-auto">Chọn một kỹ năng chờ duyệt để xem trước.</div>
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
  const [activeTab, setActiveTab] = useState<'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat'>('overview');
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

          <button
            type="button"
            onClick={() => setActiveTab('ai_chat')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'ai_chat'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
            }`}
          >
            <span>💬</span>
            <span>Trò chuyện cùng AI</span>
          </button>

          {profile.role === 'user' && (
            <button
              type="button"
              onClick={() => setActiveTab('assets')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'assets'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
            >
              <span>💳</span>
              <span>Tài khoản AI của tôi</span>
            </button>
          )}

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
              <button
                type="button"
                onClick={() => setActiveTab('knowledge_hub')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'knowledge_hub'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
              >
                <span>🧠</span>
                <span>Kho Tri thức</span>
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
        <div className={`flex-1 ${activeTab === 'ai_chat' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          {activeTab === 'ai_chat' && (
            <AIChat profile={profile} />
          )}
          {activeTab === 'overview' && profile.role === 'admin' && (
            <AdminDashboard
              profile={profile}
              onSkillModerated={() => setLibraryRefreshKey((key) => key + 1)}
            />
          )}

          {activeTab === 'library' && (
            <UserDashboard profile={profile} refreshKey={libraryRefreshKey} />
          )}

          {activeTab === 'assets' && (
            <MyAssetsView profile={profile} />
          )}

          {activeTab === 'projects' && profile.role === 'admin' && (
            <ProjectManagement profile={profile} />
          )}

          {activeTab === 'users' && profile.role === 'admin' && (
            <UserManagement />
          )}

          {activeTab === 'knowledge_hub' && profile.role === 'admin' && (
            <KnowledgeHubDashboard />
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
  const [activeTab, setActiveTab] = useState<'users' | 'licenses'>('users');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // License management states
  const [licenses, setLicenses] = useState<AILicense[]>([]);
  const [usageStats, setUsageStats] = useState<AIUsageStat[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<AILicense | null>(null);
  const [isCreatingLicense, setIsCreatingLicense] = useState(false);

  // Create license form state
  const [newLicenseEmail, setNewLicenseEmail] = useState('');
  const [newLicenseTool, setNewLicenseTool] = useState('ChatGPT');
  const [newLicensePlan, setNewLicensePlan] = useState('Pro');
  const [newLicenseCost, setNewLicenseCost] = useState('500000');
  const [newLicenseExpiry, setNewLicenseExpiry] = useState('');

  // Edit license form state
  const [editTool, setEditTool] = useState('ChatGPT');
  const [editPlan, setEditPlan] = useState('Pro');
  const [editCost, setEditCost] = useState('500000');
  const [editExpiry, setEditExpiry] = useState('');

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

  async function loadLicenses() {
    setLicensesLoading(true);
    try {
      const [lics, stats] = await Promise.all([fetchAILicenses(), fetchAIUsageStats()]);
      
      const licensesWithUsage = await Promise.all(
        lics.map(async (license) => {
          const { data: usageData } = await supabase
            .from('ai_usage_stats')
            .select('weekly_used')
            .eq('email', license.email)
            .ilike('ai_tool', license.ai_tool) // BẮT BUỘC dùng ilike để bỏ qua phân biệt hoa/thường
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Ép kiểu Text "19%" thành Number 19 để truyền vào Progress Bar
          let usageNumber = 0;
          if (usageData && usageData.weekly_used) {
             usageNumber = parseInt(usageData.weekly_used.replace('%', '')) || 0;
          }

          return {
            ...license,
            usagePercent: usageNumber,
            weekly_used: usageData?.weekly_used || '0%'
          };
        })
      );
      
      setLicenses(licensesWithUsage);
      setUsageStats(stats);
    } catch (e) {
      console.error(e);
      showToast('Không thể tải thông tin bản quyền AI', 'error');
    } finally {
      setLicensesLoading(false);
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

  async function handleCreateLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!newLicenseEmail.trim() || !newLicenseExpiry) {
      showToast('Vui lòng nhập đầy đủ thông tin', 'error');
      return;
    }

    if (isCreatingLicense) return;
    setIsCreatingLicense(true);
    showToast('Đang tạo bản quyền...', 'loading');
    try {
      const newLic = await createAILicense({
        email: newLicenseEmail.trim(),
        ai_tool: newLicenseTool,
        plan_name: newLicensePlan,
        monthly_cost: Number(newLicenseCost) || 0,
        expiration_date: newLicenseExpiry,
      });

      setLicenses(prev => [newLic, ...prev]);
      showToast('Cấp mới bản quyền thành công!', 'success');
      setIsCreateModalOpen(false);
      setNewLicenseEmail('');
      setNewLicenseTool('ChatGPT');
      setNewLicensePlan('Pro');
      setNewLicenseCost('500000');
      setNewLicenseExpiry('');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tạo bản quyền AI', 'error');
    } finally {
      setIsCreatingLicense(false);
    }
  }

  async function handleUpdateLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLicense || !editExpiry) {
      showToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    showToast('Đang cập nhật bản quyền...', 'loading');
    try {
      const isPersonal = selectedLicense.plan_name.includes('(Cá nhân)');
      const finalPlanName = isPersonal ? `${editPlan} (Cá nhân)` : editPlan;

      const updatedLic = await updateAILicense(selectedLicense.id, {
        ai_tool: editTool,
        plan_name: finalPlanName,
        monthly_cost: Number(editCost) || 0,
        expiration_date: editExpiry,
      });
      setLicenses(prev => prev.map(lic => lic.id === selectedLicense.id ? { ...updatedLic, usagePercent: lic.usagePercent } : lic));
      
      // Clear requested status
      localStorage.removeItem(`license_requested_${selectedLicense.id}`);

      showToast('Cập nhật bản quyền thành công!', 'success');
      setIsRenewModalOpen(false);
      setSelectedLicense(null);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật bản quyền', 'error');
    }
  }

  useEffect(() => {
    loadUsers();
    loadLicenses();
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadLicenses();
    };
    window.addEventListener('focus', handleFocus);

    const channel = supabase
      .channel('admin-license-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage_stats'
        },
        () => {
          loadLicenses();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_licenses'
        },
        () => {
          loadLicenses();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeLicenses = useMemo(() => {
    return licenses.filter(lic => lic.status !== 'Canceled');
  }, [licenses]);

  const totalMonthlyCost = useMemo(() => {
    return activeLicenses.reduce((sum, lic) => {
      return sum + Number(lic.monthly_cost || 0);
    }, 0);
  }, [activeLicenses]);

  const totalActiveCount = activeLicenses.length;

  const costByToolData = useMemo(() => {
    const costMap: { [tool: string]: number } = {};
    activeLicenses.forEach(lic => {
      const tool = lic.ai_tool;
      const val = Number(lic.monthly_cost || 0);
      costMap[tool] = (costMap[tool] || 0) + val;
    });
    return Object.keys(costMap).map(tool => ({
      name: tool,
      cost: costMap[tool],
    }));
  }, [activeLicenses]);

  const planDistributionData = useMemo(() => {
    const planMap: { [plan: string]: number } = {
      'Free': 0,
      'Plus': 0,
      'Pro': 0,
      'Ultra': 0,
    };
    activeLicenses.forEach(lic => {
      const plan = lic.plan_name.replace(' (Cá nhân)', '');
      planMap[plan] = (planMap[plan] || 0) + 1;
    });
    return Object.keys(planMap)
      .map(plan => ({
        name: plan,
        value: planMap[plan],
      }))
      .filter(d => d.value > 0);
  }, [activeLicenses]);


  const getLicenseStatus = (lic: AILicense) => {
    const isCanceled = localStorage.getItem(`license_status_${lic.id}`) === 'Canceled';
    if (isCanceled) return 'Canceled';
    const isExpired = new Date(lic.expiration_date + "T23:59:59") < new Date();
    return isExpired ? 'Expired' : 'Active';
  };

  const planColors = ['#94a3b8', '#38bdf8', '#a855f7', '#E3000F'];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${
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

      {/* Header with Tab Switcher */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Quản lý hệ thống</h1>
          <p className="text-xs text-markee-muted">Quản lý phân quyền và cấp phát bản quyền AI công ty.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-white text-markee-text shadow-xs' : 'text-markee-muted hover:text-markee-text'
            }`}
          >
            Danh sách User
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'licenses' ? 'bg-white text-markee-text shadow-xs' : 'text-markee-muted hover:text-markee-text'
            }`}
          >
            Quản lý Bản quyền AI
          </button>
        </div>
      </section>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <>
          {loading ? (
            <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách người dùng...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-markee-border bg-white shadow-xs">
              <table className="w-full border-collapse text-left text-sm text-markee-text">
                <thead className="bg-markee-bg text-xs font-semibold uppercase tracking-wider text-markee-muted border-b border-markee-border">
                  <tr>
                    <th className="px-6 py-4">Tên người dùng</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Vai trò (Role)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-markee-border">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-markee-bg/20 transition-colors">
                      <td className="px-6 py-4 font-semibold text-markee-text">{user.full_name || 'Chưa cập nhật'}</td>
                      <td className="px-6 py-4 text-markee-muted">{user.email}</td>
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
                      <td colSpan={3} className="text-center py-8 text-markee-sub">Không tìm thấy người dùng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab 2: Licenses */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          {/* Top Half: Charts & Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric Cards */}
            <div className="space-y-5 flex flex-col justify-between">
              <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-markee-muted uppercase tracking-wider">Tổng chi phí tháng</span>
                <span className="text-2xl font-black text-markee-text mt-2">
                  {formatCurrency(totalMonthlyCost)}
                </span>
                <span className="text-[10px] text-markee-muted mt-1">Tính trên các gói tài khoản đang hoạt động</span>
              </div>
              
              <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-markee-muted uppercase tracking-wider">Tài khoản Active</span>
                <span className="text-2xl font-black text-markee-text mt-2">{totalActiveCount} tài khoản</span>
                <span className="text-[10px] text-markee-muted mt-1">Đang hoạt động trên hệ thống</span>
              </div>
            </div>

            {/* Bar Chart: Cost by tool */}
            <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs col-span-1">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider mb-4">Chi phí theo công cụ (VNĐ)</h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costByToolData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(value) => [formatCurrency(Number(value)), 'Chi phí']} />
                    <Bar dataKey="cost" fill="#E3000F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Chart: Plan distribution */}
            <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs col-span-1 flex flex-col items-center">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider mb-4 w-full text-left">Phân bổ gói cước</h3>
              <div className="h-44 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {planDistributionData.map((entry, index) => {
                        const planIndex = ['Free', 'Plus', 'Pro', 'Ultra'].indexOf(entry.name);
                        return <Cell key={`cell-${index}`} fill={planColors[planIndex >= 0 ? planIndex : 0]} />;
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <div className="text-lg font-bold text-markee-text">{totalActiveCount}</div>
                  <div className="text-[8px] text-markee-muted uppercase font-semibold">Tài khoản</div>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] mt-2">
                {planDistributionData.map((d) => {
                  const planIndex = ['Free', 'Plus', 'Pro', 'Ultra'].indexOf(d.name);
                  const color = planColors[planIndex >= 0 ? planIndex : 0];
                  return (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-markee-text">{d.name} ({d.value})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="bg-white rounded-xl border border-markee-border overflow-hidden">
            <div className="px-6 py-4 border-b border-markee-border flex items-center justify-between bg-markee-bg/10">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider">Danh sách Bản quyền được cấp</h3>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 bg-markee-primary hover:bg-markee-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <span>➕</span>
                <span>Cấp mới tài khoản</span>
              </button>
            </div>

            {licensesLoading ? (
              <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách bản quyền...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-markee-text">
                  <thead className="bg-markee-bg text-xs font-semibold uppercase tracking-wider text-markee-muted border-b border-markee-border">
                    <tr>
                      <th className="px-6 py-4">Email nhân viên</th>
                      <th className="px-6 py-4">Công cụ AI</th>
                      <th className="px-6 py-4">Loại gói</th>
                      <th className="px-6 py-4">Chi phí</th>
                      <th className="px-6 py-4">% Sử dụng tuần</th>
                      <th className="px-6 py-4">Ngày hết hạn</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-markee-border">
                    {licenses.map((lic) => {
                      const status = getLicenseStatus(lic);
                      let statusBadge = "bg-gray-100 text-gray-700 border-gray-200";
                      let statusText = "Không hoạt động";
                      if (status === 'Active') {
                        statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        statusText = "Đang hoạt động";
                      } else if (status === 'Expired') {
                        statusBadge = "bg-red-50 text-red-700 border-red-200";
                        statusText = "Đã hết hạn";
                      } else if (status === 'Canceled') {
                        statusBadge = "bg-slate-100 text-slate-500 border-slate-200";
                        statusText = "Đã hủy";
                      }

                      const isPersonal = lic.plan_name.includes('(Cá nhân)');
                      const displayPlanName = lic.plan_name.replace(' (Cá nhân)', '');

                      return (
                        <tr key={lic.id} className="hover:bg-markee-bg/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-markee-text">{lic.email}</td>
                          <td className="px-6 py-4 text-markee-muted">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-xs">
                              {lic.ai_tool}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-markee-text">
                            <div className="flex items-center gap-1.5">
                              <span>{displayPlanName}</span>
                              {isPersonal ? (
                                <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Cá nhân
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                  Công ty
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-markee-text">
                            {formatCurrency(lic.monthly_cost)}
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const usagePercent = lic.usagePercent !== undefined ? lic.usagePercent : 0;
                              return (
                                <div className="flex items-center gap-3 w-full max-w-35">
                                  {/* Rãnh nền xám (Background Track) */}
                                  <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                    {/* Thanh màu chạy theo % */}
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                      style={{ width: `${usagePercent}%` }}
                                    ></div>
                                  </div>
                                  {/* Con số % cố định độ rộng để thẳng hàng */}
                                  <span className="text-sm font-bold text-slate-700 w-12 text-right">
                                    {usagePercent}%
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-markee-muted">
                            {new Date(lic.expiration_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge}`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedLicense(lic);
                                setEditTool(lic.ai_tool);
                                setEditPlan(lic.plan_name.replace(' (Cá nhân)', ''));
                                setEditCost(String(lic.monthly_cost));
                                setEditExpiry(lic.expiration_date);
                                setIsRenewModalOpen(true);
                              }}
                              className="text-markee-primary hover:text-markee-hover font-bold text-xs cursor-pointer transition-colors"
                            >
                              Cập nhật Bản quyền
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {licenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-markee-sub">Chưa cấp bản quyền AI nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create License Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleCreateLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Cấp mới Bản quyền AI</h2>
              <p className="text-xs text-markee-muted mt-1">Cấp mới quyền sử dụng công cụ AI cho nhân viên.</p>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Email nhân viên</label>
                <input
                  type="email"
                  required
                  value={newLicenseEmail}
                  onChange={(e) => setNewLicenseEmail(e.target.value)}
                  placeholder="nhanvien@markee.com"
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={newLicenseTool}
                    onChange={(e) => setNewLicenseTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={newLicensePlan}
                    onChange={(e) => setNewLicensePlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí tháng (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newLicenseCost}
                    onChange={(e) => setNewLicenseCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={newLicenseExpiry}
                    onChange={(e) => setNewLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Tạo mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Update License Modal */}
      {isRenewModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleUpdateLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Cập nhật Bản quyền</h2>
              <p className="text-xs text-markee-muted mt-1">
                Cập nhật thông tin bản quyền cho tài khoản <span className="font-semibold text-markee-text">{selectedLicense.email}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={editTool}
                    onChange={(e) => setEditTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí tháng (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRenewModalOpen(false);
                  setSelectedLicense(null);
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function MyAssetsView({ profile }: { profile: UserProfile }) {
  const [licenses, setLicenses] = useState<AILicense[]>([]);
  const [usageStats, setUsageStats] = useState<AIUsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // States for self renewal modal
  const [selectedLicense, setSelectedLicense] = useState<AILicense | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // States for declare personal license modal
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [declareTool, setDeclareTool] = useState('ChatGPT');
  const [declarePlan, setDeclarePlan] = useState('Pro');
  const [declareExpiry, setDeclareExpiry] = useState('');
  const [declareCost, setDeclareCost] = useState('0');

  // Refresh trigger state to force reload
  const [refreshKey, setRefreshKey] = useState(0);

  // States for edit/delete personal license
  const [activeMenuLicenseId, setActiveMenuLicenseId] = useState<number | null>(null);
  const [isEditLicenseModalOpen, setIsEditLicenseModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<AILicense | null>(null);
  const [editLicenseTool, setEditLicenseTool] = useState('');
  const [editLicensePlan, setEditLicensePlan] = useState('');
  const [editLicenseExpiry, setEditLicenseExpiry] = useState('');
  const [editLicenseCost, setEditLicenseCost] = useState('0');
  const [deletingLicense, setDeletingLicense] = useState<AILicense | null>(null);

  function showToast(message: string, type: 'success' | 'error', duration = 3000) {
    setToast({ message, type });
    setTimeout(() => {
      setToast(current => current?.message === message ? null : current);
    }, duration);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [lics, stats] = await Promise.all([
        fetchUserAILicenses(profile.email),
        fetchUserAIUsageStats(profile.email),
      ]);
      setLicenses(lics);
      setUsageStats(stats);
    } catch (e) {
      console.error(e);
      showToast('Không thể tải tài sản AI', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile.email, refreshKey]);

  useEffect(() => {
    // Window focus listener to refetch
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);

    // Supabase subscription for real-time updates
    const channel = supabase
      .channel(`user-usage-${profile.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage_stats',
          filter: `email=eq.${profile.email}`
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_licenses',
          filter: `email=eq.${profile.email}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [profile.email, refreshKey]);

  const getLatestUsageStat = (tool: string) => {
    const matchingStats = usageStats.filter(
      stat => stat.ai_tool.toLowerCase() === tool.toLowerCase()
    );
    if (matchingStats.length === 0) return null;
    return matchingStats[0]; // Already sorted by created_at DESC in database query
  };

  const handleRequestExtension = (lic: AILicense) => {
    showToast(`Đã gửi yêu cầu gia hạn gói ${lic.ai_tool} tới Admin!`, 'success');
    localStorage.setItem(`license_requested_${lic.id}`, 'true');
    setRefreshKey(prev => prev + 1);
  };

  const handleSelfRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !renewDate) return;

    try {
      await renewAILicense(selectedLicense.id, renewDate);
      localStorage.removeItem(`license_status_${selectedLicense.id}`);
      localStorage.removeItem(`license_canceled_date_${selectedLicense.id}`);
      localStorage.removeItem(`license_requested_${selectedLicense.id}`);

      showToast(`Đã tự gia hạn thành công gói ${selectedLicense.ai_tool}!`, 'success');
      setIsRenewModalOpen(false);
      setSelectedLicense(null);
      setRenewDate('');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi gia hạn bản quyền AI', 'error');
    }
  };

  const handleSkipLicense = async (lic: AILicense) => {
    try {
      await cancelAILicense(lic.id);
      showToast(`Đã hủy kích hoạt gói ${lic.ai_tool}.`, 'success');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi hủy bản quyền AI', 'error');
    }
  };

  const handleDeclareLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declareExpiry) {
      showToast('Vui lòng chọn ngày hết hạn', 'error');
      return;
    }
    try {
      await createAILicense({
        email: profile.email,
        ai_tool: declareTool,
        plan_name: `${declarePlan} (Cá nhân)`,
        monthly_cost: Number(declareCost) || 0,
        expiration_date: declareExpiry,
        status: 'Active'
      });
      showToast('Đã khai báo tài khoản cá nhân thành công!', 'success');
      setIsDeclareModalOpen(false);
      setDeclareExpiry('');
      setDeclareCost('0');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi khai báo tài khoản cá nhân', 'error');
    }
  };

  const handleEditLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense || !editLicenseExpiry) {
      showToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    try {
      await updateAILicense(editingLicense.id, {
        ai_tool: editLicenseTool,
        plan_name: `${editLicensePlan} (Cá nhân)`,
        monthly_cost: Number(editLicenseCost) || 0,
        expiration_date: editLicenseExpiry,
      });
      showToast('Đại diện tài khoản cá nhân đã được cập nhật thành công!', 'success');
      setIsEditLicenseModalOpen(false);
      setEditingLicense(null);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật tài khoản cá nhân', 'error');
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <span className="mr-1">✓</span> : <span className="mr-1">⚠️</span>}
          {toast.message}
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Tài sản AI của tôi</h1>
          <p className="text-xs text-markee-muted">Các gói tài khoản AI được cấp quyền sử dụng hoặc tự khai báo.</p>
        </div>
        <button
          onClick={() => setIsDeclareModalOpen(true)}
          className="px-3.5 py-1.5 bg-markee-primary hover:bg-markee-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>Khai báo tài khoản cá nhân</span>
        </button>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải tài sản AI của bạn...</div>
      ) : licenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-markee-border p-8 text-center text-markee-sub text-sm">
          Bạn chưa được cấp tài khoản AI nào. Vui lòng liên hệ Admin để được cấp bản quyền.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {licenses.map((lic) => {
            const isCanceled = lic.status === 'Canceled';
            const isRequested = localStorage.getItem(`license_requested_${lic.id}`) === 'true';

            // Calculate expiration days
            const expDate = new Date(lic.expiration_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expDate.setHours(0, 0, 0, 0);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const isExpired = diffDays < 0;
            const isExpiringSoon = diffDays >= 0 && diffDays <= 3;
            const showWarning = (isExpired || isExpiringSoon) && !isCanceled;

            const match = getLatestUsageStat(lic.ai_tool);
            const usageStr = match ? match.weekly_used : '0%';
            const usageNum = parseInt(usageStr.replace('%', '')) || 0;
            const resetTime = match ? match.reset_time : '';

            const isPersonal = lic.plan_name.includes('(Cá nhân)');
            const displayPlanName = lic.plan_name.replace(' (Cá nhân)', '');

            let borderClass = 'border-gray-200';
            if (showWarning) {
              borderClass = isExpired ? 'border-red-500 ring-1 ring-red-100' : 'border-amber-400 ring-1 ring-amber-100';
            }

            return (
              <div
                key={lic.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between min-h-62.5 relative ${borderClass}`}
                style={{ opacity: isCanceled ? 0.5 : 1 }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-markee-text font-bold text-xs">
                      {lic.ai_tool}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-markee-muted uppercase tracking-wider">
                        {displayPlanName}
                      </span>
                      {isPersonal ? (
                        <span className="px-1.5 py-0.5 rounded-sm text-[8px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Cá nhân
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-sm text-[8px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          Công ty
                        </span>
                      )}

                      {isPersonal && usageNum === 0 && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuLicenseId(activeMenuLicenseId === lic.id ? null : lic.id);
                            }}
                            className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white shrink-0 ml-1"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>

                          {activeMenuLicenseId === lic.id && (
                            <div className="absolute right-0 mt-1 w-24 bg-white border border-markee-border rounded-lg shadow-lg z-20 py-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLicense(lic);
                                  setEditLicenseTool(lic.ai_tool);
                                  setEditLicensePlan(displayPlanName);
                                  setEditLicenseExpiry(lic.expiration_date.split('T')[0]);
                                  setEditLicenseCost(String(lic.monthly_cost));
                                  setIsEditLicenseModalOpen(true);
                                  setActiveMenuLicenseId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLicense(lic);
                                  setActiveMenuLicenseId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {showWarning && (
                    <div className={`mt-3 p-2.5 rounded-lg border text-xs font-semibold ${
                      isExpired ? 'bg-red-50 text-red-800 border-red-100' : 'bg-amber-50 text-amber-800 border-amber-100'
                    }`}>
                      {isExpired ? '⚠️ Tài khoản đã hết hạn!' : `⏳ Sắp hết hạn (còn ${diffDays} ngày)`}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-xs text-markee-muted">
                    <span>Hết hạn:</span>
                    <span className={`font-semibold ${isExpired && !isCanceled ? 'text-red-600 font-bold' : 'text-markee-text'}`}>
                      {new Date(lic.expiration_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-markee-muted">Hạn mức tuần:</span>
                      <span className="font-bold text-markee-text">{usageStr}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-markee-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usageNum, 100)}%` }}
                      />
                    </div>
                    {match ? (
                      resetTime && (
                        <p className="text-sm text-gray-500 italic mt-1">
                          Hạn mức hằng tuần sẽ đặt lại vào: {resetTime}
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-gray-500 italic mt-1">
                        Chưa có dữ liệu sử dụng
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
                  {showWarning ? (
                    <>
                      {!isPersonal ? (
                        <button
                          onClick={() => handleRequestExtension(lic)}
                          disabled={isRequested}
                          className="w-full px-3 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-gray-150 disabled:text-gray-400 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center"
                        >
                          {isRequested ? 'Đã gửi yêu cầu gia hạn' : 'Yêu cầu Admin gia hạn'}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedLicense(lic);
                            setRenewDate('');
                            setIsRenewModalOpen(true);
                          }}
                          className="w-full px-3 py-2 border border-markee-primary text-markee-primary hover:bg-red-50 rounded-lg text-xs font-bold cursor-pointer transition-all text-center"
                        >
                          Tôi đã tự gia hạn
                        </button>
                      )}
                      <button
                        onClick={() => handleSkipLicense(lic)}
                        className="w-full text-center text-xs text-markee-muted hover:text-markee-text font-semibold underline cursor-pointer mt-1"
                      >
                        Không dùng nữa (Bỏ qua)
                      </button>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        {isCanceled ? 'Đã hủy' : 'Hoạt động'}
                      </span>
                      {isCanceled ? (
                        isPersonal ? (
                          <button
                            onClick={() => {
                              setSelectedLicense(lic);
                              setRenewDate('');
                              setIsRenewModalOpen(true);
                            }}
                            className="px-2 py-1 bg-markee-primary hover:bg-markee-hover text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            Tái kích hoạt
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRequestExtension(lic)}
                            disabled={isRequested}
                            className="px-2 py-1 bg-markee-primary hover:bg-markee-hover disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors"
                          >
                            {isRequested ? 'Đã yêu cầu' : 'Yêu cầu Admin gia hạn'}
                          </button>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Self-Renew Modal */}
      {isRenewModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleSelfRenew} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Tôi tự gia hạn gói cước</h2>
              <p className="text-xs text-markee-muted mt-1">
                Chọn ngày hết hạn mới để kích hoạt lại thẻ gói <span className="font-semibold text-markee-text">{selectedLicense.ai_tool}</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-markee-text mb-1.5">Ngày hết hạn mới</label>
              <input
                type="date"
                required
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRenewModalOpen(false);
                  setSelectedLicense(null);
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Lưu ngày mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Declare Personal License Modal */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleDeclareLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Khai báo tài khoản cá nhân</h2>
              <p className="text-xs text-markee-muted mt-1">
                Khai báo tài khoản cá nhân tự mua để quản lý và theo dõi.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={declareTool}
                    onChange={(e) => setDeclareTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={declarePlan}
                    onChange={(e) => setDeclarePlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí (VNĐ/tháng)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={declareCost}
                    onChange={(e) => setDeclareCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={declareExpiry}
                    onChange={(e) => setDeclareExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsDeclareModalOpen(false)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Khai báo
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Edit Personal License Modal */}
      {isEditLicenseModalOpen && editingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <form onSubmit={handleEditLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Chỉnh sửa tài khoản cá nhân</h2>
              <p className="text-xs text-markee-muted mt-1">
                Cập nhật thông tin tài khoản cá nhân của bạn.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={editLicenseTool}
                    onChange={(e) => setEditLicenseTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={editLicensePlan}
                    onChange={(e) => setEditLicensePlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí (VNĐ/tháng)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editLicenseCost}
                    onChange={(e) => setEditLicenseCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={editLicenseExpiry}
                    onChange={(e) => setEditLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditLicenseModalOpen(false);
                  setEditingLicense(null);
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-markee-text">Xác nhận xóa tài khoản</h2>
              <p className="text-xs text-markee-muted mt-1.5">
                Bạn có chắc chắn muốn xóa tài khoản cá nhân <span className="font-semibold text-markee-text">{deletingLicense.ai_tool}</span> không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLicense(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteAILicense(deletingLicense.id);
                    showToast('Đã xóa tài khoản thành công!', 'success');
                    setDeletingLicense(null);
                    setRefreshKey(prev => prev + 1);
                  } catch (err) {
                    console.error(err);
                    showToast('Lỗi khi xóa tài khoản', 'error');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface CurationStats {
  rawSessions: number;
  wipDrafts: number;
  knowledgeHub: number;
}

interface SummaryItem {
  title: string;
  insights?: string[];
  contributors?: string;
  totalTokens?: number;
  model?: string;
  timestamp?: string;
}

interface FlattenedSummary {
  projectId: number;
  projectName: string;
  title: string;
  insights: string[];
  contributors: string;
  totalTokens: number;
  model: string;
  timestamp: string;
}

function KnowledgeHubDashboard() {
  const [stats, setStats] = useState<CurationStats>({ rawSessions: 0, wipDrafts: 0, knowledgeHub: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('Tất cả');
  const [selectedSummary, setSelectedSummary] = useState<FlattenedSummary | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [curationStats, allProjects] = await Promise.all([
        fetchCurationStats(),
        fetchProjects()
      ]);
      setStats(curationStats);
      setProjects(allProjects);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const flattenedSummaries = useMemo(() => {
    const list: FlattenedSummary[] = [];
    projects.forEach(p => {
      if (p.master_summary) {
        try {
          const parsed = JSON.parse(p.master_summary) as SummaryItem[];
          if (Array.isArray(parsed)) {
            parsed.forEach((item: SummaryItem) => {
              list.push({
                projectId: p.id,
                projectName: p.name,
                title: item.title,
                insights: item.insights || [],
                contributors: item.contributors || 'Hệ thống',
                totalTokens: item.totalTokens || 0,
                model: item.model || 'Gemini 3.5 Flash',
                timestamp: item.timestamp || p.created_at
              });
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    });
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [projects]);

  const filteredSummaries = useMemo(() => {
    const cleanSearch = removeVietnameseTones(searchTerm);
    return flattenedSummaries.filter(s => {
      const cleanTitle = removeVietnameseTones(s.title);
      const matchSearch = cleanTitle.includes(cleanSearch) || 
        s.insights.some(i => removeVietnameseTones(i).includes(cleanSearch));
      const matchProject = selectedProjectFilter === 'Tất cả' || s.projectName === selectedProjectFilter;
      return matchSearch && matchProject;
    });
  }, [flattenedSummaries, searchTerm, selectedProjectFilter]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section>
        <h1 className="text-lg font-bold text-markee-text">Kho Tri thức</h1>
        <p className="text-xs text-markee-muted">Trung tâm lưu trữ và tổng hợp tri thức tự động từ các dự án AI.</p>
      </section>

      {/* Curation Pipeline Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
        {/* Thẻ 1: Nhật ký AI thô */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-red-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nhật ký AI thô</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.rawSessions}</div>
          <div className="text-sm text-gray-400 mt-1">Dữ liệu từ extension</div>
        </div>

        {/* Thẻ 2: Bản nháp WIP */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bản nháp WIP</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.wipDrafts}</div>
          <div className="text-sm text-gray-400 mt-1">Đang chờ tổng hợp</div>
        </div>

        {/* Thẻ 3: Trung tâm tri thức */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trung tâm tri thức</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.knowledgeHub}</div>
          <div className="text-sm text-gray-400 mt-1">Đã hệ thống hóa</div>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải dữ liệu Kho Tri thức...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cột trái: Các bộ lọc */}
          <aside className="lg:col-span-1 bg-white p-5 rounded-xl border border-markee-border shadow-xs space-y-4 self-start">
            <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider border-b border-gray-100 pb-2">Bộ lọc</h3>
            
            <div className="space-y-1.5">
              <label htmlFor="projectFilterSelect" className="block text-xs font-semibold text-markee-text">Dự án</label>
              <select
                id="projectFilterSelect"
                value={selectedProjectFilter}
                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                className="w-full rounded-lg border border-markee-border bg-white px-3 py-2 text-xs font-medium text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
              >
                <option value="Tất cả">Tất cả dự án</option>
                {projects.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Only project filter remains here */}
          </aside>

          {/* Phần chính: Search & Cards */}
          <section className="lg:col-span-3 space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-markee-muted">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm tiêu đề hoặc nội dung tri thức..."
                className="w-full pl-9 pr-4 py-2.5 text-xs border border-markee-border rounded-xl bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary placeholder:text-markee-muted shadow-2xs"
              />
            </div>

            <div className="space-y-4">
              {filteredSummaries.map((summary, idx) => {
                const snippet = summary.insights.slice(0, 2).join('; ');
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedSummary(summary)}
                    className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs hover:shadow-sm hover:border-markee-primary/40 cursor-pointer transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-bold text-markee-text text-sm md:text-base hover:text-markee-primary transition-colors">
                        {summary.title}
                      </h3>
                      <span className="text-[10px] text-markee-muted bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm font-semibold shrink-0">
                        {getRelativeTime(summary.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-markee-muted line-clamp-2">
                      {snippet || 'Chưa có nội dung tóm tắt chi tiết.'}
                    </p>

                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-markee-muted justify-between">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-markee-text">Dự án:</span>
                          <span className="text-markee-primary font-semibold">{summary.projectName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-markee-text">Nguồn:</span>
                          <span>{summary.contributors}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-markee-text">Công cụ:</span>
                          <span>{summary.model}</span>
                        </div>
                      </div>
                      <span className="text-markee-primary text-[10px] font-bold">Xem chi tiết →</span>
                    </div>
                  </div>
                );
              })}

              {filteredSummaries.length === 0 && (
                <div className="bg-white rounded-xl border border-markee-border p-8 text-center text-markee-sub text-xs">
                  Không tìm thấy bản tóm tắt tri thức nào phù hợp với bộ lọc/tìm kiếm.
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Modal chi tiết Master Summary */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Chi tiết Tri thức Dự án</h3>
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-1">Dự án</h4>
                  <p className="text-sm font-bold text-markee-primary">{selectedSummary.projectName}</p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-1">Tiêu đề tri thức</h4>
                  <p className="text-base font-bold text-markee-text bg-gray-50 border border-gray-150 p-3 rounded-lg">{selectedSummary.title}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-2">Insight cốt lõi</h4>
                  <ul className="list-disc pl-5 text-sm text-markee-text space-y-2">
                    {selectedSummary.insights.map((insight, idx) => (
                      <li key={idx} className="leading-relaxed">{insight}</li>
                    ))}
                  </ul>
                </div>

                {/* Horizontal Meta Info */}
                <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                    <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Nguồn</div>
                    <div className="text-markee-text truncate font-semibold" title={selectedSummary.contributors}>
                      {selectedSummary.contributors}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                    <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Công cụ</div>
                    <div className="text-markee-text truncate font-semibold" title={selectedSummary.model}>
                      {selectedSummary.model}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                    <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Số Token</div>
                    <div className="text-markee-text font-semibold">
                      {selectedSummary.totalTokens?.toLocaleString()} tokens
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                    <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Thời gian</div>
                    <div className="text-markee-text font-semibold">
                      {getRelativeTime(selectedSummary.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSummary(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-text hover:bg-markee-bg rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
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

function getRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = nowDay.getTime() - dateDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return 'Hôm nay';
  }
  if (diffDays === 1) {
    return 'Hôm qua';
  }
  if (diffDays < 7) {
    return `${diffDays} ngày trước`;
  }
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) {
    return `${diffWeeks} tuần trước`;
  }
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${diffMonths} tháng trước`;
  }
  return `${Math.floor(diffDays / 365)} năm trước`;
}

function ProjectManagement({ profile }: { profile: UserProfile }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPage, setProjectPage] = useState(0);

  const PROJECT_PAGE_SIZE = 8;
  const filteredProjects = useMemo(() => {
    return projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [projects, projectSearch]);

  const displayedProjects = useMemo(() => {
    const start = projectPage * PROJECT_PAGE_SIZE;
    return filteredProjects.slice(start, start + PROJECT_PAGE_SIZE);
  }, [filteredProjects, projectPage]);

  useEffect(() => {
    setProjectPage(0);
  }, [projectSearch]);

  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTab, setProjectTab] = useState<'timeline' | 'knowledge_hub'>('timeline');

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

  // Summary states
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<{
    title: string;
    insights: string[];
    contributors: string;
    totalTokens: number;
    model: string;
  } | null>(null);

  // WIP Edit, Move, Delete states
  const [activeEditWIP, setActiveEditWIP] = useState<AISession | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTrack, setEditTrack] = useState('');
  const [isEditingWIP, setIsEditingWIP] = useState(false);

  const [activeMoveWIP, setActiveMoveWIP] = useState<AISession | null>(null);
  const [newProjectId, setNewProjectId] = useState<number | ''>('');
  const [isMovingWIP, setIsMovingWIP] = useState(false);

  const [activeDeleteWIP, setActiveDeleteWIP] = useState<AISession | null>(null);
  const [isDeletingWIP, setIsDeletingWIP] = useState(false);

  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  async function handleDeleteWIP() {
    if (!activeDeleteWIP) return;
    setIsDeletingWIP(true);
    try {
      const { error } = await supabase.from('skill_library').delete().eq('id', activeDeleteWIP.id);
      if (error) throw error;

      showToast('Xóa bản nháp thành công!', 'success');
      
      const targetId = activeDeleteWIP.id;
      setDeletingIds(prev => [...prev, targetId]);
      setActiveDeleteWIP(null);

      setTimeout(() => {
        setLogs(prev => prev.filter(l => l.id !== targetId));
        setDeletingIds(prev => prev.filter(id => id !== targetId));
        if (selectedProject) {
          setSelectedProject(prev => prev ? {
            ...prev,
            logCount: Math.max(0, (prev.logCount || 1) - 1)
          } : null);
          setProjects(prev => prev.map(p => p.id === selectedProject.id ? {
            ...p,
            logCount: Math.max(0, (p.logCount || 1) - 1)
          } : p));
        }
      }, 500);
    } catch (err) {
      console.error('Error deleting WIP:', err);
      showToast('Lỗi khi xóa bản nháp', 'error');
    } finally {
      setIsDeletingWIP(false);
    }
  }

  async function handleMoveWIP() {
    if (!activeMoveWIP || !newProjectId) return;
    setIsMovingWIP(true);
    try {
      const { error } = await supabase.from('skill_library').update({ project_id: newProjectId }).eq('id', activeMoveWIP.id);
      if (error) throw error;

      showToast('Chuyển dự án thành công!', 'success');
      
      const targetId = activeMoveWIP.id;
      setDeletingIds(prev => [...prev, targetId]);
      setActiveMoveWIP(null);
      setNewProjectId('');

      setTimeout(() => {
        setLogs(prev => prev.filter(l => l.id !== targetId));
        setDeletingIds(prev => prev.filter(id => id !== targetId));
        if (selectedProject) {
          setSelectedProject(prev => prev ? {
            ...prev,
            logCount: Math.max(0, (prev.logCount || 1) - 1)
          } : null);
          setProjects(prev => prev.map(p => {
            if (p.id === selectedProject.id) {
              return { ...p, logCount: Math.max(0, (p.logCount || 1) - 1) };
            }
            if (p.id === newProjectId) {
              return { ...p, logCount: (p.logCount || 0) + 1 };
            }
            return p;
          }));
        }
      }, 500);
    } catch (err) {
      console.error('Error moving WIP:', err);
      showToast('Lỗi khi chuyển dự án', 'error');
    } finally {
      setIsMovingWIP(false);
    }
  }

  async function handleEditWIP() {
    if (!activeEditWIP) return;
    setIsEditingWIP(true);
    try {
      const { error } = await supabase
        .from('skill_library')
        .update({ 
          title: editTitle, 
          markdown_content: editContent, 
          team_track: editTrack 
        })
        .eq('id', activeEditWIP.id);
      
      if (error) throw error;

      showToast('Cập nhật bản nháp thành công!', 'success');

      setLogs(prev => prev.map(l => l.id === activeEditWIP.id ? {
        ...l,
        title: editTitle,
        prompt_content: editContent,
        team_track: editTrack,
      } : l));

      setActiveEditWIP(null);
    } catch (err) {
      console.error('Error editing WIP:', err);
      showToast('Lỗi khi sửa bản nháp', 'error');
    } finally {
      setIsEditingWIP(false);
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

  async function handleCreateProject() {
    const trimmedName = projectName.trim();
    if (!trimmedName) return;
    if (isCreating) return;
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


  const logsLoadingRef = useRef(false);

  async function loadUserLogs(projId: number, userEmail: string, isInitial = false) {
    if (logsLoadingRef.current && !isInitial) return;
    logsLoadingRef.current = true;
    setLogsLoading(true);
    const nextPage = isInitial ? 0 : page + 1;
    try {
      const result = await fetchProjectWIPsForUser(projId, userEmail, nextPage, 20);
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
      logsLoadingRef.current = false;
    }
  }

  async function handleOpenProject(project: Project) {
    setSelectedProject(project);
    setMembers([]);
    setActiveMemberEmail(null);
    setLogs([]);
    setPage(0);
    setHasMore(false);
    setMembersLoading(true);

    try {
      const activeMembers = await fetchProjectWIPMembers(project.id);
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

  async function handleSummarizeProject() {
    if (!selectedProject) return;
    if (members.length === 0) {
      showToast("Không có dữ liệu hoạt động nào để tổng hợp.", "error");
      return;
    }
    setIsSummarizing(true);
    setIsSummaryModalOpen(true);
    setSummaryResult(null);
    try {
      const res = await fetch('/api/summarize-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProject.id }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi gọi API tổng hợp tri thức');
      }
      
      setSummaryResult(data);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error('Lỗi khi tổng hợp tri thức dự án');
      console.error(errorObj);
      showToast(errorObj.message, 'error');
      setIsSummaryModalOpen(false);
    } finally {
      setIsSummarizing(false);
    }
  }

  const [isSavingSummary, setIsSavingSummary] = useState(false);

  async function handleSaveSummary(newSummary: SummaryItem) {
    if (!selectedProject) return;
    if (isSavingSummary) return;
    setIsSavingSummary(true);
    
    const summaryItem = {
      title: newSummary.title,
      insights: newSummary.insights,
      contributors: newSummary.contributors,
      totalTokens: newSummary.totalTokens,
      model: newSummary.model,
      timestamp: new Date().toISOString(),
    };
    
    try {
      showToast('Đang lưu bản tổng hợp...', 'loading');
      await supabase.rpc('append_project_summary', {
        p_project_id: selectedProject.id,
        p_item_json: JSON.stringify([summaryItem]),
      });
      
      let currentSummaries: SummaryItem[] = [];
      if (selectedProject.master_summary) {
        try {
          const parsed = JSON.parse(selectedProject.master_summary) as SummaryItem[];
          if (Array.isArray(parsed)) {
            currentSummaries = parsed;
          }
        } catch (e) {
          console.error("Error parsing existing master_summary:", e);
        }
      }
      const updatedSummaries = [...currentSummaries, summaryItem];
      const serialized = JSON.stringify(updatedSummaries);
      
      const updatedProj = {
        ...selectedProject,
        master_summary: serialized,
        last_summarized_at: new Date().toISOString(),
      };
      setSelectedProject(updatedProj);
      setProjects(prev => prev.map(p => p.id === selectedProject.id ? updatedProj : p));
      
      showToast('Đã lưu tổng hợp tri thức thành công!', 'success');
      setProjectTab('knowledge_hub');
      setIsSummaryModalOpen(false);
      setSummaryResult(null);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi lưu tổng hợp tri thức', 'error');
    } finally {
      setIsSavingSummary(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${
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


      {/* Search Bar */}
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-markee-sub" />
        <input
          type="text"
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          placeholder="Tìm kiếm dự án theo tên..."
          className="w-full rounded-xl border border-markee-border bg-white py-2.5 pl-10 pr-4 text-xs text-markee-text outline-none transition-colors placeholder:text-markee-sub focus:border-markee-primary"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách dự án...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {displayedProjects.map((project) => {
              const updateDate = getRelativeTime(project.lastWipCreatedAt || project.created_at);

              return (
                <div
                  key={project.id}
                  onClick={() => handleOpenProject(project)}
                  className="group cursor-pointer rounded-xl border-t-4 border-t-markee-primary border-x border-b border-gray-200 bg-white p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between min-h-47.5"
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
                          Bản nháp
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-markee-text text-sm md:text-base">
                          {project.members?.length || 0}
                        </div>
                        <div className="text-[9px] font-bold text-markee-muted uppercase tracking-wider">
                          Thành viên
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-markee-text text-sm md:text-base">
                          {updateDate}
                        </div>
                        <div className="text-[9px] font-bold text-markee-muted uppercase tracking-wider">
                          Cập nhật
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
          </div>

          {filteredProjects.length === 0 && (
            <div className="text-center py-10 text-sm text-markee-sub bg-white border border-markee-border rounded-xl p-8">
              {projects.length === 0 ? "Chưa có dự án nào được tạo." : "Không tìm thấy dự án phù hợp với từ khóa."}
            </div>
          )}

          {filteredProjects.length > PROJECT_PAGE_SIZE && (
            <div className="flex justify-center pt-2">
              <PaginationControls
                page={projectPage}
                total={filteredProjects.length}
                pageSize={PROJECT_PAGE_SIZE}
                onPageChange={setProjectPage}
              />
            </div>
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
                <p className="text-xs text-markee-muted mt-0.5">Timeline ghi nhận các phiên làm việc và tri thức của dự án.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSummarizeProject}
                  disabled={members.length === 0}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    members.length === 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                      : 'bg-markee-primary hover:bg-markee-hover text-white'
                  }`}
                >
                  Tổng hợp Tri thức Dự án
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Tab Selector */}
              <div className="flex bg-gray-50 border-b border-markee-border px-6 py-2 gap-4">
                <button
                  type="button"
                  onClick={() => setProjectTab('timeline')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    projectTab === 'timeline'
                      ? 'border-markee-primary text-markee-primary'
                      : 'border-transparent text-markee-muted hover:text-markee-text'
                  }`}
                >
                  📅 Lịch sử Dự án
                </button>
                <button
                  type="button"
                  onClick={() => setProjectTab('knowledge_hub')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    projectTab === 'knowledge_hub'
                      ? 'border-markee-primary text-markee-primary'
                      : 'border-transparent text-markee-muted hover:text-markee-text'
                  }`}
                >
                  🧠 Knowledge Hub ({
                    (() => {
                      if (!selectedProject?.master_summary) return 0;
                      try {
                        const parsed = JSON.parse(selectedProject.master_summary);
                        return Array.isArray(parsed) ? parsed.length : 0;
                      } catch {
                        return 0;
                      }
                    })()
                  })
                </button>
              </div>

              {/* Tab Content Area */}
              <div className="flex-1 overflow-hidden flex flex-col">
                {projectTab === 'knowledge_hub' ? (
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Knowledge Hub summaries cards */}
                    {(() => {
                      let summaries: SummaryItem[] = [];
                      if (selectedProject?.master_summary) {
                        try {
                          const parsed = JSON.parse(selectedProject.master_summary) as SummaryItem[];
                          if (Array.isArray(parsed)) summaries = parsed;
                        } catch (e) {
                          console.error("Error parsing master_summary:", e);
                        }
                      }
                      
                      if (summaries.length === 0) {
                        return (
                          <div className="text-center py-10 text-sm text-markee-muted">
                            Chưa có bản tổng hợp tri thức nào. Nhấp vào nút &quot;Tổng hợp Tri thức Dự án&quot; ở trên để tạo.
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-4">
                          {summaries.slice().reverse().map((summary: SummaryItem, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs hover:shadow-sm transition-all space-y-3">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-bold text-markee-text text-sm md:text-base">
                                  {summary.title}
                                </h4>
                                <span className="text-[10px] text-markee-muted bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm font-semibold shrink-0">
                                  {getRelativeTime(summary.timestamp || '')}
                                </span>
                              </div>

                              <ul className="list-disc pl-5 text-xs text-markee-text space-y-1.5">
                                {summary.insights && summary.insights.map((insight: string, i: number) => (
                                  <li key={i} className="leading-relaxed">{insight}</li>
                                ))}
                              </ul>

                              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-markee-muted">
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-markee-text">Nguồn:</span>
                                  <span>{summary.contributors}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-markee-text">Công cụ:</span>
                                  <span>{summary.model}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="font-bold text-markee-text">Số Token:</span>
                                  <span>{summary.totalTokens?.toLocaleString()} tokens</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="flex-1 overflow-hidden p-6 flex gap-6">
                    {/* Left Sidebar: Active Members */}
                    <div className="w-1/4 min-w-50 border-r border-markee-border pr-6 overflow-y-auto flex flex-col">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 h-full flex flex-col">
                        <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-3">
                          Thành viên hoạt động
                        </h4>
                        
                        {membersLoading ? (
                          <div className="text-xs text-markee-muted py-2">Đang tải...</div>
                        ) : members.length === 0 ? (
                          <div className="text-xs text-markee-muted py-2">Không có thành viên nào.</div>
                        ) : (
                          <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
                            {members.map((m) => {
                              const isActive = activeMemberEmail === m.email;
                              const isCurrentUser = m.email === profile.email;
                              return (
                                <button
                                  key={m.email}
                                  type="button"
                                  onClick={() => handleSelectMember(m.email)}
                                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all border ${
                                    isActive
                                      ? 'bg-markee-primary/10 border-markee-primary/20 text-markee-primary font-bold'
                                      : 'hover:bg-slate-100 border-transparent text-markee-text'
                                  }`}
                                >
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 select-none shadow-3xs"
                                    style={{ backgroundColor: m.avatarColor || '#E3000F' }}
                                  >
                                    {getInitials(m.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold truncate leading-tight flex items-center">
                                      <span>{m.name}</span>
                                      {isCurrentUser && (
                                        <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full ml-1.5 font-normal shrink-0">
                                          Bạn
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-markee-muted truncate mt-0.5">@{m.email.split('@')[0]}</div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Timeline Panel */}
                    <div className="flex-1 overflow-y-auto pl-2 flex flex-col pr-1 h-full">
                      {logsLoading && logs.length === 0 ? (
                        <div className="text-center py-10 text-sm text-markee-sub">Đang tải nhật ký hoạt động...</div>
                      ) : logs.length === 0 ? (
                        <div className="text-center py-10 text-sm text-markee-sub">
                          Không có log hoạt động nào.
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="relative border-l-2 border-markee-border pl-6 ml-3 space-y-8">
                            {logs.map((log) => {
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

                              const isOwnWIP = profile.email === log.author_id;
                              const isDeleting = deletingIds.includes(log.id);

                              return (
                                <div 
                                  key={log.id} 
                                  className={`relative transition-all duration-500 ease-out ${
                                    isDeleting 
                                      ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden pl-0' 
                                      : ''
                                  }`}
                                >
                                  {/* Timeline Bullet Node */}
                                  <div
                                    className="absolute -left-7.75 top-1 w-4 h-4 rounded-full border-2 border-white shadow-xs bg-markee-primary"
                                    title={log.author_id}
                                  />
                                  
                                  {/* Log Item Header */}
                                  <div className="flex flex-wrap items-center gap-2 text-xs">
                                    <span className="font-bold text-markee-text">{dateStr}</span>
                                    <span className="font-semibold text-markee-primary">@{log.author_id?.split('@')[0]}</span>
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
                                      <blockquote className="px-4 py-3 text-markee-text text-sm rounded-r-lg border border-markee-border border-l-4 border-l-markee-primary relative group/quote transition-all duration-300 bg-white">
                                        <div className="flex items-center justify-between text-xs text-markee-muted mb-1.5 font-semibold">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span>🪙</span>
                                            <span>{log.tokens_used || 0} tokens</span>
                                            {isOwnWIP && (
                                              <span className="ml-1 px-1.5 py-0.5 rounded bg-markee-primary/10 text-markee-primary text-[9px] font-bold border border-markee-primary/20">
                                                Của bạn
                                              </span>
                                            )}
                                            {log.team_track && (
                                              <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-bold border border-purple-100">
                                                {log.team_track}
                                              </span>
                                            )}
                                          </div>
                                          
                                          {isOwnWIP && (
                                            <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
                                              <button
                                                type="button"
                                                title="Sửa"
                                                onClick={() => {
                                                  setActiveEditWIP(log);
                                                  setEditTitle(log.title || '');
                                                  setEditContent(log.prompt_content || '');
                                                  setEditTrack(log.team_track || '');
                                                }}
                                                className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white"
                                              >
                                                <Edit className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Chuyển Dự án"
                                                onClick={() => {
                                                  setActiveMoveWIP(log);
                                                  setNewProjectId('');
                                                }}
                                                className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white"
                                              >
                                                <ArrowLeftRight className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                title="Xóa"
                                                onClick={() => {
                                                  setActiveDeleteWIP(log);
                                                }}
                                                className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-red-600 cursor-pointer bg-white"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          )}
                                        </div>

                                        {log.title && (
                                          <div className="font-bold text-xs text-markee-text mb-1 bg-linear-to-r from-slate-900 to-slate-700 bg-clip-text">
                                            {log.title}
                                          </div>
                                        )}
                                        <PromptText text={log.prompt_content} />
                                      </blockquote>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

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
                      )}
                    </div>
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

      {/* Edit WIP Modal */}
      {activeEditWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Sửa bản nháp WIP</h3>
              <button
                type="button"
                onClick={() => setActiveEditWIP(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label htmlFor="editWipTitleInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Tiêu đề bản nháp
                </label>
                <input
                  id="editWipTitleInput"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Nhập tiêu đề..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                />
              </div>

              <div>
                <label htmlFor="editWipTrackSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Phòng ban (Track)
                </label>
                <select
                  id="editWipTrackSelect"
                  value={editTrack}
                  onChange={(e) => setEditTrack(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                >
                  <option value="">Khác (Chưa phân loại)</option>
                  <option value="Track 1: SI Delivery">Track 1: SI Delivery</option>
                  <option value="Track 2: Marketing">Track 2: Marketing</option>
                  <option value="Track 3: Dev + DevOps">Track 3: Dev + DevOps</option>
                  <option value="Track 4: AI Team">Track 4: AI Team</option>
                  <option value="Track 5: Sales">Track 5: Sales</option>
                </select>
              </div>

              <div>
                <label htmlFor="editWipContentInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Nội dung Markdown
                </label>
                <textarea
                  id="editWipContentInput"
                  rows={10}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Nhập nội dung markdown của bản nháp..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary font-mono"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveEditWIP(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleEditWIP}
                disabled={isEditingWIP || !editTitle.trim() || !editContent.trim()}
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isEditingWIP ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move WIP Modal */}
      {activeMoveWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Chuyển Dự án</h3>
              <button
                type="button"
                onClick={() => {
                  setActiveMoveWIP(null);
                  setNewProjectId('');
                }}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-markee-muted leading-relaxed">
                Bạn đang chuyển bản nháp <span className="font-bold text-markee-text">&quot;{activeMoveWIP.title || 'Không có tiêu đề'}&quot;</span> sang một dự án khác. 
                Sau khi chuyển thành công, bản nháp này sẽ biến mất khỏi dòng thời gian của dự án hiện tại.
              </p>
              
              <div>
                <label htmlFor="moveWipProjectSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Chọn Dự án đích
                </label>
                <select
                  id="moveWipProjectSelect"
                  value={newProjectId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewProjectId(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                >
                  <option value="">-- Chọn Dự án --</option>
                  {projects
                    .filter((p) => p.id !== activeMoveWIP.project_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveMoveWIP(null);
                  setNewProjectId('');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleMoveWIP}
                disabled={isMovingWIP || !newProjectId}
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isMovingWIP ? 'Đang chuyển...' : 'Xác nhận Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete WIP Modal */}
      {activeDeleteWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-red-600">Xác nhận Xóa</h3>
              <button
                type="button"
                onClick={() => setActiveDeleteWIP(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-xs text-markee-muted leading-relaxed">
                Bạn có chắc chắn muốn xóa bản nháp <span className="font-bold text-markee-text">&quot;{activeDeleteWIP.title || 'Không có tiêu đề'}&quot;</span>? 
                Hành động này không thể hoàn tác.
              </p>
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveDeleteWIP(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteWIP}
                disabled={isDeletingWIP}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingWIP ? 'Đang xóa...' : 'Xác nhận Xóa'}
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

      {/* Summarize Project Result Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Kết quả tổng hợp tri thức AI</h3>
              <button
                type="button"
                onClick={() => {
                  setIsSummaryModalOpen(false);
                  setSummaryResult(null);
                }}
                disabled={isSummarizing}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold disabled:opacity-55"
              >
                ✕
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="w-10 h-10 border-4 border-markee-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-markee-text animate-pulse">AI đang phân tích các WIP và tổng hợp tri thức...</p>
                  <p className="text-xs text-markee-muted">Quá trình này có thể mất vài giây.</p>
                </div>
              ) : summaryResult ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-1">Tiêu đề đề xuất</h4>
                    <p className="text-base font-bold text-markee-text bg-gray-50 border border-gray-150 p-3 rounded-lg">{summaryResult.title}</p>
                  </div>
                  
                  <div>
                    <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-2">Insight cốt lõi</h4>
                    <ul className="list-disc pl-5 text-sm text-markee-text space-y-2">
                      {summaryResult.insights.map((insight, idx) => (
                        <li key={idx} className="leading-relaxed">{insight}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Horizontal Meta Info */}
                  <div className="pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Nguồn</div>
                      <div className="text-markee-text truncate font-semibold" title={summaryResult.contributors}>
                        {summaryResult.contributors}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Công cụ</div>
                      <div className="text-markee-text truncate font-semibold" title={summaryResult.model}>
                        {summaryResult.model}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Số Token</div>
                      <div className="text-markee-text font-semibold">
                        {summaryResult.totalTokens.toLocaleString()} tokens
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px] mb-1">Thời gian</div>
                      <div className="text-markee-text font-semibold">Vừa xong</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsSummaryModalOpen(false);
                  setSummaryResult(null);
                }}
                disabled={isSummarizing}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer disabled:opacity-55"
              >
                Hủy
              </button>
              {summaryResult && (
                <button
                  type="button"
                  onClick={() => handleSaveSummary(summaryResult)}
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                >
                  Xác nhận Lưu
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
