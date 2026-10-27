import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { logAuditEvent } from '../lib/auditLogger';
import { 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  X, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Check, 
  RotateCcw, 
  Filter, 
  Edit3, 
  Layers, 
  RefreshCw,
  HelpCircle,
  Package
} from 'lucide-react';

interface MedicineBulkImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'wholesaler' | 'pharmacy';
  userId: string;
  businessName: string;
  businessPhone?: string;
  businessGovernorate?: string;
  businessAddress?: string;
  existingMedicines: any[];
  onImportComplete: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

interface ColumnMapping {
  name: string;
  nameAr: string;
  brand: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  manufacturer: string;
  originCountry: string;
  barcode: string;
  qrCode: string;
  price: string;
  quantity: string;
  batchNumber: string;
  expiryDate: string;
  minStockAlert: string;
  requiresPrescription: string;
  notes: string;
}

interface ParsedImportRow {
  index: number;
  raw: Record<string, any>;
  name: string;
  nameAr: string;
  brand: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  manufacturer: string;
  originCountry: string;
  barcode: string;
  qrCode: string;
  price: number;
  quantity: number;
  batchNumber: string;
  expiryDate: string;
  minStockAlert: number;
  requiresPrescription: boolean;
  notes: string;
  isValid: boolean;
  isExistingConflict: boolean;
  conflictItemId?: string;
  isFileDuplicate: boolean;
  errors: string[];
  warnings: string[];
  action: 'create' | 'update' | 'skip';
}

