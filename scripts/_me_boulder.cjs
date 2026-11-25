// _me_boulder.cjs — Create the real Mr. Electric of Boulder franchise (owner Perry Wyatt) for the demo dashboard.
// Mr. Electric blue/yellow, wordmark logo, pointed at the mr-electric-demo electrical pricebook (hours master).
// Placeholder rates Perry adjusts in the Job Pricing screen. Idempotent. Run: doppler run -- node _me_boulder.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const ME_MASTER = 'a4ff4b38-6647-43da-b373-d44c01db53c2'; // mr-electric-demo (hours pricebook master)
const BLUE='#016AC6', GOLD='#F0C400';
(async()=>{
  // clone the electrical pitch + listen-words from the demo master so Boulder is a complete Mr. Electric config
  const demo = (await q("SELECT business_pitch, listen_words FROM franchises WHERE slug='mr-electric-demo'")).rows[0] || {};
  const pitch = demo.business_pitch || 'Mr. Electric is a professional electrical company and part of the Neighborly family of home-service brands.';
  const listen = demo.listen_words || ['panel','breaker','EV charger','outlet','lighting'];
  const ex = await q("SELECT id FROM franchises WHERE slug='mr-electric-boulder'");
  let id;
  if(ex.rows[0]){
    id = ex.rows[0].id;
    await q(`UPDATE franchises SET dba_name=$2, owner_name=$3, brand=$4, city=$5, state=$6, zip=$7, timezone=$8,
      primary_color=$9, accent_color=$10, brand_wordmark_url=$11, master_pricebook_franchise_id=$12, crm='servicetitan',
      business_pitch=$13, listen_words=$14, agent_name='Mark', personality='folksy', is_active=true, saas_tier='tier3',
      booking_test_mode=true, phone_estimates_enabled=true, territory_label='Serving', website='https://mrelectric.com/boulder',
      primary_lat=40.015, primary_lng=-105.2705, updated_at=now() WHERE id=$1`,
      [id,'Mr. Electric of Boulder','Perry Wyatt','Mr. Electric','Boulder','CO','80301','America/Denver',
       BLUE,GOLD,'/logos/mr-electric-wordmark.png',ME_MASTER,pitch,listen]);
    console.log('UPDATED existing mr-electric-boulder id='+id);
  } else {
    const ins = await q(`INSERT INTO franchises
      (slug,dba_name,owner_name,owner_email,phone,website,city,state,zip,timezone,
       labor_rate_hourly,service_fee_flat,credit_card_fee_pct,van_stock_fee_pct,
       work_start_hour,work_end_hour,work_days,is_active,saas_tier,
       primary_color,accent_color,brand_wordmark_url,cartesia_voice_id,agent_name,personality,
       primary_lat,primary_lng,phone_estimates_enabled,territory_label,booking_test_mode,
       business_pitch,brand,listen_words,crm,booking_days_ahead,estimate_fee,
       campaigns_enabled,daily_sms_cap,mark_sells_memberships,mentor_enabled,ridealong_enabled,
       master_pricebook_franchise_id,created_at,updated_at)
      VALUES
      ('mr-electric-boulder','Mr. Electric of Boulder','Perry Wyatt',NULL,'+17205550100','https://mrelectric.com/boulder','Boulder','CO','80301','America/Denver',
       189.00,89.00,0.0300,0.0609,
       8,17,'{1,2,3,4,5}',true,'tier3',
       $1,$2,'/logos/mr-electric-wordmark.png','86e30c1d-714b-4074-a1f2-1cb6b552fb49','Mark','folksy',
       40.015,-105.2705,true,'Serving',true,
       $3,'Mr. Electric',$4,'servicetitan',45,'0',
       false,200,false,true,true,
       $5,now(),now())
      RETURNING id`,[BLUE,GOLD,pitch,listen,ME_MASTER]);
    id = ins.rows[0].id;
    console.log('CREATED mr-electric-boulder id='+id);
  }
  // report
  const f = (await q("SELECT slug,dba_name,owner_name,brand,city,state,brand_wordmark_url,master_pricebook_franchise_id,primary_color,accent_color FROM franchises WHERE id=$1",[id])).rows[0];
  console.log(JSON.stringify(f,null,1));
  const pb = (await q("SELECT count(*)::int n FROM franchise_pricebook WHERE franchise_id=$1",[ME_MASTER])).rows[0].n;
  console.log('pricebook (via master mr-electric-demo): '+pb+' electrical items');
  console.log('dashboard: https://markaioffice.com/f/mr-electric-boulder');
  await pool.end();
  console.log('BOULDER_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
