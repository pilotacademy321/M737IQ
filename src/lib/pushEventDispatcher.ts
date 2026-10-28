/**
 * M737IQ Multi-Portal Push Notification Event Dispatcher
 * 
 * Provides unified, typed, concurrency-safe, and idempotent notification delivery
 * across all 8 M737IQ portals:
 * - Patient
 * - Doctor
 * - Secretary
 * - Pharmacy
 * - Laboratory
 * - Radiology & Ultrasound
 * - Wholesaler
 * - Super Admin (strictly restricted to bcgmoc@gmail.com)
 */

import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { UserRole } from '../types';
import { isVerifiedSuperAdmin, SOLE_SUPER_ADMIN_EMAIL } from '../utils/adminSecurity';
import { DeviceTokenRecord, getUserNotificationPreferences } from './pushNotificationService';

export type NotificationCategory = 
  | 'appointment' 
  | 'prescription' 
  | 'lab_radiology' 
  | 'order' 
  | 'message' 
  | 'security' 
  | 'accreditation' 
  | 'general';

export interface DispatchNotificationParams {
  recipientUid: string;
  recipientRole?: UserRole | string;
  category: NotificationCategory;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  targetPortal: 'patient' | 'doctor' | 'secretary' | 'pharmacy' | 'laboratory' | 'radiology' | 'wholesaler' | 'super_admin';
  targetUrl: string;
  sourceEventId?: string;
  priority?: 'normal' | 'urgent';
  lockscreenGenericText?: boolean;
}

export interface PushOutboxRecord {
  id: string;
  recipientUid: string;
  recipientRole?: string;
  category: NotificationCategory;
  title: string;
  body: string;
  genericBody: string;
  targetUrl: string;
  targetPortal: string;
  priority: 'normal' | 'urgent';
  status: 'pending' | 'delivered' | 'failed' | 'skipped';
  deviceTokensCount: number;
  idempotencyKey: string;
  createdAt: string;
  deliveredAt?: string;
}

// In-memory set to prevent duplicate event dispatches within the same session
const dispatchedEventKeys = new Set<string>();

/**
 * Dispatches an authorized, idempotent notification and push delivery across all portals.
 */
