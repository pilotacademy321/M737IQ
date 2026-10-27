import React, { useState, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logAuditEvent } from '../lib/auditLogger';
import { 
  CatalogMedicineItem, 
  MedicalSpecialtyCategory, 
  MedicineItem, 
  PharmacyProfile 
} from '../types';
import { 
  SPECIALTY_CATEGORIES, 
  VERIFIED_CENTRAL_CATALOG_MEDICINES 
} from '../data/centralMedicineCatalog';
import { DosageFormVisual } from './DosageFormVisual';
import { 
  Pill, 
  Search, 
  ShieldCheck, 
  AlertCircle, 
  Layers, 
  Plus, 
  Check, 
  X, 
  Info, 
  Sparkles, 
  Filter, 
  ChevronRight,
  Stethoscope,
  HeartPulse,
  Activity,
  Users,
  Wind,
  Shield,
  Brain,
  Bone,
  Eye,
  Headphones,
  Droplet,
  Smile,
  BadgeAlert,
  Building,
  Calendar,
  DollarSign
} from 'lucide-react';

interface CentralMedicineCatalogSectionProps {
  existingMedicines: MedicineItem[];
  pharmacyProfile: PharmacyProfile | null;
  onMedicinesAdded: () => Promise<void>;
  showToast: (text: string, type?: 'success' | 'error') => void;
  isOperable: boolean;
}

const SPECIALTY_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  Stethoscope,
  HeartPulse,
  Activity,
  Users,
  Wind,
  Shield,
  Brain,
  Bone,
  Sparkles,
  Eye,
  Headphones,
  Droplet,
  Smile,
  Pill,
};

