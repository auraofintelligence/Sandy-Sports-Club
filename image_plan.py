"""Single source of truth for where each public image appears.

Owner rule: every image file appears in exactly one place on the public site.
Concept images are labelled as concepts, never as approved designs.
Real Ballow Road photos are labelled as actual site photos.
Brand assets (logo, icon, favicon, mozzie mascot) are UI marks, exempt from the rule.
"""
import re

CONCEPT_CAPTION = 'Concept image only; not an approved design. No facility or event is confirmed.'
REAL_CAPTION = 'Actual Ballow Road site photo; other sites are not depicted.'

SPORTS = ['mixed-beach-volleyball', 'beach-cricket', 'beach-football', 'beach-rugby-league', 'beach-5s-rugby',
          'beach-handball', 'beach-tennis-and-net-games', 'airbadminton', 'afl-crossover', 'netball-crossover',
          'ultimate-and-flying-disc', 'fitness-and-movement', 'island-made-formats']

ALT = {
    'venue-home-hero.webp': 'Concept image of a world-class sunken beach volleyball show court with tiered stands beside the bay at dusk',
    'venue-sports-precinct.webp': 'Concept image of an aerial view over a multi-court sand sport precinct with a green-roof clubhouse',
    'venue-clubhouse-pavilion.webp': 'Concept image of a timber and glass clubhouse pavilion with a deck facing a sand court',
    'led-cinema-film-club.webp': 'Concept image of a permanent outdoor LED cinema wall in a timber frame with lounge seating beside the bay at twilight',
    'led-cinema-screen-campaign.webp': 'Concept image of a semi-permanent modular outdoor LED cinema wall with quality seating at golden hour',
    'flag-football-concept.webp': 'Concept image of a flag football game on sand',
    'flag-football-pathway.webp': 'Concept image of a junior flag football development clinic on a sand field',
    'hero-markets.webp': 'Concept image of an island sport and culture day with markets',
    'hero-funding.webp': 'Concept image of people reviewing a funded community sport plan',
    'hero-youth-elders.webp': 'Concept image of young people and elders together at a beach sport day',
    'hero-nearby.webp': 'Concept image of a planning table with an island map',
    'hero-trust.webp': 'Concept image of a club meeting planning shared responsibility',
    'hero-home.webp': 'Concept image of a Sandy Sports beach sport scene on the island',
    'hero-sports.webp': 'Concept image of mixed beach volleyball on a sand court',
    'modular-led-concept.webp': 'Concept image of a modular LED screen for club film nights',
    'hero-constitution.webp': 'Concept image of a founding committee meeting around a timber table to agree club rules',
    'site-ballow-aerial.webp': 'Actual aerial photograph of the 10-12 Ballow Road candidate site',
    'site-ballow-bay-tree.webp': 'Actual photo of the tree, slope and bay edge at 10-12 Ballow Road',
}
for s in SPORTS:
    ALT[f'sport-{s}.webp'] = 'Concept image of ' + s.replace('-', ' ').replace('afl', 'AFL').replace('5s', '5s') + ' on a premium sand court'

MAP = {
    'place-cunningham-street-satellite.webp': 'Satellite map of the former sand barge loading area at the end of Cunningham Street, Dunwich (Goompi)',
    'place-amity-point-reserve-satellite.webp': 'Satellite map of the Amity Point (Pulan) Recreation Reserve area off Claytons Road, with the community club marked',
    'place-amity-point-reserve-council-map.webp': 'Redland City Council property map of the Amity Point Recreation Reserve parcel at 24-42 Claytons Road',
    'place-amity-point-reserve-master-plan.webp': 'Existing landscape master plan drawing for the Amity Point Recreation Reserve with a numbered legend and coloured mark-ups',
    'place-point-lookout-sports-park-satellite.webp': 'Satellite map of the Point Lookout (Mulumba) oval and sports park on Dickson Way, with an approximate area outline',
}
ALT.update(MAP)
# Images exported with a 640 px wide variant named <name>-640w.webp for srcset.
RESPONSIVE = set(MAP)
WIDTH = {'place-cunningham-street-satellite.webp': 1320, 'place-amity-point-reserve-satellite.webp': 915,
         'place-amity-point-reserve-council-map.webp': 1055, 'place-amity-point-reserve-master-plan.webp': 1147,
         'place-point-lookout-sports-park-satellite.webp': 1008}


def srcset(img):
    if img not in RESPONSIVE:
        return ''
    small = img.replace('.webp', '-640w.webp')
    return f' srcset="/assets/{small} 640w, /assets/{img} {WIDTH[img]}w" sizes="(max-width: 700px) 100vw, 640px"'


