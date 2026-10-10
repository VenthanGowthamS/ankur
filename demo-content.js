'use strict';
/* Fictional sample moments, events and activities. Everything added here is flagged is_sample = 1,
   so it can be removed with one tap and never mixes with real memories. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEMO = path.join(__dirname, 'demo');
// Bump whenever the sample set changes: apps that already show samples swap in the new set on next start.
const SAMPLE_VERSION = 6;
const MIME = { '.png': 'image/png', '.wav': 'audio/wav', '.pdf': 'application/pdf' };
const find = (f) => ['images', 'media'].map((d) => path.join(DEMO, d, f)).find((p) => fs.existsSync(p));

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addSampleContent(db, uploadsDir, childId, createdBy) {
  db.prepare("INSERT INTO meta (key, value) VALUES ('sample_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(SAMPLE_VERSION));
  // A family member to leave sample cheers (the demo grandma, if there is one), else the parent.
  const fam = db.prepare("SELECT id FROM users WHERE role = 'family' ORDER BY id LIMIT 1").get();
  const FIELDS = ['level', 'result', 'subject', 'score', 'role', 'authorship', 'qualities', 'next_step', 'next_done', 'kid_words', 'kid_feeling'];
  const entry = (category, title, offset, notes, ...files) => {
    const opts = files.length && typeof files[files.length - 1] === 'object' ? files.pop() : {};
    const cols = FIELDS.filter((k) => opts[k] != null);
    const id = Number(db.prepare(`INSERT INTO entries (child_id, category, title, date, notes, created_by, is_sample${cols.map((k) => `, ${k}`).join('')}) VALUES (?, ?, ?, ?, ?, ?, 1${cols.map(() => ', ?').join('')})`)
      .run(childId, category, title, day(offset), notes, createdBy, ...cols.map((k) => opts[k])).lastInsertRowid);
    for (const [who, body] of opts.cheers || []) {
      db.prepare('INSERT INTO cheers (entry_id, user_id, body) VALUES (?, ?, ?)').run(id, who === 'family' && fam ? fam.id : createdBy, body);
    }
    for (const name of files) {
      const ext = path.extname(name);
      const file = crypto.randomBytes(16).toString('hex') + ext;
      fs.copyFileSync(find(name), path.join(uploadsDir, file));
      db.prepare('INSERT INTO media (entry_id, file, original, mime, size) VALUES (?, ?, ?, ?, ?)')
        .run(id, file, name, MIME[ext], fs.statSync(path.join(uploadsDir, file)).size);
    }
  };
  entry('speech', 'Speech practice (sample sound)', -4, 'Tap play to hear a recording. Real ones can be voice notes from the phone.', 'speech-practice-sample.wav',
    { qualities: 'brave,focus', next_step: 'Practise the opening line in front of the mirror, 3 times a day', kid_feeling: 'nervous', kid_words: 'My voice was shaky at first but then I forgot to be scared.' });
  entry('art', 'Rainbow after the rain', -10, 'Poster colours. She mixed the purple herself.', 'art_rainbow.png',
    { qualities: 'creative,curious', authorship: 'own', kid_feeling: 'happy', kid_words: 'I made purple by mixing red and blue. It took three tries!', cheers: [['family', 'What beautiful colours, kanna! I love the purple.']] });
  entry('school', 'Lantern making', -14, 'Made a paper lantern for the class festival. Helped a friend with hers.');
  entry('speech', 'Speech: My Favourite Festival', -18, 'Spoke for 2 minutes without notes. Eye contact was lovely.', 'speech_stage.png');
  entry('exam', 'Cambridge Starters result', -26, 'Great score — full marks in listening. Certificate attached.', 'certificate-sample.pdf');
  entry('hindi', 'Hindi alphabet chart', -33, 'Finished writing all the varnamala neatly.');
  entry('art', 'Flower garden', -39, 'Used a sponge for the petals.', 'art_flower.png');
  entry('accolade', 'Kindness badge', -47, 'Class teacher’s pick for helping a new classmate settle in.', { qualities: 'kind,team', cheers: [['family', 'Kindness is the best prize of all 💛']] });
  entry('art', 'Peacock watercolour', -55, 'Wet-on-wet technique, first time.', 'art_peacock.png');
  entry('hindi', 'Hindi poem recitation', -67, 'Recited without a single prompt. Teacher was delighted.');
  entry('accolade', 'Star of the week', -80, 'Awarded for kindness in class.');

  // Achievements beyond the classroom: olympiads, martial arts, sports, skating
  entry('olympiad', 'SASMO — Maths', -22, 'Open-ended section was the hard part. Checked her answers twice.', 'medal.png', { level: 'international', result: 'Silver medal', subject: 'maths', score: '71 / 85',
    qualities: 'persist,focus', next_step: 'Two open-ended puzzles every Sunday', kid_feeling: 'proud', kid_words: 'The last question was so hard. I didn’t give up!',
    cheers: [['family', 'You kept going even when it was hard — that’s the real medal!'], ['parent', 'So proud of how you checked every answer.']] });
  entry('olympiad', 'SOF IMO — Level 1 (Maths)', -48, 'Zonal rank from the Student Performance Report. Qualified for Level 2.', { level: 'zonal', result: 'Zonal rank 9', subject: 'maths', score: '52 / 60' });
  entry('olympiad', 'SOF IEO — Level 1 (English)', -60, 'Strong on vocabulary, lost marks on spoken & written expression.', { level: 'school', result: 'School rank 3', subject: 'english', score: '44 / 60' });
  entry('olympiad', 'SOF NSO — Level 1 (Science)', -75, 'First science olympiad. Loved the achievers section.', { level: 'zonal', result: 'Medal of Distinction', subject: 'science', score: '48 / 60' });
  entry('olympiad', 'SEAMO — Paper B (Maths)', -90, 'Twenty multiple-choice and five open-ended questions. Finished with time to spare.', { level: 'international', result: 'Bronze award', subject: 'maths', score: '68 / 100' });
  entry('olympiad', 'ICAS English', -100, 'Reading comprehension was her strongest part.', { level: 'international', result: 'Distinction', subject: 'english', score: '34 / 40' });
  entry('olympiad', 'Math Kangaroo', -110, 'Tricky puzzles about shapes and patterns. Loved it.', { level: 'international', result: 'Silver award', subject: 'maths', score: '84 / 120' });
  entry('olympiad', 'SOF NCO — Level 1 (Cyber)', -120, 'Questions on computers, the internet and logic.', { level: 'school', result: 'School rank 2', subject: 'computer', score: '41 / 50' });
  // Coding and robotics classes
  entry('coding', 'First Scratch game: Catch the stars', -12, 'Built it herself with sprites, a score counter and a timer. Showed it to the whole family.', { result: 'Block-coding level complete',
    qualities: 'creative,curious,persist', authorship: 'own', next_step: 'Add a second level that gets faster' });
  entry('coding', 'Python turtle drawing', -40, 'Wrote loops to draw a spiral flower. Debugged one indentation error alone.', { result: 'Started Python basics' });
  entry('robotics', 'Line-following robot', -20, 'Built the robot, then programmed it to follow a black line around the track.', 'robot.png', { result: 'Challenge completed',
    qualities: 'persist,team,curious', authorship: 'help', next_step: 'Make it stop at the red square' });
  entry('robotics', 'Robotics showcase day', -52, 'Presented the team’s robot to parents. Explained the sensors without notes.', { level: 'school', result: 'Best team spirit', role: 'Team presenter' });
  entry('school', 'Elected class monitor', -10, 'Classmates voted for her at the start of term. Helps the teacher line up the class and hands out worksheets.', { role: 'Class monitor', result: 'Elected by classmates' });
  entry('community', 'Beach clean-up with class', -45, 'Collected litter along the shore with her class — her Values in Action activity for the term.', { result: 'Certificate of participation' });
  entry('community', 'Food drive — sorted and labelled donations', -85, 'Helped organise the class food donation drive for a local food bank.', { role: 'Class representative', result: 'Over 200 packs sorted' });
  // Chinese, dance, stage, singing and writing
  entry('chinese', 'Mandarin YCT 2 exam', -18, 'Listening and reading went well. Spoke a short self-introduction in Chinese.', { result: 'YCT 2 passed', score: '168 / 200' });
  entry('chinese', 'Chinese calligraphy — spring couplet', -44, 'Wrote 福 with a brush for Chinese New Year. Practised stroke order every evening.', { level: 'school', result: 'Displayed in the school hall' });
  entry('dance', 'Ballet recital — The Little Swan', -26, 'First time on a proper stage. Remembered every step.', { level: 'school', result: 'Pre-primary grade: Merit' });
  entry('dance', 'Chinese dance — ribbon performance', -58, 'Ribbon dance for the National Day concert.', { result: 'Performed with the class' });
  entry('stage', 'Speech & drama showcase — The Three Pigs', -21, 'Played the wolf and used a big voice. Spoke clearly to the back row.', { level: 'school', result: 'Lead role' });
  entry('stage', 'School musical — chorus', -64, 'Learned three songs and the stage positions.', { result: 'Performed on both nights' });
  entry('singing', 'Piano Grade 1 exam', -33, 'Played three pieces and scales. Nervous but steady.', { result: 'Grade 1 passed', score: '124 / 150' });
  entry('singing', 'Choir festival performance', -50, 'Sang in a two-part song with the school choir.', { level: 'zonal', result: 'Silver award' });
  entry('writing', 'My first short story: The Moon Garden', -15, 'Wrote 12 sentences all by herself and drew the pictures.', { result: 'Read aloud in class',
    qualities: 'creative,focus', authorship: 'own', next_step: 'Write one page of a new story every weekend', kid_feeling: 'proud', kid_words: 'The moon garden grows flowers that glow at night.' });
  entry('writing', 'Creative writing contest', -72, 'Wrote about a day as a raindrop.', { level: 'zonal', result: 'Highly commended' });
  entry('martial', 'Karate — yellow belt grading', -16, 'Kata performed without a pause. Sensei said her stance was perfect.', 'belt.png', { result: 'Yellow belt' });
  entry('martial', 'Taekwondo inter-club tournament', -41, 'Sparring, under-8 category. Lost the final by one point.', { level: 'zonal', result: 'Silver medal',
    qualities: 'bounce,brave', next_step: 'Work on the back kick with Sensei', next_done: 1, kid_feeling: 'tricky', kid_words: 'I cried a bit after the final. Next time I will keep my guard up.' });
  entry('sports', 'Football — zonal tournament', -28, 'Scored a goal in the semi-final. Team lost the final on penalties.', { level: 'zonal', result: 'Runner-up (team)' });
  entry('sports', 'Football — national selection trials', -70, 'Made the shortlist from over 200 children.', { level: 'national', result: 'Shortlisted' });
  entry('sports', 'International youth football festival', -95, 'Played three matches against teams from four countries.', { level: 'international', result: 'Team participant' });
  entry('swimming', 'SwimSafer Stage 2', -24, 'Treaded water for one minute and swam 25 m on her own.', { result: 'Stage 2 certificate' });
  entry('swimming', 'Inter-school swim meet — 25 m freestyle', -66, 'Personal best time. Cheered on her whole team.', { level: 'zonal', result: '4th place', score: '28.4 s' });
  entry('gymnastics', 'Gymnastics Level 1 assessment', -30, 'Cartwheel, forward roll and a steady balance on the beam.', { result: 'Level 1 passed' });
  entry('gymnastics', 'Gymnastics club showcase', -85, 'Floor routine with her group, to music.', { level: 'school', result: 'Best presentation' });
  entry('skating', 'Skating — Level 2 badge', -35, 'Learned backward crossovers this term.', { result: 'Level 2 passed' });
  entry('skating', 'Skating showcase', -75, 'Performed a two-minute routine to music in front of parents.', { level: 'school', result: 'Gold medal' });

  const event = (title, offset, kind, location, status = 'upcoming', result = null) =>
    db.prepare('INSERT INTO events (child_id, title, date, kind, location, status, result, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, 1)')
      .run(childId, title, day(offset), kind, location, status, result);
  event('Inter-school colouring contest', 37, 'contest', 'Community centre');
  event('Cambridge Movers', 150, 'exam', null);
  event('Zonal football tournament', 21, 'contest', 'Sports hall');
  event('Maths Olympiad — national round', 55, 'exam', null);
  event('School talent show', -30, 'performance', 'School hall', 'done', 'Sang with the class choir');
  event('Piano Grade 2 exam', 100, 'exam', 'Music school');
  event('Speech & drama showcase', 40, 'performance', 'Drama school');
  event('Hindi recitation contest', -62, 'contest', 'Community centre', 'done', '2nd place');

  const activity = (name, category, schedule, provider) =>
    db.prepare('INSERT INTO activities (child_id, name, category, schedule, provider, active, is_sample) VALUES (?, ?, ?, ?, ?, 1, 1)')
      .run(childId, name, category, schedule, provider);
  activity('Hindi tuition', 'hindi', 'Saturdays 10am', 'Mrs Sharma');
  activity('Art class', 'art', 'Wednesdays 4pm', null);
  activity('Toastmasters Youth', 'speech', '1st Sunday', null);
  activity('Coding class', 'coding', 'Thursdays 5pm', 'Code club');
  activity('Robotics class', 'robotics', 'Fridays 4pm', 'Robotics lab');
  activity('Chinese (Mandarin) tuition', 'chinese', 'Wednesdays 5pm', 'Ms Tan');
  activity('Chinese calligraphy', 'chinese', 'Saturdays 2pm', null);
  activity('Ballet', 'dance', 'Thursdays 4pm', 'Dance studio');
  activity('Speech & drama', 'stage', 'Mondays 4pm', 'Drama school');
  activity('Piano & choir', 'singing', 'Tuesdays 4pm', 'Music school');
  activity('Creative writing', 'writing', 'Fridays 3pm', null);
  activity('Karate', 'martial', 'Tuesdays 6pm', 'Sensei Lee');
  activity('Football', 'sports', 'Saturdays 4pm', 'Zone team');
  activity('Skating', 'skating', 'Sundays 9am', null);
  activity('Swimming (SwimSafer)', 'swimming', 'Saturdays 8am', 'Swim school');
  activity('Gymnastics', 'gymnastics', 'Wednesdays 6pm', 'Gym club');
  activity('Values in Action (VIA)', 'community', 'Fortnightly', 'School');

  // Pathway goals: what we're aiming for at each stage, tied to an area so progress shows up by itself.
  const goal = (stage, title, category, target, status, notes, sort) =>
    db.prepare('INSERT INTO goals (child_id, stage, title, category, target, status, notes, sort, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
      .run(childId, stage, title, category, target, status, notes, sort);
  goal('psle', 'DSA-Sec in Science, maths & engineering', 'robotics', 'A zonal robotics award and a Silver in a maths olympiad by Primary 5', 'working', 'Keep robotics and SASMO going every year; save every certificate here.', 0);
  goal('psle', 'PSLE Score in Posting Group 3 (4–20)', 'exam', 'AL3 or better in all four subjects', 'working', 'Science is strongest; Mother Tongue needs steady practice.', 1);
  goal('psle', 'Build a leadership record', 'school', 'At least one role a year — class monitor, team presenter, VIA project lead', 'working', null, 2);
  goal('psle', 'Second DSA option: performing arts', 'dance', 'Ballet Grade 2 and one stage performance a year', 'idea', null, 3);
  goal('secondary', 'LEAPS “Excellent” — 2 bonus points', 'community', 'A leadership role in a CCA, school representation, and VIA every year', 'idea', null, 0);
  goal('secondary', 'DSA-JC portfolio ready by Sec 4', null, 'One PDF portfolio covering 4+ years of robotics and olympiads', 'idea', null, 1);
  goal('university', 'Depth: 3 areas kept up for 5+ years', null, 'Robotics, maths olympiads and dance', 'idea', 'This is what US and UK universities, and aptitude-based admission here, look for.', 0);
}

// Removes everything flagged as sample for one child, including uploaded files. Returns the file names to delete.
function removeSampleContent(db, childId) {
  const files = db.prepare('SELECT m.file FROM media m JOIN entries e ON e.id = m.entry_id WHERE e.child_id = ? AND e.is_sample = 1').all(childId).map((r) => r.file);
  db.prepare('DELETE FROM entries WHERE child_id = ? AND is_sample = 1').run(childId);
  db.prepare('DELETE FROM events WHERE child_id = ? AND is_sample = 1').run(childId);
  db.prepare('DELETE FROM activities WHERE child_id = ? AND is_sample = 1').run(childId);
  db.prepare('DELETE FROM goals WHERE child_id = ? AND is_sample = 1').run(childId);
  return files;
}

// Replaces outdated sample content with the current set, for every child that has samples loaded.
// Real moments are never touched (only is_sample rows). Returns the old sample files to delete from disk.
function refreshSamples(db, uploadsDir, tx) {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'sample_version'").get();
  if (row && Number(row.value) === SAMPLE_VERSION) return { files: [], refreshed: 0 };
  const kids = db.prepare('SELECT child_id, MIN(created_by) AS by FROM entries WHERE is_sample = 1 GROUP BY child_id').all();
  const files = [];
  tx(db, () => {
    for (const k of kids) {
      files.push(...removeSampleContent(db, k.child_id));
      addSampleContent(db, uploadsDir, k.child_id, k.by);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('sample_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(SAMPLE_VERSION));
  });
  return { files, refreshed: kids.length };
}

module.exports = { addSampleContent, removeSampleContent, refreshSamples, SAMPLE_VERSION };
