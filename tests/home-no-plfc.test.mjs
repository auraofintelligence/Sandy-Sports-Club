import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
test('the home page makes no mention of PLFC',()=>{
 assert.ok(!/plfc/i.test(readFileSync(join(root,'index.html'),'utf8')),'index.html must not mention PLFC');
});
