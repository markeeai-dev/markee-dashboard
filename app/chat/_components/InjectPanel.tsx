'use client';

import { Search, Paperclip } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchInjectAssets } from '@/lib/dashboard-supabase';
import type { UserProfile } from '@/lib/dashboard-supabase';

interface Props {
  profile: UserProfile;
}

export function InjectPanel({ profile }: Props) {
  const [search, setSearch] = useState('');
  const [assets, setAssets] = useState<{ id: number; title: string; category: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await fetchInjectAssets(profile.email, search || undefined);
      setAssets(data);
      setLoading(false);
    }
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="border-t border-markee-border p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Paperclip className="w-3.5 h-3.5 text-markee-primary" />
        <span className="text-[11px] font-semibold text-markee-text">Quick Inject</span>
      </div>
      <div className="relative mb-2">
        <Search className="w-3 h-3 text-markee-sub absolute left-2 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Tim asset inject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-6 pr-2 py-1.5 text-[11px] rounded-md border border-markee-border bg-markee-bg/50 focus:outline-none focus:border-markee-primary/40 transition-colors"
        />
      </div>
      <div className="space-y-1 max-h-[180px] overflow-y-auto">
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 bg-markee-bg rounded animate-pulse" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <p className="text-[10px] text-markee-sub text-center py-2">
            {search ? 'Khong tim thay asset' : 'Chua co asset nao duoc duyet'}
          </p>
        ) : (
          assets.slice(0, 7).map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-markee-bg transition-colors group cursor-pointer"
            >
              <span className="text-[10px] text-markee-sub bg-markee-border/50 px-1 rounded">{a.category || 'Asset'}</span>
              <span className="text-[11px] text-markee-text truncate flex-1">{a.title}</span>
              <span className="text-[10px] text-markee-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Inject</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
