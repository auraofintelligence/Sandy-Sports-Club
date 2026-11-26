// Pluggable alert mailer for owner notifications. Alerts never carry personal
// contact details; they carry a short summary and a link into the admin area.
// Providers (owner configures one; nothing is configured by default):
//  - SANDY_MAIL_PROVIDER=cloudflare with a send_email binding named SANDY_ALERT_EMAIL
//  - SANDY_MAIL_PROVIDER=resend with the secret SANDY_RESEND_API_KEY
// SANDY_MAIL_FROM is the verified sender. SANDY_ALERT_TO overrides the owner address.
export const DEFAULT_ALERT_TO='sbt4183@gmail.com';
export const alertTo=env=>env.SANDY_ALERT_TO||DEFAULT_ALERT_TO;
export function mailConfigured(env){
 if(!env.SANDY_MAIL_FROM)return false;
 if(env.SANDY_MAIL_PROVIDER==='cloudflare')return typeof env.SANDY_ALERT_EMAIL?.send==='function';
 if(env.SANDY_MAIL_PROVIDER==='resend')return typeof env.SANDY_RESEND_API_KEY==='string'&&env.SANDY_RESEND_API_KEY.length>10;
 return false;
}
const clean=s=>String(s).replace(/[\r\n]+/g,' ').slice(0,200);
export function mimeMessage({from,to,subject,text,messageId}){
 return ['From: Sandy Sports alerts <'+clean(from)+'>','To: '+clean(to),'Subject: '+clean(subject),'Message-ID: <'+clean(messageId)+'>',
  'MIME-Version: 1.0','Content-Type: text/plain; charset=utf-8','Content-Transfer-Encoding: 8bit','',text].join('\r\n');
}
export async function sendAlert(env,{subject,text}){
 if(!mailConfigured(env))return {state:'not_configured'};
 const from=env.SANDY_MAIL_FROM,to=alertTo(env);
 try{
  if(env.SANDY_MAIL_PROVIDER==='cloudflare'){
   const {EmailMessage}=await import('cloudflare:email');
   const messageId=crypto.randomUUID()+'@'+String(from).split('@')[1];
   await env.SANDY_ALERT_EMAIL.send(new EmailMessage(from,to,mimeMessage({from,to,subject,text,messageId})));
  }else{
   const r=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),
    headers:{Authorization:'Bearer '+env.SANDY_RESEND_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({from:'Sandy Sports alerts <'+from+'>',to:[to],subject:clean(subject),text})});
   if(!r.ok)return {state:'failed'};
  }
  return {state:'sent'};
 }catch{return {state:'failed'}}
}
