require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const ask = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

const askHidden = (question) => new Promise((resolve, reject) => {
  const input = process.stdin;
  if (!input.isTTY) return reject(new Error('Run this command in an interactive terminal.'));
  process.stdout.write(question);
  input.setRawMode(true);
  input.resume();
  input.setEncoding('utf8');
  let answer = '';
  const onData = (key) => {
    if (key === '\u0003') {
      input.setRawMode(false);
      process.stdout.write('\n');
      process.exit(130);
    } else if (key === '\r' || key === '\n') {
      input.setRawMode(false);
      input.pause();
      input.removeListener('data', onData);
      process.stdout.write('\n');
      resolve(answer);
    } else if (key === '\u007f' || key === '\b') {
      answer = answer.slice(0, -1);
    } else if (key >= ' ') {
      answer += key;
    }
  };
  input.on('data', onData);
});

(async () => {
  try {
    const username = await ask('Admin username: ');
    const password = await askHidden('Admin password (input hidden): ');
    if (!username || password.length < 12) {
      throw new Error('Username is required and password must be at least 12 characters.');
    }
    const hash = await bcrypt.hash(password, 12);
    await db.query(
      `insert into public.admin (username, password)
       values (?, ?)
       on conflict (username) do update set password = excluded.password`,
      [username, hash]
    );
    console.log(`Admin account '${username}' saved.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
})();
