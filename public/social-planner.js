import {socialChannels} from './social-channels.js';
import {setupBrainstorm, starterBrowser, chosenStarter, updateStarterCard, practiceGuide, contributorName} from './social-brainstorm.js?v=20261121-club-funding';

const endpoint = '/api/committee/social-planner';
const statuses = {idea: 'Idea', draft: 'Draft', ready: 'Ready to post', published: 'Published'};
const formatMonth = new Intl.DateTimeFormat('en-AU', {month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane'});
const formatDay = new Intl.DateTimeFormat('en-AU', {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane'});
const formatUpdate = new Intl.DateTimeFormat('en-AU', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane'});
const localDate = day => new Date(day + 'T12:00:00+10:00');
const example = {
  title: 'A welcoming Sandy Sports session',
  body: 'What would help at your first local sand sport session? Tell us one thing that makes it easy to join in, whether that is meeting a teammate, learning a rule or knowing which equipment to bring.'
};

export function setupSocialPlanner({api, esc}) {
  const mount = document.getElementById('social-planner-desk');
  if (!mount) return;
  let session, desk, draft, initial, request, parked, fromBrain = false;
  const active = () => session?.authenticated && session.role === 'committee' && location.hash === '#committee/social';
  const readOnly = () => Boolean(session?.readOnly || session?.showcase || session?.demo);
  const find = selector => mount.querySelector(selector);
  const dirty = () => draft && JSON.stringify(draft) !== initial;
  const brain = setupBrainstorm({mount, api, esc, active,
    back() {render(); load(desk.month);},
    openPlan(id) {fromBrain = true; render(); load(desk.month, id);},
    useSeparately(idea) {fromBrain = false; editStarter(idea);}
  });

  function reset() {
    request?.abort();
    brain.close();
    fromBrain = false;
    request = desk = draft = initial = null;
    mount.removeAttribute('aria-busy');
    mount.replaceChildren();
  }
  function announce(message, error = false) {
    const region = find('[data-social-notice]');
    if (region) {
      region.setAttribute('role', error ? 'alert' : 'status');
      region.textContent = message;
    }
  }
  function labelChannels(plan) {
    return socialChannels.filter(c => plan.channels.includes(c.id)).map(c => c.label).join(', ') || 'Channels to choose';
  }
  function row(plan) {
    const date = plan.plannedDate ? '<time datetime="' + esc(plan.plannedDate) + '">' + esc(formatDay.format(localDate(plan.plannedDate))) + '</time>' : '';
    const links = socialChannels.filter(c => plan.channels.includes(c.id) && plan.links[c.id]?.startsWith('https://')).map(c => '<a href="' + esc(plan.links[c.id]) + '" target="_blank" rel="noopener noreferrer">View on ' + esc(c.label) + '<span class="sr-only"> in a new tab</span></a>');
    return '<li class="social-plan-row">' + date + '<div><button type="button" class="social-open" data-social-open="' + esc(plan.id) + '">' + esc(plan.title) + '</button><small>' + esc(labelChannels(plan)) + '</small>' + (links.length ? '<div class="social-published-links">' + links.join('') + '</div>' : '') + '</div><span class="social-status" data-state="' + esc(plan.status) + '">' + esc(statuses[plan.status]) + '</span></li>';
  }
  function list() {
    const dated = desk.plans.filter(p => p.plannedDate);
    const undated = desk.plans.filter(p => !p.plannedDate);
    return '<header class="social-heading"><div><h1>Social media planner</h1><p>Plan the club’s posts together. When a post is ready, an officer shares it on the club’s social account.</p></div><div class="social-tools"><button type="button" class="button" data-social-new>Plan a post</button><button type="button" class="button outline" data-social-brainstorm>Brainstorm together</button></div></header>' +
      (!socialChannels.length?'<p class="social-help">Sandy Sports has no confirmed social accounts linked yet. Plans can stay as ideas until the club sets them up.</p>':'') + starterBrowser(esc) +
      '<form class="social-month" data-social-month-form><label>Planning month<input type="month" data-social-month name="month" value="' + esc(desk.month) + '" required></label><button class="button outline small" type="submit">Show month</button></form>' +
      '<section class="social-plan-group"><h2>' + esc(formatMonth.format(localDate(desk.month + '-01'))) + '</h2>' +
      (dated.length ? '<ul class="social-plan-list">' + dated.map(row).join('') + '</ul>' : '<p>No posts are planned for this month.</p>') + '</section>' +
      '<section class="social-plan-group"><h2>Without a date</h2>' +
      (undated.length ? '<ul class="social-plan-list undated">' + undated.map(row).join('') + '</ul>' : '<p>Ideas saved without a date will appear here.</p>') + '</section>' +
      practiceGuide(esc) + '<details class="social-help"><summary>How publishing works</summary><p>The planner keeps the committee’s wording, dates and links together. An officer signs in to each club social account to publish. You can use the planner without connecting an account.</p><p>Automatic posting would need the club to authorise a connection to each platform and grant permission to publish. Saving a plan here keeps it in the committee room.</p></details>';
  }
  function handover() {
    return '<details class="social-handover"' + (['ready','published'].includes(draft.status) ? ' open' : '') + '><summary>Share on the club accounts</summary>' +
      '<p>Copy your wording, open each club account and publish there. Once the post is live on all your chosen channels, return here and select Published.</p>' +
      '<button type="button" class="button outline small" data-social-copy>Copy post wording</button>' +
      '<div data-social-profile-links>' + socialChannels.map(c => '<a class="text-link" data-social-profile="' + c.id + '" href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer"' + (draft.channels.includes(c.id) ? '' : ' hidden') + '>Open club ' + esc(c.label) + '<span class="sr-only"> in a new tab</span></a>').join('') + '</div>' +
      '<p data-social-profile-hint' + (draft.channels.length ? ' hidden' : '') + '>Choose a channel above to find its club account.</p>' +
      '<div class="social-link-inputs">' + socialChannels.map(c => '<label data-social-link="' + c.id + '"' + (draft.channels.includes(c.id) ? '' : ' hidden') + '>Link to the published ' + esc(c.label) + ' post <small>(optional)</small><input name="link_' + c.id + '" type="url" inputmode="url" placeholder="https://" value="' + esc(draft.links[c.id] || '') + '"' + (draft.channels.includes(c.id) ? '' : ' disabled') + '></label>').join('') + '</div></details>';
  }
  function emptyIdea() {
    return draft && !draft.version && !draft.title && !draft.body && !draft.plannedDate && draft.status === 'idea' && !draft.channels.length && !Object.values(draft.links).some(Boolean);
  }
  function editor() {
    const stored = desk.plans.find(p => p.id === draft.id);
    let lastEdit = '';
    if (stored?.updatedBy && !Number.isNaN(Date.parse(stored.updatedAt))) {
      lastEdit = '<p class="social-byline">Last saved by ' + esc(contributorName(stored.updatedBy)) + ' on ' + esc(formatUpdate.format(new Date(stored.updatedAt))) + '.</p>';
    }
    return '<header class="social-heading"><div><h1>' + (draft.version ? 'Edit post plan' : 'Plan a post') + '</h1>' + lastEdit + '</div></header>' +
      '<form class="social-editor" data-social-editor>' + (!draft.version ? '<button type="button" class="social-example" data-social-example' + (emptyIdea() ? '' : ' hidden') + '>Use an example</button>' : '') +
      '<label>Working title<input required maxlength="140" name="title" value="' + esc(draft.title) + '" placeholder="For example, Sunday’s local meet"></label>' +
      '<div class="social-pair"><label>Planned date <small>(optional)</small><input type="date" name="plannedDate" value="' + esc(draft.plannedDate) + '"><small>Brisbane time</small></label>' +
      '<label>Progress<select name="status">' + Object.entries(statuses).map(([value, label]) => '<option value="' + value + '"' + (draft.status === value ? ' selected' : '') + '>' + label + '</option>').join('') + '</select></label></div>' +
      '<fieldset><legend>Where will it go?</legend><div class="social-channels">' + socialChannels.map(c => '<label><input type="checkbox" name="channel" value="' + c.id + '"' + (draft.channels.includes(c.id) ? ' checked' : '') + '>' + esc(c.label) + '</label>').join('') + '</div></fieldset>' +
      '<label>Post wording<textarea name="body" rows="5" maxlength="6000" placeholder="Write the caption or the words that will go with the photo or video.">' + esc(draft.body) + '</textarea></label>' +
      handover() + practiceGuide(esc, draft.channels) + '<div class="social-editor-actions"><button type="submit" class="button" data-social-save>Save plan</button><button type="button" class="button outline" data-social-cancel>' + (fromBrain ? 'Back to brainstorming' : 'Back to plan') + '</button></div></form>';
  }
  function render() {
    mount.innerHTML = (draft ? editor() : list()) + '<p class="social-notice" data-social-notice role="status" aria-live="polite"></p><button type="button" class="button outline small" data-social-reload hidden>Open saved version</button>';
    if(readOnly()) {
      mount.querySelectorAll('[data-social-editor] input,[data-social-editor] textarea,[data-social-editor] select,[data-social-editor] button').forEach(control=>control.disabled=true);
      mount.querySelector('[data-social-editor]')?.insertAdjacentHTML('afterbegin','<p>View-only officer preview. Return to the Webmaster workspace to edit a plan.</p>');
    }
  }
  function readForm() {
    const form = find('[data-social-editor]');
    if (!form || !draft) return;
    for (const field of ['title','plannedDate','status','body']) draft[field] = form.elements[field].value;
    draft.channels = [...form.querySelectorAll('[name="channel"]:checked')].map(input => input.value);
    draft.links = Object.fromEntries(socialChannels.map(c => [c.id, form.elements['link_' + c.id].value]));
    const suggestion = find('[data-social-example]');
    if (suggestion) suggestion.hidden = !emptyIdea();
  }
  function edit(plan) {
    draft = plan ? {id: plan.id, version: plan.version, title: plan.title, plannedDate: plan.plannedDate, status: plan.status, body: plan.body, channels: [...plan.channels], links: {...plan.links}}
      : {id: crypto.randomUUID(), version: 0, title: '', plannedDate: '', status: 'idea', body: '', channels: [], links: {}};
    render();
    readForm();
    initial = JSON.stringify(draft);
    find('[name="title"]').focus();
  }
  function editStarter(starter) {
    if (!starter) return;
    edit(null);
    const form = find('[data-social-editor]');
    form.elements.title.value = starter.title;
    form.elements.body.value = starter.body;
    for (const input of form.querySelectorAll('[name="channel"]')) input.checked = starter.channels.includes(input.value);
    readForm(); updateChannels();
    announce(starter.body.includes('[') ? 'Replace the words in square brackets with confirmed club details, then save your idea.' : 'This idea is yours to edit. Choose Save plan to keep it.');
  }
  async function load(month = '', reopenId = '') {
    if (!active()) return;
    request?.abort();
    const controller = new AbortController();
    request = controller;
    if (!desk) mount.innerHTML = '<h1>Social media planner</h1><p role="status">Opening the club’s plan…</p>';
    mount.setAttribute('aria-busy', 'true');
    try {
      const query = new URLSearchParams();
      if (month) query.set('month', month);
      if (reopenId) query.set('post', reopenId);
      const value = await api(endpoint + (query.size ? '?' + query : ''), {signal: controller.signal, cache: 'no-store'});
      if (request !== controller || !active()) return;
      desk = value; draft = initial = null;
      const saved = reopenId && desk.plans.find(p => p.id === reopenId);
      if (parked) {
        ({draft, initial} = parked);
        parked = null;
        render();
        announce('Your unsaved post is here. Choose Save plan when you’re ready.');
      } else if (saved) edit(saved);
      else {
        render();
        if (reopenId) announce('The saved plan has moved. Choose its new month to find it.');
      }
    } catch (e) {
      if (request !== controller || !active()) return;
      if (!desk) mount.innerHTML = '<h1>Social media planner</h1><button type="button" class="button outline small" data-social-retry>Try again</button><p data-social-notice role="alert"></p>';
      announce(e.message, true);
    } finally {
      if (request === controller) {request = null; mount.removeAttribute('aria-busy');}
    }
  }
  function updateChannels() {
    for (const channel of socialChannels) {
      const selected = draft.channels.includes(channel.id);
      find('[data-social-profile="' + channel.id + '"]').hidden = !selected;
      const link = find('[data-social-link="' + channel.id + '"]');
      link.hidden = !selected;
      link.querySelector('input').disabled = !selected;
      const tip = find('[data-practice-channel="' + channel.id + '"]');
      if (tip) tip.hidden = Boolean(draft.channels.length) && !selected;
    }
    find('[data-social-profile-hint]').hidden = Boolean(draft.channels.length);
  }
  async function save() {
    if(readOnly()) return;
    readForm();
    const form = find('[data-social-editor]');
    if (!draft.title.trim()) {announce('Give this post a working title.', true); form.elements.title.focus(); return;}
    if (!draft.channels.length && ['ready','published'].includes(draft.status)) {
      announce('Choose at least one channel for this post.', true);
      form.querySelector('[name="channel"]').focus();
      return;
    }
    for (const id of draft.channels) {
      const input = form.elements['link_' + id];
      if (input.value && !input.validity.valid) {
        form.querySelector('details').open = true; input.reportValidity(); return;
      }
    }
    const month = draft.plannedDate.slice(0,7) || desk.month;
    const data = {...draft, links: Object.fromEntries(draft.channels.filter(id => draft.links[id].trim()).map(id => [id, draft.links[id].trim()]))};
    const controller = new AbortController();
    request = controller;
    form.inert = true;
    announce('Saving your plan…');
    try {
      const value = await api(endpoint + '?month=' + encodeURIComponent(month), {method: 'POST', body: JSON.stringify(data), signal: controller.signal});
      if (request !== controller || !active()) return;
      desk = value; draft = initial = null;
      if (fromBrain) {fromBrain = false; brain.open('Your updated idea was saved to the planner.'); return;}
      render();
      [...mount.querySelectorAll('[data-social-open]')].find(b => b.dataset.socialOpen === data.id)?.focus();
      announce('Saved “' + value.plan.title + '” as ' + statuses[value.plan.status].toLowerCase() + '.');
    } catch (e) {
      if (request !== controller || !active()) return;
      if (e.status === 409) {
        announce('Another officer has saved a change. Copy any wording you want to keep, then open the saved version.', true);
        find('[data-social-reload]').hidden = false;
      } else announce(e.message, true);
    } finally {
      if (request === controller) {request = null; form.inert = false;}
    }
  }
  async function copyWording() {
    const body = find('[name="body"]');
    if (!body.value.trim()) {announce('Write the post wording first.'); body.focus(); return;}
    try {
      await navigator.clipboard.writeText(body.value);
      if (body.isConnected) announce('Post wording copied. Paste it into your chosen club account.');
    } catch {
      if (body.isConnected) {body.focus(); body.select(); announce('Your wording is selected. Choose Copy on your device.');}
    }
  }
  const discard = () => !dirty() || window.confirm('Leave your unsaved changes to this post?');
  mount.addEventListener('input', event => {
    if (event.target.closest('[data-social-editor]')) readForm();
  });
  mount.addEventListener('change', event => {
    if (event.target.matches('[data-starter-picker]')) updateStarterCard(mount, esc);
    if (!draft || !event.target.closest('[data-social-editor]')) return;
    readForm();
    if (event.target.name === 'channel') updateChannels();
    if (event.target.name === 'status' && ['published','ready'].includes(draft.status)) find('.social-handover').open = true;
  });
  mount.addEventListener('submit', event => {
    event.preventDefault();
    if (!active() || request) return;
    if (event.target.matches('[data-social-month-form]')) load(event.target.elements.month.value);
    if (event.target.matches('[data-social-editor]') && !readOnly()) save();
  });
  mount.addEventListener('invalid', event => {
    const folded = event.target.closest('details');
    if (folded) folded.open = true;
  }, true);
  mount.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !active() || request) return;
    if (button.hasAttribute('data-social-retry')) {load(); return;}
    if (!desk) return;
    if (brain.isOpen()) return;
    if (button.hasAttribute('data-social-brainstorm') && !readOnly()) {fromBrain = false; brain.open(); return;}
    if (button.hasAttribute('data-starter-use') && !readOnly()) {editStarter(chosenStarter(mount)); return;}
    if (button.hasAttribute('data-social-new') && !readOnly()) edit(null);
    if (button.hasAttribute('data-social-open')) edit(desk.plans.find(p => p.id === button.dataset.socialOpen));
    if (button.hasAttribute('data-social-example') && emptyIdea()) {
      const form = find('[data-social-editor]');
      form.elements.title.value = example.title;
      form.elements.body.value = example.body;
      readForm();
      form.elements.body.focus();
      announce('Example added. Change the wording to suit the club, then choose Save plan to keep it.');
    }
    if (button.hasAttribute('data-social-copy')) copyWording();
    if (button.hasAttribute('data-social-reload') && discard()) load(desk.month, draft.id);
    if (button.hasAttribute('data-social-cancel') && discard()) {
      const previous = draft.id;
      if (fromBrain) {draft = initial = null; fromBrain = false; brain.open(); return;}
      draft = initial = null; render();
      const old = [...mount.querySelectorAll('[data-social-open]')].find(b => b.dataset.socialOpen === previous);
      (old || find('[data-social-new]')).focus();
    }
  });
  window.addEventListener('beforeunload', event => {if (active() && dirty()) event.preventDefault();});
  window.addEventListener('plfc:navigated', () => {
    if (active()) {if (!desk && !request) load(parked?.month);}
    else {
      if (dirty()) parked = {draft, initial, month: desk.month};
      reset();
    }
  });
  window.addEventListener('plfc:session-changed', e => {parked = null; reset(); session = e.detail; mount.toggleAttribute('data-read-only',readOnly()); if (active()) load();});
  window.addEventListener('pagehide', () => {parked = null; reset();});
  window.addEventListener('pageshow', e => {if (e.persisted && active()) load();});
}
