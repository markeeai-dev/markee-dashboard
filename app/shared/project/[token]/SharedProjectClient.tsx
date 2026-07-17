'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProjectDetailContent from '@/app/components/ProjectManagement/ProjectDetailContent';
import Link from 'next/link';

interface SharedProjectClientProps {
  project: any;
}

export default function SharedProjectClient({ project }: SharedProjectClientProps) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Đã đăng nhập -> redirect thẳng về Dashboard kèm open_modal_id
          router.replace(`/?tab=projects&open_modal_id=${project.id}`);
        } else {
          // Chưa đăng nhập -> hiển thị chế độ read-only
          setCheckingAuth(false);
        }
      } catch (e) {
        console.error("Lỗi khi kiểm tra session:", e);
        setCheckingAuth(false);
      }
    }
    checkSession();
  }, [project.id, router]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-sm text-[#64748b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-markee-primary border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-slate-700 animate-pulse">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 md:p-8 font-sans relative w-full">
      {/* Nút đăng nhập hệ thống ở góc trên bên phải */}
      <div className="absolute top-4 right-4 z-50">
        <Link
          href="/"
          className="bg-markee-primary hover:bg-markee-hover text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-red-100 flex items-center gap-1.5 border-0 cursor-pointer"
        >
          <span>Đăng nhập hệ thống</span>
        </Link>
      </div>

      <div className="w-full max-w-5xl flex items-center justify-center animate-in fade-in duration-300">
        <ProjectDetailContent
          project={project}
          profile={null}
          isReadOnly={true}
        />
      </div>
    </div>
  );
}
