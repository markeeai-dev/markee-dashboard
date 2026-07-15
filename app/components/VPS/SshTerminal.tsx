'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface SshTerminalProps {
  vpsId: string;
}

export default function SshTerminal({ vpsId }: SshTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // 1. Khởi tạo instance Terminal
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Courier New, Courier, monospace',
      theme: {
        background: '#000000',
        foreground: '#a8ff60', // Chữ xanh lá cây sáng kiểu hacker
        cursor: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.write('[Hệ thống] Đang khởi tạo kết nối SSH...\r\n');

    // 2. Khởi tạo kết nối WebSocket
    const wsUrl = `wss://seeding.markeeai.com/api/all-platform/vnc-vps/ssh/${vpsId}`;
    const ws = new WebSocket(wsUrl);

    // Xử lý khi mở kết nối thành công
    ws.onopen = () => {
      term.write('\x1b[32m[Hệ thống] Đã kết nối thành công tới máy chủ...\x1b[0m\r\n\r\n');
    };

    // Xử lý nhận dữ liệu từ Backend và ghi ra Xterm
    ws.onmessage = async (event) => {
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
    };

    // Gửi phím gõ từ user lên Backend
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Lắng nghe sự kiện co giãn màn hình trình duyệt để Fit lại Terminal
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // Xử lý ngắt kết nối
    ws.onclose = (event) => {
      term.write(`\r\n\x1b[31m[Hệ thống] Đã ngắt kết nối SSH (Code: ${event.code})\x1b[0m\r\n`);
    };

    ws.onerror = () => {
      term.write('\r\n\x1b[31m[Hệ thống] Kết nối SSH gặp sự cố lỗi\x1b[0m\r\n');
      setErrorMsg('Không thể kết nối SSH tới máy chủ. Vui lòng kiểm tra lại cấu hình.');
    };

    // 3. Dọn dẹp bộ nhớ (Cleanup) khi component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      onDataDisposable.dispose();
      ws.close();
      term.dispose();
    };
  }, [vpsId]);

  return (
    <div className="relative w-full h-full flex flex-col bg-black">
      {errorMsg && (
        <div className="absolute top-2 right-2 z-10 px-3 py-1.5 text-xs font-semibold bg-red-650/90 text-white rounded-lg border border-red-500 shadow-lg">
          {errorMsg}
        </div>
      )}
      <div
        ref={terminalRef}
        className="w-full h-full p-2 overflow-hidden"
        style={{ minHeight: '300px' }}
      />
    </div>
  );
}
