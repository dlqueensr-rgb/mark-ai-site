'use strict';
// _read_profiles.cjs - READ ONLY. List a subaccount's Trust Hub customer (business compliance) profiles,
// and optionally fetch one by SID. Run: cd ~/newmark && doppler run -- node _read_profiles.cjs <slug> [BUxxxx]
process.chdir('/root/newmark');
try { require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' }); } catch (e) {}
const https = require('https');
const { Pool } = require('/root/newmark/node_modules/pg');
const miss = ['DATABASE_URL', 'MARK_CRED_ENC_KEY'].filter(k => !process.env[k]);
if (miss.length) { console.error('MISSING ENV: ' + miss.join(', ')); process.exit(1); }
const SLUG = process.argv[2] || 'the-emerald-coast';
const BU = process.argv[3] || null;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const getJSON = (sid, token, host, path) => new Promise(ok => {
  https.get({ host, path, auth: sid + ':' + token }, r => { let b = ''; r.on('data', c => b += c); r.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { ok({ _raw: b.slice(0, 400) }); } }); }).on('error', e => ok({ _err: e.message }));
});
(async () => {
  const f = (await pool.query("SELECT dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1", [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  console.log('subaccount for: ' + f.dba_name + '  (' + f.sid + ')\n');
  const list = (await getJSON(f.sid, f.token, 'trusthub.twilio.com', '/v1/CustomerProfiles?PageSize=50')).results || [];
  console.log('=== CustomerProfiles visible to this subaccount (' + list.length + ') ===');
  list.forEach(p => console.log('  ' + p.sid + '  "' + p.friendly_name + '"  status=' + p.status));
  if (BU) {
    const p = await getJSON(f.sid, f.token, 'trusthub.twilio.com', '/v1/CustomerProfiles/' + BU);
    console.log('\n=== target ' + BU + ' ===');
    console.log('  friendly_name=' + (p.friendly_name || '(none)') + '  status=' + (p.status || '?') + '  email=' + (p.email || '-'));
    if (p._raw) console.log('  raw: ' + p._raw);
  }
  await pool.end();
  console.log('\nPROFILES_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
