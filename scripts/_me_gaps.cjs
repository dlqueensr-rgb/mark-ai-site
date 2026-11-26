// _me_gaps.cjs — Add 15 missing electrical jobs to the Mr. Electric SHARED brand book
// (master_job_hours, brand='Mr. Electric', source='pricebook'), create the "Heating & De-Icing"
// category, and apply 2 flagged fixes (EMT rate, 200A crew). Transactional + idempotent.
// Affects every Mr. Electric office; today that's only Boulder (demo). Prints old→new for edits.
// Run: cd ~/newmark && doppler run -- node _me_gaps.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const BRAND = 'Mr. Electric';
const VIA = 'gap-audit-2026-11';

// name, category, hours, per_unit, tech_count, phone_default
const ADDS = [
  // --- Heating & De-Icing (new category) ---
  ['Install roof and gutter de-icing (heat-tape) cable and circuit','Heating & De-Icing',4,   false,1,true],
  ['Install snow-melt or heated driveway system',                    'Heating & De-Icing',24,  false,2,false], // by-estimate
  ['Install radiant or heated floor circuit and thermostat',         'Heating & De-Icing',3,   false,1,true],
  ['Install or replace electric baseboard heater',                   'Heating & De-Icing',2.5, true, 1,true],
  ['Install or replace electric wall heater (fan-forced)',           'Heating & De-Icing',2.5, true, 1,true],
  ['Install electric garage or shop heater circuit',                 'Heating & De-Icing',3,   false,1,true],
  ['Install electric fireplace circuit',                             'Heating & De-Icing',2,   false,1,true],
  // --- existing categories ---
  ['Install sauna circuit',                                          'Appliance & Specialty Circuits',3,  false,1,true],
  ['Install pool or spa equipotential bonding',                      'Safety & Code',3,  false,1,true],
  ['Troubleshoot or repair EV charger',                              'Troubleshooting & Repair',1.5,false,1,true],
  ['Generator annual maintenance and load test',                     'Troubleshooting & Repair',2,  false,1,true],
  ['Repair service mast or weatherhead (storm damage)',              'Panels, Service & Distribution',3,false,1,true],
  ['Install recessed outlet and cable for wall-mounted TV',          'Outlets & Receptacles',1.5,true,1,true],
  ['Wire detached shed or outbuilding feed (trenched)',              'Panels, Service & Distribution',6,false,1,true],
  ['Install hot-water recirculation pump circuit',                   'Appliance & Specialty Circuits',2, false,1,true],
];

// name, field, newValue  (edits to existing rows)
const FIXES = [
  ['Conduit run (EMT) by the linear foot','hours',0.06],
  ['Electrical service upgrade 100A to 200A','tech_count',2],
];

(async()=>{
  const c = await pool.connect();
  try{
    await c.query('BEGIN');
    let added=0, skipped=0;
    console.log('=== ADD (brand=Mr. Electric, source=pricebook, shared) ===');
    for(const [name,cat,hrs,pu,tc,phone] of ADDS){
      const ex = await c.query(`SELECT 1 FROM master_job_hours WHERE lower(name)=lower($1) LIMIT 1`,[name]);
      if(ex.rowCount){ skipped++; console.log(`  = SKIP (name already exists): ${name}`); continue; }
      await c.query(
        `INSERT INTO master_job_hours
          (name,category,hours,per_unit,tech_count,phone_default,placeholder,hidden,
           source,review_status,hours_status,office_franchise_id,brand,learned_via,uses,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,false,false,'pricebook','confirmed','book',NULL,$7,$8,0,now(),now())`,
        [name,cat,hrs,pu,tc,phone,BRAND,VIA]
      );
      added++; console.log(`  + ${name}  [${cat}]  ${hrs}h ${pu?'/unit':''} ${tc}tech ${phone?'phone':'by-estimate'}`);
    }

    console.log('\n=== FIX (edits to existing Mr. Electric rows) ===');
    for(const [name,field,val] of FIXES){
      const cur = await c.query(`SELECT id,${field} AS v FROM master_job_hours WHERE name=$1 AND brand=$2`,[name,BRAND]);
      if(!cur.rows.length){ console.log(`  ! NOT FOUND: ${name}`); continue; }
      const old = cur.rows[0].v;
      await c.query(`UPDATE master_job_hours SET ${field}=$1, updated_at=now() WHERE name=$2 AND brand=$3`,[val,name,BRAND]);
      console.log(`  ~ ${name}  ${field}: ${old} -> ${val}`);
    }

    await c.query('COMMIT');

    // verify
    const tot = (await pool.query(`SELECT count(*)::int n FROM master_job_hours WHERE brand=$1 AND office_franchise_id IS NULL AND NOT placeholder`,[BRAND])).rows[0].n;
    const heat = (await pool.query(`SELECT count(*)::int n FROM master_job_hours WHERE brand=$1 AND category='Heating & De-Icing'`,[BRAND])).rows[0].n;
    console.log(`\nADDED=${added} SKIPPED=${skipped}`);
    console.log(`Mr. Electric shared book total now = ${tot}`);
    console.log(`Heating & De-Icing rows = ${heat}`);
    console.log('GAPS_DONE');
  }catch(e){
    await c.query('ROLLBACK');
    console.log('ERR '+e.message);
    process.exitCode=1;
  }finally{
    c.release();
    await pool.end();
  }
})();
