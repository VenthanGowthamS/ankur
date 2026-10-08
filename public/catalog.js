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
    speech: ['🎤', 'Speech', 'arts'],
    accolade: ['🏅', 'Accolades', 'awards'],
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

  const catalog = Object.freeze({ GROUPS, CATS, LEVELS, SUBJECTS, OLYMPIADS, LADDERS, EVENT_KINDS });
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  else root.ANKUR = catalog;
})(typeof globalThis !== 'undefined' ? globalThis : this);
