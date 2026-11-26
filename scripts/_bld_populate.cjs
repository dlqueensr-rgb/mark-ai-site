// _bld_populate.cjs — Populate the Mr. Electric of Boulder demo dashboard end-to-end.
// Mirrors the Mr. Electric brand master (mr-electric-demo) for brand-generic sections,
// authors Boulder-specific geography, and clones the 16 drip campaigns (draft/gated).
// Transactional + idempotent. Run: cd ~/newmark && doppler run -- node _bld_populate.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const DEMO   = 'a4ff4b38-6647-43da-b373-d44c01db53c2'; // mr-electric-demo (brand master)
const BLD    = '87635054-5169-4e43-b140-46ca4ae0cf42'; // mr-electric-boulder (Perry)
const MASTER = DEMO;                                    // Boulder's pricebook hours master

const J = v => (v==null ? null : JSON.stringify(v));
const cleanItem = s => String(s||'').replace(/\s*\([^)]*\)\s*$/,'').replace(/\s+/g,' ').trim().slice(0,48);

// Services built from the real pricebook categories, in customer-facing order
const CAT_ORDER = [
  'Panels & Service','Circuits & Wiring','Outlets & Switches','Lighting','Ceiling Fans',
  'EV & Charging','Generators & Backup','Safety & Detectors','Low Voltage & Smart Home',
  'Specialty & Appliance Circuits','Troubleshooting & Repair',
  'Commercial - Service & Distribution','Commercial - Lighting','Commercial - Power & Equipment',
  'Commercial - Tenant Improvement','Commercial - Safety & Code','Commercial - Low Voltage Systems',
  'Utility & Subcontract'
];

const FAQS = [
  ['Are your electricians licensed and insured?',
   'Yes. All of our electrical work is performed by licensed, background-checked electricians, and Mr. Electric is fully insured for your protection.'],
  ['Do you give a price before the work starts?',
   'Yes. You get a clear, flat price up front before any work begins — no surprises and no hourly meter running.'],
  ['Do you offer free estimates?',
   'We provide up-front pricing on most work. For larger projects we schedule an on-site evaluation so your quote is exact before anything starts.'],
  ['Do you offer same-day or emergency service?',
   'We do our best to get to urgent electrical issues quickly. Give us a call and we will find you the soonest available time.'],
  ['Do you install EV chargers?',
   'Yes. We install Level 2 home chargers, including the 240-volt circuit and NEMA 14-50 outlet, and we size everything to your panel.'],
  ['Can you upgrade my electrical panel?',
   'Absolutely. Panel replacements and 100-amp to 200-amp service upgrades are one of our most common jobs, along with subpanels and breaker work.'],
  ['Do you install whole-home generators?',
   'Yes. We install and connect standby generators and transfer switches so your home stays powered during an outage.'],
  ['Do you do commercial electrical work?',
   'Yes. We handle commercial service and distribution, lighting, tenant improvements, code corrections, and low-voltage systems.'],
  ['Do you take on subcontract or utility work?',
   'Yes. We take on utility and subcontract electrical work for larger companies and general contractors.'],
  ['Is your work guaranteed?',
   'Yes. Our electrical work is backed by a workmanship guarantee. If something is not right, we make it right.'],
  ['What areas do you serve?',
   'We serve Boulder and the surrounding Boulder County communities. Give us a call and we will confirm we cover your address.'],
  ['Do you offer financing?',
   'Yes. We offer financing on qualifying projects so you can move forward now and pay over time.'],
  ['What payment methods do you accept?',
   'We accept all major credit cards, checks, and most common payment methods.'],
  ['Do you have a membership plan?',
   'Yes. The Mr. Electric Advantage Plan gives you priority scheduling, a yearly electrical safety inspection, a waived service fee, and a discount on all work.'],
];

