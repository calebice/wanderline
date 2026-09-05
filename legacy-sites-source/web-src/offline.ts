import { useEffect, useState } from "react";

import type { LibraryAttempt, LibraryExercise } from "./api";

const DB_NAME = "drawcoach-library";
const DB_VERSION = 1;
const EXERCISES = "exercises";
const ATTEMPTS = "attempts";
const PENDING_EXPORTS = "pending-exports";

type StoredRecord = LibraryExercise | LibraryAttempt | { id: string; exported_at: string };
const memoryStores = new Map<string, Map<string, StoredRecord>>();

function memoryStore(name: string) {
  if (!memoryStores.has(name)) memoryStores.set(name, new Map());
  return memoryStores.get(name)!;
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(EXERCISES)) db.createObjectStore(EXERCISES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(ATTEMPTS)) db.createObjectStore(ATTEMPTS, { keyPath: "id" });
      if (!db.objectStoreNames.contains(PENDING_EXPORTS)) db.createObjectStore(PENDING_EXPORTS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function put(storeName: string, value: StoredRecord): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    memoryStore(storeName).set(value.id, value);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function get<T extends StoredRecord>(storeName: string, id: string): Promise<T | null> {
  const db = await openDatabase();
  if (!db) return (memoryStore(storeName).get(id) as T | undefined) ?? null;
  const value = await new Promise<T | undefined>((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value ?? null;
}

async function getAll<T extends StoredRecord>(storeName: string): Promise<T[]> {
  const db = await openDatabase();
  if (!db) return [...memoryStore(storeName).values()] as T[];
  const values = await new Promise<T[]>((resolve, reject) => {
    const request = db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return values;
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDatabase();
  if (!db) {
    memoryStore(storeName).delete(id);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function cacheLibraryExercises(exercises: LibraryExercise[]) {
  await Promise.all(exercises.map((exercise) => put(EXERCISES, exercise)));
}

export function cacheLibraryExercise(exercise: LibraryExercise) {
  return put(EXERCISES, exercise);
}

export function getCachedLibraryExercise(id: string) {
  return get<LibraryExercise>(EXERCISES, id);
}

export async function getCachedLibraryExercises(track?: string, difficulty?: number) {
  const exercises = await getAll<LibraryExercise>(EXERCISES);
  return exercises
    .filter((item) => (!track || item.track === track) && (!difficulty || item.difficulty === difficulty))
    .sort((left, right) => left.sequence_index - right.sequence_index);
}

export function cacheLibraryAttempt(attempt: LibraryAttempt) {
  return put(ATTEMPTS, attempt);
}

export function getCachedLibraryAttempt(id: string) {
  return get<LibraryAttempt>(ATTEMPTS, id);
}

export function queueDigitalExport(id: string, exportedAt: string) {
  return put(PENDING_EXPORTS, { id, exported_at: exportedAt });
}

export function getPendingDigitalExports() {
  return getAll<{ id: string; exported_at: string }>(PENDING_EXPORTS);
}

export function removePendingDigitalExport(id: string) {
  return remove(PENDING_EXPORTS, id);
}

export function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  return online;
}
