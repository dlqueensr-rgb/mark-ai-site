// _rich_golive.cjs — make SW Minneapolis book live: set the bookDirect-required job type + campaign, then flip booking_test_mode off.
// Order matters: set the config FIRST, then go live, so the next call clears both guards.
// Job type 105000013 = Maintenance/Repair (by-trade fallback); campaign 219833011 = "...SW Suburbs Main GMB Calls".
// Run: cd ~/newmark && doppler run -- node _rich_golive.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const SW = 'southwest-minneapolis-southwest-suburbs';
const JOB_TYPE = 105000013;   // Maintenance/Repair (fallback; by_trade=true so real jobs use the matched trade type)
const CAMPAIGN = 219833011;   // ...SW and Southwest Suburbs Main GMB Calls | Golden Valley MN
(async()=>{
  const env = String(process.env.NEWMARK_ST_WRITES || '').toLowerCase();
  const r = await pool.query(
    `UPDATE franchises SET st_job_type_id=$2, st_campaign_id=$3, booking_test_mode=false, updated_at=now()
     WHERE slug=$1 RETURNING slug, st_business_unit_id, st_job_type_id, st_campaign_id, st_job_type_by_trade, booking_test_mode`,
    [SW, JOB_TYPE, CAMPAIGN]
  );
  const f = r.rows[0];
  if(!f){ console.log('SW Minneapolis not found'); await pool.end(); return; }
  console.log('SET: business_unit='+f.st_business_unit_id+'  job_type='+f.st_job_type_id+'  campaign='+f.st_campaign_id+'  by_trade='+f.st_job_type_by_trade+'  booking_test_mode='+f.booking_test_mode);
  const ready = (env==='on') && f.booking_test_mode===false && f.st_business_unit_id && f.st_job_type_id && f.st_campaign_id;
  console.log('NEWMARK_ST_WRITES='+(env==='on'?'ON':env||'(unset)'));
  console.log(ready
    ? '\nVERDICT: LIVE AND READY — bookDirect clears the write gate and the st_setup guard. The next call will create the job in ServiceTitan.'
    : '\nVERDICT: still not ready — one of {writes on, test mode off, bu, job type, campaign} is missing above.');
  await pool.end();
  console.log('RICH_GOLIVE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
