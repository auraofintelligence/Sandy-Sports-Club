import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('browser-only Sandy brainstorm saves revisions and prepares an unsent handoff',()=>{
  const src=readFileSync(new URL('../studio/sandy-brainstorm.js',import.meta.url),'utf8');
  const callbacks={},store=new Map(),dispatched=[];
  const fields=['id','title','category','date','channel','stage','notes','source','author'];
  const elements=Object.fromEntries(fields.map(name=>[name,{value:''}]));
  const form={
    elements,
    reset(){for(const item of Object.values(elements))item.value='';},
    addEventListener(kind,fn){callbacks['form:'+kind]=fn;},
    scrollIntoView(){}
  };
  const nodes={};
  const node=name=>nodes[name]??=( {value:name==='sandy-ideas-filter'?'open':'',innerHTML:'',textContent:'',style:{},
    addEventListener(kind,fn){callbacks[name+':'+kind]=fn},scrollIntoView(){}} );
  const doc={
    querySelector(selector){
      if(selector==='#sandy-ideas')return null;
      if(selector==='#sandy-ideas-form')return form;
      return node(selector.slice(1));
    },
    body:{appendChild(){}},
    createElement:()=>({click(){},remove(){}})
  };
  const storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
  const FileData=function(ref){this.get=name=>ref.elements[name]?.value||''};
  const Event=function(type,options){this.type=type;this.detail=options.detail};
  const window={dispatchEvent:event=>dispatched.push(event)};
  new Function('document','window','localStorage','FormData','crypto','CustomEvent','URL','Blob','setTimeout',src)(
    doc,window,storage,FileData,{randomUUID:()=> 'test-idea-1'},Event,
    {createObjectURL:()=> 'blob:test',revokeObjectURL(){}},function(){},()=>{});
  elements.title.value='Outdoor LED sports-screen proposal';
  elements.category.value='film';
  elements.stage.value='idea';
  elements.channel.value='noticeboard';
  elements.notes.value='Confirm a proper modular outdoor LED screen instead of projection';
  callbacks['form:submit']({preventDefault(){}});
  const draft=JSON.parse(store.get('sandy-social-ideas-v1'));
  assert.equal(draft.items.length,1);
  assert.equal(draft.items[0].revision,1);
  const button=(field)=>({dataset:{[field]:'test-idea-1'},closest:()=>button(field)});
  callbacks['sandy-ideas-list:click']({target:button('ideaHandoff')});
  assert.equal(dispatched[0].type,'sandy-studio:handoff');
  assert.equal(dispatched[0].detail.title,elements.title.value);
  callbacks['sandy-ideas-list:click']({target:button('ideaArchive')});
  const archived=JSON.parse(store.get('sandy-social-ideas-v1')).items[0];
  assert.equal(archived.stage,'archived');
  assert.equal(archived.revision,2);
  assert.equal(archived.history.length,2);
  assert.ok(!src.includes('fetch('),'No remote write or publisher should be used');
});
