import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { AuthModal } from './AuthModal';
import { Menu, X, Globe, ArrowLeft, ArrowRight, LogIn, LogOut, KeyRound, Trash2, RefreshCw, UserCheck, Instagram } from 'lucide-react';

interface HeaderProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  selectedPortalId: string | null;
  onResetToHome: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  selectedPortalId,
  onResetToHome,
}) => {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { 
    user, 
    userProfile, 
    loading: authLoading, 
    signInWithGoogle, 
    signOut,
    isDemoMode,
    setShowDomainHelp,
    unauthorizedDomainDetected,
    deleteOwnAccountPermanently
  } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'signin' | 'reset'>('signin');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
  const [isDeletingOwnAccount, setIsDeletingOwnAccount] = useState(false);
  const [selfDeleteError, setSelfDeleteError] = useState<string | null>(null);

  const handleConfirmSelfDelete = async () => {
    setIsDeletingOwnAccount(true);
    setSelfDeleteError(null);
    try {
      await deleteOwnAccountPermanently();
      setShowSelfDeleteModal(false);
      setShowAccountModal(false);
      onResetToHome();
    } catch (err: unknown) {
      console.error('Error deleting account:', err);
      const msg = err instanceof Error ? err.message : (language === 'ar' ? 'فشل حذف الحساب' : 'Failed to delete account');
      setSelfDeleteError(msg);
    } finally {
      setIsDeletingOwnAccount(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: t.nav.home },
    { id: 'portals', label: language === 'ar' ? 'بوابات المنصة' : 'Portals' },
    { id: 'about', label: t.nav.about },
    { id: 'support', label: language === 'ar' ? 'الدعم والتواصل' : 'Support' },
  ];

  const handleLinkClick = (id: string) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/80 py-2.5'
          : 'bg-white/90 backdrop-blur-sm border-b border-slate-100 py-3.5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6">
          {/* Zone 1: Brand Logo */}
          <button
            onClick={() => {
              onResetToHome();
              onNavigate('home');
            }}
            className="flex items-center gap-2 group text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#003366] rounded-lg p-1"
            aria-label={t.brandName}
          >
            <Logo size="sm" showTagline={true} />
          </button>

          {/* Zone 2: Navigation Links (Desktop) */}
          <nav
            className="hidden md:flex items-center gap-1 lg:gap-2"
            aria-label="Main Navigation"
          >
            {navItems.map((item) => {
              const isActive = activeSection === item.id && !selectedPortalId;
              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.id)}
                  className={`px-3 py-1.5 text-sm font-semibold transition-all rounded-md relative whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'text-[#003366] font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#c4152e] rounded-full transition-all" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Language Switcher, Auth Profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Language Switcher Button Group */}
            <div
              className="flex items-center bg-slate-100 border border-slate-200 rounded-full p-0.5"
              role="group"
              aria-label="Language Selector"
            >
              <button
                type="button"
                onClick={() => setLanguage('ar')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  language === 'ar'
                    ? 'bg-[#003366] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={language === 'ar'}
              >
                AR
              </button>
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  language === 'en'
                    ? 'bg-[#003366] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-pressed={language === 'en'}
              >
                EN
              </button>
            </div>

            {/* User Account / Sign In State */}
            {user ? (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => setShowAccountModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-xs font-bold text-[#003366] flex items-center gap-2 transition-colors cursor-pointer"
                  title={language === 'ar' ? 'إدارة الحساب والإعدادات' : 'Account Management & Settings'}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="max-w-[110px] truncate">{userProfile?.displayName || user.displayName || user.email?.split('@')[0]}</span>
                </button>
                <button
                  onClick={signOut}
                  title={language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setAuthModalInitialMode('signin');
                    setAuthModalOpen(true);
                  }}
                  disabled={authLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                >
                  <LogIn size={14} className="text-[#003366]" />
                  <span>{language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}</span>
                </button>
                <button
                  onClick={() => {
                    setAuthModalInitialMode('reset');
                    setAuthModalOpen(true);
                  }}
                  title={language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-[#003366] hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                >
                  <KeyRound size={15} />
                </button>
                {unauthorizedDomainDetected && (
                  <button
                    onClick={() => setShowDomainHelp(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-colors cursor-pointer"
                    title={language === 'ar' ? 'تصريح نطاق المعاينة في Firebase' : 'Authorize Preview Domain in Firebase'}
                  >
                    <span>{language === 'ar' ? 'تصريح النطاق' : 'Fix Domain'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Official Instagram Link (Desktop) */}
            <a
              href="https://www.instagram.com/m737iq"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 transition-colors shadow-xs"
              title="حساب إنستغرام: @m737iq"
            >
              <Instagram size={14} className="text-pink-600" />
              <span className="font-mono">@m737iq</span>
            </a>

            {/* Quick Portals CTA Button (Desktop) */}
            <button
              onClick={() => handleLinkClick('portals')}
              className="hidden lg:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white brand-gradient-btn shadow-sm hover:shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <span>{t.nav.getStarted}</span>
              {isRTL ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#003366]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-6 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const isActive = activeSection === item.id && !selectedPortalId;
              return (
                <button
                  key={item.id}
                  onClick={() => handleLinkClick(item.id)}
                  className={`text-start px-3 py-2.5 text-base font-semibold rounded-lg transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-slate-100 text-[#003366] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <div className="pt-3 mt-2 border-t border-slate-100 flex flex-col gap-2">
              {user ? (
                <div className="flex flex-col gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-slate-900">{userProfile?.displayName || user.displayName || user.email}</span>
                    </div>
                    {isDemoMode && (
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                        Demo
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {userProfile?.role ? `الدور: ${userProfile.role}` : user.email}
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowAccountModal(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-[#003366] bg-blue-50 hover:bg-blue-100 text-center cursor-pointer"
                    >
                      {language === 'ar' ? 'إدارة الحساب' : 'Manage Account'}
                    </button>
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setShowSelfDeleteModal(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 cursor-pointer flex items-center gap-1"
                      title={language === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account'}
                    >
                      <Trash2 size={12} />
                      <span>{language === 'ar' ? 'حذف الحساب' : 'Delete'}</span>
                    </button>
                    <button
                      onClick={signOut}
                      className="py-1.5 px-3 rounded-lg text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 cursor-pointer"
                    >
                      {language === 'ar' ? 'خروج' : 'Logout'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setAuthModalInitialMode('signin');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 rounded-lg text-xs font-bold text-white bg-[#003366] hover:bg-[#002244] text-center cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn size={14} />
                    <span>{language === 'ar' ? 'تسجيل الدخول / الدخول بالبريد' : 'Sign In'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setAuthModalInitialMode('reset');
                      setAuthModalOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-center cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <KeyRound size={14} />
                    <span>{language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}</span>
                  </button>
                  {unauthorizedDomainDetected && (
                    <button
                      onClick={() => {
                        setShowDomainHelp(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full py-2 rounded-lg text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-center cursor-pointer"
                    >
                      {language === 'ar' ? 'تصريح نطاق المعاينة في Firebase' : 'Authorize Domain in Firebase'}
                    </button>
                  )}
                </div>
              )}
              <a
                href="https://www.instagram.com/m737iq"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-lg text-xs font-bold text-pink-700 bg-pink-50 hover:bg-pink-100 border border-pink-200 text-center cursor-pointer flex items-center justify-center gap-2 transition-colors"
              >
                <Instagram size={15} className="text-pink-600" />
                <span>{language === 'ar' ? 'إنستغرام المنصة: @m737iq' : 'Instagram: @m737iq'}</span>
              </a>

              <button
                onClick={() => handleLinkClick('portals')}
                className="w-full py-2.5 rounded-lg text-sm font-bold text-white brand-gradient-btn text-center shadow-sm"
              >
                {t.nav.getStarted}
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Unified Authentication & Password Reset Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* ==================================================== */}
      {/* MODAL: USER ACCOUNT MANAGEMENT */}
      {/* ==================================================== */}
      {showAccountModal && user && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-100 text-[#003366] flex items-center justify-center font-bold">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {language === 'ar' ? 'إدارة الحساب الطبي المعتمد' : 'Account Management'}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {userProfile?.displayName || user.displayName || user.email}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Account Details Box */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">{language === 'ar' ? 'الاسم الكامل:' : 'Full Name:'}</span>
                <span className="font-bold text-slate-800">{userProfile?.displayName || user.displayName || 'غير محدد'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">{language === 'ar' ? 'البريد الإلكتروني:' : 'Email:'}</span>
                <span className="font-mono text-slate-800 font-semibold">{user.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500">{language === 'ar' ? 'الدور المصرح:' : 'Role:'}</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#003366] font-bold">
                  {userProfile?.role || 'مستخدم عام'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500">{language === 'ar' ? 'حالة الحساب:' : 'Account Status:'}</span>
                <span className={`px-2 py-0.5 rounded-md font-bold ${
                  userProfile?.status === 'approved' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : userProfile?.status === 'pending'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-200 text-slate-700'
                }`}>
                  {userProfile?.status === 'approved' 
                    ? (language === 'ar' ? 'معتمد' : 'Approved')
                    : userProfile?.status === 'pending'
                    ? (language === 'ar' ? 'قيد التدقيق' : 'Pending Review')
                    : (userProfile?.status || 'Active')}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  const roleToPortalMap: Record<string, string> = {
                    patient: 'patient',
                    doctor: 'doctor',
                    pharmacy: 'pharmacy',
                    laboratory: 'laboratory',
                    radiology_center: 'radiology',
                    wholesaler: 'wholesaler',
                    secretary: 'secretary',
                    super_admin: 'super_admin',
                  };
                  const portalTarget = (userProfile?.role && roleToPortalMap[userProfile.role]) || 'portals';
                  handleLinkClick(portalTarget);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs transition-colors cursor-pointer text-center"
              >
                {language === 'ar' ? 'فتح لوحة التشغيل / البوابة' : 'Open Workspace'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  signOut();
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogOut size={13} />
                <span>{language === 'ar' ? 'خروج' : 'Logout'}</span>
              </button>
            </div>

            {/* Danger Zone: Permanent Account Deletion */}
            <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-900">
                <Trash2 size={13} className="text-red-600" />
                <span>{language === 'ar' ? 'منطقة الخطر: حذف الحساب نهائياً' : 'Danger Zone: Delete Account'}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {language === 'ar'
                  ? 'سيتم حذف هويتك وكافة سجلاتك الرقمية والمهنية نهائياً من قاعدة بيانات Firestore.'
                  : 'Permanently remove your account and all associated records from Firestore.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  setShowSelfDeleteModal(true);
                }}
                className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} />
                <span>{language === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: SELF-SERVICE PERMANENT ACCOUNT DELETION */}
      {/* ==================================================== */}
      {showSelfDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {language === 'ar' ? 'تأكيد حذف الحساب نهائياً' : 'Confirm Permanent Deletion'}
                </h3>
                <span className="text-xs text-red-600 font-bold">
                  {language === 'ar' ? 'تحذير حاسم: لا يمكن التراجع عن هذا الإجراء' : 'Warning: Irreversible action'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-red-50/80 border border-red-200 text-xs text-slate-700 space-y-2">
              <p className="font-semibold text-red-950">
                {language === 'ar'
                  ? `هل أنت متأكد تماماً من رغبتك بحذف حسابك (${userProfile?.displayName || user?.email}) نهائياً من منصة M737 الطبية؟`
                  : `Are you sure you want to permanently delete your account (${userProfile?.displayName || user?.email})?`}
              </p>
              <p className="text-slate-600 leading-relaxed">
                {language === 'ar'
                  ? 'سيتم حذف هويتك الرقمية، ملفك وسجلاتك من قاعدة بيانات Firestore وإلغاء تسجيل الدخول نهائياً.'
                  : 'Your account and clinical profiles will be permanently purged.'}
              </p>
            </div>

            {selfDeleteError && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold">
                {selfDeleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingOwnAccount}
                onClick={() => {
                  setShowSelfDeleteModal(false);
                  setSelfDeleteError(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء والاحتفاظ بالحساب' : 'Cancel & Keep Account'}
              </button>
              <button
                type="button"
                disabled={isDeletingOwnAccount}
                onClick={handleConfirmSelfDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {isDeletingOwnAccount ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                <span>
                  {isDeletingOwnAccount
                    ? (language === 'ar' ? 'جارٍ حذف الحساب...' : 'Deleting...')
                    : (language === 'ar' ? 'نعم، حذف الحساب نهائياً' : 'Delete Account Now')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
