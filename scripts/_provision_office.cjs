'use strict';
// _provision_office.cjs - configure a franchise's Twilio numbers to match the proven live wiring.
// Mirrors SW Minneapolis exactly: per-number Voice->/voice (POST, no fallback), per-number SMS
// (tech line -> tech-assist/from-sms, everyone else -> sms-inbound), one messaging service with
// use_inbound_webhook_on_number=true holding all numbers, then writes messaging_service_sid back.
// Idempotent. Scoped to ONE slug. Reads creds + purpose->number from the DB (fill the intake page first).
//
// Preview:  cd ~/newmark && doppler run -- node _provision_office.cjs <slug> ["Friendly Label"] --dry
// Apply:    cd ~/newmark && doppler run -- node _provision_office.cjs <slug> ["Friendly Label"]
process.chdir('/root/newmark');
try { require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' }); } catch (e) {}
const https = require('https');
const { Pool } = require('/root/newmark/node_modules/pg');

const VOICE_URL = 'https://newmark.markaiofficehq.com/voice';
const CUST_SMS = 'https://markainotify.com/api/sms-inbound';
const TECH_SMS = 'https://markainotify.com/api/tech-assist/from-sms';
const smsUrlFor = purpose => (purpose === 'tech_assist_inbound' ? TECH_SMS : CUST_SMS);

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const rest = args.filter(a => a !== '--dry');
const SLUG = rest[0];
const LABEL = rest[1] || null;
const miss = ['DATABASE_URL', 'MARK_CRED_ENC_KEY'].filter(k => !process.env[k]);
if (miss.length) { console.error('MISSING ENV: ' + miss.join(', ') + '  -> run under doppler'); process.exit(1); }
if (!SLUG) { console.error('USAGE: node _provision_office.cjs <slug> ["Friendly Label"] [--dry]'); process.exit(1); }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const t10 = v => String(v || '').replace(/\D/g, '').slice(-10);

function req(method, sid, token, host, path, params) {
  return new Promise(ok => {
    const body = params ? new URLSearchParams(params).toString() : '';
    const r = https.request({ method, host, path, auth: sid + ':' + token,
      headers: params ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {} },
      res => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { ok({ status: res.statusCode, json: JSON.parse(b) }); } catch (e) { ok({ status: res.statusCode, json: { _raw: b.slice(0, 300) } }); } }); });
    r.on('error', e => ok({ status: 0, json: { _err: e.message } }));
    if (params) r.write(body); r.end();
  });
}
const get = async (sid, token, host, path) => (await req('GET', sid, token, host, path, null)).json; // return parsed body, not the {status,json} wrapper
const post = (sid, token, host, path, params) => req('POST', sid, token, host, path, params);

