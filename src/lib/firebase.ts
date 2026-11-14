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
  getDocs,
  query,
  limit,
  onSnapshot,
  disableNetwork,
  enableNetwork,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  removeOfflineMutation,
  OfflineMutationType
} from './offlineSyncQueue';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// CRITICAL: Initialize Firestore with ignoreUndefinedProperties & IndexedDB persistent local cache for offline support
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch {
  try {
    dbInstance = initializeFirestore(app, {
      ignoreUndefinedProperties: true
    }, firebaseConfig.firestoreDatabaseId);
  } catch {
    dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
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
  onUpdate: (participants: any[], fromCache?: boolean) => void,
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
      onUpdate(items, snapshot.metadata.fromCache);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

export interface CloudWriteResult {
  success: boolean;
  queuedOffline?: boolean;
  error?: string;
  isNetworkError?: boolean;
  isQuotaError?: boolean;
}

export interface CloudWriteOptions {
  bypassQuotaGuard?: boolean;
  skipOfflineQueue?: boolean;
}

const CLOUD_WRITE_TIMEOUT_MS = 10000;
const QUOTA_EXCEEDED_USER_MSG =
  'Kuota tulis harian Cloud Firestore telah tercapai. Kuota akan direset otomatis keesokan harinya. Perubahan tetap disimpan secara lokal di perangkat ini.';

let writeQuotaExceeded = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();
const pendingQuotaAbortRejectors = new Set<(err: Error) => void>();
let quotaConsoleObserverInstalled = false;

export function isQuotaExceededError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('free daily write') ||
    lower.includes('free daily read') ||
    lower.includes('write units per project') ||
    lower.includes('read units per project')
  );
}

export function isCloudWriteQuotaExceeded(): boolean {
  return writeQuotaExceeded;
}

export function subscribeToCloudQuota(listener: (exceeded: boolean) => void): () => void {
  quotaListeners.add(listener);
  listener(writeQuotaExceeded);
  return () => {
    quotaListeners.delete(listener);
  };
}

export function markCloudWriteQuotaExceeded(): void {
  if (!writeQuotaExceeded) {
    writeQuotaExceeded = true;
    quotaListeners.forEach(cb => {
      try {
        cb(true);
      } catch {
        // ignore listener errors
      }
    });
  }

  // Abort any in-flight mutation waiting on Firestore's retry stream
  if (pendingQuotaAbortRejectors.size > 0) {
    const quotaErr = new Error('Quota limit exceeded (Free daily write units per project).');
    const rejectors = Array.from(pendingQuotaAbortRejectors);
    pendingQuotaAbortRejectors.clear();
    rejectors.forEach(reject => {
      try {
        reject(quotaErr);
      } catch {
        // ignore
      }
    });
  }

  // Pause Firestore background retry stream so SDK stops "Using maximum backoff delay" loops
  void disableNetwork(db).catch(() => undefined);
}

export async function resetCloudWriteQuotaGuard(): Promise<void> {
  writeQuotaExceeded = false;
  quotaListeners.forEach(cb => {
    try {
      cb(false);
    } catch {
      // ignore
    }
  });
  try {
    await enableNetwork(db);
  } catch {
    // ignore
  }
}

function installFirestoreQuotaObserver(): void {
  if (quotaConsoleObserverInstalled || typeof console === 'undefined') return;
  quotaConsoleObserverInstalled = true;

  const inspectArgs = (args: unknown[]) => {
    try {
      if (!args || args.length === 0) return;
      const joined = args.map(a => (typeof a === 'string' ? a : String(a || ''))).join(' ');
      const lower = joined.toLowerCase();
      if (
        lower.includes('@firebase/firestore') &&
        (lower.includes('quota limit exceeded') ||
          lower.includes('free daily write units') ||
          lower.includes('free daily read units'))
      ) {
        markCloudWriteQuotaExceeded();
      }
    } catch {
      // ignore
    }
  };

  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    inspectArgs(args);
    origError(...args);
  };

  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    inspectArgs(args);
    origWarn(...args);
  };
}

