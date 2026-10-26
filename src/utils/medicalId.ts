import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, Firestore } from 'firebase/firestore';
import { PatientProfile, UserRole, AccountIdentifierRecord } from '../types';

/**
 * M737 Medical Platform - Unified Medical & Facility Identity Architecture
 * Provides persistent, collision-resistant, verified IDs for every account across all portals.
 */

/**
 * Standard ID prefixes for each portal entity in M737 platform
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

export const MEDICAL_ID_PREFIX = PORTAL_ID_PREFIXES.patient;

/**
 * Generates a deterministic candidate alphanumeric code from UID + optional collision salt.
 */
export function generateDeterministicId(role: string, uid: string, salt: number = 0): string {
  if (!uid || typeof uid !== 'string') {
    return `${PORTAL_ID_PREFIXES[role] || 'M737-USR-'}GUEST`;
  }

  const cleanUid = uid.trim();
  const prefix = PORTAL_ID_PREFIXES[role] || `M737-${role.toUpperCase()}-`;

  if (cleanUid.toUpperCase().startsWith(prefix)) {
    return cleanUid.toUpperCase();
  }

  // Calculate 32-bit FNV-1a style hash with salt
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < cleanUid.length; i++) {
    hash ^= cleanUid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const hashStr = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  const uidPrefix = cleanUid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'USR';
  
  const saltSuffix = salt > 0 ? `${salt}` : '';
  const finalCode = `${uidPrefix}${hashStr}${saltSuffix}`.slice(0, 8);
  return `${prefix}${finalCode}`;
}

/**
 * Backwards compatibility helper for existing component call sites.
 */
export function generateUniqueMedicalId(uid: string): string {
  return generateDeterministicId('patient', uid);
}

/**
 * Backwards compatibility helper for existing component call sites.
 */
export function generateFacilityOrUserId(role: string, uid: string): string {
  return generateDeterministicId(role, uid);
}

/**
 * Normalizes user input when searching for an ID.
 * Handles inputs with or without prefix, lowercase/uppercase, and trims whitespace.
 * e.g. "sara96" -> "M737-PAT-SARA96"
 * e.g. "m737-doc-7a8b9c" -> "M737-DOC-7A8B9C"
 */
