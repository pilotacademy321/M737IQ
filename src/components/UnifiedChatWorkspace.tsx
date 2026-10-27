import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../lib/firebase';
import { 
  ChatConversation, 
  ChatMessage, 
  MessagingProviderRole,
  UserRole
} from '../types';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  MessageSquare, 
  Send, 
  Search, 
  User, 
  Stethoscope, 
  Pill, 
  FlaskConical, 
  Scan, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCheck, 
  Check, 
  Clock, 
  Paperclip, 
  Sparkles, 
  FileText, 
  Printer, 
  Filter, 
  Plus, 
  X,
  Phone,
  Building2,
  Calendar,
  Lock,
  Eye,
  Flag
} from 'lucide-react';

interface UnifiedChatWorkspaceProps {
  currentRole: 'patient' | MessagingProviderRole | 'super_admin';
  currentUserId: string;
  currentUserName: string;
  facilityName?: string;
  isSuperAdminView?: boolean;
  initialRecipient?: {
    id: string;
    name: string;
    role: MessagingProviderRole | 'patient';
    facilityName?: string;
  } | null;
  onClose?: () => void;
}

export const UnifiedChatWorkspace: React.FC<UnifiedChatWorkspaceProps> = ({
  currentRole,
  currentUserId,
  currentUserName,
  facilityName,
  isSuperAdminView = false,
  initialRecipient = null,
  onClose,
}) => {
  const { language, isRTL, isDemoMode } = useLanguage();

  // State
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [safetyFilter, setSafetyFilter] = useState<'all' | 'flagged' | 'normal'>('all');
  const [auditNoteInput, setAuditNoteInput] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Available Providers Directory for starting a new chat (for patients)
  const [availableProviders, setAvailableProviders] = useState<Array<{
    id: string;
    name: string;
    role: MessagingProviderRole;
    facilityName?: string;
    phone?: string;
  }>>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversations based on role
  useEffect(() => {
    if (!currentUserId && !isSuperAdminView) return;

    let unsubscribe: () => void = () => {};

    try {
      let convQuery;

      if (isSuperAdminView || currentRole === 'super_admin') {
        // Super Admin receives and inspects ALL conversations across the platform
        convQuery = query(
          collection(db, 'conversations'),
          limit(150)
        );
      } else if (currentRole === 'patient') {
        convQuery = query(
          collection(db, 'conversations'),
          where('patientId', '==', currentUserId)
        );
      } else {
        // Healthcare Provider: doctor, pharmacy, lab, radiology, secretary
        convQuery = query(
          collection(db, 'conversations'),
          where('providerId', '==', currentUserId)
        );
      }

      unsubscribe = onSnapshot(convQuery, (snap) => {
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatConversation));
        list.sort((a, b) => new Date(b.lastMessageTimestamp || b.updatedAt).getTime() - new Date(a.lastMessageTimestamp || a.updatedAt).getTime());

        // Fallback demo conversations if empty
        if (list.length === 0 && isDemoMode) {
          list = [
            {
              id: 'demo_conv_1',
              patientId: currentRole === 'patient' ? currentUserId : 'demo_pat_sarah',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07809988776',
              providerId: currentRole === 'doctor' ? currentUserId : 'demo_doc_ahmed',
              providerName: 'د. أحمد الرافدين (استشاري باطنية وقلبية)',
              providerRole: 'doctor',
              facilityName: 'مجمع الرافدين الاستشاري',
              lastMessage: 'أهلاً بكِ سارة، نتائج تخطيط القلب مطمئنة واستمرّي على علاج الضغط.',
              lastMessageTimestamp: new Date(Date.now() - 3600000).toISOString(),
              lastSenderId: 'demo_doc_ahmed',
              unreadCountPatient: 1,
              unreadCountProvider: 0,
              status: 'active',
              safetyAuditStatus: 'verified_safe',
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              updatedAt: new Date(Date.now() - 3600000).toISOString(),
            },
            {
              id: 'demo_conv_2',
              patientId: currentRole === 'patient' ? currentUserId : 'demo_pat_sarah',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07809988776',
              providerId: currentRole === 'pharmacy' ? currentUserId : 'demo_pharmacy_alnoor',
              providerName: 'صيدلية النور النموذجية',
              providerRole: 'pharmacy',
              facilityName: 'صيدلية النور',
              lastMessage: 'مرحباً، وصفة الدواء تم تجهيزها ومندوب التوصيل في طريقه إليكم.',
              lastMessageTimestamp: new Date(Date.now() - 7200000).toISOString(),
              lastSenderId: 'demo_pharmacy_alnoor',
              unreadCountPatient: 0,
              unreadCountProvider: 0,
              status: 'active',
              safetyAuditStatus: 'normal',
              createdAt: new Date(Date.now() - 90000000).toISOString(),
              updatedAt: new Date(Date.now() - 7200000).toISOString(),
            },
            {
              id: 'demo_conv_3',
              patientId: currentRole === 'patient' ? currentUserId : 'demo_pat_sarah',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07809988776',
              providerId: currentRole === 'laboratory' ? currentUserId : 'demo_lab_alrafidain',
              providerName: 'مختبر الرافدين التخصصي للتحليلات المرضية',
              providerRole: 'laboratory',
              facilityName: 'مختبر الرافدين',
              lastMessage: 'تأكيد: يرجى الصيام 10 ساعات قبل الحضور لإجراء فحص السكر الصائم والدهون.',
              lastMessageTimestamp: new Date(Date.now() - 14400000).toISOString(),
              lastSenderId: 'demo_lab_alrafidain',
              unreadCountPatient: 0,
              unreadCountProvider: 0,
              status: 'active',
              safetyAuditStatus: 'normal',
              createdAt: new Date(Date.now() - 120000000).toISOString(),
              updatedAt: new Date(Date.now() - 14400000).toISOString(),
            },
            {
              id: 'demo_conv_4',
              patientId: currentRole === 'patient' ? currentUserId : 'demo_pat_sarah',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07809988776',
              providerId: currentRole === 'radiology_center' ? currentUserId : 'demo_rad_baghdad',
              providerName: 'مركز بغداد التخصصي للأشعة والسونار',
              providerRole: 'radiology_center',
              facilityName: 'مركز أشعة بغداد',
              lastMessage: 'تقرير فحص السونار أصبح جاهزاً وتم توقيعه من طبيب الأشعة الاستشاري.',
              lastMessageTimestamp: new Date(Date.now() - 28800000).toISOString(),
              lastSenderId: 'demo_rad_baghdad',
              unreadCountPatient: 0,
              unreadCountProvider: 0,
              status: 'active',
              safetyAuditStatus: 'normal',
              createdAt: new Date(Date.now() - 150000000).toISOString(),
              updatedAt: new Date(Date.now() - 28800000).toISOString(),
            }
          ];
        }

        setConversations(list);
        setLoading(false);

        // If an initial recipient was passed, auto-select or open
        if (initialRecipient && !selectedConversation) {
          const match = list.find(c => 
            (c.providerId === initialRecipient.id && c.patientId === currentUserId) ||
            (c.patientId === initialRecipient.id && c.providerId === currentUserId)
          );
          if (match) {
            setSelectedConversation(match);
          } else {
            // Create a pending conversation stub
            createOrGetConversation(initialRecipient);
          }
        }
      }, (err) => {
        console.warn('Error loading conversations via listener:', err);
        setLoading(false);
      });
    } catch (e) {
      console.warn('Error setting up conversation listener:', e);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [currentUserId, currentRole, isSuperAdminView, initialRecipient]);

  // Load available providers for patient to start chat with
  useEffect(() => {
    if (currentRole !== 'patient') return;

    const loadDirectory = async () => {
      try {
        const directory: Array<{ id: string; name: string; role: MessagingProviderRole; facilityName?: string; phone?: string }> = [];

        // Doctors
        const docSnap = await getDocs(query(collection(db, 'doctor_profiles'), limit(15)));
        docSnap.docs.forEach(d => {
          const data = d.data();
          directory.push({
            id: d.id,
            name: data.fullName || 'طبيب استشاري',
            role: 'doctor',
            facilityName: data.clinicAddress,
            phone: data.phone,
          });
        });

        // Pharmacies
        const pharmSnap = await getDocs(query(collection(db, 'pharmacy_profiles'), limit(15)));
        pharmSnap.docs.forEach(d => {
          const data = d.data();
          directory.push({
            id: d.id,
            name: data.pharmacyName || 'صيدلية معتمدة',
            role: 'pharmacy',
            facilityName: data.address,
            phone: data.phone,
          });
        });

        // Labs
        const labSnap = await getDocs(query(collection(db, 'lab_profiles'), limit(15)));
        labSnap.docs.forEach(d => {
          const data = d.data();
          directory.push({
            id: d.id,
            name: data.labName || 'مختبر تحليلات',
            role: 'laboratory',
            facilityName: data.address,
            phone: data.phone,
          });
        });

        // Radiology
        const radSnap = await getDocs(query(collection(db, 'radiology_profiles'), limit(15)));
        radSnap.docs.forEach(d => {
          const data = d.data();
          directory.push({
            id: d.id,
            name: data.centerName || 'مركز أشعة وسونار',
            role: 'radiology_center',
            facilityName: data.address,
            phone: data.phone,
          });
        });

        setAvailableProviders(directory);
      } catch (e) {
        console.warn('Failed to load provider directory for chat:', e);
      }
    };

    loadDirectory();
  }, [currentRole]);

  // Real-time messages listener for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    let unsubscribe: () => void = () => {};

    try {
      const msgQuery = query(
        collection(db, 'chat_messages'),
        where('conversationId', '==', selectedConversation.id)
      );

      unsubscribe = onSnapshot(msgQuery, (snap) => {
        let msgList = snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
        msgList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (msgList.length === 0 && isDemoMode) {
          msgList = [
            {
              id: 'demo_msg_1',
              conversationId: selectedConversation.id,
              senderId: selectedConversation.patientId,
              senderName: selectedConversation.patientName,
              senderRole: 'patient',
              recipientId: selectedConversation.providerId,
              recipientName: selectedConversation.providerName,
              recipientRole: selectedConversation.providerRole,
              text: 'السلام عليكم ورحمة الله، أود الاستفسار عن الموعد والتعليمات الخاصة بالحالة الطبية.',
              createdAt: new Date(Date.now() - 7200000).toISOString(),
              read: true,
            },
            {
              id: 'demo_msg_2',
              conversationId: selectedConversation.id,
              senderId: selectedConversation.providerId,
              senderName: selectedConversation.providerName,
              senderRole: selectedConversation.providerRole,
              recipientId: selectedConversation.patientId,
              recipientName: selectedConversation.patientName,
              recipientRole: 'patient',
              text: selectedConversation.lastMessage,
              createdAt: selectedConversation.lastMessageTimestamp,
              read: true,
            }
          ];
        }

        setMessages(msgList);
      }, (err) => {
        console.warn('Error reading chat messages:', err);
      });
    } catch (e) {
      console.warn('Error in chat message listener:', e);
    }

    return () => unsubscribe();
  }, [selectedConversation, isDemoMode]);

  // Create or Get Conversation with target provider
  const createOrGetConversation = async (provider: {
    id: string;
    name: string;
    role: MessagingProviderRole | 'patient';
    facilityName?: string;
  }) => {
    try {
      const convId = currentRole === 'patient'
        ? `conv_${currentUserId.slice(0, 5)}_${provider.id.slice(0, 5)}`
        : `conv_${provider.id.slice(0, 5)}_${currentUserId.slice(0, 5)}`;

      const convRef = doc(db, 'conversations', convId);
      const convSnap = await getDoc(convRef);

      if (convSnap.exists()) {
        const existingData = { id: convSnap.id, ...convSnap.data() } as ChatConversation;
        setSelectedConversation(existingData);
      } else {
        const now = new Date().toISOString();
        const newConv: ChatConversation = {
          id: convId,
          patientId: currentRole === 'patient' ? currentUserId : provider.id,
          patientName: currentRole === 'patient' ? currentUserName : provider.name,
          providerId: currentRole === 'patient' ? provider.id : currentUserId,
          providerName: currentRole === 'patient' ? provider.name : currentUserName,
          providerRole: currentRole === 'patient' ? (provider.role as MessagingProviderRole) : (currentRole as MessagingProviderRole),
          facilityName: provider.facilityName || facilityName || '',
          lastMessage: language === 'ar' ? 'تم بدء المحادثة الطبية المعتمدة' : 'Medical conversation initiated',
          lastMessageTimestamp: now,
          lastSenderId: currentUserId,
          unreadCountPatient: currentRole === 'patient' ? 0 : 1,
          unreadCountProvider: currentRole === 'patient' ? 1 : 0,
          status: 'active',
          safetyAuditStatus: 'normal',
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(convRef, sanitizeForFirestore(newConv));
        setSelectedConversation(newConv);
      }
      setShowNewChatModal(false);
    } catch (err: unknown) {
      console.warn('Could not initialize conversation in firestore:', err);
      // Fallback local stub
      const dummyConv: ChatConversation = {
        id: `conv_${Date.now()}`,
        patientId: currentRole === 'patient' ? currentUserId : provider.id,
        patientName: currentRole === 'patient' ? currentUserName : provider.name,
        providerId: currentRole === 'patient' ? provider.id : currentUserId,
        providerName: currentRole === 'patient' ? provider.name : currentUserName,
        providerRole: currentRole === 'patient' ? (provider.role as MessagingProviderRole) : (currentRole as MessagingProviderRole),
        facilityName: provider.facilityName || '',
        lastMessage: 'بدء المحادثة',
        lastMessageTimestamp: new Date().toISOString(),
        lastSenderId: currentUserId,
        unreadCountPatient: 0,
        unreadCountProvider: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedConversation(dummyConv);
      setShowNewChatModal(false);
    }
  };

  // Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || !selectedConversation) return;

    const trimmed = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const msgId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      const isPatient = currentRole === 'patient';
      const recipientId = isPatient ? selectedConversation.providerId : selectedConversation.patientId;
      const recipientName = isPatient ? selectedConversation.providerName : selectedConversation.patientName;
      const recipientRole = isPatient ? selectedConversation.providerRole : 'patient';

      const newMsg: ChatMessage = {
        id: msgId,
        conversationId: selectedConversation.id,
        senderId: currentUserId,
        senderName: currentUserName,
        senderRole: currentRole,
        recipientId,
        recipientName,
        recipientRole,
        text: trimmed,
        read: false,
        createdAt: now,
      };

      // Add to messages collection
      await setDoc(doc(db, 'chat_messages', msgId), sanitizeForFirestore(newMsg));

      // Update parent conversation last message
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        lastMessage: trimmed,
        lastMessageTimestamp: now,
        lastSenderId: currentUserId,
        updatedAt: now,
        unreadCountPatient: isPatient ? 0 : (selectedConversation.unreadCountPatient || 0) + 1,
        unreadCountProvider: isPatient ? (selectedConversation.unreadCountProvider || 0) + 1 : 0,
      });

      // Local optimistic update
      setMessages(prev => [...prev, newMsg]);
    } catch (err: unknown) {
      console.warn('Error saving message to firestore:', err);
    } finally {
      setSending(false);
    }
  };

  // Super Admin: Update Safety Review Status & Notes
  const handleUpdateSafetyStatus = async (status: 'normal' | 'flagged_review' | 'verified_safe') => {
    if (!selectedConversation || !isSuperAdminView) return;

    try {
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        safetyAuditStatus: status,
        safetyAuditNotes: auditNoteInput || selectedConversation.safetyAuditNotes || '',
        updatedAt: new Date().toISOString(),
      });

      setSelectedConversation(prev => prev ? {
        ...prev,
        safetyAuditStatus: status,
        safetyAuditNotes: auditNoteInput || prev.safetyAuditNotes,
      } : null);

      setConversations(prev => prev.map(c => c.id === selectedConversation.id ? {
        ...c,
        safetyAuditStatus: status,
        safetyAuditNotes: auditNoteInput || c.safetyAuditNotes,
      } : c));
    } catch (err: unknown) {
      console.warn('Error updating safety audit status:', err);
    }
  };

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      // Role Filter
      if (roleFilter !== 'all' && conv.providerRole !== roleFilter) {
        return false;
      }
      // Safety Filter (Super Admin)
      if (safetyFilter === 'flagged' && conv.safetyAuditStatus !== 'flagged_review') {
        return false;
      }
      if (safetyFilter === 'normal' && conv.safetyAuditStatus === 'flagged_review') {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchPatient = conv.patientName.toLowerCase().includes(q);
        const matchProvider = conv.providerName.toLowerCase().includes(q);
        const matchMsg = conv.lastMessage.toLowerCase().includes(q);
        const matchFacility = conv.facilityName?.toLowerCase().includes(q) || false;
        if (!matchPatient && !matchProvider && !matchMsg && !matchFacility) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, roleFilter, safetyFilter, searchQuery]);

  // Provider Role Display Helper
  const getRoleBadge = (role: MessagingProviderRole | 'patient' | 'super_admin') => {
    switch (role) {
      case 'doctor':
        return {
          label: language === 'ar' ? 'عيادة طبيب' : 'Doctor Clinic',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: Stethoscope,
        };
      case 'pharmacy':
        return {
          label: language === 'ar' ? 'صيدلية' : 'Pharmacy',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: Pill,
        };
      case 'laboratory':
        return {
          label: language === 'ar' ? 'مختبر تحليلات' : 'Medical Lab',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: FlaskConical,
        };
      case 'radiology_center':
        return {
          label: language === 'ar' ? 'أشعة وسونار' : 'Radiology Center',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: Scan,
        };
      case 'secretary':
        return {
          label: language === 'ar' ? 'سكرتارية واستقبال' : 'Clinic Secretary',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: Users,
        };
      default:
        return {
          label: language === 'ar' ? 'مراجع / مريض' : 'Patient',
          color: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: User,
        };
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[740px] max-h-[85vh]">
      {/* Workspace Master Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-teal-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-white/10 text-teal-300">
            <MessageSquare className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                {isSuperAdminView
                  ? (language === 'ar' ? 'مرصد الرقابة الطبية والسلامة الموحد (الرسائل المركزية)' : 'Central Clinical Safety & Message Oversight Audit')
                  : (language === 'ar' ? 'منظومة الاستشارات والرسائل الطبية المعتمدة' : 'Accredited Medical Consultations & Messaging')}
              </h2>
              {isSuperAdminView && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  {language === 'ar' ? 'رقابة عليا' : 'Audit Mode'}
                </span>
              )}
            </div>
            <p className="text-xs text-teal-200/80 mt-0.5">
              {isSuperAdminView
                ? (language === 'ar' ? 'متابعة وتدقيق فوري لكافة المحادثات بين المرضى والكوادر الطبية (أطباء، صيدليات، مختبرات، أشعة، سكرتارية) لضمان السلامة السريرية' : 'Live central audit of all patient-provider communications for clinical safety governance')
                : (language === 'ar' ? 'تواصل مباشر مع الأطباء والصيدليات والمختبرات ومراكز الأشعة والسكرتارية' : 'Direct secure communication with doctors, pharmacies, labs, radiology, and clinics')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentRole === 'patient' && (
            <button
              onClick={() => setShowNewChatModal(true)}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{language === 'ar' ? 'محادثة واستشارة جديدة' : 'New Consultation'}</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Safety Oversight Notice Banner */}
      <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200/70 text-amber-950 flex items-center gap-2.5 text-xs shrink-0">
        <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
        <span className="leading-relaxed">
          {language === 'ar'
            ? 'تنبيه السلامة الطبية: تخضع كافة الرسائل للرقابة والمراجعة المركزية من قبل الإدارة العليا لضمان الالتزام بالمعايير الصحية العراقية وعدم تداول أدوية أو استشارات غير آمنة.'
            : 'Clinical Safety Notice: All medical communication threads are monitored centrally by Super Admin audit for patient safety and compliance.'}
        </span>
      </div>

      {/* Main Split Layout: Threads Sidebar + Chat Room */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Start: Conversations List */}
        <div className={`w-full md:w-80 lg:w-96 border-e border-slate-200 flex flex-col bg-slate-50/50 ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {/* Search & Role Filters */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 absolute top-2.5 start-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === 'ar' ? 'بحث بالاسم أو نص الرسالة...' : 'Search by name or message...'}
                className="w-full ps-8 pe-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-teal-600 outline-none"
              />
            </div>

            {/* Provider Type Quick Filter Strip */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
              {[
                { id: 'all', labelAr: 'الكل', labelEn: 'All' },
                { id: 'doctor', labelAr: 'أطباء', labelEn: 'Doctors' },
                { id: 'pharmacy', labelAr: 'صيدليات', labelEn: 'Pharmacies' },
                { id: 'laboratory', labelAr: 'مختبرات', labelEn: 'Labs' },
                { id: 'radiology_center', labelAr: 'أشعة', labelEn: 'Radiology' },
                { id: 'secretary', labelAr: 'سكرتارية', labelEn: 'Clinics' },
              ].map(rf => (
                <button
                  key={rf.id}
                  onClick={() => setRoleFilter(rf.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === rf.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {language === 'ar' ? rf.labelAr : rf.labelEn}
                </button>
              ))}
            </div>

            {/* Super Admin Safety Flag Filter */}
            {isSuperAdminView && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[11px]">
                <span className="text-slate-500 font-bold">{language === 'ar' ? 'حالة الأمان:' : 'Safety:'}</span>
                <button
                  onClick={() => setSafetyFilter('all')}
                  className={`px-2 py-0.5 rounded-md ${safetyFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-600'}`}
                >
                  {language === 'ar' ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setSafetyFilter('flagged')}
                  className={`px-2 py-0.5 rounded-md font-bold text-rose-700 ${safetyFilter === 'flagged' ? 'bg-rose-100' : ''}`}
                >
                  {language === 'ar' ? 'محل تدقيق' : 'Flagged'}
                </button>
              </div>
            )}
          </div>

          {/* Conversations Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Clock className="w-5 h-5 mx-auto mb-2 animate-spin text-teal-600" />
                <span>{language === 'ar' ? 'جاري تحميل سجل المحادثات...' : 'Loading conversations...'}</span>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-teal-700" />
                <p className="font-bold text-slate-700">
                  {language === 'ar' ? 'لا توجد محادثات جارية' : 'No conversations found'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {currentRole === 'patient'
                    ? (language === 'ar' ? 'اضغط على "محادثة واستشارة جديدة" للتواصل مع طبيبك أو الصيدلية.' : 'Start a consultation with your medical provider.')
                    : (language === 'ar' ? 'ستظهر هنا رسائل واستفسارات المرضى والمراجعين فور وصولها.' : 'Patient inquiries will appear here.')}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = selectedConversation?.id === conv.id;
                const otherPartyName = currentRole === 'patient' ? conv.providerName : conv.patientName;
                const badge = getRoleBadge(currentRole === 'patient' ? conv.providerRole : 'patient');
                const Icon = badge.icon;
                const isFlagged = conv.safetyAuditStatus === 'flagged_review';

                return (
                  <div
                    key={conv.id}
                    onClick={() => setSelectedConversation(conv)}
                    className={`p-3.5 transition-colors cursor-pointer text-xs relative ${
                      isSelected ? 'bg-teal-50/70 border-s-4 border-teal-600' : 'hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`p-1 rounded-md border shrink-0 ${badge.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <h4 className="font-bold text-slate-900 truncate">
                          {otherPartyName}
                        </h4>
                      </div>

                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {conv.lastMessageTimestamp
                          ? new Date(conv.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    {/* Facility / Subtitle */}
                    {conv.facilityName && (
                      <span className="text-[10px] text-slate-500 block truncate mb-1">
                        {conv.facilityName}
                      </span>
                    )}

                    {/* Last Message Snippet */}
                    <p className="text-slate-600 text-[11px] line-clamp-1 leading-relaxed">
                      {conv.lastMessage || (language === 'ar' ? 'محادثة طبية جديدة' : 'New consultation')}
                    </p>

                    {/* Footer Tags */}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>

                      {isFlagged && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {language === 'ar' ? 'محل تدقيق' : 'Flagged'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right / End: Active Conversation Room */}
        <div className={`flex-1 flex flex-col bg-white ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
          {selectedConversation ? (
            <>
              {/* Chat Room Header */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="p-1.5 rounded-lg md:hidden hover:bg-slate-200 text-slate-600"
                  >
                    ✕
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-900">
                        {currentRole === 'patient'
                          ? selectedConversation.providerName
                          : `${selectedConversation.patientName} (${selectedConversation.patientPhone || 'مراجع'})`}
                      </h3>
                      {selectedConversation.safetyAuditStatus === 'verified_safe' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          {language === 'ar' ? 'سجل مدقق سريرياً' : 'Safety Verified'}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      {selectedConversation.facilityName || (language === 'ar' ? 'منصة M737 الطبية المعتمدة' : 'M737 Medical Platform')}
                    </span>
                  </div>
                </div>

                {/* Super Admin Audit Actions Bar */}
                {isSuperAdminView && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateSafetyStatus('flagged_review')}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'إحالة للتدقيق' : 'Flag Review'}</span>
                    </button>
                    <button
                      onClick={() => handleUpdateSafetyStatus('verified_safe')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-1 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'اعتماد الأمان' : 'Approve Safe'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
                {messages.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-teal-700" />
                    <span>{language === 'ar' ? 'لا توجد رسائل سابقة. يمكنك إرسال استفسارك الطبي الآن.' : 'No messages yet. Send your medical inquiry.'}</span>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === currentUserId;
                    const isProvider = msg.senderRole !== 'patient';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
                          <span className="font-bold text-slate-700">{msg.senderName}</span>
                          <span>•</span>
                          <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`max-w-[85%] sm:max-w-[70%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#00796b] text-white rounded-br-xs'
                              : isProvider
                              ? 'bg-white border border-slate-200 text-slate-900 rounded-bl-xs'
                              : 'bg-teal-50 border border-teal-200 text-teal-950 rounded-bl-xs'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>

                          {msg.attachmentName && (
                            <div className="mt-2 p-2 rounded-lg bg-black/10 flex items-center gap-2 text-[11px]">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span className="underline truncate">{msg.attachmentName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar (Disabled if Super Admin Audit View) */}
              {!isSuperAdminView ? (
                <form
                  onSubmit={handleSendMessage}
                  className="p-3 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={
                      language === 'ar'
                        ? 'اكتب رسالتك أو استفسارك الطبي هنا...'
                        : 'Type your medical inquiry or message here...'
                    }
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-[#00796b] outline-none"
                  />

                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="p-2.5 rounded-xl bg-[#00796b] hover:bg-teal-800 text-white font-bold transition-all shadow-xs cursor-pointer disabled:opacity-40 flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <div className="p-3 border-t border-slate-200 bg-slate-100/70 text-center text-xs text-slate-500 font-bold shrink-0">
                  {language === 'ar'
                    ? 'وضع الرقابة والتدقيق السريري: وضع القراءة والمراجعة الأمنية للإدارة العليا'
                    : 'Clinical Safety Audit Mode: Read-only inspection for Super Admin'}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mb-3 opacity-20 text-teal-800" />
              <h3 className="font-bold text-slate-700 text-sm">
                {language === 'ar' ? 'اختر محادثة من القائمة للاطلاع على تفاصيلها' : 'Select a conversation from the sidebar'}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {isSuperAdminView
                  ? (language === 'ar' ? 'يمكنك فحص وتدقيق كافة المحادثات الجارية بين المرضى والكوادر الطبية.' : 'Review and audit platform patient-provider consultations.')
                  : (language === 'ar' ? 'يمكنك مراجعة كافة الاستفسارات والتعليمات الطبية المعتمدة.' : 'View all ongoing medical consultations and patient messages.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: START NEW CONSULTATION (For Patients) */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
            <div className="p-5 bg-gradient-to-r from-teal-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-white/10 text-teal-300">
                  <Stethoscope className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base">
                    {language === 'ar' ? 'بدء محادثة واستشارة طبية جديدة' : 'Start Medical Consultation'}
                  </h3>
                  <span className="text-xs text-teal-200">
                    {language === 'ar' ? 'اختر الطبيب، الصيدلية، المختبر، أو مركز الأشعة' : 'Select provider to message'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-2">
              {availableProviders.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>{language === 'ar' ? 'جاري تجهيز الدليل الطبي للمنشآت المعتمدة...' : 'Loading provider directory...'}</p>
                </div>
              ) : (
                availableProviders.map((prov) => {
                  const badge = getRoleBadge(prov.role);
                  const Icon = badge.icon;

                  return (
                    <div
                      key={prov.id}
                      onClick={() => createOrGetConversation(prov)}
                      className="p-3 rounded-2xl hover:bg-teal-50/60 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-xl border shrink-0 ${badge.color}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{prov.name}</h4>
                          {prov.facilityName && (
                            <span className="text-[11px] text-slate-500 block">{prov.facilityName}</span>
                          )}
                          <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-bold border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs"
                      >
                        {language === 'ar' ? 'مراسلة' : 'Message'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
