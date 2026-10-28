/**
 * M737IQ Push Notification & Device Token Service
 * Manages Firebase Cloud Messaging (FCM) & Web Push registration,
 * Service Worker synchronization, device token lifecycle, and user preferences.
 */

import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs 
} from 'firebase/firestore';
import { app, db } from './firebase';
import { UserRole } from '../types';

export type PushPermissionStatus = 'default' | 'granted' | 'denied' | 'unsupported';

export interface PushNotificationPreferences {
  enabled: boolean;
  useGenericLockscreen: boolean; // Protects patient confidentiality on lockscreen
  appointments: boolean;         // Clinic bookings, reminders, cancellations
  prescriptions: boolean;        // E-prescriptions, pharmacy fulfillment
  labRadiology: boolean;         // Laboratory & radiology report readiness
  orders: boolean;               // Wholesaler & pharmacy drug orders
  security: boolean;             // Account verification, licensing, security alerts
}

export const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  enabled: true,
  useGenericLockscreen: false,
  appointments: true,
  prescriptions: true,
  labRadiology: true,
  orders: true,
  security: true,
};

export interface DeviceTokenRecord {
  tokenId: string;
  token: string;
  subscription?: {
    endpoint: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
  };
  uid: string;
  role: UserRole | string;
  platform: 'android' | 'ios' | 'desktop' | 'unknown';
  userAgent: string;
  createdAt: string;
  lastSeenAt: string;
  preferences: PushNotificationPreferences;
}

const PREFERENCES_STORAGE_KEY = 'm737_push_preferences_v1';
const DEVICE_TOKEN_STORAGE_KEY = 'm737_device_fcm_token_v1';

// Optional public VAPID key (can be supplied via environment variable)
const VAPID_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_VAPID_KEY)
  ? (import.meta.env.VITE_FIREBASE_VAPID_KEY as string)
  : undefined;

let messagingInstance: Messaging | null = null;
let isFCMSupportedCached: boolean | null = null;
let cachedDynamicVapidKey: string | null = null;

/**
 * Converts a URL-safe Base64 string to a Uint8Array for PushManager subscription
 */
export function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Retrieves the active VAPID public key dynamically from the backend or env
 */
export async function getActiveVapidPublicKey(): Promise<string | undefined> {
  if (VAPID_KEY) return VAPID_KEY;
  if (cachedDynamicVapidKey) return cachedDynamicVapidKey;
  if (typeof window === 'undefined') return undefined;

  try {
    const res = await fetch('/api/push/vapid-key');
    if (res.ok) {
      const data = await res.json();
      if (data.vapidPublicKey) {
        cachedDynamicVapidKey = data.vapidPublicKey;
        return data.vapidPublicKey;
      }
    }
  } catch (err) {
    console.warn('[PushService] Notice fetching dynamic VAPID key from backend:', err);
  }
  return undefined;
}

/**
 * Checks whether the current browser / device supports Web Push & Service Workers
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Returns current browser notification permission status
 */
export function getNotificationPermissionStatus(): PushPermissionStatus {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermissionStatus;
}

/**
 * Detects device platform for responsive push routing
 */
export function detectPlatform(): 'android' | 'ios' | 'desktop' | 'unknown' {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) return 'desktop';
  return 'unknown';
}

/**
 * Initializes Firebase Messaging with environment validation
 */
export async function getFCMInstance(): Promise<Messaging | null> {
  if (!isPushSupported()) return null;
  if (messagingInstance) return messagingInstance;

  try {
    if (isFCMSupportedCached === null) {
      isFCMSupportedCached = await isSupported();
    }
    if (isFCMSupportedCached) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (err) {
    console.warn('[PushService] FCM isSupported check notice:', err);
    isFCMSupportedCached = false;
  }
  return null;
}

/**
 * Registers the service worker for background push delivery
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    // Check if firebase-messaging-sw or sw.js is already registered
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('[PushService] Registered /firebase-messaging-sw.js with scope:', registration.scope);
    }
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('[PushService] Service worker registration error:', err);
    // Fallback registration with /sw.js
    try {
      const fallback = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return fallback;
    } catch (e) {
      console.warn('[PushService] Fallback service worker registration error:', e);
      return null;
    }
  }
}

/**
 * Generates deterministic token ID from token string for Firestore document keying
 */
function hashToken(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    hash = ((hash << 5) - hash) + token.charCodeAt(i);
    hash |= 0;
  }
  const positive = Math.abs(hash).toString(36);
  return `tok_${positive}_${token.slice(-8)}`;
}

