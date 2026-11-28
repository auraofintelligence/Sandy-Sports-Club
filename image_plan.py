"""Single source of truth for where each public image appears.

Owner rule: every image file appears in exactly one place on the public site.
Concept images are labelled as concepts, never as approved designs.
Real Ballow Road photos are labelled as actual site photos.
Brand assets (logo, icon, favicon, mozzie mascot) are UI marks, exempt from the rule.
"""
import re

CONCEPT_CAPTION = 'Concept image only; not an approved design. No facility or event is confirmed.'
REAL_CREDIT = {}
REAL_KIND = {}
# Cards whose photo credit sits in a muted line under the image instead of over it.
CREDIT_BELOW = {'real-three-towns.webp'}
REAL_CAPTION = 'Actual Ballow Road site photo; other sites are not depicted.'

SPORTS = ['mixed-beach-volleyball', 'beach-cricket', 'beach-football', 'beach-rugby-league', 'beach-5s-rugby',
          'beach-handball', 'beach-tennis-and-net-games', 'airbadminton', 'afl-crossover', 'netball-crossover',
          'ultimate-and-flying-disc', 'fitness-and-movement', 'island-made-formats']

ALT = {
    'venue-home-hero.webp': 'Concept image of a world-class sunken beach volleyball show court with tiered stands beside the bay at dusk',
    'venue-sports-precinct.webp': 'Concept image of an aerial view over a multi-court sand sport precinct with a green-roof clubhouse',
    'venue-clubhouse-pavilion.webp': 'Concept image of a timber and glass clubhouse pavilion with a deck facing a sand court',
    'led-cinema-film-club.webp': 'Concept image of a permanent outdoor LED cinema wall in a timber frame with lounge seating beside the bay at twilight',
    'led-cinema-screen-campaign.webp': 'Concept image of a mobile, segmented LED screen of modular panels set up with seating at golden hour, ready to move to venues across the island',
    'flag-football-concept.webp': 'Concept image of a flag football game on sand',
    'flag-football-pathway.webp': 'Concept image of a junior flag football development clinic on a sand field',
    'hero-markets.webp': 'Concept image of an island sport and culture day with markets',
    'hero-funding.webp': 'Concept image of people reviewing a funded community sport plan',
    'hero-youth-elders.webp': 'Concept image of young people and elders together at a beach sport day',
    'hero-nearby.webp': 'Concept image of a planning table with an island map',
    'hero-trust.webp': 'Concept image of a club meeting planning shared responsibility',
    'card-index-clubhouses.webp': 'Concept image of a demountable container clubhouse with a green roof beside a sand court',
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
    if img in REAL_KIND:
        below = ' data-credit="below"' if img in CREDIT_BELOW else ''
        return f' data-kind="{REAL_KIND[img]}"{below}'
    if img in REAL_CREDIT:
        return f' data-kind="Photo: {REAL_CREDIT[img][0]}, {REAL_CREDIT[img][1]}"'
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
    # Owner, 28 Nov 2026: the yarning-circle image did not fit this card; use the container clubhouse.
    'Adaptable clubhouses': 'card-index-clubhouses.webp',
    'A premium outdoor LED cinema': 'modular-led-concept.webp',
    'Public and private backing': 'hero-funding.webp',
}
for _t, _img in HOME_ORIGINALS.items():
    CARD[('index.html', _t)] = _img


