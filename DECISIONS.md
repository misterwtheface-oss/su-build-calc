# Decisions and user rulings — Siralim Ultimate build calculator

Standing decisions the user made about how the app models the game. Don't "fix" these without asking. Moved verbatim from
the assistant's working notes on 2026-10-08 (they existed nowhere in the repo). Add new rulings here when they're made.
Taxonomy category definitions themselves live in `TAXONOMY.md`.

## Bosses (2026-10-11)
- **False God names = the game's own text** (`L_WBOSS_*`): Imp Impington Reborn, Caliban the Unredeemed, Jotun, Lost Construct.
- **Misery is not a False God.** Its three traits are provisionally Perdition's (Gate of the Gods); the user will confirm in-game.
- **One boss feature for all three boss types** (False Gods, Nether Bosses, Gate of the Gods) on one data source
  (`_su_extract/data/model/bosses.json`). Boss stats stay at level-1 base; the app does not scale stats above level 1.
- Upcoming 3.0 content (the "False Godspawn" creatures) stays behind the NYI feature flag.
- **Boss page layout (user, 2026-10-11):** whole-creature formation (parts edge to edge, still links), a **Threats** section
  (one container per major threat: title, the causing steps, a plain "why it matters"), spells as full spell containers,
  **Rewards** at the bottom (Anointment = a perk from one of the listed specs; Inscription = one unknown spell from the
  boss's list). Boss grid: 2 tiles per row, whole-creature art. Part cards: head, body, arms, shoulders (grid 2,5,4,6,1,3).
- **Runes on a boss page = per-boss advice only** (user): Recommended / Avoid with a reason drawn from that boss's kit; the
  plain rune list (identical for every False God) is not shown there.
- **Bosses list = the Realms page's toggle** (user, 2026-10-11): Nether Bosses | False Gods | Gate of the Gods, in that order;
  a type with no data yet shows a disabled tab.
- **Nether Boss page** (user, 2026-10-11): simpler than a False God page, same shape: a 1st fight | 2nd fight | 3rd+ toggle
  (the boss trait tier = times beaten), Threats, a base-stat table with magnitude bars, Creatures, Rewards (the boss's 3 trait
  materials with their traits, plus the every-win rewards). False God base stats use the same magnitude-bar table.
- **Gate of the Gods page** (user, 2026-10-11, "implement their pages as well"): Nether-Boss shape without tiers (one god
  trait): fight notes (random realm fill + loadout, your creatures at level 100, enemy level formula, instant-kill rule),
  Threats, base stats (bars), the Avatar card (god trait + its replaced own trait), a Difficulty table (level multiplier,
  Emblems, Avatar Mana, costume chance), Rewards (+ the god's costume; skins not listed until the code names them), Lore.
- **Boss pages: no chips before Threats** (user, 2026-10-12): no note chips at all above the Threats section (generic or
  boss-specific). Nether pages lead with the boss sprite, like Gate pages.
- **Boss creature cards** (user, 2026-10-12): show the boss/god trait only, no own trait, no base-creature chip; no
  data-source callouts. Duo bosses (two different boss-trait creatures) show both sprites everywhere the boss sprite shows.
- **Boss threat text must come from the extracted game context** (user, 2026-10-11): "Any recommendations and threat analysis
  need to be analyzed against actual extracted game context not made up". Nether threats are authored in
  `data/reference/nether_boss_advice.json` from the code behaviour (bosses.json `boss_traits[].behaviour` / `code_vs_text`,
  NETHER_BOSS_BEHAVIOR_FINDINGS) plus the extract's game rules (timeline, crit, Defending, sourceless damage ticks, Shelled vs
  indirect). build-data rejects a missing tier or code-like text.

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
- **Page names (user, 2026-10-11):** Appendix → **Taxonomy**, Glossary → **Status Effects**, Errata → **Appendix**. Internal
  ids keep the old names; notes dated before this use the old names.
- **Glossary vs Errata (2026-10-10):** the Glossary holds only Buffs, Debuffs and Minions. Every other reference table
  (resurrection / start-of-battle order, drop and shrine odds, realm bonus, Rodian Masters, and new ones) goes on the
  Errata page, same layout; its menu button sits right below Glossary.
- **Battle-only spells (2026-10-10; corrected 2026-10-11):** spells that can't be held as a gem (Ultimates, Runes, Mega Magic,
  Colorwave) are hidden from every spell picker. The 51 False God spells (ids 493–543) are NOT battle-only: each False God drops
  them as Inscriptions (user, confirmed in code), so they are pickable gems. The False God is their source; a specialization
  that starts with one of the recipes (Shadowbringer → Plague, Toxicologist → Devastation) is an exception, not the source. Sandbox mode is never a signal for availability
  (user ruling 2026-10-11: it does not reflect the core game; an Ultimate being craftable in Sandbox doesn't make it a normal spell). Battle-only spells show up automatically on the
  creatures they belong to, under the owner's condition, without using a spell-gem slot (e.g. Rune of Cor only on Chaos
  creatures and only while the Rune of Cor perk is allocated or anointed).
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

