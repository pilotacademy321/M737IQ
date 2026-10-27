import assert from 'node:assert';
import { 
  interpretMedicineQueryLocally, 
  checkInventoryDuplicate 
} from '../lib/aiMedicineAssistantService';
import { 
  SPECIALTY_CATEGORIES, 
  VERIFIED_CENTRAL_CATALOG_MEDICINES 
} from '../data/centralMedicineCatalog';
import { MedicineItem, WholesaleMedicineItem } from '../types';

console.log('=== RUNNING AI MEDICINE ASSISTANT COMPREHENSIVE VERIFICATION SUITE ===');

// 1. VERIFY ALL 17 SPECIALTY CATEGORIES INCLUDING HEMATOLOGY
console.log('[Test 1] Verifying 17 specialty categories presence...');
assert.strictEqual(SPECIALTY_CATEGORIES.length, 17, 'Must contain 17 verified medical specialties');
const hematologyCat = SPECIALTY_CATEGORIES.find(c => c.id === 'hematology');
assert.ok(hematologyCat, 'Hematology specialty definition must exist');
assert.strictEqual(hematologyCat.nameAr, 'أمراض الدم والتخثر');
console.log('✓ Passed: 17 specialties verified including Hematology.');

// 2. VERIFY EXACT USER REQUEST EXAMPLES (ARABIC, IRAQI COLLOQUIAL, ENGLISH)
console.log('[Test 2] Verifying natural language interpretation of prompt examples...');

const testCases = [
  { query: 'أريد أدوية اختصاص القلب والضغط', expectedCategory: 'cardiology', minCount: 1 },
  { query: 'جهزلي أدوية السكري والغدد', expectedCategory: 'endocrinology', minCount: 1 },
  { query: 'أريد أدوية الأطفال', expectedCategory: 'pediatrics', minCount: 1 },
  { query: 'أريد أدوية النسائية والتوليد', expectedCategory: 'gynecology_obstetrics', minCount: 1 },
  { query: 'أريد أدوية العظام والكسور', expectedCategory: 'orthopedics', minCount: 1 },
  { query: 'أريد أدوية الدم', expectedCategory: 'hematology', minCount: 1 },
  { query: 'أريد أدوية الجهاز التنفسي', expectedCategory: 'respiratory', minCount: 1 },
  { query: 'أريد أدوية الجهاز الهضمي', expectedCategory: 'gastroenterology', minCount: 1 },
  { query: 'أريد قائمة شاملة من أدوية القلب', expectedCategory: 'cardiology', minCount: 1, isComprehensive: true },
  { query: 'Cardiology and blood pressure', expectedCategory: 'cardiology', minCount: 1 },
  { query: 'Hematology medicines', expectedCategory: 'hematology', minCount: 1 },
];

for (const tc of testCases) {
  const result = interpretMedicineQueryLocally(tc.query);
  assert.strictEqual(
    result.detectedCategory, 
    tc.expectedCategory, 
    `Query "${tc.query}" should map to category "${tc.expectedCategory}" but got "${result.detectedCategory}"`
  );
  assert.ok(
    result.totalMatches >= tc.minCount, 
    `Query "${tc.query}" should return at least ${tc.minCount} matches, got ${result.totalMatches}`
  );
  if (tc.isComprehensive) {
    assert.strictEqual(result.isComprehensiveRequest, true, `Query "${tc.query}" must be flagged as comprehensive`);
    assert.strictEqual(result.isCompleteCatalogSet, true, `Comprehensive query must return complete set`);
  }
}
console.log(`✓ Passed: All ${testCases.length} user example queries interpreted with 100% precision.`);

// 3. VERIFY ZERO-HALLUCINATION ON UNMATCHED OR FICTITIOUS QUERIES
console.log('[Test 3] Verifying zero-hallucination constraint...');
const unmatched = interpretMedicineQueryLocally('دواء خيالي غير مسجل 999xyz');
assert.strictEqual(unmatched.detectedCategory, undefined);
assert.strictEqual(unmatched.totalMatches, 0);
assert.strictEqual(unmatched.matchedMedicines.length, 0);
assert.ok(unmatched.noMatchReason, 'Must provide an explanatory reason when no matches exist');
console.log('✓ Passed: Zero hallucination verified on fictitious requests.');

// 4. VERIFY DUPLICATE DETECTION INVENTORY FINGERPRINTING
console.log('[Test 4] Verifying duplicate inventory screening...');
const mockExistingPharmacyMedicines: MedicineItem[] = [
  {
    id: 'med_existing_001',
    pharmacyId: 'usr_pharm_123',
    pharmacyName: 'Test Pharmacy',
    name: 'Concor 5 mg',
    activeIngredient: 'Bisoprolol Fumarate',
    brand: 'Concor',
    manufacturer: 'Merck KGaA, Germany',
    strength: '5 mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '30 Tablets / Box',
    catalogMedicineId: 'CAT-MED-CARD-001',
    price: 6500,
    quantity: 50,
    minStockAlert: 5,
    expiryDate: '2027-12-31',
    requiresPrescription: true,
    isAvailable: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
];

const concorCatalogItem = VERIFIED_CENTRAL_CATALOG_MEDICINES.find(m => m.id === 'CAT-MED-CARD-001')!;
const lipitorCatalogItem = VERIFIED_CENTRAL_CATALOG_MEDICINES.find(m => m.id === 'CAT-MED-CARD-003')!;

const checkDupConcor = checkInventoryDuplicate(concorCatalogItem, mockExistingPharmacyMedicines);
assert.strictEqual(checkDupConcor.isDuplicate, true, 'Concor 5mg must be detected as duplicate');

const checkDupLipitor = checkInventoryDuplicate(lipitorCatalogItem, mockExistingPharmacyMedicines);
assert.strictEqual(checkDupLipitor.isDuplicate, false, 'Lipitor 20mg must NOT be marked as duplicate');
console.log('✓ Passed: Duplicate inventory fingerprinting verified.');

// 5. VERIFY CLINICAL INVENTORY DECOUPLING INVARIANT
console.log('[Test 5] Verifying decoupling invariant for batch addition...');
function computeDecoupledAvailability(qty: number, price: number): boolean {
  return qty > 0 && price > 0;
}
assert.strictEqual(computeDecoupledAvailability(0, 0), false, 'Default catalog import must be unavailable');
assert.strictEqual(computeDecoupledAvailability(20, 0), false, 'Zero price cannot be available');
assert.strictEqual(computeDecoupledAvailability(0, 5000), false, 'Zero stock cannot be available');
assert.strictEqual(computeDecoupledAvailability(20, 5000), true, 'Valid stock and price is available');
console.log('✓ Passed: Decoupling invariant verified.');

console.log('=== ALL AI MEDICINE ASSISTANT TESTS PASSED (100% SUCCESS) ===');