def kind(img):
    if img in MAP:
        return ' data-kind="Site context map, not a design"'
    return ''


# Page hero image by page file. Pages not listed get a no-image hero.
HERO = {
    'index.html': 'hero-home.webp',
    'sports.html': 'venue-sports-precinct.webp',
    'sport-flag-football.html': 'card-index-flag.webp',
    'flag-football.html': 'flag-football-pathway.webp',
    'places.html': 'site-ballow-aerial.webp',
    'facilities.html': 'venue-clubhouse-pavilion.webp',
    'film-club.html': 'led-cinema-film-club.webp',
    'donate.html': 'led-cinema-screen-campaign.webp',
    'programme.html': 'hero-markets.webp',
    'grants.html': 'card-index-capital.webp',
    'join.html': 'hero-youth-elders.webp',
    'space-planner.html': 'hero-nearby.webp',
    'constitution.html': 'hero-constitution.webp',
}
for s in SPORTS:
    HERO[f'sport-{s}.html'] = f'sport-{s}.webp'

# Card images kept: (page, card heading) -> image. All other card images are removed.
CARD = {('places.html', '10-12 Ballow Road candidate'): 'site-ballow-bay-tree.webp',
        ('places.html', 'Former sand barge loading area'): 'place-cunningham-street-satellite.webp',
        ('places.html', 'Amity Point (Pulan) sports and recreation reserve'): 'place-amity-point-reserve-satellite.webp',
        ('places.html', 'Point Lookout (Mulumba) sports park'): 'place-point-lookout-sports-park-satellite.webp'}


# Card images restored after the zero-reuse pass: every card on the key pages carries its own unique image.
_CARDS = [
    ('index.html', 'Mixed beach volleyball', 'card-index-volleyball', 'mixed beach volleyball players on a premium sand court'),
    ('index.html', 'Flag football', 'card-index-flag', 'a flag football game on a sand field'),
    ('index.html', 'Distributed facilities', 'card-index-three-towns', 'sport facilities spread across three island towns'),
    ('index.html', 'Adaptable clubhouses', 'card-index-clubhouses', 'an adaptable modern clubhouse beside sand courts'),
    ('index.html', 'A premium outdoor LED cinema', 'card-index-led-cinema', 'a premium outdoor LED cinema wall with audience seating at dusk'),
    ('index.html', 'Public and private backing', 'card-index-capital', 'public and private partners reviewing a community sport plan'),
    ('index.html', 'A home for players', 'card-index-members', 'club members relaxing together after a game'),
    ('index.html', 'Organise together', 'card-index-committee', 'a volunteer committee organising together'),
    ('index.html', 'Keep it coherent', 'card-index-webmaster', 'a club webmaster keeping the website and records up to date'),
    ('facilities.html', 'Mixed volleyball campus', 'card-fac-volleyball-campus', 'a multi-court mixed beach volleyball campus'),
    ('facilities.html', 'Larger sport zones', 'card-fac-field-zones', 'larger sand field zones for team sports'),
    ('facilities.html', 'Lighting and power', 'card-fac-lighting', 'sports lighting and power over sand courts at night'),
    ('facilities.html', 'Dressing rooms and showers', 'card-fac-dressing-rooms', 'clean modern dressing rooms and showers'),
    ('facilities.html', 'Equipment and maintenance', 'card-fac-equipment', 'an equipment store and court maintenance'),
    ('facilities.html', 'Meeting and media room', 'card-fac-media-room', 'a meeting and media room overlooking the courts'),
    ('film-club.html', 'Film festivals and cinema', 'card-film-festival', 'an outdoor film festival screening on a permanent LED wall'),
    ('film-club.html', 'Production and skill transfer', 'card-film-mediahub', 'young people learning film production in a media room'),
    ('film-club.html', 'Sport broadcasts', 'card-film-broadcast', 'a sport broadcast crew filming beach sport'),
    ('flag-football.html', 'Mixed social flag', 'card-flag-social', 'a mixed social flag football game on sand'),
    ('flag-football.html', 'Sand conditioning crossover', 'card-flag-train', 'athletes doing sand conditioning drills'),
    ('flag-football.html', '2032 cultures and sport', 'card-flag-expo', 'a flag football showcase during a culture and sport day'),
    ('programme.html', 'Mixed sand leagues', 'card-prog-leagues', 'a mixed sand league evening under lights'),
    ('programme.html', 'Outdoor cinema', 'card-prog-cinema', 'an outdoor cinema night on a premium LED wall'),
    ('programme.html', 'Makers and food', 'card-prog-markets', 'island makers and food stalls at a sport day'),
    ('programme.html', 'Sand sport expo', 'card-prog-expo', 'a sand sport expo with several codes on show'),
    ('programme.html', 'Skills transfer', 'card-prog-youth', 'young people learning event and media skills'),
    ('programme.html', 'Cultural programmes', 'card-prog-country', 'a cultural programme gathering on country by the water'),
    ('join.html', 'Founding interest', 'card-join-founding', 'people registering founding interest in the club'),
    ('join.html', 'Committee nomination', 'card-join-committee', 'members discussing committee nominations'),
    ('join.html', 'Existing clubs', 'card-join-clubs', 'existing local clubs meeting to work together'),
    ('clubhouse.html', 'My sport and teams', 'card-ch-teams', 'a team gathering before a sand sport game'),
    ('clubhouse.html', 'Island calendar and people', 'card-ch-calendar', 'members planning the island sport calendar'),
    ('clubhouse.html', 'Skills and media', 'card-ch-skills', 'members building media and event skills'),
    ('clubhouse.html', 'Meeting and action desk', 'card-ch-meeting', 'a club meeting working through actions'),
    ('clubhouse.html', 'Facilities and asset desk', 'card-ch-facilities', 'volunteers checking club facilities and assets'),
    ('clubhouse.html', 'Grant and investment desk', 'card-ch-fund', 'members preparing a grant and investment case'),
    ('committee.html', 'Governance and meetings', 'card-com-governance', 'a committee governance meeting'),
    ('committee.html', 'Sport operations', 'card-com-sport', 'sport operations being organised courtside'),
    ('committee.html', 'Events and summer programme', 'card-com-events', 'a summer event being set up beside sand courts'),
    ('committee.html', 'Film club governance', 'card-com-film', 'film club officers planning a screening programme'),
    ('committee.html', 'Grants and investment', 'card-com-grants', 'officers working on grants and investment'),
    ('committee.html', 'Facilities and assets', 'card-com-facilities', 'officers inspecting club facilities and assets'),
    ('committee.html', 'Membership and welfare', 'card-com-welfare', 'membership and welfare volunteers welcoming players'),
    ('committee.html', 'Webmaster and communications', 'card-com-webmaster', 'a webmaster managing club communications'),
    ('members.html', 'Sport and teams', 'card-mem-teams', 'members playing in mixed sand sport teams'),
    ('members.html', 'Skills and learning', 'card-mem-skills', 'members learning new skills together'),
    ('members.html', 'Calendar and availability', 'card-mem-calendar', 'members checking the club calendar and availability'),
    ('members.html', 'Film club membership', 'card-mem-film', 'film club members at an LED wall screening'),
    ('members.html', 'Event and media crew', 'card-mem-crew', 'an event and media crew at work'),
    ('members.html', 'Shared equipment', 'card-mem-equipment', 'shared club equipment ready for use'),
]
for _p, _t, _img, _alt in _CARDS:
    CARD[(_p, _t)] = _img + '.webp'
    ALT[_img + '.webp'] = 'Concept image of ' + _alt

