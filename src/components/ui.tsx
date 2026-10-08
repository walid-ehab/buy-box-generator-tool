import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Img, Range, RangeOp } from '../lib/types';
import { fileToImg } from '../lib/images';

export const fmtMoney = (v: number) => (isFinite(v) ? '$' + Math.round(v).toLocaleString('en-US') : '—');
export const fmtK = (v: number) => (!isFinite(v) ? '—' : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);
export const fmtPct = (v: number, d = 0) => (isFinite(v) ? `${v.toFixed(d)}%` : '—');

// ------------------------------------------------------------------ layout

export function Section({ id, eyebrow, title, intro, children }: {
  id?: string; eyebrow?: string; title: string; intro?: ComponentChildren; children: ComponentChildren;
}) {
  return (
    <section class="section" id={id}>
      <header class="section-head">
        {eyebrow && <div class="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {intro && <p class="lede">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

export function Card({ title, children, class: cls, actions }: { title?: string; children: ComponentChildren; class?: string; actions?: ComponentChildren }) {
  return (
    <div class={`card ${cls ?? ''}`}>
      {(title || actions) && <div class="card-head"><h3>{title}</h3><div class="card-actions">{actions}</div></div>}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ComponentChildren; sub?: ComponentChildren }) {
  return (
    <div class="stat">
      <div class="stat-value">{value}</div>
      <div class="stat-label">{label}</div>
      {sub && <div class="stat-sub">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div class="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} class={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'good'; children: ComponentChildren }) {
  return <div class={`callout ${tone}`}>{children}</div>;
}

// ------------------------------------------------------------------ inputs

export function NumberField({ label, value, onChange, step = 1, min, max, suffix, prefix, width }: {
  label?: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string; prefix?: string; width?: number;
}) {
  return (
    <label class="numfield">
      {label && <span class="lbl">{label}</span>}
      <span class="numwrap">
        {prefix && <span class="affix">{prefix}</span>}
        <input
          type="number" value={Number.isFinite(value) ? value : ''} step={step} min={min} max={max} style={width ? { width: `${width}px` } : undefined}
          onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(v)) onChange(v); }}
        />
        {suffix && <span class="affix">{suffix}</span>}
      </span>
    </label>
  );
}

export function RangeEditor({ label, unit, value, onChange }: { label: string; unit: string; value: Range; onChange: (r: Range) => void }) {
  const ops: { v: RangeOp; l: string }[] = [
    { v: 'eq', l: 'exactly' }, { v: 'gte', l: 'at least' }, { v: 'lte', l: 'at most' }, { v: 'range', l: 'between' },
  ];
  const step = unit === 'baths' ? 0.5 : 1;
  return (
    <div class="rangeed">
      <span class="lbl">{label}</span>
      <div class="rangeed-row">
        <select value={value.op} onChange={(e) => onChange({ ...value, op: (e.target as HTMLSelectElement).value as RangeOp })}>
          {ops.map((o) => <option value={o.v}>{o.l}</option>)}
        </select>
        <input type="number" step={step} min={0} value={value.a} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(v)) onChange({ ...value, a: v, b: value.op === 'eq' ? v : value.b }); }} />
        {value.op === 'range' && <><span class="affix">to</span>
          <input type="number" step={step} min={0} value={value.b} onInput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); if (Number.isFinite(v)) onChange({ ...value, b: v }); }} /></>}
        <span class="affix">{unit}</span>
      </div>
    </div>
  );
}

/** Text that is a plain paragraph in view mode and a textarea/input in edit mode. Hidden in view mode when empty. */
export function Text({ value, onChange, edit, placeholder, rows = 3, single, label, hint, class: cls }: {
  value: string; onChange: (v: string) => void; edit: boolean; placeholder?: string; rows?: number; single?: boolean; label?: string; hint?: string; class?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; }
  }, [value, edit]);
  if (!edit && !value.trim()) return null;
  return (
    <div class={`textfield ${cls ?? ''}`}>
      {label && <div class="lbl">{label}</div>}
      {edit ? (
        single ? (
          <input type="text" value={value} placeholder={placeholder} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
        ) : (
          <textarea ref={ref} rows={rows} value={value} placeholder={placeholder} onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)} />
        )
      ) : (
        <div class="prose">{value.split(/\n{2,}/).map((p) => <p>{p.split('\n').map((ln, i) => <>{i > 0 && <br />}{linkify(ln)}</>)}</p>)}</div>
      )}
      {edit && hint && <div class="hint">{hint}</div>}
    </div>
  );
}

