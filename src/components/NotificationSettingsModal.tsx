import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  PushPermissionStatus, 
  PushNotificationPreferences, 
  getNotificationPermissionStatus, 
  getUserNotificationPreferences, 
  saveUserNotificationPreferences, 
  requestPushPermissionAndRegisterToken, 
  unregisterDevicePush, 
  sendLocalTestNotification,
  detectPlatform,
  isPushSupported
} from '../lib/pushNotificationService';
import { 
  Bell, 
  BellRing, 
  ShieldCheck, 
  Smartphone, 
  Sliders, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Send, 
  Lock, 
  Calendar, 
  Pill, 
  FlaskConical, 
  Building2, 
  Info,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, userProfile } = useAuth();
  const { language, isRTL } = useLanguage();

  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('default');
  const [preferences, setPreferences] = useState<PushNotificationPreferences>(getUserNotificationPreferences());
  const [isLoading, setIsLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'success' | 'failed'>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

  const platform = detectPlatform();
  const isSupported = isPushSupported();

  useEffect(() => {
    if (isOpen) {
      setPermissionStatus(getNotificationPermissionStatus());
      setPreferences(getUserNotificationPreferences());
      setTestStatus('idle');
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    if (!user) {
      setFeedback(language === 'ar' ? 'يرجى تسجيل الدخول أولاً لتفعيل الإشعارات' : 'Please sign in first to enable push');
      return;
    }

    setIsLoading(true);
    setFeedback(null);

    const res = await requestPushPermissionAndRegisterToken(
      user.uid,
      userProfile?.role || 'patient',
      preferences
    );

    setIsLoading(false);
    setPermissionStatus(res.status);

    if (res.success) {
      setPreferences(prev => ({ ...prev, enabled: true }));
      setFeedback(
        language === 'ar'
          ? 'تم تفعيل الإشعارات الفورية وربط جهازك بنجاح بنظام M737IQ!'
          : 'Push notifications enabled and device registered successfully!'
      );
    } else {
      setFeedback(
        language === 'ar'
          ? `تعذر التفعيل: ${res.error || 'تم رفض الإذن من المتصفح'}`
          : `Failed: ${res.error || 'Permission denied by browser'}`
      );
    }
  };

  const handleDisablePush = async () => {
    if (!user) return;
    setIsLoading(true);
    await unregisterDevicePush(user.uid);
    setPreferences(prev => ({ ...prev, enabled: false }));
    setIsLoading(false);
    setFeedback(
      language === 'ar'
        ? 'تم إيقاف استلام الإشعارات على هذا الجهاز بنجاح.'
        : 'Push notifications disabled on this device.'
    );
  };

  const handleTogglePreference = (key: keyof PushNotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    saveUserNotificationPreferences(updated, user?.uid);
  };

  const handleSendTestPush = async () => {
    setTestStatus('sending');
    const ok = await sendLocalTestNotification({
      title: language === 'ar' ? 'M737IQ — إشعار تجريبي مباشر' : 'M737IQ — Live Push Test',
      body: language === 'ar'
        ? 'تم استلام الإشعار بنجاح! جهازك متصل الآن بمنظومة الرعاية الصحية الفورية.'
        : 'Notification received! Your device is synchronized with M737IQ cloud.',
      url: userProfile ? `/${userProfile.role}` : '/patient',
    });

    if (ok) {
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 4000);
    } else {
      setTestStatus('failed');
      setTimeout(() => setTestStatus('idle'), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 duration-150 my-8 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-[#003366] flex items-center justify-center font-bold shadow-xs">
              <BellRing size={22} className="text-[#003366]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {language === 'ar' ? 'إعدادات الإشعارات الفورية (Mobile Push)' : 'Push Notification Settings'}
              </h2>
              <p className="text-xs text-slate-500">
                {language === 'ar' ? 'استلام التحديثات الطبية حتى عند إغلاق التطبيق' : 'Receive medical alerts even when app is closed'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-xs font-semibold text-[#003366] flex items-center gap-2">
            <Info size={16} className="shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Device & Permission Status Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
              <Smartphone size={16} />
              <span>{language === 'ar' ? 'نوع المنصة والجهاز:' : 'Platform & Device:'}</span>
            </span>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-800 uppercase">
              {platform}
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
            <span className="text-xs font-bold text-slate-600">
              {language === 'ar' ? 'حالة الإذن بالمتصفح:' : 'Browser Permission:'}
            </span>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              permissionStatus === 'granted' 
                ? 'bg-emerald-100 text-emerald-800' 
                : permissionStatus === 'denied'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {permissionStatus === 'granted' 
                ? (language === 'ar' ? 'مفعل ومصرح به' : 'Granted') 
                : permissionStatus === 'denied'
                ? (language === 'ar' ? 'محظور من المتصفح' : 'Denied')
                : (language === 'ar' ? 'بانتظار الموافقة' : 'Default / Pending')}
            </span>
          </div>

          {/* iOS Safari Notice */}
          {platform === 'ios' && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              {language === 'ar'
                ? 'ملاحظة لأجهزة iPhone / iPad: يلزم إضافة المنصة للشاشة الرئيسية (Add to Home Screen) من قائمة مشاركة Safari لتفعيل الإشعارات الفورية في نظام iOS 16.4+.'
                : 'For iOS devices: Push notifications require adding M737IQ to your Home Screen from the Safari share menu.'}
            </div>
          )}

          {/* Primary Action Button */}
          <div className="pt-2">
            {permissionStatus !== 'granted' || !preferences.enabled ? (
              <button
                onClick={handleEnablePush}
                disabled={isLoading || !isSupported}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-[#002b5c] hover:from-sky-500 hover:to-[#001f42] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? <RefreshCw size={14} className="animate-spin" /> : <BellRing size={14} />}
                <span>
                  {language === 'ar' ? 'تفعيل الإشعارات الفورية على هذا الجهاز' : 'Enable Mobile Push on this Device'}
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendTestPush}
                  disabled={testStatus === 'sending'}
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {testStatus === 'sending' ? (
                    <RefreshCw size={13} className="animate-spin" />
                  ) : testStatus === 'success' ? (
                    <CheckCircle2 size={13} />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>
                    {testStatus === 'success'
                      ? (language === 'ar' ? 'تم الإرسال بنجاح!' : 'Sent Successfully!')
                      : (language === 'ar' ? 'إرسال إشعار تجريبي فوري' : 'Send Test Push')}
                  </span>
                </button>

                <button
                  onClick={handleDisablePush}
                  disabled={isLoading}
                  className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs border border-red-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title={language === 'ar' ? 'إيقاف استلام الإشعارات' : 'Disable Push'}
                >
                  <Trash2 size={13} />
                  <span className="hidden sm:inline">{language === 'ar' ? 'تعطيل' : 'Disable'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lockscreen Privacy Settings */}
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <Lock size={15} className="text-amber-700" />
              <span>{language === 'ar' ? 'خصوصية شاشة القفل (Lockscreen Privacy)' : 'Lockscreen Privacy Mode'}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.useGenericLockscreen}
                onChange={() => handleTogglePreference('useGenericLockscreen')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-amber-800 leading-relaxed">
            {language === 'ar'
              ? 'إخفاء أسماء الأدوية والفحوصات في شاشة القفل، وإظهار نص عام: "لديك تحديث جديد في منصة M737IQ" لحماية سرية بياناتك الطبية أمام الآخرين.'
              : 'Show generic text on lockscreen to hide medical details until you unlock and open the app.'}
          </p>
        </div>

        {/* Category Preferences */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders size={14} />
            <span>{language === 'ar' ? 'فئات الإشعارات المصرح بها' : 'Authorized Notification Categories'}</span>
          </h3>

          <div className="space-y-2 text-xs">
            {/* Appointments */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Calendar size={16} className="text-sky-600" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {language === 'ar' ? 'مواعيد العيادات والاستشارات' : 'Appointments & Consultations'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'ar' ? 'تأكيد الحجز، التذكيرات، والتعديلات' : 'Bookings, reminders, cancellations'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.appointments}
                onChange={() => handleTogglePreference('appointments')}
                className="rounded text-[#003366] focus:ring-[#003366] w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Prescriptions */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Pill size={16} className="text-emerald-600" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {language === 'ar' ? 'الروشتات وصرف الأدوية' : 'Prescriptions & Dispensing'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'ar' ? 'صدور الوصفة، استلام الصيدلية، والصرف' : 'Issuance, pharmacy receipt, dispensing'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.prescriptions}
                onChange={() => handleTogglePreference('prescriptions')}
                className="rounded text-[#003366] focus:ring-[#003366] w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Diagnostic Results */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FlaskConical size={16} className="text-rose-600" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {language === 'ar' ? 'تقارير المختبر والأشعة' : 'Lab & Radiology Reports'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'ar' ? 'اعتماد النتائج ورفع التقارير الموثقة' : 'Result verification and report releases'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.labRadiology}
                onChange={() => handleTogglePreference('labRadiology')}
                className="rounded text-[#003366] focus:ring-[#003366] w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Orders */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Building2 size={16} className="text-amber-600" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {language === 'ar' ? 'طلبات وإمدادات الأدوية' : 'Wholesale & Pharmacy Orders'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'ar' ? 'تتبع الشحنات، التسليم، وعروض المذاخر' : 'Shipment tracking, B2B order deliveries'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.orders}
                onChange={() => handleTogglePreference('orders')}
                className="rounded text-[#003366] focus:ring-[#003366] w-4 h-4 cursor-pointer"
              />
            </div>

            {/* Security */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-sky-700" />
                <div>
                  <span className="font-bold text-slate-800 block">
                    {language === 'ar' ? 'الأمان وتدقيق التراخيص' : 'Security & Accreditation'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {language === 'ar' ? 'اعتماد الحساب، الترخيص، وتنبيهات الأمان' : 'Account approvals, licenses, security alerts'}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={preferences.security}
                onChange={() => handleTogglePreference('security')}
                className="rounded text-[#003366] focus:ring-[#003366] w-4 h-4 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            {language === 'ar' ? 'تم وحفظ الإعدادات' : 'Done & Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
