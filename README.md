# BlockBuddy

Good finds, right around the block.

BlockBuddy is a neighbourly marketplace for one HDB block at a time. The pilot community is SkyPeak @ Bukit Batok. The site is static and is hosted on GitHub Pages. Accounts, listings, chat and residence documents live in Supabase. The browser talks to Supabase with the publishable key. There is no app server in this repository.

**Site:** https://ianjameslaird-gif.github.io/blockbuddy/

## Try it locally

```bash
python3 -m http.server 8080
```

Open http://127.0.0.1:8080/

The real sign-in screen is the default. `?demo=1` keeps the old browser-only prototype, including the demo neighbour and reviewer tools. Demo mode does not call Supabase.

## Apply the database

Run these two files in the Supabase SQL editor, in this order. They are idempotent and safe to run again. They do not mark anyone as an admin.

1. `supabase/migrations/20261115140000_schema.sql`
2. `supabase/migrations/20261115140100_storage.sql`

`supabase/tests/stub.sql` and `supabase/tests/rls_smoke.sql` are only for a local Postgres check. Do not run them on the hosted project. `scripts/validate-sql.sh` applies the migrations twice and then the smoke test when Docker or a local Postgres is available.

## Dashboard settings you still have to make

Authentication → URL configuration:

- Site URL: `https://ianjameslaird-gif.github.io/blockbuddy/`
- Redirect URLs:
  - `https://ianjameslaird-gif.github.io/blockbuddy/`
  - `https://ianjameslaird-gif.github.io/blockbuddy/**`
  - `http://127.0.0.1:8080/**`
  - `http://localhost:8080/**`

Also confirm:

- Email provider is on, and email confirmation stays on.
- Minimum password length is 8.
- The Data API exposed schemas stay `public` and `storage`. Do not expose the `private` schema.
- Realtime includes `public.messages`. The storage migration adds it when the `supabase_realtime` publication already exists.
- Storage buckets `verification-docs` and `listing-photos` stay private. The migration creates them.

If the storage migration prints that `pg_cron` is not enabled, turn the extension on and then run:

```sql
select cron.schedule(
  'purge-verification-docs',
  '15 3 * * *',
  $$select private.purge_expired_verification_docs()$$
);
```

Until that job exists, you can run `select private.purge_expired_verification_docs();` yourself. It deletes proof-of-address files 90 days after a decision.

## First admin

Sign up in the app and confirm the email first. Then run this once in the SQL editor. It is not part of the migrations.

```sql
-- Replace <EMAIL> with the owner's account. Not applied automatically.
begin;
select set_config('bb.privileged', 'on', true);
update public.profile_private
set is_admin = true
where user_id = (select id from auth.users where email = '<EMAIL>');
commit;
```

The admin flag lives on `profile_private`, not on `profiles`, so other neighbours cannot select it. A trigger ignores updates unless `bb.privileged` is set in the same transaction, which is why the snippet uses `set_config`.

## How it works

The pages are plain HTML, CSS and JavaScript. `js/client.js` loads `@supabase/supabase-js` 2.119.0 from jsDelivr. Auth uses the PKCE flow, so the return from an email link is `?code=` on the site URL and does not fight the `#/route` hash.

Redaction is drawn on a canvas in the browser. The upload sends that JPEG, not the original file. PDFs are refused, because a PDF cannot be redacted the same way without sending the original. Paths are `verification-docs/<user id>/<submission id>.jpg` and `listing-photos/<community id>/<user id>/<listing id>.jpg`.

Search, filters and the inbox are Postgres functions (`search_listings`, `inbox`) running as the signed-in user, so row level security still applies. Chat uses Realtime on `public.messages`.

## Tables

| Table | What it holds |
| --- | --- |
| `communities` | HDB communities. Seeded with SkyPeak @ Bukit Batok, slug `skypeak-bukit-batok`. |
| `profiles` | Display name, bio, community, verification status. No unit number and no email. |
| `profile_private` | `is_admin` and the current reviewer note. Owner and admins only. |
| `verification_submissions` | Each uploaded proof, with decision time and document-deleted time. |
| `listings` | Sell, wanted, give away and trade posts for one community. |
| `blocks` | One-direction block rows. Hiding is both directions. |
| `conversations`, `messages`, `conversation_reads` | Private 1:1 chat. |
| `reports` | Listing, member and general reports. |
| `audit_log` | Which admin opened a document, reviewed it, resolved a report or hid a listing. |

Verification status is `not_submitted`, `submitted`, `under_review`, `verified` or `action_needed`. Members can edit their display name and bio. They cannot change status, `is_admin`, or community once verification has started. Database triggers enforce that, not only the screens.

## Row level security

Every `public` table has RLS enabled. `anon` has no grants on those tables. There is no policy that uses `using (true)` or `with check (true)`.

- Communities are readable by any signed-in user.
- A profile is readable by its owner, an admin, or a verified member of the same community when the profile itself is verified.
- `profile_private`, submissions, reports and the audit log are owner-or-admin, and the audit log is admin-only.
- Listings are readable by the owner, an admin, or a verified member of that community when the listing is active and neither person has blocked the other.
- Messages and conversations are readable only by the two participants, and only while they are not blocked.
- Storage: a member reads and uploads only `verification-docs/<their user id>/…`. Admins can read every verification file. Listing photos are readable by verified members of that community who are not blocked from the owner, and only the owner can write `listing-photos/<community>/<their user id>/…`.

Helpers such as `is_admin()` and `blocked_with()` are `security definer` functions in the `private` schema, with `search_path` cleared, so policies do not recurse through RLS. Admin decisions go through `admin_review_submission`, `admin_open_submission`, `admin_resolve_report` and `admin_hide_listing`.

Listings, messages, reports and profile text also reject unit-number patterns such as `#12-345` in a check constraint. Amounts such as `S$10-20` are allowed. The same check runs in the browser before the request.

## What is still manual

Email confirmation and password reset use Supabase’s built-in mailer. On the free plan that mailer sends very little mail. Set up custom SMTP before inviting more than a handful of neighbours.

The publishable key in `js/config.js` is the public client key. Do not put a service-role or secret key in this site, in a commit, or in the browser.

A later Singapore step could add Singpass or MyInfo. This version checks residence from a redacted letter or bill.

More detail for the in-site page is in [docs/index.html](docs/index.html).
