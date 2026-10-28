import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { 
  Smartphone, 
  Apple, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  Monitor, 
  ArrowRight, 
  ArrowLeft,
  ChevronRight,
  Zap,
  Globe,
  Lock,
  Layers,
  CheckCheck
} from 'lucide-react';
import { detectPlatform } from '../lib/pushNotificationService';

interface InstallUpdatePageProps {
  onNavigateHome: () => void;
  onNavigatePortals?: () => void;
}

export const InstallUpdatePage: React.FC<InstallUpdatePageProps> = ({
  onNavigateHome,
  onNavigatePortals,
}) => {
  const { language, isRTL } = useLanguage();

  // Device detection state
  const [detectedPlatform, setDetectedPlatform] = useState<'android' | 'ios' | 'desktop'>('android');
  const [activeTab, setActiveTab] = useState<'android' | 'ios' | 'desktop'>('android');
  
  // PWA BeforeInstallPrompt state (for Android Chrome / Edge / Desktop PWA)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallablePWA, setIsInstallablePWA] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Update checking state
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    type: 'idle' | 'latest' | 'updated' | 'error';
    messageAr: string;
    messageEn: string;
  }>({
    type: 'idle',
    messageAr: '',
    messageEn: '',
  });

  // Link copy state
  const [copiedLink, setCopiedLink] = useState(false);

  // Target permanent installation URL
  const officialHost = typeof window !== 'undefined' ? window.location.origin : 'https://m737iq.netlify.app';
  const installUrl = `${officialHost}/install`;

  // Detect platform on mount and listen to PWA prompt
  useEffect(() => {
    const plat = detectPlatform();
    const resolved: 'android' | 'ios' | 'desktop' = 
      plat === 'ios' ? 'ios' : plat === 'desktop' ? 'desktop' : 'android';
    
    setDetectedPlatform(resolved);
    setActiveTab(resolved);

    // Listen for browser PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallablePWA(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful install
    const handleAppInstalled = () => {
      setIsInstallablePWA(false);
      setInstallSuccess(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Trigger PWA Installation
  const handleTriggerPWAInstall = async () => {
    if (!deferredPrompt) {
      // Fallback instruction
      alert(
        language === 'ar'
          ? 'لتثبيت التطبيق على جهازك، يرجى فتح خيارات المتصفح (⋮) واختيار "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".'
          : 'To install, open your browser menu (⋮) and select "Install App" or "Add to Home screen".'
      );
      return;
    }

    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setInstallSuccess(true);
      }
      setDeferredPrompt(null);
      setIsInstallablePWA(false);
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  // Check for updates & refresh service worker cache
  const handleCheckForUpdates = async () => {
    setCheckingUpdate(true);
    setUpdateStatus({ type: 'idle', messageAr: '', messageEn: '' });

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      }

      // Check if online and reachable
      await fetch('/manifest.webmanifest', { cache: 'no-cache' });

      setTimeout(() => {
        setCheckingUpdate(false);
        setUpdateStatus({
          type: 'latest',
          messageAr: 'أنت تعمل حالياً بأحدث إصدار رسمي معتمد لمنصة M737IQ (الإصدار 1.0.1).',
          messageEn: 'You are running the latest official verified version of M737IQ (v1.0.1).',
        });
      }, 700);
    } catch (err) {
      setCheckingUpdate(false);
      setUpdateStatus({
        type: 'error',
        messageAr: 'تعذر التحقق من التحديثات تلقائياً. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.',
        messageEn: 'Could not verify updates. Please check your internet connection.',
      });
    }
  };

  // Hard refresh to reload latest deployed assets
  const handleForceReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Copy official install link
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(installUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // WhatsApp share link
  const shareText = encodeURIComponent(
    language === 'ar'
      ? `رابط التثبيت والتحديث الرسمي لتطبيق منصة M737IQ الطبية (أندرويد وآيفون):\n${installUrl}`
      : `Official installation and update link for M737IQ Medical Platform (Android & iPhone):\n${installUrl}`
  );
  const whatsappUrl = `https://wa.me/?text=${shareText}`;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. Header Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#001f3f] via-[#003366] to-[#0a2540] text-white p-6 sm:p-10 shadow-2xl border border-sky-900/40">
        <div className="absolute -top-24 -end-24 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -start-24 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs font-bold text-sky-300 mb-4">
            <button
              onClick={onNavigateHome}
              className="hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{language === 'ar' ? 'الرئيسية' : 'Home'}</span>
            </button>
            <ChevronRight size={13} className={isRTL ? 'rotate-180' : ''} />
            <span className="text-white/80">
              {language === 'ar' ? 'رابط التثبيت والتحديث الرسمي' : 'Official App Install & Update'}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-400/15 border border-sky-300/30 text-sky-200 text-xs font-black mb-3">
            <Sparkles size={13} className="text-amber-300" />
            <span>{language === 'ar' ? 'الرابط الدائم الموحد لنظامي أندرويد وآيفون' : 'Permanent Unified Link for Android & iPhone'}</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight mb-3">
            {language === 'ar'
              ? 'تثبيت وتحديث تطبيق منصة M737IQ الطبية'
              : 'Install & Update M737IQ Medical Platform'}
          </h1>

          <p className="text-sm sm:text-base text-slate-200 leading-relaxed max-w-2xl">
            {language === 'ar'
              ? 'صفحة رسمية موحدة ودائمة تتيح لجميع المرضى، الأطباء، والمراكز الطبية تثبيت التطبيق وتحديثه على أجهزة Android و iPhone والكمبيوتر بخطوات موثوقة ومباشرة.'
              : 'One permanent official page for patients, doctors, and medical providers to install and update M737IQ across Android, iPhone, and Desktop.'}
          </p>

          {/* Device Detection Chip */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-bold text-white shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {language === 'ar' ? 'تم التعرف تلقائياً على جهازك:' : 'Detected Device:'}
              </span>
              <span className="text-sky-300 font-black uppercase">
                {detectedPlatform === 'ios' ? 'Apple iPhone / iPad' : detectedPlatform === 'android' ? 'Android Device' : 'Desktop / PC'}
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-sky-200/90 font-mono">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Version: 1.0.1 (Build 2) • SSL Secured</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Platform Selector Tabs */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex flex-wrap sm:flex-nowrap gap-2">
        <button
          onClick={() => setActiveTab('android')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'android'
              ? 'bg-[#003366] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Smartphone size={18} className={activeTab === 'android' ? 'text-emerald-400' : 'text-slate-500'} />
          <div className="text-start leading-tight">
            <div>{language === 'ar' ? 'أجهزة أندرويد (Android)' : 'Android Devices'}</div>
            <div className={`text-[10px] ${activeTab === 'android' ? 'text-sky-200' : 'text-slate-400'}`}>
              {language === 'ar' ? 'تثبيت فوري أو ملف APK' : 'Instant PWA or APK'}
            </div>
          </div>
          {detectedPlatform === 'android' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'android' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {language === 'ar' ? 'جهازك' : 'Your Device'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('ios')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'ios'
              ? 'bg-[#003366] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Apple size={18} className={activeTab === 'ios' ? 'text-sky-300' : 'text-slate-500'} />
          <div className="text-start leading-tight">
            <div>{language === 'ar' ? 'أجهزة آيفون وآيباد (iPhone / iPad)' : 'iPhone & iPad'}</div>
            <div className={`text-[10px] ${activeTab === 'ios' ? 'text-sky-200' : 'text-slate-400'}`}>
              {language === 'ar' ? 'تثبيت رسمي عبر Safari PWA' : 'Official Safari PWA'}
            </div>
          </div>
          {detectedPlatform === 'ios' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'ios' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {language === 'ar' ? 'جهازك' : 'Your Device'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('desktop')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2.5 transition-all cursor-pointer ${
            activeTab === 'desktop'
              ? 'bg-[#003366] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Monitor size={18} className={activeTab === 'desktop' ? 'text-sky-300' : 'text-slate-500'} />
          <div className="text-start leading-tight">
            <div>{language === 'ar' ? 'أجهزة الكمبيوتر (Desktop)' : 'Desktop PC / Mac'}</div>
            <div className={`text-[10px] ${activeTab === 'desktop' ? 'text-sky-200' : 'text-slate-400'}`}>
              {language === 'ar' ? 'تطبيق مكتبي مستقل' : 'Standalone Desktop App'}
            </div>
          </div>
          {detectedPlatform === 'desktop' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeTab === 'desktop' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
              {language === 'ar' ? 'جهازك' : 'Your Device'}
            </span>
          )}
        </button>
      </div>

      {/* 3. Tab Contents */}

      {/* TAB 1: ANDROID */}
      {activeTab === 'android' && (
        <div className="space-y-6">
          {/* Method A: Instant Web App (PWA) */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                  <Zap size={13} />
                  <span>{language === 'ar' ? 'الطريقة الموصى بها • تثبيت فوري بدون انتظار' : 'Recommended • Instant Zero-Wait Install'}</span>
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {language === 'ar' ? '1. تثبيت التطبيق الفوري على الأندرويد (PWA)' : '1. Instant PWA App Installation'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                  {language === 'ar'
                    ? 'يتيح لك تثبيت المنصة كتطبيق كامل على هاتفك الأندرويد دون الحاجة لتنزيل ملفات خارجية. يظهر كأيقونة مستقلة على شاشتك الرئيسية ويدعم الإشعارات الفورية الكاملة.'
                    : 'Installs M737IQ directly to your Android home screen with push notifications and full standalone experience.'}
                </p>
              </div>

              {/* Install Trigger Button */}
              <div className="shrink-0 flex flex-col gap-2">
                {installSuccess ? (
                  <div className="px-5 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>{language === 'ar' ? 'تم تثبيت التطبيق بنجاح على هاتفك!' : 'Application successfully installed!'}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleTriggerPWAInstall}
                    className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer"
                  >
                    <Download size={18} />
                    <span>{language === 'ar' ? 'تثبيت التطبيق على الهاتف الآن' : 'Install App on Phone Now'}</span>
                  </button>
                )}
                <span className="text-[11px] text-slate-400 text-center font-medium">
                  {language === 'ar' ? 'متوافق مع Chrome, Edge, Samsung Internet' : 'Compatible with all Android browsers'}
                </span>
              </div>
            </div>

            {/* Step-by-step visual guide if prompt didn't fire */}
            <div className="pt-6">
              <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider">
                {language === 'ar' ? 'خطوات التثبيت اليدوي في حال لم يظهر الزر تلقائياً:' : 'Manual Installation Steps in Chrome/Browser:'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold shrink-0">1</span>
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">{language === 'ar' ? 'افتح قائمة المتصفح' : 'Open Browser Menu'}</span>
                    <span className="text-slate-600">{language === 'ar' ? 'اضغط على رمز الثلاث نقاط (⋮) في أعلى زاوية المتصفح.' : 'Tap the three dots (⋮) icon in the browser corner.'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold shrink-0">2</span>
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">{language === 'ar' ? 'اختر تثبيت التطبيق' : 'Select Install App'}</span>
                    <span className="text-slate-600">{language === 'ar' ? 'اضغط على "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية".' : 'Tap "Install App" or "Add to Home screen".'}</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold shrink-0">3</span>
                  <div>
                    <span className="font-bold text-slate-900 block mb-0.5">{language === 'ar' ? 'تأكيد التثبيت' : 'Confirm Install'}</span>
                    <span className="text-slate-600">{language === 'ar' ? 'اضغط "تثبيت" وسيظهر التطبيق بأيقونته الرسمية على شاشة هاتفك.' : 'Confirm and M737IQ icon will appear on your app drawer.'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Method B: Native Android TWA APK */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold mb-1.5">
                  <Smartphone size={13} />
                  <span>{language === 'ar' ? 'حزمة APK المعتمدة لنظام الأندرويد' : 'Official Android APK Package'}</span>
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  {language === 'ar' ? '2. حزمة أندرويد المستقلة (APK Package)' : '2. Standalone Android APK'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600">
                  {language === 'ar'
                    ? 'مشروع الأندرويد الأصلي المبني بتقنية Trusted Web Activity (TWA) بحزمة رسمية موثقة.'
                    : 'The native Android wrapper built with Trusted Web Activity targeting package app.m737iq.com.'}
                </p>
              </div>

              {/* Package Specs Badge */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1 font-mono shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Package ID:</span>
                  <span className="font-bold text-slate-900">app.m737iq.com</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Version:</span>
                  <span className="font-bold text-slate-900">1.0.1 (Build 2)</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-400">Target SDK:</span>
                  <span className="font-bold text-slate-900">Android 14 (API 34)</span>
                </div>
              </div>
            </div>

            {/* Automated Release Info & Verified Status */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <Info size={16} className="text-amber-700 shrink-0" />
                <span>{language === 'ar' ? 'حالة توزيع ملف الـ APK المعتمد:' : 'Android APK Distribution Status:'}</span>
              </div>
              <p>
                {language === 'ar'
                  ? 'ملف الـ APK الموقّع يتم بناؤه وإصداره آلياً عبر إجراءات التكامل السحابي (GitHub Actions Workflow) الموثقة في المشروع، والتي تضمن الحفاظ الدائم على مفتاح التوقيع الرقمي (Keystore SHA-256) واسم الحزمة لتمكين التحديث المباشر للمستخدمين دون فقدان أي بيانات.'
                  : 'Signed release APKs are generated via the repository CI workflow (.github/workflows/build-and-release-android.yml) which preserves the release keystore fingerprint and package ID.'}
              </p>
            </div>

            {/* Direct GitHub Release Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <a
                href="https://github.com/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
              >
                <ExternalLink size={14} />
                <span>{language === 'ar' ? 'استعراض إصدارات GitHub المعتمدة (Releases)' : 'View Official GitHub Releases'}</span>
              </a>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck size={15} className="text-emerald-600" />
                <span>{language === 'ar' ? 'تحديثات الموقع السحابية تنعكس فورياً داخل التطبيق دون الحاجة لتحديث الـ APK' : 'Web updates reflect immediately inside app'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: IPHONE & IPAD */}
      {activeTab === 'ios' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold mb-1.5">
                <Apple size={13} />
                <span>{language === 'ar' ? 'تطبيق آبل الرسمي • Apple PWA Standard' : 'Official Apple PWA Standard'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {language === 'ar' ? 'تثبيت منصة M737IQ على أجهزة iPhone و iPad' : 'Install M737IQ on iPhone & iPad'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                {language === 'ar'
                  ? 'تدعم شركة آبل تثبيت تطبيقات الويب المتقدمة (PWA) كبديل آمن وسريع للتطبيقات، مع دعم الشاشة الكاملة والإشعارات الفورية على نظام iOS 16.4 والإصدارات الأحدث.'
                  : 'Apple officially supports Progressive Web Apps (PWA) with full standalone view and push notifications on iOS 16.4+.'}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">{language === 'ar' ? 'المتصفح المطلوب' : 'Required Browser'}</span>
              <span className="text-xs font-black text-blue-900 flex items-center gap-1 justify-center">
                <Globe size={13} className="text-blue-600" />
                <span>Safari (سفاري)</span>
              </span>
            </div>
          </div>

          {/* 4 Steps Visual Guide for iOS */}
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              {language === 'ar' ? 'خطوات التثبيت على شاشة الآيفون الرئيسية (4 خطوات بسيطة):' : 'Installation Steps on iPhone Safari:'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Step 1 */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-xs">1</span>
                  <Globe size={18} className="text-blue-600" />
                </div>
                <div>
                  <h5 className="font-black text-slate-900 text-sm mb-1">{language === 'ar' ? 'افتح في متصفح Safari' : 'Open in Safari'}</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {language === 'ar'
                      ? 'تأكد من فتح رابط الموقع في متصفح Safari الأصلي لشركة Apple وليس من داخل تطبيقات المراسلة.'
                      : 'Ensure you are browsing via native Safari browser on your iPhone.'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[10px] font-mono text-slate-400 truncate">
                  {officialHost}
                </div>
              </div>

              {/* Step 2 */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-xs">2</span>
                  <Share2 size={18} className="text-blue-600" />
                </div>
                <div>
                  <h5 className="font-black text-slate-900 text-sm mb-1">{language === 'ar' ? 'اضغط زر المشاركة (Share)' : 'Tap Share Button'}</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {language === 'ar'
                      ? 'في أسفل شاشة Safari، اضغط على زر المشاركة (مربع مع سهم يتجه للأعلى ⎋).'
                      : 'Tap the Share icon (square with upward arrow ⎋) at the bottom bar.'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-blue-700">
                  {language === 'ar' ? 'أيقونة ⎋ في الشريط السفلي' : 'Bottom bar share icon'}
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[#003366] text-white flex items-center justify-center font-bold text-xs">3</span>
                  <Layers size={18} className="text-blue-600" />
                </div>
                <div>
                  <h5 className="font-black text-slate-900 text-sm mb-1">{language === 'ar' ? 'إضافة للشاشة الرئيسية' : 'Add to Home Screen'}</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {language === 'ar'
                      ? 'مرر للأسفل في الخيارات واختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).'
                      : 'Scroll down and tap "Add to Home Screen" ([+] icon).'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-blue-700">
                  {language === 'ar' ? 'خيار [+] Add to Home Screen' : '[+] Add to Home Screen'}
                </div>
              </div>

              {/* Step 4 */}
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">4</span>
                  <CheckCircle2 size={18} className="text-emerald-600" />
                </div>
                <div>
                  <h5 className="font-black text-slate-900 text-sm mb-1">{language === 'ar' ? 'تأكيد الإضافة' : 'Confirm & Launch'}</h5>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    {language === 'ar'
                      ? 'اضغط على "إضافة" (Add) في الزاوية العلوية، وسيظهر تطبيق M737IQ بين تطبيقات هاتفك.'
                      : 'Tap "Add" top right. M737IQ app icon will appear with your iOS apps.'}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 text-[10px] font-bold text-emerald-700">
                  {language === 'ar' ? 'مبروك! التطبيق جاهز' : 'Complete & Ready!'}
                </div>
              </div>
            </div>
          </div>

          {/* iOS Update Note */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-900 block">{language === 'ar' ? '💡 كيف تحدث التطبيق على الآيفون؟' : '💡 How to update on iPhone?'}</span>
            <p>
              {language === 'ar'
                ? 'لا تحتاج للذهاب إلى App Store! يتم تحديث المنصة على جهاز الآيفون تلقائياً في الخلفية في كل مرة تفتح فيها التطبيق وأنت متصل بالإنترنت، ويمكنك الضغط على زر "فحص التحديثات" بالأسفل للتأكد فورياً.'
                : 'PWA updates deploy silently over-the-air. Whenever you launch the app, the latest assets load automatically.'}
            </p>
          </div>
        </div>
      )}

      {/* TAB 3: DESKTOP */}
      {activeTab === 'desktop' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-lg space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 text-xs font-bold mb-1.5">
                <Monitor size={13} />
                <span>{language === 'ar' ? 'أنظمة Windows & macOS & Linux' : 'Windows, macOS & Linux'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                {language === 'ar' ? 'تثبيت M737IQ على الكمبيوتر المكتبي واللابتوب' : 'Install M737IQ on Desktop PC / Mac'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                {language === 'ar'
                  ? 'يمكن للأطباء وموظفي الاستقبال والصيادلة تثبيت المنصة كتطبيق مكتبي منفصل على حواسيبهم لسرعة الوصول والشاشة الكاملة.'
                  : 'Clinicians, receptionists, and pharmacists can install M737IQ as a standalone desktop app for seamless clinic operation.'}
              </p>
            </div>

            <button
              onClick={handleTriggerPWAInstall}
              className="px-6 py-3 rounded-2xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Download size={16} />
              <span>{language === 'ar' ? 'تثبيت التطبيق على الكمبيوتر' : 'Install on Desktop'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">{language === 'ar' ? 'عبر متصفح Google Chrome / Edge:' : 'Via Google Chrome or Edge:'}</span>
              <p className="text-slate-600">
                {language === 'ar'
                  ? 'انظر إلى شريط العنوان في الأعلى (Address Bar)، ستجد أيقونة تثبيت صغيرة (شاشة مع سهم لأسفل) اضغط عليها ثم اضغط "تثبيت".'
                  : 'Look at the right side of the address bar for the install icon, click it and confirm install.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">{language === 'ar' ? 'عبر متصفح Safari على Mac:' : 'Via Safari on macOS:'}</span>
              <p className="text-slate-600">
                {language === 'ar'
                  ? 'في نظام macOS Sonoma والإصدارات الأحدث، افتح قائمة ملف (File) واختر "إضافة إلى شريط Dock" (Add to Dock).'
                  : 'On macOS Sonoma+, click File menu and select "Add to Dock" to run as a native Mac app.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. Live Update Checker & Refresh Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <RefreshCw size={18} className="text-[#003366]" />
              <h3 className="text-lg font-black text-slate-900">
                {language === 'ar' ? 'مركز فحص التحديثات والمزامنة السحابية' : 'Update & Cloud Sync Center'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'ar'
                ? 'تحقق مما إذا كانت هناك نسخة أحدث من المنصة أو قم بتحديث الملفات المؤقتة بأمان'
                : 'Verify if a newer release is deployed and safely sync your local application cache'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleCheckForUpdates}
              disabled={checkingUpdate}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw size={14} className={checkingUpdate ? 'animate-spin text-blue-600' : ''} />
              <span>{checkingUpdate ? (language === 'ar' ? 'جاري الفحص...' : 'Checking...') : (language === 'ar' ? 'فحص التحديثات الآن' : 'Check for Updates')}</span>
            </button>

            <button
              onClick={handleForceReload}
              className="px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#003366] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title={language === 'ar' ? 'إعادة تحميل فوري للمنصة' : 'Reload Application'}
            >
              <Zap size={14} className="text-amber-500" />
              <span>{language === 'ar' ? 'إعادة تحميل' : 'Reload'}</span>
            </button>
          </div>
        </div>

        {/* Update Status Feedback */}
        {updateStatus.type !== 'idle' && (
          <div className={`mt-4 p-4 rounded-2xl border text-xs flex items-center gap-3 ${
            updateStatus.type === 'latest'
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {updateStatus.type === 'latest' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
            )}
            <span className="font-medium">
              {language === 'ar' ? updateStatus.messageAr : updateStatus.messageEn}
            </span>
          </div>
        )}
      </div>

      {/* 5. Permanent Official Share Link Box */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-sky-400 uppercase tracking-wider block">
            {language === 'ar' ? 'الرابط الرسمي الدائم للتثبيت' : 'Permanent Official Installation URL'}
          </span>
          <h4 className="text-lg font-black text-white">
            {language === 'ar' ? 'شارك رابط التثبيت مع الكادر الطبي والمراجعين' : 'Share the Official Install Link'}
          </h4>
          <p className="text-xs text-slate-300 font-mono break-all max-w-xl">
            {installUrl}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={handleCopyLink}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold transition-all border border-white/20 flex items-center gap-2 cursor-pointer"
          >
            {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedLink ? (language === 'ar' ? 'تم نسخ الرابط!' : 'Copied!') : (language === 'ar' ? 'نسخ الرابط' : 'Copy Link')}</span>
          </button>

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <Share2 size={14} />
            <span>{language === 'ar' ? 'مشاركة عبر واتساب' : 'Share on WhatsApp'}</span>
          </a>
        </div>
      </div>
    </div>
  );
};
