export type OfflineMutationType =
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

export interface OfflineQueueItem {
  key: string;
  type: OfflineMutationType;
  entityId: string;
  payload?: any;
  updatedAt: string;
  backedUpToServer?: boolean;
  serverBackedUpAt?: string;
}

export interface OfflineQueueStats {
  totalCount: number;
  backedUpToServerCount: number;
  localOnlyCount: number;
}

const OFFLINE_QUEUE_STORAGE_KEY = 'pks_offline_sync_queue_v1';

const queueListeners = new Set<(items: OfflineQueueItem[]) => void>();

function readStoredQueue(): OfflineQueueItem[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredQueue(items: OfflineQueueItem[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota or private mode storage errors
  }
  queueListeners.forEach(listener => {
    try {
      listener(items);
    } catch {
      // ignore listener errors
    }
  });
}

export function getOfflineQueue(): OfflineQueueItem[] {
  return readStoredQueue();
}

export function getOfflineQueueCount(): number {
  return readStoredQueue().length;
}

export function getOfflineQueueStats(): OfflineQueueStats {
  const items = readStoredQueue();
  const backedUpToServerCount = items.filter(i => i.backedUpToServer).length;
  return {
    totalCount: items.length,
    backedUpToServerCount,
    localOnlyCount: items.length - backedUpToServerCount,
  };
}

export function getPendingServerBackupMutations(): OfflineQueueItem[] {
  return readStoredQueue().filter(item => !item.backedUpToServer);
}

export function subscribeToOfflineQueue(listener: (items: OfflineQueueItem[]) => void): () => void {
  queueListeners.add(listener);
  listener(readStoredQueue());
  return () => {
    queueListeners.delete(listener);
  };
}

/**
 * Enqueues an offline/delta mutation with latest-wins deduplication.
 * Also handles save-vs-delete ordering for the same entity (e.g., if an entity is deleted while offline,
 * its pending save is dropped and replaced with the delete, and vice versa).
 */
export function enqueueOfflineMutation(
  type: OfflineMutationType,
  entityId: string,
  payload?: any,
  options?: { backedUpToServer?: boolean; serverBackedUpAt?: string }
): OfflineQueueItem[] {
  const safeId = String(entityId || 'singleton');
  const key = `${type}:${safeId}`;
  const current = readStoredQueue();

  // Deduplicate conflicting save/delete operations for the same entity ID
  const pairedOppositeKey =
    type === 'participant_save'
      ? `participant_delete:${safeId}`
      : type === 'participant_delete'
      ? `participant_save:${safeId}`
      : type === 'user_save'
      ? `user_delete:${safeId}`
      : type === 'user_delete'
      ? `user_save:${safeId}`
      : type === 'registration_save'
      ? `registration_delete:${safeId}`
      : type === 'registration_delete'
      ? `registration_save:${safeId}`
      : type === 'cerdas_cermat_submission_save'
      ? `cerdas_cermat_submission_delete:${safeId}`
      : type === 'cerdas_cermat_submission_delete'
      ? `cerdas_cermat_submission_save:${safeId}`
      : null;

  const filtered = current.filter(
    item => item.key !== key && (pairedOppositeKey ? item.key !== pairedOppositeKey : true)
  );

  const nextItem: OfflineQueueItem = {
    key,
    type,
    entityId: safeId,
    payload,
    updatedAt: new Date().toISOString(),
    backedUpToServer: Boolean(options?.backedUpToServer),
    serverBackedUpAt: options?.serverBackedUpAt,
  };

  const next = [...filtered, nextItem];
  writeStoredQueue(next);
  return next;
}

export function markMutationsBackedUpToServer(
  keys: string[],
  serverBackedUpAt = new Date().toISOString()
): OfflineQueueItem[] {
  if (!keys || keys.length === 0) return readStoredQueue();
  const keySet = new Set(keys);
  const current = readStoredQueue();
  let changed = false;
  const next = current.map(item => {
    if (keySet.has(item.key) && !item.backedUpToServer) {
      changed = true;
      return {
        ...item,
        backedUpToServer: true,
        serverBackedUpAt,
      };
    }
    return item;
  });
  if (changed) {
    writeStoredQueue(next);
  }
  return next;
}

export function removeOfflineMutation(key: string): OfflineQueueItem[] {
  const current = readStoredQueue();
  const next = current.filter(item => item.key !== key);
  writeStoredQueue(next);
  return next;
}

export function clearOfflineQueue(): void {
  writeStoredQueue([]);
}
