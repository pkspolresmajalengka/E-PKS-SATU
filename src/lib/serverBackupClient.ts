import type { OfflineMutationType } from './offlineSyncQueue';
import type { AutoBackupSnapshot } from './autoBackupManager';

export interface ServerBackupStatus {
  available: boolean;
  updatedAt: string | null;
  lastDeltaAt: string | null;
  totalDeltaApplied: number;
  counts: {
    participants: number;
    users: number;
    registrations: number;
    categories: number;
    snapshots: number;
  };
  latestSnapshotAt: string | null;
}

export interface ServerBackupCollectionsState {
  available: boolean;
  updatedAt: string | null;
  lastDeltaAt: string | null;
  totalDeltaApplied: number;
  collections: {
    participants: any[];
    users: any[];
    registrations: any[];
    categories: any[] | null;
    categoriesUpdatedAt: string | null;
    logoUrl: string | null;
    logoUpdatedAt: string | null;
    appStatus: any | null;
    paymentConfig: any | null;
    blankoConfig: any | null;
    cerdasCermatConfig?: any | null;
    cerdasCermatSubmissions?: any[];
  };
}

export interface DeltaMutationInput {
  key?: string;
  type: OfflineMutationType;
  entityId: string;
  payload?: any;
  updatedAt?: string;
}

export interface PushDeltaResponse {
  success: boolean;
  appliedCount: number;
  updatedAt: string;
  lastDeltaAt: string | null;
  totalDeltaApplied: number;
  counts?: ServerBackupStatus['counts'];
}

const DEFAULT_OFFLINE_STATUS: ServerBackupStatus = {
  available: false,
  updatedAt: null,
  lastDeltaAt: null,
  totalDeltaApplied: 0,
  counts: {
    participants: 0,
    users: 0,
    registrations: 0,
    categories: 0,
    snapshots: 0,
  },
  latestSnapshotAt: null,
};

const statusListeners = new Set<(status: ServerBackupStatus) => void>();
let latestStatus: ServerBackupStatus = DEFAULT_OFFLINE_STATUS;

function emitStatus(next: ServerBackupStatus): void {
  latestStatus = next;
  statusListeners.forEach(cb => {
    try {
      cb(next);
    } catch {
      // ignore listener errors
    }
  });
}

export function getLatestServerBackupStatus(): ServerBackupStatus {
  return latestStatus;
}

export function subscribeToServerBackupStatus(
  listener: (status: ServerBackupStatus) => void
): () => void {
  statusListeners.add(listener);
  listener(latestStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

export async function fetchServerBackupStatus(): Promise<ServerBackupStatus> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emitStatus({ ...latestStatus, available: false });
    return latestStatus;
  }
  try {
    const res = await fetch('/api/cloud-backup/status', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as ServerBackupStatus;
    emitStatus({
      ...DEFAULT_OFFLINE_STATUS,
      ...data,
      available: true,
    });
    return latestStatus;
  } catch {
    emitStatus({ ...latestStatus, available: false });
    return latestStatus;
  }
}

export async function fetchServerBackupState(): Promise<ServerBackupCollectionsState | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    const res = await fetch('/api/cloud-backup/state', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerBackupCollectionsState;
  } catch {
    return null;
  }
}

export async function pushServerBackupDelta(
  mutations: DeltaMutationInput[]
): Promise<PushDeltaResponse | null> {
  if (!mutations || mutations.length === 0) {
    return null;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    const res = await fetch('/api/cloud-backup/delta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PushDeltaResponse;
    emitStatus({
      available: true,
      updatedAt: data.updatedAt || latestStatus.updatedAt,
      lastDeltaAt: data.lastDeltaAt || data.updatedAt || latestStatus.lastDeltaAt,
      totalDeltaApplied: data.totalDeltaApplied ?? latestStatus.totalDeltaApplied,
      counts: data.counts || latestStatus.counts,
      latestSnapshotAt: latestStatus.latestSnapshotAt,
    });
    return data;
  } catch {
    return null;
  }
}

export async function pushServerBackupSnapshot(
  snapshot: AutoBackupSnapshot
): Promise<boolean> {
  if (!snapshot) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    const res = await fetch('/api/cloud-backup/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    emitStatus({
      available: true,
      updatedAt: data.updatedAt || latestStatus.updatedAt,
      lastDeltaAt: latestStatus.lastDeltaAt,
      totalDeltaApplied: latestStatus.totalDeltaApplied,
      counts: data.counts || latestStatus.counts,
      latestSnapshotAt: snapshot.createdAt || latestStatus.latestSnapshotAt,
    });
    return true;
  } catch {
    return false;
  }
}
