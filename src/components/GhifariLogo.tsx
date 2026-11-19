import React from 'react';

interface GhifariLogoProps {
  size?: number;
  variant?: 'default' | 'light';
  showText?: boolean;
  subtitle?: string;
}

export const GhifariLogo: React.FC<GhifariLogoProps> = ({
  size = 38,
  variant = 'default',
  showText = true,
  subtitle = 'SMK AL-GHIFARI',
}) => {
  const titleColor = variant === 'light' ? 'text-white' : 'text-[#102B50]';
  const subColor = variant === 'light' ? 'text-blue-200' : 'text-slate-500';

  return (
    <div className="inline-flex items-center gap-3 select-none shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo GHIFARI CBT"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="ghifariBg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#102B50" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="11" fill="url(#ghifariBg)" />
        <rect x="2.75" y="2.75" width="42.5" height="42.5" rx="10.25" stroke="white" strokeOpacity="0.18" strokeWidth="1.5" />
        {/* Modern Geometric Letter G + Education Tech Circuit */}
        <path
          d="M32.5 17.2C30.4 14.9 27.4 13.5 24 13.5C17.65 13.5 12.5 18.42 12.5 24.5C12.5 30.58 17.65 35.5 24 35.5C29.8 35.5 34.6 31.38 35.38 26.0H24.5V22.2H35.8C35.93 22.95 36 23.72 36 24.5"
          stroke="white"
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Digital Node Accent */}
        <circle cx="34.5" cy="14.5" r="2.6" fill="#60A5FA" />
        <circle cx="34.5" cy="14.5" r="1.1" fill="#FFFFFF" />
      </svg>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`text-base font-extrabold tracking-tight whitespace-nowrap ${titleColor}`}>
            GHIFARI CBT
          </span>
          {subtitle && (
            <span className={`text-[11px] font-semibold tracking-wide mt-1 whitespace-nowrap ${subColor}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