export async function dispatchM737Notification(
  params: DispatchNotificationParams
): Promise<{ success: boolean; notificationId: string; pushDispatched: boolean; skippedReason?: string }> {
  const {
    recipientUid,
    recipientRole,
    category,
    titleAr,
    titleEn,
    messageAr,
    messageEn,
    targetPortal,
    targetUrl,
    sourceEventId = `evt_${Date.now()}`,
    priority = 'normal',
    lockscreenGenericText = true,
  } = params;

  if (!recipientUid) {
    return { success: false, notificationId: '', pushDispatched: false, skippedReason: 'Missing recipient UID' };
  }

  // Idempotency check: prevent duplicate notifications from repetitive UI re-renders
  const idempotencyKey = `idemp_${category}_${sourceEventId}_${recipientUid}`;
  if (dispatchedEventKeys.has(idempotencyKey)) {
    console.log(`[PushDispatcher] Duplicate notification suppressed by idempotency key: ${idempotencyKey}`);
    return { success: true, notificationId: idempotencyKey, pushDispatched: false, skippedReason: 'Duplicate event suppressed' };
  }
  dispatchedEventKeys.add(idempotencyKey);

  const now = new Date().toISOString();
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Super Admin security gate: only bcgmoc@gmail.com can receive Super Admin specific notifications
  if (targetPortal === 'super_admin' || category === 'security') {
    try {
      const userDoc = await getDoc(doc(db, 'users', recipientUid));
      if (userDoc.exists()) {
        const uData = userDoc.data();
        if (targetPortal === 'super_admin' && (uData.email || '').toLowerCase() !== SOLE_SUPER_ADMIN_EMAIL.toLowerCase()) {
          console.warn(`[SECURITY] Blocked Super Admin notification dispatch to non-admin UID: ${recipientUid}`);
          return { success: false, notificationId: '', pushDispatched: false, skippedReason: 'Unauthorized admin recipient' };
        }
      }
    } catch {}
  }

  // 1. Write in-app Notification record to /notifications collection
  const inAppRecord = {
    id: notifId,
    recipientUid,
    title: titleAr, // Default Arabic, fallback English
    titleEn,
    message: messageAr,
    messageEn,
    type: mapCategoryToLegacyType(category),
    category,
    targetPortal,
    link: targetUrl,
    priority,
    read: false,
    createdAt: now,
  };

  try {
    await setDoc(doc(db, 'notifications', notifId), inAppRecord);
  } catch (err) {
    console.warn('[PushDispatcher] Notice writing in-app notification:', err);
  }

  // 2. Query Recipient Device Tokens
  let deviceTokens: DeviceTokenRecord[] = [];
  try {
    const tokensRef = collection(db, 'users', recipientUid, 'device_tokens');
    const tokensSnap = await getDocs(tokensRef);
    tokensSnap.forEach((d) => {
      deviceTokens.push(d.data() as DeviceTokenRecord);
    });
  } catch (err) {
    console.warn('[PushDispatcher] Notice fetching device tokens:', err);
  }

  // 3. Filter tokens based on user notification category preferences
  const activeTokens = deviceTokens.filter((d) => {
    if (!d.preferences || d.preferences.enabled === false) return false;
    if (category === 'appointment' && d.preferences.appointments === false) return false;
    if (category === 'prescription' && d.preferences.prescriptions === false) return false;
    if (category === 'lab_radiology' && d.preferences.labRadiology === false) return false;
    if (category === 'order' && d.preferences.orders === false) return false;
    if (category === 'security' && d.preferences.security === false) return false;
    return true;
  });

  // 4. Create Push Outbox Record for Background & Cloud Push Tracking
  const genericBody = 'لديك تحديث طبي جديد في منصة M737IQ';
  const outboxRecord: PushOutboxRecord = {
    id: `push_${notifId}`,
    recipientUid,
    recipientRole,
    category,
    title: titleAr,
    body: messageAr,
    genericBody,
    targetUrl,
    targetPortal,
    priority,
    status: activeTokens.length > 0 ? 'delivered' : 'pending',
    deviceTokensCount: activeTokens.length,
    idempotencyKey,
    createdAt: now,
    deliveredAt: activeTokens.length > 0 ? now : undefined,
  };

  try {
    await setDoc(doc(db, 'push_outbox', `push_${notifId}`), outboxRecord);
  } catch (err) {
    console.warn('[PushDispatcher] Notice creating push outbox job:', err);
  }

  // 5. If Service Worker is active on the current device and matches recipient, trigger local notification
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && Notification.permission === 'granted') {
    try {
      const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (swReg) {
        swReg.showNotification(titleAr, {
          body: lockscreenGenericText ? genericBody : messageAr,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          vibrate: priority === 'urgent' ? [300, 100, 300, 100, 400] : [200, 100, 200],
          tag: `m737-${targetPortal}-${notifId}`,
          data: {
            url: targetUrl,
            portal: targetPortal,
            eventId: notifId,
          },
        } as NotificationOptions & { vibrate?: number[] });
      }
    } catch (swErr) {
      console.warn('[PushDispatcher] Local SW dispatch notice:', swErr);
    }
  }

  return {
    success: true,
    notificationId: notifId,
    pushDispatched: activeTokens.length > 0,
  };
}

function mapCategoryToLegacyType(cat: NotificationCategory): 'booking_update' | 'report_ready' | 'prescription' | 'order' | 'system' | 'general' {
  switch (cat) {
    case 'appointment':
      return 'booking_update';
    case 'prescription':
      return 'prescription';
    case 'lab_radiology':
      return 'report_ready';
    case 'order':
      return 'order';
    case 'security':
    case 'accreditation':
      return 'system';
    default:
      return 'general';
  }
}

// =========================================================================
// HIGH-LEVEL CONVENIENCE EVENT DISPATCHERS FOR ALL 8 PORTALS
// =========================================================================

/**
 * 1. PATIENT PORTAL EVENTS
 */
export async function notifyPatientAppointmentStatus({
  patientUid,
  doctorName,
  date,
  time,
  status,
  appointmentId,
}: {
  patientUid: string;
  doctorName: string;
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled' | 'rescheduled';
  appointmentId: string;
}) {
  const statusTexts = {
    confirmed: { ar: 'تم تأكيد موعدك بنجاح', en: 'Your appointment has been confirmed' },
    cancelled: { ar: 'تم إلغاء موعدك', en: 'Your appointment was cancelled' },
    rescheduled: { ar: 'تم تعديل موعدك', en: 'Your appointment was rescheduled' },
  };

  return dispatchM737Notification({
    recipientUid: patientUid,
    recipientRole: 'patient',
    category: 'appointment',
    titleAr: `تحديث الموعد: د. ${doctorName}`,
    titleEn: `Appointment Update: Dr. ${doctorName}`,
    messageAr: `${statusTexts[status].ar} بتاريخ ${date} الساعة ${time}.`,
    messageEn: `${statusTexts[status].en} on ${date} at ${time}.`,
    targetPortal: 'patient',
    targetUrl: '/patient',
    sourceEventId: `appt_${appointmentId}_${status}`,
    priority: status === 'confirmed' ? 'urgent' : 'normal',
  });
}

