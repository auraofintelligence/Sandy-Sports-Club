import {fail,json,dbFor,requireRole} from './shared.mjs';
import {memberPublicationAllowed,visibleRecords} from './record-policy.mjs';
export async function memberEndpoint(req,env,path,identity){
 requireRole(identity,['member','webmaster','president','secretary']);
 if(req.method!=='GET')fail(405,'Member details are read-only until the club is established.','method_not_allowed');
 const db=dbFor(env);
 if(path==='/api/member/me'){
  let profile=null;
  if(identity.role==='member'){
   const p=await db.prepare('SELECT id,full_name,preferred_name,membership_class,status,joined_on,renewal_on,town,consent_contact,consent_publication FROM club_people WHERE account_id=? LIMIT 1').bind(identity.id).first();
   if(p)profile={id:p.id,name:p.full_name,preferredName:p.preferred_name,membershipClass:p.membership_class,status:p.status,
    joinedOn:p.joined_on,renewalOn:p.renewal_on,town:p.town,contactConsent:!!p.consent_contact,publicationConsent:!!p.consent_publication};
  }
  return json({identity:{name:identity.name,role:identity.role,office:identity.office_label},
   clubEstablished:env.SANDY_CLUB_APPROVALS==='enabled',profile,
   notice:profile?'Your own recorded profile; no payment or current club status is implied.':
   'No current membership profile is linked to this account. The club is still a proposal.'});
 }
 if(path==='/api/member/events'){
  const active=env.SANDY_CLUB_APPROVALS==='enabled'&&(identity.role!=='member'||Boolean(await db.prepare("SELECT id FROM club_people WHERE account_id=? AND status='active' LIMIT 1").bind(identity.id).first()));
  const rows=active?await visibleRecords(db,"WHERE kind='event' AND status='approved' AND event_date>=date('now','+10 hours')",[],'event_date,id',35,memberPublicationAllowed):[];
  return json({events:rows.map(r=>({id:r.id,title:r.title,date:r.event_date,status:r.status})),
   notice:'Only explicitly approved events are visible here. No proposals or tentative dates are promoted.'});
 }
 fail(404,'That member service does not exist.','not_found');
}
