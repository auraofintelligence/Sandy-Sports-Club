const $=s=>document.querySelector(s);
const sport=$('#sport'), length=$('#length'), width=$('#width'), buffer=$('#buffer'), count=$('#count'), columns=$('#columns'), gap=$('#gap');
const presets={
  volleyball:{length:16,width:8,buffer:3,note:'FIVB playing court 16 � 8 m; 3 m free zone minimum.'},
  football:{length:36,width:27,buffer:3,note:'Beach soccer pitch 35-37 � 26-28 m. External buffer here is a planning assumption.'},
  cricket:{length:40,width:30,buffer:4,note:'Editable social cricket sketch. A club must choose ball, boundary and safe run-off.'},
  flag:{length:50,width:25,buffer:4,note:'Illustrative sand adaptation, not an official flag football field.'},
  rugby:{length:40,width:25,buffer:4,note:'Illustrative beach rugby / league crossover. Set format with the clubs.'},
  ultimate:{length:50,width:30,buffer:4,note:'Illustrative flying disc space, not a rulebook dimension.'},
  handball:{length:27,width:12,buffer:3,note:'Illustrative beach handball envelope. Check current rules and run-off.'},
  netball:{length:30.5,width:15.25,buffer:3,note:'Traditional netball court size as a reference only. Sand format needs adaptation.'},
  custom:{length:24,width:16,buffer:3,note:'Custom planning assumption. Verify with the people who will use the space.'}
};
function calculate(){
  if(!sport)return;
  const l=+length.value,w=+width.value,b=+buffer.value,n=+count.value,g=+gap.value,c=Math.min(n,+columns.value);
  if(![l,w,n,c].every(x=>Number.isFinite(x)&&x>0)||![b,g].every(x=>Number.isFinite(x)&&x>=0)||n>24||c>6){$('#area-result').textContent='Check inputs';return}
  const rows=Math.ceil(n/c),zoneL=l+2*b,zoneW=w+2*b,totalL=rows*zoneL+(rows-1)*g,totalW=c*zoneW+(c-1)*g,area=totalL*totalW;
  $('#area-result').textContent=`${Math.round(area).toLocaleString('en-AU')} m�`;
  $('#grid-result').textContent=`${totalL.toFixed(1)} � ${totalW.toFixed(1)} m`;
  $('#zone-result').textContent=`${zoneL.toFixed(1)} � ${zoneW.toFixed(1)} m`;
  $('#equiv-result').textContent=(area/128).toFixed(1);
  $('#layout-note').textContent=`${n} zones in ${rows} rows and up to ${c} columns. Playing surface alone: ${(n*l*w).toLocaleString('en-AU')} m�. Diagram is schematic.`;
  const d=$('#layout-diagram');d.style.gridTemplateColumns=`repeat(${c},1fr)`;d.replaceChildren();
  for(let i=0;i<n;i++){const tile=document.createElement('span');tile.textContent=`${sport.options[sport.selectedIndex].text} ${i+1}`;d.append(tile)}
}
sport?.addEventListener('change',()=>{const p=presets[sport.value];length.value=p.length;width.value=p.width;buffer.value=p.buffer;$('#sport-note').textContent=p.note;calculate()});
$('#space-form')?.addEventListener('input',calculate);calculate();
$('#copy-plan')?.addEventListener('click',async()=>{const summary=`Sandy Sports space sketch: ${sport.options[sport.selectedIndex].text}; ${count.value} zones of ${length.value} � ${width.value} m; ${buffer.value} m buffer; ${columns.value} columns, ${gap.value} m gap. Envelope ${$('#grid-result').textContent}, ${$('#area-result').textContent}. Planning assumption only.`;try{await navigator.clipboard.writeText(summary);$('#copy-status').textContent='Copied.'}catch{$('#copy-status').textContent='Copy unavailable.'}});

