# Siralim Ultimate Build Calculator — Progress

## LIVE
Deployed at **https://misterwtheface-oss.github.io/su-build-calc/** (repo `misterwtheface-oss/su-build-calc`,
Pages on `master`/root, Cloudflare analytics active with the shared github.io token). Auto-deploys on push.
No verify-before-push ceremony (no real users yet) — but every change is checked with the jsdom smoke suite
(scratchpad `smoke.mjs`, ~84 assertions across all flows) before commit.

### Current feature snapshot (as of 2026-09-24)
> **2026-09-24 — FULL EXTRACT RECONCILIATION (creatures / traits / items / spells).** Every entity now carries a
> per-attribute, provenance-backed classification — the data foundation for boss-guide / owner-surfacing features.
> **Traits**: 2187 fully classified (1984 shipped w/ a two-form **owner model** — `owner`/`ownerType`/`ownerForm`
> player·encounter/`ownerCategory`/`ownerGroup`/`ownerProvenance`/`itemSource`; 203 blacklisted: 58 duplicate + 39
> NYI + 91 legacy-S3 + 15 recon), **0 unresolved**. Validated structure: **Deities == Avatars** (31 gods, each a
> player Avatar trait + an encounter Deity trait = 62); **every Nether Boss = 3 same-name tiers** (54 extra dup copies
> dropped, wiki-verified); False-God part dupes are valid (body parts); special/story bosses (Lord Zantai=Zantai
> encounter, Treasure Golem 2.0, Imp Impington Prime, Caliban-story) wired. **Creatures**: `creature_reconciliation.json`
> (1419: Playable/False-God-part/NYI-anagram-set/Story-Boss/Legacy). **Items**: `item_reconciliation.json` (1862
> categorized, 1719 linked, 81 unlinked=data-limitation). **Spells**: 747 all live, Source from `Spell_REF.csv`.
> Generators + reconciliation artifacts live in `_su_extract/data/model/` + `_su_extract/code/`; the LIVE trait
> classification is the `build-data.mjs` override lists. **Provenance rules (do not violate):** wiki maps but doesn't
> assert presence; no invented categories; no name-match identity; `material_stats.trait_id` drifts (never trust);
> in-game truth beats stale CSVs. See `_su_extract/CONTEXT_MAP.md` "FULL RECONCILIATION LAYER" for the durable map.
>
> 2026-09-22 added: **Appendix bookmarks** (mark traits/spells → filter the selectors) + **Macro Proposal
> engine** (predict a creature's battle-AI Macro from its loadout — ⭐ actively iterating, see roadmap below).
> Sessions 4j–4q (2026-09-21) added: Ascension-perk badges (4j) · **Threats advisor** (4k) · god base-stat
> null-fix + creature **stat sort** + matrix align (4l) · Defiler/Tribalist costume split-stem fix (4m) ·
> **spell data enrichment** + spell-gem info panels (4n) · **taxonomy for Realm Cards/Relics/nether** (4o) ·
> **taxonomy provenance** (4p) · **Realms + God Shops reference pages** (4q). Details in the entries below.

- **Build-first home**: 6 creature slots + Specialization tile + Anointments tile; party stat overview.
  Filled spec/anoint tiles open a **detail page** (Edit → picker); empty tiles open the picker directly.
- **Creature slots** — 3-step guided wizard: Choose creature → Fusion (first-class "No fusion"; self-fusion
  blocked) → **Customize** (Personality / Scrolls / Skin). Personality = flat **+33%/−33% on the PURE base**;
  Scrolls +1 base each (cap 15). Edit reopens prefilled. Detail = **Base · Pers · Scroll · Bonus · Total**
  with party-nav chevrons.
- **43 specializations** (incl. Antiquarian + the Royal/Pariah/Deprived challenge specs). Selector + per-perk
  rank steppers (Customize). **Challenge mechanics hard-enforced**: Royal anoint cap → up to 20, Pariah
  3-creature cap, Avatar cap (1 / +Army of Gods / 0 Deprived), Deprived ignores relics + fused traits.
  **Perk→spec membership is sourced from `Perk_REF.csv`** (the datamined `scr_PerkGetPerkList` leaked perks
  between specs — see session 4i); code membership is used only for Antiquarian (absent from the CSV).
- **Anointments**: equip up to **5** by default (raised up to **20** by Royal's perks — `anointMax()`); an
  anoint grants the perk's **full bonus** (user in-game truth, reversed the earlier rank-1 decompile); grouped
  + filtered by affiliated **False God** (combined 6-part portraits); can't anoint a perk from your current
  spec; Spec ▾ filter + taxonomy tag chips.
- **Artifacts**: 3-step builder (type → fill slots via right-hand info panel → name), socketing shows an
  item preview + explicit Add/Remove confirm, search matches name OR tag. Library + per-creature equip.
- **Spell Gems** (spell + up to 3 dust enchants, bolded plain-text descriptions), **Nether Stones**,
  **Relics**, **Realm Cards** collection.
- **Taxonomy ＋ Filter** (Category→Value drill-down) now on **6 surfaces**: creatures (innate trait), artifact
  trait-items (inherited), spell gems (per-spell), perks (per-perk), **Realm Cards + Relics** (classified 4o).
  Grounded on descriptions via the `_su_extract` classification pipeline (codebook + batch agents), NOT the
  unreliable code decode. **Every tag carries a `src` (provenance)** — token (exact game markup) / keyword /
  llm / phrase / field / correction — shipped as a parallel `taxoSrc` array and surfaceable via the Appendix
  **Sources** toggle (4p). Rationale in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`.
- **Threats advisor** (Menu → Threats): detects the build's theme from its tags and lists the **realm
  properties + False God runes that counter it** (auto-detect + manual override; theme-specific "Counters your
  build" + collapsible "Generally punishing"). Fed by `realm_properties.json` (56) + `runes.json` (18).
- **Realms** + **God Shops** reference overlays (Menu, 4q): 30 realms (denizens/resources/instability-tier
  objects) with a cross-link to the 22 per-god favor shops (items · type · favor price · desc).
- **Spells** carry code-certain `charges` + community `potency`/`target`/`source`; shown in spell-gem info
  panels (library + builder step-1) and Appendix spell rows (class gem icon + charges·potency).
- **Synergy** (Menu → Synergy): one overlay, **Matrix** ⇆ **List** toggle. Matrix = members (Spec /
  collapsed Anointments / creatures — each expandable to its perks/anoints/traits) × tags; cell = that
  member's contribution count (sub-rows use dots); columns/cells **coloured by share status** (green = shared
  with the Spec, yellow = shared among others, red = solo) and **sorted by contribution weight** (a heavy red
  column = strong-but-unsynergised theme, an intentional alert). List = collapsible per-shared-tag groups +
  jump-link bar. "Does not stack" excluded (noise). Counts perks/anoints/creature-traits/spell-gems **plus
  equipped relics + nether spell-props** (4o); Realm cards are deliberately NOT counted.
- **Builds** (Menu → Builds): save/load/update/delete parties (localStorage `subc.builds`), wardrobe-sprite
  icon, **sort by Last edited / Name / Spec**.
- **Appendix** (cross-entity tag search) + right-side info panels throughout. **Bookmarks** (2026-09-22): a
  ★ on Appendix trait/spell rows marks them into a scratch set (`subc.bookmarks`, cleared on Reset/load); a
  "★ Bookmarked" facet then filters the creature picker (by innate trait), spell-gem builder, and artifact
  trait/spell pickers.
- **Macro Proposal** (2026-09-22, creature detail page → "Proposed Macro"): predicts a creature's in-game
  battle-AI **Macro** from its loadout so battles can be automated (default action = Macro). Classifies each
  equipped spell (gems+nether+artifact) by purpose/side/breadth → ordered lines (rez→heal→provoke→buff→debuff
  →summon→AoE→focus-fire→basic attack→fallback) with role chips, per-line rationale, chain indentation, Copy.
  Fed by `macroVocab` in data.js (from `_su_extract/data/model/macro_vocab.json`; model in
  `_su_extract/code/MACRO_MODEL.md`). **v1 heuristic — iteration roadmap below.**
- Fed by `_su_extract` via `build-data.mjs` (gitignored extract; only used assets copied). Data model in
  `SPEC_PLAN.md`, pipeline in `WIKI_CONTEXT.md`.

## ⭐ Macro Proposal — iteration roadmap (ACTIVE)
v1 shipped 2026-09-22, then **refactored for extensibility** (behavior byte-identical): the engine now has
three clean modification surfaces (see **`MACRO_ENGINE.md`**) — `MACRO_TUNING` (all thresholds/knobs),
`SPELL_OVERRIDES` (per-spell `{purpose,side,multi}` hook in `classifySpell`), and `MACRO_RULES` (ordered
`{key,when(x),lines(x)}` array over a shared `macroContext(x)`; array order = priority). `proposeMacro` is a
thin iterator; `macroRoles(x)` split out. Grounded in `_su_extract/code/MACRO_MODEL.md` + `macro_vocab.json`.
Known limits + planned work, roughly in priority order (all now cheap to implement against the new surfaces):
1. **Named buff/debuff detection** (top ask). Right now buff/debuff lines gate on `has < 1 buffs|debuffs`
   because we don't know *which* status a spell applies. Detect the granted status name from the spell's
   effect/taxonomy so lines can read `doesn't have {Shell}` — needs a spell→status map (mine from
   `_su_extract` spell effects / the `terms` status vocabulary already in data.js).
2. **Tunable knobs**: focus-target stat (default *lowest Max Health* for nukes / *lowest Defense* for
   attacks — offer *lowest Health*, highest-threat) and heal threshold (default 50%). Small UI in the
   Proposed-Macro section.
3. **Classification accuracy**: taxonomy mislabels some spells (e.g. Antidote tagged "Healing" but it cures
   debuffs). Add targeted overrides / a secondary signal (Affect on Status vs Affect on Life).
4. **Spec + anointment context** in role inference (e.g. a summoner spec → Support/Tank lean; damage-amp
   anoints → Caster). Currently role uses only the creature's own spells + stats + traits.
5. **Deeper `scr_MacroProcess` mining** (from the on-disk 337 KB decompile): exact chain candidate-scoping
   (does a chain re-test the whole side or narrow the candidate set?) and the save-format field order
   (`scr_MacroArrayToString`) if we ever add in-game import/export. Confirm the 32-line cap is per-macro.
6. **Multi-line-per-role & priority UX**: let the user reorder/toggle proposed lines, and handle creatures
   with many spells without bloating the list.

## 2026-09-21 — session 4q (Realms + God Shops reference pages)
Two new read-only reference overlays (Menu → **Realms**, **God Shops**).
- **build-data**: `godShops` (from `god_shop_ref.json` — 22 gods × ~21 items, grouped per god, sorted by tier;
  each `{tier,item,type,price,desc}`) + `realms` (from `realms_ref.json` — 30 realms; the flat section-
  delimited `other` array is parsed into `encounters`/`resources`/`uniques`, each unique object carrying its
  4 **Realm-Instability tier thresholds** → interaction reward). Realm `godName` = short name (before the
  comma); `hasShop` cross-links the 21 realms whose god runs a shop.
- **God Shops overlay** (`openGodShops`/`renderGodShops`): left god list (item count) + right item list
  (name · type chip · **favor price ✦** · description); search matches item/type/desc.
- **Realms overlay** (`openRealms`/`renderRealms`): left realm list (class-dot + god) + right detail —
  facts (God/Class/Gemstone/Godspawn via the `.spell-stats` grid), **Roaming creatures** as sprite chips
  (`realmCritFor` resolves race/name → a representative creature sprite), Encounters, Resources, and
  **Realm objects → Instability rewards** (each object's 4 tier rows: `≥N instability → effect`). Realms
  with a shop get a **"View <god>'s God Shop ›"** cross-link button (`realm-shop` → `openGodShops(god)`).
- Menu gained a separator + the two items; searches wired in `onInput`; `.opt-row.on` selected style +
  realm-crit/realm-uniq/realm-tier/gs-price CSS. jsdom `refpages_smoke.mjs` 19/19 (data shape, both
  overlays, selection, cross-link lands on the right god); all suites green. Shipped to `master`.

## 2026-09-21 — session 4p (taxonomy PROVENANCE — surface how each tag was derived)
Clarified/hardened how taxonomy is derived and made the source surfaceable on demand. **Derivation is NOT a
naive prose heuristic**: each tag carries a `src` from the pipeline — `token` (the game's own structured
markup `{CONDNAME_}{STAT_}{RACE_}{CLASS_}{ACTION_}{SPELL_}{TIMELINE}` — exact, wording-independent so
"has" vs "have" can't matter), `keyword` (a small word-boundaried domain-keyword layer for broad mechanics),
`llm` (per-description classification for the ~15 trigger/effect categories markup can't express), plus
`phrase`/`field`/`correction`. A has/have split therefore comes from an LLM coverage gap or a markup gap,
never a coded verb rule.
- **build-data** now PRESERVES that `src` (was dropped in the flatten). New `taxoSrcArr(srcArr, finalTaxo)`
  emits `taxoSrc` as a **parallel array aligned to `taxo`** (taxoSrc[i] explains taxo[i]) on traits, perks,
  spells, trait-items (inherited), relics, cards. Parallel-array form keeps the size hit small (3.13→3.41 MB;
  the naive per-tag map was 4.42 MB). Distribution: token 4235 · llm 7003 · keyword 478 · phrase 785 ·
  correction 21 · field 16.
- **Appendix "Sources" toggle** (`appendix-src`, off by default per minimal-chrome): when on, every result row
  shows a colour-coded provenance chip for how IT earned each active filter tag (green token / blue keyword /
  violet llm / gold correction), with a tooltip. This is the "surface provenance when needed" path — filter a
  group, flip Sources, and immediately see which members are exact-markup vs classified (spotting the gaps).
jsdom `appendix_smoke.mjs` +provenance 20/20; all suites green. Shipped to `master`.

## 2026-09-21 — session 4o (taxonomy for Realm Cards + Relics + nether; drop perk-tree item)
Extended the tag taxonomy to the remaining fixed surfaces, per user.
- **Classification**: exported card (141, effects joined) + relic (31, all rank effects joined) descriptions,
  ran the existing batch-LLM pipeline (6 parallel agents vs `TRAIT_CLASSIFICATION_CODEBOOK.md` + the fixed
  468-value vocab), aggregated via `aggregate_surface.py` → `card_taxonomy_tags.json` (125/141 tagged; 16 are
  pure economy/resource cards with no combat mechanic → empty) + `relic_taxonomy_tags.json` (31/31, 702 tags).
  All emitted tags validated against the vocabulary (0 dropped). Repro dir: `_su_extract/code/cardrelic_classify/`.
- **build-data**: `cardTaxo`/`relicTaxo` loaders; each card/relic gets `taxo` via `correctTaxo(taxoStrs(...))`.
- **Appendix**: cards + relics now feed `appendixTaxoIndex` and appear as **Relics** + **Realm Cards** result
  sections (icon + stat/class chip + effect text), searchable by the same multi-tag AND drill-down.
- **＋Filter**: added to the **Cards** collection and the **Relic builder** (shared `taxoFilterBar`/`taxoMatch`
  helpers + surface-aware `facet-taxo` idx via `cardTaxoIndex`/`relicTaxoIndex`; reuses `rm-taxo`/`facet-pick`).
- **Synergy**: **relics** (equipped per creature; skipped under Deprived) and **nether-stone spell props**
  (`slotNetherSpells`; nether traits already flow via `slotTraitIds`) are now counted as creature-attached
  effects in both Matrix + List views (List kind `Relic`). **Realm cards are deliberately NOT synergy
  carriers** (user: don't count card taxonomy in synergy totals) — they're never gathered by
  `buildTagCarriers`/`buildTagEffects`.
- **Dropped the perk-tree picker** backlog item (user: no such thing exists).
jsdom `cardrelic_smoke.mjs` 12/12 (data, Appendix sections, card ＋Filter narrow/restore, relic in synergy);
matrix/appendix/spellgem/creasort/threats/builds/asc all green. Shipped to `master`.

## 2026-09-21 — session 4n (spell data enrichment + spell-gem info panel + Appendix spell icons)
- **Spell data enriched** in the pipeline: each `SU_DATA.spells` entry now carries **`charges`** (CODE-certain
  from `_su_extract/data/model/spell_stats.json` — authoritative, e.g. Affliction 14 beats the community
  CSV's 17; 712/747 covered) plus **`potency` / `target` / `source`** (community `spells_ref.json`, `-`
  normalized to null; 402 have potency). `build-data.mjs` loads both, logs the coverage.
- **Spell-gem library info panel** (`renderSpellGemLib`) reworked: the selected gem now shows a **Spell**
  section (class gem icon + name + full desc) followed by a compact **stat readout** (`spellStatsHtml`:
  Class / Charges / Potency / Target / Source — only the fields we have), then an **Enchants** section for
  the dust props. Replaced the old flat "Contents" list; dropped `sgContentRows`.
- **Appendix spell rows** now render the **class-coloured gem icon** (was iconless) plus a charges·potency
  meta chip (`spellMeta`). The spell-gem builder's spell-picker rows got the same inline charges·potency tag.
- New CSS `.spell-stats`/`.ss-row` (key/value) + `.prop-metatag`. jsdom `spellgem_smoke.mjs` 16/16 (data
  provenance, info-panel stats, Appendix icons+meta); all other suites green. Shipped to `master`.
- **Follow-up: live info panel while PICKING a spell.** The spell-gem builder's step-1 (Pick spell) gained
  a right `ovl-right` info panel that previews the highlighted spell's icon + full effect + stat readout
  (`spellStatsHtml`) as you tap through candidates — so you can compare charges/potency/target BEFORE
  committing, not only after the gem exists. `sg-spell` already re-renders via `refreshOverlay` (scroll
  preserved). Smoke extended to 22/22.
- **Follow-up: Spell-Gem library footer parity with Artifacts.** Moved the buried Edit/Delete/Equip out of
  the info panel onto the **bottom bar** (mirrors the Artifacts/Builds footer): left = Hide equipped; right
  = Edit + Delete (`.btn-ghost`, disabled without a selection) + a mode-switching confirm that reads **Equip
  / Equipped ✓** in a creature equip context or **＋ Build new** in manage mode. Info panel is now
  content-only. Smoke 31/31 (footer buttons, disabled states, equip-context toggle).

## 2026-09-21 — session 4m (fix Defiler/Tribalist tier-1 costume — split-stem antipattern)
User: tier-1 Defiler & Tribalist were broken. **Final, user-confirmed truth: these two specs split their
3 costume tiers across TWO stem names** — tier-1 under the SPEC name (`npc_defiler_alt` /
`npc_tribalist_alt`, `cat=specialization`), tiers **2 & 3 under a mismatched creature-looking name**
(`npc_occultist_2/_3` / `npc_shaman_2/_3`, `cat=npc`) — the tiers 2/3 ARE correct despite the name; the
naming itself is the antipattern. The session-3 batch got tiers 2/3 right but used the bare
`npc_occultist`/`npc_shaman` (the actual creatures) for tier-1 → wrong sprite. (An interim over-correction
dropped tiers 2/3 entirely; reverted.) **Fix (hard-coded in `SPEC_COSTUME_OVERRIDE`):** Defiler →
`['npc_defiler_alt','npc_occultist_2','npc_occultist_3']`, Tribalist →
`['npc_tribalist_alt','npc_shaman_2','npc_shaman_3']`. Verified both resolve to 3 tiers (2 anim frames
each). Captured in memory `su_spec_costume_tier_stems.md` so it isn't re-broken. Other `_alt`-tier-1 specs
keep all three tiers under their OWN stem's `_2/_3` and are fine.

## 2026-09-21 — session 4l (stat anomaly fix + creature stat sort + matrix align)
Batch of user requests.
- **#3 Base-stat null anomaly fixed.** 14 god/boss creatures (Final Arbiter, Gonfurian, Alexandria,
  Genaros, Pandemonium Queen, Gravewood Ghost, Grubette, Polygala Fae, Hunter Scout, Nihilist Seeker,
  Amethyst Paragon, Shambler Rescuer, Venomskin Spellmane, Docile Wolpertinger) each had exactly ONE
  null base stat. Root cause (RE'd): they exist only in the legacy `creature_stats.json`, and one stat
  isn't a plain small immediate the int-setter scan reads — the byte at that slot decodes to garbage
  (e.g. `0xBA000007`), so the extractor correctly records `null`. **Fix: grounded null-fill from the
  user's `Creature_REF.csv` compendium** (base-stat cols HP,Atk,Int,Def,Spd, positional parse via new
  `parseCSVRaw`); verified the filled values align with each creature's non-null code stats (Final
  Arbiter HP=30). `statSource` gains a `+ref` suffix, build logs the 14, and a guard warns on any
  residual null. 0 nulls remain.
- **#4 Creature-picker stat sort + magnitude.** New **Sort** segmented bar (— / HP / Atk / Int / Def /
  Spd / Total) in the picker; `sortCreatures` orders highest-first. `st.sort` state, `crea-sort` handler
  (resets pagination). **Magnitude (v2, per follow-up): moved off the tiles into the info-panel base-stat
  table** — a **discrete** thin track per row (`.stat-grid.single.mag`: name | 3px accent track @ 45%
  opacity | value) showing `value / roster-max` (`STAT_MAX` across all creatures) for **all 5 stats +
  Total at once**, always visible for the highlighted creature. Tiles are back to clean name-only.
- **#1 Synergy matrix leftmost column right-aligned** (`.xref-rowhead`/`.xref-corner` → `text-align:
  right`; sub-row indent flipped from `padding-left:26px` to `padding-right:14px`) so member labels sit
  against the numeric grid.
jsdom smoke: `creasort_smoke.mjs` 14/14 (null-fill + sort + bars); threats/matrix/builds/asc all green.
Shipped to `master`.
- **#2 Appendix multi-tag AND search** (like the creature selector). The single Category→Value→results
  drill-down became a **multi-tag filter**: `st.tags[]` (was `st.tag`), each picked tag becomes a
  removable `.facet.tag` chip, results match **ALL** tags (`appendixResults(tags)` AND). A **＋ Filter**
  button re-opens the drill-down (with a ‹ Results back button + the existing chips shown for context);
  already-selected tags are hidden from the pick list. Removing the last chip returns to the drill-down.
  Handlers: `appendix-tag` (push), `appendix-rm-tag`, `appendix-add`, `appendix-done-adding`. jsdom
  `appendix_smoke.mjs` 14/14 (first tag, ＋Filter re-drill, AND narrows, chip removal, empty→browse).

## 2026-09-21 — session 4k (Threats advisor — realm properties + FG runes to avoid)
New **Menu → Threats** overlay (`openThreats`/`renderThreats`). Reads the build's THEME off its
taxonomy tags and surfaces the enemy modifiers that counter it, across BOTH systems that share the
"make the fight harder" shape — **Realm Properties** (Realm-Instability modifiers, rerollable to suit
your party) and **False God Runes**.
- **New durable extract** `_su_extract/data/model/realm_properties.json` (56 shipped / 58 total,
  `code/build_realm_properties.py`, reads the extracted `codex.csv` `L_RP_*` — authoritative effect
  text; display names curated/derived since no title key exists; 2 pure-comp neutrals RACE/FAMILIES
  dropped). Runes come from the existing `runes.json` (18).
- **Theme + counter model authored in `build-data.mjs`** and emitted as `SU_DATA.buildThemes` (11
  intents = Action/Mechanic taxonomy values: Attack / Cast / Indirect / Critical / Buff / Debuff /
  Dodge / Healing / Minions / Provoke-Defend / Stat-Stacking), `SU_DATA.runes` + `SU_DATA.realmProps`
  each carrying `counters:[themeKey]` (e.g. IMMUNEATTACKS→attack, IMMUNESPELLS→cast, NOCRIT→crit,
  REDUCEDCHARGES/SEALAFTERCAST→cast, RESISTDEBUFFS→debuff) and `counterClass` for the 5
  STRONGCLASS_* props. A build-time sanity check throws on any unknown theme key. Non-counter
  difficulty modifiers are flagged `general:true`.
- **App**: `detectBuildThemes()` tallies theme weight across all build effects (reuses
  `buildTagEffects`); auto-active = themes with ≥2 effects (fallback: the single top). Theme chip bar
  shows every theme with its detected weight; clicking one switches to **manual override** (explore
  "what counters a cast build") with a ↺ Detected reset. `heavyPartyClasses()` (≥2 creatures, fusion
  adopts secondary's class) drives the STRONGCLASS counters. Two sections: **Counters your build**
  (theme/class-specific, sorted by # hits, each row = source badge + name + effect + red theme chips)
  and a collapsible **Generally punishing** (theme-agnostic). jsdom smoke (`threats_smoke.mjs`, 24
  assertions): model shape, attack auto-detect, correct counter lists (attack shows Immune/Resist
  Attacks, not spells), general toggle, manual override + reset — all green; matrix/builds/asc suites
  still green. Shipped to `master`.

## 2026-09-21 — session 4j (Ascension perks visually distinguished)
Surfaced the `perk.ascension` flag (from `Perk_REF.csv`, 41 perks, ~1 per spec) in the two perk surfaces that
weren't badging it — the **spec perk list** (`specPerkListHtml`, used by the spec detail page AND the spec
picker's info panel) and the **Customize perk picker** (`renderPerkPicker`). Each Ascension perk now shows the
same gold **"Ascension" badge** already used in the Anointments overlay (reused `.anoint-badge.asc`, wrapped
with the rank/cost meta in a `.perk-line-meta` span) plus a **subtle gold left edge** on the row
(`.perk-line.asc` / `.perk-row.asc` → `box-shadow: inset 3px 0 0 var(--accent)`). Non-Ascension perks are
untouched. Minimal-chrome honored (a small badge + accent, no sub-labels/counts). jsdom smoke
(`asc_smoke.mjs`, 7 assertions): exact badge count == data on both surfaces, `.asc` accent class present, plain
perks not badged. Shipped to `master`.

## 2026-09-21 — session 4i (BUG FIX: perk→spec misattribution)
**User-reported: Animator showed several Defiler perks (Lingering Sickness / Hopelessness / Impiety) and was
missing its own (Dark Anima / Forbidden Magic / Masterpiece / Live to Serve).** Root cause: the code-derived
membership from `scr_PerkGetPerkList` (in `specializations.json`) leaks perks between specs — it was never
reliable (the extract's own notes flag code≠CSV diffs). **Fix: drive spec→perk MEMBERSHIP from the user's
authoritative `Perk_REF.csv`** instead. `build-data.mjs` now:
- builds a clean **name→key map from the full 661-perk catalog** (`perkKeyByName`, 0 collisions) to resolve
  each CSV perk (by name) back to its code key — needed for icon/desc/stats/taxo. 4 CSV typos aliased
  (Sovreignty→Sovereignty, Wrath→Divine Wrath, Red-eye Flight→Red-eye Fight); only "Purge" [Siegemaster] has
  no catalog entry (synthesised key, no icon — 1 perk).
- groups the CSV into `csvPerksBySpec` and, in the spec loop, uses CSV membership when the spec is listed
  (641/645 perks resolve to catalog keys), **falling back to code membership only for Antiquarian** (the one
  spec absent from the CSV). Anoint/Ascension flags come straight from the CSV row for CSV-driven perks.
- re-keys perk taxonomy by perk_key (`perkTaxoByKey`) so tags follow a perk to its corrected spec (the taxo
  file was keyed `spec_id:perk_key` under the *wrong* spec ids).
Verified: Animator 16 perks ✓, Defiler 19 ✓ (curses restored), Pariah/Siegemaster ✓ — all match the CSV;
two perks now display under the catalog's canonical spelling (Divine Wrath, Red-eye Fight). Regenerated
data.js; matrix (37) + builds (8) smoke suites still green. NOTE for future: perk membership is now
CSV-sourced — a game update needs a refreshed `Perk_REF.csv`, not a re-mine of `scr_PerkGetPerkList`.

## 2026-09-21 — session 4h (Builds sort + button cleanup + backlog)
- **Dropped the build name from the Builds footer button** — the "Update «name»" button now just reads
  **"Update"** (the selected tile already shows which build it targets; no more `«»` chevrons anywhere).
- **Builds sort control** — a segmented **Sort** bar (`.ovl-filterbar` + `.seg`) in the Builds overlay:
  **Last edited** (ts desc, default), **Name** (A–Z), **Spec** (spec label A–Z, then name). `sortBuilds(list,
  mode)` + `buildSpecLabel(b)`; state `ovState.sort`; `builds-sort` handler. Tiles now render via
  `sortBuilds(builds.slice(), st.sort)` instead of the hardcoded ts-desc.
- **Backlog** grew a "New helper / reference ideas" group: Realm Property helper, False God rune helper, Realm
  reference, God shop reference, Godforge helper, spell-gem icons in the Appendix, Macro helper.
- jsdom smoke (`builds_smoke.mjs`, 8 assertions): three sort buttons, default edited order, Name order, Spec
  order, and the Update button carries no name / no chevrons.

## 2026-09-21 — session 4g (Synergy Matrix: share-status colouring vs the Spec)
Recoloured cells/columns/totals by how each tag is SHARED across DISTINCT members (not by contribution
weight): **green = shared with the Spec** (spec + ≥1 other carry it), **yellow = shared among members but NOT
the Spec**, **red = only one member has it** (solo). Added `deg` (distinct-member count) + `specHas` set in
`synergyMatrixBody`; `shareClass(k)` = red if deg<2 else green if spec-has else yellow, applied to column
dots, member cells, and the Contributions total row. Numbers still show the contribution weight; colour is now
an independent signal. Filter reverted to **"Shared only"** (deg≥2, hides red) and meta counts "shared tags".
Added a compact **colour legend** in the matrix filter bar (Spec / Shared / Solo swatches, tooltipped).
**DESIGN INTENT — do NOT "fix" the sort:** sort stays by contribution WEIGHT (not colour), so a high-weight
**red** tag (one member stacking a tag many times, e.g. Evoker's 17× "Spell Gems", shared nowhere else) sorts
to the LEFT on purpose — that's the intended *poor-optimisation alert* ("you're not synergising this"). Colour
(cross-member share) and number/sort (theme strength) are deliberately independent signals; a red-left column
is a feature, not a bug. CSS:
new `.xc-spec/.xc-other/.xc-none` (green/brass/red) for cells + `.xref-colhead .xc-dot.*` backgrounds +
`.xref-legend`; retired `.xc-dot.sh` and the old `.xc-on/.xc-active`. Sub-rows stay dim (`xc-latent`). jsdom
smoke +colour checks (37 assertions: every filled cell & column dot & total matches its column's share status).

## 2026-09-21 — session 4f (Synergy Matrix: member cells always numeric)
Small polish: member/container cells (Spec / Anointments / Creature) now always show the numeric
contribution count — **"1" for a single contributor**, higher for a stack — instead of a "●" for 1. The dot
felt out of place next to the numeric stacks. **Dots stay on the collapsible sub-rows** (each is a single
effect → a dim "•"). Dropped the `mark()` helper; member cell renders `${n}`. jsdom smoke asserts member cells
are numeric (incl. "1") and sub-rows keep the dot (33 assertions).

## 2026-09-21 — session 4e (Synergy Matrix: creatures are containers of traits too)
Carried the container model through to creatures. A creature is now treated exactly like a spec/anoint row: a
**container whose counted units are its TRAITS** (+ equipped spell-gem spells), never the creature name.
Creature rows are **expandable to per-trait sub-rows** (caret "Expand traits"), and each trait contributes +1
to its tags — so "Brilliant Creation" is what's counted, not "Animatus". A fused creature's two-parent traits
each count separately. Refactor: `buildTagCarriers` gained an `addEffect(m, label, taxo, sub)` helper used
uniformly for perks / anoints / traits / spell-gem spells; the creature branch now pushes trait/spell children
(labels = trait/spell names, sub = "trait"/"spell gem") instead of just bumping counts. Functionally the
weights were already trait-level; this makes the attribution visible and consistent. jsdom smoke +creature
checks (30 assertions: creature caret, per-trait sub-rows, sub-row labeled by trait name not creature name).

## 2026-09-21 — session 4d (Synergy Matrix: weight by individual perk contributions)
The matrix summed at MEMBER grain, so a spec stacking 11 "Attack" perks counted the same (1) as a spec with a
single Attack perk. Fixed to **count each individual effect**: `buildTagCarriers` now stores a per-member
`counts` Map (tag → # of that member's perks/traits/spells carrying it). `synergyMatrixBody` sums those into a
per-tag **weight**; **each cell shows the contribution count** (a dot for 1, the number for a stack — e.g.
Evoker's "Spell Gems" cell reads 17), the sticky bottom **"Contributions"** row totals the individual
contributions per tag, and columns **sort by weight** so the heaviest themes float left. Cells/columns are
gold when a tag has ≥2 total contributions (reinforced), green when singular; the filter chip is now
**"Reinforced only"** (≥2 contributions) and the meta reads "N reinforced tags". Per-perk/anoint sub-rows are
unchanged (each is one effect → a dim "•"). The List view already counted individual effects, so it's
untouched and now consistent with the matrix. jsdom smoke +weighting checks (25 assertions, incl. spec-cell
stack count == data and Contributions ≥ that).

## 2026-09-21 — session 4c (Synergy: collapse/expand + jump links + drop noise tag)
- **Dropped `Effect Limitation::Does not stack`** from BOTH synergy views (`SYN_EXCLUDE`/`synTags` helper) —
  it's on hundreds of traits and never indicates a synergy. Scoped to Synergy only (still present in Appendix /
  ＋Filter). Applied in `buildTagCarriers` + `buildTagEffects`.
- **Matrix: all Anointments collapse into ONE "Anointments" row** (tags = union of equipped anoints), so a tag
  on 3 anoints now counts as 1 build source in the per-tag total, not 3. **Spec and Anointments rows are
  expandable** (▸/▾ caret, `matrix-expand-row`, `st.expanded` Set) → per-perk / per-anoint **sub-rows**
  (`.xref-subrow`, dim `xc-latent` "•" marks; sub-rows are informational, not counted in the sum). Creature
  rows unchanged. `buildTagCarriers` now returns members with an optional `children[]`.
- **List: groups are collapsible** (header is a `syn-toggle` button, ▾/▸ caret, `st.listCollapsed` Set) + a
  **jump-link bar** (`.syn-jumpbar`): a chip per shared tag (value ×count) that expands and `scrollIntoView`s
  that group (`syn-jump`), plus a **Collapse all / Expand all** toggle (`syn-collapse-all`, driven by
  `st.lastShared`).
- jsdom smoke rewritten (21 assertions): noise-tag gone, single collapsed Anointments row, spec/anoint expand
  → sub-rows with latent marks, independent expand state, list collapse + collapse-all + jump-expand-scroll.

## 2026-09-21 — session 4b (Synergy: flip the matrix + merge with the list)
Two changes to the just-shipped matrix, per user:
- **Flipped the axes** so we sum the *tags*, not per-contributor tag counts. Now **rows = build members**
  (spec / anoints / creatures, each with a kind-colored `.xr-dot`), **columns = tags** (vertical labels, gold
  `.xc-dot.sh` marker on shared columns). The sticky bottom **"Members" row sums each tag** — how many members
  carry it, the actual synergy strength — with ≥2 highlighted gold. (Old layout summed per member, which the
  user flagged as the wrong thing to total.)
- **Merged Tag Synergy + Matrix into one Menu entry, "Synergy"** (`open-synergy`). The overlay opens on the
  **Matrix** view with a **Matrix / List segmented toggle** (`.seg`/`.seg-btn`, `synergy-view` action) in the
  filter bar; List is the former per-effect grouped view (description + owner). "Shared only" shows only in
  Matrix view. Split the render into `synergyMatrixBody` / `synergyListBody` returning `{body, meta}`, shared
  chrome in `renderSynergy`; `buildTagCarriers` (members) + `buildTagEffects` (effects) both retained.
- Removed the separate "Synergy Matrix" menu item and the `open-matrix` handler. jsdom smoke rewritten
  (28 assertions): single menu entry, flipped orientation, per-tag sum row, gold/green cells, shared-only,
  Matrix↔List toggle, empty state — all green.

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

## 2026-09-24 — Extract reconciliation program (creatures + two-form owner model)
Deepened the trait owner model into a full **two-form** model and did a **creature census**, all
extract-grounded with provenance (user directive: reconcile everything from the extract; wiki OK for
MAPPING not for asserting PRESENCE; no inventing entities from the community-CSV source column).
- **Two-form owner model** (commit f3d5a94): every trait carries `owner`/`ownerType`(`creature`|`boss`)/
  **`ownerForm`**(`player`|`encounter`)/`ownerCategory`(`Avatar`|`Nether Boss`|`Deity`|`False God`|`Special
  Boss`)/`ownerGroup`(encounter)/`ownerProvenance`(`code`|`wiki`)/`itemSource`. KEY validated finding:
  **Deities == Avatars** — the 31 roster Avatar-race creatures ARE the 31 Gate-of-the-Gods deities, each with
  a DIFFERENT trait per form (player Avatar trait vs encounter Deity trait). Same as **Zantai** (player
  Quadhits #298) vs **Lord Zantai** (encounter "The Ultimate Strategy" #1538). So a creature owns one trait
  per form; 1:1 holds within a form. Dist: 1331 creature/player · 31 Avatar · 161 Nether Boss · 58 False God ·
  30 Deity · 1 Special Boss · 418 item-only · 0 gap. **Lord Zantai is NOT a separate creature** — he's the
  code-present roster "Zantai" in encounter form (wiki only maps the trait). Nether Bosses (0/36 in roster) +
  9 non-Caliban False Gods are encounter-only; Caliban is triple-form (Avatar+Deity+False God).
- **Creature census** (research + extract-grounded): 1362 playable (code) + 87 non-roster `creature_stats`
  extras = 66 False God parts (code+convention) · **10 NYI** (future False God set — Balcan/Xandor/Gorpin/…
  each tied to a False God per `lore_ref.json`; overworld sprite but null battle_frame) · **5 Orbs** =
  Caliban story-encounter creatures (NOT spells — they have creature stats) · **Failed Experiment** = Siralim-3
  legacy creature · **Relic** = unresolved · 4 CSV spelling-variants → corrected. Pandemonium K/Q + Treasure
  Golem are real roster creatures (not invented). LESSON: don't reclassify a creature as a spell on a name
  match; a creature with stat data is a creature.
- **4 CSV creature-name typos corrected at source** (commit 88179da): Manticore Conquerer→Conqueror,
  Phenominal→Phenomenal Possum, Maionette→Marionette Charlatan, Gloopidator→Gloopdiator (code-authoritative;
  `CREATURE_SPELLING_FIX`, dropped 4 redundant sprite overrides; sprites intact 1362/1362).
- **`creature_reconciliation.json` PERSISTED** (`_su_extract/data/model/`, generator
  `code/build_creature_reconciliation.mjs`): 1419 entities — 1362 Playable · 40 False God part · 10 NYI
  (each tied to its False God; **the NYI names are anagrams/letter-subsets of their False God** — Darboen=
  exact anagram of Nebodar — deliberate staged naming) · 5 Story Boss (Caliban Orbs) · 1 Legacy (Failed
  Experiment, Siralim 3) · 1 unresolved (Relic).
- **Phase B — UNRECONCILED trait revalidation (commit bdb8d03):** the 124 UNRECONCILED genuinely fail our
  recon params (0 creature owner, 0 item). VALIDATED (user caution) that 6 same-named "perks" are DISTINCT
  traits (different effects) — a name match ≠ identity, so NOT recategorized. **33 classified NYI-sandbox**
  (user-confirmed staged content found in the sandbox ~1yr ago + the 12 Zodiac "Sign of X"): Acclimation ·
  Brain/Hand/Heart of Misery · Breathe Underwater · Collapsed Dream · Damaos' ×3 · Hebron's ×4 · Leap of
  Faith · Reap Destruction · Serenade of Guilt · Siralim's Ascendance/Attunement/Prayer · Syndrome · Ultima
  · Zodiac ×12 (`NYI_SANDBOX_TRAIT_IDS`; moved Acclimation+Hebron out of unresolved-ownerless). Blacklist =
  3 dup + 33 NYI-sandbox + 12 unresolved-ownerless + 109 recon.
- **Phase B COMPLETE (user-classified the whole tail; commits 5ea7fcb, 4202077).** All 124 UNRECONCILED +
  12 ownerless resolved to a KNOWN category (no name-match/identity assumptions; only unresolved ids touched):
  - **legacy-S3 (90):** Itherian Artifact set (812–869) · Mage Perks (Nighttaker/Daybreaker/Death's/
    Damnation's Edge) · Multiply (Failed Experiment) · Crucifixion/Crucify Me (Misery boss) · Betrayer of the
    Code (The Unguided) · Corrupted God fights (Corrupted God/GET/Trait Disabled) · boss-innate Hearty/Very
    Hearty/Betrayer/Deceiver/Ascension · Nether-boss-innate (Torn Betwixt and Asunder, Boneyard and Sacrilege,
    Nasty Surprise!, Better to Receive, Maximum Hydration, Undead Army, Eager Recruit, Delusion, Vext's Grace).
  - **NYI (39):** 33 sandbox (+Zodiac) + Anathema/Poison Bath/Wishing Stick/Sorcerous Statue/Thunder God's
    Wrath + Stolen by Damnation's Edge (cut Animator feature).
  - **LIVE special/story bosses (+8):** Guided by Darkness→Erebyss Deity (2.0.17 replaced Absence of Light) ·
    Torun's Blessing→Treasure Golem 2.0 · Boon of the Hee Hoo Hay Ho→Imp Impington Prime (story) · IMMORTALITY/
    God of Dreams/Nightmares/Nether Orb/Orbs→Caliban story encounter. `Special Boss` category = 8 (Zantai +
    these). NEW STRUCTURE FACT: every Ultimate Nether Boss owns **3 same-named copies** of its trait
    (validated — some have 4–5 from dupes); Kraynaks has its 3 "Who Am I? None Of Your Business", so #1215
    "Who Am I?" is an outlier.
  - **STILL UNRESOLVED — just 3:** Pandemonium Unfairness (#898, tied to the Pandemonium K/Q shrine fight —
    user unsure) · Inner Demons (#969) · Who Am I? (#1215 outlier). `unresolved_traits.csv` regenerated 124→3.
  Final blacklist: 3 duplicate + 39 NYI + 90 legacy-S3 + 1 unresolved-ownerless + 16 recon; **2038 shipped**.
- **Phase C — Items (first pass, 2026-09-24).** `item_reconciliation.json` +
  `unresolved_items.csv` persisted (`_su_extract`, generator `code/build_item_reconciliation.mjs`). All
  **1862 materials categorized** (code-certain by shape): Trait material 1644 · Mastery Sigil 156 · Trick 47 ·
  Amber/Stat 15. **1719 reliably linked** to their granted trait (`source_item` / `Trait_REF`, possessive+
  plural tolerant). **81 unlinked** — no reliable item→trait source names them; `material_stats.trait_id`
  DRIFTS (wrongly guessed Ramses's Crest→"Coercion") so it's unusable, and there's NO Material/Item_REF
  compendium. The 81 are mostly redundant alt creature-trait materials (their trait already has a linked
  material) + some legacy/NYI boss items (Unguided/Misery/Itherian). Practical gap is small; needs in-game/
  compendium ground truth to link precisely. (User: leave the 81 unlinked — they map to excluded legacy
  traits; every live trait is matched or expectedly item-less.)
- **Phase D — Spells DONE (2026-09-24).** 747 code spells all shipped, **0 duplicates, 0 missing class**, no
  legacy/NYI/duplicate spells (code↔community are 1:1). Reconciliation fixes: the only 2 "orphans" were
  community-CSV spelling typos (Luscious Lager / Ignis Fatuus) → resolved via fuzzy match (0 no-source now);
  the 35 spells missing code charges (Morph set, etc.) filled from the community count (`chargesSrc` =
  code 712 / community 35 — code stays authoritative, Affliction 14 not 17). Compendium fields (Potency/
  Target/**Source**) now read straight from the user's `Spell_REF.csv` (verified 747/747 identical to
  spells_ref.json). Per-attribute provenance recorded. **The whole "reconcile everything" program (creatures/
  traits/items/spells) is now complete.**

## Backlog
### ⭐ HIGH PRIORITY — next session (2026-09-24)
- [x] **Resolve the missing item-backed trait sprites — DONE (2026-09-24, commit e993af5).** 18 item-backed
      traits (13 Nether-Boss **reward** items — Flubris/Phobos/Ramses/Kraynaks/Cyhra body parts; 4 Master
      **sigils** — Leeches/Sphinxes/Amphisbaenas/Unguided; 1 **treasure** — Perishing Salvo/Fading Garnet)
      rendered iconless. Root cause was a **join gap, not missing data**: every item IS in `material_stats`
      (item_class 2) with a real icon+sprite, but the consolidated `source_item` link was `undefined` for 7
      traits and used a mismatched possessive/plural spelling for others (`material_stats.trait_id` drifts ~1
      block, so it's unusable). Fix in `build-data.mjs`: a **`Trait_REF.csv` reconciliation pass** — resolves
      the authoritative CSV trait→item link to the game material name (possessive- + plural-tolerant `normP`/
      `normL`, plus `ITEM_ALIAS` for genuine CSV typos: Leeche→Leech, Faded→Fading Garnet, Cyhra's Adamance→
      Cyhra's Tattered Ear), scoped to truly-blank traits (no creature, no existing item), keying
      `traitIdByItemName` by exact material name so the existing loop emits icon+inherited-taxo. trait-item
      icons **1764→1782, 0 404-shipped**, cross-usage guards unchanged (2, pre-existing). **General, not
      hardcoded** — a future game update auto-resolves new boss-reward traits if the CSV + material DB carry them.
      **✓ Last 3 DONE (commit b7b5a0b) — new "duplicate" blacklist category.** "Master of Marionettes/
      Elementasaurs/Mirelings" (brand-new backer-paid races) each had TWO same-named trait entries: the
      current live trait on the `MASTER_<RACE>` key + an unused near-duplicate on the old `MASTEROF<RACE>S`
      key (differing desc AND `code_effects`). **User verified in-game the live trait is the HIGHER id**
      (#2179/#2183/#2184). Added `DUPLICATE_TRAIT_IDS {1996,1997,1998}` to `excludedTraitIds` under a new
      **`duplicate`** label (explicitly NOT `legacy` — new races, cause unknown, likely testing leftovers) +
      made the sigil→trait link skip excluded ids so each Sigil re-points to the surviving current trait and
      shows its `sigil_<race>` icon. Each Master = ONE correct row; 0 blank Masters; all 21 item-backed traits resolve.
      **⚠ PROCESS LESSON (validated the hard way — see the race-roster reconciliation):** do NOT auto-pick the
      "current" duplicate by CSV similarity or id-ordering. The full race-spine pass (164 creature races) proved
      153 map 1:1 to a Master trait, 8 are legitimately master-less (single-creature/special: Animatus, Avatar,
      Exotic, Guardian, Herbling, Mogwai, Purrghast, Tanukrook), "Master of Time" is a Treasure trait (not a race
      master), and ONLY these 3 races are ambiguous. `material_stats.trait_id` is BAD DATA (drifts ~1–2 blocks
      for ~100 races — never used). `Trait_REF.csv` was itself STALE for Marionette (its text matched the wrong
      id), so **in-game observation was the only true ground truth**. Always confirm the live tooltip before
      dropping a same-name duplicate; no blacklisting without user approval.
- [ ] **Duplicate-name traits (58 groups) — decide handling.** Surfaced while fixing the sprites: 58 shipped
      trait NAMES have ≥2 ids (19 identical-desc, 39 differing-desc). Most are the **Nether Boss (boss-owned)**
      "3-same-name convention" + **False God** body-part copies + **Gate of the Gods deity** traits (e.g.
      "Undying" ×5, "Crucifixion" ×2) — all blank, and they belong to the boss-only surfacing task below (no
      item icon; boss sprite/portrait). A handful are **player-facing** (the 3 Master duplicates above). Decide:
      dedupe/collapse duplicate rows in the Appendix by name, vs. surface boss-owned dupes at the bottom, vs.
      blacklist stale twins. Needs a taxonomy call (see the 4-way trait-source model: False God = body-part /
      Nether Boss boss-owned = no item, 3-same-name / Gate of the Gods deity = no item / Nether Boss reward =
      item-associated ← the only one that gets an item sprite, now done).
- [x] **Trait OWNER MODEL — DONE (2026-09-24, commit d38833d). Data foundation for #2 below.** Every shipped
      trait now carries a provenance-backed ownership model: `owner` / `ownerType` (`creature`|`boss`) /
      `ownerCategory` (`Nether Boss`|`Deity`|`False God`) / `ownerGroup` (the ENCOUNTER grouping 1:1 owners —
      a False God over its 6 body parts; "Judgment and Mercy" over the pair) / `ownerProvenance` (`code`|`wiki`)
      / `itemSource` (where the granting item is obtained). Coverage: **1362 creature · 249 boss (161 Nether
      Boss / 30 Deity / 58 False God) · 418 item-only · 0 unresolved-gap · 0 itemSource-null.** RULES (user, do
      not regress): ownership = **whose INNATE trait this is, strictly 1:1, never inferred** — every owner
      traces to a source; a trait with an item is item-only (owner=null) unless a *creature* holds it innately
      (so the 3 Ramses reward traits are item-only, boss link in `itemSource`). **Null owner AND null item =
      unresolved** → 17 boss-tagged traits in NO source excluded under a new `unresolved` reason (see the
      HIGH-PRIORITY item above). Provenance: creature=roster `traitId` (code); Nether Boss + Deity =
      siralimultimate.wiki.gg (Nether_Bosses + Gate_of_the_Gods, 180 exact validations); **False God =
      "[Body Part] of [False God]" convention** (owner=body-part creature via `creature_stats`, grouped by the
      False God — the wiki False-God pages DON'T name traits, so this is code-backed). `itemSource` from
      Trait_REF source col (the "Boss Trait Materials" reference — NOT ownership) + recon `obtained_from`
      fallback. `material_stats.trait_id` is drifted bad data (never used). Wiki source list preserved in
      `build-data.mjs` (`WIKI_NETHER`/`WIKI_DEITY`).
- [ ] **#2 — Appendix: surface boss-only traits (NOW UNBLOCKED by the owner model above).** Render
      `ownerType:'boss'` traits **at the bottom of the Appendix** grouped by `ownerGroup` (boss/False-God
      encounter) with the boss/False-God sprite (composites already in `assets/falsegods/`), and feed
      **per-boss detail pages** (Boss Guides). Item-only traits can show their `itemSource` ("dropped by …").
      No owner data is missing anymore (0 gap); the 17 truly-unresolved are excluded, not blank.

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
- [x] **Glossary icons** (2026-09-23): wired the in-game status glyph sets onto `D.conditions` — **65/65** —
      Buff→`stat_g_<name>`, Debuff→`stat_b_<name>`, Minion→`stat_m_<name>`, plus a small alias map for the
      CONDNAME→sprite-stem gaps (Stunned→stun, Mania→drunk, Repelling→splash). The `stat_m_` set covers the
      generic summons **and the 4 Horsemen** (Conquest/War/Famine/Death). The 11 Demonologist summons — the
      6 greater-demon sins (Asmodeus/Beelzebub/Belphegor/Lucifer/Mammon/Satanachia) + Brimfiend/Chaos Satyr/
      Fire Imp/Leviathan/Microbot — have no `stat_m_` glyph, so a full-base override routes them to the dedicated
      `m_<name>` portrait set (each sin gets its own icon rather than the shared generic `stat_m_innerdemons`).
      `assets/condicons/<cat>_<slug>.png`; rendered as `.gloss-icon`. Existence-gated so any future gap renders
      iconless without tripping the 404 guard. (Source-set details: `_su_extract/assets/ASSET_MAP.md`.)
- [ ] **Threat-set icons**: both threat sources have icons to wire onto the Threats page (per the Realm Props |
      False God toggle) — Realm Property icons (`realmprop_e_<slug>` sprites, ~32 exist but slug ≠ `L_RP_` key,
      so the join was deferred) and False God rune icons. Find/curate the joins like realm icons + realm objects.
- [ ] **Antiquarian anointment eligibility — VALIDATE**: Antiquarian (13 perks) isn't in `Perk_REF.csv`, so
      all its perks default to `anointment:false` and never appear in the Anointments overlay — but some are
      likely anointable in-game. Flagged in data as `perk.anointValidate:true` (build-data.mjs). Confirm which
      Antiquarian perks are anointable in-game, then set their anoint flag (needs a per-perk override since
      the CSV doesn't cover them).
- [x] **Realm object sprites** — DONE: 182/182 objects matched, 0 dupes (Abandoned Cave = `amg_chimera`).
- [ ] **Boss-prep planner element** — surface the boss/enemy trait taxo (`trait_meta.scope=boss_enemy_flavor`,
      already in `data.js`) as a "prepare for this fight / what to expect" view. Verify tags in-game first.
- [x] **Taxonomy of remaining surfaces** — DONE (session 4o): Realm Cards + Relics classified (LLM batch)
      → Appendix sections + ＋Filter; relics + nether spell-props counted in Synergy, cards excluded.
      (Nether stones derive taxo from socketed trait/spell contents at runtime.)
- [x] **Entity taxonomy detail** — DONE (2026-09-22): replaced the `nav-trait` `alert()` stub with a real
      detail overlay, generalized to trait/spell/perk/relic/card. Any Appendix result row (or trait banner)
      opens description + full taxonomy grouped by category with provenance chips; tap a tag → filter the
      Appendix by it. (`resolveEntity`/`entityTaxHtml`/`openEntityDetail`, return-stack to creature detail.)
      Optional follow-up: add "shared by N party members" to the trait view.
- [ ] DPS / effective-stat simulation from `damageModel` (spell & melee, crit/dodge, defending). Expose
      class-advantage multiplier as a toggle (unconfirmed in extract).
- [ ] **Revisit CSV-provenance data (harden vs code)** — several shipped fields come from the user's
      community compendium CSVs (`_raw_csv/*_REF.csv` / `*_ref.json`), NOT code, so they can be stale/wrong
      (recall Affliction CSV charges 17 vs code 14). Come back and re-ground them against the datamine /
      in-game where possible, or at least tag provenance in the UI. Known CSV-sourced fields today:
      **spell `potency`/`target`/`source`** (spells_ref.json — charges are already code), **god base-stat
      null-fills** (Creature_REF.csv, 14 creatures), **perk→spec membership + anoint/ascension flags**
      (Perk_REF.csv), **amber name→stat map** (user sheet). Audit each; prefer code, mark the rest.

### Later (P2)
- [ ] Spell-gem loadouts (potency tiers already in `damageModel`).
- [ ] Fusion palette / colour-combination picker (cosmetic).
- [ ] Save / load / share builds; multiple saved parties.
- [x] Turn on the Cloudflare analytics beacon (shared github.io token). DONE — beacon is in `index.html`
      and live on master (deployed 2026-09-23).

### New helper / reference ideas (2026-09-21 — user backlog)
- [x] **Realm Property + False God rune helper** — DONE (session 4k) as the combined **Threats**
      advisor: detects build theme from tags, surfaces realm properties + runes that counter it.
- [x] **Realm reference** — DONE (session 4q): Menu → Realms (denizens/resources/instability-tier objects + god-shop cross-link).
- [x] **God shop reference** — DONE (session 4q): Menu → God Shops (per-god items, type, favor price, description).
- [ ] **Godforge helper** — Godforge (spell-gem enchant / artifact forging) planner.
- [x] **Add spell-gem icons to the Appendix** — DONE (session 4n): class gem icon + charges·potency meta on
      each Appendix spell row; plus a spell-gem info panel (charges/potency/target/source).
- [ ] **Macro helper** — build/plan combat macros (action sequences / auto-cast ordering).
- [x] **Differentiate Ascension perks from normal perks** — DONE (session 4j). Gold "Ascension" badge +
      subtle gold left edge on the row, in the spec perk list (detail + picker info panel) and the Customize
      perk picker. Anointments overlay already badged them.

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
- 2026-09-24: **Fail loudly on missing sprites (removed the silent-hide fallback).** `spriteImg` no longer
  hides broken images (`onerror` was `this.style.visibility='hidden'` = silent blank, as bad as a 404). Now a
  broken/missing sprite gets `class="sprite-missing"` (unmissable red hatched outline, `!important` visible) +
  `console.error('MISSING SPRITE', src)`. Surfaces the 19 item-backed traits with no material icon loudly
  instead of rendering blank. (Resolving those 19 + Appendix boss-trait surfacing = high-priority backlog.)
- 2026-09-24: **Nether-boss bare-slot fix + blacklist NYI/legacy + only-live-traits ship.** Reconciliation
  now spans the full `traits_consolidated` universe (2186), so the same-name Nether-boss tier variants whose
  `passive_names` name was blank (e.g. Waking the Fallen 544/587, Undying 543/586) correctly resolve as
  **boss-owned** (they lack an item *because* they're boss-owned) instead of shipping status-less. Blacklist =
  {UNRECONCILED, Not Yet Implemented, legacy} + the lone unnamed fragment (EMBEROFVULCANAR): **2049 shipped /
  138 excluded**, 0 null-status, 0 dangling refs. boss-owned tag = 250. Image hygiene: **0 404-shipped**
  (asset guards + runtime onerror). Only remaining sprite gap = **19 item-backed traits** (master/reward/treasure)
  whose material-icon join is missing — render blank, NOT 404 (material-icon coverage gap, tracked separately).
- 2026-09-24: **Trait reconciliation wired into the build; UNRESOLVED traits excluded from the app.**
  `build-data.mjs` now reads `_su_extract/data/model/trait_reconciliation.json`: the **124 UNRESOLVED traits**
  (not present in live Ultimate — sandbox-unreleased or prior-game legacy) are **dropped from `SU_DATA.traits`
  entirely** (2063 shipped / 124 excluded; verified 0 dangling creature or trait-item refs). Every shipped trait
  now carries reconciliation tags: `obtainStatus` (creature_innate/master/reward/treasure/item/boss/legacy/NYI),
  `obtainSrc` (ID/community/wiki), **`bossOwner`** (214 — Gate-of-Gods + Nether-boss innate + False God parts) and
  `obtainedFrom` (15 — Nether-boss trait materials). Boss-owned tag now available in `data.js` for downstream use.
- 2026-09-24: **Trait guardrails (G1+G2) + 2 community mislabels fixed via code.** Added a G2 check to
  `build-data.mjs` (no innate trait may be owned by >1 creature). The code-backed reconciliation audit
  (`_su_extract/code/audit_trait_reconciliation.py`, universe = 2148 code passives, NOT the community CSV)
  surfaced the 2 remaining bad trait names, both corrected in `name_reconciliation.json` and now resolved with
  full synergy tags: **Lurid Masochist "Shrug Off" → Purge (393)** and **Shapeshifter Novice "Transformation
  Apprenticeship" → Rapid Learning (785)** (the old "→Apprenticeship" entry collided with Spider Occultist).
  App now: **G1 1362/1362 innate traits resolved · G2 0 collisions.** (G3/G4 full-universe reconciliation =
  93.99%; the 129 remaining are Nether-boss signature traits + tiers, tracked in `_su_extract`.)
- 2026-09-24: **Innate-trait resolution alert + name-reconciliation fix.** `build-data.mjs` now applies
  `_su_extract/data/reference/name_reconciliation.json` when resolving each creature's innate trait name→id
  (`resolveTraitId`), and **alerts on any playable creature whose trait is missing or unresolved** (warn +
  a prominent "innate-trait coverage: N/1362 resolved" summary line; gated by `--strict`). One-time pass found
  **7 creatures silently tag-less** due to community spelling variants — 6 now fixed via reconciliation
  (Ritual Abomination "Turn to Grey"→Gray, Fire Priest "Shepard"→Shepherd, Cerebral Vortex "Impedence"→Impedance,
  Trollboar "Trolboar"→Trollboar, Mireling Dart Frog "Scoundrel Strike"→Scoundrel's Strike, Shapeshifter Novice
  "Transformation Apprenticeship"→Apprenticeship). **1 genuine gap remains, now loudly flagged:** Lurid Masochist
  "Shrug Off" — not in the game trait DB under any spelling (community name likely wrong; needs the real in-game
  name added to name_reconciliation.json). Boss/non-player-trait groundwork this session lives in `_su_extract`
  (`BOSS_DATA.md`, `nonplayer_traits.json`) — not shipped in the app yet (prelim for Godforge + Realm-boss features).
- 2026-09-23: **Buff/Debuff/Minion glossary** (Menu → Glossary). 65 conditions with in-game prose, sourced from
  `_su_extract` vocabulary.csv `L_CDESC_{BUFF,DEBUFF,MINION}_*` (NOT the codex.json topics; names via
  labels.json `CONDNAME_*`), runtime tokens expanded in build-data → `D.conditions` [{cat,key,name,desc,icon,taxo,taxoSrc}].
  Overlay groups Buff(18)/Debuff(20)/Minion(27) with category filter + search. **Icons** (65/65) + **taxonomy**
  now wired (see below).
- 2026-09-23: **Condition taxonomy in the entity viewer.** Buffs/debuffs/minions are a 5th taxonomy surface —
  glossary rows are clickable → `openEntityDetail("condition", "<Cat>:<key>")`, rendering the same grouped
  taxonomy chips as traits/spells/relics. Tags = per-description classification pass vs the canonical
  `tag_taxonomy.json` (identity Related tag src=token + semantic tags src=llm; e.g. Agile→Dodge/More Dodge
  Chance, Berserk→Deal More Damage, Conquest→Apply a Buff). 65/65 tagged · 248 tags; every (cat,val) validated
  against the vocabulary and identity tags validated to exist on a real trait/spell. Generator:
  `_su_extract/code/build_condition_tags.mjs` → `condition_taxonomy_tags.json`; `build-data` attaches
  `taxo`/`taxoSrc`; app.js adds `CONDITION` map + `resolveEntity("condition")`.
  50 identity tags (4 Horsemen share one value). **15 niche minions get NO identity chip on purpose** —
  a corpus sweep of all traits+spells confirms 13/15 have zero references anywhere and the other 2 appear only
  in their own `Summon X` spell, so an identity chip would filter to nothing; they carry only semantic tags.
- 2026-09-22: **Riddle Dwarf** (Menu → Riddle Dwarf). One-screen fast trivia lookup for the in-game Riddle
  Dwarf: type the given name → answer surfaces instantly across all 4 forms — Class of [Spell], Class of
  [Creature], Ruler of [Realm], Realm of [Ruler] — grouped by answer type, prefix-matches first, class answers
  colour-coded + class icon. `openRiddle`/`renderRiddle`, `riddle-search` in the onInput registry. No menu
  navigation; reads D.spells/creatures/realms.
- 2026-09-22: **God Shops** rebuilt to the Realms stepped flow (full list → full detail, no info panel).
- 2026-09-22: **God battle sprites + more Realms polish.** Curated `GOD_BSPR` map (30 gods → `bspr_god_*`
  battle sprite; 8 by name, 22 theme/arena names user-dispositioned) → `assets/godbattle/`, emitted as
  `realm.godBattle` + `godShop.battle`. Shown in the **God Shop** (row + header) and on **realm pages**, where
  the **Realm|God sort toggle now also drives the icon** (Realm = realm icon, God = god battle sprite) on both
  list rows and the detail hero. Also wired the **complex-interaction combination tables** (Combination_REF.csv,
  5 realms) and added the **Threats Realm Props|False God source toggle** + **perk bookmarks** (Appendix/anoint/
  spec) with an anoint ★ filter. Backlog: threat-set icons.
- 2026-09-22: **Realm object sprites (item 6).** Joined breakable-object sprites to realm objects via a
  curated 30-realm acronym map (`REALM_ACRONYMS`) + word-slug matching + a hand-dispositioned
  `REALM_OBJ_OVERRIDE` (build-data.mjs), copied to `assets/realmobjects/`, shown as an icon per Realm-objects
  row. **181/182 objects matched, 0 duplicate sprite assignments** (audited — fixed 4 first-word slug
  collisions: Gears/Cards/Spider/Fae). Also renamed the realm ICON (`god_<name>` → `realm.icon`,
  `assets/realmicons/`). Validated via contact-sheet screenshots. 1 backlog outlier: Amalgam Gardens
  "Abandoned Cave" (no matching amg_* sprite found yet).
- 2026-09-22: **Realms reference overhaul.** Stepped page (list → full-screen detail, no split panel);
  **Realm | God sort toggle**; **god portraits** on every row + detail header (build-data copies the canonical
  `god_<name>` sprite 30/30 → `assets/gods`, emits `realm.godSprite`); **race icons** for roaming races
  (150/150) + encounters (67/70, text fallback); "Roaming creatures"→"Roaming races"; dropped 28 junk
  **"N/A" unique rows** (filtered in build-data); dropped the **"— Instability rewards"** header chrome.
  Deferred (nice-to-have): breakable environment-object sprite join (no clean object→sprite map). Taxonomy
  viewer also gained entry points: spec/anoint perk rows + relic overlay/creature-detail relic → taxonomy.
- 2026-09-22: **Artifact info panel — Bonuses | Sockets views + library UX.** Merged the artifact/gem library
  Equip/Unequip/Build into one context-aware button; removed auto-selection; tiles now carry an equip-state
  highlight (purple = this creature, gold = another/all-in-Menu) with a neutral selection ring (`.equip-grid`,
  decoupled from Builds' `.lib-grid`); gem tile re-click deselects; equipment grids show 6/row on mobile.
  Then split the artifact info panel into **Bonuses** (default) and **Sockets** (former "Contents") views via
  a pipe-delimited toggle (`art-view`): Bonuses = per-stat bonus table (core 5 as %, plus trick stats) +
  trait containers mirroring the creature detail (banner+desc, clickable to taxonomy) + spell-gem containers
  (name/desc/trigger). Native artifact spell trigger derives from type (`ART_TYPE_TRIGGER`: Helmet=On Provoke,
  Sword=On Attack, Staff=On Cast, Shield=On Defend, Boots=On Turn); nether-stone spells keep their stored
  trigger. Helpers `artifactBonusRows`/`artifactTraitContainers`/`artifactSpellContainers`/`artifactBonusView`
  reuse `artifactPctOf`/`PRIMARY`/`propGroups`. Verified headless (Sword→+118% Atk, On Attack native vs On
  Turn nether, toggle swaps to raw sockets).
- 2026-09-22: **Entity taxonomy detail** (backlog: real trait detail page, generalized). Clicking any Appendix
  result row — or any trait banner — opens a detail overlay showing that entity's description + its FULL
  taxonomy grouped by category, each value chipped with its provenance source (token/keyword/llm/phrase/field/
  correction). Tapping a tag jumps to the Appendix filtered by it. Reusable `resolveEntity(kind,id)` +
  `entityTaxHtml(e)` cover trait/spell/perk/relic/card (perk by `key`, rest by id); `openEntityDetail` keeps a
  return target so opening from the creature detail page returns there on close. Appendix rows made clickable
  (`apx-open`); `line()`/`traitRow` carry the `{kind,id}` target. Verified headless (row→detail→tag-jump; and
  creature-detail→banner→detail→close returns to creature). Replaces the `nav-trait` `alert()` stub.
  **Follow-up (same day):** per "all traits, wherever shown, open the taxonomy" — also wired `libTraitRow`
  (nether + artifact library panels), the artifact socket **preview** header (`art-pv-top`, "tags ›" hint),
  and the nether builder's socketed-trait **slot**. Nether-socketed traits were already reachable on the
  creature detail page (they flow through `slotTraitIds` → clickable trait banners). Synergy intentionally
  left as-is (its matrix already visualizes an object's full tag associations). Generalized `.apx-clickable`.
- 2026-09-22: **Macro Proposal — iteration 2 (extensibility refactor).** No behavior change — `proposeMacro`
  output verified **byte-identical** across a fixture covering every rule branch (headless diff, 54 lines).
  Extracted `MACRO_TUNING` (every threshold: heal %s, finishHp, buff/debuff floors, minionCap, aoeMaxThreshold,
  focusRotation), added `SPELL_OVERRIDES` (per-spell `{purpose,side,multi}` hook in `classifySpell`), turned
  the 12 inline rule blocks into an ordered `MACRO_RULES` array of `{key,when(x),lines(x)}` over a shared
  `macroContext(x)`; `proposeMacro` is now a thin iterator; `macroRoles(x)` split out; helpers `mLine`/`allyT`/
  `enemyT`. New **`MACRO_ENGINE.md`** documents the three modification surfaces + how-to. This is the
  foundation for spell-specific logic + target-priority work.
- 2026-09-22: **Macro Proposal — iteration 1** (user feedback). (1) **Gems-only**: `gatherSlotSpells` now uses
  ONLY equipped spell gems — artifact Spell-slot + Nether-Stone spells auto-proc and can't be cast by a macro,
  so they're excluded. (2) **Fuller coverage** toward the 32-line cap: emergency (<25%) vs sustained (<50%)
  heal thresholds, squishy-caster self-preserve turtle, finish-the-kill lines, a FOCUS_ROTATION giving each
  damage gem a distinct target priority (lowest Max HP / highest Atk / highest Int / lowest Def / highest Max
  HP), escalating AoE enemy-count thresholds; trimmed to 32 with a note when a kit overflows (`MAX_MACRO_LINES`).
  (3) **Moved out of the creature detail panel** into its own **Menu → Macros** overlay (below Threats):
  party creature selector (`macro-crea`) + the selected creature's proposal, framed as "set default action =
  Macro, hold to auto-battle" (`openMacros`/`renderMacros`). Verified headless (detail has 0 macro sections;
  2-creature selector switches; richer line sets). Roadmap items 1–4 (named status, knobs, classification,
  spec/anoint context) still open.
- 2026-09-22: **Macro Proposal engine.** Predicts a creature's in-game battle-AI Macro from its loadout so
  players can automate battles (default action = Macro). `proposeMacro(slot)`: `gatherSlotSpells` (gems +
  nether-stone spells + artifact spell) → `classifySpell` (purpose/side/breadth from taxonomy: rez/heal/
  damage/debuff/buff/provoke/defend/summon; single vs multi) → ordered lines: rez→heal→provoke→buff→debuff→
  summon→AoE→focus-fire (Barrier-guarded chain, lowest Max HP)→basic attack (Shell/Barrier-guarded, lowest
  Defense)→guaranteed fallback. Rendered as a "Proposed Macro" section on the creature detail page (role
  chips, per-line rationale, chain indentation, Copy-to-clipboard). Grounded in the decompiled `scr_Macro*`
  system (+`L_MACRO_*` localization) → `_su_extract/data/model/macro_vocab.json` (10 targets/67 conditions/8
  actions) bundled into data.js as `macroVocab` via build-data.mjs. Verified end-to-end with headless Chrome
  (heal+debuff+AoE+single-damage loadout → correct 6-line brain, roles Healer/Debuffer). Full model:
  `_su_extract/code/MACRO_MODEL.md`. Backlog: buff/debuff NAME detection (gate on the specific status);
  spec/anointment-aware role hints; import/export in the in-game save format.
- 2026-09-22: **Appendix bookmarks.** Star toggle on Appendix trait + spell result rows (`bkBtn`, action
  `apx-bookmark`). Bookmarks = scratch state for the ACTIVE build only (`bookmarks {traits[],spells[]}`,
  LS key `subc.bookmarks`); cleared on Reset (`clear-party`) and on loading a saved build (`builds-load`).
  A "★ Bookmarked" facet appears — only when bookmarks of that kind exist — in the creature picker (traits,
  `crea-bkonly`), spell-gem builder spell step (spells, `sgb-bkonly`), and the artifact builder trait/spell
  pickers (`artb-bkonly`, reset on picker-category switch). Verified end-to-end with headless Chrome (mark →
  facet appears → 400 tiles narrow to the 1 creature with that innate trait; Reset clears). Next: macro helper.
- 2026-09-16: Scaffolded the project via build-calc-planner. Wrote `build-data.mjs` (joins creature_data +
  creatures_ref + sprite index + theorycraft tags + artifacts/relics/cards/materials; hygiene guardrails),
  the vanilla SPA (`index.html`/`styles.css`/`app.js`) with the full overlay/trait/stat house style, and the
  planning docs. P0 expanded to include artifact/relic builders + nether library + card collection. Palette:
  SU indigo + gold with 5 class accents. Verified P0 flow on `tools/serve.mjs`, then `git init` + initial commit.
