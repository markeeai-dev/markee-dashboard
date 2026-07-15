'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import {
  fetchCurationStats,
  removeVietnameseTones,
  type Project,
  type UserProfile,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';

export interface CurationStats {
  rawSessions: number;
  wipDrafts: number;
  knowledgeHub: number;
}

interface SummaryItem {
  title: string;
  insights: string[];
  contributors: string;
  totalTokens: number;
  model: string;
  timestamp?: string;
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
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold text-markee-text text-sm md:text-base">
                    {summary.title}
                  </h3>
                  <span className="text-[10px] text-markee-muted bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-sm font-semibold shrink-0">
                    {getRelativeTime(summary.timestamp || selectedHubProject.created_at)}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-markee-muted uppercase tracking-wider">Insight cốt lõi</h4>
                  <div className="text-xs text-markee-text whitespace-pre-wrap leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[30vh] overflow-y-auto font-medium">
                    {(summary.insights || []).map((insight) => `- ${insight}`).join('\n')}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-markee-muted justify-between">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-markee-text">Nguồn:</span>
                      <span>{summary.contributors || 'Hệ thống'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-markee-text">Công cụ:</span>
                      <span>{summary.model || 'Gemini 3.5 Flash'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-markee-text">Token:</span>
                      <span>{(summary.totalTokens || 0).toLocaleString()} tokens</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const summaryContent = (summary.insights || []).map((i: string) => `- ${i}`).join('\n');
                      const payload = {
                        id: summary.title + (summary.timestamp || selectedHubProject.created_at),
                        title: summary.title,
                        content: summaryContent,
                        projectName: selectedHubProject.name,
                        projectId: selectedHubProject.id
                      };
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
    </main>
  );
}
