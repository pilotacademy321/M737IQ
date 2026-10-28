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
  deleteDoc,
  collection, 
  getDocs 
} from 'firebase/firestore';
import { auth, db, googleProvider, validateFirestoreConnection, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, AccountStatus, PatientProfile } from '../types';
import { generateUniqueMedicalId, ensureUserAccountId } from '../utils/medicalId';
import firebaseConfig from '@/firebase-applet-config.json';
import { recordRealMetricEvent } from '../lib/platformMetrics';

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
  signInAsDemoUser?: (role: UserRole, customName?: string) => Promise<void>;
  exitDemoMode?: () => void;
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
  deleteUserByAdmin: (targetUid: string) => Promise<void>;
  deletePendingUsersByAdmin: () => Promise<number>;
  fetchPendingUsersForAdmin: () => Promise<UserProfile[]>;
  deleteOwnAccountPermanently: () => Promise<void>;
}

import { 
  SOLE_SUPER_ADMIN_EMAIL, 
  isVerifiedSuperAdmin, 
  isRevokedAdminEmail, 
  assertSuperAdminAccess, 
  auditAndRevokeUnauthorizedAdmins 
} from '../utils/adminSecurity';

const SUPER_ADMIN_EMAIL = SOLE_SUPER_ADMIN_EMAIL;
const DEMO_STORAGE_KEY = 'm737_demo_role_v1';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [unauthorizedDomainDetected, setUnauthorizedDomainDetected] = useState(false);
  const [showDomainHelp, setShowDomainHelp] = useState(false);
  const isDemoMode = false;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const firebaseProjectId = firebaseConfig.projectId || 'operating-league-dv9wh';

  // Validate connection on boot
  useEffect(() => {
    validateFirestoreConnection();
  }, []);

  const loadUserProfile = async (firebaseUser: User) => {
    try {
      const isVerifiedSuperAdminEmail = isVerifiedSuperAdmin(firebaseUser);

      // Super Admin access is strictly gated: ONLY verified bcgmoc@gmail.com can be an admin
      setIsAdmin(isVerifiedSuperAdminEmail);

      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        let profile = userSnap.data() as UserProfile;

        // Ensure persistent unique accountId exists in users and account_ids registry
        if (!profile.accountId) {
          try {
            const assignedId = await ensureUserAccountId(
              db,
              firebaseUser.uid,
              profile.role,
              profile.displayName,
              profile.facilityName,
              firebaseUser.email || profile.email,
              profile.phone
            );
            profile.accountId = assignedId;
            if (profile.role === 'patient') {
              profile.medicalId = assignedId;
            }
          } catch (e) {
            console.warn('Notice ensuring user account ID:', e);
          }
        }

        if (isVerifiedSuperAdminEmail) {
          // Authorized Super Admin: elevate/confirm in Firestore
          const now = new Date().toISOString();
          const elevatedProfile: UserProfile = {
            ...profile,
            role: 'super_admin',
            status: 'approved',
            updatedAt: now,
          };
          if (profile.role !== 'super_admin' || profile.status !== 'approved') {
            await setDoc(userDocRef, elevatedProfile, { merge: true });
          }
          await setDoc(doc(db, 'admins', firebaseUser.uid), {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'super_admin',
            grantedAt: now,
          }, { merge: true });
          setUserProfile(elevatedProfile);
          setIsAdmin(true);

          // Proactively sanitize any unauthorized admin accounts in background
          auditAndRevokeUnauthorizedAdmins(db, firebaseUser).catch((e) =>
            console.warn('Background admin audit notice:', e)
          );
        } else {
          // ANY other account: ensure they do NOT retain super_admin role
          if (profile.role === 'super_admin' || isRevokedAdminEmail(firebaseUser.email)) {
            console.warn(`[SECURITY] Revoking unauthorized admin role from: ${firebaseUser.email || firebaseUser.uid}`);
            const now = new Date().toISOString();
            profile = {
              ...profile,
              role: 'patient',
              updatedAt: now,
            };
            try {
              await updateDoc(userDocRef, {
                role: 'patient',
                updatedAt: now,
              });
            } catch (e) {
              console.warn('Notice updating profile during role revocation:', e);
            }

            // Remove any dangling admin record
            try {
              await deleteDoc(doc(db, 'admins', firebaseUser.uid));
            } catch {}
          }

          setUserProfile(profile);
          setIsAdmin(false);
        }
        setNeedsOnboarding(false);
      } else {
        // If user document does not exist yet:
        if (isVerifiedSuperAdminEmail) {
          const now = new Date().toISOString();
          const adminProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || SOLE_SUPER_ADMIN_EMAIL,
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
          setIsAdmin(false);
          setNeedsOnboarding(true);
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching user profile:', err);
      // Handled gracefully without crashing app
      setAuthError(err instanceof Error ? err.message : 'Failed to retrieve profile');
    }
  };

  // Clean up any legacy demo keys on mount
  useEffect(() => {
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch {}
        setUser(currentUser);
        await loadUserProfile(currentUser);
        setLoading(false);
      } else {
        setUser(null);
        setUserProfile(null);
        setIsAdmin(false);
        setNeedsOnboarding(false);
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
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch {}
        setUnauthorizedDomainDetected(false);
        setShowDomainHelp(false);
        await loadUserProfile(result.user);
      }
    } catch (err: unknown) {
      const rawError = err instanceof Error ? err.message : 'Google sign-in failed';
      const errorCode = (typeof err === 'object' && err !== null && 'code' in err) 
        ? String((err as { code: unknown }).code) 
        : '';

      // 1. User intentionally closed popup or cancelled popup request - this is normal dismissal, not an error
      if (
        errorCode === 'auth/popup-closed-by-user' ||
        errorCode === 'auth/cancelled-popup-request' ||
        rawError.includes('auth/popup-closed-by-user') ||
        rawError.includes('auth/cancelled-popup-request')
      ) {
        // Clear any prior auth error; do not display error banner or log console.error
        setAuthError(null);
        return;
      }

      // 2. Browser blocked popup window
      if (errorCode === 'auth/popup-blocked' || rawError.includes('auth/popup-blocked')) {
        const popupMsg = 'تم حظر النافذة المنبثقة من قبل متصفحك. يرجى السماح بالنوافذ المنبثقة لموقع المنصة لإتمام تسجيل الدخول عبر Google.';
        console.warn('Firebase Auth: Popup blocked by browser');
        setAuthError(popupMsg);
        return;
      }

      // 3. Unauthorized domain
      const isDomainUnauthorized = 
        errorCode === 'auth/unauthorized-domain' || 
        rawError.includes('auth/unauthorized-domain');

      if (isDomainUnauthorized) {
        setUnauthorizedDomainDetected(true);
        setShowDomainHelp(true);
        const detailedMsg = `Firebase: Error (auth/unauthorized-domain). نطاق المعاينة السحابي (${window.location.hostname}) غير مضاف في قائمة النطاقات المصرح بها في Firebase Console. يمكنك نسخه وإضافته لتفعيل تسجيل الدخول.`;
        console.warn('Firebase Auth Unauthorized Domain detected:', detailedMsg);
        setAuthError(detailedMsg);
        return;
      }

      // 4. Network error
      if (errorCode === 'auth/network-request-failed' || rawError.includes('auth/network-request-failed')) {
        const netMsg = 'تعذر الاتصال بخوادم المصادقة. يرجى التحقق من اتصال الإنترنت والمحاولة لاحقاً.';
        console.warn('Firebase Auth Network Issue:', netMsg);
        setAuthError(netMsg);
        return;
      }

      // 5. General fallback error
      console.warn('Firebase Authentication Notice:', rawError);
      setAuthError(rawError);
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
        try {
          localStorage.removeItem(DEMO_STORAGE_KEY);
        } catch {}
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

      // Registration via public sign-up NEVER grants Super Admin privileges
      if (role === 'super_admin') {
        throw new Error('لا يمكن التسجيل كمسؤول أعلى عبر نموذج التسجيل العام (Unauthorized)');
      }

      const effectiveRole: UserRole = role;
      const effectiveStatus: AccountStatus = effectiveRole === 'patient' 
        ? 'approved' 
        : 'pending';

      const now = new Date().toISOString();
      const assignedId = await ensureUserAccountId(
        db,
        user.uid,
        effectiveRole,
        displayName || user.email?.split('@')[0] || 'User',
        '',
        user.email || email.trim(),
        phone || ''
      );

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || email.trim(),
        displayName: displayName || user.email?.split('@')[0] || 'User',
        role: effectiveRole,
        status: effectiveStatus,
        accountId: assignedId,
        medicalId: effectiveRole === 'patient' ? assignedId : undefined,
        phone: phone || '',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), profile);

      setIsAdmin(false);
      setUserProfile(profile);
      setNeedsOnboarding(false);
      recordRealMetricEvent('user');
      try {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {}
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

  const signInAsDemoUser = async () => {
    console.warn('Demo accounts have been removed. Please log in with genuine Firebase Auth.');
  };

  const exitDemoMode = () => {};

  const signOut = async () => {
    setLoading(true);
    try {
      try {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {}
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
      const medicalId = await ensureUserAccountId(
        db,
        user.uid,
        'patient',
        displayName || user.displayName || 'Patient',
        '',
        user.email || '',
        phone || ''
      );
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: displayName || user.displayName || 'Patient',
        role: 'patient',
        status: 'approved', // Patient access is free and immediately available
        accountId: medicalId,
        medicalId,
        phone: phone || '',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), profile);

      // Ensure persistent patient_profiles document exists with medicalId
      try {
        const pRef = doc(db, 'patient_profiles', user.uid);
        const pSnap = await getDoc(pRef);
        if (!pSnap.exists()) {
          const initialPatientDoc: PatientProfile = {
            patientId: user.uid,
            fullName: profile.displayName,
            medicalId,
            email: profile.email,
            phone: profile.phone || '',
            governorate: 'بغداد (Baghdad)',
            address: 'العراق',
            bloodType: 'Unknown',
            chronicDiseases: [],
            allergies: [],
            currentMedications: [],
            createdAt: now,
            updatedAt: now,
          };
          await setDoc(pRef, initialPatientDoc);
        } else if (!pSnap.data().medicalId) {
          await updateDoc(pRef, { medicalId, updatedAt: now });
        }
      } catch (e) {
        console.warn('Patient profile record initialization notice:', e);
      }

      setUserProfile(profile);
      setNeedsOnboarding(false);
      recordRealMetricEvent('user');
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
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
    if (payload.role === 'super_admin') {
      throw new Error('لا يمكن التقديم على صلاحية المشرف العام (Unauthorized)');
    }
    setLoading(true);
    setAuthError(null);
    try {
      const now = new Date().toISOString();
      const assignedId = await ensureUserAccountId(
        db,
        user.uid,
        payload.role,
        payload.displayName,
        payload.facilityName,
        user.email || '',
        payload.phone
      );

      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        displayName: payload.displayName,
        role: payload.role,
        status: 'pending',
        accountId: assignedId,
        licenseNumber: payload.licenseNumber,
        facilityName: payload.facilityName,
        governorate: payload.governorate,
        phone: payload.phone,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), profile);
      setUserProfile(profile);
      setNeedsOnboarding(false);
      recordRealMetricEvent('user');
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const updateUserStatusByAdmin = async (targetUid: string, newStatus: AccountStatus) => {
    assertSuperAdminAccess(user);
    if (!isAdmin) throw new Error('Unauthorized administrative action');
    try {
      const targetRef = doc(db, 'users', targetUid);
      await updateDoc(targetRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
      if (user && targetUid === user.uid) {
        await refreshProfile();
      }
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
    }
  };

  const deleteUserByAdmin = async (targetUid: string) => {
    assertSuperAdminAccess(user);
    if (!isAdmin) throw new Error('Unauthorized administrative action');
    try {
      await deleteDoc(doc(db, 'users', targetUid));
      try {
        await deleteDoc(doc(db, 'admins', targetUid));
      } catch {
        // ignore if not admin
      }
      // Also cleanup role-specific profile documents
      const profileCols = [
        'patient_profiles',
        'doctor_profiles',
        'pharmacy_profiles',
        'lab_profiles',
        'radiology_profiles',
        'wholesaler_profiles',
        'secretary_assignments'
      ];
      for (const col of profileCols) {
        try {
          await deleteDoc(doc(db, col, targetUid));
        } catch {
          // ignore if not present
        }
      }
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.DELETE, `users/${targetUid}`);
    }
  };

  const deletePendingUsersByAdmin = async (): Promise<number> => {
    assertSuperAdminAccess(user);
    if (!isAdmin) throw new Error('Unauthorized administrative action');
    try {
      const usersCol = collection(db, 'users');
      const snap = await getDocs(usersCol);
      const pendingDocs = snap.docs.filter((d) => {
        const data = d.data() as UserProfile;
        return data.status === 'pending' || data.status === 'incomplete';
      });

      let count = 0;
      for (const d of pendingDocs) {
        await deleteDoc(d.ref);
        count++;
      }
      return count;
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.DELETE, 'users');
      return 0;
    }
  };

  const fetchPendingUsersForAdmin = async (): Promise<UserProfile[]> => {
    assertSuperAdminAccess(user);
    if (!isAdmin) throw new Error('Unauthorized');
    try {
      const usersCol = collection(db, 'users');
      const snap = await getDocs(usersCol);
      return snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((u) => u.status === 'pending' || u.status === 'incomplete');
    } catch (err: unknown) {
      handleFirestoreError(err, OperationType.LIST, 'users');
    }
  };

  const deleteOwnAccountPermanently = async (): Promise<void> => {
    if (!user) throw new Error('No user is currently authenticated');
    const targetUid = user.uid;

    // 1. Delete Firestore user document
    try {
      await deleteDoc(doc(db, 'users', targetUid));
    } catch (err) {
      console.warn('Failed to delete user doc from Firestore:', err);
    }

    // 2. Clean up any related profile collections
    const profileCols = [
      'patient_profiles',
      'doctor_profiles',
      'pharmacy_profiles',
      'lab_profiles',
      'radiology_profiles',
      'wholesaler_profiles',
      'secretary_assignments'
    ];
    for (const col of profileCols) {
      try {
        await deleteDoc(doc(db, col, targetUid));
      } catch {
        // ignore
      }
    }

    // 3. Delete Firebase Auth user credentials
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await currentUser.delete();
      } catch (authErr: any) {
        if (authErr?.code === 'auth/requires-recent-login') {
          throw new Error(
            'يتطلب حذف الحساب تسجيل دخول حديث لأسباب أمنية. يرجى تسجيل الخروج ثم إعادة تسجيل الدخول والمحاولة ثانية.'
          );
        }
        throw authErr;
      }
    }

    // Clean up local session
    localStorage.removeItem(DEMO_STORAGE_KEY);
    setUser(null);
    setUserProfile(null);
    setIsAdmin(false);
    setNeedsOnboarding(false);
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
        deleteUserByAdmin,
        deletePendingUsersByAdmin,
        fetchPendingUsersForAdmin,
        deleteOwnAccountPermanently,
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
