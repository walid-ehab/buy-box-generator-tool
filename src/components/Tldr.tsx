import type { BuyBox } from '../lib/types';
import { rangeLabel } from '../lib/analysis';
import { effectiveSetting } from './SettingEditor';
import { fmtK } from './ui';

const clip = (s: string, n = 170) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Compact summary of the buy box. Every connected section always has a row ("Not specified" when empty); Setting always lists all three of view / waterfront / privacy. */
export function Tldr({ box, must, nice, notes, revenue, travelers }: { box: BuyBox; revenue?: BuyBox['proj']; travelers?: { label: string; pct: number }[]; must: string[]; nice: { label: string; effect?: number }[]; notes: string[] }) {
  const st = box.setting;
  const eff = effectiveSetting(st);
  const setting: string[] = [];
  if (eff.view === 'yes') {
    const parts = [st?.mountain && `Mountain (${st.mountain})`, st?.lake && `Lake (${st.lake})`].filter(Boolean) as string[];
    setting.push(`View · ${parts.length ? parts.join(' + ') : 'Yes'}`);
  } else setting.push(`View · ${eff.view === 'no' ? 'No' : 'Not applicable'}`);
  setting.push(`Waterfront · ${eff.waterfront ? 'Yes' : 'No'}`);
  setting.push(`Privacy · ${eff.privacy === 'na' ? 'Not applicable' : cap(eff.privacy)}`);
  const icp = clip(box.text.icp ?? '');

  const rows: [string, preact.ComponentChildren][] = [
    ['Size', <b>{rangeLabel(box.beds, 'BR')} · {rangeLabel(box.baths, 'BA')} · Sleeps {rangeLabel(box.sleeps)}</b>],
  ];
  const none = <span class="tl-empty">Not specified</span>;
  rows.push(['Must-haves', must.length ? <>{must.map((m) => <span class="tl-pill">{m}</span>)}</> : none]);
  rows.push(['Nice-to-haves', nice.length ? <>{nice.map((n) => <span class="tl-pill alt">{n.label}{n.effect != null && <em> {n.effect >= 0 ? '+' : ''}{n.effect.toFixed(0)}%</em>}</span>)}</> : none]);
  const tiers = ([['low', 'Low'], ['mid', 'Mid'], ['high', 'High']] as const).filter(([k]) => revenue?.[k] != null);
  rows.push(['Setting', <>{setting.map((x) => <span class="tl-pill set">{x}</span>)}</>]);
  // the analyst's own ICP note replaces the default (the pie-chart groups, highest to lowest)
  const groups = (travelers ?? []).slice().sort((a, b) => b.pct - a.pct);
  rows.push(['Traveler ICP', icp ? <span>{icp}</span>
    : groups.length ? <>{groups.map((g) => <span class="tl-pill trav">{g.label} <b>{g.pct.toFixed(0)}%</b></span>)}</> : none]);
  rows.push(['Revenue potential', tiers.length ? <>{tiers.map(([k, l]) => <span class="tl-pill rev">{l} <b>{fmtK(revenue![k]!)}</b></span>)}</> : none]);
  rows.push(['Analyst notes', notes.length ? <ul class="tl-notes">{notes.map((n, i) => <li key={i}>{clip(n, 160)}</li>)}</ul> : none]);

  return (
    <section class="tldr" id="sec-tldr" aria-label="TL;DR">
      <div class="tl-head">TL;DR</div>
      <dl>{rows.map(([k, v]) => <div class="tl-row" key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </section>
  );
}
