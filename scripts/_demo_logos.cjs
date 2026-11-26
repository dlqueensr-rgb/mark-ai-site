// _demo_logos.cjs — put each brand logo on its demo-franchise dashboard header.
// Points brand_wordmark_url at the local dashboard assets just deployed. Idempotent.
// Run: cd ~/newmark && doppler run -- node _demo_logos.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const MAP = {
  'precision-door-demo': '/logos/precision-wordmark.png',
  'mr-electric-demo':    '/logos/mr-electric-wordmark.png',
  'mr-rooter-demo':      '/logos/mr-rooter-wordmark.png',
  'aire-serv-demo':      '/logos/aire-serv-wordmark.png',
};
(async()=>{
  for(const [slug,url] of Object.entries(MAP)){
    const r = await pool.query(
      "UPDATE franchises SET brand_wordmark_url=$2, updated_at=now() WHERE slug=$1 RETURNING slug, brand, brand_wordmark_url",
      [slug, url]
    );
    console.log(r.rows[0] ? `SET ${r.rows[0].slug}  (${r.rows[0].brand})  -> ${r.rows[0].brand_wordmark_url}` : `NOT FOUND: ${slug}`);
  }
  await pool.end();
  console.log('DEMO_LOGOS_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
