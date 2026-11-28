'use strict';
// _tom_bizinfo.cjs - READ ONLY. Pull a franchise's business info + service-area cities to fill
// its SMS terms/privacy pages and A2P registration. Run: cd ~/newmark && doppler run -- node _tom_bizinfo.cjs <slug>
process.chdir('/root/newmark');
try { require('/root/newmark/node_modules/dotenv').config({ path: '/root/newmark/.env' }); } catch (e) {}
const { Pool } = require('/root/newmark/node_modules/pg');
if (!process.env.DATABASE_URL) { console.error('MISSING DATABASE_URL'); process.exit(1); }
const SLUG = process.argv[2] || 'the-emerald-coast';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
(async () => {
  const f = (await pool.query(
    "SELECT id, dba_name, owner_name, phone, website, address_line1, address_line2, city, state, zip, license_prefix, license_number, marketing_campaign_phone, timezone FROM franchises WHERE slug=$1", [SLUG])).rows[0];
  if (!f) throw new Error('no franchise ' + SLUG);
  console.log('=== franchises ===');
  Object.entries(f).forEach(([k, v]) => { if (k !== 'id') console.log('  ' + k + ' : ' + (v == null || v === '' ? '(blank)' : v)); });
  const sa = (await pool.query('SELECT city, zips, sort_order FROM franchise_service_area WHERE franchise_id=$1 ORDER BY sort_order', [f.id])).rows;
  console.log('\n=== service area cities (' + sa.length + ') ===');
  sa.forEach(r => console.log('  ' + (r.city || '(blank)') + (r.zips ? '  [' + r.zips + ']' : '')));
  await pool.end();
  console.log('\nBIZINFO_DONE');
})().catch(e => { console.error('STOPPED: ' + (e && e.message ? e.message : '(no message)')); process.exit(1); });
