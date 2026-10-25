import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { auth, db, googleProvider, validateFirestoreConnection, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, AccountStatus } from '../types';
import firebaseConfig from '@/firebase-applet-config.json';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  isAdmin: boolean;
  needsOnboarding: boolean;
  unauthorizedDomainDetected: boolean;
  showDomainHelp: boolean;
  setShowDomainHelp: (val: boolean) => void;
  isDemoMode: boolean;
  currentHostname: string;
  firebaseProjectId: string;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string, role: UserRole, phone?: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInAsDemoUser: (role: UserRole, customName?: string) => Promise<void>;
  exitDemoMode: () => void;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
  registerAsPatient: (displayName?: string, phone?: string) => Promise<void>;
  applyForProfessionalRole: (payload: {
    role: UserRole;
    displayName: string;
    licenseNumber: string;
    facilityName: string;
    governorate: string;
    phone: string;
  }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserStatusByAdmin: (targetUid: string, newStatus: AccountStatus) => Promise<void>;
  fetchPendingUsersForAdmin: () => Promise<UserProfile[]>;
}

const SUPER_ADMIN_EMAIL = 'bcgmoc@gmail.com';
const SUPER_ADMIN_EMAILS = ['bcgmoc@gmail.com', 'mustfa200633@gmail.com'];
const DEMO_STORAGE_KEY = 'm737_demo_role_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to construct mock User conforming to Firebase User interface for sandbox previews
const createDemoFirebaseUser = (profile: UserProfile): User => {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: profile.createdAt || new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    providerData: [
      {
        providerId: 'google.com',
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        phoneNumber: profile.phone || null,
        photoURL: null,
      },
    ],
    refreshToken: 'demo-refresh-token',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'demo-token',
    getIdTokenResult: async () => ({
      token: 'demo-token',
      authTime: '0',
      issuedAtTime: '0',
      expirationTime: '9999999999',
      signInProvider: 'google.com',
      signInSecondFactor: null,
      claims: { email: profile.email },
    }),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: profile.phone || null,
    photoURL: null,
    providerId: 'firebase',
  } as unknown as User;
};

