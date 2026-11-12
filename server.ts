import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

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

// Vite middleware in development
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'spa',
});
app.use(vite.middlewares);

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
