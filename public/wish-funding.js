import {recommendedGrantsForWish, recommendedSavedGrantsForWish, wishIdeasForGrant} from './grant-wish-matches.js?v=20261121-practical-wishes';

export function grantHref(params) {
  return '/?' + new URLSearchParams(params).toString() + '#committee/grants';
}

export function draftIdeas(grant, today) {
  return wishIdeasForGrant(grant, today);
}

export function fundingPanel(wish, register, esc) {
  const linked = register.grants.filter(grant => grant.wishIds.includes(wish.id));
  const available = register.grants.filter(grant => !grant.wishIds.includes(wish.id));
  function recordLink(grant, label) {
    return '<a class="text-link" href="' + esc(grantHref({grantId:grant.id,wishId:wish.id})) + '">' + esc(label) + '</a>';
  }
  function sameRound(saved, listed) {
    return !['closed','declined','parked'].includes(saved.stage) && saved.title === listed.name &&
      saved.sourceUrl === listed.url && saved.deadline === (listed.closing || '');
  }
  const matches = wish.status === 'fulfilled' ? [] : recommendedGrantsForWish(wish,register.today)
    .filter(({grant}) => !linked.some(saved => sameRound(saved, grant))).slice(0, 3);
  const suggestedSaved = wish.status === 'fulfilled' ? [] : recommendedSavedGrantsForWish(wish,available,register.today);
  const suggestedIds = new Set(suggestedSaved.map(({grant})=>grant.id));
  const linkedRows = linked.map(grant => '<li><div>' + recordLink(grant,grant.title) +
    '<span>' + esc(register.stages[grant.stage]) + ' · ' + esc(register.offices[grant.office]) + '</span></div>' +
    '<button class="text-link" type="button" data-wish-unlink="' + esc(grant.id) + '" aria-label="' +
    esc('Remove link to ' + grant.title) + '">Remove link</button></li>').join('');
  const suggestions = matches.map(({grant,reason}) => {
    const existing = available.find(saved => sameRound(saved, grant));
    const href = existing ? grantHref({grantId:existing.id,wishId:wish.id}) : grantHref({grant:grant.name,wishId:wish.id});
    return '<li><strong>' + esc(grant.name) + '</strong><p>' + esc(reason) + '</p>' +
      '<a class="text-link" href="' + esc(href) + '">' + (existing?'Review saved grant':'Review funding lead') + '</a></li>';
  }).join('');
  function options(grants) {
    return grants.map(grant => '<option value="' + esc(grant.id) + '">' + esc(grant.title) + ' (' + esc(register.stages[grant.stage]) + ')</option>').join('');
  }
  const other = available.filter(grant=>!suggestedIds.has(grant.id));
  const savedChoices = suggestedSaved.length ? '<optgroup label="Suggested for this wish">' + options(suggestedSaved.map(({grant})=>grant)) + '</optgroup>' +
    (other.length?'<optgroup label="Other saved grants">' + options(other) + '</optgroup>':'') : options(available);
  const chooseSaved = available.length ? '<details class="wish-link-grant"><summary>Link a grant already in the register</summary>' +
    '<form class="wish-form" data-wish-link-form><label>Choose a saved grant<select name="grantId" required><option value="">Select a grant</option>' +
    savedChoices +
    '</select></label><button class="button outline small" type="submit">Link to this wish</button></form></details>' : '';
  const browse = '<a class="text-link" href="' + esc(grantHref({wishId:wish.id})) + '">Browse funding for this wish</a>';
  return '<h2>Grants for this wish</h2>' +
    (linkedRows ? '<h3>Linked grants</h3><ul class="wish-linked-grants">' + linkedRows + '</ul>' : '<p>No grants linked yet.</p>') +
    chooseSaved + (wish.status === 'fulfilled' ? '' : (suggestions ? '<h3>Possible funding</h3><ul class="wish-funding-matches">' + suggestions + '</ul>' : '') + browse);
}
