// Sponsors and supporters: public offer, committee desk, private sponsor link, listing approval, stockist products in the store.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const offer=(extra={})=>({organisation:'Fictional Island Sports',contactName:'Fictional Neil',email:'neil@example.test',phone:'',website:'fictional.example.test',
 offerTypes:['stockist','gift','bogus'],participation:['stand'],offer:'We could stock club-friendly gear and donate a prize.',consent:true,...extra});
test('sponsor offer to active partner with portal, approvals and stockist products',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['sec','secretary'],['other','committee']]});
 const pub=await f.call(null,'/api/sponsors');assert.equal(pub.sponsors.length,0);assert.ok(pub.offerTypes.stockist);
 await f.call(null,'/api/sponsors/offer','POST',offer({consent:false}),400);
 await f.call(null,'/api/sponsors/offer','POST',offer({email:'',phone:''}),400);
 await f.call(null,'/api/sponsors/offer','POST',offer(),201);
 const desk=await f.call('other','/api/committee/sponsors');assert.equal(desk.counts.new,1);assert.equal(desk.canManage,false);
 const s=desk.sponsors[0];assert.deepEqual(s.offerTypes,['stockist','gift']);assert.equal(s.website,'https://fictional.example.test/');
 await f.call('other','/api/committee/sponsors','POST',{action:'update',id:s.id,version:s.version,status:'active'},403);
 await f.call('sec','/api/committee/sponsors','POST',{action:'update',id:s.id,version:s.version,status:'active',tier:'stockist',owner:'secretary',followUpOn:'2026-01-01',notes:'Spoke at the shop'});
 const s2=(await f.call('sec','/api/committee/sponsors')).sponsors[0];
 assert.equal(s2.tierLabel,'Partner stockist');assert.ok(s2.benefits.length>=3);assert.equal(s2.overdue,true);assert.equal((await f.call('sec','/api/committee/sponsors')).counts.overdue,1);
 // Private link
 const link=(await f.call('sec','/api/committee/sponsors','POST',{action:'portal-link',id:s.id})).link;const key=link.split('#key=')[1];
 const portal=async(method='GET',body,status=200)=>{const r=await f.request(null,'/api/sponsor-portal',method,body,'https://sandy.test',{'X-Sponsor-Key':key});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d};
 assert.equal((await portal()).tier,'Partner stockist');
 const bad=await f.request(null,'/api/sponsor-portal','GET',undefined,'https://sandy.test',{'X-Sponsor-Key':'0'.repeat(64)});assert.equal(bad.status,401);
 await portal('POST',{action:'listing',name:'Fictional Island Sports',blurb:'Sports gear on the island.',url:'https://fictional.example.test'});
 await portal('POST',{action:'product',name:'Fictional beach volleyball',price:'59.95',url:'https://fictional.example.test/ball',description:'Official size'},201);
 assert.equal((await f.call(null,'/api/sponsors/stockists')).products.length,0);
 const s3=(await f.call('sec','/api/committee/sponsors')).sponsors[0];assert.equal(s3.pending.name,'Fictional Island Sports');assert.equal((await f.call('sec','/api/committee/sponsors')).counts.approvals,1);
 await f.call('sec','/api/committee/sponsors','POST',{action:'approve-listing',id:s.id});
 await f.call('sec','/api/committee/sponsors','POST',{action:'listing',id:s.id,live:true,name:'Fictional Island Sports',blurb:'Sports gear on the island.',url:'https://fictional.example.test'});
 await f.call('sec','/api/committee/sponsors','POST',{action:'product',id:s.id,productId:s3.products[0].id,status:'approved'});
 const wall=await f.call(null,'/api/sponsors');assert.equal(wall.sponsors[0].name,'Fictional Island Sports');assert.equal(wall.sponsors[0].tier,'Partner stockist');
 const stock=await f.call(null,'/api/sponsors/stockists');assert.equal(stock.products[0].price,5995);assert.equal(stock.products[0].stockist,'Fictional Island Sports');
 // Revoking the link locks the portal; ending hides the wall listing
 await f.call('sec','/api/committee/sponsors','POST',{action:'revoke-link',id:s.id});await portal('GET',undefined,401);
 const s4=(await f.call('sec','/api/committee/sponsors')).sponsors[0];
 await f.call('sec','/api/committee/sponsors','POST',{action:'update',id:s.id,version:s4.version,status:'ended'});
 assert.equal((await f.call(null,'/api/sponsors')).sponsors.length,0);assert.equal((await f.call(null,'/api/sponsors/stockists')).products.length,0);
});
