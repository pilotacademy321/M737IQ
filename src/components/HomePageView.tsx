import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { PortalId } from '../types';
import { 
  subscribeToLiveMetrics, 
  fetchRealDatabaseActivities, 
  PlatformMetrics, 
  RealActivityItem 
} from '../lib/platformMetrics';
import { 
  Calendar, 
  MessageCircle, 
  ArrowLeft, 
  ArrowRight, 
  Clock, 
  BarChart3, 
  Users, 
  FileText, 
  FlaskConical, 
  TrendingUp, 
  ShieldCheck, 
  Zap, 
  Share2, 
  CheckCircle2, 
  User, 
  Stethoscope, 
  Pill, 
  Scan, 
  Truck, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Inbox
} from 'lucide-react';

interface HomePageViewProps {
  onNavigate: (route: string) => void;
  onSelectPortal: (portalId: PortalId) => void;
}

// Organic count-up animation that smoothly climbs from 0 to the target number
function useCountUp(target: number, duration: number = 1800, startDelay: number = 100): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return;
    }

    let startTimestamp: number | null = null;
    let animFrame: number;

    const timeout = setTimeout(() => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Exponential ease out for smooth acceleration and gentle landing
        const easeOut = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setValue(Math.floor(easeOut * target));

        if (progress < 1) {
          animFrame = requestAnimationFrame(step);
        } else {
          setValue(target);
        }
      };

      animFrame = requestAnimationFrame(step);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(animFrame);
    };
  }, [target, duration, startDelay]);

  return value;
}

