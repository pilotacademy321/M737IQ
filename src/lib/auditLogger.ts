/**
 * M737 Medical Platform - Centralized System Audit Logging Service
 * Records platform events across e-prescriptions, dispensing, diagnostic referrals,
 * results upload, and wholesale B2B procurement for Super Admin inspection and audit trails.
 */

import { db, sanitizeForFirestore } from './firebase';
import { doc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

export type AuditCategory =
  | 'prescriptions'
  | 'lab_diagnostics'
  | 'radiology'
  | 'wholesale_b2b'
  | 'accreditation'
  | 'security';

export type AuditActionType =
  | 'prescription_created'
  | 'prescription_accepted'
  | 'prescription_dispensing'
  | 'prescription_dispensed'
  | 'prescription_rejected'
  | 'prescription_cancelled'
  | 'lab_order_created'
  | 'lab_order_received'
  | 'lab_order_scheduled'
  | 'lab_order_in_progress'
  | 'lab_order_completed'
  | 'lab_order_rejected'
  | 'lab_order_cancelled'
  | 'radiology_order_created'
  | 'radiology_order_received'
  | 'radiology_order_scheduled'
  | 'radiology_order_in_progress'
  | 'radiology_order_completed'
  | 'radiology_order_rejected'
  | 'radiology_order_cancelled'
  | 'wholesale_order_created'
  | 'wholesale_order_approved'
  | 'wholesale_order_preparing'
  | 'wholesale_order_dispatched'
  | 'wholesale_order_delivered'
  | 'wholesale_order_cancelled'
  | 'wholesale_stock_adjusted'
  | 'profile_photo_updated'
  | 'profile_contact_updated';

export interface SystemAuditLogEntry {
  id: string;
  action: AuditActionType;
  category: AuditCategory;
  actorUid: string;
  actorName: string;
  actorRole: string;
  targetUid?: string;
  targetName?: string;
  targetRole?: string;
  resourceId: string;
  resourceNumber?: string;
  status: string;
  details: string;
  timestamp: string;
}

// In-memory fallback and seed cache
const LOCAL_AUDIT_LOG_KEY = 'm737_system_audit_logs';

/**
 * Record a critical medical or transaction event in the system audit trail.
 */
export async function logAuditEvent(entry: Omit<SystemAuditLogEntry, 'id' | 'timestamp'>): Promise<SystemAuditLogEntry> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const fullRecord: SystemAuditLogEntry = {
    id,
    timestamp,
    ...entry,
  };

  // 1. Persist to Firestore
  try {
    const docRef = doc(db, 'system_audit_logs', id);
    await setDoc(docRef, sanitizeForFirestore(fullRecord));
  } catch (err: unknown) {
    console.warn('System audit log fallback to local buffer:', err);
  }

  // 2. Cache in local buffer for seamless offline / instant display
  try {
    const cached = getLocalCachedAuditLogs();
    const updated = [fullRecord, ...cached].slice(0, 200);
    localStorage.setItem(LOCAL_AUDIT_LOG_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage limits
  }

  return fullRecord;
}

/**
 * Retrieve system audit logs for Super Admin with caching fallback.
 */
export async function fetchSystemAuditLogs(maxCount = 100): Promise<SystemAuditLogEntry[]> {
  try {
    const q = query(
      collection(db, 'system_audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const records = snap.docs.map((d) => d.data() as SystemAuditLogEntry);
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Update local storage cache
      try {
        localStorage.setItem(LOCAL_AUDIT_LOG_KEY, JSON.stringify(records));
      } catch {}
      return records;
    }
  } catch (err: unknown) {
    console.warn('Could not query firestore system_audit_logs directly, loading local cache:', err);
  }

  return getLocalCachedAuditLogs();
}

/**
 * Helper to fetch local cached logs or generate seed logs if clean
 */
function getLocalCachedAuditLogs(): SystemAuditLogEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  // Generate initial bootstrap logs to demonstrate multi-portal audit capability
  const initialBootstrapLogs: SystemAuditLogEntry[] = [
    {
      id: 'audit_init_1',
      action: 'prescription_dispensed',
      category: 'prescriptions',
      actorUid: 'demo_pharmacy_alnoor',
      actorName: 'صيدلية النور النموذجية',
      actorRole: 'pharmacy',
      targetUid: 'demo_patient_sara',
      targetName: 'سارة حيدر العراقي',
      targetRole: 'patient',
      resourceId: 'demo_rx_sara_1',
      resourceNumber: 'RX-IQ-2026-8814',
      status: 'dispensed',
      details: 'تم توثيق صرف الوصفة الطبية إلكترونياً واعتماد خروج الأدوية للمريضة مع إشعار الطبيب.',
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
    {
      id: 'audit_init_2',
      action: 'lab_order_completed',
      category: 'lab_diagnostics',
      actorUid: 'demo_lab_baghdad',
      actorName: 'مختبر بغداد المركزي التخصصي',
      actorRole: 'laboratory',
      targetUid: 'demo_patient_sara',
      targetName: 'سارة حيدر العراقي',
      targetRole: 'patient',
      resourceId: 'demo_lab_ord_1',
      resourceNumber: 'LAB-ORD-9021',
      status: 'completed',
      details: 'تم فحص عينات الدم واعتماد تقرير التحاليل الشامل وتوثيقه وربطه بملف المريض والطبيب المحيل.',
      timestamp: new Date(Date.now() - 3600000 * 8).toISOString(),
    },
    {
      id: 'audit_init_3',
      action: 'wholesale_order_approved',
      category: 'wholesale_b2b',
      actorUid: 'demo_wholesaler_samarra',
      actorName: 'مذخر سامراء العلمي الحديث',
      actorRole: 'wholesaler',
      targetUid: 'demo_pharmacy_amal',
      targetName: 'صيدلية الأمل المركزية',
      targetRole: 'pharmacy',
      resourceId: 'w_ord_sample_1',
      resourceNumber: 'INV-B2B-88301',
      status: 'approved',
      details: 'تم قبول طلبية الشراء بالجملة وخصم الكميات المحجوزة من مخزون المذخر وتجهيز الإرسالية.',
      timestamp: new Date(Date.now() - 3600000 * 14).toISOString(),
    },
    {
      id: 'audit_init_4',
      action: 'radiology_order_completed',
      category: 'radiology',
      actorUid: 'demo_radiology_dijla',
      actorName: 'مركز دجلة للأشعة والمفراس والرنين',
      actorRole: 'radiology_center',
      targetUid: 'demo_patient_omar',
      targetName: 'عمر فاروق البغدادي',
      targetRole: 'patient',
      resourceId: 'demo_rad_ord_1',
      resourceNumber: 'RAD-ORD-8812',
      status: 'completed',
      details: 'تم إجراء فحص السونار وإرفاق التقرير التشخيصي المعتمد وإرسال إشعار للطبيب المعالج والمريض.',
      timestamp: new Date(Date.now() - 3600000 * 22).toISOString(),
    },
  ];

  try {
    localStorage.setItem(LOCAL_AUDIT_LOG_KEY, JSON.stringify(initialBootstrapLogs));
  } catch {}

  return initialBootstrapLogs;
}
