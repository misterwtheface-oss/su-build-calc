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
const OUT_ARTTYPE = path.join(OUT_ASSETS, 'arttypes');
const OUT_GEM = path.join(OUT_ASSETS, 'gems');
const OUT_CARDBG = path.join(OUT_ASSETS, 'cardbg');
const OUT_PERK = path.join(OUT_ASSETS, 'perks');
const OUT_WARDROBE = path.join(OUT_ASSETS, 'wardrobe');
const OUT_MATICON = path.join(OUT_ASSETS, 'maticons');
const OUT_SPELLGEM = path.join(OUT_ASSETS, 'spellgems');

// copy a named sprite frame from the extract's assets/sprites (<base>_0.png) into outDir/destName
function copyNamedSprite(base, outDir, destName) {
  for (const cand of [`${base}_0.png`, `${base}.png`]) {
    const src = path.join(SRC_SPEC_PNG, cand);
    if (fs.existsSync(src)) { fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(src, path.join(outDir, destName)); return true; }
  }
  return false;
}
// copy a SPECIFIC frame (<base>_<n>.png) into outDir/destName
function copySpriteFrame(base, n, outDir, destName) {
  const src = path.join(SRC_SPEC_PNG, `${base}_${n}.png`);
  if (fs.existsSync(src)) { fs.mkdirSync(outDir, { recursive: true }); fs.copyFileSync(src, path.join(outDir, destName)); return true; }
  return false;
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
// trait NAME -> id (traits_consolidated) so a ref creature resolves its innate trait id
const traitIdByName = new Map();
for (const t of consolidated) { const k = norm(t.name); if (k && !traitIdByName.has(k)) traitIdByName.set(k, t.id); }

fs.rmSync(OUT_CRIT, { recursive: true, force: true });
fs.mkdirSync(OUT_CRIT, { recursive: true });

const creatures = [];
let spriteCopied = 0, codeStats = 0;
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
  const total = stats.total != null ? stats.total
    : (stats.hp || 0) + (stats.atk || 0) + (stats.def || 0) + (stats.int || 0) + (stats.spd || 0);

  const traitName = (r.trait && r.trait.name) || (cd && cd.trait_name) || null;
  const traitId = (cd && cd.trait_id != null) ? cd.trait_id
    : (traitName ? (traitIdByName.get(norm(traitName)) ?? null) : null);

  // battle sprite — spr_crits_battle frame from the capstone battle_frame, else legacy field0
  const frame = (cd && cd.battle_frame != null) ? cd.battle_frame : (cs ? cs.field0 : null);
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
    statSource: cd ? 'code' : cs ? 'code-legacy' : 'community',
    traitId, traitName,
    sprite,
  });
});

// ── specializations (player slot) — prefer the 32×32 character SKIN, else the 16×16 emblem icon ──
// The `spec_<key>` sprites are tiny 16×16 emblems. The real skins are the 32×32 player-costume sprites
// (`spec_<class>_<spec>_<theme>` / `spec_<spec>_<theme>`) + the animated `TS_SU_Costume_<Spec>` set.
const specRecs = readJSON(path.join(MODEL, 'specializations.json')).records.filter(s => s.label);
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

// user-provided Perk_REF.csv → per-perk Anointment / Ascension flags (user-confident source of truth)
const perkRef = new Map();          // norm(name)|norm(spec) -> {anoint, asc}
const perkRefByName = new Map();    // norm(name) -> {anoint, asc}  (fuzzy/spec-agnostic fallback)
{
  const rows = parseCSV(fs.readFileSync(path.join(SRC, 'data', 'reference', '_raw_csv', 'Perk_REF.csv'), 'utf8'));
  for (const r of rows) {
    if (!r.Name) continue;
    const rec = { anoint: /yes/i.test(r.Annointment || ''), asc: /yes/i.test(r.Ascension || '') };
    perkRef.set(norm(r.Name) + '|' + norm(r.Specialization), rec);
    perkRefByName.set(norm(r.Name), rec);
  }
}
const SPEC_REF_ALIAS = { grovetender: 'herbalist' };  // display label -> CSV Specialization
function perkFlags(perkName, specLabel) {
  const n = norm(perkName), sp = norm(specLabel), spCsv = SPEC_REF_ALIAS[sp] || sp;
  return perkRef.get(n + '|' + spCsv) || perkRef.get(n + '|' + sp) || perkRefByName.get(n) || null;
}

