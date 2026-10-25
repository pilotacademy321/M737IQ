import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  Home, 
  ChevronRight, 
  ChevronLeft,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  Headphones,
  HelpCircle,
  FileCheck,
  Instagram
} from 'lucide-react';

interface SupportContactPageProps {
  onNavigateHome: () => void;
  onNavigatePortals: () => void;
}

export const SupportContactPage: React.FC<SupportContactPageProps> = ({
  onNavigateHome,
  onNavigatePortals,
}) => {
  const { t, isRTL, language } = useLanguage();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'patient',
    subject: '',
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const whatsappHref = 'https://wa.me/9647885663748';
  const emailHref = 'mailto:bcgmoc@gmail.com';
  const instagramHref = 'https://www.instagram.com/m737iq';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validation
    if (!formData.name.trim() || !formData.email.trim() || !formData.message.trim()) {
      setErrorMessage(
        language === 'ar'
          ? 'يرجى إكمال الحقول الإلزامية: الاسم، البريد الإلكتروني، وتفاصيل الرسالة.'
          : 'Please complete the required fields: Full Name, Email, and Message.'
      );
      return;
    }

    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      setErrorMessage(
        language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح.' : 'Please provide a valid email address.'
      );
      return;
    }

    setIsSubmitting(true);

    // Realistic message submission flow
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmissionStatus('success');
      setFormData({
        name: '',
        email: '',
        phone: '',
        role: 'patient',
        subject: '',
        message: '',
      });
    }, 800);
  };

  const faqs = [
    {
      qAr: 'كيف يتم اعتماد حسابات الأطباء والصيادلة والمختبرات؟',
      qEn: 'How are doctor, pharmacy, and laboratory accounts accredited?',
      aAr: 'يتم تقديم طلب الانضمام مع إدخال رقم إجازة الممارسة الصادرة عن نقابة الأطباء أو الصيادلة أو ذوي المهن الصحية، ويقوم فريق الإدارة المركزية بالتحقق من صحة السجل قبل تفعيل الصلاحيات.',
      aEn: 'Practitioners submit registration details with their official Iraqi syndicate license number. Our accreditation team validates credentials before unlocking full clinical capabilities.',
    },
    {
      qAr: 'هل يمكن للمريض حجز موعد لدى طبيب وإجراء تحاليل في نفس اليوم؟',
      qEn: 'Can a patient book a doctor appointment and lab tests on the same day?',
      aAr: 'نعم، يمكن للمراجع حجز الموعد السريري واختيار موعد التحليل المخبري المناسب، وتصل النتائج مباشرة إلى ملف المريض الإلكتروني ليطلع عليها الطبيب المعالج.',
      aEn: 'Yes, patients can schedule consultations and diagnostic tests seamlessly, with results linked directly to their encrypted medical file.',
    },
    {
      qAr: 'كيف تطلب الصيدليات الأدوية بالجملة من المذاخر المعتمدة؟',
      qEn: 'How do pharmacies order wholesale medications from accredited warehouses?',
      aAr: 'من خلال بوابة الصيدليات (سوق المذاخر والمكاتب العلمية B2B)، يمكن للصيدلي استعراض الأصناف المعتمدة، وتدقيق الأسعار والوجبات بالدينار، وإرسال طلب الشراء فورياً.',
      aEn: 'Through the Pharmacy Portal B2B Wholesale Market tab, pharmacists can browse verified batch catalogs and place orders directly with drug warehouses.',
    },
    {
      qAr: 'ما هي ساعات عمل الدعم الفني والتنسيق الميداني؟',
      qEn: 'What are the operating hours of technical support and coordination?',
      aAr: 'مكتب التنسيق الرقمي متاح يومياً من الساعة ٨:٠٠ صباحاً حتى ١٠:٠٠ مساءً، وتتوفر خدمة الطوارئ والمحادثة الفورية عبر واتساب على مدار الساعة.',
      aEn: 'Our coordination desk is active daily from 8:00 AM to 10:00 PM, with 24/7 direct inquiry handling available via WhatsApp.',
    },
  ];

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
            {language === 'ar' ? 'الدعم الفني والتواصل الميداني' : 'Support & Contact Us'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold mb-3">
            <Headphones size={14} />
            <span>{language === 'ar' ? 'مكتب التنسيق الفني والاستجابة' : 'Direct Support & Clinical Coordination Desk'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {language === 'ar' ? 'نحن هنا لمساعدتكم والتنسيق معكم' : 'Get in Touch with M737IQ Support'}
          </h1>

          <p className="mt-3 text-xs sm:text-base text-slate-600 leading-relaxed text-balance">
            {language === 'ar'
              ? 'سواء كنت طبيباً ترغب في تفعيل عيادتك، أو صيدلانياً، أو مراجعاً بحاجة لمساعدة تقنية، فإن فريقنا متاح للتواصل عبر القنوات الرسمية أدناه.'
              : 'Whether you are a healthcare practitioner activating your facility or a patient needing assistance, our team is ready to help across multiple channels.'}
          </p>
        </div>

        {/* 4 Verified Direct Channels Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* WhatsApp Channel */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-3xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 transition-all flex flex-col justify-between group shadow-xs"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <MessageSquare size={24} />
              </div>
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide block">
                {language === 'ar' ? 'المحادثة المباشرة عبر واتساب' : 'WhatsApp Support Desk'}
              </span>
              <div className="text-lg font-mono font-black text-slate-900 mt-1">
                +964 788 566 3748
              </div>
              <p className="text-xs text-emerald-900 mt-2 leading-relaxed">
                {language === 'ar'
                  ? 'قناة التواصل الأسرع للاستفسارات الفورية وتنسيق الحسابات والاعتمادات.'
                  : 'Fastest direct channel for practitioner onboarding and urgent inquiries.'}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-emerald-200/60 flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>{language === 'ar' ? 'فتح المحادثة الآن' : 'Start WhatsApp Chat'}</span>
              <ArrowUpRight size={16} />
            </div>
          </a>

          {/* Instagram Channel */}
          <a
            href={instagramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="p-6 rounded-3xl bg-pink-50/70 hover:bg-pink-100/70 border border-pink-200 transition-all flex flex-col justify-between group shadow-xs"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Instagram size={24} />
              </div>
              <span className="text-xs font-bold text-pink-800 uppercase tracking-wide block">
                {t.contact.instagramTitle}
              </span>
              <div className="text-lg font-mono font-black text-slate-900 mt-1">
                @m737iq
              </div>
              <p className="text-xs text-pink-900 mt-2 leading-relaxed">
                {language === 'ar'
                  ? 'متابعة مستجدات المنصة، التحديثات الطبية، والتواصل المباشر مع فريق الإدارة.'
                  : 'Follow clinical updates, verified medical posts, and platform announcements.'}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-pink-200/60 flex items-center justify-between text-xs font-bold text-pink-700">
              <span>{t.contact.instagramAction}</span>
              <ArrowUpRight size={16} />
            </div>
          </a>

          {/* Email Channel */}
          <a
            href={emailHref}
            className="p-6 rounded-3xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-200 transition-all flex flex-col justify-between group shadow-xs"
          >
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#003366] text-white flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Mail size={24} />
              </div>
              <span className="text-xs font-bold text-sky-800 uppercase tracking-wide block">
                {language === 'ar' ? 'البريد الإلكتروني الرسمي' : 'Official Administration Email'}
              </span>
              <div className="text-sm sm:text-base font-mono font-bold text-slate-900 mt-1 break-all">
                bcgmoc@gmail.com
              </div>
              <p className="text-xs text-sky-900 mt-2 leading-relaxed">
                {language === 'ar'
                  ? 'للمراسلات الرسمية، طلبات الاعتماد الأكاديمي، والعقود والاشتراكات المؤسسية.'
                  : 'Official correspondence, institutional contracts, and accreditation audits.'}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-sky-200/60 flex items-center justify-between text-xs font-bold text-sky-700">
              <span>{language === 'ar' ? 'إرسال بريد إلكتروني' : 'Send an Email'}</span>
              <ArrowUpRight size={16} />
            </div>
          </a>

          {/* Location & Coverage */}
          <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200 transition-all flex flex-col justify-between shadow-xs">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-4 shadow-sm">
                <MapPin size={24} />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
                {language === 'ar' ? 'نطاق التغطية والمقر الميداني' : 'Coverage & Operations'}
              </span>
              <div className="text-base font-bold text-slate-900 mt-1">
                {language === 'ar' ? 'بغداد — كافة المحافظات العراقية' : 'Baghdad & All Iraqi Governorates'}
              </div>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {language === 'ar'
                  ? 'خدمات المنظومة الرقمية تغطي بغداد، البصرة، أربيل، النجف وكافة المدن العراقية الـ ١٨.'
                  : 'Platform coverage spanning all 18 Iraqi governorates for clinics, labs, and pharmacies.'}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-200 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Clock size={14} />
              <span>{language === 'ar' ? 'يومياً: ٨:٠٠ ص — ١٠:٠٠ م' : 'Daily: 8:00 AM — 10:00 PM'}</span>
            </div>
          </div>
        </div>

        {/* 2-Column: Direct Inquiry Form & FAQs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-extrabold text-xl text-slate-900">
                {language === 'ar' ? 'إرسال استفسار أو بلاغ مباشر' : 'Send an Official Support Inquiry'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar'
                  ? 'املأ النموذج التالي وسيصل طلبك فوراً إلى مكتب الاستجابة والتنسيق.'
                  : 'Complete this form to dispatch your message to the M737IQ coordination team.'}
              </p>
            </div>

            {submissionStatus === 'success' ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 size={24} />
                </div>
                <h4 className="font-bold text-base text-emerald-950">
                  {language === 'ar' ? 'تم استلام استفسارك بنجاح' : 'Inquiry Received Successfully'}
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
                  {language === 'ar'
                    ? 'شكراً لتواصلك مع M737IQ. سيقوم فريق المتابعة بالتواصل معك خلال ساعات العمل عبر الهاتف أو البريد الإلكتروني.'
                    : 'Thank you for reaching out. A coordinator will follow up via your provided contact details.'}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmissionStatus('idle')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  {language === 'ar' ? 'إرسال رسالة أخرى' : 'Send Another Inquiry'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'الاسم الكامل *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder={language === 'ar' ? 'مثال: د. علي العبيدي' : 'e.g. Dr. Ali Al-Obaidi'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#003366]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'البريد الإلكتروني *' : 'Email Address *'}
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#003366]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'رقم الهاتف / واتساب' : 'Phone / WhatsApp'}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="07XXXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#003366]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'صفتك المهنية / نوع الحساب' : 'Your Role / Facility Type'}
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
                    >
                      <option value="patient">{language === 'ar' ? 'مراجع / مريض' : 'Patient / Citizen'}</option>
                      <option value="doctor">{language === 'ar' ? 'طبيب / استشاري' : 'Doctor / Specialist'}</option>
                      <option value="pharmacy">{language === 'ar' ? 'صيدلية أهلية' : 'Retail Pharmacy'}</option>
                      <option value="wholesaler">{language === 'ar' ? 'مذخر أدوية / مكتب علمي' : 'Drug Wholesaler'}</option>
                      <option value="laboratory">{language === 'ar' ? 'مختبر تحليلات مرضية' : 'Diagnostic Laboratory'}</option>
                      <option value="radiology">{language === 'ar' ? 'مركز أشعة وسونار' : 'Radiology Center'}</option>
                      <option value="other">{language === 'ar' ? 'جهة أخرى' : 'Other'}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'موضوع الاستفسار' : 'Subject'}
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: تفعيل حساب طبيب أو استفسار عن ربط المخزن' : 'e.g. Account activation or technical query'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#003366]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'نص الرسالة أو الاستفسار *' : 'Message Details *'}
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={language === 'ar' ? 'اكتب تفاصيل استفسارك هنا...' : 'Write your detailed message here...'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#003366]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-6 rounded-xl text-sm font-bold text-white brand-gradient-btn shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  <Send size={16} />
                  <span>{isSubmitting ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...') : (language === 'ar' ? 'إرسال الاستفسار' : 'Submit Inquiry')}</span>
                </button>
              </form>
            )}
          </div>

          {/* FAQ Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-lg">
                <HelpCircle size={20} className="text-[#003366]" />
                <span>{language === 'ar' ? 'الأسئلة الأكثر شيوعاً' : 'Frequently Asked Questions'}</span>
              </div>

              <div className="space-y-3">
                {faqs.map((faq, idx) => {
                  const isOpen = activeFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 overflow-hidden transition-all"
                    >
                      <button
                        onClick={() => setActiveFaq(isOpen ? null : idx)}
                        className="w-full p-3.5 text-start font-bold text-xs sm:text-sm text-slate-800 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span>{language === 'ar' ? faq.qAr : faq.qEn}</span>
                        <span className="text-slate-400 shrink-0 font-bold text-base">
                          {isOpen ? '−' : '+'}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="p-3.5 bg-white text-xs text-slate-600 leading-relaxed border-t border-slate-100">
                          {language === 'ar' ? faq.aAr : faq.aEn}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Emergency Notice */}
            <div className="rounded-3xl p-6 bg-red-50 border border-red-200 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-red-900">
                <ShieldAlert size={18} className="text-red-600" />
                <span>{language === 'ar' ? 'تنبيه الحالات الإسعافية الطارئة' : 'Emergency Medical Notice'}</span>
              </div>
              <p className="text-xs text-red-800 leading-relaxed">
                {language === 'ar'
                  ? 'منصة M737IQ مخصصة للرعاية المنتظمة وتنسيق المواعيد والأدوية. في حال وجود حالة طوارئ حرجة فورية، يرجى الاتصال بالإسعاف الفوري العراقي على الرقم (122) أو التوجه لأقرب طوارئ مستشفى حكومي.'
                  : 'M737IQ is designed for scheduled care and clinical coordination. For life-threatening emergencies, please dial Iraqi Emergency Dispatch at 122 or proceed to the nearest emergency room immediately.'}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Navigation CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-slate-100 border border-slate-200">
          <div className="text-xs text-slate-600">
            {language === 'ar'
              ? 'تصفح البوابات الطبية أو عد إلى الصفحة الرئيسية للمنصة.'
              : 'Explore the medical portals or return to the main platform homepage.'}
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
              <span>{language === 'ar' ? 'استعراض كافة البوابات' : 'Explore Portals'}</span>
              {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
