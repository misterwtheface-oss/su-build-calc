# Taxonomy — categories, subcategories & intended coverage

Semantic reference for the build-calc's tag taxonomy: what each **category** is for and what each
**subcategory (value)** covers. Companion to `build-data.mjs` (`correctTaxo`) and the cross-validation tool
`tools/mtx_compare.mjs`.

The taxonomy classifies every **trait, spell, perk, relic, and realm card** so `＋Filter` / Appendix /
Synergy can slice a build by what effects actually *do*. **23 categories** (Effect Limitation retired). Each
entity carries parallel `taxo` (`["Category::Value"]`) and `taxoSrc` arrays.

## Display rule — single-use tags
The data carries the **full** taxonomy: every value that fits any object. A value used by only **one** object (across
traits, perks, spells, relics and cards) is hidden from the ＋Filter / Appendix / perk pickers by default. The viewer's
**Show single-use tags** toggle (localStorage `subc.taxoSingles`) reveals it. Never filter vocabulary at build time.

## How tags are derived (`taxoSrc`)

| src | meaning |
|---|---|
| `code` | Backed by the decoded game code (trait effect signatures: event handler × whose event × effect × condition id; `_su_extract` `code_taxo.json`). Strongest source. Currently Activates When/at + Related Buff/Debuff. |
| `implied` | Action/Mechanic value implied by an EXACT tag on the same object (code/token/field/audit — never llm), e.g. *Activates When::Ally Attacks* ⇒ *Attack*, any *Related Buff* ⇒ *Buff*, `{ACTION_cast}` ⇒ *Cast*. Rules in build-data "Action/Mechanic IMPLIED". |
| `token` | Structured description markup (`{CONDNAME_*}`,`{STAT_*}`,`{ACTION_*}`,`{RACE_*}`,`{SPELL_*}`). Exact. |
| `field` | A structured data field (e.g. spell target from `Spell_REF`). Ground truth. |
| `keyword` | Word-boundaried domain keyword. |
| `phrase` | Structured code-field phrase. |
| `correction` | Added/retagged by a `correctTaxo` rule. |
| `llm` | Per-description LLM classification — heuristic; most grounding rules police this. |

### Grounding principles (enforced in `correctTaxo`)
- **Class names double as spell-class & gem-class.** Nature/Chaos/Death/Life/Sorcery name a *creature* class,
  a *spell* class, and a *gem* class. Anchor on the noun ("creature"/"class"/"spell"/"Spell Gem") — never a
  bare class name.
- **"All stats" / "base stats"** (no Health omission) **implies every stat** — Atk/Int/Def/Spd + Max Health.
- **Trigger vs state.** "After/when … attacks" = trigger (Activates When); "while / creatures with X" =
  persistent state (Active If).
- **Token expansion first** (`{STAT_charges}`→"charges", `{ACTION_provokes}`→"provokes") or spell/perk text
  under-matches.
- **Re-validate** after any regen: `node tools/mtx_compare.mjs` (needs `Trait_MTX.csv` + `Spell_REF.csv` in
  `~/Downloads`). ⚠ = a subcategory backed by a `correctTaxo` grounding rule.

---

## Action / Mechanic
*The core game mechanic or action an effect touches.* Broad, cross-cutting; entities usually carry several.