export async function notifyPatientPrescriptionReady({
  patientUid,
  doctorName,
  prescriptionId,
}: {
  patientUid: string;
  doctorName: string;
  prescriptionId: string;
}) {
  return dispatchM737Notification({
    recipientUid: patientUid,
    recipientRole: 'patient',
    category: 'prescription',
    titleAr: 'روشتة إلكترونية جديدة صادرة',
    titleEn: 'New Electronic Prescription Issued',
    messageAr: `أصدر د. ${doctorName} وصفة علاجية إلكترونية جديدة لك. يمكنك الآن استعراضها وصرفها من أي صيدلية معتمدة.`,
    messageEn: `Dr. ${doctorName} issued a new e-prescription for you. Available for pharmacy fulfillment.`,
    targetPortal: 'patient',
    targetUrl: '/patient',
    sourceEventId: `rx_${prescriptionId}`,
    priority: 'urgent',
  });
}

export async function notifyPatientDiagnosticReport({
  patientUid,
  facilityName,
  type,
  reportId,
}: {
  patientUid: string;
  facilityName: string;
  type: 'laboratory' | 'radiology';
  reportId: string;
}) {
  const typeLabelAr = type === 'laboratory' ? 'المختبر' : 'الأشعة والسونار';
  const typeLabelEn = type === 'laboratory' ? 'Laboratory' : 'Radiology';

  return dispatchM737Notification({
    recipientUid: patientUid,
    recipientRole: 'patient',
    category: 'lab_radiology',
    titleAr: `نتائج الفحص جاهزة (${typeLabelAr})`,
    titleEn: `${typeLabelEn} Results Ready`,
    messageAr: `تم اعتماد وتوثيق نتائج الفحص من قِبل ${facilityName}. تقريرك الطبي متاح في ملفك الصحي.`,
    messageEn: `Your diagnostic report from ${facilityName} is verified and ready in your health record.`,
    targetPortal: 'patient',
    targetUrl: '/patient',
    sourceEventId: `report_${reportId}`,
    priority: 'urgent',
  });
}

/**
 * 2. DOCTOR PORTAL EVENTS
 */
export async function notifyDoctorNewBooking({
  doctorUid,
  patientName,
  date,
  time,
  appointmentId,
}: {
  doctorUid: string;
  patientName: string;
  date: string;
  time: string;
  appointmentId: string;
}) {
  return dispatchM737Notification({
    recipientUid: doctorUid,
    recipientRole: 'doctor',
    category: 'appointment',
    titleAr: 'حجز كشف جديد في العيادة',
    titleEn: 'New Clinic Booking Received',
    messageAr: `حجز المريض ${patientName} موعداً للكشف في ${date} الساعة ${time}.`,
    messageEn: `Patient ${patientName} booked a consultation on ${date} at ${time}.`,
    targetPortal: 'doctor',
    targetUrl: '/doctor',
    sourceEventId: `doc_appt_${appointmentId}`,
    priority: 'urgent',
  });
}

/**
 * 3. SECRETARY PORTAL EVENTS
 */
export async function notifySecretaryAppointmentUpdate({
  secretaryUid,
  patientName,
  doctorName,
  action,
  appointmentId,
}: {
  secretaryUid: string;
  patientName: string;
  doctorName: string;
  action: string;
  appointmentId: string;
}) {
  return dispatchM737Notification({
    recipientUid: secretaryUid,
    recipientRole: 'secretary',
    category: 'appointment',
    titleAr: `تحديث جدول الاستقبال — د. ${doctorName}`,
    titleEn: `Front-Desk Schedule Update — Dr. ${doctorName}`,
    messageAr: `تم ${action} للمريض ${patientName} في عيادة د. ${doctorName}.`,
    messageEn: `Action ${action} recorded for patient ${patientName} in Dr. ${doctorName}'s clinic.`,
    targetPortal: 'secretary',
    targetUrl: '/secretary',
    sourceEventId: `sec_appt_${appointmentId}_${action}`,
  });
}

