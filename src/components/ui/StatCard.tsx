import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  accent?: 'navy' | 'blue' | 'green' | 'amber' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  icon,
  accent = 'blue',
}) => {
  const iconBg =
    accent === 'navy'
      ? 'bg-[#102B50]/10 text-[#102B50]'
      : accent === 'green'
      ? 'bg-[#16A36A]/10 text-[#16A36A]'
      : accent === 'amber'
      ? 'bg-amber-100 text-amber-700'
      : accent === 'red'
      ? 'bg-[#DC2626]/10 text-[#DC2626]'
      : 'bg-[#2563EB]/10 text-[#2563EB]';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-[#102B50] mt-1.5 tabular-nums tracking-tight">{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-1 truncate">{hint}</p>}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
};
