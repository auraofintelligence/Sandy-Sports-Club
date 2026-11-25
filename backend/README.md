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
- `SANDY_INVITES_ENABLED=disabled`: no new officer setup link can be issued or redeemed. Opening activation requires a separate owner-approved configuration change and an explicit real Webmaster action; no automated delivery. Active-account recovery and revocation are separate manual actions, not new appointments.
- No paid API, payments, SMS, automated social publishing or advertising expenditure
- The one synthetic member is labelled preview-only; no real account or private member data is seeded
- Real writes record officer account, office, UTC timestamp, changes and revision number. The Webmaster role-preview does not impersonate another identity

Voluntary C-Hours are not cash balances, wages or financial exchange. If used, they remain separate from money.

## Account recovery and revocation

- A real Webmaster can prepare or replace a recovery link for an existing active non-Webmaster account. The link expires in 48 hours, is purpose-separated from activation, and is not sent automatically. Redeeming it revokes prior sessions. A pending link can be revoked without changing the account; sessions can be revoked without resetting the password; disabling an account removes sessions and unused links.
- An authenticated account owner (except the view-only demo) can change their password from the sign-in page using the current password. All sessions and pending recovery links are revoked. The original Webmaster account and ID are preserved.
- If the sole Webmaster loses both their password and active sessions, do not rerun bootstrap or create a second administrator. No public self-service recovery for that scenario is implemented. A protected offline recovery utility and isolated rehearsal are in [RECOVERY.md](RECOVERY.md); remote execution requires separate verified owner approval and a protected atomic D1 maintenance adapter (SEC-03/SEC-12 remain open).

## Tests and deployment

GitHub Actions runs JavaScript syntax checks, the original schema migration on a clean SQLite database, existing Sandy frontend tests, and real SQLite-backed suite integration tests for meeting edit/version conflicts, grants, member consent, meeting follow-up tasks, stock movements and audit.

These tests **do not replace live authenticated acceptance testing** against the deployed Worker.

Cloudflare GitHub Builds automatically deploys `main` using `npx wrangler deploy`. This release uses existing `club_records`, `club_revisions` and `club_audit` tables. No new D1 database, secret, ZIP upload or paid service is required for these workflow screens.

Preserve PLFC's separate Worker, keys and database; they are not changed by Sandy commits.

## Separate read-only showcase and role previews (Gate A)

Both owner role previews and independent showcase require a new D1 binding named `SANDY_SHOWCASE_DB`. Owner previews use an HttpOnly signed cookie bound to the real Webmaster session; the independent showcase has its own high-entropy secret and no real account. The view has precedence over any live cookie and cannot fall back to live data. No production binding or deployment settings have been changed.

1. Create a NEW isolated D1 database, for example `sandy-sports-showcase`, never the existing Sandy or PLFC database. Do not copy production data or credentials.
2. Generate fresh synthetic SQL with `node backend/showcase/seed.mjs > /tmp/sandy-showcase.sql`. Verify the new database's ID and name before executing only there. The generator refuses an existing club schema at the first CREATE TABLE, produces example desks/history/help/Studio, fictional reserved officers and exactly one unlinked member. It does not emit DROP or DELETE. Do not apply the original migration first.
3. Configure `SANDY_SHOWCASE_DB` to the new database. For independent access configure Cloudflare secret `SANDY_SHOWCASE_KEY` with 64 cryptographically random lowercase hexadecimal characters, never commit or share the key publicly. Use a separate browser session for independent sign-in. No actual invitations are created.
4. Verify the fixture binding in an isolated deployment before the live Worker changes. All view mutations and private member export are denied. Synthetic exports can be inspected. Missing, mixed or wrong bindings fail closed.

Cloudflare provisioning, actual browser workflows and restore rehearsal require additional evidence. The fixture generator and SQLite integration tests do not change live resources.

## Recovery rehearsal and release controls

See [Sandy recovery and release runbook](RECOVERY.md). The isolated SQL export/restore integration test does not read or modify live D1 and does not certify production backup or recovery.

## Private file library (proposed, disabled)

Additive migration `0002_private_library.sql` defines private metadata, immutable encrypted content versions and file parts. No file is seeded in live D1. The library requires a separate 64-character random hexadecimal `SANDY_LIBRARY_KEY` Cloudflare secret. Do not reuse the auth pepper, copy production keys to showcase, or commit keys. New uploads, access grants and replacements remain off unless separately approved through `SANDY_PRIVATE_LIBRARY_ENABLED=enabled`. Withdrawal remains possible for a signed-in authorised custodian. PDF, PNG and JPEG only, up to 1 MiB, attachment downloads with short-lived identity/version-bound tickets. This is the bounded D1-backed pattern adapted from PLFC, not public file hosting or an activated R2 integration. Retain encrypted versions and audit evidence; establish an approved retention, deletion, scanning and backup policy before enabling actual uploads. A separate release and redaction workflow is still required for member-facing club documents.
