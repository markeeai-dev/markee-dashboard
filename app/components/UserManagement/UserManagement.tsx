'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Settings } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import {
  fetchAllUsers,
  fetchAILicenses,
  fetchAIUsageStats,
  updateUserRole,
  createAILicense,
  updateAILicense,
  type AppUser,
  type AILicense,
  type AIUsageStat,
  type UserProfile,
  type UserRole,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';

// Helper functions
function formatCurrency(value: number) {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VNĐ';
}

function getHeartbeatStatus(lastPingAtStr: string | null | undefined) {
  if (!lastPingAtStr) return 'offline';
  const lastPing = new Date(lastPingAtStr);
  const now = new Date();
  const diffMs = now.getTime() - lastPing.getTime();
  const diffMins = diffMs / 1000 / 60;
  if (diffMins < 5) return 'active';
  if (diffMins < 15) return 'idle';
  return 'offline';
}

function formatResetTime(resetTimeStr: string | null | undefined) {
  if (!resetTimeStr) return "Chưa có dữ liệu đặt lại";
  return `Ngày đặt lại: ${resetTimeStr}`;
}

export default function UserManagement({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [activeTab, _setActiveTab] = useState<'users' | 'licenses'>(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const utab = searchParams.get('utab');
      if (utab && ['users', 'licenses'].includes(utab)) {
        return utab as 'users' | 'licenses';
      }
    }
    return 'licenses';
  });

  const setActiveTab = (tab: 'users' | 'licenses') => {
    _setActiveTab(tab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      params.set('utab', tab);
      router.replace(`${window.location.pathname}?${params.toString()}`);
    }
  };
  const [users, setUsers] = useState<AppUser[]>([]);
  const [filterRole, setFilterRole] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'loading' } | null>(null);

  // License management states
  const [licenses, setLicenses] = useState<AILicense[]>([]);
  const [usageStats, setUsageStats] = useState<AIUsageStat[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [timeTick, setTimeTick] = useState(0);

  // Filter states
  const [filterTag, setFilterTag] = useState<'All' | 'Personal' | 'Company'>('All');
  const [filterTool, setFilterTool] = useState<string>('All');
  const [filterActivity, setFilterActivity] = useState<'All' | 'Online' | 'Idle' | 'Offline'>('All');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<AILicense | null>(null);

  // Create license form state
  const [newLicenseEmail, setNewLicenseEmail] = useState('');
  const [newLicenseTool, setNewLicenseTool] = useState('ChatGPT');
  const [newLicensePlan, setNewLicensePlan] = useState('Pro');
  const [newLicenseCost, setNewLicenseCost] = useState('500000');
  const [newLicenseExpiry, setNewLicenseExpiry] = useState('');
  const [newLicenseCurrency, setNewLicenseCurrency] = useState('VND');
  const [newLicenseAssignedUsers, setNewLicenseAssignedUsers] = useState<string[]>([]);
  const [isUserSelectOpen, setIsUserSelectOpen] = useState(false);
  const [newLicenseTag, setNewLicenseTag] = useState<'Company' | 'Personal'>('Company');

  // Edit license form state
  const [editTool, setEditTool] = useState('ChatGPT');
  const [editPlan, setEditPlan] = useState('Pro');
  const [editCost, setEditCost] = useState('500000');
  const [editExpiry, setEditExpiry] = useState('');
  const [editCurrency, setEditCurrency] = useState('VND');
  const [editAssignedUsers, setEditAssignedUsers] = useState<string[]>([]);
  const [isEditUserSelectOpen, setIsEditUserSelectOpen] = useState(false);
  const [editTag, setEditTag] = useState<'Company' | 'Personal'>('Company');

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
      showToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadLicenses(silent = false) {
    if (!silent) setLicensesLoading(true);
    try {
      const [lics, stats] = await Promise.all([fetchAILicenses(), fetchAIUsageStats()]);

      const licensesWithUsage = await Promise.all(
        lics.map(async (license) => {
          const { data: usageData } = await supabase
            .from('ai_usage_stats')
            .select('weekly_used, reset_time')
            .eq('email', license.email)
            .eq('ai_tool', license.ai_tool)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Ép kiểu Text "19%" thành Number 19 để truyền vào Progress Bar
          let usageNumber = 0;
          if (usageData && usageData.weekly_used) {
            usageNumber = parseInt(usageData.weekly_used.replace('%', '')) || 0;
          }

          return {
            ...license,
            usagePercent: usageNumber,
            weekly_used: usageData?.weekly_used || 'Chưa quét',
            reset_time: usageData?.reset_time || null
          };
        })
      );

      setLicenses(licensesWithUsage);
      setUsageStats(stats);
    } catch (e) {
      console.error(e);
      showToast('Không thể tải thông tin bản quyền AI', 'error');
    } finally {
      if (!silent) setLicensesLoading(false);
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'loading', duration = 3000) {
    setToast({ message, type });
    if (type !== 'loading') {
      setTimeout(() => {
        setToast(current => current?.message === message ? null : current);
      }, duration);
    }
  }

  async function handleRoleChange(userId: number, newRole: UserRole) {
    showToast('Đang lưu thay đổi...', 'loading');
    try {
      await updateUserRole(userId, newRole);
      setUsers(prevUsers => prevUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
      showToast('Đã cập nhật quyền thành công!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật quyền người dùng', 'error');
    }
  }

  async function handleCreateLicense(e: React.FormEvent) {
    e.preventDefault();
    if (newLicenseAssignedUsers.length === 0 || !newLicenseExpiry) {
      showToast('Vui lòng chọn nhân viên và ngày hết hạn', 'error');
      return;
    }

    showToast('Đang tạo bản quyền...', 'loading');
    try {
      const finalCost = newLicenseCurrency === 'USD' ? Math.round((Number(newLicenseCost) || 0) * 25400) : Math.round(Number(newLicenseCost) || 0);
      const finalPlanName = newLicenseTag === 'Personal' ? `${newLicensePlan} (Cá nhân)` : newLicensePlan;
      const newLic = await createAILicense({
        email: newLicenseAssignedUsers[0],
        assigned_users: newLicenseAssignedUsers,
        ai_tool: newLicenseTool,
        plan_name: finalPlanName,
        monthly_cost: finalCost,
        expiration_date: newLicenseExpiry,
      });

      setLicenses(prev => [newLic, ...prev]);
      showToast('Cấp mới bản quyền thành công!', 'success');
      setIsCreateModalOpen(false);
      setNewLicenseEmail('');
      setNewLicenseAssignedUsers([]);
      setNewLicenseTool('ChatGPT');
      setNewLicensePlan('Pro');
      setNewLicenseCost('500000');
      setNewLicenseCurrency('VND');
      setNewLicenseExpiry('');
      setNewLicenseTag('Company');
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi tạo bản quyền AI', 'error');
    }
  }

  async function handleUpdateLicense(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLicense || !editExpiry || editAssignedUsers.length === 0) {
      showToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    showToast('Đang cập nhật bản quyền...', 'loading');
    try {
      const finalPlanName = editTag === 'Personal' ? `${editPlan} (Cá nhân)` : editPlan;

      const finalCost = editCurrency === 'USD' ? Math.round((Number(editCost) || 0) * 25400) : Math.round(Number(editCost) || 0);
      const updatedLic = await updateAILicense(selectedLicense.id, {
        email: editAssignedUsers[0],
        assigned_users: editAssignedUsers,
        ai_tool: editTool,
        plan_name: finalPlanName,
        monthly_cost: finalCost,
        expiration_date: editExpiry,
      });
      setLicenses(prev => prev.map(lic => lic.id === selectedLicense.id ? { ...updatedLic, usagePercent: lic.usagePercent } : lic));

      // Clear requested status
      localStorage.removeItem(`license_requested_${selectedLicense.id}`);

      showToast('Cập nhật bản quyền thành công!', 'success');
      setIsRenewModalOpen(false);
      setSelectedLicense(null);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật bản quyền', 'error');
    }
  }

  useEffect(() => {
    loadUsers();
    loadLicenses();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeTick(prev => prev + 1);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      loadLicenses(true);
    };
    window.addEventListener('focus', handleFocus);

    const channel = supabase
      .channel('admin-license-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage_stats'
        },
        () => {
          loadLicenses(true);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_licenses'
        },
        () => {
          loadLicenses(true);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, []);

  const activeLicenses = useMemo(() => {
    return licenses.filter(lic => lic.status !== 'Canceled');
  }, [licenses]);

  const filteredLicenses = useMemo(() => {
    return activeLicenses.filter(lic => {
      // 1. Tag Filter
      if (filterTag !== 'All') {
        const isPersonal = lic.plan_name.includes('(Cá nhân)');
        if (filterTag === 'Personal' && !isPersonal) return false;
        if (filterTag === 'Company' && isPersonal) return false;
      }

      // 2. Tool Filter
      if (filterTool !== 'All') {
        const toolLower = lic.ai_tool.toLowerCase();
        const filterToolLower = filterTool.toLowerCase();
        if (!toolLower.includes(filterToolLower)) return false;
      }

      // 3. Activity/Heartbeat Filter
      if (filterActivity !== 'All') {
        const hbStatus = getHeartbeatStatus(lic.last_ping_at);
        if (filterActivity === 'Online' && hbStatus !== 'active') return false;
        if (filterActivity === 'Idle' && hbStatus !== 'idle') return false;
        if (filterActivity === 'Offline' && hbStatus !== 'offline') return false;
      }

      return true;
    });
  }, [activeLicenses, filterTag, filterTool, filterActivity, timeTick]);

  const totalMonthlyCost = useMemo(() => {
    return activeLicenses.reduce((sum, lic) => {
      const val = Number(lic.monthly_cost || 0);
      return sum + val;
    }, 0);
  }, [activeLicenses]);

  const totalActiveCount = activeLicenses.length;

  const costByToolData = useMemo(() => {
    const costMap: { [tool: string]: number } = {};
    activeLicenses.forEach(lic => {
      const tool = lic.ai_tool;
      const val = Number(lic.monthly_cost || 0);
      costMap[tool] = (costMap[tool] || 0) + val;
    });
    return Object.keys(costMap).map(tool => ({
      name: tool,
      cost: costMap[tool],
    }));
  }, [activeLicenses]);

  const planDistributionData = useMemo(() => {
    const planMap: { [plan: string]: number } = {
      'Free': 0,
      'Plus': 0,
      'Pro': 0,
      'Ultra': 0,
    };
    activeLicenses.forEach(lic => {
      const plan = lic.plan_name.replace(' (Cá nhân)', '');
      planMap[plan] = (planMap[plan] || 0) + 1;
    });
    return Object.keys(planMap)
      .map(plan => ({
        name: plan,
        value: planMap[plan],
      }))
      .filter(d => d.value > 0);
  }, [activeLicenses]);

  const getLicenseStatus = (lic: AILicense) => {
    const isCanceled = localStorage.getItem(`license_status_${lic.id}`) === 'Canceled';
    if (isCanceled) return 'Canceled';
    const isExpired = new Date(lic.expiration_date) < new Date();
    return isExpired ? 'Expired' : 'Active';
  };

  const planColors = ['#94a3b8', '#38bdf8', '#a855f7', '#E3000F'];

  const filteredUsers = users.filter((u) => {
    if (filterRole === 'All') return true;
    return u.role === filterRole;
  });

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
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

      {/* Header with Tab Switcher */}
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Quản lý hệ thống</h1>
          <p className="text-xs text-markee-muted">Quản lý phân quyền và cấp phát bản quyền AI công ty.</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('licenses')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 ${activeTab === 'licenses' ? 'bg-white text-markee-text shadow-xs' : 'bg-transparent text-markee-muted hover:text-markee-text'
              }`}
          >
            Quản lý Bản quyền AI
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 ${activeTab === 'users' ? 'bg-white text-markee-text shadow-xs' : 'bg-transparent text-markee-muted hover:text-markee-text'
              }`}
          >
            Danh sách User
          </button>
        </div>
      </section>

      {/* Tab 1: Users */}
      {activeTab === 'users' && (
        <>
          {/* Bộ lọc Role */}
          <div className="mb-4 flex items-center justify-between bg-white p-4 rounded-xl border border-markee-border shadow-3xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-markee-muted">Bộ lọc Role:</span>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="rounded-lg border border-markee-border bg-white px-3 py-1.5 text-xs font-medium text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
              >
                <option value="All">Tất cả (All)</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="text-xs text-markee-muted font-bold">
              Hiển thị {filteredUsers.length} người dùng
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách người dùng...</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-markee-border bg-white shadow-xs whitespace-nowrap">
              <table className="w-full border-collapse text-left text-sm text-markee-text table-auto md:table-fixed">
                <thead className="bg-markee-bg text-xs font-semibold uppercase tracking-wider text-markee-muted border-b border-markee-border">
                  <tr>
                    <th className="px-6 py-4 w-1/2 md:w-1/4">Tên người dùng</th>
                    <th className="px-6 py-4 w-1/4 hidden md:table-cell">Email</th>
                    <th className="px-6 py-4 w-1/4 md:w-1/6">Vai trò (Role)</th>
                    <th className="px-6 py-4 w-1/4 md:w-1/6">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-markee-border">
                  {filteredUsers.map((user) => {
                    const isSelf = user.email === profile?.email;
                    const isAdminUser = profile?.role === 'admin';
                    const isDropdownDisabled = isSelf || isAdminUser || user.role === 'super_admin';

                    return (
                      <tr key={user.id} className="hover:bg-markee-bg/20 transition-colors">
                        <td className="px-6 py-4 font-semibold text-markee-text truncate max-w-40 md:max-w-none" title={user.full_name || 'Chưa cập nhật'}>
                          {user.full_name || 'Chưa cập nhật'}
                        </td>
                        <td className="px-6 py-4 text-markee-muted truncate hidden md:table-cell" title={user.email}>
                          {user.email}
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user.role || 'user'}
                            disabled={isDropdownDisabled}
                            onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                            className="rounded-lg border border-markee-border bg-white px-3 py-1.5 text-xs font-medium text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                          >
                            {user.role === 'super_admin' ? (
                              <option value="super_admin">Super Admin</option>
                            ) : (
                              <>
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </>
                            )}
                          </select>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Active
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-markee-sub">Không tìm thấy người dùng nào.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab 2: Licenses */}
      {activeTab === 'licenses' && (
        <div className="space-y-6">
          {/* Top Half: Charts & Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric Cards */}
            <div className="space-y-5 flex flex-col justify-between">
              <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-markee-muted uppercase tracking-wider">Tổng chi phí tháng</span>
                <span className="text-2xl font-black text-markee-text mt-2">
                  {formatCurrency(totalMonthlyCost)}
                </span>
                <span className="text-[10px] text-markee-muted mt-1">Tính trên các gói tài khoản đang hoạt động</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs flex-1 flex flex-col justify-center">
                <span className="text-xs font-bold text-markee-muted uppercase tracking-wider">Tài khoản Active</span>
                <span className="text-2xl font-black text-markee-text mt-2">{totalActiveCount} tài khoản</span>
                <span className="text-[10px] text-markee-muted mt-1">Đang hoạt động trên hệ thống</span>
              </div>
            </div>

            {/* Bar Chart: Cost by tool */}
            <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs col-span-1">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider mb-4">Chi phí theo công cụ (VNĐ)</h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costByToolData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} formatter={(value) => [formatCurrency(Number(value)), 'Chi phí']} />
                    <Bar dataKey="cost" fill="#E3000F" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Donut Chart: Plan distribution */}
            <div className="bg-white p-5 rounded-xl border border-markee-border shadow-xs col-span-1 flex flex-col items-center">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider mb-4 w-full text-left">Phân bổ gói cước</h3>
              <div className="h-44 w-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {planDistributionData.map((entry, index) => {
                        const planIndex = ['Free', 'Plus', 'Pro', 'Ultra'].indexOf(entry.name);
                        return <Cell key={`cell-${index}`} fill={planColors[planIndex >= 0 ? planIndex : 0]} />;
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute text-center pointer-events-none">
                  <div className="text-lg font-bold text-markee-text">{totalActiveCount}</div>
                  <div className="text-[8px] text-markee-muted uppercase font-semibold">Tài khoản</div>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] mt-2">
                {planDistributionData.map((d) => {
                  const planIndex = ['Free', 'Plus', 'Pro', 'Ultra'].indexOf(d.name);
                  const color = planColors[planIndex >= 0 ? planIndex : 0];
                  return (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-markee-text">{d.name} ({d.value})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="bg-white rounded-xl border border-markee-border overflow-hidden">
            <div className="px-6 py-4 border-b border-markee-border flex items-center justify-between bg-markee-bg/10">
              <h3 className="text-xs font-bold text-markee-text uppercase tracking-wider">Danh sách Bản quyền được cấp</h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="px-3.5 py-1.5 bg-markee-primary hover:bg-markee-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border-0"
              >
                <span>➕</span>
                <span>Cấp mới tài khoản</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="px-6 py-3.5 bg-slate-50/50 border-b border-markee-border flex flex-wrap gap-4 items-center justify-between animate-in fade-in duration-200">
              <div className="flex flex-wrap gap-4 items-center">
                {/* Lọc theo Nhãn */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Nhãn:</span>
                  <select
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
                  >
                    <option value="All">Tất cả</option>
                    <option value="Personal">Cá nhân</option>
                    <option value="Company">Công ty</option>
                  </select>
                </div>

                {/* Lọc theo Công cụ */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Công cụ:</span>
                  <select
                    value={filterTool}
                    onChange={(e) => setFilterTool(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
                  >
                    <option value="All">Tất cả</option>
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>

                {/* Lọc theo Trạng thái Hoạt động */}
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hoạt động:</span>
                  <select
                    value={filterActivity}
                    onChange={(e) => setFilterActivity(e.target.value as any)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-markee-text focus:border-markee-primary outline-none transition-colors cursor-pointer"
                  >
                    <option value="All">Tất cả</option>
                    <option value="Online">Online</option>
                    <option value="Idle">Idle</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>
              </div>

              {/* Reset Filters button */}
              {(filterTag !== 'All' || filterTool !== 'All' || filterActivity !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterTag('All');
                    setFilterTool('All');
                    setFilterActivity('All');
                  }}
                  className="text-xs font-bold text-markee-primary hover:text-markee-hover transition-colors cursor-pointer border-0 bg-transparent"
                >
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

            {licensesLoading ? (
              <div className="text-center py-10 text-sm text-markee-sub">Đang tải danh sách bản quyền...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm text-markee-text table-fixed min-w-300">
                  <thead className="bg-markee-bg text-xs font-semibold uppercase tracking-wider text-markee-muted border-b border-markee-border">
                    <tr>
                      <th className="px-6 py-4 w-48 max-w-62.5 truncate">Người được cấp</th>
                      <th className="px-6 py-4 w-28 min-w-25">Công cụ AI</th>
                      <th className="px-6 py-4 w-32 min-w-27.5">Loại gói</th>
                      <th className="px-6 py-4 w-32 min-w-30 whitespace-nowrap">Chi phí</th>
                      <th className="px-6 py-4 w-44 min-w-40 %-using">Bộ nhớ / % Sử dụng tuần</th>
                      <th className="px-6 py-4 w-32 min-w-27.5">Ngày hết hạn</th>
                      <th className="px-6 py-4 w-32 min-w-30 whitespace-nowrap">Trạng thái</th>
                      <th className="px-6 py-4 w-28 whitespace-normal leading-tight text-center">Hoạt động</th>
                      <th className="px-6 py-4 w-32 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-markee-border">
                    {filteredLicenses.map((lic) => {
                      const status = getLicenseStatus(lic);
                      let statusBadge = "bg-gray-100 text-gray-700 border-gray-200";
                      let statusText = "Không hoạt động";
                      if (status === 'Active') {
                        statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                        statusText = "Còn hạn";
                      } else if (status === 'Expired') {
                        statusBadge = "bg-red-50 text-red-700 border-red-200";
                        statusText = "Đã hết hạn";
                      } else if (status === 'Canceled') {
                        statusBadge = "bg-slate-100 text-slate-500 border-slate-200";
                        statusText = "Đã hủy";
                      }

                      const isPersonal = lic.plan_name.includes('(Cá nhân)');
                      const displayPlanName = lic.plan_name.replace(' (Cá nhân)', '');

                      return (
                        <tr key={lic.id} className="hover:bg-markee-bg/20 transition-colors">
                          <td className="px-6 py-4 font-semibold text-markee-text truncate max-w-62.5">
                            {lic.assigned_users && lic.assigned_users.length > 0 ? (
                              <div className="flex flex-wrap gap-1 items-center max-w-xs animate-in fade-in duration-200" title={lic.assigned_users.join(', ')}>
                                {lic.assigned_users.slice(0, 2).map((user, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200 truncate max-w-20 inline-block">
                                    {user.split('@')[0]}
                                  </span>
                                ))}
                                {lic.assigned_users.length > 2 && (
                                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                    +{lic.assigned_users.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200">
                                {lic.email ? lic.email.split('@')[0] : 'N/A'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-markee-muted">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-medium text-xs">
                              {lic.ai_tool}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-medium text-markee-text">
                            <div className="flex items-center gap-1.5">
                              <span>{displayPlanName}</span>
                              {isPersonal ? (
                                <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Cá nhân
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                  Công ty
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-markee-text whitespace-nowrap min-w-30">
                            {formatCurrency(lic.monthly_cost)}
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const usagePercent = lic.usagePercent !== undefined ? lic.usagePercent : 0;
                              return (
                                <div className="relative group/tooltip">
                                  {/* Tooltip Content */}
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-slate-900 text-white text-[10px] font-medium py-1.5 px-3 rounded-lg shadow-xl whitespace-nowrap z-70 animate-in fade-in slide-in-from-bottom-1 duration-150">
                                    {formatResetTime(lic.reset_time)}
                                    {/* Tooltip Arrow */}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="flex items-center gap-3 w-full max-w-35 cursor-help">
                                    {/* Rãnh nền xám (Background Track) */}
                                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                      {/* Thanh màu chạy theo % */}
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${usagePercent >= 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${usagePercent}%` }}
                                      ></div>
                                    </div>
                                    {/* Con số % cố định độ rộng để thẳng hàng */}
                                    <span className="text-sm font-bold text-slate-700 w-12 text-right">
                                      {usagePercent}%
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-markee-muted">
                            {new Date(lic.expiration_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap min-w-30">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge} whitespace-nowrap`}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-6 py-4 w-37.5 whitespace-nowrap">
                            {(() => {
                              const hbStatus = getHeartbeatStatus(lic.last_ping_at);
                              if (hbStatus === 'active') {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-help"
                                      title={`Sử dụng bởi ${lic.last_active_user || 'Không rõ'} trên ${lic.last_active_device || 'Không rõ'}`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Online
                                    </span>
                                  );
                              } else if (hbStatus === 'idle') {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 cursor-help"
                                      title={`Treo từ ${lic.last_ping_at ? new Date(lic.last_ping_at).toLocaleTimeString() : 'Không rõ'}`}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      Idle (Treo)
                                    </span>
                                  );
                              } else {
                                  return (
                                    <span
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 cursor-help"
                                      title={lic.last_ping_at ? `Lần cuối hoạt động: ${new Date(lic.last_ping_at).toLocaleString('vi-VN')}` : 'Chưa từng hoạt động'}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                      Offline
                                    </span>
                                  );
                              }
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedLicense(lic);
                                setEditTool(lic.ai_tool);
                                setEditPlan(lic.plan_name.replace(' (Cá nhân)', ''));
                                setEditCost(String(lic.monthly_cost));
                                setEditExpiry(lic.expiration_date.split('T')[0]);
                                setEditCurrency('VND');
                                setEditAssignedUsers(lic.assigned_users || (lic.email ? [lic.email] : []));
                                setEditTag(lic.plan_name.includes('(Cá nhân)') ? 'Personal' : 'Company');
                                setIsRenewModalOpen(true);
                              }}
                              className="text-markee-primary hover:text-markee-hover font-bold text-xs cursor-pointer transition-colors border-0 bg-transparent"
                            >
                              Cập nhật
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredLicenses.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-8 text-markee-sub">Không tìm thấy bản quyền AI nào phù hợp với bộ lọc.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create License Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleCreateLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Cấp mới Bản quyền AI</h2>
              <p className="text-xs text-markee-muted mt-1">Cấp mới quyền sử dụng công cụ AI cho nhân viên.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Nhân viên được cấp quyền</label>
                <div className="relative z-60">
                  <button
                    type="button"
                    onClick={() => setIsUserSelectOpen(!isUserSelectOpen)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text text-left focus:outline-none focus:ring-1 focus:ring-markee-primary flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {newLicenseAssignedUsers.length === 0
                        ? 'Chọn nhân viên...'
                        : `${newLicenseAssignedUsers.length} nhân viên đã chọn`}
                    </span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>
                  {isUserSelectOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsUserSelectOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto bg-white border border-markee-border rounded-lg shadow-lg p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                        {users.map(u => {
                          const isSelected = newLicenseAssignedUsers.includes(u.email);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer text-xs font-medium text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setNewLicenseAssignedUsers(prev => prev.filter(email => email !== u.email));
                                  } else {
                                    setNewLicenseAssignedUsers(prev => [...prev, u.email]);
                                  }
                                }}
                                className="rounded text-markee-primary focus:ring-markee-primary"
                              />
                              <span className="truncate">{u.full_name || u.email} ({u.email})</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Nhãn tài khoản</label>
                  <select
                    value={newLicenseTag}
                    onChange={(e) => setNewLicenseTag(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Company">Công ty</option>
                    <option value="Personal">Cá nhân</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={newLicenseTool}
                    onChange={(e) => setNewLicenseTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={newLicensePlan}
                    onChange={(e) => setNewLicensePlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={newLicenseExpiry}
                    onChange={(e) => setNewLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí tháng</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    required
                    value={newLicenseCost}
                    onChange={(e) => setNewLicenseCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                  <select
                    value={newLicenseCurrency}
                    onChange={(e) => setNewLicenseCurrency(e.target.value)}
                    className="px-2 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary outline-none cursor-pointer shrink-0"
                  >
                    <option value="VND">VNĐ</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {newLicenseCurrency === 'USD' && newLicenseCost && (
                  <span className="block text-xs text-slate-500 font-bold mt-1">
                    ~ {new Intl.NumberFormat('vi-VN').format(Math.round(Number(newLicenseCost) * 25400))} VNĐ
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Tạo mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Update License Modal */}
      {isRenewModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleUpdateLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Cập nhật Bản quyền</h2>
              <p className="text-xs text-markee-muted mt-1">
                Cập nhật thông tin bản quyền cho tài khoản <span className="font-semibold text-markee-text">{selectedLicense.email}</span>.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Nhân viên được cấp quyền</label>
                <div className="relative z-60">
                  <button
                    type="button"
                    onClick={() => setIsEditUserSelectOpen(!isEditUserSelectOpen)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text text-left focus:outline-none focus:ring-1 focus:ring-markee-primary flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate">
                      {editAssignedUsers.length === 0
                        ? 'Chọn nhân viên...'
                        : `${editAssignedUsers.length} nhân viên đã chọn`}
                    </span>
                    <span className="text-[10px] text-slate-400">▼</span>
                  </button>
                  {isEditUserSelectOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsEditUserSelectOpen(false)} />
                      <div className="absolute left-0 right-0 mt-1 z-50 max-h-48 overflow-y-auto bg-white border border-markee-border rounded-lg shadow-lg p-2 space-y-1.5 animate-in fade-in zoom-in-95 duration-150">
                        {users.map(u => {
                          const isSelected = editAssignedUsers.includes(u.email);
                          return (
                            <label
                              key={u.id}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer text-xs font-medium text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {
                                  if (isSelected) {
                                    setEditAssignedUsers(prev => prev.filter(email => email !== u.email));
                                  } else {
                                    setEditAssignedUsers(prev => [...prev, u.email]);
                                  }
                                }}
                                className="rounded text-markee-primary focus:ring-markee-primary"
                              />
                              <span className="truncate">{u.full_name || u.email} ({u.email})</span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Nhãn tài khoản</label>
                  <select
                    value={editTag}
                    onChange={(e) => setEditTag(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Company">Công ty</option>
                    <option value="Personal">Cá nhân</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={editTool}
                    onChange={(e) => setEditTool(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={editPlan}
                    onChange={(e) => setEditPlan(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={editExpiry}
                    onChange={(e) => setEditExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí tháng</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    required
                    value={editCost}
                    onChange={(e) => setEditCost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                  <select
                    value={editCurrency}
                    onChange={(e) => setEditCurrency(e.target.value)}
                    className="px-2 py-2 text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary outline-none cursor-pointer shrink-0"
                  >
                    <option value="VND">VNĐ</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {editCurrency === 'USD' && editCost && (
                  <span className="block text-xs text-slate-500 font-bold mt-1">
                    ~ {new Intl.NumberFormat('vi-VN').format(Math.round(Number(editCost) * 25400))} VNĐ
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRenewModalOpen(false);
                  setSelectedLicense(null);
                }}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Cập nhật
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
