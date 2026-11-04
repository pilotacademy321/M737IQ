/**
 * Legal Contract & Medical Consent Service - منصة صحتك
 * Handles:
 * - Terms of Use & Privacy Policy agreement
 * - Medical Disclaimer (communication & coordination tool, not an emergency substitute)
 * - Platform & Clinician liability boundaries under Iraqi Law
 * - Sensitive health data processing explicit consent
 * - Electronic signature recording, verification, and audit trail
 * - Admin template management with revision history
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from './firebase';
import { LegalContractRecord, LegalContractTemplate, UserRole } from '../types';

export const CURRENT_CONTRACT_VERSION = 'v1.0.0-iq-2026';

export const DEFAULT_CONTRACT_TEMPLATE: LegalContractTemplate = {
  id: 'current_contract',
  version: CURRENT_CONTRACT_VERSION,
  titleAr: 'عقد الاتفاق والشروط القانونية والطبية المعتمدة — منصة صحتك',
  titleEn: 'Official Medical Terms & Electronic User Agreement — Sehatok Platform',
  sloganAr: 'تواصلك مع الطبيب أسهل',
  sloganEn: 'Connecting with your doctor is easier',
  contentAr: `عقد اتفاق وإقرار استخدام الخدمات الصحية الرقمية

المقدمة والأطراف:
يُبرم هذا العقد الإلكتروني بين "إدارة منصة صحتك" (الطرف الأول - المزود التقني للخدمة) والمستخدم المسجل أو الكادر الطبي المعتمد (الطرف الثاني - المستخدم أو مقدم الخدمة الصحية). يمثل استخدام المنصة أو تسجيل الحساب موافقة قانونية صريحة وكاملة على البنود والشروط الواردة أدناه وفقاً للقوانين العراقية المعمول بها.

المادة الأولى — طبيعة الخدمة وحدودها:
1. "منصة صحتك" هي منصة رقمية وسيطة لتنظيم وتسهيل التواصل وحجز المواعيد وإدارة السجلات والفحوصات الطبية وصرف الوصفات بين المريض ومقدمي الرعاية الصحية المرخصين.
2. المنصة ليست مستشفى أو مركز طوارئ، ولا تقدم خدمات الإسعاف الفوري أو التدخل الجراحي العاجل.
3. يقر المستخدم إقراراً قاطعاً بأنه في حالات الطوارئ القصوى أو الحوادث الحرجة أو النوبات الحادة، يجب التوجه فوراً وبشكل مباشر إلى أقرب مستشفى أو الاتصال بالإسعاف الفوري، وأن الاستشارات الرقمية لا تحل محل الفحص السريري المباشر.

المادة الثانية — المسؤولية الطبية والمهنية:
1. القرارات التشخيصية، والخطط العلاجية، وقراءة الفحوصات والتحاليل، وكتابة أو صرف الوصفات الطبية هي مسؤولية حصرية ومستقلة للطبيب المعالج أو الصيدلاني أو الاختصاصي المرخص قانوناً داخل جمهورية العراق، وفق قانون نقابة الأطباء رقم (81) لسنة 1984 وقانون مزاولة مهنة الصيدلة والأنظمة الصحية ذات الصلة.
2. لا تتدخل المنصة في جوهر الرأي الطبي أو القرار السريري، وينحصر دورها في البنية التحتية البرمجية وتيسير الربط التكنولوجي.

المادة الثالثة — حدود مسؤولية إدارة المنصة وفق القانون العراقي:
1. تُقدم المنصة خدماتها التقنية بأعلى معايير الدقة والجاهزية. ومع ذلك، لا تتحمل إدارة المنصة أي تبعات ناتجة عن عدم صحة المعلومات المدخلة من قبل المريض، أو عدم التزام المراجع بتعليمات الطبيب، أو أي أعطال اتصالات عامة خارجة عن السيطرة.
2. توضيح صريح: موافقة المستخدم على هذه الشروط لا تعتبر إعفاءً تلقائياً للمنصة أو مديرها من أي مسؤولية قانونية نظامية مقررة بحكم القانون العراقي النافذ، وتبقى هذه الاتفاقية خاضعة لأحكام القانون والمراجعة القضائية المختصة.

المادة الرابعة — الموافقة الصريحة على معالجة البيانات الصحية الحساسة:
1. يوافق الطرف الثاني صراحةً ومسبقاً على قيام "منصة صحتك" بتخزين ومعالجة وتشفير البيانات الطبية والصحية (بما في ذلك السجل المرضي، نتائج التحاليل، صور الأشعة، الوصفات، والمواعيد).
2. الغرض الحصري من هذه المعالجة هو تمكين الأطباء المعالجين والمراكز الطبية المصرح لها من تقديم رعاية صحية متسلسلة ودقيقة.
3. تلتزم المنصة بأعلى معايير التشفير والسرية التامة، وتتعهد بعدم بيع أو مشاركة البيانات الطبية لأي جهات تجارية أو إعلانية.

المادة الخامسة — حجية التوقيع الإلكتروني:
1. يعتبر قيام المستخدم بكتابة اسمه القانوني الصريح ووضع علامة الموافقة في مربع الاختيار بمثابة "توقيع إلكتروني ملزم قانوناً" وفقاً لأحكام قانون التوقيع والمعاملات الإلكترونية العراقي رقم (78) لسنة 2012، وتُحفظ بصمة التوقيع والوقت والتاريخ في سجل التدقيق غير القابل للتعديل.

المادة السادسة — التعديلات والمراجعة الدورية:
1. تخضع بنود هذا العقد للمراجعة والتحديث المستمر بالتوافق مع التطورات التنظيمية والتشريعية في العراق. يحق لمدير المنصة تعديل الصياغة مع حفظ نسخ الأرشيف السابقة وإشعار المستخدمين بأي تحديث جوهري.`,
  contentEn: `Digital Healthcare Services User Agreement & Consent Contract

Preamble & Parties:
This Electronic Agreement is entered into between "Sehatok Platform Administration" (First Party - Technical Infrastructure Provider) and the Registered User or Accredited Healthcare Professional (Second Party - User or Clinical Provider). Using the platform or registering an account constitutes explicit and binding consent under applicable Iraqi laws.

Article 1 — Nature and Scope of Services:
1. "Sehatok Platform" is a digital healthcare coordination platform designed to facilitate appointments, communication, health records, lab reports, and e-prescriptions.
2. The platform is NOT an emergency response facility and does not provide immediate trauma or critical surgical care.
3. The user explicitly acknowledges that in critical medical emergencies, acute episodes, or severe distress, they must immediately visit the nearest emergency room or hospital; digital tools are not a substitute for physical in-person clinical examinations.

Article 2 — Clinical & Professional Responsibility:
1. All clinical diagnoses, therapeutic decisions, lab interpretations, and medicine dispensing remain the exclusive, independent responsibility of licensed physicians and pharmacists under Iraqi Medical Syndicate Law No. 81 of 1984, Pharmacy Practice Regulations, and relevant healthcare statutes.
2. The platform maintains strict neutrality and provides only digital enablement without interference in clinical decisions.

Article 3 — Platform Management Liability Limits under Iraqi Law:
1. The platform strives for maximum technical reliability. The platform administration bears no liability for incorrect user-submitted data, non-compliance with doctor instructions, or external telecommunications outages.
2. Explicit Clause: User acceptance of these terms does NOT constitute an automatic statutory waiver of legal liability for the platform or its manager under mandatory Iraqi law.

Article 4 — Explicit Consent for Sensitive Health Data Processing:
1. The Second Party hereby provides explicit, informed consent for Sehatok Platform to securely store, process, and encrypt sensitive health information (records, lab tests, scans, prescriptions).
2. The sole authorized purpose is enabling treating clinicians to deliver coordinated healthcare.
3. The platform applies rigorous encryption and pledges never to sell or disclose medical data for commercial advertising.

Article 5 — Legal Validity of Electronic Signature:
1. Entering one's full legal name and ticking the mandatory consent checkboxes constitutes a legally binding electronic signature under Iraqi Electronic Transactions Law No. 78 of 2012, archived in an immutable audit ledger.

Article 6 — Ongoing Legal & Regulatory Compliance:
1. This agreement is subject to continuous review under Iraqi medical and legal requirements. Platform management reserves the right to update terms while archiving previous versions.`,
  updatedAt: new Date().toISOString(),
  updatedBy: 'system',
  previousVersions: []
};

/**
 * Fetches the active contract template from Firestore or falls back to default.
 */
