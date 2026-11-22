# Sandy Sports Club proposal

A colourful, static public proposal for an island-wide mixed beach volleyball and sand sports club on Minjerribah / North Stradbroke Island. This is **not an existing club, confirmed venue, event calendar, membership portal, Games affiliation or grant award**.

## Site

- `index.html`, `styles.css`, `app.js`: a responsive, buildless site for Cloudflare static assets or any simple web host.
- `assets/`: eight illustrative WebP scenes from the owner's [Ballow Road Sand & Screen Hub](https://github.com/auraofintelligence/ballow-road-sand-screen-hub) and the existing Mozzie mascot from the owner's [Amity Point project](https://github.com/auraofintelligence/amity-point). These images show possibilities, not current facilities or events. Mozzie's appearance is reused; no PLFC club or member data has been copied.
- Space planner: court/pitch dimensions, buffers, gaps and counts are editable. FIVB's 16 � 8 m playing court and 3 m minimum free zone seed volleyball. Beach soccer's 35-37 � 26-28 m pitch seeds football. Beach cricket uses an explicitly provisional 40 � 30 m social sketch. The computed envelope is rectangular and excludes amenities, circulation beyond the chosen gap, environmental buffers and irregular land shape.
- Brief builder: works entirely in the visitor's browser. No form submission, list, member login or database exists.

## Proposal boundaries

Three possible town footholds: Dunwich / Goompi, Amity Point and Point Lookout. The two Dunwich land ideas (10-12 Ballow Road and the former Cunningham Road silica sand loading area) remain separate site options. The club can begin with portable activity and investigate one or several facilities. No land tenure, site condition, permission, cultural partnership, design or funding is asserted. Shared programming with existing sports clubs is an invitation for discussion, not an agreement.

The PLFC clubhouse is a **functional reference** for a future public calendar, committee desk and member system. Do not reuse its fishing data, officer accounts, D1 bindings, fees or club identity. Establish a Sandy Sports entity, policies and access rules before adding real accounts, payments or private records.

## Sources and connected proposals

Source drafts supplied by the proponent include *Sandy Sports Convergence*, *Sandy Sports A Proposal 1st Draft*, *Sandy Sports and Film Festival*, *Sports, Film, Regional Magnetism* and *Quandamooka Film Festival*. The public [Community Club Builder source map](https://github.com/auraofintelligence/community-club-builder-sandy-sports/blob/main/docs/09-source-map.md) records the shared club-first, site-later framing. The private PDFs are background proposals, not evidence of approval.

- [FIVB beach volleyball rules 2025-2028](https://www.fivb.com/wp-content/uploads/2025/02/FIVB-BeachVolleyball_Rules2025_2028-EN-v01.pdf): 16 � 8 m playing court and minimum 3 m free zone for general rules.
- [Beach Soccer Laws 2025-26](https://assets.the-afc.com/downloads/referees/Beach-Soccer-Laws-of-the-Game-2025-26.pdf): 35-37 � 26-28 m pitch. The site's 3 m external buffer is a planning input.
- [ICC Criiio](https://www.icc-cricket.com/criiio/about): recreational cricket has flexible formats and places. The site's cricket dimensions are only a working sketch.
- [Redland City Council island disaster profile](https://www.redland.qld.gov.au/Community-safety-and-health/Disasters-and-emergencies/Prepare-for-disasters/Suburb-disaster-profiles-and-risks/North-Stradbroke-Island-disaster-profile): second-largest sand island and town geography.
- [Council coastal adaptation](https://www.redland.qld.gov.au/About-Council/Committees-and-working-groups/Coastal-Adaptation-and-Amity-Point-Shoreline-Erosion-committees): dynamic shoreline, storms and cyclones.
- [Council grants and sponsorship](https://www.redland.qld.gov.au/Grants-and-sponsorship), [Queensland sport funding](https://www.sport.qld.gov.au/sport/funding-programs) and [Games On!](https://qldspirit.sport.qld.gov.au/games-on): check current programme terms and rounds before applying.
- [Quandamooka Film Festival proposal](https://github.com/auraofintelligence/quandamooka-film-festival), [Quandamooka Country Events Engine](https://github.com/auraofintelligence/quandamooka-country-events-engine) and [Minjerribah Screen Media Network](https://auraofintelligence.github.io/minjerribah-screen-media-network/network/): separate creative and event pathways, requiring their own permissions and leaders.

## Publish

Serve the repository root as a static site. For Cloudflare Workers static assets use the included `wrangler.jsonc`; for Cloudflare Pages use the root directory as output with no build command. Update `robots.txt` and `sitemap.xml` if the final public domain differs from the Workers URL. Keep the site public only when the owner chooses to announce the proposal.

