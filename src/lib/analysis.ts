import type { BuyBox, Dataset, LatLng, Listing, Range } from './types';
import { boxStats, corrMatrix, mean, median, ols, quantile, sortedCopy, tCritical, vif } from './stats';

// ------------------------------------------------------------------ filtering

export function inRange(v: number, r: Range): boolean {
  switch (r.op) {
    case 'eq': return v === r.a;
    case 'gte': return v >= r.a;
    case 'lte': return v <= r.a;
    case 'range': return v >= Math.min(r.a, r.b) && v <= Math.max(r.a, r.b);
  }
}

export function rangeLabel(r: Range, unit = ''): string {
  const u = unit ? ` ${unit}` : '';
  switch (r.op) {
    case 'eq': return `${r.a}${u}`;
    case 'gte': return `${r.a}+${u}`;
    case 'lte': return `up to ${r.a}${u}`;
    case 'range': return `${Math.min(r.a, r.b)}–${Math.max(r.a, r.b)}${u}`;
  }
}

/** Ray casting; polygon vertices are [lat, lng]. */
export function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inRegions(l: Listing, regions: LatLng[][]): boolean {
  if (!regions.length) return true;
  if (l.lat == null || l.lng == null) return false;
  return regions.some((p) => p.length >= 3 && pointInPolygon(l.lat!, l.lng!, p));
}

export function boxListings(data: Dataset, box: BuyBox): Listing[] {
  return data.listings.filter(
    (l) =>
      inRegions(l, box.regions) &&
      (!box.filterBy.beds || inRange(l.beds, box.beds)) &&
      (!box.filterBy.baths || inRange(l.baths, box.baths)) &&
      (!box.filterBy.sleeps || inRange(l.sleeps, box.sleeps)),
  );
}

// ------------------------------------------------------------------ revenue tiers

export const TIER_COLORS = ['#B0B7C3', '#1B998B', '#F4D35E', '#F46A25', '#D7263D'];

export interface Tiering {
  tier: number[];                       // per listing (same order as input): 0 = below, 1..4 = quartiles above
  ranges: ({ min: number; max: number; n: number } | null)[];
}

/**
 * Same logic as the analysts' notebook: one bucket below the threshold, then
 * pd.qcut(rank(method='first'), 4) for everything at or above it.
 */
export function computeTiers(listings: Listing[], threshold: number): Tiering {
  const tier = new Array(listings.length).fill(0);
  const aboveIdx: number[] = [];
  listings.forEach((l, i) => { if (l.rev >= threshold) aboveIdx.push(i); });
  const order = aboveIdx.slice().sort((a, b) => listings[a].rev - listings[b].rev || a - b);
  const ranks = order.map((_, r) => r + 1);
  if (ranks.length) {
    const edges = [0, 0.25, 0.5, 0.75, 1].map((q) => quantile(ranks, q));
    order.forEach((idx, r) => {
      const rank = r + 1;
      let t = 1;
      while (t < 4 && rank > edges[t]) t++;
      tier[idx] = t;
    });
  }
  const ranges: Tiering['ranges'] = [0, 1, 2, 3, 4].map((t) => {
    const vals = listings.filter((_, i) => tier[i] === t).map((l) => l.rev);
    return vals.length ? { min: Math.min(...vals), max: Math.max(...vals), n: vals.length } : null;
  });
  return { tier, ranges };
}

// ------------------------------------------------------------------ distributions

export function countBy(listings: Listing[], pick: (l: Listing) => number): Map<number, number> {
  const m = new Map<number, number>();
  for (const l of listings) m.set(pick(l), (m.get(pick(l)) ?? 0) + 1);
  return m;
}

export function groupRevenue(listings: Listing[], pick: (l: Listing) => number) {
  const groups = new Map<number, number[]>();
  for (const l of listings) {
    const k = pick(l);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l.rev);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, vals]) => ({ key: k, n: vals.length, stats: boxStats(vals)! }));
}

export function histogram(values: number[], binCount = 24) {
  if (!values.length) return { edges: [] as number[], counts: [] as number[] };
  const lo = Math.min(...values), hi = Math.max(...values);
  const step = (hi - lo || 1) / binCount;
  const counts = new Array(binCount).fill(0);
  for (const v of values) counts[Math.min(binCount - 1, Math.floor((v - lo) / step))]++;
  const edges = Array.from({ length: binCount + 1 }, (_, i) => lo + i * step);
  return { edges, counts };
}