# Cards that had no image before 26 Nov 2026 get their own new image. Owner rule: never
# replace an image that is already live; only fill cards that have none.
_NEW_CARDS = [
    ('sports.html', 'Beach rankings', 'card-stat-rankings', 'international beach volleyball teams lined up at a world tour event'),
    ('sports.html', 'Adelaide 2025', 'card-stat-adelaide', 'a beach volleyball championship stadium court in an Australian city'),
    ('sports.html', 'Paris 2024 crowd', 'card-stat-paris', 'a packed crowd watching Olympic style beach volleyball'),
    ('sports.html', '20 million players', 'card-stat-flag', 'young flag football players at a busy community festival'),
    ('sports.html', 'One million reached', 'card-stat-cricket', 'children playing a short format cricket game'),
    ('sports.html', '16 nations', 'card-stat-beach-soccer', 'an international beach soccer match in a stadium'),
    ('sports.html', 'Youth Olympics', 'card-stat-handball', 'young athletes playing beach handball'),
    ('sports.html', 'Mixed beach volleyball', 'card-sport-mixed-beach-volleyball', 'a mixed beach volleyball rally'),
    ('sports.html', 'Flag football', 'card-sport-flag-football', 'a flag football pull on a sand field'),
    ('sports.html', 'Beach cricket', 'card-sport-beach-cricket', 'a beach cricket match on a premium sand pitch'),
    ('sports.html', 'Beach football', 'card-sport-beach-football', 'a beach football shot at goal'),
    ('sports.html', 'Beach rugby league', 'card-sport-beach-rugby-league', 'beach rugby league players running the ball'),
    ('sports.html', 'Beach 5s rugby', 'card-sport-beach-5s-rugby', 'a fast beach 5s rugby game'),
    ('sports.html', 'AirBadminton', 'card-sport-airbadminton', 'an outdoor AirBadminton rally on sand'),
    ('sports.html', 'Beach tennis and net games', 'card-sport-beach-tennis-and-net-games', 'a beach tennis doubles point'),
    ('sports.html', 'Ultimate and flying disc', 'card-sport-ultimate-and-flying-disc', 'a beach ultimate catch in the end zone'),
    ('sports.html', 'Beach handball', 'card-sport-beach-handball', 'a beach handball shot at goal'),
    ('sports.html', 'Netball crossover', 'card-sport-netball-crossover', 'netball players passing on a sand court'),
    ('sports.html', 'AFL crossover', 'card-sport-afl-crossover', 'Australian football players marking on sand'),
    ('sports.html', 'Fitness and movement', 'card-sport-fitness-and-movement', 'a sand fitness and movement session'),
    ('sports.html', 'Island-made formats', 'card-sport-island-made-formats', 'a new island-made game on the sand'),
    ('grants.html', 'Community, sport and events', 'card-grant-council-community', 'a council-supported community sport and events day'),
    ('grants.html', 'Signature event potential', 'card-grant-signature-event', 'a signature beach sport event at golden hour'),
    ('grants.html', 'Active Clubs and participation', 'card-grant-active-clubs', 'a busy community club participation session'),
    ('grants.html', 'Games On! and infrastructure', 'card-grant-infrastructure', 'new community sport infrastructure being built'),
    ('grants.html', 'Gambling Community Benefit Fund', 'card-grant-gambling-fund', 'volunteers receiving new community club equipment'),
    ('grants.html', 'Indigenous-led sport and culture', 'card-grant-first-nations-sport', 'an Indigenous-led sport and culture day'),
    ('grants.html', 'Arts development', 'card-grant-arts-development', 'island artists developing new work'),
    ('grants.html', 'Skills and wellbeing', 'card-grant-youth', 'young people building skills and wellbeing'),
    ('grants.html', 'Film and regional arts', 'card-grant-film-arts', 'a regional film and arts production'),
    ('grants.html', 'GrantConnect and national programmes', 'card-grant-federal', 'a team preparing a national grant application'),
    ('grants.html', 'Philanthropic programme partners', 'card-grant-philanthropy', 'philanthropic partners visiting a community programme'),
    ('grants.html', 'Investment and operating partners', 'card-grant-private-investment', 'investment and operating partners reviewing a venue plan'),
    ('constitution.html', 'Sport and place', 'card-const-sport-place', 'sand sport played in an island setting'),
    ('constitution.html', 'Rights and voting', 'card-const-voting', 'members voting at a club general meeting'),
    ('constitution.html', 'AI-first and assets', 'card-const-ai-assets', 'club assets managed with digital tools'),
    ('constitution.html', 'Film club and culture', 'card-const-film-culture', 'a film club and culture evening'),
    ('sources.html', 'PLFC clubhouse', 'card-src-plfc', 'a community football clubhouse'),
    ('sources.html', 'Ballow Road hub', 'card-src-ballow-hub', 'a community hub planning session'),
    ('sources.html', 'Community Club Builder', 'card-src-club-builder', 'a community club builder workshop'),
    ('sources.html', 'Quandamooka Film Festival', 'card-src-film-festival', 'an outdoor film festival screening on a rigid LED wall'),
    ('sources.html', 'Quandamooka Country Events Engine', 'card-src-events-engine', 'an island events team planning a programme'),
    ('sources.html', 'Minjerribah Screen Media Network', 'card-src-screen-network', 'a screen media crew filming on the island'),
    ('assets.html', 'Multi-court sand system', 'card-asset-courts', 'a multi-court sand system'),
    ('assets.html', 'Field conversion kit', 'card-asset-field-kit', 'a field conversion kit being set out on sand'),
    ('assets.html', 'Modular clubhouse', 'card-asset-modular-clubhouse', 'a modular clubhouse beside sand courts'),
    ('assets.html', 'Dressing and showers', 'card-asset-showers', 'clean dressing rooms and showers'),
    ('assets.html', 'Lighting and electrical', 'card-asset-lighting', 'court lighting and electrical work'),
    ('assets.html', 'Permanent LED screen', 'card-asset-led-screen', 'a permanent rigid LED screen'),
    ('assets.html', 'Segmentable mobile panels', 'card-asset-mobile-panels', 'segmentable mobile LED panels'),
    ('assets.html', 'Broadcast and production', 'card-asset-broadcast', 'a broadcast production cabin at a beach sport event'),
    ('assets.html', 'Storage and vehicle', 'card-asset-storage', 'a club storage shed and van'),
    ('assets.html', 'Shade and spectators', 'card-asset-shade-spectators', 'a shaded spectator terrace beside sand courts'),
    ('assets.html', 'Market and festival kit', 'card-asset-market-kit', 'a festival market kit being set up'),
    ('assets.html', 'Resilience systems', 'card-asset-resilience', 'a crew securing a venue before a storm'),
    ('committee-assets.html', 'Site fit', 'card-cassets-site-fit', 'a site assessment walk at a coastal reserve'),
    ('committee-assets.html', 'Modular clubhouses', 'card-cassets-modular', 'a clubhouse module being craned into place'),
    ('committee-assets.html', 'Equipment stewardship', 'card-cassets-stewardship', 'an equipment officer lending club gear'),
    ('committee-events.html', 'Holiday programme', 'card-cevents-holiday', 'a family planning a holiday sport programme'),
    ('committee-events.html', 'Run sheets', 'card-cevents-run-sheets', 'an event lead checking a run sheet at dawn'),
    ('committee-events.html', 'Olympic decade', 'card-cevents-olympic', 'a world-class temporary beach sport stadium'),
    ('committee-film.html', 'Programming', 'card-cfilm-programming', 'a film club planning a screening season'),
    ('committee-film.html', 'Live broadcast', 'card-cfilm-live-broadcast', 'camera operators filming beach handball'),
    ('committee-film.html', 'Screen operations', 'card-cfilm-screen-ops', 'technicians checking the back of an LED wall'),
    ('committee-funding.html', 'Grant evidence', 'card-cfund-evidence', 'a grant writer assembling participation evidence'),
    ('committee-funding.html', 'Investment packs', 'card-cfund-investment', 'an investment pack being presented to partners'),
    ('committee-funding.html', 'Screen campaign', 'card-cfund-screen-campaign', 'a community screening on a rigid LED wall'),
    ('committee-governance.html', 'Agendas and minutes', 'card-cgov-agendas', 'a secretary preparing an agenda and minute book'),
    ('committee-governance.html', 'Officer roles', 'card-cgov-officers', 'a club officer handover on a deck'),
    ('committee-governance.html', 'Policies and consent', 'card-cgov-policies', 'a parent reading a consent form at registration'),
    ('committee-members.html', 'Expression of interest', 'card-cmem-eoi', 'a young woman filling in an interest form on her phone'),
    ('committee-members.html', 'Youth and family', 'card-cmem-youth-family', 'a family come and try session on sand'),
    ('committee-members.html', 'Volunteer care', 'card-cmem-volunteer-care', 'volunteers sharing a break after an event'),
    ('committee-publishing.html', 'Content review', 'card-cpub-review', 'editors reviewing a club web page'),
    ('committee-publishing.html', 'Role management', 'card-cpub-roles', 'a webmaster adjusting account permissions'),
    ('committee-publishing.html', 'Continuity', 'card-cpub-continuity', 'a continuity handover kit on a table'),
    ('committee-sport.html', 'League and tournament design', 'card-csport-league', 'organisers arranging a tournament bracket'),
    ('committee-sport.html', 'Club crossover', 'card-csport-crossover', 'netball players trying sand for the first time'),
    ('committee-sport.html', 'Surface and footprint', 'card-csport-surface', 'a groundskeeper measuring sand depth and court lines'),
    ('member-calendar.html', 'Training and matches', 'card-mcal-training', 'an evening beach volleyball training session'),
    ('member-calendar.html', 'Film and live sport', 'card-mcal-film-live', 'members watching live sport in the clubhouse lounge'),
    ('member-calendar.html', 'Availability', 'card-mcal-availability', 'a phone showing a weekly availability grid on a ferry'),
    ('member-crew.html', 'Court and field crew', 'card-mcrew-court', 'a volunteer crew raising a net at sunrise'),
    ('member-crew.html', 'Screen and broadcast crew', 'card-mcrew-broadcast', 'a mentor teaching a young camera operator'),
    ('member-crew.html', 'Visitor experience', 'card-mcrew-visitor', 'a volunteer welcoming visitors off a ferry'),
    ('member-equipment.html', 'Courts and fields', 'card-mequip-courts', 'an aerial view of a multi-court sand venue'),
    ('member-equipment.html', 'Modular LED', 'card-mequip-led', 'technicians assembling rigid modular LED panels'),
    ('member-equipment.html', 'Custody and maintenance', 'card-mequip-custody', 'a volunteer repairing a volleyball net'),
    ('member-film.html', 'Screening circle', 'card-mfilm-circle', 'a screening circle discussing a film'),
    ('member-film.html', 'Creative exchange', 'card-mfilm-exchange', 'a filmmaker and island creatives reviewing footage'),
    ('member-film.html', 'Sport television', 'card-mfilm-sport-tv', 'a club media volunteer interviewing an athlete'),
    ('member-sports.html', 'Mixed play and pathways', 'card-msports-mixed', 'a mixed social beach volleyball league night'),
    ('member-sports.html', 'A different surface', 'card-msports-surface', 'feet pushing off in deep soft sand'),
    ('member-sports.html', 'Variety on sand', 'card-msports-variety', 'several sand sports played side by side'),
    ('member-training.html', 'Coaching and movement', 'card-mtrain-coaching', 'a coaching course on sand'),
    ('member-training.html', 'Run the competition', 'card-mtrain-competition', 'a volunteer referee at a beach handball match'),
    ('member-training.html', 'Tell the story', 'card-mtrain-story', 'a teenage club reporter and photographer at work'),
    ('index.html', 'Sports interest survey', 'card-survey-home', 'island locals voting for sports with tokens in jars'),
]
SURVEY_ALT = {
    'mixed-beach-volleyball': 'two beach volleyball players answering a survey on a phone',
    'flag-football': 'a flag football group raising hands in a huddle',
    'beach-cricket': 'a family by a beach cricket pitch answering on a phone',
    'beach-football': 'beach football players on a goal frame answering on a phone',
    'beach-rugby-league': 'rugby league players on the sand answering a club poll',
    'beach-5s-rugby': 'a beach rugby team stacking hands for a cheer',
    'airbadminton': 'an older couple with racquets giving answers to a volunteer',
    'beach-tennis-and-net-games': 'beach tennis players comparing answers on their phones',
    'ultimate-and-flying-disc': 'an ultimate group in a spirit circle looking at a poll',
    'beach-handball': 'beach handball players passing a tablet along the bench',
    'netball-crossover': 'a mother and daughter netballer answering on a phone',
    'afl-crossover': 'Australian football players looking at a phone on the foreshore',
    'fitness-and-movement': 'a sunrise fitness group choosing an option on a phone',
    'island-made-formats': 'island locals sketching a new sand game',
}
for _slug, _alt in SURVEY_ALT.items():
    _NEW_CARDS.append((f'sport-{_slug}.html', 'Sports interest survey', f'card-survey-{_slug}', _alt))
