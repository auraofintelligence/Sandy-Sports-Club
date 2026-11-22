import {opportunities} from './grant-opportunities.mjs';
import {mountGrantResearch} from './grant-research.js?v=20261121-grant-wishes';
import {recommendedGrantsForWish} from './grant-wish-matches.js?v=20261121-practical-wishes';

const mounted = new WeakMap();
const params = ['q', 'category', 'status', 'level', 'sort'];
const rank = ['Open', 'Upcoming', 'Watch', 'Closed'];
const byName = (a, b) => a.localeCompare(b, 'en-AU', {sensitivity:'base'});
const brisbaneNow = () => new Date(Date.now() + 10 * 3600000).toISOString().slice(0,16);
const displayDate = new Intl.DateTimeFormat('en-AU', {day:'numeric',month:'short',year:'numeric',timeZone:'Australia/Brisbane'});
const dateLabel = day => displayDate.format(new Date(day + 'T12:00:00+10:00'));
const roundStatus = (record, now) => record.closing &&
  (record.closing < now.slice(0,10) || record.closingTime && record.closing + 'T' + record.closingTime <= now) ? 'Closed' : record.status;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function link(text, url) {
  const a = element('a', text);
  a.href = url;
  return a;
}
function detail(text, value) {
  const p = element('p');
  p.append(element('strong', text + ' '), value);
  return p;
}
const trackLabel = (grant,isTracked) => isTracked?.(grant) ? 'Open saved grant' : 'Track in the committee register';
function wishPanel(grant, getWishSuggestions, getWishIdeas, scopeReason, readOnly=false) {
  const panel=element('div','','gr-finder-wishes');
  if(scopeReason) panel.append(detail('Why this may fit',scopeReason));
  else {
    const matches=getWishSuggestions?.(grant)||[];
    if (matches.length) {
      panel.append(element('strong','Equipment wishes to consider'));
      const list=element('ul','','gr-wish-links');
      for(const {wish,reason} of matches.slice(0,3)){
        const item=element('li');
        item.append(element('strong',wish.name),element('span',reason));
        list.append(item);
      }
      panel.append(list);
    }
  }
  const ideas=getWishIdeas?.(grant)||[];
  if(ideas.length && !readOnly){
    const drafts=element('div','','gr-draft-ideas');
    drafts.append(element('strong','Equipment ideas for this grant'));
    for(const idea of ideas){
      const action=element('button','Draft a wish for '+idea.name,'text-link');
      action.type='button';
      action.dataset.grIdea=idea.name;
      drafts.append(action);
    }
    panel.append(drafts);
  }
  return panel;
}
function grantCard(grant, now, committee, isTracked,getWishSuggestions,getWishIdeas,scopeReason,readOnly=false) {
  const today = now.slice(0,10), status = roundStatus(grant, now);
  const card = element('details', '', 'gr-opportunity');
  const summary = element('summary');
  const statusLabel = status === 'Watch' ? 'Watch for a round' : status;
  const badge = element('span', statusLabel, 'gr-status gr-status-' + status.toLowerCase());
  const title = element('h3', grant.name);
  const intro = element('span', grant.funder + ' · ' + grant.level, 'gr-funder');
  const date = grant.closing
    ? (status === 'Closed' ? 'Closing date ' : 'Closes ') + dateLabel(grant.closing)
    : status === 'Upcoming' && grant.opens ? 'Advertised opening ' + dateLabel(grant.opens)
    : status === 'Upcoming' ? 'Dates to be confirmed' : status === 'Open' ? 'Check closing arrangements' : '';
  const meta = element('span', date, 'gr-deadline');
  card.dataset.grant = grant.name;
  summary.append(badge, title, intro, meta);
  const body = element('div', '', 'gr-opportunity-body');
  body.append(detail('Project category', grant.categories.join(' · ')), detail('Funding', grant.amount),
    detail('Club project idea', grant.fit), detail('Who can apply', grant.eligibility));
  if (grant.opens) body.append(detail('Advertised opening', dateLabel(grant.opens)));
  if (status === 'Upcoming' && grant.opens && grant.opens <= today) body.append(element('p','The advertised opening date has arrived. Check the funder for confirmation that applications are being accepted.'));
  if (grant.deadlineTime) body.append(detail('Closing time', grant.deadlineTime));
  if (grant.closing === today && status === 'Open') body.append(element('p', 'Closing date is today. Check the funder’s exact closing time before starting.'));
  body.append(element('p', 'Source checked ' + dateLabel(grant.checked) + '.', 'gr-source-date'));
  const links = element('div', '', 'gr-actions');
  links.append(link('Visit the official funding page', grant.url));
  if (grant.guidelines) links.append(link('Read the round guidelines',grant.guidelines));
  if (grant.precedent) links.append(link('See a previously funded project',grant.precedent));
  if (grant.applicationUrl && status === 'Open') links.append(link('Open the funder’s application page',grant.applicationUrl));
  if (committee && !readOnly) {
    const track = element('button',trackLabel(grant,isTracked),'text-link');
    track.type = 'button';
    track.dataset.track = grant.name;
    links.append(track);
  } else if (!committee) links.append(link('Track in the committee register', '/clubhouse.html?grant=' + encodeURIComponent(grant.name) + '#committee/grants'));
  body.append(links);
  if(committee)body.append(wishPanel(grant,getWishSuggestions,getWishIdeas,scopeReason,readOnly));
  card.append(summary, body);
  return card;
}

