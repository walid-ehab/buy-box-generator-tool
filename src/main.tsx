import { render } from 'preact';
import { App } from './App';
import { load, readEmbedded } from './store';
import './styles.css';

const embedded = readEmbedded();
if (embedded) load(embedded, 'view');
render(<App />, document.getElementById('app')!);
