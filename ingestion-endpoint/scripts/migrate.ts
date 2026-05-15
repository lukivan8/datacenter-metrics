import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const schema = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');

try {
  await pool.query(schema);
  console.log('Database migration applied successfully.');
} finally {
  await pool.end();
}
