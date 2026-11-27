'use strict';
/* customerMail.cjs — CUSTMAIL_V1 (David, Nov 27 2026 - "i need to make sure that mark is following up on customers in my email"):
   a KNOWN residential customer emails the office mailbox (a reply to an appointment reminder, a question like "do you do insulation?",
   a reschedule or cancel). workOrders.cjs's one sweep already reads every new Inbox message and hands the commercial ones to its own
   desk, website leads to emailLeads.cjs and intro replies to mailboxReplies.cjs; a residential customer used to be left alone. This is
   that customer's handler, built on the pieces that already exist - nothing new invented:
     - whoIs already matched the sender to this office's ServiceTitan customer (passed in as `cust`)
     - estimate_tools.loadAppointmentsForCustomer   their upcoming visits
     - estimate_tools.findRescheduleOptions / rescheduleVisit / cancelVisit   the real, safety-gated ServiceTitan moves (fail-closed
       conflict guard; writes only when the office is live, else Mark says the office will confirm and the owner is texted)
     - emailLeads.officeFacts            the office's own services, FAQs, policies, hours, service area (the dashboard)
     - officeMailbox.reply               the reply, in Mark's own words, in the same thread, from the office's own mailbox
   David's calls: (1) Mark REPLIES automatically, (2) Mark MOVES reschedules/cancels in ServiceTitan, (3) Mark CHASES a stalled thread
   (Rick: "I'll check back next week") so it does not fall through - customer_followups + followSweep.
   Claude drives (Messages API with tools), the same loop ownerChat.cjs uses. Every message is acted on once (work_order_messages). */
const ET = function () { return require('./estimate_tools.cjs'); };
const OM = function () { return require('./officeMailbox.cjs'); };
let _pool = null;
function pool() { if (!_pool) _pool = require('./dbPool.cjs').pool(); return _pool; }
const one = function (s, n) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n || 300); };
const d10 = function (v) { return String(v || '').replace(/\D/g, '').slice(-10); };
const plain = function (s) { return String(s || '').replace(/\*\*/g, '').replace(/^[ \t]*[-*]\s+/gm, '').trim(); };

async function ownerText(fr, text, deps) {
  try {
    let cell = fr.owner_cell_phone || null;
    if (!cell) { try { cell = await ET().ownerCell(fr.id); } catch (_) {} }
    if (cell && typeof deps.sendSms === 'function') await deps.sendSms(fr, cell, text);
  } catch (e) { (deps.log || console.log)('CUSTMAIL ownerText failed: ' + (e && e.message)); }
}

/* the customer's upcoming visits, grouped into numbered visits (a crew on one visit is several jobs) - same shape ownerChat uses */
async function loadVisits(fr, customerId, deps) {
  const ctxA = await ET().loadAppointmentsForCustomer(fr.id, customerId);
  if (!ctxA || !ctxA.ok || !ctxA.found) return { ok: !!(ctxA && ctxA.ok), groups: [], visits: [] };
  const groups = [], visits = [];
  ctxA.jobs.forEach(function (j) {
    const k = [j.service, j.day, j.window].join('|');
    let i = visits.findIndex(function (v) { return v._k === k; });
    if (i === -1) { visits.push({ _k: k, service: j.service, day: j.day, window: j.window, techs: [] }); groups.push([]); i = visits.length - 1; }
    groups[i].push(j);
    if (j.tech_first_name && visits[i].techs.indexOf(j.tech_first_name) === -1) visits[i].techs.push(j.tech_first_name);
  });
  return { ok: true, groups: groups, visits: visits };
}

/* ---------- tools (Claude calls these; the office's own actions happen inside) ---------- */
const TOOLS = [
  { name: 'move_appointment', description: 'Move this customer\'s visit in ServiceTitan because they asked to. First action "options" (optionally with day YYYY-MM-DD when they named a day) to get open times, then action "book" with the option_id that matches what they asked for. visit_no is from the visits listed in your instructions.', input_schema: { type: 'object', properties: { visit_no: { type: 'number' }, action: { type: 'string', enum: ['options', 'book'] }, day: { type: 'string', description: 'YYYY-MM-DD, only when they named a day' }, option_id: { type: 'string', description: 'for book - the option_id from options' } }, required: ['visit_no', 'action'] } },
  { name: 'cancel_appointment', description: 'Cancel this customer\'s visit in ServiceTitan because they asked to cancel. visit_no is from the visits listed in your instructions.', input_schema: { type: 'object', properties: { visit_no: { type: 'number' } }, required: ['visit_no'] } },
  { name: 'schedule_followup', description: 'Set a reminder to circle back to THIS customer by email later, so an open thread does not fall through - use it when they said they will get back to you (a reschedule date, a decision) or you are waiting on them. days = how many days out (if they said "next week" use 7). about = what you are waiting on, in a few words.', input_schema: { type: 'object', properties: { days: { type: 'number' }, about: { type: 'string' } }, required: ['days', 'about'] } },
  { name: 'flag_owner', description: 'Hand this to the owner because it is not something you should answer or do on your own (a complaint, a price dispute, something the office facts do not cover, anything you are unsure of). why = one short line for the owner. After this, your reply tells the customer the office will get right back to them.', input_schema: { type: 'object', properties: { why: { type: 'string' } }, required: ['why'] } },
];

