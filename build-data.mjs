// build-data.mjs — Siralim Ultimate build calculator data pipeline.
// Reads the sibling _su_extract datamine workspace, joins the code-grounded
// tables into the shipped model, copies only the sprites the SPA uses, runs
// data-hygiene guardrails, and emits data.js (window.SU_DATA).
//
//   node build-data.mjs            # build + warn on soft issues
//   node build-data.mjs --strict   # promote warnings to errors (pre-release pass)
//
// NOTHING from _su_extract is committed except the subset written here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SRC = path.resolve(ROOT, '..', '_su_extract');           // datamine (gitignored, not shipped)
const MODEL = path.join(SRC, 'data', 'model');
const REF = path.join(SRC, 'data', 'reference');
const SRC_CRIT_PNG = path.join(SRC, 'assets', 'creatures_export');
const SRC_SPEC_PNG = path.join(SRC, 'assets', 'sprites');
const OUT_ASSETS = path.join(ROOT, 'assets');
const OUT_CRIT = path.join(OUT_ASSETS, 'creatures');
const OUT_SPEC = path.join(OUT_ASSETS, 'specs');

const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// ── helpers ──────────────────────────────────────────────────────────────
const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pct = (s) => {
  if (s == null) return null;
  const m = String(s).match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};

// Minimal CSV parser (quote-aware) for creatures_export/index.csv.
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c === '\r') { /* skip */ }
    else cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const CLASSES = [
  { key: 'Nature',  color: '#4fae5a' },
  { key: 'Chaos',   color: '#c0392b' },
  { key: 'Sorcery', color: '#3a6ea5' },
  { key: 'Death',   color: '#7d4fae' },
  { key: 'Life',    color: '#d4af37' },
];
const CLASS_SET = new Set(CLASSES.map(c => c.key));

console.log('· reading _su_extract …');

// ── traits (association layer): id -> {name, desc, cls, produces, consumes, labels, stats} ──
const consolidated = readJSON(path.join(MODEL, 'traits_consolidated.json')).records;
const tc = readJSON(path.join(MODEL, 'theorycraft_tags.json'));
const tagLabels = tc.label_map;
const tagByTraitId = new Map();
for (const e of tc.entities) {
  if (e.surface === 'trait') tagByTraitId.set(e.key, e);
}
const traits = {};
for (const t of consolidated) {
  const tag = tagByTraitId.get(t.id) || {};
  const cls = (t.source_creature && CLASS_SET.has(t.source_creature.class)) ? t.source_creature.class : null;
  traits[t.id] = {
    id: t.id,
    name: t.name || t.key || `Trait ${t.id}`,
    desc: t.desc || t.effect_prose || '',
    cls,
    produces: tag.produces || [],
    consumes: tag.consumes || [],
    labels: tag.labels || [],
    stats: tag.stats || [],
  };
}

// ── creatures (spine = code-grounded creature_data.records) ──
const creatureData = readJSON(path.join(MODEL, 'creature_data.json')).records;
const creaturesRef = readJSON(path.join(REF, 'creatures_ref.json')).records;
const refByName = new Map(creaturesRef.map(r => [norm(r.name), r]));
const critIndex = parseCSV(fs.readFileSync(path.join(SRC_CRIT_PNG, 'index.csv'), 'utf8'));
const pngByName = new Map();
const pngByFrame = new Map();
for (const r of critIndex) {
  if (r.battle_png) {
    pngByName.set(norm(r.name), r.battle_png);
    if (r.battle_frame) pngByFrame.set(String(r.battle_frame), r.battle_png);
  }
}

fs.rmSync(OUT_CRIT, { recursive: true, force: true });
fs.mkdirSync(OUT_CRIT, { recursive: true });

