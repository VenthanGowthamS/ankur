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

## Does this actually help with university applications?

She's 7. Applications are a decade away. But the gap between "a pile of certificates in a drawer" and "a strong application" is mostly **what got written down at the time** — so the fields Ankur asks for today decide what's usable then. We checked what real admissions processes actually weigh, rather than guessing:

- **US (Common Application):** the Activities section groups everything into one of ~27 fixed categories (Academic, Athletics, Community Service, Robotics, Debate/Speech, Student Government, and so on), and officers say they prioritise **depth over breadth** — 3–4 sustained activities beat a long thin list — and weigh **leadership and impact**, not membership. A formal title isn't required, but initiative is. ([College Essay Guy](https://collegeessayguy.com/blog/extracurricular-activities-guide), [Spark Admissions](https://www.sparkadmissions.com/blog/best-extracurriculars-for-ivy-league))
- **UK (UCAS):** the personal statement cares less about extracurriculars and more about **"super-curricular"** activity — subject-specific depth (reading beyond the syllabus, olympiads, relevant work experience) — and what a student can say about what they learned from it. ([Times Higher Education](https://www.timeshighereducation.com/counsellor/admissions-processes-and-funding/what-are-supercurricular-activities-and-why-do-they))
- **Locally:** Singapore MOE schools run **Values in Action (VIA)** as the community-service component of CCA, and GIIS Singapore (a common choice for expat families here) has a named student-leadership track — Head Boy/Girl, House Captain, Prefect, Student Council, club leadership, MUN. ([MOE school VIA pages](https://rivervalleypri.moe.edu.sg/rv-curriculum/cce/values-in-action/), [GIIS leadership opportunities](https://globalindianschool.org/sg/leadership-opportunities-for-giis-secondary-students/))

What that means Ankur needed, and now has:

| What admissions actually weigh | What we added |
| --- | --- |
| Leadership / responsibility, not just participation | A **role** field on any moment (Team captain, Class monitor, Club leader, MUN delegate, …), with suggestions drawn from how US/UK admissions and GIIS/MOE actually name these roles. Shown as a 👑 badge, and pulled into its own "Leadership & responsibility" section on the dashboard and in the PDF portfolio. |
| Community Service as its own tracked area | A new **Community (VIA)** category — named to match what Singapore schools actually call it, so it reads as familiar to a local school, not invented. |
| Depth over years, in one place | Already Ankur's core design — the timeline and PDF group everything by area and show when it started, not just a final result. |
| Subject-specific depth (UK super-curricular) | Already covered — exams and olympiads already carry a subject, a score/percentage, and a notes field for what she learned, which is exactly what the UCAS guidance says to capture. |

What we deliberately **didn't** do: import all 27 Common App categories (most — Junior ROTC, religious clubs, paid work — don't apply to a 7-year-old and would just clutter the app), or build an hours-tracker (the research is consistent that depth and impact matter more than hours logged).

This doesn't make Ankur an admissions product — it's still a family record. It just means the record being built now won't need to be reconstructed from memory in ten years.

## Universities — and why they're parked until secondary school

The Goals tab includes a university explorer: a map of major universities in Singapore, the UK, Europe and the US, with how each one admits and a link to its official page. It is deliberately **parked while she's in primary school**:

- At 7–12 the best preparation for any university is breadth and enjoyment. A target university this early tends to narrow what a child is allowed to love — and the pressure usually starts on the parent's side, quietly, through which classes get kept and which get dropped.
- So before secondary school the section shows a short note instead of the map. A parent can still tap **Look anyway**; it parks itself again next time.
- **She never sees any of it.** Goals and universities live only in the parent's Goals tab; her kid login shows her journey and Buddy, nothing about targets.

Admission rules change almost every year (several US universities brought test requirements back in 2024–26), so each card says what was checked in October 2026 and links to the official page, which always wins. The map is drawn from public-domain Natural Earth data built into the app — no outside map service sees anything.
