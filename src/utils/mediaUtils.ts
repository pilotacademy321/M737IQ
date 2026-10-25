/**
 * Media and communication utilities for M737 Medical Platform
 * Handles client-side secure photo validation/compression and international WhatsApp formatting.
 */

export interface ImageValidationResult {
  valid: boolean;
  success?: boolean;
  error?: string;
  dataUrl?: string;
}

/**
 * Validates file type, size, and compresses the image to a lightweight Base64 string
 * suitable for fast loading and Firestore document storage (< 70KB).
 */
export async function validateAndCompressImage(
  file: File,
  maxDimensionOrOptions: number | { maxWidth?: number; maxHeight?: number; maxDimension?: number; quality?: number; maxSizeBytes?: number } = 400,
  qualityParam = 0.82
): Promise<ImageValidationResult> {
  let maxDimension = 400;
  let quality = qualityParam;

  if (typeof maxDimensionOrOptions === 'object' && maxDimensionOrOptions !== null) {
    maxDimension = maxDimensionOrOptions.maxWidth || maxDimensionOrOptions.maxDimension || 400;
    if (typeof maxDimensionOrOptions.quality === 'number') {
      quality = maxDimensionOrOptions.quality;
    }
  } else if (typeof maxDimensionOrOptions === 'number') {
    maxDimension = maxDimensionOrOptions;
  }

  // 1. Validate MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      success: false,
      error: 'نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP (Unsupported image format).',
    };
  }

  // 2. Validate max raw file size (Max 5 MB)
  if (file.size > 5 * 1024 * 1024) {
    return {
      valid: false,
      success: false,
      error: 'حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 5 ميغابايت (Max file size is 5MB).',
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => {
      resolve({ valid: false, success: false, error: 'تعذر قراءة ملف الصورة (Failed to read image).' });
    };

    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => {
        resolve({ valid: false, success: false, error: 'تعذر معالجة بيانات الصورة (Invalid image content).' });
      };

      img.onload = () => {
        try {
          let { width, height } = img;

          // Maintain aspect ratio while bounding within maxDimension
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ valid: false, success: false, error: 'تعذر تهيئة محرك معالجة الصور (Canvas context error).' });
            return;
          }

          // Crisp image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG format with optimization
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve({
            valid: true,
            success: true,
            dataUrl: compressedDataUrl,
          });
        } catch (err: unknown) {
          resolve({
            valid: false,
            success: false,
            error: err instanceof Error ? err.message : 'خطأ أثناء ضغط الصورة (Compression failed).',
          });
        }
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes Iraqi and regional phone numbers to standard international WhatsApp format:
 * Examples:
 *   '07801234567' -> 'https://wa.me/9647801234567'
 *   '+964 770 123 4567' -> 'https://wa.me/9647701234567'
 *   '7901234567' -> 'https://wa.me/9647901234567'
 */
export function formatWhatsAppUrl(rawPhone: string, defaultMessage?: string): string | null {
  if (!rawPhone) return null;

  // Strip spaces, dashes, parentheses, plus
  let cleaned = rawPhone.replace(/[\s\-\(\)\+]/g, '');

  // Handle standard Iraqi mobile prefixes
  if (cleaned.startsWith('00964')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('07')) {
    cleaned = '964' + cleaned.slice(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '964' + cleaned;
  } else if (!cleaned.startsWith('964') && cleaned.length >= 9) {
    cleaned = '964' + cleaned;
  }

  // Ensure it has valid length for mobile
  if (cleaned.length < 11) return null;

  const baseUrl = `https://wa.me/${cleaned}`;
  if (defaultMessage) {
    return `${baseUrl}?text=${encodeURIComponent(defaultMessage)}`;
  }
  return baseUrl;
}
