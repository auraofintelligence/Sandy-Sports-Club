# Gate A merge and controlled release checklist

This is a proposed release procedure, not approval to merge or activate services. Preserve the existing Worker and D1 IDs. Main is auto-deployed, so a merge is a production change. Do not add the showcase binding, create remote resources, apply migrations, change secrets, or run a remote recovery without owner approval.

## Pre-merge

- [ ] Record exact reviewed commit and successful GitHub validation: standard, integration and isolated Chromium tests. Review the authoritative matrix, including unresolved failures and operational holds.
- [ ] Verify the deployed Worker name, current version and production D1 identifier in Cloudflare privately; confirm distinct PLFC bindings and no production keys in repository or CI.
- [ ] Confirm owner can access the existing account and secret custody. Verify actual reserved roles and no active pending invitation links through authorised private review; do not change accounts during review.
- [ ] Verify a protected backup/export or Time Travel bookmark and rollback target, including approved custody of the original authentication pepper. Do not export actual data to GitHub, chat, or fixture databases.
- [ ] Rehearse additive migration `0002_private_library.sql` against an existing fictional database and restore encrypted binary content. Do not rerun the original production migration. The code tolerates absent private-library tables and missing encryption key; leave uploads disabled until its separately approved deployment.
- [ ] Approve and provision only a separate synthetic showcase D1 (never a copy of live D1) and its independent access key, or explicitly defer that capability until a later provisioning release. Use the documented fixture generator. Verify the deployed binding points to the new database, not the real club.
- [ ] Verify reviewed public file allowlist and Worker-first private routes using Cloudflare's [asset configuration](https://developers.cloudflare.com/workers/static-assets/binding/) and [routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/) documentation. Check static assets of the exact candidate build; do not assume SQLite/browser tests prove deployed asset handling.
- [ ] Confirm `SANDY_CLUB_APPROVALS`, `SANDY_INVITES_ENABLED` and `SANDY_PRIVATE_LIBRARY_ENABLED` remain disabled. No outbound provider, payment, real membership or publication changes.
- [ ] Obtain explicit owner release approval. Decide whether to include the additive library migration now or keep library unavailable. Record the approved production build and fallback Worker version.

## Controlled merge and immediate checks

- [ ] Merge only the reviewed, passing commit. Main deploys to the existing Worker. Never recreate or reset D1 or bootstrap the Webmaster.
- [ ] Confirm deployment completed and expected commit/version is running. Check the public site's navigation and core static assets.
- [ ] Signed-out GET/HEAD requests to private APIs, source/backup/credential paths must return denial/unavailable, with no private data. Check no-store headers on APIs and private shells. Confirm actual public pages still work.
- [ ] Real Webmaster signs in non-destructively and verifies existing IDs, actual reserved accounts, no pending invitations, and existing records. Confirm synthetic role switching and independent showcase, if provisioned, cannot access live data or write. No activation or publication test with real records.
- [ ] Compare the deployed state against the pre-release manifest. Stop if a binding, account, record, approval or invitation state unexpectedly changes. Roll back the Worker to the verified previous version if needed; code rollback does not restore D1.
- [ ] Record actual evidence and mark only satisfied matrix units Accepted. A merge is not Gate A acceptance by itself. Begin Gate B after required Gate A verification and explicit operational holds are recorded.

## Current hold

The draft PR remains unmerged. Local/CI isolated tests are not actual Cloudflare provisioning or live acceptance. The new file library remains off by default. Its malware scanning, approved retention/deletion, binary backup/restore and encryption key custody must precede real uploads. The provisional minor-safety policy is not adopted. No formal authority, invitations or member services are activated by this checklist.

Cloud-run `tests/wrangler-release.mjs` uses the actual Wrangler/workerd runtime, with both D1 identifiers replaced by fresh fictional IDs and no Cloudflare credentials, `--local` only, and disposable state. It checks asset packaging, no-store shells, D1 login, atomic task handoff, separate view mode and encrypted synthetic download. This is not a live deployment or a remote D1 rehearsal. Require a successful run in addition to Chromium before merge.
