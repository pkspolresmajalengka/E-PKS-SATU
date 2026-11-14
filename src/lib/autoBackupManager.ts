export const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 Jam (60 menit)
export const MAX_IDB_SNAPSHOTS = 48; // Simpan hingga 48 cadangan (48 jam)
export const MAX_LOCAL_FALLBACK_SNAPSHOTS = 4;

const AUTO_BACKUP_SETTINGS_KEY = 'pks_auto_backup_settings_v1';
const AUTO_BACKUP_FALLBACK_KEY = 'pks_auto_backup_snapshots_fallback_v1';
const FORM_DRAFTS_STORAGE_KEY = 'pks_form_drafts_autosave_v1';

const IDB_NAME = 'E_PKS_SATU_AUTO_BACKUP_DB';
const IDB_VERSION = 1;
const IDB_STORE_NAME = 'snapshots';

export interface AutoBackupSettings {
  autoSaveEnabled: boolean;
  autoBackupEnabled: boolean;
  lastBackupAt: number | null;
  nextBackupAt: number | null;
  lastAutoSaveAt: number | null;
}

export interface AutoBackupPayload {
  version: number;
  exportedAt: string;
  pesertaList: any[];
  categories: any[];
  usersList: any[];
  registrationsList?: any[];
  paymentConfig?: any;
  blankoConfig?: any;
  appStatus?: any;
}

export interface AutoBackupSnapshot {
  id: string;
  createdAt: string;
  createdAtMs: number;
  trigger: 'hourly' | 'manual';
  createdBy?: string;
  sizeBytes: number;
  summary: {
    pesertaCount: number;
    usersCount: number;
    categoriesCount: number;
    registrationsCount: number;
  };
  payload: AutoBackupPayload;
}

export interface FormDraftsBundle {
  formPolisiPelajar?: any;
  formCalonPks?: any;
  formBalok1?: any;
  formBalok2?: any;
  updatedAt?: string;
}

export function getDefaultAutoBackupSettings(): AutoBackupSettings {
  return {
    autoSaveEnabled: true,
    autoBackupEnabled: true,
    lastBackupAt: null,
    nextBackupAt: null,
    lastAutoSaveAt: null
  };
}

export function getAutoBackupSettings(): AutoBackupSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return getDefaultAutoBackupSettings();
    }
    const raw = window.localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY);
    if (!raw) return getDefaultAutoBackupSettings();
    const parsed = JSON.parse(raw);
    return {
      autoSaveEnabled: typeof parsed?.autoSaveEnabled === 'boolean' ? parsed.autoSaveEnabled : true,
      autoBackupEnabled: typeof parsed?.autoBackupEnabled === 'boolean' ? parsed.autoBackupEnabled : true,
      lastBackupAt: typeof parsed?.lastBackupAt === 'number' ? parsed.lastBackupAt : null,
      nextBackupAt: typeof parsed?.nextBackupAt === 'number' ? parsed.nextBackupAt : null,
      lastAutoSaveAt: typeof parsed?.lastAutoSaveAt === 'number' ? parsed.lastAutoSaveAt : null
    };
  } catch {
    return getDefaultAutoBackupSettings();
  }
}

export function saveAutoBackupSettings(settings: AutoBackupSettings): AutoBackupSettings {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(settings));
    }
  } catch {
    // ignore storage quota errors
  }
  return settings;
}

export function readFormDraftsFromLocal(): FormDraftsBundle | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(FORM_DRAFTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFormDraftsToLocal(drafts: FormDraftsBundle): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.setItem(
      FORM_DRAFTS_STORAGE_KEY,
      JSON.stringify({
        ...drafts,
        updatedAt: new Date().toISOString()
      })
    );
    return true;
  } catch {
    return false;
  }
}

function openBackupDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB tidak tersedia'));
      return;
    }
    try {
      const request = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          const store = db.createObjectStore(IDB_STORE_NAME, { keyPath: 'id' });
          store.createIndex('createdAtMs', 'createdAtMs', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB'));
    } catch (err) {
      reject(err);
    }
  });
}

function readFallbackSnapshots(): AutoBackupSnapshot[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(AUTO_BACKUP_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeFallbackSnapshots(items: AutoBackupSnapshot[]): void {
  const sorted = [...items]
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, MAX_LOCAL_FALLBACK_SNAPSHOTS);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTO_BACKUP_FALLBACK_KEY, JSON.stringify(sorted));
    }
  } catch {
    // If localStorage is tight, retain only the latest 1 snapshot
    try {
      if (typeof window !== 'undefined' && window.localStorage && sorted.length > 0) {
        window.localStorage.setItem(AUTO_BACKUP_FALLBACK_KEY, JSON.stringify([sorted[0]]));
      }
    } catch {
      // ignore
    }
  }
}

