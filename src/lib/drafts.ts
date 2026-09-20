import type { Entry } from "./validation";
export type LocalFile = {
  id: string;
  file: Blob;
  name: string;
  alt: string;
  width: number;
  height: number;
  duration: number | null;
  thumbnail: Blob;
  preview?: Blob;
  assets?: Partial<
    Record<
      "original" | "thumbnail" | "preview",
      Entry["outputs"][number]["original"]
    >
  >;
  referenceRole?: NonNullable<Entry["references"]>[number]["role"];
  referenceAsset?: Entry["outputs"][number]["original"];
  uploaded?: Entry["outputs"][number];
};
export type Draft = {
  id: string;
  entry: Entry;
  files: LocalFile[];
  referenceFiles?: LocalFile[];
  baseFileSha: string | null;
  savedAt: string;
  rawParameters?: string;
  attempt?: Entry;
  pending?: { revision: string; commitSha: string | null };
};
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("promptbook-drafts", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("drafts", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("drafts", mode);
      const req = action(tx.objectStore("drafts"));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("草稿保存中断"));
    });
  } finally {
    db.close();
  }
}
export const saveDraft = (draft: Draft) =>
  transact("readwrite", (store) => store.put(draft));
export const getDraft = (id: string) =>
  transact<Draft | undefined>("readonly", (store) => store.get(id));
export const listDrafts = () =>
  transact<Draft[]>("readonly", (store) => store.getAll());
export const removeDraft = (id: string) =>
  transact("readwrite", (store) => store.delete(id));
