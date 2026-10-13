// Zillow listing links carry the address in the path, e.g.
//   https://www.zillow.com/homedetails/123-Ocean-Dr-Lincoln-City-OR-97367/12345678_zpid/
// so the property name can be read from the link itself (no network request involved).

const SUFFIX = new Set(['st', 'street', 'ave', 'avenue', 'av', 'rd', 'road', 'dr', 'drive', 'ln', 'lane', 'blvd', 'boulevard', 'ct', 'court', 'cir', 'circle',
  'pl', 'place', 'way', 'ter', 'terrace', 'pkwy', 'parkway', 'hwy', 'highway', 'trl', 'trail', 'loop', 'sq', 'square', 'cv', 'cove', 'pt', 'point', 'run',
  'row', 'aly', 'alley', 'xing', 'crossing', 'path', 'walk', 'pike', 'bnd', 'bend', 'rdg', 'ridge']);
const DIRECTION = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']);
const UNIT = new Set(['apt', 'unit', 'ste', 'suite', 'trlr', 'lot', 'bldg', 'fl']);

/** "123-Ocean-Dr-Lincoln-City-OR-97367" → "123 Ocean Dr, Lincoln City, OR 97367" (null if it does not look like an address). */
export function addressFromSlug(rawSlug: string): string | null {
  let slug = rawSlug;
  try { slug = decodeURIComponent(slug); } catch { /* keep as is */ }
  slug = slug.replace(/_rb$/i, '').replace(/,/g, '').replace(/\s+/g, '-');
  const m = slug.match(/^(.+)-([A-Za-z]{2})-(\d{5})(?:-(\d{4}))?$/);
  if (!m) return null;
  const tokens = m[1].split('-').filter(Boolean);
  if (tokens.length < 2 || !/^\d/.test(tokens[0])) return null;       // street address starts with a number
  const tail = `${m[2].toUpperCase()} ${m[3]}${m[4] ? '-' + m[4] : ''}`;
  const low = (i: number) => (tokens[i] ?? '').toLowerCase();
  // street ends at the first street-type word that is not followed by another one ("Circle Dr")
  let end = -1;
  for (let i = 1; i < tokens.length; i++) {
    if (SUFFIX.has(low(i)) && !SUFFIX.has(low(i + 1))) { end = i; break; }
  }
  if (end < 0) return `${tokens.join(' ')}, ${tail}`;
  if (DIRECTION.has(low(end + 1)) && end + 1 < tokens.length - 1) end += 1;
  if (UNIT.has(low(end + 1)) && end + 2 < tokens.length) end += 2;
  else if (/^#/.test(tokens[end + 1] ?? '') && end + 1 < tokens.length - 1) end += 1;
  const street = tokens.slice(0, end + 1).join(' ');
  const city = tokens.slice(end + 1).join(' ');
  return city ? `${street}, ${city}, ${tail}` : `${street}, ${tail}`;
}

export function addressFromZillowUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  if (!/(^|\.)zillow\.com$/i.test(u.hostname)) return null;
  const parts = u.pathname.split('/').filter(Boolean);
  const i = parts.findIndex((p) => p === 'homedetails' || p === 'homes');
  if (i < 0 || !parts[i + 1]) return null;
  return addressFromSlug(parts[i + 1]);
}
