import { useEffect, useState } from 'preact/hooks';
import { Lightbox } from './components/ui';
import { newBox } from './lib/defaults';
import { resolveSelections } from './lib/analysis';
import { Landing } from './sections/Landing';
import { Overview, boxColor } from './sections/Overview';
import { BoxPage } from './sections/BoxPage';
import { downloadWorkbook } from './lib/exportData';
import { commit, deleteBox, downloadHtml, setMode, setPage, store, useStore } from './store';

export function App() {
  useStore();
  const { spec, data, mode, page } = store;
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const m = location.hash.match(/^#box\/(.+)$/);
      const id = m && store.spec?.boxes.some((b) => b.id === m[1]) ? m[1] : 'overview';
      if (id !== store.page) { store.page = id; commit(); }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => { if (spec) document.title = `${spec.market.name || 'Market'} — Buy boxes`; }, [spec?.market.name]);

  if (!spec || !data) return <><Landing /><Lightbox /></>;
  const edit = mode === 'edit';

  const generate = () => {
    spec.boxes.forEach((b) => resolveSelections(b, data, spec.threshold));
    setFresh(true);
    store.dv++;
    setMode('view');
    window.scrollTo({ top: 0 });
  };
  const addBox = () => {
    const b = newBox(spec.boxes.length + 1, data, spec.threshold);
    spec.boxes.push(b);
    commit('data'); setPage(b.id);
  };
  const dl = async () => { setBusy(true); try { await downloadHtml(); } finally { setBusy(false); } };

  const idx = spec.boxes.findIndex((b) => b.id === page);
  return (
    <div class={`app ${edit ? 'editing' : 'viewing'}`}>
      <header class="topbar">
        <div class="tb-in">
          <button class="brand" onClick={() => setPage('overview')}>{spec.market.name || 'Market'}</button>
          <nav class="tabs">
            <button class={page === 'overview' ? 'on' : ''} onClick={() => setPage('overview')}>Overview</button>
            {spec.boxes.map((b, i) => (
              <span key={b.id} class={`tabwrap ${page === b.id ? 'on' : ''}`} style={{ '--c': boxColor(i) } as any}>
                <button class={page === b.id ? 'on' : ''} onClick={() => setPage(b.id)}><i />{b.name || `Buy Box ${i + 1}`}</button>
                {edit && <button class="tabx" title="Delete this buy box" onClick={() => deleteBox(b.id)}>✕</button>}
              </span>
            ))}
            {edit && <button class="add" onClick={addBox}>+ Buy box</button>}
          </nav>
          <div class="tb-actions">
            {edit ? (
              <>
                <span class="badge edit">Editing</span>
                <button class="btn primary" onClick={generate}>Generate page ✨</button>
              </>
            ) : (
              <>
                <button class="btn ghost" onClick={() => downloadWorkbook(spec, data)} title="Excel workbook: market data + one sheet per buy box">⬇ Download data</button>
                <button class="btn ghost" onClick={() => setMode('edit')}>✎ Edit</button>
                <button class="btn" disabled={busy} onClick={dl}>{busy ? 'Preparing…' : '⬇ Download page'}</button>
              </>
            )}
          </div>
        </div>
      </header>
      {fresh && !edit && (
        <div class="banner">
          <span>✅ Page generated. Review it below — then download it as a single HTML file you can host or share.</span>
          <button class="btn sm" onClick={dl}>Download HTML</button>
          <button class="btn ghost sm" onClick={() => setMode('edit')}>Keep editing</button>
          <button class="x" onClick={() => setFresh(false)}>✕</button>
        </div>
      )}
      <main>
        {page === 'overview' || idx < 0 ? <Overview edit={edit} /> : <BoxPage key={spec.boxes[idx].id} box={spec.boxes[idx]} index={idx} edit={edit} />}
        {page === 'overview' && spec.boxes.length > 0 && (
          <nav class="pager"><span /><button class="btn primary" onClick={() => setPage(spec.boxes[0].id)}>{spec.boxes[0].name} →</button></nav>
        )}
      </main>
      <footer class="foot">
        <span>{data.listings.length.toLocaleString()} listings · source: {data.source}</span>
        <span>Built with the Buy Box Generator</span>
      </footer>
      <Lightbox />
    </div>
  );
}
