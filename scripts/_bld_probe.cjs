// _bld_probe.cjs — Discovery for populating the Mr. Electric of Boulder demo dashboard.
// Dumps schema + what mr-electric-demo and folsom already hold per Train-Mark section,
// plus how the Mr. Electric drip campaigns are structured (to clone into Boulder).
// Read-only. Run: cd ~/mark && doppler run -- node _bld_probe.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);

const DEMO = 'a4ff4b38-6647-43da-b373-d44c01db53c2';   // mr-electric-demo (brand master)
const BLD  = '87635054-5169-4e43-b140-46ca4ae0cf42';   // mr-electric-boulder (Perry)
const FOL  = '3f74befb-3db6-41b7-8348-63b7f932e7f1';   // folsom (fully-configured reference)

async function cols(t){
  const r = await q(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t]);
  return r.rows.map(c=>`${c.column_name}:${c.data_type}`);
}
async function has(t){
  const r = await q(`SELECT to_regclass('public.'||$1) IS NOT NULL AS ok`,[t]);
  return r.rows[0].ok;
}
async function cnt(t, fid){
  try{ const r = await q(`SELECT count(*)::int n FROM ${t} WHERE franchise_id=$1`,[fid]); return r.rows[0].n; }
  catch(e){ return 'ERR '+e.message; }
}

(async()=>{
  console.log('PROBE_OK\n');

  // 1) every franchise_* / drip / faq / service / hours-ish table
  const tbls = (await q(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND (
      table_name LIKE 'franchise%' OR table_name LIKE 'drip%' OR table_name LIKE '%faq%'
      OR table_name LIKE '%service%' OR table_name LIKE '%hour%' OR table_name LIKE '%member%'
      OR table_name LIKE '%financ%' OR table_name LIKE '%campaign%' OR table_name LIKE '%template%'
      OR table_name LIKE '%script%' OR table_name LIKE '%personality%' OR table_name LIKE '%faqs%')
    ORDER BY table_name`)).rows.map(r=>r.table_name);
  console.log('=== candidate tables ===');
  console.log(tbls.join('\n'));

  // 2) the franchises row columns (pitch/personality/script/hours often live here)
  console.log('\n=== franchises columns ===');
  console.log((await cols('franchises')).join('\n'));

  // 3) full mr-electric-demo franchises row + folsom (to see what columns hold what)
  console.log('\n=== mr-electric-demo franchises row (all cols) ===');
  console.log(JSON.stringify((await q('SELECT * FROM franchises WHERE id=$1',[DEMO])).rows[0],null,1));
  console.log('\n=== folsom franchises row (all cols) ===');
  console.log(JSON.stringify((await q('SELECT * FROM franchises WHERE id=$1',[FOL])).rows[0],null,1));

  // 4) per-section tables: columns + counts for demo/boulder/folsom + a sample demo row
  const sect = ['franchise_services','franchise_faqs','franchise_service_area','franchise_hours',
    'franchise_membership_plans','franchise_financing','financing_lender','franchise_pricing',
    'franchise_personality','franchise_phone_script','franchise_business_info'];
  for(const t of sect){
    const ok = await has(t);
    console.log(`\n=== ${t} === exists=${ok}`);
    if(!ok) continue;
    console.log('cols: '+(await cols(t)).join(' | '));
    console.log(`counts demo=${await cnt(t,DEMO)} boulder=${await cnt(t,BLD)} folsom=${await cnt(t,FOL)}`);
    // sample from whichever of demo/folsom has rows
    for(const [lbl,fid] of [['demo',DEMO],['folsom',FOL]]){
      try{
        const s = await q(`SELECT * FROM ${t} WHERE franchise_id=$1 LIMIT 3`,[fid]);
        if(s.rows.length){ console.log(`sample(${lbl}): `+JSON.stringify(s.rows,null,1)); break; }
      }catch(e){}
    }
  }

  // 5) drip campaigns: structure + how the Mr. Electric brand master's campaigns look
  console.log('\n=== drip tables detail ===');
  for(const t of tbls.filter(x=>x.includes('drip')||x.includes('campaign')||x.includes('template'))){
    if(!(await has(t))) continue;
    console.log(`\n-- ${t} cols: `+(await cols(t)).join(' | '));
    try{ console.log(`   demo count=${await cnt(t,DEMO)}`); }catch(e){}
  }
  // the demo's campaigns themselves
  try{
    const dc = await q(`SELECT * FROM drip_campaigns WHERE franchise_id=$1 ORDER BY id`,[DEMO]);
    console.log(`\n=== mr-electric-demo drip_campaigns (${dc.rows.length}) ===`);
    console.log(JSON.stringify(dc.rows,null,1));
  }catch(e){ console.log('drip_campaigns demo ERR '+e.message); }

  // 6) did any REAL franchise already get campaigns cloned? how? (verify-before-build)
  try{
    const who = await q(`SELECT f.slug, count(*)::int n FROM drip_campaigns d
      JOIN franchises f ON f.id=d.franchise_id GROUP BY f.slug ORDER BY n DESC`);
    console.log('\n=== drip_campaigns by franchise ===');
    console.log(who.rows.map(r=>`${r.n}  ${r.slug}`).join('\n'));
  }catch(e){ console.log('by-franchise ERR '+e.message); }

  // 7) pricebook category list for Boulder's master (feeds the Services section)
  try{
    const cats = await q(`SELECT category, count(*)::int n FROM franchise_pricebook
      WHERE franchise_id=$1 AND sku_code LIKE 'ME.%' GROUP BY category ORDER BY category`,[DEMO]);
    console.log('\n=== mr-electric pricebook categories (for Services) ===');
    console.log(cats.rows.map(r=>`${r.n}  ${r.category}`).join('\n'));
  }catch(e){ console.log('cats ERR '+e.message); }

  await pool.end();
  console.log('\nPROBE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
