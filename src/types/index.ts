export type Language = 'ar' | 'en';

export type UserRole =
  | 'doctor'
  | 'radiology_center'
  | 'laboratory'
  | 'pharmacy'
  | 'wholesaler'
  | 'patient'
  | 'super_admin'
  | 'secretary';

export type AccountStatus =
  | 'incomplete'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'suspended';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: AccountStatus;
  licenseNumber?: string;
  facilityName?: string;
  governorate?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export type PortalId = 
  | 'patient'
  | 'doctor'
  | 'pharmacy'
  | 'laboratory'
  | 'radiology'
  | 'wholesaler'
  | 'secretary'
  | 'super_admin';

export interface PortalInfo {
  id: PortalId;
  role: UserRole;
  order: number;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  descAr: string;
  descEn: string;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  iconName: 'doctor' | 'radiology' | 'laboratory' | 'pharmacy' | 'wholesaler' | 'patient' | 'super_admin' | 'secretary';
  plannedModulesAr: string[];
  plannedModulesEn: string[];
}

export type AppointmentStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'rescheduled' 
  | 'completed' 
  | 'cancelled';

export interface DoctorProfile {
  doctorId: string;
  fullName: string;
  photoURL?: string;
  specialty: string;
  subspecialty?: string;
  qualifications: string;
  experienceYears?: number;
  clinicAddress: string;
  governorate: string;
  phone: string;
  whatsapp?: string;
  consultationFee: number;
  workingDays: string[];
  workingHours: string;
  mapsUrl?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  specialty: string;
  date: string;
  timeSlot: string;
  status: AppointmentStatus;
  rescheduleReason?: string;
  rescheduleProposedDate?: string;
  consultationType?: 'in_person' | 'followup' | 'urgent';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MedicalRecordType = 
  | 'lab_result' 
  | 'radiology_report' 
  | 'prescription' 
  | 'clinical_note' 
  | 'diagnostic_summary';

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  recordType: MedicalRecordType;
  title: string;
  details: string;
  sourceFacility?: string;
  fileUrl?: string;
  doctorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// BATCH 2: ELECTRONIC PRESCRIPTIONS, LAB & RADIOLOGY REFERRALS
// -------------------------------------------------------------

export type PrescriptionStatus = 
  | 'draft' 
  | 'sent' 
  | 'received' 
  | 'accepted' 
  | 'rejected' 
  | 'dispensing' 
  | 'dispensed' 
  | 'cancelled';

export interface PrescriptionMedicineItem {
  medicineId?: string;
  name?: string;
  medicineName?: string;
  activeIngredient?: string;
  strength: string;
  dosageForm: string;
  packageSize?: string;
  dosage: string; // e.g. "حبة واحدة" / "1 tablet"
  frequency: string; // e.g. "مرتين يومياً بعد الطعام" / "Twice daily after meals"
  duration: string; // e.g. "5 أيام" / "5 days"
  quantity?: number | string; // e.g. 1 or "علبة واحدة"
  instructions?: string; // e.g. "مع كوب ماء كامل"
  warnings?: string; // e.g. "يمنع القيادة بعد الاستخدام"
}

export interface ElectronicPrescription {
  id: string;
  prescriptionNumber: string; // RX-YYYYMMDD-XXXX
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorLicense?: string;
  doctorLicenseNumber?: string;
  doctorPhone?: string;
  clinicName?: string;
  clinicAddress?: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  patientGender?: 'male' | 'female';
  patientAgeOrDob?: string;
  patientAge?: number | string;
  appointmentId?: string;
  diagnosis?: string;
  targetPharmacyId?: string;
  targetPharmacyName?: string;
  items: PrescriptionMedicineItem[];
  medicines?: PrescriptionMedicineItem[];
  patientAllergies?: string[];
  generalInstructions?: string;
  doctorNotes?: string;
  status: PrescriptionStatus;
  rejectionReason?: string;
  cancellationReason?: string;
  // Dispensing metadata
  dispensedAt?: string;
  dispensedByUid?: string;
  dispensedByName?: string;
  dispensedPharmacyId?: string;
  dispensedPharmacyName?: string;
  dispensingNotes?: string;
  // Authorized clinical corrections history
  corrections?: Array<{
    correctedAt: string;
    correctedBy: string;
    reason: string;
    previousItemsSnapshot: PrescriptionMedicineItem[];
  }>;
  createdAt: string;
  updatedAt: string;
}

export type LabOrderStatus = 
  | 'new' 
  | 'received' 
  | 'scheduled'
  | 'in_progress' 
  | 'completed' 
  | 'rejected' 
  | 'cancelled';

export interface LabOrderItem {
  testId?: string;
  testName: string;
  category?: string;
  instructions?: string;
  sampleType?: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string; // LAB-ORD-XXXX
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorPhone?: string;
  clinicName?: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  targetLabId?: string;
  targetLabName?: string;
  tests: LabOrderItem[];
  priority: 'normal' | 'urgent';
  clinicalIndication?: string;
  preparationInstructions?: string;
  fastingInstructions?: string;
  status: LabOrderStatus;
  scheduledDate?: string;
  scheduledAt?: string;
  rejectionReason?: string;
  resultId?: string;
  resultSummary?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RadiologyOrderStatus = 
  | 'new' 
  | 'received' 
  | 'scheduled'
  | 'in_progress' 
  | 'completed' 
  | 'rejected' 
  | 'cancelled';

export interface RadiologyOrder {
  id: string;
  orderNumber: string; // RAD-ORD-XXXX
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  doctorPhone?: string;
  clinicName?: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  targetCenterId?: string;
  targetCenterName?: string;
  modality: RadiologyModality;
  bodyRegion: string; // e.g. "Chest", "Brain", "Abdomen", "Knee"
  bodyPart?: string;
  procedureName?: string;
  priority: 'normal' | 'urgent';
  clinicalIndication: string;
  preparationInstructions?: string;
  status: RadiologyOrderStatus;
  scheduledDate?: string;
  scheduledAt?: string;
  rejectionReason?: string;
  reportId?: string;
  reportSummary?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretaryDelegation {
  id: string;
  doctorId: string;
  doctorName: string;
  secretaryEmail: string;
  secretaryName: string;
  secretaryUid?: string;
  secretaryPhone?: string;
  permissions: string[];
  status: 'active' | 'revoked' | 'pending';
  acceptedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecretaryAssignment {
  id: string; // secretaryUid
  secretaryUid: string;
  secretaryEmail: string;
  secretaryName: string;
  secretaryPhone?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  permissions: string[];
  status: 'active' | 'revoked';
  delegationId?: string;
  assignedAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export interface ClinicAuditLog {
  id: string;
  doctorId: string;
  doctorName: string;
  actorUid: string;
  actorName: string;
  actorRole: 'secretary' | 'doctor' | 'admin';
  action: 'confirm_appointment' | 'reject_appointment' | 'reschedule_appointment' | 'cancel_appointment' | 'create_walkin' | 'checkin_patient' | 'complete_appointment';
  appointmentId?: string;
  patientName?: string;
  details: string;
  timestamp: string;
}

export type RadiologyModality = 
  | 'ultrasound' 
  | 'xray' 
  | 'ct' 
  | 'mri' 
  | 'doppler' 
  | 'mammogram';

export type RadiologyBookingStatus = 
  | 'pending' 
  | 'accepted' 
  | 'rescheduled' 
  | 'rejected' 
  | 'completed' 
  | 'cancelled';

export interface RadiologyProfile {
  centerId: string;
  centerName: string;
  logoUrl?: string;
  directorName?: string;
  licenseNumber: string;
  address: string;
  governorate: string;
  phone: string;
  whatsapp?: string;
  workingHours: string;
  equipmentList: string[];
  mapsUrl?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyService {
  id: string;
  centerId: string;
  name: string;
  modality: RadiologyModality;
  price: number;
  preparationInstructions?: string;
  estimatedReportHours: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyBooking {
  id: string;
  centerId: string;
  centerName: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  serviceId: string;
  serviceName: string;
  modality: RadiologyModality;
  date: string;
  timeSlot: string;
  status: RadiologyBookingStatus;
  rescheduleDate?: string;
  rescheduleReason?: string;
  cancellationReason?: string;
  notes?: string;
  reportReady?: boolean;
  reportId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RadiologyReport {
  id: string;
  centerId: string;
  centerName: string;
  patientId: string;
  patientName: string;
  patientPhone?: string;
  bookingId?: string;
  serviceName: string;
  modality: RadiologyModality;
  bodyPart?: string;
  clinicalIndication?: string;
  technique?: string;
  findings: string;
  impression: string;
  recommendations?: string;
  radiologistName: string;
  radiologistLicense?: string;
  fileUrl?: string;
  reportUrl?: string;
  scanImages?: string[];
  dicomFiles?: Array<{
    id: string;
    name: string;
    size: number;
    sizeFormatted: string;
    modality: string;
    storagePath: string;
    downloadUrl: string;
    mimeType: string;
    uploadedAt: string;
    uploadedBy: string;
    patientName?: string;
    bookingId?: string;
    isDicom: boolean;
  }>;
  reviewStatus?: string;
  status: 'draft' | 'published' | 'ready';
  createdAt: string;
  updatedAt: string;
}

export interface PatientNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'booking_update' | 'report_ready' | 'general';
  read: boolean;
  createdAt: string;
}

export type LabSampleStatus = 
  | 'pending_collection' 
  | 'collected' 
  | 'received' 
  | 'processing' 
  | 'completed' 
  | 'cancelled';

export type LabBookingStatus = 
  | 'pending' 
  | 'accepted' 
  | 'rescheduled' 
  | 'rejected' 
  | 'completed' 
  | 'cancelled';

export interface LabProfile {
  labId: string;
  labName: string;
  logoUrl?: string;
  directorName: string;
  licenseNumber: string;
  phone: string;
  whatsapp?: string;
  address: string;
  governorate: string;
  mapsUrl?: string;
  workingHours: string;
  equipmentList: string[];
  homeCollectionAvailable: boolean;
  homeCollectionFee?: number;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabTest {
  id: string;
  labId: string;
  labName?: string;
  name: string;
  category: string;
  price: number;
  estimatedHours: number;
  turnaroundHours?: number;
  sampleType: string;
  fastingInstructions: string;
  fastingRequired?: boolean;
  preparationInstructions?: string;
  normalRange?: string;
  isAvailable: boolean;
  homeCollectionSupported: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LabBooking {
  id: string;
  labId: string;
  labName: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  testId: string;
  testName: string;
  category: string;
  date: string;
  timeSlot: string;
  bookingType: 'in_lab' | 'home_collection';
  homeAddress?: string;
  status: LabBookingStatus;
  sampleStatus: LabSampleStatus;
  sampleBarcode?: string;
  rescheduleDate?: string;
  rescheduleReason?: string;
  cancellationReason?: string;
  notes?: string;
  resultReady?: boolean;
  resultId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabResultParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'high' | 'low' | 'abnormal';
}

export interface LabResult {
  id: string;
  labId: string;
  labName: string;
  patientId: string;
  patientName: string;
  bookingId?: string;
  testName: string;
  category: string;
  sampleType: string;
  parameters: LabResultParameter[];
  notes?: string;
  pathologistName: string;
  pathologistLicense?: string;
  fileUrl?: string;
  attachedScans?: string[];
  reviewStatus: 'draft' | 'reviewed' | 'released';
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface PharmacyProfile {
  pharmacyId: string;
  pharmacyName: string;
  ownerName: string;
  licenseNumber: string;
  phone: string;
  whatsapp?: string;
  address: string;
  governorate: string;
  mapsUrl?: string;
  workingHours: string;
  logoUrl?: string;
  deliveryAvailable: boolean;
  deliveryFee?: number;
  nightDuty: boolean;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicineItem {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyPhone?: string;
  pharmacyGovernorate?: string;
  pharmacyAddress?: string;
  name: string;
  activeIngredient: string;
  brand: string;
  manufacturer: string;
  strength: string;
  dosageForm: string;
  packageSize: string;
  price: number;
  quantity: number;
  minStockAlert: number;
  expiryDate: string;
  benefits?: string;
  sideEffects?: string;
  requiresPrescription: boolean;
  isAvailable: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PharmacyOrderStatus = 
  | 'pending' 
  | 'accepted' 
  | 'preparing' 
  | 'ready_for_pickup' 
  | 'out_for_delivery' 
  | 'completed' 
  | 'cancelled';

export interface PharmacyOrderItem {
  medicineId: string;
  name: string;
  activeIngredient: string;
  strength: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface PharmacyOrder {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  items: PharmacyOrderItem[];
  totalAmount: number;
  orderType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  prescriptionUrl?: string;
  status: PharmacyOrderStatus;
  pharmacistNotes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientProfile {
  patientId: string;
  fullName: string;
  medicalId: string;
  email?: string;
  phone: string;
  governorate: string;
  address: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'Unknown';
  chronicDiseases?: string[];
  allergies?: string[];
  currentMedications?: string[];
  heightCm?: number;
  weightKg?: number;
  dateOfBirth?: string;
  gender?: 'male' | 'female';
  photoURL?: string;
  whatsapp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionPlan {
  id: string;
  nameAr: string;
  nameEn: string;
  targetRole: UserRole | 'all';
  priceIqd: number;
  billingPeriod: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  descriptionAr: string;
  descriptionEn: string;
  featuresAr: string[];
  featuresEn: string[];
  isPopular?: boolean;
  isActive: boolean;
  maxDoctors?: number;
  maxStaff?: number;
  updatedAt: string;
  updatedBy?: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: UserRole;
  facilityName?: string;
  planId: string;
  planName: string;
  customPriceIqd: number;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  startDate: string;
  endDate: string;
  notes?: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface WholesalerProfile {
  wholesalerId: string;
  warehouseName: string;
  ownerName: string;
  licenseNumber: string;
  commercialRegNumber?: string;
  phone: string;
  whatsapp?: string;
  address: string;
  governorate: string;
  deliveryCoverageGovernorates: string[];
  minimumOrderValueIqd?: number;
  workingHours: string;
  logoUrl?: string;
  bio?: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WholesaleMedicineItem {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  wholesalerPhone?: string;
  name: string;
  nameAr?: string;
  activeIngredient: string;
  manufacturer: string;
  originCountry: string;
  strength: string;
  dosageForm: string;
  packSize: string;
  cartonCapacity: number;
  batchNumber: string;
  productionDate: string;
  expiryDate: string;
  wholesalePriceIqd: number;
  wholesalePriceUsd?: number;
  cartonPriceIqd?: number;
  stockPacks: number;
  minOrderQuantity: number;
  isAvailable: boolean;
  category: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type WholesaleOrderStatus = 
  | 'pending' 
  | 'approved' 
  | 'preparing' 
  | 'dispatched' 
  | 'delivered' 
  | 'cancelled';

export interface WholesaleOrderItem {
  medicineId: string;
  name: string;
  activeIngredient: string;
  strength: string;
  batchNumber: string;
  packQuantity: number;
  unitWholesalePriceIqd: number;
  totalPriceIqd: number;
}

export interface WholesaleOrder {
  id: string;
  wholesalerId: string;
  wholesalerName: string;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyPhone: string;
  pharmacyAddress: string;
  pharmacyGovernorate: string;
  items: WholesaleOrderItem[];
  totalAmountIqd: number;
  status: WholesaleOrderStatus;
  paymentMethod: 'cash_on_delivery' | 'credit_terms' | 'bank_transfer';
  wholesalerNotes?: string;
  pharmacyNotes?: string;
  invoiceNumber?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}
