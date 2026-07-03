'use client';

import React from 'react';
import { FileText, Image as ImageIcon, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export interface UploadedFile {
  id: string;
  message_id?: string | null;
  user_id?: string | null;
  file_name: string;
  storage_path: string;
  mime_type?: string | null;
  size_bytes?: number | null;
  created_at?: string;
}

interface FileAttachmentProps {
  file: UploadedFile;
}

export default function FileAttachment({ file }: FileAttachmentProps) {
  const isImage = file.mime_type?.startsWith('image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.file_name);

  // Format file size
  const formatSize = (bytes?: number | null) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Get Supabase Storage public URL
  const { data } = supabase.storage.from('chat_attachments').getPublicUrl(file.storage_path);
  const publicUrl = data?.publicUrl || '';

  if (isImage) {
    return (
      <div className="mt-2.5 max-w-[240px]">
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block group overflow-hidden rounded-xl border border-slate-200 hover:border-markee-primary transition-all relative bg-slate-50 aspect-video shadow-3xs"
          title={file.file_name}
        >
          <img
            src={publicUrl}
            alt={file.file_name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
          />
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-white drop-shadow-sm" />
          </div>
        </a>
        <div className="flex items-center justify-between mt-1 px-1 min-w-0">
          <span className="text-[10px] text-slate-400 font-semibold truncate shrink flex-1 mr-2" title={file.file_name}>
            {file.file_name}
          </span>
          <a
            href={publicUrl}
            download={file.file_name}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-markee-primary transition-colors shrink-0"
            title="Tải về"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2.5 max-w-sm">
      <div className="flex items-center justify-between p-3 bg-slate-50/70 border border-slate-200 rounded-xl hover:border-markee-primary hover:bg-red-50/5 transition-all shadow-3xs">
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center text-markee-primary shrink-0 select-none">
            <FileText className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-800 truncate" title={file.file_name}>
              {file.file_name}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
              {formatSize(file.size_bytes)}
            </p>
          </div>
        </div>
        <a
          href={publicUrl}
          download={file.file_name}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-markee-primary transition-colors cursor-pointer border-0 bg-transparent flex items-center justify-center shrink-0"
          title="Tải về"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