function linkify(s: string): ComponentChildren {
  const parts = s.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((p) => (/^https?:\/\//.test(p) ? <a href={p} target="_blank" rel="noopener noreferrer">{p}</a> : p));
}

export function LinkField({ label, value, onChange, edit, text }: { label: string; value: string; onChange: (v: string) => void; edit: boolean; text: string }) {
  if (!edit && !value.trim()) return null;
  return (
    <div class="textfield">
      <div class="lbl">{label}</div>
      {edit
        ? <input type="url" value={value} placeholder="https://…" onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
        : <a class="btn ghost" href={value} target="_blank" rel="noopener noreferrer">{text} ↗</a>}
    </div>
  );
}

// ------------------------------------------------------------------ images

let openLightbox: (imgs: Img[], i: number) => void = () => {};

export function Lightbox() {
  const [st, set] = useState<{ imgs: Img[]; i: number } | null>(null);
  openLightbox = (imgs, i) => set({ imgs, i });
  useEffect(() => {
    if (!st) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') set(null);
      if (e.key === 'ArrowRight') set((s) => s && { ...s, i: (s.i + 1) % s.imgs.length });
      if (e.key === 'ArrowLeft') set((s) => s && { ...s, i: (s.i - 1 + s.imgs.length) % s.imgs.length });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [st]);
  if (!st) return null;
  const im = st.imgs[st.i];
  return (
    <div class="lightbox" onClick={() => set(null)}>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={im.src} alt={im.caption} />
        {im.caption && <figcaption>{im.caption}</figcaption>}
      </figure>
      {st.imgs.length > 1 && <>
        <button class="lb-nav l" onClick={(e) => { e.stopPropagation(); set({ ...st, i: (st.i - 1 + st.imgs.length) % st.imgs.length }); }}>‹</button>
        <button class="lb-nav r" onClick={(e) => { e.stopPropagation(); set({ ...st, i: (st.i + 1) % st.imgs.length }); }}>›</button>
      </>}
      <button class="lb-close" onClick={() => set(null)}>✕</button>
    </div>
  );
}

export function Images({ images, onChange, edit, label, hint, compact }: {
  images: Img[]; onChange: (v: Img[]) => void; edit: boolean; label?: string; hint?: string; compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  if (!edit && !images.length) return null;
  const add = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      const imgs: Img[] = [];
      for (const f of Array.from(files)) if (f.type.startsWith('image/')) imgs.push(await fileToImg(f));
      onChange([...images, ...imgs]);
    } finally { setBusy(false); }
  };
  return (
    <div class={`images ${compact ? 'compact' : ''}`}>
      {label && <div class="lbl">{label}</div>}
      <div class="imggrid">
        {images.map((im, i) => (
          <figure class="thumb" key={im.src.slice(-40) + i}>
            <img src={im.src} alt={im.caption || label || ''} loading="lazy" onClick={() => openLightbox(images, i)} />
            {edit ? (
              <>
                <input class="cap" type="text" placeholder="Caption" value={im.caption} onInput={(e) => { im.caption = (e.target as HTMLInputElement).value; onChange([...images]); }} />
                <button class="x" title="Remove" onClick={() => onChange(images.filter((_, j) => j !== i))}>✕</button>
              </>
            ) : im.caption ? <figcaption>{im.caption}</figcaption> : null}
          </figure>
        ))}
        {edit && (
          <label class={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files) add(e.dataTransfer.files); }}>
            <input type="file" accept="image/*" multiple hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) add(f); (e.target as HTMLInputElement).value = ''; }} />
            <span class="plus">{busy ? '…' : '+'}</span>
            <span>{busy ? 'Processing' : 'Add images'}</span>
          </label>
        )}
      </div>
      {edit && hint && <div class="hint">{hint}</div>}
    </div>
  );
}
