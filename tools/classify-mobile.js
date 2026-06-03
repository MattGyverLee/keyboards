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
//   DEVELOPED        - a hand-edited mobile layout: at least one longpress popup on a
//                      non-punctuation key that goes BEYOND the `template-latin` template,
//                      OR a flick gesture.
//
// Rationale (confirmed against the Keyman Developer workflow):
//   * Keyman ships a `template-latin` touch template that pre-loads longpress on 11 Latin
//     letters (E T Y U I O A S D C N, both cases). Applying it is NOT language-specific
//     work, so subkeys matching that template are discounted; only longpress on other keys,
//     or with characters outside the template's set, counts as a hand-edit. (The other
//     templates, template-basic and template-traditional, add no non-punctuation longpress.)
//   * Platform blocks (phone vs tablet) are NOT a signal -- they only reflect which
//     era's default scaffold the keyboard was created from (old=tablet-only,
//     then=phone+tablet, modern=phone-only), so they are ignored here.
//   * The auto-generated scaffold ships longpress ONLY on punctuation/bracket keys
//     (the `.`/`[`/`]` keys). It does NOT auto-populate longpress on letters/numbers,
//     so any longpress on a non-punctuation key is a deliberate hand-edit.
//   * Flicks are essentially never auto-generated -> hand-edit.
//   * multitap is reported but NOT used for the verdict: Keyman can auto-generate
//     multitap on the number row, so it is not a reliable hand-edit signal.
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

// Longpress that ships with Keyman Developer's `template-latin` touch template. A keyboard
// that merely applied this template (and did no language-specific work) would otherwise look
// "developed", so we discount any subkey that matches the template. Keyed by base key -> set
// of subkey ids (default lowercase + shift uppercase combined). The other shipped templates
// (template-basic, template-traditional) add NO non-punctuation longpress, so need no entry.
const TEMPLATE_LATIN_SK = {
  K_A:['U_00C0','U_00C1','U_00C2','U_00C3','U_00C4','U_00C5','U_00C6','U_00E0','U_00E1','U_00E2','U_00E3','U_00E4','U_00E5','U_00E6'],
  K_C:['U_00C7','U_00E7'],
  K_D:['U_00D0','U_00F0'],
  K_E:['U_00C8','U_00C9','U_00CA','U_00CB','U_00E8','U_00E9','U_00EA','U_00EB'],
  K_I:['U_00CC','U_00CD','U_00CE','U_00CF','U_00EC','U_00ED','U_00EE','U_00EF'],
  K_N:['U_00D1','U_00F1'],
  K_O:['U_00D2','U_00D3','U_00D4','U_00D5','U_00D6','U_00D8','U_00F2','U_00F3','U_00F4','U_00F5','U_00F6','U_00F8'],
  K_S:['U_00DF'],
  K_T:['U_00DE','U_00FE'],
  K_U:['U_00D9','U_00DA','U_00DB','U_00DC','U_00F9','U_00FA','U_00FB','U_00FC'],
  K_Y:['U_00DD','U_00FD'],
};
const TEMPLATE_LATIN = {};
for (const k of Object.keys(TEMPLATE_LATIN_SK)) TEMPLATE_LATIN[k] = new Set(TEMPLATE_LATIN_SK[k]);

function analyzeTouch(tf) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(tf, 'utf8')); } catch {}
  if (!j) return { ok:false, platforms:'', layers:'', skNonDefault:0, skBeyondTemplate:0, flick:0, multitap:0 };
  const platforms = Object.keys(j);
  const layerSet = new Set();
  let skNonDefault = 0, skBeyondTemplate = 0, flick = 0, multitap = 0;
  for (const plat of Object.values(j)) {
    for (const l of (plat.layer || [])) {
      if (l && l.id != null) layerSet.add(l.id);
      for (const row of (l.row || [])) {
        for (const k of (row.key || [])) {
          if (Array.isArray(k.sk) && !DEFAULT_SK.has(k.id)) {
            skNonDefault += k.sk.length;
            // Count subkeys that are NOT part of the template-latin signature for this key:
            // either the key isn't a template key, or this specific subkey isn't in it.
            const tmpl = TEMPLATE_LATIN[k.id];
            for (const s of k.sk) {
              const sid = s.id || s.text;
              if (!tmpl || !tmpl.has(sid)) skBeyondTemplate++;
            }
          }
          if (k.flick) flick++;
          if (Array.isArray(k.multitap)) multitap++;
        }
      }
    }
  }
  return { ok:true, platforms: platforms.join('+'), layers: [...layerSet].join('|'),
           skNonDefault, skBeyondTemplate, flick, multitap };
}

const kmns = [];
for (const root of ['release', 'experimental']) walk(path.join(REPO, root), kmns);
kmns.sort();

const rows = [['keyboard','path','targets','touch_target','layoutfile','touch_file',
               'platforms','layers','nondefault_longpress','longpress_beyond_template','flick','multitap','verdict']];
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
                         : { platforms:'', layers:'', skNonDefault:0, skBeyondTemplate:0, flick:0, multitap:0 };

  let verdict;
  if (!hasTouchFile || touchTarget === 'no') verdict = 'DESKTOP_ONLY';
  else if (a.skBeyondTemplate >= 1 || a.flick > 0) verdict = 'DEVELOPED';
  else verdict = 'DEFAULT_SCAFFOLD';

  tally[verdict] = (tally[verdict] || 0) + 1;
  rows.push([base, path.relative(REPO, kmn).replace(/\\/g,'/'), targets, touchTarget, layoutfile,
             hasTouchFile ? 'yes' : 'no', a.platforms, a.layers,
             a.skNonDefault, a.skBeyondTemplate, a.flick, a.multitap, verdict]);
}

const csv = rows.map(r => r.map(c => /[",\n]/.test(String(c)) ? '"'+String(c).replace(/"/g,'""')+'"' : c).join(',')).join('\n');
fs.writeFileSync(OUT, csv);

console.log('=== Verdict tally ===');
for (const [k,v] of Object.entries(tally).sort((a,b)=>b[1]-a[1])) console.log(String(v).padStart(5), k);
console.log('\nTotal keyboards:', kmns.length);
console.log('Report:', OUT);
