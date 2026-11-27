// _wire_custmail.cjs — wire the customer-email handler into New Mark. Two anchored edits, idempotent,
// aborts if an anchor isn't a clean single match (never clobbers). Run in repo root: cd ~/newmark && node _wire_custmail.cjs
const fs = require('fs');

function patch(file, anchor, replacement, alreadyMarker){
  if(!fs.existsSync(file)){ console.log('ERR not found: '+file); process.exit(1); }
  let src = fs.readFileSync(file,'utf8');
  if(src.includes(alreadyMarker)){ console.log('= '+file+' already wired'); return; }
  const n = src.split(anchor).length - 1;
  if(n !== 1){ console.log('ERR '+file+': anchor matched '+n+' times (need exactly 1) - aborting, no change'); process.exit(1); }
  fs.copyFileSync(file, file+'.bak-custmail');
  fs.writeFileSync(file, src.replace(anchor, replacement));
  console.log('PATCHED '+file+' (backup '+file+'.bak-custmail)');
}

// 1) workOrders.cjs — route a residential customer (no open work-order thread) to customerMail
patch('src/workOrders.cjs',
  "  if (!cust.commercial && !thread) return 'not a business account';",
  "  /* CUSTMAIL_V1: a residential customer with no open work-order thread is the customer-email handler's. */\n" +
  "  if (!cust.commercial && !thread) {\n" +
  "    try { return await require('./customerMail.cjs').handle(fr, box, cust, m, deps); }\n" +
  "    catch (e) { L('CUSTMAIL ' + fr.slug + ' not handled: ' + String((e && e.message) || e).slice(0, 200)); return 'custmail_err'; }\n" +
  "  }",
  "customerMail.cjs').handle");

// 2) mark.cjs — start the follow-up chase worker alongside workOrders
patch('src/mark.cjs',
  "require('./workOrders.cjs').start({ sendSms: sendSms, log: log });",
  "require('./workOrders.cjs').start({ sendSms: sendSms, log: log }); if (!process.env.MARK_BENCH) require('./customerMail.cjs').start({ sendSms: sendSms, log: log }); /* CUSTMAIL_V1: residential customer email follow-up chase */",
  "customerMail.cjs').start");

console.log('WIRE_DONE — now: node --check src/customerMail.cjs src/workOrders.cjs src/mark.cjs');