export const HomePageView: React.FC<HomePageViewProps> = ({
  onNavigate,
  onSelectPortal,
}) => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();

  // Purely authentic metrics: initialized strictly at ZERO (0) - No fake numbers
  const [realMetrics, setRealMetrics] = useState<PlatformMetrics>({
    appointmentsToday: 0,
    activeUsers: 0,
    diagnosticTests: 0,
    prescriptions: 0,
  });

  // Purely authentic activities: initialized as empty list - No fake activities
  const [activities, setActivities] = useState<RealActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);

  // Animated ascending numbers (counts up from 0 to authentic count)
  const animatedAppointments = useCountUp(realMetrics.appointmentsToday, 1600, 100);
  const animatedUsers = useCountUp(realMetrics.activeUsers, 1800, 150);
  const animatedTests = useCountUp(realMetrics.diagnosticTests, 1600, 200);
  const animatedPrescriptions = useCountUp(realMetrics.prescriptions, 1800, 250);

  // Subscribe to live Firestore metrics
  useEffect(() => {
    const unsubscribe = subscribeToLiveMetrics((updatedMetrics) => {
      setRealMetrics(updatedMetrics);
    });

    return () => unsubscribe();
  }, []);

  // Fetch real activities on mount and whenever user authentication changes
  useEffect(() => {
    let isMounted = true;
    const loadActivities = async () => {
      setIsLoadingActivities(true);
      try {
        const liveItems = await fetchRealDatabaseActivities();
        if (isMounted) {
          setActivities(liveItems);
        }
      } catch (err) {
        console.warn('Real activities fetch skipped:', err);
      } finally {
        if (isMounted) {
          setIsLoadingActivities(false);
        }
      }
    };

    loadActivities();
    return () => { isMounted = false; };
  }, [user]);

  // The 8 Portal Cards in exact RTL order as requested in the mockup
  const portalCards: Array<{
    id: PortalId;
    titleAr: string;
    titleEn: string;
    subtitleAr: string;
    subtitleEn: string;
    accentColor: string;
    hoverColor: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'patient',
      titleAr: 'المريض',
      titleEn: 'Patient',
      subtitleAr: 'حجوزاتك وملفي وتقاريرك',
      subtitleEn: 'Bookings, records & tests',
      accentColor: 'bg-[#00a0b0]', // Cyan
      hoverColor: 'hover:bg-[#008c9a]',
      icon: <User size={26} className="text-white" />,
    },
    {
      id: 'doctor',
      titleAr: 'الطبيب',
      titleEn: 'Doctor',
      subtitleAr: 'متابعة المرضى والحجوزات',
      subtitleEn: 'Patient follow-up & slots',
      accentColor: 'bg-[#2563eb]', // Blue
      hoverColor: 'hover:bg-[#1d4ed8]',
      icon: <Stethoscope size={26} className="text-white" />,
    },
    {
      id: 'pharmacy',
      titleAr: 'الصيدلية',
      titleEn: 'Pharmacy',
      subtitleAr: 'صرف الأدوية وإدارة المخزون',
      subtitleEn: 'Prescriptions & inventory',
      accentColor: 'bg-[#10b981]', // Green / Emerald
      hoverColor: 'hover:bg-[#059669]',
      icon: <Pill size={26} className="text-white" />,
    },
    {
      id: 'laboratory',
      titleAr: 'المختبرات الطبية',
      titleEn: 'Medical Labs',
      subtitleAr: 'الفحوصات والتحاليل وإصدار النتائج',
      subtitleEn: 'Pathology & certified tests',
      accentColor: 'bg-[#f43f5e]', // Rose / Pink
      hoverColor: 'hover:bg-[#e11d48]',
      icon: <FlaskConical size={26} className="text-white" />,
    },
    {
      id: 'radiology',
      titleAr: 'الأشعة والسونار',
      titleEn: 'Radiology',
      subtitleAr: 'التصوير الطبي والتقارير المتخصصة',
      subtitleEn: 'Scans, imaging & findings',
      accentColor: 'bg-[#06b6d4]', // Sky / Teal
      hoverColor: 'hover:bg-[#0891b2]',
      icon: <Scan size={26} className="text-white" />,
    },
    {
      id: 'wholesaler',
      titleAr: 'مجهزو الأدوية بالجملة',
      titleEn: 'Wholesalers',
      subtitleAr: 'توفير الأدوية والمستلزمات الصيدلانية',
      subtitleEn: 'B2B supply & batch orders',
      accentColor: 'bg-[#f59e0b]', // Warm Amber
      hoverColor: 'hover:bg-[#d97706]',
      icon: <Truck size={26} className="text-white" />,
    },
    {
      id: 'secretary',
      titleAr: 'السكرتارية',
      titleEn: 'Secretary',
      subtitleAr: 'تنظيم المواعيد والطلبات ودعم الفرق الطبية',
      subtitleEn: 'Reception triage & queue',
      accentColor: 'bg-[#8b5cf6]', // Purple / Violet
      hoverColor: 'hover:bg-[#7c3aed]',
      icon: <Users size={26} className="text-white" />,
    },
    {
      id: 'super_admin',
      titleAr: 'الإدارة العليا',
      titleEn: 'Super Admin',
      subtitleAr: 'إدارة شاملة ومتابعة جميع العمليات',
      subtitleEn: 'Central licensing & audit',
      accentColor: 'bg-[#0d9488]', // Teal
      hoverColor: 'hover:bg-[#0f766e]',
      icon: <Settings size={26} className="text-white" />,
    },
  ];

  const getActivityIcon = (category: string) => {
    switch (category) {
      case 'appointment':
        return <Calendar size={16} className="text-blue-600" />;
      case 'test':
        return <FlaskConical size={16} className="text-indigo-600" />;
      case 'supply':
        return <Truck size={16} className="text-amber-600" />;
      case 'prescription':
        return <FileText size={16} className="text-emerald-600" />;
      default:
        return <MessageCircle size={16} className="text-sky-600" />;
    }
  };

  const getActivityBg = (category: string) => {
    switch (category) {
      case 'appointment':
        return 'bg-blue-50';
      case 'test':
        return 'bg-indigo-50';
      case 'supply':
        return 'bg-amber-50';
      case 'prescription':
        return 'bg-emerald-50';
      default:
        return 'bg-sky-50';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. HERO BANNER: Iraqi National & Aviation VIP Medical Banner (M737IQ — منصة M737IQ الطبية) */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-700/60 bg-[#001738] group">
        {/* Responsive Banner Artwork Frame */}
        <div className="relative w-full aspect-[16/11] sm:aspect-[16/9] lg:aspect-[21/9] min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] overflow-hidden flex items-end">
          <img
            src="/assets/aistudio/file_0000000028548210b7a1ceb04b95422a_ba7a6257.png"
            alt="M737IQ — منصة M737IQ الطبية"
            className="absolute inset-0 w-full h-full object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.01]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/assets/images/m737_vip_hero_banner.png';
            }}
          />

          {/* Top VIP Title Badge displaying exact platform name */}
          <div className="absolute top-3 sm:top-5 start-3 sm:start-5 z-20 flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-slate-950/80 backdrop-blur-md border border-amber-400/40 text-white shadow-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xs sm:text-sm md:text-base font-extrabold tracking-wide flex items-center gap-2">
              <span className="text-amber-300 font-black">M737IQ</span>
              <span className="text-white/60">—</span>
              <span className="text-white">منصة M737IQ الطبية</span>
            </h1>
          </div>

          {/* Bottom Floating Action Bar for Buttons (احجز عيادتك & تواصل معنا) */}
          <div className="relative z-20 w-full p-3 sm:p-4 m-2.5 sm:m-4 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-white/15 shadow-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-white">
              <span className="text-xs sm:text-sm font-bold text-amber-300">
                {language === 'ar' ? 'صحتك .. أولويتنا' : 'Your Health .. Our Priority'}
              </span>
              <span className="text-white/40 hidden sm:inline">•</span>
              <span className="text-xs sm:text-sm text-slate-200 hidden sm:inline font-medium">
                {language === 'ar' ? 'معاً .. نبني عراقاً أكثر صحة' : 'Together .. Building a Healthier Iraq'}
              </span>
            </div>

            {/* Action Buttons: احجز عيادتك & تواصل معنا */}
            <div className="flex items-center gap-2.5 ms-auto">
              {/* Primary Button: احجز عيادتك */}
              <button
                onClick={() => onSelectPortal('patient')}
                className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-[#002b5c] hover:from-sky-500 hover:to-[#001f42] text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group/btn"
              >
                <Calendar size={16} className="text-sky-300 group-hover/btn:scale-110 transition-transform" />
                <span>{language === 'ar' ? 'احجز عيادتك' : 'Book Your Clinic'}</span>
              </button>

              {/* WhatsApp Button: تواصل معنا */}
              <a
                href="https://wa.me/9647885663748"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer group/btn"
              >
                <MessageCircle size={16} className="text-white fill-white/20 group-hover/btn:scale-110 transition-transform" />
                <span>{language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 2. THE 8 COLORFUL PORTAL CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5">
        {portalCards.map((portal) => (
          <div
            key={portal.id}
            className={`${portal.accentColor} rounded-2xl p-4 text-white flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-200 min-h-[175px] group text-center relative overflow-hidden`}
          >
            {/* Top Icon in subtle circular badge */}
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                {portal.icon}
              </div>
            </div>

            {/* Title & Subtitle */}
            <div className="flex-1 flex flex-col justify-center">
              <h3 className="font-extrabold text-sm sm:text-base leading-snug drop-shadow-xs">
                {language === 'ar' ? portal.titleAr : portal.titleEn}
              </h3>
              <p className="text-[11px] text-white/90 font-medium mt-1 line-clamp-2 leading-tight">
                {language === 'ar' ? portal.subtitleAr : portal.subtitleEn}
              </p>
            </div>

            {/* Action Button: دخول */}
            <button
              onClick={() => onSelectPortal(portal.id)}
              className="mt-3 w-full py-1.5 px-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-xs font-bold text-xs text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/25"
            >
              <span>{language === 'ar' ? 'دخول' : 'Enter'}</span>
              <Sparkles size={12} className="opacity-90" />
            </button>
          </div>
        ))}
      </div>

      {/* 3. LOWER 3 PANELS: إحصائيات سريعة | أحدث النشاطات | صحتك .. أولويتنا */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Panel 1 (Left in RTL): إحصائيات سريعة (Starts at ZERO, Real Live Counters Only) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 size={19} className="text-blue-700" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {language === 'ar' ? 'إحصائيات سريعة' : 'Quick Statistics'}
                </h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {language === 'ar' ? 'بيانات حقيقية' : 'Real-time Live'}
              </span>
            </div>

            {/* 2x2 Grid with real animated count-up numbers */}
            <div className="grid grid-cols-2 gap-3">
              {/* Stat 1: عدد المواعيد اليوم */}
              <div 
                onClick={() => onSelectPortal('patient')}
                className="p-3.5 rounded-2xl bg-purple-50/70 hover:bg-purple-50 border border-purple-100 hover:border-purple-200 transition-all flex items-center justify-between cursor-pointer group"
                title={language === 'ar' ? 'حجوزات المواعيد الحقيقية المسجلة' : 'Real booked appointments'}
              >
                <div>
                  <span className="text-[11px] font-medium text-slate-600 block">
                    {language === 'ar' ? 'عدد المواعيد اليوم' : 'Appointments Today'}
                  </span>
                  {/* Ascending Count Up Number - Starts at 0 */}
                  <span className="text-xl font-black text-slate-900 block mt-0.5 font-mono tracking-tight group-hover:text-purple-700 transition-colors">
                    {animatedAppointments.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {realMetrics.appointmentsToday > 0 ? (language === 'ar' ? 'حجز مسجل' : 'Booked') : (language === 'ar' ? 'لا توجد حجوزات' : 'No bookings')}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Calendar size={18} />
                </div>
              </div>

              {/* Stat 2: عدد المستخدمين النشطين */}
              <div 
                onClick={() => onSelectPortal('super_admin')}
                className="p-3.5 rounded-2xl bg-blue-50/70 hover:bg-blue-50 border border-blue-100 hover:border-blue-200 transition-all flex items-center justify-between cursor-pointer group"
                title={language === 'ar' ? 'المستخدمون والكوادر المعتمدة الحقيقية' : 'Real registered active users'}
              >
                <div>
                  <span className="text-[11px] font-medium text-slate-600 block">
                    {language === 'ar' ? 'عدد المستخدمين النشطين' : 'Active Users'}
                  </span>
                  {/* Ascending Count Up Number - Starts at 0 */}
                  <span className="text-xl font-black text-slate-900 block mt-0.5 font-mono tracking-tight group-hover:text-blue-700 transition-colors">
                    {animatedUsers.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {realMetrics.activeUsers > 0 ? (language === 'ar' ? 'حساب مسجل' : 'Registered') : (language === 'ar' ? 'لا يوجد مستخدمون' : 'No users')}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Users size={18} />
                </div>
              </div>

              {/* Stat 3: التحاليل والفحوصات */}
              <div 
                onClick={() => onSelectPortal('laboratory')}
                className="p-3.5 rounded-2xl bg-rose-50/70 hover:bg-rose-50 border border-rose-100 hover:border-rose-200 transition-all flex items-center justify-between cursor-pointer group"
                title={language === 'ar' ? 'الفحوصات والتحاليل الحقيقية الصادرة' : 'Real lab and radiology tests'}
              >
                <div>
                  <span className="text-[11px] font-medium text-slate-600 block">
                    {language === 'ar' ? 'التحاليل والفحوصات' : 'Tests & Scans'}
                  </span>
                  {/* Ascending Count Up Number - Starts at 0 */}
                  <span className="text-xl font-black text-slate-900 block mt-0.5 font-mono tracking-tight group-hover:text-rose-700 transition-colors">
                    {animatedTests.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {realMetrics.diagnosticTests > 0 ? (language === 'ar' ? 'فحص منجز' : 'Completed') : (language === 'ar' ? 'لا توجد فحوصات' : 'No tests')}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FlaskConical size={18} />
                </div>
              </div>

              {/* Stat 4: الوصفات الإلكترونية */}
              <div 
                onClick={() => onSelectPortal('pharmacy')}
                className="p-3.5 rounded-2xl bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-100 hover:border-emerald-200 transition-all flex items-center justify-between cursor-pointer group"
                title={language === 'ar' ? 'الوصفات والطلبات الحقيقية' : 'Real prescriptions and pharmacy orders'}
              >
                <div>
                  <span className="text-[11px] font-medium text-slate-600 block">
                    {language === 'ar' ? 'الوصفات الإلكترونية' : 'e-Prescriptions'}
                  </span>
                  {/* Ascending Count Up Number - Starts at 0 */}
                  <span className="text-xl font-black text-slate-900 block mt-0.5 font-mono tracking-tight group-hover:text-emerald-700 transition-colors">
                    {animatedPrescriptions.toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {realMetrics.prescriptions > 0 ? (language === 'ar' ? 'وصفة معتمدة' : 'Dispensed') : (language === 'ar' ? 'لا توجد وصفات' : 'No prescriptions')}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <FileText size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span>{language === 'ar' ? 'إحصائيات فعلية 100% بدون أي أرقام وهمية' : '100% authentic counts without placeholder values'}</span>
            <span className="text-emerald-600 font-bold font-mono">Real-Time</span>
          </div>
        </div>

        {/* Panel 2 (Middle in RTL): أحدث النشاطات (Purely Real Activities) */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock size={19} className="text-blue-700" />
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  {language === 'ar' ? 'أحدث النشاطات' : 'Recent Activities'}
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {activities.length} {language === 'ar' ? 'نشاط مسجل' : 'activities'}
              </span>
            </div>

            {/* Activities List or Empty State */}
            {isLoadingActivities ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                {language === 'ar' ? 'جاري التحقق من النشاطات المسجلة...' : 'Checking real recorded activities...'}
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${getActivityBg(act.category)} flex items-center justify-center shrink-0`}>
                        {getActivityIcon(act.category)}
                      </div>
                      <span className="text-xs font-semibold text-slate-800 line-clamp-1">
                        {act.title}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap font-medium ps-2">
                      {act.timeFormatted}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* Clean Authentic Empty State - No fake activity fabricated */
              <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Inbox size={24} />
                </div>
                <h4 className="text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'لا توجد نشاطات مسجلة حتى الآن' : 'No recorded activities yet'}
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mb-3">
                  {language === 'ar'
                    ? 'ستظهر هنا تلقائياً الحجوزات والوصفات الطبية فور تسجيلها في المنظومة.'
                    : 'Real appointments, lab tests, and prescriptions will appear here live once booked.'}
                </p>
                <button
                  onClick={() => onSelectPortal('patient')}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'تسجيل أول حجز تجريبي' : 'Book First Appointment'}
                </button>
              </div>
            )}
          </div>

          {/* Bottom link: عرض جميع النشاطات */}
          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              onClick={() => onNavigate('portals')}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>{language === 'ar' ? 'استعراض كافة البوابات' : 'Explore All Portals'}</span>
              {isRTL ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
            </button>
          </div>
        </div>

        {/* Panel 3 (Right in RTL): صحتك .. أولويتنا */}
        <div className="relative rounded-3xl overflow-hidden shadow-sm border border-slate-200/90 min-h-[300px] flex flex-col justify-between text-white p-6 bg-slate-950">
          {/* Background night tower image */}
          <img
            src="/assets/images/baghdad_night_tower_1792964555970.jpg"
            alt="Baghdad Night Skyline & Tower"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-40 scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />

          {/* Rich navy gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#001738] via-[#001d4a]/85 to-transparent pointer-events-none" />

          {/* Top text */}
          <div className="relative z-10 text-center pt-2">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {language === 'ar' ? 'صحتك .. أولويتنا' : 'Your Health .. Our Priority'}
            </h3>
            <p className="text-xs sm:text-sm text-sky-200 font-medium mt-1">
              {language === 'ar'
                ? 'مع M737IQ .. كل خدماتك الصحية في مكان واحد'
                : 'With M737IQ .. All your health services in one unified space'}
            </p>
          </div>

          {/* 3 Value Pillars at bottom */}
          <div className="relative z-10 grid grid-cols-3 gap-2 pt-6">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center">
              <Share2 size={18} className="text-sky-300 mb-1.5" />
              <span className="text-[10px] sm:text-[11px] font-bold text-white leading-tight">
                {language === 'ar' ? 'ربط متكامل بين جميع الأبواب' : 'Unified Ecosystem'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center">
              <Zap size={18} className="text-amber-300 mb-1.5" />
              <span className="text-[10px] sm:text-[11px] font-bold text-white leading-tight">
                {language === 'ar' ? 'خدمات سريعة وسهلة' : 'Instant & Frictionless'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center flex flex-col items-center justify-center">
              <ShieldCheck size={18} className="text-emerald-300 mb-1.5" />
              <span className="text-[10px] sm:text-[11px] font-bold text-white leading-tight">
                {language === 'ar' ? 'أمان عالي لبياناتك' : 'Top Security'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
