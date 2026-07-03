'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Search, Download, FileText, Image as ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';

interface AISession {
  id: number;
  author_id: string | null;
  project_id: number | null;
  ai_tool: string | null;
  prompt_content: string | null;
  created_at: string;
}

interface UploadedFile {
  id: string;
  session_id: number | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  ai_sessions: AISession | null;
}

interface AppUser {
  id: number;
  email: string;
  full_name: string | null;
}

export default function FileManagement() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // 1. Fetch uploaded files with joined ai_sessions according to schema
      const { data: filesData, error: filesError } = await supabase
        .from('uploaded_files')
        .select('*, ai_sessions(*)')
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // 2. Fetch users table to map uploader in-memory
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, full_name');

      if (usersError) {
        console.error('Error fetching users for mapping:', usersError);
      }

      setFiles(filesData || []);
      setUsers(usersData || []);
    } catch (err) {
      console.error('Error fetching files:', err);
      showToast('Không thể tải danh sách tệp tin', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Format size helper
  const formatSize = (bytes?: number | null) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Format date helper
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check file type
  const isImage = (fileName: string, mimeType?: string | null) => {
    return mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(fileName);
  };

  // Get download link
  const getDownloadUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('chat_attachments').getPublicUrl(storagePath);
    return data?.publicUrl || '';
  };

  // Filtered files list based on search query
  const filteredFiles = files.filter((file) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const matchesName = file.file_name.toLowerCase().includes(query);
    
    // Check session data matches
    const matchesTool = file.ai_sessions?.ai_tool?.toLowerCase().includes(query) || false;
    const matchesPrompt = file.ai_sessions?.prompt_content?.toLowerCase().includes(query) || false;

    // Check uploader user info matches in-memory
    const authorEmail = file.ai_sessions?.author_id;
    const matchedUser = authorEmail ? users.find((u) => u.email === authorEmail) : null;
    const matchesUploaderName = matchedUser?.full_name?.toLowerCase().includes(query) || false;
    const matchesUploaderEmail = authorEmail?.toLowerCase().includes(query) || false;

    return matchesName || matchesTool || matchesPrompt || matchesUploaderName || matchesUploaderEmail;
  });

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-5">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold text-white shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-lg font-bold text-markee-text">Quản lý File & Tài nguyên</h1>
          <p className="text-xs text-markee-muted">Tập hợp tất cả các tệp tài liệu và hình ảnh được tải lên trong hệ thống chat.</p>
        </div>
        <button
          onClick={fetchFiles}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
          title="Tải lại dữ liệu"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Tải lại
        </button>
      </section>

      {/* Toolbar / Search */}
      <section className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-3xs">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên file, công cụ, prompt hoặc người tải..."
            className="w-full bg-slate-50 border border-slate-200 focus:border-markee-primary rounded-lg pl-9 pr-4 py-2 text-xs text-slate-800 outline-none transition-colors"
          />
        </div>
        <div className="text-xs font-semibold text-slate-500">
          Tổng số: <span className="text-slate-800 font-bold">{filteredFiles.length} tệp</span>
        </div>
      </section>

      {/* Main Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-3xs">
          <RefreshCw className="w-8 h-8 text-markee-primary animate-spin" />
          <span className="text-xs font-semibold text-slate-400 mt-3">Đang tải danh sách tệp...</span>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 shadow-3xs text-center p-6">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Không tìm thấy tệp nào</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery ? 'Không có tệp nào khớp với từ khóa tìm kiếm của bạn.' : 'Hệ thống chưa ghi nhận tệp tài nguyên nào được tải lên.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-3xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[35%]">Tên Tệp</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[25%]">Phiên AI / Prompt</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[20%]">Người tải lên</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[10%]">Dung lượng</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[10%]">Ngày tải</th>
                  <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-[5%] text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => {
                  const fileUrl = getDownloadUrl(file.storage_path);
                  const isImg = isImage(file.file_name, file.mime_type);

                  // Resolve uploader info from in-memory users list
                  const authorEmail = file.ai_sessions?.author_id;
                  const matchedUser = authorEmail ? users.find((u) => u.email === authorEmail) : null;

                  return (
                    <tr key={file.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name / Icon */}
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {isImg ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 shrink-0 bg-slate-50 block hover:border-markee-primary transition-all relative group"
                              title="Click xem ảnh lớn"
                            >
                              <img src={fileUrl} alt={file.file_name} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ImageIcon className="w-3 h-3 text-white" />
                              </div>
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-slate-800 block truncate animate-none" title={file.file_name}>
                              {file.file_name}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-semibold truncate mt-0.5" title={file.mime_type || ''}>
                              {file.mime_type || 'Unknown MIME Type'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* AI Session / Prompt */}
                      <td className="p-4">
                        {file.ai_sessions ? (
                          <div className="min-w-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-markee-primary border border-red-100">
                              {file.ai_sessions.ai_tool || 'Không rõ'}
                            </span>
                            <span
                              className="text-[10px] text-slate-500 block truncate mt-1.5 max-w-[200px]"
                              title={file.ai_sessions.prompt_content || ''}
                            >
                              {file.ai_sessions.prompt_content || 'Không có prompt'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-semibold italic">Không có</span>
                        )}
                      </td>

                      {/* Uploader */}
                      <td className="p-4">
                        <div className="min-w-0">
                          {authorEmail ? (
                            <>
                              <span className="text-xs font-bold text-slate-800 block truncate">
                                {matchedUser?.full_name || 'Không tên'}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-semibold truncate mt-0.5">
                                {authorEmail}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 italic">Không có</span>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="p-4 text-xs text-slate-600 font-semibold">
                        {formatSize(file.size_bytes)}
                      </td>

                      {/* Date */}
                      <td className="p-4 text-xs text-slate-600 font-semibold">
                        {formatDate(file.created_at)}
                      </td>

                      {/* Download Action */}
                      <td className="p-4 text-center">
                        <a
                          href={fileUrl}
                          download={file.file_name}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center p-2 text-slate-400 hover:text-markee-primary hover:bg-red-50 rounded-xl transition-colors border-0 bg-transparent cursor-pointer"
                          title="Tải về tệp tin"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
