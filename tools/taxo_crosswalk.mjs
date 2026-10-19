// Taxonomy v2 crosswalk check (DRAFT, TAXONOMY_INTENT.md "Taxonomy v2").
// Applies data/reference/taxonomy_crosswalk.json to every shipped object in data.js, re-derives Action/Mechanic as
// Theme, and reports: unmapped old values, review load (split / dup), themes that would be lost, themes gained.
// Usage: node tools/taxo_crosswalk.mjs [--json out.json]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
const D = ctx.window.SU_DATA;
const X = JSON.parse(fs.readFileSync(path.join(root, 'data/reference/taxonomy_crosswalk.json'), 'utf8'));

const CLASS_TYPES = new Set(X.themes['Creature Class'].filter(p => p.startsWith('Creature Type::')).map(p => p.slice(15)));
const SPELL_CLASS = new Set(['Chaos Spells', 'Death Spells', 'Life Spells', 'Nature Spells', 'Sorcery Spells']);

// objects: traits, perks, spells, relics, cards, conditions (traitItems mirror traits and are skipped)
const objs = [];
const add = (kind, o) => { if (Array.isArray(o.taxo)) objs.push({ kind, id: o.key ?? o.id, name: o.name || o.key || o.id, taxo: o.taxo, src: o.taxoSrc || [] }); };
for (const t of Object.values(D.traits || {})) add('trait', t);
for (const s of D.specs || []) for (const p of s.perks || []) add('perk', p);
for (const k of ['spells', 'relics', 'cards', 'conditions']) for (const o of Object.values(D[k] || {})) add(k.replace(/s$/, ''), o);

const lookup = (old) => {
  if (X.map[old]) return X.map[old];
  const cat = old.slice(0, old.indexOf('::'));
  return X.map[cat + '::*'] || null;
};
const target = (rule, old) => {
  const val = old.slice(old.indexOf('::') + 2);
  if (rule.kind === 'split3') {
    if (SPELL_CLASS.has(val)) return ['Spell Class::' + val];
    if (/ Spells$/.test(val)) return ['Spell Kind::' + val];
    return ['Named Spell::' + val];
  }
  return (rule.to || []).map(t => t.endsWith('::*') ? t.slice(0, -1) + val : t);
};
const match = (pat, tag) => {
  if (pat.endsWith('*!class')) { const p = pat.slice(0, -7); return tag.startsWith(p) && !CLASS_TYPES.has(tag.slice(p.length)); }
  return pat.endsWith('*') ? tag.startsWith(pat.slice(0, -1)) : tag === pat;
};
const themesOf = (tags) => Object.entries(X.themes).filter(([k]) => k !== '_note')
  .filter(([, pats]) => tags.some(t => pats.some(p => match(p, t)))).map(([k]) => k);

