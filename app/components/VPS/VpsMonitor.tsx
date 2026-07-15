'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Monitor, X, Copy, Check, Download, AppWindow } from 'lucide-react';
import {
  fetchVpsInstances,
  updateVpsStatus,
  type VpsInstance,
  type VpsProtocol,
  type VpsStatus,
} from '@/lib/vps-supabase';
import dynamic from 'next/dynamic';

// Import RealtimeTerminal dynamically to bypass Next.js SSR build errors
const RealtimeTerminal = dynamic(() => import('./RealtimeTerminal'), {
  ssr: false,
});

const RealtimeVnc = dynamic(() => import('./RealtimeVnc'), {
  ssr: false,
});

// ── TerminalBody ─────────────────────────────────────────────────────────────
function TerminalBody({ vps, fullSize = false }: { vps: VpsInstance; fullSize?: boolean }) {
  const h = fullSize ? 'calc(90vh - 58px)' : '300px';
  return <RealtimeTerminal vpsId={String(vps.id)} height={h} />;
}

// ── VncBody ──────────────────────────────────────────────────────────────────
function VncBody({ vps, fullSize = false }: { vps: VpsInstance; fullSize?: boolean }) {
  const h = fullSize ? 'calc(90vh - 58px)' : '300px';
  return <RealtimeVnc vpsId={String(vps.id)} height={h} />;
}

// ── RdpBody ──────────────────────────────────────────────────────────────────
function RdpBody({ vps, fullSize = false }: { vps: VpsInstance; fullSize?: boolean }) {
  const h = fullSize ? 'calc(90vh - 58px)' : '300px';
  const isOnline = vps.status === 'online';

  if (!fullSize) {
    return (
      <div className={`bg-black flex flex-col items-center justify-center gap-3 text-center p-4 min-h-52 relative w-full`}>
        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold px-2 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/40">
          Chế độ RDP
        </span>
        <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center">
          <Monitor className="w-6 h-6 text-purple-400" />
        </div>
        <p className="text-slate-200 font-bold text-xs">Remote Desktop</p>
        <p className="text-slate-500 text-[10px] font-mono">{vps.ip}:{vps.port}</p>
        {!isOnline && (
          <span className="text-[9px] px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-900/40">
            Đã ngắt kết nối
          </span>
        )}
      </div>
    );
  }

  return <RealtimeVnc vpsId={String(vps.id)} height={h} />;
}

// ── ExpandModal ───────────────────────────────────────────────────────────────
function ExpandModal({ vps, onClose }: { vps: VpsInstance; onClose: () => void }) {
  const isRdp = vps.protocol === 'RDP';

  const glowStyle = isRdp
    ? { boxShadow: '0 0 20px rgba(168, 85, 247, 0.6)' }
    : { boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)' };

  const headerBg = isRdp ? 'bg-purple-800' : 'bg-emerald-800';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gray-950 rounded-2xl overflow-hidden w-[95vw] h-[90vh] max-w-none flex flex-col animate-in zoom-in-95 duration-200"
        style={glowStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`${headerBg} flex items-center justify-between px-5 py-3 shrink-0`}>
          <div className="flex items-center gap-3">
            <Monitor className="w-5 h-5 text-white/80" />
            <div>
              <p className="text-white font-bold text-sm">
                {vps.name} ({vps.ip}) :{vps.port}
              </p>
              <p className="text-white/60 text-[11px]">
                {vps.protocol} —{' '}
                {vps.status === 'online' ? 'Trực tuyến' : 'Đã ngắt kết nối'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer font-bold shrink-0"
          >
            Đóng
          </button>
        </div>

        {/* Modal Body — flex-1 fills remaining height */}
        {isRdp ? (
          <RdpBody vps={vps} fullSize />
        ) : vps.protocol === 'VNC' ? (
          <VncBody vps={vps} fullSize />
        ) : (
          <TerminalBody vps={vps} fullSize />
        )}
      </div>
    </div>
  );
}

