/* Siralim Ultimate Build Calculator — app.js
 * Build-first, overlay-driven, vanilla. State mutates then re-renders explicitly.
 * Persistence under subc.* ; scroll position is never reset on re-render. */
(() => {
  "use strict";
  const D = window.SU_DATA;
  if (!D) { document.getElementById("app").textContent = "data.js failed to load."; return; }

  // ── indices ──────────────────────────────────────────────────────────────
  const CREA = new Map(D.creatures.map(c => [c.id, c]));
  const SPEC = new Map(D.specs.map(s => [s.id, s]));
  const TRAIT = D.traits;                                   // id -> {name,desc,cls,produces,consumes,labels}
  const CLS_COLOR = Object.fromEntries(D.classes.map(c => [c.key, c.color]));
  const CLASS_BG = D.classBg || {};
  const GEM_ICONS = D.gemIcons || [];
  const STAT_KEYS = ["hp", "atk", "def", "int", "spd"];
  const STAT_LABEL = { hp: "Health", atk: "Attack", def: "Defense", int: "Intelligence", spd: "Speed" };
  const CORE_STATS = ["Health", "Attack", "Defense", "Intelligence", "Speed"];
  const PROP_STAT = { Health: "hp", Attack: "atk", Defense: "def", Intelligence: "int", Speed: "spd" };

  // artifact property groups + primary type icons
  const propGroups = new Map();  // name -> {group, entries:[{stat,unit,perRank}]}
  for (const g of ["stat", "trick"]) {
    for (const p of D.artifact[g]) {
      if (!propGroups.has(p.property)) propGroups.set(p.property, { group: g, name: p.property, entries: [] });
      propGroups.get(p.property).entries.push({ stat: p.stat, unit: p.unit, perRank: p.perRank });
    }
  }
  const PRIMARY = D.artifact.primary;                                    // 5 {property,stat,perRank,icon}
  const PRIMARY_ICON = Object.fromEntries(PRIMARY.map(p => [p.property, p.icon]));
  // artifact enchant materials: Stat slot = Ambers, Trick slot = Slates/Curios/Cripplers/… — each maps 1:1
  // to a stat/trick property. Slots still STORE the property name (calc + migration unchanged); the picker
  // and slot chips surface the real material (name + icon).
  const STATMAT = D.statMats || [];
  const TRICKMAT = D.trickMats || [];
  const MAT_BY_PROP = new Map();                                         // property name -> material {name,icon,property}
  for (const m of [...STATMAT, ...TRICKMAT]) MAT_BY_PROP.set(m.property, m);
  const TRAITITEM = new Map(D.traitItems.map(t => [t.id, t]));
  const SPELL = new Map((D.spells || []).map(s => [s.id, s]));
  const SPELLGEM = D.spellGems || {};                       // class -> class-coloured gem icon
  const spellIcon = (s) => s && s.cls ? SPELLGEM[s.cls] : null;
  const SPELLPROP = new Map((D.spellProps || []).map(p => [p.id, p]));   // spell-gem property items (Slates/Curios)
  const SPELLGEM_MAX_PROPS = 3;                             // each spell gem holds up to 3 property items
  // built spell-gem helpers (a gem = {id,name,spellId,propIds[]})
  const gemSpell = (g) => g ? SPELL.get(g.spellId) : null;
  const gemIcon = (g) => spellIcon(gemSpell(g));
  const gemName = (g) => g ? (g.name || (gemSpell(g) ? gemSpell(g).name : "Spell Gem")) : "";
  const gemSummary = (g) => { const s = gemSpell(g); const np = (g.propIds || []).length;
    return (s ? s.name : "—") + (np ? ` · ${np} propert${np === 1 ? "y" : "ies"}` : ""); };
  // fixed artifact slot template (all artifacts, max level): 1 primary + these; nether = 1 slot
  const ART_SLOTS = [
    { key: "stat", label: "Stat", max: 3, pick: "stat" },
    { key: "trick", label: "Trick", max: 2, pick: "trick" },
    { key: "traits", label: "Trait", max: 1, pick: "trait" },
    { key: "spells", label: "Spell", max: 1, pick: "spell" },
    { key: "netherIds", label: "Nether", max: 1, pick: "nether" },
  ];
  const RELIC = new Map(D.relics.map(r => [r.id, r]));

  // ── persistence (schema 2) ─────────────────────────────────────────────────
  const LS = { build: "subc.build", cards: "subc.cards", nether: "subc.nether", artifacts: "subc.artifacts", spellgems: "subc.spellgems" };
  const jload = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? dflt : v; } catch { return dflt; } };
  const jsave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const emptySlot = () => ({ cid: null, fusion: null, artifactId: null, relic: null, spellGemIds: [] });
  let build = jload(LS.build, null);
  // schema 2 stored perkAlloc as a binary de-allocation map ({key:1} = deallocated).
  // schema 3 stores an allocated rank count ({key:R}; absent key = fully allocated = maxRanks).
  // migrate in place so the current party survives: each old-present key (deallocated) → rank 0.
  if (build && build.schema === 2) {
    for (const sid of Object.keys(build.perkAlloc || {})) {
      const m = build.perkAlloc[sid]; for (const k of Object.keys(m)) m[k] = 0;
    }
    build.schema = 3;
  }
  if (!build || build.schema !== 3) build = { schema: 3, specId: null, perkAlloc: {}, slots: Array.from({ length: 6 }, emptySlot) };
  build.perkAlloc = build.perkAlloc || {};
  build.anoints = Array.isArray(build.anoints) ? build.anoints : [];   // equipped anointments [{specId,key}], max 5
  while (build.slots.length < 6) build.slots.push(emptySlot());
  build.slots = build.slots.map(s => Object.assign(emptySlot(), s));
  build.slots.forEach(s => { if (!Array.isArray(s.spellGemIds)) s.spellGemIds = []; });

  let cards = jload(LS.cards, null);                        // { levels: {cardId: 0..3} } — absent == 3 (max)
  if (!cards || !cards.levels) cards = { levels: {} };
  let nether = jload(LS.nether, null);                      // [{id,name,icon,props:[{cat,key,value}]}]
  if (!Array.isArray(nether)) nether = [];
  // migrate nether props to the category model {cat,key,value}: old {type,stats[]} and {prop,value} → {cat,key,value}
  for (const n of nether) {
    if (Array.isArray(n.props)) {
      const flat = [];
      for (const p of n.props) {
        if (!p) continue;
        if (p.cat) { flat.push(p); continue; }                    // already migrated
        if (p.stats) for (const s of p.stats) flat.push({ cat: (propGroups.get(s.stat) || {}).group || "stat", key: s.stat, value: Number(s.value) || 0 });
        else if (p.prop) flat.push({ cat: (propGroups.get(p.prop) || {}).group || "stat", key: p.prop, value: Number(p.value) || 0 });
      }
      n.props = flat;
    }
    n.props ||= [];
  }
  let artifacts = jload(LS.artifacts, null);                // [{id,name,rank,primary,stat[],trick[],traits[],spells[],netherIds[]}]
  if (!Array.isArray(artifacts)) artifacts = [];
  // migrate old artifacts (props[]/traitItemIds[]) → fixed slot template
  for (const a of artifacts) {
    if (a.props || a.traitItemIds) {
      const props = a.props || [];
      a.stat = props.filter(n => { const g = D.artifact.stat.find(x => x.property === n); return !!g; }).slice(0, 3);
      const statSet = new Set(a.stat);
      a.trick = props.filter(n => !statSet.has(n) && D.artifact.trick.find(x => x.property === n)).slice(0, 2);
      a.traits = (a.traitItemIds || []).slice(0, 1);
      a.spells = a.spells || [];
      a.netherIds = (a.netherIds || []).slice(0, 1);
      delete a.props; delete a.traitItemIds;
    }
    a.stat ||= []; a.trick ||= []; a.traits ||= []; a.spells ||= []; a.netherIds ||= [];
    if (!a._gemMigrated) { a.spells = []; a._gemMigrated = true; }   // artifact.spells now holds spell-GEM ids, not raw spells
  }

  // spell gems (built entities: 1 spell + up to 3 property items) — slottable into artifacts or creatures
  let spellGems = jload(LS.spellgems, null);                // [{id,name,spellId,propIds:[]}]
  if (!Array.isArray(spellGems)) spellGems = [];

  const persistBuild = () => jsave(LS.build, build);
  const persistCards = () => jsave(LS.cards, cards);
  const persistNether = () => jsave(LS.nether, nether);
  const persistArtifacts = () => jsave(LS.artifacts, artifacts);
  const persistSpellGems = () => jsave(LS.spellgems, spellGems);
  let nextNetherId = nether.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;
  let nextArtId = artifacts.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
  let nextSpellGemId = spellGems.reduce((m, g) => Math.max(m, g.id || 0), 0) + 1;

  const cardLevel = (id) => cards.levels[id] == null ? 3 : cards.levels[id];

  // ── util ─────────────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clsColor = (cls) => CLS_COLOR[cls] || "var(--border-dim)";
  function textOn(hex) {
    const h = String(hex).replace("#", ""); if (h.length < 6) return "#fff";
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#150e26" : "#fff";
  }
  const spriteImg = (src, cls) =>
    src ? `<img src="${esc(src)}" alt="" class="${cls || ""}" onerror="this.style.visibility='hidden'">` : "";
  const critFace = (c) => c.sprite ? spriteImg(c.sprite)
    : `<div class="crit-face" style="--face-cls:${clsColor(c.cls)}">${esc((c.name || "?").trim()[0] || "?")}</div>`;

  // translate {PARAM} tokens to plain words (bolded) + drop [icon] tokens; escape the rest.
  const TERMS = D.terms || {};
  function termWord(tok) {
    if (TERMS[tok]) return TERMS[tok];
    const m = tok.match(/^(?:CONDNAME_(?:BUFF|DEBUFF|MINION)_|CONDDESC_(?:BUFF|DEBUFF|MINION)_|CDESC_|CONDNAME_|STAT_|ACTION_|RACE_|SPELL_|CLASS_)(.+)$/);
    const raw = m ? m[1] : tok;
    return raw.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim() || tok;
  }
  const fmtNum = (n) => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  // richText: {TOKEN} → bold plain word, [icon] dropped, <N> → the value scaled by `rank`.
  // In perk descriptions <N> is the PER-RANK increment, so the shown value is N × rank
  // (e.g. "<1> random buffs" at rank 3 → "3 random buffs"). Only perks carry <N>.
  function richText(str, rank) {
    if (!str) return "";
    const s = String(str), re = /\{([A-Za-z0-9_]+)\}|\[[a-z0-9_]+\]|<(\d+(?:\.\d+)?)>/g;
    let out = "", last = 0, m;
    while ((m = re.exec(s))) {
      out += esc(s.slice(last, m.index));
      if (m[1] != null) out += `<b class="param">${esc(termWord(m[1]))}</b>`; // {TOKEN} → bold word; [icon] dropped
      else if (m[2] != null) { const per = parseFloat(m[2]); out += `<b class="param">${fmtNum(rank != null ? per * rank : per)}</b>`; }
      last = re.lastIndex;
    }
    return (out + esc(s.slice(last))).replace(/\\n|\n/g, "<br>"); // literal \n and real newlines → line breaks
  }

  // perk / anointment descriptions append the referenced condition's full tooltip as a
  // {CONDDESC_*}/{CDESC_*} block (e.g. "…gains {CONDNAME_MINION_ANIMATEDWEAPON}.\n\n{CONDDESC_…}").
  // That appendix is redundant here and blows up the row height — strip it (and its leading
  // blank lines) so every perk row is a tight, uniform "effect only" line.
  const stripCondDesc = (desc) =>
    String(desc || "").replace(/(?:\\n|\n|\s)*\{C(?:OND)?DESC_[A-Za-z0-9_]+\}/g, "").trim();
  const perkText = (desc, rank) => richText(stripCondDesc(desc), rank);

  // taxonomy filter: a creature's innate trait's human-facing tags ("Category::Value")
  const creatureTaxo = (c) => {
    const t = c.traitId != null ? TRAIT[c.traitId] : null;
    return t && t.taxo ? t.taxo : [];
  };
  // index of taxonomy values that match ≥1 member of a source list, grouped by category
  // (counts only hide empty values — never displayed, per minimal-chrome). Source-parameterized so
  // creatures, trait-items, (later) spell gems / perks can each reuse the same drill-down picker.
  const TAXO_IDX_CACHE = {};
  function taxoIndexFor(key, items, getTags) {
    if (TAXO_IDX_CACHE[key]) return TAXO_IDX_CACHE[key];
    const counts = new Map();
    for (const it of items) for (const k of getTags(it)) counts.set(k, (counts.get(k) || 0) + 1);
    const byCat = new Map();
    for (const catObj of (D.taxonomy ? D.taxonomy.categories : [])) {
      const rows = [];
      for (const val of catObj.values) {
        const kk = catObj.category + "::" + val;
        if (counts.get(kk)) rows.push({ val, key: kk });
      }
      if (rows.length) byCat.set(catObj.category, rows);
    }
    TAXO_IDX_CACHE[key] = byCat;
    return byCat;
  }
  const taxoIndex = () => taxoIndexFor("crea", D.creatures, creatureTaxo);
  const taxoValName = (k) => { const i = k.indexOf("::"); return i < 0 ? k : k.slice(i + 2); };
  const taxoCatName = (k) => { const i = k.indexOf("::"); return i < 0 ? "" : k.slice(0, i); };

  let RACE_OPTIONS = null;
  function raceOptions() {
    if (RACE_OPTIONS) return RACE_OPTIONS;
    RACE_OPTIONS = [...new Set(D.creatures.map(c => c.race).filter(Boolean))].sort();
    return RACE_OPTIONS;
  }

  // ── stat computation (fusion + artifact + socketed nether) ─────────────────
  function resolveArtifact(slot) { return slot.artifactId != null ? artifacts.find(a => a.id === slot.artifactId) : null; }
  function baseStats(slot) {
    const c = CREA.get(slot.cid); if (!c) return null;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const avg = (a, b) => f ? Math.round((a + b) / 2) : a;
    const out = { fused: !!f };
    for (const k of STAT_KEYS) out[k] = avg(c[k], f ? f[k] : 0);
    out.cls = f ? (f.cls || c.cls) : c.cls;                 // secondary's class on fusion
    out.traitIds = [c.traitId, f ? f.traitId : null].filter(x => x != null);
    out.total = STAT_KEYS.reduce((s, k) => s + out[k], 0);
    return out;
  }
  // % contribution per base stat from an artifact object (primary + props + socketed nether)
  function artifactPctOf(a) {
    const out = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
    if (!a) return out;
    const rank = a.rank || 50;
    if (a.primary) { const p = PRIMARY.find(x => x.property === a.primary); if (p) { const k = PROP_STAT[p.stat]; if (k) out[k] += (p.perRank[rank] || 0); } }
    for (const name of [...(a.stat || []), ...(a.trick || [])]) {
      const grp = propGroups.get(name); if (!grp) continue;
      for (const e of grp.entries) { const k = PROP_STAT[e.stat]; if (k) out[k] += (e.perRank[rank] || 0); }
    }
    for (const nid of a.netherIds || []) {
      const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const pr of n.props || []) {
        if (pr.cat !== "stat" && pr.cat !== "trick") continue;   // only stat/trick properties hit the stat table
        const grp = propGroups.get(pr.key);
        if (grp) { for (const e of grp.entries) { const k = PROP_STAT[e.stat]; if (k) out[k] += (Number(pr.value) || 0); } }
        else { const k = PROP_STAT[pr.key]; if (k) out[k] += (Number(pr.value) || 0); }
      }
    }
    return out;
  }
  const artifactPct = (slot) => artifactPctOf(resolveArtifact(slot));
  function finalStats(slot) {
    const b = baseStats(slot); if (!b) return null;
    const pct = artifactPct(slot);
    const final = {};
    for (const k of STAT_KEYS) final[k] = Math.round(b[k] * (1 + pct[k] / 100));
    return { base: b, pct, final, total: STAT_KEYS.reduce((s, k) => s + final[k], 0) };
  }
  function slotTraitIds(slot) {
    const b = baseStats(slot); const ids = b ? [...b.traitIds] : [];
    const a = resolveArtifact(slot);
    if (a) for (const tid of a.traits || []) { const ti = TRAITITEM.get(tid); if (ti && ti.traitId != null) ids.push(ti.traitId); }
    return ids;
  }

  function traitBanner(tid, opts = {}) {
    const t = TRAIT[tid]; if (!t) return "";
    const color = clsColor(t.cls);
    const label = opts.label || t.name;
    return `<span class="trait-banner" data-action="nav-trait" data-tid="${tid}"
      style="--aff-color:${color};--aff-text:${textOn(color === "var(--border-dim)" ? "#6d5a2e" : color)}" title="${esc(t.name)}">
      <span class="trait-banner-label">${esc(label)}</span></span>`;
  }
  const artIcon = (a) => a && a.primary ? PRIMARY_ICON[a.primary] : null;

  // ── HOME (build-first) ─────────────────────────────────────────────────────
  function render() {
    const app = el("app");
    const scroll = app.scrollTop;
    app.innerHTML = renderHome();
    app.scrollTop = scroll;
  }

  function renderHome() {
    const spec = build.specId != null ? SPEC.get(build.specId) : null;
    const specTile = `
      <div class="spec-tile ${spec ? "filled" : ""}" data-action="pick-spec" title="Specialization">
        <div class="spec-tile-icon">${spec && spec.sprite ? spriteImg(spec.sprite) : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="spec-tile-label">${spec ? esc(spec.label) : "Specialization"}</div>
        ${spec ? `<div class="spec-tile-sub">${allocatedPerks(spec).length}/${spec.perks.length} perks · ${specPoints(spec)} pts</div>` : ""}
        ${spec ? `<button class="slot-remove" data-action="clear-spec" title="Remove">✕</button>` : ""}
      </div>`;

    const anointTile = `
      <div class="spec-tile anoint-tile ${build.anoints.length ? "filled" : ""}" data-action="open-anoint" title="Anointments">
        <div class="spec-tile-icon"><span class="spec-tile-plus">✦</span></div>
        <div class="spec-tile-label">Anointments</div>
        ${build.anoints.length ? `<div class="spec-tile-sub">${build.anoints.length}/${ANOINT_MAX} equipped</div>` : ""}
      </div>`;

    const slots = build.slots.map((s, i) => renderSlot(s, i)).join("");
    return `
      <div class="home-top">${specTile}${anointTile}</div>
      <div class="section-label">Party — 6 Creatures</div>
      <div class="party-grid">${slots}</div>
      ${renderPartySummary()}
    `;
  }

  function renderSlot(slot, i) {
    const c = CREA.get(slot.cid);
    if (!c) {
      return `<div class="slot" data-slot="${i}">
        <div class="slot-sprite-wrap" data-action="pick-creature" data-slot="${i}"><div class="slot-empty-icon">＋</div></div>
        <div class="slot-name">Empty</div><div class="slot-sub">Tap to add a creature</div></div>`;
    }
    const b = baseStats(slot);
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const cls = b.cls;
    const a = resolveArtifact(slot);
    return `<div class="slot filled" data-slot="${i}" style="--slot-cls:${clsColor(cls)}">
      <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
      <div class="slot-sprite-wrap" data-action="creature-detail" data-slot="${i}">${critFace(c)}</div>
      <div class="slot-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
      <div class="slot-sub"><span class="cls-chip" style="color:${clsColor(cls)}">${esc(cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
      <div class="slot-actions">
        <button class="slot-mini ${f ? "on" : ""}" data-action="pick-creature" data-slot="${i}" title="Edit creature / fusion">${f ? "Edit ⚭" : "Edit"}</button>
        <button class="slot-mini ${a ? "on" : ""}" data-action="equip-artifact" data-slot="${i}" title="Artifact">${a ? "Artifact ✓" : "Artifact"}</button>
        <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
        <button class="slot-mini ${(slot.spellGemIds || []).length ? "on" : ""}" data-action="creature-spells" data-slot="${i}" title="Spell gems (up to 3)">Spells${(slot.spellGemIds || []).length ? ` ${slot.spellGemIds.length}` : ""}</button>
      </div></div>`;
  }

  function renderPartySummary() {
    const filled = build.slots.filter(s => s.cid != null);
    if (!filled.length) return "";
    const rows = build.slots.map((s) => {
      const c = CREA.get(s.cid); if (!c) return "";
      const fs = finalStats(s);
      return `<div class="stat-row"><span class="stat-name">${esc(c.name)}</span>
        <span class="stat-val base">${fs.final.hp}</span><span class="stat-val">${fs.final.atk}</span>
        <span class="stat-val">${fs.final.def}</span><span class="stat-val total">${fs.total}</span></div>`;
    }).join("");
    return `<div class="party-summary"><div class="section-label">Party</div>
      <div class="stat-grid">
        <div class="stat-header"><span>Creature</span><span style="text-align:right">HP</span>
          <span style="text-align:right">ATK</span><span style="text-align:right">DEF</span><span style="text-align:right">Total</span></div>
        ${rows}</div></div>`;
  }

  // ── overlay plumbing ───────────────────────────────────────────────────────
  const OV = el("overlay-root"), DOV = el("detail-overlay-root");
  let ovState = null, dovState = null, specAnimTimer = null;

  // Animate the spec info-panel costume: front-facing 2-frame walk, alternate 8× then advance a tier (cycles).
  function syncSpecAnim() {
    if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; }
    if (!ovState || ovState.kind !== "spec" || ovState.sel == null) return;
    const spec = SPEC.get(ovState.sel);
    const tiers = (spec && spec.costumes ? spec.costumes : []).filter(c => c.frames && c.frames.length >= 2);
    const img = OV.querySelector("#specCostume img");
    if (!img || !tiers.length) return;
    let ti = 0, fr = 0, swaps = 0;
    specAnimTimer = setInterval(() => {
      fr ^= 1; swaps++;
      img.src = tiers[ti].frames[fr];
      if (swaps >= 8) { swaps = 0; fr = 0; ti = (ti + 1) % tiers.length; }
    }, 280);
  }
  const SCROLLERS = [".ovl-center-scroll", ".ovl-left", ".ovl-right", ".art-side-list"];

  function openOverlay(html) { OV.innerHTML = html; OV.classList.remove("hidden"); }
  function closeOverlay() { if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } OV.classList.add("hidden"); OV.innerHTML = ""; ovState = null; }
  function openDetail(html) { DOV.innerHTML = html; DOV.classList.remove("hidden"); }
  function closeDetail() { DOV.classList.add("hidden"); DOV.innerHTML = ""; dovState = null; }

  function refreshOverlay() {
    if (!ovState) return;
    const panel = OV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? e.scrollTop : 0; });
    panel.outerHTML = ovState.render();
    const p2 = OV.querySelector(".overlay-panel");
    SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
    maybeFocusSearch(OV);
    syncSpecAnim();
  }
  function refreshDetail() {
    if (!dovState) return;
    const panel = DOV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? e.scrollTop : 0; });
    panel.outerHTML = dovState.render();
    const p2 = DOV.querySelector(".overlay-panel");
    SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
  }
  function maybeFocusSearch(root) {
    const input = root.querySelector(".ovl-search");
    const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (input && !isTouch) input.focus();
  }

  // ── creature selector — guided wizard: 1) creature  2) fusion (or skip) → commit ──
  // editing a filled slot re-opens the same wizard pre-filled so either half can change.
  function openCreaturePicker(slotIdx) {
    const slot = build.slots[slotIdx];
    ovState = {
      kind: "creature", slotIdx, step: "primary",
      primaryId: slot.cid, fusionId: slot.fusion,
      search: "", clsFilter: null, raceFilter: null, taxoFilters: [],
      render: renderCreaturePicker,
    };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const creaStepSel = (st) => st.step === "fusion" ? st.fusionId : st.primaryId;
  function creatureMatches(c, st) {
    if (st.clsFilter && c.cls !== st.clsFilter) return false;
    if (st.raceFilter && c.race !== st.raceFilter) return false;
    if (st.taxoFilters.length) { const tx = creatureTaxo(c); if (!st.taxoFilters.every(k => tx.includes(k))) return false; }
    if (st.search) { const q = st.search.toLowerCase(); if (!c.name.toLowerCase().includes(q) && !(c.race || "").toLowerCase().includes(q)) return false; }
    return true;
  }
  function renderCreaturePicker() {
    const st = ovState, fusion = st.step === "fusion";
    const sel = creaStepSel(st);
    const list = D.creatures.filter(c => creatureMatches(c, st));
    const shown = list.slice(0, 400);
    const selC = sel != null ? CREA.get(sel) : null;
    const primaryC = st.primaryId != null ? CREA.get(st.primaryId) : null;

    const facet = (lbl, val, action) =>
      `<button class="facet ${val ? "on" : ""}" data-action="${action}">${lbl}${val ? `: <b>${esc(val)}</b>` : ""}${val ? ` <span class="facet-x" data-action="${action}-clear">✕</span>` : " ▾"}</button>`;
    const taxoChips = st.taxoFilters.map((k, i) =>
      `<button class="facet on tag" data-action="rm-taxo" data-i="${i}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`).join("");
    const filterbar = `<div class="ovl-filterbar">
      ${facet("Class", st.clsFilter, "facet-class")}
      ${facet("Race", st.raceFilter, "facet-race")}
      ${taxoChips}
      <button class="facet add" data-action="facet-taxo">＋ Filter</button>
    </div>`;

    // fusion step leads with a "No fusion" tile so skipping is a first-class choice
    const noFuseTile = fusion ? `
      <div class="pick-tile nofuse ${st.fusionId == null ? "selected" : ""}" data-action="crea-nofuse">
        <div class="pt-sprite"><span class="nofuse-glyph">∅</span></div>
        <div class="pt-name">No fusion</div>
      </div>` : "";
    const tiles = noFuseTile + shown.map(c => `
      <div class="pick-tile ${sel === c.id ? "selected" : ""}" data-action="crea-pick" data-id="${c.id}">
        <span class="pt-cls" style="--pt-cls:${clsColor(c.cls)}"></span>
        <div class="pt-sprite">${critFace(c)}</div>
        <div class="pt-name">${esc(c.name)}</div>
      </div>`).join("");

    const title = fusion ? "2 · Fusion partner (optional)" : "1 · Choose creature";
    const steps = `<div class="art-steps">
      <span class="art-step ${!fusion ? "on" : "done"}">1 · Creature</span>
      <span class="art-step-sep">›</span>
      <span class="art-step ${fusion ? "on" : ""}">2 · Fusion</span></div>`;
    const footer = fusion
      ? `<button class="btn-ghost" data-action="crea-back">‹ Back</button>
         <button class="btn-confirm" data-action="crea-confirm" ${st.primaryId == null ? "disabled" : ""}>${st.fusionId == null ? "Commit (no fusion)" : "Commit fusion"}</button>`
      : `<button class="btn-ghost" data-action="close-ovl">Cancel</button>
         <button class="btn-confirm" data-action="crea-next" ${st.primaryId == null ? "disabled" : ""}>Next: Fusion ›</button>`;
    // right panel: the currently-highlighted pick, plus the fusion preview once both are chosen
    let side = "";
    if (fusion && primaryC && (selC || st.fusionId != null)) side = renderFusionPreview(primaryC, selC);
    else if (selC) side = renderCreatureIdentity(selC);

    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>${title}</h2>${steps}
        <input class="ovl-search" placeholder="Search name / race…" value="${esc(st.search)}" data-action="crea-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center">${filterbar}
          <div class="ovl-center-scroll"><div class="pick-grid">${tiles}</div>
            ${list.length > 400 ? `<div class="slot-sub" style="margin-top:10px">Showing 400 of ${list.length} — refine your filters.</div>` : ""}</div>
        </div>
        <div class="ovl-right">${side}</div>
      </div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }
  // creature info panel: trait leads, stat table follows (per house layout)
  function renderCreatureIdentity(c) {
    return `<div style="text-align:center">${critFace(c)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(c.name)}</h3>
      <div class="slot-sub" style="margin-bottom:10px"><span style="color:${clsColor(c.cls)};font-weight:700">${esc(c.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
      ${c.traitId != null ? `<div class="section-label">Innate trait</div>
        <div class="primary-traits" style="margin-bottom:12px">${traitBanner(c.traitId)}<div class="trait-desc">${richText((TRAIT[c.traitId] || {}).desc || "")}</div></div>` : ""}
      <div class="section-label">Base stats</div>
      <div class="stat-grid single">
        ${STAT_KEYS.map(k => `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span>
          <span class="stat-val total">${c[k]}</span></div>`).join("")}
        <div class="stat-row hl-med"><span class="stat-name">Total</span><span class="stat-val total">${c.total}</span></div></div>`;
  }
  // fusion preview: averaged stats + secondary's class + both innate traits (codex-accurate)
  function renderFusionPreview(primary, secondary) {
    if (!secondary) return renderCreatureIdentity(primary);
    const avg = (a, b) => Math.round((a + b) / 2);
    const traitIds = [primary.traitId, secondary.traitId].filter(x => x != null);
    return `<div style="text-align:center">${critFace(primary)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(primary.name)} <span style="color:var(--accent2)">⚭</span> ${esc(secondary.name)}</h3>
      <div class="slot-sub" style="margin-bottom:10px">Class → <span style="color:${clsColor(secondary.cls)};font-weight:700">${esc(secondary.cls || "—")}</span></div>
      <div class="section-label">Traits (both)</div>
      <div style="margin-bottom:12px">${traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("")}</div>
      <div class="section-label">Fused base stats (averaged)</div>
      <div class="stat-grid single">
        ${STAT_KEYS.map(k => `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span>
          <span class="stat-val total">${avg(primary[k], secondary[k])}</span></div>`).join("")}
        <div class="stat-row hl-med"><span class="stat-name">Total</span><span class="stat-val total">${STAT_KEYS.reduce((s, k) => s + avg(primary[k], secondary[k]), 0)}</span></div></div>`;
  }

  // ── facet sub-picker (Class / Race / Tag) on the detail layer ───────────────
  // opts.idx = taxonomy index to browse (defaults to creatures); opts.onPick = callback for taxo-val
  function openFacetPicker(kind, opts = {}) {
    dovState = { kind: "facet", facet: kind, search: "", render: renderFacetPicker,
                 idx: opts.idx || null, onPick: opts.onPick || null };
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderFacetPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    const idx = st.idx || taxoIndex();
    let opts, title, back = "";
    if (st.facet === "class") { title = "Filter by Class"; opts = D.classes.map(c => ({ v: c.key, label: c.key, color: c.color })); }
    else if (st.facet === "race") { title = "Filter by Race"; opts = raceOptions().map(r => ({ v: r, label: r })); }
    else if (st.facet === "taxo-cat") { title = "Filter by mechanic"; opts = [...idx.keys()].map(cat => ({ v: cat, label: cat })); }
    else { // taxo-val
      title = st.taxoCat;
      back = `<button class="facet" data-action="taxo-back">‹ Categories</button>`;
      opts = (idx.get(st.taxoCat) || []).map(r => ({ v: r.key, label: r.val }));
    }
    if (q) opts = opts.filter(o => o.label.toLowerCase().includes(q));
    const rows = opts.slice(0, 400).map(o =>
      `<button class="opt-row" data-action="facet-pick" data-v="${esc(o.v)}">${o.color ? `<span class="opt-dot" style="background:${o.color}"></span>` : ""}${esc(o.label)}${st.facet === "taxo-cat" ? ` <span class="opt-chev">›</span>` : ""}</button>`).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail facet-panel">
      <div class="overlay-header"><h2>${esc(title)}</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="facet-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        ${back ? `<div class="ovl-filterbar">${back}</div>` : ""}
        <div class="ovl-center-scroll"><div class="opt-list">${rows}</div>
        ${opts.length > 400 ? `<div class="slot-sub" style="margin-top:8px">Showing 400 of ${opts.length}.</div>` : ""}</div></div></div>
    </div></div>`;
  }

  // ── specialization selector ────────────────────────────────────────────────
  function openSpecPicker() {
    ovState = { kind: "spec", search: "", sel: build.specId, render: renderSpecPicker };
    openOverlay(ovState.render()); maybeFocusSearch(OV); syncSpecAnim();
  }
  // ── perk allocation (rank-based) ───────────────────────────────────────────
  const perkMax = (p) => p.ranks || 1;
  function perkRank(spec, p) { const m = build.perkAlloc[spec.id] || {}; return (p.key in m) ? m[p.key] : perkMax(p); }
  function setPerkRank(spec, p, r) {
    const m = build.perkAlloc[spec.id] = build.perkAlloc[spec.id] || {};
    r = Math.max(0, Math.min(perkMax(p), r));
    if (r === perkMax(p)) delete m[p.key]; else m[p.key] = r; // absence = fully allocated
  }
  const allocatedPerks = (spec) => spec.perks.filter(p => perkRank(spec, p) > 0);
  const specPoints = (spec) => spec.perks.reduce((s, p) => s + (p.cost || 0) * perkRank(spec, p), 0);
  function renderSpecPicker() {
    const st = ovState;
    const q = st.search.trim().toLowerCase();
    const list = D.specs.filter(s => !q || s.label.toLowerCase().includes(q)).slice().sort((a, b) => a.label.localeCompare(b.label));
    const sel = st.sel != null ? SPEC.get(st.sel) : null;
    const tiles = list.map(s => `
      <div class="pick-tile spec-pick ${st.sel === s.id ? "selected" : ""}" data-action="spec-pick" data-id="${s.id}">
        <div class="pt-sprite emblem">${spriteImg(s.emblem || s.sprite, "px")}</div><div class="pt-name">${esc(s.label)}</div></div>`).join("");
    let info = "";
    if (sel) {
      const allocCount = allocatedPerks(sel).length, pts = specPoints(sel);
      const perkList = sel.perks.map(p => {
        const r = perkRank(sel, p), mx = perkMax(p), on = r > 0;
        const badge = mx > 1 ? `<span class="perk-rankbadge">${r}/${mx}</span>` : (on ? `<span class="perk-rankbadge">✓</span>` : "");
        const ico = p.icon ? `<span class="perk-ico sm">${spriteImg(p.icon, "px")}</span>` : `<span class="perk-ico sm empty"></span>`;
        return `<div class="perk-line ${on ? "on" : "off"}">${ico}
          <div class="perk-line-body">
            <div class="perk-line-head"><b>${esc(p.name)}</b>${badge}</div>
            ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
          </div></div>`;
      }).join("");
      const cos0 = sel.costumes && sel.costumes.length ? sel.costumes[0] : null;
      const costumeImg = cos0 ? (cos0.frames && cos0.frames[0]) || cos0.img : sel.sprite;
      info = `<div class="spec-info">
        <div class="spec-info-sprite costume" id="specCostume">${spriteImg(costumeImg, "px")}</div>
        <h2 class="spec-info-name">${esc(sel.label)}</h2>
        <div class="trait-desc spec-play">${richText(sel.playstyle || sel.description || "")}</div>
        <div class="section-label" style="margin-top:12px">Perks — ${allocCount}/${sel.perks.length} allocated · ${pts} pts</div>
        <div class="perk-list">${perkList}</div>
      </div>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Choose Specialization</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="spec-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center"><div class="ovl-center-scroll"><div class="pick-grid spec-grid">${tiles}</div></div></div>
        <div class="ovl-right spec-right">${info}</div>
      </div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>
          <button class="btn-ghost" data-action="close-ovl">Cancel</button>
          <button class="btn-ghost" data-action="customize-perks" ${sel ? "" : "disabled"}>Customize</button>
          <button class="btn-confirm" data-action="spec-confirm" ${st.sel == null ? "disabled" : ""}>Confirm</button>
        </div></div>
    </div></div>`;
  }

  // ── perk selector (Customize) — per-perk rank stepper (default fully allocated) ─
  function openPerkPicker(specId) {
    dovState = { kind: "perks", specId, search: "", render: renderPerkPicker };
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderPerkPicker() {
    const st = dovState, spec = SPEC.get(st.specId);
    const q = st.search.trim().toLowerCase();
    const list = spec.perks.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.desc || "").toLowerCase().includes(q))
      && (!st.perkTaxo || (p.taxo || []).includes(st.perkTaxo)));
    // inline taxonomy drill-down over THIS spec's perks (values with ≥1 member only)
    const valsByCat = new Map();
    for (const p of spec.perks) for (const k of (p.taxo || [])) {
      const c = taxoCatName(k); if (!valsByCat.has(c)) valsByCat.set(c, new Set()); valsByCat.get(c).add(k);
    }
    let taxobar;
    if (st.perkTaxo) taxobar = `<button class="facet on tag" data-action="perk-taxo-clear">${esc(taxoCatName(st.perkTaxo))}: <b>${esc(taxoValName(st.perkTaxo))}</b> <span class="facet-x">✕</span></button>`;
    else if (st.perkCat) taxobar = `<button class="facet" data-action="perk-taxo-back">‹</button>` +
      [...valsByCat.get(st.perkCat) || []].sort().map(k => `<button class="facet" data-action="perk-taxo-val" data-v="${esc(k)}">${esc(taxoValName(k))}</button>`).join("");
    else if (st.perkBrowse) taxobar = `<button class="facet" data-action="perk-taxo-back">‹</button>` +
      [...valsByCat.keys()].sort().map(c => `<button class="facet" data-action="perk-taxo-cat" data-c="${esc(c)}">${esc(c)} ›</button>`).join("");
    else taxobar = `<button class="facet add" data-action="perk-taxo-open">＋ Filter</button>`;
    const allocCount = allocatedPerks(spec).length, pts = specPoints(spec);
    const rows = list.map(p => {
      const r = perkRank(spec, p), mx = perkMax(p), on = r > 0;
      const k = esc(p.key);
      const stepper = `<div class="perk-stepper">
        <button class="perk-step" data-action="perk-dec" data-k="${k}" ${r <= 0 ? "disabled" : ""}>−</button>
        <span class="perk-rank-val">${r}<span class="perk-rank-max">/${mx}</span></span>
        <button class="perk-step" data-action="perk-inc" data-k="${k}" ${r >= mx ? "disabled" : ""}>+</button>
        ${mx > 1 ? `<button class="perk-step wide" data-action="perk-max" data-k="${k}" ${r >= mx ? "disabled" : ""}>Max</button>` : ""}
        <button class="perk-step wide" data-action="perk-zero" data-k="${k}" ${r <= 0 ? "disabled" : ""}>0</button></div>`;
      const costLine = p.cost != null ? `<span class="perk-meta">${p.cost} pt${p.cost === 1 ? "" : "s"}/rank${on ? ` · ${p.cost * r} spent` : ""}</span>` : "";
      const ico = p.icon ? `<div class="perk-ico">${spriteImg(p.icon, "px")}</div>` : `<div class="perk-ico empty"></div>`;
      return `<div class="perk-row ${on ? "on" : "off"}">
        ${ico}<div class="perk-row-main">
          <div class="perk-row-head"><b>${esc(p.name)}</b>${costLine}</div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
          ${stepper}</div></div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(spec.label)} — Perks</h2>
        <input class="ovl-search" placeholder="Search perks…" value="${esc(st.search)}" data-action="perk-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="ovl-filterbar"><button class="chip" data-action="perk-all">Max all</button><button class="chip" data-action="perk-none">Clear all</button>${taxobar}</div>
        <div class="ovl-center-scroll"><div class="perk-picker">${rows}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info">${allocCount}/${spec.perks.length} allocated · ${pts} pts</span>
        <button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }

  // ── anointments — equip up to 5 anointment-eligible perks from any spec (flags from Perk_REF.csv) ──
  // In-game, anointments let you slot perks from OTHER specializations; the cap is 5 equipped.
  const ANOINT_MAX = 5;
  let ANOINTS = null;
  function anointList() {
    if (ANOINTS) return ANOINTS;
    ANOINTS = [];
    for (const s of D.specs) for (const p of s.perks) if (p.anointment) ANOINTS.push({ ...p, spec: s.label, specId: s.id });
    ANOINTS.sort((a, b) => a.spec.localeCompare(b.spec) || a.name.localeCompare(b.name));
    return ANOINTS;
  }
  const anointEquipped = (a) => build.anoints.some(x => x.specId === a.specId && x.key === a.key);
  const equippedAnointObjs = () => build.anoints.map(x => anointList().find(a => a.specId === x.specId && a.key === x.key)).filter(Boolean);
  function openAnoint() {
    ovState = { kind: "anoint", search: "", taxoFilters: [], render: renderAnoint };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const anointTaxoIndex = () => taxoIndexFor("anoint", anointList(), a => a.taxo || []);
  function renderAnoint() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = anointList().filter(a =>
      (!q || a.name.toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q)) &&
      (!st.taxoFilters.length || st.taxoFilters.every(k => (a.taxo || []).includes(k))));
    const taxoChips = st.taxoFilters.map((k, i) =>
      `<button class="facet on tag" data-action="rm-taxo" data-i="${i}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`).join("");
    const filterbar = `<div class="ovl-filterbar">${taxoChips}<button class="facet add" data-action="anoint-taxo">＋ Filter</button></div>`;
    const groups = {};
    for (const a of list) (groups[a.spec] ||= []).push(a);
    const full = build.anoints.length >= ANOINT_MAX;
    const body = Object.keys(groups).sort().map(sp => `
      <div class="section-label anoint-grp">${esc(sp)}</div>
      ${groups[sp].map(a => { const on = anointEquipped(a); return `<div class="perk-line ${on ? "equipped" : ""}">
        <span class="perk-ico sm">${a.icon ? spriteImg(a.icon, "px") : ""}</span>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta">${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}${a.ranks > 1 ? `<span class="perk-rankbadge" title="Anointments apply this perk at rank 1">R1</span>` : ""}</span></div>
          ${a.desc ? `<div class="perk-desc">${perkText(a.desc, 1)}</div>` : ""}
        </div>
        <button class="slot-mini anoint-eq ${on ? "on" : ""}" data-action="anoint-toggle" data-sid="${a.specId}" data-k="${esc(a.key)}" ${(!on && full) ? "disabled" : ""}>${on ? "Equipped ✓" : "Equip"}</button>
        </div>`; }).join("")}`).join("")
      || `<div class="slot-sub" style="padding:10px">No anointments match.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Anointments</h2>
        <input class="ovl-search" placeholder="Search anointments…" value="${esc(st.search)}" data-action="anoint-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        ${filterbar}
        <div class="ovl-center-scroll"><div class="perk-list">${body}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info">${build.anoints.length}/${ANOINT_MAX} equipped${full ? " · full" : ""}</span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── artifact library (equip) ───────────────────────────────────────────────
  function openArtifactLibrary(slotIdx) {
    ovState = { kind: "artlib", slotIdx, render: renderArtifactLibrary };
    openOverlay(ovState.render());
  }
  function artifactSummary(a) {
    const parts = [];
    if (a.primary) parts.push(a.primary);
    const n = (a.stat || []).length + (a.trick || []).length + (a.traits || []).length + (a.spells || []).length + (a.netherIds || []).length;
    if (n) parts.push(`${n}/8 slots`);
    return `R${a.rank} · ` + (parts.join(" · ") || "empty");
  }
  function renderArtifactLibrary() {
    const st = ovState, manage = st.slotIdx == null;
    const slot = manage ? null : build.slots[st.slotIdx], c = slot ? CREA.get(slot.cid) : null;
    const equippedId = slot ? slot.artifactId : null;
    const tiles = artifacts.map(a => `
      <div class="lib-tile ${equippedId === a.id ? "equipped" : ""}">
        <div class="lib-icon" data-action="${manage ? "art-edit" : "art-equip"}" data-id="${a.id}">${spriteImg(artIcon(a), "px")}</div>
        <div class="lib-name">${esc(a.name)}</div>
        <div class="lib-sub">${esc(artifactSummary(a))}</div>
        <div class="lib-actions">
          ${manage ? "" : `<button class="slot-mini" data-action="art-equip" data-id="${a.id}">${equippedId === a.id ? "Equipped" : "Equip"}</button>`}
          <button class="slot-mini" data-action="art-edit" data-id="${a.id}">Edit</button>
          <button class="slot-mini danger" data-action="art-del" data-id="${a.id}">✕</button>
        </div></div>`).join("") || `<div class="slot-sub" style="padding:10px">No artifacts yet — build one.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Artifacts${manage ? "" : " — " + esc(c ? c.name : "")}</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="lib-grid">${tiles}</div></div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>${equippedId != null ? `<button class="btn-ghost" data-action="art-unequip">Unequip</button>` : ""}
        <button class="btn-confirm" data-action="art-new">＋ Build new artifact</button></div></div>
    </div></div>`;
  }

  // ── artifact builder — guided wizard: 1) pick artifact  2) fill slots  3) name ──
  function openArtifactBuilder(artId, slotIdx) {
    let draft;
    if (artId != null) draft = JSON.parse(JSON.stringify(artifacts.find(a => a.id === artId)));
    else draft = { id: null, name: `Artifact ${nextArtId}`, rank: 50, primary: null, stat: [], trick: [], traits: [], spells: [], netherIds: [] };
    // editing an existing artifact jumps straight to the slots step
    ovState = { kind: "artbuild", artId, slotIdx, draft, step: artId != null ? "slots" : "type", pickType: null, search: "", render: renderArtifactBuilder };
    openOverlay(ovState.render());
  }
  const artStepLabels = { type: "1 · Pick artifact", slots: "2 · Fill slots", name: "3 · Name it" };
  function renderArtStepbar(step) {
    return `<div class="art-steps">${["type", "slots", "name"].map(s =>
      `<span class="art-step ${s === step ? "on" : ""} ${["type", "slots", "name"].indexOf(s) < ["type", "slots", "name"].indexOf(step) ? "done" : ""}">${artStepLabels[s]}</span>`).join("<span class='art-step-sep'>›</span>")}</div>`;
  }
  // artifact slots step — right-hand info panel: picker list › item preview (confirm) › live bonus
  const artSlotKey = (type) => (ART_SLOTS.find(s => s.pick === type) || {}).key;
  const artHas = (a, type, v) => (a[artSlotKey(type)] || []).includes(v);
  function renderArtPicker(st, a, rank) {
    const type = st.pickType, q = st.search.trim().toLowerCase();
    const has = (v) => artHas(a, type, v);
    const matchTaxo = (taxo) => q && (taxo || []).some(k => taxoValName(k).toLowerCase().includes(q));
    let rows = "";
    if (type === "stat" || type === "trick") {
      const pool = type === "stat" ? STATMAT : TRICKMAT;
      rows = pool.filter(m => !q || m.name.toLowerCase().includes(q) || m.property.toLowerCase().includes(q)).map(m => {
        const g = propGroups.get(m.property);
        const val = g ? g.entries.map(e => PROP_STAT[e.stat] ? `+${e.perRank[rank]}%` : e.perRank[rank]).join(" / ") : "";
        return `<div class="prop-row ${has(m.property) ? "chosen" : ""}" data-action="art-preview" data-t="${type}" data-v="${esc(m.property)}">
          <span class="prop-ico">${m.icon ? spriteImg(m.icon, "px") : ""}</span>
          <span class="prop-name">${esc(m.name)}</span><span class="prop-val">${esc(val)}</span></div>`;
      }).join("");
    } else if (type === "trait") {
      rows = D.traitItems.filter(t => t.traitName
          && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q) || matchTaxo(t.taxo))
          && (!st.traitTaxo || (t.taxo || []).includes(st.traitTaxo))).slice(0, 300)
        .map(t => `<div class="prop-row ${has(t.id) ? "chosen" : ""}" data-action="art-preview" data-t="trait" data-v="${t.id}">
          <span class="prop-ico">${t.icon ? spriteImg(t.icon, "px") : ""}</span>
          <span class="prop-name">${esc(t.name)}</span><span class="prop-stat">${esc(t.traitName)}</span></div>`).join("");
    } else if (type === "spell") {
      rows = spellGems.filter(g => { const sp = gemSpell(g); return !q || gemName(g).toLowerCase().includes(q) || (sp && matchTaxo(sp.taxo)); }).map(g =>
        `<div class="prop-row ${has(g.id) ? "chosen" : ""}" data-action="art-preview" data-t="spell" data-v="${g.id}">
          <span class="prop-ico">${gemIcon(g) ? spriteImg(gemIcon(g), "px") : ""}</span>
          <span class="prop-name">${esc(gemName(g))}</span></div>`).join("")
        || `<div class="slot-sub" style="padding:8px">No spell gems yet — build them from the top-bar “Spell Gems” button.</div>`;
    } else {
      rows = nether.filter(n => !q || n.name.toLowerCase().includes(q)).map(n => `<div class="prop-row ${has(n.id) ? "chosen" : ""}" data-action="art-preview" data-t="nether" data-v="${n.id}">
          <span class="prop-ico">${spriteImg(gemPath(n.icon), "px")}</span>
          <span class="prop-name">${esc(n.name)}</span></div>`).join("")
        || `<div class="slot-sub" style="padding:8px">No Nether Stones yet — add them from the top-bar “Nether Stones” button.</div>`;
    }
    const traitFilter = type === "trait"
      ? (st.traitTaxo
          ? `<button class="facet on tag" data-action="artb-traitfilter-clear">${esc(taxoCatName(st.traitTaxo))}: <b>${esc(taxoValName(st.traitTaxo))}</b> <span class="facet-x">✕</span></button>`
          : `<button class="facet add" data-action="artb-traitfilter">＋ Filter</button>`)
      : "";
    const label = (ART_SLOTS.find(s => s.pick === type) || {}).label || "";
    return `<div class="art-side-head"><b>Add ${esc(label)}</b><button class="chip" data-action="artb-closecat">Done</button></div>
      <input class="ovl-search art-side-search" placeholder="Search by name or tag…" value="${esc(st.search)}" data-action="artb-search">
      ${traitFilter ? `<div class="art-side-filter">${traitFilter}</div>` : ""}
      <div class="art-side-list">${rows}</div>`;
  }
  // item preview with an explicit confirm — socketing never applies silently (shows the effect first)
  function renderArtPreview(type, v, rank, has) {
    let icon = null, name = String(v), sub = "", lines = "";
    if (type === "stat" || type === "trick") {
      const mat = MAT_BY_PROP.get(v), g = propGroups.get(v);
      icon = mat && mat.icon; name = mat ? mat.name : v; sub = v;
      lines = g ? g.entries.map(e => `<div class="art-pv-line">${PROP_STAT[e.stat] ? `<b>+${e.perRank[rank]}%</b> ${esc(e.stat)}` : `<b>${e.perRank[rank]}</b> ${esc(e.stat)}`}</div>`).join("") : "";
    } else if (type === "trait") {
      const t = TRAITITEM.get(v), tr = t && t.traitId != null ? TRAIT[t.traitId] : null;
      icon = t && t.icon; name = t ? t.name : v; sub = t ? `grants ${t.traitName}` : "";
      lines = tr ? `<div class="trait-desc">${perkText(tr.desc || "")}</div>` : `<div class="slot-sub">${esc(t ? t.traitName : "")}</div>`;
    } else if (type === "spell") {
      const g = spellGems.find(x => x.id === v), sp = gemSpell(g);
      icon = gemIcon(g); name = g ? gemName(g) : v; sub = g ? gemSummary(g) : "spell gem";
      lines = sp ? `<div class="trait-desc">${perkText(sp.desc || "")}</div>` : "";
    } else {
      const n = nether.find(x => x.id === v);
      icon = gemPath(n && n.icon); name = n ? n.name : v; sub = "nether stone";
      lines = n ? `<div class="trait-desc">${esc(netherSummary(n))}</div>` : "";
    }
    return `<div class="art-side-head"><button class="chip" data-action="art-preview-back">‹ Back</button></div>
      <div class="art-pv">
        <div class="art-pv-top"><div class="as-ico">${icon ? spriteImg(icon, "px") : "◆"}</div>
          <div><div class="art-pv-name">${esc(name)}</div><div class="slot-sub">${esc(sub)}</div></div></div>
        <div class="art-pv-body">${lines || `<div class="slot-sub">No numeric effect.</div>`}</div>
        <button class="btn-confirm ${has ? "danger-confirm" : ""}" data-action="art-confirm-add" data-t="${type}" data-v="${esc(String(v))}">${has ? "Remove from artifact" : "Add to artifact"}</button>
      </div>`;
  }
  function renderArtLiveBonus(a, rank, pct) {
    const chips = [
      ...(a.primary ? [`<span class="slot-chip filled">◆ ${esc(a.primary)}</span>`] : []),
      ...a.stat.map(n => { const m = MAT_BY_PROP.get(n); return `<span class="slot-chip filled">${esc(m ? m.name : n)}</span>`; }),
      ...a.trick.map(n => { const m = MAT_BY_PROP.get(n); return `<span class="slot-chip filled">${esc(m ? m.name : n)}</span>`; }),
      ...a.traits.map(id => { const t = TRAITITEM.get(id); return `<span class="slot-chip filled">✦ ${esc(t ? t.traitName : id)}</span>`; }),
      ...a.spells.map(id => { const g = spellGems.find(x => x.id === id); return `<span class="slot-chip filled">✷ ${esc(g ? gemName(g) : id)}</span>`; }),
      ...a.netherIds.map(id => { const n = nether.find(x => x.id === id); return `<span class="slot-chip filled">◈ ${esc(n ? n.name : id)}</span>`; }),
    ].join("") || `<span class="slot-sub">Tap a slot to add a material.</span>`;
    return `<div class="section-label">Live bonus · rank ${rank}</div>
      <div class="stat-grid single" style="margin-bottom:12px">
        ${STAT_KEYS.map(k => `<div class="stat-row ${pct[k] ? "hl-med" : ""}"><span class="stat-name">${STAT_LABEL[k]}</span>
          <span class="stat-val art">${pct[k] ? "+" + pct[k] + "%" : "—"}</span></div>`).join("")}</div>
      <div class="section-label">Contents</div><div>${chips}</div>`;
  }
  function renderArtifactBuilder() {
    const st = ovState, a = st.draft, rank = a.rank;
    const preview = artifactPctOf(a);
    let body = "", footer = "";

    if (st.step === "type") {
      const tiles = PRIMARY.map(p => `
        <div class="art-type-tile ${a.primary === p.property ? "chosen" : ""}" data-action="art-primary" data-p="${esc(p.property)}">
          <div class="att-ico">${spriteImg(p.icon, "px")}</div>
          <div class="att-name">${esc(p.property)}</div>
          <div class="att-stat">${esc(p.stat)} +${p.perRank[rank]}%</div></div>`).join("");
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
        <div class="rank-picker" style="margin-bottom:12px"><span class="slot-sub">Rank</span>
          <input type="range" min="1" max="50" value="${rank}" data-action="artb-rank"><span class="rank-badge">${rank}</span></div>
        <div class="art-type-grid">${tiles}</div></div></div>`;
      footer = `<button class="btn-ghost" data-action="artb-cancel">Cancel</button>
        <button class="btn-confirm" data-action="artb-next" ${a.primary ? "" : "disabled"}>Next: Fill slots ›</button>`;
    } else if (st.step === "slots") {
      // fixed slot template: 1 primary (from step 1) + stat×3 + trick×2 + trait×1 + spell×1 + nether×1
      const filledBox = (type, v) => {
        let ico = `<div class="as-ico glyph">◆</div>`, lab = v, sub = "";
        if (type === "stat" || type === "trick") { const mat = MAT_BY_PROP.get(v), g = propGroups.get(v);
          ico = `<div class="as-ico">${mat && mat.icon ? spriteImg(mat.icon, "px") : "◆"}</div>`;
          lab = mat ? mat.name : v;
          sub = g ? g.entries.map(e => PROP_STAT[e.stat] ? `+${e.perRank[rank]}%` : e.perRank[rank]).join(" / ") : ""; }
        else if (type === "trait") { const t = TRAITITEM.get(v); ico = `<div class="as-ico">${t && t.icon ? spriteImg(t.icon, "px") : "✦"}</div>`; lab = t ? t.name : v; sub = t ? t.traitName : ""; }
        else if (type === "spell") { const g = spellGems.find(x => x.id === v); const gi = gemIcon(g); ico = `<div class="as-ico">${gi ? spriteImg(gi, "px") : "✷"}</div>`; lab = g ? gemName(g) : v; sub = g ? gemSummary(g) : "spell gem"; }
        else if (type === "nether") { const n = nether.find(x => x.id === v); ico = `<div class="as-ico">${spriteImg(gemPath(n && n.icon), "px")}</div>`; lab = n ? n.name : v; sub = "nether"; }
        return `<div class="art-slot"><button class="as-rm" data-action="art-rm" data-t="${type}" data-v="${esc(v)}">✕</button>${ico}<div class="as-lab">${esc(lab)}</div><div class="as-sub">${esc(sub)}</div></div>`;
      };
      const primaryBox = a.primary
        ? (() => { const p = PRIMARY.find(x => x.property === a.primary); return `<div class="art-slot primary"><div class="as-ico">${spriteImg(p && p.icon, "px")}</div><div class="as-lab">${esc(a.primary)}</div><div class="as-sub">primary</div></div>`; })()
        : `<div class="art-slot add" data-action="artb-back"><div class="as-ico glyph">＋</div><div class="as-lab">Primary</div></div>`;
      const groupsHtml = [`<div class="art-slot-group"><div class="section-label">Primary</div><div class="art-slot-grid">${primaryBox}</div></div>`]
        .concat(ART_SLOTS.map(sl => {
          const arr = a[sl.key] || [];
          const boxes = [];
          for (let i = 0; i < sl.max; i++) boxes.push(arr[i] !== undefined ? filledBox(sl.pick, arr[i])
            : `<div class="art-slot add ${st.pickType === sl.pick ? "picking" : ""}" data-action="art-slot" data-t="${sl.pick}"><div class="as-ico glyph">＋</div><div class="as-lab">${sl.label}</div></div>`);
          return `<div class="art-slot-group"><div class="section-label">${sl.label}</div><div class="art-slot-grid">${boxes.join("")}</div></div>`;
        })).join("");

      // info panel (right): item preview (confirm) › picker list › live bonus — never appended below the slots
      let side;
      if (st.preview) side = renderArtPreview(st.preview.type, st.preview.value, rank, artHas(a, st.preview.type, st.preview.value));
      else if (st.pickType) side = renderArtPicker(st, a, rank);
      else side = renderArtLiveBonus(a, rank, preview);
      body = `<div class="ovl-center"><div class="ovl-center-scroll">${groupsHtml}</div></div>
        <div class="ovl-right art-side">${side}</div>`;
      footer = `<button class="btn-ghost" data-action="artb-back">‹ Back</button>
        <button class="btn-confirm" data-action="artb-next">Next: Name ›</button>`;
    } else { // name
      const chips = [
        ...(a.primary ? [`<span class="slot-chip filled">◆ ${esc(a.primary)}</span>`] : []),
        ...a.stat.map(n => { const m = MAT_BY_PROP.get(n); return `<span class="slot-chip filled">${esc(m ? m.name : n)}</span>`; }),
        ...a.trick.map(n => { const m = MAT_BY_PROP.get(n); return `<span class="slot-chip filled">${esc(m ? m.name : n)}</span>`; }),
        ...a.traits.map(id => { const t = TRAITITEM.get(id); return `<span class="slot-chip filled">✦ ${esc(t ? t.traitName : id)}</span>`; }),
        ...a.spells.map(id => { const g = spellGems.find(x => x.id === id); return `<span class="slot-chip filled">✷ ${esc(g ? gemName(g) : id)}</span>`; }),
        ...a.netherIds.map(id => { const n = nether.find(x => x.id === id); return `<span class="slot-chip filled">◈ ${esc(n ? n.name : id)}</span>`; }),
      ].join("") || `<span class="slot-chip">No slots filled</span>`;
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
        <div class="build-section"><h3>Name your artifact</h3>
          <input class="ovl-search name-field" placeholder="Artifact name" value="${esc(a.name)}" data-action="artb-name" style="max-width:320px"></div>
        <div class="build-section"><h3>Contents</h3><div>${chips}</div></div>
        <div class="build-section"><h3>Live bonus (rank ${rank})</h3><div class="stat-grid">
          ${STAT_KEYS.map(k => `<div class="stat-row ${preview[k] ? "hl-med" : ""}"><span class="stat-name">${STAT_LABEL[k]}</span>
            <span class="stat-val art" style="grid-column:2/5">${preview[k] ? "+" + preview[k] + "%" : "—"}</span></div>`).join("")}</div></div>
      </div></div>`;
      footer = `<button class="btn-ghost" data-action="artb-back">‹ Back</button>
        <button class="btn-confirm" data-action="artb-save">Save Artifact</button>`;
    }

    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">
        <span class="hdr-ico">${spriteImg(artIcon(a), "px")}</span>
        <h2>${esc(a.name)}</h2>${renderArtStepbar(st.step)}
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>${footer}</div></div>
    </div></div>`;
  }

  // ── relic builder ──────────────────────────────────────────────────────────
  function openRelicBuilder(slotIdx) {
    const slot = build.slots[slotIdx];
    ovState = { kind: "relic", slotIdx, sel: slot.relic ? slot.relic.id : null, rank: slot.relic ? slot.relic.rank : 50, search: "", render: renderRelicBuilder };
    openOverlay(ovState.render());
  }
  function renderRelicBuilder() {
    const st = ovState, c = CREA.get(build.slots[st.slotIdx].cid);
    const q = st.search.trim().toLowerCase();
    const list = D.relics.filter(r => !q || r.name.toLowerCase().includes(q) || (r.statBonus || "").toLowerCase().includes(q));
    const sel = st.sel != null ? RELIC.get(st.sel) : null;
    const rows = list.map(r => `<div class="prop-row ${st.sel === r.id ? "chosen" : ""}" data-action="relic-pick" data-id="${r.id}">
      <span class="prop-name">${esc(r.name)}</span><span class="prop-stat">${esc(r.statBonus || "")}</span></div>`).join("");
    const detail = sel ? `<h3 style="margin-bottom:6px">${esc(sel.name)}</h3>
      <div class="slot-sub" style="margin-bottom:10px">Boosts ${esc(sel.statBonus || "—")}</div>
      ${sel.ranks.map(rk => `<div class="prop-row ${st.rank >= rk.rank ? "chosen" : ""}">
        <span class="prop-name" style="flex:0 0 44px;color:var(--accent)">R${rk.rank}</span>
        <span class="prop-stat" style="flex:1;text-align:left">${richText(rk.desc)}</span></div>`).join("")}`
      : "";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Relic — ${esc(c ? c.name : "")}</h2>
        <input class="ovl-search" placeholder="Search relic / stat…" value="${esc(st.search)}" data-action="relic-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${rows}</div></div>
        <div class="ovl-right">
          ${sel ? `<div class="rank-picker"><span class="slot-sub">Rank</span>
            <input type="range" min="10" max="${Math.max(...sel.ranks.map(r => r.rank), 10)}" step="10" value="${st.rank}" data-action="relic-rank"><span class="rank-badge">${st.rank}</span></div>` : ""}
          ${detail}</div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div><button class="btn-ghost" data-action="relic-clear">Clear</button>
        <button class="btn-confirm" data-action="relic-confirm" ${st.sel == null ? "disabled" : ""}>Save Relic</button></div></div>
    </div></div>`;
  }

  // ── creature detail ────────────────────────────────────────────────────────
  function openCreatureDetail(slotIdx) {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid); if (!c) return;
    const fs = finalStats(slot), b = fs.base;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const rows = STAT_KEYS.map(k => {
      const pct = fs.pct[k], touched = pct !== 0;
      return `<div class="stat-row ${touched ? "hl-med" : ""}"><span class="stat-name">${STAT_LABEL[k]}</span>
        <span class="stat-val base">${b[k]}</span><span class="stat-val art">${touched ? "+" + pct + "%" : "—"}</span>
        <span class="stat-val total">${fs.final[k]}</span></div>`;
    }).join("");
    const traitIds = slotTraitIds(slot);
    const traitHtml = traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}
      <div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("");
    const relic = slot.relic ? RELIC.get(slot.relic.id) : null;
    const a = resolveArtifact(slot);
    dovState = null;
    openDetail(`<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(c.name)}${f ? " ⚭ " + esc(f.name) : ""}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left" style="width:180px;text-align:center">${critFace(c)}
          <div class="slot-sub" style="margin-top:6px"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
          ${f ? `<div class="slot-sub" style="margin-top:8px">Fused with<br><b>${esc(f.name)}</b><br>(class → ${esc(f.cls || "—")})</div>` : ""}
          ${a ? `<div class="slot-sub" style="margin-top:8px">Artifact<br><b>${esc(a.name)}</b></div>` : ""}</div>
        <div class="ovl-center"><div class="ovl-center-scroll">
          <div class="section-label">Stats — Base · Artifact · Total</div>
          <div class="stat-grid"><div class="stat-header"><span>Stat</span><span style="text-align:right">Base</span>
            <span style="text-align:right">Artifact</span><span style="text-align:right">Total</span></div>${rows}
            <div class="stat-row hl-high"><span class="stat-name">Total</span><span class="stat-val base">${b.total}</span>
              <span class="stat-val art"></span><span class="stat-val total">${fs.total}</span></div></div>
          <div class="section-label" style="margin-top:14px">Traits (innate${f ? " + fusion" : ""}${a && (a.traits || []).length ? " + artifact" : ""})</div>
          ${traitHtml || `<div class="slot-sub">No traits.</div>`}
          ${relic ? `<div class="section-label" style="margin-top:14px">Relic</div>
            <div class="primary-traits"><b>${esc(relic.name)}</b> — Rank ${slot.relic.rank}
            <div class="trait-desc">${richText(relic.ranks.filter(r => r.rank <= slot.relic.rank).map(r => "R" + r.rank + ": " + r.desc).join(" ") || "")}</div></div>` : ""}
        </div></div>
      </div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`);
  }

  // ── realm cards (leveled collection) ───────────────────────────────────────
  function openCards() { ovState = { kind: "cards", search: "", clsFilter: null, render: renderCards }; openOverlay(ovState.render()); maybeFocusSearch(OV); }
  function renderCards() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = D.cards.filter(c => (!q || c.family.toLowerCase().includes(q)) && (!st.clsFilter || c.cls === st.clsFilter));
    const clsChips = D.classes.map(cl => `<button class="chip ${st.clsFilter === cl.key ? "on" : ""}" data-cls="${cl.key}" data-action="cards-cls" data-c="${cl.key}" style="--c:${cl.color}">${cl.key}</button>`).join("")
      + `<button class="chip ${st.clsFilter ? "" : "on"}" data-action="cards-cls" data-c="">All</button>`;
    const tiles = list.map(c => {
      const lv = cardLevel(c.id);
      const bg = c.cls && CLASS_BG[c.cls] ? CLASS_BG[c.cls] : null;
      const effects = c.effects.map((e, i) => `<div class="card-effect ${i < lv ? "on" : "off"}"><span class="ce-tier">${i + 1}</span>${richText(e)}</div>`).join("");
      return `<div class="card-tile lv${lv}" style="--cardcls:${clsColor(c.cls)}">
        <div class="card-head">
          <div class="card-art">${bg ? `<img class="card-bg" src="${esc(bg)}" alt="">` : ""}${c.sprite ? spriteImg(c.sprite, "card-crit") : ""}</div>
          <div class="card-title"><b>${esc(c.family)}</b><span class="cls-chip" style="color:${clsColor(c.cls)}">${esc(c.cls || "—")}</span></div>
        </div>
        <div class="card-effects">${effects}</div>
        <div class="card-level">
          <button class="lvl-btn" data-action="card-dec" data-id="${c.id}" ${lv === 0 ? "disabled" : ""}>−</button>
          <span class="lvl-badge">${lv === 0 ? "Off" : "Lv " + lv}</span>
          <button class="lvl-btn" data-action="card-inc" data-id="${c.id}" ${lv >= c.effects.length ? "disabled" : ""}>＋</button>
        </div></div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Realm Cards</h2>
        <input class="ovl-search" placeholder="Search family…" value="${esc(st.search)}" data-action="cards-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-filterbar">${clsChips}</div>
        <div class="ovl-center-scroll"><div class="card-grid">${tiles}</div></div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── nether stones: library + stepped builder wizard (full stat+trick property pool) ──
  const gemPath = (key) => { const g = GEM_ICONS.find(x => x.key === key); return g ? g.path : (GEM_ICONS[0] && GEM_ICONS[0].path); };
  const NETHER_CATS = [
    { c: "stat", label: "Stat" }, { c: "trick", label: "Trick" }, { c: "trait", label: "Trait" }, { c: "spell", label: "Spell" },
  ];
  function netherPropLabel(p) {
    if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return t ? t.name : p.key; }
    if (p.cat === "spell") { const s = SPELLPROP.get(p.key); return s ? s.name : p.key; }
    return `+${p.value}% ${p.key}`;
  }
  const netherSummary = (n) => (n.props || []).map(netherPropLabel).join(" · ") || "no properties";
  function openNether() {   // library
    ovState = { kind: "nether", render: renderNether };
    openOverlay(ovState.render());
  }
  function renderNether() {
    const tiles = nether.map(n => `
      <div class="lib-tile">
        <div class="lib-icon" data-action="nether-edit" data-id="${n.id}">${spriteImg(gemPath(n.icon), "px")}</div>
        <div class="lib-name">${esc(n.name)}</div>
        <div class="lib-sub">${esc(netherSummary(n))}</div>
        <div class="lib-actions">
          <button class="slot-mini" data-action="nether-edit" data-id="${n.id}">Edit</button>
          <button class="slot-mini danger" data-action="nether-del" data-id="${n.id}">✕</button>
        </div></div>`).join("") || `<div class="slot-sub" style="padding:10px">No Nether Stones yet — build one.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Nether Stones</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="lib-grid">${tiles}</div></div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="nether-new">＋ Build new stone</button></div>
    </div></div>`;
  }

  // stepped nether wizard: 1) gem + name  2) properties (any number, from the full stat+trick pool)
  function openNetherBuilder(id) {
    const draft = id != null ? JSON.parse(JSON.stringify(nether.find(n => n.id === id)))
      : { id: null, name: `Nether Stone ${nextNetherId}`, icon: (GEM_ICONS[0] || {}).key, props: [] };
    ovState = { kind: "netherbuild", editId: id, draft, step: id != null ? "props" : "basics", picking: false, search: "", render: renderNetherBuilder };
    openOverlay(ovState.render());
  }
  const netherStepLabels = { basics: "1 · Gem & name", props: "2 · Properties" };
  const renderNetherStepbar = (step) => `<div class="art-steps">${["basics", "props"].map(s =>
    `<span class="art-step ${s === step ? "on" : ""} ${["basics", "props"].indexOf(s) < ["basics", "props"].indexOf(step) ? "done" : ""}">${netherStepLabels[s]}</span>`).join("<span class='art-step-sep'>›</span>")}</div>`;
  function renderNetherBuilder() {
    const st = ovState, s = st.draft;
    let body = "", footer = "";
    if (st.step === "basics") {
      const gemChoices = GEM_ICONS.map(g => `<button class="gem-choice ${s.icon === g.key ? "on" : ""}" data-action="nether-icon" data-k="${g.key}" title="${g.key}">${spriteImg(g.path, "px")}</button>`).join("");
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
        <div class="build-section"><h3>Name</h3>
          <div class="nf-row"><input class="ovl-search name-field" style="max-width:none;flex:1" placeholder="Name" value="${esc(s.name)}" data-action="nether-name">
            <button class="chip" data-action="nether-rand" title="Random gem">🎲</button></div></div>
        <div class="build-section"><h3>Gem icon</h3><div class="gem-picker">${gemChoices}</div></div>
      </div></div>`;
      footer = `<button class="btn-ghost" data-action="nether-cancel">Cancel</button>
        <button class="btn-confirm" data-action="netherb-next">Next: Properties ›</button>`;
    } else {
      // each prop = {cat,key,value}; stat/trick carry a % value, trait/spell are item refs (icon)
      const rows = s.props.map((p, i) => {
        const isItem = p.cat === "trait" || p.cat === "spell";
        const it = p.cat === "trait" ? TRAITITEM.get(p.key) : p.cat === "spell" ? SPELLPROP.get(p.key) : null;
        const ico = isItem ? `<div class="as-ico">${it && it.icon ? spriteImg(it.icon, "px") : "◆"}</div>` : `<div class="as-ico glyph">◆</div>`;
        const sub = isItem ? `<div class="as-sub">${esc(p.cat)}</div>`
          : `<div class="as-sub"><input type="number" class="np-num" data-action="nether-propval" data-i="${i}" value="${p.value}">%</div>`;
        return `<div class="art-slot"><button class="as-rm" data-action="nether-prop-del" data-i="${i}">✕</button>${ico}
          <div class="as-lab">${esc(isItem ? (it ? it.name : p.key) : p.key)}</div>${sub}</div>`;
      }).join("");
      const slotsBox = `<div class="art-slot-grid">${rows}<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="nether-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Add</div></div></div>`;
      let picker = "";
      if (st.picking === "menu") {
        picker = `<div class="art-addmenu">${NETHER_CATS.map(x => `<button class="chip" data-action="nether-pickcat" data-c="${x.c}">${x.label}</button>`).join("")}</div>`;
      } else if (st.picking) {
        const q = st.search.trim().toLowerCase(); let rowsHtml = "";
        if (st.picking === "stat" || st.picking === "trick") {
          rowsHtml = [...propGroups.values()].filter(g => g.group === st.picking && (!q || g.name.toLowerCase().includes(q))).map(g =>
            `<div class="prop-row" data-action="nether-pickprop" data-k="${esc(g.name)}">
              <span class="prop-name">${esc(g.name)}</span><span class="prop-stat">${esc(g.entries.map(e => e.stat).join(" / "))}</span></div>`).join("");
        } else if (st.picking === "trait") {
          rowsHtml = D.traitItems.filter(t => t.traitName && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q))).slice(0, 300).map(t =>
            `<div class="prop-row" data-action="nether-pickprop" data-k="${t.id}">
              <span class="prop-ico">${t.icon ? spriteImg(t.icon, "px") : ""}</span><span class="prop-name">${esc(t.name)}</span><span class="prop-stat">grants ${esc(t.traitName)}</span></div>`).join("");
        } else {
          rowsHtml = D.spellProps.filter(p => !q || p.name.toLowerCase().includes(q) || (p.effect || "").toLowerCase().includes(q)).map(p =>
            `<div class="prop-row" data-action="nether-pickprop" data-k="${p.id}">
              <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}</span><span class="prop-stat">${esc(p.effect || "")}</span></div>`).join("");
        }
        picker = `<div class="art-picker">
          <div class="ovl-filterbar"><button class="chip" data-action="nether-addprop">‹ Category</button>
            <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="nether-search"></div>
          <div class="art-pick-scroll">${rowsHtml}</div></div>`;
      }
      body = `<div class="ovl-center"><div class="ovl-center-scroll">${slotsBox}${picker}</div></div>`;
      footer = `<button class="btn-ghost" data-action="netherb-back">‹ Back</button>
        <button class="btn-confirm" data-action="nether-save">Save Stone</button>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${spriteImg(gemPath(s.icon), "px")}</span>
        <h2>${esc(s.name)}</h2>${renderNetherStepbar(st.step)}
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }

  // ── spell gems: library + stepped wizard (1 spell + up to 3 property items) ──
  function openSpellGems() {   // library (manage mode when equipCtx is null)
    ovState = { kind: "spellgemlib", equipCtx: null, render: renderSpellGemLib };
    openOverlay(ovState.render());
  }
  function renderSpellGemLib() {
    const st = ovState, ctx = st.equipCtx;   // {kind:'artifact'|'creature'} when equipping
    const equipped = ctx ? new Set(ctx.equipped()) : null;
    const tiles = spellGems.map(g => {
      const on = equipped ? equipped.has(g.id) : false;
      return `<div class="lib-tile ${on ? "equipped" : ""}">
        <div class="lib-icon" data-action="${ctx ? "sg-equip" : "sg-edit"}" data-id="${g.id}">${spriteImg(gemIcon(g), "px")}</div>
        <div class="lib-name">${esc(gemName(g))}</div>
        <div class="lib-sub">${esc(gemSummary(g))}</div>
        <div class="lib-actions">
          ${ctx ? `<button class="slot-mini" data-action="sg-equip" data-id="${g.id}">${on ? "Equipped" : "Equip"}</button>` : ""}
          <button class="slot-mini" data-action="sg-edit" data-id="${g.id}">Edit</button>
          <button class="slot-mini danger" data-action="sg-del" data-id="${g.id}">✕</button>
        </div></div>`;
    }).join("") || `<div class="slot-sub" style="padding:10px">No spell gems yet — build one.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Spell Gems${ctx ? " — equip" : ""}</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="lib-grid">${tiles}</div></div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="sg-new">＋ Build new spell gem</button></div>
    </div></div>`;
  }
  function openSpellGemBuilder(id) {
    const draft = id != null ? JSON.parse(JSON.stringify(spellGems.find(g => g.id === id)))
      : { id: null, name: "", spellId: null, propIds: [] };
    ovState = { kind: "sgbuild", editId: id, draft, step: id != null ? "props" : "spell", search: "", render: renderSpellGemBuilder };
    openOverlay(ovState.render());
  }
  const sgStepLabels = { spell: "1 · Pick spell", props: "2 · Properties" };
  const renderSgStepbar = (step) => `<div class="art-steps">${["spell", "props"].map(s =>
    `<span class="art-step ${s === step ? "on" : ""} ${["spell", "props"].indexOf(s) < ["spell", "props"].indexOf(step) ? "done" : ""}">${sgStepLabels[s]}</span>`).join("<span class='art-step-sep'>›</span>")}</div>`;
  function renderSpellGemBuilder() {
    const st = ovState, g = st.draft, q = st.search.trim().toLowerCase();
    let body = "", footer = "";
    if (st.step === "spell") {
      const rows = D.spells.filter(s => (!q || s.name.toLowerCase().includes(q) || (s.desc || "").toLowerCase().includes(q))
          && (!st.spellTaxo || (s.taxo || []).includes(st.spellTaxo))).slice(0, 300)
        .map(s => `<div class="prop-row rich ${g.spellId === s.id ? "chosen" : ""}" data-action="sg-spell" data-id="${s.id}">
          <span class="prop-ico">${spellIcon(s) ? spriteImg(spellIcon(s), "px") : ""}</span>
          <div class="prop-body"><div class="prop-name">${esc(s.name)}</div>
            ${s.desc ? `<div class="prop-sub clamp">${perkText(s.desc)}</div>` : ""}</div></div>`).join("");
      const sTaxo = st.spellTaxo
        ? `<button class="facet on tag" data-action="sg-taxofilter-clear">${esc(taxoCatName(st.spellTaxo))}: <b>${esc(taxoValName(st.spellTaxo))}</b> <span class="facet-x">✕</span></button>`
        : `<button class="facet add" data-action="sg-taxofilter">＋ Filter</button>`;
      body = `<div class="ovl-center">
        <div class="ovl-filterbar"><input class="ovl-search" placeholder="Search spells…" value="${esc(st.search)}" data-action="sg-search">${sTaxo}</div>
        <div class="ovl-center-scroll">${rows}</div></div>`;
      footer = `<button class="btn-ghost" data-action="sg-cancel">Cancel</button>
        <button class="btn-confirm" data-action="sgb-next" ${g.spellId != null ? "" : "disabled"}>Next: Properties ›</button>`;
    } else {
      const boxes = [];
      for (let i = 0; i < SPELLGEM_MAX_PROPS; i++) {
        const pid = g.propIds[i];
        if (pid !== undefined) { const p = SPELLPROP.get(pid);
          boxes.push(`<div class="art-slot"><button class="as-rm" data-action="sg-prop-rm" data-i="${i}">✕</button>
            <div class="as-ico">${p && p.icon ? spriteImg(p.icon, "px") : "◆"}</div><div class="as-lab">${esc(p ? p.name : pid)}</div>
            <div class="as-sub">${esc(p ? (p.effect || "").split(":")[0].slice(0, 24) : "")}</div></div>`); }
        else boxes.push(`<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="sg-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Property</div></div>`);
      }
      let picker = "";
      if (st.picking) {
        const pr = D.spellProps.filter(p => !q || p.name.toLowerCase().includes(q) || (p.effect || "").toLowerCase().includes(q)).map(p =>
          `<div class="prop-row ${g.propIds.includes(p.id) ? "chosen" : ""}" data-action="sg-pickprop" data-id="${p.id}">
            <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}</span><span class="prop-stat">${esc(p.effect || "")}</span></div>`).join("");
        picker = `<div class="art-picker">
          <div class="ovl-filterbar"><button class="chip" data-action="sg-closepick">‹ Done</button>
            <input class="ovl-search" placeholder="Search gemstone enchantments…" value="${esc(st.search)}" data-action="sg-search"></div>
          <div class="art-pick-scroll">${pr}</div></div>`;
      }
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
        <div class="build-section"><h3>Name</h3>
          <input class="ovl-search name-field" placeholder="${esc(gemSpell(g) ? gemSpell(g).name : "Spell gem name")}" value="${esc(g.name)}" data-action="sg-name" style="max-width:320px"></div>
        <div class="art-slot-group"><div class="section-label">Property items</div><div class="art-slot-grid">${boxes.join("")}</div></div>
        ${picker}</div></div>`;
      footer = `<button class="btn-ghost" data-action="sgb-back">‹ Back</button>
        <button class="btn-confirm" data-action="sg-save">Save Spell Gem</button>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${spriteImg(gemIcon(g), "px")}</span>
        <h2>${esc(gemName(g) || "New Spell Gem")}</h2>${renderSgStepbar(st.step)}
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }

  // creature spell slots (up to 3 equipped spell gems) — equip from the library
  function openCreatureSpells(slotIdx) {
    ovState = { kind: "spellgemlib", equipCtx: {
      kind: "creature", slotIdx,
      equipped: () => build.slots[slotIdx].spellGemIds,
      max: 3,
    }, render: renderSpellGemLib };
    openOverlay(ovState.render());
  }

  // ── event delegation ───────────────────────────────────────────────────────
  function onClick(e) {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action;
    switch (A) {
      // home
      case "pick-creature": openCreaturePicker(+t.dataset.slot); break;
      case "equip-artifact": openArtifactLibrary(+t.dataset.slot); break;
      case "build-relic": openRelicBuilder(+t.dataset.slot); break;
      case "creature-detail": openCreatureDetail(+t.dataset.slot); break;
      case "pick-spec": openSpecPicker(); break;
      case "remove-creature": armOrDo(t, () => { build.slots[+t.dataset.slot] = emptySlot(); persistBuild(); render(); }); break;
      case "clear-spec": e.stopPropagation(); build.specId = null; persistBuild(); render(); break;
      case "clear-party": armOrDo(t, () => { build = { schema: 2, specId: null, perkAlloc: {}, slots: Array.from({ length: 6 }, emptySlot) }; persistBuild(); render(); }); break;
      case "open-artifacts": openArtifactLibrary(null); break;
      case "open-anoint": openAnoint(); break;
      case "anoint-toggle": {
        const sid = +t.dataset.sid, k = t.dataset.k;
        const i = build.anoints.findIndex(x => x.specId === sid && x.key === k);
        if (i >= 0) build.anoints.splice(i, 1);
        else if (build.anoints.length < ANOINT_MAX) build.anoints.push({ specId: sid, key: k });
        persistBuild(); refreshOverlay(); render(); break;   // refresh overlay + home tile count
      }
      case "open-cards": openCards(); break;
      case "open-nether": openNether(); break;

      // overlay chrome
      case "close-ovl": closeOverlay(); break;
      case "backdrop": if (e.target === t) closeOverlay(); break;
      case "close-detail": closeDetail(); break;
      case "detail-backdrop": if (e.target === t) closeDetail(); break;
      case "facet-backdrop": if (e.target === t) closeDetail(); break;

      // creature picker + facets
      case "crea-pick": {
        const id = +t.dataset.id;
        if (ovState.step === "fusion") ovState.fusionId = ovState.fusionId === id ? null : id;
        else ovState.primaryId = ovState.primaryId === id ? null : id;
        refreshOverlay(); break;
      }
      case "crea-nofuse": ovState.fusionId = null; refreshOverlay(); break;
      case "crea-next": if (ovState.primaryId != null) { ovState.step = "fusion"; ovState.search = ""; refreshOverlay(); } break;
      case "crea-back": ovState.step = "primary"; ovState.search = ""; refreshOverlay(); break;
      case "crea-confirm": {
        if (ovState.primaryId == null) break;
        const s = build.slots[ovState.slotIdx];
        s.cid = ovState.primaryId; s.fusion = ovState.fusionId;
        persistBuild(); closeOverlay(); render(); break;
      }
      case "facet-class": openFacetPicker("class"); break;
      case "facet-race": openFacetPicker("race"); break;
      case "facet-taxo": openFacetPicker("taxo-cat"); break;
      case "anoint-taxo": openFacetPicker("taxo-cat", { idx: anointTaxoIndex() }); break;
      case "taxo-back": dovState.facet = "taxo-cat"; dovState.taxoCat = null; dovState.search = ""; refreshDetail(); break;
      case "facet-class-clear": e.stopPropagation(); ovState.clsFilter = null; refreshOverlay(); break;
      case "facet-race-clear": e.stopPropagation(); ovState.raceFilter = null; refreshOverlay(); break;
      case "rm-taxo": ovState.taxoFilters.splice(+t.dataset.i, 1); refreshOverlay(); break;
      case "facet-pick": {
        const v = t.dataset.v;
        if (dovState.facet === "class") { ovState.clsFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "race") { ovState.raceFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "taxo-cat") { dovState.facet = "taxo-val"; dovState.taxoCat = v; dovState.search = ""; refreshDetail(); }
        else if (dovState.onPick) { dovState.onPick(v); closeDetail(); refreshOverlay(); }  // context-specific target (e.g. trait-item picker)
        else { if (!ovState.taxoFilters.includes(v)) ovState.taxoFilters.push(v); closeDetail(); refreshOverlay(); }
        break;
      }

      // spec picker + perks
      case "spec-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "spec-confirm": build.specId = ovState.sel; persistBuild(); closeOverlay(); render(); break;
      case "customize-perks": if (ovState.sel != null) openPerkPicker(ovState.sel); break;
      case "perk-inc": case "perk-dec": case "perk-max": case "perk-zero": {
        const sp = SPEC.get(dovState.specId), p = sp.perks.find(x => x.key === t.dataset.k); if (!p) break;
        const cur = perkRank(sp, p);
        const next = A === "perk-inc" ? cur + 1 : A === "perk-dec" ? cur - 1 : A === "perk-max" ? perkMax(p) : 0;
        setPerkRank(sp, p, next); persistBuild(); refreshDetail(); break;
      }
      case "perk-all": { build.perkAlloc[dovState.specId] = {}; persistBuild(); refreshDetail(); break; } // absence = max
      case "perk-none": { const sp = SPEC.get(dovState.specId); const m = {}; sp.perks.forEach(p => m[p.key] = 0); build.perkAlloc[dovState.specId] = m; persistBuild(); refreshDetail(); break; }

      // artifact library + builder
      case "art-equip": build.slots[ovState.slotIdx].artifactId = +t.dataset.id; persistBuild(); closeOverlay(); render(); break;
      case "art-unequip": build.slots[ovState.slotIdx].artifactId = null; persistBuild(); closeOverlay(); render(); break;
      case "art-new": openArtifactBuilder(null, ovState.slotIdx); break;
      case "art-edit": openArtifactBuilder(+t.dataset.id, ovState.slotIdx); break;
      case "art-del": armOrDo(t, () => { const id = +t.dataset.id; artifacts = artifacts.filter(a => a.id !== id); build.slots.forEach(s => { if (s.artifactId === id) s.artifactId = null; }); persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
      case "artb-next": ovState.step = ovState.step === "type" ? "slots" : "name"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(); break;
      case "artb-back": ovState.step = ovState.step === "name" ? "slots" : "type"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(); break;
      case "artb-closecat": ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(); break;
      case "artb-traitfilter": openFacetPicker("taxo-cat", {
        idx: taxoIndexFor("titem", D.traitItems, ti => ti.taxo || []),
        onPick: (v) => { ovState.traitTaxo = v; } }); break;
      case "artb-traitfilter-clear": ovState.traitTaxo = null; refreshOverlay(); break;
      // spell-gem builder spell picker filter (reuses the facet detail picker)
      case "sg-taxofilter": openFacetPicker("taxo-cat", {
        idx: taxoIndexFor("spell", D.spells, s => s.taxo || []),
        onPick: (v) => { ovState.spellTaxo = v; } }); break;
      case "sg-taxofilter-clear": ovState.spellTaxo = null; refreshOverlay(); break;
      // perk picker inline taxonomy filter
      case "perk-taxo-open": dovState.perkBrowse = true; refreshDetail(); break;
      case "perk-taxo-cat": dovState.perkCat = t.dataset.c; refreshDetail(); break;
      case "perk-taxo-val": dovState.perkTaxo = t.dataset.v; dovState.perkBrowse = false; dovState.perkCat = null; refreshDetail(); break;
      case "perk-taxo-clear": dovState.perkTaxo = null; dovState.perkCat = null; dovState.perkBrowse = false; refreshDetail(); break;
      case "perk-taxo-back": if (dovState.perkCat) dovState.perkCat = null; else dovState.perkBrowse = false; refreshDetail(); break;
      case "art-primary": ovState.draft.primary = ovState.draft.primary === t.dataset.p ? null : t.dataset.p; refreshOverlay(); break;
      case "art-slot": ovState.pickType = t.dataset.t; ovState.preview = null; ovState.search = ""; refreshOverlay(); break;
      // socketing is a two-step: preview the item's effect, then confirm (never applies silently)
      case "art-preview": {
        const type = t.dataset.t;
        ovState.preview = { type, value: (type === "stat" || type === "trick") ? t.dataset.v : +t.dataset.v };
        refreshOverlay(); break;
      }
      case "art-preview-back": ovState.preview = null; refreshOverlay(); break;
      case "art-confirm-add": {
        const type = t.dataset.t, sl = ART_SLOTS.find(s => s.pick === type), arr = ovState.draft[sl.key];
        const v = (type === "stat" || type === "trick") ? t.dataset.v : +t.dataset.v;
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1);                        // already socketed → remove
        else if (arr.length < sl.max) arr.push(v);           // room → add
        else if (sl.max === 1) arr[0] = v;                   // single-slot → replace
        ovState.preview = null;
        if (arr.length >= sl.max) ovState.pickType = null;   // slot type full → back to the grid
        refreshOverlay(); break;
      }
      case "art-rm": {
        const type = t.dataset.t, sl = ART_SLOTS.find(s => s.pick === type), arr = ovState.draft[sl.key];
        const v = (type === "stat" || type === "trick") ? t.dataset.v : +t.dataset.v;
        const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); refreshOverlay(); break;
      }
      case "artb-cancel": openArtifactLibrary(ovState.slotIdx); break;
      case "artb-save": {
        const d = ovState.draft;
        if (!d.name || !d.name.trim()) d.name = `Artifact ${nextArtId}`;
        if (d.id == null) { d.id = nextArtId++; artifacts.push(d); }
        else { const idx = artifacts.findIndex(a => a.id === d.id); if (idx >= 0) artifacts[idx] = d; }
        persistArtifacts();
        if (ovState.slotIdx != null) { build.slots[ovState.slotIdx].artifactId = d.id; persistBuild(); }
        closeOverlay(); render(); break;
      }

      // relic
      case "relic-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "relic-clear": build.slots[ovState.slotIdx].relic = null; persistBuild(); closeOverlay(); render(); break;
      case "relic-confirm": build.slots[ovState.slotIdx].relic = { id: ovState.sel, rank: ovState.rank }; persistBuild(); closeOverlay(); render(); break;

      // cards
      case "cards-cls": ovState.clsFilter = t.dataset.c || null; refreshOverlay(); break;
      case "card-inc": { const id = +t.dataset.id, c = D.cards.find(x => x.id === id); cards.levels[id] = Math.min(cardLevel(id) + 1, c.effects.length); persistCards(); refreshOverlay(); break; }
      case "card-dec": { const id = +t.dataset.id; cards.levels[id] = Math.max(cardLevel(id) - 1, 0); persistCards(); refreshOverlay(); break; }

      // nether library + wizard
      case "nether-new": openNetherBuilder(null); break;
      case "nether-edit": openNetherBuilder(+t.dataset.id); break;
      case "nether-del": armOrDo(t, () => { const id = +t.dataset.id; nether = nether.filter(n => n.id !== id); artifacts.forEach(a => a.netherIds = (a.netherIds || []).filter(x => x !== id)); persistNether(); persistArtifacts(); refreshOverlay(); }); break;
      case "nether-cancel": openNether(); break;
      case "netherb-next": ovState.step = "props"; ovState.picking = false; ovState.search = ""; refreshOverlay(); break;
      case "netherb-back": ovState.step = "basics"; ovState.picking = false; refreshOverlay(); break;
      case "nether-icon": ovState.draft.icon = t.dataset.k; refreshOverlay(); break;
      case "nether-rand": { const g = GEM_ICONS[Math.floor((Date.now() >> 4) % GEM_ICONS.length)] || GEM_ICONS[0]; ovState.draft.icon = g && g.key; refreshOverlay(); break; }
      case "nether-addprop": ovState.picking = "menu"; ovState.search = ""; refreshOverlay(); break;
      case "nether-pickcat": ovState.picking = t.dataset.c; ovState.search = ""; refreshOverlay(); break;
      case "nether-closepick": ovState.picking = false; refreshOverlay(); break;
      case "nether-pickprop": {
        const cat = ovState.picking, isItem = cat === "trait" || cat === "spell";
        ovState.draft.props.push({ cat, key: isItem ? +t.dataset.k : t.dataset.k, value: isItem ? null : 10 });
        ovState.picking = false; refreshOverlay(); break;
      }
      case "nether-prop-del": ovState.draft.props.splice(+t.dataset.i, 1); refreshOverlay(); break;
      case "nether-save": {
        const d = ovState.draft;
        if (!d.name || !d.name.trim()) d.name = `Nether Stone ${nextNetherId}`;
        if (ovState.editId != null) { const idx = nether.findIndex(n => n.id === ovState.editId); if (idx >= 0) nether[idx] = d; }
        else { d.id = nextNetherId++; nether.push(d); }
        persistNether(); openNether(); break;
      }

      // spell gems: library + wizard + equip
      case "open-spellgems": openSpellGems(); break;
      case "creature-spells": openCreatureSpells(+t.dataset.slot); break;
      case "sg-new": openSpellGemBuilder(null); break;
      case "sg-edit": openSpellGemBuilder(+t.dataset.id); break;
      case "sg-del": armOrDo(t, () => { const id = +t.dataset.id; spellGems = spellGems.filter(g => g.id !== id);
        artifacts.forEach(a => a.spells = (a.spells || []).filter(x => x !== id));
        build.slots.forEach(s => s.spellGemIds = (s.spellGemIds || []).filter(x => x !== id));
        persistSpellGems(); persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
      case "sg-cancel": openSpellGems(); break;
      case "sg-spell": ovState.draft.spellId = ovState.draft.spellId === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "sgb-next": ovState.step = "props"; ovState.picking = false; ovState.search = ""; refreshOverlay(); break;
      case "sgb-back": ovState.step = "spell"; ovState.picking = false; ovState.search = ""; refreshOverlay(); break;
      case "sg-addprop": ovState.picking = true; ovState.search = ""; refreshOverlay(); break;
      case "sg-closepick": ovState.picking = false; refreshOverlay(); break;
      case "sg-pickprop": { const id = +t.dataset.id, arr = ovState.draft.propIds;
        const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); else if (arr.length < SPELLGEM_MAX_PROPS) arr.push(id);
        if (arr.length >= SPELLGEM_MAX_PROPS) ovState.picking = false; refreshOverlay(); break; }
      case "sg-prop-rm": ovState.draft.propIds.splice(+t.dataset.i, 1); refreshOverlay(); break;
      case "sg-save": {
        const d = ovState.draft;
        if (d.spellId == null) break;
        if (!d.name || !d.name.trim()) d.name = (SPELL.get(d.spellId) || {}).name || `Spell Gem ${nextSpellGemId}`;
        if (ovState.editId != null) { const idx = spellGems.findIndex(g => g.id === ovState.editId); if (idx >= 0) spellGems[idx] = d; }
        else { d.id = nextSpellGemId++; spellGems.push(d); }
        persistSpellGems(); openSpellGems(); break;
      }
      case "sg-equip": {
        const id = +t.dataset.id, ctx = ovState.equipCtx; if (!ctx) break;
        const arr = ctx.equipped(); const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else if (arr.length < ctx.max) arr.push(id);
        else if (ctx.max === 1) arr[0] = id;
        persistBuild(); persistArtifacts(); refreshOverlay(); break;
      }

      // trait nav (stub — full trait page is P1)
      case "nav-trait": { const tr = TRAIT[+t.dataset.tid]; if (tr) alert(tr.name + "\n\n" + (tr.desc || "")); break; }
    }
  }

  function armOrDo(t, fn) { if (t.classList.contains("armed")) { fn(); return; } t.classList.add("armed"); setTimeout(() => t.classList.remove("armed"), 2500); }
  function toggleArr(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }

  function onInput(e) {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action, v = t.value;
    // range sliders / selects
    if (A === "artb-rank") { ovState.draft.rank = +v; refreshOverlay(); return; }
    if (A === "relic-rank") { ovState.rank = +v; refreshOverlay(); return; }
    if (A === "nether-propval") { ovState.draft.props[+t.dataset.i].value = Number(v) || 0; return; }
    // name fields (no re-render — keep focus/caret)
    if (A === "artb-name") { ovState.draft.name = v; return; }
    if (A === "nether-name") { ovState.draft.name = v; return; }
    if (A === "sg-name") { ovState.draft.name = v; return; }
    // search fields — live filter without losing caret
    const searchMap = { "crea-search": [OV, ovState], "spec-search": [OV, ovState], "artb-search": [OV, ovState],
      "relic-search": [OV, ovState], "cards-search": [OV, ovState], "anoint-search": [OV, ovState], "nether-search": [OV, ovState], "sg-search": [OV, ovState], "facet-search": [DOV, dovState], "perk-search": [DOV, dovState] };
    if (searchMap[A]) {
      const [root, state] = searchMap[A]; state.search = v;
      const panel = root.querySelector(".overlay-panel");
      const saved = SCROLLERS.map(sel => { const e = panel && panel.querySelector(sel); return e ? e.scrollTop : 0; });
      const caret = t.selectionStart;
      panel.outerHTML = state.render();
      const p2 = root.querySelector(".overlay-panel");
      const inp = p2 && p2.querySelector(".ovl-search");
      if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch {} }
      SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!DOV.classList.contains("hidden")) closeDetail(); else if (!OV.classList.contains("hidden")) closeOverlay(); }
  });

  render();
})();
