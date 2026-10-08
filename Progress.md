# Siralim Ultimate Build Calculator — Progress (current state)

**This file is the current state only.** Changes go in `CHANGELOG.md` (newest first), open work in `BACKLOG.md`.
Restructured 2026-10-08; the previous 219 KB version is kept verbatim in `archive/Progress_until_2026-10-08.md`.

## LIVE
Deployed at **https://misterwtheface-oss.github.io/su-build-calc/** (repo `misterwtheface-oss/su-build-calc`,
Pages on `master`/root, Cloudflare analytics active with the shared github.io token). Auto-deploys on push.
No verify-before-push ceremony (no real users yet) — but every change is checked with the jsdom smoke suite
(scratchpad `smoke.mjs`, ~84 assertions across all flows) before commit.

### ⚠ Cache-bust is ENFORCED by a git pre-commit hook (do not bypass)
The service worker serves `app.js`/`styles.css`/`data.js` **cache-first**, keyed by their `?v=` token
(only `index.html` is network-first). So editing a sub-resource without re-stamping its `?v=` ships a
stale asset ("nothing changed after deploy"). The stamp logic lives in **`tools/stamp-cache.mjs`** (single
source of truth), called by both `build-data.mjs` and the **`.githooks/pre-commit`** hook — which re-stamps
`index.html` (`?v=`) + `sw.js` (`BUILD`) and re-stages them on **every commit**. One-time per clone:
`git config core.hooksPath .githooks`. Don't commit with `--no-verify` (skips the stamp).

## Session checklist
- Start: read this, then `BACKLOG.md`; check `_su_extract/code/HANDOFF_*.md` for extract-side hand-offs.
- Data comes from `_su_extract` via `node build-data.mjs` (never ship the extract; only `data.js` + copied assets).
- End: one entry at the top of `CHANGELOG.md`; add/remove items in `BACKLOG.md`; update this file only if the feature map
  or a rule changed.

## Docs in this repo
- `Progress.md` — this file: live/deploy rules, feature map, known data limitations.
- `CHANGELOG.md` — every change, newest first.
- `BACKLOG.md` — the only open-work list.
- `DECISIONS.md` — standing user rulings on how the app models the game (check before "fixing" behaviour).
- `EFFECT_ENGINE.md` — the effect engine (rule shape, code tier from `_su_extract` effect formulas).
- `TAXONOMY.md` — taxonomy categories, values, grounding rules (keep in sync with `correctTaxo` in build-data.mjs).
- `BUILD_IO.md` — build import / export format.
- `MACRO_ENGINE.md` — Macro Proposal engine surfaces.
- `SPEC_PLAN.md` — original data model (2026-09-16). `WIKI_CONTEXT.md` — original pipeline/context tree (2026-09-16).
- `README.md` — public readme.
- `archive/` — pre-2026-10-08 Progress.md.

## Feature map
### Snapshot as of 2026-09-24 (verbatim)
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

### Shipped since 2026-09-24 (headings from CHANGELOG.md; details there)
- 2026-10-08 — data notes (bullets)
- 2026-10-07 — `hasRoll` flags (data only)
- 2026-10-06 — UI batch (libraries, selection, icons, Realms Objects)
- 2026-10-06 — Multi-Target Spells rule
- 2026-10-06 — Critical Count / Dodge Count
- 2026-10-06 — Missing creatures, action counts, Gain a Perk
- 2026-10-06 — Loses Buff/Debuff triggers; Timeline outliers
- 2026-10-06 — formulas S16 folded in
- 2026-10-06 — S17 review applied; Timeline vs Turn Counter
- 2026-10-05 — Build Import / Export (see BUILD_IO.md)
- 2026-10-05 — taxonomy S17: remaining LLM tags decided from code
- 2026-10-05 — spell gem compatibility, code card thresholds, Projects overlay (S18 adoptions)
- 2026-10-05 — code-vs-text clarifications (Touch of Chaos, Counterspell, Spell Blast)
- 2026-10-05 — Molecular Betrayal + stat rounding PROVEN in-game
- 2026-10-05 — formulas S14 folded into the code tier
- 2026-10-05 — S15 adoptions: trait-item code links, artifact tier slots, rune rewards
- 2026-10-05 — stats rounded like the game (code-decoded)
- 2026-10-05 — decoded formulas conform to the effect engine (code tier)
- 2026-10-04 (cont.) — FIX: building a gem from a creature lost the equip context
- 2026-10-04 (cont.) — FIX: artifact "Spell Gem Slots" didn't add creature spell slots
- 2026-10-04 (cont.) — Creature Spells page
- 2026-10-04 (cont.) — Relic rank slider steps by 1
- 2026-10-04 (cont.) — FIX: {SPELL_*} tokens rendered as "Equipment" / "Alcohol" / "Ultimate"
- 2026-10-04 (cont.) — Spell Gem levels + property amounts (code-grounded)
- 2026-10-04 (cont.) — Sort toggles flip direction
- 2026-10-04 (cont.) — One spell picker for all three wizards + "Self" target
- 2026-10-04 (cont.) — Spell Gem wizard: sort + Target/Class filters
- 2026-10-04 (cont.) — FIX: search text duplicated on phones ("Aft" → "AAftAftAft")
- 2026-10-04 (cont.) — Nether Stone loadout exclusivity
- 2026-10-04 (cont.) — UI hygiene batch
- 2026-10-04 — Effect engine (invisible backend refactor; no UI change)
- 2026-10-04 — taxonomy S9 (layer 11) shipped
- 2026-10-04 — taxonomy review S7 (A–E) applied
- 2026-10-02 … 2026-10-04 — taxonomy code-grounding passes (#5; moved from the backlog 2026-10-08)
- 2026-10-01 (night 4 → session close) — "runtime-only" systems cracked from static code + UI polish
- 2026-10-01 (night 3) — Asset mappings converged on code + level-aware artifact icons
- 2026-10-01 (night 2) — Spell-gem property icons + gods from code
- 2026-10-01 (night) — Shop currencies from code
- 2026-10-01 (eve) — Unified Shops overlay (code-grounded)
- 2026-10-01 (late) — Wardrobe runtime ids + exact game names
- 2026-10-01 (pm) — 100% CSV agreement, code anointments, code costume tiers
- 2026-10-01 — Code-grounded specs, perk effects, runtime ids + shops data (no UI change)
- 2026-09-30 — true passive ids + Misery (NYI) behind a flag
- 2026-09-28 — UI pass 3 (appendix/riddle/glossary/god-shops/realms/artifact/cards/builds)
- 2026-09-28 — SW cache fix + UI pass 2 (build creation, sorts, synergy, threats, riddle, perk filter)
- 2026-09-28 — UI pass (sortbar, info panels, category bars, anoint gaps, animated wardrobe)
- 2026-09-28 — Appendix polish: bookmark button, left icon columns, item-only section
- 2026-09-28 — Spell Gems: Opal class-swap, same-class equip rule, wizard/library UX
- 2026-09-28 — LLM-taxonomy audit + canon-status validation + fusion-step delta bars
- 2026-09-28 — Appendix: collapsible category filters + bookmark scope

## Known data limitations
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
  **Update 2026-10-01:** Nether Stone numerics are code-grounded (`inv_NetherStoneCreate`). **Update 2026-10-08:** class
  advantage is code-known too (×2 / ×0.5, `_su_extract/code/CLASS_ADVANTAGE.md`); only the in-game confirmation is open (BACKLOG).