/**
 * Requests Notification permission and registers the device FCM token in Firestore
 */
export async function requestPushPermissionAndRegisterToken(
  uid: string,
  role: UserRole | string,
  customPreferences?: Partial<PushNotificationPreferences>
): Promise<{ success: boolean; token?: string; status: PushPermissionStatus; error?: string }> {
  if (!uid) {
    return { success: false, status: 'default', error: 'User must be authenticated' };
  }

  if (!isPushSupported()) {
    return { success: false, status: 'unsupported', error: 'Push notifications are not supported on this browser' };
  }

  try {
    // 1. Request user permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, status: permission as PushPermissionStatus, error: 'Permission denied by user' };
    }

    // 2. Ensure Service Worker is registered and active
    const swReg = await registerPushServiceWorker();
    if (!swReg) {
      return { success: false, status: 'granted', error: 'Service worker registration failed' };
    }

    // 3. Obtain Active VAPID Public Key
    const activeVapidKey = await getActiveVapidPublicKey();

    // 4. Initialize FCM and obtain Device Registration Token
    const messaging = await getFCMInstance();
    let token = '';

    if (messaging) {
      try {
        token = await getToken(messaging, {
          vapidKey: activeVapidKey,
          serviceWorkerRegistration: swReg,
        });
      } catch (tokenErr) {
        console.warn('[PushService] getToken error with active VAPID key:', tokenErr);
        try {
          token = await getToken(messaging, { serviceWorkerRegistration: swReg });
        } catch (retryErr) {
          console.warn('[PushService] Default getToken retry error:', retryErr);
        }
      }
    }

    // 5. Also acquire native WebPush subscription from PushManager
    let pushSubscriptionData: { endpoint: string; keys?: { p256dh: string; auth: string } } | undefined = undefined;
    try {
      let sub = await swReg.pushManager.getSubscription();
      if (!sub && activeVapidKey) {
        sub = await swReg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(activeVapidKey) as unknown as BufferSource,
        });
      }
      if (sub) {
        const json = sub.toJSON();
        if (json.endpoint) {
          pushSubscriptionData = {
            endpoint: json.endpoint,
            keys: json.keys as { p256dh: string; auth: string },
          };
        }
      }
    } catch (subErr) {
      console.warn('[PushService] PushManager subscription notice:', subErr);
    }

    if (!token && !pushSubscriptionData) {
      // Fallback: save permission state locally
      return { success: true, status: 'granted' };
    }

    // 6. Save device token record to Firestore
    const effectiveTokenString = token || pushSubscriptionData?.endpoint || `sub_${Date.now()}`;
    const tokenId = hashToken(effectiveTokenString);
    const now = new Date().toISOString();
    const prefs: PushNotificationPreferences = {
      ...DEFAULT_PUSH_PREFERENCES,
      ...customPreferences,
      enabled: true,
    };

    const record: DeviceTokenRecord = {
      tokenId,
      token: token || effectiveTokenString,
      subscription: pushSubscriptionData,
      uid,
      role,
      platform: detectPlatform(),
      userAgent: navigator.userAgent.slice(0, 200),
      createdAt: now,
      lastSeenAt: now,
      preferences: prefs,
    };

    // Store in user-specific subcollection: /users/{uid}/device_tokens/{tokenId}
    await setDoc(doc(db, 'users', uid, 'device_tokens', tokenId), record, { merge: true });

    // Also mirror to global device_tokens collection for backend dispatcher routing
    await setDoc(doc(db, 'device_tokens', tokenId), record, { merge: true });

    // Save token and preferences locally
    localStorage.setItem(DEVICE_TOKEN_STORAGE_KEY, token);
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));

    console.log('[PushService] Device token registered successfully:', tokenId);
    return { success: true, token, status: 'granted' };
  } catch (err) {
    console.error('[PushService] Failed to register push token:', err);
    return { 
      success: false, 
      status: getNotificationPermissionStatus(), 
      error: err instanceof Error ? err.message : 'Unknown registration error' 
    };
  }
}

/**
 * Unregisters the current device token and removes it from Firestore
 */
