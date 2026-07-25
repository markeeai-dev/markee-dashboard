'use client';
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, Files, Menu, PanelLeftClose, PanelLeftOpen, ChevronDown, ChevronRight } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';

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
import ApiManagementDashboard from './ApiManagement/ApiManagementDashboard';
import SystemManagementView from './ResourceManagement/SystemManagementView';
import VpsResourceView from './ResourceManagement/VpsResourceView';

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
  return role === 'admin' ? 'Admin' : 'Người dùng';
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
  profile,
}: {
  metrics: AdminOverviewMetrics;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  loading?: boolean;
  profile: UserProfile;
}) {
  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';
  const periodOptions: { id: AnalyticsPeriod; label: string }[] = [
    { id: '7d', label: '7 ngày' },
    { id: '30d', label: '30 ngày' },
    { id: 'all', label: 'Tất cả' },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-markee-text">
            {isAdmin ? 'Tổng quan quản trị' : 'Tổng quan sử dụng'}
          </h2>
          <p className="text-xs text-markee-muted">
            {isAdmin ? 'Theo dõi mức sử dụng AI và đóng góp kỹ năng của đội ngũ.' : 'Theo dõi mức độ sử dụng AI cá nhân.'}
          </p>
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

  const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">
            {isAdmin ? 'Khu vực quản trị' : 'Tổng quan hoạt động'}
          </h1>
          <p className="text-xs text-markee-muted">
            Xin chào {profile.displayName || profile.email}. {isAdmin ? 'Theo dõi hoạt động AI của đội ngũ.' : 'Theo dõi hoạt động sử dụng AI của bạn.'}
          </p>
        </div>
      </section>

      <AdminOverview metrics={metrics} period={period} onPeriodChange={setPeriod} loading={loading} profile={profile} />
    </main>
  );
}

export type TabType =
  | 'overview'
  | 'library'
  | 'projects'
  | 'users'
  | 'assets'
  | 'knowledge_hub'
  | 'ai_chat'
  | 'chat-folders'
  | 'quan-ly-file'
  | 'quan-ly-vps'
  | 'giam-sat-vps'
  | 'skill_approval'
  | 'api_management'
  | 'resource-system'
  | 'resource-vps';

