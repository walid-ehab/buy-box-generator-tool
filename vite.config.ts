import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file output: the built index.html contains all JS/CSS, so a generated
// market page can be saved as one self-contained .html file.
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile()],
  build: { chunkSizeWarningLimit: 4000 },
});
