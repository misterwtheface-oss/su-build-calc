# Taxonomy intent — what each tag group is for (standing charter)

This file decides **scope**: what each tag group is meant to cover and what it is not. It exists so tag membership does
not drift over time. `TAXONOMY.md` is the reference for the vocabulary and how tags are derived. When the two disagree,
this file wins and `TAXONOMY.md` gets fixed.

**Rules for this file**
- Only the user ratifies scope. A group is `DRAFT` until the user approves it, then `RATIFIED <date>`.
- Changing a ratified scope needs a new dated ruling in that group's log. Old wording moves to the log, never silently edited.
- Membership is proven from the game code (`_su_extract` code layer). Heuristics are leads, never proof (see the global
  rule "Heuristics find, code decides").
- Relabels that follow from a scope go through the taxonomy review queue as usual.

## Global rules (already ratified)
- **Heuristics find, code decides (user, 2026-10-19).** Heuristics are how we work at scale. They read what each effect is
  likely meant to do and point at where to look in the code: LLM classification, text patterns and keywords, description
  markup tokens, co-tag implications, cross-references. Validation happens only in the game code: a tag ships when a
  decoded code site proves it (the effect call, gate, hook or data field), recorded with that site. A heuristic result
  that the code doesn't confirm is a work item for the extract, never a shipped tag. When the code and a heuristic
  disagree, the code wins unless the user rules otherwise from in-game observation. If the code seems to lack something
  the game text clearly does (Furor's turn start), the decode is incomplete: keep looking, don't fall back to the
  heuristic. Applied 2026-10-19: the app ships code-backed tags only (`code`, `code_boss`, `field`).
- **Action/Mechanic is a superset.** Every narrower tag also carries its Action/Mechanic parent, and the overlap is required
  (2026-10-04).
- **Search intent.** Don't create a catch-all value nobody would search for. Map onto existing values instead (2026-10-06).
- **Turn Counter vs Timeline.** Extra/lost turns and turn counts are Turn Counter. Timeline is position/order only. Start of
  battle is never Timeline (2026-10-06).
- **Multi-Target.** The effect affects more than one creature, on either side, whatever the targeting. Random targeting that is
  likely to hit several creatures counts. One target hit repeatedly, a single random target, or a random spell do not
  (2026-10-06).
- **Minion Spells.** Every spell that deals with minions literally. Membership is validated in code, not by a text rule
  (2026-10-18).
- **Creature is Damaged** means the effect deals damage to a creature (2026-10-04). Scope review is parked: S24 proposal.
- **Taxonomy v2 shape (user, 2026-10-18).** The taxonomy is being rebuilt from scratch (section below). Ratified:
  1. **Scope is a per-tag attribute**, not part of the value name (no more "Ally X" / "Enemy X" twins).
  2. **Action/Mechanic is derived, not hand-tagged.** It becomes *Theme*, computed from the other tags. The superset rule
     (2026-10-04) still holds; the structure now guarantees it.
  3. **Extra vs Automatic is split** for both attacks and casts.
  4. **Buffs and Debuffs are two parallel domains** with the same verb list.
  5. **Source** attribute ratified; **Targeting** category added; **Ignore Defense** is Calculation (2026-10-18).
  6. **Role** and **Phase** ratified as Trigger attributes; **Stats** split into Gain / Lose vs Has More / Has Less (2026-10-18).
  7. **Delivery** attribute (Event · Direct) on Stats::Gain / Lose and Buffs / Debuffs::Apply; Phase gains **During**;
     Xyrxzy's Control = Extra Attack (code wins, clarify note); Cold Blood is not Bounds (2026-10-19).

---

## Taxonomy v2 — `RATIFIED 2026-10-19` (shape 2026-10-18, values 2026-10-19)

**Why.** The v1 categories (from the original CSV) mixed different questions in one category: trigger, outcome and
reference. They merged two distinctions behind slash names (17 values, e.g. `Afflict with/Gain a Debuff`,
`Automatic/Extra Attack`). They named the side in some places and not others, and they reinvented the same verbs per
category with suffixes (`Count Additional (Minion)`, `Persist (Minion)` vs `Buffs Persist`). v2 does not mirror v1. Its
aim is to capture what an effect really covers, with every value tied to the decoded game function that proves it
(user, 2026-10-18).

**Shape: one question per layer.**

| Layer | Question | Categories |
|---|---|---|
| Trigger | When does it fire? | `Trigger` (23 events) |
| Condition | While what is true? | `Condition` |
| Effect | What does it do? | `Damage` · `Calculation` · `Hit Resolution` · `Actions` · `Spell Gems` · `Buffs` · `Debuffs` · `Life` · `Stats` · `Minions` · `Turns` · `Timeline` · `Traits` · `Type` |
| Targeting | Who does it pick? | `Targeting` (ratified 2026-10-18) |
| Scales With | How big is it? | `Scales With` |
| References | Which named things? | `Named Buff` · `Named Debuff` · `Named Minion` · `Stat` · `Trait Kind` · `Creature Type` · `Spell Class` · `Spell Kind` · `Named Spell` |
| Theme | What mechanic does it touch? | derived (old Action/Mechanic) + `Involves` |

### Attributes on each tag
They are stored with the tag, so two tags on one object never cross. The app can read a tag as a sentence, e.g.
Trigger::Debuff + Enemy + Receiver + After = "after an enemy is debuffed".

| Attribute | Status | Values | On | Code |
|---|---|---|---|---|
| **Scope**: whose creature | RATIFIED | Self · Ally · Self or Ally · Enemy · Any · Adjacent | every tag | `by` (trigger actor, 99.2% decoded) and `to` (effect target, ~30% decoded: extract work) |
| **Source**: which action the damage comes from | RATIFIED | Attack · Spell · Indirect (none = any damage) | Damage, Hit Resolution, Calculation, Trigger::Damage | damage-type branch in `bc_EventDamage` / `bc_SpellDamage`; DoT = `bc_Calculate{Burn,Poison,Bleed}Damage`. Migrated from the existing code-grounded Attack / Cast / Indirect Damage tags (941 objects) |
| **Role**: the creature's part in the event | RATIFIED | Performer · Receiver · Applier | Trigger | `holder_anchor` / `holder_rel`; `bc_EventDamage` damager vs damaged; `bc_OnBuffDebuff` "is Debuffed" vs "Applies" |
| **Phase**: before or after it happens | RATIFIED | Would · During · After · Repeat | Trigger | Would = a hook inside `bc_Event*` that issues a new or replacement effect; During = a hook inside the creature's own `bc_CreatureAttack` / `bc_CreatureCast` that issues something before the action resolves (2026-10-19); After = `bc_On*`, turn clocks, `bc_Startup*`; Repeat = `bc_ExecuteEvents` |
| **Delivery**: does it go through the game event | RATIFIED 2026-10-19 | Event · Direct | Stats::Gain / Lose, Buffs / Debuffs::Apply | Event = `bc_EventGain*` / `bc_EventLose*` / `bc_EventBuff` / `bc_EventDebuff`: on-gain / on-buff / on-debuff reactions fire, diminishing returns and the per-turn action limit apply. Direct = `bc_StartupStatGain` / `bc_StartupStatLoss` or a bare `scr_CritAddCondition`: silent, no reactions, no limit (immunity still checked) |

**Why Role and Phase (ruling 2 in the log).** For buffs and debuffs alone the code has three different hooks, and the
game text words each one differently:
- "When X **would be** debuffed": inside `bc_EventDebuff`, before it lands, so it can redirect or replace it
  (The Best Medicine, Doom and Gloom, Glitch In The System).
- "**After** X is debuffed": `bc_OnBuffDebuff`, receiver side (Absolution, Wrong Side).
- "After X **afflicts** someone": `bc_OnBuffDebuff` "Applies", applier side (Black Fog, Hog Wild, Kismet).

An in-event hook that only changes the number is an Effect, not a Trigger: Master of Smogs (potency) →
`Debuffs::Strengthen`, Blazing Soul (Attack used for Burning) → `Calculation::DoT Formula`. The split is mechanical in
code: the effect either modifies a value or issues an event. Repeat covers "effects that activate when a creature deals
critical damage activate 1 additional time" (Sword Dance, Moon Dance, Fan Dance). These now get the event's Trigger tag
with phase Repeat, plus `Traits::More Activations`, so a crit build finds Sword Dance.

### Values, and the code that proves each one

| Category | Values (DRAFT unless marked) | Proven by |
|---|---|---|
| Trigger **RATIFIED 2026-10-19** | Battle Start · Turn Start · Turn End · Attack · Cast · Defend · Provoke · Dodge · Critical Hit · Damage · Heal · Death · Resurrection · Buff · Debuff · Buff Removed · Debuff Removed · Stat Gain · Stat Loss · Timeline Move · Minion Gained · Minion Lost (natural leave roll at the holder's turn start; spell removal never counts) · Minion Action · Trait Activation. No Buff-or-Debuff value: an unresolved polarity becomes Buff, Debuff or both. Kill / Is Attacked / Takes Damage are Trigger + Role, shown as readable labels in the app (no values) | the event handler (`bc_OnAttack`, `bc_OnDeath`, `bc_OnBuffDebuff`, `bc_CreatureStartOfTurn`, `bc_Startup*`, `bc_OnMinion` / `bc_EventMinion`, …) + Role / Phase / Scope above |
| Condition **RATIFIED 2026-10-19** | Has Buff · Has Debuff · Health Threshold · Defending · Provoking · Is Alive · Is Dead · Is Type · Party All Same Type · Creatures Missing · Undamaged This Turn · Stats Unmodified · Not Their Turn · Has Done Action · Turn Number | the gate's guards: `scr_CritHasCondition` (`has_condition` `on`), HP compares, `scr_CreatureClass` / `bc_CountRace` / `bc_AllRace`, action counters |
| Damage **RATIFIED 2026-10-19** | Deal More · Deal Less · Take More · Take Less · Inflict (type = Source: a trait's "deals damage" is spell-type, dtype 1) | `bc_EventDamage` modify, split by the holder's role (damager → Deal, damaged → Take); Inflict = an effect call to `bc_EventDamage` |
| Calculation **RATIFIED 2026-10-19** | Attack Formula · Spell Formula · Damage-Taken Formula · DoT Formula · Ignore Defense · Bounds · Class Advantage. "As if X% stat" = Formula; plain multipliers = Damage::Deal More; Bounds = clamps and forced values | `bc_SpellDamage` / `bc_SpellStat` / `bc_SpellHealing`; the attack path in `bc_EventDamage`; `bc_Calculate{Burn,Poison,Bleed}Damage`; the defense term; min / max clamps |
| Hit Resolution **RATIFIED 2026-10-19** | Crit Chance · Dodge Chance · Can't Dodge · Attack Fails · Spell Fails | `bc_GetCriticalChance`, `bc_GetDodgeChance`, fail rolls |
| Actions **RATIFIED 2026-10-19** | Extra Attack · Auto Attack · Extra Cast · Auto Cast · Auto Defend · Auto Provoke · Can't Manually Attack · Can't Manually Cast · Can't Manually Defend · Can't Manually Provoke · Counts as Manual · Redirect Spell · Intercept · Limit Repeats ("only once at a time": Languid Limbs, Somber Spirits). Enemy-side locks (Deadly Calm, SCRAAAW!) = Can't Manually X with scope Enemy | Extra = the **same creature does the same action again** (same spell, same target; ruled 2026-10-19), i.e. its own action repeats or hits more times: a count change inside `bc_CreatureAttack` / `bc_CreatureCast` with no new action call (Quadhits, Triple Take, Necronomicon), or a re-issue of the same action (Pandemonium Wrath). Auto = a new action call to `bc_CreatureAttack` / `bc_CreatureCastSpellGem` / `bc_CreatureCastRandomSpell` / `bc_CreatureDefend` / `bc_CreatureProvoke` (Last Stand, The Wicked End). Who acts = effect Scope (allies: Hive Mind; a forced enemy: Pharaoh's Beckoning). Locks = `bc_ArtificialIntelligence`. Counts as Manual = `bc_CreatureCast` arg3 |
| Spell Gems **RATIFIED 2026-10-19** | Gain Gem · Extra Gem Slot · Charges (charge writes) · Behavior (any other change inside the cast; code split kept) · Property · Potency Up · Potency Down · Seal · Can't Be Sealed · Off-Class Equip | `inv_CreateSpellGem` / `bc_EventGem`, `inv_SpellGemsUpdate`, `bc_EventChargeRecover`, `inv_CritCanEquipSpellGem` |
| Buffs / Debuffs **RATIFIED 2026-10-19** | Apply (+ Delivery) · Remove · Strengthen · Count Extra · Persist · Extend · Shorten · Always Has; Buffs only: Copy · Can't Gain; Debuffs only: Resist · Immune · Bypass Protection (can't be immune or resistant) | `bc_EventBuff` / `bc_EventDebuff`, `scr_CritAddCondition` (duration / stacks), `bc_EventRemoveCondition`, `scr_CritIsImmune` / `scr_CritIsResistant`, `bc_MaintainPermanentEffects`, `bc_HandleDeath`; polarity `scr_ConditionIsBuff` / `IsDebuff` |
| Life **RATIFIED 2026-10-19** | Heal · Healing Up · Healing Down · Resurrect · Can't Resurrect · Survive Lethal · Execute (health costs = Damage::Inflict + Indirect + Self) | `bc_EventHeal`, `bc_EventResurrect`, `bc_EventOHKO` |
| Stats **RATIFIED 2026-10-19** | Gain · Lose (+ Delivery) · Has More · Has Less · Steal · Share Stat · Share Stat Change · Average · Set (overwrite: to minimum, another stat, a %) · Can't Gain · Can't Lose · Persist | Gain / Lose = stat events `bc_EventGain*` / `bc_EventLose*` (fire on-stat-gain effects, diminishing returns). Has More / Has Less = passive stat getters `crit_attack` / `crit_intelligence` / `crit_defense` / `crit_speed` |
| Minions **RATIFIED 2026-10-19** | Summon · Remove (Banish, Earthquake, Chaos Orb, Rune spells) · Extra Stacks · Strengthen · Extend (incl. lower leave chance: Permanence, Midnight Bargain) · Persist Through Death · Count Extra | `bc_EventMinion`, `bc_GetRandomMinion`, `scr_ConditionIsMinion` |
| Turns / Timeline **RATIFIED 2026-10-19** | Extra Turn · Lose Turn · Count Extra / Move Up · Move Down · Shuffle · Starting Position | timeline calls; `bc_CreateCreatureList` (starting placement) |
| Traits **RATIFIED 2026-10-19** | Gain · Share · Steal · More Activations · More Potency · Suppress · Gain Perk | `bc_EventTrait`, `bc_StartupTraits`, the amplifier set (CODE_TAXO S4), `bc_ExecuteEvents` |
| Type **RATIFIED 2026-10-19** | Change Class · Change Race · Count Extra Class · Count Extra Race | `bc_EventTransform`, class / race writes |
| Targeting **RATIFIED 2026-10-19** | Random · Highest Stat · Lowest Stat · Lowest Health · Adjacent · Timeline Position · Most Common Race · All · Target Rules | `scr_GetCritNthHighestStat` / `bc_GetCreaturesWithHighestStat`, `bc_GetCreatureWithLowestHealthByArray`, `bc_GetAdjacentCreatures`, `scr_GetDominantCreatures`, `scr_MacroProcess` (can target Invisible). A random pick has no named picker: extract work |
| Scales With **RATIFIED 2026-10-19** | 30 values (v1 Multiplied by, slash values split) | `value_use` / constants; `bc_CountBuffs` / `CountDebuffs` / `CountMinions` / `CountRace` / `CountClass`, `bc_GetMissingCreatureCount` |

**Granularity rule** (replaces "specific without being overly specific"). A value exists only if (a) a player would
filter by it while building, and (b) the code can tell it apart from its neighbours. If either fails, merge. If both
pass, the two never share a slash name.

**Theme.** Theme X = the object has a tag in X's pattern list, its Source implies X, or the object is that kind of thing
(a spell is a Cast). An old code-grounded Action/Mechanic tag that none of these re-derive still sets the theme, so nothing
is lost; such a **theme-only** object is a review item: a narrower tag is missing (the extract finds it in code) or the
theme was wrong. Adjacency / Artifact / Relic / Personality have no narrower tags (permanent).

**Involves = the umbrella view (user 2026-10-20).** Every object carries `Involves::<theme>` for each of its themes, so one
tag lists everything that touches a mechanic without a narrow focus (the role the old generic Action/Mechanic tags had):
Involves::Damage 1,495 vs Damage::Inflict 543. It heads its mechanic group in the pickers and stays out of Synergy (it
would double-count every effect).

### Mechanic groups (how the app browses tags) — accepted 2026-10-20 (may be tweaked in use)
User request (2026-10-19): the browse containers group tags by the mechanic they relate to, not by category. A tag can
sit in more than one group (Calculation::Attack Formula is in Attack Effects and Damage). Defined in
`data/reference/taxonomy_groups.json`, built from the theme lists, so a group and its theme can't drift apart; build-data
warns on any value no group reaches (none today).

| Group | Takes |
|---|---|
| Attack Effects | themes Attack, Dodge, Critical, Intercept; Actions::Limit Repeats |
| Spell Gem / Cast Effects | themes Cast, Spell Gems; Spell Class, Spell Kind, Named Spell; Actions::Limit Repeats |
| Defend & Provoke | themes Defend, Provoke |
| Damage | theme Damage (Damage, Calculation, Trigger::Damage, damage Scales With); Involves::Indirect Damage |
| Health & Healing | theme Healing; Condition::Health Threshold; Scales With::Current / Missing Health % |
| Death & Resurrection | theme Resurrection; Trigger::Death; Life::Execute, Survive Lethal; Condition::Is Dead / Is Alive; Dead / Living Creature Count |
| Buffs · Debuffs · Minions · Stats | their themes (Minions also Trigger::Minion Lost) |
| Turns & Timeline | themes Turn Counter, Timeline; Trigger::Battle Start / Turn Start / Turn End; Condition::Turn Number / Not Their Turn / Has Done Action / Undamaged This Turn; Scales With::Turn Count |
| Traits | Traits, Trait Kind, Trigger::Trait Activation, Scales With::Traits Gained Count |
| Class & Race | themes Creature Class, Creature Race; Condition::Party All Same Type / Is Type; Scales With::Type Count |
| Party & Targeting | Targeting; Condition::Creatures Missing; Scales With::Missing Creature Count; theme Adjacency |
| Equipment & Personality | themes Artifact, Relic, Personality |

Inside a group each row names its category ("Trigger: Takes Damage"). Triggers whose meaning depends on the creature's
part show readable role rows (Attacks / Is Attacked, Deals / Takes Damage, Kills / Dies, Heals / Is Healed, Is Buffed /
Buffs Someone, Is Debuffed / Debuffs Someone, Critically Hits / Is Critically Hit) beside the "(any)" row.

### Crosswalk and check
`data/reference/taxonomy_crosswalk.json` maps every v1 value (`new_values` lists v2 values with no v1 source).
`node tools/taxo_crosswalk.mjs` applies it to the shipped data. Result on 2026-10-18 data (3,646 objects):
- 0 unmapped v1 values. 0 themes lost.
- **Split review: 2,415 tag instances** need code to pick a target. Largest: Creature is Damaged → Inflict Direct /
  Indirect 676 (folds in the parked S24 proposal); Stat is Increased → Gain / Has More 480; Extra / Auto Cast 321;
  Extra / Auto Attack 207; Stat is Decreased → Lose / Has Less 164; Charges / Behavior 109; Gain Gem / Extra Gem Slot 94;
  Always Has Buff / Debuff 91.
- **Outcome vs trigger:** `Creature is Healed / Killed / Resurrected` become Life outcomes. 324 objects have no matching
  trigger, so the tag can only mean the outcome. 35 have both and need code.
- **Involves: 660** (Damage 141, Stats 88, Cast 79, Creature Class 64, Spell Gems 52, …). The samples point at missing
  narrower tags, e.g. "creatures of its own class" (Desert Glory).
- **Themes gained: 170.** These are objects where v1 was missing the superset parent.
- v1 bugs: `Enemy Is Healed` / `Enemy is Healed` case-variant twins; one object still carries the retired Effect Limitation.

### Migration order (nothing relabels until the user ratifies the values)
1. User ratifies the value lists. **Done 2026-10-19** (every domain; see the Log).
2. Extract handoff `_su_extract/code/HANDOFF_taxonomy_v2.md` (written 2026-10-18): decode the split targets (damage type, calling host for Extra vs Auto, stat event vs getter,
   polarity), Role / Phase per trigger clause, effect-target scope, and the target picker.
3. build-data: v2 tags + attributes. **Done 2026-10-19** (shipped next to v1; `tools/taxo-v2.mjs`). Then each app feature
   moves to v2 behind a script flag, and the filter gets the attribute chips.
4. ~~Community CSV parity pass~~ dropped (user 2026-10-20: that CSV is personal, not community). v1 retires in one cutover
   once the extract settles HANDOFF F4 / F5 (Involves review, relic tag ranks) and the open items. **Done 2026-10-22.**

### Open questions (to rule on)
_None on the shape. Next: the user ratifies the value lists domain by domain against `_su_extract/data/model/taxo_v2_tags.json`._

Extract answers (S37, `COMBAT_RULES.md` § Event plumbing): a direct condition add fires no on-buff / on-debuff reaction
and skips the action limit; start-of-battle stat writes fire no stat event; "after this creature attacks" effects fire once
per hit (Extra repeats and area hits multiply them).

### Log
- 2026-10-18: Shape ratified: scope attribute, derived Theme, Extra / Auto split, parallel Buffs / Debuffs.
- 2026-10-18: Source attribute ratified. Targeting category added. Ignore Defense → Calculation. `Enemy is Debuffed` was
  meant as "an enemy has a debuff applied". The user says v2 need not mirror v1: capture the effect's real coverage,
  mapped to the decoded game functions. That led to the Role and Phase drafts.
- 2026-10-18: Role and Phase ratified as Trigger attributes. Stats split ratified (Gain / Lose vs Has More / Has Less).
- 2026-10-19: Extract answered the handoff. User ruled: Delivery attribute (Event / Direct) for stat Gain / Lose and
  buff / debuff Apply; new Phase value During (120 mid-action triggers); Xyrxzy's Control = Extra Attack + clarify note;
  Cold Blood stays Damage::Deal More, not Bounds (Bounds = clamps and forced values only).
- 2026-10-19: Trigger values ratified as drafted (23). Kill etc. = Trigger + Role with readable app labels; Trait
  Activation kept (2 objects). Extract follow-ups: buff/debuff polarity (54), minion triggers, Applier (Black Fog).
- 2026-10-19: Actions ratified. Extra tightened to same creature + same action (Refraction, Deep Inhalation, Lune,
  Pandora → Auto Cast). Locks keep "Manually" (only the manual choice is blocked).
- 2026-10-19: Damage, Calculation, Hit Resolution ratified. Inflict Direct / Indirect merged into Damage::Inflict
  (Source carries the type). "As if X% stat" → Attack / Spell Formula; Frenzy → Hit Resolution; plain multipliers →
  Deal More; new Calculation::Class Advantage (Bloodline, Details Matter, True Strike). Calculation questions 2–5 closed.
- 2026-10-19: Buffs / Debuffs ratified. Block → Buffs::Can't Gain; Can't Be Immune → Debuffs::Bypass Protection (also
  covers "can't be resistant"). Convert / transfer effects stay Remove + Apply.
- 2026-10-19: Stats and Life ratified. Set to Minimum → general Stats::Set (Anger, Soul Sacrifice, Metamorphosis join);
  Average kept. Health costs are Damage::Inflict + Indirect + Self.
- 2026-10-19: Spell Gems ratified with the extract's code split (Charges = charge writes, Behavior = any other change
  inside the cast). Minions, Turns, Timeline, Traits, Type, Targeting ratified as drafted. Repeat-phase triggers keep
  Traits::More Activations beside them.
