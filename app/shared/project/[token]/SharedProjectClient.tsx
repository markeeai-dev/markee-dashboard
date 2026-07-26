'use client';

import React, { useState, useEffect, Suspense } from 'react';
// BỔ SUNG: Import thêm useSearchParams
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import ProjectDetailContent from '@/app/components/ProjectManagement/ProjectDetailContent';
import Link from 'next/link';

interface SharedProjectClientProps {
  project: any;
}

// BƯỚC 1: Tách logic chính ra một component con để dùng useSearchParams an toàn
function SharedProjectInner({ project, searchParams }: { project: any, searchParams: any }) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Xây dựng link redirect gốc
          let redirectUrl = `/?tab=projects&open_modal_id=${project.id}`;

          // BỔ SUNG: Nhặt lại các tham số feature và wip từ link Extension
          const feature = searchParams.get('feature');
          const wip = searchParams.get('wip');

          if (feature) {
            redirectUrl += `&feature=${encodeURIComponent(feature)}`;
          }
          if (wip) {
            redirectUrl += `&wip=${encodeURIComponent(wip)}`;
          }

          // Đã đăng nhập -> bẻ lái về Dashboard giữ nguyên tham số
          router.replace(redirectUrl);
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
  }, [project.id, router, searchParams]);

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

// BƯỚC 2: Bọc Suspense ở ngoài cùng. 
// (Next.js yêu cầu dùng Suspense khi gọi useSearchParams trong Client Component)
export default function SharedProjectClient({ project }: SharedProjectClientProps) {
  const searchParams = useSearchParams();
  
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8fafc]" />}>
      <SharedProjectInner project={project} searchParams={searchParams} />
    </Suspense>
  );
}