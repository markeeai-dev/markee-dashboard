'use client';

import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function CostDeptChart() {
  const data = {
    labels: ['Marketing', 'Dev', 'Sales', 'Ops', 'Design'],
    datasets: [
      {
        data: [91, 45, 57, 19, 5],
        backgroundColor: ['#6366f1', '#34d399', '#f87171', '#fbbf24', '#60a5fa'],
        borderWidth: 0,
        hoverOffset: 6,
      },
    ],
  };

  const options: any = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: '#94a3b8',
          font: { size: 10 },
          boxWidth: 10,
          padding: 8,
          generateLabels: (chart: any) => {
            const d = chart.data;
            return d.labels.map((l: string, i: number) => ({
              text: `${l}: $${d.datasets[0].data[i]}`,
              fillStyle: d.datasets[0].backgroundColor[i],
              strokeStyle: 'transparent',
              index: i,
            }));
          },
        },
      },
    },
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4.5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3.5">
        Chi phí theo phòng ban
      </h3>
      <Pie data={data} options={options} height={200} />
    </div>
  );
}
