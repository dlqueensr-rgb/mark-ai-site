// _rich_jobtype.cjs — what job type + campaign to set for SW Minneapolis so bookDirect can create jobs.
// Shows the office's current ids, its synced ServiceTitan job types + campaigns, and Folsom's for reference.
// Read-only. Run: cd ~/newmark && doppler run -- node _rich_jobtype.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const SW = 'southwest-minneapolis-southwest-suburbs';
(async()=>{
  async function row(slug){ return (await pool.query(`SELECT id, slug, st_job_type_id, st_campaign_id, st_business_unit_id, st_job_type_by_trade FROM franchises WHERE slug=$1`,[slug])).rows[0]; }
  const sw = await row(SW), fol = await row('folsom');
  console.log('SW Minneapolis: job_type='+sw.st_job_type_id+' campaign='+sw.st_campaign_id+' bu='+sw.st_business_unit_id+' by_trade='+sw.st_job_type_by_trade);
  console.log('Folsom (ref)  : job_type='+fol.st_job_type_id+' campaign='+fol.st_campaign_id+' bu='+fol.st_business_unit_id+' by_trade='+fol.st_job_type_by_trade);

  // the synced options table (stOptions.cjs writes it)
  const t = await pool.query(`SELECT to_regclass('public.franchise_st_options') ok`);
  if(!t.rows[0].ok){ console.log('\nfranchise_st_options table not found - run the ST options sync for this office first.'); await pool.end(); return; }
  const cols = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='franchise_st_options' ORDER BY ordinal_position`)).rows.map(r=>r.column_name);
  console.log('\nfranchise_st_options cols: '+cols.join(', '));
  const idCol = cols.includes('st_id') ? 'st_id' : (cols.includes('option_id') ? 'option_id' : (cols.includes('value') ? 'value' : 'st_id'));
  for(const kind of ['job_type','campaign']){
    const r = await pool.query(`SELECT ${idCol} AS id, name FROM franchise_st_options WHERE franchise_id=$1 AND kind=$2 ORDER BY name`,[sw.id, kind]);
    console.log(`\n=== SW Minneapolis ${kind}s (${r.rows.length}) ===`);
    r.rows.forEach(x=>console.log('  '+x.id+'  '+x.name));
  }
  await pool.end();
  console.log('\nRICH_JOBTYPE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