// ── TerminalCard ──────────────────────────────────────────────────────────────
const PROTO_BADGE: Record<VpsProtocol, string> = {
  SSH: 'bg-green-500/20 text-green-400 border-green-500/30',
  VNC: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  RDP: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function TerminalCard({ vps, onExpand }: { vps: VpsInstance; onExpand: () => void }) {
  const isOnline = vps.status === 'online';

  return (
    <div
      className="rounded-xl overflow-hidden bg-slate-900 border border-slate-700 shadow-sm flex flex-col cursor-pointer hover:shadow-md hover:border-slate-500 transition-all"
      onClick={onExpand}
      title="Click để phóng to"
    >
      {/* Header (Top Bar) */}
      <div className="flex items-center justify-between py-2 px-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Monitor className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate">
            {vps.name} ({vps.ip}) :{vps.port}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${PROTO_BADGE[vps.protocol]}`}>
            {vps.protocol}
          </span>
          <span
            className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${
              isOnline
                ? 'bg-green-950/60 text-green-400 border-green-900/40'
                : 'bg-slate-950/60 text-slate-500 border-slate-800'
            }`}
          >
            {isOnline ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
            {isOnline ? 'Trực tuyến' : 'Đã ngắt'}
          </span>
        </div>
      </div>

      {/* Body */}
      {vps.protocol === 'RDP' ? (
        <RdpBody vps={vps} />
      ) : vps.protocol === 'VNC' ? (
        <VncBody vps={vps} />
      ) : (
        <TerminalBody vps={vps} />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VpsMonitor() {
  const [vpsList, setVpsList] = useState<VpsInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [protocolFilter, setProtocolFilter] = useState<'all' | VpsProtocol>('all');
  const [expandedVps, setExpandedVps] = useState<VpsInstance | null>(null);

  // TCP Ping check fallback
  const runPingCheck = useCallback(async (currentList: VpsInstance[]) => {
    if (!currentList || currentList.length === 0) return;
    try {
      const res = await fetch('/api/vps/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hosts: currentList.map(v => ({ id: v.id, ip: v.ip, port: v.port }))
        })
      });
      const data = await res.json();
      if (data && data.results) {
        const resultsMap = new Map<number, boolean>(data.results.map((r: any) => [r.id, r.alive]));
        
        setVpsList(prev => {
          return prev.map(v => {
            const isAlive = resultsMap.get(v.id);
            if (isAlive === undefined) return v;
            const newStatus: VpsStatus = isAlive ? 'online' : 'offline';
            if (v.status !== newStatus) {
              updateVpsStatus(v.id, newStatus).catch(err => console.error("Failed to sync status to Supabase:", err));
              return { ...v, status: newStatus };
            }
            return v;
          });
        });
      }
    } catch (err) {
      console.error("Failed to check ping:", err);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVpsInstances();
      setVpsList(data);
      runPingCheck(data);
    } catch (e) {
      setError('Không thể tải danh sách VPS. Vui lòng thử lại.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [runPingCheck]);

  useEffect(() => { load(); }, [load]);

  // Realtime Status WebSocket crawl-status connection
  useEffect(() => {
    const wsUrl = 'wss://seeding.markeeai.com/api/all-platform/ws/crawl-status';
    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          const updates = Array.isArray(data) ? data : [data];

          setVpsList((prev) => {
            let changed = false;
            const nextList = prev.map((v) => {
              const matched = updates.find((u: any) => u.id === v.id || u.vps_id === v.id);
              if (matched) {
                const newStatus: VpsStatus = (matched.status === 'online' || matched.alive === true) ? 'online' : 'offline';
                if (v.status !== newStatus) {
                  changed = true;
                  // Sync to Supabase
                  updateVpsStatus(v.id, newStatus).catch((err) =>
                    console.error('Failed to sync status to Supabase:', err)
                  );
                  return { ...v, status: newStatus };
                }
              }
              return v;
            });
            return changed ? nextList : prev;
          });
        } catch (err) {
          console.error('Failed to parse crawl-status WS message:', err);
        }
      };

      ws.onerror = (err) => {
        if (!isMounted) return;
        console.error('Crawl status WS error:', err);
      };

      ws.onclose = () => {
        if (!isMounted) return;
        console.log('Crawl status WS closed. Reconnecting in 5s...');
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const activeWs = ws;
      if (activeWs) {
        if (activeWs.readyState === WebSocket.CONNECTING) {
          activeWs.onopen = () => {
            try {
              activeWs.close();
            } catch (e) {}
          };
        } else if (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CLOSING) {
          try {
            activeWs.close();
          } catch (e) {}
        }
      }
    };
  }, []);

  // Heartbeat fallback ping every 30s
  useEffect(() => {
    if (vpsList.length === 0) return;
    const timer = setInterval(() => {
      runPingCheck(vpsList);
    }, 30000);
    return () => clearInterval(timer);
  }, [vpsList, runPingCheck]);

  const filtered = vpsList.filter(
    (v) => protocolFilter === 'all' || v.protocol === protocolFilter
  );
  const onlineCount = vpsList.filter((v) => v.status === 'online').length;

  return (
    <div className="p-6 space-y-5 min-h-full bg-slate-50">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-green-50 border border-green-100">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Giám Sát Đa VPS (VNC/SSH/RDP)</h1>
            <p className="text-xs text-slate-500">
              Theo dõi thời gian thực —{' '}
              <span className="text-green-600 font-semibold">{onlineCount}</span>/{vpsList.length} máy chủ trực tuyến
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'VNC', 'SSH', 'RDP'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setProtocolFilter(p)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                protocolFilter === p
                  ? p === 'VNC' ? 'bg-blue-600 text-white border-blue-600'
                  : p === 'SSH' ? 'bg-green-600 text-white border-green-600'
                  : p === 'RDP' ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {p === 'all' ? 'Tất cả' : p}
            </button>
          ))}
        </div>
      </div>

      {/* Status strip */}
      {!loading && !error && (
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>{onlineCount} Trực tuyến</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-300" />
            <span>{vpsList.length - onlineCount} Đã ngắt</span>
          </div>
          <span className="text-slate-400">
            Hiển thị: {filtered.length} máy chủ — Click vào card để phóng to
          </span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-green-500 rounded-full animate-spin" />
          <span className="text-sm">Đang tải dữ liệu VPS...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-red-500 text-sm font-semibold">{error}</p>
          <button
            onClick={load}
            className="px-4 py-2 text-xs font-semibold bg-red-500 hover:bg-red-600 text-white rounded-lg cursor-pointer transition-colors"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Terminal Grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((vps) => (
            <TerminalCard key={vps.id} vps={vps} onExpand={() => setExpandedVps(vps)} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
              <Activity className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-semibold">Không có VPS nào theo bộ lọc này</p>
            </div>
          )}
        </div>
      )}

      {/* Expand Modal */}
      {expandedVps && (
        <ExpandModal vps={expandedVps} onClose={() => setExpandedVps(null)} />
      )}
    </div>
  );
}
