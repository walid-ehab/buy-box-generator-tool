import type { BuyBox, Dataset, Img, Range, Spec } from './types';
import { median } from './stats';
import { summarise } from './analysis';

export const uid = () => Math.random().toString(36).slice(2, 9);

export const eq = (a: number): Range => ({ op: 'eq', a, b: a });
export const gte = (a: number): Range => ({ op: 'gte', a, b: a });

export function newBox(n: number, data: Dataset, threshold: number): BuyBox {
  const top = data.listings.filter((l) => l.rev >= threshold);
  const pool = top.length >= 5 ? top : data.listings;
  const beds = Math.max(1, Math.round(median(pool.map((l) => l.beds))));
  const baths = Math.max(1, Math.floor(median(pool.map((l) => l.baths)) || 1));
  const sleeps = Math.max(2, Math.round(median(pool.map((l) => l.sleeps))));
  return {
    id: uid(),
    name: `Buy Box ${n}`,
    tagline: '',
    regions: [],
    beds: gte(beds), baths: gte(baths), sleeps: gte(sleeps),
    filterBy: { beds: true, baths: false, sleeps: false },
    must: { scope: 'threshold', penetration: 50, selected: [], touched: false, notes: {}, images: {} },
    nice: { topPct: 10, minCount: 8, vifLimit: 5, selected: [], touched: false, notes: {}, images: {} },
    setting: { view: 'na', waterfront: false, privacy: 'na' },
    text: {},
    images: {},
    uw: [],
  };
}

/** Default revenue threshold for a new market; change it on the overview. */
export const DEFAULT_THRESHOLD = 80000;

export function newSpec(data: Dataset, guess: { name: string; region: string }): Spec {
  const threshold = DEFAULT_THRESHOLD;
  return {
    version: 1,
    threshold,
    market: {
      name: guess.name, region: guess.region, tagline: '', heroImage: null,
      about: '', visitors: '', whyStr: '', places: '', gallery: [],
    },
    boxes: [newBox(1, data, threshold)],
  };
}

export function guessMarket(filename: string): { name: string; region: string } {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ');
  const m = base.match(/^(.*?)\s*[-,–]\s*([A-Za-z]{2})\b/);
  if (m) return { name: m[1].trim(), region: m[2].toUpperCase() };
  return { name: base.trim(), region: '' };
}

export const imgKey = (img: Img) => img.src.length;
