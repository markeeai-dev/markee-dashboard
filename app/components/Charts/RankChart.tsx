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
  { name: 'Huy', score: 9.5, color: '#34d399' },
  { name: 'Linh', score: 9.2, color: '#818cf8' },
  { name: 'Phương', score: 8.6, color: '#a78bfa' },
  { name: 'Nam', score: 8.0, color: '#60a5fa' },
  { name: 'Minh', score: 7.8, color: '#f87171' },
  { name: 'Trang', score: 7.1, color: '#fbbf24' },
  { name: 'Đức', score: 4.2, color: '#fb923c' },
];

export default function RankChart() {
  const data = {
    labels: teamColors.map((m) => m.name),
    datasets: [
      {
        label: 'Điểm HP',
        data: teamColors.map((m) => m.score),
        backgroundColor: teamColors.map((m) => m.color),
        borderRadius: 6,
      },
    ],
  };

  const options: any = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: '#1e2537' },
        max: 10,
      },
      y: {
        ticks: { color: '#94a3b8', font: { size: 10 } },
        grid: { color: '#1e2537' },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Điểm năng suất AI — Ranking
      </h3>
      <Bar data={data} options={options} height={180} />
    </div>
  );
}
