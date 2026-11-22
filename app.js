const $ = (selector) => document.querySelector(selector);
const sport = $('#sport'), length = $('#length'), width = $('#width'), buffer = $('#buffer'), count = $('#count'), columns = $('#columns'), gap = $('#gap');
const presets = {
  volleyball: {length:16,width:8,buffer:3,note:'FIVB playing court 16 × 8 m; 3 m free zone minimum. This planner adds a separate gap between envelopes.'},
  football: {length:36,width:27,buffer:3,note:'Beach soccer laws give a 35–37 × 26–28 m pitch. The 3 m surrounding buffer here is a planning assumption, not a rules specification.'},
  cricket: {length:40,width:30,buffer:4,note:'Editable social beach cricket starting sketch, not a prescribed field. Choose boundaries, ball type and safe run-off with a cricket club.'},
  custom: {length:24,width:16,buffer:3,note:'Custom dimensions are your working assumptions. Check the sport, surface and safe run-off with the people who will use the space.'}
};
sport.addEventListener('change', () => {const p=presets[sport.value];length.value=p.length;width.value=p.width;buffer.value=p.buffer;$('#sport-note').textContent=p.note;calculate()});
$('#space-form').addEventListener('input', calculate);
function calculate(){
  const l=Number(length.value),w=Number(width.value),b=Number(buffer.value),n=Number(count.value),g=Number(gap.value),c=Math.min(n,Number(columns.value));
  const valid=[l,w,n,c].every(x=>Number.isFinite(x)&&x>0)&&[b,g].every(x=>Number.isFinite(x)&&x>=0)&&n<=24&&c<=6;
  if(!valid){$('#area-result').textContent='Check inputs';return}
  const rows=Math.ceil(n/c), zoneL=l+2*b,zoneW=w+2*b,totalL=rows*zoneL+(rows-1)*g,totalW=c*zoneW+(c-1)*g,area=totalL*totalW;
  $('#area-result').textContent=`${Math.round(area).toLocaleString('en-AU')} m²`;
  $('#grid-result').textContent=`${totalL.toFixed(1)} × ${totalW.toFixed(1)} m`;
  $('#zone-result').textContent=`${zoneL.toFixed(1)} × ${zoneW.toFixed(1)} m`;
  $('#equiv-result').textContent=(area/128).toFixed(1);
  $('#layout-note').textContent=`${n} zone${n===1?'':'s'} in ${rows} row${rows===1?'':'s'} and up to ${c} column${c===1?'':'s'}. Playing surface alone: ${(n*l*w).toLocaleString('en-AU')} m². Diagram is schematic, not to scale.`;
  const diagram=$('#layout-diagram');diagram.style.gridTemplateColumns=`repeat(${c},1fr)`;diagram.replaceChildren();for(let i=0;i<n;i++){const tile=document.createElement('span');tile.textContent=`${sport.options[sport.selectedIndex].text} ${i+1}`;diagram.append(tile)}
}
calculate();
$('#copy-plan').addEventListener('click',async()=>{const summary=`Sandy Sports space sketch: ${sport.options[sport.selectedIndex].text}; ${count.value} zones of ${length.value} × ${width.value} m; ${buffer.value} m buffer each side; ${columns.value} columns, ${gap.value} m gap. Estimated rectangular envelope ${$('#grid-result').textContent}, ${$('#area-result').textContent}. Planning assumption only; excludes amenities and site constraints.`;try{await navigator.clipboard.writeText(summary);$('#copy-status').textContent='Copied.'}catch{$('#copy-status').textContent='Copy unavailable in this browser.'}});
const menu=$('.menu-toggle'),nav=$('#nav');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open)});nav.addEventListener('click',e=>{if(e.target.closest('a')){nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}});
const guide=$('#guide-panel'),toggle=$('#guide-button');function setGuide(open){guide.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)$('#guide-close').focus();else toggle.focus()}toggle.addEventListener('click',()=>setGuide(guide.hidden));$('#guide-close').addEventListener('click',()=>setGuide(false));guide.addEventListener('click',e=>{if(e.target.closest('a'))setGuide(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!guide.hidden)setGuide(false)});
const brief=$('#brief-form'),preview=$('#brief-preview');function makeBrief(){const data=new FormData(brief);return `# Sandy Sports Club proposal note\n\nInterest: ${data.get('interest')}\nPlace: ${data.get('town')}\n\nWhat would make it work:\n${String(data.get('idea')||'').trim()||'(not filled in)'}\n\nWhat I could bring:\n${String(data.get('offer')||'').trim()||'(not filled in)'}\n\nThis is an idea for a proposed club, not an event registration or membership application.\n`}
brief.addEventListener('submit',e=>{e.preventDefault();preview.textContent=makeBrief();preview.hidden=false});$('#download-brief').addEventListener('click',()=>{const blob=new Blob([makeBrief()],{type:'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sandy-sports-idea.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
