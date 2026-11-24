# Sandy Sports Club — activating shared Cloudflare records

**Status:** the Worker API, D1 migration, sign-in, member/committee screens and Social Studio client have been prepared in this repository. **They are not live merely because GitHub has these files.** The currently deployed \`wrangler.jsonc\` remains assets-only until the required Sandy database and secrets are provisioned.

Sandy Sports is still a proposal. Do not insert real members, appoint unapproved office holders, send invitations, accept payments, commission Ready SET Co-op or enable formal publication decisions.

## Cloudflare setup required

Use a **new, independent D1 database** for Sandy. Do not reuse PLFC's database, account keys or roles.

1. Create the database in the same Cloudflare account as the Sandy Worker. Example: \`npx wrangler d1 create sandy-sports-club\`. Copy its D1 **database UUID** (not a password).
2. Copy \`wrangler.full.example.jsonc\` to a temporary \`wrangler.full.jsonc\`, replacing \`REPLACE_WITH_NEW_SANDY_D1_UUID\`. Its Worker name is \`sandy-sports-club\`, with \`DB\` bound only to this new database.
3. Apply \`backend/migrations/0001_club.sql\` using Wrangler D1 migrations against the **remote Sandy DB**: \`npx wrangler d1 migrations apply DB --remote --config wrangler.full.jsonc\`. Review the target name and backup before applying.
4. Set two independently generated high-entropy secrets on the *Sandy* Worker, via Cloudflare's dashboard or \`npx wrangler secret put SANDY_AUTH_PEPPER\` and \`npx wrangler secret put SANDY_BOOTSTRAP_KEY\`. Each must be at least 32 characters. **Never put these values in GitHub, chats or exported reports.**
5. Keep \`SANDY_CLUB_APPROVALS="disabled"\` and \`SANDY_INVITES_ENABLED="disabled"\`. Do not enable them as an installation step.
6. Replace the live repository's \`wrangler.jsonc\` with the reviewed full configuration **only after** steps 1–5 have succeeded and the tests pass. The existing public files remain in their current root and \`.assetsignore\` excludes Worker source, database schema, tests and secrets from static delivery.
7. Verify \`/api/health\` reports \`storageConfigured:true\` and \`authConfigured:true\`. Confirm \`/api/session\` does not report any identity when signed out.
8. Visit \`/club-login.html\`, open "First webmaster setup", and use the private bootstrap key to create the actual webmaster username/password. This is permitted **once only** while the accounts table is empty. Remove \`SANDY_BOOTSTRAP_KEY\` from Cloudflare secrets immediately afterward.
9. Log in at \`/club-login.html\` and visit \`/club-admin.html\`. Reserve desired office-holder accounts without issuing invitations. Create a \`webmaster_demo\` reserved account only when needed; the server exposes synthetic, view-only demo information to that role.
10. Visit \`/social-studio.html\` while signed in. The Studio uses authenticated D1 settings, revisions, per-post edits and imported performance metrics. Older browser-local drafts may be explicitly imported by the webmaster, **never automatically**. Review their contents before bringing them into the shared record.

Official configuration reference: https://developers.cloudflare.com/workers/static-assets/binding/ and https://developers.cloudflare.com/d1/reference/migrations/

## Optional visitor interest collection

The public \`/interest.html\` form remains disabled until both Cloudflare Turnstile credentials are configured:

- Add a Turnstile widget for the Sandy Worker origin, set the public site key as \`SANDY_TURNSTILE_SITE_KEY\` in the Worker variables.
- Add \`SANDY_TURNSTILE_SECRET\` as a private Worker secret.
- Confirm that \`/api/public-config\` reports \`publicInterestReady:true\` before sharing the QR/landing page.

The form requests explicit contact consent and stores **expressions of interest**, not memberships. No automatic emails, invites, advertising or fundraising are initiated.

## Roles and permissions

| Role | Access |
|---|---|
| Real webmaster | Full authenticated administration; can reserve accounts; cannot claim legal club approval while approvals disabled |
| President / secretary | Committee records; sensitive directory (where permitted); decision authority only after governing activation |
| Vice-president / assistant secretary / treasurer | Committee records; selected directory access per the API |
| Committee | Shared proposals, events and Social Studio; not private membership directory by default |
| Member | No committee authority; member portal activation requires final policies and account linking |
| Webmaster demo | Synthetic view-only preview; never has access to real member or committee data |

Accounts are **reserved**, not invited, by default. The standalone webmaster may preview different interface layouts but cannot forge the logged-in identity of another officer. Every real write records the authenticated actor ID, office, role, UTC timestamp and version. Sensitive read permissions are enforced by the API, not only by hidden buttons.

## Data and approval rules

- The club-formation system has **no seeded member records, payments, assumed office appointments, approved events or invitations**.
- Shared membership records track names, classes, joining/renewal dates, voluntary gender, town, origin and consent. Only designated staff can read them.
- Committee proposals cover events, meetings, tasks, annual calendar, grants, equipment, assets, sponsorship, volunteering, newsletters, governance and media.
- Each record has an optimistic version to prevent silent overwrites and an append-only server revision.
- Social Studio Day/Week/Month settings, individual post edits and performance CSV import results have separate server version history.
- A proposed Ready SET Co-op production brief is not a contract. Authorised commissioning, committee decisions and publishing links require a separate role-gated workflow.
- Formal approvals are disabled until the club is properly established and its actual delegation arrangements are adopted. They cannot be enabled by a browser toggle.
- No SMS, automated social publishing, payment processing or advertising expenditure is connected.
- Put backup, retention, privacy, consent, safeguarding, Cloudflare Access/MFA and operator account recovery policies in place before admitting real sensitive member data. Password sign-in alone is not a substitute for those organisational controls.

## Validation before activation

The repository includes:
- \`tests/schema-check.py\` for applying the D1 SQL migration to a clean SQLite database and confirming that it seeds no fake club records.
- \`tests/shared-club-backend.test.mjs\` for access and deployment safety checks.
- Existing Sandy calendar, media layout and time-of-day regression tests.
- GitHub workflow \`.github/workflows/validate.yml\` that checks server JavaScript syntax, database migration and unit tests.

Do not enable the Worker API if any validation fails. If any shared endpoint returns an error, do not treat a browser-local backup as a successful database save.

## Deployment boundary

The actual Cloudflare account administrator must create the database, set the secrets, apply the migration and switch the deployment configuration. A GitHub commit cannot invent those Cloudflare resources or create a functioning authenticated service. Until then the existing live static site remains the safe public version and the full shared club system is **staged, not deployed**.
