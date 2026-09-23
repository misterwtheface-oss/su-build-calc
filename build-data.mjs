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
import crypto from 'node:crypto';
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
const OUT_ARTTYPE = path.join(OUT_ASSETS, 'arttypes');
const OUT_GEM = path.join(OUT_ASSETS, 'gems');
const OUT_CARDBG = path.join(OUT_ASSETS, 'cardbg');
const OUT_PERK = path.join(OUT_ASSETS, 'perks');
const OUT_WARDROBE = path.join(OUT_ASSETS, 'wardrobe');
const OUT_MATICON = path.join(OUT_ASSETS, 'maticons');
const OUT_SPELLGEM = path.join(OUT_ASSETS, 'spellgems');
const OUT_PROPGEM = path.join(OUT_ASSETS, 'propgems');
const OUT_REALMICON = path.join(OUT_ASSETS, 'realmicons');
const OUT_REALMOBJ = path.join(OUT_ASSETS, 'realmobjects');
const OUT_GODBATTLE = path.join(OUT_ASSETS, 'godbattle');
const SRC_PROPGEM = path.join(SRC, 'assets', 'spell_gem_property_icons'); // hand-cropped from in-game Enchanter/Materials UI (no named sprite in the dump)

// ── asset provenance registry — permanent preventive guards on everything we ship ──
// Every sprite copy is recorded as (source sprite base) -> (category = output dir). Two invariants
// are enforced before data.js is written (see "asset guards" near the end):
//   • CROSS-USAGE: a source sprite must map to at most ONE category. master_<race> art belongs to
//     the Sigil trait-materials; it must never also be a race icon, etc. (user rule).
//   • 404: every copy must find its source sprite, and every asset path emitted in data.js must
//     resolve to a file on disk. No silent fallbacks — unresolved assets are alerted, not substituted.
const assetUses = new Map();     // source sprite base -> Map(category -> count)
const assetCopy404 = [];         // sources requested but not found on disk
const catOf = (outDir) => path.basename(outDir);
function recordCopy(base, outDir, ok) {
  const category = catOf(outDir);
  if (!assetUses.has(base)) assetUses.set(base, new Map());
  const m = assetUses.get(base); m.set(category, (m.get(category) || 0) + 1);
  if (!ok) assetCopy404.push({ base, category });
}
// copy a named sprite frame from the extract's assets/sprites (<base>_0.png) into outDir/destName
function copyNamedSprite(base, outDir, destName) {
  for (const cand of [`${base}_0.png`, `${base}.png`]) {
    const src = path.join(SRC_SPEC_PNG, cand);
    if (fs.existsSync(src)) { fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(src, path.join(outDir, destName)); recordCopy(base, outDir, true); return true; }
  }
  recordCopy(base, outDir, false); return false;
}
// copy a SPECIFIC frame (<base>_<n>.png) into outDir/destName
function copySpriteFrame(base, n, outDir, destName) {
  const src = path.join(SRC_SPEC_PNG, `${base}_${n}.png`);
  if (fs.existsSync(src)) { fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(src, path.join(outDir, destName)); recordCopy(base, outDir, true); return true; }
  recordCopy(base, outDir, false); return false;
}

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
// raw quote-aware CSV → string[][] (positional; use when headers are blank/duplicated)
function parseCSVRaw(text) {
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
  return rows;
}
function parseCSV(text) {
  const rows = parseCSVRaw(text);
  const header = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const CLASSES = [
  // colors eyedropped directly off the class emblem icons (user-picked for UI legibility)
  { key: 'Nature',  color: '#588F17' },
  { key: 'Chaos',   color: '#8F0202' },
  { key: 'Sorcery', color: '#8747CD' },
  { key: 'Death',   color: '#3E3E69' },
  { key: 'Life',    color: '#F2A908' },
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
// human-facing 2-level tag taxonomy (Category -> Value) + per-trait assignments
const taxonomy = readJSON(path.join(MODEL, 'tag_taxonomy.json'));
const taxoTags = readJSON(path.join(MODEL, 'trait_taxonomy_tags.json')).by_trait;
// "Animatus" (the golem race) isn't in the Related Types vocab, so the classifier snapped
// Animatus-referencing effects to the nearest value "Animation" (a different race). Add Animatus
// so the remap below has a valid target and it's filterable.
{ const rt = taxonomy.categories.find(c => c.category === 'Related Types');
  if (rt && !rt.values.includes('Animatus')) { rt.values.push('Animatus'); rt.values.sort(); } }
// shared per-effect taxonomy corrections (traits / perks / spells all pass through this)
let animatusRetagged = 0, innateTagStripped = 0;
function correctTaxo(taxo, desc) {
  let out = taxo;
  if (out.includes('Related Types::Animation') && /animatus/i.test(desc) && !/\banimation\b/i.test(desc)) {
    out = out.map(k => k === 'Related Types::Animation' ? 'Related Types::Animatus' : k); animatusRetagged++;
  }
  if (out.includes('Related Trait::Innate Trait') && !/innate/i.test(desc)) {
    out = out.filter(k => k !== 'Related Trait::Innate Trait'); innateTagStripped++;
  }
  return [...new Set(out)];
}
// Provenance: the taxonomy pipeline records a `src` per tag — token (game structured markup, exact),
// keyword (word-boundaried domain keyword), field/phrase (structured code fields), llm (per-description
// classification). Emit it as a PARALLEL ARRAY aligned to the entity's final (corrected) `taxo` (so
// taxoSrc[i] explains taxo[i]) — compact vs repeating the "Cat::Val" strings. correctTaxo-added tags
// (no pipeline src) are marked "correction"; anything else falls back to "derived".
function taxoSrcArr(srcArr, finalTaxo) {
  const m = {};
  for (const a of (srcArr || [])) if (a && a.cat) m[a.cat + '::' + a.val] = a.src || 'derived';
  return (finalTaxo || []).map(k => m[k] || 'correction');
}
// material NAME -> granted trait id, inverted from traits_consolidated.source_item (the trait's own
// record names the item that grants it). This is the game's actual link. NOTE: material_stats.trait_id
// is UNRELIABLE — the granted trait is runtime-computed in the game (proven: not a static field in
// scr_DatabaseMaterials), and the positional static extraction drifts by ~1 block. Verified against
// the trait side: "Sigil of the Amaranth" → "Master of Amaranths" (not "…Abominations").
const traitIdByItemName = new Map();
for (const t of consolidated) {
  const si = t.source_item && t.source_item.name;
  if (si && si !== 'N/A' && !traitIdByItemName.has(si)) traitIdByItemName.set(si, t.id);
}
const traits = {};
for (const t of consolidated) {
  const tag = tagByTraitId.get(t.id) || {};
  const cls = (t.source_creature && CLASS_SET.has(t.source_creature.class)) ? t.source_creature.class : null;
  const desc = t.desc || t.effect_prose || '';
  const srcArr = taxoTags[String(t.id)] || [];
  const taxo = correctTaxo(srcArr.map(a => a.cat + '::' + a.val), desc);
  traits[t.id] = {
    id: t.id,
    name: t.name || t.key || `Trait ${t.id}`,
    desc,
    cls,
    produces: tag.produces || [],
    consumes: tag.consumes || [],
    labels: tag.labels || [],
    stats: tag.stats || [],
    taxo,
    taxoSrc: taxoSrcArr(srcArr, taxo),
  };
}

// ── creatures ──────────────────────────────────────────────────────────────
// Spine = creatures_ref: the AUTHORITATIVE playable roster (1362), where EVERY
// creature carries a class/race/base-stats/innate-trait.
// Enrichment comes from TWO code tables joined by name:
//   • creature_data  (capstone) — most-authoritative stats + battle_frame (1027 ref matches)
//   • creature_stats (legacy)   — covers 1358/1362 by name; field0 == the spr_crits_battle frame
// The battle sprite is that frame in spr_crits_battle_<frame>.png (assets/sprites), which exists for
// nearly the whole roster — so we recover the ~330 creatures creature_data's export missed.
const creatureData = readJSON(path.join(MODEL, 'creature_data.json')).records;
const creatureStats = readJSON(path.join(MODEL, 'creature_stats.json')).records;
const creaturesRef = readJSON(path.join(REF, 'creatures_ref.json')).records;
const cdByName = new Map(creatureData.map(c => [norm(c.name), c]));
const csByName = new Map(creatureStats.map(c => [norm(c.name), c]));   // field0 = battle_frame
const SRC_BATTLE = SRC_SPEC_PNG;                                       // assets/sprites/spr_crits_battle_<frame>.png
// user's Creature_REF.csv compendium base stats (name -> {hp,atk,int,def,spd}) — the grounded fill
// for the handful of god/boss creatures whose one stat the static int-setter scan can't recover
// (its value isn't a plain small immediate; see the extractor note). CSV cols: Name,Race,Class then
// the 5 Base Stats in HP,Atk,Int,Def,Spd order (blank headers -> positional parse).
const creatureRefStats = new Map();
{
  const rows = parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Creature_REF.csv'), 'utf8'));
  for (const r of rows.slice(1)) {
    const name = (r[0] || '').trim(); if (!name) continue;
    const num = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) ? n : null; };
    const s = { hp: num(r[3]), atk: num(r[4]), int: num(r[5]), def: num(r[6]), spd: num(r[7]) };
    if (Object.values(s).some(v => v != null)) creatureRefStats.set(norm(name), s);
  }
}
// trait NAME -> id (traits_consolidated) so a ref creature resolves its innate trait id
const traitIdByName = new Map();
for (const t of consolidated) { const k = norm(t.name); if (k && !traitIdByName.has(k)) traitIdByName.set(k, t.id); }

fs.rmSync(OUT_CRIT, { recursive: true, force: true });
fs.mkdirSync(OUT_CRIT, { recursive: true });

// battle-sprite frame overrides for creatures whose roster name is spelled differently in the
// sprite catalog (creature_sprites.json), so the name-join misses (verified frame-by-frame).
const SPRITE_FRAME_OVERRIDE = {
  atlasbeacon: 2941, gloopidator: 1133, elfhuntsman: 1299, phenominalpossum: 3504,
  manticoreconquerer: 1542, maionettecharlatan: 3502, tipsydenizen: 3444,
};

const creatures = [];
let spriteCopied = 0, codeStats = 0, spriteOverrides = 0;
const statFilled = [];   // creatures whose null base stat was filled from Creature_REF.csv
creaturesRef.forEach((r, i) => {
  const id = i;
  const cd = cdByName.get(norm(r.name));                    // capstone twin (best stats + battle_frame)
  const cs = csByName.get(norm(r.name));                    // legacy twin (frame + stats, wider coverage)
  const cls = CLASS_SET.has(r.class) ? r.class
            : (cd && traits[cd.trait_id] && traits[cd.trait_id].cls) || null;
  if (!cls) err(`playable creature "${r.name}" has no class`);

  const bs = r.base_stats || {};
  const stats = cd ? { hp: cd.hp, atk: cd.atk, def: cd.def, int: cd.int, spd: cd.spd, total: cd.stat_total }
    : cs ? { hp: cs.hp, atk: cs.atk, def: cs.def, int: cs.int, spd: cs.spd, total: null }
    : { hp: bs.hp, atk: bs.atk, def: bs.def, int: bs.int, spd: bs.spd, total: bs.total };
  if (cd || cs) codeStats++;
  // grounded null-fill: a few god/boss creatures have exactly one base stat the int-setter scan
  // can't recover (not a plain immediate). Fill it from the user's Creature_REF.csv compendium so
  // sorting/visualisation never sees a null. Recompute total to include the filled value.
  const refStat = creatureRefStats.get(norm(r.name));
  const statPatched = [];
  for (const k of ['hp', 'atk', 'def', 'int', 'spd']) {
    if (stats[k] == null && refStat && refStat[k] != null) { stats[k] = refStat[k]; stats.total = null; statPatched.push(k); }
  }
  if (statPatched.length) statFilled.push(`${r.name} (${statPatched.join(',')})`);
  const nullStats = ['hp', 'atk', 'def', 'int', 'spd'].filter(k => stats[k] == null);
  if (nullStats.length) warn(`creature "${r.name}" still has null base stat(s): ${nullStats.join(',')} (not in Creature_REF.csv)`);
  const total = stats.total != null ? stats.total
    : (stats.hp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.int || 0) + (stats.spd || 0);

  const traitName = (r.trait && r.trait.name) || (cd && cd.trait_name) || null;
  const traitId = (cd && cd.trait_id != null) ? cd.trait_id
    : (traitName ? (traitIdByName.get(norm(traitName)) ?? null) : null);

  // battle sprite — spr_crits_battle frame from the capstone battle_frame, else legacy field0,
  // else a name-mismatch override (roster spelling ≠ sprite-catalog spelling)
  let frame = (cd && cd.battle_frame != null) ? cd.battle_frame : (cs ? cs.field0 : null);
  if ((frame == null || frame === 6969) && SPRITE_FRAME_OVERRIDE[norm(r.name)] != null) {
    frame = SPRITE_FRAME_OVERRIDE[norm(r.name)]; spriteOverrides++;
  }
  let sprite = null;
  if (frame != null && frame !== 6969 /* "no battle sprite" sentinel */) {
    const srcPng = path.join(SRC_BATTLE, `spr_crits_battle_${frame}.png`);
    if (fs.existsSync(srcPng)) {
      const dest = `${String(id).padStart(4, '0')}.png`;
      fs.copyFileSync(srcPng, path.join(OUT_CRIT, dest));
      sprite = `assets/creatures/${dest}`;
      spriteCopied++;
    }
  }
  if (!sprite) warn(`creature "${r.name}" has no battle sprite (frame ${frame})`);

  creatures.push({
    id, name: r.name, race: r.race || null, cls,
    hp: stats.hp, atk: stats.atk, def: stats.def, int: stats.int, spd: stats.spd, total,
    statSource: (cd ? 'code' : cs ? 'code-legacy' : 'community') + (statPatched.length ? '+ref' : ''),
    traitId, traitName,
    sprite,
  });
});

