'use client';

interface PoolItem {
  dept: string;
  used: number;
  total: number;
  color: string;
}

interface TokenPoolProps {
  items?: PoolItem[];
}

const defaultItems: PoolItem[] = [
  { dept: 'Marketing', used: 1370, total: 1700, color: '#818cf8' },
  { dept: 'Dev', used: 680, total: 900, color: '#34d399' },
  { dept: 'Sales', used: 860, total: 1000, color: '#f87171' },
  { dept: 'Ops', used: 290, total: 600, color: '#fbbf24' },
  { dept: 'Design', used: 80, total: 400, color: '#60a5fa' },
];

export default function TokenPool({ items = defaultItems }: TokenPoolProps) {
  const totalUsed = items.reduce((sum, item) => sum + item.used, 0);
  const totalPool = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Token Pool Manager</h3>
      <div className="text-xs text-slate-500 mb-2.5">Tổng pool: {(totalPool / 1000).toFixed(1)}M tokens | Đã dùng: {(totalUsed / 1000).toFixed(1)}M | Còn: {((totalPool - totalUsed) / 1000).toFixed(1)}M</div>

      <div className="space-y-1.5 mb-3">
        {items.map((item) => {
          const pct = Math.round((item.used / item.total) * 100);
          return (
            <div key={item.dept} className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-b-0">
              <div className="text-slate-400 text-xs">{item.dept}</div>
              <div className="flex-1 mx-3 h-1 bg-slate-700 rounded">
                <div
                  className="h-1 rounded transition-all"
                  style={{ width: `${pct}%`, background: item.color }}
                />
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">
                {item.used}k/{item.total}k
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-950 border border-blue-800 rounded-lg p-2.5 text-xs text-blue-200">
        🔄 Gợi ý: Chuyển <strong>400k tokens</strong> từ Ops → Sales để cân bằng tải cuối tháng.
      </div>
    </div>
  );
}
