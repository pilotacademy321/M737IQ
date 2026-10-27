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
  Trash2,
  HelpCircle,
  Lightbulb,
  CornerDownRight
} from 'lucide-react';
import { DrugInteractionPanel } from './DrugInteractionPanel';
import { DosageFormVisual } from './DosageFormVisual';

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

// Arabic text normalizer (strips diacritics, unifies alef/yeh/teh marbuta/tatweel)
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    // Remove Arabic diacritics / tashkeel
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alefs (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Yeh (ى -> ي, ئ -> ي)
    .replace(/[ىئ]/g, 'ي')
    // Normalize Teh Marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Waw with Hamza (ؤ -> و)
    .replace(/ؤ/g, 'و')
    // Remove Tatweel (ـ)
    .replace(/ـ+/g, '')
    // Remove extra punctuation and multiple spaces
    .replace(/[^\u0621-\u064A\u0660-\u0669a-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// English text normalizer (lowercase, alphanumeric + space only)
export function normalizeEnglishText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein edit distance for typo detection
export function calculateLevenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= bl; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,       // deletion
        matrix[i][j - 1] + 1,       // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[al][bl];
}

// Bigram / Sørensen–Dice similarity coefficient for fuzzy match
export function calculateBigramSimilarity(str1: string, str2: string): number {
  const s1 = str1.replace(/\s+/g, '');
  const s2 = str2.replace(/\s+/g, '');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.length < 2 || s2.length < 2) return 0;

  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < s1.length - 1; i++) {
    const bg = s1.substring(i, i + 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    const bg = s2.substring(i, i + 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }

  return (2.0 * intersection) / ((s1.length - 1) + (s2.length - 1));
}

export interface ApproximateMatch {
  item: SearchMedicineResult;
  score: number;
  matchedField: string;
  suggestedTerm: string;
}

// Computes match score against real item
export function evaluateMedicineMatch(
  queryNormAr: string,
  queryNormEn: string,
  item: SearchMedicineResult
): { isExact: boolean; isApproximate: boolean; score: number; matchedField: string; suggestedTerm: string } {
  const nameArNorm = normalizeArabicText(item.nameAr || '');
  const nameEnNorm = normalizeEnglishText(item.name || '');
  const activeArNorm = normalizeArabicText(item.activeIngredient || '');
  const activeEnNorm = normalizeEnglishText(item.activeIngredient || '');
  const brandArNorm = normalizeArabicText(item.brand || '');
  const brandEnNorm = normalizeEnglishText(item.brand || '');
  const mfgNorm = normalizeEnglishText(item.manufacturer || '');

  // 1. Direct Substring Match
  const exactAr = queryNormAr.length >= 2 && (
    (nameArNorm && nameArNorm.includes(queryNormAr)) ||
    (activeArNorm && activeArNorm.includes(queryNormAr)) ||
    (brandArNorm && brandArNorm.includes(queryNormAr))
  );

  const exactEn = queryNormEn.length >= 2 && (
    (nameEnNorm && nameEnNorm.includes(queryNormEn)) ||
    (activeEnNorm && activeEnNorm.includes(queryNormEn)) ||
    (brandEnNorm && brandEnNorm.includes(queryNormEn)) ||
    (mfgNorm && mfgNorm.includes(queryNormEn))
  );

  if (exactAr || exactEn) {
    return {
      isExact: true,
      isApproximate: false,
      score: 1.0,
      matchedField: exactAr ? (item.nameAr || item.name) : item.name,
      suggestedTerm: exactAr ? (item.nameAr || item.name) : item.name,
    };
  }

  // 2. Approximate / Fuzzy Matching (Levenshtein + Bigram)
  const candidatePool: Array<{ text: string; raw: string; lang: 'ar' | 'en' }> = [
    { text: nameArNorm, raw: item.nameAr || '', lang: 'ar' },
    { text: nameEnNorm, raw: item.name, lang: 'en' },
    { text: activeArNorm, raw: item.activeIngredient || '', lang: 'ar' },
    { text: activeEnNorm, raw: item.activeIngredient || '', lang: 'en' },
    { text: brandArNorm, raw: item.brand || '', lang: 'ar' },
    { text: brandEnNorm, raw: item.brand || '', lang: 'en' },
  ];

  let highestScore = 0;
  let bestMatchedRaw = item.name;

  for (const candidate of candidatePool) {
    if (!candidate.text) continue;
    const q = candidate.lang === 'ar' ? queryNormAr : queryNormEn;
    if (!q || q.length < 2) continue;

    // Check against individual tokens and full candidate string
    const tokens = candidate.text.split(' ').filter((t) => t.length >= 2);
    tokens.push(candidate.text);

    for (const token of tokens) {
      const bigram = calculateBigramSimilarity(q, token);
      const lev = calculateLevenshtein(q, token);
      const maxLen = Math.max(q.length, token.length);
      const levScore = 1 - (lev / maxLen);

      // Thresholds: length >= 4 allows distance <= 2; length 3 allows distance <= 1
      const isLevClose = (q.length >= 4 && lev <= 2) || (q.length === 3 && lev <= 1);
      const isBigramClose = bigram >= 0.45;

      const score = Math.max(bigram, isLevClose ? levScore : 0);

      if ((isLevClose || isBigramClose) && score > highestScore) {
        highestScore = score;
        bestMatchedRaw = candidate.raw || item.name;
      }
    }
  }

  if (highestScore >= 0.45) {
    return {
      isExact: false,
      isApproximate: true,
      score: highestScore,
      matchedField: bestMatchedRaw,
      suggestedTerm: bestMatchedRaw,
    };
  }

  return {
    isExact: false,
    isApproximate: false,
    score: 0,
    matchedField: '',
    suggestedTerm: '',
  };
}

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
  const [approximateSuggestions, setApproximateSuggestions] = useState<ApproximateMatch[]>([]);
  const [suggestedQuery, setSuggestedQuery] = useState<string | null>(null);
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

  // 200ms debounced search using normalized matching and approximate suggestions
  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setApproximateSuggestions([]);
      setSuggestedQuery(null);
      setIsOpen(false);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const liveResults: SearchMedicineResult[] = [];

        // 1. Fetch strictly from real Firestore database collections
        if (sourceType === 'wholesale' || sourceType === 'all') {
          const wholesaleSnap = await getDocs(query(collection(db, 'wholesale_medicines'), limit(60)));
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
          const retailSnap = await getDocs(query(collection(db, 'medicines'), limit(60)));
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

        // 2. Perform normalized matching & approximate typo/similarity analysis
        const queryNormAr = normalizeArabicText(trimmed);
        const queryNormEn = normalizeEnglishText(trimmed);

        const directMatches: SearchMedicineResult[] = [];
        const fuzzyMatches: ApproximateMatch[] = [];
        const seenDirect = new Set<string>();
        const seenFuzzy = new Set<string>();

        for (const item of liveResults) {
          if (filterFacilityId && item.facilityId === filterFacilityId) {
            continue;
          }
          if (sourceType !== 'all' && item.sourceType !== sourceType) {
            continue;
          }

          const match = evaluateMedicineMatch(queryNormAr, queryNormEn, item);
          const dedupeKey = `${item.name}-${item.strength}-${item.facilityId}`;

          if (match.isExact) {
            if (!seenDirect.has(dedupeKey)) {
              seenDirect.add(dedupeKey);
              directMatches.push(item);
            }
          } else if (match.isApproximate) {
            if (!seenFuzzy.has(dedupeKey)) {
              seenFuzzy.add(dedupeKey);
              fuzzyMatches.push({
                item,
                score: match.score,
                matchedField: match.matchedField,
                suggestedTerm: match.suggestedTerm,
              });
            }
          }
        }

        // Sort approximate suggestions descending by closeness score
        fuzzyMatches.sort((a, b) => b.score - a.score);

        setResults(directMatches.slice(0, 8));
        setApproximateSuggestions(fuzzyMatches.slice(0, 6));

        // Did you mean prompt if direct matches are empty but approximate ones exist
        if (directMatches.length === 0 && fuzzyMatches.length > 0) {
          setSuggestedQuery(fuzzyMatches[0].suggestedTerm);
        } else {
          setSuggestedQuery(null);
        }
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err: unknown) {
        setSearchError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
        setApproximateSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

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
            if (results.length > 0 || approximateSuggestions.length > 0 || searchTerm.trim().length >= 2) setIsOpen(true);
          }}
          placeholder={
            placeholder ||
            (language === 'ar'
              ? 'ابحث بالاسم التجاري، المادة الفعالة أو الشركة (حرفين فأكثر)...'
              : 'Search trade name, active ingredient or manufacturer (2+ chars)...')
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
              setApproximateSuggestions([]);
              setSuggestedQuery(null);
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
      {isOpen && searchTerm.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 animate-in fade-in-50 duration-150">
          
          {/* Header Summary */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              <span>
                {isSearching
                  ? (language === 'ar' ? 'جاري البحث الذكي في قاعدة البيانات الطبية...' : 'Searching medical database...')
                  : results.length > 0
                  ? (language === 'ar' ? `نتائج مطابقة: ${results.length} مستحضر معتمد` : `Exact matches: ${results.length} products`)
                  : approximateSuggestions.length > 0
                  ? (language === 'ar' ? `مقترحات مقاربة: ${approximateSuggestions.length} مستحضر` : `Approximate suggestions: ${approximateSuggestions.length}`)
                  : (language === 'ar' ? 'نتائج البحث الطبي' : 'Search Results')}
              </span>
            </span>
            <span className="text-[10px] text-slate-400">
              {language === 'ar' ? 'قاعدة بيانات حقيقية معتمدة' : 'Verified Database'}
            </span>
          </div>

          {/* Loading Indicator */}
          {isSearching && (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin text-[#003366]" />
              <span>{language === 'ar' ? 'جاري مطابقة الأسماء والمواد الفعالة والمقترحات المقاربة...' : 'Matching chemical & brand names...'}</span>
            </div>
          )}

          {/* Did You Mean Suggestion Banner */}
          {!isSearching && suggestedQuery && results.length === 0 && (
            <div className="p-3 bg-amber-50/90 border-b border-amber-200/80 flex items-center justify-between text-xs text-amber-950">
              <div className="flex items-center gap-2 min-w-0">
                <Lightbulb size={16} className="text-amber-600 shrink-0" />
                <span className="truncate">
                  {language === 'ar' ? 'هل تقصد: ' : 'Did you mean: '}
                  <button
                    type="button"
                    onClick={() => setSearchTerm(suggestedQuery)}
                    className="font-bold underline text-[#003366] hover:text-[#002244] cursor-pointer inline-block"
                  >
                    {suggestedQuery}
                  </button>
                  ؟
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSearchTerm(suggestedQuery)}
                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer transition-colors shadow-xs"
              >
                {language === 'ar' ? 'تطبيق المقترح' : 'Use Suggestion'}
              </button>
            </div>
          )}

          {/* Clean Empty State */}
          {!isSearching && results.length === 0 && approximateSuggestions.length === 0 && !searchError && (
            <div className="p-6 text-center text-slate-500 text-xs space-y-2">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-1">
                <Search size={18} />
              </div>
              <p className="font-bold text-slate-800 text-sm">
                {language === 'ar' ? 'لم يتم العثور على أدوية مطابقة' : 'No matching medications found'}
              </p>
              <p className="text-slate-400 text-xs">
                {language === 'ar' ? 'تأكد من كتابة الاسم التجاري أو المادة الفعالة بشكل صحيح.' : 'Check the spelling of the brand or generic name.'}
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

          {/* Direct Matching Results List */}
          {!isSearching && results.length > 0 && (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                {language === 'ar' ? 'الأدوية المطابقة:' : 'Matching Medications:'}
              </div>
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
                      <DosageFormVisual
                        dosageForm={item.dosageForm}
                        photoUrl={item.photoUrl}
                        name={item.name}
                        size="md"
                      />

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 leading-tight">
                            {item.name}
                          </span>
                          {item.nameAr && item.nameAr !== item.name && (
                            <span className="text-xs text-slate-600 font-medium">
                              ({item.nameAr})
                            </span>
                          )}
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
                          {item.manufacturer && (
                            <>
                              <span className="mx-1.5 text-slate-300">|</span>
                              <span>{item.manufacturer}</span>
                            </>
                          )}
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

          {/* Approximate Suggestions Section ("مقترحات مقاربة لبحثك: هل تقصد...؟") */}
          {!isSearching && approximateSuggestions.length > 0 && (
            <div className="border-t border-amber-200/70 bg-amber-50/30">
              <div className="p-2.5 bg-amber-100/60 flex items-center justify-between text-[11px] font-bold text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Lightbulb size={13} className="text-amber-600" />
                  <span>
                    {language === 'ar' 
                      ? 'مقترحات ومستحضرات مقاربة لبحثك (هل تقصد...؟):' 
                      : 'Approximate Suggestions (Did you mean?):'}
                  </span>
                </span>
                <span className="text-[10px] font-normal text-amber-800">
                  {language === 'ar' ? 'تشابه لغوي وإملائي' : 'Fuzzy matching'}
                </span>
              </div>
              <div className="divide-y divide-amber-100/70 max-h-60 overflow-y-auto">
                {approximateSuggestions.map((suggestion, sIdx) => {
                  const sItem = suggestion.item;
                  return (
                    <div
                      key={`approx-${sItem.id}-${sIdx}`}
                      onClick={() => handleSelectItem(sItem)}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-amber-100/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                          <CornerDownRight size={15} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs sm:text-sm text-slate-900">
                              {sItem.name}
                            </span>
                            {sItem.nameAr && sItem.nameAr !== sItem.name && (
                              <span className="text-xs text-slate-600">
                                ({sItem.nameAr})
                              </span>
                            )}
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                              {language === 'ar' ? 'مقترح مقارب' : 'Suggested'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            <span className="font-semibold text-slate-700">{sItem.activeIngredient}</span>
                            <span className="mx-1">·</span>
                            <span>{sItem.facilityName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-end shrink-0 ps-2">
                        {typeof sItem.priceIqd === 'number' && sItem.priceIqd > 0 && (
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            {sItem.priceIqd.toLocaleString()} <span className="text-[9px] text-slate-500">{language === 'ar' ? 'د.ع' : 'IQD'}</span>
                          </div>
                        )}
                        <span className="text-[10px] text-[#003366] font-bold hover:underline">
                          {language === 'ar' ? 'اختيار' : 'Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
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
