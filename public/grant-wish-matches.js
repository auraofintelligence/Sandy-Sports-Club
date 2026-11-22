import {opportunities} from './grant-opportunities.mjs';

// Suggestions are leads for an officer to check, not an eligibility decision.
// Keep the examples as editable wish drafts rather than purchasing instructions.
const needs = {
  sport: {
    label: 'shared sporting equipment',
    equipment: /\b(flag football|footballs?|volleyballs?|nets?|cones?|training balls?|sports? kits?|sports? equipment|portable goals?)\b/,
    name: 'Shared come-and-try sports kit',
    purpose: 'Prepare a shared kit for supervised community sport sessions. Confirm the activities and equipment with local participants.'
  },
  safety: {
    label: 'first aid or safety equipment',
    equipment: /\b(first aid|defibrillators?|aed|safety kits?|rescue equipment)\b/,
    name: 'Shared first aid kit',
    purpose: 'Equip trained volunteers for approved community sport and event activities.'
  },
  access: {
    label: 'accessible equipment for children',
    equipment: /\b(adapt(ed|ive)|accessible|wheelchairs?|limited mobility|disabilit(y|ies)|sensory equipment)\b/,
    audience: /\b(juniors?|kids?|children|child|youth|young people|school|students?|teenagers?)\b/,
    name: 'Accessible junior activity equipment',
    purpose: 'Ask participating families what would help children take part before choosing equipment or seeking quotes.'
  },
  eventKit: {
    label: 'portable event and check-in equipment',
    equipment: /\b(portable (pa|public address|speakers?|sound systems?)|pa (systems?|speakers?)|(sign on|check in|registration) (kits?|gear|equipment|tablets?|stations?))\b/,
    name: 'Portable PA and event check-in kit',
    purpose: 'Welcome participants and give short safety briefings at approved community sport and cultural events.'
  },
  portable: {
    label: 'portable equipment for community events',
    equipment: /\b(marquees?|gazebos?|pop up shelters?|folding tables?|portable (shelters?|tables?|shade)|water stations?)\b/,
    name: 'Portable shade and folding tables',
    purpose: 'Set up a shaded welcome point for approved outdoor community sport and culture activities.'
  },
  water: {
    label: 'drinking water equipment',
    equipment: /\b(water stations?|drinking water|water refill)\b/,
    name: 'Refillable water station',
    purpose: 'Provide drinking water at approved club activities using equipment that can be reused.'
  },
  energy: {
    label: 'energy upgrades',
    equipment: /\b(solar (panels?|batter(y|ies))|energy efficient light(s|ing)?|led lighting|battery storage)\b/,
    name: 'Energy-efficient lighting for a shared venue',
    purpose: 'Plan the upgrade with the venue owner and collect energy use figures before seeking quotes.'
  }
};

// Only map a programme to an item where the funder's published funding type
// gives a concrete reason to investigate. Officers still check every item.
const programmes = {
  'Club House Grant': {
    sport: 'The club-owned equipment category may cover shared sporting gear. Check the proposed items against the round guidelines.',
    safety: 'The guidelines list safety and first aid equipment kept by an eligible club.',
    eventKit: 'The round lists club-owned equipment and technology. Check whether the proposed event use and items qualify.',
    water: 'The guidelines list water stations. Check the proposed purchase and applicant requirements.'
  },
  'Rapid Response Grant': {
    eventKit: 'Council may consider small portable equipment for community use. Confirm the item and public benefit before applying.',
    portable: 'Council may consider portable equipment that benefits Redlands residents. Confirm this round covers the item before obtaining quotes.'
  },
  'Community Grants for Children': {
    access: 'Variety considers equipment that reduces barriers for children. Document the need with families and obtain a current supplier quote.'
  },
  'Game On, Teaming Up for Climate Action': {
    energy: 'This may suit an energy upgrade at a shared sporting venue. Confirm the next round, site control and owner consent.'
  }
};

const clean = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const brisbaneNow = () => new Date(Date.now() + 10 * 3600000).toISOString().slice(0,16);
const unsuitable = /\b(prizes?|raffles?|alcohol|beer|resale|retail sale|gift (cards?|vouchers?))\b/;

function catalogueRecord(grant) {
  const source = grant?.sourceUrl || grant?.url;
  return opportunities.find(item => source && source === item.url)
    || opportunities.find(item => clean(item.name) === clean(grant?.name || grant?.title) &&
      (!grant?.funder || clean(item.funder) === clean(grant.funder)));
}

function acceptingLeads(record, today) {
  if (!['Open','Upcoming'].includes(record?.status)) return false;
  if (!record.closing) return true;
  return today < record.closing + 'T' + (record.closingTime || '24:00');
}

function describes(text, {equipment, audience}) {
  return equipment.test(text) && (!audience || audience.test(text));
}

function themesFor(grant, today) {
  if (!grant || (grant.stage && !['checking','preparing'].includes(grant.stage))) return [];
  if (grant.deadline && grant.deadline < today.slice(0,10)) return [];
  const record = catalogueRecord(grant);
  if (record) return acceptingLeads(record, today) ? Object.entries(programmes[record.name] || {}) : [];
  // A manually saved grant may be outside the directory. Use only a specific
  // item named in its title; private notes are not evidence of funder rules.
  const title = clean(grant.title);
  if (!title || unsuitable.test(title)) return [];
  return Object.entries(needs).filter(([,need]) => describes(title, need)).map(([key,need]) =>
    [key, 'The saved grant title mentions ' + need.label + '. Check the funder’s guidelines for this particular item.']);
}

function match(wish, themes) {
  if (!wish || wish.status === 'fulfilled') return;
  const name = clean(wish.name);
  const text = clean([wish.name, wish.purpose].filter(Boolean).join(' '));
  if (!text || unsuitable.test(text.replace(/\bprize presentations?\b/g, 'presentation'))) return;
  if (/\b(tractors?|boat ramps?|surf ramps?|permanent ramps?|trailers?|buildings?|fixed screens?|permanent structures?)\b/.test(name)) return;
  return themes.find(([key]) => needs[key].equipment.test(name) &&
    (!needs[key].audience || needs[key].audience.test(text)))?.[1];
}

export function recommendedGrantsForWish(wish, today = brisbaneNow()) {
  return opportunities.map(grant => ({grant, reason:match(wish, themesFor(grant, today))}))
    .filter(result => result.reason)
    .sort((a,b) => Number(b.grant.status === 'Open') - Number(a.grant.status === 'Open'));
}

export function recommendedWishesForGrant(grant, wishes, today = brisbaneNow()) {
  const themes = themesFor(grant, today);
  return wishes.map(wish => ({wish, reason:match(wish, themes)})).filter(result => result.reason);
}

export function recommendedSavedGrantsForWish(wish, grants, today = brisbaneNow()) {
  return grants.map(grant => ({grant, reason:match(wish, themesFor(grant, today))})).filter(result => result.reason);
}

export function wishIdeasForGrant(grant, today = brisbaneNow()) {
  return themesFor(grant, today).map(([key]) => {
    const {name, purpose} = needs[key];
    return {name, purpose};
  });
}
