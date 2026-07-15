'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface RealtimeTerminalProps {
  vpsId: string;
  height?: string;
}

export default function RealtimeTerminal({ vpsId, height = '300px' }: RealtimeTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    let isMounted = true;

    // 1. Khởi tạo Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 11,
      fontFamily: 'Courier New, Courier, monospace',
      scrollback: 1000,
      theme: {
        background: '#000000',
        foreground: '#a8ff60',
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Delay khởi tạo để đảm bảo DOM được mount và paint xong kích thước
    const initTimeout = setTimeout(() => {
      if (!isMounted || !terminalRef.current) return;
      try {
        term.open(terminalRef.current);
        term.write('\x1b[33m[Hệ thống] Đang khởi tạo kết nối SSH...\x1b[0m\r\n');
        
        // Thực hiện fit lần đầu nếu container đã có kích thước
        const rect = terminalRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fitAddon.fit();
        }

        // Gọi lại fitAddon.fit() sau 300ms để hiệu chỉnh kích thước chính xác
        setTimeout(() => {
          if (isMounted && terminalRef.current) {
            try {
              fitAddon.fit();
            } catch (e) {}
          }
        }, 300);
      } catch (e) {
        console.warn('Failed to open terminal safely:', e);
      }
    }, 50);

    // 2. Khởi tạo WebSocket kết nối trực tiếp
    const wsUrl = `wss://seeding.markeeai.com/api/all-platform/vnc-vps/ssh/${vpsId}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (isMounted) {
        term.write('\x1b[32m[Hệ thống] Đã kết nối SSH\x1b[0m\r\n\r\n');
      }
    };

    ws.onmessage = async (event) => {
      if (!isMounted) return;
      try {
        if (typeof event.data === 'string') {
          term.write(event.data);
        } else if (event.data instanceof Blob) {
          const text = await event.data.text();
          term.write(text);
        } else {
          const arrayBuffer = event.data as ArrayBuffer;
          const decoder = new TextDecoder('utf-8');
          term.write(decoder.decode(arrayBuffer));
        }
      } catch (e) {
        console.warn('Failed to write stream to terminal:', e);
      }
    };

    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // 3. Tích hợp ResizeObserver để theo dõi kích thước container một cách realtime và an toàn
    let resizeObserver: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        if (!isMounted) return;
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          // Chỉ gọi fitAddon.fit khi kích thước container thực tế lớn hơn 0
          if (width > 0 && height > 0) {
            try {
              fitAddon.fit();
            } catch (e) {
              console.warn('FitAddon fit error in ResizeObserver:', e);
            }
          }
        }
      });
      resizeObserver.observe(terminalRef.current);
    }

    const handleResize = () => {
      if (!isMounted || !terminalRef.current) return;
      try {
        const rect = terminalRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          fitAddon.fit();
        }
      } catch (e) {
        // Tránh lỗi khi container ẩn/hiện đột ngột
      }
    };
    window.addEventListener('resize', handleResize);

    ws.onerror = () => {
      if (isMounted) {
        term.write('\r\n\x1b[31m[Hệ thống] Mất kết nối tới máy chủ (Lỗi kết nối)\x1b[0m\r\n');
      }
    };

    ws.onclose = () => {
      if (isMounted) {
        term.write('\r\n\x1b[31m[Hệ thống] Mất kết nối tới máy chủ\x1b[0m\r\n');
      }
    };

    // 4. Cleanup khi component unmount
    return () => {
      isMounted = false;
      clearTimeout(initTimeout);
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      onDataDisposable.dispose();
      
      if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          try {
            ws.close();
          } catch (e) {}
        };
      } else if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CLOSING) {
        try {
          ws.close();
        } catch (e) {}
      }
      
      term.dispose();
    };
  }, [vpsId]);

  return (
    <div className="bg-black overflow-hidden w-full" style={{ boxSizing: 'border-box' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        .xterm-viewport {
          overflow-y: auto !important;
        }
        .xterm-screen {
          padding-bottom: 8px;
        }
      `}} />
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height,
          backgroundColor: '#000',
          overflow: 'hidden',
          paddingBottom: '20px',
          boxSizing: 'border-box'
        }}
        className="p-2"
      />
    </div>
  );
}
