import type { BuyBox, Extent, Setting } from '../lib/types';
import { commit } from '../store';

/** Click an option to select it, click it again to clear it. */
function Choice<T extends string>({ value, options, onChange }: { value: T | undefined; options: { value: T; label: string }[]; onChange: (v: T | undefined) => void }) {
  return (
    <div class="segmented">
      {options.map((o) => (
        <button type="button" key={o.value} class={o.value === value ? 'on' : ''} aria-pressed={o.value === value} onClick={() => onChange(o.value === value ? undefined : o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

const YES_NO = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] as const;
const EXTENT: { value: Extent; label: string }[] = [{ value: 'partial', label: 'Partial' }, { value: 'full', label: 'Full' }];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const hasSetting = (s?: Setting) => !!s && (s.view !== undefined || s.waterfront !== undefined || s.privacy !== undefined);

export function SettingEditor({ box, edit }: { box: BuyBox; edit: boolean }) {
  const st: Setting = (box.setting ??= {});
  const set = (patch: Partial<Setting>) => { Object.assign(st, patch); commit('text'); };
  const yn = (v: boolean | undefined) => (v === undefined ? undefined : v ? 'yes' : 'no');
  const fromYn = (v: 'yes' | 'no' | undefined) => (v === undefined ? undefined : v === 'yes');

  if (!edit) {
    const viewPills: string[] = [];
    if (st.view) {
      if (st.mountain) viewPills.push(`Mountain view · ${cap(st.mountain)}`);
      if (st.lake) viewPills.push(`Lake view · ${cap(st.lake)}`);
      if (!viewPills.length) viewPills.push('Yes');
    } else if (st.view === false) viewPills.push('No');
    const rows: [string, string[]][] = [
      ['View', viewPills],
      ['Waterfront', st.waterfront === undefined ? [] : [st.waterfront ? 'Yes' : 'No']],
      ['Privacy / seclusion', st.privacy ? [cap(st.privacy)] : []],
    ];
    return (
      <div class="settingview">
        {rows.filter(([, v]) => v.length).map(([label, vals]) => (
          <div class="setrow" key={label}><span class="lbl">{label}</span><div>{vals.map((v) => <span class="pill good big">{v}</span>)}</div></div>
        ))}
      </div>
    );
  }

  return (
    <div class="settinged">
      <div class="setrow">
        <span class="lbl">View</span>
        <Choice value={yn(st.view)} options={[...YES_NO]} onChange={(v) => set({ view: fromYn(v), ...(v === 'yes' ? {} : { mountain: undefined, lake: undefined }) })} />
        {st.view && (
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
      </div>
      <div class="setrow">
        <span class="lbl">Waterfront</span>
        <Choice value={yn(st.waterfront)} options={[...YES_NO]} onChange={(v) => set({ waterfront: fromYn(v) })} />
      </div>
      <div class="setrow">
        <span class="lbl">Privacy / seclusion</span>
        <Choice value={st.privacy} options={[{ value: 'private', label: 'Private' }, { value: 'secluded', label: 'Secluded' }]} onChange={(v) => set({ privacy: v })} />
      </div>
    </div>
  );
}
