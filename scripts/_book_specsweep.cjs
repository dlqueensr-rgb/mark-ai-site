// _book_specsweep.cjs — sweep EVERY job name (all brands) through the PATCHED quantityFrom.
// Any name that still parses to a count is a residual spec-number landmine (over-quote risk).
// Read-only; uses the live masterHours.cjs on disk (must be the patched one).
// Run: cd ~/newmark && doppler run -- node _book_specsweep.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const MH = require('./src/masterHours.cjs');

(async()=>{
  if(!/SPECNUM_V1/.test(require('fs').readFileSync('./src/masterHours.cjs','utf8'))){
    console.log('WARN: masterHours.cjs is NOT patched (no SPECNUM_V1) — run the patch first.');
  }
  const rows = (await pool.query(
    "SELECT name, brand, category, per_unit FROM master_job_hours WHERE NOT placeholder AND NOT hidden"
  )).rows;

  let digitNames=0, safe=0;
  const flagged=[];
  for(const r of rows){
    const hasDigit=/\d/.test(r.name);
    if(hasDigit) digitNames++;
    const q = MH.quantityFrom(r.name);
    if(q!==null) flagged.push({ name:r.name, brand:r.brand||'(null)', category:r.category||'', per_unit:r.per_unit, q });
    else if(hasDigit) safe++;
  }

  console.log(`scanned=${rows.length}  names-with-digit=${digitNames}  digit-names-now-safe=${safe}  FLAGGED=${flagged.length}`);
  const byBrand={};
  flagged.forEach(f=>{ (byBrand[f.brand]=byBrand[f.brand]||[]).push(f); });
  for(const [b,list] of Object.entries(byBrand).sort((a,b)=>b[1].length-a[1].length)){
    console.log(`\n=== ${b} (${list.length}) ===`);
    list.sort((a,b)=>b.q-a.q).forEach(f=>console.log(`  qty ${f.q}  ${f.per_unit?'[per_unit] ':''}${f.name}  {${f.category}}`));
  }
  if(!flagged.length) console.log('\nCLEAN — no name parses to a stray count. The book is safe.');
  await pool.end();
  console.log('\nSWEEP_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