export const MedicineBulkImportWizard: React.FC<MedicineBulkImportWizardProps> = ({
  isOpen,
  onClose,
  role,
  userId,
  businessName,
  businessPhone,
  businessGovernorate,
  businessAddress,
  existingMedicines,
  onImportComplete,
  showToast,
}) => {
  const { language, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [fileName, setFileName] = useState('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Column Mappings
  const [mapping, setMapping] = useState<ColumnMapping>({
    name: '',
    nameAr: '',
    brand: '',
    activeIngredient: '',
    strength: '',
    dosageForm: '',
    packageSize: '',
    manufacturer: '',
    originCountry: '',
    barcode: '',
    qrCode: '',
    price: '',
    quantity: '',
    batchNumber: '',
    expiryDate: '',
    minStockAlert: '',
    requiresPrescription: '',
    notes: '',
  });

  // Conflict Resolution Preference
  const [conflictStrategy, setConflictStrategy] = useState<'update' | 'skip' | 'new_batch'>('update');
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'conflicts' | 'file_duplicates' | 'errors'>('all');

  // Parsed and validated items
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);

  // Execution Progress & Results
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<{ added: number; updated: number; skipped: number; failed: number } | null>(null);

  // Reset all state when closing
  const handleClose = () => {
    setStep('upload');
    setFileName('');
    setRawHeaders([]);
    setRawRows([]);
    setParsedRows([]);
    setImportResult(null);
    onClose();
  };

  // 1. Download Sample Templates
  const handleDownloadTemplate = (format: 'xlsx' | 'csv') => {
    let headers: Record<string, any>[];

    if (role === 'wholesaler') {
      headers = [
        {
          'اسم الدواء بالإنجليزية (Trade Name En)': 'Amoxicillin 500mg Capsules',
          'اسم الدواء بالعربية (Trade Name Ar)': 'أموكسيسيلين 500 مجم كبسول',
          'العلامة التجارية (Brand)': 'Amoxil',
          'المادة الفعالة (Active Ingredient)': 'Amoxicillin Trihydrate',
          'العيار (Strength)': '500mg',
          'الشكل الصيدلاني (Dosage Form)': 'Capsules (كبسولات)',
          'حجم العبوة (Package Size)': '20 Capsules / Box',
          'الشركة المصنعة (Manufacturer)': 'SDI Samarra',
          'بلد المنشأ (Origin Country)': 'Iraq (العراق)',
          'الباركود (Barcode)': '628100010101',
          'رمز QR (QR Code)': 'M737-AMX-500',
          'سعر الجملة بالدينار (Wholesale Price IQD)': 3500,
          'الكمية المتوفرة بالباكيت (Stock Quantity)': 500,
          'رقم التشغيلة (Batch Number)': 'LOT-2026-AM1',
          'تاريخ الصلاحية (Expiry Date YYYY-MM-DD)': '2028-06-30',
          'ملاحظات (Notes)': 'حفظ في مكان بارد وجاف',
        },
        {
          'اسم الدواء بالإنجليزية (Trade Name En)': 'Panadol Extra 500mg',
          'اسم الدواء بالعربية (Trade Name Ar)': 'بانادول إكسترا',
          'العلامة التجارية (Brand)': 'Panadol',
          'المادة الفعالة (Active Ingredient)': 'Paracetamol + Caffeine',
          'العيار (Strength)': '500mg/65mg',
          'الشكل الصيدلاني (Dosage Form)': 'Tablets (أقراص)',
          'حجم العبوة (Package Size)': '24 Tablets',
          'الشركة المصنعة (Manufacturer)': 'GSK',
          'بلد المنشأ (Origin Country)': 'UK',
          'الباركود (Barcode)': '5000347061234',
          'رمز QR (QR Code)': 'M737-PAN-EXT',
          'سعر الجملة بالدينار (Wholesale Price IQD)': 4200,
          'الكمية المتوفرة بالباكيت (Stock Quantity)': 1200,
          'رقم التشغيلة (Batch Number)': 'LOT-2026-PD9',
          'تاريخ الصلاحية (Expiry Date YYYY-MM-DD)': '2027-12-31',
          'ملاحظات (Notes)': 'مسكن ألم وخافض حرارة',
        }
      ];
    } else {
      headers = [
        {
          'اسم الدواء بالإنجليزية (Trade Name En)': 'Concor 5mg Tablets',
          'اسم الدواء بالعربية (Trade Name Ar)': 'كونكور 5 مجم',
          'العلامة التجارية (Brand)': 'Concor',
          'المادة الفعالة (Active Ingredient)': 'Bisoprolol Fumarate',
          'العيار (Strength)': '5mg',
          'الشكل الصيدلاني (Dosage Form)': 'Tablets (أقراص)',
          'حجم العبوة (Package Size)': '30 Tablets',
          'الشركة المصنعة (Manufacturer)': 'Merck KGaA',
          'الباركود (Barcode)': '4022536001234',
          'رمز QR (QR Code)': 'M737-CNC-5MG',
          'سعر البيع بالدينار (Retail Price IQD)': 8500,
          'الكمية المتوفرة (Stock Quantity)': 35,
          'تنبيه نقص المخزون (Min Stock Alert)': 5,
          'رقم التشغيلة (Batch Number)': 'LOT-2026-CC1',
          'تاريخ الصلاحية (Expiry Date YYYY-MM-DD)': '2027-10-31',
          'يتطلب وصفة طبية (Requires Prescription yes/no)': 'yes',
          'ملاحظات (Notes)': 'أدوية ضغط وقلب',
        },
        {
          'اسم الدواء بالإنجليزية (Trade Name En)': 'Augmentin 625mg',
          'اسم الدواء بالعربية (Trade Name Ar)': 'أوجمنتين 625 مجم',
          'العلامة التجارية (Brand)': 'Augmentin',
          'المادة الفعالة (Active Ingredient)': 'Amoxicillin + Clavulanic Acid',
          'العيار (Strength)': '625mg',
          'الشكل الصيدلاني (Dosage Form)': 'Tablets (أقراص)',
          'حجم العبوة (Package Size)': '20 Tablets',
          'الشركة المصنعة (Manufacturer)': 'GSK',
          'الباركود (Barcode)': '5000347012345',
          'رمز QR (QR Code)': 'M737-AUG-625',
          'سعر البيع بالدينار (Retail Price IQD)': 12000,
          'الكمية المتوفرة (Stock Quantity)': 50,
          'تنبيه نقص المخزون (Min Stock Alert)': 10,
          'رقم التشغيلة (Batch Number)': 'LOT-2026-AG2',
          'تاريخ الصلاحية (Expiry Date YYYY-MM-DD)': '2027-08-31',
          'يتطلب وصفة طبية (Requires Prescription yes/no)': 'yes',
          'ملاحظات (Notes)': 'مضاد حيوي واسع الطيف',
        }
      ];
    }

    const worksheet = XLSX.utils.json_to_sheet(headers);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicines');

    const downloadFileName = `M737IQ_${role === 'wholesaler' ? 'Wholesaler' : 'Pharmacy'}_Medicine_Template.${format}`;
    XLSX.writeFile(workbook, downloadFileName, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
  };

  // 2. Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          showToast(
            language === 'ar' ? 'الملف المرفوع فارغ أو لا يحتوي على صفوف بيانات.' : 'Uploaded file is empty or missing data rows.',
            'error'
          );
          return;
        }

        // Extract column headers
        const headerSet = new Set<string>();
        rawJson.forEach((row) => {
          Object.keys(row).forEach((k) => headerSet.add(k));
        });
        const headers = Array.from(headerSet);

        setRawHeaders(headers);
        setRawRows(rawJson);

        // Run Auto-Fuzzy Column Detection
        const detectedMapping: ColumnMapping = {
          name: autoDetectHeader(headers, ['name', 'trade', 'item', 'medicine', 'دواء', 'اسم الدواء', 'اسم']),
          nameAr: autoDetectHeader(headers, ['namear', 'arabic', 'عربي', 'الاسم بالعربي', 'اسم الدواء بالعربية']),
          brand: autoDetectHeader(headers, ['brand', 'ماركة', 'علامة', 'العلامة']),
          activeIngredient: autoDetectHeader(headers, ['ingredient', 'generic', 'active', 'المادة الفعالة', 'التركيب', 'مادة فعالة']),
          strength: autoDetectHeader(headers, ['strength', 'dose', 'عيار', 'العيار', 'التركيز', 'dosage']),
          dosageForm: autoDetectHeader(headers, ['form', 'dosageform', 'شكل', 'الشكل الصيدلاني', 'صيدلاني']),
          packageSize: autoDetectHeader(headers, ['size', 'package', 'pack', 'عبوة', 'حجم العبوة']),
          manufacturer: autoDetectHeader(headers, ['manufacturer', 'company', 'مصنع', 'الشركة المصنعة', 'شركة']),
          originCountry: autoDetectHeader(headers, ['country', 'origin', 'منشأ', 'بلد المنشأ', 'بلد']),
          barcode: autoDetectHeader(headers, ['barcode', 'باركود', 'كود', 'code', 'gtin', 'upc', 'ean']),
          qrCode: autoDetectHeader(headers, ['qr', 'qrcode', 'رمز qr', 'كيو ار']),
          price: autoDetectHeader(headers, ['price', 'سعر', 'سعر البيع', 'سعر الجملة', 'cost', 'wholesale']),
          quantity: autoDetectHeader(headers, ['quantity', 'qty', 'stock', 'كمية', 'الكمية', 'مخزون', 'رصيد']),
          batchNumber: autoDetectHeader(headers, ['batch', 'lot', 'تشغيلة', 'رقم التشغيلة', 'دفعة']),
          expiryDate: autoDetectHeader(headers, ['expiry', 'exp', 'صلاحية', 'تاريخ الصلاحية', 'انتهاء']),
          minStockAlert: autoDetectHeader(headers, ['alert', 'min', 'حد أدنى', 'نقص المخزون']),
          requiresPrescription: autoDetectHeader(headers, ['prescription', 'وصفة', 'روشتة', 'تتطلب وصفة']),
          notes: autoDetectHeader(headers, ['notes', 'ملاحظات', 'note', 'تعليق']),
        };

        setMapping(detectedMapping);
        setStep('mapping');
      } catch (err: any) {
        console.error('File parsing error:', err);
        showToast(
          language === 'ar' ? 'فشل قراءة الملف. يرجى التأكد من صيغة Excel (.xlsx) أو CSV صالحة.' : 'Failed to parse file. Please ensure valid Excel or CSV.',
          'error'
        );
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Helper for Auto Header Detection
  const autoDetectHeader = (available: string[], keywords: string[]): string => {
    for (const h of available) {
      const cleanH = h.toLowerCase().replace(/[\s_\-–/()]/g, '');
      for (const kw of keywords) {
        const cleanKw = kw.toLowerCase().replace(/[\s_\-–/()]/g, '');
        if (cleanH.includes(cleanKw)) {
          return h;
        }
      }
    }
    return '';
  };

  // 3. Process Rows from Mapping
  const processMappedRows = () => {
    // Build existing inventory lookup maps
    const existingByBarcode = new Map<string, any>();
    const existingByName = new Map<string, any>();

    existingMedicines.forEach((med) => {
      if (med.barcode && med.barcode.trim()) {
        existingByBarcode.set(med.barcode.trim().toLowerCase(), med);
      }
      if (med.qrCode && med.qrCode.trim()) {
        existingByBarcode.set(med.qrCode.trim().toLowerCase(), med);
      }
      const nameKey = `${(med.name || '').trim().toLowerCase()}|${(med.strength || '').trim().toLowerCase()}`;
      if (med.name) {
        existingByName.set(nameKey, med);
      }
    });

    const fileSeenBarcodes = new Set<string>();
    const fileSeenNames = new Set<string>();

    const rows: ParsedImportRow[] = rawRows.map((raw, idx) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Extract values according to mapping
      const name = mapping.name ? String(raw[mapping.name] || '').trim() : '';
      const nameAr = mapping.nameAr ? String(raw[mapping.nameAr] || '').trim() : '';
      const brand = mapping.brand ? String(raw[mapping.brand] || '').trim() : '';
      const activeIngredient = mapping.activeIngredient ? String(raw[mapping.activeIngredient] || '').trim() : '';
      const strength = mapping.strength ? String(raw[mapping.strength] || '').trim() : '';
      const dosageForm = mapping.dosageForm ? String(raw[mapping.dosageForm] || '').trim() : '';
      const packageSize = mapping.packageSize ? String(raw[mapping.packageSize] || '').trim() : '';
      const manufacturer = mapping.manufacturer ? String(raw[mapping.manufacturer] || '').trim() : '';
      const originCountry = mapping.originCountry ? String(raw[mapping.originCountry] || '').trim() : '';
      const barcode = mapping.barcode ? String(raw[mapping.barcode] || '').trim() : '';
      const qrCode = mapping.qrCode ? String(raw[mapping.qrCode] || '').trim() : '';
      const batchNumber = mapping.batchNumber ? String(raw[mapping.batchNumber] || '').trim() : '';
      const notes = mapping.notes ? String(raw[mapping.notes] || '').trim() : '';

      // Safe Numbers: Never invent missing data, require valid >= 0
      let price = 0;
      if (mapping.price && raw[mapping.price] !== undefined && raw[mapping.price] !== '') {
        const rawP = parseFloat(String(raw[mapping.price]).replace(/[^0-9.]/g, ''));
        if (isNaN(rawP) || rawP < 0) {
          errors.push(language === 'ar' ? 'السعر غير صالح' : 'Invalid price value');
        } else {
          price = rawP;
        }
      }

      let quantity = 0;
      if (mapping.quantity && raw[mapping.quantity] !== undefined && raw[mapping.quantity] !== '') {
        const rawQ = parseInt(String(raw[mapping.quantity]).replace(/[^0-9]/g, ''), 10);
        if (isNaN(rawQ) || rawQ < 0) {
          errors.push(language === 'ar' ? 'الكمية غير صالحة' : 'Invalid quantity value');
        } else {
          quantity = rawQ;
        }
      }

      let minStockAlert = 5;
      if (mapping.minStockAlert && raw[mapping.minStockAlert] !== '') {
        const parsedMin = parseInt(String(raw[mapping.minStockAlert]), 10);
        if (!isNaN(parsedMin) && parsedMin >= 0) minStockAlert = parsedMin;
      }

      // Safe Expiry Date Parsing
      let expiryDate = '';
      if (mapping.expiryDate && raw[mapping.expiryDate]) {
        const rawExp = raw[mapping.expiryDate];
        if (typeof rawExp === 'number') {
          // Excel serial date format
          try {
            const dateObj = XLSX.SSF.parse_date_code(rawExp);
            if (dateObj) {
              const y = dateObj.y;
              const m = String(dateObj.m).padStart(2, '0');
              const d = String(dateObj.d).padStart(2, '0');
              expiryDate = `${y}-${m}-${d}`;
            }
          } catch {
            // fallback
          }
        } else {
          const strExp = String(rawExp).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(strExp)) {
            expiryDate = strExp;
          } else if (/^\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}$/.test(strExp)) {
            // format MM/DD/YYYY or DD/MM/YYYY
            const parts = strExp.split(/[\/\.-]/);
            if (parts.length === 3) {
              let y = parseInt(parts[2], 10);
              if (y < 100) y += 2000;
              const m = String(parts[0]).padStart(2, '0');
              const d = String(parts[1]).padStart(2, '0');
              expiryDate = `${y}-${m}-${d}`;
            }
          } else {
            expiryDate = strExp;
          }
        }
      }

      // Requires Prescription boolean
      let requiresPrescription = false;
      if (mapping.requiresPrescription && raw[mapping.requiresPrescription]) {
        const strReq = String(raw[mapping.requiresPrescription]).toLowerCase();
        requiresPrescription = strReq === 'yes' || strReq === 'true' || strReq === '1' || strReq === 'نعم';
      }

      // Core Validations: Name is mandatory
      if (!name && !nameAr) {
        errors.push(language === 'ar' ? 'اسم الدواء (إنجليزي أو عربي) مطلوب' : 'Medicine name (English or Arabic) is required');
      }

      // Check conflict with existing inventory
      let isExistingConflict = false;
      let conflictItemId: string | undefined;

      const normBarcode = barcode.toLowerCase();
      const normName = `${name.toLowerCase()}|${strength.toLowerCase()}`;

      if (barcode && existingByBarcode.has(normBarcode)) {
        isExistingConflict = true;
        conflictItemId = existingByBarcode.get(normBarcode)?.id;
        warnings.push(
          language === 'ar' 
            ? `الباركود مسجل مسبقاً في مستودعك (${existingByBarcode.get(normBarcode)?.name})` 
            : `Barcode already in your inventory (${existingByBarcode.get(normBarcode)?.name})`
        );
      } else if (name && existingByName.has(normName)) {
        isExistingConflict = true;
        conflictItemId = existingByName.get(normName)?.id;
        warnings.push(
          language === 'ar' 
            ? `الدواء مسجل مسبقاً بنفس الاسم والعيار في مستودعك` 
            : `Medicine with same name and strength exists in your inventory`
        );
      }

      // Check in-file duplicates
      let isFileDuplicate = false;
      if (barcode) {
        if (fileSeenBarcodes.has(normBarcode)) {
          isFileDuplicate = true;
          warnings.push(language === 'ar' ? 'الباركود مكرر في أكثر من صف داخل نفس الملف' : 'Duplicate barcode found inside this file');
        } else {
          fileSeenBarcodes.add(normBarcode);
        }
      }
      if (name) {
        if (fileSeenNames.has(normName)) {
          warnings.push(language === 'ar' ? 'اسم الدواء والعيار مكرر داخل نفس الملف' : 'Duplicate medicine name inside this file');
        } else {
          fileSeenNames.add(normName);
        }
      }

      const isValid = errors.length === 0;

      // Determine default action based on conflict and user's strategy
      let action: 'create' | 'update' | 'skip' = 'create';
      if (isExistingConflict) {
        if (conflictStrategy === 'update') action = 'update';
        else if (conflictStrategy === 'skip') action = 'skip';
        else action = 'create'; // new batch
      }

      return {
        index: idx + 1,
        raw,
        name,
        nameAr,
        brand,
        activeIngredient,
        strength,
        dosageForm,
        packageSize,
        manufacturer,
        originCountry,
        barcode,
        qrCode,
        price,
        quantity,
        batchNumber,
        expiryDate,
        minStockAlert,
        requiresPrescription,
        notes,
        isValid,
        isExistingConflict,
        conflictItemId,
        isFileDuplicate,
        errors,
        warnings,
        action,
      };
    });

    setParsedRows(rows);
    setStep('preview');
  };

  // Update conflict strategies across rows
  const handleApplyConflictStrategy = (strat: 'update' | 'skip' | 'new_batch') => {
    setConflictStrategy(strat);
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.isExistingConflict) {
          if (strat === 'update') return { ...row, action: 'update' };
          if (strat === 'skip') return { ...row, action: 'skip' };
          if (strat === 'new_batch') return { ...row, action: 'create' };
        }
        return row;
      })
    );
  };

  // Inline row edits
  const handleUpdateRowField = (index: number, field: keyof ParsedImportRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((r) => {
        if (r.index === index) {
          const updated = { ...r, [field]: value };
          // Re-evaluate validity
          const newErrors: string[] = [];
          if (!updated.name && !updated.nameAr) {
            newErrors.push(language === 'ar' ? 'اسم الدواء مطلوب' : 'Medicine name is required');
          }
          if (updated.price < 0) {
            newErrors.push(language === 'ar' ? 'السعر غير صالح' : 'Invalid price');
          }
          if (updated.quantity < 0) {
            newErrors.push(language === 'ar' ? 'الكمية غير صالحة' : 'Invalid quantity');
          }
          updated.errors = newErrors;
          updated.isValid = newErrors.length === 0;
          return updated;
        }
        return r;
      })
    );
  };

  // Filtered Rows for Preview Table
  const filteredRows = useMemo(() => {
    if (filterView === 'valid') return parsedRows.filter((r) => r.isValid && !r.isExistingConflict);
    if (filterView === 'conflicts') return parsedRows.filter((r) => r.isExistingConflict);
    if (filterView === 'file_duplicates') return parsedRows.filter((r) => r.isFileDuplicate);
    if (filterView === 'errors') return parsedRows.filter((r) => !r.isValid);
    return parsedRows;
  }, [parsedRows, filterView]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter((r) => r.isValid).length;
    const conflicts = parsedRows.filter((r) => r.isExistingConflict).length;
    const fileDuplicates = parsedRows.filter((r) => r.isFileDuplicate).length;
    const errors = parsedRows.filter((r) => !r.isValid).length;

    const toAdd = parsedRows.filter((r) => r.isValid && r.action === 'create').length;
    const toUpdate = parsedRows.filter((r) => r.isValid && r.action === 'update').length;
    const toSkip = parsedRows.filter((r) => r.action === 'skip' || !r.isValid).length;

    return { total, valid, conflicts, fileDuplicates, errors, toAdd, toUpdate, toSkip };
  }, [parsedRows]);

  // 4. Safe Batch Import Execution
  const handleExecuteImport = async () => {
    setStep('importing');
    setImportProgress({ current: 0, total: parsedRows.length });

    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const targetCollection = role === 'wholesaler' ? 'wholesale_medicines' : 'medicines';
    const now = new Date().toISOString();

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      setImportProgress({ current: i + 1, total: parsedRows.length });

      if (!row.isValid || row.action === 'skip') {
        skippedCount++;
        continue;
      }

      try {
        if (row.action === 'update' && row.conflictItemId) {
          // Update Existing Document
          const docRef = doc(db, targetCollection, row.conflictItemId);
          
          if (role === 'wholesaler') {
            const updatePayload: Record<string, any> = {
              wholesalePriceIqd: row.price,
              stockPacks: row.quantity,
              updatedAt: now,
            };
            if (row.batchNumber) updatePayload.batchNumber = row.batchNumber;
            if (row.expiryDate) updatePayload.expiryDate = row.expiryDate;
            if (row.barcode) updatePayload.barcode = row.barcode;
            if (row.qrCode) updatePayload.qrCode = row.qrCode;
            if (row.notes) updatePayload.notes = row.notes;

            await updateDoc(docRef, sanitizeForFirestore(updatePayload));
          } else {
            // Pharmacy update
            const updatePayload: Record<string, any> = {
              price: row.price,
              quantity: row.quantity,
              updatedAt: now,
            };
            if (row.batchNumber) updatePayload.batchNumber = row.batchNumber;
            if (row.expiryDate) updatePayload.expiryDate = row.expiryDate;
            if (row.barcode) updatePayload.barcode = row.barcode;
            if (row.qrCode) updatePayload.qrCode = row.qrCode;
            if (row.minStockAlert) updatePayload.minStockAlert = row.minStockAlert;
            if (row.notes) updatePayload.notes = row.notes;

            await updateDoc(docRef, sanitizeForFirestore(updatePayload));
          }
          updatedCount++;
        } else {
          // Create New Document
          const newDocId = `${role === 'wholesaler' ? 'wh_med' : 'med'}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const docRef = doc(db, targetCollection, newDocId);

          if (role === 'wholesaler') {
            const newWholesaleMedicine = {
              id: newDocId,
              wholesalerId: userId,
              wholesalerName: businessName,
              wholesalerPhone: businessPhone || '',
              name: row.name || row.nameAr,
              nameAr: row.nameAr || '',
              brand: row.brand || '',
              activeIngredient: row.activeIngredient || 'Generic / غير محدد',
              manufacturer: row.manufacturer || 'مكتب علمي معتمد',
              originCountry: row.originCountry || 'العراق (Iraq)',
              strength: row.strength || 'Standard',
              dosageForm: row.dosageForm || 'Tablets (أقراص)',
              packSize: row.packageSize || 'Pack',
              packageSize: row.packageSize || 'Pack',
              cartonCapacity: 30,
              batchNumber: row.batchNumber || `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}`,
              productionDate: now.split('T')[0],
              expiryDate: row.expiryDate || new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              wholesalePriceIqd: row.price,
              stockPacks: row.quantity,
              quantity: row.quantity,
              minOrderQuantity: 1,
              isAvailable: row.quantity > 0,
              barcode: row.barcode || '',
              qrCode: row.qrCode || '',
              category: 'General (عام)',
              notes: row.notes || '',
              createdAt: now,
              updatedAt: now,
            };

            await setDoc(docRef, sanitizeForFirestore(newWholesaleMedicine));
          } else {
            // Pharmacy create
            const newPharmacyMedicine = {
              id: newDocId,
              pharmacyId: userId,
              pharmacyName: businessName,
              pharmacyPhone: businessPhone || '',
              pharmacyGovernorate: businessGovernorate || '',
              pharmacyAddress: businessAddress || '',
              name: row.name || row.nameAr,
              nameAr: row.nameAr || '',
              brand: row.brand || '',
              activeIngredient: row.activeIngredient || 'Generic / غير محدد',
              manufacturer: row.manufacturer || 'شركة معتمدة',
              strength: row.strength || 'Standard',
              dosageForm: row.dosageForm || 'Tablets (أقراص)',
              packageSize: row.packageSize || 'Standard Pack',
              price: row.price,
              quantity: row.quantity,
              minStockAlert: row.minStockAlert || 5,
              expiryDate: row.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              batchNumber: row.batchNumber || '',
              barcode: row.barcode || '',
              qrCode: row.qrCode || '',
              requiresPrescription: row.requiresPrescription,
              isAvailable: row.quantity > 0,
              notes: row.notes || '',
              createdAt: now,
              updatedAt: now,
            };

            await setDoc(docRef, sanitizeForFirestore(newPharmacyMedicine));
          }
          addedCount++;
        }
      } catch (err) {
        console.warn(`Import failed on row ${row.index}:`, err);
        failedCount++;
      }
    }

    // Audit Logging
    try {
      await logAuditEvent({
        action: 'medicine_bulk_excel_import',
        category: role === 'wholesaler' ? 'wholesale_b2b' : 'pharmacy_inventory',
        actorUid: userId,
        actorName: businessName,
        actorRole: role,
        resourceId: fileName,
        status: failedCount > 0 && addedCount === 0 ? 'failure' : 'success',
        details: `Import results for ${fileName}: Added=${addedCount}, Updated=${updatedCount}, Skipped=${skippedCount}, Failed=${failedCount}`,
      });
    } catch {
      // non-blocking
    }

    setImportResult({ added: addedCount, updated: updatedCount, skipped: skippedCount, failed: failedCount });
    setStep('complete');
    await onImportComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-md">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {language === 'ar' ? 'معالج الاستيراد الآمن للأدوية (Excel & CSV)' : 'Safe Medicine Bulk Import Wizard'}
              </h2>
              <p className="text-xs text-emerald-100">
                {role === 'wholesaler' 
                  ? (language === 'ar' ? `استيراد كتالوج المذخر: ${businessName}` : `Wholesaler Inventory Import: ${businessName}`) 
                  : (language === 'ar' ? `استيراد رصيد الصيدلية: ${businessName}` : `Pharmacy Stock Import: ${businessName}`)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 py-3 text-xs font-semibold gap-4 shrink-0 overflow-x-auto">
          <div className={`flex items-center gap-2 ${step === 'upload' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'upload' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>1</span>
            <span>{language === 'ar' ? 'رفع الملف' : 'Upload File'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 self-center shrink-0" />
          <div className={`flex items-center gap-2 ${step === 'mapping' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'mapping' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>2</span>
            <span>{language === 'ar' ? 'مطابقة الأعمدة' : 'Map Columns'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 self-center shrink-0" />
          <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'preview' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>3</span>
            <span>{language === 'ar' ? 'المعاينة وفحص التعارض' : 'Preview & Validate'}</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300 self-center shrink-0" />
          <div className={`flex items-center gap-2 ${step === 'importing' || step === 'complete' ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-200'}`}>4</span>
            <span>{language === 'ar' ? 'التنفيذ والتقرير' : 'Execution & Report'}</span>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Instructions and Download Templates */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    {language === 'ar' ? 'تحميل نموذج جاهز متوافق مع النظام' : 'Download Pre-formatted Template'}
                  </h3>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-xl">
                    {language === 'ar'
                      ? 'يمكنك تنزيل نموذج يحتوي على كافة الحقول الطبية المعتمدة (الاسم، الباركود، المادة الفعالة، العيار، السعر، ورقم التشغيلة) لتعبئتها ورفعها مباشرة.'
                      : 'Download a spreadsheet template with verified medical columns (Name, Barcode, Active Ingredient, Strength, Price, Batch).'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Drag & Drop Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-3xl p-8 sm:p-12 text-center bg-emerald-50/30 hover:bg-emerald-50/60 transition-all cursor-pointer space-y-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-inner">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm sm:text-base">
                    {language === 'ar' ? 'انقر لاختيار ملف الأدوية، أو اسحبه هنا' : 'Click to choose medicine file, or drag and drop here'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar' ? 'يدعم ملفات Excel (.xlsx, .xls) وجداول CSV المعتمدة' : 'Supports Excel (.xlsx, .xls) and CSV spreadsheets'}
                  </p>
                </div>
              </div>

              {/* Multi-Tenant Safety Rules Note */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 text-xs space-y-2">
                <span className="font-bold text-slate-900 block flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-emerald-600" />
                  {language === 'ar' ? 'ضوابط الخصوصية والأمان الصيدلاني M737IQ:' : 'M737IQ Multi-tenant & Security Principles:'}
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>{language === 'ar' ? 'الأدوية المستوردة ترتبط حصراً برقم حسابك ولن تظهر أسعارك أو كمياتك للمنافسين.' : 'Imported medicines strictly belong to your account; private stock & prices are isolated.'}</li>
                  <li>{language === 'ar' ? 'لن يتم حذف أي بيانات قديمة أو استبدالها دون مراجعة وتأكيد مسبق منك في الخطوة القادمة.' : 'Existing records are never silently overwritten without explicit conflict resolution.'}</li>
                  <li>{language === 'ar' ? 'النظام لا يختلق أي بيانات مفقودة؛ الحقول غير المتوفرة تبقى فارغة لمراجعتها يدوياً.' : 'Missing data is never invented; incomplete fields are preserved for manual review.'}</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {language === 'ar' ? 'مطابقة أعمدة الملف المرفوع مع حقول المنصة' : 'Map Uploaded File Columns to Fields'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'ar' ? `الملف: ${fileName} (${rawRows.length} صفاً، ${rawHeaders.length} عموداً)` : `File: ${fileName} (${rawRows.length} rows, ${rawHeaders.length} columns)`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 border border-slate-300 rounded-xl bg-white"
                >
                  {language === 'ar' ? 'تغيير الملف' : 'Change File'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name EN */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'اسم الدواء (إنجليزي) *' : 'Trade Name (English) *'}
                  </label>
                  <select
                    value={mapping.name}
                    onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '— اختر العمود —' : '— Select Column —'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Name AR */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'اسم الدواء (عربي)' : 'Trade Name (Arabic)'}
                  </label>
                  <select
                    value={mapping.nameAr}
                    onChange={(e) => setMapping({ ...mapping, nameAr: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Barcode */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'الباركود (Barcode / EAN / GTIN)' : 'Barcode'}
                  </label>
                  <select
                    value={mapping.barcode}
                    onChange={(e) => setMapping({ ...mapping, barcode: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* QR Code */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'رمز QR / كود التتبع' : 'QR Code Value'}
                  </label>
                  <select
                    value={mapping.qrCode}
                    onChange={(e) => setMapping({ ...mapping, qrCode: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Active Ingredient */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'المادة الفعالة (Active Ingredient)' : 'Active Ingredient'}
                  </label>
                  <select
                    value={mapping.activeIngredient}
                    onChange={(e) => setMapping({ ...mapping, activeIngredient: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Strength */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'العيار والتركيز (Strength)' : 'Strength'}
                  </label>
                  <select
                    value={mapping.strength}
                    onChange={(e) => setMapping({ ...mapping, strength: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Dosage Form */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'الشكل الصيدلاني (Dosage Form)' : 'Dosage Form'}
                  </label>
                  <select
                    value={mapping.dosageForm}
                    onChange={(e) => setMapping({ ...mapping, dosageForm: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Package Size */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'حجم العبوة (Package Size)' : 'Package Size'}
                  </label>
                  <select
                    value={mapping.packageSize}
                    onChange={(e) => setMapping({ ...mapping, packageSize: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Manufacturer */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'الشركة المصنعة (Manufacturer)' : 'Manufacturer'}
                  </label>
                  <select
                    value={mapping.manufacturer}
                    onChange={(e) => setMapping({ ...mapping, manufacturer: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Price */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {role === 'wholesaler' 
                      ? (language === 'ar' ? 'سعر الجملة بالدينار (Wholesale Price IQD) *' : 'Wholesale Price IQD *') 
                      : (language === 'ar' ? 'سعر البيع بالدينار (Retail Price IQD) *' : 'Retail Price IQD *')}
                  </label>
                  <select
                    value={mapping.price}
                    onChange={(e) => setMapping({ ...mapping, price: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '— اختر العمود —' : '— Select Column —'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'الكمية المتوفرة (Stock Quantity) *' : 'Available Stock Quantity *'}
                  </label>
                  <select
                    value={mapping.quantity}
                    onChange={(e) => setMapping({ ...mapping, quantity: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '— اختر العمود —' : '— Select Column —'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Batch Number */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'رقم التشغيلة (Batch / Lot Number)' : 'Batch Number'}
                  </label>
                  <select
                    value={mapping.batchNumber}
                    onChange={(e) => setMapping({ ...mapping, batchNumber: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>

                {/* Expiry Date */}
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-1">
                  <label className="block text-xs font-bold text-slate-800">
                    {language === 'ar' ? 'تاريخ الصلاحية (Expiry Date)' : 'Expiry Date'}
                  </label>
                  <select
                    value={mapping.expiryDate}
                    onChange={(e) => setMapping({ ...mapping, expiryDate: e.target.value })}
                    className="w-full py-1.5 px-3 rounded-xl border border-slate-300 text-xs font-medium bg-white"
                  >
                    <option value="">{language === 'ar' ? '(اختياري / غير متوفر)' : '(Optional / None)'}</option>
                    {rawHeaders.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                >
                  {language === 'ar' ? 'السابق' : 'Back'}
                </button>
                <button
                  type="button"
                  onClick={processMappedRows}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                >
                  <span>{language === 'ar' ? 'متابعة وفحص البيانات والتعارض' : 'Continue to Validation & Preview'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {step === 'preview' && (
            <div className="space-y-5">
              
              {/* Conflict Strategy Toolbar */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      {language === 'ar' ? 'سياسة التعامل مع الأدوية المسجلة مسبقاً في مستودعك:' : 'Conflict Policy for Existing Items:'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'ar' 
                        ? 'اختر الإجراء الافتراضي عند وجود تطابق في الباركود أو اسم الدواء والعيار مع المخزون الحالي' 
                        : 'Choose action when uploaded medicine matches an item already in your stock'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyConflictStrategy('update')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        conflictStrategy === 'update'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {language === 'ar' ? 'تحديث السعر والرصيد' : 'Update Stock & Price'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyConflictStrategy('skip')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        conflictStrategy === 'skip'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {language === 'ar' ? 'تخطي المطابق' : 'Skip Existing'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApplyConflictStrategy('new_batch')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        conflictStrategy === 'new_batch'
                          ? 'bg-cyan-600 text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {language === 'ar' ? 'إضافة كتشغيلة إضافية' : 'Add as New Batch'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Counters / Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setFilterView('all')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filterView === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[10px] opacity-75">{language === 'ar' ? 'كافة الصفوف' : 'Total Rows'}</span>
                  <span className="text-lg font-bold">{metrics.total}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView('valid')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filterView === 'valid' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70'
                  }`}
                >
                  <span className="block text-[10px] opacity-75">{language === 'ar' ? 'جاهز كصنف جديد' : 'Ready to Add'}</span>
                  <span className="text-lg font-bold">{metrics.toAdd}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView('conflicts')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filterView === 'conflicts' ? 'bg-cyan-700 text-white border-cyan-700 shadow-sm' : 'bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100/70'
                  }`}
                >
                  <span className="block text-[10px] opacity-75">{language === 'ar' ? 'تعارض مع المخزون' : 'Stock Matches'}</span>
                  <span className="text-lg font-bold">{metrics.conflicts}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView('file_duplicates')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filterView === 'file_duplicates' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100/70'
                  }`}
                >
                  <span className="block text-[10px] opacity-75">{language === 'ar' ? 'تكرار في الملف' : 'File Duplicates'}</span>
                  <span className="text-lg font-bold">{metrics.fileDuplicates}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterView('errors')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    filterView === 'errors' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100/70'
                  }`}
                >
                  <span className="block text-[10px] opacity-75">{language === 'ar' ? 'بيانات غير صالحة' : 'Invalid Rows'}</span>
                  <span className="text-lg font-bold">{metrics.errors}</span>
                </button>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-inner bg-white">
                <div className="max-h-72 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs text-right divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'الحالة والإجراء' : 'Status & Action'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'اسم الدواء' : 'Medicine Name'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'الباركود' : 'Barcode'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'المادة الفعالة' : 'Active Ingredient'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'العيار' : 'Strength'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'السعر' : 'Price'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'الصلاحية' : 'Expiry'}</th>
                        <th className="py-2.5 px-3">{language === 'ar' ? 'تعديل' : 'Edit'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-slate-400">
                            {language === 'ar' ? 'لا توجد صفوف تطابق هذا الفلتر' : 'No rows match this filter'}
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row) => (
                          <tr key={row.index} className={`hover:bg-slate-50/80 ${!row.isValid ? 'bg-rose-50/30' : ''}`}>
                            <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">{row.index}</td>
                            
                            <td className="py-2 px-3 whitespace-nowrap">
                              {!row.isValid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={row.errors.join(' | ')}>
                                  <XCircle className="w-3 h-3 shrink-0" />
                                  <span>{language === 'ar' ? 'خطأ' : 'Error'}</span>
                                </span>
                              ) : row.action === 'update' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800">
                                  <RefreshCw className="w-3 h-3 shrink-0" />
                                  <span>{language === 'ar' ? 'تحديث' : 'Update'}</span>
                                </span>
                              ) : row.action === 'skip' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                  <span>{language === 'ar' ? 'تخطي' : 'Skip'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <Check className="w-3 h-3 shrink-0" />
                                  <span>{language === 'ar' ? 'إضافة' : 'Create'}</span>
                                </span>
                              )}
                            </td>

                            <td className="py-2 px-3 font-bold text-slate-900">
                              {editingRowIndex === row.index ? (
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={(e) => handleUpdateRowField(row.index, 'name', e.target.value)}
                                  className="w-full py-1 px-2 border rounded text-xs"
                                />
                              ) : (
                                <span>{row.name || row.nameAr || '—'}</span>
                              )}
                              {row.warnings.length > 0 && (
                                <span className="block text-[10px] text-amber-600 font-normal">{row.warnings[0]}</span>
                              )}
                            </td>

                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {editingRowIndex === row.index ? (
                                <input
                                  type="text"
                                  value={row.barcode}
                                  onChange={(e) => handleUpdateRowField(row.index, 'barcode', e.target.value)}
                                  className="w-full py-1 px-2 border rounded text-xs font-mono"
                                />
                              ) : (
                                <span>{row.barcode || '—'}</span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-slate-600">{row.activeIngredient || '—'}</td>
                            <td className="py-2 px-3 text-slate-600">{row.strength || '—'}</td>

                            <td className="py-2 px-3 font-bold">
                              {editingRowIndex === row.index ? (
                                <input
                                  type="number"
                                  value={row.price}
                                  onChange={(e) => handleUpdateRowField(row.index, 'price', parseFloat(e.target.value) || 0)}
                                  className="w-20 py-1 px-2 border rounded text-xs"
                                />
                              ) : (
                                <span>{row.price} د.ع</span>
                              )}
                            </td>

                            <td className="py-2 px-3 font-bold">
                              {editingRowIndex === row.index ? (
                                <input
                                  type="number"
                                  value={row.quantity}
                                  onChange={(e) => handleUpdateRowField(row.index, 'quantity', parseInt(e.target.value, 10) || 0)}
                                  className="w-16 py-1 px-2 border rounded text-xs"
                                />
                              ) : (
                                <span>{row.quantity}</span>
                              )}
                            </td>

                            <td className="py-2 px-3 text-[11px] text-slate-600">{row.expiryDate || '—'}</td>

                            <td className="py-2 px-3">
                              <button
                                type="button"
                                onClick={() => setEditingRowIndex(editingRowIndex === row.index ? null : row.index)}
                                className="p-1 rounded hover:bg-slate-200 text-slate-600"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution Summary Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-600">
                  <span>{language === 'ar' ? 'حصيلة التنفيذ المتوقعة: ' : 'Planned outcome: '}</span>
                  <span className="font-bold text-emerald-700">+{metrics.toAdd} {language === 'ar' ? 'إضافة' : 'Add'}</span>
                  <span> ، </span>
                  <span className="font-bold text-cyan-700">~{metrics.toUpdate} {language === 'ar' ? 'تحديث' : 'Update'}</span>
                  <span> ، </span>
                  <span className="font-bold text-slate-500">-{metrics.toSkip} {language === 'ar' ? 'تخطي' : 'Skip'}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('mapping')}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold"
                  >
                    {language === 'ar' ? 'تعديل الأعمدة' : 'Adjust Mapping'}
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={metrics.toAdd === 0 && metrics.toUpdate === 0}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === 'ar' ? 'تأكيد وحفظ الأدوية في قاعدة البيانات' : 'Confirm & Save to Database'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* STEP 4: IMPORTING IN PROGRESS */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
              <h3 className="text-base font-bold text-slate-900">
                {language === 'ar' ? 'جاري حفظ الأدوية في قاعدة بيانات Firestore...' : 'Saving medicines to Firestore database...'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? `تمت معالجة ${importProgress.current} من أصل ${importProgress.total} صنف`
                  : `Processed ${importProgress.current} of ${importProgress.total} items`}
              </p>
              <div className="w-full max-w-md mx-auto bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-emerald-600 h-full transition-all duration-300"
                  style={{ width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETE & AUDIT REPORT */}
          {step === 'complete' && importResult && (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {language === 'ar' ? 'اكتملت عملية الاستيراد بنجاح!' : 'Bulk Import Completed Successfully!'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ar'
                    ? 'تم تسجيل الحدث في سجل التدقيق الأمني لمنصة M737IQ'
                    : 'Event recorded in M737IQ security audit trail.'}
                </p>
              </div>

              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto text-center text-xs">
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block font-semibold">{language === 'ar' ? 'تمت الإضافة' : 'Added'}</span>
                  <span className="text-xl font-bold text-emerald-900">{importResult.added}</span>
                </div>
                <div className="p-3 bg-cyan-50 rounded-2xl border border-cyan-200">
                  <span className="text-[10px] text-cyan-700 block font-semibold">{language === 'ar' ? 'تم التحديث' : 'Updated'}</span>
                  <span className="text-xl font-bold text-cyan-900">{importResult.updated}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-[10px] text-slate-600 block font-semibold">{language === 'ar' ? 'تم التخطي' : 'Skipped'}</span>
                  <span className="text-xl font-bold text-slate-800">{importResult.skipped}</span>
                </div>
                <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200">
                  <span className="text-[10px] text-rose-700 block font-semibold">{language === 'ar' ? 'فشل' : 'Failed'}</span>
                  <span className="text-xl font-bold text-rose-900">{importResult.failed}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-lg transition-transform active:scale-95"
              >
                {language === 'ar' ? 'العودة إلى إدارة المستودع' : 'Back to Inventory Management'}
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
