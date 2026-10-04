// effects_test.mjs — unit tests for the effect engine (effects.js) against the shipped data.js.
// Pure Node, no browser: the engine only sees the accessors passed to SU_EFFECTS.create().
//   node tools/effects_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const SU_EFFECTS = require(path.join(ROOT, 'effects.js'));
const D = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(w); return w.SU_DATA; })();

const CREA = new Map(D.creatures.map(c => [c.id, c]));
const SPEC = new Map(D.specs.map(s => [s.id, s]));
const propGroups = new Map();
for (const g of ['stat', 'trick']) for (const p of D.artifact[g]) {
  if (!propGroups.has(p.property)) propGroups.set(p.property, { group: g, name: p.property, entries: [] });
  propGroups.get(p.property).entries.push({ stat: p.stat, unit: p.unit, perRank: p.perRank });
}
const STAT_KEYS = SU_EFFECTS.STAT_KEYS;
const slot = (cid, o = {}) => ({ cid, fusion: null, artifactId: null, relic: null, spellGemIds: [], scrolls: {}, ...o });
const party = (...s) => [...s, ...Array(6).fill(0).map(() => slot(null))].slice(0, 6);

// minimal env: final stats = the creature's base stats (enough to check the share arithmetic)
function engine(build, { artifacts = [], nether = [] } = {}) {
  const perkRank = (spec, p) => { const m = build.perkAlloc[spec.id] || {}; return p.key in m ? m[p.key] : (p.ranks || 1); };
  return SU_EFFECTS.create({
    rules: D.effects.rules, PRIMARY: D.artifact.primary, propGroups,
    RELIC: new Map(D.relics.map(r => [r.id, r])), TRAITITEM: new Map(D.traitItems.map(t => [t.id, t])), CREA, SPEC,
    hasTrait: (id) => !!D.traits[id],
    build: () => build, nether: () => nether,
    resolveArtifact: (s) => (s.artifactId != null ? artifacts.find(a => a.id === s.artifactId) : null),
    perkRank, anointed: (sid, key) => build.anoints.some(a => a.specId === sid && a.key === key),
    slotTraitIds: (s) => { const c = CREA.get(s.cid); return c ? [c.traitId] : []; },
    finalStats: (s) => { const c = CREA.get(s.cid); return c ? { final: Object.fromEntries(STAT_KEYS.map(k => [k, c[k]])) } : null; },
  });
}
const B = (specId, slots, o = {}) => ({ specId, perkAlloc: {}, anoints: [], slots, ...o });

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};
const near = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));

// Animatus (game rule): unique standalone creature — never fused, always party slot 1, at most one.
const ANIMATUS = 46, OTHER = 109, THIRD = 559, AVATAR = 98;
const third = CREA.get(THIRD);
const share = (pct) => near(Object.fromEntries(STAT_KEYS.map(k => [k, third[k] * pct / 100])));
const ZERO = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };

console.log('Molecular Betrayal (Animator perk: Animatus gains <1>%/rank of party creature #3\'s stats at battle start)');
{
  const b = B(1, party(slot(ANIMATUS), slot(OTHER), slot(THIRD)), { perkAlloc: { 1: { MOLECULARBETRAYAL: 20 } } });
  const r = engine(b).battleStart();
  eq('rank 20 → Animatus gains 20% of all 5 stats', near(r[0].gain), share(20));
  eq('ledger names the rule for every stat', r[0].ledger.map(l => `${l.rule}:${l.stat}:${l.pct}`), STAT_KEYS.map(k => `animator-molecular-betrayal:${k}:20`));
  eq('non-Animatus creatures gain nothing', [r[1].gain, r[2].gain], [ZERO, ZERO]);
}
eq('max rank (absent alloc) → 50%', near(engine(B(1, party(slot(ANIMATUS), slot(OTHER), slot(THIRD)))).battleStart()[0].gain), share(50));
eq('third party slot empty → no gain', engine(B(1, party(slot(ANIMATUS), slot(OTHER)))).battleStart()[0].gain, ZERO);
eq('creature #3 by POSITION, not count (slot 2 empty, slot 3 filled)', engine(B(1, party(slot(ANIMATUS), slot(OTHER), slot(null), slot(THIRD)))).battleStart()[0].gain, ZERO);
eq('perk deallocated (rank 0) → no gain', engine(B(1, party(slot(ANIMATUS), slot(OTHER), slot(THIRD)), { perkAlloc: { 1: { MOLECULARBETRAYAL: 0 } } })).battleStart()[0].gain, ZERO);
eq('other spec, not anointed → no gain', engine(B(12, party(slot(ANIMATUS), slot(OTHER), slot(THIRD)))).battleStart()[0].gain, ZERO);
eq('other spec + anointed → full rank (50%)', near(engine(B(12, party(slot(ANIMATUS), slot(OTHER), slot(THIRD)), { anoints: [{ specId: 1, key: 'MOLECULARBETRAYAL' }] })).battleStart()[0].gain), share(50));
eq('no Animatus in the party → nobody gains', engine(B(1, party(slot(OTHER), slot(AVATAR), slot(THIRD)))).battleStart().map(r => r.gain), Array(6).fill(ZERO));

