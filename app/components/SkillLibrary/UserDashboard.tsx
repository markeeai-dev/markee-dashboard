'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, ChevronLeft, ChevronRight, MoreVertical, Edit, Trash2, Folder, User, Eye, Plus, X, ArrowLeftRight } from 'lucide-react';
import {
  fetchApprovedSkills,
  fetchTrendingSkills,
  fetchMyWorkspaceSkills,
  fetchMyWIPs,
  fetchProjects,
  fetchLibraryCounts,
  downloadSkillMarkdown,
  type SkillCard,
  type UserProfile,
  type PaginatedSkills,
  type LibraryCounts,
  type AISession,
  type Project,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 6;
const WIP_PAGE_SIZE = 8;

function formatWipFileSize(bytes?: number | null) {
  if (!bytes) return '0 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function stripMarkdown(value: string, maxLength = 180) {
  const plainText = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s>*-]+/gm, '');

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

function getSkillTrackName(
  skill: SkillCard,
  departments: { id: number; name: string }[] = [],
  teams: { id: number; name: string; department_id: number }[] = []
): string {
  if (skill.department_id) {
    const dept = departments.find((d) => d.id === skill.department_id);
    if (dept) {
      if (skill.team_id) {
        const team = teams.find((t) => t.id === skill.team_id);
        if (team) {
          return `${dept.name} - ${team.name}`;
        }
      }
      return dept.name;
    }
  }
  return skill.team_track || 'Khác';
}

