// _bld_probe3.cjs — financing / business-rules / estimate-rules / phone-script sources.
// Read-only. Run: cd ~/newmark && doppler run -- node _bld_probe3.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q=(t,p)=>pool.query(t,p);
const DEMO='a4ff4b38-6647-43da-b373-d44c01db53c2', BLD='87635054-5169-4e43-b140-46ca4ae0cf42', FOL='3f74befb-3db6-41b7-8348-63b7f932e7f1';
const clip=(v,n=120)=>{let s=(v==null?'':typeof v==='object'?JSON.stringify(v):String(v));return s.length>n?s.slice(0,n)+'…':s;};
async function has(t){return (await q(`SELECT to_regclass('public.'||$1) IS NOT NULL ok`,[t])).rows[0].ok;}
async function cols(t){return (await q(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t])).rows.map(c=>c.column_name);}
async function cnt(t,f){try{return (await q(`SELECT count(*)::int n FROM ${t} WHERE franchise_id=$1`,[f])).rows[0].n;}catch(e){return 'ERR';}}
(async()=>{
  console.log('PROBE3_OK');
  for(const t of ['financing_catalog','franchise_financing_plans','franchise_business_rules','franchise_estimate_rules','franchise_phone_script']){
    const ok=await has(t);
    console.log(`\n=== ${t} exists=${ok}`);
    if(!ok) continue;
    console.log('cols: '+(await cols(t)).join(', '));
    console.log(`counts demo=${await cnt(t,DEMO)} boulder=${await cnt(t,BLD)} folsom=${await cnt(t,FOL)}`);
    for(const [lbl,f] of [['demo',DEMO],['folsom',FOL]]){
      try{const s=await q(`SELECT * FROM ${t} WHERE franchise_id=$1 LIMIT 4`,[f]);
        if(s.rows.length){s.rows.forEach(r=>console.log(`  ${lbl}: `+Object.entries(r).map(([k,v])=>`${k}=${clip(v,70)}`).join('  ')));break;}}catch(e){}
    }
  }
  // master_job_hours: does the electrical brandbook exist there? (pricebook card source)
  try{
    const mk=await q(`SELECT to_regclass('public.master_job_hours') IS NOT NULL ok`);
    if(mk.rows[0].ok){
      const c=await cols('master_job_hours');
      console.log('\n=== master_job_hours cols: '+c.join(', '));
      const brandCol=c.includes('brand')?'brand':null;
      if(brandCol){
        const by=await q(`SELECT brand, count(*)::int n FROM master_job_hours WHERE placeholder=false AND hidden=false AND office_franchise_id IS NULL GROUP BY brand ORDER BY n DESC`);
        console.log('master_job_hours by brand:\n'+by.rows.map(r=>`  ${r.n}  ${r.brand}`).join('\n'));
      }
    } else console.log('\nmaster_job_hours: does not exist');
  }catch(e){console.log('mjh ERR '+e.message);}
  await pool.end();
  console.log('\nPROBE3_DONE');
})().catch(e=>{console.log('ERR '+e.message);process.exit(1);});
