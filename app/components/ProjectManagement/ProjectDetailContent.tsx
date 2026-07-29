/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Edit, Trash2, ChevronDown, ChevronRight, Upload, MoreVertical, Share2 } from 'lucide-react';
import FilePreviewModal from '@/app/components/Shared/FilePreviewModal';
import { MarkdownRenderer } from '@/app/components/AIChat/MarkdownRenderer';
import {
  fetchProjectWIPMembers,
  fetchProjectWIPsForUser,
  updateProjectSummary,
  type Project,
  type AISession,
} from '@/lib/dashboard-supabase';

async function uploadFilesToSupabaseStorage(files: FileList | File[]): Promise<any[]> {
  const uploaded: any[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileExt = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `skill_attachments/${uniqueName}`;

    const { error: uploadErr } = await supabase.storage
      .from('chat_attachments')
      .upload(filePath, file);

    if (uploadErr) throw uploadErr;

    uploaded.push({
      name: file.name,
      file_name: file.name,
      size: file.size,
      size_bytes: file.size,
      type: file.type,
      mime_type: file.type,
      storage_path: filePath
    });
  }
  return uploaded;
}

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
  id?: string;
  projectId?: number;
  featureId?: string;
  title: string;
  feature_name?: string;
  content?: string;
  markdown?: string;
  objective?: string;
  decisions?: string[];
  next_steps?: string[];
  insights?: string[];
  contributors?: string;
  totalTokens?: number;
  model?: string;
  timestamp?: string;
  files?: any[];
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

  // Ref to track whether we are waiting to scroll to a specific WIP after logs load
  const scrollPendingRef = useRef<string | null>(null);

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
  const [editMoveProjectId, setEditMoveProjectId] = useState<number | ''>('');
  const [isEditingWIP, setIsEditingWIP] = useState(false);
  const [editAttachedFiles, setEditAttachedFiles] = useState<any[]>([]);
  const [removedFiles, setRemovedFiles] = useState<any[]>([]);
  const [isUploadingWipFiles, setIsUploadingWipFiles] = useState(false);
  const [features, setFeatures] = useState<string[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<string>('');
  const [selectedWipFileIdx, setSelectedWipFileIdx] = useState<{ [logId: number]: number }>({});
  const [isOpenMembers, setIsOpenMembers] = useState(false);
  const [isOpenFeatures, setIsOpenFeatures] = useState(true);
  const [uploadingLogId, setUploadingLogId] = useState<number | null>(null);

  // Feature menu & Knowledge Hub merge states
  const [openFeatureMenu, setOpenFeatureMenu] = useState<string | null>(null);
  const [featureMenuPos, setFeatureMenuPos] = useState<{ f: string; top: number; left: number } | null>(null);
  const [featureToMerge, setFeatureToMerge] = useState<string | null>(null);
  const [selectedMergeLogIds, setSelectedMergeLogIds] = useState<number[]>([]);
  const [isMergingKnowledge, setIsMergingKnowledge] = useState(false);
  const [editingSummaryItem, setEditingSummaryItem] = useState<SummaryItem | null>(null);

  const [activeMoveWIP, setActiveMoveWIP] = useState<AISession | null>(null);
  const [newProjectId, setNewProjectId] = useState<number | ''>('');
  const [isMovingWIP, setIsMovingWIP] = useState(false);
  const [otherProjects, setOtherProjects] = useState<Project[]>([]);

  const [activeDeleteWIP, setActiveDeleteWIP] = useState<AISession | null>(null);
  const [isDeletingWIP, setIsDeletingWIP] = useState(false);

  const [activeDeleteSummaryItem, setActiveDeleteSummaryItem] = useState<SummaryItem | null>(null);
  const [isDeletingSummaryItem, setIsDeletingSummaryItem] = useState(false);

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

  const searchParams = useSearchParams();

  // URL Deep Linking: apply feature filter from URL
  useEffect(() => {
    if (!searchParams) return;
    const featureParam = searchParams.get('feature');
    if (featureParam) {
      setSelectedFeature(featureParam);
    }
  }, [searchParams]);

  // URL Deep Linking: resolve ?wip= to its author + feature, then load the right logs
  useEffect(() => {
    if (!searchParams || !project?.id) return;
    const wipParam = searchParams.get('wip');
    if (!wipParam) return;

    // Mark that we need to scroll to this WIP once the correct logs arrive
    scrollPendingRef.current = wipParam;

    async function resolveWipAndLoadLogs() {
      try {
        const { data } = await supabase
          .from('skill_library')
          .select('author_id, feature_name')
          .eq('id', Number(wipParam))
          .single();

        if (!data?.author_id) return;

        // Apply feature filter if available
        if (data.feature_name) {
          setSelectedFeature(data.feature_name);
        }

        // Select the correct member and load their logs
        setActiveMemberEmail(data.author_id);
        setLogs([]);
        setPage(0);
        setHasMore(false);
        await loadUserLogs(project.id, data.author_id, true);
      } catch (e) {
        console.error('Error resolving WIP deep link:', e);
        scrollPendingRef.current = null;
      }
    }

    resolveWipAndLoadLogs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, project?.id]);

  // Scroll & highlight the target WIP once the correct logs have been loaded into the DOM
  useEffect(() => {
    const wipId = scrollPendingRef.current;
    if (!wipId || logs.length === 0) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`wip-log-${wipId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-markee-primary', 'bg-red-50/20');
        // Clear the pending flag so subsequent log updates don't re-trigger scroll
        scrollPendingRef.current = null;
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [logs]);

  // Load members list for Sidebar — skip auto-selecting Member 1 when a ?wip= param is present
  useEffect(() => {
    async function loadMembers() {
      setMembersLoading(true);
      try {
        const activeMembers = await fetchProjectWIPMembers(project.id);
        setMembers(activeMembers);

        // Only auto-select Member 1 if there is no wip deep-link
        // (the wip deep-link effect owns member selection in that case)
        const wipParam = searchParams?.get('wip');
        if (!wipParam && activeMembers.length > 0) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const target = selectedFeature.trim().toLowerCase();
    return logs.filter(log => {
      const feat = (log.feature_name || log.team_track || '').trim().toLowerCase();
      return feat === target;
    });
  }, [logs, selectedFeature]);

  async function loadProjectFeatures() {
    if (!project?.id) return;
    try {
      const targetProjId = Number(project.id);
      const { data, error } = await supabase
        .from('skill_library')
        .select('feature_name')
        .eq('project_id', targetProjId)
        .not('feature_name', 'is', null);
      
      let dbFeatures: string[] = [];
      if (!error && data) {
        dbFeatures = data.map(d => d.feature_name).filter(Boolean) as string[];
      }

      const logFeatures = logs.map(l => l.feature_name).filter(Boolean) as string[];
      const uniqueFeatures = Array.from(new Set([...dbFeatures, ...logFeatures]));
      setFeatures(uniqueFeatures.sort());
    } catch (e) {
      console.error('Error fetching project features:', e);
    }
  }

  useEffect(() => {
    loadProjectFeatures();
  }, [project?.id, logs]);

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

  async function handleConfirmMergeKnowledge() {
    if (!featureToMerge || selectedMergeLogIds.length === 0) return;
    setIsMergingKnowledge(true);
    try {
      const selectedLogs = logs.filter(l => selectedMergeLogIds.includes(l.id));
      const logTexts = selectedLogs.map(l => `### Tiêu đề: ${l.title || 'Nhật ký'}\n\n${l.prompt_content || ''}`);

      const allAttachedFiles: any[] = [];
      selectedLogs.forEach(l => {
        const files = parseAttachedFiles(l.attached_file);
        allAttachedFiles.push(...files);
      });

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/summarize-project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          projectId: project.id,
          featureName: featureToMerge,
          wipLogsContent: logTexts
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Lỗi từ AI API');
      }

      const generatedMarkdown = data.markdown || data.content || '';
      const generatedTitle = data.title || `Tri thức tính năng: ${featureToMerge}`;

      const newSummaryObj: SummaryItem = {
        id: `summary_${Date.now()}`,
        projectId: project.id,
        featureId: featureToMerge,
        feature_name: featureToMerge,
        title: generatedTitle,
        content: generatedMarkdown,
        files: allAttachedFiles,
        contributors: profile?.email || 'Hệ thống',
        timestamp: new Date().toISOString()
      };

      // Set up Edit Modal prefilled for review
      setEditingSummaryItem(newSummaryObj);
      setEditTitle(generatedTitle);
      setEditContent(generatedMarkdown);
      setEditFeatureName(featureToMerge);
      setEditMoveProjectId(project.id);
      setEditAttachedFiles(allAttachedFiles);

      setFeatureToMerge(null);
      showToast('AI đã tổng hợp xong! Vui lòng xem lại & lưu.', 'success');
    } catch (err: any) {
      console.error('Error merging knowledge:', err);
      showToast(`Lỗi tổng hợp tri thức: ${err.message || err}`, 'error');
    } finally {
      setIsMergingKnowledge(false);
    }
  }

  async function handleSaveEditedSummary() {
    if (!editTitle.trim() || !editContent.trim()) return;
    setIsEditingWIP(true);
    try {
      const targetProjId = editMoveProjectId || project.id;
      let currentSummaries: SummaryItem[] = [];

      let targetProjectObj = project;
      if (targetProjId !== project.id) {
        const found = otherProjects.find(p => p.id === targetProjId);
        if (found) targetProjectObj = found;
      }

      if (targetProjectObj.master_summary) {
        try {
          const parsed = JSON.parse(targetProjectObj.master_summary);
          if (Array.isArray(parsed)) currentSummaries = parsed;
        } catch (e) {
          console.error(e);
        }
      }

      const updatedItem: SummaryItem = {
        id: editingSummaryItem?.id || `summary_${Date.now()}`,
        projectId: targetProjId,
        featureId: editFeatureName,
        feature_name: editFeatureName,
        title: editTitle.trim(),
        content: editContent.trim(),
        insights: editContent.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '')),
        files: editAttachedFiles,
        contributors: editingSummaryItem?.contributors || profile?.email || 'Hệ thống',
        totalTokens: editingSummaryItem?.totalTokens || 0,
        model: editingSummaryItem?.model || 'Gemini 3.5 Flash',
        timestamp: editingSummaryItem?.timestamp || new Date().toISOString()
      };

      let newSummaries: SummaryItem[] = [];
      if (editingSummaryItem?.id) {
        newSummaries = [updatedItem, ...currentSummaries.filter(s => s.id !== editingSummaryItem.id)];
      } else {
        newSummaries = [updatedItem, ...currentSummaries.filter(s => s.feature_name !== editFeatureName)];
      }

      const serialized = JSON.stringify(newSummaries);
      await updateProjectSummary(targetProjId, serialized);

      if (targetProjId === project.id) {
        const updatedProj = { ...project, master_summary: serialized };
        setProject(updatedProj);
        if (onProjectUpdated) onProjectUpdated(updatedProj);
      }

      showToast('Đã lưu bản Tri thức Tổng hợp!', 'success');
      setEditingSummaryItem(null);
      setActiveEditWIP(null);
      setProjectTab('knowledge_hub');
    } catch (err) {
      console.error('Error saving summary edit:', err);
      showToast('Lỗi khi lưu tri thức tổng hợp', 'error');
    } finally {
      setIsEditingWIP(false);
    }
  }

  function handleDeleteSummaryItem(summaryToDelete: SummaryItem) {
    setActiveDeleteSummaryItem(summaryToDelete);
  }

  async function confirmDeleteSummaryItem() {
    if (!activeDeleteSummaryItem) return;
    setIsDeletingSummaryItem(true);
    try {
      let currentSummaries: SummaryItem[] = [];
      if (project.master_summary) {
        try {
          const parsed = JSON.parse(project.master_summary);
          if (Array.isArray(parsed)) currentSummaries = parsed;
        } catch (e) {
          console.error(e);
        }
      }

      const updated = currentSummaries.filter(s => s.id ? s.id !== activeDeleteSummaryItem.id : s.title !== activeDeleteSummaryItem.title);
      const serialized = JSON.stringify(updated);
      await updateProjectSummary(project.id, serialized);

      const updatedProj = { ...project, master_summary: serialized };
      setProject(updatedProj);
      if (onProjectUpdated) onProjectUpdated(updatedProj);
      showToast('Đã xóa bản tri thức khỏi Knowledge Hub', 'success');
      setActiveDeleteSummaryItem(null);
    } catch (e) {
      console.error(e);
      showToast('Lỗi khi xóa bản tri thức', 'error');
    } finally {
      setIsDeletingSummaryItem(false);
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

      // If user selected to move to another project inside Edit Modal
      if (editMoveProjectId && Number(editMoveProjectId) !== Number(project.id)) {
        await supabase.from('skill_library').update({ project_id: Number(editMoveProjectId) }).eq('id', activeEditWIP.id);
        setLogs(prev => prev.filter(l => l.id !== activeEditWIP.id));
        showToast('Cập nhật & chuyển dự án thành công!', 'success');
      } else {
        showToast('Cập nhật bản nháp thành công!', 'success');
        setLogs(prev => prev.map(l => l.id === activeEditWIP.id ? {
          ...l,
          title: editTitle,
          prompt_content: editContent,
          feature_name: editFeatureName,
          attached_file: editAttachedFiles
        } : l));
      }

      loadProjectFeatures();
      setActiveEditWIP(null);
    } catch (err: any) {
      console.error('Error editing WIP:', err);
      showToast(err.message || 'Lỗi khi sửa bản nháp', 'error');
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
      const uploaded = await uploadFilesToSupabaseStorage(files);
      setEditAttachedFiles(prev => [...prev, ...uploaded]);
      showToast(`Đã tải lên thành công ${files.length} file!`, 'success');
    } catch (err) {
      console.error('Error uploading WIP files:', err);
      showToast('Lỗi khi tải file lên', 'error');
    } finally {
      setIsUploadingWipFiles(false);
      e.target.value = '';
    }
  }

  async function handleQuickUploadFiles(e: React.ChangeEvent<HTMLInputElement>, log: AISession) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingLogId(log.id);
    try {
      const currentFiles = parseAttachedFiles(log.attached_file);
      const uploaded = await uploadFilesToSupabaseStorage(files);
      const updatedAttachedFiles = [...currentFiles, ...uploaded];

      const { error } = await supabase
        .from('skill_library')
        .update({ attached_file: updatedAttachedFiles })
        .eq('id', log.id);

      if (error) throw error;

      setLogs(prev => prev.map(l => l.id === log.id ? {
        ...l,
        attached_file: updatedAttachedFiles
      } : l));

      showToast(`Đã tải lên và đính kèm ${files.length} file!`, 'success');
    } catch (err) {
      console.error('Error in quick upload files:', err);
      showToast('Lỗi khi đính kèm file', 'error');
    } finally {
      setUploadingLogId(null);
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
    <div className="bg-white border border-markee-border rounded-xl shadow-2xl w-[90vw] max-w-5xl h-[82vh] overflow-hidden flex flex-col">
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
                  if (!Array.isArray(parsed)) return 0;
                  if (!selectedFeature) return parsed.length;
                  return parsed.filter(s => (s.feature_name || '').trim().toLowerCase() === selectedFeature.trim().toLowerCase()).length;
                } catch {
                  return 0;
                }
              })()
            })
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row p-6 gap-6">
          {/* Left Sidebar: Features Accordion (Block 1) & Active Members Accordion (Block 2) */}
          <div className="w-full md:w-1/4 md:min-w-56 border-r border-markee-border pr-6 flex flex-col shrink-0 overflow-y-auto space-y-4">
            
            {/* Block 1: TÍNH NĂNG Accordion (POSITIONED FIRST!) */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col">
              <button
                type="button"
                onClick={() => setIsOpenFeatures(!isOpenFeatures)}
                className="flex items-center justify-between w-full text-xs font-bold text-markee-muted uppercase tracking-wider cursor-pointer border-0 bg-transparent py-1"
              >
                <span>🎯 Tính năng ({features.length})</span>
                {isOpenFeatures ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />}
              </button>

              {isOpenFeatures && (
                <div className="mt-3 flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedFeature('')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border shrink-0 ${
                      selectedFeature === ''
                        ? 'bg-markee-primary/10 border-markee-primary/20 text-markee-primary font-bold'
                        : 'hover:bg-slate-100 border-transparent text-markee-text bg-white'
                    } w-full`}
                  >
                    <span>Tất cả tính năng</span>
                    {selectedFeature === '' && <span className="text-[10px] text-markee-primary font-bold">✓</span>}
                  </button>

                  {features.map((f) => {
                    const isActive = selectedFeature === f;
                    const isMenuOpen = openFeatureMenu === f;
                    return (
                      <div key={f} className="relative flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedFeature(prev => prev === f ? '' : f)}
                          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all border min-w-0 ${
                            isActive
                              ? 'bg-markee-primary/10 border-markee-primary/20 text-markee-primary font-bold'
                              : 'hover:bg-slate-100 border-transparent text-markee-text bg-white'
                          }`}
                        >
                          <span className="truncate">{f}</span>
                          {isActive && <span className="text-[10px] text-markee-primary font-bold shrink-0 ml-1">✓</span>}
                        </button>

                        <button
                          type="button"
                          title="Tùy chọn tính năng"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openFeatureMenu === f) {
                              setOpenFeatureMenu(null);
                              setFeatureMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const dropdownWidth = 224; // w-56
                              const dropdownHeight = 90;
                              const margin = 12;

                              let left = rect.right + 8;
                              let top = rect.top;

                              if (left + dropdownWidth > window.innerWidth - margin) {
                                left = rect.left - dropdownWidth - 8;
                              }
                              if (left < margin) {
                                left = Math.max(margin, window.innerWidth - dropdownWidth - margin);
                              }
                              if (top + dropdownHeight > window.innerHeight - margin) {
                                top = Math.max(margin, window.innerHeight - dropdownHeight - margin);
                              }

                              setOpenFeatureMenu(f);
                              setFeatureMenuPos({ f, top, left });
                            }
                          }}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors bg-white cursor-pointer shrink-0"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Feature Dropdown Backdrop Overlay */}
            {openFeatureMenu && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed inset-0 z-99 bg-transparent"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenFeatureMenu(null);
                  setFeatureMenuPos(null);
                }}
              />,
              document.body
            )}

            {/* Feature Dropdown Menu Portal */}
            {openFeatureMenu && featureMenuPos && typeof document !== 'undefined' && createPortal(
              <div
                className="fixed z-100 bg-white border border-slate-200 rounded-xl shadow-xl py-1 w-56 animate-in fade-in duration-150"
                style={{
                  top: `${featureMenuPos.top}px`,
                  left: `${featureMenuPos.left}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    const f = openFeatureMenu;
                    setOpenFeatureMenu(null);
                    setFeatureMenuPos(null);
                    const url = `${window.location.origin}/projects?projectId=${project.id}&feature=${encodeURIComponent(f)}`;
                    navigator.clipboard?.writeText(url);
                    showToast('Đã sao chép link tính năng!', 'success');
                  }}
                  className="w-full px-3 py-2 text-xs text-left font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer border-0"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Chia sẻ link tính năng</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const f = openFeatureMenu;
                    setOpenFeatureMenu(null);
                    setFeatureMenuPos(null);
                    const featureLogs = logs.filter(l => (l.feature_name || l.team_track || '').trim().toLowerCase() === f.trim().toLowerCase());
                    setSelectedMergeLogIds(featureLogs.map(l => l.id));
                    setFeatureToMerge(f);
                  }}
                  className="w-full px-3 py-2 text-xs text-left font-semibold text-markee-primary hover:bg-red-50 flex items-center gap-2 transition-colors cursor-pointer border-0"
                >
                  <span>🧠</span>
                  <span>Gộp toàn bộ log vào Knowledge Hub</span>
                </button>
              </div>,
              document.body
            )}

            {/* Block 2: THÀNH VIÊN HOẠT ĐỘNG Accordion (HIDDEN WHEN ON KNOWLEDGE HUB TAB) */}
            {projectTab !== 'knowledge_hub' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col">
                <button
                  type="button"
                  onClick={() => setIsOpenMembers(!isOpenMembers)}
                  className="flex items-center justify-between w-full text-xs font-bold text-markee-muted uppercase tracking-wider cursor-pointer border-0 bg-transparent py-1"
                >
                  <span>Thành viên hoạt động ({members.length})</span>
                  {isOpenMembers ? <ChevronDown className="w-4 h-4 shrink-0 text-slate-500" /> : <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" />}
                </button>

                {isOpenMembers && (
                  <div className="mt-3">
                    {membersLoading ? (
                      <div className="text-xs text-markee-muted py-2 animate-pulse">Đang tải...</div>
                    ) : members.length === 0 ? (
                      <div className="text-xs text-markee-muted py-2">Không có thành viên nào.</div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
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
                                  : 'hover:bg-slate-100 border-transparent text-markee-text bg-white'
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
                )}
              </div>
            )}
          </div>

          {/* Right Main Panel: Timeline OR Knowledge Hub */}
          <div className="flex-1 min-h-0 overflow-y-auto pl-2 flex flex-col pr-1">
            {projectTab === 'knowledge_hub' ? (
              <div className="flex flex-col h-full space-y-6">
                {/* Knowledge Hub synthesized documents */}
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

                  if (selectedFeature) {
                    summaries = summaries.filter(s => (s.feature_name || '').trim().toLowerCase() === selectedFeature.trim().toLowerCase());
                  }

                  if (summaries.length === 0) {
                    return (
                      <div className="flex-1 h-full min-h-[400px] w-full flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50 border border-slate-150 rounded-xl">
                        <span className="text-3xl">🧠</span>
                        <p className="text-sm font-medium">{selectedFeature ? `Chưa có bản tri thức nào cho tính năng "${selectedFeature}".` : 'Chưa có bản tổng hợp tri thức nào.'}</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      {summaries.map((summary: SummaryItem, idx: number) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5 shadow-2xs hover:shadow-sm transition-all space-y-4">
                          <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base">🧠</span>
                                <h4 className="font-bold text-markee-text text-base">
                                  {summary.title}
                                </h4>
                              </div>
                              {summary.feature_name && (
                                <span className="mt-1.5 inline-block text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-100">
                                  🎯 {summary.feature_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-semibold text-markee-primary bg-markee-primary/10 px-2 py-0.5 rounded-full border border-markee-primary/20 shrink-0">
                                @{((summary.contributors || profile?.email || 'System').includes('@'))
                                  ? (summary.contributors || profile?.email || 'System').split('@')[0]
                                  : (summary.contributors || profile?.email || 'System')}
                              </span>
                              <span className="text-[10px] text-markee-muted bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm font-semibold shrink-0">
                                {getRelativeTime(summary.timestamp || '')}
                              </span>
                              {!isReadOnly && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    title="Sửa bản tri thức"
                                    onClick={() => {
                                      setEditingSummaryItem(summary);
                                      setEditTitle(summary.title);
                                      setEditContent(summary.content || summary.markdown || (summary.insights || []).map(i => `- ${i}`).join('\n'));
                                      setEditFeatureName(summary.feature_name || '');
                                      setEditMoveProjectId(summary.projectId || project.id);
                                      setEditAttachedFiles(summary.files || []);
                                    }}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors bg-white cursor-pointer"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Xóa bản tri thức"
                                    onClick={() => handleDeleteSummaryItem(summary)}
                                    className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 transition-colors bg-white cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Markdown Content */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[40vh] overflow-y-auto">
                            <MarkdownRenderer content={summary.content || summary.markdown || (summary.insights || []).map((i: string) => `- ${i}`).join('\n')} />
                          </div>

                          {/* Tài liệu đính kèm */}
                          {summary.files && summary.files.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                <span>📎</span> Tài liệu đính kèm ({summary.files.length})
                              </h5>
                              <div className="flex flex-wrap gap-2">
                                {summary.files.map((file: any, fIdx: number) => {
                                  const fName = file.name || file.file_name || `File ${fIdx + 1}`;
                                  const sPath = file.storage_path || '';
                                  const sourceUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${sPath}`;
                                  return (
                                    <div key={fIdx} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                                      <span className="truncate max-w-37.5 font-medium text-slate-700">{fName}</span>
                                      <a href={`${sourceUrl}?download=${fName}`} download={fName} target="_blank" rel="noopener noreferrer" className="text-markee-primary font-bold hover:underline text-[10px]">
                                        Tải về
                                      </a>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            ) : logsLoading && logs.length === 0 ? (
                  <div className="flex-1 h-full min-h-[500px] w-full flex items-center justify-center text-sm text-markee-sub bg-gray-50 rounded-xl">
                  Đang tải nhật ký hoạt động...
                </div>
              ) : logs.length === 0 ? (
                <div className="flex-1 h-full min-h-[500px] w-full flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-xl gap-2">
                  <span className="text-2xl">📭</span>
                  <p className="text-sm font-medium">Không có log hoạt động nào.</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="flex-1 h-full min-h-[500px] w-full flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-xl gap-2">
                  <span className="text-2xl">🔍</span>
                  <p className="text-sm font-medium">Không tìm thấy bản nháp nào khớp với tính năng này.</p>
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
                            id={`wip-log-${log.id}`}
                            className={`relative transition-all duration-500 ease-out p-2 rounded-xl ${isDeleting
                                ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden pl-0'
                                : ''
                              }`}
                          >
                            {/* Timeline Bullet Node */}
                            <div
                              className="absolute -left-7.75 top-3 w-4 h-4 rounded-full border-2 border-white shadow-xs bg-markee-primary"
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
                                          title="Chia sẻ bản nháp"
                                          onClick={() => {
                                            const url = `${window.location.origin}/projects?projectId=${project.id}&wip=${log.id}`;
                                            navigator.clipboard?.writeText(url);
                                            showToast('Đã sao chép link bản nháp!', 'success');
                                          }}
                                          className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-slate-800 cursor-pointer bg-white"
                                        >
                                          <Share2 className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          title="Sửa bản nháp"
                                          onClick={() => {
                                            setActiveEditWIP(log);
                                            setEditTitle(log.title || '');
                                            setEditContent(log.prompt_content || '');
                                            setEditFeatureName(log.feature_name || '');
                                            setEditMoveProjectId(log.project_id || '');
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
                                          title="Xóa bản nháp"
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
                                      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex flex-col gap-2.5 text-xs">
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
                                              className="text-[10px] font-bold text-markee-primary bg-white border border-slate-200 rounded px-1.5 py-0.5 outline-none cursor-pointer hover:border-markee-primary transition-colors max-w-37.5 truncate"
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
                                            {canManageWIP && (
                                              <label
                                                title="Thêm file đính kèm"
                                                className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold rounded text-[10px] transition-colors flex items-center gap-0.5 cursor-pointer font-sans"
                                              >
                                                <Upload className="w-3 h-3 shrink-0" />
                                                <span>{uploadingLogId === log.id ? 'Đang tải...' : 'Upload'}</span>
                                                <input
                                                  type="file"
                                                  multiple
                                                  className="hidden"
                                                  disabled={uploadingLogId === log.id}
                                                  onChange={(e) => handleQuickUploadFiles(e, log)}
                                                />
                                              </label>
                                            )}
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
      {(activeEditWIP || editingSummaryItem) && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">
                {editingSummaryItem ? 'Sửa bản Tri thức Tổng hợp' : 'Sửa bản nháp WIP'}
              </h3>
              <button
                type="button"
                onClick={() => { setActiveEditWIP(null); setEditingSummaryItem(null); }}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label htmlFor="editWipTitleInput" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Tiêu đề
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
                <label htmlFor="editWipProjectSelect" className="block text-xs font-semibold text-markee-text mb-1.5">
                  Dự án (Chuyển dự án nếu cần)
                </label>
                <select
                  id="editWipProjectSelect"
                  value={editMoveProjectId}
                  onChange={(e) => setEditMoveProjectId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none cursor-pointer"
                >
                  <option value={project.id}>{project.name} (Hiện tại)</option>
                  {otherProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
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
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {editAttachedFiles.map((file, idx) => {
                      const fName = file.name || file.file_name || 'attachment';
                      const fSize = file.size || file.size_bytes || 0;
                      
                      return (
                         <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                           <div className="flex items-center gap-2 min-w-0">
                             <span className="shrink-0 text-sm">📄</span>
                             <span className="font-semibold text-slate-700 truncate text-[11px] max-w-50" title={fName}>
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
                onClick={() => { setActiveEditWIP(null); setEditingSummaryItem(null); }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={editingSummaryItem ? handleSaveEditedSummary : handleEditWIP}
                disabled={isEditingWIP || !editTitle.trim() || !editContent.trim()}
                className="px-4 py-2 bg-markee-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isEditingWIP ? 'Đang lưu...' : editingSummaryItem ? 'Lưu vào Knowledge Hub' : 'Lưu thay đổi'}
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

      {activeDeleteSummaryItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-red-100 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800">Xóa bản tri thức</h3>
                <p className="text-xs text-slate-500 mt-0.5">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-medium">
              Bạn có chắc chắn muốn xóa bản tri thức <span className="font-bold text-slate-800">&quot;{activeDeleteSummaryItem.title}&quot;</span> khỏi Knowledge Hub?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveDeleteSummaryItem(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingSummaryItem}
                onClick={confirmDeleteSummaryItem}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingSummaryItem ? 'Đang xóa...' : 'Xóa bản tri thức'}
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
                        {(summaryResult.insights || []).map((insight, idx) => (
                          <li key={idx}>
                            <textarea
                              rows={2}
                              value={insight}
                              onChange={(e) => {
                                const newInsights = [...(summaryResult.insights || [])];
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

      {/* KNOWLEDGE HUB MERGE MODAL */}
      {featureToMerge && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="border-b border-markee-border px-6 py-4 bg-red-50/50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <span>🧠</span> Tổng hợp Tri Thức Dự án
                </h3>
                <p className="text-xs text-markee-muted mt-0.5">
                  Tính năng: <span className="font-bold text-markee-primary">{featureToMerge}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeatureToMerge(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Chọn các nhật ký làm việc thuộc tính năng <span className="font-bold text-slate-800">&quot;{featureToMerge}&quot;</span> để gộp thành văn bản tri thức tổng hợp:
              </p>

              {(() => {
                const featureLogs = logs.filter(l => (l.feature_name || l.team_track || '').trim().toLowerCase() === featureToMerge.trim().toLowerCase());
                
                if (featureLogs.length === 0) {
                  return (
                    <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg border border-slate-150">
                      Không tìm thấy nhật ký làm việc nào cho tính năng này.
                    </div>
                  );
                }

                return (
                  <div className="space-y-2.5 max-h-75 overflow-y-auto pr-1">
                    {featureLogs.map((log) => {
                      const isChecked = selectedMergeLogIds.includes(log.id);
                      return (
                        <label
                          key={log.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-red-50/40 border-markee-primary/30 text-slate-800'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setSelectedMergeLogIds(prev => prev.filter(id => id !== log.id));
                              } else {
                                setSelectedMergeLogIds(prev => [...prev, log.id]);
                              }
                            }}
                            className="mt-0.5 rounded border-slate-300 text-markee-primary focus:ring-markee-primary shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-slate-800 truncate">
                              {log.title || log.prompt_content?.slice(0, 60) || 'Bản nháp không tiêu đề'}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                              <span>@{log.author_id?.split('@')[0]}</span>
                              <span>• {new Date(log.created_at).toLocaleDateString('vi-VN')}</span>
                              <span>• {log.tokens_used || 0} tokens</span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setFeatureToMerge(null)}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmMergeKnowledge}
                disabled={isMergingKnowledge || selectedMergeLogIds.length === 0}
                className="px-4 py-2 bg-markee-primary text-white hover:bg-red-700 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>🧠</span>
                <span>{isMergingKnowledge ? 'Đang tổng hợp...' : 'Gộp & cập nhật Knowledge Hub'}</span>
              </button>
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
