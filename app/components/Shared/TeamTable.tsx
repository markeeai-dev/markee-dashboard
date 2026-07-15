'use client';

interface TeamMember {
  name: string;
  avatar: string;
  color: string;
  dept: string;
  used: number;
  budget: number;
  cost: number;
  tasks: number;
  skills: number;
  score: number;
  status: 'green' | 'yellow' | 'red';
}

interface TeamTableProps {
  limit?: number;
  fullView?: boolean;
  members?: TeamMember[];
}

const teamData: TeamMember[] = [
  {
    name: 'Linh',
    avatar: 'LN',
    color: '#818cf8',
    dept: 'Marketing',
    used: 820000,
    budget: 1000000,
    cost: 54.6,
    tasks: 128,
    skills: 7,
    score: 9.2,
    status: 'green',
  },
  {
    name: 'Minh',
    avatar: 'MH',
    color: '#f87171',
    dept: 'Sales',
    used: 450000,
    budget: 500000,
    cost: 30.0,
    tasks: 89,
    skills: 3,
    score: 7.8,
    status: 'red',
  },
  {
    name: 'Huy',
    avatar: 'HV',
    color: '#34d399',
    dept: 'Dev',
    used: 680000,
    budget: 900000,
    cost: 45.2,
    tasks: 203,
    skills: 11,
    score: 9.5,
    status: 'green',
  },
  {
    name: 'Trang',
    avatar: 'TT',
    color: '#fbbf24',
    dept: 'Ops',
    used: 290000,
    budget: 600000,
    cost: 19.3,
    tasks: 56,
    skills: 4,
    score: 7.1,
    status: 'yellow',
  },
  {
    name: 'Nam',
    avatar: 'NQ',
    color: '#60a5fa',
    dept: 'Sales',
    used: 410000,
    budget: 500000,
    cost: 27.3,
    tasks: 72,
    skills: 2,
    score: 8.0,
    status: 'green',
  },
  {
    name: 'Phương',
    avatar: 'PH',
    color: '#a78bfa',
    dept: 'Marketing',
    used: 550000,
    budget: 700000,
    cost: 36.7,
    tasks: 94,
    skills: 5,
    score: 8.6,
    status: 'green',
  },
  {
    name: 'Đức',
    avatar: 'ĐT',
    color: '#fb923c',
    dept: 'Design',
    used: 80000,
    budget: 400000,
    cost: 5.3,
    tasks: 12,
    skills: 1,
    score: 4.2,
    status: 'yellow',
  },
];

const statusStyles = {
  green: 'bg-green-950 text-green-400',
  yellow: 'bg-yellow-950 text-yellow-400',
  red: 'bg-red-950 text-red-400',
};

const statusLabels = { green: 'Hiệu quả', yellow: 'Cần hỗ trợ', red: 'Khẩn cấp' };

function formatNumber(n: number) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(0) + 'k';
  return n.toString();
}

export default function TeamTable({ limit = 6, fullView = false, members = teamData }: TeamTableProps) {
  const sorted = [...members].sort((a, b) => b.used - a.used);
  const displayData = fullView ? sorted : sorted.slice(0, limit);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Thành viên</th>
            <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Dept</th>
            {fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Token dùng</th>}
            {fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Chi phí</th>}
            {fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Tasks</th>}
            {fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Skill đã đóng góp</th>}
            {fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Điểm HP</th>}
            {!fullView && <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2 w-28">Usage</th>}
            <th className="text-xs text-slate-500 uppercase tracking-wider text-left py-2">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {displayData.map((member) => {
            const pct = Math.round((member.used / member.budget) * 100);
            return (
              <tr key={member.name} className="border-b border-slate-800 hover:bg-slate-800/50">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: member.color + '33', color: member.color }}
                    >
                      {member.avatar}
                    </div>
                    <span className="text-sm">{member.name}</span>
                  </div>
                </td>
                <td className="text-slate-400 text-xs py-2">{member.dept}</td>
                {fullView && <td className="text-sm py-2">{formatNumber(member.used)}</td>}
                {fullView && <td className="text-sm py-2">${member.cost.toFixed(1)}</td>}
                {fullView && <td className="text-sm py-2">{member.tasks}</td>}
                {fullView && <td className="text-indigo-400 text-sm py-2">{member.skills} skills</td>}
                {fullView && (
                  <td className="text-sm py-2">
                    <span
                      style={{
                        color:
                          member.score >= 8.5
                            ? '#4ade80'
                            : member.score >= 7
                              ? '#fbbf24'
                              : '#f87171',
                      }}
                      className="font-bold"
                    >
                      {member.score}
                    </span>
                    /10
                  </td>
                )}
                {!fullView && (
                  <td className="py-2 pr-2">
                    <div className="text-xs text-slate-400 mb-1">
                      {formatNumber(member.used)} / {formatNumber(member.budget)}
                    </div>
                    <div className="bg-slate-700 rounded h-1.5">
                      <div
                        className="h-1.5 rounded transition-all"
                        style={{ width: `${pct}%`, background: member.color }}
                      />
                    </div>
                  </td>
                )}
                <td className="py-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusStyles[member.status]}`}>
                    {statusLabels[member.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { teamData, type TeamMember };
