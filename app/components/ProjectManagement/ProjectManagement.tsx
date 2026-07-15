'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, ArrowLeftRight, MoreVertical } from 'lucide-react';
import {
  fetchProjects,
  createNewProject,
  fetchProjectWIPMembers,
  fetchProjectWIPsForUser,
  updateProjectSummary,
  type Project,
  type UserProfile,
  type AISession,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';

// Utility helper classes & functions
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

function formatWipFileSize(bytes?: number | null) {
  if (!bytes) return '0 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface SummaryItem {
  title: string;
  insights: string[];
  contributors: string;
  totalTokens: number;
  model: string;
  timestamp?: string;
}

// Subcomponents
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
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs font-bold text-markee-primary hover:text-markee-hover cursor-pointer"
      >
        {expanded ? 'Thu gọn ↑' : 'Xem thêm ↓'}
      </button>
    </div>
  );
}

export default function ProjectManagement({ profile }: { profile: UserProfile }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPage, setProjectPage] = useState(0);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<number | null>(null);

  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [teams, setTeams] = useState<{ id: number; name: string; department_id: number }[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    async function loadDeptsAndTeams() {
      try {
        const { data: deptData } = await supabase.from('departments').select('id, name');
        setDepartments(deptData || []);
        const { data: teamData } = await supabase.from('teams').select('id, name, department_id');
        setTeams(teamData || []);
      } catch (e) {
        console.error('Error fetching depts/teams:', e);
      }
    }
    loadDeptsAndTeams();
  }, []);

  const PROJECT_PAGE_SIZE = 9;
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectTab, _setProjectTab] = useState<'timeline' | 'knowledge_hub'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const ptab = searchParams.get('ptab');
      if (ptab && ['timeline', 'knowledge_hub'].includes(ptab)) {
        return ptab as 'timeline' | 'knowledge_hub';
      }
    }
    return 'timeline';
  });

  const setProjectTab = (tab: 'timeline' | 'knowledge_hub') => {
    _setProjectTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('ptab', tab);
      router.replace(`${window.location.pathname}?${params.toString()}`);
    }
  };

  // Modal logs and members states
  const [members, setMembers] = useState<{ email: string; name: string; avatarColor: string }[]>([]);
  const [activeMemberEmail, setActiveMemberEmail] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [logs, setLogs] = useState<AISession[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const filteredLogs = logs;

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

  // States cho việc Sửa/Xóa Project
  const [activeEditProject, setActiveEditProject] = useState<Project | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [isEditingProject, setIsEditingProject] = useState(false);

  const [activeDeleteProject, setActiveDeleteProject] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  function handleEditProjectOpen(proj: Project) {
    setActiveEditProject(proj);
    setEditProjectName(proj.name);
  }

  async function handleEditProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editProjectName.trim();
    if (!trimmed || !activeEditProject) return;
    setIsEditingProject(true);
    showToast('Đang cập nhật dự án...', 'loading');
    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: trimmed })
        .eq('id', activeEditProject.id);

      if (error) throw error;

      showToast('Cập nhật dự án thành công!', 'success');
      setProjects(prev => prev.map(p => p.id === activeEditProject.id ? { ...p, name: trimmed } : p));
      if (selectedProject?.id === activeEditProject.id) {
        setSelectedProject(prev => prev ? { ...prev, name: trimmed } : null);
      }
      setActiveEditProject(null);
    } catch (err) {
      console.error('Error editing project:', err);
      showToast('Lỗi khi cập nhật dự án', 'error');
    } finally {
      setIsEditingProject(false);
    }
  }

  async function handleDeleteProjectSubmit() {
    if (!activeDeleteProject) return;
    setIsDeletingProject(true);
    showToast('Đang xóa dự án...', 'loading');
    try {
      // Cập nhật project_id = null cho các skills thuộc project này để tránh lỗi foreign key
      const { error: updateSkillsError } = await supabase
        .from('skill_library')
        .update({ project_id: null })
        .eq('project_id', activeDeleteProject.id);
      if (updateSkillsError) {
        console.error("Lỗi khi cập nhật link project_id cho skills:", updateSkillsError);
      }

      // Xóa project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', activeDeleteProject.id);

      if (error) throw error;

      showToast('Xóa dự án thành công!', 'success');
      setProjects(prev => prev.filter(p => p.id !== activeDeleteProject.id));
      if (selectedProject?.id === activeDeleteProject.id) {
        setSelectedProject(null);
      }
      setActiveDeleteProject(null);
    } catch (err) {
      console.error('Error deleting project:', err);
      showToast('Lỗi khi xóa dự án', 'error');
    } finally {
      setIsDeletingProject(false);
    }
  }

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
    setIsCreating(true);
    try {
      const newProject = await createNewProject(trimmedName, profile.email, 'WIP_GLOBAL');
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
      const data = await fetchProjects(undefined, false, 'WIP_GLOBAL', selectedDeptId, selectedTeamId);
      setProjects(data);
    } finally {
      setLoading(false);
    }
  }


  async function loadUserLogs(projId: number, userEmail: string, isInitial = false) {
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/summarize-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
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

  async function handleSaveSummary(newSummary: SummaryItem) {
    if (!selectedProject) return;

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

    const summaryItem = {
      title: newSummary.title,
      insights: newSummary.insights,
      contributors: newSummary.contributors,
      totalTokens: newSummary.totalTokens,
      model: newSummary.model,
      timestamp: new Date().toISOString(),
    };

    const updatedSummaries = [summaryItem, ...currentSummaries];
    const serialized = JSON.stringify(updatedSummaries);

    try {
      showToast('Đang lưu bản tổng hợp...', 'loading');
      await updateProjectSummary(selectedProject.id, serialized);

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
    }
  }

  useEffect(() => {
    loadProjects();
  }, [selectedDeptId, selectedTeamId]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${toast.type === 'loading'
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


      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-markee-sub" />
          <input
            type="text"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
            placeholder="Tìm kiếm dự án theo tên..."
            className="w-full rounded-xl border border-markee-border bg-white py-2.5 pl-10 pr-4 text-base md:text-xs text-markee-text outline-none transition-colors placeholder:text-markee-sub focus:border-markee-primary"
          />
        </div>

        {/* Dept Select */}
        <div className="w-48">
          <select
            value={selectedDeptId || ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setSelectedDeptId(val);
              setSelectedTeamId(null);
            }}
            className="w-full rounded-xl border border-markee-border bg-white px-3.5 py-2.5 text-base md:text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
          >
            <option value="">Tất cả phòng ban</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {/* Team Select */}
        <div className="w-48">
          <select
            value={selectedTeamId || ''}
            disabled={!selectedDeptId}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              setSelectedTeamId(val);
            }}
            className="w-full rounded-xl border border-markee-border bg-white px-3.5 py-2.5 text-base md:text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Tất cả team</option>
            {teams
              .filter(t => selectedDeptId === null || t.department_id === selectedDeptId)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>
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
                    <div className="flex justify-between items-start gap-2 relative">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-bold text-markee-text truncate group-hover:text-markee-primary transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs text-markee-muted truncate mt-1">
                          Dự án theo dõi hoạt động AI. Tạo bởi {project.authorName}
                        </p>
                      </div>

                      {/* Action Menu (Kebab) cho Project */}
                      {(project.created_by === profile.email || profile.role === 'admin' || profile.role === 'super_admin') && (
                        <div className="relative z-10 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuProjectId(openMenuProjectId === project.id ? null : project.id);
                            }}
                            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-center border-0 bg-transparent"
                            title="Thao tác"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuProjectId === project.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuProjectId(null);
                                }}
                              />
                              <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-white shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuProjectId(null);
                                    handleEditProjectOpen(project);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent transition-colors"
                                >
                                  <Edit className="h-3.5 w-3.5 text-gray-400" />
                                  Chỉnh sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuProjectId(null);
                                    setActiveDeleteProject(project);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                  Xóa
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
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
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full border text-[10px] font-bold shadow-2xs shrink-0 select-none ${softBgClasses[idx % softBgClasses.length]
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-5xl w-full h-[80vh] max-h-[85vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="border-b border-markee-border px-6 py-4 flex items-center justify-between bg-markee-bg/10 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-markee-text">Lịch sử làm việc: {selectedProject.name}</h2>
                <p className="text-xs text-markee-muted mt-0.5">Timeline ghi nhận các phiên làm việc và tri thức của dự án.</p>
              </div>
              <div className="flex items-center gap-3">
                {(profile.role === 'admin' || profile.role === 'super_admin') && (
                  <button
                    type="button"
                    onClick={handleSummarizeProject}
                    disabled={members.length === 0}
                    className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${members.length === 0
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                        : 'bg-markee-primary hover:bg-markee-hover text-white'
                      }`}
                  >
                    Tổng hợp Tri thức Dự án
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedProject(null)}
                  className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
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
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${projectTab === 'timeline'
                      ? 'border-markee-primary text-markee-primary'
                      : 'border-transparent text-markee-muted hover:text-markee-text'
                    }`}
                >
                  📅 Lịch sử Dự án
                </button>
                <button
                  type="button"
                  onClick={() => setProjectTab('knowledge_hub')}
                  className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${projectTab === 'knowledge_hub'
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
                          if (Array.isArray(parsed)) {
                            summaries = parsed.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
                          }
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
                          {summaries.map((summary: SummaryItem, idx: number) => (
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
                  <div className="flex-1 overflow-hidden p-6 flex flex-col md:flex-row gap-6">
                    {/* Left Sidebar: Active Members */}
                    <div className="w-full md:w-1/4 md:min-w-50 border-r border-markee-border pr-6 flex flex-col shrink-0">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col h-full overflow-hidden">
                        <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-3">
                          Thành viên hoạt động
                        </h4>

                        {membersLoading ? (
                          <div className="text-xs text-markee-muted py-2 animate-pulse">Đang tải...</div>
                        ) : members.length === 0 ? (
                          <div className="text-xs text-markee-muted py-2">Không có thành viên nào.</div>
                        ) : (
                          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 pr-1">
                            {members.map((m) => {
                              const isActive = activeMemberEmail === m.email;
                              const isCurrentUser = m.email === profile.email;
                              return (
                                <button
                                  key={m.email}
                                  type="button"
                                  onClick={() => handleSelectMember(m.email)}
                                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all border shrink-0 ${
                                    isActive
                                      ? 'bg-markee-primary/10 border-markee-primary/20 text-markee-primary font-bold'
                                      : 'hover:bg-slate-100 border-transparent text-markee-text'
                                  } w-full`}
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
                      ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-10 text-sm text-markee-sub">
                          Không có log hoạt động nào khớp bộ lọc.
                        </div>
                      ) : (
                        <div className="space-y-6">
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

                              const isOwnWIP = profile.email === log.author_id ||
                                (profile.dbUser?.id && String(profile.dbUser.id) === String(log.author_id)) ||
                                (profile.authUser?.id && String(profile.authUser.id) === String(log.author_id));
                              const canManageWIP = profile.role === 'admin' || profile.role === 'super_admin' || isOwnWIP;
                              const isDeleting = deletingIds.includes(log.id);

                              return (
                                <div
                                  key={log.id}
                                  className={`relative transition-all duration-500 ease-out ${isDeleting
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

                                          {canManageWIP && (
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
                                                  setNewProjectId(log.project_id ? log.project_id : '');
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
                                        {(() => {
                                          let parsed = null;
                                          if (log.attached_file) {
                                            if (typeof log.attached_file === 'object') {
                                              parsed = log.attached_file;
                                            } else if (typeof log.attached_file === 'string') {
                                              try {
                                                parsed = JSON.parse(log.attached_file);
                                              } catch (e) {}
                                            }
                                          }
                                          if (!parsed?.storage_path) return null;
                                          return (
                                            <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs bg-white">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-base shrink-0">📎</span>
                                                <span className="font-semibold text-slate-700 truncate" title={parsed.file_name}>
                                                  {parsed.file_name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                                  ({formatWipFileSize(parsed.size_bytes)})
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                  type="button"
                                                  onClick={() => window.dispatchEvent(new CustomEvent('markee_open_file_preview', {
                                                    detail: {
                                                      file_name: parsed.file_name,
                                                      storage_path: parsed.storage_path,
                                                      mime_type: parsed.mime_type || '',
                                                      source_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${parsed.storage_path}`
                                                    }
                                                  }))}
                                                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer font-sans"
                                                >
                                                  👁️ Xem trước
                                                </button>
                                                <a
                                                  href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${parsed.storage_path}?download=${parsed.file_name}`}
                                                  download={parsed.file_name}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-markee-primary hover:text-red-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer font-sans"
                                                >
                                                  Tải xuống
                                                </a>
                                              </div>
                                            </div>
                                          );
                                        })()}
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
                                type="button"
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
                type="button"
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Sửa bản nháp WIP</h3>
              <button
                type="button"
                onClick={() => setActiveEditWIP(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
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
                  <option value="">Khác</option>
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
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
                  {!activeMoveWIP.project_id && (
                    <option value="">-- Chọn Dự án --</option>
                  )}
                  {projects.map((p) => (
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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-red-600">Xác nhận Xóa</h3>
              <button
                type="button"
                onClick={() => setActiveDeleteWIP(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
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
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setProjectName('');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
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

      {/* Edit Project Modal */}
      {activeEditProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Chỉnh sửa {activeEditProject.name}</h2>
              <p className="text-xs text-markee-muted mt-1">Vui lòng nhập tên mới cho dự án.</p>
            </div>
            <form onSubmit={handleEditProjectSubmit} className="space-y-4">
              <div>
                <label htmlFor="editProjectNameInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Tên dự án
                </label>
                <input
                  id="editProjectNameInput"
                  type="text"
                  required
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                  placeholder="Nhập tên dự án..."
                  className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveEditProject(null);
                    setEditProjectName('');
                  }}
                  className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                  disabled={isEditingProject}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isEditingProject || !editProjectName.trim()}
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                >
                  {isEditingProject ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal (Red warning) */}
      {activeDeleteProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-red-600 flex items-center gap-2">
                ⚠️ Xác nhận Xóa Dự Án
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">
                Bạn có chắc chắn muốn xóa dự án <strong className="text-gray-900">"{activeDeleteProject.name}"</strong> không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setActiveDeleteProject(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                disabled={isDeletingProject}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteProjectSubmit}
                disabled={isDeletingProject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {isDeletingProject && <span className="animate-spin text-[10px]">⏳</span>}
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summarize Project Result Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold disabled:opacity-55 border-0 bg-transparent"
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
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px]">Nguồn Đóng Góp</div>
                      <div className="mt-1 font-bold text-markee-text">{summaryResult.contributors}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px]">Tổng Token Đọc</div>
                      <div className="mt-1 font-bold text-markee-text">{summaryResult.totalTokens.toLocaleString()} tokens</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px]">Mô hình tổng hợp</div>
                      <div className="mt-1 font-bold text-markee-text">{summaryResult.model}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-150 p-2.5 rounded-lg">
                      <div className="font-bold text-markee-muted uppercase tracking-wider text-[9px]">Quy đổi chi phí</div>
                      <div className="mt-1 font-bold text-markee-text">{(summaryResult.totalTokens * 0.000015).toFixed(4)} USD</div>
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
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              {summaryResult && (
                <button
                  type="button"
                  onClick={() => handleSaveSummary(summaryResult)}
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                >
                  Lưu Tri thức Tổng hợp
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
