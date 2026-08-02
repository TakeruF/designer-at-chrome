import { build } from 'esbuild';

const shared = {
  bundle: true,
  target: 'chrome120',
  sourcemap: false,
  minify: false,
  legalComments: 'none',
};

await Promise.all([
  build({
    ...shared,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background.js',
    format: 'iife',
  }),
  build({
    ...shared,
    entryPoints: ['src/content/inspector.ts'],
    outfile: 'dist/content.js',
    format: 'iife',
  }),
]);
