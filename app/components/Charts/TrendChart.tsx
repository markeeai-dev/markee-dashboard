'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function TrendChart() {
  const data = {
    labels: ['1/4', '5/4', '9/4', '13/4', '17/4', '21/4', '25/4', '29/4', '3/5', '7/5'],
    datasets: [
      {
        label: 'Token (k)',
        data: [280, 310, 290, 350, 380, 340, 420, 400, 460, 440],
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: 'y',
      },
      {
        label: 'Chi phí ($)',
        data: [18, 21, 19, 23, 26, 23, 29, 27, 31, 30],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        yAxisID: 'y1',
      },
    ],
  };

  const options: any = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10 } },
    },
    scales: {
      x: {
        ticks: { color: '#64748b', font: { size: 9 } },
        grid: { color: '#1e2537' },
      },
      y: {
        ticks: { color: '#64748b', font: { size: 9 } },
        grid: { color: '#1e2537' },
        title: { display: true, text: 'Token (k)', color: '#64748b', font: { size: 9 } },
      },
      y1: {
        position: 'right',
        ticks: { color: '#64748b', font: { size: 9 } },
        grid: { drawOnChartArea: false },
        title: { display: true, text: '$ USD', color: '#64748b', font: { size: 9 } },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Xu hướng Token & Chi phí (30 ngày) <span className="text-indigo-400 text-xs cursor-pointer">Xem chi tiết →</span>
      </h3>
      <Line data={data} options={options} height={160} />
    </div>
  );
}
