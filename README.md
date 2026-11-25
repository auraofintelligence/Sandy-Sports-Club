# Sandy Sports Club | Proposed community club and digital clubhouse

Sandy Sports is a proposed mixed-sport, three-town community club for Minjerribah / North Stradbroke Island. The vision centres on mixed beach volleyball, supported by flag football, beach cricket, football, beach rugby, AirBadminton, tennis and net sports, ultimate, handball, fitness, wellbeing, inclusive recreation, modular outdoor LED cinema and local cultural programming.

The digital clubhouse adapts the architecture and useful workflows of the Point Lookout Fishing Club (PLFC) platform to Sandy's own sporting, film, facility, event and community needs. It is not intended to copy fishing-specific content, actual PLFC members, credentials or data.

**Status: active development and founding review.** No incorporated club, elected committee, approved membership, adopted constitution, approved event, established venue or land tenure is asserted.

**README reviewed: 25 November 2026. Source snapshot: 24 November 2026.**

## Current deployment and public entry points

[Open Sandy Sports Club](https://sandy-sports-club.auraofintelligence.workers.dev/)

The earlier static-assets-only deployment description is superseded. The current `wrangler.jsonc` configures the Sandy Worker, static assets and its own D1 database, `sandy-sports-clubhouse`. The [backend operations notes](backend/README.md) record the first real Webmaster setup and successful login on 24 November, based on the owner's screenshots. Cloudflare Git builds target the main branch.

This establishes the intended shared backend and a reported successful initial login, not proof that every subsequent feature is deployed or works end-to-end. The live environment has not been independently acceptance-tested during this documentation review.

| Area | Purpose |
| --- | --- |
| [Home](https://sandy-sports-club.auraofintelligence.workers.dev/) | Club vision and community invitation |
| [Sports](https://sandy-sports-club.auraofintelligence.workers.dev/sports.html) | Fourteen proposed sport and activity pages, led by mixed beach volleyball |
| [Programme](https://sandy-sports-club.auraofintelligence.workers.dev/programme.html) | Proposed activities and programme development |
| [Places](https://sandy-sports-club.auraofintelligence.workers.dev/places.html) | Three-town and location context |
| [Facilities](https://sandy-sports-club.auraofintelligence.workers.dev/facilities.html) and [space planner](https://sandy-sports-club.auraofintelligence.workers.dev/space-planner.html) | Proposed shared facilities, sports spaces and modular outdoor cinema |
| [Film club](https://sandy-sports-club.auraofintelligence.workers.dev/film-club.html) | Local filmmaking, screenings and production ideas |
| [Grants](https://sandy-sports-club.auraofintelligence.workers.dev/grants.html), [assets](https://sandy-sports-club.auraofintelligence.workers.dev/assets.html) and [support](https://sandy-sports-club.auraofintelligence.workers.dev/donate.html) | Funding and equipment preparation, not active fundraising or payment collection |
| [Constitution](https://sandy-sports-club.auraofintelligence.workers.dev/constitution.html) | Founding constitution builder and PLFC reference comparison |
| [Take part](https://sandy-sports-club.auraofintelligence.workers.dev/interest.html) | Consent-gated expressions of interest, dependent on Turnstile configuration |
| [Sign in](https://sandy-sports-club.auraofintelligence.workers.dev/club-login.html) | Authentication for the shared club system |
| [My Clubhouse](https://sandy-sports-club.auraofintelligence.workers.dev/club-admin.html) | Authenticated staff workspaces and Webmaster administration |
| [My Membership](https://sandy-sports-club.auraofintelligence.workers.dev/member-home.html) | Prospective member self-service and a separately labelled synthetic layout preview |
| [Social Studio](https://sandy-sports-club.auraofintelligence.workers.dev/social-studio.html) | Authenticated annual communications planning |

Public pages are informational and do not grant access to private records. Server-side API authorisation, not hidden navigation controls, must enforce access.

## Accounts, offices and role previews

The account design supports a real Webmaster, reserved prospective President, Vice President, Secretary, Assistant Secretary, Treasurer and committee roles, plus future member and view-only Webmaster demo roles.

The real Webmaster can reserve accounts, explicitly prepare private 48-hour officer setup links, revoke account access, review records and inspect alternative navigation layouts. No invitations are automatically generated or sent. Preparing a link is a deliberate action, not a formal appointment.

One fictional member is provided as a **preview-only profile**, not an active login or enrolment. The intended separate view-only Webmaster demo has a synthetic overview path with restricted API access. The current ordinary activation workflow is limited to prospective committee officers; a usable separate demo-account activation and full synthetic read-only walkthrough still need to be completed and verified.

Webmaster role preview changes the visible layout, not the authenticated identity. It must not be used as proof of effective permission isolation for actual officer accounts. Test each real role in a separate session before inviting other people.

## My Clubhouse: 29 structured workflow desks

The source now includes 29 domain-specific desks in `studio/sandy-suite-spec.js`. They use structured fields, working stages, server validation, shared D1 records, optimistic version checks and audit history. These are a substantial improvement over a browser-local committee mock-up, but the existence of a desk is not evidence of complete operational parity with PLFC.

| Area | Structured desks |
| --- | --- |
| Committee governance | Committee notices, officer to-do lists, newsletter desk, officer handover, meetings and minutes, AGM preparation, documents and register, membership automations |
| Partnerships and events | Ready SET Co-op requests, sport/film/community events, fundraising and collections, club assets and loans, sponsors and supporters, grant register, results/prizes/sponsors |
| Finance and safeguards | Shop/stock/prices, member ages and safeguards |
| Membership operations | Membership and volunteer applications, return and renewal planning, member packs, types and numbers, member notices and delivery, birthday offers, email awaiting delivery |
| Sports and production | Sports and coaching calendar, venue/court/screen bookings, volunteers and event roles, film/media programme, external connections and approvals |

The committee interface provides direct tool links, role-specific desk navigation, editing and review history, assisted minutes and newsletter drafts, checklists and CSV/Markdown/ICS exports where implemented.

Recent source additions include:

- Explicit meeting follow-up handoff to separately tracked tasks, with idempotency and audit records.
- Audited stock receipts/issues with version and balance checks.
- Consent-gated local meeting audio recording, stopped and downloaded to the user's device. Audio is not uploaded or transcribed automatically.
- A Webmaster request inbox with submission, unread/open counters, internal replies and audited review. Cross-workspace authorisation and private-record isolation require additional acceptance checks before sensitive information is used.

Formal club approvals remain disabled in the deployed configuration. Drafts, tasks, proposed dates, indicative grants, equipment wishes and production plans must not be presented as official decisions or contracted work.

## People, membership and member workspace

The prospective people register supports names, joining/renewal fields, town, membership class/status, voluntary demographic information and consent, with search, sorting and revision controls.

The member-workspace source includes:

- Own linked membership details, when an authorised account exists.
- Sports preferences, availability, film, volunteering and community interests.
- Own preference and interest records, and own-data export.
- Future approved events, notices and newsletters, separated from committee drafts.
- A single fictional Webmaster-accessible layout preview.

Real member self-service remains gated by the club-establishment setting and an active linked membership. The ordinary account activation flow for members is not complete. There is no automatic membership admission, fee collection or active member seeded by the code.

Do not assume that the member page, a reserved account or an application record establishes a working membership lifecycle. Future work must include an appropriately authorised admission and activation workflow, fee/payment verification where agreed, member communications and lifecycle handling, privacy and youth safeguards, and role-specific acceptance testing.

## Social Studio: Sandy-specific annual communications

Sandy uses the core PLFC Day/Week/Month planning architecture with a sport, film, wellbeing and community taxonomy, rather than fishing-specific posts.

- 32 topic layers, configurable post minimums and maximums for day types, and a target video mix of roughly 67%.
- Year/month calendar, reusable weekly day archetypes, individual daily edits and minute-level Brisbane-time scheduling.
- Visible per-post icons and distinct Past/Today/Future date treatments, current-day navigation and QLD/NSW school holiday signals.
- Public holidays, planned event lead-ins, recaps, annual event imports and spontaneous additions; tentative dates must remain clearly identified.
- Production format and placement guidance for YouTube, Facebook, Instagram, TikTok and the proposed Straddie Noticeboard distribution pathway.
- Shared authenticated settings, individual post edits, performance import records, officer/Webmaster attribution, versioned history and conflict checks.
- Shared brainstorming records, production briefs, proposed Ready SET Co-op work requests, review states and published-link records.

No automatic posting, SMS, ad purchase, external commission or publication approval is triggered by generating a plan. The production handoff is a proposal until authorised by the relevant organisation.

Earlier [Social Studio preview](social-studio-preview.html), [simple social planner](social-planner.html) and [founding committee demo](committee.html) are preserved as separate browser-local work. Imports require a deliberate review and save; local drafts are not official records.

The [PLFC comparison notes](studio/PLFC-PARITY.md) describe an earlier stage of implementation. Their local-only/backend-not-deployed statements are historical and must be read alongside the newer [backend notes](backend/README.md), current Worker and shared Studio adapters.

## Remaining PLFC-equivalence work

The goal is equivalent useful club capability, not a one-to-one copy of fishing content or a collection of similarly named forms. The current implementation still needs substantial development and acceptance testing.

| Capability | Current position |
| --- | --- |
| Committee workflows | Structured, versioned working records and selected workflow helpers; deeper office-specific lifecycle and cross-desk integration need completion |
| Meetings | Agenda/minutes working fields, task handoff, exports and local audio capture; automatic transcription, approved minutes release, recording archive and comprehensive meeting lifecycle remain unfinished |
| Accounts and previews | Real Webmaster, reserved officer mechanism and synthetic member preview; full separate view-only Webmaster demo, complete future member activation and per-role acceptance checks outstanding |
| Member lifecycle | Prospective register and gated member portal; complete admission, renewals, payment verification, notifications and member services not yet equivalent |
| Shop and finance | Stock receive/issue and pricing-related drafts; live shop orders, receipts, payment integration, full reporting and reconciliation remain outstanding |
| Club communication | Shared notices, newsletter and email-queue drafts, internal help and Social Studio; automatic email delivery, full publication lifecycle, birthday codes and calendar sync remain outstanding |
| Member participation | Sports, volunteering and film interests; deeper registrations, results, member interaction and safeguarding workflows still need development |
| Records and access | Server checks on dedicated APIs; consistent cross-workspace record-level authorisation, restricted-record isolation, review and backup/restore testing remain essential |
| External connections | Proposed Ready SET Co-op briefs and publication links; actual partner acceptance, agreements and external service activation not implemented |
| Private documents and media | Record metadata and local exports; private binary document storage, managed recording storage and media lifecycle remain unfinished |

Do not enable real membership, sensitive records, invitations to prospective officers or formal approvals solely because the interface resembles PLFC. Keep existing authorisation gates until the owner has accepted the relevant functionality.

## Technical architecture

| Component | Implementation |
| --- | --- |
| Public pages | Standalone HTML, CSS, browser JavaScript and local assets |
| Cloudflare Worker | `worker/index.mjs` routes authenticated APIs and static assets |
| Database | Separate Sandy D1 binding `DB`, configured in `wrangler.jsonc` |
| Schema | `backend/migrations/0001_club.sql`, accounts, sessions, invites, people, interest, records, Studio data, revisions and audit |
| Authentication | `worker/auth.mjs`; password verifier, secure session cookie, role checks, rate limiting and explicit invitation workflow |
| Structured desks | `worker/suite.mjs`, `worker/suite-actions.mjs`, shared schema and workflow assistants |
| Social Studio | `studio/`, `worker/social.mjs`, `worker/briefs.mjs` |
| Member services | `worker/member-workspace.mjs`, `worker/member.mjs`, `member-home.js` |
| Webmaster support | `worker/help.mjs`, `club-help.js` |
| Public intake | `worker/people.mjs`, `interest.js`, Turnstile and contact consent |
| Validation | GitHub Actions, Node.js 22 syntax and unit tests, clean SQLite schema checks and SQLite-backed Worker integration tests |

The generic register remains available for earlier drafts. Its relationship with newer structured and private workflows must be reviewed before wider use. Private data belongs in the dedicated protected database, never public static assets or source control.

Preserve `.assetsignore` exclusions for Worker source, migrations, backend material, credentials and tests from the deployed asset bundle. Do not use `build_pages.py` to overwrite manually maintained Studio or clubhouse pages.

## Maintenance, deployment and verification

The active configuration uses the existing dedicated database. `wrangler.full.example.jsonc` is an earlier placeholder example, not a second deployment target.

- Do not recreate the Sandy database, repeat Webmaster bootstrap, reset the permanent auth secret or blindly reapply the original migration.
- Confirm that the one-use bootstrap secret has been removed after setup.
- Keep `SANDY_CLUB_APPROVALS=disabled` and `SANDY_INVITES_ENABLED=disabled` until the owner explicitly authorises a change. Manual officer setup links are distinct from automatic invitations and should not be issued during review.
- Preserve PLFC's independent database, keys and accounts.
- Verify Turnstile configuration and actual public interest intake before inviting submissions.
- Back up the current production data and verify restoration before schema or major workflow changes.

Run the source checks with Node.js 22 and Python 3:

```sh
python3 tests/schema-check.py
node --test tests/*.test.mjs
node --experimental-sqlite --test tests/*.integration.mjs
```

The [24 November validation run](https://github.com/auraofintelligence/Sandy-Sports-Club/actions/runs/45385614820) for commit `e28a764` completed successfully. That is evidence of the configured automated checks, not a comprehensive security audit or proof of Cloudflare deployment success. Test definitions include meeting revisions, grant validation, stock movements, member isolation and internal help workflows. Wider cross-route and live authenticated acceptance coverage is still required.

Follow [backend operations](backend/README.md) for the existing deployment. Do not deploy the placeholder example or reuse PLFC credentials.

## Related projects and ownership

- [Point Lookout Fishing Club](https://github.com/auraofintelligence/PLFC-members-club): reference architecture and comparison, separate club and records.
- [Ready SET Co-op](https://ready-setco.auraofintelligence.workers.dev/index.html): proposed cooperative participation and potential media/service collaboration, not a contracted provider.
- [Ready SET Co-op hyperlocal media](https://auraofintelligence.github.io/ready-set-co-op-hyperlocal-media/): related production planning.
- [Straddie Noticeboard Network](https://straddie-noticeboard-cloudflare.auraofintelligence.workers.dev/): separate public information platform and potential distribution channel.
- [Ballow Road Sand & Screen Hub](https://auraofintelligence.github.io/ballow-road-sand-screen-hub/): related proposed facility and place research.

The project is currently stewarded by its proponent, Luke Nathan Hayes / Strange But True. Original material is under the [interim Strange But True Public Source Licence](LICENCE.md); see [third-party and asset notes](LICENSE.md). No approval, partnership, funding or commercial licence is implied by these links.

**Development boundary:** this is a working foundation under active construction, not a completed PLFC-equivalent club platform. Maintain the separation between public proposals, private development records and future legitimate club decisions.
