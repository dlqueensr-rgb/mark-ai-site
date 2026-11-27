// _st_write_status.cjs — will Mark actually MOVE a Folsom appointment, or just request it?
// Mirrors estimate_tools._writesAllowed: needs NEWMARK_ST_WRITES=on AND booking_test_mode=false.
// Run: cd ~/newmark && doppler run -- node _st_write_status.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async()=>{
  const env = String(process.env.NEWMARK_ST_WRITES || '').toLowerCase();
  const r = await pool.query("SELECT slug, booking_test_mode FROM franchises WHERE slug='folsom'");
  const f = r.rows[0] || {};
  const envOn = env === 'on';
  const testMode = f.booking_test_mode !== false;  // true or null => test mode (writes blocked)
  const willWrite = envOn && !testMode;
  console.log('NEWMARK_ST_WRITES = "'+(env||'(unset)')+'"  -> ' + (envOn ? 'ON' : 'OFF'));
  console.log('folsom.booking_test_mode = ' + f.booking_test_mode + '  -> ' + (testMode ? 'TEST MODE (writes blocked)' : 'LIVE'));
  console.log('');
  console.log(willWrite
    ? 'VERDICT: LIVE — Mark will actually move/cancel the appointment in ServiceTitan and confirm it to the customer.'
    : 'VERDICT: REQUEST-ONLY — Mark will reply "the office will confirm" and text you to make the change. To go live: ' + (!envOn ? 'set NEWMARK_ST_WRITES=on' : '') + (!envOn && testMode ? ' AND ' : '') + (testMode ? 'set folsom.booking_test_mode=false' : '') + '.');
  await pool.end();
  console.log('ST_WRITE_STATUS_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
