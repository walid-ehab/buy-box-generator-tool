import * as XLSX from 'xlsx';
import type { Dataset, Listing, Spec } from './types';
import { boxListings } from './analysis';

/** Only the columns the page already holds — no derived analysis columns. */
export function headers(data: Dataset): string[] {
  return [
    'Property ID', 'Listing title', 'Listing URL', 'Bedrooms', 'Baths', 'Sleeps',
    'Revenue Potential', 'ADR', 'Occupancy', 'Latitude', 'Longitude', 'ZIP code',
    ...data.amenities.map((a) => a.label),
    ...(data.traveler ?? []).map((t) => `${t.label} (% of reviews)`),
    ...(data.listings.some((l) => l.rw != null) ? ['Reviews'] : []),
  ];
}

export function row(l: Listing, data: Dataset): (string | number | null)[] {
  return [
    l.id, l.title, l.url, l.beds, l.baths, l.sleeps, l.rev, l.adr, l.occ, l.lat, l.lng, l.zip,
    ...l.am,
    ...(data.traveler ?? []).map((_, i) => l.tp?.[i] ?? null),
    ...(data.listings.some((x) => x.rw != null) ? [l.rw ?? null] : []),
  ];
}

function sheet(listings: Listing[], data: Dataset): XLSX.WorkSheet {
  const h = headers(data);
  const ws = XLSX.utils.aoa_to_sheet([h, ...listings.map((l) => row(l, data))]);
  ws['!cols'] = h.map((name, i) => ({ wch: i === 1 ? 38 : i === 2 ? 30 : Math.max(10, Math.min(24, name.length + 2)) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as never;
  const fmt: Record<string, string> = { 'Revenue Potential': '$#,##0', ADR: '$#,##0', Occupancy: '0.0%' };
  h.forEach((name, c) => {
    const z = fmt[name];
    if (!z) return;
    for (let r = 1; r <= listings.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') cell.z = z;
    }
  });
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, listings.length), c: h.length - 1 } }) };
  return ws;
}

/** Excel sheet names: ≤31 chars, none of : \ / ? * [ ], unique (case-insensitive). */
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>(['market data']);
  return names.map((raw, i) => {
    const base = (raw.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim() || `Buy Box ${i + 1}`).slice(0, 31);
    let n = base, k = 2;
    while (used.has(n.toLowerCase())) { const suf = ` (${k++})`; n = base.slice(0, 31 - suf.length) + suf; }
    used.add(n.toLowerCase());
    return n;
  });
}

export function buildWorkbook(spec: Spec, data: Dataset): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(data.listings, data), 'Market data');
  const names = sheetNames(spec.boxes.map((b) => b.name));
  spec.boxes.forEach((b, i) => XLSX.utils.book_append_sheet(wb, sheet(boxListings(data, b), data), names[i]));
  return wb;
}

export function downloadWorkbook(spec: Spec, data: Dataset) {
  const wb = buildWorkbook(spec, data);
  const slug = (spec.market.name || 'market').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'market';
  XLSX.writeFile(wb, `${slug}-data.xlsx`);
}
