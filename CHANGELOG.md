# Changelog — Siralim Ultimate build calculator

Every dated change entry, newest first (moved verbatim from Progress.md on 2026-10-08; nested dated entries were promoted
to their own section and sorted by their date). Current state and open work: `Progress.md`, `BACKLOG.md`.
New entries go at the TOP.

## 2026-10-24 — Forgotten Blessing raises Relic stat bonuses in the calculator (extract S55)
- New effect rule `relicRanks` (Antiquarian's Forgotten Blessing, spec or anointment): +100 Relic ranks for the Relic's stat
  bonus only (`scr_RelicStatBonus`), so a rank-57 Relic gives +15.7% instead of +5.7%. Rank-gated Relic perks are unchanged.
  Locked Relics with Reliquary Synergy aren't modelled (the planner has no Reliquary unlock state); the clarify note covers it.
  Engine tests 49 -> 51.

## 2026-10-24 — Nether Bosses: trait materials come from Nethermancer Ned's Nether Shop (code)
- The materials were listed from the wiki table. In code they are bought: Ned's Nether Shop sells a boss's n-th material for
  50,000 Brimstone once that boss is beaten n times (extract `nether_shop.json`). Each material row shows "N wins · 50,000
  Brimstone"; Blacksmith Ianne's 1- and 2-win materials are swapped vs the wiki (clarify note on each).
- New row "Nether Shop: skins after 4 wins" with the boss's own skin(s). The code price (1 Brimstone) awaits an in-game check
  and isn't shown.
- The materials' trait depth tags come from the code too (Ianne's Eccentricity 250 -> 75, Quirk 75 -> 250). Lord Zantai's 10
  traits (not sold by Ned) keep the wiki depth. The wiki table now only cross-checks the build.

## 2026-10-24 — Four status tags the code does not back, removed (extract S57)
- User ruling ("Go ahead"): removed Empowered Savage Spores Buffs: Apply, Hymn of Guile and All Hope Is Lost Debuffs: Apply,
  Moonfire & Sunfury R90 Debuffs: Remove (extract round 7S). Their themes follow: Empowered Savage Spores loses Involves: Buff,
  Hymn of Guile Involves: Debuff; every other theme stays (another tag still gives it). Rebuilt data only. Taxonomy check: 0
  gaps; tests 27/0 and 49/0.

## 2026-10-24 — Status markers on Has Buff / Has Debuff and the other status tags (extract S56)
- User: "Has Debuff, Status: Feared" missed Horror Show. The extract decoded the status each unmarked status-tag entry checks or
  changes from its own code site (119 of the 123 listed: 110 named, 9 Any). Rebuilt data only: shipped entries with a Status
  marker 1,520 -> 1,640. Horror Show = Feared; Dream Stomp = Sleeping; Spectral Rain strengthens only Barrier / Poisoned /
  Burning / Bomb; Searing Flames removes Any. 4 tags stay unmarked because the code does not back them (Empowered Savage
  Spores Buffs: Apply, Hymn of Guile and All Hope Is Lost Debuffs: Apply, Moonfire & Sunfury Debuffs: Remove), held for the user.

## 2026-10-24 — Currencies: clarify notes (extract S55)
- A Currencies line can carry `clarify: [..]` (`data/reference/currencies.json`; build-data ships it as `{t, clarify}`,
  shown as the usual `fx-clarify` notes under the line). Notes: Fusion Lab level match is a flat 3,000 Power; Reliquary
  Healing Bonus / Spell Damage do nothing, Stat Bonus raises the Relics' own stats; Arena Glory's Relaxed / Ruthless
  multiplier only on a lost run; Prophecy turn-in +15% with the Thylacine card (no game text).
- New Piety line (S55 decode): fulfilling the Goblet of Trials pays 125–150 × specializations unlocked (+ 10 + 3 × that many
  bundles). Forgotten Blessing gets a clarify note from `effect_clarifications.json` (its 100 ranks only raise Relic stat
  bonuses, locked Relics included).

## 2026-10-24 — Macros: Replicate-type spells first
- User (new Imp Bishop build): Replicate is the priority, it is worth more per cast. New `recast` purpose for spells that
  cast the caster's other spells (Replicate 2 per cast; Glory 30% × its other gems, up to 3). Worth more than 1 → a line
  right after resurrect / emergency heal / unsilence: `If this creature has > 0 living enemies, cast Replicate on this
  creature`. Self-aim spells now read `cast X on this creature`. Glory also lands in Sanctus's fallback.

## 2026-10-24 — Macros: fallback attack targets lowest Health, random enemy below it
- User (in game): "lowest Health" evaluates only the targetable enemies, so the fallback attack is the plain
  `If any enemy has lowest Health, attack that creature`. User follow-up: `attack a random enemy` stays as a safety net below
  it (a macro never picks an invalid action), so the tail order is unchanged: lowest Health → random enemy → defend → skip.

## 2026-10-24 — Currencies: every resource gets full earned / spent lines (extract S54)
- User: the five resources (Brimstone, Crystal, Essence, Granite, Power) were what the currency research was for. Each now lists
  every code-grounded source and sink: battle rewards with that resource's card sets, bundles, Resource Nodes (by realm),
  breakables, Treasure Golem hits, realm objects, Arcane Orbs, the Pandemonium shrine, the board game, Refinery Salvage /
  Grind / Convert, the start amount; sinks per resource (Blacksmith, Enchanter and Arena, Projects, Goblet / Fusion Lab /
  Summoning Brazier, Teleportation Shrine / Divination Candle) plus the shared ones (god altars by realm, offerings,
  Fellowdy's Nether chests, Nortah's Menagerie shop). The "bundle items hold 400" line is gone (no code hands those out).
