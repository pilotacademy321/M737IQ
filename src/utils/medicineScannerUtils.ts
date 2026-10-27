/**
 * Utilities for barcode, QR code, GS1 DataMatrix parsing, and label text OCR extraction.
 * Compliant with pharmaceutical standards and M737IQ security requirements.
 */

export interface ParsedMedicineExtractedInfo {
  tradeName?: string;
  activeIngredient?: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  batchNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  barcode?: string;
  rawText: string;
}

export interface ScannedCodeResult {
  code: string;
  format?: string;
  isUrl: boolean;
  safeUrlDisplay?: string;
  gs1Data?: {
    gtin?: string;
    expiryDate?: string; // YYYY-MM-DD
    batchNumber?: string;
    serialNumber?: string;
  };
}

/**
 * Checks if a string is a URL. Arbitrary URLs must NEVER be opened automatically.
 */
export function isLikelyUrl(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  return /^(https?:\/\/|www\.)/i.test(trimmed);
}

/**
 * Parses GS1 AI (Application Identifiers) found in pharmaceutical 2D DataMatrix or QR barcodes.
 * Standard AIs:
 * - (01) GTIN - 14 digits
 * - (17) Expiry date - YYMMDD
 * - (10) Batch / Lot - variable up to 20 alphanumeric
 * - (21) Serial number - variable up to 20 alphanumeric
 */
export function parseGs1Data(raw: string): ScannedCodeResult['gs1Data'] | undefined {
  if (!raw) return undefined;

  let gtin: string | undefined;
  let expiryDate: string | undefined;
  let batchNumber: string | undefined;
  let serialNumber: string | undefined;

  // Check parenthesized format like (01)01234567890128(17)261231(10)LOT12345
  const gtinParen = raw.match(/\(01\)(\d{14})/);
  if (gtinParen) gtin = gtinParen[1];

  const expiryParen = raw.match(/\(17\)(\d{6})/);
  if (expiryParen) {
    const rawExp = expiryParen[1];
    const year = parseInt('20' + rawExp.substring(0, 2), 10);
    const month = rawExp.substring(2, 4);
    let day = rawExp.substring(4, 6);
    if (day === '00') day = '28'; // GS1 standard: 00 day means end of month
    expiryDate = `${year}-${month}-${day}`;
  }

  const batchParen = raw.match(/\(10\)([a-zA-Z0-9_\-]+)/);
  if (batchParen) batchNumber = batchParen[1];

  const serialParen = raw.match(/\(21\)([a-zA-Z0-9_\-]+)/);
  if (serialParen) serialNumber = serialParen[1];

  // Also check non-parenthesized raw AI strings starting with 01
  if (!gtin && raw.startsWith('01') && raw.length >= 16) {
    gtin = raw.substring(2, 16);
    const remainder = raw.substring(16);
    const expMatch = remainder.match(/^17(\d{6})/);
    if (expMatch) {
      const rawExp = expMatch[1];
      const year = parseInt('20' + rawExp.substring(0, 2), 10);
      const month = rawExp.substring(2, 4);
      let day = rawExp.substring(4, 6);
      if (day === '00') day = '28';
      expiryDate = `${year}-${month}-${day}`;
    }
  }

  if (gtin || expiryDate || batchNumber || serialNumber) {
    return { gtin, expiryDate, batchNumber, serialNumber };
  }

  return undefined;
}

/**
 * Safely sanitizes scanned barcode or QR code strings.
 */
export function cleanScannedCode(raw: string): ScannedCodeResult {
  const trimmed = (raw || '').trim();
  const isUrl = isLikelyUrl(trimmed);
  const gs1Data = parseGs1Data(trimmed);

  return {
    code: trimmed,
    isUrl,
    safeUrlDisplay: isUrl ? trimmed : undefined,
    gs1Data,
  };
}

/**
 * Parses raw text extracted by OCR from a medicine box or label.
 * Extracts active ingredient, strength, dosage form, batch, and expiry.
 */
