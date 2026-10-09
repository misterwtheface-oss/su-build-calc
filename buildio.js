/* Siralim Ultimate Companion — buildio.js
 * Build import / export (BUILD_IO.md). One payload shape for a whole build; two text forms:
 *   • the SUC1 code line — the entire payload, compressed (lossless app ↔ app sharing)
 *   • game-style text — the in-game "Export Build" layout (_su_extract code/EXPORT_BUILD_FINDINGS.md), which this
 *     module PARSES (players bring builds from the game) and WRITES (readable view of an app build; level 1 + the
 *     app's own stats). The game has no build import, so nothing here targets the game.
 * No DOM and no app state: app.js passes lookups via SU_BUILDIO.create(env); runs under Node (tools/buildio_test.mjs). */
(function (root) {
  "use strict";
  const CODE_PREFIX = "SUC1:";
  const COMPANION_HDR = "========== SU COMPANION ==========";
  const STAT_KEYS = ["hp", "atk", "def", "int", "spd"];
  const STAT_NAME = { hp: "Health", atk: "Attack", int: "Intelligence", def: "Defense", spd: "Speed" };
  const EXPORT_ORDER = ["hp", "atk", "int", "def", "spd"];   // the game prints Health, Attack, Intelligence, Defense, Speed
  const DASHES = "------------------------------";
  const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");

  // ── code line: JSON → deflate-raw → base64url ────────────────────────────────
  const b64url = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64url = (str) => { const s = atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)); const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; };
  async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
  async function encodeCode(payload) {
    const json = new TextEncoder().encode(JSON.stringify(payload));
    return CODE_PREFIX + b64url(await pipe(json, new CompressionStream("deflate-raw")));
  }
  // finds the first SUC1 code anywhere in the pasted text (the code is one unbroken base64url run)
  const findCode = (text) => { const m = String(text || "").match(/SUC1:([A-Za-z0-9_-]+)/); return m ? m[1] : null; };
  async function decodeCode(code) {
    const bytes = await pipe(unb64url(code), new DecompressionStream("deflate-raw"));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (!p || p.v !== 1 || !Array.isArray(p.slots)) throw new Error("Not a Companion build code (unknown version).");
    return p;
  }

  // ── library dedupe (import reuses an exact duplicate instead of adding a copy) ──
  // Both sides are in LIBRARY form (spell props carry the spell id). Order-insensitive; a stone's icon only counts
  // when the incoming one carries it (game exports don't), rarity only when both have one (the app can't set it).
  const sortedJoin = (arr) => (arr || []).map(String).sort().join(",");
  const stonePropSig = (props) => sortedJoin((props || []).map(p => p.cat === "trait" ? `t|${p.key}`
    : p.cat === "spell" ? `s|${p.key}|${p.trigger || "On Attack"}` : `${p.cat}|${p.key}|${Number(p.value) || 0}`));
  function sameStone(lib, inc) {
    if (!lib || !inc) return false;
    if (String(lib.name || "").trim() !== String(inc.name || "").trim()) return false;
    if (inc.icon && lib.icon !== inc.icon) return false;
    if (lib.rarity != null && inc.rarity != null && lib.rarity !== inc.rarity) return false;
    return stonePropSig(lib.props) === stonePropSig(inc.props);
  }
  // artifact body without its stone (the caller compares stones by content, never by id)
  function sameArtifactBody(lib, inc) {
    if (!lib || !inc) return false;
    return String(lib.name || "").trim() === String(inc.name || "").trim() && (lib.rank || 50) === (inc.rank || 50) && lib.primary === inc.primary
      && ["stat", "trick", "traits", "spells"].every(k => sortedJoin(lib[k]) === sortedJoin(inc[k]));
  }

  function create(env) {
    const { D } = env;
    const CREA_BY_NAME = new Map(D.creatures.map(c => [norm(c.name), c]));
    const SPEC_BY_LABEL = new Map(D.specs.map(s => [norm(s.label), s]));
    const SPELL_BY_NAME = new Map(D.spells.map(s => [norm(s.name), s]));
    const SPELL_BY_KEY = new Map(D.spells.map(s => [s.key, s]));
    const PROP_BY_KEY = new Map(D.spellProps.map(p => [p.key, p]));
    const PERS_BY_NAME = new Map(D.personalities.map(p => [norm(p.name), p]));
    const RELIC_BY_SHORT = new Map(D.relics.map(r => [norm(String(r.name).split(",")[0]), r]));
    const ITEM_BY_TRAIT = new Map(); for (const t of D.traitItems) if (t.traitName && !ITEM_BY_TRAIT.has(norm(t.traitName))) ITEM_BY_TRAIT.set(norm(t.traitName), t);
    const PRIMARY_BY_STAT = new Map(D.artifact.primary.map(p => [norm(p.stat), p]));
    const PROP_BY_NAME = new Map(); for (const g of ["stat", "trick"]) for (const p of D.artifact[g]) if (!PROP_BY_NAME.has(norm(p.property))) PROP_BY_NAME.set(norm(p.property), { group: g, property: p.property });
    const ANOINT_BY_NAME = new Map(env.anointList().map(a => [norm(a.name), a]));
    const TRIGGERS = env.NETHER_TRIGGERS;   // ["On Attack", …]

    // ── payload from app state (the code line carries this) ────────────────────
    // ids are code-grounded (creatures, relics, trait items, specs, skins); spells + gem properties travel by KEY so
    // a data rebuild that renumbers them can't scramble a shared build.
    function payloadFromApp(build, libs) {
      const art = (id) => libs.artifacts.find(a => a.id === id), stone = (id) => libs.nether.find(n => n.id === id), gem = (id) => libs.spellGems.find(g => g.id === id);
      const spellKey = (id) => (env.SPELL.get(id) || {}).key || null;
      const stoneOut = (n) => n ? { name: n.name, icon: n.icon || null, rarity: n.rarity ?? null,
        props: (n.props || []).map(p => p.cat === "spell" ? { cat: "spell", spell: spellKey(p.key), trigger: p.trigger || null } : { cat: p.cat, key: p.key, value: p.value ?? null }) } : null;
      return { v: 1, spec: build.specId ?? null, perkAlloc: build.perkAlloc || {}, anoints: (build.anoints || []).map(a => ({ specId: a.specId, key: a.key })),
        slots: build.slots.map(s => {
          if (!s || s.cid == null) return null;
          const a = s.artifactId != null ? art(s.artifactId) : null;
          return { cid: s.cid, fusion: s.fusion ?? null, personality: s.personality || null, scrolls: s.scrolls || {}, skinId: s.skinId ?? null, fuseColor: s.fuseColor ?? null,
            relic: s.relic ? { id: s.relic.id, rank: s.relic.rank } : null,
            artifact: a ? { name: a.name, rank: a.rank || 50, primary: a.primary || null, stat: a.stat || [], trick: a.trick || [], traits: a.traits || [],
              spells: (a.spells || []).map(spellKey).filter(Boolean), nether: stoneOut(stone((a.netherIds || [])[0])) } : null,
            gems: (s.spellGemIds || []).map(gem).filter(Boolean).map(g => ({ name: g.name || "", spell: spellKey(g.spellId), tier: g.tier ?? null,
              props: (g.propIds || []).map(pid => (env.SPELLPROP.get(pid) || {}).key).filter(Boolean) })) };
        }) };
    }

    // ── game-style text → payload (+ warnings) ─────────────────────────────────
    // Structure per EXPORT_BUILD_FINDINGS.md (English labels). Tolerant of the app's own export (Level 1, no
    // character stats) and of missing optional lines. Anything unresolved becomes a warning, never a guess.
    function parseGameText(text) {
      const warn = [], lines = String(text || "").replace(/\r/g, "").split("\n");
      const out = { v: 1, spec: null, perkAlloc: {}, anoints: [], slots: [], source: "game" };
      let i = 0;
      const ci = lines.findIndex(l => /^=+ CHARACTER =+\s*$/.test(l.trim()));
      if (ci >= 0) {
        const head = (lines[ci + 1] || "").replace(/\s*\(Ascended\)\s*$/, "");
        const specName = head.includes(",") ? head.slice(head.lastIndexOf(",") + 1).trim() : head.trim();
        const sp = SPEC_BY_LABEL.get(norm(specName));
        if (sp) out.spec = sp.id; else if (specName) warn.push(`Specialization "${specName}" not recognised.`);
        const an = lines.slice(ci, ci + 12).find(l => /^Anointments:/.test(l.trim()));
        if (an) for (const nm of an.trim().replace(/^Anointments:\s*/, "").split(",").map(x => x.trim()).filter(Boolean)) {
          const a = ANOINT_BY_NAME.get(norm(nm)); if (a) out.anoints.push({ specId: a.specId, key: a.key }); else warn.push(`Anointment "${nm}" not recognised.`);
        }
      }
      const cr = lines.findIndex(l => /^=+ CREATURES =+\s*$/.test(l.trim()));
      if (cr < 0) { if (ci < 0) throw new Error("This doesn't look like a Siralim Ultimate build export (no CHARACTER / CREATURES sections)."); return { payload: out, warnings: warn }; }
      // creature blocks are separated by the 30-dash line; stop at the companion header
      const blocks = []; let cur = [];
      for (i = cr + 1; i < lines.length; i++) {
        const l = lines[i];
        if (l.trim() === COMPANION_HDR || /^SUC1:/.test(l.trim())) break;
        if (/^-{20,}\s*$/.test(l.trim())) { if (cur.length) blocks.push(cur); cur = []; continue; }
        cur.push(l);
      }
      if (cur.some(l => l.trim())) blocks.push(cur);
      for (const b of blocks.slice(0, 6)) out.slots.push(parseCreature(b, warn));
      while (out.slots.length < 6) out.slots.push(null);
      if (out.spec != null) warn.push("Perk ranks aren't part of the game export — all perks set to max.");
      return { payload: out, warnings: warn };
    }
    function parseCreature(b, warn) {
      const L = b.map(l => l.replace(/\s+$/, ""));
      const lvl = L.find(l => /^Level \S+ /.test(l.trim()));
      if (!lvl) return null;
      const name = lvl.trim().replace(/^Level \S+ /, "");
      const c = CREA_BY_NAME.get(norm(name)); if (!c) { warn.push(`Creature "${name}" not recognised — slot left empty.`); return null; }
      const slot = { cid: c.id, fusion: null, personality: null, scrolls: {}, skinId: null, fuseColor: null, relic: null, artifact: null, gems: [] };
      const val = (re) => { const l = L.find(x => re.test(x.trim())); return l ? l.trim().replace(re, "").trim() : null; };
      const fus = val(/^Fused with /); if (fus) { const f = CREA_BY_NAME.get(norm(fus)); if (f) slot.fusion = f.id; else warn.push(`${c.name}: fusion "${fus}" not recognised.`); }
      const per = val(/^Personality:/); if (per) { const p = PERS_BY_NAME.get(norm(per)); if (p) slot.personality = p.key; else warn.push(`${c.name}: personality "${per}" not recognised.`); }
      for (const k of STAT_KEYS) {   // "Attack (15) : 107267" → 15 stat scrolls
        const m = L.map(x => x.trim()).map(x => x.match(new RegExp(`^${STAT_NAME[k]}\\s*\\((\\d+)\\)\\s*:`))).find(Boolean);
        if (m && +m[1]) slot.scrolls[k] = +m[1];
      }
      // artifact block: "Artifact: Name" then " "-prefixed lines; a blank line then the nether stone's properties
      const ai = L.findIndex(l => /^Artifact:/.test(l.trim()));
      if (ai >= 0) slot.artifact = parseArtifact(L, ai, c.name, warn);
      const gi = L.findIndex(l => /^Spell Gems:/.test(l.trim()));
      if (gi >= 0) for (let j = gi + 1; j < L.length && L[j].trim(); j++) {
        const sp = SPELL_BY_NAME.get(norm(L[j])); if (sp) slot.gems.push({ name: "", spell: sp.key, tier: null, props: [] }); else warn.push(`${c.name}: spell gem "${L[j].trim()}" not recognised.`);
      }
      const rl = val(/^Relic:/);
      if (rl) { const m = rl.match(/^(.*?)\s*\(Rank (\d+)\)\s*$/); const r = RELIC_BY_SHORT.get(norm(m ? m[1] : rl));
        if (r) slot.relic = { id: r.id, rank: m ? +m[2] : 100 }; else warn.push(`${c.name}: relic "${rl}" not recognised.`); }
      return slot;
    }
    function parseArtifact(L, ai, who, warn) {
      const name = L[ai].trim().replace(/^Artifact:\s*/, "").replace(/\s*\[awakenedartifact\]\s*$/, "").trim();
      const a = { name: name || "Imported Artifact", rank: 50, primary: null, stat: [], trick: [], traits: [], spells: [], nether: null };
      let j = ai + 1, first = true;
      const numLine = (t) => t.match(/^(\d+(?:\.\d+)?)(%?)\s+(.+)$/);
      for (; j < L.length && L[j].trim(); j++) {
        const t = L[j].trim(); if (/^\(Empty .* Slot\)$/.test(t)) { first = false; continue; }
        const m = numLine(t);
        if (m && first) {   // primary: "59% Attack" → type by stat, rank = highest rank with that value
          const p = PRIMARY_BY_STAT.get(norm(m[3]));
          if (p) { a.primary = p.property; const r = Object.keys(p.perRank).map(Number).filter(r => p.perRank[r] === +m[1]); if (r.length) a.rank = Math.max(...r); else warn.push(`${who}: artifact level not inferred from "${t}" — set to 50.`); }
          else warn.push(`${who}: artifact primary "${t}" not recognised.`);
          first = false; continue;
        }
        first = false;
        if (m) { const g = PROP_BY_NAME.get(norm(m[3])); if (g) a[g.group].push(g.property); else warn.push(`${who}: artifact property "${t}" not recognised.`); continue; }
        const nm = t.match(/^(.*\S)\s*\((\d+)\)$/);   // nether stone "Name (rarity)"
        if (nm && !SPELL_BY_NAME.has(norm(t)) && !ITEM_BY_TRAIT.has(norm(t))) { a.nether = { name: nm[1], icon: null, rarity: +nm[2], props: [] }; continue; }
        const ti = ITEM_BY_TRAIT.get(norm(t)); if (ti && !a.traits.length) { a.traits.push(ti.id); continue; }
        const sp = SPELL_BY_NAME.get(norm(t)); if (sp && !a.spells.length) { a.spells.push(sp.key); continue; }
        warn.push(`${who}: artifact line "${t}" not recognised.`);
      }
      a.stat = a.stat.slice(0, 3); a.trick = a.trick.slice(0, 2);
      if (a.nether) {   // stone properties follow one blank line
        for (j = j + 1; j < L.length && L[j].trim(); j++) {
          const t = L[j].trim();
          if (/^Trait Slot:|^Spell Gems:|^Relic:/.test(t)) break;
          const tr = t.match(/^Trait:\s*(.+)$/);
          if (tr) { const ti = ITEM_BY_TRAIT.get(norm(tr[1])); if (ti) a.nether.props.push({ cat: "trait", key: ti.id, value: null }); else warn.push(`${who}: nether trait "${tr[1]}" not recognised.`); continue; }
          const m = numLine(t);
          if (m) { const g = PROP_BY_NAME.get(norm(m[3])); if (g) a.nether.props.push({ cat: g.group, key: g.property, value: +m[1] }); else warn.push(`${who}: nether property "${t}" not recognised.`); continue; }
          const trig = TRIGGERS.find(x => t.endsWith(" " + x));
          const sp = trig && SPELL_BY_NAME.get(norm(t.slice(0, -trig.length)));
          if (sp) a.nether.props.push({ cat: "spell", spell: sp.key, trigger: trig }); else warn.push(`${who}: nether line "${t}" not recognised.`);
        }
      }
      return a;
    }

    // ── payload → readable game-style text (level 1, the app's stats) ──────────
    // `view` per slot (from app.js): { final:{hp..}, traits:[{label,name,desc}], gemNames:[], artLines:[], stoneLines:[], traitSlot }
    function readableText(payload, views) {
      const spec = payload.spec != null ? D.specs.find(s => s.id === payload.spec) : null;
      const anoints = payload.anoints.map(a => { const s = D.specs.find(x => x.id === a.specId); const p = s && s.perks.find(x => x.key === a.key); return p ? p.name : null; }).filter(Boolean);
      const out = ["========== CHARACTER ==========", `Companion Build, ${spec ? spec.label : "No Specialization"}`, ""];
      if (anoints.length) out.push(`Anointments: ${anoints.join(", ")}`);
      out.push("", "========== CREATURES ==========");
      payload.slots.forEach((s, i) => {
        if (!s) return;
        const v = views[i], c = env.CREA.get(s.cid), f = s.fusion != null ? env.CREA.get(s.fusion) : null;
        out.push(`Level 1 ${c ? c.name : "?"}`);
        if (f) out.push(`Fused with ${f.name}`);
        const p = s.personality ? D.personalities.find(x => x.key === s.personality) : null;
        if (p) out.push(`Personality: ${p.name}`);
        out.push(` ${c ? c.race : "?"} / ${v.cls || "?"}`, "");
        for (const k of EXPORT_ORDER) { const n = (s.scrolls || {})[k] || 0; out.push(`${STAT_NAME[k]}${n ? ` (${n}) ` : ""}: ${v.final[k]}`); }
        out.push("");
        for (const t of v.traits) out.push(`${t.label}: ${t.name}`, t.desc);
        if (s.artifact) {
          out.push("", `Artifact: ${s.artifact.name}`, ...v.artLines.map(l => " " + l));
          if (v.stoneLines.length) out.push("", ...v.stoneLines.map(l => " " + l));
          if (v.traitSlot) out.push("", `Trait Slot: ${v.traitSlot.name}: ${v.traitSlot.desc}`);
        }
        out.push("", "Spell Gems:", ...v.gemNames);
        if (s.relic) { const r = env.RELIC.get(s.relic.id); if (r) out.push("", `Relic: ${String(r.name).split(",")[0].trim()} (Rank ${s.relic.rank})`); }
        out.push(DASHES, "");
      });
      return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    async function exportText(payload, views) {
      return `${readableText(payload, views)}\n\n${COMPANION_HDR}\n${await encodeCode(payload)}`;
    }
    // pasted text → { payload, warnings, source: "code" | "game" }
    async function importText(text) {
      const code = findCode(text);
      if (code) { try { return { payload: await decodeCode(code), warnings: [], source: "code" }; }
        catch (e) { if (!/=+ CREATURES =+/.test(text)) throw new Error("The Companion build code is damaged or incomplete."); } }
      const r = parseGameText(text);
      return { ...r, source: "game" };
    }
    return { payloadFromApp, parseGameText, readableText, exportText, importText, encodeCode, decodeCode, SPELL_BY_KEY, PROP_BY_KEY };
  }

  const api = { create, sameStone, sameArtifactBody, encodeCode, decodeCode, findCode, CODE_PREFIX, COMPANION_HDR };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SU_BUILDIO = api;
})(typeof window !== "undefined" ? window : globalThis);
