// Renders the Schedule of officer access (studio/sandy-access.js) as a table and as Markdown,
// so the constitution page, the draft text and the committee room all show the same rules the site enforces.
import {OFFICES,DEPUTIES,ACCESS_GROUPS,ACCESS_SCHEDULE} from './studio/sandy-access.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLS=['webmaster','president','vice_president','secretary','assistant_secretary','treasurer','committee'];
export function accessTableHtml(){
 return '<div class="table-scroll"><table class="club-table access-table"><thead><tr><th>Function</th>'+COLS.map(r=>'<th>'+esc(OFFICES[r])+'</th>').join('')+'</tr></thead><tbody>'+
  ACCESS_SCHEDULE.map(s=>'<tr><td><strong>'+esc(s.title)+'</strong><br><span>'+esc(s.does)+'</span></td>'+COLS.map(r=>'<td class="access-cell">'+(ACCESS_GROUPS[s.group].includes(r)?'<span aria-label="Yes">✓</span>':'<span class="access-no" aria-label="No">·</span>')+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div><p class="access-note">The Vice President holds the same access as the President, and the Assistant Secretary the same as the Secretary. Members, guardians and sponsors only see their own records.</p>';
}
export function accessMarkdown(){
 const head='| Function | '+COLS.map(r=>OFFICES[r]).join(' | ')+' |\n|---|'+COLS.map(()=>'---').join('|')+'|';
 const rows=ACCESS_SCHEDULE.map(s=>'| **'+s.title+'**: '+s.does+' | '+COLS.map(r=>ACCESS_GROUPS[s.group].includes(r)?'Yes':'No').join(' | ')+' |').join('\n');
 const deputies=Object.entries(DEPUTIES).map(([o,d])=>OFFICES[d]+' as '+OFFICES[o]).join('; ');
 return head+'\n'+rows+'\n\nDeputies hold the same access as the office they deputise for: '+deputies+'.';
}
export function renderAccessSchedule(el){if(el)el.innerHTML=accessTableHtml()}
