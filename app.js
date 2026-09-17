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
  const TRAIT = D.traits;                                   // id -> {name,desc,cls,...}
  const CLS_COLOR = Object.fromEntries(D.classes.map(c => [c.key, c.color]));
  const STAT_KEYS = ["hp", "atk", "def", "int", "spd"];
  const STAT_LABEL = { hp: "Health", atk: "Attack", def: "Defense", int: "Intelligence", spd: "Speed" };
  const PROP_STAT = { Health: "hp", Attack: "atk", Defense: "def", Intelligence: "int", Speed: "spd" };

  // group artifact stat/trick properties by property name (dual-stat -> multiple entries)
  const propGroups = new Map();  // name -> {group, entries:[{stat,unit,perRank}]}
  for (const g of ["stat", "trick"]) {
    for (const p of D.artifact[g]) {
      if (!propGroups.has(p.property)) propGroups.set(p.property, { group: g, name: p.property, entries: [] });
      propGroups.get(p.property).entries.push({ stat: p.stat, unit: p.unit, perRank: p.perRank });
    }
  }
  const PRIMARY = D.artifact.primary;                        // 5 records, each {property,stat,perRank}
  const TRAITITEM = new Map(D.traitItems.map(t => [t.id, t]));
  const RELIC = new Map(D.relics.map(r => [r.id, r]));

  // ── persistence ────────────────────────────────────────────────────────────
  const LS = {
    build: "subc.build", cards: "subc.cards", nether: "subc.nether",
  };
  const jload = (k, dflt) => { try { return JSON.parse(localStorage.getItem(k)) ?? dflt; } catch { return dflt; } };
  const jsave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const emptySlot = () => ({ cid: null, fusion: null, artifact: null, relic: null });
  let build = jload(LS.build, null);
  if (!build || build.schema !== 1) build = { schema: 1, specId: null, slots: Array.from({ length: 6 }, emptySlot) };
  // defensive fill
  while (build.slots.length < 6) build.slots.push(emptySlot());
  build.slots = build.slots.map(s => Object.assign(emptySlot(), s));

  let cards = jload(LS.cards, null) || { notOwned: {}, disabled: {} };   // default: all owned + enabled
  let nether = jload(LS.nether, null) || [];                            // user library

  const persistBuild = () => jsave(LS.build, build);
  const persistCards = () => jsave(LS.cards, cards);
  const persistNether = () => jsave(LS.nether, nether);

  // ── util ─────────────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clsColor = (cls) => CLS_COLOR[cls] || "var(--border-dim)";
  // contrast-chosen text colour for a trait banner background
  function textOn(hex) {
    const h = String(hex).replace("#", ""); if (h.length < 6) return "#fff";
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#150e26" : "#fff";
  }

  // ── stat computation (fusion + artifact) ──────────────────────────────────
  // Fusion (codex): offspring base = per-stat AVERAGE of both parents; class = SECONDARY parent's.
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
  // artifact % contribution per base stat (primary + chosen stat/trick properties)
  function artifactPct(slot) {
    const out = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
    const a = slot.artifact; if (!a) return out;
    const rank = a.rank || 50;
    if (a.primary) {
      const p = PRIMARY.find(x => x.property === a.primary);
      if (p) { const k = PROP_STAT[p.stat]; if (k) out[k] += (p.perRank[rank] || 0); }
    }
    for (const name of a.props || []) {
      const grp = propGroups.get(name); if (!grp) continue;
      for (const e of grp.entries) { const k = PROP_STAT[e.stat]; if (k) out[k] += (e.perRank[rank] || 0); }
    }
    return out;
  }
  function finalStats(slot) {
    const b = baseStats(slot); if (!b) return null;
    const pct = artifactPct(slot);
    const final = {};
    for (const k of STAT_KEYS) final[k] = Math.round(b[k] * (1 + pct[k] / 100));
    return { base: b, pct, final, total: STAT_KEYS.reduce((s, k) => s + final[k], 0) };
  }
  // all traits granted to a creature: innate (+fused parent) + artifact trait-items + nether stones
  function slotTraitIds(slot) {
    const b = baseStats(slot); const ids = b ? [...b.traitIds] : [];
    if (slot.artifact) for (const tid of slot.artifact.traitItemIds || []) {
      const ti = TRAITITEM.get(tid); if (ti && ti.traitId != null) ids.push(ti.traitId);
    }
    return ids;
  }

  // ── shared render bits ─────────────────────────────────────────────────────
  const spriteImg = (src, cls) =>
    src ? `<img src="${esc(src)}" alt="" class="${cls || ""}" onerror="this.style.visibility='hidden'">` : "";

  function traitBanner(tid, opts = {}) {
    const t = TRAIT[tid]; if (!t) return "";
    const color = clsColor(t.cls);
    const label = opts.label || t.name;
    return `<span class="trait-banner" data-action="nav-trait" data-tid="${tid}"
      style="--aff-color:${color};--aff-text:${textOn(color === "var(--border-dim)" ? "#6d5a2e" : color)}" title="${esc(t.name)}">
      <span class="trait-banner-label">${esc(label)}</span></span>`;
  }

  // ── HOME (build-first) ─────────────────────────────────────────────────────
  function render() {
    const app = el("app");
    const scroll = app.scrollTop;
    app.innerHTML = renderHome();
    app.scrollTop = scroll;                                  // never jump to top
  }

  function renderHome() {
    const spec = build.specId != null ? SPEC.get(build.specId) : null;
    const playerCard = `
      <div class="slot slot-player ${spec ? "filled" : ""}" style="--slot-cls:var(--accent2)">
        <div class="slot-sprite-wrap" data-action="pick-spec">
          ${spec && spec.sprite ? spriteImg(spec.sprite) : `<div class="slot-empty-icon">✦</div>`}
        </div>
        <div class="slot-name">${spec ? esc(spec.label) : "Choose Specialization"}</div>
        <div class="slot-sub">${spec ? esc((spec.playstyle || "").slice(0, 42)) + "…" : "Player class"}</div>
        ${spec ? `<button class="slot-remove" data-action="clear-spec" title="Remove">✕</button>` : ""}
      </div>`;

    const slots = build.slots.map((s, i) => renderSlot(s, i)).join("");

    return `
      <div class="player-row">
        <div class="section-label">Specialization</div>
        <div class="party-grid" style="grid-template-columns:minmax(0,1fr)">${playerCard}</div>
      </div>
      <div class="section-label">Party — 6 Creatures</div>
      <div class="party-grid">${slots}</div>
      ${renderPartySummary()}
    `;
  }

  function renderSlot(slot, i) {
    const c = CREA.get(slot.cid);
    if (!c) {
      return `<div class="slot" data-slot="${i}">
        <div class="slot-sprite-wrap" data-action="pick-creature" data-slot="${i}">
          <div class="slot-empty-icon">＋</div></div>
        <div class="slot-name">Empty</div>
        <div class="slot-sub">Tap to add a creature</div></div>`;
    }
    const b = baseStats(slot);
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const cls = b.cls;
    return `<div class="slot filled" data-slot="${i}" style="--slot-cls:${clsColor(cls)}">
      <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
      <div class="slot-sprite-wrap" data-action="creature-detail" data-slot="${i}">${spriteImg(c.sprite)}</div>
      <div class="slot-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
      <div class="slot-sub"><span class="cls-chip" style="color:${clsColor(cls)}">${esc(cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
      <div class="slot-actions">
        <button class="slot-mini ${f ? "on" : ""}" data-action="pick-fusion" data-slot="${i}" title="Fusion partner">${f ? "Fused" : "Fuse"}</button>
        <button class="slot-mini ${slot.artifact ? "on" : ""}" data-action="build-artifact" data-slot="${i}" title="Artifact">Artifact</button>
        <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
      </div></div>`;
  }

  function renderPartySummary() {
    const filled = build.slots.filter(s => s.cid != null);
    if (!filled.length) return "";
    const rows = build.slots.map((s, i) => {
      const c = CREA.get(s.cid); if (!c) return "";
      const fs = finalStats(s);
      return `<div class="stat-row"><span class="stat-name">${esc(c.name)}</span>
        <span class="stat-val base">${fs.final.hp}</span>
        <span class="stat-val">${fs.final.atk}</span>
        <span class="stat-val">${fs.final.def}</span>
        <span class="stat-val total">${fs.total}</span></div>`;
    }).join("");
    return `<div class="party-summary"><div class="section-label">Party stat overview (after fusion + artifact)</div>
      <div class="stat-grid">
        <div class="stat-header"><span>Creature</span><span style="text-align:right">HP</span>
          <span style="text-align:right">ATK</span><span style="text-align:right">DEF</span><span style="text-align:right">Total</span></div>
        ${rows}</div></div>`;
  }

  // ── overlay plumbing (two layers, static frame, scroll-preserving refresh) ──
  const OV = el("overlay-root"), DOV = el("detail-overlay-root");
  let ovState = null;   // {kind, ...} current selector overlay
  const SCROLLERS = [".ovl-center-scroll", ".ovl-left", ".ovl-right"];

  function openOverlay(html) { OV.innerHTML = html; OV.classList.remove("hidden"); }
  function closeOverlay() { OV.classList.add("hidden"); OV.innerHTML = ""; ovState = null; }
  function openDetail(html) { DOV.innerHTML = html; DOV.classList.remove("hidden"); }
  function closeDetail() { DOV.classList.add("hidden"); DOV.innerHTML = ""; }

  // re-render the current selector overlay body WITHOUT losing scroll positions
  function refreshOverlay() {
    if (!ovState) return;
    const panel = OV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? e.scrollTop : 0; });
    panel.outerHTML = ovState.render();
    const p2 = OV.querySelector(".overlay-panel");
    SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
    maybeFocusSearch();
  }
  function maybeFocusSearch() {
    const input = OV.querySelector(".ovl-search");
    const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (input && !isTouch) input.focus();
  }

  // ── creature / fusion selector ────────────────────────────────────────────
  function openCreaturePicker(slotIdx, mode /* 'primary' | 'fusion' */) {
    const slot = build.slots[slotIdx];
    ovState = {
      kind: "creature", slotIdx, mode,
      search: "", clsFilter: null,
      sel: mode === "fusion" ? slot.fusion : slot.cid,
      render: renderCreaturePicker,
    };
    openOverlay(ovState.render());
    maybeFocusSearch();
  }

  function renderCreaturePicker() {
    const st = ovState;
    const q = st.search.trim().toLowerCase();
    let list = D.creatures;
    if (st.clsFilter) list = list.filter(c => c.cls === st.clsFilter);
    if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || (c.race || "").toLowerCase().includes(q));
    const shown = list.slice(0, 400);
    const selC = st.sel != null ? CREA.get(st.sel) : null;

    const clsChips = D.classes.map(cl =>
      `<button class="chip ${st.clsFilter === cl.key ? "on" : ""}" data-cls="${cl.key}" data-action="crea-cls" data-c="${cl.key}"
        style="--c:${cl.color}">${cl.key}</button>`).join("");

    const tiles = shown.map(c => `
      <div class="pick-tile ${st.sel === c.id ? "selected" : ""}" data-action="crea-pick" data-id="${c.id}">
        <span class="pt-cls" style="--pt-cls:${clsColor(c.cls)}"></span>
        <div class="pt-sprite">${spriteImg(c.sprite)}</div>
        <div class="pt-name">${esc(c.name)}</div>
        <div class="pt-total">${c.total}</div>
      </div>`).join("");

    const title = st.mode === "fusion" ? "Choose Fusion Partner (secondary)" : "Choose Creature";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header">
        <h2>${title}</h2>
        <input class="ovl-search" placeholder="Search name / race…" value="${esc(st.search)}" data-action="crea-search">
        <button class="ovl-close" data-action="close-ovl">✕</button>
      </div>
      <div class="overlay-body">
        <div class="ovl-center">
          <div class="ovl-filterbar">${clsChips}
            <button class="chip ${st.clsFilter ? "" : "on"}" data-action="crea-cls" data-c="">All</button></div>
          <div class="ovl-center-scroll"><div class="pick-grid">${tiles}</div>
            ${list.length > 400 ? `<div class="slot-sub" style="margin-top:10px">Showing 400 of ${list.length} — refine your search.</div>` : ""}
          </div>
        </div>
        <div class="ovl-right">${selC ? renderCreatureIdentity(selC) : `<div class="slot-sub">Select a creature.</div>`}</div>
      </div>
      <div class="overlay-footer">
        <span class="foot-info">${list.length} match${list.length === 1 ? "" : "es"}${st.mode === "fusion" ? " · fusion averages both parents' stats" : ""}</span>
        <div><button class="btn-ghost" data-action="close-ovl">Cancel</button>
        <button class="btn-confirm" data-action="crea-confirm" ${st.sel == null ? "disabled" : ""}>Confirm</button></div>
      </div>
    </div></div>`;
  }

  function renderCreatureIdentity(c) {
    return `<div style="text-align:center">${spriteImg(c.sprite)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(c.name)}</h3>
      <div class="slot-sub" style="margin-bottom:10px">
        <span style="color:${clsColor(c.cls)};font-weight:700">${esc(c.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
      <div class="stat-grid" style="margin-bottom:10px">
        ${STAT_KEYS.map(k => `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span>
          <span class="stat-val total" style="grid-column:2/5">${c[k]}</span></div>`).join("")}
        <div class="stat-row hl-med"><span class="stat-name">Total</span>
          <span class="stat-val total" style="grid-column:2/5">${c.total}</span></div>
      </div>
      ${c.traitId != null ? `<div class="section-label">Innate trait</div>
        <div class="primary-traits">${traitBanner(c.traitId)}
        <div class="trait-desc">${esc((TRAIT[c.traitId] || {}).desc || "")}</div></div>` : ""}`;
  }

  // ── specialization selector ────────────────────────────────────────────────
  function openSpecPicker() {
    ovState = { kind: "spec", search: "", sel: build.specId, render: renderSpecPicker };
    openOverlay(ovState.render()); maybeFocusSearch();
  }
  function renderSpecPicker() {
    const st = ovState;
    const q = st.search.trim().toLowerCase();
    const list = D.specs.filter(s => !q || s.label.toLowerCase().includes(q));
    const sel = st.sel != null ? SPEC.get(st.sel) : null;
    const tiles = list.map(s => `
      <div class="pick-tile ${st.sel === s.id ? "selected" : ""}" data-action="spec-pick" data-id="${s.id}">
        <div class="pt-sprite">${spriteImg(s.sprite)}</div>
        <div class="pt-name">${esc(s.label)}</div></div>`).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Choose Specialization</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="spec-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center"><div class="ovl-center-scroll"><div class="pick-grid">${tiles}</div></div></div>
        <div class="ovl-right">${sel ? `<h3 style="text-align:center">${esc(sel.label)}</h3>
          <div style="text-align:center;margin:6px 0">${spriteImg(sel.sprite)}</div>
          <div class="trait-desc">${esc(sel.playstyle || "")}</div>
          <div class="slot-sub" style="margin-top:8px">${sel.perkCount} perks</div>` : `<div class="slot-sub">Select a specialization.</div>`}</div>
      </div>
      <div class="overlay-footer"><span class="foot-info">${list.length} specializations</span>
        <div><button class="btn-ghost" data-action="close-ovl">Cancel</button>
        <button class="btn-confirm" data-action="spec-confirm" ${st.sel == null ? "disabled" : ""}>Confirm</button></div></div>
    </div></div>`;
  }

  // ── artifact builder ───────────────────────────────────────────────────────
  function openArtifactBuilder(slotIdx) {
    const slot = build.slots[slotIdx];
    const a = slot.artifact || { rank: 50, primary: null, props: [], traitItemIds: [], netherIds: [] };
    ovState = { kind: "artifact", slotIdx, draft: JSON.parse(JSON.stringify(a)), tab: "props", search: "", render: renderArtifactBuilder };
    openOverlay(ovState.render());
  }
  function renderArtifactBuilder() {
    const st = ovState, a = st.draft, slot = build.slots[st.slotIdx], c = CREA.get(slot.cid);
    const rank = a.rank;
    // left: current stat preview
    const preview = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
    if (a.primary) { const p = PRIMARY.find(x => x.property === a.primary); if (p) { const k = PROP_STAT[p.stat]; if (k) preview[k] += p.perRank[rank] || 0; } }
    for (const n of a.props) { const g = propGroups.get(n); if (g) for (const e of g.entries) { const k = PROP_STAT[e.stat]; if (k) preview[k] += e.perRank[rank] || 0; } }

    const primaryRows = PRIMARY.map(p => `
      <div class="prop-row ${a.primary === p.property ? "chosen" : ""}" data-action="art-primary" data-p="${esc(p.property)}">
        <span class="prop-name">${esc(p.property)}</span><span class="prop-stat">${esc(p.stat)}</span>
        <span class="prop-val">+${p.perRank[rank]}%</span></div>`).join("");

    // props tab: stat + trick groups, searchable
    const q = st.search.trim().toLowerCase();
    const groups = [...propGroups.values()].filter(g => !q || g.name.toLowerCase().includes(q));
    const propRows = groups.map(g => {
      const on = a.props.includes(g.name);
      const val = g.entries.map(e => PROP_STAT[e.stat] ? `+${e.perRank[rank]}%` : e.perRank[rank]).join(" / ");
      const stats = g.entries.map(e => e.stat).join(" / ");
      return `<div class="prop-row ${on ? "chosen" : ""}" data-action="art-prop" data-p="${esc(g.name)}">
        <span class="prop-name">${esc(g.name)}</span><span class="prop-stat">${esc(stats)}</span>
        <span class="prop-val">${esc(val)}</span></div>`;
    }).join("");

    // trait-item tab
    const qi = st.search.trim().toLowerCase();
    const items = st.tab === "traits"
      ? D.traitItems.filter(t => t.traitName && (!qi || t.name.toLowerCase().includes(qi) || (t.traitName || "").toLowerCase().includes(qi))).slice(0, 300)
      : [];
    const itemRows = items.map(t => {
      const on = a.traitItemIds.includes(t.id);
      return `<div class="prop-row ${on ? "chosen" : ""}" data-action="art-item" data-id="${t.id}">
        <span class="prop-name">${esc(t.name)}</span>
        <span class="prop-stat">grants ${esc(t.traitName)}</span></div>`;
    }).join("");

    // nether tab
    const netherRows = nether.map(n => {
      const on = a.netherIds.includes(n.id);
      return `<div class="prop-row ${on ? "chosen" : ""}" data-action="art-nether" data-id="${n.id}">
        <span class="prop-name">${esc(n.name)}</span><span class="prop-stat">${esc((n.lines || []).length)} propert${(n.lines || []).length === 1 ? "y" : "ies"} · ${esc(n.rarity || "")}</span></div>`;
    }).join("") || `<div class="slot-sub" style="padding:8px">No Nether Stones yet — add them from the “Nether Stones” button in the top bar.</div>`;

    const tabBtn = (id, lab) => `<button class="chip ${st.tab === id ? "on" : ""}" data-action="art-tab" data-t="${id}">${lab}</button>`;
    const centerBody =
      st.tab === "props" ? propRows :
      st.tab === "traits" ? itemRows :
      netherRows;

    const chips = [
      ...(a.primary ? [`<span class="slot-chip filled">◆ ${esc(a.primary)}</span>`] : []),
      ...a.props.map(n => `<span class="slot-chip filled">${esc(n)}</span>`),
      ...a.traitItemIds.map(id => { const t = TRAITITEM.get(id); return `<span class="slot-chip filled">✦ ${esc(t ? t.traitName : id)}</span>`; }),
      ...a.netherIds.map(id => { const n = nether.find(x => x.id === id); return `<span class="slot-chip filled">◈ ${esc(n ? n.name : id)}</span>`; }),
    ].join("") || `<span class="slot-chip">No properties yet</span>`;

    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Artifact — ${esc(c ? c.name : "")}</h2>
        ${st.tab !== "props" ? `<input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="art-search">` : ""}
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left">
          <div class="rank-picker"><span class="slot-sub">Rank</span>
            <input type="range" min="1" max="50" value="${rank}" data-action="art-rank">
            <span class="rank-badge">${rank}</span></div>
          <div class="build-section"><h3>Primary stat</h3>${primaryRows}</div>
          <div class="build-section"><h3>Live bonus</h3>
            <div class="stat-grid">${STAT_KEYS.map(k => `<div class="stat-row ${preview[k] ? "hl-med" : ""}">
              <span class="stat-name">${STAT_LABEL[k]}</span>
              <span class="stat-val art" style="grid-column:2/5">${preview[k] ? "+" + preview[k] + "%" : "—"}</span></div>`).join("")}</div>
          </div>
        </div>
        <div class="ovl-center">
          <div class="ovl-filterbar">${tabBtn("props", "Properties")}${tabBtn("traits", "Trait Slots")}${tabBtn("nether", "Nether Sockets")}</div>
          <div class="ovl-center-scroll">${centerBody}</div>
        </div>
        <div class="ovl-right"><div class="section-label">Equipped</div>${chips}</div>
      </div>
      <div class="overlay-footer"><span class="foot-info">Artifact is a container: 1 primary + properties + trait / nether sockets</span>
        <div><button class="btn-ghost" data-action="art-clear">Clear</button>
        <button class="btn-confirm" data-action="art-confirm">Save Artifact</button></div></div>
    </div></div>`;
  }

  // ── relic builder ──────────────────────────────────────────────────────────
  function openRelicBuilder(slotIdx) {
    const slot = build.slots[slotIdx];
    ovState = { kind: "relic", slotIdx, sel: slot.relic ? slot.relic.id : null,
      rank: slot.relic ? slot.relic.rank : 50, search: "", render: renderRelicBuilder };
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
        <span class="prop-stat" style="flex:1;text-align:left">${esc(rk.desc)}</span></div>`).join("")}`
      : `<div class="slot-sub">Select a relic to see its rank effects.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Relic — ${esc(c ? c.name : "")}</h2>
        <input class="ovl-search" placeholder="Search relic / stat…" value="${esc(st.search)}" data-action="relic-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center"><div class="ovl-center-scroll">${rows}</div></div>
        <div class="ovl-right">
          ${sel ? `<div class="rank-picker"><span class="slot-sub">Rank</span>
            <input type="range" min="10" max="${Math.max(...sel.ranks.map(r => r.rank), 10)}" step="10" value="${st.rank}" data-action="relic-rank">
            <span class="rank-badge">${st.rank}</span></div>` : ""}
          ${detail}</div>
      </div>
      <div class="overlay-footer"><span class="foot-info">Relic effects are qualitative (not a stat number)</span>
        <div><button class="btn-ghost" data-action="relic-clear">Clear</button>
        <button class="btn-confirm" data-action="relic-confirm" ${st.sel == null ? "disabled" : ""}>Save Relic</button></div></div>
    </div></div>`;
  }

  // ── creature detail (stat table w/ fusion + artifact) ──────────────────────
  function openCreatureDetail(slotIdx) {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid); if (!c) return;
    const fs = finalStats(slot), b = fs.base;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const rows = STAT_KEYS.map(k => {
      const pct = fs.pct[k], touched = pct !== 0;
      return `<div class="stat-row ${touched ? "hl-med" : ""}">
        <span class="stat-name">${STAT_LABEL[k]}</span>
        <span class="stat-val base">${b[k]}</span>
        <span class="stat-val art">${touched ? "+" + pct + "%" : "—"}</span>
        <span class="stat-val total">${fs.final[k]}</span></div>`;
    }).join("");
    const traitIds = slotTraitIds(slot);
    const traitHtml = traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}
      <div class="trait-desc">${esc((TRAIT[tid] || {}).desc || "")}</div></div>`).join("");
    const relic = slot.relic ? RELIC.get(slot.relic.id) : null;

    openDetail(`<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(c.name)}${f ? " ⚭ " + esc(f.name) : ""}</h2>
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left" style="width:180px;text-align:center">
          ${spriteImg(c.sprite)}
          <div class="slot-sub" style="margin-top:6px"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
          ${f ? `<div class="slot-sub" style="margin-top:8px">Fused with<br><b>${esc(f.name)}</b><br>(class → ${esc(f.cls || "—")})</div>` : ""}
        </div>
        <div class="ovl-center"><div class="ovl-center-scroll">
          <div class="section-label">Stats — Base · Artifact · Total</div>
          <div class="stat-grid">
            <div class="stat-header"><span>Stat</span><span style="text-align:right">Base</span>
              <span style="text-align:right">Artifact</span><span style="text-align:right">Total</span></div>
            ${rows}
            <div class="stat-row hl-high"><span class="stat-name">Total</span>
              <span class="stat-val base">${b.total}</span><span class="stat-val art"></span>
              <span class="stat-val total">${fs.total}</span></div>
          </div>
          <div class="section-label" style="margin-top:14px">Traits (innate${f ? " + fusion" : ""}${slot.artifact && (slot.artifact.traitItemIds||[]).length ? " + artifact" : ""})</div>
          ${traitHtml || `<div class="slot-sub">No traits.</div>`}
          ${relic ? `<div class="section-label" style="margin-top:14px">Relic</div>
            <div class="primary-traits"><b>${esc(relic.name)}</b> — Rank ${slot.relic.rank}
            <div class="trait-desc">${esc((relic.ranks.filter(r => r.rank <= slot.relic.rank).map(r => "R" + r.rank + ": " + r.desc).join(" ")) || "")}</div></div>` : ""}
        </div></div>
      </div>
      <div class="overlay-footer"><span class="foot-info">Fusion averages both parents' base stats; class follows the secondary parent</span>
        <button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`);
  }

  // ── cards collection (owned + disable toggles) ─────────────────────────────
  function openCards() {
    ovState = { kind: "cards", search: "", render: renderCards };
    openOverlay(ovState.render()); maybeFocusSearch();
  }
  function renderCards() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = D.cards.filter(c => !q || c.family.toLowerCase().includes(q));
    const rows = list.map(c => {
      const owned = !cards.notOwned[c.id], enabled = owned && !cards.disabled[c.id];
      return `<div class="prop-row ${enabled ? "chosen" : ""}">
        <span class="prop-name">${esc(c.family)}</span>
        <span class="prop-stat">${esc((c.effects[0] || "").slice(0, 60))}…</span>
        <button class="chip ${owned ? "on" : ""}" data-action="card-own" data-id="${c.id}">${owned ? "Owned" : "Not owned"}</button>
        <button class="chip ${enabled ? "on" : ""}" data-action="card-toggle" data-id="${c.id}" ${owned ? "" : "disabled"}>${enabled ? "On" : "Off"}</button>
      </div>`;
    }).join("");
    const activeCount = D.cards.filter(c => !cards.notOwned[c.id] && !cards.disabled[c.id]).length;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Realm Cards</h2>
        <input class="ovl-search" placeholder="Search family…" value="${esc(st.search)}" data-action="cards-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${rows}</div></div></div>
      <div class="overlay-footer"><span class="foot-info">${activeCount}/${D.cards.length} active · default all owned & on — toggle to match your game</span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── nether stones (user-entered library) ───────────────────────────────────
  function openNether() {
    ovState = { kind: "nether", draftName: "", draftRarity: "Normal", draftLine: "", editId: null, render: renderNether };
    openOverlay(ovState.render());
  }
  function renderNether() {
    const st = ovState;
    const editing = st.editId != null ? nether.find(n => n.id === st.editId) : null;
    const lines = editing ? editing.lines : (st._lines || []);
    const listRows = nether.map(n => `<div class="prop-row ${st.editId === n.id ? "chosen" : ""}">
      <span class="prop-name">${esc(n.name)}</span>
      <span class="prop-stat">${esc(n.rarity)} · ${esc((n.lines || []).join("; ").slice(0, 60))}</span>
      <button class="chip" data-action="nether-edit" data-id="${n.id}">Edit</button>
      <button class="chip" data-action="nether-del" data-id="${n.id}">Delete</button></div>`).join("")
      || `<div class="slot-sub" style="padding:8px">No Nether Stones saved yet.</div>`;
    const lineChips = lines.map((l, i) => `<span class="slot-chip filled">${esc(l)}
      <b data-action="nether-line-del" data-i="${i}" style="cursor:pointer;color:var(--bad)">✕</b></span>`).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Nether Stones — your library</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center"><div class="ovl-center-scroll">
          <div class="section-label">Saved stones (stored in this browser)</div>${listRows}</div></div>
        <div class="ovl-right" style="width:320px">
          <div class="section-label">${editing ? "Edit stone" : "Add a stone"}</div>
          <input class="ovl-search" style="max-width:none;width:100%;margin-bottom:6px" placeholder="Name (e.g. Glowing Orb of Power)"
            value="${esc(editing ? editing.name : st.draftName)}" data-action="nether-name">
          <select data-action="nether-rarity" style="width:100%;margin-bottom:8px;background:var(--bg);color:var(--text);border:1px solid var(--border-dim);border-radius:8px;padding:8px">
            ${["Normal", "Rare", "Epic", "Legendary"].map(r => `<option ${(editing ? editing.rarity : st.draftRarity) === r ? "selected" : ""}>${r}</option>`).join("")}
          </select>
          <div class="section-label">Properties (type what your in-game stone rolled)</div>
          <div style="display:flex;gap:6px;margin-bottom:6px">
            <input class="ovl-search" style="max-width:none;flex:1" placeholder="e.g. +50% Attack, Grants Poison…" value="${esc(st.draftLine)}" data-action="nether-line">
            <button class="tb-btn" data-action="nether-line-add">Add</button></div>
          <div style="margin-bottom:10px">${lineChips || `<span class="slot-chip">No properties yet</span>`}</div>
          <button class="btn-confirm" style="width:100%" data-action="nether-save">${editing ? "Update Stone" : "Save Stone"}</button>
          ${editing ? `<button class="btn-ghost" style="width:100%;margin-top:6px" data-action="nether-cancel">Cancel edit</button>` : ""}
        </div>
      </div>
      <div class="overlay-footer"><span class="foot-info">Socket saved stones into any artifact’s “Nether Sockets” tab</span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── event delegation ───────────────────────────────────────────────────────
  let nextNetherId = (nether.reduce((m, n) => Math.max(m, n.id || 0), 0)) + 1;

  function onClick(e) {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action;
    const slotIdx = t.dataset.slot != null ? +t.dataset.slot : (ovState ? ovState.slotIdx : null);

    switch (A) {
      // home
      case "pick-creature": openCreaturePicker(+t.dataset.slot, "primary"); break;
      case "pick-fusion":   openCreaturePicker(+t.dataset.slot, "fusion"); break;
      case "build-artifact": openArtifactBuilder(+t.dataset.slot); break;
      case "build-relic":   openRelicBuilder(+t.dataset.slot); break;
      case "creature-detail": openCreatureDetail(+t.dataset.slot); break;
      case "pick-spec": openSpecPicker(); break;
      case "remove-creature": armOrDo(t, () => { build.slots[+t.dataset.slot] = emptySlot(); persistBuild(); render(); }); break;
      case "clear-spec": build.specId = null; persistBuild(); render(); break;
      case "clear-party": armOrDo(t, () => { build = { schema: 1, specId: null, slots: Array.from({ length: 6 }, emptySlot) }; persistBuild(); render(); }); break;
      case "open-cards": openCards(); break;
      case "open-nether": openNether(); break;

      // overlay chrome
      case "close-ovl": case "backdrop": if (A === "backdrop" && e.target !== t) break; closeOverlay(); break;
      case "close-detail": case "detail-backdrop": if (A === "detail-backdrop" && e.target !== t) break; closeDetail(); break;

      // creature picker
      case "crea-cls": ovState.clsFilter = t.dataset.c || null; refreshOverlay(); break;
      case "crea-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "crea-confirm": {
        const s = build.slots[ovState.slotIdx];
        if (ovState.mode === "fusion") s.fusion = ovState.sel; else s.cid = ovState.sel;
        persistBuild(); closeOverlay(); render(); break;
      }
      // spec picker
      case "spec-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "spec-confirm": build.specId = ovState.sel; persistBuild(); closeOverlay(); render(); break;

      // trait nav (stub detail — full trait page is P1)
      case "nav-trait": { const tr = TRAIT[+t.dataset.tid]; if (tr) alert(tr.name + "\n\n" + (tr.desc || "")); break; }

      // artifact builder
      case "art-tab": ovState.tab = t.dataset.t; ovState.search = ""; refreshOverlay(); break;
      case "art-primary": ovState.draft.primary = ovState.draft.primary === t.dataset.p ? null : t.dataset.p; refreshOverlay(); break;
      case "art-prop": toggleArr(ovState.draft.props, t.dataset.p); refreshOverlay(); break;
      case "art-item": toggleArr(ovState.draft.traitItemIds, +t.dataset.id); refreshOverlay(); break;
      case "art-nether": toggleArr(ovState.draft.netherIds, +t.dataset.id); refreshOverlay(); break;
      case "art-clear": ovState.draft = { rank: 50, primary: null, props: [], traitItemIds: [], netherIds: [] }; refreshOverlay(); break;
      case "art-confirm": {
        const d = ovState.draft;
        const empty = !d.primary && !d.props.length && !d.traitItemIds.length && !d.netherIds.length;
        build.slots[ovState.slotIdx].artifact = empty ? null : d;
        persistBuild(); closeOverlay(); render(); break;
      }
      // relic builder
      case "relic-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "relic-clear": build.slots[ovState.slotIdx].relic = null; persistBuild(); closeOverlay(); render(); break;
      case "relic-confirm": build.slots[ovState.slotIdx].relic = { id: ovState.sel, rank: ovState.rank }; persistBuild(); closeOverlay(); render(); break;

      // cards
      case "card-own": { const id = +t.dataset.id; if (cards.notOwned[id]) delete cards.notOwned[id]; else cards.notOwned[id] = 1; persistCards(); refreshOverlay(); break; }
      case "card-toggle": { const id = +t.dataset.id; if (cards.disabled[id]) delete cards.disabled[id]; else cards.disabled[id] = 1; persistCards(); refreshOverlay(); break; }

      // nether
      case "nether-edit": ovState.editId = +t.dataset.id; refreshOverlay(); break;
      case "nether-cancel": ovState.editId = null; ovState._lines = []; refreshOverlay(); break;
      case "nether-del": nether = nether.filter(n => n.id !== +t.dataset.id); if (ovState.editId === +t.dataset.id) ovState.editId = null; persistNether(); refreshOverlay(); break;
      case "nether-line-add": {
        const v = (ovState.draftLine || "").trim(); if (!v) break;
        if (ovState.editId != null) { const n = nether.find(x => x.id === ovState.editId); n.lines.push(v); persistNether(); }
        else { ovState._lines = ovState._lines || []; ovState._lines.push(v); }
        ovState.draftLine = ""; refreshOverlay(); break;
      }
      case "nether-line-del": {
        const i = +t.dataset.i;
        if (ovState.editId != null) { const n = nether.find(x => x.id === ovState.editId); n.lines.splice(i, 1); persistNether(); }
        else { (ovState._lines || []).splice(i, 1); }
        refreshOverlay(); break;
      }
      case "nether-save": {
        if (ovState.editId != null) { persistNether(); ovState.editId = null; ovState._lines = []; refreshOverlay(); break; }
        const name = (ovState.draftName || "").trim() || `Nether Stone ${nextNetherId}`;
        nether.push({ id: nextNetherId++, name, rarity: ovState.draftRarity, lines: (ovState._lines || []).slice() });
        ovState.draftName = ""; ovState._lines = []; persistNether(); refreshOverlay(); break;
      }
    }
  }

  // two-tap destructive: first tap arms (turns red), second within 2.5s acts
  function armOrDo(t, fn) {
    if (t.classList.contains("armed")) { fn(); return; }
    t.classList.add("armed");
    setTimeout(() => t.classList.remove("armed"), 2500);
  }
  function toggleArr(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }

  function onInput(e) {
    const t = e.target.closest("[data-action]"); if (!t || !ovState) return;
    const A = t.dataset.action, v = t.value;
    const map = {
      "crea-search": "search", "spec-search": "search", "art-search": "search",
      "relic-search": "search", "cards-search": "search", "nether-line": "draftLine", "nether-name": "draftName",
    };
    if (A === "art-rank") { ovState.draft.rank = +v; refreshOverlay(); return; }
    if (A === "relic-rank") { ovState.rank = +v; refreshOverlay(); return; }
    if (A === "nether-rarity") { if (ovState.editId != null) { const n = nether.find(x => x.id === ovState.editId); n.rarity = v; persistNether(); } else ovState.draftRarity = v; return; }
    if (A === "nether-name" && ovState.editId != null) { const n = nether.find(x => x.id === ovState.editId); n.name = v; persistNether(); return; }
    if (map[A]) {
      ovState[map[A]] = v;
      // live-filter search without losing input focus/caret: only re-render the grid-bearing overlays
      if (A.endsWith("-search")) {
        const panel = OV.querySelector(".overlay-panel");
        const scroller = panel && panel.querySelector(".ovl-center-scroll");
        const sc = scroller ? scroller.scrollTop : 0;
        // targeted: re-render but keep the search box focused
        const active = document.activeElement, caret = active && active.selectionStart;
        panel.outerHTML = ovState.render();
        const p2 = OV.querySelector(".overlay-panel");
        const inp = p2 && p2.querySelector(".ovl-search");
        if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch {} }
        const s2 = p2 && p2.querySelector(".ovl-center-scroll"); if (s2) s2.scrollTop = sc;
      }
    }
  }

  document.addEventListener("click", onClick);
  document.addEventListener("input", onInput);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!DOV.classList.contains("hidden")) closeDetail(); else if (!OV.classList.contains("hidden")) closeOverlay(); }
  });

  render();
})();
