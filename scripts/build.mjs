import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const projectPath = relative => fileURLToPath(new URL(relative, import.meta.url));

await build({
  entryPoints: [projectPath('../worker/index.mjs')],
  outfile: projectPath('../dist/server/index.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
});
console.log('Built the clubhouse Worker. Wrangler serves the public files as static assets.');
