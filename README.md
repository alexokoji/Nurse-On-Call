# NurseOnCall

> **Your Health, Our Priority** — mobile healthcare services.

A production-ready healthcare website and management platform for a Nigerian
home-and-clinic care provider, built with Next.js 16 and MongoDB.

The organisation owns and delivers every service itself. There is no provider
marketplace, no external practitioner registration, no commissions and no
wallets — every nurse, doctor, physiotherapist, pharmacist and technician is an
internal staff member created and managed by an administrator.

---

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [MongoDB setup](#mongodb-setup)
- [Seeding](#seeding)
- [First run on a real database](#first-run-on-a-real-database)
- [Development sign-in](#development-sign-in)
- [Commands](#commands)
- [Payment setup](#payment-setup)
- [Notifications](#notifications)
- [Image uploads](#image-uploads)
- [Scheduled tasks](#scheduled-tasks)
- [Health check](#health-check)
- [Folder structure](#folder-structure)
- [Architectural decisions](#architectural-decisions)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting a deployment](#troubleshooting-a-deployment)
- [Known gaps](#known-gaps)

---

## What it does

The whole system hangs off one end-to-end workflow:

```
public site → service → booking → live availability → patient details
   → payment → gateway verification → confirmed booking → staff assignment
   → appointment → completion → receipt → review
```

**Public site** — homepage, service catalogue with search and filters, service
detail pages, team, about, contact, FAQ, health articles, and an eight-step
booking wizard.

**Patient portal** — dashboard, appointments (with cancel and reschedule
against live availability), payments, printable receipts, reviews,
notifications, support tickets and profile.

**Admin panel** — dashboard with live KPIs and charts, appointments, patients,
services, staff, a day/week/month schedule, payments, refunds, reviews,
messages, notifications, content, reports with CSV export, settings, users,
roles with a granular permission matrix, and audit logs.

Every figure shown is aggregated from MongoDB. Nothing is hard-coded — an empty
database renders zeroes and empty states.

---

## Tech stack

| Concern   | Choice                                                         |
| --------- | -------------------------------------------------------------- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions)     |
| Language  | TypeScript (strict)                                            |
| Database  | MongoDB with Mongoose 8                                        |
| Styling   | Tailwind CSS 3 with a brand token layer                        |
| UI        | Radix primitives, shadcn-style components, Lucide icons        |
| Forms     | React Hook Form + Zod (Zod on the server too)                  |
| Charts    | Recharts                                                       |
| Dates     | date-fns                                                       |
| Auth      | Custom JWT sessions via `jose`, bcrypt password hashing        |
| Payments  | Provider-agnostic layer over Paystack, Flutterwave and Korapay |
| Tests     | Vitest                                                         |

---

## Getting started

**Requirements:** Node.js 20+ and a MongoDB 6+ instance.

```bash
git clone <repository-url>
cd NurseonCall
npm install
cp .env.example .env.local     # then fill in MONGODB_URI and AUTH_SECRET
npm run seed -- --fresh
npm run dev
```

Open <http://localhost:3000>.

---

## Environment variables

Copy `.env.example` to `.env.local`. Only two are required to boot:

| Variable                                                               | Required              | Notes                                                                                                         |
| ---------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                                                          | **yes**               | Local or Atlas connection string                                                                              |
| `AUTH_SECRET`                                                          | **yes**               | 32+ random bytes. `openssl rand -base64 32`                                                                   |
| `NEXT_PUBLIC_APP_URL`                                                  | yes in production     | Used for payment callbacks, sitemap and emails                                                                |
| `AUTH_SESSION_MAX_AGE`                                                 | no                    | Session lifetime in seconds (default 7 days)                                                                  |
| `PAYMENT_DEFAULT_PROVIDER`                                             | no                    | `paystack` \| `flutterwave` \| `korapay`                                                                      |
| `PAYSTACK_SECRET_KEY`                                                  | no                    | Enables Paystack checkout                                                                                     |
| `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_WEBHOOK_HASH`                   | no                    | Enables Flutterwave                                                                                           |
| `KORAPAY_SECRET_KEY`                                                   | no                    | Enables Korapay                                                                                               |
| `EMAIL_PROVIDER`                                                       | no                    | `console` (default) \| `resend` \| `smtp`                                                                     |
| `EMAIL_FROM`                                                           | no                    | Must be on a domain the provider has verified                                                                 |
| `RESEND_API_KEY`                                                       | with `resend`         | From the Resend dashboard                                                                                     |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`                 | with `smtp`           | Port 465 is implicit TLS; 587 upgrades with STARTTLS                                                          |
| `SMS_PROVIDER`, `TERMII_API_KEY`                                       | no                    | `console` (default) prints SMS to the terminal                                                                |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | no                    | Enables image upload; without them image fields accept a URL                                                  |
| `CRON_INTERVAL_HOURS`                                                  | no                    | How often `/api/cron` really runs (default `24`). Widens the reminder window so nothing falls between runs    |
| `CRON_SECRET`                                                          | **yes in production** | `openssl rand -hex 32`. Without it `/api/cron` refuses to run, so holds never expire and reminders never send |

**Never commit `.env.local`.** It is gitignored. Gateway keys, SMTP passwords
and the auth secret live only in environment variables — the settings screen
deliberately cannot store them.

---

## MongoDB setup

**Local:**

```bash
mongod --dbpath /path/to/data
# MONGODB_URI=mongodb://127.0.0.1:27017/nurseoncall
```

**Atlas:** create a free cluster, add a database user, allow your IP, then use
the `mongodb+srv://…` string.

Indexes — including the unique partial index that prevents double booking — are
created automatically by Mongoose on first connection, and explicitly by the
seed script via `syncIndexes()`.

---

## Seeding

```bash
npm run seed              # add to whatever is already there
npm run seed -- --fresh   # drop the collections first, then seed
```

The seed is deterministic (fixed PRNG) so repeated runs produce the same demo
data. It creates a **Nigerian dataset** — Nigerian names, `+234` phone numbers,
NGN pricing, Port Harcourt and Rivers State addresses:

- 1 super admin, 3 other admin users across the remaining roles
- 7 clinical staff with real working hours, breaks and service assignments
- 34 patients with profiles, allergies and emergency contacts
- 12 published services across 6 categories
- ~120 bookings spread from 45 days ago to 30 days ahead
- Matching payments, receipts, reviews and notifications
- 5 health articles, 2 promotion codes and a public holiday

Aggregates (patient spend, service ratings, booking counts) are **recomputed
from the rows actually written**, so the dashboard numbers are internally
consistent rather than invented.

---

## First run on a real database

`npm run seed` is for development only: it writes a whole demo practice — 34
invented patients, 140 bookings, fabricated revenue. None of that belongs on a
live site, and a fresh production database has no users at all, so **there is
nothing to sign in with until you bootstrap it.** An empty database is the usual
reason a deployed admin login fails.

```bash
MONGODB_URI="<your production URI>" \
  npm run bootstrap -- --email you@clinic.ng --name "Your Name"
```

That synchronises indexes, writes the role catalogue and the default settings,
and creates exactly one super admin. It writes no demo rows, and it is safe to
re-run: roles and settings are upserted, existing settings are never reverted to
defaults, and an existing user is never overwritten.

The password comes from `ADMIN_PASSWORD`, or is generated and printed once if
that is unset. It is never accepted on the command line, because argv is visible
to other processes and lands in shell history. The script refuses the
development defaults that are public in this repository, and enforces the same
password rules as the sign-up form.

Note `MONGODB_URI` on the command line wins over `.env.local` here,
deliberately — unlike the development scripts, which override it. Bootstrapping
the wrong database is a mistake worth making hard, so the script also prints the
database name it connected to.

Two things that are easy to get wrong:

- **Include the database name in the URI.** `mongodb+srv://…mongodb.net/?retryWrites=true`
  has none, so the driver quietly uses Atlas's default `test` database. You want
  `mongodb+srv://…mongodb.net/nurseoncall?retryWrites=true&w=majority`.
- **Allow your host's IPs in Atlas.** Vercel's are dynamic, so Network Access
  needs `0.0.0.0/0` there, which is why the database user's password is the only
  thing protecting it. Keep it long and keep it out of Git.

To check the result:

```bash
MONGODB_URI="<uri>" ADMIN_PASSWORD="<password>" \
  npm run verify:bootstrap -- you@clinic.ng
```

That replays every condition the login action applies to the new account, so a
sign-in failure is distinguishable from a bootstrap failure before you go
hunting.

---

## Development sign-in

All seeded accounts share one password. **These are development credentials
only — never deploy them.**

| Role               | Email                            | Password      |
| ------------------ | -------------------------------- | ------------- |
| Super Admin        | `admin@nurseoncall.ng`           | `Admin@12345` |
| Admin              | `ngozi.abara@nurseoncall.ng`     | `Admin@12345` |
| Operations Manager | `tunde.bakare@nurseoncall.ng`    | `Admin@12345` |
| Finance            | `halima.yusuf@nurseoncall.ng`    | `Admin@12345` |
| Staff (nurse)      | `maryjane.okafor@nurseoncall.ng` | `Admin@12345` |
| Patient            | `chinedu.okafor0@example.com`    | `Admin@12345` |

Sign in as different roles to see the permission system working — Finance sees
payments and refunds but not the schedule; Operations sees the diary but cannot
approve refunds.

Change `SEED_ADMIN_PASSWORD` in `.env.local` to use a different one.

---

## Commands

| Command                                                    | Does                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                                              | Development server                                                       |
| `npm run build`                                            | Production build                                                         |
| `npm start`                                                | Serve the production build                                               |
| `npm run typecheck`                                        | `tsc --noEmit`                                                           |
| `npm run lint`                                             | ESLint                                                                   |
| `npm run format`                                           | Prettier                                                                 |
| `npm test`                                                 | Vitest (80 tests)                                                        |
| `npm run seed`                                             | Seed the demo dataset (development only)                                 |
| `npm run bootstrap`                                        | Roles, settings and one super admin, no demo data (production)           |
| `npm run verify:bootstrap`                                 | Checks a bootstrapped admin against the login action's conditions        |
| `npm run smoke`                                            | End-to-end HTTP walk-through of every route (dev server must be running) |
| `npm run verify:email`                                     | Delivers to a throwaway local SMTP server and inspects the bytes         |
| `npm run verify:uploads`                                   | Upload route guards: role, folder, size, file signature                  |
| `npm run verify:reminders`                                 | Proves a reminder sends exactly once                                     |
| `npm run verify:promotions`                                | 25 concurrent claims against a limit of 5                                |
| `npm run verify`                                           | Everything above, in order                                               |
| `npx tsx scripts/dev-inspect.ts slots home-nursing home 3` | Print real availability for a date                                       |

---

## Payment setup

Payments go through a provider-agnostic layer. The booking system calls
`createPayment()`, `verifyPayment()` and `refundPayment()` and never touches a
gateway SDK directly.

```
lib/payments/
├── types.ts               PaymentGateway interface
├── service.ts             PaymentService — the only entry point
└── providers/
    ├── paystack.ts        amounts in kobo; HMAC-SHA512 webhooks
    ├── flutterwave.ts     amounts in naira; verif-hash webhooks
    └── korapay.ts         amounts in naira; HMAC-SHA256 webhooks
```

**To add a provider:** implement `PaymentGateway`, register it in
`lib/payments/service.ts`, add its key to `.env`. Nothing else changes.

### Payment flow

1. Patient creates a booking → server validates availability and price
2. Booking is stored as `pending_payment`, holding the slot for a configurable
   window (default 30 minutes)
3. Server creates a transaction and redirects to the gateway's hosted page
4. Gateway redirects back to `/book/callback`
5. **The server asks the gateway what happened** — the redirect itself proves
   nothing
6. A signed webhook confirms independently at `/api/payments/webhook/{provider}`
7. Payment `successful` → booking `confirmed` → receipt issued → patient notified

If payment fails the booking stays `pending_payment` until the hold expires,
then becomes `expired` and the slot is released.

### Webhooks

Point each gateway at `https://your-domain/api/payments/webhook/{provider}`.
Signatures are verified against the **raw request body** — re-serialising the
JSON would break the digest. An unsigned request gets a 401 and is ignored.

### Without gateway keys

Online payment is simply unavailable and the UI says so. Bookings can still be
taken and settled with **Record payment** on the appointment page, which writes
a real `manual` transaction (bank transfer, cash or POS) with the administrator
who took it recorded in the audit log. That is a genuine business capability
for a Nigerian provider, not a simulated payment.

---

## Notifications

Email and SMS go through a transport abstraction in
`lib/notifications/transports.ts`. Both default to a **console transport** that
prints the message to the server terminal, so the whole notification flow works
in development without sending anything to real people.

Every notification is written to the database _before_ dispatch, so the admin
history shows failed attempts as well as successes. A transport outage never
rolls back the booking that triggered it.

### Email providers

Three adapters ship, selected by `EMAIL_PROVIDER` with no code change:

| Value     | Behaviour                                                        |
| --------- | ---------------------------------------------------------------- |
| `console` | Development default. Prints to the server log, delivers nothing. |
| `resend`  | Resend's REST API over `fetch` - no SDK, works on serverless.    |
| `smtp`    | Any mailbox you own, over a pooled Nodemailer connection.        |

Mail is sent as `multipart/alternative`: a plain-text part and a branded HTML
part built by `lib/notifications/email-html.ts`. The HTML uses table layout and
inline styles because Outlook and several webmail clients still discard modern
CSS, and `Label:   value` runs in a template are detected and rendered as a
detail table. Any action link is also appended to the plain-text part, so it is
never lost to a client that refuses HTML.

`verifyEmailTransport()` opens the SMTP connection without sending, which is
what the admin Settings screen and `/api/health` report on. A provider with no
credentials returns a failed `TransportResult` rather than throwing, so one
misconfigured key never takes a booking down with it.

`npm run verify:email` proves this end to end: it starts a throwaway SMTP server
on localhost, points the adapter at it, and asserts on the bytes that arrive -
envelope, headers, both MIME parts, and the surviving action URL. No credentials
and no network.

**Password reset needs a real provider.** On `console` the reset link is only
printed to the server log.

---

## Image uploads

Services, staff photographs, article covers and site branding accept a file
upload when Cloudinary is configured, and fall back to pasting a URL when it is
not - so the platform is never blocked on a storage account.

Uploads are **signed server-side** (`lib/storage/cloudinary.ts`, REST + `fetch`,
no SDK): the API secret never reaches the browser, and the browser never talks
to Cloudinary directly. `POST /api/admin/upload` checks, in order:

1. a valid session (`401`),
2. a rate limit of 30 uploads per 10 minutes per user and IP (`429`),
3. a known upload folder (`400`),
4. the permission that folder requires - `services.edit`, `staff.manage`,
   `content.manage` or `settings.manage` (`403`),
5. size, capped at 5 MB (`413`),
6. the **file signature**, not the declared `Content-Type`, which is
   attacker-controlled - so a renamed script is refused on its bytes (`415`),
7. and only then whether storage is configured (`503`).

That last position is deliberate. An unauthorised caller gets `403` whether or
not storage is configured, so the response never reveals how the deployment is
set up - and a `503` always means the request itself was fine. Every successful
upload is written to the audit log.

`lib/storage/image-url.ts` holds the transformation helpers and deliberately
carries no `server-only` guard, so client components can request a resized
variant from the same code.

`npm run verify:uploads` asserts all of these guards against a running server.

---

## Scheduled tasks

`GET /api/cron` does the work that has no request to hang off: it expires
abandoned booking holds, returning the slot to the grid, and sends appointment
reminders.

It authenticates with a shared secret and **fails closed** - with `CRON_SECRET`
unset it returns `503` rather than running unauthenticated. The comparison uses
`timingSafeEqual`. Vercel Cron sends the secret as `Authorization: Bearer`;
other schedulers can send `x-cron-secret`.

### Schedule

`vercel.json` registers it **once a day at 06:00 UTC**, because Vercel's Hobby
plan rejects any cron that would run more than once per day. On Pro, or on any
other host, a tighter schedule is better:

```bash
*/15 * * * * curl -fsS -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron
```

A free external pinger (cron-job.org, UptimeRobot, a GitHub Actions schedule)
sending the `x-cron-secret` header works just as well and keeps the deployment
on Hobby.

Whatever you choose, set `CRON_INTERVAL_HOURS` to match it — `24` for the daily
default, `0.25` for every 15 minutes.

### Why the interval matters

Neither job breaks on a daily schedule, but for different reasons.

**Holds** do not depend on the cron at all: `expireStaleHolds()` also runs on
every availability request, so an abandoned hold is released the moment anyone
next looks at that date. The cron is only a backstop for slots nobody queries.

**Reminders** can only go out on a run, so a 24-hour lead time and a once-daily
cron cannot both be honoured exactly: an appointment 30 hours away is too far
off for a run looking 24 hours ahead, and by the next daily run it is 6 hours
away — past its own lead time. The window is therefore widened by one interval,
so a reminder may arrive earlier than the configured lead time but never after
the appointment. `CRON_INTERVAL_HOURS` is what tells it how much slack to
allow; an unparseable or absent value falls back to the most forgiving 24.

Reminders are claimed atomically: `reminderSentAt` is stamped by a conditional
update _before_ the message is dispatched, and released again if dispatch fails.
Two overlapping cron runs therefore cannot message the same patient twice, and a
transient provider outage is still retried on the next run.
`npm run verify:reminders` proves exactly that.

The two jobs run concurrently with isolated error handling, so a failure in one
never prevents the other.

---

## Health check

`GET /api/health` returns `200` when the database is reachable and `503` when it
is not, which is what a load balancer should watch. The body reports database,
email, storage and scheduler status - deliberately without versions, hostnames
or anything else worth leaking:

```json
{
  "status": "ok",
  "checks": {
    "database": { "ok": true },
    "email": { "ok": false, "detail": "console: not delivering" },
    "storage": { "ok": false, "detail": "image upload disabled" },
    "scheduler": { "ok": true }
  }
}
```

---

## Folder structure

```
src/
├── app/
│   ├── (public)/          marketing site, service catalogue, booking wizard
│   ├── (auth)/            login, register, password reset
│   ├── patient/           patient portal (guarded)
│   ├── admin/             admin panel (guarded + permission-checked)
│   │   └── actions/       server actions, grouped by domain
│   └── api/               availability, bookings, payments, webhooks, export
├── components/
│   ├── ui/                design-system primitives
│   ├── public/            marketing components
│   ├── patient/           portal shell
│   ├── admin/             sidebar, shell, charts, stat cards, filter bar
│   ├── booking/           shared date and slot pickers
│   └── forms/             field wrapper, submit button
├── hooks/                 useActionFeedback, useSyncedState
├── lib/
│   ├── auth/              sessions, password hashing, guards, rate limiting
│   ├── bookings/          availability engine, pricing, lifecycle
│   ├── payments/          gateway abstraction and providers
│   ├── notifications/     templates, transports, dispatch
│   ├── permissions/       permission catalogue and role defaults
│   ├── queries/           read models (public, patient, admin, analytics)
│   ├── validations/       Zod schemas
│   ├── db/                connection with hot-reload caching
│   ├── settings/          typed settings with code-level defaults
│   └── audit.ts           audit trail with secret redaction
├── models/                Mongoose schemas
├── types/                 shared domain unions and labels
└── middleware.ts          edge session gate
```

---

## Architectural decisions

### Booking is the canonical appointment record

The brief lists `Booking` and `Appointment` as separate models. **They are one
collection here.** Two tables representing the same real-world event drift the
moment one write succeeds and the other fails. An _appointment_ is simply a
booking whose status is `confirmed`, `in_progress` or `completed`. One row owns
the whole lifecycle, so there is nothing to reconcile.

### Double booking is prevented at the storage layer

Frontend and service-layer checks both run, but neither is the guarantee. The
`Booking` collection carries a unique partial index:

```js
{ staff: 1, startAt: 1 }
// unique, where staff is an ObjectId
// and status is pending_payment | confirmed | in_progress
```

Two simultaneous requests that both pass the availability check cannot both
insert — the loser gets an `E11000` and is told the slot has just gone. The
partial filter means cancelled and expired bookings release the slot again.

### Availability is pure, and therefore testable

`lib/bookings/availability-core.ts` contains no database calls, no clock and no
I/O — just interval arithmetic in _minutes since local midnight_, which sidesteps
timezone and DST bugs entirely. `availability.ts` fetches the five inputs
(service, working hours, overrides, blocked time, live bookings) and feeds them
in. The same function serves the public slot picker and the final pre-write
check, so what a patient sees and what the server enforces cannot diverge.

### Money is stored in kobo

All amounts are integers in minor units. `19.99 * 100` is `1998.9999…` in binary
floating point; storing naira as a float would lose money. Conversion happens at
exactly two boundaries: admin input (`toKobo`) and display (`formatNaira`).

### Permissions are read from the database, never the token

The session JWT carries identity only. Permissions are resolved per privileged
request, so revoking a role takes effect immediately rather than at token
expiry. Bumping a user's `sessionVersion` invalidates every outstanding session.

### Middleware is a gate, not the boundary

Edge middleware does a cheap check: is there a valid token, and is its role in
the right family? Account status, session version and fine-grained permissions
need the database and are enforced in `lib/auth/guards.ts`, which every page and
route handler calls.

### The client never sends money or status

`createBookingSchema` deliberately has no price, staff or status fields. A
client that sends them is ignored. Everything is derived server-side from stored
records.

### Server-side pagination everywhere

Every admin list paginates in MongoDB with `skip`/`limit` and a matching
`countDocuments`. No query returns an unbounded set.

### Render-phase state sync instead of effects

Controlled inputs mirroring the URL, and drawers closing on navigation, use
React's documented "adjust state when a prop changes" pattern rather than
`useEffect` + `setState`. Data fetching stays in effects, where it belongs.

---

## Security

- **Passwords** — bcrypt, cost 12. Never selected by default; queries must opt in.
- **Sessions** — signed JWTs (HS256) in `httpOnly`, `sameSite=lax`, `secure`
  cookies. Invalidated by `sessionVersion` on password change or suspension.
- **Rate limiting** — fixed-window limiter on login, registration, password
  reset, booking, payment and contact. Keyed on IP _and_ email so an attacker
  cannot spread attempts across addresses.
- **Account lockout** — configurable failed-attempt threshold and duration.
- **User enumeration** — login and password reset return identical responses
  whether or not the account exists.
- **Password reset tokens** — only the SHA-256 hash is stored, so a database
  leak cannot be replayed as a reset link.
- **Open redirect** — `?next=` accepts only same-origin absolute paths.
- **Webhooks** — signatures verified in constant time over the raw body.
- **Injection** — all input passes Zod; user input reaching a `$regex` is escaped.
- **Audit trail** — every administrative mutation is logged with actor, IP,
  and a redacted before/after diff. Passwords and tokens never reach it.
- **Content** — health articles render as React elements, never as raw HTML,
  so an editor cannot inject script.
- **Headers** — HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` and a restrictive `Permissions-Policy` on every response.
- **Secrets** — never in the client bundle, never in the database, never in git.

---

## Testing

```bash
npm test             # 80 unit tests
npm run verify       # smoke + email + uploads + reminders + promotions
```

**Unit tests** cover the availability engine (interval arithmetic, breaks,
buffers, concurrency capacity, minimum notice, slot grids), the permission
catalogue and role grants, booking status transitions, refund calculation,
kobo conversion, Nigerian phone normalisation, and every validation schema.

**The smoke test** signs in as a real seeded patient and a real seeded admin,
then walks every public page, both portals, all 17 admin pages, the CSV export
and the API guards — asserting that unauthenticated requests are refused, that
a patient cannot reach `/admin`, and that an admin cannot reach `/patient`.

**The verification scripts** cover what unit tests cannot, by exercising real
infrastructure: a real SMTP dialogue, a real HTTP request to the upload route
carrying a real renamed script, a real reminder dispatched twice, and 25
concurrent promotion claims against a limit of 5. They need a running dev server
and database - `npm run verify:email` needs neither.

---

## Deployment

1. Provision MongoDB (Atlas recommended) and allow your host's IPs.
2. Set every environment variable in your host's settings — `.env.local` is
   never deployed. `AUTH_SECRET` must be at least 16 characters: without it
   nobody can sign in or register, and the server log will say so on boot.
3. `npm run build && npm start`, or deploy to Vercel.
4. Register the webhook URL with each payment gateway.
5. Create the roles, settings and your super admin — **not** the demo data:
   ```bash
   MONGODB_URI="<production URI>" \
     npm run bootstrap -- --email you@clinic.ng --name "Your Name"
   ```
   Without this the database is empty and no one can sign in. Do **not** run
   `npm run seed` against production; it writes a demo practice.
6. Sign in and change that password immediately.
7. Set `CRON_SECRET` and `CRON_INTERVAL_HOURS`, then confirm the schedule is
   live. Without the secret, reminders are never sent:
   ```bash
   curl -i -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron
   ```
8. Set a real `EMAIL_PROVIDER`. On `console`, password reset silently gives a
   patient nothing to act on.
9. Point your uptime monitor at `/api/health`.

Vercel deploys without extra configuration. `vercel.json` registers the cron
daily, which is the most the Hobby plan allows; see
[Scheduled tasks](#scheduled-tasks) for a tighter schedule. Middleware runs on the Edge; the
rest is Node (Mongoose requires it, which is why it is in
`serverExternalPackages`).

---

## Troubleshooting a deployment

`.env.local` is gitignored and **never deployed**, so nothing in it applies to a
hosted deployment. Every variable has to be set in the host's own environment
settings. Two consequences account for most first-deploy failures, and the app
now reports both rather than leaving you to infer them:

- **The server logs a configuration summary on boot.** `src/instrumentation.ts`
  runs once per server instance and lists anything missing, so a misconfigured
  deployment says so in the log instead of waiting for a visitor to find it.
- **`GET /api/health` returns 503** when the database is unreachable _or_
  sessions cannot be signed, and names which. Check it first.

| Symptom                                              | Cause                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Admin sign-in rejects correct credentials            | The database has no users. Run `npm run bootstrap` — see [First run on a real database](#first-run-on-a-real-database) |
| Sign-up or sign-in returns 500, pages otherwise load | `AUTH_SECRET` missing or under 16 characters. Sessions cannot be signed, and only submitting reveals it                |
| Everything is empty though the database has data     | `MONGODB_URI` has no database name, so the driver used its default (`test` on Atlas)                                   |
| Pages load but any data query fails                  | `MONGODB_URI` unset, or the host's IPs are not allowed in Atlas Network Access                                         |
| Password reset emails never arrive                   | `EMAIL_PROVIDER` is still `console`, which delivers nothing                                                            |
| Reminders never send                                 | `CRON_SECRET` unset, so `/api/cron` refuses to run                                                                     |

### Why a 500 on sign-up was worth fixing properly

Registration used to write the user, their patient profile and their consent
record, and _only then_ sign them in. With `AUTH_SECRET` missing that last step
threw: the request 500'd, but the account already existed — so every retry
answered "an account already exists with this email", with no way out from the
UI. The account was created and unusable at the same time.

Both entry points now check that sessions can be signed **before** writing
anything, and return an ordinary form error. The visitor is told nothing was
saved, because nothing was; the variable name goes to the server log, where the
person who can fix it will look. `tests/auth-config.test.ts` covers it.

---

## Known gaps

Stated plainly rather than hidden:

- **The hero photograph is a placeholder** (`public/images/hero-nurse-patient.jpg`,
  from Unsplash). Replace it with a photograph of your own team — for a
  healthcare brand, real staff photography is worth far more than stock.
- **The logo is redrawn as inline SVG** in `components/public/logo.tsx` to match
  the brand mark. Drop in the supplied artwork by replacing `LogoMark` alone.
- **Email delivery needs an account.** The Resend and SMTP adapters are
  implemented and tested, but until you set `EMAIL_PROVIDER` the default
  `console` transport delivers nothing - and password reset depends on it.
- **Image upload needs a Cloudinary account.** Without the three keys, image
  fields accept a pasted URL instead. No other backend is implemented; S3 would
  be a second adapter behind the same interface.
- **Email verification at sign-up is not built.** The `requireEmailVerification`
  setting is therefore disabled in the admin UI with a note explaining why -
  enabling it would lock out every new patient.
- **Refund settlement** relies on the gateway webhook for asynchronous
  providers. Refunds sit in `processing` until it arrives.
- **The schedule is not drag-and-drop.** Rescheduling is done through a dialog
  that re-checks live availability, which is safer than a drag that can silently
  land on an unavailable slot.
- **PDF export** is not implemented. Reports export as CSV, and receipts use the
  browser's print dialog ("Save as PDF"), which avoids a heavy dependency for a
  capability every browser already has.

---

© NurseOnCall — Port Harcourt, Rivers State, Nigeria.
