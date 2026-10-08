import * as XLSX from 'xlsx';
import type { Dataset, Listing } from './types';

export type FieldKey = 'rev' | 'beds' | 'sleeps' | 'baths' | 'lat' | 'lng' | 'id' | 'title' | 'url' | 'adr' | 'occ' | 'zip';
export type Mapping = Partial<Record<FieldKey, string>>;

export const FIELD_LABELS: Record<FieldKey, string> = {
  rev: 'Revenue potential', beds: 'Bedrooms', sleeps: 'Sleeps', baths: 'Baths', lat: 'Latitude', lng: 'Longitude',
  id: 'Property ID', title: 'Listing title', url: 'Listing URL', adr: 'ADR', occ: 'Occupancy', zip: 'ZIP code',
};
export const REQUIRED: FieldKey[] = ['rev', 'beds', 'sleeps', 'lat', 'lng'];

const ALIASES: Record<FieldKey, string[]> = {
  rev: ['revenuepotential', 'revenue', 'annualrevenue', 'potentialrevenue'],
  beds: ['bedrooms', 'beds', 'bedroomcount'],
  sleeps: ['sleeps', 'accommodates', 'personcapacity', 'maxguests', 'numberofguests'],
  baths: ['baths', 'bathrooms'],
  lat: ['lat', 'latitude'],
  lng: ['long', 'lng', 'lon', 'longitude'],
  id: ['propertyid', 'id', 'listingid'],
  title: ['listingtitle', 'title', 'listingname', 'name'],
  url: ['listingurl', 'airbnblistingurl', 'url', 'airbnburl'],
  adr: ['adr', 'averagedailyrate'],
  occ: ['occupancy', 'occupancyrate'],
  zip: ['zipcode', 'zip', 'postalcode'],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export interface SheetInfo {
  name: string;
  headers: string[];
  rows: Record<string, unknown>[];
  mapping: Mapping;
  missing: FieldKey[];
  amenityCols: string[];
}

export function detectMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const byNorm = new Map<string, string>();
  headers.forEach((h) => { if (!byNorm.has(norm(h))) byNorm.set(norm(h), h); });
  (Object.keys(ALIASES) as FieldKey[]).forEach((f) => {
    for (const a of ALIASES[f]) if (byNorm.has(a)) { m[f] = byNorm.get(a); break; }
  });
  return m;
}

export function amenityColumns(headers: string[]): string[] {
  return headers.filter((h) => /^has[_ ]/i.test(h.trim()));
}

const REVIEW_COUNT_ALIASES = ['reviews', 'allreviews', 'totalreviews', 'reviewscount', 'propertyreviews', 'numberofreviews'];

export function travelerColumns(headers: string[]): string[] {
  return headers.filter((h) => /^pct[_ ]/i.test(h.trim()));
}

export function prettyTraveler(col: string): { key: string; label: string } {
  const raw = col.replace(/^pct[_ ]/i, '');
  const t = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return { key: norm(raw), label: t.charAt(0).toUpperCase() + t.slice(1) };
}

export function readWorkbook(buf: ArrayBuffer): SheetInfo[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const out: SheetInfo[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    if (!rows.length) continue;
    const headers = Object.keys(rows[0]);
    const mapping = detectMapping(headers);
    out.push({
      name, headers, rows, mapping,
      missing: REQUIRED.filter((f) => !mapping[f]),
      amenityCols: amenityColumns(headers),
    });
  }
  return out;
}

/** Pick the most plausible sheet: fewest missing required columns, then most amenities, 'Cleaned_Data' wins ties. */
export function bestSheet(sheets: SheetInfo[]): SheetInfo | undefined {
  return sheets.slice().sort((a, b) =>
    a.missing.length - b.missing.length ||
    Number(/clean/i.test(b.name)) - Number(/clean/i.test(a.name)) ||
    b.amenityCols.length - a.amenityCols.length ||
    b.rows.length - a.rows.length)[0];
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const truthy = (v: unknown): number => {
  if (typeof v === 'number') return v > 0 ? 1 : 0;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') return /^(1|true|yes|y|t)$/i.test(v.trim()) ? 1 : 0;
  return 0;
};

export function prettyAmenity(col: string): { key: string; label: string } {
  const raw = col.replace(/^has[_ ]/i, '');
  const label = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
  return { key: norm(raw), label };
}

export function buildDataset(sheet: SheetInfo, mapping: Mapping, source: string): Dataset {
  const cols = sheet.amenityCols.map((c) => ({ col: c, ...prettyAmenity(c) }));
  // de-duplicate by key (e.g. HAS_pool in two columns) — first wins
  const seen = new Set<string>();
  const amCols = cols.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)));
  const tCols = travelerColumns(sheet.headers).map((c) => ({ col: c, ...prettyTraveler(c) }));
  const rwCol = sheet.headers.find((h) => REVIEW_COUNT_ALIASES.includes(norm(h)) && sheet.rows.some((r) => num(r[h]) != null));
  const listings: Listing[] = [];
  const g = (r: Record<string, unknown>, f: FieldKey) => (mapping[f] ? r[mapping[f]!] : null);
  let occMax = 0;
  sheet.rows.forEach((r, i) => {
    const rev = num(g(r, 'rev'));
    const beds = num(g(r, 'beds'));
    const sleeps = num(g(r, 'sleeps'));
    if (rev == null || beds == null || sleeps == null) return;
    const idv = g(r, 'id');
    if (mapping.id && (idv == null || idv === '')) return;      // blank spacer rows in analyst sheets
    const occ = num(g(r, 'occ'));
    if (occ != null) occMax = Math.max(occMax, occ);
    const zipRaw = g(r, 'zip');
    listings.push({
      id: String(idv ?? i + 1),
      title: String(g(r, 'title') ?? `Listing ${i + 1}`),
      url: String(g(r, 'url') ?? ''),
      beds, sleeps, baths: num(g(r, 'baths')) ?? 0, rev,
      adr: num(g(r, 'adr')), occ,
      lat: num(g(r, 'lat')), lng: num(g(r, 'lng')),
      zip: zipRaw == null || zipRaw === '' ? '' : String(Math.round(Number(zipRaw)) || zipRaw),
      am: amCols.map((c) => truthy(r[c.col])),
      ...(tCols.length && tCols.some((c) => num(r[c.col]) != null) ? { tp: tCols.map((c) => num(r[c.col]) ?? 0) } : {}),
      ...(rwCol && num(r[rwCol]) != null ? { rw: num(r[rwCol])! } : {}),
    });
  });
  if (occMax > 1.5) listings.forEach((l) => { if (l.occ != null) l.occ /= 100; });
  // drop amenities nobody has
  const keep = amCols.map((_, i) => listings.some((l) => l.am[i] === 1));
  const amenities = amCols.filter((_, i) => keep[i]).map(({ key, label }) => ({ key, label }));
  listings.forEach((l) => { l.am = l.am.filter((_, i) => keep[i]); });
  const hasMix = tCols.length > 0 && listings.some((l) => l.tp);
  return { source, amenities, ...(hasMix ? { traveler: tCols.map(({ key, label }) => ({ key, label })) } : {}), listings };
}

export async function loadFile(file: File): Promise<SheetInfo[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    const text = await file.text();
    const wb = XLSX.read(text, { type: 'string' });
    return readWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  }
  return readWorkbook(await file.arrayBuffer());
}
