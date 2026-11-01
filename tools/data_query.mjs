// Look up shipped taxonomy in data.js without hand-written loaders.
//   node tools/data_query.mjs name <regex>        objects whose name matches: kind, id, taxo2 tags
//   node tools/data_query.mjs tag <prefix>        value counts for tags starting with <prefix> (e.g. "Named Spell::")
//   node tools/data_query.mjs diff <old data.js>  per-object taxo2 / theme2 changes vs an older build (git show HEAD:data.js > f)
import fs from 'node:fs';
const load = (f) => { const w = {}; new Function('window', fs.readFileSync(f, 'utf8'))(w); return w.SU_DATA; };
const objects = (D) => Object.entries(D).flatMap(([kind, v]) => v && typeof v === 'object'
  ? Object.values(v).filter(o => o && typeof o === 'object' && o.taxo2).map(o => ({ kind, o })) : []);
const [cmd, arg] = process.argv.slice(2);
const D = load('data.js');
if (cmd === 'name') {
  const rx = new RegExp(arg, 'i');
  for (const { kind, o } of objects(D)) if (rx.test(o.name || '')) console.log(kind, o.id ?? o.key, o.name, '|', o.taxo2.map(t => t.t + (t.rk ? '@' + t.rk : '')).join(', '));
} else if (cmd === 'tag') {
  const c = {};
  for (const { o } of objects(D)) for (const t of o.taxo2) if (t.t.startsWith(arg)) c[t.t] = (c[t.t] || 0) + 1;
  for (const [t, n] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log(n, t);
} else if (cmd === 'diff') {
  const key = (k, o) => `${k}:${o.id ?? o.key}`;
  const old = new Map(objects(load(arg)).map(({ kind, o }) => [key(kind, o), o]));
  for (const { kind, o } of objects(D)) {
    const p = old.get(key(kind, o)); const a = new Set((p?.taxo2 || []).map(t => t.t)), b = new Set(o.taxo2.map(t => t.t));
    const add = [...b].filter(t => !a.has(t)), del = [...a].filter(t => !b.has(t));
    const th = JSON.stringify(p?.theme2 || []) !== JSON.stringify(o.theme2 || []) ? ` themes ${JSON.stringify(p?.theme2)} -> ${JSON.stringify(o.theme2)}` : '';
    if (add.length || del.length || th) console.log(key(kind, o), o.name, add.length ? '+' + add.join(', +') : '', del.length ? '-' + del.join(', -') : '', th);
  }
} else console.log('usage: node tools/data_query.mjs name <regex> | tag <prefix> | diff <old data.js>');
