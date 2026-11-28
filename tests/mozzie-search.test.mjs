import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.window={SANDY_SITE_MAP:{groups:[['Explore',[['constitution.html','Draft constitution'],['how-it-works.html','How the club works']]]]}};
globalThis.document={querySelector:()=>null,getElementById:()=>null};
const {search}=await import('../mozzie-search.js');
const top=q=>search(q,1)[0];
test('Ask Mozzie finds the right process step and who can do it',()=>{
 let h=top('who approves a news story');assert.equal(h.title,'Island news story');assert.match(h.text,/Publish, or decline.*Members and publishing.*Webmaster/);
 h=top('how do I borrow a camera');assert.equal(h.title,'Kit loan');assert.match(h.text,/Ask for dates/);
 h=top('change who can do what');assert.equal(h.title,'Officer access');assert.match(h.text,/resolution, then Schedule 1/);
 h=top('blue tick');assert.match(h.text,/ID sighted in person/);
 h=top('go live');assert.match(h.text,/Go live\. Members and publishing/);
 assert.ok(search('who can see kids details').some(x=>x.kind==='Who can'&&x.title==='Safeguarding'));
 assert.equal(top('constitution').href,'/constitution.html');
 assert.deepEqual(search('the and of'),[]);
});
