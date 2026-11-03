// Creature-owned spell gems + artifacts (libraries = saved designs to copy from). Seeds a legacy save (library ids on the
// slots), then checks the migration, equip-as-copy, edit isolation, Save to library, Remove, library delete and the
// Nether Stone clash rule.
// usage: node tools/smoke_owned_gear_seed.mjs data.js seed.json && SEED=seed.json node tools/smoke.mjs off HYDRANOX tools/smoke_owned_gear.mjs
//   (SHOT=<prefix> saves 390 px screenshots of the Spells page and the artifact page)
export default async ({ act, evalJS, sleep, out, shot, viewport }) => {
  await viewport(390, 844);
  const ls = (k) => evalJS(`JSON.parse(localStorage.getItem(${JSON.stringify(k)}))`);
  const slot0 = async () => (await ls("subc.build")).slots[0];
  const click = (sel) => evalJS(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return false; b.click(); return true; })()`).then(r => sleep(250).then(() => r));
  const check = (name, got, want) => { out[name] = JSON.stringify(got) === JSON.stringify(want) ? "ok" : { got, want }; };

  // 1. migration: ids → the creature's own copies, libraries untouched, saved builds too
  let s0 = await slot0();
  check("migrated slot", [s0.artifact && s0.artifact.name, (s0.gems || []).length, "spellGemIds" in s0, "artifactId" in s0], ["Lib Sword", 2, false, false]);
  check("libraries kept", [(await ls("subc.artifacts")).length, (await ls("subc.spellgems")).length], [1, 3]);
  const saved = (await ls("subc.builds"))[0].build.slots[0];
  check("saved build migrated", [saved.artifact && saved.artifact.name, (saved.gems || []).length, "spellGemIds" in saved], ["Lib Sword", 2, false]);

  // 2. Spells page: both gems match a library design → "In library"; Remove of a saved gem is one tap
  await act("creature-spells", { slot: "0" });
  check("spells page tiles", await evalJS(`[document.querySelectorAll('.spell-page-tile').length, [...document.querySelectorAll('[data-action="sgp-lib"]')].map(b => b.textContent.trim())]`), [2, ["In library", "In library"]]);
  if (process.env.SHOT) await shot(process.env.SHOT + "_spells.png");
  await act("sgp-rm", { i: "0" });
  check("remove saved gem", (await slot0()).gems.length, 1);

  // 3. picker: Equip adds a copy; same spell twice is refused
  await act("spellpage-back");
  await act("sg-equip", { id: "11" });
  check("dup spell refused", (await slot0()).gems.length, 1);
  await act("sg-equip", { id: "10" }); await act("sg-equip", { id: "12" });
  check("equip copies", (await slot0()).gems.map(g => [typeof g.id, g.tier]), [["undefined", 15], ["undefined", 15], ["undefined", 15]]);

  // 4. edit the creature's copy → the library design is unchanged; then Save to library adds it
  await act("sg-mine"); await act("sgp-edit", { i: "0" });
  await evalJS(`(() => { const r = document.querySelector('[data-action="sg-tier"]'); r.value = "5"; r.dispatchEvent(new Event("input", { bubbles: true })); })()`); await sleep(250);
  await act("sg-save");
  s0 = await slot0();
  check("edit own copy", [s0.gems[0].tier, (await ls("subc.spellgems")).find(g => g.id === 11).tier], [5, 15]);
  check("page after edit", await evalJS(`[...document.querySelectorAll('[data-action="sgp-lib"]')].map(b => b.textContent.trim())`), ["Save to library", "In library", "In library"]);
  await click('[data-action="sgp-lib"][data-i="0"]');
  check("save to library", (await ls("subc.spellgems")).length, 4);

  // 5. Remove of a creature-only gem needs two taps; deleting a library gem leaves the creature's copy
  await act("sg-mine"); await act("sgp-edit", { i: "1" });
  await evalJS(`(() => { const r = document.querySelector('[data-action="sg-tier"]'); r.value = "3"; r.dispatchEvent(new Event("input", { bubbles: true })); })()`); await sleep(250);
  await act("sg-save");
  await click('[data-action="sgp-rm"][data-i="1"]');
  check("one tap keeps unsaved gem", (await slot0()).gems.length, 3);
  await click('[data-action="sgp-rm"][data-i="1"]');
  check("second tap removes", (await slot0()).gems.length, 2);
  await act("spellpage-done");
  await act("open-spellgems"); await act("sg-sel", { id: "12" });
  await click('[data-action="sg-del"]'); await click('[data-action="sg-del"]');
  check("library delete keeps copy", [(await ls("subc.spellgems")).some(g => g.id === 12), (await slot0()).gems.length], [false, 2]);
  await act("close-ovl");

  // 6. artifacts: page for the creature's own copy; deleting the library design keeps it; Save to library re-adds
  await act("equip-artifact", { slot: "0" });
  check("artifact page", await evalJS(`[!!document.querySelector('[data-action="artpage-unequip"]'), document.querySelector('[data-action="artpage-savelib"]').textContent.trim()]`), [true, "In library"]);
  if (process.env.SHOT) await shot(process.env.SHOT + "_artifact.png");
  check("matching design preselected", await evalJS(`document.querySelector('[data-action="art-del"]').dataset.id`), "7");
  await click('[data-action="art-del"]'); await click('[data-action="art-del"]');
  check("library artifact delete keeps copy", [(await ls("subc.artifacts")).length, (await slot0()).artifact && (await slot0()).artifact.name], [0, "Lib Sword"]);
  await act("artpage-savelib");
  const lib = await ls("subc.artifacts");
  check("artifact save to library", [lib.length, lib[0] && lib[0].netherIds], [1, [1]]);
  await act("close-detail"); await act("close-ovl");

  // 7. Nether Stone clash: the design shares stone 1 with creature 0's artifact → creature 1 can't equip it
  await act("equip-artifact", { slot: "1" });
  await act("art-equip", { id: String(lib[0].id) });
  check("stone clash blocks equip", (await ls("subc.build")).slots[1].artifact, null);
  // the builder's Nether Stone list still renders while a party artifact holds a stone; that stone shows locked
  await act("art-new"); await act("artb-next"); await act("art-slot", { t: "nether" });
  check("builder nether list", await evalJS(`[document.querySelectorAll('.art-side .prop-row').length > 0, !!document.querySelector('.art-side .prop-row.locked.nether-clash')]`), [true, true]);
  await act("close-ovl");

  // 8. export → import round trip: the creature's own gems + artifact come back; the stone is reused, not duplicated
  const before = await slot0(), stones = (await ls("subc.nether")).length;
  await act("open-bio"); await act("bio-mode", { v: "export" }); await sleep(1500);
  const text = await evalJS(`document.querySelector('textarea.bio-text').value`);
  await act("bio-mode", { v: "import" });
  await evalJS(`(() => { const t = document.querySelector('textarea.bio-text'); t.value = ${JSON.stringify(text)}; t.dispatchEvent(new Event("input", { bubbles: true })); })()`);
  await act("bio-run"); await sleep(1500);
  out["import ran"] = [/SUC1:/.test(text), await evalJS(`document.querySelector('.overlay-panel').textContent.replace(/\s+/g, " ").slice(0, 160)`)];
  await act("bio-done");
  const after = await slot0(), gemKey = (g) => [g.spellId, g.tier, [...g.propIds].sort()];
  check("round trip gems", after.gems.map(gemKey), before.gems.map(gemKey));
  check("round trip artifact", [after.artifact.name, after.artifact.primary, after.artifact.netherIds.length, (await ls("subc.nether")).length], [before.artifact.name, before.artifact.primary, 1, stones]);
  out.scrollW = await evalJS(`[document.documentElement.scrollWidth, innerWidth]`);
};
