import { useEffect, useMemo, useState } from 'preact/hooks';
import { Chart } from '../components/Chart';
import { PIE_COLORS, travelerPie, corrHeatmap, countBars, revenueBoxes, penetrationChart, prevalenceChart, upliftChart, vifChart } from '../components/charts';
import { FieldGroup, setText } from '../components/FieldGroup';
import { MapView } from '../components/MapView';
import { CutoffChart } from '../components/CutoffChart';
import { SettingEditor, hasSetting } from '../components/SettingEditor';
import { Tldr } from '../components/Tldr';
import { AnalystNotes, getNotes } from '../components/AnalystNotes';
import { Callout, Card, Images, NumberField, RangeEditor, Section, Segmented, Stat, Text, fmtK, fmtMoney } from '../components/ui';
import {
  boxListings, countBy, mustPoolThreshold, travelerMix, groupRevenue, inRange, niceAnalysis, penetration, prevalence, rangeLabel, rankNice, resolveSelections, summarise,
} from '../lib/analysis';
import { COMPS, PROFILE, PROJECTIONS_FIELDS, REGULATIONS, REG_TIERS, TRAVELERS } from '../lib/fields';
import { uid } from '../lib/defaults';
import type { BuyBox, Img, Listing } from '../lib/types';
import { commit, deleteBox, setPage, store } from '../store';
import { boxColor } from './Overview';