const AREA = [
  ['Boulder',          ['80301','80302','80303','80304','80305']],
  ['Gunbarrel',        ['80301']],
  ['Louisville',       ['80027']],
  ['Lafayette',        ['80026']],
  ['Superior',         ['80027']],
  ['Broomfield',       ['80020','80021','80023']],
  ['Longmont',         ['80501','80503','80504']],
  ['Niwot',            ['80503']],
  ['Erie',             ['80516']],
  ['Lyons',            ['80540']],
  ['Nederland',        ['80466']],
  ['Eldorado Springs', ['80025']],
];

const HOURS_DAYS = {
  Monday:   {open:8, close:17, closed:false},
  Tuesday:  {open:8, close:17, closed:false},
  Wednesday:{open:8, close:17, closed:false},
  Thursday: {open:8, close:17, closed:false},
  Friday:   {open:8, close:17, closed:false},
  Saturday: {open:8, close:17, closed:true},
  Sunday:   {open:8, close:17, closed:true},
};
const HOLIDAYS = [{key:'new_years'},{key:'memorial'},{key:'independence'},{key:'labor'},{key:'thanksgiving'},{key:'christmas'}];

const ADVANTAGE_DESC = 'The Mr. Electric Advantage Plan is one hundred twenty nine dollars a year. You get priority scheduling, a yearly whole-home electrical safety inspection, no service fee on your visits, and ten percent off all electrical work.';

