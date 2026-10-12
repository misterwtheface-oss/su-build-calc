# Backlog — Siralim Ultimate build calculator

The ONLY open-work list for the app (consolidated 2026-10-08 from the eight backlog lists that had accumulated in
Progress.md; original text kept, with a status note where later work changed things). Done items are deleted here and
recorded in `CHANGELOG.md`. Full pre-consolidation text: `archive/Progress_until_2026-10-08.md`.
Extract-side research questions live in `_su_extract/RESUME.md`.

## BATCH 2026-10-09 — DONE and deployed together (details in CHANGELOG). Still open: the God Shop code gate (#8 follow-up).
## Delete this section once it lands.
Commit each item locally; push ONCE when the whole batch is finished. Anything that needs a decompile → don't attempt it,
write the requirements to `_su_extract/code/HANDOFF_<topic>.md` for the extract session. Tick items here as they land.
- [x] 1. **Mobile Artifact wizard** — slots become a single-row header, locked, scrolling horizontally, so the rest of the
  screen is the selector list.
- [x] 2. **Nether stone spell filter** — toggle between the "On X" trigger variants; a stone counts if ANY of its spells
  meets the condition (stones can hold several spells).
- [x] 3. **Artifact library preview → Sockets tab** doesn't show EMPTY sockets (seen on a Helmet with empty spell + nether
  slots; probably not helmet-specific). The editor is fine.
- [x] 4. **Fusion colours need the internet** — offline (airplane mode) every build showed default colours and the 6 fusion
  colour options were all default. Find why (asset not precached / fetched from GitHub at runtime?) and fix.
- [x] 5. **Spell-gem property conflicts** — RESOLVED 2026-10-10 (extract verdict b): two extractor bugs (c13 read from the
  else-branch only; every record shifted by one spell). Jade is allowed on 685 spells (same set as Citrine); data rebuilt,
  735 spells' allowed sets changed. No clarify note needed.
- [x] 6. **Mobile Spec selector redesign** — no info panel: tapping a spec opens a full-page screen (back arrow → selector
  grid) with the animated spec sprite, description prose and perk containers. One **Edit** button (replaces "Customize")
  turns the perk containers into their editable form. Tapping the Spec tile when a spec is active opens the SAME page
  (Edit available; back arrow → grid to pick a replacement). Confirm button becomes **Done** when reached from an active spec.
- [x] 7. **Anointment tile** — add the "✕" clear like the other Planner tiles; centre the perk icons horizontally without
  changing their size or wrapping (exactly 5 per row).
- [x] 8. **God Shop** — show Favor Rank requirements. Shipped from the community reference (630/630 joined); code gate → `_su_extract/code/HANDOFF_god_shop_favor_rank.md`.
- [x] 9. **Guild Shop** — the list is always 5: lay it out as a row of 3 over a row of 2 (offset, gaps between).
- [x] 10. **All God Shop lists** — centre text vertically in each row.

## Feature ideas (user backlog, not started)
- [ ] **DPS / effective-stat simulation** from `damageModel` (spell & melee, crit/dodge, defending). Class advantage is now
  code-known (×2 / ×0.5, `_su_extract/code/CLASS_ADVANTAGE.md`); expose it as a toggle. Spells match on the gem's class
  (Class Swap first), not the caster's. Effect formulas for in-app compute:
  `_su_extract/code/EFFECT_FORMULAS.md` (code tier already in EFFECT_ENGINE.md).
- [ ] **Boss-prep planner, part 2** — the Bosses page (2026-10-11) covers "what to expect" from code steps. Still open: compare
  the boss against the current build (e.g. flag a party with no Defend answer vs The Ancestor's head, no debuff immunity vs
  Loid). The boss/enemy trait taxonomy (`trait_meta.scope=boss_enemy_flavor`) could feed it; verify tags in-game first.
- [ ] **Godforge helper** — Godforge (spell-gem enchant / artifact forging) planner.
- [ ] **Luck / Roll section (Appendix page, formerly Errata)** driven by the `hasRoll` flags (data shipped 2026-10-07, no UI yet).
- [ ] Rodian Masters reverse lookup (optional, `HANDOFF_rodian_masters.md`): on a "Master of …" trait / Mastery Sigil, list the
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
5. **Deeper `scr_MacroProcess` mining** (from the on-disk 337 KB decompile): exact chain candidate-scoping
   (does a chain re-test the whole side or narrow the candidate set?) and the save-format field order
   (`scr_MacroArrayToString`) if we ever add in-game import/export. Confirm the 32-line cap is per-macro.
6. **Multi-line-per-role & priority UX**: let the user reorder/toggle proposed lines, and handle creatures
   with many spells without bloating the list.


## Rules the app doesn't enforce / model yet
- [ ] Animatus party rules NOT enforced by the app (user ground truth 2026-10-04): Animatus is a unique standalone
  creature — never fusion material, always party slot 1, at most one. The picker currently allows any slot,
  fusing, and duplicates. (User: "one of a few" such creatures — the others aren't identified yet.)
- [ ] Gray Matter / Army of Gods / Introversion / Total Deprivation are anointable in data but only honoured from
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
- [x] **Nether Bosses** shipped 2026-10-11 (35 pages, tier toggle, threats, stat bars, trait materials).
- [x] **Gate of the Gods** shipped 2026-10-11 (31 god pages: threats, stat bars, difficulty table, rewards).
- [ ] **Gate god reward skins** — the reward code gives "each of its three skins" without naming them, and each Avatar has 2–5
  creature-locked skins (seasonal ones included), so the page lists no skins. Needs the skin ids from the btype-39 aftermath
  per-god blocks (extract ask, low priority).
- [ ] **Nether Boss trait materials: code source** — the boss ↔ material link and unlock depth come from the wiki table
  (`nether_boss_trait_depths.json`, asserted against the item reconciliation's boss source); the drop isn't in the loot
  code docs (the treasure-only pool doesn't hold them). Asked in `_su_extract/code/HANDOFF_nether_material_source.md`.
- [ ] **Bosses page: Inscriptions** — bosses.json now has `encounters[].inscriptions` (the god's 5–6 Inscription spells, one
  random unknown per anointment pick; `exceptions` (e.g. Shadowbringer starts with Plague) / `also_cast_by` per spell) and per
  cast-spell `source` / `exceptions` / `boss_exclusive`. The False God is the source; show spec starts as exceptions. Show the list on each boss page as spell-gem containers. (Data only so far, 2026-10-11.)
- [ ] In-game checks the Bosses page shows as unverified: Jotun's 24-turn count, Mindwurm saddle "nothing" pick, Nebodar
  "Burned can't be avoided".
- [ ] **Misery → Perdition** (2026-10-11): owner set provisionally (`user-pending`, hidden). When the user confirms in-game, drop
  `nyi` from traits 568–570 (or move them back if the test says otherwise).
- [ ] Relic `hasRoll` flags: the extract read relic gate ids in the wrong order; after the extract fix, refresh the app's relic
  `hasRoll` flags.
- [ ] Booze spells / Top Shelf / Happy Hour `hasRoll` (if the roll attribution is approved).
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
    Source: _su_extract `code/NETHER_GENERATION.md` / `data/model/nether_generation.json`.
- Still open:
  - Library treatment for quick Artifacts.
  - Promoting a quick Artifact to a proper one when it is opened in the builder.
  - Cleanup when a quick pick is cleared.
