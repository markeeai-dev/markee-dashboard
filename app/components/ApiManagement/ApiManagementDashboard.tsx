'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  Plus,
  Copy,
  Check,
  MoreVertical,
  Activity,
  Coins,
  DollarSign,
  TrendingUp,
  ArrowLeft,
  Search,
  CheckCircle2,
  Trash2,
  Edit2,
  History,
  X,
  Zap,
  Eye,
  EyeOff,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const DAILY_USAGE_DATA = {
  today: [
    { name: '00:00', tokens: 12000, cost: 1.2 },
    { name: '04:00', tokens: 8000, cost: 0.8 },
    { name: '08:00', tokens: 45000, cost: 4.5 },
    { name: '12:00', tokens: 68000, cost: 6.8 },
    { name: '16:00', tokens: 95000, cost: 9.5 },
    { name: '20:00', tokens: 52000, cost: 5.2 }
  ],
  '7days': [
    { name: 'Thứ 2', tokens: 350000, cost: 35 },
    { name: 'Thứ 3', tokens: 420000, cost: 42 },
    { name: 'Thứ 4', tokens: 380000, cost: 38 },
    { name: 'Thứ 5', tokens: 510000, cost: 51 },
    { name: 'Thứ 6', tokens: 490000, cost: 49 },
    { name: 'Thứ 7', tokens: 210000, cost: 21 },
    { name: 'Chủ Nhật', tokens: 180000, cost: 18 }
  ],
  '30days': [
    { name: 'Tuần 1', tokens: 1200000, cost: 120 },
    { name: 'Tuần 2', tokens: 1450000, cost: 145 },
    { name: 'Tuần 3', tokens: 1300000, cost: 130 },
    { name: 'Tuần 4', tokens: 1650000, cost: 165 }
  ],
  all: [
    { name: 'Tháng 2', tokens: 4500000, cost: 450 },
    { name: 'Tháng 3', tokens: 5200000, cost: 520 },
    { name: 'Tháng 4', tokens: 6100000, cost: 610 },
    { name: 'Tháng 5', tokens: 5800000, cost: 580 },
    { name: 'Tháng 6', tokens: 7200000, cost: 720 },
    { name: 'Tháng 7', tokens: 8500000, cost: 850 }
  ]
};

const PIE_COLORS = ['#E3000F', '#F43F5E', '#FB7185', '#FDA4AF', '#FECDD3'];

const MOCK_HISTORY_LOGS = [
  { time: '2026-07-16 09:35:12', type: 'Chat', model: 'gpt-4o', input: 120, output: 450, total: 570, cost: 0.00285 },
  { time: '2026-07-16 09:30:45', type: 'Completion', model: 'claude-3-5-sonnet', input: 240, output: 890, total: 1130, cost: 0.01695 },
  { time: '2026-07-16 09:12:02', type: 'Chat', model: 'gpt-4o-mini', input: 85, output: 312, total: 397, cost: 0.00006 },
  { time: '2026-07-16 08:55:30', type: 'Translation', model: 'gpt-4o', input: 500, output: 520, total: 1020, cost: 0.00510 },
  { time: '2026-07-16 08:42:15', type: 'Chat', model: 'claude-3-5-sonnet', input: 150, output: 620, total: 770, cost: 0.01155 },
  { time: '2026-07-16 08:10:04', type: 'Summarization', model: 'gpt-4o-mini', input: 1200, output: 350, total: 1550, cost: 0.00023 }
];

interface AppItem {
  id: string;
  name: string;
  secret_key: string;
  app_url: string | null;
  status: string;
  total_granted: number;
  total_used: number;
  balance: number;
  created_at: string;
}

interface ApiManagementDashboardProps {
  isTab?: boolean;
}

