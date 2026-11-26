// _pd_bare_logo.cjs — point the Precision demo at the bare oval (renders without the white badge).
// Run: cd ~/newmark && doppler run -- node _pd_bare_logo.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async()=>{
  const r = await pool.query(
    "UPDATE franchises SET brand_wordmark_url='/logos/precision-oval-bare.png', updated_at=now() WHERE slug='precision-door-demo' RETURNING slug, brand, brand_wordmark_url"
  );
  console.log(r.rows[0] ? `SET ${r.rows[0].slug} (${r.rows[0].brand}) -> ${r.rows[0].brand_wordmark_url}` : 'NOT FOUND: precision-door-demo');
  await pool.end();
  console.log('PD_BARE_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
