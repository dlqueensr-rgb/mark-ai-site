// _bld_verify_fix.cjs — prove SPECNUM_V1 fixed the over-quote: EV charger + 3-way switch for Boulder.
// Run: cd ~/newmark && doppler run -- node _bld_verify_fix.cjs
const ET = require('./src/estimate_tools.cjs');
const BLD = '87635054-5169-4e43-b140-46ca4ae0cf42';
const money = n => '$'+Math.round(Number(n)||0).toLocaleString('en-US');
const CASES = [
  { description:'Install Level 2 EV charger (near panel, capacity available)', kind:'new', count:1, wasHours:'6h (qty 2 — WRONG)', wasPrice:'$1,297' },
  { description:'Convert to 3-way switch', kind:'replace', count:1, wasHours:'would read qty 3', wasPrice:'~3x' },
];
(async()=>{
  for(const job of CASES){
    try{
      const o = await ET.priceJob(BLD, [{ description:job.description, kind:job.kind, count:job.count }], {});
      if(!o || !o.ok){ console.log(`✗ "${job.description}" -> ${(o&&o.error)||'no result'}`); continue; }
      const l=(o.lines&&o.lines[0])||{};
      console.log(`"${job.description}"`);
      console.log(`   before: ${job.wasHours}  (${job.wasPrice})`);
      console.log(`   now:    ${l.count} x ${l.hours}h x ${l.tech_count} tech = ${l.crewedHours}h  ->  ${o.card&&o.card!==o.cash?money(o.cash)+' cash / '+money(o.card)+' card':money(o.cash)}`);
    }catch(e){ console.log(`✗ "${job.description}" threw: ${e.message}`); }
  }
  console.log('VERIFY_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
