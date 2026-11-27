// Bundle 3 entry (service-worker, content, popup) ra release/ cho Chrome load unpacked.
import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';

const outdir = 'release';

mkdirSync(outdir, { recursive: true });

const common = {
  bundle: true,
  format: 'esm',
  target: 'chrome116',
  minify: false,
  sourcemap: 'inline',
  outdir,
  logLevel: 'info',
};

const entries = [
  { in: 'src/background/service-worker.ts', out: 'service-worker' },
  { in: 'src/content/main.ts', out: 'content' },
  { in: 'popup/popup.ts', out: 'popup' },
];

for (const e of entries) {
  await build({ ...common, entryPoints: [{ in: e.in, out: e.out }] });
}
copyFileSync('public/manifest.json', `${outdir}/manifest.json`);
copyFileSync('popup/popup.html', `${outdir}/popup.html`);
console.log('extension compiled to', outdir);
