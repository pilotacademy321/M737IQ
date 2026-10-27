/**
 * M737IQ Platform — AI Medicine Assistant Clinical Engine & Catalog Matcher
 * 
 * Sourced strictly from verified official Kimadia / Iraqi Formulary catalog items.
 * Strictly decoupled: Catalog selection does NOT imply stock or availability.
 * Zero hallucination: Never generates fictitious medicine formulations.
 * Integrates 4-Tier substitution & bioequivalence analysis.
 */

import { 
  CatalogMedicineItem, 
  MedicalSpecialtyCategory, 
  MedicineItem, 
  WholesaleMedicineItem 
} from '../types';
import { 
  SPECIALTY_CATEGORIES, 
  VERIFIED_CENTRAL_CATALOG_MEDICINES 
} from '../data/centralMedicineCatalog';
import { 
  analyzeMedicineEquivalence, 
  EquivalenceAnalysisResult 
} from './medicineEquivalenceEngine';

export interface AssistantInterpretationResult {
  query: string;
  detectedCategory?: MedicalSpecialtyCategory;
  categoryTitleAr?: string;
  categoryTitleEn?: string;
  isComprehensiveRequest: boolean;
  isSubstituteRequest?: boolean;
  targetDrugForSubstitute?: string;
  equivalenceResult?: EquivalenceAnalysisResult;
  interpretedIntentAr: string;
  interpretedIntentEn: string;
  matchedMedicines: CatalogMedicineItem[];
  totalMatches: number;
  isCompleteCatalogSet: boolean;
  noMatchReason?: string;
}

// Specialty Keyword Mapping for Arabic (including Iraqi colloquial) and English
interface SpecialtyKeywords {
  id: MedicalSpecialtyCategory;
  keywords: string[];
}

