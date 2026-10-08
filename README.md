# Ankur 🌱

A private growth portfolio and parent dashboard for our children — art, speech, Cambridge exams, Hindi, accolades and everything in between, kept safe in one place.

*Ankur (அங்குரம் / अंकुर) means "sprout".*

## What's in the MVP

- **Private by design** — login only. Nothing is public, uploads are served only to signed-in users, pages are `noindex`.
- **Two roles** — *Parent* (add/edit everything) and *Family* (view the portfolio only).
- **Portfolio journey** — a timeline of moments with notes, photos, voice/speech recordings, videos and PDFs. Filter by Art, Speech, Exams, Hindi, Accolades, School.
- **Parent dashboard** — upcoming contests & exams, activities (Hindi tuition, art class, …) and an **exam ladder** (Cambridge Starters → Movers → Flyers → KET → PET pre-seeded; add any track).
- **Multi-child ready**, installable on a phone (PWA), light/dark mode.

## Run it

Requires **Node 22.13+** (uses the built-in `node:sqlite`, so no native build step).

```bash
npm install
npm start            # http://localhost:3000
npm test             # API tests
```

On first visit you'll be asked to create the parent account and the first child. After that, invite family from **Family → Invite**.

| Env var | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `3000`) |
| `ANKUR_DATA_DIR` | Where the SQLite DB and uploads live (default `./data`) |
| `COOKIE_SECURE=1` | Mark the session cookie `Secure` — **set this behind HTTPS** |
| `TRUST_PROXY=1` | Trust one reverse proxy hop (for correct client IPs behind nginx/Caddy) |

## Deploying on AWS (outline)

1. EC2 or Lightsail small instance, Node 22, put the app in `/opt/ankur`.
2. Run under systemd with `ANKUR_DATA_DIR=/var/lib/ankur`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
3. Caddy or nginx in front for HTTPS on your domain (Let's Encrypt).
4. **Back up `ANKUR_DATA_DIR`** (DB + `uploads/`) — e.g. nightly snapshot or `aws s3 sync`. This is the only copy of the memories.

## Layout

```
server.js   Express API + static hosting
db.js       SQLite schema and helpers
public/     Single-page app (vanilla JS, no build step), PWA manifest, service worker
test/       API tests (node --test)
```

## Roadmap ideas

Per-entry visibility (hide some from family), shareable "portfolio PDF" export, yearly highlights, reminders for upcoming events, S3 storage for media, multi-family accounts.
