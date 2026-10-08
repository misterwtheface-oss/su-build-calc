# Decisions and user rulings — Siralim Ultimate build calculator

Standing decisions the user made about how the app models the game. Don't "fix" these without asking. Moved verbatim from
the assistant's working notes on 2026-10-08 (they existed nowhere in the repo). Add new rulings here when they're made.
Taxonomy category definitions themselves live in `TAXONOMY.md`.

## Data joins
- **Lesson (user-flagged twice): when a name-join undercounts,
the spine/join source is wrong, not the data — the sprites/classes DO exist under a better key.**

## Artifacts, nether stones, spell-gem dusts (user ground truth)
**ARTIFACT SLOT TEMPLATE (user ground truth, 2026-09-17 — datamine couldn't extract, was runtime/level-scaled):**
every artifact at max level = 1 Primary (the stat tied to the type) + **3 Stat + 2 Trick + 1 Trait + 1 Spell +
1 Nether**. Nether stone has its own internal property rules but the artifact holds exactly 1. App artifact model =
`{primary, stat[], trick[], traits[], spells[], netherIds[]}` (caps 3/2/1/1/1); old `{props[],traitItemIds[]}`
migrated in place. Wizard = fixed slots in slot-type order, each box opens a type-filtered picker (counts enforced
by construction). **Nether stones = library + 2-step wizard** (gem+name → properties), properties drawn from the FULL artifact
stat+trick pool unrestricted, each `{prop,value}` (user-entered %); `artifactPctOf` resolves via propGroups
(core-stat props hit the 5-stat table, trick props display-only). Old `{type,stats[]}` nether props auto-migrate
to flat `{prop,value}`. **SPELL GEMS are a first-class buildable entity** (2026-09-17): artifacts / nether stones / spell gems are 3
SEPARATE things. A spell gem = 1 spell + up to 3 **enchant items = the "Dust" items** (`L_IN_DUST_<gem>` in items.csv: Jasper/Topaz/
Citrine/Agate/…21; effect from `L_ID_DUST_<gem>` e.g. "More Charges", "Defense Penetration", "Cascading") — used
at the Enchanter. `SU_DATA.spellProps` = these 21 dusts (name+effect). **ITEM→SLOT TAXONOMY (user, corrected):**
Ambers(item_class null)=artifact STAT slots · Slates/Curios/Cripplers(item_class 1)=TRICK slots · trait items
(item_class 2)=TRAIT slot · **Dust/gemstones=spell-gem enchants** (NOT Slates/Curios — that was wrong). **Dust per-gem
GENERIC + class-coloured, not per-spell** (per user): `gem_<colour>_lvl4` sprites mapped to class by PIXEL COLOUR —
Nature=gem_nature, Chaos=gem_chaos, Sorcery=gem_sorceryB(blue), Death=gem_sorceryP(purple), Life=gem_lifeG(gold);
- Nether spells carry ONLY a trigger (no visible chance); migration strips the old `chance` (user).

## Creatures and UI
**v2.20c — personality = FLAT ±33% on base (FINAL, per user):** dropped the entire level lens
(slider/number field/`previewLevel`/`renderLevelBar`/handlers/CSS all removed). Personality now just applies
a flat modifier to base: raised **×4/3 (+33%)**, lowered **×2/3 (−33%)**, others unchanged (= end-game
- **Reset stays a visible header button** (user: keep it out of the menu).
- **No trait icon exists (would 404) — never render one.**
- **Synergy counts relics + nether spell-props, NOT cards** (per user). Nether stones derive taxo from socketed contents.
  The perk-tree picker backlog item was DROPPED (doesn't exist in the game).
- `classifyRealmOutcome` / `realmOutcomeCats` / `realmCatMax` / per-realm `outcomes` are all GONE — don't reintroduce.

## Reconciliation and provenance
- **STRUCTURE FACTS (validated, don't re-derive):** Deities==Avatars (31 gods = 31 roster Avatars, player Avatar
  trait + encounter Deity trait, 62 total); every Nether Boss = **3 same-name escalating tiers** (extras are dup
  empty-prose/stale copies, wiki-tier-1-verified → dropped); False-God part dupes VALID (Nebodar 2 wings/2 claws);
  Lord Zantai=Zantai encounter form; Caliban triple-form (Avatar+Deity+FalseGod).
- **creature_reconciliation.json** (1419) · **item_reconciliation.json** (1862 cat, 1719 linked, 81 unlinked=
  data-limit, left per user) · **spells** 747 all live, Source/Potency/Target from `Spell_REF.csv`, charges
  code(712)+community(35). Generators in `_su_extract/code/build_{creature,item,unresolved}_*.mjs`.
- **PROVENANCE RULES (user-enforced):** wiki maps but doesn't assert PRESENCE; no invented categories; no
  name-match identity (trait≠same-named perk; creature-with-stats≠spell); `material_stats.trait_id` DRIFTS (never
  trust); in-game observation beats stale CSVs (`Trait_REF` was stale for Marionette).

## Taxonomy rulings
  Single/Multi-Target from `Spell_REF.target` (Target=single; Enemies/All Creatures/Your Creatures=multi; 663
  spells, src=`field`). **Combined:** Indirect Damage = LLM status/DoT + proc "deals damage to X equal to Y%"
  (ADD-only, +68). **Dropped by user:** Effect Limitation (whole category, −808), Active If::Spell/Gem is X Type
  (value, −16). **ADDED to close false-negatives:** all-stats bundle → Related Stat Attack/Int/Def/Speed(+MaxHealth
  unless omit) (+333); Innate Trait where desc says "innate trait" (+14).
- **Definitional divergences LEFT AS-IS (user chose):** Active If::Creature is X Type (153 — we use Related
  Types::<Race>), Action/Mechanic::Cast (121), Activates When::Ally Casts (53) — user's defs are BROADER; app's
  more-specific categorization stands.
- **RULE the user gave for tag intent:** class names (Nature/Chaos/Death/Life/Sorcery) DOUBLE as spell-class &
  gem-class → a bare-name match over-tags spell/gem effects as creature-class; always anchor on the word "creature"/
  "class"/actual creature ref. "All stats"/"base stats" WITHOUT a Health omission IMPLIES every stat (incl. Max
  Health). Active If = always-on effect gated by a persistent condition ("Active If: Buffed with Barrier"), not a
  trigger. Auto-Defend/Provoke = the Defend/Provoke ACTION (of Attack/Cast/Defend/Provoke). Re-validate after any
  taxonomy regen by re-running `tools/mtx_compare.mjs` (needs the two Downloads CSVs).

### 2026-09-29 (cont.) — PER-OBJECT AUDIT (reverse pass) + TAXONOMY.md + override layer
- **`su-build-calc/TAXONOMY.md`** documents all 23 categories AND every subcategory's intended coverage +
- **One systematic rule from the audit:** spell Damaging Spells strips "absorbs …damage" (Barrier) clauses
  before the damage check (Corpse Shield/Divine Aegis/Holy Armor were wrongly Damaging).
- **User rule:** an effect dealing "damage WITH attacks and spells" tags BOTH Attack and Cast — don't strip
  Cast there; only strip Cast when "spell" is a passive damage-source/immunity qualifier ("damage FROM an