const SPECIALTY_KEYWORDS: SpecialtyKeywords[] = [
  {
    id: 'cardiology',
    keywords: [
      'قلب', 'قلبية', 'ضغط', 'ضغط الدم', 'الضغط العالي', 'الشرايين', 'شريان', 'تخثر', 'جلطة', 'جلطات', 'كارديو', 'ذبحة',
      'cardio', 'cardiology', 'blood pressure', 'hypertension', 'heart', 'vascular', 'statin'
    ],
  },
  {
    id: 'hematology',
    keywords: [
      'دم', 'أمراض الدم', 'فقر دم', 'هيماتولوجي', 'سيولة', 'تخثر', 'هيبارين', 'كلكسان', 'حديد', 'فوليك', 'صفائح', 'خضاب',
      'hematology', 'blood', 'anemia', 'coagulation', 'anticoagulant', 'platelet', 'thrombosis', 'heparin'
    ],
  },
  {
    id: 'endocrinology',
    keywords: [
      'سكري', 'سكر', 'غدد', 'غدة', 'درقية', 'أنسولين', 'انسولين', 'جلوكوفاج', 'هرمون', 'هرمونات', 'سكر تراكمي',
      'diabetes', 'diabetic', 'endocrine', 'endocrinology', 'thyroid', 'insulin', 'metformin', 'glucose'
    ],
  },
  {
    id: 'pediatrics',
    keywords: [
      'أطفال', 'اطفال', 'طفل', 'جهال', 'رضع', 'رضيع', 'خدج', 'حديثي الولادة', 'شراب أطفال', 'تحاميل اطفال', 'حليب أطفال',
      'pediatric', 'pediatrics', 'children', 'child', 'baby', 'infant', 'newborn', 'kids'
    ],
  },
  {
    id: 'gynecology_obstetrics',
    keywords: [
      'نسائية', 'توليد', 'حمل', 'حوامل', 'ولادة', 'مثبت حمل', 'دوفاستون', 'إنجاب', 'رحم', 'فيتامينات حمل', 'مبايض',
      'gynecology', 'obstetrics', 'pregnancy', 'pregnant', 'maternity', 'women', 'fertility'
    ],
  },
  {
    id: 'respiratory',
    keywords: [
      'تنفسي', 'صدرية', 'ربو', 'قحة', 'كحة', 'سعال', 'رئة', 'رئوي', 'شعب هوائية', 'بخاخ', 'فنتولين', 'حساسية صدر', 'ضيق نفس',
      'respiratory', 'pulmonology', 'asthma', 'cough', 'lung', 'inhaler', 'bronchial', 'ventolin'
    ],
  },
  {
    id: 'gastroenterology',
    keywords: [
      'هضمي', 'معدة', 'قولون', 'حموضة', 'قرحة', 'حرقة', 'ارتجاع', 'كبد', 'مرارة', 'باطنية هضمية', 'نيكسيوم', 'إسهال',
      'gastro', 'gastroenterology', 'stomach', 'digestive', 'colon', 'acid', 'gerd', 'ulcer', 'reflux'
    ],
  },
  {
    id: 'orthopedics',
    keywords: [
      'عظام', 'كسور', 'مفاصل', 'غضاريف', 'روماتيزم', 'فقرات', 'انزلاق', 'مسكن عظام', 'فولتارين', 'خشونة مفاصل', 'آلام المفاصل',
      'orthopedic', 'orthopedics', 'bones', 'joints', 'fracture', 'arthritis', 'musculoskeletal', 'rheuma'
    ],
  },
  {
    id: 'dermatology',
    keywords: [
      'جلدية', 'جلد', 'أكزيما', 'اكزيما', 'فطريات', 'حب الشباب', 'حساسية جلد', 'مرهم', 'كريم', 'صدفية', 'بشرة',
      'dermatology', 'skin', 'eczema', 'fungal', 'acne', 'rash', 'dermatitis', 'ointment', 'cream'
    ],
  },
  {
    id: 'ophthalmology',
    keywords: [
      'عيون', 'عين', 'بصر', 'قطرات عيون', 'جفاف عين', 'ضغط عين', 'قرنية', 'شبكية', 'التهاب عيون',
      'ophthalmology', 'eyes', 'eye', 'vision', 'optical', 'eye drops'
    ],
  },
  {
    id: 'ent',
    keywords: [
      'أنف', 'انف', 'أذن', 'اذن', 'حنجرة', 'جيوب', 'جيوب أنفية', 'احتقان', 'حلق', 'بلعوم', 'أوتريفين', 'قطرة اذن',
      'ent', 'ear', 'nose', 'throat', 'sinus', 'sinusitis', 'nasal', 'otolaryngology'
    ],
  },
  {
    id: 'neurology',
    keywords: [
      'أعصاب', 'اعصاب', 'دماغ', 'صرع', 'تشنجات', 'صداع نصفي', 'شقيقة', 'أعصاب طرفية', 'تيجريتول', 'تنميل',
      'neurology', 'neuro', 'brain', 'nerves', 'epilepsy', 'seizure', 'migraine', 'neuralgia'
    ],
  },
  {
    id: 'urology',
    keywords: [
      'مسالك', 'بولية', 'كلى', 'كلية', 'بروستات', 'حصر بول', 'حصى', 'مثانة', 'أومنيك', 'حرقان ادرار', 'مسالك بولية',
      'urology', 'urinary', 'kidney', 'renal', 'prostate', 'bladder', 'tamsulosin'
    ],
  },
  {
    id: 'psychiatry',
    keywords: [
      'نفسي', 'نفسية', 'قلق', 'اكتئاب', 'مزاج', 'توتر', 'مهدئ', 'منوم',
      'psychiatry', 'mental', 'anxiety', 'depression', 'mood'
    ],
  },
  {
    id: 'dentistry',
    keywords: [
      'أسنان', 'اسنان', 'لثة', 'فم', 'خراج أسنان', 'مطهر فم', 'وجع سن', 'غرغرة',
      'dentistry', 'dental', 'teeth', 'tooth', 'gums', 'oral'
    ],
  },
  {
    id: 'general_medicine',
    keywords: [
      'عام', 'طب عام', 'مسكن', 'مسكنات', 'خافض حرارة', 'بندول', 'بنادول', 'باراسيتامول', 'أموكسيل', 'فلاجيل', 'مضاد حيوي',
      'general', 'otc', 'paracetamol', 'painkiller', 'analgesic', 'fever', 'antibiotic'
    ],
  },
  {
    id: 'internal_medicine',
    keywords: [
      'باطنية', 'باطني', 'أمراض باطنية', 'حميات', 'التهابات عامة',
      'internal medicine', 'internal'
    ],
  },
];