# Owner correction: the home page keeps its original images from b1964e4 in their
# original slots. The newer images those slots used move to other pages or stay
# unused (shown on the owner's image gallery page), so zero reuse still holds.
HOME_ORIGINALS = {
    'Mixed beach volleyball': 'hero-sports.webp',
    'Flag football': 'flag-football-concept.webp',
    'Adaptable clubhouses': 'hero-trust.webp',
    'A premium outdoor LED cinema': 'modular-led-concept.webp',
    'Public and private backing': 'hero-funding.webp',
}
for _t, _img in HOME_ORIGINALS.items():
    CARD[('index.html', _t)] = _img

# Unique hero images for the internal member and committee pages.
_HEROES = {
    'assets.html': ('hero-assets', 'a club asset store with organised sport equipment'),
    'committee-assets.html': ('hero-committee-assets', 'officers reviewing club facilities and assets'),
    'committee-events.html': ('hero-committee-events', 'an event team setting up a summer programme'),
    'committee-film.html': ('hero-committee-film', 'a film crew with a camera jib at a sand court at golden hour'),
    'committee-funding.html': ('hero-committee-funding', 'a clubhouse function room set for a funding partners dinner'),
    'committee-governance.html': ('hero-committee-governance', 'founding committee members walking a waterfront reserve at sunrise'),
    'committee-members.html': ('hero-committee-members', 'a family sport day registration under shade sails'),
    'committee-publishing.html': ('hero-committee-publishing', 'a courtside photographer reviewing shots at a beach sport event'),
    'committee-sport.html': ('hero-committee-sport', 'coaches from several sports meeting courtside'),
    'committee.html': ('hero-committee', 'a clubhouse committee room glowing at dusk above sand courts'),
    'clubhouse.html': ('hero-clubhouse', 'a premium beachside clubhouse lit at night'),
    'members.html': ('hero-members', 'a members lounge looking onto sand courts and the bay'),
    'member-calendar.html': ('hero-member-calendar', 'a sunrise over an island coastline with three headlands'),
    'member-crew.html': ('hero-member-crew', 'an event crew assembling spectator seating beside a sand court'),
    'member-equipment.html': ('hero-member-equipment', 'a club equipment trailer waiting at an island ferry terminal'),
    'member-film.html': ('hero-member-film', 'young filmmakers flying a drone over a beach volleyball session'),
    'member-sports.html': ('hero-member-sports', 'netball and rugby players warming up on neighbouring sand fields'),
    'member-training.html': ('hero-member-training', 'an outdoor first aid and coaching class under a beach pavilion'),
    'sources.html': ('hero-sources', 'a researcher reading a report on the foreshore at golden hour'),
    'webmaster.html': ('hero-webmaster', 'a clubhouse entrance with a public foyer and a secure members door at night'),
}
for _p, (_img, _alt) in _HEROES.items():
    HERO[_p] = _img + '.webp'
    ALT[_img + '.webp'] = 'Concept image of ' + _alt
