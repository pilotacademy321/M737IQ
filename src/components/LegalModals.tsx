import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, ShieldAlert, FileText, CheckCircle2, ScrollText, PenTool } from 'lucide-react';
import { getActiveContractTemplate, CURRENT_CONTRACT_VERSION } from '../lib/legalContractService';

interface LegalModalProps {
  isOpen: boolean;
  type: 'privacy' | 'terms' | 'contract' | null;
  onClose: () => void;
  signedContractData?: {
    signatureFullName: string;
    signatureTimestamp: string;
    contractVersion: string;
    contractTextSnapshot?: string;
  } | null;
}

export const LegalModal: React.FC<LegalModalProps> = ({ 
  isOpen, 
  type, 
  onClose,
  signedContractData 
}) => {
  const { t, language } = useLanguage();
  const [contractTemplate, setContractTemplate] = useState<{
    version: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen && (type === 'contract' || type === 'terms')) {
      getActiveContractTemplate().then((tpl) => {
        setContractTemplate({
          version: tpl.version || CURRENT_CONTRACT_VERSION,
          titleAr: tpl.titleAr,
          titleEn: tpl.titleEn,
          contentAr: tpl.contentAr,
          contentEn: tpl.contentEn,
        });
      });
    }
  }, [isOpen, type]);

  if (!isOpen || !type) return null;

  const isPrivacy = type === 'privacy';
  const isContract = type === 'contract';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-200 text-start">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#003366] flex items-center justify-center shrink-0">
              {isPrivacy ? <ShieldAlert size={22} /> : isContract ? <ScrollText size={22} /> : <FileText size={22} />}
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                {isPrivacy 
                  ? t.legal.privacyTitle 
                  : isContract
                  ? (language === 'ar' ? 'نسخة عقد الاتفاق والتوقيع الإلكتروني الموثق' : 'Signed User Agreement & Electronic Contract Record')
                  : t.legal.termsTitle}
              </h3>
              <span className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'المنظومة الطبية — معتمد وفق القوانين والأنظمة الصحية العراقية' 
                  : 'Healthcare Platform — Under Applicable Iraqi Healthcare Laws'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mandatory Medical Disclaimer Banner */}
        <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
          <strong>{language === 'ar' ? 'إقرار طبي وقانوني:' : 'Medical & Legal Disclaimer:'}</strong>{' '}
          {language === 'ar'
            ? 'هذه المنظومة وسيلة رقمية لتنظيم التواصل والمواعيد الطبية وليست بديلاً عن حالات الطوارئ أو الفحص السريري المباشر. تخضع شروط الاستخدام للمراجعة القانونية المستمرة ولا تشكل إعفاءً تلقائياً من أي مسؤولية قانونية نظامية مقررة بحكم القانون العراقي النافذ.'
            : 'This platform is a communication and appointment coordination tool, not an emergency facility or a substitute for urgent in-person physical clinical examination. Terms do not constitute an automatic statutory waiver under mandatory Iraqi laws.'}
        </div>

        {/* If viewing a signed contract copy */}
        {signedContractData && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">{language === 'ar' ? 'الموقّع إلكترونياً:' : 'Signed By:'}</span>{' '}
                <span className="font-semibold text-emerald-950">{signedContractData.signatureFullName}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-emerald-800">
              <span>{language === 'ar' ? 'الإصدار:' : 'Version:'} <span className="font-mono">{signedContractData.contractVersion}</span></span>
              <span>{language === 'ar' ? 'التوثيق:' : 'Timestamp:'} <span className="font-mono">{signedContractData.signatureTimestamp.slice(0, 19).replace('T', ' ')}</span></span>
            </div>
          </div>
        )}

        {/* Modal Body Content */}
        <div className="mt-5 space-y-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
          {isPrivacy ? (
            <>
              <p>
                {language === 'ar'
                  ? 'تلتزم المنظومة بحماية خصوصية المرضى والكوادر الطبية والمراكز الصحية في العراق وفق أرقى المعايير التقنية والأخلاقية.'
                  : 'The platform is committed to safeguarding patient, clinician, and medical facility confidentiality in accordance with strict ethical and technological benchmarks.'}
              </p>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                {language === 'ar' ? '١. جمع البيانات وتشفيرها' : '1. Data Collection & Encryption'}
              </h4>
              <p>
                {language === 'ar'
                  ? 'يتم تخزين السجلات الطبية وتقارير الفحوصات وصور الأشعة بتشفير سحابي لا يمكن الاطلاع عليه إلا من قبل الطبيب المعالج المصرح له أو المريض صاحب الملف.'
                  : 'Medical records, pathology test sheets, and radiological imaging are protected with access-restricted encryption protocols.'}
              </p>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                {language === 'ar' ? '٢. عدم مشاركة البيانات مع جهات تجارية' : '2. No Commercial Data Sharing'}
              </h4>
              <p>
                {language === 'ar'
                  ? 'لا يتم بيع أو مشاركة أي بيانات صحية أو تفاصيل تواصل شخصية لأغراض إعلانية أو تجارية تحت أي ظرف.'
                  : 'No personal health data or contact details are sold or shared for external commercial advertising.'}
              </p>
            </>
          ) : isContract ? (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 max-h-72 overflow-y-auto whitespace-pre-line text-xs font-sans text-slate-800 leading-relaxed">
              {signedContractData?.contractTextSnapshot || (language === 'ar' ? contractTemplate?.contentAr : contractTemplate?.contentEn)}
            </div>
          ) : (
            <>
              <p>
                {language === 'ar'
                  ? 'تحكم هذه الشروط استخدام المنظومة الطبية وبواباتها المستقلة المخصصة للرعاية الصحية في العراق.'
                  : 'These terms govern the access and authorized utilization of the platform and its clinical gateways.'}
              </p>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                {language === 'ar' ? '١. الاعتماد والترخيص المهني وفق القانون العراقي' : '1. Medical Licensing & Accreditation'}
              </h4>
              <p>
                {language === 'ar'
                  ? 'يتطلب استخدام بوابات الأطباء والمختبرات والأشعة والصيدليات توفر ترخيص ممارسة مهنة ساري المفعول صادر من النقابات والجهات المختصة داخل جمهورية العراق.'
                  : 'Professional portals require valid practice credentials and certification within the Republic of Iraq.'}
              </p>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                {language === 'ar' ? '٢. استقلالية القرار الطبي' : '2. Clinical Responsibility'}
              </h4>
              <p>
                {language === 'ar'
                  ? 'تعد القرارات التشخيصية والعلاجية وصرف الدواء مسؤولية حصرية ومباشرة للكوادر الطبية المرخصة وفق أحكام قانون نقابة الأطباء رقم 81 لسنة 1984.'
                  : 'Diagnostic decisions, prescription issuing, and medication dispensing remain the direct responsibility of licensed healthcare practitioners.'}
              </p>
              <h4 className="font-bold text-slate-800 text-sm mt-3">
                {language === 'ar' ? '٣. نص العقد الإلكتروني الكامل المعتمد' : '3. Full Electronic Agreement Contract Text'}
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 max-h-60 overflow-y-auto whitespace-pre-line text-xs text-slate-700">
                {language === 'ar' ? contractTemplate?.contentAr : contractTemplate?.contentEn}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#003366] hover:bg-[#002244] transition-colors cursor-pointer"
          >
            {t.legal.close}
          </button>
        </div>
      </div>
    </div>
  );
};
