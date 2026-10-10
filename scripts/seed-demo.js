'use strict';
/* Loads a fictional family so you can click around Kaizen Folio without typing anything in.
   Nothing here is real data. Run:  npm run seed          (only if the app is still empty)
                                    npm run seed:reset    (wipes data/ first)            */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { openDb, seedLadder, tx } = require('../db');
const { addSampleContent } = require('../demo-content');

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
    throw new Error('This Kaizen Folio already has accounts. Use "npm run seed:reset" to wipe it and load the demo.');
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

    addSampleContent(db, uploads, childId, parentId);

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