// ── specializations (player slot) — prefer the 32×32 character SKIN, else the 16×16 emblem icon ──
// The `spec_<key>` sprites are tiny 16×16 emblems. The real skins are the 32×32 player-costume sprites
// (`spec_<class>_<spec>_<theme>` / `spec_<spec>_<theme>`) + the animated `TS_SU_Costume_<Spec>` set.
// The extractor left a few specs unlabeled; user-confirmed identities are applied here so they ship.
// (id 43 = Antiquarian, a full 15-perk spec. ids 27/37/38 stay dropped — only 1 perk each, need re-mining.)
const SPEC_LABEL_OVERRIDE = { 43: 'Antiquarian' };
// Challenge specs Royal/Pariah/Deprived: the extractor's scr_PerkGetPerkList membership is broken for
// these (signature perks unassigned/misassigned), so define them from the perk catalog. Each has 2 perks
// (name/desc/cost/icon still resolve by key). Their special mechanics are enforced app-side.
const SPEC_EXTRA = [
  { spec_id: 44, key: 'ROYAL', label: 'Royal',
    playstyle: 'A prestige specialization whose perks let you equip far more Anointments than any other class — up to 20 total.',
    perks: [{ key: 'ROYALTY', name: 'Master of All' }, { key: 'HIGHBORN', name: 'Highborn' }] },
  { spec_id: 45, key: 'PARIAH', label: 'Pariah',
    playstyle: 'A solitary specialization: you may only use 3 creatures at a time.',
    perks: [{ key: 'INTROVERSION', name: 'Introversion' }, { key: 'LIFELONGRESPITE', name: 'Lifelong Respite' }] },
  { spec_id: 46, key: 'DEPRIVED', label: 'Deprived',
    playstyle: 'A minimalist specialization: Fused traits, Relic effects, and Avatar creatures are all unavailable.',
    perks: [{ key: 'TOTALDEPRIVATION', name: 'Total Deprivation' }, { key: 'SIMPLELIFE', name: 'Simple Life' }] },
];
const specRecs = readJSON(path.join(MODEL, 'specializations.json')).records
  .map(s => (s.label ? s : { ...s, label: SPEC_LABEL_OVERRIDE[s.spec_id] || s.label }))
  .filter(s => s.label)
  .concat(SPEC_EXTRA);
const spriteMeta = readJSON(path.join(SRC, 'assets', 'sprite_metadata.json'));
const metaByName = new Map(spriteMeta.map(r => [r.name, r]));
const skin32 = spriteMeta.filter(r => r.name.startsWith('spec_') && r.w === 32).map(r => r.name);
const tsCostumes = spriteMeta.filter(r => r.name.startsWith('TS_SU_Costume_')).map(r => r.name);
const SPEC_KEY_ALIAS = { runeknight: 'deathknight', grovetender: 'grovekeeper' };
function findSpecSprite(label) {
  const keys = [norm(label), SPEC_KEY_ALIAS[norm(label)]].filter(Boolean);
  for (const n of skin32) { const c = norm(n.slice(5)); if (keys.some(k => c.includes(k))) return { base: n, kind: 'skin' }; }
  for (const n of tsCostumes) { if (keys.some(k => norm(n).includes(k))) return { base: n, kind: 'skin' }; }
  if (metaByName.has('spec_' + norm(label))) return { base: 'spec_' + norm(label), kind: 'icon' };
  if (norm(label) === 'sorcerer' && metaByName.has('spec_sorceror')) return { base: 'spec_sorceror', kind: 'icon' };
  return null;
}
fs.rmSync(OUT_SPEC, { recursive: true, force: true });
fs.mkdirSync(OUT_SPEC, { recursive: true });

// perk descriptions (catalog) + cost/ranks (perk_stats) keyed by perk KEY
const catalogPerks = readJSON(path.join(SRC, 'data', 'catalog', 'perks.json'));
const catalogPerkArr = Array.isArray(catalogPerks) ? catalogPerks : (catalogPerks.records || Object.values(catalogPerks));
const perkDescByKey = new Map(catalogPerkArr.map(p => [p.key, p.desc || '']));
const perkStatByKey = new Map(readJSON(path.join(MODEL, 'perk_stats.json')).records.map(p => [p.key, p]));
// perk KEY -> icon sprite name, code-certain from scr_DatabasePerks (see _su_extract/code/extract_perk_icons.py)
const perkIconByKey = new Map(readJSON(path.join(MODEL, 'perk_icons.json')).records.map(p => [p.key, p.icon]));
// full perk catalog (661) gives a clean, globally-unique name↔key map — the authority for resolving the
// user's Perk_REF.csv membership (which is by NAME) back to code keys (needed for icon/desc/stats/taxo).
const perkKeyByName = new Map(), perkNameByKey = new Map();
for (const p of catalogPerkArr) { if (!p.key) continue; perkNameByKey.set(p.key, p.name || p.key);
  if (p.name) { const n = norm(p.name); if (!perkKeyByName.has(n)) perkKeyByName.set(n, p.key); } }
// a few Perk_REF.csv names are misspelled vs the catalog — map them explicitly (verified against catalog)
const PERK_NAME_ALIAS = { sovreignty: 'SOVEREIGNTY', wrath: 'DIVINEWRATH', redeyeflight: 'REDEYEFIGHT' };
const perkKeyForName = (name) => PERK_NAME_ALIAS[norm(name)] || perkKeyByName.get(norm(name)) || null;

// user-provided Perk_REF.csv → (1) per-perk Anointment/Ascension flags AND (2) the authoritative spec→perk
// MEMBERSHIP. The code-derived membership (scr_PerkGetPerkList in specializations.json) leaks perks between
// specs (e.g. Animator wrongly got Defiler's Lingering Sickness / Hopelessness / Impiety), so we drive
// membership from the CSV and only fall back to code membership for specs the CSV doesn't list (Antiquarian).
const perkRef = new Map();          // norm(name)|norm(spec) -> {anoint, asc}
const perkRefByName = new Map();    // norm(name) -> {anoint, asc}  (fuzzy/spec-agnostic fallback)
const csvPerksBySpec = new Map();   // norm(spec) -> [{name, key, anoint, asc, ranks, cost, desc}]
let csvPerkKeyMisses = 0;
{
  const rows = parseCSV(fs.readFileSync(path.join(SRC, 'data', 'reference', '_raw_csv', 'Perk_REF.csv'), 'utf8'));
  for (const r of rows) {
    if (!r.Name) continue;
    const anoint = /yes/i.test(r.Annointment || ''), asc = /yes/i.test(r.Ascension || '');
    perkRef.set(norm(r.Name) + '|' + norm(r.Specialization), { anoint, asc });
    perkRefByName.set(norm(r.Name), { anoint, asc });
    const key = perkKeyForName(r.Name);
    if (!key) { csvPerkKeyMisses++; warn(`Perk_REF perk "${r.Name}" [${r.Specialization}] has no catalog key — icon/taxo will be absent`); }
    const rec = { name: key ? (perkNameByKey.get(key) || r.Name) : r.Name, key: key || ('CSV_' + norm(r.Name).toUpperCase()),
      anoint, asc, ranks: parseInt(r.Ranks, 10) || null, cost: parseInt(r.Cost, 10) || null, desc: r.Description || '' };
    const sk = norm(r.Specialization);
    (csvPerksBySpec.get(sk) || csvPerksBySpec.set(sk, []).get(sk)).push(rec);
  }
}
const SPEC_REF_ALIAS = { grovetender: 'herbalist' };  // display label -> CSV Specialization
function perkFlags(perkName, specLabel) {
  const n = norm(perkName), sp = norm(specLabel), spCsv = SPEC_REF_ALIAS[sp] || sp;
  return perkRef.get(n + '|' + spCsv) || perkRef.get(n + '|' + sp) || perkRefByName.get(n) || null;
}

// 16×16 spec emblem lookup (spec_<slug>) — aliases for internally-renamed/misspelled classes.
// defiler→occultist: the sprite named `spec_occultist` is actually the Defiler crest (user-verified);
// Defiler has no `spec_defiler` sprite, so it previously fell back to its 32×32 skin.
const EMBLEM_ALIAS = { sorcerer: 'sorceror', runeknight: 'deathknight', defiler: 'occultist' };
function findEmblem(label) {
  const slug = norm(label), a = EMBLEM_ALIAS[slug];
  for (const cand of [a, slug].filter(Boolean)) if (metaByName.has(`spec_${cand}`)) return `spec_${cand}`;
  return null;
}

// per-surface taxonomy tags (LLM-classified against the codebook; optional until generated)
const loadTaxoBy = (fname) => { const p = path.join(MODEL, fname); return fs.existsSync(p) ? (readJSON(p).by_key || {}) : {}; };
const spellTaxo = loadTaxoBy('spell_taxonomy_tags.json');
const perkTaxo = loadTaxoBy('perk_taxonomy_tags.json');
const cardTaxo = loadTaxoBy('card_taxonomy_tags.json');     // keyed by card id (LLM-classified)
const relicTaxo = loadTaxoBy('relic_taxonomy_tags.json');   // keyed by relic id (LLM-classified)
const taxoStrs = (arr) => (arr || []).map(a => a.cat + '::' + a.val);
// perk taxo is keyed "spec_id:perk_key" but a perk's tags are intrinsic to the perk — re-key by perk_key
// so membership reassignment (CSV-driven) still finds each perk's tags regardless of which spec now owns it.
const perkTaxoByKey = {};
for (const k in perkTaxo) { const pk = k.slice(k.indexOf(':') + 1); if (!(pk in perkTaxoByKey)) perkTaxoByKey[pk] = perkTaxo[k]; }

// ── False Gods — each specialization is affiliated with one of the 10 False Gods
// (siralimultimate.wiki.gg/wiki/Guilds). A False God is fought as 6 independent
// "creatures" whose battle sprites tile into one massive creature; the composite
// portraits are pre-built by tools/build_falsegods.py into assets/falsegods/<key>.png.
const OUT_FGOD = path.join(OUT_ASSETS, 'falsegods');
const FALSE_GODS = [
  { key: 'THEANCESTOR',   name: 'The Ancestor',      specs: ['Bloodmage', 'Inquisitor', 'Purgatorian'] },
  { key: 'SAINTALTHEA',   name: 'Saint Althea',      specs: ['Cleric', 'Fanatic', 'Paladin', 'Shadowbringer', 'Mermaid'] },
  { key: 'CALIBAN',       name: 'Caliban',           specs: ['Evoker', 'Trickster', 'Demonologist', 'Pariah'] },
  { key: 'NEBODAR',       name: 'Nebodar',           specs: ['Hell Knight', 'Pyromancer', 'Gladiator'] },
  { key: 'LOIDPRIME',     name: 'Loid Prime',        specs: ['Defiler', 'Necromancer', 'Reaver', 'Mime'] },
  { key: 'MINDWURM',      name: 'Mindwurm',          specs: ['Cabalist', 'Dreamshade', 'Sorcerer', 'Graveborn', 'Mesmerist'] },
  { key: 'HYDRANOX',      name: 'Hydranox',          specs: ['Astrologer', 'Animator', 'Doombringer', 'Spellweaver', 'Toxicologist'] },
  { key: 'IMPIMPINGTON',  name: 'Imp Impington',     specs: ['Druid', 'Tribalist', 'Windrunner', 'Deprived', 'Grovetender'] },
  { key: 'JOTUNIR',       name: 'Jotunir',           specs: ['Monk', 'Warden', 'Witch Doctor', 'Brewmaster'] },
  { key: 'LOSTCONSTRUCT', name: 'The Lost Construct', specs: ['Rune Knight', 'Siegemaster', 'Engineer', 'Antiquarian'] },
];
const godBySpec = new Map();       // norm(spec label) -> god key
for (const g of FALSE_GODS) for (const sp of g.specs) godBySpec.set(norm(sp), g.key);

