'use strict';
// _read_brand.cjs - READ ONLY. For a slug, fetch its registered A2P Brand and print which compliance
// profile (customer_profile_bundle_sid) + legal name/EIN-status it was registered under, so a new
// office's brand can be set up the same way. Run: cd ~/newmark && doppler run -- node _read_brand.cjs <slug>
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
  // find brand sid from the messaging service's A2P campaign
  const svcs = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services?PageSize=50')).services || [];
  let BN = process.argv[3] || null;
  if (!BN) {
    for (const s of svcs) {
      const a2p = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + s.sid + '/Compliance/Usa2p')).compliance || [];
      if (a2p[0] && a2p[0].brand_registration_sid) { BN = a2p[0].brand_registration_sid; break; }
    }
  }
  if (!BN) throw new Error('no brand_registration_sid found for ' + SLUG);
  const b = await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/a2p/BrandRegistrations/' + BN);
  console.log('office: ' + f.dba_name);
  console.log('brand sid                  : ' + b.sid + '   status=' + b.status + '   identity_status=' + b.identity_status);
  console.log('brand_type                 : ' + b.brand_type + '   (low volume? ' + (b.mock || false) + ')');
  console.log('customer_profile_bundle_sid: ' + b.customer_profile_bundle_sid + '   <-- the compliance profile used');
  console.log('a2p_profile_bundle_sid     : ' + b.a2p_profile_bundle_sid);
  await pool.end();
  console.log('\nBRAND_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
