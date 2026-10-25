# Backlog — Siralim Ultimate build calculator

The ONLY open-work list for the app (consolidated 2026-10-08 from the eight backlog lists that had accumulated in
Progress.md; original text kept, with a status note where later work changed things). Done items are deleted here and
recorded in `CHANGELOG.md`. Full pre-consolidation text: `archive/Progress_until_2026-10-08.md`.
Extract-side research questions live in `_su_extract/RESUME.md`.

## Currencies: in-game checks (2026-10-24, extract S54)
- [ ] Code exists but reachability isn't confirmed (hard-coded English, no creator found), so it's left out of the Currencies
  section: breeding / summoning menus (Brimstone + Crystal), the gambling-dwarf minigames (Hot Hands, Think Fast, Treasure
  Hunt, arm wrestling), Reid's 2,000-Granite arena, merchants, Torun's trade, rune grinding, Alteration, sacrifice, prophecy
  reset. If any appears in game, add it from `_su_extract/code/LOOT.md` § Resources.
- [x] Clarify-note candidates (code differs from the text): Fusion Lab level match is a flat 3,000 Power; Reliquary Spell
  Damage / Healing Bonus do nothing; Arena Glory difficulty multiplier only on a lost run. DONE 2026-10-24 (clarify notes).

## BATCH 2026-10-17 — user list of 30 (mostly done; open items are the unticked ones)
Grouped by the app area each item touches, in suggested build order. Within a group, earlier items unblock later ones.
`(#n)` = the user's original number. Clarifications the user gave on 2026-10-17 are marked **User:**. Research items that need
a decompile → write `_su_extract/code/HANDOFF_<topic>.md` and don't guess.

