import fs from 'node:fs/promises';
import path from 'node:path';

export type DeltaMutationType =
  | 'participant_save'
  | 'participant_delete'
  | 'user_save'
  | 'user_delete'
  | 'config_save'
  | 'logo_save'
  | 'app_status_save'
  | 'payment_config_save'
  | 'blanko_config_save'
  | 'registration_save'
  | 'registration_delete'
  | 'cerdas_cermat_config_save'
  | 'cerdas_cermat_submission_save'
  | 'cerdas_cermat_submission_delete';

export interface IncomingDeltaMutation {
  key?: string;
  type: DeltaMutationType;
  entityId: string;
  payload?: any;
  updatedAt?: string;
}

export interface ServerSnapshotRecord {
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
  payload: any;
}

export interface ServerBackupCollections {
  participants: Record<string, any>;
  users: Record<string, any>;
  registrations: Record<string, any>;
  categories: any[] | null;
  categoriesUpdatedAt?: string | null;
  logoUrl: string | null;
  logoUpdatedAt?: string | null;
  appStatus: any | null;
  paymentConfig: any | null;
  blankoConfig: any | null;
  cerdasCermatConfig?: any | null;
  cerdasCermatSubmissions?: Record<string, any>;
}

export interface ServerBackupStoreData {
  version: number;
  updatedAt: string | null;
  lastDeltaAt: string | null;
  totalDeltaApplied: number;
  collections: ServerBackupCollections;
  snapshots: ServerSnapshotRecord[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUP_FILE_PATH = path.join(DATA_DIR, 'server-cloud-backup.json');
const MAX_SERVER_SNAPSHOTS = 12;

function createEmptyStore(): ServerBackupStoreData {
  return {
    version: 1,
    updatedAt: null,
    lastDeltaAt: null,
    totalDeltaApplied: 0,
    collections: {
      participants: {},
      users: {},
      registrations: {},
      categories: null,
      categoriesUpdatedAt: null,
      logoUrl: null,
      logoUpdatedAt: null,
      appStatus: null,
      paymentConfig: null,
      blankoConfig: null,
      cerdasCermatConfig: null,
      cerdasCermatSubmissions: {},
    },
    snapshots: [],
  };
}

let cachedStore: ServerBackupStoreData | null = null;
let ioQueue: Promise<unknown> = Promise.resolve();

function serializeIo<T>(task: () => Promise<T>): Promise<T> {
  const next = ioQueue.then(task, task);
  ioQueue = next.catch(() => undefined);
  return next;
}

async function readStoreFromDisk(): Promise<ServerBackupStoreData> {
  if (cachedStore) return cachedStore;
  try {
    const raw = await fs.readFile(BACKUP_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const base = createEmptyStore();
    cachedStore = {
      version: typeof parsed?.version === 'number' ? parsed.version : 1,
      updatedAt: parsed?.updatedAt || null,
      lastDeltaAt: parsed?.lastDeltaAt || null,
      totalDeltaApplied: typeof parsed?.totalDeltaApplied === 'number' ? parsed.totalDeltaApplied : 0,
      collections: {
        participants: parsed?.collections?.participants && typeof parsed.collections.participants === 'object'
          ? parsed.collections.participants
          : base.collections.participants,
        users: parsed?.collections?.users && typeof parsed.collections.users === 'object'
          ? parsed.collections.users
          : base.collections.users,
        registrations: parsed?.collections?.registrations && typeof parsed.collections.registrations === 'object'
          ? parsed.collections.registrations
          : base.collections.registrations,
        categories: Array.isArray(parsed?.collections?.categories) ? parsed.collections.categories : null,
        categoriesUpdatedAt: parsed?.collections?.categoriesUpdatedAt || null,
        logoUrl: typeof parsed?.collections?.logoUrl === 'string' ? parsed.collections.logoUrl : null,
        logoUpdatedAt: parsed?.collections?.logoUpdatedAt || null,
        appStatus: parsed?.collections?.appStatus || null,
        paymentConfig: parsed?.collections?.paymentConfig || null,
        blankoConfig: parsed?.collections?.blankoConfig || null,
        cerdasCermatConfig: parsed?.collections?.cerdasCermatConfig || null,
        cerdasCermatSubmissions:
          parsed?.collections?.cerdasCermatSubmissions &&
          typeof parsed.collections.cerdasCermatSubmissions === 'object'
            ? parsed.collections.cerdasCermatSubmissions
            : {},
      },
      snapshots: Array.isArray(parsed?.snapshots) ? parsed.snapshots.slice(0, MAX_SERVER_SNAPSHOTS) : [],
    };
    return cachedStore;
  } catch {
    cachedStore = createEmptyStore();
    return cachedStore;
  }
}

async function writeStoreToDisk(store: ServerBackupStoreData): Promise<void> {
  cachedStore = store;
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${BACKUP_FILE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(store), 'utf8');
  await fs.rename(tmpPath, BACKUP_FILE_PATH);
}

function isNewerOrEqualTimestamp(incomingIso?: string, existingIso?: string | null): boolean {
  if (!existingIso) return true;
  if (!incomingIso) return true;
  const inMs = Date.parse(incomingIso);
  const exMs = Date.parse(existingIso);
  if (Number.isNaN(inMs) || Number.isNaN(exMs)) return true;
  return inMs >= exMs;
}

export async function getServerBackupStatus() {
  return serializeIo(async () => {
    const store = await readStoreFromDisk();
    return {
      available: true,
      updatedAt: store.updatedAt,
      lastDeltaAt: store.lastDeltaAt,
      totalDeltaApplied: store.totalDeltaApplied,
      counts: {
        participants: Object.keys(store.collections.participants).length,
        users: Object.keys(store.collections.users).length,
        registrations: Object.keys(store.collections.registrations).length,
        categories: Array.isArray(store.collections.categories) ? store.collections.categories.length : 0,
        snapshots: store.snapshots.length,
      },
      latestSnapshotAt: store.snapshots[0]?.createdAt || null,
    };
  });
}

export async function getServerBackupState() {
  return serializeIo(async () => {
    const store = await readStoreFromDisk();
    return {
      available: true,
      updatedAt: store.updatedAt,
      lastDeltaAt: store.lastDeltaAt,
      totalDeltaApplied: store.totalDeltaApplied,
      collections: {
        participants: Object.values(store.collections.participants),
        users: Object.values(store.collections.users),
        registrations: Object.values(store.collections.registrations),
        categories: store.collections.categories,
        categoriesUpdatedAt: store.collections.categoriesUpdatedAt || null,
        logoUrl: store.collections.logoUrl,
        logoUpdatedAt: store.collections.logoUpdatedAt || null,
        appStatus: store.collections.appStatus,
        paymentConfig: store.collections.paymentConfig,
        blankoConfig: store.collections.blankoConfig,
        cerdasCermatConfig: store.collections.cerdasCermatConfig || null,
        cerdasCermatSubmissions: Object.values(store.collections.cerdasCermatSubmissions || {}),
      },
    };
  });
}

export async function getServerSnapshots() {
  return serializeIo(async () => {
    const store = await readStoreFromDisk();
    return store.snapshots;
  });
}

export async function applyDeltaMutationsToServer(mutations: IncomingDeltaMutation[]) {
  return serializeIo(async () => {
    const store = await readStoreFromDisk();
    const nowIso = new Date().toISOString();
    let appliedCount = 0;

    for (const mut of mutations) {
      if (!mut || !mut.type) continue;
      const entityId = String(mut.entityId || 'singleton').trim();
      const mutUpdatedAt = mut.updatedAt || mut.payload?.updatedAt || nowIso;

      switch (mut.type) {
        case 'participant_save': {
          if (mut.payload && entityId) {
            const prev = store.collections.participants[entityId];
            if (isNewerOrEqualTimestamp(mutUpdatedAt, prev?.updatedAt)) {
              store.collections.participants[entityId] = {
                ...mut.payload,
                id: mut.payload.id || entityId,
                updatedAt: mutUpdatedAt,
              };
              appliedCount += 1;
            }
          }
          break;
        }
        case 'participant_delete': {
          if (entityId && store.collections.participants[entityId]) {
            delete store.collections.participants[entityId];
            appliedCount += 1;
          }
          break;
        }
        case 'user_save': {
          if (mut.payload && entityId) {
            const cleanKey = entityId.toLowerCase().replace(/\s+/g, '');
            const prev = store.collections.users[cleanKey];
            if (isNewerOrEqualTimestamp(mutUpdatedAt, prev?.updatedAt)) {
              store.collections.users[cleanKey] = {
                ...mut.payload,
                username: cleanKey,
                updatedAt: mutUpdatedAt,
              };
              appliedCount += 1;
            }
          }
          break;
        }
        case 'user_delete': {
          const cleanKey = entityId.toLowerCase().replace(/\s+/g, '');
          if (cleanKey && store.collections.users[cleanKey]) {
            delete store.collections.users[cleanKey];
            appliedCount += 1;
          }
          break;
        }
        case 'registration_save': {
          if (mut.payload && entityId) {
            const prev = store.collections.registrations[entityId];
            if (isNewerOrEqualTimestamp(mutUpdatedAt, prev?.updatedAt)) {
              store.collections.registrations[entityId] = {
                ...mut.payload,
                id: mut.payload.id || entityId,
                updatedAt: mutUpdatedAt,
              };
              appliedCount += 1;
            }
          }
          break;
        }
        case 'registration_delete': {
          if (entityId && store.collections.registrations[entityId]) {
            delete store.collections.registrations[entityId];
            appliedCount += 1;
          }
          break;
        }
        case 'config_save': {
          if (Array.isArray(mut.payload)) {
            if (isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.categoriesUpdatedAt)) {
              store.collections.categories = mut.payload;
              store.collections.categoriesUpdatedAt = mutUpdatedAt;
              appliedCount += 1;
            }
          }
          break;
        }
        case 'logo_save': {
          if (isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.logoUpdatedAt)) {
            store.collections.logoUrl = typeof mut.payload === 'string' ? mut.payload : '';
            store.collections.logoUpdatedAt = mutUpdatedAt;
            appliedCount += 1;
          }
          break;
        }
        case 'app_status_save': {
          if (mut.payload && isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.appStatus?.updatedAt)) {
            store.collections.appStatus = { ...mut.payload, updatedAt: mutUpdatedAt };
            appliedCount += 1;
          }
          break;
        }
        case 'payment_config_save': {
          if (mut.payload && isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.paymentConfig?.updatedAt)) {
            store.collections.paymentConfig = { ...mut.payload, updatedAt: mutUpdatedAt };
            appliedCount += 1;
          }
          break;
        }
        case 'blanko_config_save': {
          if (mut.payload && isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.blankoConfig?.updatedAt)) {
            store.collections.blankoConfig = { ...mut.payload, updatedAt: mutUpdatedAt };
            appliedCount += 1;
          }
          break;
        }
        case 'cerdas_cermat_config_save': {
          if (mut.payload && isNewerOrEqualTimestamp(mutUpdatedAt, store.collections.cerdasCermatConfig?.updatedAt)) {
            store.collections.cerdasCermatConfig = { ...mut.payload, updatedAt: mutUpdatedAt };
            appliedCount += 1;
          }
          break;
        }
        case 'cerdas_cermat_submission_save': {
          if (mut.payload && entityId) {
            if (!store.collections.cerdasCermatSubmissions) {
              store.collections.cerdasCermatSubmissions = {};
            }
            const prev = store.collections.cerdasCermatSubmissions[entityId];
            if (isNewerOrEqualTimestamp(mutUpdatedAt, prev?.updatedAt)) {
              store.collections.cerdasCermatSubmissions[entityId] = {
                ...mut.payload,
                id: mut.payload.id || entityId,
                updatedAt: mutUpdatedAt,
              };
              appliedCount += 1;
            }
          }
          break;
        }
        case 'cerdas_cermat_submission_delete': {
          if (entityId && store.collections.cerdasCermatSubmissions?.[entityId]) {
            delete store.collections.cerdasCermatSubmissions[entityId];
            appliedCount += 1;
          }
          break;
        }
      }
    }

