import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAuditEvent } from '../lib/auditLogger';
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
  interpretMedicineQueryLocally, 
  checkInventoryDuplicate,
  AssistantInterpretationResult 
} from '../lib/aiMedicineAssistantService';
import { 
  Sparkles, 
  Mic, 
  MicOff, 
  Send, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Pill, 
  Plus, 
  Check, 
  X, 
  Info, 
  ShieldCheck, 
  HeartPulse, 
  Activity, 
  Package, 
  Truck, 
  Building, 
  Calendar, 
  DollarSign, 
  RefreshCw, 
  AlertTriangle,
  FileCheck,
  Volume2
} from 'lucide-react';

interface AiMedicineAssistantProps {
  portalType: 'pharmacy' | 'wholesaler';
  currentUserId: string;
  facilityName: string;
  facilityPhone?: string;
  facilityGovernorate?: string;
  existingMedicines: (MedicineItem | WholesaleMedicineItem)[];
  onMedicinesAdded: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
  isOperable: boolean;
}

// Preset Quick Example Queries requested in spec
const QUICK_PROMPT_EXAMPLES = [
  { ar: 'أريد أدوية اختصاص القلب والضغط', en: 'Cardiology & blood pressure medicines' },
  { ar: 'جهزلي أدوية السكري والغدد', en: 'Diabetes & endocrinology medicines' },
  { ar: 'أريد أدوية الأطفال', en: 'Pediatric medicines' },
  { ar: 'أريد أدوية النسائية والتوليد', en: 'Obstetrics & gynecology medicines' },
  { ar: 'أريد أدوية العظام والكسور', en: 'Orthopedics & joint medicines' },
  { ar: 'أريد أدوية الدم', en: 'Hematology medicines' },
  { ar: 'أريد أدوية الجهاز التنفسي', en: 'Respiratory medicines' },
  { ar: 'أريد أدوية الجهاز الهضمي', en: 'Gastroenterology medicines' },
  { ar: 'أريد قائمة شاملة من أدوية القلب', en: 'Comprehensive cardiology catalog list' },
];

