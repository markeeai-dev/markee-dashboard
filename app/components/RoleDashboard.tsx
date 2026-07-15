'use client';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, Files, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  fetchAdminOverviewMetrics,
  type SkillCard,
  type UserProfile,
} from '@/lib/dashboard-supabase';
import { useAuth } from '@/app/contexts/AuthContext';

import UserGuideModal from './Shared/UserGuideModal';
import AIChat from './AIChat/AIChat';
import FileManagement from './FileManagement';
import FilePreviewModal from './Shared/FilePreviewModal';
import VpsManagement from './VPS/VpsManagement';
import VpsMonitor from './VPS/VpsMonitor';

// Decoupled dashboards
import SkillApprovalDashboard from './SkillApproval/SkillApprovalDashboard';
import UserDashboard from './SkillLibrary/UserDashboard';
import ProjectManagement from './ProjectManagement/ProjectManagement';
import KnowledgeHubDashboard from './KnowledgeHub/KnowledgeHubDashboard';
import MyAssetsView from './MyAssets/MyAssetsView';
import UserManagement from './UserManagement/UserManagement';

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

function roleLabel(role: UserProfile['role']) {
  if (role === 'super_admin') return 'Super Admin';
  return role === 'admin' ? 'Quản trị viên' : 'Người dùng';
}

