'use client';

type AlertType = 'warn' | 'info' | 'success';

interface AlertProps {
  type: AlertType;
  icon: string;
  title: string;
  message: string;
}

const alertStyles = {
  warn: 'bg-amber-950 border border-amber-800 text-amber-200',
  info: 'bg-blue-950 border border-blue-800 text-blue-200',
  success: 'bg-emerald-950 border border-emerald-800 text-emerald-200',
};

export default function AlertBox({ type, icon, title, message }: AlertProps) {
  return (
    <div className={`flex gap-2.5 p-2.5 rounded-lg text-xs leading-relaxed ${alertStyles[type]}`}>
      <span className="text-sm">{icon}</span>
      <div>
        <strong>{title}</strong> {message}
      </div>
    </div>
  );
}
