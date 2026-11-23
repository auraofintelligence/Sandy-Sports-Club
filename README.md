# Sandy Sports Club proposal

A 47-page proposal site for a mixed beach volleyball-led, three-town sand sports and culture club on Minjerribah / North Stradbroke Island. It includes flag football, cricket, football, beach rugby league and 5s, AirBadminton, tennis, ultimate, handball, netball, AFL crossover and fitness, plus an internal film club, events, markets and a modular LED screen network.

The public pages cover site options, facilities, asset wishes, grants and investment, dedicated sport and skills pages, a film club, a PLFC v1.2-inspired constitution builder with a women-led committee option, a space planner, an illustrative $50,000 screen equipment funding visualisation, and email nominations for joining, committee roles and partner clubs. The Sandy committee room has browser-local meeting, officer task, event, grant, wish, member safeguard, film, newsletter, social, sponsor, AGM and handover desks. The grants page names five researched programmes checked on 23 November 2026 and links to their official sources. Eight proposed equipment wishes link to the relevant research leads. No real membership account, payment gateway, donor ledger, land tenure or event approval exists yet.

## Build and hosting

Run `python build_pages.py` after editing generated page content. The resulting HTML and shared CSS/JS can be served directly from the repository root. `wrangler.jsonc` describes a Cloudflare Worker static assets deployment. The original illustrations and Mozzie mascot are under `assets/`. `site.js` supplies a complete page directory and a previous/next cycle covering all 47 pages; `club-tools.js` supplies the local committee and grant/wish views.

Forms at `join.html` prepare an email addressed to `sbt4183@gmail.com`; the visitor sends it in their own email application. The funding counter accepts scenario inputs only and never presents an unverified amount as donations received.

The site is stewarded by Luke Nathan Hayes / Strange But True under the [interim public source licence](LICENCE.md) while the club forms. See [asset and third-party notes](LICENSE.md). The separate [Strange But True site](https://auraofintelligence.github.io/strange-but-true/) links the proponent's event, media and grant work.

## 365-day content and advertising planner

Open [social-planner.html](social-planner.html), or use Committee > Social planner. This simple, browser-local demo produces one daily anchor topic for 365 consecutive days plus extra weekend, QLD/NSW school-holiday and lead-in ideas. It includes 15 topic categories drawn from this site, health and wellbeing, weekly weather-check placeholders, monthly newsletter briefs, proposed five-channel formats (YouTube, Facebook, Instagram, TikTok and the future Straddie Noticeboard Network), approximately 67% video, suggested organic and paid placements, content status/notes, and a CSV export. The planner stores drafts only in your own browser. It cannot publish, book ads, send newsletters or spend money. Paid suggestions have no authorised budget.

The calendar has independently maintained holiday ranges currently covering late 2026 to early 2028, with links to official dates on the planner page. Refresh those ranges before rolling the plan into later years. News, weather forecasts, venues, events, competitions, grants and fundraising require current verification and appropriate approvals before any public claim. The social planner HTML and JavaScript are standalone, so running `python build_pages.py` will not overwrite them.

## Before real accounts or payments

A secure Worker and database, individual role invitations, consent and safeguarding, an eligible recipient and account, donation terms, audited donation records, and current screen quotations must be established. The demos do not create production identity or shared data.

Deployment source: the existing Cloudflare Worker is connected to this repository's `main` branch.