// Preset clinical Iraqi profiles for sandbox testing
const getPresetDemoProfile = (role: UserRole, customName?: string): UserProfile => {
  const now = new Date().toISOString();
  switch (role) {
    case 'super_admin':
      return {
        uid: 'demo_super_admin_bcgmoc',
        email: SUPER_ADMIN_EMAIL,
        displayName: customName || 'المدير العام المعتمد (Super Admin)',
        role: 'super_admin',
        status: 'approved',
        facilityName: 'إدارة منصة M737 الطبية العراقية المعتمدة',
        governorate: 'بغداد (Baghdad)',
        phone: '07701234567',
        createdAt: now,
        updatedAt: now,
      };
    case 'doctor':
      return {
        uid: 'demo_doctor_ahmed',
        email: 'dr.ahmed.rafidain@m737.iq',
        displayName: customName || 'د. أحمد الرافدين (استشاري باطنية وقلبية)',
        role: 'doctor',
        status: 'approved',
        licenseNumber: 'IQ-MED-94812',
        facilityName: 'عيادة الرافدين الاستشارية التخصصية',
        governorate: 'بغداد (Baghdad)',
        phone: '07801122334',
        createdAt: now,
        updatedAt: now,
      };
    case 'laboratory':
      return {
        uid: 'demo_lab_baghdad',
        email: 'lab.baghdad@m737.iq',
        displayName: customName || 'مختبر بغداد المركزي للتحليلات التخصصية',
        role: 'laboratory',
        status: 'approved',
        licenseNumber: 'IQ-LAB-44102',
        facilityName: 'مختبر بغداد المركزي التخصصي',
        governorate: 'بغداد (Baghdad)',
        phone: '07712233445',
        createdAt: now,
        updatedAt: now,
      };
    case 'radiology_center':
      return {
        uid: 'demo_radiology_dijla',
        email: 'rad.dijla@m737.iq',
        displayName: customName || 'مركز دجلة التخصصي للأشعة والرنين',
        role: 'radiology_center',
        status: 'approved',
        licenseNumber: 'IQ-RAD-77291',
        facilityName: 'مركز دجلة للأشعة المقطعية والرنين المغناطيسي',
        governorate: 'بغداد (Baghdad)',
        phone: '07723344556',
        createdAt: now,
        updatedAt: now,
      };
    case 'pharmacy':
      return {
        uid: 'demo_pharmacy_amal',
        email: 'pharmacy.amal@m737.iq',
        displayName: customName || 'صيدلية الأمل المعتمدة',
        role: 'pharmacy',
        status: 'approved',
        licenseNumber: 'IQ-PHARM-11094',
        facilityName: 'صيدلية الأمل المركزية',
        governorate: 'بغداد (Baghdad)',
        phone: '07814455667',
        createdAt: now,
        updatedAt: now,
      };
    case 'wholesaler':
      return {
        uid: 'demo_wholesaler_samarra',
        email: 'wholesaler.samarra@m737.iq',
        displayName: customName || 'مذخر سامراء العلمي الحديث لتجارة الأدوية والمستلزمات الطبية',
        role: 'wholesaler',
        status: 'approved',
        licenseNumber: 'IQ-WHOLE-88301',
        facilityName: 'مذخر سامراء العلمي للأدوية والمستلزمات',
        governorate: 'بغداد (Baghdad)',
        phone: '07709988776',
        createdAt: now,
        updatedAt: now,
      };
    case 'secretary':
      return {
        uid: 'demo_secretary_ansam',
        email: 'sec.rafidain@m737.iq',
        displayName: customName || 'أنسام علي (سكرتارية عيادة د. أحمد)',
        role: 'secretary',
        status: 'approved',
        facilityName: 'عيادة الرافدين الاستشارية',
        governorate: 'بغداد (Baghdad)',
        phone: '07826677889',
        createdAt: now,
        updatedAt: now,
      };
    case 'patient':
    default:
      return {
        uid: 'demo_patient_sara',
        email: 'patient.iraqi@m737.iq',
        displayName: customName || 'سارة حيدر العراقي',
        role: 'patient',
        status: 'approved',
        facilityName: '',
        governorate: 'بغداد (Baghdad)',
        phone: '07705566778',
        createdAt: now,
        updatedAt: now,
      };
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [unauthorizedDomainDetected, setUnauthorizedDomainDetected] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseProjectId = firebaseConfig.projectId || 'operating-league-dv9wh';

  // Validate connection on boot
  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      const isVerifiedSuperAdminEmail = 
        Boolean(firebaseUser.emailVerified) &&
        Boolean(firebaseUser.email) &&
        SUPER_ADMIN_EMAILS.includes(firebaseUser.email!.trim().toLowerCase());

      let hasAdminDoc = false;
      try {
        const adminDocRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminDocRef);
        hasAdminDoc = adminSnap.exists();
      } catch {
        hasAdminDoc = false;
      }

      const isUserAdmin = hasAdminDoc || isVerifiedSuperAdminEmail;
      setIsAdmin(isUserAdmin);

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        if (isVerifiedSuperAdminEmail && (profile.role !== 'super_admin' || profile.status !== 'approved')) {
          const now = new Date().toISOString();
          const elevatedProfile: UserProfile = {
            ...profile,
            role: 'super_admin',
            status: 'approved',
            updatedAt: now,
          };
          await setDoc(userDocRef, elevatedProfile, { merge: true });
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'super_admin',
            grantedAt: now,
          }, { merge: true });
          setUserProfile(elevatedProfile);
          setIsAdmin(true);
        } else {
          setUserProfile(profile);
          if (profile.role === 'super_admin' || isVerifiedSuperAdminEmail) {
            setIsAdmin(true);
          }
        }
        setNeedsOnboarding(false);
      } else {
        // If user is verified super admin bootstrap
        if (isVerifiedSuperAdminEmail) {
          const now = new Date().toISOString();
          const adminProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || SUPER_ADMIN_EMAIL,
            displayName: firebaseUser.displayName || 'Super Administrator',
            role: 'super_admin',
            status: 'approved',
            createdAt: now,
            updatedAt: now,
          };

          // Save admin record and user profile
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'super_admin',
            grantedAt: now,
          });

          await setDoc(userDocRef, adminProfile);
          setUserProfile(adminProfile);
          setIsAdmin(true);
          setNeedsOnboarding(false);
        } else {
          setUserProfile(null);
          setNeedsOnboarding(true);
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching user profile:', err);
      // Handled gracefully without crashing app
      setAuthError(err instanceof Error ? err.message : 'Failed to retrieve profile');
    }
  };

  // Restore saved demo session on boot if no real Firebase user is signed in
  useEffect(() => {
    const savedDemoRole = localStorage.getItem(DEMO_STORAGE_KEY) as UserRole | null;
    if (savedDemoRole && !auth.currentUser) {
      const demoProfile = getPresetDemoProfile(savedDemoRole);
      const demoUser = createDemoFirebaseUser(demoProfile);
      setUser(demoUser);
      setUserProfile(demoProfile);
      setIsAdmin(demoProfile.role === 'super_admin');
      setIsDemoMode(true);
      setNeedsOnboarding(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        localStorage.removeItem(DEMO_STORAGE_KEY);
        setIsDemoMode(false);
        setUser(currentUser);
        await loadUserProfile(currentUser);
        setLoading(false);
      } else {
        const savedDemoRole = localStorage.getItem(DEMO_STORAGE_KEY) as UserRole | null;
        if (savedDemoRole) {
          const demoProfile = getPresetDemoProfile(savedDemoRole);
          const demoUser = createDemoFirebaseUser(demoProfile);
          setUser(demoUser);
          setUserProfile(demoProfile);
          setIsAdmin(demoProfile.role === 'super_admin');
          setIsDemoMode(true);
          setNeedsOnboarding(false);
        } else {
          setUser(null);
          setUserProfile(null);
          setIsAdmin(false);
          setIsDemoMode(false);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        localStorage.removeItem(DEMO_STORAGE_KEY);
        setIsDemoMode(false);
        setUnauthorizedDomainDetected(false);
        setShowDomainHelp(false);
        await loadUserProfile(result.user);
      }
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : 'Google sign-in failed';
      const errorCode = (typeof err === 'object' && err !== null && 'code' in err) 
        ? String((err as { code: unknown }).code) 
        : '';

      const isDomainUnauthorized = 
        errorCode === 'auth/unauthorized-domain' || 
        rawError.includes('auth/unauthorized-domain');

      if (isDomainUnauthorized) {
        setUnauthorizedDomainDetected(true);
        setShowDomainHelp(true);
        const detailedMsg = `Firebase: Error (auth/unauthorized-domain). نطاق المعاينة السحابي (${window.location.hostname}) غير مضاف في قائمة النطاقات المصرح بها في Firebase Console. يمكنك نسخه وإضافته فوراً أو استخدام وضع التجربة والمعاينة السريع (Sandbox Mode).`;
        console.warn('Firebase Auth Unauthorized Domain detected:', detailedMsg);
        setAuthError(detailedMsg);
      } else {
        console.error('Authentication Error:', rawError);
        setAuthError(rawError);
      }
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), pass);
      if (result.user) {
        localStorage.removeItem(DEMO_STORAGE_KEY);
        setIsDemoMode(false);
        setUnauthorizedDomainDetected(false);
        setShowDomainHelp(false);
        await loadUserProfile(result.user);
      }
    } catch (err: unknown) {
      console.error('Email Sign-In Error:', err);
      const code = (typeof err === 'object' && err !== null && 'code' in err)
        ? String((err as { code: unknown }).code)
        : '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setAuthError('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.');
      } else if (code === 'auth/invalid-email') {
        setAuthError('صيغة البريد الإلكتروني غير صالحة.');
      } else if (code === 'auth/too-many-requests') {
        setAuthError('تم حظر المحاولات مؤقتاً بسبب تكرار المحاولات الخاطئة. حاول لاحقاً.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'فشل تسجيل الدخول بالبريد الإلكتروني');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string, 
    pass: string, 
    displayName: string, 
    role: UserRole, 
    phone?: string
  ) => {
    setLoading(true);
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const user = result.user;
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      const isVerifiedSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(email.trim().toLowerCase());
      const effectiveRole: UserRole = isVerifiedSuperAdminEmail ? 'super_admin' : role;
      const effectiveStatus: AccountStatus = (effectiveRole === 'patient' || effectiveRole === 'super_admin') 
        ? 'approved' 
        : 'pending';

      const now = new Date().toISOString();
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || email.trim(),
        displayName: displayName || user.email?.split('@')[0] || 'User',
        role: effectiveRole,
        status: effectiveStatus,
        phone: phone || '',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), profile);

      if (effectiveRole === 'super_admin' || isVerifiedSuperAdminEmail) {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: user.email,
          role: 'super_admin',
          grantedAt: now,
        }, { merge: true });
        setIsAdmin(true);
      }

      setUserProfile(profile);
      setNeedsOnboarding(false);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsDemoMode(false);
    } catch (err: unknown) {
      console.error('Email Sign-Up Error:', err);
      const code = (typeof err === 'object' && err !== null && 'code' in err)
        ? String((err as { code: unknown }).code)
        : '';
      if (code === 'auth/email-already-in-use') {
        setAuthError('هذا البريد الإلكتروني مسجل مسبقاً. يمكنك تسجيل الدخول مباشرة.');
      } else if (code === 'auth/weak-password') {
        setAuthError('كلمة المرور ضعيفة. يجب أن تتكون من 6 أحرف على الأقل.');
      } else if (code === 'auth/invalid-email') {
        setAuthError('صيغة البريد الإلكتروني غير صالحة.');
      } else {
        setAuthError(err instanceof Error ? err.message : 'فشل إنشاء الحساب');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoading(true);
    setAuthError(null);
    const trimmedEmail = email ? email.trim() : '';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail) {
      const errText = 'يرجى إدخال عنوان البريد الإلكتروني أولاً.';
      setAuthError(errText);
      setLoading(false);
      throw new Error(errText);
    }
    if (!emailRegex.test(trimmedEmail)) {
      const errText = 'صيغة البريد الإلكتروني غير صالحة. يرجى كتابة بريد إلكتروني صحيح (مثال: user@example.com).';
      setAuthError(errText);
      setLoading(false);
      throw new Error(errText);
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
    } catch (err: unknown) {
      console.error('Password Reset Error:', err);
      const code = (typeof err === 'object' && err !== null && 'code' in err)
        ? String((err as { code: unknown }).code)
        : '';
      let userFriendlyMsg = 'فشل إرسال رابط استعادة كلمة المرور، يرجى المحاولة لاحقاً.';
      if (code === 'auth/user-not-found') {
        userFriendlyMsg = 'لم يتم العثور على أي حساب مسجل بهذا البريد الإلكتروني في النظام.';
      } else if (code === 'auth/invalid-email') {
        userFriendlyMsg = 'صيغة البريد الإلكتروني غير صالحة.';
      } else if (code === 'auth/missing-email') {
        userFriendlyMsg = 'يرجى إدخال عنوان البريد الإلكتروني.';
      } else if (code === 'auth/too-many-requests') {
        userFriendlyMsg = 'تم حظر إرسال الطلبات مؤقتاً بسبب تكرار المحاولات. يرجى الانتظار بضع دقائق ثم المحاولة مجدداً.';
      } else if (code === 'auth/network-request-failed') {
        userFriendlyMsg = 'تعذر الاتصال بخوادم المصادقة. يرجى التحقق من اتصال الإنترنت والمحاولة ثانية.';
      } else if (err instanceof Error) {
        userFriendlyMsg = err.message;
      }
      setAuthError(userFriendlyMsg);
      throw new Error(userFriendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  const signInAsDemoUser = async (role: UserRole, customName?: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const demoProfile = getPresetDemoProfile(role, customName);
      const demoUser = createDemoFirebaseUser(demoProfile);
      localStorage.setItem(DEMO_STORAGE_KEY, role);
      setUser(demoUser);
      setUserProfile(demoProfile);
      setIsAdmin(role === 'super_admin');
      setIsDemoMode(true);
      setNeedsOnboarding(false);
    } finally {
      setLoading(false);
    }
  };

  const exitDemoMode = () => {
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setIsDemoMode(false);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setNeedsOnboarding(false);
  };

  const signOut = async () => {
    setLoading(true);
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
      setIsDemoMode(false);
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      setIsAdmin(false);
      setNeedsOnboarding(false);
      setAuthError(null);
    } catch (err: unknown) {
      console.error('Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const registerAsPatient = async (displayName?: string, phone?: string) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setAuthError(null);
    try {
      const now = new Date().toISOString();
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName || user.displayName || 'Patient',
        role: 'patient',
        status: 'approved', // Patient access is free and immediately available
        phone: phone || '',
        createdAt: now,
        updatedAt: now,
      };

      if (!isDemoMode) {
        await setDoc(doc(db, 'users', user.uid), profile);
      }
      setUserProfile(profile);
      setNeedsOnboarding(false);
    } catch (err: unknown) {
      if (isDemoMode) {
        // In demo mode, bypass remote write error
        setNeedsOnboarding(false);
      } else {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyForProfessionalRole = async (payload: {
    role: UserRole;
    displayName: string;
    licenseNumber: string;
    facilityName: string;
    governorate: string;
    phone: string;
  }) => {
    if (!user) throw new Error('User must be authenticated');
    setLoading(true);
    setAuthError(null);
    try {
      const now = new Date().toISOString();
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: payload.displayName,
        role: payload.role,
        status: isDemoMode ? 'approved' : 'pending',
        licenseNumber: payload.licenseNumber,
        facilityName: payload.facilityName,
        governorate: payload.governorate,
        phone: payload.phone,
        createdAt: now,
        updatedAt: now,
      };

      if (!isDemoMode) {
        await setDoc(doc(db, 'users', user.uid), profile);
      }
      setUserProfile(profile);
      setNeedsOnboarding(false);
    } catch (err: unknown) {
      if (isDemoMode) {
        setNeedsOnboarding(false);
      } else {
        handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user && !isDemoMode) {
      await loadUserProfile(user);
    }
  };

  const updateUserStatusByAdmin = async (targetUid: string, newStatus: AccountStatus) => {
    if (!isAdmin) throw new Error('Unauthorized administrative action');
    try {
      if (!isDemoMode) {
        const targetRef = doc(db, 'users', targetUid);
        await updateDoc(targetRef, {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        });
      }
      if (user && targetUid === user.uid) {
        await refreshProfile();
      }
    } catch (err: unknown) {
      if (!isDemoMode) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
      }
    }
  };

  const fetchPendingUsersForAdmin = async (): Promise<UserProfile[]> => {
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      const usersCol = collection(db, 'users');
      const snap = await getDocs(usersCol);
      return snap.docs.map((d) => d.data() as UserProfile);
    } catch (err: unknown) {
      if (isDemoMode) {
        return [
          getPresetDemoProfile('doctor'),
          getPresetDemoProfile('laboratory'),
          getPresetDemoProfile('radiology_center'),
          getPresetDemoProfile('pharmacy'),
          getPresetDemoProfile('wholesaler'),
        ];
      }
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        authError,
        isAdmin,
        needsOnboarding,
        unauthorizedDomainDetected,
        showDomainHelp,
        setShowDomainHelp,
        isDemoMode,
        currentHostname,
        firebaseProjectId,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendPasswordReset,
        signInAsDemoUser,
        exitDemoMode,
        signOut,
        clearAuthError,
        registerAsPatient,
        applyForProfessionalRole,
        refreshProfile,
        updateUserStatusByAdmin,
        fetchPendingUsersForAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
