import { pool } from '../src/db.js';

const confirmed = process.argv.includes('--yes') || process.argv.includes('-y');

if (!confirmed) {
  console.error('This will delete ALL telemetry data from Postgres.');
  console.error('Run again with: npm run db:clear -- --yes');
  process.exitCode = 1;
  await pool.end();
  process.exit();
}

try {
  await pool.query('truncate table device_latest, metrics, devices restart identity cascade');
  console.log('Postgres data cleared successfully.');
} finally {
  await pool.end();
}
