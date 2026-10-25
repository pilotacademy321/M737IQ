import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types';
import { 
  ShieldAlert, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  Sparkles, 
  Stethoscope, 
  FlaskConical, 
  Scan, 
  Pill, 
  Users, 
  Building2,
  ShieldCheck, 
  User as UserIcon,
  HelpCircle,
  LogIn,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface AuthDomainGuideModalProps {
  onSelectPortal?: (portalId: any) => void;
}

export const AuthDomainGuideModal: React.FC<AuthDomainGuideModalProps> = ({ onSelectPortal }) => {
  const { 
    showDomainHelp, 
    setShowDomainHelp, 
    currentHostname, 
    firebaseProjectId, 
    signInAsDemoUser,
    signInWithGoogle,
    loading 
  } = useAuth();
  const { language, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!showDomainHelp) return null;

  const handleCopyDomain = async () => {
    try {
      if (navigator.clipboard && currentHostname) {
        await navigator.clipboard.writeText(currentHostname);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSelectDemoRole = async (role: UserRole) => {
    await signInAsDemoUser(role);
    setShowDomainHelp(false);

    // Map role to portal ID if callback provided
    const roleToPortalMap: Record<UserRole, string> = {
      doctor: 'doctor',
      radiology_center: 'radiology',
      laboratory: 'laboratory',
      pharmacy: 'pharmacy',
      wholesaler: 'wholesaler',
      patient: 'patient',
      super_admin: 'super_admin',
      secretary: 'secretary',
    };

    if (onSelectPortal && roleToPortalMap[role]) {
      onSelectPortal(roleToPortalMap[role]);
    }
  };

  const consoleSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

  const demoRoles = [
    {
      role: 'super_admin' as UserRole,
      titleAr: 'المدير العام المعتمد',
      titleEn: 'Super Administrator',
      descAr: 'حساب bcgmoc@gmail.com بكامل صلاحيات الاعتماد ومراجعة التراخيص وخطط الاشتراكات',
      descEn: 'Full access for bcgmoc@gmail.com to approve licenses & manage subscriptions',
      icon: ShieldCheck,
      color: 'bg-red-600',
      badgeAr: 'المدير العام المعتمد',
      badgeEn: 'Full Admin',
    },
    {
      role: 'doctor' as UserRole,
      titleAr: 'طبيب استشاري',
      titleEn: 'Consultant Doctor',
      descAr: 'د. أحمد الرافدين - إدارة المواعيد، السجلات الطبية، والوصفات السريرية',
      descEn: 'Dr. Ahmed - Appointment scheduling, EMR, clinical prescriptions',
      icon: Stethoscope,
      color: 'bg-[#003366]',
      badgeAr: 'طبيب معتمد',
      badgeEn: 'Certified Doctor',
    },
    {
      role: 'laboratory' as UserRole,
      titleAr: 'مختبر التحليلات المرضية',
      titleEn: 'Clinical Laboratory',
      descAr: 'مختبر بغداد المركزي - طلبات الفحوصات والباركود وإصدار النتائج الرسمية',
      descEn: 'Baghdad Lab - Test orders, barcode processing, certified reports',
      icon: FlaskConical,
      color: 'bg-emerald-600',
      badgeAr: 'مختبر سريري',
      badgeEn: 'Clinical Lab',
    },
    {
      role: 'radiology_center' as UserRole,
      titleAr: 'مركز الأشعة والتصوير',
      titleEn: 'Radiology Center',
      descAr: 'مركز دجلة التخصصي - جدولة المفراس والرنين وتقارير التشخيص الإشعاعي',
      descEn: 'Dijla Imaging - CT/MRI scheduling and digital radiological reports',
      icon: Scan,
      color: 'bg-indigo-600',
      badgeAr: 'مركز تصوير',
      badgeEn: 'Imaging Center',
    },
    {
      role: 'pharmacy' as UserRole,
      titleAr: 'صيدلية معتمدة',
      titleEn: 'Certified Pharmacy',
      descAr: 'صيدلية الأمل المركزية - صرف الوصفات والتحقق من التداخلات الدوائية',
      descEn: 'Al-Amal Pharmacy - Prescription dispensing and drug verification',
      icon: Pill,
      color: 'bg-teal-600',
      badgeAr: 'صيدلية مرخصة',
      badgeEn: 'Licensed Pharmacy',
    },
    {
      role: 'wholesaler' as UserRole,
      titleAr: 'مذخر ومكتب علمي',
      titleEn: 'Pharmaceutical Wholesaler',
      descAr: 'مذخر سامراء العلمي - توريد الأدوية والمستلزمات الطبية بالجملة للصيدليات',
      descEn: 'Samarra Drug Warehouse - B2B pharmaceutical catalog & wholesale orders',
      icon: Building2,
      color: 'bg-emerald-700',
      badgeAr: 'مكتب علمي معتمد',
      badgeEn: 'Drug Warehouse',
    },
    {
      role: 'secretary' as UserRole,
      titleAr: 'سكرتارية واستقبال العيادة',
      titleEn: 'Clinic Secretary',
      descAr: 'استقبال المرضى وتنظيم طابور الانتظار وتثبيت المواعيد اليومية',
      descEn: 'Patient reception, queue check-in, daily appointments',
      icon: Users,
      color: 'bg-amber-600',
      badgeAr: 'استقبال العيادة',
      badgeEn: 'Clinic Desk',
    },
    {
      role: 'patient' as UserRole,
      titleAr: 'مريض مسجل',
      titleEn: 'Registered Patient',
      descAr: 'سارة العراقي - حجز المواعيد والاطلاع على الفحوصات والوصفات الطبية',
      descEn: 'Sara Al-Iraqi - Booking visits, viewing test results & prescriptions',
      icon: UserIcon,
      color: 'bg-sky-600',
      badgeAr: 'مريض معتمد',
      badgeEn: 'Patient',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-[#003366] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {language === 'ar' ? 'تصريح نطاق Firebase أو الدخول السريع للتجربة' : 'Authorize Firebase Domain or Quick Demo'}
              </h2>
              <p className="text-xs text-slate-300">
                {language === 'ar' ? 'حل خطأ (auth/unauthorized-domain) وخيارات المعاينة' : 'Fix (auth/unauthorized-domain) error & preview options'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDomainHelp(false)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title={language === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-slate-800 text-sm">
          {/* Explanation Box */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm leading-relaxed space-y-2">
            <div className="font-bold flex items-center gap-2 text-amber-800">
              <HelpCircle size={18} />
              <span>
                {language === 'ar' ? 'لماذا ظهر خطأ (auth/unauthorized-domain)؟' : 'Why did (auth/unauthorized-domain) happen?'}
              </span>
            </div>
            <p>
              {language === 'ar'
                ? 'تقوم خدمة Firebase Authentication بمنع تسجيل الدخول عبر Google من أي نطاق سحابي غير مسجل في قائمة النطاقات المعتمدة (Authorized Domains) بمشروعك لحماية الأمان.'
                : 'Firebase Authentication restricts Google Sign-In popups to domains explicitly registered in your Firebase project\'s Authorized Domains list.'}
            </p>
          </div>

          {/* Section 1: Domain Authorization Instructions */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600">
                {language === 'ar' ? '1. نطاق المعاينة المطلوب تصريحه:' : '1. Preview domain to authorize:'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Project: {firebaseProjectId}
              </span>
            </div>

            {/* Current Hostname Display + Copy Button */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-300 shadow-inner font-mono text-xs text-slate-800 break-all select-all">
              <span className="flex-1 overflow-x-auto">{currentHostname || 'localhost'}</span>
              <button
                type="button"
                onClick={handleCopyDomain}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  copied 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#003366] text-white hover:bg-[#002244]'
                }`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') : (language === 'ar' ? 'نسخ النطاق' : 'Copy')}</span>
              </button>
            </div>

            {/* Steps */}
            <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside pr-1 pt-1 leading-relaxed">
              <li>
                {language === 'ar'
                  ? 'افتح إعدادات مصادقة Firebase بالضغط على الزر أدناه:'
                  : 'Open Firebase Authentication Settings by clicking below:'}
              </li>
              <li className="font-semibold text-slate-800">
                {language === 'ar'
                  ? 'في تبويب Settings، مرر إلى قسم Authorized domains واضغط على Add domain.'
                  : 'Under Settings tab, scroll to Authorized domains and click "Add domain".'}
              </li>
              <li>
                {language === 'ar'
                  ? 'الصق النطاق المنسوخ أعلاه واضغط Save (حفظ).'
                  : 'Paste the copied domain above and click Save.'}
              </li>
            </ol>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={consoleSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#002244] shadow-sm transition-all"
              >
                <span>{language === 'ar' ? 'فتح إعدادات Firebase Console' : 'Open Firebase Console Settings'}</span>
                <ExternalLink size={14} />
              </a>

              <button
                type="button"
                disabled={loading}
                onClick={signInWithGoogle}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <LogIn size={14} />
                <span>{language === 'ar' ? 'إعادة المحاولة عبر Google' : 'Retry Sign In'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Instant Sandbox / Demo Access */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-emerald-100 text-emerald-700">
                <Sparkles size={16} />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {language === 'ar' 
                  ? 'أو التجربة الفورية لجميع البوابات (Sandbox Demo Mode)' 
                  : 'Or Instant Preview for All 7 Portals (Sandbox Mode)'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'لا داعي لانتظار إعدادات النطاق الآن! يمكنك فوراً اختيار أي دور واختبار بيئات العمل بالكامل مع بيانات عراقية سريرية متكاملة:'
                : 'No need to wait for domain configuration! Select any role below to immediately test the workspaces with comprehensive Iraqi clinical mock data:'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              {demoRoles.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleSelectDemoRole(item.role)}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#003366] hover:bg-blue-50/50 text-start flex items-start gap-3 transition-all cursor-pointer group shadow-xs hover:shadow-sm"
                  >
                    <div className={`w-9 h-9 rounded-xl ${item.color} text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                      <IconComponent size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-xs text-slate-900 group-hover:text-[#003366]">
                          {language === 'ar' ? item.titleAr : item.titleEn}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {language === 'ar' ? item.badgeAr : item.badgeEn}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {language === 'ar' ? item.descAr : item.descEn}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {language === 'ar' ? 'منصة M737 الطبية العراقية المعتمدة' : 'M737 Iraqi Certified Medical Platform'}
          </span>
          <button
            type="button"
            onClick={() => setShowDomainHelp(false)}
            className="px-4 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق النافذة' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