async function runTool(name, inp, ctx) {
  const fid = ctx.fr.id;
  if (name === 'move_appointment' || name === 'cancel_appointment') {
    const jobs = ctx.groups[(parseInt(inp.visit_no, 10) || 1) - 1];
    if (!jobs || !jobs.length) return { ok: false, note: 'That visit number is not on their list - look at the visits in your instructions.' };
    if (name === 'cancel_appointment') {
      const r = await ET().cancelVisit(fid, jobs);
      ctx.acted = true;
      return { ok: !!(r && r.written), cancelled: !!(r && r.written), note: (r && r.note) || ((r && r.written) ? 'Cancelled in ServiceTitan - confirm it to them warmly in a sentence.' : 'Could not cancel it automatically - tell them the office will confirm the cancellation shortly.'), owner_told: !(r && r.written) ? (ctx._flagOwner(r && r.ownerText), true) : false };
    }
    if (jobs.length > 1) { ctx._flagOwner('A crew visit needs to be moved in ServiceTitan directly for ' + (ctx.cust.name || 'a customer') + '.'); return { ok: false, note: 'That visit has a crew on it - say the office will set the new time and reach out; it has been flagged to the office.' }; }
    if (inp.action === 'options') {
      const r = await ET().findRescheduleOptions(fid, jobs[0], { day: inp.day });
      ctx.opts = {}; (r.options || []).forEach(function (o) { ctx.opts[o.option_id] = o; });
      return { ok: true, options: (r.options || []).map(function (o) { return { option_id: o.option_id, day: o.day, arrival_window: o.arrival_window, tech: o.tech_first_name }; }), note: (r.options || []).length ? 'Nothing is moved yet. Book the one that fits what they asked for; if they did not name a workable time, offer two or three of these and ask which works.' : 'No open times that way - offer to find another day, or say the office will reach out with options.' };
    }
    const opt = (ctx.opts || {})[String(inp.option_id || '').trim()];
    if (!opt) return { ok: false, note: 'Get options first, then book one of their option_ids.' };
    const r = await ET().rescheduleVisit(fid, jobs[0], opt);
    ctx.acted = true;
    if (!(r && r.written)) ctx._flagOwner(r && r.ownerText);
    return { ok: !!(r && r.written), moved: !!(r && r.written), to: opt.day + ' ' + opt.arrival_window, tech: opt.tech_first_name, note: (r && r.note) || ((r && r.written) ? 'Moved in ServiceTitan - confirm the new day and arrival window to them.' : 'Could not move it automatically - tell them the office will confirm the new time shortly.') };
  }
  if (name === 'schedule_followup') {
    const days = Math.max(1, Math.min(60, parseInt(inp.days, 10) || 7));
    const due = new Date(Date.now() + days * 86400000).toISOString();
    try {
      await pool().query(
        "INSERT INTO customer_followups (franchise_id, st_customer_id, customer_email, customer_name, conversation_id, message_id, reason, due_at, status, attempts) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',0) " +
        "ON CONFLICT (franchise_id, conversation_id) DO UPDATE SET reason = EXCLUDED.reason, due_at = EXCLUDED.due_at, status = 'pending', updated_at = now()",
        [fid, String(ctx.cust.customerId || ctx.cust.id || ''), ctx.customerEmail, ctx.cust.name || null, ctx.conversationId || ctx.messageId, ctx.messageId, one(inp.about, 300), due]
      );
      ctx.acted = true;
      return { ok: true, note: 'Noted - you will circle back to them in about ' + days + ' day' + (days === 1 ? '' : 's') + '. Reply now acknowledging what they said; do not promise a specific time you have not set.' };
    } catch (e) { (ctx.deps.log || console.log)('CUSTMAIL followup not saved: ' + (e && e.message)); return { ok: false, note: 'Could not set the reminder - still reply and acknowledge; the office has it in the mailbox.' }; }
  }
  if (name === 'flag_owner') { ctx._flagOwner('Mark: ' + (ctx.cust.name || ctx.customerEmail) + ' emailed - ' + one(inp.why, 200) + '. It is in ' + ctx.boxEmail + '.'); return { ok: true, note: 'The owner has it. Reply warmly that you are getting the right person on it and the office will get back to them shortly.' }; }
  return { ok: false, note: 'unknown tool' };
}

