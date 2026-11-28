'use strict';
// _read_bizattrs.cjs - READ ONLY. Dump the business-information attributes (industry, business type,
// registration id type, website, regions) on a slug's A2P brand compliance profile, so a new office
// can be filled field-for-field. Run: cd ~/newmark && doppler run -- node _read_bizattrs.cjs <slug>
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
  const f = (await pool.query("SELECT dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1", [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  // brand -> customer_profile_bundle_sid
  const svcs = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services?PageSize=50')).services || [];
  let BU = null;
  for (const s of svcs) {
    const a2p = (await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + s.sid + '/Compliance/Usa2p')).compliance || [];
    if (a2p[0] && a2p[0].brand_registration_sid) {
      const b = await getJSON(f.sid, f.token, 'messaging.twilio.com', '/v1/a2p/BrandRegistrations/' + a2p[0].brand_registration_sid);
      BU = b.customer_profile_bundle_sid; break;
    }
  }
  if (!BU) throw new Error('no compliance profile found for ' + SLUG);
  console.log('office: ' + f.dba_name + '   compliance profile: ' + BU + '\n');
  const assigns = (await getJSON(f.sid, f.token, 'trusthub.twilio.com', '/v1/CustomerProfiles/' + BU + '/CustomerProfilesEntityAssignments?PageSize=50')).results || [];
  for (const a of assigns) {
    const os = a.object_sid || '';
    if (os.startsWith('IT')) {
      const e = await getJSON(f.sid, f.token, 'trusthub.twilio.com', '/v1/EndUsers/' + os);
      console.log('--- EndUser ' + os + '  type=' + e.type + ' ---');
      Object.entries(e.attributes || {}).forEach(([k, v]) => console.log('   ' + k + ' : ' + (typeof v === 'object' ? JSON.stringify(v) : v)));
    } else {
      console.log('--- (other object) ' + os + ' ---');
    }
  }
  await pool.end();
  console.log('\nBIZATTRS_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
