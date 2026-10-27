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
import { DosageFormVisual } from './DosageFormVisual';
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
  Volume2,
  BookmarkCheck,
  ShieldAlert,
  ArrowRight,
  GitCompare,
  CheckCircle
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

// Preset Quick Iraqi & Arabic Conversational Prompts
const QUICK_PROMPT_EXAMPLES = [
  { ar: 'أريد أدوية اختصاص القلب والضغط', en: 'Cardiology & blood pressure medicines' },
  { ar: 'اعرضلي أصناف الأطفال', en: 'Pediatric medicines' },
  { ar: 'ابحثلي عن هذا الدواء وإذا مو موجود شوف البدائل المكافئة', en: 'Search drug and show bioequivalent substitutes' },
  { ar: 'شنو بديل البنادول', en: 'What is the equivalent for Panadol?' },
  { ar: 'أريد أدوية العظام والكسور وآلام المفاصل', en: 'Orthopedics & joint medicines' },
  { ar: 'جهزلي أدوية السكري والغدد', en: 'Diabetes & endocrinology medicines' },
  { ar: 'أريد أدوية أمراض الدم والتخثر', en: 'Hematology medicines' },
  { ar: 'أدوية الجهاز التنفسي والربو', en: 'Respiratory & asthma medications' },
  { ar: 'أدوية الجهاز الهضمي والمعدة', en: 'Gastroenterology medicines' },
  { ar: 'أدوية النسائية والتوليد', en: 'Obstetrics & gynecology medicines' },
  { ar: 'أدوية المسالك البولية والكلى', en: 'Urology & renal medicines' },
  { ar: 'أدوية العيون والقطرات', en: 'Ophthalmology medicines' },
  { ar: 'أدوية الأنف والأذن والحنجرة', en: 'ENT medications' },
  { ar: 'أدوية الأعصاب والتشنجات', en: 'Neurology medications' },
  { ar: 'أدوية الجلدية والأكزيما', en: 'Dermatology medicines' },
  { ar: 'الطب العام والمسكنات', en: 'General medicine & analgesics' },
];

