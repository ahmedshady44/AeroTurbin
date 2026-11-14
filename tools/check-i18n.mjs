// Dev helper: checks that every language file has the same keys as en.json,
// and that every key used in index.html exists.  Usage: node tools/check-i18n.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(root, 'i18n', f), 'utf8'));
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? flat(v, p + k + '.') : [p + k]));
const en = new Set(flat(load('en.json')));
let bad = 0;
for (const f of readdirSync(join(root, 'i18n')).filter((n) => n.endsWith('.json') && n !== 'en.json')) {
  const s = new Set(flat(load(f)));
  const missing = [...en].filter((k) => !s.has(k));
  const extra = [...s].filter((k) => !en.has(k));
  if (missing.length || extra.length) bad++;
  console.log(f, 'missing:', missing, 'extra:', extra);
}
const src = readFileSync(join(root, 'index.html'), 'utf8') + readFileSync(join(root, 'app.js'), 'utf8');
const keys = [...src.matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)].flatMap((m) => m[1].split(';').map((x) => (x.includes(':') ? x.split(':')[1] : x)));
const unknown = keys.filter((k) => !en.has(k) && !/\.\d+$/.test(k) && !k.includes("'"));
console.log('unknown keys in markup:', unknown);
// numbered keys such as economy.cards.0.t
const nums = keys.filter((k) => /\.\d+/.test(k) && !en.has(k));
const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
console.log('unknown numbered keys:', nums.filter((k) => getp(load('en.json'), k) === undefined));
for (const l of ['en', 'ar']) console.log(l, 'number format sample:', new Intl.NumberFormat(l + '-u-nu-latn', { minimumFractionDigits: 1 }).format(50.6));
process.exit(bad ? 1 : 0);
