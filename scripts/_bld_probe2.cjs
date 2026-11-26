// _bld_probe2.cjs — Targeted: only the pieces probe1's output truncated.
// Services/FAQs/ServiceArea schema, franchises column list + the demo/boulder values
// for the columns that hold financing/personality/pitch/script, and the full drip wiring
// (steps + templates + autoenroll) needed to clone the 16 Mr. Electric campaigns.
// Read-only. Compact output. Run: doppler run -- node _bld_probe2.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);
const DEMO='a4ff4b38-6647-43da-b373-d44c01db53c2', BLD='87635054-5169-4e43-b140-46ca4ae0cf42', FOL='3f74befb-3db6-41b7-8348-63b7f932e7f1';
const clip=(v,n=140)=>{ let s=(v==null?'':typeof v==='object'?JSON.stringify(v):String(v)); return s.length>n?s.slice(0,n)+'…':s; };
async function has(t){ return (await q(`SELECT to_regclass('public.'||$1) IS NOT NULL ok`,[t])).rows[0].ok; }
async function cols(t){ return (await q(`SELECT column_name,data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t])).rows.map(c=>`${c.column_name}`); }
async function cnt(t,f){ try{ return (await q(`SELECT count(*)::int n FROM ${t} WHERE franchise_id=$1`,[f])).rows[0].n; }catch(e){ return 'ERR'; } }

(async()=>{
  console.log('PROBE2_OK');

  // A) find the real table names for services / faqs / service area
  const named = (await q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'
     AND (table_name LIKE '%service%' OR table_name LIKE '%faq%' OR table_name LIKE '%area%') ORDER BY table_name`)).rows.map(r=>r.table_name);
  console.log('\n[A] service/faq/area tables: '+named.join(', '));

  for(const t of named){
    console.log(`\n--- ${t}  cols: ${(await cols(t)).join(', ')}`);
    console.log(`    count demo=${await cnt(t,DEMO)} boulder=${await cnt(t,BLD)} folsom=${await cnt(t,FOL)}`);
    for(const [lbl,f] of [['demo',DEMO],['folsom',FOL]]){
      try{ const s=await q(`SELECT * FROM ${t} WHERE franchise_id=$1 LIMIT 2`,[f]);
        if(s.rows.length){ s.rows.forEach(r=>console.log(`    ${lbl}: `+Object.entries(r).map(([k,v])=>`${k}=${clip(v,80)}`).join('  '))); break; } }catch(e){}
    }
  }

  // B) franchises column list
  console.log('\n[B] franchises columns:\n'+(await cols('franchises')).join(', '));

  // C) demo vs boulder values for the columns that likely hold pitch/personality/financing/script/services
  const keys=['slug','dba_name','owner_name','brand','business_pitch','personality','agent_name','listen_words',
    'financing_lender','financing_enabled','financing_text','services','service_area','service_zips','about','tagline',
    'greeting','voicemail_text','transfer_number','booking_url','membership_blurb','primary_color','accent_color','brand_wordmark_url'];
  const present=(await cols('franchises'));
  const sel=keys.filter(k=>present.includes(k));
  console.log('\n[C] franchises values (demo vs boulder) for: '+sel.join(', '));
  const dr=(await q(`SELECT ${sel.map(k=>`"${k}"`).join(',')} FROM franchises WHERE id=$1`,[DEMO])).rows[0];
  const br=(await q(`SELECT ${sel.map(k=>`"${k}"`).join(',')} FROM franchises WHERE id=$1`,[BLD])).rows[0];
  for(const k of sel) console.log(`    ${k}:\n       demo   = ${clip(dr[k],160)}\n       boulder= ${clip(br[k],160)}`);

  // D) drip wiring for the 16 demo campaigns
  const camps=(await q(`SELECT id,name,goal FROM drip_campaigns WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
  const ids=camps.map(c=>c.id);
  console.log(`\n[D] demo campaigns: ${ids.length} (ids ${ids[0]}..${ids[ids.length-1]})`);

  console.log('\n[D1] drip_steps cols: '+(await cols('drip_steps')).join(', '));
  const steps=(await q(`SELECT * FROM drip_steps WHERE campaign_id = ANY($1) ORDER BY campaign_id,step_index`,[ids])).rows;
  console.log('    steps for demo campaigns: '+steps.length);
  steps.slice(0,6).forEach(s=>console.log('    step: '+Object.entries(s).map(([k,v])=>`${k}=${clip(v,70)}`).join('  ')));

  console.log('\n[D2] drip_templates cols: '+(await cols('drip_templates')).join(', '));
  const tpl=(await q(`SELECT id,name,channel,subject,length(body) body_len FROM drip_templates WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
  console.log('    templates: '+tpl.length);
  tpl.forEach(t=>console.log(`    tpl #${t.id} [${t.channel}] "${clip(t.name,50)}" subj="${clip(t.subject,50)}" body=${t.body_len}b`));
  // one full template body sample
  const one=(await q(`SELECT body FROM drip_templates WHERE franchise_id=$1 ORDER BY id LIMIT 1`,[DEMO])).rows[0];
  console.log('    tpl[0] body head: '+clip(one.body,400));

  console.log('\n[D3] drip_autoenroll_map cols: '+(await cols('drip_autoenroll_map')).join(', '));
  const ae=(await q(`SELECT * FROM drip_autoenroll_map WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
  console.log('    autoenroll rows: '+ae.length);
  ae.slice(0,4).forEach(r=>console.log('    ae: '+Object.entries(r).map(([k,v])=>`${k}=${clip(v,50)}`).join('  ')));

  // E) how does a campaign link to its template? (steps.template_id vs name-match)
  console.log('\n[E] link check: steps.template_id set? '+(steps.some(s=>s.template_id)?'YES via steps':'NO steps→likely name/goal match'));

  await pool.end();
  console.log('\nPROBE2_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