export function summarise(listings: Listing[]) {
  const revs = listings.map((l) => l.rev);
  const s = sortedCopy(revs);
  const adr = listings.map((l) => l.adr).filter((v): v is number => v != null);
  const occ = listings.map((l) => l.occ).filter((v): v is number => v != null);
  return {
    n: listings.length,
    medianRev: median(revs),
    p25: quantile(s, 0.25),
    p75: quantile(s, 0.75),
    p90: quantile(s, 0.9),
    meanRev: mean(revs),
    medianAdr: adr.length ? median(adr) : NaN,
    medianOcc: occ.length ? median(occ) : NaN,
    medianSleeps: listings.length ? median(listings.map((l) => l.sleeps)) : NaN,
  };
}

// ------------------------------------------------------------------ amenities

/** Revenue floor for the must-have penetration pool: the market threshold, or 0 for all listings. */
export function mustPoolThreshold(box: BuyBox, marketThreshold: number): number {
  return box.must.scope === 'all' ? 0 : marketThreshold;
}

export interface PenetrationRow { key: string; label: string; idx: number; n: number; total: number; pct: number }

/** Share of listings with revenue ≥ threshold that offer each amenity. */
export function penetration(listings: Listing[], data: Dataset, revThreshold: number): PenetrationRow[] {
  const pool = listings.filter((l) => l.rev >= revThreshold);
  return data.amenities
    .map((a, idx) => {
      const n = pool.reduce((s, l) => s + l.am[idx], 0);
      return { key: a.key, label: a.label, idx, n, total: pool.length, pct: pool.length ? (n / pool.length) * 100 : 0 };
    })
    .sort((x, y) => y.pct - x.pct);
}

export interface PrevalenceRow { key: string; label: string; top: number; bottom: number; diff: number }

/** Amenity prevalence in the top X% vs bottom X% of listings by revenue. */
export function prevalence(
  listings: Listing[], data: Dataset, pct: number, exclude: Set<string>,
): { rows: PrevalenceRow[]; nGroup: number } {
  const sorted = listings.slice().sort((a, b) => b.rev - a.rev);
  const k = Math.max(1, Math.round((sorted.length * pct) / 100));
  const top = sorted.slice(0, k);
  const bottom = sorted.slice(-k);
  const rows = data.amenities
    .map((a, idx) => ({ a, idx }))
    .filter(({ a }) => !exclude.has(a.key))
    .map(({ a, idx }) => {
      const t = (top.reduce((s, l) => s + l.am[idx], 0) / (top.length || 1)) * 100;
      const b = (bottom.reduce((s, l) => s + l.am[idx], 0) / (bottom.length || 1)) * 100;
      return { key: a.key, label: a.label, top: t, bottom: b, diff: t - b };
    })
    .sort((x, y) => y.diff - x.diff);
  return { rows, nGroup: k };
}

// ------------------------------------------------------------------ nice-to-have model

export type NiceStatus = 'ranked' | 'low-sample' | 'collinear' | 'df';

export interface NiceRow {
  key: string; label: string;
  nWith: number; nWithout: number;
  status: NiceStatus;
  effect?: number;            // % revenue effect
  lo?: number; hi?: number;   // 95% CI on the % effect
  coef?: number; p?: number;
  significant?: boolean;
  vif?: number;               // initial VIF among eligible amenities
  dropReason?: string;
}

export interface NiceResult {
  rows: NiceRow[];
  vifBefore: { key: string; label: string; vif: number; dropped: boolean }[];
  vifSteps: { key: string; label: string; vif: number }[];
  corr: { labels: string[]; matrix: number[][] };
  model: { n: number; r2: number; adjR2: number; k: number; controls: string[] } | null;
  notes: string[];
}

export interface NiceOptions {
  exclude: Set<string>;     // must-haves
  minCount: number;
  vifLimit: number;
}

const VIF_CAP = 99;

