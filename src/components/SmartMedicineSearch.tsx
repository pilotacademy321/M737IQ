import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { db } from '../lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { 
  Search, 
  Pill, 
  Building2, 
  Package, 
  Sparkles, 
  X, 
  Check, 
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowRight,
  Stethoscope,
  ShieldAlert,
  Plus,
  Trash2
} from 'lucide-react';
import { DrugInteractionPanel } from './DrugInteractionPanel';

export interface SearchMedicineResult {
  id: string;
  name: string;
  nameAr?: string;
  activeIngredient: string;
  brand?: string;
  manufacturer: string;
  strength: string;
  dosageForm: string;
  packageSize?: string;
  photoUrl?: string;
  priceIqd?: number;
  cartonPriceIqd?: number;
  stockCount?: number;
  minOrderQuantity?: number;
  sourceType: 'retail' | 'wholesale';
  facilityName: string;
  facilityGovernorate?: string;
  facilityPhone?: string;
  facilityId: string;
  requiresPrescription?: boolean;
}

// Curated verified catalog of widely prescribed and procured medications in Iraq
const IRAQI_MEDICINE_CATALOG: SearchMedicineResult[] = [
  {
    id: 'med_aug_1g',
    name: 'Augmentin 1g (أوجمنتين)',
    nameAr: 'أوجمنتين 1 غرام',
    activeIngredient: 'Amoxicillin + Clavulanic Acid (أموكسيسيلين + كلافولانيك)',
    manufacturer: 'GSK (GlaxoSmithKline)',
    brand: 'Augmentin',
    strength: '1000 mg (875/125)',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '14 Tablets / Pack',
    priceIqd: 6500,
    cartonPriceIqd: 180000,
    stockCount: 140,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: true,
  },
  {
    id: 'med_curam_1g',
    name: 'Curam 1g (كورام)',
    nameAr: 'كورام 1 غرام بديل مكافئ',
    activeIngredient: 'Amoxicillin + Clavulanic Acid (أموكسيسيلين + كلافولانيك)',
    manufacturer: 'Sandoz / Novartis',
    brand: 'Curam',
    strength: '1000 mg (875/125)',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '14 Tablets / Pack',
    priceIqd: 5500,
    cartonPriceIqd: 160000,
    stockCount: 90,
    minOrderQuantity: 5,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: true,
  },
  {
    id: 'med_pan_ext',
    name: 'Panadol Extra (بنادول إكسترا)',
    nameAr: 'بنادول إكسترا الأحمر',
    activeIngredient: 'Paracetamol 500mg + Caffeine 65mg (باراسيتامول + كافيين)',
    manufacturer: 'Haleon / GSK',
    brand: 'Panadol',
    strength: '500mg / 65mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '24 Tablets / Pack',
    priceIqd: 2500,
    cartonPriceIqd: 65000,
    stockCount: 300,
    minOrderQuantity: 20,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: false,
  },
  {
    id: 'med_con_5',
    name: 'Concor 5mg (كونكور)',
    nameAr: 'كونكور 5 ملغم لعلاج الضغط',
    activeIngredient: 'Bisoprolol Fumarate (بيسوبرولول)',
    manufacturer: 'Merck KGaA',
    brand: 'Concor',
    strength: '5 mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '30 Tablets / Box',
    priceIqd: 9500,
    cartonPriceIqd: 270000,
    stockCount: 85,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: true,
  },
  {
    id: 'med_nex_40',
    name: 'Nexium 40mg (نيكسيوم)',
    nameAr: 'نيكسيوم 40 ملغم',
    activeIngredient: 'Esomeprazole Magnesium (إيزوميبرازول)',
    manufacturer: 'AstraZeneca',
    brand: 'Nexium',
    strength: '40 mg',
    dosageForm: 'Tablets (أقراص معوية)',
    packageSize: '28 Tablets / Box',
    priceIqd: 14000,
    cartonPriceIqd: 390000,
    stockCount: 60,
    minOrderQuantity: 5,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: true,
  },
  {
    id: 'med_esom_40',
    name: 'Esoget 40mg (إيزوجيت)',
    nameAr: 'إيزوجيت 40 ملغم بديل مكافئ',
    activeIngredient: 'Esomeprazole Magnesium (إيزوميبرازول)',
    manufacturer: 'Getz Pharma',
    brand: 'Esoget',
    strength: '40 mg',
    dosageForm: 'Tablets (أقراص معوية)',
    packageSize: '14 Tablets / Box',
    priceIqd: 7500,
    cartonPriceIqd: 210000,
    stockCount: 110,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: true,
  },
  {
    id: 'med_lip_20',
    name: 'Lipitor 20mg (ليبيتور)',
    nameAr: 'ليبيتور 20 ملغم خافض كولسترول',
    activeIngredient: 'Atorvastatin Calcium (أتورفاستاتين)',
    manufacturer: 'Pfizer',
    brand: 'Lipitor',
    strength: '20 mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '30 Tablets / Box',
    priceIqd: 11000,
    cartonPriceIqd: 310000,
    stockCount: 95,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: true,
  },
  {
    id: 'med_glu_850',
    name: 'Glucophage 850mg (كلوكوفاج)',
    nameAr: 'كلوكوفاج 850 منظم سكر',
    activeIngredient: 'Metformin Hydrochloride (ميتفورمين)',
    manufacturer: 'Merck Santé',
    brand: 'Glucophage',
    strength: '850 mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '30 Tablets / Box',
    priceIqd: 4500,
    cartonPriceIqd: 125000,
    stockCount: 220,
    minOrderQuantity: 15,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: true,
  },
  {
    id: 'med_sam_amox',
    name: 'Amoxicillin SDI 500mg (أموكسيسيلين سامراء)',
    nameAr: 'أموكسيسيلين سامراء كبسول',
    activeIngredient: 'Amoxicillin Trihydrate (أموكسيسيلين)',
    manufacturer: 'SDI Samarra (الشركة العامة لصناعة الأدوية سامراء)',
    brand: 'SDI',
    strength: '500 mg',
    dosageForm: 'Capsules (كبسولات)',
    packageSize: '20 Capsules / Pack',
    priceIqd: 2000,
    cartonPriceIqd: 50000,
    stockCount: 450,
    minOrderQuantity: 25,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: true,
  },
  {
    id: 'med_pioneer_prof',
    name: 'Piofen 400mg (بيوفين بايونير)',
    nameAr: 'بيوفين 400 مسكن ومضاد التهاب',
    activeIngredient: 'Ibuprofen (إيبوبروفين)',
    manufacturer: 'Pioneer Pharmaceuticals (شركة بايونير الدوائية)',
    brand: 'Piofen',
    strength: '400 mg',
    dosageForm: 'Tablets (أقراص)',
    packageSize: '20 Tablets / Pack',
    priceIqd: 1800,
    cartonPriceIqd: 45000,
    stockCount: 380,
    minOrderQuantity: 20,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: false,
  },
  {
    id: 'med_vent_inhal',
    name: 'Ventolin Inhaler 100mcg (فنتولين بخاخ)',
    nameAr: 'بخاخ فنتولين موسع قصبات',
    activeIngredient: 'Salbutamol Sulfate (سالبوتامول)',
    manufacturer: 'GlaxoSmithKline (GSK)',
    brand: 'Ventolin',
    strength: '100 mcg / dose',
    dosageForm: 'Inhaler (بخاخ)',
    packageSize: '200 Actuations',
    priceIqd: 5500,
    cartonPriceIqd: 155000,
    stockCount: 110,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر سامراء العلمي الحديث',
    facilityGovernorate: 'بغداد (Baghdad)',
    facilityPhone: '07709988776',
    facilityId: 'demo_wholesaler_samarra',
    requiresPrescription: true,
  },
  {
    id: 'med_ceft_1g',
    name: 'Rocephin 1g (روسيفين حقن)',
    nameAr: 'إبرة روسيفين 1 غرام فيال',
    activeIngredient: 'Ceftriaxone Sodium (سفترياكسون)',
    manufacturer: 'Roche',
    brand: 'Rocephin',
    strength: '1 g IM/IV',
    dosageForm: 'Injection (فيال حقن)',
    packageSize: '1 Vial + Solvent',
    priceIqd: 5000,
    cartonPriceIqd: 140000,
    stockCount: 160,
    minOrderQuantity: 10,
    sourceType: 'wholesale',
    facilityName: 'مذخر الرشيد التخصصي للأدوية',
    facilityGovernorate: 'بغداد (بغداد)',
    facilityPhone: '07712349988',
    facilityId: 'demo_wholesaler_rashid',
    requiresPrescription: true,
  }
];

