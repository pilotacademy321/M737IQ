import assert from 'node:assert';
import { 
  SPECIALTY_CATEGORIES, 
  VERIFIED_CENTRAL_CATALOG_MEDICINES 
} from '../data/centralMedicineCatalog';
import { 
  analyzeMedicineEquivalence, 
  isSameActiveGeneric, 
  isDocumentedBioequivalent 
} from '../lib/medicineEquivalenceEngine';
import { CatalogMedicineItem } from '../types';

console.log('========================================================');
console.log('M737IQ — Global Medicine Catalog Clinical Audit Test Suite');
console.log('========================================================');

// Test 1: Completeness of Catalog
assert.strictEqual(VERIFIED_CENTRAL_CATALOG_MEDICINES.length, 79, 'Expected exactly 79 audited catalog records');
assert.strictEqual(SPECIALTY_CATEGORIES.length, 17, 'Expected 17 medical specialties');

// Test 2: Verification Status Accounting
let verifiedCount = 0;
let correctedCount = 0;
let needsReviewCount = 0;

for (const item of VERIFIED_CENTRAL_CATALOG_MEDICINES) {
  assert.ok(item.verificationStatus, `Missing verificationStatus on ${item.id}`);
  if (item.verificationStatus === 'verified') verifiedCount++;
  else if (item.verificationStatus === 'corrected') correctedCount++;
  else if (item.verificationStatus === 'needs_review') needsReviewCount++;

  // Test 3: Standard Clinical Identifiers
  assert.ok(item.inn && item.inn.trim().length > 0, `Missing WHO INN on ${item.id}`);
  assert.ok(item.atcCode && item.atcCode.trim().length > 0, `Missing WHO ATC Code on ${item.id}`);
  assert.ok(item.routeOfAdministration && item.routeOfAdministration.trim().length > 0, `Missing route of administration on ${item.id}`);
  assert.ok(item.releaseMechanism, `Missing release mechanism on ${item.id}`);
  assert.ok(item.verifiedFields && item.verifiedFields.length >= 4, `Insufficient verified fields array on ${item.id}`);
  assert.ok(item.evidenceMetadata && item.evidenceMetadata.length > 0, `Missing regulatory evidence metadata on ${item.id}`);

  // Test 4: Evidence citations integrity
  for (const ev of item.evidenceMetadata) {
    assert.ok(ev.sourceName, `Missing sourceName in evidence for ${item.id}`);
    assert.ok(ev.sourceUrl && ev.sourceUrl.startsWith('http'), `Invalid sourceUrl in evidence for ${item.id}`);
    assert.ok(ev.checkedDate, `Missing checkedDate in evidence for ${item.id}`);
  }

  // Test 5: Correction history integrity
  if (item.verificationStatus === 'corrected') {
    assert.ok(item.changeHistory && item.changeHistory.length > 0, `Corrected item ${item.id} must have changeHistory`);
    for (const ch of item.changeHistory) {
      assert.ok(ch.field, `Missing field in changeHistory for ${item.id}`);
      assert.ok(ch.previousValue !== undefined, `Missing previousValue in changeHistory for ${item.id}`);
      assert.ok(ch.correctedValue !== undefined, `Missing correctedValue in changeHistory for ${item.id}`);
      assert.ok(ch.reason && ch.reason.length > 10, `Missing detailed reason in changeHistory for ${item.id}`);
      assert.ok(ch.correctedAt, `Missing timestamp in changeHistory for ${item.id}`);
    }
  }
}

assert.strictEqual(verifiedCount, 55, 'Expected 55 verified medicines');
assert.strictEqual(correctedCount, 22, 'Expected 22 corrected medicines');
assert.strictEqual(needsReviewCount, 2, 'Expected 2 medicines requiring clinical review');
console.log(`[PASS] Verification breakdown: ${verifiedCount} Verified, ${correctedCount} Corrected, ${needsReviewCount} Needs Review, 0 Fabricated/Unverified.`);

// Test 6: Items Requiring Clinical Review
const rowatinex = VERIFIED_CENTRAL_CATALOG_MEDICINES.find(m => m.id === 'CAT-MED-UROL-002');
assert.ok(rowatinex, 'Rowatinex record not found');
assert.strictEqual(rowatinex.needsManualReview, true, 'Rowatinex must have needsManualReview set to true');
assert.ok(rowatinex.reviewReason?.includes('Cochrane') || rowatinex.reviewReason?.includes('terpene'), 'Rowatinex reviewReason must cite clinical evidence');

