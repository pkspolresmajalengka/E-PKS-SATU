import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with ignoreUndefinedProperties to prevent crashes on optional/undefined fields
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = dbInstance;
export const auth = getAuth(app);

// Error Handling Enums and Types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo:
        auth?.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Recursively removes undefined fields and cleans plain JS objects
 * so Firestore never encounters unsupported undefined values.
 */
export function sanitizeForFirestore<T = any>(val: T): T {
  if (val === undefined) {
    return null as any;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      clean[k] = sanitizeForFirestore(v);
    }
  }
  return clean as T;
}

// Connection test
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline, using offline cache.');
    }
    return false;
  }
}

// ==========================================
// REAL-TIME FIRESTORE LISTENERS & SYNC HELPERS
// ==========================================

// 1. PARTICIPANTS (Peserta Lomba)
export function subscribeToParticipants(
  onUpdate: (participants: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'participants';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      onUpdate(items);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

export async function saveParticipantToCloud(participant: any): Promise<{ success: boolean; error?: string }> {
  if (!participant || !participant.id) {
    return { success: false, error: 'ID peserta tidak valid' };
  }
  const path = `participants/${participant.id}`;
  try {
    const cleanDoc = sanitizeForFirestore({
      ...participant,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'participants', participant.id), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

export async function deleteParticipantFromCloud(participantId: string): Promise<{ success: boolean; error?: string }> {
  const path = `participants/${participantId}`;
  try {
    await deleteDoc(doc(db, 'participants', participantId));
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.DELETE, path);
    return { success: false, error: errInfo.error };
  }
}

// 2. USERS (Akun Admin, Juri, Sekolah)
export function subscribeToUsers(
  onUpdate: (users: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'users';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      onUpdate(items);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

export async function saveUserToCloud(user: any): Promise<{ success: boolean; error?: string }> {
  if (!user || !user.username) {
    return { success: false, error: 'Username tidak valid' };
  }
  const cleanUsername = String(user.username).trim().toLowerCase().replace(/\s+/g, '');
  const path = `users/${cleanUsername}`;
  try {
    const cleanDoc = sanitizeForFirestore({
      ...user,
      username: cleanUsername,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'users', cleanUsername), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

export async function deleteUserFromCloud(username: string): Promise<{ success: boolean; error?: string }> {
  const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');
  const path = `users/${cleanUsername}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUsername));
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.DELETE, path);
    return { success: false, error: errInfo.error };
  }
}

// 3. CONFIG (Kriteria & Bobot)
export function subscribeToConfig(
  onUpdate: (config: any) => void,
  onError?: (err: any) => void
) {
  const path = 'config/criteria_config';
  return onSnapshot(
    doc(db, 'config', 'criteria_config'),
    docSnap => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data().categories);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveConfigToCloud(categories: any): Promise<{ success: boolean; error?: string }> {
  const path = 'config/criteria_config';
  try {
    const cleanDoc = sanitizeForFirestore({
      id: 'criteria_config',
      categories,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'config', 'criteria_config'), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

// 4. LOGO (Pengaturan Logo Aplikasi)
export function subscribeToLogo(
  onUpdate: (logoUrl: string | null) => void,
  onError?: (err: any) => void
) {
  const path = 'settings/global_logo';
  return onSnapshot(
    doc(db, 'settings', 'global_logo'),
    docSnap => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data().logoUrl || null);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveLogoToCloud(logoUrl: string | null): Promise<{ success: boolean; error?: string }> {
  const path = 'settings/global_logo';
  try {
    const cleanDoc = sanitizeForFirestore({
      id: 'global_logo',
      logoUrl: logoUrl || '',
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'settings', 'global_logo'), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

// 5. REGISTRATIONS (Formulir Pendaftaran PKS)
export function subscribeToRegistrations(
  onUpdate: (submissions: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'registrations';
  return onSnapshot(
    collection(db, path),
    snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      onUpdate(items);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

export async function saveRegistrationToCloud(submission: any): Promise<{ success: boolean; error?: string }> {
  if (!submission || !submission.id) {
    return { success: false, error: 'ID formulir tidak valid' };
  }
  const path = `registrations/${submission.id}`;
  try {
    const cleanDoc = sanitizeForFirestore({
      ...submission,
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'registrations', submission.id), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

export async function deleteRegistrationFromCloud(submissionId: string): Promise<{ success: boolean; error?: string }> {
  const path = `registrations/${submissionId}`;
  try {
    await deleteDoc(doc(db, 'registrations', submissionId));
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.DELETE, path);
    return { success: false, error: errInfo.error };
  }
}

// 6. APP STATUS & MAINTENANCE (Aktivasi / Nonaktivasi Aplikasi dengan Kustomisasi Teks)
export interface AppStatusConfig {
  id?: string;
  isActive: boolean;
  title: string;
  message: string;
  estimateTime?: string;
  contactInfo?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export function subscribeToAppStatus(
  onUpdate: (status: AppStatusConfig) => void,
  onError?: (err: any) => void
) {
  const path = 'settings/app_status';
  return onSnapshot(
    doc(db, 'settings', 'app_status'),
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          id: 'app_status',
          isActive: typeof data.isActive === 'boolean' ? data.isActive : true,
          title: data.title || 'Aplikasi Sedang Dinonaktifkan Sementara',
          message:
            data.message ||
            'Sistem E-Rekapitulasi Lomba PBB & PKS sedang ditutup sementara oleh Panitia Pelaksana. Harap hubungi administrator untuk informasi lebih lanjut.',
          estimateTime: data.estimateTime || '',
          contactInfo: data.contactInfo || '',
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || ''
        });
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveAppStatusToCloud(status: AppStatusConfig): Promise<{ success: boolean; error?: string }> {
  const path = 'settings/app_status';
  try {
    const cleanDoc = sanitizeForFirestore({
      id: 'app_status',
      isActive: status.isActive,
      title: status.title,
      message: status.message,
      estimateTime: status.estimateTime || '',
      contactInfo: status.contactInfo || '',
      updatedAt: new Date().toISOString(),
      updatedBy: status.updatedBy || 'admin'
    });
    await setDoc(doc(db, 'settings', 'app_status'), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

// 7. PAYMENT GATEWAY & REGISTRATION FEE CONFIGURATION
export interface FormFeeConfig {
  fee: number;
  isFree: boolean;
  description: string;
}

export interface PaymentConfig {
  id?: string;
  formFees: {
    polisi_pelajar: FormFeeConfig;
    calon_pks: FormFeeConfig;
    kemah_balok1: FormFeeConfig;
    pks_balok2: FormFeeConfig;
  };
  midtrans: {
    enabled: boolean;
    isProduction: boolean;
    clientKey: string;
    serverKey: string;
    merchantId: string;
  };
  ratapay: {
    enabled: boolean;
    apiKey: string;
    merchantCode: string;
  };
  qris: {
    enabled: boolean;
    merchantName: string;
    qrisImageUrl: string;
    instruction: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    instruction: string;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  id: 'payment_config',
  formFees: {
    polisi_pelajar: {
      fee: 50000,
      isFree: false,
      description: 'Biaya registrasi seleksi, uji fisik, dan penerbitan lencana Polisi Pelajar'
    },
    calon_pks: {
      fee: 45000,
      isFree: false,
      description: 'Biaya pendaftaran seleksi calon anggota & modul diklat dasar PKS'
    },
    kemah_balok1: {
      fee: 150000,
      isFree: false,
      description: 'Biaya perkemahan pelantikan tingkat Balok 1 (Tenda, konsumsi, atribut)'
    },
    pks_balok2: {
      fee: 75000,
      isFree: false,
      description: 'Biaya ujian komprehensif kepangkatan Balok 2 & sertifikasi Satlantas'
    }
  },
  midtrans: {
    enabled: true,
    isProduction: false,
    clientKey: 'SB-Mid-client-demoPKS2026',
    serverKey: 'SB-Mid-server-demoPKS2026',
    merchantId: 'M-PKS2026'
  },
  ratapay: {
    enabled: true,
    apiKey: 'RATA-API-KEY-PKS2026',
    merchantCode: 'PKS-MAJALENGKA-01'
  },
  qris: {
    enabled: true,
    merchantName: 'PANITIA LOMBA PKS POLRES',
    qrisImageUrl: '',
    instruction: 'Scan QRIS resmi panitia menggunakan m-Banking (BCA, Mandiri, BRI, BNI) atau dompet digital (GoPay, OVO, Dana, ShopeePay).'
  },
  bankTransfer: {
    enabled: true,
    bankName: 'Bank Mandiri',
    accountNumber: '137-00-9876543-2',
    accountHolder: 'Panitia Pelaksana Lomba PBB PKS',
    instruction: 'Transfer sesuai nominal tagihan pendaftaran. Sertakan berita acara: "[Jenis Form] - [Asal Sekolah]". Simpan dan unggah struk bukti transfer.'
  }
};

export interface VerificationStage {
  status: 'pending' | 'approved' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
  officialNumber?: string;
  registrationNumber?: string;
}

export interface RegistrationSubmission {
  id: string;
  formType: 'polisi_pelajar' | 'calon_pks' | 'kemah_balok1' | 'pks_balok2';
  formTitle: string;
  schoolName: string;
  schoolUsername: string;
  schoolLevel: 'SLTP' | 'SLTA';
  applicantName: string;
  contactWa: string;
  formData: Record<string, any>;
  feeAmount: number;
  paymentMethod: 'midtrans' | 'ratapay' | 'qris' | 'bank_transfer' | 'free';
  paymentStatus: 'unpaid' | 'pending_verification' | 'paid' | 'rejected';
  paymentProofUrl?: string;
  paymentProofFileName?: string;
  paymentDate?: string;
  paymentReference?: string;
  registrationNumber?: string;
  stage1Finance: VerificationStage;
  stage2Committee: VerificationStage;
  createdAt: string;
  updatedAt: string;
}

export function subscribeToPaymentConfig(
  onUpdate: (config: PaymentConfig) => void,
  onError?: (err: any) => void
) {
  const path = 'settings/payment_config';
  return onSnapshot(
    doc(db, 'settings', 'payment_config'),
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          id: 'payment_config',
          formFees: {
            polisi_pelajar: data.formFees?.polisi_pelajar || DEFAULT_PAYMENT_CONFIG.formFees.polisi_pelajar,
            calon_pks: data.formFees?.calon_pks || DEFAULT_PAYMENT_CONFIG.formFees.calon_pks,
            kemah_balok1: data.formFees?.kemah_balok1 || DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1,
            pks_balok2: data.formFees?.pks_balok2 || DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2
          },
          midtrans: {
            ...DEFAULT_PAYMENT_CONFIG.midtrans,
            ...(data.midtrans || {})
          },
          ratapay: {
            ...DEFAULT_PAYMENT_CONFIG.ratapay,
            ...(data.ratapay || {})
          },
          qris: {
            ...DEFAULT_PAYMENT_CONFIG.qris,
            ...(data.qris || {})
          },
          bankTransfer: {
            ...DEFAULT_PAYMENT_CONFIG.bankTransfer,
            ...(data.bankTransfer || {})
          },
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || ''
        });
      } else {
        onUpdate(DEFAULT_PAYMENT_CONFIG);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function savePaymentConfigToCloud(config: PaymentConfig): Promise<{ success: boolean; error?: string }> {
  const path = 'settings/payment_config';
  try {
    const cleanDoc = sanitizeForFirestore({
      ...config,
      id: 'payment_config',
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'settings', 'payment_config'), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

// ==========================================
// BLANKO TEMPLATE CUSTOMIZATION (EDIT BLANGKO)
// ==========================================

export interface BlankoFormCustomization {
  judul: string;
  nomorPrefix: string;
  syaratBerkas: string;
  ttd1Label: string;
  ttd2Label: string;
  ttd3Label: string;
  ttd3Nama: string;
  ttd3Nrp?: string;
}

export interface BlankoConfig {
  id?: string;
  kopSurat: {
    instansi: string;
    poldaPolres: string;
    satuan: string;
    lembaga: string;
    alamat: string;
    watermarkText: string;
    kotaTtd: string;
    tahun: string;
  };
  forms: {
    polisi_pelajar: BlankoFormCustomization;
    calon_pks: BlankoFormCustomization;
    kemah_balok1: BlankoFormCustomization;
    pks_balok2: BlankoFormCustomization;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_BLANKO_CONFIG: BlankoConfig = {
  id: 'blanko_config',
  kopSurat: {
    instansi: 'KEPOLISIAN NEGARA REPUBLIK INDONESIA',
    poldaPolres: 'DAERAH JAWA BARAT - RESOR MAJALENGKA',
    satuan: 'SATUAN LALU LINTAS • UNIT KAMSEL',
    lembaga: 'KORPS PATROLI KEAMANAN SEKOLAH (PKS)',
    alamat: 'Sekretariat: Jl. K.H. Abdul Halim No. 518 Majalengka 45418 • Telp: (0233) 281110 • Email: pks.resmajalengka@gmail.com',
    watermarkText: 'PASUKAN PKS',
    kotaTtd: 'Majalengka',
    tahun: '2026'
  },
  forms: {
    polisi_pelajar: {
      judul: 'FORMULIR PENDAFTARAN ANGGOTA POLISI PELAJAR (POLJAR)',
      nomorPrefix: 'POLJAR/2026/01-REG',
      syaratBerkas: '1. Pas Foto 3x4 berseragam lengkap (2 lembar)\n2. Surat Izin Orang Tua/Wali Siswa\n3. Fotokopi Kartu Pelajar / Surat Keterangan Kepala Sekolah',
      ttd1Label: 'Calon Anggota Polisi Pelajar',
      ttd2Label: 'Pembina PKS Pangkalan',
      ttd3Label: 'Kasat Lantas Polres Majalengka',
      ttd3Nama: 'AKP Mochamad Ali, S.H., M.M.',
      ttd3Nrp: 'NRP 78090123'
    },
    calon_pks: {
      judul: 'FORMULIR BIODATA CALON ANGGOTA PATROLI KEAMANAN SEKOLAH (PKS)',
      nomorPrefix: 'PKS-CAP/2026/REG-01',
      syaratBerkas: '1. Pas Foto 3x4 seragam sekolah (2 lembar)\n2. Surat Pernyataan Kesediaan Mengikuti Seluruh Rangkaian Diklat\n3. Surat Rekomendasi Kesiswaan',
      ttd1Label: 'Calon Anggota PKS',
      ttd2Label: 'Pembina PKS Pangkalan',
      ttd3Label: 'Kanit Kamsel Satlantas Polres',
      ttd3Nama: 'Ipda Supriatna',
      ttd3Nrp: 'NRP 82050456'
    },
    kemah_balok1: {
      judul: 'FORMULIR PENDAFTARAN PERKEMAHAN & DIKLAT PKS BALOK 1',
      nomorPrefix: 'BALOK1/KEMAH/2026/01',
      syaratBerkas: '1. Surat Tugas/Mandat Kepala Sekolah\n2. Formulir Registrasi Regu Peserta Lengkap (12 Anggota)\n3. Surat Keterangan Sehat dari Fasilitas Kesehatan / Puskesmas',
      ttd1Label: 'Ketua Regu / Pinsat',
      ttd2Label: 'Pembina Pendamping',
      ttd3Label: 'Ketua Panitia Pelaksana',
      ttd3Nama: 'Iptu Agus Salim',
      ttd3Nrp: 'NRP 80030112'
    },
    pks_balok2: {
      judul: 'FORMULIR UJIAN KENAIKAN TINGKAT INSTRUKTUR PKS BALOK 2',
      nomorPrefix: 'BALOK2/UJI/2026/01',
      syaratBerkas: '1. Fotokopi Sertifikat Kelulusan PKS Balok 1\n2. Surat Rekomendasi Pembina PKS Pangkalan\n3. Surat Izin Tertulis dari Kepala Sekolah',
      ttd1Label: 'Peserta Ujian Balok 2',
      ttd2Label: 'Pembina PKS Pangkalan',
      ttd3Label: 'Tim Penguji Satlantas Polri',
      ttd3Nama: 'Iptu Agus Salim',
      ttd3Nrp: 'NRP 80030112'
    }
  }
};

export function subscribeToBlankoConfig(
  onUpdate: (config: BlankoConfig) => void,
  onError?: (err: any) => void
) {
  const path = 'settings/blanko_config';
  return onSnapshot(
    doc(db, 'settings', 'blanko_config'),
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          id: 'blanko_config',
          kopSurat: {
            ...DEFAULT_BLANKO_CONFIG.kopSurat,
            ...(data.kopSurat || {})
          },
          forms: {
            polisi_pelajar: {
              ...DEFAULT_BLANKO_CONFIG.forms.polisi_pelajar,
              ...(data.forms?.polisi_pelajar || {})
            },
            calon_pks: {
              ...DEFAULT_BLANKO_CONFIG.forms.calon_pks,
              ...(data.forms?.calon_pks || {})
            },
            kemah_balok1: {
              ...DEFAULT_BLANKO_CONFIG.forms.kemah_balok1,
              ...(data.forms?.kemah_balok1 || {})
            },
            pks_balok2: {
              ...DEFAULT_BLANKO_CONFIG.forms.pks_balok2,
              ...(data.forms?.pks_balok2 || {})
            }
          },
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || ''
        });
      } else {
        onUpdate(DEFAULT_BLANKO_CONFIG);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveBlankoConfigToCloud(config: BlankoConfig): Promise<{ success: boolean; error?: string }> {
  const path = 'settings/blanko_config';
  try {
    const cleanDoc = sanitizeForFirestore({
      ...config,
      id: 'blanko_config',
      updatedAt: new Date().toISOString()
    });
    await setDoc(doc(db, 'settings', 'blanko_config'), cleanDoc);
    return { success: true };
  } catch (error) {
    const errInfo = handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false, error: errInfo.error };
  }
}