const specs = [];
let specSkins = 0, perkIconsCopied = 0, perkIconsMissing = 0, emblemCount = 0, anointFlagged = 0, perkRefMisses = 0;
let specGodMisses = 0;
for (const s of specRecs) {
  const slug = norm(s.key || s.label);
  const found = findSpecSprite(s.label);
  let sprite = null, spriteKind = null;
  if (found && copyNamedSprite(found.base, OUT_SPEC, `${slug}.png`)) {
    sprite = `assets/specs/${slug}.png`; spriteKind = found.kind;
    if (found.kind === 'skin') specSkins++;
  }
  if (!sprite) err(`specialization "${s.label}" has no sprite`);
  // 16×16 emblem for the selector grid (falls back to the main sprite if none, e.g. Defiler)
  let emblem = sprite;
  const emName = findEmblem(s.label);
  if (emName && copyNamedSprite(emName, OUT_SPEC, `${slug}_emblem.png`)) { emblem = `assets/specs/${slug}_emblem.png`; emblemCount++; }
  // membership: CSV is authoritative; fall back to code-derived membership only for specs the CSV omits
  // (Antiquarian). CSV rows already carry name/key/anoint/asc/ranks/cost; code rows carry key/name only.
  const slugN = norm(s.label);
  const csvMembers = csvPerksBySpec.get(slugN) || csvPerksBySpec.get(SPEC_REF_ALIAS[slugN]);
  const membership = csvMembers
    || (s.perks || []).filter(p => p.key && p.name).map(p => ({ name: p.name, key: p.key, fromCode: true }));
  const perks = membership.filter(p => p.key && p.name).map(p => {   // drop null placeholder perks (e.g. Antiquarian ids 661/663)
    const st = perkStatByKey.get(p.key);
    let icon = null;
    const iconName = perkIconByKey.get(p.key);
    if (iconName && copyNamedSprite(iconName, OUT_PERK, `${p.key}.png`)) { icon = `assets/perks/${p.key}.png`; perkIconsCopied++; }
    else { perkIconsMissing++; }
    // flags: CSV membership carries them directly; code-fallback rows resolve via perkFlags()
    const fl = p.fromCode ? perkFlags(p.name, s.label) : { anoint: p.anoint, asc: p.asc };
    if (fl && (fl.anoint || fl.asc != null)) { if (fl.anoint) anointFlagged++; } else if (p.fromCode) perkRefMisses++;
    const pdesc = perkDescByKey.get(p.key) || p.desc || '';
    const name = perkNameByKey.get(p.key) || p.name;
    const pTaxo = correctTaxo(taxoStrs(perkTaxoByKey[p.key]), pdesc);
    return { key: p.key, name, desc: pdesc,
             cost: st ? st.cost : (p.cost ?? null), ranks: st ? st.ranks : (p.ranks || 1), icon,
             anointment: fl ? !!fl.anoint : false, ascension: fl ? !!fl.asc : false,
             // Antiquarian isn't in Perk_REF.csv → all its perks default to anointment:false, but some are
             // likely anointable in-game. Flag them for validation (Progress.md backlog) so we can revisit.
             anointValidate: /antiquarian/i.test(s.label) || undefined,
             taxo: pTaxo, taxoSrc: taxoSrcArr(perkTaxoByKey[p.key], pTaxo) };
  });
  const falseGod = godBySpec.get(norm(s.label)) || null;
  if (!falseGod) { specGodMisses++; warn(`specialization "${s.label}" has no False God mapping`); }
  specs.push({
    id: s.spec_id, key: s.key || slug.toUpperCase(), label: s.label, sprite, spriteKind, emblem,
    playstyle: s.playstyle || '', description: s.description || '',
    perkCount: perks.length, perks, falseGod,
  });
}

// ── False God output list (only gods that have ≥1 specialization present) + composite check ──
const specGodKeys = new Set(specs.map(s => s.falseGod).filter(Boolean));
const falseGods = [];
let fgodImgMisses = 0;
for (const g of FALSE_GODS) {
  if (!specGodKeys.has(g.key)) continue;
  const rel = `assets/falsegods/${g.key}.png`;
  if (!fs.existsSync(path.join(OUT_FGOD, `${g.key}.png`))) {
    fgodImgMisses++; warn(`False God "${g.name}" composite missing (${rel}) — run tools/build_falsegods.py`);
  }
  falseGods.push({ key: g.key, name: g.name, img: rel });
}

// ── spell-slot grants — perks/traits that grant a creature EXTRA spell-gem slots ──
// (the artifact's own 1 spell slot is separate; those "Spell Slot" texts are excluded by requiring
//  "gains N Spell Slot"). Code path bc_CritGetEmptySpellSlots is opaque GML VM, so ground on the text.
// In practice only Animator's "Gray Matter" grants creature slots (Your Animatus gains <N> Spell Slot(s)).
const SLOT_GRANT_RE = /gains?\s+(?:<(\d+)>|(\d+))\s+spell\s+slot/i;
const raceSet = new Set(creatures.map(c => c.race).filter(Boolean));
const grantTarget = (desc) => {
  const m = desc.match(/\bYour\s+([A-Z][A-Za-z]+)\b/);   // "Your Animatus …" → race/type
  if (!m) return null;
  const w = m[1];
  return raceSet.has(w) ? w : (raceSet.has(w.replace(/s$/, '')) ? w.replace(/s$/, '') : w);
};
const spellSlotGrants = [];
for (const s of specs) for (const p of s.perks) {
  const m = (p.desc || '').match(SLOT_GRANT_RE); if (!m) continue;
  spellSlotGrants.push({ kind: 'perk', specId: s.id, specLabel: s.label, key: p.key, name: p.name, targetRace: grantTarget(p.desc || ''), perRank: +(m[1] || m[2]) });
}
for (const id in traits) {
  const t = traits[id]; const m = (t.desc || '').match(SLOT_GRANT_RE); if (!m) continue;
  spellSlotGrants.push({ kind: 'trait', traitId: t.id, name: t.name, targetRace: grantTarget(t.desc || ''), self: /this creature/i.test(t.desc), perRank: +(m[1] || m[2]) });
}
console.log(`  spell-slot grants: ${spellSlotGrants.length} (${spellSlotGrants.map(g => g.name).join(', ') || 'none'})`);

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
    // "-" placeholders for low ranks carry no % sign — only a REAL numeric value without % means flat
    // (e.g. Spell Gem Slots). Ignoring dashes stops them flipping every property to "flat".
    if (v != null && v !== '-' && pct(v) != null && !String(v).includes('%')) unit = 'flat';
  }
  artGroup[g].push({
    id: `${g}:${i}`,
    property: a.property,
    stat: a.stat_or_status,
    unit,
    perRank,
  });
});
// artifact-type icons for the 5 primary properties — use the HIGHEST tier art available per type
const ART_ICON_SRC = { Helmet: 'helmet_6', Sword: 'sword_6', Staff: 'staff_5', Shield: 'shield_6', Boots: 'boots_5' };
fs.rmSync(OUT_ARTTYPE, { recursive: true, force: true });
for (const p of artGroup.primary) {
  const base = ART_ICON_SRC[p.property];
  const dest = `${norm(p.property)}.png`;
  if (base && copyNamedSprite(base, OUT_ARTTYPE, dest)) p.icon = `assets/arttypes/${dest}`;
  else warn(`artifact type icon missing for ${p.property}`);
}

// ── spells (for the artifact spell slot) — class from spells_ref, class-coloured gem icon ──
const spellCatalog = readJSON(path.join(SRC, 'data', 'catalog', 'spells.json'));
const spellArr = Array.isArray(spellCatalog) ? spellCatalog : (spellCatalog.records || Object.values(spellCatalog));
// name -> class + compendium details (potency/target/source) from the user ref
const spellClassByName = new Map();
const spellRefByName = new Map();
const cleanRef = (v) => { const s = (v == null ? '' : String(v)).trim(); return s && s !== '-' ? s : null; };
{
  const ref = readJSON(path.join(REF, 'spells_ref.json'));
  for (const r of (ref.records || ref)) {
    if (r.name && r.class) spellClassByName.set(norm(r.name), r.class);
    if (r.name) spellRefByName.set(norm(r.name), { potency: cleanRef(r.potency), target: cleanRef(r.target), source: cleanRef(r.source) });
  }
}
// key -> charges from CODE (scr_DatabaseSpells; authoritative — beats the community CSV, e.g. Affliction
// code 14 vs CSV 17, user-verified in-game). 712/741 covered; rest have no code-grounded charge count.
const spellChargesByKey = new Map();
{
  const st = readJSON(path.join(MODEL, 'spell_stats.json'));
  for (const r of (st.records || st)) if (r.key && r.charges != null) spellChargesByKey.set(r.key, r.charges);
}
// fuzzy fallback for ref typos (e.g. "Lucious Lager"/"Ignus Fatuus" vs catalog spelling)
const lev = (a, b) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[m][n]; };
const refClassEntries = [...spellClassByName.entries()];
function spellClass(name) {
  const n = norm(name);
  if (spellClassByName.has(n)) return spellClassByName.get(n);
  let best = null, bd = 3;
  for (const [rn, cls] of refClassEntries) { const dd = lev(n, rn); if (dd < bd) { bd = dd; best = cls; } }
  return best;
}
// per-class spell-gem icons: user-authored gems (assets/sprites/<class>_tier15.png), replacing the wrong gem_*_lvl4 sprites
const GEM_SRC = { Nature: 'nature_tier15', Chaos: 'chaos_tier15', Sorcery: 'sorcery_tier15', Death: 'death_tier15', Life: 'life_tier15' };
fs.rmSync(OUT_SPELLGEM, { recursive: true, force: true });
const spellGems = {};
for (const [cls, base] of Object.entries(GEM_SRC)) {
  const dest = `${norm(cls)}.png`;
  if (copyNamedSprite(base, OUT_SPELLGEM, dest)) spellGems[cls] = `assets/spellgems/${dest}`;
  else warn(`spell-gem icon missing for class ${cls}`);
}
let spellNoClass = 0;
let spellCharged = 0;
const spells = spellArr.map((s, i) => {
  const cls = spellClass(s.name);
  if (!cls) { spellNoClass++; warn(`spell "${s.name}" has no class match in spells_ref`); }
  const ref = spellRefByName.get(norm(s.name)) || {};
  const charges = spellChargesByKey.has(s.key) ? spellChargesByKey.get(s.key) : null;
  if (charges != null) spellCharged++;
  const sTaxo = correctTaxo(taxoStrs(spellTaxo[String(i)]), s.desc || '');
  return { id: i, key: s.key, name: s.name, desc: s.desc || '', cls,
    charges, potency: ref.potency || null, target: ref.target || null, source: ref.source || null,
    taxo: sTaxo, taxoSrc: taxoSrcArr(spellTaxo[String(i)], sTaxo) };
}).filter(s => s.name);
console.log(`  spells: ${spells.length} · ${spellCharged} w/ code charges · ${spells.filter(s => s.potency).length} w/ potency`);
console.log(`  taxonomy fixes: Innate-Trait stripped ${innateTagStripped} · Animatus retagged ${animatusRetagged} (was mis-tagged Animation)`);

