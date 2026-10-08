import * as echarts from 'echarts/core';
import { BarChart, BoxplotChart, HeatmapChart, CustomChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useEffect, useRef } from 'preact/hooks';

echarts.use([PieChart, BarChart, BoxplotChart, HeatmapChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, VisualMapComponent, CanvasRenderer]);

export const INK = '#0E2A3B';
export const MUTED = '#6B7A89';
export const GRID = '#E6E2D9';
export const TEAL = '#1B998B';
export const ORANGE = '#F46A25';
export const NAVY = '#17415B';

export const baseOption = {
  textStyle: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif', color: INK },
  animationDuration: 400,
  tooltip: { backgroundColor: 'rgba(14,42,59,.96)', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 }, extraCssText: 'border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.25)' },
};

/** Thin ECharts wrapper: re-applies the option only when its JSON changes. */
export function Chart({ option, height = 320, onClick }: { option: Record<string, unknown>; height?: number; onClick?: (p: any) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  const last = useRef('');
  const cb = useRef(onClick);
  cb.current = onClick;
  useEffect(() => {
    const c = echarts.init(el.current!, undefined, { renderer: 'canvas' });
    chart.current = c;
    c.on('click', (p) => cb.current?.(p));
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el.current!);
    return () => { ro.disconnect(); c.dispose(); chart.current = null; last.current = ''; };
  }, []);
  useEffect(() => {
    const full = { ...baseOption, ...option, tooltip: { ...baseOption.tooltip, ...((option as any).tooltip ?? {}) } };
    const key = JSON.stringify(full);
    if (key !== last.current && chart.current) {
      chart.current.setOption(full, true);
      last.current = key;
    }
  });
  return <div ref={el} class="chart" style={{ height: `${height}px` }} role="img" />;
}

export const axisCommon = {
  axisLine: { lineStyle: { color: GRID } },
  axisTick: { show: false },
  axisLabel: { color: MUTED, fontSize: 11 },
  splitLine: { lineStyle: { color: GRID, type: 'dashed' as const } },
  nameTextStyle: { color: MUTED, fontSize: 11 },
};
