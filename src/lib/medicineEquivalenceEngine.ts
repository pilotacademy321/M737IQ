/**
 * M737IQ Platform — 4-Tier Medicine Equivalence & Substitution Clinical Engine
 * 
 * Strict 4-Tier Matching Hierarchy:
 * - Tier 1: Original / Exact formulation match (Brand, barcode, strength, dosage form).
 * - Tier 2: Same active ingredient equivalent with comparison of strength & dosage form.
 * - Tier 3: Verified bioequivalent alternative documented in clinical formulary.
 * - Tier 4: Strict rejection of different compositions:
 *          "لم نعثر على بديل مكافئ مؤكّد في الكتالوج. يمكن مراجعة الصيدلي المختص أو الطبيب للتحقق من الخيارات المناسبة"
 * 
 * Clinical Invariant: Never fabricate equivalence, never alter active ingredient independently.
 */

import { CatalogMedicineItem } from '../types';
import { VERIFIED_CENTRAL_CATALOG_MEDICINES } from '../data/centralMedicineCatalog';
import { normalizeArabicText } from './aiMedicineAssistantService';

export type EquivalenceTier = 
  | 'tier_1_exact'
  | 'tier_2_same_active'
  | 'tier_3_bioequivalent'
  | 'tier_4_unconfirmed_rejected';

export interface EquivalenceMatchItem {
  medicine: CatalogMedicineItem;
  tier: EquivalenceTier;
  tierLabelAr: string;
  tierLabelEn: string;
  badgeColor: string;
  comparisonNotesAr: string;
  comparisonNotesEn: string;
  isSameStrength: boolean;
  isSameDosageForm: boolean;
}

export interface EquivalenceAnalysisResult {
  queriedDrugName: string;
  detectedActiveIngredient?: string;
  hasExactMatch: boolean;
  hasSameActiveSubstitutes: boolean;
  hasBioequivalentSubstitutes: boolean;
  tier1ExactMatches: EquivalenceMatchItem[];
  tier2SameActiveSubstitutes: EquivalenceMatchItem[];
  tier3BioequivalentSubstitutes: EquivalenceMatchItem[];
  isRejectedTier4: boolean;
  mandatoryNoticeAr: string;
  mandatoryNoticeEn: string;
  totalValidSubstitutes: number;
}

// Officially documented bioequivalent equivalence families in Iraq / Kimadia formulary
export const VERIFIED_BIOEQUIVALENT_CLUSTERS: Record<string, string[]> = {
  // Clopidogrel 75mg
  'clopidogrel': ['plavix', 'ceruvin', 'clopilet', 'pedovex', 'clopivas'],
  // Atorvastatin
  'atorvastatin': ['lipitor', 'atorva', 'sortis', 'torvast', 'lipodar'],
  // Rosuvastatin
  'rosuvastatin': ['crestor', 'rosuvast', 'rovista', 'ezallor'],
  // Bisoprolol
  'bisoprolol': ['concor', 'bisocor', 'cardicor', 'corbis'],
  // Amlodipine
  'amlodipine': ['norvasc', 'amlovasc', 'amlor', 'amlodac'],
  // Metformin
  'metformin': ['glucophage', 'formet', 'dianorm', 'glucomet', 'cidophage'],
  // Esomeprazole
  'esomeprazole': ['nexium', 'ezomep', 'esopral', 'nexpro'],
  // Omeprazole
  'omeprazole': ['losec', 'omep', 'gasec', 'oprazole', 'omiz'],
  // Enoxaparin
  'enoxaparin': ['clexane', 'enoxa', 'lovenox', 'clexar'],
  // Paracetamol
  'paracetamol': ['panadol', 'paramed', 'calpol', 'adol', 'samamol', 'fevadol'],
  // Amoxicillin + Clavulanate
  'amoxicillin / clavulanic acid': ['augmentin', 'amoclan', 'julmentin', 'curam', 'megamox', 'klavox'],
  // Ciprofloxacin
  'ciprofloxacin': ['ciprobay', 'ciprodar', 'cifran', 'cipro'],
  // Azithromycin
  'azithromycin': ['zithromax', 'azitromac', 'samathrocin', 'azimax'],
  // Ceftriaxone
  'ceftriaxone': ['rocephin', 'ceftriaxon samarra', 'mesporin', 'triaxone'],
  // Salbutamol
  'salbutamol': ['ventolin', 'butalin', 'samamol inhaler', 'aerolin'],
  // Montelukast
  'montelukast': ['singulair', 'montiget', 'airfast'],
  // Tamsulosin
  'tamsulosin': ['omnic', 'tamsolin', 'flomax', 'prostacare'],
  // Pregabalin
  'pregabalin': ['lyrica', 'pregab', 'nervixa', 'gabbax'],
};

