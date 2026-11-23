// Authenticated per-day content responsibility, visible only in the committee planner.
// Display the office first; generic committee accounts also show their account label.
export function signatureOfficer(signature,kind='prepared'){
  if(!signature||typeof signature!=='object')return '';
  const office=signature[kind+'Office']||'';
  const by=signature[kind+'By']||'';
  if(office==='Committee member'&&by&&by!=='Committee officer')return office+' · '+by;
  return office||by;
}
export function signatureDate(value){
  if(!value||Number.isNaN(Date.parse(value)))return '';
  return new Intl.DateTimeFormat('en-AU',{
    timeZone:'Australia/Brisbane',day:'numeric',month:'short',year:'numeric',
    hour:'numeric',minute:'2-digit'
  }).format(new Date(value));
}
export function renderDaySignature(signature,esc,compact=false){
  if(!signature)return compact?'':'<p class="annual-day-unsigned">No office holder has signed this day yet. Saving a day records the signed-in officer.</p>';
  const original=signatureOfficer(signature,'prepared');
  const edited=signatureOfficer(signature,'edited');
  const changed=signature.editedAt&&signature.editedAt!==signature.preparedAt;
  const detail=changed?'Last edited by '+edited+' · '+signatureDate(signature.editedAt):
    'Saved '+signatureDate(signature.preparedAt);
  if(compact)return '<span class="annual-owner-inline" title="'+esc('Prepared by '+original+'; '+detail)+'">'+
    '✍ '+esc(original)+'</span>';
  return '<aside class="annual-day-signature" aria-label="Officer responsible for these content plans">'+
    '<strong>✍ Prepared by '+esc(original)+'</strong>'+
    '<span>'+esc(detail)+'</span>'+
    '<small>Speak with this office holder before changing the content or its planned date.</small></aside>';
}
