import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Plane, 
  ShieldCheck, 
  HeartPulse, 
  Building2, 
  CheckCircle2, 
  Home, 
  ArrowLeft, 
  ArrowRight, 
  ChevronRight, 
  ChevronLeft,
  Users,
  Award,
  Stethoscope,
  Activity,
  Layers,
  Sparkles,
  PhoneCall
} from 'lucide-react';

interface AboutUsPageProps {
  onNavigateHome: () => void;
  onNavigatePortals: () => void;
  onNavigateSupport: () => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({
  onNavigateHome,
  onNavigatePortals,
  onNavigateSupport,
}) => {
  const { t, isRTL, language } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20">
      {/* Top Breadcrumb Navigation */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 sm:mb-8">
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
            {language === 'ar' ? 'من نحن (رؤية ورسالة المنصة)' : 'About M737IQ Platform'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Hero Section */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#00172e] via-[#003366] to-[#0a192f] p-8 sm:p-14 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-bold border border-white/20">
              <Plane size={14} />
              <span>{language === 'ar' ? 'الانضباط التشغيلي والرعاية المتقدمة' : 'Precision Aviation in Modern Healthcare'}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              {language === 'ar' ? 'منصة M737 الطبية الرقمية المتكاملة في العراق' : 'M737IQ Integrated Digital Healthcare Ecosystem'}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed pt-2">
              {language === 'ar'
                ? 'مشروع وطني يهدف إلى إعادة هيكلة التواصل السريري واللوجستي بين الأطباء، والمختبرات المرضية، ومراكز الأشعة، والصيدليات، ومذاخر الأدوية لخدمة المريض العراقي بأعلى درجات الدقة والسرعة.'
                : 'A nationwide Iraqi initiative uniting doctors, diagnostic laboratories, radiology centers, retail pharmacies, and wholesale bureaus to deliver transparent, synchronized care for citizens.'}
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={onNavigatePortals}
                className="px-6 py-3 rounded-xl text-xs sm:text-sm font-bold text-white brand-gradient-btn shadow-md hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>{language === 'ar' ? 'استعراض البوابات الطبية' : 'Explore Medical Portals'}</span>
                {isRTL ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>

              <button
                onClick={onNavigateSupport}
                className="px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <PhoneCall size={15} />
                <span>{language === 'ar' ? 'تواصل مع فريق الدعم' : 'Contact Support'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Why M737 Aviation Motif Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-sm grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-8 space-y-4">
            <span className="text-xs font-bold text-[#c4152e] uppercase tracking-wider block">
              {language === 'ar' ? 'فلسفة التسمية والهوية' : 'Origin of the M737 Identity'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {language === 'ar' ? 'لماذا طراز M737 رمزاً لمشروعنا الصحي؟' : 'Why M737 as our Healthcare Symbol?'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'في عالم الطيران، لا يُسمح بأي هامش للخطأ العشوائي، حيث تحكم كل رحلة قوائم فحص بروتوكولية دقيقة وتنسيق لاسلكي فوري. هذه الروح ذاتها هي ما يحتاجه القطاع الصحي في العراق: نتائج تحاليل خالية من اللبس، صور أشعة تشخيصية تصل فوراً، وصرف دوائي مدقق يمنع التداخلات والجرعات الخاطئة.'
                : 'In civil aviation, passenger safety is guaranteed by systematic checklists and flawless real-time communication. M737IQ transplants this rigorous operational ethos into Iraqi healthcare: error-free lab diagnostics, instantaneous medical image relay, and strictly validated prescription fulfillment.'}
            </p>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'شعارنا الدائم: "معاً... لمستقبل صحي أفضل"، مستندين إلى كوادرنا الطبية الوطنية وكفاءاتنا العلمية المنتشرة في بغداد وكافة المحافظات.'
                : 'Our motto: "Together for a Healthier Future", grounded in certified Iraqi doctors, pharmacists, pathologists, and radiologists nationwide.'}
            </p>
          </div>

          <div className="lg:col-span-4 bg-slate-900 text-white rounded-2xl p-6 space-y-4">
            <div className="text-xs font-bold text-sky-400 uppercase tracking-widest">
              {language === 'ar' ? 'ركائز الانضباط' : 'Core Disciplines'}
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{language === 'ar' ? 'قوائم فحص طبية قبل إرسال الوصفات' : 'Systematic checklist audits before prescription dispatch'}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{language === 'ar' ? 'تتبع فوري لأوقات استلام العينات ونتائج المختبر' : 'Real-time turnaround metrics on lab specimens'}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{language === 'ar' ? 'شهادات نقابية موثقة لجميع المنشآت والعيادات' : 'Verified syndicate registration for all providers'}</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{language === 'ar' ? 'رقابة فدرالية لحماية بيانات المرضى' : 'Encrypted patient privacy and sovereign data storage'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mission and Vision Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-[#003366] flex items-center justify-center font-black text-xl mb-4">
              🎯
            </div>
            <h3 className="font-extrabold text-xl text-slate-900">
              {language === 'ar' ? 'رسالتنا (Our Mission)' : 'Our Mission'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'تمكين المريض العراقي من الوصول إلى الرعاية الصحية الموثوقة دون عناء الانتظار العشوائي، وتزويد الأطباء والمرافق التشخيصية بحلول رقمية ترفع الكفاءة التشغيلية وتحد من الأخطاء الورقية والتداخلات الدوائية.'
                : 'Empowering Iraqi citizens with accessible, high-trust healthcare without disorganized waiting queues, while providing clinical facilities with secure digital workflows that eliminate paper errors.'}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-[#c4152e] flex items-center justify-center font-black text-xl mb-4">
              👁️
            </div>
            <h3 className="font-extrabold text-xl text-slate-900">
              {language === 'ar' ? 'رؤيتنا (Our Vision)' : 'Our Vision'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'أن تكون M737IQ البنية التحتية الرقمية الرائدة في العراق، محققة التكامل التام بين القطاعين العام والخاص، وواضعة معياراً عربياً وإقليمياً في أمان البيانات الصحية وانضباط سلاسل التوريد الدوائية.'
                : 'To become the benchmark digital healthcare infrastructure in Iraq, fostering seamless collaboration between healthcare providers and setting the standard for clinical data security.'}
            </p>
          </div>
        </div>

        {/* Core Values Strip */}
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h3 className="font-extrabold text-xl text-slate-900">
              {language === 'ar' ? 'قيمنا الجوهرية' : 'Our Core Values'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'ar' ? 'مبادئ راسخة تحكم كل ميزة وقرار برمجى في المنصة' : 'Principles guiding every feature and operational decision'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl">🛡️</span>
              <h4 className="font-bold text-sm text-slate-900">{language === 'ar' ? 'سلامة المريض أولاً' : 'Patient Safety First'}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ar' ? 'كل فحص ووصفة تمر عبر إجراءات تحقق لمنع الأخطاء.' : 'Every prescription and diagnostic report undergoes rigorous verification.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl">🔒</span>
              <h4 className="font-bold text-sm text-slate-900">{language === 'ar' ? 'سرية وخصوصية البيانات' : 'Data Privacy'}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ar' ? 'السجلات الطبية ملك حصري للمريض ولا تُشارك إلا بإذنه.' : 'Medical records are private patient assets, shielded by granular RBAC.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl">⚡</span>
              <h4 className="font-bold text-sm text-slate-900">{language === 'ar' ? 'السرعة والربط اللحظي' : 'Real-Time Sync'}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ar' ? 'انتقال فوري لنتائج الفحوصات بين المختبر والعيادة والمريض.' : 'Instantaneous diagnostic report synchronization across all care touchpoints.'}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <span className="text-xl">⚖️</span>
              <h4 className="font-bold text-sm text-slate-900">{language === 'ar' ? 'النزاهة والشفافية' : 'Integrity & Ethics'}</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {language === 'ar' ? 'أسعار دوائية رسمية بالدينار وتدقيق دوري للرخص النقابية.' : 'Transparent official drug prices in IQD and verified practitioner credentials.'}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Navigation CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-slate-100 border border-slate-200">
          <div className="text-xs text-slate-600">
            {language === 'ar'
              ? 'جاهز للاستفادة من خدمات المنصة؟ توجه إلى بوابات الأطباء والصيدليات والمختبرات.'
              : 'Ready to experience M737IQ? Access your dedicated provider or patient portal.'}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onNavigateHome}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-colors cursor-pointer"
            >
              {language === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
            </button>

            <button
              onClick={onNavigatePortals}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-slate-900 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>{language === 'ar' ? 'استعراض البوابات' : 'Open Portals'}</span>
              {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
