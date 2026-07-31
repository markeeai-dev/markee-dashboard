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
  ChevronsUpDown,
  Mail,
  Lock,
  Key
} from 'lucide-react';

interface AppItem {
  id: string;
  name: string;
  secret_key: string;
  app_url: string | null;
  provider?: 'shopaikey' | 'dataforseo' | string;
  api_login?: string | null;
  status: string;
  total_granted: number;
  total_used: number;
  balance: number;
  created_at: string;
}

interface ApiManagementDashboardProps {
  isTab?: boolean;
}

// Helper function tính tỷ giá tiền Việt theo nhà cung cấp
const getExchangeRate = (provider?: string) => {
  return provider === 'dataforseo' ? 25400 : 3250;
};

const getVndAmount = (usdAmount: number, provider?: string) => {
  return Number(usdAmount || 0) * getExchangeRate(provider);
};

export default function ApiManagementDashboard({ isTab = false }: ApiManagementDashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Sorting States
  const [sortField, setSortField] = useState<'name' | 'total_granted' | 'usage_percent' | null>('usage_percent');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Modal & Form States
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Create App Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<'shopaikey' | 'dataforseo'>('shopaikey');
  const [newAppName, setNewAppName] = useState('');
  const [newAppUrl, setNewAppUrl] = useState('');
  const [newApiLogin, setNewApiLogin] = useState('');
  const [newAppSecretKey, setNewAppSecretKey] = useState('');

  // Edit App Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [appToEdit, setAppToEdit] = useState<AppItem | null>(null);
  const [editProvider, setEditProvider] = useState<'shopaikey' | 'dataforseo'>('shopaikey');
  const [editAppName, setEditAppName] = useState('');
  const [editAppUrl, setEditAppUrl] = useState('');
  const [editApiLogin, setEditApiLogin] = useState('');
  const [editAppSecretKey, setEditAppSecretKey] = useState('');

  // Delete App Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<AppItem | null>(null);

  // View Secret Key Modal
  const [isViewKeyModalOpen, setIsViewKeyModalOpen] = useState(false);
  const [viewAppKeyData, setViewAppKeyData] = useState<AppItem | null>(null);

  // History Slide-over Modal
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppName, setHistoryAppName] = useState('');
  const [historyAppProvider, setHistoryAppProvider] = useState<string>('shopaikey');
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

    // Thiết lập chạy ngầm đồng bộ mỗi 15 phút
    const interval = setInterval(() => {
      fetch('/api/admin/sync-balances', { method: 'POST' })
        .then(res => res.json())
        .then(() => {
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
    if (!key) return;
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
    if (!newAppName.trim()) return;

    if (newProvider === 'shopaikey' && !newAppSecretKey.trim()) {
      setToast({ message: 'Vui lòng nhập Secret Key cho ShopAIKey.', type: 'error' });
      return;
    }

    if (newProvider === 'dataforseo') {
      if (!newApiLogin.trim()) {
        setToast({ message: 'Vui lòng nhập API Login (Email) cho DataForSEO.', type: 'error' });
        return;
      }
      if (!newAppSecretKey.trim()) {
        setToast({ message: 'Vui lòng nhập API Password cho DataForSEO.', type: 'error' });
        return;
      }
    }

    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: newAppName.trim(),
          app_url: newAppUrl.trim() || null,
          provider: newProvider,
          api_login: newProvider === 'dataforseo' ? newApiLogin.trim() : null,
          secret_key: newAppSecretKey.trim()
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi tạo ứng dụng mới.');
      }

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
          provider: editProvider,
          api_login: editProvider === 'dataforseo' ? editApiLogin.trim() : null,
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
      loadApps();
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
    setHistoryAppProvider(app.provider || 'shopaikey');
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

  // Calculation statistics (cộng dồn tiền VNĐ chính xác theo từng provider)
  const totalGrantedVnd = apps.reduce((sum, app) => sum + getVndAmount(Number(app.total_granted || 0), app.provider), 0);
  const totalUsedVnd = apps.reduce((sum, app) => sum + getVndAmount(Number(app.total_used || 0), app.provider), 0);
  const totalBalanceVnd = apps.reduce((sum, app) => sum + getVndAmount(Number(app.balance || 0), app.provider), 0);

  const totalGrantedUsd = apps.reduce((sum, app) => sum + Number(app.total_granted || 0), 0);
  const totalUsedUsd = apps.reduce((sum, app) => sum + Number(app.total_used || 0), 0);
  const totalBalanceUsd = apps.reduce((sum, app) => sum + Number(app.balance || 0), 0);
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
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
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
              Quản lý các khóa tích hợp (ShopAIKey & DataForSEO), cấu hình hạn mức tokens và giám sát chi phí dịch vụ AI theo thời gian thực.
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
                      ? 'bg-white text-slate-800 shadow-xs border-0'
                      : 'text-slate-500 hover:text-slate-800 bg-transparent border-0'
                  }`}
                >
                  {filter === 'today' ? 'Hôm nay' : filter === '7days' ? '7 ngày' : filter === '30days' ? '30 ngày' : 'Tất cả'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Cards Section (4 Thẻ Summary Cards) */}
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
                {totalGrantedVnd.toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                ~ ${totalGrantedUsd.toFixed(2)} USD
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
                {totalUsedVnd.toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">
                ~ ${totalUsedUsd.toFixed(2)} USD
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
                {totalBalanceVnd.toLocaleString('vi-VN')} đ
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span>~ ${totalBalanceUsd.toFixed(2)} USD</span>
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
                Quản trị ngân sách tài chính và thông tin kết nối ShopAIKey & DataForSEO của từng ứng dụng.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
              <div className="relative w-full sm:w-64">
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

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSyncBalances}
                  disabled={isSyncing}
                  className="flex-1 sm:flex-initial h-9 px-4 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ số dư'}</span>
                </button>

                <button
                  onClick={() => {
                    setNewProvider('shopaikey');
                    setNewAppName('');
                    setNewAppUrl('');
                    setNewApiLogin('');
                    setNewAppSecretKey('');
                    setIsCreateModalOpen(true);
                  }}
                  className="flex-1 sm:flex-initial bg-markee-primary hover:bg-markee-hover text-white h-9 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 flex items-center justify-center gap-1.5 border-0 cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm API Key mới</span>
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-125 pb-48 min-h-55 relative">
            {loading ? (
              <div className="p-5 space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded-xl w-full" />
                ))}
              </div>
            ) : (
              <table className="w-full border-collapse text-left text-xs text-slate-500 overflow-visible">
                <thead className="sticky top-0 bg-white z-10 shadow-xs">
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider select-none">
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/80 transition-colors" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">
                        <span>Tên Ứng dụng & Provider</span>
                        {sortField === 'name' ? (sortDirection === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <ChevronsUpDown className="w-3.5 h-3.5 text-slate-350" />}
                      </div>
                    </th>
                    <th className="px-6 py-4 hidden md:table-cell">Thông tin Credentials</th>
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
                  {sortedApps.map((app) => {
                    const isKeyVisible = visibleKeyIds.includes(app.id);
                    const isDataForSEO = app.provider === 'dataforseo';
                    const appVndGranted = getVndAmount(Number(app.total_granted || 0), app.provider);
                    const appVndUsed = getVndAmount(Number(app.total_used || 0), app.provider);

                    return (
                      <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Tên App & Badge Provider */}
                        <td className="px-6 py-4 font-bold text-slate-800">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              {app.app_url ? (
                                <a
                                  href={app.app_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-markee-primary hover:underline flex items-center gap-1 text-slate-800 font-bold"
                                >
                                  <span>{app.name}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                </a>
                              ) : (
                                <span className="font-bold text-slate-800">{app.name}</span>
                              )}

                              {/* Badge Nhà Cung Cấp */}
                              {isDataForSEO ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200/80 shrink-0">
                                  DataForSEO
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0">
                                  ShopAIKey
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              Tỷ giá: 1 USD = {getExchangeRate(app.provider).toLocaleString('vi-VN')} VNĐ
                            </div>
                          </div>
                        </td>

                        {/* Credentials Column */}
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-650 hidden md:table-cell">
                          {isDataForSEO ? (
                            /* DataForSEO Credentials: Login (Email) & Password */
                            <div className="space-y-1.5">
                              {/* Email Login */}
                              <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="text-slate-800 font-semibold">{app.api_login || 'Chưa nhập email'}</span>
                                {app.api_login && (
                                  <button
                                    onClick={() => handleCopyKey(app.api_login || '', `email-${app.id}`)}
                                    className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                                    title="Copy Email"
                                  >
                                    {copiedKeyId === `email-${app.id}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                              {/* Password */}
                              <div className="flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>
                                  {isKeyVisible 
                                    ? app.secret_key 
                                    : '••••••••••••••••'}
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
                                  title={isKeyVisible ? "Ẩn Mật khẩu" : "Hiện Mật khẩu"}
                                >
                                  {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleCopyKey(app.secret_key, `pass-${app.id}`)}
                                  className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                                  title="Copy Mật khẩu API"
                                >
                                  {copiedKeyId === `pass-${app.id}` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ShopAIKey Credentials: Secret Key */
                            <div className="flex items-center gap-2">
                              <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              <span>
                                {isKeyVisible 
                                  ? app.secret_key 
                                  : `${app.secret_key.slice(0, 8)}••••••••••••••••••••`}
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
                                title={isKeyVisible ? "Ẩn Key" : "Hiện Key"}
                              >
                                {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleCopyKey(app.secret_key, app.id)}
                                className="p-1 hover:bg-slate-100 rounded-md text-slate-450 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
                                title="Copy Key"
                              >
                                {copiedKeyId === app.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Tổng Ngân Sách Column (Quy đổi VNĐ & USD) */}
                        <td className="px-6 py-4 hidden lg:table-cell">
                          <div className="text-sm font-extrabold text-slate-900">
                            {appVndGranted.toLocaleString('vi-VN')} đ
                          </div>
                          <div className="text-[11px] font-bold text-slate-400 mt-0.5">
                            ~ ${Number(app.total_granted || 0).toFixed(2)} USD
                          </div>
                        </td>

                        {/* Ngân Sách Sử Dụng Column (Quy đổi VNĐ & USD) */}
                        <td className="px-6 py-4 font-medium text-slate-750">
                          {(() => {
                            const usagePercent = app.total_granted > 0 ? Math.min(100, (app.total_used / app.total_granted) * 100) : 0;
                            const barColorClass = usagePercent < 75 ? 'bg-emerald-500' : usagePercent <= 90 ? 'bg-amber-500' : 'bg-red-500';
                            return (
                              <div className="flex flex-col w-full min-w-37.5 sm:min-w-50">
                                <div className="flex items-center justify-between text-xs font-extrabold text-slate-900">
                                  <span>
                                    {appVndUsed.toLocaleString('vi-VN')}đ / {appVndGranted.toLocaleString('vi-VN')}đ
                                  </span>
                                  <span className="text-slate-600 font-bold">({usagePercent.toFixed(1)}%)</span>
                                </div>
                                
                                <div className="w-full bg-slate-100 rounded-full h-2 mt-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${barColorClass} transition-all duration-500`} 
                                    style={{ width: `${usagePercent}%` }} 
                                  />
                                </div>

                                <div className="text-[11px] font-bold text-slate-400 mt-1">
                                  ~ ${Number(app.total_used || 0).toFixed(2)} / ${Number(app.total_granted || 0).toFixed(2)} USD
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Thao tác Menu Dropdown */}
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
                              <div className="fixed inset-0 z-9998 bg-transparent" onClick={() => setActiveMenuId(null)} />
                              <div 
                                style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
                                className="fixed z-9999 w-40 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 text-left animate-in fade-in duration-150"
                              >
                                <button
                                  onClick={() => {
                                    setAppToEdit(app);
                                    setEditProvider((app.provider as any) || 'shopaikey');
                                    setEditAppName(app.name);
                                    setEditAppUrl(app.app_url || '');
                                    setEditApiLogin(app.api_login || '');
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

      {/* --- CREATE KEY MODAL (Hỗ trợ chọn Provider ShopAIKey & DataForSEO) --- */}
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
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateApp} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Provider Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nhà cung cấp (Provider)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewProvider('shopaikey')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      newProvider === 'shopaikey'
                        ? 'border-markee-primary bg-red-50/50 text-slate-900 font-bold ring-1 ring-markee-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1">
                        <span>ShopAIKey</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">1 USD = 3,250 VNĐ</div>
                    </div>
                    {newProvider === 'shopaikey' && <CheckCircle2 className="w-4 h-4 text-markee-primary shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProvider('dataforseo')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      newProvider === 'dataforseo'
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-blue-700 flex items-center gap-1">
                        <span>DataForSEO</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal mt-0.5">1 USD = 25,400 VNĐ</div>
                    </div>
                    {newProvider === 'dataforseo' && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

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

              {/* Dynamic Fields theo Provider */}
              {newProvider === 'shopaikey' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    SECRET KEY TỪ NHÀ CUNG CẤP
                  </label>
                  <input
                    type="text"
                    required
                    value={newAppSecretKey}
                    onChange={e => setNewAppSecretKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">Dán Secret Key của ShopAIKey vào đây để hệ thống đồng bộ ngân sách tài chính.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      API Login (Email)
                    </label>
                    <input
                      type="email"
                      required
                      value={newApiLogin}
                      onChange={e => setNewApiLogin(e.target.value)}
                      placeholder="email@company.com"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Email tài khoản đăng ký trên DataForSEO.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      API Password
                    </label>
                    <input
                      type="text"
                      required
                      value={newAppSecretKey}
                      onChange={e => setNewAppSecretKey(e.target.value)}
                      placeholder="Nhập API Password từ trang DataForSEO..."
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Mật khẩu API được cấp trong trang quản trị DataForSEO.</p>
                  </div>
                </>
              )}

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

      {/* --- EDIT APP MODAL --- */}
      {isEditModalOpen && appToEdit && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 mx-4 max-h-[90vh] flex flex-col">
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

            <form onSubmit={handleEditApp} className="space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Provider Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nhà cung cấp (Provider)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditProvider('shopaikey')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      editProvider === 'shopaikey'
                        ? 'border-markee-primary bg-red-50/50 text-slate-900 font-bold ring-1 ring-markee-primary'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold">ShopAIKey</div>
                      <div className="text-[10px] text-slate-400 font-normal">3,250 VNĐ/USD</div>
                    </div>
                    {editProvider === 'shopaikey' && <CheckCircle2 className="w-4 h-4 text-markee-primary shrink-0" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditProvider('dataforseo')}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                      editProvider === 'dataforseo'
                        ? 'border-blue-600 bg-blue-50/50 text-slate-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-blue-700">DataForSEO</div>
                      <div className="text-[10px] text-slate-400 font-normal">25,400 VNĐ/USD</div>
                    </div>
                    {editProvider === 'dataforseo' && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                  </button>
                </div>
              </div>

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

              {/* Dynamic inputs theo Edit Provider */}
              {editProvider === 'shopaikey' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Secret Key mới (Tùy chọn)</label>
                  <input
                    type="text"
                    value={editAppSecretKey}
                    onChange={e => setEditAppSecretKey(e.target.value)}
                    placeholder="Bỏ trống nếu giữ nguyên khóa cũ"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1.5">Nhập Secret Key mới nếu muốn cập nhật thông tin ShopAIKey.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">API Login (Email)</label>
                    <input
                      type="email"
                      required
                      value={editApiLogin}
                      onChange={e => setEditApiLogin(e.target.value)}
                      placeholder="email@company.com"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">API Password mới (Tùy chọn)</label>
                    <input
                      type="text"
                      value={editAppSecretKey}
                      onChange={e => setEditAppSecretKey(e.target.value)}
                      placeholder="Bỏ trống nếu giữ nguyên API Password cũ"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-mono"
                    />
                  </div>
                </>
              )}

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

      {/* --- DELETE CONFIRMATION MODAL --- */}
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
                  Ứng dụng: <span className="font-bold text-slate-700">{appToDelete.name}</span> ({appToDelete.provider === 'dataforseo' ? 'DataForSEO' : 'ShopAIKey'})
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
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Ứng dụng: <span className="font-bold text-slate-600">{historyAppName}</span> ({historyAppProvider === 'dataforseo' ? 'DataForSEO' : 'ShopAIKey'})
                  </p>
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
                      {historyLogs[0] ? getVndAmount(Number(historyLogs[0].total_used || 0), historyAppProvider).toLocaleString('vi-VN') + 'đ' : '0đ'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                      ~ ${historyLogs[0] ? Number(historyLogs[0].total_used || 0).toFixed(2) : '0.00'}
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Số dư hiện tại</span>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">
                      {historyLogs[0] ? getVndAmount(Number(historyLogs[0].balance || 0), historyAppProvider).toLocaleString('vi-VN') + 'đ' : '0đ'}
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
                            const logUsedVnd = getVndAmount(Number(log.total_used || 0), historyAppProvider);
                            const logBalanceVnd = getVndAmount(Number(log.balance || 0), historyAppProvider);

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 text-[10px]">{dateStr}</td>
                                <td className="px-4 py-3 text-slate-700">
                                  <div className="text-xs font-extrabold text-slate-800">{logUsedVnd.toLocaleString('vi-VN')}đ</div>
                                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                    ~ ${Number(log.total_used || 0).toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-xs font-extrabold text-emerald-600">{logBalanceVnd.toLocaleString('vi-VN')}đ</div>
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