// 16×16 spec emblem lookup (spec_<slug>) — aliases for internally-renamed/misspelled classes
const EMBLEM_ALIAS = { sorcerer: 'sorceror', runeknight: 'deathknight' };
function findEmblem(label) {
  const slug = norm(label), a = EMBLEM_ALIAS[slug];
  for (const cand of [a, slug].filter(Boolean)) if (metaByName.has(`spec_${cand}`)) return `spec_${cand}`;
  return null;
}

const specs = [];
let specSkins = 0, perkIconsCopied = 0, perkIconsMissing = 0, emblemCount = 0, anointFlagged = 0, perkRefMisses = 0;
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
  const perks = (s.perks || []).map(p => {
    const st = perkStatByKey.get(p.key);
    let icon = null;
    const iconName = perkIconByKey.get(p.key);
    if (iconName && copyNamedSprite(iconName, OUT_PERK, `${p.key}.png`)) { icon = `assets/perks/${p.key}.png`; perkIconsCopied++; }
    else { perkIconsMissing++; }
    const fl = perkFlags(p.name, s.label);       // Anointment / Ascension from Perk_REF.csv
    if (fl) { if (fl.anoint) anointFlagged++; } else perkRefMisses++;
    return { key: p.key, name: p.name, desc: perkDescByKey.get(p.key) || '',
             cost: st ? st.cost : null, ranks: st ? st.ranks : 1, icon,
             anointment: fl ? fl.anoint : false, ascension: fl ? fl.asc : false };
  });
  specs.push({
    id: s.spec_id, key: s.key || slug.toUpperCase(), label: s.label, sprite, spriteKind, emblem,
    playstyle: s.playstyle || '', description: s.description || '',
    perkCount: perks.length, perks,
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
// name -> class from the user compendium ref
const spellClassByName = new Map();
{
  const ref = readJSON(path.join(REF, 'spells_ref.json'));
  for (const r of (ref.records || ref)) if (r.name && r.class) spellClassByName.set(norm(r.name), r.class);
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
// generic per-class spell-gem icons (verified by pixel colour): gems are colour-coded by class, not per-spell
const GEM_SRC = { Nature: 'gem_nature_lvl4', Chaos: 'gem_chaos_lvl4', Sorcery: 'gem_sorceryB_lvl4', Death: 'gem_sorceryP_lvl4', Life: 'gem_lifeG_lvl4' };
fs.rmSync(OUT_SPELLGEM, { recursive: true, force: true });
const spellGems = {};
for (const [cls, base] of Object.entries(GEM_SRC)) {
  const dest = `${norm(cls)}.png`;
  if (copyNamedSprite(base, OUT_SPELLGEM, dest)) spellGems[cls] = `assets/spellgems/${dest}`;
  else warn(`spell-gem icon missing for class ${cls}`);
}
let spellNoClass = 0;
const spells = spellArr.map((s, i) => {
  const cls = spellClass(s.name);
  if (!cls) { spellNoClass++; warn(`spell "${s.name}" has no class match in spells_ref`); }
  return { id: i, key: s.key, name: s.name, desc: s.desc || '', cls };
}).filter(s => s.name);

// ── trait items (slottable into artifact trait slots) — with material icons ──
const matStats = readJSON(path.join(MODEL, 'material_stats.json'));
const matRecs = Array.isArray(matStats) ? matStats : matStats.records;
const matIconByKey = new Map(readJSON(path.join(MODEL, 'material_icons.json')).records.map(r => [r.key, r.icon]));
fs.rmSync(OUT_MATICON, { recursive: true, force: true });
let matIconCopied = 0, matIconMissing = 0;
const traitItems = [];
for (const m of matRecs) {
  if (m.trait_id == null) continue;
  if (!traits[m.trait_id]) warn(`trait item "${m.name}" grants trait_id ${m.trait_id} not in traits table`);
  let icon = null;
  const iconName = matIconByKey.get(m.key);
  if (iconName && copyNamedSprite(iconName, OUT_MATICON, `${iconName}.png`)) { icon = `assets/maticons/${iconName}.png`; matIconCopied++; }
  else matIconMissing++;
  traitItems.push({ id: m.index, name: m.name, traitId: m.trait_id,
    traitName: m.trait_name || (traits[m.trait_id] && traits[m.trait_id].name) || null, icon });
}

// ── spell-gem property items (Slates / Curios / Cripplers — item_class 1) ──
const spellProps = matRecs.filter(m => m.item_class === 1).map(m => {
  let icon = null;
  const iconName = matIconByKey.get(m.key);
  if (iconName && copyNamedSprite(iconName, OUT_MATICON, `${iconName}.png`)) icon = `assets/maticons/${iconName}.png`;
  return { id: m.index, key: m.key, name: m.name, icon };
});

// ── relics ──
const relicRef = readJSON(path.join(REF, 'relics_ref.json')).records;
const relics = relicRef.map((r, i) => ({
  id: i,
  name: r.relic,
  statBonus: r.stat_bonus || null,
  ranks: (r.ranks || []).map(x => ({ rank: pct(x.rank), desc: x.description || '' })),
}));

// ── cards (realm cards — leveled collection) ──
// each card family maps to a creature race → borrow that creature's sprite + class for the tile.
const critByRace = new Map();
for (const c of creatures) { const k = norm(c.race); if (c.sprite && k && !critByRace.has(k)) critByRace.set(k, c); }
const cardRef = readJSON(path.join(REF, 'cards_ref.json')).records;
let cardArt = 0;
const cards = cardRef.map((c, i) => {
  const rep = critByRace.get(norm(c.family));
  if (rep) cardArt++; else warn(`card family "${c.family}" has no matching creature race for art`);
  return {
    id: i,
    family: c.family,
    cls: rep ? rep.cls : null,
    sprite: rep ? rep.sprite : null,
    tiers: String(c.tiers || '').split('/').map(x => pct(x)).filter(x => x != null),
    effects: [c.unlock_1, c.unlock_2, c.unlock_3].filter(Boolean),
  };
});

// class-tinted card backgrounds (card_bg_<class>)
fs.rmSync(OUT_CARDBG, { recursive: true, force: true });
const classBg = {};
for (const cl of CLASSES) {
  const dest = `${norm(cl.key)}.png`;
  if (copyNamedSprite(`card_bg_${norm(cl.key)}`, OUT_CARDBG, dest)) classBg[cl.key] = `assets/cardbg/${dest}`;
}

// nether-stone gem icons (user randomizes / picks one)
fs.rmSync(OUT_GEM, { recursive: true, force: true });
const GEM_KEYS = ['amethyst', 'bismuth', 'diamond', 'emerald', 'obsidian', 'opal', 'ruby', 'sapphire', 'topaz'];
const gemIcons = [];
for (const g of GEM_KEYS) {
  const dest = `${g}.png`;
  if (copyNamedSprite(`jewel_${g}`, OUT_GEM, dest)) gemIcons.push({ key: g, path: `assets/gems/${dest}` });
}

// ── plain-language term map (labels.json) — turns {TOKEN} params into UI words ──
const labelsMap = readJSON(path.join(SRC, 'labels.json')).labels;
const terms = {};
for (const [k, v] of Object.entries(labelsMap)) terms[k] = (v && v.name) || k;

// ── damage / stat model (for fusion + future DPS sim) ──
const damageModel = readJSON(path.join(MODEL, 'damage_model.json'));

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
// group all tier costumes per specialization (Grovetender -> herbalist tiers, etc.)
// For each tier also copy the two FRONT-facing frames (0,1) so the info panel can animate the costume.
let specCostumes = 0;
for (const s of specs) {
  const mine = wardrobe.filter(w => w.spec === s.label)
    .map(w => ({ ...w, effTier: w.tier || (w.variant ? null : 1) }))   // base (no tier, no variant) = tier 1
    .sort((a, b) => (a.effTier || 9) - (b.effTier || 9) || a.order - b.order);
  s.costumes = mine.map(w => {
    const f0 = `${w.sprite}_0.png`, f1 = `${w.sprite}_1.png`;
    const has0 = copySpriteFrame(w.sprite, 0, OUT_WARDROBE, f0);
    const has1 = copySpriteFrame(w.sprite, 1, OUT_WARDROBE, f1);
    const frames = [has0 ? `assets/wardrobe/${f0}` : w.img, has1 ? `assets/wardrobe/${f1}` : w.img].filter(Boolean);
    return { tier: w.effTier, sprite: w.sprite, img: w.img, variant: w.variant, frames };
  });
  s.costume = mine.length ? mine[0].img : null;       // primary (tier 1) costume
  s.costumeKey = mine.length ? mine[0].sprite : null;
  if (mine.length) specCostumes++; else warn(`specialization "${s.label}" has no wardrobe costume match`);
}

// ── data-hygiene report ─────────────────────────────────────────────────
const checked = creatures.length + specs.length + artRef.length + traitItems.length + relics.length + cards.length;
console.log('\n── Data hygiene report ──────────────────────────');
console.log(`✓ ${checked} records checked · ${creatures.length} playable creatures (100% classed) · ${codeStats} w/ code stats · ${spriteCopied} w/ sprites · ${specs.length} spec sprites`);
console.log(`  cards w/ art ${cardArt}/${cards.length} · artifact-type icons ${artGroup.primary.filter(p => p.icon).length}/5 · gem icons ${gemIcons.length} · class bgs ${Object.keys(classBg).length}`);
console.log(`  spec sprites: ${specSkins} real skins + ${specs.filter(s => s.spriteKind === 'icon').length} emblem icons · ${emblemCount}/${specs.length} 16×16 emblems · terms ${Object.keys(terms).length}`);
  console.log(`  perk icons: ${perkIconsCopied} copied (code-certain from perk_icons.json)${perkIconsMissing ? ` · ${perkIconsMissing} missing` : ' · 100%'}`);
  console.log(`  perk flags (Perk_REF.csv): ${anointFlagged} anointments${perkRefMisses ? ` · ${perkRefMisses} perks not in CSV` : ' · all matched'}`);
  console.log(`  wardrobe: ${wardrobeCopied} player costumes copied (code-certain)${wardrobeMissing ? ` · ${wardrobeMissing} missing` : ''} · ${specCostumes}/${specs.length} specs linked (all tiers)`);
  console.log(`  wardrobe names: ${nameSrc.class_vocab} class-vocab + ${nameSrc.L_WD} L_WD + ${nameSrc.derived} derived (of ${wardrobe.length})`);
  console.log(`  trait-item icons: ${matIconCopied} copied (code-certain from material_icons.json)${matIconMissing ? ` · ${matIconMissing} missing` : ''}`);
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
  classBg,
  creatures,
  specs,
  traits,
  tagLabels,
  artifact: artGroup,
  traitItems,
  relics,
  cards,
  gemIcons,
  terms,
  damageModel,
  wardrobe,
  spells,
  spellGems,
  spellProps,
};

fs.writeFileSync(path.join(ROOT, 'data.js'), `// GENERATED by build-data.mjs — do not edit by hand.\nwindow.SU_DATA = ${JSON.stringify(SU_DATA)};\n`);
console.log(`✓ wrote data.js (${(fs.statSync(path.join(ROOT, 'data.js')).size / 1e6).toFixed(2)} MB)`);
console.log(`  creatures ${creatures.length} · specs ${specs.length} · traits ${Object.keys(traits).length} · trait-items ${traitItems.length} · relics ${relics.length} · cards ${cards.length}`);
if (warnings.length) console.log(`  (${warnings.length} warnings — recorded, non-fatal; see Progress.md)`);
