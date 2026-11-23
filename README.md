# Sandy Sports Club proposal

A 47-page proposal site for a mixed beach volleyball-led, three-town sand sports and culture club on Minjerribah / North Stradbroke Island. It includes flag football, cricket, football, beach rugby league and 5s, AirBadminton, tennis, ultimate, handball, netball, AFL crossover and fitness, plus an internal film club, events, markets and a modular LED screen network.

The public pages cover site options, facilities, asset wishes, grants and investment, dedicated sport and skills pages, a film club, a PLFC v1.2-inspired constitution builder with a women-led committee option, a space planner, an illustrative $50,000 screen equipment funding visualisation, and email nominations for joining, committee roles and partner clubs. The Sandy committee room has browser-local meeting, officer task, event, grant, wish, member safeguard, film, newsletter, social, sponsor, AGM and handover desks. The grants page names five researched programmes checked on 23 November 2026 and links to their official sources. Eight proposed equipment wishes link to the relevant research leads. No real membership account, payment gateway, donor ledger, land tenure or event approval exists yet.

## Build and hosting

Run `python build_pages.py` after editing generated page content. The resulting HTML and shared CSS/JS can be served directly from the repository root. `wrangler.jsonc` describes a Cloudflare Worker static assets deployment. The original illustrations and Mozzie mascot are under `assets/`. `site.js` supplies a complete page directory and a previous/next cycle covering all 47 pages; `club-tools.js` supplies the local committee and grant/wish views.

Forms at `join.html` prepare an email addressed to `sbt4183@gmail.com`; the visitor sends it in their own email application. The funding counter accepts scenario inputs only and never presents an unverified amount as donations received.

The site is stewarded by Luke Nathan Hayes / Strange But True under the [interim public source licence](LICENCE.md) while the club forms. See [asset and third-party notes](LICENSE.md). The separate [Strange But True site](https://auraofintelligence.github.io/strange-but-true/) links the proponent's event, media and grant work.

## 365-day content and advertising planner

Open [social-planner.html](social-planner.html), or use Committee > Social planner. The **calendar is the main workspace**. Select any month and open the collapsible **Plan this month** panel to adjust daily frequency and caps, the QLD/NSW school-holiday and weekend patterns, the video share, audiences, proposed membership classes and opt-in gender audiences, publishing channels, and fifteen independently configurable category pattern layers. Category layers have independent on/off, frequency, priority and show/hide controls; hiding a layer never deletes posts.

**Preview month** shows the proposed counts and checks. **Apply to this month** only changes unedited suggestions in that month, preserving manually edited, explicitly locked, Approved, Scheduled and Published posts. **Undo** restores the previous state. **Copy month's settings** copies choices to other months without changing their content. The post list below the calendar supports selecting multiple posts for bulk editing of format, platform, audience, status, time and date shift. Individual post details have editable titles, captions, audience choices, locks, timing, notes and status. Exported CSV is ordered by date and carries a version label for the PLFC-informed platform image, video, Shorts/Reels and paid-ad export profiles.

The existing 365-day content library includes fifteen categories, including health and wellbeing, with QLD and NSW visitor holiday patterns, Thursday/Friday/Saturday weather placeholders, newsletters, countdowns and related-topic 30-second video briefs. Monthly settings and edited posts stay only in the current browser's local storage; export CSV for backup or shared review. This is **not a shared committee database**. No automatic posting, SMS, email, audience matching, live weather, account access or advertising expenditure is connected. Audience/gender labels are editorial plans, never inferred or extracted from real member records. Follow privacy, consent and ad-platform rules before using actual targeting or publishing. Weather, events, raffles, grants and donation claims require current verification and appropriate authorisation.

The planner HTML and JavaScript are standalone; running `python build_pages.py` will not overwrite them. A Cloudflare deployment must still be verified separately after repository changes.

## Before real accounts or payments

A secure Worker and database, individual role invitations, consent and safeguarding, an eligible recipient and account, donation terms, audited donation records, and current screen quotations must be established. The demos do not create production identity or shared data.

Deployment source: the existing Cloudflare Worker is connected to this repository's `main` branch.