installFirestoreQuotaObserver();

export function classifyCloudError(
  error: unknown
): { message: string; isNetworkError: boolean; isQuotaError: boolean } {
  const raw = error instanceof Error ? error.message : String(error || '');
  const lower = raw.toLowerCase();

  // Check quota errors BEFORE generic resource-exhausted so daily write quota is never mislabeled as 1 MB payload size
  if (isQuotaExceededError(error)) {
    return {
      message: QUOTA_EXCEEDED_USER_MSG,
      isNetworkError: false,
      isQuotaError: true
    };
  }

  if (
    (typeof navigator !== 'undefined' && !navigator.onLine) ||
    lower.includes('offline') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('unavailable') ||
    lower.includes('timeout') ||
    lower.includes('deadline-exceeded')
  ) {
    return {
      message: 'Gangguan jaringan atau koneksi internet terputus. Data belum terkirim ke server Cloud. Periksa koneksi Anda lalu klik Coba Lagi.',
      isNetworkError: true,
      isQuotaError: false
    };
  }

  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return {
      message: 'Akses penyimpanan Cloud ditolak oleh aturan keamanan server.',
      isNetworkError: false,
      isQuotaError: false
    };
  }

  if (
    lower.includes('resource-exhausted') ||
    lower.includes('longer than 1048487') ||
    lower.includes('maximum allowed size') ||
    lower.includes('payload too large')
  ) {
    return {
      message: 'Ukuran berkas atau foto terlalu besar untuk disimpan ke Cloud (maks. 1 MB). Silakan pilih gambar yang lebih kecil.',
      isNetworkError: false,
      isQuotaError: false
    };
  }

  return {
    message: raw || 'Terjadi kesalahan saat menyimpan data ke server Cloud.',
    isNetworkError: false,
    isQuotaError: false
  };
}

async function executeCloudMutation(
  operation: () => Promise<void>,
  operationType: OperationType,
  path: string,
  options?: CloudWriteOptions,
  offlineSpec?: { type: OfflineMutationType; entityId: string; payload?: any }
): Promise<CloudWriteResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (offlineSpec && !options?.skipOfflineQueue) {
      enqueueOfflineMutation(offlineSpec.type, offlineSpec.entityId, offlineSpec.payload);
      return {
        success: false,
        queuedOffline: true,
        isNetworkError: true,
        isQuotaError: false,
        error: 'Perangkat sedang offline. Perubahan disimpan lokal & masuk antrean sinkronisasi otomatis.'
      };
    }
    return {
      success: false,
      isNetworkError: true,
      isQuotaError: false,
      error: 'Perangkat sedang offline (tidak ada koneksi internet). Data belum tersimpan ke Cloud.'
    };
  }

  if (writeQuotaExceeded && !options?.bypassQuotaGuard) {
    return {
      success: false,
      isNetworkError: false,
      isQuotaError: true,
      error: QUOTA_EXCEEDED_USER_MSG
    };
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortRejector: ((err: Error) => void) | undefined;

  try {
    await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        abortRejector = reject;
        pendingQuotaAbortRejectors.add(reject);
        timeoutId = setTimeout(() => {
          reject(new Error('network timeout: Server Cloud tidak merespons dalam batas waktu.'));
        }, CLOUD_WRITE_TIMEOUT_MS);
      })
    ]);
    return { success: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markCloudWriteQuotaExceeded();
    } else {
      handleFirestoreError(error, operationType, path);
    }
    const classified = classifyCloudError(error);
    if (classified.isNetworkError && offlineSpec && !options?.skipOfflineQueue) {
      enqueueOfflineMutation(offlineSpec.type, offlineSpec.entityId, offlineSpec.payload);
      return {
        success: false,
        queuedOffline: true,
        error: 'Koneksi ke Cloud terputus. Perubahan disimpan lokal & akan otomatis tersinkron saat online.',
        isNetworkError: true,
        isQuotaError: false
      };
    }
    return {
      success: false,
      error: classified.message,
      isNetworkError: classified.isNetworkError,
      isQuotaError: classified.isQuotaError
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (abortRejector) pendingQuotaAbortRejectors.delete(abortRejector);
  }
}