export function parseMedicineTextOcr(rawText: string): ParsedMedicineExtractedInfo {
  if (!rawText) return { rawText: '' };

  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  let strength: string | undefined;
  let dosageForm: string | undefined;
  let activeIngredient: string | undefined;
  let batchNumber: string | undefined;
  let expiryDate: string | undefined;
  let tradeName: string | undefined;

  // Strength regex (e.g. 500mg, 500 mg, 10mg, 1g, 250mcg, 100iu, 250mg/5ml, 5mg/ml)
  const strengthMatch = rawText.match(/\b(\d+(?:\.\d+)?\s*(?:mg|g|mcg|iu|%|mg\/ml|mg\/5ml|g\/100ml))\b/i);
  if (strengthMatch) {
    strength = strengthMatch[1].replace(/\s+/g, '');
  }

  // Dosage Form regex (English & Arabic)
  const dosageMatch = rawText.match(/\b(tablets?|capsules?|syrup|suspension|injections?|ampoules?|vials?|cream|ointment|gel|drops|solution|suppositor(?:y|ies)|lozenge|powder|أقراص|حبوب|كبسول(?:ات)?|شراب|معلق|مرهم|كريم|حقن(?:ة)?|أمبول(?:ة)?|قطرة|جل|بخاخ)\b/i);
  if (dosageMatch) {
    const matched = dosageMatch[1].toLowerCase();
    if (matched.includes('tab') || matched.includes('أقراص') || matched.includes('حبوب')) {
      dosageForm = 'Tablets (أقراص)';
    } else if (matched.includes('cap') || matched.includes('كبسول')) {
      dosageForm = 'Capsules (كبسولات)';
    } else if (matched.includes('syrup') || matched.includes('شراب')) {
      dosageForm = 'Syrup (شراب)';
    } else if (matched.includes('susp') || matched.includes('معلق')) {
      dosageForm = 'Suspension (معلق)';
    } else if (matched.includes('inj') || matched.includes('amp') || matched.includes('vial') || matched.includes('حقن') || matched.includes('أمبول')) {
      dosageForm = 'Injection (حقن)';
    } else if (matched.includes('cream') || matched.includes('كريم')) {
      dosageForm = 'Cream (كريم)';
    } else if (matched.includes('ointment') || matched.includes('مرهم')) {
      dosageForm = 'Ointment (مرهم)';
    } else if (matched.includes('drop') || matched.includes('قطرة')) {
      dosageForm = 'Drops (قطرات)';
    } else {
      dosageForm = dosageMatch[1];
    }
  }

  // Expiry date regex (supports formats like 12/2027, 2027-06, 05.2028, EXP 08/2026, EXP: 2028/01)
  const expMatch = rawText.match(/(?:EXP|EXPIRY|ED|صلاحية|انتهاء)?\s*[:.]?\s*(\d{1,2}[\/\.-]\d{2,4}|\d{4}[\/\.-]\d{1,2})/i);
  if (expMatch) {
    const raw = expMatch[1];
    if (raw.includes('/') || raw.includes('.') || raw.includes('-')) {
      const parts = raw.split(/[\/\.-]/);
      if (parts.length === 2) {
        let p1 = parseInt(parts[0], 10);
        let p2 = parseInt(parts[1], 10);
        if (p2 < 100) p2 += 2000;
        if (p1 > 100) {
          // Format YYYY/MM
          const y = p1;
          const m = String(p2).padStart(2, '0');
          expiryDate = `${y}-${m}-28`;
        } else {
          // Format MM/YYYY
          const m = String(p1).padStart(2, '0');
          const y = p2;
          expiryDate = `${y}-${m}-28`;
        }
      }
    }
  }

  // Batch / Lot regex
  const lotMatch = rawText.match(/(?:LOT|BATCH|BN|B\.N|تشغيلة|دفعة)?\s*[:.]?\s*([A-Z0-9]{5,12})\b/i);
  if (lotMatch) {
    batchNumber = lotMatch[1];
  }

  // Common active ingredients scan
  const commonIngredients = [
    'Paracetamol', 'Acetaminophen', 'Amoxicillin', 'Ibuprofen', 'Metformin',
    'Ciprofloxacin', 'Atorvastatin', 'Azithromycin', 'Omeprazole', 'Esomeprazole',
    'Diclofenac', 'Ceftriaxone', 'Amlodipine', 'Losartan', 'Bisoprolol',
    'Pantoprazole', 'Domperidone', 'Cetirizine', 'Loratadine', 'Levofloxacin',
    'Clarithromycin', 'Dexamethasone', 'Prednisolone', 'Hydrocortisone',
    'Metronidazole', 'Fluconazole', 'Aspirin', 'Salbutamol', 'Montelukast',
    'Gliclazide', 'Rosuvastatin', 'Valsartan', 'Telmisartan', 'Spironolactone'
  ];

  for (const ing of commonIngredients) {
    if (new RegExp(`\\b${ing}\\b`, 'i').test(rawText)) {
      activeIngredient = ing;
      break;
    }
  }

  // Guess trade name from first 2 non-empty lines that don't look like generic words
  for (const line of lines.slice(0, 3)) {
    const clean = line.replace(/[^\w\s\u0600-\u06FF]/g, '').trim();
    if (clean.length >= 3 && !clean.toLowerCase().includes('keep out') && !clean.toLowerCase().includes('store below')) {
      tradeName = clean;
      break;
    }
  }

  return {
    tradeName,
    activeIngredient,
    strength,
    dosageForm,
    batchNumber,
    expiryDate,
    rawText,
  };
}
