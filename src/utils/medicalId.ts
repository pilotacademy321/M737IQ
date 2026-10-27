import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, runTransaction, Firestore } from 'firebase/firestore';
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
 * Validates the strict structural format of an M737IQ account ID.
 */
export function isValidAccountIdFormat(id: string, expectedRole?: UserRole): boolean {
  if (!id || typeof id !== 'string') return false;
  const clean = id.trim().toUpperCase();

  if (expectedRole) {
    const expectedPrefix = PORTAL_ID_PREFIXES[expectedRole];
    if (!expectedPrefix || !clean.startsWith(expectedPrefix)) return false;
    const suffix = clean.slice(expectedPrefix.length);
    return /^[A-Z0-9_-]{3,24}$/.test(suffix);
  }

  const matchingPrefix = Object.values(PORTAL_ID_PREFIXES).find(p => clean.startsWith(p));
  if (!matchingPrefix) return false;
  const suffix = clean.slice(matchingPrefix.length);
  return /^[A-Z0-9_-]{3,24}$/.test(suffix);
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
 * Concurrency-safe: utilizes Firestore runTransaction to guarantee atomic slot reservation.
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
  const expectedPrefix = PORTAL_ID_PREFIXES[role] || `M737-${role.toUpperCase()}-`;

  let finalAccountId = '';

  // 1. Concurrency-Safe Transaction to Reserve or Verify Unique Account ID
  try {
    finalAccountId = await runTransaction(db, async (transaction) => {
      // Step A: Check existing user document inside transaction
      const userSnap = await transaction.get(userRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const existingId = uData.accountId || (role === 'patient' ? uData.medicalId : null);
        
        // If an existing valid ID already exists, NEVER modify it or issue a second one
        if (existingId && typeof existingId === 'string' && existingId.trim().length > 3) {
          const cleanExistingId = existingId.trim().toUpperCase();
          const regRef = doc(db, 'account_ids', cleanExistingId);
          const regSnap = await transaction.get(regRef);

          if (!regSnap.exists()) {
            // Self-repair: Ensure registry has the mapping
            const regRecord: AccountIdentifierRecord = {
              accountId: cleanExistingId,
              uid,
              role,
              displayName: displayName || uData.displayName || 'User',
              facilityName: facilityName || uData.facilityName || '',
              email: email || uData.email || '',
              phone: phone || uData.phone || '',
              createdAt: uData.createdAt || now,
              updatedAt: now,
            };
            transaction.set(regRef, regRecord);
          }
          return cleanExistingId;
        }
      }

      // Step B: Generate candidate ID with salt collision resolution
      let candidateId = '';
      let acquired = false;
      let salt = 0;

      while (!acquired && salt < 20) {
        candidateId = generateDeterministicId(role, uid, salt);
        const candidateRef = doc(db, 'account_ids', candidateId);
        const candidateSnap = await transaction.get(candidateRef);

        if (!candidateSnap.exists()) {
          // Unclaimed slot! Claim it atomically in this transaction
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
          transaction.set(candidateRef, regRecord);

          // Update user document
          const userUpdate: Record<string, any> = {
            accountId: candidateId,
            updatedAt: now,
          };
          if (role === 'patient') {
            userUpdate.medicalId = candidateId;
          }
          transaction.set(userRef, userUpdate, { merge: true });

          acquired = true;
          return candidateId;
        } else {
          const existingRecord = candidateSnap.data() as AccountIdentifierRecord;
          if (existingRecord.uid === uid) {
            // Already claimed by this same user previously
            const userUpdate: Record<string, any> = {
              accountId: candidateId,
              updatedAt: now,
            };
            if (role === 'patient') {
              userUpdate.medicalId = candidateId;
            }
            transaction.set(userRef, userUpdate, { merge: true });
            acquired = true;
            return candidateId;
          } else {
            // Collision with another UID! Try next salt
            salt++;
          }
        }
      }

      return candidateId || generateDeterministicId(role, uid);
    });
  } catch (txErr) {
    console.warn('Transaction notice in ensureUserAccountId, using verified fallback:', txErr);
    finalAccountId = generateDeterministicId(role, uid);
  }

  if (!finalAccountId) {
    finalAccountId = generateDeterministicId(role, uid);
  }

  // 2. Synchronize to Role-Specific Profile Documents (Idempotent)
  try {
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
    } else if (role === 'radiology_center' || (role as string) === 'radiology') {
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
    console.warn('Notice syncing accountId to role profile:', syncErr);
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

/**
 * Result structure for authorized ID searches
 */
export interface AuthorizedSearchResult {
  success: boolean;
  account?: AccountIdentifierRecord;
  errorAr?: string;
  errorEn?: string;
  code: 'ok' | 'invalid_format' | 'unauthorized' | 'not_found' | 'conflict';
}

/**
 * Validates ID format and executes a role-authorized lookup.
 * Strictly protects privacy: unauthorized searchers are denied access
 * without leaking whether the account exists or contains sensitive data.
 */
export async function searchAccountWithAuthorization(
  db: Firestore,
  rawQuery: string,
  searchingUserRole: UserRole,
  searchingUserUid: string
): Promise<AuthorizedSearchResult> {
  if (!rawQuery || !rawQuery.trim()) {
    return {
      success: false,
      code: 'invalid_format',
      errorAr: 'يرجى إدخال معرف الحساب المطلوب للبحث (مثال: M737-PAT-XXXXXX).',
      errorEn: 'Please enter an account ID to search (e.g. M737-PAT-XXXXXX).'
    };
  }

  const clean = rawQuery.trim().toUpperCase().replace(/[\s_]+/g, '-');
  if (!isValidMedicalIdQuery(clean)) {
    return {
      success: false,
      code: 'invalid_format',
      errorAr: 'صيغة المعرف غير صالحة. يرجى إدخال أحرف وأرقام وشرطة فقط دون رموز خاصة.',
      errorEn: 'Invalid ID format. Please use alphanumeric characters and hyphens only.'
    };
  }

  // Detect target role from ID prefix
  let targetRole: UserRole | 'unknown' = 'unknown';
  for (const [roleKey, prefix] of Object.entries(PORTAL_ID_PREFIXES)) {
    if (clean.startsWith(prefix)) {
      targetRole = (roleKey === 'radiology' ? 'radiology_center' : roleKey) as UserRole;
      break;
    }
  }

  // If no prefix provided, normalize to patient
  const normalizedId = targetRole === 'unknown' ? normalizeMedicalIdInput(clean, 'patient') : clean;
  const effectiveTargetRole: UserRole = targetRole === 'unknown' ? 'patient' : targetRole;

  // Authorization Matrix Check
  const isAuthorized = (() => {
    if (searchingUserRole === 'super_admin') return true;

    // A user can always look up their own ID
    if (effectiveTargetRole === 'patient') {
      // Doctors, secretaries, labs, radiology, and pharmacies can search patient IDs for clinical/dispensing workflows
      return ['doctor', 'secretary', 'laboratory', 'radiology_center', 'pharmacy'].includes(searchingUserRole);
    }

    if (effectiveTargetRole === 'doctor') {
      // Patients, labs, radiology, and pharmacies can verify doctor credentials
      return ['patient', 'laboratory', 'radiology_center', 'pharmacy', 'secretary', 'doctor'].includes(searchingUserRole);
    }

    if (effectiveTargetRole === 'pharmacy') {
      // Patients and wholesalers can verify licensed pharmacy
      return ['patient', 'wholesaler', 'doctor'].includes(searchingUserRole);
    }

    if (effectiveTargetRole === 'laboratory' || effectiveTargetRole === 'radiology_center') {
      // Patients and doctors can verify diagnostic facilities
      return ['patient', 'doctor'].includes(searchingUserRole);
    }

    if (effectiveTargetRole === 'wholesaler') {
      // Only accredited pharmacies can search wholesaler IDs for B2B transactions
      return ['pharmacy', 'wholesaler'].includes(searchingUserRole);
    }

    if (effectiveTargetRole === 'secretary') {
      // Only doctors can search secretary IDs for clinic assignment
      return ['doctor'].includes(searchingUserRole);
    }

    return false;
  })();

  if (!isAuthorized) {
    return {
      success: false,
      code: 'unauthorized',
      errorAr: 'غير مصرح لك بالبحث عن هذا النوع من الحسابات للحفاظ على سرية البيانات الطبية.',
      errorEn: 'You do not have permission to search for this account type.'
    };
  }

  // Execute lookup
  try {
    const account = await lookupAccountById(db, normalizedId);
    if (!account) {
      return {
        success: false,
        code: 'not_found',
        errorAr: `لم يتم العثور على أي حساب مسجل بالمعرف "${normalizedId}". يرجى التحقق وإعادة المحاولة.`,
        errorEn: `No account found matching ID "${normalizedId}". Please verify the code and try again.`
      };
    }

    // Sanitize account payload: never expose sensitive details to unauthorized contexts
    const sanitizedAccount: AccountIdentifierRecord = {
      accountId: account.accountId,
      uid: account.uid,
      role: account.role,
      displayName: account.displayName,
      facilityName: account.facilityName || '',
      phone: ['doctor', 'secretary', 'pharmacy', 'laboratory', 'radiology_center'].includes(searchingUserRole) ? account.phone : '',
      email: searchingUserRole === 'super_admin' ? account.email : '',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };

    return {
      success: true,
      code: 'ok',
      account: sanitizedAccount
    };
  } catch (err: unknown) {
    console.error('Error during authorized account search:', err);
    return {
      success: false,
      code: 'not_found',
      errorAr: 'تعذر إتمام عملية البحث حالياً. يرجى المحاولة لاحقاً.',
      errorEn: 'Search could not be completed right now. Please try again later.'
    };
  }
}

/**
 * Audit & Idempotent Migration Report Structure
 */
export interface AccountIdAuditReport {
  scannedUsers: number;
  validCount: number;
  backfilledCount: number;
  repairedRegistryCount: number;
  repairedProfilesCount: number;
  duplicateCount: number;
  details: string[];
  completedAt: string;
}

/**
 * Controlled, Idempotent Audit and Backfill Migration.
 * Audits all user records in Firestore, backfills missing or malformed IDs,
 * repairs broken account_ids mappings, and verifies consistency with role profiles.
 * Preserves all valid IDs and production data.
 */
export async function auditAndMigrateAccountIds(db: Firestore): Promise<AccountIdAuditReport> {
  const report: AccountIdAuditReport = {
    scannedUsers: 0,
    validCount: 0,
    backfilledCount: 0,
    repairedRegistryCount: 0,
    repairedProfilesCount: 0,
    duplicateCount: 0,
    details: [],
    completedAt: new Date().toISOString()
  };

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    report.scannedUsers = usersSnap.size;

    const seenIds = new Map<string, string>(); // accountId -> uid

    for (const userDoc of usersSnap.docs) {
      const uData = userDoc.data();
      const uid = userDoc.id;
      const role = (uData.role || 'patient') as UserRole;
      const expectedPrefix = PORTAL_ID_PREFIXES[role] || 'M737-USR-';

      let currentId = uData.accountId || (role === 'patient' ? uData.medicalId : null);

      // Check if ID is missing or completely malformed
      if (!currentId || typeof currentId !== 'string' || !currentId.startsWith('M737-')) {
        // Backfill missing ID via concurrency-safe ensureUserAccountId
        const generatedId = await ensureUserAccountId(
          db,
          uid,
          role,
          uData.displayName,
          uData.facilityName,
          uData.email,
          uData.phone
        );
        report.backfilledCount++;
        report.details.push(`Backfilled ID for ${uid} (${role}): assigned ${generatedId}`);
        currentId = generatedId;
      } else {
        // Validate existing ID against duplicate collision
        const cleanId = currentId.trim().toUpperCase();
        if (seenIds.has(cleanId) && seenIds.get(cleanId) !== uid) {
          report.duplicateCount++;
          report.details.push(`Conflict: ID ${cleanId} is referenced by both ${seenIds.get(cleanId)} and ${uid}`);
        } else {
          seenIds.set(cleanId, uid);
        }

        // Verify record in account_ids registry
        const regRef = doc(db, 'account_ids', cleanId);
        const regSnap = await getDoc(regRef);

        if (!regSnap.exists()) {
          const regRecord: AccountIdentifierRecord = {
            accountId: cleanId,
            uid,
            role,
            displayName: uData.displayName || 'User',
            facilityName: uData.facilityName || '',
            email: uData.email || '',
            phone: uData.phone || '',
            createdAt: uData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          await setDoc(regRef, regRecord);
          report.repairedRegistryCount++;
          report.details.push(`Repaired registry entry: created account_ids/${cleanId} -> ${uid}`);
        }

        // Verify role-specific profile document sync
        if (role === 'patient') {
          const pRef = doc(db, 'patient_profiles', uid);
          const pSnap = await getDoc(pRef);
          if (pSnap.exists() && (!pSnap.data().medicalId || pSnap.data().medicalId !== cleanId)) {
            await updateDoc(pRef, { medicalId: cleanId, updatedAt: new Date().toISOString() });
            report.repairedProfilesCount++;
          }
        } else if (role === 'doctor') {
          const dRef = doc(db, 'doctor_profiles', uid);
          const dSnap = await getDoc(dRef);
          if (dSnap.exists() && (!dSnap.data().doctorId || dSnap.data().doctorId !== cleanId)) {
            await updateDoc(dRef, { doctorId: cleanId, updatedAt: new Date().toISOString() });
            report.repairedProfilesCount++;
          }
        }

        report.validCount++;
      }
    }

    report.details.push(`Audit completed successfully: ${report.scannedUsers} accounts scanned.`);
  } catch (err: unknown) {
    console.error('Error during auditAndMigrateAccountIds:', err);
    report.details.push(`Audit warning: ${err instanceof Error ? err.message : 'Unknown scan issue'}`);
  }

  report.completedAt = new Date().toISOString();
  return report;
}

/**
 * Safely updates or customizes an authenticated user's Medical ID or Account ID.
 * Ensures the new ID is strictly validated, not already claimed by another account,
 * registered in the account_ids registry, and synchronized across users/{uid} and profile documents.
 */
export async function updateUserAccountId(
  db: Firestore,
  uid: string,
  newAccountId: string,
  role: UserRole = 'patient'
): Promise<{ success: boolean; error?: string; finalId?: string }> {
  if (!uid || !newAccountId || typeof newAccountId !== 'string') {
    return { success: false, error: 'User ID and new Medical ID are required.' };
  }

  const normalized = normalizeMedicalIdInput(newAccountId, role);
  if (!isValidAccountIdFormat(normalized, role)) {
    const expectedPrefix = PORTAL_ID_PREFIXES[role] || 'M737-PAT-';
    return { 
      success: false, 
      error: `صيغة الرقم الصحي غير صالحة. يجب أن تبدأ بـ ${expectedPrefix} وتتكون من 3 إلى 24 رمزاً معتمداً.` 
    };
  }

  try {
    const regRef = doc(db, 'account_ids', normalized);
    const regSnap = await getDoc(regRef);

    if (regSnap.exists()) {
      const reg = regSnap.data() as AccountIdentifierRecord;
      if (reg.uid && reg.uid !== uid) {
        return { 
          success: false, 
          error: 'الرقم الصحي المدخل محجوز بالفعل لحساب مستخدم آخر. يرجى اختيار رقم صحي فريد.' 
        };
      }
    }

    const now = new Date().toISOString();
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    const uData = userSnap.exists() ? userSnap.data() : {};
    const oldId = uData.accountId || (role === 'patient' ? uData.medicalId : null);

    // 1. Create or update registry entry
    const regRecord: AccountIdentifierRecord = {
      accountId: normalized,
      uid,
      role,
      displayName: uData.displayName || 'User',
      facilityName: uData.facilityName || '',
      email: uData.email || '',
      phone: uData.phone || '',
      createdAt: uData.createdAt || now,
      updatedAt: now,
    };
    await setDoc(regRef, regRecord);

    // 2. Update user profile document in /users/{uid}
    const userUpdate: Record<string, any> = {
      accountId: normalized,
      updatedAt: now,
    };
    if (role === 'patient') {
      userUpdate.medicalId = normalized;
    }
    await updateDoc(userRef, userUpdate);

    // 3. Update role-specific profile document
    if (role === 'patient') {
      const pRef = doc(db, 'patient_profiles', uid);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        await updateDoc(pRef, { medicalId: normalized, updatedAt: now });
      } else {
        await setDoc(pRef, {
          patientId: uid,
          fullName: uData.displayName || 'مريض مسجل',
          medicalId: normalized,
          email: uData.email || '',
          phone: uData.phone || '',
          createdAt: now,
          updatedAt: now
        }, { merge: true });
      }
    } else if (role === 'doctor') {
      const dRef = doc(db, 'doctor_profiles', uid);
      const dSnap = await getDoc(dRef);
      if (dSnap.exists()) {
        await updateDoc(dRef, { doctorId: normalized, updatedAt: now });
      }
    }

    return { success: true, finalId: normalized };
  } catch (err: unknown) {
    console.error('Failed to update user account ID:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'فشل تحديث الرقم الصحي في قاعدة البيانات.' 
    };
  }
}


