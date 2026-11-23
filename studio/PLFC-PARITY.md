# PLFC Social Studio comparison: Sandy Sports (24 November 2026)

This compares the current `main` branch of [PLFC-members-club](https://github.com/auraofintelligence/PLFC-members-club) with Sandy Sports' `studio/` modules. The PLFC and Sandy clubs are **not the same entity**, and Sandy Sports remains a proposal.

## The core Studio has been carried over

All 14 core PLFC Studio modules and their exported functions exist in Sandy and have been checked against their current PLFC counterparts. Sandy adapts the content taxonomy, sports, scheduling and presentation without changing the original PLFC repository.

| PLFC capability | Sandy implementation | Status |
|---|---|---|
| 12-month calendar, day/week/month views | `social-studio.html` and `studio/social-campaigns.js` | Implemented |
| Pattern frequencies, day-type posting min/max, video target | `studio/social-campaign-engine.js` | Implemented, larger maximums, layers disabled initially |
| Visible topic icons, weekly totals, per-date details | `studio/social-visual-ui.js` | Implemented, responsive icon grid and time sorting |
| **Past / Today / Future** | Visual labels, high-contrast states, Brisbane-date key and Go to today button | Improved in Sandy |
| Public holidays and QLD/NSW holidays | Holiday and calendar modules | Implemented; check annual updates |
| Lead-in/recap/event/milestone signals | Engine and insights panel | Implemented, planning signals only |
| Minute-by-minute editing and day-part suggestions | Per-post editor and Sandy timing cues | Implemented |
| Day archetypes and weekly patterns | `social-day-patterns.js` and `social-day-ui.js` | Adapted for sport, wellness, film |
| Paid/organic platform export profiles | `social-placements.js` and format guide | Implemented as planning presets, no ad accounts |
| Browser CSV performance imports and charts | `social-performance.js`, `social-insights-ui.js` | Implemented |
| Calendar CSV / local committee event imports | Event import modules plus Sandy demo importer | Implemented; local demo event dates remain tentative |
| Settings history and revisions | Browser-local adapter and version list | Implemented **locally only** |
| Production brief routing and evidence links | Sandy `sandy-workflows.js` | Implemented **locally only** |
| Brainstorming / ideas capture | New `sandy-brainstorm.js` ideas inbox | Implemented as user-led local drafts, with no canned PLFC fishing starters |

## PLFC components deliberately not represented as live Sandy functions

The separate PLFC `public/social-planner.js`, `public/social-brainstorm.js`, `public/social-channels.js` and `public/social-guidance.js` provide a **club-specific** posting and brainstorming layer around the Studio, including actual PLFC account links and fishing content. Sandy has its own simple 365-day calendar, committee demo, idea inbox and production handoff rather than a misleading copy of PLFC's live channels or actual member data.

PLFC Worker endpoints `worker/social-planner.mjs`, `worker/social-campaign-settings.mjs`, `worker/social-campaign-history.mjs` and `worker/social-brainstorm.mjs` work with authenticated accounts and its real database. **No equivalent secure Sandy backend is deployed.** The preparation is documented in `studio/backend/README.md` with a proposed D1 schema. Until implemented, do **not** claim any Sandy revision, producer assignment, officer signature, approval or published link is authenticated. Browser-local records can survive a refresh but are not a shared or independently verifiable committee audit.

No SMS, publication, member enrolment, contract creation, advertising spend, outbound messaging or live profile synchronisation is connected. Proposed Ready SET Co-op handoffs are not assignments until appropriately authorised.

## Current interface and preservation

- The new Studio uses its own local revision keys. The pre-existing simple planner retains its own browser storage and remains reachable.
- `studio/sandy-studio.css` adds explicit Past/Today/Future visual distinction without losing the individual post icons or QLD/NSW markers.
- Past is slate grey with a **PAST** label; Today is strongly outlined green with **TODAY**, and Future is sky blue with **FUTURE**. The colour key appears above the calendar and today's Brisbane date is stated. The jump button works within the selected planning year.
- An optional collapsed Sandy ideas desk accepts original, user-written concepts, category selection, editorial notes, archive/restore and deliberate local handoffs. Nothing is inserted into the calendar or sent to Ready SET Co-op automatically.

## Further activation gates

1. Form and authorise the club or agree the legitimate controller and founding group.
2. Build an authenticated Sandy Worker/D1 record system with signed officer IDs, roles, revocable access, server timestamps, verified decisions and immutable revision history.
3. Connect any approved production accounts or publishing services, with separate permission for production, review and publication.
4. Integrate actual member/volunteer data only under privacy, safeguarding and consent controls.
5. Establish genuine Sandy social profiles and approved external publishing links before presenting them as live.
6. Keep platform placement specifications, seasons, school holiday dates and signals source-verified.

**Verification:** An isolated 24 November 2026 regression check rendered consecutive Past/Today/Future cells correctly, including a single `aria-current="date"`; it confirmed time-sorted icons, date status classes and a Go to today handler. A browser-mock smoke test saved, archived and transferred a local idea to an **unsaved** production brief. These checks do not substitute for end-to-end Cloudflare browser testing or a secure backend audit.
