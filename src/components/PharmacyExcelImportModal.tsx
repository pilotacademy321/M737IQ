import React, { useState, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { MedicineItem } from '../types';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Download, 
  AlertTriangle, 
  FileText, 
  Check, 
  RefreshCw,
  Info
} from 'lucide-react';

interface ParsedRow {
  rowNumber: number;
  name: string;
  activeIngredient: string;
  brand: string;
  manufacturer: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  price: number;
  quantity: number;
  minStockAlert: number;
  expiryDate: string;
  requiresPrescription: boolean;
  batchNumber?: string;
  notes?: string;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
  warnings: string[];
}

interface PharmacyExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pharmacyId: string;
  pharmacyName: string;
  existingMedicines: MedicineItem[];
  onImportComplete: () => Promise<void>;
}

export const PharmacyExcelImportModal: React.FC<PharmacyExcelImportModalProps> = ({
  isOpen,
  onClose,
  pharmacyId,
  pharmacyName,
  existingMedicines,
  onImportComplete,
}) => {
  const { language, isRTL } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [filterView, setFilterView] = useState<'all' | 'valid' | 'errors' | 'duplicates'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  // Header Normalization Helper
  const normalizeKey = (key: string): string => {
    return key.trim().toLowerCase().replace(/[\s_\-–/()]/g, '');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorBanner(null);
    setImportSuccessCount(null);
    setFileName(file.name);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setErrorBanner(
            language === 'ar'
              ? 'الملف فارغ أو لا يحتوي على صفوف بيانات صالحة'
              : 'The uploaded file is empty or missing data rows'
          );
          setIsProcessing(false);
          return;
        }

        const todayTimestamp = new Date().setHours(0, 0, 0, 0);

        // Map and validate rows
        const rows: ParsedRow[] = rawJson.map((raw, index) => {
          const rowNumber = index + 2; // +1 for 0-index, +1 for header
          const errors: string[] = [];
          const warnings: string[] = [];

          // Find mapped fields flexibly
          let name = '';
          let activeIngredient = '';
          let brand = '';
          let manufacturer = '';
          let strength = '500mg';
          let dosageForm = 'Tablets (أقراص)';
          let packageSize = '20 Tablets';
          let price = 0;
          let quantity = 0;
          let minStockAlert = 5;
          let expiryDate = '';
          let requiresPrescription = false;
          let batchNumber = '';
          let notes = '';

          for (const rawKey of Object.keys(raw)) {
            const val = String(raw[rawKey]).trim();
            const norm = normalizeKey(rawKey);

            if (norm.includes('name') || norm.includes('الاسم') || norm.includes('اسم') || norm.includes('الدواء') || norm.includes('drug')) {
              if (!name) name = val;
            } else if (norm.includes('ingredient') || norm.includes('المادة') || norm.includes('active') || norm.includes('الفعالة') || norm.includes('generic')) {
              activeIngredient = val;
            } else if (norm.includes('brand') || norm.includes('التجاري') || norm.includes('ماركة')) {
              brand = val;
            } else if (norm.includes('manufacturer') || norm.includes('الشركة') || norm.includes('المصنع') || norm.includes('company')) {
              manufacturer = val;
            } else if (norm.includes('strength') || norm.includes('التركيز') || norm.includes('dose') || norm.includes('الجرعة')) {
              strength = val;
            } else if (norm.includes('form') || norm.includes('الشكل') || norm.includes('النوع') || norm.includes('dosage')) {
              dosageForm = val;
            } else if (norm.includes('pack') || norm.includes('حجم') || norm.includes('عبوة') || norm.includes('العبوة')) {
              packageSize = val;
            } else if (norm.includes('price') || norm.includes('السعر') || norm.includes('iqd') || norm.includes('مفرد') || norm.includes('دينار')) {
              const num = parseFloat(val.replace(/[^0-9.]/g, ''));
              price = isNaN(num) ? 0 : num;
            } else if (norm.includes('quantity') || norm.includes('qty') || norm.includes('الكمية') || norm.includes('العدد') || norm.includes('رصيد')) {
              const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
              quantity = isNaN(num) ? 0 : num;
            } else if (norm.includes('alert') || norm.includes('الحد') || norm.includes('حرج') || norm.includes('min')) {
              const num = parseInt(val.replace(/[^0-9]/g, ''), 10);
              minStockAlert = isNaN(num) ? 5 : num;
            } else if (norm.includes('expiry') || norm.includes('صلاحية') || norm.includes('نفاذ') || norm.includes('exp')) {
              // Parse date
              expiryDate = val;
            } else if (norm.includes('batch') || norm.includes('وجبة') || norm.includes('تشغيلة') || norm.includes('lot')) {
              batchNumber = val;
            } else if (norm.includes('prescription') || norm.includes('وصفة') || norm.includes('rx')) {
              requiresPrescription = val.toLowerCase().includes('y') || val.includes('نعم') || val === '1' || val.toLowerCase().includes('true');
            } else if (norm.includes('note') || norm.includes('ملاحظ')) {
              notes = val;
            }
          }

          // Format Date if needed (handle Excel serial dates like 45321)
          if (expiryDate && !isNaN(Number(expiryDate))) {
            const serial = Number(expiryDate);
            const dateObj = new Date((serial - 25569) * 86400 * 1000);
            if (!isNaN(dateObj.getTime())) {
              expiryDate = dateObj.toISOString().split('T')[0];
            }
          } else if (expiryDate) {
            const parsedD = new Date(expiryDate);
            if (!isNaN(parsedD.getTime())) {
              expiryDate = parsedD.toISOString().split('T')[0];
            }
          }

          if (!expiryDate) {
            // Default 1 year from now if missing
            expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            warnings.push(language === 'ar' ? 'تم تعيين تاريخ صلاحية افتراضي (سنة واحدة)' : 'Default 1-year expiry applied');
          } else {
            const expiryTs = new Date(expiryDate).getTime();
            if (expiryTs < todayTimestamp) {
              errors.push(language === 'ar' ? 'الدواء منتهي الصلاحية ولا يمكن إدخاله للمخزون' : 'Expired medication cannot be ingested');
            }
          }

          if (!name) {
            errors.push(language === 'ar' ? 'اسم الدواء التجاري مفقود' : 'Medicine name is missing');
          }
          if (!activeIngredient) {
            activeIngredient = name;
            warnings.push(language === 'ar' ? 'تم نسخ المادة الفعالة من اسم الصنف' : 'Active ingredient defaulted from name');
          }
          if (price <= 0) {
            warnings.push(language === 'ar' ? 'سعر البيع 0 دينار (يرجى مراجعته)' : 'Price is 0 IQD');
          }
          if (quantity <= 0) {
            warnings.push(language === 'ar' ? 'الكمية صفر (مخزون نافد)' : 'Quantity is 0');
          }

          // Check duplicate against existing pharmacy inventory
          const cleanName = name.toLowerCase().trim();
          const cleanActive = activeIngredient.toLowerCase().trim();
          const isDuplicate = existingMedicines.some(
            (em) =>
              em.name.toLowerCase().trim() === cleanName ||
              (em.activeIngredient.toLowerCase().trim() === cleanActive && em.strength === strength)
          );

          if (isDuplicate) {
            warnings.push(language === 'ar' ? 'الصنف مسجل مسبقاً في مخزون الصيدلية (تكرار)' : 'Item already exists in pharmacy inventory');
          }

          return {
            rowNumber,
            name,
            activeIngredient,
            brand: brand || name,
            manufacturer: manufacturer || 'معتمد (وزارة الصحة)',
            strength: strength || '500mg',
            dosageForm: dosageForm || 'Tablets (أقراص)',
            packageSize: packageSize || '20 Tablets',
            price: Math.max(0, price),
            quantity: Math.max(0, quantity),
            minStockAlert: minStockAlert || 5,
            expiryDate,
            requiresPrescription,
            batchNumber,
            notes,
            isValid: errors.length === 0,
            isDuplicate,
            errors,
            warnings,
          };
        });

        setParsedRows(rows);
      } catch (err: unknown) {
        setErrorBanner(
          language === 'ar'
            ? 'حدث خطأ أثناء معالجة وقراءة ملف الإكسل. يرجى التأكد من سلامة التنسيق.'
            : 'Error parsing the Excel spreadsheet. Please verify file integrity.'
        );
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Download Sample Excel/CSV Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'اسم الدواء (Drug Name)': 'Panadol Extra 500mg',
        'المادة الفعالة (Active Ingredient)': 'Paracetamol 500mg + Caffeine 65mg',
        'الشركة المصنعة (Manufacturer)': 'Haleon / GSK',
        'التركيز (Strength)': '500mg/65mg',
        'الشكل الصيدلاني (Dosage Form)': 'Tablets (أقراص)',
        'حجم العبوة (Package Size)': '24 Tablets',
        'سعر البيع دينار (Price IQD)': 3500,
        'الكمية بالمخزون (Quantity)': 50,
        'حد التنبيه (Min Stock Alert)': 10,
        'تاريخ الصلاحية (Expiry YYYY-MM-DD)': '2027-06-30',
        'رقم الوجبة (Batch Number)': 'BAT-IQ-8821',
        'هل يلزم وصفة (Requires Rx)': 'لا',
        'ملاحظات (Notes)': 'مسكن آلام سريع المفعول',
      },
      {
        'اسم الدواء (Drug Name)': 'Augmentin 1g Tablets',
        'المادة الفعالة (Active Ingredient)': 'Amoxicillin 875mg + Clavulanic Acid 125mg',
        'الشركة المصنعة (Manufacturer)': 'GSK GlaxoSmithKline',
        'التركيز (Strength)': '1000mg',
        'الشكل الصيدلاني (Dosage Form)': 'Film-Coated Tablets',
        'حجم العبوة (Package Size)': '14 Tablets',
        'سعر البيع دينار (Price IQD)': 11000,
        'الكمية بالمخزون (Quantity)': 30,
        'حد التنبيه (Min Stock Alert)': 8,
        'تاريخ الصلاحية (Expiry YYYY-MM-DD)': '2027-04-15',
        'رقم الوجبة (Batch Number)': 'BAT-AUG-9902',
        'هل يلزم وصفة (Requires Rx)': 'نعم',
        'ملاحظات (Notes)': 'مضاد حيوي واسع الطيف',
      },
      {
        'اسم الدواء (Drug Name)': 'Amoxicillin SDI 500mg',
        'المادة الفعالة (Active Ingredient)': 'Amoxicillin Trihydrate',
        'الشركة المصنعة (Manufacturer)': 'SDI Samarra (سامراء للأدوية)',
        'التركيز (Strength)': '500mg',
        'الشكل الصيدلاني (Dosage Form)': 'Capsules (كبسول)',
        'حجم العبوة (Package Size)': '20 Capsules',
        'سعر البيع دينار (Price IQD)': 2500,
        'الكمية بالمخزون (Quantity)': 100,
        'حد التنبيه (Min Stock Alert)': 15,
        'تاريخ الصلاحية (Expiry YYYY-MM-DD)': '2027-12-31',
        'رقم الوجبة (Batch Number)': 'SDI-BAT-4412',
        'هل يلزم وصفة (Requires Rx)': 'نعم',
        'ملاحظات (Notes)': 'منتج وطني عراقي معتمد',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'M737_Inventory_Template');
    XLSX.writeFile(wb, 'M737IQ_Pharmacy_Inventory_Template.xlsx');
  };

  // Commit valid rows to Firestore
  const handleCommitImport = async (skipDuplicates: boolean) => {
    const validRows = parsedRows.filter((r) => r.isValid && (!skipDuplicates || !r.isDuplicate));
    if (validRows.length === 0) return;

    setIsProcessing(true);
    setImportProgress({ current: 0, total: validRows.length });

    try {
      const now = new Date().toISOString();
      let importedCount = 0;

      for (let i = 0; i < validRows.length; i++) {
        const item = validRows[i];
        const medId = `med_${pharmacyId.slice(0, 5)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        const newMedicineDoc: MedicineItem = {
          id: medId,
          pharmacyId,
          pharmacyName,
          name: item.name,
          activeIngredient: item.activeIngredient,
          brand: item.brand,
          manufacturer: item.manufacturer,
          strength: item.strength,
          dosageForm: item.dosageForm,
          packageSize: item.packageSize,
          price: item.price,
          quantity: item.quantity,
          minStockAlert: item.minStockAlert,
          expiryDate: item.expiryDate,
          requiresPrescription: item.requiresPrescription,
          isAvailable: item.quantity > 0,
          notes: item.notes || (item.batchNumber ? `وجبة: ${item.batchNumber}` : ''),
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, 'medicines', medId), sanitizeForFirestore(newMedicineDoc));
        importedCount++;
        setImportProgress({ current: importedCount, total: validRows.length });
      }

      setImportSuccessCount(importedCount);
      await onImportComplete();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'medicines');
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid && !r.isDuplicate).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;
  const errorCount = parsedRows.filter((r) => !r.isValid).length;

  const filteredDisplayRows = parsedRows.filter((r) => {
    if (filterView === 'valid') return r.isValid && !r.isDuplicate;
    if (filterView === 'errors') return !r.isValid;
    if (filterView === 'duplicates') return r.isDuplicate;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 bg-gradient-to-r from-teal-800 to-emerald-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-white/10 text-emerald-300">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                {language === 'ar'
                  ? 'استيراد رصيد الصيدلية من ملفات إكسل / CSV'
                  : 'Bulk Pharmacy Inventory Import (Excel/CSV)'}
              </h3>
              <p className="text-xs text-emerald-200 mt-0.5">
                {language === 'ar'
                  ? 'رفع وتدقيق وتوريد قوائم الأدوية والمستودع دفعة واحدة وفق الضوابط الرقابية العراقية'
                  : 'Fast automated batch ingestion with duplicate checking and regulatory validation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
              title="Download Excel Template"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تحميل نموذج جاهز' : 'Template'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Error Banner */}
          {errorBanner && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <p className="font-semibold">{errorBanner}</p>
            </div>
          )}

          {/* Success Banner */}
          {importSuccessCount !== null && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm">
                  {language === 'ar'
                    ? `تم بنجاح توريد (${importSuccessCount}) صنف دوائي إلى سجل الصيدلية!`
                    : `Successfully imported (${importSuccessCount}) medicine items to inventory!`}
                </p>
                <p className="text-emerald-700 mt-0.5">
                  {language === 'ar'
                    ? 'الأصناف متاحة الآن في المخزون وفي محرك البحث للمراجعين والأطباء.'
                    : 'The items are now live and searchable in your pharmacy workspace.'}
                </p>
              </div>
            </div>
          )}

          {/* File Upload Dropzone */}
          {parsedRows.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-teal-600 rounded-3xl p-10 text-center cursor-pointer transition-all bg-slate-50/50 hover:bg-teal-50/30 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-teal-100/60 text-teal-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="font-bold text-slate-800 text-base mb-1">
                {language === 'ar'
                  ? 'اضغط لاختيار ملف إكسل أو اسحب الملف هنا'
                  : 'Click to select Excel file or drop it here'}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {language === 'ar'
                  ? 'ندعم ملفات .xlsx و .xls و .csv. يتم التعرف التلقائي على الأعمدة العربية والإنجليزية.'
                  : 'Supports .xlsx, .xls, and .csv with automatic Arabic and English column recognition.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info & Stats Strip */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="p-2 rounded-xl bg-teal-100 text-teal-800">
                    <FileSpreadsheet className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block font-mono">{fileName}</span>
                    <span className="text-[11px] text-slate-500">
                      {language === 'ar'
                        ? `إجمالي الصفوف المستخرجة: ${parsedRows.length}`
                        : `Total rows parsed: ${parsedRows.length}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setParsedRows([]);
                      setFileName('');
                      setImportSuccessCount(null);
                    }}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                  >
                    {language === 'ar' ? 'رفع ملف آخر' : 'Change File'}
                  </button>
                </div>
              </div>

              {/* Counts Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
                <button
                  onClick={() => setFilterView('all')}
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    filterView === 'all'
                      ? 'border-slate-800 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block text-[11px] opacity-75">{language === 'ar' ? 'كافة الأصناف' : 'All Items'}</span>
                  <span className="text-lg font-black font-mono">{parsedRows.length}</span>
                </button>

                <button
                  onClick={() => setFilterView('valid')}
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    filterView === 'valid'
                      ? 'border-emerald-600 bg-emerald-700 text-white'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/50'
                  }`}
                >
                  <span className="block text-[11px] opacity-75">{language === 'ar' ? 'جاهز للاستيراد' : 'Valid & New'}</span>
                  <span className="text-lg font-black font-mono">{validCount}</span>
                </button>

                <button
                  onClick={() => setFilterView('duplicates')}
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    filterView === 'duplicates'
                      ? 'border-amber-600 bg-amber-700 text-white'
                      : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100/50'
                  }`}
                >
                  <span className="block text-[11px] opacity-75">{language === 'ar' ? 'تكرار مسجل' : 'Duplicates'}</span>
                  <span className="text-lg font-black font-mono">{duplicateCount}</span>
                </button>

                <button
                  onClick={() => setFilterView('errors')}
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    filterView === 'errors'
                      ? 'border-red-600 bg-red-700 text-white'
                      : 'border-red-200 bg-red-50 text-red-800 hover:bg-red-100/50'
                  }`}
                >
                  <span className="block text-[11px] opacity-75">{language === 'ar' ? 'أخطاء وحجب' : 'Errors/Expired'}</span>
                  <span className="text-lg font-black font-mono">{errorCount}</span>
                </button>
              </div>

              {/* Parsed Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-slate-100/80 text-slate-700 sticky top-0 border-b border-slate-200 text-[11px] font-bold">
                      <tr>
                        <th className="p-3 text-start">#</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'اسم الدواء' : 'Drug Name'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'المادة الفعالة' : 'Active Ingredient'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'التركيز والشكل' : 'Strength / Form'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'السعر (د.ع)' : 'Price (IQD)'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'الكمية' : 'Qty'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'الصلاحية' : 'Expiry'}</th>
                        <th className="p-3 text-start">{language === 'ar' ? 'الحالة والتدقيق' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredDisplayRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400">
                            {language === 'ar' ? 'لا توجد صفوف تطابق الفلتر الحالي' : 'No rows match filter'}
                          </td>
                        </tr>
                      ) : (
                        filteredDisplayRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-slate-50 transition-colors ${
                              !row.isValid
                                ? 'bg-red-50/40'
                                : row.isDuplicate
                                ? 'bg-amber-50/40'
                                : ''
                            }`}
                          >
                            <td className="p-3 font-mono text-slate-400">{row.rowNumber}</td>
                            <td className="p-3 font-bold text-slate-900">{row.name}</td>
                            <td className="p-3 text-slate-600">{row.activeIngredient}</td>
                            <td className="p-3 text-slate-600">
                              <span className="font-medium">{row.strength}</span>
                              <span className="text-[10px] text-slate-400 block">{row.dosageForm}</span>
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900">
                              {row.price.toLocaleString()}
                            </td>
                            <td className="p-3 font-mono font-bold text-slate-900">{row.quantity}</td>
                            <td className="p-3 font-mono text-slate-600">{row.expiryDate}</td>
                            <td className="p-3">
                              {row.errors.length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-md">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  {row.errors[0]}
                                </span>
                              ) : row.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                                  <AlertTriangle className="w-3 h-3 shrink-0" />
                                  {language === 'ar' ? 'مكرر بالمخزون' : 'Duplicate'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                                  <Check className="w-3 h-3 shrink-0" />
                                  {language === 'ar' ? 'سليم وجاهز' : 'Ready'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {parsedRows.length > 0 && (
          <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="text-xs text-slate-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                {language === 'ar'
                  ? `أصناف جاهزة للإدخال: ${validCount} صنف جديد (${duplicateCount} مكرر)`
                  : `Ready to ingest: ${validCount} new (${duplicateCount} duplicates)`}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {duplicateCount > 0 && (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleCommitImport(false)}
                  className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {language === 'ar'
                    ? `استيراد الكل بما في ذلك المكرر (${validCount + duplicateCount})`
                    : `Import All Including Duplicates (${validCount + duplicateCount})`}
                </button>
              )}

              <button
                type="button"
                disabled={isProcessing || validCount === 0}
                onClick={() => handleCommitImport(true)}
                className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {importProgress
                        ? language === 'ar'
                          ? `جاري الإدخال (${importProgress.current} من ${importProgress.total})...`
                          : `Ingesting (${importProgress.current}/${importProgress.total})...`
                        : language === 'ar' ? 'جاري المعالجة...' : 'Processing...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {language === 'ar'
                        ? `تأكيد استيراد الأصناف الجديدة (${validCount})`
                        : `Confirm Import New (${validCount})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
