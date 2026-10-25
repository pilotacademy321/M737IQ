import { collection, query, where, getDocs, doc, getDoc, Firestore } from 'firebase/firestore';
import { PatientProfile } from '../types';

/**
 * M737 Medical Platform - Unified Medical Identity Utilities
 * Provides deterministic, collision-resistant Medical IDs, normalization, and validation.
 */

/**
 * Standard prefix for Iraqi Medical Identity on M737 platform
 */
export const MEDICAL_ID_PREFIX = 'M737-PAT-';

/**
 * Generates a unique, deterministic, and persistent Medical ID from a user UID.
 * Ensures the patient always receives the exact same Medical ID across sessions and logins.
 */
export function generateUniqueMedicalId(uid: string): string {
  if (!uid || typeof uid !== 'string') {
    return `${MEDICAL_ID_PREFIX}GUEST`;
  }

  const cleanUid = uid.trim();

  // If already a valid medical ID, return normalized
  if (cleanUid.toUpperCase().startsWith(MEDICAL_ID_PREFIX)) {
    return cleanUid.toUpperCase();
  }

  // Calculate deterministic 32-bit FNV-1a style hash from UID
  let hash = 2166136261;
  for (let i = 0; i < cleanUid.length; i++) {
    hash ^= cleanUid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Generate 6-character alphanumeric string from hash
  const hashStr = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(-6);

  // Take first 3-4 alphanumeric characters of UID for personalization
  const uidPrefix = cleanUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();

  const finalCode = `${uidPrefix}${hashStr}`.slice(0, 8);
  return `${MEDICAL_ID_PREFIX}${finalCode}`;
}

/**
 * Standard ID prefixes for each portal entity
 */
export const PORTAL_ID_PREFIXES: Record<string, string> = {
  patient: 'M737-PAT-',
  doctor: 'M737-DOC-',
  pharmacy: 'M737-PHARM-',
  laboratory: 'M737-LAB-',
  radiology: 'M737-RAD-',
  radiology_center: 'M737-RAD-',
  wholesaler: 'M737-WHOLE-',
  secretary: 'M737-SEC-',
  super_admin: 'M737-ADM-',
};

/**
 * Generates a clean, deterministic portal/facility ID for any user role.
 * Ensures every doctor, pharmacy, lab, radiology center, wholesaler, and secretary
 * has a certified M737 identifier across all portals.
 */
export function generateFacilityOrUserId(role: string, uid: string): string {
  if (!uid || typeof uid !== 'string') return `M737-${role.toUpperCase()}-001`;

  const cleanUid = uid.trim();
  const prefix = PORTAL_ID_PREFIXES[role] || `M737-${role.toUpperCase()}-`;

  if (cleanUid.toUpperCase().startsWith(prefix)) {
    return cleanUid.toUpperCase();
  }

  // Calculate deterministic hash
  let hash = 2166136261;
  for (let i = 0; i < cleanUid.length; i++) {
    hash ^= cleanUid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hashStr = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  const uidPrefix = cleanUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
  return `${prefix}${uidPrefix}${hashStr}`.slice(0, prefix.length + 8);
}

/**
 * Normalizes user input when searching for a patient.
 * Handles inputs with or without prefix, lowercase/uppercase, and trims whitespace.
 * e.g. "sara96" -> "M737-PAT-SARA96"
 * e.g. "m737-pat-sara96" -> "M737-PAT-SARA96"
 * e.g. "M737PATSARA96" -> "M737-PAT-SARA96"
 */
export function normalizeMedicalIdInput(rawInput: string): string {
  if (!rawInput) return '';

  const clean = rawInput.trim().toUpperCase().replace(/[\s_]+/g, '-');

  if (clean.startsWith('M737-PAT-')) {
    return clean;
  }

  if (clean.startsWith('M737PAT')) {
    return `M737-PAT-${clean.slice(7)}`;
  }

  if (clean.startsWith('PAT-')) {
    return `M737-${clean}`;
  }

  return `${MEDICAL_ID_PREFIX}${clean}`;
}

/**
 * Validates whether the search input has valid safe characters
 * to prevent arbitrary junk strings, query poisoning, or injection.
 */
export function isValidMedicalIdQuery(input: string): boolean {
  if (!input) return false;
  const trimmed = input.trim();
  if (trimmed.length < 2 || trimmed.length > 64) return false;
  // Only allow alphanumeric characters and hyphens
  return /^[a-zA-Z0-9\-]+$/.test(trimmed);
}

/**
 * Searches for a patient profile across Firestore by normalized Medical ID or document ID.
 * Works seamlessly across all portals (Doctor, Pharmacy, Laboratory, Radiology, Secretary).
 */
export async function searchPatientProfileAcrossSystem(
  db: Firestore,
  rawId: string
): Promise<PatientProfile | null> {
  if (!rawId || !isValidMedicalIdQuery(rawId)) return null;

  const cleanUpper = rawId.trim().toUpperCase();
  const normalizedMedicalId = normalizeMedicalIdInput(rawId);

  try {
    // 1. Query by normalized medical ID (e.g. M737-PAT-XXXXXX)
    const q1 = query(collection(db, 'patient_profiles'), where('medicalId', '==', normalizedMedicalId));
    let snap = await getDocs(q1);

    if (snap.empty && cleanUpper !== normalizedMedicalId) {
      const q2 = query(collection(db, 'patient_profiles'), where('medicalId', '==', cleanUpper));
      snap = await getDocs(q2);
    }

    if (!snap.empty) {
      return { patientId: snap.docs[0].id, ...snap.docs[0].data() } as PatientProfile;
    }

    // Direct get by document ID
    const directSnap = await getDoc(doc(db, 'patient_profiles', rawId.trim()));
    if (directSnap.exists()) {
      return { patientId: directSnap.id, ...directSnap.data() } as PatientProfile;
    }
  } catch (err) {
    console.warn('Patient lookup across system note:', err);
  }

  return null;
}
