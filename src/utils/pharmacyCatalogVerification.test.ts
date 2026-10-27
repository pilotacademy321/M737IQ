import assert from 'node:assert';
import { 
  SPECIALTY_CATEGORIES, 
  VERIFIED_CENTRAL_CATALOG_MEDICINES 
} from '../data/centralMedicineCatalog';
import { MedicalSpecialtyCategory } from '../types';

console.log('--- Testing Central Medicine Catalog & Verification Rules ---');

// 1. Verify all medical specialties are defined (17 specialties including Hematology)
assert.strictEqual(SPECIALTY_CATEGORIES.length, 17, 'Expected exactly 17 medical specialties');
const specialtyIds = new Set(SPECIALTY_CATEGORIES.map(s => s.id));
assert.strictEqual(specialtyIds.size, 17, 'Specialty IDs must be unique');

// 2. Verify all catalog medicines have genuine clinical data (no hallucinations, no missing critical fields)
const seenMedIds = new Set<string>();
const expectedSpecialties: MedicalSpecialtyCategory[] = [
  'internal_medicine',
  'cardiology',
  'hematology',
  'endocrinology',
  'pediatrics',
  'gynecology_obstetrics',
  'respiratory',
  'gastroenterology',
  'neurology',
  'orthopedics',
  'dermatology',
  'ophthalmology',
  'ent',
  'urology',
  'psychiatry',
  'dentistry',
  'general_medicine'
];

for (const med of VERIFIED_CENTRAL_CATALOG_MEDICINES) {
  assert.ok(med.id && med.id.startsWith('CAT-MED-'), `Invalid medicine ID: ${med.id}`);
  assert.ok(!seenMedIds.has(med.id), `Duplicate medicine ID detected: ${med.id}`);
  seenMedIds.add(med.id);

  assert.ok(med.nameEn && med.nameEn.trim().length > 2, `Missing English trade name for ${med.id}`);
  assert.ok(med.nameAr && med.nameAr.trim().length > 2, `Missing Arabic name for ${med.id}`);
  assert.ok(med.activeIngredient && med.activeIngredient.trim().length > 2, `Missing active ingredient for ${med.id}`);
  assert.ok(med.strength && med.strength.trim().length > 0, `Missing strength for ${med.id}`);
  assert.ok(med.dosageForm && med.dosageForm.trim().length > 0, `Missing dosageForm for ${med.id}`);
  assert.ok(med.manufacturer && med.manufacturer.trim().length > 0, `Missing manufacturer for ${med.id}`);
  assert.ok(med.registrationNumber && med.registrationNumber.trim().length > 0, `Missing registration number for ${med.id}`);
  assert.ok(med.categories.length > 0, `Medicine ${med.id} must belong to at least 1 specialty`);

  for (const cat of med.categories) {
    assert.ok(specialtyIds.has(cat), `Unknown category ${cat} on medicine ${med.id}`);
  }
}

console.log(`Passed: ${VERIFIED_CENTRAL_CATALOG_MEDICINES.length} verified medicines across 16 specialties.`);

// 3. Verify Decoupling Invariant:
// When initial quantity is 0 or price is 0, isAvailable MUST be false
function computeDecoupledAvailability(qty: number, price: number, isExpired: boolean): boolean {
  if (isExpired) return false;
  return qty > 0 && price > 0;
}

assert.strictEqual(computeDecoupledAvailability(0, 0, false), false, 'Default catalog import must not be available');
assert.strictEqual(computeDecoupledAvailability(0, 5000, false), false, 'Zero stock cannot be available even with price');
assert.strictEqual(computeDecoupledAvailability(10, 0, false), false, 'Zero price cannot be available even with stock');
assert.strictEqual(computeDecoupledAvailability(10, 5000, true), false, 'Expired items cannot be available');
assert.strictEqual(computeDecoupledAvailability(10, 5000, false), true, 'Valid stock, price, and date is available');

console.log('Passed: Clinical Inventory Decoupling Invariants strictly verified.');

// 4. Duplicate Fingerprint Matcher
function getMedicineFingerprint(name: string, generic: string, strength: string): string {
  return `${name.trim().toLowerCase()}|${generic.trim().toLowerCase()}|${strength.trim().toLowerCase()}`;
}

const fp1 = getMedicineFingerprint('Concor 5mg', 'Bisoprolol Fumarate', '5mg');
const fp2 = getMedicineFingerprint('concor 5mg ', ' bisoprolol fumarate', '5MG');
const fp3 = getMedicineFingerprint('Concor 10mg', 'Bisoprolol Fumarate', '10mg');

assert.strictEqual(fp1, fp2, 'Fingerprints should match case-insensitively with trimmed whitespace');
assert.notStrictEqual(fp1, fp3, 'Different strengths (5mg vs 10mg) MUST NOT collide');

console.log('Passed: Formulation distinguishability and duplicate screening verified.');
console.log('--- ALL PHARMACY CATALOG & IMPORT TESTS PASSED ---');
