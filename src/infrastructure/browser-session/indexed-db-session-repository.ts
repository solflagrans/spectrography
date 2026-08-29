import type { AnalysisSession } from "@/domain/session/model";
import type { AnalysisSessionRepository } from "@/domain/session/repository";

const DATABASE_NAME = "spectrography";
const DATABASE_VERSION = 1;
const SESSION_STORE = "analysis-sessions";

export class IndexedDbAnalysisSessionRepository implements AnalysisSessionRepository {
  async findById(id: string): Promise<AnalysisSession | null> {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readonly");
    const request = transaction.objectStore(SESSION_STORE).get(id);
    const result = await requestToPromise<AnalysisSession | undefined>(request);
    await transactionToPromise(transaction);
    return result ?? null;
  }

  async save(session: AnalysisSession): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).put(session);
    await transactionToPromise(transaction);
  }

  async remove(id: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    transaction.objectStore(SESSION_STORE).delete(id);
    await transactionToPromise(transaction);
  }
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB доступна только в браузере."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SESSION_STORE)) {
        request.result.createObjectStore(SESSION_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Не удалось открыть IndexedDB."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Операция IndexedDB завершилась ошибкой."));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Транзакция IndexedDB завершилась ошибкой."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Транзакция IndexedDB была отменена."));
  });
}
