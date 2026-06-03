#!/usr/bin/env node
// Classify every keyboard by mobile/touch support. Single-process.
//
// Verdicts:
//   DESKTOP_ONLY     - &TARGETS has no touch platform, or no .keyman-touch-layout file.
//                      No mobile keyboard at all.
//   DEFAULT_SCAFFOLD - a touch-layout file exists but is essentially the Keyman
//                      Developer auto-generated default (desktop mirror, tablet-only,
//                      longpress only on the default punctuation/bracket keys). Not a
//                      real mobile design.
//   DEVELOPED        - a genuinely authored mobile layout: has a `phone` form-factor
//                      block AND real customization (>=1 longpress popup on a non-default
//                      key, i.e. a letter/number, OR flick/multitap gestures).
//
// The default scaffold ships longpress on punctuation keys (the `.`/`[`/`]` keys), so
// longpress *existence* is not enough -- we only count longpress on keys outside the
// default set, and we require a deliberately-added phone layout.
const fs = require('fs');
const path = require('path');

// Anchor to the repo root (this script lives in <repo>/tools/) so it can be run
// from anywhere, e.g. `node tools/classify-mobile.js`.
const REPO = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'mobile-layout-report.csv');

function walk(dir, out) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'build') walk(p, out); }
    else if (e.name.endsWith('.kmn')) out.push(p);
  }
}

const TOUCH_RE = /any|web|mobile|tablet|phone|iphone|ipad|android/i;
// Keys whose longpress is part of the auto-generated default (punctuation/brackets/modifiers).
const DEFAULT_SK = new Set(['K_PERIOD','K_LBRKT','K_RBRKT','K_SLASH','K_HYPHEN','K_QUOTE','K_COMMA',
  'K_LCONTROL','K_RCONTROL','K_SHIFT','K_BKSLASH','K_EQUAL',
  'U_002E','U_005B','U_005D','U_005C','U_002C','U_002F','U_0027']);

function analyzeTouch(tf) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch {}
  if (!j) return { ok:false, platforms:'', layers:'', skNonDefault:0, flick:0, multitap:0, hasPhone:false };
  const platforms = Object.keys(j);
  const layerSet = new Set();
  let skNonDefault = 0, flick = 0, multitap = 0;
  for (const plat of Object.values(j)) {
    for (const l of (plat.layer || [])) {
      if (l && l.id != null) layerSet.add(l.id);
      for (const row of (l.row || [])) {
        for (const k of (row.key || [])) {
          if (Array.isArray(k.sk) && !DEFAULT_SK.has(k.id)) skNonDefault++;
          if (k.flick) flick++;
          if (Array.isArray(k.multitap)) multitap++;
        }
      }
    }
  }
  return { ok:true, platforms: platforms.join('+'), layers: [...layerSet].join('|'),
           skNonDefault, flick, multitap, hasPhone: platforms.includes('phone') };
}

const kmns = [];
for (const root of ['release', 'experimental']) walk(path.join(REPO, root), kmns);
kmns.sort();

const rows = [['keyboard','path','targets','touch_target','layoutfile','touch_file',
               'platforms','layers','nondefault_longpress','flick','multitap','verdict']];
const tally = {};

for (const kmn of kmns) {
  const dir = path.dirname(kmn);
  const base = path.basename(kmn, '.kmn');
  let src = '';
  try { src = fs.readFileSync(kmn, 'latin1'); } catch {}
  const tm = src.match(/store\(\s*&TARGETS\s*\)\s*['"]([^'"]*)['"]/i);
  const targets = tm ? tm[1].trim().replace(/\s+/g, ' ') : '(none)';
  const layoutfile = /store\(\s*&LAYOUTFILE\s*\)/i.test(src) ? 'yes' : 'no';
  const touchTarget = TOUCH_RE.test(targets) ? 'yes' : 'no';

  const tf = path.join(dir, base + '.keyman-touch-layout');
  const hasTouchFile = fs.existsSync(tf);
  const a = hasTouchFile ? analyzeTouch(tf)
                         : { platforms:'', layers:'', skNonDefault:0, flick:0, multitap:0, hasPhone:false };

  let verdict;
  if (!hasTouchFile || touchTarget === 'no') verdict = 'DESKTOP_ONLY';
  else if (a.hasPhone && (a.skNonDefault >= 1 || a.flick > 0 || a.multitap > 0)) verdict = 'DEVELOPED';
  else verdict = 'DEFAULT_SCAFFOLD';

  tally[verdict] = (tally[verdict] || 0) + 1;
  rows.push([base, path.relative(REPO, kmn).replace(/\\/g,'/'), targets, touchTarget, layoutfile,
             hasTouchFile ? 'yes' : 'no', a.platforms, a.layers,
             a.skNonDefault, a.flick, a.multitap, verdict]);
}

const csv = rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"'+String(c).replace(/"/g,'""')+'"' : c).join(',')).join('\n');
fs.writeFileSync(OUT, csv);

console.log('=== Verdict tally ===');
for (const [k,v] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) console.log(String(v).padStart(5), k);
console.log('\nTotal keyboards:', kmns.length);
console.log('Report:', OUT);