export const AiMedicineAssistant: React.FC<AiMedicineAssistantProps> = ({
  portalType,
  currentUserId,
  facilityName,
  facilityPhone,
  facilityGovernorate,
  existingMedicines,
  onMedicinesAdded,
  showToast,
  isOperable,
}) => {
  const { language, isRTL } = useLanguage();
  const { user } = useAuth();

  // Conversational Query State
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeInterpretation, setActiveInterpretation] = useState<AssistantInterpretationResult | null>(null);

  // Voice Recognition State
  const [isListening, setIsListening] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useState<'ar-IQ' | 'en-US'>('ar-IQ');
  const [voiceInterimText, setVoiceInterimText] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Selection & Review State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [batchResultSummary, setBatchResultSummary] = useState<{
    succeeded: string[];
    failed: { id: string; name: string; error: string }[];
  } | null>(null);

  // Batch Configuration Form Values
  // For Pharmacy
  const [pharmacyUnitPrice, setPharmacyUnitPrice] = useState<number | ''>(5000);
  const [pharmacyQuantity, setPharmacyQuantity] = useState<number | ''>(20);
  // For Wholesaler
  const [wholesalePackPrice, setWholesalePackPrice] = useState<number | ''>(4000);
  const [wholesaleCartonPrice, setWholesaleCartonPrice] = useState<number | ''>(100000);
  const [wholesaleStockPacks, setWholesaleStockPacks] = useState<number | ''>(500);
  const [wholesaleMinOrder, setWholesaleMinOrder] = useState<number | ''>(10);
  // Common Batch Values
  const [commonBatchNumber, setCommonBatchNumber] = useState('');
  const [commonExpiryDate, setCommonExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Load default prompt on initial render to showcase the feature
  useEffect(() => {
    handleExecuteQuery('أريد أدوية اختصاص القلب والضغط');
  }, []);

  // Initialize Speech Recognition on component mount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = voiceLanguage;

        recognition.onstart = () => {
          setIsListening(true);
          setMicError(null);
          setVoiceInterimText('');
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (interim) setVoiceInterimText(interim);
          if (final) {
            setInputText(final);
            setVoiceInterimText('');
            setIsListening(false);
            handleExecuteQuery(final);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition event error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setMicError(
              language === 'ar'
                ? 'تم حظر إذن الميكروفون من المتصفح. يرجى تفعيل الميكروفون أو استخدام الكتابة النصية.'
                : 'Microphone permission denied. Please allow microphone access or use text input.'
            );
          } else if (event.error === 'no-speech') {
            // User did not speak, quiet timeout
          } else {
            setMicError(
              language === 'ar'
                ? `تعذر التعرف الصوتي (${event.error}). تم تحويل الإدخال للكتابة اليدوية.`
                : `Voice recognition issue (${event.error}). Switched to text input.`
            );
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Failed to initialize speech recognition:', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort error
        }
      }
    };
  }, [voiceLanguage, language]);

  // Start or Stop Voice Recognition
  const toggleListening = () => {
    setMicError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(
        language === 'ar'
          ? 'المتصفح الحالي لا يدعم ميزة التسجيل الصوتي المباشر. يرجى كتابة الطلب في مربع النص.'
          : 'Web Speech API is not supported in this browser. Please type your query.'
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (err) {
        console.warn(err);
      }
      setIsListening(false);
    } else {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.lang = voiceLanguage;
          recognitionRef.current.start();
        }
      } catch (err) {
        console.warn('Error starting speech recognition:', err);
        setMicError(
          language === 'ar'
            ? 'تعذر بدء التسجيل الصوتي. يرجى استخدام الكتابة النصية.'
            : 'Could not start voice recognition. Please use text input.'
        );
      }
    }
  };

  // Execute Natural Language Catalog Interpretation
  const handleExecuteQuery = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsProcessing(true);
    setMicError(null);
    setSelectedIds(new Set()); // Reset selections on new search

    try {
      // 1. Try server-side proxy if running
      let serverResult: any = null;
      try {
        const res = await fetch('/api/ai-medicine-assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: q, language }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            serverResult = json.data;
          }
        }
      } catch {
        // Fallback to local deterministic clinical engine
      }

      // 2. Compute verified interpretation using local clinical catalog matcher
      const localResult = interpretMedicineQueryLocally(q);

      // If server returned valid category, reconcile with local matched catalog
      if (serverResult && serverResult.category) {
        const catKey = serverResult.category as MedicalSpecialtyCategory;
        const specialtyDef = SPECIALTY_CATEGORIES.find((c) => c.id === catKey);
        const filtered = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((m) =>
          m.categories.includes(catKey)
        );
        const total = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((m) => m.categories.includes(catKey)).length;

        setActiveInterpretation({
          query: q,
          detectedCategory: catKey,
          categoryTitleAr: specialtyDef?.nameAr || localResult.categoryTitleAr,
          categoryTitleEn: specialtyDef?.nameEn || localResult.categoryTitleEn,
          isComprehensiveRequest: Boolean(serverResult.isComprehensive || localResult.isComprehensiveRequest),
          interpretedIntentAr: serverResult.explanationAr || localResult.interpretedIntentAr,
          interpretedIntentEn: serverResult.explanationEn || localResult.interpretedIntentEn,
          matchedMedicines: filtered.length > 0 ? filtered : localResult.matchedMedicines,
          totalMatches: filtered.length > 0 ? filtered.length : localResult.totalMatches,
          isCompleteCatalogSet: filtered.length === total,
          noMatchReason: filtered.length === 0 ? localResult.noMatchReason : undefined,
        });
      } else {
        setActiveInterpretation(localResult);
      }
    } catch (err) {
      console.error('Error executing AI medicine query:', err);
      showToast(language === 'ar' ? 'فشل معالجة الطلب الدوائي' : 'Failed to process medicine query', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle item selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all or Deselect all
  const handleSelectAll = () => {
    if (!activeInterpretation) return;
    if (selectedIds.size === activeInterpretation.matchedMedicines.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeInterpretation.matchedMedicines.map((m) => m.id)));
    }
  };

  // Open Review & Inventory Addition Modal
  const handleOpenReviewModal = () => {
    if (selectedIds.size === 0) {
      showToast(
        language === 'ar' ? 'يرجى تحديد مستحضر دوائي واحد على الأقل للمتابعة' : 'Please select at least one medicine',
        'error'
      );
      return;
    }
    if (!isOperable) {
      showToast(
        language === 'ar' ? 'يتطلب الإجراء اعتماد المشرف العام للمنشأة' : 'Account approval required by Super Admin',
        'error'
      );
      return;
    }
    setBatchResultSummary(null);
    setShowReviewModal(true);
  };

  // Selected items array
  const selectedMedicines = useMemo(() => {
    if (!activeInterpretation) return [];
    return activeInterpretation.matchedMedicines.filter((m) => selectedIds.has(m.id));
  }, [activeInterpretation, selectedIds]);

  // Check if any selected item is already in inventory
  const duplicateWarnings = useMemo(() => {
    return selectedMedicines.map((item) => {
      const check = checkInventoryDuplicate(item, existingMedicines);
      return { item, ...check };
    });
  }, [selectedMedicines, existingMedicines]);

  // Execute Batch Write to Firestore (Strict Isolation & Decoupling)
  const handleConfirmBatchAddition = async () => {
    if (!user || selectedMedicines.length === 0) return;
    setIsSubmittingBatch(true);
    setBatchProgress({ current: 0, total: selectedMedicines.length });

    const succeededList: string[] = [];
    const failedList: { id: string; name: string; error: string }[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < selectedMedicines.length; i++) {
      const catItem = selectedMedicines[i];
      try {
        if (portalType === 'pharmacy') {
          // ==========================================
          // PHARMACY INVENTORY RECORD
          // ==========================================
          const medId = `med_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const unitPrice = typeof pharmacyUnitPrice === 'number' && pharmacyUnitPrice > 0 ? pharmacyUnitPrice : 0;
          const qty = typeof pharmacyQuantity === 'number' && pharmacyQuantity >= 0 ? pharmacyQuantity : 0;
          // Decoupling Invariant: Available ONLY if both quantity and price > 0
          const isAvail = qty > 0 && unitPrice > 0;

          const pharmacyRecord: MedicineItem = {
            id: medId,
            pharmacyId: user.uid,
            pharmacyName: facilityName,
            pharmacyPhone: facilityPhone || '',
            pharmacyGovernorate: facilityGovernorate || 'بغداد (Baghdad)',
            pharmacyAddress: facilityGovernorate || '',
            catalogMedicineId: catItem.id,
            name: catItem.nameEn,
            activeIngredient: catItem.activeIngredient,
            brand: catItem.brand,
            manufacturer: catItem.manufacturer,
            strength: catItem.strength,
            dosageForm: catItem.dosageForm,
            packageSize: catItem.packageSize,
            barcode: catItem.barcode,
            batchNumber: commonBatchNumber.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            price: unitPrice,
            quantity: qty,
            minStockAlert: 5,
            expiryDate: commonExpiryDate,
            benefits: `${catItem.nameAr} - ${catItem.notes || ''}`.trim(),
            sideEffects: catItem.requiresPrescription ? 'صرف بموجب وصفة طبية أصولية من طبيب اختصاص.' : '',
            requiresPrescription: catItem.requiresPrescription,
            isAvailable: isAvail,
            notes: `تمت الإضافة عبر مساعد الذكاء الاصطناعي من الدليل الدوائي المعتمد (${catItem.registrationNumber || 'كيماديا'})`,
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(doc(db, 'medicines', medId), pharmacyRecord);

          await logAuditEvent({
            action: 'ai_medicine_assistant_batch_add',
            category: 'pharmacy_inventory',
            actorUid: user.uid,
            actorName: facilityName,
            actorRole: 'pharmacy',
            resourceId: medId,
            resourceNumber: catItem.registrationNumber || medId,
            status: 'success',
            details: `إضافة دواء (${catItem.nameEn}) بسعر ${unitPrice} د.ع وكمية ${qty} (التوفر: ${isAvail ? 'متوفر' : 'غير متوفر'})`,
          });
        } else {
          // ==========================================
          // WHOLESALER INVENTORY RECORD
          // ==========================================
          const medId = `wmed_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const packPrice = typeof wholesalePackPrice === 'number' && wholesalePackPrice > 0 ? wholesalePackPrice : 0;
          const cartonPrice = typeof wholesaleCartonPrice === 'number' && wholesaleCartonPrice > 0 ? wholesaleCartonPrice : packPrice * 24;
          const packs = typeof wholesaleStockPacks === 'number' && wholesaleStockPacks >= 0 ? wholesaleStockPacks : 0;
          const moq = typeof wholesaleMinOrder === 'number' && wholesaleMinOrder > 0 ? wholesaleMinOrder : 1;
          const isAvail = packs > 0 && packPrice > 0;

          const wholesalerRecord: WholesaleMedicineItem = {
            id: medId,
            wholesalerId: user.uid,
            wholesalerName: facilityName,
            wholesalerPhone: facilityPhone,
            name: catItem.nameEn,
            nameAr: catItem.nameAr,
            activeIngredient: catItem.activeIngredient,
            manufacturer: catItem.manufacturer,
            originCountry: catItem.originCountry || 'العراق (Iraq)',
            strength: catItem.strength,
            dosageForm: catItem.dosageForm,
            packSize: catItem.packageSize,
            cartonCapacity: 24,
            batchNumber: commonBatchNumber.trim() || `WBAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            productionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            expiryDate: commonExpiryDate,
            wholesalePriceIqd: packPrice,
            cartonPriceIqd: cartonPrice,
            stockPacks: packs,
            minOrderQuantity: moq,
            isAvailable: isAvail,
            category: catItem.categories[0] || 'general_medicine',
            notes: `إضافة جملة عبر مساعد الذكاء الاصطناعي - تسجيل: ${catItem.registrationNumber || 'كيماديا'}`,
            createdAt: now,
            updatedAt: now,
          };

          await setDoc(doc(db, 'wholesale_medicines', medId), wholesalerRecord);

          await logAuditEvent({
            action: 'ai_wholesale_catalog_batch_add',
            category: 'wholesale_b2b',
            actorUid: user.uid,
            actorName: facilityName,
            actorRole: 'wholesaler',
            resourceId: medId,
            resourceNumber: catItem.registrationNumber || medId,
            status: 'success',
            details: `إضافة صنف جملة (${catItem.nameEn}) بسعر مفرد ${packPrice} د.ع ورصيد ${packs} باكت`,
          });
        }

        succeededList.push(catItem.nameEn);
      } catch (err: any) {
        console.error(`Failed to add medicine ${catItem.nameEn}:`, err);
        failedList.push({
          id: catItem.id,
          name: catItem.nameEn,
          error: err?.message || 'Firestore write error',
        });
      }

      setBatchProgress({ current: i + 1, total: selectedMedicines.length });
    }

    setIsSubmittingBatch(false);
    setBatchResultSummary({ succeeded: succeededList, failed: failedList });

    // Refresh parent workspace inventory
    await onMedicinesAdded();

    if (failedList.length === 0) {
      showToast(
        language === 'ar'
          ? `تمت إضافة جميع المستحضرات المحددة (${succeededList.length}) بنجاح إلى مخزونك`
          : `Successfully added all ${succeededList.length} medicines to your inventory`,
        'success'
      );
    } else {
      showToast(
        language === 'ar'
          ? `تمت إضافة ${succeededList.length} مستحضراً وفشل ${failedList.length}`
          : `Added ${succeededList.length} medicines; ${failedList.length} failed`,
        'error'
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-xs font-bold">
              <Sparkles size={14} className="text-teal-300" />
              <span>
                {portalType === 'pharmacy'
                  ? (language === 'ar' ? 'خاص بالصيدليات المعتمدة' : 'Accredited Pharmacy Portal')
                  : (language === 'ar' ? 'خاص بالمذاخر المعتمدة' : 'Accredited Wholesaler Portal')}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3">
              <span>{language === 'ar' ? 'مساعد إضافة الأدوية بالذكاء الاصطناعي' : 'AI Medicine Assistant'}</span>
            </h2>
            <p className="text-sm text-teal-100/90 max-w-2xl leading-relaxed">
              {language === 'ar'
                ? 'تحدث صوتياً أو اكتب باللغة العربية والعراقية للبحث التلقائي في الدليل الدوائي العراقي المعتمد (كيماديا) وإضافة الأصناف دفعة واحدة إلى مخزونك الخاص.'
                : 'Speak or type in Arabic or English to query verified Iraqi Formulary (Kimadia) catalog items and bulk-add them to your inventory.'}
            </p>
          </div>

          {/* Voice Language Selector */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 self-start md:self-auto">
            <span className="text-xs font-semibold px-2 text-teal-200">
              {language === 'ar' ? 'لغة الصوت:' : 'Voice Lang:'}
            </span>
            <button
              onClick={() => setVoiceLanguage('ar-IQ')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                voiceLanguage === 'ar-IQ'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              عربي (العراق)
            </button>
            <button
              onClick={() => setVoiceLanguage('en-US')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                voiceLanguage === 'en-US'
                  ? 'bg-white text-teal-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Mandatory Clinical Safety & Decoupling Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3 text-xs leading-relaxed">
        <ShieldCheck size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong>
            {language === 'ar'
              ? 'ضوابط الأمان السريري وفصل المخزون:'
              : 'Clinical Safety & Inventory Decoupling Protocol:'}
          </strong>
          <p className="text-amber-900">
            {language === 'ar'
              ? 'هذا المساعد مخصص حصراً للبحث والتصنيف الصيدلاني والإضافة المجمعة للمخزون، ولا يقدم أي استشارات طبية أو وصفات للمرضى. اختيار أي دواء من الدليل لا يجعله متوفراً تلقائياً؛ يجب تحديد الرصيد والسعر الفعلي لاعتباره متوفراً للبيع.'
              : 'This assistant operates strictly for catalog retrieval, categorization, and inventory addition. It does not prescribe medications. Catalog items remain unavailable until physical stock and prices are confirmed.'}
          </p>
        </div>
      </div>

      {/* Interactive Conversational Input Bar (Voice & Text) */}
      <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {language === 'ar' ? 'تحدث عبر الميكروفون أو اكتب طلبك باللغة الطبيعية:' : 'Speak via microphone or type your natural query:'}
        </label>

        <div className="flex items-center gap-3">
          {/* Main Input Field */}
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExecuteQuery(inputText);
              }}
              placeholder={
                isListening
                  ? (language === 'ar' ? 'جاري الاستماع لصوتك الآن...' : 'Listening to your voice...')
                  : (language === 'ar' ? 'مثال: أريد أدوية اختصاص القلب والضغط أو جهزلي أدوية الأطفال...' : 'e.g. I need pediatric medicines or cardiology medications...')
              }
              className={`w-full px-5 py-4 rounded-2xl text-sm border transition-all outline-none ${
                isListening
                  ? 'border-red-400 ring-4 ring-red-100 bg-red-50/30'
                  : 'border-slate-300 focus:border-teal-600 focus:ring-4 focus:ring-teal-100 bg-slate-50 focus:bg-white'
              }`}
            />
            {inputText && (
              <button
                onClick={() => setInputText('')}
                className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Voice Microphone Toggle Button */}
          <button
            onClick={toggleListening}
            title={isListening ? (language === 'ar' ? 'إيقاف التسجيل' : 'Stop Recording') : (language === 'ar' ? 'تحدث عبر الميكروفون' : 'Speak via microphone')}
            className={`p-4 rounded-2xl transition-all flex items-center justify-center cursor-pointer shadow-sm relative ${
              isListening
                ? 'bg-red-600 text-white animate-pulse shadow-red-200 shadow-lg'
                : 'bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100'
            }`}
          >
            {isListening ? <MicOff size={22} /> : <Mic size={22} />}
            {isListening && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
            )}
          </button>

          {/* Submit Search Button */}
          <button
            onClick={() => handleExecuteQuery(inputText)}
            disabled={isProcessing || !inputText.trim()}
            className="px-6 py-4 rounded-2xl bg-[#00796b] hover:bg-[#00695c] active:scale-95 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isProcessing ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <>
                <span>{language === 'ar' ? 'بحث ذكي' : 'Search'}</span>
                <Send size={16} className={isRTL ? 'rotate-180' : ''} />
              </>
            )}
          </button>
        </div>

        {/* Live Audio Waves / Recording Status */}
        {isListening && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between text-xs text-red-800 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="font-bold">
                {language === 'ar' ? 'جاري الاستماع عبر الميكروفون...' : 'Listening to speech...'}
              </span>
              {voiceInterimText && (
                <span className="text-red-900 font-mono bg-white/80 px-2 py-0.5 rounded-lg border border-red-200">
                  "{voiceInterimText}"
                </span>
              )}
            </div>
            <button
              onClick={() => {
                recognitionRef.current?.stop();
                setIsListening(false);
              }}
              className="text-xs font-bold text-red-700 hover:text-red-900 underline cursor-pointer"
            >
              {language === 'ar' ? 'إنهاء التحدث' : 'Finish speaking'}
            </button>
          </div>
        )}

        {/* Microphone Error Alert with Immediate Text Fallback Guide */}
        {micError && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-xs">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>{micError}</span>
          </div>
        )}

        {/* Quick Voice / Prompt Suggestion Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500">
            {language === 'ar' ? 'أمثلة جاهزة للنقر الفوري أو التحدث بها:' : 'Quick examples to click or speak:'}
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPT_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(ex.ar);
                  handleExecuteQuery(ex.ar);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-xs font-medium text-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={12} className="text-teal-600" />
                <span>{language === 'ar' ? ex.ar : ex.en}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interpretation & Feedback Box */}
      {activeInterpretation && (
        <div className="p-5 rounded-3xl bg-teal-50/80 border border-teal-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                AI
              </div>
              <span className="text-xs font-bold text-teal-900">
                {language === 'ar' ? activeInterpretation.interpretedIntentAr : activeInterpretation.interpretedIntentEn}
              </span>
            </div>

            {activeInterpretation.isCompleteCatalogSet && (
              <span className="px-3 py-1 rounded-full bg-teal-200/70 text-teal-900 text-[11px] font-bold border border-teal-300 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-teal-700" />
                <span>{language === 'ar' ? 'قائمة شاملة لكافة أدوية الاختصاص' : 'Complete Specialty Catalog Set'}</span>
              </span>
            )}
          </div>

          <div className="text-xs text-teal-800/90 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-teal-200/50">
            <div>
              <span>{language === 'ar' ? 'المستحضرات المطابقة المسترجعة:' : 'Matched records retrieved:'} </span>
              <strong className="font-mono text-sm font-black text-teal-950">
                {activeInterpretation.totalMatches}
              </strong>{' '}
              {language === 'ar' ? 'مستحضراً معتمداً' : 'items'}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="text-xs font-bold text-teal-900 hover:text-teal-700 underline cursor-pointer"
              >
                {selectedIds.size === activeInterpretation.matchedMedicines.length
                  ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                  : (language === 'ar' ? 'تحديد كل النتائج' : 'Select All Results')}
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleOpenReviewModal}
                  className="px-4 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>
                    {language === 'ar'
                      ? `متابعة الإضافة المجمعة (${selectedIds.size})`
                      : `Proceed to Add (${selectedIds.size})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Matches Found Banner */}
      {activeInterpretation && activeInterpretation.totalMatches === 0 && (
        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200 text-center space-y-3">
          <AlertTriangle size={36} className="mx-auto text-amber-500" />
          <h3 className="text-base font-bold text-slate-800">
            {language === 'ar' ? 'لا توجد أدوية مطابقة في الدليل المعتمد' : 'No matching medicines in verified catalog'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            {language === 'ar'
              ? 'حرصاً على السلامة السريرية، لا يقوم النظام بابتكار أو تخمين أسماء أدوية وهمية. يرجى تجربة البحث باسم التخصص الطبي (مثل: القلبية، الأطفال، السكري، العظام، أو الدم).'
              : 'To preserve patient safety, the system never fabricates fictitious drugs. Try searching by medical specialty (e.g., Cardiology, Pediatrics, Diabetes, Orthopedics, or Hematology).'}
          </p>
        </div>
      )}

      {/* Matched Medicines Grid */}
      {activeInterpretation && activeInterpretation.matchedMedicines.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-teal-700" />
              <span>{language === 'ar' ? 'المستحضرات المسترجعة من الكتالوج المعتمد:' : 'Retrieved Formulary Medicines:'}</span>
            </h3>
            <span className="text-xs font-semibold text-slate-500">
              {language === 'ar'
                ? `تم تحديد ${selectedIds.size} من أصل ${activeInterpretation.matchedMedicines.length}`
                : `Selected ${selectedIds.size} of ${activeInterpretation.matchedMedicines.length}`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeInterpretation.matchedMedicines.map((item) => {
              const isSelected = selectedIds.has(item.id);
              const { isDuplicate, existingRecord } = checkInventoryDuplicate(item, existingMedicines);

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 shadow-md ring-2 ring-teal-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  {/* Top Details & Selection Checkbox */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                            {item.id}
                          </span>
                          {item.requiresPrescription ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                              Rx وصفة إلزامية
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              OTC بدون وصفة
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-1 leading-snug">
                          {item.nameEn}
                        </h4>
                        <p className="text-xs font-bold text-teal-700">{item.nameAr}</p>
                      </div>

                      {/* Checkbox indicator */}
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          isSelected
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'border-2 border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check size={16} strokeWidth={3} />}
                      </div>
                    </div>

                    {/* Chemical formulation & specs */}
                    <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-slate-400">{language === 'ar' ? 'المادة الفعالة: ' : 'Active: '}</span>
                        <strong className="text-slate-800">{item.activeIngredient}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>{item.strength}</span>
                        <span className="text-slate-500">{item.dosageForm}</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.packageSize} • {item.manufacturer}
                      </div>
                    </div>
                  </div>

                  {/* Stock Status Badge */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    {isDuplicate ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                        <AlertTriangle size={13} className="shrink-0" />
                        <span>
                          {language === 'ar'
                            ? 'مسجل مسبقاً في مخزونك'
                            : 'Already in your inventory'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                        <Pill size={13} className="text-slate-400 shrink-0" />
                        <span>
                          {language === 'ar' ? 'صنف جديد غير مسجل' : 'New uncataloged item'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bottom Bar when items are selected */}
      {selectedIds.size > 0 && !showReviewModal && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 animate-bounce-subtle">
          <div className="text-xs font-bold">
            <span>{language === 'ar' ? 'تم اختيار ' : 'Selected '}</span>
            <span className="text-teal-400 font-mono text-sm">{selectedIds.size}</span>
            <span>{language === 'ar' ? ' مستحضراً' : ' medicines'}</span>
          </div>
          <button
            onClick={handleOpenReviewModal}
            className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <FileCheck size={15} />
            <span>{language === 'ar' ? 'متابعة وإدخال الأسعار والمخزون' : 'Set Stock & Prices'}</span>
          </button>
        </div>
      )}

      {/* Review & Batch Addition Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'ar'
                      ? 'مراجعة وتأكيد الإضافة المجمعة للمخزون'
                      : 'Review & Confirm Batch Inventory Addition'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? `سيتم حفظ ${selectedMedicines.length} مستحضراً في قاعدة بيانات منشأتك الرسمية.`
                      : `Saving ${selectedMedicines.length} medicines into your official database.`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={isSubmittingBatch}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Inventory Decoupling Warning */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs leading-relaxed flex items-start gap-3">
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>{language === 'ar' ? 'مبدأ الفصل السريري للمخزون:' : 'Clinical Inventory Decoupling:'}</strong>{' '}
                {language === 'ar'
                  ? 'لن يظهر أي دواء كمتوفر (isAvailable = false) للمرضى أو الصيدليات ما لم تقم بتحديد سعر صالح ورصيد فيزيائي أكبر من صفر.'
                  : 'Items remain unavailable (isAvailable = false) until physical stock and price greater than zero are set.'}
              </div>
            </div>

            {/* Batch Configuration Inputs */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {language === 'ar' ? 'إعدادات الوجبة والأسعار الموحدة:' : 'Batch & Pricing Defaults:'}
              </h4>

              {portalType === 'pharmacy' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'سعر البيع الافتراضي (دينار عراقي IQD):' : 'Default Retail Price (IQD):'}
                    </label>
                    <input
                      type="number"
                      value={pharmacyUnitPrice}
                      onChange={(e) => setPharmacyUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'الكمية الافتراضية بالمخزن (قطع):' : 'Default Quantity (Packs):'}
                    </label>
                    <input
                      type="number"
                      value={pharmacyQuantity}
                      onChange={(e) => setPharmacyQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'سعر الجملة للباكت (IQD):' : 'Wholesale Pack Price (IQD):'}
                    </label>
                    <input
                      type="number"
                      value={wholesalePackPrice}
                      onChange={(e) => setWholesalePackPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'سعر الكارتون (IQD):' : 'Carton Price (IQD):'}
                    </label>
                    <input
                      type="number"
                      value={wholesaleCartonPrice}
                      onChange={(e) => setWholesaleCartonPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'الرصيد المتاح (باكتات):' : 'Stock Packs:'}
                    </label>
                    <input
                      type="number"
                      value={wholesaleStockPacks}
                      onChange={(e) => setWholesaleStockPacks(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'أقل كمية للطلب (MOQ):' : 'Min Order Qty:'}
                    </label>
                    <input
                      type="number"
                      value={wholesaleMinOrder}
                      onChange={(e) => setWholesaleMinOrder(e.target.value === '' ? '' : Number(e.target.value))}
                      min={1}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Expiry Date and Batch Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'تاريخ انتهاء الصلاحية:' : 'Expiry Date:'}
                  </label>
                  <input
                    type="date"
                    value={commonExpiryDate}
                    onChange={(e) => setCommonExpiryDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'رقم الوجبة / التشغيلة (Batch/Lot Number):' : 'Batch / Lot Number:'}
                  </label>
                  <input
                    type="text"
                    value={commonBatchNumber}
                    onChange={(e) => setCommonBatchNumber(e.target.value)}
                    placeholder={`LOT-${new Date().getFullYear()}-001`}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Selected Items Review Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {language === 'ar' ? 'قائمة المستحضرات المحددة للإضافة:' : 'Medicines Queued for Addition:'}
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {duplicateWarnings.map(({ item, isDuplicate }) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{item.nameEn}</span>
                      <span className="text-slate-500 font-normal">({item.nameAr})</span>
                      {isDuplicate && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                          {language === 'ar' ? 'مكرر' : 'Duplicate'}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-slate-500 text-[11px]">{item.strength}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Submission Progress Bar */}
            {isSubmittingBatch && (
              <div className="space-y-2 p-4 rounded-2xl bg-teal-50 border border-teal-200 text-teal-900 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span>{language === 'ar' ? 'جاري حفظ الأصناف في قاعدة البيانات...' : 'Writing records to Firestore...'}</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-teal-200 overflow-hidden">
                  <div
                    className="h-full bg-teal-600 transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Batch Result Summary if completed */}
            {batchResultSummary && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>
                    {language === 'ar'
                      ? `اكتملت العملية: تمت إضافة ${batchResultSummary.succeeded.length} مستحضراً.`
                      : `Operation completed: Added ${batchResultSummary.succeeded.length} medicines.`}
                  </span>
                </div>
                {batchResultSummary.failed.length > 0 && (
                  <div className="text-red-700 font-bold">
                    <span>{language === 'ar' ? 'المستحضرات التي تعذر حفظها: ' : 'Failed items: '}</span>
                    {batchResultSummary.failed.map((f) => f.name).join(', ')}
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowReviewModal(false)}
                disabled={isSubmittingBatch}
                className="px-5 py-2.5 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                {batchResultSummary ? (language === 'ar' ? 'إغلاق' : 'Close') : (language === 'ar' ? 'إلغاء' : 'Cancel')}
              </button>

              {!batchResultSummary && (
                <button
                  onClick={handleConfirmBatchAddition}
                  disabled={isSubmittingBatch}
                  className="px-6 py-2.5 rounded-xl bg-[#00796b] hover:bg-[#00695c] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingBatch ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>
                    {language === 'ar'
                      ? `تأكيد وإضافة (${selectedMedicines.length}) مستحضرات`
                      : `Confirm & Add (${selectedMedicines.length}) Medicines`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
