
// src/services/rehearsalLogService.ts
import type { RehearsalLogEntry } from '@/types';

const DB_NAME = 'SIXRVisionLogDB';
const DB_VERSION = 1;
const STORE_NAME = 'rehearsalEvents';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
 console.warn('IndexedDB not supported or not available in this environment.');
        // Return a mock DB or handle more gracefully if needed for SSR/testing
        // For now, we'll let operations fail silently if IndexedDB is not there.
        // In a real app, you might have a fallback or disable the feature.
        return reject(new Error('IndexedDB not supported.'));
      }

      const request: IDBOpenDBRequest = indexedDB.open(DB_NAME, DB_VERSION);
 
      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
        dbPromise = null; // Allow retrying to open
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('event', 'event', { unique: false });
        }
      };
    });
  }
  return dbPromise;
}

export async function addLogEntry(event: string, details: Record<string, any>): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
 const store = transaction.objectStore(STORE_NAME);
    const logEntry: Omit<RehearsalLogEntry, 'id'> = { // ID will be auto-generated
      timestamp: Date.now(),
      event,
      details,
    };
    store.add(logEntry);
    
 return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('Log entry added:', logEntry);
        resolve();
      };
      transaction.onerror = () => {
        console.error('Error adding log entry:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.warn('Failed to add log entry to IndexedDB:', error);
    // Silently fail if IndexedDB is not available or errors out during open
    return Promise.resolve();
  }
}

export async function getAllLogEntries(): Promise<RehearsalLogEntry[]> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
 const store = transaction.objectStore(STORE_NAME);
 const getRequest = store.getAll();
 
    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
 resolve(getRequest.result as RehearsalLogEntry[]);
      };
      getRequest.onerror = () => {
        console.error('Error fetching log entries:', getRequest.error);
        reject(getRequest.error);
      };
    });
  } catch (error) {
    console.warn('Failed to get log entries from IndexedDB:', error);
    return Promise.resolve([]);
  }
}

export async function clearLogEntries(): Promise<void> {
  try {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onerror = () => {
        console.error('Error clearing log entries:', transaction.error);
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.warn('Failed to clear log entries from IndexedDB:', error);
    return Promise.resolve();
  }
}

