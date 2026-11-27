// _mbx_check.cjs — which offices have a connected mailbox, and what Folsom's is.
// Read-only. Run: cd ~/newmark && doppler run -- node _mbx_check.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async()=>{
  const rows = (await pool.query(
    `SELECT f.slug, f.brand, m.email, m.display_name, (m.token_enc IS NOT NULL) AS has_token, m.franchise_id
     FROM office_mailboxes m JOIN franchises f ON f.id=m.franchise_id ORDER BY f.slug`
  )).rows;
  console.log('=== connected office mailboxes ('+rows.length+') ===');
  rows.forEach(r=>console.log(`  ${r.slug}  [${r.brand}]  ${r.email}  "${r.display_name||''}"  token=${r.has_token}`));
  const fol = rows.find(r=>r.slug==='folsom');
  console.log('\nFolsom mailbox: ' + (fol ? `${fol.email} (token=${fol.has_token})` : 'NONE CONNECTED'));
  await pool.end();
  console.log('MBX_CHECK_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
