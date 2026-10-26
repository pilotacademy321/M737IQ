import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { PortalId } from '../types';
import { 
  Home, 
  User, 
  Stethoscope, 
  Pill, 
  FlaskConical, 
  Scan, 
  Truck, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  Settings, 
  Headphones, 
  MessageCircle, 
  ChevronLeft, 
  ChevronRight,
  X,
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface AppSidebarProps {
  currentRoute: string;
  selectedPortalId: PortalId | null;
  onNavigateHome: () => void;
  onSelectPortal: (portalId: PortalId) => void;
  onNavigate: (route: string) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenFeaturesGuide: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentRoute,
  selectedPortalId,
  onNavigateHome,
  onSelectPortal,
  onNavigate,
  onOpenProfile,
  onOpenSettings,
  onOpenFeaturesGuide,
  mobileOpen,
  onCloseMobile,
}) => {
  const { language, isRTL } = useLanguage();
  const { userProfile, isAdmin } = useAuth();

  const isHomeActive = currentRoute === 'home' && !selectedPortalId;

  const portalMenuItems: Array<{
    id: PortalId;
    labelAr: string;
    labelEn: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'patient',
      labelAr: 'المريض',
      labelEn: 'Patient Portal',
      icon: <User size={18} />,
    },
    {
      id: 'doctor',
      labelAr: 'الطبيب',
      labelEn: 'Doctor Portal',
      icon: <Stethoscope size={18} />,
    },
    {
      id: 'pharmacy',
      labelAr: 'الصيدلية',
      labelEn: 'Pharmacy Portal',
      icon: <Pill size={18} />,
    },
    {
      id: 'laboratory',
      labelAr: 'المختبرات الطبية',
      labelEn: 'Medical Labs',
      icon: <FlaskConical size={18} />,
    },
    {
      id: 'radiology',
      labelAr: 'الأشعة والسونار',
      labelEn: 'Radiology & Scans',
      icon: <Scan size={18} />,
    },
    {
      id: 'wholesaler',
      labelAr: 'مجهزو الأدوية بالجملة',
      labelEn: 'Wholesale Warehouses',
      icon: <Truck size={18} />,
    },
    {
      id: 'secretary',
      labelAr: 'السكرتارية',
      labelEn: 'Secretary & Reception',
      icon: <Calendar size={18} />,
    },
    {
      id: 'super_admin',
      labelAr: 'الإدارة العليا',
      labelEn: 'Super Admin',
      icon: <ShieldCheck size={18} />,
    },
  ];

  const handlePortalClick = (id: PortalId) => {
    onSelectPortal(id);
    onCloseMobile();
  };

  const handleHomeClick = () => {
    onNavigateHome();
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 z-50 w-72 bg-[#001738] text-white flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out border-slate-800 ${
          isRTL ? 'right-0 border-l' : 'left-0 border-r'
        } ${
          mobileOpen 
            ? 'translate-x-0' 
            : isRTL 
              ? 'translate-x-full lg:translate-x-0' 
              : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header with Brand Logo */}
        <div className="p-5 pb-4 border-b border-slate-800/80 flex items-center justify-between">
          <button
            onClick={handleHomeClick}
            className="flex items-center gap-3 text-start group cursor-pointer focus:outline-hidden"
          >
            {/* Custom Aviation + ECG Flight Mark */}
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#002b5c] p-2 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 100 80" className="w-full h-full" fill="none">
                <path
                  d="M 10 58 C 24 22, 54 14, 84 16"
                  stroke="#38bdf8"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <g transform="translate(82, 16) rotate(16)">
                  <path
                    d="M 0 -8 L 5 -2 L 13 -2 L 16 -5 L 17 -5 L 15 0 L 17 5 L 16 5 L 13 2 L 5 2 L 0 8 L -3 8 L 0 2 L -9 2 L -13 6 L -15 6 L -14 0 L -15 -6 L -13 -6 L -9 -2 L 0 -2 Z"
                    fill="#38bdf8"
                  />
                </g>
                <path
                  d="M 6 52 L 18 52 L 23 42 L 28 62 L 35 30 L 42 66 L 48 46 L 53 54 L 58 52 L 70 52"
                  stroke="#ef4444"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <div className="flex items-baseline gap-1 font-black text-2xl tracking-tight leading-none text-white">
                <span>M737</span>
                <span className="text-[#38bdf8]">IQ</span>
              </div>
              <span className="text-[10px] font-medium text-slate-300 tracking-wider block mt-1">
                Your Health, Our Priority
              </span>
            </div>
          </button>

          {/* Close button for mobile */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {/* Main Navigation */}
          <div className="space-y-1">
            {/* 1. الرئيسية (Home) */}
            <button
              onClick={handleHomeClick}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                isHomeActive
                  ? 'bg-[#1a56db] text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Home size={18} className={isHomeActive ? 'text-white' : 'text-slate-400'} />
                <span>{language === 'ar' ? 'الرئيسية' : 'Home'}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
            </button>

            {/* Portals List (Exact matching to screenshot) */}
            {portalMenuItems.map((item) => {
              const isSelected = selectedPortalId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handlePortalClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all group cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/30 text-sky-300 font-bold border border-blue-500/40'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 transition-colors ${isSelected ? 'text-sky-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </span>
                  </div>

                  <span className="text-slate-500 group-hover:text-slate-300 text-xs">
                    {isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/90 pt-4 space-y-1">
            {/* Features Guide */}
            <button
              onClick={() => {
                onOpenFeaturesGuide();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all cursor-pointer"
            >
              <FileText size={17} className="text-slate-400" />
              <span>{language === 'ar' ? 'دليل ميزات M737IQ' : 'M737IQ Features Guide'}</span>
            </button>

            {/* Profile */}
            <button
              onClick={() => {
                onOpenProfile();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all cursor-pointer"
            >
              <User size={17} className="text-slate-400" />
              <span>{language === 'ar' ? 'الملف الشخصي' : 'My Profile'}</span>
            </button>

            {/* Settings */}
            <button
              onClick={() => {
                onOpenSettings();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all cursor-pointer"
            >
              <Settings size={17} className="text-slate-400" />
              <span>{language === 'ar' ? 'الإعدادات' : 'Settings'}</span>
            </button>

            {/* Support */}
            <button
              onClick={() => {
                onNavigate('support');
                onCloseMobile();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800/70 hover:text-white transition-all cursor-pointer"
            >
              <Headphones size={17} className="text-slate-400" />
              <span>{language === 'ar' ? 'الدعم والمساعدة' : 'Support & Help'}</span>
            </button>
          </div>
        </div>

        {/* Bottom WhatsApp Contact Box & Version */}
        <div className="p-3.5 border-t border-slate-800/80 bg-[#00132e]/90 space-y-2">
          <a
            href="https://wa.me/9647885663748"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700/60 hover:border-emerald-500/50 transition-all text-white group cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <MessageCircle size={18} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-slate-300 block leading-tight">
                  {language === 'ar' ? 'تواصل معنا' : 'Contact Support'}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
                  07885663748
                </span>
              </div>
            </div>
            <ExternalLink size={13} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </a>

          <div className="text-center text-[10px] text-slate-400 font-mono tracking-wider">
            M737IQ v1.0.1
          </div>
        </div>
      </aside>
    </>
  );
};
