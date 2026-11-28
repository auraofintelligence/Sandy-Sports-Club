// Working demo store: demo catalogue, member order requests (member price, birthday discount, donations, tickets),
// treasurer stock and order flow, CSV import preview/apply and export round trip, reports and role limits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
const thisMonth=new Date(Date.now()+10*3600000).toISOString().slice(5,7);
async function join(f,username,dob){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',username,password:'sandy77',
  contactConsent:false,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
test('demo store: catalogue, orders, stock, reports, CSV round trip and roles',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['treasurer','treasurer'],['sec','secretary'],['other','committee']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const shop=await f.call(null,'/api/store');
 assert.equal(shop.bankAccount,false);assert.match(shop.notice,/no bank account/);assert.equal(shop.me.signedIn,false);
 assert.ok(shop.products.length>=20);assert.ok(!shop.products.some(p=>['GEAR-VB-BALL','GEAR-VB-NET','GEAR-FLAG-SET','GEAR-CRICKET','GEAR-DISC'].includes(p.sku)));assert.ok(shop.products.every(p=>p.demo));
 for(const kind of ['merch','ticket','donation'])assert.ok(shop.products.some(p=>p.kind===kind),kind);
 assert.equal(shop.products[0].cost,undefined);
 const tee=shop.products.find(p=>p.sku==='APP-TEE-FOUND'),cinema=shop.products.find(p=>p.sku==='TIX-CINEMA-1'),don=shop.products.find(p=>p.sku==='DON-COURTS');
 await f.call(null,'/api/store/orders','POST',{collection:'Dunwich',acknowledge:true,items:[{productId:tee.id,variant:'M',qty:1}]},401);
 const bday=await join(f,'birthday.member','1990-'+thisMonth+'-15'),plain=await join(f,'plain.member','1990-'+(thisMonth==='06'?'07':'06')+'-15');
 assert.equal((await f.call(bday,'/api/store')).me.birthdayMonth,true);
 const order=(await f.call(bday,'/api/store/orders','POST',{collection:'Dunwich',acknowledge:true,items:[{productId:tee.id,variant:'M',qty:2},{productId:cinema.id,variant:'Family (2 adults, 2 kids)',qty:1},{productId:don.id,variant:'Courts and lights',amount:50}]},201)).order;
 assert.equal(order.subtotal,2*3000+3500);assert.equal(order.discount,Math.round(9500*0.1));assert.equal(order.donation,5000);assert.equal(order.total,9500-950+5000);assert.equal(order.number,1001);
 const plainOrder=(await f.call(plain,'/api/store/orders','POST',{collection:'Dunwich',acknowledge:true,items:[{productId:tee.id,variant:'M',qty:1}]},201)).order;
 assert.equal(plainOrder.discount,0);assert.equal(plainOrder.total,3000);assert.equal(plainOrder.number,1002);
 await f.call(plain,'/api/store/orders','POST',{collection:'Dunwich',acknowledge:true,items:[{productId:tee.id,variant:'M',qty:99}]},400);
 await f.call(plain,'/api/store/orders','POST',{collection:'Dunwich',acknowledge:true,items:[{productId:don.id,variant:'Courts and lights',amount:0.5}]},400);
 assert.equal((await f.call(bday,'/api/store/orders')).orders.length,1);
 // Roles
 await f.call(plain,'/api/committee/store/orders',undefined,undefined,403);
 await f.call('other','/api/committee/store/orders',undefined,undefined,403);
 assert.equal((await f.call('sec','/api/committee/store/orders')).canManage,false);
 await f.call('sec','/api/committee/store/orders','POST',{id:order.id,status:'confirmed'},403);
 // Stock comes off on confirm and returns on cancel
 const stockOf=async()=>(await f.call('treasurer','/api/committee/store/products')).products.find(p=>p.sku==='APP-TEE-FOUND').variants.find(v=>v.label==='M').stock;
 assert.equal(await stockOf(),12);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:order.id,status:'confirmed'});assert.equal(await stockOf(),10);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:order.id,status:'ready'});assert.equal(await stockOf(),10);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:order.id,status:'cancelled'});assert.equal(await stockOf(),12);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:order.id,status:'confirmed'},409);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:plainOrder.id,status:'collected'});
 const rep=await f.call('sec','/api/committee/store/report');
 assert.equal(rep.orders.byStatus.collected,1);assert.equal(rep.orders.byStatus.cancelled,1);assert.equal(rep.sales.value,3000);assert.equal(rep.sales.cost,1400);assert.ok(rep.stock.units>0);
 // CSV export, import preview with an error, then apply
 const exp=await f.request('treasurer','/api/committee/store/export?type=products');assert.equal(exp.status,200);
 const text=await exp.text();assert.match(text.split('\r\n')[0],/^sku,name,category,kind,status,price,member_price,cost,variants/);
 const csv=text.trim().split('\r\n').slice(0,2).join('\r\n')+'\r\nNEW-SUNSCREEN,"Reef-safe sunscreen, 200 ml",Beach gear,merch,active,18.00,15.00,7.50,200 ml:24,,,,"Locally made, SPF 50",500\r\nBAD SKU,Broken,Beach gear,merch,active,abc,,,M:1,,,,,\r\n';
 const preview=await f.call('treasurer','/api/committee/store/import','POST',{csv});
 assert.equal(preview.preview,true);assert.equal(preview.creates,1);assert.equal(preview.updates,1);assert.equal(preview.errors.length,1);assert.equal(preview.errors[0].row,4);
 await f.call('treasurer','/api/committee/store/import','POST',{csv,apply:true},400);
 const fixed=csv.split('\r\n').filter(l=>!l.startsWith('BAD')).join('\r\n');
 const applied=await f.call('treasurer','/api/committee/store/import','POST',{csv:fixed,apply:true});assert.equal(applied.applied,true);
 const sun=(await f.call(null,'/api/store')).products.find(p=>p.sku==='NEW-SUNSCREEN');assert.equal(sun.name,'Reef-safe sunscreen, 200 ml');assert.equal(sun.price,1800);assert.equal(sun.demo,false);
 await f.call('sec','/api/committee/store/import','POST',{csv:fixed},403);
 const ord=await f.request('treasurer','/api/committee/store/export?type=orders');assert.match(await ord.text(),/^order,date,name/);
 // Product edit and archive
 const p=(await f.call('treasurer','/api/committee/store/products')).products.find(x=>x.sku==='NEW-SUNSCREEN');
 await f.call('treasurer','/api/committee/store/products','POST',{id:p.id,version:p.version,product:{sku:'NEW-SUNSCREEN',name:'Sunscreen',kind:'merch',status:'active',price:'19.00',variants:'200 ml:10'}});
 await f.call('treasurer','/api/committee/store/products','POST',{product:{sku:'NEW-SUNSCREEN',name:'Duplicate',kind:'merch',price:'1',variants:'x:1'}},409);
 await f.call('treasurer','/api/committee/store/products','POST',{product:{sku:'TIX-NO-DATE',name:'Ticket without date',kind:'ticket',price:'5',variants:'Adult:10'}},400);
 await f.call('treasurer','/api/committee/store/products','POST',{action:'status',id:p.id,status:'archived'});
 assert.equal((await f.call(null,'/api/store')).products.some(x=>x.sku==='NEW-SUNSCREEN'),false);
});

