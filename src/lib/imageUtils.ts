export interface CompressImageOptions {
  maxDimension?: number;
  maxDataUrlBytes?: number;
  preferPng?: boolean;
}

const DEFAULT_MAX_DIMENSION = 1280;
const DEFAULT_MAX_DATA_URL_BYTES = 580 * 1024; // ~580 KB safely below Firestore 1 MiB doc limit

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Gagal membaca berkas gambar.'));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Berkas gambar tidak valid atau rusak.'));
    img.src = src;
  });
}

/**
 * Compresses raster images via <canvas> so base64 payloads remain safely
 * below Firestore's 1 MiB per-document ceiling. SVGs are kept as-is when small.
 */
export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxDataUrlBytes = options.maxDataUrlBytes ?? DEFAULT_MAX_DATA_URL_BYTES;
  const rawDataUrl = await readFileAsDataUrl(file);

  if (file.type === 'image/svg+xml') {
    if (rawDataUrl.length <= maxDataUrlBytes) {
      return rawDataUrl;
    }
    throw new Error('Ukuran berkas SVG terlalu besar untuk disimpan ke Cloud (maks. 550 KB).');
  }

  // If already small enough and not huge dimensions, we can still normalize oversized dimensions
  const img = await loadImage(rawDataUrl);
  const srcWidth = img.naturalWidth || img.width || 1;
  const srcHeight = img.naturalHeight || img.height || 1;

  if (
    rawDataUrl.length <= maxDataUrlBytes &&
    srcWidth <= maxDimension &&
    srcHeight <= maxDimension
  ) {
    return rawDataUrl;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (rawDataUrl.length <= maxDataUrlBytes) return rawDataUrl;
    throw new Error('Browser tidak mendukung kompresi gambar otomatis.');
  }

  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const scaleSteps = [1, 0.85, 0.7, 0.55, 0.4];
  const qualitySteps = [0.84, 0.72, 0.6, 0.48, 0.36];

  const baseScale = Math.min(1, maxDimension / Math.max(srcWidth, srcHeight));

  for (const stepScale of scaleSteps) {
    const targetScale = baseScale * stepScale;
    const width = Math.max(1, Math.round(srcWidth * targetScale));
    const height = Math.max(1, Math.round(srcHeight * targetScale));
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    // For JPEG fallback fill white background so transparent PNGs don't turn black
    if (!options.preferPng && !hasAlpha) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);

    if (options.preferPng && hasAlpha) {
      const pngUrl = canvas.toDataURL('image/png');
      if (pngUrl.length <= maxDataUrlBytes) return pngUrl;
      // Fall through to WebP (supports alpha & much smaller)
      for (const q of qualitySteps) {
        const webpUrl = canvas.toDataURL('image/webp', q);
        if (webpUrl.startsWith('data:image/webp') && webpUrl.length <= maxDataUrlBytes) {
          return webpUrl;
        }
      }
    }

    const mimeTypes = hasAlpha ? ['image/webp', 'image/jpeg'] : ['image/jpeg'];
    for (const mime of mimeTypes) {
      if (mime === 'image/jpeg') {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      for (const q of qualitySteps) {
        const out = canvas.toDataURL(mime, q);
        if (out.startsWith(`data:${mime}`) && out.length <= maxDataUrlBytes) {
          return out;
        }
      }
    }
  }

  throw new Error('Ukuran gambar masih terlalu besar setelah dikompresi. Gunakan gambar dengan resolusi lebih kecil.');
}
