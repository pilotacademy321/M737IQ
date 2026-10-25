import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { PORTALS_DATA } from '../data/portalsData';
import { PortalId } from '../types';
import { 
  Stethoscope, 
  Scan, 
  FlaskConical, 
  Pill, 
  User, 
  ShieldCheck, 
  Users, 
  Building2, 
  ArrowLeft, 
  ArrowRight, 
  Search, 
  Sparkles, 
  Home, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2,
  Lock,
  ExternalLink
} from 'lucide-react';

interface PortalsSelectionPageProps {
  onNavigateHome: () => void;
  onSelectPortal: (portalId: PortalId) => void;
}

export const PortalsSelectionPage: React.FC<PortalsSelectionPageProps> = ({
  onNavigateHome,
  onSelectPortal,
}) => {
  const { t, isRTL, language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'clinical' | 'diagnostic' | 'pharmacy' | 'public'>('all');

  const getPortalIcon = (iconName: string, size = 26) => {
    switch (iconName) {
      case 'doctor':
        return <Stethoscope size={size} />;
      case 'radiology':
        return <Scan size={size} />;
      case 'laboratory':
        return <FlaskConical size={size} />;
      case 'pharmacy':
        return <Pill size={size} />;
      case 'wholesaler':
        return <Building2 size={size} />;
      case 'patient':
        return <User size={size} />;
      case 'super_admin':
        return <ShieldCheck size={size} />;
      case 'secretary':
        return <Users size={size} />;
      default:
        return <Stethoscope size={size} />;
    }
  };

  const filteredPortals = PORTALS_DATA.filter((p) => {
    // Category match
    if (categoryFilter === 'clinical' && !['doctor', 'secretary'].includes(p.id)) return false;
    if (categoryFilter === 'diagnostic' && !['radiology', 'laboratory'].includes(p.id)) return false;
    if (categoryFilter === 'pharmacy' && !['pharmacy', 'wholesaler'].includes(p.id)) return false;
    if (categoryFilter === 'public' && !['patient', 'super_admin'].includes(p.id)) return false;

    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAr = p.titleAr.toLowerCase().includes(q) || p.descAr.toLowerCase().includes(q);
      const matchEn = p.titleEn.toLowerCase().includes(q) || p.descEn.toLowerCase().includes(q);
      return matchAr || matchEn;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-500 py-3 border-b border-slate-200">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1.5 text-slate-700 hover:text-[#003366] transition-colors cursor-pointer"
          >
            <Home size={15} />
            <span>{language === 'ar' ? 'الرئيسية' : 'Home'}</span>
          </button>
          <span>{isRTL ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}</span>
          <span className="text-[#003366] font-bold">
            {language === 'ar' ? 'بوابات المنظومة الطبية المعتمدة' : 'M737IQ Medical Portals'}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Page Hero Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-[#003366] text-xs font-bold mb-3">
            <Sparkles size={14} className="text-[#c4152e]" />
            <span>{language === 'ar' ? 'منظومة البوابات الرقمية المستقلة' : 'Eight Dedicated Clinical Portals'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {language === 'ar' ? 'اختر بوابتك التشغيلية المخصصة' : 'Select Your Specialized Medical Portal'}
          </h1>

          <p className="mt-3 text-xs sm:text-base text-slate-600 leading-relaxed text-balance">
            {language === 'ar'
              ? 'صممت كل بوابة كبيئة عمل متكاملة تلبي الاحتياجات المحددة لشركاء المنظومة الطبية في العراق، مع مصادقة موحدة وحماية متقدمة للبيانات.'
              : 'Each portal provides a specialized workspace tailored to specific clinical roles in Iraq, with unified authentication and strict syndicate verification.'}
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-slate-400 me-2 hidden sm:inline">
              {language === 'ar' ? 'التصنيف:' : 'Filter:'}
            </span>
            {[
              { id: 'all', labelAr: 'كافة البوابات (8)', labelEn: 'All Portals (8)' },
              { id: 'clinical', labelAr: 'العيادات والسكرتارية', labelEn: 'Clinics & Secretary' },
              { id: 'diagnostic', labelAr: 'الأشعة والمختبرات', labelEn: 'Labs & Imaging' },
              { id: 'pharmacy', labelAr: 'الصيدليات والمذاخر', labelEn: 'Pharmacies & Wholesalers' },
              { id: 'public', labelAr: 'المرضى والإدارة', labelEn: 'Patients & Admin' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                  categoryFilter === cat.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {language === 'ar' ? cat.labelAr : cat.labelEn}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search size={15} className="absolute top-3 start-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'ar' ? 'ابحث باسم البوابة أو التخصص...' : 'Search portal name or specialty...'}
              className="w-full ps-9 pe-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-[#003366]"
            />
          </div>
        </div>

        {/* 8 Portal Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPortals.map((portal) => (
            <div
              key={portal.id}
              className={`bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl border ${portal.borderColor} transition-all duration-300 flex flex-col justify-between group relative overflow-hidden`}
            >
              {/* Colored Accent Top Strip */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
                style={{ backgroundColor: portal.accentColor }}
              />

              <div>
                {/* Header: Icon & Titles */}
                <div className="flex items-start gap-4 mb-4">
                  <div
                    className="w-13 h-13 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0 transition-transform group-hover:scale-105"
                    style={{ backgroundColor: portal.accentColor }}
                  >
                    {getPortalIcon(portal.iconName, 26)}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#003366] transition-colors">
                      {language === 'ar' ? portal.titleAr : portal.titleEn}
                    </h3>
                    <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                      {language === 'ar' ? portal.titleEn : portal.titleAr}
                    </div>
                  </div>
                </div>

                {/* Subtitle Badge */}
                <div className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 mb-3">
                  {language === 'ar' ? portal.subtitleAr : portal.subtitleEn}
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  {language === 'ar' ? portal.descAr : portal.descEn}
                </p>

                {/* Core Operational Modules List */}
                <div className="space-y-1.5 mb-6 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1">
                    {language === 'ar' ? 'الوحدات الميدانية المعتمدة:' : 'Core Operational Modules:'}
                  </span>
                  {(language === 'ar' ? portal.plannedModulesAr : portal.plannedModulesEn)
                    .slice(0, 3)
                    .map((module, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-600">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: portal.accentColor }} />
                        <span className="line-clamp-1">{module}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Action Button: Open Portal */}
              <button
                onClick={() => onSelectPortal(portal.id)}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-md hover:brightness-105"
                style={{ backgroundColor: portal.accentColor }}
              >
                <span>{language === 'ar' ? 'دخول البوابة' : 'OPEN PORTAL'}</span>
                {isRTL ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          ))}
        </div>

        {/* Accreditation and Security Info Card */}
        <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-sky-50 via-white to-red-50/50 border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#003366] text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h4 className="font-bold text-base text-slate-900">
                {language === 'ar' ? 'اعتماد الكوادر والمنشآت الصحية في العراق' : 'Official Syndicate & Provider Accreditation'}
              </h4>
              <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                {language === 'ar'
                  ? 'يتطلب تفعيل صلاحيات الطبيب أو الصيدلية أو المختبر أو المذخر العلمي تدقيق رقم إجازة الممارسة النقابية من قبل الإدارة المركزية لحماية سلامة المرضى.'
                  : 'Professional accounts require Iraqi syndicate license validation by our central accreditation desk before clinical dispatch features are unlocked.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