console.log('caps (pre-engine hard-coded values, now rules)');
eq('no spec → anoints 5 / creatures 6 / avatars 1', ['anoints', 'creatures', 'avatars'].map(c => engine(B(null, party())).cap(c)), [5, 6, 1]);
eq('Royal → 20 anointments', engine(B(27, party())).cap('anoints'), 20);
eq('Royal w/o Highborn → 15', engine(B(27, party(), { perkAlloc: { 27: { HIGHBORN: 0 } } })).cap('anoints'), 15);
eq('Pariah → 3 creatures', engine(B(37, party())).cap('creatures'), 3);
eq('Fanatic Army of Gods rank 1 / 2 → 2 / 3 avatars', [1, 2].map(r => engine(B(21, party(), { perkAlloc: { 21: { ARMYOFGODS: r } } })).cap('avatars')), [2, 3]);
eq('Deprived → 0 avatars, ignores relics + fusion traits', (e => [e.cap('avatars'), e.ignores('relics'), e.ignores('fusionTraits')])(engine(B(38, party()))), [0, true, true]);
eq('spec-only perks are NOT honoured as anointments (pre-engine behaviour)', (e => [e.cap('avatars'), e.cap('creatures'), e.ignores('relics')])(
  engine(B(12, party(), { anoints: [{ specId: 21, key: 'ARMYOFGODS' }, { specId: 37, key: 'INTROVERSION' }, { specId: 38, key: 'TOTALDEPRIVATION' }] }))), [1, 6, false]);

console.log('spell-gem slots + class permissions');
eq('Gray Matter rank 3 → Animatus 6 slots, others 3', (e => [e.gemSlotMax(slot(ANIMATUS)), e.gemSlotMax(slot(OTHER))])(engine(B(1, party(), { perkAlloc: { 1: { GRAYMATTER: 3 } } }))), [6, 3]);
{
  const pump = { id: 9, rank: 50, primary: 'Helmet', stat: [], trick: ['Spell Gem Slots'], netherIds: [] };
  const pump25 = { ...pump, id: 10, rank: 25 };
  const stoneArt = { id: 11, rank: 50, primary: 'Helmet', stat: [], trick: [], netherIds: [7] };
  const nether = [{ id: 7, props: [{ cat: 'trick', key: 'Spell Gem Slots', value: 2 }] }];
  const e = engine(B(1, party(), { perkAlloc: { 1: { GRAYMATTER: 3 } } }), { artifacts: [pump, pump25, stoneArt], nether });
  eq('artifact "Spell Gem Slots" trick r50 → +3 (base 3 → 6)', e.gemSlotMax(slot(OTHER, { artifactId: 9 })), 6);
  eq('… r25 → +2', e.gemSlotMax(slot(OTHER, { artifactId: 10 })), 5);
  eq('socketed nether stone with +2 Spell Gem Slots', e.gemSlotMax(slot(OTHER, { artifactId: 11 })), 5);
  eq('stacks with Gray Matter on the Animatus (3 + 3 + 3)', e.gemSlotMax(slot(ANIMATUS, { artifactId: 9 })), 9);
}
eq('Evoker masteries (anointed) add classes', [...engine(B(12, party(), { anoints: [{ specId: 4, key: 'LIFEMASTERY' }] })).equipClasses(slot(ANIMATUS), 'Death')].sort(), ['Death', 'Life']);
eq('Pandora (Aurum) in party → any class for everyone', engine(B(null, party(slot(OTHER), slot(ANIMATUS)))).equipClasses(slot(ANIMATUS), 'Death'), null);

console.log('stat contributions');
{
  const nether = [{ id: 1, props: [{ cat: 'stat', key: 'Attack', value: 30 }, { cat: 'trick', key: 'Attack Damage', value: 20 }, { cat: 'trait', key: 41 }] }];
  const art = { id: 1, rank: 50, primary: 'Sword', stat: ['Attack'], trick: [], netherIds: [1] };
  const e = engine(B(null, party()), { artifacts: [art], nether });
  eq('Sword r50 + Attack amber r50 + nether Attack 30 → +148% Attack', e.foldCore(e.artifactContribs(art)).atk, 59 + 59 + 30);
  eq('bonus fold keeps non-core trick effects by property', [...e.foldBonus(e.artifactContribs(art)).extra], [['Attack Damage', { value: 20, unit: '%' }]]);
  eq('relic rank 57 → +5.7% of its stat; ignored under Deprived', [
    engine(B(null, party())).slotBonusPct(slot(ANIMATUS, { relic: { id: 3, rank: 57 } })).hp,
    engine(B(38, party())).slotBonusPct(slot(ANIMATUS, { relic: { id: 3, rank: 57 } })).hp], [5.7, 0]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
