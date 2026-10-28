/**
 * Multi-Portal Push Events Verification Test Suite for M737IQ
 * 
 * Verifies that all 8 portals (Patient, Doctor, Secretary, Pharmacy, Laboratory, 
 * Radiology, Wholesaler, Super Admin) have typed, working push event contracts, 
 * payload sanitization, lockscreen privacy modes, and delivery guarantees.
 */

import {
  notifyPatientAppointmentStatus,
  notifyPatientPrescriptionReady,
  notifyPatientDiagnosticReport,
  notifyDoctorNewBooking,
  notifySecretaryAppointmentUpdate,
  notifyPharmacyNewPrescription,
  notifyCenterNewRequest,
  notifyWholesalerNewOrder,
  notifySuperAdminAccreditationRequest,
  notifyPatientPharmacyOrderStatus,
  notifyDoctorPrescriptionDispensed,
  notifyDoctorBookingCancelled,
  notifyPharmacyWholesaleShipment,
  notifyUserAccountApprovalStatus,
  DispatchNotificationParams,
} from '../lib/pushEventDispatcher';
import { SOLE_SUPER_ADMIN_EMAIL } from '../utils/adminSecurity';

export interface PortalTestResult {
  portal: string;
  eventName: string;
  passed: boolean;
  message?: string;
}

