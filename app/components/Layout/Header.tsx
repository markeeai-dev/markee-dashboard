'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import UserGuideModal from '../Shared/UserGuideModal';

interface HeaderProps {
  onPeriodChange: (period: string) => void;
  activePeriod: string;
}

export default function Header({ onPeriodChange, activePeriod }: HeaderProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const periods = ['7d', '30d', '90d'];
  const periodLabels = { '7d': '7 ngày', '30d': '30 ngày', '90d': '3 tháng' };

  return (
    <header className="bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-700">
      <div className="flex items-center gap-3">
        <img src="https://markeeai.com/logo.svg" alt="Markee Logo" className="w-9 h-9 shrink-0" />
        <div>
          <h1 className="text-base font-bold text-white">Markee AI Ops Center</h1>
          <p className="text-xs text-slate-400 mt-px">CEO Dashboard — Quản trị AI toàn team</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsGuideOpen(true)}
          className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border border-indigo-500/30 hover:border-indigo-500/50"
        >
          <BookOpen className="w-4 h-4" />
          <span>Hướng dẫn cài đặt</span>
        </button>

        <div className="flex gap-1">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => onPeriodChange(period)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activePeriod === period
                  ? 'bg-indigo-500 border border-indigo-500 text-white'
                  : 'bg-slate-700 border border-slate-600 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {periodLabels[period as keyof typeof periodLabels]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span
            className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"
          />
          Live
        </div>
      </div>

      <UserGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </header>
  );
}
