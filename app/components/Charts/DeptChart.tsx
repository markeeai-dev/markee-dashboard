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

export default function DeptChart() {
  const data = {
    labels: ['Marketing', 'Sales', 'Dev', 'Ops', 'Design'],
    datasets: [
      {
        label: 'Adoption %',
        data: [95, 88, 100, 72, 30],
        backgroundColor: ['#6366f1', '#10b981', '#34d399', '#f59e0b', '#f43f5e'],
        borderRadius: 6,
      },
    ],
  };

  const options: any = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e2537' } },
      y: {
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: (v: number) => v + '%',
        },
        grid: { color: '#1e2537' },
        max: 110,
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Adoption rate theo phòng ban
      </h3>
      <Bar data={data} options={options} height={180} />
    </div>
  );
}
