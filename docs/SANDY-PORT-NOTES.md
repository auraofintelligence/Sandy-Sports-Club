# Sandy Sports Club port: source and setup notes

This directory is a staging fork of the PLFC clubhouse code. It is not a deployed Sandy service. The PLFC production database, showcase database, secrets, accounts, sessions, invitations, and member records must never be imported here.

## Isolated backend settings

- Wrangler uses the distinct Worker name `sandy-sports-clubhouse` and two new D1 database names. The `DB` and `SHOWCASE_DB` identifiers are deliberately `REPLACE_WITH_NEW_SANDY_D1_DATABASE_ID` and `REPLACE_WITH_NEW_SANDY_SHOWCASE_D1_DATABASE_ID`. Create two empty, independent Sandy D1 databases and replace each with its own new ID. Do not use PLFC IDs.
- The inherited five-minute scheduled trigger has been disabled. Do not enable member reminders, newsletter delivery, or other scheduled email work until Sandy's policy, consent, delivery configuration, and notices have been reviewed.
- Email delivery requires Sandy's own HTTPS `NOTICE_SITE_ORIGIN`. Gmail delivery also requires `NOTICE_GMAIL_FROM` and its own OAuth credentials. No sender is configured and no cron is active by default, so no scheduled message is sent.
- Set new, independent `PRIVATE_AUTH_KEY` and `SHOWCASE_AUTH_KEY` secrets for Sandy's real and demonstration databases. Do not share PLFC's key or reuse the real key for showcase sign-in. The sign-in endpoints report setup required without their keys.
- Password sessions use the `__Host-sandy_session` cookie. Shop request references use `SANDY-` and their matching routes recognize the same prefix.
- The old PLFC showcase D1 binding was replaced with an unconfigured Sandy placeholder. Its database must use sanitized Sandy schema and synthetic demonstration content only; no production account, member data, or invitation may be copied. The view-only API boundary is enforced in `worker/showcase.mjs`.

## Initial data policy

- Sandy's public events and programme arrays start empty. No competition or prizes are claimed as confirmed. Calendar names and future event UIDs use Sandy's identity; the `.invalid` UID domain is a temporary, non-routable placeholder until Sandy selects a permanent domain.
- Migrations 0056 and 0057 create no PLFC wish records. Migration 0060 introduces eight Sandy equipment ideas from the existing public assets page as committee drafts with zero goals, zero collected money, and no publication. They are leads for committee review, not approved purchases or pledges. Migration 0061 adds six clearly labeled grant leads at the checking stage; none asserts an application, eligibility decision, award, or funder commitment.
- The membership structure and categories are preserved. There are zero actual Sandy member accounts, zero active office invitations, and no preconfigured birthday discount values. The one requested demo member is a labeled UI preview only, without a login or database row.
- Migration 0059 creates five separate office account records with exact office logins and roles, random unusable verifier material, and `disabled=1`. Its five office slots are `reserved` but have no assigned person. There are no sessions, invitations, or active office logins. A Webmaster may later issue a one-use activation link to a reserved office; claiming it sets the verifier, enables that account, and assigns its slot in one database batch. Disabling an officer closes sessions and returns the slot to reserved.
- First Webmaster provisioning uses `POST /api/auth/bootstrap` with `login: "webmaster"`, a chosen password of at least 12 characters, and a 64-character lowercase hex `SANDY_BOOTSTRAP_TOKEN` supplied as a new environment secret. The endpoint creates exactly one administrator while no administrator exists. Remove the bootstrap secret after successful setup. Neither credential nor active invitation is in source or migrations.
- The demo Webmaster is a separate account in the showcase DB, created later through a controlled invitation from the real Webmaster. Showcase API access is view only; no demonstration credential or active invitation is seeded.
- Merchandise can be represented by generic demonstration catalogue entries without prices or checkout links. The Treasurer must confirm any fees, merchandise prices, offers, stock, and payment links before publication or fulfillment.

## Work still required before deployment

1. Audit **every** inherited migration and Worker module for PLFC-specific content, policy identifiers, fishing records, example meetings, prices, domain names, cookies, routes, and mail copy. Migration 0056/0057 alone do not remove the earlier inherited seeds. Apply the clean migrations to an empty Sandy D1 instance and verify zero member accounts and no live invites.
2. Adapt the public and committee UI, navigation, office roster, member preview, joining flow, grants, newsletter, and wish empty states to Sandy. The static PLFC assets are still copied into this staging fork unless separately edited.
3. Review the Webmaster view switch and ensure an effective office/member view never grants unlogged mutations or exposes private production data. `X-Sandy-View-As` projects office roles on GET/HEAD only for a verified Webmaster; the member preview is UI-only. The demo account uses the separate showcase DB and API method guard. Three inherited GET side effects (member lifecycle, committee newsletter, meeting reminders) now skip their writes in read-only views and showcase mode; audit new GET endpoints for writes as the port grows.
4. Configure Sandy's domain, contact routes, privacy and consent text, payment provider, email delivery, and new secrets only when approved and available. Verify the final Wrangler binding and run an end-to-end staging check before publishing.

No production deploy or database migration is authorized by this source preparation.
