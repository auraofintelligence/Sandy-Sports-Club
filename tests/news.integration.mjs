import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './d1-fixture.mjs';
async function join(f,username){
 const res=await f.request(null,'/api/join','POST',{fullName:'Fictional '+username,email:username+'@example.test',town:'Dunwich',audienceRegion:'local',
  username,password:'sandy77',adult:true,contactConsent:true,termsAccepted:true,termsVersion:'sandy-participation-v1',gender:'female',dob:'1990-06-15'});
 assert.equal(res.status,201);return (res.headers.get('set-cookie')||'').match(/__Host-sandy_session=([a-f0-9]{64})/)[1];
}
const today=new Date(Date.now()+36e6).toISOString().slice(0,10);
test('Island news: Film Club members send stories, officers check them, the public sees only published ones',async t=>{
 const f=fixture(t,{actors:[['web','webmaster'],['cm','committee']]});f.env.SANDY_FOUNDING_MEMBERS='enabled';
 const ana=await join(f,'anaya'),bo=await join(f,'bobbie');
 const story={title:'Sunset volleyball draws a crowd',summary:'Forty people turned up.',place:'Point Lookout',happenedOn:today,videoUrl:'https://peertube.example/w/abc',credit:'first',peopleOk:true};
 await f.call(ana,'/api/member/news','POST',story,409,'Film Club members only');
 await f.call(ana,'/api/member/film','POST',{action:'join',lanes:['make']});
 await f.call(ana,'/api/member/news','POST',{...story,peopleOk:false},400);
 await f.call(ana,'/api/member/news','POST',{...story,videoUrl:'http://insecure.example'},400);
 await f.call(ana,'/api/member/news','POST',{...story,place:'Brisbane'},400);
 const mine=await f.call(ana,'/api/member/news','POST',story);
 assert.equal(mine.stories[0].state,'sent');
 assert.deepEqual((await f.call(null,'/api/news')).stories,[],'nothing public until checked');
 const desk=await f.call('cm','/api/committee/news');assert.equal(desk.canPublish,false);assert.equal(desk.stories.length,1);
 await f.call('cm','/api/committee/news','POST',{action:'publish',id:desk.stories[0].id},403,'committee members can see, not publish');
 await f.call(bo,'/api/committee/news','GET',undefined,403);
 await f.call('web','/api/committee/news','POST',{action:'publish',id:desk.stories[0].id,title:'Sunset volleyball draws a crowd at Point Lookout'});
 const pub=await f.call(null,'/api/news');
 assert.equal(pub.stories.length,1);const s=pub.stories[0];
 assert.equal(s.title,'Sunset volleyball draws a crowd at Point Lookout');assert.equal(s.byline,'Fictional, Sandy Sports Film Club');assert.equal(s.videoHost,'peertube.example');
 assert.equal(s.author,undefined,'no full names or account details in public');assert.equal(s.state,undefined);
 assert.equal((await f.call(ana,'/api/member/news')).stories[0].state,'published');
 const {DB}=f.env;assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM club_notify_queue WHERE title LIKE 'Your story is on Island news%'").first()).n,1);
 await f.call(ana,'/api/member/news','POST',{action:'withdraw',id:s.id});
 assert.deepEqual((await f.call(null,'/api/news')).stories,[],'the maker can take their story down');
});
test('Live broadcasts: schedule, go live with the site-wide check, end with a replay',async t=>{
 const f=fixture(t,{actors:[['web','webmaster']]});
 const starts=new Date(Date.now()+864e5).toISOString();
 await f.call('web','/api/committee/news','POST',{action:'broadcast-save',title:'Social volleyball finals',place:'Somewhere',startsAt:starts},400);
 await f.call('web','/api/committee/news','POST',{action:'broadcast-save',title:'Social volleyball finals',place:'Dunwich',startsAt:starts,streamUrl:'ftp://x'},400);
 let d=await f.call('web','/api/committee/news','POST',{action:'broadcast-save',title:'Social volleyball finals',place:'Dunwich',startsAt:starts,crew:'Annie camera'});
 const b=d.broadcasts[0];
 await f.call('web','/api/committee/news','POST',{action:'live',id:b.id},400,'needs a stream link first');
 let pub=await f.call(null,'/api/news');assert.equal(pub.upcoming.length,1);assert.equal(pub.upcoming[0].crew,undefined,'crew stays private');
 await f.call('web','/api/committee/news','POST',{action:'broadcast-save',id:b.id,title:'Social volleyball finals',place:'Dunwich',startsAt:starts,streamUrl:'https://owncast.example/live'});
 await f.call('web','/api/committee/news','POST',{action:'live',id:b.id});
 const live=await f.call(null,'/api/news?live=1');
 assert.deepEqual(live.live.map(x=>[x.title,x.streamUrl,x.streamHost]),[['Social volleyball finals','https://owncast.example/live','owncast.example']]);
 await f.call('web','/api/committee/news','POST',{action:'ended',id:b.id});
 assert.deepEqual((await f.call(null,'/api/news?live=1')).live,[]);
 await f.call('web','/api/committee/news','POST',{action:'broadcast-save',id:b.id,title:'Social volleyball finals',place:'Dunwich',startsAt:starts,replayUrl:'https://youtube.example/watch?v=1'});
 pub=await f.call(null,'/api/news');assert.equal(pub.replays.length,1);assert.equal(pub.replays[0].streamUrl,'');assert.equal(pub.replays[0].replayUrl,'https://youtube.example/watch?v=1');
});
