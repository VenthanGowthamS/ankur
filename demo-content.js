'use strict';
/* Fictional sample moments, events and activities. Everything added here is flagged is_sample = 1,
   so it can be removed with one tap and never mixes with real memories. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEMO = path.join(__dirname, 'demo');
const MIME = { '.png': 'image/png', '.wav': 'audio/wav', '.pdf': 'application/pdf' };
const find = (f) => ['images', 'media'].map((d) => path.join(DEMO, d, f)).find((p) => fs.existsSync(p));

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addSampleContent(db, uploadsDir, childId, createdBy) {
  const entry = (category, title, offset, notes, ...files) => {
    let level = null, result = null, subject = null, score = null;
    if (files.length && typeof files[files.length - 1] === 'object') ({ level = null, result = null, subject = null, score = null } = files.pop());
    const id = Number(db.prepare('INSERT INTO entries (child_id, category, title, date, notes, level, result, subject, score, created_by, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)')
      .run(childId, category, title, day(offset), notes, level, result, subject, score, createdBy).lastInsertRowid);
    for (const name of files) {
      const ext = path.extname(name);
      const file = crypto.randomBytes(16).toString('hex') + ext;
      fs.copyFileSync(find(name), path.join(uploadsDir, file));
      db.prepare('INSERT INTO media (entry_id, file, original, mime, size) VALUES (?, ?, ?, ?, ?)')
        .run(id, file, name, MIME[ext], fs.statSync(path.join(uploadsDir, file)).size);
    }
  };
  entry('speech', 'Speech practice (sample sound)', -4, 'Tap play to hear a recording. Real ones can be voice notes from the phone.', 'speech-practice-sample.wav');
  entry('art', 'Rainbow after the rain', -10, 'Poster colours. She mixed the purple herself.', 'art_rainbow.png');
  entry('school', 'Lantern making', -14, 'Made a paper lantern for the class festival. Helped a friend with hers.');
  entry('speech', 'Speech: My Favourite Festival', -18, 'Spoke for 2 minutes without notes. Eye contact was lovely.', 'speech_stage.png');
  entry('exam', 'Cambridge Starters result', -26, 'Great score — full marks in listening. Certificate attached.', 'certificate-sample.pdf');
  entry('hindi', 'Hindi alphabet chart', -33, 'Finished writing all the varnamala neatly.');
  entry('art', 'Flower garden', -39, 'Used a sponge for the petals.', 'art_flower.png');
  entry('accolade', 'Kindness badge', -47, 'Class teacher’s pick for helping a new classmate settle in.');
  entry('art', 'Peacock watercolour', -55, 'Wet-on-wet technique, first time.', 'art_peacock.png');
  entry('hindi', 'Hindi poem recitation', -67, 'Recited without a single prompt. Teacher was delighted.');
  entry('accolade', 'Star of the week', -80, 'Awarded for kindness in class.');

  // Achievements beyond the classroom: olympiads, martial arts, sports, skating
  entry('olympiad', 'SASMO — Maths', -22, 'Open-ended section was the hard part. Checked her answers twice.', 'medal.png', { level: 'international', result: 'Silver medal', subject: 'maths', score: '71 / 85' });
  entry('olympiad', 'SOF IMO — Level 1 (Maths)', -48, 'Zonal rank from the Student Performance Report. Qualified for Level 2.', { level: 'zonal', result: 'Zonal rank 9', subject: 'maths', score: '52 / 60' });
  entry('olympiad', 'SOF IEO — Level 1 (English)', -60, 'Strong on vocabulary, lost marks on spoken & written expression.', { level: 'school', result: 'School rank 3', subject: 'english', score: '44 / 60' });
  entry('olympiad', 'SOF NSO — Level 1 (Science)', -75, 'First science olympiad. Loved the achievers section.', { level: 'zonal', result: 'Medal of Distinction', subject: 'science', score: '48 / 60' });
  entry('olympiad', 'SEAMO — Paper B (Maths)', -90, 'Twenty multiple-choice and five open-ended questions. Finished with time to spare.', { level: 'international', result: 'Bronze award', subject: 'maths', score: '68 / 100' });
  entry('olympiad', 'ICAS English', -100, 'Reading comprehension was her strongest part.', { level: 'international', result: 'Distinction', subject: 'english', score: '34 / 40' });
  entry('olympiad', 'Math Kangaroo', -110, 'Tricky puzzles about shapes and patterns. Loved it.', { level: 'international', result: 'Silver award', subject: 'maths', score: '84 / 120' });
  entry('olympiad', 'SOF NCO — Level 1 (Cyber)', -120, 'Questions on computers, the internet and logic.', { level: 'school', result: 'School rank 2', subject: 'computer', score: '41 / 50' });
  // Coding and robotics classes
  entry('coding', 'First Scratch game: Catch the stars', -12, 'Built it herself with sprites, a score counter and a timer. Showed it to the whole family.', { result: 'Block-coding level complete' });
  entry('coding', 'Python turtle drawing', -40, 'Wrote loops to draw a spiral flower. Debugged one indentation error alone.', { result: 'Started Python basics' });
  entry('robotics', 'Line-following robot', -20, 'Built the robot, then programmed it to follow a black line around the track.', 'robot.png', { result: 'Challenge completed' });
  entry('robotics', 'Robotics showcase day', -52, 'Presented the team’s robot to parents. Explained the sensors without notes.', { level: 'school', result: 'Best team spirit' });
  // Chinese, dance, stage, singing and writing
  entry('chinese', 'Mandarin YCT 2 exam', -18, 'Listening and reading went well. Spoke a short self-introduction in Chinese.', { result: 'YCT 2 passed', score: '168 / 200' });
  entry('chinese', 'Chinese calligraphy — spring couplet', -44, 'Wrote 福 with a brush for Chinese New Year. Practised stroke order every evening.', { level: 'school', result: 'Displayed in the school hall' });
  entry('dance', 'Ballet recital — The Little Swan', -26, 'First time on a proper stage. Remembered every step.', { level: 'school', result: 'Pre-primary grade: Merit' });
  entry('dance', 'Chinese dance — ribbon performance', -58, 'Ribbon dance for the National Day concert.', { result: 'Performed with the class' });
  entry('stage', 'Speech & drama showcase — The Three Pigs', -21, 'Played the wolf and used a big voice. Spoke clearly to the back row.', { level: 'school', result: 'Lead role' });
  entry('stage', 'School musical — chorus', -64, 'Learned three songs and the stage positions.', { result: 'Performed on both nights' });
  entry('singing', 'Piano Grade 1 exam', -33, 'Played three pieces and scales. Nervous but steady.', { result: 'Grade 1 passed', score: '124 / 150' });
  entry('singing', 'Choir festival performance', -50, 'Sang in a two-part song with the school choir.', { level: 'zonal', result: 'Silver award' });
  entry('writing', 'My first short story: The Moon Garden', -15, 'Wrote 12 sentences all by herself and drew the pictures.', { result: 'Read aloud in class' });
  entry('writing', 'Creative writing contest', -72, 'Wrote about a day as a raindrop.', { level: 'zonal', result: 'Highly commended' });
  entry('martial', 'Karate — yellow belt grading', -16, 'Kata performed without a pause. Sensei said her stance was perfect.', 'belt.png', { result: 'Yellow belt' });
  entry('martial', 'Taekwondo inter-club tournament', -41, 'Sparring, under-8 category. Lost the final by one point.', { level: 'zonal', result: 'Silver medal' });
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
}

// Removes everything flagged as sample for one child, including uploaded files. Returns the file names to delete.
function removeSampleContent(db, childId) {
  const files = db.prepare('SELECT m.file FROM media m JOIN entries e ON e.id = m.entry_id WHERE e.child_id = ? AND e.is_sample = 1').all(childId).map((r) => r.file);
  db.prepare('DELETE FROM entries WHERE child_id = ? AND is_sample = 1').run(childId);
  db.prepare('DELETE FROM events WHERE child_id = ? AND is_sample = 1').run(childId);
  db.prepare('DELETE FROM activities WHERE child_id = ? AND is_sample = 1').run(childId);
  return files;
}

module.exports = { addSampleContent, removeSampleContent };
