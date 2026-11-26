# Online join form nominations (switched off)

The join.html form prepares an email in the visitor's own mail app until the owner
switches online nominations on. Nothing below has been configured; no secret, binding,
migration or Cloudflare setting has been changed.

## What happens when it is on

- The form posts to `POST /api/nominate` with a Cloudflare Turnstile token.
- Genuine nominations go to the private people register (`club_people`, status
  `interested`) with a linked `club_nominations` row. The visitor sees
  "Thanks, we've got it."
- Everything spam protection catches is kept in `club_spam_quarantine` with its reason:
  failed Turnstile, hidden honeypot field filled, rate limited (5 an hour from one source,
  60 an hour site wide), malformed or oversized, or sent from another website.
  Stored metadata is minimal: a keyed hash of the IP address and the browser user agent.
  Items are deleted after 90 days (owner to confirm the period). Storage is capped at
  200 caught items an hour; beyond that only a counter is kept.
- Webmaster and Secretary see "Nominations & spam caught" in the Clubhouse admin, with
  Mark as genuine (moves the item into the register and sends the usual alert) and Delete.
- Owner alerts go to sbt4183@gmail.com and never contain personal contact details:
  - an instant alert for each genuine nomination, for example
    "New nomination: Committee nomination, Dunwich (Goompi)", with an admin link;
  - a daily digest at 10:00 AM Australia/Brisbane (cron `0 0 * * *` UTC) listing the last
    24 hours of genuine and caught items with reasons, counts and links. It is skipped
    when there is nothing to report. Spam never triggers an instant alert.

## Owner steps to switch it on

1. Apply the additive migration to the Sandy D1 database (after a backup):
   `npx wrangler d1 migrations apply sandy-sports-clubhouse --remote`
   (adds `club_nominations`, `club_spam_quarantine`, `club_spam_overflow`, `club_alert_digests`).
   Run `npx wrangler d1 migrations list sandy-sports-clubhouse --remote` first. If the
   private library migration 0002 is also unapplied and should stay off, apply only this file:
   `npx wrangler d1 execute sandy-sports-clubhouse --remote --file backend/migrations/0003_nominations.sql`.
2. Turnstile: in Cloudflare, Turnstile, add a widget for
   `sandy-sports-club.auraofintelligence.workers.dev` (and any custom domain). Then
   - `npx wrangler secret put SANDY_TURNSTILE_SECRET` (the secret key)
   - set `SANDY_TURNSTILE_SITE_KEY` to the site key (a var in wrangler.jsonc or the dashboard).
3. Choose one mail provider and set `SANDY_MAIL_FROM` (the sending address):
   - Cloudflare Email Routing: enable Email Routing on a domain you control, verify
     sbt4183@gmail.com as a destination address, add to wrangler.jsonc
     `"send_email": [{"name": "SANDY_ALERT_EMAIL", "destination_address": "sbt4183@gmail.com"}]`
     and set `SANDY_MAIL_PROVIDER` to `cloudflare`. `SANDY_MAIL_FROM` must be on that domain.
   - or Resend: verify a sending domain, then
     `npx wrangler secret put SANDY_RESEND_API_KEY` and set `SANDY_MAIL_PROVIDER` to `resend`.
   Optional: `SANDY_ALERT_TO` (defaults to sbt4183@gmail.com) and `SANDY_PUBLIC_ORIGIN`
   (the address used in alert links).
4. Change `"SANDY_NOMINATIONS_ENABLED": "disabled"` to `"enabled"` in wrangler.jsonc and
   push. (Vars in wrangler.jsonc override the dashboard on each deploy.)
5. Send one test nomination with fictional details, check the alert email, then check the
   admin view and the next 10:00 AM digest.

To switch off again, set `SANDY_NOMINATIONS_ENABLED` back to `disabled`; the form returns
to the email fallback and nothing further is stored or sent.
