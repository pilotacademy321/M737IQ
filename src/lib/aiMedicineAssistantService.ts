/**
 * M737IQ Platform — AI Medicine Assistant Clinical Engine & Catalog Matcher
 * 
 * Sourced strictly from verified official Kimadia / Iraqi Formulary catalog items.
 * Strictly decoupled: Catalog selection does NOT imply stock or availability.
 * Zero hallucination: Never generates fictitious medicine formulations.
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

export interface AssistantInterpretationResult {
  query: string;
  detectedCategory?: MedicalSpecialtyCategory;
  categoryTitleAr?: string;
  categoryTitleEn?: string;
  isComprehensiveRequest: boolean;
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
      'قلب', 'قلبية', 'ضغط', 'ضغط الدم', 'الشرايين', 'شريان', 'تخثر', 'جلطة', 'جلطات', 'كارديو',
      'cardio', 'cardiology', 'blood pressure', 'hypertension', 'heart', 'vascular', 'statin'
    ],
  },
  {
    id: 'hematology',
    keywords: [
      'دم', 'أمراض الدم', 'فقر دم', 'هيماتولوجي', 'سيولة', 'تخثر', 'هيبارين', 'كلكسان', 'حديد', 'فوليك', 'صفائح',
      'hematology', 'blood', 'anemia', 'coagulation', 'anticoagulant', 'platelet', 'thrombosis', 'heparin'
    ],
  },
  {
    id: 'endocrinology',
    keywords: [
      'سكري', 'سكر', 'غدد', 'غدة', 'درقية', 'أنسولين', 'جلوكوفاج', 'هرمون', 'هرمونات',
      'diabetes', 'diabetic', 'endocrine', 'endocrinology', 'thyroid', 'insulin', 'metformin', 'glucose'
    ],
  },
  {
    id: 'pediatrics',
    keywords: [
      'أطفال', 'اطفال', 'طفل', 'جهال', 'رضع', 'رضيع', 'خدج', 'حديثي الولادة', 'شراب أطفال',
      'pediatric', 'pediatrics', 'children', 'child', 'baby', 'infant', 'newborn', 'kids'
    ],
  },
  {
    id: 'gynecology_obstetrics',
    keywords: [
      'نسائية', 'توليد', 'حمل', 'حوامل', 'ولادة', 'مثبت حمل', 'دوفاستون', 'إنجاب', 'رحم',
      'gynecology', 'obstetrics', 'pregnancy', 'pregnant', 'maternity', 'women', 'fertility'
    ],
  },
  {
    id: 'respiratory',
    keywords: [
      'تنفسي', 'صدرية', 'ربو', 'قحة', 'سعال', 'رئة', 'رئوي', 'شعب هوائية', 'بخاخ', 'فنتولين', 'حساسية صدر',
      'respiratory', 'pulmonology', 'asthma', 'cough', 'lung', 'inhaler', 'bronchial', 'ventolin'
    ],
  },
  {
    id: 'gastroenterology',
    keywords: [
      'هضمي', 'معدة', 'قولون', 'حموضة', 'قرحة', 'ارتجاع', 'كبد', 'مرارة', 'باطنية هضمية', 'نيكسيوم',
      'gastro', 'gastroenterology', 'stomach', 'digestive', 'colon', 'acid', 'gerd', 'ulcer', 'reflux'
    ],
  },
  {
    id: 'orthopedics',
    keywords: [
      'عظام', 'كسور', 'مفاصل', 'غضاريف', 'روماتيزم', 'فقرات', 'انزلاق', 'مسكن عظام', 'فولتارين',
      'orthopedic', 'orthopedics', 'bones', 'joints', 'fracture', 'arthritis', 'musculoskeletal', 'rheuma'
    ],
  },
  {
    id: 'dermatology',
    keywords: [
      'جلدية', 'جلد', 'أكزيما', 'اكزيما', 'فطريات', 'حب الشباب', 'حساسية جلد', 'مرهم', 'كريم',
      'dermatology', 'skin', 'eczema', 'fungal', 'acne', 'rash', 'dermatitis', 'ointment', 'cream'
    ],
  },
  {
    id: 'ophthalmology',
    keywords: [
      'عيون', 'عين', 'بصر', 'قطرات عيون', 'جفاف عين', 'ضغط عين', 'قرنية', 'شبكية',
      'ophthalmology', 'eyes', 'eye', 'vision', 'optical', 'eye drops'
    ],
  },
  {
    id: 'ent',
    keywords: [
      'أنف', 'انف', 'أذن', 'اذن', 'حنجرة', 'جيوب', 'جيوب أنفية', 'احتقان', 'حلق', 'بلعوم', 'أوتريفين',
      'ent', 'ear', 'nose', 'throat', 'sinus', 'sinusitis', 'nasal', 'otolaryngology'
    ],
  },
  {
    id: 'neurology',
    keywords: [
      'أعصاب', 'اعصاب', 'دماغ', 'صرع', 'تشنجات', 'صداع نصفي', 'شقيقة', 'أعصاب طرفية', 'تيجريتول',
      'neurology', 'neuro', 'brain', 'nerves', 'epilepsy', 'seizure', 'migraine', 'neuralgia'
    ],
  },
  {
    id: 'urology',
    keywords: [
      'مسالك', 'بولية', 'كلى', 'كلية', 'بروستات', 'حصر بول', 'حصى', 'مثانة', 'أومنيك',
      'urology', 'urinary', 'kidney', 'renal', 'prostate', 'bladder', 'tamsulosin'
    ],
  },
  {
    id: 'psychiatry',
    keywords: [
      'نفسي', 'نفسية', 'قلق', 'اكتئاب', 'مزاج', 'توتر', 'مهدئ',
      'psychiatry', 'mental', 'anxiety', 'depression', 'mood'
    ],
  },
  {
    id: 'dentistry',
    keywords: [
      'أسنان', 'اسنان', 'لثة', 'فم', 'خراج أسنان', 'مطهر فم', 'وجع سن',
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
      'باطنية', 'باطني', 'أمراض باطنية', 'حميات',
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
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\u064B-\u065F]/g, '') // Remove Arabic tashkeel/diacritics
    .replace(/[^\w\s\u0600-\u06FF]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether user query requests a comprehensive/complete catalog list
 */
function isComprehensiveListIntent(normalized: string): boolean {
  const comprehensiveKeywords = [
    'شامله', 'شامل', 'كامل', 'كامله', 'كل', 'جميع', 'كافه', 'قائمه شاملة', 'قائمه كامله',
    'comprehensive', 'complete', 'all', 'full list', 'everything'
  ];
  return comprehensiveKeywords.some((w) => normalized.includes(w));
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
    intentAr = `لم يتم العثور على أي دواء مطابق لطلبك في الدليل الدوائي المركزي المعتمد. يرجى تجربة اسم تخصص مثل: القلب، السكري، الأطفال، أو النسائية.`;
    intentEn = `No matching medicines found in the verified central formulary. Try searching by specialty such as: Cardiology, Diabetes, Pediatrics, or Obstetrics.`;
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
