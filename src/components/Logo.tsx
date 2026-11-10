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
    sm: { iconSize: 30, textClass: 'text-base sm:text-lg', subClass: 'text-[10px]' },
    md: { iconSize: 40, textClass: 'text-xl sm:text-2xl', subClass: 'text-xs' },
    lg: { iconSize: 52, textClass: 'text-2xl sm:text-3xl', subClass: 'text-sm' },
    xl: { iconSize: 66, textClass: 'text-3xl sm:text-4xl', subClass: 'text-base' },
  }[size];

  const primaryTextColor = light ? 'text-white' : 'text-[#002b49]';
  const accentTealColor = light ? '#2dd4bf' : '#0d9488';
  const deepBlueColor = light ? '#60a5fa' : '#003366';
  const pulseRed = '#e11d48';

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Pure Medical Icon: Heartbeat Pulse + Stethoscope Arc & Caring Hands / Cross */}
      <svg
        viewBox="0 0 100 100"
        className="shrink-0 transition-transform hover:scale-105 duration-200"
        style={{ width: dimensions.iconSize, height: dimensions.iconSize }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={deepBlueColor} />
            <stop offset="100%" stopColor={accentTealColor} />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Medical Protective Shield / Rounded Square Badge */}
        <rect
          x="6"
          y="6"
          width="88"
          height="88"
          rx="24"
          fill={light ? 'rgba(255, 255, 255, 0.12)' : '#f0fdfa'}
          stroke="url(#shieldGrad)"
          strokeWidth="3.5"
        />

        {/* Stethoscope Chestpiece Loop (Healthcare & Doctor Connection) */}
        <path
          d="M 28 32 C 28 54, 42 66, 50 66 C 58 66, 72 54, 72 32"
          stroke={accentTealColor}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Stethoscope Earpieces & Binaural Upper Tube */}
        <path
          d="M 36 22 L 36 28 M 64 22 L 64 28"
          stroke={deepBlueColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="36" cy="20" r="3" fill={accentTealColor} />
        <circle cx="64" cy="20" r="3" fill={accentTealColor} />

        {/* Vital Heartbeat ECG Line (Red Accent) across center */}
        <path
          d="M 20 50 L 34 50 L 39 40 L 46 64 L 54 28 L 61 58 L 66 48 L 80 48"
          stroke={pulseRed}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#softGlow)"
        />

        {/* Pulse vitality dot */}
        <circle cx="54" cy="28" r="3.5" fill={pulseRed} />
      </svg>

      {/* Clean neutral medical symbol only - no old brand names or promotional slogans */}
    </div>
  );
};
