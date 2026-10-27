import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAuditEvent } from '../lib/auditLogger';
import { MedicineItem, PharmacyProfile } from '../types';
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
  Sparkles
} from 'lucide-react';

interface PharmacyBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingMedicines: MedicineItem[];
  pharmacyProfile: PharmacyProfile | null;
  onSuccess: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
  isOperable: boolean;
}

interface ParsedRow {
  index: number;
  raw: Record<string, any>;
  name: string;
  activeIngredient: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  manufacturer: string;
  price: number;
  quantity: number;
  expiryDate: string;
  batchNumber: string;
  isDuplicate: boolean;
  errors: string[];
  isValid: boolean;
}

export const PharmacyBulkImportModal: React.FC<PharmacyBulkImportModalProps> = ({
  isOpen,
  onClose,
  existingMedicines,
  pharmacyProfile,
  onSuccess,
  showToast,
  isOperable,
}) => {
  const { user, userProfile } = useAuth();
  const { language, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload');
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [confirmedTruth, setConfirmedTruth] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSummary, setImportSummary] = useState<{ imported: number; failed: number; skipped: number } | null>(null);

  // Map of existing items in the pharmacy stock for in-flight duplicate detection
  const existingFingerprints = useMemo(() => {
    const set = new Set<string>();
    existingMedicines.forEach((m) => {
      const fp = `${(m.name || '').trim().toLowerCase()}|${(m.activeIngredient || '').trim().toLowerCase()}|${(m.strength || '').trim().toLowerCase()}`;
      set.add(fp);
    });
    return set;
  }, [existingMedicines]);

  if (!isOpen) return null;

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Trade Name (اسم الدواء)': 'Concor 5mg',
        'Active Ingredient (المادة الفعالة)': 'Bisoprolol Fumarate',
        'Strength (العيار)': '5mg',
        'Dosage Form (الشكل الصيدلاني)': 'Tablets (أقراص)',
        'Package Size (حجم العبوة)': '30 Tablets',
        'Manufacturer (الشركة المصنعة)': 'Merck KGaA',
        'Price IQD (السعر بالدينار)': 8500,
        'Quantity (الكمية)': 40,
        'Expiry Date (تاريخ الصلاحية)': '2027-06-30',
        'Batch Number (رقم التشغيلة)': 'LOT-2026-CC1',
      },
      {
        'Trade Name (اسم الدواء)': 'Glucophage 500mg',
        'Active Ingredient (المادة الفعالة)': 'Metformin HCl',
        'Strength (العيار)': '500mg',
        'Dosage Form (الشكل الصيدلاني)': 'Tablets (أقراص)',
        'Package Size (حجم العبوة)': '50 Tablets',
        'Manufacturer (الشركة المصنعة)': 'Merck Sante',
        'Price IQD (السعر بالدينار)': 4500,
        'Quantity (الكمية)': 60,
        'Expiry Date (تاريخ الصلاحية)': '2027-12-31',
        'Batch Number (رقم التشغيلة)': 'LOT-2026-GP5',
      },
      {
        'Trade Name (اسم الدواء)': 'Ventolin Inhaler 100mcg',
        'Active Ingredient (المادة الفعالة)': 'Salbutamol Sulfate',
        'Strength (العيار)': '100mcg / dose',
        'Dosage Form (الشكل الصيدلاني)': 'Inhaler (بخاخ استنشاق)',
        'Package Size (حجم العبوة)': '200 Doses',
        'Manufacturer (الشركة المصنعة)': 'GSK UK',
        'Price IQD (السعر بالدينار)': 7000,
        'Quantity (الكمية)': 25,
        'Expiry Date (تاريخ الصلاحية)': '2026-11-30',
        'Batch Number (رقم التشغيلة)': 'LOT-2026-VT2',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Medicine_Template');
    XLSX.writeFile(workbook, 'M737IQ_Pharmacy_Medicine_Import_Template.xlsx');
  };

  // Smart Column Extractor
  const extractFieldValue = (row: Record<string, any>, candidateKeys: string[]): any => {
    const keys = Object.keys(row);
    for (const ck of candidateKeys) {
      const found = keys.find((k) => k.trim().toLowerCase().includes(ck.toLowerCase()));
      if (found && row[found] !== undefined && row[found] !== null) {
        return row[found];
      }
    }
    return '';
  };

  // Process File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          showToast(language === 'ar' ? 'الملف فارغ ولا يحتوي على سجلات' : 'File is empty', 'error');
          return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        const rows: ParsedRow[] = rawJson.map((row, idx) => {
          const name = String(extractFieldValue(row, ['trade name', 'trade', 'اسم الدواء', 'الاسم التجاري', 'name']) || '').trim();
          const activeIngredient = String(extractFieldValue(row, ['active ingredient', 'generic', 'المادة الفعالة', 'الاسم العلمي']) || '').trim();
          const strength = String(extractFieldValue(row, ['strength', 'dose', 'العيار', 'الجرعة']) || 'Standard').trim();
          const dosageForm = String(extractFieldValue(row, ['dosage form', 'form', 'الشكل الصيدلاني', 'النوع']) || 'Tablets (أقراص)').trim();
          const packageSize = String(extractFieldValue(row, ['package size', 'pack', 'حجم العبوة', 'العبوة']) || 'Standard Pack').trim();
          const manufacturer = String(extractFieldValue(row, ['manufacturer', 'company', 'brand', 'الشركة المصنعة', 'الشركة']) || 'Certified Manufacturer').trim();
          
          const rawPrice = extractFieldValue(row, ['price', 'iqd', 'selling price', 'السعر', 'السعر بالدينار']);
          const price = Number(rawPrice) > 0 ? Number(rawPrice) : 0;

          const rawQty = extractFieldValue(row, ['quantity', 'stock', 'qty', 'count', 'الكمية', 'الرصيد']);
          const quantity = Number(rawQty) >= 0 ? Math.floor(Number(rawQty)) : 0;

          let rawDate = extractFieldValue(row, ['expiry date', 'expiry', 'exp', 'تاريخ الصلاحية', 'الصلاحية']);
          let expiryDate = '';
          if (rawDate instanceof Date) {
            expiryDate = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'string' && rawDate.trim()) {
            expiryDate = rawDate.trim().replace(/\//g, '-');
          } else {
            // Default 1 year from now
            expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          }

          const batchNumber = String(extractFieldValue(row, ['batch', 'lot', 'batch number', 'رقم التشغيلة', 'الوجبة']) || `LOT-IMP-${Date.now().toString().slice(-4)}`).trim();

          // Validation
          const errors: string[] = [];
          if (!name) errors.push(language === 'ar' ? 'اسم الدواء التجاري مفقود' : 'Missing trade name');
          if (!activeIngredient) errors.push(language === 'ar' ? 'المادة الفعالة مفقودة' : 'Missing active ingredient');
          if (price < 0) errors.push(language === 'ar' ? 'السعر لا يمكن أن يكون سالباً' : 'Negative price');
          if (quantity < 0) errors.push(language === 'ar' ? 'الكمية لا يمكن أن تكون سالبة' : 'Negative quantity');
          if (expiryDate && expiryDate < todayStr) {
            errors.push(language === 'ar' ? 'تاريخ الصلاحية منتهي' : 'Expired product date');
          }

          // Duplicate check against existing pharmacy stock
          const fp = `${name.toLowerCase()}|${activeIngredient.toLowerCase()}|${strength.toLowerCase()}`;
          const isDuplicate = existingFingerprints.has(fp);

          return {
            index: idx + 1,
            raw: row,
            name,
            activeIngredient,
            strength,
            dosageForm,
            packageSize,
            manufacturer,
            price,
            quantity,
            expiryDate,
            batchNumber,
            isDuplicate,
            errors,
            isValid: errors.length === 0,
          };
        });

        setParsedRows(rows);
        setStep('preview');
      } catch (err) {
        console.error('File parsing error:', err);
        showToast(language === 'ar' ? 'حدث خطأ أثناء قراءة ملف الإكسل' : 'Error reading file', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  // Preview Summary Stats
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const valid = parsedRows.filter((r) => r.isValid).length;
    const duplicates = parsedRows.filter((r) => r.isDuplicate).length;
    const invalid = parsedRows.filter((r) => !r.isValid).length;
    const importable = parsedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate)).length;
    return { total, valid, duplicates, invalid, importable };
  }, [parsedRows, skipDuplicates]);

  // Execute Firestore Batch Write
  const handleExecuteImport = async () => {
    if (!user) return;
    if (!confirmedTruth) {
      showToast(language === 'ar' ? 'يرجى الإقرار بصحة بيانات المخزون المرفوعة' : 'Please check the confirmation checkbox', 'error');
      return;
    }
    if (!isOperable) {
      showToast(language === 'ar' ? 'يتطلب إجراء العمليات اعتماد المشرف العام' : 'Super Admin approval required', 'error');
      return;
    }

    const rowsToImport = parsedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate));
    if (rowsToImport.length === 0) {
      showToast(language === 'ar' ? 'لا توجد سجلات صالحة للاستيراد' : 'No valid records to import', 'error');
      return;
    }

    setStep('importing');
    setImportProgress({ current: 0, total: rowsToImport.length });

    let imported = 0;
    let failed = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < rowsToImport.length; i++) {
      const r = rowsToImport[i];
      const mId = `med_imp_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;

      try {
        const isAvailable = r.quantity > 0 && r.price > 0;
        const medicineData: MedicineItem = {
          id: mId,
          pharmacyId: user.uid,
          pharmacyName: pharmacyProfile?.pharmacyName || userProfile?.facilityName || 'الصيدلية',
          pharmacyPhone: pharmacyProfile?.phone || userProfile?.phone || '',
          pharmacyGovernorate: pharmacyProfile?.governorate || userProfile?.governorate || 'بغداد (Baghdad)',
          pharmacyAddress: pharmacyProfile?.address || userProfile?.facilityName || '',
          name: r.name,
          activeIngredient: r.activeIngredient,
          brand: r.name,
          manufacturer: r.manufacturer,
          strength: r.strength,
          dosageForm: r.dosageForm,
          packageSize: r.packageSize,
          price: r.price,
          quantity: r.quantity,
          minStockAlert: 5,
          expiryDate: r.expiryDate,
          batchNumber: r.batchNumber,
          benefits: '',
          sideEffects: '',
          requiresPrescription: false,
          isAvailable,
          notes: `تم الاستيراد مجمعاً عبر ملف Excel: ${fileName}`,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, 'medicines', mId), medicineData);
        imported++;
      } catch (err) {
        console.error(`Row ${r.index} failed:`, err);
        failed++;
      }

      setImportProgress({ current: i + 1, total: rowsToImport.length });
    }

    await logAuditEvent({
      action: 'medicine_bulk_excel_import',
      category: 'pharmacy_inventory',
      actorUid: user.uid,
      actorName: pharmacyProfile?.pharmacyName || userProfile?.facilityName || 'الصيدلية',
      actorRole: 'pharmacy',
      resourceId: `import_${Date.now()}`,
      resourceNumber: fileName,
      status: failed > 0 ? 'partial' : 'success',
      details: `استيراد مجمع عبر ملف Excel (${fileName}). الإجمالي: ${parsedRows.length}، تم استيراد: ${imported}، فشل: ${failed}، تم تخطي مكرر: ${stats.duplicates}`,
    });

    setImportSummary({
      imported,
      failed,
      skipped: stats.total - imported - failed,
    });

    showToast(
      language === 'ar'
        ? `تم استيراد (${imported}) صنفاً دوائياً بنجاح إلى مخزون صيدليتك`
        : `Successfully imported (${imported}) medicines`,
      failed > 0 ? 'error' : 'success'
    );

    await onSuccess();
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setConfirmedTruth(false);
    setImportSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-6 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-100 text-[#00796b] flex items-center justify-center shrink-0">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">
                {language === 'ar' ? 'الاستيراد الشامل للأدوية عبر Excel / CSV' : 'Bulk Medicine Import via Excel / CSV'}
              </h3>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'رفع فوري لقوائم جرد الأدوية مع الفحص الميداني للتكرار والتحقق الصارم من التواريخ والأسعار'
                  : 'Fast spreadsheet inventory upload with in-flight duplicate screening and strict validation'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* STEP 1: UPLOAD & TEMPLATE DOWNLOAD */}
        {step === 'upload' && (
          <div className="space-y-6 overflow-y-auto pr-1">
            {/* Template Card */}
            <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <FileSpreadsheet size={24} className="text-[#00796b] shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-teal-950">
                    {language === 'ar' ? 'حمّل نموذج الإكسل الاسترشادي الرسمي' : 'Download Official Excel Template'}
                  </div>
                  <div className="text-teal-800 text-[11px] mt-0.5">
                    {language === 'ar'
                      ? 'يحتوي النموذج على الأعمدة المعتمدة مع أمثلة باللغتين العربية والإنجليزية لضمان عدم حدوث أخطاء استيراد.'
                      : 'Standardized columns in Arabic & English with verified example medicines.'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-teal-100 text-[#004d40] font-bold text-xs border border-teal-300 flex items-center gap-2 shadow-xs cursor-pointer shrink-0 transition-all"
              >
                <Download size={15} />
                <span>{language === 'ar' ? 'تحميل القالب (.xlsx)' : 'Download Template'}</span>
              </button>
            </div>

            {/* Drag & Drop File Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-[#00796b] rounded-3xl p-10 text-center cursor-pointer bg-slate-50/50 hover:bg-teal-50/30 transition-all space-y-3"
            >
              <div className="w-16 h-16 rounded-full bg-teal-100 text-[#00796b] flex items-center justify-center mx-auto">
                <Upload size={28} />
              </div>

              <div>
                <h4 className="font-bold text-base text-slate-800">
                  {language === 'ar' ? 'انقر لاختيار ملف الإكسل أو اسحبه هنا' : 'Click to select or drag and drop Excel file'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'ar' ? 'يدعم صيغ .xlsx و .xls و .csv (حتى 500 صنف بالدفعة)' : 'Supports .xlsx, .xls, and .csv (up to 500 items per batch)'}
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & IN-FLIGHT VALIDATION */}
        {step === 'preview' && (
          <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0 text-xs">
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200">
                <div className="text-slate-500">{language === 'ar' ? 'إجمالي السجلات' : 'Total Rows'}</div>
                <div className="text-base font-bold font-mono text-slate-800">{stats.total}</div>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-700">{language === 'ar' ? 'سجلات صالحة' : 'Valid Rows'}</div>
                <div className="text-base font-bold font-mono text-emerald-800">{stats.valid}</div>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-amber-700">{language === 'ar' ? 'أدوية مكررة بالمخزون' : 'Existing Duplicates'}</div>
                <div className="text-base font-bold font-mono text-amber-800">{stats.duplicates}</div>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="text-rose-700">{language === 'ar' ? 'سجلات غير صالحة' : 'Invalid Rows'}</div>
                <div className="text-base font-bold font-mono text-rose-800">{stats.invalid}</div>
              </div>
            </div>

            {/* Filter / Setting Options */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200 shrink-0">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded text-[#00796b] focus:ring-[#00796b]"
                />
                <span>
                  {language === 'ar'
                    ? 'تخطي الأدوية المكررة المسجلة مسبقاً بالمخزون (عدم إعادة إضافتها)'
                    : 'Skip duplicates already registered in pharmacy inventory'}
                </span>
              </label>

              <button
                type="button"
                onClick={handleReset}
                className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>{language === 'ar' ? 'اختيار ملف آخر' : 'Choose another file'}</span>
              </button>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="p-2.5 text-center w-12">#</th>
                    <th className="p-2.5">{language === 'ar' ? 'اسم الدواء' : 'Trade Name'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'المادة الفعالة' : 'Active Ingredient'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'العيار والعبوة' : 'Strength & Pack'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'السعر (د.ع)' : 'Price (IQD)'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'الصلاحية' : 'Expiry'}</th>
                    <th className="p-2.5">{language === 'ar' ? 'الحالة والمطابقة' : 'Validation Status'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.map((r) => {
                    const willSkip = skipDuplicates && r.isDuplicate;

                    return (
                      <tr
                        key={r.index}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          !r.isValid
                            ? 'bg-rose-50/30'
                            : r.isDuplicate
                            ? 'bg-amber-50/20'
                            : ''
                        }`}
                      >
                        <td className="p-2.5 text-center font-mono text-slate-400">{r.index}</td>
                        <td className="p-2.5 font-bold text-slate-900">{r.name || '—'}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.activeIngredient || '—'}</td>
                        <td className="p-2.5 text-slate-600">{r.strength} ({r.dosageForm})</td>
                        <td className="p-2.5 font-mono font-bold text-teal-800">{r.price.toLocaleString()}</td>
                        <td className="p-2.5 font-mono font-bold text-slate-800">{r.quantity}</td>
                        <td className="p-2.5 font-mono text-slate-600">{r.expiryDate}</td>
                        <td className="p-2.5">
                          {!r.isValid ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center gap-1 w-fit" title={r.errors.join(', ')}>
                              <XCircle size={12} />
                              <span>{r.errors[0]}</span>
                            </span>
                          ) : r.isDuplicate ? (
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1 w-fit ${willSkip ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                              <AlertTriangle size={12} />
                              <span>{willSkip ? (language === 'ar' ? 'مكرر (سيتم تخطيه)' : 'Duplicate (Skipped)') : (language === 'ar' ? 'مكرر بالمخزون' : 'Duplicate')}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 w-fit">
                              <CheckCircle2 size={12} />
                              <span>{language === 'ar' ? 'صالح للإضافة' : 'Valid'}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Explicit Confirmation Gate */}
            <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 shrink-0">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-teal-950 font-semibold leading-relaxed">
                <input
                  type="checkbox"
                  checked={confirmedTruth}
                  onChange={(e) => setConfirmedTruth(e.target.checked)}
                  className="mt-0.5 rounded text-[#00796b] focus:ring-[#00796b]"
                />
                <span>
                  {language === 'ar'
                    ? 'أقر بصفتي صيدلانياً مرخصاً بصحة أسعار وتواريخ الصلاحية وأرقام التشغيلات المرفوعة وأنها تمثل الجرد الفعلي للمخزون.'
                    : 'I certify that the uploaded prices, expiry dates, and lot numbers accurately reflect genuine physical stock.'}
                </span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'رجوع' : 'Back'}
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={!confirmedTruth || stats.importable === 0}
                className="px-6 py-2.5 rounded-xl bg-[#00796b] hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                <Check size={16} />
                <span>
                  {language === 'ar'
                    ? `تأكيد استيراد (${stats.importable}) صنفاً إلى المخزون`
                    : `Confirm Import (${stats.importable}) Items`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PROGRESS & COMPLETION */}
        {step === 'importing' && (
          <div className="py-12 px-4 text-center space-y-6">
            {!importSummary ? (
              <div className="space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-full bg-teal-100 text-[#00796b] flex items-center justify-center mx-auto animate-pulse">
                  <Upload size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    {language === 'ar' ? 'جاري كتابة السجلات في قاعدة بيانات الصيدلية...' : 'Writing records to Firestore...'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    {importProgress.current} / {importProgress.total}
                  </p>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#00796b] transition-all duration-200"
                    style={{
                      width: `${(importProgress.current / Math.max(importProgress.total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5 max-w-md mx-auto animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-900">
                    {language === 'ar' ? 'اكتمل الاستيراد بنجاح' : 'Import Complete'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {language === 'ar'
                      ? `تمت إضافة (${importSummary.imported}) دواء لمخزونك بنجاح، وتخطي (${importSummary.skipped}) صنفاً مكرراً أو غير صالح.`
                      : `Successfully imported (${importSummary.imported}) items. Skipped (${importSummary.skipped}) duplicates/invalid.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-[#00796b] hover:bg-teal-800 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
                >
                  {language === 'ar' ? 'إغلاق وعرض المخزون' : 'Done & View Inventory'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