// ── trait items (slottable into artifact trait slots) — with material icons ──
const matStats = readJSON(path.join(MODEL, 'material_stats.json'));
const matRecs = Array.isArray(matStats) ? matStats : matStats.records;
const matIconByKey = new Map(readJSON(path.join(MODEL, 'material_icons.json')).records.map(r => [r.key, r.icon]));
fs.rmSync(OUT_MATICON, { recursive: true, force: true });
let matIconCopied = 0, matIconMissing = 0;
const matIcon = (m) => {                                    // copy a material's sprite → assets/maticons, return web path (or null)
  const iconName = matIconByKey.get(m.key);
  if (iconName && copyNamedSprite(iconName, OUT_MATICON, `${iconName}.png`)) { matIconCopied++; return `assets/maticons/${iconName}.png`; }
  matIconMissing++; return null;
};
// item_class discriminates the artifact slot a material enchants:
//   2  → trait material (grants a creature trait)         → Trait slot
//   1  → trick material (Slate/Curio/Crippler/…)          → Trick slot
//   null + trait_id → the 5 strays that ARE trait mats (Thrasher Tooth, Oni Fragment, …) → Trait slot
//   null + no trait_id → Amber                            → Stat slot
const traitItems = [];
for (const m of matRecs) {
  const tid = traitIdByItemName.get(m.name);               // the trait this material grants (game's own link)
  if (tid == null) continue;                               // not a trait-granting material (amber/trick/other)
  if (!traits[tid]) { warn(`trait item "${m.name}" grants trait ${tid} not in traits table`); continue; }
  traitItems.push({ id: m.index, name: m.name, traitId: tid,
    traitName: traits[tid].name, icon: matIcon(m),
    taxo: traits[tid].taxo || [],                          // inherits its granted trait's taxonomy tags
    taxoSrc: traits[tid].taxoSrc || [] });                 // …and its provenance (parallel to taxo)
}

// ── Stat materials (Ambers) → Stat-slot properties ──
// The Amber's boosted stat(s) are encoded in the sprite the game assigns it (dev-authored code):
// dual ambers = amber2_<X>_<Y>_<name> where X,Y ∈ {H,A,D,I,S} (e.g. amber2_H_A_bold → Health/Attack);
// single ambers = amber2_<color> (Red/Purple/Blue/Green/Yellow → the 5 single stats, in the same
// H,A,I,D,S order the dual codes use). This replaces the old by-record-order mapping, which was wrong
// (all 10 dual ambers were shifted — the runtime stat isn't a static DB field to read by position).
const statProps = [...new Set(artGroup.stat.map(p => p.property))];
const STAT_LETTER = { H: 'Health', A: 'Attack', D: 'Defense', I: 'Intelligence', S: 'Speed' };
// USER-CONFIRMED ground truth (Player Resource sheet): Amber name → boosted stat(s).
// The stat is runtime-computed (not a static DB field), so the confirmed name map is the authority;
// icon/colour derivation is kept only as a provenance fallback for any name not in this table.
const AMBER_BY_NAME = {
  'Red Amber': 'Attack',        'Rose Amber': 'Attack / Defense',    'Deep Amber': 'Attack / Intelligence',
  'Glossy Amber': 'Attack / Speed', 'Blue Amber': 'Defense',         'Shiny Amber': 'Defense / Speed',
  'Yellow Amber': 'Health',     'Bold Amber': 'Health / Attack',     'Pale Amber': 'Health / Defense',
  'Smoky Amber': 'Health / Intelligence', 'Bright Amber': 'Health / Speed', 'Purple Amber': 'Intelligence',
  'Murky Amber': 'Intelligence / Defense', 'Sparkling Amber': 'Intelligence / Speed', 'Green Amber': 'Speed',
};
const amberProperty = (m) => {
  if (AMBER_BY_NAME[m.name]) return AMBER_BY_NAME[m.name];              // user-confirmed name → stat
  const icon = matIconByKey.get(m.key) || '';
  const d = /^amber2_([HADIS])_([HADIS])_/.exec(icon);                  // fallback: dual-stat icon code
  if (d) return `${STAT_LETTER[d[1]]} / ${STAT_LETTER[d[2]]}`;
  return null;
};
const statMats = [];
{
  const ambers = matRecs.filter(m => /^amber2_/.test(matIconByKey.get(m.key) || ''));   // by dev icon family
  for (const m of ambers) {
    const property = amberProperty(m);
    if (property && statProps.includes(property)) statMats.push({ id: m.index, name: m.name, key: m.key, property, icon: matIcon(m) });
    else warn(`amber "${m.name}" (${matIconByKey.get(m.key)}) → property "${property}" not a Stat-slot property`);
  }
}

// ── Trick materials (Slates/Curios/Cripplers/generics) → Trick-slot properties (1:1, by name) ──
const trickProps = [...new Set(artGroup.trick.map(p => p.property))];             // 47
const statusToProp = new Map(artGroup.trick.map(p => [p.stat, p.property]));      // status word → "X On Damage"
const TRICK_GENERIC = { 'Pump Drill': 'Spell Gem Slots', 'Slippery Stone': 'Dodge Chance', 'Jagged Rock': 'Critical Chance',
  'Whetstone': 'Attack Damage', 'Armor Scrap': 'Damage Reduction', 'Arcane Sigil': 'Spell Potency' };
const TRICK_NOUN_STATUS = { arcana: 'Arcane', invisibility: 'Invisible', berserking: 'Berserk', mending: 'Mending',
  sheltering: 'Shelled', grace: 'Agile', leeching: 'Leeching', savagery: 'Savage', warding: 'Warded', taunting: 'Taunting',
  protection: 'Protected', splashing: 'Splashing', barriers: 'Barrier', resistance: 'Repelling', defensiveness: 'Defensive',
  proficiency: 'Proficient', immunity: 'Immune', rebirth: 'Rebirth', poisoning: 'Poisoned', burning: 'Burning',
  confusion: 'Confused', freezing: 'Frozen', slumbering: 'Sleep', weakness: 'Weak', cursing: 'Cursed', ensnaring: 'Snared',
  silencing: 'Silenced', blindness: 'Blind', scorning: 'Scorned', bleeding: 'Bleeding', blighting: 'Blighted',
  vulnerability: 'Vulnerable', fearfulness: 'Feared', disarming: 'Disarmed', bombing: 'Bomb', stone: 'Stone' };
const trickToProp = (name) => {
  if (TRICK_GENERIC[name]) return TRICK_GENERIC[name];
  if (/ Crippler$/.test(name)) return `${name.split(' ')[0]} Strength`;
  const m = /^(?:Slate|Curio) of (.+)$/.exec(name);
  if (m) { const st = TRICK_NOUN_STATUS[m[1].toLowerCase()]; if (st) return statusToProp.get(st) || null; }
  return null;
};
const trickMats = [];
for (const m of matRecs) {
  if (m.item_class !== 1) continue;
  const property = trickToProp(m.name);
  if (!property || !trickProps.includes(property)) { warn(`trick-material map: "${m.name}" → no Trick property`); continue; }
  trickMats.push({ id: m.index, name: m.name, key: m.key, property, icon: matIcon(m) });
}
warn(`stat materials: ${statMats.length}/${statProps.length} · trick materials: ${trickMats.length}/${trickProps.length} mapped to properties`);

// localization loader → Map(tag -> English) (parseCSV returns header-keyed objects; use positional values)
function loadLoc(file) {
  const rows = parseCSV(fs.readFileSync(path.join(SRC, 'data', 'localization', file), 'utf8'));
  const m = new Map();
  for (const r of rows) { const v = Object.values(r); if (v[0] && /^L_/.test(v[0])) m.set(v[0], (v[2] || '').trim()); }
  return m;
}
// ── spell-gem enchant items = "Dust" (L_IN_DUST_<gem>); property from L_ID_DUST_<gem>, used at the Enchanter ──
const itemsLoc = loadLoc('items.csv');
const dustIcon = copyNamedSprite('spr_gem_dust', OUT_MATICON, 'spr_gem_dust.png') ? 'assets/maticons/spr_gem_dust.png' : null;
// per-gem property icons: hand-cropped from the in-game Enchanter/Materials UI (these items have no
// named sprite in the dump — the game picks the icon by dust-type index at draw time). Copied here
// keyed by the L_IN_DUST_<GEM> key; gems without a captured icon fall back to the generic dust pile.
fs.rmSync(OUT_PROPGEM, { recursive: true, force: true });
const copyPropGem = (gem, dest) => {
  const src = path.join(SRC_PROPGEM, `${gem}.png`);
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(OUT_PROPGEM, { recursive: true });
  fs.copyFileSync(src, path.join(OUT_PROPGEM, dest));
  return true;
};
// each property gem is a Tier-4 Favor reward sold by exactly one god (God Shop_REF → god_shop_ref.json).
const gemGod = new Map();
for (const r of readJSON(path.join(REF, 'god_shop_ref.json')).records) {
  if ((r.type || '').toLowerCase() === 'crafting material' && /property to a Spell Gem/i.test(r.description || ''))
    gemGod.set((r.item || '').toUpperCase(), r.god);
}
const spellProps = [];
let propGemIcons = 0, propGemGods = 0;
{
  let idx = 0;
  for (const [tag, name] of itemsLoc) {
    if (!/^L_IN_DUST_/.test(tag)) continue;
    const gem = tag.slice('L_IN_DUST_'.length);
    const desc = itemsLoc.get('L_ID_DUST_' + gem) || '';
    // desc = "…add the following property to your Spell Gems:\n\n<PROPERTY>"
    let effect = desc.split(/Spell Gems:/i).pop().replace(/\\n|\n/g, ' ').trim();
    let icon = dustIcon;
    if (copyPropGem(gem, `${gem}.png`)) { icon = `assets/propgems/${gem}.png`; propGemIcons++; }
    const god = gemGod.get(gem) || null;
    if (god) propGemGods++;
    spellProps.push({ id: idx++, key: gem, name, effect, icon, god });
  }
  warn(`spell-gem property icons: ${propGemIcons}/${spellProps.length} captured (rest use generic dust pile)`);
  warn(`spell-gem property gods: ${propGemGods}/${spellProps.length} mapped from god_shop_ref`);
}

// ── relics ──
const relicRef = readJSON(path.join(REF, 'relics_ref.json')).records;
// per-relic icons: sprites are named relicW_<god>_<name>; join relic→god via relic_effects,
// with a fuzzy name-part fallback for the one whose relic_effects name is null (ROBO/r080).
const OUT_RELIC = path.join(OUT_ASSETS, 'relics');
fs.rmSync(OUT_RELIC, { recursive: true, force: true });
const relicEff = readJSON(path.join(MODEL, 'relic_effects.json')).records || readJSON(path.join(MODEL, 'relic_effects.json'));
const relicGodByName = new Map((Array.isArray(relicEff) ? relicEff : []).map(e => [norm(e.relic_name), (e.relic_god || '').toLowerCase()]));
const relicSpriteBases = fs.readdirSync(SRC_SPEC_PNG).filter(f => /^relicW_.+_0\.png$/.test(f)).map(f => f.replace(/_0\.png$/, ''));
const relicByGod = new Map();
for (const b of relicSpriteBases) { const m = b.match(/^relicW_([a-z0-9]+)_/); if (m && !relicByGod.has(m[1])) relicByGod.set(m[1], b); }
let relicIconCopied = 0;
const relics = relicRef.map((r, i) => {
  const g = relicGodByName.get(norm(r.relic));
  let base = g && relicByGod.get(g);
  if (!base) { const rn = norm(r.relic); base = relicSpriteBases.find(b => b.replace(/^relicW_/, '').split('_').some(p => p.length >= 4 && rn.includes(p))); }
  let icon = null;
  if (base && copySpriteFrame(base, 0, OUT_RELIC, `${i}.png`)) { icon = `assets/relics/${i}.png`; relicIconCopied++; }
  const rTaxo = correctTaxo(taxoStrs(relicTaxo[String(i)]), (r.ranks || []).map(x => x.description || '').join(' '));
  return {
    id: i,
    name: r.relic,
    icon,
    statBonus: r.stat_bonus || null,
    ranks: (r.ranks || []).map(x => ({ rank: pct(x.rank), desc: x.description || '' })),
    taxo: rTaxo,
    taxoSrc: taxoSrcArr(relicTaxo[String(i)], rTaxo),
  };
});
console.log(`  relic icons: ${relicIconCopied}/${relics.length} copied`);

// ── cards (realm cards — leveled collection) ──
// each card family maps to a creature race → borrow that creature's sprite + class for the tile.
const critByRace = new Map();
for (const c of creatures) { const k = norm(c.race); if (c.sprite && k && !critByRace.has(k)) critByRace.set(k, c); }
const cardRef = readJSON(path.join(REF, 'cards_ref.json')).records;
let cardArt = 0;
const cards = cardRef.map((c, i) => {
  const rep = critByRace.get(norm(c.family));
  if (rep) cardArt++; else warn(`card family "${c.family}" has no matching creature race for art`);
  const cEffects = [c.unlock_1, c.unlock_2, c.unlock_3].filter(Boolean);
  const cTaxo = correctTaxo(taxoStrs(cardTaxo[String(i)]), cEffects.join(' '));
  return {
    id: i,
    family: c.family,
    cls: rep ? rep.cls : null,
    sprite: rep ? rep.sprite : null,
    tiers: String(c.tiers || '').split('/').map(x => pct(x)).filter(x => x != null),
    effects: cEffects,
    taxo: cTaxo,
    taxoSrc: taxoSrcArr(cardTaxo[String(i)], cTaxo),
  };
});

