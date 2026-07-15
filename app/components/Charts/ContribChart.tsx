'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const teamColors = [
  { name: 'Huy', skills: 11, color: '#34d399' },
  { name: 'Linh', skills: 7, color: '#818cf8' },
  { name: 'Phương', skills: 5, color: '#a78bfa' },
  { name: 'Trang', skills: 4, color: '#fbbf24' },
  { name: 'Nam', skills: 2, color: '#60a5fa' },
  { name: 'Minh', skills: 3, color: '#f87171' },
  { name: 'Đức', skills: 1, color: '#fb923c' },
];

export default function ContribChart() {
  const data = {
    labels: teamColors.map((m) => m.name),
    datasets: [
      {
        label: 'Skills đóng góp',
        data: teamColors.map((m) => m.skills),
        backgroundColor: teamColors.map((m) => m.color),
        borderRadius: 6,
      },
    ],
  };

  const options: any = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e2537' } },
      y: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e2537' } },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Đóng góp Skill Library — Leaderboard
      </h3>
      <Bar data={data} options={options} height={180} />
    </div>
  );
}
