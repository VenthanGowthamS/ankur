# Kaizen Folio 🌱

**Small steps, every day.** A private portfolio, growth journal and parent dashboard for children — the one place a family keeps every painting, speech, exam, medal, class and small win, from age 5 to the day they apply to university.

*Kaizen (改善) means "change for the better". Folio is the portfolio they build along the way.*

---

## The problem

Ask any parent: *where is everything your child has done?* Certificates in a drawer, photos across three phones, results in a WhatsApp group, a speech recording nobody can find. Ten years later, a school or university asks for a portfolio — and the family has to rebuild it from memory.

AI can make a polished PDF in a minute, but only from what was saved at the time. **Kaizen Folio is about capture, not generation:** record each moment once, as it happens, with its date and context, and every portfolio, application or "pitch at 15" becomes a view of that record.

## What it does

### For the child's journey
- **Moments** — a timeline of photos, voice and video recordings, PDFs and notes, organised in four tabs: 📚 Study · 🏅 Sports · 🎨 Arts & stage · ⭐ Awards & school (20+ areas, from olympiads and robotics to Hindi, Chinese, dance and community service).
- **Results that mean something** — level (school → international), result (medal, rank, belt), subject and score (percentage worked out), and **roles** (team captain, class monitor, event organiser) tracked separately from just taking part.
- **Learning stories, Kaizen-style** — every moment can record more than the medal:
  - 💛 **Qualities shown** — curiosity, persistence, courage, creativity, kindness, teamwork, focus, bounced back
  - 🌱 **Next small step** — one doable thing to try next, ticked off on the dashboard
  - ✏️ **In her own words** — how it felt and what she wants to remember, written by the child
  - 💬 **Family cheers** — grandparents and parents leave short notes the child can read
- **Who made this** — ✍️ own work, 🤝 with help, or 🤖 AI-assisted. Honest records stay trustworthy.

### For parents
- **Dashboard** — next small steps, qualities shown over time, upcoming contests and exams, weekly activities, leadership roles, olympiad scores, and **exam ladders** (Cambridge English pre-seeded; one tap for YCT/HSK, ICAS, SASMO, SwimSafer, belts, music, dance and drama grades).
- **Goals — the pathway**, for the child's own school system:

  | School system | Stages | Evidence built from her record |
  | --- | --- | --- |
  | 🇸🇬 Singapore MOE | PSLE → SEC → A-Levels | DSA-Sec talent areas, LEAPS, university readiness |
  | 🇮🇳 CBSE (India) | Class 10 boards → Class 12 boards & entrance tests → University | Strongest areas (NEP / Holistic Progress Card), subject strength for stream choice, JEE / NEET / CUET and DASA notes |
  | 🌐 IB | PYP → MYP → Diploma | Talents, **CAS** (Creativity, Activity, Service, initiative, reflection), Diploma scoring |
  | 📘 Cambridge | Primary Checkpoint → IGCSE → AS & A Level | Talents, subject strength, university readiness |

  Each stage shows what it asks for (2026 rules, with sources), what her record already has, and the goals you set. Switch systems any time — goals are kept. A **university explorer** (map + 19 universities and how they admit) stays parked until she leaves primary school.
- **PDF portfolio** — one tap builds an A4 book: highlights, qualities, leadership, olympiad record, levels, classes, goals, then every moment with photos, her words and next steps.
- **Download everything** — one ZIP with every record as JSON, the original files, and an `index.html` that opens offline in any browser. Your family owns its record.

### For the child
- A **kid login** that shows only their own journey, with **Buddy**: Kai the sprout, or a zen panda, dragon or cat, or a favourite character from a picture you upload. Buddy surfs around the screen, answers *What am I good at?* and *What am I proud of?*, cheers them on, and guides a 3-breath **Zen breath**. It is scripted — no free-text chat, nothing unexpected.
- Confetti for wins, light and Midnight themes, installable on a phone.

## Private by design

- Login only; nothing is public. Pages are `noindex`, and photos are served only to signed-in family — never from a public folder.
- **Parent** edits everything · **Family** views and cheers · **Child** sees only their own moments and can write only their own words.
- Strict Content-Security-Policy, HttpOnly session cookies, bcrypt passwords, login limits per account and per network.
- Sample (demo) content is flagged and removable in one tap, and never included in exports.

