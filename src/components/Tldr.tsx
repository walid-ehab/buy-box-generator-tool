import type { BuyBox } from '../lib/types';
import { rangeLabel } from '../lib/analysis';
import { effectiveSetting } from './SettingEditor';
import { fmtK } from './ui';

const clip = (s: string, n = 170) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Compact summary of the buy box: size, amenities, ICP, any non-default view / waterfront / privacy, and the analyst notes. */
export function Tldr({ box, must, nice, notes, revenue }: { box: BuyBox; revenue?: BuyBox['proj']; must: string[]; nice: { label: string; effect?: number }[]; notes: string[] }) {
  const st = box.setting;
  const eff = effectiveSetting(st);
  const setting: string[] = [];
  if (eff.view === 'yes') {
    const parts = [st?.mountain && `Mountain (${st.mountain})`, st?.lake && `Lake (${st.lake})`].filter(Boolean) as string[];
    setting.push(`View · ${parts.length ? parts.join(' + ') : 'Yes'}`);
  } else if (eff.view === 'no') setting.push('View · No');
  if (eff.waterfront) setting.push('Waterfront · Yes');
  if (eff.privacy !== 'na') setting.push(`Privacy · ${cap(eff.privacy)}`);
  const icp = clip(box.text.icp ?? '');

  const rows: [string, preact.ComponentChildren][] = [
    ['Size', <b>{rangeLabel(box.beds, 'BR')} · {rangeLabel(box.baths, 'BA')} · Sleeps {rangeLabel(box.sleeps)}</b>],
  ];
  if (must.length) rows.push(['Must-haves', <>{must.map((m) => <span class="tl-pill">{m}</span>)}</>]);
  if (nice.length) rows.push(['Nice-to-haves', <>{nice.map((n) => <span class="tl-pill alt">{n.label}{n.effect != null && <em> {n.effect >= 0 ? '+' : ''}{n.effect.toFixed(0)}%</em>}</span>)}</>]);
  const tiers = ([['low', 'Low'], ['mid', 'Mid'], ['high', 'High']] as const).filter(([k]) => revenue?.[k] != null);
  if (tiers.length) rows.push(['Revenue potential', <>{tiers.map(([k, l]) => <span class="tl-pill rev">{l} <b>{fmtK(revenue![k]!)}</b></span>)}</>]);
  if (icp) rows.push(['Traveler ICP', <span>{icp}</span>]);
  if (setting.length) rows.push(['Setting', <>{setting.map((x) => <span class="tl-pill set">{x}</span>)}</>]);

  if (notes.length) rows.push(['Analyst notes', <ul class="tl-notes">{notes.map((n, i) => <li key={i}>{clip(n, 160)}</li>)}</ul>]);

  return (
    <section class="tldr" id="sec-tldr" aria-label="TL;DR">
      <div class="tl-head">TL;DR</div>
      <dl>{rows.map(([k, v]) => <div class="tl-row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}