ALT['card-index-flag.webp'] = 'Concept image of a flag football game on a sand field'
ALT['card-index-capital.webp'] = 'Concept image of public and private partners reviewing a community sport plan'

# Inline figures: (page, old src) -> new src, or None to remove the figure.
FIGURE = {
    ('index.html', 'hero-community-builder.webp'): 'hero-community-builder.webp',
    ('committee-governance.html', 'women-led-setup.webp'): 'governance-committee-meeting.webp',
    ('committee-governance.html', 'governance-committee-meeting.webp'): 'governance-committee-meeting.webp',
    ('places.html', 'site-ballow-aerial.webp'): None,
    ('places.html', 'site-ballow-bay-tree.webp'): None,
    ('places.html', 'site-ballow-roadside.webp'): 'site-ballow-roadside.webp',
    ('places.html', 'site-ballow-360-point-20.webp'): 'site-ballow-360-point-20.webp',
    ('places.html', 'place-amity-point-reserve-master-plan.webp'): 'place-amity-point-reserve-master-plan.webp',
    ('places.html', 'place-amity-point-reserve-council-map.webp'): 'place-amity-point-reserve-council-map.webp',
}
FIGURE_ALT = {'governance-committee-meeting.webp': 'Concept image of a women-led club committee meeting in a clubhouse room overlooking sand courts'}

HERO_RE = re.compile(r'<section class="page-hero(?: no-image)?">(?:<img [^>]*>)?(<div class="page-hero-copy">.*?</div>)(?:<small class="caption">[^<]*</small>)?</section>', re.S)
CARD_RE = re.compile(r'(<article class="card[^"]*">)(<img [^>]*>)?((?:(?!</?article).)*?</article>)', re.S)
FIG_RE = re.compile(r'<figure( class="[^"]*")?><img src="/assets/([^"]+)"(?: srcset="[^"]*" sizes="[^"]*")? alt="([^"]*)"([^>]*)>(.*?)</figure>', re.S)


def _hero(page):
    def rep(m):
        img = HERO.get(page)
        if not img:
            return f'<section class="page-hero no-image">{m.group(1)}</section>'
        cap = REAL_CAPTION if img.startswith('site-ballow-') else CONCEPT_CAPTION
        return f'<section class="page-hero"><img src="/assets/{img}" alt="{ALT[img]}">{m.group(1)}<small class="caption">{cap}</small></section>'
    return rep


def _card(page):
    def rep(m):
        head = re.search(r'<h3>(?:<a [^>]*>)?([^<]*)', m.group(3))
        img = CARD.get((page, head.group(1).strip() if head else ''))
        if not img:
            return m.group(1) + m.group(3)
        return f'{m.group(1)}<img src="/assets/{img}"{srcset(img)} alt="{ALT[img]}"{kind(img)} loading="lazy">{m.group(3)}'
    return rep


def _figure(page):
    def rep(m):
        key = (page, m.group(2))
        if key not in FIGURE:
            return m.group(0)
        new = FIGURE[key]
        if new is None:
            return ''
        alt = FIGURE_ALT.get(new, m.group(3))
        alt = ALT.get(new, alt) if new in MAP else alt
        return f'<figure{m.group(1) or ""}><img src="/assets/{new}"{srcset(new)} alt="{alt}"{m.group(4)}>{m.group(5)}</figure>'
    return rep


def apply(page, html):
    html = HERO_RE.sub(_hero(page), html)
    html = CARD_RE.sub(_card(page), html)
    html = FIG_RE.sub(_figure(page), html)
    return html
