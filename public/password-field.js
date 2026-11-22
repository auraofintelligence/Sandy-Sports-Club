export function passwordField(name,label,newPassword=false){
  const id='club-password-'+name;
  return '<div class="club-password-field"><label for="'+id+'">'+label+'</label><div class="club-password-entry">'+
    '<input id="'+id+'" name="'+name+'" type="password" autocomplete="'+(newPassword?'new-password':'current-password')+'" maxlength="128" spellcheck="false" autocapitalize="none" required>'+
    '<button type="button" data-password-eye aria-controls="'+id+'" aria-pressed="false" aria-label="Show '+(name==='repeat'?'repeated password':'password')+'" title="Show password">'+
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="M3 3l18 18"/></svg></button></div></div>';
}

export function setupPasswordEyes(host){
  host.addEventListener('click',event=>{
    const button=event.target.closest('[data-password-eye]');
    if(!button)return;
    const field=button.parentElement.querySelector('input');
    const reveal=field.type==='password';
    field.type=reveal?'text':'password';
    button.setAttribute('aria-pressed',String(reveal));
    button.title=reveal?'Hide password':'Show password';
  });
}
