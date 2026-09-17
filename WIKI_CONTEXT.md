# Siralim Ultimate — Wiki / Context Tree

LLM-oriented context for resuming without re-datamining. Full datamine detail lives in
`../_su_extract/CONTEXT_MAP.md` and `RESUME.md`.

## Game basics
Siralim Ultimate is a monster-taming roguelike RPG (Thylacine Studios, GameMaker Studio 2 **YYC**).
You command a party of up to **6 creatures**, each with a class, race, 5 stats
(Health/Attack/Intelligence/Defense/Speed), and one **innate trait**. The player has a
**Specialization** (class, e.g. Necromancer) that provides a perk tree. Deep buildcraft: fusion,
artifacts, relics, spell gems, realm cards, Nether Stones, anointments.

## Key mechanics (for the calculator)
- **Stats** — Health = HP pool; Attack = melee damage; Intelligence = spell potency; Defense =
  subtractive mitigation (spells penetrate a % by potency tier); Speed = turn order, dodge, crit.
- **Fusion** (codex CREATURES_FUSION, code-grounded): fusing two creatures yields an offspring with the
  **average base stats of both parents**, **both parents' traits**, and the **secondary parent's class**.
  Body = primary's sprite, palette = secondary's. → we average per-stat, take the secondary's class,
  and merge trait ids. This is the crux of "calculate fused base stat totals accurately."
- **Traits** — each creature has one innate trait; a creature can gain **one more** via its artifact's
  trait slot. Traits are the association layer (synergy). Effects live in prose + code edge tags
  (produces/consumes). A trait's colour = its source creature's class.
- **Artifacts are containers, not stat records** (`_su_extract/code/ARTIFACT_MODEL.md`). Each has 1
  **primary** stat slot (`rank+9`%: 10%@rank1 … 59%@rank50), plus **properties** and **trait slots**
  populated by slotted objects. We model: primary (5) + properties (25 stat + 47 trick) + trait-item
  slots (1830 items → grant a trait) + Nether sockets. Only Health/Attack/Defense/Intelligence/Speed
  properties change the base stat table; trick properties (crit, dodge, elemental, on-damage procs)
  are for the future DPS sim.
- **Relics** — 31 god relics, per-rank (10–50) effects. Effects are **qualitative text**, not a stat
  number, so relics show as an equipped panel of effects, not a stat column.
- **Nether Stones** — endgame items whose numeric stat table is **runtime-built** in-game (not
  statically extractable). Per the datamine, a stone draws from the artifact property pool, unrestricted.
  → the calculator has the user **enter their own stones** (name, rarity, property lines) and stores them.
- **Realm Cards** — 141 families, 3 unlock tiers each. Global build modifiers; user toggles owned/on.
- **Class advantage** damage multiplier is **unconfirmed** in the extract (`[1.25 or 1.5]`) — treat as an
  exposed assumption in any DPS work, never hardcode.

## Data sources & datamine access
- Datamine workspace: `../_su_extract/` (**NOT shipped** — gitignored). Read its `RESUME.md` first.
- Regenerate calculator data:
  - `node build-data.mjs` → reads `../_su_extract/data/model/**`, `data/reference/**`, and sprite exports;
    joins them; **copies only used sprites** into `assets/creatures/` + `assets/specs/`; runs hygiene
    guardrails; writes `data.js` (`window.SU_DATA`). `--strict` promotes warnings to errors.
- Which extract files feed the model:
  | data.js field | source (`_su_extract`) |
  |---|---|
  | creatures | **spine** `data/reference/creatures_ref.json` (playable roster: class/race/base-stats/trait, all 1362) enriched by `data/model/creature_data.json` (capstone stats + battle_frame) and `data/model/creature_stats.json` (legacy; `field0` = the `spr_crits_battle` frame, covers 1358/1362). Sprite = `assets/sprites/spr_crits_battle_<frame>.png` |
  | traits | `data/model/traits_consolidated.json` (name/desc/class) + `data/model/theorycraft_tags.json` (edge tags) |
  | tagLabels | `theorycraft_tags.json` → `label_map` |
  | specs | `data/model/specializations.json` + `assets/sprites/spec_*.png` |
  | artifact | `data/reference/artifacts_ref.json` |
  | traitItems | `data/model/material_stats.json` (records with a `trait_id`) |
  | relics | `data/reference/relics_ref.json` |
  | cards | `data/reference/cards_ref.json` |
  | damageModel | `data/model/damage_model.json` |
- What ships vs. gitignored:
  - **SHIPPED**: `data.js`, `assets/creatures/*.png` (1355), `assets/specs/*.png` (39), app code.
  - **GITIGNORED**: the entire `_su_extract` workspace (raw dumps, decompiled source, full sprite exports,
    the 4–5 MB model JSONs) — only the subset in `data.js` is tracked.

## Data model reference
The authoritative field-by-field shape is `SPEC_PLAN.md → Data model`. `build-data.mjs` is the single
source of truth for how each field is derived and which references are hygiene-checked (dangling trait
ids, missing sprites, unknown artifact slots, duplicate creature ids).

## Known extract limitations carried into the app
- 7 creatures have no battle sprite (frame `null` or the `6969` sentinel; gods/specials) → class-tinted
  monogram fallback. The other 1355/1362 have their real `spr_crits_battle` sprite (recovered via
  `creature_stats.field0`). 4 creatures fall back to community base stats.
- 15 trait-items grant `trait_id 2187` (off-by-one past the 0–2186 range) → no resolved trait; the
  item's own `trait_name` is still shown (hygiene warning).
- Nether Stone numerics, class-advantage multiplier, sigil/anointment scaling = runtime/in-game-only
  (documented as open in the extract). The calculator models around them (user-entered / exposed toggle).
