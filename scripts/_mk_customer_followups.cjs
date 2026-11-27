// _mk_customer_followups.cjs — CUSTMAIL_V1 table: Mark's chase list for stalled customer email threads.
// Droplet/service-role only (never reached by the dashboard anon key) -> RLS enabled, NO policies (Batch-A pattern).
// Idempotent. Run: cd ~/newmark && doppler run -- node _mk_customer_followups.cjs
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async()=>{
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_followups (
      id            bigserial PRIMARY KEY,
      franchise_id  uuid NOT NULL,
      st_customer_id text,
      customer_email text NOT NULL,
      customer_name  text,
      conversation_id text,
      message_id     text,
      reason         text,
      due_at         timestamptz NOT NULL,
      status         text NOT NULL DEFAULT 'pending',
      attempts       int  NOT NULL DEFAULT 0,
      last_error     text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )`);
  // one open follow-up per thread (the handler upserts on this)
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS customer_followups_conv ON customer_followups (franchise_id, conversation_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS customer_followups_due ON customer_followups (status, due_at)`);
  // SECURITY (mark-ai-security): droplet-only table -> RLS on, deny-all to anon; the app (mark_app, BYPASSRLS) is unaffected
  await pool.query(`ALTER TABLE customer_followups ENABLE ROW LEVEL SECURITY`);
  const chk = await pool.query(`SELECT relrowsecurity FROM pg_class WHERE relname='customer_followups'`);
  const cols = (await pool.query(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='customer_followups'`)).rows[0].n;
  console.log('customer_followups: columns='+cols+'  rls='+(chk.rows[0] && chk.rows[0].relrowsecurity));
  await pool.end();
  console.log('CUSTOMER_FOLLOWUPS_DONE');
})().catch(e=>{ console.log('ERR '+e.message); process.exit(1); });