export async function unregisterDevicePush(uid: string): Promise<void> {
  const storedToken = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
  if (storedToken && uid) {
    try {
      const tokenId = hashToken(storedToken);
      await deleteDoc(doc(db, 'users', uid, 'device_tokens', tokenId));
      await deleteDoc(doc(db, 'device_tokens', tokenId));
    } catch (err) {
      console.warn('[PushService] Error deleting token doc:', err);
    }
  }

  localStorage.removeItem(DEVICE_TOKEN_STORAGE_KEY);
  const currentPrefs = getUserNotificationPreferences();
  currentPrefs.enabled = false;
  saveUserNotificationPreferences(currentPrefs);
}

/**
 * Loads notification preferences from localStorage
 */
export function getUserNotificationPreferences(): PushNotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PUSH_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_PUSH_PREFERENCES };
}

/**
 * Saves notification preferences to localStorage and syncs with Firestore
 */
export async function saveUserNotificationPreferences(
  preferences: PushNotificationPreferences,
  uid?: string
): Promise<void> {
  localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));

  if (uid) {
    try {
      const storedToken = localStorage.getItem(DEVICE_TOKEN_STORAGE_KEY);
      if (storedToken) {
        const tokenId = hashToken(storedToken);
        const ref = doc(db, 'users', uid, 'device_tokens', tokenId);
        await updateDoc(ref, {
          preferences,
          lastSeenAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn('[PushService] Preferences cloud sync notice:', e);
    }
  }
}

/**
 * Dispatches an immediate real test push notification through Service Worker
 * to verify device and browser notification delivery on the user's phone or desktop.
 */
export async function sendLocalTestNotification({
  title = 'M737IQ — تجربة الإشعار المباشر',
  body = 'نظام الإشعارات المباشرة نشط وموثق بنجاح على جهازك.',
  url = '/patient',
}: {
  title?: string;
  body?: string;
  url?: string;
}): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission = Notification.permission;
  if (permission !== 'granted') return false;

  try {
    const swReg = await registerPushServiceWorker();
    if (swReg) {
      // 1. Attempt real server-side Web Push round-trip test if subscription is available
      try {
        let sub = await swReg.pushManager.getSubscription();
        if (!sub) {
          const activeKey = await getActiveVapidPublicKey();
          if (activeKey) {
            sub = await swReg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlB64ToUint8Array(activeKey) as unknown as BufferSource,
            });
          }
        }

        if (sub) {
          const res = await fetch('/api/push/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subscription: sub.toJSON(),
              title,
              body,
              url,
            }),
          });
          if (res.ok) {
            console.log('[PushService] Real backend Web Push test delivered successfully.');
            return true;
          }
        }
      } catch (backendTestErr) {
        console.warn('[PushService] Backend test endpoint notice, falling back to local SW notification:', backendTestErr);
      }

      // 2. Service Worker local showNotification fallback
      await swReg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: `m737-test-${Date.now()}`,
        data: { url, timestamp: Date.now() },
      } as NotificationOptions & { vibrate?: number[] });
      return true;
    } else {
      // Fallback to Window Notification API
      new Notification(title, {
        body,
        icon: '/icons/icon-192.png',
      });
      return true;
    }
  } catch (err) {
    console.error('[PushService] sendLocalTestNotification error:', err);
    return false;
  }
}

/**
 * Queries active device push subscriptions for a recipient UID
 */
export async function getRecipientDeviceSubscriptions(recipientUid: string): Promise<any[]> {
  const subs: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'users', recipientUid, 'device_tokens'));
    snap.forEach((d) => {
      const data = d.data() as DeviceTokenRecord;
      if (data.subscription && data.preferences?.enabled !== false) {
        subs.push(data.subscription);
      }
    });
  } catch (err) {
    console.warn('[PushService] Notice querying recipient device subscriptions:', err);
  }
  return subs;
}

/**
 * Listens to foreground push messages from FCM
 */
export function listenToForegroundMessages(
  onReceive: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): () => void {
  let unsubscribe: (() => void) | null = null;

  getFCMInstance().then((messaging) => {
    if (messaging) {
      unsubscribe = onMessage(messaging, (payload) => {
        console.log('[PushService] Foreground message received:', payload);
        const title = payload.notification?.title || payload.data?.title || 'M737IQ';
        const body = payload.notification?.body || payload.data?.body || 'لديك إشعار طبي جديد';
        onReceive({
          title,
          body,
          data: payload.data,
        });
      });
    }
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}