| Value | Covers |
|---|---|
| Attack | The Attack action — attacking, on-attack effects, attack damage. |
| Damage | **Deals damage, is triggered by damage, or modifies damage** (any source). Attack / Cast are added as well when the code makes the source explicit; the Attack+Cast pair is replaced by Damage only where neither is explicit (user rulings 2026-10-04). |
| Cast | The Cast action — casting a spell (the action itself, not spell modifiers). |
| Defend | The Defend action. |
| Provoke | The Provoke action (forcing enemies to target it). |
| Adjacency | Depends on / affects formation-adjacent creatures. |
| Artifact | Interacts with artifacts (their properties/slots/power). |
| Buff | Involves buffs in general (specifics → Affect on Status / Related Buff). |
| Creature Class ⚠ | A class *mechanic*: same/different/change class, class strength, "class as the target", enemy's class. **Not** spell/gem class. |
| Creature Race | References a creature race (name-grounded). |
| Critical | Critical hits — dealing them, crit chance/damage. |
| Debuff | Involves debuffs in general (specifics → Affect on Status / Related Debuff). |
| Dodge | Dodging attacks. |
| Healing | Healing as a mechanic (specifics → Affect on Life). |
| Indirect Damage ⚠ | Damage outside a manual attack/spell — status DoT (Burned/Poisoned) **and** trait procs ("deals damage to X equal to Y%"). |
| Intercept | Intercepting/redirecting attacks aimed at allies. |
| Minion ⚠ | Involves minions (must reference a real minion status / summon / "minion", not an incidental creature type). |
| Personality | Creature personality. |
| Relic | Interacts with relics. |
| Resurrection | Resurrecting creatures. |
| Spell Gems ⚠ | Manipulates the *gems*: charges, Ethereal creation, copy/seal, gem potency/properties. **Not** plain cast/grant. |
| Stats | Stat manipulation in general (specifics → Affect on Stats / Related Stat). |
| Timeline | Turn-order / timeline manipulation (specifics → Affect on Timeline). |
| Turn Counter ⚠ | Scales with *turns taken* — not a generic occurrence count. |

## Activates at
*Clock position of a triggered effect.* (Pairs with Activates When = which event.) Ally = bearer's side.

| Value | Covers |
|---|---|
| Start of Battle | Fires once at battle start. |
| Start of Ally Turn | At the start of a friendly creature's turn. |
| Start of Enemy Turn | At the start of an enemy's turn. |
| End of Ally Turn | At the end of a friendly creature's turn. |
| End of Enemy Turn | At the end of an enemy's turn. |

## Activates When
*The event that triggers an effect* — strictly triggers ("after/when <event>"), not passive modifiers.
Actor-split: **Ally** = bearer's side, **Enemy** = opposing side. The event set (each ×Ally/Enemy):

| Event | Fires when a creature… |
|---|---|
| Attacks / Casts / Defends / Provokes / Dodges | performs that action. |
| is Buffed / is Debuffed / is Healed | gains a buff / debuff / healing. |
| Takes Damage / Indirectly Damaged | takes direct / indirect (non-attack) damage. |
| Critically Hits | lands a critical. |
| Dies / Resurrects | is killed / is resurrected. |
| Gains Stats / Loses Stats | gains / loses stats. |
| Moves on Timeline | is repositioned on the timeline. |
| Minion Gain/Action | gains a minion or a minion acts. |
| Trait Activates | one of its traits fires. |
| Deals Damage | deals damage — any damage trigger where the code doesn't make attack vs spell explicit (user ruling 2026-10-04; replaces Attacks/Casts used as a stand-in). |

## Active If
*Always-on effects gated by a persistent condition* (live **while** the condition holds).

| Value | Covers |
|---|---|
| Has taken X Action Once | Gated on having done something at least once (cast ≥N spells, taken ≥N turns). |
| Buffed with X ⚠ | While the creature has a specific buff ("while has Barrier", "creatures with Berserk"). Not an after/when trigger. |
| Creature is Alive / Dead | Gated on the creature's alive/dead state. |
| Creature is X Type | Gated on being a race/class. (App also files the type under `Related Types::<Race>`.) |
| All Creatures Are X | The whole party is one race/class. |
| Debuffed with X | While the creature has a specific debuff. |
| Defending / Provoking | While in the defend / provoke stance. |
| Health is X% | HP-threshold gate ("while above 90% Health"). |
| Not Their Turn | While it is not the creature's turn. |
| Stat is Unmodified | While stats are unchanged from base. |
| Undamaged Turn | While the creature hasn't taken damage (this turn). |

