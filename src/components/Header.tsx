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
  ExternalLink,
  Check,
  CheckCheck,
  FileText,
  Stethoscope,
  Sparkles,
  Inbox,
  FlaskConical,
  Pill,
  Copy,
  Smartphone,
  BellRing
} from 'lucide-react';
import { generateFacilityOrUserId } from '../utils/medicalId';
import { PortalId } from '../types';
import { 
  AppNotification, 
  subscribeToUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  sendRealInAppNotification
} from '../lib/notificationService';

function formatRelativeTime(dateString: string, lang: 'ar' | 'en'): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return lang === 'ar' ? 'الآن' : 'Just now';
    if (diffMin < 60) return lang === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    if (diffHr < 24) return lang === 'ar' ? `منذ ${diffHr} ساعة` : `${diffHr}h ago`;
    return lang === 'ar' ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
  } catch {
    return dateString;
  }
}

interface HeaderProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  selectedPortalId: string | null;
  onResetToHome: () => void;
  onToggleSidebar?: () => void;
  onSelectPortal?: (portalId: PortalId) => void;
  onOpenNotificationSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeSection,
  onNavigate,
  selectedPortalId,
  onResetToHome,
  onToggleSidebar,
  onSelectPortal,
  onOpenNotificationSettings,
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
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Subscribe to real-time user notifications
  useEffect(() => {
    const unsubscribe = subscribeToUserNotifications(user?.uid, (items) => {
      setNotifications(items);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Derived unread count (Starts strictly at 0, no badge if 0)
  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkOneAsRead = async (notifId: string) => {
    // Optimistic local state update for instant badge clearing
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    await markNotificationAsRead(notifId);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingAll(true);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await markAllNotificationsAsRead(notifications);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!user) {
      setAuthModalInitialMode('signin');
      setAuthModalOpen(true);
      return;
    }
    await sendRealInAppNotification({
      recipientUid: user.uid,
      title: language === 'ar' ? 'تأكيد حجز موعد طبي' : 'Medical Appointment Confirmed',
      message: language === 'ar' 
        ? 'تم استلام وتأكيد موعدك بالمنصة بنجاح. يمكنك الضغط على "تمت القراءة" لإخفاء الشارة الحمراء فوراً.' 
        : 'Your appointment was confirmed. Click "Mark Read" to clear the red badge.',
      type: 'booking_update',
    });
  };

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
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

              {/* Notifications Bell with Dynamic Red Badge count */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setShowNotificationsDropdown((prev) => !prev)}
                  className={`p-2 rounded-full border transition-all cursor-pointer relative ${
                    showNotificationsDropdown 
                      ? 'bg-blue-50 text-blue-800 border-blue-200' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent hover:border-slate-200'
                  }`}
                  title={language === 'ar' ? 'الإشعارات والتنبيهات' : 'Notifications'}
                  aria-label="Notifications"
                >
                  <Bell size={18} />
                  {/* Badge strictly appears ONLY when unreadCount > 0, disappears on Mark Read */}
                  {unreadCount > 0 && (
                    <span className="absolute top-1 end-1 min-w-4.5 h-4.5 px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-75">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {showNotificationsDropdown && (
                  <div className="absolute top-full mt-2 end-0 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Bell size={16} className="text-blue-700" />
                        <span className="font-extrabold text-sm text-slate-900">
                          {language === 'ar' ? 'الإشعارات والتنبيهات' : 'Notifications'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {unreadCount > 0 ? (
                          <>
                            <span className="text-[10px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-100">
                              {unreadCount} {language === 'ar' ? 'جديد' : 'new'}
                            </span>
                            <button
                              onClick={handleMarkAllAsRead}
                              disabled={isMarkingAll}
                              className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                              title={language === 'ar' ? 'تحديد كل الإشعارات كمقروءة لإخفاء الشارة' : 'Mark all as read to clear badge'}
                            >
                              <CheckCheck size={13} />
                              <span>{language === 'ar' ? 'قراءة الكل' : 'Mark all read'}</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                            <CheckCheck size={12} />
                            <span>{language === 'ar' ? 'الكل مقروء' : 'All caught up'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Notifications List or Empty State */}
                    {notifications.length === 0 ? (
                      <div className="py-7 text-center px-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2.5">
                          <Inbox size={22} />
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 mb-1">
                          {language === 'ar' ? 'لا توجد إشعارات جديدة حالياً' : 'No new notifications'}
                        </h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                          {language === 'ar'
                            ? 'ستظهر هنا التنبيهات الفورية فقط عند تأكيد المواعيد، أو صدور نتائج التحاليل، أو إرسال الوصفات الطبية.'
                            : 'Live alerts appear here when appointments, lab results, or prescriptions arrive.'}
                        </p>
                        {user && (
                          <button
                            onClick={handleSendTestNotification}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                          >
                            <Sparkles size={13} />
                            <span>{language === 'ar' ? 'إرسال إشعار تجريبي لاختبار التنبيه' : 'Send Test Notification'}</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[360px] overflow-y-auto pe-1">
                        {notifications.map((notif) => {
                          const isUnread = !notif.read;
                          return (
                            <div 
                              key={notif.id}
                              className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                                isUnread 
                                  ? 'bg-blue-50/70 border-blue-200/80 shadow-xs' 
                                  : 'bg-white hover:bg-slate-50 border-slate-100 text-slate-600'
                              }`}
                            >
                              <div className="flex items-start gap-2.5">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                                  isUnread ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {notif.type === 'prescription' ? (
                                    <Pill size={14} />
                                  ) : notif.type === 'report_ready' ? (
                                    <FileText size={14} />
                                  ) : notif.type === 'booking_update' ? (
                                    <Calendar size={14} />
                                  ) : (
                                    <Bell size={14} />
                                  )}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                      {notif.title}
                                    </p>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                                      {formatRelativeTime(notif.createdAt, language)}
                                    </span>
                                  </div>

                                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed line-clamp-2">
                                    {notif.message}
                                  </p>
                                </div>
                              </div>

                              {/* Footer Action: "تمت القراءة" button to mark as read and remove badge */}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[10px]">
                                <span className="text-slate-400 font-mono">
                                  {notif.type || 'system'}
                                </span>

                                {isUnread ? (
                                  <button
                                    onClick={() => handleMarkOneAsRead(notif.id)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs hover:shadow"
                                    title={language === 'ar' ? 'اضغط لتأكيد القراءة وإخفاء العلامة' : 'Mark as read to clear badge'}
                                  >
                                    <Check size={12} />
                                    <span>{language === 'ar' ? 'تمت القراءة' : 'Mark as Read'}</span>
                                  </button>
                                ) : (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCheck size={13} className="text-emerald-600" />
                                    <span>{language === 'ar' ? 'تمت القراءة' : 'Read'}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Notification Preferences & Push Settings Footer */}
                    <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setShowNotificationsDropdown(false);
                          if (onOpenNotificationSettings) onOpenNotificationSettings();
                        }}
                        className="w-full text-xs font-bold text-sky-700 hover:text-sky-900 flex items-center justify-center gap-1.5 transition-colors cursor-pointer py-1.5 px-2 rounded-xl bg-sky-50/70 hover:bg-sky-100/70 border border-sky-100"
                      >
                        <Smartphone size={13} />
                        <span>{language === 'ar' ? 'إعدادات الإشعارات الفورية (Mobile Push)' : 'Push Notification Settings'}</span>
                      </button>
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
              <div className="flex justify-between items-center py-1.5 border-b border-slate-200/80 bg-sky-50/70 -mx-2 px-2.5 rounded-lg">
                <span className="text-slate-600 font-semibold">{language === 'ar' ? 'معرّف الحساب المعتمد (ID):' : 'Account ID:'}</span>
                <button
                  type="button"
                  onClick={() => {
                    const idToCopy = userProfile?.accountId || userProfile?.medicalId || (user ? generateFacilityOrUserId(userProfile?.role || 'patient', user.uid) : '');
                    if (idToCopy) {
                      navigator.clipboard.writeText(idToCopy);
                      setCopiedId(true);
                      setTimeout(() => setCopiedId(false), 2500);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 border border-slate-300 font-mono text-xs font-bold text-[#003366] transition-colors cursor-pointer shadow-2xs"
                  title={language === 'ar' ? 'انقر لنسخ المعرّف' : 'Click to copy ID'}
                >
                  <Copy size={12} className={copiedId ? 'text-emerald-600' : 'text-sky-600'} />
                  <span>
                    {copiedId 
                      ? (language === 'ar' ? 'تم النسخ!' : 'Copied!') 
                      : (userProfile?.accountId || userProfile?.medicalId || (user ? generateFacilityOrUserId(userProfile?.role || 'patient', user.uid) : 'M737-ID'))
                    }
                  </span>
                </button>
              </div>
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
