import type { BuyBox, Extent, Setting } from '../lib/types';
import { commit } from '../store';
import { Text } from './ui';

/** Click an option to select it (optionally click again to clear). */
function Choice<T extends string>({ value, options, onChange, clearable = false }: { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T | undefined) => void; clearable?: boolean }) {
  return (
    <div class="segmented">
      {options.map((o) => (
        <button type="button" key={o.value} class={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(clearable && o.value === value ? undefined : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] as const;
const EXTENT: { value: Extent; label: string }[] = [{ value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type ViewChoice = 'yes' | 'no' | 'na';
/** Defaults: view = not applicable, waterfront = no, privacy = not applicable. */
export function effectiveSetting(st?: Setting) {
  const v = st?.view;
  const view: ViewChoice = v === true ? 'yes' : v === false ? 'no' : v ?? 'na';
  return { view, waterfront: st?.waterfront ?? false, privacy: st?.privacy ?? 'na' } as const;
}

export const hasSetting = (_s?: Setting) => true; // every item always has a value (defaults), so the block is always shown

export function SettingEditor({ box, edit }: { box: BuyBox; edit: boolean }) {
  const st: Setting = (box.setting ??= {});
  const eff = effectiveSetting(st);
  const set = (patch: Partial<Setting>) => { Object.assign(st, patch); commit('text'); };

  if (!edit) {
    const viewPills: string[] = [];
    if (eff.view === 'yes') {
      if (st.mountain) viewPills.push(`Mountain view · ${cap(st.mountain)}`);
      if (st.lake) viewPills.push(`Lake view · ${cap(st.lake)}`);
      if (!viewPills.length) viewPills.push('Yes');
    } else viewPills.push(eff.view === 'no' ? 'No' : 'Not applicable');
    const rows: [string, string[], string | undefined][] = [
      ['View', viewPills, st.viewNote],
      ['Waterfront', [eff.waterfront ? 'Yes' : 'No'], st.waterfrontNote],
      ['Privacy / seclusion', [eff.privacy === 'na' ? 'Not applicable' : cap(eff.privacy)], st.privacyNote],
    ];
    return (
      <div class="settingview">
        {rows.map(([label, vals, note]) => (
          <div class="setrow" key={label}>
            <span class="lbl">{label}</span>
            <div>{vals.map((v) => <span class="pill good big">{v}</span>)}</div>
            <Text edit={false} value={note ?? ''} onChange={() => {}} class="setnote" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div class="settinged">
      <div class="setrow">
        <span class="lbl">View</span>
        <Choice value={eff.view} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'na', label: 'Not applicable' }]}
          onChange={(v) => set({ view: v ?? 'na', ...(v === 'yes' ? {} : { mountain: undefined, lake: undefined }) })} />
        {eff.view === 'yes' && (
          <div class="viewtypes">
            {([['mountain', 'Mountain view'], ['lake', 'Lake view']] as const).map(([k, label]) => (
              <div class="viewtype" key={k}>
                <label class="check"><input type="checkbox" checked={!!st[k]} onChange={(e) => set({ [k]: (e.target as HTMLInputElement).checked ? 'full' : undefined })} /> {label}</label>
                {st[k] && <Choice value={st[k]} options={EXTENT} onChange={(v) => set({ [k]: v ?? 'full' })} />}
              </div>
            ))}
            <p class="hint">Tick both if the property has both.</p>
          </div>
        )}
        <Text edit value={st.viewNote ?? ''} rows={2} placeholder="Note on the view (optional)" onChange={(v) => set({ viewNote: v })} />
      </div>
      <div class="setrow">
        <span class="lbl">Waterfront</span>
        <Choice value={eff.waterfront ? 'yes' : 'no'} options={[...YES_NO]} onChange={(v) => set({ waterfront: v === 'yes' })} />
        <Text edit value={st.waterfrontNote ?? ''} rows={2} placeholder="Note on the waterfront (optional)" onChange={(v) => set({ waterfrontNote: v })} />
      </div>
      <div class="setrow">
        <span class="lbl">Privacy / seclusion</span>
        <Choice value={eff.privacy} options={[{ value: 'private', label: 'Private' }, { value: 'secluded', label: 'Secluded' }, { value: 'na', label: 'Not applicable' }]} onChange={(v) => set({ privacy: v ?? 'na' })} />
        <Text edit value={st.privacyNote ?? ''} rows={2} placeholder="Note on privacy / seclusion (optional), e.g. fenced backyard" onChange={(v) => set({ privacyNote: v })} />
      </div>
    </div>
  );
}