- The S53 answers are in: Piety (Reliquary costs and Enhancement names, Prophecy Piety), Glamour (Everett's prices),
  Glory (Arena per run, Nether Arena Master), Stardust (Otherworld Portal, Nether Synthesis), Creature Parts, Perk Points
  ("1,550 collected"), Gate of the Gods Key (fragment combine, 1 per Keyforge mission; no more "game codex").
- Realm yield data rebuilt (extract fix: Resource Nodes are scaled by difficulty twice).

## 2026-10-24 — Macros: tank actions check Taunting / Defensive, no attack without a reason, dispel spells
- User (Knight Effigy): Provoke and Defend lines now check the buff first (`If this creature doesn't have Taunting, provoke`,
  `… doesn't have Defensive, defend`). The code makes a Taunting creature Provoke and a Defensive one Defend at the end of
  its turn (extract end_of_turn rows 120-121), so the manual action would be wasted. The tail Defend is gated the same way.
- A tank whose buffs cover all its tank actions casts its spells instead, Citrine gems included (Effigy: Rabid Dementia,
  Greater Dispel, Stun Beam). A provoker with Citrine on Defend also gets the Defend line.
- User: a creature with nothing naming it an attacker no longer attacks (attacks can trigger enemy effects). Attack lines
  need Citrine on Attack, Attack-led stats, Intelligence attacks or an on-attack payoff; Attack ≥ Intelligence alone is gone.
- New `dispel` purpose: spells that strip enemy buffs / cleanse ally debuffs (Greater Dispel was read as a single-target debuff).
  Aim `all` spells take no target.

## 2026-10-24 — New Build: no default sprite, "Pick Skin" until one is chosen
- User ask. The New Build form no longer pre-fills the spec costume; the dotted box reads "Pick Skin" until a sprite is picked.
  Saving without one keeps the library's empty tile.

## 2026-10-24 — Status markers on status triggers
- User: status triggers had no Status marker. The code layer already names the watched status on the trigger tag itself
  (condition_ids on Trigger: Buff / Debuff / Debuff Removed; dot on Trigger: DoT Tick); they now become its Status marker
  (registry name -> the game's display name). 83 trigger entries: DoT Tick 63 / 63, Debuff 14, Buff 5, Debuff Removed 1.
  Triggers on any buff / debuff stay unmarked (the code compares no status). Minion Gained / Lost and Buff Removed have no
  status in the code layer.

## 2026-10-24 — Marker toggles: type markers first
- User: side isn't on every tag, so the chips after it moved around. The refine toggles beside an active tag now start with the
  type markers (Status, Stat, Class, Event), then side / source / timing / delivery and the rest. Display order only; saved
  filter keys are unchanged.

## 2026-10-24 — Fix: minions missing from the status-effect containers (Vision Quest → Doppelganger)
- User: Doppelganger was missing from Vision Quest. The containers were built only from Buffs / Debuffs tags, so no summoned
  minion ever showed. They now also read code Minions::Summon tags (named minion, condition ids, or a single-minion status
  marker): 104 minion cards on perks, traits, relics and spells. Random picks and group-only markers (Four Horsemen / Lesser
  Demons without the exact minion, 17 rows) are left out rather than guessed.
- The anointment picker rows get the same collapsed container as the perk rows (opening it doesn't tick the anointment).

## 2026-10-24 — Stat / Status / Class markers bound per code site (extract S52i)
- The extract now binds each marker to the code block that performs its tag (gate pairs followed, per-stat cases joined, stat
  writes read with their direction). Marked tag entries: Stat 1,712 -> 1,914, Status 1,114 -> 1,436, Class 63 -> 93. Baffle and
  Ancient Wisdom now show under Stat: Intelligence on Scales With: Amount of X Stat. Values that had leaked in from neighbouring
  code are gone (Disarmed on Pyre / Rime / Stasis / Scourge / Black Hole Halo, the five classes on Class Advantage effects).

## 2026-10-24 — Fix: round 7 stat / status / class markers missing on v1-layer tags
- User: Intelligence didn't list Ancient Wisdom or Baffle. The markers were copied only from code-layer tag entries
  (`stat_marker` / `status_marker` / `class_marker`); a tag that came from the v1 crosswalk (Ancient Wisdom's Scales
  With::Amount of X Stat) never got one, although the extract binds its value at entry level. `tools/taxo-v2.mjs` now also
  reads `taxo_markers_proposal.json` and fills st / sk / cl on shipped entries the code left unmarked, from `entry`-level rows
  only (the round 7 tag-bound ruling): +148 stat, +29 status, +8 class. Amount of X Stat now has a stat on 153 of 256 objects
  (was 17); "Stat: Intelligence" on it lists 25 (Ancient Wisdom included).
- Baffle is still unmarked: its Intelligence is bound at `object` level only (the code reads the stat in another clause), which
  the ruling leaves out.

## 2026-10-24 — Taxonomy round 7H: what Spell / Attack Formula means
- **Definition** (user): a Formula tag means the result comes out differently from a normal spell or attack of the same kind
  (another stat or base, an extra calculator step, a change to the potency stat). Plain multipliers stay Damage::Deal More.
  Recorded in DECISIONS.md and the TAXONOMY_INTENT.md log.
- **Calculation::Spell Formula 129 → 157 objects.** +26 healing / stat spells that work out their own amount (Enlightenment,
  Unholy Rage, Evolution, Frost / Molten Armor, Self Analysis, Clayman, Divinity, Utopia, Vaccination ...); + Chaotic Mind,
  Chasing Infinity, Parity and Ribcracker rank 50 (found in the spell calculators); off Promethean Blaze (its damage is the
  normal formula × 1.3). Every carrier now has a code site.
- **Calculation::Attack Formula 21 → 18.** Off Vital Shot, Aimed Shot, One-Hit Wonder (plain multipliers) and Phasers (forces 0);
  on Brambleskin rank 80 (attack based on current Health).
- **Theme:** Spell Formula no longer gives the Damage theme (it now includes healing and stat spells); the Living shields,
  cloak, gauntlet and Clayman lose Involves::Damage.

## 2026-10-24 — Taxonomy round 7G: DoTs are not Inflict; Spell Formula from code
- **Damage::Inflict off damage-over-time ticks** (user ruling): Poisoned, Burning, Bleeding, Bomb and Mania no longer carry
  it, nor do effects that change or re-run the tick (Poison Inoculation, In Flames, Deathwalker's Strangulation /
  Destruction, Diagnosis, Living Flame perk, Fleshripper). Spread damage to other creatures (Tainted Blood, Chain Reaction,
  Cornered, Sharing Is Caring ...) keeps it. Recorded in DECISIONS.md.
- **Calculation::Spell Formula from the code** (extract round 7G): 44 → 94 spells. New: Pumpkin King's Wrath and the other
  spells whose damage uses Speed / Defense / Attack without the text saying so, the Runes, Chaos Bolt, Whirlwind, Ghostly
  Scimitar, Comet, and spells that compute their own damage (Raze, Virus, Shadow Crash, Meat Grinder ...). None lost it.
- Data rebuild only (data commit 15234ee; no app code change). Taxonomy check: 0 gaps; tests 27/0 and 49/0.

## 2026-10-24 — Taxonomy round 7F: damage redirects (Intercept markers)
- **Actions::Intercept** now covers every effect where another creature takes all or part of a hit (16 objects; Forged by Pain,
  Stand As One and Training Day join). Two new toggles narrow it: **Resolves as** (Indirect: a new indirect hit nobody is
  credited with / Same hit: the attack, spell or hit itself moves) and **Share** (Whole / Split / Copy). The Source toggle says
  what it reacts to (Forged by Pain, Undying, Stand As One and Training Day react to indirect damage too).
- **Damage::Inflict** removed from every redistributor (Savior, Forged by Pain, Undying, Patriarchy, Stand As One, Training
  Day, Defer Pain): user rule "Inflict covers dealing damage, not redistributing it". False Prophecy keeps it.
- Defer Pain's delayed Take Less carries its sources; **CAWW!** gets Actions::Redirect (Attack); every Redirect reads
  "Resolves as Same hit"; Patriarchy's Damage::Take More (no code) removed. Extract: `_su_extract` 8102db7.

## 2026-10-24 — Taxonomy round 7: Events category, artifact slots, stat / status / class markers
- New category **Events**: Events::More Activations (37 objects; effects that re-run a whole on-event hook, with an Event
  marker naming it) replaces Traits / Perks / Relics / Conditions / Cards::More Activations on those effects; 8 named-trait
  re-runs keep Traits::More Activations. Events::Suppress (8: the "... And Other ..." traits, True Ending); Traits::Suppress
  keeps Debilitate / Blank Slate. Inner Hatred / Ejector Seat lose Suppress (Inner Hatred: "Except Attack" on its Has More).
- Artifacts::Spell Slot (13) / Stat Slot (23) / Trick Slot (16) / Trait Slot (4); Artifacts::More Activations on 6 more
  (the Spell Slot activation raisers). Battle Born, Ferro, Better, Faster, Stronger now carry Involves::Artifact.
- Defer Pain: Damage::Take Less with "Delayed to next turn".
- New refine toggles on an active tag: Event, Stat, Status (buff / debuff / minion), Class — values only where the game code
  names them on that very tag (e.g. Scales With: Amount of X Stat → Stat: Defense = scales FROM Defense). The detail page
  shows them on the chip.
- Extract: taxo_v2_tags.json round 7 (code/taxo_v2_r7.py). Crosswalk: Events / Artifact slot values, event marker themes,
  retired census values and theme lines removed. Rulings: DECISIONS.md, TAXONOMY_INTENT.md Log.

## 2026-10-24 — Fix: bookmark star tap opened the details on phones
- User: tapping ☆ on a container opened its details page. The star glyph was a ~17×15 px target, so a slightly-off tap landed on
  the row (`apx-open`). An invisible `::after` on `.apx-bk` now widens the tap target to ~40 px without moving the layout
  (Taxonomy, Spec, Anointments rows). Checked at 390 px: taps up to ~12 px off the glyph bookmark and don't open details.

## 2026-10-24 — Taxonomy page: collapsible spell gem / status-effect rows
- The Taxonomy page's result containers now carry the same collapsible ▸ row of spell gems and status effects as the creature,
  spec and relic pages (one shared `spellRowWrap`): traits (creature, item-only and boss), perks, spells, and each relic rank.
  Rows with nothing to show get no toggle. Opening the row doesn't open the taxonomy detail.

## 2026-10-24 — Anointments: ✓ Equipped filter
- New filter chip **✓ Equipped** in the Anointments picker (user): shows only your equipped anointments. Anything you tick or
  untick while the panel is open stays in the filtered list, so an un-ticked one can be ticked again. The chip appears once
  something is equipped or ticked and combines with the other filters.

## 2026-10-24 — Appendix: Currencies
- New Appendix section **Currencies** (user; collapsed by default, searchable, after Status Effects): 17 currencies with the game's
  name, icon (inv_ItemIconIndex frame) and, where the game has one, its own description; then **Spent on** and **Earned from**.
  Brimstone, Crystal, Essence, Granite, Power, Emblems, Glory, Notoriety, Piety, Stardust, Glamour, Arcane Dust, Creature Parts,
  Perk Point, Dusts (21 names), Gate of the Gods Key Fragment and Key.
- Lines are app-authored in `data/reference/currencies.json`, each with its extract source; shop lines (guild / God / Arena /
  Tavern) and their price ranges come from the code shop data, and build-data errors if a shop takes a different currency.
  Codex-only facts (10 Key Fragments make a Key, Keyforge Missions) say "game codex".
- Left out: Energy (its only use, the Arcane Vault, is never offered: legacy) and the patch 3.0 teaser changes. Gaps asked in
  `_su_extract/code/HANDOFF_currencies.md` (Piety / Glamour costs, Glory / Stardust / Creature Parts sources, the Piety switch).

## 2026-10-24 — Hide button cycles: Hide equipped → Hide used in builds → off
- Artifacts, Nether Stones and Spell Gems libraries (user): the one footer button now has three states. 1st click "Hide equipped"
  (on the current party, as before), 2nd "Hide used in builds" (the current party plus every saved build), 3rd off. One shared
  button (`hideBtn`) and slot list (`hideSlots`) for all three libraries; the item equipped on the creature being edited still
  shows.

## 2026-10-24 — Saved builds keep their bookmarks; Inscriptions "also cast by"
- **Bookmarks per saved build** (user): Save and Update store the current bookmarks (traits, spells, perks) with the build; Load
  restores them (a build saved before this has none, so Load clears them, as before). Saving a shared build no longer wipes
  the visitor's own bookmarks.
- **Bosses → Rewards → Inscription:** the extract's `also_cast_by` now shows under the spell: "The Doomsday perk (Shadowbringer)
  can also cast it, without the recipe" (Ill Fate, Saint Althea) and Immobility (Mime) on Aggravate (The Ancestor). build-data
  errors on an unreadable entry or a perk not in the app. (The Inscriptions list itself shipped 2026-10-11, 092cbdc.)

## 2026-10-23 — Stat Calculation Order (extract item 15) + Shallan wording (Q15b)
- Effect Order → new section **Stat Calculation Order** (after Stat Change Order) with Attack / Intelligence / Defense / Speed:
  the game's four stat functions, which rebuild a stat on every read. Steps: Start value · "Less" effects (they multiply) ·
  "More" effects (they add up) · Final. 368 rows; Defiler's four curses now have a row. An intro line and a collapsible
  "How to read" (4 lines, from the extract's "How to read a live stat") sit at the top.
- Keyless code terms: a term whose gate is an artifact / relic stat or a flag test is shown as the object tested inside it
  (`also_keys`: Lead By Example, Ingenuity, Fool's Axiom, Bygone Enhancement…, 21); False God rune terms show the rune
  ("False God has 200% more Attack", 4). The 4 cut runes, realm boosts and the mechanics (minion redirect, pool, minimum stat,
  rounding) stay out.
- Start of Battle Order: a second intro line on when stat effects count (live from 0b; 0a reads last battle's values; amounts
  sized from a stat are fixed when granted).
- Shallan: after "gets through." the why now says a flat bonus must beat the negative hit plus 20% of their Defense (so What Is
  Left still shows 0), and the attack's own added damage (Ravage, Grim Aura, Dissection, Hostile Vitality) is part of the
  negative hit.

## 2026-10-23 — Shallan note reworded
- The note said "the code takes no damage instead", which clashed with flat bonus damage getting through. Now: in code the hit
  goes negative and is set back to 0 at the end, so it's never healed; not capped at 80%; flat bonus damage still hurts them.

## 2026-10-23 — Flat Bonus Damage: Appendix section + Shallan page section
- User: the 46 flat-bonus effects sit inside Damage Order's two bonus steps, mixed in with 246 percent bonuses and other effects,
  so they get their own list. Appendix → **Flat Bonus Damage** (collapsed by default, searchable): every effect that skips
  damage reduction, grouped by which hits it joins (Attacks only 5 · Attacks and spells 19 · Any hit from a creature 21 ·
  Every hit 1), A→Z. The same list (one shared renderer) is a collapsible section on Shallan's Gate of the Gods page, switched
  on by `sections: ["flat_bonus"]` in `gate_god_advice.json` (build-data rejects an unknown section name).

## 2026-10-23 — Flat bonus damage skips damage reduction (extract Q15) + Gate of the Gods reward skins
- How Effect Order Works: the bonus rule is split in two. Percent bonuses add and reductions multiply (order among them doesn't
  matter); new rule: in Damage Order bonuses come after every reduction, so flat "additional damage equal to X% of a stat"
  bonuses skip damage reduction and class advantage, and percent bonuses after Class advantage are doubled / halved.
- Damage Order: a "Skips damage reduction" chip on the flat-bonus rows (extract `flat_bonus`, 50 blocks, 46 rows; Stimulation and
  Carbuncle p1 / p2 left unmarked per the extract's caveats). Tooltip names which hits it joins (attacks only / attacks and
  spells / any hit from a creature / every hit).
- Gate of the Gods: new "Damage" section on every god page (god-side base cut to 35% after the bonuses; Torun 12.25%).
  Shallan's threat rewritten: only flat bonus damage hurts her side for their first 20 actions; percent bonuses, crits and
  strong class hits work against you. Her clarify note adds that the 0 floor comes after the bonuses.
- Gate reward skins (extract `gate_reward_skins.json`, answered 2026-10-12): each god page lists its 2-5 code-named skins as
  chips (5% each per win if not owned) instead of "its three skins". Tartarith's list includes Halloween Torun: shown with a
  clarify note. Names are the game's skin names; the reward file's short labels (and "Fox" for Halloween Apocranox) are logged.
- Clarify notes: Master of Ghouls and ASSKICKER rank 70 say "attacks and spells" but their bonus has no hit-type check, so it
  can also join indirect damage from the creature.

## 2026-10-23 — Egg-log: Named Buff::Proficient added beside Defensive (user ruling)
- Egg-log's text says Defensive; the code adds Proficient. User: keep both, and if Defensive is ever seen added in the code,
  drop Proficient. New crosswalk section `object_adds` (user-ruled tag adds); each add carries `unless_code_named` and drops
  itself once the extract's code layer tags that buff on the object (build-data warns; tested). Log: "user adds 1".

## 2026-10-23 — Buff / debuff source clarify notes (693, user-approved)
- User approved the extract's S50 review as proposed. 693 notes now say who the game counts as having applied a buff or
  debuff: a creature (the holder, the attacker, the dodger, the first holder in party order), no creature, or "put on
  directly" (no normal buff / debuff step, so nothing that reacts to one activates). Shown with the other clarify notes on
  traits, perks, spells, relic ranks and now Realm Cards (card detail shows `clarify`; Sanctus power 3 is the one card note).
- Egg-log: its note leads with "The game's text says Defensive, but the code gives Proficient" (code condition 7).
- build-data: clarify spell rows can join by `spell_key` (the review's spell ids are runtime ids, not app ids); card rows
  join by app id + family; the log line now lists clarify rows that don't join (4, all older entries for unshipped objects).

## 2026-10-23 — Extract pickup: effect-order nesting + "Stops the action", shop icons, backlog tidy
- Effect Order page (extract S49-S49g, `HANDOFF_effect_order_app.md`): rows that run inside another effect's check are
  indented under it, unnumbered, like start-of-battle secondary calls: "Secondary call: checked by X" (inside an object's
  check) or "Inside X" (inside a step); a body shared by `a || b` says "Runs if any of these passed: …". The parent is the
  nearest shipped ancestor (keyless checks are walked past); an object re-checking itself folds into its row (22).
  197 nested rows across 48 functions.
- New resolution label `cancel` = **Stops the action** (tooltip: the rest of the attack / cast / hit / event doesn't
  happen); shown last in a mix. Scorned, Dissolve, Sure-footed, the Relic guards and the Robodomi saves carry it (S49g).
  "How Effect Order Works" explains it and the indent in one sentence.
- Start of Battle: the Satyr card set row (one code site for powers 1-3) ships as three rows (was dropped: no app join).
- Shops (extract S50, `HANDOFF_shop_icons.md`): all 196 blank items have code-grounded art. Music / floors / walls /
  Treasure Chests / Gate of the Gods Key / Torun's weather item draw one `icons`-sheet frame per kind (`icon_frame`, the
  game's own shop-list fallback); Heart of Alakadan / Heart of 8004 get their sprites. Every shop kind now joins 100%.
  Torun's weather item is named **It's Raining Men** (was "Weather").
- Data rebuilt from the extract (effect order S49-S49g, S50 shops / project items, current effect formulas).
- BACKLOG tidy: the done 2026-10-09 batch section removed (its God Shop code gate shipped 2026-10-22), Rodian Aftermath
  in-game check closed (confirmed 2026-10-20), the Taxonomy v2 rebuild item reduced to the open round-5 audit.

## 2026-10-23 — Macro Proposal engine v2 (still behind FEATURES.macros)
- In-game rules: 30-line cap, Health % in steps of 10, no "chains narrow targets" lines, whole-side spells cast with no
  target, and an always-act tail (attack if worth it → defend → skip turn) that is never trimmed.
- Reads the loadout: no cast lines for a creature that can't cast manually (The Great Beyond, Channeling …); attacks
  only when Attack is its stat or its attacks use Intelligence (Whisper R70, Ribcracker R90, Myosotis, Confusion and
  Empathy); Defend first for creatures with Defend payoffs (Extension, Starwrath); Expanded Power counts party-wide.
- New spell patterns: once-per-battle ally spells turn-gated per ally (Sapphire Power → the allies whose Spell Slot fits
  their action), ally attack spells on the highest-Attack ally (Rabid Dementia), Silence cleanse, Timeline control,
  heal-by-damage when an ally is hurt (Drain Life), per-buff / per-debuff damage gated on its break-even count
  (Implosion, Kick, Jinx vs Spell Blast's charge bonus), and per-spell focus (missing Health, Defense pierce).
- Fixed: Disintegrating Arrow was read as a resurrection spell.
- v3 (same day): Citrine gems are left out of the cast lines and set the creature's main action (Attack / Defend /
  Provoke). The main single-target action gets a per-slot Shelled / Barrier / Health target block sized to fill the
  30 lines. Targeted attacks are followed by "attack a random enemy" (an Invisible pick makes a line do nothing).

## 2026-10-22 — UI batch (13 items)
- Spell cards: the generic "temp gem of spell" chip is gone. Ultimate spells carry an Avatar chip (the god of the Relic
  that grants the Ultimate, e.g. Holy Strike → Surathli). Final Summoning's demon spells are full spell cards behind the
  perk's arrow, chipped with the demon's name (old demon list removed).
- Anointments: tap a row to select (the icon opens the taxonomy); the footer Equip commits and replaces Done; ✕ discards.
- Artifact Sockets rows show each socket's effect and value ("+59% Attack") instead of the property / "primary".
- God Shop Favor Rank chips now come from code (`favor_rank`, scr_GodShopSetup guards): all 1,437 gated items,
  cosmetics included (was 630 from the community CSV, now a cross-check only). Shop items with no icon (196) handed to the
  extract: `_su_extract/code/HANDOFF_shop_icons.md`.
- "Realm bonus" → "Realm item bonus" (Nether Stone Drops column, Maximum Realm Item Bonus section).
- Spec picker: Shadowbringer stays on one line. Synergy matrix row arrow is bigger (32 px tap target).
- Realms Compare: the favor bar's prose is gone; the Browse|Compare and Same rank|My ranks toggles sit closer.
- Appendix / Effect Order: notes and step headings left-aligned, Class Advantage columns left-aligned; blocker and
  secondary rows use a 1 px violet dashed outline (was a thick dashed border in the text colour).

## 2026-10-22 — Code text leaking into spell-card labels
- User: raw code showed on some spell cards' source labels (Idolatry). The label parser in `build-data.mjs` read the pick
  list after the FIRST colon of the extract's `gem_from_how` / `cast_from_how`, so code prose with its own colons leaked in.
  It now reads after the LAST colon. Fixed: Idolatry and Weapons of Mass Distortion ("Arbiter"), Ultimate Manifestation
  and trait 534 ("Chaos"). No other label changed.

## 2026-10-22 — Collapsible spell / status rows
- User: the spell and buff/debuff cards under perks, traits, relic ranks and effect-order rows sit inside their owner's
  container (the Planner trait look everywhere), collapsed behind a small arrow; no preview names. A row you open stays open
  across re-renders (keyed by its content).
- The arrow takes no row of its own: it sits at the right end of the text's last line. Relic rank rows use the same
  collapsible cards (their separate spell list under the rank is gone).

## 2026-10-22 — Effect Order page
- User: the effect-order sections move to their own page, Effect Order (menu button just above Appendix), same layout as the
  Appendix: How Effect Order Works, Resurrection Order, Start of Battle Order and every effect-order section. The Appendix keeps
  Status Effects, Class Advantage, Random Targets, Nether Stone Drops, Pandemonium Shrine, Maximum Realm Bonus, Rodian Masters.
  One renderer (`openErrata(page)`), each page with its own search.

## 2026-10-22 — Effect order: when each change lands (extract resolution merge S44 / S44c)
- Every Appendix effect-order row and Start of Battle row shows when its change lands, from the extract's `resolution`: At once,
  Runs now (a whole attack / cast on the spot, its hits queued), Queued, Jumps the queue, Changes the amount, Check only (the
  effect is in the rows that follow); mixes join ("At once + Queued", e.g. Ultimate Trickery). Not judged = no label.
  Tooltip = the longer meaning. Start of Battle joins it through the combined file's start_of_battle blocks (src.index).
- "How Effect Order Works" rule 3 rewritten: it said most effects queue; the labels now say per row.
- Rebuild picks up the S44 / S44c timing and text fixes and realm property 25 (Debuff) now on your side.

## 2026-10-22 — Taxonomy v1 cutover
- v1 tags (`taxo` / `taxoSrc` on 5,399 objects incl. trait items), the v1 category list (`taxonomy`) and `tagLabels` no longer
  ship (data.js 7.67 → 6.27 MB). The app's v1 branches and `FEATURES.taxoV2` are gone; v2 is the only taxonomy. build-data still
  reads v1 as an input (old themes, the removed-tags list it writes for the extract).

## 2026-10-22 — Taxonomy v2: extract F5 rounds 5-6b + F4 taken
- Theme lines (provisional, user audits after the v2 pass; crosswalk `theme_status`): new themes Traits, Death, Turn Timing,
  Targeting, Health, On-Event; Cast += Named Spell::* and Spell Kind Arrow / Damaging / Multi-Target / Single-Target / Stat (pending
  the user's review); Creature Race += Party All Same Type; Turn Counter += Scales With::Turn Count; Debuff += Trigger::DoT Tick;
  count marker Dead Creature Count / Times Killed -> Death. Mechanic groups: the new themes join Death & Resurrection, Traits,
  Turns & Timeline, Party & Targeting, Health & Healing; new group Events (On-Event).
- Markers (no theme, shown on the chip and filterable): Counter (`counts`: the hook raises a counter, not a firing event), Match:
  Fixed / Same as (`match` on Class / Race Match), First death only (`first_only` on Trigger::Death).
- Retired from the vocabulary: Condition::Is Type, Scales With::Activation Count (Is Class / Is Race never shipped).
- Rebuild picks up rounds 5-6b tags and corrections (Party All Same Type on the Masters, counters on Juggernaut / Outburst /
  Siegebreaker / Detainment / Recklessness / Fable, Type Count retags, Voidlords clarify note). Theme-only objects: 0.
- F4: Sovereignty's missing-creature count = empty slots + Companion level, capped at 5 (effect rule `perPlus` / `perCap`; test added).

## 2026-10-22 — Buff / debuff containers next to the spell ones
- User: the same container under objects for the buffs / debuffs they apply or always have. Code layer Buffs:: / Debuffs:: Apply
  and Always Has tags (`named` or registry `condition_ids`; conf code only, the 64 `inferred` names left out; random / existing
  picks name no single effect). build-data ships `condsUsed` ({c: "<cat>:<key>", k apply|always, rk}) on 64 perks, 204 traits,
  16 relics, 190 spells. Cards (icon, name, description, click → status effect) sit in the same row after the spell cards.

## 2026-10-22 — Spell-gem containers for every object that casts or grants a spell
- Extract S47 / S48: runtime-picked pools (Pyroblast, Prophecy, It's Called a Lance, Colorblind, Avenged Sevenfold, Chaos Through
  Creation, Lunar Ending) and granted gems (`gem_spell_ids`, 66 tags). build-data ships `spellsUsed` ({s, k cast|gem, l pick label,
  rk relic rank}) on 42 perks, 134 traits, 20 relics and 4 spells; `PERK_CAST_HELD` is gone.
- The app shows them under perks (as before), under every full trait display (creature, bosses, gods, artifacts, nether stones,
  trait detail), under Start of Battle / effect-order trait and relic rows, on relic rank rows (code clause rank; replaces the
  "Casts <Spell>" text match) and on spell detail. A pool labels each card with its pick case (class, Avatar).

## 2026-10-21 — Spells under perks that cast them; Start of Battle secondary calls from code
- User: perks that cast a spell show its spell-gem container as an indented row under the perk (spec perk list, Start of Battle
  and effect-order rows; un-indented on the perk's detail page). Code-grounded: the code layer's Actions::Auto Cast
  `cast_spell_ids` (code id → app spell via spell_property_compat), 28 perks; a "one of" pick shows all, in the perk text's order.
  Gems the perk grants (spell_owners) join the same row (no duplicates). Final Summoning keeps its per-demon list. Held:
  Pyroblast, Prophecy, It's Called a Lance (spell picked at runtime; one id listed) → `_su_extract/code/HANDOFF_perk_cast_pools.md`.
- Start of Battle secondary calls now come from the extract (S42 `secondary_of`, control-flow reachability): 13 rows under the
  effect that checks them (Triple Take, Ruse, the ten elemental traits under Master of Elementasaurs, Rebirth); an effect's own
  re-check of itself (25) folds into its row. The provisional map is gone.
- gemSlots guard: Godforged (extract F4, S40p) scales Godforge upgrade 9's slots, which the app doesn't model → exempt, tag ships.

## 2026-10-21 — Start of Battle: secondary calls indented
- User: keep the checks an effect makes inside its own block (Triple Take in 1a is Master of Golems' "already has this trait"
  check), shown indented under that effect, unnumbered, with "Secondary call: checked by X". The extract marks them with
  `secondary_of` (asked in `_su_extract/code/HANDOFF_start_of_battle_regen.md`); until then build-data marks two by
  layout + text (`SOB_SECONDARY_PROVISIONAL`: Triple Take under Master of Golems, Rebirth under Master of Sphinxes).

## 2026-10-21 — Taxonomy v2: theme-only leftovers ruled
- User: the "spells cost no Charges" effects already carry Spell Gems::Charges; with no narrow Cast tag they drop
  Involves::Cast (Curse of the Silent, Ascendancy, Higher Understanding, Furness' Decadence, False Epiphany,
  Prestidigitation, Efficiency, Mental Clarity, Kindle the Flame, Energy Efficient, On the House). Themes already ruled
  against go: Head of Nebodar Damage (DoT potency is Indirect Damage), Master of Krakens Stats and Commanding Presence
  Damage (More Potency), Prosperity Stats (a heal). Crosswalk `object_drops` (Involves::X = theme wrong on that object).
- Theme-only left: 7 on 5 objects (Soul Rending, Domination, Salus, Animation, Siren), waiting on the user.

## 2026-10-21 — Taxonomy v2: extract F5 rulings taken
- The extract's F5 rounds (1-4, final, leftovers; HANDOFF_taxonomy_v2.md "App needs") are in. New tags and drops already
  came with each rebuild; this adds the app side:
  - **Theme lines** for the new values (crosswalk `themes`), e.g. Spell Kind::Healing Spells → Healing, Class Match →
    Creature Class, DoT Potency / DoT Tick / DoT Formula / Blighted Damage Count → Indirect Damage. U3: DoT Formula is no
    longer Damage (`Calculation::*!DoT Formula`).
  - **Source rule fix:** Source applies to Turn Action Limit, DoT Tick, Intercept, Limit Repeats, Has Done Action,
    Persist, Suppress, Target Rules, Redirect and Stat::* too, and there it adds only its own theme. Only Damage /
    Hit Resolution / Calculation / Trigger::Damage tags also add Damage.
  - **Markers** from the code layer ride on each tag and are refine toggles next to the side / source / timing / delivery
    ones: Cast from, Counts (count_of), Count, Ignores, and one detail toggle (Critical hits only, Damage or Heal, Buff /
    Debuff Trick, Except Blighted, Suppresses ...). Marker themes: crit → Critical, count → its counted thing, etc.
    The entity detail shows them on the tag chip.
  - **Wrong themes** (`involves_wrong`, 151 objects) are dropped per object (Cauterize: Damage, Master of Watchers: Damage...).
  - **Code drops:** a value the code layer dropped or retagged (f5.corrections) and no longer tags is removed from the
    v1-mapped tags too (52; e.g. Prosperity Stats::Set, Brewmaster's Spell Gems). App-only drops the extract named:
    Has Done Action on Unnatural Causes / Void Flare, Move Down on Of Hearts Unbowed (crosswalk `object_drops`).
  - Delivery Direct → **No Event** (applies to Minions::Summon, Life::Heal / Execute, Actions::Auto Defend too); phase
    Direct added; Actions::Redirect Spell → Actions::Redirect [Spell]; relic tags take the code layer's own `rank`.
  - The 29 new values without a mechanic group are placed (Redirect / Turn Action Limit: Attack + Cast; Count Threshold:
    Turns & Timeline; Set Health: Health; Perks / Cards / Conditions More Activations, Activation Count, Re-roll: Traits;
    Conditions More Activations also Buffs + Debuffs; Damage group now takes theme:Indirect Damage).
- Theme-only count fix: it counted every Involves tag, including the code layer's own general Involves tags whose theme
  a narrower tag already gives (Cesspool's Indirect Damage). It now counts a theme only when nothing but an Involves tag
  carries it: 21 on 19 objects, all old v1 themes on live objects (none blacklisted), 11 of them "spells cost no Charges"
  effects whose only narrow tag is Spell Gems::Charges (Spell Gems, not Cast).
- Result: theme-only objects 399 → 47 (38 objects), old-tag Involves 373 → 21, relic tags with no rank 76 → 38
  (mostly the relic's own Involves::Relic).

## 2026-10-21 — Appendix: effect order for every fixed-order combat function
- User: the extract's evaluation order for each static-order function goes in the Appendix like Start of Battle and
  Resurrection. build-data reads `effect_order_all.json` (S41, HANDOFF_effect_order_app.md) into `D.effectOrder`:
  13 sections (Battle-Start Timeline, Start of Turn, Cast, Spell Amount, Attack, On Attack, Damage, Heal / Defend /
  Provoke / Minion, Buff and Debuff, Stat Change, Death, End of Turn, Event Queue and End of Battle), 48 functions,
  3,644 rows. Rows are the app's own objects (name, text, icons, source chips, rank / power) in execution order;
  structural code steps with no app object and blacklisted traits are left out. Step headings are the extract's
  phases reworded in plain words (an unmapped one fails the build); start of turn is split by its code line ranges.
- A "How Effect Order Works" section gives the extract's cross-cutting rules in plain words (code position decides,
  side-wide effects run once, queued events resolve oldest first, trigger lists run whole and repeat from the top,
  bonuses add / reductions multiply, a cancel stops the rest).
- Start of Battle fix: the relic id pair in `start_of_battle_order.json` is [rank index, relic] on most rows but
  [relic, rank index] on a few. build-data read every row one way, so 11 rows showed the wrong relic (Wintermaul rank 70
  as Salus rank 10, ...). It now takes the order whose relic name matches the row: 7 rows fixed, 4 with no mappable
  rank dropped.

## 2026-10-20 — Stat order: Health, Attack, Intelligence, Defense, Speed, Total
- User: every stat list in the app (creature stats, picker sort columns, scrolls, personality, relic stat sections,
  Nether Stone / artifact library sorts, boss stats) now reads Health, Attack, Intelligence, Defense, Speed, then Total,
  matching the game and the build export. `STAT_KEYS` in app.js drives them all; the engine's key list is unchanged.

## 2026-10-20 — Involves is the umbrella view
- User: Involves replaces the old generic Action/Mechanic tags: one tag shows every effect that involves a mechanic, no
  narrow focus. build-data now gives every object `Involves::<theme>` for each of its v2 themes (theme2), e.g.
  Involves::Damage 1,495 results vs Damage::Inflict 543. It heads its mechanic group in the pickers and the Taxonomy page,
  and stays out of Synergy (it would double-count every effect).
- The old meaning ("theme from a v1 tag that no v2 tag re-derives") is now a review list for the extract to find each a
  narrower tag: `app_involves_review.json`, 801 themes on 681 objects (HANDOFF_taxonomy_v2 F5). The theme still counts
  for the umbrella meanwhile.
- Grouping: Trigger::DoT Tick had no mechanic group since F3 (the warning ran after the summary, so it never showed);
  it's in Damage now, and the orphan check prints. User: also in Debuffs (DoT damage comes from a debuff); a tag can sit in
  several groups. Calculation::DoT Formula joins Debuffs too (user).

## 2026-10-20 — Everything reads taxonomy v2
- User: repoint everything to v2. v1 tags are no longer read anywhere while the v2 flag is on:
  - Synergy (matrix + list): one key per v2 tag (a trigger with a role counts as its role, e.g. "Takes Damage"); the
    matrix columns name the category ("Buffs: Apply", since v2 values repeat across categories). A relic counts only the
    tags of ranks up to the equipped rank.
  - Threats advisor: build themes come from each effect's v2 themes (buildThemes now lists themes, not v1 tags).
  - Creature Triggers section: groups read v2 Trigger values; each chip names side + trigger ("Ally: Attacks"). Relic
    rows are per rank from the code (below); a relic trigger with no rank shows once for the relic.
  - Spell roles (macros, flag off) and the taunt-trait check read v2 themes / Spell Kind / Stats (696 of 705 spells keep
    their role; the 9 that move follow code-backed tags, e.g. Soul Sacrifice is Stats::Set).
  - Boss advisor "damaging spell": Damage::Inflict or Spell Kind::Damaging Spells.
  - `noDmgStat` (Azurite does nothing): v2 themes Damage / Indirect Damage / Stats / Attack or a Damage::Inflict,
    Damaging Spells or Stats tag. 266 → 253: the 13 that drop are spells that make creatures attack (v1 skipped only some
    of them), plus Lycanthropy and Hero's Blessing.
- Relic per-rank tags from the code: build-data gives each relic v2 tag the rank whose relic_signatures clause holds its
  code site (`rk`; 535 of 580 code-layer tags). The relic page merges a tag found on several ranks into one chip with ×N.
  The 272 tags with no rank are listed for the extract (HANDOFF_taxonomy_v2 F5).
- build-data writes `app_involves_review.json` (801 Involves tags on 681 objects) and `app_relic_tags_no_rank.json` to
  the extract's data_dump for F5.
- Checked in the browser: Synergy, Threats, Triggers for three creatures (Ferro R10–R100 per rank), the Arbiter page
  (Healing Up ×2); no JS errors.

## 2026-10-20 — Tag filter: source / timing / delivery toggles
- User: more narrowing, the same way as the side toggle. An active tag chip now shows a toggle for every v2 attribute its
  tag carries on the listed items: side (Either / Your / Enemy), source (Attack / Spell / Indirect), timing (Would /
  During / After / Repeat) and delivery (Event / Direct). Each cycles Any → the values present → Any, and they combine
  (an item matches when one of its tags has the tag and every chosen value).
- One mechanism for all four: filter keys are "base@s=…@so=…@p=…@d=…"; the side-only code (keySide / sideBtn / sided)
  is gone. Works on every TagFilter list and the Taxonomy page.
- Checked: Taxonomy page Takes Damage 123 → Timing: Would 80 / After 5; Deal More 424 → Attack 141 / Spell 146 /
  Indirect 3; Stats Gain 388 → Event 333 / Direct 49; all 8 picker lists still filter.

## 2026-10-20 — Spell Gem library: Opal dot, base-class sort; relic sort
- User: a gem re-classed by an Opal (Class Swap) shows a ringed dot in its spell's own class colour (top-left of the
  tile; the gem icon already shows the new class).
- The Class sort (the default, lit on opening) is ascending only and cycles Class → Base class (the spell's own class,
  ignoring the Opal) → off → Class.
- Relic picker: a Stat / Name / God sort. Stat (default) keeps the per-stat sections; Name and God are one A–Z grid
  (God ties by relic name).
- Relic picker: the sort sits in the filter row (right side; wraps to its own line, still right-aligned, when tag chips fill it).

## 2026-10-20 — Spell Gems can't be named; relic picker shows the god
- User: Spell Gems can't be named in game (the name field was copied from the Artifact / Nether Stone builders). The Name
  field is gone. A gem is always called by its spell, names saved earlier are ignored, and shared builds no longer
  carry a gem name.
- Relic picker: each tile shows its god under the relic name (from the end of the game's relic name, e.g. "of
  Gonfurian", cased like the realm's god; Caliban has no realm). Search matches the god too.

## 2026-10-19 — Data rebuild: taxonomy v2 code layer after the extract's F3 pass (S39)
- Rebuilt from `_su_extract`. Code-backed v2 tags: 16,091 (was 15,231). Tags removed as not code-backed: 825 on 640 objects
  (was 1,797 on 1,002).
- New from the extract:
  - Trigger::DoT Tick (with the debuff), damage-type `sources` on damage triggers and modifiers, and spell `heal_basis`.
  - 12 damage-modifier directions corrected, and the "chance to avoid damage" effects read as Take Less.
  - The 44 DoT appliers lose Damage::Inflict (user ruling: literal damage source only).
  - About 70 new clarify notes (Counterspell / Spell Blast notes retracted).
  - Formula per-unit factors fixed (Counterspell, Spell Blast, Lingering Insanity, Mind Explosion).
- The extract now decides F3 over a cumulative question set, so confirmed tags no longer drop out when this app's removed
  list shrinks.

## 2026-10-19 — Spell Gems sort by Class by default
- User: the Spell Gems library (and the equip list opened from a creature's Spells) now opens sorted by Class (game
  class order, then name) instead of most recent. The Recent sort is still one tap away.

## 2026-10-19 — Spell-gem slots from the code (Adept Wizarding and 8 more)
- User: spell gem slots for Adept Wizarding weren't working. Cause: slot grants were found by a text pattern ("gains N
  Spell Slot"), which only caught Gray Matter. The game's slot count (`scr_GetCreatureStat` case 5, "spellslots") has
  10 grant clauses, which the extract's code layer already tags "Extra Gem Slot".
- All 10 are now effect rules with their code site: Adept Wizarding (+1 to all your creatures if any has it),
  Prismagic and Spell Tap (+3 on the bearer), Conduit Strike (+1 per unique class in your party), Master of
  Shapeshifters / Proof Is In the Pudding (your Shapeshifters / Dumplings, +1 per one on your side), Expanded Mind
  (+1 per rank), Sovereignty (+1 per creature missing from the party), Taste For Treasure (+5 for Guardians), Gray
  Matter (Animatus, +1 per rank).
- Perk grants read `scr_PerkLevel`, so anointments count (Gray Matter was spec-only before).
- build-data errors if a code-layer "Extra Gem Slot" object has no slot rule, or a rule has no code clause.
- Engine: `gemSlots` gains `scope: "party"` and `per` (raceOnSide / uniqueClasses / missingCreatures).
- Checked in the browser: Adept Wizarding on creature 3's artifact takes every creature from 3 to 4 slots (the
  Animatus with Gray Matter 5: 8 → 9).

## 2026-10-19 — One tag filter for the whole app (TagFilter)
- User: "a single filter object used across the application", like the shared spell container. The spell filter came up
  empty after Taxonomy v2: spells, anointments and trait items still built their picker from v1 `taxo` while the picker
  groups are v2.
- `TagFilter` in app.js now owns every taxonomy filter: the active-tag chips, the side toggle, ＋ Filter (the facet
  picker), the picker index and the match. Each list keeps its tags on its own state as `st.tf[src]` (AND). Sources:
  creature, card, relic, anoint, spell (spell pickers + Spell Gem library), trait (artifact trait items, via their
  trait), perk, appendix (the Taxonomy page keeps its own browse view and shares the chips and side toggle).
- The picker lists only tags that still have results under the tags already picked, on every list (the Taxonomy page
  already did this).
- The side toggle shows only when a listed object that passes the other tags carries that tag with a scope (no more
  toggles that always give 0, e.g. Crit Chance on spells).
- Perk picker: its own inline browse is gone. ＋ Filter opens the same picker as everywhere else and returns to the perk
  list (scroll kept), and the perk picker now takes several tags, not one.
- Retired: taxoFilters / spellTaxos / traitTaxo / perkTaxo state and the facet-taxo, anoint-taxo, sg-taxofilter,
  artb-traitfilter, perk-taxo-*, rm-taxo and appendix-rm-tag actions.

## 2026-10-19 — Taxonomy v2: code-backed tags only
- User ruling: remove anything that isn't code-backed. v2 now keeps only code, code_boss and field tags (14,884). Removed:
  2,083 tags on 1,099 objects (llm 594, undecided splits 548 + 32 open polarities, token 311, guessed Targeting::All 265,
  audit 105, v1 triggers the code lacks 95, implied / correction / keyword 132). Unverified tags no longer ship.
- build-data writes the removed list into the extract's `data_dump/taxo_v2/app_removed_not_code_backed.json` each build;
  the extract works through it (HANDOFF_taxonomy_v2 F3). Confirmed tags come back through the code layer.
- Example: Furor now shows Death + Dead Creature Count; its Turn Start is with the extract to find in code.

## 2026-10-19 — Taxonomy v2: side narrowing, unverified triggers and guessed targeting
- Side toggle beside every active tag chip (Taxonomy page, ＋ Filter bars, spell / gem and perk pickers): Either side →
  Your side (Self, Ally, Self or Ally, Adjacent) → Enemy side. Scope Any counts on both; a tag with no scope gets no
  toggle. Keys carry `@s=ally|enemy`.
- User review: Abnegation showed a "Takes Damage" trigger the code doesn't have (old audit tag; its code trigger is the
  heal). A v1-only trigger on an object whose trigger(s) the code decoded is now unverified (95 tags, 88 objects), not
  firm. They're not dropped, because some are the player-facing trigger the code anchors elsewhere (Furor's turn start,
  Burning reactions). Listed for the extract: HANDOFF_taxonomy_v2.md F1.
- Targeting::All the extract inferred only from "no picker call" is unverified (302; e.g. Abnegation hits a random enemy).
  Extract F2.

## 2026-10-19 — Taxonomy view on v2, browsed by mechanic
- `FEATURES.taxoV2` (on): the Taxonomy page, every ＋ Filter tag picker (creatures, cards, relics, perks, spell / gem
  pickers) and the entity detail tag list read the v2 tags. Other features (Triggers, synergy, spell roles) still read v1.
- Browse containers are now mechanic groups (user request): Attack Effects, Spell Gem / Cast Effects, Defend & Provoke,
  Damage, Health & Healing, Death & Resurrection, Buffs, Debuffs, Minions, Stats, Turns & Timeline, Traits, Class & Race,
  Party & Targeting, Equipment & Personality. DRAFT in `data/reference/taxonomy_groups.json`, built from the theme lists;
  build-data reports any value no group reaches (none).
- Rows name their category ("Trigger: Takes Damage"). Role-dependent triggers get readable rows (Deals / Takes Damage,
  Kills / Dies, …) beside "(any)". Detail chips show scope, source, phase and Direct delivery; unverified tags are dashed.

## 2026-10-19 — Taxonomy v2 data layer (next to v1, no UI change)
- New `tools/taxo-v2.mjs`, run by build-data: every trait, perk, spell, relic, card and condition now also carries `taxo2`
  (v2 tags with scope / source / role / phase / delivery and provenance) and `theme2` (derived themes); `taxonomy2` ships
  the v2 vocabulary in layer order plus the attribute values.
- Sources: the object's final v1 tags through `taxonomy_crosswalk.json`, united with the extract's code layer
  (`taxo_v2_tags.json`, S38d). Code decides splits and supplies attributes; event-relative effect scopes take the
  trigger's scope when the sides match.
- 16,552 tags: 15,012 code · 959 v1-only · 581 unverified split candidates · 675 Involves. All 3,646 objects joined.
- The app still reads v1; features move over one by one (BACKLOG Taxonomy v2).

## 2026-10-19 — Taxonomy v2: extract answers + rulings (no data change)
- Extract S37 decoded the v2 handoff (`taxo_v2_tags.json`). User rulings: Delivery attribute (Event / Direct) on stat
  Gain / Lose and buff / debuff Apply; Phase value During; Xyrxzy's Control = Extra Attack; Cold Blood is not Bounds.
- User ratified every v2 value list (see DECISIONS "Taxonomy v2 values ratified"). Crosswalk updated; check still 0
  unmapped, 0 themes lost. Decode follow-ups appended to the extract handoff.

## 2026-10-18 — Taxonomy v2 draft (no data change)
- The user approved the v2 shape (scope attribute, derived Theme, Extra/Auto split, parallel Buffs/Debuffs). Charter in
  `TAXONOMY_INTENT.md`, crosswalk `data/reference/taxonomy_crosswalk.json`, check `tools/taxo_crosswalk.mjs`.
- Check on current data: 0 unmapped values, 0 themes lost. 1,771 split items need code; 660 Involves review items;
  171 superset gaps that v1 had.

## 2026-10-18 — Dire Wolves tags restored (extract S36)
- `build-data.mjs` `MINION_STEMS`: `dire ?wolf` never matched the plural "Dire Wolves", so the minion grounding check
  dropped every Minion tag on traits that name them (trait text is pre-rendered, no minion token). Stem now
  `dire ?wol(?:f|ve)`. Not a relabel: restores the extract's existing tags on 8 traits (Blood Thirst, Hound Legion and
  Nature of the Beast had none at all).
- Rebuild brings the extract's 15 code proposals for Nature of the Beast, Boon of the Hee Hoo Hay Ho, Nether Orbs and
  Conspiracy Theory into the review queue (not shipped), and 2 new clarify notes (Conspiracy Theory's five +10% stats;
  Boon: enemy-only, debuff immunity, random cast each turn).

## 2026-10-18 — Endowment: plain base of creature #2 (code)
- User ruling: go with the code. The Animatus's base stats now average with creature #2's PRIMARY creature's plain base
  (code stores only its creature id as `fuse2`), not creature #2's fused base. Trait, race, class unchanged.

## 2026-10-18 — Endowment: code answer applied
- Extract confirmed the model (primary trait, class kept, race, slot position 2, no creature #2 scrolls, battle only).
- Deprived now keeps the Endowment trait: in code, Total Deprivation clears the fused-trait field before Endowment sets it.
  Checked in a browser (Deprived + anointed Endowment: Animatus keeps Cloud of Bats).
- Open: the code averages with creature #2's primary creature's plain base, not its fused base. App keeps the user's
  in-game model pending a ruling.

## 2026-10-18 — Endowment wired in (Animator)
- New engine op `fuse.copy` (rule `animator-endowment`, spec+anoint): while Endowment is allocated or anointed, the
  Animatus's base stats become the fusion average with creature #2's fused base (creature #2's scrolls left out; the
  Animatus's own scrolls and personality apply as usual). The Animatus gains creature #2's primary trait and race; class
  stays. User in-game model, DECISIONS 2026-10-18.
- Applied everywhere through `baseStats` (stats, totals, traits, Triggers, synergy, highest-stat perk scopes). Detail
  header "Animatus ⚭ <creature #2>", traits "(innate + Endowment)". Effective race now shows on the roster row, tile and
  detail. A race scope matches the original or the changed race.
- Checked in a browser (Animatus + fused Mutated Crypt Bat): 37 / 22 / 22 / 19 / 21 = the hand-computed averages, trait
  Cloud of Bats (not the fused Congregation), Death · Bat. 6 engine tests added (48 pass).
- Code confirmation asked: `_su_extract/code/HANDOFF_endowment.md` (fuse fields, scrolls, class, slot rule, Deprived).

## 2026-10-18 — Triggers: spec perks, anointments and party members' traits
- The creature detail Triggers section now also lists **spec perks** (at their allocated rank) and **anointments** (full
  rank), each "from <spec>". It also lists **party members' traits** this creature can set off or carry out ("from <owner>",
  one entry per trait even if several members have it, skipped if the creature has the trait itself).
- Only the creatures a perk or trait concerns get it (DECISIONS 2026-10-18). Scope values: party, race (Animatus, Herbling,
  Godspawn, Avatar, Guardian, Familiar …), class ("your Chaos creatures"), first n in the party (Kindling, Nightstalker),
  top n by a final stat (Solar / Lunar Eclipse, Synastry, Transit, Ascendant; n scales with rank, ties count). Checked in a
  browser: Death and Decay shows only on the Animatus, Thrive on Death and Masterpiece on everyone, Solar Eclipse (rank 3)
  on the top 3 Attack creatures, Congregation only on its owner.
- Data: `perks[].trigScope` (260) and `traits[].trigScope` (1090) = `{t, a}` read by `tools/trigger-scope.mjs` from the
  description (trigger-clause subject, main-clause subject; only sentences with trigger wording count). 45 triggered perks
  name no creature of yours (enemy-only / "you") and get none. Code check against `perk_signatures.json` race gates: one
  warning, Apostle (its signature shows only the Godspawn gate).
- App: `scopeCovers(slot, scope, rank)`; perk cards in `trigItemHtml`.

## 2026-10-18 — Creature detail: Triggers section (#5)
- **Triggers** (creature detail, after the relic): every triggered effect the build attaches to that creature, grouped by
  event. Empty groups are hidden. Groups, in order: Start of Battle, On Turn, Attack, Cast, Defend, Provoke, Damage,
  Critical Hits, Dodge, Healing, Buffs & Debuffs, Stats, Death & Resurrection, Timeline, Minions, Trait Activates. The
  user's list was Attack / Cast / Defend / Provoke / Damage / On Turn; the other groups come from the remaining Activates
  at / Activates When values.
- Sources: traits (innate, fusion, artifact material, nether stone; non-innate ones say "from <artifact / stone>") and
  relic ranks up to the equipped rank (skipped under Deprived), both joined by their Activates tags; the chip names the
  matched event ("Enemy Attacks", "End of Ally Turn"). The artifact's own spell fires on the type trigger, nether stone
  spells on their stored trigger, both with the slot chance. Spell-gem properties use the code hosts: Citrine
  Attack / Defend / Provoke / Heal, Bloodstone / Carnelian / Emerald / Garnet → Cast, Jade → Start of Battle. Artifact
  and nether "X On Damage" properties go under Damage as "Deals Damage": `roll_sites` shows all 36 of them rolled in
  `bc_EventDamage` on the attacker's artifact. Some localized names say "when receiving damage"; the code says dealing.
- Data: `relics[].ranks[].trig` = that rank's Activates at / Activates When tags from `relic_rank_taxonomy_tags.json`
  `by_key` (218 of 310 ranks). Spec perks and anointments are not listed (they belong to the party, not the creature).
- All spell rows use the shared `spellGemCard`. Code: `TRIG_GROUPS` / `slotTriggers` / `triggersSectionHtml` in app.js.

## 2026-10-18 — Extract answers applied: trick uniqueness, Minion Spells, relic ×N, resurrection order, Final Summoning
- **Artifact wizard (#23):** a trick material whose property is already in the other trick slot is greyed out and can't be
  added (code: the blacksmith refuses it); saved artifacts with a repeated trick drop the copy on load. Stat slots unchanged.
- **Minion Spells (#19):** +11 members (literal rule, 42 total); 16 members Dark Summoning can't pick get a clarify note.
- **Relics (#17):** "×N" on a relic's taxonomy chip when N ≥ 2 ranks carry the tag (`relics[].tagRanks`, 381 chips). Lamora
  swap + 4 unsupported whole-relic tags dropped. Arbiter R70 clarify (Barrier on damage taken, not dealt).
- **Resurrection Order (#14, #15):** re-ordered to code order (Born Again and Clean Eating move); 8 on-death blocker rows,
  11 numbered queue-time checks, and a note naming the resurrections that don't go through bc_OnDeath. Clarify notes on each
  blocker (what it doesn't stop), Impatience (drawback has no code) and Hate And Other Triumphs.
- **Final Summoning (#30):** table of the spell each Greater Demon casts (Satanachia: one of 30 at random).
- **Nether Boss (#7):** 20 bundles + Key Fragments right after the fight (separate from the quest); quest reward (5 bundles)
  paid on entering the next room.
- **Count as Manual (#28):** Pandemonium Wrath confirmed in code; note updated.

## 2026-10-18 — Count as Manual tag; nether "total 6" closed; relic threshold preview
- New taxonomy value **Affect on Spells::Count as Manual** (user-approved): Superfluidity, The Great Beyond, Embrace the Arcane
  (code: they clear `bc_CreatureCast` arg3) and Pandemonium Wrath (text; code validation asked). Implies Action/Mechanic::Cast.
- #24 closed: the nether stone generator has no combined cap (decompile: 6 props / 3 traits / 3 spells, separate loops).
- #17: 2-vs-3 rank threshold preview from code signatures (37 at 3+, 34 more at exactly 2) recorded; final pick waits on the
  per-rank tags.

## 2026-10-17 — Batch of 30 (user list): 20 shipped, rest waiting on the extract or a user call
- **Spell gems (G1):** one shared spell row for the Spell Wizard, Artifact Wizard spell socket, Nether Stone spell picker and
  library preview (`spellRow`); the Spells-page granted tile now renders through `spellGemCard` (the nether "from X" line was
  centred there — drift fixed). Property step shows the spell (description + stats). **Agate** shows base → result charges
  (code: floor, min 1; gem alone). **"No effect" chip** for Agate rounding to +0 and Azurite on a spell with no damage or stat
  change (`spell.noDmgStat`, 266 spells: code rules + taxonomy, conservative).
- **Spell library (G2):** fixed icon size in every fixed-count grid (`repeat(N, 1fr)` → `minmax(0, 1fr)`, 9 grids; long names
  wrap). Stacked taxonomy filters (AND) in the shared spell picker and the library. Class sort (class-wheel order).
- **Planner (G4/G5):** swap a creature with its neighbour (▲▼ roster, ‹ › tiles). Perk header chips wrap under the title.
  Spec overlay marks perks that can't be anointed (⊘, same rule as the Anointments list). Something From Nothing (+4 other
  traits) get their class colour: build-data takes the class from the owning creature when the trait source lacks it.
  Hover styles only on hover-capable devices (no grey rows while scrolling on touch). Landscape-phone Planner layout.
- **Relics (G6):** large code art (`scr_RelicBigIcon`) everywhere except the badge next to the creature sprite; build error
  if a relic lacks it.
- **Taxonomy (G7):** a name search also lists matching sub-categories ("Persist" → 4 tags).
- **Appendix (G8):** Class Advantage and Random Targets sections; `spell.aim` (record fields 5 + 18, data-only).
- **Nether (G9):** Faucet valve code reads right→left (user ruling; NETHER.md updated). Nether Boss page: the boss room's 2
  chests hold 9 bundles each (code).
- **Waiting:** handoffs `HANDOFF_artifact_slot_uniqueness` (#23, #24), `_relic_rank_taxonomy` (#17), `_dark_summoning_pool`
  (#19), `_resurrection_blocks_final_summoning` (#14, #15, #30), `_nether_boss_reward` (#7 rest), `_macro_trait_order` (#12).
  User calls: #24 (code says 6/3/3, not 6 total), #17 threshold, #28 Count as Manual members, #19 rule. #5 Triggers waits on G6.

## 2026-10-13 — Weaponized Spirit: roll credit and clarify note (user-approved)
- `hasRoll` (data only): Weaponized Spirit added to the Booze end-of-turn auto-cast roll (while it's in play, Arsenal
  gems roll it too).
- Clarify note: it applies to every rule on both sides; Arsenal spells can't be cast manually (unless Sobered Up /
  Brewmaster's Handshake) and get the Booze auto-cast chance; Booze spells get Arsenal effects (e.g. Killing Machine).

## 2026-10-13 — Booze roll credited; Frozen clarify note (user-approved)
- `hasRoll` (data only): the Booze end-of-turn auto-cast roll (15%, 30% with Top Shelf / Happy Hour) is now credited
  to the 15 Booze spells, the Top Shelf perk and Happy Hour (HAPPYHOUR3). Before this it was a system roll with no owner.
- **Frozen** clarify note: by the code the first thaw roll is 50% (100% if resistant), then 100%; the text says 25%,
  doubling each turn. The condition detail page now shows clarify notes; the build joins `kind: "condition"` entries.

## 2026-10-13 — Relic roll flags re-attributed; code-read trigger labels (user-approved)
- Relic `hasRoll` flags (data only, no UI): the extract had read relic gate ids in the wrong order. Now 20 relics /
  36 ranks have a chance roll (was 8 / 16, 8 of them wrong). New: Arbiter, Holy Shield of Surathli rank 50 (10% to prevent
  damage); Arbiter is relic id 0 in the code.
- Effect formulas: 5 trigger labels now come from the code instead of a vote. Peekaboo!, Master of Centaurs and Master of
  Effigies (two clauses) go from "damage taken" to "damage dealt"; Heart of Caliban goes from "timeline" to "damage taken".
- No community CSV carries these fields, so there are no errata.

## 2026-10-13 — Ten more code ≠ text clarify notes (user-approved)
- High confidence: **Mass Resurrection** (no 30% roll; all others come back at 50% Health), **Not Quite A Dud** (no 50%
  roll; the Bomb is always kept), **Of One Mind** (extra attack = full normal damage, not 10%), **Gravewalker** perk
  (resurrects with full Health, not 50%).
- Medium-high / medium: **Going Mad** (100% of lowest stat, Health counted), **Power In Balance** (flat +10% once),
  **Synthesis** (full highest stat), **Harbinger's Sign** (always casts), **Ferocity** (Savage only, no +25%),
  **Psychic Suicide** perk (no potency bonus). Same `clarify` field as before; the game text stays verbatim.

## 2026-10-13 — Cold Blood and Furor clarify notes
- **Cold Blood:** the code adds a random 75–200% on top, so hits deal 175–300% of normal damage (text: 50–250%).
- **Furor:** each extra attack deals 300% (text: 200%). Both from the extract's hand traces of the effect-formula residual.
- Token guard now ignores machine `code` templates (the macro vocabulary's `"1,{n}"`); the rebuilt data also carries the
  extract's additive macro-vocabulary fields (codes, behaviour) from its S34 work.

## 2026-10-13 — Real game names for every tokenized word, realm property and rune
- **Tokens:** every `{TOKEN}` in trait / spell / perk / start-of-battle text now shows the game's own word, read from the
  extract's new `token_names.json` (the game's text renderer and its `scr_Lang*` resolvers). Before, missing tokens were
  guessed from their key and a few had hand-written names. Visible changes: condition names follow the game (Burning,
  Silenced, Dire Wolves, Shelled, Warded, Protected, Immune, Torun Junior …; the old names came from the code's internal
  suffixes), and action / stat words keep the game's capitals ("After this creature Attacks", "Charges"). Trait texts are
  rendered from the game's tokenized text (802 changed, nearly all capitalisation). The same names are used in tag labels,
  taxonomy filters, the condition glossary, start-of-battle rows, the Ruse rune clarify line and the boss advice prose.
- **Build guard:** the build fails if any shipped text has a `{TOKEN}` without a code-grounded word.
- **Realm properties** show the game's name (`L_REALM_*`) with the rolled value as X, e.g. "Extra Attack: X%", "Buff: X",
  replacing the hand-written names. **Runes** show the game's rune line (e.g. "False God has 200% more Attack"); the effect
  line is no longer repeated under it, and its `{TIMELINE}` token renders.

## 2026-10-13 — Arena vendor skins: names were one record off
- The Arena vendor's five skins showed as Pyre, Chaos Axe, Death Mace, Life Sword and Nature Bow. The shop sells Chaos Axe,
  Death Mace, Life Sword, Nature Bow and Sorcery Staff: the extract's shop builder looked the code skin id up in the shifted
  `skins.json` (code id + 1). Fixed at the source (`build_shops_true.py` now joins `skin_owners.json`); only these five shop
  rows changed. Audit of every other skin join (Nether Boss parties, Gate rewards, Nether shop): no other offset errors.

## 2026-10-12 — Devastating Throw: wrong clarify note removed
- The spell carried a clarify note saying its text implies Intelligence. The game text actually says 50% Attack and 50%
  Speed, which is exactly what the code does (extract re-check, bc_SpellDamage case 0x1415d8468). Note removed; only this
  spell changed in `data.js`.

## 2026-10-12 — Morph spells get their spell-gem property list
- The 5 Morph spells (Morph: Chaos / Death / Life / Nature / Sorcery) had no code compat record, so the app left them
  unrestricted. Cause (extract): their text keys contain a colon (`L_SN_MORPH:CHAOS`) and the extractor's key pattern
  rejected it. Fixed there; they now take the same `scr_FixSpellGemProps` rules as every spell (24 allowed properties each;
  not Moonstone, Obsidian, Diamond or Jasper). Only these 5 spells changed in `data.js`.

## 2026-10-12 — Nether Stone Drops note: "Per loot bundle"
- The note under the Nether Stone Drops table said "Per loot roll". In the extract, "loot roll" means the ~20 item rolls inside a
  bundle; the Nether Stone gets one roll per bundle (`inv_Loot` bundle loop, re-checked in code). Numbers unchanged.

## 2026-10-12 — Extract doc references updated (no app change)
- The extract's research docs were consolidated into topic docs (e.g. `code/NETHER.md`, `code/COMBAT_RULES.md`,
  `code/LOOT.md`); finished handoffs moved to `_su_extract/archive/handoffs/`. Source comments in `app.js` /
  `build-data.mjs` and the paths in BACKLOG / DECISIONS / Progress / WIKI_CONTEXT now point at the new names. Old name →
  new doc: the extract's CONTEXT_MAP, "Merged and archived docs". No behaviour or data change.

## 2026-10-12 — Status Effects folded into the Appendix; perk spell cards lose casting chips
- The Status Effects page is gone from the menu: it is now the first section of the Appendix, with Buffs, Debuffs and
  Minions as collapsible sub-sections (search opens everything that matches).
- Spell containers under specialization perks (spec pages and a perk's Taxonomy view) no longer show the casting chip
  (e.g. "35% · When …"); the perk text already says it. Trait / boss spell cards keep theirs.

## 2026-10-12 — Effect data from a full formula rebuild
- The extract's full formula rebuild was re-run (first remote run via Task Scheduler). Spell stats unchanged; the damage
  pipeline's spell-class step now carries its code source (cast sets the class from the gem; Convoke the Spirits picks the
  class strong against the target).

## 2026-10-12 — Nether pages: boss names, not base creatures
- The boss creature's card shows the boss name (Kiichi, not Eft Howler; Phobos ×6, not Sadomasochist ×6; Vitja; Kraynaks),
  as the game names it. Duos, the Aspects, the Shadows, the Gemlings and the six-copy 3rd fights keep their own names.
- Threat text no longer names base creatures (Sadomasochist → Phobos, Onyx Carbuncle dropped, Mimic → Kraynaks/copy).

## 2026-10-12 — Spells: the real stat each spell scales with
- 13 spells scale off a stat their text doesn't mention. Each now has a code note under its game text: Pumpkin King's
  Wrath, Harbinger's Curse, Direct Orders, Blood Spray, Conductive Chains, Infinite Blades and Blindside (Speed); Haunt,
  Judgment Blade, Star Blast and Pustule (Defense); Phoenix Burst (Attack); Devastating Throw (Attack and Speed).
- Code effect data (`effects-code.json`) no longer marks every spell as Intelligence-based. 59 spell amounts now carry
  the code stat (Speed, Attack, Defense, highest / lowest stat, Max Health, or a split). Source:
  `_su_extract/code/SPELL_POTENCY_STAT_FINDINGS.md`.

## 2026-10-12 — Flubris and Kraynaks: six-copy threat
- 3rd fight: a new first threat, "Six Flubris / Six Kraynaks instead of a random party" (six copies, each with the boss
  trait; the tier 3 trait code is the same as tier 2's, per NETHER_BOSS_BEHAVIOR_FINDINGS). The trait threat below it now
  describes the per-creature behaviour only.

## 2026-10-12 — Boss pages: no chips before Threats
- Removed the remaining notes above the Threats section: False God mechanics, the six-copy 3rd-fight line on Nether pages,
  and the Gate unlock and level lines. Pages go sprite → (tier toggle) → Threats.

## 2026-10-12 — Boss pages: duo sprites, trimmed creature cards
- Duo Nether Bosses (Judgment and Mercy, Scylla and Charybdis) show both sprites side by side on the grid tile, in the page
  header and in the lead portrait.
- Creature cards drop the own-trait blocks (Nether and Gate) and the base-creature chip; the trait materials drop the
  wiki-source note.

## 2026-10-12 — Boss pages: sprite first, no generic chips
- Nether Boss pages open with the boss sprite above the tier toggle, like the Gate of the Gods pages.
- Removed the chips that explain boss fights in general (random fill creatures, random spells/artifacts and enemy AI, the
  instant-kill rule) from Nether, Gate and False God pages. Boss-specific chips stay (six-copy 3rd fights, False God
  mechanics, Gate unlock and level rule).

## 2026-10-11 — Gate of the Gods pages
- The extract's Gate of the Gods data landed (31 gods); the Bosses toggle's third tab is live, with god portraits as tiles.
- God page: fight notes (5 random realm creatures, 5 random spells + artifact each, no Avatar Ultimate; your creatures count
  as level 100; enemy level = your average level × the difficulty multiplier; unlock condition; the instant-kill rule except
  vs Lister), Threats, base-stat bars, the Avatar (god trait with plain code-vs-text notes, the own trait it replaces), a
  Difficulty table (level ×, Emblems, Avatar Mana, costume %), Rewards (Emblem, Avatar Mana, costume chance past 10, skins,
  decoration, Ascension; the god's costume shown), Lore.
- Threats authored per god in `data/reference/gate_god_advice.json` from the code behaviour (e.g. Vulcanar halves your stats
  at battle start; Meraxis reflects onto your whole party; Erebyss wipes you on its 2nd turn and Vertraag on its 3rd; Torun's
  500% per turn start; Shallan counts its side's own actions). build-data validates coverage and rejects code-like text.
- build-data: gate builder (Avatar by name, asserted by its replaced trait's runtime id; god trait by runtime id; costume from
  the wardrobe's god entries); dialog without the speaker tag, `{PLAYERNAME}` → "[your name]", repeated lines dropped.

## 2026-10-11 — Nether Boss pages; boss-type toggle; stat bars on boss pages
- Bosses list: Nether Bosses | False Gods | Gate of the Gods toggle (the Realms page's style); Gate of the Gods disabled until
  its data lands. Nether Bosses list as creature tiles (boss-skin battle sprite).
- Nether Boss page (35): 1st fight | 2nd fight | 3rd+ toggle (trait tier = times beaten); party lines (random fill, random
  loadout, normal AI; six copies for Flubris / Kraynaks at tier 3); the boss instant-kill rule; Threats per tier; base-stat
  table with magnitude bars; Creatures (boss trait for the tier with plain code-vs-text notes, own trait); Rewards (the 3 trait
  materials and their traits, Key Fragments, first-win decoration, Royal Mode orb, Inner Darkness unlocks); Lore (dialog).
- Threats: authored per boss and tier in `data/reference/nether_boss_advice.json` from the extract's code behaviour and game
  rules; build-data validates coverage and rejects code-like text.
- build-data: Nether Boss builder (creature joined by name and asserted by its own trait's runtime id; tier traits by runtime
  id, Flubris tier 2 shows its blacklisted duplicate's shipped twin; skins by code skin id; materials from the wiki table,
  asserted against the item reconciliation source). Encounter keys `NB_<key>` (Loid / Imp Impington share names with False
  Gods). Unbuilt boss types warn instead of being skipped silently.
- False God pages: base stats as the magnitude-bar table; the instant-kill rule shown (not on Jotun, which can't be damaged).

## 2026-10-11 — Rune advice review: Takes Less Damage, More Health
- Takes Less Damage / More Health (user): build-relative like More Defense; Avoid only for a sprint kill (scaling on 3+
  parts: Lost Construct). Dropped the generic "slower to kill" Avoid elsewhere; still Recommended vs Jotun.

## 2026-10-11 — Rune advice from the rune research (extract HANDOFF_false_god_rune_research, 9 answers)
- Damage Cap: per hit, the last step, every damage type, nothing bypasses it; it's about hit size (build-relative), so it's
  now Avoid only where parts die more than once (Caliban's Heart refills every part; Loid's Head resurrects at full Health),
  with the "just under 10%" hit-size note. Dropped from the generic "slower to kill" group elsewhere.
- Damage Over Time: reducible (Defending ×0.65, Barrier, class advantage), not by Defense; lands before Bleed / Poison /
  Burned ticks; Vulnerable makes it 112.5%. New Avoid on Nebodar (kept + growing Burned right after the hit) and on bosses
  that can cast Rapture (Vulnerable: Hydranox, Caliban; added to Saint Althea's Blight line). Each line ends with the
  Defending / Defense note.
- Deals More Damage: only damage a part is the source of counts (attacks, spells, formula steps, Loid's Boils; not
  Burned / Poison / Bleed ticks or Blight). New Avoid where that damage grows with stacked stats (Hydranox, The Ancestor,
  Lost Construct); Loid's line adds the Boils reflect.
- Avoids Damage on Loid: notes the one upside (a Prevented hit isn't reflected).
- Speed raises dodge (research Q2): the More Speed dodge line stands.
- build-data: the extract now also holds 35 Nether Boss encounters (different schema); they're skipped until that page
  is built (BACKLOG).

## 2026-10-11 — Rune advice review: Keeps Its Stats, Mass Buffs
- Keeps Its Stats (user): Avoid where the boss stacks stats that feed its damage (Lost Construct's stat-gain damage; Attack /
  Intelligence gains that its attacks, damage spells or formula damage use: Jotun, Hydranox, The Ancestor, Mindwurm);
  lowering its stats is the counter, and the rune cuts every stat loss by 80%.
- Mass Buffs (user): no False God interacts with buffs, so it stays unlisted.

## 2026-10-11 — Rune advice review: More Intelligence, More Defense, Immune runes
- More Intelligence (user): judged by what actually deals damage (the damage-source mapping): damage spells, Burned,
  Int-based formula damage, and heals cast on Blighted creatures (Saint Althea). Mindwurm's Orbs only turn your own
  creatures against you, so More Intelligence is now Recommended there.
- More Defense (user): build-relative; Avoid only for a sprint kill (scaling on 3+ parts) or damage that scales with Defense
  (Loid's highest stat, Lost Construct's stat-gain damage). Recommended vs Jotun as before.
- Immune to Attacks / Spells / Indirect: build-relative, unchanged (Recommended vs Jotun only).

## 2026-10-11 — Rune advice review: Deals More Damage
- (user) Recommended vs Imp Impington Reborn: only 3 of its 6 parts deal damage (the Cannon and both Shoulders), all from
  spells; its real threats (instant kill, timeline push) don't scale with it. Rule: ≤2 damage-dealing part types, spell
  damage only, and an instant-kill or timeline threat. Elsewhere the Avoid reasons stay as they were until the rune research
  handoff answers which damage the +150% boosts (Q8) and the damage type of the Ancestor / Lost Construct formula steps (Q9).

## 2026-10-11 — Rune advice review: Damage Cap, Damage Over Time (research), Mass Debuffs
- Damage Cap and Damage Over Time: advice unchanged until the rune research handoff answers questions 3–7 (what counts
  as one capped hit, damage types, Caliban/Loid interaction; whether the 75% can be reduced and when it lands vs Burned).
- Mass Debuffs (user): never recommended. Avoid vs Loid (debuffs multiply its damage) and now Saint Althea (Blight: damage
  from the debuffs can't be healed back).

## 2026-10-11 — Rune advice review: Avoids Damage
- (user) One of the hardest runes on any boss you can kill, worst in a sprint kill. Sprint = scaling on 3+ parts, no single
  part to stop it (Lost Construct). Otherwise the reason names the part to focus-kill first (Loid's Head, Nebodar's Head,
  Mindwurm's Body, …); Caliban: hard even in its long fight. Still Recommended vs Jotun (can't be damaged).
- Research question (does a Prevented hit still trigger Loid's Boils?) → `_su_extract/code/HANDOFF_false_god_rune_research.md`.

## 2026-10-11 — Rune advice review (user, rune by rune): Always Crit, Speed, Top of Timeline
- **Always Crit** (user rule): only attacks crit (spells / indirect only through a trait), and crits hit harder the faster
  the attacker is than the target (code: bonus 0.25 + max(0, 1 + ln(Spd att / Spd tgt)), EFFECT_FORMULAS S12). Avoid only
  vs attacks of 200%+, attacks that grow with Attack gains, or attackers that gain Speed. Dropped vs bosses without attacks.
- **Speed model fixed** (TIMELINE_FINDINGS): every creature gets one turn per round; Speed only sets the starting order and
  mid-battle Speed changes don't reorder it. Removed every "more turns" reason (More Speed, Top of Timeline, the "Grows
  stronger" threat). More Speed is now Avoid for crit chance + crit damage on attacks, dodge (slower kill when a long fight
  helps the boss) and The Ancestor's "not Defending" kill; Top of Timeline only vs first-round threats (The Ancestor,
  Impington's instant kill, 300%+ attacks).

## 2026-10-11 — Page renames
- (user) **Appendix → Taxonomy** (top-bar button + page title), **Glossary → Status Effects**, **Errata → Appendix**.
  Internal ids keep the old names: `open-appendix`/`apx-*` = Taxonomy, `open-glossary` = Status Effects,
  `open-errata`/`renderErrata` = Appendix.

## 2026-10-11 — False God spells are pickable gems again
- The 51 False God spells (Plague, Laser Beam, Mementos, Caliban's Orbs, …) were hidden from the gem pickers as "battle-only /
  never created". Wrong: each False God drops its list as Inscriptions (one random unknown spell per anointment pick; code
  `obj_anointpicker`, extract `spell_owners.json` `false_god_inscriptions`). They now show in every gem picker. Hidden list:
  93 → 42 (Ultimates, Runes, Mega Magic, Colorwaves). Test updated.

## 2026-10-11 — Bosses page: rune advice (Recommended / Avoid)
- Section order (user): Threats, Base stats, Body parts, **Runes**, Rewards, Lore.
- **Runes** is back on False God pages, after Threats, as two lists: **Recommended** and **Avoid**. Runes sharing a reason sit
  in one container under that reason. The calls come from the boss's code kit (`bossRuneAdvice`): can it be killed (Jotun:
  every defensive rune is a free reward bonus), which stats its kit uses (More Attack is safe vs Impington and Saint Althea),
  whether a longer fight helps it (revives, resurrection, growing Burned, instant kills, compounding gains → defensive runes
  are Avoid), highest-stat formulas (Loid: any More-stat rune), debuff-scaled damage (Loid: Mass Debuffs), Blight (Damage
  Over Time) and "not Defending" kills (Top of Timeline / More Speed). Runes with no clear call are left out.
- The Damage Cap code clarify (caps only hits above 10%, down to 5%) ships again, as `runes[].clarify`.

## 2026-10-11 — Bosses page: part order follows the formation
- Body-part cards (and the steps inside each Threat) now run head, body, arms, shoulders: formation grid 2, 5, 4, 6, 1, 3.
  Bosses with other parts use whatever sits there (Hydranox: head, body, then the other heads; Caliban: head, heart, hands,
  orbs; Mindwurm: head, body, saddle, tail, orbs).

## 2026-10-11 — Bosses page: Threats and Rewards sections
- **Threats** replaces the threat chips and the timer callout: one container per major threat, headed by its name, holding
  the steps that cause it (part name → its card) and a plain-language "why it matters". Found from the code's step kinds only:
  timed exit, instant kills (incl. "not Defending"), shielded/reviving parts, resurrection, permanent/growing conditions
  (with the condition's description), heavy attacks (≥300%), "×3 unless Provoking", debuff-scaled damage, compounding stat
  gains, damage reflection, timeline push. Sorted deadliest first; advice adapts to unkillable bosses (Jotun).
- **Rewards** (bottom of the page, replaces the Anointments line): Anointment = a perk from one of the listed specs;
  Inscription = one spell you don't know yet from the False God's own list (bosses.json `inscriptions`, S29), shown as full
  spell containers, with spec exceptions (Shadowbringer starts with Plague) as clarify notes.

## 2026-10-11 — Bosses page: whole-creature formation, spell containers, no Runes
- Formation: the six battle frames are drawn edge to edge (no cell containers, no gaps) so they form the whole False God;
  each part still links to its card. The exported PNGs are trimmed, so each frame is placed at its code offset inside its
  64x64 cell (new `_su_extract/assets/battle_frame_offsets.json`, dumped by `tools/scripts/dump_battle_frame_offsets.csx`;
  build fails on a missing offset).
- Boss selection grid: the same whole-creature formation as the tile art, 2 tiles per row (5 rows for the 10 False Gods).
- Cast steps show each spell as the full spell-gem container (icon + name + description) used on the relic page, not a chip.
- Runes section removed from boss pages (it was the same list on every False God); the per-rune code check is no longer
  shipped in data.js.

## 2026-10-11 — Bosses page (False Gods)
- **Bosses** (Menu, below Nether Realm): portrait grid grouped by boss type (False Gods now; Nether Bosses and Gate of the Gods
  join the same page when the extract ships them). A boss page shows the battle formation (tap a part to jump to it), encounter
  callouts (Jotun leaves after 24 turns), threat chips (instant kills, permanent debuffs, immunity, resurrection, damage
  reflection, timeline push; tap → the part), shared base stats, anointment specs, then every body part in party order:
  trait, **On its turn** and **Always**, rendered from the code's step list (`_su_extract` bosses.json, S29), never from trait
  text. Spells and buffs/debuffs are chips that open their detail. Runes (with the code check where it differs or adds, e.g.
  Damage Cap) and Lore are collapsed sections. The Appendix False God link opens the same page.
- Code facts now visible: Saint Althea's second Hand casts the Shoulder's healing spells (its own Devour / Soul Harvest /
  Terror / Intimidate list is never used); one Althea Shoulder has no script; Mindwurm's saddle pool has a non-buff entry.
- `build-data.mjs` ships `bosses` with every id translated at build time: spells by code id → key, conditions by code id →
  registry key, traits by **runtime id** (legacy ids cross-checked; the extract left them empty for 9 same-name parts), specs by
  runtime id (asserted by name), part sprites by battle frame (`assets/bossparts/`). Extract notes are rewritten in plain
  language; a note that still reads like code fails the build. Runes get a `code` check.
- **Build fix:** errors recorded after the main report (spell owners, Rodian Masters, bosses) were silently ignored; a second
  gate now fails the build before `data.js` is written. No hidden errors surfaced in the older blocks.
- Returning from a spell/trait link to the page it was opened from keeps that page's scroll position.

## 2026-10-11 — False God names from the game; Misery is not a False God (data only)
- False God names now match the game text (`L_WBOSS_*`): **Imp Impington Reborn**, **Caliban the Unredeemed**, **Jotun**,
  **Lost Construct** (were Imp Impington / Caliban / Jotunir / The Lost Construct). Keys and portrait files are unchanged;
  `build-data.mjs` finds each god's part list through a new `partsKey`.
- **Misery** is gone from the False God list: the code has no Misery False God. Hand / Heart / Brain of Misery are now
  provisionally owned by **Perdition** (Gate of the Gods, `ownerProvenance: user-pending`) and stay hidden behind
  `FEATURES.nyi` until the user's in-game test.
- Rebuilt `data.js`: only `falseGods` names, the three Misery traits' owner fields and meta changed.
- Extract side (not shipped yet): `_su_extract/data/model/bosses.json`, every False God part's behaviour, for the planned
  boss feature (`_su_extract/code/HANDOFF_boss_encounters.md`).

## 2026-10-10 — Errata page + Rodian Masters
- **Errata** (menu, right below Glossary): new page with the Glossary's layout and search. It takes every Glossary section
  except Buffs / Debuffs / Minions: Resurrection Order, Start of Battle Order, Nether Stone Drops, Pandemonium Shrine,
  Maximum Realm Bonus. The Glossary now holds only Buffs, Debuffs and Minions. Every Errata section starts collapsed.
- **Rodian Masters** (new Errata table; `_su_extract` master_realms.json, `HANDOFF_rodian_masters.md`): one row per realm
  (30) with the races its Creature Master can be, as race-icon chips; Master-only races (not realm spawns) get a dashed
  chip. Search matches a realm or any race ("Dragon" → Fae Lands, Temple of Lies). Note line: deepest depth only, fewest
  defeated race, the 1% rare / Mimic rolls and the Nether rule.
- `build-data.mjs` ships `masterRealms` (joined by realm name, `&` ↔ `and`); the build fails if a pool race has no
  "Master of …" trait or a realm doesn't join (30 realms · 151 races). No community CSV has a realm ↔ Master column.

## 2026-10-10 — granted spells, holdable-only spell pickers, Jade fix
- **Granted spells** (`_su_extract` spell_owners.json, `HANDOFF_spell_owners.md`): spells a perk, trait or relic gives a creature
  now show on that creature automatically and use no spell-gem slot. The Spells button reads "+N" and the Spells page lists
  them under **Granted** with their trigger and owner. Conditions come from the code: Rune Knight Rune perks → creatures of
  that Rune's class; Spellweaver Colorwave → the variant of the creature's class (a fused creature uses its secondary's
  class); Zantai's traits → Mega Magic; Fable rank 100 → 10% Mega Magic; Doomsday → 15% Ill Fate; Immobility → 10% Aggravate;
  Idolatry → the equipped relic's Ultimate; Weapons of Mass Distortion → the relic's Ultimate replaces the artifact spell.
  A perk counts while allocated in the current spec or anointed. Engine: `FX.grantedSpells` (effects.js), tested.
- Owner displays: spell cards under the granting perk (Spec page + perk detail), trait detail, False God body parts
  (their boss AI kits), and the relic's **Ultimate** on the relic detail. A spell's detail lists what grants it.
- **Spell pickers** (Spell Gem, Artifact and Nether Stone wizards) offer only holdable gems: 52 battle-only and 41
  never-created spells are hidden. The kind filter (Ultimate / Rune) became empty and was removed.
- **Macros** leave out spells the game marks "cannot be cast manually" (Booze, Saving Grace, Lucky Gem, …) and include
  granted gems.
- **Jade / Generosity** (`HANDOFF_jade_generosity.md` verdict): the compat data had two extractor bugs. Rebuilt: Jade is now
  allowed on 685 spells; allowed properties changed for 735 spells.

## 2026-10-10 — deleted gems / artifacts leave saved builds
- Deleting a spell gem or artifact now removes it from every saved build, not just the open one. Before, a saved build
  kept the dead id; ids are reused (max + 1) after a reload, so loading that build could equip an unrelated new gem or
  artifact, or keep a phantom gem that took up a spell slot.
- `pruneBuildRefs` runs on delete, on every build load / import (`normalizeBuild`), and once at startup to clean
  references already left in saved builds.

## 2026-10-10 — realm yield model
- Realms → Yield and Compare now use the new code-built yield model: every realm at every favor rank, with a
  Relaxed / Normal / Ruthless toggle. Values include god-altar donations, Treasure Golem / Dumpling rewards, boss-fight
  resource bonuses, resource costs, and realm-boost caps as true averages.
- The god-altar donation is always counted (favor +150, resources -1000) with no column of its own; treasure now
  includes the 5% Mimic chance on every realm chest.
- Realm yields now include the Pandemonium shrine (all 13 outcomes, weighted) and the Backer NPC (4–7 treasure
  bundles on 35% of floors).
- Buff / Debuff / Minion realm boosts never exceed 5: the Music Crystal / Alchemy extra rolls (stored in the Minion
  slot) now count as Minion boosts.
- Treasure Map: 25% per floor (not quest-only); its dig spot's 3 bundles count in treasure.
- Glossary: new Pandemonium Shrine table (13 outcomes, 1 in 13 each, from the code).
- Common bonuses now show their real totals (chests, nodes, breakables, spawn and flee chances) per rank.

## 2026-10-10 — realm favor text tags
- Realm favor rows: 33 code-vs-text tags in total. Forgotten Lab's Modron emblem and Schematic refill were tagged first,
  then 31 more from the all-realm yield audit (swapped Damarel bonuses, refills that never roll, encounter favor the
  text omits, counts).
- Realm objects: a "(code: N)" tag on an object's count makes the card show the code count; the reference count moves
  to a tooltip (Abandoned Cave 3, Angel Shrine 1, Giant Gears 3, Apocalypse Nest 5, Living Ember 8).

## 2026-10-09 — realm property rules + true maximum realm bonus
- Glossary: new **Maximum Realm Bonus** table, the best reachable realm (item) bonus per instability at your deepest
  depth and below it: 60 / 139 / 259 / 433 / **672%**. Source: the game's property generator rules and the realm bonus
  formula.
- Nether Stone Drops now runs to that true maximum (was a flat 600%), adding the 12-in-5000 Pariah row.
- Threats: realm properties the game never places as *hidden* properties carry a "Visible only" chip (22 of them).
- Source: `_su_extract/code/REALM_PROPERTY_RULES.md` (`data/model/realm_property_rules.json`).

## 2026-10-09 — realm Yield tab now code-grounded
- The Yield tab's realm × favor-rank matrix now comes from the game code instead of the hand-built `data/favor/Favor_MTX.csv`
  (kept as the diff reference). `build-data.mjs` reads `_su_extract/audit_community_csv/Favor_CODE.csv`, built from:
  - per-realm object spawn counts decoded from the realm generator;
  - every realm object's interaction and battle-aftermath payouts, per favor rank.
- Units: favor points; treasure in loot bundles; resources as grants; Dumpling / Treasure Golem as expected spawns (%);
  boosts as expected counts (Buff / Debuff capped at 5). The generic columns are unchanged: they match the old matrix
  exactly. Faster Quest Completion is not modelled yet. Details: `_su_extract/code/REALM_YIELDS.md`,
  `REALM_SPAWN_COUNTS.md`.

## 2026-10-09 — realm objects: emblem chances checked against code
- All 72 "N% Chance" favor rows checked against the code: 68 match; Hunter's Lodge, Inactive Modrons and Horseshoe emblem
  chances are 25% in code (text 35%) and the Monolith's "50% Chance" treasure has no roll. Those rows carry a "(code: …)" note.

## 2026-10-09 — realm objects: code-grounded odds on random interactions
- Rank-0 strings of random objects now carry the real odds: Oasis 25% each (Mirage / Favor / Treasure [3] / Nix; 33% each
  once Mirages are removed), the favor-or-encounter objects 75% / 25% (Torture Device, Spider Eggs, Corrupted Totem, Totem,
  Mask, Obelisk, Bloodstained Altar), Small Slot Machine ⅓ each, Victim ⅓ each (Treasure [3] / Mimic & Treasure [5] /
  Encounter). Monolith rank 20 notes the code has no roll. Source: `_su_extract/code/CHANCE_INTERACTIONS.md`.

## 2026-10-09 — realm object treasure counts grounded in code
- Realm_REF rank-0 effects now carry the real treasure **bundle** count (one bundle = one full `inv_Loot` roll list):
  `Simple Interaction - Treasure [3]` (piles, caches, tombs, cages, cairns…), `[5]` (fetch quests, LoBaB bookshelves,
  generator), `[6]` (large chests in WDSD / Titan's Wound / Astral Gallery), `[10]` (Temple of Lies chest). Boss objects:
  `Favor [50] & Treasure [12]` (2 chests × (3 + 3 boss-room)); a Nether Boss fight adds +3 per chest (18).
- Favor rows that are an object's only treasure got their base count: "… Drop/Receive/Gain Treasure [3]" (Skull Candle [2]),
  "50% Chance to Receive Treasure … [3]". Boss-room blessings: "[+5 per chest]"; Temple of Lies: "code applies at rank 70";
  Blood Grove: "[not in chest code]". Victim `Treasure [3]`, Oasis `Treasure [3]` (spawns a realm chest), Mirrorball rank 0
  has no treasure (only from rank 50). Combination_REF: Music Crystal / Chemistry Table "Treasure Reward [10]".
- Source: `_su_extract/code/REALM_OBJECT_BUNDLES.md`; the CSVs were patched at the source (`Realm_REF.csv`,
  `Combination_REF.csv`, backups in `_raw_csv/_backup_20261009/`) and re-ingested.

## 2026-10-10 — sort toggles can be removed
- Every sort button (saved libraries, nether-stone / spell pickers in the artifact wizard, Builds, Realms, creature stat sort)
  now cycles natural → reversed → **off**. Off = no button lit, list in its default order (creature picker lights "—").
  `sortPick` in app.js; `sortCur` keeps a never-touched default lit.

## 2026-10-10 — Spec page footer
- Left-aligned "‹ Specializations" button in the spec page footer (same action as the header ‹: back to the selector grid).

## 2026-10-09 — 10-item batch (deployed together)
- **Artifact wizard (phones):** the 9 slots sit on one locked row that scrolls sideways; the picker / preview / live bonus
  fills the rest of the screen. Overlay re-renders now keep horizontal scroll as well as vertical (`resetTop` resets
  vertical only).
- **Nether stone Spell filter** (wizard picker + library) cycles off → any spell → On Attack / Defend / Cast / Provoke / Turn; a
  stone matches if ANY of its spells has that trigger.
- **Artifact library → Sockets** lists empty sockets (the info panel never asked for them; every artifact type was
  affected). Empty rows respect rank locks everywhere ("Tier N" for locked ones).
- **Offline fusion colours:** `fusion.json` was lazy-loaded and only lived in the per-deploy SHELL cache, so it was cached only
  if a fused creature rendered online since the last deploy. Now in `precache-list.json` and served from the stable ASSETS
  cache (`build-data.mjs` adds it; `sw.js` routes it).
- **Spell-gem properties audit:** every property is allowed on 68+ spells except **Jade (Generosity), allowed on none.** The
  extract's decompile forces its column (c13) to 0 for every spell, so the app matches the code reading. Verification handed
  off (`_su_extract/code/HANDOFF_jade_generosity.md`); no app change yet.
- **Spec page:** tapping a spec (phones) or the Spec tile opens one full page: animated costume, prose, perks. **Edit** turns
  the perk cards into rank steppers in place; ‹ returns to the selector grid; footer **Confirm** (new spec) / **Done** (active
  spec). Replaces the read-only spec detail page; the desktop picker keeps its info panel + Customize.
- **Anointments tile:** ✕ clears them (like the Spec tile); icon rows are centred at the same size, 5 per row.
- **God Shop:** "Rank N" Favor Rank per item from the community reference (`god_shop_ref` tier), joined by god + kind + name
  (630/630). Cosmetics have no reference rank. Code gate handed off (`_su_extract/code/HANDOFF_god_shop_favor_rank.md`).
- **Guild Shop:** the 5 guilds as a row of 3 over an offset row of 2.
- **Shop lists:** item text centred vertically in each row (all shops).

## 2026-10-09 — import: no duplicate artifacts / nether stones
- Importing a build (text or share link) reuses an exact duplicate artifact or nether stone already in the library
  instead of adding a copy. Matching is order-insensitive and ignores fields a game export can't carry (stone icon, rarity
  when the library stone has none). Each library item is claimed once per import, so two identical artifacts in one build
  still give each creature its own. Rules in `BUILD_IO.md`; helpers tested in `tools/buildio_test.mjs`; checked end to end
  (re-imports add nothing; a build with two identical artifacts adds exactly one copy).
- Roster layout: empty-slot "+" centred across the row; a fresh party stretches to fill the screen until a creature is picked.

## 2026-10-08 — data notes (bullets)
- 2026-10-08: **Glossary → Nether Stone Drops** (from _su_extract `code/HANDOFF_nether_stone_breakpoints.md`). Rows = every
  chance step reachable by 600% realm bonus (k = floor((1+rb)·1.25[·1.25 Pariah ascended]) in N; N Normal 5000 / Relaxed
  2000 / Ruthless 8000), computed in-app by running the game's arithmetic over each whole percent. ⚠ Confidence: both ×1.25
  steps are unconditional in code (no gate found) — code-certain, not yet verified in-game.

- 2026-10-08: realm property 49 "No Additional Attacks/Casts" added (live in code, no codex text; effect text code-sourced, `effect_source: code`). Start-of-battle drops `never_rolled` rows (Copy Your Traits, realm 13, is never generated). Source: _su_extract code/REALM_PROPERTY_POOL_FINDINGS.md.
- 2026-10-08: Glossary → Start of Battle Order, step 0b: timer re-check detail + note that setup-through-step-5 uses last battle's timeline (crit_* return recorded recent_* stats while global.calc_stats is false during battle setup; timeline rebuilt in step 6). Source: _su_extract START_OF_BATTLE_FINDINGS.md (S26).

## 2026-10-07 — `hasRoll` flags (data only)
- `hasRoll` boolean on traits, spec perks, spells, conditions, cards (family) and relics. Relics carry it per rank, and on the relic if any rank has it.
  It says whether any `scr_Roll` call site (a chance roll) belongs to the object. Source: `_su_extract/data/model/has_roll.json`
  (the roll sites are listed in `_su_extract/code/ROLL_SITES.md`).
- **No UI yet.** It is meant to drive membership of a future Luck/Roll glossary entry. Relic perk ids the extract couldn't map to a real rank
  (19 sites) and 6 card sites with no family are not flagged. About 90 in-battle rolls have no owner, so `false` means "no attributed roll".

## 2026-10-06 — UI batch (libraries, selection, icons, Realms Objects)
- **Empty home tiles** use the game's menu glyphs: Specialization = `menu_characterG_0`, Anointments =
  `codex_anointmentsG_0` (G = greyed; non-G variants also copied to `assets/ui/`). Shipped as `D.uiIcons` (hashed + precached).
  The hand glyph's art fills only 9×11 of its 16px canvas (character: 12×14), so it draws at 2.5× (40px) vs 32px to read
  the same size. Equipped anointment icons = a fixed 5-wide grid of ≤32px cells: 5 = one row on every width (desktop
  200px tile, phones 176/161px), Royal's 20 (5 + Master of All 10 + Highborn 5) = 4×5, tile ~170–190px tall.
- **Nether Stones library** mirrors Artifacts: no auto-selection, info panel only when a stone is selected, footer =
  Hide equipped · Edit · Delete · **Build** (Edit/Delete moved out of the info panel).
- **Library header bars** (Artifacts / Nether Stones / Spell Gems): header search + filter/sort row. Artifacts: Type ▾,
  Recent | A–Z | Rank. Nether: Has trait / Has spell, Recent | A–Z | Hea…Spe. Spell Gems: Class ▾, Recent | A–Z | Level |
  Potency. Shared `libSortSeg` + actions `lib-search` / `lib-sort` / `lib-flag` / `lib-type` / `lib-cls`.
- **Held selections**: tapping the selected item again deselects, and tapping empty space in the list area deselects
  (`clearHeldSelection`, `data-action="lib-deselect"` zones; `noop` marks pickers/blocked tiles). Covers creature picker,
  spec picker, Builds, Artifacts / Nether / Spell Gem libraries, icon picker (tap-again now DESELECTS — "Use this icon"
  commits), Spell Gem builder (spell + property picker), Artifact builder (type + open slot picker), Nether builder picker.
  Deleting an artifact / stone / gem no longer auto-selects the first remaining one.
- **Touch typing**: while a text field is focused, the first tap elsewhere only leaves the field (closes the phone
  keyboard) and is swallowed. Touch/pen only — mouse clicks are untouched (desktop auto-focuses search fields).
- **Realm page tabs: Interactions | Favor | Yield** (Realms list keeps Browse | Compare). Interactions (default) =
  Creatures, Resources, then one card per object: `Name ×count | rank-0 base interaction` + the favor-rank tiers that
  upgrade it (rank · effect) — taken straight from the user's grouping under "Unique Realm Objects" in Realm_REF.csv
  (rows > 0 under each object; `parseRealmOther` → `objects[].favor`; build logs 540/540 favor tiers placed).
  Combo tables stay here. Favor = the old List track (slider + common toggle + tiers). Yield = the old Bars.
- **Menu → Nether Realm** helper (code-grounded, `_su_extract/code/NETHER_HELPERS_FINDINGS.md` → `D.netherHelpers`):
  **Faucet** = the valve room (`room_nether_valves`): 4 on/off valves form a code that picks the one chest's contents —
  tappable valves + all 16 codes (rewards, then the Mimic battle, then the 5 empty codes); tap a row to set the valves.
  Digit order assumed left→right (creation order) — verify: only the LEFT valve on should show the gem chest (10 emblems).
  **Mimic Mike** (`room_nether_treasurehuge`): 35 chests rolled at room creation, the closed sprite shows the contents;
  legend (parchment + Nether Stone first) with odds + an opens tracker (7 base, parchment +2/+3/+4, cap 35, undo/reset).
- **Icons beside names**: spec emblems on anointment spec chips, the Spec filter list + active chip, saved-build spec line;
  class icons in the Class filter list + active Class chip (creatures + cards); False God icons in the False God filter.

## 2026-10-06 — Multi-Target Spells rule
- Rule: Multi-Target = the effect affects more than one creature (any targeting mechanism, either side); repeat hits on one target don't count; unpredictable random targets/outcomes aren't assigned. 20 pending spell proposals approved, 4 rejected (Secret Stuff, Awakened Nether Orbs, Nine Meteors, Euthanasia). Taxonomy review queue now empty.

## 2026-10-06 — Critical Count / Dodge Count
- New `Multiplied by::Critical Count` (Recklessness, Mass Effect) and `Multiplied by::Dodge Count` (Recklessness, Windwalker); parents Critical / Dodge by extension. Two objects each, so they show without the single-use toggle. Rift Dancer card proposal now properly rejected (`cardRejections`).

## 2026-10-06 — Missing creatures, action counts, Gain a Perk
- New `Multiplied by::Missing Creature Count` (replaces Dead Creature Count on 11 Hermit-style perks + Focused Magicks) and `Active If::Creatures Missing` (Reclusive Remedy, Ancestry, Final Stand — which keeps Dead Creature Count: dead and missing).
- "For each time their on-X effects activated" → existing per-action counts: Juggernaut / Outburst = Attack + Cast + Defend + Provoke Count; Fable adds those + Resurrect Count. No generic activation value.
- New `Affect on Traits::Gain a Perk` (Tools of Creation, Divine Dualwield). Like Sand stays in its spell-gem group.

## 2026-10-06 — Loses Buff/Debuff triggers; Timeline outliers
- New Activates When values (bucketed by side): **Ally Loses Buff/Debuff** (Qila's Assurance, Noetherian's Adamance, Protective Wing ×3, Sanctus, Scapegoat) and **Enemy Loses Buff/Debuff** (Anagnorisis, Snuff, Lingering Frost, Black to White, Fractionation, Amalgam). Trait proposal rejections now supported (`traitRejections`).
- Timeline removed from Defer Pain and Animated Treasure.

## 2026-10-06 — formulas S16 folded in
- `_su_extract` S16: description numbers decoded traits 1,117/1,227, perks 255/299 (each of the 154 still undecoded has a category + proof); all 12 ownership cases decided; handler roles proven from handler bodies; relic/card description-fallback amounts 22→16 / 82→47. Self-check 62/62.
- Clarifications 15 → 22 (Evil Eye ×3, Coming Undone, Powershift, Master of Storms, Dusk & Dawn r70, Good Karma, Necessitarianism). Code tier: 6,465 rules; adapter accepts the S16 chance/threshold object shapes.

## 2026-10-06 — S17 review applied; Timeline vs Turn Counter
- A: 19 replacements approved (Qila's Assurance held for a new "loses a buff" trigger value; Rift Dancer p2 stays Resistant). B: Attack dropped where nothing attacks (Resin keeps Stats + Related Stat::Attack). D: code-proven drops approved with replacements where a correct tag exists (Master of Alementals → Extra/Gain a Spell Gem; Master of Concoctions → Debuffed with X + Automatic/Extra Attack; Singleton → Limit Actions per Turn).
- C (new ruling): turn references → Action/Mechanic::Turn Counter; Timeline = position/order only; start of battle is never Timeline. Additional Turn / Lose Turn / Count Additional (Turns) now imply Turn Counter; 19 turn-only Timeline tags moved. Master of Apocalypses → Count Additional (Turns) + Turn Counter.
- Provenance: code 92.9% · llm 2.5%.

## 2026-10-05 — Build Import / Export (see BUILD_IO.md)
**Menu → Import / Export** (below Builds; compact Riddle-Dwarf-style pop-out with an Import | Export toggle; exports the current party). The game has NO build import (code-certain, `_su_extract/code/EXPORT_BUILD_FINDINGS.md`),
so: Import accepts the game's English "Export Build" text OR a Companion export; Export writes a readable game-style
text (level 1 + app stats) plus a `SUC1:` code line (whole build, compressed, lossless) for sharing between Companion
users. Import always loads into the current party and reuses identical library items. Game exports default perk ranks
to max, gems to level 15 with no properties, artifact level from the primary %. `buildio.js` + `tools/buildio_test.mjs`
(20/20 on a real export); browser round trip game → app → export → wipe → import = identical party.

## 2026-10-05 — taxonomy S17: remaining LLM tags decided from code
- `_su_extract` S17 layer: ~1,190 per-object code rulings; code-confirmed tags +1,346 (0 lost). App provenance now code 92.6% · llm 2.9% (traits 2.9 / perks 4.9 / spells 1.1 / relics 5.1 / cards 5.1%).
- Review list pending with the user: 21 replacements + 59 code-proven drops (never auto-applied).

## 2026-10-05 — spell gem compatibility, code card thresholds, Projects overlay (S18 adoptions)
- Spell Gem builder: the property picker offers only what the spell can take (code: scr_FixSpellGemProps flags + inv_SpellGemCanHaveProperty; 742/747 spells — the 5 "Morph:" variants have no code record and stay unrestricted). One Class Swap and one potency-from-stat property (Tourmaline/Onyx/Topaz/Sapphire) per gem — picking another replaces it; changing the spell drops properties the new spell can't take.
- Cards: power-unlock thresholds now come from code (round(0.33N)/round(0.66N)/N legal creatures; 155/155 equal the old CSV values) + `setSize`.
- Menu › Projects (new, last entry of the Realms/Shops/Glossary group): 129 projects grouped Castle / Missions / Specializations / Godspawn / Unlocks — cost (Resources/Parts/Dust, Normal|Ruthless), required items with icons and quantities, prerequisites (projects/quests). Mockup for review.

## 2026-10-05 — code-vs-text clarifications (Touch of Chaos, Counterspell, Spell Blast)
- In-game text confirmed by the user; the code differs. Stored as `clarify` notes (shown under the game text on the detail page): Touch of Chaos rolls 4%/rank (text 1%), Counterspell +7% per missing charge (text 20%), Spell Blast +5% per MISSING charge (text 10% per charge it has). `effect_clarifications.json` gains kind `spell`; spell detail pages now render clarify notes.

## 2026-10-05 — Molecular Betrayal + stat rounding PROVEN in-game
- User sandbox (level 1, cards off): predicted battle stats matched exactly on all 10 values (Zzyia 32/18/18/28/18, Animatus 56/34/49/34/49). Confirms: stored-stat source for Molecular Betrayal, gain multiplied by the Animatus's own % (Brilliant Creation), single floor at the end. With cards on, card powers add a shared per-stat % to the same pool.

## 2026-10-05 — formulas S14 folded into the code tier
- `_su_extract` S14: all 165 previously-undecompiled gate sites now decompiled; per-path reaching definitions bind 110 more amounts (Decapitation 0.35 = a Health THRESHOLD; bc_SpellDamage slot resolved per spell); slot 0 = enemy side is now code-certain; 121 handler argument roles grounded; Inner Strength = 0.8 (MASSIVE). Self-check 53/53, spot-check 0 wrong.
- Adapter maps the new operand fields (`role`, `compare`, `constantSide`, `subjects`, `mergeBound`); 54 amounts are thresholds (gate values, not magnitudes). EFFECT_ENGINE.md updated.
- New code-vs-text flags (code kept): Valkyrie p3 caps crits AGAINST enemies; Evil Eye 1000× Attack vs "10000%"; Coming Undone reads the attacked creature's stats; Powershift / Master of Storms use ≥ where text says "above".

## 2026-10-05 — S15 adoptions: trait-item code links, artifact tier slots, rune rewards
- Trait items: new code-link pass (`material_trait_links.json`: mat[id] property 15 = Trait, value = runtime trait id) fills links the name join missed — +5 (Quivering Scorpion → Parry, Pristine Marble → Shock Aura, Misery ×3); all 1,717 existing links agree with code; Sinister/Negative Energy already correct (stale recon file only). 47 code links grant traits the app doesn't ship.
- Artifact slots unlock by tier (code): stat 3/10/35 (+primary at 1), trick 5/25, trait 15, spell 50, nether 50 (awakening assumed). Locked boxes show their tier; lowering the tier drops items in boxes it no longer unlocks; saved artifacts with more filled slots than their tier allows are raised to the lowest legal tier on load (content kept).
- RI/Runes: each False God rune shows its reward bonus ("+N% Rewards", scr_RuneBonusRep).
- Game stores anointments per specialization; the app keeps them per build on purpose (memory: su_anointments_per_build).

## 2026-10-05 — stats rounded like the game (code-decoded)
- `_su_extract code/STAT_ROUNDING.md`: fused base = floor((A+B)/2); stored stat after level/personality = max(1, ceil(…)); Atk/Def/Int/Spd floor once after all % bonuses; Health never floored as a whole (artifact share floors, relic share fractional, display floors). App `baseStats`/`finalStats` now match (was Math.round everywhere); many displayed stats shift by ±1.
- Molecular Betrayal (`stat.share`) reads the third creature's STORED stat (pre-%), unrounded — engine fixed, test stub now distinguishes stored vs final.
- 17 rounding rules ship in `effects-code.json` → `pipeline.rounding`. Open (in-game): fractional-Health display; stored-vs-final source check.

## 2026-10-05 — decoded formulas conform to the effect engine (code tier)
- `_su_extract` effect_formulas.json (S10–S13) now lands as a third rule tier (`prov: "code"`) in the effects.js rule shape: 6,418 rules (trait 3,548 · perk 791 · spell 1,287 · relic 298 · card 494) + the global combat pipeline, lazy-loaded from `effects-code.json` (`D.effects.codeFile`, `SU_EFFECTS.loadCodeRules`). Data only: no evaluator consumes the new ops yet, no UI change.
- Shape extensions (optional fields): src kinds spell/relic{minRank}/card{power}; `when`, `target.side`, `amount{value,unit,apply,per,…,conf,site}`, `args`, `chance`. Documented in EFFECT_ENGINE.md §Code tier; tests 30/30.
- Gap logged by the build: 14 manual/generated rules (spell-gem slots / equip-class permissions) have no code-tier counterpart (inventory logic, not battle blocks).

## 2026-10-04 (cont.) — FIX: building a gem from a creature lost the equip context
Build new / Edit from a creature's spell list opened the builder, and Save/Cancel returned to the plain Menu library
(`openSpellGems()`), so the new gem showed "＋ Build new" instead of Equip. The builder now carries `retSlot`;
`backToGemList` reopens that creature's equip list (same header) with the saved/edited gem selected. Menu path unchanged.

## 2026-10-04 (cont.) — FIX: artifact "Spell Gem Slots" didn't add creature spell slots
`FX.gemSlotMax` only counted base 3 + perk/trait grants; the artifact's "Spell Gem Slots" property (Pump Drill trick,
flat +1/+2/+3 at rank 10/25/50, and the same property on a socketed nether stone) was never added. Now summed from the
artifact's contributions (stat `Spell Gem Slot`); stacks with Gray Matter. Code cap on total slots not found
(`bc_CritGetEmptySpellSlots` is opaque VM code) — none applied. Also: equipping a gem now re-renders home so the
"Spells n/m" chip updates immediately (was stale until the next render). Engine tests 27/27.

## 2026-10-04 (cont.) — Creature Spells page
The creature Spells button opens a full-screen **Spells page** when gems are equipped (like Artifacts/Relics): one tile
per equipped gem — gem icon/name (+ spell name if renamed), base class (→ Opal swap class), Lv, spell description +
stats, and the gem's properties at its level; tapping a tile backs out to the equip list with that gem selected.
Shared header `spellsHeaderHtml` / `spellSlotDots` on the page AND the equip list opened from a creature: one circle per
equipped gem in its spell's BASE class colour, then an outlined dashed circle per open slot (total = `creatureSlotMax`,
so Gray Matter etc. count). No gems → the list opens directly (all circles empty).

## 2026-10-04 (cont.) — Relic rank slider steps by 1
Relic detail slider: min 1, step 1 (was 10–100 in steps of 10). Perks still unlock at each multiple of 10; the stat
bonus follows the exact rank (0.1% per rank).

## 2026-10-04 (cont.) — FIX: {SPELL_*} tokens rendered as "Equipment" / "Alcohol" / "Ultimate"
The token table had no {SPELL_*} entries, so the humanizer fell back to the raw token name. The game's
`scr_LangSpellType` maps [equipment, alcohol, jewel, ultimate] → L_ARSENALSPELL / L_BOOZESPELL / L_PRISMSPELL /
L_ULTIMATESPELL (vocabulary.csv: "Arsenal Spell" / "Booze Spell" / "Prism Spell" / "Ultimate Spell"; the same switch
picks the inline icons [spell_artifact]/[spell_booze]/[spell_jewel]/[spell_ultimate]). build-data now puts those words in
`D.terms`. Living Helmet → "This spell is an Arsenal Spell." Faithful quirk: Living Axe reads "each Arsenal Spell spell"
(the game's own template is "{SPELL_equipment} spell").

## 2026-10-04 (cont.) — Spell Gem levels + property amounts (code-grounded)
Source: _su_extract `data/model/spell_gem_properties.json` + `code/SPELL_GEM_PROPERTY_FINDINGS.md` (new research).
- **Levels** = the game's gem `tier`, 1–15 (not the artifact 1–50 scale). Property slots by level: 0 at 1–4, 1 at 5–9,
  2 at 10–14, 3 at 15 (`obj_gemmod`). Icon tier by level (`inv_SpellGemIcon`: `icons` frame = class base 1965/69/73/77/81
  + 0/1/2/3) → `assets/spellgems/<class>_t1..t3.png` from code frames; level 15 keeps the user-authored class icons.
  `D.spellGemTiers` = {min,max,slots[],iconTier[],icons{class:[4]}}.
- **Amounts**: fixed per level, not rolled or stored (`inv_SpellGemGetStat` = f(tier)); 18/28 properties carry
  `tpl` (game L_SPELLMOD template) + `byTier[15]`, e.g. Bloodstone 10→24% Chance to Attack, Citrine 5→19%,
  Moonstone/Obsidian/Malachite 35→105%, Onyx/Sapphire/Topaz/Tourmaline 25→67%, Garnet 58→100%, Jasper +1→+6 turns.
- **Cascading / Singular use the CODE values** (user call): +5% per missing charge / +50% per empty slot (item text
  says 3% / 30%); a `textNote` tooltip says so. Magnetic 15% matches its text.
- Wizard: Level slider (default 15 for new gems; saved gems without a level load as 15), slots past the level are
  locked ("Level 5/10/15"); over-full gems show ⚠ and can't be saved; picker + slots + library show amounts at the
  gem's level; library info shows "Lv N"; gem icons follow level everywhere `gemIcon` is used.
- Open: in-game check of Cascading/Singular; which potency side is Int-based; upgrade cost→tier mapping.

## 2026-10-04 (cont.) — Sort toggles flip direction
Every sort control (spell picker ×3 wizards, creature picker stats, Realms Realm|God, artifact-wizard nether list,
Builds) now flips asc/desc when the ACTIVE sort is tapped again; a newly picked sort starts in its natural direction
(name-style ▲; stats/potency/charges/recent/last-edited ▼). Active button shows ▲/▼. Missing values (no potency, no
charges, no spec) stay last both ways; ties stay A–Z. Shared helpers `sortPick` / `sortSign` / `sortLbl`.

## 2026-10-04 (cont.) — One spell picker for all three wizards + "Self" target
- **Shared spell picker** (`spellPickList` / `spellPickRows` / `spellFilterBar`, actions `spf-*`): the Spell Gem,
  Artifact and Nether Stone wizards render a byte-identical search + filter section — row 1 search · ＋ Filter ·
  ★ Bookmarked (Nether keeps its ‹ Category chip in front), row 2 Target ▾ · Class ▾ · A–Z | Potency | Charges.
  Search matches name, description or tag in all three. The artifact wizard's class chips / A–Z|Class sort are gone.
- **Why there was no "Self":** `spell.target` came only from the user's Spell_REF.csv Target column, which never uses
  Self (values: Target / Enemies / Your Creatures / All Creatures, 82 blank). The game code DOES have it — spell record
  field 5 = target scope, and `bc_CreatureCastSpellGem` builds the cast list `[1, caster]` for scope 4
  (ARTIFACT_SPELL_TARGETING_FINDINGS L279-283). build-data now fills BLANK CSV targets from the code scope
  (`spell_signatures.json` `target_scope`; `targetSrc` = ref|code): 82 filled = 55 Self + 10 Your Creatures +
  9 Enemies + 7 All Creatures + 1 Target. CSV-vs-code agree on 642.
- [x] **Caster-targeted → Self (user-approved):** the 5 spells the code casts on the caster alone (scope 4) now use
  Self over the CSV label: Inner Destruction, Adrenaline Rush, Feeling Lucky, Magnification, Treasonous Mind (Self = 60).
- Menu dropdown reordered: Artifacts · Nether Stones · Spell Gems · Cards, then Builds · Synergy · RI/Runes (· Macros).
- [ ] **Open (user call):** the remaining 13 of the 18 spells where CSV and code DISAGREE keep the CSV value — mostly CSV "Enemies" vs code
  "All Creatures" for spells that hit enemies and also affect your side (True Light, Holy Nova, Radiant Sunfire,
  Resplendence, Greater Dispel, Balance In All Things, Quietus), plus code-Self (Inner Destruction, Adrenaline Rush,
  Feeling Lucky, Magnification, Treasonous Mind), Stampede, Black Ice, Eagle Claws, Spicy Suds, Ritual of Summoning,
  Witchcraft. Code scope = who the cast TARGETS; the CSV often describes who the EFFECT hits.

## 2026-10-04 (cont.) — Spell Gem wizard: sort + Target/Class filters
Spell step gets an A–Z | Potency | Charges sort (Potency = Devastating→Small with tier headings, no-potency last;
Charges = most first; ties by name; A–Z is now the default — was data order) and two dropdowns, Target (Single
target / Enemies / Your creatures / All creatures / No target, from `spell.target`) and Class, both defaulting to
"-" (no filter). Dropdowns + sort share one row, also at 360px. Artifact wizard's spell list keeps its class chips
(shared `spellClsChips` helper). List is still capped at 300 rows ("Showing 300 of N" note).

## 2026-10-04 (cont.) — FIX: search text duplicated on phones ("Aft" → "AAftAftAft")
**RCA:** every search box shares `onInput`'s `searchMap` path, which re-rendered the whole overlay panel
(`panel.outerHTML = render()`) on each keystroke — replacing the focused `<input>`. Phone keyboards (Gboard etc.) type
inside an IME composition; destroying the input mid-composition made the keyboard re-insert the whole composing word on
the new element each keystroke (A + Af + Aft + commit). Desktop keystrokes don't compose → never seen there. All 18
search boxes were affected, not just the Appendix. Reproduced headless via CDP `Input.imeSetComposition`
("AAfAftAft"). **Fix:** search re-renders go through `refreshKeeping` (patches everything except the input being typed
in); if the layout can't be patched mid-composition, the full re-render waits for `compositionend`. Scroll positions
restored as before. Verified: IME typing on 13 reachable search boxes → exact text, live filtering, focus kept.

## 2026-10-04 (cont.) — Nether Stone loadout exclusivity
Rule (user, mirrors free re-socketing in-game): a stone may be socketed in any number of saved artifacts, but only ONE
artifact holding it can be equipped across the 6 active creatures — same as an artifact can only be equipped once.
- Equip wizard: an artifact whose stone is in an artifact equipped on ANOTHER creature is disabled (red tint, "Can't
  equip", click guard). The artifact on the slot being equipped never counts (it's about to be replaced).
- Artifact builder: when the artifact is (or will be, on save) in the loadout, stones in use on another creature are
  locked in the Nether picker (+ guard); from Menu → Artifacts (not equipped) they stay selectable, tagged "in use".
- Helpers `netherUsers(nid, exceptArtId, exceptSlot)` / `artNetherClash(a, exceptSlot)` / `artTargetSlot`. Saved builds
  that already break the rule load as-is (red notes on the artifact page + creature detail); nothing auto-removed.

## 2026-10-04 (cont.) — UI hygiene batch
1. Artifact wizard **Spell** list: class chips (5, toggle), ＋ Filter (spell taxonomy), A–Z | Class sort (Class sort
   adds per-class section labels), "showing N of M" note past the 300 cap.
2. Artifact wizard **Nether** list: Has trait / Has spell / Hide in use filters; Recent | A–Z | per-stat sort (row shows
   that stat's %); each row has a one-line summary (core %, other properties, trait + spell names) that search
   also matches; stones already socketed in another equipped artifact are red-tinted + "in use".
3. **Relic** button with a relic equipped → opens that relic's page first (‹ Relics backs out to the list); the page
   has Unequip. New relic picks default to **rank 100** (the relic's max), not 50.
4. **Artifact** button with an artifact equipped → full-screen artifact page (detail overlay: big icon, primary +
   rank + holder, Bonuses | Sockets, Edit / Unequip); ‹ Artifacts backs out to the library list (selection kept).
5. Creature detail: new **Artifact — Rank N** section (name row, spell gems, stat bonus table; traits stay in Traits).
6. Artifact selector: an artifact whose Nether Stone is already socketed in ANOTHER artifact equipped in the loadout
   gets a low-alpha **red tint** (`.nether-clash`, still selectable) + tooltip and a red note in its info panel/page.
7. Home: class/race emblems moved LEFT of the sprite (List view); new **artifact + relic badges** (same size) where
   the emblems were (right of the sprite; grid view: stacked under the ✕). Badges are clickable → items 3/4.
- Relic mechanics research (question, no app change) — see the session summary: relics act as pseudo-creature 967
  (`scr_RelicBattleCreate`), base 50 HP / 30 other stats, scaled ceil(base·(1+0.3·(L−1))) by the BEARER's level;
  relic rank only gates perks and the bearer's 0.1%/rank stat bonus (`scr_RelicStatBonus`).

## 2026-10-04 — Effect engine (invisible backend refactor; no UI change)
New `effects.js` (`SU_EFFECTS`, see **EFFECT_ENGINE.md**) centralises every source-driven computation that was
scattered through app.js: artifact/nether/relic stat contributions (3 duplicate aggregators → 1 contribution list +
2 folds), the 6 hard-coded perk checks (Royalty/Highborn/Introversion/Army of Gods/Total Deprivation ×3 uses),
build-time spell-slot grants, and the runtime spell-gem class regexes. All are now declarative rules in
`D.effects.rules` (29: 21 generated from descriptions + 8 hand-authored in `data/reference/effect_rules.json`),
validated by build-data. **Behaviour preserved:** 195 UI surfaces × 14 fixture builds identical before/after
(mutation check: a broken engine shows 55 diffs). **New case:** Animator's Molecular Betrayal (`stat.share`,
code-grounded in `bc_StartupStatGain`) — computed by `FX.battleStart()`, tested in `tools/effects_test.mjs`
(24/24), not surfaced in the UI yet. Preserved quirks worth a ground-truth check are listed in EFFECT_ENGINE.md.

## 2026-10-04 — taxonomy S9 (layer 11) shipped
- New confirm-only layer from _su_extract S9: attack/cast repeat-counter and defense-reduction accumulators, nested-trait gates (Master of X / Transformation Mastery etc.), true-branch-only reach. +150 S9 confirms, 0 lost, 0 new proposals.
- Provenance now code 87.7% · llm 6.5% · implied 2.0%. Pending review: the 24 Related Spells::Multi-Target Spells spell proposals only.

## 2026-10-04 — taxonomy review S7 (A–E) applied
- **A:** dropped Action/Mechanic::Attack from 17 traits + Sparktail card (no attack reference; Damage kept).
- **B (corrected):** Action/Mechanic is a SUPERSET of the narrower groupings — overlap required. The implied pass now carries every parent by extension (Related Stat/Amount of X Stat→Stats, Buff/Debuff/Minion counts & Active If→Buff/Debuff/Minion, Affect on Damage/Creature is Damaged/Deals Damage→Damage, Related Types→Creature Race/Class, Turns Taken→Turn Counter, Artifact Trait→Artifact, …). Exact child→`implied`; non-exact child→parent inherits its src. Build: +226 implied, +92 by extension, 192 llm→implied. Stat-reading perks keep Stats.
- **C:** Angel/Carnage/Carver/Centaur cards Creature Race → Creature Class.
- **D:** Blazing Soul Ally is Debuffed → Enemy is Debuffed (also the "enemy has a debuff" gate).
- **E:** Minions ≠ Buffs: Uncharted → Minion Count / Minion / Related Minion::Dire Wolves; bidirectional sweep found no other bleed. Rules in TAXONOMY.md §Boundary rulings + approval policy.

## 2026-10-02 … 2026-10-04 — taxonomy code-grounding passes (#5; moved from the backlog 2026-10-08)
- [ ] #5 taxonomy → fully code-backed (workshop multi-parameter conditions first, e.g. side × event: "opposing-side buff gain").
  - **2026-10-02 decode DONE** (no app change yet). Per-trait code signatures (WHEN / BY / TO / DOES / WITH / IF /
    SCALES BY) are in _su_extract `data/model/trait_signatures.json` (`code/TRAIT_SIGNATURES.md`) for 2,005 traits.
    - **Validation vs descriptions:** BY 99.1%, TO 90%, WITH 87%.
    - **Vs the app's Activates tags:** 84.6% agree. The disagreements include real LLM errors, e.g. "after your
      creatures are attacked" should be Enemy Attacks; "after this creature kills" should be Enemy Dies.
    - **Next:** map signatures → the existing Category/Value system (code-certain values replace llm tags; keep llm
      where code is silent, flagged).
  - **2026-10-03 phase 1 SHIPPED (provenance only).** `build_code_taxo.py` → `code_taxo.json`, applied in build-data after
    the audit overrides.
    - **Code-confirmed:** 1,372 trait tags now carry src `code`: Activates When 655/860, Activates at 417/488, Related
      Buff/Debuff 287 (token tags the code agrees with).
    - **Held for review:** 24 corrections/additions (description + code agree; e.g. "after your creatures are attacked"
      Ally Takes Damage → Enemy Attacks, "after this creature kills" Ally Attacks → Enemy Dies). They apply only for
      runtime ids listed in `data/reference/code_taxo_approved.json`.
    - **APPROVED + SHIPPED 2026-10-03:** all 24 (user). 22 replaced (14 Ally Takes Damage → Enemy Attacks, 8 Ally Attacks →
      Enemy Dies) + 2 added (Rapid Digestion Enemy Dies, Superfluidity Ally Casts).
  - **2026-10-03 phase 2 SHIPPED (confirms).** Side-sensitive Affect-on-* categories, Related Stat/Minion, Active If
    and more event mappings (`_su_extract code/CODE_TAXO.md`).
    - **Coverage:** trait tag provenance is now code 29% · token 29% · llm 35% (was 56% llm).
    - **No deal/take-damage side errors found:** the code agreed with every Deal/Take tag it could check.
    - **15 proposals pending review**, incl. 2 ally/enemy side errors (Hangover Cure, Doom and Gloom).
    - **Durable approvals.** Approvals are stored as explicit changes in `code_taxo_approved.json` (`changes`: per
      runtime id {replace:[{from,to}], add:[]}). They are applied before the confirm pass, so a regenerated
      code_taxo.json can't undo them. Bug fixed: phase 2 computed proposals against already-corrected app data, which
      silently reverted the 24 approved fixes.
    - **Review round 2 (2026-10-03):**
      - **APPROVED (7):** side fixes Hangover Cure → Enemy is Healed, Doom and Gloom → Ally is Debuffed; Shadow Hook Deal Less
        Damage; Best Kind of Weather + Solar Flare Deal More Damage; Boundless Creativity Stat is Decreased; Cornered Enemy
        Indirectly Damaged.
      - **REJECTED:** boss-part attacks as Automatic/Extra Attack. A `bc_ArtificialIntelligence` action is the part's normal
        turn action, and Action/Mechanic::Attack is enough. The builder now skips AI-turn Attack/Cast/Defend/Provoke for the
        Automatic/Extra values (rule recorded in `code_taxo_approved.json` `rejected`).
      - **Second circular bug fixed:** the builder skipped confirming tags already marked `code` in app data, so every
        rebuild lost them. Confirms are now unconditional and stable across rebuilds (≈3,044).
  - **2026-10-03 PERKS SHIPPED (confirms).** `_su_extract` `perk_signatures.json` decodes 1,223 `scr_PerkLevel` sites
    (side vs description 98.5%, per-rank values 97%).
    - **Pipeline:** `build_code_taxo.py` emits `perks` keyed "<specId>:<perkKey>"; build-data applies the confirms, and
      approved changes come from `code_taxo_approved.json` `perkChanges`.
    - **Coverage:** 644 perk tags code-confirmed; perk provenance is now llm 71% (was 92%) · code 24%.
    - **Pending review:** 9 proposals, plus the Pusillanimity drop-only call and 10 Related Minion vocabulary candidates.
    - **Review round 3 (2026-10-03):**
      - **APPROVED:** Overload + Ally Casts; Voodoo + Enemy Casts; Judgment Day + Take Less Damage; Hedge Magic / Maledict
        + Take More Damage; Immaculate Recovery + Related Buff Invisible/Shelled + Ally Takes Damage.
      - **Changed:** Massacre gets **More Powerful Buff** (user), not "Creature is Damaged".
      - **REJECTED:** Overrun Related Stat::Maximum Health (healing is not a Max Health effect).
      - **Pusillanimity KEEPS** Enemy Defends / Dodges. Policy: conditional events tied to a trigger are valid Activates
        When tags (`code_taxo_approved.json` `policy`).
      - **Related Minion +10 values** (Unstable Horror, Doppelganger, Amalgamation, the 7 sin demons), token-grounded
        across all entity kinds (+23 tags).
      - **Display rule (user):** build the FULL taxonomy and map everything that fits. "More than one object" is a display
        toggle, not a build filter. Single-use values are hidden in ＋Filter / Appendix / perk pickers until **Show
        single-use tags** is on (per-viewer, localStorage). Facet pickers now take `idxFn` so the toggle applies live.
      - **Demon sets (user):** collapsed like Four Horsemen into **Greater Demons** (7 sin demons) and **Lesser Demons** (Brim
        Fiends, Fire Imps, Chaos Satyrs), using the game's own classification. The tag also comes from the exact phrase, so
        Demonologist perks referencing the set are tagged (Greater 12 objects, Lesser 6).
  - **2026-10-03 Action/Mechanic implied from exact tags** (new src `implied`; inputs = code/token/field/audit only).
    885 existing LLM Action tags are now backed (+33 added); LLM Action tags fell 3,915 → 3,047, the rest mostly spells
    (1,448). Spell decode research is running.
  - **Provenance chips hidden (user, 2026-10-03):** the per-tag source chip (code/token/implied/llm…) in the taxonomy detail
    is behind `FEATURES.taxoSource` (app.js, default false). The data keeps `taxoSrc`; flip one flag to surface it.
  - **2026-10-03 mechanics + relics:** helper calls/vars inside each gate block (inv_Artifact*, scr_Relic*,
    bc_GetAdjacentCreatures, race/class counters, battleturns, spell-gem fields) now ground Action/Mechanic values.
    - **Relics decoded** via `scr_CritHasRelicPerk(creature, relic, k)` gates (rank = 10·k): 295/310 rank perks;
      validation trigger 95%, side 100%, conditions 93%.
    - **Applied in build-data:** relic confirms (326) with `relicChanges` approvals. Trait confirms 3,347, perks 695.
    - **APPROVED 2026-10-03:** all 7 — Action/Mechanic Relic (Total Deprivation, Last of the Ancients, Divine Dualwield),
      Spell Gems (Heresy), Turn Counter (Uncontrollable Anger; relic Fatum & Fortuna), Creature Race (Gone But Not Forgotten).
  - **2026-10-03 spells + cards SHIPPED (confirms).**
    - **Spells:** 3,112 tags code-confirmed (per-spell blocks in bc_CreatureCast).
    - **Cards:** realm card powers decoded via `inv_CardSetPowerUnlocked(family, power)` (423/465 slots; validation event
      93.5%, side 96%); 78 card tags confirmed.
    - **APPROVED 2026-10-03 (all 40):** 17 Minion Spells, 10 Damaging Spells, 6 Active If, 2 Gain a Trait, Arcane Fallacy
      Single-Target, Eaten Alive Healing (user: keep as healing), and cards Paragon / Effigy / Spelljuggler. The user
      confirmed Abomination's power order (15% more dmg → 10% less dodge → 35% less healing) = app + code. The flagged
      Animation order also user-confirmed (recover 50% more Health → take 10% more dmg → take 20% more dmg) = app. The
      code hooks (damage / damage / heal handler) fit Inverted's damage↔healing flip: NOT swapped; anomaly closed.
  - **2026-10-03 "work through everything" pass (confirms SHIPPED):**
    - **New decodes:** census fixes (6 unscanned hosts + 107 wrong trait ids) → 82/161 hidden traits decoded; 58/64
      state-editing spells decoded; effect magnitudes / direction / scaling (`effect_magnitudes.json`); card power
      targets; perk host-mechanics.
    - **Overall provenance:** code 42% · llm 31% (was 56% llm this morning). LLM share by entity: traits 29% · perks 50% ·
      spells 22% · relics 36% · cards 54%.
    - **APPROVED + SHIPPED:** all 16 (4 Multiplied by, 4 card Active If, 8 card stat/potency tags).
  - **2026-10-03 final decode pass** (D: loop counts / damage-type / race-class compares / intercept; E: card rehost +
    Memento / Thoughts and Prayers / Time Stop):
    - **Results:** all "irreducible" gaps proved decodable. Cards 451/465 powers (Construct = dead text). Provenance now
      code 44% · llm 31%.
    - **APPROVED:** all 13. Time Stop keeps Action/Mechanic::Timeline but drops Affect on Timeline::Additional Turn (user).
  - **2026-10-03 pass 3 (F: "would" events typed via the bc_ExecuteEvents action-string switch, pure-condition effects,
    expanded mechanics; G: 12 hidden traits recovered via static-RValue ids, Construct confirmed unimplemented in code;
    loop-membership ruling):**
    - **Provenance:** code 58% · llm 28%. Per-entity LLM: traits 26% · perks 47% · spells 19% · relics 36% · cards 49%.
    - **APPROVED:** all 4 (Golden Aura Gain a Trait, Duality Extra Attack, Diabolic Celebration + Sorcery Orb Creature
      Class — user: the creature's class derives the spell class).
    - **USER RULING:** damage MODIFIERS ground Action/Mechanic Cast/Attack (general mechanic categories), applied in
      build_code_taxo → +119 confirms.
  - **2026-10-03 Task H (residual audit, confirm-only):**
    - **New evidence layer:** dtype (0/1/−1) → Attack / Cast / Indirect Damage; handler-based values; Modify direction;
      fields written; Active If from race/class/all-same/defend-provoke.
    - **Also:** count-hook loop membership (+165 Multiplied by), and spell record field 4 = the game's own spell
      category (Arsenal / Booze / Ultimate exact).
    - **REVIEW list:** (A) ~51 spells tagged Action/Mechanic::Stats where the stat only SCALES; (B) kill-trigger traits
      tagged Action/Mechanic::Attack.
  - **2026-10-03 Task I:** the evidence was already decoded but being discarded. Spell-class compares, health/status
    compares (Health is X%, Alive/Dead, Undamaged Turn, Stat Unmodified, Not Their Turn, Has taken X Action Once), crit and
    dodge gates, "casts N more" (`casts +=` past the block), deal/take direction with a conflict veto, and stat/amount
    scaling. Relics + cards now get the evidence layers. Action/Mechanic::Stats needs MANIPULATION (not a read).
    - **Katarina's Asylum:** resolved, the code agrees with "35% more".
    - **REVIEW (C):** 13 traits tagged Stats where the stat only scales damage.
  - **2026-10-03 Task J:** stack-slot flags (crit flag in bc_EventDamage, dodge flag in bc_CreatureAttack); stat
    redistribution via the game's own battle-message keys (L_B_PREVENTED / L_B_STAT_GAIN_STOLEN / L_B_TURN_SKIPPED /
    L_B_CAST_FIZZLED…); spell raw-evidence layer (+153). The 7 runtime-id traits have NO effect code in static (Seethe
    = renamed twin of Tellur's Fangs).
  - **2026-10-03 Task K:** card + relic raw evidence; spell calc-block formulas; loop-header resolution
    (`loop_resolution.json`); a text-supplies-side layer. Every residual tag is classified in `_su_extract`
    `taxo_residual.json` as (a) decodable-not-done / (b) REVIEW / (c) no static code.
    - **REVIEW totals:** Stats-only-scales 86, Attack on kill triggers 4, Multiplied by on threshold text 4, triggers on
      passive "activate N more times" 5, Vision Quest Illusion → Doppelganger 1.
  - **2026-10-03 Task L** (residual "decodable" bucket): detokenised descriptions; condition-type matching; new code
    semantics (redid = another turn, turnspeed at setup = starting placement, passive/passive2 = innate/fused trait, …).
    - **Result:** residual decodable 3,451 → 2,812.
    - **New REVIEW:** B8 Automatic/Extra on AI-turn boss parts (16), B9 Creeping Doom Race → Class (1), B10 Harbingers
      Timeline → turns-taken (9).
  - **2026-10-03 Task M:** potency stat decoded from bc_SpellDamage's prologue stat locals (24/27 match);
    spell-case membership; scr_SpellHasTag tests; damage perspective; event-side mapping.
    - **Result:** residual decodable 2,812 → 2,608.
    - **New REVIEW:** B11 Mindful Awareness Ally Takes Damage → Enemy Attacks (Thorns precedent).
  - **REVIEW ROUND (user, 2026-10-03):**
    - **Fixed (27 tags):** Turn Counter for the turns-taken traits (Harbingers, Master of Apocalypses, Vengeful Rebound,
      relic Mutatias; was Timeline); Mindful Awareness → Enemy Attacks; Creeping Doom → Creature Class; Vision Quest →
      Doppelganger; False God parts lose Automatic/Extra (keep Action/Mechanic Attack/Cast).
    - **Drop recommendations REJECTED** (99 tags kept: B1/B2/B3/B4) → `code_taxo_approved.json` `reviewKeep`.
  - **2026-10-04 Task N:** each object's own battle-message name string anchors effect code past the decoded block;
    callee summaries; host + text rules; CONDNAME tokens.
    - **Result:** residual decodable 2,608 → 2,232. Kept tags are now class "k" (never re-flagged), and the Turn Counter
      ruling is built in.
  - **2026-10-04 Task O:** code-fact rules from gates + 2-level callees (DoT → Indirect Damage, heal → Healing, count
    scaling…), host + text rules, event side, counters.
    - **Result:** residual decodable 2,232 → 2,116; returns are diminishing (~120 per round).
  - **2026-10-04 Task P + DAMAGE RULING:**
    - **New value:** Action/Mechanic::**Damage** = damage where the code doesn't make attack vs spell explicit.
    - **Applied (pre-approved):** 18 Attack+Cast → Damage replacements (Touch of Darkness, Cold Snap, Deterioration…;
      relics keep their code-explicit Attack) + 474 Damage adds, from `damage_ruling_*` in code_taxo.json.
    - **Also:** Ghidra gate-body decompiles of 16 functions (+196 confirms); Total Deprivation + Creature Race;
      a LOOSE-tag diagnostic (334, in `_su_extract` `taxo_loose.json`).
  - **2026-10-04 DAMAGE DEFINITIONS (user) + Task Q:**
    - **Definitions:**
      - **Action/Mechanic::Damage** = deals damage, is triggered by damage, or modifies damage (any source; Attack/Cast
        added when explicit).
      - **NEW Activates When::Ally/Enemy Deals Damage** = triggered by damage (replaces Attacks/Casts stand-ins).
      - **Affect on Life::Creature is Damaged** = deals damage.
    - **Applied from pre-approved ledgers** (`damage_ruling_adds` incl. spell damage → Damage + Damaging Spells,
      `deals_damage_ruling`, `creature_damaged_adds`): Damage on 730 traits, 194 perks, 338 spells, 29 relics, 80 cards;
      14 trigger swaps + 8 adds; Creature is Damaged +131. Plus 9 perk Deals Damage triggers from explicit text (Touch of
      Darkness, Unity, Gravity's Void, the Retribution perks).
    - **Task Q:** region-split Ghidra decompiles (SuDecRange.java): bc_EventDamage, StartOfTurn, CreatureCast,
      CreatureAttack, OnDeath and StartupTraits fully decompiled (gates with evidence 408 → 2,057). ExecuteEvents was
      partial (low-memory kill); StartupGems / SpellDamage / BuffsDebuffs / EndOfTurn / StatGain not yet reached.
    - **Provenance:** code 84% · llm 10%.
  - **2026-10-04 Task R:** all 12 battle functions region-decompiled (ExecuteEvents, StartupGems, SpellDamage,
    StartupBuffsDebuffs, EndOfTurn, StatGain finished; 4G heap, one JVM per function); gates with evidence 2,057 → 2,570.
    A ruling guard stops re-proposing tags a pre-approved ruling replaced.
    - **Residual (a) basically flat:** what's left is shared generic handlers, out-of-block scaling, callee status,
      spell-calc / gem fields, and the long tail.
  - **2026-10-04 S1 + S2 (user: keep grinding; in-app compute coming):**
    - **S1:** more region decompiles (OnAttack, crit_* getters, stat gain/lose, OnCast, EventHeal, battle step); gates
      with evidence 2,570 → 4,085; residual decodable 2,054 → 1,858.
    - **New REVIEW B13:** Zantai traits tagged Gain a Trait, but they gain a spell gem.
    - **S2:** `_su_extract` `effect_formulas.json` + EFFECT_FORMULAS.md — per-object machine-evaluable effect records +
      the global damage pipeline (spell tiers 0.9 / 1.1 / 1.2 / 1.3 / 1.5 potency with 0–40% defense pen; class ×2 / ×0.5;
      defending ×0.65 + Def ×1.5). Validation 90–94% vs description numbers. Flagged: Transformation Mastery signature
      is wrong.
  - **2026-10-04 S3 + S4:**
    - **S3 (formulas):** amounts bound to their triggers 21 → 356; spell amounts 558/559; perk chances moved to the
      chance field. Flagged tier_conflicts vs description (Rune of Cor/Nax 0.6 vs "moderate", Smoke Bolt, Living
      Helmet, Balance In All Things).
    - **S4:** `sig_foreign.py` stops "amplifier" traits (Transformation Mastery, Master of X…) from inheriting the
      effects they amplify (new `amplifies` field; 12 bogus Damage / Creature is Damaged ledger entries purged).
      Perk damage gates that read the source now decode as Deals Damage (27 perks; Hedge Magic looks off).
      Constant-arg layer for spell ids/tags/classes + condition ids (residual spell class/tag 74 → 41, condition id
      82 → 40).
    - **APPROVED 2026-10-04:**
      - Zantai traits ×10: Gain a Trait → Extra/Gain a Spell Gem (erroneous; they gain a spell gem).
      - Hellion + Deal More Damage.
      - Transformation Mastery drops Damage, via the new `damageRulingExclude` list in code_taxo_approved.json, which
        build-data honours when applying the pre-approved ledgers.
  - **2026-10-04 S5 + S6:**
    - **S5:** layer-9 region facts; battle-controller Step is a 13-stage switch (stage 2 tail = once-per-battle start of
      battle → clock grounding); Ethereal/Booze grounded. Residual decodable 1,907 → 1,669.
      REVIEW: Uncharted Multiplied by Buff Count → Minion Count (Direwolf stacks).
    - **S6:** def-use formula binding (unattached trait numbers 364 → 57; 31 per-count factors); amplifier traits as
      amplify_innate records; Rune spells' branches settled from code. Upstream limit: only 324 / 1,147 trait
      description % numbers are extracted from code (many are runtime variables).
  - **2026-10-04 S7:** handler-branch finder (attack/spell/indirect inside the damage handler), pre-gate lookback,
    more field evidence; +208 confirms; residual decodable 1,543 → 1,415. Provenance code 88% · llm 7%.
    - **REVIEW:** 18 Attack on generic damage modifiers (have Damage), 8 Stats→Related Stat (reads only), 4 cards
      Race→Class, Blazing Soul side, Uncharted Buff→Minion Count.
    - **Proposals:** 24 Multi-Target Spells adds.
    - **Spells decoded too** (per-spell switch in bc_CreatureCast; 82% agreement with app spell tags); taxonomy
      integration is next.

## 2026-10-01 (night 4 → session close) — "runtime-only" systems cracked from static code + UI polish
**Session summary.** Every system below was previously logged as runtime-only / not reproducible / heuristic.
Each is now read from static code and validated against in-game ground truth. The lesson: a "runtime-built .bss"
table is lazily filled by a static function, so trace the writer.

| System | Was | Now (code + validation) | Item |
|---|---|---|---|
| Nether Stone generation | "numeric layer runtime-only" | `inv_NetherStoneCreate`: ≤6 props / 3 traits / 3 spells, tier ≥10 value formulas; reproduces in-game "Glowing Prism (61)" | 6 |
| Fusion colour | "not reproducible from static data" (2026-09-20 below) | `scr_GetFusionSurface` palette sort + swap; pixel-exact on 2 in-game captures incl. 1,551 semi-transparent px | 7 |
| Nether Stone colour | user-picked 2-colour tint | 16 pre-coloured `icons` frames (2085–2100), no colour data; 31/31 in-game stones pixel-exact | 8 |
| Skin owners | sprite-name heuristic, 48 unresolved, ids shifted +1 | `scr_DatabaseSkins` restriction field (race name / creature id) + apply handler; all 834 | 12 |
| Wardrobe groups | sprite-prefix guess | code spec tiers / "Master of" / god roster; rest = Misc | 4 |

Also this session: relic equip-once guardrail, Builds icon-picker regroup, List as default view naming, Nether builder
guardrails, Fusion Colour wizard step, touch-drag slider fix, content-hash image cache-busting, List-view emblem
layout, Builds preview showing saved sprites. Backlog updated: closed items ticked, new extract follow-ups added.

1. "Show Traits" facet → footer two-part toggle **List | Grid** (same `.seg`/`.seg-btn` styling as the home Layout toggle),
   left of Cancel/Next; both creature and fusion steps.
2. List view: each trait card now leads with a header — creature name · race emblem + race · class emblem + class, a
   divider, then base stats on one row (Health/Attack/Defense/Intelligence/Speed — Total dropped so it fits). Race/class
   tags right-aligned; the List|Grid toggle sits at the footer's left edge. List is the picker's default view, and the home
   Layout toggle's "Roster" is now labelled "List" (internal value unchanged) so both read List | Grid.
3. Builds: **Update** is disabled (with a tooltip) when the current loadout has no creatures, so a saved build can't be
   overwritten back to the template state (handler guarded too).
4. Builds icon picker: groups are now code-grounded (_su_extract `code/classify_wardrobe.py`). There are 4 groups, and every
   one of the 820 skins is in exactly one:
   - **Specialization** (129): exactly the code spec tiers. 20 untiered "Alternate"/Mime/Engineer outfits moved out;
     Defiler/Tribalist T2/T3 moved in.
   - **Master** (155): code name starts "Master of …".
   - **God** (31): the gods' overworld forms — code God-shop roster (30) or a god sprite asset (adds Caliban).
   - **Misc** (505): catch-all for everything not code-backed.
5. Relic picker: a relic already equipped by another creature in the party is greyed out (low alpha, full grayscale)
   and unselectable, with an "Equipped by <creature>" tooltip.
6. **Nether Stone builder guardrails — code-grounded** (`inv_NetherStoneCreate` / `inv_NetherStoneGetStat`, via _su_extract `data/model/nether_generation.json` → `D.netherGen`; build-data asserts all
   62 code pool stats map 1:1 to the app's artifact property names).
   - **Limits:** ≤6 stat+trick properties (shared budget), ≤3 traits, ≤3 spells. The category chips show "n/max"
     and disable when full, and the Add tile hides once every category is full.
   - **No duplicates:** properties, traits and spells already on the stone are hidden from the pickers.
   - **Value range per property:** the minimum is the tier-10 value (e.g. Health 19, dual stats 12, on-damage 5,
     Attack Damage 23); element strengths are capped at 80. New properties default to the minimum, and values are
     clamped on commit. Spell Gem Slots shows no "%".
   - **Older stones that break the rules** (e.g. old default value 10) show a ⚠ list of issues, and **Save is
     disabled** until they are fixed. Nothing is auto-deleted.
7. **Fusion colour — CODE-EXACT** (_su_extract `code/fusion_palette.py` / `FUSION_MODEL.md`, `scr_GetFusionSurface`).
   - **Wizard:** the creature wizard's final step for a fusion is **Fusion Colour**: the game's 6 options in its 2×3
     layout (TL value · TR saturation / ML pixel-count · MR hue / BL full-secondary · BR untinted). Customize →
     "Next ›" when fused; "Commit fusion" saves `slot.fuseColor` (0–4, 5 = untinted; default untinted).
   - **Rendering:** fused slots render recoloured on home (roster + grid), creature detail, the macro face and the
     wizard preview. Recolouring happens in the browser on a canvas from the shipped PNG, and the result is cached.
   - **Data:** `fusion.json` (1.13 MB, lazily fetched, `?v=` content hash via `D.fusionFile`). It holds the per-frame
     colour list plus 4 code sort orders and the mode-4 palette for every creature and skin frame (2,138), keyed by
     code frame (pre byte-twin canonicalisation).
   - **Verified:** Exiled Satyr ⚭ Ashskin Spellmane — browser output equals the Python engine pixel-for-pixel on all
     5 modes, and that engine matches the in-game capture on all 6 cells.
   - **Semi-transparent pixels resolved** from an in-game Sparktail Student ⚭ Uralos Spellslinger capture (1,551 partial
     px). Modes 0–3 never recolour them. Mode 4 matches their **premultiplied** colour (rgb·a) and writes the nearest
     palette colour **fully opaque**. Every pixel of all 5 cells is exact (_su_extract
     `code/validate_fusion_partial_alpha.py`), and the browser output matches the engine pixel-for-pixel.
   - The colour step shows only the 2×3 grid (no info panel).
8. **Nether Stone icons — CODE-EXACT** (_su_extract `code/NETHER_COLOR_MODEL.md`). The game stores no stone colour.
   - **Source:** `inv_NetherStoneCreate` rolls `icon = irandom_range(2085, 2100)`, one of 16 PRE-COLOURED `icons`
     frames (two-tone/gradient borders are painted in). No shader is involved.
   - **Validation:** all 31 stones in two in-game captures are pixel-exact.
   - **Builder:** "Shape" + "Colour" are replaced by one **Icon** picker of the 16 game icons, in game order.
     `assets/gems/nether_<n>.png` now holds the coloured frames (keys unchanged, so saved stones keep their shape).
   - **Removed:** the Main/Outline colour picker, presets (`data/nether_colors.json`), the recolour engine and its
     CSS. Stored `mainColor`/`outlineColor` are dropped on load.
9. **Asset cache-busting by content hash.** The SW asset cache is cache-first by URL, so an image whose content changed
   under the same filename stayed stale for returning visitors.
   - **Data URLs:** build-data rewrites every `assets/…` image URL in `data.js` to `…?v=<md5[:8] of the file>`
     (~9.6k URLs).
   - **Precache list:** `precache-list.json` lists the same versioned URLs; its version = hash of the URL list, so
     any content change triggers a re-precache.
   - **Service worker:** after precaching, it deletes superseded `?v=` entries. Unversioned ones (index.html icons)
     are kept.
   - **Saved build icons** (stored paths) resolve to the current versioned wardrobe image.
10. **Touch-drag fix for the Relic and Artifact rank sliders.**
    - **Cause:** their `input` handlers re-rendered the whole panel (`outerHTML`) on every step, replacing the slider
      mid-drag. Touch/pointer drags died after one step (repro: full-width touch drag stopped at relic 20 / artifact
      3). The realm favor slider already updated in place, which is why it felt smooth.
    - **Fix:** new `refreshKeeping(root, html, keepEl, fallback)` patches every node from the fresh render except the
      slider being dragged, falling back to a full refresh if the structure changed. Both sliders now reach max on a
      simulated touch drag with the same DOM node throughout.
11. Home List view: the class and race emblems now sit to the RIGHT of the creature sprite, stacked class over race
    (sprite stays centred; same on phones). They were previously top-left of the identity column.
12. **Skins — CODE-GROUNDED owners** (_su_extract `code/extract_skin_owners.py` / `SKIN_OWNER_MODEL.md`). In
    `scr_DatabaseSkins`, `skin[i][1]` is either a race-name string (the skin fits any creature of that race) or a
    creature id (that creature only); the skin-apply handler enforces it.
    - **Coverage:** all **834** skins ship (was 786): 662 race-restricted, 172 creature-locked.
    - **Fixes:** 48 previously unresolved skins resolved, 36 wrong races, Summer 4080 → 4080, and Iron Rich →
      Dumpling race. Correct names come from code tags (old: 65 null, 17 wrong, e.g. Scylla/Charybdis swapped).
    - **Exclusions dropped:** the 37 "boss" skins (Xyrxzys, Etta, Shadow Monarch…) are real race skins in code, so
      `skin_exclusions.json` is no longer used.
    - **Join:** creature-locked joins are case-insensitive by name (roster "Grom'met" vs code "Grom'Met").
    - **Saved ids:** the old skin ids were shifted (+1). `D.skinIdMigration` remaps the current build and every saved
      build once (`skinIds: 2`), then drops any skin the code restriction no longer allows.
13. **Builds party preview** renders each saved slot as the main screen does (`slotFace`: equipped skin + fusion
    colour option), not the plain base sprite.

## 2026-10-01 (night 3) — Asset mappings converged on code + level-aware artifact icons
Replaced hand-curated / heuristic asset tables with game-code maps (`_su_extract` asset_maps.json; DB_ID_FINDINGS.md):
conditions (`scr_GetConditionIcon`; Repelling/Warded/Mania corrected, Protect/Savage now code ids 0/1), relics (code relic
→ overworld sprite, unchanged art; `iconBig` added), spec emblems (`scr_SpecializationIcon`, identical), god battle
sprites (`scr_GodBattleSprite` by god index, identical), trait-item icons (material DB record sprite; Volatile Stitches
corrected), creature battle frames (code record; manual overrides retired — 4 visible changes: Centaur Khan, Deep
Clutcher, Marionette Hypnotist, Nihilist Paralyzer). Nether boss frames stay human-validated (code table not resolvable).
**Artifact icons follow level** like the game (`inv_ArtifactIcon`): 6 tiers per type (`assets/arttypes/<type>_<1-6>.png`),
`D.artTierMinLevel` = [1,10,20,30,40,50]; library tiles, detail header, builder type tiles + primary slot all use the
artifact's rank (builder updates live with the slider).

## 2026-10-01 (night 2) — Spell-gem property icons + gods from code
The 21 property gems (dust items) now use the `icons`-sheet frames `inv_ItemIconIndex`'s dust table assigns (2144-2164,
Agate..Tourmaline; `_su_extract` item_icons.json dust_by_key) instead of the hand-cropped screenshots (some had
neighbour-row bleed: Beryl, Jade, Onyx). Gem→god now comes from the code god-shop dust items (20 direct + Agate↔Regalis
by asserted elimination; identical to God Shop_REF). No fallback icon — a gem without a code frame fails the build.

## 2026-10-01 (night) — Shop currencies from code
Each shop item now carries the currency it is bought with, decoded from `scr_ShopFill(…, MODE, CURRENCY)` + the
`obj_shop` currency switches (`_su_extract/code/extract_shop_currency.py`): **God = Emblem of <God>** (was mislabeled
"Favor"), Guilds = Brimstone/Granite/Power/Crystal/Essence (replaces hand-written GUILD_CURRENCY), **Arena = Glory**,
**Tavern = Notoriety**. **Currency icons (code):** the `icons`-sheet frame `inv_ItemIconIndex` returns for each currency
item (`_su_extract/code/extract_item_icons.py`) → `assets/shopicons/cur_<frame>.png`; prices show "10 [icon]" (name on hover),
headers show icon + name. Build errors if any shop lacks a currency or currency icon.

## 2026-10-01 (eve) — Unified Shops overlay (code-grounded)
- **One "Shops" overlay** (menu → Shops) with a 4-way **God | Guild | Arena | Tavern** toggle that rotates the grid:
  God/Guild = tile grid (30 god battle sprites / 5 guild seals) → that shop's stock; Arena/Tavern = stock directly.
  Stock grouped by type (Creature Mana, Trait Item, Inscription, Crafting Material, Project Item, Skin, Decoration,
  Background, Wall, Floor, Music, Item) as collapsible bars; rows drill into creature / spell / trait pages; search
  filters gods/guilds by any item they sell, or items within a shop. Replaces the God Shops + Guild Shops overlays
  (CSV god_shop_ref / wiki guild tables no longer shipped; `D.godShops`/`D.guildShops` removed).
- **Data fixes** (`_su_extract/code/build_shops_true.py`): Thrasher Tooth / Armored Tusk trait-items now resolve
  (register-set item_class was filtered); T'mere's `inv_CreateMisc(131)` = Gate of the Gods Key (misc-item table);
  icons from code for project items (`scr_ProjectItemSprite` → Hearts/Essences), decorations + backgrounds (sprite ref
  in their DB records). Joins 100% for every kind; walls/floors/music/chests have no art in code (blank icon).
  Regalis' dust is a runtime argument in code → named from God Shop_REF with a tooltip (only CSV-sourced item).
- All 30 realms now link to their god's shop (`realm-shop` → Shops/God/<god>), was 22.
- Prices are code literals (currency decoded later the same day — see 'night' entry). Guild rows show the wiki Reputation **Rank** chip where known.
- Open (in-game check): Azural block = Smiths/Crafters (CSV: Yetis), Tenebris = Reapers (CSV: Shadow X), dust price 1 (CSV 10).

## 2026-10-01 (late) — Wardrobe runtime ids + exact game names
`scr_WardrobeName` / `scr_WardrobeSprite` are both switches over the wardrobe id (831 cases) → joined by id
(`_su_extract/code/extract_wardrobe_ids.py` → `wardrobe_ids.json`; `wardrobe.json` enriched with `wardrobe_ids` +
code `name`). **521/820 wardrobe names corrected** (e.g. Arenaguy → Town Guard, Alien → Martian, spec costumes now
"<Spec> (Tier N)" / "(Alternate)"). Spec costume tiers now come from the game's own "<Spec> (Tier N)" names (same
sprites as before; tier 1 cross-checked vs scr_SpecializationCostume). Game quirks (in code): id 240 "Surfer" uses
the Scarecrow sprite; `ospr_chaosmage` = fallback sprite (no id); 11 wave-2 "(Tier 1)" entries exist under 2 ids.

## 2026-10-01 (pm) — 100% CSV agreement, code anointments, code costume tiers
1. Source CSVs fixed in `_su_extract/data/reference/_raw_csv` (Sovereignty, Divine Wrath, Red-eye Fight, Siegemaster
   Shrug Off; Lurid Masochist trait = Purge, duplicate Trait_REF row removed) → spec perks code vs CSV 0/0.
   Removed `PERK_NAME_ALIAS` and all Perk_REF parsing from build-data (no CSV input left for specs).
2. **Anointment flag = code** (`anointments.json`: scr_AnointmentsListBySpec = spec perk list minus hard-coded
   exclusions; Royal + all Ascension perks excluded). 605 anointable. Changes vs before: +Lingering Sickness,
   +Acclimatization, +Divine Wrath, +Battalion, +Shrug Off; −Hemostasis, −Highborn, −Divine Dualwield (ascension).
   Removed the Antiquarian hand-rule (code excludes the same two perks). New build guard: FALSE_GODS spec lists must
   equal code `scr_AnointmentsListByGod` (passes; JOTUN↔JOTUNIR key alias).
3. **Spec costume tiers from code** (`spec_costumes.json`): tier 1 = scr_SpecializationCostume, tiers 2/3 by internal
   stem. Replaced SPEC_COSTUME_OVERRIDE + heuristic; only change = **Hell Knight now animates T1→T2→T3**
   (`npc_hell_knight_2/_3`, underscore stem — the 2026-09-21 override searched `npc_hellknight_*`).

## 2026-10-01 — Code-grounded specs, perk effects, runtime ids + shops data (no UI change)
Root cause (see `_su_extract/code/DB_ID_FINDINGS.md`): every game DB (not just traits) uses explicit runtime ids that
differ from build position; the extract had keyed perks/materials/spells/creatures by position.
1. **Specializations = 100% code.** Labels from `scr_SpecializationName`, membership from `scr_PerkGetPerkList` via TRUE
   perk ids, Ascension perk from `scr_AscensionPerk`, playstyle/desc from game text. Removed `SPEC_LABEL_OVERRIDE`,
   `SPEC_EXTRA` and the CSV-driven membership. Perk_REF.csv now supplies ONLY the per-perk Anointment flag. Net data
   change vs before: Siegemaster *Shrug Off* replaces phantom `CSV_PURGE`; Antiquarian +3 perks (Primeval Spellblade,
   Epigraphy, Timeworn Attunement); Highborn / Divine Dualwield ascension from code; Royal/Pariah/Deprived = code ids
   27/37/38 with game playstyle text; Grovetender spec key = code `HERBALIST` (asset `assets/specs/herbalist*.png`).
   **Saved-build migration:** spec ids changed (31/43 were mislabeled before) → `D.specIdMigration` + `migrateSpecIds`
   in app.js remaps `specId`/`anoints[].specId`/`perkAlloc` keys once (`build.specIds = 2`; fresh builds carry it).
2. **Perk effects** re-keyed (extract only; feeds #5 taxonomy work).
3. **Runtime ids + creature names from code:** 5 shipped stat lines were the NEIGHBOUR record's (shared sprites) and now
   match Creature_REF exactly — Aaxer Apocalypse, Dumpling, Shambler Benefactor, Blood Slime, Unguided Agnostic.
   Innate traits now from code (`creature_data.aux[0]`), 0 traitId changes in the app.
   Also: `theorycraft_tags` rebuilt → the 2026-09-30 corrected code trait tags (trait `produces`/`labels`) now ship
   (973 traits changed; previously ~93% misattributed).
4. **Shops data (UI pending):** `D.shops` = code-grounded stock for God (30 gods incl. 8 DLC) / 5 Guilds / Arena /
   Tavern, every item typed + id-resolved (1819 items, 4 flagged unresolved). Existing God/Guild overlays unchanged.
Verified: headless Chrome load (no JS errors), spec labels/perks, shops present, old-build migration (14→Animator 1,
44→Royal 27, saved build 1→Defiler 9).

## 2026-09-30 — true passive ids + Misery (NYI) behind a flag
- Traits now carry `runtimeIds` (game's real passive ids; same-name parts/tiers share one shipped trait). False God `parts[]` are mapped by creature-table instance (not display name): +`runtimeIds`, `count`, `traitIds`.
  Fixes six "Arm of <God>" parts that showed "no distinct trait" (creature "Arm of X" carries trait "Hand of X").
- `FEATURES.nyi` (app.js, default false) strips `nyi:true` traits/False Gods from D before anything indexes it. First user: **Misery** (Hand/Heart/Brain of Misery, legacy #568-570), shipped in data, hidden.
- build-data.mjs reads extract tables: trait_runtime_groups, false_god_parts_true, passive_owners_true (see _su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md). Build warns on owner disagreement (known: #1521 Torun vs Treasure Golem = user override).
- Not yet done: browser smoke test of False God detail pages with the flag on/off; UI for part `count` (e.g. "Head ×5") deliberately NOT added.

## 2026-09-28 — UI pass 3 (appendix/riddle/glossary/god-shops/realms/artifact/cards/builds)
1. Appendix trait rows now stack the **creature sprite over the trait material** (apxStack order swapped).
2. **Riddle Dwarf** dropped the Class-of-spell/creature answers — only realm↔ruler lookups (it never asks class).
3. **Glossary** rebuilt with the Appendix **apx-cat collapsible headers** + large left icon column; removed the
   "tags ›" hint, per-row category badge and the "n of n" count.
4. **God Shops**: list → creature-selector **tiles** (nav on the tile); detail has a **locked centred god
   sprite header**; every item shows its real icon (creature / class-coloured spell gem / trait material /
   dust — `shopItemIconHtml` via name maps); removed the items count.
5. **Realms Compare**: `.rcmp-controls` wrapper (padded, centred toggles, tighter rows), **Customize ranks
   moved to the footer**, outcome headers use apx-cat bars, "Compare outcomes" → **"Compare"**, God-Shop link
   removed from realm detail. ⚠ **Surathli (Azure Dream) + Shallan (Fae Lands) have all Unique-Bonus columns
   blank in the exported `Favor_MTX.csv`** — a source-data gap (2/30 realms); NOT fabricated — needs the real
   values re-exported from the Player-Resource sheet.
6. **Artifact** stat-item preview shows the **material name** (e.g. "Red Amber") as the label; the stat shows
   only in the effect line (dropped the duplicate sub).
7. **Realm Cards**: white text on class-coloured tier badges (`.ct-seg.on`/`.ce-tier`); Life keeps dark text
   (`.card-tile.cls-life`).
8. **Builds**: the **selected saved-build tile animates** its costume (`data-anim-frames` on `.lib-icon`); the
   save-form preview is **static** now — the walk animation lives in the Choose-Icon picker (3rd screen).

## 2026-09-28 — SW cache fix + UI pass 2 (build creation, sorts, synergy, threats, riddle, perk filter)
- **SW deploy fix (why fresh deploys "didn't show"):** GitHub Pages serves index.html `max-age=600`; the SW's
  network-first navigation used a plain `fetch()` that revalidated against that stale HTTP-cached copy (old
  `?v=` tokens) for up to 10 min. Now `fetch(request, {cache:"reload"})` bypasses it → deploys show on next
  load once this SW installs. (Tokens WERE being bumped correctly; this was the delivery gap.)
1. **Build creation redesigned** (`renderBuilds` draft): big centred "Choose Sprite" box + name field (no
   Icon/Name labels or instructional line) + right info panel showing the sprite LARGE and animated. Generic
   `syncWardrobeAnims` (scans `[data-anim-frames]`) drives both the icon-picker selected tile and this panel.
2. **Sort bars vertically centred** — `align-items:center` on `.ovl-filterbar` (fixes creature + builds sorts).
3. **Synergy matrix**: taller rows (td/th padding 3→8px) + first column right-aligned (fixed specificity bug —
   `.xref-table th` was overriding `.xref-rowhead`; added `.xref-table th.xref-rowhead/.xref-corner`).
4. **Synergy list**: jump-chip row → Collapse-all button + quick-nav `<select>` (`syn-nav` change handler).
5. **Threats**: theme chip toggles → single dropdown (Auto-detected / explore one theme); `themeSel` state
   replaces `themeMode`/`manual`.
6. **Riddle X** styled — `.ovl-close` was only scoped to `.overlay-header`; added `.riddle-pop-head .ovl-close`.
7. **Spec Customize perk filter** → standard Category→Value opt-row drill-down (matches ＋ Filter elsewhere),
   replacing the inline chip drill.

## 2026-09-28 — UI pass (sortbar, info panels, category bars, anoint gaps, animated wardrobe)
1. Creature-selector **Sort bar** vertically centres its label + segments (`.crea-sortbar align-items:center`), still left-aligned.
2. **Info panels ~15% wider** (340→390 / tablet 260→300) and **user-resizable**: a left-edge grip on `.ovl-right`
   drags to set `--ovl-w` (300–680px, persisted `subc.ovlW`); 9px grip strip + desktop-only guard avoid accidental resize.
3. **Appendix category rows** restyled as bars that pop (`.apx-sec-head.apx-cat`: surface bg, accent-purple left rail,
   chevron, rounded) instead of the flat section-label look.
4. **Anointments**: `.fgod-group` gap 16→8px between False-God sections.
5. **Animated wardrobe sprites**: build-data now exports frame 1 for all 820 costumes (`frames:[f0,f1]`; the old numeric
   sheet count is `frameCount`). The **icon picker is select-to-preview** — tap a tile → it selects + animates its
   2-frame front walk (others stay still), "Use this icon"/tap-again commits (`syncIconAnim`, mirrors the spec-costume
   animation). +693 `<sprite>_1.png` frames shipped; precache 6364→7057.

















## 2026-09-28 — Appendix polish: bookmark button, left icon columns, item-only section
- **Bookmark filter → one footer button** ("★ N Bookmarked", toggles the all-bookmarks scope with an
  active `.btn-ghost.on` state). Removed the 5-chip row; `appendixBkCounts`/`appendixUniverse`
  creature-innate/item-only scope logic stays wired for the new section + future use.
- **Removed the sub-count n from browse category headers** (n now only on the sub-category value rows
  and the result-section headers — i.e. object counts, not sub-category counts).
- **Left icon columns**: every result row leads with `.apx-iconcol` — a vertical stack of large
  (48px `.apx-crea`) boxes, centred: traits = material icon over creature/boss sprite; perks = perk icon
  over spec emblem; spells/relics/cards = their single large icon. Replaced the old small-left-icon +
  right-side-square layout. `apxBox`/`apxIcon`/`apxStack` helpers + a simplified `line()`.
- **Creature name chip** shown next to the material-name chip on creature-innate trait rows.
- **Item-only Traits** is now its own collapsible section between Traits (creature-innate) and Boss Traits.
- Verified in headless Chrome (all 6 changes, 0 runtime errors).

## 2026-09-28 — Spell Gems: Opal class-swap, same-class equip rule, wizard/library UX
- **Click-to-deselect** (`lib-deselect` on `.ovl-center`): clicking empty space in the Spell Gem /
  Artifact library clears the selection (was: only re-clicking the same tile).
- **No empty info panels**: the Spell Gem library, the builder's spell step, and the Artifact library
  render the right-hand `.ovl-right` panel only when something is selected (center goes full-width).
- **Builder Properties step full height**: restructured to `.sgb-top` (name + property boxes, natural
  height) + `.sgb-picker`/`.sgb-pick-scroll` (flex:1) so the enchantment list fills the column instead
  of a fixed ~44vh sliver.
- **Same-class equip rule** (`spellEquipClasses`/`canEquipGemOn`/`gemAllowed`): a creature can only equip
  a gem whose **effective class** matches its own, unless (a) a trait permits cross-class — Pandora
  party-wide (`your creatures … all Spell Gems`), Purrr/Prismagic/etc. self (`this creature … any class`)
  — or (b) an allocated/anointed **Evoker Mastery** perk grants that class (`{CLASS_X} … regardless of
  class`), or (c) an Opal re-classed the gem. Wrong-class gems are greyed + un-equippable (UI + handler).
- **Opal Class Swap variants** (build-data): the single "Class Swap" dust is expanded into **5
  `Class Swap: <Class>` variants** carrying `swapClass`. New app helpers `gemSwapClass`/`gemClass`
  (effective class = swap or spell class) drive `gemIcon` (so the gem recolours to the new class) and
  the equip rule. Wizard shows only the **4 variants ≠ the spell's own class**; picking one is mutually
  exclusive. Verified in headless Chrome (chaos-spell gem → Opal→Nature recolours the icon; Chaos creature
  blocks a Nature gem but accepts Nature+Opal→Chaos; 0 runtime errors).
- ⚠ Expanding Opal shifts dust-property ids after it in `spellProps`; saved gems referencing old ids may
  remap (acceptable — no real users).

## 2026-09-28 — LLM-taxonomy audit + canon-status validation + fusion-step delta bars
User flagged two mis-tags (Mantra "gains a spell" tagged as a Buff; Extension "minions gain 1 stack"
tagged Related Minion::Random Minion) and asked for a broader audit of the LLM-assigned tags.
- **Audit finding (durable):** LLM buff/debuff/minion tags are **~99% sound**. Early "systemic" counts
  were a false alarm — (a) shell `\b`→backspace mangling broke the matcher, and (b) descriptions name
  statuses either as plain words (traits: "Burned") OR as `{CONDNAME_BUFF_/DEBUFF_/MINION_X}` markup
  (spells/perks) which a plain-word regex can't see into (the `_` blocks the word boundary). Once the
  matcher was markup-aware, only **~20 genuine errors** across 3402 entities remained, in tight buckets:
  spell-gain-read-as-buff, Random-Minion-for-count/extend, and permanent-minion-filed-under-buff/debuff.
- **Fix = deterministic canon-status validation in `build-data.mjs correctTaxo`** (joins the existing
  Innate-Trait/Animatus/Persist corrections; reproducible). Drops buff/debuff RELATIONAL assertions the
  desc doesn't ground against the canonical Buff/Debuff status list (matches plain words + `{CONDNAME_}`
  markup + a small buff-family allowlist e.g. "alcohol"); drops `Related Minion::Random Minion` without a
  summon/grant context; adds `Affect on Spells::Extra/Gain a Spell Gem` to `gain/grant [icons,N] <Spell>`
  effects. **Token-src tags (exact game markup) are never touched.** Simulated the exact drop/add set
  over the full dataset before shipping (23 entities: 19 dropped + 11 added); verified in-browser
  (Mantra/Extension correct, Zantai's Call keeps its Random Minion, 0 runtime errors). Rerun via
  `node build-data.mjs`; a future game update needs no re-mine, just refreshed taxonomy inputs.
  A full semantic re-classification of the remaining long tail (LLM pass) is a possible follow-up.
- **Fusion step magnitude bars (`renderWizardPreview`):** the stat grid regained the `value/roster-max`
  bars, now with a **diverging fusion-delta segment** — green where fusing the selected partner RAISES a
  stat, red where it LOWERS it (vs the primary alone, computed from a second `finalStats` with no fusion)
  — plus the numeric ±delta beside each value. New CSS `.stat-mag .delta.up/.down` + `.stat-delta`.

## 2026-09-28 — Appendix: collapsible category filters + bookmark scope
Reworked the Appendix filter UX (all 5 user requirements; verified live in headless Chrome, 0 runtime errors):
- **Collapsible category headers replace the drill-in Category→Value menu navigation.** All 24 taxonomy
  categories render as `apx-sec-head` collapsibles (collapse-all by default via `st.expanded` Set); each
  expands to its sub-category value rows. Dropped `st.cat` + the `appendix-cat`/`appendix-cat-back`
  two-level drill; new handler `appendix-cat-toggle`. A name query filters both levels and auto-expands.
- **Per-sub-category `n` = result count** (`.apx-val-n`): how many results applying that value yields.
  Category header `apx-sec-n` = number of available sub-tags.
- **Live narrowing:** `appendixBrowseIndex(tags)` keeps only values that co-occur with the applied tags
  (n>0) and recomputes every `n` off the current AND-filtered universe. Confirmed 24→22 categories,
  23→19 count as a tag is applied.
- **Bookmark-scope filter (req 2):** chips `★ Bookmarked` + `Creature-innate / Item-only / Perk / Spell`
  (shown when the build has bookmarks). `ovState.bkScope` restricts the whole Appendix universe via
  `appendixUniverse()` (relics/cards excluded — not bookmarkable). Spells included per user. A trait is
  creature-innate if a creature has it innately (`bkTraitClass` via `traitSources`), else item-only.
  `appendixBkCounts()` drives the chip counts. Clearing bookmarks resets `bkScope`.
- **Instructional chrome removed (req 1):** dropped the foot-info hint sentences; results view shows only
  an "N results" label. `appendixResults` now flows through `appendixUniverse` (scope-aware).

## 2026-09-24 — Extract reconciliation program (creatures + two-form owner model)
Deepened the trait owner model into a full **two-form** model and did a **creature census**, all
extract-grounded with provenance (user directive: reconcile everything from the extract; wiki OK for
MAPPING not for asserting PRESENCE; no inventing entities from the community-CSV source column).
- **Two-form owner model** (commit f3d5a94): every trait carries `owner`/`ownerType`(`creature`|`boss`)/
  **`ownerForm`**(`player`|`encounter`)/`ownerCategory`(`Avatar`|`Nether Boss`|`Deity`|`False God`|`Special
  Boss`)/`ownerGroup`(encounter)/`ownerProvenance`(`code`|`wiki`)/`itemSource`. KEY validated finding:
  **Deities == Avatars** — the 31 roster Avatar-race creatures ARE the 31 Gate-of-the-Gods deities, each with
  a DIFFERENT trait per form (player Avatar trait vs encounter Deity trait). Same as **Zantai** (player
  Quadhits #298) vs **Lord Zantai** (encounter "The Ultimate Strategy" #1538). So a creature owns one trait
  per form; 1:1 holds within a form. Dist: 1331 creature/player · 31 Avatar · 161 Nether Boss · 58 False God ·
  30 Deity · 1 Special Boss · 418 item-only · 0 gap. **Lord Zantai is NOT a separate creature** — he's the
  code-present roster "Zantai" in encounter form (wiki only maps the trait). Nether Bosses (0/36 in roster) +
  9 non-Caliban False Gods are encounter-only; Caliban is triple-form (Avatar+Deity+False God).
- **Creature census** (research + extract-grounded): 1362 playable (code) + 87 non-roster `creature_stats`
  extras = 66 False God parts (code+convention) · **10 NYI** (future False God set — Balcan/Xandor/Gorpin/…
  each tied to a False God per `lore_ref.json`; overworld sprite but null battle_frame) · **5 Orbs** =
  Caliban story-encounter creatures (NOT spells — they have creature stats) · **Failed Experiment** = Siralim-3
  legacy creature · **Relic** = unresolved · 4 CSV spelling-variants → corrected. Pandemonium K/Q + Treasure
  Golem are real roster creatures (not invented). LESSON: don't reclassify a creature as a spell on a name
  match; a creature with stat data is a creature.
- **4 CSV creature-name typos corrected at source** (commit 88179da): Manticore Conquerer→Conqueror,
  Phenominal→Phenomenal Possum, Maionette→Marionette Charlatan, Gloopidator→Gloopdiator (code-authoritative;
  `CREATURE_SPELLING_FIX`, dropped 4 redundant sprite overrides; sprites intact 1362/1362).
- **`creature_reconciliation.json` PERSISTED** (`_su_extract/data/model/`, generator
  `code/build_creature_reconciliation.mjs`): 1419 entities — 1362 Playable · 40 False God part · 10 NYI
  (each tied to its False God; **the NYI names are anagrams/letter-subsets of their False God** — Darboen=
  exact anagram of Nebodar — deliberate staged naming) · 5 Story Boss (Caliban Orbs) · 1 Legacy (Failed
  Experiment, Siralim 3) · 1 unresolved (Relic).
- **Phase B — UNRECONCILED trait revalidation (commit bdb8d03):** the 124 UNRECONCILED genuinely fail our
  recon params (0 creature owner, 0 item). VALIDATED (user caution) that 6 same-named "perks" are DISTINCT
  traits (different effects) — a name match ≠ identity, so NOT recategorized. **33 classified NYI-sandbox**
  (user-confirmed staged content found in the sandbox ~1yr ago + the 12 Zodiac "Sign of X"): Acclimation ·
  Brain/Hand/Heart of Misery · Breathe Underwater · Collapsed Dream · Damaos' ×3 · Hebron's ×4 · Leap of
  Faith · Reap Destruction · Serenade of Guilt · Siralim's Ascendance/Attunement/Prayer · Syndrome · Ultima
  · Zodiac ×12 (`NYI_SANDBOX_TRAIT_IDS`; moved Acclimation+Hebron out of unresolved-ownerless). Blacklist =
  3 dup + 33 NYI-sandbox + 12 unresolved-ownerless + 109 recon.
- **Phase B COMPLETE (user-classified the whole tail; commits 5ea7fcb, 4202077).** All 124 UNRECONCILED +
  12 ownerless resolved to a KNOWN category (no name-match/identity assumptions; only unresolved ids touched):
  - **legacy-S3 (90):** Itherian Artifact set (812–869) · Mage Perks (Nighttaker/Daybreaker/Death's/
    Damnation's Edge) · Multiply (Failed Experiment) · Crucifixion/Crucify Me (Misery boss) · Betrayer of the
    Code (The Unguided) · Corrupted God fights (Corrupted God/GET/Trait Disabled) · boss-innate Hearty/Very
    Hearty/Betrayer/Deceiver/Ascension · Nether-boss-innate (Torn Betwixt and Asunder, Boneyard and Sacrilege,
    Nasty Surprise!, Better to Receive, Maximum Hydration, Undead Army, Eager Recruit, Delusion, Vext's Grace).
  - **NYI (39):** 33 sandbox (+Zodiac) + Anathema/Poison Bath/Wishing Stick/Sorcerous Statue/Thunder God's
    Wrath + Stolen by Damnation's Edge (cut Animator feature).
  - **LIVE special/story bosses (+8):** Guided by Darkness→Erebyss Deity (2.0.17 replaced Absence of Light) ·
    Torun's Blessing→Treasure Golem 2.0 · Boon of the Hee Hoo Hay Ho→Imp Impington Prime (story) · IMMORTALITY/
    God of Dreams/Nightmares/Nether Orb/Orbs→Caliban story encounter. `Special Boss` category = 8 (Zantai +
    these). NEW STRUCTURE FACT: every Ultimate Nether Boss owns **3 same-named copies** of its trait
    (validated — some have 4–5 from dupes); Kraynaks has its 3 "Who Am I? None Of Your Business", so #1215
    "Who Am I?" is an outlier.
  - **STILL UNRESOLVED — just 3:** Pandemonium Unfairness (#898, tied to the Pandemonium K/Q shrine fight —
    user unsure) · Inner Demons (#969) · Who Am I? (#1215 outlier). `unresolved_traits.csv` regenerated 124→3.
  Final blacklist: 3 duplicate + 39 NYI + 90 legacy-S3 + 1 unresolved-ownerless + 16 recon; **2038 shipped**.
- **Phase C — Items (first pass, 2026-09-24).** `item_reconciliation.json` +
  `unresolved_items.csv` persisted (`_su_extract`, generator `code/build_item_reconciliation.mjs`). All
  **1862 materials categorized** (code-certain by shape): Trait material 1644 · Mastery Sigil 156 · Trick 47 ·
  Amber/Stat 15. **1719 reliably linked** to their granted trait (`source_item` / `Trait_REF`, possessive+
  plural tolerant). **81 unlinked** — no reliable item→trait source names them; `material_stats.trait_id`
  DRIFTS (wrongly guessed Ramses's Crest→"Coercion") so it's unusable, and there's NO Material/Item_REF
  compendium. The 81 are mostly redundant alt creature-trait materials (their trait already has a linked
  material) + some legacy/NYI boss items (Unguided/Misery/Itherian). Practical gap is small; needs in-game/
  compendium ground truth to link precisely. (User: leave the 81 unlinked — they map to excluded legacy
  traits; every live trait is matched or expectedly item-less.)
- **Phase D — Spells DONE (2026-09-24).** 747 code spells all shipped, **0 duplicates, 0 missing class**, no
  legacy/NYI/duplicate spells (code↔community are 1:1). Reconciliation fixes: the only 2 "orphans" were
  community-CSV spelling typos (Luscious Lager / Ignis Fatuus) → resolved via fuzzy match (0 no-source now);
  the 35 spells missing code charges (Morph set, etc.) filled from the community count (`chargesSrc` =
  code 712 / community 35 — code stays authoritative, Affliction 14 not 17). Compendium fields (Potency/
  Target/**Source**) now read straight from the user's `Spell_REF.csv` (verified 747/747 identical to
  spells_ref.json). Per-attribute provenance recorded. **The whole "reconcile everything" program (creatures/
  traits/items/spells) is now complete.**

## 2026-09-24 back to 2026-09-16 — early session log (bullet entries, newest first)
- 2026-09-24: **ASSET OWNERSHIP INDEX + boss/skin reconciliation (source-of-truth layer).** Built a canonical,
  schema-validated relational index of every mapped object and used it to fix real asset-ownership bugs.
  **Sources of truth (all in `_su_extract/data/model/`, gitignored from this repo; consumed by `build-data.mjs`):**
  - `object_index.json` (+ `object_index.schema.json`, `schema_version:1`) — THE canonical index of all 7.4k
    objects `{type,name,id,assetName,assetPath,related}`. Creature/skin `assetName` = the true
    `spr_crits_battle_<frame>`, **byte-validated** against the shipped sprite. Gen `code/build_object_index.mjs`,
    gate `code/validate_object_index.mjs` (schema + byte-truth; 0 mismatches). Docs: `_su_extract/OBJECT_INDEX.md`.
  - `creature_frame_overrides.json` — validated creature frame corrections (dup source docs shipped legacy-S3
    frames): Aaxer 9→2095, Blood Slime 541→2205, Dumpling 1310→1304, Unguided Agnostic 1804→1802, Shambler
    Benefactor 1209→3396. **These changed 5 shipped creature sprites (deployed).**
  - `nether_boss_frames.json` — 38 Nether/Special boss → `spr_crits_battle` frame(s) (from the user's Google
    Sheet). build-data ships them → `assets/bossbattle/` + `D.bossSprites`; Appendix boss rows render real
    battle sprites (deployed). Includes the found-via-skins bosses: Imp Impington 1876, Prime 1877, Treasure
    Golem 2822, Inner Darkness/Shadow Lord 1888–1893.
  - `false_god_part_frames.json` — FG body-part frames + positions (Arm of Althea L/R, Head of Hydranox 5 heads).
  - `frame_duplicates.json` — 135 byte-identical frames → canonical+owner (so dup art never resurfaces).
  - `skin_exclusions.json` — 37 `skins.json` entries that are actually bosses (the Nether roster + the 4 above),
    excluded from the shipped skin set (skins 743→734). skins.json OVER-claimed boss sprites.
  **Reference/validation tools (`_su_extract/`, NOT shipped):** `contact_sheet.html` (every battle frame, mapped
  dimmed + candidates highlighted; Focus toggle), `frame_disagreements.html/.csv` (now 0 open), `skin_validation.csv`
  (834 skins, 37 flagged applied), `build_contact_sheet.py`, `build_frame_disagreements.py`, `apply_frame_validations.py`,
  `build_skin_validation.py`, `build_frame_duplicates.py`.
  **⏸ PENDING (user returning to it):** the UNMAPPED-skin hunt — scan `contact_sheet.html` candidate pool (~1465
  unowned frames = real skins-to-surface + NPC/legacy) and mark real skins; also finish reviewing `skin_validation.csv`.
- 2026-09-24: **Appendix — pass 3 (search-w/o-filter, centered labels, perk spec icon, taxonomy Source, Caliban sprite, False God boss pages).**
  Follow-ups to the six upgrades: **(1)** center the "N cards" / "Rank N" labels in their column; **(3)** name
  search now returns matches with **no taxonomy filter** applied (a query at zero tags shows name-filtered
  results instead of the category browser); **(5)** dropped the token/llm provenance chips from result rows
  (kept on the taxonomy detail page only; removed the dead Sources toggle); **(6)** taxonomy detail page gained
  a **Source** block — Material (or "No Material Exists"), Item source, and the innate **Creature/Boss owner**
  (creature owner clickable → creature preview; False God owner → boss page); **(7)** perk rows show the
  **specialization emblem** where trait rows show a creature.
  **(2) Caliban Deity battle sprite:** Caliban is a Deity AND a False God as separate entries; added
  `bspr_god_caliban` via `GOD_BSPR` + a new `bossSprites` map (normalized Deity owner → bspr_ battle sprite,
  all 31 Deities incl. Caliban). **Nether/Special bosses have NO `bspr_` battle sprite in the extract** (only
  overworld + 16×16 material sprites) — left **unmapped** (owner-name chip) pending a code-grounded source, per
  user (do NOT assume the overworld sprite is the battle sprite).
  **(8) False God boss detail pages:** every False God is a set of body-part creatures that **share one stat
  spread** (all 40 parts = 50/25/25/25/25, verified). `build-data` enriches each `falseGods` entry with a shared
  `stats` block + a `parts` list ({name, traitId}) from `creature_reconciliation` (tiedTo) + `creature_stats`
  (by key) + the shipped FG trait (by name; 34/40 parts have a distinct-name trait, 6 "Arm of X" show stats
  only). App adds `openFalseGodDetail`/`renderFalseGodDetail`: portrait + shared base-stat table + each part's
  trait, reached from the FG boss row's portrait (and the taxonomy owner link). Verified headless (fgod 9/9;
  appendix-v2 15, v3 13, collapse 13, abation 3).
- 2026-09-24: **Appendix — six upgrades (creature detail · item names · search · boss grouping · relic/card legibility).**
  (1) **Creature sprites open a read-only creature detail** (`openCreaturePreview`/`renderCreaturePreview`,
  reusing the main-screen `renderCreatureIdentity`: sprite · class/race · innate trait · base stats); the row's
  creature square is now `apx-crea-open` (its own `data-action` so `closest()` beats the row's trait-open).
  (2) **Item names shown in the row** — the trait meta now lists the granting material name(s) (deduped) instead
  of a bare "N items" count. (3) **Name search hits trait / creature / boss-owner / item names** (`_search`
  extended with the boss owner + deduped item names). (4) **Boss-owned traits get their own "Boss Traits"
  section** (sorted by ownerCategory), with the **boss's sprite** mapped in: Deity → god battle sprite (30/31),
  False God → combined portrait (58/58) via `bossSpriteFor` over `D.realms`/`D.godShops`/`D.falseGods`;
  Nether (107) + Special (8) + 1 Deity have **no sprite in the extract** → a legible owner-name chip fallback
  (backlog: extract Nether/Special boss sprites). (5) **Relic text** is now one labelled line per rank
  (`relicRanksHtml`: "Rank 10 / Rank 20 …") instead of an illegible `·`-joined block — also fixes the shared
  entity-detail overlay. (6) **Card effects** render one line per tier labelled by the card count that unlocks
  it (`cardTiersHtml`: "3 cards / 5 cards / 8 cards") — the repeated effects are per-tier stacks, not
  duplicates. Verified headless (appendix-v2 smoke 15/15; collapse 13/13; abation-ui 3/3).
- 2026-09-24: **Trait item-owner reconciliation — fix the join + add a build-time validation guardrail.**
  Symptom: Abation (and others) shipped with a creature owner but no trait-item icon in the Appendix.
  Two root causes, both fixed:
  (1) **Case / punctuation / space mismatch** between a trait's claimed `source_item.name` and the real
  material name. `build-data.mjs` now canonicalizes `source_item` links to the exact material name via a
  **punctuation+space+case-insensitive** normalized key (`normPS`, strip all non-alphanumerics) with an
  **unambiguity guard** (a normalized key shared by 2+ distinct materials is dropped — never guess).
  Rescues Abation "Lunar Blood vial"→**Lunar Blood Vial** (case), Soul to Keep, Naxor Harbinger, and
  Echobreather "Particle of Grommet"→**Particle of Grom'Met** (apostrophe+case).
  (2) **Wrong/missing community item names.** ~21 creature traits either had a typo'd Trait_REF Item Name
  (Misanthropy "Berseker Sweat"→**Berserker Sweat**, Volley "Archer Break"→**Archer Beak**, Chaotic Mind
  "Math Textbook"→**Arithmetician's Textbook**, "Voltatic"→Voltaic, "Opalscent"→Opalescent, Turbulent
  Waters' item wrongly set to the trait name→**Still Waters**, "8004"→B004, Autonomous Network's
  "Ne**u**tral Hive Network Implant"→"Ne**u**ral…" …) or **no CSV row at all** (Shepherd of Fire, Purge,
  Impedance, Rapid Learning, Year of the Trollboar, Scoundrel's Strike). Per the "update the source CSV,
  don't hard-swap the join" call, I corrected/added those rows in
  `_su_extract/data/reference/_raw_csv/Trait_REF.csv` (col 5 Item Name), grounding every name on the
  **code-corrected `material_stats.trait_index`** (validated: agrees with all 1422 existing name-based
  links, 0 disagreements) — NOT a runtime trait_index join. Regenerated traits_ref → traits_consolidated.
  (3) **Code-extraction name typo.** #703's passive name was "Turn to **Gray**" but the game (and
  Trait_REF/Creature_REF) spell it "Turn to **Grey**" → the name-keyed reference join missed, leaving it
  itemless. Added a tiny, justified `NAME_CORRECTIONS` map in `build_trait_consolidation.py`
  (`Turn to Gray → Turn to Grey`); the corrected name both ships correctly and attaches its item
  (**Ritual Stitches**).
  Result: creature-owned traits with a trait-item **1299 → 1322**; trait-items **1724 → 1748**.
  **Guardrail** (`build-data.mjs` owner-model block): reports "item coverage: N/M creature-owned traits
  also have a trait-item". The VALID itemless cases are read from the data, not guessed — **Avatar/Deity**
  forms and traits the reference explicitly marks **"No Material Exists"** (bosses like Pandemonium /
  Treasure Golem / Mimic + special sets). Everything else is surfaced for review. Now **40 itemless =
  40 valid · 0 to review** (all resolved). Verified headless (Abation/Echobreather/Autonomous Network/
  Turn to Grey all ship items+icons; app boots; collapse smoke 13/13, Abation UI 3/3).
- 2026-09-24: **Appendix — collapsible result sections.** Each category group (Traits / Perks / Spells /
  Relics / Realm Cards) now has a clickable header that collapses/expands just its own list, so a busy
  multi-tag result set can be folded down to the section(s) you care about. The `section()` helper renders
  the header as an `.apx-sec-head` button (caret ▾/▸ + a right-aligned `.apx-sec-n` count badge) and drops
  its `.perk-list` when collapsed; state lives in `ovState.collapsed` (a `Set` of section titles, per open
  overlay) toggled by the new `appendix-toggle-sec` action. Reuses the existing `syn-*` collapse idiom.
  Verified headless (jsdom): a 4-section result (Traits 38 / Perks 7 / Spells 5 / Realm Cards 1) collapses
  the clicked section only, flips its caret, drops one `.perk-list`, leaves siblings expanded, and restores
  on re-click — 13/13 assertions.
- 2026-09-24: **Fail loudly on missing sprites (removed the silent-hide fallback).** `spriteImg` no longer
  hides broken images (`onerror` was `this.style.visibility='hidden'` = silent blank, as bad as a 404). Now a
  broken/missing sprite gets `class="sprite-missing"` (unmissable red hatched outline, `!important` visible) +
  `console.error('MISSING SPRITE', src)`. Surfaces the 19 item-backed traits with no material icon loudly
  instead of rendering blank. (Resolving those 19 + Appendix boss-trait surfacing = high-priority backlog.)
- 2026-09-24: **Nether-boss bare-slot fix + blacklist NYI/legacy + only-live-traits ship.** Reconciliation
  now spans the full `traits_consolidated` universe (2186), so the same-name Nether-boss tier variants whose
  `passive_names` name was blank (e.g. Waking the Fallen 544/587, Undying 543/586) correctly resolve as
  **boss-owned** (they lack an item *because* they're boss-owned) instead of shipping status-less. Blacklist =
  {UNRECONCILED, Not Yet Implemented, legacy} + the lone unnamed fragment (EMBEROFVULCANAR): **2049 shipped /
  138 excluded**, 0 null-status, 0 dangling refs. boss-owned tag = 250. Image hygiene: **0 404-shipped**
  (asset guards + runtime onerror). Only remaining sprite gap = **19 item-backed traits** (master/reward/treasure)
  whose material-icon join is missing — render blank, NOT 404 (material-icon coverage gap, tracked separately).
- 2026-09-24: **Trait reconciliation wired into the build; UNRESOLVED traits excluded from the app.**
  `build-data.mjs` now reads `_su_extract/data/model/trait_reconciliation.json`: the **124 UNRESOLVED traits**
  (not present in live Ultimate — sandbox-unreleased or prior-game legacy) are **dropped from `SU_DATA.traits`
  entirely** (2063 shipped / 124 excluded; verified 0 dangling creature or trait-item refs). Every shipped trait
  now carries reconciliation tags: `obtainStatus` (creature_innate/master/reward/treasure/item/boss/legacy/NYI),
  `obtainSrc` (ID/community/wiki), **`bossOwner`** (214 — Gate-of-Gods + Nether-boss innate + False God parts) and
  `obtainedFrom` (15 — Nether-boss trait materials). Boss-owned tag now available in `data.js` for downstream use.
- 2026-09-24: **Trait guardrails (G1+G2) + 2 community mislabels fixed via code.** Added a G2 check to
  `build-data.mjs` (no innate trait may be owned by >1 creature). The code-backed reconciliation audit
  (`_su_extract/code/audit_trait_reconciliation.py`, universe = 2148 code passives, NOT the community CSV)
  surfaced the 2 remaining bad trait names, both corrected in `name_reconciliation.json` and now resolved with
  full synergy tags: **Lurid Masochist "Shrug Off" → Purge (393)** and **Shapeshifter Novice "Transformation
  Apprenticeship" → Rapid Learning (785)** (the old "→Apprenticeship" entry collided with Spider Occultist).
  App now: **G1 1362/1362 innate traits resolved · G2 0 collisions.** (G3/G4 full-universe reconciliation =
  93.99%; the 129 remaining are Nether-boss signature traits + tiers, tracked in `_su_extract`.)
- 2026-09-24: **Innate-trait resolution alert + name-reconciliation fix.** `build-data.mjs` now applies
  `_su_extract/data/reference/name_reconciliation.json` when resolving each creature's innate trait name→id
  (`resolveTraitId`), and **alerts on any playable creature whose trait is missing or unresolved** (warn +
  a prominent "innate-trait coverage: N/1362 resolved" summary line; gated by `--strict`). One-time pass found
  **7 creatures silently tag-less** due to community spelling variants — 6 now fixed via reconciliation
  (Ritual Abomination "Turn to Grey"→Gray, Fire Priest "Shepard"→Shepherd, Cerebral Vortex "Impedence"→Impedance,
  Trollboar "Trolboar"→Trollboar, Mireling Dart Frog "Scoundrel Strike"→Scoundrel's Strike, Shapeshifter Novice
  "Transformation Apprenticeship"→Apprenticeship). **1 genuine gap remains, now loudly flagged:** Lurid Masochist
  "Shrug Off" — not in the game trait DB under any spelling (community name likely wrong; needs the real in-game
  name added to name_reconciliation.json). Boss/non-player-trait groundwork this session lives in `_su_extract`
  (`BOSS_DATA.md`, `nonplayer_traits.json`) — not shipped in the app yet (prelim for Godforge + Realm-boss features).
- 2026-09-23: **Buff/Debuff/Minion glossary** (Menu → Glossary). 65 conditions with in-game prose, sourced from
  `_su_extract` vocabulary.csv `L_CDESC_{BUFF,DEBUFF,MINION}_*` (NOT the codex.json topics; names via
  labels.json `CONDNAME_*`), runtime tokens expanded in build-data → `D.conditions` [{cat,key,name,desc,icon,taxo,taxoSrc}].
  Overlay groups Buff(18)/Debuff(20)/Minion(27) with category filter + search. **Icons** (65/65) + **taxonomy**
  now wired (see below).
- 2026-09-23: **Condition taxonomy in the entity viewer.** Buffs/debuffs/minions are a 5th taxonomy surface —
  glossary rows are clickable → `openEntityDetail("condition", "<Cat>:<key>")`, rendering the same grouped
  taxonomy chips as traits/spells/relics. Tags = per-description classification pass vs the canonical
  `tag_taxonomy.json` (identity Related tag src=token + semantic tags src=llm; e.g. Agile→Dodge/More Dodge
  Chance, Berserk→Deal More Damage, Conquest→Apply a Buff). 65/65 tagged · 248 tags; every (cat,val) validated
  against the vocabulary and identity tags validated to exist on a real trait/spell. Generator:
  `_su_extract/code/build_condition_tags.mjs` → `condition_taxonomy_tags.json`; `build-data` attaches
  `taxo`/`taxoSrc`; app.js adds `CONDITION` map + `resolveEntity("condition")`.
  50 identity tags (4 Horsemen share one value). **15 niche minions get NO identity chip on purpose** —
  a corpus sweep of all traits+spells confirms 13/15 have zero references anywhere and the other 2 appear only
  in their own `Summon X` spell, so an identity chip would filter to nothing; they carry only semantic tags.
- 2026-09-22: **Riddle Dwarf** (Menu → Riddle Dwarf). One-screen fast trivia lookup for the in-game Riddle
  Dwarf: type the given name → answer surfaces instantly across all 4 forms — Class of [Spell], Class of
  [Creature], Ruler of [Realm], Realm of [Ruler] — grouped by answer type, prefix-matches first, class answers
  colour-coded + class icon. `openRiddle`/`renderRiddle`, `riddle-search` in the onInput registry. No menu
  navigation; reads D.spells/creatures/realms.
- 2026-09-22: **God Shops** rebuilt to the Realms stepped flow (full list → full detail, no info panel).
- 2026-09-22: **God battle sprites + more Realms polish.** Curated `GOD_BSPR` map (30 gods → `bspr_god_*`
  battle sprite; 8 by name, 22 theme/arena names user-dispositioned) → `assets/godbattle/`, emitted as
  `realm.godBattle` + `godShop.battle`. Shown in the **God Shop** (row + header) and on **realm pages**, where
  the **Realm|God sort toggle now also drives the icon** (Realm = realm icon, God = god battle sprite) on both
  list rows and the detail hero. Also wired the **complex-interaction combination tables** (Combination_REF.csv,
  5 realms) and added the **Threats Realm Props|False God source toggle** + **perk bookmarks** (Appendix/anoint/
  spec) with an anoint ★ filter. Backlog: threat-set icons.
- 2026-09-22: **Realm object sprites (item 6).** Joined breakable-object sprites to realm objects via a
  curated 30-realm acronym map (`REALM_ACRONYMS`) + word-slug matching + a hand-dispositioned
  `REALM_OBJ_OVERRIDE` (build-data.mjs), copied to `assets/realmobjects/`, shown as an icon per Realm-objects
  row. **181/182 objects matched, 0 duplicate sprite assignments** (audited — fixed 4 first-word slug
  collisions: Gears/Cards/Spider/Fae). Also renamed the realm ICON (`god_<name>` → `realm.icon`,
  `assets/realmicons/`). Validated via contact-sheet screenshots. 1 backlog outlier: Amalgam Gardens
  "Abandoned Cave" (no matching amg_* sprite found yet).
- 2026-09-22: **Realms reference overhaul.** Stepped page (list → full-screen detail, no split panel);
  **Realm | God sort toggle**; **god portraits** on every row + detail header (build-data copies the canonical
  `god_<name>` sprite 30/30 → `assets/gods`, emits `realm.godSprite`); **race icons** for roaming races
  (150/150) + encounters (67/70, text fallback); "Roaming creatures"→"Roaming races"; dropped 28 junk
  **"N/A" unique rows** (filtered in build-data); dropped the **"— Instability rewards"** header chrome.
  Deferred (nice-to-have): breakable environment-object sprite join (no clean object→sprite map). Taxonomy
  viewer also gained entry points: spec/anoint perk rows + relic overlay/creature-detail relic → taxonomy.
- 2026-09-22: **Artifact info panel — Bonuses | Sockets views + library UX.** Merged the artifact/gem library
  Equip/Unequip/Build into one context-aware button; removed auto-selection; tiles now carry an equip-state
  highlight (purple = this creature, gold = another/all-in-Menu) with a neutral selection ring (`.equip-grid`,
  decoupled from Builds' `.lib-grid`); gem tile re-click deselects; equipment grids show 6/row on mobile.
  Then split the artifact info panel into **Bonuses** (default) and **Sockets** (former "Contents") views via
  a pipe-delimited toggle (`art-view`): Bonuses = per-stat bonus table (core 5 as %, plus trick stats) +
  trait containers mirroring the creature detail (banner+desc, clickable to taxonomy) + spell-gem containers
  (name/desc/trigger). Native artifact spell trigger derives from type (`ART_TYPE_TRIGGER`: Helmet=On Provoke,
  Sword=On Attack, Staff=On Cast, Shield=On Defend, Boots=On Turn); nether-stone spells keep their stored
  trigger. Helpers `artifactBonusRows`/`artifactTraitContainers`/`artifactSpellContainers`/`artifactBonusView`
  reuse `artifactPctOf`/`PRIMARY`/`propGroups`. Verified headless (Sword→+118% Atk, On Attack native vs On
  Turn nether, toggle swaps to raw sockets).
- 2026-09-22: **Entity taxonomy detail** (backlog: real trait detail page, generalized). Clicking any Appendix
  result row — or any trait banner — opens a detail overlay showing that entity's description + its FULL
  taxonomy grouped by category, each value chipped with its provenance source (token/keyword/llm/phrase/field/
  correction). Tapping a tag jumps to the Appendix filtered by it. Reusable `resolveEntity(kind,id)` +
  `entityTaxHtml(e)` cover trait/spell/perk/relic/card (perk by `key`, rest by id); `openEntityDetail` keeps a
  return target so opening from the creature detail page returns there on close. Appendix rows made clickable
  (`apx-open`); `line()`/`traitRow` carry the `{kind,id}` target. Verified headless (row→detail→tag-jump; and
  creature-detail→banner→detail→close returns to creature). Replaces the `nav-trait` `alert()` stub.
  **Follow-up (same day):** per "all traits, wherever shown, open the taxonomy" — also wired `libTraitRow`
  (nether + artifact library panels), the artifact socket **preview** header (`art-pv-top`, "tags ›" hint),
  and the nether builder's socketed-trait **slot**. Nether-socketed traits were already reachable on the
  creature detail page (they flow through `slotTraitIds` → clickable trait banners). Synergy intentionally
  left as-is (its matrix already visualizes an object's full tag associations). Generalized `.apx-clickable`.
- 2026-09-22: **Macro Proposal — iteration 2 (extensibility refactor).** No behavior change — `proposeMacro`
  output verified **byte-identical** across a fixture covering every rule branch (headless diff, 54 lines).
  Extracted `MACRO_TUNING` (every threshold: heal %s, finishHp, buff/debuff floors, minionCap, aoeMaxThreshold,
  focusRotation), added `SPELL_OVERRIDES` (per-spell `{purpose,side,multi}` hook in `classifySpell`), turned
  the 12 inline rule blocks into an ordered `MACRO_RULES` array of `{key,when(x),lines(x)}` over a shared
  `macroContext(x)`; `proposeMacro` is now a thin iterator; `macroRoles(x)` split out; helpers `mLine`/`allyT`/
  `enemyT`. New **`MACRO_ENGINE.md`** documents the three modification surfaces + how-to. This is the
  foundation for spell-specific logic + target-priority work.
- 2026-09-22: **Macro Proposal — iteration 1** (user feedback). (1) **Gems-only**: `gatherSlotSpells` now uses
  ONLY equipped spell gems — artifact Spell-slot + Nether-Stone spells auto-proc and can't be cast by a macro,
  so they're excluded. (2) **Fuller coverage** toward the 32-line cap: emergency (<25%) vs sustained (<50%)
  heal thresholds, squishy-caster self-preserve turtle, finish-the-kill lines, a FOCUS_ROTATION giving each
  damage gem a distinct target priority (lowest Max HP / highest Atk / highest Int / lowest Def / highest Max
  HP), escalating AoE enemy-count thresholds; trimmed to 32 with a note when a kit overflows (`MAX_MACRO_LINES`).
  (3) **Moved out of the creature detail panel** into its own **Menu → Macros** overlay (below Threats):
  party creature selector (`macro-crea`) + the selected creature's proposal, framed as "set default action =
  Macro, hold to auto-battle" (`openMacros`/`renderMacros`). Verified headless (detail has 0 macro sections;
  2-creature selector switches; richer line sets). Roadmap items 1–4 (named status, knobs, classification,
  spec/anoint context) still open.
- 2026-09-22: **Macro Proposal engine.** Predicts a creature's in-game battle-AI Macro from its loadout so
  players can automate battles (default action = Macro). `proposeMacro(slot)`: `gatherSlotSpells` (gems +
  nether-stone spells + artifact spell) → `classifySpell` (purpose/side/breadth from taxonomy: rez/heal/
  damage/debuff/buff/provoke/defend/summon; single vs multi) → ordered lines: rez→heal→provoke→buff→debuff→
  summon→AoE→focus-fire (Barrier-guarded chain, lowest Max HP)→basic attack (Shell/Barrier-guarded, lowest
  Defense)→guaranteed fallback. Rendered as a "Proposed Macro" section on the creature detail page (role
  chips, per-line rationale, chain indentation, Copy-to-clipboard). Grounded in the decompiled `scr_Macro*`
  system (+`L_MACRO_*` localization) → `_su_extract/data/model/macro_vocab.json` (10 targets/67 conditions/8
  actions) bundled into data.js as `macroVocab` via build-data.mjs. Verified end-to-end with headless Chrome
  (heal+debuff+AoE+single-damage loadout → correct 6-line brain, roles Healer/Debuffer). Full model:
  `_su_extract/code/MACRO_MODEL.md`. Backlog: buff/debuff NAME detection (gate on the specific status);
  spec/anointment-aware role hints; import/export in the in-game save format.
- 2026-09-22: **Appendix bookmarks.** Star toggle on Appendix trait + spell result rows (`bkBtn`, action
  `apx-bookmark`). Bookmarks = scratch state for the ACTIVE build only (`bookmarks {traits[],spells[]}`,
  LS key `subc.bookmarks`); cleared on Reset (`clear-party`) and on loading a saved build (`builds-load`).
  A "★ Bookmarked" facet appears — only when bookmarks of that kind exist — in the creature picker (traits,
  `crea-bkonly`), spell-gem builder spell step (spells, `sgb-bkonly`), and the artifact builder trait/spell
  pickers (`artb-bkonly`, reset on picker-category switch). Verified end-to-end with headless Chrome (mark →
  facet appears → 400 tiles narrow to the 1 creature with that innate trait; Reset clears). Next: macro helper.
- 2026-09-16: Scaffolded the project via build-calc-planner. Wrote `build-data.mjs` (joins creature_data +
  creatures_ref + sprite index + theorycraft tags + artifacts/relics/cards/materials; hygiene guardrails),
  the vanilla SPA (`index.html`/`styles.css`/`app.js`) with the full overlay/trait/stat house style, and the
  planning docs. P0 expanded to include artifact/relic builders + nether library + card collection. Palette:
  SU indigo + gold with 5 class accents. Verified P0 flow on `tools/serve.mjs`, then `git init` + initial commit.

## 2026-09-21 — session 4q (Realms + God Shops reference pages)
Two new read-only reference overlays (Menu → **Realms**, **God Shops**).
- **build-data**: `godShops` (from `god_shop_ref.json` — 22 gods × ~21 items, grouped per god, sorted by tier;
  each `{tier,item,type,price,desc}`) + `realms` (from `realms_ref.json` — 30 realms; the flat section-
  delimited `other` array is parsed into `encounters`/`resources`/`uniques`, each unique object carrying its
  4 **Realm-Instability tier thresholds** → interaction reward). Realm `godName` = short name (before the
  comma); `hasShop` cross-links the 21 realms whose god runs a shop.
- **God Shops overlay** (`openGodShops`/`renderGodShops`): left god list (item count) + right item list
  (name · type chip · **favor price ✦** · description); search matches item/type/desc.
- **Realms overlay** (`openRealms`/`renderRealms`): left realm list (class-dot + god) + right detail —
  facts (God/Class/Gemstone/Godspawn via the `.spell-stats` grid), **Roaming creatures** as sprite chips
  (`realmCritFor` resolves race/name → a representative creature sprite), Encounters, Resources, and
  **Realm objects → Instability rewards** (each object's 4 tier rows: `≥N instability → effect`). Realms
  with a shop get a **"View <god>'s God Shop ›"** cross-link button (`realm-shop` → `openGodShops(god)`).
- Menu gained a separator + the two items; searches wired in `onInput`; `.opt-row.on` selected style +
  realm-crit/realm-uniq/realm-tier/gs-price CSS. jsdom `refpages_smoke.mjs` 19/19 (data shape, both
  overlays, selection, cross-link lands on the right god); all suites green. Shipped to `master`.

## 2026-09-21 — session 4p (taxonomy PROVENANCE — surface how each tag was derived)
Clarified/hardened how taxonomy is derived and made the source surfaceable on demand. **Derivation is NOT a
naive prose heuristic**: each tag carries a `src` from the pipeline — `token` (the game's own structured
markup `{CONDNAME_}{STAT_}{RACE_}{CLASS_}{ACTION_}{SPELL_}{TIMELINE}` — exact, wording-independent so
"has" vs "have" can't matter), `keyword` (a small word-boundaried domain-keyword layer for broad mechanics),
`llm` (per-description classification for the ~15 trigger/effect categories markup can't express), plus
`phrase`/`field`/`correction`. A has/have split therefore comes from an LLM coverage gap or a markup gap,
never a coded verb rule.
- **build-data** now PRESERVES that `src` (was dropped in the flatten). New `taxoSrcArr(srcArr, finalTaxo)`
  emits `taxoSrc` as a **parallel array aligned to `taxo`** (taxoSrc[i] explains taxo[i]) on traits, perks,
  spells, trait-items (inherited), relics, cards. Parallel-array form keeps the size hit small (3.13→3.41 MB;
  the naive per-tag map was 4.42 MB). Distribution: token 4235 · llm 7003 · keyword 478 · phrase 785 ·
  correction 21 · field 16.
- **Appendix "Sources" toggle** (`appendix-src`, off by default per minimal-chrome): when on, every result row
  shows a colour-coded provenance chip for how IT earned each active filter tag (green token / blue keyword /
  violet llm / gold correction), with a tooltip. This is the "surface provenance when needed" path — filter a
  group, flip Sources, and immediately see which members are exact-markup vs classified (spotting the gaps).
jsdom `appendix_smoke.mjs` +provenance 20/20; all suites green. Shipped to `master`.

## 2026-09-21 — session 4o (taxonomy for Realm Cards + Relics + nether; drop perk-tree item)
Extended the tag taxonomy to the remaining fixed surfaces, per user.
- **Classification**: exported card (141, effects joined) + relic (31, all rank effects joined) descriptions,
  ran the existing batch-LLM pipeline (6 parallel agents vs `TRAIT_CLASSIFICATION_CODEBOOK.md` + the fixed
  468-value vocab), aggregated via `aggregate_surface.py` → `card_taxonomy_tags.json` (125/141 tagged; 16 are
  pure economy/resource cards with no combat mechanic → empty) + `relic_taxonomy_tags.json` (31/31, 702 tags).
  All emitted tags validated against the vocabulary (0 dropped). Repro dir: `_su_extract/code/cardrelic_classify/`.
- **build-data**: `cardTaxo`/`relicTaxo` loaders; each card/relic gets `taxo` via `correctTaxo(taxoStrs(...))`.
- **Appendix**: cards + relics now feed `appendixTaxoIndex` and appear as **Relics** + **Realm Cards** result
  sections (icon + stat/class chip + effect text), searchable by the same multi-tag AND drill-down.
- **＋Filter**: added to the **Cards** collection and the **Relic builder** (shared `taxoFilterBar`/`taxoMatch`
  helpers + surface-aware `facet-taxo` idx via `cardTaxoIndex`/`relicTaxoIndex`; reuses `rm-taxo`/`facet-pick`).
- **Synergy**: **relics** (equipped per creature; skipped under Deprived) and **nether-stone spell props**
  (`slotNetherSpells`; nether traits already flow via `slotTraitIds`) are now counted as creature-attached
  effects in both Matrix + List views (List kind `Relic`). **Realm cards are deliberately NOT synergy
  carriers** (user: don't count card taxonomy in synergy totals) — they're never gathered by
  `buildTagCarriers`/`buildTagEffects`.
- **Dropped the perk-tree picker** backlog item (user: no such thing exists).
jsdom `cardrelic_smoke.mjs` 12/12 (data, Appendix sections, card ＋Filter narrow/restore, relic in synergy);
matrix/appendix/spellgem/creasort/threats/builds/asc all green. Shipped to `master`.

## 2026-09-21 — session 4n (spell data enrichment + spell-gem info panel + Appendix spell icons)
- **Spell data enriched** in the pipeline: each `SU_DATA.spells` entry now carries **`charges`** (CODE-certain
  from `_su_extract/data/model/spell_stats.json` — authoritative, e.g. Affliction 14 beats the community
  CSV's 17; 712/747 covered) plus **`potency` / `target` / `source`** (community `spells_ref.json`, `-`
  normalized to null; 402 have potency). `build-data.mjs` loads both, logs the coverage.
- **Spell-gem library info panel** (`renderSpellGemLib`) reworked: the selected gem now shows a **Spell**
  section (class gem icon + name + full desc) followed by a compact **stat readout** (`spellStatsHtml`:
  Class / Charges / Potency / Target / Source — only the fields we have), then an **Enchants** section for
  the dust props. Replaced the old flat "Contents" list; dropped `sgContentRows`.
- **Appendix spell rows** now render the **class-coloured gem icon** (was iconless) plus a charges·potency
  meta chip (`spellMeta`). The spell-gem builder's spell-picker rows got the same inline charges·potency tag.
- New CSS `.spell-stats`/`.ss-row` (key/value) + `.prop-metatag`. jsdom `spellgem_smoke.mjs` 16/16 (data
  provenance, info-panel stats, Appendix icons+meta); all other suites green. Shipped to `master`.
- **Follow-up: live info panel while PICKING a spell.** The spell-gem builder's step-1 (Pick spell) gained
  a right `ovl-right` info panel that previews the highlighted spell's icon + full effect + stat readout
  (`spellStatsHtml`) as you tap through candidates — so you can compare charges/potency/target BEFORE
  committing, not only after the gem exists. `sg-spell` already re-renders via `refreshOverlay` (scroll
  preserved). Smoke extended to 22/22.
- **Follow-up: Spell-Gem library footer parity with Artifacts.** Moved the buried Edit/Delete/Equip out of
  the info panel onto the **bottom bar** (mirrors the Artifacts/Builds footer): left = Hide equipped; right
  = Edit + Delete (`.btn-ghost`, disabled without a selection) + a mode-switching confirm that reads **Equip
  / Equipped ✓** in a creature equip context or **＋ Build new** in manage mode. Info panel is now
  content-only. Smoke 31/31 (footer buttons, disabled states, equip-context toggle).

## 2026-09-21 — session 4m (fix Defiler/Tribalist tier-1 costume — split-stem antipattern)
User: tier-1 Defiler & Tribalist were broken. **Final, user-confirmed truth: these two specs split their
3 costume tiers across TWO stem names** — tier-1 under the SPEC name (`npc_defiler_alt` /
`npc_tribalist_alt`, `cat=specialization`), tiers **2 & 3 under a mismatched creature-looking name**
(`npc_occultist_2/_3` / `npc_shaman_2/_3`, `cat=npc`) — the tiers 2/3 ARE correct despite the name; the
naming itself is the antipattern. The session-3 batch got tiers 2/3 right but used the bare
`npc_occultist`/`npc_shaman` (the actual creatures) for tier-1 → wrong sprite. (An interim over-correction
dropped tiers 2/3 entirely; reverted.) **Fix (hard-coded in `SPEC_COSTUME_OVERRIDE`):** Defiler →
`['npc_defiler_alt','npc_occultist_2','npc_occultist_3']`, Tribalist →
`['npc_tribalist_alt','npc_shaman_2','npc_shaman_3']`. Verified both resolve to 3 tiers (2 anim frames
each). Captured in memory `su_spec_costume_tier_stems.md` so it isn't re-broken. Other `_alt`-tier-1 specs
keep all three tiers under their OWN stem's `_2/_3` and are fine.

## 2026-09-21 — session 4l (stat anomaly fix + creature stat sort + matrix align)
Batch of user requests.
- **#3 Base-stat null anomaly fixed.** 14 god/boss creatures (Final Arbiter, Gonfurian, Alexandria,
  Genaros, Pandemonium Queen, Gravewood Ghost, Grubette, Polygala Fae, Hunter Scout, Nihilist Seeker,
  Amethyst Paragon, Shambler Rescuer, Venomskin Spellmane, Docile Wolpertinger) each had exactly ONE
  null base stat. Root cause (RE'd): they exist only in the legacy `creature_stats.json`, and one stat
  isn't a plain small immediate the int-setter scan reads — the byte at that slot decodes to garbage
  (e.g. `0xBA000007`), so the extractor correctly records `null`. **Fix: grounded null-fill from the
  user's `Creature_REF.csv` compendium** (base-stat cols HP,Atk,Int,Def,Spd, positional parse via new
  `parseCSVRaw`); verified the filled values align with each creature's non-null code stats (Final
  Arbiter HP=30). `statSource` gains a `+ref` suffix, build logs the 14, and a guard warns on any
  residual null. 0 nulls remain.
- **#4 Creature-picker stat sort + magnitude.** New **Sort** segmented bar (— / HP / Atk / Int / Def /
  Spd / Total) in the picker; `sortCreatures` orders highest-first. `st.sort` state, `crea-sort` handler
  (resets pagination). **Magnitude (v2, per follow-up): moved off the tiles into the info-panel base-stat
  table** — a **discrete** thin track per row (`.stat-grid.single.mag`: name | 3px accent track @ 45%
  opacity | value) showing `value / roster-max` (`STAT_MAX` across all creatures) for **all 5 stats +
  Total at once**, always visible for the highlighted creature. Tiles are back to clean name-only.
- **#1 Synergy matrix leftmost column right-aligned** (`.xref-rowhead`/`.xref-corner` → `text-align:
  right`; sub-row indent flipped from `padding-left:26px` to `padding-right:14px`) so member labels sit
  against the numeric grid.
jsdom smoke: `creasort_smoke.mjs` 14/14 (null-fill + sort + bars); threats/matrix/builds/asc all green.
Shipped to `master`.
- **#2 Appendix multi-tag AND search** (like the creature selector). The single Category→Value→results
  drill-down became a **multi-tag filter**: `st.tags[]` (was `st.tag`), each picked tag becomes a
  removable `.facet.tag` chip, results match **ALL** tags (`appendixResults(tags)` AND). A **＋ Filter**
  button re-opens the drill-down (with a ‹ Results back button + the existing chips shown for context);
  already-selected tags are hidden from the pick list. Removing the last chip returns to the drill-down.
  Handlers: `appendix-tag` (push), `appendix-rm-tag`, `appendix-add`, `appendix-done-adding`. jsdom
  `appendix_smoke.mjs` 14/14 (first tag, ＋Filter re-drill, AND narrows, chip removal, empty→browse).

## 2026-09-21 — session 4k (Threats advisor — realm properties + FG runes to avoid)
New **Menu → Threats** overlay (`openThreats`/`renderThreats`). Reads the build's THEME off its
taxonomy tags and surfaces the enemy modifiers that counter it, across BOTH systems that share the
"make the fight harder" shape — **Realm Properties** (Realm-Instability modifiers, rerollable to suit
your party) and **False God Runes**.
- **New durable extract** `_su_extract/data/model/realm_properties.json` (56 shipped / 58 total,
  `code/build_realm_properties.py`, reads the extracted `codex.csv` `L_RP_*` — authoritative effect
  text; display names curated/derived since no title key exists; 2 pure-comp neutrals RACE/FAMILIES
  dropped). Runes come from the existing `runes.json` (18).
- **Theme + counter model authored in `build-data.mjs`** and emitted as `SU_DATA.buildThemes` (11
  intents = Action/Mechanic taxonomy values: Attack / Cast / Indirect / Critical / Buff / Debuff /
  Dodge / Healing / Minions / Provoke-Defend / Stat-Stacking), `SU_DATA.runes` + `SU_DATA.realmProps`
  each carrying `counters:[themeKey]` (e.g. IMMUNEATTACKS→attack, IMMUNESPELLS→cast, NOCRIT→crit,
  REDUCEDCHARGES/SEALAFTERCAST→cast, RESISTDEBUFFS→debuff) and `counterClass` for the 5
  STRONGCLASS_* props. A build-time sanity check throws on any unknown theme key. Non-counter
  difficulty modifiers are flagged `general:true`.
- **App**: `detectBuildThemes()` tallies theme weight across all build effects (reuses
  `buildTagEffects`); auto-active = themes with ≥2 effects (fallback: the single top). Theme chip bar
  shows every theme with its detected weight; clicking one switches to **manual override** (explore
  "what counters a cast build") with a ↺ Detected reset. `heavyPartyClasses()` (≥2 creatures, fusion
  adopts secondary's class) drives the STRONGCLASS counters. Two sections: **Counters your build**
  (theme/class-specific, sorted by # hits, each row = source badge + name + effect + red theme chips)
  and a collapsible **Generally punishing** (theme-agnostic). jsdom smoke (`threats_smoke.mjs`, 24
  assertions): model shape, attack auto-detect, correct counter lists (attack shows Immune/Resist
  Attacks, not spells), general toggle, manual override + reset — all green; matrix/builds/asc suites
  still green. Shipped to `master`.

## 2026-09-21 — session 4j (Ascension perks visually distinguished)
Surfaced the `perk.ascension` flag (from `Perk_REF.csv`, 41 perks, ~1 per spec) in the two perk surfaces that
weren't badging it — the **spec perk list** (`specPerkListHtml`, used by the spec detail page AND the spec
picker's info panel) and the **Customize perk picker** (`renderPerkPicker`). Each Ascension perk now shows the
same gold **"Ascension" badge** already used in the Anointments overlay (reused `.anoint-badge.asc`, wrapped
with the rank/cost meta in a `.perk-line-meta` span) plus a **subtle gold left edge** on the row
(`.perk-line.asc` / `.perk-row.asc` → `box-shadow: inset 3px 0 0 var(--accent)`). Non-Ascension perks are
untouched. Minimal-chrome honored (a small badge + accent, no sub-labels/counts). jsdom smoke
(`asc_smoke.mjs`, 7 assertions): exact badge count == data on both surfaces, `.asc` accent class present, plain
perks not badged. Shipped to `master`.

## 2026-09-21 — session 4i (BUG FIX: perk→spec misattribution)
**User-reported: Animator showed several Defiler perks (Lingering Sickness / Hopelessness / Impiety) and was
missing its own (Dark Anima / Forbidden Magic / Masterpiece / Live to Serve).** Root cause: the code-derived
membership from `scr_PerkGetPerkList` (in `specializations.json`) leaks perks between specs — it was never
reliable (the extract's own notes flag code≠CSV diffs). **Fix: drive spec→perk MEMBERSHIP from the user's
authoritative `Perk_REF.csv`** instead. `build-data.mjs` now:
- builds a clean **name→key map from the full 661-perk catalog** (`perkKeyByName`, 0 collisions) to resolve
  each CSV perk (by name) back to its code key — needed for icon/desc/stats/taxo. 4 CSV typos aliased
  (Sovreignty→Sovereignty, Wrath→Divine Wrath, Red-eye Flight→Red-eye Fight); only "Purge" [Siegemaster] has
  no catalog entry (synthesised key, no icon — 1 perk).
- groups the CSV into `csvPerksBySpec` and, in the spec loop, uses CSV membership when the spec is listed
  (641/645 perks resolve to catalog keys), **falling back to code membership only for Antiquarian** (the one
  spec absent from the CSV). Anoint/Ascension flags come straight from the CSV row for CSV-driven perks.
- re-keys perk taxonomy by perk_key (`perkTaxoByKey`) so tags follow a perk to its corrected spec (the taxo
  file was keyed `spec_id:perk_key` under the *wrong* spec ids).
Verified: Animator 16 perks ✓, Defiler 19 ✓ (curses restored), Pariah/Siegemaster ✓ — all match the CSV;
two perks now display under the catalog's canonical spelling (Divine Wrath, Red-eye Fight). Regenerated
data.js; matrix (37) + builds (8) smoke suites still green. NOTE for future: perk membership is now
CSV-sourced — a game update needs a refreshed `Perk_REF.csv`, not a re-mine of `scr_PerkGetPerkList`.

## 2026-09-21 — session 4h (Builds sort + button cleanup + backlog)
- **Dropped the build name from the Builds footer button** — the "Update «name»" button now just reads
  **"Update"** (the selected tile already shows which build it targets; no more `«»` chevrons anywhere).
- **Builds sort control** — a segmented **Sort** bar (`.ovl-filterbar` + `.seg`) in the Builds overlay:
  **Last edited** (ts desc, default), **Name** (A–Z), **Spec** (spec label A–Z, then name). `sortBuilds(list,
  mode)` + `buildSpecLabel(b)`; state `ovState.sort`; `builds-sort` handler. Tiles now render via
  `sortBuilds(builds.slice(), st.sort)` instead of the hardcoded ts-desc.
- **Backlog** grew a "New helper / reference ideas" group: Realm Property helper, False God rune helper, Realm
  reference, God shop reference, Godforge helper, spell-gem icons in the Appendix, Macro helper.
- jsdom smoke (`builds_smoke.mjs`, 8 assertions): three sort buttons, default edited order, Name order, Spec
  order, and the Update button carries no name / no chevrons.

## 2026-09-21 — session 4g (Synergy Matrix: share-status colouring vs the Spec)
Recoloured cells/columns/totals by how each tag is SHARED across DISTINCT members (not by contribution
weight): **green = shared with the Spec** (spec + ≥1 other carry it), **yellow = shared among members but NOT
the Spec**, **red = only one member has it** (solo). Added `deg` (distinct-member count) + `specHas` set in
`synergyMatrixBody`; `shareClass(k)` = red if deg<2 else green if spec-has else yellow, applied to column
dots, member cells, and the Contributions total row. Numbers still show the contribution weight; colour is now
an independent signal. Filter reverted to **"Shared only"** (deg≥2, hides red) and meta counts "shared tags".
Added a compact **colour legend** in the matrix filter bar (Spec / Shared / Solo swatches, tooltipped).
**DESIGN INTENT — do NOT "fix" the sort:** sort stays by contribution WEIGHT (not colour), so a high-weight
**red** tag (one member stacking a tag many times, e.g. Evoker's 17× "Spell Gems", shared nowhere else) sorts
to the LEFT on purpose — that's the intended *poor-optimisation alert* ("you're not synergising this"). Colour
(cross-member share) and number/sort (theme strength) are deliberately independent signals; a red-left column
is a feature, not a bug. CSS:
new `.xc-spec/.xc-other/.xc-none` (green/brass/red) for cells + `.xref-colhead .xc-dot.*` backgrounds +
`.xref-legend`; retired `.xc-dot.sh` and the old `.xc-on/.xc-active`. Sub-rows stay dim (`xc-latent`). jsdom
smoke +colour checks (37 assertions: every filled cell & column dot & total matches its column's share status).

## 2026-09-21 — session 4f (Synergy Matrix: member cells always numeric)
Small polish: member/container cells (Spec / Anointments / Creature) now always show the numeric
contribution count — **"1" for a single contributor**, higher for a stack — instead of a "●" for 1. The dot
felt out of place next to the numeric stacks. **Dots stay on the collapsible sub-rows** (each is a single
effect → a dim "•"). Dropped the `mark()` helper; member cell renders `${n}`. jsdom smoke asserts member cells
are numeric (incl. "1") and sub-rows keep the dot (33 assertions).

## 2026-09-21 — session 4e (Synergy Matrix: creatures are containers of traits too)
Carried the container model through to creatures. A creature is now treated exactly like a spec/anoint row: a
**container whose counted units are its TRAITS** (+ equipped spell-gem spells), never the creature name.
Creature rows are **expandable to per-trait sub-rows** (caret "Expand traits"), and each trait contributes +1
to its tags — so "Brilliant Creation" is what's counted, not "Animatus". A fused creature's two-parent traits
each count separately. Refactor: `buildTagCarriers` gained an `addEffect(m, label, taxo, sub)` helper used
uniformly for perks / anoints / traits / spell-gem spells; the creature branch now pushes trait/spell children
(labels = trait/spell names, sub = "trait"/"spell gem") instead of just bumping counts. Functionally the
weights were already trait-level; this makes the attribution visible and consistent. jsdom smoke +creature
checks (30 assertions: creature caret, per-trait sub-rows, sub-row labeled by trait name not creature name).

## 2026-09-21 — session 4d (Synergy Matrix: weight by individual perk contributions)
The matrix summed at MEMBER grain, so a spec stacking 11 "Attack" perks counted the same (1) as a spec with a
single Attack perk. Fixed to **count each individual effect**: `buildTagCarriers` now stores a per-member
`counts` Map (tag → # of that member's perks/traits/spells carrying it). `synergyMatrixBody` sums those into a
per-tag **weight**; **each cell shows the contribution count** (a dot for 1, the number for a stack — e.g.
Evoker's "Spell Gems" cell reads 17), the sticky bottom **"Contributions"** row totals the individual
contributions per tag, and columns **sort by weight** so the heaviest themes float left. Cells/columns are
gold when a tag has ≥2 total contributions (reinforced), green when singular; the filter chip is now
**"Reinforced only"** (≥2 contributions) and the meta reads "N reinforced tags". Per-perk/anoint sub-rows are
unchanged (each is one effect → a dim "•"). The List view already counted individual effects, so it's
untouched and now consistent with the matrix. jsdom smoke +weighting checks (25 assertions, incl. spec-cell
stack count == data and Contributions ≥ that).

## 2026-09-21 — session 4c (Synergy: collapse/expand + jump links + drop noise tag)
- **Dropped `Effect Limitation::Does not stack`** from BOTH synergy views (`SYN_EXCLUDE`/`synTags` helper) —
  it's on hundreds of traits and never indicates a synergy. Scoped to Synergy only (still present in Appendix /
  ＋Filter). Applied in `buildTagCarriers` + `buildTagEffects`.
- **Matrix: all Anointments collapse into ONE "Anointments" row** (tags = union of equipped anoints), so a tag
  on 3 anoints now counts as 1 build source in the per-tag total, not 3. **Spec and Anointments rows are
  expandable** (▸/▾ caret, `matrix-expand-row`, `st.expanded` Set) → per-perk / per-anoint **sub-rows**
  (`.xref-subrow`, dim `xc-latent` "•" marks; sub-rows are informational, not counted in the sum). Creature
  rows unchanged. `buildTagCarriers` now returns members with an optional `children[]`.
- **List: groups are collapsible** (header is a `syn-toggle` button, ▾/▸ caret, `st.listCollapsed` Set) + a
  **jump-link bar** (`.syn-jumpbar`): a chip per shared tag (value ×count) that expands and `scrollIntoView`s
  that group (`syn-jump`), plus a **Collapse all / Expand all** toggle (`syn-collapse-all`, driven by
  `st.lastShared`).
- jsdom smoke rewritten (21 assertions): noise-tag gone, single collapsed Anointments row, spec/anoint expand
  → sub-rows with latent marks, independent expand state, list collapse + collapse-all + jump-expand-scroll.

## 2026-09-21 — session 4b (Synergy: flip the matrix + merge with the list)
Two changes to the just-shipped matrix, per user:
- **Flipped the axes** so we sum the *tags*, not per-contributor tag counts. Now **rows = build members**
  (spec / anoints / creatures, each with a kind-colored `.xr-dot`), **columns = tags** (vertical labels, gold
  `.xc-dot.sh` marker on shared columns). The sticky bottom **"Members" row sums each tag** — how many members
  carry it, the actual synergy strength — with ≥2 highlighted gold. (Old layout summed per member, which the
  user flagged as the wrong thing to total.)
- **Merged Tag Synergy + Matrix into one Menu entry, "Synergy"** (`open-synergy`). The overlay opens on the
  **Matrix** view with a **Matrix / List segmented toggle** (`.seg`/`.seg-btn`, `synergy-view` action) in the
  filter bar; List is the former per-effect grouped view (description + owner). "Shared only" shows only in
  Matrix view. Split the render into `synergyMatrixBody` / `synergyListBody` returning `{body, meta}`, shared
  chrome in `renderSynergy`; `buildTagCarriers` (members) + `buildTagEffects` (effects) both retained.
- Removed the separate "Synergy Matrix" menu item and the `open-matrix` handler. jsdom smoke rewritten
  (28 assertions): single menu entry, flipped orientation, per-tag sum row, gold/green cells, shared-only,
  Matrix↔List toggle, empty state — all green.

## 2026-09-21 — session 4 (Synergy Matrix — the cross-reference grid)
Wired the long-shelved **cross-reference matrix** (the `.xref-*` CSS shipped months ago but never had JS).
It's the **grid form of Tag Synergy**, kept as a *complement* (both live in the Menu): Tag Synergy = per-effect
list with descriptions; **Synergy Matrix** = at-a-glance grid.
- **Menu → Synergy Matrix** (`open-matrix`). Columns = each build **member** (spec, every equipped anointment,
  every filled creature — each with a kind-colored dot + vertical name label). Rows = every taxonomy **tag**
  present in the build. A cell lights up where that member carries that tag: **gold (`xc-active`) = tag shared
  by ≥2 members (synergy)**, **green (`xc-on`) = unique to that member**. Sticky bottom **"Shared tags"** row =
  each member's synergy degree (count of shared tags it participates in).
- Rows sorted shared-first (degree desc), then category, then value. **"Shared only"** facet hides unique rows.
- `buildTagCarriers()` mirrors `buildTagEffects()`'s gathering but at the **member** grain (unique column ids,
  so two anoints from the same spec / two copies of a creature don't collide). Reuses `slotTraitIds` +
  spell-gem taxo, so artifact/nether-granted traits and equipped spell gems flow in.
- CSS: `.xref-wrap` made a flex scroller (sticky headers anchor to it); `border-collapse:separate` so sticky
  cells keep their borders; added `.xr-cat` (row sub-label) + `.xc-dot` kind colors. Added `.xref-wrap` to
  `SCROLLERS` so the shared-only toggle preserves scroll.
- Verified headless (jsdom, 16 assertions): columns, tag rows, gold/green cell states, sticky shared row,
  shared-only filtering, and the empty-build guidance state all green.

## 2026-09-21 — session 3 (nav/UX polish, new specs + challenge mechanics, costume fixes)
Large batch. All shipped to `master` (auto-deploy). Highlights:

**Wizard & tiles**
- Creature wizard gained a **3rd step "Customize"** (Personality / Scrolls / Skin on their own screen +
  a Creature › Fusion › Customize stepbar) so those controls aren't buried below the preview on mobile.
- Creature-selector tiles: **class-emblem icon** (top-left) + **race icon** (top-right) replace the color
  dot; **sprite sizing fixed** (absolute + object-fit so a portrait sprite like Torun 40×60 can't stretch a
  row); **"Load more"** paginates 400 at a time with no filter gate (resets on search/filter, scroll kept).

**Detail pages & navigation**
- **Creature detail**: added an **Edit** button (→ wizard) and **party navigation** — discrete chevrons that
  step between filled slots (flank the sprite on mobile, below it with "pos / total" on web).
- New **Spec detail** page (mirrors the selector info panel: animated costume + perk list) and **Anoint
  detail** page (equipped-perk list), each with an **Edit** button back to its picker. Filled tiles open the
  detail; empty tiles open the picker.
- **Creature detail stat table** broken out into **Base · Pers · Scroll · Bonus · Total** (relic confirmed
  folded into Bonus). Fixed a real bug: **Personality ±33% now applies to the PURE base**, scrolls added
  flat after (was scaling the scrolls too) — corrected centrally in `finalStats`.

**Class identity**
- Class colors re-eyedropped off the emblem icons (user-picked): Nature `#588F17`, Chaos `#8F0202`,
  Sorcery `#8747CD`, Death `#3E3E69`, Life `#F2A908` (Sorcery/Death were reversed before).

**Appendix / cards / traits**
- Appendix trait rows: material icon beside the title (mirrors perk layout), creature in its own square;
  **trait icon = the trait-item icon** (never the creature) — shows for the 399 item-only traits, omitted
  (space reserved) for creature-only "Avatar-type" traits.
- Realm cards show **"n / n / n" tier thresholds** (cards needed per effect tier, active tiers highlighted).
- `richText` now strips `[icons, N]`-style sprite-ref tokens (169 in data) that leaked next to spell names.

**Builds**: footer remapped — primary button toggles **Save ↔ Load** by selection (no accidental overwrite),
old Load slot holds **Update «build»**, Delete moved far left; labels shortened to fit mobile.

**Specs — big one (spec count 39 → 43):**
- **Antiquarian** wired in (extractor left id 43 unlabeled; it's a real full ~15-perk spec).
- **Defiler emblem** fixed — no `spec_defiler` sprite exists; `spec_occultist` IS the Defiler crest.
- **Royal / Pariah / Deprived** challenge specs wired in (2 perks each, hand-defined from the perk catalog
  because `scr_PerkGetPerkList` membership is broken for them). **Special mechanics enforced (hard-block):**
  Royal → anoint cap 5 → up to **20** (Master of All +10 / Highborn +5, by allocated perks; equips trimmed
  on spec/perk change); Pariah → party locked to **3** (slots 4-6 locked, over-cap dimmed "Ignored");
  Avatars → **1** default / **+1 per Army of Gods rank** (Fanatic 3) / **0** under Deprived (over-cap Avatar
  tiles disabled in the picker); Deprived → ignores **Relic effects** + **Fused traits** in `finalStats` /
  `slotTraitIds`. Anoint picker also **blocks anointing a perk from your current spec**.
- **Spec tier costumes** corrected for 14 specs (`SPEC_COSTUME_OVERRIDE`): Defiler=occultist stem,
  Tribalist=shaman stem; Cabalist/Cleric/Druid/Evoker/Monk/Necromancer/Paladin/Reaver/Sorcerer/Trickster/
  Inquisitor use `npc_<stem>_alt` as the player tier-1 (bare = NPC version); Hell Knight = alt only;
  Inquisitor's tier-1 was missing entirely. 43/43 specs linked, old costume warnings cleared.

**Datamine reference** updated (`_su_extract/RESUME.md` §5 + `GROUNDING_STATUS.md`): the 4 "low-confidence"
spec records are COMPLETE, not truncated (Antiquarian full; Royal/Pariah/Deprived legitimately 2 perks — an
anti-pattern vs the ~15 norm); documented the emblem quirk and the costume stem/`_alt` anti-patterns.

**Ops**: ran a full 404 sweep of all 5,841 referenced assets (local + git-tracked + live HTTP) — **zero real
404s** (transient GH-Pages throttling only). Trait-material icons 1754/1754 present.

## Alternate skins + fusion-palette research outcome (2026-09-20)
**Alternate skins SHIPPED.** Creatures can wear a cosmetic skin, offered strictly by its **code-grounded
restriction** (`scr_DatabaseSkins`: race-restricted skins fit any creature of that race; creature-restricted
skins fit one specific creature via `locked_creature`). `build-data.mjs` emits `SU_DATA.skins` (743 applicable
= 586 race + 157 creature; 91 unresolved dropped, no fallback) and exports the battle frames to
`assets/skins/<frame>.png` (from `spr_crits_battle_<frame>`, all present; 404-guarded). App: skin picker in the
creature wizard's Customize panel (only restriction-allowed skins + a Default tile), stored as `slot.skinId`,
rendered in slot / wizard preview / detail; kept across creature changes only if still allowed. 1268/1362
creatures have ≥1 applicable skin.

> **SUPERSEDED 2026-10-01:** fusion palettes and skin owners were both cracked from static code. See the
> 2026-10-01 night-4 section: items 7 (fusion, pixel-exact) and 12 (skin owners, all 834). The analysis below is
> kept for history.

**Fusion palette — researched, NOT shipped (deliberate).** Deep dive (3 Ghidra decompile passes + 5-pair
pixel-exact ground truth) concluded the in-game fuse recolour is **not reproducible from static data**: it is a
runtime GPU palette-swap (`FX_PaletteSwap`) whose grey/body/accent ramp clustering is computed by VM-dispatched
setters + a shader sample (not in static code). The 6 "Appearance options" = `scr_SetFusion(MODE 0..5)`, MODE 0
untinted; `field_0738`/`field_1df8` are the creature's **race id / skin index** (NOT stored base/accent colours
— that premise was falsified). Best static-grounded reconstruction ~82% (one hand-tuned pair); best empirical
clustering ~44% across 5 pairs. Only remaining path to pixel-exact = live GM-var-manager read of the 4
working-palette globals per fuse (fragile, rejected as disproportionate for cosmetics). Full write-up +
5-pair dataset: `_su_extract/code/FUSION_MODEL.md`, `data/model/fusion_ground_truth*.json`. The app shows the
untinted primary sprite for fused creatures (a real in-game option); no guessed recolour is shipped.

## v2.20c personality = flat ±33% on base (final, per user) (2026-09-18)
Simplified per user: drop the whole level lens (slider/number field/`previewLevel`/`renderLevelBar`/all
handlers + CSS) and just apply a **flat modifier to the base stat** — raised **×4/3 (+33%)**, lowered
**×2/3 (−33%)**, others unchanged (this is the end-game converged value; SU personality raises one stat's
growth to 40 vs 30 neutral → 40/30 = +33%). `persRatio(slot,k)` + `finalStats(slot)` (no level param);
`final = round(base×persRatio×artifact%)`. The **↑/↓ arrows are kept** on the raised/lowered stats
(tooltips "Personality +33% / −33%"); no other chrome. Party summary "Party" again; detail back to
Base·Artifact·Total. jsdom-verified: raised ×4/3, lowered ×2/3, neutral unchanged, arrows present, no
level chrome. (Supersedes v2.20/v2.20b level-projection takes.)

## v2.20 anoint spec filter · no self-fusion · personality + scrolls (2026-09-18)
1. **Spec filter on Anointments** — a `Spec ▾` facet next to the ＋ Filter tag chips; opens the shared facet
   picker (`anoint-spec`, list = specs that have anointments), applies a chip, narrows the grouped list.
2. **No self-fusion** — the fusion step now excludes the primary creature from the list
   (`creatureMatches`: `step==='fusion' && c.id===primaryId → false`), so a creature can't be fused with itself.
3. **Personality + Scrolls in the creature wizard** (fusion step's right panel = fusion preview + a Customize
   section). Data from `build-data.mjs`: `SU_DATA.personalities` (20, codex `L_CODD_CREATURES_*_PERSONALITIES`;
   each raises one stat's growth to 40% / lowers another to 20%) + `SU_DATA.scrollMax=15`.
   - **Scrolls** (`L_ID_SCROLL_*`): +1 **base** stat each, max 15 total; folded into `baseStats` (artifact %
     applies on top). Per-stat steppers with a running `N/15`; stored `slot.scrolls={hp,atk,…}`.
   - **Personality**: grouped picker (by raised stat); stored `slot.personality`. Picker + storage introduced
     here; the stat effect went through a few models and **settled in v2.20c: a flat +33% raised / −33% lowered
     on the base stat** (see that entry — it's the current behavior; the interim level-projection built here was
     removed). `baseStats()` stays personality-free (only scrolls fold into base).
   - Slot schema gained `personality`/`scrolls` (migrated in place); editing a creature reopens the wizard
     prefilled. Verified via jsdom (78 assertions, 0 errors).

## v2.19b anointment rank validated in code → render at rank 1 (2026-09-18)
Validated against the decompiled exe (Ghidra, `_su_extract/code/anoint_decomp/`) whether a multi-rank
perk grants its full effect from one anoint. **It does not — an anointment applies the perk at RANK 1.**
Chain: `scr_AnointmentToggle` is a boolean list toggle; `scr_AnointmentUnlocked` (boolean) is UI-only;
battle reads `scr_PerkLevel` from caches built by `scr_PerkLevelsUpdate`, which applies each anointed perk
with the literal 1.0 and **never** fetches a per-perk max-rank count (zero calls to scr_DatabasePerks /
scr_PerkGetNextPerkCost / scr_PerkAddPoints across the whole anoint→level pipeline). Full finding in
`_su_extract/code/SIGILS_ANOINTMENTS_FINDINGS.md`. App fix: `renderAnoint` was over-stating multi-rank
anointments (`perkText(desc, a.ranks)`); now renders `perkText(desc, 1)` and shows an `R1` badge (tooltip
"Anointments apply this perk at rank 1") instead of the misleading `N×` badge.

## v2.19 spell text, anointment equipping, artifact search fix (2026-09-18)
1. **Spell descriptions now render bolded plain text** — the spell-gem builder's spell picker was
   showing raw `{TOKEN}` params (`esc(desc.slice(0,80))`); it now uses `perkText` (richText + CONDDESC
   strip) in a rich two-line row (name over a clamped effect line), matching the perk visual language.
   Artifact trait/spell previews also switched to `perkText` (bold params + no `{CONDDESC_*}` appendix).
2. **Perk visual language carried to spells + material items**: new `.prop-row.rich`/`.prop-body`/
   `.prop-sub` (name-over-effect, bolded `.param`, 2-line clamp).
3. **Fixed the enormous artifact-wizard search box** — the side panel is a column flex, and `.ovl-search`'s
   base `flex:1` was stretching the input vertically. Added `.art-side .ovl-search.art-side-search
   { flex:0 0 auto; width:100%; max-width:none }`.
4. **Anointments are now equippable into the build** (was a read-only viewer). New persistent
   `build.anoints` (`[{specId,key}]`, cap **5** = the in-game limit). Each anoint row has an Equip/Equipped
   toggle (disabled at cap), the footer shows `N/5 equipped`, the home Anointments tile shows the count,
   and the tag-filter chips still apply. `anointList()` now carries `specId`; helpers `anointEquipped` /
   `equippedAnointObjs`. Verified via jsdom (62/62).

## v2.18 spec costume-animation audit + fix (2026-09-18)
The spec info-panel animates one costume per tier; it should be exactly the 3 canonical tiers
(3 cycles / 6 frames). Audited all 39 specs and found **16** off — the grouping was sweeping in
`_alt`/`_robe`/`_minotaur` variants and legacy `ospr_*` duplicates (Reaver showed 4 cycles: 3 real
tiers + a stray `_alt`), and one spec (Inquisitor) hit a count of 3 with a *wrong* composition
(tiers 2/3 + alt, no tier-1). Root cause: tier naming is inconsistent across specs — canonical
`npc_<stem>_1/_2/_3`, numbered `npc_<stem>01/02/03`, and suffix `npc_<stem>`(bare = tier 1) + `_2/_3`.
`build-data.mjs` now derives a tier number per costume record, keeps only tiers 1/2/3 (one per tier,
preferring an explicit tier over the bare-stem fallback), and drops variants + `ospr_*`. Result:
**36/39 specs animate exactly 3 cycles.** The 3 remaining are honest extraction gaps (verified — the
tiers don't exist in the game data): Inquisitor ships only tiers 2/3 (no tier-1 → 2 cycles);
Defiler/Tribalist ship only an `_alt` costume (1 cycle). Those emit a build warning. Reaver is now
`npc_reaver / _2 / _3` (3 cycles). The unused per-tier animation frames for the dropped costumes were
removed from `assets/wardrobe/`; the full 820-costume wardrobe set stays in `SU_DATA.wardrobe` for a
future costume picker.

## v2.17 UX pass — perks, creature wizard, artifact socketing (2026-09-18)
Eight-item punch-list from the user, verified via jsdom smoke (38/38, 0 errors).
1. **Perk rows standardized** in both the spec info list and the Customize picker (and the Anointments
   list): fixed-icon + a head line (`<b>name</b>` ↔ right-aligned rank/cost meta) + desc block. Replaced
   the old `float:right` cost (which drifted with name length) with a flex header — rows are now uniform
   regardless of name length or point value. Structure: `.perk-line-body/.perk-line-head/.perk-line-meta`
   and `.perk-row-head/.perk-meta`.
2. **Dropped the CONDDESC bloat.** 103 perk/anoint descs append the referenced condition's full tooltip
   (`\n\n{CONDDESC_*}`/`{CDESC_*}`), which blew up rows. New `stripCondDesc()` + `perkText()` remove that
   appendix; perk/anoint text is now effect-only.
3. **Removed placeholder banners** ("Select a specialization/creature/relic" info-panel stubs, which render
   at the bottom on mobile) + trimmed the home "Party stat overview (after fusion + artifact)" → "Party".
4. **Creature selector info panel leads with the innate trait**, then base stats; **dropped the per-tile
   base-stat total** under every creature tile.
5. **Creature selection is now a guided wizard**: 1 · Choose creature → 2 · Fusion partner (or a first-class
   "No fusion" tile) → Commit. Editing a filled slot re-opens the same wizard pre-filled so either half can
   change (the slot's "Fuse" button became "Edit"); the fusion step shows a live averaged-stats + both-traits
   preview. `openCreaturePicker(slotIdx)` now stateful (`step/primaryId/fusionId`).
6. **Centered the ✕ buttons** (`.ovl-close/.slot-remove/.as-rm`) via flex centering + padding:0 (the glyph
   sat slightly right).
7. **Artifact builder uses an info panel** (right `.ovl-right.art-side`) instead of appending the picker to
   the bottom of the scroll: default = live-bonus; tap a slot → filterable picker; **search matches name OR
   tag** (taxonomy value names, for trait items/spell gems).
8. **Socketing no longer applies silently** — tapping an item opens a preview showing its effect with an
   explicit **Add to artifact** / **Remove from artifact** confirm (`art-preview` → `art-confirm-add`).

## v2.16 taxonomy → spells + perks (2026-09-18)
Extended the per-item classification to the last two surfaces (user: "keep going"). SPELLS (747/747, 5015 tags):
spell-specific rubric (actions not triggers; self-categorize Damaging/Healing/Single/Multi-Target/element) →
`spell_taxonomy_tags.json`; ＋Filter on the spell-gem builder's spell picker (reuses the facet drill-down via
source-aware `taxoIndexFor`/`openFacetPicker(kind,{idx,onPick})`). PERKS (599/600; 1 empty = out-of-combat
drop-rate perk): trait-like rubric → `perk_taxonomy_tags.json` (by `spec_id:perk_key`); INLINE Category→Value
filter in the perk picker (it's a detail overlay, can't nest the facet). Generic `_su_extract/code/aggregate_surface.py`.
Verified jsdom: spell Related Debuff→Burning 300→29 (29/29 correct), perk 15→4, 0 errors.

## v2.15 taxonomy → artifact trait-items (2026-09-18)
Trait-slot materials inherit their granted trait's full taxonomy (exact `traits[trait_id].taxo` join in
build-data.mjs; traitName↔trait.name 0 mismatches / 1775; 1745/1790 tagged). ＋Filter drill-down added to the
artifact-builder trait picker. Generalized `taxoIndexFor(key,items,getTags)` + `openFacetPicker(kind,{idx,onPick})`
so surfaces share the picker (creature picker unchanged). Verified Related Debuff→Poisoned 300→40, 40/40 correct.

## v2.14a/b/c agent-note review, vocab expansion, boss/NYI backend (2026-09-18)
- **Corrections** (reproducible in `aggregate_taxonomy.py`, keyed by id/desc): dropped Peace-family
  debuff-immunity mis-tag; added once-gate repeating triggers; class-FILTERED-damage keeps Take Less Damage but
  drops erroneous Change Class; Blessing From Below + Pact of the Gods remapped to user spec; 4 mis-flagged-as-flavor
  traits fixed (Angry Army, Who Am I? None, Seethe, Torun).
- **Vocab expanded** to full referenced rosters (158 races → Related Types; all `[icons]` spells validated vs
  canon; +Littletorun/Illusion minions). UI hides values with no member trait.
- **Boss/NYI backend**: 15 boss/god flavor traits mapped from the (noisy) code decode with enemy-actor triggers
  (`trait_meta.scope=boss_enemy_flavor`, "verify in-game") for a future boss-prep planner; 10 NYI traits flagged
  `scope=nyi` "recheck on game update". All 25 are non-playable → absent from the live filter; correction: earlier
  "no effect" was a description read, NOT code-validated (several DO carry coded effects).

## v2.14 full per-trait taxonomy (all 24 categories, triggers + ally/enemy) (2026-09-18)
Per user direction ("do the hard labor, resolve each trait independently"), classified every trait's
description individually against a fixed codebook (`_su_extract/code/TRAIT_CLASSIFICATION_CODEBOOK.md`) —
21 parallel agents, ~100 traits each, reading each description on its own merits (the localization wording
is inconsistent, so per-trait reading beats regex). Aggregated + validated every emitted tag against the
fixed vocabulary (`code/aggregate_taxonomy.py`, 5/12,556 invalid dropped), merged with the token-exact
Related-* tags.
- Result: **all 24 categories now populated** (was 9), incl. Activates When/at WITH Ally/Enemy actor
  direction, Affect-on-X, Active If, Multiplied by. 2,187 traits, 13,933 assignments.
- Correct: Alcoholism → Enemy is Debuffed + Send to Bottom; Reinvigoration → Ally Attacks; Seize → Enemy Dodges.
- Verified via jsdom: 24 categories shown, Activates When has all 34 Ally/Enemy values, Enemy Dodges filters
  400→10 (10/10 correct), 0 JS errors.
- The RE detour (why the code couldn't back this) is preserved in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`;
  the actor mechanism (crit-arg source) corroborates the classification's Ally/Enemy calls.

## v2.13 tag taxonomy re-grounded on the game's structured markup (2026-09-18)
User flagged erroneous filter output (e.g. Alcoholism tagged "Attack"). Root-caused it to the code-effect
layer, then did a full battle-interpreter RE in Ghidra (all logged in `_su_extract/code/TRAIT_EFFECT_DECODE_FINDINGS.md`):
- Fixed a real block-slurp bug in the trait-handler extractor (`SuTraitOperands2.java`; 43,751→~1,000-token blocks).
- **Definitive finding:** SU stores NO structured trigger/effect metadata — behaviour is defined by each
  trait's authored `description` and executed by scattered opaque `if(hasPassive){…}` code that doesn't
  encode the trigger (verified via disasm, decompiler control-flow, and the passive DB itself). So the
  handler decode caps at ~30-60% precision and can't back a trustworthy filter.
- **Rebuilt `build_taxonomy_tags.py` to ground on the game's own structured description markup**
  (`{CONDNAME_}/{STAT_}/{RACE_}/{CLASS_}/{ACTION_}/{TIMELINE}/{SPELL_}`) + unambiguous keywords +
  random-collapse. Every tag is correct-by-construction. Fixes the errors: Alcoholism → Timeline only;
  Black Hole Halo → Scorned (tokens even corrected a wrong condition-id decode).
- Coverage: 2,008/2,187 traits tagged; 9 of 24 categories are token-groundable and shown (Related
  Buff/Debuff/Minion/Stat/Types, Action/Mechanic, Related Trait, Effect Limitation). The 15 trigger-direction
  / effect-magnitude categories are honest gaps (prose-only) — hidden in the picker, marked `status:gap`.
- Verified via jsdom: Related Debuff→Poisoned filters 400→27 with 27/27 correct, 0 JS errors.

## v2.12 human tag taxonomy → Category→Value trait filter (2026-09-18)
Conformed the trait tag layer to the user's authored 24-category taxonomy (broad condition → specific
segment). New pipeline in `_su_extract`:
- `code/build_taxonomy_tags.py` maps each trait's **code + structured-token** signals onto taxonomy
  values (code-grounded only; no prose-mining) → `data/model/tag_taxonomy.json` (canonical taxonomy +
  per-value status) + `trait_taxonomy_tags.json` (per-trait `[{cat,val}]`). Doc: `data/model/TAG_TAXONOMY.md`.
- Coverage: **2107/2187 traits tagged, 14,583 assignments; 197/337 values covered, 140 gaps** — gaps
  cleanly classified `actor-split` (all `Enemy …` variants) and `desc-only` (magnitude/direction, "for-each"
  counts, named spells). Flagged for a future controlled prose pass; kept out so data stays code-certain.

App: `build-data.mjs` bundles `SU_DATA.taxonomy` + `traits[id].taxo`. The creature/fusion picker's flat
"＋ Tag" facet was replaced with a two-level **＋ Filter** drill-down (Category → Value, back button,
multi-filter AND). Empty values hidden; counts computed but never shown (minimal-chrome). Verified via
jsdom smoke test: 400→54 on Related Debuff→Poisoned (54/54 correct), 54→28 when AND-ed with Attack, 0 JS errors.

## v2.11 artifact material model + icon/align fixes (2026-09-17)
Four fixes from the user's punch-list:
1. **Trait slot no longer shows trick materials.** `traitItems` was built from *every* material with a
   `trait_id` — which swept in the 47 Slates/Curios/Cripplers (`item_class:1`, they carry a status trait_id).
   `build-data.mjs` now `continue`s on `item_class === 1`, so the Trait picker holds only real trait mats
   (`item_class:2` + the 5 `item_class:null`-with-trait_id strays). Trait pool 1830→1790.
2. **Stat & Trick slots are now real material pickers** (user chose "Real material pickers"). The item_class
   split drives three artifact material pools, each mapped 1:1 to its property:
   - **Stat = Ambers** (`item_class:null`, no trait_id; 15). Map onto the 15 unique Stat properties **by db
     order** (Red→Attack, Purple→Defense, …, Bold→Attack/Defense, …, Shiny→Intelligence/Speed — verified:
     exact count match, Amber field1 runs singles then double-combos in artifacts_ref order). `SU_DATA.statMats`.
   - **Trick = Slates/Curios/Cripplers/generics** (`item_class:1`; 47). Mapped **by name** (perfect 47↔47,
     0 gaps/dupes): `Curio of Poisoning`→"Poisoned On Damage", `Life Crippler`→"Life Strength", 6 generics
     (Whetstone→Attack Damage, Arcane Sigil→Spell Potency, Jagged Rock→Critical Chance, Slippery Stone→Dodge
     Chance, Armor Scrap→Damage Reduction, Pump Drill→Spell Gem Slots) via explicit dict. `SU_DATA.trickMats`.
   - All 15+47 materials have icons (copied to `assets/maticons`). **Slots still STORE the property name**, so
     `artifactPctOf` + old-artifact migration are untouched; the picker/slot-chips resolve the material via
     `MAT_BY_PROP` (property→material) to show its real name + icon. app.js: picker rows, `filledBox`, name-step
     chips switched to materials.
3. **Creature-selector stat table realigned.** `renderCreatureIdentity` reused the wide detail `.stat-row`
   grid (`1fr 60px 60px 68px`) with the single value merged `grid-column:2/5` — in the 260/210px `.ovl-right`
   that squeezed the name column to ~40px (0/overflow on mobile), throwing the values off. Added
   `.stat-grid.single .stat-row { grid-template-columns: 1fr auto; }` and dropped the merge span.
4. **Spell-gem property icons cleaned.** All 21 hand-cropped Enchanter icons carried a stray fragment in their
   trailing columns (grey UI-border bars; bright-green XP-bar bits on Agate/Sapphire), separated from the gem by
   a wide transparent gap. Cleaner crops each at its widest ≥3px zero-run and tight-bounds the result (source
   `_su_extract/assets/spell_gem_property_icons/*`, dirty originals kept in `*_dirty_bak`).
   **ONYX recovered (21/21):** its v2.10 crop was botched into a partial fragment; the raw menu column survived
   as the prior session's `iconstrip.png` (176×2348, Agate→Opal alphabetical), so ONYX was re-cropped from band
   17 (a dark navy obelisk w/ silver crown) and downscaled ×0.5 (NEAREST) — the same scale every sibling used
   (each was ~½ of the same strip). Source screenshot itself wasn't bad; only the original crop was.

## v2.10 taxonomy fix + wizard polish (2026-09-17)
- **Spell-gem enchant items corrected**: they are the **"Dust" items** (`L_IN_DUST_<gem>`: Jasper, Topaz, Citrine…
  21) whose effect (More Charges, Defense Penetration, Cascading…) comes from `L_ID_DUST_<gem>` — used at the
  Enchanter. `SU_DATA.spellProps` now = these 21 dusts (name + effect). (Slates/Curios are TRICK items, Ambers are
  STAT items — noted for future artifact re-model.) NOTE: per-gem dust icons aren't in the sprite set by name and
  aren't code-tagged (dust defined in an unnamed vm_group region with no sprite immediate) → using a shared
  gem-dust icon for now; flag to revisit if the icon source surfaces.
- **Picker scroll fixed** (#1/#4): inline slot pickers used a nested `.ovl-center-scroll` that collapsed to 0 height
  (couldn't scroll; artifact `+` looked like it only highlighted) → dedicated bounded `.art-pick-scroll`.
- **Spec/anoint tiles**: shorter again (fixed 44px icon; keep creature-card width).
- **Mobile**: artifact wizard tiles shrunk so the build fits without scrolling.
- **Nether wizard → category flow** (#6): `+` → choose category (Stat / Trick / Trait / Spell) → picker, mirroring
  artifacts. Prop model now `{cat,key,value}` (stat/trick carry %, trait/spell are item refs); migrated from
  `{prop,value}`. `artifactPctOf` only sums stat/trick nether props into the stat table.

## v2.9 spell gems as first-class entities (2026-09-17)
Per user: artifacts, nether stones, and spell gems are three SEPARATE buildable entities. A **spell gem = 1 spell
+ up to 3 property items** (Slates/Curios/Cripplers = the `item_class:1` materials, 47, `SU_DATA.spellProps` w/ icons).
- **Spell Gems library + wizard** (new top-bar "Spell Gems" button; `subc.spellgems`): step 1 pick spell (class
  gem icon) → step 2 add ≤3 property items + name. Library tiles show the class gem + spell + prop count.
- **Creature spell slots**: new per-creature "Spells" action (alongside Fuse/Artifact/Relic) equips up to 3 spell
  gems (`slot.spellGemIds`, cap 3; "modifiable by trait/perk" noted, cap fixed at 3 for now). Manual/trait cast.
- **Artifact spell slot** now equips a built spell **gem** (not a raw spell); auto-triggers per artifact kind.
  `artifact.spells` migrated (old raw-spell ids cleared). Deleting a gem unequips it everywhere.
- Data: `spellProps` (47 property items) added to pipeline w/ material icons.

## v2.8 nether wizard + spell gems (2026-09-17)
- **Spell-gem class icons** (from prior): spells carry `cls` (spells_ref, fuzzy-fixed 747/747); artifact spell
  slot + picker show the class-coloured gem.
- **Spell WIZARD deferred** (user choice): the spell-gem property list needs a decompile pass (no clean loc tags);
  kept the existing spell picker in the artifact slot rather than ship a redundant wizard.
- **Nether stone builder → library + stepped wizard** (user: "wizard + full property pool"): `openNether` is now a
  library (tiles + Build new); `openNetherBuilder` is a 2-step wizard (gem+name → properties). Properties now draw
  from the **full artifact property pool (stat + trick), unrestricted** — each = `{prop, value}` (property name +
  user-entered %). Old nether props (`{type,stats[]}`) migrated to flat `{prop,value}`. `artifactPctOf` resolves
  each nether prop via `propGroups` (core-stat props add to the stat table; trick props display only, like artifact
  tricks). `netherSummary` + input handlers updated; removed the old single/double stat builder.
- **Home tiles mirror creature-card width**: `.home-top` uses the party grid (2/3/6 cols); spec + anoint tiles
  are vertical cards. **Reverted the spec-selector centering** (was fixed-width flex → shrank icons; back to the
  original `auto-fill`/`repeat(5,1fr)` grid so icons are full size). **Dropped the per-spec chips** from the
  Anointments overlay (search + grouped list only).
- **Chrome sweep**: removed feature-explanation footers, asset/match/active counts, wizard instructional hints.
- **Artifact = fixed slot template (user ground truth):** 1 Primary + **3 Stat · 2 Trick · 1 Trait · 1 Spell ·
  1 Nether** (nether has its own internal rules but the artifact holds exactly 1). Model reshaped to
  `{primary, stat[], trick[], traits[], spells[], netherIds[]}` with per-type caps; **old artifacts migrated**
  in place (`props[]`→stat/trick by group, `traitItemIds[]`→traits[0..1], nether capped to 1). `artifactPctOf`
  sums `stat`+`trick`. **Spell data added** (`SU_DATA.spells`, 747 from catalog; `cls` joined from `spells_ref.json`, 745/747).
  **Spell-gem icons are generic + class-coloured** (not per-spell): `gem_<colour>_lvl4` mapped to class by pixel
  colour — Nature=nature, Chaos=chaos, Sorcery=sorceryB(blue), Death=sorceryP(purple), Life=lifeG(gold) →
  `assets/spellgems/<class>.png`, `SU_DATA.spellGems`. Spell slot + picker show the class gem.
  Wizard step 2 now shows the **fixed slots in order by type**
  (Primary → Stat → Trick → Trait → Spell → Nether); each empty box opens a type-filtered picker, enforcing the
  counts by construction.
1. **Header** stacks: title over the action buttons (topbar `flex-direction:column`).
2. **Artifacts button** in the header → global artifact library in *manage* mode (`openArtifactLibrary(null)`;
   no equip, just edit/delete/build).
3. **Spec grid centered**: `.spec-grid` is now centered flex-wrap so the last partial row centers.
4. **Anointments** — button next to the Specialization tile → browsable overlay (search + per-spec chips, grouped
   list w/ perk icons, rank-scaled descriptions, Ascension badges). Data comes from the user's
   `_su_extract/data/reference/_raw_csv/Perk_REF.csv` (`Annointment`/`Ascension` columns): `build-data.mjs` joins
   it to perks by name+spec (99%, `perkFlags()`, Grovetender→Herbalist alias) and sets `perk.anointment` /
   `perk.ascension`. 570 anointments, 11 ascension; 6 perks not in CSV → default false. (Avoids the
   `scr_AnointmentsListBySpec` decompile — the user vouched for CSV accuracy.)
5. **Highest-tier artifact icons**: `ART_ICON_SRC` → helmet_6/sword_6/staff_5/shield_6/boots_5.
6. **Artifact modal → 3-step wizard**: (1) pick artifact type (hi-tier icon tiles + rank), (2) fill slots one
   at a time (add-menu → inline picker for property/trait/nether, each slot shown as an icon tile w/ remove),
   (3) name + live-bonus preview + save. Reuses the existing toggle handlers; editing jumps to step 2.
7. **Trait-item icons**: new `_su_extract/code/extract_material_icons.py` merges `scr_DatabaseMaterials`/`2`/`3`
   (tagged sprite immediates, same trick as perk icons) → `data/model/material_icons.json` (1841 mapped, 99%
   of trait-materials). Pipeline copies to `assets/maticons/<sprite>.png`, sets `traitItem.icon` (1817/1830).

## v2.5 spec selector: emblems + animated costume (2026-09-17)
- **Selector grid now uses the 16×16 `spec_<key>` emblem for every spec** (`spec.emblem`; aliases
  Rune Knight→`spec_deathknight`, Sorcerer→`spec_sorceror`; Defiler has no 16×16 emblem → falls back to its
  themed sprite). 38/39 real emblems.
- **Info panel shows the WARDROBE costume instead of the icon**, and **animates it**: front-facing 2-frame
  walk (costume frames 0,1 — verified 0↔1 is the closest-matching pair = same/down direction), alternates 8×
  then advances to the next tier and cycles. `syncSpecAnim()` (280ms) clears/restarts on every spec-picker
  render (open/select/search) and on close. Pipeline copies frames 0,1 per tier → `spec.costumes[i].frames`.
- NOTE: "front-facing" frame indices (0,1) are a best-guess from pixel-diff; confirm visually.

## v2.4b wardrobe names + tiers + Grovetender (2026-09-17)
- **Grovetender resolved:** it ships internally as **"Herbalist"** (`vocabulary.csv` `L_HERBALIST` == "Grovetender"),
  so `npc_herbalist_1/2/3` ARE Grovetender's 3-tier costumes. All 39 specs now link (was 38).
- **All 3 tiers per class grouped:** `spec.costumes = [{tier,sprite,img,variant}]` (tier 1/2/3 + `_alt`/`_minotaur`
  variants). Every class has a 3-tier set (incl. Pariah & Deprived).
- **Names from localization (backend, in `wardrobe.json`):** each costume carries `name` + `name_source`:
  **145 class_vocab** (spec/class display name, authoritative) + **307 L_WD** (`L_WD_*` in `items.csv`, e.g.
  Cosmic Cat, Void Queen) + **368 derived** (title-cased stem — mostly `ospr_` denizen costumes whose `L_WD` key
  is semantic, not sprite-derived; would need deeper code pairing to reach 100%). Resolution now lives in
  `extract_wardrobe.py` so `wardrobe.json` is self-contained; `build-data.mjs` just copies PNGs + groups tiers.

## v2.4 wardrobe backend (2026-09-17) — data only, no UI yet
- **Clarified: the current spec "skins" are ICONS.** They come from `spec_<class>_<spec>_<theme>` 32×32
  single-frame sprites (the decorated spec-select emblems, e.g. `spec_death_necromancer_necronomicon`),
  not player costumes. Kept as-is for now (still labeled spriteKind `skin`/`icon` in `findSpecSprite`).
- **Extracted the real player WARDROBE (every costume), code-certain.** `scr_WardrobeSprite` returns each
  costume's overworld sprite as a tagged immediate (`spriteAssetIndex + 0x1000000`). New durable extract
  `_su_extract/data/model/wardrobe.json` (**820 costumes**, all 32×32 animated 8-frame, 0 missing PNG) via
  `_su_extract/code/extract_wardrobe.py` (capstone; `PYTHONSAFEPATH=1`). Categories: 43 specialization/class,
  597 npc, 142 master (`master_<family>`), 26 creature, 12 animal.
- **Pipeline pulls ALL 820 costume PNGs → `assets/wardrobe/<sprite>.png`** and emits `SU_DATA.wardrobe`
  (sprite/key/label/category/frames/order/img). Each spec is joined to its own costume via
  `spec.costume` (`npc_<slug>` variants / `TS_SU_Costume_<spec>` / `*_overworld`): **38/39** linked —
  Grovetender genuinely has no wardrobe costume in the game data. **No UI yet (per request — backend first).**

## v2.3 perk icons (2026-09-17)
- **Every perk now shows its real in-game icon (600/600, code-certain).** Name-based sprite joins topped
  out at ~88% (three naming schemes: base-15 `<class>_<spec>_<perk>`, modern `<spec>_<perk>`, and
  `perks_`/`perk_`) and could never resolve codename specs (e.g. Monk's Japanese `nature_monk_kaze`).
  Solved at the source: each perk's icon is stored in `scr_DatabasePerks` as a **tagged immediate**
  (`spriteAssetIndex + 0x1000000`); the non-zero tagged value per block is the icon (the other, 0, is a
  constant `__ppf_spr_ui_checkbox`). New durable extract: `_su_extract/data/model/perk_icons.json`
  (661 perks, 0 ambiguous) via `_su_extract/code/extract_perk_icons.py` (capstone; run with
  `PYTHONSAFEPATH=1` — a local `signal.py` shadows stdlib). Validated: the extracted index matched the
  name-join sprite for all 487 name-matchable perks.
- Pipeline copies 600 perk PNGs to `assets/perks/<KEY>.png` (`build-data.mjs`, `perkIconByKey`); `data.js`
  carries `perk.icon`. UI shows the icon in the perk picker rows (32px) and the spec info perk list (20px).

## v2.2 perk ranks (2026-09-17)
- **Perks now have levels.** Data already carried `ranks` (max levels) per perk; the UI ignored it. The perk
  picker's binary on/off toggle is replaced by a **rank stepper** (`− rank/max +` plus **Max** / **0**),
  so each perk allocates 0..maxRanks. `build.perkAlloc[specId][key]` changed from a binary de-allocation map
  to an **allocated rank count** (absent key = fully allocated = maxRanks). **Schema 2→3 migrated in place**
  (old deallocated keys → rank 0) so the current party/spec survives.
- **`<N>` scaling values render.** Perk descriptions carry `<N>` = the **per-rank increment** (e.g. Anguish
  Through Awareness `<1>`, 5 ranks → "starts battles with **5** random buffs" at max; **0** if unallocated).
  `richText(str, rank)` now substitutes `<N>` → `N × rank` (handles decimals: Perseverance `<2.5>`×20 = 50%,
  Anemia `<5>`×20 = 100%). 220 perks carry `<N>`; combined `<N>` + `{TOKEN}` render cleanly with no leaks.
- Spec info panel + home spec tile now show **allocated/total perks · points** (points = Σ cost×rank).
- Bonus: `richText` converts literal `\n`/newlines → `<br>` so multi-paragraph perk text reads correctly.

## v2.1 validation (2026-09-16) — closed the loop
Re-verified both v2.1 fixes after an interrupted session (commit `7bd676c`, already pushed/live):
- **Spec skins**: `data.js` = 30 `skin` + 9 `icon`, 0 specs missing a sprite. PNG dims confirm the copy
  (animator/sorcerer/bloodmage = 32×32 real skins; the 9 fallbacks = 16×16 emblems). Icon-fallback set:
  Toxicologist, Shadowbringer, Mime, Graveborn, Demonologist, Engineer, Gladiator, Brewmaster, Mesmerist.
- **Plain-language tokens**: scanned all **3556** game-text fields (traits/specs/perks/cards/relics) through
  `richText()` → **0 raw `{TOKEN}` leaks**. 155 distinct token types: 67 resolved via the shipped 82-term
  `terms` map, 88 via the prefix-strip/title-case fallback. `app.js` + `data.js` syntax/load clean.

## v2.1 fixes (2026-09-16)
- **Parameter text → plain language + bold.** Perk/relic/card/trait text still carried raw `{ACTION_*}`,
  `{STAT_*}`, `{CONDNAME_*}`, `{RACE_*}` tokens (and `[icon]` refs). Ship `SU_DATA.terms` from the extract's
  `labels.json` (82 terms) and add `richText()` in app.js: `{TOKEN}` → plain word wrapped in `<b class="param">`
  (bright/accent), `[icon]` dropped, rest escaped. Applied to all game-text fields. No raw tokens leak.
- **Real specialization skins.** The `spec_<key>` sprites were 16×16 *emblem icons*, not skins. The actual skins
  are the 32×32 player-costume sprites (`spec_<class>_<spec>_<theme>` + animated `TS_SU_Costume_<Spec>`). Pipeline
  now prefers those: **30/39 specs get the real 32×32 skin**, 9 (Mime, Toxicologist, Gladiator, …) fall back to the
  emblem icon (no skin ships for them). `spec.spriteKind` = `skin`|`icon`.

## 2026-09-16 — Current state snapshot (historical; moved from Progress.md 2026-10-08)
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


## v2 rework (2026-09-16) — big feature batch
- **Spec**: home spec tile shrunk to a small chip; selector labels dropped; alpha-sorted, ≥5/row on mobile;
  info panel enlarged with the skin sprite above the name, playstyle, and a perk list; **Customize** button
  opens a perk selector (all perks allocated by default, click to deallocate; allocate/deallocate-all).
  `build.perkAlloc[specId]` stores only deallocated keys.
- **Creature filters**: class chips replaced by faceted **Class / Race / +Tag** buttons opening sub-selectors;
  each +Tag added leaves a fresh +Tag so multiple synergy-edge tags AND-narrow the list (tags = the innate
  trait's produces/consumes edge tokens, 112 options).
- **Cards**: large tiles with representative art (family→creature-race sprite on a class-tinted bg), all 3
  effect tiers shown, and a 0–3 **level stepper** (default max). `subc.cards.levels`.
- **Nether stones**: rarity removed; centered overlay; **structured property builder** (Add → Stat effect →
  Single/Double → stat(s) + numeric %) that **drives stat calc when socketed**; 9 gem icons (pick or 🎲 random).
- **Artifacts**: now a saved, nameable, reusable **library** (`subc.artifacts`) equipped per creature by id;
  builder shows the artifact-type icon (Helmet/Sword/Staff/Shield/Boots → Health/Attack/Int/Def/Speed).
- Pipeline ships new assets: 5 artifact-type icons, 9 gem icons, 5 class-bg, card art via family→race join
  (138/141). Build schema bumped to 2. Verified all 24 flows in headless Chrome (0 JS errors).

