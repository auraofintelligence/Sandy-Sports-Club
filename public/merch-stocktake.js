const printTitle='Sandy Sports Club merchandise stocktake';

export function setupMerchStocktake({api,esc,toast}){
  let request=null, sheet=null, previousTitle='',allowed=false;
  function clear(){
    request?.abort();request=null;
    if(sheet&&document.title===printTitle)document.title=previousTitle;
    sheet?.remove();sheet=null;
    document.body.classList.remove('printing-merch-count');
  }
  async function print(button){
    if(!allowed||request||location.hash!=='#stock')return;
    clear();
    const controller=new AbortController();request=controller;button.disabled=true;
    try{
      const options={signal:controller.signal,cache:'no-store'};
      const [{listings},{items}]=await Promise.all([api('/api/stock/shop/listings',options),api('/api/stock',options)]);
      if(controller.signal.aborted||!allowed||location.hash!=='#stock')return;
      const rows=listings.filter(p=>p.kind==='merchandise').flatMap(p=>{
        const variantIds=new Set(p.variants.map(v=>v.id));
        const legacy=items.filter(v=>v.productId===p.id&&!variantIds.has(v.id));
        const variants=p.variants.filter(v=>v.active||v.onHand>0);
        return [...legacy.map(v=>[p.name,v.label,'','']),
          ...variants.map(v=>[p.name,v.style||(!v.colour&&!v.size?v.label:''),v.colour,v.size])];
      });
      const perPage=8,pages=Math.ceil((rows.length+4)/perPage);
      const prepared=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',dateStyle:'long'}).format(new Date());
      sheet=document.createElement('article');sheet.id='merch-count-paper';
      for(let i=0;i<pages;i++){
        const page=document.createElement('section'),lines=[];
        for(let j=0;j<perPage;j++){
          const cells=rows[i*perPage+j]||['','','',''];
          lines.push('<tr>'+cells.map(value=>'<td>'+esc(value||'')+'</td>').join('')+'<td></td><td></td></tr>');
        }
        page.innerHTML='<img class="count-letterhead" src="/assets/sandy-original-logo.png" alt="Sandy Sports Club">'+
          '<header><h1>Merchandise stocktake</h1><p>Prepared '+esc(prepared)+' · Sheet '+(i+1)+' of '+pages+'</p></header>'+
          '<div class="count-write"><span>Storage location</span><span>Date counted</span></div>'+
          '<p>Count each item once. Use a separate row for each style, colour and size. Write 0 if you checked and found none. Leave unchecked items blank.</p>'+
          '<table><colgroup><col style="width:21%"><col style="width:20%"><col style="width:16%"><col style="width:10%"><col style="width:13%"><col style="width:20%"></colgroup><thead><tr><th>Item</th><th>Style or print</th><th>Colour</th><th>Size</th><th>Counted</th><th>Unit cost $<br>(if known)</th></tr></thead><tbody>'+lines.join('')+'</tbody></table>'+
          '<div class="count-write"><span>Counted by</span><span>Checked by</span></div>'+
          '<p>Give the completed sheet to the Treasurer. Add any new shirt options under Shop listings, then enter each verified quantity once in the stock book.</p>'+
          '<p class="count-foot">Sandy Sports Club | Minjerribah / North Stradbroke Island</p>';
        sheet.append(page);
      }
      document.body.append(sheet);
      await Promise.all([...sheet.querySelectorAll('img')].map(image=>image.decode()));
      if(controller.signal.aborted||!allowed||location.hash!=='#stock')return;
      previousTitle=document.title;document.title=printTitle;document.body.classList.add('printing-merch-count');
      window.print();
    }catch(error){if(!controller.signal.aborted){clear();toast(error.message||'The stocktake sheet could not open. Please try again.');}}
    finally{if(request===controller)request=null;button.disabled=false;}
  }
  document.addEventListener('click',event=>{const button=event.target.closest('[data-print-merch-stocktake]');if(button)print(button);});
  window.addEventListener('afterprint',clear);
  window.addEventListener('plfc:navigated',()=>{if(location.hash!=='#stock')clear();});
  window.addEventListener('plfc:session-changed',event=>{clear();allowed=event.detail?.canManageStock===true;});
  window.addEventListener('pagehide',clear);
}