export async function listBackupSnapshots(): Promise<AutoBackupSnapshot[]> {
  try {
    const db = await openBackupDB();
    return await new Promise<AutoBackupSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? (req.result as AutoBackupSnapshot[]) : [];
        rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
        resolve(rows);
      };
      req.onerror = () => reject(req.error || new Error('Gagal membaca daftar cadangan'));
      tx.oncomplete = () => db.close();
    });
  } catch {
    return readFallbackSnapshots().sort((a, b) => b.createdAtMs - a.createdAtMs);
  }
}

export function buildSnapshotRecord(
  input: Omit<AutoBackupPayload, 'version' | 'exportedAt'>,
  trigger: 'hourly' | 'manual',
  createdBy?: string
): AutoBackupSnapshot {
  const nowMs = Date.now();
  const iso = new Date(nowMs).toISOString();
  const payload: AutoBackupPayload = {
    version: 2,
    exportedAt: iso,
    pesertaList: Array.isArray(input.pesertaList) ? input.pesertaList : [],
    categories: Array.isArray(input.categories) ? input.categories : [],
    usersList: Array.isArray(input.usersList) ? input.usersList : [],
    registrationsList: Array.isArray(input.registrationsList) ? input.registrationsList : [],
    paymentConfig: input.paymentConfig,
    blankoConfig: input.blankoConfig,
    appStatus: input.appStatus
  };

  let sizeBytes = 0;
  try {
    const serialized = JSON.stringify(payload);
    sizeBytes = typeof Blob !== 'undefined' ? new Blob([serialized]).size : serialized.length;
  } catch {
    sizeBytes = 0;
  }

  const rand = Math.random().toString(36).slice(2, 6);
  return {
    id: `bkp_${nowMs}_${trigger}_${rand}`,
    createdAt: iso,
    createdAtMs: nowMs,
    trigger,
    createdBy,
    sizeBytes,
    summary: {
      pesertaCount: payload.pesertaList.length,
      usersCount: payload.usersList.length,
      categoriesCount: payload.categories.length,
      registrationsCount: payload.registrationsList?.length || 0
    },
    payload
  };
}

export async function saveBackupSnapshot(snapshot: AutoBackupSnapshot): Promise<AutoBackupSnapshot[]> {
  try {
    const db = await openBackupDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(snapshot);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal menyimpan cadangan'));
      };
    });

    const all = await listBackupSnapshots();
    if (all.length > MAX_IDB_SNAPSHOTS) {
      const toDelete = all.slice(MAX_IDB_SNAPSHOTS);
      const db2 = await openBackupDB();
      await new Promise<void>(resolve => {
        const tx = db2.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        toDelete.forEach(item => store.delete(item.id));
        tx.oncomplete = () => {
          db2.close();
          resolve();
        };
        tx.onerror = () => {
          db2.close();
          resolve();
        };
      });
      return all.slice(0, MAX_IDB_SNAPSHOTS);
    }
    return all;
  } catch {
    const current = readFallbackSnapshots();
    const next = [snapshot, ...current.filter(item => item.id !== snapshot.id)];
    writeFallbackSnapshots(next);
    return next.sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, MAX_LOCAL_FALLBACK_SNAPSHOTS);
  }
}

export async function deleteBackupSnapshot(id: string): Promise<AutoBackupSnapshot[]> {
  try {
    const db = await openBackupDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal menghapus cadangan'));
      };
    });
    return await listBackupSnapshots();
  } catch {
    const next = readFallbackSnapshots().filter(item => item.id !== id);
    writeFallbackSnapshots(next);
    return next;
  }
}

export async function clearAllBackupSnapshots(): Promise<void> {
  try {
    const db = await openBackupDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Gagal mengosongkan riwayat cadangan'));
      };
    });
  } catch {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(AUTO_BACKUP_FALLBACK_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export function downloadBackupPayloadAsJson(
  payload: AutoBackupPayload,
  prefix = 'Cadangan_Lomba_PBB_PKS'
): void {
  const dt = payload.exportedAt ? new Date(payload.exportedAt) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}_${pad(dt.getHours())}-${pad(dt.getMinutes())}`;
  const jsonText = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatBytesCompact(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function formatCountdownMs(msRemaining: number): string {
  const clamped = Math.max(0, Math.floor(msRemaining / 1000));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}
