import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-12 text-center flex flex-col items-center">
      <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h4 className="text-sm font-bold text-[#102B50]">{title}</h4>
      <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