for _p, _t, _img, _alt in _NEW_CARDS:
    key = (_p, _t)
    assert key not in CARD, f'{key} already has a live image; never replace it'
    CARD[key] = _img + '.webp'
    ALT[_img + '.webp'] = 'Concept image of ' + _alt

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

# Balanced all ages club set, approved by the owner for its suggested live slots.
# Only AI concept slots added since b1964e4 are swapped; the 19 originals and the
# owner's location photos are never touched. Replaced files stay in assets/ and
# are listed in the gallery as Previously used.
import json as _json, os as _os
_ROOT = _os.path.dirname(_os.path.abspath(__file__))
PROTECTED = {'flag-football-concept.webp', 'hero-community-builder.webp', 'hero-film.webp', 'hero-funding.webp', 'hero-home.webp', 'hero-markets.webp', 'hero-nearby.webp', 'hero-sports.webp', 'hero-trust.webp', 'hero-youth-elders.webp', 'modular-led-concept.webp', 'mozzie.webp', 'sandy-original-icon.png', 'sandy-original-logo.png', 'site-ballow-360-point-20.webp', 'site-ballow-aerial.webp', 'site-ballow-bay-tree.webp', 'site-ballow-roadside.webp', 'women-led-setup.webp'}
BALANCED = _json.load(open(_os.path.join(_ROOT, 'tools', 'balanced-set.json')))
SWAPPED = {}  # new file -> old file it replaced


