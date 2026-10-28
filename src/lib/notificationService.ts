import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';

export interface AppNotification {
  id: string;
  recipientUid: string;
  title: string;
  message: string;
  type: 'booking_update' | 'report_ready' | 'prescription' | 'order' | 'system' | 'general' | 'referral';
  read: boolean;
  createdAt: string;
  link?: string;
  priority?: 'normal' | 'urgent';
}

const LOCAL_STORAGE_READ_KEY = 'm737_read_notification_ids';

function getLocallyReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveLocallyReadId(id: string) {
  try {
    const ids = getLocallyReadIds();
    ids.add(id);
    localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

function saveMultipleLocallyReadIds(newIds: string[]) {
  try {
    const ids = getLocallyReadIds();
    newIds.forEach(id => ids.add(id));
    localStorage.setItem(LOCAL_STORAGE_READ_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

/**
 * Subscribes to real-time notifications for the authenticated user.
 * If user is not signed in, returns empty array (zero fake notifications, no badge).
 */
export function subscribeToUserNotifications(
  userId: string | null | undefined,
  onUpdate: (notifications: AppNotification[]) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const locallyRead = getLocallyReadIds();

  try {
    const notifQuery = query(
      collection(db, 'notifications'),
      where('recipientUid', '==', userId)
    );

    const unsubscribe = onSnapshot(
      notifQuery,
      (snapshot) => {
        const notifs: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const isLocallyRead = locallyRead.has(docSnap.id);
          notifs.push({
            id: docSnap.id,
            recipientUid: data.recipientUid || userId,
            title: data.title || '',
            message: data.message || '',
            type: data.type || 'general',
            read: isLocallyRead ? true : !!data.read,
            createdAt: data.createdAt || new Date().toISOString(),
            link: data.link,
            priority: data.priority,
          });
        });

        // Sort descending by date (newest first)
        notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onUpdate(notifs);
      },
      (error) => {
        console.warn('Realtime notifications listener fallback:', error);
        // Fallback one-time fetch
        getDocs(notifQuery)
          .then((snapshot) => {
            const notifs: AppNotification[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const isLocallyRead = locallyRead.has(docSnap.id);
              notifs.push({
                id: docSnap.id,
                recipientUid: data.recipientUid || userId,
                title: data.title || '',
                message: data.message || '',
                type: data.type || 'general',
                read: isLocallyRead ? true : !!data.read,
                createdAt: data.createdAt || new Date().toISOString(),
                link: data.link,
                priority: data.priority,
              });
            });
            notifs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            onUpdate(notifs);
          })
          .catch(() => {
            onUpdate([]);
          });
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('subscribeToUserNotifications initialization error:', err);
    onUpdate([]);
    return () => {};
  }
}

/**
 * Marks a specific notification as read in Firestore and local storage.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  saveLocallyReadId(notificationId);
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to update notification in firestore, saved locally:', err);
  }
}

/**
 * Marks all notifications as read for the user.
 */
export async function markAllNotificationsAsRead(notifications: AppNotification[]): Promise<void> {
  const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
  if (unreadIds.length === 0) return;

  saveMultipleLocallyReadIds(unreadIds);

  try {
    const batch = writeBatch(db);
    unreadIds.forEach((id) => {
      const ref = doc(db, 'notifications', id);
      batch.update(ref, { read: true, readAt: new Date().toISOString() });
    });
    await batch.commit();
  } catch (err) {
    console.warn('Batch mark all read warning, updated locally:', err);
    // Fallback individual updates
    for (const id of unreadIds) {
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch {}
    }
  }
}

/**
 * Sends a real notification and triggers mobile push delivery to the user's devices.
 */
export async function sendRealInAppNotification({
  recipientUid,
  title,
  message,
  type = 'general',
  link,
  priority = 'normal'
}: {
  recipientUid: string;
  title: string;
  message: string;
  type?: AppNotification['type'];
  link?: string;
  priority?: 'normal' | 'urgent';
}): Promise<string | null> {
  if (!recipientUid) return null;
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newNotif: AppNotification = {
    id: notifId,
    recipientUid,
    title,
    message,
    type,
    read: false,
    createdAt: now,
    link,
    priority,
  };

  try {
    await setDoc(doc(db, 'notifications', notifId), newNotif);

    // Trigger real mobile push delivery through Push Dispatcher
    import('./pushEventDispatcher').then(({ dispatchM737Notification }) => {
      const category = 
        type === 'booking_update' ? 'appointment' :
        type === 'prescription' ? 'prescription' :
        type === 'report_ready' ? 'lab_radiology' :
        type === 'order' ? 'order' : 'general';

      dispatchM737Notification({
        recipientUid,
        category,
        titleAr: title,
        titleEn: title,
        messageAr: message,
        messageEn: message,
        targetPortal: 'patient',
        targetUrl: link || '/patient',
        sourceEventId: notifId,
        priority,
      }).catch((e) => console.warn('[NotificationService] Push dispatch notice:', e));
    }).catch(() => {});

    return notifId;
  } catch (err) {
    console.warn('Failed to send notification to Firestore:', err);
    return null;
  }
}
