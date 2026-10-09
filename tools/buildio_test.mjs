// buildio_test.mjs — tests for build import/export (buildio.js) against the shipped data.js.
//   node tools/buildio_test.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const IO = require(path.join(ROOT, 'buildio.js'));
const D = (() => { const w = {}; new Function('window', fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8'))(w); return w.SU_DATA; })();

const anointList = () => D.specs.flatMap(s => s.perks.filter(p => p.anointment && s.falseGod && p.key !== 'HIGHBORN').map(p => ({ ...p, specId: s.id })));
const env = { D, CREA: new Map(D.creatures.map(c => [c.id, c])), SPELL: new Map(D.spells.map(s => [s.id, s])),
  SPELLPROP: new Map(D.spellProps.map(p => [p.id, p])), RELIC: new Map(D.relics.map(r => [r.id, r])),
  NETHER_TRIGGERS: ['On Attack', 'On Defend', 'On Cast', 'On Provoke', 'On Turn'], anointList };
const io = IO.create(env);

let pass = 0, fail = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); ok ? pass++ : fail++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${name}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`); };
const byName = (arr, name) => arr.find(x => x.name === name);
const cname = (id) => (env.CREA.get(id) || {}).name;
const spellName = (key) => (D.spells.find(s => s.key === key) || {}).name;
const itemTrait = (id) => (D.traitItems.find(t => t.id === id) || {}).traitName;

console.log('game export → payload (user sample)');
const sample = fs.readFileSync(path.join(ROOT, 'tools/fixtures/game_export_sample.txt'), 'utf8');
const { payload: p, warnings } = io.parseGameText(sample);
eq('spec = Animator', (D.specs.find(s => s.id === p.spec) || {}).label, 'Animator');
eq('5 anointments resolved', p.anoints.length, 5);
eq('6 creatures', p.slots.map(s => s && cname(s.cid)), ['Animatus', 'Valkyrie Scout', 'Augmented Ossein', 'Bhasa Cherub', 'Reclusive Wight', 'Gravebane Wight']);
eq('fusions', p.slots.map(s => s.fusion && cname(s.fusion)), [null, 'Abyssal Spectre', 'Pegasus', 'Whiptail Clutcher', 'Unicorn Vivifier', 'Sparktail Student']);
eq('personalities', p.slots.map(s => s.personality), ['brave', 'brutal', 'brutal', 'careful', 'careful', 'lazy']);
eq('scrolls "(15)" → stat', p.slots.map(s => s.scrolls), [{ spd: 15 }, { atk: 15 }, { atk: 15 }, { int: 15 }, {}, {}]);
const a0 = p.slots[0].artifact;
eq('artifact primary Sword @ rank 50 (59%)', [a0.name, a0.primary, a0.rank], ['Dark Commander', 'Sword', 50]);
eq('stat ×3 + trick ×2', [a0.stat, a0.trick], [['Attack', 'Attack', 'Attack'], ['Attack Damage', 'Life Strength']]);
eq('trait slot + spell slot', [itemTrait(a0.traits[0]), spellName(a0.spells[0])], ['Charge', 'Aftermath']);
eq('nether stone name + rarity', [a0.nether.name, a0.nether.rarity], ['Battle From Within', 354]);
eq('nether props (stat/trick values, trait, spell+trigger)', a0.nether.props.map(x => x.cat === 'spell' ? `${spellName(x.spell)} ${x.trigger}` : x.cat === 'trait' ? `T:${itemTrait(x.key)}` : `${x.value} ${x.key}`),
  ['5 Shelled On Damage', '22 Attack', '6 Vulnerable On Damage', '12 Intelligence / Defense', '7 Snared On Damage', '13 Attack / Speed', 'T:Battle From Within', 'Spectral Crash On Attack']);
eq('Wabbajack: Staff, "3 Spell Gem Slots" is a trick', [p.slots[3].artifact.primary, p.slots[3].artifact.trick], ['Staff', ['Spell Gem Slots', 'Spell Potency']]);
eq('6 spell gems on Bhasa Cherub', p.slots[3].gems.map(g => spellName(g.spell)), ['Blitz Howl', 'Inner Destruction', 'Saving Grace', 'Affliction', 'Panic Attack', 'Infernal Charge']);
eq('relics + ranks', p.slots.map(s => s.relic && `${D.relics.find(r => r.id === s.relic.id).name.split(',')[0]} ${s.relic.rank}`),
  ['Vitreous 100', 'Temptation 100', 'Ferro 10', 'Ribcracker 10', 'Whisper 91', 'Brambleskin 10']);
eq('only the expected warning (perk ranks)', warnings, ['Perk ranks aren\'t part of the game export — all perks set to max.']);

console.log('code line round trip');
const code = await io.encodeCode(p);
eq('code starts with SUC1:', code.slice(0, 5), 'SUC1:');
const back = await io.decodeCode(code.slice(5));
eq('decode(encode(payload)) is identical', back, p);
const viaText = await io.importText(`some chat text\n${code}\nmore text`);
eq('importText finds the code inside other text', [viaText.source, JSON.stringify(viaText.payload) === JSON.stringify(p)], ['code', true]);
console.log(`  (code length ${code.length} chars for the 6-creature sample)`);

console.log('errors');
let msg = null; try { io.parseGameText('hello world'); } catch (e) { msg = e.message; }
eq('non-export text is rejected', !!msg, true);
msg = null; try { await io.importText('SUC1:@@@not-base64@@@'); } catch (e) { msg = e.message; }
eq('a damaged code is rejected', !!msg, true);

console.log('library dedupe (sameStone / sameArtifactBody)');
const st = { name: 'Rage Stone', icon: 'gem1', rarity: 300, props: [{ cat: 'stat', key: 'Attack', value: 22 }, { cat: 'spell', key: 7, trigger: 'On Attack' }, { cat: 'trait', key: 4 }] };
eq('identical stone matches', IO.sameStone(st, { ...st }), true);
eq('prop order and value type ignored', IO.sameStone(st, { ...st, props: [{ cat: 'trait', key: 4, value: null }, { cat: 'spell', key: 7, trigger: 'On Attack' }, { cat: 'stat', key: 'Attack', value: '22' }] }), true);
eq('no icon on the incoming stone (game export) still matches', IO.sameStone(st, { ...st, icon: null }), true);
eq('rarity only compared when both have one', [IO.sameStone({ ...st, rarity: undefined }, st), IO.sameStone(st, { ...st, rarity: 301 })], [true, false]);
eq('different icon / name / value / trigger do not match', [IO.sameStone(st, { ...st, icon: 'gem2' }), IO.sameStone(st, { ...st, name: 'Other' }),
  IO.sameStone(st, { ...st, props: [{ cat: 'stat', key: 'Attack', value: 23 }, st.props[1], st.props[2]] }),
  IO.sameStone(st, { ...st, props: [st.props[0], { cat: 'spell', key: 7, trigger: 'On Damage' }, st.props[2]] })], [false, false, false, false]);
const ar = { name: 'Dark Commander', rank: 50, primary: 'Sword', stat: ['Attack', 'Health', 'Attack'], trick: ['Life Strength'], traits: [3], spells: [9] };
eq('identical artifact matches (stat order ignored, rank defaults to 50)', IO.sameArtifactBody({ ...ar, rank: undefined }, { ...ar, stat: ['Attack', 'Attack', 'Health'] }), true);
eq('different rank / slot content do not match', [IO.sameArtifactBody(ar, { ...ar, rank: 60 }), IO.sameArtifactBody(ar, { ...ar, trick: [] }), IO.sameArtifactBody(ar, { ...ar, spells: [] })], [false, false, false]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
