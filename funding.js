const byId=id=>document.getElementById(id),inputs=['gift-count','gift-value','sponsor-count','sponsor-value','grant-value'],money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n);
function update(){const [gc,gv,sc,sv,grant]=inputs.map(id=>Math.max(0,Math.min(1000000,Number(byId(id).value)||0))),gifts=gc*gv,sponsors=sc*sv,total=gifts+sponsors+grant,pct=Math.min(100,total/50000*100);
  byId('funding-total').firstChild.textContent=money(total)+' ';byId('funding-bar').style.width=pct+'%';
  byId('funding-progress').setAttribute('aria-valuenow',String(Math.min(50000,total)));
  byId('funding-percent').textContent=`${Math.round(pct)}% of the example target. These are scenario inputs, not donations received.`;
  byId('funding-mix').textContent=`${money(gifts)} community gifts + ${money(sponsors)} sponsorship + ${money(grant)} grant scenario`;
  byId('funding-remaining').textContent=total>=50000?`Example exceeds target by ${money(total-50000)}.`:`${money(50000-total)} remains in this example.`;
}
inputs.forEach(id=>byId(id)?.addEventListener('input',update));
byId('reset-funding')?.addEventListener('click',()=>{[40,100,4,5000,15000].forEach((v,i)=>byId(inputs[i]).value=v);update()});update();

