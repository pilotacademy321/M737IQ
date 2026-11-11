import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  light?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = true,
  className = '',
  light = false,
}) => {
  const { language } = useLanguage();

  const dimensions = {
    sm: { iconSize: 32, brandClass: 'text-base sm:text-lg', subClass: 'text-[10px]', tagClass: 'text-[9px]' },
    md: { iconSize: 42, brandClass: 'text-xl sm:text-2xl', subClass: 'text-xs sm:text-sm', tagClass: 'text-[10px] sm:text-xs' },
    lg: { iconSize: 54, brandClass: 'text-2xl sm:text-3xl', subClass: 'text-sm sm:text-base', tagClass: 'text-xs' },
    xl: { iconSize: 68, brandClass: 'text-3xl sm:text-4xl', subClass: 'text-base sm:text-lg', tagClass: 'text-sm' },
  }[size];

  const primaryTextColor = light ? 'text-white' : 'text-[#002244]';
  const accentTealColor = light ? '#2dd4bf' : '#0d9488';
  const deepBlueColor = light ? '#60a5fa' : '#003366';
  const pulseRed = '#e11d48';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Official MEDORA Medical Protective Emblem */}
      <div 
        className="relative shrink-0 transition-transform hover:scale-105 duration-200"
        style={{ width: dimensions.iconSize, height: dimensions.iconSize }}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`medGrad-${size}-${light ? 'l' : 'd'}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={deepBlueColor} />
              <stop offset="100%" stopColor={accentTealColor} />
            </linearGradient>
            <filter id={`glow-${size}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Protective Rounded Hex/Shield Badge */}
          <rect
            x="6"
            y="6"
            width="88"
            height="88"
            rx="24"
            fill={light ? 'rgba(255, 255, 255, 0.12)' : '#f0fdfa'}
            stroke={`url(#medGrad-${size}-${light ? 'l' : 'd'})`}
            strokeWidth="3.5"
          />

          {/* Stethoscope Arch (Clinical Care) */}
          <path
            d="M 28 32 C 28 54, 42 66, 50 66 C 58 66, 72 54, 72 32"
            stroke={accentTealColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 36 22 L 36 28 M 64 22 L 64 28"
            stroke={deepBlueColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="36" cy="20" r="3" fill={accentTealColor} />
          <circle cx="64" cy="20" r="3" fill={accentTealColor} />

          {/* Vital ECG Heartbeat Wave */}
          <path
            d="M 18 50 L 32 50 L 38 40 L 45 64 L 54 26 L 61 58 L 66 48 L 82 48"
            stroke={pulseRed}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#glow-${size})`}
          />
          <circle cx="54" cy="26" r="3.5" fill={pulseRed} />
        </svg>
      </div>

      {/* Official MEDORA Typography */}
      <div className="flex flex-col text-start justify-center">
        <div className="flex items-center gap-2 leading-none flex-wrap">
          <span className={`font-black tracking-wider ${dimensions.brandClass} ${primaryTextColor}`}>
            MEDORA
          </span>
          <span className="text-slate-300 font-light select-none">|</span>
          <span className={`font-bold text-[#0d9488] ${dimensions.subClass} ${light ? 'text-[#2dd4bf]' : 'text-[#0d9488]'}`}>
            ميدورا العراق
          </span>
        </div>

        {showTagline && (
          <div className="flex items-center gap-1.5 mt-1 leading-none">
            <span className={`font-bold uppercase tracking-wider text-xs ${dimensions.tagClass} ${light ? 'text-slate-300' : 'text-slate-500'}`}>
              {language === 'ar' ? 'صحتك أولويتنا' : 'YOUR HEALTH • OUR PRIORITY'}
            </span>
            <span className="text-xs text-rose-500 font-bold">•</span>
            <span className={`font-semibold text-xs ${dimensions.tagClass} ${light ? 'text-slate-400' : 'text-slate-400'}`}>
              {language === 'ar' ? 'YOUR HEALTH • OUR PRIORITY' : 'صحتك أولويتنا'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
