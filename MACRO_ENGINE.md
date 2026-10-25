# Macro Proposal Engine

The engine that predicts a creature's in-game battle-AI **Macro** from its loadout (Menu → Macros). It reads
a party slot, classifies each equipped spell gem, and emits an ordered list of macro lines the player can
replicate in the in-game editor. All code lives in `app.js`; the in-game macro system it targets is
documented (grounded in the decompiled `scr_Macro*`) in `_su_extract/code/MACRO_MODEL.md`, and the raw
vocabulary ships as `D.macroVocab` (from `_su_extract/data/model/macro_vocab.json`).

## Pipeline (each stage is a separate function you can change in isolation)

1. **`gatherSlotSpells(slot)`** → the spells the creature can actually cast in a macro = its equipped
   spell **gems** plus spells it is **granted as a gem** (`FX.grantedSpells`, mode `gem`: Runes, Colorwave,
   Mega Magic, a relic Ultimate). Artifact Spell-slot and Nether-Stone spells auto-proc and can't be cast
   manually, so they're excluded here; so are spells flagged `noManual` (code `inv_SpellCanBeCastManually`:
   Booze and a static list such as Saving Grace / Lucky Gem) and chance-cast grants.
2. **`classifySpell(sp)`** → `{ sp, name, purpose, side, multi, scale, focus, drains }`. `purpose` ∈ `once ·
   ally-attack · unsilence · rez · heal · damage · dispel · control · debuff · buff · provoke · defend · summon · other`.
   In-game text patterns decide the first three and `control` (Sapphire Power "for the rest of the battle", Rabid
   Dementia "Target attacks", Living Necklace "Silence debuffs are removed", Stun Beam "sent to the bottom of the
   Timeline", `dispel` = "enemies' buffs are removed" (strip) / "your creatures' / target's debuffs are removed" (cleanse));
   the taxonomy decides the rest; aim `all` counts as whole-side (no target); `SPELL_OVERRIDES` wins over both. `multi` comes from the spell's aim.
   Gems with **Citrine** (Cast On Attack / Defend / Provoke / Heal) are left out of the cast lines: the player set them
   to fire from that action (user rule). `gatherSlotSpells(slot, citrine)` counts them per action.
   `spellScaling(sp)` reads what the damage scales with from the spell text: per buff / per debuff (with the %),
   per own charge (Spell Blast), missing Health (→ lowest Health), Health % (→ highest Health), Defense pierce
   (→ highest Defense). `drains` = a damage spell that heals your side (Drain Life).
3. **`macroContext(slot)`** → `x`, the object every rule reads: grouped spells (`by(purpose)`, `heals`, `dmg`,
   `singleDmg`, `aoe`) and action flags:
   - `noManual` (a no-manual-cast trait such as The Great Beyond → no cast lines at all);
   - `citAct` = the action most of its Citrine gems fire on (attack / defend / provoke); it sets the main action:
     `attackFirst`, `defendValue` or `provokeMain`;
   - `attackFirst` (Citrine on Attack, or else Attack ≥ Intelligence and Attack is its best stat → attack before any
     spell);
   - `attackWorth` (needs a reason to attack: `attackFirst`, Intelligence attacks — Whisper R70, Ribcracker R90, Myosotis,
     Confusion and Empathy — or an on-attack payoff in its traits / relic, "after / when this creature attacks") → the
     tail's attack lines. Attack ≥ Intelligence alone is no reason: an attack can trigger enemy on-hit effects (user rule);
   - `defendValue` (a trait or relic rank that pays off on Defend: "after this creature / the bearer Defends",
     "while the bearer is Defending") → Defend is its main action after support lines;
   - `tankActs` = its tank actions in order: Provoke (Citrine on Provoke), then Defend (Defend payoff or Citrine on Defend
     beside it). Each line is gated on its buff: `If this creature doesn't have Taunting, provoke` /
     `If this creature doesn't have Defensive, defend`. Taunting Provokes and Defensive Defends at the end of the turn anyway
     (`bc_CreatureProvoke` / `bc_CreatureDefend`, `_su_extract` end_of_turn rows 120-121), so the manual action would be wasted;
   - `tankSpells` = its Citrine gems on those tank actions. Once both buffs cover the tank actions, it casts them manually:
     `tankLines` runs the spell rules (`FALLBACK_RULES`) over them right after the tank lines (user rule, Knight Effigy);
   - `expanded` (any party creature has Expanded Power → small / moderate / large damage spells count as massive);
   - `tanky`, `hasProvokeTrait`, `dom`, and the tuning object as `x.T`.
4. **`MACRO_RULES`** → an ordered array of rules; `proposeMacro` runs each whose `when(x)` is true. Rules whose key
   starts `tail-` form the always-act tail, which is never trimmed: the body is cut to fit `maxLines` instead.
5. **`renderMacroProposal` / `renderMacros` / `macroProposalText`** → presentation + copy. No logic.

## The three surfaces you modify

### 1. `MACRO_TUNING` — thresholds
Every magic number in one object. Percentages are % Health and must be multiples of 10 (the in-game picker).

| Key | Meaning |
|---|---|
| `maxLines` | in-game macro line cap: 30 (`scr_MacroProcess` forces 30) |
| `healEmergency` / `healSustain` | % Health for the emergency (30) vs top-up (60) heal lines |
| `drainHeal` | % Health below which a damage-that-heals spell (Drain Life) goes first (50) |
| `dispelMin` | strip enemy buffs / cleanse ally debuffs once a creature has at least this many |
| `buffFloor` / `debuffFloor` | cast a buff/debuff on a target with fewer than this many buffs/debuffs |
| `minionCap` | summon while the creature has fewer than this many minions |
| `aoeMinEnemies` | whole-side damage while at least this many enemies are alive (`has > N living enemies`) |
| `onceTargets` | how many allies get a once-per-battle spell (Sapphire Power), one per turn |
| `scalerMaxGate` | drop a per-buff / per-debuff line whose break-even count is above this |
| `focus` | default target for single-target damage and attacks (`has lowest Health`) |

### 2. `SPELL_OVERRIDES` — per-spell logic
Keyed by spell **name**; forces `{ purpose?, side?, multi?, focus? }` for spells the text patterns or taxonomy get
wrong. Empty by default. If an override needs a new `purpose`, add a rule for it.

### 3. `MACRO_RULES` — the line logic
An ordered array; **array order = macro priority** (first line that acts wins in-game). Each rule:

```js
{ key: "heal-emergency",
  when: x => x.heals.length,                                   // gate
  lines: x => x.heals.map(s => mLine(                          // returns [{en, why, chain}]
    `If any ally has < ${x.T.healEmergency}% Health, ${castOn(s)}`,
    `${s.name} — emergency heal before an ally dies`)) }
```

Helpers: `mLine(en, why, chain)` builds a line (`chain: true` = "test next line", rendered indented);
`castOn(s)` = `cast X` for a whole-side spell (the game needs no target) or `cast X on that creature`.

Current rules, in order: `rez · heal-emergency · unsilence · once · ally-attack · provoke-main · provoke-spell ·
provoke-tank · heal-sustain · drain · dispel · debuff · buff · summon · defend-value · attack-first · aoe · damage-single ·
control · tail-attack · tail-defend · tail-skip`.

- **Target block** (`targetBlock`): the main single-target action (the attack for an attacker, else the strongest
  plain spell) gets a block sized to the free lines, so the macro uses the whole 30-line allowance. Shelled negates the
  next hit, Barrier absorbs it, and chains don't narrow, so every test has its own `enemy (n)` chain:
  - A (18): per slot, `< holeHp% Health` → `doesn't have Shelled` → `doesn't have Barrier` → act;
  - F (2): `any enemy < finishHp% Health` → `lowest Health` → act (finish through Shelled / Barrier);
  - C (12): per slot, `doesn't have Shelled` → `doesn't have Barrier` → act;
  - B (6): per slot, `doesn't have Barrier` → act.
  The biggest of A+F+B / A+B / A+F / A / F+C / C / F+B / B / F that fits is used.
- **No random-enemy attack (2026-10-24):** "lowest Health" picks only from targetable enemies (user, in game), so
  `If any enemy has lowest Health, attack that creature` is the fallback attack (the attacker's own line after its block,
  or `tail-attack`).

- **once:** for each of the top `onceTargets` allies whose Artifact Spell Slot fires on what that ally does most
  (Sword + attacker, Staff + caster, Shield + defender, Boots always), a turn-gated pair:
  `If this creature is on turn k, test next line` / `If ally (n) has > 0% Health, cast X on that creature`
  (`battleturns` counts from 1 and ticks at the start of the creature's turn, EFFECT_ORDER_FINDINGS.md).
- **damage-single:** per-buff / per-debuff spells first, each as a gated best-of pair
  (`If any enemy has > N−1 debuffs, test next line` / `If any enemy has most debuffs, cast X on that creature`).
  N = the count where the spell beats your best other spell: tier multiplier (Expanded Power → Massive) × the
  other spell's own charge bonus (Spell Blast at full − 1). Then every single-target spell strongest first on its
  focus; a spell out of charges falls through to the next line.

## Authoring rules (in-game, 2026-10-23; see `_su_extract/code/MACRO_MODEL.md` "Authoring patterns")
Every proposed macro must satisfy these (v2, 2026-10-23, implements all of them).
- **Health % values are multiples of 10.** The in-game picker steps in 10s.
- **Chains don't narrow targets.** "test next line" is a yes/no gate; the last line picks its own target from
  the whole side (v1's "doesn't have Shell / Barrier → test next line" lines were removed for this). AND on one
  creature needs a per-slot chain (`enemy (n)` on every line, 6 copies).
- **Always act.** End with `If any enemy has lowest Health, attack that creature` (only when attacking is worth
  it; it also covers Silence and every blocked cast), then `If this creature doesn't have Defensive, defend`, then
  `If this creature has > 0% Health, skip turn` (nothing blocks it).
- **Use the whole allowance.** Fill all 30 lines with useful cases unless there is truly nothing else to cover.
- **Citrine = intent.** Citrine gems aren't cast manually; the Citrine action is the creature's main action.
- **Fallback attack = lowest Health (user, 2026-10-24).** Best-of tests pick only from the enemies the line can target,
  so the plain `If any enemy has lowest Health, attack that creature` line covers it; no `attack a random enemy`.
- **Provoke (code reading):** while an enemy Provokes, about half of targeted attacks are redirected to it.
- **Tank actions check their buff (2026-10-24).** Provoke only without Taunting, Defend only without Defensive (both
  already fire at the end of the turn). A tank whose buffs cover every tank action falls back to its spells, Citrine gems
  included.
- **No reason, no attack (2026-10-24).** A creature attacks only when something names it an attacker (Citrine on Attack,
  Attack-led stats, Intelligence attacks, an on-attack payoff). Attacks can trigger enemy effects.
- **Attack lines need the full loadout.** A caster attacks only when its attacks use Intelligence: Whisper
  (Tenebris) R70, Ribcracker (Ariamaki) R90 after 10 casts, traits Myosotis / Confusion and Empathy. Otherwise
  the tail is Defend / Skip only (`x.attackWorth`).
- Gated best-of: `If any enemy has < X% Health → test next line` / `If any enemy has lowest Health → <act>`. This
  acts on the most nearly dead enemy, but only when one is in range.
- 30 lines per macro. Prefer covering all six slots of a smaller tier over a partial band.

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

## Worked example (user's team, 2026-10-23)
Animator party: Animatus (The Great Beyond, Vitreous) · Mutated Crypt Bat (Temptation) · Magnificus Sanctus
(Extension, Starwrath) · Zonte (Expanded Power, Ribcracker) · Imp Bishop (Whisper) · Knight Effigy (5740-NG).
v3 proposes (Citrine-aware): Animatus and Bat (Citrine on Attack) 30 lines: target block A+F+B for the attack →
lowest Health → defend → skip; Sanctus (Citrine on Defend) defend unless Defensive → its Citrine heals / buffs → skip;
Effigy (Citrine on Provoke) provoke unless Taunting → defend unless Defensive → Rabid Dementia / Greater Dispel / Stun Beam →
skip (no attack: nothing names it an attacker); Zonte Implosion / Kick gated on buffs / debuffs, then block A+F for Kick
(30 lines); Bishop Drain Life when hurt → Living Staff / Momentum while 2+ enemies → Jinx at 7+ debuffs → block F+C
for Spell Blast (27 lines). The user's hand-built Zonte macro (health bands, `_su_extract/code/MACRO_MODEL.md`
"Authoring patterns") is finer than the engine's gated best-of lines.

## Known limitations (see BACKLOG Macro roadmap)
- Buff/debuff lines gate on `has < N buffs/debuffs`, not the specific status name (no spell→status map yet).
- Spec and anointment context isn't read yet (roadmap 4). Relics and traits are, for attacks / Defend.
- A `defendValue` creature's Defend line comes before damage spells, so its damage spells only run when Defend is
  blocked.
- Spells with no rule (Glory, Astral Dimension: there is no "is Sealed" condition) are left out.
