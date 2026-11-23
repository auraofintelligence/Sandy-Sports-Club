import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../studio/social-campaign-engine.js',import.meta.url),'utf8');
const campaigns=readFileSync(new URL('../studio/social-campaigns.js',import.meta.url),'utf8');
const holidaySource=readFileSync(new URL('../studio/social-holiday-calendar.js',import.meta.url),'utf8');
const compile=s=>s.replace(/^import\s.*?;\s*$/gm,'').replace(/^export\s+/gm,'');
const calendar=new Function(compile(holidaySource)+'\nreturn {calendarDaySignals}')();
const engine=new Function('creativeVariantsFor','calendarDaySignals',
  compile(source)+'\nreturn {defaultCampaignSettings,copyMonthSettings,generateCampaignYear,normaliseDailyLimits}')(
  ()=>[],calendar.calendarDaySignals);
const novemberPosts=settings=>engine.generateCampaignYear('2026-11',settings).posts.filter(p=>p.date.startsWith('2026-11')).length;

test('fresh Sandy Studio can start blank without inventing content',()=>{
 const settings=engine.defaultCampaignSettings();
 assert.equal(Object.values(settings.layers).filter(p=>p.enabled).length,0);
 assert.equal(novemberPosts(settings),0);
});

test('monthly topic toggle creates visible posts and survives a versioned save',()=>{
 const settings=engine.defaultCampaignSettings();
 const month=engine.copyMonthSettings(settings);
 month.layers.volleyball.enabled=true;
 settings.monthOverrides['2026-11']=month;
 const preview=novemberPosts(settings);
 assert.ok(preview>0);
 assert.equal(novemberPosts(JSON.parse(JSON.stringify(settings))),preview);
});

test('old empty month overrides mask annual changes until explicitly reset',()=>{
 const settings=engine.defaultCampaignSettings();
 settings.monthOverrides['2026-11']=engine.copyMonthSettings(settings);
 settings.layers.volleyball.enabled=true;
 assert.equal(novemberPosts(settings),0);
 delete settings.monthOverrides['2026-11'];
 assert.ok(novemberPosts(settings)>0);
});

test('higher daily caps have the same range as the Studio sliders',()=>{
 const limits=engine.normaliseDailyLimits({weekdayMin:2,weekday:20});
 assert.equal(limits.weekday,20);
});

test('month view exposes clear topic activation and annual override recovery',()=>{
 for(const token of ['annual-topic-quickpanel','data-month-enabled','data-month-use-annual',
 'data-month-open-topics','No posts in ','Apply & save','Math.min(20,Number(value)||1)'])
  assert.ok(campaigns.includes(token),'Missing expected Studio control: '+token);
});
