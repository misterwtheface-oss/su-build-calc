# Decisions and user rulings — Siralim Ultimate build calculator

Standing decisions the user made about how the app models the game. Don't "fix" these without asking. Moved verbatim from
the assistant's working notes on 2026-10-08 (they existed nowhere in the repo). Add new rulings here when they're made.
Taxonomy category definitions themselves live in `TAXONOMY.md`.

## Taxonomy Side marker (2026-10-25)
- Side is relative to whom the **effect** affects, not to what an action it causes targets.
- On Auto Attack / Auto Cast / Auto Defend / Auto Provoke the affected creature is the one that acts: Your side = your
  creatures attack / cast, Enemy side = enemy creatures do. It comes from the code's `actor`, never from the action's target.
- **This creature** narrows Your side: the effect's own creature is the one affected (on automatic actions: it acts itself).

## Buff / debuff source notes (2026-10-23)
- **Approved as proposed (user):** the extract's S50-reviewed "who counts as the source" notes ship as clarify notes (693:
  the 31 approved medium entries, the reworded high ones, the fixed refuted ones, 7 new entries; Anagnorisis and Unbound
  Hatred dropped). Wording as reviewed. Source: `_su_extract/code/COMBAT_RULES.md` § Buff / debuff source "Merge rule".
- **Enemy-side-only traits are boss traits (user: "most of those are known to me as boss only"):** Night Terrors,
  Protective Wing, Cornered, Curse of the Barrens, Body of Althea, Curse of the Deep only work for an enemy holder in code.
  Consistent with the code; no app change.
- **Egg-log carries both Named Buff::Defensive and Named Buff::Proficient (user):** text says Defensive, code adds
  Proficient (condition 7). Provision: if Defensive is ever seen added in the code, drop Proficient. Implemented as
  crosswalk `object_adds` with `unless_code_named: "Defensive"` (tools/taxo-v2.mjs drops the add and build-data warns).

## Creature detail Triggers (2026-10-18)
- **Perks and party members' traits are listed too (user):** spec perks and anointments sit in the same event groups as the
  creature's own effects. They are listed only on the creatures they concern, not on every creature. Example: Animator's
  Death and Decay ("After an enemy is killed, your Animatus casts Corpse Explosion") shows only on the Animatus. "Concern"
  = the creature can set the effect off (the trigger clause names it: "After your creatures attack") or carries it out (the
  main clause names it: "your Animatus casts", "your Chaos creatures gain", "your creature with the highest Attack").
  A party member's trait whose trigger is its bearer ("After this creature provokes, your creatures gain …") stays on the
  bearer's page. Perks that name no creature of yours (enemy-only, "you") are not listed.
- The scope is read off the game's own text (`tools/trigger-scope.mjs`). Code perk signatures confirm the named race
  where they gate on one; build-data warns if they disagree (Apostle: code shows only the Godspawn gate).

## Display names (2026-10-13)
- **Real display names only (user):** every name the app shows for a tokenized attribute or an inferred label is the game's
  own localized text. `{TOKEN}` words come from `_su_extract/data/model/token_names.json` (the game's text renderer,
  `process_complex_macros` → `scr_Lang*`), never from a key humanizer or a hand list; the build fails on a token it
  can't name. Condition names follow `scr_LangCondition` (Burning, Silenced, Dire Wolves, Torun Junior …); action/stat
  words keep the game's capitals (Attacks, Charges). Realm properties use their `L_REALM_*` name with the rolled value as X
  ("Extra Attack: X%"); runes use their `L_RUNE_NAME_*` line (the game has no shorter name).
- **Skins carry their localized `L_SKIN_*` names** everywhere, including the frame index.

