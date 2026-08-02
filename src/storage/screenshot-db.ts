import type { StoredScreenshot } from '../shared/types';

const DB_NAME = 'ui-lens-images';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed.')),
    );
  });
}

export function openScreenshotDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('bookmarkId', 'bookmarkId', { unique: true });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('画像データベースを開けませんでした。')),
    );
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openScreenshotDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const result = await requestToPromise(operation(transaction.objectStore(STORE_NAME)));
    await new Promise<void>((resolve, reject) => {
      transaction.addEventListener('complete', () => resolve());
      transaction.addEventListener('abort', () =>
        reject(transaction.error ?? new Error('画像保存を中断しました。')),
      );
      transaction.addEventListener('error', () =>
        reject(transaction.error ?? new Error('画像保存に失敗しました。')),
      );
    });
    return result;
  } finally {
    database.close();
  }
}

export async function saveScreenshot(record: StoredScreenshot): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

export async function getScreenshot(id: string): Promise<StoredScreenshot | undefined> {
  return withStore(
    'readonly',
    (store) => store.get(id) as IDBRequest<StoredScreenshot | undefined>,
  );
}

export async function deleteScreenshot(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function clearScreenshots(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