/**
 * Normalizes Arabic text for high-accuracy phonetic and dialectic matching
 */
export function normalizeArabicText(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic tashkeel/diacritics
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether user query requests a comprehensive/complete catalog list
 */
function isComprehensiveListIntent(normalized: string): boolean {
  const comprehensiveKeywords = [
    'شامله', 'شامل', 'كامل', 'كامله', 'كل', 'جميع', 'كافه', 'قائمه شاملة', 'قائمه كامله', 'اعرضلي اصناف',
    'comprehensive', 'complete', 'all', 'full list', 'everything'
  ];
  return comprehensiveKeywords.some((w) => normalized.includes(w));
}

/**
 * Checks whether user query asks for alternatives / substitutes / bioequivalence
 */
function isSubstituteIntent(normalized: string): boolean {
  const substituteKeywords = [
    'بديل', 'بدائل', 'مكافئ', 'مكافئة', 'مكافئه', 'شوف البدائل', 'البدائل المكافئة',
    'واذا مو موجود شوف', 'واذا ماموجود شوف', 'شنو بديل', 'اعطيني بديل', 'مكافئ حيوي',
    'alternative', 'substitute', 'bioequivalent', 'equivalent'
  ];
  return substituteKeywords.some((w) => normalized.includes(w));
}

/**
 * Extracts target drug name from a conversational substitute query
 * e.g. "ابحثلي عن بنادول وإذا مو موجود شوف البدائل المكافئة" -> "بنادول"
 */
function extractDrugFromSubstituteQuery(query: string): string {
  let cleaned = query;
  const phrasesToRemove = [
    /ابحثلي\s+عن\s+/gi,
    /ابحث\s+عن\s+/gi,
    /اريد\s+بديل\s+/gi,
    /شنو\s+بديل\s+/gi,
    /شوفلي\s+بديل\s+/gi,
    /شوف\s+بدائل\s+/gi,
    /شوف\s+بديل\s+/gi,
    /واذا\s+مو\s+موجود\s+شوف\s+البدائل\s+المكافئة/gi,
    /واذا\s+مو\s+موجود\s+شوف\s+البدائل\s+المكافئه/gi,
    /واذا\s+ماموجود\s+شوف\s+البدائل/gi,
    /البدائل\s+المكافئة/gi,
    /البدائل\s+المكافئه/gi,
    /البدائل/gi,
    /المكافئة/gi,
    /المكافئ/gi,
  ];

  for (const regex of phrasesToRemove) {
    cleaned = cleaned.replace(regex, ' ');
  }

  return cleaned.trim();
}

/**
 * Deterministic Semantic Catalog Search Engine
 * Interprets natural language queries (Arabic, Iraqi dialect, English)
 * and matches strictly authentic catalog records.
 */
export function interpretMedicineQueryLocally(rawQuery: string): AssistantInterpretationResult {
  const query = rawQuery.trim();
  const normalized = normalizeArabicText(query);
  const isComprehensive = isComprehensiveListIntent(normalized);
  const isSubstitute = isSubstituteIntent(normalized);

  if (!query) {
    return {
      query: '',
      isComprehensiveRequest: false,
      interpretedIntentAr: 'يرجى كتابة أو نطق اسم التخصص الطبي أو الصنف الدوائي المطلوب',
      interpretedIntentEn: 'Please type or speak the requested medical specialty or medicine category',
      matchedMedicines: [],
      totalMatches: 0,
      isCompleteCatalogSet: false,
      noMatchReason: 'الطلب فارغ',
    };
  }

  // Handle Substitute / Equivalence Mode explicitly if detected
  if (isSubstitute) {
    const extractedDrug = extractDrugFromSubstituteQuery(query);
    const equivResult = analyzeMedicineEquivalence(extractedDrug || query);

    let matchedList: CatalogMedicineItem[] = [];
    if (equivResult.tier1ExactMatches.length > 0) {
      matchedList.push(...equivResult.tier1ExactMatches.map((m) => m.medicine));
    }
    if (equivResult.tier2SameActiveSubstitutes.length > 0) {
      matchedList.push(...equivResult.tier2SameActiveSubstitutes.map((m) => m.medicine));
    }
    if (equivResult.tier3BioequivalentSubstitutes.length > 0) {
      matchedList.push(...equivResult.tier3BioequivalentSubstitutes.map((m) => m.medicine));
    }

    const intentAr = equivResult.isRejectedTier4
      ? `طلب بديل لـ "${extractedDrug || query}". ${equivResult.mandatoryNoticeAr}`
      : `طلب بديل لـ "${extractedDrug || query}". تم العثور على ${matchedList.length} مستحضر ضمن الهرمية السريرية (نفس المادة الفعالة / المكافئ الحيوي).`;

    const intentEn = equivResult.isRejectedTier4
      ? `Substitute request for "${extractedDrug || query}". ${equivResult.mandatoryNoticeEn}`
      : `Substitute request for "${extractedDrug || query}". Found ${matchedList.length} verified formulations under strict clinical hierarchy.`;

    return {
      query,
      isComprehensiveRequest: false,
      isSubstituteRequest: true,
      targetDrugForSubstitute: extractedDrug,
      equivalenceResult: equivResult,
      interpretedIntentAr: intentAr,
      interpretedIntentEn: intentEn,
      matchedMedicines: matchedList,
      totalMatches: matchedList.length,
      isCompleteCatalogSet: false,
      noMatchReason: equivResult.isRejectedTier4 ? equivResult.mandatoryNoticeAr : undefined,
    };
  }

  // 1. Detect Specialty Category by Keyword Matching with scoring
  let matchedSpecialty: MedicalSpecialtyCategory | undefined;
  let highestScore = 0;

  for (const item of SPECIALTY_KEYWORDS) {
    let score = 0;
    for (const kw of item.keywords) {
      const normKw = normalizeArabicText(kw);
      if (normalized.includes(normKw)) {
        score += normKw.length; // Prioritize longer, more specific matches
      }
    }
    if (score > highestScore) {
      highestScore = score;
      matchedSpecialty = item.id;
    }
  }

  // Find specialty definition if detected
  const specialtyDef = matchedSpecialty 
    ? SPECIALTY_CATEGORIES.find((c) => c.id === matchedSpecialty) 
    : undefined;

  // 2. Query Central Catalog
  let matchedList: CatalogMedicineItem[] = [];

  if (matchedSpecialty) {
    // Return all verified medicines for this specialty category
    matchedList = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((m) =>
      m.categories.includes(matchedSpecialty!)
    );
  } else {
    // Search across names, active ingredients, brands, and manufacturers (filtering out conversational stop words)
    const STOP_WORDS = new Set([
      'دواء', 'ادوية', 'علاج', 'علاجات', 'مستحضر', 'مستحضرات', 'صنف', 'اصناف',
      'اريد', 'بدي', 'اعطيني', 'جهزلي', 'غير', 'مسجل', 'موجود', 'طلب', 'قائمة',
      'اعرضلي', 'شوفلي', 'هذا', 'الدواء',
      'medicine', 'medicines', 'drug', 'drugs', 'treatment', 'please', 'need', 'want', 'list'
    ]);
    const tokens = normalized
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    if (tokens.length === 0) {
      matchedList = [];
    } else {
      matchedList = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((item) => {
        const targetStr = normalizeArabicText(
          `${item.nameAr} ${item.nameEn} ${item.activeIngredient} ${item.brand} ${item.manufacturer}`
        );
        return tokens.some((token) => targetStr.includes(token));
      });
    }
  }

  // Calculate whether this is the complete set for the specialty
  const totalInSpecialty = matchedSpecialty 
    ? VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((m) => m.categories.includes(matchedSpecialty!)).length
    : 0;
  const isCompleteSet = matchedSpecialty !== undefined && matchedList.length === totalInSpecialty;

  // Build bilingual natural explanation
  let intentAr = '';
  let intentEn = '';

  if (matchedSpecialty && specialtyDef) {
    if (isComprehensive) {
      intentAr = `فهم المساعد: طلب قائمة شاملة لأدوية اختصاص "${specialtyDef.nameAr}". تم جلب كافة المستحضرات المعتمدة بالكتالوج (${matchedList.length} مستحضر).`;
      intentEn = `Assistant interpretation: Full catalog request for "${specialtyDef.nameEn}". Retrieved all verified formulary records (${matchedList.length} items).`;
    } else {
      intentAr = `فهم المساعد: البحث في اختصاص "${specialtyDef.nameAr}". وجدنا ${matchedList.length} مستحضراً رسمياً معتمداً.`;
      intentEn = `Assistant interpretation: Specialty search for "${specialtyDef.nameEn}". Found ${matchedList.length} verified records.`;
    }
  } else if (matchedList.length > 0) {
    intentAr = `فهم المساعد: البحث في الدليل المركزي عن "${query}". وجدنا ${matchedList.length} مستحضر دقيق مطابق.`;
    intentEn = `Assistant interpretation: Catalog search for "${query}". Found ${matchedList.length} exact matching records.`;
  } else {
    // If not found in central catalog, run 4-tier equivalence analysis to see if substitutes can be analyzed
    const fallbackEquiv = analyzeMedicineEquivalence(query);
    if (!fallbackEquiv.isRejectedTier4) {
      return {
        query,
        isComprehensiveRequest: false,
        isSubstituteRequest: true,
        targetDrugForSubstitute: query,
        equivalenceResult: fallbackEquiv,
        interpretedIntentAr: `لم نجد الاسم الحرفي بالضبط، ولكن تم العثور على بدائل مكافئة (${fallbackEquiv.totalValidSubstitutes}) لنفس المادة الفعالة.`,
        interpretedIntentEn: `Exact literal name not in stock, but found ${fallbackEquiv.totalValidSubstitutes} verified active ingredient equivalents.`,
        matchedMedicines: [
          ...fallbackEquiv.tier1ExactMatches.map((m) => m.medicine),
          ...fallbackEquiv.tier2SameActiveSubstitutes.map((m) => m.medicine),
          ...fallbackEquiv.tier3BioequivalentSubstitutes.map((m) => m.medicine),
        ],
        totalMatches: fallbackEquiv.totalValidSubstitutes,
        isCompleteCatalogSet: false,
      };
    }

    intentAr = `لم يتم العثور على أي دواء مطابق لطلبك في الدليل الدوائي المركزي المعتمد. ${fallbackEquiv.mandatoryNoticeAr}`;
    intentEn = `No matching medicines found in the verified central formulary. ${fallbackEquiv.mandatoryNoticeEn}`;
  }

  return {
    query,
    detectedCategory: matchedSpecialty,
    categoryTitleAr: specialtyDef?.nameAr,
    categoryTitleEn: specialtyDef?.nameEn,
    isComprehensiveRequest: isComprehensive,
    interpretedIntentAr: intentAr,
    interpretedIntentEn: intentEn,
    matchedMedicines: matchedList,
    totalMatches: matchedList.length,
    isCompleteCatalogSet: isCompleteSet,
    noMatchReason: matchedList.length === 0 ? 'لا توجد مستحضرات مطابقة في الكتالوج المعتمد' : undefined,
  };
}

/**
 * Checks if a catalog medicine is already stocked in the facility's inventory
 * using both primary catalog ID and active ingredient + strength fingerprinting.
 */
export function checkInventoryDuplicate(
  catalogItem: CatalogMedicineItem,
  existingList: (MedicineItem | WholesaleMedicineItem)[]
): { isDuplicate: boolean; existingRecord?: MedicineItem | WholesaleMedicineItem } {
  for (const existing of existingList) {
    // Direct catalog ID match
    if ('catalogMedicineId' in existing && existing.catalogMedicineId === catalogItem.id) {
      return { isDuplicate: true, existingRecord: existing };
    }

    // Fingerprint match (Name + Active Ingredient + Strength)
    const existingName = (existing.name || '').trim().toLowerCase();
    const existingGeneric = (existing.activeIngredient || '').trim().toLowerCase();
    const existingStrength = (existing.strength || '').trim().toLowerCase();

    const catName = catalogItem.nameEn.trim().toLowerCase();
    const catGeneric = catalogItem.activeIngredient.trim().toLowerCase();
    const catStrength = catalogItem.strength.trim().toLowerCase();

    if (
      (existingName === catName || existingGeneric === catGeneric) &&
      existingStrength === catStrength
    ) {
      return { isDuplicate: true, existingRecord: existing };
    }
  }

  return { isDuplicate: false };
}