export function niceAnalysis(listings: Listing[], data: Dataset, opt: NiceOptions): NiceResult {
  const n = listings.length;
  const notes: string[] = [];
  const empty: NiceResult = { rows: [], vifBefore: [], vifSteps: [], corr: { labels: [], matrix: [] }, model: null, notes };
  const cand = data.amenities
    .map((a, idx) => ({ ...a, idx }))
    .filter((a) => !opt.exclude.has(a.key))
    .map((a) => {
      const nWith = listings.reduce((s, l) => s + l.am[a.idx], 0);
      return { ...a, nWith, nWithout: n - nWith };
    });

  const rows = new Map<string, NiceRow>();
  for (const c of cand) {
    const ok = c.nWith >= opt.minCount && c.nWithout >= opt.minCount;
    rows.set(c.key, { key: c.key, label: c.label, nWith: c.nWith, nWithout: c.nWithout, status: ok ? 'ranked' : 'low-sample' });
  }
  const finish = (): NiceResult => ({ ...empty, rows: [...rows.values()] });
  if (n < 8) { notes.push('Fewer than 8 listings in this buy box — not enough data for the model.'); return finish(); }

  let kept = cand.filter((c) => rows.get(c.key)!.status === 'ranked');
  const col = (c: { idx: number }) => listings.map((l) => l.am[c.idx]);

  // --- collinearity: iteratively drop the most-inflated amenity until all VIFs ≤ limit
  const initial = vif(kept.map(col));
  kept.forEach((c, i) => { rows.get(c.key)!.vif = Math.min(initial[i], VIF_CAP); });
  const steps: NiceResult['vifSteps'] = [];
  const dropped = new Set<string>();
  for (let guard = 0; guard < 100 && kept.length > 1; guard++) {
    const v = vif(kept.map(col));
    let worst = 0;
    v.forEach((x, i) => { if (x > v[worst] || (x === v[worst] && kept[i].nWith < kept[worst].nWith)) worst = i; });
    if (v[worst] <= opt.vifLimit) break;
    const c = kept[worst];
    steps.push({ key: c.key, label: c.label, vif: Math.min(v[worst], VIF_CAP) });
    dropped.add(c.key);
    const r = rows.get(c.key)!;
    r.status = 'collinear';
    r.dropReason = `VIF ${Math.min(v[worst], VIF_CAP).toFixed(1)} > ${opt.vifLimit}`;
    kept = kept.filter((_, i) => i !== worst);
  }

  // --- controls: bedrooms (if they vary) and zip codes (only levels with enough listings)
  const controlNames: string[] = [];
  const controlCols: number[][] = [];
  const bedVals = new Set(listings.map((l) => l.beds));
  if (bedVals.size > 1) { controlNames.push('Bedrooms'); controlCols.push(listings.map((l) => l.beds)); }
  const zipCount = new Map<string, number>();
  listings.forEach((l) => { const z = l.zip || ''; zipCount.set(z, (zipCount.get(z) ?? 0) + 1); });
  const zipOf = (l: Listing) => ((zipCount.get(l.zip || '') ?? 0) >= 5 && l.zip ? l.zip : 'Other');
  const levels = new Map<string, number>();
  listings.forEach((l) => levels.set(zipOf(l), (levels.get(zipOf(l)) ?? 0) + 1));
  if (levels.size > 1) {
    const ref = [...levels.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const lv of levels.keys()) {
      if (lv === ref) continue;
      controlNames.push(`ZIP ${lv}`);
      controlCols.push(listings.map((l) => (zipOf(l) === lv ? 1 : 0)));
    }
    notes.push(`ZIP-code controls included (${levels.size - 1} dummies, reference ${ref}).`);
  } else {
    notes.push('ZIP-code control skipped — all listings share one ZIP (or no ZIP varies enough).');
  }

  // --- degrees of freedom guard
  while (kept.length && n - (kept.length + controlNames.length + 1) < 5) {
    let worst = 0;
    kept.forEach((c, i) => { if (Math.min(c.nWith, c.nWithout) < Math.min(kept[worst].nWith, kept[worst].nWithout)) worst = i; });
    const c = kept[worst];
    const r = rows.get(c.key)!;
    r.status = 'df'; r.dropReason = 'Too few listings for this many variables';
    kept = kept.filter((_, i) => i !== worst);
  }
  if ([...rows.values()].some((r) => r.status === 'df')) notes.push('Some amenities were dropped because the buy box has too few listings for the model.');

  // --- correlation among the amenities that entered the model (for the heatmap)
  const corr = { labels: kept.map((c) => c.label), matrix: kept.length ? corrMatrix(kept.map(col)) : [] };

  const vifBefore = cand
    .filter((c) => rows.get(c.key)!.vif != null)
    .map((c) => ({ key: c.key, label: c.label, vif: rows.get(c.key)!.vif!, dropped: dropped.has(c.key) }))
    .sort((a, b) => b.vif - a.vif);

  if (!kept.length) { notes.push('No amenities have enough listings with and without them in this buy box.'); return { ...empty, rows: [...rows.values()], vifBefore, vifSteps: steps, corr, notes }; }

  const names = [...kept.map((c) => c.label), ...controlNames];
  const X = listings.map((_, r) => [...kept.map((c) => listings[r].am[c.idx]), ...controlCols.map((cc) => cc[r])]);
  const y = listings.map((l) => Math.log1p(l.rev));
  const fit = ols(X, y, names);
  if (!fit) { notes.push('The regression could not be solved (singular design).'); return { ...empty, rows: [...rows.values()], vifBefore, vifSteps: steps, corr, notes }; }
  const tc = tCritical(fit.df);
  kept.forEach((c, i) => {
    const j = i + 1;
    const r = rows.get(c.key)!;
    r.coef = fit.coef[j];
    r.p = fit.p[j];
    r.effect = (Math.exp(fit.coef[j]) - 1) * 100;
    r.lo = (Math.exp(fit.coef[j] - tc * fit.se[j]) - 1) * 100;
    r.hi = (Math.exp(fit.coef[j] + tc * fit.se[j]) - 1) * 100;
    r.significant = fit.p[j] < 0.05;
  });
  return {
    rows: [...rows.values()], vifBefore, vifSteps: steps, corr, notes,
    model: { n: fit.n, r2: fit.r2, adjR2: fit.adjR2, k: fit.k, controls: controlNames },
  };
}

