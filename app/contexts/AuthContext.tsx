'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentUserProfile,
  signInWithGoogle,
  signOut,
  type UserProfile,
} from '@/lib/dashboard-supabase';

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: () => Promise<any>;
  logout: () => Promise<any>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function loadProfile() {
    setIsLoading(true);
    try {
      const profile = await getCurrentUserProfile();
      setUser(profile);
      if (profile && typeof window !== 'undefined') {
        const redirectUrl = sessionStorage.getItem('login_redirect_url');
        if (redirectUrl) {
          sessionStorage.removeItem('login_redirect_url');
          window.location.href = redirectUrl;
          return;
        }
      }
    } catch (e) {
      console.error('Error loadProfile in AuthProvider:', e);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const login = async () => {
    return signInWithGoogle();
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const refreshProfile = async () => {
    try {
      const profile = await getCurrentUserProfile();
      setUser(profile);
    } catch (e) {
      console.error(e);
    }
  };

  const [isShareRoute, setIsShareRoute] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      setIsShareRoute(path.startsWith('/share/') || path.startsWith('/shared/'));
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-sm text-[#64748b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#E3000F] border-t-transparent rounded-full animate-spin" />
          <p className="font-semibold text-slate-700 animate-pulse">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!user && !isShareRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] p-5 text-[#1e293b]">
        <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 text-center shadow-lg">
          <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold bg-linear-to-r from-slate-900 via-red-600 to-rose-600 bg-clip-text text-transparent">Markee AI Ops</h1>
          <p className="mt-2 text-sm text-[#64748b]">Đăng nhập Google để mở dashboard theo role.</p>
          <button
            type="button"
            onClick={login}
            className="mt-5 w-full rounded-lg bg-[#E3000F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer border-0 shadow-sm"
          >
            Đăng nhập Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
