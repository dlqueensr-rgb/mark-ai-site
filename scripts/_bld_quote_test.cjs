// _bld_quote_test.cjs — (1) flip big commercial/rewire jobs to by-estimate (phone_default=false),
// (2) prove Boulder quotes real jobs end-to-end via the LIVE path ET.priceJob (book hours x Boulder rate),
// (3) prove the commercial jobs now route to in-person. Run from ~/newmark so requires resolve:
//   cd ~/newmark && doppler run -- node _bld_quote_test.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const ET = require('./src/estimate_tools.cjs');
const HV2 = require('./src/hoursV2.cjs');
const BLD = '87635054-5169-4e43-b140-46ca4ae0cf42';
const BRAND = 'Mr. Electric';

// big jobs that should NOT be phone-quoted (book a look instead)
const BY_ESTIMATE = [
  'Install commercial EV charging bank','Office build-out electrical','Restaurant build-out electrical',
  'Retail build-out electrical','Tenant-improvement electrical (small suite)','Warehouse power distribution',
  'Commercial 3-phase service upgrade','Commercial electrical panel or service upgrade',
  'Install commercial standby generator and ATS','ADU or in-law unit electrical','Basement finish electrical',
  'Kitchen remodel electrical rough-in','Room addition electrical rough-in',
  'Whole-home rewire (up to ~1,200 sq ft)','Whole-home rewire (1,200 to 2,500 sq ft)',
  'Convert overhead service to underground','Electrical service upgrade 100A to 400A','Remediate knob-and-tube wiring',
];

// phone-quotable jobs to prove the price chain
const PRICE_JOBS = [
  { description:'Electrical service upgrade 100A to 200A', kind:'replace', count:1 },
  { description:'Install Level 2 EV charger (near panel, capacity available)', kind:'new', count:1 },
  { description:'Replace electrical light switch', kind:'replace', count:1 },
];
// commercial jobs to prove they now route to a visit
const VISIT_JOBS = ['Office build-out electrical','Commercial 3-phase service upgrade'];

const money = n => '$'+Math.round(Number(n)||0).toLocaleString('en-US');

(async()=>{
  // ---------- (1) flip modes ----------
  console.log('=== MODE FLIP: big jobs -> by-estimate (phone_default=false) ===');
  let flipped=0;
  for(const name of BY_ESTIMATE){
    const cur = await pool.query('SELECT phone_default FROM master_job_hours WHERE name=$1 AND brand=$2',[name,BRAND]);
    if(!cur.rows.length){ console.log('  ! NOT FOUND: '+name); continue; }
    if(cur.rows[0].phone_default===false){ console.log('  = already by-estimate: '+name); continue; }
    await pool.query('UPDATE master_job_hours SET phone_default=false, updated_at=now() WHERE name=$1 AND brand=$2',[name,BRAND]);
    console.log('  ~ '+name+'  phone_default: true -> false'); flipped++;
  }
  console.log('flipped='+flipped);

  // ---------- (2) prove phone quotes ----------
  console.log('\n=== LIVE QUOTE (ET.priceJob, franchise=Boulder $189/$89) ===');
  const pr = await pool.query('SELECT labor_rate,service_fee,van_stock_pct,cc_fee_pct FROM franchise_pricing WHERE franchise_id=$1',[BLD]);
  console.log('Boulder pricing: '+JSON.stringify(pr.rows[0]));
  for(const job of PRICE_JOBS){
    try{
      const o = await ET.priceJob(BLD, [job], {});
      if(!o || !o.ok){ console.log(`  ✗ "${job.description}" -> ${(o&&o.error)||'no result'} ${(o&&o.note)||''}`); continue; }
      const l = (o.lines&&o.lines[0])||{};
      console.log(`  ✓ "${job.description}"`);
      console.log(`      matched book job: ${l.matchedSku||'(reasoned)'}  | ${l.hours}h x ${l.tech_count} tech = ${l.crewedHours}h  | src=${l.hoursSource}`);
      console.log(`      PRICE: ${o.card&&o.card!==o.cash ? money(o.cash)+' cash / '+money(o.card)+' card' : money(o.cash)}`);
    }catch(e){ console.log(`  ✗ "${job.description}" threw: ${e.message}`); }
  }

  // ---------- (3) prove commercial routes to a visit ----------
  console.log('\n=== BY-ESTIMATE ROUTING (phoneOn should be FALSE) ===');
  for(const desc of VISIT_JOBS){
    try{
      const d = await HV2.decide(pool, { description:desc, quantity:1, kind:'new', franchiseId:BLD, via:'phone', background:true });
      if(!d || !d.ok || !d.entryId){ console.log(`  ? "${desc}" -> could not resolve entry (${d&&d.reason||''})`); continue; }
      const on = await HV2.phoneOn(pool, BLD, d.entryId);
      console.log(`  ${on===false?'✓ books a look':'✗ still phone-priced'}: "${desc}" -> matched ${d.name} | phoneOn=${on}`);
    }catch(e){ console.log(`  ? "${desc}" threw: ${e.message}`); }
  }

  await pool.end();
  console.log('\nQUOTE_TEST_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
