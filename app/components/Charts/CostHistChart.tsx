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

export default function CostHistChart() {
  const data = {
    labels: ['T12/24', 'T1/25', 'T2/25', 'T3/25', 'T4/25', 'T5/25'],
    datasets: [
      {
        label: 'Chi phí thực',
        data: [310, 298, 325, 312, 322, 284],
        backgroundColor: '#6366f1',
        borderRadius: 4,
      },
      {
        label: 'Dự báo',
        data: [310, 305, 320, 315, 320, 322],
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#6366f1',
      },
    ],
  };

  const options: any = {
    responsive: true,
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 } },
    },
    scales: {
      x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e2537' } },
      y: {
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          callback: (v: number) => '$' + v,
        },
        grid: { color: '#1e2537' },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Chi phí theo tháng (6 tháng qua)
      </h3>
      <Bar data={data} options={options} height={200} />
    </div>
  );
}
