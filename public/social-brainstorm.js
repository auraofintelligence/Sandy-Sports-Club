import {postStarters, channelTips, publishingChecks, practiceSources} from './social-guidance.js?v=20261121-fundraising';
import {socialChannels} from './social-channels.js';
import {officeGuides} from './officer-duties.js?v=20261121-fundraising';

const endpoint = '/api/committee/social-brainstorm';
const day = new Intl.DateTimeFormat('en-AU', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane'});
const when = timestamp => day.format(new Date(timestamp));
export function contributorName(name) {
  const key = String(name || '').toLowerCase().replace(/[\s-]/g, '');
  return Object.hasOwn(officeGuides, key) ? officeGuides[key].name : name;
}

function starterCard(starter, esc) {
  return '<h3>' + esc(starter.title) + '</h3><p>' + esc(starter.body) + '</p>' +
    (starter.body.includes('[') ? '<small>Fill the square brackets with confirmed club details.</small>' : '') +
    '<button data-starter-use type="button" class="button small outline">Use this idea</button>';
}
export function starterBrowser(esc) {
  if (!postStarters.length) return '';
  return '<details class="social-help social-starters"><summary>Browse post ideas</summary>' +
    '<label>Choose an example to preview<select data-starter-picker>' + postStarters.map(s => '<option value="' + esc(s.id) + '">' + esc(s.theme + ' · ' + s.title) + '</option>').join('') +
    '</select></label><article class="social-starter-card" data-starter-card>' + starterCard(postStarters[0], esc) + '</article></details>';
}
export function chosenStarter(container) {
  return postStarters.find(s => s.id === container.querySelector('[data-starter-picker]')?.value);
}
export function updateStarterCard(container, esc) {
  const starter = chosenStarter(container);
  if (starter) container.querySelector('[data-starter-card]').innerHTML = starterCard(starter, esc);
}
export function practiceGuide(esc, channels = []) {
  return '<details class="social-help social-practice"><summary>Tips for a good club post</summary><h3>Before you share</h3><ul>' +
    publishingChecks.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul><h3>Match the post to the channel</h3><dl>' +
    socialChannels.filter(c => channelTips[c.id]).map(c => '<div data-practice-channel="' + esc(c.id) + '"' + (!channels.length || channels.includes(c.id) ? '' : ' hidden') + '><dt>' + esc(c.label) + '</dt><dd>' + esc(channelTips[c.id]) + '</dd></div>').join('') +
    '</dl><details><summary>Official guides</summary><ul>' + practiceSources.map(s => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.label) + '</a></li>').join('') + '</ul></details></details>';
}

