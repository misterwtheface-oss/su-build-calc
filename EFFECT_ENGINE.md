# Effect Engine

`effects.js` (global `SU_EFFECTS`, loaded between `data.js` and `app.js`) is the single home for every
**build-affecting computation that comes from a source**: artifact / nether / relic stat bonuses, and every
perk or trait rule (caps, ignores, spell-gem slots, spell-gem class permissions, battle-start stat gains).
`app.js` keeps thin adapters (`finalStats`, `anointMax`, `creatureCap`, `avatarCap`, `creatureSlotMax`,
`spellEquipClasses`, `artifactBonusRows`, `netherBonusRows`) so no call site or UI changed.

Design rule: **traits/perks are data, mechanics are code.** Adding a trait or perk = adding a rule. Code grows
only when a genuinely new *kind* of mechanic appears, and then it is written once as an op every rule can reuse.

## Layers

1. **Stat contributions** — each source yields an ordered list of `{prop, stat, unit, value}`:
   `artifactContribs(a)` (primary + stat/trick properties + socketed nether), `netherContribs(n)`,
   `relicContribs(slot)` (0.1%/rank; empty under an `ignore relics` rule). Two folds read them:
   `foldCore` (% per core stat) feeds `finalStats`; `foldBonus` (core + non-core by property) feeds the
   artifact / nether bonus tables. `slotBonusPct(slot)` = artifact + relic, 2-dp rounded (the stat grid's Bonus).
2. **Rules** — `D.effects.rules`, built + validated by `build-data.mjs` from two tiers (each rule carries `prov`):
   - `generated` — derived from shipped descriptions: spell-slot grants (`SLOT_GRANT_RE`) and spell-gem class
     permissions (the exact patterns `app.js` used at runtime before the engine).
   - `manual` — `data/reference/effect_rules.json` (hand-authored; `_why` notes are stripped at build).
3. **Ops** — the evaluator for each rule kind (below). The engine has no per-trait/per-perk branches.

## Rule shape

```json
{ "id": "animator-molecular-betrayal",
  "src": { "kind": "perk", "spec": 1, "key": "MOLECULARBETRAYAL", "via": "spec+anoint" },
  "op": "stat.share", "phase": "battleStart", "target": { "race": "Animatus" }, "from": { "slot": 2 },
  "stats": ["hp", "atk", "def", "int", "spd"], "pctPerRank": 1 }
```

**Sources.** `{kind:"perk", spec, key, via}`: live while allocated in the CURRENT spec (rank > 0);
`via:"spec+anoint"` also when equipped as an Anointment (counts at the perk's max rank). `{kind:"trait", id}`:
live on a party slot that carries the trait (innate / fusion / artifact / nether, per `slotTraitIds`).

**Shared parameters.** `target` (`{race}`; null = any), `from` (`{slot}` = party position, 0-based),
`value` / `perRank` (× the source rank), `stats` (core stat keys), `scope` (`self` | `party`).

| op | params | read by |
|---|---|---|
| `cap` | `cap` (anoints/creatures/avatars), `mode` add\|set, `value`, `perRank` | `FX.cap(name)` — base `CAP_BASE`, adds, then sets |
| `ignore` | `what` (relics / fusionTraits) | `FX.ignores(what)` |
| `gemSlots` | `perRank` (perk) / `value` (trait), `target` | `FX.gemSlotMax(slot)` — base 3 + the equipped artifact's "Spell Gem Slots" property (trick slot or socketed nether stone, stat `Spell Gem Slot`, flat) |
| `equip.anyClass` | `scope` self\|party | `FX.equipClasses(slot, ownClass)` → null = any |
| `equip.addClass` | `cls` | `FX.equipClasses` |
| `stat.share` | `target`, `from`, `stats`, `pctPerRank`, `phase` | `FX.battleStart()` → per slot `{gain, ledger}` |

`build-data` fails the build on an unknown op, an unknown source kind / `via`, a duplicate id, or a rule
naming a perk/trait that doesn't exist (a typo can never silently do nothing).

## How to add logic

- **A trait/perk whose mechanic already exists** → add a rule to `effect_rules.json`, rebuild (`node build-data.mjs`).
- **A new mechanic** → add an op in `effects.js` (evaluator) + to the `OPS` set in build-data, then rules.
  Prefer reusing `target` / `from` / `perRank` over new parameters; add a new selector to `targets()` once.
- **A new stat source** → a `<source>Contribs()` returning the shared contribution shape; both folds work as-is.

## Testing

- `node tools/effects_test.mjs` — engine unit tests against the shipped `data.js` (Molecular Betrayal, caps,
  gem slots / class permissions, stat contributions).
- Behaviour preservation of the refactor was proven by snapshotting 195 UI surfaces (home both layouts, every
  creature detail + spell-gem picker, creature picker, anointments, synergy, threats, artifact/nether libraries
  and builders) across 14 fixture builds before and after: 0 diffs; a mutated engine produced 55 diffs.

## Status / known gaps

- `battleStart()` is computed but **not displayed** (no UI consumes it yet). Gains are exact shares of the
  source creature's final stats (unrounded); in-game rounding of `bc_StartupStatGain` is unverified.
- Animatus (game rule): a unique standalone creature — never fusion material, always party slot 1, at most one.
  Molecular Betrayal / Gray Matter target it by race, which is equivalent under that rule. The app doesn't
  enforce the rule yet (Progress.md backlog).
- Preserved pre-engine quirks (tracked in Progress.md → Backlog → Effect-engine quirks) (now explicit rules, so each is a one-line change if the game says otherwise):
  Army of Gods / Introversion / Total Deprivation / Gray Matter are spec-only (`via:"spec"`) although the data
  marks them anointable; Introversion and Total Deprivation require rank > 0 though their text says "always
  active while your specialization is …"; Highborn assumes the ascended +5. The text-derived equip rules
  inherit the old patterns: Master of Gemlings ("If all … are Gemlings") and Spectrometry ("Your Spelljuggler
  creatures") grant nothing, and Powerful Draw ("only Arrow spells, but … from any class") grants any class
  without the Arrow restriction.