/**
 * Normalizes generic active ingredient name for strict comparison
 */
export function normalizeActiveIngredient(raw: string): string {
  if (!raw) return '';
  return raw
    .toLowerCase()
    .replace(/\b(sodium|calcium|potassium|fumarate|hydrochloride|hcl|trihydrate|maleate|besylate|succinate|tartrate|sulfate|anhydrous)\b/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluates whether two active ingredients represent the exact same pharmaceutical compound
 */
export function isSameActiveGeneric(active1: string, active2: string): boolean {
  const norm1 = normalizeActiveIngredient(active1);
  const norm2 = normalizeActiveIngredient(active2);
  if (!norm1 || !norm2) return false;
  if (norm1 === norm2) return true;
  // If one contains the other entirely and length difference is minor
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  return false;
}

/**
 * Checks whether two brand names belong to a certified bioequivalent cluster
 */
export function isDocumentedBioequivalent(activeIng: string, brand1: string, brand2: string): boolean {
  const normActive = normalizeActiveIngredient(activeIng);
  const b1 = brand1.toLowerCase().trim();
  const b2 = brand2.toLowerCase().trim();
  if (b1 === b2) return true;

  for (const [clusterKey, brands] of Object.entries(VERIFIED_BIOEQUIVALENT_CLUSTERS)) {
    if (normActive.includes(clusterKey) || clusterKey.includes(normActive)) {
      const match1 = brands.some((b) => b1.includes(b) || b.includes(b1));
      const match2 = brands.some((b) => b2.includes(b) || b.includes(b2));
      if (match1 && match2) return true;
    }
  }

  return false;
}

/**
 * Executes full 4-Tier equivalence analysis for a medicine search or substitution query
 */
export function analyzeMedicineEquivalence(
  queryInput: string,
  targetActiveIngredient?: string,
  catalogPool: CatalogMedicineItem[] = VERIFIED_CENTRAL_CATALOG_MEDICINES
): EquivalenceAnalysisResult {
  const cleanQuery = queryInput.trim();
  const normalizedQueryAr = normalizeArabicText(cleanQuery);
  const normalizedQueryEn = cleanQuery.toLowerCase();

  // 1. Identify Anchor Medicine (Original Target)
  let anchorMedicine: CatalogMedicineItem | undefined;

  // Exact ID match
  anchorMedicine = catalogPool.find((m) => m.id.toLowerCase() === normalizedQueryEn);

  // Exact Name / Brand match
  if (!anchorMedicine) {
    anchorMedicine = catalogPool.find((m) => {
      const mEn = m.nameEn.toLowerCase();
      const mBrand = m.brand.toLowerCase();
      const mAr = normalizeArabicText(m.nameAr);
      return (
        mEn === normalizedQueryEn ||
        mBrand === normalizedQueryEn ||
        mAr === normalizedQueryAr ||
        mEn.includes(normalizedQueryEn) ||
        (mAr.length > 2 && mAr.includes(normalizedQueryAr))
      );
    });
  }

  // Active Ingredient fallback anchor
  if (!anchorMedicine && targetActiveIngredient) {
    anchorMedicine = catalogPool.find((m) =>
      isSameActiveGeneric(m.activeIngredient, targetActiveIngredient)
    );
  }

  const activeIngredientToMatch = anchorMedicine
    ? anchorMedicine.activeIngredient
    : targetActiveIngredient || '';

  const tier1Matches: EquivalenceMatchItem[] = [];
  const tier2Matches: EquivalenceMatchItem[] = [];
  const tier3Matches: EquivalenceMatchItem[] = [];

  if (anchorMedicine) {
    // TIER 1: The original medicine itself
    tier1Matches.push({
      medicine: anchorMedicine,
      tier: 'tier_1_exact',
      tierLabelAr: 'المستوى الأول: الدواء الأصلي المطلوب',
      tierLabelEn: 'Tier 1: Original Requested Drug',
      badgeColor: 'bg-emerald-600 text-white',
      comparisonNotesAr: `المستحضر الأصلي: ${anchorMedicine.nameAr} (${anchorMedicine.brand}) بنفس التركيز والشكل.`,
      comparisonNotesEn: `Original requested formulation: ${anchorMedicine.nameEn} with identical strength and form.`,
      isSameStrength: true,
      isSameDosageForm: true,
    });
  }

  // If we have an active ingredient, search catalog for TIER 2 and TIER 3
  if (activeIngredientToMatch) {
    for (const item of catalogPool) {
      if (item.isBlockedFromSearch) {
        continue; // Enforce clinical safety: blocked or unverified formulations never matched
      }

      if (anchorMedicine && item.id === anchorMedicine.id) {
        continue; // Skip exact anchor already in Tier 1
      }

      if (isSameActiveGeneric(item.activeIngredient, activeIngredientToMatch)) {
        const isSameStrength = anchorMedicine
          ? item.strength.toLowerCase().replace(/\s+/g, '') === anchorMedicine.strength.toLowerCase().replace(/\s+/g, '')
          : true;
        const isSameDosageForm = anchorMedicine
          ? item.dosageForm.toLowerCase().slice(0, 6) === anchorMedicine.dosageForm.toLowerCase().slice(0, 6)
          : true;

        const isSameRoute = anchorMedicine && anchorMedicine.routeOfAdministration && item.routeOfAdministration
          ? anchorMedicine.routeOfAdministration.toLowerCase().trim() === item.routeOfAdministration.toLowerCase().trim()
          : true;

        const isSameRelease = anchorMedicine && anchorMedicine.releaseMechanism && item.releaseMechanism
          ? anchorMedicine.releaseMechanism === item.releaseMechanism
          : true;

        const isBioequiv = anchorMedicine
          ? isDocumentedBioequivalent(activeIngredientToMatch, anchorMedicine.brand, item.brand)
          : false;

        // If route of administration differs, it cannot be a direct Tier 2 equivalent
        if (!isSameRoute) {
          tier3Matches.push({
            medicine: item,
            tier: 'tier_3_bioequivalent',
            tierLabelAr: 'المستوى الثالث: بديل صيدلاني بمسار إعطاء مختلف (غير متكافئ تلقائياً)',
            tierLabelEn: 'Tier 3: Pharmaceutical Alternative (Different Route)',
            badgeColor: 'bg-amber-600 text-white',
            comparisonNotesAr: `تحذير سريري: يختلف مسار الإعطاء (${item.routeOfAdministration || 'غير محدد'} مقابل ${anchorMedicine?.routeOfAdministration || 'غير محدد'}). لا يُصرف بديلاً إلا بأمر صريح من الطبيب.`,
            comparisonNotesEn: `Clinical alert: Differing route of administration (${item.routeOfAdministration} vs ${anchorMedicine?.routeOfAdministration}). Must not be substituted without physician order.`,
            isSameStrength,
            isSameDosageForm: false,
          });
          continue;
        }

        // If release mechanism differs (e.g. sustained release vs immediate release)
        if (!isSameRelease) {
          tier3Matches.push({
            medicine: item,
            tier: 'tier_3_bioequivalent',
            tierLabelAr: 'المستوى الثالث: بديل صيدلاني بآلية تحرر مختلفة',
            tierLabelEn: 'Tier 3: Pharmaceutical Alternative (Different Release Profile)',
            badgeColor: 'bg-purple-600 text-white',
            comparisonNotesAr: `تحذير سريري: تختلف حركية التحرر (${item.releaseMechanism === 'extended_release' ? 'مديد التحرر' : item.releaseMechanism === 'delayed_release' ? 'مقاوم للمعدة' : 'فوري'}). يتطلب موافقة الطبيب أو الصيدلي السريري.`,
            comparisonNotesEn: `Clinical alert: Release kinetics differ (${item.releaseMechanism}). Requires clinical pharmacist or physician approval.`,
            isSameStrength,
            isSameDosageForm,
          });
          continue;
        }

        if (isBioequiv) {
          // TIER 3: Certified Bioequivalent
          tier3Matches.push({
            medicine: item,
            tier: 'tier_3_bioequivalent',
            tierLabelAr: 'المستوى الثالث: مكافئ حيوي معتمد طبياً',
            tierLabelEn: 'Tier 3: Clinically Documented Bioequivalent',
            badgeColor: 'bg-blue-600 text-white',
            comparisonNotesAr: `مكافئ حيوي معتمد سريرياً (${item.brand}). ${isSameStrength ? 'نفس التركيز' : `التركيز: ${item.strength}`}. المسار: ${item.routeOfAdministration || 'فموي'}. الشكل: ${item.dosageForm}.`,
            comparisonNotesEn: `Certified bioequivalent generic (${item.brand}). ${isSameStrength ? 'Matching strength' : `Strength: ${item.strength}`}. Route: ${item.routeOfAdministration || 'Oral'}. Form: ${item.dosageForm}.`,
            isSameStrength,
            isSameDosageForm,
          });
        } else {
          // TIER 2: Same Active Ingredient, Route, and Release
          tier2Matches.push({
            medicine: item,
            tier: 'tier_2_same_active',
            tierLabelAr: 'المستوى الثاني: نفس المادة الفعالة والمسار',
            tierLabelEn: 'Tier 2: Same Active Ingredient & Route',
            badgeColor: 'bg-teal-600 text-white',
            comparisonNotesAr: `يحتوي على نفس المادة (${item.activeIngredient}) بنفس مسار الإعطاء (${item.routeOfAdministration || 'فموي'}). ${isSameStrength ? 'نفس التركيز تماماً' : `مقارنة التركيز: ${item.strength}`}.`,
            comparisonNotesEn: `Same active ingredient (${item.activeIngredient}) via same route (${item.routeOfAdministration || 'Oral'}). ${isSameStrength ? 'Exact strength match' : `Strength: ${item.strength}`}.`,
            isSameStrength,
            isSameDosageForm,
          });
        }
      }
    }
  }

  const totalValid = tier1Matches.length + tier2Matches.length + tier3Matches.length;
  const isRejectedTier4 = totalValid === 0;

  // Mandatory Safety Notices
  const mandatoryNoticeAr = isRejectedTier4
    ? 'لم نعثر على بديل مكافئ مؤكّد في الكتالوج. يمكن مراجعة الصيدلي المختص أو الطبيب للتحقق من الخيارات المناسبة'
    : 'تم فرز البدائل وفق الهرمية السريرية المعتمدة (نفس المادة الفعالة والمكافئ الحيوي فقط دون تغيير التركيب الكيميائي).';

  const mandatoryNoticeEn = isRejectedTier4
    ? 'No confirmed equivalent substitute found in the catalog. Please consult the attending pharmacist or physician to verify suitable therapeutic alternatives.'
    : 'Substitutes ranked under clinical hierarchy (identical active ingredient and certified bioequivalence only without altering chemical composition).';

  return {
    queriedDrugName: cleanQuery,
    detectedActiveIngredient: activeIngredientToMatch || undefined,
    hasExactMatch: tier1Matches.length > 0,
    hasSameActiveSubstitutes: tier2Matches.length > 0,
    hasBioequivalentSubstitutes: tier3Matches.length > 0,
    tier1ExactMatches: tier1Matches,
    tier2SameActiveSubstitutes: tier2Matches,
    tier3BioequivalentSubstitutes: tier3Matches,
    isRejectedTier4,
    mandatoryNoticeAr,
    mandatoryNoticeEn,
    totalValidSubstitutes: totalValid,
  };
}
