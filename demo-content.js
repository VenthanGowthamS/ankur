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
    let level = null, result = null;
    if (files.length && typeof files[files.length - 1] === 'object') ({ level = null, result = null } = files.pop());
    const id = Number(db.prepare('INSERT INTO entries (child_id, category, title, date, notes, level, result, created_by, is_sample) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)')
      .run(childId, category, title, day(offset), notes, level, result, createdBy).lastInsertRowid);
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
  entry('olympiad', 'Maths Olympiad — zonal round', -22, 'Solved the tricky pattern question all by herself.', 'medal.png', { level: 'zonal', result: 'Gold medal · top 5%' });
  entry('olympiad', 'Science Olympiad — school round', -60, 'First time sitting an olympiad paper. Stayed calm for the full hour.', { level: 'school', result: 'Distinction' });
  entry('martial', 'Karate — yellow belt grading', -16, 'Kata performed without a pause. Sensei said her stance was perfect.', 'belt.png', { result: 'Yellow belt' });
  entry('martial', 'Taekwondo inter-club tournament', -41, 'Sparring, under-8 category. Lost the final by one point.', { level: 'zonal', result: 'Silver medal' });
  entry('sports', 'Football — zonal tournament', -28, 'Scored a goal in the semi-final. Team lost the final on penalties.', { level: 'zonal', result: 'Runner-up (team)' });
  entry('sports', 'Football — national selection trials', -70, 'Made the shortlist from over 200 children.', { level: 'national', result: 'Shortlisted' });
  entry('sports', 'International youth football festival', -95, 'Played three matches against teams from four countries.', { level: 'international', result: 'Team participant' });
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
  event('Hindi recitation contest', -62, 'contest', 'Community centre', 'done', '2nd place');

  const activity = (name, category, schedule, provider) =>
    db.prepare('INSERT INTO activities (child_id, name, category, schedule, provider, active, is_sample) VALUES (?, ?, ?, ?, ?, 1, 1)')
      .run(childId, name, category, schedule, provider);
  activity('Hindi tuition', 'hindi', 'Saturdays 10am', 'Mrs Sharma');
  activity('Art class', 'art', 'Wednesdays 4pm', null);
  activity('Toastmasters Youth', 'speech', '1st Sunday', null);
  activity('Karate', 'martial', 'Tuesdays 6pm', 'Sensei Lee');
  activity('Football', 'sports', 'Saturdays 4pm', 'Zone team');
  activity('Skating', 'skating', 'Sundays 9am', null);
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
