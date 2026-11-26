// _fix_quantityfrom2.cjs — SPECNUM_V2: extend quantityFrom() to ignore size/spec nouns found by
// the full-book sweep (SF, feet/inch marks, N-story, N-car, N coats, N-zone, three-way word form,
// "group of N", levels). Real counts ("hang 2 doors", "4 can lights") and fixed-scope packages
// ("(3 doors)", "springs (pair)") are untouched. Whole-function replace; idempotent; backs up.
// Works whether the file has SPECNUM_V1 or not. Run in repo root: node _fix_quantityfrom2.cjs
const fs = require('fs');
const FILE = 'src/masterHours.cjs';
if (!fs.existsSync(FILE)) { console.log('ERR not found: ' + FILE + ' (run from repo root, e.g. ~/newmark)'); process.exit(1); }
let src = fs.readFileSync(FILE, 'utf8');
if (/SPECNUM_V2/.test(src)) { console.log('= already SPECNUM_V2 — nothing to do'); process.exit(0); }

const START = 'function quantityFrom(s){';
const END = '\n  return null;\n}';
const i = src.indexOf(START);
if (i < 0) { console.log('ERR could not find quantityFrom — aborting'); process.exit(1); }
if (src.indexOf(START, i + 1) >= 0) { console.log('ERR quantityFrom anchor is not unique — aborting'); process.exit(1); }
const j = src.indexOf(END, i);
if (j < 0) { console.log('ERR could not find end of quantityFrom — aborting'); process.exit(1); }

const NEWFN = String.raw`function quantityFrom(s){
  let t = String(s || '').toLowerCase().replace(/-/g, ' ');
  /* SPECNUM_V2: numbers that are part of a product spec or a size, not a job count
     (Level 2, 3-way/three-way, 3-phase, 2-gang, NEMA 14-50, 12/2 wire, up to 32 SF, 8' wide,
      2 story, 3 car garage, 2 coats, 2-zone, group of 6, 2 levels) */
  t = t.replace(/\bnema\s*\d+(?:\s+\d+)?/g, ' ')
       .replace(/\blevel\s*\d+/g, ' ')
       .replace(/\bcat\s*\d+/g, ' ')
       .replace(/\btype\s+\d+/g, ' ')
       .replace(/\bgroup of\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g, ' ')
       .replace(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:way|phase|pole|gang|prong|zone|cars?|coats\b|stor(?:y|ies|ey)|levels?)\b/g, ' ')
       .replace(/\b\d+(?:\s*[\/ ]\s*\d+)?\s*(?:awg|ga|gauge|wire|romex|nm)\b/g, ' ')
       .replace(/\b\d+\s*\/\s*\d+\b/g, ' ');
  const re = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|pair|couple|dozen)\b(?!\s*(?:ft|foot|feet|inch|inches|in\b|"|'|′|″|x\b|by\b|sq|sqft\b|sf\b|square|linear|lf|gallon|gal|amp|volt|%|percent|hour|hr|minute|min))/g;
  let m; while ((m = re.exec(t))) { const v = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMWORDS[m[1]]; if (v >= 1 && v <= 500) return v; }
  return null;
}`;

fs.copyFileSync(FILE, FILE + '.bak-specnum2');
src = src.slice(0, i) + NEWFN + src.slice(j + END.length);
fs.writeFileSync(FILE, src);
console.log('PATCHED ' + FILE + ' to SPECNUM_V2 (backup: ' + FILE + '.bak-specnum2)');
console.log('Next: node --check ' + FILE + '  then deploy.');
