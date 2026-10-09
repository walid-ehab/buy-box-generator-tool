import type { Bundle } from './types';
import type { OriginalFile } from './files';

// Drafts live in IndexedDB (hundreds of MB) instead of localStorage (~5 MB), so the original
// workbook can be kept too. The big original is stored under its own key and only rewritten
// when a new file is uploaded; the (small) spec + data is rewritten on every edit.
// (the database name keeps its old value on purpose: renaming it would orphan drafts saved earlier)
const DB = 'buybox-generator', STORE = 'kv', LEGACY_KEY = 'buybox-draft-v1';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = t.onabort = () => reject(t.error);
    });
  } finally { db.close(); }
}

const put = (k: string, v: unknown) => tx('readwrite', (s) => s.put(v, k));
const get = <T>(k: string) => tx<T | undefined>('readonly', (s) => s.get(k) as IDBRequest<T | undefined>);
const del = (k: string) => tx('readwrite', (s) => s.delete(k));

/** Best effort: a failure (private window, blocked storage) never interrupts editing. */
export async function saveDraft(spec: Bundle['spec'], data: Bundle['data']) {
  try { await put('draft', { spec: JSON.parse(JSON.stringify(spec)), data }); } catch { /* ignore */ }
}
export async function saveOriginal(o: OriginalFile | null) {
  try { if (o) await put('original', { name: o.name, mime: o.mime, data: o.data ?? undefined, b64: o.b64 }); else await del('original'); } catch { /* ignore */ }
}
export async function readDraft(): Promise<Bundle | null> {
  try {
    const d = await get<{ spec: Bundle['spec']; data: Bundle['data'] }>('draft');
    if (d) {
      const original = await get<OriginalFile>('original');
      return { spec: d.spec, data: d.data, ...(original ? { original } : {}) };
    }
  } catch { /* fall through to the legacy draft */ }
  try {
    const raw = localStorage.getItem(LEGACY_KEY);   // drafts saved by earlier versions
    return raw ? (JSON.parse(raw) as Bundle) : null;
  } catch { return null; }
}
export async function clearDraft() {
  try { await del('draft'); await del('original'); } catch { /* ignore */ }
  try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
}
