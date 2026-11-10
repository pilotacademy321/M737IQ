import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserRole } from '../types';
import { 
  User, 
  Stethoscope, 
  Scan, 
  FlaskConical, 
  Pill, 
  Users, 
  ShieldCheck, 
  AlertCircle,
  Building2,
  CheckCircle2,
  FileCheck2,
  Lock,
  ArrowRight,
  ArrowLeft,
  ScrollText,
  PenTool,
  CheckSquare,
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  getActiveContractTemplate, 
  saveUserLegalAgreement, 
  CURRENT_CONTRACT_VERSION 
} from '../lib/legalContractService';

export const OnboardingModal: React.FC = () => {
  const { user, needsOnboarding, registerAsPatient, applyForProfessionalRole, signOut, loading, authError } = useAuth();
  const { language, isRTL } = useLanguage();

  // Wizard Step: 1 = Profile & Role Info, 2 = Mandatory Medical Consent & Electronic Contract
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Form Fields (Step 1)
  const [selectedType, setSelectedType] = useState<'patient' | 'professional'>('patient');
  const [selectedRole, setSelectedRole] = useState<UserRole>('doctor');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [governorate, setGovernorate] = useState('بغداد (Baghdad)');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Legal Consent & Electronic Contract Fields (Step 2)
  const [contractTemplate, setContractTemplate] = useState<{
    version: string;
    titleAr: string;
    titleEn: string;
    contentAr: string;
    contentEn: string;
  } | null>(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [medicalDisclaimerAccepted, setMedicalDisclaimerAccepted] = useState(false);
  const [dataProcessingConsentAccepted, setDataProcessingConsentAccepted] = useState(false);
  const [legalLiabilityAcknowledged, setLegalLiabilityAcknowledged] = useState(false);
  const [signatureFullName, setSignatureFullName] = useState(user?.displayName || '');
  const [isSubmittingContract, setIsSubmittingContract] = useState(false);

  // Load contract template
  useEffect(() => {
    let isMounted = true;
    getActiveContractTemplate().then((tpl) => {
      if (isMounted) {
        setContractTemplate({
          version: tpl.version || CURRENT_CONTRACT_VERSION,
          titleAr: tpl.titleAr,
          titleEn: tpl.titleEn,
          contentAr: tpl.contentAr,
          contentEn: tpl.contentEn,
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  if (!needsOnboarding || !user) return null;

  const governoratesList = [
    'بغداد (Baghdad)',
    'البصرة (Basra)',
    'أربيل (Erbil)',
    'النجف الأشرف (Najaf)',
    'كربلاء المقدسة (Karbala)',
    'نينوى / الموصل (Nineveh)',
    'السليمانية (Sulaymaniyah)',
    'بابل / الحلة (Babylon)',
    'الأنبار (Anbar)',
    'ديالى (Diyala)',
    'كركوك (Kirkuk)',
    'ذي قار / الناصرية (Dhi Qar)',
    'ميسان / العمارة (Maysan)',
    'المثنى / السماوة (Muthanna)',
    'القادسية / الديوانية (Qadisiyyah)',
    'واسط / الكوت (Wasit)',
    'صلاح الدين (Saladin)',
    'دهوك (Duhok)'
  ];

  // Validate step 1 and proceed to step 2 (contract & medical consent)
  const handleProceedToContract = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!displayName.trim()) {
      setFormError(language === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Please provide full name');
      return;
    }

    if (selectedType === 'professional') {
      if (!licenseNumber.trim() || !facilityName.trim() || !phone.trim()) {
        setFormError(
          language === 'ar'
            ? 'يرجى إكمال بيانات الترخيص المهني واسم المنشأة ورقم الهاتف'
            : 'Please complete license number, facility name, and phone'
        );
        return;
      }
    }

    // Default signature name to full name if empty
    if (!signatureFullName.trim()) {
      setSignatureFullName(displayName.trim());
    }

    setCurrentStep(2);
  };

  // Final submission on step 2
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!termsAccepted || !medicalDisclaimerAccepted || !dataProcessingConsentAccepted || !legalLiabilityAcknowledged) {
      setFormError(
        language === 'ar'
          ? 'يجب الموافقة الصريحة وتفعيل جميع الإقرارات الطبية والقانونية الأربعة للمتابعة'
          : 'You must check all 4 mandatory medical and legal consents to proceed'
      );
      return;
    }

    if (!signatureFullName.trim()) {
      setFormError(
        language === 'ar'
          ? 'يرجى كتابة اسمك الثلاثي الكامل الصريح في خانة التوقيع الإلكتروني'
          : 'Please enter your full legal name in the electronic signature box'
      );
      return;
    }

    setIsSubmittingContract(true);

    try {
      const activeRole: UserRole = selectedType === 'patient' ? 'patient' : selectedRole;
      const contractContent = language === 'ar' 
        ? (contractTemplate?.contentAr || '') 
        : (contractTemplate?.contentEn || '');

      // 1. Save immutable legal contract audit record in Firestore
      await saveUserLegalAgreement({
        userId: user.uid,
        userEmail: user.email || '',
        displayName: displayName.trim(),
        role: activeRole,
        signatureFullName: signatureFullName.trim(),
        termsAccepted,
        medicalDisclaimerAccepted,
        dataProcessingConsentAccepted,
        legalLiabilityAcknowledged,
        contractTextSnapshot: contractContent,
        contractVersion: contractTemplate?.version || CURRENT_CONTRACT_VERSION,
      });

      // 2. Complete user profile onboarding in AuthContext
      if (selectedType === 'patient') {
        await registerAsPatient(displayName.trim(), phone.trim());
      } else {
        await applyForProfessionalRole({
          role: selectedRole,
          displayName: displayName.trim(),
          licenseNumber: licenseNumber.trim(),
          facilityName: facilityName.trim(),
          governorate,
          phone: phone.trim(),
        });
      }
    } catch (err: any) {
      console.error('Onboarding submission error:', err);
      setFormError(err?.message || (language === 'ar' ? 'حدث خطأ أثناء حفظ البيانات، يرجى المحاولة ثانية' : 'Error saving data, please retry'));
    } finally {
      setIsSubmittingContract(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl border border-slate-200 text-start">
        {/* Header */}
        <div className="text-center pb-5 border-b border-slate-100">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-200">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>{language === 'ar' ? 'المنظومة الطبية الموحدة — بوابات الرعاية الصحية' : 'Unified Healthcare Platform — Medical Gateways'}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            {currentStep === 1 
              ? (language === 'ar' ? 'تهيئة وتحديد صفة الحساب' : 'Account Setup & Role Selection')
              : (language === 'ar' ? 'الشروط القانونية والإقرار الطبي وعقد الاتفاق الإلكتروني' : 'Legal Terms, Medical Disclaimer & User Agreement Contract')}
          </h2>

          {/* Stepper indicator */}
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className={`flex items-center gap-1.5 text-xs font-bold ${currentStep === 1 ? 'text-[#003366]' : 'text-emerald-600'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${currentStep === 1 ? 'bg-[#003366]' : 'bg-emerald-600'}`}>
                {currentStep === 2 ? '✓' : '1'}
              </div>
              <span>{language === 'ar' ? 'بيانات الحساب والصفة' : 'Account Details'}</span>
            </div>
            <div className="w-8 h-0.5 bg-slate-200"></div>
            <div className={`flex items-center gap-1.5 text-xs font-bold ${currentStep === 2 ? 'text-[#003366]' : 'text-slate-400'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs text-white ${currentStep === 2 ? 'bg-[#003366]' : 'bg-slate-300'}`}>
                2
              </div>
              <span>{language === 'ar' ? 'العقد والتوقيع الإلكتروني' : 'Agreement & Signature'}</span>
            </div>
          </div>
        </div>

        {/* Error notification */}
        {(formError || authError) && (
          <div className="mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-red-600" />
            <span className="font-medium">{formError || authError}</span>
          </div>
        )}

        {/* ================= STEP 1: Profile & Role Selection ================= */}
        {currentStep === 1 && (
          <form onSubmit={handleProceedToContract} className="mt-6 space-y-6">
            {/* Step 1: Type Selection: Patient vs Healthcare Professional */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {language === 'ar' ? 'نوع الحساب المطلوب:' : 'Account Category:'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType('patient')}
                  className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-start gap-3 ${
                    selectedType === 'patient'
                      ? 'border-[#0284c7] bg-sky-50/60 ring-2 ring-sky-500/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>{language === 'ar' ? 'حساب مريض / مراجع' : 'Patient / Public'}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {language === 'ar' ? 'مجاني ومباشر' : 'Free Instant'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'ar'
                        ? 'للمواطنين لحجز المواعيد واستعراض نتائج التحاليل والبحث عن الأدوية.'
                        : 'For individuals booking doctor appointments and tracking health records.'}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('professional')}
                  className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-start gap-3 ${
                    selectedType === 'professional'
                      ? 'border-[#003366] bg-slate-50 ring-2 ring-[#003366]/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#003366] text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Stethoscope size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                      <span>{language === 'ar' ? 'منشأة أو كادر صحي' : 'Healthcare Professional'}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        {language === 'ar' ? 'يتطلب اعتماد' : 'Verification'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {language === 'ar'
                        ? 'للأطباء والمختبرات ومراكز الأشعة والصيدليات والكوادر الإدارية.'
                        : 'For doctors, clinical labs, imaging centers, pharmacies, and desk coordinators.'}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Sub-roles for Healthcare Professional */}
            {selectedType === 'professional' && (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {language === 'ar' ? 'اختر التخصص / القطاع الصحي:' : 'Select Healthcare Specialization:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { role: 'doctor' as UserRole, labelAr: 'طبيب اختصاص', labelEn: 'Medical Doctor', icon: Stethoscope, color: 'text-red-600' },
                    { role: 'radiology_center' as UserRole, labelAr: 'مركز أشعة وسونار', labelEn: 'Radiology Center', icon: Scan, color: 'text-cyan-600' },
                    { role: 'laboratory' as UserRole, labelAr: 'مختبر تحاليل', labelEn: 'Clinical Laboratory', icon: FlaskConical, color: 'text-orange-600' },
                    { role: 'pharmacy' as UserRole, labelAr: 'صيدلية أهلية', labelEn: 'Pharmacy', icon: Pill, color: 'text-emerald-600' },
                    { role: 'wholesaler' as UserRole, labelAr: 'مذخر / مكتب علمي', labelEn: 'Drug Warehouse', icon: Building2, color: 'text-teal-600' },
                    { role: 'secretary' as UserRole, labelAr: 'سكرتير / استقبال', labelEn: 'Clinic Secretary', icon: Users, color: 'text-blue-600' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isChosen = selectedRole === item.role;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        onClick={() => setSelectedRole(item.role)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                          isChosen
                            ? 'border-[#003366] bg-slate-100 font-bold text-slate-900 shadow-xs'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={20} className={item.color} />
                        <span className="text-xs">{language === 'ar' ? item.labelAr : item.labelEn}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* General Fields */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'الاسم الكامل أو الاسم التجاري *' : 'Full Name or Organization Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={language === 'ar' ? 'مثال: د. أحمد علي أو علي حسن' : 'e.g. Dr. Ahmed Ali or Ali Hassan'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'رقم الهاتف (واتساب للتواصل)' : 'Phone / WhatsApp'}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
                />
              </div>

              {selectedType === 'professional' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {language === 'ar' ? 'رقم ترخيص النقابة / الإجازة *' : 'Syndicate / Practice License *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="IQ-MED-XXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        {language === 'ar' ? 'اسم العيادة / المركز / الصيدلية *' : 'Facility / Practice Name *'}
                      </label>
                      <input
                        type="text"
                        required
                        value={facilityName}
                        onChange={(e) => setFacilityName(e.target.value)}
                        placeholder={language === 'ar' ? 'عيادة بغداد التخصصية' : 'Baghdad Specialty Clinic'}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {language === 'ar' ? 'المحافظة *' : 'Governorate *'}
                    </label>
                    <select
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] bg-white"
                    >
                      {governoratesList.map((gov) => (
                        <option key={gov} value={gov}>
                          {gov}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#003366] hover:bg-[#002244] shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <span>{language === 'ar' ? 'الانتقال للشروط والعقد الطبي' : 'Proceed to Legal Contract'}</span>
                {isRTL ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
              </button>
            </div>
          </form>
        )}

        {/* ================= STEP 2: Medical Consent & Electronic Agreement Contract ================= */}
        {currentStep === 2 && (
          <form onSubmit={handleFinalSubmit} className="mt-5 space-y-5 animate-in fade-in duration-150">
            {/* Legal Notice Header */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 leading-relaxed">
              <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">
                  {language === 'ar' ? 'تنبيه قانوني وطبي ملزم وفق القانون العراقي:' : 'Mandatory Medical & Legal Notice under Iraqi Law:'}
                </p>
                <p className="mt-0.5 text-amber-800">
                  {language === 'ar'
                    ? 'هذه المنظومة وسيلة تقنية لتنظيم التواصل والمواعيد ولا تعد بديلاً عن التدخل الطبي الطارئ أو الفحص السريري المباشر. تخضع بنود هذا العقد للمراجعة القانونية المستمرة ولا تشكل إعفاءً تلقائياً من أي مسؤولية قانونية نظامية مقررة بحكم القانون.'
                    : 'The platform is a digital communication and appointment facilitation tool, NOT a substitute for urgent clinical in-person examination or emergency intervention. Acceptance does not constitute an automatic statutory liability waiver under applicable laws.'}
                </p>
              </div>
            </div>

            {/* Scrollable Contract Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <ScrollText size={15} className="text-[#003366]" />
                  <span>
                    {language === 'ar' 
                      ? (contractTemplate?.titleAr || 'عقد الاتفاق والشروط القانونية والطبية المعتمدة')
                      : (contractTemplate?.titleEn || 'Official User Agreement & Medical Consent Contract')}
                  </span>
                </label>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                  {contractTemplate?.version || CURRENT_CONTRACT_VERSION}
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 h-64 overflow-y-auto text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line shadow-inner focus:outline-none focus:ring-1 focus:ring-slate-300">
                {language === 'ar' ? contractTemplate?.contentAr : contractTemplate?.contentEn}
              </div>
            </div>

            {/* Mandatory Checkboxes */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50/70 border border-slate-200">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
                {language === 'ar' ? 'الإقرارات والموافقات الإلزامية المطلوبة:' : 'Mandatory Disclosures & Required Consents:'}
              </h4>

              {/* Checkbox 1: Terms & Privacy */}
              <label className="flex items-start gap-3 cursor-pointer group text-xs text-slate-700">
                <input
                  type="checkbox"
                  required
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#003366] focus:ring-[#003366] border-slate-300 cursor-pointer"
                />
                <span className="leading-snug">
                  {language === 'ar' ? (
                    <>
                      أوافق صراحة وبشكل كامل على <strong className="text-slate-900">شروط الاستخدام وسياسة الخصوصية وحماية البيانات</strong> الخاصة بالمنظومة الطبية.
                    </>
                  ) : (
                    <>
                      I explicitly agree to the <strong className="text-slate-900">Terms of Service and Privacy Policy</strong> of the Healthcare Platform.
                    </>
                  )}
                </span>
              </label>

              {/* Checkbox 2: Medical Disclaimer */}
              <label className="flex items-start gap-3 cursor-pointer group text-xs text-slate-700">
                <input
                  type="checkbox"
                  required
                  checked={medicalDisclaimerAccepted}
                  onChange={(e) => setMedicalDisclaimerAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#003366] focus:ring-[#003366] border-slate-300 cursor-pointer"
                />
                <span className="leading-snug">
                  {language === 'ar' ? (
                    <>
                      أقر وأدرك بأن <strong className="text-slate-900">المنصة وسيلة تقنية للتواصل وتنظيم المواعيد والسجلات وليست بديلاً عن حالات الطوارئ أو الفحص السريري المباشر</strong>، وفي الحالات الحرجة يجب التوجه فوراً لأقرب مستشفى.
                    </>
                  ) : (
                    <>
                      I acknowledge that <strong className="text-slate-900">the platform facilitates appointments and communication and is NOT an emergency service or substitute for in-person physical clinical examination</strong>.
                    </>
                  )}
                </span>
              </label>

              {/* Checkbox 3: Sensitive Medical Data Processing Consent */}
              <label className="flex items-start gap-3 cursor-pointer group text-xs text-slate-700">
                <input
                  type="checkbox"
                  required
                  checked={dataProcessingConsentAccepted}
                  onChange={(e) => setDataProcessingConsentAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#003366] focus:ring-[#003366] border-slate-300 cursor-pointer"
                />
                <span className="leading-snug">
                  {language === 'ar' ? (
                    <>
                      أمنح <strong className="text-slate-900">موافقة صريحة على تخزين وتشفير ومعالجة بياناتي الطبية والصحية</strong> حصرياً لغرض تقديم الرعاية الصحية دون بيعها أو مشاركتها لأغراض إعلانية.
                    </>
                  ) : (
                    <>
                      I grant <strong className="text-slate-900">explicit consent to store, encrypt, and process health records</strong> strictly for healthcare delivery without commercial sale.
                    </>
                  )}
                </span>
              </label>

              {/* Checkbox 4: Platform & Clinician Liability under Iraqi Law */}
              <label className="flex items-start gap-3 cursor-pointer group text-xs text-slate-700">
                <input
                  type="checkbox"
                  required
                  checked={legalLiabilityAcknowledged}
                  onChange={(e) => setLegalLiabilityAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#003366] focus:ring-[#003366] border-slate-300 cursor-pointer"
                />
                <span className="leading-snug">
                  {language === 'ar' ? (
                    <>
                      أقر بفهم <strong className="text-slate-900">مسؤوليات المنصة والأطباء وحدود مسؤولية مدير المنصة وفق القانون العراقي</strong>، مع العلم أن هذا الاتفاق لا يشكل إعفاءً تلقائياً من أي مسؤولية قانونية نظامية مقررة بحكم القانون.
                    </>
                  ) : (
                    <>
                      I acknowledge the <strong className="text-slate-900">responsibilities and liability boundaries of the platform and clinicians under Iraqi law</strong>, acknowledging that this does not constitute an automatic statutory waiver.
                    </>
                  )}
                </span>
              </label>
            </div>

            {/* Electronic Signature Section */}
            <div className="p-4 rounded-2xl bg-white border-2 border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <PenTool size={16} className="text-[#003366]" />
                  <span>
                    {language === 'ar' 
                      ? 'التوقيع الإلكتروني بالعقد — الاسم الثلاثي القانوني الكامل *' 
                      : 'Electronic Contract Signature — Full Legal Name *'}
                  </span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  {language === 'ar' ? 'قانون المعاملات الإلكترونية رقم 78 لسنة 2012' : 'Electronic Transactions Law No. 78 of 2012'}
                </span>
              </div>

              <div>
                <input
                  type="text"
                  required
                  value={signatureFullName}
                  onChange={(e) => setSignatureFullName(e.target.value)}
                  placeholder={language === 'ar' ? 'اكتب اسمك الثلاثي الكامل الصريح كما في الهوية الرسمية' : 'Type your full legal name as shown on official ID'}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] bg-slate-50/50"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    {language === 'ar' ? 'الحساب المرتبط:' : 'Linked Account:'} <strong className="text-slate-700">{user.email || user.uid}</strong>
                  </span>
                  <span>
                    {language === 'ar' ? 'التاريخ والوقت:' : 'Timestamp:'} <span className="font-mono">{new Date().toISOString().slice(0, 10)}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation buttons */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                disabled={isSubmittingContract}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                {isRTL ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
                <span>{language === 'ar' ? 'الرجوع للبيانات' : 'Back'}</span>
              </button>

              <button
                type="submit"
                disabled={
                  isSubmittingContract ||
                  loading ||
                  !termsAccepted ||
                  !medicalDisclaimerAccepted ||
                  !dataProcessingConsentAccepted ||
                  !legalLiabilityAcknowledged ||
                  !signatureFullName.trim()
                }
                className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 shadow-md hover:shadow-lg disabled:opacity-40 transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <FileCheck2 size={16} />
                <span>
                  {isSubmittingContract || loading
                    ? (language === 'ar' ? 'جاري توثيق العقد واعتماد الحساب...' : 'Signing Contract & Activating...')
                    : (language === 'ar' ? 'توقيع العقد الإلكتروني وإكمال الحساب' : 'Sign Electronic Agreement & Complete')}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
