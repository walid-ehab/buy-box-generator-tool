import type { Dataset, Listing } from './types';

/** Seeded synthetic market so the tool can be tried without a file. */
export function sampleDataset(): Dataset {
  let seed = 42;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const norm = () => { let s = 0; for (let i = 0; i < 6; i++) s += rnd(); return (s - 3) / 1.2; };
  const amenities = ['Hot Tub', 'Pool', 'Game Room', 'Fire Pit', 'Gym', 'Pool Heater', 'Sauna', 'Movie Theater', 'Waterfront', 'Outdoor Dining Area', 'Pool Table', 'Playground']
    .map((label) => ({ key: label.toLowerCase().replace(/[^a-z0-9]/g, ''), label }));
  const listings: Listing[] = [];
  for (let i = 0; i < 260; i++) {
    const beds = Math.max(1, Math.min(8, Math.round(3 + norm() * 1.6)));
    const am = amenities.map((a, j) => {
      const base = [0.45, 0.2, 0.3, 0.35, 0.1, 0, 0.08, 0.06, 0.2, 0.3, 0.2, 0.1][j] + beds * 0.02;
      return rnd() < base ? 1 : 0;
    });
    if (am[1] && rnd() < 0.8) am[5] = 1;
    const lift = 0.22 * am[0] + 0.3 * am[1] + 0.12 * am[2] + 0.05 * am[3] + 0.1 * am[7] + 0.2 * am[8] + 0.06 * am[9];
    const rev = Math.round(Math.exp(10.0 + 0.2 * beds + lift + norm() * 0.28) / 100) * 100;
    const cluster = rnd() < 0.55 ? [44.95, -124.015, 0.012] : rnd() < 0.5 ? [44.97, -124.02, 0.02] : [44.91, -124.0, 0.025];
    const sleeps = Math.min(20, beds * 2 + Math.round(rnd() * 3));
    listings.push({
      id: `S${1000 + i}`, title: `${['Coastal', 'Seaside', 'Dune', 'Tidewater', 'Driftwood', 'Harbor'][i % 6]} ${['Retreat', 'Hideaway', 'Lodge', 'Cottage', 'Haven'][i % 5]} #${i + 1}`,
      url: '', beds, sleeps, baths: Math.max(1, Math.round((beds * 0.8 + rnd()) * 2) / 2), rev,
      adr: Math.round(rev / 365 / (0.45 + rnd() * 0.3)), occ: +(0.45 + rnd() * 0.3).toFixed(2),
      lat: cluster[0] + norm() * cluster[2], lng: cluster[1] + norm() * cluster[2] * 0.8,
      zip: rnd() < 0.7 ? '97367' : '97369', am,
    });
  }
  return { source: 'Sample data (synthetic)', amenities, listings };
}
