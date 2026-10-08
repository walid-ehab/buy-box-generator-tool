import { describe, expect, it } from 'vitest';
import golden from './fixtures/golden.json';
import { ols, quantile, sortedCopy, vif } from '../src/lib/stats';
import { computeTiers } from '../src/lib/analysis';
import type { Listing } from '../src/lib/types';

const g: any = golden;
const keys: string[] = g.keys;

describe('stats vs statsmodels/pandas', () => {
  it('VIF matches statsmodels', () => {
    const v = vif(keys.map((k) => g.listings.map((l: any) => l[k] as number)));
    v.forEach((x, i) => expect(x).toBeCloseTo(g.vif[i], 6));
  });

  it('OLS coefficients, p-values and R² match statsmodels', () => {
    const zips = ['97368', '97369'];
    const X = g.listings.map((l: any) => [...keys.map((k) => l[k]), l.beds, ...zips.map((z) => (l.zip === z ? 1 : 0))]);
    const y = g.listings.map((l: any) => Math.log1p(l.rev));
    const names = [...keys, 'beds', '97368', '97369'];
    const fit = ols(X, y, names)!;
    names.forEach((nm, i) => {
      expect(fit.coef[i + 1]).toBeCloseTo(g.coef[nm], 6);
      expect(fit.p[i + 1]).toBeCloseTo(g.pvalues[nm], 6);
    });
    expect(fit.coef[0]).toBeCloseTo(g.coef['const'], 6);
    expect(fit.r2).toBeCloseTo(g.r2, 8);
    expect(fit.adjR2).toBeCloseTo(g.adjr2, 8);
  });

  it('quantiles match numpy', () => {
    const s = sortedCopy(g.listings.map((l: any) => l.rev));
    for (const [p, v] of Object.entries(g.quantiles)) expect(quantile(s, Number(p))).toBeCloseTo(v as number, 6);
  });

  it('revenue tiers match pandas qcut(rank(first))', () => {
    const ls: Listing[] = g.listings.map((l: any, i: number) => ({
      id: String(i), title: '', url: '', beds: l.beds, sleeps: 0, baths: 0, rev: l.rev, adr: null, occ: null, lat: 0, lng: 0, zip: l.zip, am: [],
    }));
    expect(computeTiers(ls, g.threshold).tier).toEqual(g.tiers);
  });
});
