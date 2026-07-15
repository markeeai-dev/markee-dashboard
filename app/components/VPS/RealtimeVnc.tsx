'use client';

import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import RFB from '@novnc/novnc';

interface RealtimeVncProps {
  vpsId: string;
  height?: string; // Ví dụ: '300px', '400px'
}

export default function RealtimeVnc({ vpsId, height = '300px' }: RealtimeVncProps) {
  const vncContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!vncContainerRef.current) return;

    let isMounted = true;
    let rfbInstance: any = null;

    // Delay khởi tạo để đảm bảo DOM đã paint xong kích thước
    const initTimeout = setTimeout(() => {
      if (!isMounted || !vncContainerRef.current) return;

      const wsUrl = `wss://seeding.markeeai.com/api/all-platform/vnc-vps/vnc/${vpsId}`;

      try {
        setStatus('connecting');
        setErrorMsg(null);

        // Khởi tạo RFB từ noVNC
        rfbInstance = new RFB(vncContainerRef.current, wsUrl, {
          scaleViewport: true,
          resizeSession: true,
          wsProtocols: ['binary'],
        });

        // Lắng nghe các sự kiện của VNC connection
        rfbInstance.addEventListener('connect', () => {
          if (isMounted) {
            console.log('VNC connected successfully');
            setStatus('connected');
          }
        });

        rfbInstance.addEventListener('disconnect', (e: any) => {
          if (isMounted) {
            console.log('VNC disconnected:', e);
            setStatus('disconnected');
            if (e.detail && e.detail.clean === false) {
              setErrorMsg('Kết nối VNC bị ngắt đột ngột.');
            }
          }
        });

        // Thiết lập cấu hình bổ sung cho RFB nếu cần thiết
        rfbInstance.viewOnly = false; // Cho phép tương tác (chuột, bàn phím)
      } catch (err) {
        console.error('Failed to initialize VNC:', err);
        if (isMounted) {
          setStatus('disconnected');
          setErrorMsg('Không thể kết nối VNC tới máy chủ.');
        }
      }
    }, 100);

    // Cleanup khi component bị unmount
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      if (rfbInstance) {
        try {
          rfbInstance.disconnect();
        } catch (e) {
          console.warn('Error disconnecting RFB:', e);
        }
      }
    };
  }, [vpsId]);

  return (
    <div className="relative bg-black w-full overflow-hidden" style={{ boxSizing: 'border-box' }}>
      {/* Màn hình hiển thị chính của VNC */}
      <div
        ref={vncContainerRef}
        style={{
          width: '100%',
          height,
          backgroundColor: '#000000',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      />

      {/* Trạng thái kết nối overlay */}
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-xs text-yellow-400 font-mono gap-2">
          <div className="w-3.5 h-3.5 border-2 border-yellow-400/20 border-t-yellow-400 rounded-full animate-spin" />
          <span>[Hệ thống] Đang kết nối VNC...</span>
        </div>
      )}

      {status === 'disconnected' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-xs text-red-500 font-mono p-4 text-center gap-2">
          <span>[Hệ thống] Mất kết nối VNC tới máy chủ</span>
          {errorMsg && <span className="text-[10px] text-slate-400 font-sans">{errorMsg}</span>}
        </div>
      )}
    </div>
  );
}
