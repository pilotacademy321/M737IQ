import React from 'react';
import { useLanguage } from '../context/LanguageContext';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  light?: boolean;
  imageOnly?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showTagline = true,
  className = '',
  light = false,
  imageOnly = false,
}) => {
  const { language } = useLanguage();

  const dimensions = {
    sm: { imgHeight: 'h-8 sm:h-9', brandClass: 'text-base sm:text-lg', subClass: 'text-[10px]', tagClass: 'text-[9px]' },
    md: { imgHeight: 'h-11 sm:h-12', brandClass: 'text-xl sm:text-2xl', subClass: 'text-xs sm:text-sm', tagClass: 'text-[10px] sm:text-xs' },
    lg: { imgHeight: 'h-14 sm:h-16', brandClass: 'text-2xl sm:text-3xl', subClass: 'text-sm sm:text-base', tagClass: 'text-xs' },
    xl: { imgHeight: 'h-20 sm:h-24', brandClass: 'text-3xl sm:text-4xl', subClass: 'text-base sm:text-lg', tagClass: 'text-sm' },
  }[size];

  const primaryTextColor = light ? 'text-white' : 'text-[#002244]';
  const logoSrc = '/assets/images/medora-official-logo.png';
  const fallbackSrc = '/assets/aistudio/file_00000000c14c8212bf0596ef74f11668_1fe788e9.png';

  if (imageOnly) {
    return (
      <img
        src={logoSrc}
        alt="MEDORA | ميدورا العراق"
        className={`${dimensions.imgHeight} w-auto object-contain select-none transition-transform duration-200 hover:scale-[1.02] ${className}`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackSrc;
        }}
      />
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Official Attached MEDORA Transparent PNG Logo */}
      <img
        src={logoSrc}
        alt="MEDORA Logo"
        className={`${dimensions.imgHeight} w-auto object-contain shrink-0 transition-transform hover:scale-105 duration-200`}
        onError={(e) => {
          (e.target as HTMLImageElement).src = fallbackSrc;
        }}
      />

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

