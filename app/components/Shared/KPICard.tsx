'use client';

interface KPICardProps {
  label: string;
  value: string;
  subtext: string;
  trend: 'up' | 'down' | 'neutral';
  accentColor: string;
}

export default function KPICard({ label, value, subtext, trend, accentColor }: KPICardProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-rose-400',
    neutral: 'text-slate-400',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '—',
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 hover:border-indigo-500 transition-colors">
      <div
        className="w-1 h-full absolute left-0 top-0 rounded-l-lg"
        style={{ background: accentColor }}
      />
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className={`text-xs mt-1.5 ${trendColors[trend]}`}>
        {trendIcons[trend]} {subtext}
      </p>
    </div>
  );
}