const creatures = [];
const seenId = new Set();
let spriteCopied = 0;
creatureData.forEach((c, i) => {
  const id = i;
  if (seenId.has(id)) { err(`duplicate creature id ${id}`); return; }
  seenId.add(id);
  const ref = refByName.get(norm(c.name));
  const cls = ref && CLASS_SET.has(ref.class) ? ref.class
            : (traits[c.trait_id] && traits[c.trait_id].cls) || null;
  const race = (ref && ref.race) || (c.overworld_sprite ? null : null);

  // copy the battle sprite (only the ones we actually reference)
  const png = pngByName.get(norm(c.name)) || pngByFrame.get(String(c.battle_frame));
  let sprite = null;
  if (png && fs.existsSync(path.join(SRC_CRIT_PNG, png))) {
    const dest = `${String(id).padStart(4, '0')}.png`;
    fs.copyFileSync(path.join(SRC_CRIT_PNG, png), path.join(OUT_CRIT, dest));
    sprite = `assets/creatures/${dest}`;
    spriteCopied++;
  } else {
    warn(`creature "${c.name}" (id ${id}) has no battle sprite (frame ${c.battle_frame})`);
  }

  if (c.trait_id != null && !traits[c.trait_id]) {
    warn(`creature "${c.name}" innate trait_id ${c.trait_id} not in traits table`);
  }

  creatures.push({
    id, name: c.name, race, cls,
    hp: c.hp, atk: c.atk, def: c.def, int: c.int, spd: c.spd, total: c.stat_total,
    traitId: c.trait_id ?? null,
    traitName: c.trait_name || (traits[c.trait_id] && traits[c.trait_id].name) || null,
    sprite,
  });
});

// ── specializations (player slot) — join spec_<key> sprite ──
const specRecs = readJSON(path.join(MODEL, 'specializations.json')).records.filter(s => s.label);
// alias map for the few labels whose sprite base differs from the key
const SPEC_ALIAS = {
  SORCERER: 'spec_sorceror',
  RUNEKNIGHT: 'spec_deathknight',            // Rune Knight == renamed Death Knight
  DEFILER: 'spec_death_defiler_plaguemaggots', // only a costume variant ships a sprite
};
const specSpriteFiles = fs.readdirSync(SRC_SPEC_PNG).filter(f => f.startsWith('spec_') && f.endsWith('.png'));
const specBaseSet = new Set(specSpriteFiles.map(f => f.replace(/_\d+\.png$/, '')));
fs.rmSync(OUT_SPEC, { recursive: true, force: true });
fs.mkdirSync(OUT_SPEC, { recursive: true });

const specs = [];
for (const s of specRecs) {
  const slug = norm(s.key || s.label);
  const base = SPEC_ALIAS[s.key] || (specBaseSet.has('spec_' + norm(s.label)) ? 'spec_' + norm(s.label) : null);
  let sprite = null;
  if (base) {
    // pick the lowest frame index that exists
    const file = specSpriteFiles.find(f => f === base + '_0.png') || specSpriteFiles.find(f => f.startsWith(base + '_'));
    if (file && fs.existsSync(path.join(SRC_SPEC_PNG, file))) {
      const dest = `${slug}.png`;
      fs.copyFileSync(path.join(SRC_SPEC_PNG, file), path.join(OUT_SPEC, dest));
      sprite = `assets/specs/${dest}`;
    }
  }
  if (!sprite) err(`specialization "${s.label}" (${s.key}) has no sprite — add to SPEC_ALIAS`);
  specs.push({
    id: s.spec_id, key: s.key || slug.toUpperCase(), label: s.label, sprite,
    playstyle: s.playstyle || '', perkCount: s.perk_count || (s.perks ? s.perks.length : 0),
  });
}

// ── artifacts (container properties) ──
const artRef = readJSON(path.join(REF, 'artifacts_ref.json')).records;
const artGroup = { primary: [], stat: [], trick: [] };
const SLOT_TO_GROUP = { Artifact: 'primary', Stat: 'stat', Trick: 'trick' };
artRef.forEach((a, i) => {
  const g = SLOT_TO_GROUP[a.slot];
  if (!g) { warn(`artifact property "${a.property}" unknown slot "${a.slot}"`); return; }
  const perRank = {};
  let unit = '%';
  for (const [rk, v] of Object.entries(a.per_rank || {})) {
    perRank[rk] = pct(v);
    if (!String(v).includes('%')) unit = 'flat';
  }
  artGroup[g].push({
    id: `${g}:${i}`,
    property: a.property,
    stat: a.stat_or_status,
    unit,
    perRank,
  });
});

