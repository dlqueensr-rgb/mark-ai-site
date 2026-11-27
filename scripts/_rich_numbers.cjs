// _rich_numbers.cjs — which numbers does Mark catch calls/texts on for SW Minneapolis?
// Shows the franchise's number columns + every franchise_phone_numbers row (LINES_V2 - what resolveFranchise matches).
// Read-only. Run: cd ~/newmark && doppler run -- node _rich_numbers.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const SW = 'southwest-minneapolis-southwest-suburbs';
const t10 = v => String(v||'').replace(/\D/g,'').slice(-10);
(async()=>{
  const f = (await pool.query(`SELECT id, dba_name, phone, twilio_phone_number, marketing_campaign_phone, twilio_account_sid FROM franchises WHERE slug=$1`,[SW])).rows[0];
  if(!f){ console.log('not found'); await pool.end(); return; }
  console.log('office: '+f.dba_name);
  console.log('franchises.phone (published)   : '+(f.phone||'(none)'));
  console.log('franchises.twilio_phone_number : '+(f.twilio_phone_number||'(none)'));
  console.log('marketing_campaign_phone (track): '+(f.marketing_campaign_phone||'(none)'));
  console.log('twilio_account_sid             : '+(f.twilio_account_sid ? f.twilio_account_sid.slice(0,10)+'...(own account)' : '(uses platform account)'));

  // franchise_phone_numbers (LINES_V2) - every number that resolves to this office
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='franchise_phone_numbers' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
  console.log('\nfranchise_phone_numbers cols: '+cols.join(', '));
  const rows = (await pool.query(`SELECT * FROM franchise_phone_numbers WHERE franchise_id=$1 ORDER BY 1`,[f.id])).rows;
  console.log('=== registered numbers Mark answers on ('+rows.length+') ===');
  rows.forEach(r=>console.log('  '+Object.entries(r).filter(([k])=>k!=='franchise_id'&&k!=='id').map(([k,v])=>k+'='+v).join('  ')));

  // the tracked number from the call screenshot, for comparison
  console.log('\n(tracked number seen on Richard\'s test call: 952-260-7676 = '+t10('952-260-7676')+')');
  const all = new Set(rows.map(r=>t10(r.phone_number)).concat([t10(f.phone),t10(f.twilio_phone_number),t10(f.marketing_campaign_phone)]).filter(Boolean));
  console.log('all numbers that resolve to this office: '+[...all].join(', '));
  await pool.end();
  console.log('RICH_NUMBERS_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