(async () => {
  const f = (await pool.query(
    "SELECT id, dba_name, twilio_account_sid AS sid, pgp_sym_decrypt(twilio_auth_token_enc, $2) AS token FROM franchises WHERE slug=$1",
    [SLUG, process.env.MARK_CRED_ENC_KEY])).rows[0];
  if (!f) throw new Error('no franchise with slug ' + SLUG);
  if (!f.sid || !f.token) throw new Error('Twilio SID/token not on file - fill the intake page first');
  const fn = 'Mark AI - ' + (LABEL || f.dba_name);
  console.log((DRY ? '*** DRY RUN (no changes) *** ' : '*** APPLYING *** ') + f.dba_name + '  (' + SLUG + ')');
  console.log('subaccount ' + f.sid + '   messaging service name: "' + fn + '"\n');

  const rows = (await pool.query('SELECT purpose, phone_number FROM franchise_phone_numbers WHERE franchise_id=$1 AND is_active IS NOT FALSE', [f.id])).rows;
  if (!rows.length) throw new Error('no franchise_phone_numbers rows - enter the 4 numbers on the intake page first');

  const inc = (await get(f.sid, f.token, 'api.twilio.com', '/2010-04-01/Accounts/' + f.sid + '/IncomingPhoneNumbers.json?PageSize=50')).incoming_phone_numbers || [];
  const bySid = {};
  const incByNum = new Map(inc.map(n => [t10(n.phone_number), n]));

  // 1) per-number voice + sms webhooks
  console.log('=== NUMBER WEBHOOKS ===');
  for (const row of rows) {
    const n = incByNum.get(t10(row.phone_number));
    if (!n) { console.log('  ! ' + row.purpose + '  ' + row.phone_number + '  NOT FOUND in subaccount - skipped'); continue; }
    bySid[t10(row.phone_number)] = n.sid;
    const want = { VoiceUrl: VOICE_URL, VoiceMethod: 'POST', VoiceFallbackUrl: '', SmsUrl: smsUrlFor(row.purpose), SmsMethod: 'POST', SmsFallbackUrl: '' };
    const same = n.voice_url === want.VoiceUrl && n.sms_url === want.SmsUrl && (n.voice_method === 'POST') && (n.sms_method === 'POST') && !n.voice_fallback_url && !n.sms_fallback_url;
    console.log('  ' + row.purpose + '  ' + n.phone_number);
    console.log('     voice: ' + (n.voice_url || '(none)') + ' -> ' + want.VoiceUrl);
    console.log('     sms  : ' + (n.sms_url || '(none)') + ' -> ' + want.SmsUrl);
    if (same) { console.log('     = already correct'); continue; }
    if (DRY) { console.log('     [dry] would update'); continue; }
    const u = await post(f.sid, f.token, 'api.twilio.com', '/2010-04-01/Accounts/' + f.sid + '/IncomingPhoneNumbers/' + n.sid + '.json', want);
    console.log('     ' + (u.status === 200 ? 'UPDATED' : 'ERR ' + u.status + ' ' + JSON.stringify(u.json)));
  }

  // 2) messaging service (find by friendly name, else create), ensure use_inbound_webhook_on_number=true
  console.log('\n=== MESSAGING SERVICE ===');
  let svcs = (await get(f.sid, f.token, 'messaging.twilio.com', '/v1/Services?PageSize=50')).services || [];
  let ms = svcs.find(s => s.friendly_name === fn);
  if (!ms) {
    console.log('  no service named "' + fn + '"');
    if (DRY) { console.log('  [dry] would CREATE it (UseInboundWebhookOnNumber=true)'); }
    else {
      const c = await post(f.sid, f.token, 'messaging.twilio.com', '/v1/Services', { FriendlyName: fn, UseInboundWebhookOnNumber: 'true' });
      if (c.status >= 200 && c.status < 300) { ms = c.json; console.log('  CREATED ' + ms.sid); }
      else throw new Error('create service failed: ' + c.status + ' ' + JSON.stringify(c.json));
    }
  } else {
    console.log('  found ' + ms.sid + '  use_inbound_webhook_on_number=' + ms.use_inbound_webhook_on_number);
    if (!ms.use_inbound_webhook_on_number && !DRY) {
      const up = await post(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + ms.sid, { UseInboundWebhookOnNumber: 'true' });
      console.log('  set UseInboundWebhookOnNumber=true: ' + (up.status === 200 ? 'OK' : 'ERR ' + up.status));
    } else if (!ms.use_inbound_webhook_on_number) { console.log('  [dry] would set UseInboundWebhookOnNumber=true'); }
  }

  // 3) sender pool: add any missing numbers
  if (ms && ms.sid) {
    const pool_nums = ((await get(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + ms.sid + '/PhoneNumbers?PageSize=50')).phone_numbers || []).map(p => t10(p.phone_number));
    for (const row of rows) {
      const psid = bySid[t10(row.phone_number)];
      if (!psid) continue;
      if (pool_nums.includes(t10(row.phone_number))) { console.log('  pool: ' + row.phone_number + ' already in'); continue; }
      if (DRY) { console.log('  [dry] pool: would add ' + row.phone_number); continue; }
      const a = await post(f.sid, f.token, 'messaging.twilio.com', '/v1/Services/' + ms.sid + '/PhoneNumbers', { PhoneNumberSid: psid });
      console.log('  pool: add ' + row.phone_number + ' -> ' + (a.status >= 200 && a.status < 300 ? 'OK' : 'ERR ' + a.status + ' ' + JSON.stringify(a.json)));
    }
    // 4) write messaging_service_sid back
    if (!DRY) {
      const up = await pool.query('UPDATE franchise_phone_numbers SET messaging_service_sid=$1, updated_at=now() WHERE franchise_id=$2', [ms.sid, f.id]);
      console.log('\n  DB: linked messaging_service_sid=' + ms.sid + ' on ' + up.rowCount + ' row(s)');
    } else {
      console.log('\n  [dry] DB: would set messaging_service_sid on all rows');
    }
  }

  await pool.end();
  console.log('\n' + (DRY ? 'DRY_DONE (re-run without --dry to apply)' : 'PROVISION_DONE'));
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); if (e && e.stack) console.error(e.stack); process.exit(1); });
