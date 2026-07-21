'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Edit, Trash2, ArrowLeftRight } from 'lucide-react';
import FilePreviewModal from '@/app/components/Shared/FilePreviewModal';
import {
  fetchProjectWIPMembers,
  fetchProjectWIPsForUser,
  updateProjectSummary,
  type Project,
  type AISession,
} from '@/lib/dashboard-supabase';

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

function parseAttachedFiles(attached_file: any): any[] {
  if (!attached_file) return [];
  let parsed = null;
  if (typeof attached_file === 'object') {
    parsed = attached_file;
  } else if (typeof attached_file === 'string') {
    try {
      parsed = JSON.parse(attached_file);
    } catch (e) {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }
  
  if (parsed && parsed.storage_path) {
    return [parsed];
  }

  return [];
}


interface SummaryItem {
  title: string;
  insights: string[];
  contributors: string;
  totalTokens: number;
  model: string;
  timestamp?: string;
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

interface ProjectDetailContentProps {
  project: Project;
  profile: any;
  isReadOnly?: boolean;
  onClose?: () => void;
  onProjectUpdated?: (updatedProject: Project) => void;
}

export default function ProjectDetailContent({
  project: initialProject,
  profile,
  isReadOnly = false,
  onClose,
  onProjectUpdated,
}: ProjectDetailContentProps) {
  const [project, setProject] = useState<Project>(initialProject);
  const [projectTab, setProjectTab] = useState<'timeline' | 'knowledge_hub'>('timeline');

  // Modal logs and members states
  const [members, setMembers] = useState<{ email: string; name: string; avatarColor: string }[]>([]);
  const [activeMemberEmail, setActiveMemberEmail] = useState<string | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const [logs, setLogs] = useState<AISession[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // File preview state
  const [previewFile, setPreviewFile] = useState<{
    file_name: string;
    storage_path: string;
    mime_type: string;
    source_url: string;
  } | null>(null);

  // Modals inside detail content
  const [activeEditWIP, setActiveEditWIP] = useState<AISession | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFeatureName, setEditFeatureName] = useState('');
  const [isEditingWIP, setIsEditingWIP] = useState(false);
  const [editAttachedFiles, setEditAttachedFiles] = useState<any[]>([]);
  const [removedFiles, setRemovedFiles] = useState<any[]>([]);
  const [isUploadingWipFiles, setIsUploadingWipFiles] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const [selectedWipFileIdx, setSelectedWipFileIdx] = useState<{ [logId: number]: number }>({});

  const [activeMoveWIP, setActiveMoveWIP] = useState<AISession | null>(null);
  const [newProjectId, setNewProjectId] = useState<number | ''>('');
  const [isMovingWIP, setIsMovingWIP] = useState(false);
  const [otherProjects, setOtherProjects] = useState<Project[]>([]);

  const [activeDeleteWIP, setActiveDeleteWIP] = useState<AISession | null>(null);
  const [isDeletingWIP, setIsDeletingWIP] = useState(false);

  const [deletingIds, setDeletingIds] = useState<number[]>([]);

  // Summary states
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SummaryItem | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  function showToast(message: string, type: 'success' | 'error' | 'loading', duration = 3000) {
    setToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(current => current?.message === message ? null : current);
      }, duration);
    }
  }

  // Load members
  useEffect(() => {
    async function loadMembers() {
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
    loadMembers();
  }, [project.id]);

  // Load other projects for moving WIP
  useEffect(() => {
    if (!isReadOnly && activeMoveWIP) {
      async function loadOtherProjects() {
        try {
          const { data } = await supabase.from('projects').select('id, name').neq('id', project.id);
          setOtherProjects((data || []) as any[]);
        } catch (e) {
          console.error(e);
        }
      }
      loadOtherProjects();
    }
  }, [activeMoveWIP, project.id, isReadOnly]);

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

  function handleSelectMember(email: string) {
    setActiveMemberEmail(email);
    setLogs([]);
    setPage(0);
    setHasMore(false);
    loadUserLogs(project.id, email, true);
  }

  function handleLoadMore() {
    if (activeMemberEmail) {
      loadUserLogs(project.id, activeMemberEmail, false);
    }
  }

  const filteredLogs = useMemo(() => {
    if (!selectedFeature) return logs;
    return logs.filter(log => log.feature_name === selectedFeature);
  }, [logs, selectedFeature]);

  async function loadProjectFeatures() {
    if (!project?.id) return;
    try {
      const { data, error } = await supabase
        .from('skill_library')
        .select('feature_name')
        .eq('project_id', project.id)
        .not('feature_name', 'is', null);
      
      if (!error && data) {
        const uniqueFeatures = Array.from(new Set(data.map(d => d.feature_name).filter(Boolean))) as string[];
        setFeatures(uniqueFeatures.sort());
      }
    } catch (e) {
      console.error('Error fetching project features:', e);
    }
  }

  useEffect(() => {
    loadProjectFeatures();
  }, [project?.id]);

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
        
        const updatedProj = {
          ...project,
          logCount: Math.max(0, (project.logCount || 1) - 1)
        };
        setProject(updatedProj);
        if (onProjectUpdated) {
          onProjectUpdated(updatedProj);
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
        
        const updatedProj = {
          ...project,
          logCount: Math.max(0, (project.logCount || 1) - 1)
        };
        setProject(updatedProj);
        if (onProjectUpdated) {
          onProjectUpdated(updatedProj);
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/wip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: activeEditWIP.id,
          title: editTitle,
          markdown_content: editContent,
          feature_name: editFeatureName,
          attached_file: editAttachedFiles,
          removed_files: removedFiles
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Lỗi khi sửa bản nháp');
      }

      showToast('Cập nhật bản nháp thành công!', 'success');

      setLogs(prev => prev.map(l => l.id === activeEditWIP.id ? {
        ...l,
        title: editTitle,
        prompt_content: editContent,
        feature_name: editFeatureName,
        attached_file: editAttachedFiles
      } : l));

      // Load lại các tính năng (features) của dự án để cập nhật Autocomplete
      loadProjectFeatures();

      setActiveEditWIP(null);
    } catch (err: any) {
      console.error('Error editing WIP:', err);
      showToast(err.message || 'Lỗi khi sửa bản nháp', 'error');
    } finally {
      setIsEditingWIP(false);
    }
  }

  async function handleUploadWipFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingWipFiles(true);
    try {
      const newFilesArray = [...editAttachedFiles];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `skill_attachments/${uniqueName}`;

        const { error: uploadErr } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, file);

        if (uploadErr) throw uploadErr;

        newFilesArray.push({
          name: file.name,
          file_name: file.name,
          size: file.size,
          size_bytes: file.size,
          type: file.type,
          mime_type: file.type,
          storage_path: filePath
        });
      }
      setEditAttachedFiles(newFilesArray);
      showToast(`Đã tải lên thành công ${files.length} file!`, 'success');
    } catch (err) {
      console.error('Error uploading WIP files:', err);
      showToast('Lỗi khi tải file lên', 'error');
    } finally {
      setIsUploadingWipFiles(false);
      e.target.value = '';
    }
  }

  function handleRemoveWipFile(indexToRemove: number) {
    const fileToRemove = editAttachedFiles[indexToRemove];
    if (fileToRemove.storage_path) {
      setRemovedFiles(prev => [...prev, fileToRemove]);
    }
    setEditAttachedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
  }

  async function handleSummarizeProject() {
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
        body: JSON.stringify({ projectId: project.id }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi gọi API tổng hợp tri thức');
      }

      setSummaryResult(data);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Lỗi khi tổng hợp tri thức dự án', 'error');
      setIsSummaryModalOpen(false);
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleSaveSummary(newSummary: SummaryItem) {
    let currentSummaries: SummaryItem[] = [];
    if (project.master_summary) {
      try {
        const parsed = JSON.parse(project.master_summary) as SummaryItem[];
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
      await updateProjectSummary(project.id, serialized);

      const updatedProj = {
        ...project,
        master_summary: serialized,
        last_summarized_at: new Date().toISOString(),
      };
      setProject(updatedProj);
      if (onProjectUpdated) {
        onProjectUpdated(updatedProj);
      }

      showToast('Đã lưu tổng hợp tri thức thành công!', 'success');
      setProjectTab('knowledge_hub');
      setIsSummaryModalOpen(false);
      setSummaryResult(null);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi lưu tổng hợp tri thức', 'error');
    }
  }

  // Check management permission (Only admin or creators)
  const isCreatorOrAdmin = useMemo(() => {
    if (isReadOnly || !profile) return false;
    return project.created_by === profile.email || profile.role === 'admin' || profile.role === 'super_admin';
  }, [project.created_by, profile, isReadOnly]);

  return (
    <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-5xl w-full h-[80vh] max-h-[85vh] overflow-hidden flex flex-col">
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

      {/* Modal Header */}
      <div className="border-b border-markee-border px-6 py-4 flex items-center justify-between bg-markee-bg/10 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-markee-text">Lịch sử làm việc: {project.name}</h2>
          <p className="text-xs text-markee-muted mt-0.5">Timeline ghi nhận các phiên làm việc và tri thức của dự án.</p>
        </div>
        <div className="flex items-center gap-3">
          {!isReadOnly && isCreatorOrAdmin && (
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
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
            >
              ✕
            </button>
          )}
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
                ? 'border-markee-primary text-markee-primary font-bold'
                : 'border-transparent text-markee-muted hover:text-markee-text'
              }`}
          >
            📅 Lịch sử Dự án
          </button>
          <button
            type="button"
            onClick={() => setProjectTab('knowledge_hub')}
            className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${projectTab === 'knowledge_hub'
                ? 'border-markee-primary text-markee-primary font-bold'
                : 'border-transparent text-markee-muted hover:text-markee-text'
              }`}
          >
            🧠 Knowledge Hub ({
              (() => {
                if (!project?.master_summary) return 0;
                try {
                  const parsed = JSON.parse(project.master_summary);
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
                if (project?.master_summary) {
                  try {
                    const parsed = JSON.parse(project.master_summary) as SummaryItem[];
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
                      Chưa có bản tổng hợp tri thức nào.
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
                        const isCurrentUser = profile && m.email === profile.email;
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
                {/* Feature Filter Select */}
                <div className="mb-4 flex items-center justify-between border-b border-markee-border pb-3 shrink-0">
                  <h4 className="text-xs font-bold text-markee-text flex items-center gap-1.5 uppercase tracking-wider">
                    <span>🎯</span> Lọc theo tính năng
                  </h4>
                  <div className="w-52">
                    <select
                      value={selectedFeature}
                      onChange={(e) => setSelectedFeature(e.target.value)}
                      className="w-full rounded-lg border border-markee-border bg-white px-2.5 py-1.5 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
                    >
                      <option value="">Tất cả tính năng</option>
                      {features.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {logsLoading && logs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-markee-sub">Đang tải nhật ký hoạt động...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-markee-sub">
                    Không có log hoạt động nào.
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="text-center py-10 text-sm text-markee-sub">
                    Không tìm thấy bản nháp nào khớp với tính năng này.
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

                        const isOwnWIP = profile && (profile.email === log.author_id ||
                          (profile.dbUser?.id && String(profile.dbUser.id) === String(log.author_id)) ||
                          (profile.authUser?.id && String(profile.authUser.id) === String(log.author_id)));
                        const canManageWIP = !isReadOnly && profile && (profile.role === 'admin' || profile.role === 'super_admin' || isOwnWIP);
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
                                      {log.feature_name && (
                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-bold border border-purple-100">
                                          {log.feature_name}
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
                                            setEditFeatureName(log.feature_name || '');
                                            const files = parseAttachedFiles(log.attached_file);
                                            setEditAttachedFiles(files);
                                            setRemovedFiles([]);
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
                                    const files = parseAttachedFiles(log.attached_file);
                                    if (files.length === 0) return null;

                                    const currentIdx = selectedWipFileIdx[log.id] ?? 0;
                                    const file = files[currentIdx] || files[0];

                                    const fName = file.name || file.file_name || 'attachment';
                                    const fSize = file.size || file.size_bytes || 0;
                                    const fType = file.type || file.mime_type || '';
                                    const sPath = file.storage_path || '';
                                    const sourceUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${sPath}`;

                                    return (
                                      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-2.5 text-xs bg-white">
                                        {/* Tiêu đề & Chọn file (nếu có từ 2 file trở lên) */}
                                        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 shrink-0">
                                          <div className="flex items-center gap-1">
                                            <span className="text-sm">📎</span>
                                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                                              Tài liệu đính kèm ({files.length})
                                            </span>
                                          </div>
                                          
                                          {files.length > 1 && (
                                            <select
                                              value={currentIdx}
                                              onChange={(e) => {
                                                const val = Number(e.target.value);
                                                setSelectedWipFileIdx(prev => ({ ...prev, [log.id]: val }));
                                              }}
                                              className="text-[10px] font-bold text-markee-primary bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-markee-primary transition-colors max-w-[150px] truncate"
                                            >
                                              {files.map((f: any, fIdx: number) => (
                                                <option key={fIdx} value={fIdx}>
                                                  {f.name || f.file_name || `Tài liệu ${fIdx + 1}`}
                                                </option>
                                              ))}
                                            </select>
                                          )}
                                        </div>

                                        {/* Render duy nhất file được chọn */}
                                        <div className="flex items-center justify-between gap-2 bg-white border border-slate-100 rounded-lg p-2">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="text-sm shrink-0">📄</span>
                                            <span className="font-semibold text-slate-700 truncate text-[11px]" title={fName}>
                                              {fName}
                                            </span>
                                            <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                              ({formatWipFileSize(fSize)})
                                            </span>
                                          </div>
                                          
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => setPreviewFile({
                                                file_name: fName,
                                                storage_path: sPath,
                                                mime_type: fType,
                                                source_url: sourceUrl
                                              })}
                                              className="px-1.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 font-bold rounded text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer font-sans"
                                            >
                                              👁️ Xem
                                            </button>
                                            <a
                                              href={`${sourceUrl}?download=${fName}`}
                                              download={fName}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="px-1.5 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 text-markee-primary hover:text-red-700 font-bold rounded text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer font-sans"
                                            >
                                              Tải về
                                            </a>
                                          </div>
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
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Footer */}
      {onClose && (
        <div className="border-t border-markee-border px-6 py-3.5 flex justify-end bg-markee-bg/10 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-markee-border bg-white text-markee-text hover:bg-markee-bg rounded-lg transition-colors text-xs font-semibold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Modals for editing/moving/deleting WIP inside detail */}
      {activeEditWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
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
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="editWipFeatureInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Tính năng
                </label>
                <input
                  id="editWipFeatureInput"
                  list="projectFeaturesDatalist"
                  type="text"
                  value={editFeatureName}
                  onChange={(e) => setEditFeatureName(e.target.value)}
                  placeholder="Nhập hoặc chọn tính năng..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none"
                />
                <datalist id="projectFeaturesDatalist">
                  {features.map((f, idx) => (
                    <option key={idx} value={f} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="editWipContentInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Nội dung Markdown
                </label>
                <textarea
                  id="editWipContentInput"
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Nhập nội dung markdown..."
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none font-mono"
                />
              </div>

              {/* Đính kèm tài liệu (Upload nhiều file) */}
              <div className="border-t border-slate-100 pt-4 mt-2">
                <label className="block text-xs font-semibold text-markee-text mb-1.5">
                  Đính kèm tài liệu (Đa file)
                </label>
                
                {/* Upload input button */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="wipFileUploadInput"
                    type="file"
                    multiple
                    disabled={isUploadingWipFiles}
                    onChange={handleUploadWipFiles}
                    className="hidden"
                  />
                  <label
                    htmlFor="wipFileUploadInput"
                    className={`px-3 py-2 border border-dashed border-slate-300 hover:border-markee-primary rounded-lg text-xs font-semibold hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors select-none ${isUploadingWipFiles ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <span>📎</span>
                    <span>{isUploadingWipFiles ? 'Đang tải lên...' : 'Chọn các file đính kèm...'}</span>
                  </label>
                </div>

                {/* Danh sách file đã đính kèm */}
                {editAttachedFiles.length > 0 && (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {editAttachedFiles.map((file, idx) => {
                      const fName = file.name || file.file_name || 'attachment';
                      const fSize = file.size || file.size_bytes || 0;
                      
                      return (
                         <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                           <div className="flex items-center gap-2 min-w-0">
                             <span className="shrink-0 text-sm">📄</span>
                             <span className="font-semibold text-slate-700 truncate text-[11px] max-w-[200px]" title={fName}>
                               {fName}
                             </span>
                             <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                               ({formatWipFileSize(fSize)})
                             </span>
                           </div>
                           <button
                             type="button"
                             onClick={() => handleRemoveWipFile(idx)}
                             className="text-red-500 hover:text-red-700 transition-colors p-1 border-0 bg-transparent cursor-pointer font-bold shrink-0 text-xs"
                             title="Gỡ bỏ"
                           >
                             ✕
                           </button>
                         </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveEditWIP(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleEditWIP}
                disabled={isEditingWIP || !editTitle.trim() || !editContent.trim()}
                className="px-4 py-2 bg-markee-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isEditingWIP ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMoveWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
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

            <div className="p-6 space-y-4">
              <p className="text-xs text-markee-muted leading-relaxed">
                Bạn đang chuyển bản nháp <span className="font-bold text-markee-text">&quot;{activeMoveWIP.title || 'Không có tiêu đề'}&quot;</span> sang một dự án khác.
              </p>
              <div>
                <label htmlFor="moveWipProjectSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Chọn dự án đích
                </label>
                <select
                  id="moveWipProjectSelect"
                  value={newProjectId}
                  onChange={(e) => setNewProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn dự án --</option>
                  {otherProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveMoveWIP(null);
                  setNewProjectId('');
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleMoveWIP}
                disabled={isMovingWIP || !newProjectId}
                className="px-4 py-2 bg-markee-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isMovingWIP ? 'Đang chuyển...' : 'Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDeleteWIP && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-2">Xóa bản nháp WIP</h3>
            <p className="text-xs text-slate-500 font-medium mb-5">
              Bạn có chắc chắn muốn xóa bản nháp <strong className="text-slate-800 font-bold">&quot;{activeDeleteWIP.title || 'Không có tiêu đề'}&quot;</strong>? Thao tác này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveDeleteWIP(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteWIP}
                disabled={isDeletingWIP}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg cursor-pointer transition-colors duration-200"              >
                {isDeletingWIP ? 'Đang xóa...' : 'Đồng ý xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSummaryModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-3xl w-full h-[75vh] overflow-hidden flex flex-col">
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Tổng hợp Tri thức Dự án</h3>
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isSummarizing ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 animate-pulse">
                  <span className="animate-spin text-xl">⏳</span>
                  <p className="text-xs text-markee-muted font-bold">Đang phân tích và tổng hợp...</p>
                </div>
              ) : summaryResult ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs text-emerald-800 font-medium">
                    Phân tích AI hoàn thành! Vui lòng kiểm tra lại nội dung tóm tắt bên dưới.
                  </div>
                  
                  <div className="border border-markee-border rounded-xl p-5 space-y-4 bg-slate-50/30">
                    <div>
                      <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-1">Tiêu đề bản tổng hợp</h4>
                      <input
                        type="text"
                        value={summaryResult.title}
                        onChange={(e) => setSummaryResult({ ...summaryResult, title: e.target.value })}
                        className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white font-bold"
                      />
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-markee-muted uppercase tracking-wider mb-2">Insights</h4>
                      <ul className="list-disc pl-5 text-xs text-markee-text space-y-2">
                        {summaryResult.insights.map((insight, idx) => (
                          <li key={idx}>
                            <textarea
                              rows={2}
                              value={insight}
                              onChange={(e) => {
                                const newInsights = [...summaryResult.insights];
                                newInsights[idx] = e.target.value;
                                setSummaryResult({ ...summaryResult, insights: newInsights });
                              }}
                              className="w-full px-2 py-1 text-xs border border-slate-200 focus:border-slate-350 rounded-md bg-white resize-none"
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 text-xs text-markee-muted italic">Lỗi khi tổng hợp.</div>
              )}
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setIsSummaryModalOpen(false)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              {summaryResult && !isSummarizing && (
                <button
                  type="button"
                  onClick={() => handleSaveSummary(summaryResult)}
                  className="px-4 py-2 bg-markee-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Lưu vào Knowledge Hub
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
      />
    </div>
  );
}
