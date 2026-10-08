import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { LatLng, Listing } from '../lib/types';
import { computeTiers, TIER_COLORS } from '../lib/analysis';
import { fmtK, fmtMoney } from './ui';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const STYLES: Record<string, { label: string; url: string; attr: string; native: number }> = {
  dark: { label: 'Dark', url: `${ESRI}/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attr: 'Tiles © Esri', native: 16 },
  light: { label: 'Light', url: `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, attr: 'Tiles © Esri', native: 16 },
  streets: { label: 'Streets', url: `${ESRI}/World_Street_Map/MapServer/tile/{z}/{y}/{x}`, attr: 'Tiles © Esri', native: 19 },
  satellite: { label: 'Satellite', url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, attr: 'Imagery © Esri', native: 19 },
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

interface Props {
  /** every listing in the market — used for revenue tiers and the percentile in tooltips */
  all: Listing[];
  threshold: number;
  /** if given, only these are drawn at full strength; others are dimmed */
  highlight?: Set<string>;
  /** polygons of the buy box being edited (drawn in teal) */
  regions?: LatLng[][];
  /** outlines of other buy boxes (overview) */
  outlines?: { name: string; regions: LatLng[][]; color: string }[];
  editable?: boolean;
  onRegions?: (r: LatLng[][]) => void;
  height?: number;
  fitToRegions?: boolean;
}

export function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const base = useRef<L.TileLayer | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const shapes = useRef<L.LayerGroup | null>(null);
  const draft = useRef<L.LayerGroup | null>(null);
  const [style, setStyle] = useState('light');
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<LatLng[]>([]);
  const fitted = useRef('');
  const propsRef = useRef(p);
  const drawingRef = useRef(false);
  propsRef.current = p;
  drawingRef.current = drawing;

  const geo = useMemo(() => p.all.filter((l) => l.lat != null && l.lng != null), [p.all]);
  const tiering = useMemo(() => computeTiers(geo, p.threshold), [geo, p.threshold]);
  const sortedRevs = useMemo(() => geo.map((l) => l.rev).sort((a, b) => a - b), [geo]);

  const tierLabel = (t: number) => {
    const r = tiering.ranges[t];
    if (!r) return null;
    const name = t === 0 ? `Below ${fmtK(p.threshold)}` : `${fmtK(p.threshold)}+ Q${t}`;
    return `${name} (${fmtK(r.min)}–${fmtK(r.max)})`;
  };

  // ---- init
  useEffect(() => {
    const m = L.map(el.current!, { preferCanvas: true, zoomControl: true, scrollWheelZoom: true }).setView([39, -98], 4);
    map.current = m;
    markers.current = L.layerGroup().addTo(m);
    shapes.current = L.layerGroup().addTo(m);
    draft.current = L.layerGroup().addTo(m);
    return () => { m.remove(); map.current = null; };
  }, []);

  // ---- base layer
  useEffect(() => {
    const m = map.current!;
    base.current?.remove();
    const s = STYLES[style];
    base.current = L.tileLayer(s.url, { attribution: s.attr, maxZoom: 19, maxNativeZoom: s.native }).addTo(m);
    base.current.bringToBack();
  }, [style]);

  // ---- listings
  const sig = `${geo.length}|${p.threshold}|${[...hidden].join()}|${p.highlight ? p.highlight.size : 'all'}`;
  useEffect(() => {
    const m = map.current!;
    const g = markers.current!;
    g.clearLayers();
    const revs = geo.map((l) => l.rev);
    const lo = Math.min(...revs), hi = Math.max(...revs);
    const hl = propsRef.current.highlight;
    geo.forEach((l, i) => {
      const t = tiering.tier[i];
      if (hidden.has(t)) return;
      const dim = hl ? !hl.has(l.id) : false;
      const radius = 4 + 7 * ((l.rev - lo) / (hi - lo || 1));
      const mk = L.circleMarker([l.lat!, l.lng!], {
        radius, color: dim ? '#fff' : '#fff', weight: dim ? 0.3 : 0.8, fillColor: TIER_COLORS[t], fillOpacity: dim ? 0.18 : 0.9, opacity: dim ? 0.2 : 0.9,
      });
      const lower = sortedRevs.filter((v) => v < l.rev).length;
      const upper = sortedRevs.filter((v) => v <= l.rev).length;
      const pct = ((lower + (upper - lower + 1) / 2) / sortedRevs.length) * 100;
      mk.bindTooltip(
        `<div class="mt"><b>${esc(l.title)}</b><div class="mt-rev">${fmtMoney(l.rev)} <span>· ${pct.toFixed(0)}th percentile</span></div>` +
        `<div class="mt-row">ADR ${l.adr != null ? fmtMoney(l.adr) : '—'} · Occ ${l.occ != null ? (l.occ * 100).toFixed(0) + '%' : '—'}</div>` +
        `<div class="mt-row">${l.beds} bd · ${l.baths} ba · sleeps ${l.sleeps}${l.zip ? ' · ' + esc(l.zip) : ''}</div></div>`,
        { sticky: true, direction: 'top', opacity: 1, className: 'map-tip' },
      );
      mk.on('click', () => {
        const url = /^https?:\/\//.test(l.url) ? l.url : '';
        L.popup({ closeButton: true }).setLatLng([l.lat!, l.lng!]).setContent(`<b>${esc(l.title)}</b><br/>${fmtMoney(l.rev)}${url ? `<br/><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open listing ↗</a>` : ''}`).openOn(m);
      });
      mk.addTo(g);
    });
    // eslint-disable-next-line
  }, [sig, tiering]);

  // ---- region shapes
  const regSig = JSON.stringify(p.regions ?? []) + JSON.stringify((p.outlines ?? []).map((o) => o.regions)) + p.editable;
  useEffect(() => {
    const g = shapes.current!;
    g.clearLayers();
    (p.outlines ?? []).forEach((o) => o.regions.forEach((poly) => {
      L.polygon(poly, { color: o.color, weight: 2, fillOpacity: 0.07, dashArray: '6 4' }).bindTooltip(esc(o.name), { sticky: true }).addTo(g);
    }));
    (p.regions ?? []).forEach((poly, i) => {
      const pg = L.polygon(poly, { color: '#1B998B', weight: 3, fillColor: '#1B998B', fillOpacity: 0.12 }).addTo(g);
      if (p.editable) {
        pg.bindTooltip(`Region ${i + 1} — click to delete`, { sticky: true });
        pg.on('click', (e) => {
          if (drawingRef.current) return;
          L.DomEvent.stopPropagation(e);
          if (!window.confirm(`Delete region ${i + 1}?`)) return;
          const rs = propsRef.current.regions ?? [];
          propsRef.current.onRegions?.(rs.filter((_, j) => j !== i));
        });
      }
    });
  }, [regSig]);

  // ---- fit view
  useEffect(() => {
    const m = map.current!;
    const key = p.fitToRegions && p.regions?.length ? 'r' + JSON.stringify(p.regions) : 'all' + geo.length;
    if (fitted.current === key) return;
    fitted.current = key;
    const pts: LatLng[] = p.fitToRegions && p.regions?.length ? p.regions.flat() : geo.map((l) => [l.lat!, l.lng!] as LatLng);
    if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 15 });
  }, [regSig, geo]);

  // ---- drawing
  useEffect(() => {
    const m = map.current!;
    const d = draft.current!;
    d.clearLayers();
    if (!drawing) { m.getContainer().style.cursor = ''; m.doubleClickZoom.enable(); return; }
    m.getContainer().style.cursor = 'crosshair';
    m.doubleClickZoom.disable();
    if (points.length) {
      L.polyline(points, { color: '#F46A25', weight: 3, dashArray: '6 4' }).addTo(d);
      points.forEach((pt, i) => L.circleMarker(pt, { radius: i === 0 ? 7 : 4, color: '#F46A25', fillColor: '#fff', fillOpacity: 1, weight: 2 }).addTo(d));
    }
  }, [drawing, points]);

  const pointsRef = useRef<LatLng[]>([]);
  const setPts = (v: LatLng[]) => { pointsRef.current = v; setPoints(v); };
  useEffect(() => {
    const m = map.current!;
    if (!drawing) return;
    const finish = (pts: LatLng[]) => {
      if (pts.length >= 3) propsRef.current.onRegions?.([...(propsRef.current.regions ?? []), pts]);
      setPts([]); setDrawing(false);
    };
    const onClick = (e: L.LeafletMouseEvent) => {
      const cur = pointsRef.current;
      if (cur.length >= 3 && m.latLngToContainerPoint(cur[0]).distanceTo(m.latLngToContainerPoint(e.latlng)) < 12) { finish(cur); return; }
      setPts([...cur, [e.latlng.lat, e.latlng.lng]]);
    };
    const onDbl = () => {
      // the two clicks of a double-click each added a vertex at the same spot — drop one
      const cur = pointsRef.current;
      finish(cur.length > 3 ? cur.slice(0, -1) : cur);
    };
    m.on('click', onClick);
    m.on('dblclick', onDbl);
    return () => { m.off('click', onClick); m.off('dblclick', onDbl); };
  }, [drawing]);

  const legend = [0, 1, 2, 3, 4].map((t) => ({ t, label: tierLabel(t), n: tiering.ranges[t]?.n ?? 0 })).filter((x) => x.label);

  return (
    <div class="mapwrap" style={{ height: `${p.height ?? 560}px` }}>
      <div ref={el} class="map" />
      <div class="map-styles">
        {Object.entries(STYLES).map(([k, s]) => <button class={k === style ? 'on' : ''} onClick={() => setStyle(k)}>{s.label}</button>)}
      </div>
      <div class="map-legend">
        <div class="lg-title">Revenue tier <span>(split at {fmtK(p.threshold)})</span></div>
        {legend.map((x) => (
          <button class={`lg-item ${hidden.has(x.t) ? 'off' : ''}`} onClick={() => setHidden((h) => { const n = new Set(h); n.has(x.t) ? n.delete(x.t) : n.add(x.t); return n; })} title="Click to show/hide">
            <i style={{ background: TIER_COLORS[x.t] }} /> {x.label} <em>{x.n}</em>
          </button>
        ))}
      </div>
      {p.editable && (
        <div class="map-tools">
          {!drawing ? (
            <>
              <button class="btn primary sm" onClick={() => { setDrawing(true); setPts([]); }}>✎ Draw region</button>
              {!!p.regions?.length && <button class="btn ghost sm" onClick={() => p.onRegions?.([])}>Clear all</button>}
            </>
          ) : (
            <>
              <span class="tool-hint">Click to add points · click the first point (or double-click) to close</span>
              <button class="btn sm" disabled={points.length < 3} onClick={() => { p.onRegions?.([...(p.regions ?? []), points]); setPts([]); setDrawing(false); }}>Finish</button>
              <button class="btn ghost sm" disabled={!points.length} onClick={() => setPts(points.slice(0, -1))}>Undo</button>
              <button class="btn ghost sm" onClick={() => { setPts([]); setDrawing(false); }}>Cancel</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
