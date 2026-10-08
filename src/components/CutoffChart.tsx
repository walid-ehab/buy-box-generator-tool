import { useRef } from 'preact/hooks';
import { Chart } from './Chart';

/** Bar chart with a draggable vertical cutoff handle laid over its plot area (x axis fixed at 0–100%). */
export function CutoffChart({ option, height, value, onChange, left = 130, right = 56, top = 30, bottom = 28 }: {
  option: Record<string, unknown>; height: number; value: number; onChange: (v: number) => void;
  left?: number; right?: number; top?: number; bottom?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = wrap.current!.getBoundingClientRect();
    const frac = (clientX - r.left - left) / (r.width - left - right);
    onChange(Math.round(Math.min(1, Math.max(0, frac)) * 100));
  };
  const v = Math.min(100, Math.max(0, value));
  return (
    <div class="cutwrap" ref={wrap}>
      <Chart option={option} height={height} />
      <div
        class="cutline" role="slider" tabIndex={0} aria-label="Must-have cutoff" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v}
        style={{ left: `calc(${left}px + (100% - ${left + right}px) * ${v / 100})`, top: `${top}px`, bottom: `${bottom}px` }}
        onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); e.preventDefault(); }}
        onPointerMove={(e) => { if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) move(e.clientX); }}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 5 : 1;
          if (e.key === 'ArrowLeft') { onChange(Math.max(0, v - step)); e.preventDefault(); }
          if (e.key === 'ArrowRight') { onChange(Math.min(100, v + step)); e.preventDefault(); }
        }}
      >
        <span class="cuthandle">◀ {v}% ▶</span>
      </div>
    </div>
  );
}