// class-tinted card backgrounds (card_bg_<class>)
fs.rmSync(OUT_CARDBG, { recursive: true, force: true });
const classBg = {};
for (const cl of CLASSES) {
  const dest = `${norm(cl.key)}.png`;
  if (copyNamedSprite(`card_bg_${norm(cl.key)}`, OUT_CARDBG, dest)) classBg[cl.key] = `assets/cardbg/${dest}`;
}

// ── God Shops reference (per-god favor shops) ─────────────────────────────────
// god_shop_ref.json: flat {god,tier,item,price,type,description}; group per god, sorted by tier.
const godShopRecs = readJSON(path.join(REF, 'god_shop_ref.json'));
const godShopArr = Array.isArray(godShopRecs) ? godShopRecs : (godShopRecs.records || Object.values(godShopRecs));
const godShopMap = new Map();
for (const r of godShopArr) {
  if (!r.god) continue;
  if (!godShopMap.has(r.god)) godShopMap.set(r.god, []);
  godShopMap.get(r.god).push({ tier: parseInt(r.tier, 10) || 0, item: r.item || '', type: r.type || null,
    price: parseInt(r.price, 10) || null, desc: r.description || '' });
}
// god BATTLE sprite (bspr_god_<name-or-theme>) → shown on the realm detail page (in place of the realm icon)
// and in the God Shop. Mapping is hand-curated (theme/arena naming; see _su_extract memory). Keyed by god
// short-name; copied to assets/godbattle/<godSlug>.png. Memoized so realms + shops share one copy.
const GOD_BSPR = {
  'Alexandria': 'alexandria', 'Anneltha': 'anneltha', 'Ariamaki': 'ariamaki', 'Genaros': 'genaros', 'Muse': 'muse',
  'Reclusa': 'reclusa', 'Shallan': 'shallan', "T'Mere M'rgo": 'tmeremrgo', 'Azural': 'snow', 'Friden': 'underwater',
  'Gonfurian': 'war', 'Torun': 'jungle', 'Yseros': 'desert', 'Tenebris': 'void', 'Tartarith': 'dungeon', 'Aurum': 'gem',
  'Aeolian': 'grassland', 'Mortem': 'bloodbone', 'Regalis': 'cave', 'Lister': 'island', '4080': 'robo', 'Vulcanar': 'chaos',
  'Surathli': 'life', 'Apocranox': 'autumn', 'Erebyss': 'death', 'Meraxis': 'nature', 'Perdition': 'purgatory',
  'Venedon': 'reactor', 'Vertraag': 'space', 'Zonte': 'sorcery',
};
fs.rmSync(OUT_GODBATTLE, { recursive: true, force: true });
// case-insensitive lookup (the God Shop spells "T'mere M'rgo" vs the realm's "T'Mere M'rgo")
const GOD_BSPR_CI = Object.fromEntries(Object.entries(GOD_BSPR).map(([k, v]) => [k.toLowerCase(), v]));
const godBattleCache = {};
let godBattleHits = 0;
function godBattleFor(godName) {
  const slug = godName.replace(/[^a-z0-9]/gi, '').toLowerCase();   // lowercase slug → one file per god
  if (slug in godBattleCache) return godBattleCache[slug];
  const sp = GOD_BSPR_CI[godName.toLowerCase()]; let out = null;
  if (sp) {
    if (copyNamedSprite('bspr_god_' + sp, OUT_GODBATTLE, `${slug}.png`)) { godBattleHits++; out = `assets/godbattle/${slug}.png`; }
    else warn(`god battle sprite bspr_god_${sp} missing for "${godName}"`);
  }
  return godBattleCache[slug] = out;
}
const godShops = [...godShopMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  .map(([god, items]) => ({ god, battle: godBattleFor(god), items: items.sort((a, b) => a.tier - b.tier || a.item.localeCompare(b.item)) }));
console.log(`  god shops: ${godShops.length} gods · ${godShopArr.length} items`);

// ── Realms reference ──────────────────────────────────────────────────────────
// realms_ref.json: {god("Name, God of X"), realm, class, godspawn, gemstone, realm_creatures[], other[]}.
// The flat `other` list is section-delimited; parse it into encounters / resources / unique objects
// (each unique object carries 4 Realm-Instability tier thresholds → interaction reward).
const realmRecs = readJSON(path.join(REF, 'realms_ref.json'));
const realmArr = Array.isArray(realmRecs) ? realmRecs : (realmRecs.records || Object.values(realmRecs));
const cleanRealmVal = (v) => { const s = (v == null ? '' : String(v)).trim(); return s && s !== 'N/A' && s !== '-' ? s : null; };
function parseRealmOther(other) {
  const encounters = [], resources = [], uniques = []; let sec = 'enc', cur = null;
  for (const e of other || []) {
    const lbl = (e.label || '').trim(); const val = cleanRealmVal(e.value);
    if (/^Resource\b/i.test(lbl)) { sec = 'res'; continue; }
    if (/^Unique Realm Objects/i.test(lbl)) { sec = 'uniq'; continue; }
    if (/^Realm Creatures/i.test(lbl)) { sec = 'enc'; continue; }
    if (sec === 'uniq') {
      if (/^\d+$/.test(lbl)) { if (cur && val) cur.tiers.push({ at: +lbl, effect: val }); }
      else { const m = lbl.match(/^(.*?)\s*\[(\d+)\]\s*$/); cur = { name: m ? m[1].trim() : lbl, baseCount: m ? +m[2] : null, tiers: [] }; uniques.push(cur); }
    } else if (sec === 'res') { if (val) resources.push({ object: lbl, resource: val }); }
    else { if (val) encounters.push({ name: lbl, value: val }); }
  }
  return { encounters, resources, uniques };
}
// each realm has a canonical ICON sprite; despite the `god_<name>` filename it's the REALM's icon (tied to
// the realm, not a god portrait). Keyed by the realm's god short-name.
fs.rmSync(OUT_REALMICON, { recursive: true, force: true });
let realmIconHits = 0;
const realmIconFor = (godName) => {
  const slug = godName.replace(/[^a-z0-9]/gi, '');
  const base = 'god_' + slug.toLowerCase();
  if (copyNamedSprite(base, OUT_REALMICON, `${slug}.png`)) { realmIconHits++; return `assets/realmicons/${slug}.png`; }
  warn(`realm "${godName}" icon sprite missing (${base})`);
  return null;
};
// Realm breakable-object sprites follow `<realm-acronym>_<object-slug>_0.png`. The acronym is NOT clean
// initials (curated map below, discovered from sprite prefixes + hand-corrected collisions). The object slug
// is usually a word-join of the name; misses are dispositioned via REALM_OBJ_OVERRIDE.
const REALM_ACRONYMS = {
  'Forgotten Lab': 'fl', 'Unsullied Meadows': 'um', 'Damarel': 'dmr', 'Forbidden Depths': 'fdp',
  'Blood Grove': 'bg', 'Land of Breath and Balance': 'lobab', 'Temple of Lies': 'tol', 'Frostbite Cavern': 'fc',
  'Path of the Damned': 'ptd', 'Where the Dead Ships Dwell': 'wdsd', 'Overgrown Temple': 'ot',
  'Kingdom of Heretics': 'kh', 'Faraway Enclave': 'fe', 'The Swamplands': 'swm', "Titan's Wound": 'tw',
  'Astral Gallery': 'ag', 'Sanctum Umbra': 'su', "Gambler's Hive": 'gh', 'Arachnid Nest': 'an',
  'Fae Lands': 'fae', 'Azure Dream': 'ad', 'Amalgam Gardens': 'amg', 'Torture Chamber': 'tc',
  'Bastion of the Void': 'btv', 'Cutthroat Jungle': 'cj', 'Caustic Reactor': 'cr', "Eternity's End": 'ee',
  'Great Pandemonium': 'gpn', 'The Barrens': 'bns', 'Refuge of the Magi': 'rfm',
};
// user-dispositioned outliers. key "<realm>::<object>": string = exact sprite base (e.g. "tol_bigtreasure").
// NOTE: encounter/boss/creature objects DO have sprites (the in-world object that triggers them on
// interaction) — they're slug mismatches, not "no sprite". null is reserved for the rare true no-object row.
const REALM_OBJ_OVERRIDE = {
  'Forgotten Lab::Inactive Automatons': 'fl_robohead', 'Forgotten Lab::Robot Assembly': 'fl_machine',
  'Forgotten Lab::Schematic': 'fl_circuit', 'Forgotten Lab::Weapon Pile': 'fl_weapons',
  'Unsullied Meadows::Gem Pile': 'um_gems', 'Unsullied Meadows::Nomads': 'um_tent',
  'Forbidden Depths::Blue Magnetic Stone': 'fdp_bluemagnet', 'Forbidden Depths::Music Crystal': 'fdp_musiccrystals',
  'Forbidden Depths::Red Magnetic Stone': 'fdp_redmagnet', 'Forbidden Depths::Waspid Hive': 'fdp_bughive',
  'Land of Breath and Balance::Bookshelves': 'lobab_book', 'Land of Breath and Balance::Figurines': 'lobab_horse',
  'Land of Breath and Balance::Left-Tipping Scales': 'lobab_scaleleft', 'Land of Breath and Balance::Right-Tipping Scales': 'lobab_scaleright',
  'Temple of Lies::Giant Gems': 'tol_giantgem', 'Temple of Lies::Large Treasure Chest': 'tol_bigtreasure',
  'Path of the Damned::Death Blossom': 'ptd_flower', 'Path of the Damned::Illuminated Skull Candle': 'ptd_skullcandle',
  'Path of the Damned::Mushroom': 'ptd_mushrooms', 'Path of the Damned::Skull Pile': 'ptd_skulls',
  'Where the Dead Ships Dwell::Doubloons': 'wdsd_doubloon', 'Where the Dead Ships Dwell::Large Treasure Chest': 'wdsd_treasure',
  'Overgrown Temple::Bookshelves': 'ot_bookshelf',
  'Kingdom of Heretics::Bloodstain': 'kh_blood', 'Kingdom of Heretics::Book Shelves': 'kh_books',
  'Kingdom of Heretics::Cache': 'kh_satchel', 'Kingdom of Heretics::Potion Shelves': 'kh_potions',
  'Faraway Enclave::Altar': 'fe_moai', 'Faraway Enclave::Drake Egg': 'fe_eggs',
  'The Swamplands::Im Cave': 'swm_ims',
  "Titan's Wound::Large Treasure Chest": 'tw_bigchest', "Titan's Wound::Zit": 'tw_zits',
  'Astral Gallery::Animation Statue': 'ag_greenstatue', 'Astral Gallery::Large Treasure Chest': 'ag_bigtreasure',
  'Sanctum Umbra::Angel Statue': 'su_statueangel', 'Sanctum Umbra::Demon Statue': 'su_statuedevil',
  'Sanctum Umbra::King Shrine/Statue': 'su_statuemonarch',
  "Gambler's Hive::Large Slot Machine": 'gh_bigslots', "Gambler's Hive::Small Slot Machine": 'gh_smallslots',
  'Fae Lands::Dream Catcher': 'fae_dreamcatch',
  'Azure Dream::Portal Boss': 'ad_plasmaportal', 'Azure Dream::Star': 'ad_starpiece',
  'Amalgam Gardens::Blue Runestone': 'amg_bluerune', 'Amalgam Gardens::Red Runestone': 'amg_redrune',
  "Amalgam Gardens::Eyes of T'mere M'rgo": 'amg_eyeportal', 'Amalgam Gardens::Neon Rose': 'amg_roses',
  'Torture Chamber::Parchment': 'tc_paper', 'Torture Chamber::Torture Device': 'tc_rack',
  'Bastion of the Void::Shadow Locker': 'btv_shadowcage', 'Bastion of the Void::Wisp': 'btv_wisps',
  'Cutthroat Jungle::Orange Fruit Tree': 'cj_treeo', 'Cutthroat Jungle::Pink Fruit Tree': 'cj_treep',
  'Cutthroat Jungle::Yellow Fruit Tree': 'cj_treey',
  'Caustic Reactor::Concoction': 'cr_slime',
  "Eternity's End::Arcane Orb": 'ee_orbarcane', "Eternity's End::Moon Orb": 'ee_orbmoon', "Eternity's End::Sun Orb": 'ee_orbsun',
  'Great Pandemonium::Apocalypse Nest': 'gpn_devilnest', 'Great Pandemonium::Magma Orb': 'gpn_magmaball',
  'Refuge of the Magi::Grimoire Shelves': 'rfm_bookshelf',
  // de-duped: first-word slug collisions resolved to distinct sprites (one sprite per object)
  'Damarel::Giant Gears': 'dmr_biggears', 'Damarel::Pile of Gears': 'dmr_gears',
  "Gambler's Hive::Decks of Cards": 'gh_cards', "Gambler's Hive::Houses of Cards": 'gh_housecards',
  "Gambler's Hive::Portal Boss": 'gh_gamewheel',
  'Arachnid Nest::Spider Eggs': 'an_eggs', 'Arachnid Nest::Spider Shrine': 'an_shrine',
  'Arachnid Nest::Spiderlings': 'an_spider', 'Arachnid Nest::Victim': 'an_webs',
  'Fae Lands::Fae': 'fae_fae', 'Fae Lands::Fae Cache': 'fae_treasure',
  'Fae Lands::Fae Fountain': 'fae_fountain', 'Fae Lands::Mischievous Fae': 'fae_fairy',
  'Cutthroat Jungle::Fruit': 'cj_fruito',
  'Amalgam Gardens::Abandoned Cave': 'amg_chimera',
};
const realmObjSlugs = (name) => { const w = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  return [...new Set([w.join(''), w.slice(0, 2).join(''), w[0], w[w.length - 1]].filter(Boolean))]; };
fs.rmSync(OUT_REALMOBJ, { recursive: true, force: true });
let realmObjHits = 0, realmObjMiss = 0;
function realmObjectSprite(realmName, objName, acr) {
  const key = `${realmName}::${objName}`;
  if (key in REALM_OBJ_OVERRIDE) { const ov = REALM_OBJ_OVERRIDE[key];
    if (!ov) return null;
    if (copyNamedSprite(ov, OUT_REALMOBJ, `${ov}.png`)) { realmObjHits++; return `assets/realmobjects/${ov}.png`; }
    warn(`realm-object override ${key} -> "${ov}" sprite not found`); return null; }
  if (!acr) return null;
  for (const slug of realmObjSlugs(objName)) { const base = `${acr}_${slug}`;
    if (fs.existsSync(path.join(SRC_SPEC_PNG, `${base}_0.png`)) || fs.existsSync(path.join(SRC_SPEC_PNG, `${base}.png`))) {
      if (copyNamedSprite(base, OUT_REALMOBJ, `${base}.png`)) { realmObjHits++; return `assets/realmobjects/${base}.png`; } } }
  realmObjMiss++; return null;
}
const realms = realmArr.map((r, i) => {
  const godFull = (r.god || '').trim();
  const godName = godFull.split(',')[0].trim();               // short name (matches god-shop `god`)
  const rName = r.realm || godName;
  const parsed = parseRealmOther(r.other);
  // drop junk unique-object rows whose name is a placeholder ("N/A", "-", "—", empty)
  parsed.uniques = parsed.uniques.filter(u => cleanRealmVal(u.name));
  const racr = REALM_ACRONYMS[rName] || null;
  parsed.uniques.forEach(u => { u.sprite = realmObjectSprite(rName, u.name, racr); });
  return {
    id: i, god: godFull, godName, realm: r.realm || godName,
    cls: CLASS_SET.has(r.class) ? r.class : null,
    gemstone: cleanRealmVal(r.gemstone), godspawn: cleanRealmVal(r.godspawn),
    icon: realmIconFor(godName), godBattle: godBattleFor(godName),
    creatures: (r.realm_creatures || []).filter(Boolean),
    ...parsed,
  };
});
const shopGods = new Set(godShops.map(g => g.god));
for (const rm of realms) rm.hasShop = shopGods.has(rm.godName);   // cross-link to the God Shop reference
// complex-interaction combination tables (Combination_REF.csv) — 5 realms with a combine-objects puzzle
// (Tarot Cards / Squash / Music Crystal / Fruit / Chemistry Table). Wide layout: 3 cols per realm at [1,4,7,10,13].
{
  const cr = parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Combination_REF.csv'), 'utf8'));
  let comboHits = 0;
  for (const b of [1, 4, 7, 10, 13]) {
    const realmName = (cr[1] && cr[1][b] || '').trim(), title = (cr[2] && cr[2][b] || '').trim();
    if (!realmName) continue;
    const rows = [];
    for (let r = 3; r < cr.length; r++) {
      const combo = (cr[r][b] || '').trim(), result = (cr[r][b + 1] || '').trim();
      if (/can be in any order/i.test(combo)) break;
      if (combo && result) rows.push({ combo, result });
    }
    const rm = realms.find(x => x.realm === realmName);
    if (rm && rows.length) { rm.combinations = { title, note: 'Combinations can be in any order.', rows }; comboHits++; }
    else if (!rm) warn(`Combination_REF realm "${realmName}" not matched to a realm`);
  }
  console.log(`  realm combination tables: ${comboHits}/5 wired`);
}
console.log(`  realms: ${realms.length} · ${realms.reduce((n, r) => n + r.uniques.length, 0)} unique objects · ${realms.filter(r => r.hasShop).length} w/ god shop`);
console.log(`  realm object sprites: ${realmObjHits} matched · ${realmObjMiss} need a slug/override`);

// class + per-race 16×16 emblem icons (shown top-left on each creature tile in place of the class rail)
const OUT_CLSICON = path.join(OUT_ASSETS, 'clsicons');
const OUT_RACEICON = path.join(OUT_ASSETS, 'raceicons');
const raceClassIcons = readJSON(path.join(MODEL, 'race_class_icons.json'));
fs.rmSync(OUT_CLSICON, { recursive: true, force: true });
fs.rmSync(OUT_RACEICON, { recursive: true, force: true });
const classIcons = {};
for (const cl of raceClassIcons.classes) {
  const dest = `${norm(cl.class)}.png`;
  if (copyNamedSprite(cl.icon, OUT_CLSICON, dest)) classIcons[cl.class] = `assets/clsicons/${dest}`;
}
// Race icons are a <=16×16 sprite. Resolution families, in order (NO master_ — that is Sigil
// trait-material art and is caught by the cross-usage guard; NO creature/representative fallback).
// Every match is a NAME-ASSUMPTION (the game resolves race icons at runtime — there is no static
// code map) unless it is user-confirmed in-game. Unresolved races get NO icon and a 404 alert —
// nothing is substituted.
const pngDims = (p) => { try { const b = fs.readFileSync(p); return [b.readUInt32BE(16), b.readUInt32BE(20)]; } catch { return null; } };
const CLASS_PREFIX = { Nature: 'nature', Chaos: 'chaos', Death: 'death', Life: 'life', Sorcery: 'sorcery' };
// verified in-game by user (highest confidence — overrides name resolution)
const RACE_ICON_CONFIRMED = {
  Cherub: 'backer_cherub', Mogwai: 'special_mogwai',
  Guardian: 'race_benthicguardian', 'Sea Shambler': 'shambler', Shadow: 'shadow2', Soulflayer: 'flayer',
  Arbiter: 'backer_arbiter', Gargantuan: 'garg',
  Tanukrook: 'moncrown',   // Monster Crown crossover race — its icon is the "moncrown" crown sprite
};
const is16 = (base) => { for (const c of [`${base}_0.png`, `${base}.png`]) { const p = path.join(SRC_SPEC_PNG, c); if (fs.existsSync(p)) { const d = pngDims(p); return !!d && d[0] <= 16 && d[1] <= 16; } } return false; };
const raceIcons = {};
const raceUnresolved = [];
for (const r of Object.values(raceClassIcons.races)) {
  const nm = norm(r.race), cl = CLASS_PREFIX[r.class] || '';
  // families: user-confirmed → <race> → backer_ → special_ → race_ → <ownClass>_  (no cross-class guessing)
  const candidates = [RACE_ICON_CONFIRMED[r.race], nm, `backer_${nm}`, `special_${nm}`, `race_${nm}`, cl && `${cl}_${nm}`].filter(Boolean);
  const icon = candidates.find(is16);
  if (icon && copyNamedSprite(icon, OUT_RACEICON, `${nm}.png`)) raceIcons[r.race] = `assets/raceicons/${nm}.png`;
  else raceUnresolved.push(r.race);
}
const raceTotal = Object.values(raceClassIcons.races).length;
if (raceUnresolved.length) warn(`404 race icons — no resolved sprite, NO fallback substituted (${raceUnresolved.length}): ${raceUnresolved.join(', ')}`);
// REVISIT LATER: these race icons resolve to a special_ sprite that also serves as that creature's
// trait-item icon (Mogwai→"Mogwai's Sanctuary"/trait "No Sanctuary"; Purrghast→"Purrghast's Emblem"/
// trait "Memoriae"). Confirmed tied to the creature's trait, but whether special_ is the RACE icon or
// only the trait-item icon needs in-game validation (user obtaining the trait items).
const RACE_ICON_REVISIT = ['Mogwai', 'Purrghast'];
warn(`RACE ICONS to revisit — special_ shared with the creature's trait-item; validate race-vs-item in-game: ${RACE_ICON_REVISIT.filter((r) => raceIcons[r]).join(', ')}`);
console.log(`  tile icons: ${Object.keys(classIcons).length}/5 class · ${Object.keys(raceIcons).length}/${raceTotal} race · ${raceUnresolved.length} unresolved (404, no fallback)`);

// Nether-stone icons: the 16 base `cornether_N` shapes (the real nether-stone sprites). In-game these
// are TINTED at draw time by a procedural rule (deterministic from the stone's properties) that we have
// not reversed yet — see the "fuse/nether color generation" backlog. For the planner the shape is chosen
// cosmetically and shown in its base tint. (Previously these wrongly used jewel_* = Carbuncle trait art.)
fs.rmSync(OUT_GEM, { recursive: true, force: true });
const gemIcons = [];
for (let n = 1; n <= 16; n++) {
  const dest = `nether_${n}.png`;
  if (copyNamedSprite(`cornether_${n}`, OUT_GEM, dest)) gemIcons.push({ key: `nether_${n}`, path: `assets/gems/${dest}` });
}
// Nether-stone Main/Outline colour OPTIONS — derived from in-game screenshots by the local
// tools/nether_eyedrop.py (which stays out of git); this JSON accumulates and ships as picker presets.
const NETHER_COLORS_PATH = path.join(ROOT, 'data', 'nether_colors.json');
const netherColors = fs.existsSync(NETHER_COLORS_PATH)
  ? (() => { const j = readJSON(NETHER_COLORS_PATH); return { mains: j.mains || [], outlines: j.outlines || [] }; })()
  : { mains: [], outlines: [] };
console.log(`  nether colour options: ${netherColors.mains.length} mains · ${netherColors.outlines.length} outlines (from screenshots)`);

// ── plain-language term map (labels.json) — turns {TOKEN} params into UI words ──
const labelsMap = readJSON(path.join(SRC, 'labels.json')).labels;
const terms = {};
for (const [k, v] of Object.entries(labelsMap)) terms[k] = (v && v.name) || k;

// ── damage / stat model (for fusion + future DPS sim) ──
const damageModel = readJSON(path.join(MODEL, 'damage_model.json'));

// ── creature-AI Macro vocabulary (targets/conditions/actions) — feeds the Macro Proposal engine.
// Grounded in SiralimUltimate.exe scr_Macro* + L_MACRO_* localization (see _su_extract/code/MACRO_MODEL.md).
const macroVocab = readJSON(path.join(MODEL, 'macro_vocab.json'));

// ── player wardrobe (every equippable player costume; names/tiers pre-resolved in wardrobe.json) ──
// Pull EVERY costume sprite into assets/wardrobe/<sprite>.png; consume the enriched extract artifact.
fs.rmSync(OUT_WARDROBE, { recursive: true, force: true });
fs.mkdirSync(OUT_WARDROBE, { recursive: true });
const wardrobeRecs = readJSON(path.join(MODEL, 'wardrobe.json')).records;
let wardrobeCopied = 0, wardrobeMissing = 0;
const nameSrc = { class_vocab: 0, L_WD: 0, derived: 0 };
const wardrobe = [];
for (const w of wardrobeRecs) {
  const ok = copyNamedSprite(w.sprite, OUT_WARDROBE, `${w.sprite}.png`);
  if (ok) wardrobeCopied++; else { wardrobeMissing++; warn(`wardrobe costume "${w.sprite}" has no PNG`); }
  nameSrc[w.name_source] = (nameSrc[w.name_source] || 0) + 1;
  wardrobe.push({ sprite: w.sprite, key: w.sprite, name: w.name, name_source: w.name_source,
                  spec: w.spec, stem: w.stem, tier: w.tier, variant: w.variant,
                  category: w.category, frames: w.frames, order: w.order,
                  img: ok ? `assets/wardrobe/${w.sprite}.png` : null });
}
// group the THREE canonical tier costumes per specialization (Grovetender -> herbalist tiers, etc.).
// The info panel animates one costume per tier, so the set must be exactly tiers 1/2/3 — NOT the extra
// `_alt`/`_robe`/`_minotaur` variants or legacy `ospr_*` duplicates (those inflated the cycle count and
// mis-attributed the first frame, e.g. Reaver showing 4 cycles). Tier naming is inconsistent across specs:
//   canonical  npc_<stem>_1 / _2 / _3   ·  numbered  npc_<stem>01 / 02 / 03
//   suffix     npc_<stem>   (bare = tier 1) + _2 / _3
// so derive a tier number per record and prefer an explicit tier over a bare-stem fallback.
// User-verified costume corrections (wardrobe.json mis-attributes these). Two anti-patterns:
//  • Many specs' true PLAYER tier-1 is the `_alt` sprite (bare npc_<stem> is the NPC version); the
//    build's variant filter was dropping it, so tier 1 was wrong (or missing, e.g. Inquisitor).
//  • DEFILER & TRIBALIST split their tiers across TWO stem names (user-verified, hard-coded):
//    tier-1 lives under the SPEC name (`npc_defiler_alt` / `npc_tribalist_alt`, wardrobe cat=specialization),
//    but tiers 2/3 live under a MISMATCHED name (`npc_occultist_2/_3` / `npc_shaman_2/_3`, cat=npc — the
//    tiers are correct despite the creature-looking name; the naming is the antipattern). An earlier fix
//    used the bare `npc_occultist`/`npc_shaman` for tier-1 which showed the wrong sprite; the tiers 2/3
//    were already right. So each set = [spec-name tier-1, mismatched-name tier-2, mismatched-name tier-3].
// Each entry lists the tier-1/2/3 sprite stems in order; missing ones are filtered out (e.g. Hell Knight = alt only).
const SPEC_COSTUME_OVERRIDE = {
  'Defiler':     ['npc_defiler_alt', 'npc_occultist_2', 'npc_occultist_3'],
  'Tribalist':   ['npc_tribalist_alt', 'npc_shaman_2', 'npc_shaman_3'],
  'Cabalist':    ['npc_cabalist_alt', 'npc_cabalist_2', 'npc_cabalist_3'],
  'Cleric':      ['npc_cleric_alt', 'npc_cleric_2', 'npc_cleric_3'],
  'Druid':       ['npc_druid_alt', 'npc_druid_2', 'npc_druid_3'],
  'Evoker':      ['npc_evoker_alt', 'npc_evoker_2', 'npc_evoker_3'],
  'Hell Knight': ['npc_hellknight_alt'],
  'Monk':        ['npc_monk_alt', 'npc_monk_2', 'npc_monk_3'],
  'Necromancer': ['npc_necromancer_alt', 'npc_necromancer_2', 'npc_necromancer_3'],
  'Paladin':     ['npc_paladin_alt', 'npc_paladin_2', 'npc_paladin_3'],
  'Reaver':      ['npc_reaver_alt', 'npc_reaver_2', 'npc_reaver_3'],
  'Sorcerer':    ['npc_sorcerer_alt', 'npc_sorcerer_2', 'npc_sorcerer_3'],
  'Trickster':   ['npc_trickster_alt', 'npc_trickster_2', 'npc_trickster_3'],
  'Inquisitor':  ['npc_inquisitor_alt', 'npc_inquisitor_2', 'npc_inquisitor_3'],
};
let specCostumes = 0, specCostumeOverrides = 0;
const isOspr = (sp) => sp.startsWith('ospr_');
for (const s of specs) {
  let chosen;
  const ov = SPEC_COSTUME_OVERRIDE[s.label];
  if (ov) {
    chosen = ov.map((sprite, i) => ({ sprite, tierNum: i + 1, variant: null, order: i, img: `assets/wardrobe/${sprite}.png` }))
      .filter(w => copyNamedSprite(w.sprite, OUT_WARDROBE, `${w.sprite}.png`));   // keep only stems that have a PNG
    if (chosen.length) specCostumeOverrides++;
    else warn(`spec "${s.label}" costume override matched no sprites`);
  } else {
  const recs = wardrobe.filter(w => w.spec === s.label);
  const real = recs.filter(w => !w.variant && !isOspr(w.sprite)).map(w => {
    const t = Number(w.tier);
    let tierNum, explicit;
    if (t === 1 || t === 2 || t === 3) { tierNum = t; explicit = true; }
    else { const m = w.sprite.match(/(\d{1,2})$/); if (m) { tierNum = parseInt(m[1], 10); explicit = true; }
           else { tierNum = 1; explicit = false; } }          // bare npc_<stem> = tier 1
    return { ...w, tierNum, explicit };
  });
  // one costume per tier: prefer an explicit tier over the bare-stem fallback, then the lower sprite order
  const byTier = new Map();
  for (const w of real) {
    const cur = byTier.get(w.tierNum);
    if (!cur || (w.explicit && !cur.explicit) || (w.explicit === cur.explicit && w.order < cur.order)) byTier.set(w.tierNum, w);
  }
  chosen = [1, 2, 3].map(t => byTier.get(t)).filter(Boolean);
  if (!chosen.length) {                                        // data gap: only a variant shipped
    const v = recs.filter(w => w.variant).sort((a, b) => a.order - b.order);
    chosen = v.length ? [{ ...v[0], tierNum: null }] : [];
    if (chosen.length) warn(`spec "${s.label}" has no standard tier costume; using variant "${chosen[0].sprite}"`);
  } else if (chosen.length < 3) {
    warn(`spec "${s.label}" has only ${chosen.length} tier costume(s) in the extract (missing tier ${[1, 2, 3].filter(t => !byTier.get(t)).join('/')})`);
  }
  }
  s.costumes = chosen.map(w => {
    const f0 = `${w.sprite}_0.png`, f1 = `${w.sprite}_1.png`;
    const has0 = copySpriteFrame(w.sprite, 0, OUT_WARDROBE, f0);
    const has1 = copySpriteFrame(w.sprite, 1, OUT_WARDROBE, f1);
    const frames = [has0 ? `assets/wardrobe/${f0}` : w.img, has1 ? `assets/wardrobe/${f1}` : w.img].filter(Boolean);
    return { tier: w.tierNum, sprite: w.sprite, img: w.img, variant: w.variant, frames };
  });
  s.costume = s.costumes.length ? s.costumes[0].img : null;    // primary (tier 1) costume
  s.costumeKey = s.costumes.length ? s.costumes[0].sprite : null;
  if (s.costumes.length) specCostumes++; else warn(`specialization "${s.label}" has no wardrobe costume match`);
}

// ── data-hygiene report ─────────────────────────────────────────────────
const checked = creatures.length + specs.length + artRef.length + traitItems.length + relics.length + cards.length;
console.log('\n── Data hygiene report ──────────────────────────');
console.log(`✓ ${checked} records checked · ${creatures.length} playable creatures (100% classed) · ${codeStats} w/ code stats · ${spriteCopied} w/ sprites (${spriteOverrides} name-override) · ${specs.length} spec sprites`);
if (statFilled.length) console.log(`  base-stat null-fill from Creature_REF.csv: ${statFilled.length} — ${statFilled.join('; ')}`);
console.log(`  cards w/ art ${cardArt}/${cards.length} · artifact-type icons ${artGroup.primary.filter(p => p.icon).length}/5 · gem icons ${gemIcons.length} · class bgs ${Object.keys(classBg).length}`);
console.log(`  spec sprites: ${specSkins} real skins + ${specs.filter(s => s.spriteKind === 'icon').length} emblem icons · ${emblemCount}/${specs.length} 16×16 emblems · terms ${Object.keys(terms).length}`);
  console.log(`  perk icons: ${perkIconsCopied} copied (code-certain from perk_icons.json)${perkIconsMissing ? ` · ${perkIconsMissing} missing` : ' · 100%'}`);
  console.log(`  perk flags (Perk_REF.csv): ${anointFlagged} anointments${perkRefMisses ? ` · ${perkRefMisses} perks not in CSV` : ' · all matched'}`);
  console.log(`  False Gods: ${falseGods.length} with specs · ${specs.length - specGodMisses}/${specs.length} specs mapped${fgodImgMisses ? ` · ${fgodImgMisses} composites MISSING (run tools/build_falsegods.py)` : ' · composites ✓'}`);
  console.log(`  wardrobe: ${wardrobeCopied} player costumes copied (code-certain)${wardrobeMissing ? ` · ${wardrobeMissing} missing` : ''} · ${specCostumes}/${specs.length} specs linked (all tiers) · ${specCostumeOverrides} costume overrides`);
  console.log(`  wardrobe names: ${nameSrc.class_vocab} class-vocab + ${nameSrc.L_WD} L_WD + ${nameSrc.derived} derived (of ${wardrobe.length})`);
  console.log(`  trait-item icons: ${matIconCopied} copied (code-certain from material_icons.json)${matIconMissing ? ` · ${matIconMissing} missing` : ''}`);

// ── ASSET GUARDS (permanent preventive alerts on everything we ship) ──────
// A) CROSS-USAGE: a source sprite must serve at most ONE category. Catches master_<race> art being
//    used as both a Sigil trait-material AND a race icon (mutually-exclusive rule).
// Confirmed-legitimate shared sprites (one real object shown in two surfaces). Everything else that
// appears in >1 category is a real bug (e.g. the jewel_* Carbuncle art wrongly used for nether stones).
const CROSS_USE_OK = new Set([
  'TS_SU_Costume_Mermaid_1',                 // Mermaid spec tier-1 sprite = also its wardrobe costume (confirmed valid)
  'special_mogwai', 'special_purrghast',     // race icon + that creature's trait-item — PROVISIONAL, pending in-game validation
]);
let crossUse = 0;
for (const [base, cats] of assetUses) {
  if (cats.size > 1 && !CROSS_USE_OK.has(base)) { warn(`CROSS-USAGE: sprite '${base}' shipped in ${cats.size} categories (${[...cats.keys()].join(', ')}) — icons must be mutually exclusive; confirm none is a wrong reuse`); crossUse++; }
}
// B) 404 SOURCE: a copy was requested but the source sprite was absent (no silent fallback).
for (const c of assetCopy404) err(`404 source: sprite '${c.base}' not found for category '${c.category}'`);
// C) 404 SHIPPED: every 'assets/…' path that will be emitted must resolve to a file on disk.
let shipped404 = 0;
try {
  const paths = new Set();
  const collect = (v) => { if (typeof v === 'string') { if (/^assets\//.test(v)) paths.add(v); } else if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object') Object.values(v).forEach(collect); };
  collect([creatures, specs, raceIcons, classIcons, classBg, traitItems, statMats, trickMats, relics, cards, gemIcons, spellGems, wardrobe, artGroup]);
  for (const p of paths) if (!fs.existsSync(path.join(ROOT, p))) { if (shipped404 < 40) err(`404 shipped: data.js would reference '${p}' but no file exists`); shipped404++; }
} catch (e) { warn(`asset 404-shipped guard skipped: ${e.message}`); }
console.log(`  asset guards: ${assetUses.size} source sprites · ${crossUse} cross-usage alert(s) · ${assetCopy404.length} 404-source · ${shipped404} 404-shipped`);
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
// Personalities (codex L_CODD_CREATURES_*_PERSONALITIES): each raises one stat's modifier to 40 and lowers
// another's to 20 (neutral = 30). 20 total, grouped by the stat they raise. Applies to BASE stats at every
// level (in-game: Level·BaseStat·mod/100), so vs a neutral build the effect is a level-independent ratio —
// raised ×40/30, lowered ×20/30. The app applies this in baseStats().
const PERSONALITIES = [
  { key: 'lazy', name: 'Lazy', raise: 'hp', lower: 'atk' }, { key: 'apathetic', name: 'Apathetic', raise: 'hp', lower: 'def' },
  { key: 'relaxed', name: 'Relaxed', raise: 'hp', lower: 'spd' }, { key: 'indifferent', name: 'Indifferent', raise: 'hp', lower: 'int' },
  { key: 'reckless', name: 'Reckless', raise: 'atk', lower: 'hp' }, { key: 'brave', name: 'Brave', raise: 'atk', lower: 'def' },
  { key: 'brutal', name: 'Brutal', raise: 'atk', lower: 'int' }, { key: 'daring', name: 'Daring', raise: 'atk', lower: 'spd' },
  { key: 'analytical', name: 'Analytical', raise: 'int', lower: 'hp' }, { key: 'careful', name: 'Careful', raise: 'int', lower: 'atk' },
  { key: 'clever', name: 'Clever', raise: 'int', lower: 'def' }, { key: 'shrewd', name: 'Shrewd', raise: 'int', lower: 'spd' },
  { key: 'selfless', name: 'Selfless', raise: 'def', lower: 'hp' }, { key: 'protective', name: 'Protective', raise: 'def', lower: 'atk' },
  { key: 'gentle', name: 'Gentle', raise: 'def', lower: 'int' }, { key: 'peaceful', name: 'Peaceful', raise: 'def', lower: 'spd' },
  { key: 'nervous', name: 'Nervous', raise: 'spd', lower: 'hp' }, { key: 'bashful', name: 'Bashful', raise: 'spd', lower: 'atk' },
  { key: 'shy', name: 'Shy', raise: 'spd', lower: 'int' }, { key: 'timid', name: 'Timid', raise: 'spd', lower: 'def' },
];

// ── Alternate skins — code-grounded restriction from scr_DatabaseSkins (race- or creature-locked).
// Emit only skins whose restriction TARGET exists in our roster AND whose battle frame is present on disk.
// Unresolved-race skins and broken creature links are dropped (no fallback); missing frames 404-alert.
const OUT_SKIN = path.join(OUT_ASSETS, 'skins');
fs.rmSync(OUT_SKIN, { recursive: true, force: true });
fs.mkdirSync(OUT_SKIN, { recursive: true });
const skinRecs = readJSON(path.join(MODEL, 'skins.json')).records;
const creNameSet = new Set(creatures.map(c => c.name));
const creRaceSet = new Set(creatures.map(c => c.race).filter(Boolean));
const skins = [];
let skinUnresolved = 0, skinFrameMissing = 0;
const skinFrames = new Set();
for (const s of skinRecs) {
  let race = null, creatureName = null;
  if (s.restriction === 'race') {
    if (!s.race || !creRaceSet.has(s.race)) { skinUnresolved++; continue; }         // unresolved / race not in roster
    race = s.race;
  } else if (s.restriction === 'creature') {
    if (!s.locked_creature || !creNameSet.has(s.locked_creature)) { skinUnresolved++; continue; }
    creatureName = s.locked_creature;
  } else { skinUnresolved++; continue; }
  const frame = s.sprite_frame;
  if (frame == null) { skinUnresolved++; continue; }
  const srcPng = path.join(SRC_BATTLE, `spr_crits_battle_${frame}.png`);
  if (!fs.existsSync(srcPng)) { warn(`skin "${s.name}" battle frame ${frame} missing (404-source)`); skinFrameMissing++; continue; }
  if (!skinFrames.has(frame)) { fs.copyFileSync(srcPng, path.join(OUT_SKIN, `${frame}.png`)); skinFrames.add(frame); }
  skins.push({ id: s.skin_id, name: s.name, restriction: s.restriction, race, creature: creatureName, img: `assets/skins/${frame}.png` });
}
console.log(`  skins: ${skins.length} applicable (${skinFrames.size} frames) · ${skinUnresolved} unresolved-skip${skinFrameMissing ? ` · ${skinFrameMissing} frame-missing(404)` : ''}`);

// ── Threats advisor: Realm Properties (instability) + False God Runes ───────────────────────
// Both systems are "enemy modifiers that make a fight harder". A build tool reads the build's
// THEME off its taxonomy tags (Action/Mechanic values), then flags which modifiers directly
// COUNTER that theme so the player can reroll realm properties / skip runes accordingly. Effect
// text is authoritative from the durable extracts (runes.json / realm_properties.json); the
// theme→counter mapping below is authored logic grounded on each modifier's effect wording.
const runesRaw = readJSON(path.join(MODEL, 'runes.json'));
const realmPropsRaw = readJSON(path.join(MODEL, 'realm_properties.json'));

// The build intents we can detect from the Action/Mechanic taxonomy category.
const BUILD_THEMES = [
  { key: 'attack',   label: 'Attack',           tags: ['Action/Mechanic::Attack'] },
  { key: 'cast',     label: 'Cast / Spells',    tags: ['Action/Mechanic::Cast', 'Action/Mechanic::Spell Gems'] },
  { key: 'indirect', label: 'Indirect Damage',  tags: ['Action/Mechanic::Indirect Damage'] },
  { key: 'crit',     label: 'Critical',         tags: ['Action/Mechanic::Critical'] },
  { key: 'buff',     label: 'Buffs',            tags: ['Action/Mechanic::Buff'] },
  { key: 'debuff',   label: 'Debuffs',          tags: ['Action/Mechanic::Debuff'] },
  { key: 'dodge',    label: 'Dodge',            tags: ['Action/Mechanic::Dodge'] },
  { key: 'heal',     label: 'Healing',          tags: ['Action/Mechanic::Healing'] },
  { key: 'minion',   label: 'Minions',          tags: ['Action/Mechanic::Minion'] },
  { key: 'provoke',  label: 'Provoke / Defend', tags: ['Action/Mechanic::Provoke', 'Action/Mechanic::Defend'] },
  { key: 'stats',    label: 'Stat Stacking',    tags: ['Action/Mechanic::Stats'] },
];

// modifier key -> [theme keys it directly counters]. Empty + no counterClass => "generally punishing".
const RUNE_COUNTERS = {
  IMMUNEATTACKS: ['attack'], IMMUNESPELLS: ['cast'], IMMUNEINDIRECT: ['indirect'],
  AVOIDDAMAGE: ['attack', 'cast'], DAMAGECAP: ['attack', 'cast', 'indirect'],
  TAKELESSDAMAGE: ['attack', 'cast', 'indirect'], LOSELESSSTATS: ['debuff'],
};
const REALM_COUNTERS = {
  IMMUNEATTACKS: ['attack'], IMMUNESPELLS: ['cast'], IMMUNEINDIRECTDAMAGE: ['indirect'],
  NOCRIT: ['crit'], NODODGE: ['dodge'], ALWAYSDODGE: ['attack'], NOHEAL: ['heal'],
  NOBUFFS: ['buff'], REDUCEDCHARGES: ['cast'], SEALAFTERCAST: ['cast'], NOSTATGAIN: ['stats'],
  NOSTATLOSS: ['debuff'], NODEFENDPROVOKE: ['provoke'], RESISTDAMAGE: ['attack', 'cast', 'indirect'],
  RESISTDEBUFFS: ['debuff'], REFLECT: ['attack'], DEALLESSDAMAGE: ['attack', 'cast', 'indirect'],
  TAKELESSDAMAGE: ['attack', 'cast', 'indirect'], COPYGEMS: ['cast'],
  LESSATTACK: ['attack'], LESSINTELLIGENCE: ['cast'],
};
const REALM_COUNTER_CLASS = {
  STRONGCLASS_CHAOS: 'chaos', STRONGCLASS_DEATH: 'death', STRONGCLASS_LIFE: 'life',
  STRONGCLASS_NATURE: 'nature', STRONGCLASS_SORCERY: 'sorcery',
};
// pure enemy-composition flavour — not a difficulty spike for/against any build; hidden from the advisor.
const REALM_NEUTRAL = new Set(['FAMILIES', 'RACE']);
// runes.json carries no display name; humanize each key.
const RUNE_NAME = {
  ALWAYSCRIT: 'Always Crit', AVOIDDAMAGE: 'Avoids Damage', DAMAGECAP: 'Damage Cap',
  DAMAGEOVERTIME: 'Damage Over Time', DEBUFFS: 'Mass Debuffs', DOMOREDAMAGE: 'Deals More Damage',
  IMMUNEATTACKS: 'Immune to Attacks', IMMUNEINDIRECT: 'Immune to Indirect', IMMUNESPELLS: 'Immune to Spells',
  LOSELESSSTATS: 'Keeps Its Stats', MOREATTACK: 'More Attack', MOREDEFENSE: 'More Defense',
  MOREHEALTH: 'More Health', MOREINTELLIGENCE: 'More Intelligence', MORESPEED: 'More Speed',
  RANDOMBUFF: 'Mass Buffs', TAKELESSDAMAGE: 'Takes Less Damage', TOPOFTIMELINE: 'Top of Timeline',
};
const runes = runesRaw.runes.map(r => ({
  key: r.key, name: RUNE_NAME[r.key] || r.key, effect: r.effect,
  counters: RUNE_COUNTERS[r.key] || [], counterClass: null,
  general: !RUNE_COUNTERS[r.key],
}));
const realmProps = realmPropsRaw.properties
  .filter(p => !REALM_NEUTRAL.has(p.key))
  .map(p => ({
    key: p.key, name: p.name, effect: p.effect,
    counters: REALM_COUNTERS[p.key] || [], counterClass: REALM_COUNTER_CLASS[p.key] || null,
    general: !(REALM_COUNTERS[p.key] || REALM_COUNTER_CLASS[p.key]),
  }));
// sanity: every authored counter/theme references a real theme key
{
  const themeKeys = new Set(BUILD_THEMES.map(t => t.key));
  for (const m of [...runes, ...realmProps])
    for (const c of m.counters) if (!themeKeys.has(c)) throw new Error(`threats: unknown theme key "${c}" on ${m.key}`);
  console.log(`  threats: ${realmProps.length} realm properties · ${runes.length} runes · ${BUILD_THEMES.length} themes`);
}

const SU_DATA = {
  meta: {
    generated: new Date().toISOString(),
    version: 1,
    counts: { creatures: creatures.length, specs: specs.length, traits: Object.keys(traits).length,
              traitItems: traitItems.length, relics: relics.length, cards: cards.length,
              artifactProps: artRef.length },
  },
  classes: CLASSES,
  classBg,
  classIcons,
  raceIcons,
  creatures,
  specs,
  falseGods,
  spellSlotGrants,
  traits,
  tagLabels,
  taxonomy: { categories: taxonomy.categories, status: taxonomy.status },
  artifact: artGroup,
  traitItems,
  statMats,
  trickMats,
  relics,
  cards,
  gemIcons,
  netherColors,
  terms,
  damageModel,
  macroVocab,                // creature-AI Macro vocabulary → Macro Proposal engine
  wardrobe,
  spells,
  spellGems,
  spellProps,
  personalities: PERSONALITIES,
  runes,                    // False God difficulty runes (18) + authored theme counters
  realmProps,               // Realm-Instability realm properties (56) + authored theme/class counters
  godShops,                 // per-god favor shops (22 gods) — reference
  realms,                   // 30 realms + denizens/resources/instability-tier objects — reference
  buildThemes: BUILD_THEMES,// detectable build intents (Action/Mechanic taxonomy) for the Threats advisor
  skins,                    // alternate creature skins, gated by code-grounded race/creature restriction
  scrollMax: 15,            // creatures consume up to 15 stat scrolls total, each +1 base stat (L_ID_SCROLL_*)
};

fs.writeFileSync(path.join(ROOT, 'data.js'), `// GENERATED by build-data.mjs — do not edit by hand.\nwindow.SU_DATA = ${JSON.stringify(SU_DATA)};\n`);
console.log(`✓ wrote data.js (${(fs.statSync(path.join(ROOT, 'data.js')).size / 1e6).toFixed(2)} MB)`);

// ── cache-bust: stamp index.html's data.js/app.js/styles.css refs with a content hash so a deploy
// never serves a stale cached data.js against freshly-renamed assets (the amethyst→nether_* 404 class).
{
  const idxPath = path.join(ROOT, 'index.html');
  let idx = fs.readFileSync(idxPath, 'utf8');
  for (const file of ['data.js', 'app.js', 'styles.css']) {
    const v = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, file))).digest('hex').slice(0, 8);
    const esc = file.replace('.', '\\.');
    idx = idx.replace(new RegExp(`((?:src|href)=")((?:\\./)?${esc})(?:\\?v=[a-f0-9]+)?(")`, 'g'), `$1$2?v=${v}$3`);
  }
  fs.writeFileSync(idxPath, idx);
  console.log('  cache-bust: stamped index.html (data.js/app.js/styles.css ?v=<hash>)');
}
console.log(`  creatures ${creatures.length} · specs ${specs.length} · traits ${Object.keys(traits).length} · trait-items ${traitItems.length} · relics ${relics.length} · cards ${cards.length}`);
if (warnings.length) console.log(`  (${warnings.length} warnings — recorded, non-fatal; see Progress.md)`);
