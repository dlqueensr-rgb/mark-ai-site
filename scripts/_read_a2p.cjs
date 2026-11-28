'use strict';
// _read_a2p.cjs - READ ONLY. Dump a slug's registered A2P/10DLC campaign (us_app_to_person) so its
// approved wording can be reused verbatim for a new office. Run: cd ~/newmark && doppler run -- node _read_a2p.cjs <slug>
process.chdir('/root/newmark');
try { require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' }); } catch (e) {}
const https = require('https');
const { Pool } = require('/root/newmark/node_modules/pg');
const miss = ['DATABASE_URL', 'MARK_CRED_ENC_KEY'].filter(k => !process.env[k]);
if (miss.length) { console.error('MISSING ENV: ' + miss.join(', ')); process.exit(1); }
const SLUG = process.argv[2] || 'southwest-minneapolis-southwest-suburbs';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const getJSON = (sid, token, host, path) => new Promise(ok => {
  https.get({ host, path, auth: sid + ':' + token }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { ok({ _raw: b.slice(0, 400) }); } }); }).on('error', e => ok({ _err: e.message }));
});
(async () => {
  const f = (await pool.query("SELECT id, dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1", [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  const mg = (await pool.query("SELECT messaging_service_sid FROM franchise_phone_numbers WHERE franchise_id=$1 AND messaging_service_sid IS NOT NULL LIMIT 1", [f.id])).rows[0];
  if (!mg) throw new Error('no messaging_service_sid on file for ' + SLUG);
  console.log('office: ' + f.dba_name + '   service: ' + mg.messaging_service_sid + '\n');

  const a2p = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + mg.messaging_service_sid + '/Compliance/Usa2p')).compliance || [];
  if (!a2p.length) { console.log('(no us_app_to_person campaign registered on this service yet)'); await pool.end(); console.log('\nA2P_DONE'); return; }
  for (const c of a2p) {
    console.log('=== CAMPAIGN ' + c.sid + '  status=' + c.campaign_status + ' ===');
    console.log('use_case            : ' + c.us_app_to_person_usecase);
    console.log('brand_registration  : ' + c.brand_registration_sid);
    console.log('has_embedded_links  : ' + c.has_embedded_links + '   has_embedded_phone: ' + c.has_embedded_phone);
    console.log('\nDESCRIPTION:\n' + c.description);
    console.log('\nMESSAGE FLOW (opt-in):\n' + c.message_flow);
    console.log('\nSAMPLE MESSAGES:');
    (c.message_samples || []).forEach((m, i) => console.log('  [' + (i + 1) + '] ' + m));
    console.log('\nopt_in_keywords  : ' + JSON.stringify(c.opt_in_keywords) + '\nopt_in_message   : ' + c.opt_in_message);
    console.log('opt_out_keywords : ' + JSON.stringify(c.opt_out_keywords) + '\nopt_out_message  : ' + c.opt_out_message);
    console.log('help_keywords    : ' + JSON.stringify(c.help_keywords) + '\nhelp_message     : ' + c.help_message);
  }
  await pool.end();
  console.log('\nA2P_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
