import { useEffect, useState } from 'preact/hooks';
import type { Bundle, Dataset, Spec } from './lib/types';
import { originalB64, type OriginalFile } from './lib/files';
import { saveDraft, saveOriginal } from './lib/drafts';

export type Mode = 'edit' | 'view';

interface State {
  spec: Spec | null;
  data: Dataset | null;
  mode: Mode;
  page: string;          // 'overview' | box id
  original: OriginalFile | null;   // the uploaded workbook, offered to viewers as a download
  dv: number;            // bumps when analytics inputs change
  tv: number;            // bumps on any change
}

export const store: State = { spec: null, data: null, original: null, mode: 'edit', page: 'overview', dv: 0, tv: 0 };
const listeners = new Set<() => void>();

export function commit(kind: 'data' | 'text' = 'text') {
  if (kind === 'data') store.dv++;
  store.tv++;
  listeners.forEach((f) => f());
  scheduleSave();
}

export function useStore(): State {
  const [, set] = useState(0);
  useEffect(() => {
    const f = () => set((x) => x + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  return store;
}

export function setPage(p: string) {
  store.page = p;
  history.replaceState(null, '', p === 'overview' ? '#overview' : `#box/${p}`);
  window.scrollTo({ top: 0 });
  commit();
}

export function deleteBox(id: string) {
  const s = store.spec;
  if (!s) return;
  const b = s.boxes.find((x) => x.id === id);
  if (!b || !window.confirm(`Delete "${b.name || 'this buy box'}"? This cannot be undone.`)) return;
  s.boxes = s.boxes.filter((x) => x.id !== id);
  commit('data');
  setPage('overview');
}

export function setMode(m: Mode) { store.mode = m; commit(); }

/** fromDraft: the bundle's original file is already stored in the draft, so don't write it again. */
export function load(bundle: Bundle, mode: Mode, opts: { fromDraft?: boolean } = {}) {
  if (opts.fromDraft) lastSavedOriginal = bundle.original ?? null;
  store.spec = bundle.spec;
  store.data = bundle.data;
  store.original = bundle.original ?? null;
  store.mode = mode;
  const hash = location.hash;
  const m = hash.match(/^#box\/(.+)$/);
  store.page = m && bundle.spec.boxes.some((b) => b.id === m[1]) ? m[1] : 'overview';
  store.dv++; store.tv++;
  listeners.forEach((f) => f());
}

// ------------------------------------------------------------------ draft autosave (IndexedDB, see lib/drafts.ts)

let saveTimer: number | undefined;
let lastSavedOriginal: OriginalFile | null | undefined;   // undefined = nothing saved yet this session
function scheduleSave() {
  if (!store.spec || !store.data || store.mode !== 'edit') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!store.spec || !store.data) return;
    // keep the stored original in step with whatever market is loaded (written only when it changes)
    if (store.original !== lastSavedOriginal) { lastSavedOriginal = store.original; void saveOriginal(store.original); }
    void saveDraft(store.spec, store.data);
  }, 800);
}

// ------------------------------------------------------------------ embedded bundle & export

export const BUNDLE_ID = 'buybox-bundle';

export function readEmbedded(): Bundle | null {
  const el = document.getElementById(BUNDLE_ID);
  const txt = el?.textContent?.trim();
  if (!txt) return null;
  try { return JSON.parse(txt) as Bundle; } catch { return null; }
}

const safeJson = (b: { spec: Spec; data: Dataset; original?: { name: string; mime: string; b64: string } }) => JSON.stringify(b).replace(/</g, '\\u003c').split(String.fromCharCode(0x2028)).join('\\u2028').split(String.fromCharCode(0x2029)).join('\\u2029');

async function sourceHtml(): Promise<string> {
  try {
    const r = await fetch(location.href.split('#')[0], { cache: 'no-store' });
    const t = await r.text();
    if (r.ok && t.includes('<script')) return t;
  } catch { /* file:// — fall through to the DOM */ }
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelector('#app')?.replaceChildren();
  clone.querySelectorAll('[data-runtime]').forEach((n) => n.remove());
  return '<!doctype html>\n' + clone.outerHTML;
}

export async function buildHtml(): Promise<string> {
  const html = await sourceHtml();
  const original = store.original ? { name: store.original.name, mime: store.original.mime, b64: originalB64(store.original) } : undefined;
  const block = `<script id="${BUNDLE_ID}" type="application/json">${safeJson({ spec: store.spec!, data: store.data!, original })}</script>`;
  const re = new RegExp(`<script id="${BUNDLE_ID}"[^>]*>[\\s\\S]*?</script>`);
  // function replacers: the JSON contains `$` sequences that must not be interpreted
  if (re.test(html)) return html.replace(re, () => block);
  const at = html.toLowerCase().lastIndexOf('</body>');
  return at < 0 ? html + block : html.slice(0, at) + block + '\n' + html.slice(at);
}

export async function downloadHtml() {
  const html = await buildHtml();
  const name = (store.spec!.market.name || 'market').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `${name || 'market'}-buy-boxes.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
