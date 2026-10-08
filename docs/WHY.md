# Why Ankur exists

*A record of the thinking behind the project, so we remember what we're actually trying to solve.*

## The honest question

If a family already keeps everything on a computer, and AI can turn a folder into a PDF in a minute — **what is this app for?**

## The answer: capture, not generation

Generating a portfolio is easy. **Having the material to generate from is the hard part.**

- A child's history is scattered: phone gallery, WhatsApp groups, school emails, a certificate in a drawer, a speech recording on someone's phone.
- The most valuable context never lives in a file: the score, the teacher's feedback, which contest it was, how she felt. In five years you'll have the photo but not the story.
- AI can only summarise what was captured. If nobody wrote it down at the time, there is nothing to generate from.

So Ankur is the **source of truth**: capture each moment once, with its date and context, as it happens. The PDF, the application, the "pitch at 15" are just *views* of that data, and AI can produce any of them on demand. Ankur does not compete with AI — it feeds it clean, dated, annotated material.

Alongside the memory, the **parent dashboard** solves a problem that exists this week: contests, exams, Hindi tuition and the exam ladder (Cambridge Starters → PET) in one place instead of five chats.

## Is it a "blockchain-style immutable history"? No — on purpose

Blockchain solves *"I don't trust the other party"*. Here nobody is tampering with anything, so it adds cost and no value. It also works against us:

- An immutable record **can't be deleted**. For a child's private data that is a bug, not a feature.
- A public ledger contradicts the privacy goal (login-only, no consent from the child yet).

What actually matters instead:

| Need | How Ankur meets it |
| --- | --- |
| Don't lose it | Nightly backup of the data folder (DB + uploads) |
| Keep it private | Login only; media served only to signed-in users; `noindex` |
| Own it | Self-hosted, plain SQLite + files — exportable any time |
| Trust the dates | Entries carry a date and creator; an audit trail can be added later without a ledger |

## Honest weaknesses

1. A disciplined family could get ~80% of this from a folder, Google Photos and a monthly AI prompt.
2. **It only works if adding a moment takes ~10 seconds.** If it becomes a chore, it dies within a month. This is the #1 risk.
3. The "universal platform for school parents" idea is **unvalidated** — nobody outside our family has said they have this problem.
4. For a 7-year-old, the real value is years away, so motivation to keep feeding it is the product problem.

## How we find out cheaply

Use it ourselves for **6–8 weeks** for our daughter. Keep going only if we're still adding moments without nagging ourselves. If not, we've lost little and learned a lot.

## What makes it earn its place

1. **Easier capture** — share a photo or voice note to Ankur from the phone; forward a WhatsApp message.
2. **AI output on top** — a "year in review" PDF or letter generated from what's saved.
3. **Kid mode** — the child has her own login and a friendly buddy, so the journey is *hers*, and she becomes a source of captured moments too.

## Kid mode and Buddy — design rules

Kids get their own view-only login (`child` role), fenced to their own profile and files. A small sprout **Buddy** lives in the corner and can be tapped. Rules we keep on purpose:

- **Parents don't see Buddy.** It is a kid-only feature.
- **No free-text chat with a child (yet).** Buddy is scripted: it reads a handful of safe facts (counts, latest moment, next event, last exam passed) and answers tap-only prompts. It can't say anything unexpected, and a child can't type anything into it.
- If we later connect a real AI model, it comes with guardrails first: fixed persona, no personal-data collection, no external links, parent-visible transcripts, and an off switch.
