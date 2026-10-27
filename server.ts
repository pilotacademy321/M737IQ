import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Gemini API client if API key is present in environment
  let geminiClient: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI();
      console.log('[M737IQ AI] Gemini API client successfully initialized.');
    } catch (err) {
      console.warn('[M737IQ AI] Failed to initialize GoogleGenAI client:', err);
    }
  } else {
    console.warn('[M737IQ AI] GEMINI_API_KEY not found in environment.');
  }

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      platform: 'M737IQ Medical Platform',
      aiConfigured: Boolean(geminiClient),
      timestamp: new Date().toISOString()
    });
  });

  // AI Medicine Catalog Assistant Proxy Endpoint
  app.post('/api/ai-medicine-assistant', async (req: Request, res: Response) => {
    try {
      const { prompt, language } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        res.status(400).json({ error: 'Prompt is required and must be a string' });
        return;
      }

      if (!geminiClient) {
        // Return structured signal so client gracefully uses verified local clinical engine
        res.json({
          success: false,
          useLocalEngine: true,
          reason: 'Gemini API not configured on server'
        });
        return;
      }

      const systemInstruction = `
You are the AI Medicine Catalog Assistant for the Iraqi M737IQ Medical Platform.
Your sole role is to interpret natural language requests from accredited pharmacies and wholesalers seeking to browse or bulk-add medicines from the verified Iraqi Formulary (Kimadia) catalog.

ALLOWED MEDICAL SPECIALTY CATEGORIES ONLY:
- cardiology: القلبية وضغط الدم (Cardiology & Blood Pressure)
- hematology: أمراض الدم والتخثر (Hematology & Blood Disorders)
- endocrinology: الغدد الصم والسكري (Endocrinology & Diabetes)
- pediatrics: طب الأطفال وحديثي الولادة (Pediatrics)
- gynecology_obstetrics: النسائية والتوليد (Gynecology & Obstetrics)
- respiratory: الصدرية والجهاز التنفسي (Respiratory & Pulmonology)
- gastroenterology: الجهاز الهضمي والكبد (Gastroenterology)
- orthopedics: العظام والمفاصل والكسور (Orthopedics & Joints)
- dermatology: الجلدية والتناسلية (Dermatology)
- ophthalmology: طب وجراحة العيون (Ophthalmology)
- ent: الأنف والأذن والحنجرة (ENT)
- neurology: الجملة العصبية والدماغ (Neurology)
- urology: المسالك البولية والتناسلية (Urology & Kidneys)
- psychiatry: الطب النفسي والمزاج (Psychiatry)
- dentistry: طب وجراحة الأسنان (Dentistry)
- general_medicine: الطب العام والإسعافات (General Medicine & OTC)
- internal_medicine: أمراض باطنية عامة (Internal Medicine)

CRITICAL RULES:
1. Return JSON ONLY with fields:
   {
     "category": "one of the allowed category keys or null",
     "isComprehensive": true/false (true if user asked for a comprehensive/all/full list),
     "explanationAr": "Short explanation in Arabic explaining the interpreted intent",
     "explanationEn": "Short explanation in English"
   }
2. Never invent medicine names, prices, or clinical prescriptions.
3. If the user request does not match any medical category, set category to null.
`;

      const response = await geminiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `User Query: "${prompt}" (Preferred Language: ${language || 'ar'})`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      });

      const responseText = response.text || '{}';
      try {
        const parsed = JSON.parse(responseText);
        res.json({
          success: true,
          data: parsed
        });
      } catch {
        res.json({
          success: false,
          useLocalEngine: true,
          raw: responseText
        });
      }
    } catch (err: unknown) {
      console.error('[M737IQ AI Proxy Error]:', err);
      res.json({
        success: false,
        useLocalEngine: true,
        error: String(err)
      });
    }
  });

  // Mount Vite middlewares in development or serve static in production
  if (!isProduction) {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        allowedHosts: true as const,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[M737IQ Server] Running on http://0.0.0.0:${PORT} (Production: ${isProduction})`);
  });
}

startServer().catch((err) => {
  console.error('[M737IQ Server Startup Failure]:', err);
  process.exit(1);
});