    if (appliedCount > 0) {
      store.updatedAt = nowIso;
      store.lastDeltaAt = nowIso;
      store.totalDeltaApplied += appliedCount;
      await writeStoreToDisk(store);
    }

    return {
      success: true,
      appliedCount,
      updatedAt: store.updatedAt || nowIso,
      lastDeltaAt: store.lastDeltaAt,
      totalDeltaApplied: store.totalDeltaApplied,
      counts: {
        participants: Object.keys(store.collections.participants).length,
        users: Object.keys(store.collections.users).length,
        registrations: Object.keys(store.collections.registrations).length,
        categories: Array.isArray(store.collections.categories) ? store.collections.categories.length : 0,
        snapshots: store.snapshots.length,
      },
    };
  });
}

export async function saveSnapshotToServer(snapshot: ServerSnapshotRecord) {
  return serializeIo(async () => {
    const store = await readStoreFromDisk();
    const nowIso = new Date().toISOString();

    const deduped = [
      snapshot,
      ...store.snapshots.filter(s => s.id !== snapshot.id),
    ]
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, MAX_SERVER_SNAPSHOTS);
    store.snapshots = deduped;

    // Also hydrate/reconcile collections cleanly from snapshot payload
    const payload = snapshot.payload || {};
    if (Array.isArray(payload.pesertaList)) {
      for (const p of payload.pesertaList) {
        if (p?.id) {
          const prev = store.collections.participants[p.id];
          if (isNewerOrEqualTimestamp(p.updatedAt || snapshot.createdAt, prev?.updatedAt)) {
            store.collections.participants[p.id] = p;
          }
        }
      }
    }
    if (Array.isArray(payload.usersList)) {
      for (const u of payload.usersList) {
        if (u?.username) {
          const cleanKey = String(u.username).trim().toLowerCase().replace(/\s+/g, '');
          const prev = store.collections.users[cleanKey];
          if (isNewerOrEqualTimestamp(u.updatedAt || snapshot.createdAt, prev?.updatedAt)) {
            store.collections.users[cleanKey] = { ...u, username: cleanKey };
          }
        }
      }
    }
    if (Array.isArray(payload.registrationsList)) {
      for (const r of payload.registrationsList) {
        if (r?.id) {
          const prev = store.collections.registrations[r.id];
          if (isNewerOrEqualTimestamp(r.updatedAt || snapshot.createdAt, prev?.updatedAt)) {
            store.collections.registrations[r.id] = r;
          }
        }
      }
    }
    if (Array.isArray(payload.categories) && payload.categories.length > 0) {
      if (isNewerOrEqualTimestamp(snapshot.createdAt, store.collections.categoriesUpdatedAt)) {
        store.collections.categories = payload.categories;
        store.collections.categoriesUpdatedAt = snapshot.createdAt;
      }
    }
    if (payload.appStatus) {
      if (isNewerOrEqualTimestamp(payload.appStatus.updatedAt || snapshot.createdAt, store.collections.appStatus?.updatedAt)) {
        store.collections.appStatus = payload.appStatus;
      }
    }
    if (payload.paymentConfig) {
      if (isNewerOrEqualTimestamp(payload.paymentConfig.updatedAt || snapshot.createdAt, store.collections.paymentConfig?.updatedAt)) {
        store.collections.paymentConfig = payload.paymentConfig;
      }
    }
    if (payload.blankoConfig) {
      if (isNewerOrEqualTimestamp(payload.blankoConfig.updatedAt || snapshot.createdAt, store.collections.blankoConfig?.updatedAt)) {
        store.collections.blankoConfig = payload.blankoConfig;
      }
    }

    store.updatedAt = nowIso;
    await writeStoreToDisk(store);

    return {
      success: true,
      updatedAt: store.updatedAt,
      snapshotCount: store.snapshots.length,
      counts: {
        participants: Object.keys(store.collections.participants).length,
        users: Object.keys(store.collections.users).length,
        registrations: Object.keys(store.collections.registrations).length,
        categories: Array.isArray(store.collections.categories) ? store.collections.categories.length : 0,
        snapshots: store.snapshots.length,
      },
    };
  });
}
