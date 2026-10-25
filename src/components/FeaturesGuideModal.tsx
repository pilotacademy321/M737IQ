import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  Building2, 
  Stethoscope, 
  Pill, 
  FlaskConical, 
  Scan, 
  Truck, 
  Calendar, 
  User, 
  ArrowLeft, 
  ArrowRight 
} from 'lucide-react';
import { PortalId } from '../types';

interface FeaturesGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPortal: (portalId: PortalId) => void;
}

export const FeaturesGuideModal: React.FC<FeaturesGuideModalProps> = ({
  isOpen,
  onClose,
  onSelectPortal,
}) => {
  const { language, isRTL } = useLanguage();

  if (!isOpen) return null;

  const features = [
    {
      portalId: 'patient' as PortalId,
      titleAr: 'بوابة المريض (Medical Health Passport)',
      descAr: 'ملف صحي رقمي موحد، حجز فوري للمواعيد واستعراض نتائج التحاليل وصور السونار والأشعة مع إمكانية البحث عن الأدوية القريبة.',
      color: 'bg-cyan-500',
      icon: <User size={20} className="text-white" />,
    },
    {
      portalId: 'doctor' as PortalId,
      titleAr: 'بوابة الطبيب والعيادات الذكية',
      descAr: 'إدارة الاستشارات اليومية، فحص التداخلات الدوائية المدعومة سريرياً، وإصدار الوصفات الطبية الإلكترونية والإحالات المباشرة.',
      color: 'bg-blue-600',
      icon: <Stethoscope size={20} className="text-white" />,
    },
    {
      portalId: 'pharmacy' as PortalId,
      titleAr: 'بوابة الصيدليات الأهلية',
      descAr: 'صرف الوصفات الطبية برمز QR المشفر، مراقبة المخزون وتواريخ الصلاحية، وطلب الإمدادات بالجملة مباشرة من المذاخر.',
      color: 'bg-emerald-500',
      icon: <Pill size={20} className="text-white" />,
    },
    {
      portalId: 'laboratory' as PortalId,
      titleAr: 'بوابة المختبرات الطبية والتحاليل',
      descAr: 'تتبع العينات بالباركود الآلي، إدخال المعايير الكيميائية والدموية وإصدار النتائج الفورية المصدقة للطبيب والمريض.',
      color: 'bg-rose-500',
      icon: <FlaskConical size={20} className="text-white" />,
    },
    {
      portalId: 'radiology' as PortalId,
      titleAr: 'بوابة مراكز الأشعة والسونار',
      descAr: 'أرشفة فحوصات الرنين والمفراس والسونار بتقارير معتمدة من استشاري الأشعة مع رفع الصور التشخيصية الآمنة.',
      color: 'bg-sky-500',
      icon: <Scan size={20} className="text-white" />,
    },
    {
      portalId: 'wholesaler' as PortalId,
      titleAr: 'بوابة مجهزي الأدوية والمذاخر (B2B)',
      descAr: 'سوق الجملة الدوائي الأول لربط المكاتب العلمية والمستودعات بالصيدليات مع أسعار الكارتون وتتبع الوجبات والحد الأدنى للطلب.',
      color: 'bg-amber-500',
      icon: <Truck size={20} className="text-white" />,
    },
    {
      portalId: 'secretary' as PortalId,
      titleAr: 'بوابة السكرتارية والاستقبال',
      descAr: 'تنظيم قاعات الانتظار، تأكيد حضور المرضى، جدولة المواعيد وتخفيف العبء الإداري عن الطبيب والعيادة.',
      color: 'bg-purple-500',
      icon: <Calendar size={20} className="text-white" />,
    },
    {
      portalId: 'super_admin' as PortalId,
      titleAr: 'بوابة الإدارة العليا والرقابة المركزية',
      descAr: 'تدقيق وتفعيل رخص الكوادر الطبية الصادرة عن النقابات والوزارة، ومتابعة سجلات التدقيق الأمني والاشتراكات.',
      color: 'bg-teal-600',
      icon: <ShieldCheck size={20} className="text-white" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-400 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {language === 'ar' ? 'دليل ميزات منصة M737IQ الطبية' : 'M737IQ Platform Features Guide'}
              </h2>
              <p className="text-xs text-slate-300">
                {language === 'ar' ? 'منظومة الرعاية الصحية المتكاملة الأولى في العراق' : 'First Integrated Healthcare Architecture in Iraq'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content list */}
        <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((f) => (
              <div
                key={f.portalId}
                className="p-4 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-white transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className={`w-9 h-9 rounded-xl ${f.color} flex items-center justify-center shadow-xs`}>
                      {f.icon}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-900 transition-colors">
                      {f.titleAr}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {f.descAr}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-end">
                  <button
                    onClick={() => {
                      onClose();
                      onSelectPortal(f.portalId);
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{language === 'ar' ? 'الانتقال إلى البوابة' : 'Open Portal'}</span>
                    {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>{language === 'ar' ? 'جميع البوابات تعمل بشكل متزامن وفوري' : 'All 8 portals operate synchronously'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