/* ---------- the conversation ---------- */
function systemPrompt(fr, cust, visits, facts) {
  const vlist = visits.length ? visits.map(function (v, i) { return '  ' + (i + 1) + '. ' + v.service + ' - ' + v.day + ' ' + v.window + (v.techs.length ? (' with ' + v.techs.join(' & ')) : ''); }).join('\n') : '  (none on the schedule)';
  const f = facts || {};
  const factLines = [
    f.services ? ('Services: ' + f.services) : '',
    f.specialties ? ('Specialties: ' + f.specialties) : '',
    f.service_area ? ('Service area: ' + f.service_area) : '',
    f.hours ? ('Hours: ' + f.hours) : '',
    (f.office_policies && f.office_policies.length) ? ('Policies:\n' + f.office_policies.map(function (p) { return '  - ' + p; }).join('\n')) : '',
    f.faqs ? ('FAQs:\n' + f.faqs) : '',
    f.why_customers_choose_us ? ('Why customers choose us: ' + f.why_customers_choose_us) : ''
  ].filter(Boolean).join('\n');
  return [
    'You are Mark, the office manager at ' + (fr.brand || 'the office') + (fr.city ? (' (' + fr.city + (fr.state ? (', ' + fr.state) : '') + ')') : '') + '. A CUSTOMER has emailed the office and you are answering them from the office\'s mailbox. Write the reply yourself, in a warm, plain, human voice - a few short sentences, no lists or formatting marks, no subject line. You are a real office manager, not a bot: do not say you are an AI or an assistant.',
    'This customer is ' + (cust.name || 'a customer on file') + '. Their upcoming visits:\n' + vlist,
    'Handle it the way a great office manager would, and DO it with your tools - do not just say you will:',
    '- A QUESTION (do you do X, what are your hours, where do you serve, how does something work): answer it straight from the office facts below. If the facts clearly cover it, answer plainly. If they do NOT cover it, do not guess - flag_owner and tell them the office will get right back to them.',
    '- A RESCHEDULE: use move_appointment. Get options (name their day if they gave one), then book the one that fits. If they did not give a workable time (like "I\'ll send a date next week"), do NOT move anything - acknowledge, and use schedule_followup so you circle back and it does not fall through.',
    '- A CANCEL: use cancel_appointment, then confirm it kindly.',
    '- A THANK-YOU or a confirmation that needs nothing: reply briefly and warmly, or if truly nothing is needed, keep it to one friendly line.',
    '- A COMPLAINT, a price or billing dispute, anything you are unsure of or the facts do not cover: flag_owner, and tell them the office will get right back to them. Never argue, never quote a price you were not given.',
    'When a tool says it was done (moved/cancelled in ServiceTitan), confirm it as done. When a tool says it could NOT be done automatically, never say it is done - say the office will confirm shortly (the owner has already been told). Put any day and time in plain words ("Tuesday, December 2nd, between 8 and 10 AM").',
    'Today is ' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: fr.timezone || 'America/Los_Angeles' }) + '.',
    factLines ? ('OFFICE FACTS (the only source for what the office does - never invent beyond these):\n' + factLines) : 'OFFICE FACTS: (none set on the dashboard - answer only what you plainly know, and flag_owner for anything specific.)'
  ].join('\n\n');
}

