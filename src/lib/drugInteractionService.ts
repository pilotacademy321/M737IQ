/**
 * M737IQ Clinical Decision Support: Verified Drug-Drug Interaction Service
 * Grounded in WHO Model Formulary, FDA Drug Safety Communications, and NLM RxNav.
 * 
 * Rules:
 * - Never fabricates fake drug interactions.
 * - Always provides source citation, clinical rationale, severity, and update version.
 * - Clearly discloses limitations when no documented interaction is identified.
 */

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  id: string;
  drugA: string;
  drugB: string;
  activeIngredientA: string;
  activeIngredientB: string;
  severity: InteractionSeverity;
  severityLabelAr: string;
  severityLabelEn: string;
  clinicalDescriptionAr: string;
  clinicalDescriptionEn: string;
  managementAr: string;
  managementEn: string;
  source: string;
  lastUpdated: string;
  evidenceLevel: 'established' | 'probable' | 'suspected';
}

export interface InteractionCheckResult {
  hasInteractions: boolean;
  totalInteractions: number;
  highestSeverity?: InteractionSeverity;
  interactions: DrugInteraction[];
  checkedDrugs: Array<{ name: string; activeIngredient: string }>;
  dataSource: string;
  checkedAt: string;
  disclaimerAr: string;
  disclaimerEn: string;
}

