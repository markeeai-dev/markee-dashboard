/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, Edit, Trash2, ArrowLeftRight, MoreVertical, Share } from 'lucide-react';
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
import ProjectDetailContent from './ProjectDetailContent';

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

  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  useEffect(() => {
    async function loadCustomers() {
      try {
        const { data, error } = await supabase.from('customers').select('id, name').order('name');
        if (!error) {
          setCustomers(data || []);
        }
      } catch (e) {
        console.error('Error fetching customers:', e);
      }
    }
    loadCustomers();
  }, []);

  const PROJECT_PAGE_SIZE = 9;
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(projectSearch.toLowerCase());
      const matchCustomer = selectedCustomerId === '' || String(p.customer_id) === selectedCustomerId;
      return matchSearch && matchCustomer;
    });
  }, [projects, projectSearch, selectedCustomerId]);

  const displayedProjects = useMemo(() => {
    const start = projectPage * PROJECT_PAGE_SIZE;
    return filteredProjects.slice(start, start + PROJECT_PAGE_SIZE);
  }, [filteredProjects, projectPage]);

  useEffect(() => {
    setProjectPage(0);
  }, [projectSearch, selectedCustomerId]);

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
  const [customerMode, setCustomerMode] = useState<'select' | 'create'>('select');
  const [projCustomerId, setProjCustomerId] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState('');
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
  const [editCustomerMode, setEditCustomerMode] = useState<'select' | 'create'>('select');
  const [editProjCustomerId, setEditProjCustomerId] = useState<string>('');
  const [editNewCustomerName, setEditNewCustomerName] = useState('');

  const [activeDeleteProject, setActiveDeleteProject] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  function handleEditProjectOpen(proj: Project) {
    setActiveEditProject(proj);
    setEditProjectName(proj.name);
    setEditProjCustomerId(proj.customer_id ? String(proj.customer_id) : '');
    setEditCustomerMode('select');
    setEditNewCustomerName('');
  }

  async function handleEditProjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = editProjectName.trim();
    if (!trimmed || !activeEditProject) return;
    setIsEditingProject(true);
    showToast('Đang cập nhật dự án...', 'loading');
    try {
      let targetCustomerId: string | null = null;

      if (editCustomerMode === 'create') {
        const trimmedCustName = editNewCustomerName.trim();
        if (!trimmedCustName) {
          showToast('Vui lòng nhập tên khách hàng mới', 'error');
          setIsEditingProject(false);
          return;
        }

        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ name: trimmedCustName })
          .select('id, name')
          .single();

        if (custErr) throw custErr;
        
        targetCustomerId = newCust.id;
        setCustomers(prev => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        if (!editProjCustomerId) {
          showToast('Vui lòng chọn khách hàng', 'error');
          setIsEditingProject(false);
          return;
        }
        targetCustomerId = editProjCustomerId;
      }

      const { error } = await supabase
        .from('projects')
        .update({ 
          name: trimmed,
          customer_id: targetCustomerId
        })
        .eq('id', activeEditProject.id);

      if (error) throw error;

      showToast('Cập nhật dự án thành công!', 'success');
      setProjects(prev => prev.map(p => p.id === activeEditProject.id ? { 
        ...p, 
        name: trimmed,
        customer_id: targetCustomerId
      } : p));
      
      if (selectedProject?.id === activeEditProject.id) {
        setSelectedProject(prev => prev ? { 
          ...prev, 
          name: trimmed,
          customer_id: targetCustomerId
        } : null);
      }
      setActiveEditProject(null);
    } catch (err: any) {
      console.error('Error editing project:', err);
      showToast(err.message || 'Lỗi khi cập nhật dự án', 'error');
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

  async function handleShareProject(projectId: number) {
    showToast('Đang tạo liên kết chia sẻ...', 'loading');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/share/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi tạo liên kết chia sẻ');
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const shareUrl = `${baseUrl}/shared/project/${data.share_token}`;
      await navigator.clipboard.writeText(shareUrl);
      showToast('Đã copy link chia sẻ', 'success');
    } catch (err: any) {
      console.error('Lỗi chia sẻ dự án:', err);
      showToast(err.message || 'Lỗi khi chia sẻ dự án', 'error');
    }
  }

  async function handleCreateProject() {
    const trimmedName = projectName.trim();
    if (!trimmedName) return;

    let targetCustomerId: string | null = null;

    setIsCreating(true);
    try {
      if (customerMode === 'create') {
        const trimmedCustName = newCustomerName.trim();
        if (!trimmedCustName) {
          showToast('Vui lòng nhập tên khách hàng mới', 'error');
          setIsCreating(false);
          return;
        }

        // Tạo khách hàng mới trước
        const { data: newCust, error: custErr } = await supabase
          .from('customers')
          .insert({ name: trimmedCustName })
          .select('id, name')
          .single();

        if (custErr) throw custErr;
        
        targetCustomerId = newCust.id;
        // Cập nhật danh sách local
        setCustomers(prev => [...prev, newCust].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        if (!projCustomerId) {
          showToast('Vui lòng chọn khách hàng', 'error');
          setIsCreating(false);
          return;
        }
        targetCustomerId = projCustomerId;
      }

      const newProject = await createNewProject(trimmedName, profile.email, 'WIP_GLOBAL', targetCustomerId);
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
      setNewCustomerName('');
      setProjCustomerId('');
      setCustomerMode('select');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Lỗi khi tạo dự án mới', 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function loadProjects() {
    setLoading(true);
    try {
      const data = await fetchProjects(undefined, false, 'WIP_GLOBAL', null, null);
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
  }, []);

  useEffect(() => {
    const openModalId = searchParams.get('open_modal_id');
    if (openModalId && projects.length > 0) {
      const projId = Number(openModalId);
      const matched = projects.find(p => p.id === projId);
      if (matched) {
        handleOpenProject(matched);
      }
    }
  }, [searchParams, projects]);

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

        {/* Customer Select */}
        <div className="w-56">
          <select
            value={selectedCustomerId}
            onChange={(e) => {
              const val = e.target.value ? e.target.value : '';
              setSelectedCustomerId(val);
            }}
            className="w-full rounded-xl border border-markee-border bg-white px-3.5 py-2.5 text-base md:text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
          >
            <option value="">Tất cả khách hàng</option>
            {customers.map((cust) => (
              <option key={cust.id} value={cust.id}>{cust.name}</option>
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
                        {(() => {
                          const customer = customers.find(c => c.id === String(project.customer_id));
                          return (
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5" title="Khách hàng">
                              {customer ? customer.name : 'Vãng lai'}
                            </span>
                          );
                        })()}
                        <h3 className="text-lg font-bold text-markee-text truncate group-hover:text-markee-primary transition-colors leading-snug">
                          {project.name}
                        </h3>
                        <p className="text-xs text-markee-muted truncate mt-1">
                          Dự án được tạo bởi {project.authorName}
                        </p>
                      </div>

                      {/* Action Menu (Kebab) cho Project */}
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
                                    handleShareProject(project.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent transition-colors"
                                >
                                  <Share className="h-3.5 w-3.5 text-gray-400" />
                                  Chia sẻ
                                </button>
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

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <ProjectDetailContent
            project={selectedProject}
            profile={profile}
            isReadOnly={false}
            onClose={() => setSelectedProject(null)}
            onProjectUpdated={(updatedProj) => {
              setSelectedProject(updatedProj);
              setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
            }}
          />
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

            {/* Customer Section */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-markee-text">
                Khách hàng
              </label>
              
              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCustomerMode('select')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors cursor-pointer ${customerMode === 'select' ? 'bg-white shadow-xs text-markee-text' : 'text-markee-muted hover:text-markee-text'}`}
                >
                  Chọn khách hàng cũ
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode('create')}
                  className={`flex-1 py-1.5 rounded-md text-center transition-colors cursor-pointer ${customerMode === 'create' ? 'bg-white shadow-xs text-markee-text' : 'text-markee-muted hover:text-markee-text'}`}
                >
                  ➕ Tạo khách hàng mới
                </button>
              </div>

              {/* Mode Select */}
              {customerMode === 'select' ? (
                <div>
                  <select
                    value={projCustomerId}
                    onChange={(e) => setProjCustomerId(e.target.value ? e.target.value : '')}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary cursor-pointer"
                  >
                    <option value="">-- Chọn khách hàng --</option>
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>{cust.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="Nhập tên khách hàng mới..."
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setProjectName('');
                  setNewCustomerName('');
                  setProjCustomerId('');
                  setCustomerMode('select');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={isCreating || !projectName.trim() || (customerMode === 'select' && !projCustomerId) || (customerMode === 'create' && !newCustomerName.trim())}
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

              {/* Edit Customer Section */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-markee-text">
                  Khách hàng
                </label>
                
                {/* Tab Selector */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEditCustomerMode('select')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-colors cursor-pointer ${editCustomerMode === 'select' ? 'bg-white shadow-xs text-markee-text' : 'text-markee-muted hover:text-markee-text'}`}
                  >
                    Chọn khách hàng cũ
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCustomerMode('create')}
                    className={`flex-1 py-1.5 rounded-md text-center transition-colors cursor-pointer ${editCustomerMode === 'create' ? 'bg-white shadow-xs text-markee-text' : 'text-markee-muted hover:text-markee-text'}`}
                  >
                    ➕ Tạo khách hàng mới
                  </button>
                </div>

                {/* Mode Select */}
                {editCustomerMode === 'select' ? (
                  <div>
                    <select
                      value={editProjCustomerId}
                      onChange={(e) => setEditProjCustomerId(e.target.value ? e.target.value : '')}
                      className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary cursor-pointer"
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {customers.map((cust) => (
                        <option key={cust.id} value={cust.id}>{cust.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={editNewCustomerName}
                      onChange={(e) => setEditNewCustomerName(e.target.value)}
                      placeholder="Nhập tên khách hàng mới..."
                      className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveEditProject(null);
                    setEditProjectName('');
                    setEditNewCustomerName('');
                    setEditProjCustomerId('');
                    setEditCustomerMode('select');
                  }}
                  className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                  disabled={isEditingProject}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isEditingProject || !editProjectName.trim() || (editCustomerMode === 'select' && !editProjCustomerId) || (editCustomerMode === 'create' && !editNewCustomerName.trim())}
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
                Bạn có chắc chắn muốn xóa dự án <strong className="text-gray-900">&quot;{activeDeleteProject.name}&quot;</strong> không? Hành động này không thể hoàn tác.
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


    </main>
  );
}