const unmapped = {}, review = { split: {}, dup: {}, dupResolved: {} }, lost = {}, gained = {}, newVals = {};
let tagIn = 0, tagOut = 0, sourced = 0;
for (const o of objs) {
  const out = new Set();
  const oldThemes = [];
  o.taxo.forEach((old, i) => {
    tagIn++;
    if (old.startsWith('Action/Mechanic::') && !X.map[old]) { oldThemes.push([old.slice(17), o.src[i] || '?']); return; }
    const rule = lookup(old);
    if (!rule) { (unmapped[old] ||= []).push(o.name); return; }
    if (rule.kind === 'drop') return;
    if (rule.kind === 'split') (review.split[old] ||= []).push({ kind: o.kind, id: o.id, name: o.name });
    if (rule.kind === 'dup') {
      const trig = rule.trigger, hasTrig = o.taxo.some(t => lookup(t) && target(lookup(t), t).includes(trig));
      if (hasTrig) { (review.dup[old] ||= []).push({ kind: o.kind, id: o.id, name: o.name }); }   // ambiguous: trigger present, effect may or may not
      else (review.dupResolved[old] ||= []).push({ kind: o.kind, id: o.id, name: o.name });         // no trigger: the old tag can only mean the outcome
    }
    for (const t of target(rule, old)) out.add(t);
  });
  // Source attribute: damage / hit / calculation tags take Attack / Spell / Indirect from the old co-tags
  const srcVals = Object.entries(X.attributes.source.from_old).filter(([t]) => o.taxo.includes(t)).map(([, v]) => v)
    .concat(o.taxo.map(t => (lookup(t) || {}).source).filter(Boolean));
  const hasSourced = [...out].some(t => X.attributes.source.applies_to.some(p => match(p, t)));
  if (hasSourced && srcVals.length) sourced++;
  const derived = new Set(themesOf([...out]));
  if (hasSourced) for (const v of srcVals) { derived.add(X.attributes.source.themes[v]); derived.add('Damage'); }
  for (const th of X.object_themes[o.kind] || []) derived.add(th);
  for (const [th, src] of oldThemes) if (!derived.has(th)) {
    ((lost[th] ||= {})[src] ||= []).push(`${o.kind}:${o.id}:${o.name}`);
    out.add('Involves::' + th); derived.add(th);
  }
  const tags = [...out]; tagOut += tags.length;
  for (const t of tags) newVals[t] = (newVals[t] || 0) + 1;
  const oldSet = new Set(oldThemes.map(([t]) => t));
  // gains only from tags that are not pending a split (a split's union of targets would over-count)
  const firm = new Set(themesOf(o.taxo.filter(t => { const r = lookup(t); return r && r.kind !== 'split' && r.kind !== 'derive'; }).flatMap(t => target(lookup(t), t))));
  for (const th of firm) if (!oldSet.has(th) && !['Intercept', 'Adjacency', 'Relic', 'Personality', 'Artifact'].includes(th)) gained[th] = (gained[th] || 0) + 1;
}

const n = (o) => Object.values(o).reduce((a, v) => a + (Array.isArray(v) ? v.length : Object.values(v).reduce((b, w) => b + w.length, 0)), 0);
console.log(`objects ${objs.length} · tags in ${tagIn} → out ${tagOut} (Action/Mechanic recomputed as Theme)`);
console.log(`\nUNMAPPED old values: ${Object.keys(unmapped).length}`);
for (const [k, v] of Object.entries(unmapped)) console.log(`  ${k}  (${v.length}) e.g. ${v.slice(0, 3).join(', ')}`);
console.log(`\nREVIEW — split (code decides per object): ${n(review.split)} tag instances`);
for (const [k, v] of Object.entries(review.split).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(4)}  ${k}`);
console.log(`\nREVIEW — outcome vs trigger duplicates: ${n(review.dup)} ambiguous (trigger also present), ${n(review.dupResolved)} resolved (no trigger → outcome)`);
for (const k of new Set([...Object.keys(review.dup), ...Object.keys(review.dupResolved)])) console.log(`  ${k}: ambiguous ${(review.dup[k] || []).length} · resolved ${(review.dupResolved[k] || []).length}`);
console.log(`
SOURCE attribute set on ${sourced} objects`);
console.log(`
INVOLVES (old Action/Mechanic tag not re-derived, kept as Involves::<theme>, review item): ${n(lost)}`);
for (const [th, bySrc] of Object.entries(lost).sort()) {
  console.log(`  ${th}: ` + Object.entries(bySrc).map(([s, v]) => `${s} ${v.length}`).join(' · '));
  for (const [s, v] of Object.entries(bySrc)) console.log(`      [${s}] ${v.slice(0, 6).join(' | ')}${v.length > 6 ? ' …' : ''}`);
}
console.log(`\nTHEMES GAINED (derived, missing today — superset gaps in the current data): ${Object.values(gained).reduce((a, b) => a + b, 0)}`);
console.log('  ' + Object.entries(gained).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
const cats = {};
for (const [t, c] of Object.entries(newVals)) { const k = t.slice(0, t.indexOf('::')); (cats[k] ||= []).push([t.slice(k.length + 2), c]); }
console.log(`\nNEW VOCABULARY: ${Object.keys(cats).length} categories`);
for (const [k, v] of Object.entries(cats)) console.log(`  ${k} (${v.length})` + (v.length <= 30 ? ': ' + v.sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(' · ') : ''));
const ji = process.argv.indexOf('--json');
if (ji > 0) fs.writeFileSync(process.argv[ji + 1], JSON.stringify({ unmapped, review, lost, gained, newVals }, null, 1));
