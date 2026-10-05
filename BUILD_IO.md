# Build Import / Export

`buildio.js` (global `SU_BUILDIO`, loaded after `effects.js`) + glue in `app.js` (`exportBuildText`,
`applyImportedBuild`, `openBuildIO`). UI: **Menu → Import / Export** (just below Builds) — a compact top-right pop-out (Riddle Dwarf style) with an Import | Export toggle; Export = the current party.

## The game side (code-certain — `_su_extract/code/EXPORT_BUILD_FINDINGS.md`)
- In-game **Export Build** (`scr_GetClipboardData` @0x146108300) writes a text summary to the clipboard.
- The game has **no build import** — the only clipboard reader is the generic text-field paste. Nothing we
  produce can be loaded into the game; the export text exists so players can bring builds INTO the app.
- Labels are localized (`L_CLIP_*`); the parser supports the **English** export.

## One payload, two text forms
**Payload v1** (JSON) — the whole build: `{ v:1, spec, perkAlloc, anoints:[{specId,key}], slots:[6 × null | {
cid, fusion, personality, scrolls, skinId, fuseColor, relic:{id,rank}, artifact:{name, rank, primary, stat[], trick[],
traits[traitItemId], spells[spellKey], nether:{name, icon, rarity, props:[{cat,key,value} | {cat:"spell",spell,trigger}]}},
gems:[{name, spell, tier, props:[propKey]}] }] }`. Code-grounded ids for creatures/relics/trait items/specs/skins;
spells and gem properties travel by **key** so a data rebuild can't scramble a shared build.

1. **`SUC1:` code line** — `SUC1:` + base64url(deflate-raw(JSON)). Lossless; ~1.8 KB for a full 6-creature party.
   Found anywhere in pasted text.
2. **Game-style text** — the in-game export layout. The app WRITES it (level 1 + the app's own stats; artifact
   values at its rank) as a readable view, and PARSES it from the game.

**Export** = game-style text + `========== SU COMPANION ==========` + the code line.
**Import** = code line if present (exact restore), else the game text (best effort). **Always loads as the current
party.** Artifacts / nether stones / spell gems are added to the libraries; an identical existing item is reused.

## What a game export can't carry (defaults on import)
Perk ranks → all max (warned) · spell gem level → 15, no properties (the export lists bare spell names) · artifact
level → inferred from the primary % (59% → 50) · skins, fusion colour, nether stone icon → defaults. Stat "(n)" =
stat scrolls; stone "(n)" = rarity (kept on the stone). Unrecognised names become warnings, never guesses.

## Tests
`node tools/buildio_test.mjs` — parses `tools/fixtures/game_export_sample.txt` (a real 6-creature export) field by
field, code round-trip, error cases.
