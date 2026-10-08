import type { BuyBox } from '../lib/types';
import type { GroupDef } from '../lib/fields';
import { commit } from '../store';
import { Images, LinkField, Text } from './ui';

export function setText(box: BuyBox, id: string, v: string) { box.text[id] = v; commit('text'); }

export function FieldGroup({ box, def, edit, children, bare }: { box: BuyBox; def: GroupDef; edit: boolean; children?: preact.ComponentChildren; bare?: boolean }) {
  const hasText = (ids: string[]) => ids.some((id) => (box.text[id] ?? '').trim());
  const hasImg = (ids: string[]) => ids.some((id) => (box.images[id] ?? []).length);
  const allFieldIds = [...def.fields, ...(def.subgroups?.flatMap((s) => s.fields) ?? [])].map((f) => f.id);
  const any = hasText(allFieldIds) || hasImg((def.images ?? []).map((i) => i.id));
  if (!edit && !any && !children) return null;

  const renderField = (f: GroupDef['fields'][number], noLabel = false) =>
    f.link ? (
      <LinkField key={f.id} label={f.label} text={f.label} value={box.text[f.id] ?? ''} edit={edit} onChange={(v) => setText(box, f.id, v)} />
    ) : (
      <Text key={f.id} label={noLabel ? undefined : f.label} value={box.text[f.id] ?? ''} edit={edit} rows={f.rows} single={f.single} placeholder={f.placeholder} onChange={(v) => setText(box, f.id, v)} />
    );

  const blockBody = def.blocks && (
    <div class="profileblocks">
      {def.blocks.map((bl) => {
        const fs = bl.fields.map((id) => def.fields.find((f) => f.id === id)!);
        const imgs = box.images[bl.images] ?? [];
        if (!edit && !hasText(bl.fields) && !imgs.length) return null;
        return (
          <div class={`card profileblock ${!edit && !imgs.length ? 'noimg' : ''} ${!edit && !hasText(bl.fields) ? 'notext' : ''}`} key={bl.title}>
            <h3>{bl.title}</h3>
            <div class="pb-grid">
              {(edit || hasText(bl.fields)) && <div class="pb-text">{fs.map((f) => renderField(f, fs.length === 1))}</div>}
              <Images edit={edit} images={imgs} label="Reference images" onChange={(v) => { box.images[bl.images] = v; commit('text'); }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const body = blockBody ? <>{children}{blockBody}</> : (
    <>
      {children}
      <div class="fieldgrid">{def.fields.map((f) => renderField(f))}</div>
      {def.subgroups?.map((sg) => {
        if (!edit && !hasText(sg.fields.map((f) => f.id))) return null;
        return (
          <div class="subgroup" key={sg.title}>
            <h4>{sg.title}</h4>
            <div class="fieldgrid">{sg.fields.map((f) => renderField(f))}</div>
          </div>
        );
      })}
      {def.images?.map((im) => (
        <Images key={im.id} label={im.label} hint={im.hint} edit={edit} images={box.images[im.id] ?? []} onChange={(v) => { box.images[im.id] = v; commit('text'); }} />
      ))}
    </>
  );
  return bare ? body : (
    <section class="section" id={`sec-${def.id}`}>
      <header class="section-head"><div class="eyebrow">{def.eyebrow}</div><h2>{def.title}</h2>{def.intro && <p class="lede">{def.intro}</p>}</header>
      {body}
    </section>
  );
}