export function mountGrantFinder(container, {onTrack,isTracked,getWishSuggestions,getWishIdeas,focusWish,readOnly=false,signal}={}) {
  mounted.get(container)?.();
  if (signal?.aborted) return () => {};
  const committee = typeof onTrack === 'function';
  const prefix = committee ? 'committee-' : '';
  const controller = new AbortController();
  const listen = {signal:controller.signal};
  let refreshTimer;
  const cleanup = () => {
    controller.abort();
    clearTimeout(refreshTimer);
    signal?.removeEventListener('abort',cleanup);
    if (mounted.get(container) === cleanup) {
      mounted.delete(container);
      container.replaceChildren();
    }
  };
  mounted.set(container,cleanup);
  signal?.addEventListener('abort',cleanup,{once:true});
  container.innerHTML = `<h2 id="${prefix}finder-title" class="gr-finder-title">Funding finder</h2>
    <p>Pick a project or search for an idea. Open a grant to see who can apply, how it might help the club and where to check the rules.</p>
    <form id="${prefix}grant-filters" class="gr-filters" role="search" aria-label="Search grants">
      <label class="gr-search">Search grants<input type="search" name="q" placeholder="Try junior sport or equipment" maxlength="160"></label>
      <label>Project category<select name="category"><option value="">All projects</option></select></label>
      <label>Round status<select name="status"><option value="">All rounds</option><option value="Open">Open</option><option value="Upcoming">Upcoming</option><option value="Watch">Watch for a round</option><option value="Closed">Closed</option></select></label>
      <label>Funding source<select name="level"><option value="">All funders</option></select></label>
      <label>Sort by<select name="sort"><option value="fit">Best fit for the club</option><option value="next">Next closing date</option><option value="status">Round status</option><option value="name">Grant name (A to Z)</option><option value="funder">Funder (A to Z)</option><option value="checked">Recently checked</option></select></label>
      <button type="reset" class="text-link">Clear filters</button>
    </form>
    <p id="${prefix}grant-edition" class="gr-edition"></p><p id="${prefix}grant-count" class="gr-count" role="status" aria-live="polite" aria-atomic="true"></p>
    <div id="${prefix}grant-results" class="gr-results"></div>`;
  const form = container.querySelector('.gr-filters');
  const wish=committee?focusWish:null;
  let suggestionMode=Boolean(wish);
  if(wish){
    const context=element('div','','gr-wish-context');
    context.append(element('strong','Funding for '+wish.name));
    context.append(element('p','Open a round to see why it may fit. When you save a grant, this wish will be ticked for you.'));
    const choices=element('label');
    const limit=document.createElement('input');limit.type='checkbox';limit.checked=true;
    choices.append(limit,'Show suggested rounds only');
    context.append(choices,link('Back to this wish','/clubhouse.html?wish='+encodeURIComponent(wish.id)+'#committee/equipment'));
    form.before(context);
    limit.addEventListener('change',()=>{suggestionMode=limit.checked;render();},listen);
  }
  const list = container.querySelector('.gr-results');
  const count = container.querySelector('.gr-count');
  const expandedKey = committee ? 'committeeOpenGrants' : 'publicOpenGrants';
  let expanded = new Set(history.state?.[expandedKey] || []);
  let rendered = '';
  function choices(name, values) {
    for (const value of [...new Set(values)].sort(byName)) form.elements[name].add(new Option(value, value));
  }
  choices('category', opportunities.flatMap(grant => grant.categories));
  choices('level', opportunities.map(grant => grant.level));

  function readFilters() {
    const saved=history.state;
    const sameWish=(saved?.committeeGrantWish||null)===(wish?.id||null);
    const savedFilters=sameWish?saved?.committeeGrantFilters:'';
    const fromUrl = new URLSearchParams(committee ? savedFilters : location.search);
    for (const key of params) {
      const field = form.elements[key];
      if (key === 'q') field.value = '';
      else field.selectedIndex = 0;
      const value = fromUrl.get(key);
      if (!value) continue;
      if (key === 'q') field.value = value.slice(0, 160);
      else if ([...field.options].some(option => option.value === value)) field.value = value;
    }
  }
  function updateUrl() {
    const url = new URL(location.href);
    const search = committee ? new URLSearchParams() : url.searchParams;
    for (const key of params) {
      const value = form.elements[key].value.trim();
      if (value && !(key === 'sort' && value === 'fit')) search.set(key, value);
      else search.delete(key);
    }
    if (committee) history.replaceState({...history.state,committeeGrantFilters:search.toString(),committeeGrantWish:wish?.id||null},'');
    else history.replaceState(history.state, '', url);
  }

  function render() {
    const now = brisbaneNow();
    const reasons=new Map((wish?recommendedGrantsForWish(wish,now):[]).map(({grant,reason})=>[grant.name,reason]));
    const {q, category, status, level, sort} = Object.fromEntries(new FormData(form));
    const words = q.toLocaleLowerCase('en-AU').trim().split(/\s+/).filter(Boolean);
    const rows = opportunities.filter(grant => {
      if(suggestionMode && !reasons.has(grant.name))return false;
      if (category && !grant.categories.includes(category) || status && roundStatus(grant, now) !== status || level && grant.level !== level) return false;
      const searchable = [grant.name, grant.funder, grant.level, ...grant.categories, grant.fit, grant.eligibility, grant.amount].join(' ').toLocaleLowerCase('en-AU');
      return words.every(word => searchable.includes(word));
    });
    const order = grant => rank.indexOf(roundStatus(grant, now));
    rows.sort((a,b) => {
      let first = 0;
      if (sort === 'fit') {
        return Number(order(a) === 3) - Number(order(b) === 3) || (a.priority ?? 2) - (b.priority ?? 2) || order(a) - order(b);
      } else if (sort === 'next') {
        const due = grant => roundStatus(grant,now) === 'Closed' ? '9999-99-99' : grant.closing || '9999-01-01';
        first = byName(due(a), due(b)) || order(a) - order(b);
      } else if (sort === 'status') first = order(a) - order(b);
      else if (sort === 'funder') first = byName(a.funder, b.funder);
      else if (sort === 'checked') first = byName(b.checked, a.checked);
      return first || byName(a.name, b.name);
    });
    const signature = JSON.stringify([now.slice(0,10),suggestionMode,rows.map(grant=>[grant.name,roundStatus(grant,now)])]);
    if (signature !== rendered) {
      rendered = signature;
      count.textContent = rows.length + ' of ' + opportunities.length + ' funding opportunities';
      list.replaceChildren(...rows.map(grant => {
        const card = grantCard(grant,now,committee,isTracked,getWishSuggestions,getWishIdeas,reasons.get(grant.name),readOnly);
        card.open = expanded.has(grant.name);
        return card;
      }));
      if (!rows.length) list.append(element('p',suggestionMode?'No suggested rounds match these choices. Untick “Show suggested rounds only” to browse more funding.':'No grants match those choices. Clear the filters or try a broader word such as “community”.'));
    }
    const tomorrow = Date.parse(now.slice(0,10) + 'T00:00:00+10:00') + 86400000;
    const closingsToday = opportunities.filter(grant=>grant.closing === now.slice(0,10) && grant.closingTime)
      .map(grant=>Date.parse(grant.closing+'T'+grant.closingTime+':00+10:00')).filter(stamp=>stamp>Date.now());
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(render, Math.max(100,Math.min(tomorrow,...closingsToday)-Date.now()+50));
  }

  readFilters();
  render();
  const latestCheck = opportunities.map(grant => grant.checked).sort().at(-1);
  if (latestCheck) container.querySelector('.gr-edition').textContent = 'Last research update ' + dateLabel(latestCheck) + '. Round status reflects the funder’s information when checked. Confirm current dates and eligibility on its website.';
  form.addEventListener('submit',event => event.preventDefault(),listen);
  form.addEventListener('input',() => {updateUrl();render();},listen);
  list.addEventListener('toggle',event => {
    const card = event.target;
    if (!card.dataset.grant || expanded.has(card.dataset.grant) === card.open) return;
    if (card.open) expanded.add(card.dataset.grant);
    else expanded.delete(card.dataset.grant);
    history.replaceState({...history.state,[expandedKey]:[...expanded]},'');
  },{...listen,capture:true});
  form.addEventListener('reset',event => {
    event.preventDefault();
    for (const field of params) {
      if (field === 'q') form.elements.q.value = '';
      else form.elements[field].selectedIndex = 0;
    }
    updateUrl();
    render();
    form.elements.q.focus();
  },listen);
  window.addEventListener('popstate',() => {
    expanded = new Set(history.state?.[expandedKey] || []);
    rendered = '';
    readFilters();
    render();
  },listen);
  document.addEventListener('visibilitychange',() => {if (!document.hidden) render();},listen);
  if (committee) {
    container.addEventListener('plfc:grant-register-updated',() => {
      const today=brisbaneNow();
      const reasons=new Map((wish?recommendedGrantsForWish(wish,today):[]).map(({grant,reason})=>[grant.name,reason]));
      for (const button of list.querySelectorAll('button[data-track]')) {
        const grant = opportunities.find(item=>item.name===button.dataset.track);
        button.textContent = trackLabel(grant,isTracked);
        const panel=button.closest('.gr-opportunity-body').querySelector('.gr-finder-wishes');
        panel.replaceWith(wishPanel(grant,getWishSuggestions,getWishIdeas,reasons.get(grant.name),readOnly));
      }
    },listen);
    list.addEventListener('click',event => {
      if (readOnly) return;
      const button = event.target.closest('button[data-track]');
      if (button) onTrack(opportunities.find(grant => grant.name === button.dataset.track),button);
      const draft=event.target.closest('button[data-gr-idea]');
      if(draft){
        const grant=opportunities.find(item=>item.name===draft.closest('[data-grant]').dataset.grant);
        const idea=getWishIdeas?.(grant)?.find(item=>item.name===draft.dataset.grIdea);
        if(idea)onTrack(grant,draft,idea);
      }
    },listen);
    const research = element('div');
    container.append(research);
    mountGrantResearch(research,{committee:true,wish,signal:controller.signal});
  }
  return cleanup;
}
