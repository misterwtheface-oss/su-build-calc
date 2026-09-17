# Siralim Ultimate Build Calculator — Progress

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
- **415/1447 creatures have no class** (`cls: null`). The code-authoritative `creature_data` spine (1447)
  is larger than the collectible `creatures_ref` (1362), and the ~415 unmatched are non-standard/internal
  entries (generic names: "angel", "spirit", "priest", "paragon") that also lack a classed trait
  source_creature → unclassifiable from static data. They render with a "—" class (no stripe/filter).
  **P1 idea:** recover class via a trait-name join or the bosses table. 1032 have a class (ref + trait fallback).
- **10 creatures without a battle sprite** (null `battle_frame`, e.g. "Nalesath") → placeholder tile.
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
