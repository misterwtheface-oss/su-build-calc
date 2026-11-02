// Writes a legacy-format (library-id) localStorage seed for tools/smoke_owned_gear.mjs. usage: node tools/smoke_owned_gear_seed.mjs data.js seed.json
import fs from "node:fs"; import vm from "node:vm";
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(process.argv[2], "utf8"), ctx);
const D = ctx.window.SU_DATA;
const crea = D.creatures.find(c => c.cls === "Nature" && c.traitId != null);
const sp = D.spells.filter(s => s.cls === "Nature" && !s.battleOnly && !s.unused).slice(0, 3);
const prim = D.artifact.primary[0].property;
const nether = [{ id: 1, name: "Stone A", icon: null, props: [] }];
const artifacts = [{ id: 7, name: "Lib Sword", rank: 50, primary: prim, stat: [], trick: [], traits: [], spells: [], netherIds: [1], _gemMigrated: true, _rawSpell: true }];
const spellgems = sp.map((s, i) => ({ id: 10 + i, spellId: s.id, tier: 15, propIds: [] }));
const slot = (o) => ({ cid: null, fusion: null, artifactId: null, relic: null, spellGemIds: [], personality: null, scrolls: {}, skinId: null, ...o });
const slots = [slot({ cid: crea.id, artifactId: 7, spellGemIds: [10, 11] }), slot({ cid: crea.id }), slot({}), slot({}), slot({}), slot({})];
const build = { schema: 3, specIds: 2, skinIds: 2, specId: null, perkAlloc: {}, anoints: [], slots };
const builds = [{ id: 1, name: "Old", icon: null, ts: 1, build: JSON.parse(JSON.stringify(build)) }];
fs.writeFileSync(process.argv[3], JSON.stringify({ "subc.build": build, "subc.builds": builds, "subc.nether": nether, "subc.artifacts": artifacts, "subc.spellgems": spellgems }));
console.log(crea.name, sp.map(s => s.name).join(", "), prim);
