'use strict';
// _diag_numbers.cjs - READ ONLY. For the slug's on-file Twilio creds, print the RAW status+body of
// the IncomingPhoneNumbers call so we can see why numbers aren't matching. No writes.
// Run: cd ~/newmark && doppler run -- node _diag_numbers.cjs <slug>
process.chdir('/root/newmark');
try { require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' }); } catch (e) {}
const https = require('https');
const { Pool } = require('/root/newmark/node_modules/pg');
const miss = ['DATABASE_URL', 'MARK_CRED_ENC_KEY'].filter(k => !process.env[k]);
if (miss.length) { console.error('MISSING ENV: ' + miss.join(', ')); process.exit(1); }
const SLUG = process.argv[2] || 'the-emerald-coast';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
function getRaw(sid, token, host, path) {
  return new Promise(ok => {
    https.get({ host, path, auth: sid + ':' + token }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => ok({ status: r.statusCode, body: b })); }).on('error', e => ok({ status: 0, body: 'ERR ' + e.message }));
  });
}
(async () => {
  const f = (await pool.query("SELECT id, dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1", [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  console.log('office: ' + f.dba_name);
  console.log('on-file SID  : ' + f.sid);
  console.log('token length : ' + (f.token ? f.token.length : 0) + (f.token ? '  (first4 ' + f.token.slice(0, 4) + '...)' : '  (none)'));

  const rows = (await pool.query('SELECT purpose, phone_number, messaging_service_sid FROM franchise_phone_numbers WHERE franchise_id=$1 ORDER BY purpose', [f.id])).rows;
  console.log('\nfranchise_phone_numbers rows:');
  rows.forEach(r => console.log('  ' + r.purpose + '  ' + r.phone_number + '  ms=' + (r.messaging_service_sid || '-')));

  // 1) who does this token actually authenticate as?
  const who = await getRaw(f.sid, f.token, 'api.twilio.com', '/2010-04-01/Accounts/' + f.sid + '.json');
  console.log('\n[Account fetch] GET /Accounts/' + f.sid + '.json  -> HTTP ' + who.status);
  try { const j = JSON.parse(who.body); console.log('  friendly_name=' + j.friendly_name + '  status=' + j.status + '  owner_sid=' + (j.owner_account_sid || '(none)')); } catch (e) { console.log('  body: ' + who.body.slice(0, 300)); }

  // 2) the actual number inventory for this account
  const inc = await getRaw(f.sid, f.token, 'api.twilio.com', '/2010-04-01/Accounts/' + f.sid + '/IncomingPhoneNumbers.json?PageSize=50');
  console.log('\n[Numbers] GET IncomingPhoneNumbers.json  -> HTTP ' + inc.status);
  try {
    const j = JSON.parse(inc.body);
    const list = j.incoming_phone_numbers || [];
    console.log('  count=' + list.length);
    list.forEach(n => console.log('    ' + n.phone_number + '  "' + (n.friendly_name || '') + '"'));
    if (!list.length && j.message) console.log('  message: ' + j.message);
  } catch (e) { console.log('  body: ' + inc.body.slice(0, 400)); }

  await pool.end();
  console.log('\nDIAG_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
