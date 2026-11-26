// Owner rule: no em dashes anywhere on the Sandy Sports Club site, including
// worker responses, data and docs. En dashes are also replaced ("to" or a hyphen).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync,statSync} from 'node:fs';
import {join,extname,relative} from 'node:path';
import {PUBLIC_FILES} from '../worker/public-assets.mjs';
const root=new URL('..',import.meta.url).pathname;
const TEXT=new Set(['.html','.js','.mjs','.css','.json','.jsonc','.md','.txt','.svg','.xml','.webmanifest','.py','.sql','.toml','.ics','.csv']);
const SKIP=new Set(['.git','node_modules','.wrangler']);
function walk(dir,out=[]){
 for(const name of readdirSync(dir)){
  if(SKIP.has(name))continue;
  const p=join(dir,name),s=statSync(p);
  if(s.isDirectory())walk(p,out);else if(TEXT.has(extname(name).toLowerCase()))out.push(p);
 }
 return out;
}
const banned=[[/\u2014/,'em dash'],[/&mdash;|&#8212;|&#x2014;/i,'em dash entity'],[/\\u2014/i,'escaped em dash'],[/\u2013/,'en dash'],[/&ndash;|&#8211;|&#x2013;/i,'en dash entity']];
function offences(files){
 const found=[];
 for(const f of files){
  const text=readFileSync(f,'utf8');
  text.split('\n').forEach((line,i)=>{for(const [re,label] of banned)if(re.test(line))found.push(relative(root,f)+':'+(i+1)+' '+label)});
 }
 return found;
}
test('every shipped public site file is free of em dashes',()=>{
 const files=PUBLIC_FILES.filter(f=>TEXT.has(extname(f).toLowerCase())).map(f=>join(root,f));
 assert.ok(files.length>20,'public file list was read');
 assert.deepEqual(offences(files),[]);
});
test('worker responses, data, templates and docs are free of em dashes',()=>{
 const self=new URL(import.meta.url).pathname;
 assert.deepEqual(offences(walk(root).filter(f=>f!==self)),[]);
});