// ── trait items (slottable into artifact trait slots) ──
const matStats = readJSON(path.join(MODEL, 'material_stats.json'));
const matRecs = Array.isArray(matStats) ? matStats : matStats.records;
const traitItems = [];
for (const m of matRecs) {
  if (m.trait_id == null) continue;
  if (!traits[m.trait_id]) warn(`trait item "${m.name}" grants trait_id ${m.trait_id} not in traits table`);
  traitItems.push({ id: m.index, name: m.name, traitId: m.trait_id, traitName: m.trait_name || (traits[m.trait_id] && traits[m.trait_id].name) || null });
}

// ── relics ──
const relicRef = readJSON(path.join(REF, 'relics_ref.json')).records;
const relics = relicRef.map((r, i) => ({
  id: i,
  name: r.relic,
  statBonus: r.stat_bonus || null,
  ranks: (r.ranks || []).map(x => ({ rank: pct(x.rank), desc: x.description || '' })),
}));

// ── cards (realm cards — collection toggle) ──
const cardRef = readJSON(path.join(REF, 'cards_ref.json')).records;
const cards = cardRef.map((c, i) => ({
  id: i,
  family: c.family,
  tiers: String(c.tiers || '').split('/').map(x => pct(x)).filter(x => x != null),
  effects: [c.unlock_1, c.unlock_2, c.unlock_3].filter(Boolean),
}));

// ── damage / stat model (for fusion + future DPS sim) ──
const damageModel = readJSON(path.join(MODEL, 'damage_model.json'));

// ── data-hygiene report ─────────────────────────────────────────────────
const checked = creatures.length + specs.length + artRef.length + traitItems.length + relics.length + cards.length;
console.log('\n── Data hygiene report ──────────────────────────');
console.log(`✓ ${checked} records checked · ${spriteCopied}/${creatures.length} creature sprites · ${specs.length} spec sprites`);
if (errors.length) {
  console.log(`✗ ${errors.length} errors:`);
  for (const e of errors.slice(0, 40)) console.log('    ' + e);
  if (errors.length > 40) console.log(`    … +${errors.length - 40} more`);
}
if (warnings.length) {
  const groups = {};
  for (const w of warnings) { const k = w.replace(/"[^"]*"/g, '"…"').replace(/\d+/g, 'N'); (groups[k] ||= []).push(w); }
  console.log(`⚠ ${warnings.length} warnings (${Object.keys(groups).length} kinds):`);
  for (const [k, list] of Object.entries(groups)) console.log(`    ${list.length}× ${list[0]}`);
}
console.log('─────────────────────────────────────────────────');

const effectiveErrors = STRICT ? errors.length + warnings.length : errors.length;
if (effectiveErrors) {
  console.error(`BUILD FAILED: ${errors.length} errors${STRICT ? ` + ${warnings.length} warnings (--strict)` : ''} — data.js left untouched`);
  process.exit(1);
}

// ── emit data.js ─────────────────────────────────────────────────────────
const SU_DATA = {
  meta: {
    generated: new Date().toISOString(),
    version: 1,
    counts: { creatures: creatures.length, specs: specs.length, traits: Object.keys(traits).length,
              traitItems: traitItems.length, relics: relics.length, cards: cards.length,
              artifactProps: artRef.length },
  },
  classes: CLASSES,
  creatures,
  specs,
  traits,
  tagLabels,
  artifact: artGroup,
  traitItems,
  relics,
  cards,
  damageModel,
};

fs.writeFileSync(path.join(ROOT, 'data.js'), `// GENERATED by build-data.mjs — do not edit by hand.\nwindow.SU_DATA = ${JSON.stringify(SU_DATA)};\n`);
console.log(`✓ wrote data.js (${(fs.statSync(path.join(ROOT, 'data.js')).size / 1e6).toFixed(2)} MB)`);
console.log(`  creatures ${creatures.length} · specs ${specs.length} · traits ${Object.keys(traits).length} · trait-items ${traitItems.length} · relics ${relics.length} · cards ${cards.length}`);
if (warnings.length) console.log(`  (${warnings.length} warnings — recorded, non-fatal; see Progress.md)`);
