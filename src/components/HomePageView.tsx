import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { HeroSection } from './HeroSection';
import { PortalId } from '../types';
import { PORTALS_DATA } from '../data/portalsData';
import { 
  Plane, 
  ShieldCheck, 
  Activity, 
  Building2, 
  Users, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  Stethoscope, 
  Scan, 
  FlaskConical, 
  Pill, 
  User, 
  Clock, 
  Lock, 
  Sparkles,
  PhoneCall,
  HelpCircle,
  FileText
} from 'lucide-react';

interface HomePageViewProps {
  onNavigate: (route: string) => void;
  onSelectPortal: (portalId: PortalId) => void;
}

export const HomePageView: React.FC<HomePageViewProps> = ({
  onNavigate,
  onSelectPortal,
}) => {
  const { t, isRTL, language } = useLanguage();

  const getPortalIcon = (iconName: string, size = 20) => {
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
        return <Activity size={size} />;
    }
  };

  return (
    <div className="space-y-0">
      {/* 1. Hero Section with Prominent START and Action Buttons */}
      <HeroSection
        onExplorePortals={() => onNavigate('portals')}
        onNavigate={onNavigate}
      />

      {/* 2. Direct Portal Quick-Jump Strip */}
      <section className="bg-white border-b border-slate-200 py-6 sm:py-8 shadow-xs relative z-20 -mt-8 sm:-mt-10 max-w-6xl mx-auto px-4 sm:px-6 rounded-2xl border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c4152e]" />
              <span>{language === 'ar' ? 'الوصول المباشر إلى بوابات المنظومة الطبية' : 'Quick Access to M737IQ Medical Portals'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {language === 'ar'
                ? '٨ بوابات متخصصة ومستقلة تعمل بتناغم كامل لخدمة المرضى والكوادر الطبية في العراق.'
                : '8 specialized, independent portals operating in real-time coordination.'}
            </p>
          </div>

          <button
            onClick={() => onNavigate('portals')}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-slate-900 transition-all flex items-center gap-2 shrink-0 cursor-pointer shadow-xs"
          >
            <span>{language === 'ar' ? 'استعراض كافة البوابات' : 'Explore All Portals'}</span>
            {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
          </button>
        </div>

        {/* 8 Quick Portal Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {PORTALS_DATA.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPortal(p.id)}
              className="p-3 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-white transition-all flex flex-col items-center text-center group cursor-pointer"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white mb-2 shadow-xs group-hover:scale-110 transition-transform"
                style={{ backgroundColor: p.accentColor }}
              >
                {getPortalIcon(p.iconName, 18)}
              </div>
              <span className="text-[11px] font-bold text-slate-900 line-clamp-1 group-hover:text-[#003366]">
                {language === 'ar' ? p.titleAr.replace('بوابة ', '') : p.titleEn.replace(' Portal', '')}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Three Precision Healthcare Pillars */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-xs font-bold text-[#003366] uppercase tracking-wider block mb-2">
              {language === 'ar' ? 'معايير الطيران والطب المتكامل' : 'Aviation Discipline in Healthcare'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {language === 'ar'
                ? 'لماذا تعتمد منصة M737IQ نهج الدقة والانضباط؟'
                : 'Why M737IQ Delivers Aviation-Grade Healthcare'}
            </h2>
            <p className="mt-3 text-xs sm:text-sm text-slate-600 leading-relaxed text-balance">
              {language === 'ar'
                ? 'نظام طبي رقمي يعتمد على لوائح التحقق الصارمة، منع الأخطاء الدوائية، والربط الفوري بين العيادات والمختبرات والمستودعات.'
                : 'A unified healthcare architecture built on strict procedural checklists, zero-error prescription dispensing, and verified clinical networks.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Pillar 1 */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#003366] flex items-center justify-center mb-5">
                  <Plane size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">
                  {language === 'ar' ? 'انضباط تشغيلي بقوائم فحص دقيقة' : 'Checklist-Driven Clinical Safety'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'تماماً كإجراءات الطيران الآمنة، تخضع الوصفات الطبية، نتائج التحاليل، وتقارير الأشعة لقوائم تدقيق تمنع التداخل الدوائي والأخطاء التشخيصية.'
                    : 'Inspired by flight safety protocols, diagnostic findings and prescriptions undergo automated checks to eliminate clinical oversights.'}
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-sky-800">
                <CheckCircle2 size={16} className="text-sky-600 shrink-0" />
                <span>{language === 'ar' ? 'صفر تسامح مع الأخطاء' : 'Zero-error tolerance standard'}</span>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#c4152e] flex items-center justify-center mb-5">
                  <Building2 size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">
                  {language === 'ar' ? 'سلسلة إمداد دوائية معتمدة 100%' : '100% Accredited Supply Chain'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'ربط مباشر وموثوق بين الصيدليات الأهلية والمكاتب العلمية ومذاخر الأدوية المرخصة من نقابة صيادلة العراق ووزارة الصحة.'
                    : 'Direct B2B supply pipeline connecting retail pharmacies with certified pharmaceutical warehouses and scientific bureaus across Iraq.'}
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-red-800">
                <CheckCircle2 size={16} className="text-[#c4152e] shrink-0" />
                <span>{language === 'ar' ? 'تتبع أرقام الوجبات والصلاحيات' : 'Batch tracking & expiry control'}</span>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-5">
                  <Lock size={24} />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">
                  {language === 'ar' ? 'خصوصية وحماية السجلات الطبية' : 'Encrypted Medical Health Passport'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {language === 'ar'
                    ? 'سجلات صحية مشفرة بالكامل، تتيح للمريض التحكم في مشاركة تاريخه المرضي وفحوصاته فقط مع الطبيب المعالج والجهات المعتمدة.'
                    : 'Encrypted patient records, enabling citizens to maintain a portable health passport accessible only to authorized medical providers.'}
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{language === 'ar' ? 'أمان فدرالي معتمد' : 'Strict role-based privacy'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. High-Impact Call-to-Action to Open Portals or Learn More */}
      <section className="py-16 sm:py-20 bg-gradient-to-br from-[#00172e] via-[#003366] to-[#0a192f] text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-bold border border-white/20">
            <Sparkles size={14} />
            <span>{language === 'ar' ? 'ابدأ الآن باختيار بوابتك المخصصة' : 'Start Now — Select Your Portal'}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            {language === 'ar'
              ? 'بوابات متكاملة تغطي كافة قطاعات الرعاية الصحية'
              : 'Complete Healthcare Ecosystem for Iraqi Providers & Patients'}
          </h2>

          <p className="text-xs sm:text-base text-slate-200 max-w-2xl mx-auto leading-relaxed">
            {language === 'ar'
              ? 'انقر على زر البداية لفتح صفحة البوابات المعتمدة، أو تعرف على رؤيتنا وأهدافنا للقطاع الصحي العراقي.'
              : 'Click the START button to open the dedicated portal selection workspace, or learn more about our mission.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('portals')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl text-sm sm:text-base font-bold text-white brand-gradient-btn shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{language === 'ar' ? 'دخول صفحة البوابات المعتمدة' : 'Open Portal Selection Page'}</span>
              {isRTL ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
            </button>

            <button
              onClick={() => onNavigate('about')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileText size={16} />
              <span>{language === 'ar' ? 'تعرف على المنصة (من نحن)' : 'About M737IQ'}</span>
            </button>

            <button
              onClick={() => onNavigate('support')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <PhoneCall size={16} />
              <span>{language === 'ar' ? 'الدعم والمساعدة' : 'Support & Contact'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
