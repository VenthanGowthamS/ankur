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

  // Goal ideas offered when adding a goal for each stage — a starting point, all editable.
  const GOAL_IDEAS = {
    psle: ['DSA-Sec in Science, maths & engineering', 'DSA-Sec in Sports & games', 'DSA-Sec in performing arts', 'DSA-Sec in Leadership',
      'PSLE Score in Posting Group 3 (4–20)', 'AL1 in Maths', 'AL3 or better in Mother Tongue', 'Build a leadership record'],
    secondary: ['LEAPS “Excellent” — 2 bonus points', 'L1R4 of 16 or better for JC', 'DSA-JC portfolio ready by Sec 4',
      'Poly Early Admission for a chosen course', 'Represent the school at national level', 'Lead a CCA'],
    university: ['University Admission Score target for a chosen course', 'Aptitude-Based Admission portfolio',
      'US: 3–4 activities kept up for years', 'UK: reading and projects beyond the syllabus', 'A national or international award'],
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

  const catalog = Object.freeze({ GROUPS, CATS, LEVELS, SUBJECTS, OLYMPIADS, ROLES, LADDERS, EVENT_KINDS, PATHWAY, GOAL_IDEAS, DSA_AREAS, GOAL_STATUS });
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.ANKUR = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
