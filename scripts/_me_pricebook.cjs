// _me_pricebook.cjs — Comprehensive Mr. Electric electrical pricebook into mr-electric-demo (hours-only master).
// Residential + commercial + utility/subcontractor. hours = professional baseline labor hours; price=0
// (each calling franchise computes price from its own rate × hours + fees + SerpAPI materials — NO hardcoded prices).
// estimate_mode: 'quotable' = Mark phone-quotes from hours; 'by_estimate' = Mark routes to a site visit.
// per_unit: hours are per each (outlets, fixtures, cans, detectors) and quantity scales.
// Idempotent: clears prior ME.* rows for this franchise, then reloads. Run: doppler run -- node _me_pricebook.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = (t,p)=>pool.query(t,p);

// item: [name, hours, mode?, perUnit?, desc?]   mode default 'quotable', perUnit default false
const Q='quotable', E='by_estimate';
const GROUPS = [
 { cat:'Panels & Service', code:'PNL', items:[
   ['Panel replacement, 100A (same location)', 6, Q],
   ['Panel replacement, 125A (same location)', 6.5, Q],
   ['Panel replacement, 150A (same location)', 7, Q],
   ['Panel replacement, 200A (same location)', 8, Q],
   ['Service upgrade 100A to 200A, overhead', 10, E],
   ['Service upgrade 100A to 200A, underground', 12, E],
   ['Service upgrade to 320A/400A', 16, E],
   ['Subpanel install, 100A (near main panel)', 5, Q],
   ['Subpanel install with long feeder run', 7, E],
   ['Panel relocation', 10, E],
   ['Meter main combo replacement', 8, E],
   ['Meter base replacement', 4, E],
   ['Main breaker replacement', 2, Q],
   ['Circuit breaker replacement (standard)', 0.75, Q, true],
   ['AFCI breaker install', 1, Q, true],
   ['GFCI breaker install', 1, Q, true],
   ['Tandem/half-size breaker install', 0.75, Q, true],
   ['Whole-home surge protector install', 1.5, Q],
   ['Panel re-label and clean-up', 1, Q],
   ['Panel bus bar / internal repair', 2, E],
   ['Ground rod / grounding electrode install', 2, Q],
   ['Water and gas bonding', 1.5, Q],
   ['Federal Pacific / Zinsco panel replacement', 9, E],
 ]},
 { cat:'Circuits & Wiring', code:'CIR', items:[
   ['New dedicated 15A circuit (short run)', 2, Q],
   ['New dedicated 20A circuit', 2.5, Q],
   ['New 30A circuit (dryer/appliance)', 3, Q],
   ['New 50A circuit (range/welder)', 3.5, Q],
   ['New 240V circuit (general)', 3, Q],
   ['Extend existing circuit', 1.5, Q],
   ['Add circuit for new appliance', 2, Q],
   ['Whole-room rewire', 8, E],
   ['Whole-home rewire (per 1,000 sq ft)', 40, E, true],
   ['Knob-and-tube partial replacement', 12, E],
   ['Knob-and-tube whole-home replacement', 50, E],
   ['Aluminum wiring pigtail/remediation (per device)', 0.5, Q, true],
   ['Aluminum wiring whole-home remediation', 16, E],
   ['Open/dead circuit repair', 2, Q],
   ['Junction box install', 1, Q, true],
   ['Wire new room/addition', 8, E],
   ['Conduit run (exposed, per 25 ft)', 2, Q, true],
 ]},
 { cat:'Outlets & Switches', code:'OUT', items:[
   ['Outlet (receptacle) replacement', 0.5, Q, true],
   ['Outlet (receptacle) add new', 1.25, Q, true],
   ['GFCI outlet install', 0.75, Q, true],
   ['AFCI outlet install', 1, Q, true],
   ['USB / USB-C outlet install', 0.75, Q, true],
   ['20A dedicated outlet install', 1.5, Q, true],
   ['240V outlet (dryer/range)', 2, Q, true],
   ['NEMA 14-50 outlet (EV/welder)', 2.5, Q, true],
   ['Outdoor weatherproof outlet', 1.5, Q, true],
   ['Floor outlet install', 2, Q, true],
   ['Outlet relocation', 1.5, Q, true],
   ['Switch replacement (single-pole)', 0.5, Q, true],
   ['3-way switch install', 1, Q, true],
   ['4-way switch install', 1.5, Q, true],
   ['Dimmer switch install', 0.75, Q, true],
   ['Smart switch / smart dimmer install', 1, Q, true],
   ['Timer switch install', 0.75, Q, true],
   ['Occupancy / motion sensor switch', 1, Q, true],
   ['Add new switch leg', 1.5, Q, true],
 ]},
 { cat:'Lighting', code:'LGT', items:[
   ['Recessed light install, per can (attic access)', 1, Q, true],
   ['Recessed light install, per can (no attic access)', 1.75, Q, true],
   ['Recessed light LED retrofit, per can', 0.5, Q, true],
   ['Light fixture replacement', 0.75, Q, true],
   ['Light fixture install, new location', 1.5, Q, true],
   ['Chandelier install (standard ceiling)', 2, Q, true],
   ['Chandelier install (high/vaulted ceiling)', 4, E, true],
   ['Pendant light install', 1, Q, true],
   ['Track lighting install', 2, Q],
   ['Under-cabinet lighting (per run)', 1.5, Q, true],
   ['Vanity light replacement', 0.75, Q, true],
   ['Closet light install', 1, Q, true],
   ['Exterior wall light', 1, Q, true],
   ['Flood / security light install', 1.25, Q, true],
   ['Motion-sensor light install', 1.25, Q, true],
   ['Landscape lighting (per fixture)', 0.75, Q, true],
   ['Landscape lighting system (transformer + runs)', 6, E],
   ['Pathway lighting install', 4, Q],
   ['LED retrofit, whole home (per fixture)', 0.4, Q, true],
   ['Fluorescent to LED conversion (per fixture)', 0.75, Q, true],
   ['Smart lighting control system', 4, E],
 ]},
 { cat:'Ceiling Fans', code:'FAN', items:[
   ['Ceiling fan replacement (existing)', 1, Q, true],
   ['Ceiling fan install (existing box/wiring)', 1.5, Q, true],
   ['Ceiling fan install (new box/wiring)', 2.5, Q, true],
   ['Ceiling fan with light and remote', 1.75, Q, true],
   ['High / vaulted ceiling fan install', 3, Q, true],
   ['Ceiling fan balancing / repair', 1, Q, true],
 ]},
 { cat:'EV & Charging', code:'EV', items:[
   ['Level 2 EV charger install (panel adequate, near panel)', 3, Q],
   ['Level 2 EV charger install (long run)', 5, Q],
   ['EV charger install with subpanel', 7, E],
   ['EV charger install with service upgrade', 12, E],
   ['NEMA 14-50 outlet for EV', 2.5, Q],
   ['Tesla Wall Connector hardwire', 3.5, Q],
   ['Hardwired EV charger install', 3.5, Q],
   ['EV load management device install', 2, Q],
   ['Dual EV charger install', 6, E],
 ]},
 { cat:'Generators & Backup', code:'GEN', items:[
   ['Generator interlock kit + inlet', 4, Q],
   ['Manual transfer switch (critical circuits)', 6, Q],
   ['Automatic transfer switch install', 8, E],
   ['Whole-home standby generator (electrical)', 16, E],
   ['Generator dedicated circuit', 3, Q],
   ['Portable generator inlet box', 3, Q],
   ['Battery backup / ESS interconnect (residential)', 8, E],
 ]},
 { cat:'Safety & Detectors', code:'SAF', items:[
   ['Smoke detector hardwired (per)', 0.5, Q, true],
   ['Carbon monoxide detector hardwired (per)', 0.5, Q, true],
   ['Combination smoke/CO detector (per)', 0.5, Q, true],
   ['Interconnected detector system (whole home)', 4, E],
   ['GFCI protection add (per location)', 0.75, Q, true],
   ['AFCI protection add (per circuit)', 1, Q, true],
   ['Electrical safety inspection', 2, Q],
   ['Panel / home electrical inspection', 1.5, Q],
   ['Code correction', 2, E],
 ]},
 { cat:'Low Voltage & Smart Home', code:'LV', items:[
   ['Standard doorbell replacement', 0.75, Q],
   ['Video doorbell install', 1.25, Q],
   ['Doorbell transformer install', 1, Q],
   ['Thermostat wiring / add C-wire', 1.5, Q],
   ['Ethernet / Cat6 drop (per)', 1.5, Q, true],
   ['Coax / cable drop (per)', 1, Q, true],
   ['Smart home hub install', 1.5, Q],
   ['Security camera wiring (per camera)', 1.5, Q, true],
   ['Intercom system install', 4, E],
   ['Pool / spa bonding', 3, Q],
   ['Landscape low-voltage transformer', 2, Q],
 ]},
 { cat:'Specialty & Appliance Circuits', code:'APP', items:[
   ['Hot tub / spa circuit (GFCI)', 4, Q],
   ['Pool equipment circuit', 4, Q],
   ['Well pump circuit', 3, Q],
   ['HVAC disconnect / whip', 1.5, Q],
   ['Mini-split circuit', 3, Q],
   ['Garbage disposal circuit', 2, Q],
   ['Dishwasher circuit', 2, Q],
   ['Microwave dedicated circuit', 2, Q],
   ['Sump pump circuit', 2, Q],
   ['Attic fan install', 2.5, Q],
   ['Bathroom exhaust fan replacement', 1.5, Q, true],
   ['Bathroom exhaust fan install (new)', 3, Q, true],
   ['Range hood circuit', 2, Q],
   ['Range / oven circuit', 3, Q],
 ]},
 { cat:'Troubleshooting & Repair', code:'TRB', items:[
   ['Electrical diagnostic / troubleshoot (first hour)', 1, Q],
   ['Electrical diagnostic (each additional hour)', 1, Q, true],
   ['Flickering lights diagnosis', 1.5, Q],
   ['Tripping breaker diagnosis', 1.5, Q],
   ['Dead outlet repair', 1, Q],
   ['Burning smell / hot spot inspection', 2, Q],
   ['Fault location', 2, Q],
   ['Loose connection repair', 1, Q],
 ]},
 { cat:'Commercial - Service & Distribution', code:'CSD', items:[
   ['3-phase service install', 24, E],
   ['Commercial panel 100-225A', 10, E],
   ['Commercial panel 400A', 16, E],
   ['Switchgear install', 40, E],
   ['Dry-type transformer install (small)', 6, E],
   ['Distribution / sub-distribution panel', 10, E],
   ['Sub-metering install', 8, E],
   ['480V service install', 32, E],
   ['Step-down transformer install', 8, E],
   ['Busway / busduct install', 24, E],
 ]},
 { cat:'Commercial - Lighting', code:'CLT', items:[
   ['High-bay LED fixture (per fixture)', 1.5, Q, true],
   ['Troffer / 2x4 retrofit (per fixture)', 0.75, Q, true],
   ['Parking lot pole light (per pole)', 4, E, true],
   ['Wall pack light (per)', 1.5, Q, true],
   ['Exit / emergency light (per)', 1, Q, true],
   ['Lighting controls / occupancy (commercial)', 8, E],
   ['Building exterior lighting', 12, E],
   ['Sign / channel letter hookup', 3, Q],
   ['Warehouse lighting retrofit', 24, E],
 ]},
 { cat:'Commercial - Power & Equipment', code:'CPE', items:[
   ['Motor connection / wiring (per motor)', 3, E, true],
   ['VFD install', 6, E],
   ['Motor control center', 24, E],
   ['Machine / equipment hookup', 6, E],
   ['Rooftop HVAC (RTU) disconnect & wiring', 4, E],
   ['Commercial kitchen equipment hookup', 8, E],
   ['Walk-in cooler / freezer circuit', 4, Q],
   ['Data / server room power', 16, E],
   ['UPS install', 8, E],
 ]},
 { cat:'Commercial - Tenant Improvement', code:'CTI', items:[
   ['TI electrical rough-in', 40, E],
   ['Office build-out electrical', 40, E],
   ['Retail build-out electrical', 40, E],
   ['Restaurant electrical', 60, E],
   ['Workstation whip / circuit (per)', 2, Q, true],
   ['Demising wall power', 8, E],
 ]},
 { cat:'Commercial - Safety & Code', code:'CSC', items:[
   ['Emergency / egress lighting (per)', 1.5, Q, true],
   ['Exit sign (per)', 1, Q, true],
   ['Fire alarm interconnect (low voltage)', 16, E],
   ['Commercial standby generator', 40, E],
   ['Commercial automatic transfer switch', 12, E],
   ['Commercial surge protection', 3, Q],
   ['Arc flash study', 24, E],
   ['Thermal / infrared panel scan', 2, Q],
 ]},
 { cat:'Commercial - Low Voltage Systems', code:'CLV', items:[
   ['Structured cabling (per drop)', 1.5, Q, true],
   ['Access control system', 16, E],
   ['CCTV / security system', 16, E],
   ['PA / intercom system', 12, E],
   ['Network cabling project', 24, E],
 ]},
 { cat:'Utility & Subcontract', code:'UTL', items:[
   ['Overhead service drop connection', 6, E],
   ['Underground service lateral', 12, E],
   ['Meter spot / meter socket install', 4, E],
   ['CT (current transformer) cabinet install', 10, E],
   ['Trenching & conduit for utility (per 100 ft)', 8, E, true],
   ['Transformer pad install', 10, E],
   ['Primary / secondary conductor pull', 16, E],
   ['Street light install (per pole)', 6, E, true],
   ['Street light repair (per)', 3, Q, true],
   ['Area / security lighting (utility)', 8, E],
   ['Public EV charging station (per port)', 12, E, true],
   ['DC fast charger install', 24, E],
   ['Utility pole transfer / attachment', 8, E],
   ['Make-ready electrical work', 12, E],
   ['Joint trench coordination', 8, E],
   ['Grid interconnection (solar / battery)', 16, E],
   ['Battery energy storage interconnect (commercial)', 24, E],
   ['Transformer vault install', 24, E],
   ['Underground utility conversion', 40, E],
   ['Overhead line extension support', 16, E],
   ['Utility coordination / permitting', 4, E],
   ['Networked EVSE commissioning', 4, E],
 ]},
];

