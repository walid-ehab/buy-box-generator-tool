import { useState } from 'preact/hooks';
import { buildDataset, FIELD_LABELS, loadFile, bestSheet, REQUIRED, type FieldKey, type Mapping, type SheetInfo } from '../lib/loader';
import { guessMarket, newSpec } from '../lib/defaults';
import { sampleDataset } from '../lib/sample';
import { clearDraft, load, readDraft } from '../store';
import { Callout } from '../components/ui';

export function Landing() {
  const [file, setFile] = useState<string>('');
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState<Mapping>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const draft = readDraft();

  const sheet = sheets.find((s) => s.name === sheetName);
  const missing = REQUIRED.filter((f) => !mapping[f]);

  const pick = async (f: File) => {
    setErr(''); setBusy(true);
    try {
      const ss = await loadFile(f);
      if (!ss.length) throw new Error('No data found in this file.');
      const best = bestSheet(ss)!;
      setSheets(ss); setSheetName(best.name); setMapping(best.mapping); setFile(f.name);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  const create = () => {
    if (!sheet) return;
    const data = buildDataset(sheet, mapping, file);
    if (data.listings.length < 5) { setErr('Fewer than 5 usable listings were found — check the column mapping.'); return; }
    clearDraft();
    load({ spec: newSpec(data, guessMarket(file)), data }, 'edit');
  };

  const built = sheet && missing.length === 0 ? buildDataset(sheet, mapping, file) : null;

  return (
    <div class="landing">
      <div class="land-hero">
        <div class="eyebrow light">Buy box generator</div>
        <h1>Turn a market dataset into an interactive buy box page.</h1>
        <p>Upload the analysed listings, set the thresholds, draw the regions, pick the amenities — and publish a page your underwriting analysts can explore instead of a Word doc.</p>
      </div>
      <div class="land-body">
        {!sheet ? (
          <>
            <label class={`dropzone ${over ? 'over' : ''}`} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer?.files?.[0]; if (f) pick(f); }}>
              <input type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) pick(f); }} />
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
          </>
        ) : (
          <div class="mapper">
            <h2>Check the data</h2>
            <p class="muted">{file}</p>
            {sheets.length > 1 && (
              <label class="lbl">Sheet
                <select value={sheetName} onChange={(e) => { const s = sheets.find((x) => x.name === (e.target as HTMLSelectElement).value)!; setSheetName(s.name); setMapping(s.mapping); }}>
                  {sheets.map((s) => <option value={s.name}>{s.name} ({s.rows.length} rows)</option>)}
                </select>
              </label>
            )}
            <div class="maptable">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((f) => (
                <label class={missing.includes(f) ? 'bad' : ''}>
                  <span>{FIELD_LABELS[f]}{REQUIRED.includes(f) && ' *'}</span>
                  <select value={mapping[f] ?? ''} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setMapping({ ...mapping, [f]: v || undefined }); }}>
                    <option value="">— none —</option>
                    {sheet.headers.map((h) => <option value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {missing.length > 0 && <Callout tone="warn">Map the required columns: {missing.map((m) => FIELD_LABELS[m]).join(', ')}.</Callout>}
            {built && (
              <Callout tone="good">
                <b>{built.listings.length.toLocaleString()} usable listings</b> · {built.amenities.length} amenities detected ({built.amenities.map((a) => a.label).slice(0, 8).join(', ')}{built.amenities.length > 8 ? '…' : ''}) · {built.listings.filter((l) => l.lat == null).length} without coordinates
              </Callout>
            )}
            {err && <Callout tone="warn">{err}</Callout>}
            <div class="row gap">
              <button class="btn primary" disabled={!built} onClick={create}>Create market page →</button>
              <button class="btn ghost" onClick={() => { setSheets([]); setSheetName(''); }}>Choose another file</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
