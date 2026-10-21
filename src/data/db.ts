/**
 * IndexedDB の薄いラッパー
 *
 * - 予定（events）、設定（settings）、メタ情報（meta）の 3 つのストアを持ちます。
 * - 失敗した場合は StorageError を投げ、画面側で日本語のメッセージを表示します。
 */

export const DB_NAME = 'chronos-atelier';
export const DB_VERSION = 1;

export type StoreName = 'events' | 'settings' | 'meta';

export class StorageError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/** ブラウザのエラーを、利用者に分かる日本語の説明に変換 */
export function describeStorageError(err: unknown): string {
  if (err instanceof StorageError) return err.message;
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : '';
  switch (name) {
    case 'QuotaExceededError':
      return '端末の保存容量が不足しているため保存できませんでした。不要なデータを削除してから再度お試しください。';
    case 'InvalidStateError':
    case 'UnknownError':
      return '保存領域に一時的にアクセスできませんでした。アプリを再読み込みしてからお試しください。';
    case 'VersionError':
      return '保存データの版が新しすぎます。最新のアプリに更新してください。';
    default:
      return '保存に失敗しました。もう一度お試しください。';
  }
}

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  if (!factory) {
    return Promise.reject(
      new StorageError('このブラウザでは端末内の保存機能（IndexedDB）が使えません。予定は保存されません。'),
    );
  }
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new StorageError('保存領域を開けませんでした。プライベートブラウズでは保存できない場合があります。', err));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const db = request.result;
      // 他のタブで新しい版が開かれたら閉じる
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(new StorageError('保存領域を開けませんでした。プライベートブラウズでは保存できない場合があります。', request.error));
    };
    request.onblocked = () => {
      // 古いタブが開いたままの場合
      reject(new StorageError('別のタブで古い版のアプリが開いています。他のタブを閉じてから再読み込みしてください。'));
    };
  });
  return dbPromise;
}

/** テスト用：接続をリセット */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * トランザクションを実行し、完了（コミット）まで待つ。
 * 書き込みは complete イベントを待つので、「保存したつもり」になりません。
 */
export async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T> | T,
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeName, mode);
    } catch (err) {
      reject(new StorageError(describeStorageError(err), err));
      return;
    }
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(new StorageError(describeStorageError(tx.error), tx.error));
    tx.onerror = () => {
      /* onabort で処理 */
    };
    const store = tx.objectStore(storeName);
    Promise.resolve()
      .then(() => run(store))
      .then((value) => (value instanceof IDBRequest ? requestToPromise(value) : value))
      .then((value) => {
        result = value as T;
      })
      .catch((err) => {
        try {
          tx.abort();
        } catch {
          /* 既に終了している */
        }
        reject(new StorageError(describeStorageError(err), err));
      });
  });
}

export { requestToPromise };
