import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  X, 
  Mail, 
  Lock, 
  LogIn, 
  KeyRound, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'reset';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const { 
    signInWithEmail, 
    signInWithGoogle, 
    sendPasswordReset, 
    loading, 
    authError, 
    clearAuthError,
    setShowDomainHelp
  } = useAuth();
  const { language, isRTL } = useLanguage();

  const [mode, setMode] = useState<'signin' | 'reset'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccessEmail, setResetSuccessEmail] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    clearAuthError();
    setFormError(null);
    setResetSuccessEmail(null);
    onClose();
  };

  const handleSwitchToReset = () => {
    clearAuthError();
    setFormError(null);
    setResetSuccessEmail(null);
    setMode('reset');
  };

  const handleSwitchToSignIn = () => {
    clearAuthError();
    setFormError(null);
    setResetSuccessEmail(null);
    setMode('signin');
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError(language === 'ar' ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter email');
      return;
    }
    if (!password) {
      setFormError(language === 'ar' ? 'يرجى إدخال كلمة المرور' : 'Please enter password');
      return;
    }

    try {
      setSubmitting(true);
      await signInWithEmail(cleanEmail, password);
      handleClose();
    } catch {
      // Error handled in AuthContext and state
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();
    setResetSuccessEmail(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setFormError(language === 'ar' ? 'يرجى إدخال عنوان البريد الإلكتروني أولاً' : 'Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setFormError(language === 'ar' ? 'يرجى كتابة عنوان بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }

    try {
      setSubmitting(true);
      await sendPasswordReset(cleanEmail);
      setResetSuccessEmail(cleanEmail);
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : (language === 'ar' ? 'فشل إرسال رابط الاستعادة' : 'Reset failed');
      setFormError(errText);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      handleClose();
    } catch {
      // Handled in context
    }
  };

  const handleOpenSandbox = () => {
    handleClose();
    setShowDomainHelp(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden my-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-[#003366] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              {mode === 'reset' ? <KeyRound size={20} /> : <LogIn size={20} />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {mode === 'reset' 
                  ? (language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password')
                  : (language === 'ar' ? 'تسجيل الدخول إلى M737' : 'Sign in to M737')}
              </h2>
              <p className="text-xs text-slate-300">
                {mode === 'reset'
                  ? (language === 'ar' ? 'إرسال رابط إعادة التعيين الرسمي' : 'Official Firebase password reset')
                  : (language === 'ar' ? 'البوابة الطبية الموحدة للرعاية الصحية' : 'Unified Digital Healthcare Platform')}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 text-slate-800 text-sm">
          {/* Active Error Alerts */}
          {(formError || authError) && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 leading-relaxed animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
              <div className="flex-1">{formError || authError}</div>
            </div>
          )}

          {/* MODE: Password Reset */}
          {mode === 'reset' && (
            <div>
              {resetSuccessEmail ? (
                /* Success State */
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 animate-in zoom-in-95">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto text-emerald-700">
                    <CheckCircle2 size={28} />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-sm sm:text-base text-emerald-900">
                      {language === 'ar' ? 'تم إرسال رابط الاستعادة بنجاح!' : 'Reset Link Sent Successfully!'}
                    </h3>
                    <p className="text-xs text-emerald-800 leading-relaxed font-mono">
                      {resetSuccessEmail}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/80 border border-emerald-100 text-xs text-slate-700 leading-relaxed space-y-1">
                    <p>
                      {language === 'ar' 
                        ? '1. يرجى فحص صندوق الوارد (Inbox) أو مجلد الرسائل غير المرغوب فيها (Spam / Junk).'
                        : '1. Please check your inbox or spam/junk folder.'}
                    </p>
                    <p>
                      {language === 'ar'
                        ? '2. اضغط على الرابط المرسل من Firebase لإدخال كلمة المرور الجديدة.'
                        : '2. Click the Firebase link to set your new password.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchToSignIn}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#002244] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>{language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}</span>
                    {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                  </button>
                </div>
              ) : (
                /* Reset Form */
                <form onSubmit={handleResetSubmit} className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-950 text-xs leading-relaxed flex items-start gap-2">
                    <KeyRound size={16} className="shrink-0 mt-0.5 text-[#003366]" />
                    <p>
                      {language === 'ar'
                        ? 'أدخل بريدك الإلكتروني المسجل في المنصة، وسنرسل لك رابطاً مشفراً من Firebase لإعادة تعيين كلمة المرور فوراً.'
                        : 'Enter your registered email address and we will send you an official Firebase password reset link.'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      {language === 'ar' ? 'البريد الإلكتروني المسجل' : 'Registered Email Address'}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                        <Mail size={16} />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="doctor@m737.iq"
                        className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={submitting || loading}
                      className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#003366] hover:bg-[#002244] disabled:opacity-50 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>{language === 'ar' ? 'جارٍ إرسال الرابط...' : 'Sending Link...'}</span>
                        </>
                      ) : (
                        <>
                          <Mail size={15} />
                          <span>{language === 'ar' ? 'إرسال رابط إعادة التعيين' : 'Send Password Reset Link'}</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleSwitchToSignIn}
                      className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {language === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Back to Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* MODE: Sign In */}
          {mode === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'ar' ? 'كلمة المرور' : 'Password'}
                  </label>
                  <button
                    type="button"
                    onClick={handleSwitchToReset}
                    className="text-[11px] font-bold text-[#003366] hover:text-[#c4152e] hover:underline cursor-pointer transition-colors"
                  >
                    {language === 'ar' ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-slate-400">
                    <Lock size={16} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="w-full mt-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#003366] hover:bg-[#002244] disabled:opacity-50 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{language === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing In...'}</span>
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                  </>
                )}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold">
                    {language === 'ar' ? 'أو' : 'OR'}
                  </span>
                </div>
              </div>

              {/* Google Sign-in */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{language === 'ar' ? 'المتابعة بحساب Google' : 'Continue with Google'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>{language === 'ar' ? 'مصادقة Firebase مشفرة' : 'Encrypted Firebase Auth'}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
