/**
 * M737IQ Administrative Security Architecture
 * 
 * Strict enforcement of the sole authorized Super Administrator:
 * "bcgmoc@gmail.com"
 * 
 * Comprehensive revocation of legacy administrative privileges for:
 * - "mustfa200633@gmail.com"
 * - "mmrym2186@gmail.com"
 */

import { User } from 'firebase/auth';
import { 
  Firestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { UserProfile, UserRole } from '../types';

export const SOLE_SUPER_ADMIN_EMAIL = 'bcgmoc@gmail.com';
export const REVOKED_ADMIN_EMAILS = [
  'mustfa200633@gmail.com',
  'mmrym2186@gmail.com'
] as const;

export interface MinimalUserAuth {
  email?: string | null;
  emailVerified?: boolean;
  providerData?: Array<{ providerId: string }>;
}

/**
 * Validates whether an authenticated user is the legitimate, verified Super Admin.
 * STRICT ENFORCEMENT:
 * 1. Email must match exactly "bcgmoc@gmail.com" (case-insensitive).
 * 2. Account must be email verified (or authenticated via Google OAuth).
 */
export function isVerifiedSuperAdmin(user: MinimalUserAuth | null | undefined): boolean {
  if (!user || !user.email) return false;
  const normalized = user.email.trim().toLowerCase();
  if (normalized !== SOLE_SUPER_ADMIN_EMAIL.toLowerCase()) return false;

  const isGoogle = Array.isArray(user.providerData) && 
    user.providerData.some((p) => p.providerId === 'google.com');

  return Boolean(user.emailVerified) || Boolean(isGoogle);
}

/**
 * Checks whether an email belongs to one of the revoked administrative accounts.
 */
export function isRevokedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (REVOKED_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

/**
 * Throws a security violation error if the caller is not the verified Super Admin.
 */
export function assertSuperAdminAccess(user: MinimalUserAuth | null | undefined): void {
  if (!isVerifiedSuperAdmin(user)) {
    throw new Error('SECURITY VIOLATION: Unauthorized administrative operation. Only the verified account bcgmoc@gmail.com is permitted.');
  }
}

/**
 * Scans Firestore and actively revokes administrative claims, admin documents,
 * and 'super_admin' roles from any unauthorized account (including the two revoked accounts).
 * Preserves all patient profiles, medical records, and normal non-admin portal access.
 */
export async function auditAndRevokeUnauthorizedAdmins(
  db: Firestore,
  currentAuthenticatedUser: User | null
): Promise<{ revokedUsers: string[]; removedAdminDocs: string[] }> {
  const revokedUsers: string[] = [];
  const removedAdminDocs: string[] = [];

  // Only the authorized Super Admin or system initialization may trigger full administrative sanitization
  if (currentAuthenticatedUser && !isVerifiedSuperAdmin(currentAuthenticatedUser)) {
    console.warn('[SECURITY] Non-admin user attempted to run administrative revocation scan.');
    return { revokedUsers, removedAdminDocs };
  }

  try {
    // 1. Search for users with the revoked emails
    for (const revokedEmail of REVOKED_ADMIN_EMAILS) {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', revokedEmail));
        const snap = await getDocs(q);

        for (const userDoc of snap.docs) {
          const data = userDoc.data() as UserProfile;
          if (data.role === 'super_admin') {
            console.warn(`[SECURITY] Revoking super_admin role from revoked email doc: ${userDoc.id} (${revokedEmail})`);
            await updateDoc(userDoc.ref, {
              role: 'patient', // Revert to ordinary safe user role
              updatedAt: new Date().toISOString(),
            });
            revokedUsers.push(`${revokedEmail} (${userDoc.id})`);
          }

          // Also remove any corresponding /admins/{uid} doc
          try {
            const adminDocRef = doc(db, 'admins', userDoc.id);
            const adminSnap = await getDoc(adminDocRef);
            if (adminSnap.exists()) {
              await deleteDoc(adminDocRef);
              removedAdminDocs.push(userDoc.id);
            }
          } catch {
            // Ignore if doc does not exist
          }
        }
      } catch (err) {
        console.warn(`Notice scanning revoked email ${revokedEmail}:`, err);
      }
    }

    // 2. Also search all users with role == 'super_admin' to ensure no unauthorized super_admin exists
    try {
      const superAdminsQuery = query(collection(db, 'users'), where('role', '==', 'super_admin'));
      const adminUsersSnap = await getDocs(superAdminsQuery);

      for (const adminDoc of adminUsersSnap.docs) {
        const data = adminDoc.data() as UserProfile;
        const email = (data.email || '').trim().toLowerCase();
        if (email !== SOLE_SUPER_ADMIN_EMAIL.toLowerCase()) {
          console.warn(`[SECURITY] Found unauthorized user with super_admin role: ${adminDoc.id} (${email}). Revoking.`);
          await updateDoc(adminDoc.ref, {
            role: 'patient',
            updatedAt: new Date().toISOString(),
          });
          revokedUsers.push(`${email || 'unknown'} (${adminDoc.id})`);

          try {
            await deleteDoc(doc(db, 'admins', adminDoc.id));
            removedAdminDocs.push(adminDoc.id);
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Notice scanning super_admin role users:', err);
    }
  } catch (err) {
    console.warn('Audit and revocation process completed with notice:', err);
  }

  return { revokedUsers, removedAdminDocs };
}
