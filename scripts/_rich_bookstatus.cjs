// _rich_bookstatus.cjs — why isn't SW Minneapolis booking into ServiceTitan?
// Mirrors estimate_tools._writesAllowed (NEWMARK_ST_WRITES=on AND booking_test_mode=false) and checks ST creds.
// Run: cd ~/newmark && doppler run -- node _rich_bookstatus.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async()=>{
  const env = String(process.env.NEWMARK_ST_WRITES || '').toLowerCase();
  const r = await pool.query(`SELECT slug, dba_name, booking_test_mode, crm,
      (st_tenant_id_enc IS NOT NULL) has_tenant, (st_client_id_enc IS NOT NULL) has_client,
      (st_client_secret_enc IS NOT NULL) has_secret, (st_app_key_enc IS NOT NULL) has_appkey,
      st_business_unit_id, st_job_type_id
    FROM franchises WHERE slug='southwest-minneapolis-southwest-suburbs'`);
  const f = r.rows[0];
  if(!f){ console.log('SW Minneapolis franchise not found'); await pool.end(); return; }
  const envOn = env === 'on';
  const testMode = f.booking_test_mode !== false;
  const credsOk = f.has_tenant && f.has_client && f.has_secret && f.has_appkey;
  console.log('office: '+f.dba_name+'  crm='+(f.crm||'ServiceTitan'));
  console.log('NEWMARK_ST_WRITES = "'+(env||'(unset)')+'" -> '+(envOn?'ON':'OFF'));
  console.log('booking_test_mode = '+f.booking_test_mode+' -> '+(testMode?'TEST MODE (bookings NOT written)':'LIVE'));
  console.log('ST creds present  : tenant='+f.has_tenant+' client='+f.has_client+' secret='+f.has_secret+' appkey='+f.has_appkey);
  console.log('ST business_unit_id='+f.st_business_unit_id+'  st_job_type_id='+f.st_job_type_id);
  console.log('');
  const willBook = envOn && !testMode && credsOk;
  if(willBook) console.log('VERDICT: should book live. If it still did not, the failure is in the booking call itself (creds invalid, no tech/slot, or job-type) - need the pm2 logs for that call.');
  else {
    const reasons = [];
    if(!envOn) reasons.push('NEWMARK_ST_WRITES is not "on"');
    if(testMode) reasons.push('booking_test_mode is not false (this office is in TEST MODE - the #1 cause of "request only, office will confirm")');
    if(!credsOk) reasons.push('ServiceTitan creds are incomplete');
    console.log('VERDICT: NOT booking live because -> '+reasons.join('; '));
    console.log('FIX: '+(testMode?'set booking_test_mode=false for this office (once ST creds are verified)':'')+(!credsOk?' finish connecting ServiceTitan creds':''));
  }
  await pool.end();
  console.log('RICH_BOOKSTATUS_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
