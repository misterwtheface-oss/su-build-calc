# Siralim Ultimate Build Calculator — Progress

## LIVE
Deployed at **https://misterwtheface-oss.github.io/su-build-calc/** (repo `misterwtheface-oss/su-build-calc`,
Pages on `master`/root, Cloudflare analytics active with the shared github.io token). Auto-deploys on push.
No verify-before-push ceremony (no real users yet) — but every change is checked with the jsdom smoke suite
(scratchpad `smoke.mjs`, ~84 assertions across all flows) before commit.

### Current feature snapshot (as of 2026-09-21)
- **Build-first home**: 6 creature slots + Specialization tile + Anointments tile; party stat overview.
  Filled spec/anoint tiles open a **detail page** (Edit → picker); empty tiles open the picker directly.
- **Creature slots** — 3-step guided wizard: Choose creature → Fusion (first-class "No fusion"; self-fusion
  blocked) → **Customize** (Personality / Scrolls / Skin). Personality = flat **+33%/−33% on the PURE base**;
  Scrolls +1 base each (cap 15). Edit reopens prefilled. Detail = **Base · Pers · Scroll · Bonus · Total**
  with party-nav chevrons.
- **43 specializations** (incl. Antiquarian + the Royal/Pariah/Deprived challenge specs). Selector + per-perk
  rank steppers (Customize). **Challenge mechanics hard-enforced**: Royal anoint cap → up to 20, Pariah
  3-creature cap, Avatar cap (1 / +Army of Gods / 0 Deprived), Deprived ignores relics + fused traits.