/** Modelled amenities, highest revenue uplift first. */
export function rankNice(res: NiceResult): NiceRow[] {
  return res.rows.filter((r) => r.status === 'ranked' && r.effect != null).sort((a, b) => b.effect! - a.effect!);
}

/**
 * Fill in must/nice selections the analyst has not touched yet:
 * must-haves = penetration ≥ cutoff among listings above the revenue threshold;
 * nice-to-haves = top 5 significant positive-uplift amenities. Returns true if anything changed.
 */
export function resolveSelections(box: BuyBox, data: Dataset, marketThreshold: number): boolean {
  const ls = boxListings(data, box);
  let changed = false;
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!box.must.touched) {
    const pr = penetration(ls, data, mustPoolThreshold(box, marketThreshold));
    const sel = pr.filter((r) => r.n > 0 && r.pct >= box.must.penetration).map((r) => r.key);
    if (!same(sel, box.must.selected)) { box.must.selected = sel; changed = true; }
  }
  if (!box.nice.touched) {
    const res = niceAnalysis(ls, data, { exclude: new Set(box.must.selected), minCount: box.nice.minCount, vifLimit: box.nice.vifLimit });
    const sel = rankNice(res).filter((r) => r.significant && r.effect! > 0).slice(0, 5).map((r) => r.key);
    if (!same(sel, box.nice.selected)) { box.nice.selected = sel; changed = true; }
  }
  return changed;
}

export interface TravelerMix { rows: { key: string; label: string; pct: number }[]; n: number; reviews: number }

/** Review-count-weighted average of each traveler-type share across the listings. */
export function travelerMix(listings: Listing[], data: Dataset): TravelerMix | null {
  const cats = data.traveler;
  if (!cats?.length) return null;
  const pool = listings.filter((l) => l.tp);
  if (!pool.length) return null;
  const w = (l: Listing) => (l.rw != null && l.rw > 0 ? l.rw : 1);
  const total = pool.reduce((s, l) => s + w(l), 0);
  const rows = cats.map((c, i) => ({ key: c.key, label: c.label, pct: pool.reduce((s, l) => s + l.tp![i] * w(l), 0) / total }));
  return { rows, n: pool.length, reviews: pool.reduce((s, l) => s + (l.rw ?? 0), 0) };
}
