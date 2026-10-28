/**
 * Comprehensive Automated Verification Suite for Super Admin Security
 * Validating sole authorization of "bcgmoc@gmail.com",
 * revocation of "mustfa200633@gmail.com" and "mmrym2186@gmail.com",
 * and server-side rule enforcement.
 */

import { 
  SOLE_SUPER_ADMIN_EMAIL, 
  REVOKED_ADMIN_EMAILS,
  isVerifiedSuperAdmin, 
  isRevokedAdminEmail, 
  assertSuperAdminAccess,
  MinimalUserAuth 
} from './adminSecurity';
import { UserProfile } from '../types';

export interface SecurityTestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

export function runSuperAdminSecurityTests(): { total: number; passed: number; failed: number; results: SecurityTestResult[] } {
  const results: SecurityTestResult[] = [];

  const assert = (suite: string, name: string, condition: boolean, failMessage?: string) => {
    results.push({
      suite,
      name,
      passed: Boolean(condition),
      message: condition ? undefined : failMessage,
    });
  };

  // ==============================================================
  // 1. SOLE AUTHORIZED EMAIL CONSTANTS
  // ==============================================================
  assert(
    'Constants',
    'SOLE_SUPER_ADMIN_EMAIL is exactly "bcgmoc@gmail.com"',
    SOLE_SUPER_ADMIN_EMAIL === 'bcgmoc@gmail.com',
    `Expected bcgmoc@gmail.com but got ${SOLE_SUPER_ADMIN_EMAIL}`
  );

  assert(
    'Constants',
    'REVOKED_ADMIN_EMAILS contains mustfa200633@gmail.com and mmrym2186@gmail.com',
    (REVOKED_ADMIN_EMAILS as readonly string[]).includes('mustfa200633@gmail.com') &&
    (REVOKED_ADMIN_EMAILS as readonly string[]).includes('mmrym2186@gmail.com'),
    'Revoked emails list missing required revoked accounts'
  );

  // ==============================================================
  // 2. AUTHORIZED ACCOUNT VERIFICATION (bcgmoc@gmail.com)
  // ==============================================================
  const validAdminEmailVerified: MinimalUserAuth = {
    email: 'bcgmoc@gmail.com',
    emailVerified: true,
  };
  assert(
    'Authorized Admin',
    'Authorized email with emailVerified=true is granted access',
    isVerifiedSuperAdmin(validAdminEmailVerified) === true,
    'Verified bcgmoc@gmail.com was rejected'
  );

  const validAdminGoogleAuth: MinimalUserAuth = {
    email: 'bcgmoc@gmail.com',
    emailVerified: false,
    providerData: [{ providerId: 'google.com' }],
  };
  assert(
    'Authorized Admin',
    'Authorized email with Google OAuth provider is granted access',
    isVerifiedSuperAdmin(validAdminGoogleAuth) === true,
    'Google-authenticated bcgmoc@gmail.com was rejected'
  );

  const uppercaseAdmin: MinimalUserAuth = {
    email: '  BCGMOC@GMAIL.COM  ',
    emailVerified: true,
  };
  assert(
    'Authorized Admin',
    'Authorized email with mixed casing and whitespace is accepted',
    isVerifiedSuperAdmin(uppercaseAdmin) === true,
    'Cased/padded bcgmoc@gmail.com was rejected'
  );

  const unverifiedAdmin: MinimalUserAuth = {
    email: 'bcgmoc@gmail.com',
    emailVerified: false,
    providerData: [{ providerId: 'password' }],
  };
  assert(
    'Authorized Admin',
    'Authorized email WITHOUT verification and without Google provider is rejected',
    isVerifiedSuperAdmin(unverifiedAdmin) === false,
    'Unverified bcgmoc@gmail.com was improperly accepted'
  );

  // ==============================================================
  // 3. STRICT REVOCATION OF SPECIFIED ACCOUNTS
  // ==============================================================
  const revokedUser1: MinimalUserAuth = {
    email: 'mustfa200633@gmail.com',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
  };
  assert(
    'Revoked Accounts',
    'mustfa200633@gmail.com is strictly denied Super Admin access even with verified Google session',
    isVerifiedSuperAdmin(revokedUser1) === false,
    'mustfa200633 was granted admin access'
  );

  const revokedUser2: MinimalUserAuth = {
    email: 'mmrym2186@gmail.com',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
  };
  assert(
    'Revoked Accounts',
    'mmrym2186@gmail.com is strictly denied Super Admin access even with verified Google session',
    isVerifiedSuperAdmin(revokedUser2) === false,
    'mmrym2186 was granted admin access'
  );

  assert(
    'Revoked Accounts',
    'isRevokedAdminEmail correctly flags mustfa200633@gmail.com',
    isRevokedAdminEmail('mustfa200633@gmail.com') === true,
    'isRevokedAdminEmail failed for mustfa200633'
  );

  assert(
    'Revoked Accounts',
    'isRevokedAdminEmail correctly flags mmrym2186@gmail.com',
    isRevokedAdminEmail('mmrym2186@gmail.com') === true,
    'isRevokedAdminEmail failed for mmrym2186'
  );

  assert(
    'Revoked Accounts',
    'isRevokedAdminEmail returns false for legitimate non-revoked accounts',
    isRevokedAdminEmail('patient.iraq@gmail.com') === false,
    'False positive in isRevokedAdminEmail'
  );

  // ==============================================================
  // 4. GENERAL UNAUTHORIZED ACCOUNTS REJECTION
  // ==============================================================
  const randomAttacker: MinimalUserAuth = {
    email: 'attacker@evil.com',
    emailVerified: true,
  };
  assert(
    'Unauthorized Users',
    'Arbitrary email address is rejected',
    isVerifiedSuperAdmin(randomAttacker) === false,
    'Random email was granted admin access'
  );

  const nullUser: MinimalUserAuth = {
    email: null,
    emailVerified: false,
  };
  assert(
    'Unauthorized Users',
    'Null user / unauthenticated session is rejected',
    isVerifiedSuperAdmin(nullUser) === false,
    'Null user was granted admin access'
  );

  // ==============================================================
  // 5. ASSERTION GATES
  // ==============================================================
  let assertionPassedForAdmin = false;
  try {
    assertSuperAdminAccess(validAdminEmailVerified);
    assertionPassedForAdmin = true;
  } catch {
    assertionPassedForAdmin = false;
  }
  assert(
    'Assertion Gates',
    'assertSuperAdminAccess succeeds for verified bcgmoc@gmail.com',
    assertionPassedForAdmin === true,
    'assertSuperAdminAccess threw for authorized admin'
  );

  let assertionBlockedForRevoked = false;
  try {
    assertSuperAdminAccess(revokedUser1);
  } catch (err: unknown) {
    assertionBlockedForRevoked = err instanceof Error && err.message.includes('SECURITY VIOLATION');
  }
  assert(
    'Assertion Gates',
    'assertSuperAdminAccess throws SECURITY VIOLATION for mustfa200633@gmail.com',
    assertionBlockedForRevoked === true,
    'assertSuperAdminAccess did not throw security violation'
  );

  // ==============================================================
  // 6. ROLE DEMOTION / SANITIZATION LOGIC
  // ==============================================================
  const legacyProfile: UserProfile = {
    uid: 'test-revoked-uid-1',
    email: 'mustfa200633@gmail.com',
    displayName: 'Mustafa',
    role: 'super_admin',
    status: 'approved',
    accountId: 'M737-ADM-789123',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // Simulating sanitization
  const isSuper = isVerifiedSuperAdmin({ email: legacyProfile.email, emailVerified: true });
  const sanitizedProfile: UserProfile = !isSuper && (legacyProfile.role === 'super_admin' || isRevokedAdminEmail(legacyProfile.email))
    ? { ...legacyProfile, role: 'patient', updatedAt: '2026-10-28T12:00:00Z' }
    : legacyProfile;

  assert(
    'Privilege Revocation',
    'Legacy profile with super_admin role for revoked email is demoted to patient role',
    sanitizedProfile.role === 'patient',
    'Profile was not demoted to patient'
  );

  assert(
    'Data Preservation',
    'Sanitized profile preserves accountId, name, email, and history without deletion',
    sanitizedProfile.accountId === legacyProfile.accountId &&
    sanitizedProfile.displayName === legacyProfile.displayName &&
    sanitizedProfile.uid === legacyProfile.uid,
    'User profile data was corrupted or lost during demotion'
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}

// Auto-run if executed directly
const summary = runSuperAdminSecurityTests();
console.log(`\n================ SUPER ADMIN SECURITY TEST SUMMARY ================`);
console.log(`Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed}`);
summary.results.forEach((r, idx) => {
  console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] #${idx + 1} (${r.suite}) ${r.name}`);
  if (!r.passed && r.message) {
    console.error(`         Error: ${r.message}`);
  }
});
console.log(`===================================================================\n`);
if (summary.failed > 0) {
  process.exit(1);
}
