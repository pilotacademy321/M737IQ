import React from 'react';
import { Pill, Droplet, Sparkles, Wind, Eye, ShieldAlert, Package, Activity } from 'lucide-react';

export type DosageCategory = 
  | 'tablets' 
  | 'capsules' 
  | 'syrup' 
  | 'injection' 
  | 'cream' 
  | 'drops' 
  | 'inhaler' 
  | 'suppository' 
  | 'sachet' 
  | 'other';

interface DosageFormVisualProps {
  photoUrl?: string;
  dosageForm?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function detectDosageCategory(dosageForm?: string): DosageCategory {
  if (!dosageForm) return 'other';
  const df = dosageForm.toLowerCase();

  if (df.includes('tablet') || df.includes('قرص') || df.includes('أقراص') || df.includes('حبوب')) {
    return 'tablets';
  }
  if (df.includes('capsule') || df.includes('كبسول')) {
    return 'capsules';
  }
  if (df.includes('syrup') || df.includes('شراب') || df.includes('معلق') || df.includes('suspension') || df.includes('liquid') || df.includes('solution') || df.includes('محلول')) {
    return 'syrup';
  }
  if (df.includes('injection') || df.includes('حقن') || df.includes('ampoule') || df.includes('vial') || df.includes('أمبول') || df.includes('فايل') || df.includes('syringe')) {
    return 'injection';
  }
  if (df.includes('cream') || df.includes('مرهم') || df.includes('كريم') || df.includes('ointment') || df.includes('gel') || df.includes('جل')) {
    return 'cream';
  }
  if (df.includes('drop') || df.includes('قطرة') || df.includes('قطرات') || df.includes('ophthalmic') || df.includes('otic')) {
    return 'drops';
  }
  if (df.includes('inhaler') || df.includes('بخاخ') || df.includes('رذاذ') || df.includes('aerosol') || df.includes('spray')) {
    return 'inhaler';
  }
  if (df.includes('suppository') || df.includes('تحاميل')) {
    return 'suppository';
  }
  if (df.includes('sachet') || df.includes('فوار') || df.includes('powder') || df.includes('مسحوق')) {
    return 'sachet';
  }

  return 'other';
}

export const DosageFormVisual: React.FC<DosageFormVisualProps> = ({
  photoUrl,
  dosageForm,
  name = '',
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = React.useState(false);
  const category = detectDosageCategory(dosageForm);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-12 h-12 rounded-xl text-sm',
    lg: 'w-16 h-16 rounded-2xl text-base',
    xl: 'w-24 h-24 rounded-3xl text-lg',
  }[size];

  const iconSizes = {
    sm: 16,
    md: 22,
    lg: 28,
    xl: 40,
  }[size];

  // If valid verified photo URL is present and not failed, display real photo
  if (photoUrl && !imgError && photoUrl.trim() !== '' && !photoUrl.includes('placeholder')) {
    return (
      <div className={`overflow-hidden shrink-0 border border-slate-200 bg-slate-50 flex items-center justify-center ${sizeClasses} ${className}`}>
        <img
          src={photoUrl}
          alt={name || dosageForm || 'Medicine'}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Clinical Icon Rendering based on Dosage Form Category
  const getCategoryConfig = () => {
    switch (category) {
      case 'tablets':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          labelAr: 'أقراص',
          icon: (
            <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="7.5" y1="7.5" x2="16.5" y2="16.5" />
            </svg>
          ),
        };
      case 'capsules':
        return {
          bg: 'bg-teal-50 text-teal-700 border-teal-200',
          labelAr: 'كبسول',
          icon: <Pill size={iconSizes} />,
        };
      case 'syrup':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          labelAr: 'شراب',
          icon: (
            <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="7" y="9" width="10" height="12" rx="2" />
              <path d="M10 9V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4" />
              <path d="M9 3h6" />
              <line x1="10" y1="13" x2="14" y2="13" />
            </svg>
          ),
        };
      case 'injection':
        return {
          bg: 'bg-red-50 text-red-700 border-red-200',
          labelAr: 'حقن',
          icon: (
            <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m18 2 4 4" />
              <path d="m17 7 3-3" />
              <path d="M19 9 8.7 19.3c-.4.4-1 .4-1.4 0l-2.6-2.6c-.4-.4-.4-1 0-1.4L15 5" />
              <path d="m9 11 4 4" />
              <path d="m5 19-3 3" />
              <path d="m14 4 6 6" />
            </svg>
          ),
        };
      case 'cream':
        return {
          bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          labelAr: 'مرهم',
          icon: (
            <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 21h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
              <line x1="9" y1="13" x2="15" y2="13" />
            </svg>
          ),
        };
      case 'drops':
        return {
          bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
          labelAr: 'قطرات',
          icon: (
            <svg width={iconSizes} height={iconSizes} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4" />
              <path d="m4.93 10.93 2.83-2.83" />
              <path d="M2 18h4" />
              <path d="M12 10a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4Z" />
            </svg>
          ),
        };
      case 'inhaler':
        return {
          bg: 'bg-sky-50 text-sky-700 border-sky-200',
          labelAr: 'بخاخ',
          icon: <Wind size={iconSizes} />,
        };
      case 'sachet':
        return {
          bg: 'bg-violet-50 text-violet-700 border-violet-200',
          labelAr: 'فوار',
          icon: <Sparkles size={iconSizes} />,
        };
      default:
        return {
          bg: 'bg-slate-100 text-slate-700 border-slate-200',
          labelAr: 'دواء',
          icon: <Package size={iconSizes} />,
        };
    }
  };

  const config = getCategoryConfig();

  return (
    <div
      title={dosageForm || config.labelAr}
      className={`shrink-0 border flex flex-col items-center justify-center transition-all ${config.bg} ${sizeClasses} ${className}`}
    >
      {config.icon}
    </div>
  );
};
