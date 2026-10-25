import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  DoctorProfile, 
  Appointment, 
  MedicalRecord, 
  SecretaryDelegation,
  AppointmentStatus,
  MedicalRecordType,
  ElectronicPrescription,
  PrescriptionMedicineItem,
  PrescriptionStatus,
  LabOrder,
  LabOrderItem,
  LabOrderStatus,
  RadiologyOrder,
  RadiologyOrderStatus,
  RadiologyModality
} from '../types';
import { SmartMedicineSearch, SearchMedicineResult } from './SmartMedicineSearch';
import { PrescriptionPdfModal } from './PrescriptionPdfModal';
import { logAuditEvent } from '../lib/auditLogger';
import { validateAndCompressImage, formatWhatsAppUrl } from '../utils/mediaUtils';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  FileText, 
  Users, 
  Settings, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  MapPin, 
  Phone, 
  DollarSign, 
  RefreshCw, 
  Search, 
  Filter, 
  Edit3, 
  ShieldCheck, 
  Share2, 
  ExternalLink,
  Save,
  Trash2,
  Activity,
  Check,
  ChevronRight,
  ChevronLeft,
  Pill,
  FlaskConical,
  Scan,
  Printer,
  Send,
  Eye,
  Layers,
  Lock,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface DoctorPortalWorkspaceProps {
  onBackToHome: () => void;
}

