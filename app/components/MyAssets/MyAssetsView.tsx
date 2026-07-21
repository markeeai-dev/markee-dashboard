'use client';

import React, { useState, useEffect } from 'react';
import { Settings } from 'lucide-react';
import {
  fetchUserAILicenses,
  fetchUserAIUsageStats,
  renewAILicense,
  cancelAILicense,
  createAILicense,
  updateAILicense,
  deleteAILicense,
  type AILicense,
  type AIUsageStat,
  type UserProfile,
} from '@/lib/dashboard-supabase';
import { supabase } from '@/lib/supabase';

export default function MyAssetsView({ profile }: { profile: UserProfile }) {
  const [licenses, setLicenses] = useState<AILicense[]>([]);
  const [usageStats, setUsageStats] = useState<AIUsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // States for self renewal modal
  const [selectedLicense, setSelectedLicense] = useState<AILicense | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);

  // States for declare personal license modal
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [declareTool, setDeclareTool] = useState('ChatGPT');
  const [declarePlan, setDeclarePlan] = useState('Pro');
  const [declareExpiry, setDeclareExpiry] = useState('');
  const [declareCost, setDeclareCost] = useState('0');
  const [declareCurrency, setDeclareCurrency] = useState('VND');
  const [declareTag, setDeclareTag] = useState<'Company' | 'Personal'>('Personal');

  // Refresh trigger state to force reload
  const [refreshKey, setRefreshKey] = useState(0);

  // States for edit/delete personal license
  const [activeMenuLicenseId, setActiveMenuLicenseId] = useState<number | null>(null);
  const [isEditLicenseModalOpen, setIsEditLicenseModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<AILicense | null>(null);
  const [editLicenseTool, setEditLicenseTool] = useState('');
  const [editLicensePlan, setEditLicensePlan] = useState('');
  const [editLicenseExpiry, setEditLicenseExpiry] = useState('');
  const [editLicenseCost, setEditLicenseCost] = useState('0');
  const [editLicenseCurrency, setEditLicenseCurrency] = useState('VND');
  const [deletingLicense, setDeletingLicense] = useState<AILicense | null>(null);

  function showToast(message: string, type: 'success' | 'error', duration = 3000) {
    setToast({ message, type });
    setTimeout(() => {
      setToast(current => current?.message === message ? null : current);
    }, duration);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [lics, stats] = await Promise.all([
        fetchUserAILicenses(profile.email),
        fetchUserAIUsageStats(profile.email),
      ]);
      setLicenses(lics);
      setUsageStats(stats);
    } catch (e) {
      console.error(e);
      showToast('Không thể tải tài sản AI', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profile.email, refreshKey]);

  useEffect(() => {
    // Window focus listener to refetch
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener('focus', handleFocus);

    // Supabase subscription for real-time updates
    const channel = supabase
      .channel(`user-usage-${profile.email}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_usage_stats',
          filter: `email=eq.${profile.email}`
        },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_licenses',
          filter: `email=eq.${profile.email}`
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('focus', handleFocus);
      supabase.removeChannel(channel);
    };
  }, [profile.email, refreshKey]);

  const getLatestUsageStat = (email: string, aiTool: string) => {
    const matchingStats = usageStats.filter(
      stat => stat.email === email && stat.ai_tool === aiTool
    );
    if (matchingStats.length === 0) return null;
    return matchingStats[0]; // Already sorted by created_at DESC in database query
  };

  const handleRequestExtension = (lic: AILicense) => {
    showToast(`Đã gửi yêu cầu gia hạn gói ${lic.ai_tool} tới Admin!`, 'success');
    localStorage.setItem(`license_requested_${lic.id}`, 'true');
    setRefreshKey(prev => prev + 1);
  };

  const handleSelfRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense || !renewDate) return;

    try {
      await renewAILicense(selectedLicense.id, renewDate);
      localStorage.removeItem(`license_status_${selectedLicense.id}`);
      localStorage.removeItem(`license_canceled_date_${selectedLicense.id}`);
      localStorage.removeItem(`license_requested_${selectedLicense.id}`);

      showToast(`Đã tự gia hạn thành công gói ${selectedLicense.ai_tool}!`, 'success');
      setIsRenewModalOpen(false);
      setSelectedLicense(null);
      setRenewDate('');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi gia hạn bản quyền AI', 'error');
    }
  };

  const handleSkipLicense = async (lic: AILicense) => {
    try {
      await cancelAILicense(lic.id);
      showToast(`Đã hủy kích hoạt gói ${lic.ai_tool}.`, 'success');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi hủy bản quyền AI', 'error');
    }
  };

  const handleDeclareLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declareExpiry) {
      showToast('Vui lòng chọn ngày hết hạn', 'error');
      return;
    }
    try {
      const finalCost = declareCurrency === 'USD' ? Math.round((Number(declareCost) || 0) * 25400) : Math.round(Number(declareCost) || 0);
      const finalPlanName = declareTag === 'Personal' ? `${declarePlan} (Cá nhân)` : declarePlan;
      await createAILicense({
        email: profile.email,
        ai_tool: declareTool,
        plan_name: finalPlanName,
        monthly_cost: finalCost,
        expiration_date: declareExpiry,
        status: 'Active'
      });
      showToast('Đã khai báo tài khoản AI thành công!', 'success');
      setIsDeclareModalOpen(false);
      setDeclareExpiry('');
      setDeclareCost('0');
      setDeclareCurrency('VND');
      setDeclareTag('Personal');
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi khai báo tài khoản cá nhân', 'error');
    }
  };

  const handleEditLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicense || !editLicenseExpiry) {
      showToast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }

    try {
      const finalCost = editLicenseCurrency === 'USD' ? Math.round((Number(editLicenseCost) || 0) * 25400) : Math.round(Number(editLicenseCost) || 0);
      await updateAILicense(editingLicense.id, {
        ai_tool: editLicenseTool,
        plan_name: `${editLicensePlan} (Cá nhân)`,
        monthly_cost: finalCost,
        expiration_date: editLicenseExpiry,
      });
      showToast('Đại diện tài khoản cá nhân đã được cập nhật thành công!', 'success');
      setIsEditLicenseModalOpen(false);
      setEditingLicense(null);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi cập nhật tài khoản cá nhân', 'error');
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
          {toast.type === 'success' ? <span className="mr-1">✓</span> : <span className="mr-1">⚠️</span>}
          {toast.message}
        </div>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Tài sản AI của tôi</h1>
          <p className="text-xs text-markee-muted">Các gói tài khoản AI được cấp quyền sử dụng hoặc tự khai báo.</p>
        </div>
        <button
          onClick={() => setIsDeclareModalOpen(true)}
          className="px-3.5 py-1.5 bg-markee-primary hover:bg-markee-hover text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
        >
          <span>➕</span>
          <span>Khai báo tài khoản AI</span>
        </button>
      </section>

      {loading ? (
        <div className="text-center py-10 text-sm text-markee-sub">Đang tải tài sản AI của bạn...</div>
      ) : licenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-markee-border p-8 text-center text-markee-sub text-sm">
          Bạn chưa được cấp tài khoản AI nào. Vui lòng liên hệ Admin để được cấp bản quyền.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {licenses.map((lic) => {
            const isCanceled = lic.status === 'Canceled';
            const isRequested = localStorage.getItem(`license_requested_${lic.id}`) === 'true';

            // Calculate expiration days
            const expDate = new Date(lic.expiration_date);
            expDate.setHours(23, 59, 59, 999);
            const today = new Date();
            
            const isExpired = expDate < today;
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const isExpiringSoon = !isExpired && diffDays >= 0 && diffDays <= 3;
            const showWarning = (isExpired || isExpiringSoon) && !isCanceled;

            const match = getLatestUsageStat(lic.email, lic.ai_tool);
            const usageStr = match ? (match.weekly_used || '0%') : 'Chưa quét';
            const usageNum = usageStr && usageStr !== 'Chưa quét' ? (parseInt(usageStr.replace('%', '')) || 0) : 0;
            const resetTime = match ? match.reset_time : '';

            const isPersonal = lic.plan_name.includes('(Cá nhân)');
            const displayPlanName = lic.plan_name.replace(' (Cá nhân)', '');

            let borderClass = 'border-gray-200';
            if (showWarning) {
              borderClass = isExpired ? 'border-red-500 ring-1 ring-red-100' : 'border-amber-400 ring-1 ring-amber-100';
            }

            const canManageLicense = profile.role === 'admin' || profile.role === 'super_admin' || profile.email === lic.email;

            return (
              <div
                key={lic.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all flex flex-col justify-between min-h-64 relative ${borderClass}`}
                style={{ opacity: isCanceled ? 0.5 : 1 }}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-1 rounded-lg bg-gray-100 text-markee-text font-bold text-xs">
                      {lic.ai_tool}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-markee-muted uppercase tracking-wider">
                        {displayPlanName}
                      </span>
                      {isPersonal ? (
                        <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Cá nhân
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-sm text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          Công ty
                        </span>
                      )}

                      {canManageLicense && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuLicenseId(activeMenuLicenseId === lic.id ? null : lic.id);
                            }}
                            className="p-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center text-gray-500 hover:text-markee-primary cursor-pointer bg-white shrink-0 ml-1"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </button>

                          {activeMenuLicenseId === lic.id && (
                            <div className="absolute right-0 mt-1 w-24 bg-white border border-markee-border rounded-lg shadow-lg z-50 py-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLicense(lic);
                                  setEditLicenseTool(lic.ai_tool);
                                  setEditLicensePlan(displayPlanName);
                                  setEditLicenseExpiry(lic.expiration_date.split('T')[0]);
                                  setEditLicenseCost(String(lic.monthly_cost));
                                  setEditLicenseCurrency('VND');
                                  setIsEditLicenseModalOpen(true);
                                  setActiveMenuLicenseId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                              >
                                Sửa
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLicense(lic);
                                  setActiveMenuLicenseId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-medium cursor-pointer"
                              >
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {showWarning && (
                    <div className={`mt-3 p-2 rounded-lg border text-xs font-semibold ${isExpired ? 'bg-red-50 text-red-800 border-red-100' : 'bg-amber-50 text-amber-800 border-amber-100'
                      }`}>
                      {isExpired ? '⚠️ Tài khoản đã hết hạn!' : `⏳ Sắp hết hạn (còn ${diffDays} ngày)`}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between text-xs text-markee-muted">
                    <span>Hết hạn:</span>
                    <span className={`font-semibold ${isExpired && !isCanceled ? 'text-red-600 font-bold' : 'text-markee-text'}`}>
                      {new Date(lic.expiration_date).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <div className="mt-5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-markee-muted">Hạn mức tuần:</span>
                      <span className="font-bold text-markee-text">{usageStr}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-markee-primary h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(usageNum, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 italic mt-1">
                      Hạn mức hằng tuần sẽ đặt lại vào: {resetTime || 'Đang cập nhật...'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-2">
                  {showWarning ? (
                    <>
                      {!isPersonal ? (
                        <button
                          type="button"
                          onClick={() => handleRequestExtension(lic)}
                          disabled={isRequested}
                          className="w-full px-3 py-2 bg-markee-primary hover:bg-markee-hover disabled:bg-gray-150 disabled:text-gray-400 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors text-center"
                        >
                          {isRequested ? 'Đã gửi yêu cầu gia hạn' : 'Yêu cầu Admin gia hạn'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLicense(lic);
                            setRenewDate('');
                            setIsRenewModalOpen(true);
                          }}
                          className="w-full px-3 py-2 border border-markee-primary text-markee-primary hover:bg-red-50 rounded-lg text-xs font-bold cursor-pointer transition-all text-center"
                        >
                          Tôi đã tự gia hạn
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSkipLicense(lic)}
                        className="w-full text-center text-xs text-markee-muted hover:text-markee-text font-semibold underline cursor-pointer mt-1 border-0 bg-transparent"
                      >
                        Không dùng nữa (Bỏ qua)
                      </button>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        {isCanceled ? 'Đã hủy' : 'Hoạt động'}
                      </span>
                      {isCanceled ? (
                        isPersonal ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLicense(lic);
                              setRenewDate('');
                              setIsRenewModalOpen(true);
                            }}
                            className="px-2 py-1 bg-markee-primary hover:bg-markee-hover text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors border-0"
                          >
                            Tái kích hoạt
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestExtension(lic)}
                            disabled={isRequested}
                            className="px-2 py-1 bg-markee-primary hover:bg-markee-hover disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-md text-[10px] font-bold cursor-pointer transition-colors border-0"
                          >
                            {isRequested ? 'Đã yêu cầu' : 'Yêu cầu Admin gia hạn'}
                          </button>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Self-Renew Modal */}
      {isRenewModalOpen && selectedLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleSelfRenew} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Tôi tự gia hạn gói cước</h2>
              <p className="text-xs text-markee-muted mt-1">
                Chọn ngày hết hạn mới để kích hoạt lại thẻ gói <span className="font-semibold text-markee-text">{selectedLicense.ai_tool}</span>.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-markee-text mb-1.5">Ngày hết hạn mới</label>
              <input
                type="date"
                required
                value={renewDate}
                onChange={(e) => setRenewDate(e.target.value)}
                className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
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
                Lưu ngày mới
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Declare Personal License Modal */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleDeclareLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Khai báo tài khoản AI</h2>
              <p className="text-xs text-markee-muted mt-1">
                Khai báo tài khoản AI tự mua để quản lý và theo dõi.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Nhãn tài khoản</label>
                  <select
                    value={declareTag}
                    onChange={(e) => setDeclareTag(e.target.value as any)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Personal">Cá nhân</option>
                    <option value="Company">Công ty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={declareTool}
                    onChange={(e) => setDeclareTool(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
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
                    value={declarePlan}
                    onChange={(e) => setDeclarePlan(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
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
                    value={declareExpiry}
                    onChange={(e) => setDeclareExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    required
                    value={declareCost}
                    onChange={(e) => setDeclareCost(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                  <select
                    value={declareCurrency}
                    onChange={(e) => setDeclareCurrency(e.target.value)}
                    className="px-2 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary outline-none cursor-pointer shrink-0"
                  >
                    <option value="VND">VNĐ</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                {declareCurrency === 'USD' && declareCost && (
                  <span className="block text-xs text-slate-500 font-bold mt-1">
                    ~ {new Intl.NumberFormat('vi-VN').format(Math.round(Number(declareCost) * 25400))} VNĐ
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDeclareModalOpen(false)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-markee-primary hover:bg-markee-hover text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Khai báo
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Edit Personal License Modal */}
      {isEditLicenseModalOpen && editingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <form onSubmit={handleEditLicense} className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div>
              <h2 className="text-lg font-bold text-markee-text">Chỉnh sửa tài khoản cá nhân</h2>
              <p className="text-xs text-markee-muted mt-1">
                Cập nhật thông tin tài khoản cá nhân của bạn.
              </p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Công cụ AI</label>
                  <select
                    value={editLicenseTool}
                    onChange={(e) => setEditLicenseTool(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="ChatGPT">ChatGPT</option>
                    <option value="Claude">Claude</option>
                    <option value="Gemini">Gemini</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Loại gói</label>
                  <select
                    value={editLicensePlan}
                    onChange={(e) => setEditLicensePlan(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary focus:border-markee-primary outline-none cursor-pointer"
                  >
                    <option value="Free">Free</option>
                    <option value="Plus">Plus</option>
                    <option value="Pro">Pro</option>
                    <option value="Ultra">Ultra</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Chi phí</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      required
                      value={editLicenseCost}
                      onChange={(e) => setEditLicenseCost(e.target.value)}
                      className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                    />
                    <select
                      value={editLicenseCurrency}
                      onChange={(e) => setEditLicenseCurrency(e.target.value)}
                      className="px-2 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary outline-none cursor-pointer shrink-0"
                    >
                      <option value="VND">VNĐ</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  {editLicenseCurrency === 'USD' && editLicenseCost && (
                    <span className="block text-[10px] text-slate-500 font-bold mt-1">
                      ~ {new Intl.NumberFormat('vi-VN').format(Math.round(Number(editLicenseCost) * 25400))} VNĐ
                    </span>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-markee-text mb-1">Ngày hết hạn</label>
                  <input
                    type="date"
                    required
                    value={editLicenseExpiry}
                    onChange={(e) => setEditLicenseExpiry(e.target.value)}
                    className="w-full px-3 py-2 text-base md:text-xs border border-markee-border rounded-lg bg-white text-markee-text focus:outline-none focus:ring-1 focus:ring-markee-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditLicenseModalOpen(false);
                  setEditingLicense(null);
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

      {/* Delete Confirmation Modal */}
      {deletingLicense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-markee-border rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-markee-text">Xác nhận xóa tài khoản</h2>
              <p className="text-xs text-markee-muted mt-1.5">
                Bạn có chắc chắn muốn xóa tài khoản cá nhân <span className="font-semibold text-markee-text">{deletingLicense.ai_tool}</span> không? Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingLicense(null)}
                className="px-4 py-2 border border-markee-border bg-white text-markee-muted hover:bg-markee-bg hover:text-markee-text rounded-lg transition-colors text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await deleteAILicense(deletingLicense.id);
                    showToast('Đã xóa tài khoản thành công!', 'success');
                    setDeletingLicense(null);
                    setRefreshKey(prev => prev + 1);
                  } catch (err) {
                    console.error(err);
                    showToast('Lỗi khi xóa tài khoản', 'error');
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-xs font-semibold cursor-pointer font-sans"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