### G1. Spell-gem containers, Spell Wizard, Artifact Wizard spell socket (do #26 first; the others build on it)
- [x] **(#26) One shared spell-gem container component.** DONE 2026-10-17: `spellRow` (pickers + library preview), `spellGemCard` (now also the Spells-page granted tile), `spellIco`, `clsTag`. The Artifact Wizard's spell-socket step should show the same
  containers as the Spell Wizard. Copy the Spell Wizard version over, then make both screens render from ONE shared
  render function or partial, so changing one changes both. While doing it, list any other duplicated container markup
  that has drifted and fold it into shared helpers too.
- [x] **(#4) Spell Wizard property step: show the spell's description and stats.** While picking a property, show the
  chosen spell's description and its stats (charges, potency, target, class). **User:** this is the Spell Wizard's
  property step, not a property detail page.
- [x] **(#2) Agate charge calculation.** DONE 2026-10-17 (floor + min 1 code-grounded, SPELL_GEMS.md S33; gem alone). Show how Agate changes the spell's charges (base → result) in the Spell Wizard
  property step, and on library entries for gems that have an Agate socketed. Use the code formula. Check that Agate's
  rounding and minimum are code-grounded before showing a number.
- [x] **(#3) Warn about properties that do nothing.** DONE 2026-10-17: Agate +0 (rounding) and Azurite on `spell.noDmgStat` (266 spells, conservative: code rules + taxonomy). A property can be valid on a spell and still have no effect, e.g.
  Defense Penetration on a spell that deals no damage, or Agate on a spell with fewer than 5 base charges. Flag these in
  the wizard and the library. Rules come from the data (damage flag, base charges), not from a hand-written list. Keep the
  warning minimal (a small chip, no prose).

### G2. Spell library (grid / filters / sort)
- [x] **(#18) Grid icon size drifts with long names.** DONE 2026-10-17: every fixed-count `repeat(N, 1fr)` grid → `minmax(0, 1fr)` (9 grids), names wrap. In the Spell library, a long name (e.g. Summon Doppelganger) makes
  every icon in its column bigger than the other columns. The cause is likely that the column width follows the name
  length and the icon scales with the column. Fix by giving icons a fixed size and letting names wrap or ellipsize. Then
  audit every grid layout that uses the same pattern.
- [x] **(#16) Multiple filters at once in Spell Gem search** DONE 2026-10-17: stacked taxonomy tags (AND) in the shared spell picker + the Spell Gem library, so the user can narrow down to specific spells (filters
  combine with AND).
- [x] **(#20) Class sort in the Spell library.** DONE 2026-10-17 (class-wheel order, Opal swap counts).

### G3. Artifact + Nether Stone wizard limits
- [x] **(#23) Artifact wizard: one copy per trick-slot item.** DONE 2026-10-18 (extract S34: the blacksmith refuses a trick property already in trick1/trick2, `obj_bsupgrade_KeyPress_69`; stat slots allow repeats). The picker greys out a trick already in the other slot; saved duplicates are dropped on load. The wizard currently lets the same trick-slot item go in
  more than once, which the game doesn't allow. Get the exact uniqueness rule from the artifact creation code
  (`_su_extract`) and enforce it in the picker, e.g. hide or disable items already used.
  **2026-10-17:** not in any decompile on disk → asked in `_su_extract/code/HANDOFF_artifact_slot_uniqueness.md` §1
  (key = material, property or stat group? trick only, or stat slots too?).
- [x] **(#24) Nether Stone wizard: cap total effects at 6** CLOSED 2026-10-18 — no such cap in code (re-checked in the on-disk decompile: separate loops 6 / 3 / 3, no shared counter; NETHER.md). App unchanged., on top of the existing per-effect caps. Confirm in the code
  where the 6 comes from (`inv_NetherStoneCreate` / NETHER.md).
  **2026-10-17: code disagrees — waiting on the user.** NETHER.md (CODE-CERTAIN): the 6 is the *property* cap; traits (3) and
  spells (3) are separate roll chains, so the generator allows up to 12 total. The app already enforces 6/3/3. Asked the
  extract for any other total limit (HANDOFF_artifact_slot_uniqueness.md §2); ask the user if they have in-game evidence.
  **2026-10-18 (user: "check it against the code"):** decompile read — three loops, own counters reset to 1, bounds 5 extra / 3 / 3.

### G4. Planner, Spec overlay, creature detail
- [x] **(#22) Reorder creatures from the Planner screen** DONE 2026-10-17 (▲▼ roster rows, ‹ › tiles; swaps the whole slot). with arrows that swap a creature with its neighbour. **User:**
  swap-with-neighbour (not pick-a-slot). Respect the Animatus slot-1 rule if it gets enforced (see "Rules the app doesn't
  enforce").
- [x] **(#25) Perk header collision.** DONE 2026-10-17 (`.perk-line-head` wraps; 0 overlaps over 605 headers at 390px). The perk title, the spec chip and the "current build" chip share one row and
  overlap when the chips are too long. Let the chips wrap onto their own row under the title. Mobile first.
- [x] **(#29) Spec overlay: mark perks that can't be anointed** DONE 2026-10-17 (⊘, same `perkAnointable` rule as the Anointments list: flag + False God + not Highborn) with a small visual marker (anointment flag is in
  `anointments.json`). Minimal chrome.
- [x] **(#21) Something from Nothing trait chip gets no class colour.** DONE 2026-10-17: build-data fills trait.cls from the owning creature (id join) — 5 traits (also Robotic Armor, Numerical Nightmare, Eery Veil, Ignorance Is Bliss); CSVs already right. Likely because the source creature's name is
  numeric, so the name→class lookup misses. Fix the lookup to use the id, then check other traits whose source has a
  numeric or odd name.
- [x] **(#5) Creature detail: "Triggers" section.** DONE 2026-10-18 (16 event groups incl. the extra Activates events; perks/anointments left out as party-wide, CHANGELOG). Subsections: **Attack, Cast, Defend, Provoke** (the 4 actions), a
  general **Damage** subsection, and **On Turn**. Each lists every triggered effect the build attaches to that event:
  - "On X" spells from Artifacts, socketed materials and Nether Stones;
  - spell-gem properties that add an "On Cast: X" effect (Citrine, Azurite, Bloodstone, …);
  - Relic effects;
  - traits.
  Reuse the existing taxonomy trigger tags and the nether trigger ids. Best done after G1 (shared containers) and G6 (per-Rn
  relic data).

### G5. Mobile / touch layout
- [x] **(#27) Grey row while scrolling on touch.** DONE 2026-10-17: all 51 `:hover` rules wrapped in place in `@media (hover: hover)` (cascade order kept); selection was already click-only. **User (found the cause):** it's the "selected"/hover style showing
  during a scroll gesture that isn't a full tap. On mobile it looks like a desktop mouse hover. Fix by putting hover styles
  under `@media (hover: hover)` and/or only applying the selected state on a completed tap (not on touchstart).
- [x] **(#1) Intentional landscape phone layout — Planner pass DONE 2026-10-17** (`@media (orientation: landscape) and (max-height: 500px)`: slim top bar, Spec/Anointments strip, 6 tiles in one row, roster two-up). **Still open: the other screens** (overlays/wizards) in a later pass. Right now a phone in landscape (e.g. clipped into a controller) just gets
  the desktop layout squeezed into a short viewport. Design a real landscape-phone layout with a short-height breakpoint,
  e.g. `(orientation: landscape) and (max-height: ~500px)`. **User:** design the **Planner first**. Other screens follow in
  a later pass. Gamepad input is not part of this item.

### G6. Relics
- [x] **(#10) Relic sprites.** DONE 2026-10-17: `relicArt` = code big art (`scr_RelicBigIcon`) everywhere except the creature-sprite badge; build errors on a relic without big art. The full-size relic display seems to use the small icon sprite. Use the icon only in the one
  small spot (next to the creature sprite) and the higher-quality full-size sprite everywhere else. Check that the asset
  match carries a provenance tag (asset-provenance rule).
- [x] **(#17) Per-rank relic taxonomy.** DONE 2026-10-18 (user: no threshold; "×N" on a relic's tag chip when N ≥ 2 of its ranks carry the tag, from `relic_rank_taxonomy_tags.json` `relic_tag_counts` → `relics[].tagRanks`). Also shipped: Lamora `Creature of X Type Count` → `Debuff Count`; the 4 whole-relic tags no rank backs dropped (Fable, Mutatias, Salus, Starwrath; relicChanges). Arbiter R70 clarify note arrives via effect_clarifications. Later (maybe): a short prose summary per relic. Tag each relic rank (R1…Rn) separately instead of the relic as a whole. On the
  relic's own view, add up the tags across its ranks. When a tag repeats across ranks with a similar scope, show it as
  "built to support this feature", separate from tags that appear on only one rank. **User: the threshold (2+ vs 3+
  ranks) is still to decide**, so ask before shipping.
  **2026-10-17:** relic tags exist only per relic (31), not per rank (310 rank perks; 295 have code signatures) → asked the
  extract for per-rank tags + scope in `_su_extract/code/HANDOFF_relic_rank_taxonomy.md`. Threshold asked of the user.
  **2026-10-18 (user: "see what surfaces at 2 and is dropped with 3"):** preview from the per-rank CODE signatures (Action/Mechanic
  level only, Relic mechanic excluded, 30 of 31 relics — Arbiter has no signatures): **37 features at 3+ ranks, 34 more surface at
  exactly 2**. Re-run the same comparison on the real per-rank tags when they land, then the user picks.

### G7. Taxonomy + search
- [x] **User review: 4 status tags the code does not back** (extract S56, CODE_TAXO.md § Status markers per site): Empowered
  Savage Spores Buffs::Apply (no buff applied), Hymn of Guile and All Hope Is Lost Debuffs::Apply (they only prevent a buff),
  Moonfire & Sunfury R90 Debuffs::Remove (removes a buff). **Removed 2026-10-24 (user: "Go ahead"; extract S57 round 7S).**
- [x] Round 7 item F: researched and ruled 2026-10-24, shipped (round 7F, see CHANGELOG). Not reviewed: CAWW!'s Damage::Deal
  More (Attack).
- [ ] **In-game check: Lord of Undeath** (extract S38b). Code runs it at each of your creatures' turn start for every minion they
  have, whether or not a stack left (text: "after a minion goes away"). Confirm in game before adding a clarify note.
- [ ] **In-game check: Covenant without the perk** (extract S39 F3). The rune bonus (once all five Rune spells have been cast,
  on-attack effects activate an extra time) runs in the shared Rune case of bc_CreatureCast with no perk check (all-five test
  @0x1408bdf5a, bc_OnAttack loop @0x1408be264). Test without Covenant: cast all five Runes, then a sixth Rune. Do on-attack
  effects activate twice? If yes, write a bug report like `bug_report_master_of_gorgons.md`.
- [ ] **Taxonomy v2: user audit of the provisional round-5 theme lines** (v2 rebuild + v1 cutover DONE 2026-10-22, history in
  CHANGELOG and `TAXONOMY_INTENT.md` "Taxonomy v2"). Crosswalk `theme_status`: Traits / Death / Turn Timing / Targeting / Health /
  On-Event lines, markers counts / match / first_only; Spell Kind / Spell Class / Named Spell -> Cast pending the user's own review.
  Absorbs the Calculation sweep below, the parked S24 Creature is Damaged proposal and the untagged-traits review.
- [ ] **Taxonomy intent audit, first pass: "Modify X Calculation" sweep + an inbound damage calculation tag** (user
  2026-10-18). (1) Check that `Modify Attack Calculation` (42), `Modify Spell Calculation` (23) and `Defense Calculation` (3)
  catch everything they should, code-grounded. Quick text scan: 41 traits use "calculation" / "as if" wording, 15 carry a
  Calculation tag; misses include The Crimson, Frenzy, Bloodline. (2) Add a tag for the **inbound** damage calculation (how
  damage a creature *takes* is computed), e.g. Mindful Awareness "Intelligence added to Defense when determining the damage
  taken", Details Matter, Twilight Zone's second half, Barbed Vines. Decide in the audit whether it replaces or sits beside
  `Defense Calculation`. Relabels go through the review queue.
- [x] **(#13) Search inside the taxonomy view should match subcategories** DONE 2026-10-17 (a "Tags" section heads the name results), e.g. searching "Persist" returns every
  Persist-related subcategory, not only the top level.
- [x] **(#28) New subcategory under "Affect on Spells": "Count as Manual".** (Pandemonium Wrath CONFIRMED in code 2026-10-18: its repeats are queued with automatic = false) It covers effects that make auto-cast spells
  count as manually cast for effect interactions (e.g. The Great Beyond). Find the members from the code flag where
  possible. Approval goes through the usual taxonomy review queue.
  **SHIPPED 2026-10-18 (user approved all 4):** value `Affect on Spells::Count as Manual`, members in code_taxo_approved.json;
  Pandemonium Wrath carries a note → validate in code (`_su_extract/code/HANDOFF_count_as_manual.md`). Original proposal: Code-grounded
  members (traits/perks that clear `bc_CreatureCast` arg3, ARTIFACTS.md §3): **Superfluidity** (5%), **The Great Beyond**
  (40%), **Embrace the Arcane** perk (10%). Text-only candidate: **Pandemonium Wrath** ("additional spells are considered to
  be manually cast"; its call path isn't traced). On approval: add to TAXONOMY.md + `correctTaxo` + code_taxo_approved.
- [x] **(#19) What counts as "interacts with minions" for Dark Summoning membership?** DONE 2026-10-18 (user: "both"): `Minion Spells` = every spell that deals with minions literally (42, +11: Crucifixion, Dark Transformation, Curse of Jimly, Dogpile, Direct Orders, Big Bang, Earthquake, Banish, Chaos Orb, Contagion, Fae Fire); Dark Summoning's real pool = the game's MINION category (26), and the 16 members outside it carry a clarify note. Parked for the taxonomy intent audit: Mega Magic, Apocalypse, Dispel / Mass Dispel / Divinity. Define the rule the same way as
  the Multi-Target rule (CHANGELOG 2026-10-06): what qualifies, what doesn't, edge cases. Get the user's approval, then
  re-audit the members.
  **User 2026-10-18: membership must be validated in code — no text rule.** Waiting on the handoff.
  **2026-10-17:** code predicate asked in `_su_extract/code/HANDOFF_dark_summoning_pool.md` (record is `inferred`; if the code
  has a list/flag, that is the rule). Draft text rule for the user: *qualifies* = the spell creates a minion, or acts on
  minions directly (buff/heal/remove/sacrifice/consume them); *borderline* = scales with minion count (Crucifixion, Direct
  Orders, Dogpile, Dark Transformation) and removes minions (Banish, Earthquake, Chaos Orb, Contagion, Big Bang) — 10 spells
  mention minions but aren't tagged today; *doesn't* = generic creature effects that may happen to hit a minion. 26 members now.

- [ ] **Taxonomy review: traits with no tags** (user 2026-10-18). Extract answered (S36, `_su_extract/code/HANDOFF_untagged_traits.md`).
  Cause was the app's Dire Wolves minion stem (plural "Wolves" never matched): FIXED 2026-10-18, restoring the extract's
  existing tags on 8 traits (Blood Thirst, Hound Legion, Nature of the Beast, Fingertip Nip, Vicious Bite, Summon the Pack,
  Master of Hounds, Backup Packup). Left for the review: 15 code proposals (Nature of the Beast Start of Battle; Boon of the
  Hee Hoo Hay Ho 5; Nether Orbs Cast ×2; Conspiracy Theory 7, which supersede its `trait:1656` audit removal on approval because
  approved code changes apply after the audit layer), and the LLM's Additional Stacks on Nature of the Beast (code: 3 starting
  stacks, no cap change). Anatidaephobia stays empty (flavour, code-confirmed).

### G8. Appendix sections + combat research (research first → handoffs → Appendix pages)
- [x] **(#6) Appendix: Class Advantage.** DONE 2026-10-17 (wheel table + attacks/spells/Opal/Convoke note, COMBAT_RULES.md). Show the class wheel order, and explain how it applies to attacks vs spells
  (spells use the gem's class, Class Swap first) and to class changes (e.g. Opal). Source: `_su_extract/code/COMBAT_RULES.md`.
  This can share work with the open "Confirm class advantage in-game" item and the DPS-sim toggle.
- [x] **(#9) Default spell targeting.** DONE 2026-10-17: `spell.aim` from record fields 5 + 18 (742/747; data-only, CSV `target` untouched); per-spell lookup via the Appendix search. Map each spell's default side (opponents vs the caster's side), if we don't already
  have it. Check the code target-scope field (spell record field 5) first. This ties into the open "Spell target: CSV vs
  code" item. Needed by #8.
- [x] **(#8) Appendix: random target selection.** DONE 2026-10-17 — no handoff needed: `bc_CreatureCastSpellGem` was already decoded (ARTIFACTS.md §2). "Random Targets" section. How targets are picked for random-target effects, e.g. socketed
  spell-gem casts and Nether Stone spells. Needs code research, so write a handoff.
- [x] **(#14) Research: Burn the Corpses.** DONE 2026-10-18: clarify notes on every blocker (what each does NOT stop) + blocker rows in the Resurrection Order (extract S35, `resurrection_blocks.json`). Rebirth report unconfirmed — code says refused. Find which resurrections it actually blocks. In testing, many resurrections
  get through, e.g. Terminus, and reportedly Rebirth and the False God resurrection effects. Find the check in code and
  list what it does and doesn't stop. Handoff.
  **2026-10-17:** the perk is **Burn Their Corpses** (Pyromancer). Asked in `_su_extract/code/HANDOFF_resurrection_blocks_final_summoning.md`
  §1 (where it's checked; what bypasses it; same for the 8 other "cannot be resurrected" sources).
- [x] **(#15) Resurrection Order: add a note about resurrections that don't go through `bc_onDeath`** but still count as
  resurrection-triggering effects (e.g. Terminus, Ever Upwards). DONE 2026-10-18: note row naming them; the whole list re-ordered to code order (user ruling) with blocker rows and the queue-time checks. Do this together with #14. Asked in the same handoff §2 (full list of direct
  `bc_EventResurrect` callers outside bc_OnDeath).
- [x] **(#30) Research: Final Summoning.** DONE 2026-10-18: "Spell cast by each Greater Demon" table on the perk (spec page + detail; Satanachia = one of 30 at random). Which spell does each Greater Demon minion cast when it goes away? (Each minion
  has a different one.) Handoff, then show the result on the trait. **2026-10-17:** it's the Demonologist perk FINALSUMMONING; asked in the same handoff §3.

### G9. Nether Realm helpers + Nether Bosses
- [x] **(#11) Faucet valve order is mirrored.** DONE 2026-10-17 (screen valve i = code digit 3−i; NETHER.md updated). The 40% fade item is still only offered. **User:** read the code right→left. The app currently assumes left→right
  (`app.js` FAUCET section, ~line 3394). The CHANGELOG 2026-10 check was "only the LEFT valve on → gem chest". Mirror the
  digit order and update that note. Can go out with the open "Faucet valve sprites: remove the 40% fade" item.
- [x] **(#7) Verify Nether Boss rewards.** DONE 2026-10-18: the post-fight loot is a separate 20 bundles (+ Key Fragments), not the quest reward; the quest reward (5 bundles) is paid on entering the next room. Bosses page updated. Check that the reward given right after a Nether Boss fight is the quest
  completion reward, and that the two chests ALSO hold +3 bundles on top of it. Check against code, then fix the Bosses
  page reward text if needed.
  **2026-10-17:** chests CONFIRMED in code (2 × 9 bundles: 3 + 3 boss room + 3 Nether bonus; +5 at 10 favor-rank realms) and now
  on the Bosses page. Whether the post-fight loot roll IS the quest-450 payout is asked in `_su_extract/code/HANDOFF_nether_boss_reward.md`.

### G10. Macro
- [x] **(#12) Order of duplicate-name traits in the macro selector.** ANSWERED 2026-10-18: the game stores the runtime trait id and sorts A→Z with an unstable qsort, so same-name order depends on the save. Rule for when the macro engine emits trait conditions (it doesn't today, and macros are FEATURES-off): key by runtime id, label copies by owner (`_su_extract data/model/macro_trait_order.json`). E.g. Head of Hydranox appears 5 times, each owned by a
  different head. **User:** find the order the game itself uses, so our macros target the right owning creature for traits
  with the same name. Needs `scr_MacroProcess` / macro selector code research (see Macro roadmap item 5) → handoff, then
  match it in `MACRO_ENGINE`.
  **2026-10-17:** asked in `_su_extract/code/HANDOFF_macro_trait_order.md` (list source, stored parameter = id or name, Hydranox order).

## Feature ideas (user backlog, not started)
- [ ] **Consolidation review** (user 2026-10-19). Sweep the app for near-identical elements that each have their own
  implementation, and fold each set into one shared implementation. Precedents: the **shared spell container**
  (`spellRow` / `spellGemCard`: one spell row for the Spell, Artifact and Nether Stone wizards and the library preview,
  which also fixed the drift where one copy centred its "from X" line) and **`TagFilter`** (2026-10-19: six separate tag
  filters became one; the spell / anointment / trait-item copies had silently broken on Taxonomy v2). Likely candidates
  to check: the Class / Race / Spec / False God facet chips, the ★ Bookmarked toggles, the sort segments (`sortPick`
  users), the result-row layouts (Taxonomy page `line()` vs perk / relic / card rows), the library list + preview panels
  (artifacts, nether stones, spell gems), and the confirm/clear-armed buttons. Output: a list of the sets found, with the
  shared shape proposed for each, for the user to pick from before refactoring.
- [ ] **DPS / effective-stat simulation** from `damageModel` (spell & melee, crit/dodge, defending). Class advantage is now
  code-known (×2 / ×0.5, `_su_extract/code/COMBAT_RULES.md`); expose it as a toggle. Spells match on the gem's class
  (Class Swap first), not the caster's. Effect formulas for in-app compute:
  `_su_extract/code/EFFECT_FORMULAS.md` (code tier already in EFFECT_ENGINE.md).
- [ ] **Boss-prep planner, part 2** — the Bosses page (2026-10-11) covers "what to expect" from code steps. Still open: compare
  the boss against the current build (e.g. flag a party with no Defend answer vs The Ancestor's head, no debuff immunity vs
  Loid). The boss/enemy trait taxonomy (`trait_meta.scope=boss_enemy_flavor`) could feed it; verify tags in-game first.
- [ ] **Godforge helper** — Godforge (spell-gem enchant / artifact forging) planner.
- [ ] **Luck / Roll section (Appendix page, formerly Errata)** driven by the `hasRoll` flags (data shipped 2026-10-07, no UI yet).
- [ ] Rodian Masters reverse lookup (optional, `archive/handoffs/HANDOFF_rodian_masters.md`): on a "Master of …" trait / Mastery Sigil, list the
  realms whose Master pool has that race (inverse of `D.masterRealms`).
- [ ] Spell-gem loadouts (potency tiers already in `damageModel`).
- [ ] Entity detail: optional "shared by N party members" on the trait view.

## Macro Proposal — iteration roadmap (ACTIVE)
v1 shipped 2026-09-22, then **refactored for extensibility** (behavior byte-identical): the engine now has
three clean modification surfaces (see **`MACRO_ENGINE.md`**) — `MACRO_TUNING` (all thresholds/knobs),
`SPELL_OVERRIDES` (per-spell `{purpose,side,multi}` hook in `classifySpell`), and `MACRO_RULES` (ordered
`{key,when(x),lines(x)}` array over a shared `macroContext(x)`; array order = priority). `proposeMacro` is a
thin iterator; `macroRoles(x)` split out. Grounded in `_su_extract/code/MACRO_MODEL.md` + `macro_vocab.json`.
Known limits + planned work, roughly in priority order (all now cheap to implement against the new surfaces):
1. **Named buff/debuff detection** (top ask). Right now buff/debuff lines gate on `has < 1 buffs|debuffs`
   because we don't know *which* status a spell applies. Detect the granted status name from the spell's
   effect/taxonomy so lines can read `doesn't have {Shell}` — needs a spell→status map (mine from
   `_su_extract` spell effects / the `terms` status vocabulary already in data.js).
2. **Tunable knobs**: focus-target stat (default *lowest Max Health* for nukes / *lowest Defense* for
   attacks — offer *lowest Health*, highest-threat) and heal threshold (default 50%). Small UI in the
   Proposed-Macro section.
3. **Classification accuracy**: taxonomy mislabels some spells (e.g. Antidote tagged "Healing" but it cures
   debuffs). Add targeted overrides / a secondary signal (Affect on Status vs Affect on Life).
4. **Spec + anointment context** in role inference (e.g. a summoner spec → Support/Tank lean; damage-amp
   anoints → Caster). Currently role uses only the creature's own spells + stats + traits.
5. **Deeper `scr_MacroProcess` mining** (from the on-disk 337 KB decompile): ~~exact chain candidate-scoping~~
   (answered: chains don't narrow, MACRO_MODEL "Current answer" 2) and the save-format field order
   (`scr_MacroArrayToString`) if we ever add in-game import/export. Confirm the 32-line cap is per-macro.
6. **Multi-line-per-role & priority UX**: let the user reorder/toggle proposed lines, and handle creatures
   with many spells without bloating the list.
7. ✅ (v2 2026-10-23) **Health thresholds in 10s** (2026-10-23, user in game: the picker steps in 10s). `MACRO_TUNING` 25s
   (`healEmergency`, `finishHp`, `selfPreserveHp`) can't be entered → use 20 or 30.
8. ✅ (v2 2026-10-23) **`basic-attack` chain is wrong**: its "doesn't have Shell / Barrier → test next line" lines don't filter the
   final "lowest Defense" target (chains don't narrow). Either drop them, or emit per-slot chains
   (`enemy (n)` on every line) and accept the line cost.
9. ✅ (v2 2026-10-23) **Always-act tail** (user rule: a macro must never hand the turn back): replace the single `fallback` line with
   `If any enemy has lowest Health → attack that creature` (only if attacks are worth it, item 10) /
   `If this creature has > 0% Health → defend` / `If this creature has > 0% Health → skip turn`. Patterns + a
   full worked 30-line macro: MACRO_ENGINE.md "Authoring rules", `_su_extract/code/MACRO_MODEL.md` "Authoring patterns".
10. ✅ relics + traits (v2 2026-10-23); spec still open (item 4). **Relic / trait / spec context in `macroContext`** (user 2026-10-23): whether a caster should attack depends
   on Int-based attacks: Whisper R70, Ribcracker R90 (after 10 casts), Myosotis, Confusion and Empathy. Relics
   add no macro lines but change which lines belong. Today `physical` / `canAttack` look only at stats and
   spell gems. (Overlaps item 4.)


## Rules the app doesn't enforce / model yet
- [ ] Animatus party rules NOT enforced by the app (user ground truth 2026-10-04): Animatus is a unique standalone
  creature — never fusion material, always party slot 1, at most one. The picker currently allows any slot,
  fusing, and duplicates. (User: "one of a few" such creatures — the others aren't identified yet.)
- [ ] Army of Gods / Introversion / Total Deprivation are anointable in data but only honoured from
  the current spec (`via:"spec"`), never as anointments.
- [ ] Introversion + Total Deprivation require rank > 0, though their text says "always active while your
  specialization is …, even if you haven't allocated any Perk Points".
- [ ] Spell damage stat: when an evaluator claims `dmg.deal` / `heal.deal` / `stat.add`, use `amount.stat` (it is no
  longer always Intelligence). Unverified code reading: Int-only stat swaps (Confusion and Empathy, Anomaly, Voodoo,
  Bloodthirst, Mortem R8) don't affect spells that read Speed / Attack / Defense directly
  (`_su_extract/code/SPELL_POTENCY_STAT_FINDINGS.md`).
- [ ] Highborn always +5 (assumes every other spec ascended; text says 3 otherwise).
- [ ] Master of Gemlings ("If all … are Gemlings") grants no any-class permission (old text pattern misses it).
- [ ] Spectrometry ("Your Spelljuggler creatures …") grants no any-class permission (same cause).
- [ ] Powerful Draw grants any class without enforcing "only Arrow spells".
- ~~Molecular Betrayal battle-start rounding unverified~~ — PROVEN in-game 2026-10-05 (see CHANGELOG); remove from quirks.
- [ ] **Capped effects with no app surface yet** (keep in context — user 2026-10-02). `_su_extract data/model/dr_caps.json`
  has 6 entries that `build-data` can't attach a note to, because the app has no place for them: **Life Guild bonus 1**
  (attack/spell damage taken), **Nature Guild bonus 3** (indirect damage taken), and the **4 Race Mastery lines**.
  Two of the four mastery lines are damage-DEALT bonuses that are also clamped at 0.8. If a Guild or Race Mastery feature
  is ever added, show the "Max 80% damage reduction" chip on these too. They are joined by `kind`
  (`guild`/`mastery`), so the notes block just needs a target.
- [ ] **Luck re-rolls must be modelled if Realm Instability / realm-property computation is ever added** (user 2026-10-04).
  The Spell Gem Slot activation chance shipped WITHOUT re-rolls (by design). The re-roll layer lives in `scr_Roll` and is
  keyed on **whose turn it is** (`global.creatureturn`), not on who owns the artifact. Source:
  `_su_extract data/model/spell_gem_slot_chance.json` `roll.luck_rerolls`.
  - **Player turn:** Sleight of Hand (perk 33) re-rolls a failure, giving p+(1−p)p. Realm property **Bad Luck** (id 61)
    makes a first-roll success pass a second roll, giving p·p.
  - **Enemy turn:** realm property **Good Luck (Enemies)** (id 62) and the trait Spin the Wheel (1765) each re-roll a
    failure.
  - Realm Instability adds realm properties, so Bad Luck and Good Luck would change real activation odds.

## Data still sourced from community CSVs (harden vs code)
- [ ] **Revisit CSV-provenance data (harden vs code)** — several shipped fields come from the user's
      community compendium CSVs (`_raw_csv/*_REF.csv` / `*_ref.json`), NOT code, so they can be stale/wrong
      (recall Affliction CSV charges 17 vs code 14). Come back and re-ground them against the datamine /
      in-game where possible, or at least tag provenance in the UI. Known CSV-sourced fields today:
      **spell `potency`/`target`/`source`** (spells_ref.json — charges are already code), **god base-stat
      null-fills** (Creature_REF.csv, 14 creatures), **ascension flag** (Perk_REF.csv), **amber name→stat map**
      (user sheet). Audit each; prefer code, mark the rest.
      ✓ 2026-10-01: perk→spec membership and the anointment flag are now from code (specializations.json /
      anointments.json), and the CSV was corrected to 100% agreement.
- [ ] Extract follow-ups (2026-10-01): a 19th rune, EXTRASPELLS (id 7), is missing from runes.json (code-only, cut but wired);
  the code has display names for realm properties that could replace the authored ones.
- [ ] **Confirm class advantage in-game:** same attacker, no crit, two defenders with equal Defense — strong-vs takes exactly
  2×, weak-vs exactly 0.5× of neutral. Then use it as the DPS sim's class toggle.

- [ ] **Spell target: CSV vs code (user call pending).** `build-data.mjs` fills a blank `Spell_REF` Target from the code's
  spell record field 5 (target scope), and code "Self" (scope 4) wins (user-approved 2026-10-04). Where the CSV and the code
  disagree otherwise, the CSV value is kept until the user decides. List the disagreements and ask.

## Pending extract hand-offs (from `_su_extract/RESUME.md`, waiting on the user)
- [x] **Endowment: code check** DONE 2026-10-18 (`_su_extract/code/HANDOFF_endowment.md`). User ruled for the code: the stat
  average uses creature #2's primary creature's plain base. Deprived keeps the trait.
- [x] **Nether Bosses** shipped 2026-10-11 (35 pages, tier toggle, threats, stat bars, trait materials).
- [x] **Gate of the Gods** shipped 2026-10-11 (31 god pages: threats, stat bars, difficulty table, rewards).
- [ ] **Nether Shop boss skins: price** (in-game check): the code charges 1 Brimstone for each boss skin Ned sells after 4 wins
  (`nether_shop.json` `boss_skin_price_note`); the Nether Boss pages leave the price out until confirmed. Lord Zantai's 10
  traits: DONE 2026-10-25 (extract S59): each Zantai win drops one random Jewel; his portal needs Inner Darkness beaten 3 times,
  so their depth is 590 from the code (`nether_shop.json` `lord_zantai`; the wiki table only cross-checks now).
- [x] **Ad-hoc Q16-Q21 clarify notes** DONE 2026-10-25 (extract S59, 6 notes shipped). Was: no `effect_clarifications.json` entry yet
  for The Great Beyond -> Shared Consciousness (its conversions trigger it, 20% per execution), Thrive On Death (no dead check,
  so Anger Management feeds it) / Anger Management, and Shadow Bulwark / Bulwark being outside the 80% reduction cap
  (`code/ADHOC_RESEARCH_FINDINGS.md` rows 16-21). In Formation, Shadow Bulwark and Poison Inoculation already have notes.
- [x] **Start-of-battle handoff leftovers** (`_su_extract/code/HANDOFF_start_of_battle_regen.md` § App to-do): rows 245 / 247 / 249
  (Cruel Creation / Corpse Eater / Animated Dead as secondaries), realm property 25 on your creatures (data already says so),
  Ultimate Trickery's text. DONE 2026-10-25: all three were in the shipped data (245 / 247 / 249 fold into their parent rows);
  Ultimate Trickery's note lost its code wording (extract S59).
- [x] **Effect-order clarify-note candidates (optional, extract S49 / S49d / S49f):** CLOSED 2026-10-25. Fragmenting Arrow overflow and Butcher
  execute are matched by the hit's display label, not the spell id (`bc_EventDamage` #831 / #945 `gate.note`); same for
  Disintegrating Arrow on kill (`bc_ExecuteEvents` #41) and the boss-battle instant-kill branch (#84, battle types 37 / 39).
  Needs player-facing wording (what actually differs in play) before shipping; Celerity's row note is data provenance, not a note.
  2026-10-25: draft wording in `_su_extract/code/EFFECT_ORDER_FINDINGS.md` § "Label-matched gates" (not shipped; for the user):
  the label match changes nothing in play for Fragmenting / Disintegrating Arrow; new code ≠ text: Butcher's gate instantly kills
  on a hit over 35% of max Health (extract open: whether Butcher's own hits carry the label); boss-battle instant-kill rule.
  - [x] Fragmenting Arrow note and the boss-battle instant-kill rule (boss pages, Damage section) SHIPPED 2026-10-25 (user
    "Add the clarification"; extract S61).
  - [x] Butcher: NO NOTE (user 2026-10-25: nothing in Butcher's text suggests a kill; extract S60: the unused execute never fires, so play matches the text).
- [ ] In-game checks the Bosses page shows as unverified: Jotun's 24-turn count, Mindwurm saddle "nothing" pick, Nebodar
  "Burned can't be avoided".
- [x] **Start of Battle secondary calls** DONE 2026-10-21 (extract S42 `secondary_of`; 13 indented, self re-checks folded).
- [x] **Perk cast pools** DONE 2026-10-22 (extract S47 / S48; spellsUsed on perks, traits, relics, spells).
- [ ] **Misery → Perdition** (2026-10-11): owner set provisionally (`user-pending`, hidden). When the user confirms in-game, drop
  `nyi` from traits 568–570 (or move them back if the test says otherwise).
- [x] Relic `hasRoll` flags (DONE: extract fix S33/S35, picked up by the 2026-10-18 rebuild — 36 ranks on 20 relics): the extract read relic gate ids in the wrong order; after the extract fix, refresh the app's relic
  `hasRoll` flags.
- [x] Booze spells / Top Shelf / Happy Hour `hasRoll` (DONE: approved S33h; all 15 Booze spells flagged in data).
- [ ] Creature is Damaged tag changes (if the S24 proposal is approved).
- [ ] Step 0b note: "including Speed gains and buffs active at the start of their last turn" (offered).
- [ ] Faucet valve sprites: remove the 40% fade (offered).

## Verify (probably done)
- [ ] **Duplicate-name traits (58 groups) — decide handling.** Most were resolved by the 2026-09-24 reconciliation
  (Nether Boss duplicate copies deduped via `NETHER_DUP_TRAIT_IDS`, Master duplicates blacklisted, False God part copies
  valid). Re-check whether any player-facing same-name pair is still shown twice; otherwise delete this item.

## Parked
### 💤 PARKED — Player-customized spell availability list (+ dependent nether spell restriction)
- [ ] **Player-customized spell availability list:** the player marks which spells/recipes they own.
- [ ] **Depends on the list above** (probably not worth it): restrict Nether Stone spells to owned recipes, as the game
      does (`inv_NetherStoneCreate` only rolls spells with `inv_SpellRecipeOwned`). Also map the 5 nether spell
      trigger ids (`spellacts` 0–4) to code-confirmed names.
### 💤 PARKED OPTION — Quick artifact/nether traits in the creature wizard (user, 2026-10-01; only if more users ask)
Goal: users who only plot traits can add Artifact and Nether Stone traits without the full artifact builder, while the
full builder stays the high-fidelity path.
- **Wizard steps:** Creature → Fusion → **Artifact Trait** → **Nether Stone Traits** → Personality/Scrolls.
  - The new steps use the same list layout as the creature selector. Each row shows the trait **material** in place
    of the creature name: no stats, no race/class.
- **Artifact Trait step:** pick one material, or choose "No Artifact Trait" to skip straight to Personality/Scrolls.
- **Nether Stone Traits step:** up to 3 traits, then Personality. "No Nether Stone Trait" exits early.
- **Picks write real data:** a pick creates or updates a **quick Artifact** (plus its nether stone) in the background.
  It is the same artifact/nether model, so traits, builds and the appendix work unchanged.
- **Edit flow, creature already has a proper (non-quick) Artifact:** the Artifact Trait and Nether steps are
  **suppressed**.
- **Edit flow, equipped Artifact is a quick Artifact:** the steps are shown, and changes apply to that quick Artifact
  in the background.
- **Decided (2026-10-01):**
  - **Quick Artifact icon:** the game's own greyscale `menu_artifactsG` sprite (plain grey sword). Not a desaturated
    copy, and not a type/tier icon.
  - **Quick Nether Stone icon:** the sphere, `assets/gems/nether_1.png`, which is now the game's own pre-coloured
    icons frame 2095. The game has no untinted stone.
  - **Nether trait limit = 3, CODE-CERTAIN.** In `inv_NetherStoneCreate` the trait loop runs i=1..3 and stops at the first
    failed roll. A trait is only accepted if an artifact trait-item material exists for it, so the quick-nether picker uses
    the **same trait-material pool** as the Artifact Trait step (minus duplicates on the stone).
    Source: _su_extract `code/NETHER.md` / `data/model/nether_generation.json`.
- Still open:
  - Library treatment for quick Artifacts.
  - Promoting a quick Artifact to a proper one when it is opened in the builder.
  - Cleanup when a quick pick is cleared.