function StatCard({
  label,
  value,
  note,
  tone,
  loading = false,
}: {
  label: string;
  value: string;
  note: string;
  tone: 'blue' | 'green' | 'orange' | 'purple' | 'yellow';
  loading?: boolean;
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
      {loading ? (
        <div className="mt-2.5 h-7 w-24 bg-slate-200 rounded-md animate-pulse" />
      ) : (
        <p className="mt-2 text-2xl font-bold text-markee-text">{value}</p>
      )}
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

function AdminOverview({
  metrics,
  period,
  onPeriodChange,
  loading = false,
}: {
  metrics: AdminOverviewMetrics;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  loading?: boolean;
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
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${period === option.id ? 'bg-markee-primary text-white' : 'text-markee-muted hover:bg-markee-bg'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatCard label="Tổng token" value={formatNumber(metrics.totalTokens)} note="Dữ liệu từ extension" tone="blue" loading={loading} />
        <StatCard label="Chi phí ước tính" value={formatCurrency(metrics.costUsd)} note="Token × 0.015 USD (Quy đổi)" tone="green" loading={loading} />
        <StatCard label="Lượt sử dụng" value={formatNumber(metrics.totalSessions)} note="Số phiên AI được ghi nhận" tone="orange" loading={loading} />
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
    </section>
  );
}

function AdminDashboard({
  profile,
}: {
  profile: UserProfile;
}) {
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

  async function loadAdminData() {
    setLoading(true);
    try {
      const overview = await fetchAdminOverviewMetrics(period);
      setMetrics(overview);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
          <p className="text-xs text-markee-muted">Xin chào {profile.displayName}. Theo dõi hoạt động AI của đội ngũ.</p>
        </div>
      </section>

      <AdminOverview metrics={metrics} period={period} onPeriodChange={setPeriod} loading={loading} />
    </main>
  );
}

export default function RoleDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user: profile, logout } = useAuth();
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [previewFile, setPreviewFile] = useState<{
    file_name: string;
    storage_path: string;
    mime_type: string;
    source_url: string;
  } | null>(null);
  const [activeTab, _setActiveTab] = useState<'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat' | 'chat-folders' | 'quan-ly-file' | 'quan-ly-vps' | 'giam-sat-vps' | 'skill_approval'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      if (tab === 'my-space' || tab === 'shared') {
        return 'library';
      }
      if (tab && ['overview', 'library', 'projects', 'users', 'assets', 'knowledge_hub', 'ai_chat', 'chat-folders', 'quan-ly-file', 'quan-ly-vps', 'giam-sat-vps', 'skill_approval'].includes(tab)) {
        return tab as 'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat' | 'chat-folders' | 'quan-ly-file' | 'quan-ly-vps' | 'giam-sat-vps' | 'skill_approval';
      }
      if (window.location.pathname.startsWith('/projects')) {
        return 'projects';
      }
    }
    return 'overview';
  });

  const setActiveTab = (tab: 'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat' | 'chat-folders' | 'quan-ly-file' | 'quan-ly-vps' | 'giam-sat-vps' | 'skill_approval') => {
    _setActiveTab(tab);
    setIsMobileOpen(false);
    const params = new URLSearchParams();
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'my-space' || tab === 'shared') {
      _setActiveTab('library');
    } else if (tab && ['overview', 'library', 'projects', 'users', 'assets', 'knowledge_hub', 'ai_chat', 'chat-folders', 'quan-ly-file', 'quan-ly-vps', 'giam-sat-vps', 'skill_approval'].includes(tab)) {
      _setActiveTab(tab as 'overview' | 'library' | 'projects' | 'users' | 'assets' | 'knowledge_hub' | 'ai_chat' | 'chat-folders' | 'quan-ly-file' | 'quan-ly-vps' | 'giam-sat-vps' | 'skill_approval');
    } else if (window.location.pathname.startsWith('/projects')) {
      _setActiveTab('projects');
    } else {
      if (profile) {
        _setActiveTab((profile.role === 'admin' || profile.role === 'super_admin') ? 'overview' : 'library');
      }
    }
  }, [searchParams, profile?.role]);

  useEffect(() => {
    const handleOpenPreview = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setPreviewFile(customEvent.detail);
      }
    };
    window.addEventListener('markee_open_file_preview', handleOpenPreview);
    return () => {
      window.removeEventListener('markee_open_file_preview', handleOpenPreview);
    };
  }, []);

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Auto redirect user to library tab if their role is user
  useEffect(() => {
    if (profile && profile.role === 'user') {
      _setActiveTab('library');
    }
  }, [profile?.role]);

  if (!profile) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-markee-bg text-markee-text font-sans">
      {/* Sidebar (Cột trái) */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-[100] bg-white border-r border-markee-border flex flex-col transition-all duration-300 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'w-72 md:w-20' : 'w-72 md:w-64'} shrink-0`}>
        {/* Logo & Toggle */}
        <div className={`p-4 border-b border-markee-border flex items-center justify-between ${isCollapsed ? 'flex-col gap-3 justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-8 h-8 shrink-0" />
            <div className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>
              <div className="text-sm font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</div>
              <div className="text-[10px] text-markee-muted uppercase tracking-wider font-semibold">Center Console</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer border-0 items-center justify-center hidden md:flex"
            title={isCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* User Info */}
        <div className={`p-4 border-b border-markee-border bg-markee-bg/20 flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-inner"
            style={{ backgroundColor: profile.dbUser?.avatar_color || '#E3000F' }}
          >
            {profile.displayName.charAt(0).toUpperCase()}
          </div>
          <div className={`min-w-0 flex-1 animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>
            <div className="text-sm font-bold text-markee-text truncate">{profile.displayName}</div>
            <div className="text-xs text-markee-muted truncate capitalize">{roleLabel(profile.role)}</div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 flex-1 space-y-1 overflow-y-auto">
          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <Link
              href="?tab=overview"
              scroll={false}
              prefetch={false}
              onClick={(e) => { e.stopPropagation(); setActiveTab('overview'); }}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'overview'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <span>📊</span>
              <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Tổng quan</span>
            </Link>
          )}

          <Link
            href="?tab=ai_chat"
            scroll={false}
            prefetch={false}
            onClick={(e) => { e.stopPropagation(); setActiveTab('ai_chat'); }}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'ai_chat'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
          >
            <span>💬</span>
            <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Trò chuyện cùng AI</span>
          </Link>

          <Link
            href="?tab=library"
            scroll={false}
            prefetch={false}
            onClick={(e) => { e.stopPropagation(); setActiveTab('library'); }}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'library'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
          >
            <span>📚</span>
            <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Thư viện kỹ năng</span>
          </Link>

          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <Link
              href="?tab=skill_approval"
              scroll={false}
              prefetch={false}
              onClick={(e) => { e.stopPropagation(); setActiveTab('skill_approval'); }}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'skill_approval'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <span>✅</span>
              <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Duyệt kỹ năng</span>
            </Link>
          )}

          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <Link
              href="?tab=projects"
              scroll={false}
              prefetch={false}
              onClick={(e) => { e.stopPropagation(); setActiveTab('projects'); }}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'projects'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <span>📁</span>
              <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản Lý dự án</span>
            </Link>
          )}

          <Link
            href="?tab=knowledge_hub"
            scroll={false}
            prefetch={false}
            onClick={(e) => { e.stopPropagation(); setActiveTab('knowledge_hub'); }}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'knowledge_hub'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
          >
            <span>🧠</span>
            <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Kho Tri thức</span>
          </Link>

          <Link
            href="?tab=quan-ly-file"
            scroll={false}
            prefetch={false}
            onClick={(e) => { e.stopPropagation(); setActiveTab('quan-ly-file'); }}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'quan-ly-file'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
          >
            <Files className={`w-4.5 h-4.5 shrink-0 ${isCollapsed ? 'md:mx-auto' : ''}`} />
            <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý File</span>
          </Link>

          {profile.role === 'user' && (
            <Link
              href="?tab=assets"
              scroll={false}
              prefetch={false}
              onClick={(e) => { e.stopPropagation(); setActiveTab('assets'); }}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'assets'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <span>💳</span>
              <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Tài khoản AI của tôi</span>
            </Link>
          )}

          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <Link
              href="?tab=users"
              scroll={false}
              prefetch={false}
              onClick={(e) => { e.stopPropagation(); setActiveTab('users'); }}
              className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${activeTab === 'users'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <span>👥</span>
              <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý User</span>
            </Link>
          )}

          {/* ---- GROUP: Quản lý tài nguyên ---- */}
          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <>
              {!isCollapsed ? (
                <div className="pt-3 pb-1 animate-in fade-in duration-200">
                  <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quản lý tài nguyên</p>
                </div>
              ) : (
                <div className="block md:hidden pt-3 pb-1 animate-in fade-in duration-200">
                  <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quản lý tài nguyên</p>
                </div>
              )}
              {isCollapsed && (
                <div className="hidden md:block border-t border-slate-100 my-2 mx-4" />
              )}

              <Link
                href="?tab=quan-ly-vps"
                scroll={false}
                prefetch={false}
                onClick={(e) => { e.stopPropagation(); setActiveTab('quan-ly-vps'); }}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${
                  activeTab === 'quan-ly-vps'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
              >
                <span>🖥️</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý VPS</span>
              </Link>

              <Link
                href="?tab=giam-sat-vps"
                scroll={false}
                prefetch={false}
                onClick={(e) => { e.stopPropagation(); setActiveTab('giam-sat-vps'); }}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'} ${
                  activeTab === 'giam-sat-vps'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
              >
                <span>📡</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Giám sát VPS</span>
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Overlay cho Main Sidebar trên Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-[90] md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-markee-border px-6 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            title="Mở menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={() => setIsGuideOpen(true)}
              className="text-markee-primary border border-markee-primary hover:bg-markee-primary/10 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Hướng dẫn cài đặt</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="rounded-lg border border-markee-border bg-white px-3.5 py-1.5 text-xs font-semibold text-markee-text hover:bg-markee-bg transition-colors shadow-xs cursor-pointer border-0"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div key={activeTab} className={`flex-1 ${(activeTab === 'ai_chat' || activeTab === 'chat-folders') ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          {(activeTab === 'ai_chat' || activeTab === 'chat-folders') && (
            <AIChat profile={profile} />
          )}
          {activeTab === 'overview' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <AdminDashboard
              profile={profile}
            />
          )}

          {activeTab === 'skill_approval' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <SkillApprovalDashboard
              profile={profile}
              onSkillModerated={() => setLibraryRefreshKey((key) => key + 1)}
            />
          )}

          {activeTab === 'library' && (
            <UserDashboard
              profile={profile}
            />
          )}

          {activeTab === 'assets' && (
            <MyAssetsView profile={profile} />
          )}

          {activeTab === 'projects' && (
            <ProjectManagement profile={profile} />
          )}

          {activeTab === 'users' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <UserManagement profile={profile} />
          )}

          {activeTab === 'knowledge_hub' && (
            <KnowledgeHubDashboard setActiveTab={setActiveTab} profile={profile} />
          )}

          {activeTab === 'quan-ly-file' && (
            <FileManagement setActiveTab={setActiveTab} profile={profile} />
          )}

          {activeTab === 'quan-ly-vps' && (
            <VpsManagement />
          )}

          {activeTab === 'giam-sat-vps' && (
            <VpsMonitor />
          )}
        </div>
      </div>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      <FilePreviewModal
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile}
        onSelectForChat={() => setActiveTab('ai_chat')}
      />
    </div>
  );
}