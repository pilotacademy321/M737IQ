import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  getDocs 
} from 'firebase/firestore';
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Search, 
  Calendar, 
  Pill, 
  FileText, 
  Package, 
  ShieldCheck, 
  AlertCircle, 
  Smartphone, 
  ExternalLink, 
  X, 
  RefreshCw, 
  Clock, 
  Inbox,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { PortalId } from '../types';
import { navigateTo } from '../utils/navigation';

export interface FirestoreNotificationItem {
  id: string;
  recipientUid: string;
  recipientRole?: string;
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  type?: 'booking_update' | 'report_ready' | 'prescription' | 'order' | 'system' | 'general' | 'referral';
  category?: 'appointment' | 'prescription' | 'lab_radiology' | 'order' | 'accreditation' | 'security' | 'general';
  targetPortal?: string;
  link?: string;
  priority?: 'normal' | 'urgent';
  read: boolean;
  readAt?: string;
  createdAt: string;
}

interface NotificationInboxProps {
  onClose?: () => void;
  onSelectPortal?: (portalId: PortalId) => void;
  onOpenSettings?: () => void;
  isModal?: boolean;
}

type CategoryFilter = 'all' | 'unread' | 'appointment' | 'prescription' | 'lab_radiology' | 'order' | 'system';

function formatRelativeTime(dateString: string, lang: 'ar' | 'en'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 45) return lang === 'ar' ? 'الآن' : 'Just now';
    if (diffMin < 60) return lang === 'ar' ? `منذ ${diffMin} دقيقة` : `${diffMin}m ago`;
    if (diffHr < 24) return lang === 'ar' ? `منذ ${diffHr} ساعة` : `${diffHr}h ago`;
    if (diffDays === 1) return lang === 'ar' ? 'أمس' : 'Yesterday';
    if (diffDays < 7) return lang === 'ar' ? `منذ ${diffDays} أيام` : `${diffDays}d ago`;

    return date.toLocaleDateString(lang === 'ar' ? 'ar-IQ' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({
  onClose,
  onSelectPortal,
  onOpenSettings,
  isModal = false,
}) => {
  const { user, userProfile, signInWithGoogle, setShowDomainHelp } = useAuth();
  const { language, isRTL } = useLanguage();

  const [notifications, setNotifications] = useState<FirestoreNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<FirestoreNotificationItem | null>(null);

  // Subscribe to real-time notifications from Firestore collection 'notifications'
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const items: FirestoreNotificationItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          items.push({
            id: docSnap.id,
            recipientUid: data.recipientUid || user.uid,
            recipientRole: data.recipientRole,
            title: data.title || '',
            titleEn: data.titleEn,
            message: data.message || '',
            messageEn: data.messageEn,
            type: data.type || 'general',
            category: data.category || (
              data.type === 'booking_update' ? 'appointment' :
              data.type === 'prescription' ? 'prescription' :
              data.type === 'report_ready' ? 'lab_radiology' :
              data.type === 'order' ? 'order' : 'general'
            ),
            targetPortal: data.targetPortal,
            link: data.link,
            priority: data.priority,
            read: Boolean(data.read),
            readAt: data.readAt,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });

        // Sort newest first
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setNotifications(items);
        setLoading(false);
      },
      (error) => {
        console.warn('[NotificationInbox] Real-time listener fallback:', error);
        // Fallback one-time fetch
        getDocs(notifQuery)
          .then((snapshot) => {
            const items: FirestoreNotificationItem[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              items.push({
                id: docSnap.id,
                recipientUid: data.recipientUid || user.uid,
                recipientRole: data.recipientRole,
                title: data.title || '',
                titleEn: data.titleEn,
                message: data.message || '',
                messageEn: data.messageEn,
                type: data.type || 'general',
                category: data.category,
                targetPortal: data.targetPortal,
                link: data.link,
                priority: data.priority,
                read: Boolean(data.read),
                readAt: data.readAt,
                createdAt: data.createdAt || new Date().toISOString(),
              });
            });
            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setNotifications(items);
          })
          .catch((err) => {
            console.error('[NotificationInbox] Error fetching notifications:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // Manual refresh
  const handleRefresh = async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('recipientUid', '==', user.uid)
      );
      const snapshot = await getDocs(notifQuery);
      const items: FirestoreNotificationItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          recipientUid: data.recipientUid || user.uid,
          recipientRole: data.recipientRole,
          title: data.title || '',
          titleEn: data.titleEn,
          message: data.message || '',
          messageEn: data.messageEn,
          type: data.type || 'general',
          category: data.category,
          targetPortal: data.targetPortal,
          link: data.link,
          priority: data.priority,
          read: Boolean(data.read),
          readAt: data.readAt,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(items);
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Toggle single notification Read/Unread status
  const handleToggleReadStatus = async (item: FirestoreNotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextReadState = !item.read;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: nextReadState } : n))
    );
    if (selectedNotif && selectedNotif.id === item.id) {
      setSelectedNotif((prev) => (prev ? { ...prev, read: nextReadState } : null));
    }

    try {
      setActionLoadingId(item.id);
      await updateDoc(doc(db, 'notifications', item.id), {
        read: nextReadState,
        readAt: nextReadState ? new Date().toISOString() : null,
      });
    } catch (err) {
      console.warn('Error updating read status in firestore:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    const unreadItems = notifications.filter((n) => !n.read);
    if (unreadItems.length === 0) return;

    setIsMarkingAll(true);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      unreadItems.forEach((item) => {
        batch.update(doc(db, 'notifications', item.id), {
          read: true,
          readAt: now,
        });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Batch mark read warning, falling back to sequential:', err);
      for (const item of unreadItems) {
        try {
          await updateDoc(doc(db, 'notifications', item.id), {
            read: true,
            readAt: new Date().toISOString(),
          });
        } catch {
          // ignore individual error
        }
      }
    } finally {
      setIsMarkingAll(false);
    }
  };

  // Delete a notification
  const handleDeleteNotification = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    // Optimistic deletion
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (selectedNotif?.id === notificationId) {
      setSelectedNotif(null);
    }

    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (err) {
      console.warn('Error deleting notification from firestore:', err);
    }
  };

  // Navigate to notification link or target portal
  const handleNavigateToTarget = (item: FirestoreNotificationItem) => {
    // Automatically mark as read on click
    if (!item.read) {
      handleToggleReadStatus(item);
    }

    if (item.link) {
      if (item.link.startsWith('http')) {
        window.open(item.link, '_blank');
      } else {
        navigateTo(item.link);
      }
      if (onClose) onClose();
      return;
    }

    if (item.targetPortal) {
      const portalKey = item.targetPortal as PortalId;
      if (onSelectPortal) {
        onSelectPortal(portalKey);
      } else {
        navigateTo(portalKey);
      }
      if (onClose) onClose();
    }
  };

  // Unread count
  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Category Filter
      if (activeFilter === 'unread' && item.read) return false;
      if (activeFilter === 'appointment' && item.category !== 'appointment' && item.type !== 'booking_update') return false;
      if (activeFilter === 'prescription' && item.category !== 'prescription' && item.type !== 'prescription') return false;
      if (activeFilter === 'lab_radiology' && item.category !== 'lab_radiology' && item.type !== 'report_ready') return false;
      if (activeFilter === 'order' && item.category !== 'order' && item.type !== 'order') return false;
      if (activeFilter === 'system' && item.category !== 'accreditation' && item.category !== 'security' && item.type !== 'system') return false;

      // 2. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (item.title || '').toLowerCase().includes(query) || (item.titleEn || '').toLowerCase().includes(query);
        const msgMatch = (item.message || '').toLowerCase().includes(query) || (item.messageEn || '').toLowerCase().includes(query);
        const portalMatch = (item.targetPortal || '').toLowerCase().includes(query);
        return titleMatch || msgMatch || portalMatch;
      }

      return true;
    });
  }, [notifications, activeFilter, searchQuery]);

  // Helper icon by category/type
  const getNotificationIcon = (item: FirestoreNotificationItem) => {
    const cat = item.category || item.type;
    switch (cat) {
      case 'appointment':
      case 'booking_update':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'prescription':
        return <Pill className="w-5 h-5 text-emerald-600" />;
      case 'lab_radiology':
      case 'report_ready':
        return <FileText className="w-5 h-5 text-purple-600" />;
      case 'order':
        return <Package className="w-5 h-5 text-amber-600" />;
      case 'accreditation':
      case 'security':
        return <ShieldCheck className="w-5 h-5 text-teal-600" />;
      default:
        return <BellRing className="w-5 h-5 text-sky-600" />;
    }
  };

  const getCategoryBadge = (item: FirestoreNotificationItem) => {
    const cat = item.category || item.type;
    switch (cat) {
      case 'appointment':
      case 'booking_update':
        return { labelAr: 'موعد عيادة', labelEn: 'Appointment', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'prescription':
        return { labelAr: 'روشتة إلكترونية', labelEn: 'Prescription', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'lab_radiology':
      case 'report_ready':
        return { labelAr: 'تشخيص ونتائج', labelEn: 'Diagnostic', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'order':
        return { labelAr: 'طلبية دوائية', labelEn: 'Medicine Order', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'accreditation':
        return { labelAr: 'اعتماد مهني', labelEn: 'Accreditation', bg: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'security':
        return { labelAr: 'أمان الحساب', labelEn: 'Security', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { labelAr: 'تنبيه نظام', labelEn: 'System Alert', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  // Unauthenticated View
  if (!user) {
    return (
      <div className={`bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8 ${isModal ? 'relative' : ''}`}>
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 end-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        )}
        <div className="w-16 h-16 rounded-2xl bg-sky-50 text-[#003366] mx-auto flex items-center justify-center mb-5 shadow-xs border border-sky-100">
          <Bell className="w-8 h-8" />
        </div>
        <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
          {language === 'ar' ? 'صندوق الإشعارات الطبية الفورية' : 'Medical Push Notification Inbox'}
        </h3>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed max-w-md mx-auto">
          {language === 'ar'
            ? 'سجل الإشعارات خاص ومشفر لكل مستخدم معتمد في منصة M737IQ. يرجى تسجيل الدخول لعرض إشعارات المواعيد، الوصفات، ونتائج الفحوصات الخاصة بك.'
            : 'Notification records are securely tied to your authenticated M737IQ account. Please sign in to view your appointments, prescriptions, and lab reports.'}
        </p>
        <button
          onClick={() => signInWithGoogle()}
          className="px-6 py-3 rounded-2xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-sm shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <Sparkles size={16} />
          <span>{language === 'ar' ? 'تسجيل الدخول باستخدام Google' : 'Sign In with Google'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col ${isModal ? 'max-h-[90vh]' : 'min-h-[600px]'}`}>
      {/* 1. Header Toolbar */}
      <div className="px-5 py-4 sm:px-7 sm:py-5 bg-gradient-to-r from-slate-900 via-[#003366] to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <BellRing className="w-6 h-6 text-sky-300" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center shadow-md animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {language === 'ar' ? 'صندوق الإشعارات والتنبيهات' : 'Notification Inbox'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                {language === 'ar' ? `${notifications.length} إشعار` : `${notifications.length} total`}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {language === 'ar'
                ? 'سجل فوري ومؤرشف لجميع الإشعارات الموجهة لحسابك عبر المنصة'
                : 'Real-time archive of medical updates, orders, and push alerts'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer disabled:opacity-50"
              title={language === 'ar' ? 'تحديد كل الإشعارات كمقروءة' : 'Mark all as read'}
            >
              <CheckCheck size={14} className="text-emerald-400" />
              <span>{language === 'ar' ? 'تحديد الكل كمقروء' : 'Mark All Read'}</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all border border-white/10 cursor-pointer"
            title={language === 'ar' ? 'تحديث السجل' : 'Refresh'}
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin text-sky-300' : ''} />
          </button>

          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all border border-white/10 cursor-pointer"
              title={language === 'ar' ? 'إعدادات الإشعارات الفورية للجوال' : 'Push Settings'}
            >
              <Smartphone size={15} className="text-amber-300" />
            </button>
          )}

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-all border border-white/10 cursor-pointer"
              title={language === 'ar' ? 'إغلاق' : 'Close'}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Search & Category Filters Bar */}
      <div className="p-4 sm:px-7 sm:py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'ar' ? 'ابحث في محتوى الإشعارات والعناوين...' : 'Search notification history...'}
            className="w-full ps-9 pe-8 py-2 rounded-xl text-xs bg-white border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-[#003366] text-slate-900 transition-all placeholder:text-slate-400 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs font-bold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-[#003366] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'الكل' : 'All'} ({notifications.length})
          </button>

          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'unread'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${unreadCount > 0 ? 'bg-rose-500' : 'bg-slate-300'}`} />
            <span>{language === 'ar' ? 'غير المقروءة' : 'Unread'}</span>
            <span>({unreadCount})</span>
          </button>

          <button
            onClick={() => setActiveFilter('appointment')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'appointment'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'المواعيد' : 'Appointments'}
          </button>

          <button
            onClick={() => setActiveFilter('prescription')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'prescription'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'الوصفات' : 'Prescriptions'}
          </button>

          <button
            onClick={() => setActiveFilter('lab_radiology')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'lab_radiology'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'المختبر والأشعة' : 'Diagnostic'}
          </button>

          <button
            onClick={() => setActiveFilter('order')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'order'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'الطلبيات' : 'Orders'}
          </button>

          <button
            onClick={() => setActiveFilter('system')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'system'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
            }`}
          >
            {language === 'ar' ? 'الأمان والنظام' : 'System'}
          </button>
        </div>
      </div>

      {/* 3. Notification List Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-3 sm:p-5 space-y-2.5">
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center">
            <RefreshCw className="w-8 h-8 text-[#003366] animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-600">
              {language === 'ar' ? 'جاري مزامنة الإشعارات من Firestore...' : 'Syncing notifications...'}
            </p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
              <Inbox className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              {searchQuery
                ? (language === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching notifications found')
                : activeFilter === 'unread'
                ? (language === 'ar' ? 'رائع! لا توجد إشعارات غير مقروءة حالياً' : 'No unread notifications')
                : (language === 'ar' ? 'صندوق الإشعارات فارغ حالياً' : 'Your notification inbox is empty')}
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              {language === 'ar'
                ? 'عند استلام مواعيد جديدة، نتائج فحوصات، وصفات طبية أو شحنات دوائية، ستظهر هنا فورياً مع إشعار فوري للجوال.'
                : 'Upcoming appointments, lab results, prescriptions, and order updates will appear here in real-time.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'مسح عبارة البحث' : 'Clear search'}
              </button>
            )}
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnread = !item.read;
            const badge = getCategoryBadge(item);
            const titleDisplay = (language === 'en' && item.titleEn) ? item.titleEn : item.title;
            const messageDisplay = (language === 'en' && item.messageEn) ? item.messageEn : item.message;

            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedNotif(item);
                  if (isUnread) handleToggleReadStatus(item);
                }}
                className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer relative group ${
                  isUnread
                    ? 'bg-blue-50/40 hover:bg-blue-50/70 border-blue-200 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200/80'
                }`}
              >
                {/* Visual Unread Accent Indicator */}
                {isUnread && (
                  <span className="absolute top-4 start-3 w-2.5 h-2.5 rounded-full bg-blue-600 shadow-xs" />
                )}

                <div className={`flex items-start gap-3.5 ${isUnread ? 'ps-3' : ''}`}>
                  {/* Category Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-xs ${
                    isUnread ? 'bg-white border-blue-200' : 'bg-slate-100 border-slate-200'
                  }`}>
                    {getNotificationIcon(item)}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                          {language === 'ar' ? badge.labelAr : badge.labelEn}
                        </span>

                        {item.priority === 'urgent' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200 animate-pulse">
                            {language === 'ar' ? 'عاجل' : 'Urgent'}
                          </span>
                        )}

                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Smartphone size={10} className="text-slate-400" />
                          <span>FCM / Web Push</span>
                        </span>
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
                        <Clock size={12} />
                        <span>{formatRelativeTime(item.createdAt, language)}</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h4 className={`text-sm tracking-tight mb-1 ${
                      isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'
                    }`}>
                      {titleDisplay}
                    </h4>

                    {/* Message Body */}
                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      {messageDisplay}
                    </p>

                    {/* Bottom Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      {/* Navigation Link if available */}
                      {(item.link || item.targetPortal) ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToTarget(item);
                          }}
                          className="font-bold text-[#003366] hover:text-[#002244] flex items-center gap-1.5 hover:underline py-1 cursor-pointer"
                        >
                          <span>{language === 'ar' ? 'فتح البوابة ومتابعة التفاصيل' : 'Open Portal & View Details'}</span>
                          {isRTL ? <ArrowLeft size={13} /> : <ArrowRight size={13} />}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          {language === 'ar' ? 'إشعار توثيقي مباشر' : 'Direct system notice'}
                        </span>
                      )}

                      {/* Read/Unread Toggle & Delete Action Buttons */}
                      <div className="flex items-center gap-1.5 ms-auto">
                        <button
                          type="button"
                          onClick={(e) => handleToggleReadStatus(item, e)}
                          disabled={actionLoadingId === item.id}
                          className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                            isUnread
                              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                          title={isUnread 
                            ? (language === 'ar' ? 'تحديد كمقروء' : 'Mark as read') 
                            : (language === 'ar' ? 'تحديد كغير مقروء' : 'Mark as unread')
                          }
                        >
                          {isUnread ? (
                            <>
                              <Check size={13} />
                              <span>{language === 'ar' ? 'تحديد كمقروء' : 'Mark Read'}</span>
                            </>
                          ) : (
                            <>
                              <CheckCheck size={13} className="text-emerald-600" />
                              <span>{language === 'ar' ? 'مقروء' : 'Read'}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDeleteNotification(item.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title={language === 'ar' ? 'حذف الإشعار من السجل' : 'Delete'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. Footer Summary */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {language === 'ar'
              ? 'متصل بقاعدة بيانات M737IQ وخدمة Web Push الحية'
              : 'Connected to live M737IQ Firestore & Web Push Engine'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            {language === 'ar'
              ? `المقروء: ${notifications.length - unreadCount} | غير المقروء: ${unreadCount}`
              : `Read: ${notifications.length - unreadCount} | Unread: ${unreadCount}`}
          </span>
        </div>
      </div>
    </div>
  );
};
