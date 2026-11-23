# Sandy Sports Social Studio: secure-record activation gate

The new Studio is currently a **browser-local prototype**. It implements PLFC-style Day/Week/Month scheduling, icons, timing signals, visual media guides, CSV event/performance imports and local revision history. A proposed Ready SET Co-op production handoff can be prepared, but the browser has no authority to commission work or approve/publish posts.

## Before records can be treated as committee-authorised

1. Establish Sandy Sports' controller and appropriate roles. The club has not yet been incorporated or appointed office holders.
2. Provision a private Cloudflare D1 database and apply the separate proposed backend schema in this folder. Keep private records out of GitHub static files.
3. Connect an authenticated Worker API with server-validated individual identities, MFA/session expiry, role-based read/write permissions, audit logs and version conflict checks. Do not trust user-typed names or browser storage as identities.
4. On each change, the server must stamp authenticated actor ID, office/role, UTC time, prior version, new version and the changed scope; retain immutable revision snapshots.
5. Separate preparer, reviewer and approver. Publishing, contracting, access to membership records and expenditure each require explicit authorisation under adopted rules. A planning signal is never approval.
6. Ready SET Co-op is a proposed production partner. Handoffs need explicit scope, a committee-approved commissioning step, content/rights/consent and a verified return/review pathway.
7. Track evidence/source URLs and actual published links against the authorised brief and its revision. Record outcomes without claiming external verification unless independently checked.
8. Keep the view-only Webmaster demo entirely separate from production roles; do not invite real office holders prematurely.
9. Confirm official forecasts, event permissions, rights, regulations, dates and privacy before public use. Complete backups, safeguarding and API tests before enabling.

## Workflow state model

Idea → prepared → handoff proposed → authorised assignment → delivered → committee review → approved/rejected → publish authorised → published → evaluated.

Every transition records **who, when, which version, the decision scope and source evidence**. Only the future secure API may mark formal approvals as verified.

## Proposed authenticated API (not deployed)

- GET/PUT /api/committee/social-studio/settings : optimistic version and authenticated editor
- GET /api/committee/social-studio/revisions : immutable history
- GET/POST /api/committee/social-studio/briefs : production planning and sourcing
- POST /api/committee/social-studio/briefs/:id/decision : gated approval or rejection
- POST /api/committee/social-studio/briefs/:id/handoff : scoped assignment to a proposed provider
- POST /api/committee/social-studio/briefs/:id/links : published URLs with decision references
- GET /api/committee/social-studio/export : role-restricted manifest

The current page calls none of these APIs. Its local revision diary explicitly identifies **This browser (unverified)**.

## Existing plans and migration

The simpler Sandy calendar continues to use its own v3 browser storage namespace. The PLFC-inspired Studio stores its separate local settings history and a handoff register. No implicit migration and no access to member data. Any future import must retain origin, source URL, revision ID and permissions.
