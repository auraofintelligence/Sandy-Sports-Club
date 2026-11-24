# Sandy Sports Club: shared Cloudflare clubhouse

## Current status and ownership

Sandy's full Worker is configured in `wrangler.jsonc`, bound to the independent D1 database `sandy-sports-clubhouse`. The user's 24 November 2026 live screenshots confirmed that the first real Webmaster account was created and could sign in to My Clubhouse. Cloudflare builds from GitHub's `main` branch.

**Do not recreate the database, bootstrap the Webmaster a second time, copy PLFC keys, or apply the original migration again.** The permanent `SANDY_AUTH_PEPPER` stays in Cloudflare secrets. The one-use `SANDY_BOOTSTRAP_KEY` must be removed from Cloudflare following successful initial setup.

The club is still a proposal. No claim is made that every PLFC workflow or external automation is complete and live-tested.

## Current code

- `worker/auth.mjs`: password login, real Webmaster, reserved staff accounts, manually prepared 48-hour officer invitation links
- `worker/people.mjs`: prospective people, membership class, consent, town, joining/renewal fields and revision controls
- `worker/records.mjs`: legacy shared generic records, still available for existing drafts
- `worker/suite.mjs` and `worker/suite-actions.mjs`: validated structured workflows, role controls, D1 revisions/audit, meeting follow-up tasks, audited stock receive/issue
- `studio/sandy-suite-spec.js`: 29 Sandy-specific domain workflows, adapting PLFC for sand sports, film, facilities, membership, grants, events and governance
- `club-suite-ui.js` and `club-workflow-assist.js`: stage-by-stage forms, editing, CSV/Markdown/ICS export, minutes drafts, newsletters, stock calculations and review packs
- `club-committee.js` and `club-admin.html`: the actual Committee room in My Clubhouse, preview roles, Social Studio, constitution builder and office invitations
- `worker/member-workspace.mjs` and `member-home.js`: member-only preferences, interests, own-data export and one synthetic preview member (not a login)
- `social-studio.html` and `studio/`: shared day/week/month social campaign planning
- `constitution.html` and `constitution.js`: Sandy constitution builder plus original PLFC Constitution V1.2 comparison in the PLFC Google Drive

**Still not delivered at PLFC's full depth:** real shop orders and payments, automated email/SMS delivery, automatic birthday codes, club-to-club partner handover acceptance, member-to-member social networking, AI meeting transcription, private binary-document storage, calendar sync, or formal governing approvals. These need additional code, authorisation, provider configuration and live acceptance tests. A similar-looking menu is not evidence of parity.

## Boundaries

- `SANDY_CLUB_APPROVALS=disabled`: no formal approvals, memberships or published club claims
- `SANDY_INVITES_ENABLED=disabled`: no unattended invitation delivery; a real signed-in Webmaster may only generate an explicit private officer setup link
- No paid API, payments, SMS, automated social publishing or advertising expenditure
- The one synthetic member is labelled preview-only; no real account or private member data is seeded
- Real writes record officer account, office, UTC timestamp, changes and revision number. The Webmaster role-preview does not impersonate another identity

Voluntary C-Hours are not cash balances, wages or financial exchange. If used, they remain separate from money.

## Tests and deployment

GitHub Actions runs JavaScript syntax checks, the original schema migration on a clean SQLite database, existing Sandy frontend tests, and real SQLite-backed suite integration tests for meeting edit/version conflicts, grants, member consent, meeting follow-up tasks, stock movements and audit.

These tests **do not replace live authenticated acceptance testing** against the deployed Worker.

Cloudflare GitHub Builds automatically deploys `main` using `npx wrangler deploy`. This release uses existing `club_records`, `club_revisions` and `club_audit` tables. No new D1 database, secret, ZIP upload or paid service is required for these workflow screens.

Preserve PLFC's separate Worker, keys and database; they are not changed by Sandy commits.
