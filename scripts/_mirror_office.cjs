'use strict';
// _mirror_office.cjs - READ ONLY. Dumps a known-good live office's exact Twilio wiring
// (per-number voice/sms webhooks + messaging service inbound config + sender pool) so a new
// office's numbers can be configured to match verbatim. No writes, no changes.
// Run on the droplet: cd ~/newmark && node _mirror_office.cjs
process.chdir('/root/newmark');
require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' });
const https = require('https');
const { Pool } = require('/root/newmark/node_modules/pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

const SLUG = process.argv[2] || 'southwest-minneapolis-southwest-suburbs'; // reference = Richard (live, confirmed)
const t10 = v => String(v || '').replace(/\D/g, '').slice(-10);

function getJSON(sid, token, host, path) {
  return new Promise(ok => {
    https.get({ host, path, auth: sid + ':' + token }, r => {
      let b = ''; r.on('data', c => b += c); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { ok({ _err: b.slice(0, 200) }); } });
    }).on('error', e => ok({ _err: e.message }));
  });
}

(async () => {
  const f = (await pool.query(
    "SELECT id, dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1",
    [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  if (!f.sid || !f.token) throw new Error('Twilio SID/token not on file for ' + SLUG);
  console.log('REFERENCE OFFICE : ' + f.dba_name + '  (' + SLUG + ')');
  console.log('subaccount SID   : ' + f.sid);

  // purpose map from our DB
  const rows = (await pool.query('SELECT purpose, phone_number FROM franchise_phone_numbers WHERE franchise_id=$1', [f.id])).rows;
  const purposeByNum = new Map(rows.map(r => [t10(r.phone_number), r.purpose]));

  // every incoming number in the subaccount
  const inc = (await getJSON(f.sid, f.token, 'api.twilio.com', '/2010-04-01/Accounts/' + f.sid + '/IncomingPhoneNumbers.json?PageSize=50')).incoming_phone_numbers || [];
  console.log('\n=== PER-NUMBER WEBHOOKS (' + inc.length + ') ===');
  inc.forEach(n => {
    console.log('\n  ' + (purposeByNum.get(t10(n.phone_number)) || '(unmapped)') + '   ' + n.phone_number + '   "' + (n.friendly_name || '') + '"');
    console.log('    VOICE  url = ' + (n.voice_url || '(none)') + '   method=' + n.voice_method + '   fallback=' + (n.voice_fallback_url || '(none)'));
    console.log('    SMS    url = ' + (n.sms_url || '(none)') + '   method=' + n.sms_method + '   fallback=' + (n.sms_fallback_url || '(none)'));
    console.log('    statusCallback = ' + (n.status_callback || '(none)'));
  });

  // messaging services + which numbers each carries + inbound routing mode
  const svcs = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services?PageSize=50')).services || [];
  console.log('\n=== MESSAGING SERVICES (' + svcs.length + ') ===');
  for (const s of svcs) {
    const nums = ((await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + s.sid + '/PhoneNumbers?PageSize=50')).phone_numbers || []).map(p => p.phone_number);
    console.log('\n  ' + s.sid + '  "' + s.friendly_name + '"');
    console.log('    use_inbound_webhook_on_number = ' + s.use_inbound_webhook_on_number + '   (true => inbound uses each NUMBER\'s own SMS url above)');
    console.log('    inbound_request_url = ' + (s.inbound_request_url || '(none)') + '   method=' + s.inbound_method);
    console.log('    fallback_url        = ' + (s.fallback_url || '(none)'));
    console.log('    sender pool (' + nums.length + '): ' + nums.join(', '));
  }

  await pool.end();
  console.log('\nMIRROR_DONE');
})().catch(e => { console.error('STOPPED: ' + e.message); process.exit(1); });