export const DoctorPortalWorkspace: React.FC<DoctorPortalWorkspaceProps> = ({ onBackToHome }) => {
  const { user, userProfile, isAdmin, isDemoMode, refreshProfile } = useAuth();
  const { language, isRTL } = useLanguage();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'appointments' | 'prescriptions' | 'referrals' | 'records' | 'schedule' | 'secretary'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Doctor Profile State
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  // Appointments State
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentFilter, setAppointmentFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
  const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);

  // New Appointment Form
  const [newApptData, setNewApptData] = useState({
    patientName: '',
    patientPhone: '',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '17:00',
    consultationType: 'in_person' as 'in_person' | 'followup' | 'urgent',
    notes: '',
  });

  // Reschedule Modal State
  const [reschedulingAppt, setReschedulingAppt] = useState<Appointment | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ newDate: '', reason: '' });

  // Medical Records State
  const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
  const [recordFilter, setRecordFilter] = useState<string>('all');
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [newRecordData, setNewRecordData] = useState({
    patientName: '',
    recordType: 'clinical_note' as MedicalRecordType,
    title: '',
    details: '',
    sourceFacility: '',
    doctorNotes: '',
  });

  // Electronic Prescriptions State
  const [prescriptions, setPrescriptions] = useState<ElectronicPrescription[]>([]);
  const [prescriptionFilter, setPrescriptionFilter] = useState<string>('all');
  const [showNewPrescriptionModal, setShowNewPrescriptionModal] = useState(false);
  const [selectedPrescriptionForPdf, setSelectedPrescriptionForPdf] = useState<ElectronicPrescription | null>(null);

  // New Prescription Form State
  const [newRxPatientId, setNewRxPatientId] = useState('');
  const [newRxPatientName, setNewRxPatientName] = useState('');
  const [newRxPatientPhone, setNewRxPatientPhone] = useState('');
  const [newRxDiagnosis, setNewRxDiagnosis] = useState('');
  const [newRxAllergies, setNewRxAllergies] = useState('');
  const [newRxGeneralInstructions, setNewRxGeneralInstructions] = useState('');
  const [newRxTargetPharmacyId, setNewRxTargetPharmacyId] = useState('');
  const [newRxTargetPharmacyName, setNewRxTargetPharmacyName] = useState('');
  const [newRxItems, setNewRxItems] = useState<PrescriptionMedicineItem[]>([]);
  const [currentDosage, setCurrentDosage] = useState('حبة واحدة (1 Tablet)');
  const [currentFrequency, setCurrentFrequency] = useState('مرتين يومياً بعد الطعام (Twice daily)');
  const [currentDuration, setCurrentDuration] = useState('5 أيام (5 Days)');
  const [currentInstructions, setCurrentInstructions] = useState('تؤخذ بعد وجبة الطعام مباشرة مع الماء');
  const [currentWarnings, setCurrentWarnings] = useState('');

  // Diagnostic Referrals State (Lab & Radiology Orders)
  const [labOrders, setLabOrders] = useState<LabOrder[]>([]);
  const [radiologyOrders, setRadiologyOrders] = useState<RadiologyOrder[]>([]);
  const [referralSubTab, setReferralSubTab] = useState<'lab' | 'radiology'>('lab');
  const [showNewLabOrderModal, setShowNewLabOrderModal] = useState(false);
  const [showNewRadOrderModal, setShowNewRadOrderModal] = useState(false);

  // New Lab Order Form
  const [newLabPatientName, setNewLabPatientName] = useState('');
  const [newLabPatientPhone, setNewLabPatientPhone] = useState('');
  const [newLabTargetLabId, setNewLabTargetLabId] = useState('');
  const [newLabTargetLabName, setNewLabTargetLabName] = useState('');
  const [newLabPriority, setNewLabPriority] = useState<'normal' | 'urgent'>('normal');
  const [newLabClinicalIndication, setNewLabClinicalIndication] = useState('');
  const [newLabPrepInstructions, setNewLabPrepInstructions] = useState('صيام 8 إلى 12 ساعة قبل الفحص');
  const [newLabTestsList, setNewLabTestsList] = useState<string[]>(['CBC (صورة دم كاملة)']);
  const [customTestInput, setCustomTestInput] = useState('');

  // New Radiology Order Form
  const [newRadPatientName, setNewRadPatientName] = useState('');
  const [newRadPatientPhone, setNewRadPatientPhone] = useState('');
  const [newRadTargetCenterId, setNewRadTargetCenterId] = useState('');
  const [newRadTargetCenterName, setNewRadTargetCenterName] = useState('');
  const [newRadModality, setNewRadModality] = useState<RadiologyModality>('ultrasound');
  const [newRadBodyRegion, setNewRadBodyRegion] = useState('البطن والحوض (Abdomen & Pelvis)');
  const [newRadPriority, setNewRadPriority] = useState<'normal' | 'urgent'>('normal');
  const [newRadClinicalIndication, setNewRadClinicalIndication] = useState('');
  const [newRadPrepInstructions, setNewRadPrepInstructions] = useState('شرب كمية وفيرة من الماء قبل الفحص');

  // Facilities lists
  const [facilitiesPharmacies, setFacilitiesPharmacies] = useState<Array<{ id: string; name: string; governorate: string; phone: string }>>([
    { id: 'demo_pharmacy_amal', name: 'صيدلية الأمل المركزية', governorate: 'بغداد (Baghdad)', phone: '07814455667' },
    { id: 'demo_pharmacy_dijla', name: 'صيدلية دجلة التخصصية', governorate: 'بغداد (Baghdad)', phone: '07701122334' },
    { id: 'demo_pharmacy_rafidain', name: 'صيدلية الرافدين الأهلية', governorate: 'البصرة (Basra)', phone: '07809988776' },
  ]);
  const [facilitiesLabs, setFacilitiesLabs] = useState<Array<{ id: string; name: string; governorate: string; phone: string }>>([
    { id: 'demo_lab_baghdad', name: 'مختبر بغداد المركزي التخصصي', governorate: 'بغداد (Baghdad)', phone: '07712233445' },
    { id: 'demo_lab_hayat', name: 'مختبر الحياة للتحليلات المرضية', governorate: 'النجف الأشرف (Najaf)', phone: '07812233445' },
  ]);
  const [facilitiesRadCenters, setFacilitiesRadCenters] = useState<Array<{ id: string; name: string; governorate: string; phone: string }>>([
    { id: 'demo_radiology_dijla', name: 'مركز دجلة للأشعة والمفراس والرنين', governorate: 'بغداد (Baghdad)', phone: '07723344556' },
    { id: 'demo_radiology_shifaa', name: 'مركز الشفاء التخصصي للتصوير الشعاعي', governorate: 'أربيل (Erbil)', phone: '07501122334' },
  ]);

  // Secretary Delegations State
  const [delegations, setDelegations] = useState<SecretaryDelegation[]>([]);
  const [showNewSecretaryModal, setShowNewSecretaryModal] = useState(false);
  const [newSecretaryData, setNewSecretaryData] = useState({
    secretaryEmail: '',
    secretaryName: '',
    canManageAppointments: true,
    canViewQueue: true,
    canCollectFees: false,
  });

  // Profile Form State for Settings Tab
  const [editProfileForm, setEditProfileForm] = useState({
    fullName: '',
    photoURL: '',
    specialty: '',
    subspecialty: '',
    qualifications: '',
    experienceYears: 10,
    clinicAddress: '',
    governorate: 'بغداد (Baghdad)',
    phone: '',
    whatsapp: '',
    consultationFee: 25000,
    workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
    workingHours: '4:00 PM - 9:00 PM',
    mapsUrl: '',
    bio: '',
  });

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

  const daysOfWeek = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

  // Load All Doctor Data from Firestore
  const loadDoctorData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Doctor Profile
      const profRef = doc(db, 'doctor_profiles', user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data() as DoctorProfile;
        setDoctorProfile(data);
        setEditProfileForm({
          fullName: data.fullName || userProfile?.displayName || '',
          photoURL: data.photoURL || '',
          specialty: data.specialty || 'أمراض باطنية وقلبية',
          subspecialty: data.subspecialty || '',
          qualifications: data.qualifications || 'بورد عراقي / عربي',
          experienceYears: data.experienceYears || 10,
          clinicAddress: data.clinicAddress || userProfile?.facilityName || '',
          governorate: data.governorate || userProfile?.governorate || 'بغداد (Baghdad)',
          phone: data.phone || userProfile?.phone || '',
          whatsapp: data.whatsapp || userProfile?.phone || '',
          consultationFee: data.consultationFee || 25000,
          workingDays: data.workingDays || ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
          workingHours: data.workingHours || '4:00 PM - 9:00 PM',
          mapsUrl: data.mapsUrl || '',
          bio: data.bio || '',
        });
      } else {
        // Initialize default doctor profile
        const initialProfile: DoctorProfile = {
          doctorId: user.uid,
          fullName: userProfile?.displayName || user.displayName || 'الدكتور المعالج',
          specialty: 'أمراض باطنية وقلبية',
          qualifications: 'بورد عراقي في الطب الباطني',
          experienceYears: 10,
          clinicAddress: userProfile?.facilityName || 'شارع الكندي، الحارثية',
          governorate: userProfile?.governorate || 'بغداد (Baghdad)',
          phone: userProfile?.phone || '07XXXXXXXXX',
          whatsapp: userProfile?.phone || '07XXXXXXXXX',
          consultationFee: 25000,
          workingDays: ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء'],
          workingHours: '4:00 PM - 9:00 PM',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await setDoc(profRef, initialProfile);
        setDoctorProfile(initialProfile);
      }

      // 2. Fetch Appointments for this Doctor
      const apptQuery = query(
        collection(db, 'appointments'),
        where('doctorId', '==', user.uid)
      );
      const apptSnap = await getDocs(apptQuery);
      const apptList = apptSnap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment));
      // Sort newest first
      apptList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      if (isDemoMode && apptList.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        const sampleAppts: Appointment[] = [
          {
            id: 'demo_appt_1',
            doctorId: user.uid,
            doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
            specialty: doctorProfile?.specialty || 'أمراض باطنية وقلبية',
            patientId: 'demo_patient_sara',
            patientName: 'سارة حيدر العراقي',
            patientPhone: '07705566778',
            date: today,
            timeSlot: '17:30',
            consultationType: 'in_person',
            status: 'confirmed',
            notes: 'مراجعة قياس ضغط الدم وتخطيط القلب',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'demo_appt_2',
            doctorId: user.uid,
            doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
            specialty: doctorProfile?.specialty || 'أمراض باطنية وقلبية',
            patientId: 'demo_patient_karrar',
            patientName: 'كرار جاسم الشمري',
            patientPhone: '07802233445',
            date: today,
            timeSlot: '18:15',
            consultationType: 'in_person',
            status: 'pending',
            notes: 'ألم في الصدر وصعوبة تنفس عند الإجهاد',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'demo_appt_3',
            doctorId: user.uid,
            doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
            specialty: doctorProfile?.specialty || 'أمراض باطنية وقلبية',
            patientId: 'demo_patient_zeinab',
            patientName: 'زينب محمد الكاظمي',
            patientPhone: '07718899001',
            date: today,
            timeSlot: '19:00',
            consultationType: 'followup',
            status: 'completed',
            notes: 'متابعة نتائج فحص الدهون وتحليل السكر التراكمي',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        setAppointments(sampleAppts);
      } else {
        setAppointments(apptList);
      }

      // 3. Fetch Medical Records for this Doctor
      const recordsQuery = query(
        collection(db, 'medical_records'),
        where('doctorId', '==', user.uid)
      );
      const recordsSnap = await getDocs(recordsQuery);
      const recList = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MedicalRecord));
      recList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (isDemoMode && recList.length === 0) {
        const sampleRecords: MedicalRecord[] = [
          {
            id: 'demo_rec_1',
            patientId: 'demo_patient_sara',
            patientName: 'سارة حيدر العراقي',
            doctorId: user.uid,
            recordType: 'prescription',
            title: 'وصفة علاج ارتفاع ضغط الدم والدهون',
            details: 'Amlodipine 5mg حبة يومياً صباحاً + Atorvastatin 20mg حبة مساءً مع الحمية الغذائية وتقليل الملح',
            sourceFacility: 'عيادة الرافدين الاستشارية',
            doctorNotes: 'مراجعة بعد شهر مع إعادة فحص وظائف الكلى',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'demo_rec_2',
            patientId: 'demo_patient_karrar',
            patientName: 'كرار جاسم الشمري',
            doctorId: user.uid,
            recordType: 'clinical_note',
            title: 'تقرير الفحص السريري وتخطيط القلب (ECG)',
            details: 'تخطيط قلب طبيعي (Sinus Rhythm). تم توجيه المريض لإجراء فحص إيكو القلب (Echocardiography) وصورة دم كاملة',
            sourceFacility: 'عيادة الرافدين الاستشارية',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];
        setMedicalRecords(sampleRecords);
      } else {
        setMedicalRecords(recList);
      }

      // 4. Fetch Secretary Delegations
      const delegQuery = query(
        collection(db, 'secretary_delegations'),
        where('doctorId', '==', user.uid)
      );
      const delegSnap = await getDocs(delegQuery);
      const delegList = delegSnap.docs.map(d => ({ id: d.id, ...d.data() } as SecretaryDelegation));
      setDelegations(delegList);

      // 5. Fetch Electronic Prescriptions
      try {
        const rxQuery = query(
          collection(db, 'electronic_prescriptions'),
          where('doctorId', '==', user.uid)
        );
        const rxSnap = await getDocs(rxQuery);
        const rxList = rxSnap.docs.map(d => ({ id: d.id, ...d.data() } as ElectronicPrescription));
        rxList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isDemoMode && rxList.length === 0) {
          const sampleRx: ElectronicPrescription[] = [
            {
              id: 'demo_rx_1',
              prescriptionNumber: 'RX-2026-4891',
              doctorId: user.uid,
              doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
              doctorSpecialty: 'استشاري أمراض باطنية وقلبية',
              doctorLicense: 'IQ-MED-94812',
              doctorPhone: '07801122334',
              clinicName: 'عيادة الرافدين الاستشارية',
              patientId: 'demo_patient_sara',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07705566778',
              diagnosis: 'ارتفاع ضغط الدم الشرياني الخفيف إلى المتوسط (Stage 1 Hypertension)',
              targetPharmacyId: 'demo_pharmacy_amal',
              targetPharmacyName: 'صيدلية الأمل المركزية',
              patientAllergies: ['البنسلين (Penicillin Allergy)'],
              generalInstructions: 'الالتزام بحمية قليلة الملح، قياس ضغط الدم يومياً في الصباح، وتجنب الإجهاد النفسي.',
              status: 'dispensed',
              items: [
                {
                  name: 'Concor (كونكور)',
                  activeIngredient: 'Bisoprolol Fumarate',
                  strength: '5 mg',
                  dosageForm: 'Tablets (أقراص)',
                  dosage: 'حبة واحدة',
                  frequency: 'مرة واحدة يومياً صباحاً قبل الإفطار',
                  duration: '30 يوماً',
                  instructions: 'مع نصف كوب ماء',
                },
                {
                  name: 'Panadol Extra (بنادول إكسترا)',
                  activeIngredient: 'Paracetamol + Caffeine',
                  strength: '500mg / 65mg',
                  dosageForm: 'Tablets (أقراص)',
                  dosage: 'قرص واحد',
                  frequency: 'عند الصداع الشديد فقط (بحد أقصى مرتين باليوم)',
                  duration: 'عند اللزوم',
                  warnings: 'تجنب تناوله مع المشروبات الغنية بالكافيين',
                }
              ],
              dispensedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
              dispensedByUid: 'demo_pharmacy_amal',
              dispensedByName: 'ص. علاء الكرخي (صيدلية الأمل)',
              dispensedPharmacyId: 'demo_pharmacy_amal',
              dispensedPharmacyName: 'صيدلية الأمل المركزية',
              createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
              updatedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            },
            {
              id: 'demo_rx_2',
              prescriptionNumber: 'RX-2026-7712',
              doctorId: user.uid,
              doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
              doctorSpecialty: 'استشاري أمراض باطنية وقلبية',
              doctorLicense: 'IQ-MED-94812',
              doctorPhone: '07801122334',
              clinicName: 'عيادة الرافدين الاستشارية',
              patientId: 'demo_patient_karrar',
              patientName: 'كرار جاسم الشمري',
              patientPhone: '07802233445',
              diagnosis: 'حموضة وارتجاع مريئي مع تهيج بالمعدة (GERD)',
              targetPharmacyId: 'demo_pharmacy_amal',
              targetPharmacyName: 'صيدلية الأمل المركزية',
              patientAllergies: [],
              generalInstructions: 'تجنب الأطعمة الدسمة والمسبكة والقهوة قبل النوم بساعتين.',
              status: 'sent',
              items: [
                {
                  name: 'Nexium (نيكسيوم)',
                  activeIngredient: 'Esomeprazole Magnesium',
                  strength: '40 mg',
                  dosageForm: 'Tablets (أقراص معوية)',
                  dosage: 'حبة واحدة',
                  frequency: 'مرة واحدة يومياً قبل وجبة الإفطار بنصف ساعة',
                  duration: '14 يوماً',
                  instructions: 'تبلع الحبة كاملة دون مضغ أو سحق',
                }
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          ];
          setPrescriptions(sampleRx);
        } else {
          setPrescriptions(rxList);
        }
      } catch {
        // Fallback for offline/rules
      }

      // 6. Fetch Lab Orders
      try {
        const labQ = query(
          collection(db, 'lab_orders'),
          where('doctorId', '==', user.uid)
        );
        const labSnap = await getDocs(labQ);
        const labList = labSnap.docs.map(d => ({ id: d.id, ...d.data() } as LabOrder));
        labList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isDemoMode && labList.length === 0) {
          const sampleLabOrders: LabOrder[] = [
            {
              id: 'demo_lab_ord_1',
              orderNumber: 'LAB-ORD-9021',
              doctorId: user.uid,
              doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
              doctorSpecialty: 'استشاري أمراض باطنية وقلبية',
              doctorPhone: '07801122334',
              clinicName: 'عيادة الرافدين الاستشارية',
              patientId: 'demo_patient_sara',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07705566778',
              targetLabId: 'demo_lab_baghdad',
              targetLabName: 'مختبر بغداد المركزي التخصصي',
              priority: 'normal',
              clinicalIndication: 'فحص روتيني لمتابعة دهون الدم ووظائف الكلى',
              preparationInstructions: 'صيام 12 ساعة قبل سحب العينة صباحاً',
              status: 'completed',
              resultId: 'demo_res_1',
              resultSummary: 'نتائج طبيعية، نسبة الكولسترول 185 mg/dL وسكر الصائم 92 mg/dL',
              completedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
              tests: [
                { testName: 'Lipid Profile (تحليل الدهون الشامل)' },
                { testName: 'Fasting Blood Sugar (سكر الصيام FBS)' },
                { testName: 'Serum Creatinine (وظائف الكلى - كرياتينين)' },
              ],
              createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
              updatedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
            },
            {
              id: 'demo_lab_ord_2',
              orderNumber: 'LAB-ORD-9045',
              doctorId: user.uid,
              doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
              doctorSpecialty: 'استشاري أمراض باطنية وقلبية',
              doctorPhone: '07801122334',
              clinicName: 'عيادة الرافدين الاستشارية',
              patientId: 'demo_patient_karrar',
              patientName: 'كرار جاسم الشمري',
              patientPhone: '07802233445',
              targetLabId: 'demo_lab_baghdad',
              targetLabName: 'مختبر بغداد المركزي التخصصي',
              priority: 'urgent',
              clinicalIndication: 'اشتباه بفقر دم أو نقص حديد حاد مع إجهاد مستمر',
              preparationInstructions: 'لا يشترط الصيام المسبق',
              status: 'in_progress',
              tests: [
                { testName: 'Complete Blood Count (CBC - صورة دم كاملة)' },
                { testName: 'Serum Ferritin (مخزون الحديد)' },
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          ];
          setLabOrders(sampleLabOrders);
        } else {
          setLabOrders(labList);
        }
      } catch {
        // Fallback
      }

      // 7. Fetch Radiology Orders
      try {
        const radQ = query(
          collection(db, 'radiology_orders'),
          where('doctorId', '==', user.uid)
        );
        const radSnap = await getDocs(radQ);
        const radList = radSnap.docs.map(d => ({ id: d.id, ...d.data() } as RadiologyOrder));
        radList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (isDemoMode && radList.length === 0) {
          const sampleRadOrders: RadiologyOrder[] = [
            {
              id: 'demo_rad_ord_1',
              orderNumber: 'RAD-ORD-6621',
              doctorId: user.uid,
              doctorName: userProfile?.displayName || 'د. أحمد الرافدين',
              doctorSpecialty: 'استشاري أمراض باطنية وقلبية',
              doctorPhone: '07801122334',
              clinicName: 'عيادة الرافدين الاستشارية',
              patientId: 'demo_patient_sara',
              patientName: 'سارة حيدر العراقي',
              patientPhone: '07705566778',
              targetCenterId: 'demo_radiology_dijla',
              targetCenterName: 'مركز دجلة للأشعة والمفراس والرنين',
              modality: 'ultrasound',
              bodyRegion: 'البطن والحوض (Abdomen & Pelvis)',
              priority: 'normal',
              clinicalIndication: 'فحص بالموجات فوق الصوتية للكبد والمرارة والكليتين',
              preparationInstructions: 'شرب 4 أكواب ماء والامتناع عن التبول قبل الفحص بساعة',
              status: 'completed',
              reportId: 'demo_rad_rep_1',
              reportSummary: 'الكبد والكليتان والمرارة ضمن المظهر الطبيعي، لا توجد حصوات أو تضخم',
              completedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
              createdAt: new Date(Date.now() - 3600000 * 36).toISOString(),
              updatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
            }
          ];
          setRadiologyOrders(sampleRadOrders);
        } else {
          setRadiologyOrders(radList);
        }
      } catch {
        // Fallback
      }

      // 8. Fetch Registered Accredited Facilities from Firestore
      try {
        const pharmaSnap = await getDocs(collection(db, 'pharmacy_profiles'));
        if (!pharmaSnap.empty) {
          const livePharmacies = pharmaSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              name: data.pharmacyName || 'صيدلية معتمدة',
              governorate: data.governorate || 'العراق',
              phone: data.phone || '',
            };
          });
          setFacilitiesPharmacies(prev => {
            const ids = new Set(livePharmacies.map(p => p.id));
            return [...livePharmacies, ...prev.filter(p => !ids.has(p.id))];
          });
        }
      } catch {}

      try {
        const labSnap = await getDocs(collection(db, 'lab_profiles'));
        if (!labSnap.empty) {
          const liveLabs = labSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              name: data.labName || 'مختبر معتمد',
              governorate: data.governorate || 'العراق',
              phone: data.phone || '',
            };
          });
          setFacilitiesLabs(prev => {
            const ids = new Set(liveLabs.map(l => l.id));
            return [...liveLabs, ...prev.filter(l => !ids.has(l.id))];
          });
        }
      } catch {}

      try {
        const radSnap = await getDocs(collection(db, 'radiology_profiles'));
        if (!radSnap.empty) {
          const liveRad = radSnap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              name: data.centerName || 'مركز أشعة معتمد',
              governorate: data.governorate || 'العراق',
              phone: data.phone || '',
            };
          });
          setFacilitiesRadCenters(prev => {
            const ids = new Set(liveRad.map(r => r.id));
            return [...liveRad, ...prev.filter(r => !ids.has(r.id))];
          });
        }
      } catch {}

    } catch (err: unknown) {
      console.error('Error loading doctor workspace:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const sendInAppNotification = async (recipientUid: string, title: string, message: string, type: string) => {
    if (!recipientUid) return;
    try {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        recipientUid,
        title,
        message,
        type,
        read: false,
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to send in-app notification:', e);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, [user]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Appointment Actions
  // Appointment Actions
  const handleUpdateAppointmentStatus = async (apptId: string, status: AppointmentStatus) => {
    try {
      if (isDemoMode) {
        setAppointments(prev => prev.map(a => a.id === apptId ? { ...a, status, updatedAt: new Date().toISOString() } : a));
        showToast(
          language === 'ar' ? `تم تحديث حالة الموعد إلى: ${status}` : `Appointment updated to: ${status}`
        );
        return;
      }
      const ref = doc(db, 'appointments', apptId);
      await updateDoc(ref, {
        status,
        updatedAt: new Date().toISOString(),
      });
      showToast(
        language === 'ar' ? `تم تحديث حالة الموعد إلى: ${status}` : `Appointment updated to: ${status}`
      );
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${apptId}`);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!reschedulingAppt || !rescheduleData.newDate) return;
    try {
      if (isDemoMode) {
        setAppointments(prev => prev.map(a => a.id === reschedulingAppt.id ? { 
          ...a, 
          status: 'rescheduled',
          rescheduleProposedDate: rescheduleData.newDate,
          rescheduleReason: rescheduleData.reason || 'الموعد المعاد جدولته بناء على توصية الطبيب',
          updatedAt: new Date().toISOString() 
        } : a));
        showToast(
          language === 'ar' ? 'تم حفظ طلب إعادة الجدولة وإبلاغ المريض' : 'Reschedule request saved'
        );
        setReschedulingAppt(null);
        setRescheduleData({ newDate: '', reason: '' });
        return;
      }
      const ref = doc(db, 'appointments', reschedulingAppt.id);
      await updateDoc(ref, {
        status,
        rescheduleProposedDate: rescheduleData.newDate,
        rescheduleReason: rescheduleData.reason || 'الموعد المعاد جدولته بناء على توصية الطبيب',
        updatedAt: new Date().toISOString(),
      });
      showToast(
        language === 'ar' ? 'تم حفظ طلب إعادة الجدولة وإبلاغ المريض' : 'Reschedule request saved'
      );
      setReschedulingAppt(null);
      setRescheduleData({ newDate: '', reason: '' });
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${reschedulingAppt.id}`);
    }
  };

  // Create In-Clinic / Phone Appointment
  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newApptData.patientName.trim()) return;

    try {
      const apptId = `appt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const appt: Appointment = {
        id: apptId,
        doctorId: user.uid,
        patientId: `pat_${Date.now()}`,
        patientName: newApptData.patientName,
        patientPhone: newApptData.patientPhone || '07XXXXXXXXX',
        doctorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب المعالج',
        specialty: doctorProfile?.specialty || 'استشارة عامة',
        date: newApptData.date,
        timeSlot: newApptData.timeSlot,
        status: 'confirmed',
        consultationType: newApptData.consultationType,
        notes: newApptData.notes,
        createdAt: now,
        updatedAt: now,
      };

      if (isDemoMode) {
        setAppointments(prev => [appt, ...prev]);
        showToast(
          language === 'ar' ? 'تم تسجيل وتأكيد الموعد بنجاح في العيادة' : 'Appointment registered successfully'
        );
        setShowNewAppointmentModal(false);
        setNewApptData({
          patientName: '',
          patientPhone: '',
          date: new Date().toISOString().split('T')[0],
          timeSlot: '17:00',
          consultationType: 'in_person',
          notes: '',
        });
        return;
      }

      await setDoc(doc(db, 'appointments', apptId), appt);
      showToast(
        language === 'ar' ? 'تم تسجيل وتأكيد الموعد بنجاح في قاعدة البيانات' : 'Appointment registered'
      );
      setShowNewAppointmentModal(false);
      setNewApptData({
        patientName: '',
        patientPhone: '',
        date: new Date().toISOString().split('T')[0],
        timeSlot: '17:00',
        consultationType: 'in_person',
        notes: '',
      });
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    }
  };

  // Create Medical Record
  const handleCreateMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRecordData.patientName.trim() || !newRecordData.title.trim()) return;

    try {
      const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const record: MedicalRecord = {
        id: recordId,
        patientId: `pat_rec_${Date.now()}`,
        patientName: newRecordData.patientName,
        doctorId: user.uid,
        recordType: newRecordData.recordType,
        title: newRecordData.title,
        details: newRecordData.details,
        sourceFacility: newRecordData.sourceFacility || doctorProfile?.clinicAddress || 'عيادة الطبيب المعتمدة',
        doctorNotes: newRecordData.doctorNotes,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'medical_records', recordId), record);
      showToast(
        language === 'ar' ? 'تم حفظ التقرير الطبي وتوثيقه في السجل المشفر' : 'Medical record saved'
      );
      setShowNewRecordModal(false);
      setNewRecordData({
        patientName: '',
        recordType: 'clinical_note',
        title: '',
        details: '',
        sourceFacility: '',
        doctorNotes: '',
      });
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'medical_records');
    }
  };

  // Create Secretary Delegation
  const handleCreateSecretaryDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newSecretaryData.secretaryEmail.trim()) return;

    try {
      const delegationId = `sec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const perms: string[] = [];
      if (newSecretaryData.canManageAppointments) perms.push('canManageAppointments');
      if (newSecretaryData.canViewQueue) perms.push('canViewQueue');
      if (newSecretaryData.canCollectFees) perms.push('canCollectFees');

      const delegation: SecretaryDelegation = {
        id: delegationId,
        doctorId: user.uid,
        doctorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب المعالج',
        secretaryEmail: newSecretaryData.secretaryEmail.toLowerCase(),
        secretaryName: newSecretaryData.secretaryName || newSecretaryData.secretaryEmail.split('@')[0],
        permissions: perms,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'secretary_delegations', delegationId), delegation);
      showToast(
        language === 'ar' ? 'تم منح صلاحيات السكرتارية بنجاح' : 'Secretary access delegated'
      );
      setShowNewSecretaryModal(false);
      setNewSecretaryData({
        secretaryEmail: '',
        secretaryName: '',
        canManageAppointments: true,
        canViewQueue: true,
        canCollectFees: false,
      });
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'secretary_delegations');
    }
  };

  // Toggle or Revoke Secretary
  const handleToggleSecretary = async (delegationId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'revoked' : 'active';
      const ref = doc(db, 'secretary_delegations', delegationId);
      await updateDoc(ref, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Synchronize with secretary_assignments if secretaryUid is linked
      const deleg = delegations.find(d => d.id === delegationId);
      if (deleg && deleg.secretaryUid) {
        try {
          await updateDoc(doc(db, 'secretary_assignments', deleg.secretaryUid), {
            status: newStatus,
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // ignore if doc not yet created
        }
      }

      showToast(
        language === 'ar' ? `تم تعديل حالة التفويض إلى: ${newStatus}` : `Delegation status: ${newStatus}`
      );
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `secretary_delegations/${delegationId}`);
    }
  };

  const handleDeleteSecretary = async (delegationId: string) => {
    try {
      const deleg = delegations.find(d => d.id === delegationId);
      await deleteDoc(doc(db, 'secretary_delegations', delegationId));
      if (deleg && deleg.secretaryUid) {
        try {
          await deleteDoc(doc(db, 'secretary_assignments', deleg.secretaryUid));
        } catch {
          // ignore
        }
      }
      showToast(language === 'ar' ? 'تم حذف التفويض' : 'Delegation removed');
      await loadDoctorData();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.DELETE, `secretary_delegations/${delegationId}`);
    }
  };

  const handleDoctorPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await validateAndCompressImage(file, 400, 0.85);
    if (!res.valid || !res.dataUrl) {
      showToast(res.error || 'فشل معالجة الصورة', 'error');
      return;
    }
    setEditProfileForm(prev => ({ ...prev, photoURL: res.dataUrl! }));
    showToast(language === 'ar' ? 'تم اختيار الصورة وضغطها بنجاح' : 'Photo compressed and ready to save');
  };

  // Save Schedule & Clinic Settings
  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const now = new Date().toISOString();
      const updatedProfile: DoctorProfile = {
        doctorId: user.uid,
        fullName: editProfileForm.fullName,
        photoURL: editProfileForm.photoURL || undefined,
        specialty: editProfileForm.specialty,
        subspecialty: editProfileForm.subspecialty,
        qualifications: editProfileForm.qualifications,
        experienceYears: Number(editProfileForm.experienceYears),
        clinicAddress: editProfileForm.clinicAddress,
        governorate: editProfileForm.governorate,
        phone: editProfileForm.phone,
        whatsapp: editProfileForm.whatsapp,
        consultationFee: Number(editProfileForm.consultationFee),
        workingDays: editProfileForm.workingDays,
        workingHours: editProfileForm.workingHours,
        mapsUrl: editProfileForm.mapsUrl,
        bio: editProfileForm.bio,
        createdAt: doctorProfile?.createdAt || now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'doctor_profiles', user.uid), updatedProfile);

      // Also update non-privileged user profile fields
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: editProfileForm.fullName,
        facilityName: editProfileForm.clinicAddress,
        governorate: editProfileForm.governorate,
        phone: editProfileForm.phone,
        updatedAt: now,
      });

      await logAuditEvent({
        action: 'profile_contact_updated',
        category: 'accreditation',
        actorUid: user.uid,
        actorName: editProfileForm.fullName,
        actorRole: 'doctor',
        resourceId: user.uid,
        status: 'updated',
        details: `تحديث بيانات الطبيب والعيادة وأرقام التواصل وأوقات الدوام.`
      });

      showToast(
        language === 'ar' ? 'تم حفظ إعدادات العيادة وأوقات الدوام بنجاح' : 'Clinic settings saved'
      );
      await loadDoctorData();
      await refreshProfile();
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `doctor_profiles/${user.uid}`);
    }
  };

  const toggleDaySelection = (day: string) => {
    const current = editProfileForm.workingDays;
    if (current.includes(day)) {
      setEditProfileForm({ ...editProfileForm, workingDays: current.filter(d => d !== day) });
    } else {
      setEditProfileForm({ ...editProfileForm, workingDays: [...current, day] });
    }
  };

  const [selectedMedicineItem, setSelectedMedicineItem] = useState<SearchMedicineResult | null>(null);

  // Medicine Selection for Rx
  const handleSelectMedicineForRx = (med: SearchMedicineResult) => {
    setSelectedMedicineItem(med);
  };

  const handleAddMedicineItemToRx = () => {
    if (!selectedMedicineItem) return;
    const newItem: PrescriptionMedicineItem = {
      medicineId: selectedMedicineItem.id,
      name: selectedMedicineItem.name,
      activeIngredient: selectedMedicineItem.activeIngredient,
      strength: selectedMedicineItem.strength,
      dosageForm: selectedMedicineItem.dosageForm,
      packageSize: selectedMedicineItem.packageSize,
      dosage: currentDosage,
      frequency: currentFrequency,
      duration: currentDuration,
      instructions: currentInstructions,
      warnings: currentWarnings || undefined,
    };
    setNewRxItems(prev => [...prev, newItem]);
    setSelectedMedicineItem(null);
    setCurrentDosage('حبة واحدة (1 Tablet)');
    setCurrentFrequency('مرتين يومياً بعد الطعام (Twice daily)');
    setCurrentDuration('5 أيام (5 Days)');
    setCurrentInstructions('تؤخذ بعد وجبة الطعام مباشرة مع الماء');
    setCurrentWarnings('');
    showToast(language === 'ar' ? 'تمت إضافة الدواء إلى الوصفة' : 'Medicine added to Rx');
  };

  const handleRemoveRxItem = (index: number) => {
    setNewRxItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateElectronicPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRxPatientName.trim()) {
      showToast(language === 'ar' ? 'يرجى إدخال اسم المريض' : 'Please provide patient name', 'error');
      return;
    }
    if (newRxItems.length === 0) {
      showToast(language === 'ar' ? 'يرجى إضافة دواء واحد على الأقل للوصفة' : 'Add at least one medicine', 'error');
      return;
    }

    try {
      const rxId = `rx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const rxNum = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      const allergiesArray = newRxAllergies
        ? newRxAllergies.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const newRx: ElectronicPrescription = {
        id: rxId,
        prescriptionNumber: rxNum,
        doctorId: user.uid,
        doctorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب المعالج',
        doctorSpecialty: doctorProfile?.specialty || 'استشاري أمراض باطنية',
        doctorLicense: userProfile?.licenseNumber || 'IQ-DOC-2026',
        doctorPhone: doctorProfile?.phone || userProfile?.phone || '07801122334',
        clinicName: doctorProfile?.clinicAddress || userProfile?.facilityName || 'العيادة الاستشارية التخصصية',
        patientId: newRxPatientId || `pat_${Date.now()}`,
        patientName: newRxPatientName.trim(),
        patientPhone: newRxPatientPhone.trim() || '07XXXXXXXXX',
        patientAllergies: allergiesArray,
        diagnosis: newRxDiagnosis.trim() || 'فحص ومعاينة سريرية دورية',
        generalInstructions: newRxGeneralInstructions.trim() || undefined,
        targetPharmacyId: newRxTargetPharmacyId || undefined,
        targetPharmacyName: newRxTargetPharmacyName || undefined,
        status: newRxTargetPharmacyId ? 'sent' : 'draft',
        items: newRxItems,
        createdAt: now,
        updatedAt: now,
      };

      if (isDemoMode) {
        setPrescriptions(prev => [newRx, ...prev]);
        showToast(language === 'ar' ? `تم إصدار الوصفة الطبية الإلكترونية برقم ${rxNum}` : `Prescription ${rxNum} issued`);
      } else {
        await setDoc(doc(db, 'electronic_prescriptions', rxId), newRx);
        setPrescriptions(prev => [newRx, ...prev]);
        showToast(language === 'ar' ? `تم إصدار الوصفة الإلكترونية برقم ${rxNum} بنجاح` : `Prescription ${rxNum} created`);
      }

      // Record System Audit Log
      await logAuditEvent({
        action: 'prescription_created',
        category: 'prescriptions',
        actorUid: user.uid,
        actorName: newRx.doctorName,
        actorRole: 'doctor',
        targetUid: newRx.targetPharmacyId || newRx.patientId,
        targetName: newRx.targetPharmacyName || newRx.patientName,
        targetRole: newRx.targetPharmacyId ? 'pharmacy' : 'patient',
        resourceId: rxId,
        resourceNumber: rxNum,
        status: newRx.status,
        details: `إصدار وتوثيق وصفة طبية إلكترونية رقم ${rxNum} للمريض (${newRx.patientName}) تحتوي على ${newRx.items.length} أدوية.`
      });

      // Notify Pharmacy and Patient
      if (newRx.targetPharmacyId) {
        await sendInAppNotification(
          newRx.targetPharmacyId,
          'وصفة طبية إلكترونية جديدة (New Rx)',
          `أحال الطبيب ${newRx.doctorName} وصفة إلكترونية رقم ${rxNum} للمريض ${newRx.patientName}.`,
          'prescription'
        );
      }
      if (newRx.patientId) {
        await sendInAppNotification(
          newRx.patientId,
          'صدرت وصفتك الطبية الإلكترونية',
          `أصدر لك الدكتور ${newRx.doctorName} وصفة علاجية برقم ${rxNum} موجهة إلى ${newRx.targetPharmacyName || 'الصيدلية المعتمدة'}.`,
          'prescription'
        );
      }

      setShowNewPrescriptionModal(false);
      setNewRxPatientName('');
      setNewRxPatientPhone('');
      setNewRxPatientId('');
      setNewRxDiagnosis('');
      setNewRxAllergies('');
      setNewRxGeneralInstructions('');
      setNewRxTargetPharmacyId('');
      setNewRxTargetPharmacyName('');
      setNewRxItems([]);
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'electronic_prescriptions');
    }
  };

  const handleCancelPrescription = async (prescriptionId: string) => {
    try {
      const rx = prescriptions.find(p => p.id === prescriptionId);
      if (rx && (rx.status === 'dispensed' || rx.dispensedAt)) {
        showToast(language === 'ar' ? 'تنبيه أمني: لا يمكن إلغاء وصفة تم صرفها وتوثيقها بالفعل من الصيدلية!' : 'Cannot cancel dispensed Rx', 'error');
        return;
      }

      const now = new Date().toISOString();
      if (!isDemoMode) {
        await updateDoc(doc(db, 'electronic_prescriptions', prescriptionId), {
          status: 'cancelled',
          updatedAt: now
        });
      }
      setPrescriptions(prev => prev.map(p => p.id === prescriptionId ? { ...p, status: 'cancelled', updatedAt: now } : p));
      showToast(language === 'ar' ? 'تم إلغاء الوصفة بنجاح وتوثيق ذلك' : 'Prescription cancelled');

      // Audit Log
      await logAuditEvent({
        action: 'prescription_cancelled',
        category: 'prescriptions',
        actorUid: user.uid,
        actorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب',
        actorRole: 'doctor',
        targetUid: rx?.targetPharmacyId || rx?.patientId,
        targetName: rx?.targetPharmacyName || rx?.patientName,
        resourceId: prescriptionId,
        resourceNumber: rx?.prescriptionNumber,
        status: 'cancelled',
        details: `إلغاء الوصفة الطبية رقم ${rx?.prescriptionNumber || prescriptionId}.`
      });

      if (rx?.targetPharmacyId) {
        await sendInAppNotification(
          rx.targetPharmacyId,
          'إلغاء وصفة طبية',
          `قام الطبيب ${rx.doctorName} بإلغاء الوصفة رقم ${rx.prescriptionNumber}.`,
          'prescription'
        );
      }
      if (rx?.patientId) {
        await sendInAppNotification(
          rx.patientId,
          'تم إلغاء الوصفة الطبية',
          `تم إلغاء الوصفة رقم ${rx.prescriptionNumber} من قبل الطبيب المعالج.`,
          'prescription'
        );
      }
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `electronic_prescriptions/${prescriptionId}`);
    }
  };

  const handleCreateLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newLabPatientName.trim()) {
      showToast(language === 'ar' ? 'يرجى إدخال اسم المريض' : 'Please provide patient name', 'error');
      return;
    }
    if (newLabTestsList.length === 0) {
      showToast(language === 'ar' ? 'يرجى اختيار فحص مخبري واحد على الأقل' : 'Select at least one test', 'error');
      return;
    }

    try {
      const orderId = `lab_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orderNumber = `LAB-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      const testItems: LabOrderItem[] = newLabTestsList.map(t => ({ testName: t }));

      const newOrder: LabOrder = {
        id: orderId,
        orderNumber,
        doctorId: user.uid,
        doctorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب المعالج',
        doctorSpecialty: doctorProfile?.specialty || 'استشاري أمراض باطنية',
        doctorPhone: doctorProfile?.phone || userProfile?.phone || '07801122334',
        clinicName: doctorProfile?.clinicAddress || userProfile?.facilityName || 'العيادة الاستشارية',
        patientId: `pat_${Date.now()}`,
        patientName: newLabPatientName.trim(),
        patientPhone: newLabPatientPhone.trim() || '07XXXXXXXXX',
        targetLabId: newLabTargetLabId || undefined,
        targetLabName: newLabTargetLabName || undefined,
        priority: newLabPriority,
        clinicalIndication: newLabClinicalIndication.trim() || 'تحاليل تشخيصية روتينية',
        preparationInstructions: newLabPrepInstructions.trim() || undefined,
        status: 'new',
        tests: testItems,
        createdAt: now,
        updatedAt: now,
      };

      if (isDemoMode) {
        setLabOrders(prev => [newOrder, ...prev]);
        showToast(language === 'ar' ? `تم إرسال طلب التحاليل رقم ${orderNumber}` : `Lab order ${orderNumber} created`);
      } else {
        await setDoc(doc(db, 'lab_orders', orderId), newOrder);
        setLabOrders(prev => [newOrder, ...prev]);
        showToast(language === 'ar' ? `تم إرسال طلب التحاليل بنجاح برقم ${orderNumber}` : `Lab order ${orderNumber} created`);
      }

      // Record Audit Log
      await logAuditEvent({
        action: 'lab_order_created',
        category: 'lab_diagnostics',
        actorUid: user.uid,
        actorName: newOrder.doctorName,
        actorRole: 'doctor',
        targetUid: newOrder.targetLabId,
        targetName: newOrder.targetLabName,
        targetRole: 'laboratory',
        resourceId: orderId,
        resourceNumber: orderNumber,
        status: 'new',
        details: `إرسال طلب تحاليل مخبرية رقم ${orderNumber} للمريض ${newOrder.patientName} (${newOrder.tests.length} تحاليل).`
      });

      if (newOrder.targetLabId) {
        await sendInAppNotification(
          newOrder.targetLabId,
          'طلب تحاليل مخبرية جديد',
          `أحال الطبيب ${newOrder.doctorName} المريض ${newOrder.patientName} لإجراء تحاليل بالطلب رقم ${orderNumber}.`,
          'lab_order'
        );
      }
      if (newOrder.patientId) {
        await sendInAppNotification(
          newOrder.patientId,
          'إحالة مخبرية جديدة',
          `أصدر لك الدكتور ${newOrder.doctorName} طلب تحاليل مخبرية برقم ${orderNumber}.`,
          'lab_order'
        );
      }

      setShowNewLabOrderModal(false);
      setNewLabPatientName('');
      setNewLabPatientPhone('');
      setNewLabTargetLabId('');
      setNewLabTargetLabName('');
      setNewLabClinicalIndication('');
      setNewLabTestsList(['CBC (صورة دم كاملة)']);
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'lab_orders');
    }
  };

  const handleCancelLabOrder = async (orderId: string) => {
    try {
      const ord = labOrders.find(o => o.id === orderId);
      const now = new Date().toISOString();
      if (isDemoMode) {
        setLabOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled', updatedAt: now } : o));
        showToast(language === 'ar' ? 'تم إلغاء طلب التحليل' : 'Lab order cancelled');
      } else {
        await updateDoc(doc(db, 'lab_orders', orderId), {
          status: 'cancelled',
          updatedAt: now
        });
        setLabOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled', updatedAt: now } : o));
        showToast(language === 'ar' ? 'تم إلغاء الطلب' : 'Order cancelled');
      }

      await logAuditEvent({
        action: 'lab_order_cancelled',
        category: 'lab_diagnostics',
        actorUid: user.uid,
        actorName: doctorProfile?.fullName || 'الطبيب',
        actorRole: 'doctor',
        targetUid: ord?.targetLabId,
        targetName: ord?.targetLabName,
        resourceId: orderId,
        resourceNumber: ord?.orderNumber,
        status: 'cancelled',
        details: `إلغاء طلب التحاليل المخبرية رقم ${ord?.orderNumber || orderId}.`
      });
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `lab_orders/${orderId}`);
    }
  };

  const handleCreateRadiologyOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newRadPatientName.trim()) {
      showToast(language === 'ar' ? 'يرجى إدخال اسم المريض' : 'Please provide patient name', 'error');
      return;
    }

    try {
      const orderId = `rad_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orderNumber = `RAD-ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const now = new Date().toISOString();

      const newOrder: RadiologyOrder = {
        id: orderId,
        orderNumber,
        doctorId: user.uid,
        doctorName: doctorProfile?.fullName || userProfile?.displayName || 'الطبيب المعالج',
        doctorSpecialty: doctorProfile?.specialty || 'استشاري أمراض باطنية',
        doctorPhone: doctorProfile?.phone || userProfile?.phone || '07801122334',
        clinicName: doctorProfile?.clinicAddress || userProfile?.facilityName || 'العيادة الاستشارية',
        patientId: `pat_${Date.now()}`,
        patientName: newRadPatientName.trim(),
        patientPhone: newRadPatientPhone.trim() || '07XXXXXXXXX',
        targetCenterId: newRadTargetCenterId || undefined,
        targetCenterName: newRadTargetCenterName || undefined,
        modality: newRadModality,
        bodyRegion: newRadBodyRegion.trim(),
        priority: newRadPriority,
        clinicalIndication: newRadClinicalIndication.trim() || 'فحص تصويري استقصائي',
        preparationInstructions: newRadPrepInstructions.trim() || undefined,
        status: 'new',
        createdAt: now,
        updatedAt: now,
      };

      if (isDemoMode) {
        setRadiologyOrders(prev => [newOrder, ...prev]);
        showToast(language === 'ar' ? `تم إرسال طلب الفحص الشعاعي رقم ${orderNumber}` : `Radiology order ${orderNumber} created`);
      } else {
        await setDoc(doc(db, 'radiology_orders', orderId), newOrder);
        setRadiologyOrders(prev => [newOrder, ...prev]);
        showToast(language === 'ar' ? `تم إرسال طلب الأشعة بنجاح برقم ${orderNumber}` : `Radiology order ${orderNumber} created`);
      }

      // Record Audit Log
      await logAuditEvent({
        action: 'radiology_order_created',
        category: 'radiology',
        actorUid: user.uid,
        actorName: newOrder.doctorName,
        actorRole: 'doctor',
        targetUid: newOrder.targetCenterId,
        targetName: newOrder.targetCenterName,
        targetRole: 'radiology_center',
        resourceId: orderId,
        resourceNumber: orderNumber,
        status: 'new',
        details: `إرسال طلب فحص تصويري (${newOrder.modality}) برقم ${orderNumber} للمريض ${newOrder.patientName}.`
      });

      if (newOrder.targetCenterId) {
        await sendInAppNotification(
          newOrder.targetCenterId,
          'طلب فحص أشعة وسونار جديد',
          `أحال الطبيب ${newOrder.doctorName} المريض ${newOrder.patientName} للفحص برقم ${orderNumber}.`,
          'radiology_order'
        );
      }
      if (newOrder.patientId) {
        await sendInAppNotification(
          newOrder.patientId,
          'طلب فحص أشعة وسونار',
          `أصدر لك الدكتور ${newOrder.doctorName} إحالة فحص شعاعي برقم ${orderNumber}.`,
          'radiology_order'
        );
      }

      setShowNewRadOrderModal(false);
      setNewRadPatientName('');
      setNewRadPatientPhone('');
      setNewRadTargetCenterId('');
      setNewRadTargetCenterName('');
      setNewRadClinicalIndication('');
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, 'radiology_orders');
    }
  };

  const handleCancelRadiologyOrder = async (orderId: string) => {
    try {
      const ord = radiologyOrders.find(o => o.id === orderId);
      const now = new Date().toISOString();
      if (isDemoMode) {
        setRadiologyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled', updatedAt: now } : o));
        showToast(language === 'ar' ? 'تم إلغاء طلب الأشعة' : 'Radiology order cancelled');
      } else {
        await updateDoc(doc(db, 'radiology_orders', orderId), {
          status: 'cancelled',
          updatedAt: now
        });
        setRadiologyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled', updatedAt: now } : o));
        showToast(language === 'ar' ? 'تم إلغاء طلب الأشعة' : 'Order cancelled');
      }

      await logAuditEvent({
        action: 'radiology_order_cancelled',
        category: 'radiology',
        actorUid: user.uid,
        actorName: doctorProfile?.fullName || 'الطبيب',
        actorRole: 'doctor',
        targetUid: ord?.targetCenterId,
        targetName: ord?.targetCenterName,
        resourceId: orderId,
        resourceNumber: ord?.orderNumber,
        status: 'cancelled',
        details: `إلغاء طلب الأشعة رقم ${ord?.orderNumber || orderId}.`
      });
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `radiology_orders/${orderId}`);
    }
  };

  // Filtered Appointments
  const filteredAppointments = appointments.filter((appt) => {
    if (appointmentFilter === 'all') return true;
    return appt.status === appointmentFilter;
  });

  // Filtered Records
  const filteredRecords = medicalRecords.filter((rec) => {
    if (recordFilter === 'all') return true;
    return rec.recordType === recordFilter;
  });

  // Filtered Prescriptions
  const filteredPrescriptions = prescriptions.filter((rx) => {
    if (prescriptionFilter === 'all') return true;
    return rx.status === prescriptionFilter;
  });

  // Derived Dashboard Metrics
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold shadow-lg animate-in slide-in-from-top-3 ${
          feedbackMsg.type === 'success' 
            ? 'bg-emerald-600 text-white' 
            : 'bg-red-600 text-white'
        }`}>
          <CheckCircle2 size={18} />
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Doctor Brand Banner */}
      <div className="bg-gradient-to-r from-[#002244] via-[#003366] to-[#b8142a] rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-md shrink-0">
              <Stethoscope size={36} className="text-red-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold mb-1.5">
                <CheckCircle2 size={13} />
                <span>{language === 'ar' ? 'طبيب اختصاص معتمد وموثق' : 'Certified Doctor'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                {doctorProfile?.fullName || userProfile?.displayName}
              </h1>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-200 mt-1">
                <span>{doctorProfile?.specialty || 'استشاري جراحة وباطنية'}</span>
                <span className="opacity-40">·</span>
                <span className="flex items-center gap-1">
                  <MapPin size={13} className="text-red-300" />
                  <span>{doctorProfile?.clinicAddress || userProfile?.facilityName || 'بغداد'}</span>
                </span>
                <span className="opacity-40">·</span>
                <span className="flex items-center gap-1 font-mono text-emerald-300 font-bold">
                  <span>{Number(doctorProfile?.consultationFee || 25000).toLocaleString()} د.ع</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setRefreshing(true);
                loadDoctorData();
              }}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors flex items-center gap-2 text-xs font-bold cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{language === 'ar' ? 'تحديث' : 'Sync'}</span>
            </button>
            <button
              onClick={() => setShowNewPrescriptionModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Pill size={16} />
              <span>{language === 'ar' ? 'إصدار وصفة Rx' : 'Write Prescription'}</span>
            </button>
            <button
              onClick={() => {
                setReferralSubTab('lab');
                setShowNewLabOrderModal(true);
              }}
              className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <FlaskConical size={16} />
              <span>{language === 'ar' ? 'طلب فحص تحليلي/شعاعي' : 'Diagnostic Order'}</span>
            </button>
            <button
              onClick={() => setShowNewAppointmentModal(true)}
              className="px-3.5 py-2.5 rounded-xl bg-white text-[#003366] hover:bg-slate-100 font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus size={16} />
              <span>{language === 'ar' ? 'كشفية عيادة' : 'New Appointment'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Doctor Workspace Tabs Navigation */}
      <div className="flex items-center gap-1 p-1.5 bg-slate-200/80 rounded-2xl overflow-x-auto text-xs font-bold">
        {[
          { id: 'dashboard', labelAr: 'لوحة المؤشرات', labelEn: 'Dashboard', icon: Activity },
          { id: 'appointments', labelAr: `المواعيد (${appointments.length})`, labelEn: `Appointments (${appointments.length})`, icon: Calendar },
          { id: 'prescriptions', labelAr: `الوصفات الإلكترونية (${prescriptions.length})`, labelEn: `Prescriptions (${prescriptions.length})`, icon: Pill },
          { id: 'referrals', labelAr: `التحويلات والفحوصات (${labOrders.length + radiologyOrders.length})`, labelEn: `Referrals (${labOrders.length + radiologyOrders.length})`, icon: FlaskConical },
          { id: 'records', labelAr: `السجلات والتقارير (${medicalRecords.length})`, labelEn: `Medical Records (${medicalRecords.length})`, icon: FileText },
          { id: 'schedule', labelAr: 'الدوام ومعلومات العيادة', labelEn: 'Schedule & Clinic', icon: Clock },
          { id: 'secretary', labelAr: `السكرتارية (${delegations.length})`, labelEn: `Secretary (${delegations.length})`, icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-white text-[#003366] shadow-sm font-extrabold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-[#c4152e]' : 'text-slate-400'} />
              <span>{language === 'ar' ? tab.labelAr : tab.labelEn}</span>
              {tab.id === 'appointments' && pendingCount > 0 && (
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-mono">
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          {/* Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block mb-1 font-semibold">{language === 'ar' ? 'إجمالي المواعيد' : 'Total Bookings'}</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">{appointments.length}</div>
              <span className="text-[11px] text-slate-400 mt-1 block">{language === 'ar' ? 'في قاعدة بيانات Firestore' : 'Live database'}</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-amber-200 shadow-xs">
              <span className="text-xs text-amber-700 block mb-1 font-semibold">{language === 'ar' ? 'بانتظار الموافقة' : 'Pending Requests'}</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-800 font-mono">{pendingCount}</div>
              <span className="text-[11px] text-amber-600 mt-1 block">{language === 'ar' ? 'تتطلب قرار الطبيب' : 'Action required'}</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-xs">
              <span className="text-xs text-emerald-700 block mb-1 font-semibold">{language === 'ar' ? 'مواعيد مؤكدة قادمة' : 'Confirmed Visits'}</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono">{confirmedCount}</div>
              <span className="text-[11px] text-emerald-600 mt-1 block">{language === 'ar' ? 'جاهزة للاستقبال' : 'Scheduled queue'}</span>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-xs">
              <span className="text-xs text-blue-700 block mb-1 font-semibold">{language === 'ar' ? 'السجلات الطبية المؤرشفة' : 'Medical Records'}</span>
              <div className="text-2xl sm:text-3xl font-black text-blue-800 font-mono">{medicalRecords.length}</div>
              <span className="text-[11px] text-blue-600 mt-1 block">{language === 'ar' ? 'تحاليل وتقارير وكشوفات' : 'Confidential reports'}</span>
            </div>
          </div>

          {/* Pending Requests Alert */}
          {pendingCount > 0 && (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <AlertCircle size={22} className="text-amber-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">
                    {language === 'ar' ? `لديك (${pendingCount}) طلبات مواعيد جديدة بحاجة لتأكيدك` : `You have (${pendingCount}) pending appointment requests`}
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {language === 'ar' ? 'يمكنك قبول الطلبات أو اقتراح موعد بديل فوراً.' : 'Review requests to confirm or propose a reschedule.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setAppointmentFilter('pending');
                  setActiveTab('appointments');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0"
              >
                {language === 'ar' ? 'مراجعة الطلبات الآن' : 'Review Requests'}
              </button>
            </div>
          )}

          {/* 2-Column Split: Today's Appointments & Recent Medical Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Upcoming Appointments List */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-[#c4152e]" />
                  <h3 className="font-bold text-base text-slate-900">{language === 'ar' ? 'المواعيد القادمة' : 'Upcoming Consultations'}</h3>
                </div>
                <button
                  onClick={() => setActiveTab('appointments')}
                  className="text-xs font-bold text-[#003366] hover:underline"
                >
                  {language === 'ar' ? 'عرض الكل' : 'View All'}
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Calendar size={36} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{language === 'ar' ? 'لا توجد مواعيد مسجلة حالياً' : 'No appointments scheduled'}</p>
                  <button
                    onClick={() => setShowNewAppointmentModal(true)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    {language === 'ar' ? 'تسجيل أول موعد' : 'Book First Appointment'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {appointments.slice(0, 5).map((appt) => (
                    <div
                      key={appt.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-100/80 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-[#c4152e] flex items-center justify-center font-bold text-xs shrink-0">
                          {appt.timeSlot}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-slate-900">{appt.patientName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{appt.date}</span>
                            <span>·</span>
                            <span className="font-mono">{appt.patientPhone}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          appt.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appt.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : appt.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {appt.status}
                        </span>
                        {appt.status === 'confirmed' && (
                          <button
                            onClick={() => handleUpdateAppointmentStatus(appt.id, 'completed')}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                            title="اكتمال الكشف"
                          >
                            <Check size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Medical Records / Notes */}
            <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-[#003366]" />
                    <h3 className="font-bold text-base text-slate-900">{language === 'ar' ? 'أحدث التقارير الطبية' : 'Recent Patient Reports'}</h3>
                  </div>
                  <button
                    onClick={() => setShowNewRecordModal(true)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {medicalRecords.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    <FileText size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">{language === 'ar' ? 'لا توجد تقارير مخبرية أو شعاعية محفوظة' : 'No records yet'}</p>
                    <button
                      onClick={() => setShowNewRecordModal(true)}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      {language === 'ar' ? 'إضافة تقرير فحص / روشتة' : 'Add Medical Entry'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {medicalRecords.slice(0, 4).map((rec) => (
                      <div key={rec.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900 truncate">{rec.title}</span>
                          <span className="text-[10px] text-slate-400">{rec.createdAt.split('T')[0]}</span>
                        </div>
                        <div className="text-slate-600 flex items-center justify-between">
                          <span>{rec.patientName}</span>
                          <span className="font-semibold text-blue-700 capitalize">{rec.recordType.replace('_', ' ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>{language === 'ar' ? 'حماية البيانات: مشفرة بالكامل' : 'Protected Patient Data'}</span>
                <button
                  onClick={() => setActiveTab('records')}
                  className="font-bold text-[#003366] hover:underline"
                >
                  {language === 'ar' ? 'فتح الأرشيف الكامل' : 'Open Archive'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: APPOINTMENTS WORKFLOW */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {language === 'ar' ? 'جدول المواعيد والاستشارات' : 'Appointment Schedule & Queue'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar'
                  ? 'إدارة حجوزات المراجعين، قبول الطلبات أو طلب إعادة جدولتها، وتأكيد اكتمال الكشف.'
                  : 'Manage patient bookings, confirm requests, propose reschedules, and record visits.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewAppointmentModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#c4152e] hover:bg-red-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus size={16} />
                <span>{language === 'ar' ? 'تسجيل موعد جديد' : 'New Appointment'}</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: 'all', label: language === 'ar' ? 'كافة المواعيد' : 'All' },
              { id: 'pending', label: language === 'ar' ? `بانتظار الموافقة (${pendingCount})` : `Pending (${pendingCount})` },
              { id: 'confirmed', label: language === 'ar' ? `مؤكدة (${confirmedCount})` : `Confirmed (${confirmedCount})` },
              { id: 'completed', label: language === 'ar' ? `مكتملة (${completedCount})` : `Completed (${completedCount})` },
              { id: 'cancelled', label: language === 'ar' ? 'ملغاة' : 'Cancelled' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setAppointmentFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  appointmentFilter === f.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Appointments Table / Cards */}
          {filteredAppointments.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Calendar size={48} className="mx-auto mb-3 opacity-30" />
              <h3 className="font-bold text-base text-slate-700">{language === 'ar' ? 'لا توجد مواعيد تطابق الفلتر' : 'No appointments matching filter'}</h3>
              <p className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'يمكنك تسجيل مواعيد يدوية للعيادة أو استقبال الحجوزات السحابية' : 'Create appointments or wait for patient bookings'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#003366] flex flex-col items-center justify-center font-bold text-xs shrink-0">
                      <span>{appt.date.split('-')[1]}/{appt.date.split('-')[2]}</span>
                      <span className="text-[10px] text-slate-400">{appt.timeSlot}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-slate-900">{appt.patientName}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          appt.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : appt.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : appt.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : appt.status === 'rescheduled'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {appt.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                        <span className="font-mono">{appt.patientPhone}</span>
                        <span>·</span>
                        <span>{appt.consultationType || 'معاينة بالعيادة'}</span>
                        {appt.notes && (
                          <>
                            <span>·</span>
                            <span className="text-slate-600 italic">"{appt.notes}"</span>
                          </>
                        )}
                      </div>

                      {appt.rescheduleProposedDate && (
                        <div className="mt-2 text-xs text-purple-800 bg-purple-50 p-2 rounded-lg">
                          <strong>{language === 'ar' ? 'الموعد المقترح للجدولة:' : 'Proposed Date:'}</strong> {appt.rescheduleProposedDate} ({appt.rescheduleReason})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Operational Action Controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {appt.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateAppointmentStatus(appt.id, 'confirmed')}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Check size={14} />
                          <span>{language === 'ar' ? 'تأكيد وقبول' : 'Confirm'}</span>
                        </button>
                        <button
                          onClick={() => setReschedulingAppt(appt)}
                          className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs transition-colors"
                        >
                          {language === 'ar' ? 'إعادة جدولة' : 'Reschedule'}
                        </button>
                        <button
                          onClick={() => handleUpdateAppointmentStatus(appt.id, 'cancelled')}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 hover:bg-red-100 font-bold text-xs transition-colors"
                        >
                          {language === 'ar' ? 'اعتذار / رفض' : 'Reject'}
                        </button>
                      </>
                    )}

                    {appt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => handleUpdateAppointmentStatus(appt.id, 'completed')}
                          className="px-4 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          <span>{language === 'ar' ? 'اكتمال الكشف الطبي' : 'Mark Completed'}</span>
                        </button>
                        <button
                          onClick={() => setReschedulingAppt(appt)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs"
                        >
                          {language === 'ar' ? 'تأجيل' : 'Reschedule'}
                        </button>
                      </>
                    )}

                    {appt.status === 'completed' && (
                      <button
                        onClick={() => {
                          setNewRecordData({
                            patientName: appt.patientName,
                            recordType: 'clinical_note',
                            title: `كشف واستشارة ${appt.patientName}`,
                            details: `تمت المعاينة السريرية في العيادة بتاريخ ${appt.date}.`,
                            sourceFacility: doctorProfile?.clinicAddress || '',
                            doctorNotes: '',
                          });
                          setShowNewRecordModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5"
                      >
                        <FileText size={14} />
                        <span>{language === 'ar' ? 'إصدار روشتة / تقرير' : 'Create Record'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MEDICAL RECORDS & LAB RESULTS */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {language === 'ar' ? 'السجلات الطبية والتقارير المحالة' : 'Diagnostic Records & Patient Files'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar'
                  ? 'استعراض نتائج المختبرات السريرية، تقارير مراكز الأشعة والسونار، والوصفات الطبية المشفرة.'
                  : 'Review certified pathology results, radiology scans, and electronic prescriptions.'}
              </p>
            </div>

            <button
              onClick={() => setShowNewRecordModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus size={16} />
              <span>{language === 'ar' ? 'إضافة تقرير / روشتة جديدة' : 'Add New Record'}</span>
            </button>
          </div>

          {/* Record Filters */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {[
              { id: 'all', label: language === 'ar' ? 'كافة السجلات' : 'All Records' },
              { id: 'lab_result', label: language === 'ar' ? 'تحاليل مخبرية' : 'Lab Tests' },
              { id: 'radiology_report', label: language === 'ar' ? 'أشعة وسونار' : 'Radiology & Scans' },
              { id: 'prescription', label: language === 'ar' ? 'روشتات إلكترونية' : 'e-Prescriptions' },
              { id: 'clinical_note', label: language === 'ar' ? 'تشخيص وملاحظات' : 'Clinical Notes' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setRecordFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  recordFilter === f.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Records Grid */}
          {filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <h3 className="font-bold text-base text-slate-700">{language === 'ar' ? 'لا توجد تقارير في هذا التصنيف' : 'No records found'}</h3>
              <p className="text-xs text-slate-500 mt-1">{language === 'ar' ? 'يمكنك تسجيل التشخيص والوصفة لمرضاك وحفظها سحابياً' : 'Add notes or prescriptions for patients'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRecords.map((rec) => (
                <div
                  key={rec.id}
                  className="p-5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 capitalize">
                        {rec.recordType.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-slate-400">{rec.createdAt.split('T')[0]}</span>
                    </div>

                    <h4 className="font-bold text-base text-slate-900 mb-1">{rec.title}</h4>
                    <div className="text-xs font-semibold text-slate-600 mb-2">
                      {language === 'ar' ? 'المريض:' : 'Patient:'} {rec.patientName}
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-100 mb-3 whitespace-pre-line">
                      {rec.details}
                    </p>

                    {rec.doctorNotes && (
                      <div className="text-xs text-amber-900 bg-amber-50/70 p-2.5 rounded-xl border border-amber-100 mb-2">
                        <strong>{language === 'ar' ? 'توصيات الطبيب:' : 'Doctor Commentary:'}</strong> {rec.doctorNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                    <span className="truncate">{rec.sourceFacility || 'منشأة معتمدة'}</span>
                    <span className="text-emerald-700 font-bold">{language === 'ar' ? 'موثق رسمياً' : 'Verified'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: SCHEDULE & CLINIC SETTINGS */}
      {activeTab === 'schedule' && (
        <form onSubmit={handleSaveProfileSettings} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-xl font-bold text-slate-900">
              {language === 'ar' ? 'إعدادات العيادة، أوقات العمل والأجور' : 'Clinic Hours, Address & Consultation Fees'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {language === 'ar'
                ? 'تحديث بيانات عيادتك، أيام الدوام، وأجور المعاينة لتمكين المرضى من الحجز بدقة.'
                : 'Configure clinic hours, active days, consultation fee, and location.'}
            </p>
          </div>

          {/* Doctor Profile Picture Upload */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-[#003366]/20 flex items-center justify-center shrink-0">
              {editProfileForm.photoURL ? (
                <img
                  src={editProfileForm.photoURL}
                  alt="Doctor"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Stethoscope size={32} className="text-slate-400" />
              )}
            </div>

            <div className="flex-1 text-center sm:text-start">
              <h4 className="font-bold text-sm text-slate-800">
                {language === 'ar' ? 'الصورة الشخصية والمهنية للطبيب' : 'Doctor Professional Profile Photo'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === 'ar'
                  ? 'تدعم صيغ JPG، PNG، WebP بحجم أقصى 5 ميغابايت (يتم ضغطها وتأمينها تلقائياً).'
                  : 'Supports JPG, PNG, WebP up to 5MB (auto-compressed securely).'}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <label className="px-3 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5">
                  <span>{language === 'ar' ? 'رفع صورة جديدة' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleDoctorPhotoChange}
                    className="hidden"
                  />
                </label>

                {editProfileForm.photoURL && (
                  <button
                    type="button"
                    onClick={() => setEditProfileForm(prev => ({ ...prev, photoURL: '' }))}
                    className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition-colors"
                  >
                    {language === 'ar' ? 'إزالة الصورة' : 'Remove Photo'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم المهني للطبيب *' : 'Doctor Full Professional Name *'}
              </label>
              <input
                type="text"
                required
                value={editProfileForm.fullName}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاختصاص الرئيسي *' : 'Medical Specialty *'}
              </label>
              <input
                type="text"
                required
                value={editProfileForm.specialty}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, specialty: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاختصاص الدقيق / الفرعي' : 'Subspecialty'}
              </label>
              <input
                type="text"
                value={editProfileForm.subspecialty}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, subspecialty: e.target.value })}
                placeholder={language === 'ar' ? 'مثال: قسطرة تداخلية، جراحة مناظير' : 'e.g. Interventional Cardiology'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'المؤهلات والشهادات *' : 'Qualifications & Fellowships *'}
              </label>
              <input
                type="text"
                required
                value={editProfileForm.qualifications}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, qualifications: e.target.value })}
                placeholder={language === 'ar' ? 'بورد عراقي / عربي، زميل كلية الجراحين الملكية' : 'Iraqi/Arab Board, FRCS'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'أجر المعاينة / الكشفية (دينار عراقي) *' : 'Consultation Fee (IQD) *'}
              </label>
              <input
                type="number"
                required
                min={0}
                step={5000}
                value={editProfileForm.consultationFee}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, consultationFee: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'المحافظة *' : 'Governorate *'}
              </label>
              <select
                value={editProfileForm.governorate}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, governorate: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] bg-white"
              >
                {governoratesList.map((gov) => (
                  <option key={gov} value={gov}>
                    {gov}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'عنوان العيادة التفصيلي *' : 'Detailed Clinic Address *'}
              </label>
              <input
                type="text"
                required
                value={editProfileForm.clinicAddress}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, clinicAddress: e.target.value })}
                placeholder={language === 'ar' ? 'بغداد، الحارثية، شارع الكندي، مجمع النخيل الطبي، الطابق الثالث' : 'Baghdad, Al-Kindi St, Al-Nakheel Complex'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الهاتف للعيادة *' : 'Clinic Phone *'}
              </label>
              <input
                type="tel"
                required
                value={editProfileForm.phone}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {language === 'ar' ? 'رقم الواتساب للاستفسارات' : 'WhatsApp Line'}
                </label>
                {editProfileForm.whatsapp && formatWhatsAppUrl(editProfileForm.whatsapp) && (
                  <a
                    href={formatWhatsAppUrl(editProfileForm.whatsapp)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <span>{language === 'ar' ? 'تجربة الرابط ↗' : 'Test Chat ↗'}</span>
                  </a>
                )}
              </div>
              <input
                type="tel"
                value={editProfileForm.whatsapp}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, whatsapp: e.target.value })}
                placeholder="07XXXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366] font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'ساعات الدوام اليومي *' : 'Working Hours Window *'}
              </label>
              <input
                type="text"
                required
                value={editProfileForm.workingHours}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, workingHours: e.target.value })}
                placeholder="4:00 PM - 9:00 PM"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رابط الموقع على خرائط Google' : 'Google Maps Location URL'}
              </label>
              <input
                type="url"
                value={editProfileForm.mapsUrl}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, mapsUrl: e.target.value })}
                placeholder="https://maps.google.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>

            {/* Days of Week Checkboxes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {language === 'ar' ? 'أيام الاستقبال بالعيادة:' : 'Active Clinic Days:'}
              </label>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => {
                  const isSelected = editProfileForm.workingDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDaySelection(day)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#003366] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'نبذة تعريفية للمرضى' : 'Doctor Bio & Summary'}
              </label>
              <textarea
                rows={3}
                value={editProfileForm.bio}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, bio: e.target.value })}
                placeholder={language === 'ar' ? 'اكتب نبذة عن مسيرتك المهنية ومجالات التخصص...' : 'Brief summary of expertise...'}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#003366]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              {language === 'ar' ? 'حالة الحساب وترخيص النقابة محمي وموثق سحابياً' : 'Protected accreditation fields cannot be self-elevated'}
            </span>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer shadow-md"
            >
              <Save size={16} />
              <span>{language === 'ar' ? 'حفظ إعدادات العيادة' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: SECRETARY ACCESS DELEGATION */}
      {activeTab === 'secretary' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {language === 'ar' ? 'إدارة تفويض وصلاحيات السكرتارية' : 'Clinic Secretary Delegations & Permissions'}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar'
                  ? 'منح وتعديل صلاحيات سكرتير العيادة لتنظيم المواعيد، استقبال المرضى، والربط مع المراكز.'
                  : 'Grant and revoke specific reception permissions to clinic assistants.'}
              </p>
            </div>

            <button
              onClick={() => setShowNewSecretaryModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus size={16} />
              <span>{language === 'ar' ? 'إضافة سكرتير مصرح' : 'Delegate Secretary'}</span>
            </button>
          </div>

          {delegations.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <h3 className="font-bold text-base text-slate-700">{language === 'ar' ? 'لا يوجد سكرتير مفوض حالياً' : 'No secretaries delegated'}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {language === 'ar'
                  ? 'يمكنك إضافة البريد الإلكتروني لمساعد العيادة لمنحه صلاحية إدارة طابور المرضى والحجوزات'
                  : 'Add your assistant’s email to delegate check-in and queue management'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {delegations.map((del) => (
                <div
                  key={del.id}
                  className="p-5 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">{del.secretaryName}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        del.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {del.status === 'active' ? (language === 'ar' ? 'مفعل' : 'Active') : (language === 'ar' ? 'معطل' : 'Revoked')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 font-mono mt-0.5">{del.secretaryEmail}</div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {del.permissions.map((p) => (
                        <span key={p} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                          {p === 'canManageAppointments' && (language === 'ar' ? 'إدارة المواعيد' : 'Manage Appointments')}
                          {p === 'canViewQueue' && (language === 'ar' ? 'طابور الانتظار' : 'Waiting Queue')}
                          {p === 'canCollectFees' && (language === 'ar' ? 'تسجيل الكشفيات' : 'Fees Ledger')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSecretary(del.id, del.status)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                        del.status === 'active'
                          ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      {del.status === 'active' ? (language === 'ar' ? 'تعليق الصلاحية' : 'Revoke') : (language === 'ar' ? 'إعادة التفعيل' : 'Activate')}
                    </button>
                    <button
                      onClick={() => handleDeleteSecretary(del.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="حذف التفويض"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ELECTRONIC PRESCRIPTIONS */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-6">
          {/* Header & Filter Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Pill className="text-emerald-600" size={22} />
                <h3 className="font-bold text-lg text-slate-900">
                  {language === 'ar' ? 'الوصفات الطبية الإلكترونية الموثقة (e-Prescriptions)' : 'Electronic Prescriptions'}
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'إصدار وتتبع الوصفات الرقمية المربوطة بالصيدليات المعتمدة مع منع الصرف المزدوج والطباعة النقابية الموحدة' 
                  : 'Manage tamper-proof digital prescriptions with syndicate layout and pharmacy integration'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewPrescriptionModal(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>{language === 'ar' ? 'إصدار وصفة جديدة' : 'New Prescription'}</span>
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            {[
              { id: 'all', labelAr: `الكل (${prescriptions.length})`, labelEn: 'All' },
              { id: 'sent', labelAr: `مرسلة للصيدلية (${prescriptions.filter(p => p.status === 'sent').length})`, labelEn: 'Sent' },
              { id: 'dispensed', labelAr: `تم الصرف (${prescriptions.filter(p => p.status === 'dispensed').length})`, labelEn: 'Dispensed' },
              { id: 'draft', labelAr: `مسودة (${prescriptions.filter(p => p.status === 'draft').length})`, labelEn: 'Draft' },
              { id: 'cancelled', labelAr: `ملغاة (${prescriptions.filter(p => p.status === 'cancelled').length})`, labelEn: 'Cancelled' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setPrescriptionFilter(f.id)}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                  prescriptionFilter === f.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {language === 'ar' ? f.labelAr : f.labelEn}
              </button>
            ))}
          </div>

          {/* Prescriptions List */}
          {filteredPrescriptions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <Pill size={40} className="mx-auto text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-700 mb-1">{language === 'ar' ? 'لا توجد وصفات إلكترونية مطابقة' : 'No prescriptions found'}</h4>
              <p className="text-xs text-slate-400 mb-4">{language === 'ar' ? 'يمكنك تحرير وصفة جديدة الآن وإرسالها مباشرة للصيدلية.' : 'Create a new prescription to get started.'}</p>
              <button
                onClick={() => setShowNewPrescriptionModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                {language === 'ar' ? 'إصدار وصفة الآن' : 'Create Rx'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPrescriptions.map((rx) => {
                const isDispensed = rx.status === 'dispensed';
                const isCancelled = rx.status === 'cancelled';
                return (
                  <div
                    key={rx.id}
                    className={`bg-white rounded-3xl p-6 border transition-all ${
                      isDispensed 
                        ? 'border-emerald-200 bg-emerald-50/20 shadow-xs' 
                        : isCancelled
                        ? 'border-red-200 bg-red-50/20 opacity-75'
                        : 'border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="font-mono text-xs font-black bg-[#003366] text-white px-2.5 py-1 rounded-lg">
                            {rx.prescriptionNumber}
                          </span>
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                            isDispensed
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : rx.status === 'sent'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : isCancelled
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {isDispensed && <CheckCircle2 size={13} />}
                            {rx.status === 'sent' && <Send size={13} />}
                            {isCancelled && <XCircle size={13} />}
                            <span>
                              {rx.status === 'sent' && (language === 'ar' ? 'مرسلة إلى الصيدلية' : 'Sent')}
                              {rx.status === 'received' && (language === 'ar' ? 'مستلمة بالصيدلية' : 'Received')}
                              {rx.status === 'accepted' && (language === 'ar' ? 'مقبولة وقيد التحضير' : 'Accepted')}
                              {rx.status === 'dispensed' && (language === 'ar' ? 'تم الصرف والتسليم' : 'Dispensed')}
                              {rx.status === 'cancelled' && (language === 'ar' ? 'ملغاة' : 'Cancelled')}
                              {rx.status === 'draft' && (language === 'ar' ? 'مسودة' : 'Draft')}
                            </span>
                          </span>

                          {isDispensed && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                              <Lock size={12} />
                              <span>{language === 'ar' ? 'مقفل أمنياً ضد الصرف المزدوج' : 'Locked'}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700 font-bold">
                          <span>{language === 'ar' ? 'المريض:' : 'Patient:'} {rx.patientName}</span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-xs text-slate-500">{rx.patientPhone}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs text-slate-500 font-normal">{new Date(rx.createdAt).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedPrescriptionForPdf(rx)}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Printer size={15} />
                          <span>{language === 'ar' ? 'معاينة / طباعة نقابية' : 'View / Print PDF'}</span>
                        </button>

                        {!isDispensed && !isCancelled && (
                          <button
                            onClick={() => handleCancelPrescription(rx.id)}
                            className="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title={language === 'ar' ? 'إلغاء الوصفة' : 'Cancel Rx'}
                          >
                            <XCircle size={15} />
                            <span>{language === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Rx Details & Drug list */}
                    <div className="mt-4 space-y-3">
                      {rx.diagnosis && (
                        <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                          <span className="font-bold text-slate-800">{language === 'ar' ? 'التشخيص الطبي:' : 'Diagnosis:'} </span>
                          <span>{rx.diagnosis}</span>
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-700 block">
                          {language === 'ar' ? `الأدوية المقررة (${rx.items.length}):` : `Prescribed Drugs (${rx.items.length}):`}
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {rx.items.map((item, idx) => (
                            <div key={idx} className="p-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 flex items-start gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                {idx + 1}
                              </div>
                              <div className="text-xs space-y-0.5 min-w-0 flex-1">
                                <div className="font-bold text-slate-900 truncate">
                                  {item.name} <span className="text-emerald-700 font-mono">({item.strength})</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {item.dosageForm} · {item.dosage} · {item.frequency}
                                </div>
                                <div className="text-[11px] text-slate-600">
                                  <span className="font-semibold">{language === 'ar' ? 'المدة:' : 'Duration:'}</span> {item.duration}
                                </div>
                                {item.instructions && (
                                  <div className="text-[11px] text-slate-500 italic bg-white p-1 rounded border border-slate-100">
                                    {item.instructions}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Dispensing Stamp if completed */}
                      {isDispensed && (
                        <div className="p-3 rounded-2xl bg-emerald-100/60 border border-emerald-300 text-emerald-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                          <div className="flex items-center gap-2 font-bold">
                            <ShieldCheck size={16} className="text-emerald-700" />
                            <span>
                              {language === 'ar' 
                                ? `تم الصرف بواسطة: ${rx.dispensedByName || rx.dispensedPharmacyName || 'صيدلية معتمدة'}` 
                                : `Dispensed by: ${rx.dispensedByName || rx.dispensedPharmacyName}`}
                            </span>
                          </div>
                          {rx.dispensedAt && (
                            <span className="font-mono text-[11px] text-emerald-800">
                              {new Date(rx.dispensedAt).toLocaleString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DIAGNOSTIC REFERRALS (LAB & RADIOLOGY) */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical className="text-purple-600" size={22} />
                <h3 className="font-bold text-lg text-slate-900">
                  {language === 'ar' ? 'التحويلات والفحوصات الطبية (Lab & Radiology Orders)' : 'Diagnostic Referrals & Orders'}
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                {language === 'ar' 
                  ? 'إرسال طلبات التحاليل المختبرية وفحوصات الأشعة والسونار ومتابعة النتائج والتقارير المرفقة مباشرة' 
                  : 'Order and monitor clinical laboratory tests and medical imaging studies directly'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setReferralSubTab('lab');
                  setShowNewLabOrderModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} />
                <span>{language === 'ar' ? '+ طلب تحاليل مختبر' : '+ Lab Order'}</span>
              </button>
              <button
                onClick={() => {
                  setReferralSubTab('radiology');
                  setShowNewRadOrderModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                <Scan size={16} />
                <span>{language === 'ar' ? '+ طلب أشعة وسونار' : '+ Imaging Order'}</span>
              </button>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              onClick={() => setReferralSubTab('lab')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                referralSubTab === 'lab'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FlaskConical size={15} />
              <span>{language === 'ar' ? `طلبات المختبر والتحاليل (${labOrders.length})` : `Lab Orders (${labOrders.length})`}</span>
            </button>
            <button
              onClick={() => setReferralSubTab('radiology')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                referralSubTab === 'radiology'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Scan size={15} />
              <span>{language === 'ar' ? `طلبات الأشعة والسونار (${radiologyOrders.length})` : `Radiology Orders (${radiologyOrders.length})`}</span>
            </button>
          </div>

          {/* LAB ORDERS LIST */}
          {referralSubTab === 'lab' && (
            <div className="space-y-4">
              {labOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <FlaskConical size={40} className="mx-auto text-slate-300 mb-3" />
                  <h4 className="font-bold text-slate-700 mb-1">{language === 'ar' ? 'لا توجد طلبات تحاليل مخبرية' : 'No lab orders'}</h4>
                  <p className="text-xs text-slate-400 mb-4">{language === 'ar' ? 'يمكنك إنشاء طلب فحص مخبري وربطه بمختبر معتمد.' : 'Create a new lab order to send to diagnostics lab.'}</p>
                  <button
                    onClick={() => setShowNewLabOrderModal(true)}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
                  >
                    {language === 'ar' ? 'إرسال طلب فحص مخبري' : 'New Lab Order'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {labOrders.map((ord) => {
                    const isCompleted = ord.status === 'completed';
                    const isCancelled = ord.status === 'cancelled';
                    return (
                      <div key={ord.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-black bg-purple-900 text-white px-2.5 py-1 rounded-lg">
                                {ord.orderNumber}
                              </span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : isCancelled
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {ord.status === 'new' && (language === 'ar' ? 'طلب جديد' : 'New')}
                                {ord.status === 'received' && (language === 'ar' ? 'تم الاستلام بالمختبر' : 'Received')}
                                {ord.status === 'in_progress' && (language === 'ar' ? 'العينة قيد التحليل' : 'In Progress')}
                                {ord.status === 'completed' && (language === 'ar' ? 'النتائج جاهزة وموثقة' : 'Completed')}
                                {ord.status === 'cancelled' && (language === 'ar' ? 'ملغي' : 'Cancelled')}
                              </span>

                              {ord.priority === 'urgent' && (
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                  {language === 'ar' ? 'عاجل (STAT)' : 'Urgent'}
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-800">
                              <span>{language === 'ar' ? 'المريض:' : 'Patient:'} {ord.patientName}</span>
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="font-mono text-xs text-slate-500">{ord.patientPhone}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isCompleted && !isCancelled && (
                              <button
                                onClick={() => handleCancelLabOrder(ord.id)}
                                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
                              >
                                {language === 'ar' ? 'إلغاء الطلب' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Indication and Target Lab */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="font-bold text-slate-700 block mb-0.5">{language === 'ar' ? 'المختبر المستهدف:' : 'Target Lab:'}</span>
                            <span className="text-slate-900 font-semibold">{ord.targetLabName || (language === 'ar' ? 'أي مختبر معتمد' : 'Any certified lab')}</span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="font-bold text-slate-700 block mb-0.5">{language === 'ar' ? 'دواعي الفحص السريرية:' : 'Indication:'}</span>
                            <span className="text-slate-900">{ord.clinicalIndication || (language === 'ar' ? 'فحص تشخيصي دوري' : 'Routine test')}</span>
                          </div>
                        </div>

                        {/* Tests List */}
                        <div>
                          <span className="text-xs font-bold text-slate-700 block mb-1.5">
                            {language === 'ar' ? 'التحاليل المطلوبة:' : 'Requested Tests:'}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {ord.tests.map((t, idx) => (
                              <span key={idx} className="px-3 py-1 rounded-xl bg-purple-50 text-purple-900 border border-purple-200 text-xs font-semibold">
                                {t.testName}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Result preview if completed */}
                        {isCompleted && ord.resultSummary && (
                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold text-emerald-900">
                              <CheckCircle2 size={16} className="text-emerald-700" />
                              <span>{language === 'ar' ? 'ملخص النتيجة الصادرة من المختبر:' : 'Lab Result Summary:'}</span>
                            </div>
                            <p className="text-emerald-800 font-medium">{ord.resultSummary}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* RADIOLOGY ORDERS LIST */}
          {referralSubTab === 'radiology' && (
            <div className="space-y-4">
              {radiologyOrders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                  <Scan size={40} className="mx-auto text-slate-300 mb-3" />
                  <h4 className="font-bold text-slate-700 mb-1">{language === 'ar' ? 'لا توجد طلبات أشعة وسونار' : 'No radiology orders'}</h4>
                  <p className="text-xs text-slate-400 mb-4">{language === 'ar' ? 'أرسل طلب فحص تصويري (أشعة، سونار، رنين، مفراس) لمركز الأشعة.' : 'Create an imaging referral to be sent to radiology center.'}</p>
                  <button
                    onClick={() => setShowNewRadOrderModal(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
                  >
                    {language === 'ar' ? 'إرسال طلب فحص تصويري' : 'New Imaging Order'}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {radiologyOrders.map((ord) => {
                    const isCompleted = ord.status === 'completed';
                    const isCancelled = ord.status === 'cancelled';
                    return (
                      <div key={ord.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono text-xs font-black bg-blue-900 text-white px-2.5 py-1 rounded-lg">
                                {ord.orderNumber}
                              </span>
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : ord.status === 'in_progress'
                                  ? 'bg-amber-100 text-amber-800'
                                  : isCancelled
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {ord.status === 'new' && (language === 'ar' ? 'طلب جديد' : 'New')}
                                {ord.status === 'received' && (language === 'ar' ? 'مستلم بمركز الأشعة' : 'Received')}
                                {ord.status === 'in_progress' && (language === 'ar' ? 'قيد التصوير' : 'In Progress')}
                                {ord.status === 'completed' && (language === 'ar' ? 'التقرير جاهز' : 'Completed')}
                                {ord.status === 'cancelled' && (language === 'ar' ? 'ملغي' : 'Cancelled')}
                              </span>

                              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs font-bold uppercase">
                                {ord.modality}
                              </span>

                              {ord.priority === 'urgent' && (
                                <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                                  {language === 'ar' ? 'عاجل (STAT)' : 'Urgent'}
                                </span>
                              )}
                            </div>

                            <div className="text-sm font-bold text-slate-800">
                              <span>{language === 'ar' ? 'المريض:' : 'Patient:'} {ord.patientName}</span>
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="font-mono text-xs text-slate-500">{ord.patientPhone}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isCompleted && !isCancelled && (
                              <button
                                onClick={() => handleCancelRadiologyOrder(ord.id)}
                                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs"
                              >
                                {language === 'ar' ? 'إلغاء الطلب' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Modality & Body Region */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="font-bold text-slate-700 block mb-0.5">{language === 'ar' ? 'نوع الفحص والتصوير:' : 'Modality:'}</span>
                            <span className="text-slate-900 font-semibold">{ord.modality} - {ord.bodyRegion}</span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="font-bold text-slate-700 block mb-0.5">{language === 'ar' ? 'المركز المستهدف:' : 'Target Center:'}</span>
                            <span className="text-slate-900 font-semibold">{ord.targetCenterName || (language === 'ar' ? 'أي مركز أشعة معتمد' : 'Any certified center')}</span>
                          </div>

                          <div className="bg-slate-50 p-3 rounded-2xl">
                            <span className="font-bold text-slate-700 block mb-0.5">{language === 'ar' ? 'التشخيص والدواعي:' : 'Clinical Indication:'}</span>
                            <span className="text-slate-900">{ord.clinicalIndication}</span>
                          </div>
                        </div>

                        {/* Report summary if completed */}
                        {isCompleted && ord.reportSummary && (
                          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold text-emerald-900">
                              <CheckCircle2 size={16} className="text-emerald-700" />
                              <span>{language === 'ar' ? 'تقرير أخصائي الأشعة:' : 'Radiologist Report Summary:'}</span>
                            </div>
                            <p className="text-emerald-800 font-medium">{ord.reportSummary}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL: NEW ELECTRONIC PRESCRIPTION */}
      {showNewPrescriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Pill size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {language === 'ar' ? 'إصدار وصفة طبية إلكترونية موثقة (Rx)' : 'New Electronic Prescription'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar' ? 'تشفير وحماية البيانات مع ربط مباشر بالصيدلية' : 'Secure e-Rx linked directly to pharmacy'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewPrescriptionModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateElectronicPrescription} className="space-y-4 text-xs">
              {/* Patient Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم المريض بالكامل *' : 'Patient Name *'}</label>
                  <input
                    type="text"
                    required
                    value={newRxPatientName}
                    onChange={(e) => setNewRxPatientName(e.target.value)}
                    placeholder={language === 'ar' ? 'سارة حيدر العراقي' : 'Patient full name'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#003366]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'رقم هاتف المريض *' : 'Patient Phone *'}</label>
                  <input
                    type="tel"
                    required
                    value={newRxPatientPhone}
                    onChange={(e) => setNewRxPatientPhone(e.target.value)}
                    placeholder="077XXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#003366]"
                  />
                </div>
              </div>

              {/* Diagnosis & Allergies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'التشخيص الطبي *' : 'Diagnosis *'}</label>
                  <input
                    type="text"
                    required
                    value={newRxDiagnosis}
                    onChange={(e) => setNewRxDiagnosis(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: التهاب الشعب الهوائية، ضغط شرياني...' : 'e.g. Hypertension'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'حساسية الأدوية المسجلة (إن وجدت)' : 'Allergies'}</label>
                  <input
                    type="text"
                    value={newRxAllergies}
                    onChange={(e) => setNewRxAllergies(e.target.value)}
                    placeholder={language === 'ar' ? 'مثال: بنسلين، سلفا (افصل بفاصلة)' : 'Penicillin, Sulfa'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              {/* Target Pharmacy */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الصيدلية المستهدفة للصرف' : 'Target Pharmacy'}</label>
                <select
                  value={newRxTargetPharmacyId}
                  onChange={(e) => {
                    setNewRxTargetPharmacyId(e.target.value);
                    const sel = facilitiesPharmacies.find(p => p.id === e.target.value);
                    setNewRxTargetPharmacyName(sel ? sel.name : '');
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="">{language === 'ar' ? '-- بدون تخصيص (يحددها المريض لاحقاً) --' : '-- Open / Patient Choice --'}</option>
                  {facilitiesPharmacies.map(pharm => (
                    <option key={pharm.id} value={pharm.id}>
                      {pharm.name} - {pharm.governorate} ({pharm.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* MEDICINE SEARCH & ADD SECTION */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Search size={14} className="text-[#003366]" />
                    <span>{language === 'ar' ? 'البحث الذكي عن الدواء وإضافته:' : 'Smart Medicine Search & Prescribe:'}</span>
                  </span>
                  <span className="text-[11px] text-slate-500">{language === 'ar' ? 'اكتب 3 أحرف فأكثر للبحث' : 'Min 3 chars'}</span>
                </div>

                <SmartMedicineSearch onSelectMedicine={handleSelectMedicineForRx} />

                {/* Selected Medicine Customization */}
                {selectedMedicineItem && (
                  <div className="p-3 bg-white rounded-xl border border-emerald-300 space-y-3 mt-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{selectedMedicineItem.name}</span>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {selectedMedicineItem.activeIngredient} · {selectedMedicineItem.strength} · {selectedMedicineItem.dosageForm}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                        {selectedMedicineItem.manufacturer || 'معتمد'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="block text-slate-600 font-bold mb-0.5">{language === 'ar' ? 'الجرعة:' : 'Dosage:'}</label>
                        <input
                          type="text"
                          value={currentDosage}
                          onChange={(e) => setCurrentDosage(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-0.5">{language === 'ar' ? 'التكرار:' : 'Frequency:'}</label>
                        <input
                          type="text"
                          value={currentFrequency}
                          onChange={(e) => setCurrentFrequency(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-0.5">{language === 'ar' ? 'المدة:' : 'Duration:'}</label>
                        <input
                          type="text"
                          value={currentDuration}
                          onChange={(e) => setCurrentDuration(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-bold mb-0.5">{language === 'ar' ? 'طريقة الاستخدام:' : 'Instructions:'}</label>
                        <input
                          type="text"
                          value={currentInstructions}
                          onChange={(e) => setCurrentInstructions(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedMedicineItem(null)}
                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs"
                      >
                        {language === 'ar' ? 'إلغاء الاختيار' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleAddMedicineItemToRx}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        <span>{language === 'ar' ? 'إضافة للوصفة' : 'Add to Rx'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Current Items List in Rx */}
                {newRxItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <span className="font-bold text-slate-700 block text-xs">
                      {language === 'ar' ? `الأدوية المضافة للوصفة (${newRxItems.length}):` : `Added Medicines (${newRxItems.length}):`}
                    </span>
                    {newRxItems.map((item, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 truncate">
                            {item.name} <span className="text-emerald-700 font-mono">({item.strength})</span>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.dosage} · {item.frequency} · {item.duration}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveRxItem(idx)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* General Instructions */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'إرشادات ونصائح عامة للمريض' : 'General Advice'}</label>
                <textarea
                  rows={2}
                  value={newRxGeneralInstructions}
                  onChange={(e) => setNewRxGeneralInstructions(e.target.value)}
                  placeholder={language === 'ar' ? 'توصيات الحمية، شرب السوائل، الراحة، أوقات المراجعة...' : 'Dietary advice, rest...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPrescriptionModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {language === 'ar' ? 'إصدار وتوثيق الوصفة' : 'Issue Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW LAB ORDER */}
      {showNewLabOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <FlaskConical size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {language === 'ar' ? 'طلب فحوصات وتحاليل مخبرية' : 'New Lab Referral Order'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar' ? 'تحديد التحاليل المطلوبة وتوجيه المريض للمختبر' : 'Order clinical lab tests'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewLabOrderModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLabOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم المريض *' : 'Patient Name *'}</label>
                  <input
                    type="text"
                    required
                    value={newLabPatientName}
                    onChange={(e) => setNewLabPatientName(e.target.value)}
                    placeholder={language === 'ar' ? 'سارة حيدر' : 'Patient name'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                  <input
                    type="tel"
                    value={newLabPatientPhone}
                    onChange={(e) => setNewLabPatientPhone(e.target.value)}
                    placeholder="07XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'درجة الأولوية' : 'Priority'}</label>
                  <select
                    value={newLabPriority}
                    onChange={(e) => setNewLabPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="normal">{language === 'ar' ? 'عادية (Routine)' : 'Normal'}</option>
                    <option value="urgent">{language === 'ar' ? 'عاجلة (STAT / Urgent)' : 'Urgent'}</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'المختبر المستهدف' : 'Target Lab'}</label>
                  <select
                    value={newLabTargetLabId}
                    onChange={(e) => {
                      setNewLabTargetLabId(e.target.value);
                      const l = facilitiesLabs.find(item => item.id === e.target.value);
                      setNewLabTargetLabName(l ? l.name : '');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">{language === 'ar' ? '-- أي مختبر معتمد --' : '-- Any Certified Lab --'}</option>
                    {facilitiesLabs.map(lab => (
                      <option key={lab.id} value={lab.id}>{lab.name} ({lab.governorate})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fasting & Indication */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'دواعي الفحص السريرية' : 'Clinical Indication'}</label>
                <input
                  type="text"
                  value={newLabClinicalIndication}
                  onChange={(e) => setNewLabClinicalIndication(e.target.value)}
                  placeholder={language === 'ar' ? 'اشتباه بفقر دم / متابعة دهون / فحص كلى' : 'Clinical reason'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              {/* Tests Checklist */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{language === 'ar' ? 'اختر التحاليل المطلوبة:' : 'Select Tests:'}</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
                  {[
                    'Complete Blood Count (CBC)',
                    'Lipid Profile (تحليل الدهون)',
                    'Fasting Blood Sugar (FBS)',
                    'HbA1c (السكر التراكمي)',
                    'Renal Function (وظائف الكلى)',
                    'Liver Function (وظائف الكبد)',
                    'Serum Ferritin (مخزون الحديد)',
                    'Thyroid TSH (الغدة الدرقية)',
                    'General Urine Exam (GUE)',
                    'Vitamin D (فيتامين د)'
                  ].map(test => {
                    const isChecked = newLabTestsList.includes(test);
                    return (
                      <label key={test} className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-200 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewLabTestsList(prev => [...prev, test]);
                            } else {
                              setNewLabTestsList(prev => prev.filter(t => t !== test));
                            }
                          }}
                          className="rounded text-purple-600"
                        />
                        <span className="truncate">{test}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewLabOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  {language === 'ar' ? 'إرسال طلب التحاليل' : 'Send Lab Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW RADIOLOGY ORDER */}
      {showNewRadOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <Scan size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {language === 'ar' ? 'طلب فحص شعاعي وسونار' : 'New Radiology Order'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === 'ar' ? 'توجيه المريض لمركز الأشعة مع تحديد التقنية ومنطقة الفحص' : 'Order medical imaging and ultrasound'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewRadOrderModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRadiologyOrder} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم المريض *' : 'Patient Name *'}</label>
                  <input
                    type="text"
                    required
                    value={newRadPatientName}
                    onChange={(e) => setNewRadPatientName(e.target.value)}
                    placeholder={language === 'ar' ? 'سارة حيدر' : 'Patient name'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                  <input
                    type="tel"
                    value={newRadPatientPhone}
                    onChange={(e) => setNewRadPatientPhone(e.target.value)}
                    placeholder="07XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'نوع التصوير (Modality) *' : 'Modality *'}</label>
                  <select
                    value={newRadModality}
                    onChange={(e) => setNewRadModality(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white font-semibold"
                  >
                    <option value="ultrasound">{language === 'ar' ? 'سونار / موجات فوق صوتية (Ultrasound)' : 'Ultrasound'}</option>
                    <option value="xray">{language === 'ar' ? 'أشعة سينية رقمية (Digital X-Ray)' : 'X-Ray'}</option>
                    <option value="ct">{language === 'ar' ? 'مفراس حلزوني مقطعي (CT Scan)' : 'CT Scan'}</option>
                    <option value="mri">{language === 'ar' ? 'رنين مغناطيسي (MRI)' : 'MRI'}</option>
                    <option value="echo">{language === 'ar' ? 'إيكو القلب (Echocardiography)' : 'Echocardiography'}</option>
                    <option value="mammogram">{language === 'ar' ? 'ماموغرام الثدي (Mammography)' : 'Mammography'}</option>
                    <option value="dexa">{language === 'ar' ? 'هشاشة العظام (DEXA Scan)' : 'DEXA Scan'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'منطقة الجسم *' : 'Body Region *'}</label>
                  <input
                    type="text"
                    required
                    value={newRadBodyRegion}
                    onChange={(e) => setNewRadBodyRegion(e.target.value)}
                    placeholder={language === 'ar' ? 'البطن والحوض، الصدر، الفقرات القطنية...' : 'e.g. Abdomen & Pelvis'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'المركز المستهدف' : 'Target Center'}</label>
                  <select
                    value={newRadTargetCenterId}
                    onChange={(e) => {
                      setNewRadTargetCenterId(e.target.value);
                      const c = facilitiesRadCenters.find(item => item.id === e.target.value);
                      setNewRadTargetCenterName(c ? c.name : '');
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="">{language === 'ar' ? '-- أي مركز أشعة معتمد --' : '-- Any Certified Center --'}</option>
                    {facilitiesRadCenters.map(center => (
                      <option key={center.id} value={center.id}>{center.name} ({center.governorate})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الأولوية' : 'Priority'}</label>
                  <select
                    value={newRadPriority}
                    onChange={(e) => setNewRadPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="normal">{language === 'ar' ? 'عادية (Routine)' : 'Normal'}</option>
                    <option value="urgent">{language === 'ar' ? 'عاجلة (STAT / Urgent)' : 'Urgent'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'التشخيص والدواعي السريرية *' : 'Clinical Indication *'}</label>
                <textarea
                  rows={2}
                  required
                  value={newRadClinicalIndication}
                  onChange={(e) => setNewRadClinicalIndication(e.target.value)}
                  placeholder={language === 'ar' ? 'ألم في الجانب الأيمن العلوي، اشتباه بحصوات المرارة...' : 'Clinical indication'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'تعليمات التحضير للمريض' : 'Preparation Instructions'}</label>
                <input
                  type="text"
                  value={newRadPrepInstructions}
                  onChange={(e) => setNewRadPrepInstructions(e.target.value)}
                  placeholder={language === 'ar' ? 'شرب كمية وفيرة من الماء، صيام 6 ساعات...' : 'Drink water, fast 6 hrs...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRadOrderModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {language === 'ar' ? 'إرسال طلب الأشعة' : 'Send Imaging Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRESCRIPTION PRINT / PDF */}
      {selectedPrescriptionForPdf && (
        <PrescriptionPdfModal
          prescription={selectedPrescriptionForPdf}
          onClose={() => setSelectedPrescriptionForPdf(null)}
        />
      )}

      {/* MODAL: NEW APPOINTMENT */}
      {showNewAppointmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-lg text-slate-900">
                {language === 'ar' ? 'تسجيل موعد استشارة جديدة' : 'Register New Consultation'}
              </h3>
              <button
                onClick={() => setShowNewAppointmentModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم المريض *' : 'Patient Name *'}</label>
                <input
                  type="text"
                  required
                  value={newApptData.patientName}
                  onChange={(e) => setNewApptData({ ...newApptData, patientName: e.target.value })}
                  placeholder={language === 'ar' ? 'محمد جاسم حسين' : 'Patient Full Name'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#003366]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'رقم الهاتف (واتساب)' : 'Phone Number'}</label>
                <input
                  type="tel"
                  value={newApptData.patientPhone}
                  onChange={(e) => setNewApptData({ ...newApptData, patientPhone: e.target.value })}
                  placeholder="07XXXXXXXXX"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-[#003366]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'التاريخ *' : 'Date *'}</label>
                  <input
                    type="date"
                    required
                    value={newApptData.date}
                    onChange={(e) => setNewApptData({ ...newApptData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الوقت *' : 'Time *'}</label>
                  <input
                    type="time"
                    required
                    value={newApptData.timeSlot}
                    onChange={(e) => setNewApptData({ ...newApptData, timeSlot: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'نوع الكشفية' : 'Visit Type'}</label>
                <select
                  value={newApptData.consultationType}
                  onChange={(e) => setNewApptData({ ...newApptData, consultationType: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="in_person">{language === 'ar' ? 'معاينة جديدة بالعيادة' : 'New In-Person Visit'}</option>
                  <option value="followup">{language === 'ar' ? 'مراجعة وتدقيق تحاليل' : 'Follow-up'}</option>
                  <option value="urgent">{language === 'ar' ? 'حالة مستعجلة' : 'Urgent Case'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'ملاحظات أولية' : 'Notes'}</label>
                <textarea
                  rows={2}
                  value={newApptData.notes}
                  onChange={(e) => setNewApptData({ ...newApptData, notes: e.target.value })}
                  placeholder={language === 'ar' ? 'أعراض، تاريخ سابق...' : 'Symptoms or history...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewAppointmentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#c4152e] text-white font-bold"
                >
                  {language === 'ar' ? 'حفظ وتأكيد الموعد' : 'Save & Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULE */}
      {reschedulingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="font-bold text-base text-slate-900 mb-2">
              {language === 'ar' ? `إعادة جدولة موعد: ${reschedulingAppt.patientName}` : `Reschedule: ${reschedulingAppt.patientName}`}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'ar' ? `الموعد الحالي: ${reschedulingAppt.date} الساعة ${reschedulingAppt.timeSlot}` : `Current: ${reschedulingAppt.date} at ${reschedulingAppt.timeSlot}`}
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'الموعد البديل المقترح *' : 'Proposed New Date/Time *'}</label>
                <input
                  type="text"
                  required
                  placeholder={language === 'ar' ? 'مثال: الأربعاء 2026/10/28 الساعة 6:00 م' : 'e.g. Wednesday Oct 28 at 6:00 PM'}
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, newDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'السبب' : 'Reason'}</label>
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'عملية طارئة / مؤتمر طبي' : 'Urgent surgical case'}
                  value={rescheduleData.reason}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReschedulingAppt(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReschedule}
                  className="px-5 py-2 rounded-xl bg-purple-600 text-white font-bold"
                >
                  {language === 'ar' ? 'إرسال التعديل' : 'Save Reschedule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW MEDICAL RECORD */}
      {showNewRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-lg text-slate-900">
                {language === 'ar' ? 'توثيق تقرير طبي / روشتة إلكترونية' : 'Add Medical Record / Prescription'}
              </h3>
              <button
                onClick={() => setShowNewRecordModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMedicalRecord} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم المريض *' : 'Patient Name *'}</label>
                <input
                  type="text"
                  required
                  value={newRecordData.patientName}
                  onChange={(e) => setNewRecordData({ ...newRecordData, patientName: e.target.value })}
                  placeholder={language === 'ar' ? 'اسم المراجع' : 'Patient Name'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'نوع السجل *' : 'Record Type *'}</label>
                  <select
                    value={newRecordData.recordType}
                    onChange={(e) => setNewRecordData({ ...newRecordData, recordType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                  >
                    <option value="clinical_note">{language === 'ar' ? 'تشخيص وملاحظات سريرية' : 'Clinical Diagnosis'}</option>
                    <option value="prescription">{language === 'ar' ? 'روشتة علاجية' : 'e-Prescription'}</option>
                    <option value="lab_result">{language === 'ar' ? 'نتائج فحص مخبري' : 'Lab Result'}</option>
                    <option value="radiology_report">{language === 'ar' ? 'تقرير أشعة وسونار' : 'Radiology Report'}</option>
                    <option value="diagnostic_summary">{language === 'ar' ? 'ملخص خروج / تقرير شامل' : 'Summary Report'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'عنوان التقرير *' : 'Title *'}</label>
                  <input
                    type="text"
                    required
                    value={newRecordData.title}
                    onChange={(e) => setNewRecordData({ ...newRecordData, title: e.target.value })}
                    placeholder={language === 'ar' ? 'مثال: فحص وظائف الكبد / روشتة ضغط' : 'e.g. ECG Analysis'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'تفاصيل التقرير والتشخيص / العلاج *' : 'Clinical Details & Prescribed Drugs *'}</label>
                <textarea
                  rows={4}
                  required
                  value={newRecordData.details}
                  onChange={(e) => setNewRecordData({ ...newRecordData, details: e.target.value })}
                  placeholder={language === 'ar' ? 'التشخيص، الجرعات، التوصيات الطبية...' : 'Diagnosis, dosage, clinical findings...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'المنشأة المصدرة' : 'Facility'}</label>
                <input
                  type="text"
                  value={newRecordData.sourceFacility}
                  onChange={(e) => setNewRecordData({ ...newRecordData, sourceFacility: e.target.value })}
                  placeholder={doctorProfile?.clinicAddress || 'عيادة الطبيب'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewRecordModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003366] text-white font-bold"
                >
                  {language === 'ar' ? 'حفظ السجل في الأرشيف' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NEW SECRETARY DELEGATION */}
      {showNewSecretaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-slate-200 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900 mb-1">
              {language === 'ar' ? 'تفويض سكرتير عيادة جديد' : 'Delegate Clinic Secretary'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'ar' ? 'أدخل البريد الإلكتروني لمساعد العيادة وحدد الصلاحيات الممنوحة.' : 'Specify assistant email and assign operational permissions.'}
            </p>

            <form onSubmit={handleCreateSecretaryDelegation} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'البريد الإلكتروني للسكرتير *' : 'Secretary Email *'}</label>
                <input
                  type="email"
                  required
                  value={newSecretaryData.secretaryEmail}
                  onChange={(e) => setNewSecretaryData({ ...newSecretaryData, secretaryEmail: e.target.value })}
                  placeholder="assistant@gmail.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{language === 'ar' ? 'اسم السكرتير / المساعد' : 'Secretary Name'}</label>
                <input
                  type="text"
                  value={newSecretaryData.secretaryName}
                  onChange={(e) => setNewSecretaryData({ ...newSecretaryData, secretaryName: e.target.value })}
                  placeholder={language === 'ar' ? 'سارة علي' : 'Assistant Name'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block font-bold text-slate-700">{language === 'ar' ? 'الصلاحيات الممنوحة:' : 'Assigned Permissions:'}</label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSecretaryData.canManageAppointments}
                    onChange={(e) => setNewSecretaryData({ ...newSecretaryData, canManageAppointments: e.target.checked })}
                    className="rounded text-[#003366]"
                  />
                  <span>{language === 'ar' ? 'إدارة وتأكيد المواعيد الهاتفية والعيادية' : 'Manage & Confirm Appointments'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSecretaryData.canViewQueue}
                    onChange={(e) => setNewSecretaryData({ ...newSecretaryData, canViewQueue: e.target.checked })}
                    className="rounded text-[#003366]"
                  />
                  <span>{language === 'ar' ? 'إدارة طابور الانتظار وتأكيد وصول المرضى' : 'Manage Waiting Room Queue'}</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newSecretaryData.canCollectFees}
                    onChange={(e) => setNewSecretaryData({ ...newSecretaryData, canCollectFees: e.target.checked })}
                    className="rounded text-[#003366]"
                  />
                  <span>{language === 'ar' ? 'تسجيل إيصالات الكشفية والدفع' : 'Register Clinic Fees & Receipts'}</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSecretaryModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-bold"
                >
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#003366] text-white font-bold"
                >
                  {language === 'ar' ? 'منح التفويض' : 'Grant Delegation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
