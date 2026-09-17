# Siralim Ultimate Build Calculator — Spec Plan

## Purpose
A theorycraft sandbox for Siralim Ultimate players: assemble a party of 6 creatures + a
specialization, fuse creatures, build artifacts/relics, socket personal Nether Stones, and toggle
owned realm cards — and see faithful, code-grounded stat results (and, later, a DPS simulation and a
synergy cross-reference matrix) without running the experiment in-game.

## Data model (`window.SU_DATA`, emitted by `build-data.mjs`)
- **creatures** (1447) — `{id, name, race, cls, hp, atk, def, int, spd, total, traitId, traitName, sprite}`.
  Stats + `battle_frame`→sprite are code-authoritative (`creature_data.json`); `cls`/`race` joined by
  name from `creatures_ref.json`; innate `traitId` is community-sourced.
- **specs** (39 named) — `{id, key, label, sprite, playstyle, perkCount}`. Sprite = `spec_<key>` PNG
  (a small alias map covers Sorcerer/Rune Knight/Defiler).
- **traits** (2187, id-keyed) — `{id, name, desc, cls, produces[], consumes[], labels[], stats[]}`.
  The **association layer**: `desc` from `traits_consolidated.json`; edge tags from `theorycraft_tags.json`.
  Colour = the source creature's class colour (data-driven, via `--aff-color`/`--aff-text`).
- **tagLabels** — `theorycraft_tags.label_map` (produces/consumes plain-language phrases) for the future matrix.
- **artifact** — `{primary[5], stat[25], trick[47]}`; each property `{property, stat, unit, perRank{1..50}}`.
  Percentages parsed to numbers. An artifact is a **container**: 1 primary + N properties + trait/nether sockets.
- **traitItems** (1830) — `{id, name, traitId, traitName}`; slot into an artifact's trait slots to grant a trait.
- **relics** (31) — `{id, name, statBonus, ranks[{rank, desc}]}`. Effects are qualitative (no clean stat number).
- **cards** (141) — `{id, family, tiers[], effects[]}`. Realm cards, toggled via the collection.
- **damageModel** — spell/melee/crit/dodge/defending constants for the DPS sim (P1).

### Relationships
- A **slot** = `{cid, fusion, artifact, relic}`. Fusion (`cid` + `fusion`) → averaged base stats, secondary's class, both traits.
- An **artifact** = `{rank, primary, props[], traitItemIds[], netherIds[]}` — contributions fold into the creature's stat total.
- A **Nether Stone** = user-entered `{id, name, rarity, lines[]}` (numeric table is runtime-only in-game → user supplies it).

## Architecture
- Stack: vanilla HTML/CSS/JS; data compiled to `window.SU_DATA` by `build-data.mjs`.
- Data flow: `_su_extract/data/**` + sprites → `build-data.mjs` (+ hygiene guardrails) → `data.js` + `assets/` → `app.js`.
- Persistence: `localStorage` under `subc.*` (`subc.build` schema 1, `subc.cards`, `subc.nether`).
- UI: build-first home; `#overlay-root` (selectors) + `#detail-overlay-root` (detail) two-layer overlays;
  statically-sized panels; `refreshOverlay` preserves scroll; event delegation on `document`.

## Core mechanics reproduced (grounding)
- **Fusion** (`codex.json` CREATURES_FUSION): offspring base = per-stat **average** of both parents;
  class = **secondary** parent's; traits = **both** parents' (+ artifact trait slot). Sprite = primary's body.
- **Artifact primary/stat %**: `stat_final = round(base × (1 + Σ%⁄100))`; primary = `rank+9`% (10%@1 … 59%@50).
- **Damage** (future DPS): spell = `round(potency%×Int) − Def×(1−pen)`; melee = `f(Attack) − Def` (subtractive);
  crit/dodge scale off Speed; defending = −35% dmg / +50% Def. (`damage_model.json`.)

## Feature plan (prioritized)
### P0 — baseline (this session; runnable + testable) ✅
- [x] Build-first home: 6 creature slots + specialization slot
- [x] Creature selector overlay (class filter, search, sprites, stat identity panel)
- [x] Specialization selector overlay (spec sprites, playstyle)
- [x] Fusion (secondary-parent picker → averaged stats, secondary class, merged traits)
- [x] Per-creature detail overlay: **stat table** (Base · Artifact · Total, capped/pos-neg colours, highlight tiers)
- [x] **Artifact builder** overlay (primary + properties + trait slots + nether sockets + rank slider)
- [x] **Relic** builder overlay (pick relic + rank, per-rank effects)
- [x] **Nether Stones** library (user-entered, `localStorage`, socketable)
- [x] **Realm Cards** collection (owned + on/off toggles, `localStorage`)
- [x] Party persistence; scroll-preserving re-renders; mobile reflow

### P1 — core value (next sessions)
- [ ] **Trait cross-reference matrix** — party creatures × produces/consumes tags (CSS already shipped);
      column glyphs (● on / ◆ active / ○ latent), Shared summary row, latent conditionals excluded.
- [ ] **Full trait detail page** (replace the `nav-trait` alert): effect, tags, source creature, which party members share it.
- [ ] **DPS / effective-stat simulation** using `damageModel` (spell & melee, crit/dodge, defending, class advantage*).
- [ ] Cards/Nether/relics feed the synergy matrix (produces/consumes edges), not just equip.
- [ ] Perk-tree picker per specialization (`specializations.json` perks[] + perk icons).

### P2 — nice-to-have
- [ ] Spell-gem loadouts per creature (`spell_stats.json`, potency tiers).
- [ ] Fusion palette / colour-combination picker (cosmetic; `creature_palettes.json`).
- [ ] Synergy recommendations ("this card consumes Poison, which 3 party members produce").
- [ ] Save / load / share builds (URL or code), multiple saved parties.
- [ ] Analytics beacon on at public release.

## Open questions
- **Class-advantage multiplier** is unconfirmed in the extract (`[1.25 or 1.5]`, needs 1 in-game observation) —
  the DPS sim must expose it as a toggle/assumption, not hardcode.
- Relics: in-game the player equips relics at the party level, not per-creature. We follow the user's
  request (per-creature relic slot); revisit if party-level modelling is wanted.
- Nether Stone numeric stat table is runtime-only in-game → intentionally user-entered here.