- 2026-10-19: Condition, Scales With and the reference lists (Named Buff / Debuff / Minion, Stat, Trait Kind, Creature
  Type, Spell Class / Kind, Named Spell) ratified. New Condition::Turn Number (~14 objects). Non-Ultimate / Non-Ethereal
  fold into Ultimate / Ethereal Spells. **All v2 values are now ratified**; next is build-data v2.
- 2026-10-19: Build rules (user): v2 = union of the v1 tags through the crosswalk and the code layer, code deciding
  splits and attributes; undecided splits keep every candidate marked unverified; v2 ships next to v1, features move
  over one at a time, then one cutover retires v1.
- 2026-10-19: Global rule "Heuristics find, code decides" written down (user): heuristics give scale and intent,
  validation is in the code only.
- 2026-10-19: Code-backed only (user, after reviewing Abnegation / Furor): the app ships only code, code_boss and field
  tags. Everything else is removed and handed to the extract (F3). Supersedes the union / unverified build rules.
- 2026-10-19: Extract S38 parked items ruled. New Trigger::Minion Lost; new Minions::Remove; leave-chance modifiers =
  Minions::Extend; damage immunity (IMMORTALITY, Rainbow Shield) = Damage::Take Less; Tempest = Targeting::All; enemy-side
  locks = Can't Manually X (scope Enemy); new Actions::Limit Repeats; chance to avoid debuffs = Debuffs::Immune; Glitch
  In The System = Buffs::Can't Gain + Debuffs::Apply; Master of Carbuncles / Storms = Traits::More Potency only. Lord of
  Undeath clarify note waits for an in-game check.

