import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ideas=readFileSync(new URL('../studio/sandy-brainstorm.js',import.meta.url),'utf8');
const handoffs=readFileSync(new URL('../studio/sandy-workflows.js',import.meta.url),'utf8');
test('Sandy ideas are real authenticated club records, not local-only saves',()=>{
  assert.ok(ideas.includes("'/api/records?kind=social_idea'"));
  assert.ok(ideas.includes("'/api/records'"));
  assert.ok(ideas.includes("'/api/session'"));
  assert.ok(ideas.includes("method:'PATCH'"));
  assert.ok(!ideas.includes('localStorage.setItem'));
});
test('production handoffs preserve a deliberate unsent assignment step',()=>{
  assert.ok(handoffs.includes("'/api/studio/briefs'"));
  assert.ok(handoffs.includes("/handoff"));
  assert.ok(handoffs.includes('authorised:false'));
  assert.ok(handoffs.includes('No assignment'));
  assert.ok(!handoffs.includes('localStorage.setItem'));
});
test('existing browser-only ideas can be imported only after confirmation',()=>{
  assert.ok(ideas.includes("sandy-social-ideas-v1"));
  assert.ok(ideas.includes('window.confirm('));
  assert.ok(ideas.includes('The original local records will remain untouched'));
});