export function setupBrainstorm({mount, api, esc, active, back, openPlan, useSeparately}) {
  let opened = false, writing = false, view, controller, timer, sessionDraft, pending, startAttempt, heldTopic = '';
  const find = selector => mount.querySelector(selector);
  function notice(message, error = false) {
    const target = find('[data-brain-notice]');
    if (target) {target.setAttribute('role', error ? 'alert' : 'status'); target.textContent = message;}
  }
  function close() {
    opened = false;
    controller?.abort(); controller = null;
    clearInterval(timer); timer = null;
    view = sessionDraft = pending = startAttempt = null;
    writing = false; heldTopic = '';
  }
  function header() {
    return '<div class="social-brain-top"><button class="text-link" data-brain-back type="button">Back to planner</button>' +
      '<button class="text-link" data-brain-refresh type="button">Refresh shared ideas</button></div><header class="social-heading"><div><h1>Brainstorm together</h1></div></header>';
  }
  function ideaLinks(session) {
    if (!session.ideas.length) return '<p>No ideas saved in this session yet.</p>';
    return '<ul class="social-brain-ideas">' + session.ideas.map(i => '<li><button class="social-open" data-brain-open="' + esc(i.id) + '" type="button">' + esc(i.title) + '</button><small>Added by ' + esc(contributorName(i.createdBy)) + (i.plannedDate ? ' · Planned for ' + esc(when(i.plannedDate + 'T12:00:00+10:00')) : '') + '</small></li>').join('') + '</ul>';
  }
  function archive(recent) {
    if (!recent.length) return '';
    return '<h2>Recently finished sessions</h2>' + recent.map(s => '<details class="social-help" data-brain-archive="' + esc(s.id) + '"><summary>' + esc(s.topic) + '</summary><p>Finished ' + esc(when(s.finishedAt)) + ' · ' + s.ideas.length + (s.ideas.length === 1 ? ' idea' : ' ideas') + '</p>' + ideaLinks(s) + '</details>').join('');
  }
  function blankInput(sessionId) {
    return {sessionId, id: crypto.randomUUID(), title: '', body: '', channels: []};
  }
  function noteForm(s) {
    return '<div class="social-session-aim"><span>Today’s question</span><h2>' + esc(s.topic) + '</h2><ol><li>Agree who this post is for and what they need to know.</li><li>Give everyone a turn. Save each idea below.</li><li>Pick one idea and agree who will draft it and by when.</li></ol></div>' +
      '<form class="social-brain-form" data-brain-idea><h2>Capture an idea</h2><label>What could we post?<input name="title" maxlength="140" required placeholder="Give the idea a short name"></label>' +
      '<label>Wording or notes <small>(optional)</small><textarea rows="3" name="body" maxlength="6000"></textarea></label>' +
      '<p data-brain-channels hidden></p><button class="button" type="submit">Save idea to the planner</button></form>' + starterBrowser(esc) +
      '<section class="social-brain-board"><h2>Ideas from this session</h2><div data-brain-ideas></div></section>' +
      '<button type="button" class="button outline small" data-brain-finish>Finish session</button>';
  }
  function capture() {
    const form = find('[data-brain-idea]');
    if (form && sessionDraft) {sessionDraft.title = form.elements.title.value; sessionDraft.body = form.elements.body.value;}
  }
  const hasWords = input => Boolean(input && (input.title.trim() || input.body.trim()));
  function setForm() {
    const form = find('[data-brain-idea]');
    if (!form || !sessionDraft) return;
    form.elements.title.value = sessionDraft.title;
    form.elements.body.value = sessionDraft.body;
    const hint = find('[data-brain-channels]');
    hint.hidden = !sessionDraft.channels.length;
    hint.textContent = sessionDraft.channels.length ? 'Suggested channels · ' + socialChannels.filter(c => sessionDraft.channels.includes(c.id)).map(c => c.label).join(', ') : '';
  }
  function render(data) {
    const previous = view;
    const switched = !previous || previous.active?.id !== data.active?.id;
    const openArchive = [...mount.querySelectorAll('[data-brain-archive][open]')].map(d => d.dataset.brainArchive);
    const topic = find('[data-brain-start]')?.elements.topic.value || '';
    capture();
    if (switched && hasWords(sessionDraft)) pending = sessionDraft;
    view = data;
    if (switched) {
      sessionDraft = data.active ? blankInput(data.active.id) : null;
      if (data.active && topic) heldTopic = topic;
      mount.innerHTML = header() +
        (data.active ? noteForm(data.active) : '<form class="social-brain-form" data-brain-start><h2>Start a shared session</h2><label>What shall we brainstorm?<input name="topic" maxlength="180" required placeholder="What would locals like to see in the club’s next posts?"></label><p>Give the discussion a question. Other officers can open this page and add ideas with you.</p><button class="button" type="submit">Start session</button></form>') +
        '<div data-brain-unsaved></div><p data-brain-notice class="social-notice" aria-live="polite" role="status"></p><section class="social-brain-board" data-brain-recent></section>';
      if (data.active) setForm(); else {find('[data-brain-start]').elements.topic.value = topic || heldTopic; heldTopic = '';}
      if (pending) find('[data-brain-unsaved]').innerHTML = '<p>The session changed before you saved your idea. You can keep your words as a separate post.</p><button type="button" class="button outline small" data-brain-recover>Open my unsaved idea</button>';
    }
    if (data.active && (switched || previous?.active?.version !== data.active.version || JSON.stringify(previous?.active?.ideas) !== JSON.stringify(data.active.ideas))) find('[data-brain-ideas]').innerHTML = ideaLinks(data.active);
    if (switched || JSON.stringify(previous?.recent) !== JSON.stringify(data.recent)) {
      find('[data-brain-recent]').innerHTML = archive(data.recent);
      for (const d of mount.querySelectorAll('[data-brain-archive]')) d.open = openArchive.includes(d.dataset.brainArchive);
    }
  }
  async function fetchDesk(payload, message = '') {
    if (!opened || !active() || (controller && (!payload || writing))) return;
    controller?.abort();
    const ticket = new AbortController();
    controller = ticket;
    writing = Boolean(payload);
    if (writing) mount.inert = true;
    try {
      const data = await api(endpoint, {cache: 'no-store', signal: ticket.signal, ...(payload ? {method: 'POST', body: JSON.stringify(payload)} : {})});
      if (!opened || !active() || controller !== ticket) return;
      if (payload?.action === 'idea') {
        sessionDraft = blankInput(payload.sessionId);
        setForm();
      } else if (payload?.action === 'start') {
        startAttempt = null;
        const form = find('[data-brain-start]');
        if (form) form.elements.topic.value = '';
      }
      render(data);
      if (message) notice(message);
    } catch (e) {
      if (!opened || !active() || controller !== ticket) return;
      if (e.status === 409) {
        try {
          const fresh = await api(endpoint, {cache: 'no-store', signal: ticket.signal});
          if (opened && active() && controller === ticket) render(fresh);
        } catch { /* The refresh control retries using the retained form. */ }
      }
      if (opened && active() && controller === ticket) notice(e.message, true);
    } finally {
      if (controller === ticket) {controller = null; writing = false; mount.inert = false;}
    }
  }
  function open(message = '') {
    close(); opened = true;
    mount.innerHTML = header() + '<p data-brain-notice role="status">Opening the shared session…</p>';
    find('h1').tabIndex = -1; find('h1').focus();
    fetchDesk(null, message);
    timer = setInterval(() => {if (!document.hidden && view) fetchDesk();}, 20000);
  }
  function leave() {
    capture();
    const unsavedTopic = find('[data-brain-start]')?.elements.topic.value.trim();
    return !(unsavedTopic || hasWords(sessionDraft) || pending) || window.confirm('Leave your unsaved brainstorming notes?');
  }
  mount.addEventListener('input', e => {if (opened && e.target.closest('[data-brain-idea]')) capture();});
  mount.addEventListener('submit', e => {
    if (!opened || !active()) return;
    const form = e.target;
    if (!form.matches('[data-brain-start],[data-brain-idea]')) return;
    e.preventDefault();
    if (writing) return;
    if (form.matches('[data-brain-start]')) {
      const topic = form.elements.topic.value.trim();
      if (!topic) {form.elements.topic.focus(); notice('Give the session a question first.', true); return;}
      if (startAttempt?.topic !== topic) startAttempt = {action: 'start', id: crypto.randomUUID(), topic};
      fetchDesk(startAttempt, 'The session is open. Other officers can join from their planner.');
    } else if (view.active && sessionDraft) {
      capture();
      if (!sessionDraft.title.trim()) {form.elements.title.focus(); notice('Give your idea a short name.', true); return;}
      fetchDesk({action: 'idea', ...sessionDraft}, 'Idea saved. Choose its title below to turn it into a post.');
    }
  });
  mount.addEventListener('click', e => {
    const button = e.target.closest('button');
    if (!button || !opened || !active()) return;
    if (button.hasAttribute('data-brain-back') && leave()) {close(); back(); return;}
    if (writing) return;
    if (button.hasAttribute('data-brain-refresh')) fetchDesk(null, 'Shared ideas refreshed.');
    if (button.hasAttribute('data-starter-use') && view?.active) {
      capture();
      if (hasWords(sessionDraft) && !window.confirm('Replace the unsaved idea with this starting point?')) return;
      const starter = chosenStarter(mount);
      if (!starter) return;
      sessionDraft = {...blankInput(view.active.id), title: starter.title, body: starter.body, channels: [...starter.channels]};
      setForm(); find('[data-brain-idea]').elements.title.focus();
      notice(starter.body.includes('[') ? 'Edit the words in square brackets to suit your club, then save the idea.' : 'Edit the starting point, then choose Save idea to the planner.');
    }
    if (button.hasAttribute('data-brain-recover') && pending) {
      if (hasWords(sessionDraft) && !window.confirm('Leave the new session’s unsaved idea?')) return;
      const saved = pending; close(); useSeparately(saved); return;
    }
    if (button.hasAttribute('data-brain-open') && leave()) {const id = button.dataset.brainOpen; close(); openPlan(id);}
    if (button.hasAttribute('data-brain-finish') && view?.active) {
      capture();
      if (hasWords(sessionDraft)) {notice('Save your idea or clear its fields before finishing the session.', true); find('[data-brain-idea]').elements.title.focus(); return;}
      if (window.confirm('Finish this shared session for everyone? Saved ideas stay in the planner.')) fetchDesk({action: 'finish', sessionId: view.active.id, version: view.active.version}, 'Session finished. Its ideas are available below and in the planner.');
    }
  });
  return {open, close: () => {if (opened) {close(); mount.inert = false;}}, isOpen: () => opened};
}