interface CustomRowConfig {
  price: number;
  quantity: number;
  cartonPrice?: number;
  minOrderQuantity?: number;
  batchNumber: string;
  expiryDate: string;
}

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

  // Common Batch Configuration Form Values
  const [pharmacyUnitPrice, setPharmacyUnitPrice] = useState<number | ''>(5000);
  const [pharmacyQuantity, setPharmacyQuantity] = useState<number | ''>(20);
  const [wholesalePackPrice, setWholesalePackPrice] = useState<number | ''>(4000);
  const [wholesaleCartonPrice, setWholesaleCartonPrice] = useState<number | ''>(100000);
  const [wholesaleStockPacks, setWholesaleStockPacks] = useState<number | ''>(500);
  const [wholesaleMinOrder, setWholesaleMinOrder] = useState<number | ''>(10);
  const [commonBatchNumber, setCommonBatchNumber] = useState('');
  const [commonExpiryDate, setCommonExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  // Per-row customization override dictionary
  const [customRowConfigs, setCustomRowConfigs] = useState<Record<string, CustomRowConfig>>({});

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
          console.warn('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setMicError(
              language === 'ar'
                ? 'تم حظر إذن الميكروفون من المتصفح. يرجى تفعيل الميكروفون أو استخدام الكتابة النصية.'
                : 'Microphone permission denied. Please allow microphone access or use text input.'
            );
          } else if (event.error !== 'no-speech') {
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
          // ignore cleanup abort
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

  // Execute Natural Language Catalog Interpretation with 4-Tier Support
  const handleExecuteQuery = async (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    setIsProcessing(true);
    setMicError(null);
    setSelectedIds(new Set()); // Reset selections on new search

    try {
      // 1. Compute verified interpretation using local clinical catalog & 4-tier engine
      const localResult = interpretMedicineQueryLocally(q);
      setActiveInterpretation(localResult);
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

    // Populate initial row configurations
    const initialConfigs: Record<string, CustomRowConfig> = {};
    const defaultBatch = commonBatchNumber.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const defaultExp = commonExpiryDate;

    selectedMedicines.forEach((med) => {
      if (portalType === 'pharmacy') {
        initialConfigs[med.id] = {
          price: typeof pharmacyUnitPrice === 'number' ? pharmacyUnitPrice : 5000,
          quantity: typeof pharmacyQuantity === 'number' ? pharmacyQuantity : 20,
          batchNumber: defaultBatch,
          expiryDate: defaultExp,
        };
      } else {
        const pPrice = typeof wholesalePackPrice === 'number' ? wholesalePackPrice : 4000;
        initialConfigs[med.id] = {
          price: pPrice,
          cartonPrice: typeof wholesaleCartonPrice === 'number' ? wholesaleCartonPrice : pPrice * 24,
          quantity: typeof wholesaleStockPacks === 'number' ? wholesaleStockPacks : 500,
          minOrderQuantity: typeof wholesaleMinOrder === 'number' ? wholesaleMinOrder : 10,
          batchNumber: defaultBatch,
          expiryDate: defaultExp,
        };
      }
    });

    setCustomRowConfigs(initialConfigs);
    setBatchResultSummary(null);
    setShowReviewModal(true);
  };

  // Update a single field in customRowConfigs
  const handleUpdateRowConfig = (id: string, field: keyof CustomRowConfig, value: any) => {
    setCustomRowConfigs((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] || {
          price: 5000,
          quantity: 20,
          batchNumber: '',
          expiryDate: commonExpiryDate,
        }),
        [field]: value,
      },
    }));
  };

  // Apply common defaults to all selected rows
  const handleApplyDefaultsToAll = () => {
    const updated: Record<string, CustomRowConfig> = {};
    const defaultBatch = commonBatchNumber.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    selectedMedicines.forEach((med) => {
      if (portalType === 'pharmacy') {
        updated[med.id] = {
          price: typeof pharmacyUnitPrice === 'number' ? pharmacyUnitPrice : 5000,
          quantity: typeof pharmacyQuantity === 'number' ? pharmacyQuantity : 20,
          batchNumber: defaultBatch,
          expiryDate: commonExpiryDate,
        };
      } else {
        const pPrice = typeof wholesalePackPrice === 'number' ? wholesalePackPrice : 4000;
        updated[med.id] = {
          price: pPrice,
          cartonPrice: typeof wholesaleCartonPrice === 'number' ? wholesaleCartonPrice : pPrice * 24,
          quantity: typeof wholesaleStockPacks === 'number' ? wholesaleStockPacks : 500,
          minOrderQuantity: typeof wholesaleMinOrder === 'number' ? wholesaleMinOrder : 10,
          batchNumber: defaultBatch,
          expiryDate: commonExpiryDate,
        };
      }
    });

    setCustomRowConfigs(updated);
    showToast(
      language === 'ar' ? 'تم تطبيق القيم الافتراضية على كافة الأصناف المحددة' : 'Applied defaults to all selected items',
      'success'
    );
  };

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
      const rowCfg = customRowConfigs[catItem.id] || {
        price: 5000,
        quantity: 20,
        batchNumber: `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        expiryDate: commonExpiryDate,
      };

      try {
        if (portalType === 'pharmacy') {
          // ==========================================
          // PHARMACY INVENTORY RECORD
          // Target Collection: /medicines/{medId}
          // Strict Tenancy: pharmacyId == user.uid
          // ==========================================
          const medId = `med_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const unitPrice = Number(rowCfg.price) > 0 ? Number(rowCfg.price) : 0;
          const qty = Number(rowCfg.quantity) >= 0 ? Number(rowCfg.quantity) : 0;
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
            nameAr: catItem.nameAr,
            activeIngredient: catItem.activeIngredient,
            brand: catItem.brand,
            manufacturer: catItem.manufacturer,
            strength: catItem.strength,
            dosageForm: catItem.dosageForm,
            packageSize: catItem.packageSize,
            barcode: catItem.barcode,
            batchNumber: rowCfg.batchNumber || `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            price: unitPrice,
            quantity: qty,
            minStockAlert: 5,
            expiryDate: rowCfg.expiryDate || commonExpiryDate,
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
            details: `إضافة دواء (${catItem.nameEn}) بسعر ${unitPrice} د.ع وكمية ${qty} وجبة ${pharmacyRecord.batchNumber}`,
          });
        } else {
          // ==========================================
          // WHOLESALER INVENTORY RECORD
          // Target Collection: /wholesale_medicines/{medId}
          // Strict Tenancy: wholesalerId == user.uid
          // ==========================================
          const medId = `wmed_ai_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const packPrice = Number(rowCfg.price) > 0 ? Number(rowCfg.price) : 0;
          const cartonPrice = Number(rowCfg.cartonPrice) > 0 ? Number(rowCfg.cartonPrice) : packPrice * 24;
          const packs = Number(rowCfg.quantity) >= 0 ? Number(rowCfg.quantity) : 0;
          const moq = Number(rowCfg.minOrderQuantity) > 0 ? Number(rowCfg.minOrderQuantity) : 1;
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
            batchNumber: rowCfg.batchNumber || `WBAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            productionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            expiryDate: rowCfg.expiryDate || commonExpiryDate,
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
          ? `تمت إضافة كافة المستحضرات المحددة (${succeededList.length}) بنجاح إلى مخزونك`
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
              <span>{language === 'ar' ? 'مساعد إدخال الأدوية والبحث الذكي' : 'AI Medicine Intake & Smart Search Assistant'}</span>
            </h2>
            <p className="text-sm text-teal-100/90 max-w-2xl leading-relaxed">
              {language === 'ar'
                ? 'يفهم الأوامر الصوتية والنصية بالعربية واللهجة العراقية، والإنجليزية، للبحث في كتالوج الأدوية المعتمد، وفرز البدائل والمكافئ الحيوي وفق هرمية سريرية صارمة، والإضافة المجمعة للمخزون.'
                : 'Understands Arabic, Iraqi dialect, and English speech & text to query the central formulary, analyze 4-tier bioequivalence, and batch-intake items into inventory.'}
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

      {/* Mandatory Clinical Safety & Strict 4-Tier Equivalence Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-start gap-3 text-xs leading-relaxed">
        <ShieldCheck size={20} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <strong className="block text-amber-900 font-bold">
            {language === 'ar'
              ? 'ميثاق الأمان الصيدلاني وهرمية البدائل الأربعة:'
              : 'Pharmaceutical Safety & 4-Tier Equivalence Protocol:'}
          </strong>
          <p className="text-amber-900">
            {language === 'ar'
              ? 'يتبع النظام هرمية إلزامية صارمة: (1) الدواء الأصلي إن وُجد بنفس التركيز والشكل، (2) بديل يحتوي على نفس المادة الفعالة مع مقارنة التركيز والشكل، (3) مكافئ حيوي معتمد طبياً وموثق. وإذا لم يتوفر ذلك يُرفض تغيير المادة الفعالة ويصدر إشعار التنبيه الصريح لمراجعة الصيدلي أو الطبيب.'
              : 'Strict 4-tier hierarchy: (1) Original exact formulation, (2) Same active ingredient with strength & form comparison, (3) Documented bioequivalent alternative, (4) Strict rejection of different compositions with explicit pharmacist consultation notice.'}
          </p>
        </div>
      </div>

      {/* Interactive Input Bar (Voice & Text with Iraqi Dialect Support) */}
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
                  : (language === 'ar' ? 'مثال: «أريد أدوية القلب والضغط» أو «اعرضلي أصناف الأطفال» أو «ابحثلي عن هذا الدواء وإذا مو موجود شوف البدائل المكافئة»' : 'e.g. «I need pediatric medicines» or «Search Plavix and show bioequivalent alternatives»')
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
                className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
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
                <span>{language === 'ar' ? 'معالجة ذكية' : 'Process Query'}</span>
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

        {/* Microphone Error Alert */}
        {micError && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-3 text-xs">
            <AlertCircle size={18} className="text-amber-600 shrink-0" />
            <span>{micError}</span>
          </div>
        )}

        {/* Quick Voice / Prompt Suggestion Chips */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
            <span>{language === 'ar' ? 'أوامر شائعة باللهجة العراقية والعربية يمكنك النقر عليها أو نطقها:' : 'Common Iraqi & Arabic voice prompts:'}</span>
            <span className="text-[10px] text-teal-700 font-semibold">{QUICK_PROMPT_EXAMPLES.length} خيار جاهز</span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
            {QUICK_PROMPT_EXAMPLES.map((ex, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(ex.ar);
                  handleExecuteQuery(ex.ar);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 border border-slate-200 text-xs font-medium text-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles size={12} className="text-teal-600 shrink-0" />
                <span>{language === 'ar' ? ex.ar : ex.en}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assistant Interpretation & Feedback Box */}
      {activeInterpretation && (
        <div className="p-5 rounded-3xl bg-teal-50/80 border border-teal-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                AI
              </div>
              <span className="text-xs font-bold text-teal-900 leading-snug">
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

          {/* Equivalence / Substitute Summary Header */}
          {activeInterpretation.equivalenceResult && (
            <div className="p-3.5 rounded-2xl bg-white border border-teal-200/80 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <GitCompare size={15} className="text-teal-600" />
                <span>
                  {language === 'ar' ? 'تحليل البدائل والمكافئ الحيوي:' : 'Bioequivalence & Substitute Analysis:'}
                </span>
                {activeInterpretation.targetDrugForSubstitute && (
                  <span className="font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md">
                    "{activeInterpretation.targetDrugForSubstitute}"
                  </span>
                )}
              </div>

              {activeInterpretation.equivalenceResult.isRejectedTier4 ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
                  <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold">المستوى الرابع: تنبيه سريري إلزامي</strong>
                    <p className="font-semibold text-rose-800 leading-relaxed">
                      «{activeInterpretation.equivalenceResult.mandatoryNoticeAr}»
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                    <div className="font-bold">المستوى 1: الدواء الأصلي</div>
                    <div>{activeInterpretation.equivalenceResult.tier1ExactMatches.length} مستحضر مطابق</div>
                  </div>
                  <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-900">
                    <div className="font-bold">المستوى 2: نفس المادة الفعالة</div>
                    <div>{activeInterpretation.equivalenceResult.tier2SameActiveSubstitutes.length} بدائل بنفس المادة</div>
                  </div>
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                    <div className="font-bold">المستوى 3: مكافئ حيوي معتمد</div>
                    <div>{activeInterpretation.equivalenceResult.tier3BioequivalentSubstitutes.length} مكافئ موثق سريرياً</div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-teal-800/90 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-teal-200/50">
            <div>
              <span>{language === 'ar' ? 'المستحضرات المسترجعة:' : 'Matched records retrieved:'} </span>
              <strong className="font-mono text-sm font-black text-teal-950">
                {activeInterpretation.totalMatches}
              </strong>{' '}
              {language === 'ar' ? 'مستحضراً معتمداً' : 'items'}
            </div>

            <div className="flex items-center gap-3">
              {activeInterpretation.matchedMedicines.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-bold text-teal-900 hover:text-teal-700 underline cursor-pointer"
                >
                  {selectedIds.size === activeInterpretation.matchedMedicines.length
                    ? (language === 'ar' ? 'إلغاء تحديد الكل' : 'Deselect All')
                    : (language === 'ar' ? 'تحديد كل النتائج' : 'Select All Results')}
                </button>
              )}
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
          <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
            {language === 'ar'
              ? '«لم نعثر على بديل مكافئ مؤكّد في الكتالوج. يمكن مراجعة الصيدلي المختص أو الطبيب للتحقق من الخيارات المناسبة». حرصاً على السلامة السريرية، يمتنع النظام عن توليد أو اختلاق أي أدوية وهمية.'
              : '«No confirmed equivalent substitute found in the catalog. Please consult the attending pharmacist or physician to verify suitable therapeutic alternatives». Fictitious drugs are never fabricated.'}
          </p>
        </div>
      )}

      {/* Matched Medicines Grid with Dosage Form Visual */}
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

              // Check if item belongs to a specific tier in equivalence analysis
              let tierBadge: { labelAr: string; color: string } | null = null;
              if (activeInterpretation.equivalenceResult) {
                if (activeInterpretation.equivalenceResult.tier1ExactMatches.some((m) => m.medicine.id === item.id)) {
                  tierBadge = { labelAr: 'المستوى 1: أصلي مطابق', color: 'bg-emerald-600 text-white' };
                } else if (activeInterpretation.equivalenceResult.tier2SameActiveSubstitutes.some((m) => m.medicine.id === item.id)) {
                  tierBadge = { labelAr: 'المستوى 2: نفس المادة', color: 'bg-teal-600 text-white' };
                } else if (activeInterpretation.equivalenceResult.tier3BioequivalentSubstitutes.some((m) => m.medicine.id === item.id)) {
                  tierBadge = { labelAr: 'المستوى 3: مكافئ حيوي', color: 'bg-blue-600 text-white' };
                }
              }

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
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      {/* Pharmaceutical Dosage Form Visual / Photo */}
                      <DosageFormVisual
                        dosageForm={item.dosageForm}
                        photoUrl={item.imageUrl}
                        name={item.nameEn}
                        size="md"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                            {item.id}
                          </span>
                          {tierBadge && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tierBadge.color}`}>
                              {tierBadge.labelAr}
                            </span>
                          )}
                          {item.requiresPrescription ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                              Rx وصفة
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                              OTC بدون وصفة
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-slate-900 mt-1 leading-snug truncate">
                          {item.nameEn}
                        </h4>
                        <p className="text-xs font-bold text-teal-700 truncate">{item.nameAr}</p>
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
                        <span className="font-mono font-bold text-slate-700">{item.strength}</span>
                        <span className="text-slate-500">{item.dosageForm}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.packageSize} • {item.manufacturer}
                      </div>
                    </div>
                  </div>

                  {/* Stock Status & Duplicate Detection Badge */}
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    {isDuplicate ? (
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                          <span>{language === 'ar' ? 'مسجل مسبقاً بالمخزون' : 'Already in inventory'}</span>
                        </div>
                        {existingRecord && 'price' in existingRecord && (
                          <span className="font-mono text-[10px] text-amber-900">
                            {existingRecord.price} د.ع (رصيد: {existingRecord.quantity})
                          </span>
                        )}
                        {existingRecord && 'wholesalePriceIqd' in existingRecord && (
                          <span className="font-mono text-[10px] text-amber-900">
                            {existingRecord.wholesalePriceIqd} د.ع (باكت: {existingRecord.stockPacks})
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
                        <Pill size={13} className="text-slate-400 shrink-0" />
                        <span>{language === 'ar' ? 'صنف جديد غير مسجل' : 'New uncataloged item'}</span>
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
            <span>{language === 'ar' ? 'متابعة وتأكيد المخزون والأسعار' : 'Set Stock & Prices'}</span>
          </button>
        </div>
      )}

      {/* Meticulous Bulk Review & Intake Checklist Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <BookmarkCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {language === 'ar'
                      ? 'قائمة المراجعة الدقيقة وتأكيد الإضافة المجمعة'
                      : 'Bulk Intake Checklist & Inventory Review'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? `مراجعة ${selectedMedicines.length} مستحضراً قبل الحفظ في مخزون ${facilityName}.`
                      : `Reviewing ${selectedMedicines.length} medicines before committing to ${facilityName}.`}
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

            {/* Inventory Decoupling & Duplicate Protection Notice */}
            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs leading-relaxed flex items-start gap-3">
              <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>{language === 'ar' ? 'ضوابط الإدخال السريري:' : 'Clinical Intake Protocol:'}</strong>{' '}
                {language === 'ar'
                  ? 'يتطلب النظام تأكيد الكمية، السعر، رقم الوجبة (Batch Number)، وتاريخ انتهاء الصلاحية لكل صنف. لن يظهر أي دواء كمتوفر (isAvailable) ما لم يكن سعره ورصيده أكبر من صفر لمنع طلبات غير متوفرة.'
                  : 'Requires confirming quantity, price, batch number, and expiry date. Items remain unavailable unless stock and price are confirmed.'}
              </div>
            </div>

            {/* Common Defaults Section */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {language === 'ar' ? 'إعدادات موحدة لتطبيقها على كافة الأصناف:' : 'Common Defaults for All Items:'}
                </h4>
                <button
                  type="button"
                  onClick={handleApplyDefaultsToAll}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 underline cursor-pointer"
                >
                  {language === 'ar' ? 'تطبيق على كل القائمة' : 'Apply to all rows'}
                </button>
              </div>

              {portalType === 'pharmacy' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'سعر البيع (دينار عراقي IQD):' : 'Retail Price (IQD):'}
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
                      {language === 'ar' ? 'الكمية المتوفرة (قطع):' : 'Quantity (Packs):'}
                    </label>
                    <input
                      type="number"
                      value={pharmacyQuantity}
                      onChange={(e) => setPharmacyQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                      min={0}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'رقم الوجبة (Batch Number):' : 'Batch / Lot Number:'}
                    </label>
                    <input
                      type="text"
                      value={commonBatchNumber}
                      onChange={(e) => setCommonBatchNumber(e.target.value)}
                      placeholder={`LOT-${new Date().getFullYear()}-001`}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono bg-white text-sm"
                    />
                  </div>
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
            </div>

            {/* Individual Item Checklist & Review Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {language === 'ar' ? 'جدول تدقيق ومطابقة الأصناف المحددة:' : 'Item-by-Item Verification Table:'}
                </h4>
                <span className="text-xs text-slate-500 font-medium">
                  {selectedMedicines.length} {language === 'ar' ? 'مستحضر' : 'items'}
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {duplicateWarnings.map(({ item, isDuplicate, existingRecord }) => {
                  const cfg = customRowConfigs[item.id] || {
                    price: 5000,
                    quantity: 20,
                    batchNumber: commonBatchNumber || 'LOT-2026',
                    expiryDate: commonExpiryDate,
                  };

                  return (
                    <div key={item.id} className="p-3.5 space-y-2.5 hover:bg-slate-50 text-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <DosageFormVisual
                            dosageForm={item.dosageForm}
                            photoUrl={item.imageUrl}
                            name={item.nameEn}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-900">{item.nameEn}</span>
                              <span className="text-slate-500">({item.nameAr})</span>
                              {isDuplicate && (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 flex items-center gap-1">
                                  <AlertTriangle size={11} />
                                  <span>{language === 'ar' ? 'صنف مكرر بالمخزون' : 'Duplicate in stock'}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              <span>المادة: {item.activeIngredient}</span> • <span>التركيز: {item.strength}</span> • <span>الشكل: {item.dosageForm}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleSelect(item.id)}
                          title={language === 'ar' ? 'استبعاد من الإضافة' : 'Remove item'}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Row Inputs: Price, Qty, Batch, Expiry */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">
                            {language === 'ar' ? 'السعر (د.ع)' : 'Price (IQD)'}
                          </label>
                          <input
                            type="number"
                            value={cfg.price}
                            onChange={(e) => handleUpdateRowConfig(item.id, 'price', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">
                            {language === 'ar' ? 'الكمية' : 'Quantity'}
                          </label>
                          <input
                            type="number"
                            value={cfg.quantity}
                            onChange={(e) => handleUpdateRowConfig(item.id, 'quantity', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">
                            {language === 'ar' ? 'رقم الوجبة' : 'Batch #'}
                          </label>
                          <input
                            type="text"
                            value={cfg.batchNumber}
                            onChange={(e) => handleUpdateRowConfig(item.id, 'batchNumber', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">
                            {language === 'ar' ? 'تاريخ الصلاحية' : 'Expiry'}
                          </label>
                          <input
                            type="date"
                            value={cfg.expiryDate}
                            onChange={(e) => handleUpdateRowConfig(item.id, 'expiryDate', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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

            {/* Batch Result Summary */}
            {batchResultSummary && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>
                    {language === 'ar'
                      ? `اكتملت العملية: تمت إضافة ${batchResultSummary.succeeded.length} مستحضراً بنجاح.`
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
                  disabled={isSubmittingBatch || selectedMedicines.length === 0}
                  className="px-6 py-2.5 rounded-xl bg-[#00796b] hover:bg-[#00695c] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingBatch ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>
                    {language === 'ar'
                      ? `تأكيد وحفظ (${selectedMedicines.length}) مستحضرات في المخزون`
                      : `Confirm & Commit (${selectedMedicines.length}) to Inventory`}
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