*(Retired: **Spell/Gem is X Type** — no persistent state; those were cast triggers.)*

## Affect on Damage
*How damage output/intake is modified.*

| Value | Covers |
|---|---|
| Deal More / Deal Less Damage | Increases / decreases damage the creature deals. |
| Take More / Take Less Damage | Increases / decreases damage the creature takes. |
| More Critical Chance | Raises critical-hit chance. |
| Ignore Defense | Attacks/spells bypass some/all of the target's Defense. |

## Affect on Attacks
*How the attack action itself is changed.*

| Value | Covers |
|---|---|
| Automatic/Extra Attack | Extra or automatic attacks. |
| Modify Attack Calculation ⚠ | Attack damage computed from an alt stat / conditionally. Not procs/intercept/retarget/action-locks. |
| Chance to Fail (Attack) | Attacks may miss/fail. |
| Can't Manually Attack | The creature cannot be ordered to attack. |

## Affect on Mitigation
*Defensive posture: dodge, defend, provoke, survival.*

| Value | Covers |
|---|---|
| More Dodge Chance | Raises dodge chance. |
| Can't Dodge Attacks | Prevents dodging. |
| Automatically Defend ⚠ | Auto-performs the Defend action. |
| Automatically Provoke ⚠ | Auto-performs the Provoke action. |
| Can't Manually Defend / Provoke | The creature cannot be ordered to defend / provoke. |
| Defense Calculation | Changes how Defense/mitigation is computed. |
| Survive with X Health | Cheats death / survives at a Health floor. |

## Affect on Life
*Damage-taken, healing, death, resurrection happening to a creature.*

| Value | Covers |
|---|---|
| Creature is Damaged | **Deals damage**: the effect damages a creature (user ruling 2026-10-04). |
| Creature is Healed | Keyed to a creature being healed. |
| More / Less Healing | Amplifies / reduces healing received. |
| Creature is Killed | Keyed to a creature dying. |
| Creature is Resurrected | Keyed to a resurrection. |
| Cannot Be Resurrected | Blocks resurrection. |

## Affect on Minions
*How minions are gained, stacked, empowered, or persisted.*

| Value | Covers |
|---|---|
| Gain Minion | Grants/summons a minion. |
| Additional Stacks | A gained minion arrives with extra stacks. |
| Count Additional (Minion) | Counts minions as more than they are. |
| More Powerful Minion | Boosts minion strength/effect. |
| Extend Duration (Minion) | Minions last longer / less likely to leave. |
| Persist (Minion) ⚠ | Minion persists *beyond death* (duration-only cases are auto-moved to Extend Duration). |

## Affect on Spells
*How spells / spell gems are modified (not the cast trigger).*

| Value | Covers |
|---|---|
| Automatic/Extra Cast | Extra or automatic casts. |
| Can't Manually Cast | The creature cannot be ordered to cast. |
| Modify Charges/Behavior | Changes gem charges or a spell's behavior. |
| Chance to Fail (Spell) | Spells may fizzle. |
| Equip from Other Classes | Allows equipping off-class spell gems. |
| Extra/Gain a Spell Gem | Grants an extra spell/gem or a spell-slot. |
| Less / More Spell Potency | Reduces / increases spell potency. |
| Modify Spell Gem Property | Alters a gem's enchant property. |
| Redirect Spell ⚠ | A spell's target or caster is changed/bounced/retargeted. |
| Seal Spell Gem / Cannot be Sealed | Seals gems / immunity to sealing. |
| Modify Spell Calculation | Spell damage/potency computed differently ("as if 100% more Intelligence"). |

## Affect on Stats
*Stat gain/loss mechanics.*

| Value | Covers |
|---|---|
| Stat is Increased / Decreased | Raises / lowers a stat. |
| Cannot Gain / Cannot Lose Stats | Blocks stat gains / losses. |
| Persist (Stat Change) | Stat changes survive death/reset. |
| Stats are Averaged | Averages stats across creatures. |
| Stat Set to Minimum | Forces a stat to its floor. |
| Stat/Change is Shared | Shares a stat or a stat change with others. |
| Stat is Stolen | Takes a stat from another creature. |