export default function RoleDashboard({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { user: profile, logout, login } = useAuth();
  const isCloningRef = useRef(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);

  // đúng những acc đã được add làm nhân viên bên Center AI — kiểm tra thật bằng cách đổi thử
  // token Google đang có sang employee_token của Center AI, không hard-code danh sách email ở
  // đây (Center AI's "employees" table mới là nguồn dữ liệu đúng, tự thêm/bớt người không cần
  // sửa code bên này).
  const [centerAiSession, setCenterAiSession] = useState<{ employee_token: string; employee_id: string; full_name: string; role: string } | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch('/dev/api/v1/auth/google-exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ supabase_access_token: session.access_token }),
        });
        if (!res.ok) return;
        setCenterAiSession(await res.json());
      } catch {
        /* im lặng bỏ qua — acc không thuộc Center AI hoặc tính năng chưa cấu hình xong */
      }
    })();
  }, []);

  function switchToCenterAi() {
    if (!centerAiSession) return;
    localStorage.setItem(
      'centerai_dashboard_session',
      JSON.stringify({
        cpUrl: '/dev/api',
        token: centerAiSession.employee_token,
        who: { employee_id: centerAiSession.employee_id, full_name: centerAiSession.full_name, role: centerAiSession.role },
      })
    );
    window.location.href = '/dev';
  }
  const [isCloningChat, setIsCloningChat] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    file_name: string;
    storage_path: string;
    mime_type: string;
    source_url: string;
  } | null>(null);

  const [prevPathname, setPrevPathname] = useState(pathname);
  const [manualToggle, setManualToggle] = useState<boolean | null>(null);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setManualToggle(null);
  }

  const isKnowledgeRoute = pathname.startsWith('/knowledge-hub');
  const isKnowledgeDropdownOpen = manualToggle !== null ? manualToggle : isKnowledgeRoute;

  const [activeTab, _setActiveTab] = useState<TabType>(() => {
    if (initialTab) {
      if (initialTab === 'users' || initialTab === 'api_management') return 'resource-system';
      if (initialTab === 'quan-ly-vps' || initialTab === 'giam-sat-vps') return 'resource-vps';
      return initialTab as TabType;
    }
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab');
      if (tab === 'my-space' || tab === 'shared') return 'library';
      if (tab === 'users' || tab === 'api_management') return 'resource-system';
      if (tab === 'quan-ly-vps' || tab === 'giam-sat-vps') return 'resource-vps';
      if (tab && ['overview', 'library', 'projects', 'users', 'assets', 'knowledge_hub', 'ai_chat', 'chat-folders', 'quan-ly-file', 'quan-ly-vps', 'giam-sat-vps', 'skill_approval', 'api_management', 'resource-system', 'resource-vps'].includes(tab)) {
        return tab as TabType;
      }
      const p = window.location.pathname;
      if (p === '/overview') return 'overview';
      if (p === '/ai-chat') return 'ai_chat';
      if (p.startsWith('/projects')) return 'projects';
      if (p === '/knowledge-hub') return 'knowledge_hub';
      if (p === '/knowledge-hub/skill-library') return 'library';
      if (p === '/knowledge-hub/skill-approval') return 'skill_approval';
      if (p === '/knowledge-hub/files') return 'quan-ly-file';
      if (p === '/my-assets' || p === '/my-ai-accounts') return 'assets';
      if (p.startsWith('/resource-management/system')) return 'resource-system';
      if (p.startsWith('/resource-management/vps')) return 'resource-vps';
    }
    return 'overview';
  });

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const [sidebarCustomers, setSidebarCustomers] = useState<{ id: string; name: string; projectCount: number }[]>([]);
  const [totalProjectsCount, setTotalProjectsCount] = useState<number>(0);
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState<boolean>(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  useEffect(() => {
    async function loadSidebarCustomers() {
      try {
        const [{ data: custData }, { data: projData }] = await Promise.all([
          supabase.from('customers').select('id, name').order('name'),
          supabase.from('projects').select('id, customer_id')
        ]);

        if (projData) {
          setTotalProjectsCount(projData.length);
        }

        if (custData && projData) {
          const countMap: Record<string, number> = {};
          projData.forEach(p => {
            if (p.customer_id) {
              const cid = String(p.customer_id);
              countMap[cid] = (countMap[cid] || 0) + 1;
            }
          });

          const list = custData.map(c => ({
            id: String(c.id),
            name: c.name,
            projectCount: countMap[String(c.id)] || 0
          }));

          setSidebarCustomers(list);
        }
      } catch (err) {
        console.error('Error fetching sidebar customers:', err);
      }
    }
    loadSidebarCustomers();
  }, []);

  useEffect(() => {
    const cust = searchParams.get('customer') || searchParams.get('client');
    if (cust !== null) {
      setSelectedCustomerId(cust);
    } else {
      setSelectedCustomerId('');
    }
  }, [searchParams]);

  useEffect(() => {
    const isGoingToProjects = pathname.startsWith('/projects') || activeTab === 'projects';
    if (!isGoingToProjects) {
      setIsCustomerMenuOpen(false);
    } else {
      const hasCustomerParam = searchParams.get('customer') || searchParams.get('client');
      if (hasCustomerParam) {
        setIsCustomerMenuOpen(true);
      }
    }
  }, [pathname, activeTab, searchParams]);

  const setActiveTab = (tab: TabType) => {
    _setActiveTab(tab);
    setIsMobileOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);

    let path = '/';
    if (tab === 'overview') path = '/overview';
    else if (tab === 'ai_chat') path = '/ai-chat';
    else if (tab === 'projects') path = '/projects';
    else if (tab === 'knowledge_hub') path = '/knowledge-hub';
    else if (tab === 'library') path = '/knowledge-hub/skill-library';
    else if (tab === 'skill_approval') path = '/knowledge-hub/skill-approval';
    else if (tab === 'quan-ly-file') path = '/knowledge-hub/files';
    else if (tab === 'assets') path = '/my-assets';
    else if (tab === 'resource-system' || tab === 'users' || tab === 'api_management') path = '/resource-management/system';
    else if (tab === 'resource-vps' || tab === 'quan-ly-vps' || tab === 'giam-sat-vps') path = '/resource-management/vps';

    router.replace(`${path}?${params.toString()}`);
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'my-space' || tab === 'shared') {
      _setActiveTab('library');
    } else if (tab === 'users' || tab === 'api_management') {
      _setActiveTab('resource-system');
    } else if (tab === 'quan-ly-vps' || tab === 'giam-sat-vps') {
      _setActiveTab('resource-vps');
    } else if (tab && ['overview', 'library', 'projects', 'users', 'assets', 'knowledge_hub', 'ai_chat', 'chat-folders', 'quan-ly-file', 'quan-ly-vps', 'giam-sat-vps', 'skill_approval', 'api_management', 'resource-system', 'resource-vps'].includes(tab)) {
      _setActiveTab(tab as TabType);
    } else if (pathname === '/overview') {
      _setActiveTab('overview');
    } else if (pathname === '/ai-chat') {
      _setActiveTab('ai_chat');
    } else if (pathname.startsWith('/projects')) {
      _setActiveTab('projects');
    } else if (pathname === '/knowledge-hub') {
      _setActiveTab('knowledge_hub');
    } else if (pathname === '/knowledge-hub/skill-library') {
      _setActiveTab('library');
    } else if (pathname === '/knowledge-hub/skill-approval') {
      _setActiveTab('skill_approval');
    } else if (pathname === '/knowledge-hub/files') {
      _setActiveTab('quan-ly-file');
    } else if (pathname === '/my-assets' || pathname === '/my-ai-accounts') {
      _setActiveTab('assets');
    } else if (pathname.startsWith('/resource-management/system')) {
      _setActiveTab('resource-system');
    } else if (pathname.startsWith('/resource-management/vps')) {
      _setActiveTab('resource-vps');
    } else if (pathname === '/') {
      _setActiveTab('overview');
    }
  }, [searchParams, pathname]);

  useEffect(() => {
    if (!profile) return; // Chỉ chạy khi đã login

    if (typeof window !== 'undefined') {
      const pendingToken = localStorage.getItem('pending_clone_token');
      if (pendingToken && !isCloningRef.current) {
        // A. Đóng khóa ngay lập tức
        isCloningRef.current = true;
        setIsCloningChat(true);

        // B. Xóa token ngay lập tức khỏi storage trước khi gọi fetch
        localStorage.removeItem('pending_clone_token');

        // C. Gọi API
        async function triggerStorageClone() {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/chat/clone', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
              },
              body: JSON.stringify({ token: pendingToken }),
            });

            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || 'Lỗi khi nhân bản cuộc trò chuyện');
            }

            // Nhân bản thành công -> chuyển sang tab chat và mở thẳng session vừa clone
            router.replace(`/?tab=ai_chat&session_id=${data.new_session_id}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } catch (err: any) {
            console.error("Lỗi clone chat từ localStorage:", err);
            alert(err.message || "Lỗi khi nhân bản cuộc trò chuyện");
          } finally {
            setIsCloningChat(false);
          }
        }
        triggerStorageClone();
      }
    }
  }, [profile, router]);

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
  useEffect(() => {
  if (activeTab === 'projects') {
    setIsCustomerMenuOpen(true);
  }
}, [activeTab]);



  // ==========================================
  // 2. EARLY RETURN CHO UI ĐẶT Ở DƯỚI CÙNG
  // ==========================================
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-5 text-[#1e293b]">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</h1>
          <p className="mt-2 text-sm text-[#64748b]">Đăng nhập Google để mở dashboard theo role.</p>
          <button
            type="button"
            onClick={login}
            className="mt-5 w-full rounded-lg bg-markee-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer border-0 shadow-sm"
          >
            Đăng nhập Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-markee-bg text-markee-text font-sans">
      {/* Sidebar (Cột trái) */}
      <aside className={`fixed md:relative inset-y-0 left-0 z-999 bg-white border-r border-markee-border flex flex-col transition-all duration-300 transform ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${isCollapsed ? 'w-72 md:w-20' : 'w-72 md:w-64'} shrink-0`}>
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
        <nav className="p-4 flex-1 space-y-1.5 overflow-y-auto">
          {/* TOP-LEVEL */}
          <Link
            href="/overview"
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

          <Link
            href="/ai-chat"
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

          {/* MERGED DROPDOWN: KHÁCH HÀNG & DỰ ÁN */}
          <div>
            <button
              type="button"
              onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();

  if (!isCustomerMenuOpen) {
    // TRƯỜNG HỢP 1: Menu đang đóng -> Ép mở và chuyển tab
    setIsCustomerMenuOpen(true);
    setActiveTab('projects');
    setSelectedCustomerId('');
  } else {
    // TRƯỜNG HỢP 2: Menu đang mở
    if (activeTab === 'projects' && !selectedCustomerId) {
      // Đang xem "Tất cả dự án" rồi -> Thu menu lại
      setIsCustomerMenuOpen(false);
    } else {
      // Đang xem khách hàng lẻ -> Về "Tất cả dự án", VẪN GIỮ MỞ
      setActiveTab('projects');
      setSelectedCustomerId('');
    }
  }
}}
              className={`w-full flex items-center justify-between rounded-xl text-sm font-semibold transition-all cursor-pointer border-0 ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'px-4 py-3'
                } ${activeTab === 'projects'
                  ? 'bg-markee-primary text-white shadow-md shadow-red-100 font-bold'
                  : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                }`}
            >
              <div className="flex items-center gap-3">
                <span>📁</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>
                  Khách hàng & Dự án
                </span>
              </div>
              {!isCollapsed && (
                <div className={activeTab === 'projects' ? 'text-white' : 'text-slate-400'}>
                  {isCustomerMenuOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              )}
            </button>

            {/* SUB-MENU KHÁCH HÀNG & TẤT CẢ DỰ ÁN */}
            {!isCollapsed && (
              <div className={`mt-1 space-y-1 pl-4 border-l-2 border-slate-100 ml-5 ${isCustomerMenuOpen ? 'block' : 'hidden'}`}>
                {/* 1. Tất cả dự án */}
                <Link
                  href="/projects"
                  scroll={false}
                  prefetch={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTab('projects');
                    setSelectedCustomerId('');
                    setIsCustomerMenuOpen(true); // Ép menu luôn mở khi click vào link con
                  }}
                  className={`w-full flex items-center justify-between rounded-xl text-xs font-semibold transition-all cursor-pointer px-3 py-2 ${activeTab === 'projects' && !selectedCustomerId
                      ? 'bg-red-50 text-markee-primary font-bold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs shrink-0">🌐</span>
                    <span>Tất cả dự án</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-semibold">
                    {totalProjectsCount}
                  </span>
                </Link>

                {/* 2. Danh sách Khách hàng */}
                {sidebarCustomers.map((cust) => {
                  const isSelected = activeTab === 'projects' && selectedCustomerId === cust.id;
                  return (
                    <Link
                      key={cust.id}
                      href={`/projects?customer=${cust.id}`}
                      scroll={false}
                      prefetch={false}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTab('projects');
                        setSelectedCustomerId(cust.id);
                        setIsCustomerMenuOpen(true); // Ép menu luôn mở khi click vào link con
                      }}
                      className={`w-full flex items-center justify-between rounded-xl text-xs font-semibold transition-all cursor-pointer px-3 py-2 ${isSelected
                          ? 'bg-red-50 text-markee-primary font-bold'
                          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs shrink-0">🏢</span>
                        <span className="truncate">{cust.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        ({cust.projectCount})
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* DROPDOWN: KHO TRÍ THỨC */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setManualToggle(!isKnowledgeDropdownOpen);
              }}
              className={`w-full flex items-center justify-between rounded-xl text-sm font-semibold transition-all cursor-pointer border-0 ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-2.5' : 'px-4 py-2.5'
                } text-slate-600 hover:bg-slate-100 hover:text-slate-900`}
            >
              <div className="flex items-center gap-3">
                <span>🧠</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Kho Trí Thức</span>
              </div>
              {!isCollapsed && (
                <div className="text-slate-400">
                  {isKnowledgeDropdownOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              )}
            </button>

            {isKnowledgeDropdownOpen && (
              <div className={`mt-1 space-y-1 overflow-hidden transition-all duration-200 ${isCollapsed ? '' : 'pl-4 border-l-2 border-slate-100 ml-5'}`}>
                <Link
                  href="/knowledge-hub"
                  scroll={false}
                  prefetch={false}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('knowledge_hub'); }}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                    } ${activeTab === 'knowledge_hub'
                      ? 'bg-red-50 text-markee-primary font-bold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                  <span className="text-sm">🌐</span>
                  <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Kho Trí Thức Tổng Quan</span>
                </Link>

                <Link
                  href="/knowledge-hub/skill-library"
                  scroll={false}
                  prefetch={false}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('library'); }}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                    } ${activeTab === 'library'
                      ? 'bg-red-50 text-markee-primary font-bold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                  <span className="text-sm">📚</span>
                  <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Thư viện kỹ năng</span>
                </Link>

                {(profile.role === 'admin' || profile.role === 'super_admin') && (
                  <Link
                    href="/knowledge-hub/skill-approval"
                    scroll={false}
                    prefetch={false}
                    onClick={(e) => { e.stopPropagation(); setActiveTab('skill_approval'); }}
                    className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                      } ${activeTab === 'skill_approval'
                        ? 'bg-red-50 text-markee-primary font-bold'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                  >
                    <span className="text-sm">✅</span>
                    <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Duyệt kỹ năng</span>
                  </Link>
                )}

                <Link
                  href="/knowledge-hub/files"
                  scroll={false}
                  prefetch={false}
                  onClick={(e) => { e.stopPropagation(); setActiveTab('quan-ly-file'); }}
                  className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-2.5' : 'gap-2.5 px-3 py-2'
                    } ${activeTab === 'quan-ly-file'
                      ? 'bg-red-50 text-markee-primary font-bold'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                >
                  <Files className="w-3.5 h-3.5 shrink-0" />
                  <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý File</span>
                </Link>
              </div>
            )}
          </div>

          {/* TÀI KHOẢN AI CỦA TÔI */}
          <Link
            href="/my-assets"
            scroll={false}
            prefetch={false}
            onClick={(e) => { e.stopPropagation(); setActiveTab('assets'); }}
            className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'
              } ${activeTab === 'assets'
                ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
              }`}
          >
            <span>💳</span>
            <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Tài khoản AI của tôi</span>
          </Link>

          {/* SECTION: QUẢN LÝ TÀI NGUYÊN */}
          {(profile.role === 'admin' || profile.role === 'super_admin') && (
            <div className="pt-4">
              {!isCollapsed ? (
                <div className="pb-1.5 animate-in fade-in duration-200">
                  <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">QUẢN LÝ TÀI NGUYÊN</p>
                </div>
              ) : (
                <div className="block md:hidden pb-1.5 animate-in fade-in duration-200">
                  <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">QUẢN LÝ TÀI NGUYÊN</p>
                </div>
              )}
              {isCollapsed && (
                <div className="hidden md:block border-t border-slate-100 my-2 mx-4" />
              )}

              <Link
                href="/resource-management/system"
                scroll={false}
                prefetch={false}
                onClick={(e) => { e.stopPropagation(); setActiveTab('resource-system'); }}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'
                  } ${activeTab === 'resource-system'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                  }`}
              >
                <span>⚙️</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý Hệ thống & User</span>
              </Link>

              <Link
                href="/resource-management/vps"
                scroll={false}
                prefetch={false}
                onClick={(e) => { e.stopPropagation(); setActiveTab('resource-vps'); }}
                className={`w-full flex items-center rounded-xl text-sm font-semibold transition-all cursor-pointer ${isCollapsed ? 'justify-start md:justify-center gap-3 md:gap-0 px-4 md:px-0 py-3' : 'gap-3 px-4 py-3'
                  } ${activeTab === 'resource-vps'
                    ? 'bg-markee-primary text-white shadow-md shadow-red-100'
                    : 'text-markee-muted hover:bg-markee-bg hover:text-markee-text'
                  }`}
              >
                <span>🖥️</span>
                <span className={`animate-in fade-in duration-200 ${isCollapsed ? 'block md:hidden' : 'block'}`}>Quản lý VPS</span>
              </Link>
            </div>
          )}
        </nav>
      </aside>

      {/* Overlay cho Main Sidebar trên Mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-990 md:hidden animate-in fade-in duration-200"
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
            {centerAiSession && (
              <button
                type="button"
                onClick={switchToCenterAi}
                className="bg-markee-primary text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer hover:bg-red-700"
                title="Mở dashboard vận hành Center AI"
              >
                <span>🚀</span>
                <span>Chuyển sang Center AI</span>
              </button>
            )}
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
              className="rounded-lg border border-markee-border bg-white px-3.5 py-1.5 text-xs font-semibold text-markee-text hover:bg-markee-bg transition-colors shadow-xs cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Scrollable Content Container */}
        <div key={activeTab} className={`flex-1 ${(activeTab === 'ai_chat' || activeTab === 'chat-folders') ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          {(activeTab === 'ai_chat' || activeTab === 'chat-folders') && (
            <AIChat profile={profile} isMobileOpen={isMobileOpen} />
          )}
          {activeTab === 'overview' && (
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

          {activeTab === 'api_management' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <ApiManagementDashboard isTab={true} />
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

          {activeTab === 'resource-system' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <SystemManagementView profile={profile} />
          )}

          {activeTab === 'resource-vps' && (profile.role === 'admin' || profile.role === 'super_admin') && (
            <VpsResourceView />
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

      {isCloningChat && (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-xs text-white animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-4 text-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-10 h-10 border-4 border-markee-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-center">
              <h3 className="font-bold text-sm md:text-base">Đang sao chép cuộc trò chuyện...</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Quá trình này có thể mất vài giây.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}