## Ideas borrowed from around the world

- **Learning stories** (New Zealand, *Te Whāriki*; used by [Storypark](https://help.storypark.com/en/articles/1630106-creating-rich-assessment/)): notice the moment, recognise the learning, respond with a next step — with the child's and the family's voice.
- **Singapore MOE's holistic reporting** ([MOE, 2018](https://moe.gov.sg/news/press-releases/20180928-learn-for-life-preparing-our-students-to-excel-beyond-exam-results)): no more class positions; lower-primary awards recognise qualities like diligence and curiosity.
- **India's Holistic Progress Card** ([NCERT PARAKH](https://parakh.ncert.gov.in/hpc)): teacher, self, peer and parent assessment beyond marks.
- **IB CAS** ([IBO](https://ibo.org/programmes/diploma-programme/curriculum/creativity-activity-and-service/)): creativity, activity and service, shown through reflection.
- **Growth mindset** (Carol Dweck): praise effort and strategy, not "being smart" — hence the cheer suggestions.
- **Keepy**: relatives commenting on a child's work keeps the family close.

## Try it with demo data

```bash
npm install
npm run seed:reset   # loads a fictional family
npm start            # open http://localhost:3000
```

| Who | Sign in with | What they see |
| --- | --- | --- |
| Parent | `parent@example.com` / `ankur-demo-1` | Everything, can edit |
| Family | `grandma@example.com` / `grandma-pass1` | Portfolio, view only, can cheer |
| **Kid** | tap **🧒 I'm a kid**, then `mira` / `sprout1` | Her own journey, with Buddy |

Parents can also preview the kid view from **Family → 👀 Preview kid view**. The demo family is fictional; real use starts from an empty app, where the first screen creates your parent account.

## Run it for your family

Requires **Node 22.13+** (uses the built-in `node:sqlite` — no database server, no native build).

```bash
npm install
npm start      # http://localhost:3000
npm test       # 26 API tests
```

| Env var | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `3000`) |
| `TZ` | Your time zone, e.g. `Asia/Singapore`, so "today" is your day, not UTC's |
| `ANKUR_DATA_DIR` | Where the database and uploads live (default `./data`) |
| `COOKIE_SECURE=1` | Mark the session cookie `Secure` — **set this behind HTTPS** |
| `TRUST_PROXY=1` | Trust one reverse proxy hop (correct client IPs behind nginx/Caddy) |

### Deploying (AWS outline)

1. A small EC2 or Lightsail instance with Node 22; app in `/opt/kaizen-folio`.
2. Run under systemd with `TZ=Asia/Singapore`, `ANKUR_DATA_DIR=/var/lib/kaizen-folio`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.
3. Caddy or nginx in front for HTTPS on your domain.
4. **Back up the data folder** (database + `uploads/`) nightly, e.g. snapshots or `aws s3 sync` — and download the ZIP now and then.

## How it's built

```
server.js          Express API: auth, roles, entries, cheers, goals, export, static app
db.js              SQLite schema and additive migrations
export.js          "Download everything": a streaming ZIP writer + offline index.html
demo-content.js    Fictional sample family (flagged, removable)
public/catalog.js  The single source of truth — areas, levels, qualities, school systems,
                   pathway rules — shared by server validation and the browser
public/app.js      Single-page app, vanilla JS, no build step; DOM built with h(), never innerHTML
public/style.css   Themes (light / Midnight), animations, print styles for the PDF book
test/              API tests (node --test)
```

Design choices: one small server and one SQLite file, so a family can run it on a tiny instance and back it up by copying a folder; no third-party scripts, fonts or trackers; every list of options lives in `catalog.js`, so the server accepts exactly what the app offers. Internal names (`ankur.db`, the `ankur_sid` cookie, `ANKUR_*` env vars) keep the original working name so existing data keeps working.

To add an area, add one line to `CATS` in `public/catalog.js` and a colour in `style.css` (a test checks the colour). To add a school system, add its stages to `CURRICULA` with sources.

## Roadmap

Per-moment visibility (hide some from family) · yearly highlight reels · reminders for upcoming events · ICSE/ISC and other systems · S3 storage for media · multi-family hosting.

See [docs/WHY.md](docs/WHY.md) for the deeper reasoning, honest weaknesses, and how we'll test whether it's worth keeping.
