# Sandy Sports Club proposal

A 48-page proposal site for a mixed beach volleyball-led, three-town sand sports and culture club on Minjerribah / North Stradbroke Island. It includes flag football, cricket, football, beach rugby league and 5s, AirBadminton, tennis, ultimate, handball, netball, AFL crossover and fitness, plus an internal film club, events, markets and a modular LED screen network.

The public pages cover site options, facilities, asset wishes, grants and investment, dedicated sport and skills pages, a film club, a PLFC v1.2-inspired constitution builder with a women-led committee option, a space planner, an illustrative $50,000 screen equipment funding visualisation, and email nominations for joining, committee roles and partner clubs. The Sandy committee room has browser-local meeting, officer task, event, grant, wish, member safeguard, film, newsletter, social, sponsor, AGM and handover desks. The grants page names five researched programmes checked on 23 November 2026 and links to their official sources. Eight proposed equipment wishes link to the relevant research leads. No real membership account, payment gateway, donor ledger, land tenure or event approval exists yet.

## Build and hosting

Run `python build_pages.py` after editing generated page content. The resulting HTML and shared CSS/JS can be served directly from the repository root. `wrangler.jsonc` describes a Cloudflare Worker static assets deployment. The original illustrations and Mozzie mascot are under `assets/`. `site.js` supplies a complete page directory and a previous/next cycle covering all 48 pages; `club-tools.js` supplies the local committee and grant/wish views.

Forms at `join.html` prepare an email addressed to `sbt4183@gmail.com`; the visitor sends it in their own email application. The funding counter accepts scenario inputs only and never presents an unverified amount as donations received.

The site is stewarded by Luke Nathan Hayes / Strange But True under the [interim public source licence](LICENCE.md) while the club forms. See [asset and third-party notes](LICENSE.md). The separate [Strange But True site](https://auraofintelligence.github.io/strange-but-true/) links the proponent's event, media and grant work.

## Sandy Social Studio and 365-day simple planner

Open [social-studio.html](social-studio.html) from Committee > Social Studio for the PLFC-inspired Day / Week / Month workbench. It includes Sandy sports layers, a visual annual calendar with one icon per post, Queensland and NSW holidays, public holidays, week/day templates, event lead-ins, posting-time editing, 30-second combined video briefs, versioned paid/organic media formats, browser-local revision history, CSV event and performance imports, and a proposed in-house / Ready SET Co-op production handoff ledger. **This is not a deployed authenticated committee service.** All revisions and evidence references on Sandy are browser-local and unauthenticated, so no logged action proves an officer approved or assigned work. Connected account roles and D1 history remain a separate production gate.

The older simpler pattern planner remains available at [social-planner.html](social-planner.html). The **seven-day calendar starts completely empty** with 365 dates and no prefilled posts. It is user-driven: open the **Patterns & frequency sliders** panel, switch on only the categories you want, and use a separate slider for each enabled category (1–7 posts per week). There are 15 categories, including health and wellbeing; the existing topic library remains available as reference data but does **not** generate canned post ideas, captions or articles. Unused calendar days show only the date.

Additional independent patterns (all off initially) cover weekend and Friday lead-ins, QLD/NSW school holidays, Thursday/Friday/Saturday weather checks, monthly newsletters and day-before holiday countdowns. Each has its own on/off toggle and rate slider. The official holiday dates remain visible as markers without creating any posts. Adjust the daily limit (1–8), video share (67% suggested), proposed audience labels, channels and whether paid-ad variations should even be considered.

**Moving a slider immediately previews how many blank slots would appear on which dates**, shown in the calendar as uncommitted preview counts. Choose **Apply patterns to month** to save only that month, or **Apply these patterns to all 365 days** to extend the same configuration across the year. Existing manually edited, locked, Approved, Scheduled and Published posts survive reapplication. **Undo** can restore the previous saved plan. Copying settings to selected months does not itself create posts. Clicking an empty date also allows adding a manual blank post. Individual drafts can have titles, captions, formats, audiences, times, status, notes and publication locks; the month roster allows bulk editing.

The exportable CSV remains chronological and includes the versioned PLFC-informed media-format presets for YouTube, Facebook, Instagram, TikTok and the proposed Straddie Noticeboard Network (including paid-ad creative dimensions). Video slots can be planned as approximately 30-second content with related subtopics, but the actual subject and wording are yours to choose.

**Storage:** the fresh calendar uses a new local browser storage namespace (`v3`) and does not migrate or erase the older prefilled `v2` drafts. Saved changes remain on that browser, not in a shared committee database. Export a CSV backup if you intend to work across devices. No SMS, automatic posting, emails, member-record access, live weather fetches or advertising expenditure are enabled. Voluntary gender, audience and membership labels are editorial planning choices, not inferred member profiles or automatic advertising targeting. Current forecasts, events, raffles, grants, donation requests and legal eligibility need review before any actual publication.

The planner HTML and JavaScript are standalone; running `python build_pages.py` will not overwrite them. Cloudflare deployment is separate from committing a GitHub change.

## Before real accounts or payments

A secure Worker and database, individual role invitations, consent and safeguarding, an eligible recipient and account, donation terms, audited donation records, and current screen quotations must be established. The demos do not create production identity or shared data.

Deployment source: the existing Cloudflare Worker is connected to this repository's `main` branch.
