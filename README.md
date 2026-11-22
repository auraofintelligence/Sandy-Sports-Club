# Sandy Sports Club

This repository combines the Sandy Sports Club proposal pages with a separate Cloudflare Worker clubhouse adapted from the Point Lookout Fishing Club system. The public site describes a proposed island-wide sand sport and culture club. The clubhouse supplies server-backed joining, member, committee, grant, wish-list, newsletter, and Treasurer workflows.

## Current state

The Worker source is a Sandy-specific port. It has **not** been connected to a Sandy D1 database or deployed from this branch. The public proposal pages can be read without an account; private tools need the Sandy Worker, its own databases and secrets.

- The PLFC application -> committee review -> Treasurer verification -> single-use invitation -> member activation sequence is preserved. Sandy starts with no actual members. Its one example member is a preview profile without a login or database row.
- Five separate office accounts are reserved and disabled: President, Vice President, Secretary, Assistant Secretary and Treasurer. There are no active office invitations or committee sign-ins. The Webmaster can issue each office a private activation invitation later.
- Six source-linked grant leads are unassigned research entries, not applications. Eight proposed equipment wishes are committee drafts without amounts, receipts or purchase commitments.
- Three clearly marked merchandise samples have no prices or stock counts. The Treasurer must enter prices and actual inventory before a request can be accepted. Membership fees and offers also remain unset.
- The five-office newsletter desk, birthday preferences and queues, renewal, pack, notices, events, meetings, stock, and reporting workflows use Sandy's own database. Outgoing email and scheduled jobs are not enabled.
- The operational Webmaster has all-area administration and a read-only switch for each office and a member profile preview. A separate Webmaster demo uses a different database, cookie and secret; its API refuses writes.

The existing 46-page public proposal retains its page directory and previous/next links. Primary navigation opens the real clubhouse joining, member and committee routes. The informational proposal pages remain available from the site map.

## Build and checks

Use Node 20 or later:

```powershell
npm ci
npm run build
npm test
```

`npm run build` bundles `worker/index.mjs` at `dist/server/index.js`; Cloudflare serves `public/` as static assets. Tests use local SQLite and some original PLFC test fixtures still need to be adapted or retired where fishing-specific behavior was removed. The Sandy auth, showcase, meeting and equipment checks are the current focused verification.

## Isolated Cloudflare setup

`wrangler.jsonc` deliberately contains placeholders for two **new** D1 database IDs: `DB` for real Sandy records and `SHOWCASE_DB` for the view-only Webmaster demo. Neither PLFC database nor PLFC secret belongs in this project. Create Sandy-specific `PRIVATE_AUTH_KEY`, `SHOWCASE_AUTH_KEY`, and a temporary `SANDY_BOOTSTRAP_TOKEN` as Worker secrets. Apply all `drizzle/` migrations independently to both empty databases; then provision the first Webmaster with the one-time bootstrap endpoint and remove the bootstrap secret. The office accounts remain disabled until individual invitations are deliberately issued.

Cloudflare's connected build must run `npm run build` before deploying `dist/server/index.js`; `wrangler.jsonc` alone does not set that dashboard build command. The inherited scheduled trigger is disabled. Review the email sender, consent text, fees, catalogue prices, payments, privacy, and club governance before enabling delivery or accepting transactions.

See [Sandy port notes](docs/SANDY-PORT-NOTES.md) for the setup and isolation details. The source uses Luke Nathan Hayes / Strange But True's [public source licence](LICENSE) while the proposed club has no adopted terms. Original PLFC material is credited as the architecture being adapted; the Sandy database and accounts are independent.
