import type { BuyBox } from '../lib/types';
import { commit } from '../store';
import { fmtK, fmtMoney } from './ui';

export type Proj = NonNullable<BuyBox['proj']>;

/** Default target purchase price: the high revenue tier ÷ 15% (i.e. × 100/15), rounded to the nearest $1,000. */
export const defaultPrice = (high?: number) => (high ? Math.round((high * 100) / 15 / 1000) * 1000 : undefined);
export const effectivePrice = (p?: Proj) => p?.price ?? defaultPrice(p?.high);

const TIERS = [['low', 'Low'], ['mid', 'Mid'], ['high', 'High']] as const;

function Money({ value, onChange, placeholder }: { value?: number; onChange: (v: number | undefined) => void; placeholder?: string }) {
  return (
    <span class="numwrap money">
      <span class="affix">$</span>
      <input type="number" min={0} step={1000} value={value ?? ''} placeholder={placeholder}
        onInput={(e) => { const t = (e.target as HTMLInputElement).value; const v = parseFloat(t); onChange(t === '' || !Number.isFinite(v) ? undefined : v); }} />
    </span>
  );
}

export function Projections({ box, edit, onSuggest, suggestLabel }: { box: BuyBox; edit: boolean; onSuggest: () => void; suggestLabel: string }) {
  const pr: Proj = (box.proj ??= {});
  const price = effectivePrice(pr);
  const set = (patch: Partial<Proj>) => { Object.assign(pr, patch); commit('text'); };

  if (!edit) {
    const cards = TIERS.filter(([k]) => pr[k] != null);
    if (!cards.length && price == null) return <p class="muted empty">Nothing added yet.</p>;
    return (
      <>
        {cards.length > 0 && (
          <div class="proj">
            {cards.map(([k, label]) => (
              <div class={`projcard tier-${k}`} key={k}><div class="lbl">{label} revenue potential</div><div class="projval">{fmtMoney(pr[k]!)}</div></div>
            ))}
          </div>
        )}
        {price != null && <div class="proj"><div class="projcard price"><div class="lbl">Target purchase price</div><div class="projval">{fmtMoney(price)}</div></div></div>}
      </>
    );
  }

  return (
    <>
      <div class="proj">
        {TIERS.map(([k, label]) => (
          <div class={`projcard tier-${k}`} key={k}>
            <div class="lbl">{label} revenue potential</div>
            <Money value={pr[k]} placeholder={k === 'low' ? '90000' : k === 'mid' ? '105000' : '120000'} onChange={(v) => set({ [k]: v })} />
          </div>
        ))}
      </div>
      <button class="link" onClick={onSuggest}>{suggestLabel}</button>
      <div class="proj" style={{ marginTop: '14px' }}>
        <div class="projcard price">
          <div class="lbl">Target purchase price</div>
          <Money value={price} placeholder="auto" onChange={(v) => set({ price: v })} />
          <div class="hint">
            {pr.price != null
              ? <>Manually set. <button class="link" onClick={() => set({ price: undefined })}>Reset to default</button>{defaultPrice(pr.high) != null && <> ({fmtK(defaultPrice(pr.high)!)} = high ÷ 15%)</>}</>
              : <>Default: high revenue × 100/15 (a 15% revenue-to-price ratio), rounded to $1k. Type a value to override.</>}
          </div>
        </div>
      </div>
    </>
  );
}