test('checkout: collection, acknowledgement, quotes and discount codes',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['treasurer','treasurer']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const shop=await f.call(null,'/api/store');assert.deepEqual(shop.collectionPoints,['Dunwich','Amity Point','Point Lookout','At the next club event']);
 const tee=shop.products.find(p=>p.sku==='APP-TEE-FOUND'),pins=shop.products.find(p=>p.sku==='FILM-PINS'),bottle=shop.products.find(p=>p.sku==='GEAR-BOTTLE');
 const other=new Date(Date.now()+10*3600000).toISOString().slice(5,7)==='03'?'04':'03';
 const ana=await join(f,'code.member','1985-'+other+'-03');
 const items=[{productId:tee.id,variant:'M',qty:1},{productId:pins.id,variant:'Set of 3',qty:1}];
 await f.call(ana,'/api/store/orders','POST',{items,collection:'Dunwich'},400);
 await f.call(ana,'/api/store/orders','POST',{items,acknowledge:true,collection:'Sydney'},400);
 const q=await f.call(ana,'/api/store/quote','POST',{items,code:'founding10'});
 assert.equal(q.subtotal,3000+1500);assert.equal(q.discount,450);assert.equal(q.code,'FOUNDING10');assert.match(q.codeMessage,/applied/);
 const film=await f.call(ana,'/api/store/quote','POST',{items,code:'FILMCLUB15'});assert.equal(film.discount,Math.round(1500*0.15));
 const bad=await f.call(ana,'/api/store/quote','POST',{items,code:'NOPE'});assert.equal(bad.discount,0);assert.match(bad.codeMessage,/not valid/);
 const small=await f.call(ana,'/api/store/quote','POST',{items:[{productId:pins.id,variant:'Set of 3',qty:1}],code:'SUMMER5'});assert.match(small.codeMessage,/Spend \$40/);
 await f.call(ana,'/api/store/orders','POST',{items,acknowledge:true,collection:'Amity Point',code:'NOPE'},400);
 const order=(await f.call(ana,'/api/store/orders','POST',{items,acknowledge:true,collection:'Amity Point',phone:'0400 111 222',code:'FOUNDING10'},201)).order;
 assert.equal(order.discount,450);assert.equal(order.code,'FOUNDING10');assert.equal(order.collection,'Amity Point');
 const again=await f.call(ana,'/api/store/quote','POST',{items,code:'FOUNDING10'});assert.match(again.codeMessage,/already used/);
 await f.call('treasurer','/api/committee/store/orders','POST',{id:order.id,status:'cancelled'});
 assert.equal((await f.call('treasurer','/api/committee/store/discounts')).codes.find(c=>c.code==='FOUNDING10').uses,0);
 assert.equal((await f.call(ana,'/api/store/quote','POST',{items,code:'FOUNDING10'})).code,'FOUNDING10');
 await f.call('treasurer','/api/committee/store/discounts','POST',{code:'XMAS20',kind:'amount',value:'20',applies:'all',minSpend:'30',maxUses:'1',active:true});
 const big=[{productId:bottle.id,variant:'750 ml',qty:2}];
 assert.equal((await f.call(ana,'/api/store/quote','POST',{items:big,code:'xmas20'})).discount,2000);
 await f.call(ana,'/api/store/orders','POST',{items:big,acknowledge:true,collection:'Point Lookout',code:'XMAS20'},201);
 assert.match((await f.call(ana,'/api/store/quote','POST',{items:big,code:'XMAS20'})).codeMessage,/used up/);
 await f.call(ana,'/api/committee/store/discounts','POST',{code:'HACK',kind:'percent',value:100},403);
 const exp=await (await f.request('treasurer','/api/committee/store/export?type=orders')).text();assert.match(exp,/collection/);assert.match(exp,/XMAS20/);
 assert.ok((await f.call('treasurer','/api/committee/store/report')).codes.some(c=>c.code==='XMAS20'));
});
test('demo sports equipment already seeded is retired, leaving gear to local stockists',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 f.sql.exec(`CREATE TABLE IF NOT EXISTS store_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO store_settings VALUES('seeded','x');INSERT INTO store_settings VALUES('codes_seeded','x');`);
 f.sql.exec(`CREATE TABLE IF NOT EXISTS store_products(id TEXT PRIMARY KEY,sku TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT 'merch',description TEXT NOT NULL DEFAULT '',price_cents INTEGER NOT NULL DEFAULT 0,member_price_cents INTEGER,cost_cents INTEGER,variants_json TEXT NOT NULL DEFAULT '[]',event_date TEXT,event_time TEXT NOT NULL DEFAULT '',venue TEXT NOT NULL DEFAULT '',photo TEXT,status TEXT NOT NULL DEFAULT 'draft',sort INTEGER NOT NULL DEFAULT 100,demo INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL);
  INSERT INTO store_products(id,sku,name,category,variants_json,status,demo,created_utc,updated_utc) VALUES('a','GEAR-VB-BALL','Ball','Beach gear','[{"label":"Size 5","stock":3}]','active',1,'x','x'),('b','GEAR-BOTTLE','Bottle','Beach gear','[{"label":"750 ml","stock":3}]','active',1,'x','x');`);
 const shop=await f.call(null,'/api/store');
 assert.deepEqual(shop.products.map(p=>[p.sku,p.category]),[['GEAR-BOTTLE','Club gear']]);
});
test('demo hoodie already seeded is renamed to the I love Sandy Sports design',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 f.sql.exec(`CREATE TABLE IF NOT EXISTS store_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);INSERT INTO store_settings VALUES('seeded','x'),('codes_seeded','x'),('demo_v2','x');`);
 f.sql.exec(`CREATE TABLE IF NOT EXISTS store_products(id TEXT PRIMARY KEY,sku TEXT NOT NULL UNIQUE COLLATE NOCASE,name TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',kind TEXT NOT NULL DEFAULT 'merch',description TEXT NOT NULL DEFAULT '',price_cents INTEGER NOT NULL DEFAULT 0,member_price_cents INTEGER,cost_cents INTEGER,variants_json TEXT NOT NULL DEFAULT '[]',event_date TEXT,event_time TEXT NOT NULL DEFAULT '',venue TEXT NOT NULL DEFAULT '',photo TEXT,status TEXT NOT NULL DEFAULT 'draft',sort INTEGER NOT NULL DEFAULT 100,demo INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,created_utc TEXT NOT NULL,updated_utc TEXT NOT NULL);
  INSERT INTO store_products(id,sku,name,category,variants_json,status,demo,created_utc,updated_utc) VALUES('h','APP-HOODIE','"One island, three towns" hoodie','Apparel','[{"label":"M","stock":3}]','active',1,'x','x');`);
 assert.equal((await f.call(null,'/api/store')).products[0].name,'"I ❤ Sandy Sports" hoodie');
});
