# Siralim Ultimate Build Calculator — Progress

## LIVE
Deployed at **https://misterwtheface-oss.github.io/su-build-calc/** (repo `misterwtheface-oss/su-build-calc`,
Pages on `master`/root, Cloudflare analytics active with the shared github.io token). Auto-deploys on push.

## v2.10 taxonomy fix + wizard polish (2026-09-17)
- **Spell-gem enchant items corrected**: they are the **"Dust" items** (`L_IN_DUST_<gem>`: Jasper, Topaz, Citrine…
  21) whose effect (More Charges, Defense Penetration, Cascading…) comes from `L_ID_DUST_<gem>` — used at the
  Enchanter. `SU_DATA.spellProps` now = these 21 dusts (name + effect). (Slates/Curios are TRICK items, Ambers are
  STAT items — noted for future artifact re-model.) NOTE: per-gem dust icons aren't in the sprite set by name and
  aren't code-tagged (dust defined in an unnamed vm_group region with no sprite immediate) → using a shared
  gem-dust icon for now; flag to revisit if the icon source surfaces.
- **Picker scroll fixed** (#1/#4): inline slot pickers used a nested `.ovl-center-scroll` that collapsed to 0 height
  (couldn't scroll; artifact `+` looked like it only highlighted) → dedicated bounded `.art-pick-scroll`.
- **Spec/anoint tiles**: shorter again (fixed 44px icon; keep creature-card width).
- **Mobile**: artifact wizard tiles shrunk so the build fits without scrolling.
- **Nether wizard → category flow** (#6): `+` → choose category (Stat / Trick / Trait / Spell) → picker, mirroring
  artifacts. Prop model now `{cat,key,value}` (stat/trick carry %, trait/spell are item refs); migrated from
  `{prop,value}`. `artifactPctOf` only sums stat/trick nether props into the stat table.

## v2.9 spell gems as first-class entities (2026-09-17)
Per user: artifacts, nether stones, and spell gems are three SEPARATE buildable entities. A **spell gem = 1 spell
+ up to 3 property items** (Slates/Curios/Cripplers = the `item_class:1` materials, 47, `SU_DATA.spellProps` w/ icons).
- **Spell Gems library + wizard** (new top-bar "Spell Gems" button; `subc.spellgems`): step 1 pick spell (class
  gem icon) → step 2 add ≤3 property items + name. Library tiles show the class gem + spell + prop count.
- **Creature spell slots**: new per-creature "Spells" action (alongside Fuse/Artifact/Relic) equips up to 3 spell
  gems (`slot.spellGemIds`, cap 3; "modifiable by trait/perk" noted, cap fixed at 3 for now). Manual/trait cast.
- **Artifact spell slot** now equips a built spell **gem** (not a raw spell); auto-triggers per artifact kind.
  `artifact.spells` migrated (old raw-spell ids cleared). Deleting a gem unequips it everywhere.
- Data: `spellProps` (47 property items) added to pipeline w/ material icons.

## v2.8 nether wizard + spell gems (2026-09-17)
- **Spell-gem class icons** (from prior): spells carry `cls` (spells_ref, fuzzy-fixed 747/747); artifact spell
  slot + picker show the class-coloured gem.
- **Spell WIZARD deferred** (user choice): the spell-gem property list needs a decompile pass (no clean loc tags);
  kept the existing spell picker in the artifact slot rather than ship a redundant wizard.
- **Nether stone builder → library + stepped wizard** (user: "wizard + full property pool"): `openNether` is now a
  library (tiles + Build new); `openNetherBuilder` is a 2-step wizard (gem+name → properties). Properties now draw
  from the **full artifact property pool (stat + trick), unrestricted** — each = `{prop, value}` (property name +
  user-entered %). Old nether props (`{type,stats[]}`) migrated to flat `{prop,value}`. `artifactPctOf` resolves
  each nether prop via `propGroups` (core-stat props add to the stat table; trick props display only, like artifact
  tricks). `netherSummary` + input handlers updated; removed the old single/double stat builder.
- **Home tiles mirror creature-card width**: `.home-top` uses the party grid (2/3/6 cols); spec + anoint tiles
  are vertical cards. **Reverted the spec-selector centering** (was fixed-width flex → shrank icons; back to the
  original `auto-fill`/`repeat(5,1fr)` grid so icons are full size). **Dropped the per-spec chips** from the
  Anointments overlay (search + grouped list only).
- **Chrome sweep**: removed feature-explanation footers, asset/match/active counts, wizard instructional hints.
- **Artifact = fixed slot template (user ground truth):** 1 Primary + **3 Stat · 2 Trick · 1 Trait · 1 Spell ·
  1 Nether** (nether has its own internal rules but the artifact holds exactly 1). Model reshaped to
  `{primary, stat[], trick[], traits[], spells[], netherIds[]}` with per-type caps; **old artifacts migrated**
  in place (`props[]`→stat/trick by group, `traitItemIds[]`→traits[0..1], nether capped to 1). `artifactPctOf`
  sums `stat`+`trick`. **Spell data added** (`SU_DATA.spells`, 747 from catalog; `cls` joined from `spells_ref.json`, 745/747).
  **Spell-gem icons are generic + class-coloured** (not per-spell): `gem_<colour>_lvl4` mapped to class by pixel
  colour — Nature=nature, Chaos=chaos, Sorcery=sorceryB(blue), Death=sorceryP(purple), Life=lifeG(gold) →
  `assets/spellgems/<class>.png`, `SU_DATA.spellGems`. Spell slot + picker show the class gem.
  Wizard step 2 now shows the **fixed slots in order by type**
  (Primary → Stat → Trick → Trait → Spell → Nether); each empty box opens a type-filtered picker, enforcing the
  counts by construction.
1. **Header** stacks: title over the action buttons (topbar `flex-direction:column`).
2. **Artifacts button** in the header → global artifact library in *manage* mode (`openArtifactLibrary(null)`;
   no equip, just edit/delete/build).
3. **Spec grid centered**: `.spec-grid` is now centered flex-wrap so the last partial row centers.
4. **Anointments** — button next to the Specialization tile → browsable overlay (search + per-spec chips, grouped
   list w/ perk icons, rank-scaled descriptions, Ascension badges). Data comes from the user's
   `_su_extract/data/reference/_raw_csv/Perk_REF.csv` (`Annointment`/`Ascension` columns): `build-data.mjs` joins
   it to perks by name+spec (99%, `perkFlags()`, Grovetender→Herbalist alias) and sets `perk.anointment` /
   `perk.ascension`. 570 anointments, 11 ascension; 6 perks not in CSV → default false. (Avoids the
   `scr_AnointmentsListBySpec` decompile — the user vouched for CSV accuracy.)
5. **Highest-tier artifact icons**: `ART_ICON_SRC` → helmet_6/sword_6/staff_5/shield_6/boots_5.
6. **Artifact modal → 3-step wizard**: (1) pick artifact type (hi-tier icon tiles + rank), (2) fill slots one
   at a time (add-menu → inline picker for property/trait/nether, each slot shown as an icon tile w/ remove),
   (3) name + live-bonus preview + save. Reuses the existing toggle handlers; editing jumps to step 2.
7. **Trait-item icons**: new `_su_extract/code/extract_material_icons.py` merges `scr_DatabaseMaterials`/`2`/`3`
   (tagged sprite immediates, same trick as perk icons) → `data/model/material_icons.json` (1841 mapped, 99%
   of trait-materials). Pipeline copies to `assets/maticons/<sprite>.png`, sets `traitItem.icon` (1817/1830).

## v2.5 spec selector: emblems + animated costume (2026-09-17)
- **Selector grid now uses the 16×16 `spec_<key>` emblem for every spec** (`spec.emblem`; aliases
  Rune Knight→`spec_deathknight`, Sorcerer→`spec_sorceror`; Defiler has no 16×16 emblem → falls back to its
  themed sprite). 38/39 real emblems.
- **Info panel shows the WARDROBE costume instead of the icon**, and **animates it**: front-facing 2-frame
  walk (costume frames 0,1 — verified 0↔1 is the closest-matching pair = same/down direction), alternates 8×
  then advances to the next tier and cycles. `syncSpecAnim()` (280ms) clears/restarts on every spec-picker
  render (open/select/search) and on close. Pipeline copies frames 0,1 per tier → `spec.costumes[i].frames`.
- NOTE: "front-facing" frame indices (0,1) are a best-guess from pixel-diff; confirm visually.

## v2.4b wardrobe names + tiers + Grovetender (2026-09-17)
- **Grovetender resolved:** it ships internally as **"Herbalist"** (`vocabulary.csv` `L_HERBALIST` == "Grovetender"),
  so `npc_herbalist_1/2/3` ARE Grovetender's 3-tier costumes. All 39 specs now link (was 38).
- **All 3 tiers per class grouped:** `spec.costumes = [{tier,sprite,img,variant}]` (tier 1/2/3 + `_alt`/`_minotaur`
  variants). Every class has a 3-tier set (incl. Pariah & Deprived).
- **Names from localization (backend, in `wardrobe.json`):** each costume carries `name` + `name_source`:
  **145 class_vocab** (spec/class display name, authoritative) + **307 L_WD** (`L_WD_*` in `items.csv`, e.g.
  Cosmic Cat, Void Queen) + **368 derived** (title-cased stem — mostly `ospr_` denizen costumes whose `L_WD` key
  is semantic, not sprite-derived; would need deeper code pairing to reach 100%). Resolution now lives in
  `extract_wardrobe.py` so `wardrobe.json` is self-contained; `build-data.mjs` just copies PNGs + groups tiers.

## v2.4 wardrobe backend (2026-09-17) — data only, no UI yet
- **Clarified: the current spec "skins" are ICONS.** They come from `spec_<class>_<spec>_<theme>` 32×32
  single-frame sprites (the decorated spec-select emblems, e.g. `spec_death_necromancer_necronomicon`),
  not player costumes. Kept as-is for now (still labeled spriteKind `skin`/`icon` in `findSpecSprite`).
- **Extracted the real player WARDROBE (every costume), code-certain.** `scr_WardrobeSprite` returns each
  costume's overworld sprite as a tagged immediate (`spriteAssetIndex + 0x1000000`). New durable extract
  `_su_extract/data/model/wardrobe.json` (**820 costumes**, all 32×32 animated 8-frame, 0 missing PNG) via
  `_su_extract/code/extract_wardrobe.py` (capstone; `PYTHONSAFEPATH=1`). Categories: 43 specialization/class,
  597 npc, 142 master (`master_<family>`), 26 creature, 12 animal.
- **Pipeline pulls ALL 820 costume PNGs → `assets/wardrobe/<sprite>.png`** and emits `SU_DATA.wardrobe`
  (sprite/key/label/category/frames/order/img). Each spec is joined to its own costume via
  `spec.costume` (`npc_<slug>` variants / `TS_SU_Costume_<spec>` / `*_overworld`): **38/39** linked —
  Grovetender genuinely has no wardrobe costume in the game data. **No UI yet (per request — backend first).**

## v2.3 perk icons (2026-09-17)
- **Every perk now shows its real in-game icon (600/600, code-certain).** Name-based sprite joins topped
  out at ~88% (three naming schemes: base-15 `<class>_<spec>_<perk>`, modern `<spec>_<perk>`, and
  `perks_`/`perk_`) and could never resolve codename specs (e.g. Monk's Japanese `nature_monk_kaze`).
  Solved at the source: each perk's icon is stored in `scr_DatabasePerks` as a **tagged immediate**
  (`spriteAssetIndex + 0x1000000`); the non-zero tagged value per block is the icon (the other, 0, is a
  constant `__ppf_spr_ui_checkbox`). New durable extract: `_su_extract/data/model/perk_icons.json`
  (661 perks, 0 ambiguous) via `_su_extract/code/extract_perk_icons.py` (capstone; run with
  `PYTHONSAFEPATH=1` — a local `signal.py` shadows stdlib). Validated: the extracted index matched the
  name-join sprite for all 487 name-matchable perks.
- Pipeline copies 600 perk PNGs to `assets/perks/<KEY>.png` (`build-data.mjs`, `perkIconByKey`); `data.js`
  carries `perk.icon`. UI shows the icon in the perk picker rows (32px) and the spec info perk list (20px).

## v2.2 perk ranks (2026-09-17)
- **Perks now have levels.** Data already carried `ranks` (max levels) per perk; the UI ignored it. The perk
  picker's binary on/off toggle is replaced by a **rank stepper** (`− rank/max +` plus **Max** / **0**),
  so each perk allocates 0..maxRanks. `build.perkAlloc[specId][key]` changed from a binary de-allocation map
  to an **allocated rank count** (absent key = fully allocated = maxRanks). **Schema 2→3 migrated in place**
  (old deallocated keys → rank 0) so the current party/spec survives.
- **`<N>` scaling values render.** Perk descriptions carry `<N>` = the **per-rank increment** (e.g. Anguish
  Through Awareness `<1>`, 5 ranks → "starts battles with **5** random buffs" at max; **0** if unallocated).
  `richText(str, rank)` now substitutes `<N>` → `N × rank` (handles decimals: Perseverance `<2.5>`×20 = 50%,
  Anemia `<5>`×20 = 100%). 220 perks carry `<N>`; combined `<N>` + `{TOKEN}` render cleanly with no leaks.
- Spec info panel + home spec tile now show **allocated/total perks · points** (points = Σ cost×rank).
- Bonus: `richText` converts literal `\n`/newlines → `<br>` so multi-paragraph perk text reads correctly.

## v2.1 validation (2026-09-16) — closed the loop
Re-verified both v2.1 fixes after an interrupted session (commit `7bd676c`, already pushed/live):
- **Spec skins**: `data.js` = 30 `skin` + 9 `icon`, 0 specs missing a sprite. PNG dims confirm the copy
  (animator/sorcerer/bloodmage = 32×32 real skins; the 9 fallbacks = 16×16 emblems). Icon-fallback set:
  Toxicologist, Shadowbringer, Mime, Graveborn, Demonologist, Engineer, Gladiator, Brewmaster, Mesmerist.
- **Plain-language tokens**: scanned all **3556** game-text fields (traits/specs/perks/cards/relics) through
  `richText()` → **0 raw `{TOKEN}` leaks**. 155 distinct token types: 67 resolved via the shipped 82-term
  `terms` map, 88 via the prefix-strip/title-case fallback. `app.js` + `data.js` syntax/load clean.

## v2.1 fixes (2026-09-16)
- **Parameter text → plain language + bold.** Perk/relic/card/trait text still carried raw `{ACTION_*}`,
  `{STAT_*}`, `{CONDNAME_*}`, `{RACE_*}` tokens (and `[icon]` refs). Ship `SU_DATA.terms` from the extract's
  `labels.json` (82 terms) and add `richText()` in app.js: `{TOKEN}` → plain word wrapped in `<b class="param">`
  (bright/accent), `[icon]` dropped, rest escaped. Applied to all game-text fields. No raw tokens leak.
- **Real specialization skins.** The `spec_<key>` sprites were 16×16 *emblem icons*, not skins. The actual skins
  are the 32×32 player-costume sprites (`spec_<class>_<spec>_<theme>` + animated `TS_SU_Costume_<Spec>`). Pipeline
  now prefers those: **30/39 specs get the real 32×32 skin**, 9 (Mime, Toxicologist, Gladiator, …) fall back to the
  emblem icon (no skin ships for them). `spec.spriteKind` = `skin`|`icon`.

## v2 rework (2026-09-16) — big feature batch
- **Spec**: home spec tile shrunk to a small chip; selector labels dropped; alpha-sorted, ≥5/row on mobile;
  info panel enlarged with the skin sprite above the name, playstyle, and a perk list; **Customize** button
  opens a perk selector (all perks allocated by default, click to deallocate; allocate/deallocate-all).
  `build.perkAlloc[specId]` stores only deallocated keys.
- **Creature filters**: class chips replaced by faceted **Class / Race / +Tag** buttons opening sub-selectors;
  each +Tag added leaves a fresh +Tag so multiple synergy-edge tags AND-narrow the list (tags = the innate
  trait's produces/consumes edge tokens, 112 options).
- **Cards**: large tiles with representative art (family→creature-race sprite on a class-tinted bg), all 3
  effect tiers shown, and a 0–3 **level stepper** (default max). `subc.cards.levels`.
- **Nether stones**: rarity removed; centered overlay; **structured property builder** (Add → Stat effect →
  Single/Double → stat(s) + numeric %) that **drives stat calc when socketed**; 9 gem icons (pick or 🎲 random).
- **Artifacts**: now a saved, nameable, reusable **library** (`subc.artifacts`) equipped per creature by id;
  builder shows the artifact-type icon (Helmet/Sword/Staff/Shield/Boots → Health/Attack/Int/Def/Speed).
- Pipeline ships new assets: 5 artifact-type icons, 9 gem icons, 5 class-bg, card art via family→race join
  (138/141). Build schema bumped to 2. Verified all 24 flows in headless Chrome (0 JS errors).

## Current state (2026-09-16)
Scaffold complete and runnable. P0 was expanded (per user) to include the artifact + relic builders,
Nether Stone library, and realm-card collection alongside the creature/spec/fusion core. The build-first
home shows 6 creature slots + a specialization slot; every selection happens in a statically-sized
overlay; the party persists in `localStorage`. `build-data.mjs` generates a 1.25 MB `data.js` from
`_su_extract` and copies 1437 creature + 39 spec sprites, with a clean-except-2-known-warnings hygiene report.

What works end-to-end:
- Add a creature (search + class filter) → slot fills, class stripe + stats.
- Fuse (secondary picker) → averaged base stats, secondary's class, both traits (codex-accurate).
- Creature detail overlay → stat table Base·Artifact·Total with the pos/neg/highlight colour language.
- Artifact builder → primary + properties + trait-item slots + nether sockets + rank slider; %s fold into the stat table.
- Relic builder → pick relic + rank, per-rank effects listed on the creature.
- Nether Stones → add/edit/delete user stones (name/rarity/property lines), stored in `subc.nether`, socketable.
- Realm Cards → owned + on/off toggles per family, stored in `subc.cards`.

## Backlog
### Next up (P1)
- [ ] Trait cross-reference matrix (party creatures × produces/consumes tags). CSS is already in `styles.css`
      (`.xref-*`); need the data wiring + glyph cells (● on / ◆ active / ○ latent) + Shared row.
- [ ] Real trait detail page (replace the `nav-trait` `alert()` stub) with tags + "shared by N party members".
- [ ] DPS / effective-stat simulation from `damageModel` (spell & melee, crit/dodge, defending). Expose
      class-advantage multiplier as a toggle (unconfirmed in extract).
- [ ] Feed cards / relics / nether / trait-items into the synergy edge graph (they carry produces/consumes tags in `theorycraft_tags.json`).
- [ ] Perk-tree picker per specialization (perks[] already in data; needs perk icons + tree layout).

### Later (P2)
- [ ] Spell-gem loadouts (potency tiers already in `damageModel`).
- [ ] Fusion palette / colour-combination picker (cosmetic).
- [ ] Save / load / share builds; multiple saved parties.
- [ ] Turn on the Cloudflare analytics beacon at public release (shared github.io token).

## Known issues / warnings (from build-data hygiene report — non-fatal)
- **Roster spine = `creatures_ref` (1362 playable creatures, 100% classed).** `creature_data` was the
  wrong spine — its export is incomplete/messy (placeholder `Arbiters_1..6`, `ospr_skin_*` records), so it
  only *enriches* the ref roster. Class dist: Sorcery 316 / Nature 301 / Chaos 261 / Death 258 / Life 226
  = 1362. ✅ class requirement met.
- **Sprites: 1355/1362 (99.5%).** Battle sprites are recovered by joining the ref roster to
  `creature_stats.json` by name (`field0` = the `spr_crits_battle` frame) and copying
  `assets/sprites/spr_crits_battle_<frame>.png` — this reaches the ~330 creatures `creature_data`'s export
  missed (Amphisbaena, Amaranths, Arbiters, etc.). Frame is taken from the capstone `creature_data`
  battle_frame where available (authoritative), else the legacy `field0` (which matches the authoritative
  frame 98% of the time on their overlap). Only **7** creatures genuinely lack a battle sprite (frame
  `null` or the `6969` "no battle sprite" sentinel = gods/specials) → class-tinted monogram fallback.
- **Stats:** 1358/1362 use code stats (`statSource` `code` = capstone / `code-legacy` = older `creature_stats`);
  4 fall back to `creatures_ref` community base stats (`community`).
- **7/1362 creatures don't resolve an innate `traitId`** (trait-name not found in `traits_consolidated`)
  → their trait shows by name but carries no synergy tags. `traitName` is present for all 1362.
- **15 trait-items grant `trait_id 2187`** (off-by-one past the 0–2186 trait range) → trait unresolved;
  the item's own `trait_name` is still displayed. Both are recorded, not blocking.
- Relic contributions are qualitative (no numeric stat) → shown as effect text, deliberately not a stat column.
- Class-advantage multiplier + Nether Stone numerics are runtime/in-game-only (see WIKI_CONTEXT) → modelled around.

## Session log
- 2026-09-16: Scaffolded the project via build-calc-planner. Wrote `build-data.mjs` (joins creature_data +
  creatures_ref + sprite index + theorycraft tags + artifacts/relics/cards/materials; hygiene guardrails),
  the vanilla SPA (`index.html`/`styles.css`/`app.js`) with the full overlay/trait/stat house style, and the
  planning docs. P0 expanded to include artifact/relic builders + nether library + card collection. Palette:
  SU indigo + gold with 5 class accents. Verified P0 flow on `tools/serve.mjs`, then `git init` + initial commit.
