// _me_ehours.cjs — Dump the LIVE Mr. Electric brand hours book (master_job_hours)
// so we can diff coverage + sanity-check hours against the comprehensive 213 catalog.
// Read-only. Run: cd ~/newmark && doppler run -- node _me_ehours.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q=(t,p)=>pool.query(t,p);
(async()=>{
  console.log('EHOURS_OK');
  // scope exactly as the estimator sees a Mr. Electric office's shared book
  const where = "brand='Mr. Electric' AND office_franchise_id IS NULL AND NOT placeholder";
  const all = (await q(`SELECT id,name,category,hours,per_unit,tech_count,source,review_status,hours_status,uses
                        FROM master_job_hours WHERE ${where} ORDER BY category NULLS FIRST, lower(name)`)).rows;
  console.log('total Mr. Electric shared rows: '+all.length);

  const by=(k)=>{const m={};all.forEach(r=>{const v=r[k]==null?'(null)':r[k];m[v]=(m[v]||0)+1;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([x,n])=>`${n} ${x}`).join('  |  ');};
  console.log('by source:        '+by('source'));
  console.log('by review_status: '+by('review_status'));
  console.log('by hours_status:  '+by('hours_status'));
  console.log('by per_unit:      '+by('per_unit'));

  // category coverage
  const cats={};
  all.forEach(r=>{const c=r.category||'(uncategorized)';cats[c]=(cats[c]||0)+1;});
  console.log('\n=== categories in the live book ('+Object.keys(cats).length+') ===');
  Object.entries(cats).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([c,n])=>console.log(`  ${n}\t${c}`));

  // full item list (compact, pipe-delimited) for diffing
  console.log('\n=== ITEMS name | category | hours | per_unit | techs | review ===');
  all.forEach(r=>console.log([r.name, r.category||'', r.hours, r.per_unit?'U':'-', r.tech_count, r.review_status||''].join(' | ')));

  await pool.end();
  console.log('EHOURS_DONE');
})().catch(e=>{console.log('ERR '+e.message);process.exit(1);});
