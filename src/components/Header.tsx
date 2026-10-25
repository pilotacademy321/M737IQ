import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';
import { 
  Menu, 
  X, 
  Globe, 
  Search, 
  Bell, 
  Mail, 
  ChevronDown, 
  LogIn, 
  LogOut, 
  KeyRound, 
  Trash2, 
  UserCheck, 
  User, 
  ShieldCheck, 
  CheckCircle2,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { PortalId } from '../types';

interface HeaderProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  selectedPortalId: string | null;
  onResetToHome: () => void;
  onToggleSidebar?: () => void;
  onSelectPortal?: (portalId: PortalId) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  selectedPortalId,
  onResetToHome,
  onToggleSidebar,
  onSelectPortal,
}) => {
  const { language, setLanguage, isRTL } = useLanguage();
  const { 
    user, 
    userProfile, 
    loading: authLoading, 
    signOut, 
    deleteOwnAccountPermanently,
    setShowDomainHelp,
    unauthorizedDomainDetected
  } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalInitialMode, setAuthModalInitialMode] = useState<'signin' | 'reset'>('signin');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
  const [isDeletingOwnAccount, setIsDeletingOwnAccount] = useState(false);
  const [selfDeleteError, setSelfDeleteError] = useState<string | null>(null);

  const accountRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setShowAccountDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSelectPortal) {
        onSelectPortal('pharmacy');
      } else {
        onNavigate('portals');
      }
    }
  };

  const currentRoleLabel = userProfile?.role 
    ? (language === 'ar'
        ? {
            patient: 'مريض',
            doctor: 'طبيب معتمد',
            pharmacy: 'صيدلية أهلية',
            laboratory: 'مختبر طبي',
            radiology_center: 'مركز أشعة',
            wholesaler: 'مذخر أدوية',
            secretary: 'سكرتارية واستقبال',
            super_admin: 'إدارة عليا'
          }[userProfile.role] || userProfile.role
        : userProfile.role)
    : (language === 'ar' ? 'مريض' : 'Patient');

  const currentDisplayName = userProfile?.displayName || user?.displayName || (language === 'ar' ? 'أحمد محمد' : 'Ahmed Mohammed');

  return (
    <>
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 transition-all duration-200">
        <div className="px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Right side in RTL: Mobile menu toggle + Global Search Bar */}
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              {/* Mobile Sidebar Hamburger Button */}
              {onToggleSidebar && (
                <button
                  onClick={onToggleSidebar}
                  className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  aria-label="Toggle Navigation Menu"
                >
                  <Menu size={22} />
                </button>
              )}

              {/* Mockup Search Bar */}
              <form onSubmit={handleSearchSubmit} className="relative w-full">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      language === 'ar'
                        ? 'ابحث عن الأطباء، التخصصات، أو الخدمات...'
                        : 'Search doctors, specialties, or medical services...'
                    }
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 rounded-full py-2 sm:py-2.5 ps-10 pe-4 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-hidden"
                  />
                  <div className="absolute start-3.5 text-slate-400 pointer-events-none">
                    <Search size={17} />
                  </div>
                </div>
              </form>
            </div>

            {/* Left side in RTL: Language, Messages, Notifications, User Profile Chip */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Language Switcher Pill */}
              <button
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                title={language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
              >
                <Globe size={15} className="text-slate-500" />
                <span>{language === 'ar' ? 'العربية' : 'English'}</span>
              </button>

              {/* Direct Messages / Contact Mail Icon */}
              <button
                onClick={() => onNavigate('support')}
                className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer relative"
                title={language === 'ar' ? 'الرسائل والدعم' : 'Messages & Support'}
              >
                <Mail size={18} />
              </button>

              {/* Notifications Bell with Red Badge count */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotificationsDropdown((prev) => !prev)}
                  className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-colors cursor-pointer relative"
                  title={language === 'ar' ? 'الإشعارات' : 'Notifications'}
                >
                  <Bell size={18} />
                  <span className="absolute top-1 end-1 w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                    1
                  </span>
                </button>

                {/* Notifications Dropdown */}
                {showNotificationsDropdown && (
                  <div className="absolute top-full mt-2 end-0 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="font-extrabold text-xs text-slate-900">
                        {language === 'ar' ? 'الإشعارات الحديثة' : 'Recent Notifications'}
                      </span>
                      <span className="text-[10px] bg-red-50 text-red-600 font-bold px-1.5 py-0.5 rounded-md">
                        1 جديد
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                          <Calendar size={14} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {language === 'ar' ? 'تأكيد موعد العيادة' : 'Clinic Appointment Confirmed'}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {language === 'ar' ? 'تم تأكيد موعدك بنجاح مع د. سارة محمد.' : 'Your appointment with Dr. Sara Mohammed is confirmed.'}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {language === 'ar' ? 'منذ 5 دقائق' : '5 mins ago'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Chip (Avatar + Name + Role + Dropdown) */}
              <div className="relative" ref={accountRef}>
                <button
                  onClick={() => setShowAccountDropdown((prev) => !prev)}
                  className="flex items-center gap-2.5 p-1 sm:ps-1 sm:pe-3 rounded-full hover:bg-slate-100 border border-slate-200/80 transition-colors cursor-pointer group"
                >
                  {/* User Avatar */}
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-blue-700 to-sky-400 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={currentDisplayName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={16} />
                    )}
                    <span className="absolute bottom-0 end-0 w-2 h-2 rounded-full bg-emerald-500 border border-white" />
                  </div>

                  {/* Name and Role Title */}
                  <div className="hidden sm:flex flex-col text-start leading-tight">
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[110px]">
                      {currentDisplayName}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 truncate">
                      {currentRoleLabel}
                    </span>
                  </div>

                  <ChevronDown size={14} className="text-slate-400 group-hover:text-slate-700 transition-transform" />
                </button>

                {/* Account Actions Dropdown */}
                {showAccountDropdown && (
                  <div className="absolute top-full mt-2 end-0 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="p-3 bg-slate-50 rounded-xl mb-1.5 border border-slate-100">
                      <div className="text-xs font-black text-slate-900 truncate">{currentDisplayName}</div>
                      <div className="text-[11px] text-slate-500 truncate">{user?.email || (language === 'ar' ? 'مستخدم المنصة' : 'Platform User')}</div>
                      <div className="mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                        {currentRoleLabel}
                      </div>
                    </div>

                    <div className="space-y-0.5 text-xs font-medium text-slate-700">
                      {user ? (
                        <>
                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              setShowAccountModal(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-start cursor-pointer"
                          >
                            <UserCheck size={15} className="text-blue-600" />
                            <span>{language === 'ar' ? 'بيانات الحساب والاعتماد' : 'Account Details'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              signOut();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors text-start cursor-pointer"
                          >
                            <LogOut size={15} />
                            <span>{language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              setAuthModalInitialMode('signin');
                              setAuthModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-700 transition-colors text-start font-bold cursor-pointer"
                          >
                            <LogIn size={15} />
                            <span>{language === 'ar' ? 'تسجيل الدخول / إنشاء حساب' : 'Sign In / Register'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setShowAccountDropdown(false);
                              setAuthModalInitialMode('reset');
                              setAuthModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors text-start cursor-pointer"
                          >
                            <KeyRound size={15} />
                            <span>{language === 'ar' ? 'استعادة كلمة المرور' : 'Reset Password'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalInitialMode}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Account Management Modal */}
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

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAccountModal(false);
                  setShowSelfDeleteModal(true);
                }}
                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>{language === 'ar' ? 'حذف الحساب نهائياً' : 'Delete Account'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Own Account Confirmation Modal */}
      {showSelfDeleteModal && user && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-red-200 space-y-4">
            <h3 className="text-lg font-black text-red-600">
              {language === 'ar' ? 'تأكيد حذف الحساب نهائياً' : 'Confirm Account Deletion'}
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === 'ar'
                ? 'تحذير: سيتم حذف بيانات حسابك وجميع السجلات والملفات الخاصة بك بشكل دائم لا يمكن التراجع عنه.'
                : 'Warning: This action will permanently erase your user profile and all associated data.'}
            </p>

            {selfDeleteError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {selfDeleteError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSelfDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmSelfDelete}
                disabled={isDeletingOwnAccount}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 cursor-pointer"
              >
                {isDeletingOwnAccount ? (language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : (language === 'ar' ? 'نعم، احذف الحساب' : 'Yes, Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
