import type { Listing } from '../lib/types';
import type { NiceResult, NiceRow, PenetrationRow, PrevalenceRow } from '../lib/analysis';
import { histogram } from '../lib/analysis';
import { fmtK, fmtMoney } from './ui';
import { axisCommon, GRID, INK, MUTED, NAVY, ORANGE, TEAL } from './Chart';

type Opt = Record<string, unknown>;

export interface Marker { label: string; value: number; color: string }

export function revenueHistogram(listings: Listing[], markers: Marker[]): Opt {
  const { edges, counts } = histogram(listings.map((l) => l.rev), 28);
  const step = (edges[1] - edges[0]) || 1;
  const idx = (v: number) => Math.max(-0.5, Math.min(counts.length - 0.5, (v - edges[0]) / step - 0.5));
  return {
    grid: { left: 48, right: 24, top: 70, bottom: 52 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any) => { const i = ps[0].dataIndex; return `${fmtMoney(edges[i])} – ${fmtMoney(edges[i + 1])}<br/><b>${counts[i]}</b> listings`; } },
    xAxis: { type: 'category', data: counts.map((_, i) => fmtK(edges[i])), ...axisCommon, name: 'Revenue potential (bin start)', nameLocation: 'middle', nameGap: 34, splitLine: { show: false }, axisLabel: { ...axisCommon.axisLabel, interval: 3 } },
    yAxis: { type: 'value', ...axisCommon, name: 'Listings', minInterval: 1 },
    series: [{
      type: 'bar', barCategoryGap: '8%',
      data: counts.map((c) => ({ value: c, itemStyle: { color: '#a9d4c2', borderRadius: [3, 3, 0, 0] } })),
      markLine: {
        symbol: 'none', silent: true,
        data: markers.map((m, i) => ({
          xAxis: idx(m.value),
          lineStyle: { color: m.color, width: 2, type: 'dashed' },
          label: { formatter: `${m.label}\n${fmtK(m.value)}`, color: m.color, fontWeight: 700, fontSize: 11, position: 'end', offset: [0, i % 2 ? -34 : 0], lineHeight: 14 },
        })),
      },
    }],
  };
}

export function countBars(counts: Map<number, number>, label: string, color = NAVY, highlight?: (k: number) => boolean): Opt {
  const keys = [...counts.keys()].sort((a, b) => a - b);
  return {
    grid: { left: 40, right: 12, top: 18, bottom: 36 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: keys.map(String), ...axisCommon, name: label, nameLocation: 'middle', nameGap: 24 },
    yAxis: { type: 'value', ...axisCommon, minInterval: 1 },
    series: [{ type: 'bar', data: keys.map((k) => ({ value: counts.get(k), itemStyle: { color: !highlight || highlight(k) ? color : '#C9CFD6', borderRadius: [4, 4, 0, 0] } })), barMaxWidth: 34, label: { show: true, position: 'top', color: MUTED, fontSize: 10 } }],
  };
}

export function revenueBoxes(groups: { key: number; n: number; stats: { min: number; q1: number; median: number; q3: number; max: number; outliers: number[] } }[], label: string, color = TEAL, highlight?: (k: number) => boolean): Opt {
  const cats = groups.map((g) => `${g.key}\n(n=${g.n})`);
  const outliers: [number, number][] = [];
  groups.forEach((g, i) => g.stats.outliers.forEach((o) => outliers.push([i, o])));
  return {
    grid: { left: 56, right: 16, top: 16, bottom: 52 },
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        if (p.seriesType === 'scatter') return `${fmtMoney(p.value[1])}`;
        const g = groups[p.dataIndex];
        return `<b>${label}: ${g.key}</b> · ${g.n} listings<br/>Max ${fmtMoney(g.stats.max)}<br/>Q3 ${fmtMoney(g.stats.q3)}<br/>Median <b>${fmtMoney(g.stats.median)}</b><br/>Q1 ${fmtMoney(g.stats.q1)}<br/>Min ${fmtMoney(g.stats.min)}`;
      },
    },
    xAxis: { type: 'category', data: cats, ...axisCommon, name: label, nameLocation: 'middle', nameGap: 38, splitLine: { show: false } },
    yAxis: { type: 'value', ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: (v: number) => fmtK(v) } },
    series: [
      { type: 'boxplot', data: groups.map((g) => { const on = !highlight || highlight(g.key); return { value: [g.stats.min, g.stats.q1, g.stats.median, g.stats.q3, g.stats.max], itemStyle: { color: on ? color + '33' : '#EEF0F2', borderColor: on ? color : '#B0B7C3', borderWidth: 1.5 } }; }), itemStyle: { color: color + '33', borderColor: color, borderWidth: 1.5 }, boxWidth: [8, 44] },
      { type: 'scatter', data: outliers, symbolSize: 5, itemStyle: { color: color, opacity: 0.55 } },
      {
        // median line labels
        type: 'scatter', data: groups.map((g, i) => [i, g.stats.median]), symbolSize: 0, silent: true,
        label: { show: true, position: 'right', formatter: (p: any) => fmtK(p.value[1]), color: INK, fontSize: 10, fontWeight: 600, offset: [14, 0] },
      },
    ],
  };
}