const deanxit = VERIFIED_CENTRAL_CATALOG_MEDICINES.find(m => m.id === 'CAT-MED-PSYC-002');
assert.ok(deanxit, 'Deanxit record not found');
assert.strictEqual(deanxit.needsManualReview, true, 'Deanxit must have needsManualReview set to true');
assert.ok(deanxit.reviewReason?.includes('FDA') || deanxit.reviewReason?.includes('antipsychotic'), 'Deanxit reviewReason must cite regulatory discrepancy');
console.log('[PASS] Flagged items requiring review correctly carry needsManualReview and regulatory evidence.');

// Test 7: Equivalence Engine — Route of Administration & Release Mechanism Invariant
// When comparing an oral medicine with an inhalation formulation of the same active, it must NEVER be returned as Tier 2 direct equivalent
const mockOralSalbutamol: CatalogMedicineItem = {
  id: 'MOCK-ORAL-SALB',
  nameEn: 'Salbutamol Oral Syrup 2mg/5ml',
  nameAr: 'سالبيوتامول شراب فموي',
  activeIngredient: 'Salbutamol',
  inn: 'Salbutamol',
  atcCode: 'R03CC02',
  routeOfAdministration: 'Oral',
  releaseMechanism: 'standard',
  brand: 'Salbutamol Syrup',
  strength: '2 mg / 5 ml',
  dosageForm: 'Syrup',
  packageSize: '100 ml',
  manufacturer: 'Generic Pharma',
  categories: ['respiratory'],
  requiresPrescription: true,
  sourceAuthority: 'Audit Test Mock',
  isVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const equivalenceOralVsInhalation = analyzeMedicineEquivalence('Salbutamol', undefined, [
  mockOralSalbutamol,
  ...VERIFIED_CENTRAL_CATALOG_MEDICINES
]);

// Tier 1 will be the anchor; any other Salbutamol with differing route (Inhalation vs Oral) must be Tier 3 (alternative), not Tier 2
for (const match of equivalenceOralVsInhalation.tier2SameActiveSubstitutes) {
  if (equivalenceOralVsInhalation.tier1ExactMatches.length > 0) {
    const anchor = equivalenceOralVsInhalation.tier1ExactMatches[0].medicine;
    if (anchor.routeOfAdministration && match.medicine.routeOfAdministration) {
      assert.strictEqual(
        anchor.routeOfAdministration.toLowerCase(), 
        match.medicine.routeOfAdministration.toLowerCase(),
        'Tier 2 substitute MUST share identical route of administration'
      );
    }
  }
}
console.log('[PASS] Equivalence engine strictly isolates differing routes of administration.');

// Test 8: Blocked Medicines Suppression
const mockBlockedMed: CatalogMedicineItem = {
  id: 'MOCK-BLOCKED-001',
  nameEn: 'Suspended Unverified Drug',
  nameAr: 'دواء معلق غير موثق',
  activeIngredient: 'Bisoprolol Fumarate',
  brand: 'BisoFake',
  strength: '5 mg',
  dosageForm: 'Tablets',
  packageSize: '30 Tablets',
  manufacturer: 'Unknown Lab',
  categories: ['cardiology'],
  requiresPrescription: true,
  sourceAuthority: 'Unverified',
  isVerified: false,
  isBlockedFromSearch: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const bisoprololAnalysis = analyzeMedicineEquivalence('Concor 5 mg', undefined, [
  mockBlockedMed,
  ...VERIFIED_CENTRAL_CATALOG_MEDICINES
]);

const hasBlockedInResults = [
  ...bisoprololAnalysis.tier1ExactMatches,
  ...bisoprololAnalysis.tier2SameActiveSubstitutes,
  ...bisoprololAnalysis.tier3BioequivalentSubstitutes
].some(m => m.medicine.id === 'MOCK-BLOCKED-001');

assert.strictEqual(hasBlockedInResults, false, 'Blocked medicines must NEVER appear in equivalence matches');
console.log('[PASS] Blocked / unverified medicines are completely suppressed from clinical dispensing results.');

// Test 9: Tenancy Isolation
// Verifies that a catalog item structure is distinct from private inventory records (MedicineItem)
const sampleCatalogItem = VERIFIED_CENTRAL_CATALOG_MEDICINES[0];
assert.strictEqual('pharmacyId' in sampleCatalogItem, false, 'Catalog reference must NOT have pharmacyId');
assert.strictEqual('wholesalerId' in sampleCatalogItem, false, 'Catalog reference must NOT have wholesalerId');
assert.strictEqual('stockCount' in sampleCatalogItem, false, 'Catalog reference must NOT store private tenant stock');
assert.strictEqual('priceIqd' in sampleCatalogItem, false, 'Catalog reference must NOT store private retail prices');
console.log('[PASS] Central reference catalog strictly decoupled from tenant inventories.');

console.log('========================================================');
console.log('ALL 9 CLINICAL AUDIT TEST CATEGORIES PASSED WITH 100% SUCCESS');
console.log('========================================================');
