/**
 * Offline-First Sync Module
 *
 * IndexedDB'ye tahta verisi kaydeder.
 * Online olunca bekleyen değişiklikleri server'a gönderir.
 * Çevrimdışıyken çalışmaya devam eder.
 */

import { offlineLog } from './logger';

const DB_NAME = 'abetahta-offline';
const DB_VERSION = 1;
const STORE_SNAPSHOTS = 'snapshots';
const STORE_PENDING = 'pending-changes';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'boardId' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ---- Snapshot Cache (son bilinen tahta durumu) ----

export async function saveSnapshotLocally(boardId: string, snapshot: unknown): Promise<void> {
  offlineLog.debug('Snapshot kaydediliyor, boardId:', boardId);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    tx.objectStore(STORE_SNAPSHOTS).put({
      boardId,
      snapshot,
      savedAt: new Date().toISOString(),
    });
    tx.oncomplete = () => { offlineLog.info('Snapshot kaydedildi:', boardId); resolve(); };
    tx.onerror = () => { offlineLog.error('Snapshot kayit hatasi:', boardId, tx.error); reject(tx.error); };
  });
}

export async function getLocalSnapshot(boardId: string): Promise<unknown | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
    const request = tx.objectStore(STORE_SNAPSHOTS).get(boardId);
    request.onsuccess = () => resolve(request.result?.snapshot || null);
    request.onerror = () => reject(request.error);
  });
}

// ---- Pending Changes Queue (çevrimdışı yapılan değişiklikler) ----

interface PendingChange {
  id?: number;
  boardId: string;
  type: 'save-snapshot';
  payload: unknown;
  createdAt: string;
}

export async function queuePendingChange(change: Omit<PendingChange, 'id' | 'createdAt'>): Promise<void> {
  offlineLog.info('Bekleyen degisiklik kuyruga ekleniyor:', change.boardId, change.type);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).add({
      ...change,
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => { offlineLog.info('Kuyruga eklendi:', change.boardId); resolve(); };
    tx.onerror = () => { offlineLog.error('Kuyruk ekleme hatasi:', tx.error); reject(tx.error); };
  });
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const request = tx.objectStore(STORE_PENDING).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearPendingChange(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Sync Manager ----

export async function syncPendingChanges(
  apiFn: (boardId: string, snapshot: unknown) => Promise<void>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingChanges();
  offlineLog.info('Bekleyen degisiklikleri senkronize ediliyor:', pending.length, 'adet');
  let synced = 0;
  let failed = 0;

  for (const change of pending) {
    try {
      if (change.type === 'save-snapshot') {
        await apiFn(change.boardId, change.payload);
      }
      if (change.id !== undefined) {
        await clearPendingChange(change.id);
      }
      synced++;
      offlineLog.debug('Senkronize edildi:', change.boardId);
    } catch (err) {
      failed++;
      offlineLog.error('Senkronizasyon hatasi:', change.boardId, (err as Error).message);
    }
  }

  offlineLog.info('Senkronizasyon tamamlandi:', { synced, failed });
  return { synced, failed };
}

// ---- Online/Offline Detection ----

type SyncCallback = () => void;
let onlineCallbacks: SyncCallback[] = [];

export function onOnline(callback: SyncCallback) {
  onlineCallbacks.push(callback);
  return () => {
    onlineCallbacks = onlineCallbacks.filter(cb => cb !== callback);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    offlineLog.info('Cevrimici olundu! Bekleyen degisiklikler gonderiliyor...');
    onlineCallbacks.forEach(cb => cb());
  });
  window.addEventListener('offline', () => {
    offlineLog.warn('Cevrimdisi olundu — degisiklikler yerel olarak kuyruklanacak');
  });
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
