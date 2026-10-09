import { useEffect, useRef } from 'preact/hooks';
import type { BuyBox } from '../lib/types';
import { commit } from '../store';
import { Images, Text } from './ui';

type Note = NonNullable<BuyBox['notes']>[number];

/** Notes are bullet points; an older single text box (+ images) is converted to bullets the first time it is opened. */
export function getNotes(box: BuyBox): Note[] {
  if (!box.notes) {
    const legacy = (box.text.notes ?? '').split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);
    const imgs = box.images.notesImages ?? [];
    box.notes = legacy.map((text) => ({ text, images: [] }));
    if (imgs.length) { if (box.notes.length) box.notes[0].images = imgs; else box.notes.push({ text: '', images: imgs }); }
    delete box.text.notes; delete box.images.notesImages;
  }
  return box.notes;
}

export const hasNotes = (box: BuyBox) => getNotes(box).some((n) => n.text.trim() || n.images.length);

function NoteBox({ value, onChange, onEnter, autoFocus }: { value: string; onChange: (v: string) => void; onEnter: () => void; autoFocus: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; } }, [value]);
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, []);
  return (
    <textarea ref={ref} rows={1} value={value} placeholder="Write a note… (Enter adds the next bullet, Shift+Enter for a new line)"
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); onEnter(); } }} />
  );
}

let focusNext: Note | null = null;
const ids = new WeakMap<Note, number>();
let nextId = 1;
const keyOf = (n: Note) => { if (!ids.has(n)) ids.set(n, nextId++); return ids.get(n)!; };

export function AnalystNotes({ box, edit }: { box: BuyBox; edit: boolean }) {
  const notes = getNotes(box);
  const add = (at = notes.length) => { const n: Note = { text: '', images: [] }; notes.splice(at, 0, n); focusNext = n; commit('text'); };
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= notes.length) return; [notes[i], notes[j]] = [notes[j], notes[i]]; commit('text'); };

  if (!edit) {
    const shown = notes.filter((n) => n.text.trim() || n.images.length);
    if (!shown.length) return <p class="muted empty">Nothing added yet.</p>;
    return (
      <ul class="notelist">
        {shown.map((n, i) => (
          <li key={keyOf(n)}>
            <Text edit={false} value={n.text} onChange={() => {}} />
            <Images edit={false} compact images={n.images} onChange={() => {}} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div class="noteed">
      {notes.map((n, i) => {
        const focus = focusNext === n; if (focus) focusNext = null;
        return (
          <div class="noterow" key={keyOf(n)}>
            <span class="bullet" aria-hidden="true">•</span>
            <div class="notebody">
              <NoteBox value={n.text} autoFocus={focus} onChange={(v) => { n.text = v; commit('text'); }} onEnter={() => add(i + 1)} />
              <Images compact edit images={n.images} onChange={(v) => { n.images = v; commit('text'); }} />
            </div>
            <div class="notectl">
              <button type="button" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" title="Move down" disabled={i === notes.length - 1} onClick={() => move(i, 1)}>▼</button>
              <button type="button" title="Delete this note" class="del" onClick={() => { notes.splice(i, 1); commit('text'); }}>✕</button>
            </div>
          </div>
        );
      })}
      <button type="button" class="addcard slim" onClick={() => add()}>+ Add note</button>
    </div>
  );
}