export async function saveParticipantToCloud(
  participant: any,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  if (!participant || !participant.id) {
    return { success: false, error: 'ID peserta tidak valid' };
  }
  const path = `participants/${participant.id}`;
  const cleanDoc = sanitizeForFirestore({
    ...participant,
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'participants', participant.id), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'participant_save', entityId: participant.id, payload: cleanDoc }
  );
}

export async function deleteParticipantFromCloud(
  participantId: string,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = `participants/${participantId}`;
  return executeCloudMutation(
    () => deleteDoc(doc(db, 'participants', participantId)),
    OperationType.DELETE,
    path,
    options,
    { type: 'participant_delete', entityId: participantId }
  );
}

// 2. USERS (Akun Admin, Juri, Sekolah)
export function subscribeToUsers(
  onUpdate: (users: any[], fromCache?: boolean) => void,
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
      onUpdate(items, snapshot.metadata.fromCache);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );
}

export async function saveUserToCloud(
  user: any,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  if (!user || !user.username) {
    return { success: false, error: 'Username tidak valid' };
  }
  const cleanUsername = String(user.username).trim().toLowerCase().replace(/\s+/g, '');
  const path = `users/${cleanUsername}`;
  const cleanDoc = sanitizeForFirestore({
    ...user,
    username: cleanUsername,
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'users', cleanUsername), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'user_save', entityId: cleanUsername, payload: cleanDoc }
  );
}

export async function deleteUserFromCloud(
  username: string,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const cleanUsername = String(username).trim().toLowerCase().replace(/\s+/g, '');
  const path = `users/${cleanUsername}`;
  return executeCloudMutation(
    () => deleteDoc(doc(db, 'users', cleanUsername)),
    OperationType.DELETE,
    path,
    options,
    { type: 'user_delete', entityId: cleanUsername }
  );
}