def _swap(page, title, new, alt):
    table, key = (HERO, page) if title is None else (CARD, (page, title))
    old = table[key]
    assert old not in PROTECTED and not old.startswith(('site-', 'place-', 'map-')), f'{key} holds a protected image'
    table[key] = new
    ALT[new] = 'Concept image of ' + alt
    SWAPPED[new] = old


for _n, _slug, _age, _desc, _slot in BALANCED:
    _m = re.match(r'(\S+\.html) (?:page banner|card "(.*)")$', _slot)
    _swap(_m.group(1), _m.group(2), f'balanced-{_n}-{_slug}.webp', _desc[0].lower() + _desc[1:])

# Straddie scale: concept images that showed stadiums, arenas, floodlight towers or
# big concrete stands, redrawn at small to medium island scale in natural materials.
STRADDIE_SCALE = [
    ('assets.html', None, 'hero-assets-straddie', 'a small timber equipment shed and trailer beside sand courts in the bush'),
    ('committee-events.html', None, 'hero-committee-events-straddie', 'an evening community volleyball event with families on a grassy bank'),
    ('clubhouse.html', None, 'hero-clubhouse-straddie', 'a single storey timber clubhouse set into the dunes at dusk'),
    ('assets.html', 'Lighting and electrical', 'card-asset-lighting-straddie', 'an electrician at a timber switchboard with low wildlife friendly court lights'),
    ('committee-events.html', 'Olympic decade', 'card-cevents-olympic-straddie', 'a visiting youth and adult training camp on dune courts'),
    ('committee.html', 'Sport operations', 'card-com-sport-straddie', 'volunteers of three generations setting up a court'),
    ('film-club.html', 'Sport broadcasts', 'card-film-broadcast-straddie', 'a camera operator filming a community match with spectators on timber benches'),
    ('flag-football.html', '2032 cultures and sport', 'card-flag-expo-straddie', 'a small foreshore expo with junior flag football, marquees and a timber stage'),
    ('grants.html', 'Signature event potential', 'card-grant-signature-event-straddie', 'an aerial view of a small foreshore sand sport festival'),
    ('members.html', 'Event and media crew', 'card-mem-crew-straddie', 'a mixed age volunteer crew setting up seating and shade'),
    ('programme.html', 'Sand sport expo', 'card-prog-expo-straddie', 'a small sand sport expo in the bush with a stage and workshops'),
]
for _p, _t, _img, _alt in STRADDIE_SCALE:
    _swap(_p, _t, _img + '.webp', _alt)