## Affect on Status
*Buff/debuff application, removal, potency, persistence, immunity.* Assertion values are grounded vs the
canonical buff/debuff list.

| Value | Covers |
|---|---|
| Apply/Gain a Buff | Applies/grants a buff. |
| Always Has X Buff/Debuff | Permanently carries a status. |
| Count Additional (Status) | Counts a status as more stacks than present. |
| Limit/Prevent Buff Gain | Caps or blocks buff gains. |
| More Powerful Buff | Strengthens a buff's effect. |
| Remove Buff | Strips buffs. |
| Share/Gain Copy of Buff | Copies/shares a buff. |
| Buffs Persist | Buffs survive death/duration. |
| Afflict with/Gain a Debuff | Applies a debuff. |
| Increase Debuff Potency | Strengthens a debuff. |
| Remove Debuff | Cleanses debuffs. |
| Resistant to / Avoid/Immune to Debuff | Resistance / immunity to debuffs. |
| Cannot be Immune | Prevents the target's immunity. |
| Debuffs Persist | Debuffs survive death/duration. |
| Extend Duration (Status) / Reduce Duration | Lengthens / shortens status duration. |

## Affect on Timeline
*Turn-order manipulation.*

| Value | Covers |
|---|---|
| Additional Turn / Lose Turn | Grants an extra turn / skips a turn. |
| Count Additional (Turns) | Counts turns as more than taken. |
| Send to Bottom / Send to Top | Moves a creature down / up the timeline. |
| Shuffle Randomly | Randomizes timeline order. |
| Modify Starting Placement | Changes initial timeline position. |

## Affect on Traits
*How traits are gained, shared, or amplified.*

| Value | Covers |
|---|---|
| Gain a Trait | Grants a trait. |
| Share Trait | Shares a trait with other creatures. |
| Steal Trait | Takes a trait from another. |
| More Activations/Potency | A trait activates additional times / is more effective. |
| Trait Effect is Ignored | Suppresses a trait. |

## Affect on Type
*Changing a creature's class or race.*

| Value | Covers |
|---|---|
| Change Class / Change Race | Alters a creature's class / race. |
| Count Additional (Class) / (Race) | Counts a class / race as more members than present. |

## Multiplied by
*What quantity an effect scales with* ("for each …", "equal to X% of …"). Each value is a scaling source.

| Group | Values |
|---|---|
| Action counts | Attack Count · Cast Count · Defend Count · Provoke Count · Resurrect Count |
| Status/entity counts | Buff Count · Debuff Count · Minion Count · Living Creature Count · Dead Creature Count · Creature of X Type Count · Traits Gained Count |
| Damage/heal amounts | Amount of Damage Dealt · Amount of Damage Taken · Damage Taken Count · Amount Healed |
| Potency | Buff Potency · Debuff Potency |
| Health/stat | Current/Missing Health % · Amount of X Stat · Amount of Stat Change |
| Resource/position | Spell Gem/Charge Count · Above/Below on TL Count · **Turns Taken Count** |

*Turns Taken Count* is turns; "for each time damaged" is *Damage Taken Count* (mirror of the Turn Counter split).

## Related Buff *(token-grounded)*
Each value = the effect references that specific **buff**. `Random Buff` = references a random/unspecified buff.
Values: Arcane · Agile · Barrier · Berserk · Defensive · Immune · Invisible · Leeching · Mending · Proficient ·
Protected · Rebirth · Repelling · Savage · Shelled · Splashing · Taunting · Warded · Random Buff.

## Related Debuff *(token-grounded)*
Each value = references that specific **debuff**. `Random Debuff` = random/unspecified.
Values: Bleeding · Blighted · Blind · Bomb · Burning · Confused · Cursed · Disarmed · Feared · Frozen ·
Inverted · Mania · Poisoned · Scorned · Silenced · Sleeping · Snared · Stone · Vulnerable · Weak · Random Debuff.

