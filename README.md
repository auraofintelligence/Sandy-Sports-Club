# Sandy Sports Club proposal

A 46-page proposal site for a mixed beach volleyball-led, three-town sand sports and culture club on Minjerribah / North Stradbroke Island. It includes flag football, cricket, football, beach rugby league and 5s, AirBadminton, tennis, ultimate, handball, netball, AFL crossover and fitness, plus an internal film club, events, markets and a modular LED screen network.

The public pages cover site options, facilities, asset wishes, grants and investment, dedicated sport and skills pages, a film club, a PLFC v1.2-inspired constitution builder with a women-led committee option, a space planner, an illustrative $50,000 screen equipment funding visualisation, and email nominations for joining, committee roles and partner clubs. Member, committee and Webmaster demo desks store fictional working notes in each visitor's browser. No real membership account, payment gateway, donor ledger, land tenure or event approval exists yet.

## Build and hosting

Run `python build_pages.py` after editing generated page content. The resulting HTML and shared CSS/JS can be served directly from the repository root. `wrangler.jsonc` describes a Cloudflare Worker static assets deployment. The original illustrations and Mozzie mascot are under `assets/`.

Forms at `join.html` prepare an email addressed to `sbt4183@gmail.com`; the visitor sends it in their own email application. The funding counter accepts scenario inputs only and never presents an unverified amount as donations received.

The site is stewarded by Luke Nathan Hayes / Strange But True under the [interim public source licence](LICENCE.md) while the club forms. See [asset and third-party notes](LICENSE.md). The separate [Strange But True site](https://auraofintelligence.github.io/strange-but-true/) links the proponent's event, media and grant work.

## Before real accounts or payments

A secure Worker and database, individual role invitations, consent and safeguarding, an eligible recipient and account, donation terms, audited donation records, and current screen quotations must be established. The demos do not create production identity or shared data.
