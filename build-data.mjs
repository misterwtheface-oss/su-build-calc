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
import { stampCache } from './tools/stamp-cache.mjs';
import { triggerScope, setRaces } from './tools/trigger-scope.mjs';
import { makeTaxoV2 } from './tools/taxo-v2.mjs';

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
const OUT_CONDICON = path.join(OUT_ASSETS, 'condicons');

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
// TRUE-ID layer (extract: trait_runtime_groups / false_god_parts_true / passive_owners_true). The legacy `id` stays the
// shipped trait id; each trait also carries `runtimeIds` = the game's real passive id(s) for it (same-named
// parts/tiers are distinct runtime ids but ONE shipped trait, e.g. 5x Head of Hydranox).
const RT_GROUPS = readJSON(path.join(MODEL, 'trait_runtime_groups.json')).groups;      // legacy id -> [runtime ids]
const FG_TRUE = readJSON(path.join(MODEL, 'false_god_parts_true.json')).gods;           // False God -> part instances (runtime id each)
const OWN_TRUE = readJSON(path.join(MODEL, 'passive_owners_true.json')).records;        // runtime id -> owner (creature DB / key-sibling)
// Trait reconciliation (code/CSV/wiki + owner tags). Traits NOT present in live Ultimate are EXCLUDED from
// the app entirely: UNRESOLVED (sandbox-unreleased / undetermined) + Not Yet Implemented (code desc "NYI") +
// legacy (prior-Siralim, deliberately not implemented). Resolved live traits carry status/provenance + boss tags.
const TRAIT_BLACKLIST = new Set(['UNRECONCILED', 'Not Yet Implemented', 'legacy']);
const RECON = readJSON(path.join(MODEL, 'trait_reconciliation.json'));
const reconById = new Map(RECON.records.map(r => [r.id, r]));
// Exclude blacklisted statuses (unresolved/NYI/legacy — not in live Ultimate). The reconciliation now
// covers the full traits_consolidated NAMED universe, so the only not-in-reconciliation trait is the lone
// unnamed key-only fragment (EMBEROFVULCANAR) — also excluded (not a proper live trait).
const excludedTraitIds = new Set(consolidated
  .filter(t => { const r = reconById.get(t.id); return !r || TRAIT_BLACKLIST.has(r.status); })
  .map(t => t.id));
// DUPLICATE trait ids (category "duplicate" — NOT "legacy"). Three brand-new backer-paid races
// (Marionette/Elementasaur/Mireling) each have TWO trait entries under the same display name: the
// current live trait on the `MASTER_<RACE>` key + an unused near-duplicate on the old `MASTEROF<RACE>S`
// key (differing desc/code_effects — likely a testing leftover). In-game (user-verified) the live
// trait is the higher id in each pair, so we drop the lower `MASTEROF…` ids. Labeled "duplicate"
// because we lack context on WHY they're duplicated — they are NOT prior-Siralim legacy.
//   keep #2179 drop #1998 (Marionette) · keep #2183 drop #1996 (Elementasaur) · keep #2184 drop #1997 (Mireling)
const DUPLICATE_TRAIT_IDS = new Set([1996, 1997, 1998]);
for (const id of DUPLICATE_TRAIT_IDS) excludedTraitIds.add(id);
// NETHER-BOSS DUPLICATE COPIES. Every Ultimate Nether Boss has exactly 3 same-named trait tiers
// (escalating difficulty). Some bosses carry 4–5 copies — extra duplicates: empty-prose stubs + stale
// lower-id versions whose prose does NOT match the current wiki (verified: e.g. Kiichi's live tier-1
// "Enemies always have Bleeding…" is #1233, not the older #1200; same for Nerlyx/Myrtle/Giran/Vitja/
// Etta/Tellur/Loid/Flubris). Rule: per >3-copy boss, drop empty-prose + keep the 3 highest-id non-empty
// (the canonical tier triple); ≤3-copy bosses (e.g. Kraynaks) untouched. Flubris keeps its 2 entries
// (#1323/#1324) — its tier-3 reuses tier-2's prose (difference = an all-Flubrises battle setup, not text),
// an antipattern but VALID, so no separate tier-3 entry exists in the data.
const NETHER_DUP_TRAIT_IDS = new Set([543, 544, 545, 546, 548, 549, 550, 551, 552, 553, 586, 587, 588, 589, 590, 591, 592, 593, 594, 595, 877, 878, 879, 880, 881, 882, 883, 884, 885, 886, 906, 907, 908, 909, 910, 911, 912, 913, 914, 915, 1200, 1201, 1202, 1203, 1204, 1205, 1206, 1208, 1209, 1210, 1211, 1212, 1214, 1215, 1216]);   // 1215 "Who Am I?" = a Kraynaks outlier duplicate (short-name extra)
for (const id of NETHER_DUP_TRAIT_IDS) excludedTraitIds.add(id);
// UNRESOLVED — factually unresolvable traits (category "unresolved"). These 17 carry recon
// status="boss" but have NULL owner AND NULL item, and appear in NONE of the authoritative sources:
// not the roster (no innate creature), not the Nether Bosses / Gate of the Gods (Deities) / False Gods
// wiki, not Trait_REF.csv (no item/encounter), and not code (creature_stats has no trait field). A trait
// with neither an owner nor an item has no provenance at all → unresolved (per user rule 2026-09-24).
// Re-derive on a game update; if a future source (e.g. Pandemonium/other-boss page) names one, resolve it.
// (Empty — the whole tail is now classified: #1215 → duplicate, #898 → NYI, everything else owned/legacy/NYI.)
const UNRESOLVED_OWNERLESS_IDS = new Set([]);
for (const id of UNRESOLVED_OWNERLESS_IDS) excludedTraitIds.add(id);
// LEGACY — Siralim-3 carryover content, present in the extract but not in live Ultimate (user-confirmed).
//   • Itherian Artifact trait set (contiguous 812–869) — the artifact-power / condition-synergy / Core sets.
//   • Multiply (Failed Experiment's innate — a S3 legacy creature) · Crucifixion #554/#596 + Crucify Me
//     ("Misery" boss, S3) · Betrayer of the Code (The Unguided boss, S3).
//   • Mage Perks (S3): Nighttaker/Daybreaker/Death's Edge/Damnation's Edge. · Boss-innate (S3): Hearty/
//     Very Hearty ×2, Betrayer/Deceiver/Ascension ×2. · Corrupted God fights (S3): Corrupted God/GET/Trait
//     Disabled. · Nether-Boss-innate (S3): Torn Betwixt and Asunder, Boneyard and Sacrilege, Nasty Surprise!,
//     Better to Receive, Maximum Hydration, Undead Army ×2, Eager Recruit, Delusion, Vext's Grace.
// Only UNRESOLVED ids flagged — none matches a resolved trait (guardrail verified), so no live trait flips.
const LEGACY_TRAIT_IDS = new Set([...Array.from({ length: 869 - 812 + 1 }, (_, i) => 812 + i), 538, 554, 555, 562, 596,
  870, 871, 872, 873, 875, 876, 887, 888, 889, 901, 902, 903, 904, 905, 916, 917, 918, 950, 951, 965, 969, 970, 981, 988, 989, 1009, 1010, 1023]);
// (#969 Inner Demons = a Siralim-3 Nether Boss trait — user-confirmed.)
for (const id of LEGACY_TRAIT_IDS) excludedTraitIds.add(id);
// NYI (non-sandbox) — staged/cut upcoming content not accessible in live (user-confirmed): Anathema, Poison
// Bath, The Wishing Stick, Sorcerous Statue, Thunder God's Wrath; Stolen by Damnation's Edge = a cut early
// Animator feature (likely never shipping). Kept out like the other NYI.
const NYI_OTHER_TRAIT_IDS = new Set([898, 1197, 1198, 1199, 1207, 2073, 2173]);   // 898 Pandemonium Unfairness = NYI (Pandemonium shrine fight)
for (const id of NYI_OTHER_TRAIT_IDS) excludedTraitIds.add(id);
// NYI — SANDBOX/STAGED content. User-confirmed list of traits found in the game's sandbox ~1 year ago
// that are NOT accessible yet (staged for upcoming content), plus the 12 Zodiac "Sign of <sign>" traits.
// These fail our recon parameters (no live owner / item) precisely because they aren't live yet — so they
// carry the NYI flag (kept out of the app), NOT "unresolved". Provenance: user (in-sandbox observation).
//   sandbox set: Acclimation · Brain/Hand/Heart of Misery · Breathe Underwater · Collapsed Dream ·
//   Damaos' Dishonesty/Treason/Subversion · Hebron's Deceit/Trickery/Hypocrisy/Artifice · Leap of Faith ·
//   Reap Destruction · Serenade of Guilt · Siralim's Ascendance/Attunement/Prayer · Syndrome · Ultima
//   + Zodiac (Sign of Aquarius…Virgo). (Failed Experiment is a Siralim-3 LEGACY creature — no trait record.)
const NYI_SANDBOX_TRAIT_IDS = new Set([563, 564, 568, 569, 570, 711, 919, 920, 921, 922, 947, 948, 949, 952,
  959, 960, 961, 962, 963, 964, 1175, 1176, 1177, 1178, 1179, 1180, 1181, 1182, 1183, 1184, 1185, 1186, 1187]);
for (const id of NYI_SANDBOX_TRAIT_IDS) excludedTraitIds.add(id);
// MANUAL owner reconciliation. "Lord Zantai" is NOT a separate creature — he's the roster creature
// **Zantai** in its ENCOUNTER form (same creature, different trait: player form = Quadhits #298; encounter
// form = "The Ultimate Strategy" #1538). The creature is code-present (roster); the wiki
// (siralimultimate.wiki.gg/wiki/Lord_Zantai) only MAPS the encounter trait to it. So #1538 is owned by
// Zantai, ownerForm=encounter. His Jewel of Zantai drops stay item-only (via itemSource).
const MANUAL_TRAIT_OWNERS = new Map([
  // Hand / Heart / Brain of Misery — NOT a False God (2026-10-11): the code has no Misery False God (no L_WBOSS_MISERY, no
  // worldboss_ icon, no case in scr_FalseGodName 0-9). PROVISIONAL owner = Perdition's Gate of the Gods (Deity) fight, pending
  // the user's in-game test (challenge Perdition). Stays nyi:true (hidden unless FEATURES.nyi) until the test confirms it.
  [568, { owner: 'Perdition', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Deity', ownerGroup: 'Perdition', ownerProvenance: 'user-pending', nyi: true }],
  [569, { owner: 'Perdition', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Deity', ownerGroup: 'Perdition', ownerProvenance: 'user-pending', nyi: true }],
  [570, { owner: 'Perdition', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Deity', ownerGroup: 'Perdition', ownerProvenance: 'user-pending', nyi: true }],
  [1538,{ owner: 'Zantai', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Lord Zantai', ownerProvenance: 'wiki' }],
  // Guided by Darkness = Erebyss's CURRENT Deity (encounter) trait — patch 2.0.17 (2025-05-24) changed it
  // FROM "Absence of Light" (which is now just Fog Spirit's creature trait #797). This fills Erebyss's
  // previously-empty Deity slot; her Avatar/player trait (#609 Avenged Sevenfold) is unchanged.
  [668, { owner: 'Erebyss', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Deity', ownerGroup: 'Erebyss', ownerProvenance: 'wiki' }],
  // Special/story bosses outside the 3 wiki categories (user-confirmed, live):
  // Treasure Golem 2.0 (Nether Realm boss — Cutthroat Jungle / Forgotten Lab) — its innate is Torun's
  // Blessing; drops Treasure Golem's Core/Plate/Teddy Bear materials + the 2.0 skin. The creature "Treasure
  // Golem" is in the roster (player form); this is its encounter form.
  [1521, { owner: 'Treasure Golem', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Treasure Golem 2.0', ownerProvenance: 'user' }],
  // Imp Impington Prime — a STORY-only boss, distinct from the "Imp Impington Reborn" False God and the
  // "Imp Impington" Nether Boss; Boon of the Hee Hoo Hay Ho is its innate.
  [1213, { owner: 'Imp Impington Prime', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Imp Impington Prime', ownerProvenance: 'user' }],
  // Caliban STORY encounter (distinct from Caliban the Deity / the False God): these 5 are its fight traits.
  [1217, { owner: 'Caliban', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Caliban (story)', ownerProvenance: 'user' }],
  [1218, { owner: 'Caliban', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Caliban (story)', ownerProvenance: 'user' }],
  [1219, { owner: 'Caliban', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Caliban (story)', ownerProvenance: 'user' }],
  [1227, { owner: 'Caliban', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Caliban (story)', ownerProvenance: 'user' }],
  [1231, { owner: 'Caliban', ownerType: 'boss', ownerForm: 'encounter', ownerCategory: 'Special Boss', ownerGroup: 'Caliban (story)', ownerProvenance: 'user' }],
]);
for (const id of MANUAL_TRAIT_OWNERS.keys()) excludedTraitIds.delete(id);   // ship these despite their raw status
const tc = readJSON(path.join(MODEL, 'theorycraft_tags.json'));
const tagLabels = tc.label_map;
const tagByTraitId = new Map();
for (const e of tc.entities) {
  if (e.surface === 'trait') tagByTraitId.set(e.key, e);
}
// human-facing 2-level tag taxonomy (Category -> Value) + per-trait assignments
const taxonomy = readJSON(path.join(MODEL, 'tag_taxonomy.json'));
// tags whose code_taxo proposals are pre-approved via the damage-definition ledgers (user rulings 2026-10-04)
const PREAPPROVED_TAGS = new Set(['Multiplied by::Critical Count', 'Multiplied by::Dodge Count', 'Multiplied by::Missing Creature Count', 'Active If::Creatures Missing', 'Affect on Traits::Gain a Perk', 'Activates When::Ally Loses Buff/Debuff', 'Activates When::Enemy Loses Buff/Debuff', 'Action/Mechanic::Damage', 'Activates When::Ally Deals Damage', 'Activates When::Enemy Deals Damage', 'Affect on Life::Creature is Damaged', 'Related Spells::Damaging Spells']);
// Action/Mechanic::Damage (user ruling 2026-10-04): damage where the code does NOT make Attack or Spell/Cast explicit
// (generic damage handler gates, DoT, damage effects). Replaces the old Attack+Cast pair used to mean "any damage".
{ const am = taxonomy.categories.find(c => c.category === 'Action/Mechanic'); if (am && !am.values.includes('Damage')) am.values.push('Damage'); }
// Affect on Spells::Count as Manual (user 2026-10-18): an automatic cast counts as manually cast for "manually cast"
// effects (code: the traits/perk that clear bc_CreatureCast arg3 — _su_extract code/ARTIFACTS.md §3). Members are user-approved
// in data/reference/code_taxo_approved.json (Superfluidity, The Great Beyond, Embrace the Arcane; Pandemonium Wrath pending code).
{ const as = taxonomy.categories.find(c => c.category === 'Affect on Spells'); if (as && !as.values.includes('Count as Manual')) as.values.push('Count as Manual'); }
// Activates When::Ally/Enemy Loses Buff/Debuff (user 2026-10-06): triggered when a creature on that side LOSES a buff or
// debuff (destroyed, removed, expires, wears off) — distinct from "is Buffed"/"is Debuffed" (gaining one).
{ const aw = taxonomy.categories.find(c => c.category === 'Activates When');
  if (aw) for (const v of ['Ally Loses Buff/Debuff', 'Enemy Loses Buff/Debuff']) if (!aw.values.includes(v)) aw.values.push(v); }
// user 2026-10-06: missing creatures (empty party slots) ≠ dead; perks/traits can grant perks
for (const [cat, v] of [['Multiplied by', 'Critical Count'], ['Multiplied by', 'Dodge Count'], ['Multiplied by', 'Missing Creature Count'], ['Active If', 'Creatures Missing'], ['Affect on Traits', 'Gain a Perk']]) {
  const c = taxonomy.categories.find(x => x.category === cat); if (c && !c.values.includes(v)) c.values.push(v); }
{ const aw = taxonomy.categories.find(c => c.category === 'Activates When'); if (aw) for (const v of ['Ally Deals Damage', 'Enemy Deals Damage']) if (!aw.values.includes(v)) aw.values.push(v); }   // user ruling 2026-10-04: triggered by damage
const taxoTags = readJSON(path.join(MODEL, 'trait_taxonomy_tags.json')).by_trait;
// "Animatus" (the golem race) isn't in the Related Types vocab, so the classifier snapped
// Animatus-referencing effects to the nearest value "Animation" (a different race). Add Animatus
// so the remap below has a valid target and it's filterable.
{ const rt = taxonomy.categories.find(c => c.category === 'Related Types');
  if (rt && !rt.values.includes('Animatus')) { rt.values.push('Animatus'); rt.values.sort(); } }
// ── Canon-status validation (user directive): buff / debuff / minion RELATIONAL tags must be
// grounded in the description against the canonical status list (the in-game Buff/Debuff/Minion
// glossary). The LLM occasionally (a) misreads "gain [icons,N] <Spell>" as gaining a buff, (b) tags
// a status/minion the effect merely counts or extends (e.g. "minions gain 1 stack" → Random Minion),
// or (c) files a permanent minion under a buff/debuff slot. Descriptions name statuses either as plain
// words (traits: "Burned", "Taunting") or as {CONDNAME_BUFF_/DEBUFF_/MINION_X} markup (spells/perks) —
// so we match BOTH. Only the GENERIC/relational assertions below are validated; specific token-grounded
// "Related Buff::Barrier"-style tags are left untouched (markup awareness already spares any real ref).
const CANON_BUFF_STEMS = ['agil','arcane','barrier','berserk','defensive','immun','invisib','leech','mend','proficien','protect','rebirth','repel','savage','shell','splash','taunt','ward','alcohol'];
const CANON_DEBUFF_STEMS = ['bleed','blight','blind','bomb','burn','confus','curse','disarm','fear','fr[eo]z','invert','mania','poison','scorn','silenc','slee','snar','stone','vulnerab','weak'];
const buffRefRe = new RegExp('\\b(buff|' + CANON_BUFF_STEMS.join('|') + ')', 'i');
const debuffRefRe = new RegExp('\\b(debuff|' + CANON_DEBUFF_STEMS.join('|') + ')', 'i');
const hasBuffRef = (d) => /\{condname_buff_/i.test(d) || buffRefRe.test(d);
const hasDebuffRef = (d) => /\{condname_debuff_/i.test(d) || debuffRefRe.test(d);
const hasMinionSummon = (d) => /\bsummon|\bconjure|\bcreate|army of minions?|random minions?|\{condname_minion_|(gain|gains|get|gets|give|gives|grant|grants)\b[^.]{0,40}minion|minion.{0,20}(summon|created|conjured)/i.test(d);
// A Minion taxonomy tag must be grounded (user directive): the description must reference the generic
// word "minion", a {CONDNAME_MINION_*} token, a summon/conjure verb, OR name an actual in-game Minion
// status. Otherwise it's a mis-tag (e.g. the "Dumpling" card — Dumpling is a creature TYPE, not a minion —
// was wrongly given Action/Mechanic::Minion + Affect on Minions::Gain Minion). Names are word-boundaried
// (with an optional plural) so short ones can't bleed into other words ("war"≠"ward", "death"≠…).
const MINION_STEMS = [
  'minion', 'amalgamation', 'animated gem', 'animated weapon',
  'demon',                                               // Greater/Lesser/Inner Demon (+ the named sins below)
  'asmodeus', 'beelzebub', 'belphegor', 'lucifer', 'mammon', 'satanachia', 'leviathan',
  'brim ?fiend', 'chaos ?satyr', 'fire ?imp',            // Lesser Demons
  'war', 'death', 'conquest', 'famine',                  // Four Horsemen
  'dire ?wol(?:f|ve)', 'doppelganger', 'guardian of surathli', 'illusion',
  'torun', 'littletorun', 'microbot', 'spiderling', 'unstable horror', 'shambling horror', 'writheling', 'zombie',
];
const minionNameRe = new RegExp('\\b(' + MINION_STEMS.join('|') + ')s?\\b', 'i');
const hasMinionRef = (d) => /\{condname_minion_/i.test(d) || minionNameRe.test(d) || hasMinionSummon(d);
const isMinionTag = (k) => k === 'Action/Mechanic::Minion' || k.startsWith('Affect on Minions::') || k.startsWith('Related Minion::');
// Action/Mechanic::Spell Gems is for effects that manipulate the GEMS themselves — charges, Ethereal
// creation, copying/sealing gems, gem potency/properties — NOT effects that merely cast or grant a spell
// (user directive: those are Action/Mechanic::Cast). Keep the tag only when a gem-manipulation concept is
// present; otherwise it's a mis-tag on a plain cast/grant reference.
const gemManipRe = /spell gem|\bcharges?\b|ethereal|\bseal(ed|s|ing)?\b|\bunseal|gem propert|property gem/i;
// {STAT_*} tokens (raw in spell/perk descriptions) → English, so text-grounding rules can match them.
const STAT_EXPAND = { health: 'Health', attack: 'Attack', intelligence: 'Intelligence', defense: 'Defense', speed: 'Speed', mana: 'Mana' };
const expandStatTokens = (d) => (d || '')
  .replace(/\{STAT_([a-z]+)\}/gi, (_, s) => STAT_EXPAND[s.toLowerCase()] || s)
  .replace(/\{ACTION_([a-z]+)\}/gi, (_, s) => s);   // {ACTION_provokes} -> "provokes" so action-verb rules match spell/perk text
// Related Stat::Maximum Health grounding. Synthesized from the user's Trait_MTX SEARCH heuristic (the
// authoritative term list) + generalized magnitudes + token expansion. The tag is the Maximum Health STAT:
// an effect that gains/scales/modifies max HP, references a stat BUNDLE that includes Health (no omission),
// or lists Health among stats. NOT current/missing HP, healing amounts, HP thresholds, or "other than Health".
const mhOmit  = /stats \(other ?than health\)|other than maximum/i;
const mhHeal  = /\bheals?\b|\bhealed\b|\bhealing\b|\brecover/i;
const mhThresh = /than \d|health (is|falls|drops|below|above|reaches)/i;
const mhKeep  = /% of its stats|base stats|% stats|% more stats|equal to \d+% of its health|attack, intelligence, defense, speed, and health|, or health|gain \d+% health|have \d+% more health|defense, health|health, attack|added to its health|converted into health|maximum health|% more health for|, and health,/i;
const mhMoreLess = /\d+% (more|less) (maximum )?health\b/i;
const keepMaxHealth = (d) => mhOmit.test(d) ? false : (mhKeep.test(d) || (mhMoreLess.test(d) && !mhHeal.test(d) && !mhThresh.test(d)));
// Action/Mechanic::Creature Class = an effect that uses a creature's CLASS as a mechanic (same/different
// class, change class, class strength, "class as the target", "enemy's class"). The class NAMES double as
// spell-classes and gem-classes, so a bare-name match over-tags "casts a Death spell" / "Death Spell Gem".
// Anchor on the WORD "class" in a creature context (per the user's Trait_MTX heuristic) — "your Nature
// creatures" is Related Types::Nature Creature, not a class mechanic.
const keepCreatureClass = (d) => /creature'?s?'? class|\btheir class\b|\bits own class\b|\bown class\b|class among your creatures|class as the target|enem(y'?s?|ies'?) class|class strength|\bcreature class\b|creatures?( in your party)? that (is a|belongs? to|are set)[^.]{0,28}class|creatures? of (the )?(same|a different|this|that) class|set to the same class|change[sd]? (its |their )?class|become[s]? (a )?(nature|chaos|death|life|sorcery) creature/i.test(d);
// Turn Counter = an effect keyed to TURNS TAKEN (turn count), not a generic "number of times X happened"
// (times damaged, casts, traits gained). Keep only turn-taken phrasing.
const turnCounterRe = /turns?\b[^.]{0,24}\btaken|taken\b[^.]{0,16}\bturns?\b|for each turn|each turn (it|they|this|your|since)|number of turns|per turn\b|every turn|\d+(st|nd|rd|th) turn|at least \d+ turns?|turn counter|turns? (this|in) (battle|the current battle)/i;
// Damaging Spells (traits/perks/relics/cards) = an explicit "damaging spell(s)" reference. (For SPELLS the
// tag is re-derived from the Spell_REF potency+damage fields in the spell map, not here.)
const damagingSpellLit = /damaging spell/i;
// Indirect Damage — a proc that deals damage to a target as a side effect (not the manual attack/cast, and
// not the spell's own damage). Combined with the LLM's status/DoT tagging; used to ADD, never to strip.
const procDamageRe = /deals? (\d+%? )?damage to [^.]{0,45}(equal to|% of|\d+%)/i;
// Redirect Spell = a spell's TARGET or CASTER is changed/bounced/retargeted (not a spell grant/copy/behavior).
const redirectSpellRe = /\bbounce|\breflect|\bredirect|targets? (themselves|are reversed|all |provoking|a different|a random|another)|now targets?|(also )?(be )?cast on all|cast the spell on (a |all|another)|chance to target|instead targets?|spell targets all|targets? (of the spell )?are (reversed|chosen)/i;
// Related Types::<Class> Creature must literally reference "<class> creature(s)" — the class NAMES double as
// spell/gem classes, so a bare-name match over-tags "cast a Nature spell" / "Death Spell Gem" (user searches
// the literal "[Class] Creature" text).
const CLASS_CREATURE_RE = { Nature: /nature creatures?/i, Chaos: /chaos creatures?/i, Death: /death creatures?/i, Life: /life creatures?/i, Sorcery: /sorcery creatures?/i };
// Individual taxonomy VALUES dropped by user directive (no tracking value). Stripped from every entity and
// removed from the shipped taxonomy so the app stops offering them as filters. (Whole categories: see
// EffectLimitation handling.) Active If::Spell/Gem is X Type = redundant with Activates When + Related Spells.
const KILLED_VALUES = new Set(['Active If::Spell/Gem is X Type']);
// Active If::Buffed with X = an always-on effect gated by a buff STATE ("while has Barrier", "creatures with
// Berserk have…"), NOT an "after/when … attack/take damage" trigger.
const buffGatedRe = /\bwhile\b|\bas long as\b|with \w+,?\s*(they |it )?(have|has|deal|deals|take|takes|are|is|gain|no longer)|if (they|it) (has|have)|creatures? with \w+ (have|has|deal|deals|take|takes|are|is)/i;
const buffTriggerRe = /\b(after|when)\b[^.]{0,40}(attack|cast|take[s]? damage|are healed|is killed|dodge|provoke|gain)/i;
const keepBuffedWith = (d) => buffGatedRe.test(d) && !buffTriggerRe.test(d);
// Affect on Attacks::Modify Attack Calculation = attack damage computed from an alt stat / conditional attack
// damage / attack-count-or-outcome mod — NOT procs, intercepts, retargets, or action-locks.
const attackCalcKeepRe = /attacks? deal \d+% (more|less)|(instead of|rather than)[^.]{0,10}attack|(damage|attacks?|potency)[^.]{0,55}(based on|using)[^.]{0,35}(stat|health|attack|intelligence|speed|defense|\d+%|current|lowest|highest|\ball\b)|deals? between \d+%|attacks? \d+ times|consolidated into|does \d+ damage|no damage but/i;
const attackCalcStripRe = /^after |after (an? |your |one |adjacent )|when an enemy[^.]{0,25}(attack|cast)|intercepts?|locks on|chosen at random|must take (that|the same)|reflect \d|take[s]? an action|from cursed|gains? defense equal/i;
const keepAttackCalc = (d) => attackCalcKeepRe.test(d) && !attackCalcStripRe.test(d);
// Related Stat: an all-stats bundle ("gain/have X% stats", "base stats") implies EACH stat — parallel to the
// Max Health rule. ADD (never strip) each stat's Related Stat tag for genuine stat-bundle effects, excluding
// reactive triggers / limitations / activation-cost clauses. Max Health added unless "other than Health".
const statBundleRe = /% of (its |their )?stats|\bbase stats\b|\d+% stats\b|% more stats|(gains?|have|has|additional|more|less) [^.]{0,12}\bstats\b|all (their|its) stats|average of all (their )?stats/i;
const statBundleExcludeRe = /cannot (gain|lose)|when .{0,25}(gain|lose)s? stats|after [^.]{0,20}(gain|lose)s? [^.]{0,8}stat|(those|these|potency)\s+stats|enem(y|ies)('?s)? (gains?|loses?|stats)|would gain stats|(start|end)-of-turn effects|gains? a stat\b|stat-boosting|double stats from|effects activate/i;
const statOmitRe = /other than (maximum )?health|excluding health/i;
const STAT_BUNDLE_TAGS = ['Related Stat::Attack (Stat)', 'Related Stat::Intelligence', 'Related Stat::Defense', 'Related Stat::Speed'];
// "gain/grant [icons,N] <Spell>" — the icon token immediately after the verb flags a SPELL grant, not a buff
const spellGainRe = /\b(gain|gains|grant|grants|give|gives)\s+\[icons?,\s*\d+\]/i;
const BUFF_ASSERT = new Set(['Action/Mechanic::Buff','Affect on Status::Apply/Gain a Buff','Affect on Status::More Powerful Buff','Affect on Status::Remove Buff','Affect on Status::Share/Gain Copy of Buff','Affect on Status::Buffs Persist','Affect on Status::Limit/Prevent Buff Gain','Related Buff::Random Buff']);
const DEBUFF_ASSERT = new Set(['Action/Mechanic::Debuff','Affect on Status::Afflict with/Gain a Debuff','Affect on Status::Increase Debuff Potency','Affect on Status::Remove Debuff','Affect on Status::Resistant to Debuff','Affect on Status::Avoid/Immune to Debuff','Affect on Status::Debuffs Persist','Related Debuff::Random Debuff']);
// shared per-effect taxonomy corrections (traits / perks / spells all pass through this)
let animatusRetagged = 0, innateTagStripped = 0, persistRetagged = 0, statusUngrounded = 0, randomMinionStripped = 0, spellGainTagged = 0, spellGemUngrounded = 0, maxHealthUngrounded = 0, creatureClassUngrounded = 0, turnCounterUngrounded = 0, damagingSpellUngrounded = 0, indirectDamageAdded = 0, effectLimKilled = 0, redirectUngrounded = 0, classCreatureUngrounded = 0, killedValueCount = 0, buffedWithUngrounded = 0, attackCalcUngrounded = 0, autoDefendUngrounded = 0, autoProvokeUngrounded = 0, statBundleAdded = 0, innateTraitAdded = 0;
function correctTaxo(taxo, desc, kind) {
  let out = taxo;
  desc = expandStatTokens(desc);   // spell/perk descriptions carry raw {STAT_*}; expand so text rules match
  // Effect Limitation — dropped entirely (user directive: no tracking value). Strip the whole category.
  // Plus any individually-killed values (KILLED_VALUES).
  out = out.filter(k => {
    if (k.startsWith('Effect Limitation::')) { effectLimKilled++; return false; }
    if (KILLED_VALUES.has(k)) { killedValueCount++; return false; }
    return true;
  });
  if (out.includes('Related Types::Animation') && /animatus/i.test(desc) && !/\banimation\b/i.test(desc)) {
    out = out.map(k => k === 'Related Types::Animation' ? 'Related Types::Animatus' : k); animatusRetagged++;
  }
  if (out.includes('Related Trait::Innate Trait') && !/innate/i.test(desc)) {
    out = out.filter(k => k !== 'Related Trait::Innate Trait'); innateTagStripped++;
  }
  // "Persist (Minion)" means the minion persists BEYOND DEATH. The LLM over-applied it to effects that merely
  // make minions last longer / less likely to go away — those are "Extend Duration (Minion)". Retag when the
  // desc is about duration and NOT death (validated vs every taggee: keeps Undying Loyalty / Grimkeeper /
  // Destiny Bond / Visitors From Before / Stick Soul as Persist; flips Midnight Bargain / Master of Dryads /
  // Hound Legion / Void Shift). Ambiguous ones with neither cue (e.g. Inquisitor) stay Persist.
  if (out.some(k => k.endsWith('::Persist (Minion)'))) {
    const death = /persist(s|ed)? (through|beyond)|through .{0,16}death|beyond .{0,16}death|master'?s death|when .{0,20}(dies|killed)/i.test(desc);
    const duration = /go away|last(s)? (forever|longer)|never (go away|expire|leave|disappear)|less likely|lower chance|extend|duration|expire/i.test(desc);
    if (!death && duration) { out = out.map(k => k.endsWith('::Persist (Minion)') ? k.replace('::Persist (Minion)', '::Extend Duration (Minion)') : k); persistRetagged++; }
  }
  // canon-status validation: drop buff/debuff/minion assertions the description doesn't ground
  const dl = (desc || '').toLowerCase();
  const b = hasBuffRef(dl), db = hasDebuffRef(dl), mn = hasMinionRef(dl);
  out = out.filter(k => {
    if (BUFF_ASSERT.has(k) && !b) { statusUngrounded++; return false; }
    if (DEBUFF_ASSERT.has(k) && !db) { statusUngrounded++; return false; }
    if (k === 'Affect on Status::Always Has X Buff/Debuff' && !b && !db) { statusUngrounded++; return false; }
    // every Minion label must reference a real Minion status name or a generic minion reference
    if (isMinionTag(k) && !mn) { randomMinionStripped++; return false; }
    // Spell Gems = gem manipulation, not a plain cast/grant reference
    if (k === 'Action/Mechanic::Spell Gems' && !gemManipRe.test(desc || '')) { spellGemUngrounded++; return false; }
    // Related Stat::Maximum Health = the max-HP stat, not healing / current-HP / thresholds / resource %
    if (k === 'Related Stat::Maximum Health' && !keepMaxHealth(desc || '')) { maxHealthUngrounded++; return false; }
    // Creature Class = a class MECHANIC, not a spell-class / gem-class reference
    if (k === 'Action/Mechanic::Creature Class' && !keepCreatureClass(desc || '')) { creatureClassUngrounded++; return false; }
    // Turn Counter = turns taken, not a generic occurrence count
    if (k === 'Action/Mechanic::Turn Counter' && !turnCounterRe.test(desc || '')) { turnCounterUngrounded++; return false; }
    // Damaging Spells on a non-spell = explicit "damaging spell" reference (spells re-derive from fields)
    if (k === 'Related Spells::Damaging Spells' && kind !== 'spell' && !damagingSpellLit.test(desc || '')) { damagingSpellUngrounded++; return false; }
    // Redirect Spell = spell target/caster changed, not a grant/copy/behavior effect
    if (k === 'Affect on Spells::Redirect Spell' && !redirectSpellRe.test(desc || '')) { redirectUngrounded++; return false; }
    // Related Types::<Class> Creature must literally reference "<class> creature(s)", not the class's spells/gems
    { const m = k.match(/^Related Types::(Nature|Chaos|Death|Life|Sorcery) Creature$/);
      if (m && !CLASS_CREATURE_RE[m[1]].test(desc || '')) { classCreatureUngrounded++; return false; } }
    // Active If::Buffed with X = gated buff STATE, not an after/when trigger
    if (k === 'Active If::Buffed with X' && !keepBuffedWith(desc || '')) { buffedWithUngrounded++; return false; }
    // Modify Attack Calculation = alt-stat/conditional attack damage, not procs/intercept/retarget
    if (k === 'Affect on Attacks::Modify Attack Calculation' && !keepAttackCalc(desc || '')) { attackCalcUngrounded++; return false; }
    // Automatically Defend / Provoke = the creature auto-performs that action
    if (k === 'Affect on Mitigation::Automatically Defend' && !/\bdefends?\b/i.test(desc || '')) { autoDefendUngrounded++; return false; }
    if (k === 'Affect on Mitigation::Automatically Provoke' && !/\bprovokes?\b/i.test(desc || '')) { autoProvokeUngrounded++; return false; }
    return true;
  });
  // Indirect Damage — ADD (never strip) proc damage on non-spell effects, to combine with the LLM's
  // status/DoT tagging (a trait that "deals damage to X equal to Y%" deals indirect, non-attack damage).
  if (kind !== 'spell' && !out.includes('Action/Mechanic::Indirect Damage') && procDamageRe.test(desc || '')) {
    out.push('Action/Mechanic::Indirect Damage'); indirectDamageAdded++;
  }
  // Related Stat all-stats bundle → each stat (Attack/Int/Def/Speed always; Max Health unless omitted)
  if (statBundleRe.test(desc) && !statBundleExcludeRe.test(desc)) {
    const adds = statOmitRe.test(desc) ? STAT_BUNDLE_TAGS : [...STAT_BUNDLE_TAGS, 'Related Stat::Maximum Health'];
    for (const t of adds) if (!out.includes(t)) { out.push(t); statBundleAdded++; }
  }
  // Related Trait::Innate Trait wherever the desc references innate trait(s)
  if (!out.includes('Related Trait::Innate Trait') && /innate trait/i.test(desc)) { out.push('Related Trait::Innate Trait'); innateTraitAdded++; }
  // a "gain [icons,N] <Spell>" that isn't a status → tag it as gaining a spell (the LLM missed this)
  if (spellGainRe.test(desc || '') && !b && !db && !out.includes('Affect on Spells::Extra/Gain a Spell Gem')) {
    out.push('Affect on Spells::Extra/Gain a Spell Gem'); spellGainTagged++;
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
  if (excludedTraitIds.has(t.id)) continue;   // skip blacklisted/duplicate ids so the item links to the surviving trait
  const si = t.source_item && t.source_item.name;
  if (si && si !== 'N/A' && !traitIdByItemName.has(si)) traitIdByItemName.set(si, t.id);
}
// Trait text: rendered here from the game's tokenized text with the code token table (token_names.json), so every
// {CONDNAME_* / ACTION_* / STAT_* / RACE_* …} reads exactly as the game prints it (user, 2026-10-13). The extract's
// pre-rendered `desc` used suffix-derived condition names ("Burned", "Direwolf"); it is only the fallback.
const TOKEN_TEXT = readJSON(path.join(MODEL, 'token_names.json')).tokens;
// condition registry name (suffix-derived) -> the game's display name (scr_LangCondition)
const COND_GAME = (() => { const tn = readJSON(path.join(MODEL, 'token_names.json')).conditions, m = new Map();
  for (const c of readJSON(path.join(MODEL, 'condition_registry.json')).conditions) if (c.name && tn[c.id]) m.set(c.name, tn[c.id].text);
  return m; })();
const tokenMiss = new Map();
const renderTokens = (tok, fallback) => {
  if (!tok) return fallback || '';
  let ok = true;
  const out = tok.replace(/\{([A-Za-z][A-Za-z0-9_ ]*)\}/g, (m, k) => {
    const t = TOKEN_TEXT[k]; if (t) return t.text;
    ok = false; tokenMiss.set(k, (tokenMiss.get(k) || 0) + 1); return m; });
  return ok ? out : (fallback || out);
};
const traits = {};
let traitsExcluded = 0;
for (const t of consolidated) {
  if (excludedTraitIds.has(t.id)) { traitsExcluded++; continue; }   // blacklisted -> never ships
  const tag = tagByTraitId.get(t.id) || {};
  const cls = (t.source_creature && CLASS_SET.has(t.source_creature.class)) ? t.source_creature.class : null;
  const desc = renderTokens(t.desc_tokenized, t.desc || t.effect_prose || '');
  const srcArr = taxoTags[String(t.id)] || [];
  const taxo = correctTaxo(srcArr.map(a => a.cat + '::' + a.val), desc, 'trait');
  const rec = reconById.get(t.id) || {};
  traits[t.id] = {
    id: t.id,
    runtimeIds: RT_GROUPS[String(t.id)] || [],
    name: t.name || t.key || `Trait ${t.id}`,
    desc,
    cls,
    produces: tag.produces || [],
    consumes: tag.consumes || [],
    labels: tag.labels || [],
    stats: tag.stats || [],
    taxo,
    taxoSrc: taxoSrcArr(srcArr, taxo),
    // reconciliation status (raw); the OWNER MODEL (owner/ownerType/ownerCategory/ownerGroup/
    // ownerProvenance + itemSource) is attached by the owner-enrichment pass after creatures+items exist.
    obtainStatus: rec.status || null,
  };
}
console.log(`  traits: ${Object.keys(traits).length} shipped · ${traitsExcluded} blacklisted (${DUPLICATE_TRAIT_IDS.size + NETHER_DUP_TRAIT_IDS.size} duplicate + ${NYI_SANDBOX_TRAIT_IDS.size + NYI_OTHER_TRAIT_IDS.size} NYI + ${LEGACY_TRAIT_IDS.size} legacy-S3 + ${UNRESOLVED_OWNERLESS_IDS.size} unresolved-ownerless + ${traitsExcluded - DUPLICATE_TRAIT_IDS.size - NETHER_DUP_TRAIT_IDS.size - NYI_SANDBOX_TRAIT_IDS.size - NYI_OTHER_TRAIT_IDS.size - LEGACY_TRAIT_IDS.size - UNRESOLVED_OWNERLESS_IDS.size} recon — not in live Ultimate)`);

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
// name -> code record; when a name has several records (e.g. Tipsy Denizen: a framed record + a frameless twin),
// prefer the one with a real battle frame
const cdByName = new Map();
for (const c of creatureData) { const k = norm(c.name), cur = cdByName.get(k);
  if (!cur || ((cur.battle_frame == null || cur.battle_frame === 6969) && c.battle_frame != null && c.battle_frame !== 6969)) cdByName.set(k, c); }
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
// innate trait name → id, exact (normalized). The community CSVs were corrected to the game's trait names
// (2026-10-02 audit), so the old name_reconciliation.json spelling bridge is retired; a miss warns below.
const resolveTraitId = (name) => (name ? traitIdByName.get(norm(name)) ?? null : null);
const traitUnresolved = [];  // playable creatures whose innate trait name never resolves to an id

fs.rmSync(OUT_CRIT, { recursive: true, force: true });
fs.mkdirSync(OUT_CRIT, { recursive: true });

// CODE-GROUNDED asset maps (_su_extract code/extract_asset_maps.py): conditions / relics / spec emblems / god battle /
// artifact tiers, each decoded from the game's own sprite switch. Replaces the hand-curated tables that used to live here.
const ASSET_MAPS = readJSON(path.join(MODEL, 'asset_maps.json'));
const FUSE_CREATURE_FRAME = {}, FUSE_SKIN_FRAME = {};   // creature id / skin id → code spr_crits_battle frame (fusion.json)
// Battle-sprite frame = the code creature DB record's battle_frame (creature_data, code-named since 2026-10-01).
// The former SPRITE_FRAME_OVERRIDE / creature_frame_overrides.json manual picks are retired (8/15 already equalled
// code; the other 7 now follow code by user decision) — see _su_extract creature_frame_overrides.json overrides_retired.

// Canonical frame remap (asset-index driven). The appraisal (frame_index.json) marks each spr_crits_battle
// frame keep|removable; removable = legacy / unused / a non-canonical byte-duplicate, with canonical_frame
// = the KEPT byte-twin. Route every copied frame through its canonical so nothing references a frame the
// directory-cleanup will delete (byte-identical → zero visual change). Frames with no canonical (whole group
// legacy/unused) are left as-is — their owners are handled by explicit creature overrides.
const ASSET_INDEX = (readJSON(path.join(MODEL, 'frame_index.json')).frames) || {};
const canonFrame = (f) => {
  const r = ASSET_INDEX[String(f)];
  return (r && !r.keep && r.canonical_frame != null) ? r.canonical_frame : f;
};

// Secondary availability gate (beyond Realm Depth): some creatures also require a God Favor rank or a
// Guild Reputation rank. The primary depth only says the god's realm / the guilds are AVAILABLE; this
// rank is the real requirement. Favor rank is buried in the acquisition source prose; guild rank is
// wiki-sourced. gate = {type:'favor'|'guild', name:<god|guild>, rank:N}. Propagated to traits/materials.
const guildGateByName = new Map();
for (const r of readJSON(path.join(REF, 'guild_creature_ranks.json')).ranks)
  guildGateByName.set(norm(r.creature), { type: 'guild', name: r.guild, rank: r.rank });
const FAVOR_RE = /([A-Za-z0-9'’ ]+?)\s+God Shop\s*\(Favor Rank\s*(\d+)\)/;   // name allows digits (god "4080")

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
  const traitId = (cd && cd.trait_id != null) ? cd.trait_id : resolveTraitId(traitName);
  // ALERT: every playable creature must have a trait that resolves to a trait record (else it
  // carries no synergy tags). Missing name = hard gap; unresolved = spelling not yet reconciled.
  if (!traitName) { warn(`creature "${r.name}" has NO innate trait name`); traitUnresolved.push(`${r.name} (no name)`); }
  else if (traitId == null) { warn(`creature "${r.name}" innate trait "${traitName}" does not resolve to a trait id (fix the name in Creature_REF.csv)`); traitUnresolved.push(`${r.name} -> "${traitName}"`); }

  // battle sprite — spr_crits_battle frame from the capstone battle_frame, else legacy field0,
  // else a name-mismatch override (roster spelling ≠ sprite-catalog spelling)
  let frame = (cd && cd.battle_frame != null) ? cd.battle_frame : (cs ? cs.field0 : null);
  if (!cd) { spriteOverrides++; warn(`creature "${r.name}" has no code creature record — battle frame from legacy creature_stats`); }
  if (frame != null && frame !== 6969) FUSE_CREATURE_FRAME[id] = frame;   // code frame → fusion palette lookup
  if (frame != null && frame !== 6969) frame = canonFrame(frame);   // route to the kept byte-twin (cleanup-safe)
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

  // Realm Depth availability (creatures_ref acquisition): depth = the Realm Depth at which the creature
  // first becomes obtainable; source = the acquisition text (realms / method). 3 special encounters
  // (Pandemonium King/Queen, Treasure Golem) carry "N/A" → null depth. Propagated to traits/materials below.
  const acq = r.acquisition || {};
  const depth = typeof acq.depth === 'number' ? acq.depth : null;
  const source = (acq.source && String(acq.source).trim()) || null;
  // secondary gate: God Favor rank (from source prose) or Guild Reputation rank (wiki); disjoint in practice
  let gate = null;
  const fm = source && source.match(FAVOR_RE);
  if (fm) gate = { type: 'favor', name: fm[1].trim(), rank: +fm[2] };
  else if (guildGateByName.has(norm(r.name))) gate = guildGateByName.get(norm(r.name));
  creatures.push({
    id, name: r.name, race: r.race || null, cls,
    hp: stats.hp, atk: stats.atk, def: stats.def, int: stats.int, spd: stats.spd, total,
    statSource: (cd ? 'code' : cs ? 'code-legacy' : 'community') + (statPatched.length ? '+ref' : ''),
    traitId, traitName,
    depth, source,
    ...(gate ? { gate } : {}),
    sprite,
  });
});

// GUARDRAIL G2: no innate trait may be owned by more than one creature (a collision means a
// bad name-reconciliation, e.g. two creatures pointing at the same trait id by mistake).
const traitOwners = new Map();
for (const c of creatures) if (c.traitId != null) (traitOwners.get(c.traitId) || traitOwners.set(c.traitId, []).get(c.traitId)).push(c.name);
for (const [tid, cs] of traitOwners) if (cs.length > 1)
  warn(`trait id ${tid} is the innate of ${cs.length} creatures (should be exactly one): ${cs.join(', ')}`);

// ── Realm Depth propagation → traits (+ later trait-materials) ───────────────────────────────────
// A trait's availability depth comes from ONE of two sources, disjoint in practice:
//   • creature-innate trait → the owning creature's depth (creatures_ref acquisition)
//   • player-farmable Nether Boss trait material → the wiki depth table (data/reference/nether_boss_trait_depths.json)
// Boss-only (encounter) traits get NO depth (per design — only player-available content is tagged).
const traitDepth = new Map();   // traitId → Realm Depth (consumed here for traits and below for trait-items)
const traitGate = new Map();    // traitId → secondary gate {type,name,rank} (parallel to traitDepth)
for (const c of creatures) {    // innate: 1:1 owner, but take the min defensively
  if (c.traitId == null) continue;
  if (typeof c.depth === 'number') { const cur = traitDepth.get(c.traitId); if (cur == null || c.depth < cur) traitDepth.set(c.traitId, c.depth); }
  if (c.gate && !traitGate.has(c.traitId)) traitGate.set(c.traitId, c.gate);
}
// derive god realm depth + guild-intro depth from creatures — reused to give god-shop / guild SPELLS the same
// primary depth (spells have no depth column of their own; only their Source names the god / guild).
const godRealmDepth = new Map();   // norm(god) → first depth that god's realm is reachable
let guildIntroDepth = null;        // depth at which Guilds become available (all guild creatures share it)
for (const c of creatures) {
  if (!c.gate || typeof c.depth !== 'number') continue;
  if (c.gate.type === 'favor') { const k = norm(c.gate.name); const cur = godRealmDepth.get(k); if (cur == null || c.depth < cur) godRealmDepth.set(k, c.depth); }
  else if (c.gate.type === 'guild') guildIntroDepth = guildIntroDepth == null ? c.depth : Math.min(guildIntroDepth, c.depth);
}
{
  const normTN = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/\bs\b/g, '').replace(/[^a-z0-9]+/g, '');
  const traitIdByNormName = new Map();
  for (const id in traits) { const k = normTN(traits[id].name); if (k && !traitIdByNormName.has(k)) traitIdByNormName.set(k, +id); }
  const nb = readJSON(path.join(REF, 'nether_boss_trait_depths.json')).traits;
  let nbHit = 0; const nbMiss = [];
  for (const r of nb) { const id = traitIdByNormName.get(normTN(r.trait)); if (id != null) { traitDepth.set(id, r.depth); nbHit++; } else nbMiss.push(r.trait); }
  if (nbMiss.length) warn(`nether boss depth: ${nbMiss.length}/${nb.length} wiki traits did not match a shipped trait (fix spelling in nether_boss_trait_depths.json): ${nbMiss.join(', ')}`);
  let traitTagged = 0, traitGated = 0;
  for (const id in traits) {
    const d = traitDepth.get(+id); if (d != null) { traits[id].depth = d; traitTagged++; }
    const g = traitGate.get(+id); if (g) { traits[id].gate = g; traitGated++; }
  }
  const favN = creatures.filter(c => c.gate && c.gate.type === 'favor').length;
  const guildN = creatures.filter(c => c.gate && c.gate.type === 'guild').length;
  console.log(`  realm depth: ${creatures.filter(c => typeof c.depth === 'number').length}/${creatures.length} creatures · ${traitTagged} traits tagged (${nbHit}/${nb.length} nether-boss materials)`);
  console.log(`  secondary gate: ${favN} favor + ${guildN} guild creatures · ${traitGated} traits gated`);
}

// ── specializations (player slot) — prefer the 32×32 character SKIN, else the 16×16 emblem icon ──
// The `spec_<key>` sprites are tiny 16×16 emblems. The real skins are the 32×32 player-costume sprites
// (`spec_<class>_<spec>_<theme>` / `spec_<spec>_<theme>`) + the animated `TS_SU_Costume_<Spec>` set.
// Specializations are now FULLY code-grounded (2026-10-01, _su_extract code/extract_specializations.py):
// spec id/name from the scr_SpecializationName switch, perk membership from scr_PerkGetPerkList resolved
// through TRUE runtime perk ids, the Ascension perk from scr_AscensionPerk, desc/playstyle from ui.csv.
// (The old positional perk-id join mislabeled 31/43 specs and forced the CSV membership + SPEC_EXTRA
// workarounds that used to live here; both are gone. Royal/Pariah/Deprived are code ids 27/37/38.)
const specRecs = readJSON(path.join(MODEL, 'specializations.json')).records;
for (const s of specRecs) if (!s.label) err(`specialization ${s.spec_id} has no code label`);
// Saved builds (localStorage) store numeric specId / anoints[].specId / perkAlloc keys under the OLD,
// mislabeled ids (+ 44/45/46 for the former SPEC_EXTRA). old id -> new id, derived by spec key from the
// last data.js shipped before the change. app.js applies it once per build (build.specIds !== 2).
const SPEC_ID_MIGRATION = {1:9,2:3,3:14,4:15,5:10,6:12,8:13,9:4,10:8,11:2,12:5,13:11,14:1,15:6,19:23,20:24,21:25,
  22:19,23:20,24:21,25:22,26:29,28:26,29:30,30:28,32:33,33:32,44:27,45:37,46:38};
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
// Perk_REF.csv cost/ranks — fallback ONLY where code (perk_stats) has no value (11 perks; user-confirmed in-game
// 2026-10-02 incl. Pilfer 2×50). Code wins whenever it has a number.
const perkCsvByName = new Map(parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Perk_REF.csv'), 'utf8')).slice(1)
  .filter(r => r[0]).map(r => [norm(r[0]), { ranks: /^\d+$/.test(r[2]) ? +r[2] : null, cost: /^\d+$/.test(r[3]) ? +r[3] : null }]));
let perkCsvFilled = 0;
// perk KEY -> icon sprite name, code-certain from scr_DatabasePerks (see _su_extract/code/extract_perk_icons.py)
const perkIconByKey = new Map(readJSON(path.join(MODEL, 'perk_icons.json')).records.map(p => [p.key, p.icon]));
const perkNameByKey = new Map();
for (const p of catalogPerkArr) if (p.key) perkNameByKey.set(p.key, p.name || p.key);

// Anointability — CODE (2026-10-01, _su_extract code/extract_anointments.py): scr_AnointmentsListBySpec(spec) =
// that spec's scr_PerkGetPerkList perks minus hard-coded exclusions (Ascension perks are never listed; Royal has
// no case). Replaces the Perk_REF.csv "Annointment" column + the Antiquarian hand-rule.
const anointData = readJSON(path.join(MODEL, 'anointments.json'));
const anointableBySpec = new Map(Object.entries(anointData.by_spec).map(([sid, v]) => [+sid, new Set(v.anointable.map(p => p.key))]));

// 16×16 spec emblem = scr_SpecializationIcon(spec id) (code; asset_maps.spec_icons). Replaces the name + alias heuristic.
const findEmblem = (specId) => ASSET_MAPS.spec_icons[String(specId)] || null;

// per-surface taxonomy tags (LLM-classified against the codebook; optional until generated)
const loadTaxoBy = (fname) => { const p = path.join(MODEL, fname); return fs.existsSync(p) ? (readJSON(p).by_key || {}) : {}; };
const spellTaxo = loadTaxoBy('spell_taxonomy_tags.json');
const perkTaxo = loadTaxoBy('perk_taxonomy_tags.json');
const cardTaxo = loadTaxoBy('card_taxonomy_tags.json');     // keyed by card id (LLM-classified)
const relicTaxo = loadTaxoBy('relic_taxonomy_tags.json');   // keyed by relic id (LLM-classified)
// per-rank relic tags (extract S35): how many of a relic's ranks carry each tag → the "×N" on its chip (N ≥ 2, user ruling 2026-10-18)
const relicRankCounts = (() => { const p = path.join(MODEL, 'relic_rank_taxonomy_tags.json'); return fs.existsSync(p) ? (readJSON(p).relic_tag_counts || {}) : {}; })();
// per-rank trigger tags (same file, by_key '<relic id>:<rank>'): only the Activates at / Activates When tags ship, for the
// creature detail's Triggers section (BACKLOG #5)
const relicRankTrig = (() => { const p = path.join(MODEL, 'relic_rank_taxonomy_tags.json'); return fs.existsSync(p) ? (readJSON(p).by_key || {}) : {}; })();
const TRIG_CATS = new Set(['Activates at', 'Activates When']);
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
// names = the game's own text (L_WBOSS_*, scr_FalseGodName ids 0-9); partsKey = the extract's key in false_god_parts_true.json
const FALSE_GODS = [
  { key: 'THEANCESTOR',   name: 'The Ancestor',      specs: ['Bloodmage', 'Inquisitor', 'Purgatorian'] },
  { key: 'SAINTALTHEA',   name: 'Saint Althea',      specs: ['Cleric', 'Fanatic', 'Paladin', 'Shadowbringer', 'Mermaid'] },
  { key: 'CALIBAN',       name: 'Caliban the Unredeemed', partsKey: 'Caliban', specs: ['Evoker', 'Trickster', 'Demonologist', 'Pariah'] },
  { key: 'NEBODAR',       name: 'Nebodar',           specs: ['Hell Knight', 'Pyromancer', 'Gladiator'] },
  { key: 'LOIDPRIME',     name: 'Loid Prime',        specs: ['Defiler', 'Necromancer', 'Reaver', 'Mime'] },
  { key: 'MINDWURM',      name: 'Mindwurm',          specs: ['Cabalist', 'Dreamshade', 'Sorcerer', 'Graveborn', 'Mesmerist'] },
  { key: 'HYDRANOX',      name: 'Hydranox',          specs: ['Astrologer', 'Animator', 'Doombringer', 'Spellweaver', 'Toxicologist'] },
  { key: 'IMPIMPINGTON',  name: 'Imp Impington Reborn', partsKey: 'Imp Impington', specs: ['Druid', 'Tribalist', 'Windrunner', 'Deprived', 'Grovetender'] },
  { key: 'JOTUNIR',       name: 'Jotun',             partsKey: 'Jotunir', specs: ['Monk', 'Warden', 'Witch Doctor', 'Brewmaster'] },
  { key: 'LOSTCONSTRUCT', name: 'Lost Construct',    partsKey: 'The Lost Construct', specs: ['Rune Knight', 'Siegemaster', 'Engineer', 'Antiquarian'] },
];
const godBySpec = new Map();       // norm(spec label) -> god key
for (const g of FALSE_GODS) for (const sp of g.specs) godBySpec.set(norm(sp), g.key);
// guard: the spec lists above must equal the code's scr_AnointmentsListByGod mapping (by spec id)
{
  const codeGodBySpecId = new Map();
  for (const g of Object.values(anointData.by_god)) for (const sid of g.spec_ids) codeGodBySpecId.set(sid, g.god_key);
  const KEY_ALIAS = { JOTUN: 'JOTUNIR' };   // code L_WBOSS_JOTUN; app key JOTUNIR (portrait file name)
  for (const r of specRecs) {
    const appGod = godBySpec.get(norm(r.label)) || null, codeGod = codeGodBySpecId.get(r.spec_id) || null;
    if ((KEY_ALIAS[codeGod] || codeGod) !== appGod) err(`False God of "${r.label}": app ${appGod} vs code ${codeGod}`);
  }
}

const specs = [];
let specSkins = 0, perkIconsCopied = 0, perkIconsMissing = 0, emblemCount = 0, anointFlagged = 0;
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
  const emName = findEmblem(s.spec_id);
  if (emName && copyNamedSprite(emName, OUT_SPEC, `${slug}_emblem.png`)) { emblem = `assets/specs/${slug}_emblem.png`; emblemCount++; }
  // membership + ascension + anointability: all CODE (no CSV input left for specs).
  const perks = (s.perks || []).filter(p => p.key && p.name).map(p => {
    const st = perkStatByKey.get(p.key);
    let icon = null;
    const iconName = perkIconByKey.get(p.key);
    if (iconName && copyNamedSprite(iconName, OUT_PERK, `${p.key}.png`)) { icon = `assets/perks/${p.key}.png`; perkIconsCopied++; }
    else { perkIconsMissing++; }
    const pdesc = perkDescByKey.get(p.key) || p.desc || '';
    const name = perkNameByKey.get(p.key) || p.name;
    const anointment = !!(anointableBySpec.get(s.spec_id) || new Set()).has(p.key);
    if (anointment) anointFlagged++;
    const pTaxo = correctTaxo(taxoStrs(perkTaxoByKey[p.key]), pdesc, 'perk');
    return { key: p.key, name, desc: pdesc,
             ...(() => { const pc = perkCsvByName.get(norm(name)) || {};
               let cost = st ? st.cost : (p.cost ?? null), ranks = st ? st.ranks : (p.ranks || 1), src;
               if (cost == null && pc.cost != null) { cost = pc.cost; src = 'community'; }
               if (ranks == null && pc.ranks != null) { ranks = pc.ranks; src = 'community'; }
               if (src) perkCsvFilled++;
               return src ? { cost, ranks, costSrc: src } : { cost, ranks }; })(),
             icon,
             anointment, ascension: !!p.ascension,
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

// ── Nether Realm helpers (Faucet valve lock + Mimic Mike's treasury) — code-grounded tables from
// _su_extract code/NETHER.md (decomp/nether_helpers/nether_helpers.json). Chest sprites → assets/nether/.
const netherHelpers = (() => {
  const f = path.join(SRC, 'code', 'decomp', 'nether_helpers', 'nether_helpers.json');
  if (!fs.existsSync(f)) { warn(`nether helper table missing (${f})`); return null; }
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  // player-facing wording for rewards whose table text carries code names
  const say = (t) => String(t)
    .replace(/^Parchment: \+irandom_range\((\d+),(\d+)\) extra opens$/, 'Parchment: +$1–$2 extra opens')
    .replace(/ \(inv_[A-Za-z]+\)$/, '')
    .replace(/^5 random Legendary materials \(trait items.*\)$/, '5 random Legendary trait items')
    .replace(/^1 random Legendary material \(trait item\)$/, '1 random Legendary trait item')
    .replace(/^MIMIC battle \(Mimic \+ 5 random creatures\)$/, 'Mimic battle (Mimic + 5 random creatures)')
    .replace(/^empty \(L_D_[A-Z_]+\)$|^empty$/, 'Empty');
  const spr = (name) => { const rel = `assets/nether/${name}.png`;
    if (!fs.existsSync(path.join(ROOT, rel))) warn(`nether helper sprite missing (${rel})`); return rel; };
  return {
    faucet: { table: j.faucet.table.map(r => ({ code: r.code, img: spr(r.chest_sprite), reward: say(r.reward), kind: r.kind || 'item' })),
      // obj_nether_valve_Step_0 @0x1472700a0: sprite_index = (status == 1) ? spr_reactor_valve_unusable (10769)
      // : spr_reactor_valve_usable (10770); Create sets status = 0, so every valve starts on the "usable" sprite
      valveOn: spr('spr_reactor_valve_unusable'), valveOff: spr('spr_reactor_valve_usable') },
    treasury: { baseOpens: j.treasury.base_opens, chests: j.treasury.chests, pStone: j.treasury.p_nether_stone_base, host: spr('master_mimic'),
      table: j.treasury.table.map(r => ({ filling: r.filling, img: spr(r.chest_sprite), reward: say(r.reward) })) },
  };
})();

// ── False God output list (only gods that have ≥1 specialization present) + composite check ──
const specGodKeys = new Set(specs.map(s => s.falseGod).filter(Boolean));
const falseGods = [];
let fgodImgMisses = 0, fgodIconMisses = 0;
for (const g of FALSE_GODS) {
  if (g.nyi) { falseGods.push({ key: g.key, name: g.name, img: null, nyi: true }); continue; }   // NYI: ships flagged, no portrait/specs
  if (!specGodKeys.has(g.key)) continue;
  const rel = `assets/falsegods/${g.key}.png`;
  if (!fs.existsSync(path.join(OUT_FGOD, `${g.key}.png`))) {
    fgodImgMisses++; warn(`False God "${g.name}" composite missing (${rel}) — run tools/build_falsegods.py`);
  }
  // the god's small ICON (code-grounded per _su_extract code/FALSE_GOD_BEHAVIOR_FINDINGS.md) — used where a False God is listed
  const iconRel = `assets/falsegods/icons/${g.key}.png`;
  const hasIcon = fs.existsSync(path.join(ROOT, iconRel));
  if (!hasIcon) { fgodIconMisses++; warn(`False God "${g.name}" icon missing (${iconRel})`); }
  falseGods.push({ key: g.key, name: g.name, img: rel, ...(hasIcon ? { icon: iconRel } : {}) });
}

// ── artifacts (container properties) ──
const artRef = readJSON(path.join(REF, 'artifacts_ref.json')).records;
const artGroup = { primary: [], stat: [], trick: [] };
// artifact slot unlock tiers — CODE (_su_extract artifact_slots.json, S15: inv_ArtifactStatString / obj_bsupgrade).
// Keys = the app's artifact slot groups; stat excludes the primary (stat1, tier 1). Nether also needs awakening.
const artSlotUnlocks = (() => {
  const f = path.join(MODEL, 'artifact_slots.json'); if (!fs.existsSync(f)) { err('artifact_slots.json missing'); return null; }
  const by = (re) => readJSON(f).slots.filter(x => re.test(x.slot)).map(x => x.unlock_tier).sort((a, b) => a - b);
  const u = { stat: by(/^stat[2-9]$/), trick: by(/^trick\d$/), traits: by(/^trait$/), spells: by(/^spell$/), netherIds: by(/^nether$/) };
  console.log(`  artifact slot unlocks (code): ${Object.entries(u).map(([k, v]) => `${k} ${v.join('/')}`).join(' · ')}`);
  return u;
})();
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
// artifact-type icons — CODE: inv_ArtifactIcon(type, level) picks one of 6 tier frames of the `icons` sheet per type
// (asset_maps.artifacts; pixel-identical to the <type>_<n> sprites). Ship all 6 tiers per type as icons[0..5] and the
// level rule (tierMinLevel) so the app can show the tier for the artifact's level like the game does. `icon` = tier 6.
fs.rmSync(OUT_ARTTYPE, { recursive: true, force: true });
const ART_TIERS = ASSET_MAPS.artifacts.tiers_by_type;
for (const p of artGroup.primary) {
  const t = ART_TIERS[p.property];
  if (!t) { err(`artifact type ${p.property} has no code icon tiers`); continue; }
  p.icons = t.frames.map((f, i) => copySpriteFrame('icons', f, OUT_ARTTYPE, `${norm(p.property)}_${i + 1}.png`) ? `assets/arttypes/${norm(p.property)}_${i + 1}.png` : null);
  if (p.icons.some(x => !x)) err(`artifact type ${p.property}: missing tier icon frame`);
  p.icon = p.icons[5];
}
const artTierMinLevel = ASSET_MAPS.artifacts.tier_min_level;   // [1,10,20,30,40,50] -> tiers 1..6

// ── spells (for the artifact spell slot) — class from spells_ref, class-coloured gem icon ──
const spellCatalog = readJSON(path.join(SRC, 'data', 'catalog', 'spells.json'));
const spellArr = Array.isArray(spellCatalog) ? spellCatalog : (spellCatalog.records || Object.values(spellCatalog));
// code spell record target scope (field 5) → the Spell_REF target vocabulary (+ "Self" for scope 4 = caster only)
const SPELL_SCOPE_TARGET = { 'single target': 'Target', 'all enemies': 'Enemies', 'all your creatures': 'Your Creatures', 'all creatures': 'All Creatures', 'none/special': 'Self' };
const spellSigByKey = new Map();
{ const f = path.join(MODEL, 'spell_signatures.json');
  if (fs.existsSync(f)) { let d = readJSON(f); d = Array.isArray(d) ? d : (d.records || Object.values(d)); for (const r of d) if (r && r.key) spellSigByKey.set(r.key, r); }
  else warn('spell_signatures.json missing — spell targets fall back to Spell_REF only'); }
let spellTargetFromCode = 0, spellTargetSelfFix = 0;
// spell.aim — who an AUTOMATIC cast of this spell picks (bc_CreatureCastSpellGem: record field 5 scope + field 18 side,
// _su_extract code/ARTIFACTS.md "Target selection"): enemy1 / ally1 = one random living creature of that side (ally side
// includes the caster; BUFF / DEBUFF / HEAL / RESURRECT tag overrides refine the pick), enemies / allies / all = every living
// creature of that side, self = the caster. Data for the Appendix "Random targets" section; the CSV `target` is untouched.
const spellAim = (sig) => {
  if (!sig) return null;
  const sc = sig.target_scope, sd = sig.target_side;
  if (sc === 'single target') return sd === 'enemy' ? 'enemy1' : sd === 'ally' ? 'ally1' : null;
  return { 'all enemies': 'enemies', 'all your creatures': 'allies', 'all creatures': 'all', 'none/special': 'self' }[sc] || null;
};
// name -> class + compendium details (potency/target/source) from the user ref
const spellClassByName = new Map();
const spellRefByName = new Map();
const cleanRef = (v) => { const s = (v == null ? '' : String(v)).trim(); return s && s !== '-' ? s : null; };
{
  // read the compendium fields (Class/Potency/Target/Charges/SOURCE) straight from the user's authoritative
  // Spell_REF.csv. Columns: 0 Spell Name · 1 Class · 2 Potency · 3 Target · 4 Charges · 5 Source · 6 Ingame Desc.
  const num = (v) => (v && /^\d+$/.test(v) ? +v : null);
  for (const r of parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Spell_REF.csv'), 'utf8')).slice(1)) {
    const name = (r[0] || '').trim(); if (!name) continue;
    if (r[1]) spellClassByName.set(norm(name), (r[1] || '').trim());
    spellRefByName.set(norm(name), { potency: cleanRef(r[2]), target: cleanRef(r[3]), source: cleanRef(r[5]), charges: num(cleanRef(r[4])) });
  }
}
// key -> charges from CODE (scr_DatabaseSpells; authoritative — beats the community CSV, e.g. Affliction
// code 14 vs CSV 17, user-verified in-game). 712/741 covered; rest have no code-grounded charge count.
const spellChargesByKey = new Map();
{
  const st = readJSON(path.join(MODEL, 'spell_stats.json'));
  for (const r of (st.records || st)) if (r.key && r.charges != null) spellChargesByKey.set(r.key, r.charges);
}
// compendium lookup by exact (normalized) spell name — the CSV now uses the game's spelling (2026-10-02 audit),
// so the old fuzzy/Levenshtein typo bridge is retired. Unmatched spells warn once.
const spellRefMiss = [];
const spellRef = (name) => spellRefByName.get(norm(name)) || (spellRefMiss.push(name), {});
const spellClass = (name) => spellClassByName.get(norm(name)) || null;
// per-class spell-gem icons: user-authored gems (assets/sprites/<class>_tier15.png), replacing the wrong gem_*_lvl4 sprites
const GEM_SRC = { Nature: 'nature_tier15', Chaos: 'chaos_tier15', Sorcery: 'sorcery_tier15', Death: 'death_tier15', Life: 'life_tier15' };
fs.rmSync(OUT_SPELLGEM, { recursive: true, force: true });
const spellGems = {};
for (const [cls, base] of Object.entries(GEM_SRC)) {
  const dest = `${norm(cls)}.png`;
  if (copyNamedSprite(base, OUT_SPELLGEM, dest)) spellGems[cls] = `assets/spellgems/${dest}`;
  else warn(`spell-gem icon missing for class ${cls}`);
}
// spell gem LEVELS ("tier" in code, 1..15) — _su_extract data/model/spell_gem_properties.json (code-certain):
// property slots by level (obj_gemmod: 0 below 5, 1 at 5–9, 2 at 10–14, 3 at 15) and the icon tier
// (inv_SpellGemIcon: `icons` frame = class base + 0/1/2/3). Tiers 1–3 copy the code frames; tier 4 (level 15)
// keeps the user-authored class icons above (same shape as the code frame, no outline).
const gemPropModel = readJSON(path.join(MODEL, 'spell_gem_properties.json'));
const spellGemTiers = (() => {
  const L = gemPropModel.levels, lv = [];
  for (let t = L.min; t <= L.max; t++) lv.push(t);
  const icons = {};
  for (const [cls, b] of Object.entries(L.icon_base_by_class)) {
    const tiers = [0, 1, 2].map(k => { const dest = `${norm(cls)}_t${k + 1}.png`;
      if (copySpriteFrame('icons', b + k, OUT_SPELLGEM, dest)) return `assets/spellgems/${dest}`;
      err(`spell-gem tier icon missing: icons_${b + k} (${cls} tier ${k + 1})`); return null; });
    icons[cls] = [...tiers, spellGems[cls] || null];
  }
  return { min: L.min, max: L.max, slots: lv.map(t => L.slots_by_level[t]), iconTier: lv.map(t => L.icon_offset_by_level[t]), icons };
})();
console.log(`  spell-gem levels: ${spellGemTiers.min}–${spellGemTiers.max} · slots ${[...new Set(spellGemTiers.slots)].join('/')} · ${Object.keys(spellGemTiers.icons).length} classes × 4 icon tiers`);
// secondary gate for guild-reward spells (wiki) — spell name → {type:'guild', name, rank}
const guildSpellGateByName = new Map();
for (const r of readJSON(path.join(REF, 'guild_spell_ranks.json')).ranks)
  guildSpellGateByName.set(norm(r.spell), { type: 'guild', name: r.guild, rank: r.rank });
const SPELL_FAVOR_RE = /([A-Za-z0-9'’ ]+?)\s+Shop\s*\(Favor Rank\s*(\d+)\)/;   // "4080 Shop (Favor Rank 25)"
let spellFavor = 0, spellGuild = 0;
let spellNoClass = 0;
let spellCharged = 0;
let spellTargetGrounded = 0;
let spellDamagingGrounded = 0;
// Single/Multi-Target for a SPELL is derived code-grounded from the authoritative Spell_REF `target` field
// (not the LLM): Target = single; Enemies / All Creatures / Your Creatures = multi; self/"-" = neither.
const SPELL_SINGLE = 'Related Spells::Single-Target Spells', SPELL_MULTI = 'Related Spells::Multi-Target Spells';
const MULTI_TARGETS = new Set(['Enemies', 'All Creatures', 'Your Creatures']);
const spells = spellArr.map((s, i) => {
  const cls = spellClass(s.name);
  if (!cls) { spellNoClass++; warn(`spell "${s.name}" has no class match in spells_ref`); }
  const ref = spellRef(s.name);
  // charges: CODE (spell_stats) is authoritative; fall back to the community count where code lacks it
  const codeCharge = spellChargesByKey.has(s.key) ? spellChargesByKey.get(s.key) : null;
  const charges = codeCharge != null ? codeCharge : (ref.charges != null ? ref.charges : null);
  const chargesSrc = codeCharge != null ? 'code' : (ref.charges != null ? 'community' : null);
  if (charges != null) spellCharged++;
  let sTaxo = correctTaxo(taxoStrs(spellTaxo[String(i)]), s.desc || '', 'spell');
  // strip the LLM's target guess, re-derive from the structured field
  sTaxo = sTaxo.filter(k => k !== SPELL_SINGLE && k !== SPELL_MULTI);
  const targetTag = ref.target === 'Target' ? SPELL_SINGLE : (MULTI_TARGETS.has(ref.target) ? SPELL_MULTI : null);
  if (targetTag) { sTaxo.push(targetTag); spellTargetGrounded++; }
  // Damaging Spells for a spell: derive from Spell_REF potency + a damage reference (or explicit literal).
  const SPELL_DMG = 'Related Spells::Damaging Spells';
  sTaxo = sTaxo.filter(k => k !== SPELL_DMG);
  // "absorbs damage" (Barrier grants) is DEFENSIVE, not dealing damage — strip that clause before the check
  // (per-object audit: Corpse Shield / Divine Aegis / Holy Armor etc. were wrongly Damaging).
  const dmgText = expandStatTokens(s.desc || '').replace(/absorbs?\s+(a\s+)?[^.]*?\bdamage\b/gi, '');
  const isDamaging = (ref.potency && /\bdamage\b/i.test(dmgText)) || damagingSpellLit.test(s.desc || '');
  if (isDamaging) { sTaxo.push(SPELL_DMG); spellDamagingGrounded++; }
  const srcArr = taxoSrcArr(spellTaxo[String(i)], sTaxo);
  if (targetTag) { const idx = sTaxo.indexOf(targetTag); if (idx >= 0) srcArr[idx] = 'field'; }
  if (isDamaging) { const idx = sTaxo.indexOf(SPELL_DMG); if (idx >= 0) srcArr[idx] = 'field'; }
  // availability (from the Source column): favor spells carry the god's realm depth + favor gate; guild spells
  // carry the guild-intro depth + the wiki rep-rank gate. Standard/Starter/False-God/Avatar spells carry neither.
  let sDepth = null, sGate = null;
  const fm = (ref.source || '').match(SPELL_FAVOR_RE);
  if (fm) { const g = fm[1].trim(); sGate = { type: 'favor', name: g, rank: +fm[2] }; sDepth = godRealmDepth.get(norm(g)) ?? null; spellFavor++; }
  else if (guildSpellGateByName.has(norm(s.name))) { sGate = guildSpellGateByName.get(norm(s.name)); sDepth = guildIntroDepth; spellGuild++; }
  // target: the Spell_REF column; where it's blank, fill from the CODE's spell record field 5 (target scope —
  // bc_CreatureCastSpellGem builds the cast list from it; 4 = the caster alone → "Self", a value the CSV never has).
  // Where the two DISAGREE the CSV value is kept (user call pending; BACKLOG.md "Spell target: CSV vs code").
  const codeTarget = SPELL_SCOPE_TARGET[(spellSigByKey.get(s.key) || {}).target_scope] || null;
  // code-Self wins over the CSV (user-approved 2026-10-04): scope 4 casts on the caster alone, and the CSV mislabels
  // those few as Enemies/Target (Inner Destruction, Adrenaline Rush, Feeling Lucky, Magnification, Treasonous Mind)
  const selfFix = codeTarget === 'Self' && ref.target && ref.target !== 'Self';
  const target = selfFix ? 'Self' : (ref.target || codeTarget), targetSrc = selfFix || !ref.target ? (codeTarget ? 'code' : null) : 'ref';
  if (!ref.target && codeTarget) spellTargetFromCode++;
  if (selfFix) spellTargetSelfFix++;
  return { id: i, key: s.key, name: s.name, desc: s.desc || '', cls,
    charges, chargesSrc, potency: ref.potency || null, target, targetSrc, source: ref.source || null,
    aim: spellAim(spellSigByKey.get(s.key)),
    depth: sDepth, ...(sGate ? { gate: sGate } : {}),
    taxo: sTaxo, taxoSrc: srcArr };
}).filter(s => s.name);
if (spellRefMiss.length) warn(`spells with no Spell_REF row (exact name): ${spellRefMiss.length} — ${spellRefMiss.slice(0, 8).join(', ')}`);
console.log(`  spell targets: ${spellTargetFromCode} blank Spell_REF targets filled from code scope (field 5; incl. Self) · ${spellTargetSelfFix} caster-targeted CSV labels corrected to Self`);
console.log(`  spell availability: ${spellFavor} favor + ${spellGuild} guild spells carry depth+gate (rest = Standard/Starter/False God — none)`);
console.log(`  spells: ${spells.length} · charges ${spells.filter(s => s.chargesSrc === 'code').length} code + ${spells.filter(s => s.chargesSrc === 'community').length} community · ${spells.filter(s => s.potency).length} w/ potency · ${spellTargetGrounded} single/multi-target from Spell_REF field · potency/target/source from Spell_REF.csv`);
console.log(`  taxonomy fixes: Innate-Trait stripped ${innateTagStripped} · Animatus retagged ${animatusRetagged} · Persist→Extend-Duration retagged ${persistRetagged} (duration, not death)`);
console.log(`  canon-status validation: ${statusUngrounded} ungrounded buff/debuff tags dropped · ${randomMinionStripped} ungrounded Minion tags dropped · ${spellGemUngrounded} non-gem Spell-Gem tags dropped · ${maxHealthUngrounded} non-stat Max-Health tags dropped · ${creatureClassUngrounded} non-class Creature-Class tags dropped · ${turnCounterUngrounded} non-turn Turn-Counter dropped · ${damagingSpellUngrounded} non-literal Damaging-Spell (non-spell) dropped · ${indirectDamageAdded} Indirect-Damage proc tags added · ${effectLimKilled} Effect-Limitation tags killed · ${redirectUngrounded} non-retarget Redirect-Spell dropped · ${classCreatureUngrounded} non-creature Class-Creature type dropped · ${killedValueCount} killed-value tags dropped · ${buffedWithUngrounded} non-gated Buffed-With dropped · ${attackCalcUngrounded} non-calc Attack-Calc dropped · ${autoDefendUngrounded} non-defend Auto-Defend dropped · ${autoProvokeUngrounded} non-provoke Auto-Provoke dropped · ${spellGainTagged} spell-gain tags added · ${statBundleAdded} all-stats Related-Stat tags added · ${innateTraitAdded} Innate-Trait tags added`);

// ── trait items (slottable into artifact trait slots) — with material icons ──
const matStats = readJSON(path.join(MODEL, 'material_stats.json'));
const matRecs = Array.isArray(matStats) ? matStats : matStats.records;
// material icon = the sprite referenced in the material's own scr_DatabaseMaterials record (code; material_ids_true.json),
// replacing the localization-key name join (material_icons.json; 1859/1860 identical — Volatile Stitches corrected).
const matIconByKey = new Map(Object.values(readJSON(path.join(MODEL, 'material_ids_true.json')).records).filter(r => r.sprite).map(r => [r.key, r.sprite]));
fs.rmSync(OUT_MATICON, { recursive: true, force: true });
let matIconCopied = 0, matIconMissing = 0;
const matIcon = (m) => {                                    // copy a material's sprite → assets/maticons, return web path (or null)
  const iconName = matIconByKey.get(m.key);
  if (iconName && copyNamedSprite(iconName, OUT_MATICON, `${iconName}.png`)) { matIconCopied++; return `assets/maticons/${iconName}.png`; }
  matIconMissing++; return null;
};
// ── reconcile Trait_REF.csv → the item that grants each trait (fills coverage gaps) ──────────
// The consolidated `source_item` link (above) leaves ~16 boss-reward / Master / treasure traits with
// NO trait-item — so they render iconless in the Appendix. Root cause is a name mismatch, not missing
// data: every one of those items IS in material_stats (item_class 2) with a real icon+sprite, and the
// user's authoritative Trait_REF.csv names the exact grant. We reconcile the CSV's trait→item link to
// the game-authoritative material name (possessive-tolerant: CSV "Flubris' Ichor" ↔ material
// "Flubris's Ichor"; CSV trait "Flubris' Engulfing" ↔ shipped "Flubris's Engulfing") and add the link
// keyed by the material's exact name, so the loop below emits it with the correct icon + inherited taxo.
// material_stats.trait_id is NOT used here (it drifts ~1 block — e.g. Flubris's Ichor says 567, CSV 565).
{
  const normP = (s) => String(s || '').toLowerCase().replace(/'s?\b/g, '').replace(/[^a-z0-9]+/g, '');
  const matByName = new Map(), matByPoss = new Map();
  // punctuation/space/case-insensitive key: strip everything but [a-z0-9]. Built with collision
  // detection so an ambiguous key (2+ distinct materials) is DROPPED — we only canonicalize to an
  // unambiguous match.
  const normPS = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const matByNorm = new Map(), normAmbig = new Set();
  for (const m of matRecs) {
    if (!m.name) continue;
    if (!matByName.has(m.name)) matByName.set(m.name, m);
    const p = normP(m.name); if (!matByPoss.has(p)) matByPoss.set(p, m);
    const k = normPS(m.name);
    if (matByNorm.has(k) && matByNorm.get(k).name !== m.name) normAmbig.add(k); else if (!matByNorm.has(k)) matByNorm.set(k, m);
  }
  // Canonicalize the primary source_item links (built at file top from trait.source_item.name) to the
  // EXACT material name, so a case / punctuation / space mismatch on the trait side still links:
  // Abation's "Lunar Blood vial" → "Lunar Blood Vial" (case), Echobreather's "Particle of Grommet" →
  // "Particle of Grom'Met" (apostrophe+case). The 823 loop looks up by the material's real name, so any
  // such difference on the claim silently dropped the item (leaving a creature-owned trait iconless).
  // Guarded by the unambiguity check above so a normalized collision never links to the wrong material.
  let siCanon = 0;
  for (const t of consolidated) {
    if (excludedTraitIds.has(t.id)) continue;
    const si = t.source_item && t.source_item.name;
    if (!si || si === 'N/A' || si === 'No Material Exists' || matByName.has(si)) continue;  // missing / already exact
    const k = normPS(si);
    if (normAmbig.has(k)) continue;                        // ambiguous normalized key — don't guess
    const m = matByNorm.get(k);
    if (m && !traitIdByItemName.has(m.name)) { traitIdByItemName.set(m.name, t.id); siCanon++; }
  }
  const normL = (s) => normP(s).replace(/s$/, '');       // + trailing-plural tolerance (CSV "Amphisbaena" ↔ "Amphisbaenas")
  const traitIdByName = new Map(), traitIdByPoss = new Map();
  const looseCount = new Map(), looseId = new Map();      // loose key → id, but ONLY if unambiguous (drop collisions)
  for (const id in traits) {
    const nm = traits[id].name; if (!nm) continue;
    if (!traitIdByName.has(nm)) traitIdByName.set(nm, +id);
    const p = normP(nm); if (!traitIdByPoss.has(p)) traitIdByPoss.set(p, +id);
    const l = normL(nm); looseCount.set(l, (looseCount.get(l) || 0) + 1); if (!looseId.has(l)) looseId.set(l, +id);
  }
  const traitIdByLoose = new Map([...looseId].filter(([l]) => looseCount.get(l) === 1));
  const creaTraitIds = new Set(creatures.map(c => c.traitId).filter(x => x != null));   // has an innate creature → not blank
  const preLinked = new Set();                                                          // traits already granted by an existing material link
  for (const m of matRecs) { const t = traitIdByItemName.get(m.name); if (t != null) preLinked.add(t); }
  const refRows = parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Trait_REF.csv'), 'utf8')).slice(1);
  let refLinked = 0; const refUnresolved = [];
  for (const r of refRows) {
    const traitName = (r[0] || '').trim(), item = (r[5] || '').trim();
    if (!traitName || !item || item === 'N/A' || item === 'No Material Exists') continue;
    let tid = traitIdByName.get(traitName);
    if (tid == null) tid = traitIdByPoss.get(normP(traitName));
    if (tid == null) tid = traitIdByLoose.get(normL(traitName));  // last resort: unambiguous plural-tolerant match
    if (tid == null) continue;                                   // trait not shipped
    if (creaTraitIds.has(tid) || preLinked.has(tid)) continue;   // only truly-blank traits (no creature, no item)
    const m = matByName.get(item) || matByPoss.get(normP(item));
    if (!m) { refUnresolved.push(`${traitName} ⟵ "${item}"`); continue; }
    if (!traitIdByItemName.has(m.name)) { traitIdByItemName.set(m.name, tid); refLinked++; }
  }
  // Fallback: some reward traits aren't in Trait_REF but the recon `detail` names the granting item
  // (e.g. "Final Act of Judgment" → item "Claymore of Judgment"; material_stats.trait_id drifts ~1 so
  // it can't be trusted). Link any still-blank trait whose recon detail cites a real material.
  const linkedTids = new Set([...traitIdByItemName.values()]);
  let detailLinked = 0;
  for (const t of consolidated) {
    if (excludedTraitIds.has(t.id) || creaTraitIds.has(t.id) || linkedTids.has(t.id)) continue;
    const dm = /item "([^"]+)"/.exec((reconById.get(t.id) || {}).detail || '');
    if (!dm) continue;
    const m = matByName.get(dm[1]) || matByPoss.get(normP(dm[1]));
    if (m && !traitIdByItemName.has(m.name)) { traitIdByItemName.set(m.name, t.id); detailLinked++; }
  }
  warn(`Trait_REF reconciliation: +${siCanon} case-only source_item link(s) canonicalized · +${refLinked} blank trait(s) linked to their granting item · +${detailLinked} via recon detail${refUnresolved.length ? ` · ${refUnresolved.length} still unresolved (no material): ${refUnresolved.slice(0, 6).join(', ')}` : ''}`);
}

// item_class discriminates the artifact slot a material enchants:
//   2  → trait material (grants a creature trait)         → Trait slot
//   1  → trick material (Slate/Curio/Crippler/…)          → Trick slot
//   null + trait_id → the 5 strays that ARE trait mats (Thrasher Tooth, Oni Fragment, …) → Trait slot
//   null + no trait_id → Amber                            → Stat slot
// CODE links (_su_extract material_trait_links.json, S15): global.mat[id] = [name, rarity, property, value, sprite];
// property 15 = Trait and value = the granted trait's RUNTIME id (inv_MaterialValue) — the game's own item→trait link.
// Every name-based link above agrees with it; this fills the items the name join left unlinked (e.g. Quivering
// Scorpion → Parry, the Misery set). Traits not shipped in the app stay unlinked.
{
  const f = path.join(MODEL, 'material_trait_links.json');
  if (fs.existsSync(f)) {
    const appByRt = new Map(); for (const id in traits) for (const rt of traits[id].runtimeIds || []) appByRt.set(rt, +id);
    const matNames = new Set(matRecs.map(m => m.name));
    let added = 0, conflict = 0, notShipped = 0;
    for (const r of readJSON(f).records || []) {
      const tid = appByRt.get(r.trait_runtime_id);
      if (tid == null) { notShipped++; continue; }
      if (!matNames.has(r.name)) continue;
      const cur = traitIdByItemName.get(r.name);
      if (cur == null) { traitIdByItemName.set(r.name, tid); added++; }
      else if (cur !== tid) { conflict++; warn(`trait item "${r.name}": name link → ${cur}, code link → ${tid} (code wins)`); traitIdByItemName.set(r.name, tid); }
    }
    console.log(`  trait-item code links: +${added} added · ${conflict} name/code conflicts (code wins) · ${notShipped} grant traits not shipped`);
  }
}
const traitItems = [];
for (const m of matRecs) {
  const tid = traitIdByItemName.get(m.name);               // the trait this material grants (game's own link)
  if (tid == null) continue;                               // not a trait-granting material (amber/trick/other)
  if (!traits[tid]) { warn(`trait item "${m.name}" grants trait ${tid} not in traits table`); continue; }
  traitItems.push({ id: m.index, name: m.name, traitId: tid,
    traitName: traits[tid].name, icon: matIcon(m),
    depth: traitDepth.get(tid) ?? null,                    // Realm Depth availability, inherited from its granted trait
    ...(traitGate.get(tid) ? { gate: traitGate.get(tid) } : {}),   // secondary favor/guild gate, inherited likewise
    taxo: traits[tid].taxo || [],                          // inherits its granted trait's taxonomy tags
    taxoSrc: traits[tid].taxoSrc || [] });                 // …and its provenance (parallel to taxo)
}

// ── OWNER MODEL — every shipped trait gets an innate owner (1:1) and/or an item source ──────────
const clsFromOwner = [];
// Ownership = "whose INNATE trait is this" (creature or boss), strictly 1:1 (one trait ↔ one owner).
// A trait obtained from an item is item-only (owner=null); where the ITEM drops (`itemSource`) is a
// SEPARATE attribute and never implies ownership. Fields set here: owner / ownerType ('creature'|'boss')
// / ownerCategory ('Nether Boss'|'Deity'|'False God') / ownerGroup (the ENCOUNTER grouping 1:1 owners:
// a False God over its body parts; "Judgment and Mercy" over the pair) / ownerProvenance ('code'|'wiki')
// / itemSource. Sources: creature owner = roster traitId (code); boss/deity owner = the wiki lists below;
// False God part owner = the body-part creature (its name == the trait name, code); itemSource = Trait_REF
// source column (the "Boss Trait Materials" / Master / Treasure / Pandemonium encounter).
{
  // wiki rosters (siralimultimate.wiki.gg): Nether_Bosses + Gate_of_the_Gods — used ONLY to assign the
  // Nether Boss vs Deity category to an owner; owner NAMES come from the recon (already wiki-sourced).
  const WIKI_NETHER = new Set(['Kiichi','Blacksmith Ianne','Ceaseless Gladiator','Myrtle','Nerlyx','King Andrick','Loid','Zenpang','Phobos','Giran','Chroma','Flubris','Vlora','Sarea','Shackler','Furness','Aspect of Meraxis','Vext','Xyrxzys','Katarina','Medierra','Spoonor','Deathwalker','Qila','Scylla & Charybdis','Vitja','Imp Impington','Judgment','Mercy','Etta','Tellur','Noetherian','Ramses','Kraynaks','Cyhra','Inner Darkness'].map(s => s.toLowerCase()));
  const WIKI_DEITY = new Set(['4080','Aeolian','Alexandria','Anneltha','Apocranox','Ariamaki','Aurum','Azural','Caliban','Erebyss','Friden','Genaros','Gonfurian','Lister','Meraxis','Mortem','Muse','Perdition','Reclusa','Regalis','Shallan','Surathli',"T'mere M'rgo",'Tartarith','Tenebris','Torun','Venedon','Vertraag','Vulcanar','Yseros','Zonte'].map(s => s.toLowerCase()));
  // ownership is 1:1: the Judgment&Mercy paired encounter splits by trait (wiki), keeping the pair as the group
  const JM_SPLIT = { 'Sacrilege': 'Judgment', 'Boneyard': 'Mercy' };
  const creatureOwner = new Map();                                 // traitId → the creature that has it innately (player form)
  for (const c of creatures) if (c.traitId != null && !creatureOwner.has(c.traitId)) creatureOwner.set(c.traitId, c);
  const itemTraitIds = new Set(traitItems.map(ti => ti.traitId));
  const normPo = (s) => String(s || '').toLowerCase().replace(/'s?\b/g, '').replace(/[^a-z0-9]+/g, '');  // possessive-tolerant
  const normLo = (s) => normPo(s).replace(/s$/, '');                                                    // + trailing-plural tolerant
  // Trait_REF source column (col 6) = where the granting item is obtained (encounter); possessive- + plural-keyed
  const refSourceByTrait = new Map(), refSourceByLoose = new Map();
  for (const r of parseCSVRaw(fs.readFileSync(path.join(REF, '_raw_csv', 'Trait_REF.csv'), 'utf8')).slice(1)) {
    const nm = (r[0] || '').trim(), src = (r[6] || '').trim();
    if (!nm || !src || src === 'N/A') continue;
    if (!refSourceByTrait.has(normPo(nm))) refSourceByTrait.set(normPo(nm), src);
    if (!refSourceByLoose.has(normLo(nm))) refSourceByLoose.set(normLo(nm), src);
  }
  const bossCat = (owner, detail) => {
    if (/False God/i.test(detail)) return 'False God';
    if (/Gate_of_the_Gods/i.test(detail)) return 'Deity';
    if (/Nether_Bosses/i.test(detail)) return 'Nether Boss';
    const o = (owner || '').toLowerCase();
    if (WIKI_NETHER.has(o)) return 'Nether Boss';
    if (WIKI_DEITY.has(o)) return 'Deity';
    return null;
  };
  let ownCrea = 0, ownBoss = 0, itemOnly = 0, ownGap = 0;
  const ownerCatCount = {};
  const creaNoItem = [];   // creature-owned traits that ship WITHOUT a trait-item (should be rare + boss-ish)
  for (const id in traits) {
    const t = traits[id]; const r = reconById.get(+id) || {}; const st = r.status;
    const hasItem = itemTraitIds.has(+id);
    if (MANUAL_TRAIT_OWNERS.has(+id)) {                            // wiki-sourced boss outside the 3 category sources
      const mo = MANUAL_TRAIT_OWNERS.get(+id);
      const itemSource = hasItem ? (refSourceByTrait.get(normPo(t.name)) || refSourceByLoose.get(normLo(t.name)) || r.obtained_from || null) : null;
      Object.assign(t, mo, { itemSource });
      ownBoss++; ownerCatCount[mo.ownerCategory] = (ownerCatCount[mo.ownerCategory] || 0) + 1;
      continue;
    }
    // ownerForm: 'player' = the creature's regular roster form; 'encounter' = its boss/Deity/False-God
    // form. Dual-form creatures (the 31 Avatars=Deities, Zantai) own one trait per form.
    let owner = null, ownerType = null, ownerForm = null, ownerCategory = null, ownerGroup = null, ownerProvenance = null;
    if (st === 'creature_innate') {
      const co = creatureOwner.get(+id);
      owner = co ? co.name : null; ownerType = owner ? 'creature' : null; ownerForm = owner ? 'player' : null;
      ownerCategory = co && co.race === 'Avatar' ? 'Avatar' : null;   // Avatars are the player form of the Deities
      ownerProvenance = owner ? 'code' : null;
      // class from the owning creature (id join) when the consolidated trait's source_creature didn't carry one
      // (e.g. Something From Nothing → creature "8004", Robotic Armor → "4080"): the chip needs it for its colour
      if (co && !t.cls && CLASS_SET.has(co.cls)) { t.cls = co.cls; clsFromOwner.push(t.name); }
    } else if (st === 'boss' && !hasItem) {                        // genuine boss-innate (item ⇒ item-only, handled below)
      ownerForm = 'encounter';
      if (/False God/i.test(r.detail || '')) {                    // 1:1 owner = the body-part creature (== trait name)
        owner = t.name; ownerCategory = 'False God'; ownerGroup = r.owner || null; ownerProvenance = 'code';
      } else {
        owner = JM_SPLIT[t.name] || r.owner || null;
        ownerGroup = JM_SPLIT[t.name] ? 'Judgment and Mercy' : owner;
        ownerCategory = bossCat(owner, r.detail || ''); ownerProvenance = 'wiki';
      }
      ownerType = owner ? 'boss' : null;
    }
    // else: item-only (master/treasure/reward/Pandemonium) or boss-tagged-with-item (e.g. Ramses) → owner stays null
    // itemSource = where the item is obtained: Trait_REF source col (possessive-tolerant), else recon obtained_from
    const itemSource = hasItem ? (refSourceByTrait.get(normPo(t.name)) || refSourceByLoose.get(normLo(t.name)) || r.obtained_from || null) : null;
    Object.assign(t, { owner, ownerType, ownerForm, ownerCategory, ownerGroup, ownerProvenance, itemSource });
    if (ownerType === 'creature') { ownCrea++; if (!hasItem) creaNoItem.push(t); }
    else if (ownerType === 'boss') { ownBoss++; ownerCatCount[ownerCategory] = (ownerCatCount[ownerCategory] || 0) + 1; }
    else if (hasItem) itemOnly++;
    if (!owner && !hasItem) ownGap++;                              // should be 0 — the 17 are already excluded
  }
  console.log(`  owner model: ${ownCrea} creature · ${ownBoss} boss (${Object.entries(ownerCatCount).map(([k, v]) => `${v} ${k}`).join(', ')}) · ${itemOnly} item-only · ${ownGap} unresolved-gap${ownGap ? ' ⚠' : ' ✓'}`);
  if (clsFromOwner.length) console.log(`  trait class from owning creature: ${clsFromOwner.length} (${clsFromOwner.join(', ')})`);
  // TRUE-ID owner cross-check: every runtime id of a shipped boss-owned trait must resolve to the SAME boss in the
  // true-id owner table (creature-DB row, or key-sibling inheritance for Nether Bosses, which have no creature row).
  {
    let chk = 0, bad = 0;
    for (const id in traits) {
      const t = traits[id]; if (t.ownerType !== 'boss' || t.nyi) continue;
      for (const rid of t.runtimeIds || []) {
        const o = OWN_TRUE[String(rid)]; if (!o || !o.owner || o.owner_source !== 'key_sibling') continue;
        chk++;
        const a = norm(String(o.owner)), b = norm(t.owner || ''), c = norm(t.ownerGroup || '');
        if (a !== b && a !== c && !b.includes(a) && !a.includes(b) && !(c && (c.includes(a) || a.includes(c)))) { bad++; warn(`owner mismatch: trait #${id} "${t.name}" owner "${t.owner}"/"${t.ownerGroup}" vs true-id owner "${o.owner}" (runtime ${rid})`); }
      }
    }
    console.log(`  true-id owner cross-check: ${chk} boss traits via key-sibling · ${bad} mismatch${bad ? ' ⚠' : ' ✓'}`);
  }
  // GUARDRAIL — a playable creature's innate trait is normally extractable as a trait-material, so a
  // creature-owned trait with NO item is the exception. The VALID exceptions are encoded in the data,
  // not guessed: (a) Avatar/Deity forms (unique, not farmable) and (b) traits the reference explicitly
  // marks "No Material Exists" (bosses like Pandemonium/Treasure Golem/Mimic + Godspawn + special sets —
  // creatures that look like they'd have an item but their particular trait has no item equivalent).
  // Anything else = a creature that appears to warrant an item but has neither a link nor the
  // "No Material Exists" marker → surfaced for review (fix the Trait_REF item name, or add the marker).
  {
    const declaredItemless = new Set(consolidated.filter(c => ((c.source_item || {}).name) === 'No Material Exists').map(c => c.id));
    const valid = (t) => t.ownerCategory === 'Avatar' || declaredItemless.has(+t.id);
    const expected = creaNoItem.filter(valid), suspect = creaNoItem.filter(t => !valid(t));
    warn(`item coverage: ${ownCrea - creaNoItem.length}/${ownCrea} creature-owned traits also have a trait-item · ${creaNoItem.length} without` +
      (creaNoItem.length ? ` (${expected.length} valid = Avatar or "No Material Exists" · ${suspect.length} to review)` : ''));
    if (suspect.length) warn(`  ⚠ ${suspect.length} creature-owned trait(s) with NO item and NO "No Material Exists" marker — fix the Trait_REF item name or mark it itemless: ` +
      suspect.map(t => `${t.name} (#${t.id}, owner ${t.owner || '?'})`).join(' · '));
  }
}

// ── False God detail data — each FG is a set of body-part creatures that SHARE one stat spread. Attach
// a shared `stats` block + a `parts` list ({name, traitId}) to each falseGods entry so the app can render
// one boss detail page per False God. Parts + stats come from the extract (creature_reconciliation "False
// God part" tiedTo + creature_stats by key); the trait is the shipped FG trait whose name == the part name.
{
  const recRecs = readJSON(path.join(MODEL, 'creature_reconciliation.json')).records || [];
  const statByKey = new Map(readJSON(path.join(MODEL, 'creature_stats.json')).records.filter(r => r && r.key).map(r => [r.key, r]));
  const fgTraitByName = new Map();
  for (const id in traits) { const t = traits[id]; if (t.ownerCategory === 'False God') fgTraitByName.set(norm(t.name), +id); }
  const partsByFg = new Map();   // normalized tiedTo → [{name, traitId, stats}]
  for (const r of recRecs) {
    if (r.category !== 'False God part' || !r.tiedTo) continue;
    const s = statByKey.get(r.key) || {};
    const stats = { hp: s.hp || 0, atk: s.atk || 0, int: s.int || 0, def: s.def || 0, spd: s.spd || 0 };
    stats.total = stats.hp + stats.atk + stats.int + stats.def + stats.spd;
    const k = norm(r.tiedTo);
    if (!partsByFg.has(k)) partsByFg.set(k, []);
    partsByFg.get(k).push({ name: r.name, traitId: fgTraitByName.get(norm(r.name)) ?? null, stats });
  }
  let fgPartsHits = 0, fgSpreadWarn = 0, fgPartsRemapped = 0, fgInstances = 0;
  for (const g of falseGods) {
    if (g.nyi) {   // NYI False God: parts = its shipped (flagged) part traits; no stats in the extract
      const def = FALSE_GODS.find(x => x.key === g.key);
      g.stats = null; g.statsShared = false;
      g.parts = def.partTraitIds.filter(id => traits[id]).map(id => ({ name: traits[id].name, traitId: id, runtimeIds: traits[id].runtimeIds, count: traits[id].runtimeIds.length || 1 }));
      continue;
    }
    const gk = norm(g.name);
    // tiedTo is a short name (Impington ↔ Imp Impington, Althea ↔ Saint Althea, Jotun ↔ Jotunir …)
    let parts = partsByFg.get(gk);
    if (!parts) { for (const [k, v] of partsByFg) if (k.includes(gk) || gk.includes(k)) { parts = v; break; } }
    if (!parts || !parts.length) { warn(`False God "${g.name}" has no body-part creatures`); continue; }
    const spreads = new Set(parts.map(p => `${p.stats.hp}/${p.stats.atk}/${p.stats.int}/${p.stats.def}/${p.stats.spd}`));
    if (spreads.size > 1) { fgSpreadWarn++; warn(`False God "${g.name}" parts do NOT share one stat spread (${spreads.size}) — app shows per-part`); }
    g.stats = parts[0].stats;                                  // shared spread (verified uniform in the extract)
    g.statsShared = spreads.size === 1;
    // TRUE-ID MAPPING: a part is looked up by its creature-table instances (each row = one body part with its OWN runtime
    // trait id), NOT by display name — same-named parts (5x Head of Hydranox, 2x Hand of Loid …) are distinct instances of
    // one shipped trait. Caliban's table also holds the story-boss block (excluded here via owner_type).
    const inst = (FG_TRUE[(FALSE_GODS.find(x => x.key === g.key) || {}).partsKey || g.name] || []).filter(i => i.block !== 'story_boss');
    // creature name != trait name for exactly one part (The Ancestor: creature "Arm of The Ancestor" carries the trait "Hand of
    // The Ancestor" x2) — pair the single unmatched part with the single leftover trait group (asserted), never by guess.
    const matchedNames = new Set(parts.map(p => norm(p.name)));
    const leftover = [...new Set(inst.filter(i => !matchedNames.has(norm(i.trait_name))).map(i => norm(i.trait_name)))];
    const unmatchedParts = parts.filter(p => !inst.some(i => norm(i.trait_name) === norm(p.name)));
    const pairedBy = new Map();
    if (unmatchedParts.length === 1 && leftover.length === 1) pairedBy.set(norm(unmatchedParts[0].name), leftover[0]);
    g.parts = parts.map(p => {
      const want = pairedBy.get(norm(p.name)) || norm(p.name);
      const mine = inst.filter(i => norm(i.trait_name) === want);
      const reps = [...new Set(mine.map(i => i.legacy_rep).filter(l => l != null && traits[l]))].sort((a, b) => a - b);
      const traitId = reps.length ? reps[0] : p.traitId;
      if (traitId !== p.traitId) fgPartsRemapped++;
      fgInstances += mine.length;
      if (pairedBy.has(norm(p.name))) console.log(`False God "${g.name}" part "${p.name}" paired by elimination with trait "${mine[0] && mine[0].trait_name}" (x${mine.length})`);
      else if (!mine.length) warn(`False God "${g.name}" part "${p.name}": no creature-table instance — kept name-based trait link`);
      return { name: p.name, traitId, ...(reps.length > 1 ? { traitIds: reps } : {}),
        runtimeIds: mine.map(i => i.runtime_id).sort((a, b) => a - b), count: mine.length || 1,
        ...(spreads.size > 1 ? { stats: p.stats } : {}) };
    });
    fgPartsHits++;
  }
  console.log(`  False God parts: ${fgPartsHits}/${falseGods.filter(g => !g.nyi).length} gods enriched with body parts + shared stat spread${fgSpreadWarn ? ` · ${fgSpreadWarn} non-uniform` : ''} · ${fgInstances} part instances mapped by true id (${fgPartsRemapped} parts re-linked vs name join)`);
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
// per-gem property icons — CODE (2026-10-01): inv_ItemIconIndex's dust table gives each dust type a frame of the
// `icons` sheet (_su_extract data/model/item_icons.json dust_by_key, e.g. AGATE -> 2144). Replaces the hand-cropped
// screenshot icons (several had neighbour-row bleed). No fallback: a gem without a frame is a build error.
fs.rmSync(OUT_PROPGEM, { recursive: true, force: true });
fs.mkdirSync(OUT_PROPGEM, { recursive: true });
const dustByKey = readJSON(path.join(MODEL, 'item_icons.json')).dust_by_key || {};
const copyPropGem = (gem, dest) => { const d = dustByKey[gem]; return !!(d && d.frame != null && copySpriteFrame('icons', d.frame, OUT_PROPGEM, dest)); };
// each property gem is sold by exactly one god — CODE: the god-shop dust item (shops.json god blocks, kind=dust).
// Regalis' dust id is a runtime operand in code → the one gem/god left over is paired by elimination (asserted).
const gemGod = new Map();
{
  const godShopBlocks = readJSON(path.join(MODEL, 'shops.json')).shops.god.gods;
  const rr = readJSON(path.join(REF, 'realms_ref.json')), rrArr = Array.isArray(rr) ? rr : (rr.records || []);
  const godName = new Map(rrArr.map(r => String(r.god || '').split(',')[0].trim()).filter(Boolean).map(g => [norm(g), g]));
  const nameOfGod = (k) => godName.get(norm(k)) || k;
  const unresolvedGods = [];
  for (const g of godShopBlocks) {
    const d = g.items.find(i => i.kind === 'dust');
    if (!d) continue;
    if (d.key) gemGod.set(d.key.replace(/^L_IN_DUST_/, ''), nameOfGod(g.god_key)); else unresolvedGods.push(nameOfGod(g.god_key));
  }
  const leftGems = Object.keys(dustByKey).filter(k => !gemGod.has(k));
  if (unresolvedGods.length === 1 && leftGems.length === 1) gemGod.set(leftGems[0], unresolvedGods[0]);
  else if (unresolvedGods.length || leftGems.length) err(`gem->god: unresolved gods ${unresolvedGods} / gems ${leftGems}`);
}
const SPELL_CLASS_LIST = ['Nature', 'Chaos', 'Sorcery', 'Death', 'Life'];
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
    let icon = null;
    if (copyPropGem(gem, `${gem}.png`)) { icon = `assets/propgems/${gem}.png`; propGemIcons++; }
    else err(`spell-gem property ${gem} has no code icon frame`);
    const god = gemGod.get(gem) || null;
    if (god) propGemGods++;
    // Opal's "Class Swap" lets you choose a target class in-game → expand into one variant per class,
    // each carrying swapClass so a gem's identity (equip class + coloured icon) actually changes. The
    // same-class option is filtered out per-spell in the wizard (only the 4 other classes are valid).
    if (gem === 'OPAL') {
      for (const cl of SPELL_CLASS_LIST) spellProps.push({ id: idx++, key: 'OPAL_' + cl.toUpperCase(), name, effect: 'Class Swap: ' + cl, icon, god, swapClass: cl });
    } else if (gem === 'CITRINE') {
      // Citrine's one item text lists 4 triggers ("Cast On Attack, Cast On Defend, Cast On Provoke, Cast On Heal"),
      // but in-game each is a SEPARATE property → one variant per trigger. The first keeps Citrine's original
      // id (saved gems stay valid); the other 3 take ids appended after the last gem (assigned below).
      const trig = effect.split(',').map(t => t.trim()).filter(Boolean);
      if (trig.length !== 4 || !trig.every(t => /^Cast On /i.test(t))) err(`Citrine effect no longer splits into 4 Cast On triggers: "${effect}"`);
      trig.forEach((t, i) => spellProps.push({ id: i === 0 ? idx++ : null, key: 'CITRINE_' + t.replace(/^Cast On /i, '').toUpperCase(), name, effect: t, icon, god }));
    } else {
      spellProps.push({ id: idx++, key: gem, name, effect, icon, god });
    }
  }
  for (const p of spellProps) if (p.id == null) p.id = idx++;   // Citrine's appended variants (stable ids)
  // amounts by gem level (code: inv_SpellGemGetStat = f(gem.tier); nothing stored on the gem). `tpl` is the game's
  // L_SPELLMOD template ("{1}% Chance to Attack"); `byTier[level-1]` fills {1}. Properties with no amount keep `effect`.
  const GP = gemPropModel.properties;
  let amounts = 0;
  for (const p of spellProps) {
    const m = GP[p.key];
    if (!m) { err(`spell-gem property ${p.key} missing from spell_gem_properties.json`); continue; }
    if (m.amount_by_tier) { p.tpl = m.label_template; p.byTier = Object.keys(m.amount_by_tier).sort((a, b) => a - b).map(k => m.amount_by_tier[k]); amounts++; }
  }
  // Cascading / Singular: the item text says 3% / 30%, the code applies 0.05 / 0.5 (bc_SpellDamage/Healing/Stat)
  const CODE_PCT = { AQUAMARINE: ['3%', '5%'], AVENTURINE: ['30%', '50%'] };
  for (const [key, [txt, code]] of Object.entries(CODE_PCT)) {
    const p = spellProps.find(x => x.key === key);
    if (!p || !p.effect.includes(txt)) { err(`${key}: expected item text with ${txt} to correct to the code value`); continue; }
    p.effect = p.effect.replace(txt, code); p.textNote = `In-game item text says ${txt}; the game code applies ${code}.`;
  }
  console.log(`  spell-gem property amounts by level: ${amounts}/${spellProps.length} (rest are amount-less: Generous, Magnetic, Singular, Cascading, Extra Target, Class Swap)`);
  console.log(`  spell-gem properties: icons ${propGemIcons} (code frames) · gods ${propGemGods}/${spellProps.length} (code god-shop dust)`);
}
// ── Spell Gem property COMPATIBILITY — code (_su_extract spell_property_compat.json, S18): scr_FixSpellGemProps rewrites
// each spell's property flags at startup from its description/category/target; inv_SpellGemCanHaveProperty refuses a
// property whose flag is 0, a duplicate, a second Class Swap (or the spell's own class), and a second potency-from-stat
// property (Tourmaline/Onyx/Topaz/Sapphire). Code property id → app property via spell_gem_properties.json keys.
const spellGemRules = (() => {
  const gp = readJSON(path.join(MODEL, 'spell_gem_properties.json')).properties;
  const appByCode = new Map();
  for (const p of spellProps) { const c = (gp[p.key] || {}).property_id; if (c == null) err(`spell-gem property ${p.key}: no code property id`); else { p.code = c; appByCode.set(c, p.id); } }
  const cf = readJSON(path.join(MODEL, 'spell_property_compat.json'));
  const byKey = new Map(cf.records.map(r => [r.key, r]));
  let joined = 0; const none = [];
  for (const sp of spells) {
    const r = byKey.get(sp.key); if (!r) { none.push(sp.name); continue; }
    sp.gemOk = r.allowed_properties.map(c => appByCode.get(c)).filter(x => x != null).sort((x, y) => x - y); joined++;
  }
  if (none.length) warn(`spell-gem compat: ${none.length} spell(s) with no code record (left unrestricted): ${none.join(', ')}`);
  const toApp = (ids) => ids.map(c => appByCode.get(c)).filter(x => x != null);
  const rules = { potencyExclusive: toApp(cf.gem_rules.stat_potency_exclusive), classSwapExclusive: toApp(cf.gem_rules.class_swap_exclusive) };
  console.log(`  spell-gem compatibility (code): ${joined}/${spells.length} spells · potency-exclusive ${rules.potencyExclusive.length} · class-swap ${rules.classSwapExclusive.length}`);
  return rules;
})();

// ── relics ──
const relicRef = readJSON(path.join(REF, 'relics_ref.json')).records;
// per-relic icons — CODE: scr_RelicName(id) -> L_RELIC_<GOD> name, scr_RelicOverworldSprite(id) -> icon (the 32px relic
// sprite the app has always shown), scr_RelicBigIcon(id) -> large art (shipped as iconBig). Joined to relics_ref by the
// code relic name (the part before the comma). Replaces the "first relicW_ sprite of the relic's god" heuristic.
const OUT_RELIC = path.join(OUT_ASSETS, 'relics');
fs.rmSync(OUT_RELIC, { recursive: true, force: true });
const relicCodeByName = new Map(Object.values(ASSET_MAPS.relics).map(r => [norm(r.name), r]));
let relicIconCopied = 0;
const relics = relicRef.map((r, i) => {
  const rc = relicCodeByName.get(norm(String(r.relic).split(',')[0]));
  if (!rc) err(`relic "${r.relic}" has no code relic record`);
  let icon = null, iconBig = null;
  if (rc && rc.overworld && copySpriteFrame(rc.overworld, 0, OUT_RELIC, `${i}.png`)) { icon = `assets/relics/${i}.png`; relicIconCopied++; }
  if (rc && rc.big && copySpriteFrame(rc.big, 0, OUT_RELIC, `${i}_big.png`)) iconBig = `assets/relics/${i}_big.png`;
  if (rc && !iconBig) err(`relic "${r.relic}": no scr_RelicBigIcon art (the app shows only the big art outside the creature badge)`);
  const rTaxo = correctTaxo(taxoStrs(relicTaxo[String(i)]), (r.ranks || []).map(x => x.description || '').join(' '), 'relic');
  return {
    id: i,
    name: r.relic,
    icon, iconBig,
    statBonus: r.stat_bonus || null,
    ranks: (r.ranks || []).map(x => {
      const trig = [...new Set((relicRankTrig[`${i}:${pct(x.rank)}`] || []).filter(t => TRIG_CATS.has(t.cat)).map(t => t.cat + '::' + t.val))];
      return { rank: pct(x.rank), desc: x.description || '', ...(trig.length ? { trig } : {}) };
    }),
    taxo: rTaxo,
    taxoSrc: taxoSrcArr(relicTaxo[String(i)], rTaxo),
    tagRanks: Object.fromEntries(Object.entries(relicRankCounts[String(i)] || {}).filter(([, v]) => v.n >= 2).map(([k, v]) => [k, v.n])),
  };
});
console.log(`  relic icons: ${relicIconCopied}/${relics.length} copied`);

// ── cards (realm cards — leveled collection) ──
// each card family maps to a creature race → borrow that creature's sprite + class for the tile.
const critByRace = new Map();
for (const c of creatures) { const k = norm(c.race); if (c.sprite && k && !critByRace.has(k)) critByRace.set(k, c); }
const cardRef = readJSON(path.join(REF, 'cards_ref.json')).records;
// card power unlock thresholds — CODE (_su_extract cards_code.json, S18): family = creature race; legal set excludes the
// Avatar/Godspawn/Exotic races + 10 creature ids; powers unlock at round(0.33N) / round(0.66N) / N legal creatures.
const cardCode = new Map(readJSON(path.join(MODEL, 'cards_code.json')).families.map(f => [norm(f.family), f]));
let cardArt = 0, cardTierCode = 0;
const cards = cardRef.map((c, i) => {
  const rep = critByRace.get(norm(c.family));
  if (rep) cardArt++; else warn(`card family "${c.family}" has no matching creature race for art`);
  const cEffects = [c.unlock_1, c.unlock_2, c.unlock_3].filter(Boolean);
  const cTaxo = correctTaxo(taxoStrs(cardTaxo[String(i)]), cEffects.join(' '), 'card');
  return {
    id: i,
    family: c.family,
    cls: rep ? rep.cls : null,
    sprite: rep ? rep.sprite : null,
    tiers: (() => { const f = cardCode.get(norm(c.family)); const csv = String(c.tiers || '').split('/').map(x => pct(x)).filter(x => x != null);
      if (!f) { warn(`card family "${c.family}": no code record — CSV tiers kept`); return csv; }
      if (JSON.stringify(csv) !== JSON.stringify(f.power_thresholds)) warn(`card family "${c.family}": CSV tiers ${csv} vs code ${f.power_thresholds} (code wins)`);
      cardTierCode++; return f.power_thresholds; })(),
    setSize: (cardCode.get(norm(c.family)) || {}).set_size ?? null,
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
// card BORDER frame_<class> — drawn untinted OVER bg + creature in obj_cardalbum_Draw_64 (80×120, transparent centre;
// _su_extract code/CARDS.md). Same class→sprite switch as the bg.
const classFrame = {};
for (const cl of CLASSES) {
  const dest = `frame_${norm(cl.key)}.png`;
  if (copyNamedSprite(`frame_${norm(cl.key)}`, OUT_CARDBG, dest)) classFrame[cl.key] = `assets/cardbg/${dest}`;
  else err(`card frame sprite frame_${norm(cl.key)} missing`);
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
// god BATTLE sprite = scr_GodBattleSprite(god index) (code; asset_maps.god_battle). god index = the god's branch id in
// scr_GodShopSetup (shops.json god blocks). Caliban (Deity) has no case in that switch — the game draws his Deity
// battle sprite from boss code (bspr_god_caliban), kept as the single documented explicit entry.
const GOD_BSPR = {};
{
  const godIdxByKey = new Map(readJSON(path.join(MODEL, 'shops.json')).shops.god.gods.map(g => [norm(g.god_key), g.god_index]));
  const rr = readJSON(path.join(REF, 'realms_ref.json')), rrArr = Array.isArray(rr) ? rr : (rr.records || []);
  for (const r of rrArr) {
    const god = String(r.god || '').split(',')[0].trim(); if (!god) continue;
    const gi = godIdxByKey.get(norm(god)); const sp = gi != null ? ASSET_MAPS.god_battle[String(gi)] : null;
    if (sp) GOD_BSPR[god] = sp.replace(/^bspr_god_/, ''); else warn(`god "${god}" has no code battle sprite`);
  }
  GOD_BSPR['Caliban'] = 'caliban';
}
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
// ── Shops (CODE-GROUNDED) — one D.shops feeds the unified "Shops" overlay (God / Guild / Arena / Tavern toggle) ──
// _su_extract code/build_shops_true.py: every entry is a typed constructor in scr_<X>ShopSetup resolved by direct
// RUNTIME-id lookup (creature/spell/material/decoration/project-item/... id tables). Replaces the CSV God Shops
// (god_shop_ref) + wiki Guild Shops overlays. Prices AND currency are code (currency: scr_ShopFill MODE/CURRENCY ->
// obj_shop switch; God = each god's Emblem, Guilds = Brimstone/Crystal/Essence/Granite/Power, Arena = Glory, Tavern = Notoriety). Icons/links are joined in enrichShops()
// (after skins are built); every join is counted and unresolved items are warned, never guessed.
const OUT_GUILDBANNER = path.join(OUT_ASSETS, 'guildbanner');
const OUT_SHOPICON = path.join(OUT_ASSETS, 'shopicons');
fs.rmSync(OUT_GUILDBANNER, { recursive: true, force: true });
fs.rmSync(OUT_SHOPICON, { recursive: true, force: true });
const GUILD_ORDER = ['Nature', 'Chaos', 'Sorcery', 'Death', 'Life'];
// wiki Guild Reputation rank that unlocks a guild creature/spell (secondary info, provenance = wiki)
const guildRank = new Map();
for (const r of readJSON(path.join(REF, 'guild_creature_ranks.json')).ranks) guildRank.set(norm(r.guild) + '|' + norm(r.creature), r.rank);
for (const r of readJSON(path.join(REF, 'guild_spell_ranks.json')).ranks) guildRank.set(norm(r.guild) + '|' + norm(r.spell), r.rank);
// god display name from the realm table (code god keys are upper-case: SURATHLI, T'MEREM'RGO, 4080 …)
const godNameByNorm = new Map();
for (const r of (Array.isArray(readJSON(path.join(REF, 'realms_ref.json'))) ? readJSON(path.join(REF, 'realms_ref.json')) : (readJSON(path.join(REF, 'realms_ref.json')).records || []))) {
  const g = String(r.god || '').split(',')[0].trim(); if (g) godNameByNorm.set(norm(g), g);
}
const shopsSrc = readJSON(path.join(MODEL, 'shops.json')).shops;
const slimShopItem = (i) => {
  const o = { kind: i.kind, type: i.type_label || null, name: i.name || null, price: i.price ?? null };
  if (i.id != null) o.id = i.id;
  if (i.key) o.key = i.key;
  if (i.sprite) o.sprite = i.sprite;
  if (i.icon_frame != null) o.iconFrame = i.icon_frame;   // the shop list's fallback art: a frame of the `icons` sheet (inv_ItemIconIndex; extract S50)
  if (i.kind === 'trait_item') o.forCreature = i.for_creature || null;
  if (i.unresolved) o.unresolved = i.unresolved;
  if (i.favor_rank != null) o.favorRank = i.favor_rank;   // God Shop: the item's own scr_GodShopSetup rank guard (code, S32)
  return o;
};
let guildBannerHits = 0;
const shopTab = (key, label, extra) => ({ key, label, ...extra });
// currency icon = frame of the `icons` sheet chosen by inv_ItemIconIndex for the currency item (code; shops.json)
const curIcon = (frame) => (frame != null && copySpriteFrame('icons', frame, OUT_SHOPICON, `cur_${frame}.png`)) ? `assets/shopicons/cur_${frame}.png` : null;
const godShopSrc = shopsSrc.god;
const shops = [
  shopTab('god', 'God', { groups: godShopSrc.gods.map(g => {
    const god = godNameByNorm.get(norm(g.god_key)) || null;
    if (!god) warn(`shop god key ${g.god_key} has no realm god name`);
    return { key: g.god_key, name: god || g.god_key, img: god ? godBattleFor(god) : null, godIndex: g.god_index, currency: g.currency || null, currencyIcon: curIcon(g.currency_icon_frame), items: g.items.map(slimShopItem) };
  }).sort((a, b) => a.name.localeCompare(b.name)) }),
  shopTab('guild', 'Guild', { groups: GUILD_ORDER.map(guild => {
    const slug = guild.toLowerCase(), src = shopsSrc['guild_' + slug];
    let img = null;
    if (copyNamedSprite(`project_guild_${slug}seal`, OUT_GUILDBANNER, `${slug}.png`)) { img = `assets/guildbanner/${slug}.png`; guildBannerHits++; }
    else warn(`guild banner seal missing for ${guild}`);
    const items = src.items.map(slimShopItem).map(it => {
      const rk = guildRank.get(norm(guild) + '|' + norm(it.name)); return rk != null ? { ...it, rank: rk } : it;
    });
    return { key: slug, name: `${guild} Guild`, img, currency: src.currency || null, currencyIcon: curIcon(src.currency_icon_frame), items };
  }) }),
  shopTab('arena', 'Arena', { currency: shopsSrc.arena.currency || null, currencyIcon: curIcon(shopsSrc.arena.currency_icon_frame), items: shopsSrc.arena.items.map(slimShopItem) }),
  shopTab('tavern', 'Tavern', { currency: shopsSrc.tavern.currency || null, currencyIcon: curIcon(shopsSrc.tavern.currency_icon_frame), items: shopsSrc.tavern.items.map(slimShopItem) }),
];
const allShopItems = () => shops.flatMap(s => s.items || s.groups.flatMap(g => g.items));
// Regalis' dust argument is a runtime global in code (not statically resolvable) → name it from God Shop_REF, tagged.
for (const g of shops[0].groups) for (const it of g.items) {
  if (it.kind === 'dust' && !it.name) {
    const ref = (godShopMap.get(g.name) || []).find(r => r.type === 'Crafting Material');
    if (ref) { it.name = ref.item; it.nameSrc = 'csv'; it.type = 'Crafting Material'; delete it.unresolved; }
  }
}
// Favor Rank that unlocks a God Shop item: CODE, `favor_rank` on every god item in shops.json (scr_GodShopSetup's per-item
// `if (scr_GodLevel(god) >= N)` guard; _su_extract/code/HANDOFF_god_shop_favor_rank.md "Answer", S32), copied by
// slimShopItem. The community reference (god_shop_ref "tier", 630 rows, no cosmetics) is now only a cross-check: a
// mismatch warns, the code value is kept (standing rule: CSV errata, not an app override).
{
  const KIND_OF_REF = { 'Mana': 'creature', 'Trait': 'trait_item', 'Inscription': 'spell', 'Heart': 'project_item', 'Crafting Material': 'dust' };
  const refByKey = new Map();
  for (const [god, rows] of godShopMap) for (const r of rows) { const kind = KIND_OF_REF[r.type]; if (r.tier && kind) refByKey.set([norm(god), kind, norm(r.item)].join('|'), r.tier); }
  let n = 0, none = 0; const diff = [];
  for (const g of shops[0].groups) for (const it of g.items) {
    if (it.favorRank == null) { none++; continue; } n++;
    const t = refByKey.get([norm(g.name), it.kind, norm(it.name)].join('|'));
    if (t != null && +t !== it.favorRank) diff.push(`${g.name} / ${it.name}: code ${it.favorRank}, reference ${t}`);
  }
  if (diff.length) warn(`god shop favor rank: code ≠ community reference (code kept): ${diff.join('; ')}`);
  console.log(`  god shop favor ranks (code): ${n} items · ${none} without a rank guard`);
}
for (const sh of shops) for (const g of (sh.groups || [sh])) { if (!g.currency) err(`shop ${sh.key}/${g.key || ''} has no currency`); if (!g.currencyIcon) err(`shop ${sh.key}/${g.key || ''} has no currency icon`); }
console.log(`  shops (code): God ${shops[0].groups.length} gods · ${GUILD_ORDER.length} guilds (${guildBannerHits} banners) · Arena · Tavern · ${allShopItems().length} items`);

// ── boss battle sprites (Appendix boss-trait rows) ────────────────────────────
// DEITY bosses use bspr_god_* (incl. Caliban). NETHER/SPECIAL bosses use spr_crits_battle_<frame> — the
// standard creature convention — human-validated in nether_boss_frames.json (Kiichi=2061, etc.; multi-frame
// bosses like Chroma/Flubris ship their primary frame[0]). Keyed by normalized owner name. False God
// portraits are shipped separately (D.falseGods). Bosses with no frame keep the owner-name chip.
const OUT_BOSSBATTLE = path.join(OUT_ASSETS, 'bossbattle');
fs.rmSync(OUT_BOSSBATTLE, { recursive: true, force: true });
const bossSprites = {};
let deityBoss = 0, netherBoss = 0;
{
  const seen = new Set();
  for (const id in traits) {
    const t = traits[id];
    if (t.ownerType === 'boss' && t.ownerCategory === 'Deity' && t.owner && !seen.has(t.owner)) {
      seen.add(t.owner);
      const p = godBattleFor(t.owner);
      if (p) { bossSprites[norm(t.owner)] = p; deityBoss++; }
      else warn(`Deity boss "${t.owner}" has no bspr_ battle sprite`);
    }
  }
  // Nether/Special: copy each boss's primary spr_crits_battle frame → assets/bossbattle/<slug>.png
  const netherFrames = readJSON(path.join(MODEL, 'nether_boss_frames.json')).bosses || {};
  for (const [boss, frames] of Object.entries(netherFrames)) {
    if (!frames || !frames.length) continue;
    const slug = norm(boss);
    if (copyNamedSprite(`spr_crits_battle_${frames[0]}`, OUT_BOSSBATTLE, `${slug}.png`)) {
      bossSprites[slug] = `assets/bossbattle/${slug}.png`; netherBoss++;
    } else warn(`nether boss "${boss}" frame ${frames[0]} missing`);
  }
}
console.log(`  boss sprites: ${deityBoss} Deity (bspr_) + ${netherBoss} Nether/Special (spr_crits_battle) = ${Object.keys(bossSprites).length}`);

// ── Realms reference ──────────────────────────────────────────────────────────
// realms_ref.json: {god("Name, God of X"), realm, class, godspawn, gemstone, realm_creatures[], other[]}.
// The flat `other` list is section-delimited into FOUR distinct, UNRELATED sections:
//   • encounters             — creatures/bosses/God-Shop you meet in the realm
//   • Resource Objects        — world objects that yield a crafting resource
//   • Unique Realm Objects    — interactable world objects, each "<Name> [baseCount]". The numeric rows
//                               under an object are its per-object milestones; row "0" is its BASE (rank-0)
//                               interaction (Favor [N] / Treasure / Buff·Debuff Realm Boost / Knowledge …).
//   • Unique Realm Traits     — the god's Favor Reward track: {unlock threshold → effect}. Every realm
//                               shares the SAME 18 thresholds (1..100); only the effects differ per realm.
// NOTE: the threshold is a FAVOR tier, NOT "Realm Instability" — instability is the separate, rerollable
// Realm Properties/Threats system (see realmProps). "What makes a realm unique" is computed from the Traits
// ladder + each object's rank-0 base interaction, bucketed into the Favor_MTX outcome categories below.
const realmRecs = readJSON(path.join(REF, 'realms_ref.json'));
const realmArr = Array.isArray(realmRecs) ? realmRecs : (realmRecs.records || Object.values(realmRecs));
const cleanRealmVal = (v) => { const s = (v == null ? '' : String(v)).trim(); return s && s !== 'N/A' && s !== '-' ? s : null; };
function parseRealmOther(other) {
  const encounters = [], resources = [], objects = [], traits = []; let sec = 'enc', cur = null;
  for (const e of other || []) {
    const lbl = (e.label || '').trim(); const val = cleanRealmVal(e.value);
    if (/^Resource\b/i.test(lbl)) { sec = 'res'; continue; }
    if (/^Unique Realm Objects/i.test(lbl)) { sec = 'obj'; continue; }
    if (/^Unique Realm Traits/i.test(lbl)) { sec = 'traits'; continue; }
    if (/^Realm Creatures/i.test(lbl)) { sec = 'enc'; continue; }
    if (sec === 'obj') {
      // "<Name> [baseCount]" begins an object; numeric rows are its milestones — row "0" = base interaction.
      // rows > 0 = the favor ranks that upgrade THIS object (the user's grouping in Realm_REF.csv)
      if (/^\d+$/.test(lbl)) { if (cur && val) { if (lbl === '0') cur.base = val; else cur.favor.push({ at: +lbl, effect: val }); } continue; }
      // an optional "(code: …)" tag after the count = code ≠ reference text; a leading number there is the code's count
      const m = lbl.match(/^(.*?)\s*\[(\d+)\]\s*(?:\(code:\s*([^)]*)\))?\s*$/); const name = (m ? m[1] : lbl).trim();
      const codeCt = m && m[3] && /^\d+/.test(m[3]) ? parseInt(m[3], 10) : null;
      if (cleanRealmVal(name)) {
        cur = { name, baseCount: m ? (codeCt ?? +m[2]) : null, base: null, favor: [] };
        if (m && m[3]) cur.countNote = `Reference says ${m[2]}; the game code: ${m[3]}.`;
        objects.push(cur);
      } else cur = null;
    } else if (sec === 'traits') {
      // the god's Favor Reward track: unlock threshold → effect (shared thresholds, realm-specific effects)
      if (/^\d+$/.test(lbl) && val) traits.push({ at: +lbl, effect: val });
    } else if (sec === 'res') { if (val) resources.push({ object: lbl, resource: val }); }
    else { if (val) encounters.push({ name: lbl, value: val }); }
  }
  return { encounters, resources, objects, traits };
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
  'Blood Grove': 'bg', 'Land of Breath and Balance': 'lobab', 'Temple of Lies': 'tol', 'Frostbite Caverns': 'fc',
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
// ── Favor Reward track data (user-authored CSVs in data/favor/) — the source of truth for realm outcomes ──
// Favor_MTX: per-realm × rank(0..100) matrix of every reward column, in TWO groups — Unique Bonuses (what
// makes a realm unique; the user's weighted averages) and Generic Bonuses (the COMMON favor-rank rewards,
// identical across realms). Favor_REF: the shared 1..100 tier schedule (ranks == "Realm Blessing" are where a
// realm's unique bonus fires; every other rank is the common bonus unlocked there). Favor_MAX: rank-100 snapshot.
// No parser/derivation — the app slides the favor rank and reads these values directly.
const FAVOR_DIR = path.join(ROOT, 'data', 'favor');
function parseFavorCSV(file) {
  const rows = []; let row = [], cur = '', q = false; const txt = fs.readFileSync(path.isAbsolute(file) ? file : path.join(FAVOR_DIR, file), 'utf8');
  for (let i = 0; i < txt.length; i++) { const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch; }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => c && c.trim()));
}
// a MTX/MAX cell → numeric magnitude (null when empty/"-"; % stripped to a number; "X" boolean → 1)
const favCell = (v) => { v = (v || '').trim(); if (!v || v === '-') return null; if (v === 'X') return 1;
  const m = v.match(/^(-?\d+(?:\.\d+)?)%?$/); return m ? +m[1] : null; };
const favUnit = (v) => /%/.test(v || '') ? '%' : (v || '').trim() === 'X' ? 'bool' : '';
const cleanColLabel = (h) => h.replace(/\s*\(.*$/, '').trim();
// Yield model source = CODE (2026-10-10, S27p): _su_extract data/model/realm_yield_model.json, exported by
// code/data_dump/s27/walk/export_yields.py from the per-realm yield walkthroughs (walk/<realm>.py on the shared model
// walk/generic.py; the user's yield rules in code/REALM_YIELDS.md). Per realm × difficulty (relaxed / normal /
// ruthless) × rank 0..100: one value per "yield" column (favor, treasure bundles, net resources, emblems, boosts, spawn
// chances ...). The "common" columns (identical in every realm) are one row per rank. Community copy:
// audit_community_csv/Realm_Yields_CODE.csv. (Favor_CODE.csv / data/favor/Favor_MTX.csv stay as references only.)
const _ym = readJSON(path.join(MODEL, 'realm_yield_model.json'));
const favorCols = { unique: _ym.columns.yield.map(c => ({ ...c, group: 'unique' })),
                    generic: _ym.columns.common.map(c => ({ ...c, group: 'generic' })) };
const favorDiffs = _ym.difficulties;
const favorMatrix = _ym.realms;                              // realm → difficulty → rank → [yield values]
const favorCommonVals = _ym.common;                          // rank → [common values]
// rank-100 cross-realm max per yield column and difficulty (scales the magnitude bars so they grow with rank)
const favorColMax = {};
for (const d of favorDiffs) { favorColMax[d] = {};
  favorCols.unique.forEach((c, i) => { favorColMax[d][c.key] = Math.max(1, ...Object.values(favorMatrix).map(m => (m[d]['100'] || [])[i] || 0)); }); }
// common favor-rank schedule from Favor_REF: rank → {effect, blessing?} (blessing = a realm-unique tier)
const _ref = parseFavorCSV('Favor_REF.csv');
const favorCommon = _ref.slice(1).filter(r => r[0]).map(r => ({ rank: +r[0], effect: (r[1] || '').trim(), blessing: /Realm Blessing/i.test(r[1] || '') }));
console.log(`  yield model: ${Object.keys(favorMatrix).length} realms × ${favorDiffs.length} difficulties × 101 ranks · ${favorCols.unique.length} yield + ${favorCols.generic.length} common cols · ${favorCommon.filter(c => !c.blessing).length} common tiers`);
const realms = realmArr.map((r, i) => {
  const godFull = (r.god || '').trim();
  const godName = godFull.split(',')[0].trim();               // short name (matches god-shop `god`)
  const rName = r.realm || godName;
  const parsed = parseRealmOther(r.other);
  const racr = REALM_ACRONYMS[rName] || null;
  parsed.objects.forEach(u => { u.sprite = realmObjectSprite(rName, u.name, racr); });
  return {
    id: i, god: godFull, godName, realm: r.realm || godName,
    cls: CLASS_SET.has(r.class) ? r.class : null,
    gemstone: cleanRealmVal(r.gemstone), godspawn: cleanRealmVal(r.godspawn),
    icon: realmIconFor(godName), godBattle: godBattleFor(godName),
    creatures: (r.realm_creatures || []).filter(Boolean),
    ...parsed,
  };
});
const shopGods = new Set(shops[0].groups.map(g => g.name));
for (const rm of realms) rm.hasShop = shopGods.has(rm.godName);   // cross-link to the God Shop reference
// complex-interaction combination tables (Combination_REF.csv) — 5 realms with a combine-objects puzzle
// (Tarot Cards / Squash / Music Crystal / Fruit / Chemistry Table). Wide layout: 3 cols per realm at [1,4,7,10,13].
// MUST run before the outcome computation below: a Complex-Interaction object gives no single reward — its
// combo results are distributed as partial credit across categories, weighted by how many of the 10 combos
// yield each result (× the object's base count). e.g. Squash ×3 → 9/10 Resources, 1/10 Debuff → +2.7 / +0.3.
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
// every Favor-track tier should appear under exactly one object in Realm_REF — report any the CSV doesn't place
{
  let placed = 0; const loose = [];
  for (const rm of realms) {
    const ranks = new Set(rm.objects.flatMap(o => o.favor.map(t => t.at)));
    for (const t of rm.traits || []) ranks.has(t.at) ? placed++ : loose.push(`${rm.realm} @${t.at}`);
  }
  console.log(`  favor tiers under realm objects (Realm_REF): ${placed}/${placed + loose.length}`);
  if (loose.length) warn(`favor tiers not listed under any realm object: ${loose.join(', ')}`);
}
// join the Favor-track matrix to each realm by name (Favor_MTX realm names == D.realms[].realm)
let favorJoined = 0;
for (const rm of realms) { if (favorMatrix[rm.realm]) { rm.favor = favorMatrix[rm.realm]; favorJoined++; }
  else warn(`realm "${rm.realm}" has no yield-model entry`); }
{ console.log(`  realms: ${realms.length} · ${realms.reduce((n, r) => n + r.objects.length, 0)} realm objects · ${realms.filter(r => r.hasShop).length} w/ god shop`);
  console.log(`  favor matrix joined: ${favorJoined}/${realms.length} realms`); }
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
// Race icons — CODE-GROUNDED (_su_extract code/extract_icon_maps2.py / ICON_MAPS.md): scr_LangRace(race) returns
// "[<sprite>] <race name>" and that inline sprite is the race icon the game draws. Replaces the name-family heuristic +
// user-confirmed table (5 changed: Amphisbaena=amphis, Arachnalisk=arachna, Mimic=mimic_icon2, Purrghast=coromon,
// Mogwai=monsanc — the crossover races use their crossover-game emblem). Missing → 404 alert, no fallback.
const ICONS2 = readJSON(path.join(MODEL, 'asset_maps_icons2.json'));
const raceIcons = {};
const raceUnresolved = [];
for (const r of Object.values(raceClassIcons.races)) {
  const nm = norm(r.race), code = ICONS2.races[r.race];
  if (code && code.sprite && copyNamedSprite(code.sprite, OUT_RACEICON, `${nm}.png`)) raceIcons[r.race] = `assets/raceicons/${nm}.png`;
  else raceUnresolved.push(r.race);
}
const raceTotal = Object.values(raceClassIcons.races).length;
if (raceUnresolved.length) warn(`404 race icons — no code race sprite, NO fallback substituted (${raceUnresolved.length}): ${raceUnresolved.join(', ')}`);
console.log(`  tile icons: ${Object.keys(classIcons).length}/5 class · ${Object.keys(raceIcons).length}/${raceTotal} race · ${raceUnresolved.length} unresolved (404, no fallback)`);

// Nether-stone icons — CODE-EXACT (_su_extract code/NETHER.md): inv_NetherStoneCreate rolls
// icon = irandom_range(2085, 2100), a frame of the `icons` sheet, PRE-COLOURED (incl. two-tone / gradient borders);
// a stone stores no colour data and no shader tints it. Frames 2085–2094 = cornether_7..16, 2095–2100 = cornether_1..6
// (the uncoloured source art). Keys stay `nether_<cornether n>` so saved stones keep their shape. Picker = game order.
fs.rmSync(OUT_GEM, { recursive: true, force: true });
const gemIcons = [];
for (let f = 2085; f <= 2100; f++) {
  const n = f <= 2094 ? f - 2085 + 7 : f - 2095 + 1;
  const dest = `stone_${f}.png`;   // new filename (not nether_<n>.png): the SW asset cache is URL-keyed, so the
                                   // old grey cornether art at the old URLs would otherwise stay cached forever
  if (copySpriteFrame('icons', f, OUT_GEM, dest)) gemIcons.push({ key: `nether_${n}`, frame: f, path: `assets/gems/${dest}` });
  else err(`nether icon frame icons_${f} missing`);
}

// Nether-stone GENERATION RULES — code-grounded (_su_extract code/extract_nether_generation.py, inv_NetherStoneCreate /
// inv_NetherStoneGetStat / inv_NetherStoneRarity). Per stone: ≤6 stat/trick props (no duplicates), ≤3 traits (only traits
// with an artifact trait-item), ≤3 spells. Each prop has a tier ≥10; value = f(tier) per stat group (+ cap). Joined to the
// app's artifact property names; every one of the 62 code pool ids must map.
const netherGen = (() => {
  const g = readJSON(path.join(MODEL, 'nether_generation.json'));
  const STAT = { health: 'Health', attack: 'Attack', intelligence: 'Intelligence', defense: 'Defense', speed: 'Speed' };
  const appName = (nm) => {
    const st = [...nm.matchAll(/\{STAT_(\w+)\}/g)].map(m => STAT[m[1]]);
    return st.length ? st.join(' / ') : nm;
  };
  const grp = new Map(); for (const v of g.value_groups) for (const id of v.stat_ids) grp.set(id, v);
  const caps = {}; for (const [k, cap] of Object.entries(g.value_caps || {})) { const ids = (k.match(/\(([\d,]+)\)/) || [, ''])[1].split(',').map(Number); ids.forEach(i => { caps[i] = cap; }); }
  const appProps = new Set([...artGroup.stat, ...artGroup.trick].map(x => x.property));
  const props = {};
  for (const p of g.props.pool) {
    const name = appName(p.name), v = grp.get(p.id);
    if (!appProps.has(name)) err(`nether pool stat ${p.id} "${name}" has no app artifact property`);
    if (!v) err(`nether pool stat ${p.id} "${name}" has no value formula`);
    props[name] = { id: p.id, base: v.base, mult: v.mult ?? null, div: v.div ?? null, cap: caps[p.id] ?? null };
  }
  const missing = [...appProps].filter(n => !props[n]);
  if (missing.length) err(`app artifact properties not in the nether pool: ${missing.join(', ')}`);
  return { limits: g.limits, tierStart: 10, props, score: { prop: 10, trait: 150, spell: 75 } };
})();
console.log(`  nether generation rules: ${Object.keys(netherGen.props).length} props · limits ${JSON.stringify(netherGen.limits)}`);

// ── plain-language term map (labels.json) — turns {TOKEN} params into UI words ──
const labelsMap = readJSON(path.join(SRC, 'labels.json')).labels;
// Display-name overrides for condition tokens whose extracted label is a mashed single word
// (the game stores e.g. "Animatedgem"/"Brimfiend"/"Zombie"; proper UI names are multi-word / pluralized).
// Keyed by the full CONDNAME token so it patches BOTH the runtime {TOKEN} humanizer (terms → app.js
// termWord) AND the baked glossary/prose names (condName below) from one source. Icon slugs are keyed off
// the stable CONDNAME suffix, NOT these display names, so overriding here never disturbs the icon join.
const CONDNAME_OVERRIDE = {
  CONDNAME_MINION_ANIMATEDGEM: 'Animated Gem',
  CONDNAME_MINION_ANIMATEDWEAPON: 'Animated Weapon',
  CONDNAME_MINION_BRIMFIEND: 'Brim Fiends',
  CONDNAME_MINION_CHAOSSATYR: 'Chaos Satyrs',
  CONDNAME_MINION_FIREIMP: 'Fire Imps',
  CONDNAME_MINION_GUARDIANOFSURATHLI: 'Guardian of Surathli',
  CONDNAME_MINION_LITTLETORUN: 'Torun Junior',
  CONDNAME_MINION_MICROBOT: 'Microbots',
  CONDNAME_MINION_SPIDERLING: 'Spiderlings',
  CONDNAME_MINION_UNSTABLEHORROR: 'Unstable Horror',
  CONDNAME_MINION_WRITHELING: 'Writhelings',
  CONDNAME_MINION_ZOMBIE: 'Zombies',
};
const terms = {};
for (const [k, v] of Object.entries(labelsMap)) terms[k] = (v && v.name) || k;
// CODE-GROUNDED token words (user, 2026-10-13: real display names, never inferred): _su_extract token_names.json =
// exactly what the game's text renderer (process_complex_macros -> scr_LangStat / scr_LangAction / scr_LangCondition /
// scr_LangRace / scr_LangClass / scr_LangSpellType / scr_LangSpec / scr_LangTimeline) prints for each {TOKEN}.
const TOKEN_NAMES = readJSON(path.join(MODEL, 'token_names.json')).tokens;
for (const [k, v] of Object.entries(TOKEN_NAMES)) terms[k] = v.text;
for (const [k, v] of Object.entries(CONDNAME_OVERRIDE))      // the old hand list must agree with the code (it did, minus Direwolf)
  if (TOKEN_NAMES[k] && TOKEN_NAMES[k].text !== v) warn(`token ${k}: hand name "${v}" replaced by the game's "${TOKEN_NAMES[k].text}"`);
// {SPELL_*} spell-type tokens → the game's glossary words. scr_LangSpellType maps the token list
// [equipment, alcohol, jewel, ultimate] to L_ARSENALSPELL / L_BOOZESPELL / L_PRISMSPELL / L_ULTIMATESPELL (same switch as
// its [spell_artifact]/[spell_booze]/[spell_jewel]/[spell_ultimate] icon tags). Without this the humanizer fell back
// to the raw token name ("Equipment", "Alcohol").
{
  const vocab = loadLoc('vocabulary.csv');
  const SPELL_TYPE_TOKENS = { SPELL_equipment: 'L_ARSENALSPELL', SPELL_alcohol: 'L_BOOZESPELL', SPELL_jewel: 'L_PRISMSPELL', SPELL_ultimate: 'L_ULTIMATESPELL' };
  for (const [tok, key] of Object.entries(SPELL_TYPE_TOKENS)) {
    const word = vocab.get(key);
    if (word) terms[tok] = word; else err(`spell-type token ${tok}: ${key} missing from vocabulary.csv`);
  }
}

// ── damage / stat model (for fusion + future DPS sim) ──
const damageModel = readJSON(path.join(MODEL, 'damage_model.json'));

// ── creature-AI Macro vocabulary (targets/conditions/actions) — feeds the Macro Proposal engine.
// Grounded in SiralimUltimate.exe scr_Macro* + L_MACRO_* localization (see _su_extract/code/MACRO_MODEL.md).
const macroVocab = readJSON(path.join(MODEL, 'macro_vocab.json'));

// ── Buff / Debuff / Minion glossary — L_CDESC_* prose from vocabulary.csv + CONDNAME_* names (labels.json),
// with runtime tokens ({CONDNAME_*}/{STAT_*}/{ACTION_*}) expanded to plain text. 65 conditions. ──
const STAT_TOK = { health: 'Health', attack: 'Attack', intelligence: 'Intelligence', defense: 'Defense', speed: 'Speed', mana: 'Mana' };
const condName = (cat, suf) => {
  const t = TOKEN_NAMES[`CONDNAME_${cat}_${suf}`];
  if (!t) err(`condition token CONDNAME_${cat}_${suf}: not in token_names.json`);
  return t ? t.text : suf;
};
const expandCond = (t) => {
  if (!t) return '';
  return t
    .replace(/\{CONDNAME_(BUFF|DEBUFF|MINION)_([A-Z0-9]+)\}/g, (_, c, s) => condName(c, s))
    .replace(/\{(STAT|ACTION)_([a-z]+)\}/g, (m, f, w) => (TOKEN_NAMES[`${f}_${w}`] || {}).text || (err(`token ${m}: not in token_names.json`), w))
    .replace(/\{[^}]+\}/g, (m) => { const p = m.slice(1, -1).split('_').pop(); return p[0] + p.slice(1).toLowerCase(); })
    .replace(/\s+/g, ' ').trim();
};
const conditions = [];
for (const r of parseCSVRaw(fs.readFileSync(path.join(REF, '..', 'localization', 'vocabulary.csv'), 'utf8'))) {
  const m = /^L_CDESC_(BUFF|DEBUFF|MINION)_(.+)$/.exec(r[0] || '');
  if (!m) continue;
  const cat = m[1][0] + m[1].slice(1).toLowerCase();   // Buff / Debuff / Minion
  // `key` = the stable CONDNAME suffix (icon-slug source, immune to display-name overrides)
  conditions.push({ cat, key: m[2].toLowerCase().replace(/[^a-z0-9]/g, ''), name: condName(m[1], m[2]), desc: expandCond(r[2] || '') });
}
conditions.sort((a, b) => a.cat.localeCompare(b.cat) || a.name.localeCompare(b.name));

// Condition icons = scr_GetConditionIcon(condition id) (code; asset_maps.conditions, joined by the registry's CONDNAME
// key/name). Replaces the prefix + alias + override heuristic. Conditions with no code condition id (none expected)
// are reported, never guessed.
fs.rmSync(OUT_CONDICON, { recursive: true, force: true });
let condIconHits = 0;
{
  const byKey = new Map(), byName = new Map();
  for (const c of Object.values(ASSET_MAPS.conditions)) {
    if (!c.sprite) continue;
    if (c.key) byKey.set(norm(c.key), c.sprite);
    if (c.name) byName.set(norm(c.name), c.sprite);
  }
  const miss = [];
  for (const c of conditions) {
    const base = byKey.get(c.key) || byName.get(norm(c.name)) || byName.get(c.key);
    const dest = `${c.cat.toLowerCase()}_${c.key}.png`;
    if (base && copyNamedSprite(base, OUT_CONDICON, dest)) { c.icon = `assets/condicons/${dest}`; condIconHits++; }
    else miss.push(`${c.cat}:${c.name}`);
  }
  if (miss.length) warn(`conditions without a code icon: ${miss.join(', ')}`);
}

// Condition taxonomy — per-description classification against the canonical vocabulary (identity Related
// tag + semantic tags), generated by _su_extract/code/build_condition_tags.mjs. Attach as the same
// taxo/taxoSrc parallel arrays traits use, so the entity taxonomy viewer renders conditions identically.
const condTags = readJSON(path.join(MODEL, 'condition_taxonomy_tags.json'));
let condTagged = 0;
for (const c of conditions) {
  const tags = condTags[`${c.cat}:${c.key}`] || [];
  c.taxo = tags.map(t => `${t.cat}::${t.val}`);
  c.taxoSrc = tags.map(t => t.src);
  if (tags.length) condTagged++;
}

// Minion exclusivity — a handful of minion statuses are summoned only by one specialization, spell, or
// creature. Tag each with its source + a small emblem/sprite icon (spec emblem, creature sprite, or class
// gem), mirroring the Appendix stacking glyphs. `show:false` withholds the icon+prose from the UI while
// keeping the record in the JSON (Guardian of Surathli has no emblem art yet — a feature toggle, not a drop).
const specEmblem = (label) => { const s = specs.find(x => x.label === label); return s ? s.emblem : null; };
const creatureSprite = (name) => { const c = creatures.find(x => x.name === name); return c ? c.sprite : null; };
// Greater + Lesser Demons: the Demonologist's summoned Inner Demons (desc: "This minion is a … Demon").
const DEMON_KEYS = ['asmodeus', 'beelzebub', 'belphegor', 'lucifer', 'mammon', 'satanachia', 'leviathan', 'brimfiend', 'chaossatyr', 'fireimp'];
const EXCLUSIVE = {};
for (const k of DEMON_KEYS) EXCLUSIVE[k] = { source: 'Demonologist', kind: 'spec', icon: specEmblem('Demonologist'), show: true };
EXCLUSIVE.microbot           = { source: 'Engineer',         kind: 'spec',     icon: specEmblem('Engineer'),      show: true };
EXCLUSIVE.amalgamation       = { source: 'Necromancer',      kind: 'spec',     icon: specEmblem('Necromancer'),   show: true };
EXCLUSIVE.illusion           = { source: 'Yseros',           kind: 'creature', icon: creatureSprite('Yseros'),    show: true };
EXCLUSIVE.littletorun        = { source: 'Torun Attunement', kind: 'gem',      icon: spellGems.Nature,            show: true };
EXCLUSIVE.guardianofsurathli = { source: 'Surathli',         kind: 'spec',     icon: null,                        show: false };
let exclusiveTagged = 0;
for (const c of conditions) {
  const ex = EXCLUSIVE[c.key];
  if (!ex) continue;
  if (ex.show && !ex.icon) err(`exclusive minion "${c.key}" has no source icon`);
  c.exclusive = ex; exclusiveTagged++;
}
console.log(`  conditions glossary: ${conditions.length} (${['Buff', 'Debuff', 'Minion'].map(c => c + ' ' + conditions.filter(x => x.cat === c).length).join(' · ')}) · icons ${condIconHits}/${conditions.length} · taxo ${condTagged}/${conditions.length} · exclusive ${exclusiveTagged}`);

// ── player wardrobe (every equippable player costume; names/tiers pre-resolved in wardrobe.json) ──
// Pull EVERY costume sprite into assets/wardrobe/<sprite>.png; consume the enriched extract artifact.
fs.rmSync(OUT_WARDROBE, { recursive: true, force: true });
fs.mkdirSync(OUT_WARDROBE, { recursive: true });
const wardrobeRecs = readJSON(path.join(MODEL, 'wardrobe.json')).records;
let wardrobeCopied = 0, wardrobeMissing = 0, wardrobeAnim = 0;
const nameSrc = { class_vocab: 0, L_WD: 0, derived: 0 };
const wardrobe = [];
for (const w of wardrobeRecs) {
  const ok = copyNamedSprite(w.sprite, OUT_WARDROBE, `${w.sprite}.png`);
  if (ok) wardrobeCopied++; else { wardrobeMissing++; warn(`wardrobe costume "${w.sprite}" has no PNG`); }
  const img = ok ? `assets/wardrobe/${w.sprite}.png` : null;
  // second front-facing frame → the 2-frame idle/walk animation (same mechanism spec costumes use).
  // img is frame 0 (copyNamedSprite prefers <sprite>_0.png); frame 1 is <sprite>_1.png. `frames` = [f0,f1]
  // when both exist, else null (no animation). Renamed the old numeric sheet-frame count to `frameCount`.
  const has1 = ok && copySpriteFrame(w.sprite, 1, OUT_WARDROBE, `${w.sprite}_1.png`);
  const frames = has1 ? [img, `assets/wardrobe/${w.sprite}_1.png`] : null;
  if (frames) wardrobeAnim++;
  nameSrc[w.name_source] = (nameSrc[w.name_source] || 0) + 1;
  wardrobe.push({ sprite: w.sprite, key: w.sprite, name: w.name, name_source: w.name_source,
                  spec: w.spec, stem: w.stem, tier: w.tier, variant: w.variant,
                  category: w.category, frameCount: w.frames, frames, order: w.order, img });
}
// spec costume tiers 1/2/3 — from _su_extract data/model/spec_costumes.json (code/extract_spec_costumes.py):
// tiers = the wardrobe entries the game names "<Spec> (Tier N)" (L_WD_*_TIER_N), tier 1 cross-checked vs
// scr_SpecializationCostume. Replaces the old
// hand-written SPEC_COSTUME_OVERRIDE + stem heuristic (which missed Hell Knight's npc_hell_knight_2/_3).
const specCostumeById = new Map(readJSON(path.join(MODEL, 'spec_costumes.json')).records.map(r => [r.spec_id, r.tiers]));
let specCostumes = 0;
for (const s of specs) {
  const tiers = specCostumeById.get(s.id) || [];
  const chosen = tiers.map((sprite, i) => ({ sprite, tierNum: i + 1, variant: null, img: `assets/wardrobe/${sprite}.png` }))
    .filter(w => copyNamedSprite(w.sprite, OUT_WARDROBE, `${w.sprite}.png`));
  if (chosen.length !== 3) warn(`spec "${s.label}" has ${chosen.length}/3 tier costumes (${tiers.join(', ')})`);
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
console.log(`  cards w/ art ${cardArt}/${cards.length} · power thresholds from code ${cardTierCode}/${cards.length} · artifact-type icons ${artGroup.primary.filter(p => p.icon).length}/5 · gem icons ${gemIcons.length} · class bgs ${Object.keys(classBg).length}`);
console.log(`  spec sprites: ${specSkins} real skins + ${specs.filter(s => s.spriteKind === 'icon').length} emblem icons · ${emblemCount}/${specs.length} 16×16 emblems · terms ${Object.keys(terms).length}`);
  console.log(`  perk cost/ranks: ${perkCsvFilled} perk(s) filled from Perk_REF.csv where code has no value`);
  console.log(`  perk icons: ${perkIconsCopied} copied (code-certain from perk_icons.json)${perkIconsMissing ? ` · ${perkIconsMissing} missing` : ' · 100%'}`);
  console.log(`  perk flags (code): ${anointFlagged} anointable · ${specs.reduce((n, s) => n + s.perks.filter(p => p.ascension).length, 0)} ascension`);
  console.log(`  False Gods: ${falseGods.length} with specs · ${specs.length - specGodMisses}/${specs.length} specs mapped${fgodImgMisses ? ` · ${fgodImgMisses} composites MISSING (run tools/build_falsegods.py)` : ' · composites ✓'}`);
  console.log(`  wardrobe: ${wardrobeCopied} player costumes copied (code-certain)${wardrobeMissing ? ` · ${wardrobeMissing} missing` : ''} · ${wardrobeAnim} with a 2-frame animation · ${specCostumes}/${specs.length} specs linked (3 tiers, code-named)`);
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
  collect([creatures, specs, raceIcons, classIcons, classBg, classFrame, traitItems, statMats, trickMats, relics, cards, gemIcons, spellGems, wardrobe, artGroup]);
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
// CODE-GROUNDED owners (_su_extract code/extract_skin_owners.py / SKINS_AND_FUSION.md, 2026-10-01): scr_DatabaseSkins
// skin[i][1] = a race-name string (skin fits any creature of that race) or a creature id (fits that creature only);
// enforced by the skin-apply handler. Replaces the sprite-name heuristic (skins.json) and its boss "exclusions" — the
// 37 boss-named skins are real race-restricted skin records in code. Same order + frames as skins.json, whose
// skin_id was shifted, so D.skinIdMigration maps old (shifted) ids -> code ids for saved builds.
const skinRecs = readJSON(path.join(MODEL, 'skin_owners.json')).records;
const SKIN_ID_MIGRATION = {};
{
  const oldRecs = readJSON(path.join(MODEL, 'skins.json')).records;
  if (oldRecs.length !== skinRecs.length) err(`skin id migration: skins.json ${oldRecs.length} vs skin_owners.json ${skinRecs.length} records`);
  oldRecs.forEach((o, i) => {
    const n = skinRecs[i]; if (!n) return;
    if (o.sprite_frame !== n.sprite_frame) err(`skin id migration: record ${i} frame ${o.sprite_frame} != ${n.sprite_frame}`);
    if (o.skin_id !== n.skin_id) SKIN_ID_MIGRATION[o.skin_id] = n.skin_id;
  });
}
const creNameSet = new Set(creatures.map(c => c.name));
const creNameByNorm = new Map(creatures.map(c => [norm(c.name), c.name]));
const creRaceSet = new Set(creatures.map(c => c.race).filter(Boolean));
const skins = [];
let skinUnresolved = 0, skinFrameMissing = 0;
const skinFrames = new Set();
for (const s of skinRecs) {
  let race = null, creatureName = null;
  if (s.restriction === 'race') {
    if (!s.race || !creRaceSet.has(s.race)) { warn(`skin "${s.name}" race "${s.race}" not in roster`); skinUnresolved++; continue; }
    race = s.race;
  } else if (s.restriction === 'creature') {
    const rosterName = s.creature ? creNameByNorm.get(norm(s.creature)) : null;   // roster spelling (e.g. Grom'met vs code Grom'Met)
    if (!rosterName) { warn(`skin "${s.name}" locked to "${s.creature}" (id ${s.creature_id}) — not in roster`); skinUnresolved++; continue; }
    creatureName = rosterName;
  } else { skinUnresolved++; continue; }
  const frame = s.sprite_frame == null ? null : canonFrame(s.sprite_frame);   // kept byte-twin (cleanup-safe)
  if (frame == null) { skinUnresolved++; continue; }
  const srcPng = path.join(SRC_BATTLE, `spr_crits_battle_${frame}.png`);
  if (!fs.existsSync(srcPng)) { warn(`skin "${s.name}" battle frame ${frame} missing (404-source)`); skinFrameMissing++; continue; }
  if (!skinFrames.has(frame)) { fs.copyFileSync(srcPng, path.join(OUT_SKIN, `${frame}.png`)); skinFrames.add(frame); }
  skins.push({ id: s.skin_id, name: s.name, restriction: s.restriction, race, creature: creatureName, img: `assets/skins/${frame}.png` });
  FUSE_SKIN_FRAME[s.skin_id] = s.sprite_frame;
}
console.log(`  skins: ${skins.length} applicable (${skinFrames.size} frames, code-grounded owners) · ${Object.keys(SKIN_ID_MIGRATION).length} old ids remapped · ${skinUnresolved} unresolved-skip${skinFrameMissing ? ` · ${skinFrameMissing} frame-missing(404)` : ''}`);

// ── Threats advisor: Realm Properties (instability) + False God Runes ───────────────────────
// Both systems are "enemy modifiers that make a fight harder". A build tool reads the build's
// THEME off its taxonomy tags (Action/Mechanic values), then flags which modifiers directly
// COUNTER that theme so the player can reroll realm properties / skip runes accordingly. Effect
// text is authoritative from the durable extracts (runes.json / realm_properties.json); the
// theme→counter mapping below is authored logic grounded on each modifier's effect wording.
const runesRaw = readJSON(path.join(MODEL, 'runes.json'));
const realmPropsRaw = readJSON(path.join(MODEL, 'realm_properties.json'));

// The build intents we can detect, by taxonomy v2 Theme (objects' theme2; the old Action/Mechanic values).
const BUILD_THEMES = [
  { key: 'attack',   label: 'Attack',           themes: ['Attack'] },
  { key: 'cast',     label: 'Cast / Spells',    themes: ['Cast', 'Spell Gems'] },
  { key: 'indirect', label: 'Indirect Damage',  themes: ['Indirect Damage'] },
  { key: 'crit',     label: 'Critical',         themes: ['Critical'] },
  { key: 'buff',     label: 'Buffs',            themes: ['Buff'] },
  { key: 'debuff',   label: 'Debuffs',          themes: ['Debuff'] },
  { key: 'dodge',    label: 'Dodge',            themes: ['Dodge'] },
  { key: 'heal',     label: 'Healing',          themes: ['Healing'] },
  { key: 'minion',   label: 'Minions',          themes: ['Minion'] },
  { key: 'provoke',  label: 'Provoke / Defend', themes: ['Provoke', 'Defend'] },
  { key: 'stats',    label: 'Stat Stacking',    themes: ['Stats'] },
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
// (retired 2026-10-13: runes show their game label L_RUNE_NAME_<KEY>; this hand list is kept only as a record)
const RUNE_NAME_RETIRED = {
  ALWAYSCRIT: 'Always Crit', AVOIDDAMAGE: 'Avoids Damage', DAMAGECAP: 'Damage Cap',
  DAMAGEOVERTIME: 'Damage Over Time', DEBUFFS: 'Mass Debuffs', DOMOREDAMAGE: 'Deals More Damage',
  IMMUNEATTACKS: 'Immune to Attacks', IMMUNEINDIRECT: 'Immune to Indirect', IMMUNESPELLS: 'Immune to Spells',
  LOSELESSSTATS: 'Keeps Its Stats', MOREATTACK: 'More Attack', MOREDEFENSE: 'More Defense',
  MOREHEALTH: 'More Health', MOREINTELLIGENCE: 'More Intelligence', MORESPEED: 'More Speed',
  RANDOMBUFF: 'Mass Buffs', TAKELESSDAMAGE: 'Takes Less Damage', TOPOFTIMELINE: 'Top of Timeline',
};
// Threat icons — CODE-GROUNDED (asset_maps_icons2.json): runes = scr_RuneSprite(rune id); realm properties = the inline
// "[realmprop_*]" sprite tag in the property's own localized name (scr_RealmPropertyName). Joined by key; 404-alerted.
const OUT_THREAT = path.join(OUT_ASSETS, 'threats');
fs.rmSync(OUT_THREAT, { recursive: true, force: true });
const threatIcon = (sprite, what) => {
  if (!sprite) { warn(`threat icon: ${what} has no code sprite`); return null; }
  if (!copyNamedSprite(sprite, OUT_THREAT, `${sprite}.png`)) { warn(`threat icon: ${what} sprite "${sprite}" missing (404)`); return null; }
  return `assets/threats/${sprite}.png`;
};
const runes = runesRaw.runes.map(r => ({
  key: r.key, name: r.effect || (err(`rune ${r.key}: no L_RUNE_NAME text`), r.key), effect: r.effect,   // game label = L_RUNE_NAME_<KEY>
  rewardPct: r.reward_bonus_pct ?? null,     // scr_RuneBonusRep (code, S15) — shown as the game's "+{1}% Rewards"
  icon: threatIcon((ICONS2.runes_app_join[r.key] || {}).sprite, `rune ${r.key}`),
  counters: RUNE_COUNTERS[r.key] || [], counterClass: null,
  general: !RUNE_COUNTERS[r.key],
}));
// Realm property conflict rules + true maximum realm bonus — CODE (2026-10-09, S27n; _su_extract
// data/model/realm_property_rules.json from scr_RealmGetProperties): the hidden pool rejects player-penalty ids, ids never
// repeat across both pools, 7 Same Race <-> 16 Inhabited By are exclusive. visibleOnly = can't be a hidden property.
const rpRules = readJSON(path.join(MODEL, 'realm_property_rules.json'));
const rpKeyById = {};
for (const [id, nm] of Object.entries(readJSON(path.join(SRC, 'code', 'data_dump', 's27', 'realmprop_names.json'))))
  rpKeyById[id] = String((nm[0] || [])[0] || '').replace(/^L_REALM_/, '');
const rpHiddenBanned = new Set(rpRules.rules.hidden_banned.map(i => rpKeyById[i]));
const realmBonusMax = Object.fromEntries(Object.entries(rpRules.max_bonus).map(([ri, m]) => [ri, { deep: m.realm_bonus_deepest, below: m.realm_bonus_below_deepest }]));
// Display name = the game's L_REALM_<KEY> text (scr_RealmPropertyName; user 2026-10-13: real names, not curated). The game
// prints the rolled value in it ("Extra Attack: 25%"); the planner has no rolled value, so it shows X in its place.
const rpName = (p) => {
  if (!p.code_name) { err(`realm property ${p.key}: no code_name (L_REALM_${p.key})`); return p.name; }
  const n = p.code_name.replace(/\{1\}/g, 'X').trim();     // the rolled value shown as X ("Extra Attack: X%", "Buff: X")
  if (/[{}]/.test(n)) err(`realm property ${p.key}: name still has a token: ${n}`);
  return n;
};
const realmProps = realmPropsRaw.properties
  .filter(p => !REALM_NEUTRAL.has(p.key))
  .map(p => ({
    key: p.key, name: rpName(p), effect: p.effect, visibleOnly: rpHiddenBanned.has(p.key) || undefined,
    icon: threatIcon((ICONS2.realm_properties_app_join[p.key] || {}).sprite, `realm property ${p.key}`),
    counters: REALM_COUNTERS[p.key] || [], counterClass: REALM_COUNTER_CLASS[p.key] || null,
    general: !(REALM_COUNTERS[p.key] || REALM_COUNTER_CLASS[p.key]),
  }));
// sanity: every authored counter/theme references a real theme key
{
  const themeKeys = new Set(BUILD_THEMES.map(t => t.key));
  for (const m of [...runes, ...realmProps])
    for (const c of m.counters) if (!themeKeys.has(c)) throw new Error(`threats: unknown theme key "${c}" on ${m.key}`);
  console.log(`  threats: ${realmProps.length} realm properties · ${runes.length} runes · ${BUILD_THEMES.length} themes · icons ${[...runes, ...realmProps].filter(m => m.icon).length}/${runes.length + realmProps.length}`);
}

// ── Per-object audit overrides (from the 2-agent precision+recall audit; confirmed = both reviewers agreed).
// Applied AFTER correctTaxo as a precise, reviewable last layer: data/reference/taxonomy_audit_overrides.json
// maps ref ("trait:id" | "spell:id" | "perk:<specId>:<key>" | "relic:id" | "card:id") -> {add:[], remove:[]}.
const AUDIT_OV_PATH = path.join(ROOT, 'data', 'reference', 'taxonomy_audit_overrides.json');
const auditOv = fs.existsSync(AUDIT_OV_PATH) ? readJSON(AUDIT_OV_PATH) : {};
let auditAdds = 0, auditRems = 0, auditHits = 0;
const applyAudit = (ref, e) => {
  const o = auditOv[ref]; if (!o) return;
  auditHits++;
  const t = e.taxo || (e.taxo = []); const s = e.taxoSrc || (e.taxoSrc = t.map(() => 'derived'));
  for (const tag of (o.remove || [])) { const i = t.indexOf(tag); if (i >= 0) { t.splice(i, 1); s.splice(i, 1); auditRems++; } }
  for (const tag of (o.add || [])) { if (!t.includes(tag)) { t.push(tag); s.push('audit'); auditAdds++; } }
};
for (const tr of Object.values(traits)) applyAudit('trait:' + tr.id, tr);
for (const sp of spells) applyAudit('spell:' + sp.id, sp);
for (const sc of specs) for (const p of (sc.perks || [])) applyAudit('perk:' + sc.id + ':' + p.key, p);
for (const rl of relics) applyAudit('relic:' + rl.id, rl);
for (const cd of cards) applyAudit('card:' + cd.id, cd);
console.log(`  audit overrides: ${Object.keys(auditOv).length} defined · ${auditHits} matched · +${auditAdds} tags · -${auditRems} tags (src=audit)`);

// ── Related Minion — values added 2026-10-03 from the perk decode (minions the taxonomy lacked). Grounded on the game's
// own {CONDNAME_MINION_<KEY>} description token (or the minion's exact name) across traits/perks/spells/relics/cards.
// The data carries EVERY value; the app's "hide single-object tags" toggle decides what is displayed (user rule).
// Single minions keep their own value; demon sets collapse into one value each, like Four Horsemen. The game classifies
// them itself: each minion's description ends "This minion is a Greater/Lesser Demon."
const NEW_MINIONS = { 'Unstable Horror': ['UNSTABLEHORROR'], Doppelganger: ['DOPPELGANGER'], Amalgamation: ['AMALGAMATION'],
  'Greater Demons': ['ASMODEUS', 'BEELZEBUB', 'MAMMON', 'LEVIATHAN', 'BELPHEGOR', 'SATANACHIA', 'LUCIFER'],
  'Lesser Demons': ['BRIMFIEND', 'FIREIMP', 'CHAOSSATYR'] };
// exact game wording also references a whole set ("your creatures' Greater Demons", "Lesser or Greater Demons")
const MINION_PHRASE = { 'Greater Demons': /\bgreater demons?\b/i, 'Lesser Demons': /\blesser (or greater )?demons?\b/i };
{
  let added = 0;
  const tagMinions = (e, text) => {
    const t = e.taxo || (e.taxo = []), s2 = e.taxoSrc || (e.taxoSrc = t.map(() => 'derived'));
    const raw = String(text || ''), flat = raw.toUpperCase().replace(/[\s_]/g, '');
    for (const [name, keys] of Object.entries(NEW_MINIONS)) {
      const viaToken = keys.some(k => flat.includes('CONDNAMEMINION' + k));
      const viaPhrase = MINION_PHRASE[name] ? MINION_PHRASE[name].test(raw) : new RegExp(`\\b${name}\\b`, 'i').test(raw);
      if (!viaToken && !viaPhrase) continue;
      const tag = 'Related Minion::' + name;
      if (!t.includes(tag)) { t.push(tag); s2.push('token'); added++; }
    }
  };
  for (const tr of Object.values(traits)) tagMinions(tr, tr.desc);
  for (const sp of spells) tagMinions(sp, sp.desc);
  for (const sc of specs) for (const pk of sc.perks || []) tagMinions(pk, pk.desc);
  for (const rl of relics) tagMinions(rl, JSON.stringify(rl.ranks || rl.effects || rl.desc || ''));
  for (const cd of cards) tagMinions(cd, JSON.stringify(cd.levels || cd.effects || cd.desc || ''));
  const cat = taxonomy.categories.find(c => c.category === 'Related Minion');
  if (cat) for (const name of Object.keys(NEW_MINIONS)) if (!cat.values.includes(name)) cat.values.push(name);
  console.log(`  related minion (new values): +${added} tags across ${Object.keys(NEW_MINIONS).length} values`);
}

// ── CODE-GROUNDED taxonomy (_su_extract code/build_code_taxo.py → data/model/code_taxo.json, from the decoded trait
// signatures).
//   1. APPROVED changes (data/reference/code_taxo_approved.json `changes`: explicit {replace:[{from,to}], add:[]} per
//      runtime trait id) are applied FIRST and stored explicitly, so regenerating code_taxo.json can never undo them.
//   2. confirm: every tag the code backs → provenance 'code' (tag unchanged).
//   3. replace/add proposals in code_taxo.json not yet in the approved file are REPORTED (pending review), not shipped.
{
  const CT = readJSON(path.join(MODEL, 'code_taxo.json')).traits;
  const APPROVED_PATH = path.join(ROOT, 'data', 'reference', 'code_taxo_approved.json');
const TRAIT_REJECT = fs.existsSync(APPROVED_PATH) ? (readJSON(APPROVED_PATH).traitRejections || {}) : {};
  const APPROVED = fs.existsSync(APPROVED_PATH) ? (readJSON(APPROVED_PATH).changes || {}) : {};
  let conf = 0, repl = 0, adds = 0, pending = 0, pendingTraits = [];
  for (const tr of Object.values(traits)) {
    const t = tr.taxo, s2 = tr.taxoSrc;
    for (const rid of tr.runtimeIds || []) {
      const ap = APPROVED[String(rid)];
      if (ap) {
        for (const r of ap.replace || []) {
          for (const from of r.from) { const i = t.indexOf(from); if (i >= 0) { t.splice(i, 1); s2.splice(i, 1); } }
          if (r.to && !t.includes(r.to)) { t.push(r.to); s2.push('code'); repl++; }
        }
        for (const tag of ap.add || []) if (!t.includes(tag)) { t.push(tag); s2.push('code'); adds++; }
      }
      const c = CT[String(rid)]; if (!c) continue;
      for (const tag of c.confirm) { const i = t.indexOf(tag); if (i >= 0 && s2[i] !== 'code') { s2[i] = 'code'; conf++; } }
      const rejT = new Set((TRAIT_REJECT[String(rid)] || []));   // user-rejected trait proposals (by target tag)
      const open = [...c.replace.filter(r => !PREAPPROVED_TAGS.has(r.to) && !(r.to && (t.includes(r.to) || rejT.has(r.to)))), ...c.add.filter(tag => !PREAPPROVED_TAGS.has(tag) && !t.includes(tag) && !rejT.has(tag))];
      if (open.length) { pending += open.length; pendingTraits.push(`${rid} ${tr.name}`); }
    }
  }
  console.log(`  code taxonomy: ${Object.keys(APPROVED).length} approved traits (${repl} replaced · +${adds} added) · ${conf} tags code-confirmed · ${pending} proposals awaiting review${pendingTraits.length ? ` (${pendingTraits.slice(0, 20).join('; ')})` : ''}`);
  // perks — same policy, keyed "<specId>:<perkKey>" (code_taxo.json `perks`; approvals in code_taxo_approved.json `perkChanges`)
  const CTP = readJSON(path.join(MODEL, 'code_taxo.json')).perks || {};
  const APPROVED_P = fs.existsSync(APPROVED_PATH) ? (readJSON(APPROVED_PATH).perkChanges || {}) : {};
  const REJECTED_P = fs.existsSync(APPROVED_PATH) ? (readJSON(APPROVED_PATH).perkRejections || {}) : {};
  let pconf = 0, prepl = 0, padds = 0, ppend = 0; const ppendList = [];
  for (const sc of specs) for (const p of sc.perks || []) {
    const key = `${sc.id}:${p.key}`, t = p.taxo || (p.taxo = []), s2 = p.taxoSrc || (p.taxoSrc = t.map(() => 'derived'));
    const ap = APPROVED_P[key];
    if (ap) {
      for (const r of ap.replace || []) {
        for (const from of r.from) { const i = t.indexOf(from); if (i >= 0) { t.splice(i, 1); s2.splice(i, 1); } }
        if (r.to && !t.includes(r.to)) { t.push(r.to); s2.push('code'); prepl++; }
      }
      for (const tag of ap.add || []) if (!t.includes(tag)) { t.push(tag); s2.push('code'); padds++; }
    }
    const c = CTP[key]; if (!c) continue;
    for (const tag of c.confirm) { const i = t.indexOf(tag); if (i >= 0 && s2[i] !== 'code') { s2[i] = 'code'; pconf++; } }
    const rej = new Set(REJECTED_P[key] || []);   // user-rejected proposals never resurface as pending
    const open = [...c.replace.filter(r => !PREAPPROVED_TAGS.has(r.to) && !(r.to && (t.includes(r.to) || rej.has(r.to)))), ...c.add.filter(tag => !PREAPPROVED_TAGS.has(tag) && !t.includes(tag) && !rej.has(tag))];
    if (open.length) { ppend += open.length; ppendList.push(`${key} ${p.name}`); }
  }
  console.log(`  code taxonomy (perks): ${Object.keys(APPROVED_P).length} approved · ${prepl} replaced · +${padds} added · ${pconf} tags code-confirmed · ${ppend} proposals awaiting review${ppendList.length ? ` (${ppendList.slice(0, 12).join('; ')})` : ''}`);
  // relics — keyed by the app relic id (code_taxo.json `relics`, from scr_CritHasRelicPerk gates); approvals in `relicChanges`
  const CTR = readJSON(path.join(MODEL, 'code_taxo.json')).relics || {};
  const APPROVED_R = fs.existsSync(APPROVED_PATH) ? (readJSON(APPROVED_PATH).relicChanges || {}) : {};
  let rconf = 0, radds = 0, rpend = 0; const rpendList = [];
  for (const rl of relics) {
    const key = String(rl.id), t = rl.taxo || (rl.taxo = []), s2 = rl.taxoSrc || (rl.taxoSrc = t.map(() => 'derived'));
    const ap = APPROVED_R[key];
    if (ap) {
      for (const r of ap.replace || []) {
        for (const from of r.from) { const i = t.indexOf(from); if (i >= 0) { t.splice(i, 1); s2.splice(i, 1); } }
        if (r.to && !t.includes(r.to)) { t.push(r.to); s2.push('code'); }
      }
      for (const tag of ap.add || []) if (!t.includes(tag)) { t.push(tag); s2.push('code'); radds++; }
    }
    const c = CTR[key]; if (!c) continue;
    for (const tag of c.confirm) { const i = t.indexOf(tag); if (i >= 0 && s2[i] !== 'code') { s2[i] = 'code'; rconf++; } }
    const open = [...c.replace.filter(r => !PREAPPROVED_TAGS.has(r.to) && !(r.to && t.includes(r.to))), ...c.add.filter(tag => !PREAPPROVED_TAGS.has(tag) && !t.includes(tag))];
    if (open.length) { rpend += open.length; rpendList.push(`${key} ${rl.name}`); }
  }
  console.log(`  code taxonomy (relics): ${Object.keys(APPROVED_R).length} approved · +${radds} added · ${rconf} tags code-confirmed · ${rpend} proposals awaiting review${rpendList.length ? ` (${rpendList.join('; ')})` : ''}`);
  // spells + cards — same mechanism, keyed by app id (code_taxo.json `spells` / `cards`; approvals `spellChanges` / `cardChanges`)
  const applySection = (label, list, section, approvalKey, rejectKey) => {
    const CTX = readJSON(path.join(MODEL, 'code_taxo.json'))[section] || {};
    const AF = fs.existsSync(APPROVED_PATH) ? readJSON(APPROVED_PATH) : {};
    const AP = AF[approvalKey] || {}, RJ = AF[rejectKey] || {};
    let conf = 0, adds = 0, pend = 0; const pendList = [];
    for (const e of list) {
      const key = String(e.id), t = e.taxo || (e.taxo = []), s2 = e.taxoSrc || (e.taxoSrc = t.map(() => 'derived'));
      const ap = AP[key];
      if (ap) {
        for (const r of ap.replace || []) {
          for (const from of r.from) { const i = t.indexOf(from); if (i >= 0) { t.splice(i, 1); s2.splice(i, 1); } }
          if (r.to && !t.includes(r.to)) { t.push(r.to); s2.push('code'); }
        }
        for (const tag of ap.add || []) if (!t.includes(tag)) { t.push(tag); s2.push('code'); adds++; }
      }
      const c = CTX[key]; if (!c) continue;
      for (const tag of c.confirm) { const i = t.indexOf(tag); if (i >= 0 && s2[i] !== 'code') { s2[i] = 'code'; conf++; } }
      const rej = new Set(RJ[key] || []);
      const open = [...c.replace.filter(r => !PREAPPROVED_TAGS.has(r.to) && !(r.to && (t.includes(r.to) || rej.has(r.to)))), ...c.add.filter(tag => !PREAPPROVED_TAGS.has(tag) && !t.includes(tag) && !rej.has(tag))];
      if (open.length) { pend += open.length; pendList.push(`${key} ${e.name}`); }
    }
    console.log(`  code taxonomy (${label}): ${Object.keys(AP).length} approved · +${adds} added · ${conf} tags code-confirmed · ${pend} proposals awaiting review`);
  };
  applySection('spells', spells, 'spells', 'spellChanges', 'spellRejections');
  applySection('cards', cards, 'cards', 'cardChanges', 'cardRejections');
  // Action/Mechanic::Damage (user ruling 2026-10-04, PRE-APPROVED): damage where code doesn't make attack vs spell explicit.
  // code_taxo.json damage_ruling_replacements ({section,key,from:[Attack,Cast],to:Damage}) + damage_ruling_adds.
  {
    const CTD = readJSON(path.join(MODEL, 'code_taxo.json'));
    const objFor = new Map();
    for (const tr of Object.values(traits)) for (const rid of tr.runtimeIds || []) objFor.set('traits:' + rid, tr);
    for (const sc of specs) for (const p of sc.perks || []) objFor.set(`perks:${sc.id}:${p.key}`, p);
    for (const r of relics) objFor.set('relics:' + r.id, r);
    for (const c of cards) objFor.set('cards:' + c.id, c);
    for (const sp of spells) objFor.set('spells:' + sp.id, sp);
    let dRep = 0, dAdd = 0, dMiss = 0;
    // user exclusions: ledger tags the user ruled off a specific object (code_taxo_approved.json damageRulingExclude)
    const AF2 = fs.existsSync(APPROVED_PATH) ? readJSON(APPROVED_PATH) : {};
    const EXCL = new Set((AF2.damageRulingExclude || []).map(x => `${x.section}:${x.key}|${x.tag}`));
    const keyOf = new Map(); for (const [k, e] of objFor) keyOf.set(e, k);
    const put0 = (e, tag) => { const t = e.taxo || (e.taxo = []), s2 = e.taxoSrc || (e.taxoSrc = t.map(() => 'derived')); if (!t.includes(tag)) { t.push(tag); s2.push('code'); return true; } return false; };
    const put = (e, tag) => EXCL.has(`${keyOf.get(e)}|${tag}`) ? false : put0(e, tag);
    for (const r of CTD.damage_ruling_replacements || []) {
      const e = objFor.get(`${r.section}:${r.key}`); if (!e) { dMiss++; continue; }
      for (const from of r.from) { const i = e.taxo.indexOf(from); if (i >= 0) { e.taxo.splice(i, 1); e.taxoSrc.splice(i, 1); } }
      put(e, r.to); dRep++;
    }
    for (const r of CTD.damage_ruling_adds || []) { const e = objFor.get(`${r.section}:${r.key}`); if (!e) { dMiss++; continue; } if (put(e, r.tag || 'Action/Mechanic::Damage')) dAdd++; }
    // Activates When::<Side> Deals Damage (user ruling: triggered by damage) — replaces Attacks/Casts stand-ins or adds
    let ddRep = 0, ddAdd = 0, cdAdd = 0;
    for (const r of CTD.deals_damage_ruling || []) {
      const e = objFor.get(`${r.section}:${r.key}`); if (!e) { dMiss++; continue; }
      if (r.from) { for (const from of r.from) { const i = e.taxo.indexOf(from); if (i >= 0) { e.taxo.splice(i, 1); e.taxoSrc.splice(i, 1); } } if (put(e, r.to)) ddRep++; }
      else if (r.add && put(e, r.add)) ddAdd++;
    }
    // Affect on Life::Creature is Damaged (user ruling: deals damage)
    for (const r of CTD.creature_damaged_adds || []) { const e = objFor.get(`${r.section}:${r.key}`); if (!e) { dMiss++; continue; } if (put(e, r.tag || 'Affect on Life::Creature is Damaged')) cdAdd++; }
    console.log(`  deals-damage ruling: ${ddRep} trigger replacements · +${ddAdd} trigger adds · creature-damaged +${cdAdd}`);
    console.log(`  damage ruling: ${dRep} Attack/Cast → Damage replacements · +${dAdd} Damage added${dMiss ? ` · ${dMiss} unmatched` : ''}`);
  }
}

// ── Action/Mechanic IMPLIED from exact tags (2026-10-03). Action/Mechanic is the broad "what mechanic does this touch"
// layer; most of it follows deterministically from tags that are already exact. Sources that may imply: code, token,
// field, audit, code_boss (NEVER llm/keyword/correction), plus the game's own {ACTION_*}/{RACE_*} description tokens.
//   existing LLM Action/Mechanic tag that an exact tag implies → provenance 'implied'
//   missing Action/Mechanic tag that an exact tag implies       → added with provenance 'implied'
// LLM Action/Mechanic tags with no implication are left as-is (no drop-only).
// SUPERSET RULE (user 2026-10-04): Action/Mechanic values are catch-all pools of the narrower groupings — overlap is
// REQUIRED. Any object carrying a narrower tag carries its Action/Mechanic parent by extension, whatever the narrower
// tag's provenance: exact child → 'implied'; otherwise the parent inherits the child's provenance (llm stays llm).
{
  const EXACT = new Set(['code', 'token', 'field', 'audit', 'code_boss']);
  const BUFF_VALS = ['Apply/Gain a Buff', 'Limit/Prevent Buff Gain', 'Buffs Persist', 'More Powerful Buff', 'Remove Buff', 'Share/Gain Copy of Buff'];
  const DEBUFF_VALS = ['Afflict with/Gain a Debuff', 'Increase Debuff Potency', 'Avoid/Immune to Debuff', 'Debuffs Persist', 'Remove Debuff', 'Resistant to Debuff', 'Cannot be Immune'];
  const GEM_VALS = ['Extra/Gain a Spell Gem', 'Modify Spell Gem Property', 'Seal Spell Gem', 'Cannot be Sealed', 'Modify Charges/Behavior', 'Equip from Other Classes'];
  const TURN_VALS = ['Affect on Timeline::Additional Turn', 'Affect on Timeline::Lose Turn', 'Affect on Timeline::Count Additional (Turns)'];
  const CLASS_TYPES = ['Fused Class', 'Parent Class', 'Chaos Creature', 'Death Creature', 'Life Creature', 'Nature Creature', 'Sorcery Creature'];
  const ev = (verb) => [`Activates When::Ally ${verb}`, `Activates When::Enemy ${verb}`];
  const RULES = {   // Action/Mechanic value -> exact tags (or "prefix*") that imply it
    Attack: [...ev('Attacks'), 'Affect on Attacks::*', 'Multiplied by::Attack Count'],
    Cast: [...ev('Casts'), 'Affect on Spells::Automatic/Extra Cast', "Affect on Spells::Can't Manually Cast", 'Affect on Spells::Count as Manual', 'Multiplied by::Cast Count'],
    Defend: [...ev('Defends'), 'Affect on Mitigation::Automatically Defend', "Affect on Mitigation::Can't Manually Defend", 'Multiplied by::Defend Count', 'Active If::Defending'],
    Provoke: [...ev('Provokes'), 'Affect on Mitigation::Automatically Provoke', "Affect on Mitigation::Can't Manually Provoke", 'Multiplied by::Provoke Count', 'Active If::Provoking'],
    Dodge: [...ev('Dodges'), "Affect on Mitigation::Can't Dodge Attacks", 'Affect on Mitigation::More Dodge Chance', 'Multiplied by::Dodge Count'],
    Buff: ['Related Buff::*', ...ev('is Buffed'), ...BUFF_VALS.map(v => 'Affect on Status::' + v), 'Multiplied by::Buff Count', 'Multiplied by::Buff Potency', 'Active If::Buffed with X'],
    Debuff: ['Related Debuff::*', ...ev('is Debuffed'), ...DEBUFF_VALS.map(v => 'Affect on Status::' + v), 'Multiplied by::Debuff Count', 'Multiplied by::Debuff Potency', 'Active If::Debuffed with X'],
    Minion: ['Related Minion::*', 'Affect on Minions::*', ...ev('Minion Gain/Action'), 'Multiplied by::Minion Count'],
    Healing: [...ev('is Healed'), 'Affect on Life::Creature is Healed', 'Affect on Life::More Healing', 'Affect on Life::Less Healing', 'Multiplied by::Amount Healed'],
    Resurrection: [...ev('Resurrects'), 'Affect on Life::Creature is Resurrected', 'Affect on Life::Cannot Be Resurrected', 'Multiplied by::Resurrect Count'],
    Critical: [...ev('Critically Hits'), 'Affect on Damage::More Critical Chance', 'Multiplied by::Critical Count'],
    'Indirect Damage': ev('Indirectly Damaged'),
    Damage: ['Affect on Damage::Deal Less Damage', 'Affect on Damage::Take Less Damage', 'Affect on Damage::Deal More Damage',
             'Affect on Damage::Take More Damage', 'Affect on Damage::Ignore Defense', 'Affect on Life::Creature is Damaged',
             ...ev('Deals Damage'), 'Multiplied by::Amount of Damage Dealt', 'Multiplied by::Amount of Damage Taken', 'Multiplied by::Damage Taken Count'],
    Stats: ['Affect on Stats::*', ...ev('Gains Stats'), ...ev('Loses Stats'), 'Related Stat::*', 'Multiplied by::Amount of X Stat',
            'Multiplied by::Amount of Stat Change', 'Active If::Stat is Unmodified'],
    Timeline: ['Affect on Timeline::*', ...ev('Moves on Timeline'), 'Multiplied by::Above/Below on TL Count'],
    // user 2026-10-06: turn references (extra / lost turns, turns taken) are Turn Counter, not Timeline
    'Turn Counter': ['Multiplied by::Turns Taken Count', ...TURN_VALS],
    'Spell Gems': [...GEM_VALS.map(v => 'Affect on Spells::' + v), 'Multiplied by::Spell Gem/Charge Count'],
    'Creature Class': [...CLASS_TYPES.map(v => 'Related Types::' + v), 'Affect on Type::Change Class', 'Affect on Type::Count Additional (Class)'],
    'Creature Race': ['Related Types::*', 'Affect on Type::Change Race', 'Affect on Type::Count Additional (Race)'],
    Artifact: ['Related Trait::Artifact Trait'],
  };
  const RULE_EXCEPT = { 'Creature Race': CLASS_TYPES.map(v => 'Related Types::' + v), Timeline: TURN_VALS };
  const TOKEN_RULES = { Attack: /\{ACTION_attack/, Cast: /\{ACTION_cast/, Defend: /\{ACTION_defend/, Provoke: /\{ACTION_provok/,
                        'Creature Race': /\{RACE_/ };
  const matches = (pat, tag) => pat.endsWith('*') ? tag.startsWith(pat.slice(0, -1)) : tag === pat;
  const tokDesc = new Map(consolidated.map(r => [r.id, r.desc_tokenized || '']));
  const stat = {}; let conf = 0, add = 0, ext = 0;
  const imply = (e, tokenized) => {
    const t = e.taxo || (e.taxo = []), s2 = e.taxoSrc || (e.taxoSrc = t.map(() => 'derived'));
    const exact = t.filter((x, i) => EXACT.has(s2[i]));
    for (const [val, pats] of Object.entries(RULES).concat(Object.keys(TOKEN_RULES).filter(k => !RULES[k]).map(k => [k, []]))) {
      const hit = (x) => pats.some(p => matches(p, x)) && !(RULE_EXCEPT[val] || []).includes(x);
      const byTag = exact.some(hit);
      const byTok = TOKEN_RULES[val] ? TOKEN_RULES[val].test(tokenized || '') : false;
      const tag = 'Action/Mechanic::' + val, i = t.indexOf(tag);
      if (!byTag && !byTok) {   // superset by extension from a non-exact child: parent inherits the child's provenance
        const ci = t.findIndex(hit);
        if (ci >= 0 && i < 0) { t.push(tag); s2.push(s2[ci]); ext++; const st = (stat[val] ||= [0, 0, 0]); st[2] = (st[2] || 0) + 1; }
        continue;
      }
      if (i >= 0) { if (!EXACT.has(s2[i]) && s2[i] !== 'implied') { s2[i] = 'implied'; conf++; (stat[val] ||= [0, 0])[0]++; } }
      else { t.push(tag); s2.push('implied'); add++; (stat[val] ||= [0, 0])[1]++; }
    }
  };
  for (const tr of Object.values(traits)) imply(tr, tokDesc.get(tr.id) || tr.desc);
  for (const sc of specs) for (const p of sc.perks || []) imply(p, p.desc);
  for (const sp of spells) imply(sp, sp.desc);
  for (const rl of relics) imply(rl, '');
  for (const cd of cards) imply(cd, '');
  // Timeline → Turn Counter (user 2026-10-06): an Action/Mechanic::Timeline tag that rests only on turn values (no
  // timeline wording, no position/order tag) is a turn reference → Turn Counter (provenance kept).
  let tl2tc = 0;
  const TL_POS = (x) => (x.startsWith('Affect on Timeline::') && !TURN_VALS.includes(x)) || /Moves on Timeline|Above\/Below on TL Count/.test(x);
  const tlFix = (e, text) => {
    const t = e.taxo || [], i = t.indexOf('Action/Mechanic::Timeline'); if (i < 0) return;
    if (/\{TIMELINE\}|timeline/i.test(text || '') || t.some(TL_POS) || !t.some(x => TURN_VALS.includes(x))) return;
    const src = e.taxoSrc[i]; t.splice(i, 1); e.taxoSrc.splice(i, 1);
    if (!t.includes('Action/Mechanic::Turn Counter')) { t.push('Action/Mechanic::Turn Counter'); e.taxoSrc.push(src); }
    tl2tc++;
  };
  for (const tr of Object.values(traits)) tlFix(tr, tr.desc);
  for (const sc of specs) for (const pk of sc.perks || []) tlFix(pk, pk.desc);
  for (const sp of spells) tlFix(sp, sp.desc);
  for (const rl of relics) tlFix(rl, (rl.ranks || []).map(r => r.desc).join(' '));
  for (const cd of cards) tlFix(cd, (cd.effects || []).join(' '));
  console.log(`  timeline → turn counter: ${tl2tc} turn-only Timeline tags moved`);
  console.log(`  action/mechanic implied: ${conf} llm tags now implied by exact tags · +${add} added · +${ext} by extension (inherited src) · ` +
    Object.entries(stat).map(([k, [c, a, x]]) => `${k} ${c}/+${a}/+${x || 0}`).join(', '));
}

// ── Shops: icon + drill-in joins (needs creatures / spells / traitItems / spellProps / skins) ──
{
  const critBy = new Map(creatures.map(c => [norm(c.name), c]));
  const spellBy = new Map(spells.map(sp => [sp.key, sp]));
  const tiBy = new Map(traitItems.map(t => [norm(t.name), t]));
  const dustBy = new Map(spellProps.map(p => [norm(p.name), p]));
  const skinBy = new Map(skins.map(k => [k.id, k]));
  const stat = {}, miss = {};
  const bump = (k, ok) => { (stat[k] = stat[k] || [0, 0])[ok ? 0 : 1]++; };
  for (const it of allShopItems()) {
    let ok = true;
    if (it.kind === 'creature') { const c = critBy.get(norm(it.name)); if (c) it.cid = c.id; else ok = false; }
    else if (it.kind === 'spell') { const sp = spellBy.get(it.key); if (sp) { it.spellId = sp.id; it.cls = sp.cls; } else ok = false; }
    else if (it.kind === 'trait_item') { const t = tiBy.get(norm(it.name)); if (t) { it.icon = t.icon; it.traitId = t.traitId; } else ok = false; }
    else if (it.kind === 'dust') { const d = dustBy.get(norm(it.name)); if (d) it.icon = d.icon; else ok = false; }
    else if (it.kind === 'skin') { const k = skinBy.get(it.id); if (k) it.icon = k.img; else ok = false; }
    else if (it.sprite) { ok = copyNamedSprite(it.sprite, OUT_SHOPICON, `${it.sprite}.png`); if (ok) it.icon = `assets/shopicons/${it.sprite}.png`; }
    // walls / floors / music / chests / keys / weather: the list draws one icons-sheet frame per kind (obj_shop Draw GUI,
    // inv_ItemIconIndex; extract S50). `sprite` stays first so items with both (backgrounds, skins) keep their own picture.
    else if (it.iconFrame != null) { it.icon = curIcon(it.iconFrame); ok = !!it.icon; }
    else ok = null;                                                   // no art in code
    delete it.sprite; delete it.iconFrame;
    if (ok !== null) { bump(it.kind, ok); if (!ok) (miss[it.kind] = miss[it.kind] || new Set()).add(it.name); }
  }
  console.log(`  shop joins: ${Object.entries(stat).map(([k, [o, m]]) => `${k} ${o}/${o + m}`).join(' · ')}`);
  for (const [k, set] of Object.entries(miss)) warn(`shop ${k} items without a join/icon: ${[...set].slice(0, 8).join(', ')}${set.size > 8 ? ' …' : ''}`);
}

// ── code-grounded effect clarifications (mechanics the game's own text omits) ─────────────────────────
// Shipped as `clarify: string[]` sentences on traits / spec perks / relic ranks (shown on the taxonomy detail page;
// never edited into the game prose). Sources (_su_extract code/COMBAT_RULES.md):
//   dr_caps.json            — every per-effect damage-reduction clamp in bc_EventDamage (global.dr_cap = 0.8)
//   rune_knight_perks.json  — Undermine / Inspirit per-rune condition + Ruse's rune-gem properties
{
  const addNote = (o, n) => { if (o && !(o.clarify ||= []).includes(n)) o.clarify.push(n); };   // → clarify (no chips)
  const perkByKey = new Map(); for (const sp of specs) for (const pk of sp.perks) perkByKey.set(pk.key, pk);
  const traitByName = new Map(Object.values(traits).map(t => [norm(t.name), t]));
  const relicRank = (name, rank) => { const r = relics.find(x => norm(String(x.name).split(',')[0]) === norm(String(name).split(',')[0]));
    return r ? r.ranks.find(k => +k.rank === +rank) : null; };
  // the chip is the single source for the cap → drop any cap wording from the prose (game text says "Maximum of
  // 95%" on Blink of an Eye; the compendium adds "(up to 90%)"; code clamps every one of these at dr_cap)
  let capStripped = 0;
  const stripCap = (o) => { if (!o.desc) return; const d = o.desc
      .replace(/\s*\(up to \d+(?:\.\d+)?%\)/gi, '')
      .replace(/,?\s*up to \d+(?:\.\d+)?% (?:reduced damage|damage reduction)/gi, '')
      .replace(/\s*Maximum of \d+(?:\.\d+)?% damage reduction\./gi, '')
      .replace(/ {2,}/g, ' ').trim();
    if (d !== o.desc) { o.desc = d; capStripped++; } };
  const capsF = path.join(MODEL, 'dr_caps.json');
  if (fs.existsSync(capsF)) {
    const caps = readJSON(capsF), capTxt = `The damage reduction from this effect is capped at ${Math.round(caps.dr_cap * 100)}%.`;
    let hit = 0; const miss = [];
    for (const e of caps.effects || []) {
      const tgt = e.kind === 'perk' ? perkByKey.get(e.perk_key)
        : e.kind === 'trait' ? (traits[e.trait_consolidated_id] && norm(traits[e.trait_consolidated_id].name) === norm(e.name) ? traits[e.trait_consolidated_id] : traitByName.get(norm(e.name)))
        : e.kind === 'relic' ? relicRank(e.relic_name || e.name, e.rank)
        : e.kind === 'condition' && e.source_perk_key ? perkByKey.get(e.source_perk_key)   // minion granted by a perk (Mammon)
        : undefined;   // guild bonuses / race mastery: no app surface yet
      if (tgt) { addNote(tgt, capTxt); stripCap(tgt); hit++; } else if (tgt === null) miss.push(`${e.kind}:${e.name}`);
    }
    console.log(`  dr-cap notes: ${hit}/${(caps.effects || []).length} effects tagged "${capTxt}" · ${capStripped} prose cap phrase(s) removed`);
    if (miss.length) warn(`dr-cap notes: ${miss.length} effect(s) not joined to app data: ${miss.join(', ')}`);
  } else warn('dr_caps.json missing — no damage-reduction cap notes');
  // final_summoning.json — which spell each Greater Demon casts when it runs out (extract S35, code-certain). Shipped on the
  // perk as `demonSpells: [{cond: "Minion:<key>", spells: [appSpellId…]}]` (one spell, or Satanachia's random pool).
  const fsF = path.join(MODEL, 'final_summoning.json');
  if (fs.existsSync(fsF)) {
    const fsm = readJSON(fsF), fp = perkByKey.get(fsm.perk.key);
    const appSpell = (id, name) => { const sp = spells.find(x => x.id === id - 1);
      if (!sp || norm(sp.name) !== norm(name)) { err(`final_summoning: spell ${id} "${name}" doesn't join (got ${sp && sp.name})`); return null; } return sp.id; };
    if (!fp) err('final_summoning: perk FINALSUMMONING not found');
    else fp.demonSpells = fsm.demons.map(d => ({ cond: `Minion:${d.condition_key.toLowerCase()}`,
      spells: (d.pool ? d.pool.map(x => appSpell(x.spell_id, x.spell)) : [appSpell(d.spell_id, d.spell)]).filter(x => x != null) }));
    console.log(`  final summoning: ${fp ? fp.demonSpells.length : 0} Greater Demons`);
  } else warn('final_summoning.json missing');
  // effect_clarifications.json — code-grounded "what it actually does" text, shipped as a SEPARATE `clarify: string[]`
  // field (the localization `desc` stays verbatim game text). Joined trait→runtime id, perk→key, relic→name+rank.
  const clarF = path.join(MODEL, 'effect_clarifications.json');
  if (fs.existsSync(clarF)) {
    const traitByRuntime = new Map(); for (const t of Object.values(traits)) for (const r of t.runtimeIds || []) traitByRuntime.set(r, t);
    let hit = 0; const miss = [];
    for (const e of readJSON(clarF).entries || []) {
      const tgt = e.kind === 'trait' ? traitByRuntime.get(e.trait_runtime_id)
        : e.kind === 'perk' ? perkByKey.get(e.perk_key)
        : e.kind === 'relic' ? relicRank(e.relic_name || e.name, e.rank)
        : e.kind === 'spell' ? spells.find(sp => sp.id === e.spell_id && (!e.name || norm(sp.name) === norm(e.name)))
        : e.kind === 'condition' ? conditions.find(c => c.cat !== 'Minion' && norm(c.name) === norm(e.name)) : null;
      if (tgt && (!e.name || e.kind !== 'trait' || norm(tgt.name) === norm(e.name))) { ((tgt.clarify ||= []).includes(e.text)) || tgt.clarify.push(e.text); hit++; }
      else miss.push(`${e.kind}:${e.name}`);
    }
    console.log(`  effect clarifications: ${hit} attached`);
    if (miss.length) warn(`effect clarifications not joined to app data: ${miss.join(', ')}`);
  }
  // has_roll.json — `hasRoll` boolean per object: does any scr_Roll call site (a chance roll) belong to it
  // (_su_extract code/ROLL_SITES.md). Data only, no UI yet; intended to drive a future Luck/Roll glossary entry.
  // Relic rolls are rank-specific: the flag is on each rank and on the relic (any rank).
  const rollF = path.join(MODEL, 'has_roll.json');
  if (fs.existsSync(rollF)) {
    const HR = readJSON(rollF), cnt = {};
    const on = (kind) => Object.values(HR[kind] || {}).filter(v => v.hasRoll);
    const rollTraitRt = new Set(Object.entries(HR.traits || {}).filter(([, v]) => v.hasRoll).map(([k]) => +k));
    for (const t of Object.values(traits)) { t.hasRoll = (t.runtimeIds || []).some(r => rollTraitRt.has(r)); if (t.hasRoll) cnt.traits = (cnt.traits || 0) + 1; }
    const perkKeys = new Set(on('perks').map(v => v.key).filter(Boolean));
    for (const s of specs) for (const p of s.perks) { p.hasRoll = perkKeys.has(p.key); if (p.hasRoll) cnt.perks = (cnt.perks || 0) + 1; }
    const spellKeys = new Set(on('spells').map(v => v.key).filter(Boolean));
    for (const sp of spells) { sp.hasRoll = spellKeys.has(sp.key); if (sp.hasRoll) cnt.spells = (cnt.spells || 0) + 1; }
    const condKeys = new Set(on('conditions').flatMap(v => [norm(v.key), norm(v.name)]));
    for (const c of conditions) { c.hasRoll = condKeys.has(norm(c.key)) || condKeys.has(norm(c.name)); if (c.hasRoll) cnt.conditions = (cnt.conditions || 0) + 1; }
    const relicRoll = new Set(Object.entries(HR.relics || {}).filter(([k, v]) => v.hasRoll && !v.note)
      .map(([k]) => { const [nm, rk] = k.split(' | rank '); return norm(nm.split(',')[0]) + '|' + rk; }));
    for (const r of relics) {
      for (const k of r.ranks || []) k.hasRoll = relicRoll.has(norm(String(r.name).split(',')[0]) + '|' + k.rank);
      r.hasRoll = (r.ranks || []).some(k => k.hasRoll); if (r.hasRoll) cnt.relics = (cnt.relics || 0) + 1;
    }
    const cardFam = new Set(Object.entries(HR.cards || {}).filter(([, v]) => v.hasRoll).map(([k]) => norm(k.split(' | power ')[0])));
    for (const c of cards) { c.hasRoll = cardFam.has(norm(c.family)); if (c.hasRoll) cnt.cards = (cnt.cards || 0) + 1; }
    console.log(`  hasRoll flags: ${Object.entries(cnt).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  } else warn('has_roll.json missing — no hasRoll flags');
  const runeF = path.join(MODEL, 'rune_knight_perks.json');
  if (fs.existsSync(runeF)) {
    const short = (r) => String(r).replace(/^Rune of /, '');
    for (const pk of readJSON(runeF).perks || []) {
      const tgt = perkByKey.get(pk.perk_key); if (!tgt) { warn(`rune notes: perk ${pk.perk_key} not in app data`); continue; }
      const list = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs.join('');
      if (pk.per_rune && pk.per_rune[0] && pk.per_rune[0].condition)            // Undermine / Inspirit: per-rune condition
        addNote(tgt, `By Rune: ${pk.per_rune.map(r => `${short(r.rune)} → ${COND_GAME.get(r.condition) || r.condition}`).join(', ')}.`);
      else if (pk.per_rune) {                                                    // Ruse: shared props + per-rune variant
        const all = pk.per_rune.map(r => r.properties);
        const common = all[0].filter(x => all.every(l => l.includes(x)));
        const odd = new Map();                                                   // property → runes that get it
        pk.per_rune.forEach(r => r.properties.filter(x => !common.includes(x)).forEach(x => odd.set(x, [...(odd.get(x) || []), short(r.rune)])));
        const variants = [...odd].sort((x, y) => y[1].length - x[1].length).map(([x, rs]) => `${x} (${rs.join('/')})`);
        addNote(tgt, `Rune gems become${pk.tier ? ` Tier ${pk.tier}` : ''} with ${list(common)}${variants.length ? `, plus ${variants.join(' or ')}` : ''}.`);
      }
    }
  }
}
// ── effect rules for effects.js (EFFECT_ENGINE.md) — hand-authored + generated, validated here ──
// Every build-affecting perk/trait behaviour is a declarative rule, so the app has no per-perk/per-trait
// branches. Generated rules are derived from the SHIPPED descriptions with the exact patterns the app used
// before the engine existed (behaviour-preserving); hand-authored ones live in data/reference/effect_rules.json.
const effects = (() => {
  const rules = [];
  const add = (r, prov) => rules.push({ ...r, prov });
  // spell-gem slot grants are hand-authored in effect_rules.json from the code (scr_GetCreatureStat case 5, "spellslots");
  // the guard after validation checks them against the extract's code layer.
  // spell-gem class permissions (the app's former runtime regexes over trait/perk text)
  const ANYCLASS_RE = /equip (all |spell gems from any class|.*from any class)|regardless of (their|its) class/i;
  for (const id in traits) {
    const d = traits[id].desc || '';
    if (/this creature can (only )?equip.*(any class|from any class)/i.test(d) || (ANYCLASS_RE.test(d) && /this creature/i.test(d)))
      add({ id: `equip-any-self-${id}`, src: { kind: 'trait', id: +id }, op: 'equip.anyClass', scope: 'self' }, 'generated');
    if (/your creatures can equip all spell gems/i.test(d) || (/your creatures/i.test(d) && ANYCLASS_RE.test(d) && !/\{class_/i.test(d)))
      add({ id: `equip-any-party-${id}`, src: { kind: 'trait', id: +id }, op: 'equip.anyClass', scope: 'party' }, 'generated');
  }
  for (const s of specs) for (const p of s.perks) {
    const m = (p.desc || '').match(/\{CLASS_(\w+)\}\s*spell gems,\s*regardless of (their|its) class/i);
    const cls = m && (CLASSES.find(c => c.key.toLowerCase() === m[1].toLowerCase()) || {}).key;
    if (cls) add({ id: `equip-class-${s.id}-${p.key}`, src: { kind: 'perk', spec: s.id, key: p.key, via: 'spec+anoint' }, op: 'equip.addClass', cls }, 'generated');
  }
  for (const r of readJSON(path.join(ROOT, 'data', 'reference', 'effect_rules.json')).rules) {
    const { _why, ...rule } = r; add(rule, 'manual');
  }
  // validation: every rule must name a live source and a known op (a typo would silently do nothing)
  const OPS = new Set(['cap', 'ignore', 'gemSlots', 'equip.anyClass', 'equip.addClass', 'stat.share', 'fuse.copy']);
  const ids = new Set();
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`effect rule id duplicated: ${r.id}`); ids.add(r.id);
    if (!OPS.has(r.op)) throw new Error(`effect rule ${r.id}: unknown op ${r.op}`);
    if (r.src.kind === 'perk') { const s = specs.find(x => x.id === r.src.spec);
      if (!s || !s.perks.some(p => p.key === r.src.key)) throw new Error(`effect rule ${r.id}: perk ${r.src.spec}/${r.src.key} not found`);
      if (!['spec', 'spec+anoint'].includes(r.src.via)) throw new Error(`effect rule ${r.id}: bad via ${r.src.via}`); }
    else if (r.src.kind === 'trait') { if (!traits[r.src.id]) throw new Error(`effect rule ${r.id}: trait ${r.src.id} not found`); }
    else throw new Error(`effect rule ${r.id}: unknown source kind ${r.src.kind}`);
  }
  // guard: every object the code layer shows adding spell-gem slots (taxo_v2_tags "Spell Gems::Extra Gem Slot", sited in
  // scr_GetCreatureStat case 5) has a gemSlots rule, and every gemSlots rule is one of them
  { const f = path.join(MODEL, 'taxo_v2_tags.json');
    if (!fs.existsSync(f)) warn('gemSlots guard: taxo_v2_tags.json missing');
    else {
      const code = new Set(Object.entries(readJSON(f).objects || {}).filter(([, v]) => (v.tags || []).some(t => t.tag === 'Spell Gems::Extra Gem Slot')).map(([k]) => k));
      const have = new Set(rules.filter(r => r.op === 'gemSlots').map(r => r.src.kind === 'perk' ? `perk:${r.src.key}` : `trait:${r.src.id}`));
      // code-layer slot clauses the app can't compute (reason): no rule, the tag still ships
      const NO_RULE = { 'perk:GODFORGED': 'scales Godforge upgrade 9 (+3 slots) by 1.5; the app does not model Godforge upgrades (extract F4, S40p)' };
      for (const k of code) if (!have.has(k) && !NO_RULE[k]) err(`gemSlots: code layer adds spell-gem slots for ${k}, no effect rule`);
      for (const k of have) if (!code.has(k)) err(`gemSlots: effect rule for ${k}, but the code layer has no spell-slot clause`);
    } }
  const byOp = {}; for (const r of rules) byOp[r.op] = (byOp[r.op] || 0) + 1;
  console.log(`  effect rules: ${rules.length} (${Object.entries(byOp).map(([k, v]) => `${k} ${v}`).join(' · ')}; manual ${rules.filter(r => r.prov === 'manual').length})`);
  return { rules };
})();

// ── Spell Gem Slot activation chance (artifact spell slot + nether-stone spells) ───────────────────
// _su_extract data/model/spell_gem_slot_chance.json (code/ARTIFACTS.md). Shipped as a compact
// model; the app computes the live chance from the build (perk ranks, party traits, relic rank, card levels, stones).
// Re-roll luck effects (Sleight of Hand / Bad/Good Luck / Spin the Wheel) are deliberately NOT applied (user 2026-10-04).
let slotChance = null;
{
  const f = path.join(MODEL, 'spell_gem_slot_chance.json');
  if (fs.existsSync(f)) {
    const m = readJSON(f), byKind = (k, pred) => (m.modifiers || []).find(x => x.kind === k && pred(x));
    const typeName = { attack: 'Sword', defend: 'Shield', provoke: 'Helmet', cast: 'Staff', start_of_turn: 'Boots' };
    const trigLabel = { attack: 'On Attack', defend: 'On Defend', provoke: 'On Provoke', cast: 'On Cast', start_of_turn: 'On Turn' };
    const base = {}, baseByTrigger = {};
    for (const t of m.triggers || []) { base[t.artifact_name || typeName[t.trigger]] = t.base; baseByTrigger[trigLabel[t.trigger]] = t.base; }
    const smith = byKind('card_set', x => x.card_family === 'Smith'), truth = byKind('trait', x => x.name === 'The Truth');
    const hh = byKind('perk', x => x.perk_key === 'HIDDENHAND'), bb = byKind('trait', x => x.name === 'Battle Born');
    const ferro = byKind('relic', x => /Ferro/.test(x.relic || '')), cd = byKind('trait', x => x.name === 'Celebrate Decline');
    slotChance = {
      base, baseByTrigger,
      smith: smith && { cardId: smith.card_id, power: smith.power, mult: smith.value },
      truth: truth && { traitId: truth.app_trait_id, value: truth.value },
      hiddenHand: hh && { perkKey: hh.perk_key, perRank: hh.value_per_rank },
      battleBorn: bb && { traitId: bb.app_trait_id, add: bb.value },
      ferro: ferro && { relicId: ferro.app_relic_id, minRank: ferro.effective_rank },
      celebrateDecline: cd && { traitId: cd.app_trait_id },
    };
    // join guards: every id must still name the expected object in the shipped data
    const chk = (ok, what) => { if (!ok) err(`slotChance: ${what} no longer joins to app data`); };
    chk(slotChance.truth && traits[slotChance.truth.traitId]?.name === 'The Truth', 'The Truth');
    chk(slotChance.battleBorn && traits[slotChance.battleBorn.traitId]?.name === 'Battle Born', 'Battle Born');
    chk(slotChance.celebrateDecline && traits[slotChance.celebrateDecline.traitId]?.name === 'Celebrate Decline', 'Celebrate Decline');
    chk(slotChance.ferro && /^Ferro/.test(relics[slotChance.ferro.relicId]?.name || ''), 'Ferro relic');
    chk(slotChance.smith && cards[slotChance.smith.cardId]?.family === 'Smith', 'Smith card');
    chk(slotChance.hiddenHand && specs.some(sp => sp.perks.some(pk => pk.key === 'HIDDENHAND')), 'Hidden Hand perk');
    chk(Object.keys(base).length === 5, 'base chances (5 artifact types)');
    console.log(`  spell-gem slot chance: base ${JSON.stringify(base)} · 6 modifiers joined`);
  } else warn('spell_gem_slot_chance.json missing — no activation chance in the app');
}

// ── Projects — CODE (_su_extract projects.json, S18): proj[pid] fields decoded (required project items + qty, cost
// multiplier → Resources ×1000 / Parts ×500 / Dust ×100, ×2 on Ruthless), availability from scr_ProjectsGetAvailable,
// type from field 16. Required-item icons from project_items.json sprites. Grouped for the Menu › Projects overlay.
const projects = (() => {
  const f = path.join(MODEL, 'projects.json');
  if (!fs.existsSync(f)) { warn('projects.json missing — no Projects overlay data'); return []; }
  const OUT_PROJITEM = path.join(OUT_ASSETS, 'projitems');
  fs.rmSync(OUT_PROJITEM, { recursive: true, force: true });
  const itemSprite = new Map(readJSON(path.join(MODEL, 'project_items.json')).records.map(r => [r.name, r.sprite]));
  let icons = 0, noIcon = new Set();
  const icon = (name) => {
    const sp = itemSprite.get(name);
    if (sp && copyNamedSprite(sp, OUT_PROJITEM, `${sp}.png`)) { icons++; return `assets/projitems/${sp}.png`; }
    noIcon.add(name); return null;
  };
  const group = (r) => r.type === 0 ? 'Castle' : r.type !== 10 ? 'Missions'
    : /^Specialization:/.test(r.name) ? 'Specializations' : /^Godspawn:/.test(r.name) ? 'Godspawn' : 'Unlocks';
  // requirement strings → display (state checks like "… NOT yet unlocked" are availability bookkeeping, not prerequisites)
  const req = (s) => {
    let m;
    if (/NOT yet/i.test(s)) return null;
    if ((m = /^project '(.+)' completed$/.exec(s))) return `Project: ${m[1]}`;
    if ((m = /^quest \d+ completed \((.+)\)$/.exec(s))) return `Quest: ${m[1]}`;
    if ((m = /^statistic (\d+) >= (\d+)$/.exec(s))) return `Statistic #${m[1]} ≥ ${m[2]}`;
    return s;
  };
  const out = readJSON(f).records.map(r => ({
    id: r.runtime_id, name: r.name, group: group(r),
    desc: String(r.description || '').replace(/\\n/g, '\n').replace(/\{1\}/g, '').trim(),
    cost: r.cost, costRuthless: r.cost_ruthless,
    items: (r.required_items || []).map(it => ({ name: it.item, qty: it.qty, icon: icon(it.item) })),
    reqs: [...new Set((r.availability || []).flatMap(a => a.readable || []).map(req).filter(Boolean))],
  }));
  if (noIcon.size) warn(`project items without an icon: ${[...noIcon].slice(0, 8).join(', ')}${noIcon.size > 8 ? ' …' : ''}`);
  console.log(`  projects (code): ${out.length} · groups ${[...new Set(out.map(p => p.group))].join('/')} · item icons ${icons}`);
  return out;
})();
// ── Start-of-battle effect order (code: _su_extract code/START_OF_BATTLE_FINDINGS.md, data/model/start_of_battle_order.json) ──
// One row per effect per phase in execution order (the player/enemy side blocks of the same effect collapse to the first).
// Excluded like the resurrection order's unconfirmed rows: Open-confidence entries, the tavern-rule guards (name runtime-only),
// the "timeline rebuilt" step (it's the phase itself), relic gates with no app rank. Ids → app refs:
//   passive/trait = trait runtime id · perk = name (app perk names are unique) · relic = [perk_index, relic_code_id] →
//   relic_signatures app id, rank = index×10 · card = set family + power · condition / realm property / realm boost = code id.
// condition registry names (suffix-derived, e.g. "Burned", "Silence") -> the game's display names (token_names.json conditions)
const COND_DISPLAY = (() => {
  const tn = readJSON(path.join(MODEL, 'token_names.json')).conditions, m = new Map();
  for (const c of readJSON(path.join(MODEL, 'condition_registry.json')).conditions) if (c.name && tn[c.id]) m.set(c.name, tn[c.id].text);
  return m;
})();
const condDisplay = (n) => COND_DISPLAY.get(n) || n;
const sobEntries = readJSON(path.join(MODEL, 'start_of_battle_order.json')).entries;
// one code site can test several card powers (Satyr: for i = 1..3 around inv_CardSetPowerUnlocked, extract S49) → one row per power
const sobRaw = sobEntries.flatMap(e => {
  const m = e.family === 'card' && e.ids.length > 1 && /^(.+?) card set, powers /.exec(e.name || '');
  return m ? e.ids.map(p => ({ ...e, ids: [p], name: `${m[1]} set power ${p}` })) : [e];
}).sort((a, b) => a.global_order - b.global_order);
// effect_order_all.json (the extract's combined effect-order dataset) — read once: start of battle takes its `resolution` per entry
// (the start_of_battle function's blocks point back at their entry: src.index), the Appendix effect-order sections the rest
const EO_ALL = readJSON(path.join(MODEL, 'effect_order_all.json'));
const sobResByOrder = new Map();
for (const b of (EO_ALL.functions.find(f => f.id === 'start_of_battle') || { blocks: [] }).blocks) {
  const e = b.src && b.src.list === 'entries' ? sobEntries[b.src.index] : null;
  if (e && b.resolution) sobResByOrder.set(e.global_order, b.resolution);
}
const relicCodeToApp = new Map(readJSON(path.join(MODEL, 'relic_signatures.json')).records.map(r => [r.relic_code_id, r.app_relic_id]));
// scr_RealmPropertyName case → app realm-property key. 13 COPYTRAITS is never rolled (scr_RealmGetProperties redraws it;
// _su_extract code/REALM_PROPERTIES.md) → dropped via never_rolled above.
const SOB_REALM_PROP = { 25: 'DEBUFF', 12: 'EXTRATRAITS', 67: 'SPELLSLOTS', 11: 'COPYGEMS' };
const SOB_REALM_TEXT = {};
// always-on member names that are blacklisted traits (and not also a shipped trait's name) never show
const sobShippedNames = new Set(Object.values(traits).map(t => t.name));
const sobBlackNames = new Set(consolidated.filter(t => excludedTraitIds.has(t.id)).map(t => t.name).filter(n => !sobShippedNames.has(n)));
let sobAlways = null;
const startOfBattle = [], sobSeen = new Map(), sobSkipped = [], sobNameDiff = [];
const sobName = (n) => String(n || '').replace(/\s*\(\d+\)$/, '').trim();          // "In Formation (423)" → "In Formation"
const sobTraitByRt = new Map(); for (const t of Object.values(traits)) for (const r of t.runtimeIds || []) sobTraitByRt.set(r, t);
const sobPerkNames = new Set(specs.flatMap(sp => sp.perks.map(p => p.name)));
// blacklisted traits (UNRECONCILED / NYI / legacy / duplicate copies) never ship — their start-of-battle entries are dropped too
const sobRtToTraitId = new Map(); for (const [tid, rts] of Object.entries(RT_GROUPS)) for (const r of rts || []) sobRtToTraitId.set(r, +tid);
const sobBlacklisted = [];
// Secondary calls (user 2026-10-21: keep them, indented under the effect that makes the check). A gate tested inside another
// effect's block is not a start-of-battle effect of its own: the extract marks them `secondary_of` = the parent's global_order
// (S42, control-flow reachability; START_OF_BATTLE_FINDINGS.md "Secondary calls"). An effect re-checking itself (its own rank
// read, 28 of the 52) folds into the parent row.
const sobByOrder = new Map(), sobDropped = new Set(); let sobSelf = 0;                                                       // global_order → shipped row (dedupe-aware)
for (const e of sobRaw) {
  if (/open|unreachable/i.test(e.confidence) || e.never_rolled || ['tavern', 'tavern rule', 'system'].includes(e.family)) { sobDropped.add(e.global_order); continue; }
  if (/battle-wide rule/i.test(e.kind || '')) { sobDropped.add(e.global_order); continue; }                                 // set at setup, not a start-of-battle event
  if (e.family === 'maintenance pass') {                                                // 0b: both always-on passes → ONE row
    // raw code labels → app names: "realm 26 BUFF" → that realm property's name, "relic [idx, code]" → relic + rank;
    // register-held ids and tavern rules have no name → dropped
    const memberName = (n) => {
      n = String(n).replace(/^condition\s+/, '');
      if (/register-held|^tavern\b/i.test(n) || n === 'None') return null;
      let m = n.match(/^realm \d+ ([A-Z_]+)$/);
      if (m) { const rp = realmProps.find(x => x.key === m[1]); return rp ? rp.name : null; }
      m = n.match(/^relic \[(\d+),\s*(\d+)\]$/);
      if (m) { const rel = relics.find(r => r.id === relicCodeToApp.get(+m[2])), rk = +m[1] * 10;
        return rel && rel.ranks.some(x => x.rank === rk) ? `${rel.name.split(',')[0]} (rank ${rk})` : null; }
      return sobBlackNames.has(n) ? null : condDisplay(n);
    };
    const add = (e.members || []).filter(Boolean).map(memberName).filter(Boolean);
    if (sobAlways) { for (const n of add) if (!sobAlways.ref.members.includes(n)) sobAlways.ref.members.push(n); continue; }
    sobAlways = { phase: e.phase_num, sub: e.subphase || null, ref: { k: 'always', members: [...new Set(add)] }, name: 'Always-on effects', effect: '', enemy: false };
    startOfBattle.push(sobAlways); continue;
  }
  let ref = null;
  if (e.family === 'passive' || e.family === 'trait') {
    const rt = e.ids[0], nm = sobName(e.name);
    if (rt == null) { const byName = Object.values(traits).filter(t => t.name === nm);   // no gate id: unique shipped name (Tools of Creation)
      ref = byName.length === 1 && !/held in a variable/.test(e.name) ? { k: 'trait', id: byName[0].id } : null; }
    else if (excludedTraitIds.has(sobRtToTraitId.get(rt))) { sobBlacklisted.push(nm); sobDropped.add(e.global_order); continue; }
    else if (sobTraitByRt.has(rt)) { ref = { k: 'trait', id: sobTraitByRt.get(rt).id }; if (sobTraitByRt.get(rt).name !== nm) sobNameDiff.push(`${rt}: ${nm} ≠ app ${sobTraitByRt.get(rt).name}`); }
    else { const byName = Object.values(traits).filter(t => t.name === nm);
      // not in the app under this runtime id: same-name app trait if unique, else a text-only row (real source, no app record)
      ref = byName.length === 1 ? { k: 'trait', id: byName[0].id } : { k: 'text', name: nm, desc: e.effect || '' }; }
  }
  else if (e.family === 'perk') ref = sobPerkNames.has(sobName(e.name)) ? { k: 'perk', name: sobName(e.name) } : null;
  else if (e.family === 'relic') {
    // the ids pair is [perk index, relic code] on most rows, [relic code, perk index] on a few (Wintermaul rank 70 = [1, 7]):
    // take the order whose relic name matches the row's own name (HANDOFF_effect_order_app.md, Migration)
    const nm = sobName(e.name).split(',')[0].toLowerCase();
    for (const [idx, code] of [e.ids, [e.ids[1], e.ids[0]]]) {
      const app = relicCodeToApp.get(code), rel = relics.find(r => r.id === app);
      if (rel && rel.name.split(',')[0].toLowerCase() === nm.replace(/ rank \d+$/, '') && rel.ranks.some(x => x.rank === idx * 10)) { ref = { k: 'relic', id: app, rank: idx * 10 }; break; }
    }
  }
  else if (e.family === 'card') { const fam = e.name.replace(/ set power \d+$/, ''); ref = cards.some(c => c.family === fam) ? { k: 'card', family: fam, power: e.ids[0] } : null; }
  else if (e.family === 'condition') ref = { k: 'cond', name: condDisplay(e.name.replace(/\s*\(\d+\)$/, '')) };
  else if (e.family === 'realm') { const id = e.ids[0], tx = SOB_REALM_TEXT[id];
    ref = SOB_REALM_PROP[id] ? { k: 'realm', key: SOB_REALM_PROP[id] }
      : tx ? { k: 'text', name: tx.name, desc: e.effect || '', icon: threatIcon(tx.sprite, `start-of-battle realm property ${id}`), chip: 'Realm Property' } : null; }
  else if (e.family === 'realm boost') ref = { k: 'boost', id: e.ids[0], name: e.name.replace(/^Realm boost \d+:\s*/, '') };
  if (!ref) { sobSkipped.push(`${e.global_order} ${e.family} ${e.name}`); sobDropped.add(e.global_order); continue; }
  const secOf = e.secondary_of, parent = secOf != null ? sobByOrder.get(secOf) : null;
  if (secOf != null && !parent) { if (!sobDropped.has(secOf)) err(`START OF BATTLE: secondary row ${e.global_order} ${e.name}: parent ${secOf} not shipped`); continue; }
  if (parent && JSON.stringify(parent.ref) === JSON.stringify(ref)) { sobByOrder.set(e.global_order, parent); sobSelf++; continue; }
  const key = `${e.phase_num}|${e.subphase || ''}|${JSON.stringify(ref)}${parent ? '|sec:' + parent.name : ''}`;
  if (sobSeen.has(key)) { sobByOrder.set(e.global_order, sobSeen.get(key)); continue; }
  const res = sobResByOrder.get(e.global_order);
  const row = { phase: e.phase_num, sub: e.subphase || null, ref, name: e.name, effect: e.effect || '', enemy: !!e.enemy_only, ...(res ? { res } : {}),
    ...(e.codex_note ? { note: e.codex_note } : {}), ...(parent ? { secOf: sobName(parent.name) } : {}) };
  sobSeen.set(key, row); sobByOrder.set(e.global_order, row);
  startOfBattle.push(row);
}
// ── Effect order: every other fixed-order combat function (code: _su_extract data/model/effect_order_all.json,
// code/EFFECT_ORDER_FINDINGS.md, HANDOFF_effect_order_app.md). One Appendix section per pipeline; each function lists its
// object-gated blocks in execution order (code position is the order). Structural blocks (no app object) and blacklisted
// traits are dropped; a block gated by several shipped traits (one runtime id) gives a row each; the same object twice in a
// row inside one step is one row. Step headings: the extract's `when`, reworded below (an unmapped one fails the build so
// no code wording ships), or for start of turn its GML line ranges (FINDINGS items 1-2 "Headline order").
// Row: [key, rank | power | null, tag | null] with the app's own refs (trait:<id>, perk:<specId>:<KEY>, relic:<id>, card:<id>,
// spell:<id>, cond:<Cat:key>, realm:<KEY>, spec:<id>).
const effectOrder = (() => {
  const src = EO_ALL;
  const F = new Map(src.functions.map(f => [f.id, f]));
  const SOT_LINES = [[1, 'Turn counter'], [107, 'Early start-of-turn effects'], [270, 'Buffs, debuffs and minions tick down'],
    [473, 'Expired buffs and debuffs are removed'], [594, 'Summons and Health resets'], [643, 'Healing every turn'],
    [689, 'Buff and debuff reactions'], [748, 'Master of Cataclysms'], [831, 'Before damage over time'], [1048, 'Damage every turn'],
    [1059, 'Bleeding deals damage'], [1252, 'Eternal Rest'], [1268, 'Poisoned deals damage'], [1519, 'Bomb explodes'],
    [1632, 'Between Bomb and Burning'], [1693, 'Burning deals damage'], [1867, 'After damage over time'],
    [2565, 'Curse and damage traits'], [2619, "The creature's own start-of-turn effects"], [3320, 'Spell Gems that cast themselves'],
    [3349, 'Start-of-turn attacks and minions'], [3672, 'Start-of-turn effects, continued'], [4057, 'Artifact spell slots'],
    [4099, 'Before the turn-skip checks'], [4308, 'Turn-skip checks'], [4479, 'After the turn-skip checks'],
    [4667, 'Automaton and Priest traits'], [5087, 'Arena and Nemesis rules'], [5121, 'Poisoned, Burning and Bomb potency'],
    [5284, 'Last start-of-turn effects']];
  const DMG = { 'A': 'Cancels, redirects, Shell and damage taken', 'B A': 'Damage taken reductions',
    'B B': 'Damage dealt bonuses, before class advantage', 'B C': 'Class advantage', 'B D': 'Damage dealt bonuses, after class advantage',
    'B E': 'Critical hit decision', 'C A': 'Critical hit chance overrides and damage', 'C B': 'Bonus pool, Defense share and damage cap',
    'C C': 'Immunity, Prevented! and dodges (the hit stops here)', 'C D': 'Per-hit caps and delays', 'C E': 'After-damage reactions, part 1',
    'C F': 'Friendly damage turned into healing', 'C G': 'After-damage reactions, part 2', 'C H': 'The hit moves to another creature',
    'C I': 'After-damage reactions, part 3', 'C J': 'Spiritual Attunement', 'C K': 'After-damage reactions, part 4',
    'C L': 'Scripted battles and rounding', 'C M': 'After-damage reactions, part 5', 'C N': 'Inverted: damage becomes healing',
    'C O': 'Barrier', 'C P': 'Late reactions', 'C Q': "Attacker's artifact: on-hit buffs and debuffs", 'C R': 'Final damage, counters and bookkeeping' };
  const ATK = { 'Entry: attack action limit': 'Action limit',
    'Attack fails / target changes BEFORE the stat snapshot': 'The attack fails or changes target, before Attack and Defense are read',
    'Attack-stat / Defense snapshot': 'Attack and Defense are read',
    'Redirects AFTER the stat snapshot (provoke, intercept, Blind)': 'The target changes after Attack and Defense are read (Provoke, intercepts, Blind)',
    'Number of hits (repeat count)': 'Number of hits', 'Per hit: limit, messages, animation': 'Each hit: limit',
    'Per hit: base damage': 'Each hit: base damage', 'Per hit: dodge decision': 'Each hit: dodge',
    'Per hit: cannot-be-dodged overrides': "Each hit: can't be dodged", 'Per hit: Periphery, the last word on dodging': 'Each hit: Periphery',
    'Per hit: damage adjustments, then the bonus pool is applied': 'Each hit: damage adjustments',
    'Per hit: side effects before the hit resolves': 'Each hit: before it lands', 'Per hit: dodged branch': 'Each hit: dodged',
    'Per hit: the damage event': 'Each hit: damage', 'Per hit: after the hit (still in the loop)': 'Each hit: after it lands',
    'After all hits': 'After all hits' };
  const CAST = { A: 'Before the spell (once per cast)', B1: 'Each cast: limits and charges', B2: "Each cast: the spell's own effect",
    B3: 'Each cast: after the spell', B4: 'Each cast: on-cast triggers', B5: 'Each cast: after the on-cast triggers', C: 'After every cast' };
  const DODGE = { Entry: 'First', "The dodger's own effects": 'The creature that dodged',
    "Effects held by the attacker's side ('after an enemy dodges')": "The attacker's side" };
  const EVT = { setup: 'The event is created', limit: 'Per-turn limit', block: 'Prevented', resist: 'Resisted', convert: 'Converted',
    redirect: 'Redirected', duration: 'Duration', potency: 'Potency', existing: 'Already has it', reduce: 'Reduced', pool: 'Amount',
    queue: 'Reactions', immediate: 'Immediate reactions', finish: 'Applied' };
  const ONBD = { pre: 'Before', exit: 'Stops here', spread: 'Spreads', after: 'Reactions', recurse: 'Repeats' };
  const STAT = { attack: 'Attack', defense: 'Defense', intelligence: 'Intelligence', maxhp: 'Health', speed: 'Speed' };
  const QUEUE = { damage: 'Damage', heal: 'Healing', actionqueue: 'Queued actions', ohko: 'Instant kills', resurrect: 'Resurrection',
    removecondition: 'A buff or debuff is removed', buff: 'Buff', debuff: 'Debuff', summon: 'Summon', gem: 'Spell Gem', minion: 'Minion',
    'after every event': 'After every event' };
  const END = { 'bc_ExecuteEvents (damage case)': 'The last enemy falls', '___struct___289 (battle Step, victory branch)': 'Victory',
    'victory screen close (host labelled inv_SpellGemManaCost by the name map)': 'The victory screen closes',
    'bc_CleanUpBattle': 'Battle clean-up', 'bc_HandleBattleAftermath': 'After the battle', 'bc_GetRewardResources': 'Resource rewards',
    'bc_GetRewardExperience': 'Experience rewards' };
  const stepOf = {
    bc_CreatureStartOfTurn: (b) => { let t = null; for (const [l, n] of SOT_LINES) if (b.line >= l) t = n; return t; },
    bc_EventDamage: (b) => { const m = /^part (A|B [A-E]|C [A-R])\b/.exec(b.when || ''); return m ? DMG[m[1]] : undefined; },
    bc_CreatureAttack: (b) => ATK[b.when], bc_CreatureCast: (b) => CAST[b.when], bc_OnDodge: (b) => DODGE[b.when],
    bc_OnBuffDebuff: (b) => ONBD[b.when], battle_end_victory: (b) => END[b.when],
    bc_ExecuteEvents: (b) => { const m = /^(?:block|core|queue): (.+)$/.exec(b.when || ''), k = m && m[1];
      if (!k) return undefined; const s = /^stat(gain|loss)_(\w+)$/.exec(k);
      return s ? `${STAT[s[2]]} ${s[1] === 'gain' ? 'gain' : 'loss'}` : QUEUE[k]; },
  };
  for (const id of ['bc_EventBuff', 'bc_EventDebuff', ...['Gain', 'Lose'].flatMap(g => ['MaxHP', 'Attack', 'Intelligence', 'Defense', 'Speed'].map(s => `bc_Event${g}${s}`))])
    stepOf[id] = (b) => EVT[b.when];
  // sections in battle order; stat events in the app's stat order (Health, Attack, Intelligence, Defense, Speed)
  const stats = (g, w) => ['MaxHP', 'Attack', 'Intelligence', 'Defense', 'Speed'].map(s => [`bc_Event${g}${s}`, `${s === 'MaxHP' ? 'Health' : s} ${w}`]);
  const SECTIONS = [
    ['Timeline', 'Battle-Start Timeline', [['timeline_build', null]]],
    ['StartOfTurn', 'Start of Turn Order', [['bc_CreatureStartOfTurn', 'Start of turn'], ['bc_CalculateBleedDamage', 'Bleeding damage amount'],
      ['bc_CalculatePoisonDamage', 'Poisoned damage amount'], ['bc_CalculateBombDamage', 'Bomb damage amount'],
      ['bc_CalculateBurnDamage', 'Burning damage amount'], ['bc_CalculateManiaDamage', 'Mania damage amount']]],
    ['Cast', 'Cast Order', [['bc_CreatureCast', 'Casting a spell'], ['bc_OnCast', 'On-cast triggers'], ['bc_CreatureCastSpellGem', 'Automatic casts']]],
    ['SpellAmount', 'Spell Amount Order', [['bc_SpellDamage', 'Spell damage'], ['bc_SpellHealing', 'Spell healing'], ['bc_SpellStat', 'Spell stat changes']]],
    ['Attack', 'Attack Order', [['bc_CreatureAttack', 'Attacking'], ['bc_GetDodgeChance', 'Dodge chance'], ['bc_OnDodge', 'After a dodge'],
      ['bc_GetCriticalChance', 'Critical chance'], ['bc_OnCritical', 'After a critical hit']]],
    ['OnAttack', 'On Attack Order', [['bc_OnAttack', null]]],
    ['Damage', 'Damage Order', [['bc_EventDamage', null]]],
    ['Actions', 'Heal, Defend, Provoke and Minion Order', [['bc_EventHeal', 'A heal is created'], ['bc_ExecuteEvents: heal case', 'The heal lands'],
      ['bc_OnHeal', 'After a heal'], ['bc_CreatureDefend', 'Defending'], ['bc_OnDefend', 'After Defending'], ['bc_CreatureProvoke', 'Provoking'],
      ['bc_OnProvoke', 'After Provoking'], ['bc_EventMinion', 'A minion is created'], ['bc_ExecuteEvents: minion case', 'The minion is summoned'],
      ['bc_OnMinion', 'After a minion is summoned']]],
    ['BuffDebuff', 'Buff and Debuff Order', [['bc_EventBuff', 'Gaining a buff'], ['bc_EventDebuff', 'Gaining a debuff'], ['bc_OnBuffDebuff', 'After a buff or debuff']]],
    ['Stats', 'Stat Change Order', [...stats('Gain', 'gain'), ...stats('Lose', 'loss')]],
    ['Death', 'Death Order', [['bc_OnDeath', 'On death'], ['bc_HandleDeath', 'Death clean-up'], ['bc_OnResurrect', 'After a resurrection']]],
    ['EndOfTurn', 'End of Turn Order', [['bc_CreatureEndOfTurn', null]]],
    ['Events', 'Event Queue and End of Battle', [['bc_ExecuteEvents', 'Event queue'], ['battle_end_victory', 'End of battle (victory)']]],
  ];
  const skipped = new Set(['start_of_battle', 'resurrection_chain', 'macro_trait_picker', 'bc_ExecuteEvents~attack']);
  const listed = new Set(SECTIONS.flatMap(s => s[2].map(f => f[0])));
  for (const f of src.functions) if (!listed.has(f.id) && !skipped.has(f.id)) err(`effect order: function ${f.id} has no Appendix section`);
  // app object check (the extract's keys are the app's refs; condition → its glossary Cat:key)
  const perkKeys = new Set(specs.flatMap(sc => sc.perks.map(p => `${sc.id}:${p.key}`)));
  const condKeys = new Set(conditions.map(c => `${c.cat}:${c.key}`));
  let unresolved = [], dropped = 0, blk = 0, eoNested = 0, eoSelf = 0;
  const appKey = (key) => {
    const o = src.objects[key] || {}, [k, ...rest] = key.split(':'), id = rest.join(':');
    if (o.blacklisted) { blk++; return null; }
    let ok = false, out = key;
    if (k === 'trait') ok = !!traits[id] && !excludedTraitIds.has(+id);
    else if (k === 'perk') ok = perkKeys.has(id);
    else if (k === 'relic') ok = relics.some(r => String(r.id) === id);
    else if (k === 'card') ok = cards.some(c => String(c.id) === id);
    else if (k === 'spell') ok = spells.some(s => String(s.id) === id);
    else if (k === 'condition') { out = 'cond:' + (o.app_ref || ''); ok = condKeys.has(o.app_ref); }
    else if (k === 'realm') ok = realmProps.some(r => r.key === id);
    else if (k === 'spec') ok = specs.some(s => String(s.id) === id);
    if (!ok) { unresolved.push(key); return null; }
    return out;
  };
  const out = SECTIONS.map(([key, title, fns]) => ({ key, title, fns: fns.map(([fid, ftitle]) => {
    const f = F.get(fid); if (!f) { err(`effect order: no function ${fid} in effect_order_all.json`); return null; }
    if (!f.order_fixed) err(`effect order: ${fid} is not a fixed order`);
    const steps = []; let n = 0;
    // nesting (extract S49-S49g): a block's `parent` = {order} of the check it runs inside (`kind` secondary = inside a game
    // object's check, nested = inside a step of the function; `parent_any_of` = a body shared by `a || b`). Pass 1 resolves
    // every block's app keys so a row can name its nearest SHIPPED ancestor (keyless or dropped parents are walked past;
    // 11 parents come after their children, so one pass can't do it).
    const byOrder = new Map(f.blocks.map(b => [b.order, b]));
    const keysOf = new Map();
    for (const b of f.blocks) { const ks = (b.gate && b.gate.keys) || []; if (ks.length) keysOf.set(b.order, ks.map(appKey)); }
    const extraOf = (b) => { const x = b.gate.rank ?? b.gate.power ?? null; return Array.isArray(x) ? x : [x]; };
    const rowRef = (o) => { const b = byOrder.get(o), k = b && (keysOf.get(o) || []).find(Boolean); return k ? [k, extraOf(b)[0]] : null; };
    const parentOf = (b) => { const seen = new Set(); let p = b.parent;
      while (p && !seen.has(p.order)) { seen.add(p.order); const r = rowRef(p.order); if (r) return r; p = (byOrder.get(p.order) || {}).parent; }
      return null; };
    for (const b of f.blocks) {
      const keys = keysOf.get(b.order); if (!keys) continue;
      const st = stepOf[fid] ? stepOf[fid](b) : null;
      if (st === undefined) { err(`effect order: ${fid} step "${b.when}" has no plain-words heading`); continue; }
      const tag = fid === 'timeline_build' ? (/-> TOP\b/.test(b.does || '') ? 'top' : /-> BOTTOM\b/.test(b.does || '') ? 'bottom' : null) : null;
      const pr = b.parent ? parentOf(b) : null;
      // parent cell: [parent key, parent rank | power, 's' secondary | 'n' nested, [[key, rank] …] when the body is shared by `a || b`]
      const any = (b.parent_any_of || []).map(rowRef).filter(Boolean);
      const par = pr ? [pr[0], pr[1], b.kind === 'secondary' ? 's' : 'n', ...(any.length > 1 ? [any] : [])] : null;
      let last = steps[steps.length - 1];
      if (!last || last.t !== st) steps.push(last = { t: st, rows: [] });
      for (const k of keys) {
        if (!k) { dropped++; continue; }
        for (const extra of extraOf(b)) {                            // gate.power can list several powers at one code site
          // an object re-checking itself inside its own block folds into the parent row (as start of battle does)
          if (pr && pr[0] === k && pr[1] === extra) { eoSelf++; continue; }
          const prev = last.rows[last.rows.length - 1];
          // row = [app key, rank | power, timeline tag, resolution (when its change lands: extract S44-S49g; null = not judged), parent cell | null]
          if (prev && prev[0] === k && prev[1] === extra && prev[3] === (b.resolution || null) && JSON.stringify(prev[4]) === JSON.stringify(par)) continue;
          last.rows.push([k, extra, tag, b.resolution || null, par]); n++;
          if (par) eoNested++;
        }
      }
    }
    const kept = steps.filter(s => s.rows.length);
    // adjacent steps with the same heading (an emptied step between them) merge
    const merged = []; for (const s of kept) { const p = merged[merged.length - 1]; if (p && p.t === s.t) p.rows.push(...s.rows); else merged.push(s); }
    return n ? { id: fid, title: ftitle, steps: merged } : null;
  }).filter(Boolean) })).filter(s => s.fns.length);
  const rows = out.reduce((a, s) => a + s.fns.reduce((b, f) => b + f.steps.reduce((c, x) => c + x.rows.length, 0), 0), 0);
  console.log(`  effect order: ${out.length} sections · ${out.reduce((a, s) => a + s.fns.length, 0)} functions · ${rows} rows (${eoNested} nested, +${eoSelf} self re-checks folded) · blacklisted dropped ${blk} · unresolved ${unresolved.length}${unresolved.length ? ': ' + [...new Set(unresolved)].slice(0, 12).join(' ') : ''}`);
  if (unresolved.length) err(`effect order: ${unresolved.length} object keys not in the app`);
  return out;
})();
console.log(`  start-of-battle order: ${startOfBattle.length} rows from ${sobRaw.length} entries · text-only ${startOfBattle.filter(r => r.ref.k === 'text').length} · secondary calls ${startOfBattle.filter(r => r.secOf).length} (+${sobSelf} self re-checks folded) · blacklisted ${sobBlacklisted.length} (${[...new Set(sobBlacklisted)].join(', ')}) · skipped (no app join) ${sobSkipped.length}: ${sobSkipped.join(' | ')}${sobNameDiff.length ? ` · ⚠ trait name mismatches ${sobNameDiff.length}: ${sobNameDiff.join(' | ')}` : ''}`);

// ── Spell gem availability + spells granted by an owner — code (_su_extract spell_owners.json + spell_property_compat.json,
// S28; code/SPELL_GEMS.md, HANDOFF_spell_owners.md). Per spell:
//   battleOnly — never a holdable gem: Ultimates (category ULTIMATE) and the reserved ids 431–441 (Rune / Mega Magic /
//                Colorwave). Booze 312–326 (Tavern) and Living 328–352 (Arena) are reserved but sold as gems, and the boss spells
//                493–543 are False God Inscriptions (spell recipes from the anointment pick, spell_owners.json
//                false_god_inscriptions; the False God is the source, Shadowbringer / Toxicologist starting with Plague / Devastation are
//                exceptions), so they stay. Hidden from every gem picker.
//                Sandbox mode is never a signal (user ruling 2026-10-11).
//   noManual   — a real gem that can't be cast manually (inv_SpellCanBeCastManually: Booze, category BEER, or a static id list),
//                so the macro builder leaves it out.
// spellGrants: owner (perk spec+key / trait app id / relic app id) → spell ids, with mode gem (the creature gains the gem, no
// slot used) | cast (a chance to cast) | boss (False God part AI; shown on the part only), classGate (only creatures of the
// spell's class: Rune perks name the class, Colorwave is "of its own class"), minRank (relic rank text that names the spell).
// relicUltimates: app relic id → its Ultimate (scr_GetUltimateSpellByRelic); ultimateRoutes: who hands it out.
const { spellGrants, relicUltimates, ultimateRoutes } = (() => {
  const so = readJSON(path.join(MODEL, 'spell_owners.json'));
  const cf = readJSON(path.join(MODEL, 'spell_property_compat.json'));
  const spByKey = new Map(spells.map(x => [x.key, x]));
  const codeById = new Map(cf.records.map(r => [r.spell_id, r]));
  // the reserved-id ranges are code ids; check they still land on the spells the findings name
  for (const [id, key] of [[431, 'RUNEOFCOR'], [441, 'COLORWAVESORCERY'], [493, 'PLAGUE'], [543, null], [312, null], [352, null]]) {
    const r = codeById.get(id); if (!r) { err(`spell availability: no code spell ${id}`); continue; }
    if (key && r.key !== key) err(`spell availability: code spell ${id} is ${r.key}, expected ${key}`);
  }
  const NO_MANUAL = new Set([249, 263, 282, 371, 612, 644, 649, 671, 732, 742, 747]);
  const battleIds = (id) => id >= 431 && id <= 441;
  const insc = new Set(so.false_god_inscriptions.by_god.flatMap(g => g.spells.map(x => x.spell_key)));
  if (insc.size !== 51) err(`spell availability: ${insc.size} False God Inscription spells, expected 51`);
  let nBattle = 0, nNoManual = 0, nBooze = 0, nInsc = 0;
  for (const r of cf.records) {
    const sp = spByKey.get(r.key); if (!sp) continue;
    const cat = String(r.category || '');
    if (insc.has(r.key)) nInsc++;
    if (/ULTIMATE/.test(cat) || battleIds(r.spell_id)) { sp.battleOnly = true; nBattle++; }
    if (/BEER/.test(cat)) nBooze++;
    if (/BEER/.test(cat) || NO_MANUAL.has(r.spell_id)) { sp.noManual = true; nNoManual++; }
  }
  if (nInsc !== insc.size) err(`spell availability: ${nInsc}/${insc.size} False God Inscription spells joined`);
  if (nBooze !== 15) err(`spell availability: ${nBooze} Booze (BEER) spells, expected 15`);

  const appSpell = (k) => { const x = spByKey.get(k); if (!x) err(`spell owners: spell ${k} not in the app`); return x ? x.id : null; };
  const traitByRt = new Map(); for (const id in traits) for (const rt of traits[id].runtimeIds || []) traitByRt.set(rt, +id);
  const specByLabel = new Map(specs.map(x => [x.label, x]));
  const relicByName = new Map(relics.map(r => [norm(String(r.name).split(',')[0]), r]));
  const owner = (o) => {
    if (o.kind === 'perk') {
      const sp = specByLabel.get(o.spec), pk = sp && sp.perks.find(x => x.key === o.perk_key);
      if (!pk) { err(`spell owners: perk ${o.spec} / ${o.perk_key} not in the app`); return null; }
      return { kind: 'perk', spec: sp.id, key: pk.key };
    }
    if (o.kind === 'trait') {
      const id = traitByRt.get(o.trait_runtime_id);
      if (id == null) { err(`spell owners: trait runtime ${o.trait_runtime_id} (${o.name}) not in the app`); return null; }
      return { kind: 'trait', id };
    }
    if (o.kind === 'relic') {
      const r = relicByName.get(norm(o.relic_name));
      if (!r) { err(`spell owners: relic ${o.relic_name} not in the app`); return null; }
      return { kind: 'relic', id: r.id };
    }
    err(`spell owners: unknown owner kind ${o.kind}`); return null;
  };
  const grants = [];
  for (const g of so.grants) {
    const ow = owner(g.owner); if (!ow) continue;
    const ids = g.spells.map(x => appSpell(x.spell_key)).filter(x => x != null);
    const chance = /(\d+)% chance/.exec(g.how || '');
    const mode = /False God/.test(g.when || '') ? 'boss' : chance ? 'cast' : 'gem';
    const out = { owner: ow, spells: ids, mode, when: g.when };
    if (chance) out.chance = +chance[1];
    if (/one (at random|of)/.test(g.how || '')) out.oneOf = true;
    // class gate, read from the owner's own text: "your {CLASS_X} creatures gain" (Rune perks) or "of its own class" (Colorwave)
    if (ow.kind === 'perk') {
      const pk = specs.find(x => x.id === ow.spec).perks.find(x => x.key === ow.key);
      const clsOk = ids.every(id => (pk.desc || '').includes(`{CLASS_${spells[id].cls}}`));
      if (clsOk || /of its own class/.test(g.how || '')) out.classGate = true;
    }
    // relic grants only from the rank whose text names the spell
    if (ow.kind === 'relic') {
      const r = relics[ow.id], names = ids.map(id => spells[id].name);
      const rk = r.ranks.find(x => names.some(n => (x.desc || '').includes(n)));
      if (!rk) err(`spell owners: relic ${r.name} rank text never names ${names.join(', ')}`); else out.minRank = rk.rank;
    }
    grants.push(out);
  }
  // Spells an object casts or grants (user 2026-10-21/22: the spell-gem container under the object). Code layer
  // (taxo_v2_tags.json): Actions::Auto Cast `cast_spell_ids` + `cast_from_how` (S47 runtime pools) and Spell Gems::Gain Gem
  // `gem_spell_ids` + `gem_from_how` (S48). Code id → app spell via spell_property_compat. A runtime pool labels each spell with
  // its pick case ("by the enemy's class: Chaos 166, ..." → Chaos); "choose(...)" = one of them at random. Relic entries carry the
  // rank of their code clause. Shipped as `spellsUsed: [{s, k: 'cast'|'gem', l?, rk?}]` on perks / traits / relics / spells.
  // Final Summoning keeps its per-demon list (demonSpells) instead.
  let nUsed = 0; const usedBy = {};
  { const CL = readJSON(path.join(MODEL, 'taxo_v2_tags.json')).objects;
    const labelsOf = (how) => {                                       // "<label> <id>[ / <id>…]" items after the LAST colon
      const m = new Map(), tail = String(how || '').slice(String(how || '').lastIndexOf(':') + 1);   // the code prose before it holds colons too
      for (const it of tail.split(/,\s*/)) { const x = /^\s*(.+?) (\d+(?: \/ \d+)*)\s*$/.exec(it); if (x) for (const id of x[2].split(' / ')) m.set(+id, x[1]); }
      return m;
    };
    const used = (key, obj, label) => {
      const o = CL[key]; if (!o) return;
      const out = [], seen = new Set();
      for (const t of o.tags) {
        const k = t.cast_spell_ids ? 'cast' : t.gem_spell_ids ? 'gem' : null; if (!k) continue;
        const ids = t.cast_spell_ids || t.gem_spell_ids, labels = labelsOf(t.cast_from_how || t.gem_from_how);
        for (const cid of ids) {
          const r = codeById.get(cid), x = r && spByKey.get(r.key);
          if (!x) { err(`spells used: ${label}: code spell ${cid} not in the app`); continue; }
          const rk = t.rank != null ? +t.rank : null, dk = `${x.id}|${rk}`;
          if (seen.has(dk)) continue; seen.add(dk);
          const l = labels.get(cid), e = { s: x.id, k };
          if (l && l !== x.name && l !== 'temp gem of spell') e.l = l;   // the generic code phrase is no pick case (user 2026-10-22)
          if (rk != null) e.rk = rk;
          out.push(e);
        }
      }
      if (out.length) { obj.spellsUsed = out; nUsed++; usedBy[key.split(':')[0]] = (usedBy[key.split(':')[0]] || 0) + 1; }
    };
    for (const sp of specs) for (const pk of sp.perks) if (!pk.demonSpells) used(`perk:${pk.key}`, pk, `${sp.label} / ${pk.name}`);
    for (const t of Object.values(traits)) used(`trait:${t.id}`, t, `trait ${t.name}`);
    for (const r of relics) used(`relic:${r.id}`, r, `relic ${r.name}`);
    for (const x of spells) used(`spell:${x.key}`, x, `spell ${x.name}`);
  }
  console.log(`  spells used (code cast_spell_ids / gem_spell_ids): ${nUsed} objects · ${Object.entries(usedBy).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  const ult = {};
  for (const u of so.ultimate_by_relic) {
    const r = relicByName.get(norm(u.owner.relic_name)), id = appSpell(u.spell_key);
    if (!r) err(`relic Ultimate: relic ${u.owner.relic_name} not in the app`); else if (id != null) ult[r.id] = id;
  }
  const routes = so.ultimate_grant_routes.filter(r => r.owner.kind !== 'creature_group').map(r => {
    const ow = owner(r.owner); if (!ow) return null;
    return { owner: ow, mode: /replaced/.test(r.how) ? 'replaceArtifactSpell' : 'gem', when: 'start of battle' };
  }).filter(Boolean);
  console.log(`  spell availability (code): ${nBattle} battle-only · ${nInsc} False God Inscription spells · ${nNoManual} not manually castable · ` +
    `owners: ${grants.length} grants (${grants.filter(g => g.mode === 'gem').length} gem / ${grants.filter(g => g.mode === 'cast').length} cast / ` +
    `${grants.filter(g => g.mode === 'boss').length} boss) · ${Object.keys(ult).length}/${relics.length} relic Ultimates · ${routes.length} Ultimate routes`);
  return { spellGrants: grants, relicUltimates: ult, ultimateRoutes: routes };
})();

// ── Buffs / debuffs an object applies or always has (user 2026-10-22: the same container idea as spells) — code layer
// (taxo_v2_tags.json) Buffs:: / Debuffs:: Apply and Always Has tags: `named` (registry name) or `condition_ids` (registry ids).
// Only code-grounded names (conf code / code-flow; the 64 `inferred` names are left out); random / "existing" picks name no
// single status effect. Registry name → the game's display name (token_names) → the app condition of that category.
// Shipped as `condsUsed: [{c: "<cat>:<key>", k: 'apply'|'always', rk?}]` on perks / traits / relics / spells.
{
  const CL = readJSON(path.join(MODEL, 'taxo_v2_tags.json')).objects;
  const REG = readJSON(path.join(MODEL, 'condition_registry.json')).conditions, regById = new Map(REG.map(c => [c.id, c]));
  const appCond = (cat, name, regKey) => conditions.find(c => c.cat === cat && (c.name === condDisplay(name) || c.name === name
    || (regKey && c.key === regKey.toLowerCase()) || c.key === String(name).toLowerCase()));
  let nObj = 0, nInferred = 0; const unmapped = new Set(), by = {};
  const used = (key, obj) => {
    const o = CL[key]; if (!o) return;
    const out = [], seen = new Set();
    for (const t of o.tags) {
      const m = /^(Buffs|Debuffs)::(Apply|Always Has)$/.exec(t.tag); if (!m) continue;
      const cat = m[1] === 'Buffs' ? 'Buff' : 'Debuff', k = m[2] === 'Apply' ? 'apply' : 'always';
      if (!/^code/.test(t.conf || '')) { if (t.named || t.condition_ids) nInferred++; continue; }
      const names = t.named ? [[t.named, null]] : (t.condition_ids || []).map(id => regById.get(id)).filter(Boolean).map(r => [r.name, r.key]);
      for (const [n, rk0] of names) {
        if (/random|existing/i.test(n)) continue;
        const c = appCond(cat, n, rk0); if (!c) { unmapped.add(`${cat} ${n}`); continue; }
        const rk = t.rank != null ? +t.rank : null, id = `${c.cat}:${c.key}`, dk = `${id}|${rk}`;
        if (seen.has(dk)) continue; seen.add(dk);
        out.push({ c: id, k, ...(rk != null ? { rk } : {}) });
      }
    }
    if (out.length) { obj.condsUsed = out; nObj++; by[key.split(':')[0]] = (by[key.split(':')[0]] || 0) + 1; }
  };
  for (const sp of specs) for (const pk of sp.perks) used(`perk:${pk.key}`, pk);
  for (const t of Object.values(traits)) used(`trait:${t.id}`, t);
  for (const r of relics) used(`relic:${r.id}`, r);
  for (const x of spells) used(`spell:${x.key}`, x);
  for (const u of unmapped) err(`buffs/debuffs used: ${u} has no app status effect`);
  console.log(`  buffs/debuffs used (code named / condition_ids): ${nObj} objects · ${Object.entries(by).map(([k, n]) => `${k} ${n}`).join(' · ')} · ${nInferred} inferred names left out`);
}

// ── Rodian Creature Masters per realm — code (_su_extract master_realms.json, S28–S28c; code/MASTER_SPAWN_FINDINGS.md,
// archive/handoffs/HANDOFF_rodian_masters.md). pool = the realm's spawn races (scr_GetRaceArrayByRealm) + Master-only extras
// (scr_GetMasterRaces), in code order. Joined to the app realm by name (& ↔ and); every pool race must have its Master trait.
const masterRealms = (() => {
  const mr = readJSON(path.join(MODEL, 'master_realms.json'));
  const amp = (x) => String(x).replace(/\s*&\s*/g, ' and ');
  const appRealm = new Map(realms.map(r => [amp(r.realm), r.realm]));
  const masters = new Set(Object.values(traits).filter(t => /^Master of /.test(t.name)).map(t => t.name.slice(10).toLowerCase()));
  const plurals = (r) => { r = r.toLowerCase(); return [r, r + 's', r + 'es', r.replace(/y$/, 'ies'), r.replace(/f$/, 'ves'), r.replace(/man$/, 'men')]; };
  const out = [], races = new Set();
  for (const [name, r] of Object.entries(mr.realms)) {
    const realm = appRealm.get(amp(name));
    if (!realm) { err(`master realms: realm ${name} not in the app`); continue; }
    for (const x of r.pool) { races.add(x); if (!plurals(x).some(p => masters.has(p))) err(`master realms: no Master trait for ${x} (${name})`); }
    out.push({ realm, pool: r.pool, extra: r.master_extra || [] });
  }
  if (out.length !== realms.length) err(`master realms: ${out.length}/${realms.length} realms`);
  console.log(`  master realms: ${out.length} · races ${races.size}`);
  return out.sort((a, b) => a.realm.localeCompare(b.realm));
})();

// ── Boss encounters — code (_su_extract bosses.json, S29; code/FALSE_GOD_BEHAVIOR_FINDINGS.md, HANDOFF_boss_encounters.md).
// One shape for every boss type (False Gods now; Nether Bosses / Gate of the Gods later). Each unit's turn script + passives
// are the code's step list; ids are translated here so the app never sees a code id: spells by code id → key → app spell,
// conditions by code id → registry key → app condition, traits by legacy id, specs by runtime id (asserted by name), part
// sprites by battle frame. Every miss is a build error. Stats stay level-1 base (DECISIONS.md). Runes get their code check.
const bosses = (() => {
  const bj = readJSON(path.join(MODEL, 'bosses.json'));
  const cf = readJSON(path.join(MODEL, 'spell_property_compat.json'));
  const codeSpellKey = new Map(cf.records.map(r => [r.spell_id, r.key]));
  const spByKey = new Map(spells.map(x => [x.key, x]));
  const spell = (s, where) => {
    const x = spByKey.get(codeSpellKey.get(s.id));
    if (!x) { err(`bosses: ${where} spell ${s.id} (${s.name}) not in the app`); return null; }
    if (norm(x.name) !== norm(s.name)) warn(`bosses: ${where} spell ${s.id} is "${x.name}" in the app, "${s.name}" in bosses.json`);
    return x.id;
  };
  const condKey = new Map(readJSON(path.join(MODEL, 'condition_registry.json')).conditions.filter(c => c.key).map(c => [c.id, c.key]));
  const appCond = new Map(conditions.filter(c => c.cat !== 'Minion').map(c => [c.key, c.key]));
  const cond = (c, where) => {
    if (!c || c.id === 0) return null;                       // Mindwurm's saddle pool: the zero constant is not a buff (noted in data)
    const k = condKey.get(c.id), key = k && appCond.get(norm(k));
    if (!key) err(`bosses: ${where} condition ${c.id} (${c.name}) not in the app`);
    return key || null;
  };
  const traitByRt = new Map(); for (const id in traits) for (const rt of traits[id].runtimeIds || []) traitByRt.set(rt, +id);
  const OUT_BOSSPARTS = path.join(OUT_ASSETS, 'bossparts');
  fs.rmSync(OUT_BOSSPARTS, { recursive: true, force: true });
  fs.mkdirSync(OUT_BOSSPARTS, { recursive: true });
  // spr_crits_battle PNGs are exported trimmed; the frame's place in its 64x64 cell (dump_battle_frame_offsets.csx) lets the
  // page reassemble a multi-part boss pixel-exact
  const FRAME_OFF = JSON.parse(fs.readFileSync(path.join(SRC, 'assets', 'battle_frame_offsets.json'), 'utf8'));
  const TYPE_LABEL = { false_god: 'False Gods', nether_boss: 'Nether Bosses', gate_god: 'Gate of the Gods' };
  const unesc = (t) => String(t || '').replace(/\\n/g, '\n');
  // extract notes are written for the decode; the app shows them in plain language. Code refs in parentheses are dropped,
  // the rest is rewritten here (meaning kept), and any note that still reads like code fails the build.
  const NOTE_PLAIN = [
    [/^The OR check is has\(\d+\) \|\| has\(\d+\)/, null],                // replaced by the generated quirk line on the unit it affects
    [/^No scripted branch for this trait/, null],                                // the app's own "normal enemy AI" line says it
    [/^Sixth pool entry is the zero constant/, 'The sixth entry in this list is not a buff, so about 1 in 6 picks likely gives nothing (not yet checked in-game).'],
    [/^Trait text also says Burned damage cannot be circumvented/, "The trait text also says Burned damage can't be avoided; no code for that was found (unverified)."],
  ];
  const plainNote = (n, w) => {
    if (!n) return null;
    for (const [re, to] of NOTE_PLAIN) if (re.test(n)) return to;
    const t = String(n).replace(/\s*\([^()]*(?:\b0x[0-9a-f]+|\bscr_\w+)[^()]*\)/g, '');
    if (/0x[0-9a-f]|has\(|\bscr_|\bbc_|\bL_[A-Z_]{3,}|\bcondition \d/.test(t)) err(`bosses: ${w} note still reads like code: ${t}`);
    return t;
  };
  const SKIP = new Set(['code', 'code_arg', 'gate', 'via_or_check', 'spell', 'pool', 'condition', 'creature_ids']);
  const out = [];
  let nUnits = 0, nSteps = 0;
  // types the app doesn't build yet (Gate of the Gods until its schema lands) are counted, never silently dropped
  const BUILT = new Set(['false_god', 'nether_boss', 'gate_god']);
  const skipped = bj.encounters.filter(e => !BUILT.has(e.type));
  if (skipped.length) warn(`bosses: ${skipped.length} encounters of an unbuilt type skipped (${[...new Set(skipped.map(e => e.type))].join(', ')})`);
  for (const e of bj.encounters.filter(e => e.type === 'false_god')) {
    const where = e.name;
    const unitName = new Map(e.units.map(u => [u.creature_id, u.name]));
    const step = (s, w) => {
      const o = {};
      for (const [k, v] of Object.entries(s)) if (!SKIP.has(k)) o[k] = v;
      if (s.spell) o.spells = [spell(s.spell, w)].filter(x => x != null);
      if (s.pool && s.kind === 'cast') { o.spells = s.pool.map(p => spell(p, w)).filter(x => x != null); o.oneOf = s.pool.length > 1; }
      if (s.pool && s.kind === 'buff') { o.conds = s.pool.map(p => cond(p, w)); o.oneOf = true; }
      if (s.condition) o.cond = cond(s.condition, w);
      if (s.kind === 'note') { o.text = plainNote(s.text, w); if (!o.text) return null; }
      if (s.creature_ids) o.units = s.creature_ids.map(id => unitName.get(id) || (err(`bosses: ${w} targets unknown unit ${id}`), String(id)));
      nSteps++;
      return o;
    };
    const units = e.units.map(u => {
      const w = `${where} / ${u.name}`;
      // runtime id is the join; legacy_ids (empty for some same-name parts) must agree when present
      const traitId = traitByRt.get(u.trait.runtime_id);
      if (traitId == null) err(`bosses: ${w} trait ${u.trait.name} (runtime ${u.trait.runtime_id}) not in the app`);
      else if ((u.trait.legacy_ids || []).length && !u.trait.legacy_ids.includes(traitId)) err(`bosses: ${w} runtime ${u.trait.runtime_id} → app trait ${traitId}, legacy_ids say ${u.trait.legacy_ids}`);
      else if (norm(traits[traitId].name) !== norm(u.trait.name)) err(`bosses: ${w} trait ${traitId} is "${traits[traitId].name}", expected "${u.trait.name}"`);
      const src = path.join(SRC_BATTLE, `spr_crits_battle_${u.battle_frame}.png`);
      let img = null;
      if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(OUT_BOSSPARTS, `${u.battle_frame}.png`)); img = `assets/bossparts/${u.battle_frame}.png`; }
      else err(`bosses: ${w} battle frame ${u.battle_frame} missing (404-source)`);
      const fo = FRAME_OFF.frames[u.battle_frame];
      if (!fo) err(`bosses: ${w} battle frame ${u.battle_frame} has no offset`);
      const off = fo ? fo.map((v, i) => +(v / (i % 2 ? FRAME_OFF.h : FRAME_OFF.w) * 100).toFixed(4)) : null;   // % of the cell
      // a unit caught by another trait's OR check runs that kit; its own branch is never reached (Saint Althea's second Hand)
      let turnNote = plainNote(u.turn_action ? u.turn_action.note : u.turn_action_note, w);
      // only a quirk when the shared branch belongs to a differently named part (two copies of one part sharing a branch is normal)
      const kit = u.turn_action && u.turn_action.via_or_check ? e.units.find(x => x.trait.runtime_id === u.turn_action.gate) : null;
      if (u.turn_action && u.turn_action.via_or_check && !kit) err(`bosses: ${w} OR-check gate ${u.turn_action.gate} matches no unit`);
      if (kit && norm(kit.trait.name) !== norm(u.trait.name)) {
        const own = ((u.unreachable_branch || {}).steps || []).flatMap(x => (x.pool || []).map(p => spells[spell(p, w)]).filter(Boolean)).map(x => x.name);
        turnNote = `Code quirk: casts the ${kit.trait.name} spells.${own.length ? ` Its own list (${own.join(', ')}) is never used.` : ''}`;
      }
      nUnits++;
      return {
        slot: u.slot, grid: u.grid_position, name: u.name, stats: u.base_stats, img, off, traitId: traitId ?? null,
        turn: u.turn_action ? u.turn_action.steps.map(s => step(s, w)) : null,
        ...(turnNote ? { turnNote } : {}),
        passives: (u.passives || []).map(s => step(s, w)).filter(Boolean),
      };
    });
    const specIds = (e.anointment_specs || []).map(s => {
      const sp = specs.find(x => x.id === s.spec_id);
      if (!sp || norm(sp.label) !== norm(s.name)) err(`bosses: ${where} anointment spec ${s.spec_id} (${s.name}) does not match the app`);
      return sp ? sp.id : null;
    }).filter(x => x != null);
    // Inscriptions: picking an Anointment also teaches one unknown spell recipe from this list (this boss is its source);
    // a spec that starts with one of the recipes is an exception, never the source
    const inscriptions = ((e.inscriptions || {}).spells || []).map(x => {
      const id = spell(x, `${where} inscription`);
      return id == null ? null : { spell: id, ...((x.exceptions || []).length ? { exceptions: x.exceptions.map(c => c.detail) } : {}) };
    }).filter(Boolean);
    if (e.type === 'false_god' && !inscriptions.length) err(`bosses: ${where} has no Inscriptions`);
    if (e.type === 'false_god') {
      const fg = falseGods.find(g => g.key === e.app_key);
      if (!fg) err(`bosses: ${where} has no app False God ${e.app_key}`);
      else if (fg.name !== e.name) err(`bosses: ${where} is "${fg.name}" in the app`);
    }
    out.push({
      id: e.id, type: e.type, key: e.app_key || e.key, name: e.name,
      lore: unesc(e.lore && e.lore.text), dialog: unesc(e.dialog && e.dialog.text),
      orb: (e.nether_orb && e.nether_orb.class) || null, specIds, inscriptions,
      mechanics: (e.mechanics || []).map(m => ({ kind: m.kind, ...(m.turns ? { turns: m.turns } : {}), text: m.text, ...(m.check ? { check: m.check } : {}) })),
      units: units.sort((a, b) => a.slot - b.slot),
    });
  }
  // Nether Bosses (bosses.json type nether_boss; code/NETHER_BOSS_BEHAVIOR_FINDINGS.md): an ordinary creature record in a
  // boss skin, its boss trait in 3 tiers (times beaten), generic enemy AI. Creature joined by name and asserted by its own
  // trait's runtime id; tier traits by runtime id; skins by code skin id. Trait materials: tier + depth from the wiki
  // Trait Materials table (nether_boss_trait_depths.json), asserted against the item reconciliation's boss source.
  const crByName = new Map(creatures.map(c => [norm(c.name), c]));
  const skinIds = new Set(skins.map(x => x.id));
  const nbDepths = readJSON(path.join(REF, 'nether_boss_trait_depths.json')).traits;
  const recon = readJSON(path.join(MODEL, 'item_reconciliation.json'));
  const reconSrc = new Map((Array.isArray(recon) ? recon : recon.records || recon.items || []).map(r => [r.index, r.source || '']));
  const normTN = (x) => String(x || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '');
  const tiByTrait = new Map(traitItems.map(t => [normTN(t.traitName), t]));
  const rtTrait = (t, w) => { const id = traitByRt.get(t.runtime_id);
    if (id == null) err(`bosses: ${w} trait ${t.name} (runtime ${t.runtime_id}) not in the app`);
    else if (norm(traits[id].name) !== norm(t.name)) err(`bosses: ${w} trait ${id} is "${traits[id].name}", expected "${t.name}"`);
    return id ?? null; };
  // threat analysis + plain code-vs-text notes: app-authored from the extract's behaviour (data/reference/nether_boss_advice.json);
  // each threat resolves to per-tier {title, what, why}, every tier it covers must have all three, and no line may read like code
  const NB_ADV = readJSON(path.join(ROOT, 'data', 'reference', 'nether_boss_advice.json')).bosses;
  const nbKeys = new Set(bj.encounters.filter(e => e.type === 'nether_boss').map(e => e.key));
  for (const k in NB_ADV) if (!nbKeys.has(k)) err(`nether advice: ${k} is not a Nether Boss key`);
  const CODEY = new RegExp(String.raw`0x[0-9a-f]|\bscr_|\bbc_|\bslot \d|dtype|runtime|\bL_[A-Z_]{3,}`);
  const perTier = (v, t) => v == null ? null : typeof v === 'string' ? v : v[t] ?? null;
  const advice = (key, where) => {
    const a = NB_ADV[key]; if (!a) { err(`nether advice: ${where} has no entry`); return null; }
    const threats = (a.threats || []).map((x, i) => [1, 2, 3].map(t => {
      if (x.tiers && !x.tiers.includes(t)) return null;
      const r = { title: perTier(x.title, t), what: perTier(x.what, t), why: perTier(x.why, t) };
      for (const f in r) { if (!r[f]) err(`nether advice: ${where} threat ${i + 1} tier ${t} has no ${f}`); else if (CODEY.test(r[f])) err(`nether advice: ${where} threat ${i + 1} reads like code: ${r[f]}`); }
      return r;
    }));
    const notes = [1, 2, 3].map(t => [...((a.notes || {}).all || []), ...((a.notes || {})[t] || [])]);
    const noteUnit = (a.notes || {})._unit || null;   // which creature's boss trait the notes clarify (default: the lead)
    for (const n of notes.flat()) if (CODEY.test(n)) err(`nether advice: ${where} note reads like code: ${n}`);
    // per tier: the threats that apply, in authored order
    return { threats: [0, 1, 2].map(t => threats.map(x => x[t]).filter(Boolean)), notes, ...(noteUnit ? { noteUnit } : {}) };
  };
  for (const e of bj.encounters.filter(e => e.type === 'nether_boss')) {
    const where = e.name;
    const units = e.units.map(u => {
      const w = `${where} / ${u.creature}`, c = crByName.get(norm(u.creature));
      if (!c) err(`bosses: ${w} creature not in the app roster`);
      const own = u.own_trait ? rtTrait(u.own_trait, `${w} own`) : null;
      if (c && own != null && c.traitId !== own) err(`bosses: ${w} own trait ${own} ≠ the app creature's trait ${c.traitId}`);
      const skin = typeof u.skin === 'number' ? [u.skin] : /^choose\(/.test(String(u.skin || '')) ? String(u.skin).match(/\d+/g).map(Number) : [];
      for (const k of skin) if (!skinIds.has(k)) err(`bosses: ${w} skin ${k} not in the app`);
      // a tier whose record is a blacklisted same-text duplicate (Flubris tier 2 = tier 3's text) shows its shipped twin
      const bt = (u.boss_traits || []).sort((a, b) => a.tier - b.tier);
      const tiers = bt.map(t => { const twin = !traitByRt.has(t.runtime_id) && bt.find(x => x !== t && x.desc === t.desc && traitByRt.has(x.runtime_id));
        return twin ? traitByRt.get(twin.runtime_id) : rtTrait(t, `${w} tier ${t.tier}`); });
      if (tiers.length && tiers.length !== 3) err(`bosses: ${w} has ${tiers.length} boss-trait tiers`);
      nUnits++;
      return { slot: u.slot, name: u.nickname || u.creature, creature: c ? c.id : null, skins: skin,
        stats: u.base_stats, ownTraitId: own, ...(tiers.length ? { tiers } : {}) };
    });
    const materials = nbDepths.filter(r => norm(r.boss.replace(/&/g, 'and')) === norm(e.name)).sort((a, b) => a.tier - b.tier).map(r => {
      const ti = tiByTrait.get(normTN(r.trait));
      if (!ti) { err(`bosses: ${where} trait material for "${r.trait}" not in the app`); return null; }
      if (!new RegExp(`Nether Boss \(${e.name.replace(/[()]/g, '.')}\)`).test(reconSrc.get(ti.id) || '')) warn(`bosses: ${where} material ${ti.name}: item source is "${reconSrc.get(ti.id) || 'none'}"`);
      return { tier: r.tier, item: ti.id, traitId: ti.traitId, depth: r.depth };
    }).filter(Boolean);
    if (materials.length !== 3) err(`bosses: ${where} has ${materials.length} trait materials`);
    const fill = +((/^(\d+) other slot/.exec(e.battle.random_fill) || [])[1] || 0);
    out.push({
      id: e.id, type: e.type, key: `NB_${e.key}`, name: e.name, nbId: e.type_id,
      dialog: (e.dialog || []).map(d => unesc(d.text)).join('\n\n') || null,
      fill, units, materials, advice: advice(e.key, where),
      // tier 3 party change (Flubris / Kraynaks: six copies, named); Inner Darkness's "all six carry the trait" is in its advice
      ...(/^six /i.test(e.tier3_party || '') && /\(([^)]+)\)/.test(e.tier3_party) ? { party3: /\(([^)]+)\)/.exec(e.tier3_party)[1].split(/,\s*/) } : {}),
    });
  }
  // Gate of the Gods (bosses.json gate_god; code/GATE_OF_THE_GODS_FINDINGS.md): the god's Avatar with its own trait replaced by
  // the god trait (one per god, no tiers) + 5 random realm creatures; generic AI. Avatar joined by name, asserted by the
  // replaced trait's runtime id; god trait by runtime id. Rewards: the god's costume (wardrobe category god, code-named
  // L_WD_<GOD>, joined by name). Threats: data/reference/gate_god_advice.json, same checks as the Nether Bosses.
  const GG_ADV = readJSON(path.join(ROOT, 'data', 'reference', 'gate_god_advice.json')).gods;
  const ggKeys = new Set(bj.encounters.filter(e => e.type === 'gate_god').map(e => e.units[0].key));
  for (const k in GG_ADV) if (!ggKeys.has(k)) err(`gate advice: ${k} is not a god Avatar key`);
  for (const e of bj.encounters.filter(e => e.type === 'gate_god')) {
    const where = e.name, u0 = e.units[0], a = GG_ADV[u0.key];
    if (!a) err(`gate advice: ${where} has no entry`);
    const threats = ((a || {}).threats || []).map((x, i) => { for (const f of ['title', 'what', 'why']) { if (!x[f]) err(`gate advice: ${where} threat ${i + 1} has no ${f}`); else if (CODEY.test(x[f])) err(`gate advice: ${where} threat ${i + 1} reads like code: ${x[f]}`); }
      return { title: x.title, what: x.what, why: x.why }; });
    const notes = ((a || {}).notes || []); for (const n of notes) if (CODEY.test(n)) err(`gate advice: ${where} note reads like code: ${n}`);
    const units = e.units.map(u => {
      const w = `${where} / ${u.creature}`, c = crByName.get(norm(u.creature));
      if (!c) err(`bosses: ${w} Avatar not in the app roster`);
      const own = u.own_trait_replaced ? rtTrait(u.own_trait_replaced, `${w} own`) : null;
      if (c && own != null && c.traitId !== own) err(`bosses: ${w} replaced trait ${own} ≠ the app creature's trait ${c.traitId}`);
      const god = rtTrait(u.god_trait, `${w} god trait`);
      nUnits++;
      return { slot: u.slot, name: u.creature, creature: c ? c.id : null, stats: u.base_stats, ownTraitId: own, godTraitId: god };
    });
    // (its "three skins" aren't named in the reward code, and the Avatar's creature-locked skins include seasonal ones: not listed)
    const costume = wardrobe.find(x => x.category === 'god' && norm(x.name) === norm(e.name));
    if (!costume) warn(`bosses: ${where} has no god costume in the wardrobe`);
    out.push({
      id: e.id, type: e.type, key: `GG_${u0.key.replace(/[^A-Z0-9]/g, '')}`, name: e.name, ggId: e.type_id,
      // the god's lines (speaker tag dropped, the player's name as "[your name]"); a line repeated inside another is kept once
      dialog: (() => { const ds = (e.dialog || []).map(d => unesc(d.text).replace(/^\{GODT_[A-Z]+\}:\s*/, '').replace(/\{PLAYERNAME\}/g, '[your name]').trim());
        return ds.filter((d, i) => !ds.some((o, j) => j !== i && o.includes(d) && (o.length > d.length || j < i))).join('\n\n') || null; })(),
      fill: +((/^(\d+) random/.exec(e.battle.random_fill) || [])[1] || 0), units,
      unlock: e.unlock, ascension: !!e.counts_for_ascension,
      costume: costume ? costume.key : null,
      advice: { threats, notes },
    });
  }
  // rune code checks: only the clarify (code ≠ text, e.g. Damage Cap) ships, shown on the boss page's rune advice
  const rc = new Map(((bj.modifiers.false_god_runes || {}).runes || []).map(r => [r.key, r.code_check]));
  for (const r of runes) {
    const c = rc.get(r.key);
    if (!c) { err(`bosses: rune ${r.key} has no code check`); continue; }
    if (c.clarify) r.clarify = c.clarify;
  }
  // list-page toggle order (user): Nether Bosses | False Gods | Gate of the Gods; a type with no encounters yet still gets its tab
  const types = ['nether_boss', 'false_god', 'gate_god'].map(t => ({ type: t, label: TYPE_LABEL[t] }));
  for (const t of new Set(out.map(e => e.type))) if (!TYPE_LABEL[t]) err(`bosses: encounter type ${t} has no label`);
  console.log(`  bosses: ${out.length} encounters (${types.map(t => `${out.filter(e => e.type === t.type).length} ${t.type}`).join(' / ')}) · ${nUnits} units · ${nSteps} steps`);
  return { types, encounters: out };
})();

// ── trigger scope (creature detail Triggers): who in the party a triggered perk / trait is about, read off its game text
// (tools/trigger-scope.mjs). Only entities with an Activates at / Activates When tag get one. Code check: a race the text
// scope names must be among the perk signature's race gates (field:race == "<Race>") whenever the signature has any. The
// other direction is not checked: signature race gates also come from shared host code (Seraphim → Amaranth).
{
  setRaces(creatures.map(c => c.race));
  const hasTrig = (o) => (o.taxo || []).some(t => /^Activates (at|When)::/.test(t));
  const pack = (sc) => { const o = {}; if (sc.t.length) o.t = sc.t; if (sc.a.length) o.a = sc.a; return Object.keys(o).length ? o : null; };
  let nP = 0, nT = 0;
  for (const sp of specs) for (const pk of sp.perks) if (hasTrig(pk)) { const sc = pack(triggerScope(pk.desc)); if (sc) { pk.trigScope = sc; nP++; } }
  for (const t of Object.values(traits)) if (hasTrig(t)) { const sc = pack(triggerScope(t.desc)); if (sc) { t.trigScope = sc; nT++; } }
  const sigP = path.join(MODEL, 'perk_signatures.json');
  if (fs.existsSync(sigP)) {
    const byKey = new Map(); for (const sp of specs) for (const pk of sp.perks) byKey.set(pk.key, pk);
    for (const r of Object.values(readJSON(sigP).records || {})) {
      const races = new Set(); for (const c of r.clauses || []) for (const g of (c.raw && c.raw.gcmps) || []) if (g[0] === 'field:race' && /^str:/.test(String(g[2]))) races.add(String(g[2]).slice(4));
      const pk = byKey.get(r.key); if (!pk || !races.size || !hasTrig(pk)) continue;
      const txt = (pk.trigScope ? [...(pk.trigScope.t || []), ...(pk.trigScope.a || [])] : []).filter(x => x.startsWith('race:')).map(x => x.slice(5));
      for (const race of txt) if (!races.has(race)) warn(`trigger scope: perk ${pk.key} text names race ${race}, code gates on ${[...races].join('/')}`);
    }
  }
  const scopeWarn = warnings.filter(w => w.startsWith('trigger scope:'));
  console.log(`  trigger scope: ${nP} perks · ${nT} traits${scopeWarn.length ? ` · ⚠ ${scopeWarn.join(' · ')}` : ''}`);
}

// ── Taxonomy v2 (TAXONOMY_INTENT.md, ratified 2026-10-19), shipped NEXT TO v1 until the cutover (user 2026-10-19: parallel,
// then one cutover). tools/taxo-v2.mjs: each object's final v1 tags through the crosswalk ∪ the extract's code layer
// (taxo_v2_tags.json; code decides splits and supplies scope / source / role / phase / delivery). Undecided splits keep
// every candidate as 'unverified'. Objects carry taxo2 [{t, s?, so?, r?, p?, d?, rk?, v}] and theme2 (derived themes).
// rk (relics): the relic rank whose code clause holds the tag's site (relic_signatures.json records[].clauses[].site);
// a relic tag whose site is in no rank clause has no rk and counts for the whole relic.
const taxonomy2 = (() => {
  const CLP = path.join(MODEL, 'taxo_v2_tags.json');
  if (!fs.existsSync(CLP)) { warn('taxonomy v2: taxo_v2_tags.json missing, v2 not built'); return null; }
  const X = readJSON(path.join(ROOT, 'data', 'reference', 'taxonomy_crosswalk.json'));
  const V = makeTaxoV2(X, readJSON(CLP));
  const counts = {}, removed = {}, involves = {};
  // Involves (user 2026-10-20) = the umbrella view: every object carries Involves::<theme> for EACH of its themes (theme2),
  // so one tag lists everything touching a mechanic (the old Action/Mechanic role). A theme that came only from a v1
  // Action/Mechanic tag (no v2 tag re-derives it) stays in theme2 but is a review item for the extract: find its narrower
  // tag (app_involves_review.json, HANDOFF F5). Adjacency / Artifact / Relic / Personality have no narrower tags.
  const INVOLVES_PERMANENT = new Set(['Adjacency', 'Artifact', 'Relic', 'Personality']);
  const relicSig = readJSON(path.join(MODEL, 'relic_signatures.json')).records || [];
  const relicRankBySite = new Map();
  for (const p of relicSig) for (const c of p.clauses || []) relicRankBySite.set(`${p.app_relic_id}:${c.site}`, p.rank);
  const relicNoRank = [];
  const run = (kind, id, o) => {
    const r = V.build(kind, id, o.taxo || [], o.taxoSrc, kind === 'relic' ? { rankOf: (site) => relicRankBySite.get(`${id}:${site}`) ?? null } : {});
    if (kind === 'relic') for (const e of r.taxo2) if (e.v === 'code' && e.rk == null) relicNoRank.push(`${o.name.split(',')[0]} ${e.t}`);
    const themeOnly = r.themeOnly;
    o.taxo2 = [...r.taxo2.filter(e => !e.t.startsWith('Involves::')), ...r.theme2.map(th => ({ t: 'Involves::' + th, v: 'theme' }))];
    o.theme2 = r.theme2;
    if (r.removed.length) removed[`${kind}:${id}`] = { name: o.name || o.family || null, desc: o.desc || null, removed: r.removed };
    for (const e of o.taxo2) counts[e.t] = (counts[e.t] || 0) + 1;
    const inv = themeOnly.filter(th => !INVOLVES_PERMANENT.has(th));
    if (inv.length) involves[`${kind}:${id}`] = { name: o.name || o.family || null, desc: o.desc || null, involves: inv, v2: r.taxo2.filter(e => !e.t.startsWith('Involves::')).map(e => e.t) };
  };
  for (const t of Object.values(traits)) run('trait', t.id, t);
  for (const sp of specs) for (const pk of sp.perks || []) run('perk', pk.key, pk);
  for (const o of spells) run('spell', o.key ?? o.id, o);
  for (const o of relics) run('relic', o.id, o);
  for (const o of cards) run('card', o.id, o);
  for (const o of conditions) run('condition', o.key, o);
  if (relicNoRank.length) console.log(`  taxonomy v2: ${relicNoRank.length} relic tags have no rank (site in no relic_signatures clause; HANDOFF_taxonomy_v2 F5): ${relicNoRank.slice(0, 8).join(' · ')}${relicNoRank.length > 8 ? ' …' : ''}`);
  const { unknown, ...st } = V.stats;
  for (const [t, n] of Object.entries(unknown)) warn(`taxonomy v2: value ${t} (${n}×) is not in the crosswalk / new_values`);
  console.log(`  taxonomy v2: ${st.objects} objects (${st.withCode} with code) · ${st.entries} code-backed tags (code ${st.code} · field / boss ${st.other}) · Involves ${st.involves} · event scopes ${st.eventScope} resolved / ${st.eventScopeOff} off · code-dropped values ${st.codeDropped} · wrong themes dropped ${st.wrongDropped}`);
  console.log(`  taxonomy v2 removed (not code-backed, user 2026-10-19): ${st.removed} tags on ${Object.keys(removed).length} objects · ${Object.entries(st.removedBy).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
  // the extract works through the removed list (HANDOFF_taxonomy_v2.md): written into its data_dump when present
  const dumpDir = path.join(SRC, 'code', 'data_dump', 'taxo_v2');
  if (fs.existsSync(dumpDir)) fs.writeFileSync(path.join(dumpDir, 'app_removed_not_code_backed.json'),
    JSON.stringify({ _note: 'Written by su-build-calc build-data (tools/taxo-v2.mjs). v2 tags removed from the app because they are not code-backed (user 2026-10-19). v = original provenance; old = the v1 tag it came from; why = the reason when it was an unverified candidate. Confirm from code (then the code layer emits it) or leave it out.', stats: { tags: st.removed, objects: Object.keys(removed).length, by: st.removedBy }, objects: removed }, null, 1));
  if (fs.existsSync(dumpDir)) fs.writeFileSync(path.join(dumpDir, 'app_involves_review.json'),
    JSON.stringify({ _note: 'Written by su-build-calc build-data. Theme-only objects: each theme listed came only from a code-grounded v1 Action/Mechanic tag; no v2 tag re-derives it (permanent Adjacency / Artifact / Relic / Personality left out). Involves::<theme> is now the umbrella view on every object, so this is not a tag list. HANDOFF_taxonomy_v2 F5: per object, name the narrower v2 tag(s) from the code (the code layer then emits them), or say the theme is wrong. v2 = the other v2 tags on the object.', count: Object.values(involves).reduce((n, x) => n + x.involves.length, 0), objects: involves }, null, 1));
  console.log(`  taxonomy v2 theme-only (needs a narrower tag): ${Object.values(involves).reduce((n, x) => n + x.involves.length, 0)} on ${Object.keys(involves).length} objects (permanent kinds excluded)`);
  if (fs.existsSync(dumpDir)) fs.writeFileSync(path.join(dumpDir, 'app_relic_tags_no_rank.json'),
    JSON.stringify({ _note: 'Written by su-build-calc build-data. Relic v2 tags with no rank: the tag site is in no relic_signatures.json rank clause (or the tag is a whole-relic v1 code tag). The app shows them for the whole relic. HANDOFF_taxonomy_v2 F5: give each a rank where the code gates it.', tags: relicNoRank }, null, 1));
  const A = X.attributes, categories = V.vocabulary(counts);
  const G = V.groups(readJSON(path.join(ROOT, 'data', 'reference', 'taxonomy_groups.json')), categories);
  // (console, not warn(): this runs after the warning summary is printed)
  if (G.orphans.length) console.log(`  ⚠ taxonomy v2: ${G.orphans.length} values in no mechanic group: ${G.orphans.join(', ')}`);
  console.log(`  taxonomy v2 groups: ${G.groups.map(g => `${g.name} ${g.keys.length}`).join(' · ')}`);
  return { categories, groups: G.groups,
    attributes: { scope: A.scope.values, source: A.source.values, role: A.role.values, phase: A.phase.values, delivery: A.delivery.values } };
})();

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
  classFrame,
  slotChance,                // Spell Gem Slot / nether-spell activation-chance model (code-grounded)
  classIcons,
  raceIcons,
  creatures,
  specs,
  specIdMigration: SPEC_ID_MIGRATION,   // old (mislabeled) spec id -> code spec id; app.js migrates saved builds once
  falseGods,
  // the game's own menu glyphs for empty home tiles (menu_character / codex_anointments; G = greyed variant)
  startOfBattle,            // start-of-battle effect order (Glossary), code-grounded
  effectOrder,              // every other fixed-order combat function (Appendix), code-grounded (effect_order_all.json)
  netherHelpers,            // Nether Realm helper tables (Faucet / Mimic Mike), code-grounded
  uiIcons: { specEmpty: 'assets/ui/menu_characterG_0.png', anointEmpty: 'assets/ui/codex_anointmentsG_0.png' },
  bossSprites,              // normalized Deity owner name → bspr_ battle sprite (Appendix boss rows)
  effects,                  // effect rules for effects.js (EFFECT_ENGINE.md)
  traits,
  tagLabels,
  taxonomy: { categories: taxonomy.categories
      .filter(c => c.category !== 'Effect Limitation')
      .map(c => ({ ...c, values: c.values.filter(v => !KILLED_VALUES.has(c.category + '::' + v)) })),
    status: taxonomy.status },
  taxonomy2,                // v2 vocabulary + attribute values + mechanic groups (taxo2 on each object); the only shipped taxonomy
  artifact: { ...artGroup, slotUnlocks: artSlotUnlocks },
  artTierMinLevel,          // code (inv_ArtifactIcon): min level for artifact icon tiers 1..6
  traitItems,
  projects,                 // code: Menu › Projects overlay
  spellGemRules,            // code: mutually exclusive gem property groups (app property ids)
  statMats,
  trickMats,
  relics,
  cards,
  gemIcons,
  netherGen,
  terms,
  damageModel,
  macroVocab,                // creature-AI Macro vocabulary → Macro Proposal engine
  conditions,                // Buff / Debuff / Minion glossary (name + prose)
  wardrobe,
  spells,
  spellGems,
  masterRealms,             // realm → races its Rodian Creature Master can be (code, master_realms.json)
  bosses,                   // boss encounters: units in party order with code turn scripts + passives (bosses.json, S29)
  spellGrants,              // owner (perk / trait / relic) → spells it grants (code, S28 spell_owners.json)
  relicUltimates,           // app relic id → its Ultimate spell id (scr_GetUltimateSpellByRelic)
  ultimateRoutes,           // perk / trait that hands out the equipped relic's Ultimate
  spellGemTiers,            // spell gem levels 1..15: property slots + icon tier per level (code)
  spellProps,
  personalities: PERSONALITIES,
  runes,                    // False God difficulty runes (18) + authored theme counters
  realmProps,               // Realm-Instability realm properties (56) + authored theme/class counters
  realmBonusMax,            // instability -> true max realm bonus % (deepest / below deepest), code S27n
  shops,                    // CODE-GROUNDED shop stock: [God(groups=gods), Guild(groups=guilds), Arena, Tavern] — the Shops overlay
  realms,                   // 30 realms: denizens/resources + Realm Objects (w/ rank-0 base); each carries a
                            //   `favor` matrix { rank(0..100) → [value per favorAllCols] } from Favor_MTX
  favorCols,                // { unique:[{key,col,label,unit}], generic:[...] } — the Favor_MTX column groups
  favorColMax,              // difficulty → rank-100 cross-realm max per yield column key — scales the magnitude bars
  favorDiffs,               // ['relaxed','normal','ruthless'] — realm.favor is keyed by these
  favorCommonVals,          // rank → [value per common column] (identical in every realm)
  pandShrine: _ym.pandemonium_shrine,   // Pandemonium shrine outcome table (code: obj_demonstatue, 1/13 each)
  favorCommon,              // Favor_REF: [{rank,effect,blessing}] — the shared favor-rank tier schedule
  buildThemes: BUILD_THEMES,// detectable build intents (taxonomy v2 themes) for the Threats advisor
  skinIdMigration: SKIN_ID_MIGRATION,   // old (shifted) skin id -> code skin id, for saved builds
  skins,                    // alternate creature skins, gated by code-grounded race/creature restriction
  scrollMax: 15,            // creatures consume up to 15 stat scrolls total, each +1 base stat (L_ID_SCROLL_*)
};

// ── fusion colour palettes (CODE-EXACT, _su_extract code/fusion_palette.py / SKINS_AND_FUSION.md 2026-10-01) ──
// scr_GetFusionSurface: per battle frame, the distinct non-outline colours (R,G,B all ≤15 skipped) sorted 4 ways
// (0 pixel count / 1 hue / 2 value / 3 saturation, MSVC-qsort tie order) + the mode-4 extract_palette set.
// Compact per frame: [U, o0, o1, o2, o3, P]
//   U  = distinct colours in first-seen order, "rrggbb" (+"t" = the transparent-white background entry)
//   oM = mode-M sort order as base-36 indices into U, "."-joined
//   P  = mode-4 palette RGB in buffer order, deduped by RGB keeping the first (same nearest-colour result)
{
  const fp = readJSON(path.join(MODEL, 'fusion_palettes.json'));
  const need = new Set([...Object.values(FUSE_CREATURE_FRAME), ...Object.values(FUSE_SKIN_FRAME)].map(String));
  const frames = {}; let missing = 0;
  for (const f of need) {
    const r = fp.frames[f]; if (!r) { missing++; continue; }
    const U = [...r.mode0], idx = new Map(U.map((c, i) => [c, i]));
    const ord = [0, 1, 2, 3].map(m => r[`mode${m}`].map(c => idx.get(c).toString(36)).join('.'));
    const seen = new Set(), P = [];
    for (const c of r.mode4_palette) { const rgb = c.slice(0, 6); if (!seen.has(rgb)) { seen.add(rgb); P.push(rgb); } }
    frames[f] = [U.map(c => c.replace('/t', 't')).join(','), ...ord, P.join(',')];
  }
  if (missing) warn(`fusion palettes: ${missing} frames missing from fusion_palettes.json`);
  const body = JSON.stringify({ c: FUSE_CREATURE_FRAME, s: FUSE_SKIN_FRAME, f: frames });
  fs.writeFileSync(path.join(ROOT, 'fusion.json'), body);
  SU_DATA.fusionFile = `fusion.json?v=${crypto.createHash('md5').update(body).digest('hex').slice(0, 8)}`;
  console.log(`  fusion palettes: ${Object.keys(frames).length} frames · ${(body.length / 1e6).toFixed(2)} MB (fusion.json)`);
}
// ── CODE-TIER effect rules (prov 'code') — _su_extract data/model/effect_formulas.json (decompiled gated blocks,
// S10–S13) adapted to the effects.js rule shape (EFFECT_ENGINE.md §Code tier). Same envelope as the hand-authored /
// generated tiers ({id, src, op, target, …, prov}); ops are the engine names in CODE_OPS. These are DATA ONLY until an
// evaluator claims the op (the engine's evaluated ops are unchanged). Shipped lazily in effects-code.json (like
// fusion.json) with the global damage/crit/dodge pipeline, so data.js doesn't grow.
{
  const F = readJSON(path.join(MODEL, 'effect_formulas.json'));
  const CODE_OPS = {
    condition_apply: 'cond.apply', condition_remove: 'cond.remove', modify_condition: 'cond.mod',
    stat_add: 'stat.add', stat_mult: 'stat.mult', stat_set: 'stat.set', modify_stat_change: 'stat.changeMod',
    modify_value: 'value.mod', extra_action: 'action.extra', damage: 'dmg.deal', modify_damage: 'dmg.mod',
    modify_dodge: 'dodge.mod', heal: 'heal.deal', modify_heal: 'heal.mod', summon: 'minion.summon',
    resurrect: 'life.resurrect', kill: 'life.kill', spell_gem: 'gem.mod', grant_trait: 'trait.grant',
    amplify_innate: 'trait.amplify', timeline: 'timeline.move', transform: 'type.transform',
    change_class: 'type.changeClass', other: 'other',
  };
  const traitByRt = new Map();
  for (const id in traits) for (const rt of traits[id].runtimeIds || []) traitByRt.set(rt, +id);
  const perkSrc = new Map();
  for (const s of specs) for (const p of s.perks) perkSrc.set(`${s.id}:${p.key}`, { kind: 'perk', spec: s.id, key: p.key, via: p.anointment ? 'spec+anoint' : 'spec' });
  const relicIds = new Set(relics.map(r => r.id)), cardIds = new Set(cards.map(c => c.id)), spellIds = new Set(spells.map(s => s.id));
  // amount → compact engine shape (audit trail kept as `site`; tracer internals dropped)
  const amt = (a) => {
    if (!a) return null;
    const o = { value: a.base ?? null, unit: a.unit || null, apply: (a.application || {}).class || null };
    const q = (a.operand || {}).quantity; if (q && q.length) o.per = q;
    if ((a.operand || {}).role) o.role = a.operand.role;
    if ((a.operand || {}).compare) o.compare = a.operand.compare;                 // threshold role: '>' | '<' | '>=' …
    if ((a.operand || {}).constant_side) o.constantSide = a.operand.constant_side;
    if ((a.operand || {}).subjects) o.subjects = a.operand.subjects;              // whose quantity (attacker / target / caster …)
    if (a.percent_of) o.percentOf = a.percent_of;
    if (a.capped_by) o.cappedBy = a.capped_by;
    if (a.per_count != null) o.perCount = a.per_count;
    if (a.per_rank != null) o.perRank = a.per_rank;
    if (a.tier) { o.tier = a.tier; if (a.potency != null) o.potency = a.potency; if (a.defense_penetration != null) o.defPen = a.defense_penetration; }
    if (a.stat) o.stat = a.stat;
    if (a.formula) o.formula = a.formula;
    o.conf = { unit: a.unit_confidence || null, apply: (a.application || {}).confidence || null };
    if ((a.operand || {}).operand_check && a.operand.operand_check.ok === false) o.flag = 'operand_check_failed';
    if (((a.operand || {}).operand_check || {}).merge) o.mergeBound = true;          // bound per path at a control-flow merge (S14)
    if (a.unit_description_conflict) o.flag = 'unit_description_conflict';
    if (a.code_site) o.site = a.code_site;
    return o;
  };
  const rules = [], skipped = {}, byOp = {}, bySrc = {};
  const emit = (srcKey, src, effs, extra = {}) => {
    effs.forEach((e, i) => {
      const op = e.op || {}, name = CODE_OPS[op.kind];
      if (!name) { skipped[`op:${op.kind}`] = (skipped[`op:${op.kind}`] || 0) + 1; return; }
      const { kind, amount, extra_amounts, rejected_amounts, ...args } = op;
      const r = { id: `code-${srcKey}-${extra.tag || ''}${i}`, src: { ...src, ...(extra.src || {}) }, op: name,
        when: e.trigger ? { event: e.trigger.event || null, side: e.trigger.side || null } : null,
        target: e.target && e.target.side ? { side: e.target.side } : null };
      if (Object.keys(args).length) r.args = args;
      const a = amt(amount); if (a) r.amount = a;
      if (extra_amounts && extra_amounts.length) r.extraAmounts = extra_amounts.map(amt);
      if (e.chance != null) {   // S16: chance may be a bare number or {value, source_site, binding, phi_resolved}
        const c = typeof e.chance === 'object' ? e.chance : { value: e.chance };
        r.chance = { value: c.value ?? null, unit: e.chance_unit || c.unit || null, ...(c.source_site ? { site: c.source_site } : {}) };
      }
      if (e.gate_negated) r.gateNegated = true;
      if (e.thresholds) r.thresholds = e.thresholds.map(t => typeof t === 'object' ? { value: t.value ?? null, compare: t.compare || null, ...(t.site ? { site: t.site } : {}) } : { value: t });
      r.conf = e.confidence || null;
      r.prov = 'code';
      rules.push(r); byOp[name] = (byOp[name] || 0) + 1; bySrc[src.kind] = (bySrc[src.kind] || 0) + 1;
    });
  };
  for (const [rt, rec] of Object.entries(F.traits)) {
    const id = traitByRt.get(+rt); if (id == null) { skipped['trait:not-in-app'] = (skipped['trait:not-in-app'] || 0) + 1; continue; }
    emit(`trait-${id}-rt${rt}`, { kind: 'trait', id }, rec.effects || []);   // tier variants share an app id
  }
  for (const [k, rec] of Object.entries(F.perks)) {
    const src = perkSrc.get(k); if (!src) { skipped['perk:not-in-app'] = (skipped['perk:not-in-app'] || 0) + 1; continue; }
    emit(`perk-${k.replace(':', '-')}`, src, rec.effects || []);
  }
  for (const [k, rec] of Object.entries(F.spells)) {
    if (!spellIds.has(+k)) { skipped['spell:not-in-app'] = (skipped['spell:not-in-app'] || 0) + 1; continue; }
    emit(`spell-${k}`, { kind: 'spell', id: +k }, rec.effects || []);
  }
  // relic perks unlock at rank 10·k (scr_CritHasRelicPerk(creature, relic, k)); card powers via inv_CardSetPowerUnlocked
  for (const [k, rec] of Object.entries(F.relics)) {
    if (!relicIds.has(+k)) { skipped['relic:not-in-app'] = (skipped['relic:not-in-app'] || 0) + 1; continue; }
    for (const [rank, effs] of Object.entries(rec.ranks || {})) emit(`relic-${k}`, { kind: 'relic', id: +k }, effs, { tag: `r${rank}-`, src: { minRank: +rank } });
  }
  for (const [k, rec] of Object.entries(F.cards)) {
    if (!cardIds.has(+k)) { skipped['card:not-in-app'] = (skipped['card:not-in-app'] || 0) + 1; continue; }
    for (const [pw, effs] of Object.entries(rec.powers || {})) emit(`card-${k}`, { kind: 'card', id: +k }, effs, { tag: `p${pw}-`, src: { power: +pw } });
  }
  // validation: same guarantees as the other tiers (unique id, known op, live source)
  const ids = new Set(effects.rules.map(r => r.id)), OPSET = new Set(Object.values(CODE_OPS));
  for (const r of rules) {
    if (ids.has(r.id)) throw new Error(`code effect rule id duplicated: ${r.id}`); ids.add(r.id);
    if (!OPSET.has(r.op)) throw new Error(`code effect rule ${r.id}: unknown op ${r.op}`);
  }
  // cross-tier coverage: every hand-authored / generated rule's source should also have code-tier rules
  const srcKey = (s) => s.kind === 'perk' ? `perk:${s.spec}:${s.key}` : `${s.kind}:${s.id}`;
  const codeSrc = new Set(rules.map(r => srcKey(r.src)));
  const uncovered = effects.rules.filter(r => !codeSrc.has(srcKey(r.src))).map(r => r.id);
  // spell.noDmgStat — the spell neither deals damage nor changes a stat, so Azurite (Defense Penetration, read only in
  // bc_SpellDamage / bc_SpellStat — _su_extract code/SPELL_GEMS.md S33) does nothing on it. Conservative: set only when the
  // spell HAS code rules, none is dmg.deal / stat.*, and no damage/stat taxonomy tag says otherwise (code coverage of
  // indirect damage is incomplete, e.g. Aftermath). The app shows a "no effect" chip from it.
  {
    const DS_OPS = new Set(['dmg.deal', 'stat.add', 'stat.set', 'stat.mult']);
    // v2: a damage / stat theme, or a tag that inflicts damage or writes a stat
    const DS_THEME = new Set(['Damage', 'Indirect Damage', 'Stats', 'Attack']);   // Attack: spells that make creatures attack (conservative, as v1)
    const DS_TAXO = /^(Damage::Inflict|Spell Kind::Damaging Spells|Stats::)/;
    const opsBySpell = new Map();
    for (const r of rules) if (r.src.kind === 'spell') { if (!opsBySpell.has(r.src.id)) opsBySpell.set(r.src.id, new Set()); opsBySpell.get(r.src.id).add(r.op); }
    let n = 0;
    for (const sp of spells) {
      const ops = opsBySpell.get(sp.id);
      if (ops && ![...ops].some(o => DS_OPS.has(o)) && !(sp.theme2 || []).some(t => DS_THEME.has(t)) && !(sp.taxo2 || []).some(e => DS_TAXO.test(e.t))) { sp.noDmgStat = true; n++; }
    }
    console.log(`  spells with no damage / stat change (Azurite no-op): ${n}`);
  }
  const body = JSON.stringify({ schema: 1, ops: CODE_OPS, pipeline: F.pipeline, rules });
  fs.writeFileSync(path.join(ROOT, 'effects-code.json'), body);
  effects.codeFile = `effects-code.json?v=${crypto.createHash('md5').update(body).digest('hex').slice(0, 8)}`;
  effects.codeOps = [...OPSET];
  console.log(`  code effect rules: ${rules.length} (${Object.entries(bySrc).map(([k, v]) => `${k} ${v}`).join(' · ')}) · ` +
    `${(body.length / 1e6).toFixed(2)} MB (effects-code.json) · skipped ${JSON.stringify(skipped)} · ` +
    `manual/generated sources without code rules: ${uncovered.length}${uncovered.length ? ' (' + uncovered.slice(0, 6).join(', ') + (uncovered.length > 6 ? ', …' : '') + ')' : ''}`);
}
// ── asset cache-busting: every shipped "assets/…" image URL in the data gets ?v=<content hash>. The service worker
// caches assets cache-first BY URL, so an image whose CONTENT changes under the same filename (e.g. a corrected sprite)
// would otherwise stay stale forever for returning visitors. Same hash scheme as the precache list below.
const ASSET_HASH = new Map();
const assetVer = (rel) => {
  if (!ASSET_HASH.has(rel)) {
    const full = path.join(ROOT, rel);
    ASSET_HASH.set(rel, fs.existsSync(full) ? crypto.createHash('md5').update(fs.readFileSync(full)).digest('hex').slice(0, 8) : null);
  }
  return ASSET_HASH.get(rel);
};
let assetUrlsVersioned = 0;
(function bust(o) {
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) { if (typeof o[i] === 'string') o[i] = verUrl(o[i]); else if (o[i] && typeof o[i] === 'object') bust(o[i]); } return; }
  for (const k of Object.keys(o)) { const v = o[k]; if (typeof v === 'string') o[k] = verUrl(v); else if (v && typeof v === 'object') bust(v); }
  function verUrl(u) {
    if (!/^assets\/[^?]+\.(png|jpe?g|gif|webp)$/i.test(u)) return u;
    const h = assetVer(u); if (!h) return u;               // missing files are reported by the 404 guards
    assetUrlsVersioned++; return `${u}?v=${h}`;
  }
})(SU_DATA);
console.log(`  asset cache-bust: ${assetUrlsVersioned} image URLs versioned by content hash`);
// ── BLACKLIST GUARD (user rule: blacklisted traits = confirmed legacy / NYI — nothing blacklisted ships ANYWHERE). Any trait id
// reference outside D.traits (traitId / traitIds fields, start-of-battle trait refs) must point at a shipped trait, or the build fails.
{
  const bad = [];
  const walk = (o, at) => {
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, `${at}[${i}]`)); return; }
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (/^traitIds?$/.test(k)) for (const x of [].concat(v)) if (typeof x === 'number' && excludedTraitIds.has(x) && !traits[x]) bad.push(`${at}.${k}=${x}`);
      if (k === 'ref' && v && v.k === 'trait' && !traits[v.id]) bad.push(`${at}.ref=${v.id}`);
      walk(v, `${at}.${k}`);
    }
  };
  for (const [k, v] of Object.entries(SU_DATA)) if (k !== 'traits') walk(v, k);
  if (bad.length) throw new Error(`BLACKLIST GUARD: ${bad.length} reference(s) to blacklisted / non-shipped traits: ${bad.slice(0, 10).join(' | ')}`);
  console.log('  blacklist guard: no references to blacklisted traits ✓');
}
// GAME CONDITION NAMES in display strings (2026-10-13): labels / taxonomy values / start-of-battle text were built from the
// condition registry's suffix-derived names ("Inflicts Burned", "Summons Direwolf", "Related Minion::Littletorun"). Show the
// game's names (scr_LangCondition, token_names.json). Identifier strings ("debuff:Burned", tag keys) are left alone.
{
  const tn = readJSON(path.join(MODEL, 'token_names.json')).conditions;
  const pairs = readJSON(path.join(MODEL, 'condition_registry.json')).conditions
    .filter(c => c.name && tn[c.id] && tn[c.id].text !== c.name).map(c => [c.name, tn[c.id].text]);
  const re = new RegExp('\\b(' + pairs.map(p => p[0]).join('|') + ')\\b', 'g'), to = Object.fromEntries(pairs);
  const fix = (x) => typeof x === 'string' ? x.replace(re, (m) => to[m]) : x;
  const fixTaxo = (x) => typeof x === 'string' && /^(Related (?:Buff|Debuff|Minion)|Buff|Debuff|Minion)::/.test(x) ? fix(x) : x;
  let n = 0; const cnt = (a, b) => { if (a !== b) n++; return b; };
  for (const t of Object.values(SU_DATA.traits)) {
    if (t.labels) t.labels = t.labels.map(x => cnt(x, fix(x)));
    if (t.taxo) t.taxo = t.taxo.map(x => cnt(x, fixTaxo(x)));
  }
  for (const k of ['spells', 'conditions', 'cards', 'relics']) for (const o of [].concat(SU_DATA[k] || [])) if (o && o.taxo) o.taxo = o.taxo.map(x => cnt(x, fixTaxo(x)));
  for (const sp of SU_DATA.specs || []) for (const p of sp.perks || []) if (p.taxo) p.taxo = p.taxo.map(x => cnt(x, fixTaxo(x)));
  for (const v of Object.values(SU_DATA.tagLabels || {})) for (const f of ['produces', 'consumes']) if (v[f]) v[f] = cnt(v[f], fix(v[f]));
  const cats = (SU_DATA.taxonomy || {}).categories;
  for (const c of Object.values(cats || {})) if (c && Array.isArray(c.values) && /^(Related (?:Buff|Debuff|Minion))/.test(c.category || c.name || c.key || ''))
    c.values = c.values.map(x => cnt(x, typeof x === 'string' ? fix(x) : x));
  // start-of-battle rows for a trait show that trait's (token-rendered) text
  for (const r of SU_DATA.startOfBattle || []) if (r.ref && r.ref.k === 'trait' && SU_DATA.traits[r.ref.id] && r.effect) {
    const d = SU_DATA.traits[r.ref.id].desc; if (d && d !== r.effect) { r.effect = d; n++; } }
  console.log(`  game condition names: ${n} display strings updated`);
}
// TOKEN GUARD (2026-10-13): every {TOKEN} in shipped text must have a code-grounded word (terms ⊇ token_names.json), so the
// app never invents a display name from the token's key. Runtime values the game fills in itself are allowed.
{
  const RUNTIME = /^(PLAYERNAME|CASTLENAME|CURRENTSPEC|\d+|C(?:OND)?DESC_[A-Za-z0-9_]+)$/;
  const miss = new Map();
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { for (const [k, v] of Object.entries(o)) if (k !== 'code') walk(v); }   // `code` = machine templates (macro "1,{n}"), not display text
    else if (typeof o === 'string') for (const m of o.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)) if (!terms[m[1]] && !RUNTIME.test(m[1])) miss.set(m[1], (miss.get(m[1]) || 0) + 1); };
  for (const [k, v] of Object.entries(SU_DATA)) if (k !== 'terms') walk(v);
  if (tokenMiss.size) err(`trait text: ${tokenMiss.size} token(s) not in token_names.json: ${[...tokenMiss.keys()].join(', ')}`);
  if (miss.size) err(`token guard: ${miss.size} token(s) with no code-grounded word: ${[...miss.keys()].slice(0, 12).join(', ')}`);
  else console.log(`  token guard: every {TOKEN} has its game word (${Object.keys(TOKEN_NAMES).length} code tokens) ✓`);
}
// second gate: the blocks after the report above (spell owners, Rodian Masters, bosses …) record errors too
if (errors.length) {
  console.log(`✗ ${errors.length} errors:`);
  for (const e of errors.slice(0, 40)) console.log('    ' + e);
  console.error(`BUILD FAILED: ${errors.length} errors after the main report — data.js left untouched`);
  process.exit(1);
}
// v1 cutover (2026-10-22; extract HANDOFF_taxonomy_v2 F3 / F4 / F5 closed): the app reads only taxo2 / taxonomy2. The v1 tags stay
// a build-time input (old themes, the removed-tags list the extract reads) but no longer ship.
// The extract's builders read the v1 tags (build_taxo_v2.py load_app, build_relic_rank_taxonomy.py, build_code_taxo.py,
// classify_residual.py): they get them from code/data_dump/taxo_v2/app_v1_tags.json (HANDOFF_taxonomy_v2 § "v1 cutover").
{ const dumpDir = path.join(SRC, 'code', 'data_dump', 'taxo_v2');
  if (fs.existsSync(dumpDir)) {
    const o = [], add = (kind, x, extra) => { if (Array.isArray(x.taxo)) o.push({ kind, id: x.key ?? x.id, name: x.name || x.key || x.id, taxo: x.taxo, src: x.taxoSrc || [], ...extra }); };
    for (const t of Object.values(SU_DATA.traits)) add('trait', t, { rids: t.runtimeIds || [], desc: t.desc });
    for (const sp of SU_DATA.specs) for (const p of sp.perks) add('perk', p, { spec: sp.id, desc: p.desc });
    for (const k of ['spells', 'relics', 'cards', 'conditions']) for (const x of Object.values(SU_DATA[k] || {}))
      add(k.replace(/s$/, ''), x, { desc: x.desc || (x.effects || []).join(' | ') || null, family: x.family, ...(k === 'spells' ? { appId: x.id } : {}) });
    for (const x of SU_DATA.traitItems || []) add('traitItem', x, {});
    fs.writeFileSync(path.join(dumpDir, 'app_v1_tags.json'), JSON.stringify({ _note: 'Written by su-build-calc build-data on every build. The v1 tags (taxo / taxoSrc) the app no longer ships after the v1 cutover (2026-10-22). Same shape as build_taxo_v2.py load_app() output: {kind, id, name, taxo, src, ...}; perks also carry spec, spells appId (id = key), relics their app id. taxonomy / tagLabels = the v1 lists data.js used to carry. Read via _su_extract/code/app_data.py.', objects: o, taxonomy: SU_DATA.taxonomy, tagLabels: SU_DATA.tagLabels }));
  } }
{ let n = 0;
  const strip = (o) => { if (o && (o.taxo || o.taxoSrc)) { delete o.taxo; delete o.taxoSrc; n++; } };
  Object.values(SU_DATA.traits).forEach(strip); SU_DATA.specs.forEach(sp => sp.perks.forEach(strip));
  for (const k of ['spells', 'relics', 'cards', 'conditions', 'traitItems']) Object.values(SU_DATA[k] || {}).forEach(strip);
  delete SU_DATA.taxonomy; delete SU_DATA.tagLabels;
  console.log(`  v1 taxonomy: not shipped (stripped from ${n} objects)`); }
fs.writeFileSync(path.join(ROOT, 'data.js'), `// GENERATED by build-data.mjs — do not edit by hand.\nwindow.SU_DATA = ${JSON.stringify(SU_DATA)};\n`);
console.log(`✓ wrote data.js (${(fs.statSync(path.join(ROOT, 'data.js')).size / 1e6).toFixed(2)} MB)`);

// ── cache-bust: stamp index.html's data.js/app.js/styles.css ?v= refs + rotate sw.js's BUILD token so
// a deploy never serves a stale cached sub-resource. Shared with the git pre-commit hook (single source
// of truth in tools/stamp-cache.mjs) so a commit that edits app.js/styles.css/data.js can't ship unstamped.
{
  stampCache(ROOT);
  console.log('  cache-bust: stamped index.html (?v=<hash>) + rotated sw.js BUILD token');

  // ── precache manifest: enumerate every shipped asset so the service worker can
  // background-download the full sprite set on install → complete offline (airplane
  // mode) instead of only art the user happened to view online. Versioned by a hash
  // of the sorted URL list — URLs carry ?v=<content hash>, so the SW re-precaches when any asset's CONTENT changes too.
  const ASSETS_DIR = path.join(ROOT, 'assets');
  if (fs.existsSync(ASSETS_DIR)) {
    const urls = [];
    (function walk(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else { const rel = path.relative(ROOT, full).split(path.sep).join('/'); urls.push(`${rel}?v=${assetVer(rel)}`); }
      }
    })(ASSETS_DIR);
    // fusion palettes are lazy-loaded by the app, so without this they were only cached if a fused creature happened to
    // render online since the last deploy → offline, every fusion fell back to the plain primary colours
    if (SU_DATA.fusionFile) urls.push(SU_DATA.fusionFile);
    urls.sort();
    const v = crypto.createHash('md5').update(urls.join('\n')).digest('hex').slice(0, 8);
    fs.writeFileSync(path.join(ROOT, 'precache-list.json'), JSON.stringify({ v, urls }));
    console.log(`  precache-list.json: ${urls.length} assets (v=${v}) for offline precache`);
  }
}
console.log(`  creatures ${creatures.length} · specs ${specs.length} · traits ${Object.keys(traits).length} · trait-items ${traitItems.length} · relics ${relics.length} · cards ${cards.length}`);
console.log(`  innate-trait coverage: ${creatures.length - traitUnresolved.length}/${creatures.length} resolved` +
  (traitUnresolved.length ? ` · ${traitUnresolved.length} UNRESOLVED (no synergy tags): ${traitUnresolved.join('; ')}` : ' ✓ every creature has a resolved trait'));
if (warnings.length) console.log(`  (${warnings.length} warnings — recorded, non-fatal; see Progress.md "Known data limitations")`);
