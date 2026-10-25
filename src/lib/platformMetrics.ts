import { db, auth } from './firebase';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot,
  collection,
  query,
  limit,
  getDocs
} from 'firebase/firestore';

export interface PlatformMetrics {
  appointmentsToday: number;
  activeUsers: number;
  diagnosticTests: number;
  prescriptions: number;
  updatedAt?: string;
}

export interface RealActivityItem {
  id: string;
  title: string;
  timeFormatted: string;
  category: 'appointment' | 'test' | 'supply' | 'prescription' | 'support';
  timestamp: string;
}

const METRICS_DOC_PATH = 'platform_metrics/realtime';

/**
 * Format relative elapsed time in Arabic
 */
export function formatArabicElapsedTime(isoString?: string): string {
  if (!isoString) return 'الآن';
  try {
    const elapsedMs = Math.max(0, Date.now() - new Date(isoString).getTime());
    const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    const elapsedDays = Math.floor(elapsedHours / 24);

    if (elapsedMinutes < 2) return 'الآن';
    if (elapsedMinutes < 60) return `منذ ${elapsedMinutes} دقيقة`;
    if (elapsedHours === 1) return 'منذ ساعة';
    if (elapsedHours === 2) return 'منذ ساعتين';
    if (elapsedHours < 24) return `منذ ${elapsedHours} ساعات`;
    if (elapsedDays === 1) return 'منذ يوم';
    return `منذ ${elapsedDays} أيام`;
  } catch {
    return 'الآن';
  }
}

/**
 * Subscribes to real metrics from Firestore. Starts at ZERO (0) and reflects only genuine operations.
 */
export function subscribeToLiveMetrics(
  onUpdate: (metrics: PlatformMetrics) => void
): () => void {
  const metricsRef = doc(db, 'platform_metrics', 'realtime');

  const unsubscribe = onSnapshot(
    metricsRef,
    async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          appointmentsToday: Math.max(0, Number(data.appointmentsToday) || 0),
          activeUsers: Math.max(0, Number(data.activeUsers) || 0),
          diagnosticTests: Math.max(0, Number(data.diagnosticTests) || 0),
          prescriptions: Math.max(0, Number(data.prescriptions) || 0),
          updatedAt: data.updatedAt,
        });
      } else {
        // Document does not exist yet: initialize starting at pure ZERO (0)
        const initialZeroMetrics: PlatformMetrics = {
          appointmentsToday: 0,
          activeUsers: 0,
          diagnosticTests: 0,
          prescriptions: 0,
          updatedAt: new Date().toISOString(),
        };
        onUpdate(initialZeroMetrics);

        // If authenticated user is present, bootstrap the zero-document
        if (auth.currentUser) {
          try {
            await setDoc(metricsRef, initialZeroMetrics);
          } catch (e) {
            console.warn('Initial zero metrics write skipped:', e);
          }
        }
      }
    },
    (error) => {
      console.warn('Live metrics snapshot notice:', error.message);
      // Fallback: strictly starting at 0
      onUpdate({
        appointmentsToday: 0,
        activeUsers: 0,
        diagnosticTests: 0,
        prescriptions: 0,
      });
    }
  );

  return unsubscribe;
}

/**
 * Increment real platform metric counter upon authentic patient/doctor action
 */
export async function recordRealMetricEvent(
  type: 'appointment' | 'user' | 'test' | 'prescription'
): Promise<void> {
  const metricsRef = doc(db, 'platform_metrics', 'realtime');
  const now = new Date().toISOString();

  const fieldMap = {
    appointment: 'appointmentsToday',
    user: 'activeUsers',
    test: 'diagnosticTests',
    prescription: 'prescriptions',
  };

  const targetField = fieldMap[type];

  try {
    const snap = await getDoc(metricsRef);
    if (snap.exists()) {
      await updateDoc(metricsRef, {
        [targetField]: increment(1),
        updatedAt: now,
      });
    } else {
      await setDoc(metricsRef, {
        appointmentsToday: type === 'appointment' ? 1 : 0,
        activeUsers: type === 'user' ? 1 : 0,
        diagnosticTests: type === 'test' ? 1 : 0,
        prescriptions: type === 'prescription' ? 1 : 0,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.warn('Real metric record failed:', err);
  }
}

/**
 * Fetches purely real activities from Firestore collections.
 * Returns an EMPTY array if no real activities have occurred yet.
 */
export async function fetchRealDatabaseActivities(): Promise<RealActivityItem[]> {
  const activities: RealActivityItem[] = [];

  // Only query when user is authenticated to adhere to security rules
  if (!auth.currentUser) {
    return [];
  }

  try {
    // 1. Real appointments
    try {
      const apptQuery = query(collection(db, 'appointments'), limit(4));
      const apptSnap = await getDocs(apptQuery);
      apptSnap.forEach((d) => {
        const item = d.data();
        activities.push({
          id: `appt_${d.id}`,
          title: `حجز موعد عيادة: ${item.patientName || 'مريض'} لدى ${item.doctorName ? 'د. ' + item.doctorName : 'العيادة'}`,
          timeFormatted: formatArabicElapsedTime(item.createdAt || item.date),
          category: 'appointment',
          timestamp: item.createdAt || new Date().toISOString(),
        });
      });
    } catch {}

    // 2. Real prescriptions
    try {
      const rxQuery = query(collection(db, 'electronic_prescriptions'), limit(4));
      const rxSnap = await getDocs(rxQuery);
      rxSnap.forEach((d) => {
        const item = d.data();
        activities.push({
          id: `rx_${d.id}`,
          title: `إصدار وصفة طبية إلكترونية للمريض (${item.patientName || 'مريض'})`,
          timeFormatted: formatArabicElapsedTime(item.createdAt),
          category: 'prescription',
          timestamp: item.createdAt || new Date().toISOString(),
        });
      });
    } catch {}

    // 3. Real pharmacy orders
    try {
      const orderQuery = query(collection(db, 'pharmacy_orders'), limit(4));
      const orderSnap = await getDocs(orderQuery);
      orderSnap.forEach((d) => {
        const item = d.data();
        activities.push({
          id: `ord_${d.id}`,
          title: `طلب صرف دواء: صيدلية ${item.pharmacyName || ''}`,
          timeFormatted: formatArabicElapsedTime(item.createdAt),
          category: 'supply',
          timestamp: item.createdAt || new Date().toISOString(),
        });
      });
    } catch {}

    // 4. Real lab reports
    try {
      const labQuery = query(collection(db, 'lab_results'), limit(4));
      const labSnap = await getDocs(labQuery);
      labSnap.forEach((d) => {
        const item = d.data();
        activities.push({
          id: `lab_${d.id}`,
          title: `إصدار نتيجة فحص مخبري: ${item.testName || 'تحليل سريري'}`,
          timeFormatted: formatArabicElapsedTime(item.createdAt),
          category: 'test',
          timestamp: item.createdAt || new Date().toISOString(),
        });
      });
    } catch {}

    // Sort descending by real timestamp
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return activities.slice(0, 5);
  } catch (err) {
    console.warn('Real activities query skipped:', err);
    return [];
  }
}