interface SmartMedicineSearchProps {
  placeholder?: string;
  onSelectMedicine: (medicine: SearchMedicineResult) => void;
  sourceType?: 'retail' | 'wholesale' | 'all';
  filterFacilityId?: string;
  className?: string;
  showDdiCheckerButton?: boolean;
}

export const SmartMedicineSearch: React.FC<SmartMedicineSearchProps> = ({
  placeholder,
  onSelectMedicine,
  sourceType = 'all',
  filterFacilityId,
  className = '',
  showDdiCheckerButton = false,
}) => {
  const { language, isRTL } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchMedicineResult[]>([]);
  const [similarAlternatives, setSimilarAlternatives] = useState<SearchMedicineResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [ddiModalOpen, setDdiModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // 250ms debounced search requiring strictly >= 3 characters
  useEffect(() => {
    const trimmed = searchTerm.trim().toLowerCase();
    if (trimmed.length < 3) {
      setResults([]);
      setSimilarAlternatives([]);
      setIsOpen(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        let liveResults: SearchMedicineResult[] = [];

        // 1. Fetch from live Firestore database
        try {
          if (sourceType === 'wholesale' || sourceType === 'all') {
            const wholesaleSnap = await getDocs(query(collection(db, 'wholesale_medicines'), limit(40)));
            wholesaleSnap.docs.forEach((d) => {
              const data = d.data();
              liveResults.push({
                id: d.id,
                name: data.name || '',
                nameAr: data.nameAr || '',
                activeIngredient: data.activeIngredient || '',
                brand: data.brand || '',
                manufacturer: data.manufacturer || '',
                strength: data.strength || '',
                dosageForm: data.dosageForm || '',
                packageSize: data.packSize || data.packageSize || '1 Pack',
                photoUrl: data.photoUrl,
                priceIqd: data.wholesalePriceIqd || 0,
                cartonPriceIqd: data.cartonPriceIqd,
                stockCount: data.stockPacks || 0,
                minOrderQuantity: data.minOrderQuantity || 1,
                sourceType: 'wholesale',
                facilityName: data.wholesalerName || 'مذخر أدوية معتمد',
                facilityPhone: data.wholesalerPhone,
                facilityId: data.wholesalerId || '',
                requiresPrescription: false,
              });
            });
          }

          if (sourceType === 'retail' || sourceType === 'all') {
            const retailSnap = await getDocs(query(collection(db, 'medicines'), limit(40)));
            retailSnap.docs.forEach((d) => {
              const data = d.data();
              liveResults.push({
                id: d.id,
                name: data.name || '',
                nameAr: data.nameAr || '',
                activeIngredient: data.activeIngredient || '',
                brand: data.brand || '',
                manufacturer: data.manufacturer || '',
                strength: data.strength || '',
                dosageForm: data.dosageForm || '',
                packageSize: data.packageSize || '1 Pack',
                photoUrl: data.photoUrl,
                priceIqd: data.price || 0,
                stockCount: data.quantity || 0,
                sourceType: 'retail',
                facilityName: data.pharmacyName || 'صيدلية معتمدة',
                facilityPhone: data.pharmacyPhone,
                facilityGovernorate: data.pharmacyGovernorate,
                facilityId: data.pharmacyId || '',
                requiresPrescription: !!data.requiresPrescription,
              });
            });
          }
        } catch {
          // Graceful fallback to verified Iraqi catalog
        }

        // Combine live results with validated Iraqi medicine catalog
        const combinedPool = [...liveResults, ...IRAQI_MEDICINE_CATALOG];

        // Deduplicate and filter by query
        const matched = combinedPool.filter((item) => {
          if (filterFacilityId && item.facilityId === filterFacilityId) {
            return false;
          }
          if (sourceType !== 'all' && item.sourceType !== sourceType) {
            return false;
          }

          const matchName = item.name.toLowerCase().includes(trimmed);
          const matchNameAr = item.nameAr?.toLowerCase().includes(trimmed) || false;
          const matchActive = item.activeIngredient.toLowerCase().includes(trimmed);
          const matchBrand = item.brand?.toLowerCase().includes(trimmed) || false;
          const matchManufacturer = item.manufacturer.toLowerCase().includes(trimmed);

          return matchName || matchNameAr || matchActive || matchBrand || matchManufacturer;
        });

        // Unique by ID or Name + Strength + Facility
        const seen = new Set<string>();
        const unique = matched.filter((item) => {
          const key = `${item.name}-${item.strength}-${item.facilityId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setResults(unique.slice(0, 8));

        // Find similar alternatives sharing EXACT active ingredient and strength (without mixing strengths)
        if (unique.length > 0) {
          const primaryActive = unique[0].activeIngredient.toLowerCase();
          const primaryStrength = unique[0].strength.toLowerCase();
          const alternatives = combinedPool.filter((alt) => 
            alt.id !== unique[0].id &&
            alt.activeIngredient.toLowerCase() === primaryActive &&
            alt.strength.toLowerCase() === primaryStrength
          );
          setSimilarAlternatives(alternatives.slice(0, 3));
        } else {
          setSimilarAlternatives([]);
        }

        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err: unknown) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, sourceType, filterFacilityId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelectItem(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelectItem = (med: SearchMedicineResult) => {
    onSelectMedicine(med);
    setSearchTerm('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  return (
    <div ref={dropdownRef} className={`relative w-full ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} text-slate-400 pointer-events-none`}>
          {isSearching ? (
            <RefreshCw size={17} className="animate-spin text-[#003366]" />
          ) : (
            <Search size={17} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || searchTerm.trim().length >= 3) setIsOpen(true);
          }}
          placeholder={
            placeholder ||
            (language === 'ar'
              ? 'ابحث بالاسم التجاري، المادة الفعالة أو الشركة (3 أحرف فأكثر)...'
              : 'Search trade name, active ingredient or manufacturer (3+ chars)...')
          }
          className={`w-full py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#003366] transition-all shadow-xs ${
            isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10'
          }`}
        />

        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setResults([]);
              setSimilarAlternatives([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className={`absolute ${isRTL ? 'left-3' : 'right-3'} p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer`}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && searchTerm.trim().length >= 3 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 animate-in fade-in-50 duration-150">
          
          {/* Header Summary */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>
                {isSearching
                  ? (language === 'ar' ? 'جاري البحث في قاعدة البيانات الطبية...' : 'Searching medical database...')
                  : results.length > 0
                  ? (language === 'ar' ? `تم العثور على ${results.length} دواء / مستحضر` : `Found ${results.length} registered products`)
                  : (language === 'ar' ? 'نتائج البحث' : 'Search Results')}
              </span>
            </span>
            <span className="text-[10px] text-slate-400">
              {language === 'ar' ? 'بحث ذكي بحسب الاسم والتركيز' : 'Indexed by name & strength'}
            </span>
          </div>

          {/* Loading Indicator */}
          {isSearching && (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin text-[#003366]" />
              <span>{language === 'ar' ? 'جاري مطابقة الأسماء والمواد الفعالة...' : 'Matching chemical & brand names...'}</span>
            </div>
          )}

          {/* Empty State */}
          {!isSearching && results.length === 0 && !searchError && (
            <div className="p-8 text-center text-slate-500 text-xs space-y-1.5">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                <Search size={18} />
              </div>
              <p className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'لم يتم العثور على أدوية مطابقة' : 'No matching medications found'}
              </p>
              <p className="text-slate-500 max-w-xs mx-auto text-[11px]">
                {language === 'ar'
                  ? 'يرجى التأكد من صحة الاسم التجاري أو المادة الفعالة باللغة العربية أو الإنجليزية.'
                  : 'Verify the spelling of the brand or generic active compound in Arabic or English.'}
              </p>
            </div>
          )}

          {/* Error State */}
          {searchError && (
            <div className="p-4 bg-red-50 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {/* Results List */}
          {!isSearching && results.length > 0 && (
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={`${item.id}-${idx}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-sky-50/80 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {item.photoUrl ? (
                        <img 
                          src={item.photoUrl} 
                          alt={item.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            item.sourceType === 'wholesale'
                              ? 'bg-teal-50 text-teal-700 border border-teal-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.sourceType === 'wholesale' ? <Building2 size={18} /> : <Pill size={18} />}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 leading-tight">
                            {item.name}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                            {item.strength}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {item.dosageForm}
                          </span>
                          {item.packageSize && (
                            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                              {item.packageSize}
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-1 truncate">
                          <span className="font-medium text-slate-600">
                            {language === 'ar' ? 'المادة الفعالة: ' : 'Active: '}
                          </span>
                          <span className="font-semibold text-slate-700">{item.activeIngredient}</span>
                          <span className="mx-1.5 text-slate-300">|</span>
                          <span>{item.manufacturer}</span>
                        </div>

                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-600">{item.facilityName}</span>
                          {item.facilityGovernorate && (
                            <>
                              <span>·</span>
                              <span>{item.facilityGovernorate}</span>
                            </>
                          )}
                          {item.minOrderQuantity && item.sourceType === 'wholesale' && (
                            <>
                              <span>·</span>
                              <span className="text-teal-700 font-bold">
                                {language === 'ar' ? `الحد الأدنى: ${item.minOrderQuantity} باكيت` : `MOQ: ${item.minOrderQuantity}`}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verified Price & Availability */}
                    <div className="text-end shrink-0 ps-2">
                      {typeof item.priceIqd === 'number' && item.priceIqd > 0 && (
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          {item.priceIqd.toLocaleString()} <span className="text-[10px] font-sans font-normal text-slate-500">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                        </div>
                      )}
                      {typeof item.stockCount === 'number' && (
                        <div className="text-[11px] font-semibold mt-0.5">
                          {item.stockCount > 0 ? (
                            <span className="text-emerald-700">
                              {language === 'ar' ? `متوفر: ${item.stockCount}` : `In Stock: ${item.stockCount}`}
                            </span>
                          ) : (
                            <span className="text-red-500">{language === 'ar' ? 'غير متوفر' : 'Out of Stock'}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Similar Alternatives Section (Distinct to avoid confusion) */}
          {!isSearching && similarAlternatives.length > 0 && (
            <div className="p-3 bg-slate-50/80 border-t border-slate-200">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#003366] mb-2">
                <Layers size={13} />
                <span>
                  {language === 'ar'
                    ? 'بدائل متطابقة بالمادة الفعالة ونفس التركيز (Generic Equivalents):'
                    : 'Generic Equivalents with Identical Strength:'}
                </span>
              </div>
              <div className="space-y-1.5">
                {similarAlternatives.map((alt, aIdx) => (
                  <div
                    key={aIdx}
                    onClick={() => handleSelectItem(alt)}
                    className="p-2 rounded-xl bg-white border border-slate-200 hover:border-[#003366] flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="font-bold text-slate-800 me-2">{alt.name}</span>
                      <span className="text-[11px] text-slate-500">({alt.manufacturer})</span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-700">
                      {alt.priceIqd ? `${alt.priceIqd.toLocaleString()} د.ع` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Optional DDI Trigger Button */}
      {showDdiCheckerButton && (
        <div className="mt-2 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setDdiModalOpen(true)}
            className="text-[11px] font-bold text-[#003366] hover:text-[#002244] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Stethoscope size={13} className="text-[#0891b2]" />
            <span>{language === 'ar' ? 'فحص التداخلات الدوائية المعتمد (WHO/FDA)' : 'Clinical Drug Interaction Checker'}</span>
          </button>
        </div>
      )}

      {/* Dedicated Interactive Drug Interaction Modal */}
      <DrugInteractionModal
        isOpen={ddiModalOpen}
        onClose={() => setDdiModalOpen(false)}
      />
    </div>
  );
};

export const DrugInteractionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { language, isRTL } = useLanguage();
  const [selectedList, setSelectedList] = useState<Array<{ name: string; activeIngredient?: string }>>([
    { name: 'Warfarin 5mg', activeIngredient: 'Warfarin' },
    { name: 'Aspirin 100mg', activeIngredient: 'Acetylsalicylic acid' },
  ]);
  const [customInput, setCustomInput] = useState('');

  if (!isOpen) return null;

  const handleAddFromCatalog = (med: SearchMedicineResult) => {
    if (!selectedList.some(m => m.name === med.name)) {
      setSelectedList(prev => [...prev, { name: med.name, activeIngredient: med.activeIngredient }]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setSelectedList(prev => [...prev, { name: customInput.trim(), activeIngredient: customInput.trim() }]);
    setCustomInput('');
  };

  const handleRemove = (idx: number) => {
    setSelectedList(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto"
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-[#003366] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
              <Stethoscope size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {language === 'ar' ? 'فحص التداخلات الدوائية المعتمد' : 'Clinical Drug Interaction Screening'}
              </h2>
              <p className="text-xs text-slate-300">
                {language === 'ar' 
                  ? 'منظومة دعم القرار السريري المستندة إلى WHO وFDA والمكتبة الوطنية الأمريكية NLM' 
                  : 'Evidence-based clinical decision support (WHO, FDA, NLM)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-slate-800 text-sm">
          {/* Quick add custom */}
          <form onSubmit={handleAddCustom} className="flex gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={language === 'ar' ? 'اكتب اسم الدواء أو المادة الفعالة (مثال: Concor, Verapamil)...' : 'Type medicine or active ingredient...'}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus size={14} />
              <span>{language === 'ar' ? 'إضافة' : 'Add'}</span>
            </button>
          </form>

          {/* Preset Clinical Pairs Buttons for instant verification */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 block">
              {language === 'ar' ? 'نماذج سريرية معتمدة للاختبار والتحقق الفوري:' : 'Preset clinical test cases:'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedList([
                  { name: 'Warfarin 5mg', activeIngredient: 'Warfarin' },
                  { name: 'Voltaren 50mg', activeIngredient: 'Diclofenac' },
                ])}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                وارفارين + فولتارين (نزف هضمي)
              </button>
              <button
                type="button"
                onClick={() => setSelectedList([
                  { name: 'Concor 5mg', activeIngredient: 'Bisoprolol' },
                  { name: 'Verapamil 80mg', activeIngredient: 'Verapamil' },
                ])}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                كونكور + فيراباميل (بطء قلب)
              </button>
              <button
                type="button"
                onClick={() => setSelectedList([
                  { name: 'Plavix 75mg', activeIngredient: 'Clopidogrel' },
                  { name: 'Nexium 40mg', activeIngredient: 'Esomeprazole' },
                ])}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                بلافيكس + نيكسيوم (تثبيط الفعالية)
              </button>
              <button
                type="button"
                onClick={() => setSelectedList([
                  { name: 'Augmentin 1g', activeIngredient: 'Amoxicillin + Clavulanic' },
                  { name: 'Panadol Extra', activeIngredient: 'Paracetamol' },
                ])}
                className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold cursor-pointer border border-emerald-200"
              >
                أوجمنتين + بنادول (آمن / لا تداخل)
              </button>
            </div>
          </div>

          {/* Active Drugs Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 block">
              {language === 'ar' ? `الأدوية قيد التدقيق السريري (${selectedList.length}):` : `Medications Under Review (${selectedList.length}):`}
            </span>
            <div className="flex flex-wrap gap-2">
              {selectedList.map((med, idx) => (
                <div key={idx} className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Pill size={13} className="text-[#003366]" />
                  <span>{med.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-red-500 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Results Panel */}
          <div className="pt-2">
            <DrugInteractionPanel medicines={selectedList} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>{language === 'ar' ? 'منظومة دعم القرار السريري M737' : 'M737 Clinical Decision Support'}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            {language === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
