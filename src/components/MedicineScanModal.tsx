import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { 
  Camera, 
  QrCode, 
  Barcode, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Search, 
  Sparkles, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink,
  Edit3,
  Layers,
  ArrowRight,
  Package,
  Eye,
  Check
} from 'lucide-react';
import { 
  cleanScannedCode, 
  parseMedicineTextOcr, 
  ScannedCodeResult, 
  ParsedMedicineExtractedInfo 
} from '../utils/medicineScannerUtils';
import { CatalogMedicineItem } from '../types';

interface MedicineScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'wholesaler' | 'pharmacy';
  existingMedicines: any[];
  onSelectExistingForUpdate: (medicine: any) => void;
  onOpenNewMedicineWithPrefill: (prefilled: Record<string, any>) => void;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

export const MedicineScanModal: React.FC<MedicineScanModalProps> = ({
  isOpen,
  onClose,
  role,
  existingMedicines,
  onSelectExistingForUpdate,
  onOpenNewMedicineWithPrefill,
  showToast,
}) => {
  const { language, isRTL } = useLanguage();
  const [activeMode, setActiveMode] = useState<'camera_scanner' | 'image_ocr' | 'manual_input'>('camera_scanner');

  // Scanner state
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // OCR state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [ocrExtractedData, setOcrExtractedData] = useState<ParsedMedicineExtractedInfo | null>(null);

  // Scanned / Detected Match State
  const [scannedCodeResult, setScannedCodeResult] = useState<ScannedCodeResult | null>(null);
  const [searchingDatabase, setSearchingDatabase] = useState(false);
  const [matchedExistingItem, setMatchedExistingItem] = useState<any | null>(null);
  const [matchedCatalogItem, setMatchedCatalogItem] = useState<CatalogMedicineItem | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        scannerRef.current = null;
        setIsScanning(false);
      }
    }
  }, []);

  // Stop scanner when modal closes
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedCodeResult(null);
      setMatchedExistingItem(null);
      setMatchedCatalogItem(null);
      setOcrExtractedData(null);
      setOcrImagePreview(null);
      setCameraPermissionError(null);
    }
  }, [isOpen, stopScanner]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const startScanner = async (cameraIdToUse?: string) => {
    setCameraPermissionError(null);
    setScannedCodeResult(null);
    setMatchedExistingItem(null);
    setMatchedCatalogItem(null);

    // Guard against unsupported mediaDevices in restricted iframes or older browsers
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionError(
        language === 'ar'
          ? 'المتصفح أو بيئة العرض الحالية لا تدعم تشغيل الكاميرا مباشرة. يمكنك استخدام رفع صورة العبوة (OCR) أو الإدخال اليدوي.'
          : 'Camera access is not supported in this browser or iframe. Please use label photo upload (OCR) or manual entry.'
      );
      setIsScanning(false);
      return;
    }

    try {
      // Initialize or reset scanner instance
      if (scannerRef.current) {
        await stopScanner();
      }

      const scanner = new Html5Qrcode('m737-reader-element', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = scanner;

      // Determine camera target (ID if explicitly selected, or facingMode environment for rear camera)
      const cameraTarget: any = (cameraIdToUse || selectedCameraId) 
        ? (cameraIdToUse || selectedCameraId) 
        : { facingMode: 'environment' };

      await scanner.start(
        cameraTarget,
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        async (decodedText, decodedResult) => {
          // Successfully scanned!
          handleCodeDetected(decodedText, decodedResult?.result?.format?.formatName);
          await stopScanner();
        },
        () => {
          // Frame parse error (normal while hunting for barcode in frame)
        }
      );

      setIsScanning(true);

      // Once permission is granted and scanner started, attempt to populate camera list for switcher
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id}` })));
        }
      } catch {
        // Safe to ignore device list error if camera stream is active
      }
    } catch (err: any) {
      console.warn('Camera start permission / availability notice:', err?.message || err);
      const errStr = String(err?.message || err?.name || err || '').toLowerCase();
      let msg = language === 'ar' 
        ? 'تعذر الوصول إلى الكاميرا. يرجى منح إذن الكاميرا أو استخدام رفع صورة العبوة (OCR) أو الإدخال اليدوي.' 
        : 'Could not access camera. Please allow camera permissions or use photo upload (OCR) or manual entry.';
      if (err?.name === 'NotAllowedError' || errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
        msg = language === 'ar'
          ? 'تم رفض إذن الوصول للكاميرا أو أنه مقيّد في هذا المتصفح/الإطار. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح، أو الانتقال لرفع صورة العبوة (OCR) أو الإدخال اليدوي.'
          : 'Camera permission denied or restricted. Please allow camera permissions in browser settings, or use label photo upload (OCR) or manual entry.';
      } else if (err?.name === 'NotFoundError' || errStr.includes('notfound') || errStr.includes('no camera')) {
        msg = language === 'ar'
          ? 'لم يتم العثور على أي كاميرا متصلة بالجهاز. يرجى استخدام رفع صورة أو الإدخال اليدوي.'
          : 'No camera found on this device. Please use photo upload or manual entry.';
      }
      setCameraPermissionError(msg);
      setIsScanning(false);
    }
  };

  const handleCodeDetected = async (rawCode: string, formatName?: string) => {
    const cleaned = cleanScannedCode(rawCode);
    cleaned.format = formatName;
    setScannedCodeResult(cleaned);
    showToast(
      language === 'ar' 
        ? `تم مسح الرمز بنجاح: ${cleaned.gs1Data?.gtin || cleaned.code}` 
        : `Scanned code: ${cleaned.gs1Data?.gtin || cleaned.code}`,
      'success'
    );

    // Search Database
    await performMedicineLookup(cleaned);
  };

  const performMedicineLookup = async (codeObj: ScannedCodeResult) => {
    setSearchingDatabase(true);
    setMatchedExistingItem(null);
    setMatchedCatalogItem(null);

    const lookupCode = (codeObj.gs1Data?.gtin || codeObj.code).trim().toLowerCase();

    try {
      // 1. Search in Current User's Inventory (Wholesaler or Pharmacy)
      const foundInStock = existingMedicines.find((m) => {
        const itemBarcode = (m.barcode || '').trim().toLowerCase();
        const itemQr = (m.qrCode || '').trim().toLowerCase();
        return itemBarcode === lookupCode || itemQr === lookupCode || (m.id && m.id.toLowerCase() === lookupCode);
      });

      if (foundInStock) {
        setMatchedExistingItem(foundInStock);
        setSearchingDatabase(false);
        return;
      }

      // 2. Search in Central Medicine Catalog (`medicine_catalog`)
      const catalogRef = collection(db, 'medicine_catalog');
      const catalogQuery = query(catalogRef, where('barcode', '==', lookupCode), limit(1));
      const catSnap = await getDocs(catalogQuery);

      if (!catSnap.empty) {
        const catalogData = { id: catSnap.docs[0].id, ...catSnap.docs[0].data() } as CatalogMedicineItem;
        setMatchedCatalogItem(catalogData);
      }
    } catch (err) {
      console.warn('Error querying medicine during scan lookup:', err);
    } finally {
      setSearchingDatabase(false);
    }
  };

  // OCR Processing Function
  const handleImageUploadForOcr = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrProgress(0);
    setOcrExtractedData(null);
    setScannedCodeResult(null);

    const previewUrl = URL.createObjectURL(file);
    setOcrImagePreview(previewUrl);

    try {
      // Create Tesseract worker
      const worker = await createWorker(['eng', 'ara']);
      
      const ret = await worker.recognize(file);
      const text = ret.data.text;
      await worker.terminate();

      const extracted = parseMedicineTextOcr(text);
      setOcrExtractedData(extracted);

      // Check if image also contains barcode or GS1 data in text
      if (extracted.batchNumber || extracted.tradeName) {
        showToast(
          language === 'ar' ? 'تم استخراج بيانات العبوة بنجاح' : 'Package details extracted successfully',
          'success'
        );
      } else {
        showToast(
          language === 'ar' 
            ? 'تمت قراءة النص، يرجى مراجعة الحقول وتأكيد البيانات' 
            : 'Text parsed, please review and confirm details',
          'success'
        );
      }
    } catch (err: any) {
      console.warn('OCR processing notice:', err?.message || err);
      showToast(
        language === 'ar' ? 'فشل التعرف على النص في الصورة. يرجى تجربة صورة أوضح أو إدخال البيانات يدوياً.' : 'OCR failed to parse image text. Please try a clearer picture.',
        'error'
      );
    } finally {
      setOcrLoading(false);
    }
  };

  // Confirm Actions
  const handleProceedWithExisting = () => {
    if (!matchedExistingItem) return;
    onSelectExistingForUpdate(matchedExistingItem);
    onClose();
  };

  const handleProceedWithNewOrCatalog = () => {
    // Construct prefilled data from scanned barcode, GS1 data, and OCR
    const prefilled: Record<string, any> = {};

    const code = scannedCodeResult?.code || manualCodeInput.trim();
    if (code) {
      if (scannedCodeResult?.format?.includes('QR') || code.length > 30) {
        prefilled.qrCode = code;
      } else {
        prefilled.barcode = scannedCodeResult?.gs1Data?.gtin || code;
      }
    }

    if (scannedCodeResult?.gs1Data?.batchNumber) {
      prefilled.batchNumber = scannedCodeResult.gs1Data.batchNumber;
    }
    if (scannedCodeResult?.gs1Data?.expiryDate) {
      prefilled.expiryDate = scannedCodeResult.gs1Data.expiryDate;
    }

    if (matchedCatalogItem) {
      prefilled.name = matchedCatalogItem.nameEn;
      prefilled.nameAr = matchedCatalogItem.nameAr;
      prefilled.brand = matchedCatalogItem.brand;
      prefilled.activeIngredient = matchedCatalogItem.activeIngredient;
      prefilled.manufacturer = matchedCatalogItem.manufacturer;
      prefilled.strength = matchedCatalogItem.strength;
      prefilled.dosageForm = matchedCatalogItem.dosageForm;
      prefilled.packageSize = matchedCatalogItem.packageSize;
      prefilled.packSize = matchedCatalogItem.packageSize;
      prefilled.requiresPrescription = matchedCatalogItem.requiresPrescription;
      if (matchedCatalogItem.barcode) prefilled.barcode = matchedCatalogItem.barcode;
    } else if (ocrExtractedData) {
      if (ocrExtractedData.tradeName) prefilled.name = ocrExtractedData.tradeName;
      if (ocrExtractedData.activeIngredient) prefilled.activeIngredient = ocrExtractedData.activeIngredient;
      if (ocrExtractedData.strength) prefilled.strength = ocrExtractedData.strength;
      if (ocrExtractedData.dosageForm) prefilled.dosageForm = ocrExtractedData.dosageForm;
      if (ocrExtractedData.batchNumber) prefilled.batchNumber = ocrExtractedData.batchNumber;
      if (ocrExtractedData.expiryDate) prefilled.expiryDate = ocrExtractedData.expiryDate;
    }

    onOpenNewMedicineWithPrefill(prefilled);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 backdrop-blur-md">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {language === 'ar' ? 'مسح وقراءة الدواء بالكاميرا' : 'Medicine Camera & Barcode Scanner'}
              </h2>
              <p className="text-xs text-emerald-100">
                {role === 'wholesaler' 
                  ? (language === 'ar' ? 'بوابة المذخر — إدارة الكتالوج والمستودع' : 'Wholesaler Portal — Inventory & Catalog') 
                  : (language === 'ar' ? 'بوابة الصيدلية — إدارة الرفوف والمخزون' : 'Pharmacy Portal — Stock & Inventory')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveMode('camera_scanner');
              startScanner();
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeMode === 'camera_scanner'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Barcode className="w-4 h-4 text-emerald-600" />
            <span>{language === 'ar' ? 'مسح الباركود و QR' : 'Barcode & QR Scanner'}</span>
          </button>

          <button
            onClick={() => {
              stopScanner();
              setActiveMode('image_ocr');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeMode === 'image_ocr'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <FileText className="w-4 h-4 text-teal-600" />
            <span>{language === 'ar' ? 'التقاط العبوة (OCR)' : 'Package OCR Extract'}</span>
          </button>

          <button
            onClick={() => {
              stopScanner();
              setActiveMode('manual_input');
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeMode === 'manual_input'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Edit3 className="w-4 h-4 text-cyan-600" />
            <span>{language === 'ar' ? 'إدخال يدوي مباشر' : 'Manual Entry'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* CAMERA SCANNER MODE */}
          {activeMode === 'camera_scanner' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>{language === 'ar' ? 'وجّه كاميرا الهاتف أو الحاسوب نحو باركود أو QR العبوة:' : 'Point camera at medicine barcode or QR code:'}</span>
                {availableCameras.length > 1 && (
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      setSelectedCameraId(e.target.value);
                      startScanner(e.target.value);
                    }}
                    className="py-1 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
                  >
                    {availableCameras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Viewport for Html5Qrcode */}
              <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-900 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-inner flex items-center justify-center">
                <div id="m737-reader-element" className="w-full h-full" />

                {!isScanning && !cameraPermissionError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4 text-center">
                    <Camera className="w-12 h-12 text-emerald-400 mb-3 animate-pulse" />
                    <p className="text-sm font-semibold mb-4">
                      {language === 'ar' ? 'الكاميرا غير نشطة حالياً' : 'Camera is currently stopped'}
                    </p>
                    <button
                      onClick={() => startScanner()}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{language === 'ar' ? 'تشغيل الكاميرا والبدء' : 'Start Camera Scan'}</span>
                    </button>
                  </div>
                )}

                {cameraPermissionError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-6 text-center z-10">
                    <AlertTriangle className="w-10 h-10 text-amber-400 mb-3 animate-pulse" />
                    <p className="text-xs text-amber-200 leading-relaxed mb-4 max-w-sm">
                      {cameraPermissionError}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => startScanner()}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</span>
                      </button>
                      <button
                        onClick={() => {
                          stopScanner();
                          setActiveMode('image_ocr');
                        }}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'رفع صورة (OCR)' : 'Upload Photo (OCR)'}</span>
                      </button>
                      <button
                        onClick={() => {
                          stopScanner();
                          setActiveMode('manual_input');
                        }}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'إدخال يدوي مباشر' : 'Manual Entry'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Stop camera button if running */}
              {isScanning && (
                <div className="flex justify-center">
                  <button
                    onClick={stopScanner}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                  >
                    {language === 'ar' ? 'إيقاف الكاميرا مؤقتاً' : 'Pause Camera'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* IMAGE CAPTURE / OCR MODE */}
          {activeMode === 'image_ocr' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">
                    {language === 'ar' ? 'ضوابط السلامة والتعرف البصري (OCR):' : 'OCR & Clinical Safety Guidelines:'}
                  </span>
                  <p className="text-amber-800 leading-relaxed">
                    {language === 'ar'
                      ? 'التعرف البصري على نصوص علب الأدوية وسيلة مساعدة للترميز فقط، ولا يعد دليلاً قانونياً أو طبياً على مطابقة المستحضر. يجب على الصيدلي/المذخر التحقق بنفسه من اسم الدواء، العيار، ورقم التشغيلة وتاريخ الصلاحية قبل الحفظ.'
                      : 'OCR text recognition is an input aid only, not proof of medicine authenticity. Always review and verify extracted details against the physical package.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl p-6 bg-slate-50 hover:bg-slate-100/80 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  ref={fileInputRef}
                  onChange={handleImageUploadForOcr}
                  className="hidden"
                />

                {ocrImagePreview ? (
                  <div className="space-y-3 w-full text-center">
                    <img 
                      src={ocrImagePreview} 
                      alt="Medicine Box Preview" 
                      className="max-h-48 mx-auto rounded-xl object-contain border border-slate-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm"
                    >
                      {language === 'ar' ? 'اختيار أو التقاط صورة أخرى' : 'Capture or Select Another Photo'}
                    </button>
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <Camera className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">
                        {language === 'ar' ? 'التقط صورة لملصق أو علبة الدواء' : 'Capture photo of medicine box or label'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {language === 'ar' ? 'يدعم قراءة الاسم، العيار، الشكل الصيدلاني، وتاريخ الصلاحية' : 'Extracts name, strength, dosage form, and expiry'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md"
                    >
                      {language === 'ar' ? 'فتح الكاميرا / رفع صورة' : 'Open Camera / Upload Photo'}
                    </button>
                  </div>
                )}
              </div>

              {ocrLoading && (
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-teal-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-teal-900">
                    {language === 'ar' ? 'جاري استخراج النصوص من صورة العبوة عبر الذكاء البصري...' : 'Extracting medicine text with optical recognition...'}
                  </p>
                </div>
              )}

              {ocrExtractedData && !ocrLoading && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      {language === 'ar' ? 'البيانات المستخرجة من الملصق:' : 'Extracted Label Details:'}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                      {language === 'ar' ? 'تتطلب المراجعة' : 'Requires Review'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'الاسم التجاري' : 'Trade Name'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.tradeName || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'المادة الفعالة' : 'Active Ingredient'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.activeIngredient || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'العيار' : 'Strength'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.strength || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'الشكل الصيدلاني' : 'Dosage Form'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.dosageForm || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'تاريخ الصلاحية المقروء' : 'Detected Expiry'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.expiryDate || '—'}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                      <span className="text-slate-400 block text-[10px]">{language === 'ar' ? 'رقم التشغيلة (Batch)' : 'Batch Number'}</span>
                      <span className="font-bold text-slate-800">{ocrExtractedData.batchNumber || '—'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MANUAL INPUT MODE */}
          {activeMode === 'manual_input' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'أدخل رقم الباركود أو رمز QR يدوياً:' : 'Enter Barcode or QR Code Manually:'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: 6281000123456 أو رمز الـ QR' : 'e.g. 6281000123456 or QR string'}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualCodeInput.trim()) {
                        showToast(language === 'ar' ? 'يرجى كتابة الرمز أولاً' : 'Please enter code first', 'error');
                        return;
                      }
                      handleCodeDetected(manualCodeInput.trim());
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                  >
                    <Search className="w-4 h-4" />
                    <span>{language === 'ar' ? 'فحص والبحث' : 'Search Code'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SCANNED CODE RESULT BANNER */}
          {scannedCodeResult && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {language === 'ar' ? 'الرمز الممسوح ضوئياً:' : 'Scanned Code Identifier:'}
                </span>
                <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {scannedCodeResult.gs1Data?.gtin || scannedCodeResult.code}
                </span>
              </div>

              {/* Security Shield for URLs: Never open automatically */}
              {scannedCodeResult.isUrl && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {language === 'ar' ? 'تنبيه أمان M737IQ للروابط:' : 'M737IQ URL Safety Protection:'}
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      {language === 'ar'
                        ? `الرمز يحتوي على رابط خارجي (${scannedCodeResult.safeUrlDisplay}). لأسباب أمنية وموثوقية الأدوية، لا يتم فتح الروابط تلقائياً لمنع أي تصيد أو محتوى مجهول.`
                        : `The QR code contains an external URL (${scannedCodeResult.safeUrlDisplay}). For clinical safety, arbitrary URLs are never opened automatically.`}
                    </p>
                  </div>
                </div>
              )}

              {/* GS1 Breakdown if present */}
              {scannedCodeResult.gs1Data && (
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200">
                  {scannedCodeResult.gs1Data.batchNumber && (
                    <div>
                      <span className="text-slate-400 block">{language === 'ar' ? 'تشغيلة GS1:' : 'GS1 Lot:'}</span>
                      <span className="font-bold font-mono text-slate-800">{scannedCodeResult.gs1Data.batchNumber}</span>
                    </div>
                  )}
                  {scannedCodeResult.gs1Data.expiryDate && (
                    <div>
                      <span className="text-slate-400 block">{language === 'ar' ? 'صلاحية GS1:' : 'GS1 Expiry:'}</span>
                      <span className="font-bold font-mono text-slate-800">{scannedCodeResult.gs1Data.expiryDate}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SEARCH STATUS */}
          {searchingDatabase && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
              <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs text-slate-600">
                {language === 'ar' ? 'جاري مطابقة الرمز مع المخزون والدليل الدوائي المعتمد...' : 'Searching inventory and official catalog...'}
              </p>
            </div>
          )}

          {/* CASE 1: MATCH FOUND IN CURRENT USER'S INVENTORY */}
          {matchedExistingItem && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {language === 'ar' 
                    ? `الدواء مسجل بالفعل في ${role === 'wholesaler' ? 'مذخرك' : 'صيدليتك'}!` 
                    : `Medicine already exists in your ${role === 'wholesaler' ? 'warehouse' : 'pharmacy'}!`}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{matchedExistingItem.name}</h4>
                    <p className="text-slate-500 text-[11px]">{matchedExistingItem.activeIngredient} — {matchedExistingItem.strength}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    {language === 'ar' ? 'متوفر' : 'In Stock'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'الكمية الحالية' : 'Stock'}</span>
                    <span className="font-bold">{matchedExistingItem.quantity || matchedExistingItem.stockPacks || 0}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'السعر' : 'Price'}</span>
                    <span className="font-bold">{matchedExistingItem.price || matchedExistingItem.wholesalePriceIqd || 0} د.ع</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">{language === 'ar' ? 'الصلاحية' : 'Expiry'}</span>
                    <span className="font-bold">{matchedExistingItem.expiryDate || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleProceedWithExisting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>{language === 'ar' ? 'تحديث الكمية أو تعديل الدواء' : 'Update Stock / Edit Medicine'}</span>
                </button>
              </div>
            </div>
          )}

          {/* CASE 2: MATCH FOUND IN CENTRAL MEDICINE CATALOG */}
          {matchedCatalogItem && !matchedExistingItem && (
            <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-300 space-y-3">
              <div className="flex items-center gap-2 text-cyan-900 font-bold text-xs sm:text-sm">
                <Sparkles className="w-5 h-5 text-cyan-600 shrink-0" />
                <span>
                  {language === 'ar' ? 'تمت المطابقة مع الدليل الدوائي الوطني المعتمد (Kimadia / MoH)' : 'Matched in National Medicine Catalog (Kimadia / MoH)'}
                </span>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-cyan-200 text-xs space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">{matchedCatalogItem.nameEn} ({matchedCatalogItem.nameAr})</h4>
                <p className="text-slate-600 text-xs">{matchedCatalogItem.activeIngredient} — {matchedCatalogItem.strength} — {matchedCatalogItem.dosageForm}</p>
                <p className="text-slate-500 text-[11px]">{language === 'ar' ? 'المصنع:' : 'Manufacturer:'} {matchedCatalogItem.manufacturer} ({matchedCatalogItem.originCountry || 'العراق'})</p>
              </div>

              <p className="text-xs text-cyan-800">
                {language === 'ar' 
                  ? 'سيتم ملء مواصفات الدواء تلقائياً، ويمكنك إدخال السعر والكمية وتاريخ الصلاحية الخاص بك.' 
                  : 'Product specifications are prefilled. Set your private price, stock, and expiry.'}
              </p>

              <button
                type="button"
                onClick={handleProceedWithNewOrCatalog}
                className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{language === 'ar' ? 'متابعة وتحديد السعر والكمية لمستودعك' : 'Continue to Set Price & Stock'}</span>
              </button>
            </div>
          )}

          {/* CASE 3: NO MATCH YET, OPEN NEW WITH EXTRACTED OR SCANNED DATA */}
          {!matchedExistingItem && !matchedCatalogItem && (scannedCodeResult || ocrExtractedData) && !searchingDatabase && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs">
                <Package className="w-4 h-4 text-emerald-600" />
                <span>
                  {language === 'ar' 
                    ? 'لم يتم العثور على دواء مطابق مسبقاً. هل تود إضافة هذا الدواء كصنف جديد؟' 
                    : 'No matching record found. Would you like to add this as a new medicine?'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {language === 'ar'
                  ? 'سيتم ترحيل رقم الباركود/QR وأي بيانات تم استخراجها بالـ OCR إلى استمارة الإضافة للمراجعة والتأكيد.'
                  : 'The scanned code and OCR data will be prefilled into the addition form for review.'}
              </p>
              <button
                type="button"
                onClick={handleProceedWithNewOrCatalog}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{language === 'ar' ? 'فتح استمارة الإضافة ومراجعة البيانات' : 'Open Addition Form & Review'}</span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              stopScanner();
              // Open empty new medicine form
              onOpenNewMedicineWithPrefill({});
              onClose();
            }}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline"
          >
            {language === 'ar' ? 'إضافة دواء جديد بدون مسح' : 'Add Medicine Manually Without Scan'}
          </button>

          <button
            type="button"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
