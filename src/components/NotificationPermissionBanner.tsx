import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  getNotificationPermissionStatus, 
  requestPushPermissionAndRegisterToken, 
  getUserNotificationPreferences,
  isPushSupported
} from '../lib/pushNotificationService';
import { BellRing, X, Sliders, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';

interface NotificationPermissionBannerProps {
  onOpenSettings: () => void;
}

const DISMISS_KEY = 'm737_push_banner_dismissed_until';

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  onOpenSettings,
}) => {
  const { user, userProfile } = useAuth();
  const { language } = useLanguage();

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [justEnabled, setJustEnabled] = useState(false);

  useEffect(() => {
    // Only display if user is authenticated and browser supports notifications
    if (!user || !isPushSupported()) {
      setVisible(false);
      return;
    }

    const currentPermission = getNotificationPermissionStatus();
    if (currentPermission === 'granted' || currentPermission === 'denied') {
      setVisible(false);
      return;
    }

    const prefs = getUserNotificationPreferences();
    if (prefs.enabled === false) {
      // User explicitly disabled notifications in settings
      setVisible(false);
      return;
    }

    // Check if dismissed recently (within 7 days)
    const dismissedUntil = localStorage.getItem(DISMISS_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      setVisible(false);
      return;
    }

    // Delay banner appearance slightly so it doesn't jarringly block initial render
    const timer = setTimeout(() => {
      setVisible(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [user]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    // Don't nag for 7 days
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleEnable = async () => {
    if (!user) return;
    setLoading(true);
    const res = await requestPushPermissionAndRegisterToken(
      user.uid,
      userProfile?.role || 'patient'
    );
    setLoading(false);

    if (res.success) {
      setJustEnabled(true);
      setTimeout(() => {
        setVisible(false);
      }, 2500);
    } else {
      setVisible(false);
    }
  };

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-6 z-40 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-4 sm:p-5 shadow-2xl border border-slate-700/80 space-y-3">
        {justEnabled ? (
          <div className="flex items-center gap-3 py-2 text-emerald-400 font-bold text-xs sm:text-sm">
            <CheckCircle2 size={20} className="shrink-0 animate-bounce" />
            <span>
              {language === 'ar'
                ? 'تم تفعيل الإشعارات الفورية على هاتفك بنجاح!'
                : 'Mobile push notifications enabled successfully!'}
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 border border-sky-400/30">
                  <BellRing size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>{language === 'ar' ? 'تفعيل الإشعارات الفورية' : 'Enable Mobile Push'}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      M737 Push
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
                    {language === 'ar'
                      ? 'استلم تنبيهات فورية لمواعيدك، وصفتك الطبية، واعتماد نتائج التحاليل حتى عند إغلاق التطبيق.'
                      : 'Get instant alerts for appointments, e-prescriptions, and lab reports even when closed.'}
                  </p>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 to-[#003366] hover:from-sky-400 hover:to-[#002244] text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles size={13} className="text-amber-300" />
                <span>{loading ? (language === 'ar' ? 'جاري التفعيل...' : 'Enabling...') : (language === 'ar' ? 'تفعيل الآن' : 'Enable Now')}</span>
              </button>

              <button
                onClick={onOpenSettings}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title={language === 'ar' ? 'تخصيص الإعدادات' : 'Customize'}
              >
                <Sliders size={13} />
                <span>{language === 'ar' ? 'إعدادات' : 'Settings'}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
