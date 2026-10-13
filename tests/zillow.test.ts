import { describe, expect, it } from 'vitest';
import { addressFromZillowUrl as z } from '../src/lib/zillow';

describe('address from a Zillow link', () => {
  it('reads standard listing links', () => {
    expect(z('https://www.zillow.com/homedetails/123-Ocean-Dr-Lincoln-City-OR-97367/12345678_zpid/')).toBe('123 Ocean Dr, Lincoln City, OR 97367');
    expect(z('https://zillow.com/homedetails/1600-Pennsylvania-Ave-NW-Washington-DC-20500/84074482_zpid')).toBe('1600 Pennsylvania Ave NW, Washington, DC 20500');
    expect(z('https://www.zillow.com/homedetails/45-Elm-St-Apt-4B-Portland-OR-97201/2085_zpid/?utm=x')).toBe('45 Elm St Apt 4B, Portland, OR 97201');
    expect(z('https://www.zillow.com/homedetails/88-Circle-Dr-Seaside-OR-97138/9_zpid/')).toBe('88 Circle Dr, Seaside, OR 97138');
    expect(z('https://www.zillow.com/homedetails/7-SW-Ridge-Rd-Depoe-Bay-OR-97341-1234/9_zpid/')).toBe('7 SW Ridge Rd, Depoe Bay, OR 97341-1234');
  });
  it('reads address-search links', () => {
    expect(z('https://www.zillow.com/homes/123-Ocean-Dr,-Lincoln-City,-OR-97367_rb/')).toBe('123 Ocean Dr, Lincoln City, OR 97367');
  });
  it('returns null for anything that is not an address link', () => {
    expect(z('https://www.zillow.com/b/the-willows-seattle-wa/ABC123/')).toBeNull();
    expect(z('https://www.zillow.com/lincoln-city-or/')).toBeNull();
    expect(z('https://www.airbnb.com/rooms/1313183184468803597')).toBeNull();
    expect(z('https://docs.google.com/spreadsheets/d/XYZ')).toBeNull();
    expect(z('not a link')).toBeNull();
    expect(z('')).toBeNull();
    expect(z('https://notzillow.com/homedetails/123-Ocean-Dr-Lincoln-City-OR-97367/1_zpid/')).toBeNull();
  });
});
