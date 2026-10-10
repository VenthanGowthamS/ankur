/* Ankur catalog — the single source of truth for areas, tabs, levels, subjects and ladder templates.
   Loaded by the browser (as window.ANKUR) and by the server (require), so validation and UI never drift apart.
   To add a new area: add one line to CATS (and a colour in style.css). */
(function (root) {
  'use strict';

  // Tabs on the portfolio: [key, emoji, title, short tab label]. Every area belongs to exactly one tab.
  const GROUPS = [
    ['study', '📚', 'Study', 'Study'],
    ['sports', '🏅', 'Sports', 'Sports'],
    ['arts', '🎨', 'Arts & stage', 'Arts'],
    ['awards', '⭐', 'Awards & school', 'Awards'],
  ];

  // key: [emoji, label, tab]. Keys are stored in the database: never rename one, only add.
  const CATS = {
    exam: ['📜', 'Exams', 'study'],
    olympiad: ['🧮', 'Olympiads', 'study'],
    chinese: ['🀄', 'Chinese', 'study'],
    hindi: ['🪔', 'Hindi', 'study'],
    writing: ['✍️', 'Writing', 'study'],
    coding: ['💻', 'Coding', 'study'],
    robotics: ['🤖', 'Robotics', 'study'],
    sports: ['⚽', 'Sports & games', 'sports'],
    swimming: ['🏊', 'Swimming', 'sports'],
    gymnastics: ['🤸', 'Gymnastics', 'sports'],
    martial: ['🥋', 'Martial arts', 'sports'],
    skating: ['⛸️', 'Skating', 'sports'],
    art: ['🎨', 'Art', 'arts'],
    dance: ['💃', 'Dance', 'arts'],
    singing: ['🎵', 'Singing & music', 'arts'],
    stage: ['🎭', 'Drama & stage', 'arts'],
    speech: ['🎤', 'Speech & debate', 'arts'],
    accolade: ['🏅', 'Accolades', 'awards'],
    community: ['🤝', 'Community (VIA)', 'awards'],
    school: ['🏫', 'School', 'awards'],
    other: ['✨', 'Other', 'awards'],
  };

  const LEVELS = [['school', '🏫 School'], ['zonal', '📍 Zonal'], ['national', '🏆 National'], ['international', '🌍 International']];

  const SUBJECTS = [['maths', '🔢 Maths'], ['english', '📖 English'], ['science', '🔬 Science'], ['computer', '💻 Computer'],
    ['gk', '🌍 General knowledge'], ['hindi', '🪔 Hindi'], ['chinese', '🀄 Chinese'], ['social', '🗺️ Social studies'], ['other', '✨ Other']];

  // Common olympiads and competitions, offered as suggestions when naming an olympiad moment.
  const OLYMPIADS = [
    'SASMO — Singapore and Asian Schools Math Olympiad',
    'SEAMO — Southeast Asian Mathematical Olympiad',
    'Math Kangaroo',
    'ICAS Mathematics', 'ICAS English', 'ICAS Science', 'ICAS Digital Technologies',
    'SOF IMO — International Mathematics Olympiad',
    'SOF IEO — International English Olympiad',
    'SOF NSO — National Science Olympiad',
    'SOF NCO — National Cyber Olympiad',
    'SOF IGKO — International General Knowledge Olympiad',
  ];

  // Suggested roles for the "role" field on a moment -- leadership and responsibility, not just taking part.
  // Based on how US (Common App) and UK (UCAS) admissions, and Singapore schools (MOE, GIIS), actually describe this.
  const ROLES = [
    'Participant', 'Team member', 'Team captain', 'Vice-captain',
    'Class monitor', 'Class representative', 'Prefect', 'House captain', 'Head boy', 'Head girl',
    'Club member', 'Club leader / president', 'Event organiser',
    'Student council member', 'Student council leader',
    'MUN delegate', 'MUN chair', 'Volunteer', 'Volunteer coordinator',
  ];

  // Ready-made ladders for the dashboard. Every step can be renamed or edited after adding.
  const LADDERS = {
    'Chinese (Mandarin) levels': ['YCT 1', 'YCT 2', 'YCT 3', 'YCT 4', 'HSK 1', 'HSK 2', 'HSK 3'],
    'Chinese calligraphy': ['Basic strokes', 'Characters', 'Poems & couplets', 'Exhibition piece'],
    'SOF Olympiad stages': ['Level 1', 'Level 2'],
    'SASMO awards': ['Participation', 'Honourable mention', 'Bronze', 'Silver', 'Gold', 'Perfect score'],
    'ICAS awards': ['Participation', 'Merit', 'Credit', 'Distinction', 'High Distinction'],
    'Coding levels': ['Block coding (Scratch)', 'Python basics', 'Games & apps', 'Web basics', 'Own projects'],
    'Robotics levels': ['Build basics', 'Sensors & motors', 'Programming robots', 'Autonomous challenges', 'Robotics competition'],
    'Swimming (SwimSafer)': ['Stage 1', 'Stage 2', 'Stage 3', 'Bronze', 'Silver', 'Gold'],
    'Gymnastics levels': ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'],
    'Karate belts': ['White belt', 'Yellow belt', 'Orange belt', 'Green belt', 'Blue belt', 'Brown belt', 'Black belt'],
    'Taekwondo belts': ['White belt', 'Yellow belt', 'Green belt', 'Blue belt', 'Red belt', 'Black belt'],
    'Skating levels': ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
    'Football': ['School team', 'Zonal team', 'National squad', 'International'],
    'Dance grades': ['Pre-primary', 'Primary', 'Grade 1', 'Grade 2', 'Grade 3'],
    'Speech & drama grades': ['Preparatory', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'],
    'Singing & piano grades': ['Prep test', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
  };

  const EVENT_KINDS = [['contest', 'Contest'], ['exam', 'Exam'], ['performance', 'Performance'], ['school', 'School'], ['other', 'Other']];

  // ---- Pathway: the three big transitions in Singapore schooling, and what each one asks for.
  // Rules as published by MOE and the universities in 2026. They change — review this once a year.
  // `offset` = years after the PSLE year when that stage's exam is sat (used for the timeline).
  const PATHWAY = [
    {
      key: 'psle', emoji: '🎒', title: 'Primary → Secondary', exam: 'PSLE', offset: 0,
      asks: [
        'PSLE Score: English, Mother Tongue, Maths and Science, each graded AL1–AL8. Total 4–32, lower is better (AL1 = 90 marks and above).',
        'A score of 4–20 means Posting Group 3: most subjects at G3, the most demanding level.',
        'Direct School Admission (DSA-Sec): apply in May–June of Primary 6 on a talent — sports, arts, debate & public speaking, science/maths/engineering, languages, uniformed groups or leadership. Trials and interviews by August; results come with PSLE results in November.',
        'Schools look for impact, not titles: what she did with a role matters more than the role.',
      ],
      sources: [
        ['MOE: PSLE scoring & Full Subject-Based Banding', 'https://www.moe.gov.sg/microsites/psle-fsbb/full-subject-based-banding/faq.html'],
        ['DSA-Sec talent areas & 2026 timeline', 'https://speechacademyasia.com/blog/leadership-dsa-in-singapore-a-complete-guide/'],
      ],
    },
    {
      key: 'secondary', emoji: '🏫', title: 'Secondary → JC / Poly', exam: 'SEC (Sec 4)', offset: 4,
      asks: [
        'From the 2024 Secondary 1 cohort, O- and N-Levels are replaced by the Singapore-Cambridge Secondary Education Certificate (SEC), with each subject at G1, G2 or G3.',
        'Junior college: from 2028 the bar becomes L1R4 of 16 points or better (it was L1R5 of 20), with up to 3 bonus points.',
        'Co-curricular bonus points come from LEAPS — Leadership, Achievement, Participation and Service. “Excellent” earns 2 points, “Good” earns 1.',
        'DSA-JC (portfolio, CCA record, personal statement) and Poly Early Admissions (apply in June, interviews July–August) both reward a documented record.',
      ],
      sources: [
        ['MOE: SEC and new progression criteria', 'https://www.moe.gov.sg/microsites/psle-fsbb/full-subject-based-banding/faq.html'],
        ['Post-secondary pathways briefing (2026)', 'https://www.unitysec.moe.edu.sg/files/USS_2026_Sec_4E_Parent_Briefing_Slides.pdf'],
      ],
    },
    {
      key: 'university', emoji: '🎓', title: 'JC → University', exam: 'A-Levels', offset: 6,
      asks: [
        'NUS, NTU, SMU: University Admission Score out of 70 (three H2 subjects, General Paper, a pass in Project Work, Mother Tongue), compared with each course’s Indicative Grade Profile.',
        'Aptitude-Based Admission looks beyond grades: leadership, community service, exceptional talent and demonstrated interest.',
        'US universities (Common App): holistic — depth in 3–4 activities over years, leadership and impact, not a long list.',
        'UK universities (UCAS): subject depth — olympiads, reading and projects beyond the syllabus, and what she learned from them.',
      ],
      sources: [
        ['Local university admission (Nanyang JC guidance)', 'https://ecg.nanyangjc.moe.edu.sg/a-level-results-release/factors-to-consider/'],
        ['US activities list & what officers weigh', 'https://collegeessayguy.com/blog/extracurricular-activities-guide'],
        ['UK super-curricular activities', 'https://www.timeshighereducation.com/counsellor/admissions-processes-and-funding/what-are-supercurricular-activities-and-why-do-they'],
      ],
    },
  ];

  // Each stage: `age` = the age in the year its exam is sat (so year = birth year + age; for MOE the
  // PSLE year, if set, anchors it instead). `evidence` = which builder reads her record for this stage:
  // talents (strongest areas), leaps (MOE co-curricular), subjects (subject strength), cas (IB), university.
  PATHWAY[0].age = 12; PATHWAY[1].age = 16; PATHWAY[2].age = 18;
  PATHWAY[0].evidence = 'talents'; PATHWAY[1].evidence = 'leaps'; PATHWAY[2].evidence = 'university';
  PATHWAY[0].evidenceIntro = 'DSA-Sec talent areas, strongest first — built from her moments.';

  // ---- Other school systems: many families (e.g. from India) are in international schools, not MOE.
  // Same idea — what each transition asks for, and what her record already has. Rules as published in 2026.
  const CBSE = [
    {
      key: 'cbse10', emoji: '🎒', title: 'Primary & middle → Class 10 boards', exam: 'Class 10 boards', age: 16, evidence: 'talents',
      evidenceIntro: 'Where she is strongest — NEP 2020 and the Holistic Progress Card look well beyond marks.',
      asks: [
        'NEP 2020 restructures school as 5+3+3+4: Foundational (to Class 2), Preparatory (3–5), Middle (6–8) and Secondary (9–12).',
        'Report cards are moving to the Holistic Progress Card: teacher, self, peer and parent assessment across physical, socio-emotional, cognitive, language, aesthetic and cultural development — not just marks.',
        'Class 10 boards are held twice a year from 2026: the first (from mid-February) is compulsory; an optional second in May lets students improve up to three subjects. Internal assessment happens once.',
        'Olympiads (SOF, ICAS, SASMO), arts, sport and service all count — and they help choose a stream for Class 11.',
      ],
      sources: [
        ['CBSE: two Class 10 board exams from 2026', 'https://ianslive.in/cbse-announces-two-board-exams-for-class-10-from-2026--20250625172127'],
        ['NCERT PARAKH: Holistic Progress Card', 'https://parakh.ncert.gov.in/hpc'],
      ],
    },
    {
      key: 'cbse12', emoji: '🏫', title: 'Class 11–12 → boards & entrance tests', exam: 'Class 12 boards', age: 18, evidence: 'subjects',
      evidenceIntro: 'Subject strength from olympiads and exams — useful for choosing a stream and the entrance tests after Class 12.',
      asks: [
        'In Class 11 she picks a stream — Science (PCM or PCB), Commerce or Humanities — so subject strengths seen earlier matter.',
        'Indian universities admit mostly through entrance tests: CUET-UG for central universities, JEE Main / Advanced for engineering (NITs, IITs), NEET-UG for medicine.',
        'Living abroad: Indian citizens who studied Class 11 and 12 abroad (and OCI, PIO and foreign nationals) can apply to NITs and other institutes through DASA, which needs a valid JEE Main rank.',
        'Universities abroad (UK, US, Singapore) accept CBSE Class 12, often with subject minimums, and look at the same record: depth, leadership and service.',
      ],
      sources: [
        ['DASA eligibility for students abroad (2026)', 'https://demoweb.allenoverseas.com/exam/dasa/eligibility-criteria/'],
        ['National Testing Agency (CUET-UG, JEE Main, NEET-UG)', 'https://nta.ac.in/'],
      ],
    },
    {
      key: 'university', emoji: '🎓', title: 'Class 12 → University', exam: 'CUET / JEE / NEET', age: 18, evidence: 'university',
      asks: [
        'India: entrance-test rank plus Class 12 marks decide most admissions; some private universities also interview and read portfolios.',
        'US universities (Common App): holistic — depth in 3–4 activities over years, leadership and impact, not a long list.',
        'UK universities (UCAS): subject depth — olympiads, reading and projects beyond the syllabus.',
        'NUS, NTU and SMU: aptitude-based admission also weighs leadership, service and exceptional talent.',
      ],
      sources: [
        ['US activities list & what officers weigh', 'https://collegeessayguy.com/blog/extracurricular-activities-guide'],
        ['UK super-curricular activities', 'https://www.timeshighereducation.com/counsellor/admissions-processes-and-funding/what-are-supercurricular-activities-and-why-do-they'],
      ],
    },
  ];
  const IB = [
    {
      key: 'ib_pyp', emoji: '🎒', title: 'PYP → MYP', exam: 'PYP exhibition', age: 11, evidence: 'talents',
      evidenceIntro: 'Where her curiosity already runs deep — good seeds for the PYP exhibition.',
      asks: [
        'The Primary Years Programme is for ages 3–12, built on inquiry: children ask questions, investigate and act on what they learn.',
        'In the final PYP year, students run an exhibition — an inquiry into a real-world issue they choose, shared with the school community.',
        'There are no external exams; growth is shown through portfolios and reflection, which is what this record is.',
      ],
      sources: [['IB: Primary Years Programme FAQ', 'https://ibo.org/globalassets/new-structure/recognition/pdfs/pyp-faqs-recognition.pdf']],
    },
    {
      key: 'ib_myp', emoji: '🏫', title: 'MYP → Diploma', exam: 'MYP personal project', age: 16, evidence: 'cas',
      evidenceIntro: 'Creativity, Activity and Service — the three strands of CAS, required in the Diploma. Building the habit now.',
      asks: [
        'Every MYP student completes a personal project in the final year: a self-directed, creative project on something they care about.',
        'Schools can opt in to MYP eAssessment — e-portfolios of coursework and on-screen exams — for the MYP certificate.',
        'CAS (Creativity, Activity, Service) runs through the whole Diploma, including a CAS project — so steady arts, sport and service now make it easy later.',
      ],
      sources: [
        ['IB: MYP results, personal project and eAssessment (2025)', 'https://ibo.org/news/news-list/middle-years-programme-myp-students-receive-their-results-2025/'],
        ['IB: Creativity, activity, service', 'https://ibo.org/programmes/diploma-programme/curriculum/creativity-activity-and-service/'],
      ],
    },
    {
      key: 'university', emoji: '🎓', title: 'Diploma → University', exam: 'IB Diploma', age: 18, evidence: 'university',
      asks: [
        'Six subjects graded 1–7 (at least three, usually four, at Higher Level), plus up to 3 points from Theory of Knowledge and the Extended Essay — 45 maximum, 24 to pass.',
        'CAS is not graded, but the diploma is not awarded without it: she reflects on experiences against seven learning outcomes and completes a CAS project.',
        'Universities worldwide make offers in total points and HL grades; the Extended Essay and CAS are strong material for US and UK applications.',
      ],
      sources: [
        ['IB: Diploma passing criteria', 'https://ibo.org/about-the-ib/what-it-means-to-be-an-ib-student/recognizing-student-achievement/about-assessment/dp-passing-criteria/'],
        ['IB: Creativity, activity, service', 'https://ibo.org/programmes/diploma-programme/curriculum/creativity-activity-and-service/'],
      ],
    },
  ];
  const CAMBRIDGE = [
    {
      key: 'cam_primary', emoji: '🎒', title: 'Primary → Lower Secondary', exam: 'Primary Checkpoint', age: 11, evidence: 'talents',
      evidenceIntro: 'Where she is strongest — breadth matters most at this age.',
      asks: [
        'Cambridge Primary has six stages, roughly ages 5–11.',
        'Cambridge Primary Checkpoint is taken at the end of Stage 6 (about age 11) in English, maths and science, with a report showing strengths and areas to work on.',
        'Lower Secondary covers Stages 7–9; the Lower Secondary Checkpoint comes at the end of Stage 9, at about 14.',
      ],
      sources: [
        ['Cambridge: Primary Checkpoint age group', 'https://help.cambridgeinternational.org/hc/en-gb/articles/360000055178-Which-age-group-of-learners-is-the-Cambridge-Primary-Checkpoint-for-and-when-is-the-transition-to-Cambridge-Lower-Secondary'],
        ['Cambridge: Lower Secondary Checkpoint age group', 'https://help.cambridgeinternational.org/hc/en-gb/articles/360000055018-Which-age-group-of-learners-is-the-Cambridge-Lower-Secondary-Checkpoint-for'],
      ],
    },
    {
      key: 'cam_igcse', emoji: '🏫', title: 'Lower Secondary → IGCSE', exam: 'IGCSE', age: 16, evidence: 'subjects',
      evidenceIntro: 'Subject strength from olympiads and exams — useful for choosing IGCSE and A Level subjects.',
      asks: [
        'Cambridge IGCSEs are usually taken in Year 10 or 11, at about 15–16, choosing from a wide range of subjects.',
        'Results guide AS & A Level choices, so the subjects she enjoys and does well in now are worth noticing.',
      ],
      sources: [['Cambridge Pathway', 'https://cambridgeinternational.org/nz/about-us/Cambridge-pathway']],
    },
    {
      key: 'university', emoji: '🎓', title: 'AS & A Level → University', exam: 'A Levels', age: 18, evidence: 'university',
      asks: [
        'Cambridge International AS & A Levels (usually three or four subjects) are the main route to universities in the UK, Singapore and many other countries.',
        'UK universities (UCAS): subject depth — olympiads, reading and projects beyond the syllabus.',
        'US universities (Common App): depth in 3–4 activities over years, leadership and impact.',
      ],
      sources: [
        ['Cambridge Pathway', 'https://cambridgeinternational.org/nz/about-us/Cambridge-pathway'],
        ['UK super-curricular activities', 'https://www.timeshighereducation.com/counsellor/admissions-processes-and-funding/what-are-supercurricular-activities-and-why-do-they'],
      ],
    },
  ];
  // [key, flag/emoji, label, stages]. MOE stays the default, so existing families see no change.
  const CURRICULA = [
    ['moe', '🇸🇬', 'Singapore MOE school', PATHWAY],
    ['cbse', '🇮🇳', 'CBSE (India)', CBSE],
    ['ib', '🌐', 'International Baccalaureate (IB)', IB],
    ['cambridge', '📘', 'Cambridge International (IGCSE / A Level)', CAMBRIDGE],
  ];
  const ALL_STAGES = [...new Set(CURRICULA.flatMap(([, , , st]) => st.map((s) => s.key)))];

  // IB CAS strands mapped onto our areas. Leadership roles and the CAS project come from moments with a role.
  const CAS_STRANDS = [
    ['Creativity', '🎨', ['art', 'dance', 'singing', 'stage', 'writing', 'coding', 'robotics', 'speech']],
    ['Activity', '⚽', ['sports', 'swimming', 'gymnastics', 'martial', 'skating']],
    ['Service', '🤝', ['community']],
  ];

  // Goal ideas offered when adding a goal for each stage — a starting point, all editable.
  const GOAL_IDEAS = {
    psle: ['DSA-Sec in Science, maths & engineering', 'DSA-Sec in Sports & games', 'DSA-Sec in performing arts', 'DSA-Sec in Leadership',
      'PSLE Score in Posting Group 3 (4–20)', 'AL1 in Maths', 'AL3 or better in Mother Tongue', 'Build a leadership record'],
    secondary: ['LEAPS “Excellent” — 2 bonus points', 'L1R4 of 16 or better for JC', 'DSA-JC portfolio ready by Sec 4',
      'Poly Early Admission for a chosen course', 'Represent the school at national level', 'Lead a CCA'],
    university: ['University Admission Score target for a chosen course', 'Aptitude-Based Admission portfolio',
      'US: 3–4 activities kept up for years', 'UK: reading and projects beyond the syllabus', 'A national or international award'],
    cbse10: ['A national-level olympiad award (SOF / ICAS)', 'Strong Holistic Progress Card in every domain', 'Class 10 boards: 90% or better',
      'Keep one art, one sport and one language going', 'Build a leadership record'],
    cbse12: ['Choose a stream that fits her strengths', 'JEE Main target rank', 'NEET-UG target score', 'CUET-UG for a chosen university',
      'Check DASA eligibility (Class 11–12 abroad)', 'Class 12 boards: 90% or better'],
    ib_pyp: ['A PYP exhibition on an issue she cares about', 'Keep one art, one sport and one language going', 'Read widely in two languages'],
    ib_myp: ['A personal project she is proud of', 'CAS habit: one creativity, one activity, one service a term', 'Lead something — a club, a team or a service project'],
    cam_primary: ['Primary Checkpoint: strong in English, maths and science', 'Keep one art, one sport and one language going', 'Build a leadership record'],
    cam_igcse: ['IGCSE: A* / A in favourite subjects', 'Pick A Level subjects that fit her strengths', 'A national or international award'],
  };
  // Final-stage ideas per school system (the 'university' stage is shared, the advice is not).
  const UNI_IDEAS = {
    cbse: ['JEE / NEET / CUET target for a chosen course', 'DASA application to NITs (if eligible)', 'US: 3–4 activities kept up for years', 'UK: reading and projects beyond the syllabus'],
    ib: ['IB Diploma: 38+ points', 'An Extended Essay in a subject she loves', 'A CAS project with real impact', 'US: 3–4 activities kept up for years'],
    cambridge: ['A Levels: A*AA in chosen subjects', 'UK: reading and projects beyond the syllabus', 'US: 3–4 activities kept up for years'],
  };

  // DSA-Sec talent areas, mapped onto Ankur's areas so the app can show where her evidence already is.
  // 'role' means "any moment with a leadership role".
  const DSA_AREAS = [
    ['Sports & games', '⚽', ['sports', 'swimming', 'gymnastics', 'martial', 'skating']],
    ['Visual, literary & performing arts', '🎨', ['art', 'dance', 'singing', 'stage', 'writing']],
    ['Debate & public speaking', '🎤', ['speech']],
    ['Science, maths & engineering', '🔬', ['olympiad', 'coding', 'robotics']],
    ['Languages & humanities', '🀄', ['chinese', 'hindi']],
    ['Leadership', '👑', 'role'],
  ];

  const GOAL_STATUS = [['idea', '💭 Idea'], ['working', '🚀 Working on it'], ['achieved', '✅ Achieved']];

  // ---- Universities: a short list of major ones, with how they admit. Checked October 2026.
  // Admission rules change almost every year — each card links to the official page, which wins.
  // [key, flag, name, bounds [west, south, east, north]] — bounds frame the map for that region.
  const UNI_REGIONS = [
    ['all', '🌍', 'World', [-128, -12, 128, 64]],
    ['sg', '🇸🇬', 'Singapore', [103.6, 1.22, 104.05, 1.48]],
    ['uk', '🇬🇧', 'UK', [-6.5, 49.8, 2.5, 55.8]],
    ['eu', '🇪🇺', 'Europe', [-1, 44.5, 15, 54.5]],
    ['us', '🇺🇸', 'US', [-126, 30, -66, 47]],
  ];
  const UNIS = [
    { key: 'nus', region: 'sg', name: 'National University of Singapore', short: 'NUS', city: 'Singapore', lat: 1.2966, lon: 103.7764,
      url: 'https://www.nus.edu.sg/oam',
      how: 'A-Level University Admission Score (out of 70) compared with each course’s Indicative Grade Profile.',
      tests: 'Interviews or selection tests for some courses.',
      weighs: 'Aptitude-Based Admission looks beyond grades — leadership, community service, exceptional talent, demonstrated interest.' },
    { key: 'ntu', region: 'sg', name: 'Nanyang Technological University', short: 'NTU', city: 'Singapore', lat: 1.3483, lon: 103.6831,
      url: 'https://www.ntu.edu.sg/admissions/undergraduate',
      how: 'A-Level University Admission Score compared with each course’s Indicative Grade Profile.',
      tests: 'Interviews or tests for some courses.',
      weighs: 'Aptitude-Based Admission considers talents, leadership and community service, not just grades.' },
    { key: 'smu', region: 'sg', name: 'Singapore Management University', short: 'SMU', city: 'Singapore', lat: 1.2966, lon: 103.8497,
      url: 'https://admissions.smu.edu.sg',
      how: 'Holistic review of grades together with the rest of the application.',
      tests: 'Shortlisted applicants are interviewed.',
      weighs: 'Communication, CCA and leadership, and fit with SMU’s discussion-based classes.' },
    { key: 'sutd', region: 'sg', name: 'Singapore University of Technology and Design', short: 'SUTD', city: 'Singapore', lat: 1.3413, lon: 103.9638,
      url: 'https://www.sutd.edu.sg/admissions/undergraduate/admission-requirements',
      how: 'Holistic: maths and science results, a portfolio and an interview.',
      tests: 'Interview with faculty for selected candidates.',
      weighs: 'Portfolio of co-curricular work, accomplishments and leadership; curiosity, resilience, drive and collaboration.' },
    { key: 'oxford', region: 'uk', name: 'University of Oxford', short: 'Oxford', city: 'Oxford', lat: 51.7548, lon: -1.2544,
      url: 'https://www.ox.ac.uk/admissions/undergraduate',
      how: 'Apply through UCAS by 15 October. Typical A-Level offers A*AA to A*A*A, depending on the course.',
      tests: 'Admissions test for most courses (e.g. MAT, TMUA, LNAT); interviews in December.',
      weighs: 'Subject depth: reading and thinking beyond the syllabus. You can apply to Oxford or Cambridge in a year, not both.' },
    { key: 'cambridge', region: 'uk', name: 'University of Cambridge', short: 'Cambridge', city: 'Cambridge', lat: 52.2043, lon: 0.1149,
      url: 'https://www.undergraduate.study.cam.ac.uk',
      how: 'Apply through UCAS by 15 October. Typical A-Level offers A*AA to A*A*A, depending on the course.',
      tests: 'Admissions test for many courses (e.g. ESAT, TMUA); interviews, usually in December.',
      weighs: 'Subject depth and how she thinks in interview. Oxford or Cambridge — one per year.' },
    { key: 'imperial', region: 'uk', name: 'Imperial College London', short: 'Imperial', city: 'London', lat: 51.4988, lon: -0.1749,
      url: 'https://www.imperial.ac.uk/study/apply/undergraduate',
      how: 'Apply through UCAS. Science, engineering, medicine and business only.',
      tests: 'Admissions tests and interviews for many courses.',
      weighs: 'Strong maths and science, and evidence of genuine interest in the subject.' },
    { key: 'ucl', region: 'uk', name: 'University College London', short: 'UCL', city: 'London', lat: 51.5246, lon: -0.134,
      url: 'https://www.ucl.ac.uk/prospective-students/undergraduate',
      how: 'Apply through UCAS. Grades and the personal statement carry most weight.',
      tests: 'Some courses add tests, interviews or portfolios.',
      weighs: 'Super-curricular depth in the chosen subject.' },
    { key: 'lse', region: 'uk', name: 'London School of Economics', short: 'LSE', city: 'London', lat: 51.5144, lon: -0.1165,
      url: 'https://www.lse.ac.uk/study-at-lse/undergraduate',
      how: 'Apply through UCAS. Grades and the personal statement carry most weight.',
      tests: 'Usually no interview.',
      weighs: 'Reading and engagement in economics, politics or the social sciences.' },
    { key: 'eth', region: 'eu', name: 'ETH Zurich', short: 'ETH', city: 'Zurich', lat: 47.3763, lon: 8.548,
      url: 'https://ethz.ch/en/studies/bachelor/application.html',
      how: 'Bachelor’s degrees are taught in German — German at C1 level is required. Apply by 30 November.',
      tests: 'Top A-Level results (reported as A*A*A incl. maths and a science) may admit directly; otherwise an entrance exam.',
      weighs: 'Maths and science strength above all.' },
    { key: 'epfl', region: 'eu', name: 'EPFL', short: 'EPFL', city: 'Lausanne', lat: 46.5191, lon: 6.5668,
      url: 'https://www.epfl.ch/education/admission/admission-2/bachelor-admission-criteria-and-application/',
      how: 'Bachelor’s degrees are taught mainly in French.',
      tests: 'Depending on the school certificate: direct admission on grades, or an entrance exam.',
      weighs: 'Maths and science strength; French for the bachelor’s years.' },
    { key: 'tum', region: 'eu', name: 'Technical University of Munich', short: 'TUM', city: 'Munich', lat: 48.1497, lon: 11.5679,
      url: 'https://www.tum.de/en/studies/application',
      how: 'Most bachelor’s degrees are taught in German; a few are in English.',
      tests: 'An aptitude assessment for many programmes.',
      weighs: 'Grades in the subjects that matter for the course.' },
    { key: 'delft', region: 'eu', name: 'TU Delft', short: 'TU Delft', city: 'Delft', lat: 51.999, lon: 4.3733,
      url: 'https://www.tudelft.nl/en/education/admission-and-application',
      how: 'Many bachelor’s degrees are taught in English.',
      tests: 'Popular programmes have capped places and their own selection; some limit non-EU students.',
      weighs: 'Maths and science, and the programme’s selection tasks.' },
    { key: 'mit', region: 'us', name: 'Massachusetts Institute of Technology', short: 'MIT', city: 'Cambridge, MA', lat: 42.3601, lon: -71.0942,
      url: 'https://mitadmissions.org/apply/',
      how: 'MIT’s own application (not the Common App). Holistic review.',
      tests: 'SAT or ACT required.',
      weighs: 'Maths and science, hands-on making, collaboration, and what she does beyond class.' },
    { key: 'stanford', region: 'us', name: 'Stanford University', short: 'Stanford', city: 'Stanford, CA', lat: 37.4275, lon: -122.1697,
      url: 'https://admission.stanford.edu/apply/',
      how: 'Common App, holistic review.',
      tests: 'SAT or ACT required (from students entering in 2026).',
      weighs: 'Intellectual vitality, depth in a few activities, and impact.' },
    { key: 'harvard', region: 'us', name: 'Harvard University', short: 'Harvard', city: 'Cambridge, MA', lat: 42.377, lon: -71.1167,
      url: 'https://college.harvard.edu/admissions/apply',
      how: 'Common App, holistic review; alumni interviews where possible.',
      tests: 'SAT or ACT required.',
      weighs: 'Depth and leadership in a few activities, character, and contribution to others.' },
    { key: 'princeton', region: 'us', name: 'Princeton University', short: 'Princeton', city: 'Princeton, NJ', lat: 40.3431, lon: -74.6551,
      url: 'https://admission.princeton.edu/apply',
      how: 'Common App, holistic review.',
      tests: 'Test-optional for the 2026–27 cycle; SAT or ACT required from 2027–28.',
      weighs: 'Academic strength, depth in activities, and service.' },
    { key: 'yale', region: 'us', name: 'Yale University', short: 'Yale', city: 'New Haven, CT', lat: 41.3163, lon: -72.9223,
      url: 'https://admissions.yale.edu/apply',
      how: 'Common App, holistic review.',
      tests: 'SAT or ACT required.',
      weighs: 'Academic strength, depth and leadership, and community.' },
    { key: 'berkeley', region: 'us', name: 'University of California, Berkeley', short: 'Berkeley', city: 'Berkeley, CA', lat: 37.8719, lon: -122.2585,
      url: 'https://admissions.berkeley.edu',
      how: 'UC’s own application, due 30 November; four short Personal Insight essays (chosen from eight).',
      tests: 'UC has not used SAT/ACT in admission since 2021 — check the current policy.',
      weighs: 'Sustained involvement, leadership and impact. No need-based aid for international students.' },
  ];

  // What matters at each age, on the way to any of these. Our guidance, drawn from the rules above.
  const AGE_GUIDE = [
    ['7–12', 'Primary', 'Breadth and enjoyment. Try many things, keep the ones she loves. No university talk with her — just keep recording.'],
    ['13–16', 'Secondary', 'Pick 2–3 areas to go deep in. National-level competitions, reading beyond the syllabus, a role with real responsibility. If Europe is a possibility, start German or French now — ETH and EPFL teach in them.'],
    ['17–18', 'JC / IB', 'Subjects that fit the course (e.g. H2 Maths for engineering). SAT/ACT for the US; admissions tests for Oxford, Cambridge and Imperial; essays and personal statement; applications — UK by mid-October, US from November.'],
  ];

  // Who made the work. Keeping this honest from the start makes the record trustworthy later
  // (the idea behind open "AI disclosure" labels): own work, with help from a person, or AI-assisted.
  const AUTHORSHIP = [['own', '✍️', 'Own work'], ['help', '🤝', 'With help'], ['ai', '🤖', 'AI-assisted']];

  // Qualities a moment shows: the "how", not just the medal. Drawn from what MOE now recognises in lower primary
  // instead of marks (diligence, curiosity, collaboration, enthusiasm) and from growth-mindset research
  // (praise effort, strategy and bouncing back). Up to 4 per moment.
  const QUALITIES = [
    ['curious', '🔍', 'Curiosity'], ['persist', '💪', 'Persistence'], ['brave', '🦁', 'Courage'], ['creative', '🎨', 'Creativity'],
    ['kind', '💛', 'Kindness'], ['team', '🤝', 'Teamwork'], ['focus', '🎯', 'Focus'], ['bounce', '🌱', 'Bounced back'],
  ];
  // How the child felt, in their own words ("child voice", from learning stories).
  const FEELINGS = [['proud', '🤩', 'Proud'], ['happy', '😊', 'Happy'], ['calm', '😌', 'Calm'], ['tricky', '😤', 'It was tricky'], ['nervous', '😬', 'Nervous']];

  const catalog = Object.freeze({ GROUPS, CATS, LEVELS, SUBJECTS, OLYMPIADS, ROLES, AUTHORSHIP, QUALITIES, FEELINGS, LADDERS, EVENT_KINDS, PATHWAY, CURRICULA, ALL_STAGES, CAS_STRANDS, UNI_IDEAS, GOAL_IDEAS, DSA_AREAS, GOAL_STATUS, UNI_REGIONS, UNIS, AGE_GUIDE });
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.ANKUR = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