(async()=>{
  const fr = await q("SELECT id FROM franchises WHERE slug='mr-electric-demo'");
  if(!fr.rows[0]){ console.log('ERR mr-electric-demo not found'); process.exit(1); }
  const ME = fr.rows[0].id;
  // clean rebuild of our generated rows
  const del = await q("DELETE FROM franchise_pricebook WHERE franchise_id=$1 AND sku_code LIKE 'ME.%'",[ME]);
  console.log('cleared prior ME.* rows: '+del.rowCount);
  let n=0, byCat={};
  for(const g of GROUPS){
    let seq=0;
    for(const it of g.items){
      seq++; n++;
      const [name, hours, mode=Q, perUnit=false] = it;
      const skuId = 90000000 + n;
      const skuCode = 'ME.'+g.code+'.'+String(seq).padStart(4,'0');
      const desc = name + '.';
      await q(`INSERT INTO franchise_pricebook
        (franchise_id, sku_id, sku_code, name, category, description, hours, price, item_type, active, estimate_mode, mode_override, per_unit, hours_override, synced_at, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,0,'service',true,$8,NULL,$9,NULL,now(),now(),now())`,
        [ME, skuId, skuCode, name, g.cat, desc, hours, mode, perUnit]);
      byCat[g.cat]=(byCat[g.cat]||0)+1;
    }
  }
  console.log('\nLoaded '+n+' electrical pricebook items into mr-electric-demo:');
  for(const [c,cnt] of Object.entries(byCat)) console.log('  '+String(cnt).padStart(3)+'  '+c);
  const tot = await q("SELECT count(*)::int n, count(*) FILTER (WHERE estimate_mode='quotable')::int quo, count(*) FILTER (WHERE estimate_mode='by_estimate')::int est, count(*) FILTER (WHERE per_unit)::int pu FROM franchise_pricebook WHERE franchise_id=$1 AND sku_code LIKE 'ME.%'",[ME]);
  const r=tot.rows[0];
  console.log('\nTotals: '+r.n+' items  |  '+r.quo+' quotable  |  '+r.est+' by-estimate  |  '+r.pu+' per-unit  |  0 hardcoded prices (price=0, hours-only)');
  await pool.end();
  console.log('ME_PRICEBOOK_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
