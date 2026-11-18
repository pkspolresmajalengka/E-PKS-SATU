import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  applyDeltaMutationsToServer,
  getServerBackupState,
  getServerBackupStatus,
  getServerSnapshots,
  saveSnapshotToServer,
} from './serverBackupStore.ts';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

// Increase JSON payload limit to handle base64 images
app.use(express.json({ limit: '30mb' }));

// Shared Gemini client utility
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API endpoint to scan score form photo
app.post('/api/scan-form', async (req, res) => {
  try {
    const { imageBase64, mimeType, categoryTitle, criteriaList } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Foto form penilaian tidak ditemukan.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY belum dikonfigurasi di server environment.',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const criteriaDescription = Array.isArray(criteriaList)
      ? criteriaList
          .map(
            (c: any) =>
              `K${c.no}. ${c.name} (Pilihan poin: KS=${c.weights[0]}, K=${c.weights[1]}, C=${c.weights[2]}, B=${c.weights[3]}, A=${c.weights[4]})`
          )
          .join('\n')
      : '';

    const prompt = `Anda adalah asisten panitia lomba PBB & PKS. Tugas Anda adalah membaca foto lembar form penilaian fisik juri untuk mata lomba: "${categoryTitle}".

Daftar kriteria penilaian resmi adalah:
${criteriaDescription}

Analisis lembar form penilaian di foto ini:
1. Periksa nomor peserta dan nama sekolah jika tertulis di kop/header form.
2. Periksa tanda centang (v), silang (x), lingkaran, atau angka nilai yang diberikan juri untuk masing-masing kriteria K1, K2, dst.
3. Cocokkan nilai dengan bobot yang tersedia (KS, K, C, B, A).
4. Berikan hasil dalam format JSON berikut (hanya JSON murni):
{
  "detectedNomor": "nomor peserta yang terdeteksi atau kosong jika tidak terbaca",
  "detectedSekolah": "nama sekolah yang terdeteksi atau kosong jika tidak terbaca",
  "detectedJuri": "nama juri jika tertera",
  "scores": [
    {
      "criterionNo": 1,
      "score": 8,
      "label": "B",
      "confidence": "high"
    }
  ],
  "notes": "Catatan singkat hasil pembacaan"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: cleanBase64,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const resultText = response.text || '{}';
    const parsed = JSON.parse(resultText);

    return res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Error scanning score form with Gemini:', error);
    return res.status(500).json({
      error: error?.message || 'Terjadi kesalahan saat memproses gambar lembar penilaian.',
    });
  }
});

// Server-side Cloud Backup & Delta Sync API endpoints
app.get('/api/cloud-backup/status', async (_req, res) => {
  try {
    const status = await getServerBackupStatus();
    return res.json(status);
  } catch (error: any) {
    return res.status(500).json({
      available: false,
      error: error?.message || 'Gagal membaca status cadangan server.',
    });
  }
});

app.get('/api/cloud-backup/state', async (_req, res) => {
  try {
    const state = await getServerBackupState();
    return res.json(state);
  } catch (error: any) {
    return res.status(500).json({
      available: false,
      error: error?.message || 'Gagal membaca data cadangan server.',
    });
  }
});

app.get('/api/cloud-backup/snapshots', async (_req, res) => {
  try {
    const snapshots = await getServerSnapshots();
    return res.json({ success: true, snapshots });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Gagal membaca daftar snapshot server.',
    });
  }
});

app.post('/api/cloud-backup/delta', async (req, res) => {
  try {
    const mutations = Array.isArray(req.body?.mutations) ? req.body.mutations : [];
    const result = await applyDeltaMutationsToServer(mutations);
    return res.json(result);
  } catch (error: any) {
    console.error('Error applying server backup delta:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Gagal menyimpan perubahan delta ke cadangan server.',
    });
  }
});

app.post('/api/cloud-backup/snapshot', async (req, res) => {
  try {
    const snapshot = req.body?.snapshot;
    if (!snapshot || !snapshot.id || !snapshot.payload) {
      return res.status(400).json({
        success: false,
        error: 'Payload snapshot cadangan server tidak lengkap.',
      });
    }
    const result = await saveSnapshotToServer(snapshot);
    return res.json(result);
  } catch (error: any) {
    console.error('Error saving snapshot to server backup:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Gagal menyimpan snapshot ke cadangan server.',
    });
  }
});

// Vite middleware in development (HMR disabled in AI Studio container)
const vite = await createViteServer({
  server: {
    middlewareMode: true,
    hmr: false,
    ws: false,
  },
  appType: 'spa',
});

// Prevent Vite 8 @vite/client from opening a failing WebSocket when HMR/WS is disabled,
// while preserving updateStyle/removeStyle/createHotContext exports.
app.get('/@vite/client', async (req, res, next) => {
  try {
    const result = await vite.transformRequest(req.originalUrl || '/@vite/client');
    if (!result?.code) return next();
    const patchedCode = result.code
      .replace(
        'transport.connect(createHMRHandler(handleMessage));',
        '/* HMR WebSocket disabled */'
      )
      .replace(
        'ws.send(JSON.stringify(data));',
        'ws?.send?.(JSON.stringify(data));'
      )
      .replace(
        'else throw new SendBeforeConnectError("send was called before connect");',
        'else return;'
      )
      .replace(
        'else throw new SendBeforeConnectError("invoke was called before connect");',
        'else return null;'
      );
    res.status(200).type('application/javascript').send(patchedCode);
  } catch {
    next();
  }
});

app.use(vite.middlewares);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
