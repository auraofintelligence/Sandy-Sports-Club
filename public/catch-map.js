import {drawSatellite,subscribeSatellite} from './catch-map-satellite.js';
import {pinStyles,styleForPin} from './catch-pin-styles.mjs';

const home={lat:-27.54,lon:153.465};
const places=[
  ['Point Lookout',-27.433,153.545],['Amity Point',-27.398,153.438],['Dunwich',-27.499,153.401],
  ['Jumpinpin',-27.727,153.444],['Moreton Bay',-27.45,153.30],['Coral Sea',-27.55,153.64],
  ['Minjerribah',-27.565,153.46],['Mulgumpin',-27.19,153.404],
];
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const valid=p=>p && Number.isFinite(p.lat) && Math.abs(p.lat)<=90 && Number.isFinite(p.lon) && Math.abs(p.lon)<=180;
let geography;
// Each symbol has a different silhouette as well as a different colour.
function fishingMarker(ctx,px,py,style,selected=false){
  ctx.save();ctx.translate(px,py);
  ctx.lineCap='round';ctx.lineJoin='round';
  if(selected){
    ctx.beginPath();ctx.arc(0,-10,15,0,Math.PI*2);ctx.strokeStyle='white';ctx.lineWidth=4;ctx.stroke();ctx.strokeStyle='#9b301e';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.shadowColor='rgba(10,28,35,.7)';ctx.shadowBlur=2;ctx.shadowOffsetY=1;
  function line(path,colour,width){
    ctx.beginPath();path();ctx.strokeStyle='white';ctx.lineWidth=width+2.8;ctx.stroke();ctx.shadowBlur=0;
    ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.stroke();
  }
  if(style==='fish'){
    line(()=>{ctx.moveTo(0,-1);ctx.lineTo(0,-8);},'#155266',2);
    ctx.beginPath();ctx.moveTo(-8,-15);ctx.lineTo(-14,-20);ctx.lineTo(-14,-9);ctx.lineTo(-8,-13);
    ctx.quadraticCurveTo(0,-2,12,-14);ctx.quadraticCurveTo(2,-26,-8,-15);ctx.closePath();
    ctx.fillStyle='#38bab9';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#153f51';ctx.lineWidth=1.5;ctx.stroke();
    ctx.beginPath();ctx.arc(6,-15,1.5,0,Math.PI*2);ctx.fillStyle='#132c32';ctx.fill();
  }else if(style==='float'){
    line(()=>{ctx.moveTo(0,0);ctx.lineTo(0,-23);},'#923c1a',2.5);
    ctx.beginPath();ctx.ellipse(0,-12,6,9,0,0,Math.PI*2);ctx.fillStyle='#fff4da';ctx.fill();ctx.strokeStyle='#702b15';ctx.lineWidth=1.5;ctx.stroke();
    ctx.save();ctx.clip();ctx.fillStyle='#e15b23';ctx.fillRect(-7,-22,14,10);ctx.restore();
  }else if(style==='flag'){
    line(()=>{ctx.moveTo(0,0);ctx.lineTo(0,-23);},'#5c3318',2.5);
    ctx.beginPath();ctx.moveTo(1,-23);ctx.lineTo(15,-20);ctx.lineTo(10,-15);ctx.lineTo(14,-12);ctx.lineTo(1,-14);ctx.closePath();
    ctx.fillStyle='#ffce53';ctx.fill();ctx.strokeStyle='#593a13';ctx.lineWidth=1.5;ctx.stroke();
  }else if(style==='drop'){
    ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-3,-6,-9,-12,-9,-17);ctx.arc(0,-17,9,Math.PI,0);ctx.bezierCurveTo(9,-11,3,-5,0,0);
    ctx.fillStyle='#ad381e';ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(0,-17,3,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();
  }else{
    line(()=>{ctx.moveTo(0,-18);ctx.lineTo(0,-1);ctx.moveTo(-4,-12);ctx.lineTo(4,-12);ctx.moveTo(-8,-8);ctx.quadraticCurveTo(-7,-3,0,-1);ctx.quadraticCurveTo(7,-3,8,-8);},'#08747b',3);
    ctx.beginPath();ctx.arc(0,-21,3,0,Math.PI*2);ctx.fillStyle='white';ctx.fill();ctx.strokeStyle='#075a61';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();
}
function loadCoast(){
  geography??=fetch('/assets/catch-coast.json').then(r=>{
    if(!r.ok)throw Error('Coastline unavailable');
    return r.json();
  }).catch(error=>{geography=null;throw error;});
  return geography;
}

export function mountCatchMap(element,{pins=[],value=null,onPick,onStyle,pinKind='chosen',pinStyle}={}){
  const editable=typeof onPick==='function';
  let chosenStyle=styleForPin(pinStyle,pinKind),legendKey='';
  let centre={...home},span=.53,data=null,ended=false,drag=null,focused=null,satellite=true,dialog=null,paintFrame=0;
  element.innerHTML='<div class="coast-view"><div class="coast-controls"><button type="button" data-map="in" aria-label="Zoom in">+</button><button type="button" data-map="out" aria-label="Zoom out">−</button><button type="button" data-map="home">Back to Straddie</button><button type="button" data-map="layer">Show coastline</button><button type="button" data-map="fullscreen" aria-pressed="false">Full screen</button></div>'+
    '<canvas class="catch-chart" tabindex="0" aria-label="Interactive catch map. Arrow keys move the map, plus and minus change zoom.'+(editable?' Press Enter to place your pin at the centre.':'')+'"></canvas>'+
    (editable && onStyle?'<fieldset class="coast-palette"><legend>Choose your pin symbol</legend>'+Object.entries(pinStyles).map(([style,label])=>'<button type="button" data-pin-style="'+style+'" aria-pressed="'+(chosenStyle===style)+'"><canvas data-swatch="'+style+'" aria-hidden="true" width="34" height="30"></canvas>'+label+'</button>').join('')+'</fieldset>':'')+
    '<div class="coast-legend" aria-label="Map symbols"></div>'+
    '<small data-map-hint aria-live="polite"></small><div class="coast-meta"><small data-map-layer></small><details class="coast-credit"><summary>Map credits</summary><p>Satellite image © Planet Labs Netherlands B.V., supplied through Queensland QSat. Imagery recorded in 2017 and cropped into local map tiles. <a href="/assets/straddie-satellite/CREDITS.txt" target="_blank" rel="noopener">Full credit, licence and acknowledgement</a>.</p><p>Coastline adapted from the <a href="https://www.data.qld.gov.au/dataset/coastline-queensland" target="_blank" rel="noopener">State of Queensland</a> (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>). World overview by <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>. Use a marine chart for navigation.</p></details></div></div>';
  const canvas=element.querySelector('canvas'),hint=element.querySelector('[data-map-hint]'),ctx=canvas.getContext('2d');
  const view=element.querySelector('.coast-view'),layerLabel=view.querySelector('[data-map-layer]'),fullButton=view.querySelector('[data-map="fullscreen"]'),layerButton=view.querySelector('[data-map="layer"]');
  const legend=view.querySelector('.coast-legend');
  function refreshLegend(){
    const symbols=editable?[chosenStyle]:pins.length?[...new Set(pins.map(p=>styleForPin(p.style,p.kind)))]:['float','anchor','flag'];
    const key=symbols.join(',');
    if(key===legendKey)return;
    legendKey=key;
    legend.innerHTML=symbols.map(style=>'<span><canvas data-marker="'+style+'" aria-hidden="true" width="34" height="30"></canvas>'+pinStyles[style]+(editable?' · selected':'')+'</span>').join('');
    for(const icon of legend.querySelectorAll('[data-marker]'))fishingMarker(icon.getContext('2d'),16,27,icon.dataset.marker);
  }
  for(const icon of view.querySelectorAll('[data-swatch]'))fishingMarker(icon.getContext('2d'),16,27,icon.dataset.swatch);
  for(const choice of view.querySelectorAll('[data-pin-style]'))choice.onclick=()=>{
    chosenStyle=choice.dataset.pinStyle;
    for(const button of view.querySelectorAll('[data-pin-style]'))button.setAttribute('aria-pressed',String(button===choice));
    onStyle(chosenStyle);refreshLegend();paint();
  };
  refreshLegend();
  let w=1,h=1,ratio=1;
  const cosine=()=>Math.max(.12,Math.cos(centre.lat*Math.PI/180));
  const x=lon=>(lon-centre.lon)*w/span+w/2;
  const y=lat=>(centre.lat-lat)*w/(span*cosine())+h/2;
  const point=(px,py)=>({lat:+clamp(centre.lat-(py-h/2)*span*cosine()/w,-90,90).toFixed(5),lon:+clamp(centre.lon+(px-w/2)*span/w,-180,180).toFixed(5)});
  function rings(shapes){
    ctx.beginPath();
    for(const ring of shapes){
      if(!ring.length)continue;
      ctx.moveTo(x(ring[0][0]),y(ring[0][1]));
      for(let j=1;j<ring.length;j++)ctx.lineTo(x(ring[j][0]),y(ring[j][1]));
      ctx.closePath();
    }
    ctx.fillStyle='#e0e8cc';ctx.strokeStyle='#759b84';ctx.lineWidth=1;ctx.fill('evenodd');ctx.stroke();
  }
  function marker(p,selected){
    if(!valid(p))return;
    const px=x(p.lon),py=y(p.lat);
    if(px < -14||px > w+14||py < -14||py > h+14)return;
    fishingMarker(ctx,px,py,styleForPin(p.style,p.kind),selected);
  }
  function paint(){
    if(ended || !ctx)return;
    const rect=canvas.getBoundingClientRect();
    w=Math.max(1,Math.round(rect.width));h=Math.max(1,Math.round(rect.height));ratio=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#cce7e8';ctx.fillRect(0,0,w,h);
    if(data){
      const [west,south,east,north]=data.bounds;
      if(x(west)>0||x(east)<w||y(north)>0||y(south)<h)rings(data.overview);
      if(x(east)>0&&x(west)<w&&y(south)>0&&y(north)<h){
        ctx.save();ctx.beginPath();ctx.rect(x(west),y(north),x(east)-x(west),y(south)-y(north));ctx.clip();
        ctx.fillStyle='#cce7e8';ctx.fillRect(0,0,w,h);rings(data.coast);ctx.restore();
      }
    }
    const caption=satellite?drawSatellite(ctx,x,y,w,h,span):'Coastline';
    if(layerLabel.textContent!==caption)layerLabel.textContent=caption;
    const imageVisible=caption.startsWith('Satellite ·');
    if(span<=1.8){ctx.font='600 12px system-ui';ctx.lineJoin='round';const occupied=[];
        for(const [name,lat,lon] of places){const px=x(lon),py=y(lat),tw=ctx.measureText(name).width;
          if(px<0||px+tw>w||py<13||py>h-2||occupied.some(a=>Math.abs(a.py-py)<15&&px<a.px+a.tw+4&&px+tw+4>a.px))continue;
          ctx.lineWidth=3;ctx.strokeStyle=imageVisible?'#19343a':'#f5faf3';ctx.strokeText(name,px,py);ctx.fillStyle=imageVisible?'white':'#184f50';ctx.fillText(name,px,py);occupied.push({px,py,tw});
        }
    }
    if(editable){ctx.beginPath();ctx.moveTo(w/2-6,h/2);ctx.lineTo(w/2+6,h/2);ctx.moveTo(w/2,h/2-6);ctx.lineTo(w/2,h/2+6);ctx.strokeStyle='white';ctx.lineWidth=3;ctx.stroke();ctx.strokeStyle='#304e52';ctx.lineWidth=1;ctx.stroke();}
    for(const p of pins)marker(p,p.id===focused);
    if(valid(value))marker({...value,style:chosenStyle},true);
  }
  function redraw(){if(!paintFrame)paintFrame=requestAnimationFrame(()=>{paintFrame=0;paint();});}
  function zoom(factor){span=clamp(span*factor,.007,360);paint();}
  function pick(p){if(!editable)return;value=p;onPick({...p});paint();}
  function focusPin(id){const p=pins.find(p=>p.id===id);if(!valid(p))return;centre={lat:p.lat,lon:p.lon};focused=id;span=Math.min(span,.24);hint.textContent=[p.label||'Selected catch',pinStyles[styleForPin(p.style,p.kind)],p.caption].filter(Boolean).join(' · ');paint();}
  canvas.onpointerdown=e=>{if(e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,centre:{...centre},moved:false};canvas.setPointerCapture(e.pointerId);};
  canvas.onpointermove=e=>{if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<5&&!drag.moved)return;drag.moved=true;
    centre={lat:clamp(drag.centre.lat+dy*span*Math.max(.12,Math.cos(drag.centre.lat*Math.PI/180))/w,-90,90),lon:clamp(drag.centre.lon-dx*span/w,-180,180)};paint();};
  canvas.onpointerup=e=>{if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;if(moved)return;
    const r=canvas.getBoundingClientRect(),px=e.clientX-r.left,py=e.clientY-r.top;
    if(editable)pick(point(px,py));else{const p=pins.find(p=>valid(p)&&Math.hypot(x(p.lon)-px,y(p.lat)-11-py)<17);if(p)focusPin(p.id);}};
  canvas.onpointercancel=()=>{drag=null;};
  canvas.onkeydown=e=>{
    const steps={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,.16],ArrowDown:[0,-.16]};
    if(steps[e.key]){e.preventDefault();const [dx,dy]=steps[e.key];centre={lon:clamp(centre.lon+span*dx,-180,180),lat:clamp(centre.lat+span*dy*cosine(),-90,90)};paint();}
    else if(['+','=','-','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter')pick(point(w/2,h/2));else zoom(e.key==='-'?1.6:1/1.6);}
  };
  element.querySelector('[data-map="in"]').onclick=()=>zoom(1/1.6);
  element.querySelector('[data-map="out"]').onclick=()=>zoom(1.6);
  element.querySelector('[data-map="home"]').onclick=()=>{centre={...home};span=.53;focused=null;paint();};
  layerButton.onclick=()=>{satellite=!satellite;layerButton.textContent=satellite?'Show coastline':'Show satellite';paint();};
  const full=()=>Boolean(dialog||document.fullscreenElement===view);
  function fullChanged(){
    if(ended)return;
    const active=full(),wasActive=fullButton.getAttribute('aria-pressed')==='true';
    fullButton.setAttribute('aria-pressed',String(active));fullButton.textContent=active?'Exit full screen':'Full screen';
    if(wasActive!==active)fullButton.focus({preventScroll:true});
    redraw();
  }
  function closeDialog(){
    if(!dialog)return;
    const old=dialog;dialog=null;
    element.append(view);if(old.open)old.close();old.remove();fullChanged();
  }
  fullButton.onclick=async()=>{
    if(dialog){closeDialog();return;}
    if(document.fullscreenElement===view){await document.exitFullscreen();return;}
    if(document.fullscreenEnabled&&view.requestFullscreen){
      try{await view.requestFullscreen();fullChanged();return;}catch{}
    }
    if(ended||!element.isConnected||dialog)return;
    dialog=document.createElement('dialog');dialog.className='coast-dialog';dialog.setAttribute('aria-label','Full screen catch map');
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
    document.body.append(dialog);dialog.append(view);dialog.showModal();fullChanged();
  };
  function escapeFull(e){
    if(e.key!=='Escape'||!full())return;
    e.preventDefault();
    if(dialog)closeDialog();
    else document.exitFullscreen().catch(()=>{});
  }
  view.addEventListener('keydown',escapeFull);
  document.addEventListener('fullscreenchange',fullChanged);
  const unsubscribe=subscribeSatellite(redraw);
  const observer=new ResizeObserver(paint);observer.observe(canvas);
  if(valid(value))centre={lat:value.lat,lon:value.lon};
  hint.textContent=editable?'Tap to place your pin, or drag to look around.':'Drag to look around. Tap a marker to find its catch or spot.';
  loadCoast().then(d=>{if(!ended){data=d;paint();}}).catch(()=>{if(!ended)hint.textContent='The coastline could not load. You can still use your coordinates.';});paint();
  return {destroy(){
    ended=true;observer.disconnect();unsubscribe();cancelAnimationFrame(paintFrame);
    document.removeEventListener('fullscreenchange',fullChanged);
    if(document.fullscreenElement===view)document.exitFullscreen().catch(()=>{});
    closeDialog();element.replaceChildren();
  },focusPin,setPins(list){pins=Array.isArray(list)?list:[];refreshLegend();paint();},setValue(p){value=valid(p)?p:null;if(value)centre={lat:p.lat,lon:p.lon};paint();}};
}
