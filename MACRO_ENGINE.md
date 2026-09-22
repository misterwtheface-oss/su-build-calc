# Macro Proposal Engine

The engine that predicts a creature's in-game battle-AI **Macro** from its loadout (Menu → Macros). It reads
a party slot, classifies each equipped spell gem, and emits an ordered list of macro lines the player can
replicate in the in-game editor. All code lives in `app.js`; the in-game macro system it targets is
documented (grounded in the decompiled `scr_Macro*`) in `_su_extract/code/MACRO_MODEL.md`, and the raw
vocabulary ships as `D.macroVocab` (from `_su_extract/data/model/macro_vocab.json`).

## Pipeline (each stage is a separate function you can change in isolation)

1. **`gatherSlotSpells(slot)`** → the spells the creature can actually cast in a macro = its equipped
   spell **gems only**. Artifact Spell-slot and Nether-Stone spells auto-proc and can't be cast manually,
   so they're excluded here.
2. **`classifySpell(sp)`** → `{ sp, name, purpose, side, multi }`. `purpose` ∈ `rez · heal · damage ·
   debuff · buff · provoke · defend · summon · other`, derived from the spell's taxonomy, then overridden by
   `SPELL_OVERRIDES`.
3. **`macroContext(slot)`** → `x`, the object every rule reads: grouped spells (`by(purpose)`, `heals`,
   `dmg`, `singleDmg`, `aoe`), stat flags (`dom`, `tanky`, `squishy`, `physical`, `canAttack`),
   `hasTauntTrait`, and the tuning object as `x.T`.
4. **`MACRO_RULES`** → an ordered array of rules; `proposeMacro` runs each whose `when(x)` is true and
   concatenates its `lines(x)`, then trims to `MACRO_TUNING.maxLines`.
5. **`renderMacroProposal` / `renderMacros` / `macroProposalText`** → presentation + copy. No logic.

## The three surfaces you modify

### 1. `MACRO_TUNING` — thresholds
Every magic number in one object. Percentages are % Health; counts are creature/status counts.

| Key | Meaning |
|---|---|
| `maxLines` | in-game macro line cap (32, `scr_MacroIsLegal` `0x20` guard) |
| `healEmergency` / `healSustain` | % Health for the emergency vs top-up heal lines |
| `finishHp` | % Health for "finish the kill" (spell + basic attack) |
| `selfPreserveHp` | % Health a squishy caster with no heal defends below |
| `buffFloor` / `debuffFloor` | cast a buff/debuff on a target with fewer than this many buffs/debuffs |
| `minionCap` | summon while the creature has fewer than this many minions |
| `aoeMaxThreshold` | AoE enemy-count gate escalates per extra AoE gem, capped here |
| `focusRotation` | ordered `{ cond, why }` target priorities; each single-damage gem cycles through them |

### 2. `SPELL_OVERRIDES` — per-spell logic
Keyed by spell **name**; forces `{ purpose?, side?, multi? }` for spells the taxonomy mislabels or that need
bespoke handling. Empty by default. Example: `{ "Antidote": { purpose: "cleanse" } }`. This is the hook for
"encode specific logic for some spells" — extend `classifySpell` and add rules for any new `purpose` you
introduce here.

### 3. `MACRO_RULES` — the line logic
An ordered array; **array order = macro priority** (first matching line acts in-game). Each rule:

```js
{ key: "heal-emergency",
  when: x => x.heals.length,                                   // gate
  lines: x => x.heals.map(s => mLine(                          // returns [{en, why, chain}]
    `If any ally has < ${x.T.healEmergency}% Health, cast ${s.name} on ${allyT(s)}`,
    `${s.name} — emergency top-up before an ally dies`)) }
```

Helpers: `mLine(en, why, chain)` builds a line (`chain: true` = "test next line", rendered indented);
`allyT(s)` / `enemyT(s)` pick `"that creature"` vs `"ally (all)"` / `"enemy (all)"` by `s.multi`.

Current rules, in order: `rez · heal-emergency · self-preserve · provoke-spell · provoke-tank ·
heal-sustain · debuff · buff · summon · aoe · damage-single · basic-attack · fallback`.

## How to make common changes

- **Change a threshold** → edit `MACRO_TUNING` (one place; used everywhere).
- **Reorder / disable a rule** → move or delete its entry in `MACRO_RULES` (or gate its `when`).
- **Add a rule** → push a `{ key, when, lines }` object at the right priority position.
- **Change targeting** → edit `MACRO_TUNING.focusRotation`, or add lines using any condition from
  `D.macroVocab.conditions` (the grounded predicate list).
- **Special-case a spell** → add it to `SPELL_OVERRIDES`; if it needs a new `purpose`, handle that purpose
  in a new rule.
- **Add a new role chip** → `macroRoles(x)`.

## Guarantee / testing
The engine emits English strings that map 1:1 to real in-game macro lines (verified against `macro_vocab.json`
templates). Refactors are validated by diffing `proposeMacro` output across a fixture of loadouts covering
every rule branch — keep that diff empty for behavior-preserving changes.

## Known limitations (see Progress.md roadmap)
- Buff/debuff lines gate on `has < N buffs/debuffs`, not the specific status name (no spell→status map yet).
- Classification is taxonomy-driven; use `SPELL_OVERRIDES` for mislabels.
- Role/rule logic uses the creature's own spells + stats + traits only — no spec/anointment context yet.