---

## Calculation — `DRAFT`
Tags: `Affect on Attacks::Modify Attack Calculation`, `Affect on Spells::Modify Spell Calculation`,
`Affect on Mitigation::Defense Calculation` (+ the proposed inbound damage tag, see open question 1).

**Intent (user, 2026-10-18).** The effect changes *how the number is computed*, not just the number itself.

**In scope.** An effect belongs if it does any of these:
1. **Changes the stat(s) used in the calculation.** Example: attacks use Intelligence instead of Attack (Myosotis, Song of
   Wit), or spells use Speed instead of Intelligence (the Arrow spells).
2. **Changes the bounds of the calculation** (minimum or maximum). Example: Cold Blood (deals 50%–250% normal damage).
3. **Adds another stat to the calculation, even if the original stat is unchanged.** Example: Swiftcasting (35% of Speed
   added to Intelligence for potency), Mindful Awareness (35% of Intelligence added to Defense for damage taken), Living
   Sword (plus 50% of Attack).

**Out of scope** (and where it goes instead): _pending the rulings below._

**Open questions (to rule on)**
1. Inbound side: does `Defense Calculation` become the tag for the whole damage-taken calculation, or does a new inbound tag
   sit beside it? *Answered 2026-10-19 (Calculation ratified): `Calculation::Damage-Taken Formula` is the inbound tag.*