## Bosses (2026-10-11)
- **Instant-kill rule shown again (user 2026-10-25, "Add the clarification"):** the boss-battle instant-kill rule (20% of
  missing Health instead; Loif En't Fair, Boils Popped, Death By Boredom, Incandescence still kill) is a line in each boss
  page's Damage section after Creatures (not a chip: no chips before Threats still holds); not on Jotun or Lister, whose side
  takes no damage.
- **False God names = the game's own text** (`L_WBOSS_*`): Imp Impington Reborn, Caliban the Unredeemed, Jotun, Lost Construct.
- **Misery is not a False God.** Its three traits are provisionally Perdition's (Gate of the Gods); the user will confirm in-game.
- **One boss feature for all three boss types** (False Gods, Nether Bosses, Gate of the Gods) on one data source
  (`_su_extract/data/model/bosses.json`). Boss stats stay at level-1 base; the app does not scale stats above level 1.
- Upcoming 3.0 content (the "False Godspawn" creatures) stays behind the NYI feature flag.
- **Boss page layout (user, 2026-10-11):** whole-creature formation (parts edge to edge, still links), a **Threats** section
  (one container per major threat: title, the causing steps, a plain "why it matters"), spells as full spell containers,
  **Rewards** at the bottom (Anointment = a perk from one of the listed specs; Inscription = one unknown spell from the
  boss's list). Boss grid: 2 tiles per row, whole-creature art. Part cards: head, body, arms, shoulders (grid 2,5,4,6,1,3).
- **Runes on a boss page = per-boss advice only** (user): Recommended / Avoid with a reason drawn from that boss's kit; the
  plain rune list (identical for every False God) is not shown there.
- **Bosses list = the Realms page's toggle** (user, 2026-10-11): Nether Bosses | False Gods | Gate of the Gods, in that order;
  a type with no data yet shows a disabled tab.
- **Nether Boss page** (user, 2026-10-11): simpler than a False God page, same shape: a 1st fight | 2nd fight | 3rd+ toggle
  (the boss trait tier = times beaten), Threats, a base-stat table with magnitude bars, Creatures, Rewards (the boss's 3 trait
  materials with their traits, plus the every-win rewards). False God base stats use the same magnitude-bar table.
- **Gate of the Gods page** (user, 2026-10-11, "implement their pages as well"): Nether-Boss shape without tiers (one god
  trait): fight notes (random realm fill + loadout, your creatures at level 100, enemy level formula, instant-kill rule),
  Threats, base stats (bars), the Avatar card (god trait + its replaced own trait), a Difficulty table (level multiplier,
  Emblems, Avatar Mana, costume chance), Rewards (+ the god's costume; skins not listed until the code names them), Lore.
- **Boss pages: no chips before Threats** (user, 2026-10-12): no note chips at all above the Threats section (generic or
  boss-specific). Nether pages lead with the boss sprite, like Gate pages.
- **Boss creature cards** (user, 2026-10-12): never reference the base creature (card name = boss name, none in threat text);
  show the boss/god trait only, no own trait, no base-creature chip; no
  data-source callouts. Duo bosses (two different boss-trait creatures) show both sprites everywhere the boss sprite shows.
- **Boss threat text must come from the extracted game context** (user, 2026-10-11): "Any recommendations and threat analysis
  need to be analyzed against actual extracted game context not made up". Nether threats are authored in
  `data/reference/nether_boss_advice.json` from the code behaviour (bosses.json `boss_traits[].behaviour` / `code_vs_text`,
  NETHER_BOSS_BEHAVIOR_FINDINGS) plus the extract's game rules (timeline, crit, Defending, sourceless damage ticks, Shelled vs
  indirect). build-data rejects a missing tier or code-like text.

## Data joins
- **Lesson (user-flagged twice): when a name-join undercounts,
the spine/join source is wrong, not the data — the sprites/classes DO exist under a better key.**

## Endowment (user in-game, 2026-10-18)
- Animator's **Endowment** fuses the Animatus with a copy of party creature #2 at battle start. Only base stats change: each
  = floor((Animatus base + creature #2's PRIMARY creature's plain base) / 2), the normal fusion average (code; see below).
  The Animatus gains creature #2's
  primary (innate) trait, not its fused trait. Race becomes creature #2's race; class stays the Animatus's.
- **Shown in the planner (user):** the Animatus's base stats, traits and race everywhere in the app are the endowed values,
  not a separate battle view. The detail header reads "Animatus ⚭ <creature #2>", traits "(innate + Endowment)".
- **Code answer (extract S36, `_su_extract/code/HANDOFF_endowment.md`):** confirms the primary trait (set in the fused-trait
  field `passive2`), class kept (`scr_CreatureClass` returns the stored class inside battle), race = creature #2's current
  race, slot = party position 2 exactly (empty → nothing), none of creature #2's scrolls/personality/level carried, battle
  only (fuse fields restored at cleanup).
- **Deprived keeps the Endowment trait** (code): Total Deprivation clears `passive2` earlier in the same Create event, then
  Endowment sets it again. The app now keeps it.
- **Stat partner = plain base (user ruling 2026-10-18: "go with what the code says"):** the code stores only creature #2's
  own creature id as `fuse2`, so the average uses creature #2's PRIMARY creature's plain table base, not its fused base.
  This replaces the earlier fused-base reading from the in-game test.

## Artifacts, nether stones, spell-gem dusts (user ground truth)
**ARTIFACT SLOT TEMPLATE (user ground truth, 2026-09-17 — datamine couldn't extract, was runtime/level-scaled):**
every artifact at max level = 1 Primary (the stat tied to the type) + **3 Stat + 2 Trick + 1 Trait + 1 Spell +
1 Nether**. Nether stone has its own internal property rules but the artifact holds exactly 1. App artifact model =
`{primary, stat[], trick[], traits[], spells[], netherIds[]}` (caps 3/2/1/1/1); old `{props[],traitItemIds[]}`
migrated in place. Wizard = fixed slots in slot-type order, each box opens a type-filtered picker (counts enforced
by construction). **Nether stones = library + 2-step wizard** (gem+name → properties), properties drawn from the FULL artifact
stat+trick pool unrestricted, each `{prop,value}` (user-entered %); `artifactPctOf` resolves via propGroups
(core-stat props hit the 5-stat table, trick props display-only). Old `{type,stats[]}` nether props auto-migrate
to flat `{prop,value}`. **SPELL GEMS are a first-class buildable entity** (2026-09-17): artifacts / nether stones / spell gems are 3
SEPARATE things. A spell gem = 1 spell + up to 3 **enchant items = the "Dust" items** (`L_IN_DUST_<gem>` in items.csv: Jasper/Topaz/
Citrine/Agate/…21; effect from `L_ID_DUST_<gem>` e.g. "More Charges", "Defense Penetration", "Cascading") — used
at the Enchanter. `SU_DATA.spellProps` = these 21 dusts (name+effect). **ITEM→SLOT TAXONOMY (user, corrected):**
Ambers(item_class null)=artifact STAT slots · Slates/Curios/Cripplers(item_class 1)=TRICK slots · trait items
(item_class 2)=TRAIT slot · **Dust/gemstones=spell-gem enchants** (NOT Slates/Curios — that was wrong). **Dust per-gem
GENERIC + class-coloured, not per-spell** (per user): `gem_<colour>_lvl4` sprites mapped to class by PIXEL COLOUR —
Nature=gem_nature, Chaos=gem_chaos, Sorcery=gem_sorceryB(blue), Death=gem_sorceryP(purple), Life=gem_lifeG(gold);
- Nether spells carry ONLY a trigger (no visible chance); migration strips the old `chance` (user).

## Creatures and UI
- **Containers under objects** (user 2026-10-21/22): spells an object casts or grants, and buffs / debuffs it applies or always has,
  show as spell-gem / status-effect containers in one row under it, from the code layer only (no text matching).
- **Effect order: secondary calls stay, indented** (user 2026-10-21): a check an effect makes inside its own block (Triple Take
  under Master of Golems) is kept in the Start of Battle list, indented under that effect, unnumbered, marked "Secondary call".
- **One tag filter (user, 2026-10-19).** Every taxonomy filter in the app goes through `TagFilter` (app.js): chips, side
  toggle, ＋ Filter, picker index and match. A new filterable list adds a `TF_SRC` entry (objects + their tag keys) and
  calls `TagFilter.bar` / `TagFilter.match`, never its own filter state or picker.
- **Page names (user, 2026-10-11):** Appendix → **Taxonomy**, Glossary → **Status Effects**, Errata → **Appendix**. Internal
  ids keep the old names; notes dated before this use the old names.
- **Status Effects live in the Appendix (user, 2026-10-12):** one "Status Effects" section of the Appendix, with Buffs,
  Debuffs and Minions as collapsible sub-sections; no separate Status Effects page. Supersedes the Glossary/Errata split below.
- **No casting chips on perk spell cards (user, 2026-10-12):** spell containers under a specialization perk show no
  trigger/chance chip; the perk text already states when it casts.
- **Glossary vs Errata (2026-10-10):** the Glossary holds only Buffs, Debuffs and Minions. Every other reference table
  (resurrection / start-of-battle order, drop and shrine odds, realm bonus, Rodian Masters, and new ones) goes on the
  Errata page, same layout; its menu button sits right below Glossary.
- **Battle-only spells (2026-10-10; corrected 2026-10-11):** spells that can't be held as a gem (Ultimates, Runes, Mega Magic,
  Colorwave) are hidden from every spell picker. The 51 False God spells (ids 493–543) are NOT battle-only: each False God drops
  them as Inscriptions (user, confirmed in code), so they are pickable gems. The False God is their source; a specialization
  that starts with one of the recipes (Shadowbringer → Plague, Toxicologist → Devastation) is an exception, not the source. Sandbox mode is never a signal for availability
  (user ruling 2026-10-11: it does not reflect the core game; an Ultimate being craftable in Sandbox doesn't make it a normal spell). Battle-only spells show up automatically on the
  creatures they belong to, under the owner's condition, without using a spell-gem slot (e.g. Rune of Cor only on Chaos
  creatures and only while the Rune of Cor perk is allocated or anointed).
**v2.20c — personality = FLAT ±33% on base (FINAL, per user):** dropped the entire level lens
(slider/number field/`previewLevel`/`renderLevelBar`/handlers/CSS all removed). Personality now just applies
a flat modifier to base: raised **×4/3 (+33%)**, lowered **×2/3 (−33%)**, others unchanged (= end-game
- **Reset stays a visible header button** (user: keep it out of the menu).
- **No trait icon exists (would 404) — never render one.**
- **Synergy counts relics + nether spell-props, NOT cards** (per user). Nether stones derive taxo from socketed contents.
  The perk-tree picker backlog item was DROPPED (doesn't exist in the game).
- `classifyRealmOutcome` / `realmOutcomeCats` / `realmCatMax` / per-realm `outcomes` are all GONE — don't reintroduce.

## Reconciliation and provenance
- **STRUCTURE FACTS (validated, don't re-derive):** Deities==Avatars (31 gods = 31 roster Avatars, player Avatar
  trait + encounter Deity trait, 62 total); every Nether Boss = **3 same-name escalating tiers** (extras are dup
  empty-prose/stale copies, wiki-tier-1-verified → dropped); False-God part dupes VALID (Nebodar 2 wings/2 claws);
  Lord Zantai=Zantai encounter form; Caliban triple-form (Avatar+Deity+FalseGod).
- **creature_reconciliation.json** (1419) · **item_reconciliation.json** (1862 cat, 1719 linked, 81 unlinked=
  data-limit, left per user) · **spells** 747 all live, Source/Potency/Target from `Spell_REF.csv`, charges
  code(712)+community(35). Generators in `_su_extract/code/build_{creature,item,unresolved}_*.mjs`.
- **PROVENANCE RULES (user-enforced):** wiki maps but doesn't assert PRESENCE; no invented categories; no
  name-match identity (trait≠same-named perk; creature-with-stats≠spell); `material_stats.trait_id` DRIFTS (never
  trust); in-game observation beats stale CSVs (`Trait_REF` was stale for Marionette).

## Taxonomy rulings
- **Round 7 (user 2026-10-24).** Every Involves needs a narrower child ("Involves on its own is an anti-pattern"): artifact
  slots are values Artifacts::Spell / Stat / Trick / Trait Slot. Hook re-runs = Events::More Activations + event marker;
  whole-event suppressors = Events::Suppress. Markers st / sk / cl narrow a tag to the stat / status / class the code names
  on that tag (tag-bound only); the object tags (Stat::, Named Buff / Debuff / Minion, Spell Class) stay. Defer Pain's Take
  Less is marked delayed. Details: TAXONOMY_INTENT.md Log.
- **Round 7F (user 2026-10-24): damage redirects.** Actions::Intercept = another creature takes all or part of a hit,
  whatever kind of hit it reacts to (Forged by Pain belongs with Savior), narrowed by Source (what it reacts to), Resolves as
  (Indirect / Same hit) and Share (Whole / Split / Copy). Stand As One and Training Day are Intercept too ("they belong
  together thematically"). **Damage::Inflict = dealing damage, not redistributing it**: no intercept, copy or delay carries
  it. CAWW! is Actions::Redirect (Attack), like Hoodwink.
- **DoTs are never Damage::Inflict (user 2026-10-24, recorded ruling: "DoTs shouldn't count as Inflict at all").** A
  damage-over-time tick (Poisoned, Burning, Bleeding, Bomb, Mania: the conditions whose damage the code computes per tick with
  their own calculator) is not Inflict, on the condition or on an effect that changes or re-runs the tick (Poison Inoculation,
  In Flames, Deathwalker's, Diagnosis, Living Flame perk, Fleshripper). New damage dealt to other creatures sized from a tick
  (Tainted Blood, Chain Reaction, Cornered ...) or from a DoT (Raze, Virus, Smolder, Snuff) is still Inflict.
- **Code-backed means the code decides, not the text (user 2026-10-24).** Calculation::Spell Formula comes from the spell's
  code (its calculator case reads a stat other than the caster's Intelligence, a calculator block is gated on it, or its cast
  computes its own damage), so spells whose text doesn't say it (Pumpkin King's Wrath: Speed) carry it.
- **What Spell / Attack Formula means (user 2026-10-24):** "Spell Formula is primarily about changing the results of the
  calculation compared to another normal spell like increasing the damage is changing the stat used in calculation." So a
  Formula tag = the result comes out differently from a normal spell (or attack) of the same kind: another stat, another base
  (% of Health, another creature's stat, a condition's potency), an extra calculator step, or a change to the potency stat
  itself. Not: the normal formula held in a local or shared out; plain multipliers (Damage::Deal More); an amount sized from the
  damage the spell dealt; defense terms (Ignore Defense / Damage-Taken Formula). Healing and stat spells with their own amount
  count (Enlightenment, Unholy Rage, Frost Armor ...). Spell Formula no longer derives the Damage theme.
- **Status tags the code does not back are removed (user 2026-10-24, "Go ahead"):** Empowered Savage Spores Buffs::Apply,
  Hymn of Guile and All Hope Is Lost Debuffs::Apply, Moonfire & Sunfury R90 Debuffs::Remove (extract round 7S,
  `_su_extract/code/CODE_TAXO.md` § Round 7S). A theme stays only where another tag still gives it.
- **Auto Attack only where the code forces an attack (user 2026-10-25: "They should drop Auto Attack if they do not force
  an attack event to occur"):** Actions::Auto Attack needs an attack the effect makes a creature perform (bc_CreatureAttack).
  Dropped on Antithesis (only applies Inverted), Simulation (only casts), Evil Eye (a direct hit) and Tacos Inflation (changes
  the attack already happening); Attack theme off Simulation and Evil Eye (nothing else gives it), kept on Antithesis and
  Tacos Inflation (Trigger::Attack). No replacement tags (extract round 8A, `_su_extract/code/CODE_TAXO.md` § Round 8A).
- **A theme needs a narrow tag (user 2026-10-21):** a theme carried only by a general Involves tag, with no narrow tag of
  that theme, is dropped. E.g. "spells cost no Charges" effects keep Spell Gems (Spell Gems::Charges) and lose Cast.
  Per-object drops live in `taxonomy_crosswalk.json` `object_drops`.
- **Involves = umbrella view (user 2026-10-20).** `Involves::<theme>` is on every object for each of its themes (the old
  generic Action/Mechanic role: everything touching a mechanic at once). Theme-only objects (theme from a v1 tag, no v2 tag
  re-derives it) get a narrower tag from the extract (HANDOFF F5); they are no longer shipped as Involves tags.
- **Taxonomy v2 rollout (user 2026-10-20).** Mechanic groups accepted as drafted (may be tweaked in use). Refinements
  (source / timing / delivery) work like the side toggle. Every feature reads v2. No CSV parity pass for the taxonomy (the
  CSV is personal). One cutover retires v1 once the extract's remaining items (F4, F5) are resolved.
- **Heuristics find, code decides (user 2026-10-19).** LLM / text / token / keyword / co-tag heuristics are for working at
  scale: reading an effect's likely intent and where to look. Validation is in the code only; an unconfirmed heuristic is
  an extract work item, never a shipped tag. Charter: TAXONOMY_INTENT.md global rules.
- **Taxonomy v2 ships code-backed tags only (user 2026-10-19).** Supersedes the "union" and "unverified candidates"
  rules below. Kept: code (code layer, or v1 grounded in code_taxo), code_boss, field. Everything else (llm, token, audit,
  build-time corrections, keyword, implied, undecided splits, guessed Targeting::All, v1 triggers the code lacks) is
  removed and listed for the extract (`app_removed_not_code_backed.json`, HANDOFF_taxonomy_v2 F3). User: a trigger the
  text names must exist in code (Furor's turn start); the extract finds it.
- **Taxonomy v2 build rules (2026-10-19).** (1) Union: every v1 tag maps through the crosswalk (keeps approved v1
  corrections) and the extract's code tags are added; where the code tags a value its entries and attributes win, and it
  decides v1 splits. (2) Splits the code can't decide ship every candidate marked `unverified`, queued for review.
  (3) Rollout: v2 ships next to v1, app features move over one by one behind a script flag, one cutover retires v1
  after the CSV parity pass.
- **Taxonomy v2 (2026-10-18).** Later the same day: Source attribute ratified, Targeting category added, Ignore Defense → Calculation, v2 maps to decoded game functions rather than mirroring v1.
- **Taxonomy v2 extract S38 parked items (2026-10-19).** New Trigger::Minion Lost, Minions::Remove, Actions::Limit Repeats. Leave-chance = Minions::Extend; damage immunity = Take Less; Tempest = Targeting::All; enemy-side locks = Can't Manually X (Enemy); chance to avoid debuffs = Debuffs::Immune; Glitch In The System = Can't Gain + Apply; Master of Carbuncles / Storms = More Potency only. Lord of Undeath note waits for an in-game check.
- **Taxonomy v2 values ratified (2026-10-19).** Every domain approved by the user; log in `TAXONOMY_INTENT.md`. Changes from the draft: Extra = same creature + same action; locks are "Can't Manually X"; Inflict Direct / Indirect → Damage::Inflict (Source carries type; a trait's "deals damage" is spell-type); "as if X% stat" → Formula, Frenzy → Hit Resolution, plain multipliers → Deal More, new Calculation::Class Advantage; Buffs::Can't Gain; Debuffs::Bypass Protection; Stats::Set (general overwrite); new Condition::Turn Number; Non-Ultimate / Non-Ethereal fold into the base kind; Spell Gems keep the code split (Charges = charge writes).
- **Taxonomy v2 extract rulings (2026-10-19).** New Delivery attribute (Event / Direct) on Stats::Gain / Lose and Buffs / Debuffs::Apply: direct writes fire no reactions and skip limits. Phase gains During (mid-action hooks). Xyrxzy's Control = Extra Attack (code wins, clarify note). Cold Blood is not Bounds.
- **Taxonomy v2 Role, Phase, Stats split (2026-10-18).** Ratified: Role (Performer / Receiver / Applier) and Phase (Would / After / Repeat) as Trigger attributes; Stats split into Gain / Lose (stat events) vs Has More / Has Less (passive getters).
- **Taxonomy v2 shape (2026-10-18).** Rebuild the taxonomy from scratch, keeping every distinction. The user approved
  four calls: scope is a per-tag attribute (not in value names); Action/Mechanic is derived as Theme, not hand-tagged
  (the superset rule holds structurally); Extra vs Automatic is split for attacks and casts; Buffs and Debuffs are two
  parallel domains. Charter, draft values and open questions: `TAXONOMY_INTENT.md` "Taxonomy v2". Values stay DRAFT
  until ratified.
  Single/Multi-Target from `Spell_REF.target` (Target=single; Enemies/All Creatures/Your Creatures=multi; 663
  spells, src=`field`). **Combined:** Indirect Damage = LLM status/DoT + proc "deals damage to X equal to Y%"
  (ADD-only, +68). **Dropped by user:** Effect Limitation (whole category, −808), Active If::Spell/Gem is X Type
  (value, −16). **ADDED to close false-negatives:** all-stats bundle → Related Stat Attack/Int/Def/Speed(+MaxHealth
  unless omit) (+333); Innate Trait where desc says "innate trait" (+14).
- **Definitional divergences LEFT AS-IS (user chose):** Active If::Creature is X Type (153 — we use Related
  Types::<Race>), Action/Mechanic::Cast (121), Activates When::Ally Casts (53) — user's defs are BROADER; app's
  more-specific categorization stands.
- **RULE the user gave for tag intent:** class names (Nature/Chaos/Death/Life/Sorcery) DOUBLE as spell-class &
  gem-class → a bare-name match over-tags spell/gem effects as creature-class; always anchor on the word "creature"/
  "class"/actual creature ref. "All stats"/"base stats" WITHOUT a Health omission IMPLIES every stat (incl. Max
  Health). Active If = always-on effect gated by a persistent condition ("Active If: Buffed with Barrier"), not a
  trigger. Auto-Defend/Provoke = the Defend/Provoke ACTION (of Attack/Cast/Defend/Provoke). Re-validate after any
  taxonomy regen by re-running `tools/mtx_compare.mjs` (needs the two Downloads CSVs).

### 2026-09-29 (cont.) — PER-OBJECT AUDIT (reverse pass) + TAXONOMY.md + override layer
- **`su-build-calc/TAXONOMY.md`** documents all 23 categories AND every subcategory's intended coverage +
- **One systematic rule from the audit:** spell Damaging Spells strips "absorbs …damage" (Barrier) clauses
  before the damage check (Corpse Shield/Divine Aegis/Holy Armor were wrongly Damaging).
- **User rule:** an effect dealing "damage WITH attacks and spells" tags BOTH Attack and Cast — don't strip
  Cast there; only strip Cast when "spell" is a passive damage-source/immunity qualifier ("damage FROM an

## Realm object treasure notation (2026-10-09)
- Realm_REF `[N]` after an object name = number of that object per realm. Treasure lives in the rank-0 effect string as
  `Treasure [n]` where n = code bundles for one interaction (no favor ranks, no other bonuses). An object whose treasure only
  comes from a favor rank gets `[n]` on that favor row (its base bundles, nothing else).
- Boss rooms: 2 chests × 6 bundles = `Treasure [12]`; Nether Boss rooms 18. The +5 boss-room blessing is a favor bonus, not
  part of rank 0.


## Realm yield model = the user's rules (2026-10-10)
- The Yield and Compare views read `_su_extract/data/model/realm_yield_model.json` (community copy
  `audit_community_csv/Realm_Yields_CODE.csv`), built rank by rank with the user from code
  (`_su_extract/code/data_dump/s27/walk/`, rules in `_su_extract/code/REALM_YIELDS.md`). It replaces
  Favor_CODE.csv below.
- Per realm × difficulty (Relaxed / Normal / Ruthless toggle) × favor rank: favor, treasure bundles, net resources,
  emblems, knowledge, spell recipes, tickets, realm boosts, spawn chances (Golem / Dumpling kept for Prophecy goals),
  guaranteed nemeses. The god-altar donation is always made (in favor and net resources, no column); generic chests are
  5% Mimics (5 bundles + a fight). Common (all-realm) bonuses are one shared row per rank.
- Key rules: realm bonus 0; other gods ignored; choice objects at full weight per outcome; chance outcomes weighted, game
  floors kept; boost caps as the true average; costs paid every run; one god-altar donation per realm; Golem / Dumpling
  one-hit KO; roaming battles not counted.

## Realm yield source = code (2026-10-09) — superseded 2026-10-10 by the yield model above
- User (2026-10-09): "replace our data source for the yield calculations with fully code grounded data".
- The Yield tab reads `_su_extract/audit_community_csv/Favor_CODE.csv` (code). `data/favor/Favor_MTX.csv` (user) stays as
  the diff reference and is no longer read.
- Expected value per floor = placed count × per-interaction expectation.
- Random outcomes are weighted by their code odds.
- Player-choice objects are averaged evenly: Clock, Star, the vomiting Fruit / Squash / Tarot Cards, and the Music Crystal
  / Alchemy minigames.
- Code ≠ Realm_REF text keeps the code value. The list is in `REALM_YIELDS.md`; the Realm_REF strings are not yet patched
  (pending the user's ruling).

## Realm property rules surfaced (2026-10-09)
- User (2026-10-09): "we'll also need the realm property conflict rules decoded so we can surface those in the app and
  calculate the true maximum item bonus".
- Shipped minimal, pending the user's review of placement:
  - a glossary "Maximum Realm Bonus" table;
  - the Nether Stone table capped at that maximum;
  - a "Visible only" chip in Threats.
- The 7 ↔ 16 exclusion stays data-only: both are hidden from the Threats advisor as composition flavour.
- **2026-10-18 — Minion Spells = literal; Dark Summoning's pool = the game's MINION category ("I want both").** `Related Spells::
  Minion Spells` lists every spell that deals with minions in a literal sense (summons, adds stacks, scales with, removes, or
  casts them; 42). Dark Summoning picks only spells with the game's own MINION category (26, code-certain); the 16 tag members
  outside it carry a clarify note. Supersedes the same-day "code-only membership" note. Mega Magic (Zantai's Call), Apocalypse
  (Four Horsemen) and Dispel / Mass Dispel / Divinity stay out, parked for the taxonomy intent audit.
- **2026-10-18 — Count as Manual** (Affect on Spells): Superfluidity, The Great Beyond, Embrace the Arcane, Pandemonium Wrath
  (code-confirmed: its repeats are queued as manual casts).
- **2026-10-18 — Relic tag counts: no threshold.** Every per-rank tag counts; a relic's tag chip shows "×N" when N ≥ 2 of its
  ranks carry it (nothing for N = 1). Lamora's "Creature of X Type Count" → "Debuff Count"; whole-relic tags no rank backs are
  dropped (Fable, Mutatias, Salus, Starwrath).
- **2026-10-18 — Resurrection Order follows the code order** (not a note): resurrection rows in bc_OnDeath call order, blocker
  rows where the code checks them, then the queue-time checks numbered in their check order.
- **2026-10-18 — Artifact trick slots: one copy per trick property** (the blacksmith's rule). Stat slots allow repeats.
- **2026-10-18 — Per-rank relic tags join the relic only when code-backed.** The 21 per-rank tags missing from the whole-relic
  list are all `llm`, so none were added. Untagged traits are an error to fix with code-grounded tags (taxonomy review).

## Bookmarks belong to a saved build (2026-10-24)
User: "save bookmarks to the saved build". Each saved build stores its own bookmarks (`bk` on the saved entry), written on Save
and Update and restored on Load. The live bookmark list stays one global list for the current party. Bookmarks are not part of the
export / share code.

## Macro tank actions and attacks (2026-10-24)
User: Defend and Provoke lines are status-checked: Defend only without Defensive, Provoke only without Taunting (code: both
buffs perform that action at the end of the turn). A tank whose buffs cover the tank actions it prefers falls back to its
spells (Knight Effigy). A creature with nothing naming it a viable attacker never defaults to attacking: an attack can
trigger enemy effects, so it is a liability.

## Macro: spells worth more than one cast go first (2026-10-24)
User: "Replicate is the priority because it has greater value per cast." A spell that casts several of the caster's other
spells comes before every other spell line, after the life-saving ones.
