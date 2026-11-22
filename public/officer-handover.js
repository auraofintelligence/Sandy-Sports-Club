import {officeGuides as offices} from './officer-duties.js?v=20261121-welcome-back';
const stock='#stock';

export function setupOfficerHandover() {
  const mount = document.getElementById('officer-handover');
  if (!mount) return;
  let session = {}, choice = '';
  function paint() {
    mount.replaceChildren();
    if (location.hash !== '#committee/handover' || session.role !== 'committee') return;
    const selected = offices[choice] ?? offices.secretary;
    mount.innerHTML = `<h1 class="page-title">Office guides and handover</h1>
      <p class="page-intro">${session.demo || session.readOnly || session.showcase ? 'Preview the five office guides. The office account slots have no active invitations yet.' : 'Choose an office. Sit with the incoming officer and open each job together.'}</p>
      <label class="handover-select">Club office<select>${Object.entries(offices).map(([key, office]) => '<option value="'+key+'"'+(office===selected?' selected':'')+'>'+office.name+'</option>').join('')}</select></label>
      <article class="panel"><h2>${selected.name}</h2><ol class="handover-jobs">${selected.tasks.map(([label, tip, path]) => '<li><strong>'+label+'</strong><p>'+tip+'</p>'+(path.startsWith(stock) && !session.canManageStock ? '<small>The Treasurer can open this at the stock desk.</small>' : '<a class="text-link" href="'+path+'">'+label+'</a>')+'</li>').join('')}</ol>
      <h3>Before handing over</h3><p>${selected.handover}</p></article>`;
    mount.querySelector('select').onchange = event => { choice = event.target.value; paint(); mount.querySelector('select').focus(); };
  }
  window.addEventListener('plfc:session-changed', event => {
    session = event.detail || {};
    choice = Object.hasOwn(offices,session.identity?.name) ? session.identity.name : 'secretary';
    paint();
  });
  window.addEventListener('plfc:navigated', paint);
}
