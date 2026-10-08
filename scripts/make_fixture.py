"""Generate a synthetic dataset plus golden statsmodels/pandas results for tests/stats.test.ts."""
import json, numpy as np, pandas as pd, statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor

rng = np.random.default_rng(7)
n = 120
beds = rng.integers(1, 6, n)
zips = rng.choice(['97367', '97368', '97369'], n, p=[.6, .25, .15])
A = {
    'hot_tub': rng.random(n) < .5, 'pool': rng.random(n) < .2, 'fire_pit': rng.random(n) < .4,
    'game_room': rng.random(n) < .3, 'gym': rng.random(n) < .15,
}
A['pool_heater'] = A['pool'] & (rng.random(n) < .85)          # strongly collinear with pool
logrev = 10 + .18*beds + .25*A['hot_tub'] + .3*A['pool'] + .08*A['fire_pit'] + rng.normal(0, .25, n)
rev = np.expm1(logrev).round(0)
df = pd.DataFrame({'beds': beds, 'zip': zips, 'rev': rev, **{k: v.astype(int) for k, v in A.items()}})

keys = list(A)
cols = df[keys].astype(float)
Xc = sm.add_constant(cols)
vifs = [variance_inflation_factor(Xc.values, i + 1) for i in range(len(keys))]

X = pd.concat([df[keys], df[['beds']], pd.get_dummies(df['zip'], drop_first=True).astype(int)], axis=1)
fit = sm.OLS(np.log1p(df['rev']), sm.add_constant(X.astype(float))).fit()

thr = float(df['rev'].median())
above = df['rev'] >= thr
tiers = np.zeros(n, dtype=int)
q = pd.qcut(df.loc[above, 'rev'].rank(method='first'), q=4, labels=[1, 2, 3, 4]).astype(int)
tiers[above.values] = q.values

json.dump({
    'listings': df.to_dict(orient='records'), 'keys': keys, 'vif': vifs,
    'coef': fit.params.to_dict(), 'pvalues': fit.pvalues.to_dict(), 'r2': fit.rsquared, 'adjr2': fit.rsquared_adj,
    'threshold': thr, 'tiers': tiers.tolist(),
    'quantiles': {str(p): float(np.quantile(df['rev'], p)) for p in (.1, .25, .5, .75, .9)},
}, open('tests/fixtures/golden.json', 'w'))
print('ok', fit.rsquared)
