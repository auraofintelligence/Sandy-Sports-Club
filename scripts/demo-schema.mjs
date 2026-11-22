import {readFile,readdir} from 'node:fs/promises';

// The separate showcase starts from the same empty Sandy schema. Its sample
// catalogue has no prices or stock count; no account or member is provisioned.
export async function loadDemoSchema() {
  const files=(await readdir(new URL('../drizzle/',import.meta.url)))
    .filter(name=>/^\d{4}_.*\.sql$/.test(name)).sort();
  return (await Promise.all(files.map(name=>readFile(new URL('../drizzle/'+name,import.meta.url),'utf8')))).join('\n');
}
