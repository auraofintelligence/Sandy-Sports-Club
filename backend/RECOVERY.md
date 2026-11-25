# Sandy recovery and release runbook

Status: isolated rehearsal procedure. No live backup, restoration, credential rotation, schema change, deployment or Cloudflare resource creation has been authorised or performed by this branch.

## 1. Boundaries and access

- Confirm the current Sandy production Worker, account, D1 name and exact D1 ID against the unchanged `wrangler.jsonc`. PLFC and the showcase are separate. Never use a shorthand binding for an operation if it could resolve to the wrong database.
- Designate the real Webmaster and an owner-approved backup custodian. Do not send backup exports, database IDs with credentials, tokens or passwords through chat, email, GitHub, CI artifacts or public asset folders. Backups contain private records and password verifiers. Restrict access, encrypt at rest and in transit, and record custody and retention decisions.
- Preserve the existing `SANDY_AUTH_PEPPER` through a separately controlled secret-management recovery plan. Do not copy it into SQL exports, code or a test environment. Production backups must never be used as ordinary development or showcase data. The existing Webmaster account must not be recreated and bootstrap must remain closed.
- The sole Webmaster's lost-password recovery requires a separately owner-approved, identity-verified operation. A Worker code rollback alone cannot recover the account or restore database rows.

## 2. Pre-release record

Record the current Git commit, deployed Worker version, current database ID, migration list, timestamp and health state privately. Identify the last known compatible Worker version and whether any change has migrations. This Gate A branch proposes additive `0002_private_library.sql`; it has not been applied to production. The original `0001_club.sql` must not be repeated. For future migrations, record ordered migration names and their hashes, rehearse them against a fictional copy, verify foreign keys, and do not repeat the original production migration. A pre-change schema and row-count manifest must agree with the expected target before proceeding.

When authorised, use the current official [D1 SQL export/import instructions](https://developers.cloudflare.com/d1/best-practices/import-export-data/) to export the explicitly verified database to a protected path, for example:

```sh
umask 077
npx wrangler d1 export <verified-database-name> --remote --output=<protected-backup-path>
```

Do not paste a real export into GitHub or CI. Hash and encrypt the export in the protected environment; preserve the hash and export time separately. Check the D1 Time Travel state and bookmark before material database changes if supported. Cloudflare's [Time Travel documentation](https://developers.cloudflare.com/d1/reference/time-travel/) describes retention and recovery for the account's plan. A time-travel restore overwrites its target database; it is not a non-destructive preview.

## 3. Isolated restore rehearsal

Run `node --experimental-sqlite --test tests/gate-a-restore.integration.mjs` in CI or a protected test environment. The test creates fictional records using the real Worker, exports SQL to a 0600 temporary file, imports it into a distinct database, checks schema and per-table row hashes, integrity and foreign keys, invalidates historical sessions and unused invitation tokens in the restored target, signs into the original fictional Webmaster account, reopens linked meetings/tasks, history, Studio and private help, saves a new version, and confirms the source was unchanged. It deletes the fictional temporary files when finished.

For an owner-authorised D1 rehearsal, create a distinct non-production D1 database and an isolated Worker configuration with no production binding or external credentials. Use only a fictional SQL export; never use the showcase as a writable restore target. Import into an empty verified target using the official `wrangler d1 execute <isolated-database-name> --remote --file=<protected-fictional-sql>` procedure. Check schema, per-table counts/hashes, record references and history, login and role checks, and negative routes. Do not seed new real officers, reactivate historical links or reuse real sessions. Keep all approvals, invitations, payments and outbound services disabled.

## 4. Release and rollback

Do not merge a draft branch merely because an isolated test passed. Before a live change, record the approved release, approved deployment target, backup/bookmark and rollback version. Check asset exclusions and headers, signed-out API failures and the real Webmaster's non-destructive sign-in after release. Stop if any account, record or approval state changes unexpectedly.

Cloudflare [Worker rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/) restores a Worker version, not its D1 contents. If code rollback is needed, choose the previously verified compatible version. Never delete or recreate the live D1 binding or re-run bootstrap. If data restoration is separately authorised in an emergency, stop writes, preserve the current database state and the chosen recovery point, review the exact target ID and impact, and reconcile changes after the recovery point before cutover. Invalidate recovered old sessions and unused activation/recovery links using an owner-approved audited maintenance operation. Preserve account IDs and verifiers; require fresh login. Do not silently re-enable invitations or formal approvals.

## 5. Evidence and open dependencies

The automated rehearsal uses SQLite with real Worker queries; it is not a Cloudflare D1 export, a production credential recovery, an actual remote restore, or a deployment verification. The protected storage provider, owner custody approval, D1 rehearsal target and production cutover procedure must be verified before acceptance. Record results and remaining gaps in `studio/PLFC-PARITY.md`.

## 6. Sole-Webmaster recovery after loss of password and sessions

`backend/recovery/owner-recovery.mjs` is an offline maintenance utility, not a Worker route or public reset endpoint. It takes an authorised atomic database adapter and an explicit, independently verified recovery request containing the existing sole Webmaster's account ID, username, currently observed salt/verifier, existing auth pepper, a new strong password and a non-secret approval reference. The credential inputs must come from a protected maintenance environment, never from GitHub, CI logs, chat, or a public form. It cannot create or enable an account. It compares the observed verifier against the current row, checks the sole-Webmaster constraint, changes the password and atomically records the approved recovery and revokes previous sessions/unused owner links. A replay, incorrect account, changed credential or audit failure cannot change the database.

The isolated test `tests/gate-a-owner-recovery.integration.mjs` exercises this utility with fictional data and the actual Worker login. Before any remote operation, independently verify the owner, target and recovery approval, confirm the existing pepper is recoverable, preserve the current protected backup/bookmark, and separately approve an atomic D1 maintenance adapter and exact target. No remote recovery adapter or secret extraction is provided here. If the existing pepper is lost, this utility is not a substitute for restoring the pepper or a separately designed credential migration. Do not repeat bootstrap or reset production credentials as a release test.

The [Gate A release checklist](RELEASE-CHECKLIST.md) distinguishes merge readiness from post-deployment verification and separately authorised activation. Before enabling the new library, keep its encryption key under independently controlled custody and rehearse recovery with fictional encrypted files.