const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export function BoxPage({ box, index, edit }: { box: BuyBox; index: number; edit: boolean }) {
  const { spec, data, dv } = store;
  const s = spec!, d = data!;
  const listings = useMemo(() => boxListings(d, box), [dv, box.id]);
  const ids = useMemo(() => new Set(listings.map((l) => l.id)), [listings]);
  const sum = useMemo(() => summarise(listings), [listings]);
  // while drawing: listings that pass the size filters but sit outside the drawn region(s)
  const drawIds = useMemo(() => new Set(boxListings(d, { ...box, regions: [] }).map((l) => l.id)), [dv, box.id]);
  const [sizeScope, setSizeScope] = useState<'all' | 'above'>('all');
  const bedPool = useMemo(() => d.listings.filter((l) => inRange(l.beds, box.beds)), [dv, box.id]);
  const sizePool = sizeScope === 'all' ? bedPool : bedPool.filter((l) => l.rev >= s.threshold);
  const mustThr = s.threshold;
  const penThr = mustPoolThreshold(box, s.threshold);
  const pen = useMemo(() => penetration(listings, d, penThr), [dv, box.id]);
  const poolN = listings.filter((l) => l.rev >= penThr).length;
  const mustSet = new Set(box.must.selected);

  useEffect(() => { if (resolveSelections(box, d, s.threshold)) commit('data'); }, [dv, box.id]);


  const nice = useMemo(
    () => niceAnalysis(listings, d, { exclude: new Set(box.must.selected), minCount: box.nice.minCount, vifLimit: box.nice.vifLimit }),
    [dv, box.id],
  );
  const prev = useMemo(() => prevalence(listings, d, box.nice.topPct, new Set(box.must.selected)), [dv, box.id]);
  const ranked = useMemo(() => rankNice(nice), [nice]);
  const niceSel = box.nice.selected.filter((k) => ranked.some((r) => r.key === k));
  const aboveBox = listings.filter((l) => l.rev >= mustThr);
  const mark = (kind: 'must' | 'nice') => { box[kind].touched = true; commit('data'); };

  const toggleMust = (key: string) => {
    if (!edit) return;
    box.must.selected = mustSet.has(key) ? box.must.selected.filter((k) => k !== key) : [...box.must.selected, key];
    mark('must');
  };
  const toggleNice = (key: string) => {
    if (!edit) return;
    box.nice.selected = niceSel.includes(key) ? niceSel.filter((k) => k !== key) : [...niceSel, key];
    mark('nice');
  };

  const pages = ['overview', ...s.boxes.map((b) => b.id)];
  const at = pages.indexOf(box.id);
  const prevId = pages[at - 1], nextId = pages[at + 1];
  const nameOf = (id: string) => (id === 'overview' ? 'Market overview' : s.boxes.find((b) => b.id === id)?.name || 'Buy box');

  const dup = () => {
    const c: BuyBox = JSON.parse(JSON.stringify(box));
    c.id = uid(); c.name = `${box.name} (copy)`;
    s.boxes.splice(index + 1, 0, c);
    commit('data'); setPage(c.id);
  };
  const del = () => deleteBox(box.id);
  const copyRegs = (fromId: string) => {
    const src = s.boxes.find((b) => b.id === fromId);
    if (!src) return;
    for (const g of [REGULATIONS]) {
      for (const f of [...g.fields, ...(g.subgroups?.flatMap((x) => x.fields) ?? [])]) box.text[f.id] = src.text[f.id] ?? '';
      for (const im of g.images ?? []) box.images[im.id] = JSON.parse(JSON.stringify(src.images[im.id] ?? []));
    }
    box.text.regTier = src.text.regTier ?? '';
    commit('text');
  };

  const tScope = box.travelerScope ?? 'threshold';
  const tPool = useMemo(() => (tScope === 'all' ? listings : listings.filter((l) => l.rev >= s.threshold)), [dv, box.id]);
  const tAbove = listings.filter((l) => l.rev >= s.threshold).length;
  const mix = useMemo(() => travelerMix(tPool, d), [dv, box.id]);
  const small = listings.length > 0 && listings.length < 15;
  const tier = REG_TIERS.find((t) => t.v === box.text.regTier);
  const suggest = () => {
    const rs = aboveBox.map((l) => l.rev).sort((a, b) => a - b);
    if (rs.length < 3) return;
    const q = (p: number) => rs[Math.min(rs.length - 1, Math.floor(p * (rs.length - 1)))];
    box.text.revRange = `${fmtK(q(0.5))} – ${fmtK(q(0.9))}`;
    commit('text');
  };

  return (
    <div class="boxpage" style={{ '--c': boxColor(index) } as any}>
      <header class="boxhead">
        <div class="bh-wrap">
        <div class="bh-in">
          <div class="eyebrow"><span class="dot" /> Buy box {index + 1} of {s.boxes.length}</div>
          {edit ? (
            <>
              <input class="h1-input dark" value={box.name} placeholder="Buy box name" onInput={(e) => { box.name = (e.target as HTMLInputElement).value; commit('text'); }} />
              <input class="sub-input dark wide" value={box.tagline} placeholder="One-line description, e.g. “Large pool homes for group trips”" onInput={(e) => { box.tagline = (e.target as HTMLInputElement).value; commit('text'); }} />
              <div class="row gap"><button class="btn ghost sm" onClick={dup}>Duplicate</button><button class="btn danger sm" onClick={del}>🗑 Delete this buy box</button></div>
            </>
          ) : (
            <>
              <h1>{box.name}</h1>
              {box.tagline && <p class="bh-tag">{box.tagline}</p>}
            </>
          )}
          <div class="chips big">
            <span>{rangeLabel(box.beds, 'BR')}</span><span>{rangeLabel(box.baths, 'BA')}</span><span>Sleeps {rangeLabel(box.sleeps)}</span>
            {(box.must.selected.length > 0) && <span class="hl">{box.must.selected.length} must-haves</span>}
          </div>
        </div>
        <div class="bh-stats">
          <Stat label="Comparable listings" value={listings.length} />
          <Stat label="Median revenue" value={listings.length ? fmtK(sum.medianRev) : '—'} />
          <Stat label="75th percentile" value={listings.length ? fmtK(sum.p75) : '—'} />
          <Stat label="90th percentile" value={listings.length ? fmtK(sum.p90) : '—'} />
        </div>
        </div>
      </header>

      <nav class="subnav">
        {[['sec-tldr', 'TL;DR'], ['sec-size', 'Size'], ['sec-criteria', 'Region'], ['sec-must', 'Must-haves'], ['sec-nice', 'Nice-to-haves'], ['sec-profile', 'Property style'], ['sec-travelers', 'Traveler demographics'], ['sec-comps', 'Comps'], ['sec-regs', 'Regulations'], ['sec-notes', 'Analyst notes'], ['sec-proj', 'Projections'], ['sec-uw', 'Underwritten properties']].map(([id, l]) => (
          <button onClick={() => jump(id)}>{l}</button>
        ))}
      </nav>

      <Tldr box={box} notes={getNotes(box).map((n) => n.text.trim()).filter(Boolean)}
        must={box.must.selected.map((k) => d.amenities.find((x) => x.key === k)?.label ?? k)}
        nice={niceSel.map((k) => ({ label: d.amenities.find((x) => x.key === k)?.label ?? k, effect: ranked.find((r) => r.key === k)?.effect }))} />
      {edit && <p class="tl-note"><b>Note for editors:</b> the TL;DR is built from the sections below. Update the connected sections (Size, Amenities, Property style, Traveler demographics and Analyst notes) to see changes here.</p>}

      {/* ----------------------------------------------------------- size */}
      <Section id="sec-size" eyebrow="Size" title="Property Size" intro={edit ? 'These charts show baths and sleeps for listings in this buy box’s bedroom range. Use them to pick the ideal bath and sleep count, then set the sizes in the selector underneath.' : undefined}>
        {!edit && (
          <div class="specgrid specrow">
            <div class="spec"><b>{rangeLabel(box.beds)}</b><span>Bedrooms</span></div>
            <div class="spec"><b>{rangeLabel(box.baths)}</b><span>Baths</span></div>
            <div class="spec"><b>{rangeLabel(box.sleeps)}</b><span>Sleeps</span></div>
          </div>
        )}
        <div class="toolbar">
          <span class="lbl">{bedPool.length} listings with {rangeLabel(box.beds)} bedrooms · showing</span>
          <Segmented value={sizeScope} onChange={setSizeScope} options={[{ value: 'all', label: `All (${bedPool.length})` }, { value: 'above', label: `≥ ${fmtK(s.threshold)} (${bedPool.filter((l) => l.rev >= s.threshold).length})` }]} />
        </div>
        {sizePool.length ? (
          <div class="two">
            {([['baths', 'Baths', (l: Listing) => l.baths, '#e9a754', box.baths], ['sleeps', 'Sleeps', (l: Listing) => l.sleeps, '#2a8068', box.sleeps]] as const).map(([k, label, pick, color, rng]) => {
              const groups = groupRevenue(sizePool, pick);
              const best = groups.filter((g) => g.n >= 3).sort((a, b) => b.stats.median - a.stats.median)[0];
              const hl = (v: number) => inRange(v, rng);
              return (
                <Card key={k} title={`${label} for ${rangeLabel(box.beds)} bedrooms`}>
                  <Chart option={countBars(countBy(sizePool, pick), label, color, hl)} height={210} />
                  <Chart option={revenueBoxes(groups, label, color, hl)} height={300} />
                  <p class="muted small">
                    {best ? <>Highest median revenue: <b>{best.key} {label.toLowerCase()}</b> at {fmtK(best.stats.median)} (n={best.n}). </> : 'Not enough listings per group to compare. '}
                    Highlighted = your target ({rangeLabel(rng)}).
                  </p>
                </Card>
              );
            })}
          </div>
        ) : <Callout tone="warn">No listings have {rangeLabel(box.beds)} bedrooms{sizeScope === 'above' ? ` and earn ${fmtK(s.threshold)}+` : ''}. Widen the bedroom range.</Callout>}
        {edit && <div class="sizetop">
          {edit && (
            <Card title="Property size" class="sizeed">
              <div class="sizeed-row">
                {([['beds', 'Bedrooms', 'BR'], ['baths', 'Baths', 'baths'], ['sleeps', 'Sleeps', 'guests']] as const).map(([k, label, unit]) => (
                  <div class="critrow" key={k}>
                    <RangeEditor label={label} unit={unit} value={box[k]} onChange={(r) => { box[k] = r; commit('data'); }} />
                    <label class="check"><input type="checkbox" checked={box.filterBy[k]} onChange={(e) => { box.filterBy[k] = (e.target as HTMLInputElement).checked; commit('data'); }} /> also filter the analytics</label>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>}
        {!edit && (box.filterBy.beds || box.filterBy.baths || box.filterBy.sleeps) && (
          <p class="muted small">Analytics below use listings with {[box.filterBy.beds && `${rangeLabel(box.beds)} bedrooms`, box.filterBy.baths && `${rangeLabel(box.baths)} baths`, box.filterBy.sleeps && `sleeps ${rangeLabel(box.sleeps)}`].filter(Boolean).join(', ')}{box.regions.length ? ', inside the drawn region' : ''}.</p>
        )}
      </Section>

      {/* ----------------------------------------------------------- region */}
      <Section id="sec-criteria" eyebrow="Location" title="Ideal location" intro={edit ? 'Draw the region this buy box applies to. Only listings inside it (and matching the filters from step 1) are used in every analysis below.' : undefined}>
        <MapView all={d.listings} threshold={s.threshold} height={540} highlight={box.regions.length || box.filterBy.beds || box.filterBy.baths || box.filterBy.sleeps ? ids : undefined}
          whileDrawing={drawIds} regions={box.regions} editable={edit} fitToRegions onRegions={(r) => { box.regions = r; commit('data'); }} />
        <p class="muted small">{box.regions.length ? `${box.regions.length} region${box.regions.length > 1 ? 's' : ''} drawn.` : 'No region drawn: the whole market is used.'} {listings.length} listing{listings.length === 1 ? '' : 's'} match this buy box.</p>
        {listings.length === 0 && <Callout tone="warn">No listings match this region and size — widen the filters.</Callout>}
        {small && <Callout tone="warn">Only {listings.length} comparable listings. Treat the statistics below as directional.</Callout>}
      </Section>

      {/* ----------------------------------------------------------- must-haves */}
      <Section id="sec-must" eyebrow="Amenities" title="Must-have amenities" intro={`Share of ${box.must.scope === 'all' ? 'all listings' : `listings earning ${fmtK(mustThr)}+`} that offer each amenity. Drag the orange cutoff line along the chart: every amenity at or beyond it is a must-have — guests (and the algorithm) expect it.`}>
        <Card title={`Amenity penetration · ${poolN} listings`} actions={
          <div class="row gap">
            <Segmented value={box.must.scope ?? 'threshold'} onChange={(v) => { box.must.scope = v; box.must.touched = false; commit('data'); }}
              options={[{ value: 'threshold', label: `≥ ${fmtK(mustThr)} (${aboveBox.length})` }, { value: 'all', label: `All listings (${listings.length})` }]} />
            <NumberField label="Cutoff" suffix="%" step={5} min={0} max={100} width={60} value={box.must.penetration} onChange={(v) => { box.must.penetration = Math.min(100, Math.max(0, v)); box.must.touched = false; commit('data'); }} />
          </div>}>
          {poolN ? <CutoffChart option={penetrationChart(pen, box.must.penetration, mustSet)} height={Math.max(220, pen.length * 26 + 58)} value={box.must.penetration}
              onChange={(v) => { if (v !== box.must.penetration) { box.must.penetration = v; box.must.touched = false; commit('data'); } }} />
            : <Callout tone="warn">No listings in this buy box reach {fmtMoney(mustThr)} — switch to “All listings” or lower the threshold on the overview.</Callout>}
          {edit && (
            <div class="chipset">
              <div class="lbl">Selected must-haves {box.must.touched && <button class="link" onClick={() => { box.must.touched = false; commit('data'); }}>reset to cutoff</button>}</div>
              {pen.map((r) => <button class={`pick ${mustSet.has(r.key) ? 'on' : ''}`} onClick={() => toggleMust(r.key)}>{r.label} <em>{r.pct.toFixed(0)}%</em></button>)}
            </div>
          )}
        </Card>
        <AmenityCards keys={box.must.selected} labelOf={(k) => d.amenities.find((a) => a.key === k)?.label ?? k}
          badge={(k) => { const r = pen.find((x) => x.key === k); return r ? `${r.pct.toFixed(0)}% of top listings` : ''; }}
          notes={box.must.notes} images={box.must.images} edit={edit} placeholder="What should the underwriter look for? e.g. heated pool, min. 12×24 ft" />
        {!edit && !box.must.selected.length && <p class="muted">No must-have amenities for this buy box.</p>}
      </Section>

      {/* ----------------------------------------------------------- nice-to-haves */}
      <Section id="sec-nice" eyebrow="Amenities" title="Nice-to-have amenities" intro="Must-haves are removed from this analysis. We compare what the best and worst listings offer, then estimate each amenity's isolated effect on revenue after controlling for bedrooms, checking for collinearity and requiring a healthy sample.">
        <div class="two">
          <Card title={`Prevalence: top ${box.nice.topPct}% vs bottom ${box.nice.topPct}%`} actions={<NumberField label="Group size" suffix="%" step={5} min={1} max={50} width={56} value={box.nice.topPct} onChange={(v) => { box.nice.topPct = Math.min(50, Math.max(1, v)); commit('data'); }} />}>
            <Chart option={prevalenceChart(prev.rows, box.nice.topPct)} height={Math.max(260, Math.min(14, prev.rows.length) * 36 + 60)} />
            <p class="muted small">{prev.nGroup} listings in each group. Longer teal bars = amenities the top earners have that the bottom ones lack.</p>
          </Card>
          <Card title="Isolated effect on revenue" actions={nice.model && <span class="pill">n={nice.model.n} · R² {nice.model.r2.toFixed(2)}</span>}>
            {ranked.length ? <Chart option={upliftChart(ranked)} height={Math.max(260, ranked.length * 34 + 60)} /> : <Callout tone="warn">Not enough variation to estimate amenity effects in this buy box.</Callout>}
            <p class="muted small">Bars show % revenue change when the amenity is present, holding bedrooms{nice.model?.controls.some((c) => c.startsWith('ZIP')) ? ' and ZIP' : ''} constant. Whiskers are 95% confidence intervals; grey bars are not statistically significant.</p>
          </Card>
        </div>

        <Card title="Collinearity report" actions={<NumberField label="VIF limit" step={1} min={1.5} width={56} value={box.nice.vifLimit} onChange={(v) => { box.nice.vifLimit = Math.max(1.5, v); commit('data'); }} />}>
          <p class="muted small mt0">Amenities that tend to come together (e.g. pool + pool heater) make their individual effects impossible to separate. The Variance Inflation Factor flags them: the most-inflated amenity is dropped one at a time until every VIF is under {box.nice.vifLimit}.</p>
          {nice.vifBefore.length ? (
            <div class="two">
              <div><h4 class="ch">VIF per amenity</h4><Chart option={vifChart(nice, box.nice.vifLimit)} height={Math.max(220, nice.vifBefore.length * 28 + 50)} /></div>
              <div><h4 class="ch">Correlation between amenities in the model</h4>{nice.corr.labels.length > 1 ? <Chart option={corrHeatmap(nice)} height={Math.max(260, nice.corr.labels.length * 30 + 110)} /> : <p class="muted">Need at least two modelled amenities.</p>}</div>
            </div>
          ) : <p class="muted">No amenities passed the sample-size rule, so there is nothing to test.</p>}
          {nice.vifSteps.length > 0 ? (
            <div class="drops"><b>Dropped for collinearity:</b>{nice.vifSteps.map((st, i) => <span class="pill warn">{i + 1}. {st.label} · VIF {st.vif >= 99 ? '∞' : st.vif.toFixed(1)}</span>)}</div>
          ) : nice.vifBefore.length > 0 && <div class="drops"><span class="pill good">✓ No amenity breached the VIF limit</span></div>}
          {nice.notes.map((n) => <p class="muted small">{n}</p>)}
        </Card>

        <Card title="Ranked nice-to-haves" actions={<NumberField label="Min listings with / without" step={1} min={2} width={56} value={box.nice.minCount} onChange={(v) => { box.nice.minCount = Math.max(2, Math.round(v)); commit('data'); }} />}>
          <div class="tablewrap">
            <table class="rank">
              <thead><tr><th>#</th>{edit && <th />}<th>Amenity</th><th>Revenue uplift</th><th>95% CI</th><th>p-value</th><th>With / without</th><th /></tr></thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr class={niceSel.includes(r.key) ? 'sel' : ''}>
                    <td>{i + 1}</td>
                    {edit && <td><input type="checkbox" checked={niceSel.includes(r.key)} onChange={() => toggleNice(r.key)} /></td>}
                    <td><b>{r.label}</b></td>
                    <td><span class={`uplift ${r.effect! >= 0 ? 'pos' : 'neg'}`}>{r.effect! >= 0 ? '+' : ''}{r.effect!.toFixed(1)}%</span></td>
                    <td class="muted">{r.lo!.toFixed(0)}% to {r.hi!.toFixed(0)}%</td>
                    <td>{r.p! < 0.001 ? '<0.001' : r.p!.toFixed(3)}</td>
                    <td>{r.nWith} / {r.nWithout}</td>
                    <td>{r.significant ? <span class="pill good">significant</span> : <span class="pill">not significant</span>}</td>
                  </tr>
                ))}
                {nice.rows.filter((r) => r.status !== 'ranked').map((r) => (
                  <tr class="out">
                    <td>–</td>{edit && <td />}
                    <td>{r.label}</td>
                    <td colSpan={3} class="muted">
                      {r.status === 'low-sample' ? `Excluded: low sample (needs ≥ ${box.nice.minCount} listings with and without)` : r.status === 'collinear' ? `Excluded: collinear (${r.dropReason})` : r.dropReason}
                    </td>
                    <td>{r.nWith} / {r.nWithout}</td><td />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {edit && <p class="muted small">Tick the amenities to recommend. {box.nice.touched ? <button class="link" onClick={() => { box.nice.touched = false; commit('data'); }}>reset to automatic (top 5 significant)</button> : 'Currently automatic: the top 5 significant positive-uplift amenities.'}</p>}
        </Card>

        <AmenityCards keys={niceSel} labelOf={(k) => d.amenities.find((a) => a.key === k)?.label ?? k}
          badge={(k) => { const r = ranked.find((x) => x.key === k); return r ? `${r.effect! >= 0 ? '+' : ''}${r.effect!.toFixed(0)}% revenue` : ''; }}
          notes={box.nice.notes} images={box.nice.images} edit={edit} placeholder="Notes for the underwriter" />
        {!edit && !niceSel.length && <p class="muted">No nice-to-have amenities selected for this buy box.</p>}
      </Section>

      <FieldGroup box={box} def={PROFILE} edit={edit} custom={{ setting: { render: () => <SettingEditor box={box} edit={edit} />, filled: () => hasSetting(box.setting) } }} />
      <FieldGroup box={box} def={TRAVELERS} edit={edit}>
        {d.traveler?.length ? (
          <Card title="Who leaves the reviews?" class="mixcard" actions={
            <Segmented value={tScope} onChange={(v) => { box.travelerScope = v; commit('data'); }}
              options={[{ value: 'threshold', label: `≥ ${fmtK(s.threshold)} (${tAbove})` }, { value: 'all', label: `All listings (${listings.length})` }]} />}>
            {mix ? (
              <div class="mix">
                <Chart option={travelerPie(mix.rows)} height={320} />
                <div class="mixlegend">
                  {mix.rows.slice().sort((a, b) => b.pct - a.pct).map((r) => (
                    <div class="mixrow" key={r.key}><i style={{ background: PIE_COLORS[mix.rows.findIndex((x) => x.key === r.key) % PIE_COLORS.length] }} /><span>{r.label}</span><b>{r.pct.toFixed(1)}%</b></div>
                  ))}
                  <p class="muted small">Share of guest reviews by traveler type across the {mix.n} {tScope === 'all' ? `listing${mix.n === 1 ? '' : 's'}` : `listing${mix.n === 1 ? '' : 's'} earning ${fmtK(s.threshold)}+`} in this buy box, weighted by each listing's review count{mix.reviews ? ` (${mix.reviews.toLocaleString()} reviews)` : ''}.</p>
                </div>
              </div>
            ) : <Callout tone="warn">No listings in this buy box {tScope === 'threshold' ? `earn ${fmtK(s.threshold)}+` : 'have review data'} — switch the toggle or widen the buy box.</Callout>}
          </Card>
        ) : edit ? <Callout tone="info">The uploaded data has no review-percentage columns (headers starting with <code>pct_</code>), so there is no traveler mix chart. You can still describe the traveler profile below.</Callout> : null}
      </FieldGroup>
      {/* sections stay in the generated page even when empty */}
        <section class="section" id="sec-comps">
          <header class="section-head"><div class="eyebrow">Comparables</div><h2>Comp sets</h2></header>
          <div class="two">{COMPS.map((c) => <Card key={c.id} title={c.title}><FieldGroup box={box} def={c} edit={edit} bare /></Card>)}</div>
        </section>

      <FieldGroup box={box} def={REGULATIONS} edit={edit}>
        {edit ? (
          <div class="regtop">
            <label class="lbl">Regulation tier overall
              <select value={box.text.regTier ?? ''} onChange={(e) => setText(box, 'regTier', (e.target as HTMLSelectElement).value)}>
                <option value="">— not set —</option>
                {REG_TIERS.map((t) => <option value={t.v}>{t.emoji} {t.label}</option>)}
              </select>
            </label>
            {s.boxes.length > 1 && (
              <label class="lbl">Copy regulations from
                <select value="" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v) copyRegs(v); }}>
                  <option value="">— choose a buy box —</option>
                  {s.boxes.filter((b) => b.id !== box.id).map((b) => <option value={b.id}>{b.name}</option>)}
                </select>
              </label>
            )}
          </div>
        ) : tier ? <div class={`tierbadge ${tier.v}`}>{tier.emoji} {tier.label}</div> : null}
      </FieldGroup>
      {(
        <section class="section" id="sec-notes">
          <header class="section-head"><div class="eyebrow">Analyst</div><h2>Analyst notes & insights</h2></header>
          <AnalystNotes box={box} edit={edit} />
        </section>
      )}

      {/* ----------------------------------------------------------- projections */}
      {(
      <Section id="sec-proj" eyebrow="Numbers" title="Projections" intro={edit ? 'Revenue and price targets for underwriters.' : undefined}>
        <div class="proj">
          {PROJECTIONS_FIELDS.map((f) => (
            (edit || box.text[f.id]) ? (
              <div class="projcard" key={f.id}>
                <div class="lbl">{f.label}</div>
                {edit ? <input type="text" value={box.text[f.id] ?? ''} placeholder={f.placeholder} onInput={(e) => setText(box, f.id, (e.target as HTMLInputElement).value)} /> : <div class="projval">{box.text[f.id]}</div>}
                {edit && f.id === 'revRange' && <button class="link" onClick={suggest}>suggest from data (P50–P90 of listings ≥ {fmtK(mustThr)})</button>}
              </div>
            ) : null
          ))}
        </div>
        {!edit && !PROJECTIONS_FIELDS.some((f) => box.text[f.id]) && <p class="muted empty">Nothing added yet.</p>}
      </Section>
      )}

      {(
      <Section id="sec-uw" eyebrow="Underwriting" title="Underwritten properties" intro={edit ? 'Properties already underwritten against this buy box: the link, the numbers, and why each fits.' : undefined}>
        <div class="uwgrid">
          {box.uw.map((u, i) => (
            <Card key={i} class="uw">
              {edit ? (
                <div class="uwform">
                  <input placeholder="Property / title" value={u.title} onInput={(e) => { u.title = (e.target as HTMLInputElement).value; commit('text'); }} />
                  <input placeholder="Zillow / listing link" value={u.link} onInput={(e) => { u.link = (e.target as HTMLInputElement).value; commit('text'); }} />
                  <div class="row gap"><input placeholder="Projected revenue" value={u.revenue} onInput={(e) => { u.revenue = (e.target as HTMLInputElement).value; commit('text'); }} /><input placeholder="Price" value={u.price} onInput={(e) => { u.price = (e.target as HTMLInputElement).value; commit('text'); }} /></div>
                  <textarea rows={2} placeholder="Why it fits" value={u.note} onInput={(e) => { u.note = (e.target as HTMLTextAreaElement).value; commit('text'); }} />
                  <button class="btn danger sm" onClick={() => { box.uw.splice(i, 1); commit('text'); }}>Remove</button>
                </div>
              ) : (
                <>
                  <h4>{/^https?:\/\//.test(u.link) ? <a href={u.link} target="_blank" rel="noopener noreferrer">{u.title || 'Example'} ↗</a> : (u.title || 'Example')}</h4>
                  <div class="uwnums">{u.revenue && <span>Revenue <b>{u.revenue}</b></span>}{u.price && <span>Price <b>{u.price}</b></span>}</div>
                  {u.note && <p>{u.note}</p>}
                </>
              )}
            </Card>
          ))}
          {edit && <button class="addcard" onClick={() => { box.uw.push({ title: '', link: '', note: '', revenue: '', price: '' }); commit('text'); }}>+ Add underwritten property</button>}
        </div>
        {!edit && !box.uw.length && <p class="muted empty">Nothing added yet.</p>}
      </Section>
      )}

      <nav class="pager">
        {prevId ? <button class="btn ghost" onClick={() => setPage(prevId)}>← {nameOf(prevId)}</button> : <span />}
        {nextId ? <button class="btn primary" onClick={() => setPage(nextId)}>{nameOf(nextId)} →</button> : <span />}
      </nav>
    </div>
  );
}

function AmenityCards({ keys, labelOf, badge, notes, images, edit, placeholder }: {
  keys: string[]; labelOf: (k: string) => string; badge: (k: string) => string;
  notes: Record<string, string>; images: Record<string, Img[]>; edit: boolean; placeholder: string;
}) {
  if (!keys.length) return null;
  return (
    <div class="amcards">
      {keys.map((k) => (
        <Card key={k} class="amcard">
          <div class="am-head"><h4>{labelOf(k)}</h4><span class="pill good">{badge(k)}</span></div>
          <Text edit={edit} value={notes[k] ?? ''} rows={2} placeholder={placeholder} onChange={(v) => { notes[k] = v; commit('text'); }} />
          <Images compact edit={edit} images={images[k] ?? []} onChange={(v) => { images[k] = v; commit('text'); }} label={edit ? 'Reference images' : undefined} />
        </Card>
      ))}
    </div>
  );
}