## Realm object treasure notation (2026-10-09)
- Realm_REF `[N]` after an object name = number of that object per realm. Treasure lives in the rank-0 effect string as
  `Treasure [n]` where n = code bundles for one interaction (no favor ranks, no other bonuses). An object whose treasure only
  comes from a favor rank gets `[n]` on that favor row (its base bundles, nothing else).
- Boss rooms: 2 chests × 6 bundles = `Treasure [12]`; Nether Boss rooms 18. The +5 boss-room blessing is a favor bonus, not
  part of rank 0.


## Realm yield model = the user's rules (2026-10-10)
- The Yield and Compare views read `_su_extract/data/model/realm_yield_model.json` (community copy
  `audit_community_csv/Realm_Yields_CODE.csv`), built rank by rank with the user from code
  (`_su_extract/code/data_dump/s27/walk/`, rules in `_su_extract/code/YIELD_GROUNDING_PLAN.md`). It replaces
  Favor_CODE.csv below.
- Per realm × difficulty (Relaxed / Normal / Ruthless toggle) × favor rank: favor, treasure bundles, net resources,
  emblems, knowledge, spell recipes, tickets, realm boosts, spawn chances (Golem / Dumpling kept for Prophecy goals),
  guaranteed nemeses. The god-altar donation is always made (in favor and net resources, no column); generic chests are
  5% Mimics (5 bundles + a fight). Common (all-realm) bonuses are one shared row per rank.
- Key rules: realm bonus 0; other gods ignored; choice objects at full weight per outcome; chance outcomes weighted, game
  floors kept; boost caps as the true average; costs paid every run; one god-altar donation per realm; Golem / Dumpling
  one-hit KO; roaming battles not counted.

## Realm yield source = code (2026-10-09) — superseded 2026-10-10 by the yield model above
- User (2026-10-09): "replace our data source for the yield calculations with fully code grounded data".
- The Yield tab reads `_su_extract/audit_community_csv/Favor_CODE.csv` (code). `data/favor/Favor_MTX.csv` (user) stays as
  the diff reference and is no longer read.
- Expected value per floor = placed count × per-interaction expectation.
- Random outcomes are weighted by their code odds.
- Player-choice objects are averaged evenly: Clock, Star, the vomiting Fruit / Squash / Tarot Cards, and the Music Crystal
  / Alchemy minigames.
- Code ≠ Realm_REF text keeps the code value. The list is in `REALM_YIELDS.md`; the Realm_REF strings are not yet patched
  (pending the user's ruling).

## Realm property rules surfaced (2026-10-09)
- User (2026-10-09): "we'll also need the realm property conflict rules decoded so we can surface those in the app and
  calculate the true maximum item bonus".
- Shipped minimal, pending the user's review of placement:
  - a glossary "Maximum Realm Bonus" table;
  - the Nether Stone table capped at that maximum;
  - a "Visible only" chip in Threats.
- The 7 ↔ 16 exclusion stays data-only: both are hidden from the Threats advisor as composition flavour.