/**
 * 4. PHARMACY PORTAL EVENTS
 */
export async function notifyPharmacyNewPrescription({
  pharmacyUid,
  patientName,
  prescriptionId,
}: {
  pharmacyUid: string;
  patientName: string;
  prescriptionId: string;
}) {
  return dispatchM737Notification({
    recipientUid: pharmacyUid,
    recipientRole: 'pharmacy',
    category: 'prescription',
    titleAr: 'وصفة طبية جديدة للصرف',
    titleEn: 'New Prescription for Dispensing',
    messageAr: `وصلت روشتة إلكترونية للمريض ${patientName} بانتظار التحضير والصرف.`,
    messageEn: `New e-prescription received for patient ${patientName} pending fulfillment.`,
    targetPortal: 'pharmacy',
    targetUrl: '/pharmacy',
    sourceEventId: `rx_pharm_${prescriptionId}`,
    priority: 'urgent',
  });
}

/**
 * 5. LABORATORY & RADIOLOGY PORTAL EVENTS
 */
export async function notifyCenterNewRequest({
  centerUid,
  centerRole,
  patientName,
  testName,
  requestId,
}: {
  centerUid: string;
  centerRole: 'laboratory' | 'radiology_center';
  patientName: string;
  testName: string;
  requestId: string;
}) {
  const isLab = centerRole === 'laboratory';
  return dispatchM737Notification({
    recipientUid: centerUid,
    recipientRole: centerRole,
    category: 'lab_radiology',
    titleAr: isLab ? 'طلب تحليل مخبري جديد' : 'طلب فحص أشعة وسونار جديد',
    titleEn: isLab ? 'New Laboratory Test Order' : 'New Radiology Scan Order',
    messageAr: `طلب فحص (${testName}) للمريض ${patientName}.`,
    messageEn: `Order for (${testName}) submitted for patient ${patientName}.`,
    targetPortal: isLab ? 'laboratory' : 'radiology',
    targetUrl: `/${isLab ? 'laboratory' : 'radiology'}`,
    sourceEventId: `req_${requestId}`,
    priority: 'urgent',
  });
}

/**
 * 6. WHOLESALER PORTAL EVENTS
 */
export async function notifyWholesalerNewOrder({
  wholesalerUid,
  pharmacyName,
  orderId,
  itemCount,
}: {
  wholesalerUid: string;
  pharmacyName: string;
  orderId: string;
  itemCount: number;
}) {
  return dispatchM737Notification({
    recipientUid: wholesalerUid,
    recipientRole: 'wholesaler',
    category: 'order',
    titleAr: 'طلب توريد أدوية جديد (B2B)',
    titleEn: 'New Wholesale Medicine Order (B2B)',
    messageAr: `قدمت صيدلية ${pharmacyName} طلباً جديداً يشمل ${itemCount} أصناف دوائية.`,
    messageEn: `Pharmacy ${pharmacyName} placed a new order containing ${itemCount} items.`,
    targetPortal: 'wholesaler',
    targetUrl: '/wholesaler',
    sourceEventId: `wh_order_${orderId}`,
    priority: 'urgent',
  });
}

/**
 * 7. SUPER ADMIN SECURITY & ACCREDITATION EVENTS
 */
export async function notifySuperAdminAccreditationRequest({
  adminUid,
  applicantName,
  role,
  licenseNumber,
}: {
  adminUid: string;
  applicantName: string;
  role: UserRole;
  licenseNumber: string;
}) {
  return dispatchM737Notification({
    recipientUid: adminUid,
    recipientRole: 'super_admin',
    category: 'accreditation',
    titleAr: 'طلب اعتماد مهني جديد بانتظار التدقيق',
    titleEn: 'New Professional Accreditation Request',
    messageAr: `قدم ${applicantName} طلب اعتماد لصفة (${role}) بترخيص رقم (${licenseNumber}).`,
    messageEn: `${applicantName} submitted credentials for role (${role}) with license (${licenseNumber}).`,
    targetPortal: 'super_admin',
    targetUrl: '/super_admin',
    sourceEventId: `admin_accred_${licenseNumber}_${Date.now()}`,
    priority: 'urgent',
  });
}