# People and safety standard (owner, 27 Nov 2026): committee, governance, constitution
# and member images show women led or gender balanced groups across a mixed age range,
# everyone in sportswear or everyday clothes; amenities show private, lockable, fully
# enclosed cubicles with non slip drained floors. Failing images were redrawn and
# swapped in. Old files stay listed in the gallery, except the two the owner had deleted.
DELETED = {'hero-constitution.webp', 'card-fac-dressing-rooms.webp'}
STANDARD_REDRAWS = [
    ('hero-constitution.webp', 'hero-constitution-committee', 'a young Aboriginal woman leading a sporty, women led club committee reviewing the draft constitution on a clubhouse deck by the bay'),
    ('card-const-ai-assets.webp', 'card-const-ai-assets-equal', 'two women and a young man keeping the club asset register in the equipment store'),
    ('card-const-voting.webp', 'card-const-voting-equal', 'members of all ages voting by show of hands at a general meeting chaired by a woman'),
    ('card-com-governance.webp', 'card-com-governance-equal', 'a members meeting on the lawn led by a young woman and a First Nations elder'),
    ('card-com-welfare.webp', 'card-com-welfare-equal', 'a woman first aid officer caring for a teenage player with a young volunteer'),
    ('card-cassets-site-fit.webp', 'card-cassets-site-fit-equal', 'a facilities subcommittee site visit led by a First Nations woman'),
    ('card-cassets-stewardship.webp', 'card-cassets-stewardship-equal', 'a woman equipment officer signing out volleyballs to a member'),
    ('hero-committee-assets.webp', 'hero-committee-assets-equal', 'two women and a man surveying a possible court site by the bay'),
    ('card-cfilm-screen-ops.webp', 'card-cfilm-screen-ops-equal', 'a woman and a young man checking a modular LED screen at dusk'),
    ('card-cfilm-live-broadcast.webp', 'card-cfilm-live-broadcast-equal', 'a small club film crew of a woman, a teenage girl and a man covering beach handball'),
    ('card-cfund-investment.webp', 'card-cfund-investment-equal', 'a woman treasurer presenting an investment pack to two partners in the clubhouse'),
    ('card-cpub-roles.webp', 'card-cpub-roles-equal', 'a young woman webmaster updating account roles with the club secretary'),
    ('card-csport-league.webp', 'card-csport-league-equal', 'a mixed sport subcommittee arranging a tournament bracket'),
    ('card-mequip-led.webp', 'card-mequip-led-equal', 'a mixed volunteer crew assembling modular LED panels'),
    ('card-mem-skills.webp', 'card-mem-skills-equal', 'a woman coach running a mixed age volleyball skills clinic'),
    ('card-mfilm-exchange.webp', 'card-mfilm-exchange-equal', 'a filmmaker, a First Nations artist and a young photographer reviewing footage by the bay'),
    ('card-mtrain-competition.webp', 'card-mtrain-competition-equal', 'a woman referee and a young scorer running a beach handball match'),
    ('hero-member-crew.webp', 'hero-member-crew-equal', 'a mixed age crew of women and men building low timber bench seating'),
    ('hero-member-training.webp', 'hero-member-training-equal', 'a woman instructor leading a first aid class under a beach pavilion'),
    ('card-cmem-youth-family.webp', 'card-cmem-youth-family-equal', 'women and men coaches with families at a come and try session'),
    ('card-fac-dressing-rooms.webp', 'card-fac-dressing-rooms-private', 'private lockable shower and change cubicles with solid timber doors, an accessible family room and a non slip drained floor'),
    ('card-asset-showers.webp', 'card-asset-showers-private', 'a timber amenities block with private lockable cubicles, an accessible family room and an outdoor sand rinse station'),
]
for _old, _img, _alt in STANDARD_REDRAWS:
    _keys = [('h', k) for k, v in HERO.items() if v == _old] + [('c', k) for k, v in CARD.items() if v == _old]
    assert len(_keys) == 1, (_old, _keys)
    _kind, _key = _keys[0]
    _swap(_key, None, _img + '.webp', _alt) if _kind == 'h' else _swap(_key[0], _key[1], _img + '.webp', _alt)

