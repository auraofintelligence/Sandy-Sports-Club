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
    'index.html': 'venue-home-hero.webp',
    'sports.html': 'venue-sports-precinct.webp',
    'sport-flag-football.html': 'flag-football-concept.webp',
    'flag-football.html': 'flag-football-pathway.webp',
    'places.html': 'site-ballow-aerial.webp',
    'facilities.html': 'venue-clubhouse-pavilion.webp',
    'film-club.html': 'led-cinema-film-club.webp',
    'donate.html': 'led-cinema-screen-campaign.webp',
    'programme.html': 'hero-markets.webp',
    'grants.html': 'hero-funding.webp',
    'join.html': 'hero-youth-elders.webp',
    'space-planner.html': 'hero-nearby.webp',
    'constitution.html': 'hero-trust.webp',
}
for s in SPORTS:
    HERO[f'sport-{s}.html'] = f'sport-{s}.webp'

# Card images kept: (page, card heading) -> image. All other card images are removed.
CARD = {('places.html', '10-12 Ballow Road candidate'): 'site-ballow-bay-tree.webp',
        ('places.html', 'Former sand barge loading area'): 'place-cunningham-street-satellite.webp',
        ('places.html', 'Amity Point (Pulan) sports and recreation reserve'): 'place-amity-point-reserve-satellite.webp',
        ('places.html', 'Point Lookout (Mulumba) sports park'): 'place-point-lookout-sports-park-satellite.webp'}

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