(async()=>{
  const c = await pool.connect();
  try{
    await c.query('BEGIN');

    // ---------- SERVICES (18 pricebook categories, items from the master pricebook) ----------
    await c.query('DELETE FROM franchise_services WHERE franchise_id=$1',[BLD]);
    const have = (await c.query(
      `SELECT DISTINCT category FROM franchise_pricebook WHERE franchise_id=$1 AND sku_code LIKE 'ME.%' AND category IS NOT NULL`,[MASTER]
    )).rows.map(r=>r.category);
    const ordered = CAT_ORDER.filter(x=>have.includes(x)).concat(have.filter(x=>!CAT_ORDER.includes(x)));
    let so=10, svcN=0;
    for(const cat of ordered){
      const names = (await c.query(
        `SELECT name FROM franchise_pricebook WHERE franchise_id=$1 AND category=$2 AND active=true AND estimate_mode<>'excluded' ORDER BY sku_code LIMIT 14`,
        [MASTER,cat]
      )).rows.map(r=>cleanItem(r.name)).filter(Boolean);
      const items = [...new Set(names)].slice(0,7);
      if(!items.length) continue;
      await c.query(
        `INSERT INTO franchise_services (franchise_id,category,service_items,enabled,sort_order,created_at,updated_at)
         VALUES ($1,$2,$3,true,$4,now(),now())`,
        [BLD, cat.toUpperCase(), items.join(', '), so]
      );
      so+=10; svcN++;
    }

    // ---------- FAQs (author; idempotent) ----------
    let fso=10, faqN=0;
    for(const [question,answer] of FAQS){
      const r = await c.query(
        `INSERT INTO franchise_faqs (franchise_id,question,answer,enabled,sort_order,created_at,updated_at)
         SELECT $1,$2,$3,true,$4,now(),now()
         WHERE NOT EXISTS (SELECT 1 FROM franchise_faqs WHERE franchise_id=$1 AND lower(question)=lower($2))`,
        [BLD,question,answer,fso]
      );
      fso+=10; faqN+=r.rowCount;
    }

    // ---------- SERVICE AREA (Boulder County) ----------
    await c.query('DELETE FROM franchise_service_area WHERE franchise_id=$1',[BLD]);
    const zipsType = (await c.query(`SELECT data_type FROM information_schema.columns WHERE table_name='franchise_service_area' AND column_name='zips'`)).rows[0].data_type;
    const zipsIsJson = /json/.test(zipsType);
    let aso=0;
    for(const [city,zips] of AREA){
      await c.query(
        `INSERT INTO franchise_service_area (franchise_id,city,zips,sort_order,created_at,updated_at) VALUES ($1,$2,$3,$4,now(),now())`,
        [BLD, city, zipsIsJson ? JSON.stringify(zips) : zips, aso++]
      );
    }

    // ---------- HOURS (America/Denver) ----------
    const hu = await c.query(
      `UPDATE franchise_hours SET timezone=$2, days=$3, holidays=$4, updated_at=now() WHERE franchise_id=$1`,
      [BLD,'America/Denver',J(HOURS_DAYS),J(HOLIDAYS)]
    );
    if(hu.rowCount===0){
      await c.query(
        `INSERT INTO franchise_hours (franchise_id,timezone,days,holidays,updated_at) VALUES ($1,$2,$3,$4,now())`,
        [BLD,'America/Denver',J(HOURS_DAYS),J(HOLIDAYS)]
      );
    }

    // ---------- PRICING (seed the missing authoritative row) ----------
    const pu = await c.query(
      `UPDATE franchise_pricing SET labor_rate=$2,service_fee=$3,van_stock_pct=$4,cc_fee_pct=$5,
        minimum_hours=$6,cc_fee_min_job=$7,onsite_estimate_hours=$8,extra_tech_pct=$9,extra_tech_max_hours=$10,updated_at=now()
       WHERE franchise_id=$1`,
      [BLD,189,89,0.0609,0.03,1,0,1,0.5,4]
    );
    if(pu.rowCount===0){
      await c.query(
        `INSERT INTO franchise_pricing (franchise_id,labor_rate,service_fee,van_stock_pct,cc_fee_pct,
           minimum_hours,cc_fee_min_job,onsite_estimate_hours,extra_tech_pct,extra_tech_max_hours,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())`,
        [BLD,189,89,0.0609,0.03,1,0,1,0.5,4]
      );
    }

    // ---------- MEMBERSHIP (Mr. Electric Advantage Plan) ----------
    await c.query(`DELETE FROM franchise_membership_plans WHERE franchise_id=$1 AND plan_key='advantage'`,[BLD]);
    await c.query(
      `INSERT INTO franchise_membership_plans
        (franchise_id,kind,plan_key,display_name,monthly_rate,annual_rate,discount,st_monthly_type_id,st_annual_type_id,
         hours_per_visit,visits_per_year,frequency,description,sort_order,waive_service_fee,waive_trip_charge,
         discount_min_project,discount_excludes_materials,payments_per_visit,updated_at)
       VALUES ($1,'residential','advantage','Mr. Electric Advantage Plan',NULL,129,10,NULL,NULL,
         NULL,1,'annual',$2,0,true,true,0,false,1,now())`,
      [BLD, ADVANTAGE_DESC]
    );
    await c.query(`UPDATE franchises SET mark_sells_memberships=true, campaigns_enabled=true, updated_at=now() WHERE id=$1`,[BLD]);

    // ---------- DRIP CLONE (16 campaigns + templates + steps + autoenroll; draft/gated) ----------
    await c.query(`DELETE FROM drip_steps WHERE campaign_id IN (SELECT id FROM drip_campaigns WHERE franchise_id=$1)`,[BLD]);
    await c.query(`DELETE FROM drip_autoenroll_map WHERE franchise_id=$1`,[BLD]);
    await c.query(`DELETE FROM drip_campaigns WHERE franchise_id=$1`,[BLD]);
    await c.query(`DELETE FROM drip_templates WHERE franchise_id=$1`,[BLD]);

    const tmap={};
    const dtpl=(await c.query(`SELECT * FROM drip_templates WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
    for(const t of dtpl){
      const r=await c.query(
        `INSERT INTO drip_templates (franchise_id,name,channel,subject,body,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,now(),now()) RETURNING id`,
        [BLD,t.name,t.channel,t.subject,t.body]
      );
      tmap[t.id]=r.rows[0].id;
    }

    const cmap={};
    const dcmp=(await c.query(`SELECT * FROM drip_campaigns WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
    for(const cp of dcmp){
      const cfg = cp.config || {};
      if(cfg.send_window) cfg.send_window.tz='America/Denver';
      const r=await c.query(
        `INSERT INTO drip_campaigns
          (franchise_id,name,goal,segment_id,channels,approval_status,created_by,st_tracking_campaign_id,st_tracking_number,
           config,approved_by,approved_at,created_at,updated_at,status,instructions,attribution_days)
         VALUES ($1,$2,$3,NULL,$4,'draft','mre-boulder-clone',NULL,NULL,$5,NULL,NULL,now(),now(),'draft',$6,$7) RETURNING id`,
        [BLD,cp.name,cp.goal,cp.channels,J(cfg),cp.instructions,cp.attribution_days]
      );
      cmap[cp.id]=r.rows[0].id;
    }

    const dstp=(await c.query(`SELECT * FROM drip_steps WHERE campaign_id = ANY($1) ORDER BY campaign_id,step_index`,[dcmp.map(x=>x.id)])).rows;
    for(const s of dstp){
      await c.query(
        `INSERT INTO drip_steps (campaign_id,step_index,channel,delay_hours,template_id,send_window,branch_on_outcome,created_at,enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),$8)`,
        [cmap[s.campaign_id],s.step_index,s.channel,s.delay_hours,tmap[s.template_id],J(s.send_window),J(s.branch_on_outcome),s.enabled]
      );
    }

    const dae=(await c.query(`SELECT * FROM drip_autoenroll_map WHERE franchise_id=$1 ORDER BY id`,[DEMO])).rows;
    for(const a of dae){
      await c.query(
        `INSERT INTO drip_autoenroll_map
          (franchise_id,segment,campaign_id,months,channel_need,project_label,daily_limit,enabled,notes,created_at,updated_at,
           customer_type,season_start_month,season_end_month,promo_start_date,promo_end_date,days_window,sms_daily_limit,
           reenroll_after_days,promo_holiday,run_start_date,run_end_date,run_dates_set_by,run_dates_set_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,now(),now(),
           $9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [BLD,a.segment,cmap[a.campaign_id],a.months,a.channel_need,a.project_label,a.daily_limit,a.notes,
         a.customer_type,a.season_start_month,a.season_end_month,a.promo_start_date,a.promo_end_date,a.days_window,
         a.sms_daily_limit,a.reenroll_after_days,a.promo_holiday,a.run_start_date,a.run_end_date,a.run_dates_set_by,a.run_dates_set_at]
      );
    }

    await c.query('COMMIT');

    // ---------- VERIFY ----------
    const n = async (t)=> (await pool.query(`SELECT count(*)::int n FROM ${t} WHERE franchise_id=$1`,[BLD])).rows[0].n;
    const steps = (await pool.query(`SELECT count(*)::int n FROM drip_steps WHERE campaign_id IN (SELECT id FROM drip_campaigns WHERE franchise_id=$1)`,[BLD])).rows[0].n;
    const price = (await pool.query(`SELECT labor_rate,service_fee FROM franchise_pricing WHERE franchise_id=$1`,[BLD])).rows[0];
    const flags = (await pool.query(`SELECT mark_sells_memberships,campaigns_enabled,financing_lender,personality FROM franchises WHERE id=$1`,[BLD])).rows[0];
    console.log('BOULDER POPULATED:');
    console.log('  services         =', await n('franchise_services'));
    console.log('  faqs             =', await n('franchise_faqs'));
    console.log('  service_area      =', await n('franchise_service_area'));
    console.log('  hours rows        =', await n('franchise_hours'));
    console.log('  membership_plans  =', await n('franchise_membership_plans'));
    console.log('  pricing           =', JSON.stringify(price));
    console.log('  drip campaigns    =', await n('drip_campaigns'));
    console.log('  drip templates    =', await n('drip_templates'));
    console.log('  drip steps        =', steps);
    console.log('  autoenroll rows   =', await n('drip_autoenroll_map'));
    console.log('  flags             =', JSON.stringify(flags));
    console.log('POPULATE_DONE');
  }catch(e){
    await c.query('ROLLBACK');
    console.log('ERR '+e.message);
    process.exitCode=1;
  }finally{
    c.release();
    await pool.end();
  }
})();
