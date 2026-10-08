// Small, dependency-free statistics toolkit: quantiles, OLS with p-values, VIF.

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function sortedCopy(a: number[]): number[] {
  return a.slice().sort((x, y) => x - y);
}

export function median(a: number[]): number {
  return quantile(sortedCopy(a), 0.5);
}

export function mean(a: number[]): number {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
}

export interface BoxStats {
  min: number; q1: number; median: number; q3: number; max: number;
  lowFence: number; highFence: number; outliers: number[]; n: number; mean: number;
}

/** Tukey box statistics (whiskers at 1.5 IQR), same convention as plotly/pandas. */
export function boxStats(values: number[]): BoxStats | null {
  if (!values.length) return null;
  const s = sortedCopy(values);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const lf = q1 - 1.5 * iqr;
  const hf = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= lf && v <= hf);
  return {
    min: inside[0], q1, median: quantile(s, 0.5), q3, max: inside[inside.length - 1],
    lowFence: lf, highFence: hf, outliers: s.filter((v) => v < lf || v > hf),
    n: s.length, mean: mean(s),
  };
}

// ---------------------------------------------------------------- linear algebra

/** Solve A x = b by Gauss-Jordan with partial pivoting; returns also A^-1 when asked. */
export function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const M = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row) => row.slice(n));
}

// ---------------------------------------------------------------- distributions

function lgamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155,
    0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-14, FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularised incomplete beta I_x(a, b). */
export function betainc(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2)
    ? (bt * betacf(a, b, x)) / a
    : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value of a t statistic. */
export function tPValue(t: number, df: number): number {
  if (!isFinite(t) || df <= 0) return NaN;
  return betainc(df / 2, 0.5, df / (df + t * t));
}

/** Inverse two-sided t critical value via bisection (used for 95% CIs). */
export function tCritical(df: number, alpha = 0.05): number {
  let lo = 0, hi = 200;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (tPValue(mid, df) > alpha) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------- OLS

export interface OLSResult {
  names: string[];            // includes 'Intercept' first
  coef: number[];
  se: number[];
  t: number[];
  p: number[];
  r2: number;
  adjR2: number;
  n: number;
  k: number;                  // number of parameters incl. intercept
  df: number;
}

/** Ordinary least squares; X must NOT contain the intercept column. */
export function ols(X: number[][], y: number[], names: string[]): OLSResult | null {
  const n = y.length;
  const k = names.length + 1;
  if (n <= k) return null;
  const Z = X.map((r) => [1, ...r]);
  const XtX: number[][] = Array.from({ length: k }, () => new Array(k).fill(0));
  const Xty = new Array(k).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < k; a++) {
      Xty[a] += Z[i][a] * y[i];
      for (let b = a; b < k; b++) XtX[a][b] += Z[i][a] * Z[i][b];
    }
  }
  for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) XtX[a][b] = XtX[b][a];
  const inv = invert(XtX);
  if (!inv) return null;
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));
  let sse = 0;
  const ym = mean(y);
  let sst = 0;
  for (let i = 0; i < n; i++) {
    const pred = Z[i].reduce((s, v, j) => s + v * beta[j], 0);
    sse += (y[i] - pred) ** 2;
    sst += (y[i] - ym) ** 2;
  }
  const df = n - k;
  const sigma2 = sse / df;
  const se = beta.map((_, j) => Math.sqrt(Math.max(0, sigma2 * inv[j][j])));
  const t = beta.map((b, j) => (se[j] > 0 ? b / se[j] : NaN));
  const p = t.map((tv) => tPValue(tv, df));
  const r2 = sst > 0 ? 1 - sse / sst : 0;
  return {
    names: ['Intercept', ...names], coef: beta, se, t, p, r2,
    adjR2: 1 - (1 - r2) * ((n - 1) / df), n, k, df,
  };
}

// ---------------------------------------------------------------- correlation / VIF

export function corrMatrix(cols: number[][]): number[][] {
  const m = cols.length;
  const means = cols.map(mean);
  const sd = cols.map((c, i) => Math.sqrt(c.reduce((s, v) => s + (v - means[i]) ** 2, 0)));
  const out: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = i; j < m; j++) {
      let s = 0;
      for (let r = 0; r < cols[i].length; r++) s += (cols[i][r] - means[i]) * (cols[j][r] - means[j]);
      const v = sd[i] > 0 && sd[j] > 0 ? s / (sd[i] * sd[j]) : i === j ? 1 : 0;
      out[i][j] = v; out[j][i] = v;
    }
  }
  return out;
}

/**
 * Variance inflation factors for the given predictor columns.
 * VIF_j = 1 / (1 - R²_j) = j-th diagonal entry of the inverse correlation matrix.
 * A perfectly collinear set returns Infinity for the offending columns.
 */
export function vif(cols: number[][]): number[] {
  const m = cols.length;
  if (m === 0) return [];
  if (m === 1) return [1];
  const R = corrMatrix(cols);
  const inv = invert(R);
  if (!inv) {
    // singular: fall back to per-column R² regression so we can still point at the culprit
    return cols.map((_, j) => {
      const others = cols.filter((__, i) => i !== j);
      const X = cols[0].map((__, r) => others.map((c) => c[r]));
      const fit = ols(X, cols[j], others.map((__, i) => `x${i}`));
      if (!fit || fit.r2 >= 1 - 1e-10) return Infinity;
      return 1 / (1 - fit.r2);
    });
  }
  return inv.map((row, i) => {
    const d = row[i];
    return d > 0 && isFinite(d) ? d : Infinity;
  });
}
