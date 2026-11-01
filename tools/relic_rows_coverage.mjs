// Relic rank rows vs their text: lists every rank whose text names a spell or status effect that its drop-down lacks.
// A text check only (to find gaps; never a data source). Name overlaps give false alarms ("Death" in "Death Blossom").
// usage: node tools/relic_rows_coverage.mjs [data.js] [sample]
import fs from 'fs';
const src = fs.readFileSync(process.argv[2] || "data.js", 'utf8'); const window = {}; eval(src); const D = window.SU_DATA;
const spells = D.spells, conds = D.conditions;
if (process.argv[3] === 'sample') {
  console.log('rank sample', JSON.stringify(D.relics[0].ranks[0]).slice(0, 300));
  console.log('used sample', JSON.stringify(D.relics[0].spellsUsed), JSON.stringify(D.relics[0].condsUsed));
}
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let miss = 0, total = 0, items = 0;
for (const r of D.relics) for (const rk of r.ranks) {
  const d = rk.desc || ''; total++;
  const haveS = new Set((r.spellsUsed || []).filter(e => e.rk === rk.rank).map(e => e.s));
  const haveC = new Set((r.condsUsed || []).filter(e => e.rk === rk.rank).map(e => `${e.c}`));
  const out = [];
  for (const s of spells) if (s.name && new RegExp(`\\b${esc(s.name)}\\b`).test(d) && !haveS.has(s.id)) out.push(`spell:${s.name}`);
  for (const c of conds) if (c.name && new RegExp(`\\b${esc(c.name)}\\b`).test(d) && !haveC.has(`${c.cat}:${c.key}`)) out.push(`${c.cat}:${c.name}`);
  if (out.length) { miss++; items += out.length; console.log(`${r.name} R${rk.rank}: ${out.join(', ')}\n    ${d.slice(0, 220)}`); }
}
console.log(`ranks with misses ${miss}/${total}, missing items ${items}`);