# Balanced site wide pass (owner approval, 27 Nov 2026): the remaining concept images that
# showed one gender only, adults only where a mix fits, or stadium scale were redrawn.
SITEWIDE_REDRAWS = [
    ('card-index-flag.webp', 'sport-flag-football-island', 'mixed social flag football on island sand with a woman referee and families watching'),
    ('card-index-capital.webp', 'grants-capital-island', 'a mixed build team framing a modest timber clubhouse beside sand courts'),
    ('card-stat-paris.webp', 'card-stat-paris-island', 'island families watching beach volleyball on a mobile LED screen on the foreshore'),
    ('card-stat-adelaide.webp', 'card-stat-adelaide-island', 'a teenage girls pair practising blocks with their coach on a dune court'),
    ('card-stat-rankings.webp', 'card-stat-rankings-island', 'a junior and teen development squad practising serves at sunrise with two coaches'),
    ('card-stat-beach-soccer.webp', 'card-stat-beach-soccer-island', 'a mixed teen beach soccer session with women and men coaches'),
    ('card-grant-infrastructure.webp', 'card-grant-infrastructure-equal', 'small scale sand court works with a woman engineer and a First Nations environmental officer'),
    ('card-grant-private-investment.webp', 'card-grant-private-investment-equal', 'partners reviewing a model of timber sand courts on a bayside deck'),
    ('card-sport-beach-cricket.webp', 'card-sport-beach-cricket-family', 'three generations playing family beach cricket'),
    ('card-sport-beach-rugby-league.webp', 'card-sport-beach-rugby-league-mixed', 'mixed beach rugby league with a woman referee'),
    ('card-sport-island-made-formats.webp', 'card-sport-island-made-formats-mixed', 'families and elders trying an island made rebound net game'),
    ('card-survey-afl-crossover.webp', 'card-survey-afl-crossover-mixed', 'Australian football players of mixed ages answering a survey on a phone'),
    ('card-survey-beach-handball.webp', 'card-survey-beach-handball-mixed', 'beach handball players of mixed ages answering the survey on a bench'),
    ('card-survey-beach-rugby-league.webp', 'card-survey-beach-rugby-league-mixed', 'beach rugby league players answering a club poll at sunset'),
    ('card-asset-broadcast.webp', 'card-asset-broadcast-mixed', 'a woman producer, a teenage volunteer and an older camera operator in a small courtside booth'),
    ('card-asset-mobile-panels.webp', 'card-asset-mobile-panels-mixed', 'two volunteers setting up a small mobile screen from segmented LED panels'),
    ('card-asset-resilience.webp', 'card-asset-resilience-mixed', 'a mixed crew securing a shade sail before a storm'),
    ('card-ch-facilities.webp', 'card-ch-facilities-mixed', 'facilities volunteers walking a headland site with a First Nations man'),
]
for _old, _img, _alt in SITEWIDE_REDRAWS:
    _keys = [('h', k) for k, v in HERO.items() if v == _old] + [('c', k) for k, v in CARD.items() if v == _old]
    assert len(_keys) == 1, (_old, _keys)
    _kind, _key = _keys[0]
    _swap(_key, None, _img + '.webp', _alt) if _kind == 'h' else _swap(_key[0], _key[1], _img + '.webp', _alt)