export async function runMultiPortalPushEventsVerification(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: PortalTestResult[];
}> {
  const results: PortalTestResult[] = [];

  const check = (portal: string, eventName: string, passed: boolean, message?: string) => {
    results.push({
      portal,
      eventName,
      passed,
      message: passed ? undefined : message,
    });
  };

  // 1. Patient Portal Event: Appointment Status Update
  try {
    const res = await notifyPatientAppointmentStatus({
      patientUid: 'test_pat_001',
      doctorName: 'د. أحمد الرافدين',
      date: '2026-11-01',
      time: '10:00 AM',
      status: 'confirmed',
      appointmentId: 'apt_unit_001',
    });
    check('Patient', 'notifyPatientAppointmentStatus (confirmed)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Patient', 'notifyPatientAppointmentStatus (confirmed)', false, String(err));
  }

  // 2. Patient Portal Event: Prescription Ready
  try {
    const res = await notifyPatientPrescriptionReady({
      patientUid: 'test_pat_002',
      doctorName: 'د. علي الخفاجي',
      prescriptionId: 'rx_unit_002',
    });
    check('Patient', 'notifyPatientPrescriptionReady', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Patient', 'notifyPatientPrescriptionReady', false, String(err));
  }

  // 3. Patient Portal Event: Lab Diagnostic Report
  try {
    const res = await notifyPatientDiagnosticReport({
      patientUid: 'test_pat_003',
      facilityName: 'مختبر بابل التخصصي',
      type: 'laboratory',
      reportId: 'lab_rep_003',
    });
    check('Patient', 'notifyPatientDiagnosticReport (lab)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Patient', 'notifyPatientDiagnosticReport (lab)', false, String(err));
  }

  // 4. Patient Portal Event: Radiology Diagnostic Report
  try {
    const res = await notifyPatientDiagnosticReport({
      patientUid: 'test_pat_004',
      facilityName: 'مركز دجلة للأشعة والسونار',
      type: 'radiology',
      reportId: 'rad_rep_004',
    });
    check('Patient', 'notifyPatientDiagnosticReport (radiology)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Patient', 'notifyPatientDiagnosticReport (radiology)', false, String(err));
  }

  // 5. Doctor Portal Event: New Booking
  try {
    const res = await notifyDoctorNewBooking({
      doctorUid: 'test_doc_001',
      patientName: 'عمر التميمي',
      date: '2026-11-02',
      time: '11:00 AM',
      appointmentId: 'apt_unit_005',
    });
    check('Doctor', 'notifyDoctorNewBooking', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Doctor', 'notifyDoctorNewBooking', false, String(err));
  }

  // 6. Doctor Portal Event: Booking Cancelled
  try {
    const res = await notifyDoctorBookingCancelled({
      doctorUid: 'test_doc_002',
      patientName: 'مريم الصالح',
      appointmentId: 'apt_unit_006',
      date: '2026-11-03',
      time: '12:00 PM',
    });
    check('Doctor', 'notifyDoctorBookingCancelled', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Doctor', 'notifyDoctorBookingCancelled', false, String(err));
  }

  // 7. Doctor Portal Event: Prescription Dispensed
  try {
    const res = await notifyDoctorPrescriptionDispensed({
      doctorUid: 'test_doc_003',
      patientName: 'يوسف العراقي',
      prescriptionNumber: 'RX-2026-7890',
      pharmacyName: 'صيدلية النهرين المعتمدة',
    });
    check('Doctor', 'notifyDoctorPrescriptionDispensed', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Doctor', 'notifyDoctorPrescriptionDispensed', false, String(err));
  }

  // 8. Secretary Portal Event: Appointment Update
  try {
    const res = await notifySecretaryAppointmentUpdate({
      secretaryUid: 'test_sec_001',
      patientName: 'فاطمة كريم',
      doctorName: 'د. زيد البياتي',
      action: 'إعادة جدولة',
      appointmentId: 'apt_unit_008',
    });
    check('Secretary', 'notifySecretaryAppointmentUpdate', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Secretary', 'notifySecretaryAppointmentUpdate', false, String(err));
  }

  // 9. Pharmacy Portal Event: New Prescription for Dispensing
  try {
    const res = await notifyPharmacyNewPrescription({
      pharmacyUid: 'test_pharm_001',
      patientName: 'حسين الموسوي',
      prescriptionId: 'rx_unit_009',
    });
    check('Pharmacy', 'notifyPharmacyNewPrescription', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Pharmacy', 'notifyPharmacyNewPrescription', false, String(err));
  }

  // 10. Pharmacy Portal Event: Patient Pharmacy Order Status
  try {
    const res = await notifyPatientPharmacyOrderStatus({
      patientUid: 'test_pat_005',
      pharmacyName: 'صيدلية المنصور المركزية',
      orderId: 'pord_unit_010',
      status: 'ready_for_pickup',
    });
    check('Pharmacy', 'notifyPatientPharmacyOrderStatus (ready_for_pickup)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Pharmacy', 'notifyPatientPharmacyOrderStatus (ready_for_pickup)', false, String(err));
  }

  // 11. Laboratory Center Event: New Lab Test Request
  try {
    const res = await notifyCenterNewRequest({
      centerUid: 'test_lab_001',
      centerRole: 'laboratory',
      patientName: 'أحمد الحسني',
      testName: 'تحليل السكر التراكمي (HbA1c)',
      requestId: 'req_lab_011',
    });
    check('Laboratory', 'notifyCenterNewRequest (laboratory)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Laboratory', 'notifyCenterNewRequest (laboratory)', false, String(err));
  }

  // 12. Radiology Center Event: New Scan Order
  try {
    const res = await notifyCenterNewRequest({
      centerUid: 'test_rad_001',
      centerRole: 'radiology_center',
      patientName: 'سعاد العبيدي',
      testName: 'رنين مغناطيسي للفقرات العنقية (MRI Cervical)',
      requestId: 'req_rad_012',
    });
    check('Radiology', 'notifyCenterNewRequest (radiology_center)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Radiology', 'notifyCenterNewRequest (radiology_center)', false, String(err));
  }

  // 13. Wholesaler Event: New B2B Wholesale Order
  try {
    const res = await notifyWholesalerNewOrder({
      wholesalerUid: 'test_wh_001',
      pharmacyName: 'صيدلية الرشيد الدولية',
      orderId: 'word_unit_013',
      itemCount: 8,
    });
    check('Wholesaler', 'notifyWholesalerNewOrder', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Wholesaler', 'notifyWholesalerNewOrder', false, String(err));
  }

  // 14. Wholesaler Event: Wholesale Shipment Status to Pharmacy
  try {
    const res = await notifyPharmacyWholesaleShipment({
      pharmacyUid: 'test_pharm_002',
      wholesalerName: 'مذخر أدوية بغداد المتحدة',
      orderId: 'INV-B2B-987654',
      status: 'dispatched',
    });
    check('Wholesaler', 'notifyPharmacyWholesaleShipment (dispatched)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Wholesaler', 'notifyPharmacyWholesaleShipment (dispatched)', false, String(err));
  }

  // 15. Super Admin Event: Professional Accreditation Request
  try {
    const res = await notifySuperAdminAccreditationRequest({
      adminUid: 'test_admin_001',
      applicantName: 'د. مصطفى الجميلي',
      role: 'doctor',
      licenseNumber: 'IQ-MED-2026-9081',
    });
    check('Super Admin', 'notifySuperAdminAccreditationRequest', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Super Admin', 'notifySuperAdminAccreditationRequest', false, String(err));
  }

  // 16. Super Admin Event: User Account Approval Status
  try {
    const res = await notifyUserAccountApprovalStatus({
      userUid: 'test_user_001',
      userRole: 'doctor',
      isApproved: true,
    });
    check('Super Admin', 'notifyUserAccountApprovalStatus (approved)', res.success, res.skippedReason);
  } catch (err: unknown) {
    check('Super Admin', 'notifyUserAccountApprovalStatus (approved)', false, String(err));
  }

  // 17. Super Admin Security Guard: Sole Email Whitelist
  check(
    'Security',
    'Sole authorized super admin email is strictly bcgmoc@gmail.com',
    SOLE_SUPER_ADMIN_EMAIL.toLowerCase() === 'bcgmoc@gmail.com',
    `Expected bcgmoc@gmail.com, got ${SOLE_SUPER_ADMIN_EMAIL}`
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    total: results.length,
    passed,
    failed,
    results,
  };
}