export async function getActiveContractTemplate(): Promise<LegalContractTemplate> {
  try {
    const templateDoc = await getDoc(doc(db, 'system_settings', 'legal_contract'));
    if (templateDoc.exists()) {
      return templateDoc.data() as LegalContractTemplate;
    }
  } catch (err) {
    console.warn('[LegalContractService] Using default template fallback:', err);
  }
  return DEFAULT_CONTRACT_TEMPLATE;
}

/**
 * Saves a user's signed contract agreement to Firestore audit log and updates user profile.
 */
export async function saveUserLegalAgreement({
  userId,
  userEmail,
  displayName,
  role,
  signatureFullName,
  signatureDrawData,
  termsAccepted,
  medicalDisclaimerAccepted,
  dataProcessingConsentAccepted,
  legalLiabilityAcknowledged,
  contractTextSnapshot,
  contractVersion = CURRENT_CONTRACT_VERSION,
}: {
  userId: string;
  userEmail: string;
  displayName: string;
  role: UserRole;
  signatureFullName: string;
  signatureDrawData?: string;
  termsAccepted: boolean;
  medicalDisclaimerAccepted: boolean;
  dataProcessingConsentAccepted: boolean;
  legalLiabilityAcknowledged: boolean;
  contractTextSnapshot: string;
  contractVersion?: string;
}): Promise<LegalContractRecord> {
  if (!termsAccepted || !medicalDisclaimerAccepted || !dataProcessingConsentAccepted || !legalLiabilityAcknowledged) {
    throw new Error('يجب الموافقة على جميع الشروط والإقرارات الطبية الإلزامية قبل استكمال التسجيل.');
  }

  const cleanSignature = signatureFullName.trim();
  if (cleanSignature.length < 3) {
    throw new Error('يرجى كتابة الاسم الثلاثي الكامل كتوقيع إلكتروني قانوني معتمد.');
  }

  const now = new Date().toISOString();
  const contractRecordId = `contract_${userId}_${Date.now()}`;

  const record: LegalContractRecord = {
    id: contractRecordId,
    userId,
    userEmail: userEmail || '',
    displayName: displayName || cleanSignature,
    role,
    signatureFullName: cleanSignature,
    signatureDrawData: signatureDrawData || undefined,
    signedAt: now,
    contractVersion,
    contractTitleAr: 'عقد الاتفاق والشروط القانونية والطبية — منصة صحتك',
    contractTitleEn: 'Official Medical Terms & User Agreement — Sehatok Platform',
    contractTextSnapshot,
    termsAccepted: true,
    medicalDisclaimerAccepted: true,
    dataProcessingConsentAccepted: true,
    legalLiabilityAcknowledged: true,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    clientPlatform: typeof navigator !== 'undefined' ? (navigator as any).platform || 'Web' : 'Web',
    status: 'active',
    createdAt: now,
  };

  // 1. Save immutable audit record in 'legal_contracts_audit'
  try {
    await setDoc(doc(db, 'legal_contracts_audit', contractRecordId), record);
  } catch (err) {
    console.error('[LegalContractService] Error saving legal contract audit doc:', err);
    throw err;
  }

  // 2. Update user profile with legalConsent verification fields
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      legalConsent: {
        accepted: true,
        signedAt: now,
        signatureFullName: cleanSignature,
        contractVersion,
        contractRecordId,
        termsAccepted: true,
        medicalDisclaimerAccepted: true,
        dataProcessingAccepted: true,
      },
      updatedAt: now,
    });
  } catch (err) {
    console.warn('[LegalContractService] Note updating user doc legal consent:', err);
  }

  return record;
}