async function askClaude(system, messages, deps, tools) {
  if (deps.claude) return deps.claude({ system: system, messages: messages, tools: tools });   /* tests */
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error('no ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.BRAIN_MODEL || 'claude-haiku-4-5', max_tokens: 900, temperature: 0.3, system: system, tools: tools, messages: messages }), signal: AbortSignal.timeout(45000) });
  const j = await r.json();
  if (!r.ok) throw new Error('claude ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j;
}

const MAX_ROUNDS = 6;
async function think(ctx, userText, deps) {
  const sys = systemPrompt(ctx.fr, ctx.cust, ctx.visits, ctx.facts);
  const work = [{ role: 'user', content: userText }];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const j = await askClaude(sys, work, deps, TOOLS);
    const content = (j && j.content) || [];
    work.push({ role: 'assistant', content: content });
    const uses = content.filter(function (c) { return c && c.type === 'tool_use'; });
    if (!uses.length || j.stop_reason !== 'tool_use') return content.filter(function (c) { return c && c.type === 'text'; }).map(function (c) { return c.text; }).join(' ');
    const results = [];
    for (const u of uses) {
      let out; try { out = await runTool(u.name, u.input, ctx); } catch (e) { (deps.log || console.log)('CUSTMAIL tool ' + u.name + ' err ' + (e && e.message)); out = { ok: false, note: 'That did not go through - tell them the office will take care of it and get back to them.' }; }
      (deps.log || console.log)('CUSTMAIL ' + ctx.fr.slug + ' tool ' + u.name + ' -> ' + JSON.stringify(out).slice(0, 160));
      results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) });
    }
    work.push({ role: 'user', content: results });
  }
  return '';
}

/* ---------- the sweep's entry: one residential customer email. Returns a short status string. ---------- */
async function handle(fr, box, cust, m, deps) {
  deps = Object.assign({ log: console.log }, deps || {});
  const fid = fr.id, L = deps.log;
  const from = String(m.fromEmail || '').toLowerCase();
  /* act on each message once - reuse the sweep's dedup table */
  const claimed = (await pool().query(
    "INSERT INTO work_order_messages (franchise_id, message_id, from_email, kind, summary, received_at) VALUES ($1,$2,$3,'customer_mail',$4,$5) ON CONFLICT DO NOTHING RETURNING message_id",
    [fid, m.id, from, one(m.subject, 200), m.receivedAt]
  )).rows.length;
  if (!claimed) return 'seen';
  /* they wrote back in a thread we were chasing - stop chasing it */
  try { await clearFollowup(fid, m.conversationId); } catch (_) {}

  let visitsR = { groups: [], visits: [] };
  try { visitsR = await loadVisits(fr, cust.customerId || cust.id, deps); } catch (e) { L('CUSTMAIL ' + fr.slug + ' visits load failed: ' + (e && e.message)); }
  let facts = {};
  try { facts = await require('./emailLeads.cjs')._t.officeFacts(fr, m.subject || '', deps); } catch (e) { L('CUSTMAIL ' + fr.slug + ' facts load failed: ' + (e && e.message)); }

  const ownerNotes = [];
  const ctx = {
    fr: fr, deps: deps, cust: cust, customerEmail: from, boxEmail: box.email, messageId: m.id, conversationId: m.conversationId || null,
    groups: visitsR.groups, visits: visitsR.visits, facts: facts, opts: {}, acted: false,
    _flagOwner: function (t) { if (t) ownerNotes.push(String(t)); }
  };

  const userText = 'Subject: ' + one(m.subject, 200) + '\n\nThey wrote:\n"""\n' + String(m.text || '').slice(0, 8000) + '\n"""';
  let text = '';
  try { text = plain(await think(ctx, userText, deps)); } catch (e) { L('CUSTMAIL ' + fr.slug + ' think failed: ' + (e && e.message)); }

  /* one owner heads-up carrying anything the tools flagged */
  if (ownerNotes.length) await ownerText(fr, ownerNotes.join(' '), deps);

  if (text) {
    const r = await OM().reply(fid, m.id, text, L);
    if (!r || r.ok === false) { L('CUSTMAIL ' + fr.slug + ' reply NOT sent to ' + from + ': ' + ((r && r.error) || 'error')); await ownerText(fr, 'Mark: ' + (cust.name || from) + ' emailed and I wrote a reply but it did not send - please check ' + box.email + '.', deps); return 'reply_failed'; }
    L('CUSTMAIL ' + fr.slug + ' replied to ' + (cust.name || from) + (ctx.acted ? ' (acted)' : '') + ': "' + text.slice(0, 120) + '"');
    try { await pool().query("UPDATE work_order_messages SET summary = $4 WHERE franchise_id = $1 AND message_id = $2 AND kind = $3", [fid, m.id, 'customer_mail', one((ctx.acted ? '[acted] ' : '') + m.subject, 200)]); } catch (_) {}
    return ctx.acted ? 'customer handled (acted)' : 'customer answered';
  }
  L('CUSTMAIL ' + fr.slug + ' nothing to send for message from ' + from);
  return 'customer seen';
}