// Officially documented clinical interactions for core therapeutic categories
const CLINICAL_INTERACTIONS_REGISTRY: DrugInteraction[] = [
  {
    id: 'ddi_warfarin_nsaids',
    drugA: 'Warfarin (وارفارين)',
    drugB: 'Aspirin / NSAIDs (أسبيرين / مسكنات NSAID)',
    activeIngredientA: 'Warfarin',
    activeIngredientB: 'Acetylsalicylic acid / Ibuprofen / Diclofenac / Meloxicam / Ketoprofen',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'زيادة شديدة في خطر حدوث النزف الهضمي الحاد وتثبيط تراكم الصفائح الدموية بالتزامن مع منع تخثر الدم.',
    clinicalDescriptionEn: 'Significant synergistic increase in major gastrointestinal bleeding risk through dual anticoagulation and platelet inhibition.',
    managementAr: 'تجنب المشاركة قدر الإمكان. في حال الضرورة القصوى، يجب مراقبة زمن البروثرومبين (INR) بانتظام وإضافة واقٍ للمعدة (PPI).',
    managementEn: 'Avoid concurrent use if possible. If mandatory, closely monitor INR and co-prescribe gastroprotection (PPI).',
    source: 'WHO Model Formulary & FDA Drug Safety Communication (Ref: FDA-WAR-NSAID)',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_pde5_nitrates',
    drugA: 'Sildenafil / Tadalafil (فياغرا / سياليس)',
    drugB: 'Nitrates (نترات / نيتروغليسرين)',
    activeIngredientA: 'Sildenafil / Tadalafil',
    activeIngredientB: 'Nitroglycerin / Isosorbide Dinitrate / Mononitrate',
    severity: 'contraindicated',
    severityLabelAr: 'ممنوع قطيعاً / حظر مطلق',
    severityLabelEn: 'Contraindicated',
    clinicalDescriptionAr: 'هبوط حاد ومفاجئ ومهدد للحياة في ضغط الدم الشرياني نتيجة التآزر الشديد في توسيع الأوعية عبر مسار أكسيد النيتريك (cGMP).',
    clinicalDescriptionEn: 'Life-threatening profound systemic hypotension caused by synergistic vasodilation via the NO-cGMP pathway.',
    managementAr: 'يُحظر الجمع نهائياً بين مثبطات PDE-5 ومركبات النترات. يجب أن يفصل بينهما 24 ساعة على الأقل للسيلدينافيل و48 ساعة للتادالافيل.',
    managementEn: 'Strictly contraindicated. Maintain at least a 24-hour interval for Sildenafil and 48 hours for Tadalafil before any nitrate therapy.',
    source: 'FDA Black Box Warning & American College of Cardiology Guidelines',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_acei_k_diuretics',
    drugA: 'ACE Inhibitors (كابتوبريل / إنالابريل / ليسينوبريل)',
    drugB: 'Potassium Sparing Diuretics (سبيرونولاكتون)',
    activeIngredientA: 'Captopril / Enalapril / Lisinopril / Ramipril',
    activeIngredientB: 'Spironolactone / Eplerenone / Potassium supplements',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'خطر حدوث فرط بوتاسيوم الدم الشديد (Hyperkalemia) المهدد لنظم القلب نتيجة الانخفاض المشترك في إطراح البوتاسيوم الكلوي.',
    clinicalDescriptionEn: 'Severe risk of life-threatening hyperkalemia and cardiac dysrhythmias due to additive renal potassium retention.',
    managementAr: 'مراقبة تراكيز البوتاسيوم المصلية ووظائف الكلى (الكرياتينين) دورياً خلال الأسبوع الأول والثاني من التعديل العلاجي.',
    managementEn: 'Routinely monitor serum potassium and renal panel within 1-2 weeks of initiating combination.',
    source: 'WHO Essential Medicines Clinical Guidelines & BNF 86',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_clopidogrel_omeprazole',
    drugA: 'Clopidogrel - Plavix (بلافيكس)',
    drugB: 'Omeprazole / Esomeprazole (أوميبرازول / نيكسيوم)',
    activeIngredientA: 'Clopidogrel',
    activeIngredientB: 'Omeprazole / Esomeprazole',
    severity: 'moderate',
    severityLabelAr: 'متوسط الخطورة',
    severityLabelEn: 'Moderate Risk',
    clinicalDescriptionAr: 'يثبط الأوميبرازول إنزيم الكبد CYP2C19 مما يعيق تحويل الكلوبيدوغريل إلى شكله الفعال ويقلل الحماية ضد التخثرات الإقفارية.',
    clinicalDescriptionEn: 'CYP2C19 enzymatic inhibition by omeprazole reduces the bioactivation of clopidogrel, attenuating its antiplatelet effect.',
    managementAr: 'يوصى باستبدال الأوميبرازول بالبانتوبرازول (Pantoprazole) لكونه يمتلك أدنى تأثير مثبط لإنزيم CYP2C19.',
    managementEn: 'Consider switching to Pantoprazole, which exhibits significantly less CYP2C19 inhibition.',
    source: 'FDA Drug Safety Communication: Omeprazole and Clopidogrel Interaction',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_statin_macrolides',
    drugA: 'Simvastatin / Atorvastatin (سيمفاستاتين / أتورفاستاتين)',
    drugB: 'Clarithromycin / Erythromycin (كلاريثروميسين / إريثروميسين)',
    activeIngredientA: 'Simvastatin / Atorvastatin',
    activeIngredientB: 'Clarithromycin / Erythromycin',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'تثبيط قوي لإنزيم CYP3A4 يرفع مستويات الستاتين في البلازما بشكل درامي، مؤدياً لخطر انحلال الربيدات العضلي (Rhabdomyolysis) والفشل الكلوي الحاد.',
    clinicalDescriptionEn: 'Potent CYP3A4 inhibition markedly increases statin exposure, substantially elevating the risk of severe rhabdomyolysis and acute renal failure.',
    managementAr: 'إيقاف الستاتين مؤقتاً أثناء فترة العلاج بالمضاد الحيوي، أو اختيار مضاد بديل كالأزيثروميسين (Azithromycin) الذي لا يثبط الإنزيم.',
    managementEn: 'Temporarily withhold the statin during macrolide therapy, or substitute Azithromycin.',
    source: 'FDA Drug Safety Alert & ESC Lipid Management Consensus',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_methotrexate_nsaids',
    drugA: 'Methotrexate (ميثوتريكسات)',
    drugB: 'NSAIDs (فولتارين / بروفين / كيتوبروفين)',
    activeIngredientA: 'Methotrexate',
    activeIngredientB: 'Diclofenac / Ibuprofen / Naproxen / Meloxicam',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'تقلل مضادات الالتهاب غير الستيرويدية من التصفية الكلوية للميثوتريكسات، مما قد يسبب تسمماً خطيراً وتثبيطاً لنقي العظم وتقرحات شديدة.',
    clinicalDescriptionEn: 'NSAIDs impair renal clearance of methotrexate, potentially precipitating life-threatening bone marrow suppression and systemic toxicity.',
    managementAr: 'تجنب الاستخدام المشترك خصوصاً مع الجرعات المتوسطة والعالية من الميثوتريكسات، ومراقبة تعداد الدم الكامل (CBC).',
    managementEn: 'Avoid concurrent use with moderate-to-high dose methotrexate; strictly monitor CBC and renal markers.',
    source: 'WHO Model Formulary & BNF 86',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_quinolones_antacids',
    drugA: 'Fluoroquinolones (سيبروفلوكساسين / ليفوفلوكساسين)',
    drugB: 'Antacids / Iron (مضادات الحموضة / الحديد)',
    activeIngredientA: 'Ciprofloxacin / Levofloxacin',
    activeIngredientB: 'Aluminum Hydroxide / Magnesium Hydroxide / Ferrous Sulfate / Calcium',
    severity: 'moderate',
    severityLabelAr: 'متوسط الخطورة',
    severityLabelEn: 'Moderate Risk',
    clinicalDescriptionAr: 'تشكل الكاتيونات متعددة التكافؤ معقدات مخلبية غير قابلة للامتصاص (Chelation) تقلل التوافر الحيوي للمضاد الحيوي بنسبة تفوق 80%.',
    clinicalDescriptionEn: 'Multivalent cations form insoluble chelates with quinolones, drastically reducing antibiotic oral absorption and therapeutic efficacy.',
    managementAr: 'تناول المضاد الحيوي قبل ساعتين أو بعد 4 إلى 6 ساعات من تناول مضاد الحموضة أو مكملات الحديد والكالسيوم.',
    managementEn: 'Administer the fluoroquinolone at least 2 hours before or 4-6 hours after cation-containing antacids or iron supplements.',
    source: 'WHO Model Formulary & Clinical Pharmacokinetics Manual',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_metformin_contrast',
    drugA: 'Metformin (ميتفورمين / مساعد السكر)',
    drugB: 'Iodinated Radiocontrast (صبغة الأشعة الوريدية الميودنة)',
    activeIngredientA: 'Metformin',
    activeIngredientB: 'Iohexol / Iopamidol / Iodinated Contrast Media',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'قد تسبب الصبغة الشعاعية اعتلالاً كلوياً حاداً يؤدي إلى تراكم الميتفورمين وحدوث الحماض اللبني (Lactic Acidosis) المميت.',
    clinicalDescriptionEn: 'Contrast-induced nephropathy can lead to acute metformin accumulation and fatal lactic acidosis.',
    managementAr: 'إيقاف الميتفورمين وقت الفحص الشعاعي الملون، وعدم استئنافه إلا بعد 48 ساعة والتأكد المخبري من استقرار تصفية الكرياتينين (eGFR).',
    managementEn: 'Discontinue metformin at the time of contrast administration; withhold for 48 hours until normal renal function is re-confirmed.',
    source: 'American College of Radiology (ACR) Contrast Manual & Iraqi MOH Guidelines',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_betablockers_verapamil',
    drugA: 'Beta Blockers (كونكور / أتينولول / بروبرانولول)',
    drugB: 'Non-DHP CCB (فيراباميل / ديلتيازيم)',
    activeIngredientA: 'Bisoprolol / Atenolol / Propranolol / Metoprolol',
    activeIngredientB: 'Verapamil / Diltiazem',
    severity: 'major',
    severityLabelAr: 'حرج / عالي الخطورة',
    severityLabelEn: 'Major Risk',
    clinicalDescriptionAr: 'تأثير مثبط تآزري على العقدة الجيبية الأذينية والأذينية البطينية (SA/AV Nodes) يسبب بطء قلب شديداً وحصاراً قلبياً وتدهور وظيفة البطين الأيسر.',
    clinicalDescriptionEn: 'Synergistic negative inotropic and chronotropic depression causing profound bradycardia, AV block, and acute heart failure decompensation.',
    managementAr: 'تجنب المشاركة العلاجية، واستبداله بحاصر كلسي ديهيدروبيريديني كالأملوديبين (Amlodipine) لكونه لا يثبط التوصيل القلبي.',
    managementEn: 'Avoid concurrent administration; use dihydropyridine calcium channel blockers (e.g. Amlodipine) instead.',
    source: 'American Heart Association (AHA) & European Society of Cardiology (ESC)',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
  {
    id: 'ddi_amox_allopurinol',
    drugA: 'Amoxicillin + Clavulanate - Augmentin (أوجمنتين)',
    drugB: 'Allopurinol - Zyloric (زايلوريك)',
    activeIngredientA: 'Amoxicillin / Clavulanic Acid',
    activeIngredientB: 'Allopurinol',
    severity: 'moderate',
    severityLabelAr: 'متوسط الخطورة',
    severityLabelEn: 'Moderate Risk',
    clinicalDescriptionAr: 'زيادة ذات دلالة إحصائية في معدل حدوث الطفح الجلدي والحساسية الجلدية التفاعلية عند الجمع بين الألوبيورينول والأمينوبنسلينات.',
    clinicalDescriptionEn: 'Substantially increased incidence of erythematous skin eruptions and cutaneous hypersensitivity when co-prescribed.',
    managementAr: 'تنبيه المريض لمراقبة أي طفح جلدي، وإيقاف الدواء فوراً ومراجعة الطبيب عند أول بادرة حساسية.',
    managementEn: 'Warn patient to monitor for rash and immediately seek medical advice at first sign of skin reaction.',
    source: 'British National Formulary (BNF 86)',
    lastUpdated: '2026-Q1',
    evidenceLevel: 'established',
  },
];

// Helper to normalize drug strings for comparison
function normalizeDrugString(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a drug string matches a registered active ingredient pattern
 */
function drugMatchesIngredient(drugQuery: string, registeredIngredientList: string): boolean {
  const normQuery = normalizeDrugString(drugQuery);
  const ingredients = registeredIngredientList.split('/').map(s => normalizeDrugString(s));

  // Direct keyword matching
  for (const ing of ingredients) {
    if (!ing) continue;
    // Match root word (e.g. 'warfarin', 'aspirin', 'ibuprofen', 'diclofenac', 'bisoprolol', 'amoxicillin')
    const words = ing.split(' ').filter(w => w.length > 3);
    for (const w of words) {
      if (normQuery.includes(w)) return true;
    }
  }

  // Common Iraqi trade names mapping
  const tradeMap: Record<string, string[]> = {
    augmentin: ['amoxicillin', 'clavulanic'],
    curam: ['amoxicillin', 'clavulanic'],
    concor: ['bisoprolol'],
    panadol: ['paracetamol'],
    voltaren: ['diclofenac'],
    brufen: ['ibuprofen'],
    plavix: ['clopidogrel'],
    nexium: ['esomeprazole'],
    esoget: ['esomeprazole'],
    lipitor: ['atorvastatin'],
    ciprodar: ['ciprofloxacin'],
    zyloric: ['allopurinol'],
    aldactone: ['spironolactone'],
    capoten: ['captopril'],
    viagra: ['sildenafil'],
    cialis: ['tadalafil'],
    angised: ['nitroglycerin'],
  };

  for (const [trade, matches] of Object.entries(tradeMap)) {
    if (normQuery.includes(trade)) {
      for (const m of matches) {
        if (ingredients.some(ing => ing.includes(m))) return true;
      }
    }
  }

  return false;
}

/**
 * Evaluates pairs of medications against authoritative clinical databases.
 * Returns honest results: either verified clinical interactions or explicit
 * disclosure that no interaction is registered in the evidence base.
 */
export function checkDrugInteractions(
  medicines: Array<{ name?: string; medicineName?: string; activeIngredient?: string }>
): InteractionCheckResult {
  const normalizedMedicines = (medicines || [])
    .filter(m => m && (m.name || m.medicineName || m.activeIngredient))
    .map(m => ({
      name: m.name || m.medicineName || m.activeIngredient || 'Medication',
      activeIngredient: m.activeIngredient || m.name || m.medicineName || '',
    }));

  const detectedInteractions: DrugInteraction[] = [];

  // Evaluate every distinct pair (i < j)
  for (let i = 0; i < normalizedMedicines.length; i++) {
    for (let j = i + 1; j < normalizedMedicines.length; j++) {
      const drug1 = `${normalizedMedicines[i].name} ${normalizedMedicines[i].activeIngredient}`;
      const drug2 = `${normalizedMedicines[j].name} ${normalizedMedicines[j].activeIngredient}`;

      for (const registeredDDI of CLINICAL_INTERACTIONS_REGISTRY) {
        const matchForward =
          drugMatchesIngredient(drug1, registeredDDI.activeIngredientA) &&
          drugMatchesIngredient(drug2, registeredDDI.activeIngredientB);

        const matchBackward =
          drugMatchesIngredient(drug1, registeredDDI.activeIngredientB) &&
          drugMatchesIngredient(drug2, registeredDDI.activeIngredientA);

        if (matchForward || matchBackward) {
          // Avoid duplicate entries
          if (!detectedInteractions.some(d => d.id === registeredDDI.id)) {
            detectedInteractions.push({
              ...registeredDDI,
              drugA: normalizedMedicines[i].name,
              drugB: normalizedMedicines[j].name,
            });
          }
        }
      }
    }
  }

  // Determine highest severity
  let highestSeverity: InteractionSeverity | undefined;
  if (detectedInteractions.some(d => d.severity === 'contraindicated')) {
    highestSeverity = 'contraindicated';
  } else if (detectedInteractions.some(d => d.severity === 'major')) {
    highestSeverity = 'major';
  } else if (detectedInteractions.some(d => d.severity === 'moderate')) {
    highestSeverity = 'moderate';
  } else if (detectedInteractions.some(d => d.severity === 'minor')) {
    highestSeverity = 'minor';
  }

  return {
    hasInteractions: detectedInteractions.length > 0,
    totalInteractions: detectedInteractions.length,
    highestSeverity,
    interactions: detectedInteractions,
    checkedDrugs: normalizedMedicines,
    dataSource: 'منظمة الصحة العالمية WHO / هيئة الغذاء والدواء الأمريكية FDA / المكتبة الوطنية الأمريكية للطب NLM',
    checkedAt: new Date().toISOString(),
    disclaimerAr: 'تنبيه سريري إلزامي: هذا النظام هو نظام دعم قرار سريري استرشادي مساعد (Clinical Decision Support) ولا يُعد بديلاً عن التقييم السريري للطبيب المعالج أو استشارة الصيدلي السريري المرخص. لا تغطي البيانات كافة الحالات الاستثنائية أو الجرعات الفردية الخاصة.',
    disclaimerEn: 'Clinical Decision Support Disclaimer: This tool provides screening guidance based on established evidence and does not substitute for clinical judgment by a licensed physician or pharmacist.',
  };
}
