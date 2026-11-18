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
  getPendingServerBackupMutations,
  markMutationsBackedUpToServer,
  removeOfflineMutation,
  OfflineMutationType
} from './offlineSyncQueue';
import { pushServerBackupDelta } from './serverBackupClient';

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
export const FIREBASE_PRICING_URL = 'https://firebase.google.com/pricing#cloud-firestore';
export const FIRESTORE_UPGRADE_CONSOLE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

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
  if (isCloudWriteQuotaExceeded()) {
    return false;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markCloudWriteQuotaExceeded();
      return false;
    }
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

export type CloudConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'quota_paused'
  | 'offline'
  | 'error';

export interface CloudWriteResult {
  success: boolean;
  queuedOffline?: boolean;
  backedUpToServer?: boolean;
  error?: string;
  isNetworkError?: boolean;
  isQuotaError?: boolean;
}

export interface CloudWriteOptions {
  bypassQuotaGuard?: boolean;
  skipOfflineQueue?: boolean;
  skipServerMirror?: boolean;
}

const CLOUD_WRITE_TIMEOUT_MS = 10000;
const QUOTA_GUARD_STORAGE_KEY = 'pks_firestore_write_quota_day_v1';
const QUOTA_EXCEEDED_USER_MSG =
  'Kuota tulis harian Cloud Firestore tercapai. Perubahan tetap aman di Cadangan Server & perangkat ini, dan akan otomatis dikirim saat kuota direset besok.';

function getCurrentUtcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readPersistedWriteQuotaExceeded(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return window.localStorage.getItem(QUOTA_GUARD_STORAGE_KEY) === getCurrentUtcDayKey();
  } catch {
    return false;
  }
}