/**
 * Fetches the user's signed contract agreement record from Firestore.
 */
export async function getUserSignedContract(userId: string): Promise<LegalContractRecord | null> {
  if (!userId) return null;
  try {
    // 1. Try finding by contractRecordId on user document
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      const consent = userDoc.data().legalConsent;
      if (consent && consent.contractRecordId) {
        const auditDoc = await getDoc(doc(db, 'legal_contracts_audit', consent.contractRecordId));
        if (auditDoc.exists()) {
          return auditDoc.data() as LegalContractRecord;
        }
      }
    }

    // 2. Fallback query
    const auditColl = collection(db, 'legal_contracts_audit');
    const q = query(auditColl, orderBy('signedAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    const found = snap.docs.find(d => d.data().userId === userId);
    if (found) {
      return found.data() as LegalContractRecord;
    }
  } catch (err) {
    console.warn('[LegalContractService] Error fetching user signed contract:', err);
  }
  return null;
}

/**
 * Updates the contract template text (Super Admin only) with version archival.
 */
export async function updateContractTemplateByAdmin({
  adminUid,
  adminEmail,
  newTitleAr,
  newTitleEn,
  newContentAr,
  newContentEn,
  newVersion,
}: {
  adminUid: string;
  adminEmail: string;
  newTitleAr: string;
  newTitleEn: string;
  newContentAr: string;
  newContentEn: string;
  newVersion?: string;
}): Promise<LegalContractTemplate> {
  const current = await getActiveContractTemplate();
  const now = new Date().toISOString();
  const nextVersion = newVersion || `v1.${(current.previousVersions?.length || 0) + 1}.0-iq-2026`;

  const previousArchive = [
    ...(current.previousVersions || []),
    {
      version: current.version,
      updatedAt: current.updatedAt,
      updatedBy: current.updatedBy,
      contentAr: current.contentAr,
    }
  ];

  const updatedTemplate: LegalContractTemplate = {
    id: 'current_contract',
    version: nextVersion,
    titleAr: newTitleAr.trim() || current.titleAr,
    titleEn: newTitleEn.trim() || current.titleEn,
    sloganAr: 'تواصلك مع الطبيب أسهل',
    sloganEn: 'Connecting with your doctor is easier',
    contentAr: newContentAr.trim() || current.contentAr,
    contentEn: newContentEn.trim() || current.contentEn,
    updatedAt: now,
    updatedBy: adminEmail || adminUid,
    previousVersions: previousArchive,
  };

  await setDoc(doc(db, 'system_settings', 'legal_contract'), updatedTemplate);
  return updatedTemplate;
}

/**
 * Fetches all signed legal contracts for Super Admin audit review.
 */
export async function getAllSignedContractsForAdmin(): Promise<LegalContractRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'legal_contracts_audit'));
    const records = snap.docs.map(d => d.data() as LegalContractRecord);
    records.sort((a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime());
    return records;
  } catch (err) {
    console.error('[LegalContractService] Error fetching audit records:', err);
    return [];
  }
}