- **Anointments**: equip up to **5** by default (raised up to **20** by Royal's perks — `anointMax()`); an
  anoint applies its perk at **rank 1** (`_su_extract/code/SIGILS_ANOINTMENTS_FINDINGS.md`); can't anoint a
  perk from your current spec; Spec ▾ filter + taxonomy tag chips.
- **Artifacts**: 3-step builder (type → fill slots via right-hand info panel → name), socketing shows an
  item preview + explicit Add/Remove confirm, search matches name OR tag. Library + per-creature equip.
- **Spell Gems** (spell + up to 3 dust enchants, bolded plain-text descriptions), **Nether Stones**,
  **Relics**, **Realm Cards** collection.
- **Taxonomy ＋ Filter** (Category→Value drill-down) on all 4 surfaces: creatures (innate trait), artifact
  trait-items (inherited), spell gems (per-spell), perks (per-perk). Grounded on descriptions via the
  `_su_extract` classification pipeline (codebook + batch agents), NOT the unreliable code decode — rationale
  in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`, taxonomy in `_su_extract/data/model/TAG_TAXONOMY.md`.
- Fed by `_su_extract` via `build-data.mjs` (gitignored extract; only used assets copied). Data model in
  `SPEC_PLAN.md`, pipeline in `WIKI_CONTEXT.md`.

## 2026-09-21 — session 4 (Synergy Matrix — the cross-reference grid)
Wired the long-shelved **cross-reference matrix** (the `.xref-*` CSS shipped months ago but never had JS).
It's the **grid form of Tag Synergy**, kept as a *complement* (both live in the Menu): Tag Synergy = per-effect
list with descriptions; **Synergy Matrix** = at-a-glance grid.
- **Menu → Synergy Matrix** (`open-matrix`). Columns = each build **member** (spec, every equipped anointment,
  every filled creature — each with a kind-colored dot + vertical name label). Rows = every taxonomy **tag**
  present in the build. A cell lights up where that member carries that tag: **gold (`xc-active`) = tag shared
  by ≥2 members (synergy)**, **green (`xc-on`) = unique to that member**. Sticky bottom **"Shared tags"** row =
  each member's synergy degree (count of shared tags it participates in).
- Rows sorted shared-first (degree desc), then category, then value. **"Shared only"** facet hides unique rows.
- `buildTagCarriers()` mirrors `buildTagEffects()`'s gathering but at the **member** grain (unique column ids,
  so two anoints from the same spec / two copies of a creature don't collide). Reuses `slotTraitIds` +
  spell-gem taxo, so artifact/nether-granted traits and equipped spell gems flow in.
- CSS: `.xref-wrap` made a flex scroller (sticky headers anchor to it); `border-collapse:separate` so sticky
  cells keep their borders; added `.xr-cat` (row sub-label) + `.xc-dot` kind colors. Added `.xref-wrap` to
  `SCROLLERS` so the shared-only toggle preserves scroll.
- Verified headless (jsdom, 16 assertions): columns, tag rows, gold/green cell states, sticky shared row,
  shared-only filtering, and the empty-build guidance state all green.

## 2026-09-21 — session 3 (nav/UX polish, new specs + challenge mechanics, costume fixes)
Large batch. All shipped to `master` (auto-deploy). Highlights:

**Wizard & tiles**
- Creature wizard gained a **3rd step "Customize"** (Personality / Scrolls / Skin on their own screen +
  a Creature › Fusion › Customize stepbar) so those controls aren't buried below the preview on mobile.
- Creature-selector tiles: **class-emblem icon** (top-left) + **race icon** (top-right) replace the color
  dot; **sprite sizing fixed** (absolute + object-fit so a portrait sprite like Torun 40×60 can't stretch a
  row); **"Load more"** paginates 400 at a time with no filter gate (resets on search/filter, scroll kept).

**Detail pages & navigation**
- **Creature detail**: added an **Edit** button (→ wizard) and **party navigation** — discrete chevrons that
  step between filled slots (flank the sprite on mobile, below it with "pos / total" on web).
- New **Spec detail** page (mirrors the selector info panel: animated costume + perk list) and **Anoint
  detail** page (equipped-perk list), each with an **Edit** button back to its picker. Filled tiles open the
  detail; empty tiles open the picker.
- **Creature detail stat table** broken out into **Base · Pers · Scroll · Bonus · Total** (relic confirmed
  folded into Bonus). Fixed a real bug: **Personality ±33% now applies to the PURE base**, scrolls added
  flat after (was scaling the scrolls too) — corrected centrally in `finalStats`.

**Class identity**
- Class colors re-eyedropped off the emblem icons (user-picked): Nature `#588F17`, Chaos `#8F0202`,
  Sorcery `#8747CD`, Death `#3E3E69`, Life `#F2A908` (Sorcery/Death were reversed before).

**Appendix / cards / traits**
- Appendix trait rows: material icon beside the title (mirrors perk layout), creature in its own square;
  **trait icon = the trait-item icon** (never the creature) — shows for the 399 item-only traits, omitted
  (space reserved) for creature-only "Avatar-type" traits.
- Realm cards show **"n / n / n" tier thresholds** (cards needed per effect tier, active tiers highlighted).
- `richText` now strips `[icons, N]`-style sprite-ref tokens (169 in data) that leaked next to spell names.

**Builds**: footer remapped — primary button toggles **Save ↔ Load** by selection (no accidental overwrite),
old Load slot holds **Update «build»**, Delete moved far left; labels shortened to fit mobile.

**Specs — big one (spec count 39 → 43):**
- **Antiquarian** wired in (extractor left id 43 unlabeled; it's a real full ~15-perk spec).
- **Defiler emblem** fixed — no `spec_defiler` sprite exists; `spec_occultist` IS the Defiler crest.
- **Royal / Pariah / Deprived** challenge specs wired in (2 perks each, hand-defined from the perk catalog
  because `scr_PerkGetPerkList` membership is broken for them). **Special mechanics enforced (hard-block):**
  Royal → anoint cap 5 → up to **20** (Master of All +10 / Highborn +5, by allocated perks; equips trimmed
  on spec/perk change); Pariah → party locked to **3** (slots 4-6 locked, over-cap dimmed "Ignored");
  Avatars → **1** default / **+1 per Army of Gods rank** (Fanatic 3) / **0** under Deprived (over-cap Avatar
  tiles disabled in the picker); Deprived → ignores **Relic effects** + **Fused traits** in `finalStats` /
  `slotTraitIds`. Anoint picker also **blocks anointing a perk from your current spec**.
- **Spec tier costumes** corrected for 14 specs (`SPEC_COSTUME_OVERRIDE`): Defiler=occultist stem,
  Tribalist=shaman stem; Cabalist/Cleric/Druid/Evoker/Monk/Necromancer/Paladin/Reaver/Sorcerer/Trickster/
  Inquisitor use `npc_<stem>_alt` as the player tier-1 (bare = NPC version); Hell Knight = alt only;
  Inquisitor's tier-1 was missing entirely. 43/43 specs linked, old costume warnings cleared.

**Datamine reference** updated (`_su_extract/RESUME.md` §5 + `GROUNDING_STATUS.md`): the 4 "low-confidence"
spec records are COMPLETE, not truncated (Antiquarian full; Royal/Pariah/Deprived legitimately 2 perks — an
anti-pattern vs the ~15 norm); documented the emblem quirk and the costume stem/`_alt` anti-patterns.

**Ops**: ran a full 404 sweep of all 5,841 referenced assets (local + git-tracked + live HTTP) — **zero real
404s** (transient GH-Pages throttling only). Trait-material icons 1754/1754 present.

## Alternate skins + fusion-palette research outcome (2026-09-20)
**Alternate skins SHIPPED.** Creatures can wear a cosmetic skin, offered strictly by its **code-grounded
restriction** (`scr_DatabaseSkins`: race-restricted skins fit any creature of that race; creature-restricted
skins fit one specific creature via `locked_creature`). `build-data.mjs` emits `SU_DATA.skins` (743 applicable
= 586 race + 157 creature; 91 unresolved dropped, no fallback) and exports the battle frames to
`assets/skins/<frame>.png` (from `spr_crits_battle_<frame>`, all present; 404-guarded). App: skin picker in the
creature wizard's Customize panel (only restriction-allowed skins + a Default tile), stored as `slot.skinId`,
rendered in slot / wizard preview / detail; kept across creature changes only if still allowed. 1268/1362
creatures have ≥1 applicable skin.

**Fusion palette — researched, NOT shipped (deliberate).** Deep dive (3 Ghidra decompile passes + 5-pair
pixel-exact ground truth) concluded the in-game fuse recolour is **not reproducible from static data**: it is a
runtime GPU palette-swap (`FX_PaletteSwap`) whose grey/body/accent ramp clustering is computed by VM-dispatched
setters + a shader sample (not in static code). The 6 "Appearance options" = `scr_SetFusion(MODE 0..5)`, MODE 0
untinted; `field_0738`/`field_1df8` are the creature's **race id / skin index** (NOT stored base/accent colours
— that premise was falsified). Best static-grounded reconstruction ~82% (one hand-tuned pair); best empirical
clustering ~44% across 5 pairs. Only remaining path to pixel-exact = live GM-var-manager read of the 4
working-palette globals per fuse (fragile, rejected as disproportionate for cosmetics). Full write-up +
5-pair dataset: `_su_extract/code/FUSION_MODEL.md`, `data/model/fusion_ground_truth*.json`. The app shows the
untinted primary sprite for fused creatures (a real in-game option); no guessed recolour is shipped.

## v2.20c personality = flat ±33% on base (final, per user) (2026-09-18)
Simplified per user: drop the whole level lens (slider/number field/`previewLevel`/`renderLevelBar`/all
handlers + CSS) and just apply a **flat modifier to the base stat** — raised **×4/3 (+33%)**, lowered
**×2/3 (−33%)**, others unchanged (this is the end-game converged value; SU personality raises one stat's
growth to 40 vs 30 neutral → 40/30 = +33%). `persRatio(slot,k)` + `finalStats(slot)` (no level param);
`final = round(base×persRatio×artifact%)`. The **↑/↓ arrows are kept** on the raised/lowered stats
(tooltips "Personality +33% / −33%"); no other chrome. Party summary "Party" again; detail back to
Base·Artifact·Total. jsdom-verified: raised ×4/3, lowered ×2/3, neutral unchanged, arrows present, no
level chrome. (Supersedes v2.20/v2.20b level-projection takes.)

## v2.20 anoint spec filter · no self-fusion · personality + scrolls (2026-09-18)
1. **Spec filter on Anointments** — a `Spec ▾` facet next to the ＋ Filter tag chips; opens the shared facet
   picker (`anoint-spec`, list = specs that have anointments), applies a chip, narrows the grouped list.
2. **No self-fusion** — the fusion step now excludes the primary creature from the list
   (`creatureMatches`: `step==='fusion' && c.id===primaryId → false`), so a creature can't be fused with itself.
3. **Personality + Scrolls in the creature wizard** (fusion step's right panel = fusion preview + a Customize
   section). Data from `build-data.mjs`: `SU_DATA.personalities` (20, codex `L_CODD_CREATURES_*_PERSONALITIES`;
   each raises one stat's growth to 40% / lowers another to 20%) + `SU_DATA.scrollMax=15`.
   - **Scrolls** (`L_ID_SCROLL_*`): +1 **base** stat each, max 15 total; folded into `baseStats` (artifact %
     applies on top). Per-stat steppers with a running `N/15`; stored `slot.scrolls={hp,atk,…}`.
   - **Personality**: grouped picker (by raised stat); stored `slot.personality`. Picker + storage introduced
     here; the stat effect went through a few models and **settled in v2.20c: a flat +33% raised / −33% lowered
     on the base stat** (see that entry — it's the current behavior; the interim level-projection built here was
     removed). `baseStats()` stays personality-free (only scrolls fold into base).
   - Slot schema gained `personality`/`scrolls` (migrated in place); editing a creature reopens the wizard
     prefilled. Verified via jsdom (78 assertions, 0 errors).

## v2.19b anointment rank validated in code → render at rank 1 (2026-09-18)
Validated against the decompiled exe (Ghidra, `_su_extract/code/anoint_decomp/`) whether a multi-rank
perk grants its full effect from one anoint. **It does not — an anointment applies the perk at RANK 1.**
Chain: `scr_AnointmentToggle` is a boolean list toggle; `scr_AnointmentUnlocked` (boolean) is UI-only;
battle reads `scr_PerkLevel` from caches built by `scr_PerkLevelsUpdate`, which applies each anointed perk
with the literal 1.0 and **never** fetches a per-perk max-rank count (zero calls to scr_DatabasePerks /
scr_PerkGetNextPerkCost / scr_PerkAddPoints across the whole anoint→level pipeline). Full finding in
`_su_extract/code/SIGILS_ANOINTMENTS_FINDINGS.md`. App fix: `renderAnoint` was over-stating multi-rank
anointments (`perkText(desc, a.ranks)`); now renders `perkText(desc, 1)` and shows an `R1` badge (tooltip
"Anointments apply this perk at rank 1") instead of the misleading `N×` badge.

## v2.19 spell text, anointment equipping, artifact search fix (2026-09-18)
1. **Spell descriptions now render bolded plain text** — the spell-gem builder's spell picker was
   showing raw `{TOKEN}` params (`esc(desc.slice(0,80))`); it now uses `perkText` (richText + CONDDESC
   strip) in a rich two-line row (name over a clamped effect line), matching the perk visual language.
   Artifact trait/spell previews also switched to `perkText` (bold params + no `{CONDDESC_*}` appendix).
2. **Perk visual language carried to spells + material items**: new `.prop-row.rich`/`.prop-body`/
   `.prop-sub` (name-over-effect, bolded `.param`, 2-line clamp).
3. **Fixed the enormous artifact-wizard search box** — the side panel is a column flex, and `.ovl-search`'s
   base `flex:1` was stretching the input vertically. Added `.art-side .ovl-search.art-side-search
   { flex:0 0 auto; width:100%; max-width:none }`.
4. **Anointments are now equippable into the build** (was a read-only viewer). New persistent
   `build.anoints` (`[{specId,key}]`, cap **5** = the in-game limit). Each anoint row has an Equip/Equipped
   toggle (disabled at cap), the footer shows `N/5 equipped`, the home Anointments tile shows the count,
   and the tag-filter chips still apply. `anointList()` now carries `specId`; helpers `anointEquipped` /
   `equippedAnointObjs`. Verified via jsdom (62/62).

## v2.18 spec costume-animation audit + fix (2026-09-18)
The spec info-panel animates one costume per tier; it should be exactly the 3 canonical tiers
(3 cycles / 6 frames). Audited all 39 specs and found **16** off — the grouping was sweeping in
`_alt`/`_robe`/`_minotaur` variants and legacy `ospr_*` duplicates (Reaver showed 4 cycles: 3 real
tiers + a stray `_alt`), and one spec (Inquisitor) hit a count of 3 with a *wrong* composition
(tiers 2/3 + alt, no tier-1). Root cause: tier naming is inconsistent across specs — canonical
`npc_<stem>_1/_2/_3`, numbered `npc_<stem>01/02/03`, and suffix `npc_<stem>`(bare = tier 1) + `_2/_3`.
`build-data.mjs` now derives a tier number per costume record, keeps only tiers 1/2/3 (one per tier,
preferring an explicit tier over the bare-stem fallback), and drops variants + `ospr_*`. Result:
**36/39 specs animate exactly 3 cycles.** The 3 remaining are honest extraction gaps (verified — the
tiers don't exist in the game data): Inquisitor ships only tiers 2/3 (no tier-1 → 2 cycles);
Defiler/Tribalist ship only an `_alt` costume (1 cycle). Those emit a build warning. Reaver is now
`npc_reaver / _2 / _3` (3 cycles). The unused per-tier animation frames for the dropped costumes were
removed from `assets/wardrobe/`; the full 820-costume wardrobe set stays in `SU_DATA.wardrobe` for a
future costume picker.

## v2.17 UX pass — perks, creature wizard, artifact socketing (2026-09-18)
Eight-item punch-list from the user, verified via jsdom smoke (38/38, 0 errors).
1. **Perk rows standardized** in both the spec info list and the Customize picker (and the Anointments
   list): fixed-icon + a head line (`<b>name</b>` ↔ right-aligned rank/cost meta) + desc block. Replaced
   the old `float:right` cost (which drifted with name length) with a flex header — rows are now uniform
   regardless of name length or point value. Structure: `.perk-line-body/.perk-line-head/.perk-line-meta`
   and `.perk-row-head/.perk-meta`.
2. **Dropped the CONDDESC bloat.** 103 perk/anoint descs append the referenced condition's full tooltip
   (`\n\n{CONDDESC_*}`/`{CDESC_*}`), which blew up rows. New `stripCondDesc()` + `perkText()` remove that
   appendix; perk/anoint text is now effect-only.
3. **Removed placeholder banners** ("Select a specialization/creature/relic" info-panel stubs, which render
   at the bottom on mobile) + trimmed the home "Party stat overview (after fusion + artifact)" → "Party".
4. **Creature selector info panel leads with the innate trait**, then base stats; **dropped the per-tile
   base-stat total** under every creature tile.
5. **Creature selection is now a guided wizard**: 1 · Choose creature → 2 · Fusion partner (or a first-class
   "No fusion" tile) → Commit. Editing a filled slot re-opens the same wizard pre-filled so either half can
   change (the slot's "Fuse" button became "Edit"); the fusion step shows a live averaged-stats + both-traits
   preview. `openCreaturePicker(slotIdx)` now stateful (`step/primaryId/fusionId`).
6. **Centered the ✕ buttons** (`.ovl-close/.slot-remove/.as-rm`) via flex centering + padding:0 (the glyph
   sat slightly right).
7. **Artifact builder uses an info panel** (right `.ovl-right.art-side`) instead of appending the picker to
   the bottom of the scroll: default = live-bonus; tap a slot → filterable picker; **search matches name OR
   tag** (taxonomy value names, for trait items/spell gems).
8. **Socketing no longer applies silently** — tapping an item opens a preview showing its effect with an
   explicit **Add to artifact** / **Remove from artifact** confirm (`art-preview` → `art-confirm-add`).

## v2.16 taxonomy → spells + perks (2026-09-18)
Extended the per-item classification to the last two surfaces (user: "keep going"). SPELLS (747/747, 5015 tags):
spell-specific rubric (actions not triggers; self-categorize Damaging/Healing/Single/Multi-Target/element) →
`spell_taxonomy_tags.json`; ＋Filter on the spell-gem builder's spell picker (reuses the facet drill-down via
source-aware `taxoIndexFor`/`openFacetPicker(kind,{idx,onPick})`). PERKS (599/600; 1 empty = out-of-combat
drop-rate perk): trait-like rubric → `perk_taxonomy_tags.json` (by `spec_id:perk_key`); INLINE Category→Value
filter in the perk picker (it's a detail overlay, can't nest the facet). Generic `_su_extract/code/aggregate_surface.py`.
Verified jsdom: spell Related Debuff→Burning 300→29 (29/29 correct), perk 15→4, 0 errors.

## v2.15 taxonomy → artifact trait-items (2026-09-18)
Trait-slot materials inherit their granted trait's full taxonomy (exact `traits[trait_id].taxo` join in
build-data.mjs; traitName↔trait.name 0 mismatches / 1775; 1745/1790 tagged). ＋Filter drill-down added to the
artifact-builder trait picker. Generalized `taxoIndexFor(key,items,getTags)` + `openFacetPicker(kind,{idx,onPick})`
so surfaces share the picker (creature picker unchanged). Verified Related Debuff→Poisoned 300→40, 40/40 correct.

## v2.14a/b/c agent-note review, vocab expansion, boss/NYI backend (2026-09-18)
- **Corrections** (reproducible in `aggregate_taxonomy.py`, keyed by id/desc): dropped Peace-family
  debuff-immunity mis-tag; added once-gate repeating triggers; class-FILTERED-damage keeps Take Less Damage but
  drops erroneous Change Class; Blessing From Below + Pact of the Gods remapped to user spec; 4 mis-flagged-as-flavor
  traits fixed (Angry Army, Who Am I? None, Seethe, Torun).
- **Vocab expanded** to full referenced rosters (158 races → Related Types; all `[icons]` spells validated vs
  canon; +Littletorun/Illusion minions). UI hides values with no member trait.
- **Boss/NYI backend**: 15 boss/god flavor traits mapped from the (noisy) code decode with enemy-actor triggers
  (`trait_meta.scope=boss_enemy_flavor`, "verify in-game") for a future boss-prep planner; 10 NYI traits flagged
  `scope=nyi` "recheck on game update". All 25 are non-playable → absent from the live filter; correction: earlier
  "no effect" was a description read, NOT code-validated (several DO carry coded effects).

## v2.14 full per-trait taxonomy (all 24 categories, triggers + ally/enemy) (2026-09-18)
Per user direction ("do the hard labor, resolve each trait independently"), classified every trait's
description individually against a fixed codebook (`_su_extract/code/TRAIT_CLASSIFICATION_CODEBOOK.md`) —
21 parallel agents, ~100 traits each, reading each description on its own merits (the localization wording
is inconsistent, so per-trait reading beats regex). Aggregated + validated every emitted tag against the
fixed vocabulary (`code/aggregate_taxonomy.py`, 5/12,556 invalid dropped), merged with the token-exact
Related-* tags.
- Result: **all 24 categories now populated** (was 9), incl. Activates When/at WITH Ally/Enemy actor
  direction, Affect-on-X, Active If, Multiplied by. 2,187 traits, 13,933 assignments.
- Correct: Alcoholism → Enemy is Debuffed + Send to Bottom; Reinvigoration → Ally Attacks; Seize → Enemy Dodges.
- Verified via jsdom: 24 categories shown, Activates When has all 34 Ally/Enemy values, Enemy Dodges filters
  400→10 (10/10 correct), 0 JS errors.
- The RE detour (why the code couldn't back this) is preserved in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`;
  the actor mechanism (crit-arg source) corroborates the classification's Ally/Enemy calls.

## v2.13 tag taxonomy re-grounded on the game's structured markup (2026-09-18)
User flagged erroneous filter output (e.g. Alcoholism tagged "Attack"). Root-caused it to the code-effect
layer, then did a full battle-interpreter RE in Ghidra (all logged in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`):
- Fixed a real block-slurp bug in the trait-handler extractor (`SuTraitOperands2.java`; 43,751→~1,000-token blocks).
- **Definitive finding:** SU stores NO structured trigger/effect metadata — behaviour is defined by each
  trait's authored `description` and executed by scattered opaque `if(hasPassive){…}` code that doesn't
  encode the trigger (verified via disasm, decompiler control-flow, and the passive DB itself). So the
  handler decode caps at ~30-60% precision and can't back a trustworthy filter.
- **Rebuilt `build_taxonomy_tags.py` to ground on the game's own structured description markup**
  (`{CONDNAME_}/{STAT_}/{RACE_}/{CLASS_}/{ACTION_}/{TIMELINE}/{SPELL_}`) + unambiguous keywords +
  random-collapse. Every tag is correct-by-construction. Fixes the errors: Alcoholism → Timeline only;
  Black Hole Halo → Scorned (tokens even corrected a wrong condition-id decode).
- Coverage: 2,008/2,187 traits tagged; 9 of 24 categories are token-groundable and shown (Related
  Buff/Debuff/Minion/Stat/Types, Action/Mechanic, Related Trait, Effect Limitation). The 15 trigger-direction
  / effect-magnitude categories are honest gaps (prose-only) — hidden in the picker, marked `status:gap`.
- Verified via jsdom: Related Debuff→Poisoned filters 400→27 with 27/27 correct, 0 JS errors.

## v2.12 human tag taxonomy → Category→Value trait filter (2026-09-18)
Conformed the trait tag layer to the user's authored 24-category taxonomy (broad condition → specific
segment). New pipeline in `_su_extract`:
- `code/build_taxonomy_tags.py` maps each trait's **code + structured-token** signals onto taxonomy
  values (code-grounded only; no prose-mining) → `data/model/tag_taxonomy.json` (canonical taxonomy +
  per-value status) + `trait_taxonomy_tags.json` (per-trait `[{cat,val}]`). Doc: `data/model/TAG_TAXONOMY.md`.
- Coverage: **2107/2187 traits tagged, 14,583 assignments; 197/337 values covered, 140 gaps** — gaps
  cleanly classified `actor-split` (all `Enemy …` variants) and `desc-only` (magnitude/direction, "for-each"
  counts, named spells). Flagged for a future controlled prose pass; kept out so data stays code-certain.

App: `build-data.mjs` bundles `SU_DATA.taxonomy` + `traits[id].taxo`. The creature/fusion picker's flat
"＋ Tag" facet was replaced with a two-level **＋ Filter** drill-down (Category → Value, back button,
multi-filter AND). Empty values hidden; counts computed but never shown (minimal-chrome). Verified via
jsdom smoke test: 400→54 on Related Debuff→Poisoned (54/54 correct), 54→28 when AND-ed with Attack, 0 JS errors.

## v2.11 artifact material model + icon/align fixes (2026-09-17)
Four fixes from the user's punch-list:
1. **Trait slot no longer shows trick materials.** `traitItems` was built from *every* material with a
   `trait_id` — which swept in the 47 Slates/Curios/Cripplers (`item_class:1`, they carry a status trait_id).
   `build-data.mjs` now `continue`s on `item_class === 1`, so the Trait picker holds only real trait mats
   (`item_class:2` + the 5 `item_class:null`-with-trait_id strays). Trait pool 1830→1790.
2. **Stat & Trick slots are now real material pickers** (user chose "Real material pickers"). The item_class
   split drives three artifact material pools, each mapped 1:1 to its property:
   - **Stat = Ambers** (`item_class:null`, no trait_id; 15). Map onto the 15 unique Stat properties **by db
     order** (Red→Attack, Purple→Defense, …, Bold→Attack/Defense, …, Shiny→Intelligence/Speed — verified:
     exact count match, Amber field1 runs singles then double-combos in artifacts_ref order). `SU_DATA.statMats`.
   - **Trick = Slates/Curios/Cripplers/generics** (`item_class:1`; 47). Mapped **by name** (perfect 47↔47,
     0 gaps/dupes): `Curio of Poisoning`→"Poisoned On Damage", `Life Crippler`→"Life Strength", 6 generics
     (Whetstone→Attack Damage, Arcane Sigil→Spell Potency, Jagged Rock→Critical Chance, Slippery Stone→Dodge
     Chance, Armor Scrap→Damage Reduction, Pump Drill→Spell Gem Slots) via explicit dict. `SU_DATA.trickMats`.
   - All 15+47 materials have icons (copied to `assets/maticons`). **Slots still STORE the property name**, so
     `artifactPctOf` + old-artifact migration are untouched; the picker/slot-chips resolve the material via
     `MAT_BY_PROP` (property→material) to show its real name + icon. app.js: picker rows, `filledBox`, name-step
     chips switched to materials.
3. **Creature-selector stat table realigned.** `renderCreatureIdentity` reused the wide detail `.stat-row`
   grid (`1fr 60px 60px 68px`) with the single value merged `grid-column:2/5` — in the 260/210px `.ovl-right`
   that squeezed the name column to ~40px (0/overflow on mobile), throwing the values off. Added
   `.stat-grid.single .stat-row { grid-template-columns: 1fr auto; }` and dropped the merge span.
4. **Spell-gem property icons cleaned.** All 21 hand-cropped Enchanter icons carried a stray fragment in their
   trailing columns (grey UI-border bars; bright-green XP-bar bits on Agate/Sapphire), separated from the gem by
   a wide transparent gap. Cleaner crops each at its widest ≥3px zero-run and tight-bounds the result (source
   `_su_extract/assets/spell_gem_property_icons/*`, dirty originals kept in `*_dirty_bak`).
   **ONYX recovered (21/21):** its v2.10 crop was botched into a partial fragment; the raw menu column survived
   as the prior session's `iconstrip.png` (176×2348, Agate→Opal alphabetical), so ONYX was re-cropped from band
   17 (a dark navy obelisk w/ silver crown) and downscaled ×0.5 (NEAREST) — the same scale every sibling used
   (each was ~½ of the same strip). Source screenshot itself wasn't bad; only the original crop was.

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
### Done (2026-09-18) — session 2 (UX + mechanics)
- [x] Perk rows standardized (spec list / Customize / Anointments); `{CONDDESC_*}` tooltip bloat stripped.
- [x] Creature selection = guided wizard (creature → fusion/skip → commit; **no self-fusion**; edit prefilled).
- [x] Creature-selector leads with the trait; dropped per-tile stat total; ✕ glyphs centered.
- [x] Artifact builder → right info panel + preview-before-socket confirm; search by name OR tag.
- [x] Spell descriptions render bolded plain text; perk visual language carried to spells + material items.
- [x] Spec costume animation fixed (3 canonical tiers only; 36/39 clean, rest are honest extraction gaps).
- [x] **Anointments equippable** into the build (cap 5, in-game-validated as rank-1) + Spec filter + tag filter.
- [x] **Personality** (flat +33% raised / −33% lowered, ↑/↓ arrows) + **Scrolls** (+1 base, cap 15) in the wizard.

### Done (2026-09-18) — session 1 (human tag taxonomy)
- [x] 24-category Category→Value trait filter, grounded on descriptions (all 24 categories incl. Ally/Enemy triggers).
- [x] Extended to artifact trait-items (inherited), spell gems (per-spell), perks (per-perk). All 4 surfaces filterable.
- [x] Boss/NYI trait taxo mapped on the backend for a future boss-prep planner (`trait_meta.scope`).

### Next up (P1)
- [ ] **Boss-prep planner element** — surface the boss/enemy trait taxo (`trait_meta.scope=boss_enemy_flavor`,
      already in `data.js`) as a "prepare for this fight / what to expect" view. Verify tags in-game first.
- [ ] Taxonomy of remaining surfaces if wanted: cards / relics / nether stones (stat/trick artifact materials
      only map to Related Stat / Affect-on-Stats — narrow, from material_stats).
- [ ] Real trait detail page (replace the `nav-trait` `alert()` stub) with tags + "shared by N party members".
- [ ] DPS / effective-stat simulation from `damageModel` (spell & melee, crit/dodge, defending). Expose
      class-advantage multiplier as a toggle (unconfirmed in extract).
- [ ] Perk-tree picker per specialization (perks[] already in data + now taxo-tagged; needs tree layout).

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