export const CentralMedicineCatalogSection: React.FC<CentralMedicineCatalogSectionProps> = ({
  existingMedicines,
  pharmacyProfile,
  onMedicinesAdded,
  showToast,
  isOperable,
}) => {
  const { user, userProfile } = useAuth();
  const { language, isRTL } = useLanguage();

  const [selectedSpecialty, setSelectedSpecialty] = useState<MedicalSpecialtyCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dosageFilter, setDosageFilter] = useState('all');
  const [prescriptionFilter, setPrescriptionFilter] = useState<'all' | 'rx' | 'otc'>('all');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Batch Add Modal State
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchPriceIQD, setBatchPriceIQD] = useState<number | ''>('');
  const [batchQuantity, setBatchQuantity] = useState<number | ''>('');
  const [batchExpiryDate, setBatchExpiryDate] = useState(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [batchNumberInput, setBatchNumberInput] = useState('');
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Map of existing items in the pharmacy inventory for fast duplicate detection
  const existingCatalogIdMap = useMemo(() => {
    const set = new Set<string>();
    existingMedicines.forEach((m) => {
      if (m.catalogMedicineId) {
        set.add(m.catalogMedicineId);
      }
      // Also match by exact formulation fingerprint: name + activeIngredient + strength + dosageForm
      const fingerprint = `${(m.name || '').trim().toLowerCase()}|${(m.activeIngredient || '').trim().toLowerCase()}|${(m.strength || '').trim().toLowerCase()}`;
      set.add(fingerprint);
    });
    return set;
  }, [existingMedicines]);

  const isItemAlreadyStocked = (item: CatalogMedicineItem) => {
    if (existingCatalogIdMap.has(item.id)) return true;
    const fingerprint = `${item.nameEn.trim().toLowerCase()}|${item.activeIngredient.trim().toLowerCase()}|${item.strength.trim().toLowerCase()}`;
    return existingCatalogIdMap.has(fingerprint);
  };

  // Extract unique dosage forms from catalog
  const availableDosageForms = useMemo(() => {
    const set = new Set<string>();
    VERIFIED_CENTRAL_CATALOG_MEDICINES.forEach((m) => set.add(m.dosageForm));
    return Array.from(set).sort();
  }, []);

  // Filter catalog items
  const filteredCatalogMedicines = useMemo(() => {
    return VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((item) => {
      // Specialty filter
      if (selectedSpecialty !== 'all' && !item.categories.includes(selectedSpecialty)) {
        return false;
      }
      // Dosage form filter
      if (dosageFilter !== 'all' && item.dosageForm !== dosageFilter) {
        return false;
      }
      // Prescription filter
      if (prescriptionFilter === 'rx' && !item.requiresPrescription) return false;
      if (prescriptionFilter === 'otc' && item.requiresPrescription) return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchNameEn = item.nameEn.toLowerCase().includes(q);
        const matchNameAr = item.nameAr.includes(q);
        const matchGeneric = item.activeIngredient.toLowerCase().includes(q);
        const matchInn = item.inn ? item.inn.toLowerCase().includes(q) : false;
        const matchAtc = item.atcCode ? item.atcCode.toLowerCase().includes(q) : false;
        const matchBrand = item.brand.toLowerCase().includes(q);
        const matchManufacturer = item.manufacturer.toLowerCase().includes(q);
        const matchReg = item.registrationNumber ? item.registrationNumber.toLowerCase().includes(q) : false;
        const matchRoute = item.routeOfAdministration ? item.routeOfAdministration.toLowerCase().includes(q) : false;
        return matchNameEn || matchNameAr || matchGeneric || matchInn || matchAtc || matchBrand || matchManufacturer || matchReg || matchRoute;
      }

      return true;
    });
  }, [selectedSpecialty, dosageFilter, prescriptionFilter, searchQuery]);

  // Toggle item selection
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all currently filtered items (excluding already stocked items if desired)
  const handleSelectAllFiltered = () => {
    const unstockedInView = filteredCatalogMedicines.map((m) => m.id);
    setSelectedItemIds(new Set(unstockedInView));
  };

  const handleClearSelection = () => {
    setSelectedItemIds(new Set());
  };

  // Open Batch Add Modal
  const handleOpenBatchModal = () => {
    if (selectedItemIds.size === 0) {
      showToast(language === 'ar' ? 'يرجى تحديد دواء واحد على الأقل من الدليل' : 'Please select at least one medicine', 'error');
      return;
    }
    if (!isOperable) {
      showToast(language === 'ar' ? 'يتطلب إجراء العمليات اعتماد المشرف العام' : 'Super Admin approval required', 'error');
      return;
    }
    setShowBatchModal(true);
  };

  // Execute Batch Add to Pharmacy Firestore
  const handleConfirmBatchAdd = async () => {
    if (!user) return;
    setSubmittingBatch(true);
    setBatchProgress({ current: 0, total: selectedItemIds.size });

    const selectedList = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((item) => selectedItemIds.has(item.id));
    let successCount = 0;
    const now = new Date().toISOString();

    try {
      for (let i = 0; i < selectedList.length; i++) {
        const catItem = selectedList[i];
        const mId = `med_cat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const initialPrice = typeof batchPriceIQD === 'number' && batchPriceIQD > 0 ? batchPriceIQD : 0;
        const initialQty = typeof batchQuantity === 'number' && batchQuantity >= 0 ? batchQuantity : 0;
        // Strict Inventory Decoupling: isAvailable is TRUE ONLY if quantity > 0 and price > 0
        const isAvail = initialQty > 0 && initialPrice > 0;

        const newMedicine: MedicineItem = {
          id: mId,
          pharmacyId: user.uid,
          pharmacyName: pharmacyProfile?.pharmacyName || userProfile?.facilityName || 'الصيدلية',
          pharmacyPhone: pharmacyProfile?.phone || userProfile?.phone || '',
          pharmacyGovernorate: pharmacyProfile?.governorate || userProfile?.governorate || 'بغداد (Baghdad)',
          pharmacyAddress: pharmacyProfile?.address || userProfile?.facilityName || '',
          catalogMedicineId: catItem.id,
          name: catItem.nameEn,
          activeIngredient: catItem.activeIngredient,
          brand: catItem.brand,
          manufacturer: catItem.manufacturer,
          strength: catItem.strength,
          dosageForm: catItem.dosageForm,
          packageSize: catItem.packageSize,
          barcode: catItem.barcode,
          batchNumber: batchNumberInput.trim() || `LOT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          price: initialPrice,
          quantity: initialQty,
          minStockAlert: 5,
          expiryDate: batchExpiryDate,
          benefits: `${catItem.nameAr} - ${catItem.notes || ''}`.trim(),
          sideEffects: catItem.requiresPrescription ? 'صرف بموجب وصفة طبية أصولية من طبيب اختصاص.' : '',
          requiresPrescription: catItem.requiresPrescription,
          isAvailable: isAvail,
          notes: `المصدر المرجعي: ${catItem.sourceAuthority} | التسجيل: ${catItem.registrationNumber}`,
          createdAt: now,
          updatedAt: now,
        };

        await setDoc(doc(db, 'medicines', mId), newMedicine);

        await logAuditEvent({
          action: 'medicine_catalog_import',
          category: 'pharmacy_inventory',
          actorUid: user.uid,
          actorName: pharmacyProfile?.pharmacyName || userProfile?.facilityName || 'الصيدلية',
          actorRole: 'pharmacy',
          resourceId: mId,
          resourceNumber: catItem.registrationNumber || mId,
          status: 'success',
          details: `إضافة دواء من الدليل المركزي (${catItem.nameEn} / ${catItem.activeIngredient}). السعر: ${initialPrice} د.ع، الرصيد: ${initialQty}، التوفر: ${isAvail ? 'متوفر' : 'غير متوفر'}`,
        });

        successCount++;
        setBatchProgress({ current: i + 1, total: selectedList.length });
      }

      showToast(
        language === 'ar'
          ? `تمت إضافة (${successCount}) أدوية بنجاح إلى مخزون صيدليتك`
          : `Successfully imported (${successCount}) medicines into your inventory`
      );

      setShowBatchModal(false);
      setSelectedItemIds(new Set());
      await onMedicinesAdded();
    } catch (err: unknown) {
      console.error('Batch add error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'medicines');
    } finally {
      setSubmittingBatch(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header Info & Compliance Notice */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-teal-100 text-[#00796b]">
                <Layers size={22} />
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {language === 'ar' ? 'دليل الأدوية المركزي المعتمد (16 تخصص طبي)' : 'Official Central Medicine Catalog (16 Specialties)'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === 'ar'
                    ? 'قاعدة بيانات دوائية معتمدة مستندة إلى الدليل الدوائي العراقي الموحد (كيماديا / وزارة الصحة). أدوية سريرية حقيقية 100% دون ابتكار أو افتراض.'
                    : 'Verified pharmaceutical reference based on the Iraqi National Formulary. Zero hallucinated or fake formulations.'}
                </p>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedItemIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء التحديد' : 'Clear'}
              </button>
            )}

            <button
              onClick={handleSelectAllFiltered}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
            >
              {language === 'ar' ? `تحديد الكل (${filteredCatalogMedicines.length})` : `Select All (${filteredCatalogMedicines.length})`}
            </button>

            <button
              onClick={handleOpenBatchModal}
              disabled={selectedItemIds.size === 0}
              className="px-5 py-2.5 rounded-xl bg-[#00796b] hover:bg-teal-800 disabled:bg-slate-300 text-white font-bold text-xs flex items-center gap-2 transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              <span>
                {language === 'ar'
                  ? `إضافة المحددة لمخزون الصيدلية (${selectedItemIds.size})`
                  : `Add Selected to Inventory (${selectedItemIds.size})`}
              </span>
            </button>
          </div>
        </div>

        {/* Clinical Decoupling Safety Rule */}
        <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-950 text-xs flex items-start gap-3 leading-relaxed">
          <ShieldCheck size={20} className="text-[#00796b] shrink-0 mt-0.5" />
          <div>
            <strong>{language === 'ar' ? 'مبدأ الفصل السريري للمخزون:' : 'Clinical Inventory Decoupling:'}</strong>{' '}
            {language === 'ar'
              ? 'اختيارك لأدوية من الدليل المركزي يسجلها في فهرس صيدليتك كأصناف جاهزة، وتبقى حالة التوفر (غير متوفر) والكمية (0) حتى يتم تسعيرها وتحديد رصيد المخزون الفعلي، رقم التشغيلة وتاريخ الصلاحية لضمان سلامة المرضى.'
              : 'Adding items from the central catalog registers them in your pharmacy index with availability false and quantity 0 until actual physical stock, IQD price, lot number, and expiry date are verified.'}
          </div>
        </div>

        {/* Search & Secondary Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs pt-2">
          <div className="md:col-span-6 relative">
            <Search size={16} className="absolute top-3 start-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'ابحث بالاسم التجاري، المادة الفعالة، كود ATC، أو المسار...'
                  : 'Search by brand, generic, ATC code, or route...'
              }
              className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:ring-2 focus:ring-[#00796b] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-3 end-3 text-slate-400 hover:text-slate-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={dosageFilter}
              onChange={(e) => setDosageFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white outline-none"
            >
              <option value="all">{language === 'ar' ? 'كافة الأشكال الصيدلانية' : 'All Dosage Forms'}</option>
              {availableDosageForms.map((df) => (
                <option key={df} value={df}>
                  {df}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={prescriptionFilter}
              onChange={(e) => setPrescriptionFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white outline-none"
            >
              <option value="all">{language === 'ar' ? 'الكل (Rx/OTC)' : 'All Types'}</option>
              <option value="rx">{language === 'ar' ? 'وصفة إلزامية (Rx)' : 'Rx Required'}</option>
              <option value="otc">{language === 'ar' ? 'بدون وصفة (OTC)' : 'OTC Only'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 16 Medical Specialties Horizontal Scroll Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm">
        <div className="text-xs font-bold text-slate-700 mb-2 px-1 flex items-center justify-between">
          <span>{language === 'ar' ? 'التصنيف بحسب التخصص الطبي (16 تخصص معتمد):' : 'Browse by Medical Specialty (16 Approved):'}</span>
          <span className="text-slate-400 font-mono text-[11px]">
            {filteredCatalogMedicines.length} {language === 'ar' ? 'صنف معروض' : 'items displayed'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            onClick={() => setSelectedSpecialty('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedSpecialty === 'all'
                ? 'bg-[#004d40] text-white shadow-sm'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Layers size={14} />
            <span>{language === 'ar' ? 'كافة التخصصات' : 'All Specialties'}</span>
            <span className="text-[10px] opacity-75 font-mono">({VERIFIED_CENTRAL_CATALOG_MEDICINES.length})</span>
          </button>

          {SPECIALTY_CATEGORIES.map((cat) => {
            const Icon = SPECIALTY_ICONS[cat.iconName] || Stethoscope;
            const isSelected = selectedSpecialty === cat.id;
            const countInSpecialty = VERIFIED_CENTRAL_CATALOG_MEDICINES.filter((m) =>
              m.categories.includes(cat.id)
            ).length;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedSpecialty(cat.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#004d40] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={cat.descriptionAr}
              >
                <Icon size={14} className={isSelected ? 'text-teal-200' : 'text-slate-500'} />
                <span>{language === 'ar' ? cat.nameAr : cat.nameEn}</span>
                <span className="text-[10px] opacity-75 font-mono">({countInSpecialty})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog Medicines Grid */}
      {filteredCatalogMedicines.length === 0 ? (
        <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 text-slate-400">
          <Pill size={48} className="mx-auto mb-3 opacity-30" />
          <h3 className="font-bold text-base text-slate-700">
            {language === 'ar' ? 'لا توجد أدوية مطابقة لبحثك في هذا التخصص' : 'No medicines found matching criteria'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'ar' ? 'جرّب البحث باسم المادة الفعالة أو اختيار (كافة التخصصات)' : 'Try searching by active ingredient or selecting All Specialties'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalogMedicines.map((item) => {
            const isSelected = selectedItemIds.has(item.id);
            const alreadyStocked = isItemAlreadyStocked(item);

            return (
              <div
                key={item.id}
                onClick={() => toggleSelectItem(item.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                  isSelected
                    ? 'border-[#00796b] bg-teal-50/40 ring-2 ring-[#00796b]/30 shadow-sm'
                    : alreadyStocked
                    ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-300'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div>
                  {/* Top Bar: Badges + Checkbox */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-800">
                        {item.dosageForm}
                      </span>

                      {item.requiresPrescription ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-800 flex items-center gap-0.5" title="وصفة طبية إلزامية">
                          <BadgeAlert size={11} />
                          <span>Rx</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          OTC
                        </span>
                      )}

                      {alreadyStocked && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <Check size={11} />
                          <span>{language === 'ar' ? 'مسجل بصيدليتك' : 'In Pharmacy'}</span>
                        </span>
                      )}
                    </div>

                    {/* Selection Checkbox */}
                    <div
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-[#00796b] border-[#00796b] text-white'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      {isSelected && <Check size={14} />}
                    </div>
                  </div>

                  {/* Dual Names & Dosage Visual */}
                  <div className="flex items-start gap-3 mb-1">
                    <DosageFormVisual
                      dosageForm={item.dosageForm}
                      photoUrl={item.imageUrl}
                      name={item.nameEn}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-base text-slate-900 leading-snug truncate">{item.nameEn}</h3>
                      <div className="text-xs font-bold text-[#004d40] truncate">{item.nameAr}</div>
                    </div>
                  </div>

                  {/* Active Ingredient (Scientific Generic) */}
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 my-2.5 text-xs">
                    <div className="text-slate-400 text-[10px] font-semibold">{language === 'ar' ? 'المادة الفعالة العلمية:' : 'Active Ingredient:'}</div>
                    <div className="font-mono font-bold text-slate-800 text-xs">{item.activeIngredient}</div>
                  </div>

                  {/* Strength, Packaging & Manufacturer */}
                  <div className="text-xs text-slate-600 space-y-1 mb-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'العيار والعبوة:' : 'Strength & Pack:'}</span>
                      <span className="font-mono font-bold text-slate-800">{item.strength} — {item.packageSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'المسار والتحرر:' : 'Route & Release:'}</span>
                      <span className="font-semibold text-slate-700">
                        {item.routeOfAdministration || 'Oral'} {item.releaseMechanism && item.releaseMechanism !== 'standard' && `(${item.releaseMechanism.replace('_', ' ')})`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'الشركة المصنعة:' : 'Manufacturer:'}</span>
                      <span className="text-slate-800 font-medium truncate max-w-[180px]" title={item.manufacturer}>
                        {item.manufacturer}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">{language === 'ar' ? 'بلد المنشأ:' : 'Origin:'}</span>
                      <span className="text-slate-700">{item.originCountry}</span>
                    </div>
                    {item.notes && (
                      <div className="pt-1.5 border-t border-slate-100 text-[11px] text-teal-900 line-clamp-2">
                        <span className="font-bold text-teal-950">{language === 'ar' ? 'الاستطباب:' : 'Indication:'}</span> {item.notes}
                      </div>
                    )}
                  </div>

                  {/* Manual Review Alert Banner if needed */}
                  {item.needsManualReview && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] mb-2 flex items-start gap-1.5">
                      <AlertCircle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{item.reviewReason || (language === 'ar' ? 'قيد التدقيق من الهيئة السريرية' : 'Pending clinical review')}</span>
                    </div>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] gap-2">
                  <div className="flex items-center gap-1.5">
                    {item.atcCode && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold">
                        {item.atcCode}
                      </span>
                    )}
                    <span className="text-slate-400 font-mono text-[10px]">
                      {item.registrationNumber || item.id}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-teal-700">
                    {item.requiresPrescription
                      ? (language === 'ar' ? 'وصفة إلزامية' : 'Rx Required')
                      : (language === 'ar' ? 'صرف حر OTC' : 'OTC')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BATCH ADD MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-in zoom-in-95 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-[#00796b] flex items-center justify-center">
                  <Plus size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {language === 'ar' ? 'إضافة دفعة أدوية إلى صيدليتك' : 'Batch Import to Pharmacy Inventory'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar'
                      ? `تم تحديد (${selectedItemIds.size}) أدوية معتمدة من الدليل المركزي`
                      : `Selected (${selectedItemIds.size}) verified medicines`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBatchModal(false)}
                disabled={submittingBatch}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Decoupling Safety Explanation */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle size={15} />
                <span>{language === 'ar' ? 'تنبيه السلامة والمطابقة السريرية:' : 'Safety & Clinical Compliance Notice:'}</span>
              </div>
              <p>
                {language === 'ar'
                  ? 'بموجب الضوابط، إضافة الأدوية من الدليل المركزي لا يجعلها متاحة للمرضى تلقائياً. يمكنك الآن إما تحديد سعر ورصيد أولي، أو ترك الحقول فارغة لتسجيلها برصيد (0) وغير متاحة حتى تقوم بجردها وتسعيرها لاحقاً.'
                  : 'Importing medicines does not automatically make them available. You may provide initial stock and prices, or leave them empty to register as zero-stock unavailable until manually audited.'}
              </p>
            </div>

            {/* Batch Form Settings */}
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'السعر الافتراضي للمجموعة (د.ع) - اختياري' : 'Default Selling Price (IQD) - Optional'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="250"
                    placeholder="مثال: 5000"
                    value={batchPriceIQD}
                    onChange={(e) => setBatchPriceIQD(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-[#00796b]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'ar' ? 'اتركه فارغاً للتسعير الفردي لاحقاً' : 'Leave empty to price individually later'}
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'الكمية الأولية بالمخزون (عبوة) - اختياري' : 'Initial Stock Quantity - Optional'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="مثال: 20"
                    value={batchQuantity}
                    onChange={(e) => setBatchQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-[#00796b]"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {language === 'ar' ? 'إذا تُرك فارغاً أو صفر يكون غير متوفر' : 'Empty or zero defaults to Out of Stock'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'تاريخ الصلاحية الافتراضي' : 'Default Expiry Date'}
                  </label>
                  <input
                    type="date"
                    value={batchExpiryDate}
                    onChange={(e) => setBatchExpiryDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-[#00796b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'ar' ? 'رقم التشغيلة / الوجبة (Batch No)' : 'Batch / Lot Number'}
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: LOT-2026-A1"
                    value={batchNumberInput}
                    onChange={(e) => setBatchNumberInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono outline-none focus:ring-2 focus:ring-[#00796b]"
                  />
                </div>
              </div>
            </div>

            {/* Progress indicator during batch write */}
            {submittingBatch && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-slate-600 font-bold">
                  <span>{language === 'ar' ? 'جاري حفظ الأدوية في قاعدة البيانات...' : 'Writing to Firestore...'}</span>
                  <span className="font-mono">
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-[#00796b] transition-all duration-200"
                    style={{
                      width: `${(batchProgress.current / Math.max(batchProgress.total, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                disabled={submittingBatch}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleConfirmBatchAdd}
                disabled={submittingBatch}
                className="px-6 py-2.5 rounded-xl bg-[#00796b] hover:bg-teal-800 disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
              >
                {submittingBatch ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === 'ar' ? 'جاري الحفظ...' : 'Importing...'}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{language === 'ar' ? 'تأكيد الإضافة للمخزون' : 'Confirm Inventory Import'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

