import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import webPush from 'web-push';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Initialize or load persistent VAPID keys for Web Push
const VAPID_KEY_FILE = path.resolve(__dirname, '.vapid-keys.json');
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || '',
  privateKey: process.env.VAPID_PRIVATE_KEY || '',
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  if (fs.existsSync(VAPID_KEY_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(VAPID_KEY_FILE, 'utf-8'));
      if (saved.publicKey && saved.privateKey) {
        vapidKeys = saved;
      }
    } catch (e) {
      console.warn('[Server] Error reading .vapid-keys.json, generating new keys:', e);
    }
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    vapidKeys = webPush.generateVAPIDKeys();
    try {
      fs.writeFileSync(VAPID_KEY_FILE, JSON.stringify(vapidKeys, null, 2), 'utf-8');
      console.log('[Server] Generated and saved new persistent VAPID keys to .vapid-keys.json');
    } catch (e) {
      console.warn('[Server] Could not save .vapid-keys.json:', e);
    }
  }
}

try {
  webPush.setVapidDetails(
    'mailto:bcgmoc@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
  );
  console.log('[Server] Web Push VAPID details configured successfully.');
} catch (err) {
  console.warn('[Server] Web Push VAPID configuration notice:', err);
}

async function startServer() {
  const app = express();

  // Basic middleware
  app.use(express.json());

  // -------------------------------------------------------------
  // PUSH NOTIFICATION BACKEND ROUTES (/api/push/*)
  // -------------------------------------------------------------

  // 1. Get VAPID Public Key for client-side push subscription
  app.get('/api/push/vapid-key', (_req, res) => {
    res.json({
      ok: true,
      vapidPublicKey: vapidKeys.publicKey,
      messagingSenderId: '153128091325',
      projectId: 'operating-league-dv9wh',
    });
  });

  // 2. Push service health and capabilities
  app.get('/api/push/status', (_req, res) => {
    res.json({
      ok: true,
      service: 'M737IQ Push Delivery Engine',
      isConfigured: Boolean(vapidKeys.publicKey && vapidKeys.privateKey),
      vapidPublicKey: vapidKeys.publicKey,
      platforms: ['android', 'ios', 'desktop'],
      supportedPortals: [
        'patient',
        'doctor',
        'secretary',
        'pharmacy',
        'laboratory',
        'radiology',
        'wholesaler',
        'super_admin',
      ],
      timestamp: new Date().toISOString(),
    });
  });

  // 3. Dispatch Push Notification to target device subscriptions
  app.post('/api/push/send', async (req, res) => {
    try {
      const {
        recipientUid,
        recipientRole,
        category,
        title,
        body,
        genericBody,
        targetUrl = '/',
        targetPortal = 'home',
        priority = 'normal',
        sourceEventId,
        subscriptions = [], // Array of PushSubscription objects
      } = req.body;

      if (!recipientUid) {
        return res.status(400).json({ ok: false, error: 'recipientUid is required' });
      }

      // Security gate: Super Admin notifications can only be delivered to authorized admin email
      if (targetPortal === 'super_admin' && recipientRole !== 'super_admin') {
        console.warn(`[Security] Blocked unauthorized super_admin notification attempt to UID: ${recipientUid}`);
        return res.status(403).json({ ok: false, error: 'Unauthorized target portal' });
      }

      const payload = JSON.stringify({
        notification: {
          title: title || 'منصة M737IQ الطبية',
          body: body || 'لديك تحديث طبي جديد',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        },
        data: {
          url: targetUrl,
          portal: targetPortal,
          category,
          sourceEventId: sourceEventId || `evt_${Date.now()}`,
          genericBody: genericBody || 'لديك تحديث طبي جديد في منصة M737IQ',
          priority,
          timestamp: String(Date.now()),
        },
      });

      let deliveredCount = 0;
      let failedCount = 0;
      const invalidEndpoints: string[] = [];

      // Send to all provided device push subscriptions
      if (Array.isArray(subscriptions) && subscriptions.length > 0) {
        const sendPromises = subscriptions.map(async (sub) => {
          if (!sub || !sub.endpoint || !sub.keys) return;
          try {
            await webPush.sendNotification(sub, payload, {
              TTL: priority === 'urgent' ? 60 * 60 * 24 : 60 * 60 * 4, // 24h or 4h
              urgency: priority === 'urgent' ? 'high' : 'normal',
            });
            deliveredCount++;
          } catch (err: any) {
            failedCount++;
            // 410 Gone or 404 Not Found indicates expired or unregistered subscription
            if (err?.statusCode === 410 || err?.statusCode === 404) {
              invalidEndpoints.push(sub.endpoint);
            }
            console.warn(`[PushSend] Push send failure for endpoint (${err?.statusCode}):`, err?.message);
          }
        });

        await Promise.allSettled(sendPromises);
      }

      console.log(`[PushSend] Dispatched for ${recipientUid}: ${deliveredCount} delivered, ${failedCount} failed`);

      return res.json({
        ok: true,
        status: 'processed',
        deliveredCount,
        failedCount,
        invalidEndpoints,
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[PushSend] Error handling /api/push/send:', err);
      return res.status(500).json({ ok: false, error: err?.message || 'Internal push delivery error' });
    }
  });

  // 4. Live Test Push directly to a provided subscription
  app.post('/api/push/test', async (req, res) => {
    try {
      const { subscription, title, body, url = '/' } = req.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ ok: false, error: 'Valid PushSubscription is required' });
      }

      const payload = JSON.stringify({
        notification: {
          title: title || 'M737IQ — إشعار تجريبي مباشر',
          body: body || 'تم ربط هاتفك بنظام الإشعارات المباشرة بنجاح.',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        },
        data: {
          url,
          portal: 'test',
          timestamp: String(Date.now()),
        },
      });

      await webPush.sendNotification(subscription, payload, {
        TTL: 60,
        urgency: 'high',
      });

      return res.json({ ok: true, status: 'delivered', timestamp: new Date().toISOString() });
    } catch (err: any) {
      console.error('[PushTest] Error sending test notification:', err);
      return res.status(500).json({ ok: false, error: err?.message || 'Test push delivery failed' });
    }
  });

  // -------------------------------------------------------------
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // -------------------------------------------------------------
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in development mode.');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Serving production build from /dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] M737IQ Full-Stack Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