2. "As if X% more/less stat" (Infusion, Necronomicon, The Crimson): this changes the stat *value* the calculation uses
   without changing the real stat. Under criterion 1? *Answered 2026-10-19: Attack / Spell Formula.*
3. Is the scope damage/potency only, or every formula? Frenzy ("dodge and crit as if 100% more Speed") changes the dodge and
   crit calculations, not damage. *Answered 2026-10-19: damage / potency only; Frenzy → Hit Resolution.*
4. Plain damage multipliers (Vital Shot, Aimed Shot, One-Hit Wonder) carry `Modify Attack Calculation` today. Under the three
   criteria they look out of scope (→ Affect on Damage). *Answered 2026-10-19: out, → Damage::Deal More.*
5. Class advantage forced (Bloodline, Details Matter, True Strike's second half): this is a multiplier inside the
   calculation, not a stat or a bound. In or out? *Answered 2026-10-19: in, as Calculation::Class Advantage.*
6. Ignore X% of Defense (True Strike, Homing Arrow): this reduces the defending stat used. Is that criterion 1 on the
   inbound side, or does it stay with its own tag? **Answered 2026-10-18 (user): Calculation, as `Calculation::Ignore Defense`.**
7. Fixed 0 damage (Phasers): does this count as a bound (max = 0)? *Answered 2026-10-19: yes, `Calculation::Bounds` = clamps and forced values; random ranges (Cold Blood) are not Bounds (user 2026-10-19).*

**Grounding.** _To define after the rulings: which code paths prove membership (the attack damage, spell potency and
damage-taken routines in `_su_extract`)._

**Log**
- 2026-10-18 — Intent and the three in-scope criteria set by the user.
