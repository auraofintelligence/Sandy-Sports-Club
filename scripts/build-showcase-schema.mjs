import {writeFile,mkdir} from 'node:fs/promises';
import {loadDemoSchema} from './demo-schema.mjs';

// Keep the isolated showcase on the same empty schema as Sandy production.
await mkdir(new URL('../.local/',import.meta.url),{recursive:true});
await writeFile(new URL('../.local/showcase-schema.sql',import.meta.url),await loadDemoSchema());
console.log('Prepared the separate Sandy showcase schema with an empty member register.');
