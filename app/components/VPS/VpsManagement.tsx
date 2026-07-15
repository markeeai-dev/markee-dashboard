'use client';

import { useState, useEffect, useCallback } from 'react';
import { Server, Edit, Trash2, Plus, Search, Eye, X, RefreshCw } from 'lucide-react';
import {
  fetchVpsInstances,
  createVpsInstance,
  deleteVpsInstance,
  updateVpsInstance,
  inferProtocol,
  parseProxy,
  type VpsInstance,
  fetchVpsCookies,
  createVpsCookie,
  deleteVpsCookie,
  type VpsCookie,
} from '@/lib/vps-supabase';

// Helper shorten UUID/ID
function shortenId(id: string | number) {
  const idStr = String(id);
  if (idStr.length <= 8) return `#${idStr}`;
  return `#${idStr.slice(0, 6)}...`;
}

// ─── Modal: Thêm VPS Mới ──────────────────────────────────────────────────────
function AddVpsModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [proxy, setProxy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !proxy.trim()) {
      setErr('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    const { ip, port } = parseProxy(proxy.trim());
    const protocol = inferProtocol(port);

    setSubmitting(true);
    try {
      await createVpsInstance({
        name: name.trim(),
        ip,
        port,
        http_proxy: proxy.trim(),
        protocol,
        status: 'pending', // DB check constraint chỉ cho phép online, offline, pending, error
        active_sessions: 0,
        total_cookies: 0,
        error_cookies: 0,
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr('Lỗi khi tạo VPS. Vui lòng thử lại.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-slate-800">Thêm VPS mới</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên VPS <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: VPS USA 01"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-red-450 focus:ring-2 focus:ring-red-100 bg-slate-50 text-slate-800 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                HTTP Proxy <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={proxy}
                onChange={(e) => setProxy(e.target.value)}
                placeholder="Ví dụ: http://10.30.195.41:8888"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-red-450 focus:ring-2 focus:ring-red-100 bg-slate-50 text-slate-800 font-mono transition-all placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Port sẽ tự động xác định Protocol: 22→SSH, 5900/5901→VNC, 3389→RDP
              </p>
            </div>

            {err && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {err}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {submitting ? 'Đang tạo...' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Chỉnh Sửa VPS ─────────────────────────────────────────────────────
function EditVpsModal({
  vps,
  onClose,
  onUpdated,
}: {
  vps: VpsInstance;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(vps.name);
  const [proxy, setProxy] = useState(vps.http_proxy || `${vps.ip}:${vps.port}`);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !proxy.trim()) {
      setErr('Vui lòng điền đầy đủ thông tin.');
      return;
    }

    const { ip, port } = parseProxy(proxy.trim());
    const protocol = inferProtocol(port);

    setSubmitting(true);
    try {
      await updateVpsInstance(vps.id, {
        name: name.trim(),
        ip,
        port,
        http_proxy: proxy.trim(),
        protocol,
      });
      onUpdated();
      onClose();
    } catch (e) {
      setErr('Lỗi khi cập nhật VPS. Vui lòng thử lại.');
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-red-500" />
            <h2 className="text-sm font-bold text-slate-800">Chỉnh sửa VPS #{shortenId(vps.id)}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên VPS <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: VPS USA 01"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-red-450 focus:ring-2 focus:ring-red-100 bg-slate-50 text-slate-800 transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                HTTP Proxy <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={proxy}
                onChange={(e) => setProxy(e.target.value)}
                placeholder="Ví dụ: http://10.30.195.41:8888"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-red-450 focus:ring-2 focus:ring-red-100 bg-slate-50 text-slate-800 font-mono transition-all placeholder:text-slate-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Port sẽ tự động xác định Protocol: 22→SSH, 5900/5901→VNC, 3389→RDP
              </p>
            </div>

            {err && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {err}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: Quản lý Cookies ───────────────────────────────────────────────────
function ManageCookiesModal({ vps, onClose }: { vps: VpsInstance; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [json, setJson] = useState('');
  const [cookies, setCookies] = useState<VpsCookie[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await fetchVpsCookies(vps.id);
      setCookies(data);
    } catch (e) {
      setErr('Không thể tải danh sách cookies.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [vps.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAddCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setErr('');
    try {
      await createVpsCookie({
        vps_id: vps.id,
        email: email.trim(),
        cookie_json: json.trim(),
        status: 'active',
      });
      setEmail('');
      setJson('');
      load();
    } catch (e) {
      setErr('Lỗi khi thêm cookie. Vui lòng thử lại.');
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cookie này?')) return;
    setErr('');
    try {
      await deleteVpsCookie(id);
      load();
    } catch (e) {
      setErr('Lỗi khi xóa cookie.');
      console.error(e);
    }
  };

  const STATUS_LABEL: Record<VpsCookie['status'], { label: string; cls: string; dot: string }> = {
    active: { label: 'Đang sử dụng', cls: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500 animate-pulse' },
    inactive: { label: 'Chờ', cls: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
    error: { label: 'Lỗi', cls: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-500' },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              Quản lý Cookies — VPS #{shortenId(vps.id)}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5" title={String(vps.id)}>
              {vps.name} · {vps.http_proxy}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6 overflow-y-auto flex-1">
          {/* Add Cookie form */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-700 mb-3">Thêm Cookie mới</p>
            <form onSubmit={handleAddCookie}>
              <div className="flex flex-wrap gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email (Bắt buộc)"
                  className="flex-1 min-w-36 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-white text-slate-800 transition-all placeholder:text-slate-400"
                />
                <input
                  type="text"
                  value={json}
                  onChange={(e) => setJson(e.target.value)}
                  placeholder="Dán mã JSON cookie vào đây (Tùy chọn)..."
                  className="flex-[2] min-w-48 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-white text-slate-800 font-mono transition-all placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer shadow-sm shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </div>
            </form>
          </div>

          {err && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 shrink-0">
              {err}
            </p>
          )}

          {/* Cookie Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                <div className="w-4 h-4 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
                <span className="text-xs">Đang tải cookies...</span>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="text-center px-4 py-2.5 w-12">STT</th>
                    <th className="text-left px-4 py-2.5">Email</th>
                    <th className="text-center px-4 py-2.5">Trạng thái</th>
                    <th className="text-center px-4 py-2.5 w-16">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cookies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-400">
                        Chưa có cookie nào.
                      </td>
                    </tr>
                  ) : (
                    cookies.map((c, idx) => {
                      const { label, cls, dot } = STATUS_LABEL[c.status] || STATUS_LABEL.inactive;
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-4 py-3 text-slate-700 font-medium">{c.email}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                              {label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                              title="Xóa cookie"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 rounded-b-2xl shrink-0 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">{cookies.length} cookie(s) đang quản lý</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Xác nhận xóa VPS ─────────────────────────────────────────────────
interface DeleteConfirmModalProps {
  vps: VpsInstance;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteConfirmModal({ vps, onClose, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-800">Xác nhận xóa VPS</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-655 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-xs text-slate-600 leading-relaxed">
            Bạn có chắc chắn muốn xóa VPS có IP <strong className="text-slate-800 font-mono">{vps.ip}</strong> không? Thao tác này sẽ xóa toàn bộ dữ liệu cấu hình và không thể hoàn tác.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            Xóa vĩnh viễn
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function VpsManagement() {
  const [vpsData, setVpsData] = useState<VpsInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [cookiesVps, setCookiesVps] = useState<VpsInstance | null>(null);
  const [deletingVps, setDeletingVps] = useState<VpsInstance | null>(null);
  const [editingVps, setEditingVps] = useState<VpsInstance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVpsInstances();
      setVpsData(data);
    } catch (e) {
      setError('Không thể tải danh sách VPS.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleConfirmDelete = async () => {
    if (!deletingVps) return;
    try {
      await deleteVpsInstance(deletingVps.id);
      setVpsData((prev) => prev.filter((v) => v.id !== deletingVps.id));
      setDeletingVps(null);
    } catch (e) {
      alert('Lỗi khi xóa VPS. Vui lòng thử lại.');
      console.error(e);
    }
  };

  const totalVps = vpsData.length;
  const activeVps = vpsData.filter((v) => v.status === 'online').length;
  const inactiveVps = vpsData.filter((v) => v.status === 'offline').length;
  const totalCookies = vpsData.reduce((s, v) => s + (v.total_cookies ?? 0), 0);
  const errorCookies = vpsData.reduce((s, v) => s + (v.error_cookies ?? 0), 0);

  const filtered = vpsData.filter((v) => {
    const matchSearch =
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.http_proxy?.toLowerCase().includes(search.toLowerCase()) ||
      v.ip.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && v.status === 'online') ||
      (statusFilter === 'inactive' && v.status === 'offline');
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6 min-h-full bg-slate-50">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
            <Server className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Quản lý VPS</h1>
            <p className="text-xs text-slate-500">Quản lý toàn bộ máy chủ VPS và phiên hoạt động</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          title="Làm mới"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng số VPS</p>
          <p className="text-3xl font-bold text-slate-800">{totalVps}</p>
          <p className="text-[11px] text-slate-400 mt-1">Đang lưu trữ</p>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-xs">
          <p className="text-[11px] font-bold text-green-500 uppercase tracking-wider mb-1">Đang hoạt động</p>
          <p className="text-3xl font-bold text-green-600">{activeVps}</p>
          <p className="text-[11px] text-slate-400 mt-1">VPS online</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-xs">
          <p className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-1">Chưa hoạt động</p>
          <p className="text-3xl font-bold text-amber-600">{inactiveVps}</p>
          <p className="text-[11px] text-slate-400 mt-1">VPS offline</p>
        </div>
        <div className="bg-white rounded-2xl border border-red-100 p-5 shadow-xs">
          <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider mb-1">Cookies / Lỗi</p>
          <p className="text-3xl font-bold text-red-600">
            {totalCookies}
            <span className="text-base font-semibold text-red-400 ml-1">/ {errorCookies}</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Tổng / Cookie lỗi</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm VPS, IP proxy..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-red-450 bg-slate-50 text-slate-700"
            />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'active', 'inactive'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  statusFilter === s
                    ? 'bg-red-500 text-white border-red-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {s === 'all' ? 'Tất cả' : s === 'active' ? 'Hoạt động' : 'Ngưng'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors cursor-pointer shadow-sm ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm VPS Mới</span>
          </button>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-red-500 rounded-full animate-spin" />
              <span className="text-sm">Đang tải dữ liệu...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <p className="text-red-500 text-sm">{error}</p>
              <button onClick={load} className="text-xs text-red-500 underline cursor-pointer">Thử lại</button>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider">
                  <th className="text-left px-5 py-3 w-14">ID</th>
                  <th className="text-left px-5 py-3">Tên VPS</th>
                  <th className="text-left px-5 py-3">HTTP Proxy</th>
                  <th className="text-center px-5 py-3">Protocol</th>
                  <th className="text-center px-5 py-3">Active Session</th>
                  <th className="text-center px-5 py-3">Cookies</th>
                  <th className="text-center px-5 py-3">Trạng thái</th>
                  <th className="text-center px-5 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-400">
                      {vpsData.length === 0
                        ? 'Chưa có VPS nào. Hãy thêm VPS đầu tiên.'
                        : 'Không tìm thấy VPS nào phù hợp.'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((vps) => (
                    <tr key={vps.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-slate-400 font-mono" title={String(vps.id)}>{shortenId(vps.id)}</td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            <Server className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{vps.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{vps.ip}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-600">{vps.http_proxy || `${vps.ip}:${vps.port}`}</td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          vps.protocol === 'SSH' ? 'bg-green-50 text-green-700 border-green-200' :
                          vps.protocol === 'VNC' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-purple-50 text-purple-700 border-purple-200'
                        }`}>
                          {vps.protocol}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span className={`font-bold ${(vps.active_sessions ?? 0) > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                          {vps.active_sessions ?? 0}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-bold text-slate-700">{vps.total_cookies ?? 0}</span>
                          <button
                            onClick={() => setCookiesVps(vps)}
                            className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-0.5 cursor-pointer"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            Xem chi tiết
                          </button>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            vps.status === 'online'
                              ? 'bg-green-50 text-green-700 border border-green-200'
                              : vps.status === 'pending'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : vps.status === 'error'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              vps.status === 'online'
                                ? 'bg-green-500 animate-pulse'
                                : vps.status === 'pending'
                                ? 'bg-amber-500 animate-pulse'
                                : vps.status === 'error'
                                ? 'bg-red-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {vps.status === 'online'
                            ? 'Hoạt động'
                            : vps.status === 'pending'
                            ? 'Đang chờ'
                            : vps.status === 'error'
                            ? 'Lỗi'
                            : 'Ngưng'}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setEditingVps(vps)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingVps(vps)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            title="Xóa VPS"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {!loading && !error && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[11px] text-slate-400">
              Hiển thị <span className="font-semibold text-slate-600">{filtered.length}</span> / {totalVps} VPS
            </p>
            <p className="text-[11px] text-slate-400">Dữ liệu từ Supabase</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddVpsModal onClose={() => setShowAddModal(false)} onCreated={load} />
      )}
      {editingVps && (
        <EditVpsModal
          vps={editingVps}
          onClose={() => setEditingVps(null)}
          onUpdated={load}
        />
      )}
      {cookiesVps && (
        <ManageCookiesModal vps={cookiesVps} onClose={() => setCookiesVps(null)} />
      )}
      {deletingVps && (
        <DeleteConfirmModal
          vps={deletingVps}
          onClose={() => setDeletingVps(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
