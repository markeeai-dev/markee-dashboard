'use client';

import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartOptions } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ToolChartItem {
  label: string;
  value: number;
}

interface ToolChartProps {
  items?: ToolChartItem[];
}

const defaultItems: ToolChartItem[] = [
  { label: 'Claude (Anthropic)', value: 48 },
  { label: 'ChatGPT-4o', value: 28 },
  { label: 'Gemini', value: 12 },
  { label: 'Midjourney', value: 8 },
  { label: 'Khác', value: 4 },
];

const colors = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#64748b', '#a78bfa', '#06b6d4'];

export default function ToolChart({ items = defaultItems }: ToolChartProps) {
  const chartItems = items.length > 0 ? items : defaultItems;
  const data = {
    labels: chartItems.map((item) => item.label),
    datasets: [
      {
        data: chartItems.map((item) => item.value),
        backgroundColor: chartItems.map((_, idx) => colors[idx % colors.length]),
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'right',
        labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Phân bổ theo AI Tool <span className="text-indigo-400 text-xs cursor-pointer">Chi tiết →</span>
      </h3>
      <Doughnut data={data} options={options} height={160} />
    </div>
  );
}
