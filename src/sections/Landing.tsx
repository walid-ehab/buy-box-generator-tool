import { useState } from 'preact/hooks';
import { buildDataset, FIELD_LABELS, loadFile, bestSheet } from '../lib/loader';
import { guessMarket, newSpec } from '../lib/defaults';
import { sampleDataset } from '../lib/sample';
import { clearDraft, load, readDraft } from '../store';
import { Callout } from '../components/ui';

export function Landing() {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const draft = readDraft();

  const pick = async (f: File) => {
    setErr(''); setBusy(true);
    try {
      const sheets = await loadFile(f);
      const sheet = bestSheet(sheets);
      if (!sheet) throw new Error('No data found in this file.');
      if (sheet.missing.length) {
        throw new Error(`Could not find the ${sheet.missing.map((m) => FIELD_LABELS[m].toLowerCase()).join(', ')} column${sheet.missing.length > 1 ? 's' : ''} in “${sheet.name}”. Expected headers like Revenue Potential, Bedrooms, Sleeps, Lat, Long.`);
      }
      const data = buildDataset(sheet, sheet.mapping, f.name);
      if (data.listings.length < 5) throw new Error(`Only ${data.listings.length} usable listings were found in “${sheet.name}”.`);
      clearDraft();
      load({ spec: newSpec(data, guessMarket(f.name)), data }, 'edit');
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div class="landing">
      <div class="land-hero">
        <div class="eyebrow light">Buy box generator</div>
        <h1>Turn a market dataset into an interactive buy box page.</h1>
        <p>Upload the analysed listings, set the thresholds, draw the regions, pick the amenities — and publish a page your underwriting analysts can explore instead of a Word doc.</p>
      </div>
      <div class="land-body">
        <label class={`dropzone ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) pick(f); }}>
          <input type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) pick(f); (e.target as HTMLInputElement).value = ''; }} />
          <div class="dz-icon">⬆</div>
          <b>{busy ? 'Reading file…' : 'Drop the market workbook here'}</b>
          <span>or click to choose a .xlsx / .csv — the “Cleaned_Data” sheet is used automatically</span>
        </label>
        {err && <Callout tone="warn">{err}</Callout>}
        <div class="land-alt">
          <button class="btn ghost" onClick={() => { const data = sampleDataset(); load({ spec: newSpec(data, { name: 'Sample Beach Town', region: 'OR' }), data }, 'edit'); }}>Try with sample data</button>
          {draft && <button class="btn ghost" onClick={() => load(draft, 'edit')}>Resume last draft ({draft.spec.market.name || 'untitled'})</button>}
        </div>
        <ol class="howto">
          <li><b>Upload</b> the listing data (revenue potential, beds, sleeps, baths, lat/long, HAS_ amenity flags).</li>
          <li><b>Fill in</b> the overview and each buy box — regions are drawn on the map, amenities are chosen from the analytics.</li>
          <li><b>Generate</b> the page, edit if needed, then download one self-contained HTML file.</li>
        </ol>
      </div>
    </div>
  );
}