/* ---------- CHASE: circle back on a stalled thread (Rick: "I'll check back next week") ---------- */
async function followSweep(deps) {
  deps = Object.assign({ log: console.log }, deps || {});
  const L = deps.log;
  let due = [];
  try {
    due = (await pool().query(
      "UPDATE customer_followups SET status = 'working', updated_at = now() WHERE id IN (" +
      "SELECT id FROM customer_followups WHERE status = 'pending' AND due_at <= now() ORDER BY due_at LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *"
    )).rows;
  } catch (e) { if (!/does not exist/i.test(String(e && e.message))) L('CUSTMAIL followSweep err ' + (e && e.message)); return; }
  for (const row of due) {
    let fr = null;
    try { fr = await require('./franchise.cjs').resolveFranchise(null, row.franchise_id); } catch (_) { fr = null; }
    if (!fr) { await _followDone(row.id, 'failed', 'no franchise'); continue; }
    const box = await OM().connected(fr.id);
    if (!box) { await _followDone(row.id, 'failed', 'mailbox not connected'); continue; }
    const attempts = (row.attempts || 0) + 1;
    /* after 2 nudges with no reply, stop and hand it to the owner */
    if (attempts > 2) { await _followDone(row.id, 'given_up', null); await ownerText(fr, 'Mark: I circled back twice with ' + (row.customer_name || row.customer_email) + ' about ' + one(row.reason, 120) + ' and have not heard back - you may want to reach out. It is in ' + box.email + '.', deps); continue; }
    let facts = {}; try { facts = await require('./emailLeads.cjs')._t.officeFacts(fr, row.reason || '', deps); } catch (_) {}
    let visitsR = { visits: [] }; try { visitsR = await loadVisits(fr, row.st_customer_id, deps); } catch (_) {}
    const ctx = { fr: fr, deps: deps, cust: { name: row.customer_name, customerId: row.st_customer_id }, customerEmail: row.customer_email, boxEmail: box.email, messageId: row.message_id, conversationId: row.conversation_id, groups: [], visits: visitsR.visits, facts: facts, opts: {}, _flagOwner: function () {} };
    const nudge = 'This is a follow-up you are sending because you told this customer you would circle back about: ' + one(row.reason, 200) + '. Write a short, warm check-in email that moves it forward (ask the one thing you need from them - a day that works, their decision). Do not re-introduce yourself. No subject line.';
    let text = '';
    try { text = plain(await think(ctx, nudge, deps)); } catch (e) { L('CUSTMAIL chase think failed: ' + (e && e.message)); }
    if (!text) { await _followDone(row.id, 'pending', null, attempts, new Date(Date.now() + 2 * 86400000).toISOString()); continue; }
    const r = row.conversation_id ? await OM().reply(fr.id, row.message_id, text, L).catch(function () { return { ok: false }; }) : { ok: false };
    const sent = r && r.ok !== false ? r : await OM().send(fr.id, { to: row.customer_email, subject: 'Following up', text: text }, L);
    if (sent && sent.ok !== false) { L('CUSTMAIL ' + fr.slug + ' chased ' + (row.customer_name || row.customer_email) + ' (attempt ' + attempts + ')'); await _followDone(row.id, 'pending', null, attempts, new Date(Date.now() + 5 * 86400000).toISOString()); }
    else { await _followDone(row.id, 'failed', (sent && sent.error) || 'send failed'); }
  }
}
async function _followDone(id, status, err, attempts, dueAt) {
  try {
    if (status === 'pending') await pool().query("UPDATE customer_followups SET status='pending', attempts=$2, due_at=$3, last_error=$4, updated_at=now() WHERE id=$1", [id, attempts || 1, dueAt, err || null]);
    else await pool().query("UPDATE customer_followups SET status=$2, last_error=$3, updated_at=now() WHERE id=$1", [id, status, err || null]);
  } catch (_) {}
}
/* when a customer writes back in a thread we were chasing, stop chasing it */
async function clearFollowup(fid, conversationId) {
  if (!conversationId) return;
  try { await pool().query("UPDATE customer_followups SET status='replied', updated_at=now() WHERE franchise_id=$1 AND conversation_id=$2 AND status IN ('pending','working')", [fid, conversationId]); } catch (_) {}
}

let _started = false;
function start(deps) {
  if (_started) return; _started = true;
  deps = Object.assign({ log: console.log }, deps || {});
  setInterval(function () { followSweep(deps).catch(function (e) { (deps.log || console.log)('CUSTMAIL followSweep err ' + (e && e.message)); }); }, 5 * 60000);
}

module.exports = { handle, followSweep, clearFollowup, start, loadVisits, systemPrompt, think, runTool, TOOLS, CUSTMAIL_V1: true };