function SkillCardItem({
  skill,
  userEmail,
  showStatus = false,
  allowVoting = true,
  onPreview,
  onEdit,
  onDelete,
  departments = [],
  teams = [],
  projects = [],
}: {
  skill: SkillCard;
  userEmail: string;
  showStatus?: boolean;
  allowVoting?: boolean;
  onPreview: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  departments?: { id: number; name: string }[];
  teams?: { id: number; name: string; department_id: number }[];
  projects?: { id: number; name: string }[];
}) {
  const [likes, setLikes] = useState(skill.likes_count || 0);
  const [downloads, setDownloads] = useState(skill.downloads_count || 0);
  const [liked, setLiked] = useState(Boolean(skill.likedByCurrentUser));
  const [busyAction, setBusyAction] = useState<'vote' | 'download' | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
  const project = (skill as any).project || projects.find((p) => p.id === skill.project_id);
  const projectName = project?.name || 'Khác';

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col h-full min-h-55 relative">
      <div className="flex-grow">
        {/* Header */}
        <div className="flex justify-between items-start gap-3 relative">
          <div className="flex flex-wrap gap-1.5">
            <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
              {typeName}
            </span>
            <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase">
              {showStatus ? skill.status : 'APPROVED'}
            </span>
          </div>

          {/* Action Menu (Kebab) */}
          {(onEdit || onDelete) && (
            <div className="relative z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMenuOpen(!isMenuOpen);
                }}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 cursor-pointer transition-colors flex items-center justify-center border-0 bg-transparent"
                title="Thao tác"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(false);
                    }}
                  />
                  <div className="absolute right-0 mt-1.5 w-32 rounded-lg bg-white shadow-lg border border-gray-100 py-1.5 z-30 animate-in fade-in slide-in-from-top-1 duration-100">
                    {onEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          onEdit();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent transition-colors"
                      >
                        <Edit className="h-3.5 w-3.5 text-gray-400" />
                        Chỉnh sửa
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMenuOpen(false);
                          onDelete();
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5 cursor-pointer border-0 bg-transparent transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        Xóa
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
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
      <div className="mt-auto pt-4 border-t border-gray-100 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-400">
          <div className="flex items-center gap-1">
            <Folder className="h-3 w-3 text-gray-400" />
            <span className="font-medium text-gray-500">{projectName}</span>
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
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-markee-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-markee-hover disabled:opacity-60 cursor-pointer border-0"
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

function mapTrackToDbValue(track: string): string {
  if (track === 'Chung') return 'WIP_GLOBAL';
  if (track === 'Cá nhân') return 'WIP_PERSONAL';
  if (track === 'Tất cả') return 'Tất cả';
  return 'Tất cả';
}

export default function UserDashboard({
  profile,
  refreshKey = 0,
  mode = 'full',
}: {
  profile: UserProfile;
  refreshKey?: number;
  mode?: 'full' | 'library-only';
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeView, _setActiveView] = useState<'library' | 'workspace'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      if (tab === 'my-space') return 'workspace';
      if (tab === 'shared') return 'library';
    }
    return 'library';
  });

  const setActiveView = (view: 'library' | 'workspace') => {
    _setActiveView(view);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', view === 'workspace' ? 'my-space' : 'shared');
      router.replace(`${window.location.pathname}?${params.toString()}`);
    }
  };

  const [library, setLibrary] = useState<PaginatedSkills>({ items: [], total: 0, hasMore: false, nextPage: 0 });
  const [workspaceSkills, setWorkspaceSkills] = useState<SkillCard[]>([]);
  const [trendingSkills, setTrendingSkills] = useState<SkillCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const isLibraryOnly = mode === 'library-only';

  const [workspaceTab, _setWorkspaceTab] = useState<'approved' | 'pending' | 'wip'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const wtab = searchParams.get('wtab');
      if (wtab && ['approved', 'pending', 'wip'].includes(wtab)) {
        return wtab as 'approved' | 'pending' | 'wip';
      }
    }
    return 'approved';
  });

  const setWorkspaceTab = (tab: 'approved' | 'pending' | 'wip') => {
    _setWorkspaceTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('wtab', tab);
      router.replace(`${window.location.pathname}?${params.toString()}`);
    }
  };
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

  // States cho việc Sửa/Xóa Skill
  const [activeEditSkill, setActiveEditSkill] = useState<SkillCard | null>(null);
  const [editSkillTitle, setEditSkillTitle] = useState('');
  const [editSkillContent, setEditSkillContent] = useState('');
  const [editSkillType, setEditSkillType] = useState('skill');
  const [editSkillDeptId, setEditSkillDeptId] = useState<number | null>(null);
  const [editSkillTeamId, setEditSkillTeamId] = useState<number | null>(null);
  const [editSkillProjectId, setEditSkillProjectId] = useState<number | null>(null);
  const [editSkillFile, setEditSkillFile] = useState<File | null>(null);
  const [isSavingSkill, setIsSavingSkill] = useState(false);

  const [activeDeleteSkill, setActiveDeleteSkill] = useState<SkillCard | null>(null);
  const [isDeletingSkill, setIsDeletingSkill] = useState(false);

  function handleEditSkillOpen(skill: SkillCard) {
    setActiveEditSkill(skill);
    setEditSkillTitle(skill.title);
    setEditSkillContent(skill.markdown_content || '');
    setEditSkillType(skill.skill_type || 'skill');
    setEditSkillDeptId(skill.department_id || null);
    setEditSkillTeamId(skill.team_id || null);
    setEditSkillProjectId(skill.project_id || null);
    setEditSkillFile(null);
  }

  async function handleEditSkillSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSkillTitle.trim() || !editSkillContent.trim()) {
      showWipToast('Vui lòng điền đầy đủ các trường bắt buộc', 'error');
      return;
    }
    setIsSavingSkill(true);
    showWipToast('Đang cập nhật tài sản...', 'loading');
    try {
      let attachedFileJson = activeEditSkill?.attached_file;

      if (editSkillFile) {
        // Xóa file cũ
        if (activeEditSkill?.attached_file) {
          let oldPath = '';
          try {
            const parsed = typeof activeEditSkill.attached_file === 'string'
              ? JSON.parse(activeEditSkill.attached_file)
              : activeEditSkill.attached_file;
            oldPath = parsed?.storage_path || '';
          } catch (err) {
            console.error("Lỗi parse attached_file cũ:", err);
          }
          if (oldPath) {
            await supabase.storage.from('chat_attachments').remove([oldPath]);
          }
        }

        // Tải file mới
        const fileExt = editSkillFile.name.split('.').pop();
        const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `skill_attachments/${uniqueName}`;

        const { error: uploadErr } = await supabase.storage
          .from('chat_attachments')
          .upload(filePath, editSkillFile);

        if (uploadErr) throw uploadErr;

        attachedFileJson = {
          file_name: editSkillFile.name,
          file_size: editSkillFile.size,
          file_type: editSkillFile.type,
          storage_path: filePath,
        };
      }

      const { error } = await supabase
        .from('skill_library')
        .update({
          title: editSkillTitle.trim(),
          markdown_content: editSkillContent.trim(),
          skill_type: editSkillType,
          department_id: editSkillDeptId,
          team_id: editSkillTeamId,
          project_id: editSkillProjectId,
          attached_file: attachedFileJson
        })
        .eq('id', activeEditSkill?.id);

      if (error) throw error;

      showWipToast('Cập nhật tài sản thành công!', 'success');
      setActiveEditSkill(null);

      const updatedProject = projects.find(p => p.id === editSkillProjectId) || null;

      // Cập nhật state
      setWorkspaceSkills(prev => prev.map(item => item.id === activeEditSkill?.id ? {
        ...item,
        title: editSkillTitle.trim(),
        markdown_content: editSkillContent.trim(),
        skill_type: editSkillType,
        department_id: editSkillDeptId || undefined,
        team_id: editSkillTeamId || undefined,
        project_id: editSkillProjectId || undefined,
        project: updatedProject ? { id: updatedProject.id, name: updatedProject.name } : null,
        attached_file: attachedFileJson
      } as SkillCard : item));

      setLibrary(prev => ({
        ...prev,
        items: prev.items.map(item => item.id === activeEditSkill?.id ? {
          ...item,
          title: editSkillTitle.trim(),
          markdown_content: editSkillContent.trim(),
          skill_type: editSkillType,
          department_id: editSkillDeptId || undefined,
          team_id: editSkillTeamId || undefined,
          project_id: editSkillProjectId || undefined,
          project: updatedProject ? { id: updatedProject.id, name: updatedProject.name } : null,
          attached_file: attachedFileJson
        } as SkillCard : item)
      }));

    } catch (err) {
      console.error('Error editing skill:', err);
      showWipToast('Lỗi khi cập nhật tài sản', 'error');
    } finally {
      setIsSavingSkill(false);
    }
  }

  async function handleDeleteSkillSubmit() {
    if (!activeDeleteSkill) return;
    setIsDeletingSkill(true);
    showWipToast('Đang xóa tài sản...', 'loading');
    try {
      if (activeDeleteSkill.attached_file) {
        let oldPath = '';
        try {
          const parsed = typeof activeDeleteSkill.attached_file === 'string'
            ? JSON.parse(activeDeleteSkill.attached_file)
            : activeDeleteSkill.attached_file;
          oldPath = parsed?.storage_path || '';
        } catch (err) {
          console.error("Lỗi parse attached_file để xóa:", err);
        }
        if (oldPath) {
          await supabase.storage.from('chat_attachments').remove([oldPath]);
        }
      }

      const { error } = await supabase
        .from('skill_library')
        .delete()
        .eq('id', activeDeleteSkill.id);

      if (error) throw error;

      showWipToast('Xóa tài sản thành công!', 'success');

      setWorkspaceSkills(prev => prev.filter(item => item.id !== activeDeleteSkill.id));
      setLibrary(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== activeDeleteSkill.id),
        total: Math.max(0, prev.total - 1)
      }));

      setActiveDeleteSkill(null);
    } catch (err) {
      console.error('Error deleting skill:', err);
      showWipToast('Lỗi khi xóa tài sản', 'error');
    } finally {
      setIsDeletingSkill(false);
    }
  }

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
      const { error } = await supabase.from('skill_library').delete().eq('id', activeDeleteWip.id);
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
      const newProjId = Number(moveWipProjectId);
      const { error } = await supabase.from('skill_library').update({ project_id: newProjId }).eq('id', activeMoveWip.id);
      if (error) throw error;

      showWipToast('Chuyển dự án thành công!', 'success');

      const targetId = activeMoveWip.id;
      const updatedProject = projects.find(p => p.id === newProjId) || null;
      setWips(prev => prev.map(w => w.id === targetId ? { 
        ...w, 
        project_id: newProjId,
        project: updatedProject ? { id: updatedProject.id, name: updatedProject.name } : null
      } : w));
      setActiveMoveWip(null);
      setMoveWipProjectId('');
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
        .eq('id', activeEditWip.id);

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
  const [selectedType, setSelectedType] = useState('Tất cả');
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

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewSkill, setPreviewSkill] = useState<SkillCard | null>(null);

  const [uploadType, setUploadType] = useState('skill');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadProjectId, setUploadProjectId] = useState<number | null>(null);
  const [uploadContent, setUploadContent] = useState('');
  const [uploadDeptId, setUploadDeptId] = useState<number | null>(null);
  const [uploadTeamId, setUploadTeamId] = useState<number | null>(null);
  const [isSavingAsset, setIsSavingAsset] = useState(false);

  const [counts, setCounts] = useState<LibraryCounts>({ byType: {}, byTrack: {}, total: 0 });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadContent.trim()) {
      showWipToast('Vui lòng điền đầy đủ các trường bắt buộc', 'error');
      return;
    }

    setIsSavingAsset(true);
    showWipToast('Đang tải lên tài sản...', 'loading');
    try {
      const { error } = await supabase.from('skill_library').insert({
        title: uploadTitle.trim(),
        markdown_content: uploadContent.trim(),
        category: 'General',
        author_id: profile.email,
        status: 'pending',
        skill_type: uploadType,
        department_id: uploadDeptId,
        team_id: uploadTeamId,
        project_id: uploadProjectId
      });

      if (error) throw error;

      showWipToast('Đã tải lên tài sản thành công. Đang chờ phê duyệt!', 'success');
      setIsUploadModalOpen(false);

      // Reset form
      setUploadTitle('');
      setUploadContent('');
      setUploadType('skill');
      setUploadDeptId(null);
      setUploadTeamId(null);
      setUploadProjectId(null);

      // Refresh data
      loadInitialData();
    } catch (err) {
      console.error('Error uploading asset:', err);
      showWipToast('Lỗi khi tải lên tài sản', 'error');
    } finally {
      setIsSavingAsset(false);
    }
  };

  const approvedWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'approved');
  }, [workspaceSkills]);

  const pendingWorkspaceSkills = useMemo(() => {
    return workspaceSkills.filter((skill) => skill.status === 'pending');
  }, [workspaceSkills]);

  async function loadInitialData() {
    setLoading(true);

    try {
      const dbTrack = mapTrackToDbValue(selectedTrack);
      const isWorkspace = !isLibraryOnly && activeView === 'workspace';
      const countsPromise = fetchLibraryCounts(isWorkspace ? profile.email : undefined, selectedDeptId, selectedTeamId);

      if (isLibraryOnly) {
        const [skills, libCounts] = await Promise.all([
          fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm, dbTrack, selectedType, selectedDeptId, selectedTeamId),
          countsPromise,
        ]);
        setLibrary(skills);
        setCounts(libCounts);
        return;
      }

      const [skills, trending, workspace, userWips, allProjects, libCounts] = await Promise.all([
        fetchApprovedSkills(page, PAGE_SIZE, profile.email, debouncedSearchTerm, dbTrack, selectedType, selectedDeptId, selectedTeamId),
        fetchTrendingSkills(5, profile.email),
        fetchMyWorkspaceSkills(profile.email),
        fetchMyWIPs(profile.email),
        fetchProjects(undefined, false, 'WIP_GLOBAL', selectedDeptId, selectedTeamId),
        countsPromise,
      ]);

      setLibrary(skills);
      setTrendingSkills(trending);
      setWorkspaceSkills(workspace);
      setWips(userWips);
      setProjects(allProjects);
      setCounts(libCounts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, [profile.email, refreshKey, page, debouncedSearchTerm, isLibraryOnly, selectedTrack, selectedType, activeView, selectedDeptId, selectedTeamId]);

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

  const displayedWips = useMemo(() => {
    const start = wipPage * WIP_PAGE_SIZE;
    return wips.slice(start, start + WIP_PAGE_SIZE);
  }, [wips, wipPage]);

  return (
    <main className="mx-auto max-w-7xl p-5">
      <div className="flex h-full w-full gap-6">
        {/* Left Column: Sidebar Filters */}
        <aside className="w-64 shrink-0 pr-2 space-y-6 hidden md:block border-r border-gray-100 text-left">
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
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer flex items-center justify-between w-full border-0 ${isActive
                        ? "font-bold text-markee-primary bg-red-50"
                        : "text-gray-500 hover:text-markee-primary hover:bg-gray-50 bg-transparent"
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

          {/* Nhóm 2 - PHÒNG BAN & TEAM */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="space-y-1.5">
              <label htmlFor="dept-select" className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Phòng ban</label>
              <select
                id="dept-select"
                value={selectedDeptId || ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedDeptId(val);
                  setSelectedTeamId(null);
                  setPage(0);
                }}
                className="w-full rounded-lg border border-markee-border bg-white px-3 py-2 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="team-select" className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">Team</label>
              <select
                id="team-select"
                value={selectedTeamId || ''}
                disabled={!selectedDeptId}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setSelectedTeamId(val);
                  setPage(0);
                }}
                className="w-full rounded-lg border border-markee-border bg-white px-3 py-2 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        </aside>

        {/* Right Column: Main Content */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Header section */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-left">
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
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer border-0 ${activeView === 'library' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
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
                  className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all cursor-pointer border-0 ${activeView === 'workspace' ? 'bg-markee-primary text-white' : 'border border-markee-border bg-white text-markee-muted hover:bg-markee-bg'
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
                  className="w-full rounded-xl border border-markee-border bg-white py-3 pl-11 pr-4 text-base md:text-sm text-markee-text outline-none transition-colors placeholder:text-markee-sub focus:border-markee-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-markee-primary px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-markee-hover cursor-pointer shadow-sm shrink-0 border-0"
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
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer border-0 ${workspaceTab === 'approved'
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
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer border-0 ${workspaceTab === 'pending'
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
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors cursor-pointer border-0 ${workspaceTab === 'wip'
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
                    <div className="grid gap-6 grid-cols-1 xl:grid-cols-2 text-left">
                      {displayedWips.map((wip) => {
                        const isDeleting = deletingWipIds.includes(wip.id);
                        const project = projects.find(p => p.id === wip.project_id);
                        let parsedAttachedFile = null;
                        if (wip.attached_file) {
                          if (typeof wip.attached_file === 'object') {
                            parsedAttachedFile = wip.attached_file;
                          } else if (typeof wip.attached_file === 'string') {
                            try {
                              parsedAttachedFile = JSON.parse(wip.attached_file);
                            } catch (e) {
                              console.error('Error parsing attached_file in timeline:', e);
                            }
                          }
                        }
                        return (
                          <div
                            key={wip.id}
                            className={`bg-white border border-markee-border rounded-xl p-5 shadow-xs relative flex flex-col h-full min-h-[220px] transition-all duration-500 ease-out hover:shadow-md ${isDeleting
                                ? 'opacity-0 scale-95 max-h-0 py-0 my-0 overflow-hidden'
                                : ''
                              }`}
                          >
                            <div className="flex-grow">
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
                                      setMoveWipProjectId(wip.project_id ? wip.project_id : '');
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

                              {parsedAttachedFile?.storage_path && (
                                <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-base shrink-0">📎</span>
                                    <span className="font-semibold text-slate-700 truncate" title={parsedAttachedFile.file_name}>
                                      {parsedAttachedFile.file_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                      ({formatWipFileSize(parsedAttachedFile.size_bytes)})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => window.dispatchEvent(new CustomEvent('markee_open_file_preview', {
                                        detail: {
                                          file_name: parsedAttachedFile.file_name,
                                          storage_path: parsedAttachedFile.storage_path,
                                          mime_type: parsedAttachedFile.mime_type || '',
                                          source_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${parsedAttachedFile.storage_path}`
                                        }
                                      }))}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      👁️ Xem trước
                                    </button>
                                    <a
                                      href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/chat_attachments/${parsedAttachedFile.storage_path}?download=${parsedAttachedFile.file_name}`}
                                      download={parsedAttachedFile.file_name}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-markee-primary hover:text-red-700 font-bold rounded text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                                    >
                                      Tải xuống
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="border-t border-markee-border/60 mt-auto pt-3 flex items-center justify-between text-[11px] text-markee-muted">
                              <div className="flex items-center gap-1.5">
                                <span>📁 Dự án:</span>
                                <span className="font-semibold text-markee-text truncate max-w-37.5">{project?.name || 'Khác'}</span>
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
                    <div className="grid gap-6 grid-cols-1 xl:grid-cols-2 text-left">
                      {displayedSkills.map((skill) => (
                        <SkillCardItem
                          key={skill.id}
                          skill={skill}
                          userEmail={profile.email}
                          showStatus={!isLibraryOnly && activeView === 'workspace'}
                          allowVoting={isLibraryOnly || activeView === 'library'}
                          onPreview={() => setPreviewSkill(skill)}
                          onEdit={(profile.email === skill.author_id || profile.role === 'admin' || profile.role === 'super_admin') ? () => handleEditSkillOpen(skill) : undefined}
                          onDelete={(profile.email === skill.author_id || profile.role === 'admin' || profile.role === 'super_admin') ? () => setActiveDeleteSkill(skill) : undefined}
                          departments={departments}
                          teams={teams}
                          projects={projects}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-markee-primary" />
                Upload Asset
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setUploadTitle('');
                  setUploadContent('');
                  setUploadType('skill');
                  setUploadDeptId(null);
                  setUploadTeamId(null);
                  setUploadProjectId(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-0 bg-transparent"
                disabled={isSavingAsset}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Nhập Tiêu đề tài sản..."
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nội dung chi tiết *
                </label>
                <textarea
                  required
                  rows={5}
                  value={uploadContent}
                  onChange={(e) => setUploadContent(e.target.value)}
                  placeholder="Dán hoặc nhập nội dung tài sản chi tiết..."
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Loại Tài Sản
                  </label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="skill">Skill</option>
                    <option value="sop">SOP</option>
                    <option value="context_pack">Context Pack</option>
                    <option value="workflow">Workflow</option>
                    <option value="checklist">Checklist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Gán vào Dự án
                  </label>
                  <select
                    value={uploadProjectId || ''}
                    onChange={(e) => setUploadProjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Không gán vào dự án</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Phòng ban
                  </label>
                  <select
                    value={uploadDeptId || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setUploadDeptId(val);
                      setUploadTeamId(null);
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Tất cả phòng ban</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Team phụ trách
                  </label>
                  <select
                    value={uploadTeamId || ''}
                    disabled={!uploadDeptId}
                    onChange={(e) => setUploadTeamId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Tất cả team</option>
                    {teams
                      .filter((t) => !uploadDeptId || t.department_id === uploadDeptId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-2 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setUploadTitle('');
                    setUploadContent('');
                    setUploadType('skill');
                    setUploadDeptId(null);
                    setUploadTeamId(null);
                    setUploadProjectId(null);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  disabled={isSavingAsset}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingAsset}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-0"
                >
                  {isSavingAsset && <span className="animate-spin text-[10px]">⏳</span>}
                  Tải lên tài sản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {activeEditSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 mb-4">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Edit className="h-4 w-4 text-markee-primary" />
                Chỉnh sửa {activeEditSkill.title}
              </h3>
              <button
                type="button"
                onClick={() => setActiveEditSkill(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-0 bg-transparent"
                disabled={isSavingSkill}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditSkillSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Tiêu đề *
                </label>
                <input
                  type="text"
                  required
                  value={editSkillTitle}
                  onChange={(e) => setEditSkillTitle(e.target.value)}
                  placeholder="Nhập tiêu đề tài sản..."
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nội dung chi tiết *
                </label>
                <textarea
                  required
                  rows={5}
                  value={editSkillContent}
                  onChange={(e) => setEditSkillContent(e.target.value)}
                  placeholder="Dán hoặc nhập nội dung tài sản chi tiết..."
                  className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Loại Tài Sản
                  </label>
                  <select
                    value={editSkillType}
                    onChange={(e) => setEditSkillType(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="prompt">Prompt</option>
                    <option value="skill">Skill</option>
                    <option value="sop">SOP</option>
                    <option value="context_pack">Context Pack</option>
                    <option value="workflow">Workflow</option>
                    <option value="checklist">Checklist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Gán vào Dự án
                  </label>
                  <select
                    value={editSkillProjectId || ''}
                    onChange={(e) => setEditSkillProjectId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Không gán vào dự án</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Phòng ban
                  </label>
                  <select
                    value={editSkillDeptId || ''}
                    onChange={(e) => {
                      const val = e.target.value ? Number(e.target.value) : null;
                      setEditSkillDeptId(val);
                      setEditSkillTeamId(null);
                    }}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer"
                  >
                    <option value="">Tất cả phòng ban</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    Team phụ trách
                  </label>
                  <select
                    value={editSkillTeamId || ''}
                    disabled={!editSkillDeptId}
                    onChange={(e) => setEditSkillTeamId(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-markee-primary bg-white outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Tất cả team</option>
                    {teams
                      .filter((t) => !editSkillDeptId || t.department_id === editSkillDeptId)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-2 pt-4 border-t border-gray-100 mt-6">
                <button
                  type="button"
                  onClick={() => setActiveEditSkill(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                  disabled={isSavingSkill}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingSkill}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-0"
                >
                  {isSavingSkill && <span className="animate-spin text-[10px]">⏳</span>}
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Skill Confirmation Modal (Red warning) */}
      {activeDeleteSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl relative animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-2">
              ⚠️ Xác nhận Xóa Tài Sản
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-6">
              Bạn có chắc chắn muốn xóa tài sản <strong className="text-gray-900">"{activeDeleteSkill.title}"</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveDeleteSkill(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                disabled={isDeletingSkill}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSkillSubmit}
                disabled={isDeletingSkill}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 border-0"
              >
                {isDeletingSkill && <span className="animate-spin text-[10px]">⏳</span>}
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Asset Modal */}
      {previewSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-3xl h-[85vh] rounded-xl bg-white p-6 shadow-xl relative flex flex-col justify-between animate-in zoom-in-95 duration-200">
            <div>
              <button
                type="button"
                onClick={() => setPreviewSkill(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-0 bg-transparent"
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

            <div className="flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700 leading-relaxed font-sans mb-5 text-left">
              <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-gray-800 leading-6">
                {previewSkill.markdown_content}
              </pre>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewSkill(null)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadSkillMarkdown(previewSkill);
                  setPreviewSkill(null);
                }}
                className="rounded-lg bg-markee-primary px-4 py-2 text-xs font-semibold text-white hover:bg-markee-hover transition-colors cursor-pointer border-0"
              >
                Tải về Markdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit WIP Modal */}
      {activeEditWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Sửa tóm tắt phiên AI</h3>
              <button
                type="button"
                onClick={() => setActiveEditWip(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
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
                  <option value="">Khác</option>
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
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border-0"
              >
                {isEditingWip ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move WIP Modal */}
      {activeMoveWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-left">
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
                  {!activeMoveWip.project_id && (
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
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-markee-primary/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border-0"
              >
                {isMovingWip ? 'Đang chuyển...' : 'Xác nhận Chuyển'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete WIP Modal */}
      {activeDeleteWip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-red-600">Xác nhận Xóa</h3>
              <button
                type="button"
                onClick={() => setActiveDeleteWip(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 text-left">
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/60 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer flex items-center gap-1.5 border-0"
              >
                {isDeletingWip ? 'Đang xóa...' : 'Xác nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Alert */}
      {wipToast && (
        <div className={`fixed bottom-5 right-5 z-60 px-4.5 py-3 rounded-xl shadow-xl flex items-center gap-2 border text-xs font-semibold animate-in slide-in-from-bottom-5 duration-300 ${wipToast.type === 'success'
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
