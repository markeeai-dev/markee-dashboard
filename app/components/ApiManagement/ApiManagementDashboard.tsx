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
  AlertTriangle
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
  id: string | number;
  name: string;
  secret_key: string;
  status: string;
  tokens_used: number;
  token_limit: number;
  requests: number;
  cost: number;
  created_at: string;
}

interface ApiManagementDashboardProps {
  isTab?: boolean;
}

export default function ApiManagementDashboard({ isTab = false }: ApiManagementDashboardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [activeTab, setActiveTab] = useState<'api_keys' | 'pricing'>('api_keys');
  const [apps, setApps] = useState<AppItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Pricing models states
  interface PricingModel {
    model_name: string;
    input_price: number;
    output_price: number;
    cache_price: number;
    is_alert: boolean;
    created_at?: string;
  }
  const [pricingModels, setPricingModels] = useState<PricingModel[]>([]);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [editPricingModel, setEditPricingModel] = useState<PricingModel | null>(null);
  const [isEditPricingModalOpen, setIsEditPricingModalOpen] = useState(false);
  const [editInputPrice, setEditInputPrice] = useState('');
  const [editOutputPrice, setEditOutputPrice] = useState('');
  const [editCachePrice, setEditCachePrice] = useState('');
  
  // Modal & Form States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [newAppLimit, setNewAppLimit] = useState('1000000');
  const [newAppKey, setNewAppKey] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [appToEdit, setAppToEdit] = useState<AppItem | null>(null);
  const [editAppName, setEditAppName] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<AppItem | null>(null);

  const [isViewKeyModalOpen, setIsViewKeyModalOpen] = useState(false);
  const [viewAppKeyData, setViewAppKeyData] = useState<AppItem | null>(null);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyAppName, setHistoryAppName] = useState('');
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Key Visibility & Copy state
  const [visibleKeyIds, setVisibleKeyIds] = useState<(string | number)[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | number | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | number | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Global toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setIsMounted(true);
    loadApps();
    loadPricingModels();
  }, []);

  // Load Pricing Models from Real Database API
  const loadPricingModels = async () => {
    try {
      setLoadingPricing(true);
      const res = await fetch('/api/pricing-models');
      if (!res.ok) throw new Error('Không thể tải bảng giá từ máy chủ.');
      const data = await res.json();
      setPricingModels(data || []);
    } catch (err: any) {
      console.error('Error loading pricing models:', err);
      setToast({ message: err.message || 'Lỗi tải bảng giá AI Models', type: 'error' });
    } finally {
      setLoadingPricing(false);
    }
  };

  // Update a model's pricing configurations
  const handleUpdatePricing = async () => {
    if (!editPricingModel) return;
    try {
      const res = await fetch('/api/pricing-models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_name: editPricingModel.model_name,
          input_price: parseFloat(editInputPrice) || 0,
          output_price: parseFloat(editOutputPrice) || 0,
          cache_price: parseFloat(editCachePrice) || 0
        })
      });

      if (!res.ok) throw new Error('Không thể cập nhật bảng giá trên máy chủ.');
      const updated = await res.json();

      setPricingModels(pricingModels.map(pm => pm.model_name === updated.model_name ? updated : pm));
      setIsEditPricingModalOpen(false);
      setEditPricingModel(null);
      setToast({ message: 'Cập nhật giá model thành công!', type: 'success' });
    } catch (err: any) {
      console.error('Error updating pricing model:', err);
      setToast({ message: err.message || 'Lỗi cập nhật bảng giá', type: 'error' });
    }
  };

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
  const handleCopyKey = (key: string, id: string | number) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  // Create App / Key via Real Database API
  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppName.trim()) return;

    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newAppName.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi tạo ứng dụng mới.');
      }

      console.log("Fetch API tạo key thành công!");
      setApps([resData, ...apps]);
      setNewAppKey(resData.secret_key);
      setToast({ message: 'Tạo API Key mới thành công!', type: 'success' });
    } catch (err: any) {
      console.error('Lỗi khi tạo key:', err);
      setToast({ message: err.message || 'Lỗi khi tạo API Key', type: 'error' });
    }
  };

  // Edit App Name via Real Database API
  const handleEditApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appToEdit || !editAppName.trim()) return;

    try {
      const res = await fetch('/api/apps', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: appToEdit.id, name: editAppName.trim() }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Lỗi khi sửa đổi tên ứng dụng.');
      }

      setApps(apps.map(app => app.id === appToEdit.id ? { ...app, name: resData.name } : app));
      setIsEditModalOpen(false);
      setAppToEdit(null);
      setToast({ message: 'Cập nhật tên ứng dụng thành công!', type: 'success' });
    } catch (err: any) {
      console.error('Lỗi khi sửa tên app:', err);
      setToast({ message: err.message || 'Lỗi khi sửa tên ứng dụng', type: 'error' });
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
      const res = await fetch(`/api/logs?app_id=${app.id}`);
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
  const totalCost = apps.reduce((sum, app) => sum + (app.cost || 0), 0);
  const totalTokens = apps.reduce((sum, app) => sum + (app.tokens_used || 0), 0);
  const totalRequests = apps.reduce((sum, app) => sum + (app.requests || 0), 0);
  const topApp = [...apps].sort((a, b) => (b.tokens_used || 0) - (a.tokens_used || 0))[0]?.name || 'Không có';

  // Filtered Apps
  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pie chart data structure
  const pieData = apps.length > 0 ? apps.map(app => ({
    name: app.name,
    value: app.tokens_used || 0
  })).sort((a, b) => b.value - a.value) : [{ name: 'Trống', value: 1 }];

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
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng chi phí (ước tính)</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-markee-primary flex items-center justify-center shrink-0 border border-red-100">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>+12.4% so với kỳ trước</span>
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng Token tiêu thụ</span>
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                {totalTokens.toLocaleString('en-US')}
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                ~ {Math.round(totalTokens / 750).toLocaleString()} từ vựng tiếng Anh
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng số Requests</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl md:text-2xl font-bold text-slate-900">
                {totalRequests.toLocaleString('en-US')}
              </div>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" />
                <span>+8.2% tỉ lệ thành công</span>
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between shadow-2xs relative overflow-hidden group hover:border-markee-primary/30 transition-all duration-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ứng dụng tiêu thụ cao nhất</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 truncate" title={topApp}>
                {topApp}
              </div>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                Chiếm ~ {totalTokens && apps.length > 0 ? Math.round((apps.find(a => a.name === topApp)?.tokens_used || 0) * 100 / totalTokens) : 0}% tổng tài nguyên
              </p>
            </div>
          </div>
        </section>

        {/* Charts Section */}
        {isMounted && (
          <section className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Bar Chart (2/3 width) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Xu hướng tiêu thụ API</h3>
                  <h4 className="text-sm font-bold text-slate-800 mt-1">Lượng token & Chi phí tiêu hao</h4>
                </div>
                <span className="text-[10px] bg-red-50 text-markee-primary font-bold px-2 py-1 rounded-md border border-red-100">
                  VNĐ = Cost * 25.400đ
                </span>
              </div>
              
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={DAILY_USAGE_DATA[timeFilter]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E3000F" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#E3000F" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }} 
                      labelClassName="font-bold text-slate-800"
                    />
                    <Bar name="Token sử dụng" dataKey="tokens" fill="url(#colorTokens)" radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Chart (1/3 width) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Cơ cấu tiêu thụ</h3>
                <h4 className="text-sm font-bold text-slate-800">Tỉ lệ token tiêu thụ giữa các ứng dụng</h4>
              </div>

              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString()} tokens`]}
                      contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text inside Donut */}
                <div className="absolute text-center">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Tổng cộng</span>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{apps.length > 0 ? Math.round(totalTokens / 1000) : 0}k</div>
                  <span className="text-[9px] text-slate-400 font-medium">tokens</span>
                </div>
              </div>

              {/* Legends list */}
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {apps.length > 0 ? pieData.slice(0, 4).map((entry, idx) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
<div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                      <span className="text-slate-600 truncate font-medium" title={entry.name}>{entry.name}</span>
                    </div>
                    <span className="text-slate-800 font-bold shrink-0">
                      {totalTokens ? Math.round(entry.value * 100 / totalTokens) : 0}%
                    </span>
                  </div>
                )) : (
                  <div className="text-xs text-slate-400 italic text-center py-2">Không có dữ liệu</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* API Keys & pricing Table List */}
        <section className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden h-auto">
          <div className="p-5 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-6 border-b border-slate-150 pb-2 mb-1">
                <button
                  onClick={() => setActiveTab('api_keys')}
                  className={`pb-2 text-sm font-bold transition-all relative border-0 bg-transparent cursor-pointer ${
                    activeTab === 'api_keys' ? 'text-markee-primary border-b-2 border-markee-primary font-bold' : 'text-slate-400 hover:text-slate-650 font-medium'
                  }`}
                >
                  Danh sách API Keys
                </button>
                <button
                  onClick={() => setActiveTab('pricing')}
                  className={`pb-2 text-sm font-bold transition-all relative border-0 bg-transparent cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'pricing' ? 'text-markee-primary border-b-2 border-markee-primary font-bold' : 'text-slate-400 hover:text-slate-650 font-medium'
                  }`}
                >
                  <span>Bảng giá AI Models</span>
                  {pricingModels.some(pm => pm.is_alert) && (
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75 bg-rose-500" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                    </span>
                  )}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                {activeTab === 'api_keys' 
                  ? 'Quản trị phân quyền sử dụng và giới hạn ngắt của từng ứng dụng.' 
                  : 'Cấu hình chi phí sử dụng chi tiết cho từng loại Model của AI provider.'}
              </p>
            </div>
            
            {activeTab === 'api_keys' ? (
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
                  onClick={() => {
                    setNewAppName('');
                    setNewAppLimit('1000000');
                    setNewAppKey(null);
                    setIsCreateModalOpen(true);
                  }}
                  className="bg-markee-primary hover:bg-markee-hover text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 flex items-center gap-1.5 border-0 cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tạo API Key mới</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                <button
                  onClick={loadPricingModels}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-650 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border-0 cursor-pointer text-slate-600 font-semibold"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Làm mới bảng giá</span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] pb-48 min-h-[220px] relative">
            {activeTab === 'api_keys' ? (
              loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-bold">Đang tải danh sách API Keys...</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs text-slate-500 overflow-visible">
                  <thead className="sticky top-0 bg-white z-10 shadow-xs">
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Tên Ứng dụng</th>
                      <th className="px-6 py-4">Secret Key</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4">Mức sử dụng (Tokens)</th>
                      <th className="px-6 py-4">Requests / Chi Phí</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApps.map((app, index) => {
                      const usagePercentage = Math.min((app.tokens_used / app.token_limit) * 100, 100);
                      const isOverLimit = app.tokens_used >= app.token_limit;
                      const isKeyVisible = visibleKeyIds.includes(app.id);
                      const isLastItem = index >= filteredApps.length - 2 && filteredApps.length > 2;

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{app.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-slate-650">
                            <div className="flex items-center gap-2">
                              <span>
                                {isKeyVisible 
                                  ? app.secret_key 
                                  : `${app.secret_key.slice(0, 14)}••••••••••••`}
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
                          <td className="px-6 py-4">
                            {isOverLimit ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-750 border border-red-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-605 bg-red-600" />
                                <span>Hết hạn mức</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-755 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-605 bg-emerald-500" />
                                <span>Hoạt động</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-full max-w-xs space-y-1">
                              <div className="flex items-center justify-between font-bold text-[10px]">
                                <span className="text-slate-700">{app.tokens_used.toLocaleString()} tokens</span>
                                <span className="text-slate-400">/ {app.token_limit.toLocaleString()} limit</span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    usagePercentage >= 90 ? 'bg-red-500' : usagePercentage >= 70 ? 'bg-amber-500' : 'bg-markee-primary'
                                  }`} 
                                  style={{ width: `${usagePercentage}%` }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-slate-800">
                            <div>{app.requests.toLocaleString()} rqs</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                              ${app.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({(app.cost * 25400).toLocaleString()}đ)
                            </div>
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
                                      setIsEditModalOpen(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 font-bold cursor-pointer border-0 bg-transparent text-xs"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Đổi tên</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setViewAppKeyData(app);
                                      setIsViewKeyModalOpen(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-slate-600 flex items-center gap-2 font-bold cursor-pointer border-0 bg-transparent text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem Secret Key</span>
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
                    {filteredApps.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-slate-400 font-medium">
                          Không tìm thấy ứng dụng nào khớp với từ khóa tìm kiếm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )
            ) : (
              loadingPricing ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <div className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-slate-400 font-bold">Đang tải bảng giá AI Models...</p>
                </div>
              ) : (
                <table className="w-full border-collapse text-left text-xs text-slate-500 overflow-visible">
                  <thead className="sticky top-0 bg-white z-10 shadow-xs">
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">Tên Model AI</th>
                      <th className="px-6 py-4">Giá Input ($/1M tokens)</th>
                      <th className="px-6 py-4">Giá Output ($/1M tokens)</th>
                      <th className="px-6 py-4">Giá Cache ($/1M tokens)</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pricingModels.map((pm) => {
                      const isAlert = pm.is_alert === true;
                      const isFree = pm.input_price === 0 && pm.output_price === 0;
                      return (
                        <tr 
                          key={pm.model_name} 
                          className={`transition-colors ${
                            isAlert 
                              ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-2 border-l-amber-500' 
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          <td className="px-6 py-4 font-bold text-slate-800">
                            <div className="flex items-center gap-2">
                              <span>{pm.model_name}</span>
                              {isAlert && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-850 border border-amber-200">
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                  <span>Cần cập nhật giá</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">
                            ${pm.input_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">
                            ${pm.output_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-700">
                            ${pm.cache_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>
                          <td className="px-6 py-4">
                            {isAlert ? (
                              <span className="text-[10px] text-amber-600 font-bold">Chưa cấu hình</span>
                            ) : (
                              <span className="text-[10px] text-emerald-650 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isFree ? 'Miễn phí' : 'Hoạt động'}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => {
                                setEditPricingModel(pm);
                                setEditInputPrice(pm.input_price.toString());
                                setEditOutputPrice(pm.output_price.toString());
                                setEditCachePrice(pm.cache_price.toString());
                                setIsEditPricingModalOpen(true);
                              }}
                              className="px-3 py-1.5 hover:bg-slate-100 rounded-lg text-slate-650 hover:text-slate-900 font-bold transition-all border-0 bg-transparent cursor-pointer text-xs inline-flex items-center gap-1 ml-auto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Sửa giá</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {pricingModels.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                          Chưa có cấu hình giá model nào. Model mới sẽ tự động hiển thị ở đây khi được gọi qua chat webhook.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )
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
                  loadApps(); // Reload bảng để cập nhật item mới
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!newAppKey ? (
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
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Giới hạn định mức (Tokens)</label>
                  <select
                    value={newAppLimit}
                    onChange={e => setNewAppLimit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                  >
                    <option value="500000">500.000 tokens</option>
                    <option value="1000000">1.000.000 tokens</option>
                    <option value="2000000">2.000.000 tokens</option>
                    <option value="5000000">5.000.000 tokens</option>
                    <option value="10000000">10.000.000 tokens</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5">Hệ thống sẽ ghi nhận định mức tokens giới hạn cho mục đích theo dõi và cảnh báo.</p>
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
                    Tạo API Key
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5 flex-1 flex flex-col justify-between">
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800">Tạo API Key Thành Công!</h4>
                    <p className="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">
                      Khóa API của bạn đã được khởi tạo thành công. Bạn có thể xem lại và sao chép Secret Key này bất kỳ lúc nào trực tiếp từ bảng điều khiển bằng biểu tượng con mắt 👁️.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Secret Key</label>
                  <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl">
                    <span className="font-mono text-xs text-slate-800 break-all select-all font-semibold">{newAppKey}</span>
                    <button
                      onClick={() => handleCopyKey(newAppKey, -99)}
                      className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                      title="Sao chép Key"
                    >
                      {copiedKeyId === -99 ? (
                        <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in-50 duration-150" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-5 flex items-center justify-end shrink-0">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      loadApps(); // Reload bảng để cập nhật item mới
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all border-0 cursor-pointer"
                  >
                    Tôi đã lưu lại khóa này
                  </button>
                </div>
              </div>
            )}
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
                <span>Đổi tên Ứng dụng</span>
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tên mới của ứng dụng</label>
                <input
                  type="text"
                  required
                  value={editAppName}
                  onChange={e => setEditAppName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
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
                    onClick={() => handleCopyKey(viewAppKeyData.secret_key, -98)}
                    className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                    title="Sao chép Key"
                  >
                    {copiedKeyId === -98 ? (
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
                    <span>Lịch sử sử dụng API</span>
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
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Tỷ lệ thành công</span>
                    <div className="text-sm font-bold text-emerald-600 mt-0.5">100%</div>
                  </div>
                  <div className="text-center border-x border-slate-200/60">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Requests lọc</span>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{historyLogs.length.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Latency tb</span>
                    <div className="text-sm font-bold text-slate-850 mt-0.5">340ms</div>
                  </div>
                </div>

                {/* History table */}
                <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-3xs min-h-[200px] flex flex-col bg-white">
                  {loadingHistory ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-16 gap-2">
                      <div className="w-6 h-6 border-2 border-markee-primary border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-slate-400 font-bold">Đang tải lịch sử sử dụng...</p>
                    </div>
                  ) : historyLogs.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-slate-400 italic py-16">
                      Chưa ghi nhận lịch sử sử dụng nào cho API Key này.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-xs text-slate-500">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-150 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="px-4 py-3">Thời gian</th>
                            <th className="px-4 py-3">Model / Phân loại</th>
                            <th className="px-4 py-3">Tokens (In/Out)</th>
                            <th className="px-4 py-3 text-right">Chi phí</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {historyLogs.map((log) => {
                            const dateStr = log.created_at 
                              ? new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) 
                              : '---';
                            return (
                              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3 text-slate-400 text-[10px]">{dateStr}</td>
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-700">{log.model || 'Unknown model'}</div>
                                  <div className={`text-[9px] font-semibold w-fit px-1.5 py-0.5 rounded-md mt-0.5 ${
                                    log.is_free ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {log.is_free ? 'Miễn phí' : 'Tính phí'}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-slate-800 font-bold">{(log.total_tokens || 0).toLocaleString()}</div>
                                  <div className="text-[9px] text-slate-400">
                                    {(log.input_tokens || 0).toLocaleString()} / {(log.output_tokens || 0).toLocaleString()}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right text-slate-850 font-bold text-[11px]">
                                  ${(log.cost || 0).toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 })}
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

      {/* --- EDIT PRICING MODEL MODAL --- */}
      {isEditPricingModalOpen && editPricingModel && (
        <div className="fixed inset-0 z-[1050] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 mx-4">
            <div className="flex items-center justify-between shrink-0 mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-markee-primary" />
                <span>Cấu hình Giá Model AI</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditPricingModalOpen(false);
                  setEditPricingModel(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors border-0 bg-transparent cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tên Model AI</label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                  {editPricingModel.model_name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Giá Input ($ trên 1M tokens)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editInputPrice}
                  onChange={e => setEditInputPrice(e.target.value)}
                  placeholder="Ví dụ: 0.15"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Giá Output ($ trên 1M tokens)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editOutputPrice}
                  onChange={e => setEditOutputPrice(e.target.value)}
                  placeholder="Ví dụ: 0.60"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Giá Cache ($ trên 1M tokens)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editCachePrice}
                  onChange={e => setEditCachePrice(e.target.value)}
                  placeholder="Ví dụ: 0.075"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs text-slate-700 bg-white focus:outline-none focus:border-markee-primary focus:ring-1 focus:ring-markee-primary"
                />
              </div>

              <div className="border-t border-slate-100 pt-5 mt-5 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditPricingModalOpen(false);
                    setEditPricingModel(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer bg-white"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdatePricing}
                  className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 border-0 cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
