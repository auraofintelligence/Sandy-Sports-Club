import {withDeputies} from './studio/sandy-access.js';
// Officer-only (Webmaster, Secretary) view of the anonymous sports interest survey:
// tallies by sport and goal, plus a CSV export. The survey stores no names or emails.
export const mayReviewSurvey=role=>withDeputies(['webmaster','secretary']).includes(role);
const $=id=>document.getElementById(id);
export async function loadSurvey({api,esc}){
 const t=await api('/api/committee/survey');
 const goalKeys=Object.keys(t.goals||{});
 $('survey-admin-state').textContent=(t.open?'The public survey is on.':'The public survey is switched off; sports.html shows "Survey opening soon".')+(t.migrationNeeded?' The survey tables have not been created yet (migration 0004 is not applied).':'')+' Responses so far: '+(t.total||0)+'.';
 $('survey-goal-head').innerHTML='<th>Sport</th><th>Chosen</th><th>First choice</th><th>Average priority</th>'+goalKeys.map(k=>'<th>'+esc(t.goals[k])+'</th>').join('');
 $('survey-rows').innerHTML=(t.bySport||[]).map(s=>'<tr><td>'+esc(s.sport)+'</td><td>'+esc(s.chosen)+'</td><td>'+esc(s.firstChoice)+'</td><td>'+esc(s.averageRank==null?'None yet':Number(s.averageRank).toFixed(1))+'</td>'+goalKeys.map(k=>'<td>'+esc(s.goals?.[k]||0)+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="7">No answers yet.</td></tr>';
 const list=(rows)=>(rows||[]).map(r=>esc(r.label??r.value??r.name)+': '+esc(r.count)).join(', ')||'None yet';
 $('survey-extra').innerHTML='<li>Age groups: '+list(t.ageGroups)+'</li><li>Towns: '+list(t.towns)+'</li><li>How often: '+list(t.frequencies)+'</li>';
}
