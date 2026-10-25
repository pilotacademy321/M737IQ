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
  | 'diagnostic_orders'
  | 'radiology'
  | 'wholesale_b2b'
  | 'accreditation'
  | 'profiles'
  | 'security'
  | 'patient_records';

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
  | 'lab_order_analysis_started'
  | 'lab_order_completed'
  | 'lab_order_rejected'
  | 'lab_order_cancelled'
  | 'radiology_order_created'
  | 'radiology_order_received'
  | 'radiology_order_scheduled'
  | 'radiology_order_in_progress'
  | 'radiology_imaging_started'
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
  | 'profile_contact_updated'
  | 'profile_updated'
  | 'wholesaler_profile_updated'
  | 'patient_search_by_medical_id'
  | 'doctor_chart_notes_updated'
  | 'clinic_visit_logged';

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

  return [];
}
