'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Edit, Trash2 } from 'lucide-react';
import {
  fetchCurationStats,
  removeVietnameseTones,
  updateProjectSummary,
  type Project,
  type UserProfile,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';
import { MarkdownRenderer } from '@/app/components/AIChat/MarkdownRenderer';

export interface CurationStats {
  rawSessions: number;
  wipDrafts: number;
  knowledgeHub: number;
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

export default function KnowledgeHubDashboard({
  setActiveTab,
  profile
}: {
  setActiveTab: (tab: 'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat' | 'chat-folders' | 'quan-ly-file' | 'quan-ly-vps' | 'giam-sat-vps' | 'skill_approval') => void;
  profile: UserProfile;
}) {
  const router = useRouter();
  const [stats, setStats] = useState<CurationStats>({ rawSessions: 0, wipDrafts: 0, knowledgeHub: 0 });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHubProject, setSelectedHubProject] = useState<Project | null>(null);

  // Edit & Delete states for Knowledge Hub summaries
  const [editingSummaryItem, setEditingSummaryItem] = useState<SummaryItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFeatureName, setEditFeatureName] = useState('');
  const [isEditingSummary, setIsEditingSummary] = useState(false);

  const [activeDeleteSummary, setActiveDeleteSummary] = useState<{ summary: SummaryItem; project: Project } | null>(null);
  const [isDeletingSummary, setIsDeletingSummary] = useState(false);

  async function handleSaveEditedSummary() {
    if (!selectedHubProject || !editingSummaryItem || !editTitle.trim() || !editContent.trim()) return;
    setIsEditingSummary(true);
    try {
      let currentSummaries: SummaryItem[] = [];
      if (selectedHubProject.master_summary) {
        try {
          const parsed = JSON.parse(selectedHubProject.master_summary);
          if (Array.isArray(parsed)) currentSummaries = parsed;
        } catch (e) {
          console.error(e);
        }
      }

      const updatedItem: SummaryItem = {
        ...editingSummaryItem,
        title: editTitle.trim(),
        content: editContent.trim(),
        feature_name: editFeatureName,
        insights: editContent.split('\n').filter(l => l.trim().startsWith('-')).map(l => l.replace(/^-\s*/, '')),
      };

      const newSummaries = currentSummaries.map(s => s.id === editingSummaryItem.id ? updatedItem : s);
      const serialized = JSON.stringify(newSummaries);
      await updateProjectSummary(selectedHubProject.id, serialized);

      const updatedProj = { ...selectedHubProject, master_summary: serialized };
      setSelectedHubProject(updatedProj);
      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));

      setEditingSummaryItem(null);
    } catch (err) {
      console.error('Error saving summary edit:', err);
    } finally {
      setIsEditingSummary(false);
    }
  }

  function handleDeleteSummaryItem(summaryToDelete: SummaryItem) {
    if (!selectedHubProject) return;
    setActiveDeleteSummary({ summary: summaryToDelete, project: selectedHubProject });
  }

  async function confirmDeleteSummary() {
    if (!activeDeleteSummary) return;
    setIsDeletingSummary(true);
    const { summary: summaryToDelete, project: targetProject } = activeDeleteSummary;
    try {
      let currentSummaries: SummaryItem[] = [];
      if (targetProject.master_summary) {
        try {
          const parsed = JSON.parse(targetProject.master_summary);
          if (Array.isArray(parsed)) currentSummaries = parsed;
        } catch (e) {
          console.error(e);
        }
      }

      const updated = currentSummaries.filter(s => s.id ? s.id !== summaryToDelete.id : s.title !== summaryToDelete.title);
      const serialized = JSON.stringify(updated);
      await updateProjectSummary(targetProject.id, serialized);

      const updatedProj = { ...targetProject, master_summary: serialized };
      setSelectedHubProject(updatedProj);
      setProjects(prev => prev.map(p => p.id === updatedProj.id ? updatedProj : p));
      // Decrement global Knowledge Hub counter immediately
      setStats(prev => ({ ...prev, knowledgeHub: Math.max(0, prev.knowledgeHub - 1) }));
      setActiveDeleteSummary(null);
    } catch (e) {
      console.error('Error deleting summary:', e);
    } finally {
      setIsDeletingSummary(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const curationStats = await fetchCurationStats();
      setStats(curationStats);

      // Fetch projects of type WIP_GLOBAL and PERSONAL
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .in("type", ["WIP_GLOBAL", "PERSONAL"])
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Filter to keep only GLOBAL projects or PERSONAL projects created by this user
      const filtered = (projectsData || []).filter(
        p => p.type === 'WIP_GLOBAL' || (p.type === 'PERSONAL' && p.created_by === profile.email)
      );

      setProjects(filtered);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const projectsWithSummaries = useMemo(() => {
    return projects.filter(p => {
      if (!p.master_summary) return false;
      try {
        const parsed = JSON.parse(p.master_summary) as SummaryItem[];
        if (!Array.isArray(parsed) || parsed.length === 0) return false;
        if (p.type === 'PERSONAL') {
          // Check if at least one summary belongs to this user
          return parsed.some((item: SummaryItem) => item.contributors?.toLowerCase() === profile.email?.toLowerCase());
        }
        return true;
      } catch (e) {
        return false;
      }
    });
  }, [projects, profile.email]);

  const filteredProjects = useMemo(() => {
    const cleanSearch = removeVietnameseTones(searchTerm).toLowerCase();
    if (!cleanSearch) return projectsWithSummaries;
    return projectsWithSummaries.filter(p => {
      if (removeVietnameseTones(p.name).toLowerCase().includes(cleanSearch)) return true;
      try {
        let parsed = JSON.parse(p.master_summary || '[]') as SummaryItem[];
        if (p.type === 'PERSONAL') {
          parsed = parsed.filter((item: SummaryItem) => item.contributors?.toLowerCase() === profile.email?.toLowerCase());
        }
        return parsed.some((item: SummaryItem) =>
          removeVietnameseTones(item.title).toLowerCase().includes(cleanSearch) ||
          (item.insights || []).some(insight => removeVietnameseTones(insight).toLowerCase().includes(cleanSearch))
        );
      } catch (e) {
        return false;
      }
    });
  }, [projectsWithSummaries, searchTerm, profile.email]);

  const summariesInProject = useMemo(() => {
    if (!selectedHubProject || !selectedHubProject.master_summary) return [];
    try {
      let parsed = JSON.parse(selectedHubProject.master_summary) as SummaryItem[];
      
      // Filter personal project summaries to only show summaries created by this user
      if (selectedHubProject.type === 'PERSONAL') {
        parsed = parsed.filter((item: SummaryItem) => item.contributors?.toLowerCase() === profile.email?.toLowerCase());
      }

      // Sort descending by timestamp
      parsed.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());

      const cleanSearch = removeVietnameseTones(searchTerm).toLowerCase();
      if (!cleanSearch) return parsed;
      return parsed.filter((item: SummaryItem) =>
        removeVietnameseTones(item.title).toLowerCase().includes(cleanSearch) ||
        (item.insights || []).some(insight => removeVietnameseTones(insight).toLowerCase().includes(cleanSearch))
      );
    } catch (e) {
      return [];
    }
  }, [selectedHubProject, searchTerm, profile.email]);

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section>
        <h1 className="text-lg font-bold text-markee-text">Kho Tri thức</h1>
        <p className="text-xs text-markee-muted">Trung tâm lưu trữ và tổng hợp tri thức tự động từ các dự án AI.</p>
      </section>

      {/* Curation Pipeline Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
        <div className="bg-white border border-slate-200 border-l-4 border-l-red-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nhật ký AI thô</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.rawSessions}</div>
          <div className="text-sm text-gray-400 mt-1">Dữ liệu từ extension</div>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Bản nháp WIP</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.wipDrafts}</div>
          <div className="text-sm text-gray-400 mt-1">Đang chờ tổng hợp</div>
        </div>
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-lg shadow-sm p-6 flex flex-col justify-center text-left">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Trung tâm tri thức</div>
          <div className="text-3xl font-bold text-markee-text mt-2">{stats.knowledgeHub}</div>
          <div className="text-sm text-gray-400 mt-1">Đã hệ thống hóa</div>
        </div>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải dữ liệu Kho Tri thức...</div>
      ) : selectedHubProject === null ? (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-markee-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm dự án hoặc nội dung tri thức..."
              className="w-full pl-9 pr-4 py-2.5 text-base md:text-xs border border-markee-border rounded-xl bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary placeholder:text-markee-muted shadow-2xs"
            />
          </div>

          {/* Grid of Projects */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => {
              let parsedCount = 0;
              try {
                let parsed: SummaryItem[] = JSON.parse(project.master_summary || '[]');
                if (project.type === 'PERSONAL') {
                  parsed = parsed.filter((item: SummaryItem) => item.contributors?.toLowerCase() === profile.email?.toLowerCase());
                }
                parsedCount = Array.isArray(parsed) ? parsed.length : 0;
              } catch (e) {
                // Ignore
              }

              return (
                <div
                  key={project.id}
                  onClick={() => { setSelectedHubProject(project); setSearchTerm(''); }}
                  className="bg-white border border-slate-200 hover:border-markee-primary/45 rounded-2xl p-6 shadow-3xs hover:shadow-xs transition-all flex flex-col justify-between min-h-40 cursor-pointer group"
                >
                  <div>
                    <span className="text-2xl mb-3 block">📁</span>
                    <h3 className="font-bold text-slate-800 text-sm md:text-base mb-1 truncate group-hover:text-markee-primary">
                      {project.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mb-4">
                      {parsedCount} bản tóm tắt tri thức
                    </p>
                  </div>
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>Cập nhật mới đây</span>
                    <span className="text-markee-primary font-bold group-hover:underline flex items-center gap-0.5">
                      Xem chi tiết &rarr;
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProjects.length === 0 && (
            <div className="bg-white rounded-xl border border-markee-border p-8 text-center text-markee-sub text-xs">
              Không tìm thấy dự án tri thức nào phù hợp.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Back button */}
          <button
            type="button"
            onClick={() => { setSelectedHubProject(null); setSearchTerm(''); }}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-bold cursor-pointer mb-2 bg-transparent border-0"
          >
            &larr; Quay lại danh sách dự án
          </button>

          {/* Project header details */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>📂</span> {selectedHubProject.name}
            </h2>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Dự án này chứa {summariesInProject.length} bản tóm tắt tri thức.
            </p>
          </div>

          {/* Search bar inside project */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-markee-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm bản tóm tắt trong dự án này..."
              className="w-full pl-9 pr-4 py-2.5 text-base md:text-xs border border-markee-border rounded-xl bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary placeholder:text-markee-muted shadow-2xs"
            />
          </div>

          {/* List of Summaries */}
          <div className="space-y-4">
            {summariesInProject.map((summary, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-3xs space-y-4 flex flex-col justify-between">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧠</span>
                      <h3 className="font-bold text-markee-text text-sm md:text-base">
                        {summary.title}
                      </h3>
                    </div>
                    {summary.feature_name && (
                      <span className="mt-1.5 inline-block text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-100">
                        🎯 {summary.feature_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-markee-primary bg-markee-primary/10 px-2 py-0.5 rounded-full border border-markee-primary/20 shrink-0">
                      @{((summary.contributors || profile?.email || selectedHubProject.created_by || 'System').includes('@'))
                        ? (summary.contributors || profile?.email || selectedHubProject.created_by || 'System').split('@')[0]
                        : (summary.contributors || profile?.email || selectedHubProject.created_by || 'System')}
                    </span>
                    <span className="text-[10px] text-markee-muted bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm font-semibold shrink-0">
                      {getRelativeTime(summary.timestamp || selectedHubProject.created_at)}
                    </span>
                  </div>
                </div>

                {/* Markdown Renderer Content */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[40vh] overflow-y-auto font-medium">
                  <MarkdownRenderer content={summary.content || summary.markdown || (summary.insights || []).map((insight) => `- ${insight}`).join('\n')} />
                </div>

                {/* Render Attachments */}
                {summary.files && summary.files.length > 0 && (
                  <div className="pt-2">
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
                            <span className="truncate max-w-[150px] font-medium text-slate-700">{fName}</span>
                            <a href={`${sourceUrl}?download=${fName}`} download={fName} target="_blank" rel="noopener noreferrer" className="text-markee-primary font-bold hover:underline text-[10px]">
                              Tải về
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Card Action Buttons: Chat, Edit, Delete */}
                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSummaryItem(summary);
                        setEditTitle(summary.title);
                        setEditContent(summary.content || summary.markdown || (summary.insights || []).map(i => `- ${i}`).join('\n'));
                        setEditFeatureName(summary.feature_name || '');
                      }}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSummaryItem(summary)}
                      className="px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const summaryContent = summary.content || summary.markdown || (summary.insights || []).map((i: string) => `- ${i}`).join('\n');
                      if (!summaryContent || !summary.title) return;
                      const payload = {
                        id: summary.title + (summary.timestamp || selectedHubProject.created_at),
                        title: summary.title,
                        content: summaryContent,
                        projectName: selectedHubProject.name,
                        projectId: selectedHubProject.id
                      };
                      try {
                        sessionStorage.setItem('markee_pending_knowledge', JSON.stringify(payload));
                        if (typeof window !== 'undefined') {
                          localStorage.removeItem('lastActiveChatId');
                        }
                        const params = new URLSearchParams(window.location.search);
                        params.set('tab', 'ai_chat');
                        params.delete('session_id');
                        params.delete('folderId');
                        router.replace(`${window.location.pathname}?${params.toString()}`);
                        setActiveTab('ai_chat');
                      } catch (err) {
                        console.error('Error navigating to chat:', err);
                      }
                    }}
                    className="bg-markee-primary hover:bg-markee-hover text-white px-3.5 py-2 rounded-xl transition-all text-xs font-bold cursor-pointer border-0 shadow-3xs flex items-center gap-1"
                  >
                    🪄 Chat với bản này
                  </button>
                </div>
              </div>
            ))}

            {summariesInProject.length === 0 && (
              <div className="bg-white rounded-xl border border-markee-border p-8 text-center text-markee-sub text-xs">
                Không tìm thấy bản tóm tắt tri thức nào phù hợp trong dự án này.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Knowledge Hub Modal */}
      {editingSummaryItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="border-b border-markee-border px-6 py-4 bg-markee-bg/10 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-markee-text">Sửa bản Tri thức Tổng hợp</h3>
              <button
                type="button"
                onClick={() => setEditingSummaryItem(null)}
                className="text-markee-muted hover:text-markee-text transition-colors p-1 cursor-pointer font-bold border-0 bg-transparent"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1.5">Tiêu đề</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1.5">Tính năng</label>
                <input
                  type="text"
                  value={editFeatureName}
                  onChange={(e) => setEditFeatureName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1.5">Nội dung Markdown</label>
                <textarea
                  rows={8}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white focus:outline-none font-mono"
                />
              </div>
            </div>

            <div className="border-t border-markee-border px-6 py-3.5 flex justify-end gap-2.5 bg-markee-bg/10 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSummaryItem(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted rounded-lg text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEditedSummary}
                disabled={isEditingSummary || !editTitle.trim() || !editContent.trim()}
                className="px-4 py-2 bg-markee-primary text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                {isEditingSummary ? 'Đang lưu...' : 'Lưu vào Knowledge Hub'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeDeleteSummary && (
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
              Bạn có chắc chắn muốn xóa bản tri thức <span className="font-bold text-slate-800">&quot;{activeDeleteSummary.summary.title}&quot;</span> khỏi Knowledge Hub?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveDeleteSummary(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200 bg-white"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingSummary}
                onClick={confirmDeleteSummary}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeletingSummary ? 'Đang xóa...' : 'Xóa bản tri thức'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
