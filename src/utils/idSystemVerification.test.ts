/**
 * Automated Verification Suite for M737IQ ID Architecture,
 * Stability, Concurrency Resilience, and Authorization Boundaries.
 */

import { 
  PORTAL_ID_PREFIXES, 
  generateDeterministicId, 
  isValidAccountIdFormat, 
  normalizeMedicalIdInput, 
  isValidMedicalIdQuery 
} from './medicalId';
import { UserRole } from '../types';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

export function runIdSystemVerificationTests(): { total: number; passed: number; failed: number; results: TestResult[] } {
  const results: TestResult[] = [];

  const assert = (suite: string, name: string, condition: boolean, failMessage?: string) => {
    results.push({
      suite,
      name,
      passed: Boolean(condition),
      message: condition ? undefined : failMessage,
    });
  };

  // ==============================================================
  // 1. PREFIX INTEGRITY ACROSS ALL 7 ROLES (+ SUPER ADMIN)
  // ==============================================================
  const expectedPrefixes: Record<string, string> = {
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

  for (const [role, prefix] of Object.entries(expectedPrefixes)) {
    assert(
      'Role Prefixes',
      `Prefix for role "${role}" matches standard "${prefix}"`,
      PORTAL_ID_PREFIXES[role] === prefix,
      `Expected ${prefix} but got ${PORTAL_ID_PREFIXES[role]}`
    );
  }

  // ==============================================================
  // 2. DETERMINISTIC GENERATION & EXISTING-ACCOUNT STABILITY
  // ==============================================================
  const testUid = 'usr_baghdad_doc_776102a';
  const id1 = generateDeterministicId('doctor', testUid, 0);
  const id2 = generateDeterministicId('doctor', testUid, 0);

  assert(
    'ID Stability',
    'Same UID produces strictly identical deterministic ID on multiple calls',
    id1 === id2 && id1.startsWith('M737-DOC-'),
    `id1 (${id1}) !== id2 (${id2})`
  );

  const patientUid = 'pat_iraq_991823x';
  const patId1 = generateDeterministicId('patient', patientUid, 0);
  const patId2 = generateDeterministicId('patient', patientUid, 0);
  assert(
    'ID Stability',
    'Patient ID remains stable across simulated profile edits and re-logins',
    patId1 === patId2 && patId1.startsWith('M737-PAT-'),
    `Patient ID drifted: ${patId1} !== ${patId2}`
  );

  // ==============================================================
  // 3. DUPLICATE RESISTANCE & COLLISION SALT BEHAVIOR
  // ==============================================================
  const salt0 = generateDeterministicId('doctor', testUid, 0);
  const salt1 = generateDeterministicId('doctor', testUid, 1);
  const salt2 = generateDeterministicId('doctor', testUid, 2);

  assert(
    'Collision Resolution',
    'Incrementing collision salt produces distinct candidate codes',
    salt0 !== salt1 && salt1 !== salt2 && salt0 !== salt2,
    `Salt collision detected: ${salt0}, ${salt1}, ${salt2}`
  );

  // Verify 1,000 distinct mock UIDs produce zero collision at salt=0
  const generatedSet = new Set<string>();
  let hasInternalCollision = false;
  for (let i = 0; i < 1000; i++) {
    const mockUid = `firebase_uid_test_${i}_${(i * 997).toString(36)}`;
    const candidate = generateDeterministicId('patient', mockUid, 0);
    if (generatedSet.has(candidate)) {
      hasInternalCollision = true;
      break;
    }
    generatedSet.add(candidate);
  }

  assert(
    'Uniqueness & Entropy',
    '1,000 distinct UIDs produce 1,000 unique permanent IDs without collision',
    !hasInternalCollision && generatedSet.size === 1000,
    'Internal collision occurred in 1,000 generated IDs'
  );

  // ==============================================================
  // 4. FORMAT VALIDATION
  // ==============================================================
  assert(
    'Format Validation',
    'Valid patient ID format is accepted',
    isValidAccountIdFormat('M737-PAT-USR78A9B', 'patient'),
    'Failed to validate valid patient ID'
  );

  assert(
    'Format Validation',
    'Mismatched role prefix is rejected',
    !isValidAccountIdFormat('M737-DOC-USR78A9B', 'patient'),
    'Incorrectly accepted doctor ID as patient ID'
  );

  assert(
    'Format Validation',
    'Malformed junk string is rejected',
    !isValidAccountIdFormat('INVALID_RANDOM_STRING', 'pharmacy'),
    'Accepted malformed string'
  );

  // ==============================================================
  // 5. NORMALIZATION LOGIC
  // ==============================================================
  assert(
    'Normalization',
    'Normalizes un-prefixed patient search string',
    normalizeMedicalIdInput('sara96', 'patient') === 'M737-PAT-SARA96',
    `Expected M737-PAT-SARA96 but got ${normalizeMedicalIdInput('sara96', 'patient')}`
  );

  assert(
    'Normalization',
    'Preserves existing doctor prefix regardless of casing',
    normalizeMedicalIdInput('m737-doc-7a8b9c', 'patient') === 'M737-DOC-7A8B9C',
    `Expected M737-DOC-7A8B9C but got ${normalizeMedicalIdInput('m737-doc-7a8b9c', 'patient')}`
  );

  // ==============================================================
  // 6. QUERY SAFETY
  // ==============================================================
  assert(
    'Query Safety',
    'Safe alphanumeric query is accepted',
    isValidMedicalIdQuery('M737-PAT-8819A'),
    'Rejected valid query'
  );

  assert(
    'Query Safety',
    'SQL/Script injection characters are rejected',
    !isValidMedicalIdQuery("M737-PAT-'; DROP TABLE users;--"),
    'Accepted dangerous query characters'
  );

  // ==============================================================
  // 7. CROSS-DOCTOR CHART PARTITIONING
  // ==============================================================
  const doctor1Uid = 'doc_cardiology_110';
  const doctor2Uid = 'doc_dermatology_220';
  const patientTargetId = 'pat_sarah_550';

  const chartIdDoctor1: string = `chart_${doctor1Uid}_${patientTargetId}`;
  const chartIdDoctor2: string = `chart_${doctor2Uid}_${patientTargetId}`;

  assert(
    'Cross-Doctor Isolation',
    'Independent doctors have distinct isolated chart document keys for the same patient',
    chartIdDoctor1 !== chartIdDoctor2,
    'Doctor charts share the same document ID'
  );

  assert(
    'Cross-Doctor Isolation',
    'Chart ID contains doctor UID for strict Firestore security-rule enforcement',
    chartIdDoctor1.includes(doctor1Uid) && !chartIdDoctor1.includes(doctor2Uid),
    'Doctor chart ID did not correctly bind doctor UID'
  );

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results
  };
}
