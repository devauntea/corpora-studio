/** Device-local project copies. No file-system destination or network access. */
export type WorkspaceEntry = {
  id: string;
  projectId: string;
  name: string;
  label: string;
  kind: "recovery" | "checkpoint";
  updated: number;
  bytes: number;
  studio: "tattoo" | "fashion";
};
const database = "form-studio-workspace-v1";
let connection: Promise<IDBDatabase> | undefined;
function db() {
  return (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("entries", { keyPath: "id" });
      request.result.createObjectStore("contents");
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(
        new Error(
          "Local recovery storage is unavailable. Save a project file to keep your work.",
        ),
      );
    };
  }));
}
function result<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function listWorkspace(): Promise<WorkspaceEntry[]> {
  const d = await db(),
    t = d.transaction("entries", "readonly");
  return (
    await result<WorkspaceEntry[]>(t.objectStore("entries").getAll())
  ).sort((a, b) => b.updated - a.updated);
}
export async function readWorkspace(id: string): Promise<string> {
  const d = await db(),
    t = d.transaction("contents", "readonly"),
    content = await result(t.objectStore("contents").get(id));
  if (typeof content !== "string")
    throw new Error("This local copy is no longer available.");
  return content;
}
export async function putWorkspace(
  entry: WorkspaceEntry,
  content: string,
): Promise<void> {
  if (content.length > 80_000_000)
    throw new Error(
      "This project exceeds the local recovery limit. Save a project file.",
    );
  const d = await db();
  return new Promise((resolve, reject) => {
    // Read budget and replace both stores in one transaction, including concurrent windows.
    const t = d.transaction(["entries", "contents"], "readwrite"),
      store = t.objectStore("entries");
    let message =
      "Could not write local recovery. Save a project file to keep your work.";
    const request = store.getAll();
    request.onsuccess = () => {
      const total =
        (request.result as WorkspaceEntry[])
          .filter((e) => e.id !== entry.id)
          .reduce((sum, e) => sum + e.bytes, 0) + entry.bytes;
      if (total > 400_000_000) {
        message =
          "Local copies have reached 400 MB. Remove older copies in Project library, or save a project file.";
        t.abort();
        return;
      }
      store.put(entry);
      t.objectStore("contents").put(content, entry.id);
    };
    t.oncomplete = () => resolve();
    t.onabort = () => reject(new Error(message));
    t.onerror = () => reject(new Error(message));
  });
}
export async function deleteWorkspace(id: string): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(["entries", "contents"], "readwrite");
    t.objectStore("entries").delete(id);
    t.objectStore("contents").delete(id);
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
  });
}