# Real island photography (owner rule, 27 Nov 2026): AI images are only for sport, club and
# cinema content. Concept images whose main subject was the island itself were replaced with
# reusable Wikimedia Commons photographs. Full credits are in LICENSE.md.
# new file -> (old file, author, licence, subject, alt)
REAL_PHOTOS = {
    'real-straddie-aerial.webp': ('card-index-three-towns.webp', 'J Brew', 'CC BY-SA 2.0', 'aerial view of North Stradbroke Island',
        'Photo of an aerial view over the northern end of Minjerribah (North Stradbroke Island) and Moreton Bay'),
    'real-main-beach-point-lookout.webp': ('hero-member-calendar.webp', 'S. Newrick', 'CC BY-SA 4.0', 'Main Beach from Point Lookout',
        'Photo of Main Beach stretching south from Point Lookout (Mulumba) on Minjerribah'),
    'real-amity-point-jetty.webp': ('card-const-sport-place.webp', 'Pacificwizard', 'CC0', 'Amity Point jetty at sunset',
        'Photo of the grassed foreshore and jetty at Amity Point (Pulan) in the late afternoon'),
    'real-brown-lake-bummiera.webp': ('card-prog-country.webp', 'John Tann', 'CC BY 2.0', 'Bummiera (Brown Lake)',
        'Photo of Bummiera (Brown Lake) on Minjerribah reflecting clouds and bush'),
    'real-gorge-walk-point-lookout.webp': ('card-ch-calendar.webp', 'Saruman-the-white', 'CC BY-SA 4.0', 'the Gorge Walk at Point Lookout',
        'Photo of rocky headlands and clear water seen from the Gorge Walk at Point Lookout'),
    'real-dunwich-beach-barges.webp': ('card-src-ballow-hub.webp', 'Debra Jordan', 'CC BY 3.0', 'the beach at Dunwich',
        'Photo of a wave splashing over old barge remains on the beach at Dunwich (Goompi)'),
    # Owner feedback: the aerial did not read as three towns, so the card now shows one real photo of each town.
    'real-three-towns.webp': ('real-straddie-aerial.webp', 'Tanya Dedyukhina, Pacificwizard and NJM2010', 'CC BY 3.0 and CC0', 'Dunwich, Amity Point and Point Lookout',
        'Three real photos side by side: Harold Walker Jetty, Dunwich; the beach at Amity Point at sunset; and the Point Lookout lighthouse, each labelled with its town name'),
}
REAL_KIND['real-three-towns.webp'] = 'Photos: Tanya Dedyukhina, CC BY 3.0; Pacificwizard, CC0; NJM2010, CC0'
REAL_PARTS = {'real-three-towns.webp': [
    ('Dunwich', 'Herold Walker jetty', 'Tanya Dedyukhina', 'CC BY 3.0', 'https://creativecommons.org/licenses/by/3.0', 'https://commons.wikimedia.org/wiki/File:Herold_Walker_jetty_-_panoramio.jpg'),
    ('Amity Point', 'Amity Point at sunset', 'Pacificwizard', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Amity_Point_at_Sunset._North_Stradbroke_Island,_Queensland,_Australia.jpg'),
    ('Point Lookout', 'Point Lookout lighthouse', 'NJM2010', 'CC0', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en', 'https://commons.wikimedia.org/wiki/File:Point_Lookout_Stradbroke_lighthouse_2021.jpg'),
]}
REAL_SOURCES = {
    'real-three-towns.webp': ('https://commons.wikimedia.org/wiki/File:Herold_Walker_jetty_-_panoramio.jpg', 'https://creativecommons.org/licenses/by/3.0'),
    'real-main-beach-point-lookout.webp': ('https://commons.wikimedia.org/wiki/File:View_of_Main_Beach_from_Point_Lookout_(North_Stradbroke_Island).JPG', 'https://creativecommons.org/licenses/by-sa/4.0'),
    'real-amity-point-jetty.webp': ('https://commons.wikimedia.org/wiki/File:Amity_Point_Jetty_at_Sunset._North_Stradbroke_Island,_Queensland,_Australia.jpg', 'https://creativecommons.org/publicdomain/zero/1.0/deed.en'),
    'real-brown-lake-bummiera.webp': ('https://commons.wikimedia.org/wiki/File:Brown_Lake_-_Boumiera_(49698290361).jpg', 'https://creativecommons.org/licenses/by/2.0'),
    'real-gorge-walk-point-lookout.webp': ('https://commons.wikimedia.org/wiki/File:Gorge_Walk_North_Stradbroke_Island.JPG', 'https://creativecommons.org/licenses/by-sa/4.0'),
    'real-straddie-aerial.webp': ('https://commons.wikimedia.org/wiki/File:North_Stradbroke_Island_01.jpg', 'https://creativecommons.org/licenses/by-sa/2.0'),
    'real-dunwich-beach-barges.webp': ('https://commons.wikimedia.org/wiki/File:Summer_Splash_(217752559).jpeg', 'https://creativecommons.org/licenses/by/3.0'),
}
for _new, (_old, _who, _lic, _what, _alt) in REAL_PHOTOS.items():
    _keys = [('h', k) for k, v in HERO.items() if v == _old] + [('c', k) for k, v in CARD.items() if v == _old]
    assert len(_keys) == 1, (_old, _keys)
    _kind, _key = _keys[0]
    _swap(_key, None, _new, '') if _kind == 'h' else _swap(_key[0], _key[1], _new, '')
    ALT[_new] = _alt
    REAL_CREDIT[_new] = (_who, _lic, _what)

# Owner image review, 28 Nov 2026: slots whose picture did not match the card. Each
# takes an unused image from the gallery, so zero reuse still holds. The images they
# replace stay as files and show in the gallery as Previously used.
OWNER_FIXES = [
    # Pickleball on a blue hard court did not suit a sand club card.
    ('sports.html', 'Beach tennis and net games', 'card-sport-beach-tennis-and-net-games.webp', 'a beach tennis doubles point on sand'),
    # A scenic headland with nobody in it did not suit "Island calendar and people".
    ('clubhouse.html', 'Island calendar and people', 'card-ch-teams.webp', 'club members in a huddle on the sand outside the clubhouse'),
    # An empty function room did not suit the grants and opportunity register desk.
    ('committee-funding.html', None, 'card-com-grants.webp', 'an officer keeping the club grants register up to date'),
]
# card-com-grants moves here from the retired committee.html redirect page, which nobody sees;
# that card takes another unused gallery image so it still has one.
_swap('committee.html', 'Grants and investment', 'card-cfund-investment.webp', 'partners reviewing a club investment pack')
OWNER_RETIRED = {'balanced-15-seniors-pickleball.webp', 'real-gorge-walk-point-lookout.webp'}
for _p, _t, _img, _alt in OWNER_FIXES:
    _swap(_p, _t, _img, _alt)


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


HERO_CAPTION = {'donate.html': 'Concept image only; not an approved design. The screen would be mobile, segmented LED panels that can be set up at venues across the island.'}


def _hero(page):
    def rep(m):
        img = HERO.get(page)
        if not img:
            return f'<section class="page-hero no-image">{m.group(1)}</section>'
        cap = REAL_CAPTION if img.startswith('site-ballow-') else HERO_CAPTION.get(page, CONCEPT_CAPTION)
        if img in REAL_CREDIT:
            who, lic, what = REAL_CREDIT[img]
            cap = f'Real photo: {what} by {who}, {lic}, via Wikimedia Commons; cropped and resized. Facilities and events on this page are proposed.'
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