function persistWriteQuotaExceeded(exceeded: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (exceeded) {
      window.localStorage.setItem(QUOTA_GUARD_STORAGE_KEY, getCurrentUtcDayKey());
    } else {
      window.localStorage.removeItem(QUOTA_GUARD_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

let writeQuotaExceeded = readPersistedWriteQuotaExceeded();
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
  persistWriteQuotaExceeded(true);
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
  persistWriteQuotaExceeded(false);
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

  const isFirestoreQuotaOrBackoffLog = (args: unknown[]): 'quota' | 'backoff' | null => {
    try {
      if (!args || args.length === 0) return null;
      const joined = args.map(a => (typeof a === 'string' ? a : String(a || ''))).join(' ');
      const lower = joined.toLowerCase();
      if (!lower.includes('@firebase/firestore')) return null;

      if (
        lower.includes('quota limit exceeded') ||
        lower.includes('free daily write units') ||
        lower.includes('free daily read units')
      ) {
        return 'quota';
      }
      if (lower.includes('using maximum backoff delay')) {
        return 'backoff';
      }
      return null;
    } catch {
      return null;
    }
  };

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    const kind = isFirestoreQuotaOrBackoffLog(args);
    if (kind === 'quota') {
      markCloudWriteQuotaExceeded();
      origWarn('[Cloud Quota Guard] Batas kuota tulis harian Firestore tercapai. Beralih ke penyimpanan lokal otomatis hingga besok.');
      return;
    }
    if (kind === 'backoff') {
      if (writeQuotaExceeded) return;
      origWarn(...args);
      return;
    }
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    const kind = isFirestoreQuotaOrBackoffLog(args);
    if (kind === 'quota') {
      markCloudWriteQuotaExceeded();
      return;
    }
    if (kind === 'backoff' && writeQuotaExceeded) {
      return;
    }
    origWarn(...args);
  };
}

installFirestoreQuotaObserver();

// If daily write quota was already exhausted earlier today, immediately pause Firestore network
// before IndexedDB persistent cache attempts to replay pending mutations on reload.
if (writeQuotaExceeded) {
  void disableNetwork(db).catch(() => undefined);
}

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

async function tryBackupDeltaToServer(offlineSpec?: {
  type: OfflineMutationType;
  entityId: string;
  payload?: any;
}): Promise<boolean> {
  if (!offlineSpec) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  const nowIso = new Date().toISOString();
  const res = await pushServerBackupDelta([
    {
      type: offlineSpec.type,
      entityId: offlineSpec.entityId,
      payload: offlineSpec.payload,
      updatedAt: nowIso
    }
  ]);
  if (res?.success) {
    const key = `${offlineSpec.type}:${String(offlineSpec.entityId || 'singleton')}`;
    markMutationsBackedUpToServer([key], nowIso);
    return true;
  }
  return false;
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
    if (offlineSpec && !options?.skipOfflineQueue) {
      enqueueOfflineMutation(offlineSpec.type, offlineSpec.entityId, offlineSpec.payload);
    }
    const backedUpToServer = !options?.skipServerMirror
      ? await tryBackupDeltaToServer(offlineSpec)
      : false;
    return {
      success: false,
      backedUpToServer,
      isNetworkError: false,
      isQuotaError: true,
      error: backedUpToServer
        ? QUOTA_EXCEEDED_USER_MSG
        : 'Kuota tulis harian Cloud Firestore tercapai. Perubahan disimpan lokal di perangkat ini hingga kuota direset.'
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
    // Keep server-side delta backup silently in sync when online
    if (offlineSpec && !options?.skipServerMirror) {
      void tryBackupDeltaToServer(offlineSpec);
    }
    return { success: true };
  } catch (error) {
    let backedUpToServer = false;
    if (isQuotaExceededError(error)) {
      markCloudWriteQuotaExceeded();
      if (offlineSpec && !options?.skipOfflineQueue) {
        enqueueOfflineMutation(offlineSpec.type, offlineSpec.entityId, offlineSpec.payload);
      }
      if (!options?.skipServerMirror) {
        backedUpToServer = await tryBackupDeltaToServer(offlineSpec);
      }
    } else {
      handleFirestoreError(error, operationType, path);
    }
    const classified = classifyCloudError(error);
    if (classified.isNetworkError && offlineSpec && !options?.skipOfflineQueue) {
      enqueueOfflineMutation(offlineSpec.type, offlineSpec.entityId, offlineSpec.payload);
      if (!options?.skipServerMirror) {
        backedUpToServer = await tryBackupDeltaToServer(offlineSpec);
      }
      return {
        success: false,
        queuedOffline: true,
        backedUpToServer,
        error: backedUpToServer
          ? 'Koneksi ke Cloud terputus. Perubahan diamankan di Cadangan Server & antrean lokal.'
          : 'Koneksi ke Cloud terputus. Perubahan disimpan lokal & akan otomatis tersinkron saat online.',
        isNetworkError: true,
        isQuotaError: false
      };
    }
    return {
      success: false,
      backedUpToServer,
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
  mealFee?: number;
  schoolFee?: number;
  isFree: boolean;
  description: string;
}

export interface PoljarSettings {
  tahunAngkatan: string;
  angkatan: string;
  allowInstallment: boolean;
  minDpPercent: number;
}

export interface PaymentConfig {
  id?: string;
  poljarSettings?: PoljarSettings;
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
  poljarSettings: {
    tahunAngkatan: '2026',
    angkatan: '01',
    allowInstallment: true,
    minDpPercent: 30
  },
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
      mealFee: 25000,
      schoolFee: 100000,
      isFree: false,
      description: 'Biaya wajib sekolah per pengajuan (Cash penuh) + biaya dasar peserta & konsumsi Balok 1'
    },
    pks_balok2: {
      fee: 75000,
      mealFee: 25000,
      isFree: false,
      description: 'Biaya dasar per peserta ujian/kemah Balok 2 + opsi konsumsi per peserta'
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

export interface InstallmentPaymentRecord {
  id: string;
  amount: number;
  method: 'midtrans' | 'ratapay' | 'qris' | 'bank_transfer' | 'free';
  date: string;
  proofUrl?: string;
  proofFileName?: string;
  reference?: string;
  status: 'pending_verification' | 'approved' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  note?: string;
  isDp?: boolean;
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
  paymentStatus: 'unpaid' | 'partial' | 'pending_verification' | 'paid' | 'rejected';
  paymentPlan?: 'cash' | 'installment';
  paidAmount?: number;
  remainingAmount?: number;
  minDpAmount?: number;
  pendingPaymentAmount?: number;
  installmentHistory?: InstallmentPaymentRecord[];
  nomorIndukPoljar?: string;
  nippStatus?: 'pending_payment' | 'active';
  tahunAngkatan?: string;
  angkatan?: string;
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

export function normalizeAngkatanCode(angkatan?: string): string {
  const cleaned = String(angkatan || '1').trim();
  if (!cleaned) return '01';
  const digits = cleaned.replace(/\D+/g, '');
  if (digits && digits.length <= 2) {
    return digits.padStart(2, '0');
  }
  return cleaned.toUpperCase();
}

export function formatBirthDateDDMMYYYY(tanggalLahir?: string): string {
  const raw = String(tanggalLahir || '').trim();
  if (!raw) return '';
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (isoMatch) {
    return `${isoMatch[3]}${isoMatch[2]}${isoMatch[1]}`;
  }
  const dmyMatch = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw);
  if (dmyMatch) {
    return `${dmyMatch[1]}${dmyMatch[2]}${dmyMatch[3]}`;
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = String(parsed.getFullYear());
    return `${dd}${mm}${yyyy}`;
  }
  return '';
}

export function generateNomorIndukPoljar(
  tahunAngkatan?: string,
  angkatan?: string,
  tanggalLahir?: string
): string {
  const ddmmyyyy = formatBirthDateDDMMYYYY(tanggalLahir);
  if (!ddmmyyyy) return '';
  const year = String(tahunAngkatan || new Date().getFullYear()).trim() || '2026';
  const ang = normalizeAngkatanCode(angkatan);
  return `PP-${year}-${ang}-${ddmmyyyy}`;
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
          poljarSettings: {
            ...DEFAULT_PAYMENT_CONFIG.poljarSettings!,
            ...(data.poljarSettings || {})
          },
          formFees: {
            polisi_pelajar: {
              ...DEFAULT_PAYMENT_CONFIG.formFees.polisi_pelajar,
              ...(data.formFees?.polisi_pelajar || {})
            },
            calon_pks: {
              ...DEFAULT_PAYMENT_CONFIG.formFees.calon_pks,
              ...(data.formFees?.calon_pks || {})
            },
            kemah_balok1: {
              ...DEFAULT_PAYMENT_CONFIG.formFees.kemah_balok1,
              ...(data.formFees?.kemah_balok1 || {})
            },
            pks_balok2: {
              ...DEFAULT_PAYMENT_CONFIG.formFees.pks_balok2,
              ...(data.formFees?.pks_balok2 || {})
            }
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
// 7B. LOMBA CERDAS CERMAT (SOAL ADMIN & JAWABAN SEKOLAH)
// ==========================================

export type CerdasCermatQuestionType = 'multiple_choice' | 'essay';
export type CerdasCermatOptionKey = 'A' | 'B' | 'C' | 'D';
export type CerdasCermatTargetLevel = 'ALL' | 'SLTP' | 'SLTA';

export interface CerdasCermatQuestionOption {
  key: CerdasCermatOptionKey;
  text: string;
}

export interface CerdasCermatQuestion {
  id: string;
  number: number;
  type: CerdasCermatQuestionType;
  targetLevel: CerdasCermatTargetLevel;
  prompt: string;
  options: CerdasCermatQuestionOption[];
  correctOption: CerdasCermatOptionKey;
  maxPoints: number;
  guideAnswer?: string;
}

export interface CerdasCermatConfig {
  id?: string;
  title: string;
  description: string;
  isOpen: boolean;
  questions: CerdasCermatQuestion[];
  updatedAt?: string;
  updatedBy?: string;
}

export interface CerdasCermatAnswerItem {
  selectedOption?: CerdasCermatOptionKey | '';
  textAnswer?: string;
}

export interface CerdasCermatGradeItem {
  score: number;
  comment?: string;
}

export interface CerdasCermatSubmission {
  id: string;
  schoolUsername: string;
  schoolName: string;
  schoolLevel: 'SLTP' | 'SLTA';
  submittedByName: string;
  participantId?: string;
  participantLabel?: string;
  answers: Record<string, CerdasCermatAnswerItem>;
  questionGrades: Record<string, CerdasCermatGradeItem>;
  autoMcScore: number;
  essayScore: number;
  totalScore: number;
  maxPossibleScore: number;
  status: 'submitted' | 'graded';
  adminNote?: string;
  gradedBy?: string;
  gradedAt?: string;
  submittedAt: string;
  updatedAt: string;
}

export const DEFAULT_CERDAS_CERMAT_CONFIG: CerdasCermatConfig = {
  id: 'cerdas_cermat_config',
  title: 'Lomba Cerdas Cermat Patroli Keamanan Sekolah (PKS) 2026',
  description:
    'Bacalah setiap soal dengan cermat. Jawab seluruh butir Pilihan Ganda maupun Isian/Esai sebelum menekan Kirim Jawaban Final. Setiap akun sekolah hanya dapat mengirimkan jawaban satu kali.',
  isOpen: true,
  questions: [
    {
      id: 'cc-q-1',
      number: 1,
      type: 'multiple_choice',
      targetLevel: 'ALL',
      prompt: 'Apa tugas utama Patroli Keamanan Sekolah (PKS) di lingkungan sekolah?',
      options: [
        { key: 'A', text: 'Membantu menjaga ketertiban lalu lintas dan keamanan di sekitar lingkungan sekolah' },
        { key: 'B', text: 'Menggantikan fungsi seluruh aparat kepolisian di jalan raya umum' },
        { key: 'C', text: 'Menjatuhkan sanksi tilang hukum kepada pengendara umum' },
        { key: 'D', text: 'Mengatur administrasi keuangan tata usaha sekolah' }
      ],
      correctOption: 'A',
      maxPoints: 15,
      guideAnswer: ''
    },
    {
      id: 'cc-q-2',
      number: 2,
      type: 'multiple_choice',
      targetLevel: 'ALL',
      prompt: 'Dalam 12 gerakan dasar pengaturan lalu lintas oleh petugas PKS, isyarat satu tangan diangkat tegak lurus ke atas berarti:',
      options: [
        { key: 'A', text: 'Mempercepat laju kendaraan dari segala arah' },
        { key: 'B', text: 'Menghentikan semua arah arus lalu lintas (Stop Semua Jurusan)' },
        { key: 'C', text: 'Mempersilakan kendaraan belok kiri langsung' },
        { key: 'D', text: 'Memberikan jalan khusus untuk kendaraan mundur' }
      ],
      correctOption: 'B',
      maxPoints: 15,
      guideAnswer: ''
    },
    {
      id: 'cc-q-3',
      number: 3,
      type: 'multiple_choice',
      targetLevel: 'ALL',
      prompt: 'Undang-Undang Republik Indonesia yang mengatur tentang Lalu Lintas dan Angkutan Jalan saat ini adalah:',
      options: [
        { key: 'A', text: 'UU No. 20 Tahun 2003' },
        { key: 'B', text: 'UU No. 22 Tahun 2009' },
        { key: 'C', text: 'UU No. 35 Tahun 2009' },
        { key: 'D', text: 'UU No. 2 Tahun 2002' }
      ],
      correctOption: 'B',
      maxPoints: 20,
      guideAnswer: ''
    },
    {
      id: 'cc-q-4',
      number: 4,
      type: 'essay',
      targetLevel: 'ALL',
      prompt: 'Jelaskan secara singkat 3 sikap dasar dan etika anggota PKS saat membantu menyeberangkan siswa di depan gerbang sekolah!',
      options: [],
      correctOption: 'A',
      maxPoints: 25,
      guideAnswer: 'Bersikap tegas namun sopan, mengutamakan keselamatan diri dan penyeberang (pastikan arus berhenti sempurna), menggunakan perlengkapan standar (rompi/peluit/tanda stop) serta berkoordinasi dengan pembina/petugas.'
    },
    {
      id: 'cc-q-5',
      number: 5,
      type: 'essay',
      targetLevel: 'ALL',
      prompt: 'Sebutkan dan jelaskan perbedaan fungsi rambu lalu lintas berwarna dasar kuning dan berwarna dasar biru!',
      options: [],
      correctOption: 'A',
      maxPoints: 25,
      guideAnswer: 'Rambu dasar kuning berisi peringatan bahaya/kondisi jalan agar pengguna waspada; rambu dasar biru berisi perintah wajib yang harus dipatuhi pengguna jalan.'
    }
  ]
};

const CERDAS_CERMAT_CONFIG_CACHE_KEY = 'PBB_PKS_CERDAS_CERMAT_CONFIG_V1';
const CERDAS_CERMAT_SUBMISSIONS_CACHE_KEY = 'PBB_PKS_CERDAS_CERMAT_SUBS_V1';
const cerdasCermatSubmissionsOverlayListeners = new Set<() => void>();

export function getCachedCerdasCermatConfigFromLocal(): CerdasCermatConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CERDAS_CERMAT_CONFIG_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions)) {
          return {
            ...DEFAULT_CERDAS_CERMAT_CONFIG,
            ...parsed,
            questions: parsed.questions
          };
        }
      }
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_CERDAS_CERMAT_CONFIG;
}

export function cacheCerdasCermatConfigToLocal(cfg: CerdasCermatConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CERDAS_CERMAT_CONFIG_CACHE_KEY, JSON.stringify(cfg));
    }
  } catch {
    // ignore storage errors
  }
}