// 3. CONFIG (Kriteria & Bobot)
export function subscribeToConfig(
  onUpdate: (config: any, fromCache?: boolean) => void,
  onError?: (err: any) => void
) {
  const path = 'config/criteria_config';
  return onSnapshot(
    doc(db, 'config', 'criteria_config'),
    docSnap => {
      if (docSnap.exists()) {
        onUpdate(docSnap.data().categories, docSnap.metadata.fromCache);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveConfigToCloud(
  categories: any,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'config/criteria_config';
  const cleanDoc = sanitizeForFirestore({
    id: 'criteria_config',
    categories,
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'config', 'criteria_config'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'config_save', entityId: 'criteria_config', payload: categories }
  );
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

export async function saveLogoToCloud(
  logoUrl: string | null,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'settings/global_logo';
  const cleanDoc = sanitizeForFirestore({
    id: 'global_logo',
    logoUrl: logoUrl || '',
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'settings', 'global_logo'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'logo_save', entityId: 'global_logo', payload: logoUrl }
  );
}

// 5. REGISTRATIONS (Formulir Pendaftaran PKS) + Offline Local Cache Overlay
const REGISTRATIONS_CACHE_KEY = 'PBB_PKS_REGISTRATIONS_CACHE_V1';
const registrationLocalOverlayListeners = new Set<() => void>();

export function getCachedRegistrationsFromLocal(): any[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(REGISTRATIONS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheRegistrationsToLocal(items: any[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(REGISTRATIONS_CACHE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore storage quota errors
  }
}

function applyOfflineRegistrationOverlay(baseItems: any[]): any[] {
  const queue = getOfflineQueue();
  let merged = [...baseItems];
  for (const item of queue) {
    if (item.type === 'registration_save' && item.payload) {
      const idx = merged.findIndex(r => r.id === item.entityId);
      if (idx >= 0) {
        merged[idx] = item.payload;
      } else {
        merged = [item.payload, ...merged];
      }
    } else if (item.type === 'registration_delete') {
      merged = merged.filter(r => r.id !== item.entityId);
    }
  }
  return merged;
}

export function subscribeToRegistrations(
  onUpdate: (submissions: any[]) => void,
  onError?: (err: any) => void
) {
  const path = 'registrations';
  let latestServerOrCache = getCachedRegistrationsFromLocal();

  const emitMerged = (base: any[]) => {
    const merged = applyOfflineRegistrationOverlay(base);
    cacheRegistrationsToLocal(merged);
    onUpdate(merged);
  };

  const localOverlayHandler = () => {
    emitMerged(latestServerOrCache);
  };
  registrationLocalOverlayListeners.add(localOverlayHandler);

  const unsubFirestore = onSnapshot(
    collection(db, path),
    snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      latestServerOrCache = items;
      emitMerged(items);
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, path);
      if (onError) onError(error);
    }
  );

  return () => {
    registrationLocalOverlayListeners.delete(localOverlayHandler);
    unsubFirestore();
  };
}

export async function saveRegistrationToCloud(
  submission: any,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  if (!submission || !submission.id) {
    return { success: false, error: 'ID formulir tidak valid' };
  }
  const path = `registrations/${submission.id}`;
  const cleanDoc = sanitizeForFirestore({
    ...submission,
    updatedAt: new Date().toISOString()
  });
  const res = await executeCloudMutation(
    () => setDoc(doc(db, 'registrations', submission.id), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'registration_save', entityId: submission.id, payload: cleanDoc }
  );
  if (res.queuedOffline) {
    registrationLocalOverlayListeners.forEach(cb => cb());
  }
  return res;
}

export async function deleteRegistrationFromCloud(
  submissionId: string,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = `registrations/${submissionId}`;
  const res = await executeCloudMutation(
    () => deleteDoc(doc(db, 'registrations', submissionId)),
    OperationType.DELETE,
    path,
    options,
    { type: 'registration_delete', entityId: submissionId }
  );
  if (res.queuedOffline) {
    registrationLocalOverlayListeners.forEach(cb => cb());
  }
  return res;
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

export async function saveAppStatusToCloud(
  status: AppStatusConfig,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'settings/app_status';
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
  return executeCloudMutation(
    () => setDoc(doc(db, 'settings', 'app_status'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'app_status_save', entityId: 'app_status', payload: cleanDoc }
  );
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

export async function savePaymentConfigToCloud(
  config: PaymentConfig,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'settings/payment_config';
  const cleanDoc = sanitizeForFirestore({
    ...config,
    id: 'payment_config',
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'settings', 'payment_config'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'payment_config_save', entityId: 'payment_config', payload: cleanDoc }
  );
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

export async function saveBlankoConfigToCloud(
  config: BlankoConfig,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'settings/blanko_config';
  const cleanDoc = sanitizeForFirestore({
    ...config,
    id: 'blanko_config',
    updatedAt: new Date().toISOString()
  });
  return executeCloudMutation(
    () => setDoc(doc(db, 'settings', 'blanko_config'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'blanko_config_save', entityId: 'blanko_config', payload: cleanDoc }
  );
}

// ==========================================
// 8. LEGACY ACTIVITY LOGS CLEANUP (QUOTA SAVER)
// ==========================================

const LEGACY_ACTIVITY_LOGS_STORAGE_KEY = 'pks_activity_logs_v1';
const LEGACY_ACTIVITY_LOGS_DOC_ID = 'activity_logs_store';
const LEGACY_LOG_PURGE_DONE_KEY = 'pks_legacy_activity_logs_purged_v1';

export function clearLegacyLocalActivityLogs(): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_ACTIVITY_LOGS_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function purgeLegacyActivityLogsFromCloudAndLocal(): Promise<void> {
  clearLegacyLocalActivityLogs();

  try {
    if (typeof window !== 'undefined' && window.localStorage.getItem(LEGACY_LOG_PURGE_DONE_KEY) === '1') {
      return;
    }
  } catch {
    // ignore storage errors
  }

  if ((typeof navigator !== 'undefined' && !navigator.onLine) || isCloudWriteQuotaExceeded()) {
    return;
  }

  try {
    await deleteDoc(doc(db, 'settings', LEGACY_ACTIVITY_LOGS_DOC_ID));

    let batchRounds = 0;
    let hasMoreLegacyDocs = false;
    while (batchRounds < 5 && !isCloudWriteQuotaExceeded()) {
      batchRounds += 1;
      const snap = await getDocs(query(collection(db, 'activity_logs'), limit(50)));
      if (snap.empty) {
        hasMoreLegacyDocs = false;
        break;
      }
      for (const d of snap.docs) {
        if (isCloudWriteQuotaExceeded()) break;
        await deleteDoc(d.ref);
      }
      hasMoreLegacyDocs = snap.size === 50;
      if (!hasMoreLegacyDocs) break;
    }

    if (!hasMoreLegacyDocs && !isCloudWriteQuotaExceeded()) {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LEGACY_LOG_PURGE_DONE_KEY, '1');
        }
      } catch {
        // ignore
      }
    }
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markCloudWriteQuotaExceeded();
    }
  }
}

// ==========================================
// 9. OFFLINE QUEUE AUTO-FLUSH MANAGER
// ==========================================

export interface OfflineFlushSummary {
  flushedCount: number;
  remainingCount: number;
  hadQuotaError: boolean;
  hadNetworkError: boolean;
}

let activeFlushPromise: Promise<OfflineFlushSummary> | null = null;

export async function flushOfflineSyncQueue(): Promise<OfflineFlushSummary> {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      return { flushedCount: 0, remainingCount: 0, hadQuotaError: false, hadNetworkError: false };
    }

    if ((typeof navigator !== 'undefined' && !navigator.onLine) || isCloudWriteQuotaExceeded()) {
      return {
        flushedCount: 0,
        remainingCount: queue.length,
        hadQuotaError: isCloudWriteQuotaExceeded(),
        hadNetworkError: typeof navigator !== 'undefined' ? !navigator.onLine : false
      };
    }

    let flushedCount = 0;
    let hadQuotaError = false;
    let hadNetworkError = false;

    for (const item of queue) {
      let res: CloudWriteResult = { success: true };
      const opts: CloudWriteOptions = { skipOfflineQueue: true };

      switch (item.type) {
        case 'participant_save':
          res = await saveParticipantToCloud(item.payload, opts);
          break;
        case 'participant_delete':
          res = await deleteParticipantFromCloud(item.entityId, opts);
          break;
        case 'user_save':
          res = await saveUserToCloud(item.payload, opts);
          break;
        case 'user_delete':
          res = await deleteUserFromCloud(item.entityId, opts);
          break;
        case 'config_save':
          res = await saveConfigToCloud(item.payload, opts);
          break;
        case 'logo_save':
          res = await saveLogoToCloud(item.payload, opts);
          break;
        case 'app_status_save':
          res = await saveAppStatusToCloud(item.payload, opts);
          break;
        case 'payment_config_save':
          res = await savePaymentConfigToCloud(item.payload, opts);
          break;
        case 'blanko_config_save':
          res = await saveBlankoConfigToCloud(item.payload, opts);
          break;
        case 'registration_save':
          res = await saveRegistrationToCloud(item.payload, opts);
          break;
        case 'registration_delete':
          res = await deleteRegistrationFromCloud(item.entityId, opts);
          break;
      }

      if (res.success) {
        removeOfflineMutation(item.key);
        flushedCount += 1;
      } else if (res.isQuotaError) {
        hadQuotaError = true;
        break;
      } else if (res.isNetworkError) {
        hadNetworkError = true;
        break;
      } else {
        // Non-retryable payload/permission error: drop from queue so it doesn't block subsequent items
        removeOfflineMutation(item.key);
      }
    }

    return {
      flushedCount,
      remainingCount: getOfflineQueue().length,
      hadQuotaError,
      hadNetworkError
    };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}