export function penetrationChart(rows: PenetrationRow[], cutoff: number, selected: Set<string>): Opt {
  const r = rows.slice().reverse();
  return {
    grid: { left: 130, right: 56, top: 30, bottom: 28 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any) => { const p = ps[0]; const row = r[p.dataIndex]; return `<b>${row.label}</b><br/>${row.pct.toFixed(1)}% (${row.n} of ${row.total} listings)`; } },
    xAxis: { type: 'value', max: 100, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: r.map((x) => x.label), ...axisCommon, splitLine: { show: false }, axisLabel: { color: INK, fontSize: 11 } },
    series: [{
      type: 'bar', barMaxWidth: 18,
      data: r.map((x) => ({ value: +x.pct.toFixed(1), itemStyle: { color: selected.has(x.key) ? TEAL : x.pct >= cutoff ? '#8cc7b2' : '#C9CFD6', borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', formatter: (p: any) => `${p.value}%`, color: MUTED, fontSize: 10 },
    }],
  };
}

export function prevalenceChart(rows: PrevalenceRow[], pct: number): Opt {
  const r = rows.slice(0, 14).reverse();
  return {
    grid: { left: 130, right: 40, top: 34, bottom: 24 },
    legend: { top: 0, right: 0, textStyle: { color: MUTED }, itemWidth: 12, itemHeight: 12 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: number) => `${v.toFixed(0)}%` },
    xAxis: { type: 'value', max: 100, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: r.map((x) => x.label), ...axisCommon, splitLine: { show: false }, axisLabel: { color: INK, fontSize: 11 } },
    series: [
      { name: `Bottom ${pct}%`, type: 'bar', data: r.map((x) => +x.bottom.toFixed(1)), itemStyle: { color: '#B0B7C3', borderRadius: [0, 3, 3, 0] }, barMaxWidth: 10 },
      { name: `Top ${pct}%`, type: 'bar', data: r.map((x) => +x.top.toFixed(1)), itemStyle: { color: TEAL, borderRadius: [0, 3, 3, 0] }, barMaxWidth: 10 },
    ],
  };
}

export function upliftChart(rows: NiceRow[]): Opt {
  const r = rows.filter((x) => x.effect != null).slice().sort((a, b) => a.effect! - b.effect!);
  const bound = Math.max(10, ...r.map((x) => Math.max(Math.abs(x.lo ?? 0), Math.abs(x.hi ?? 0), Math.abs(x.effect!)))) * 1.05;
  return {
    grid: { left: 130, right: 40, top: 8, bottom: 28 },
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => { const x = r[p.dataIndex]; if (!x) return ''; return `<b>${x.label}</b><br/>Uplift <b>${x.effect! >= 0 ? '+' : ''}${x.effect!.toFixed(1)}%</b> (95% CI ${x.lo!.toFixed(0)}% to ${x.hi!.toFixed(0)}%)<br/>p = ${x.p!.toFixed(3)} · ${x.nWith} with / ${x.nWithout} without`; },
    },
    xAxis: { type: 'value', min: -bound, max: bound, ...axisCommon, axisLabel: { ...axisCommon.axisLabel, formatter: '{value}%' } },
    yAxis: { type: 'category', data: r.map((x) => x.label), ...axisCommon, splitLine: { show: false }, axisLabel: { color: INK, fontSize: 11 } },
    series: [
      {
        type: 'bar', barMaxWidth: 16,
        data: r.map((x) => ({ value: +x.effect!.toFixed(1), itemStyle: { color: x.significant ? (x.effect! >= 0 ? TEAL : '#D7263D') : '#C9CFD6', borderRadius: 3 } })),
        markLine: { symbol: 'none', silent: true, lineStyle: { color: INK, width: 1 }, label: { show: false }, data: [{ xAxis: 0 }] },
      },
      {
        // 95% CI whiskers
        type: 'custom', silent: true, z: 5,
        data: r.map((x, i) => [i, x.lo, x.hi]),
        renderItem: (_: unknown, api: any) => {
          const i = api.value(0);
          const a = api.coord([api.value(1), i]);
          const b = api.coord([api.value(2), i]);
          const st = { stroke: INK, lineWidth: 1.2, opacity: 0.7 };
          return {
            type: 'group', children: [
              { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: st },
              { type: 'line', shape: { x1: a[0], y1: a[1] - 4, x2: a[0], y2: a[1] + 4 }, style: st },
              { type: 'line', shape: { x1: b[0], y1: b[1] - 4, x2: b[0], y2: b[1] + 4 }, style: st },
            ],
          };
        },
      },
    ],
  };
}

export function vifChart(res: NiceResult, limit: number): Opt {
  const r = res.vifBefore.slice().reverse();
  return {
    grid: { left: 130, right: 40, top: 8, bottom: 28 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (ps: any) => { const x = r[ps[0].dataIndex]; return `<b>${x.label}</b><br/>VIF ${x.vif >= 99 ? '∞ (perfectly collinear)' : x.vif.toFixed(2)}${x.dropped ? '<br/><span style="color:#f3c98f">dropped from model</span>' : ''}`; } },
    xAxis: { type: 'value', ...axisCommon, name: 'VIF', max: (v: { max: number }) => Math.max(v.max, limit * 1.4) },
    yAxis: { type: 'category', data: r.map((x) => x.label), ...axisCommon, splitLine: { show: false }, axisLabel: { color: INK, fontSize: 11 } },
    series: [{
      type: 'bar', barMaxWidth: 16,
      data: r.map((x) => ({ value: +x.vif.toFixed(2), itemStyle: { color: x.dropped ? ORANGE : x.vif > limit / 2 ? '#F4D35E' : TEAL, borderRadius: [0, 4, 4, 0] } })),
      label: { show: true, position: 'right', color: MUTED, fontSize: 10, formatter: (p: any) => (p.value >= 99 ? '∞' : p.value) },
      markLine: { symbol: 'none', silent: true, lineStyle: { color: '#D7263D', type: 'dashed', width: 2 }, label: { formatter: `limit ${limit}`, color: '#D7263D', fontWeight: 600, position: 'end' }, data: [{ xAxis: limit }] },
    }],
  };
}

export function corrHeatmap(res: NiceResult): Opt {
  const { labels, matrix } = res.corr;
  const data: [number, number, number][] = [];
  matrix.forEach((row, i) => row.forEach((v, j) => data.push([j, i, +v.toFixed(2)])));
  return {
    grid: { left: 120, right: 16, top: 8, bottom: 96 },
    tooltip: { formatter: (p: any) => `${labels[p.value[1]]} × ${labels[p.value[0]]}<br/>r = <b>${p.value[2]}</b>` },
    xAxis: { type: 'category', data: labels, axisLabel: { color: INK, fontSize: 10, rotate: 45, interval: 0 }, axisLine: { show: false }, axisTick: { show: false }, splitArea: { show: false } },
    yAxis: { type: 'category', data: labels, inverse: true, axisLabel: { color: INK, fontSize: 10, interval: 0 }, axisLine: { show: false }, axisTick: { show: false } },
    visualMap: { min: -1, max: 1, show: false, inRange: { color: ['#D7263D', '#FFFFFF', '#134c3d'] } },
    series: [{ type: 'heatmap', data, itemStyle: { borderColor: '#fff', borderWidth: 1 }, label: { show: labels.length <= 12, fontSize: 9, color: INK, formatter: (p: any) => (p.value[0] === p.value[1] ? '' : p.value[2]) } }],
  };
}

export const PIE_COLORS = ['#2a8068', '#e9a754', '#134c3d', '#F4D35E', '#7B5EA7', '#D7263D', '#2E86AB', '#8A9A5B'];

export function travelerPie(rows: { label: string; pct: number }[]): Opt {
  return {
    tooltip: { trigger: 'item', formatter: (p: any) => `<b>${p.name}</b><br/>${p.value.toFixed(1)}% of reviews` },
    color: PIE_COLORS,
    series: [{
      type: 'pie', radius: ['42%', '72%'], center: ['50%', '52%'], avoidLabelOverlap: true, minAngle: 3,
      itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
      label: { formatter: (p: any) => `${p.name}\n{b|${p.value.toFixed(0)}%}`, color: INK, fontSize: 12, lineHeight: 16, rich: { b: { fontWeight: 700, fontSize: 14 } } },
      labelLine: { length: 12, length2: 10 },
      data: rows.map((r) => ({ name: r.label, value: +r.pct.toFixed(2) })),
    }],
  };
}
