// _fix_quantityfrom.cjs — SPECNUM_V1: stop quantityFrom() from reading spec numbers
// (Level 2, 3-way, 3-phase, 2-gang, 2-pole, NEMA 14-50, 12/2 wire) as job counts.
// Real counts ("two outlets", "three TV mounts") are untouched. One function in
// src/masterHours.cjs (identical in both codebases). Idempotent; backs up; aborts on bad match.
// Run in the repo root: cd ~/newmark && node _fix_quantityfrom.cjs   (then node --check, then deploy)
const fs = require('fs');
const FILE = 'src/masterHours.cjs';

const OLD = "  const t = String(s || '').toLowerCase().replace(/-/g, ' ');";
const NEW = [
  "  let t = String(s || '').toLowerCase().replace(/-/g, ' ');",
  "  /* SPECNUM_V1: numbers that are part of a product spec, not a count (Level 2, 3-way, 3-phase, 2-gang, NEMA 14-50, 12/2 wire) */",
  "  t = t.replace(/\\bnema\\s*\\d+(?:\\s+\\d+)?/g, ' ')",
  "       .replace(/\\blevel\\s*\\d+/g, ' ')",
  "       .replace(/\\bcat\\s*\\d+/g, ' ')",
  "       .replace(/\\btype\\s+\\d+/g, ' ')",
  "       .replace(/\\b\\d+(?:\\s*[\\/ ]\\s*\\d+)?\\s*(?:awg|ga|gauge|wire|romex|nm)\\b/g, ' ')",
  "       .replace(/\\b\\d+\\s*(?:way|phase|pole|gang|prong)\\b/g, ' ')",
  "       .replace(/\\b\\d+\\s*\\/\\s*\\d+\\b/g, ' ');",
].join('\n');

if (!fs.existsSync(FILE)) { console.log('ERR not found: ' + FILE + ' (run from the repo root, e.g. ~/newmark)'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('SPECNUM_V1')) { console.log('= already patched (SPECNUM_V1 present) — nothing to do'); process.exit(0); }

const n = src.split(OLD).length - 1;
if (n !== 1) { console.log('ERR expected exactly 1 match of the anchor line, found ' + n + ' — aborting, no change made'); process.exit(1); }

fs.copyFileSync(FILE, FILE + '.bak-specnum');
src = src.replace(OLD, NEW);
fs.writeFileSync(FILE, src);
console.log('PATCHED ' + FILE + ' (backup: ' + FILE + '.bak-specnum)');
console.log('Next: node --check ' + FILE + '  then deploy.');
