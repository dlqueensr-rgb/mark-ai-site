// _add_photovideo.cjs — PHOTOVIDEO_V1: Mark always invites callers/texters to send a photo or short video
// of the project (global, every office). One anchored insert into buildSystemPrompt. Idempotent; backs up;
// aborts if the anchor isn't a clean single match. Run in repo root: cd ~/newmark && node _add_photovideo.cjs
const fs = require('fs');
const FILE = 'src/franchise.cjs';
if (!fs.existsSync(FILE)) { console.log('ERR not found: ' + FILE); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');
if (src.includes('PHOTOVIDEO_V1')) { console.log('= already has PHOTOVIDEO_V1 - nothing to do'); process.exit(0); }

const ANCHOR = String.raw` Ask only the single detail that matters for the job in front of you, once. /* SCOPEQ_V1 */');`;
const ADD = String.raw`
  parts.push('PHOTOS & VIDEO OF THE JOB: on a job someone wants done, invite them once - warmly, as a normal part of taking down the job - to send a photo or a short video of what needs doing, so the technician can see it ahead of time and come ready with the right parts. ' + ((opts && opts.channel === 'text') ? 'They can just reply here with the picture or video.' : 'Ask for the best cell if you do not already have it, then text them with text_customer so they can reply to that text with the photo or video; if they are already texting from a cell, they can send it to the number they are on.') + ' It never holds up the price or the booking: if they do not have one or would rather not, that is completely fine - move right on, and never ask more than once. Anything they send is looked at and goes on their job automatically. /* PHOTOVIDEO_V1 (David, Nov 27 2026 - Richard, SW Minneapolis: always invite callers to send pictures or video of their project) */');`;

const n = src.split(ANCHOR).length - 1;
if (n !== 1) { console.log('ERR anchor matched ' + n + ' times (need exactly 1) - aborting, no change'); process.exit(1); }
fs.copyFileSync(FILE, FILE + '.bak-photovideo');
fs.writeFileSync(FILE, src.replace(ANCHOR, ANCHOR + ADD));
console.log('PATCHED ' + FILE + ' (backup ' + FILE + '.bak-photovideo)');
console.log('Next: node --check ' + FILE + '  then deploy.');