## Related Minion
Each value = references that specific **minion**. `Random Minion` = random/unspecified; `Four Horsemen` =
the Death/War/Famine/Conquest set. Values: Animated Gem · Animated Weapon · Dire Wolves · Four Horsemen ·
Spiderlings · Writhelings · Zombies · Littletorun · Illusion · Random Minion · Unstable Horror · Doppelganger ·
Amalgamation · **Greater Demons** (Asmodeus/Beelzebub/Mammon/Leviathan/Belphegor/Satanachia/Lucifer) · **Lesser Demons**
(Brim Fiends/Fire Imps/Chaos Satyrs). Sets collapse like Four Horsemen — the game's own minion text says "This minion is a
Greater/Lesser Demon"; tagged from the member's {CONDNAME_MINION_*} token or the exact phrase "Greater/Lesser Demon(s)".

## Related Spells
Which spell **class / kind / named spell** an effect references.
- **Class:** Chaos / Death / Life / Nature / Sorcery Spells.
- **Kind:** Arrow · Arsenal · Booze · Damaging ⚠ · Ethereal · Non-Ethereal · Healing · Minion · Multi-Target ⚠ ·
  Scourge · Single-Target ⚠ · Ultimate · Non-Ultimate Spells.
- **Named:** 27 specific spells (Bone Spear, Chain Lightning, Fireball, …) referenced by `{SPELL_*}`/`[icons]`.

⚠ For a **spell**: Single/Multi-Target derive from `Spell_REF.target` (`field`); Damaging = potency + a damage
reference (not a healing/utility spell). For a trait/perk, Damaging = an explicit "damaging spell" mention.

## Related Stat
Which **stat** an effect scales with or modifies.

| Value | Covers |
|---|---|
| Attack (Stat) · Defense · Intelligence · Speed | References/modifies that stat (named, or via an all-stats bundle ⚠). |
| Maximum Health ⚠ | The max-HP *stat* — not current/missing HP, healing amounts, thresholds, or "other than Health". |
| Highest Stat / Lowest Stat | Scales with the creature's highest / lowest stat. |

⚠ An **all-stats bundle** ("gain X% stats", "base stats"; no Health omission) tags Attack/Int/Def/Speed **and**
Max Health — each stat.

## Related Types *(169 values — race/class references)*
Each value = the effect references creatures of that **race** (Griffon, Dumpling, Dragon, …) or class-creature
type. Also: `Common Race`, `Fused Race`, `Fused Class`, `Parent Class`.
- ⚠ **`<Class> Creature`** (Nature/Chaos/Death/Life/Sorcery) — must literally reference "<class> creature(s)"
  (e.g. "damage to Life creatures"), **not** the class's spells/gems or a class-count effect.
- Race values are token-grounded from the referenced roster.

## Related Trait
Which kind of trait an effect references.

| Value | Covers |
|---|---|
| Innate Trait ⚠ | References innate traits ("share their innate traits", "their innate traits are 50% more effective"). |
| Artifact Trait | References artifact-granted traits. |
| Fused Trait | References a fused creature's inherited trait. |
| Extra Trait | Grants/uses an additional trait slot. |
| Random Trait | References a random/unspecified trait. |

---

## Retired / dropped
- **Effect Limitation** (category) — dropped entirely (Does not stack · Don't Have this Trait · First Time X
  Occurs · Limit Actions per Turn). No tracking value.
- **Active If::Spell/Gem is X Type** (value) — dropped; redundant with Activates When + Related Spells.

Value drops use the reusable `KILLED_VALUES` set in `build-data.mjs` (strips the tag everywhere **and** removes
it from the shipped `taxonomy.categories`, so the app stops offering it as a filter). Whole-category drops
follow the Effect Limitation pattern.
