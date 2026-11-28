// Compact multi-choice: a dropdown of quick options, "Pick specific…" opens tick boxes, plus an optional "add specifics" box.
// Values are stored as arrays; the specifics text is stored as one "Other: …" entry.
const safe=x=>String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const same=(a,b)=>a.length===b.length&&a.every(x=>b.includes(x));
export function choiceGroup(mount,{name,options,presets,selected=[],other='Add specifics (optional)'}){
 const otherValue=(selected.find(x=>x.startsWith('Other: '))||'').slice(7),picked=selected.filter(x=>options.includes(x));
 const match=presets.findIndex(p=>p.values&&same(p.values,picked));
 const initial=match>=0?String(match):picked.length?'custom':String(Math.max(0,presets.findIndex(p=>p.values&&!p.values.length)));
 mount.innerHTML='<select data-preset aria-label="'+safe(name)+'">'+presets.map((p,i)=>'<option value="'+i+'">'+safe(p.label)+'</option>').join('')+'<option value="custom">Pick specific…</option></select>'+
  '<div data-custom class="choice-list"'+(initial==='custom'?'':' hidden')+'>'+options.map(o=>'<label><input type="checkbox" value="'+safe(o)+'"'+(picked.includes(o)?' checked':'')+'> '+safe(o)+'</label>').join('')+'</div>'+
  '<input data-other maxlength="80" placeholder="'+safe(other)+'" value="'+safe(otherValue)+'">';
 const select=mount.querySelector('[data-preset]'),custom=mount.querySelector('[data-custom]');select.value=initial;
 select.addEventListener('change',()=>{
  custom.hidden=select.value!=='custom';
  if(select.value!=='custom'){const v=presets[Number(select.value)].values;for(const box of custom.querySelectorAll('input'))box.checked=v.includes(box.value)}
 });
 return {value(){
  const list=select.value==='custom'?[...custom.querySelectorAll('input:checked')].map(b=>b.value):[...presets[Number(select.value)].values];
  const text=mount.querySelector('[data-other]').value.trim();return text?[...list,'Other: '+text]:list;
 }};
}
export const summary=list=>list.map(x=>x.startsWith('Other: ')?x.slice(7):x);
