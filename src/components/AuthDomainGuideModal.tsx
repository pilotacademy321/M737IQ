import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  ShieldAlert, 
  Copy, 
  Check, 
  ExternalLink, 
  X, 
  LogIn,
  HelpCircle 
} from 'lucide-react';

interface AuthDomainGuideModalProps {
  onSelectPortal?: (portalId: any) => void;
}

export const AuthDomainGuideModal: React.FC<AuthDomainGuideModalProps> = () => {
  const { 
    showDomainHelp, 
    setShowDomainHelp, 
    currentHostname, 
    firebaseProjectId, 
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

  const consoleSettingsUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`;

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
                {language === 'ar' ? 'تصريح نطاق مصادقة Firebase' : 'Authorize Firebase Authentication Domain'}
              </h2>
              <p className="text-xs text-slate-300">
                {language === 'ar' ? 'دليل حل خطأ (auth/unauthorized-domain) لتسجيل الدخول الحقيقي' : 'Guide to fix auth/unauthorized-domain for real authentication'}
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
