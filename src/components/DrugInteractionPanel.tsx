import React, { useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  checkDrugInteractions, 
  DrugInteraction, 
  InteractionSeverity 
} from '../lib/drugInteractionService';
import { 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  Info, 
  BookOpen, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Sparkles,
  Pill
} from 'lucide-react';

interface DrugInteractionPanelProps {
  medicines: Array<{ name?: string; medicineName?: string; activeIngredient?: string }>;
  compact?: boolean;
}

export const DrugInteractionPanel: React.FC<DrugInteractionPanelProps> = ({
  medicines,
  compact = false,
}) => {
  const { language, isRTL } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const checkResult = useMemo(() => {
    return checkDrugInteractions(medicines);
  }, [medicines]);

  if (!medicines || medicines.length < 2) {
    if (compact) return null;
    return (
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
        <Info size={16} className="text-slate-400 shrink-0" />
        <span>
          {language === 'ar'
            ? 'أضف دواءين على الأقل لتفعيل الفحص التلقائي للتداخلات الدوائية استناداً لمنظمة الصحة العالمية (WHO) وهيئة الغذاء والدواء (FDA).'
            : 'Add at least 2 medications to trigger automated drug-drug interaction screening.'}
        </span>
      </div>
    );
  }

  const getSeverityStyle = (severity: InteractionSeverity) => {
    switch (severity) {
      case 'contraindicated':
        return {
          bg: 'bg-red-50',
          border: 'border-red-300',
          text: 'text-red-900',
          badge: 'bg-red-600 text-white',
          label: language === 'ar' ? 'ممنوع قطيعاً (Contraindicated)' : 'Contraindicated',
        };
      case 'major':
        return {
          bg: 'bg-amber-50',
          border: 'border-amber-300',
          text: 'text-amber-900',
          badge: 'bg-amber-600 text-white',
          label: language === 'ar' ? 'حرج / عالي الخطورة (Major Risk)' : 'Major Risk',
        };
      case 'moderate':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-300',
          text: 'text-yellow-900',
          badge: 'bg-yellow-600 text-white',
          label: language === 'ar' ? 'متوسط الخطورة (Moderate Risk)' : 'Moderate Risk',
        };
      default:
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          text: 'text-blue-900',
          badge: 'bg-blue-600 text-white',
          label: language === 'ar' ? 'طفيف (Minor)' : 'Minor',
        };
    }
  };

  return (
    <div className="space-y-3 font-sans" dir={isRTL ? 'rtl' : 'ltr'}>
      {checkResult.hasInteractions ? (
        /* Detected Interactions Banner */
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/60 p-4 space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-red-950 flex items-center gap-2">
                  <span>
                    {language === 'ar'
                      ? `تم رصد (${checkResult.totalInteractions}) تداخلات دوائية محتملة!`
                      : `Alert: (${checkResult.totalInteractions}) Potential Drug Interactions Detected!`}
                  </span>
                </h4>
                <p className="text-[11px] text-red-800">
                  {language === 'ar'
                    ? 'يرجى مراجعة التوافق السريري وضبط الجرعات أو البدائل العلاجية قبل الصرف.'
                    : 'Please review clinical compatibility and dosage adjustments prior to dispensing.'}
                </p>
              </div>
            </div>
          </div>

          {/* List of Interactions */}
          <div className="space-y-2 pt-1">
            {checkResult.interactions.map((item) => {
              const style = getSeverityStyle(item.severity);
              const isExpanded = expandedId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border ${style.border} ${style.bg} p-3 transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${style.badge}`}>
                          {style.label}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {item.drugA} ⚡ {item.drugB}
                        </span>
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed font-medium">
                        {language === 'ar' ? item.clinicalDescriptionAr : item.clinicalDescriptionEn}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                      title={language === 'ar' ? 'التفاصيل والإدارة السريرية' : 'Details'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* Expanded Management & Citation */}
                  {isExpanded && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 text-xs space-y-2 animate-in fade-in">
                      <div className="p-2.5 rounded-lg bg-white/80 border border-slate-200 text-slate-800">
                        <span className="font-bold text-[#003366] block mb-1">
                          {language === 'ar' ? 'التوصية والإجراء السريري المقترح:' : 'Clinical Recommendation & Management:'}
                        </span>
                        <p className="text-[11px] leading-relaxed">
                          {language === 'ar' ? item.managementAr : item.managementEn}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>المصدر: {item.source}</span>
                        <span>إصدار: {item.lastUpdated}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Verified Clean Result */
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3 animate-in fade-in">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs sm:text-sm font-bold text-emerald-900">
              {language === 'ar' 
                ? 'لا توجد تداخلات دوائية حرجة مسجلة' 
                : 'No Major Interactions Registered'}
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              {language === 'ar'
                ? 'لم يتم العثور على تداخلات دوائية خطيرة في قاعدة البيانات المرجعية المعتمدة (WHO / FDA) بين الأدوية المحددة في هذه القائمة.'
                : 'No major clinical interactions found in verified databases (WHO / FDA) for the selected medications.'}
            </p>
          </div>
        </div>
      )}

      {/* Mandatory Clinical Disclaimer */}
      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed">
        <Stethoscope size={14} className="text-[#003366] shrink-0 mt-0.5" />
        <p>
          {language === 'ar' ? checkResult.disclaimerAr : checkResult.disclaimerEn}
        </p>
      </div>
    </div>
  );
};