export function normalizeMedicalIdInput(rawInput: string, defaultRole: string = 'patient'): string {
  if (!rawInput) return '';

  const clean = rawInput.trim().toUpperCase().replace(/[\s_]+/g, '-');
  const targetPrefix = PORTAL_ID_PREFIXES[defaultRole] || MEDICAL_ID_PREFIX;

  // If already starts with any valid M737 prefix, return normalized
  for (const prefix of Object.values(PORTAL_ID_PREFIXES)) {
    if (clean.startsWith(prefix)) {
      return clean;
    }
  }

  if (clean.startsWith('M737PAT')) {
    return `M737-PAT-${clean.slice(7)}`;
  }
  if (clean.startsWith('M737DOC')) {
    return `M737-DOC-${clean.slice(7)}`;
  }
  if (clean.startsWith('M737PHARM')) {
    return `M737-PHARM-${clean.slice(9)}`;
  }
  if (clean.startsWith('M737LAB')) {
    return `M737-LAB-${clean.slice(7)}`;
  }
  if (clean.startsWith('M737RAD')) {
    return `M737-RAD-${clean.slice(7)}`;
  }
  if (clean.startsWith('M737WHOLE')) {
    return `M737-WHOLE-${clean.slice(9)}`;
  }
  if (clean.startsWith('M737SEC')) {
    return `M737-SEC-${clean.slice(7)}`;
  }
  if (clean.startsWith('M737ADM')) {
    return `M737-ADM-${clean.slice(7)}`;
  }

  if (clean.startsWith('PAT-')) {
    return `M737-${clean}`;
  }

  return `${targetPrefix}${clean}`;
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
 * Ensures a unique, permanent, collision-resistant account ID is registered in Firestore
 * and linked irrevocably to the user's account and profile documents.
 */
export async function ensureUserAccountId(
  db: Firestore,
  uid: string,
  role: UserRole,
  displayName?: string,
  facilityName?: string,
  email?: string,
  phone?: string
): Promise<string> {
  if (!uid) return '';

  const now = new Date().toISOString();
  const userRef = doc(db, 'users', uid);

  // 1. Check if user document already has an accountId
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const existingId = uData.accountId || (role === 'patient' ? uData.medicalId : null);
      if (existingId) {
        // Ensure record exists in account_ids registry
        const regRef = doc(db, 'account_ids', existingId);
        const regSnap = await getDoc(regRef);
        if (!regSnap.exists()) {
          const regRecord: AccountIdentifierRecord = {
            accountId: existingId,
            uid,
            role,
            displayName: displayName || uData.displayName || 'User',
            facilityName: facilityName || uData.facilityName || '',
            email: email || uData.email || '',
            phone: phone || uData.phone || '',
            createdAt: uData.createdAt || now,
            updatedAt: now,
          };
          await setDoc(regRef, regRecord);
        }
        return existingId;
      }
    }
  } catch (err) {
    console.warn('Error reading existing accountId:', err);
  }

  // 2. Generate and verify unique collision-resistant candidate ID
  let salt = 0;
  let finalAccountId = '';
  let acquired = false;

  while (!acquired && salt < 20) {
    const candidateId = generateDeterministicId(role, uid, salt);
    try {
      const candidateRef = doc(db, 'account_ids', candidateId);
      const candidateSnap = await getDoc(candidateRef);

      if (!candidateSnap.exists()) {
        // Available! Claim it
        const regRecord: AccountIdentifierRecord = {
          accountId: candidateId,
          uid,
          role,
          displayName: displayName || 'User',
          facilityName: facilityName || '',
          email: email || '',
          phone: phone || '',
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(candidateRef, regRecord);
        finalAccountId = candidateId;
        acquired = true;
      } else {
        const existingRecord = candidateSnap.data() as AccountIdentifierRecord;
        if (existingRecord.uid === uid) {
          // Already claimed by this same user
          finalAccountId = candidateId;
          acquired = true;
        } else {
          // Collision with a different user UID! Increment salt and retry
          salt++;
        }
      }
    } catch (err) {
      console.warn('Error reserving account ID slot:', err);
      finalAccountId = candidateId;
      acquired = true; // Proceed with fallback
    }
  }

  if (!finalAccountId) {
    finalAccountId = generateDeterministicId(role, uid);
  }

  // 3. Persist ID on users collection and role profile collections
  try {
    const userUpdate: Record<string, any> = {
      accountId: finalAccountId,
      updatedAt: now,
    };
    if (role === 'patient') {
      userUpdate.medicalId = finalAccountId;
    }
    await updateDoc(userRef, userUpdate);

    // Sync to role-specific document
    if (role === 'patient') {
      const pRef = doc(db, 'patient_profiles', uid);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { medicalId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'doctor') {
      const dRef = doc(db, 'doctor_profiles', uid);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) {
        await updateDoc(dRef, { doctorId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'pharmacy') {
      const phRef = doc(db, 'pharmacy_profiles', uid);
      const phSnap = await getDoc(phRef);
      if (phSnap.exists()) {
        await updateDoc(phRef, { pharmacyId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'laboratory') {
      const lRef = doc(db, 'lab_profiles', uid);
      const lSnap = await getDoc(lRef);
      if (lSnap.exists()) {
        await updateDoc(lRef, { labId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'radiology_center') {
      const rRef = doc(db, 'radiology_profiles', uid);
      const rSnap = await getDoc(rRef);
      if (rSnap.exists()) {
        await updateDoc(rRef, { centerId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'wholesaler') {
      const wRef = doc(db, 'wholesaler_profiles', uid);
      const wSnap = await getDoc(wRef);
      if (wSnap.exists()) {
        await updateDoc(wRef, { wholesalerId: finalAccountId, updatedAt: now });
      }
    } else if (role === 'secretary') {
      const sRef = doc(db, 'secretary_assignments', uid);
      const sSnap = await getDoc(sRef);
      if (sSnap.exists()) {
        await updateDoc(sRef, { secretaryId: finalAccountId, updatedAt: now });
      }
    }
  } catch (syncErr) {
    console.warn('Notice syncing accountId to profile:', syncErr);
  }

  return finalAccountId;
}

/**
 * Resolves any account record by its persistent ID across the platform.
 */
export async function lookupAccountById(
  db: Firestore,
  rawId: string
): Promise<AccountIdentifierRecord | null> {
  if (!rawId || !isValidMedicalIdQuery(rawId)) return null;

  const clean = rawId.trim().toUpperCase();

  try {
    // 1. Direct registry get
    const regRef = doc(db, 'account_ids', clean);
    const regSnap = await getDoc(regRef);
    if (regSnap.exists()) {
      return regSnap.data() as AccountIdentifierRecord;
    }

    // 2. Query users where accountId == clean
    const qUser = query(collection(db, 'users'), where('accountId', '==', clean));
    const userSnap = await getDocs(qUser);
    if (!userSnap.empty) {
      const u = userSnap.docs[0].data();
      return {
        accountId: u.accountId || clean,
        uid: userSnap.docs[0].id,
        role: u.role,
        displayName: u.displayName || 'User',
        facilityName: u.facilityName || '',
        email: u.email || '',
        phone: u.phone || '',
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Error in lookupAccountById:', err);
  }

  return null;
}

/**
 * Searches for a real patient profile across Firestore by normalized Medical ID or document ID.
 * Strictly queries the real database without falling back to mock or test data.
 * Returns null when no patient is found so UI can clearly inform the user.
 */
export async function searchPatientProfileAcrossSystem(
  db: Firestore,
  rawId: string
): Promise<PatientProfile | null> {
  if (!rawId || !isValidMedicalIdQuery(rawId)) return null;

  const cleanUpper = rawId.trim().toUpperCase();
  const normalizedMedicalId = normalizeMedicalIdInput(rawId, 'patient');

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

    // 2. Direct get by patientId document ID
    const directSnap = await getDoc(doc(db, 'patient_profiles', rawId.trim()));
    if (directSnap.exists()) {
      return { patientId: directSnap.id, ...directSnap.data() } as PatientProfile;
    }

    // 3. Check account_ids registry in case patient profile has uid
    const regSnap = await getDoc(doc(db, 'account_ids', normalizedMedicalId));
    if (regSnap.exists()) {
      const reg = regSnap.data() as AccountIdentifierRecord;
      if (reg.role === 'patient' && reg.uid) {
        const pSnap = await getDoc(doc(db, 'patient_profiles', reg.uid));
        if (pSnap.exists()) {
          return { patientId: pSnap.id, ...pSnap.data() } as PatientProfile;
        }
      }
    }
  } catch (err) {
    console.warn('Real patient lookup query note:', err);
  }

  return null;
}
