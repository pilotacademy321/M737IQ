import React, { useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ElectronicPrescription } from '../types';
import { 
  Printer, 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  FileCheck2, 
  Clock, 
  Calendar, 
  User, 
  Building2, 
  Pill, 
  Stethoscope, 
  CheckCircle2, 
  QrCode,
  Lock
} from 'lucide-react';

interface PrescriptionPdfModalProps {
  prescription: ElectronicPrescription | null;
  isOpen?: boolean;
  onClose: () => void;
}

export const PrescriptionPdfModal: React.FC<PrescriptionPdfModalProps> = ({
  prescription,
  isOpen = true,
  onClose,
}) => {
  const { user, userProfile, isAdmin } = useAuth();
  const { language, isRTL } = useLanguage();
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !prescription) return null;

  // Strict Authorization Check: Only Doctor, Patient, Target/Dispensed Pharmacy, or Admin can generate or view
  const isAuthorized = Boolean(
    isAdmin ||
    (user && (
      user.uid === prescription.doctorId ||
      user.uid === prescription.patientId ||
      user.uid === prescription.targetPharmacyId ||
      user.uid === prescription.dispensedPharmacyId
    ))
  );

  const handlePrint = () => {
    if (!isAuthorized) return;
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'dispensed':
        return {
          labelAr: 'تم الصرف رسمياً',
          labelEn: 'Dispensed & Certified',
          classes: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      case 'dispensing':
        return {
          labelAr: 'قيد التجهيز والصرف',
          labelEn: 'Dispensing in Progress',
          classes: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      case 'accepted':
        return {
          labelAr: 'مقبولة لدى الصيدلية',
          labelEn: 'Accepted by Pharmacy',
          classes: 'bg-teal-100 text-teal-800 border-teal-300',
        };
      case 'received':
        return {
          labelAr: 'مستلمة وقيد التدقيق',
          labelEn: 'Received at Pharmacy',
          classes: 'bg-purple-100 text-purple-800 border-purple-300',
        };
      case 'rejected':
        return {
          labelAr: 'مرفوضة من الصيدلية',
          labelEn: 'Rejected by Pharmacy',
          classes: 'bg-red-100 text-red-800 border-red-300',
        };
      case 'sent':
        return {
          labelAr: 'مرسلة ومعتمدة',
          labelEn: 'Issued & Sent',
          classes: 'bg-amber-100 text-amber-800 border-amber-300',
        };
      default:
        return {
          labelAr: 'مسودة طبية',
          labelEn: 'Draft',
          classes: 'bg-slate-100 text-slate-700 border-slate-300',
        };
    }
  };

  const statusInfo = getStatusBadge(prescription.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Top Bar (Hidden on print) */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#003366] text-white flex items-center justify-center shadow-xs">
              <FileCheck2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {language === 'ar' ? 'نسخة الوصفة الإلكترونية الرسمية (PDF)' : 'Official Electronic Prescription (PDF)'}
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {prescription.prescriptionNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthorized && (
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#002244] transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Printer size={16} />
                <span>{language === 'ar' ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-10 flex-1">
          {!isAuthorized ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <Lock size={28} />
              </div>
              <h4 className="text-lg font-bold text-slate-900">
                {language === 'ar' ? 'وصول مقيّد — غير مصرح' : 'Access Restricted — Unauthorized'}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
                {language === 'ar'
                  ? 'هذه الوصفة الطبية مشفرة ومحمية بموجب معايير خصوصية المريض. لا يمكن استعراضها أو تصديرها إلا بواسطة الطبيب المعالج، المريض صاحب الوصفة، أو الصيدلية المعتمدة المصرح لها بالصرف.'
                  : 'This medical prescription is encrypted and protected. Access is strictly granted to the issuing doctor, patient, or certified pharmacy.'}
              </p>
            </div>
          ) : (
            /* Printable Prescription Document Sheet */
            <div 
              ref={printContentRef}
              className="border-2 border-slate-300 rounded-2xl p-6 sm:p-8 bg-white relative print:border-slate-800 print:p-6"
            >
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-2 border-slate-800">
                <div className="space-y-1 text-start">
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-[#003366] tracking-tight">
                      M737 MEDICAL PLATFORM
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600">
                    {language === 'ar' ? 'المنظومة الصحية الرقمية المعتمدة — جمهورية العراق' : 'Certified Digital Healthcare System — Republic of Iraq'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    RX ID: {prescription.prescriptionNumber}
                  </p>
                </div>

                {/* Status Stamp */}
                <div className="flex flex-col items-start sm:items-end gap-1.5">
                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusInfo.classes}`}>
                    {language === 'ar' ? statusInfo.labelAr : statusInfo.labelEn}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {language === 'ar' ? 'تاريخ التحرير: ' : 'Issued Date: '}
                    {new Date(prescription.createdAt).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              {/* Doctor & Patient Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                {/* Doctor Info */}
                <div className="space-y-1">
                  <span className="font-bold text-[#003366] text-[11px] uppercase tracking-wider block mb-1">
                    {language === 'ar' ? 'بيانات الطبيب المعالج والعيادة:' : 'Prescribing Clinician:'}
                  </span>
                  <div className="font-bold text-sm text-slate-900">{prescription.doctorName}</div>
                  {prescription.doctorSpecialty && (
                    <div className="text-slate-600 font-medium">{prescription.doctorSpecialty}</div>
                  )}
                  {prescription.clinicName && (
                    <div className="text-slate-500">{prescription.clinicName}</div>
                  )}
                  {prescription.doctorLicense && (
                    <div className="text-slate-400 font-mono">
                      {language === 'ar' ? `رقم الإجازة: ${prescription.doctorLicense}` : `License: ${prescription.doctorLicense}`}
                    </div>
                  )}
                </div>

                {/* Patient Info */}
                <div className="space-y-1 sm:border-s sm:border-slate-200 sm:ps-4">
                  <span className="font-bold text-[#003366] text-[11px] uppercase tracking-wider block mb-1">
                    {language === 'ar' ? 'بيانات المريض:' : 'Patient Details:'}
                  </span>
                  <div className="font-bold text-sm text-slate-900">{prescription.patientName}</div>
                  {prescription.patientPhone && (
                    <div className="text-slate-600 font-mono">{prescription.patientPhone}</div>
                  )}
                  {prescription.diagnosis && (
                    <div className="text-slate-700">
                      <span className="font-bold">{language === 'ar' ? 'التشخيص: ' : 'Diagnosis: '}</span>
                      <span>{prescription.diagnosis}</span>
                    </div>
                  )}
                  {prescription.patientAllergies && prescription.patientAllergies.length > 0 && (
                    <div className="text-red-600 font-bold flex items-center gap-1 pt-1">
                      <AlertTriangle size={13} />
                      <span>{language === 'ar' ? 'تحذير الحساسية: ' : 'Allergies: '}</span>
                      <span>{prescription.patientAllergies.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Target / Dispensing Pharmacy Information */}
              {(prescription.targetPharmacyName || prescription.dispensedPharmacyName) && (
                <div className="p-3 mb-6 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-emerald-900 block">
                      {language === 'ar' ? 'الصيدلية المصرح لها بالصرف:' : 'Designated Pharmacy:'}
                    </span>
                    <span className="text-emerald-800">
                      {prescription.dispensedPharmacyName || prescription.targetPharmacyName}
                    </span>
                  </div>
                  {prescription.dispensedAt && (
                    <div className="text-end">
                      <span className="font-bold text-emerald-900 block">
                        {language === 'ar' ? 'تاريخ ووقت الصرف:' : 'Dispensed Timestamp:'}
                      </span>
                      <span className="text-emerald-700 font-mono">
                        {new Date(prescription.dispensedAt).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Prescription Items (Rx Symbol + Table) */}
              <div className="my-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl font-serif font-black text-[#003366]">℞</span>
                  <h4 className="font-black text-sm text-slate-900 uppercase tracking-wider">
                    {language === 'ar' ? 'الأدوية والمستحضرات الموصوفة' : 'Prescribed Medications'}
                  </h4>
                </div>

                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                      <tr>
                        <th className="p-2.5 text-start w-10">#</th>
                        <th className="p-2.5 text-start">{language === 'ar' ? 'اسم الدواء والتركيز' : 'Medication & Strength'}</th>
                        <th className="p-2.5 text-start">{language === 'ar' ? 'الشكل والجرعة' : 'Form & Dosage'}</th>
                        <th className="p-2.5 text-start">{language === 'ar' ? 'التكرار والمدة' : 'Frequency & Duration'}</th>
                        <th className="p-2.5 text-start">{language === 'ar' ? 'التعليمات' : 'Directions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {prescription.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="p-2.5">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.activeIngredient && (
                              <div className="text-[11px] text-slate-500">{item.activeIngredient}</div>
                            )}
                            <div className="text-[11px] font-semibold text-[#003366]">{item.strength}</div>
                          </td>
                          <td className="p-2.5 text-slate-700">
                            <div>{item.dosageForm}</div>
                            <div className="font-bold text-slate-900">{item.dosage}</div>
                          </td>
                          <td className="p-2.5 text-slate-700">
                            <div className="font-semibold text-slate-900">{item.frequency}</div>
                            <div className="text-slate-500">{item.duration}</div>
                          </td>
                          <td className="p-2.5 text-slate-600">
                            {item.instructions || '—'}
                            {item.warnings && (
                              <div className="text-amber-700 font-bold text-[10px] mt-0.5">
                                ⚠️ {item.warnings}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* General Clinical Instructions */}
              {prescription.generalInstructions && (
                <div className="p-3 my-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-bold text-slate-800 block mb-1">
                    {language === 'ar' ? 'تعليمات وإرشادات الطبيب العامة للمريض:' : 'General Clinical Advice:'}
                  </span>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {prescription.generalInstructions}
                  </p>
                </div>
              )}

              {/* Clinical Correction Audit Trail (if any) */}
              {prescription.corrections && prescription.corrections.length > 0 && (
                <div className="p-3 my-4 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <span className="font-bold text-amber-900 block mb-1">
                    {language === 'ar' ? 'سجل التدقيق والتعديلات السريرية المصرح بها:' : 'Authorized Clinical Amendments History:'}
                  </span>
                  {prescription.corrections.map((corr, cIdx) => (
                    <div key={cIdx} className="text-amber-800 text-[11px] pt-1">
                      • {new Date(corr.correctedAt).toLocaleDateString()} — {corr.reason} (بواسطة {corr.correctedBy})
                    </div>
                  ))}
                </div>
              )}

              {/* Dispensed Certification Section */}
              {prescription.status === 'dispensed' && (
                <div className="p-4 my-6 rounded-2xl bg-emerald-50 border-2 border-dashed border-emerald-300 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={28} className="text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-black text-emerald-950 text-sm">
                        {language === 'ar' ? 'تم صرف هذه الوصفة الطبية رسمياً' : 'Official Dispensation Certified'}
                      </div>
                      <div className="text-emerald-800">
                        {language === 'ar' ? 'الصيدلية: ' : 'Pharmacy: '}
                        <span className="font-bold">{prescription.dispensedPharmacyName || prescription.targetPharmacyName}</span>
                        {prescription.dispensedByName && ` (الصيدلاني: ${prescription.dispensedByName})`}
                      </div>
                      <div className="text-[11px] text-emerald-700 font-mono mt-0.5">
                        {language === 'ar' ? 'الوقت: ' : 'Timestamp: '}
                        {prescription.dispensedAt ? new Date(prescription.dispensedAt).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US') : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-center font-bold text-emerald-800 text-[10px] uppercase border border-emerald-300 rounded-lg p-2 bg-white">
                    {language === 'ar' ? 'صرف رقمي مؤكد' : 'SECURE DISPENSED'}
                  </div>
                </div>
              )}

              {/* Document Signatures and Verification Footer */}
              <div className="mt-8 pt-6 border-t-2 border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 p-1 rounded-lg border border-slate-300 flex items-center justify-center bg-slate-50 text-slate-800">
                    <QrCode size={48} />
                  </div>
                  <div className="text-[10px] text-slate-500">
                    <div className="font-mono font-bold text-slate-700">{prescription.prescriptionNumber}</div>
                    <div>{language === 'ar' ? 'رمز التحقق الرقمي لمنصة M737' : 'M737 Digital Cryptographic Seal'}</div>
                    <div>{language === 'ar' ? 'لا يجوز الصرف المتكرر أو التلاعب' : 'Single dispensation only. Tamper evident.'}</div>
                  </div>
                </div>

                <div className="text-center sm:text-end space-y-1">
                  <div className="font-bold text-slate-900">{prescription.doctorName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {prescription.doctorLicense || 'Verified Iraqi Doctor'}
                  </div>
                  <div className="text-[10px] text-slate-400 italic">
                    {language === 'ar' ? 'التوقيع الإلكتروني المعتمد' : 'Certified Digital Signature'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
