'use client';

import React, { useState, useEffect } from 'react';
import { X, Play, Loader, AlertTriangle, FileText, Code } from 'lucide-react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    file_name: string;
    storage_path: string;
    mime_type: string;
    source_url: string;
  } | null;
  onSelectForChat?: () => void;
}

export default function FilePreviewModal({ isOpen, onClose, file, onSelectForChat }: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Sanitize sourceUrl to remove ?download=...
  const rawUrl = file?.source_url || '';
  const sourceUrl = rawUrl.split('?')[0];

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent('');
      setFetchError(null);
      return;
    }

    const name = file.file_name.toLowerCase();
    const isTextCodeOrHtml =
      name.endsWith('.txt') ||
      name.endsWith('.json') ||
      name.endsWith('.js') ||
      name.endsWith('.jsx') ||
      name.endsWith('.ts') ||
      name.endsWith('.tsx') ||
      name.endsWith('.py') ||
      name.endsWith('.md') ||
      name.endsWith('.css') ||
      name.endsWith('.html') ||
      (file.mime_type || '').startsWith('text/') ||
      file.mime_type === 'application/json' ||
      file.mime_type === 'application/javascript';

    if (isTextCodeOrHtml) {
      setLoadingText(true);
      setFetchError(null);
      setTextContent('');

      fetch(sourceUrl)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Không thể tải nội dung file (${res.status})`);
          }
          return res.text();
        })
        .then((text) => {
          setTextContent(text);
          setLoadingText(false);
        })
        .catch((err) => {
          console.error(err);
          setFetchError(err.message || 'Lỗi khi tải nội dung file');
          setLoadingText(false);
        });
    }
  }, [isOpen, file, sourceUrl]);

  if (!isOpen || !file) return null;

  const fileName = file.file_name;
  const mimeType = file.mime_type || '';
  const nameLower = fileName.toLowerCase();

  const isTextCodeOrHtml =
    nameLower.endsWith('.txt') ||
    nameLower.endsWith('.json') ||
    nameLower.endsWith('.js') ||
    nameLower.endsWith('.jsx') ||
    nameLower.endsWith('.ts') ||
    nameLower.endsWith('.tsx') ||
    nameLower.endsWith('.py') ||
    nameLower.endsWith('.md') ||
    nameLower.endsWith('.css') ||
    nameLower.endsWith('.html') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/javascript';

  const isHtml = nameLower.endsWith('.html');

  // Determine rendering type
  let renderType: 'html-iframe' | 'text' | 'office-pdf' = 'office-pdf';
  if (isTextCodeOrHtml) {
    if (isHtml) {
      renderType = 'html-iframe';
    } else {
      renderType = 'text';
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                {renderType === 'text' ? <Code className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-800 text-sm md:text-base truncate" title={fileName}>
                  Xem trước: {fileName}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  Định dạng: {mimeType || 'Không xác định'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-[50vh] max-h-[70vh] bg-slate-100 relative overflow-hidden">
            {renderType === 'text' && (
              <div className="w-full h-full p-4 overflow-auto bg-slate-950 text-slate-200 font-mono text-xs leading-relaxed select-text">
                {loadingText ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-slate-400">
                    <Loader className="w-6 h-6 animate-spin text-purple-500" />
                    <span>Đang tải nội dung tệp...</span>
                  </div>
                ) : fetchError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950 text-rose-400 px-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mb-1" />
                    <span className="font-bold text-sm">Không thể xem trực tiếp nội dung</span>
                    <span className="text-[11px] text-slate-400">{fetchError}</span>
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      Mở trong tab mới
                    </a>
                  </div>
                ) : (
                  <pre className="overflow-auto whitespace-pre-wrap break-all select-text font-mono">
                    <code>{textContent}</code>
                  </pre>
                )}
              </div>
            )}

            {renderType === 'html-iframe' && (
              <div className="w-full h-full relative">
                {loadingText ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-slate-500">
                    <Loader className="w-6 h-6 animate-spin text-purple-500" />
                    <span>Đang tải trang HTML...</span>
                  </div>
                ) : fetchError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-rose-500 px-4 text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-500 mb-1" />
                    <span className="font-bold text-sm">Không thể xem trực tiếp HTML</span>
                    <span className="text-[11px] text-slate-400">{fetchError}</span>
                  </div>
                ) : (
                  <iframe
                    srcDoc={textContent}
                    className="min-h-[70vh] w-full overflow-auto border-0 bg-white"
                    title={fileName}
                  />
                )}
              </div>
            )}

            {renderType === 'office-pdf' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 text-slate-700 p-6 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-500 mb-2" />
                <span className="font-bold text-base">Trình duyệt chặn hiển thị trực tiếp định dạng này.</span>
                <p className="text-xs text-slate-400 max-w-md font-medium">Bạn có thể mở tệp trong thẻ trình duyệt mới hoặc tải tệp trực tiếp xuống máy tính của mình.</p>
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  Mở file trong Tab mới
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-end gap-3 sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs transition-all cursor-pointer shadow-3xs"
            >
              Đóng
            </button>
            <a
              href={`${sourceUrl}?download=${encodeURIComponent(fileName)}`}
              download={fileName}
              onClick={onClose}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-200"
            >
              ⬇️ Tải file xuống máy
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
