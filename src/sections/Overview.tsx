import { useMemo, useState } from 'preact/hooks';
import { Chart } from '../components/Chart';
import { countBars, revenueBoxes, revenueHistogram } from '../components/charts';
import { MapView } from '../components/MapView';
import { Callout, Card, Images, NumberField, Section, Segmented, Stat, Text, fmtK, fmtMoney } from '../components/ui';
import { boxListings, countBy, groupRevenue, rangeLabel, summarise } from '../lib/analysis';
import { commit, deleteBox, setPage, store } from '../store';

const COLORS = ['#F46A25', '#17415B', '#7B5EA7', '#D7263D', '#2E86AB', '#8A9A5B'];
export const boxColor = (i: number) => COLORS[i % COLORS.length];

export function Overview({ edit }: { edit: boolean }) {
  const { spec, data, dv } = store;
  const s = spec!, d = data!;
  const [scope, setScope] = useState<'all' | 'above'>('all');
  const all = d.listings;
  const sum = useMemo(() => summarise(all), [dv]);
  const above = useMemo(() => all.filter((l) => l.rev >= s.threshold), [dv, s.threshold]);
  const maxRev = useMemo(() => Math.max(...all.map((l) => l.rev)), [dv]);
  const scoped = scope === 'all' ? all : above;
  const boxStats = useMemo(() => s.boxes.map((b) => { const ls = boxListings(d, b); return summarise(ls); }), [dv]);
  const places = s.market.places.split('\n').map((x) => x.replace(/^[•\-*\s]+/, '').trim()).filter(Boolean);
  const m = s.market;
  const upd = (k: keyof typeof m, v: any) => { (m as any)[k] = v; commit('text'); };

  return (
    <div>
      <section class="hero">
        {m.heroImage && <img class="hero-img" src={m.heroImage.src} alt="" />}
        <div class="hero-shade" />
        <div class="hero-in">
          <div class="eyebrow light">Market buy box report</div>
          {edit ? (
            <div class="hero-edit">
              <input class="h1-input" value={m.name} placeholder="Market name" onInput={(e) => upd('name', (e.target as HTMLInputElement).value)} />
              <input class="sub-input" value={m.region} placeholder="State / region" onInput={(e) => upd('region', (e.target as HTMLInputElement).value)} />
              <input class="sub-input wide" value={m.tagline} placeholder="One-line pitch for this market" onInput={(e) => upd('tagline', (e.target as HTMLInputElement).value)} />
              <Images compact edit images={m.heroImage ? [m.heroImage] : []} label="Hero image" onChange={(v) => upd('heroImage', v[v.length - 1] ?? null)} />
            </div>
          ) : (
            <>
              <h1>{m.name}{m.region && <span>, {m.region}</span>}</h1>
              {m.tagline && <p class="hero-tag">{m.tagline}</p>}
            </>
          )}
          <div class="hero-stats">
            <Stat label="Listings analysed" value={sum.n.toLocaleString()} />
            <Stat label="Median revenue potential" value={fmtK(sum.medianRev)} />
            <Stat label="Top-quartile revenue" value={`${fmtK(sum.p75)}+`} />
            <Stat label="Median ADR" value={fmtMoney(sum.medianAdr)} />
            <Stat label="Median occupancy" value={isFinite(sum.medianOcc) ? `${(sum.medianOcc * 100).toFixed(0)}%` : '—'} />
          </div>
        </div>
      </section>

      <Section id="sec-boxes" eyebrow="At a glance" title={`${s.boxes.length} buy box${s.boxes.length === 1 ? '' : 'es'} identified`} intro="Each buy box is a distinct, repeatable target: a region, a property shape and an amenity package.">
        <div class="boxcards">
          {s.boxes.map((b, i) => (
            <div class="boxcard-wrap" key={b.id}>
              <button class="boxcard" onClick={() => setPage(b.id)} style={{ '--c': boxColor(i) } as any}>
                <div class="bc-top"><span class="dot" />{b.name || `Buy Box ${i + 1}`}</div>
                {b.tagline && <div class="bc-tag">{b.tagline}</div>}
                <div class="chips">
                  <span>{rangeLabel(b.beds, 'BR')}</span><span>{rangeLabel(b.baths, 'BA')}</span><span>Sleeps {rangeLabel(b.sleeps)}</span>
                  <span>{b.regions.length ? `${b.regions.length} drawn region${b.regions.length > 1 ? 's' : ''}` : 'Whole market'}</span>
                </div>
                <div class="bc-stats">
                  <div><b>{boxStats[i].n}</b><small>comp listings</small></div>
                  <div><b>{boxStats[i].n ? fmtK(boxStats[i].medianRev) : '—'}</b><small>median revenue</small></div>
                  <div><b>{boxStats[i].n ? fmtK(boxStats[i].p75) : '—'}</b><small>75th pct</small></div>
                </div>
                <div class="bc-go">View buy box →</div>
              </button>
              {edit && <button class="bc-del" title="Delete this buy box" onClick={() => deleteBox(b.id)}>🗑 Delete</button>}
            </div>
          ))}
          {!s.boxes.length && <p class="muted">No buy boxes yet. Use “+ Buy box” in the top bar to add one.</p>}
        </div>
      </Section>

      <Section id="sec-market" eyebrow="The market" title={`About ${m.name || 'this market'}`}>
        <div class="intro-grid">
          <Card title="What is this place?"><Text edit={edit} value={m.about} rows={6} placeholder="Describe the destination: geography, size, character, how it is reached…" onChange={(v) => upd('about', v)} />{!edit && !m.about && <p class="muted">—</p>}</Card>
          <Card title="Why do people visit?"><Text edit={edit} value={m.visitors} rows={6} placeholder="Demand drivers: attractions, events, seasons, who travels here…" onChange={(v) => upd('visitors', v)} />{!edit && !m.visitors && <p class="muted">—</p>}</Card>
          <Card title="Why does STR work here?"><Text edit={edit} value={m.whyStr} rows={6} placeholder="Supply gaps, hotel inventory, group demand, regulation, revenue upside…" onChange={(v) => upd('whyStr', v)} />{!edit && !m.whyStr && <p class="muted">—</p>}</Card>
        </div>
        {(edit || places.length > 0) && (
          <Card title="Popular places" class="places">
            {edit ? <Text edit value={m.places} rows={5} placeholder="One place per line" hint="One per line — shown as a list." onChange={(v) => upd('places', v)} /> : <ul class="placelist">{places.map((p) => <li>{p}</li>)}</ul>}
          </Card>
        )}
        <Images edit={edit} images={m.gallery} label="Market gallery" hint="Photos of the area, landmarks, typical streets." onChange={(v) => upd('gallery', v)} />
      </Section>

      <Section id="sec-revenue" eyebrow="Revenue potential" title="How much do listings earn?" intro="Distribution of annual revenue potential across every listing we pulled, with the median, 75th and 90th percentile marked.">
        <Card>
          <Chart option={revenueHistogram(all, [
            { label: 'Median', value: sum.medianRev, color: '#17415B' },
            { label: '75th pct', value: sum.p75, color: '#F46A25' },
            { label: '90th pct', value: sum.p90, color: '#D7263D' },
          ])} height={360} />
          <div class="pctrow">
            <span><i style={{ background: '#17415B' }} />Median <b>{fmtMoney(sum.medianRev)}</b></span>
            <span><i style={{ background: '#F46A25' }} />75th percentile <b>{fmtMoney(sum.p75)}</b></span>
            <span><i style={{ background: '#D7263D' }} />90th percentile <b>{fmtMoney(sum.p90)}</b></span>
          </div>
        </Card>
      </Section>

      <Section id="sec-threshold" eyebrow="Threshold" title="What counts as a performing listing?" intro="Set the revenue line between “average” and “worth targeting”. It drives the map tiers and the charts below, and is the default for the amenity analysis in each buy box.">
        <Card class="thr">
          <div class="thr-top">
            <div class="thr-val">{fmtMoney(s.threshold)}</div>
            <NumberField label="Type a value" prefix="$" step={1000} min={0} width={110} value={s.threshold} onChange={(v) => { s.threshold = Math.max(0, v); commit('data'); }} />
          </div>
          <input class="slider" type="range" min={0} max={Math.ceil(maxRev / 1000) * 1000} step={1000} value={Math.min(s.threshold, Math.ceil(maxRev / 1000) * 1000)}
            onInput={(e) => { s.threshold = parseInt((e.target as HTMLInputElement).value, 10); commit('data'); }} />
          <div class="thr-scale"><span>{fmtK(0)}</span><span>{fmtK(sum.medianRev)} median</span><span>{fmtK(maxRev)}</span></div>
          <div class="thr-stats">
            <Stat label={`Listings ≥ ${fmtK(s.threshold)}`} value={above.length} sub={`${((above.length / (all.length || 1)) * 100).toFixed(0)}% of the market`} />
            <Stat label="Median of those" value={above.length ? fmtK(summarise(above).medianRev) : '—'} sub="what a performing listing earns" />
            <Stat label="Below the threshold" value={all.length - above.length} sub="grey on the map" />
          </div>
        </Card>
      </Section>

      <Section id="sec-map" eyebrow="Where" title="Where the listings are" intro={`Grey dots are below ${fmtK(s.threshold)}. Everything above it is split into revenue quartiles — red is the top 25%. Click legend entries to hide tiers; hover a dot for details.`}>
        <MapView all={all} threshold={s.threshold} height={600}
          outlines={s.boxes.filter((b) => b.regions.length).map((b, i) => ({ name: b.name, regions: b.regions, color: boxColor(i) }))} />
      </Section>

      <Section id="sec-dist" eyebrow="Property shape" title="What are the top performers made of?" intro="Bedroom, sleep and bath mix, and how revenue changes as each one grows.">
        <div class="toolbar">
          <span class="lbl">Showing</span>
          <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: `All listings (${all.length})` }, { value: 'above', label: `≥ ${fmtK(s.threshold)} (${above.length})` }]} />
        </div>
        {scoped.length ? (
          <>
            <div class="three">
              <Card title="Bedrooms"><Chart option={countBars(countBy(scoped, (l) => l.beds), 'Bedrooms', '#17415B')} height={240} /></Card>
              <Card title="Sleeps"><Chart option={countBars(countBy(scoped, (l) => l.sleeps), 'Sleeps', '#1B998B')} height={240} /></Card>
              <Card title="Baths"><Chart option={countBars(countBy(scoped, (l) => l.baths), 'Baths', '#F46A25')} height={240} /></Card>
            </div>
            <div class="three">
              <Card title="Revenue by bedrooms"><Chart option={revenueBoxes(groupRevenue(scoped, (l) => l.beds), 'Bedrooms', '#17415B')} height={320} /></Card>
              <Card title="Revenue by sleeps"><Chart option={revenueBoxes(groupRevenue(scoped, (l) => l.sleeps), 'Sleeps', '#1B998B')} height={320} /></Card>
              <Card title="Revenue by baths"><Chart option={revenueBoxes(groupRevenue(scoped, (l) => l.baths), 'Baths', '#F46A25')} height={320} /></Card>
            </div>
            <p class="muted small">Box = middle 50% of listings, line = median, whiskers = 1.5×IQR, dots = outliers. The step between neighbouring medians is the revenue effect of one more bedroom / guest / bath.</p>
          </>
        ) : <Callout tone="warn">No listings at or above the threshold — lower it in the revenue section.</Callout>}
      </Section>
    </div>
  );
}