export function subscribeToCerdasCermatConfig(
  onUpdate: (config: CerdasCermatConfig) => void,
  onError?: (err: any) => void
) {
  const path = 'settings/cerdas_cermat_config';
  return onSnapshot(
    doc(db, 'settings', 'cerdas_cermat_config'),
    docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const normalized: CerdasCermatConfig = {
          id: 'cerdas_cermat_config',
          title: typeof data.title === 'string' && data.title.trim() ? data.title : DEFAULT_CERDAS_CERMAT_CONFIG.title,
          description: typeof data.description === 'string' ? data.description : DEFAULT_CERDAS_CERMAT_CONFIG.description,
          isOpen: typeof data.isOpen === 'boolean' ? data.isOpen : true,
          questions: Array.isArray(data.questions) ? data.questions : DEFAULT_CERDAS_CERMAT_CONFIG.questions,
          updatedAt: data.updatedAt || '',
          updatedBy: data.updatedBy || ''
        };
        cacheCerdasCermatConfigToLocal(normalized);
        onUpdate(normalized);
      } else {
        onUpdate(getCachedCerdasCermatConfigFromLocal());
      }
    },
    error => {
      handleFirestoreError(error, OperationType.GET, path);
      if (onError) onError(error);
    }
  );
}

export async function saveCerdasCermatConfigToCloud(
  config: CerdasCermatConfig,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = 'settings/cerdas_cermat_config';
  const cleanDoc = sanitizeForFirestore({
    ...config,
    id: 'cerdas_cermat_config',
    updatedAt: new Date().toISOString()
  });
  cacheCerdasCermatConfigToLocal(cleanDoc);
  return executeCloudMutation(
    () => setDoc(doc(db, 'settings', 'cerdas_cermat_config'), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'cerdas_cermat_config_save', entityId: 'cerdas_cermat_config', payload: cleanDoc }
  );
}