export default function ApiManagementDashboard({ isTab = false }: ApiManagementDashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Sorting States
  const [sortField, setSortField] = useState<'name' | 'total_granted' | 'usage_percent' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal & Form States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newAppSecretKey, setNewAppSecretKey] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [appToEdit, setAppToEdit] = useState<AppItem | null>(null);
  const [editAppName, setEditAppName] = useState('');
  const [editAppUrl, setEditAppUrl] = useState('');
  const [editAppSecretKey, setEditAppSecretKey] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<AppItem | null>(null);

  const [isViewKeyModalOpen, setIsViewKeyModalOpen] = useState(false);
  const [viewAppKeyData, setViewAppKeyData] = useState<AppItem | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppName, setHistoryAppName] = useState('');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Key Visibility & Copy state
  const [visibleKeyIds, setVisibleKeyIds] = useState<string[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Global toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    loadApps();

    // Thiết lập chạy ngầm đồng bộ mỗi 15 phút (15 * 60 * 1000)
    const interval = setInterval(() => {
      fetch('/api/admin/sync-balances', { method: 'POST' })
        .then(res => res.json())
        .then(() => {
          // reload ngầm danh sách apps
          fetch('/api/apps')
            .then(res => res.json())
            .then(data => setApps(data || []))
            .catch(err => console.error("Lỗi reload ngầm apps:", err));
        })
        .catch(err => console.error("Lỗi sync ngầm balances:", err));
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load Apps from Real Database API
  const loadApps = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/apps');
      if (!res.ok) throw new Error('Không thể kết nối đến máy chủ.');
      const data = await res.json();
      setApps(data || []);
    } catch (err: any) {
      console.error('Error loading apps:', err);
      setToast({ message: err.message || 'Lỗi tải danh sách API Keys', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Copy to clipboard helper
  const handleCopyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Sync Balance via Supplier API
  const handleSyncBalances = async () => {
    try {
      setIsSyncing(true);
      const res = await fetch('/api/admin/sync-balances', {
        method: 'POST',
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Đồng bộ số dư thất bại.');
      }
      setToast({ message: 'Đồng bộ số dư thành công!', type: 'success' });
      loadApps();
    } catch (err: any) {
      console.error('Lỗi đồng bộ số dư:', err);
      setToast({ message: err.message || 'Lỗi đồng bộ số dư các keys', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Create App / Key via Real Database API
  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim() || !newAppSecretKey.trim()) return;

    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newAppName.trim(),
          app_url: newAppUrl.trim() || null,
          secret_key: newAppSecretKey.trim()
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi tạo ứng dụng mới.');
      }

      console.log("Fetch API tạo app thành công!");
      setApps([resData, ...apps]);
      setIsCreateModalOpen(false);
      setToast({ message: 'Đã thêm API Key thành công!', type: 'success' });
      loadApps();
    } catch (err: any) {
      console.error('Lỗi khi tạo key:', err);
      setToast({ message: err.message || 'Lỗi khi thêm API Key', type: 'error' });
    }
  };

  // Edit App via Real Database API
  const handleEditApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appToEdit || !editAppName.trim()) return;

    try {
      const res = await fetch('/api/apps', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: appToEdit.id, 
          name: editAppName.trim(),
          app_url: editAppUrl.trim() || null,
          secret_key: editAppSecretKey.trim() || null
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi sửa đổi ứng dụng.');
      }

      setApps(apps.map(app => app.id === appToEdit.id ? resData : app));
      setIsEditModalOpen(false);
      setAppToEdit(null);
      setToast({ message: 'Cập nhật ứng dụng thành công!', type: 'success' });
    } catch (err: any) {
      console.error('Lỗi khi sửa app:', err);
      setToast({ message: err.message || 'Lỗi khi sửa ứng dụng', type: 'error' });
    }
  };

  // Delete App via Real Database API
  const confirmDeleteApp = async () => {
    if (!appToDelete) return;
    try {
      const res = await fetch(`/api/apps?id=${appToDelete.id}`, {
        method: 'DELETE',
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi xóa API Key.');
      }

      setApps(apps.filter(app => app.id !== appToDelete.id));
      setIsDeleteModalOpen(false);
      setAppToDelete(null);
      setActiveMenuId(null);
      setToast({ message: 'Xóa API Key thành công!', type: 'success' });
    } catch (err: any) {
      console.error('Lỗi khi xóa key:', err);
      setToast({ message: err.message || 'Lỗi khi xóa API Key', type: 'error' });
    }
  };

  // Fetch real logs history from backend API
  const handleOpenHistory = async (app: AppItem) => {
    setHistoryAppName(app.name);
    setIsHistoryModalOpen(true);
    setHistoryLogs([]);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/logs?app_id=${app.id}&days=${timeFilter}`);
      if (!res.ok) throw new Error('Không thể tải lịch sử từ máy chủ.');
      const data = await res.json();
      setHistoryLogs(data || []);
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setToast({ message: err.message || 'Lỗi tải lịch sử API', type: 'error' });
    } finally {
      setLoadingHistory(false);
    }
  };

  // Calculation statistics based on current apps
  const totalGranted = apps.reduce((sum, app) => sum + Number(app.total_granted || 0), 0);
  const totalUsed = apps.reduce((sum, app) => sum + Number(app.total_used || 0), 0);
  const totalBalance = apps.reduce((sum, app) => sum + Number(app.balance || 0), 0);
  const activeAppsCount = apps.filter(app => app.status === 'active').length;

  // Filtered Apps
  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sắp xếp
  const handleSort = (field: 'name' | 'total_granted' | 'usage_percent') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getUsagePercent = (app: AppItem) => {
    return app.total_granted > 0 ? (app.total_used / app.total_granted) * 100 : 0;
  };

  const sortedApps = [...filteredApps].sort((a, b) => {
    if (!sortField) return 0;
    let valA: any = 0;
    let valB: any = 0;

    if (sortField === 'name') {
      valA = a.name.toLowerCase();
      valB = b.name.toLowerCase();
    } else if (sortField === 'total_granted') {
      valA = Number(a.total_granted || 0);
      valB = Number(b.total_granted || 0);
    } else if (sortField === 'usage_percent') {
      valA = getUsagePercent(a);
      valB = getUsagePercent(b);
    }

    if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className={`flex-1 bg-[#F8FAFC] font-sans text-slate-800 relative ${isTab ? 'p-0 pt-4 h-auto' : 'p-6 md:p-10 min-h-screen'}`}>
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[2000] flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-semibold shadow-xl border transition-all animate-in fade-in slide-in-from-top-2 duration-300 ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-250 text-emerald-800 border-emerald-200'
            : 'bg-red-50 border-red-250 text-red-800 border-red-200'
        }`}>
          {toast.type === 'success' ? <span>✅</span> : <span>❌</span>}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Container giới hạn chiều rộng */}
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between shrink-0">
          <div>
            {!isTab && (
              <div className="flex items-center gap-2 mb-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-markee-primary transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại Dashboard</span>
                </Link>
              </div>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Zap className="w-6 h-6 text-markee-primary fill-markee-primary/10" />
              <span>Quản lý API & Chi phí</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Quản lý các khóa tích hợp, cấu hình hạn mức tokens và giám sát chi phí dịch vụ AI theo thời gian thực.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter thời gian */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
              {['today', '7days', '30days', 'all'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTimeFilter(filter as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    timeFilter === filter
                      ? 'bg-white text-slate-800 shadow-sm border-0'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent border-0'
                  }`}
                >
                  {filter === 'today' ? 'Hôm nay' : filter === '7days' ? '7 ngày' : filter === '30days' ? '30 ngày' : 'Tất cả'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Cards Section */}
        <section className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng ngân sách được cấp</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-markee-primary flex items-center justify-center shrink-0 border border-red-100">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                {(totalGranted * 3250).toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                ~ ${totalGranted.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng lượng đã tiêu dùng</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                {(totalUsed * 3250).toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                ~ ${totalUsed.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Số dư khả dụng</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                {(totalBalance * 3250).toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-450 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span>~ ${totalBalance.toFixed(2)}</span>
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ứng dụng hoạt động</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                {activeAppsCount} / {apps.length} Apps
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Tỷ lệ hoạt động: {apps.length > 0 ? Math.round(activeAppsCount * 100 / apps.length) : 0}%
              </p>
            </div>
          </div>
        </section>

        {/* API Keys Table List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden h-auto">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-bold text-slate-800">Danh sách API Keys</h2>
              <p className="text-xs text-slate-400">
                Quản trị ngân sách tài chính và thông tin số dư ShopAIKey của từng ứng dụng.
              </p>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
              <div className="relative w-full sm:max-w-xs">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm ứng dụng..."
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <button
                onClick={handleSyncBalances}
                disabled={isSyncing}
                className="h-9 px-4 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ số dư'}</span>
              </button>

              <button
                onClick={() => {
                  setNewAppName('');
                  setNewAppUrl('');
                  setNewAppSecretKey('');
                  setIsCreateModalOpen(true);
                }}
                className="bg-markee-primary hover:bg-markee-hover text-white h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 flex items-center gap-1.5 border-0 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm API Key mới</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] pb-48 min-h-[220px] relative">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <div className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-bold">Đang tải danh sách API Keys...</p>
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs text-slate-500 overflow-visible">
                <thead className="sticky top-0 bg-white z-10 shadow-xs">
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider select-none">
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        <span>Tên Ứng dụng</span>
                        {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-350" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 hidden md:table-cell">Secret Key</th>
                    <th className="px-6 py-4 hidden lg:table-cell cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort('total_granted')}>
                      <div className="flex items-center gap-1">
                        <span>Tổng ngân sách</span>
                        {sortField === 'total_granted' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-350" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort('usage_percent')}>
                      <div className="flex items-center gap-1">
                        <span>Ngân sách sử dụng</span>
                        {sortField === 'usage_percent' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-350" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedApps.map((app, index) => {
                    const isKeyVisible = visibleKeyIds.includes(app.id);

                    return (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <div className="flex items-center gap-1.5">
                            {app.app_url ? (
                              <a
                                href={app.app_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-markee-primary hover:underline flex items-center gap-1 text-slate-800"
                              >
                                <span>{app.name}</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </a>
                            ) : (
                              <span>{app.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-650 hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <span>
                              {isKeyVisible 
                                ? app.secret_key 
                                : `${app.secret_key.slice(0, 14)}•••••••••••••••••••••••••••••••••••••`}
                            </span>
                            <button
                              onClick={() => {
                                if (isKeyVisible) {
                                  setVisibleKeyIds(visibleKeyIds.filter(id => id !== app.id));
                                } else {
                                  setVisibleKeyIds([...visibleKeyIds, app.id]);
                                }
                              }}
                              className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                              {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => handleCopyKey(app.secret_key, app.id)}
                              className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                            >
                              {copiedKeyId === app.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="text-sm font-extrabold text-slate-900">{(Number(app.total_granted || 0) * 3250).toLocaleString('vi-VN')} đ</div>
                          <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                            ~ ${Number(app.total_granted || 0).toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-750">
                          {(() => {
                            const usagePercent = app.total_granted > 0 ? Math.min(100, (app.total_used / app.total_granted) * 100) : 0;
                            const barColorClass = usagePercent < 75 ? 'bg-emerald-500' : usagePercent <= 90 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div className="flex flex-col w-full min-w-[150px] sm:min-w-[200px]">
                                <div className="flex items-center justify-between text-sm font-extrabold text-slate-900">
                                  <span>
                                    {(app.total_used * 3250).toLocaleString('vi-VN')}đ / {(app.total_granted * 3250).toLocaleString('vi-VN')}đ
                                  </span>
                                  <span className="text-slate-600 font-bold">({usagePercent.toFixed(1)}%)</span>
                                </div>
                                
                                <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${barColorClass} transition-all duration-500`} 
                                    style={{ width: `${usagePercent}%` }} 
                                  />
                                </div>

                                <div className="text-[11px] font-bold text-slate-500 mt-1">
                                  ~ ${Number(app.total_used || 0).toFixed(2)} / ${Number(app.total_granted || 0).toFixed(2)}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right relative overflow-visible">
                          <button
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setMenuPosition({
                                top: rect.bottom + window.scrollY,
                                left: rect.left - 130 + window.scrollX,
                              });
                              setActiveMenuId(activeMenuId === app.id ? null : app.id);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-0 bg-transparent"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {activeMenuId === app.id && isMounted && createPortal(
                            <>
                              <div className="fixed inset-0 z-[9998] bg-transparent" onClick={() => setActiveMenuId(null)} />
                              <div 
                                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                                className="fixed z-[9999] w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-left animate-in fade-in duration-150"
                              >
                                <button
                                  onClick={() => {
                                    setAppToEdit(app);
                                    setEditAppName(app.name);
                                    setEditAppUrl(app.app_url || '');
                                    setEditAppSecretKey('');
                                    setIsEditModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 font-bold cursor-pointer border-0 bg-transparent text-xs"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>Chỉnh sửa</span>
                                </button>
                                <button
                                  onClick={() => {
                                    handleOpenHistory(app);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 font-bold cursor-pointer border-0 bg-transparent text-xs"
                                >
                                  <History className="w-3.5 h-3.5" />
                                  <span>Xem lịch sử</span>
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  onClick={() => {
                                    setAppToDelete(app);
                                    setIsDeleteModalOpen(true);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-bold cursor-pointer border-0 bg-transparent text-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Xóa Key</span>
                                </button>
                              </div>
                            </>,
                            document.body
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedApps.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                        Không tìm thấy ứng dụng nào khớp với từ khóa tìm kiếm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>

      {/* --- CREATE KEY MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col mx-4 max-h-[90vh]">
            <div className="flex items-center justify-between shrink-0 mb-5">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-50 text-markee-primary flex items-center justify-center border border-red-100">
                  <Plus className="w-4 h-4" />
                </span>
                <span>Tạo API Key mới</span>
              </h3>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tên ứng dụng</label>
                <input
                  type="text"
                  required
                  value={newAppName}
                  onChange={e => setNewAppName(e.target.value)}
                  placeholder="Ví dụ: AI Chatbot Mobile App"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">Tên dùng để phân biệt ứng dụng này trong các báo cáo thống kê.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Link Web ứng dụng (Tùy chọn)</label>
                <input
                  type="url"
                  value={newAppUrl}
                  onChange={e => setNewAppUrl(e.target.value)}
                  placeholder="Ví dụ: https://mychatbot.com"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">Liên kết trỏ tới website của ứng dụng này.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Secret Key từ nhà cung cấp</label>
                <input
                  type="text"
                  required
                  value={newAppSecretKey}
                  onChange={e => setNewAppSecretKey(e.target.value)}
                  placeholder="Nhập khóa API (sk_...)"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">Dán Secret Key của ShopAIKey vào đây để hệ thống đồng bộ ngân sách tài chính.</p>
              </div>

              <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer bg-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 border-0 cursor-pointer"
                >
                  Thêm API Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT APP NAME MODAL --- */}
      {isEditModalOpen && appToEdit && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
            <div className="flex items-center justify-between shrink-0 mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-markee-primary" />
                <span>Cập nhật Ứng dụng</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setAppToEdit(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditApp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tên ứng dụng</label>
                <input
                  type="text"
                  required
                  value={editAppName}
                  onChange={e => setEditAppName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Link Web ứng dụng (Tùy chọn)</label>
                <input
                  type="url"
                  value={editAppUrl}
                  onChange={e => setEditAppUrl(e.target.value)}
                  placeholder="Ví dụ: https://mychatbot.com"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Secret Key mới (Tùy chọn)</label>
                <input
                  type="text"
                  value={editAppSecretKey}
                  onChange={e => setEditAppSecretKey(e.target.value)}
                  placeholder="Bỏ trống nếu giữ nguyên khóa cũ"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1.5">Nhập khóa mới nếu muốn cập nhật thông tin gọi API của ứng dụng.</p>
              </div>

              <div className="border-t border-slate-100 pt-5 mt-5 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setAppToEdit(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer bg-white"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 border-0 cursor-pointer"
                >
                  Cập nhật
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION MODAL (Thay thế window.confirm) --- */}
      {isDeleteModalOpen && appToDelete && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Xác nhận xóa API Key?</h3>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Ứng dụng: <span className="font-bold text-slate-700">{appToDelete.name}</span>
                </p>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Cảnh báo: Hành động này <strong>không thể hoàn tác</strong>. Mọi ứng dụng đang kết nối bằng khóa này sẽ bị từ chối truy cập và gián đoạn dịch vụ AI ngay lập tức.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setAppToDelete(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer bg-white"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={confirmDeleteApp}
                className="px-4 py-2 bg-markee-primary hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 border-0 cursor-pointer"
              >
                Xác nhận Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- VIEW SECRET KEY MODAL --- */}
      {isViewKeyModalOpen && viewAppKeyData && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
            <div className="flex items-center justify-between shrink-0 mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-50 text-markee-primary flex items-center justify-center border border-red-100">
                  <Eye className="w-4 h-4" />
                </span>
                <span>Xem API Secret Key</span>
              </h3>
              <button
                onClick={() => {
                  setIsViewKeyModalOpen(false);
                  setViewAppKeyData(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tên Ứng dụng</span>
                <div className="text-xs font-bold text-slate-800 mt-1">{viewAppKeyData.name}</div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Secret Key</label>
                <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                  <span className="font-mono text-xs text-slate-800 break-all select-all font-semibold">{viewAppKeyData.secret_key}</span>
                  <button
                    onClick={() => handleCopyKey(viewAppKeyData.secret_key, "-98")}
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Sao chép Key"
                  >
                    {copiedKeyId === "-98" ? (
                      <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in-50 duration-150" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-5 mt-5 flex items-center justify-end shrink-0">
              <button
                onClick={() => {
                  setIsViewKeyModalOpen(false);
                  setViewAppKeyData(null);
                }}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all border-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SLIDE-OVER DETAILS LOGS (Xem Lịch Sử) --- */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[1100] overflow-hidden">
          {/* Backdrop overlay */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
            onClick={() => setIsHistoryModalOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex">
            <div className="w-screen max-w-full sm:max-w-xl bg-white shadow-2xl flex flex-col h-full transform transition-transform animate-in slide-in-from-right duration-300">
              
              {/* Slide-over Header */}
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-4 h-4 text-markee-primary" />
                    <span>Lịch sử biến động số dư</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Ứng dụng: <span className="font-bold text-slate-600">{historyAppName}</span></p>
                </div>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Slide-over Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Quick metrics inside panel */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                  <div className="text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Lần đồng bộ</span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{historyLogs.length.toLocaleString()}</div>
                  </div>
                  <div className="text-center border-x border-slate-200/60">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Đã dùng (mới nhất)</span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">
                      {historyLogs[0] ? (Number(historyLogs[0].total_used || 0) * 3250).toLocaleString('vi-VN') + 'đ' : '0đ'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      ~ ${historyLogs[0] ? Number(historyLogs[0].total_used || 0).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Số dư hiện tại</span>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">
                      {historyLogs[0] ? (Number(historyLogs[0].balance || 0) * 3250).toLocaleString('vi-VN') + 'đ' : '0đ'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      ~ ${historyLogs[0] ? Number(historyLogs[0].balance || 0).toFixed(2) : '0.00'}
                    </div>
                  </div>
                </div>

                {/* History table */}
                <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-3xs min-h-[200px] flex flex-col bg-white">
                  {loadingHistory ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
                      <div className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 font-bold">Đang tải lịch sử số dư...</p>
                    </div>
                  ) : historyLogs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic py-16">
                      Chưa ghi nhận lịch sử đồng bộ số dư nào cho API Key này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs text-slate-500">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-4 py-3">Thời gian đồng bộ</th>
                            <th className="px-4 py-3">Tổng đã tiêu dùng</th>
                            <th className="px-4 py-3 text-right">Số dư khả dụng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {historyLogs.map((log) => {
                            const dateStr = log.synced_at 
                              ? new Date(log.synced_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
                              : '---';
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 text-[10px]">{dateStr}</td>
                                <td className="px-4 py-3 text-slate-700">
                                  <div className="text-xs font-extrabold text-slate-800">{(Number(log.total_used || 0) * 3250).toLocaleString('vi-VN')}đ</div>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    ~ ${Number(log.total_used || 0).toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-xs font-extrabold text-emerald-600">{(Number(log.balance || 0) * 3250).toLocaleString('vi-VN')}đ</div>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    ~ ${Number(log.balance || 0).toFixed(2)}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Slide-over Footer */}
              <div className="p-4 pb-8 sm:pb-4 border-t border-slate-100 flex items-center justify-end bg-slate-50 shrink-0">
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition-all border-0 cursor-pointer"
                >
                  Đóng Panel
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
