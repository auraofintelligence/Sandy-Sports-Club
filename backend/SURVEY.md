# Sports interest survey

The survey on sports.html (section `#survey`) lets visitors choose the sports they want the
club to start with, rank them if they like, and say for each one whether they want casual
play, regular training or to compete in regional competitions. Age group, town (Dunwich,
Amity, Point Lookout, visitor or other) and how often they would play are optional.

It asks for no names, emails or contact details. It sends no emails.

## Current state: switched off

- `SANDY_SURVEY_ENABLED` is `"disabled"` in wrangler.jsonc.
- sports.html shows the questions with the form disabled and a "Survey opening soon" note.
- `POST /api/survey` answers 503 "The sports survey is opening soon." and stores nothing.
- Migration `backend/migrations/0004_survey.sql` is written but NOT applied to the live D1.

## What is built

- Public: `GET /api/survey` (is it open, and the lists of sports, goals and options) and
  `POST /api/survey` (one response, choices in priority order).
- Spam protection is the same as nominations: Turnstile, the hidden `website` honeypot,
  a limit of 5 responses per source per hour and 120 in total per hour, and the same spam
  quarantine (labelled "Sports survey"), so nothing caught is silently dropped.
- Source hashes are keyed and blanked after 30 days.
- Admin: the "Sports survey results" tab in club-admin.html, for the Webmaster and the
  Secretary only. It shows tallies by sport and goal (how many chose it, first choices,
  average priority) plus age group, town and frequency counts, and a CSV download
  (`GET /api/committee/survey.csv`).
- Tests: `tests/survey.integration.mjs` uses a local fictional database only.

## Switching it on (owner approval needed)

1. Back up the live D1 first (see backend/RECOVERY.md).
2. Apply migration 0003 if it is not already applied (the survey uses its spam quarantine):
   `npx wrangler d1 execute sandy-sports-clubhouse --remote --file backend/migrations/0003_nominations.sql`
3. Apply the survey migration:
   `npx wrangler d1 execute sandy-sports-clubhouse --remote --file backend/migrations/0004_survey.sql`
4. Turnstile: the survey reuses `SANDY_TURNSTILE_SECRET` and `SANDY_TURNSTILE_SITE_KEY`
   (see backend/NOMINATIONS.md step 2). Both must be set or the survey stays closed.
5. Change `"SANDY_SURVEY_ENABLED": "disabled"` to `"enabled"` in wrangler.jsonc and push.
6. Send one test response with fictional answers, then check the admin tab and the CSV.
   Delete the test row afterwards if it should not count.

## Switching it off

Set `SANDY_SURVEY_ENABLED` back to `disabled` and push. The page returns to "Survey opening
soon", nothing further is stored, and existing answers stay available to officers.
