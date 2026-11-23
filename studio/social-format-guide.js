// Readable platform icons and true-proportion artwork examples for the Sandy Sports Social Studio.
export const PLATFORM_ICONS=Object.freeze({
  facebook:'f',instagram:'◎',youtube:'▶',tiktok:'♪',noticeboard:'▣'
});
export const PLATFORM_CLASSES=Object.freeze({
  facebook:'facebook',instagram:'instagram',youtube:'youtube',tiktok:'tiktok',noticeboard:'noticeboard'
});
export function renderDestinationChoices({destinations,selected,mode,prefix,esc}){
  return '<fieldset class="annual-destinations annual-destination-grid"><legend>'+
    (mode==='organic'?'📣 Organic destinations':'📣 Paid creative suggestions')+'</legend>'+
    destinations.map(c=>'<div class="annual-destination-choice">'+
      '<label><input type="checkbox" '+prefix+'="'+mode+'" value="'+esc(c.id)+'"'+(selected.includes(c.id)?' checked':'')+'>'+
      '<span class="annual-platform-icon annual-platform-'+c.id+'" aria-hidden="true">'+PLATFORM_ICONS[c.id]+'</span>'+
      '<span class="annual-platform-title">'+esc(c.label)+(c.status==='proposed'?' <small>Proposed</small>':'')+'</span></label>'+
      (c.id==='noticeboard'?'<a href="https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/" target="_blank" rel="noopener noreferrer">Open public SNN site</a>':'')+
      '</div>').join('')+'</fieldset>';
}
export function renderAssetGuide({presets,esc,version}){
  const groups=[
    {name:'Vertical 9:16',ratio:'9:16',icon:'📱',use:'Reels, Stories, Shorts, TikTok and portrait displays'},
    {name:'Portrait 4:5',ratio:'4:5',icon:'🖼️',use:'Feed images and many feed video crops'},
    {name:'Portrait 3:4',ratio:'3:4',icon:'📸',use:'Organic Instagram portrait photos'},
    {name:'Square 1:1',ratio:'1:1',icon:'▣',use:'Square photos and carousel cards'},
    {name:'Landscape 16:9',ratio:'16:9',icon:'🖥️',use:'YouTube landscape and TV-screen notices'}
  ];
  const shapes=groups.map(g=>{
    const [w,h]=g.ratio.split(':').map(Number);
    const related=presets.filter(p=>p.ratio===g.ratio);
    return '<article class="annual-format-card"><div class="annual-format-stage">'+
      '<div class="annual-format-frame" style="aspect-ratio:'+w+'/'+h+'"><span aria-hidden="true">'+g.icon+'</span>'+
      '<i class="annual-format-safe" aria-hidden="true"></i></div></div>'+
      '<h4>'+esc(g.name)+'</h4><p>'+esc(g.use)+'</p>'+
      '<small>'+esc(related.map(p=>p.width+' × '+p.height+' px').join(' · ')||'Export size depends on placement')+'</small></article>';
  }).join('');
  const rows=presets.map(a=>'<li><span aria-hidden="true">'+(a.media==='image'?'🖼️':'🎬')+'</span>'+
    '<div><strong>'+esc(a.label)+'</strong><small>'+a.width.toLocaleString('en-AU')+' × '+a.height.toLocaleString('en-AU')+
    ' px · '+esc(a.ratio)+' · '+esc(a.media==='both'?'Image or video':a.media)+'</small></div></li>').join('');
  return '<div class="annual-format-lead"><div class="annual-format-source" aria-hidden="true">🎨<strong>MASTER</strong></div>'+
    '<span>→</span><div><strong>One original asset, several purpose-made exports</strong>'+
    '<p>Choose a high-quality master. Create a fresh crop or edit for each placement, and inspect captions and safe zones before publication.</p></div></div>'+
    '<div class="annual-format-grid">'+shapes+'</div>'+
    '<details class="annual-format-sizes"><summary>See all '+presets.length+' master size examples</summary><ul>'+rows+'</ul></details>'+
    '<p class="annual-small">The rectangles above use actual aspect ratios, but are scaled for comparison. Listed pixel sizes are Sandy Sports production presets, not platform upload requirements. Reference edition '+esc(version)+'.</p>'+
    '<p><a href="https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/" target="_blank" rel="noopener noreferrer">📺 Explore the public Straddie Noticeboard Network</a> for web, TV and kiosk examples.</p>';
}
