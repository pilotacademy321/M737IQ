import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { ShieldCheck, HeartPulse, Plane, CheckCircle2, Award, Building2 } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const { t, language } = useLanguage();

  return (
    <section id="about" className="py-20 md:py-28 bg-white relative overflow-hidden">
      {/* Subtle decorative background watermarks/patterns */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-sky-50 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Text Column */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-[#003366] uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-[#c4152e]" />
              <span>{t.about.kicker}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              {t.about.title}
            </h2>

            <p className="mt-4 text-base sm:text-lg font-semibold text-[#003366] leading-relaxed">
              {t.about.lead}
            </p>

            <div className="mt-6 space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed">
              <p>{t.about.p1}</p>
              <p>{t.about.p2}</p>
            </div>

            {/* Core Values Strip */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5">
              {t.about.values.map((val, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#c4152e] shrink-0" />
                    <span>{val.title}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {val.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Iraqi Healthcare Integration & Clinical Quality Graphic Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-gradient-to-br from-[#002244] via-[#003366] to-[#0a192f] p-8 text-white">
              {/* Background ambient lighting */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-6">
                  <HeartPulse size={24} className="text-emerald-300" />
                </div>

                <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest block mb-2">
                  {language === 'ar' ? 'تواصلك مع الطبيب أسهل' : 'Connecting with your doctor is easier'}
                </span>

                <h3 className="text-xl sm:text-2xl font-bold mb-4 leading-snug">
                  {language === 'ar'
                    ? 'رؤية منصة صحتك للرعاية المتكاملة'
                    : 'The Sehatok Vision for Integrated Healthcare'}
                </h3>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed mb-6">
                  {language === 'ar'
                    ? 'صممت منصة صحتك لتكون الجسر الرقمي الآمن والموثوق بين المريض والطبيب والصيدلية والمختبر ومركز الأشعة، حيث تلتقي سهولة الاستخدام مع أعلى معايير أمن وسرية البيانات الطبية.'
                    : 'Sehatok Platform was designed to serve as the secure, trusted digital bridge connecting patients, doctors, pharmacies, labs, and imaging centers — where seamless accessibility meets clinical security.'}
                </p>

                <div className="pt-6 border-t border-white/15 space-y-3">
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-100">
                    <ShieldCheck size={18} className="text-emerald-400 shrink-0" />
                    <span>{language === 'ar' ? 'اعتماد أعلى معايير أمان البيانات والخصوصية الطبية' : 'Highest medical data security & confidentiality'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-100">
                    <Building2 size={18} className="text-sky-400 shrink-0" />
                    <span>{language === 'ar' ? 'ربط العيادات والمختبرات والمراكز التخصصية في كافة المحافظات' : 'Connecting clinics, labs, and diagnostic centers nationwide'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-100">
                    <HeartPulse size={18} className="text-red-400 shrink-0" />
                    <span>{language === 'ar' ? 'التركيز على راحة المريض وسلامته كأولوية قصوى' : 'Patient comfort and well-being as the ultimate compass'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
