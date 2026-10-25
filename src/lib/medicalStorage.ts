import { storage } from './firebase';
import { 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  UploadTaskSnapshot 
} from 'firebase/storage';

export interface StoredMedicalFile {
  id: string;
  name: string;
  size: number;
  sizeFormatted: string;
  modality: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  patientName?: string;
  bookingId?: string;
  isDicom: boolean;
}

export interface UploadOptions {
  centerId: string;
  modality: string;
  patientName?: string;
  bookingId?: string;
  uploadedByUid: string;
  onProgress?: (percent: number, snapshot: UploadTaskSnapshot) => void;
}

// 50 MB standard limit for DICOM & radiological studies
export const MAX_MEDICAL_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Allowed medical file extensions
export const ALLOWED_EXTENSIONS = ['.dcm', '.dicom', '.png', '.jpg', '.jpeg', '.webp', '.pdf'];

// Format bytes into readable format (e.g. 14.2 MB)
export function formatMedicalFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Check if a file is a DICOM file based on extension or mime type
export function isDicomFile(fileName: string, mimeType?: string): boolean {
  const lowerName = (fileName || '').toLowerCase();
  const lowerMime = (mimeType || '').toLowerCase();
  return (
    lowerName.endsWith('.dcm') ||
    lowerName.endsWith('.dicom') ||
    lowerMime === 'application/dicom' ||
    lowerMime === 'image/dicom'
  );
}

// Validate radiology / DICOM file before upload
export function validateRadiologyFile(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'الملف غير صالح أو غير موجود.' };
  }

  // Size validation
  if (file.size > MAX_MEDICAL_FILE_SIZE_BYTES) {
    return { 
      isValid: false, 
      error: `حجم الملف (${formatMedicalFileSize(file.size)}) يتجاوز الحد الأقصى المسموح به (${formatMedicalFileSize(MAX_MEDICAL_FILE_SIZE_BYTES)}). يرجى ضغط الفحص أو اختيار شريحة أخرى.` 
    };
  }

  // Extension validation
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  const isImageOrPdf = file.type.startsWith('image/') || file.type === 'application/pdf';

  if (!hasValidExt && !isImageOrPdf && !isDicomFile(file.name, file.type)) {
    return {
      isValid: false,
      error: 'نوع الملف غير مدعوم. الصيغ المدعومة هي: ملفات الأشعة DICOM (.dcm, .dicom) وصور الفحص (.png, .jpg, .webp) وتقارير PDF.'
    };
  }

  return { isValid: true };
}

/**
 * Uploads a DICOM scan or medical image directly to Firebase Cloud Storage.
 * Never stores raw base64 data inside Firestore documents.
 */
export async function uploadMedicalScanFile(
  file: File,
  options: UploadOptions
): Promise<StoredMedicalFile> {
  const validation = validateRadiologyFile(file);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const isDicom = isDicomFile(file.name, file.type);
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeBookingId = options.bookingId ? options.bookingId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'general';
  const safeCenterId = options.centerId.replace(/[^a-zA-Z0-9_-]/g, '_');

  // Strict structured cloud storage path
  const storagePath = `radiology_scans/${safeCenterId}/${safeBookingId}/${timestamp}_${sanitizedName}`;
  const storageRef = ref(storage, storagePath);

  const customMetadata = {
    customMetadata: {
      centerId: options.centerId,
      modality: options.modality,
      patientName: options.patientName || '',
      bookingId: options.bookingId || '',
      uploadedBy: options.uploadedByUid,
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      isDicom: String(isDicom),
    },
    contentType: file.type || (isDicom ? 'application/dicom' : 'application/octet-stream'),
  };

  try {
    const uploadTask = uploadBytesResumable(storageRef, file, customMetadata);

    return await new Promise<StoredMedicalFile>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (options.onProgress) {
            options.onProgress(percent, snapshot);
          }
        },
        (error: any) => {
          console.error('Firebase Storage Upload Error:', error);
          let friendlyError = `فشل رفع الملف الطبي: ${error.message || 'خطأ غير معروف'}`;
          
          if (error.code === 'storage/unauthorized') {
            friendlyError = 'تعذر الرفع: لا تتوفر صلاحيات الكتابة في Firebase Cloud Storage لهذا المستخدم أو لم يتم نشر قواعد التخزين (Storage Rules).';
          } else if (error.code === 'storage/bucket-not-found') {
            friendlyError = 'تعذر الرفع: لم يتم العثور على حاوية التخزين السحابي المحددة في إعدادات المشروع.';
          } else if (error.code === 'storage/quota-exceeded') {
            friendlyError = 'تعذر الرفع: تم تجاوز الحصة المخصصة للتخزين السحابي لمشروع Firebase.';
          } else if (error.code === 'storage/canceled') {
            friendlyError = 'تم إلغاء رفع الملف الطبي.';
          }

          reject(new Error(friendlyError));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            const storedFile: StoredMedicalFile = {
              id: `scan_${timestamp}_${Math.random().toString(36).substring(2, 7)}`,
              name: file.name,
              size: file.size,
              sizeFormatted: formatMedicalFileSize(file.size),
              modality: options.modality,
              storagePath,
              downloadUrl,
              mimeType: file.type || (isDicom ? 'application/dicom' : 'application/octet-stream'),
              uploadedAt: new Date().toISOString(),
              uploadedBy: options.uploadedByUid,
              patientName: options.patientName,
              bookingId: options.bookingId,
              isDicom,
            };
            resolve(storedFile);
          } catch (err: unknown) {
            reject(err instanceof Error ? err : new Error('فشل جلب رابط التحميل الآمن من التخزين السحابي'));
          }
        }
      );
    });
  } catch (err: unknown) {
    console.error('Storage Exception:', err);
    throw err instanceof Error ? err : new Error(String(err));
  }
}
