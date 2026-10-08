'use strict';
/* Loads a fictional family so you can click around Ankur without typing anything in.
   Nothing here is real data. Run:  npm run seed          (only if the app is still empty)
                                    npm run seed:reset    (wipes data/ first)            */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { openDb, seedLadder, tx } = require('../db');

const DEMO = path.join(__dirname, '..', 'demo');
const MIME = { '.png': 'image/png', '.wav': 'audio/wav', '.pdf': 'application/pdf' };
const find = (f) => (['images', 'media'].map((d) => path.join(DEMO, d, f)).find((p) => fs.existsSync(p)));
const CREDENTIALS = {
  parent: { email: 'parent@example.com', password: 'ankur-demo-1' },
  family: { email: 'grandma@example.com', password: 'grandma-pass1' },
  kid: { username: 'mira', password: 'sprout1' },
};

function day(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function seedDemo(dataDir, { reset = false } = {}) {
  if (reset) {
    for (const f of ['ankur.db', 'ankur.db-wal', 'ankur.db-shm']) fs.rmSync(path.join(dataDir, f), { force: true });
    fs.rmSync(path.join(dataDir, 'uploads'), { recursive: true, force: true });
  }
  const db = openDb(dataDir);
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
    db.close();
    throw new Error('This Ankur already has accounts. Use "npm run seed:reset" to wipe it and load the demo.');
  }
  const uploads = path.join(dataDir, 'uploads');

  tx(db, () => {
    const user = (name, email, password, role, childId = null) =>
      Number(db.prepare('INSERT INTO users (name, email, password_hash, role, child_id) VALUES (?, ?, ?, ?, ?)')
        .run(name, email, bcrypt.hashSync(password, 10), role, childId).lastInsertRowid);

    const parentId = user('Demo Parent', CREDENTIALS.parent.email, CREDENTIALS.parent.password, 'parent');
    const born = new Date(); born.setFullYear(born.getFullYear() - 7); born.setMonth(born.getMonth() - 6);
    const childId = Number(db.prepare('INSERT INTO children (name, nickname, dob, bio) VALUES (?, ?, ?, ?)')
      .run('Mira', null, day(-Math.round((Date.now() - born.getTime()) / 864e5)), 'Loves painting, stories and the stage.').lastInsertRowid);
    seedLadder(db, childId);
    user('Mira', CREDENTIALS.kid.username, CREDENTIALS.kid.password, 'child', childId);
    user('Grandma', CREDENTIALS.family.email, CREDENTIALS.family.password, 'family');

    const entry = (category, title, offset, notes, ...files) => {
      const id = Number(db.prepare('INSERT INTO entries (child_id, category, title, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .run(childId, category, title, day(offset), notes, parentId).lastInsertRowid);
      for (const name of files) {
        const ext = path.extname(name);
        const file = crypto.randomBytes(16).toString('hex') + ext;
        fs.copyFileSync(find(name), path.join(uploads, file));
        db.prepare('INSERT INTO media (entry_id, file, original, mime, size) VALUES (?, ?, ?, ?, ?)')
          .run(id, file, name, MIME[ext], fs.statSync(path.join(uploads, file)).size);
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

    const event = (title, offset, kind, location) => db.prepare('INSERT INTO events (child_id, title, date, kind, location) VALUES (?, ?, ?, ?, ?)')
      .run(childId, title, day(offset), kind, location);
    event('Inter-school colouring contest', 37, 'contest', 'Community centre');
    event('Cambridge Movers', 150, 'exam', null);
    const past = db.prepare("INSERT INTO events (child_id, title, date, kind, location, status, result) VALUES (?, ?, ?, ?, ?, 'done', ?)");
    past.run(childId, 'School talent show', -30, 'performance', 'School hall', 'Sang with the class choir');
    past.run(childId, 'Hindi recitation contest', -62, 'contest', 'Community centre', '2nd place');
    const activity = (name, category, schedule, provider) => db.prepare('INSERT INTO activities (child_id, name, category, schedule, provider, active) VALUES (?, ?, ?, ?, ?, 1)')
      .run(childId, name, category, schedule, provider);
    activity('Hindi tuition', 'hindi', 'Saturdays 10am', 'Mrs Sharma');
    activity('Art class', 'art', 'Wednesdays 4pm', null);
    activity('Toastmasters Youth', 'speech', '1st Sunday', null);

    const ladder = db.prepare('SELECT id FROM ladder WHERE child_id = ? ORDER BY sort').all(childId);
    db.prepare("UPDATE ladder SET status = 'passed', score = '15 shields', date = ? WHERE id = ?").run(day(-26), ladder[0].id);
    db.prepare("UPDATE ladder SET status = 'preparing' WHERE id = ?").run(ladder[1].id);
  });

  // Leave a single portable .db file (no -wal/-shm) so the folder can move between machines.
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  db.exec('PRAGMA journal_mode = DELETE');
  db.close();
  return CREDENTIALS;
}

module.exports = { seedDemo, CREDENTIALS };

if (require.main === module) {
  const dataDir = process.env.ANKUR_DATA_DIR || path.join(__dirname, '..', 'data');
  try {
    const c = seedDemo(dataDir, { reset: process.argv.includes('--reset') });
    console.log(`
Demo family loaded into ${dataDir}

  Parent   ${c.parent.email}  /  ${c.parent.password}
  Family   ${c.family.email}  /  ${c.family.password}   (view only)
  Kid      ${c.kid.username}  /  ${c.kid.password}      (tap "I'm a kid" on the sign-in page)

Start the app with:  npm start   then open http://localhost:3000
`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