export function getCachedCerdasCermatSubmissionsFromLocal(): CerdasCermatSubmission[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(CERDAS_CERMAT_SUBMISSIONS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function cacheCerdasCermatSubmissionsToLocal(items: CerdasCermatSubmission[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CERDAS_CERMAT_SUBMISSIONS_CACHE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore storage errors
  }
}

function applyOfflineCerdasCermatOverlay(baseItems: CerdasCermatSubmission[]): CerdasCermatSubmission[] {
  const queue = getOfflineQueue();
  let merged = [...baseItems];
  for (const item of queue) {
    if (item.type === 'cerdas_cermat_submission_save' && item.payload) {
      const idx = merged.findIndex(r => r.id === item.entityId);
      if (idx >= 0) {
        merged[idx] = item.payload;
      } else {
        merged = [item.payload, ...merged];
      }
    } else if (item.type === 'cerdas_cermat_submission_delete') {
      merged = merged.filter(r => r.id !== item.entityId);
    }
  }
  return merged;
}

export function subscribeToCerdasCermatSubmissions(
  onUpdate: (submissions: CerdasCermatSubmission[]) => void,
  onError?: (err: any) => void
) {
  const path = 'cerdas_cermat_submissions';
  let latestServerOrCache = getCachedCerdasCermatSubmissionsFromLocal();

  const emitMerged = (base: CerdasCermatSubmission[]) => {
    const merged = applyOfflineCerdasCerdasSafe(base);
    cacheCerdasCermatSubmissionsToLocal(merged);
    onUpdate(merged);
  };

  function applyOfflineCerdasCerdasSafe(base: CerdasCermatSubmission[]): CerdasCermatSubmission[] {
    return applyOfflineCerdasCermatOverlay(base);
  }

  const localOverlayHandler = () => {
    emitMerged(latestServerOrCache);
  };
  cerdasCermatSubmissionsOverlayListeners.add(localOverlayHandler);

  const unsubFirestore = onSnapshot(
    collection(db, path),
    snapshot => {
      const items: CerdasCermatSubmission[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data() as CerdasCermatSubmission);
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
    cerdasCermatSubmissionsOverlayListeners.delete(localOverlayHandler);
    unsubFirestore();
  };
}

export async function saveCerdasCermatSubmissionToCloud(
  submission: CerdasCermatSubmission,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  if (!submission || !submission.id) {
    return { success: false, error: 'ID kiriman Cerdas Cermat tidak valid' };
  }
  const path = `cerdas_cermat_submissions/${submission.id}`;
  const cleanDoc = sanitizeForFirestore({
    ...submission,
    updatedAt: new Date().toISOString()
  });
  const res = await executeCloudMutation(
    () => setDoc(doc(db, 'cerdas_cermat_submissions', submission.id), cleanDoc),
    OperationType.WRITE,
    path,
    options,
    { type: 'cerdas_cermat_submission_save', entityId: submission.id, payload: cleanDoc }
  );
  if (res.queuedOffline || res.isQuotaError) {
    cerdasCermatSubmissionsOverlayListeners.forEach(cb => cb());
  }
  return res;
}

export async function deleteCerdasCermatSubmissionFromCloud(
  submissionId: string,
  options?: CloudWriteOptions
): Promise<CloudWriteResult> {
  const path = `cerdas_cermat_submissions/${submissionId}`;
  const res = await executeCloudMutation(
    () => deleteDoc(doc(db, 'cerdas_cermat_submissions', submissionId)),
    OperationType.DELETE,
    path,
    options,
    { type: 'cerdas_cermat_submission_delete', entityId: submissionId }
  );
  if (res.queuedOffline || res.isQuotaError) {
    cerdasCermatSubmissionsOverlayListeners.forEach(cb => cb());
  }
  return res;
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
    const legacyRef = doc(db, 'settings', LEGACY_ACTIVITY_LOGS_DOC_ID);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists() && !isCloudWriteQuotaExceeded()) {
      await deleteDoc(legacyRef);
    }

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
// 9. DELTA OFFLINE QUEUE & SERVER BACKUP FLUSH MANAGER
// ==========================================

export interface OfflineFlushSummary {
  flushedCount: number;
  remainingCount: number;
  serverBackedUpCount: number;
  hadQuotaError: boolean;
  hadNetworkError: boolean;
  lastErrorMessage?: string;
}

export async function syncPendingDeltasToServerBackup(): Promise<number> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 0;
  }
  const pending = getPendingServerBackupMutations();
  if (pending.length === 0) return 0;

  const res = await pushServerBackupDelta(
    pending.map(item => ({
      key: item.key,
      type: item.type,
      entityId: item.entityId,
      payload: item.payload,
      updatedAt: item.updatedAt
    }))
  );
  if (res?.success) {
    markMutationsBackedUpToServer(
      pending.map(i => i.key),
      res.updatedAt || new Date().toISOString()
    );
    return pending.length;
  }
  return 0;
}

let activeFlushPromise: Promise<OfflineFlushSummary> | null = null;

export async function flushOfflineSyncQueue(): Promise<OfflineFlushSummary> {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const serverBackedUpCount = await syncPendingDeltasToServerBackup();
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      return {
        flushedCount: 0,
        remainingCount: 0,
        serverBackedUpCount,
        hadQuotaError: false,
        hadNetworkError: false
      };
    }

    if ((typeof navigator !== 'undefined' && !navigator.onLine) || isCloudWriteQuotaExceeded()) {
      return {
        flushedCount: 0,
        remainingCount: queue.length,
        serverBackedUpCount,
        hadQuotaError: isCloudWriteQuotaExceeded(),
        hadNetworkError: typeof navigator !== 'undefined' ? !navigator.onLine : false
      };
    }

    let flushedCount = 0;
    let hadQuotaError = false;
    let hadNetworkError = false;
    let lastErrorMessage: string | undefined;

    for (const item of queue) {
      let res: CloudWriteResult = { success: true };
      const opts: CloudWriteOptions = { skipOfflineQueue: true, skipServerMirror: true };

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
        case 'cerdas_cermat_config_save':
          res = await saveCerdasCermatConfigToCloud(item.payload, opts);
          break;
        case 'cerdas_cermat_submission_save':
          res = await saveCerdasCermatSubmissionToCloud(item.payload, opts);
          break;
        case 'cerdas_cermat_submission_delete':
          res = await deleteCerdasCermatSubmissionFromCloud(item.entityId, opts);
          break;
      }

      if (res.success) {
        removeOfflineMutation(item.key);
        flushedCount += 1;
      } else if (res.isQuotaError) {
        hadQuotaError = true;
        lastErrorMessage = res.error;
        break;
      } else if (res.isNetworkError) {
        hadNetworkError = true;
        lastErrorMessage = res.error;
        break;
      } else {
        // Non-retryable payload/permission error: keep copy on server backup and drop blocking Firestore item
        lastErrorMessage = res.error;
        removeOfflineMutation(item.key);
      }
    }

    return {
      flushedCount,
      remainingCount: getOfflineQueue().length,
      serverBackedUpCount,
      hadQuotaError,
      hadNetworkError,
      lastErrorMessage
    };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}




