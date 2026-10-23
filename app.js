/* Siralim Ultimate Companion — app.js
 * Build-first, overlay-driven, vanilla. State mutates then re-renders explicitly.
 * Persistence under subc.* ; scroll position is never reset on re-render. */
(() => {
  "use strict";
  const D = window.SU_DATA;
  if (!D) { document.getElementById("app").textContent = "data.js failed to load."; return; }

  // Feature flags — flip to true to re-enable. Macros (battle-AI proposal) is WIP: hidden for now.
  // nyi: content that is in the data but NOT live in the game yet (e.g. the Misery False God). Stripped from D here —
  // before anything indexes D.traits / D.falseGods — so with the flag off the app sees exactly the live-game data.
  const FEATURES = { macros: false, projects: false, nyi: false, taxoSource: false, taxoSinglesToggle: false };   // taxoSinglesToggle: "Show single-use tags" button   // taxoSource: show each tag's provenance chip (code / token / implied / llm …)
  if (!FEATURES.nyi) {
    for (const id of Object.keys(D.traits)) if (D.traits[id].nyi) delete D.traits[id];
    D.falseGods = (D.falseGods || []).filter(g => !g.nyi);
    for (const s of D.effectOrder || []) for (const f of s.fns) for (const st of f.steps) st.rows = st.rows.filter(r => !/^trait:/.test(r[0]) || D.traits[r[0].slice(6)]);
  }

  // ── runtime 404 alert — surface any asset the app requests but can't load (no silent hiding) ──
  // A missing asset is a data bug (a removed fallback or bad mapping), never hidden away. Always logs
  // to console; shows a subtle banner only on localhost or with ?debug404 so live users aren't alarmed.
  (function () {
    const missing = new Set();
    window.SU_ASSET_404 = missing;
    const dbg = location.hostname === "localhost" || location.hostname === "127.0.0.1" || /[?&]debug404/.test(location.search);
    document.addEventListener("error", (e) => {
      const t = e.target;
      if (!t || t.tagName !== "IMG" || !t.src || missing.has(t.src)) return;
      missing.add(t.src);
      console.warn("[SU asset 404]", t.src.replace(location.origin, ""));
      if (!dbg) return;
      let b = document.getElementById("su-asset-404");
      if (!b) { b = document.createElement("div"); b.id = "su-asset-404"; b.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#7a1620;color:#fff;font:12px/1.4 monospace;padding:4px 8px;max-height:28vh;overflow:auto"; document.body && document.body.appendChild(b); }
      if (b) b.textContent = `⚠ ${missing.size} missing asset(s) [404] — see console`;
    }, true);   // capture: <img> error events don't bubble
  })();

  // ── indices ──────────────────────────────────────────────────────────────
  const CREA = new Map(D.creatures.map(c => [c.id, c]));
  // name/race → representative creature (for the Realms reference: realm creatures are race names,
  // godspawn is a creature name). First match wins.
  const CREA_BY_NAME = new Map(), RACE_REP = new Map();
  for (const c of D.creatures) {
    const nk = (c.name || "").toLowerCase(); if (nk && !CREA_BY_NAME.has(nk)) CREA_BY_NAME.set(nk, c);
    if (c.sprite && c.race && !RACE_REP.has(c.race)) RACE_REP.set(c.race, c);
  }
  const realmCritFor = (name) => CREA_BY_NAME.get((name || "").toLowerCase()) || RACE_REP.get(name) || null;
  // boss-owned trait → boss sprite (Appendix). Deity = god battle sprite (D.realms/D.shops), False God =
  // combined portrait (D.falseGods). Nether/Special bosses have no sprite in the extract yet → null.
  const normNm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const GOD_BATTLE = new Map();
  for (const r of (D.realms || [])) if (r.god && r.godBattle) { const k = normNm(String(r.god).split(",")[0]); if (!GOD_BATTLE.has(k)) GOD_BATTLE.set(k, r.godBattle); }
  for (const g of ((D.shops || []).find(s => s.key === "god") || {}).groups || []) if (g.img) { const k = normNm(g.name); if (!GOD_BATTLE.has(k)) GOD_BATTLE.set(k, g.img); }
  const FG_PORTRAITS = (D.falseGods || []).map(f => ({ k: normNm(f.name), img: f.img, name: f.name }));
  const BOSS_SPRITES = D.bossSprites || {};   // normalized Deity owner → bspr_ battle sprite (incl. Caliban)
  function bossSpriteFor(t) {
    if (!t || t.ownerType !== "boss") return null;
    if (t.ownerCategory === "Deity") return BOSS_SPRITES[normNm(t.owner)] || GOD_BATTLE.get(normNm(t.owner)) || null;
    if (t.ownerCategory === "False God") {
      const g = normNm(t.ownerGroup || t.owner);
      const m = FG_PORTRAITS.find(f => f.k === g || f.k.includes(g) || g.includes(f.k));
      return m ? m.img : null;
    }
    return BOSS_SPRITES[normNm(t.owner)] || null;   // Nether/Special boss (spr_crits_battle frame) or name chip
  }
  const FG_BY_KEY = new Map((D.falseGods || []).map(g => [g.key, g]));
  // resolve a False-God-owned trait → its False God entry (ownerGroup is a short name: Impington ↔ Imp Impington)
  function falseGodFor(t) {
    if (!t || t.ownerCategory !== "False God") return null;
    const g = normNm(t.ownerGroup || t.owner);
    return (D.falseGods || []).find(f => { const k = normNm(f.name); return k === g || k.includes(g) || g.includes(k); }) || null;
  }
  const SPEC = new Map(D.specs.map(s => [s.id, s]));
  // spec label → spec EMBLEM (the class icon). NOT s.sprite — that's the player-character costume, a different
  // asset used on the spec detail/picker. Sprite (costume) and emblem (icon) are not interchangeable.
  const SPEC_EMBLEM = new Map(D.specs.map(s => [s.label, s.emblem]));
  // inline emblem / class icon shown in front of a spec or class name wherever those names are listed
  const specEmblemIco = (label) => SPEC_EMBLEM.get(label) ? `<span class="tag-ico">${spriteImg(SPEC_EMBLEM.get(label), "px")}</span>` : "";
  const specTagHtml = (label, extraCls) => `<span class="anoint-spec-tag spec-tag${extraCls ? " " + extraCls : ""}">${specEmblemIco(label)}${esc(label)}</span>`;
  const classIco = (cls) => cls && D.classIcons && D.classIcons[cls] ? `<span class="tag-ico">${spriteImg(D.classIcons[cls], "px")}</span>` : "";
  const TRAIT = D.traits;                                   // id -> {name,desc,cls,produces,consumes,labels}
  const CLS_COLOR = Object.fromEntries(D.classes.map(c => [c.key, c.color]));
  const CLASS_BG = D.classBg || {};
  const CLASS_FRAME = D.classFrame || {};
  const GEM_ICONS = D.gemIcons || [];
  // Nether-stone icon = one of the game's 16 pre-coloured `icons` frames (2085–2100); no tint/colour data exists in game.
  const gemSrc = (stone) => gemPath(stone && stone.icon);
  const gemImg = (stone, cls) => spriteImg(gemSrc(stone), cls);

  // ── Alternate skins — a creature can wear a cosmetic skin whose RESTRICTION permits it (code-grounded from
  // scr_DatabaseSkins: race-restricted skins fit any creature of that race; creature-restricted skins fit one
  // specific creature). A fused slot is recoloured by the code-exact fusion palette engine below.
  const SKINS = D.skins || [];                                   // {id,name,race,restriction,creature,img}
  const SKIN_BY_ID = new Map(SKINS.map(s => [s.id, s]));
  const skinsForCreature = (c) => !c ? [] : SKINS.filter(s =>
    s.restriction === "race" ? s.race === c.race : s.creature === c.name);
  // sprite for a creature honouring an equipped skin id (falls back to the base sprite)
  const critFaceSkinned = (c, skinId) => {
    const s = skinId != null ? SKIN_BY_ID.get(skinId) : null;
    return s && s.img ? spriteImg(s.img) : critFace(c);
  };

  // ── Fusion colour (CODE-EXACT; _su_extract code/fusion_palette.py + SKINS_AND_FUSION.md, scr_GetFusionSurface) ──
  // Each battle frame's distinct non-outline colours, sorted 4 ways (0 pixel count / 1 hue / 2 value / 3 saturation).
  // Modes 0–3: the primary's top ceil(0.5·n) colours become the secondary's colours at the same rank (shader match
  // within one 8-bit step, first row wins). Mode 4: every primary colour → nearest (squared RGB) colour of the
  // secondary's palette. FUSE_UNTINTED = the plain primary. Palettes ship in fusion.json (lazy-loaded).
  const FUSE_UNTINTED = 5;
  const FUSE_GRID = [2, 3, 0, 1, 4, FUSE_UNTINTED];      // in-game 2×3 layout: TL TR / ML MR / BL BR
  let _fuseData = null, _fuseLoad = null;
  const _fuseFrames = new Map(), _fuseImgs = new Map(), _fuseOut = new Map();
  const loadFusion = () => _fuseLoad || (_fuseLoad = fetch(D.fusionFile || "fusion.json")
    .then(r => r.json()).then(j => { _fuseData = j; }).catch(e => console.error("fusion.json failed to load", e)));
  function fuseFrame(f) {
    if (_fuseFrames.has(f)) return _fuseFrames.get(f);
    const raw = _fuseData && _fuseData.f[f]; if (!raw) return null;
    const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    const U = raw[0].split(",").map(c => ({ rgb: hex(c), a: c.endsWith("t") ? 0 : 255 }));
    const rec = { modes: [1, 2, 3, 4].map(k => raw[k].split(".").map(x => U[parseInt(x, 36)])), pal: raw[5].split(",").map(hex) };
    _fuseFrames.set(f, rec); return rec;
  }
  const fuseImg = (src) => _fuseImgs.get(src) || (_fuseImgs.set(src, new Promise((ok, no) => {
    const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; })), _fuseImgs.get(src));
  function recolourFused(im, P, S, mode) {
    const cv = document.createElement("canvas"); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const cx = cv.getContext("2d"); cx.drawImage(im, 0, 0);
    const id = cx.getImageData(0, 0, cv.width, cv.height), d = id.data, cache = new Map();
    let rows = null;
    if (mode < 4) {
      const pl = P.modes[mode], sl = S.modes[mode], n = Math.ceil(0.5 * pl.length);
      rows = []; for (let i = 0; i < n; i++) rows.push([pl[i], sl[i] || null]);
    }
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3]; if (!a) continue;
      // semi-transparent pixels (verified on an in-game Sparktail Student capture): modes 0–3 never recolour them;
      // mode 4 matches their PREMULTIPLIED colour (rgb·a) and writes the nearest palette colour fully OPAQUE
      if (a < 255 && rows) continue;
      const f = a / 255, r = d[i] * f, g = d[i + 1] * f, b = d[i + 2] * f;
      const key = a < 255 ? `p${r},${g},${b}` : (d[i] << 16 | d[i + 1] << 8 | d[i + 2]);
      let out = cache.get(key);
      if (out === undefined) {
        out = null;
        if (rows) {
          for (const [src, dst] of rows) {
            const dr = r - src.rgb[0], dg = g - src.rgb[1], db = b - src.rgb[2], da = 255 - src.a;
            if (dr * dr + dg * dg + db * db + da * da <= 1) { out = dst ? dst.rgb : null; break; }
          }
        } else {
          let best = Infinity;
          for (const c of S.pal) { const dr = r - c[0], dg = g - c[1], db = b - c[2], dd = dr * dr + dg * dg + db * db; if (dd < best) { best = dd; out = c; } }
        }
        cache.set(key, out);
      }
      if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; if (!rows) d[i + 3] = 255; }
    }
    cx.putImageData(id, 0, 0);
    return cv.toDataURL();
  }
  let _fuseRepaint = null;
  const scheduleFuseRepaint = () => { if (_fuseRepaint) return; _fuseRepaint = setTimeout(() => {
    _fuseRepaint = null; if (typeof ovState !== "undefined" && ovState) refreshOverlay(); render(); }, 0); };
  // fused sprite <img> for (primary [+skin], secondary, mode); falls back to the plain primary while computing
  function fusedFace(c, skinId, sec, mode) {
    const plain = critFaceSkinned(c, skinId);
    if (!c || !sec || mode == null || mode === FUSE_UNTINTED) return plain;
    const skin = skinId != null ? SKIN_BY_ID.get(skinId) : null;
    const src = skin && skin.img ? skin.img : c.sprite; if (!src) return plain;
    const key = `${skin ? "s" + skinId : "c" + c.id}|${sec.id}|${mode}`;
    const hit = _fuseOut.get(key);
    if (hit) return spriteImg(hit);
    if (hit === undefined) {
      _fuseOut.set(key, null);
      loadFusion().then(() => {
        const pf = skin ? _fuseData.s[skinId] : _fuseData.c[c.id], sf = _fuseData.c[sec.id];
        const P = fuseFrame(pf), S = fuseFrame(sf);
        if (!P || !S) { console.error("fusion palette missing", key, pf, sf); return; }
        return fuseImg(src).then(im => { _fuseOut.set(key, recolourFused(im, P, S, mode)); scheduleFuseRepaint(); });
      }).catch(e => console.error("fusion recolour failed", key, e));
    }
    return plain;
  }
  const slotFace = (slot, c) => fusedFace(c, slot.skinId, slot.fusion != null ? CREA.get(slot.fusion) : null, slot.fuseColor);

  const STAT_KEYS = ["hp", "atk", "int", "def", "spd"];
  const STAT_LABEL = { hp: "Health", atk: "Attack", def: "Defense", int: "Intelligence", spd: "Speed" };
  const CORE_STATS = ["Health", "Attack", "Intelligence", "Defense", "Speed"];
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
  // artifact icon tier follows the artifact's level like the game (inv_ArtifactIcon): tiers 1..6 at D.artTierMinLevel
  const ART_TIER_MIN = D.artTierMinLevel || [1, 10, 20, 30, 40, 50];
  const artTier = (rank) => { const r = rank || 50; let t = 0; ART_TIER_MIN.forEach((m, i) => { if (r >= m) t = i; }); return t; };
  const primaryIconAt = (prop, rank) => { const p = PRIMARY.find(x => x.property === prop); return p ? ((p.icons && p.icons[artTier(rank)]) || p.icon) : null; };
  // artifact enchant materials: Stat slot = Ambers, Trick slot = Slates/Curios/Cripplers/… — each maps 1:1
  // to a stat/trick property. Slots still STORE the property name (calc + migration unchanged); the picker
  // and slot chips surface the real material (name + icon).
  const STATMAT = D.statMats || [];
  const TRICKMAT = D.trickMats || [];
  const MAT_BY_PROP = new Map();                                         // property name -> material {name,icon,property}
  for (const m of [...STATMAT, ...TRICKMAT]) MAT_BY_PROP.set(m.property, m);
  // normalized effect text for a stat/trick property at a rank (the % comes from the entry's unit, not
  // just the 5 core stats): "+59% Attack", dual "+36% Attack / +36% Defense", trick "+83% Attack Damage",
  // "+19% Bleeding on Damage", flat "+3 Spell Gem Slots".
  const propEffectText = (g, rank) => {
    if (!g) return "";
    const fmt = (e) => `+${e.perRank[rank]}${e.unit === "%" ? "%" : ""}`;
    if (g.group === "trick") { const e = g.entries[0]; return `${fmt(e)} ${g.name.replace(/ On Damage$/, " on Damage")}`; }
    return g.entries.map(e => `${fmt(e)} ${e.stat}`).join(" / ");
  };
  const TRAITITEM = new Map(D.traitItems.map(t => [t.id, t]));
  const SPELL = new Map((D.spells || []).map(s => [s.id, s]));
  // name → spell, plus names sorted longest-first for greedy matching ("Major Healing" before "Healing")
  const SPELL_BY_NAME = new Map((D.spells || []).map(s => [s.name, s]));
  const SPELLGEM = D.spellGems || {};                       // class -> class-coloured gem icon
  const spellIcon = (s) => s && s.cls ? SPELLGEM[s.cls] : null;
  const SPELLPROP = new Map((D.spellProps || []).map(p => [p.id, p]));   // spell-gem property items (Slates/Curios)
  const SPELLGEM_MAX_PROPS = 3;                             // each spell gem holds up to 3 property items (at level 15)
  // spell gem LEVEL ("tier" in code, 1..15; D.spellGemTiers): drives property slots (0/1/2/3 at 1/5/10/15), the icon
  // tier, and every property's amount. Gems saved before levels existed have no `tier` → treated as max (15).
  const GT = D.spellGemTiers || { min: 1, max: 15, slots: Array(15).fill(3), iconTier: Array(15).fill(3), icons: {} };
  const gemTier = (g) => Math.max(GT.min, Math.min(GT.max, (g && +g.tier) || GT.max));
  const gemSlots = (g) => GT.slots[gemTier(g) - 1];
  const slotUnlockLevel = (i) => GT.slots.findIndex(n => n > i) + 1;   // first level with more than i slots
  // a property's effect at a gem level: the game's template ("{1}% Chance to Attack") filled from byTier
  const propText = (p, tier) => !p ? "" : (p.tpl && p.byTier ? p.tpl.replace("{1}", p.byTier[(tier || GT.max) - 1]) : (p.effect || ""));
  const propShort = (p, tier) => !p ? "" : (p.tpl && p.byTier ? propText(p, tier) : (p.swapClass ? p.effect : (p.effect || "").split(":")[0]));
  const SPELL_CLASSES = ["Nature", "Chaos", "Sorcery", "Death", "Life"];
  // built spell-gem helpers (a gem = {id,name,spellId,propIds[]})
  const gemSpell = (g) => g ? SPELL.get(g.spellId) : null;
  // Opal "Class Swap: <Class>" reclasses the gem — the swapped class overrides the spell's own class,
  // driving both the equip check and the class-coloured icon. Returns null if no Class-Swap prop is set.
  // code compatibility (scr_FixSpellGemProps / inv_SpellGemCanHaveProperty): a spell only takes the properties in its
  // `gemOk` list, never an Opal swap to its own class; one Class Swap and one potency-from-stat property per gem
  const GEM_RULES = D.spellGemRules || { potencyExclusive: [], classSwapExclusive: [] };
  const gemPropOk = (spell, p) => !spell || ((!spell.gemOk || spell.gemOk.includes(p.id)) && !(p.swapClass && p.swapClass === spell.cls));
  const gemExclusiveGroup = (id) => [GEM_RULES.potencyExclusive, GEM_RULES.classSwapExclusive].find(gr => gr.includes(id)) || null;
  const gemSwapClass = (g) => { for (const pid of (g && g.propIds || [])) { const p = SPELLPROP.get(pid); if (p && p.swapClass) return p.swapClass; } return null; };
  const gemClass = (g) => { const s = gemSpell(g); return gemSwapClass(g) || (s ? s.cls : null); };
  const gemIcon = (g) => { const cls = gemClass(g); if (!cls) return null;
    const ic = GT.icons[cls]; return (ic && ic[GT.iconTier[gemTier(g) - 1]]) || SPELLGEM[cls]; };   // icon tier follows level
  // spell gems can't be named in game: a gem is always called by its spell (old saved names are ignored)
  const gemName = (g) => g ? (gemSpell(g) ? gemSpell(g).name : "Spell Gem") : "";
  const gemSummary = (g) => { const s = gemSpell(g); const np = (g.propIds || []).length;
    return (s ? s.name : "—") + (np ? ` · ${np} propert${np === 1 ? "y" : "ies"}` : ""); };
  // compact stat readout for a spell — whatever we have (charges = code-certain; potency/target/source
  // = community compendium). Returns "" if nothing to show.
  // Agate (More Charges), code-grounded (_su_extract code/SPELL_GEMS.md S33, inv_SpellGemsUpdate): extra = floor(base × v / 100),
  // gem charges = max(base + extra, 1). Gem alone — other % charge bonuses (card set powers, Endlessly) pool before the floor.
  const AGATE = (D.spellProps || []).find(p => p.key === "AGATE"), AZURITE = (D.spellProps || []).find(p => p.key === "AZURITE");
  const agateAdd = (base, tier) => Math.floor(base * AGATE.byTier[tier - 1] / 100);
  const gemCharges = (sp, g) => {
    if (!sp || sp.charges == null) return null;
    const on = g && AGATE && (g.propIds || []).includes(AGATE.id) && gemSlots(g) > (g.propIds || []).indexOf(AGATE.id);
    return { base: sp.charges, total: on ? Math.max(sp.charges + agateAdd(sp.charges, gemTier(g)), 1) : sp.charges, v: on ? AGATE.byTier[gemTier(g) - 1] : 0 };
  };
  // why a property that's legal on this spell still does nothing ("" = it works). Rules from data, never a hand list:
  // Agate rounds down to +0 below a charge threshold; Azurite is only read when the spell deals damage or changes a stat.
  const propNoEffect = (sp, p, tier) => {
    if (!sp || !p) return "";
    if (AGATE && p.id === AGATE.id && sp.charges != null && agateAdd(sp.charges, tier) === 0)
      return `Adds no charges: ${sp.charges} × ${AGATE.byTier[tier - 1]}% rounds down to 0`;
    if (AZURITE && p.id === AZURITE.id && sp.noDmgStat) return "This spell deals no damage and changes no stat";
    return "";
  };
  const noFxChip = (why) => why ? `<span class="prop-metatag nofx" title="${esc(why)}">no effect</span>` : "";
  function spellStatsHtml(sp, g) {
    if (!sp) return "";
    const rows = [], ch = gemCharges(sp, g);
    if (sp.cls) rows.push(["Class", `<span style="color:${clsColor(sp.cls)};font-weight:700">${esc(sp.cls)}</span>`]);
    if (ch) rows.push(["Charges", ch.total !== ch.base
      ? `<span title="Agate +${ch.v}%: ${ch.base} + floor(${ch.base} × ${ch.v}%)">${ch.base} → <b>${ch.total}</b></span>` : ch.base]);
    if (sp.potency) rows.push(["Potency", esc(sp.potency)]);
    if (sp.target) rows.push(["Target", esc(sp.target)]);
    if (sp.source) rows.push(["Source", esc(sp.source)]);
    return rows.length ? `<div class="spell-stats">${rows.map(([k, v]) =>
      `<div class="ss-row"><span class="ss-k">${k}</span><span class="ss-v">${v}</span></div>`).join("")}</div>` : "";
  }
  // brief inline meta (charges · potency) for spell picker rows
  const spellMeta = (sp) => sp ? [sp.charges != null ? `${sp.charges} charge${sp.charges === 1 ? "" : "s"}` : null,
    sp.potency ? sp.potency : null].filter(Boolean).join(" · ") : "";
  // the spell's icon box (every spell row / card / container uses this one)
  const spellIco = (sp, cls = "prop-ico") => `<span class="${cls}">${spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""}</span>`;
  // THE spell-gem container row — Spell Wizard, Artifact Wizard spell socket, Nether Stone spell picker and the
  // spell-gem library preview all render from this, so changing it changes every screen.
  // opts: chosen · attrs (the owning screen's data-action + data-*) · clamp (2-line description, default on) · meta
  const spellRow = (sp, { chosen = false, attrs = "", clamp = true, meta = true } = {}) =>
    `<div class="prop-row rich${chosen ? " chosen" : ""}"${attrs ? " " + attrs : ""}>${spellIco(sp)}
      <div class="prop-body"><div class="prop-name">${esc(sp.name)}${meta && spellMeta(sp) ? `<span class="prop-metatag">${esc(spellMeta(sp))}</span>` : ""}</div>
        ${sp.desc ? `<div class="prop-sub${clamp ? " clamp" : ""}">${perkText(sp.desc)}</div>` : ""}</div></div>`;
  // fixed artifact slot template (all artifacts, max level): 1 primary + these; nether = 1 slot
  // unlock = the artifact tier (rank) each box opens at — code-grounded (_su_extract artifact_slots.json, S15:
  // inv_ArtifactStatString / obj_bsupgrade); the nether slot also needs the post-50 awakening, taken as given at 50.
  const SLOT_UNLOCK = (D.artifact && D.artifact.slotUnlocks) || {};
  const ART_SLOTS = [
    { key: "stat", label: "Stat", max: 3, pick: "stat", unlock: SLOT_UNLOCK.stat || [3, 10, 35] },
    { key: "trick", label: "Trick", max: 2, pick: "trick", unlock: SLOT_UNLOCK.trick || [5, 25] },
    { key: "traits", label: "Trait", max: 1, pick: "trait", unlock: SLOT_UNLOCK.traits || [15] },
    { key: "spells", label: "Spell", max: 1, pick: "spell", unlock: SLOT_UNLOCK.spells || [50] },
    { key: "netherIds", label: "Nether", max: 1, pick: "nether", unlock: SLOT_UNLOCK.netherIds || [50] },
  ];
  const artOpen = (sl, rank) => sl.unlock.filter(t => t <= (rank || 50)).length;   // boxes unlocked at this tier
  // keep an artifact game-legal for its tier: drop anything sitting in a box the tier hasn't unlocked
  const artTrim = (a) => { for (const sl of ART_SLOTS) if ((a[sl.key] || []).length > artOpen(sl, a.rank)) a[sl.key] = a[sl.key].slice(0, artOpen(sl, a.rank)); };
  const RELIC = new Map(D.relics.map(r => [r.id, r]));
  // relic art: the large scr_RelicBigIcon sprite everywhere; the small overworld `icon` only in the badge next to the creature
  // sprite (gearBadges). build-data errors on a relic without big art, so there's no fallback here.
  const relicArt = (r) => r && r.iconBig;
  const CARD = new Map(D.cards.map(c => [c.id, c]));
  const CONDITION = new Map((D.conditions || []).map(c => [`${c.cat}:${c.key}`, c]));   // keyed "Buff:agile" for the taxonomy viewer
  const PERS = new Map((D.personalities || []).map(p => [p.key, p]));   // personality key -> {name,raise,lower}
  const SCROLL_MAX = D.scrollMax || 15;                                  // total stat scrolls per creature (each +1 base)

  // ── persistence (schema 2) ─────────────────────────────────────────────────
  const LS = { build: "subc.build", cards: "subc.cards", nether: "subc.nether", artifacts: "subc.artifacts", spellgems: "subc.spellgems", builds: "subc.builds", bookmarks: "subc.bookmarks", favorRanks: "subc.favorRanks", homeView: "subc.homeView" };
  const jload = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? dflt : v; } catch { return dflt; } };
  const jsave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const emptySlot = () => ({ cid: null, fusion: null, artifactId: null, relic: null, spellGemIds: [], personality: null, scrolls: {}, skinId: null });
  const freshBuild = () => ({ schema: 3, specIds: 2, skinIds: 2, specId: null, perkAlloc: {}, anoints: [], slots: Array.from({ length: 6 }, emptySlot) });
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
  if (!build || build.schema !== 3) build = freshBuild();
  build.perkAlloc = build.perkAlloc || {};
  build.anoints = Array.isArray(build.anoints) ? build.anoints : [];   // equipped anointments [{specId,key}], max 5
  while (build.slots.length < 6) build.slots.push(emptySlot());
  build.slots = build.slots.map(s => Object.assign(emptySlot(), s));
  build.slots.forEach(s => { if (!Array.isArray(s.spellGemIds)) s.spellGemIds = []; if (!s.scrolls || typeof s.scrolls !== "object") s.scrolls = {}; if (!("personality" in s)) s.personality = null; });

  let cards = jload(LS.cards, null);                        // { levels: {cardId: 0..3} } — absent == 3 (max)
  if (!cards || !cards.levels) cards = { levels: {} };
  cards.applyAll = !!cards.applyAll;   // ignore saved per-card levels and treat every card as maxed
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
    // old "spell" props socketed dust items (spell-gem enchants) with no trigger — that model was wrong
    // (nether stones socket a raw spell + trigger); drop the stale ones so they don't mis-render
    n.props = n.props.filter(p => !(p.cat === "spell" && !p.trigger));
    for (const p of n.props) if (p.cat === "spell") delete p.chance;   // spells carry only a trigger (no chance)
    delete n.mainColor; delete n.outlineColor;   // the game has no stone colour data — icons are pre-coloured frames
    if (!GEM_ICONS.some(g => g.key === n.icon)) n.icon = (GEM_ICONS[0] || {}).key;   // old jewel keys → real cornether shape
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
    a.trick = [...new Set(a.trick)];                                 // the game refuses a repeated trick property
    if (!a._gemMigrated) { a.spells = []; a._gemMigrated = true; }   // artifact.spells now holds spell-GEM ids, not raw spells
    // slot unlocks by tier (2026-10-05): an artifact saved before this with more filled slots than its tier allows is
    // raised to the lowest tier that unlocks them (keeps the user's content, makes it game-legal)
    let need = a.rank || 50;
    for (const sl of ART_SLOTS) { const n = Math.min((a[sl.key] || []).length, sl.max); if (n) need = Math.max(need, sl.unlock[n - 1]); }
    if (need !== (a.rank || 50)) a.rank = need;
  }

  // spell gems (built entities: 1 spell + up to 3 property items) — slottable into CREATURES only
  let spellGems = jload(LS.spellgems, null);                // [{id,name,spellId,propIds:[]}]
  if (!Array.isArray(spellGems)) spellGems = [];

  // artifact spell slot now holds a RAW spell id (like nether stones), not a saved spell-gem id.
  // Migrate any old gem-id entries to that gem's spell id.
  for (const a of artifacts) {
    if (a._rawSpell) continue;
    a.spells = (a.spells || []).map(x => { const g = spellGems.find(gg => gg.id === x); return g ? g.spellId : (SPELL.has(x) ? x : null); }).filter(x => x != null).slice(0, 1);
    a._rawSpell = true;
  }

  // saved builds — full party snapshots with a chosen wardrobe sprite as the icon
  let builds = jload(LS.builds, null);                      // [{id,name,icon,ts,build}]
  if (!Array.isArray(builds)) builds = [];
  let nextBuildId = builds.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
  const persistBuilds = () => jsave(LS.builds, builds);
  // Spec ids became code-grounded (2026-10-01): builds saved before that store the old, mislabeled ids.
  // Remap specId / anoints[].specId / perkAlloc keys once via D.specIdMigration (old id -> new id).
  const migrateSpecIds = (b) => {
    if (!b || b.specIds === 2) return false;
    const M = D.specIdMigration || {}, map = (id) => (id != null && M[id] != null ? M[id] : id);
    b.specId = map(b.specId);
    if (Array.isArray(b.anoints)) b.anoints.forEach(a => { a.specId = map(a.specId); });
    if (b.perkAlloc) { const pa = {}; for (const k of Object.keys(b.perkAlloc)) pa[map(+k)] = b.perkAlloc[k]; b.perkAlloc = pa; }
    b.specIds = 2;
    return true;
  };
  if (migrateSpecIds(build)) jsave(LS.build, build);
  if (builds.map(x => migrateSpecIds(x.build)).some(Boolean)) persistBuilds();
  // Skin ids became code-grounded (2026-10-01): the old skin ids were shifted. Remap once via D.skinIdMigration,
  // then drop any skin the (now code-exact) restriction no longer allows on that slot's creature.
  const migrateSkinIds = (b) => {
    if (!b || b.skinIds === 2) return false;
    const M = D.skinIdMigration || {};
    for (const sl of b.slots || []) {
      if (!sl || sl.skinId == null) continue;
      const id = M[sl.skinId] != null ? M[sl.skinId] : sl.skinId;
      const c = CREA.get(sl.cid);
      sl.skinId = c && skinsForCreature(c).some(k => k.id === id) ? id : null;
    }
    b.skinIds = 2;
    return true;
  };
  if (migrateSkinIds(build)) jsave(LS.build, build);
  if (builds.map(x => migrateSkinIds(x.build)).some(Boolean)) persistBuilds();
  const normalizeBuild = (b) => {
    b.schema = 3; b.perkAlloc = b.perkAlloc || {};
    b.anoints = Array.isArray(b.anoints) ? b.anoints : [];
    b.slots = Array.isArray(b.slots) ? b.slots : [];
    while (b.slots.length < 6) b.slots.push(emptySlot());
    b.slots = b.slots.slice(0, 6).map(s => Object.assign(emptySlot(), s));
    pruneBuildRefs(b);
    return b;
  };

  const persistBuild = () => jsave(LS.build, build);
  // home party layout: "grid" (editable tiles) or "roster" (at-a-glance column — sprites stacked with
  // their traits in one shared container). A UI pref, not part of a build, so it lives on its own key.
  let homeView = jload(LS.homeView, "roster");
  if (homeView !== "grid" && homeView !== "roster") homeView = "grid";
  const persistHomeView = () => jsave(LS.homeView, homeView);
  // bookmarks — a scratch set of trait / spell ids marked from the Appendix so the selectors can filter
  // to them. Belongs to the ACTIVE build only: cleared whenever the party is reset or another build loaded.
  let bookmarks = jload(LS.bookmarks, null);
  if (!bookmarks || typeof bookmarks !== "object") bookmarks = {};
  bookmarks.traits = Array.isArray(bookmarks.traits) ? bookmarks.traits : [];
  bookmarks.spells = Array.isArray(bookmarks.spells) ? bookmarks.spells : [];
  bookmarks.perks = Array.isArray(bookmarks.perks) ? bookmarks.perks : [];   // perk KEYS (strings, unlike numeric trait/spell ids)
  const persistBookmarks = () => jsave(LS.bookmarks, bookmarks);
  const isBk = (kind, id) => bookmarks[kind].includes(id);
  const toggleBk = (kind, id) => { const a = bookmarks[kind], i = a.indexOf(id); if (i >= 0) a.splice(i, 1); else a.push(id); persistBookmarks(); };
  const clearBookmarks = () => { bookmarks.traits = []; bookmarks.spells = []; bookmarks.perks = []; persistBookmarks(); };
  const bkBtn = (kind, id) => `<button class="apx-bk ${isBk(kind, id) ? "on" : ""}" data-action="apx-bookmark" data-kind="${kind}" data-id="${id}" title="Bookmark — filter the selectors to this">${isBk(kind, id) ? "★" : "☆"}</button>`;
  // player's tracked favor rank per realm (for the personalized "best realm right now" comparison)
  let favorPrefs = jload(LS.favorRanks, null);
  if (!favorPrefs || typeof favorPrefs !== "object") favorPrefs = { use: false, ranks: {} };
  if (!favorPrefs.ranks || typeof favorPrefs.ranks !== "object") favorPrefs.ranks = {};
  const persistFavorPrefs = () => jsave(LS.favorRanks, favorPrefs);
  const persistCards = () => jsave(LS.cards, cards);
  const persistNether = () => jsave(LS.nether, nether);
  const persistArtifacts = () => jsave(LS.artifacts, artifacts);
  const persistSpellGems = () => jsave(LS.spellgems, spellGems);
  let nextNetherId = nether.reduce((m, n) => Math.max(m, n.id || 0), 0) + 1;
  let nextArtId = artifacts.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1;
  let nextSpellGemId = spellGems.reduce((m, g) => Math.max(m, g.id || 0), 0) + 1;
  // drop a build's references to deleted spell gems / artifacts. Ids are reused after a reload (max + 1), so a stale
  // id left in a saved build would later equip an unrelated new item. Runs on delete, on load, and once at startup.
  const pruneBuildRefs = (b) => {
    let changed = false;
    for (const s of (b && b.slots) || []) {
      if (!s) continue;
      const ids = s.spellGemIds || [], kept = ids.filter(id => spellGems.some(g => g.id === id));
      if (kept.length !== ids.length) { s.spellGemIds = kept; changed = true; }
      if (s.artifactId != null && !artifacts.some(a => a.id === s.artifactId)) { s.artifactId = null; changed = true; }
    }
    return changed;
  };
  const pruneAllBuildRefs = () => {
    if (pruneBuildRefs(build)) persistBuild();
    if (builds.map(b => pruneBuildRefs(b.build)).some(Boolean)) persistBuilds();
  };
  pruneAllBuildRefs();

  const cardLevel = (id) => {
    if (cards.applyAll) { const c = CARD.get(id); return c ? c.effects.length : 3; }
    return cards.levels[id] == null ? 3 : cards.levels[id];
  };

  // ── sort toggles: tap a sort → its natural direction; tap again → reversed; a third tap removes it (list falls back to
  // its default order, no button lit). Picking another sort starts in its natural direction.
  // st[key] = active sort value (null = removed; undefined = never touched → the list's default shows as lit),
  // st[revKey] = true when flipped from natural. `natDesc` = that sort's natural order is descending (stats, potency,
  // charges, recent, last-edited); name-style sorts are naturally ascending.
  const sortPick = (st, key, revKey, v) => {
    if (st[key] !== v) { st[key] = v; st[revKey] = false; }
    else if (!st[revKey]) st[revKey] = true;
    else { st[key] = null; st[revKey] = false; }
  };
  const sortCur = (v, dflt) => v === undefined ? dflt : v;   // the lit sort button: default until touched, none once removed
  const sortSign = (rev) => (rev ? -1 : 1);
  // button label with the live direction arrow on the active sort (▼ descending, ▲ ascending)
  const sortLbl = (label, active, rev, natDesc) => active ? `${label} <span class="sort-dir">${(natDesc !== !!rev) ? "▼" : "▲"}</span>` : label;
  // saved-library sort control (Artifacts / Nether Stones / Spell Gems): opts = [[value, label, naturallyDescending]]
  // (noDir: a one-direction sort, no arrow)
  const libSortSeg = (st, opts) => { const cur = sortCur(st.libSort, opts[0][0]);
    return `<div class="seg">${opts.map(([v, l, nd, noDir]) => `<button class="seg-btn ${cur === v ? "on" : ""}" data-action="lib-sort" data-v="${v}">${noDir ? l : sortLbl(l, cur === v, st.libSortRev, nd)}</button>`).join("")}</div>`; };

  // ── util ─────────────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clsColor = (cls) => CLS_COLOR[cls] || "var(--border-dim)";
  function textOn(hex) {
    const h = String(hex).replace("#", ""); if (h.length < 6) return "#fff";
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "#150e26" : "#fff";
  }
  // NO silent-hide fallback: a broken/missing sprite must FAIL LOUDLY (visible marker + console error),
  // never render blank (a silent error is as bad as a 404).
  const spriteImg = (src, cls) =>
    src ? `<img src="${esc(src)}" alt="" class="${cls || ""}" onerror="this.classList.add('sprite-missing');console.error('MISSING SPRITE:', this.getAttribute('src'))">` : "";
  const critFace = (c) => c.sprite ? spriteImg(c.sprite)
    : `<div class="crit-face" style="--face-cls:${clsColor(c.cls)}">${esc((c.name || "?").trim()[0] || "?")}</div>`;

  // translate {PARAM} tokens to plain words (bolded) + drop [icon] tokens; escape the rest.
  const TERMS = D.terms || {};
  // tokens not in D.terms must still read as a word in the sentence:
  //   {SPEC_GRAVEBORN} → the spec's name · {ACTION_casts} / {STAT_charges} / {TIMELINE} → lower-case mid-sentence words
  //   anything else → its stripped name in Title Case (never raw UPPERCASE)
  const SPEC_BY_TOKEN = new Map((D.specs || []).map(sp => [String(sp.key || "").toUpperCase(), sp.label]));
  function termWord(tok) {
    if (TERMS[tok]) return TERMS[tok];
    const sp = tok.match(/^SPEC_(.+)$/);
    if (sp && SPEC_BY_TOKEN.has(sp[1].toUpperCase())) return SPEC_BY_TOKEN.get(sp[1].toUpperCase());
    const lower = tok.match(/^(?:ACTION_|STAT_)(.+)$/) || (tok === "TIMELINE" && [0, "timeline"]);
    if (lower) return lower[1].replace(/_/g, " ").toLowerCase();
    const m = tok.match(/^(?:CONDNAME_(?:BUFF|DEBUFF|MINION)_|CONDDESC_(?:BUFF|DEBUFF|MINION)_|CDESC_|CONDNAME_|RACE_|SPELL_|CLASS_|SPEC_)(.+)$/);
    const raw = m ? m[1] : tok;
    return raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).trim() || tok;
  }
  const fmtNum = (n) => Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  // richText: {TOKEN} → bold plain word, [icon] dropped, <N> → the value scaled by `rank`.
  // In perk descriptions <N> is the PER-RANK increment, so the shown value is N × rank
  // (e.g. "<1> random buffs" at rank 3 → "3 random buffs"). Only perks carry <N>.
  function richText(str, rank) {
    if (!str) return "";
    // [icon] and [icons, 1984]-style sprite refs are dropped (leaves the following spell name as text)
    // appended condition tooltips ({CONDDESC_*}/{CDESC_*} after the effect) are redundant everywhere — drop them
    const s = String(str).replace(/(?:\n|\n|\s)*\{C(?:OND)?DESC_[A-Za-z0-9_]+\}/g, ""), re = /\{([A-Za-z0-9_]+)\}|\[[a-z0-9_]+(?:\s*,\s*\d+)*\]|<(\d+(?:\.\d+)?)>/g;
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
  // code-grounded mechanics the game text omits (e.g. the 80% damage-reduction cap, per-rune effects) —
  // shipped as `notes` on traits / perks / relic ranks and shown beside, never inside, the prose
  // `clarify`: code-grounded "what it actually does" lines for vague/misleading game text (separate from `desc`) —
  // shown ONLY on the entity taxonomy detail page
  const fxClarify = (o) => o && o.clarify && o.clarify.length ? o.clarify.map(c => `<div class="fx-clarify">${esc(c)}</div>`).join("") : "";

  // ── Taxonomy v2 (TAXONOMY_INTENT.md; the only taxonomy since the v1 cutover, 2026-10-22). The taxonomy view and the tag
  // filters read each object's taxo2 and browse by MECHANIC GROUP (D.taxonomy2.groups), not by category. A filter key is
  // "Cat::Value", or for a trigger whose meaning depends on the creature's part in it, "Trigger::Damage@r=Receiver" shown as
  // "Takes Damage" (ratified: Kill / Is Attacked / Takes Damage = Trigger + Role, readable labels, no values).
  const TRIG_ROLE_LABEL = { Attack: { Performer: "Attacks", Receiver: "Is Attacked" },
    Damage: { Performer: "Deals Damage", Receiver: "Takes Damage" }, Death: { Performer: "Kills", Receiver: "Dies" },
    Heal: { Performer: "Heals", Receiver: "Is Healed" }, Buff: { Receiver: "Is Buffed", Applier: "Buffs Someone" },
    Debuff: { Receiver: "Is Debuffed", Applier: "Debuffs Someone" },
    "Critical Hit": { Performer: "Critically Hits", Receiver: "Is Critically Hit" } };
  const roleKey = (e) => e.r && e.t.startsWith("Trigger::") && (TRIG_ROLE_LABEL[e.t.slice(9)] || {})[e.r] ? e.t + "@r=" + e.r : null;
  // Refinements (user 2026-10-19 side, 2026-10-20 source / timing / delivery): an active tag can be narrowed by the v2
  // attributes on the tag itself. Key = base key + "@s=…@so=…@p=…@d=…" (fixed order). Side: "ally" = Self, Ally, Self or
  // Ally, Adjacent; "enemy" = Enemy; a scope of Any matches both, a tag with no scope neither. The others match the
  // attribute value exactly. An object matches when ONE of its tag entries has the base key and every refinement.
  const SIDES_OF_SCOPE = { Self: ["ally"], Ally: ["ally"], "Self or Ally": ["ally"], Adjacent: ["ally"], Enemy: ["enemy"], Any: ["ally", "enemy"] };
  const REFINE = [
    { a: "s", any: "Either side", label: (v) => ({ ally: "Your side", enemy: "Enemy side" })[v], title: "Narrow this tag to one side",
      vals: (e) => SIDES_OF_SCOPE[e.s] || [] },
    { a: "so", any: "Any source", label: (v) => `Source: ${v}`, title: "Narrow this tag to one damage source", vals: (e) => e.so ? [e.so] : [] },
    { a: "p", any: "Any timing", label: (v) => `Timing: ${v}`, title: "Narrow this trigger to one timing (Would / During / After / Repeat)", vals: (e) => e.p ? [e.p] : [] },
    { a: "d", any: "Any delivery", label: (v) => `Delivery: ${v}`, title: "Event: fires reactions and counts toward limits. No Event: a silent write", vals: (e) => e.d ? [e.d] : [] },
    // code-layer markers (extract F5, user-ratified 2026-10-21)
    { a: "cf", any: "Any spell", label: (v) => `Cast from: ${v}`, title: "Narrow to where the cast spell comes from", vals: (e) => e.cf ? [e.cf] : [] },
    { a: "co", any: "Any casts", label: (v) => `Counts: ${v}`, title: "Narrow to which casts are counted", vals: (e) => e.co ? [e.co] : [] },
    { a: "cn", any: "Any count", label: (v) => `Count: ${v}`, title: "Narrow to what is counted", vals: (e) => e.cn ? [e.cn] : [] },
    { a: "ig", any: "Ignores any", label: (v) => `Ignores ${v}`, title: "Narrow to what this tag ignores", vals: (e) => e.ig ? [e.ig] : [] },
    { a: "x", any: "Any detail", label: (v) => v, title: "Narrow to a detail the game code marks on this tag", vals: (e) => e.x || [] },
  ];
  const REFINE_ORDER = (D.taxonomy2 && D.taxonomy2.attributes) || {};
  const REFINE_ATTR = { s: null, so: "source", p: "phase", d: "delivery" };   // value order from taxonomy2.attributes
  const keyParse = (k) => { const ref = {}; const base = k.replace(/@(s|so|p|d|cf|co|cn|ig|x)=([^@]+)/g, (_, a, v) => { ref[a] = v; return ""; }); return { base, ref }; };
  const keyBuild = (base, ref) => base + REFINE.map(R => ref[R.a] ? `@${R.a}=${ref[R.a]}` : "").join("");
  const keyBase = (k) => keyParse(k).base;
  const entryKeys = (e) => { const rk = roleKey(e); return rk ? [e.t, rk] : [e.t]; };
  const refineOk = (e, ref) => REFINE.every(R => !ref[R.a] || R.vals(e).includes(ref[R.a]));
  // every base filter key an object matches
  const tagKeys = (o) => {
    if (!o) return [];
    if (o._tk) return o._tk;
    const s = new Set();
    for (const e of o.taxo2 || []) for (const k of entryKeys(e)) s.add(k);
    return (o._tk = [...s]);
  };
  // does the object carry this (possibly refined) key?
  const objHasKey = (o, k) => {
    if (!o) return false;
    const { base, ref } = keyParse(k);
    if (!Object.keys(ref).length) return tagKeys(o).includes(base);
    return (o.taxo2 || []).some(e => entryKeys(e).includes(base) && refineOk(e, ref));
  };
  // the values attribute R can take for key k over these objects (entries with k's base and its OTHER refinements)
  const refineVals = (objs, k, R) => {
    const { base, ref } = keyParse(k), rest = { ...ref }; delete rest[R.a];
    const out = new Set();
    for (const o of objs) for (const e of (o && o.taxo2) || []) if (entryKeys(e).includes(base) && refineOk(e, rest)) R.vals(e).forEach(v => out.add(v));
    const order = R.a === "s" ? ["ally", "enemy"] : REFINE_ATTR[R.a] ? REFINE_ORDER[REFINE_ATTR[R.a]] || [] : [];
    return [...out].sort((x, y) => order.indexOf(x) - order.indexOf(y) || String(x).localeCompare(String(y)));
  };
  // the toggles beside an active tag chip, one per attribute that has a value on the listed objects: Any → each value → Any
  const refineBtns = (k, src, L, objs) => REFINE.map(R => {
    const cur = keyParse(k).ref[R.a], vals = refineVals(objs, k, R);
    if (!cur && !vals.length) return "";
    return `<button class="facet${cur ? " on" : ""}" data-action="taxo-refine" data-a="${R.a}" data-src="${src}" data-l="${L}" data-k="${esc(k)}" title="${esc(R.title)}">${esc(cur ? R.label(cur) : R.any)}</button>`;
  }).join("");
  // browse containers: the mechanic groups (each base key followed by its role keys)
  let _taxoGroups = null;
  function taxoGroups() {
    if (_taxoGroups) return _taxoGroups;
    // Involves (the umbrella: every effect touching the theme) heads its group
    const invFirst = (keys) => [...keys.filter(k => k.startsWith("Involves::")), ...keys.filter(k => !k.startsWith("Involves::"))];
    return (_taxoGroups = D.taxonomy2.groups.map(g => ({ name: g.name, keys: invFirst(g.keys).flatMap(k => {
      const roles = k.startsWith("Trigger::") ? Object.keys(TRIG_ROLE_LABEL[k.slice(9)] || {}) : [];
      return [k, ...roles.map(r => k + "@r=" + r)];
    }) })));
  }
  // v2 category order (layer order) for sorting a group's rows
  const TAXO_CAT_ORDER = new Map(((D.taxonomy2 && D.taxonomy2.categories) || []).map((c, i) => [c.category, i]));
  const catRank = (k) => taxoCatName(k) === "Involves" ? -1 : (TAXO_CAT_ORDER.get(taxoCatName(k)) ?? 99);   // Involves heads its group
  const taxoRowSort = (a, b) => catRank(a.key) - catRank(b.key) || taxoValName(a.key).localeCompare(taxoValName(b.key));
  // a row's label inside a group names its category ("Trigger: Takes Damage"); a trigger that also has role rows reads
  // "Damage (any)": it matches either side
  const taxoRowLabel = (k) => `${taxoCatName(k)}: ${taxoValName(k)}${k.startsWith("Trigger::") && TRIG_ROLE_LABEL[k.slice(9)] ? " (any)" : ""}`;
  // taxonomy filter: a creature's innate trait's human-facing tags ("Category::Value")
  // index of taxonomy values that match ≥1 member of a source list, grouped by category
  // (counts only hide empty values — never displayed, per minimal-chrome). Source-parameterized so
  // creatures, trait-items, (later) spell gems / perks can each reuse the same drill-down picker.
  // DISPLAY RULE (user, 2026-10-03): the data carries the full taxonomy; a value used by only ONE object
  // (across traits / perks / spells / relics / cards) is hidden from the filter + Appendix pickers unless the viewer
  // turns on "Show single-use tags". Per-viewer convenience → localStorage.
  // feature off → singles stay hidden (ignore any stored "on" so nobody is stuck with no way to turn it back off)
  let taxoShowSingles = FEATURES.taxoSinglesToggle && (() => { try { return localStorage.getItem("subc.taxoSingles") === "1"; } catch { return false; } })();
  let _taxoUse = null;
  function taxoUse() {
    if (_taxoUse) return _taxoUse;
    _taxoUse = new Map();
    const res = appendixResults([]);
    for (const arr of [res.traits, res.perks, res.spells, res.relics, res.cards])
      for (const it of arr) for (const k of new Set(tagKeys(it))) _taxoUse.set(k, (_taxoUse.get(k) || 0) + 1);
    return _taxoUse;
  }
  const taxoValVisible = (k) => taxoShowSingles || (taxoUse().get(k) || 0) >= 2;
  const singlesToggle = () => !FEATURES.taxoSinglesToggle ? "" : `<button class="facet ${taxoShowSingles ? "on" : ""}" data-action="taxo-singles" title="Tags used by only one trait, perk, spell, relic or card">Show single-use tags</button>`;
  const TAXO_IDX_CACHE = {};
  function taxoIndexFor(key0, items, getTags) {
    const key = key0 + (taxoShowSingles ? ":all" : "");
    if (TAXO_IDX_CACHE[key]) return TAXO_IDX_CACHE[key];
    const counts = new Map();
    for (const it of items) for (const k of getTags(it)) counts.set(k, (counts.get(k) || 0) + 1);
    const byCat = new Map();
    for (const g of taxoGroups()) {
      const rows = g.keys.filter(kk => counts.get(kk) && taxoValVisible(kk)).map(kk => ({ val: taxoRowLabel(kk), key: kk }));
      if (rows.length) byCat.set(g.name, rows);
    }
    TAXO_IDX_CACHE[key] = byCat;
    return byCat;
  }
  // ── TagFilter: the one tag filter for the whole app (user 2026-10-19, like the shared spell container). Every
  // taxonomy-filterable list keeps its active tags on its own state as st.tf[src] (AND). The chips, the side toggle,
  // ＋ Filter (the facet picker), the picker's index and the match all come from here. A source names the objects it
  // lists and how one maps to tag keys (creatures and trait items read their trait's tags).
  const TF_SRC = {
    // obj: the object whose tags a listed item carries (creatures and trait items: their trait)
    creature: { items: () => D.creatures, obj: (c) => c.traitId != null ? TRAIT[c.traitId] : null, changed: () => resetCreaPage() },
    card: { items: () => D.cards },
    relic: { items: () => D.relics },
    anoint: { items: () => anointList() },
    spell: { items: () => (D.spells || []).filter(sp => !sp.battleOnly && !sp.unused) },
    trait: { items: () => (D.traitItems || []).filter(t => t.traitName), obj: (ti) => TRAIT[ti.traitId] },
    perk: { items: (st) => (SPEC.get(st.specId) || { perks: [] }).perks },
    // the Taxonomy page browses its own way; chips + refinements shared (refinement values over everything in the game)
    appendix: { pool: () => { const r = appendixResults([]); return [...r.traits, ...r.perks, ...r.spells, ...r.relics, ...r.cards]; },
      changed: (st) => { st.search = ""; } },
  };
  const TagFilter = {
    get: (st, src) => (st && st.tf && st.tf[src]) || [],
    set(st, src, arr) { (st.tf || (st.tf = {}))[src] = arr; const c = TF_SRC[src].changed; if (c) c(st); },
    add(st, src, k) { const a = TagFilter.get(st, src); if (!a.includes(k)) TagFilter.set(st, src, [...a, k]); },
    rm(st, src, k) { TagFilter.set(st, src, TagFilter.get(st, src).filter(x => x !== k)); },
    // cycle one refinement of an active tag (Any → each value the listed objects have → Any)
    refine(st, src, k, a) {
      const R = REFINE.find(x => x.a === a); if (!R) return;
      const { base, ref } = keyParse(k), vals = refineVals(TagFilter.pool(st, src, k), k, R);
      const i = ref[a] ? vals.indexOf(ref[a]) : -1;
      const nref = { ...ref }; if (i + 1 < vals.length) nref[a] = vals[i + 1]; else delete nref[a];
      const nk = keyBuild(base, nref);
      TagFilter.set(st, src, TagFilter.get(st, src).map(x => x === k ? nk : x));
    },
    tagObj: (src, o) => TF_SRC[src].obj ? TF_SRC[src].obj(o) : o,
    keys: (src, o) => o ? tagKeys(TagFilter.tagObj(src, o)) : [],
    has: (src, o, k) => !!o && objHasKey(TagFilter.tagObj(src, o), k),
    match: (st, src, o) => TagFilter.get(st, src).every(k => TagFilter.has(src, o, k)),
    // picker rows (mechanic group → tags) over the source's objects that pass the active tags, so a pick never empties the list
    index(st, src) {
      const tags = TagFilter.get(st, src), S = TF_SRC[src];
      const items = S.items(st).filter(o => tags.every(k => TagFilter.has(src, o, k)));
      return taxoIndexFor(`tf:${src}:${src === "perk" ? st.specId : ""}:${tags.join("|")}`, items, (o) => TagFilter.keys(src, o));
    },
    // the tag objects a refinement toggle reads: the listed objects that pass the OTHER active tags
    pool(st, src, k) {
      const S = TF_SRC[src]; if (S.pool) return S.pool(st);
      const others = TagFilter.get(st, src).filter(x => x !== k);
      return S.items(st).filter(o => others.every(x => TagFilter.has(src, o, x))).map(o => TagFilter.tagObj(src, o));
    },
    // st lives on the selector (ovState) or the detail layer (dovState); data-l tells the click handler which
    layer: (st) => st === dovState ? "d" : "o",
    chips: (st, src) => TagFilter.get(st, src).map(k =>
      `<button class="facet on tag" data-action="tf-rm" data-src="${src}" data-l="${TagFilter.layer(st)}" data-k="${esc(k)}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`
      + refineBtns(k, src, TagFilter.layer(st), TagFilter.pool(st, src, k))).join(""),
    bar: (st, src) => TagFilter.chips(st, src) + `<button class="facet add" data-action="tf-add" data-src="${src}" data-l="${TagFilter.layer(st)}">＋ Filter</button>`,
    open: (st, src) => openFacetPicker("taxo-cat", { idxFn: () => TagFilter.index(st, src), onPick: (k) => TagFilter.add(st, src, k),
      parent: st === dovState ? st : null }),
  };
  // "Trigger::Damage@r=Receiver" → value "Takes Damage" (TRIG_ROLE_LABEL); plain keys → their value
  const taxoValName = (k0) => {
    const k = keyBase(k0), at = k.indexOf("@r="), base = at < 0 ? k : k.slice(0, at), i = base.indexOf("::"), val = i < 0 ? base : base.slice(i + 2);
    return at < 0 ? val : ((TRIG_ROLE_LABEL[val] || {})[k.slice(at + 3)] || val);
  };
  const taxoCatName = (k) => { const i = k.indexOf("::"); return i < 0 ? "" : k.slice(0, i); };

  let RACE_OPTIONS = null;
  function raceOptions() {
    if (RACE_OPTIONS) return RACE_OPTIONS;
    RACE_OPTIONS = [...new Set(D.creatures.map(c => c.race).filter(Boolean))].sort();
    return RACE_OPTIONS;
  }

  // ── stat computation (fusion + artifact + socketed nether) ─────────────────
  function resolveArtifact(slot) { return slot.artifactId != null ? artifacts.find(a => a.id === slot.artifactId) : null; }
  // effect engine (effects.js / EFFECT_ENGINE.md): every stat source + perk/trait rule lives there; the
  // functions below are thin adapters so call sites stay unchanged.
  const FX = window.SU_EFFECTS.create({
    rules: (D.effects || {}).rules || [],
    PRIMARY, propGroups, RELIC, TRAITITEM, CREA, SPEC,
    hasTrait: (id) => !!TRAIT[id],
    build: () => build, nether: () => nether,
    resolveArtifact, perkRank: (spec, p) => perkRank(spec, p),
    anointed: (specId, key) => build.anoints.some(a => a.specId === specId && a.key === key),
    slotTraitIds: (slot) => slotTraitIds(slot), finalStats: (slot) => finalStats(slot),
    slotClass: (slot) => (baseStats(slot) || {}).cls || null,
    SPELL, spellGrants: D.spellGrants || [], relicUltimates: D.relicUltimates || {}, ultimateRoutes: D.ultimateRoutes || [],
  });
  // "equipped in the current build" tests, for the saved-list Hide-equipped filter
  const artifactEquippedInBuild = (id) => build.slots.some(s => s.artifactId === id);
  const netherEquippedInBuild = (id) => build.slots.some(s => { const a = resolveArtifact(s); return a && (a.netherIds || []).includes(id); });
  const spellGemEquippedInBuild = (id) => build.slots.some(s => (s.spellGemIds || []).includes(id));   // gems only slot into creatures now
  function baseStats(slot) {
    const c = CREA.get(slot.cid); if (!c) return null;
    // Endowment (FX.fuseCopy): the Animatus fuses with a copy of creature #2 at battle start. Code: fuse2 = creature #2's
    // own creature id, so the average uses its PRIMARY creature's plain base (its fusion partner is never read), + that
    // creature's innate trait and creature #2's race; class stays (HANDOFF_endowment.md, user 2026-10-18: go with code)
    const fc = FX.fuseCopy(slot), ec = fc ? CREA.get(fc.from.cid) : null;
    const f = !ec && slot.fusion != null ? CREA.get(slot.fusion) : null;
    const partner = ec || f;
    const avg = (a, b) => partner ? Math.floor((a + b) / 2) : a;   // game: fused base = floor((A+B)/2) (scr_UpdateCreature)
    const out = { fused: !!partner };
    const sc = slot.scrolls || {};
    // BASE stats are level-1 and personality-independent (round). Scrolls (+1 base each) are part of BaseStat.
    // Personality is NOT applied here — it changes the per-LEVEL growth rate, applied in leveledStats().
    for (const k of STAT_KEYS) out[k] = avg(c[k], partner ? partner[k] : 0) + (sc[k] || 0);
    out.cls = f ? (f.cls || c.cls) : c.cls;                 // secondary's class on fusion (Endowment keeps the Animatus's)
    out.traitIds = [c.traitId, f ? f.traitId : ec ? ec.traitId : null].filter(x => x != null);
    out.race = ec ? ec.race : c.race;
    if (ec) out.endowed = ec;
    out.total = STAT_KEYS.reduce((s, k) => s + out[k], 0);
    return out;
  }
  // % contribution per base stat from an artifact object (primary + props + socketed nether)
  const artifactPctOf = (a) => FX.foldCore(FX.artifactContribs(a));
  // Personality = flat ±33% on the base stat: raised ×4/3 (+33%), lowered ×2/3 (−33%), others unchanged.
  const persRatio = (slot, k) => { const p = slot.personality ? PERS.get(slot.personality) : null; return p ? (p.raise === k ? 4 / 3 : p.lower === k ? 2 / 3 : 1) : 1; };
  function finalStats(slot) {
    const b = baseStats(slot); if (!b) return null;
    const sc = slot.scrolls || {};
    const pct = FX.slotBonusPct(slot);   // artifact + socketed nether + relic % (Deprived ignores Relic effects)
    const adj = {}, final = {};
    // Rounding = the game's (_su_extract code/STAT_ROUNDING.md): the stored stat after level growth CEILS (min 1);
    // Atk/Def/Int/Spd FLOOR once after every % bonus; Health is never floored as a whole — the artifact share floors on
    // its own, the relic share stays fractional, and the display floors. EPS absorbs float error (e.g. 59.999… → 60).
    const EPS = 1e-9, artPct = FX.foldCore(FX.artifactContribs(resolveArtifact(slot))), relPct = FX.foldCore(FX.relicContribs(slot));
    for (const k of STAT_KEYS) {
      // Personality ±33% applies to the PURE base (b minus scrolls); scrolls (+1 each) are added flat after.
      const scroll = sc[k] || 0, rawBase = b[k] - scroll;
      const eff = Math.max(1, Math.ceil(rawBase * persRatio(slot, k) - EPS)) + scroll;   // stored stat before bonus %
      adj[k] = eff;
      final[k] = k === "hp"
        ? Math.floor(eff + Math.floor(eff * artPct.hp / 100 + EPS) + eff * relPct.hp / 100 + EPS)
        : Math.floor(eff * (1 + pct[k] / 100) + EPS);
    }
    return { base: b, pct, adj, final,
             baseTotal: STAT_KEYS.reduce((s, k) => s + b[k], 0),
             total: STAT_KEYS.reduce((s, k) => s + final[k], 0) };
  }
  function slotTraitIds(slot) {
    const b = baseStats(slot); if (!b) return [];
    // Deprived ignores Fused traits → keep only the primary creature's innate trait (+ artifact-granted traits below).
    // Endowment's trait survives: Total Deprivation clears passive2 before Endowment sets it (HANDOFF_endowment.md Q6)
    const c = CREA.get(slot.cid);
    const ids = FX.ignores("fusionTraits") ? [c ? c.traitId : null, b.endowed ? b.endowed.traitId : null].filter(x => x != null) : [...b.traitIds];
    const a = resolveArtifact(slot);
    if (a) {
      // trait-item slot → its granted trait
      for (const tid of a.traits || []) { const ti = TRAITITEM.get(tid); if (ti && ti.traitId != null) ids.push(ti.traitId); }
      // socketed nether stone(s) → any trait property they carry
      for (const nid of a.netherIds || []) {
        const n = nether.find(x => x.id === nid); if (!n) continue;
        for (const p of n.props || []) { if (p.cat === "trait") { const ti = TRAITITEM.get(p.key); if (ti && ti.traitId != null) ids.push(ti.traitId); } }
      }
    }
    return [...new Set(ids)];
  }
  // nether stones socketed in the slot's artifact → their spell-property spells (trait props already
  // flow through slotTraitIds; this covers the spell props so a nether stone is fully represented).
  function slotNetherSpells(slot) {
    const a = resolveArtifact(slot); if (!a) return [];
    const out = [];
    for (const nid of a.netherIds || []) {
      const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const p of n.props || []) if (p.cat === "spell") { const sp = SPELL.get(p.key); if (sp) out.push(sp); }
    }
    return out;
  }
  // creature spell-gem slot count: base + perk/trait grants (e.g. Animator's Gray Matter → Animatus +N)
  const creatureSlotMax = (slot) => FX.gemSlotMax(slot);
  // A creature can only equip Spell Gems whose (effective) class matches its own — unless a trait/perk
  // permits otherwise, or an Opal has re-classed the gem (handled by gemClass). Returns null when ANY
  // class is allowed (a full cross-class grant), otherwise the Set of allowed class names.
  function spellEquipClasses(slot) {
    const base = baseStats(slot);
    return FX.equipClasses(slot, base && base.cls ? base.cls : null);
  }
  const canEquipGemOn = (slot, g) => { const allowed = spellEquipClasses(slot); if (allowed === null) return true; const cls = gemClass(g); return !cls || allowed.has(cls); };

  // low-key availability labels from an entity's Realm Depth + secondary favor/guild gate:
  // "RD 25", "Favor 14", "Rep 40". Works for creatures / traits / trait-materials / spells.
  const availLabels = (e) => {
    const out = [];
    if (e && typeof e.depth === "number") out.push(`RD ${e.depth}`);
    // gate names its source (self-describing): god for favor, guild for reputation, then the rank
    if (e && e.gate) out.push(`${e.gate.name} ${e.gate.rank}`);
    return out;
  };
  const availTagsHtml = (e) => { const l = availLabels(e); return l.length ? `<span class="avail-tags">${l.map(x => `<span class="avail-tag">${esc(x)}</span>`).join("")}</span>` : ""; };
  function traitBanner(tid, opts = {}) {
    const t = TRAIT[tid]; if (!t) return "";
    const color = clsColor(t.cls);
    const txt = textOn(color === "var(--border-dim)" ? "#6d5a2e" : color);   // dark text ⇒ light chip bg (Life)
    const label = opts.label || t.name;
    // the class-coloured name pill; availability labels sit INSIDE the pill, right-aligned (pill keeps full width)
    const avail = opts.noAvail ? "" : availTagsHtml(t);
    return `<span class="trait-banner${avail ? " has-avail" : ""}${txt === "#150e26" ? " on-light" : ""}"${opts.noNav ? "" : ` data-action="nav-trait" data-tid="${tid}"`}
      style="--aff-color:${color};--aff-text:${txt}" title="${esc(t.name)}">
      <span class="trait-banner-label">${esc(label)}</span>${avail}</span>`;
  }
  const artIcon = (a) => a && a.primary ? primaryIconAt(a.primary, a.rank) : null;

  // ── HOME (build-first) ─────────────────────────────────────────────────────
  function render() {
    const app = el("app");
    const scroll = app.scrollTop;
    app.innerHTML = renderHome();
    app.scrollTop = scroll;
  }

  // empty Specialization / Anointments tiles show the game's own menu glyphs (G = greyed variant)
  const EMPTY_ICON = { spec: (D.uiIcons || {}).specEmpty, anoint: (D.uiIcons || {}).anointEmpty };
  function renderHome() {
    const spec = build.specId != null ? SPEC.get(build.specId) : null;
    const specTile = `
      <div class="spec-tile ${spec ? "filled" : ""}" data-action="${spec ? "spec-detail" : "pick-spec"}" title="Specialization">
        <div class="spec-tile-icon">${spec ? spriteImg(spec.emblem || spec.sprite, "px") : spriteImg(EMPTY_ICON.spec, "px tile-empty-ico")}</div>
        <div class="spec-tile-label">${spec ? esc(spec.label) : "Specialization"}</div>
        ${spec ? `<div class="spec-tile-sub">${allocatedPerks(spec).length}/${spec.perks.length} perks · ${specPoints(spec)} pts</div>` : ""}
        ${spec ? `<button class="slot-remove" data-action="clear-spec" title="Remove">✕</button>` : ""}
      </div>`;

    const eqAnoints = equippedAnointObjs();
    const anointIcons = eqAnoints.length
      ? `<div class="anoint-tile-icons">${eqAnoints.map(a => `<span class="anoint-mini" title="${esc(a.name)}">${a.icon ? spriteImg(a.icon, "px") : "✦"}</span>`).join("")}</div>`
      : spriteImg(EMPTY_ICON.anoint, "px tile-empty-ico anoint-ph");
    const anointTile = `
      <div class="spec-tile anoint-tile ${build.anoints.length ? "filled" : ""}" data-action="${build.anoints.length ? "anoint-detail" : "open-anoint"}" title="Anointments">
        <div class="spec-tile-icon">${anointIcons}</div>
        <div class="spec-tile-label">Anointments</div>
        ${build.anoints.length ? `<div class="spec-tile-sub">${build.anoints.length}/${anointMax()} equipped</div>` : ""}
        ${build.anoints.length ? `<button class="slot-remove" data-action="clear-anoints" title="Remove all">✕</button>` : ""}
      </div>`;

    const body = homeView === "roster"
      ? `<div class="party-roster${build.slots.some(s => CREA.get(s.cid)) ? "" : " all-empty"}">${build.slots.map((s, i) => renderRosterRow(s, i)).join("")}</div>`
      : `<div class="party-grid">${build.slots.map((s, i) => renderSlot(s, i)).join("")}</div>`;
    return `
      <div class="home-top">${specTile}${anointTile}</div>
      ${body}
    `;
  }

  // The List/Grid switch lives in the header Menu (outside #app), so render() doesn't touch it —
  // reflect the active layout on its seg buttons whenever the menu opens / the layout changes.
  function syncLayoutMenu() {
    document.querySelectorAll('#main-menu [data-action="home-view"]').forEach(b =>
      b.classList.toggle("on", b.dataset.view === homeView));
  }

  // Party "at a glance" roster row: sprite (+ identity/stats/equip) on the left, all resolved traits
  // (innate + fusion + artifact/nether) stacked to the right, every row sharing one container. Mirrors
  // renderSlot's data-actions so editing (pick / remove / artifact / relic / spells / detail) still works.
  // artifact + relic badges (same size as the class/race emblems); each opens its equip flow
  function gearBadges(slot, i) {
    const a = resolveArtifact(slot), rel = slot.relic ? RELIC.get(slot.relic.id) : null;
    const artB = a && artIcon(a) ? `<span class="tile-badge gear" data-action="equip-artifact" data-slot="${i}" title="${esc(a.name)} · Rank ${a.rank || 50}">${spriteImg(artIcon(a), "px")}</span>` : "";
    const relB = rel && rel.icon ? `<span class="tile-badge gear" data-action="build-relic" data-slot="${i}" title="${esc(relicShortName(rel))} · Rank ${slot.relic.rank}">${spriteImg(rel.icon, "px")}</span>` : "";
    return artB + relB;
  }
  // swap a creature with its neighbour (whole slot: fusion, artifact, relic, gems, scrolls…). ▲▼ on roster rows, ‹ › on tiles.
  const slotMoveBtns = (i, vertical) => {
    const last = build.slots.length - 1, [up, dn] = vertical ? ["▲", "▼"] : ["‹", "›"];
    return `<span class="slot-move"><button class="spt-mv" data-action="slot-move" data-slot="${i}" data-d="-1" ${i ? "" : "disabled"} title="Move earlier">${up}</button><button class="spt-mv" data-action="slot-move" data-slot="${i}" data-d="1" ${i < last ? "" : "disabled"} title="Move later">${dn}</button></span>`;
  };
  function renderRosterRow(slot, i) {
    const c = CREA.get(slot.cid);
    const locked = i >= creatureCap();   // Pariah caps the party at 3 creatures
    if (!c) {
      if (locked) return `<div class="roster-row locked" data-slot="${i}">
        <div class="roster-identity"><div class="roster-sprite"><div class="slot-empty-icon">🔒</div></div>
          <div class="roster-name">Locked</div><div class="slot-sub">Pariah — 3 max</div></div>
        <div class="roster-traits empty"><span class="roster-empty">Party capped at 3 creatures.</span></div></div>`;
      return `<div class="roster-row empty" data-slot="${i}">
        <div class="roster-sprite roster-add" data-action="pick-creature" data-slot="${i}"><div class="slot-empty-icon">＋</div></div></div>`;
    }
    const b = baseStats(slot);
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const a = resolveArtifact(slot);
    const fs = finalStats(slot);
    const cls = b.cls;
    const clsIco = cls && D.classIcons && D.classIcons[cls]
      ? `<span class="tile-badge" title="${esc(cls)}">${spriteImg(D.classIcons[cls], "px")}</span>` : "";
    const race = b.race;
    const raceIco = race && D.raceIcons && D.raceIcons[race]
      ? `<span class="tile-badge" title="${esc(race)}">${spriteImg(D.raceIcons[race], "px")}</span>` : "";
    const traitIds = slotTraitIds(slot);
    const traitHtml = traitIds.length
      ? traitIds.map(tid => `<div class="primary-traits">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div>${traitSpellRow(tid, true)}</div>`).join("")
      : `<div class="slot-sub" style="text-align:left">No traits.</div>`;
    const statLine = STAT_KEYS.map(k => `<span class="rstat"><i>${STAT_LABEL[k].slice(0, 3)}</i>${fs.final[k]}</span>`).join("")
      + `<span class="rstat total"><i>Total</i>${fs.total}</span>`;
    return `<div class="roster-row filled ${locked ? "locked" : ""}" data-slot="${i}" title="Right-click to change creature / fusion">
      <div class="roster-identity">
        <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
        ${slotMoveBtns(i, true)}
        <div class="roster-sprite-row">
          <div class="tile-badges roster-badges left">${clsIco}${raceIco}</div>
          <div class="roster-sprite" data-action="creature-detail" data-slot="${i}">${slotFace(slot, c)}</div>
          <div class="tile-badges roster-badges">${gearBadges(slot, i)}</div>
        </div>
        <div class="roster-head">
          <div class="roster-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
          <div class="slot-sub roster-clsrace"><span style="color:${clsColor(cls)};font-weight:700">${esc(cls || "—")}</span>${race ? " · " + esc(race) : ""}</div>
        </div>
        ${locked ? `<div class="slot-sub" style="color:var(--bad);font-weight:700">Ignored (Pariah)</div>` : ""}
        <div class="roster-stats">${statLine}</div>
        <div class="roster-actions">
          <button class="slot-mini ${a ? "on" : ""}" data-action="equip-artifact" data-slot="${i}" title="Artifact">Artifact</button>
          <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
          ${spellsBtn(slot, i)}
        </div>
      </div>
      <div class="roster-traits">
        ${traitHtml}
      </div>
    </div>`;
  }

  function renderSlot(slot, i) {
    const c = CREA.get(slot.cid);
    const locked = i >= creatureCap();   // Pariah caps the party at 3 creatures
    if (!c) {
      if (locked) return `<div class="slot locked" data-slot="${i}">
        <div class="slot-sprite-wrap"><div class="slot-empty-icon">🔒</div></div>
        <div class="slot-name">Locked</div><div class="slot-sub">Pariah — 3 creatures max</div></div>`;
      return `<div class="slot" data-slot="${i}">
        <div class="slot-sprite-wrap" data-action="pick-creature" data-slot="${i}"><div class="slot-empty-icon">＋</div></div></div>`;
    }
    const b = baseStats(slot);
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const cls = b.cls;
    const a = resolveArtifact(slot);
    const clsIco = cls && D.classIcons && D.classIcons[cls]
      ? `<span class="tile-badge" title="${esc(cls)}">${spriteImg(D.classIcons[cls], "px")}</span>` : "";
    const race = b.race;
    const raceIco = race && D.raceIcons && D.raceIcons[race]
      ? `<span class="tile-badge" title="${esc(race)}">${spriteImg(D.raceIcons[race], "px")}</span>` : "";
    return `<div class="slot filled ${locked ? "locked" : ""}" data-slot="${i}" title="Right-click to change creature / fusion">
      ${locked ? `<div class="slot-ignored" title="Pariah allows only 3 creatures — this slot is ignored">Ignored</div>` : ""}
      <div class="tile-badges">${clsIco}${raceIco}</div>
      <div class="tile-badges gear-badges">${gearBadges(slot, i)}</div>
      <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
      ${slotMoveBtns(i, false)}
      <div class="slot-sprite-wrap" data-action="creature-detail" data-slot="${i}">${slotFace(slot, c)}</div>
      <div class="slot-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
      <div class="slot-actions">
        <button class="slot-mini ${a ? "on" : ""}" data-action="equip-artifact" data-slot="${i}" title="Artifact">Artifact</button>
        <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
        ${spellsBtn(slot, i)}
      </div></div>`;
  }

  // ── overlay plumbing ───────────────────────────────────────────────────────
  const OV = el("overlay-root"), DOV = el("detail-overlay-root");
  let ovState = null, dovState = null, specAnimTimer = null, wardrobeTimers = [];

  // Animate the spec info-panel costume: front-facing 2-frame walk, alternate 8× then advance a tier (cycles).
  // animate the #specCostume in a given overlay root: front-facing 2-frame walk, 8× then advance a tier
  function animateCostume(root, spec) {
    if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; }
    const tiers = (spec && spec.costumes ? spec.costumes : []).filter(c => c.frames && c.frames.length >= 2);
    const img = root && root.querySelector("#specCostume img");
    if (!img || !tiers.length) return;
    let ti = 0, fr = 0, swaps = 0;
    specAnimTimer = setInterval(() => {
      fr ^= 1; swaps++;
      img.src = tiers[ti].frames[fr];
      if (swaps >= 8) { swaps = 0; fr = 0; ti = (ti + 1) % tiers.length; }
    }, 280);
  }
  function syncSpecAnim() {
    if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; }
    if (dovState && dovState.kind === "spec-detail" && dovState.specId != null) animateCostume(DOV, SPEC.get(dovState.specId));
    else if (ovState && ovState.kind === "spec" && ovState.sel != null) animateCostume(OV, SPEC.get(ovState.sel));
  }
  // Generic wardrobe animation: any element carrying data-anim-frames='["f0","f1",…]' cycles its <img>
  // through those frames (300ms). Used by the icon-picker selected tile + the build save-form info panel.
  const stopWardrobeAnims = () => { wardrobeTimers.forEach(clearInterval); wardrobeTimers = []; };
  function syncWardrobeAnims() {
    stopWardrobeAnims();
    for (const root of [OV, DOV]) {
      if (!root || root.classList.contains("hidden")) continue;
      root.querySelectorAll("[data-anim-frames]").forEach(el => {
        let frames; try { frames = JSON.parse(el.getAttribute("data-anim-frames")); } catch { return; }
        if (!Array.isArray(frames) || frames.length < 2) return;
        const img = el.tagName === "IMG" ? el : el.querySelector("img");
        if (!img) return;
        let fr = 0;
        wardrobeTimers.push(setInterval(() => { fr ^= 1; img.src = frames[fr]; }, 300));
      });
    }
  }
  // a saved build icon → the CURRENT (versioned) wardrobe image path, so stale cached art is never shown
  const currentWardrobeImg = (p) => { const b = String(p || "").split("?")[0]; const w = (D.wardrobe || []).find(x => String(x.img || "").split("?")[0] === b); return w ? w.img : p; };
  const wardrobeFramesFor = (imgOrSprite) => {   // resolve a wardrobe entry's [f0,f1] from its img path or sprite key
    const bare = (u) => String(u || "").split("?")[0];   // saved icons may predate the ?v= asset versioning
    const w = (D.wardrobe || []).find(x => bare(x.img) === bare(imgOrSprite) || x.sprite === imgOrSprite);
    return w && Array.isArray(w.frames) && w.frames.length >= 2 ? w.frames : null;
  };
  const SCROLLERS = [".ovl-center-scroll", ".ovl-left", ".ovl-right", ".art-side-list", ".art-side-scroll", ".art-pv-body", ".xref-wrap", ".art-slot-groups"];   // top AND left are kept

  // ── Back-button handling (Android/browser) — LAYER-AWARE ───────────────────
  //    History depth mirrors the overlay STACK: one synthetic entry per open
  //    layer (selector, and detail stacked above it), plus one "exit sentinel"
  //    when the app runs installed/standalone. So Back closes exactly one layer
  //    at a time (detail before selector), and ONLY from the bare planner (when
  //    installed) does it engage the "press Back again to exit" guard. A plain
  //    browser tab with nothing open keeps zero synthetic entries, so Back leaves
  //    the site naturally and never traps a fresh tab. Reconciliation is coalesced
  //    on a microtask so synchronous open/close transitions settle to one final
  //    depth with no churn; UI closes are unwound one entry at a time.
  const overlayLayers = () => (OV.classList.contains("hidden") ? 0 : 1) + (DOV.classList.contains("hidden") ? 0 : 1);
  const anyOverlayOpen = () => overlayLayers() > 0;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const targetDepth = () => overlayLayers() + (isStandalone ? 1 : 0);
  let synthDepth = 0, pendingPop = 0, ignorePop = false, reconcileQueued = false, armExit = false, exitTimer = null;
  function reconcileHistory() {
    if (reconcileQueued) return;
    reconcileQueued = true;
    Promise.resolve().then(() => {
      reconcileQueued = false;
      const t = targetDepth();
      while (synthDepth < t) { history.pushState({ syn: 1 }, ""); synthDepth++; }
      if (synthDepth > t) { pendingPop += synthDepth - t; synthDepth = t; drainPops(); }
    });
  }
  function drainPops() { if (pendingPop > 0 && !ignorePop) { ignorePop = true; history.back(); } }

  let exitToastEl = null;
  function showExitToast() {
    if (!exitToastEl) { exitToastEl = document.createElement("div"); exitToastEl.className = "exit-toast"; exitToastEl.textContent = "Press back again to exit"; document.body.appendChild(exitToastEl); }
    exitToastEl.classList.add("show");
  }
  function hideExitToast() { if (exitToastEl) exitToastEl.classList.remove("show"); }

  window.addEventListener("popstate", () => {
    if (ignorePop) {                       // our own synthetic unwind of a UI close
      ignorePop = false;
      if (pendingPop > 0) pendingPop--;
      if (pendingPop > 0) drainPops();
      return;
    }
    if (synthDepth > 0) synthDepth--;      // a real Back consumed one entry
    if (anyOverlayOpen()) {                 // close the TOP layer (detail before selector)
      if (!DOV.classList.contains("hidden")) closeDetailReal(); else closeOverlayReal();
      reconcileHistory();
      return;
    }
    if (!isStandalone) return;             // browser tab, planner → let Back leave the site
    if (armExit) {                          // second press within the window → exit for real
      if (exitTimer) { clearTimeout(exitTimer); exitTimer = null; }
      armExit = false; history.back(); return;
    }
    armExit = true; showExitToast(); reconcileHistory();   // first press → restore sentinel + warn
    exitTimer = setTimeout(() => { armExit = false; hideExitToast(); exitTimer = null; }, 2000);
  });
  reconcileHistory();   // establish the initial depth (exit sentinel when standalone)

  // DOM-only closes; the Back handler above and the UI wrappers both use these.
  function closeOverlayReal() { if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } stopWardrobeAnims(); OV.classList.add("hidden"); OV.innerHTML = ""; ovState = null; }
  function closeDetailReal() {
    if (dovState && dovState.parent) {   // a facet picker opened from a detail page → back to that page, scroll kept
      const p = dovState.parent; dovState = p; DOV.innerHTML = p.render();
      const p2 = DOV.querySelector(".overlay-panel");
      SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e && p._scroll) e.scrollTop = p._scroll[k]; });
      return;
    }
    if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } stopWardrobeAnims(); DOV.classList.add("hidden"); DOV.innerHTML = ""; dovState = null; }

  function openOverlay(html) { OV.innerHTML = html; OV.classList.remove("hidden"); reconcileHistory(); }
  function closeOverlay() { closeOverlayReal(); reconcileHistory(); }
  function openDetail(html) { if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } DOV.innerHTML = html; DOV.classList.remove("hidden"); reconcileHistory(); }
  function closeDetail() { closeDetailReal(); reconcileHistory(); }

  // resetTop=true when this refresh is a navigation to a NEW page/view (list→detail, tab swap):
  // the new page should start at the top instead of inheriting the previous page's scroll.
  function refreshOverlay(resetTop) {
    if (!ovState) return;
    const panel = OV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? [e.scrollTop, e.scrollLeft] : [0, 0]; });
    panel.outerHTML = ovState.render();
    const p2 = OV.querySelector(".overlay-panel");
    SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (!e) return; if (!resetTop) e.scrollTop = saved[k][0]; e.scrollLeft = saved[k][1]; });   // resetTop resets vertical only
    maybeFocusSearch(OV);
    syncSpecAnim(); syncWardrobeAnims();
  }
  // Re-render a panel while a range slider is being dragged WITHOUT replacing that slider's DOM node: replacing it
  // (outerHTML) aborts the pointer/touch drag after one step — the "doesn't slide smoothly on touch" bug. Every other
  // node is patched from the fresh render; if the structure around the slider changed, fall back to a full refresh.
  function refreshKeeping(root, html, keep, fallback) {
    const panel = root.querySelector(".overlay-panel"); if (!panel || !panel.contains(keep)) return fallback();
    const tpl = document.createElement("template"); tpl.innerHTML = html.trim();
    const fresh = tpl.content.firstElementChild && tpl.content.firstElementChild.querySelector(".overlay-panel");
    const target = fresh || tpl.content.firstElementChild;
    if (!target) return fallback();
    const patch = (live, next) => {
      if (live === keep) return true;
      if (!live.contains(keep)) { if (live.isEqualNode(next)) return true; live.replaceWith(next.cloneNode(true)); return true; }
      if (live.nodeName !== next.nodeName || live.childNodes.length !== next.childNodes.length) return false;
      for (const a of [...live.attributes]) if (!next.hasAttribute(a.name)) live.removeAttribute(a.name);
      for (const a of [...next.attributes]) if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
      const lc = [...live.childNodes], nc = [...next.childNodes];
      for (let i = 0; i < lc.length; i++) if (!patch(lc[i], nc[i])) return false;
      return true;
    };
    if (!patch(panel, target)) return fallback();
    syncSpecAnim(); syncWardrobeAnims();
  }
  function refreshDetail(resetTop) {
    if (!dovState) return;
    const panel = DOV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? [e.scrollTop, e.scrollLeft] : [0, 0]; });
    panel.outerHTML = dovState.render();
    const p2 = DOV.querySelector(".overlay-panel");
    SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (!e) return; if (!resetTop) e.scrollTop = saved[k][0]; e.scrollLeft = saved[k][1]; });   // resetTop resets vertical only
    syncSpecAnim(); syncWardrobeAnims();
  }
  function maybeFocusSearch(root) {
    const input = root.querySelector(".ovl-search");
    const isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (input && !isTouch) input.focus();
  }

  // ── creature selector — guided wizard: 1) creature  2) fusion (or skip)  3) customize → commit ──
  // editing a filled slot re-opens the same wizard pre-filled so either half can change.
  // step 3 gives Personality / Scrolls / Skin their own screen so they're never buried on mobile.
  const CREA_PAGE = 400;   // creatures rendered per page; "Load more" adds another page (no filter required)
  // sortable base-stat columns for the creature picker + per-stat maxima across the whole roster
  // (so a tile can draw a bar of value/max — magnitude relative to every other creature).
  const CREA_STAT_COLS = [{ k: "hp", lbl: "HP" }, { k: "atk", lbl: "Atk" }, { k: "int", lbl: "Int" },
    { k: "def", lbl: "Def" }, { k: "spd", lbl: "Spd" }, { k: "total", lbl: "Total" }];
  const STAT_MAX = Object.fromEntries(CREA_STAT_COLS.map(c =>
    [c.k, Math.max(1, ...D.creatures.map(x => x[c.k] || 0))]));
  const sortCreatures = (list, key, rev) => key
    ? list.slice().sort((a, b) => sortSign(rev) * ((b[key] || 0) - (a[key] || 0)) || (a.name || "").localeCompare(b.name || ""))
    : list;
  function openCreaturePicker(slotIdx) {
    const slot = build.slots[slotIdx];
    ovState = {
      kind: "creature", slotIdx, step: "primary",
      primaryId: slot.cid, fusionId: slot.fusion, skinId: slot.skinId != null ? slot.skinId : null,
      personality: slot.personality || null, scrolls: { ...(slot.scrolls || {}) },
      fuseColor: slot.fuseColor != null ? slot.fuseColor : FUSE_UNTINTED,
      search: "", clsFilter: null, raceFilter: null, limit: CREA_PAGE, sort: null, view: "traits",
      render: renderCreaturePicker,
    };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const creaStepSel = (st) => st.step === "fusion" ? st.fusionId : st.primaryId;
  // reset creature-picker pagination back to the first page when the result set changes (filter/search)
  const resetCreaPage = () => { if (ovState && ovState.kind === "creature") ovState.limit = CREA_PAGE; };
  function creatureMatches(c, st) {
    if (st.step === "fusion" && st.primaryId != null && c.id === st.primaryId) return false;  // can't fuse a creature with itself
    if (st.clsFilter && c.cls !== st.clsFilter) return false;
    if (st.raceFilter && c.race !== st.raceFilter) return false;
    if (!TagFilter.match(st, "creature", c)) return false;
    if (st.bkOnly && !(c.traitId != null && bookmarks.traits.includes(c.traitId))) return false;
    if (st.search) {
      const q = st.search.toLowerCase();
      const trait = c.traitName || (TRAIT[c.traitId] || {}).name || "";
      if (!c.name.toLowerCase().includes(q) && !(c.race || "").toLowerCase().includes(q) && !trait.toLowerCase().includes(q)) return false;
    }
    return true;
  }
  function renderCreaturePicker() {
    const st = ovState;
    // dropping the last bookmark hides the "★ Bookmarked" facet — clear the filter so the grid isn't stuck empty
    if (st.bkOnly && !bookmarks.traits.length) st.bkOnly = false;
    // step 3 — customization on its own screen: controls lead (center), live preview follows (right).
    // On phones the center panel sits on top, so Personality / Scrolls / Skin are the first thing seen.
    if (st.step === "color") {   // final step for a fusion: the game's 6 colour options, same 2×3 layout
      const prim = CREA.get(st.primaryId), sec = CREA.get(st.fusionId);
      const cells = FUSE_GRID.map(m => `<button class="fuse-cell ${st.fuseColor === m ? "on" : ""}" data-action="crea-fusecolor" data-m="${m}">${fusedFace(prim, st.skinId, sec, m)}</button>`).join("");
      const footer = `<button class="btn-ghost" data-action="crea-back">‹ Back</button>
        <button class="btn-confirm" data-action="crea-confirm">Commit fusion</button>`;
      return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
        <div class="overlay-header"><h2>Fusion Colour</h2>
          <button class="ovl-close" data-action="close-ovl">✕</button></div>
        <div class="overlay-body">
          <div class="ovl-center"><div class="ovl-center-scroll"><div class="fuse-grid">${cells}</div></div></div>
        </div>
        <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
      </div></div>`;
    }
    if (st.step === "customize") {
      const footer = `<button class="btn-ghost" data-action="crea-back">‹ Back</button>
        ${st.fusionId == null
          ? `<button class="btn-confirm" data-action="crea-confirm" ${st.primaryId == null ? "disabled" : ""}>Commit (no fusion)</button>`
          : `<button class="btn-confirm" data-action="crea-next">Next ›</button>`}`;
      return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
        <div class="overlay-header"><h2>Customize</h2>
          <button class="ovl-close" data-action="close-ovl">✕</button></div>
        <div class="overlay-body">
          <div class="ovl-center"><div class="ovl-center-scroll">${renderCreatureCustomize(st, true)}</div></div>
          <div class="ovl-right">${renderWizardPreview(st)}</div>
        </div>
        <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
      </div></div>`;
    }
    const fusion = st.step === "fusion";
    const sel = creaStepSel(st);
    const list = sortCreatures(D.creatures.filter(c => creatureMatches(c, st)), st.sort, st.sortRev);
    const limit = st.limit || CREA_PAGE;
    const shown = list.slice(0, limit);
    const selC = sel != null ? CREA.get(sel) : null;
    const primaryC = st.primaryId != null ? CREA.get(st.primaryId) : null;

    const facet = (lbl, val, action) =>
      `<button class="facet ${val ? "on" : ""}" data-action="${action}">${lbl}${val ? `: ${action === "facet-class" ? classIco(val) : action === "facet-race" && D.raceIcons && D.raceIcons[val] ? `<span class="tag-ico">${spriteImg(D.raceIcons[val], "px")}</span>` : ""}<b>${esc(val)}</b>` : ""}${val ? ` <span class="facet-x" data-action="${action}-clear">✕</span>` : " ▾"}</button>`;
    const filterbar = `<div class="ovl-filterbar">
      ${facet("Class", st.clsFilter, "facet-class")}
      ${facet("Race", st.raceFilter, "facet-race")}
      ${TagFilter.bar(st, "creature")}
      ${bookmarks.traits.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="crea-bkonly" title="Show only creatures whose trait you bookmarked">★ Bookmarked</button>` : ""}
    </div>`;
    // stat sort — highest first; picking a stat draws a magnitude bar (value / roster max) on each tile
    const sortbar = `<div class="ovl-filterbar crea-sortbar"><span class="foot-info">Sort</span><div class="seg">
      <button class="seg-btn ${!st.sort ? "on" : ""}" data-action="crea-sort" data-k="">—</button>
      ${CREA_STAT_COLS.map(c => `<button class="seg-btn ${st.sort === c.k ? "on" : ""}" data-action="crea-sort" data-k="${c.k}">${sortLbl(c.lbl, st.sort === c.k, st.sortRev, true)}</button>`).join("")}
    </div></div>`;

    // fusion step leads with a "No fusion" tile so skipping is a first-class choice
    const noFuseTile = fusion ? `
      <div class="pick-tile nofuse ${st.fusionId == null ? "selected" : ""}" data-action="crea-nofuse">
        <div class="pt-sprite"><span class="nofuse-glyph">∅</span></div>
        <div class="pt-name">No fusion</div>
      </div>` : "";
    // Avatar cap: on the primary step, block Avatar creatures once the party is at its Avatar limit
    // (1 default / +Army of Gods / 0 under Deprived). The slot being edited is excluded from the count.
    const avBudget = avatarCap() - avatarCount(st.slotIdx);
    const avBlocked = (c) => !fusion && isAvatar(c) && avBudget < 1;
    const tiles = noFuseTile + shown.map(c => { const blk = avBlocked(c); return `
      <div class="pick-tile ${sel === c.id ? "selected" : ""} ${blk ? "disabled" : ""}" ${blk ? `data-action="noop" title="Avatar limit reached${avatarCap() === 0 ? " — Deprived can't use Avatars" : ""}"` : `data-action="crea-pick" data-id="${c.id}"`}>
        ${c.cls && D.classIcons && D.classIcons[c.cls]
          ? `<span class="pt-clsico" title="${esc(c.cls)}">${spriteImg(D.classIcons[c.cls], "px")}</span>`
          : `<span class="pt-cls" style="--pt-cls:${clsColor(c.cls)}"></span>`}
        ${c.race && D.raceIcons && D.raceIcons[c.race]
          ? `<span class="pt-raceico" title="${esc(c.race)}">${spriteImg(D.raceIcons[c.race], "px")}</span>` : ""}
        <div class="pt-sprite">${critFace(c)}</div>
        <div class="pt-name">${esc(c.name)}</div>
      </div>`; }).join("");

    // "Show Traits" view: same ordered/filtered list, rendered as innate-trait containers (no info panel).
    // The whole row selects the creature; the chip's nav is suppressed so one click = pick.
    const traitsView = st.view === "traits";
    const traitList = traitsView ? `<div class="crea-trait-list">
      ${fusion ? `<div class="crea-trait-row nofuse ${st.fusionId == null ? "selected" : ""}" data-action="crea-nofuse"><span class="nofuse-glyph">∅</span> No fusion</div>` : ""}
      ${shown.map(c => { const blk = avBlocked(c); const tr = c.traitId != null ? TRAIT[c.traitId] : null;
        const raceIco = c.race && D.raceIcons && D.raceIcons[c.race] ? spriteImg(D.raceIcons[c.race], "px") : "";
        const clsIco = c.cls && D.classIcons && D.classIcons[c.cls] ? spriteImg(D.classIcons[c.cls], "px") : "";
        const head = `<div class="ctr-head">
            <div class="ctr-id"><b class="ctr-name">${esc(c.name)}</b><span class="ctr-tags">
              ${c.race ? `<span class="ctr-tag">${raceIco ? `<span class="ctr-ico">${raceIco}</span>` : ""}${esc(c.race)}</span>` : ""}
              ${c.cls ? `<span class="ctr-tag">${clsIco ? `<span class="ctr-ico">${clsIco}</span>` : ""}${esc(c.cls)}</span>` : ""}</span></div>
            <div class="ctr-stats">${STAT_KEYS.map(k => `<span class="ctr-stat"><span class="ctr-stat-k">${STAT_LABEL[k]}</span> <b>${c[k] ?? "—"}</b></span>`).join("")}
</div></div>`;
        return `<div class="crea-trait-row primary-traits ${sel === c.id ? "selected" : ""} ${blk ? "disabled" : ""}"${blk ? ` data-action="noop"` : ` data-action="crea-pick" data-id="${c.id}"`}>
          ${head}${traitBanner(c.traitId, { noNav: true })}<div class="trait-desc">${richText(tr ? tr.desc || "" : "")}</div>${traitSpellRow(c.traitId, true)}</div>`; }).join("")}
    </div>` : "";

    const title = fusion ? "Fusion partner" : "Choose creature";
    // List (innate-trait list) | Grid (creature tiles) — two-part toggle, same styling as the home Layout toggle
    const viewToggle = `<div class="seg crea-view-seg">
      <button class="seg-btn ${st.view === "traits" ? "on" : ""}" data-action="crea-view" data-v="traits" title="Browse by innate trait">List</button>
      <button class="seg-btn ${st.view !== "traits" ? "on" : ""}" data-action="crea-view" data-v="grid" title="Creature tiles">Grid</button></div>`;
    const footer = fusion
      ? `<button class="btn-ghost" data-action="crea-back">‹ Back</button>
         <button class="btn-confirm" data-action="crea-next" ${st.primaryId == null ? "disabled" : ""}>Next: Customize ›</button>`
      : `<button class="btn-ghost" data-action="close-ovl">Cancel</button>
         <button class="btn-confirm" data-action="crea-next" ${st.primaryId == null ? "disabled" : ""}>Next: Fusion ›</button>`;
    // right panel: the currently-highlighted pick, plus the fusion preview once both are chosen.
    // customization (personality / scrolls / skin) now lives on its own step 3, not buried here.
    let side = "";
    if (fusion) side = renderWizardPreview(st);
    else if (selC) side = renderCreatureIdentity(selC, { infoCid: selC.id });

    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>${title}</h2>
        <input class="ovl-search" placeholder="Search name / trait / race…" value="${esc(st.search)}" data-action="crea-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect">${filterbar}${sortbar}
          <div class="ovl-center-scroll">${traitsView ? traitList : `<div class="pick-grid crea-grid">${tiles}</div>`}
            ${list.length > shown.length
              ? `<div class="crea-loadmore"><button class="btn-ghost" data-action="crea-more">Load more (${shown.length} of ${list.length})</button></div>`
              : list.length > CREA_PAGE ? `<div class="slot-sub" style="margin-top:10px;text-align:center">All ${list.length} shown</div>` : ""}</div>
        </div>
        ${traitsView ? "" : `<div class="ovl-right">${side}</div>`}
      </div>
      <div class="overlay-footer">${viewToggle}<div class="crea-foot">${footer}</div></div>
    </div></div>`;
  }
  // creature info panel: trait leads, stat table follows (per house layout). `opts.infoCid` adds an "i"
  // button (shown in the selector panel, not the detail page itself) that opens the full-screen detail.
  function renderCreatureIdentity(c, opts) {
    // in the selector, a bookmarked creature (its innate trait is bookmarked) shows a filled star next to
    // the "i" so it can be dropped from Bookmarks right here (reuses the apx-bookmark trait toggle).
    const bkStar = opts && opts.infoCid != null && c.traitId != null && isBk("traits", c.traitId)
      ? `<button class="cd-bk-btn on" data-action="apx-bookmark" data-kind="traits" data-id="${c.traitId}" title="Remove “${esc((TRAIT[c.traitId] || {}).name || "trait")}” from Bookmarks" aria-label="Remove from bookmarks">★</button>`
      : "";
    return `${opts && opts.infoCid != null ? `<button class="cd-info-btn" data-action="crea-info" data-cid="${opts.infoCid}" title="Open full details" aria-label="Open full creature details">i</button>` : ""}${bkStar}
      <div class="cd-sprite">${critFace(c)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(c.name)}</h3>
      <div class="slot-sub" style="margin-bottom:10px"><span style="color:${clsColor(c.cls)};font-weight:700">${esc(c.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
      ${c.traitId != null ? `<div class="section-label">Innate trait</div>
        <div class="primary-traits" style="margin-bottom:12px">${traitBanner(c.traitId)}<div class="trait-desc">${richText((TRAIT[c.traitId] || {}).desc || "")}</div>${traitSpellRow(c.traitId, true)}</div>` : ""}
      <div class="section-label">Base stats</div>
      <div class="stat-grid single mag">
        ${STAT_KEYS.map(k => `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span>
          <span class="stat-mag" title="${Math.round((c[k] || 0) / (STAT_MAX[k] || 1) * 100)}% of the roster max"><i style="width:${Math.round((c[k] || 0) / (STAT_MAX[k] || 1) * 100)}%"></i></span>
          <span class="stat-val total">${c[k]}</span></div>`).join("")}
        <div class="stat-row hl-med"><span class="stat-name">Total</span>
          <span class="stat-mag"><i style="width:${Math.round((c.total || 0) / (STAT_MAX.total || 1) * 100)}%"></i></span>
          <span class="stat-val total">${c.total}</span></div></div>`;
  }
  // read-only creature detail opened from the Appendix (a creature not in the party) — reuses the
  // main-screen identity panel (sprite · class/race · innate trait · base stats). Closing reveals the
  // Appendix overlay underneath; trait banners inside chain to the trait detail and back.
  function openCreaturePreview(cid) {
    const c = CREA.get(+cid); if (!c) return;
    dovState = { kind: "creature-preview", cid: +cid, render: () => renderCreaturePreview(+cid) };
    openDetail(dovState.render());
  }
  function renderCreaturePreview(cid) {
    const c = CREA.get(+cid); if (!c) return "";
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(c.name)}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll cd-preview">
        ${renderCreatureIdentity(c)}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }
  // False God detail — a boss is a set of body-part creatures that share one stat spread. One page:
  // portrait + the shared base-stat table + each part's trait. Opened from the Appendix boss-trait row.
  function openFalseGodDetail(key) {
    if (BOSS_BY_KEY.has(key)) return openBossDetail(key);   // the full boss page (bosses.json); the old page stays for NYI gods
    const g = FG_BY_KEY.get(key); if (!g) return;
    dovState = { kind: "fgod-detail", fg: key, render: () => renderFalseGodDetail(key) };
    openDetail(dovState.render());
  }
  function renderFalseGodDetail(key) {
    const g = FG_BY_KEY.get(key); if (!g) return "";
    const s = g.stats || {};
    const statTable = (st) => `<div class="stat-grid single mag">
      ${STAT_KEYS.map(k => `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span>
        <span class="stat-mag"><i style="width:${Math.round((st[k] || 0) / (STAT_MAX[k] || 1) * 100)}%"></i></span>
        <span class="stat-val total">${st[k] || 0}</span></div>`).join("")}
      <div class="stat-row hl-med"><span class="stat-name">Total</span><span class="stat-mag"></span><span class="stat-val total">${st.total || 0}</span></div></div>`;
    const parts = (g.parts || []).map(p => {
      const tr = p.traitId != null ? TRAIT[p.traitId] : null;
      return `<div class="primary-traits" style="margin-bottom:8px">
        <div class="fg-part-name"><b>${esc(p.name)}</b>${tr ? "" : `<span class="slot-sub"> · no distinct trait</span>`}</div>
        ${tr ? `${traitBanner(p.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div>${traitSpellRow(p.traitId, true, p.runtimeIds || [])}` : ""}
        ${p.stats ? `<div class="slot-sub">${STAT_KEYS.map(k => `${STAT_LABEL[k].slice(0, 3)} ${p.stats[k]}`).join(" · ")}</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${g.img ? `<span class="hdr-ico">${spriteImg(g.img)}</span>` : ""}
        <h2>${esc(g.name)}</h2><span class="anoint-spec-tag apx-boss-cat">False God</span>
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        ${g.stats ? `<div class="section-label">Body-part base stats${g.statsShared ? " · shared by all parts" : ""}</div>
        ${statTable(s)}` : ""}
        <div class="section-label"${g.stats ? ` style="margin-top:14px"` : ""}>Body parts — ${(g.parts || []).length}</div>
        ${parts || `<div class="slot-sub">No body parts.</div>`}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }
  // ── Bosses (Menu → Bosses) — one page shape for every boss type (D.bosses from _su_extract bosses.json). A unit's
  // "On its turn" / "Always" lines are rendered from the code's step list (kind + target + fields), never from trait text.
  const BOSSES = (D.bosses && D.bosses.encounters) || [];
  const BOSS_BY_KEY = new Map(BOSSES.map(e => [e.key, e]));
  const COND_BY_KEY = new Map((D.conditions || []).filter(c => c.cat !== "Minion").map(c => [c.key, c]));
  // card order follows the formation: head (grid 2), body (5), arms (4, 6), shoulders (1, 3); bosses with other parts
  // (Hydranox's heads, Caliban's orbs) use whatever sits in those grid positions
  const BOSS_GRID_ORDER = [2, 5, 4, 6, 1, 3];
  const bossUnitsOrdered = (e) => [...e.units].sort((a, b) => BOSS_GRID_ORDER.indexOf(a.grid) - BOSS_GRID_ORDER.indexOf(b.grid));
  // a Nether Boss creature wears its boss skin (battle sprite); a skinless one (Giran, the Gemlings) shows its own sprite
  const nbUnitImg = (u) => { const sk = (u.skins || []).length ? SKIN_BY_ID.get(u.skins[0]) : null; return (sk && sk.img) || (CREA.get(u.creature) || {}).sprite || null; };
  const nbLead = (e) => e.units.find(u => u.tiers) || e.units[0];
  // a god: its battle portrait (bossSprites by name), else its Avatar's creature sprite
  const ggImg = (e) => (D.bossSprites || {})[e.name.toLowerCase().replace(/[^a-z0-9]/g, "")] || (CREA.get(e.units[0].creature) || {}).sprite || null;
  const bossImg = (e) => e.type === "nether_boss" ? nbUnitImg(nbLead(e)) : e.type === "gate_god" ? ggImg(e) : (FG_BY_KEY.get(e.key) || {}).img || null;
  // every sprite the boss leads with: both halves of a duo (two different boss-trait creatures, e.g. Judgment and Mercy)
  const bossImgs = (e) => { if (e.type === "nether_boss") { const duo = e.units.filter(u => u.tiers).filter((u, i, a) => a.findIndex(x => x.name === u.name) === i);
      if (duo.length === 2) return duo.map(nbUnitImg).filter(Boolean); }
    return bossImg(e) ? [bossImg(e)] : []; };
  const bossSprs = (e, alt) => bossImgs(e).map(i => spriteImg(i, alt)).join("");
  // base stats as magnitude bars (value / the playable roster's max for that stat), same bar as the creature wizard
  const bossStatTable = (st) => `<div class="stat-grid single mag boss-stat-grid">${STAT_KEYS.map(k => { const v = st[k], pc = Math.max(0, Math.min(100, (v || 0) / (STAT_MAX[k] || 1) * 100));
    return `<div class="stat-row"><span class="stat-name">${STAT_LABEL[k]}</span><span class="stat-mag" title="${Math.round(pc)}% of the highest base ${STAT_LABEL[k]} of any creature"><i style="width:${pc}%"></i></span><span class="stat-val total">${v}</span></div>`; }).join("")}</div>`;
  // boss battle rule (bosses.json rules.boss_instant_kill): Nether Boss and False God fights turn instant kills into damage
  // the six parts drawn edge to edge in battle order (grid 1–3 top row, 4–6 bottom) so they form the whole creature; each
  // trimmed frame sits at its code offset inside its cell. jump → each part links to its card below.
  const bossFormation = (e, jump) => { const byGrid = new Map(e.units.map(u => [u.grid, u]));
    return `<div class="boss-formation">${[1, 2, 3, 4, 5, 6].map(g => { const u = byGrid.get(g), o = u && u.off;
      const img = u && u.img && o ? `<img src="${esc(u.img)}" alt="" style="left:${o[0]}%;top:${o[1]}%;width:${o[2]}%;height:${o[3]}%" onerror="this.classList.add('sprite-missing');console.error('MISSING SPRITE:', this.getAttribute('src'))">` : "";
      return jump && u ? `<button class="boss-cell" data-action="boss-jump" data-slot="${u.slot}" title="${esc(u.name)}">${img}</button>` : `<span class="boss-cell">${img}</span>`; }).join("")}</div>`; };
  function openBosses() {
    ovState = { kind: "bosses", search: "", tab: (ovState && ovState.kind === "bosses" && ovState.tab) || "nether_boss", render: renderBosses };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderBosses() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const hit = (e) => !q || e.name.toLowerCase().includes(q) || e.units.some(u => u.name.toLowerCase().includes(q) || ((CREA.get(u.creature) || {}).name || "").toLowerCase().includes(q));
    // Nether Bosses | False Gods | Gate of the Gods, the Realms page's toggle; a type with no data yet can't be picked
    const types = (D.bosses && D.bosses.types) || [];
    const has = (t) => BOSSES.some(e => e.type === t);
    const tab = has(st.tab) ? st.tab : (types.find(t => has(t.type)) || {}).type;
    const toggle = `<div class="art-view-toggle boss-types">${types.map((t, i) => `${i ? `<span class="av-pipe">|</span>` : ""}<button class="av-tab ${t.type === tab ? "on" : ""}"${has(t.type) ? "" : " disabled"} data-action="boss-tab" data-v="${t.type}">${esc(t.label)}</button>`).join("")}</div>`;
    const list = BOSSES.filter(e => e.type === tab && hit(e));
    const body = !list.length ? `<div class="slot-sub" style="padding:10px">Nothing matches “${esc(st.search)}”.</div>`
      : tab === "false_god" ? `<div class="boss-grid">${list.map(e => `<div class="boss-tile" data-action="boss-open" data-k="${esc(e.key)}">
        ${bossFormation(e, false)}<div class="pt-name">${esc(e.name)}</div></div>`).join("")}</div>`
      : `<div class="nb-grid">${list.map(e => `<button class="nb-tile" data-action="boss-open" data-k="${esc(e.key)}">
        <span class="nb-tile-spr${bossImgs(e).length > 1 ? " duo" : ""}">${bossSprs(e, "px")}</span><span class="pt-name">${esc(e.name)}</span></button>`).join("")}</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Bosses</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="bosses-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">${toggle}<div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }
  function openBossDetail(key) {
    if (!BOSS_BY_KEY.has(key)) return;
    dovState = { kind: "boss-detail", key, open: new Set(), tier: 1, render: renderBossDetail };
    openDetail(dovState.render());
  }
  // step → one plain-language line. part = what the boss's own units are called ("part" for False Gods).
  function bossStepHtml(s, part) {
    let T = {
      self: "itself", each_ally: `every other ${part}`, each_ally_and_self: `every ${part}`,
      each_ally_incl_dead: `every other ${part}, dead or alive`,
      ally_creature: [...new Set(s.units || [])].map(n => `${(s.units || []).filter(x => x === n).length > 1 ? "each " : ""}${esc(n)}`).join(" and "),
      each_player: "each of your creatures", random_player: "a random creature of yours", first_player: "your first creature",
      last_player: "your last creature", top_player_on_timeline: "your creature highest on the timeline",
      each_player_not_defending: "each of your creatures that isn't Defending", all_players: "your whole party",
    }[s.target] || "";
    // "every other part, dead or alive … if it is dead" reads as "every other dead part"
    let cond = s.when;
    if (s.target === "each_ally_incl_dead" && /\b(dead|alive)\b/.test(s.when || "")) { T = `every other ${/dead/.test(s.when) ? "dead" : "living"} ${part}`; cond = null; }
    const sp = (id) => D.spells[id] ? spellGemCard(D.spells[id]) : "";
    const cards = (ids) => `<div class="art-spellcards boss-spells">${ids.join("")}</div>`;
    const cd = (k) => { const c = k && COND_BY_KEY.get(k); return c ? `<button class="boss-chip" data-action="apx-open" data-ek="condition" data-eid="${esc(`${c.cat}:${c.key}`)}">${c.icon ? `<span class="prop-ico sm"><img src="${esc(c.icon)}" alt=""></span>` : ""}${esc(c.name)}</button>` : `<span class="boss-chip dim">nothing</span>`; };
    const chips = (ids) => `<div class="boss-chips">${ids.join("")}</div>`;
    const plain = (t) => esc(String(t || "").replace(/this unit's/g, "its").replace(/boss units?/g, (m) => m.endsWith("s") ? `${part}s` : part));
    const dtype = s.damage_type ? ` (${esc(String(s.damage_type).replace(/\s*\(.*\)$/, ""))})` : "";
    const when = cond ? ` — if ${plain(cond.replace(/^unit /, "it "))}` : "";
    const statList = (st) => st.map(x => STAT_LABEL[{ attack: "atk", intelligence: "int", defense: "def", speed: "spd", health: "hp" }[x]] || x);
    const andJoin = (a) => a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
    switch (s.kind) {
      case "attack": return `Attacks ${T}${s.power_pct !== 100 ? ` for <b>${s.power_pct}%</b> damage` : ""}`;
      case "cast": {
        const n = s.repeat || 1, ids = (s.spells || []).map(sp);
        const at = s.target === "all_players" ? ` at ${T}` : s.target === "ally_creature" ? ` on ${T}` : "";
        if (s.oneOf) return `${n > 1 ? `Casts <b>${n}</b> times, a random spell each time, from:` : "Casts a random spell from:"}${cards(ids)}`;
        return `Casts${n > 1 ? ` <b>${n}</b> times` : ""}${at}:${cards(ids)}`;
      }
      case "buff":
        if (s.conds) return `Grants ${T} one of:${chips(s.conds.map(cd))}`;
        return s.cond ? `Grants ${cd(s.cond)} to ${T}` : `Grants a random buff to ${T}`;
      case "debuff": return `Afflicts ${T} with a random debuff`;
      case "cleanse": return `Removes a random debuff from ${T}`;
      case "heal_direct": return `Restores <b>${s.pct}%</b> of max Health to ${T}${when}`;
      case "resurrect": return `Resurrects ${T} at full Health${when}`;
      case "stat_gain": {
        const ex = /^units without the (.+?) trait/.exec(s.filter || "");   // "every other part except the Body of Hydranox"
        const tgt = ex ? `${T} except the ${esc(ex[1])}` : T;
        return `Raises ${andJoin(statList(s.stat))} of ${tgt} by <b>${s.pct}%</b> of current${s.filter && !ex ? ` (${esc(s.filter)})` : ""}`;
      }
      case "damage": return `Deals damage to ${T}${dtype}: ${plain(s.formula)}`;
      case "ohko": return `<b>Instantly</b> kills ${T}`;
      case "defend": return "Defends";
      case "provoke": return "Provokes";
      case "timeline_to_bottom": return `Sends ${T} to the bottom of the timeline`;
      case "minion": return `Gives ${T} a random minion`;
      case "intensify_condition": return `Multiplies the potency of ${cd(s.cond)} on ${T} by <b>${s.multiplier}</b>`;
      case "immune_damage": return `Immune to damage${s.when ? ` while ${plain(s.when)}` : ""}`;
      case "damage_bonus_vs_condition": return `Extra damage against ${cd(s.cond)}: ${plain(s.formula)}`;
      case "reflect_on_damaged": return `After taking damage, deals ${plain(s.formula)} to ${plain(s.target)}${dtype}`;
      case "keep_condition": return `${s.target === "each_player" ? "Your creatures" : T} always have ${cd(s.cond)}`;
      case "revive": return `Revives <b>${s.count}</b> times, at ${andJoin((s.stages || []).map(x => `${x.hp_pct}%`))} Health; each time every other ${part} returns to full Health`;
      default: return esc(s.text || s.kind);
    }
  }
  // consecutive stat gains with the same target + amount read as one line ("Attack and Intelligence")
  const bossMerge = (arr) => arr.reduce((out, s) => {
    const p = out[out.length - 1];
    if (s.kind === "stat_gain" && p && p.kind === "stat_gain" && p.target === s.target && p.pct === s.pct && p.filter === s.filter && String(p.units) === String(s.units)) p.stat.push(s.stat);
    else out.push(s.kind === "stat_gain" ? { ...s, stat: [s.stat] } : s);
    return out;
  }, []);
  // Threats: one container per dangerous mechanic, found from the code's step kinds only. Each holds the steps that cause it
  // (part name → its card) and a plain-language "why it matters" built from the same steps.
  function bossThreats(e, part) {
    const map = new Map(), order = [];
    const add = (k, u, s, when) => { if (!map.has(k)) { map.set(k, []); order.push(k); } map.get(k).push({ u, s, when }); };
    for (const u of bossUnitsOrdered(e)) for (const [when, arr] of [["turn", bossMerge(u.turn || [])], ["always", bossMerge(u.passives)]]) for (const s of arr) {
      const f = String(s.formula || "");
      if (s.kind === "ohko") add(s.target === "each_player_not_defending" ? "ohko_def" : "ohko", u, s, when);
      else if (s.cond && ["keep_condition", "intensify_condition", "damage_bonus_vs_condition"].includes(s.kind)) add(`cond:${s.cond}`, u, s, when);
      else if (s.kind === "immune_damage") add(s.when ? `shield:${u.slot}` : "immune", u, s, when);
      else if (s.kind === "revive") add(`shield:${u.slot}`, u, s, when);
      else if (s.kind === "resurrect") add("rez", u, s, when);
      else if (s.kind === "reflect_on_damaged") add("reflect", u, s, when);
      else if (s.kind === "timeline_to_bottom") add("timeline", u, s, when);
      else if (s.kind === "damage" && /debuffs on the target/.test(f)) add("debuffs", u, s, when);
      else if (s.kind === "damage" && /not Provoking/.test(f)) add("provoke", u, s, when);
      else if ((s.kind === "stat_gain" && when === "turn") || (s.kind === "damage" && /stat gains/.test(f))) add("grow", u, s, when);
      else if (s.kind === "attack" && s.power_pct >= 300) add("heavy", u, s, when);
    }
    const uniq = (its) => [...new Set(its.map(i => i.u.name))];
    // "the Body of Loid and each Arm of Loid" — a part with two copies reads "each …"; plural() picks the verb form
    const names = (its) => { const n = uniq(its).map(x => new Set(its.filter(i => i.u.name === x).map(i => i.u.slot)).size > 1 ? `each ${x}` : `the ${x}`);
      return n.length < 2 ? n.join("") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`; };
    const plural = (its) => uniq(its).length > 1;
    const cap = (t) => t.replace(/^./, x => x.toUpperCase());
    const timer = e.mechanics.find(m => m.kind === "timer_exit");
    const allImmune = e.units.every(u => u.passives.some(x => x.kind === "immune_damage" && !x.when));   // can't be killed (Jotun)
    const out = [];
    if (timer) out.push({ title: `Survive ${timer.turns} turns`, extra: "",
      effect: `<p class="boss-threat-fx">${esc(e.name)} leaves after <b>${timer.turns}</b> turns (every creature's turn counts) and all its ${part}s die.${allImmune ? ` Every ${part} is immune to damage.` : ""}</p>`,
      why: allImmune ? "You can't win by attacking: damage does nothing here. You win by staying alive until it leaves, so healing, Defense and protection matter more than damage."
        : `The fight ends on its own after ${timer.turns} turns.` });
    for (const k of order) {
      const its = map.get(k), u0 = its[0].u, s0 = its[0].s;
      const c = s0.cond ? COND_BY_KEY.get(s0.cond) : null;
      let title = "", why = "", extra = "";
      if (k === "ohko_def") { title = "Kills anyone not Defending";
        why = `Health and Defense don't help: any creature of yours that isn't Defending when the ${u0.name} acts dies outright. Watch the timeline and have your creatures Defending before it acts, or kill the ${u0.name} first.`; }
      else if (k === "ohko") { title = "Instant kill";
        why = `Every turn the ${u0.name} takes, one of your creatures dies outright, whatever its Health or Defense. Over a long fight that adds up: kill the ${u0.name} early, and bring resurrection.`; }
      else if (k.startsWith("cond:") && c) {
        const keep = its.find(i => i.s.kind === "keep_condition"), grow = its.find(i => i.s.kind === "intensify_condition"), bonus = its.filter(i => i.s.kind === "damage_bonus_vs_condition");
        title = `${keep ? "Permanent " : ""}${grow ? (keep ? "growing " : "Growing ") : ""}${c.name}`;
        extra = c.desc ? `<div class="trait-desc boss-threat-cond">${richText(c.desc)}</div>` : "";
        why = [keep && (s0.cond === "blight"
            ? "Your whole party can't be healed for the entire fight, and healing effects damage them instead. A team that relies on healing turns against itself here: lean on damage prevention and killing fast."
            : `Your creatures have ${c.name} for the whole fight, so removing it doesn't stick.`),
          grow && `Every turn the ${grow.u.name} takes, the potency of ${c.name} on your creatures is multiplied by ${grow.s.multiplier}, so it keeps climbing until the ${grow.u.name} dies.`,
          bonus.length && `${cap(names(bonus))} also deal${plural(bonus) ? "" : "s"} extra damage the stronger ${c.name} is on the target.`,
          grow && `Kill the ${grow.u.name} early.`].filter(Boolean).join(" ");
      }
      else if (k === "immune") { if (timer && allImmune) continue; title = "Immune to damage";
        why = `${cap(names(its))} can't be damaged at all.`; }
      else if (k.startsWith("shield:")) {
        const imm = its.find(i => i.s.kind === "immune_damage"), rev = its.find(i => i.s.kind === "revive");
        title = `${u0.name}: ${[imm && "shielded", rev && `revives ${rev.s.count}×`].filter(Boolean).join(", ")}`;
        why = [imm && `You can't damage the ${u0.name} until every other ${part} is dead.`,
          rev && `It comes back ${rev.s.count} times (at ${rev.s.stages.map(x => `${x.hp_pct}%`).join(" and ")} Health), and each time every other ${part} returns to full Health, so the fight nearly starts over.`,
          "Expect a long fight: bring sustain, not just burst damage."].filter(Boolean).join(" "); }
      else if (k === "rez") { title = "Resurrects parts";
        const heals = (u0.turn || []).some(x => x.kind === "heal_direct");
        why = `Every turn the ${u0.name} takes, it brings every dead ${part} back at full Health${heals ? " and heals the living ones" : ""}. Kill the ${u0.name} first, or damage on the other ${part}s is wasted.`; }
      else if (k === "reflect") { title = "Damages attackers";
        why = `Every time you damage ${names(its)}, the attacker takes damage back (${s0.formula.replace(/this unit's/g, "that part's")}). Attacks and spells that hit several times, or hit several ${part}s, trigger it once per hit.`; }
      else if (k === "timeline") { title = "Timeline push";
        why = `Every turn the ${u0.name} takes, your creature next in line to act is sent to the bottom of the timeline, so it acts after everyone else instead of next. Your fastest creatures get delayed the most.`; }
      else if (k === "debuffs") { title = "Debuffs multiply its damage";
        const deb = e.units.filter(u => (u.turn || []).some(x => x.kind === "debuff")).map(u => ({ u }));
        why = `The ${u0.name}'s damage is multiplied by one plus the number of debuffs on each target.${deb.length ? ` ${cap(names(deb))} add${plural(deb) ? "" : "s"} a random debuff to your creatures every turn, so it climbs fast.` : ""} Removing debuffs keeps it down.`; }
      else if (k === "provoke") { title = "Triple damage unless Provoking";
        why = `${cap(names(its))} hit${plural(its) ? "" : "s"} every creature of yours, three times as hard on any that isn't Provoking.`; }
      else if (k === "grow") { title = "Grows stronger every turn";
        const gains = its.filter(i => i.s.kind === "stat_gain"), dmg = its.find(i => i.s.kind === "damage");
        const st = new Set(gains.flatMap(i => i.s.stat));
        const fx = [(st.has("attack") || st.has("intelligence") || dmg) && "the harder it hits", st.has("defense") && "the tougher it gets", st.has("speed") && "the harder its attacks crit and the more it dodges"].filter(Boolean);
        why = `The gains are a share of current stats, so they compound: the longer the fight, ${fx.length > 1 ? `${fx.slice(0, -1).join(", ")} and ${fx[fx.length - 1]}` : fx[0]}.${dmg ? ` The ${dmg.u.name}'s damage is based on these gains, so it climbs with them.` : ""} ${allImmune ? "You can't kill it to stop this, so the last turns before it leaves hurt the most." : uniq(gains).length > 2 ? "End the fight fast." : `Kill ${names(gains)} early, or end the fight fast.`}`; }
      else if (k === "heavy") { const pct = Math.max(...its.map(i => i.s.power_pct)); title = `${pct}% attacks`;
        const all = its.some(i => i.s.target === "each_player");
        why = all ? `Every turn ${names(its)} takes, it attacks every creature of yours at ${pct / 100}× normal damage. Fragile creatures can drop in one turn: ${allImmune ? "build Defense to outlast it." : `build Defense or kill ${names(its)} first.`}`
          : `Hits ${its.map(i => ({ first_player: "your first creature", last_player: "your last creature", random_player: "a random creature" }[i.s.target] || "one creature")).join(" and ")} at ${pct / 100}× normal damage. Put creatures that can take the hit in those spots.`; }
      if (!title) continue;
      const rank = ["ohko_def", "ohko", "shield", "rez", "cond", "heavy", "provoke", "debuffs", "grow", "reflect", "timeline", "immune"].indexOf(k.split(":")[0]);
      // the same line on two copies of a part reads once, "Arm of Loid ×2"
      const rows = new Map();
      for (const i of its) { const h = bossStepHtml(i.s, part), rk = i.u.name + "|" + i.when + "|" + h;
        if (rows.has(rk)) rows.get(rk).n++; else rows.set(rk, { ...i, h, n: 1 }); }
      out.push({ rank, title, why, extra, effect: `<ul class="boss-steps">${[...rows.values()].map(r => `<li><button class="boss-who" data-action="boss-jump" data-slot="${r.u.slot}">${esc(r.u.name)}${r.n > 1 ? ` ×${r.n}` : ""}</button> <span class="boss-when">${r.when === "turn" ? "on its turn" : "always"}</span>: ${r.h}</li>`).join("")}</ul>` });
    }
    return out.sort((a, b) => (a.rank ?? -1) - (b.rank ?? -1));   // the timer (no rank) leads, then deadliest first
  }
  // Rune advice: which False God runes are low risk / dangerous for THIS boss, from what its code kit actually uses (stats it
  // scales from, whether it can be killed, whether a longer fight helps it). Runes with no clear call either way are left out.
  function bossRuneAdvice(e) {
    const steps = e.units.flatMap(u => [...(u.turn || []), ...u.passives]);
    const has = (k) => steps.some(s => s.kind === k);
    const f = steps.map(s => String(s.formula || "")).join(" ");
    const gains = new Set(steps.filter(s => s.kind === "stat_gain").map(s => s.stat));
    const unscripted = e.units.filter(u => !u.turn);
    const p = {
      unkillable: e.units.every(u => u.passives.some(x => x.kind === "immune_damage" && !x.when)),
      timer: e.mechanics.find(m => m.kind === "timer_exit"),
      highest: /highest stat/.test(f),                       // Loid: damage + reflection use its highest stat
      gainDmg: /stat gains/.test(f),                         // Lost Construct: damage from stat gains
      attack: has("attack") || /Attack/.test(f) || gains.has("attack"),
      int: has("cast") || /Intelligence/.test(f) || gains.has("intelligence") || steps.some(s => s.cond === "burned"),
      heavy: steps.some(s => s.kind === "attack" && s.power_pct >= 300),
      ohkoDef: steps.some(s => s.kind === "ohko" && s.target === "each_player_not_defending"),
      ohko: steps.some(s => s.kind === "ohko" && s.target !== "each_player_not_defending"),
      timeline: has("timeline_to_bottom"), grow: gains.size > 0, growCond: has("intensify_condition"),
      rez: has("resurrect"), revive: has("revive"), blight: steps.some(s => s.kind === "keep_condition" && s.cond === "blight"),
      debuffMult: /debuffs on the target/.test(f), reflect: has("reflect_on_damaged"),
    };
    // a spell that deals damage (its tags or text), vs heals / buffs / control
    const dmgSpell = (id) => { const x = D.spells[id]; return x && (tagKeys(x).some(t => t === "Damage::Inflict" || t === "Spell Kind::Damaging Spells") || /damage/i.test(x.desc || "")); };
    const unitOf = (pred) => (e.units.find(u => [...(u.turn || []), ...u.passives].some(pred)) || {}).name;
    // why a longer fight helps this boss (null = it doesn't, much)
    const longBad = p.revive ? `the ${unitOf(s => s.kind === "revive")} has to go down ${steps.find(s => s.kind === "revive").count + 1} times, so anything that slows your damage stretches an already long fight`
      : p.rez ? `every turn the ${unitOf(s => s.kind === "resurrect")} stays alive it brings dead parts back, so slower kills give it more turns`
      : p.growCond ? `${COND_BY_KEY.get(steps.find(s => s.kind === "intensify_condition").cond).name} keeps growing every turn, so a longer fight hurts more`
      : p.ohko ? `every turn it gets is another instant kill, so a longer fight costs you more creatures`
      : p.grow ? `its stat gains compound every turn, so a longer fight makes it much stronger`
      : null;
    const out = { good: [], bad: [] };
    const say = (key, v, why) => { const r = (D.runes || []).find(x => x.key === key); if (r && why) out[v].push({ r, why }); };
    const survive = p.unkillable ? `${e.name} can't be damaged anyway, so this changes nothing: a free reward bonus.` : null;
    // Avoids Damage (user): one of the hardest runes on any boss you can kill, worst in a sprint kill. Sprint = scaling
    // spread over most parts (no single part to focus); otherwise name the part to focus-kill first.
    if (!survive) {
      const scalers = e.units.filter(u => (u.turn || []).some(s => s.kind === "stat_gain" || s.kind === "intensify_condition"));
      const focus = [["ohko", "it kills one of your creatures every turn"], ["resurrect", "it brings the others back"],
        ["intensify_condition", `it makes ${(COND_BY_KEY.get((steps.find(s => s.kind === "intensify_condition") || {}).cond) || { name: "a debuff" }).name} stronger every turn`], ["stat_gain", "it raises the other parts' stats every turn"]]
        .map(([k, what]) => { const u = e.units.find(x => (x.turn || []).some(s => s.kind === k)); return u && { u, what: k === "ohko" && p.ohkoDef ? "it kills anyone not Defending" : what }; }).find(Boolean);
      const dup = focus && e.units.filter(u => u.name === focus.u.name).length > 1;
      say("AVOIDDAMAGE", "bad", (scalers.length >= 3
        ? `Nearly every part of ${e.name} gets stronger every turn and there's no single part to kill to stop it, so this fight is a race. Losing 35% of your hits is one of the worst runes for a sprint kill.`
        : p.revive ? `One of the hardest runes even in a long fight: 35% of your hits do nothing, and the ${unitOf(s => s.kind === "revive")} has to go down ${steps.find(s => s.kind === "revive").count + 1} times.`
        : focus ? `The ${focus.u.name}${dup ? ` that ${focus.what.replace(/^it /, "")}` : ""} is the part to kill first${dup ? "" : ` (${focus.what})`}. With 35% of your hits prevented, it gets more turns before it goes down.`
        : "One of the hardest runes: 35% of your hits do nothing, so every part takes longer to kill.")
        + (p.reflect ? " One upside: a Prevented hit isn't reflected back at you." : ""));
    }
    // runes that only make it harder to damage. Takes Less Damage / More Health / More Defense (user): build-relative, Avoid
    // only for a sprint kill (scaling on 3+ parts, nothing to focus-kill)
    const sprint = e.units.filter(u => (u.turn || []).some(s => s.kind === "stat_gain" || s.kind === "intensify_condition")).length >= 3;
    const sprintWhy = `Nearly every part of ${e.name} gets stronger every turn and nothing stops it but killing them, so this fight is a race, and this slows every kill.`;
    for (const k of ["AVOIDDAMAGE", "DAMAGECAP", "TAKELESSDAMAGE", "MOREHEALTH", "IMMUNEATTACKS", "IMMUNESPELLS", "IMMUNEINDIRECT"]) {
      if (survive) say(k, "good", survive);
      else if (sprint && ["TAKELESSDAMAGE", "MOREHEALTH"].includes(k)) say(k, "bad", sprintWhy);
    }
    // Damage Cap (rune research Q3-5): the last step of every hit, any damage type: over 10% of max Health becomes 5%. That's
    // about hit size (build-relative), so it's only called out where parts must die more than once (Caliban, Loid).
    const capBase = "Any hit over 10% of a part's max Health is cut to 5%, whatever the damage type, so each part needs at least 10 hits to kill";
    const capTail = "Crits and damage boosts count before the cap, so they can push a hit past 10% and shrink it: hits just under 10% do the most.";
    if (!survive && p.revive) { const rv = steps.find(s => s.kind === "revive");
      say("DAMAGECAP", "bad", `${capBase}. The ${unitOf(s => s.kind === "revive")} comes back ${rv.count} times and refills every other part to full Health each time, so you pay that again for every life. ${capTail}`); }
    else if (!survive && p.rez) say("DAMAGECAP", "bad", `${capBase}, and the ${unitOf(s => s.kind === "resurrect")} brings dead parts back at full Health, so you can pay that more than once. ${capTail}`);
    if (p.highest) for (const k of ["MOREDEFENSE", "MOREATTACK", "MOREINTELLIGENCE", "MORESPEED"])
      say(k, "bad", `Its damage${p.reflect ? " and its damage reflection" : ""} use${p.reflect ? "" : "s"} its highest stat, so tripling any stat can raise it.`);
    else {
      // More Defense (user): build-relative, except a sprint kill or damage that scales with Defense
      if (survive) say("MOREDEFENSE", "good", survive);
      else if (sprint || p.gainDmg) say("MOREDEFENSE", "bad", [sprint && sprintWhy,
        p.gainDmg && `The ${unitOf(s => /stat gains/.test(String(s.formula || "")))}'s damage counts its Defense gains too, and those are a share of current Defense.`].filter(Boolean).join(" "));
      const stat = (key, name, used, how) => {
        if (p.gainDmg) return say(key, "bad", `The ${unitOf(s => /stat gains/.test(String(s.formula || "")))} deals damage from its stat gains; tripling its stats likely means bigger gains every turn (not yet checked in-game).`);
        if (used) return say(key, "bad", how);
        say(key, "good", `Its kit never uses ${name}${unscripted.length ? `, though the ${[...new Set(unscripted.map(u => u.name))].join(" and ")} has no script and may attack or cast normally` : ""}, so this is close to a free reward bonus.`);
      };
      stat("MOREATTACK", "Attack", p.attack, `${p.heavy ? `Its ${Math.max(...steps.filter(s => s.kind === "attack").map(s => s.power_pct))}% attacks` : has("attack") ? "Its attacks" : "Its damage"}${gains.has("attack") ? ", and the Attack it gains every turn," : ""} scale with Attack, so tripling it ${p.unkillable ? "makes every survival turn harder" : "means much bigger hits"}.`);
      // Intelligence matters only through what actually deals damage (user): damage spells, Burned, Int-based formula damage,
      // and heals cast on your Blighted creatures (they hurt). A boss whose spells only control or buff (Mindwurm) doesn't use it.
      const casts = steps.filter(s => s.kind === "cast"), dmgCast = casts.some(s => (s.spells || []).some(dmgSpell));
      const intFormula = unitOf(s => s.kind === "damage" && /Intelligence/.test(String(s.formula || "")));
      const intSrc = [dmgCast && "its damage spells", steps.some(s => s.cond === "burned") && "Burned", intFormula && `the ${intFormula}'s damage`,
        p.blight && casts.some(s => (s.spells || []).some(id => !dmgSpell(id))) && "its healing spells (they hurt your Blighted creatures)",
        (dmgCast || intFormula) && gains.has("intelligence") && "the Intelligence it gains every turn"].filter(Boolean);
      const unscriptedNote = unscripted.length ? `, though the ${[...new Set(unscripted.map(u => u.name))].join(" and ")} has no script and may attack or cast normally` : "";
      if (p.gainDmg) stat("MOREINTELLIGENCE", "Intelligence", true, "");
      else if (intSrc.length) say("MOREINTELLIGENCE", "bad", `${(intSrc.length > 1 ? `${intSrc.slice(0, -1).join(", ")} and ${intSrc[intSrc.length - 1]}` : intSrc[0]).replace(/^./, x => x.toUpperCase())} scale${intSrc.length > 1 || dmgCast ? "" : "s"} with Intelligence, so tripling it ${p.unkillable ? "makes every survival turn harder" : "hits much harder"}.`);
      else say("MOREINTELLIGENCE", "good", casts.length ? `None of its spells deal damage${/Orbs/.test(unitOf(s => s.kind === "cast") || "") ? ` (the ${unitOf(s => s.kind === "cast")} turn your own creatures' attacks and spells against you)` : ""}, so its Intelligence does nothing${unscriptedNote}: close to a free reward bonus.`
        : `Its kit never uses Intelligence${unscriptedNote}, so this is close to a free reward bonus.`);
    }
    // more damage from every hit
    const atk = steps.filter(s => s.kind === "attack"), topAtk = atk.length ? Math.max(...atk.map(s => s.power_pct)) : 0;
    const fedGains = [gains.has("attack") && (atk.length || /Attack/.test(f)) && "Attack", gains.has("intelligence") && (steps.some(s => s.kind === "cast" && (s.spells || []).some(dmgSpell)) || /Intelligence/.test(f)) && "Intelligence"].filter(Boolean);
    const dmgWhy = p.unkillable ? `Its damage is the only way you can lose this fight; this makes every turn of the ${p.timer ? p.timer.turns + "-turn " : ""}wait more dangerous.`
      : p.heavy ? `Its ${Math.max(...steps.filter(s => s.kind === "attack").map(s => s.power_pct))}% attacks can already take out a creature in one turn; this makes that far more likely.`
      : p.debuffMult ? `Its damage already multiplies with your debuffs; this stacks on top.${p.reflect ? " The damage Boils reflects back at you gets the +150% too." : ""}`
      : p.gainDmg ? `The ${unitOf(s => /stat gains/.test(String(s.formula || "")))}'s damage grows with its stat gains every turn, and this adds +150% on top of it.`
      : fedGains.length ? `Its damage grows every turn as it stacks ${fedGains.join(" and ")}, and this adds +150% on top of all of it.` : null;
    // Deals More Damage (user): low risk where only a couple of parts deal damage at all, all of it from spells (Impington).
    // Only damage a part is the source of counts (research Q8): Burned / Poison / Bleed ticks and Blight damage don't.
    const dealers = e.units.filter(u => [...(u.turn || []), ...u.passives].some(s => ["attack", "damage", "reflect_on_damaged"].includes(s.kind)
      || (s.kind === "cast" && (s.spells || []).some(dmgSpell))));
    const spellOnly = dealers.every(u => [...(u.turn || []), ...u.passives].every(s => !["attack", "damage", "reflect_on_damaged", "keep_condition"].includes(s.kind)));
    const dealerNames = [...new Set(dealers.map(u => u.name))];
    if (!dmgWhy && dealerNames.length && dealerNames.length <= 2 && spellOnly && (p.ohko || p.timeline))
      say("DOMOREDAMAGE", "good", `Only ${dealers.length} of its ${e.units.length} parts deal damage (${dealerNames.map(n => { const c = dealers.filter(u => u.name === n).length, sh = n.split(" of ")[0]; return c > 1 ? `${c === 2 ? "both" : "all " + c} ${sh}s` : `the ${sh}`; }).join(" and ")}), all of it from spells. Its real threats are ${[p.ohko && `the ${unitOf(s => s.kind === "ohko")}'s instant kill`, p.timeline && "the timeline push"].filter(Boolean).join(" and ")}, which this doesn't change.`);
    else say("DOMOREDAMAGE", "bad", dmgWhy);
    // Always Crit (user + code): only attacks crit (spells / indirect only via a trait). Crit damage adds
    // 0.25 + max(0, 1 + ln(attacker Speed / target Speed)) (EFFECT_FORMULAS S12), so it bites hardest on big attacks
    // and on a boss whose Speed climbs during the fight.
    const atkGrows = atk.length && gains.has("attack");
    const spdUnit = unitOf(s => s.kind === "stat_gain" && s.stat === "speed");
    if (topAtk >= 200 || atkGrows || (atk.length && spdUnit)) say("ALWAYSCRIT", "bad", [
      topAtk >= 200 ? `Its ${topAtk}% attacks are its biggest hits, and every one becomes a crit.` : atkGrows ? "Its attacks get stronger every turn as it gains Attack, and every one becomes a crit." : "Every one of its attacks becomes a crit.",
      spdUnit ? `The ${spdUnit} raises its Speed every turn, and crit damage grows with the attacker's Speed over the target's, so its crits keep getting stronger.`
        : "A crit adds more damage the faster the attacker is than the target (about +125% at equal Speed)."].join(" "));
    // Speed / Top of Timeline (TIMELINE_FINDINGS): every creature gets one turn per round; Speed only sets the starting
    // order (Speed changes mid-battle don't reorder it). Speed also raises crit chance + crit damage on attacks and dodge
    // chance when faster than the other side (EFFECT_FORMULAS S12).
    const ohkoUnit = unitOf(s => s.kind === "ohko");
    if (p.ohkoDef) say("TOPOFTIMELINE", "bad", `Its parts start at the top of the timeline, so the ${ohkoUnit} acts before any of your creatures has had a turn to Defend: on the first round it kills your whole party unless something else protects them.`);
    else if (p.ohko) say("TOPOFTIMELINE", "bad", `Its parts start at the top of the timeline and keep that place, so the ${ohkoUnit}'s instant kill lands before your creatures act.`);
    else if (topAtk >= 300) say("TOPOFTIMELINE", "bad", `Its ${topAtk}% attacks land before any of your creatures has acted, so you can't Defend, heal or buff first.`);
    if (!p.highest) {
      const why = [atk.length && "Its attacks crit more often and harder: crit chance and crit damage both grow with its Speed over the target's.",
        p.ohkoDef && `${atk.length ? "It also likely moves" : "Tripled Speed likely moves"} the ${ohkoUnit} ahead of your creatures in the turn order, so it can act before they Defend.`,
        !p.unkillable && longBad && `A faster creature ${atk.length || p.ohkoDef ? "also " : ""}dodges more of your attacks, which slows your kill, and ${longBad}.`].filter(Boolean);
      if (why.length) say("MORESPEED", "bad", why.join(" "));
    }
    // Keeps Its Stats (user): Avoid where the boss stacks stats that feed its damage; lowering those stats is how you fight
    // the stacking, and this rune cuts every stat loss by 80% (code: stat loss x0.2). Mass Buffs: no False God interaction.
    if (p.gainDmg) say("LOSELESSSTATS", "bad", `The ${unitOf(s => /stat gains/.test(String(s.formula || "")))}'s damage comes from how far its stats have grown. Lowering its stats is how you shrink that, and this rune cuts every stat loss you cause by 80%.`);
    else if (fedGains.length) say("LOSELESSSTATS", "bad", `It stacks ${fedGains.join(" and ")} every turn and its damage scales with ${fedGains.length > 1 ? "them" : "it"}. Lowering its stats is how you keep that in check, and this rune cuts every stat loss you cause by 80%.`);
    // your side
    if (p.debuffMult) say("DEBUFFS", "bad", `The ${unitOf(s => /debuffs on the target/.test(String(s.formula || "")))}'s damage is multiplied by one plus the debuffs on each target; starting with 7 debuffs means ×8 damage from its first turn.`);
    else if (p.blight) say("DEBUFFS", "bad", "Seven random debuffs can be crippling on their own, and with Blight on your whole party all fight, any damage they deal can't be healed back.");   // user: never recommended anywhere
    const castOf = (re) => { for (const u of e.units) for (const s of u.turn || []) for (const id of (s.kind === "cast" && s.spells) || []) if (re.test((D.spells[id] || {}).desc || "")) return { u: u.name, sp: D.spells[id].name }; return null; };
    const vul = castOf(/DEBUFF_VUL/), burnKeep = steps.find(s => s.kind === "keep_condition" && s.cond === "burned");
    const dotWhy = [p.blight && "Your creatures have Blight for the whole fight, so they can't heal this damage back; healing even hurts them.",
      burnKeep && `It hits at the start of each of your creatures' turns, right before their Burned tick, and the ${unitOf(s => s === burnKeep)} keeps Burned on your creatures and makes it stronger every turn. A creature needs more than 75% of its max Health plus one Burned tick to live through the start of its turn.`,
      !burnKeep && p.unkillable && "Your creatures lose 75% of their max Health at the start of each of their turns, for a fight you can only win by surviving.",
      vul && `The ${vul.u} can cast ${vul.sp}, which makes your creatures Vulnerable: a Vulnerable creature takes 112.5% of its max Health from this, so it dies at the start of its turn even from full Health.`].filter(Boolean);
    if (dotWhy.length) say("DAMAGEOVERTIME", "bad", dotWhy.join(" ") + " Defending cuts it to about 49%; Defense doesn't reduce it.");
    return out;
  }
  function renderBossDetail() {
    const st = dovState, e = BOSS_BY_KEY.get(st.key); if (!e) return "";
    if (e.type === "nether_boss") return renderNetherDetail(e);
    if (e.type === "gate_god") return renderGateDetail(e);
    const part = e.type === "false_god" ? "part" : "boss creature";
    const typeLabel = (((D.bosses && D.bosses.types) || []).find(t => t.type === e.type) || {}).label || "";
    const sec = (k, title, html) => `<button class="apx-sec-head apx-cat${st.open.has(k) ? "" : " collapsed"}" data-action="boss-sec" data-k="${k}"><span class="apx-sec-caret">${st.open.has(k) ? "▾" : "▸"}</span>${title}</button>${st.open.has(k) ? html : ""}`;
    const formation = bossFormation(e, true);
    const threats = bossThreats(e, part);
    const sameStats = e.units.every(u => STAT_KEYS.every(k => u.stats[k] === e.units[0].stats[k]));
    const statLine = bossStatTable;
    const lines = (arr) => `<ul class="boss-steps">${bossMerge(arr).map(s => s.kind === "note" ? `<li class="fx-clarify">${esc(s.text)}</li>` : `<li>${bossStepHtml(s, part)}</li>`).join("")}</ul>`;
    const units = bossUnitsOrdered(e).map(u => {
      const tr = u.traitId != null ? TRAIT[u.traitId] : null;
      return `<div class="boss-unit" id="boss-unit-${u.slot}">
        <div class="boss-unit-head"><span class="boss-unit-spr">${u.img ? spriteImg(u.img, "px") : ""}</span>
          <div class="boss-unit-name"><b>${esc(u.name)}</b></div></div>
        ${tr ? `<div class="primary-traits">${traitBanner(u.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div>${traitSpellRow(u.traitId, true)}</div>` : ""}
        ${sameStats ? "" : statLine(u.stats)}
        <div class="boss-sub">On its turn</div>
        ${u.turn ? lines(u.turn) : `<div class="slot-sub">Normal enemy AI: attacks or casts a spell</div>`}
        ${u.turnNote ? `<div class="fx-clarify">${esc(u.turnNote)}</div>` : ""}
        ${u.passives.length ? `<div class="boss-sub">Always</div>${lines(u.passives)}` : ""}
      </div>`;
    }).join("");
    const specs = e.specIds.map(id => D.specs.find(s => s.id === id)).filter(Boolean);
    const ra = e.type === "false_god" ? bossRuneAdvice(e) : { good: [], bad: [] };
    const runeRow = (r) => `<div class="boss-rune">${r.icon ? `<span class="prop-ico">${spriteImg(r.icon, "px")}</span>` : ""}
      <div><b>${richText(r.name)}</b>${r.rewardPct != null ? ` <span class="anoint-spec-tag">+${r.rewardPct}% Rewards</span>` : ""}
        ${r.effect && r.effect !== r.name ? `<div class="trait-desc">${richText(r.effect)}</div>` : ""}${r.clarify ? `<div class="fx-clarify">${esc(r.clarify)}</div>` : ""}</div></div>`;
    // runes that share a reason sit in one container under that reason
    const runeGroups = (list, cls) => { const g = new Map(); for (const x of list) { if (!g.has(x.why)) g.set(x.why, []); g.get(x.why).push(x.r); }
      return [...g].map(([why, rs]) => `<div class="boss-rune-group ${cls}">${rs.map(runeRow).join("")}<p class="boss-why">${esc(why)}</p></div>`).join(""); };
    const runes = ra.good.length || ra.bad.length ? `<div class="section-label">Runes</div>
      ${ra.good.length ? `<div class="boss-sub boss-sub-good">Recommended</div>${runeGroups(ra.good, "good")}` : ""}
      ${ra.bad.length ? `<div class="boss-sub boss-sub-bad">Avoid</div>${runeGroups(ra.bad, "bad")}` : ""}` : "";
    const insc = (e.inscriptions || []).filter(x => D.spells[x.spell]);
    const rewards = specs.length || insc.length ? `<div class="section-label">Rewards</div>
      ${specs.length ? `<div class="boss-sub">Anointment: a perk from one of</div><div class="boss-chips">${specs.map(s => `<span class="boss-chip">${SPEC_EMBLEM.get(s.label) ? `<span class="prop-ico sm">${spriteImg(SPEC_EMBLEM.get(s.label), "px")}</span>` : ""}${esc(s.label)}</span>`).join("")}</div>` : ""}
      ${insc.length ? `<div class="boss-sub">Inscription: a spell you don't know yet from</div><div class="art-spellcards boss-spells">${insc.map(x => spellGemCard(D.spells[x.spell]) + (x.exceptions || []).map(t => `<div class="fx-clarify">${esc(t)}</div>`).join("")).join("")}</div>` : ""}` : "";
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${bossImg(e) ? `<span class="hdr-ico">${spriteImg(bossImg(e))}</span>` : ""}
        <h2>${esc(e.name)}</h2>${typeLabel ? `<span class="anoint-spec-tag apx-boss-cat">${esc(typeLabel.replace(/s$/, ""))}</span>` : ""}
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll boss-page">
        ${formation}
        ${threats.length ? `<div class="section-label">Threats</div>${threats.map(t => `<div class="boss-threat"><div class="boss-threat-head">${esc(t.title)}</div>
          <div class="boss-threat-body">${t.effect}${t.extra}<p class="boss-why">${esc(t.why)}</p></div></div>`).join("")}` : ""}
        ${sameStats && e.units.length ? `<div class="section-label">Base stats</div>${statLine(e.units[0].stats)}` : ""}
        <div class="section-label">${e.type === "false_god" ? "Body parts" : "Creatures"}</div>
        ${units}
        ${runes}
        ${rewards}
        ${e.lore || e.dialog ? sec("lore", "Lore", `${e.lore ? `<div class="trait-desc boss-lore">${richText(e.lore)}</div>` : ""}${e.dialog ? `<div class="trait-desc boss-lore boss-dialog">${richText(e.dialog)}</div>` : ""}`) : ""}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }
  // Nether Boss page (bosses.json nether_boss): an ordinary creature in a boss skin; its boss trait has 3 tiers by times beaten
  // (1st fight / 2nd / 3rd+). Threats are app-authored from the code behaviour (data/reference/nether_boss_advice.json).
  function renderNetherDetail(e) {
    const st = dovState, tier = st.tier || 1, adv = e.advice || { threats: [[], [], []], notes: [[], [], []] };
    const sec = (k, title, html) => `<button class="apx-sec-head apx-cat${st.open.has(k) ? "" : " collapsed"}" data-action="boss-sec" data-k="${k}"><span class="apx-sec-caret">${st.open.has(k) ? "▾" : "▸"}</span>${title}</button>${st.open.has(k) ? html : ""}`;
    const tierToggle = `<div class="art-view-toggle nb-tiers">${["1st fight", "2nd fight", "3rd+"].map((l, i) => `${i ? `<span class="av-pipe">|</span>` : ""}<button class="av-tab ${tier === i + 1 ? "on" : ""}" data-action="nb-tier" data-v="${i + 1}">${l}</button>`).join("")}</div>`;
    // tier 3 Flubris / Kraynaks: six copies of the boss creature
    const lead = nbLead(e), six = tier === 3 && e.party3;
    const units = six ? e.party3.map((n, i) => ({ ...lead, slot: i + 1, name: n })) : e.units;
    const sameStats = units.every(u => STAT_KEYS.every(k => u.stats[k] === units[0].stats[k]));
    // identical creatures read once, "Sadomasochist ×6"
    const groups = []; for (const u of units) { const g = groups.find(x => x.u.creature === u.creature && x.u.name === u.name && JSON.stringify(x.u.stats) === JSON.stringify(u.stats)); g ? g.n++ : groups.push({ u, n: 1 }); }
    const threats = adv.threats[tier - 1] || [];
    // the game names an un-nicknamed boss creature after the boss (Eft Howler → Kiichi, six Sadomasochists → Phobos ×6); duos,
    // the Aspects, the Shadows and the six-copy 3rd fights already carry their own names
    const soloBoss = !six && new Set(e.units.filter(x => x.tiers).map(x => x.name)).size === 1;
    const cards = groups.map(({ u, n }) => {
      const bt = u.tiers ? u.tiers[tier - 1] : null;
      return `<div class="boss-unit" id="boss-unit-${u.slot}">
        <div class="boss-unit-head"><span class="boss-unit-spr">${nbUnitImg(u) ? spriteImg(nbUnitImg(u), "px") : ""}</span>
          <div class="boss-unit-name"><b>${esc(soloBoss && u.tiers ? e.name : u.name)}${n > 1 ? ` ×${n}` : ""}</b></div></div>
        ${bt != null && TRAIT[bt] ? `<div class="boss-sub">Boss trait</div><div class="primary-traits">${traitBanner(bt)}<div class="trait-desc">${richText(TRAIT[bt].desc || "")}</div>${traitSpellRow(bt, true)}</div>${(adv.noteUnit ? u.name === adv.noteUnit : u.tiers === lead.tiers && u.slot === groups[0].u.slot) ? (adv.notes[tier - 1] || []).map(t => `<div class="fx-clarify">${esc(t)}</div>`).join("") : ""}` : ""}
        ${sameStats ? "" : bossStatTable(u.stats)}
      </div>`;
    }).join("");
    const mats = (e.materials || []).map(m => { const ti = TRAITITEM.get(m.item), tr = TRAIT[m.traitId];
      return ti ? `<div class="boss-mat"><div class="boss-mat-head">${ti.icon ? `<span class="prop-ico">${spriteImg(ti.icon, "px")}</span>` : ""}<b>${esc(ti.name)}</b></div>${tr ? `<div class="primary-traits">${traitBanner(m.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div>${traitSpellRow(m.traitId, true)}</div>` : ""}</div>` : ""; }).join("");
    const isID = e.key === "NB_SHADOWS";
    const rewards = `<div class="section-label">Rewards</div>
      ${mats ? `<div class="boss-sub">Trait materials</div>${mats}` : ""}
      <div class="boss-sub">Every win</div>
      <ul class="boss-steps"><li>Right after the fight: 20 treasure bundles and Gate of the Gods Key Fragments: 4–7, plus (1 + realm Instability) × (1 + Inner Darkness clears, up to 3).</li>
        <li>Your first Nether Boss win ever gives the Nether Shop decoration instead.</li>
        <li>The boss room's 2 chests hold 9 treasure bundles each: 3, +3 for a boss room, +3 Nether bonus (+5 more each in some realms at a Favor rank).</li>
        <li>The realm quest reward (5 treasure bundles, Fortune +1, Favor) is paid when you enter the next room after the boss room.</li>
        <li>Royal Mode: a False Nether Orb of a random False God (an Anointment and an Inscription, as after a False God fight).</li>
        ${isID ? "<li>Your 1st, 2nd and 3rd Inner Darkness wins unlock the Gate of the Gods project, the Guild projects and the mysterious realm portals.</li>" : ""}</ul>`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${bossImgs(e).length ? `<span class="hdr-ico${bossImgs(e).length > 1 ? " duo" : ""}">${bossSprs(e, "px")}</span>` : ""}
        <h2>${esc(e.name)}</h2><span class="anoint-spec-tag apx-boss-cat">Nether Boss</span>
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll boss-page">
        ${bossImgs(e).length ? `<div class="gg-portrait${bossImgs(e).length > 1 ? " duo" : ""}">${bossSprs(e, "px")}</div>` : ""}
        ${tierToggle}
        ${threats.length ? `<div class="section-label">Threats</div>${threats.map(t => `<div class="boss-threat"><div class="boss-threat-head">${esc(t.title)}</div>
          <div class="boss-threat-body"><div class="trait-desc">${esc(t.what)}</div><p class="boss-why">${esc(t.why)}</p></div></div>`).join("")}` : ""}
        ${sameStats ? `<div class="section-label">Base stats</div>${bossStatTable(units[0].stats)}` : ""}
        <div class="section-label">Creatures</div>
        ${cards}
        ${rewards}
        ${e.dialog ? sec("lore", "Lore", `<div class="trait-desc boss-lore boss-dialog">${richText(e.dialog)}</div>`) : ""}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }
  // Gate of the Gods page (bosses.json gate_god + gate_rules): the god's Avatar with the god trait in place of its own, 5 random
  // realm creatures, difficulty-scaled levels. Threats app-authored from the code behaviour (data/reference/gate_god_advice.json).
  const GG_MULT = [1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15];   // scr_GodBattleLevel; 10+ = 15 + 5 per level above 10
  function renderGateDetail(e) {
    const st = dovState, u = e.units[0], c = CREA.get(u.creature), adv = e.advice || { threats: [], notes: [] };
    const sec = (k, title, html) => `<button class="apx-sec-head apx-cat${st.open.has(k) ? "" : " collapsed"}" data-action="boss-sec" data-k="${k}"><span class="apx-sec-caret">${st.open.has(k) ? "▾" : "▸"}</span>${title}</button>${st.open.has(k) ? html : ""}`;
    const gt = TRAIT[u.godTraitId];
    const card = `<div class="boss-unit" id="boss-unit-1">
        <div class="boss-unit-head"><span class="boss-unit-spr">${c && c.sprite ? spriteImg(c.sprite, "px") : ""}</span>
          <div class="boss-unit-name"><b>${esc(u.name)}</b> <span class="anoint-spec-tag">Avatar</span></div></div>
        ${gt ? `<div class="boss-sub">God trait</div><div class="primary-traits">${traitBanner(u.godTraitId)}<div class="trait-desc">${richText(gt.desc || "")}</div>${traitSpellRow(u.godTraitId, true)}</div>${(adv.notes || []).map(t => `<div class="fx-clarify">${esc(t)}</div>`).join("")}` : ""}
      </div>`;
    const diffRows = GG_MULT.map((m, i) => { const d = i + 1; return `<tr><td>${d}</td><td>${m}</td><td>${d}</td><td>${d * 10}</td><td>${3 * d}%</td></tr>`; }).join("")
      + `<tr class="boss-diff-more"><td>11+</td><td>+×5 each</td><td>10</td><td>100</td><td>+3% each</td></tr>`;
    const diff = `<div class="section-label">Difficulty</div>
      <div class="boss-diff-wrap"><table class="boss-diff"><thead><tr><th>Difficulty</th><th>Level ×</th><th>Emblems</th><th>Mana</th><th>Costume</th></tr></thead><tbody>${diffRows}</tbody></table></div>
      <div class="slot-sub boss-diff-note">You can pick up to difficulty 10, or one above your best win against ${esc(e.name)}.</div>`;
    const costume = e.costume ? (D.wardrobe || []).find(w => w.key === e.costume) : null;
    const rewards = `<div class="section-label">Rewards</div>
      <ul class="boss-steps"><li>${esc(e.name)}'s Emblem × the difficulty (up to 10) and its Avatar Mana × 10 × the difficulty (up to 100). No resources.</li>
        <li>Its costume, if you don't have it: 3% × the difficulty (keeps rising past 10).</li>
        <li>Each of its three skins, if you don't have it: 5%. Its decoration, if not unlocked: 10%.</li>
        <li>${e.ascension ? `Ascension: beat all 30 gods except Caliban at difficulty 10 or higher with the same specialization for a perk point and that specialization's decoration.` : "Not part of Ascension."}</li></ul>
      ${costume ? `<div class="boss-chips boss-rewards-art"><span class="boss-chip">${costume.img ? `<span class="prop-ico sm">${spriteImg(costume.img, "px")}</span>` : ""}${esc(costume.name)} costume</span></div>` : ""}`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${bossImg(e) ? `<span class="hdr-ico">${spriteImg(bossImg(e), "px")}</span>` : ""}
        <h2>${esc(e.name)}</h2><span class="anoint-spec-tag apx-boss-cat">God</span>
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll boss-page">
        ${bossImg(e) ? `<div class="gg-portrait">${spriteImg(bossImg(e), "px")}</div>` : ""}
        ${adv.threats.length ? `<div class="section-label">Threats</div>${adv.threats.map(t => `<div class="boss-threat"><div class="boss-threat-head">${esc(t.title)}</div>
          <div class="boss-threat-body"><div class="trait-desc">${esc(t.what)}</div><p class="boss-why">${esc(t.why)}</p></div></div>`).join("")}` : ""}
        <div class="section-label">Base stats</div>${bossStatTable(u.stats)}
        <div class="section-label">Creatures</div>
        ${card}
        ${diff}
        ${rewards}
        ${e.dialog ? sec("lore", "Lore", `<div class="trait-desc boss-lore boss-dialog">${richText(e.dialog)}</div>`) : ""}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }
  // wizard step-2 preview: the actual built creature (fusion + personality + scrolls) via the real stat calc
  function renderWizardPreview(st) {
    const primary = CREA.get(st.primaryId); if (!primary) return "";
    const secondary = st.fusionId != null ? CREA.get(st.fusionId) : null;
    const tempSlot = { cid: st.primaryId, fusion: st.fusionId, personality: st.personality, scrolls: st.scrolls || {},
                       artifactId: null, relic: null, spellGemIds: [] };
    const fs = finalStats(tempSlot), b = fs.base;
    // baseline = the primary WITHOUT fusion (same scrolls/personality) so each bar's coloured segment
    // shows exactly what fusing this partner does to the stat: green = raised, red = lowered.
    const soloSlot = { cid: st.primaryId, fusion: null, personality: st.personality, scrolls: st.scrolls || {},
                       artifactId: null, relic: null, spellGemIds: [] };
    const fs0 = finalStats(soloSlot);
    const pers = st.personality ? PERS.get(st.personality) : null;
    const mark = (k) => { if (!pers) return ""; if (pers.raise === k) return ` <span class="growth up" title="Personality +33%">↑</span>`;
      if (pers.lower === k) return ` <span class="growth down" title="Personality −33%">↓</span>`; return ""; };
    // magnitude bar (value / roster-max) with a diverging fusion delta segment vs the primary alone
    const magRow = (k, label, curr, base0, rowCls) => {
      const M = STAT_MAX[k] || 1, rawPc = (v) => (v || 0) / M * 100, pc = (v) => Math.max(0, Math.min(100, rawPc(v)));
      const cW = pc(curr), bW = pc(base0), solid = Math.min(cW, bW), seg = Math.abs(cW - bW);
      const d = curr - base0, dcls = d >= 0 ? "up" : "down";
      // personality/scrolls can push a stat past the roster max (the usual end of the bar). Rather than
      // clamp+lose that info, the bar fills solid then WRAPS: the excess restarts from the low end in blue.
      const over = rawPc(curr) - 100, overW = Math.max(0, Math.min(100, over));
      const title = over > 0
        ? `${Math.round(rawPc(curr))}% of the roster max — ${curr} exceeds the usual cap of ${M} by ${curr - M}`
        : (secondary && d !== 0 ? `Fusion ${d > 0 ? "+" : ""}${d} vs ${esc(primary.name)} alone` : `${Math.round(cW)}% of the roster max`);
      const fill = over > 0
        ? `<i style="width:100%"></i><b class="wrap" style="width:${overW}%"></b>`
        : `<i style="width:${solid}%"></i>${seg > 0.5 ? `<b class="delta ${dcls}" style="left:${solid}%;width:${seg}%"></b>` : ""}`;
      return `<div class="stat-row${rowCls || ""}"><span class="stat-name">${label}${mark(k)}</span>
        <span class="stat-mag${over > 0 ? " over" : ""}" title="${title}">${fill}</span>
        <span class="stat-val total">${curr}${secondary && d !== 0 ? ` <span class="stat-delta ${dcls}">${d > 0 ? "+" : ""}${d}</span>` : ""}</span></div>`;
    };
    const traitIds = [primary.traitId, secondary ? secondary.traitId : null].filter(x => x != null);
    return `<button class="cd-info-btn" data-action="crea-info" data-cid="${primary.id}" title="Open full details for ${esc(primary.name)}" aria-label="Open full creature details">i</button>
      <div class="cd-sprite">${fusedFace(primary, st.skinId, secondary, st.step === "color" || st.fuseColor != null ? st.fuseColor : null)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(primary.name)}${secondary ? ` <span style="color:var(--accent2)">⚭</span> ${esc(secondary.name)}` : ""}</h3>
      <div class="slot-sub" style="margin-bottom:10px"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span></div>
      ${traitIds.length ? `<div class="section-label">Traits</div><div style="margin-bottom:10px">${traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div>${traitSpellRow(tid, true)}</div>`).join("")}</div>` : ""}
      <div class="section-label">Stats</div>
      <div class="stat-grid single mag">
        ${STAT_KEYS.map(k => magRow(k, STAT_LABEL[k], fs.final[k], fs0.final[k])).join("")}
        ${magRow("total", "Total", fs.total, fs0.total, " hl-med")}</div>`;
  }

  // per-creature customization in the wizard: Personality (base-stat ↑/↓) + Scrolls (+1 base each, cap 15 total)
  const scrollTotal = (sc) => STAT_KEYS.reduce((n, k) => n + (sc[k] || 0), 0);
  function renderCreatureCustomize(st, standalone) {
    const p = st.personality ? PERS.get(st.personality) : null;
    const sc = st.scrolls || {}, tot = scrollTotal(sc);
    const persBtn = p
      ? `<button class="facet on tag" data-action="crea-pers-clear">${esc(p.name)}: <b>↑${STAT_LABEL[p.raise]} ↓${STAT_LABEL[p.lower]}</b> <span class="facet-x">✕</span></button>`
      : `<button class="facet add" data-action="crea-pers">＋ Personality</button>`;
    // Skin — only the skins whose restriction allows this creature (race- or creature-locked)
    const skinList = skinsForCreature(CREA.get(st.primaryId));
    const curSkin = st.skinId != null ? SKIN_BY_ID.get(st.skinId) : null;
    const skinBar = skinList.length ? `
      <div class="section-label" style="margin-top:10px">Skin</div>
      <div class="cc-persbar">${curSkin
        ? `<button class="facet on tag" data-action="crea-skin">${esc(curSkin.name)}</button><button class="facet tag" data-action="crea-skin-clear">✕</button>`
        : `<button class="facet add" data-action="crea-skin">＋ Skin</button>`}</div>` : "";
    const rows = STAT_KEYS.map(k => `<div class="scroll-row">
        <span class="scroll-lbl">${STAT_LABEL[k]}</span>
        <button class="perk-step" data-action="crea-scroll-dec" data-k="${k}" ${(sc[k] || 0) <= 0 ? "disabled" : ""}>−</button>
        <span class="scroll-val">+${sc[k] || 0}</span>
        <button class="perk-step" data-action="crea-scroll-inc" data-k="${k}" ${tot >= SCROLL_MAX ? "disabled" : ""}>+</button></div>`).join("");
    return `<div class="crea-customize${standalone ? " standalone" : ""}">
      <div class="section-label">Personality</div>
      <div class="cc-persbar">${persBtn}</div>
      <div class="section-label" style="margin-top:10px">Scrolls · ${tot}/${SCROLL_MAX}</div>
      <div class="scroll-grid">${rows}</div>
      ${skinBar}</div>`;
  }
  // skin picker (detail layer) — lists only restriction-allowed skins for the creature + a Default tile
  function openSkinPicker(creature, onPick) {
    dovState = { kind: "skin", cid: creature ? creature.id : null, search: "", onPick, render: renderSkinPicker };
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderSkinPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    const c = CREA.get(st.cid);
    let list = skinsForCreature(c);
    if (q) list = list.filter(s => (s.name || "").toLowerCase().includes(q));
    list = list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const def = `<div class="pick-tile" data-action="skin-pick" data-id="">
      <div class="pt-sprite">${c ? critFace(c) : ""}</div><div class="pt-name">Default</div></div>`;
    const tiles = list.map(s => `
      <div class="pick-tile" data-action="skin-pick" data-id="${s.id}">
        <div class="pt-sprite">${spriteImg(s.img, "px")}</div><div class="pt-name">${esc(s.name)}</div></div>`).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Choose Skin${c ? " — " + esc(c.name) : ""}</h2>
        <input class="ovl-search" placeholder="Search skins…" value="${esc(st.search)}" data-action="skin-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll"><div class="pick-grid">${def}${tiles}</div></div></div></div>
    </div></div>`;
  }
  function openPersonalityPicker() {
    dovState = { kind: "pers", search: "", render: renderPersonalityPicker };
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderPersonalityPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    const groups = {}; for (const p of D.personalities) (groups[p.raise] ||= []).push(p);
    const body = STAT_KEYS.filter(rk => groups[rk]).map(rk => {
      const opts = groups[rk].filter(p => !q || p.name.toLowerCase().includes(q));
      if (!opts.length) return "";
      return `<div class="section-label">↑ ${STAT_LABEL[rk]} growth</div>
        ${opts.map(p => `<button class="opt-row" data-action="crea-pers-pick" data-k="${p.key}">
          <span>${esc(p.name)}</span><span class="opt-sub">↑ ${STAT_LABEL[p.raise]} · ↓ ${STAT_LABEL[p.lower]}</span></button>`).join("")}`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail facet-panel">
      <div class="overlay-header"><h2>Choose Personality</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="pers-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll"><div class="opt-list">${body}</div></div></div></div>
    </div></div>`;
  }

  // ── facet sub-picker (Class / Race / Tag) on the detail layer ───────────────
  // opts.idxFn = taxonomy index to browse (TagFilter.index); opts.onPick = callback for the picked value;
  // opts.parent = the detail-layer page that opened it (e.g. the perk picker): closing or picking returns there
  function openFacetPicker(kind, opts = {}) {
    const parent = opts.parent || null;
    if (parent) { const panel = DOV.querySelector(".overlay-panel");
      parent._scroll = SCROLLERS.map(sel => { const e = panel && panel.querySelector(sel); return e ? e.scrollTop : 0; }); }
    dovState = { kind: "facet", facet: kind, search: "", render: renderFacetPicker, parent,
                 idxFn: opts.idxFn || null, onPick: opts.onPick || null };   // idxFn: recomputed so display toggles apply live
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderFacetPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    const idx = st.idxFn ? st.idxFn() : new Map();
    let opts, title, back = "";
    if (st.facet === "class") { title = "Filter by Class"; opts = D.classes.map(c => ({ v: c.key, label: c.key, icon: D.classIcons && D.classIcons[c.key], color: D.classIcons && D.classIcons[c.key] ? null : c.color })); }
    else if (st.facet === "anoint-spec") { title = "Filter by Specialization"; opts = anointSpecs().map(s => ({ v: s, label: s, icon: SPEC_EMBLEM.get(s) })); }
    else if (st.facet === "anoint-fgod") { title = "Filter by False God"; opts = (D.falseGods || []).map(g => ({ v: g.key, label: g.name, icon: g.icon })); }
    else if (st.facet === "race") { title = "Filter by Race"; opts = raceOptions().map(r => ({ v: r, label: r, icon: D.raceIcons && D.raceIcons[r] })); }
    else if (st.facet === "taxo-cat") { title = "Filter by mechanic"; opts = [...idx.keys()].map(cat => ({ v: cat, label: cat })); }
    else { // taxo-val
      title = st.taxoCat;
      back = `<button class="facet" data-action="taxo-back">‹ Categories</button>`;
      opts = (idx.get(st.taxoCat) || []).map(r => ({ v: r.key, label: r.val }));
    }
    if (q) opts = opts.filter(o => o.label.toLowerCase().includes(q));
    const rows = opts.slice(0, 400).map(o =>
      `<button class="opt-row" data-action="facet-pick" data-v="${esc(o.v)}">${o.icon ? `<span class="opt-ico">${spriteImg(o.icon, "px")}</span>` : ""}${o.color ? `<span class="opt-dot" style="background:${o.color}"></span>` : ""}${esc(o.label)}${st.facet === "taxo-cat" ? ` <span class="opt-chev">›</span>` : ""}</button>`).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail facet-panel">
      <div class="overlay-header"><h2>${esc(title)}</h2>
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="facet-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        ${(back || st.facet === "taxo-cat") ? `<div class="ovl-filterbar">${back}${(st.facet === "taxo-cat" || st.facet === "taxo-val") ? singlesToggle() : ""}</div>` : ""}
        <div class="ovl-center-scroll"><div class="opt-list">${rows}</div>
        ${opts.length > 400 ? `<div class="slot-sub" style="margin-top:8px">Showing 400 of ${opts.length}.</div>` : ""}</div></div></div>
    </div></div>`;
  }

  // False God lookups — shared by the Anointments overlay (anointments are spec
  // perks; each affiliated spec belongs to one of the 10 False Gods).
  const FALSE_GODS = D.falseGods || [];
  const godByKey = new Map(FALSE_GODS.map(g => [g.key, g]));
  const godName = (k) => (godByKey.get(k) || {}).name || k;
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

  // ── build-legality constraints (driven by the selected spec's allocated perks) ──────
  const curSpec = () => build.specId != null ? SPEC.get(build.specId) : null;
  // caps come from effect rules (data/reference/effect_rules.json): Royal's Master of All (+10) & Highborn (+5)
  // anointments, Pariah's Introversion (3 creatures), Army of Gods (+1 Avatar/rank), Deprived (0 Avatars)
  const anointMax = () => FX.cap("anoints");
  const creatureCap = () => FX.cap("creatures");
  const avatarCap = () => FX.cap("avatars");
  const isAvatar = (c) => !!c && c.race === "Avatar";
  // count party creatures (by their primary) that are Avatars, optionally excluding one slot
  const avatarCount = (exceptSlot) => build.slots.reduce((n, s, i) => n + (i !== exceptSlot && isAvatar(CREA.get(s.cid)) ? 1 : 0), 0);
  // trim equipped anointments down to the current cap (after a spec/perk change lowers it)
  function enforceAnointCap() { const cap = anointMax(); if (build.anoints.length > cap) build.anoints = build.anoints.slice(0, cap); }
  function renderSpecPicker() {
    const st = ovState;
    const q = st.search.trim().toLowerCase();
    const list = D.specs.filter(s => !q || s.label.toLowerCase().includes(q)).slice().sort((a, b) => a.label.localeCompare(b.label));
    const sel = st.sel != null ? SPEC.get(st.sel) : null;
    const tiles = list.map(s => `
      <div class="pick-tile spec-pick ${st.sel === s.id ? "selected" : ""}" data-action="spec-pick" data-id="${s.id}">
        <div class="pt-sprite emblem">${spriteImg(s.emblem || s.sprite, "px")}</div><div class="pt-name${/\S{13,}/.test(s.label) ? " pt-long" : ""}">${esc(s.label)}</div></div>`).join("");
    let info = "";
    const phone = isPhone();
    if (sel && !phone) {
      const allocCount = allocatedPerks(sel).length, pts = specPoints(sel);
      const perkList = specPerkListHtml(sel);
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
        <div class="ovl-center" data-action="lib-deselect"><div class="ovl-center-scroll"><div class="pick-grid spec-grid">${tiles}</div></div></div>
        ${phone ? "" : `<div class="ovl-right spec-right">${info}</div>`}
      </div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>
          <button class="btn-ghost" data-action="close-ovl">Cancel</button>
          ${phone ? "" : `<button class="btn-ghost" data-action="customize-perks" ${sel ? "" : "disabled"}>Customize</button>
          <button class="btn-confirm" data-action="spec-confirm" ${st.sel == null ? "disabled" : ""}>Confirm</button>`}
        </div></div>
    </div></div>`;
  }

  // spec PAGE (detail layer, over the picker): animated costume + prose + perks; Edit turns the perk cards into rank
  // steppers in place. Reached by tapping a spec in the phone picker, or the Spec tile (picker opens underneath, so the
  // back arrow lands on the grid to pick a replacement). Footer: Confirm for a new spec, Done for the active one.
  const isPhone = () => !!(window.matchMedia && window.matchMedia("(max-width: 600px)").matches);
  function openSpecPage(specId) {
    dovState = { kind: "spec-detail", specId, editing: false, render: renderSpecPage };
    openDetail(dovState.render()); syncSpecAnim();
  }
  function applySpec(id) {
    build.specId = id;
    // drop any equipped anointments that now belong to the current spec (can't double-dip)
    build.anoints = build.anoints.filter(x => x.specId !== build.specId);
    enforceAnointCap();   // new spec may lower the anoint cap (e.g. leaving Royal)
    persistBuild(); closeOverlay(); render();
  }
  function openSpecDetail() {
    if (build.specId == null) { openSpecPicker(); return; }
    openSpecPicker(); openSpecPage(build.specId);
  }
  // shared perk-list markup used by both the selector info panel and the detail page
  // owner → the spells it grants (D.spellGrants), as spell-gem cards on the owner's own display
  const grantsOf = (kind, test) => (D.spellGrants || []).filter(g => g.owner.kind === kind && test(g.owner));
  const grantCardTrigger = (g) => g.mode === "boss" ? (g.oneOf && g.spells.length > 1 ? "One at random · its turn" : "On its turn") : grantTrigger(g);
  const grantCards = (gs, noTrigger) => gs.map(g => g.spells.map(id => SPELL.get(id)).filter(Boolean).map(sp => spellGemCard(sp, noTrigger ? "" : grantCardTrigger(g))).join("")).join("");
  // perk spell cards carry no casting chip: the perk text right above already states when / how often it casts
  const perkGrantCards = (specId, key) => grantCards(grantsOf("perk", o => o.spec === specId && o.key === key), true);
  // the spells a perk casts (code: Auto Cast sites) + the gems it grants, as one indented row of spell-gem containers under the perk
  const traitGrantCards = (traitId, rtIds) => grantCards(grantsOf("trait", o => o.id === traitId
    || (rtIds && ((TRAIT[o.id] || {}).runtimeIds || []).some(r => rtIds.includes(r)))));
  // the spells an object casts or grants (code: obj.spellsUsed, build-data) as spell-gem containers; `granted` = spell ids the
  // owner's spellGrants cards already show; `rank` = a relic rank (only that rank's spells). A runtime pool keeps the code's
  // order and labels each card with its pick case; otherwise the order the object's text names them.
  const usedSpellCards = (obj, granted, rank) => {
    const list = (obj && obj.spellsUsed || []).filter(e => (rank == null || e.rk === rank) && !(granted && granted.has(e.s)));
    const at = (e) => { const sp = SPELL.get(e.s), i = sp ? (obj.desc || "").indexOf(sp.name) : -1; return i < 0 ? 1e9 : i; };
    if (!list.some(e => e.l)) list.sort((a, b) => at(a) - at(b));
    return list.map(e => SPELL.get(e.s) ? spellGemCard(SPELL.get(e.s), e.l || "") : "").join("");
  };
  // buffs / debuffs the object applies or always has (code: obj.condsUsed) as status-effect containers, same look as spell cards
  const COND_BY_ID = new Map((D.conditions || []).map(c => [`${c.cat}:${c.key}`, c]));
  const condCard = (c) => `<div class="art-spellcard apx-clickable" data-action="apx-open" data-ek="condition" data-eid="${esc(c.cat + ":" + c.key)}" title="View taxonomy">
    <div class="art-spellcard-head">${c.icon ? `<span class="prop-ico sm"><img src="${esc(c.icon)}" alt=""></span>` : ""}<b>${esc(c.name)}</b></div>
    ${c.desc ? `<div class="trait-desc">${esc(c.desc)}</div>` : ""}</div>`;
  const usedCondCards = (obj, rank) => (obj && obj.condsUsed || []).filter(e => rank == null || e.rk === rank)
    .map(e => COND_BY_ID.get(e.c)).filter(Boolean).map(condCard).join("");
  // collapsed by default behind a small arrow inside the owner's container; open rows stay open across re-renders (keyed by content)
  const subOpen = new Set();
  const subKey = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const spellRowWrap = (cards, flat) => {
    if (!cards) return "";
    const k = subKey(cards), open = subOpen.has(k);
    return `<div class="perk-spell-row${flat ? " flat" : ""}${open ? " open" : ""}" data-sk="${k}">
      <button type="button" class="sub-toggle" data-action="sub-toggle" aria-expanded="${open}" aria-label="Show spells and status effects"><span class="sub-arrow">▸</span></button>
      <div class="sub-body">${cards}</div></div>`;
  };
  const perkSpellRow = (specId, p, flat) => {
    const granted = new Set(grantsOf("perk", o => o.spec === specId && o.key === p.key).flatMap(g => g.spells));
    return spellRowWrap(demonSpellCards(p) + usedSpellCards(p, granted) + perkGrantCards(specId, p.key) + usedCondCards(p), flat);
  };
  const traitSpellRow = (tid, flat, rtIds) => {
    const t = TRAIT[tid]; if (!t) return "";
    const gs = grantsOf("trait", o => o.id === tid || (rtIds && ((TRAIT[o.id] || {}).runtimeIds || []).some(r => rtIds.includes(r))));
    return spellRowWrap(usedSpellCards(t, new Set(gs.flatMap(g => g.spells))) + grantCards(gs) + usedCondCards(t), flat);
  };
  // a relic's Ultimate (scr_GetUltimateSpellByRelic) and who hands it out (Idolatry / Weapons of Mass Distortion)
  function relicUltimateCard(relicId) {
    const sp = SPELL.get((D.relicUltimates || {})[relicId]); if (!sp) return "";
    const via = (D.ultimateRoutes || []).map(r => grantOwnerName(r.owner)).filter(Boolean).join(" · ");
    return `<div class="section-label">Ultimate</div>${spellGemCard(sp, via)}`;
  }
  // Final Summoning: the spell each Greater Demon casts when it runs out (extract S35; Satanachia = one of a pool at random),
  // as spell cards labelled with their demon, inside the perk's collapsible spell row
  function demonSpellCards(p) {
    if (!p || !p.demonSpells) return "";
    return p.demonSpells.map(d => {
      const c = COND_BY_ID.get(d.cond), sps = d.spells.map(id => SPELL.get(id)).filter(Boolean);
      return sps.map(sp => spellGemCard(sp, c ? c.name : d.cond)).join("");
    }).join("");
  }
  // spell → every owner that grants it (spell entity detail)
  function spellGrantedByHtml(spellId) {
    const names = (D.spellGrants || []).filter(g => g.spells.includes(spellId)).map(g => grantOwnerName(g.owner));
    const rel = Object.entries(D.relicUltimates || {}).filter(([, sid]) => sid === spellId).map(([rid]) => grantOwnerName({ kind: "relic", id: +rid }));
    if (rel.length) names.push(...(D.ultimateRoutes || []).map(r => `${grantOwnerName(r.owner)} (${rel.join(", ")})`));
    const uniq = [...new Set(names.filter(Boolean))];
    return uniq.length ? `<div class="section-label">Granted by</div><div class="perk-desc" style="margin-bottom:12px">${uniq.map(esc).join(" · ")}</div>` : "";
  }
  function specPerkListHtml(spec) {
    return spec.perks.map(p => {
      const r = perkRank(spec, p), mx = perkMax(p), on = r > 0;
      const badge = mx > 1 ? `<span class="perk-rankbadge">${r}/${mx}</span>` : (on ? `<span class="perk-rankbadge">✓</span>` : "");
      const asc = p.ascension ? `<span class="anoint-badge asc">Ascension</span>` : "";
      const ico = `<div class="apx-iconcol">${p.icon ? `<div class="apx-crea">${spriteImg(p.icon, "px")}</div>` : ""}</div>`;   // same 48px centered icon as the Glossary
      return `<div class="perk-line apx-clickable ${on ? "on" : "off"} ${p.ascension ? "asc" : ""}" data-action="apx-open" data-ek="perk" data-eid="${esc(p.key)}">${ico}
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${noAnointMark(spec, p)}${asc}${badge}</span>${bkBtn("perks", p.key)}</div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
          ${perkSpellRow(spec.id, p)}
        </div></div>`;
    }).join("");
  }
  function renderSpecPage() {
    const st = dovState, spec = SPEC.get(st.specId); if (!spec) return "";
    const allocCount = allocatedPerks(spec).length, pts = specPoints(spec);
    const cos0 = spec.costumes && spec.costumes.length ? spec.costumes[0] : null;
    const costumeImg = cos0 ? (cos0.frames && cos0.frames[0]) || cos0.img : spec.sprite;
    const active = build.specId === spec.id;
    const perks = st.editing
      ? `<div class="ovl-filterbar spec-edit-bar"><button class="chip" data-action="perk-all">Max all</button><button class="chip" data-action="perk-none">Clear all</button></div>
         <div class="perk-picker">${perkEditRowsHtml(spec, spec.perks)}</div>`
      : `<div class="perk-list">${specPerkListHtml(spec)}</div>`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail spec-page">
      <div class="overlay-header"><button class="btn-ghost spec-back" data-action="specpage-back" title="All specializations">‹</button>
        <h2 style="flex:1">${esc(spec.label)}</h2><button class="ovl-close" data-action="specpage-close">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="spec-info">
          <div class="spec-info-sprite costume" id="specCostume">${spriteImg(costumeImg, "px")}</div>
          <h2 class="spec-info-name">${esc(spec.label)}</h2>
          <div class="trait-desc spec-play">${richText(spec.playstyle || spec.description || "")}</div>
          <div class="section-label" style="margin-top:12px">Perks — ${allocCount}/${spec.perks.length} allocated · ${pts} pts</div>
          ${perks}
        </div>
      </div></div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="specpage-back">‹ Specializations</button>
        <div><button class="btn-ghost ${st.editing ? "on" : ""}" data-action="specpage-edit">Edit</button>
        <button class="btn-confirm" data-action="${active ? "specpage-close" : "specpage-confirm"}">${active ? "Done" : "Confirm"}</button></div></div>
    </div></div>`;
  }
  // editable perk cards (rank stepper) — the spec page's Edit mode and the desktop Customize screen
  function perkEditRowsHtml(spec, list) {
    return list.map(p => {
      const r = perkRank(spec, p), mx = perkMax(p), on = r > 0;
      const k = esc(p.key);
      const stepper = `<div class="perk-stepper">
        <button class="perk-step" data-action="perk-dec" data-k="${k}" ${r <= 0 ? "disabled" : ""}>−</button>
        <span class="perk-rank-val">${r}<span class="perk-rank-max">/${mx}</span></span>
        <button class="perk-step" data-action="perk-inc" data-k="${k}" ${r >= mx ? "disabled" : ""}>+</button>
        ${mx > 1 ? `<button class="perk-step wide" data-action="perk-max" data-k="${k}" ${r >= mx ? "disabled" : ""}>Max</button>` : ""}
        <button class="perk-step wide" data-action="perk-zero" data-k="${k}" ${r <= 0 ? "disabled" : ""}>0</button></div>`;
      const costLine = p.cost != null ? `<span class="perk-meta">${p.cost} pt${p.cost === 1 ? "" : "s"}/rank${on ? ` · ${p.cost * r} spent` : ""}</span>` : "";
      const asc = p.ascension ? `<span class="anoint-badge asc">Ascension</span>` : "";
      const ico = `<div class="apx-iconcol">${p.icon ? `<div class="apx-crea">${spriteImg(p.icon, "px")}</div>` : ""}</div>`;   // same 48px centered icon as the Glossary
      return `<div class="perk-row ${on ? "on" : "off"} ${p.ascension ? "asc" : ""}">
        ${ico}<div class="perk-row-main">
          <div class="perk-row-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${noAnointMark(spec, p)}${asc}${costLine}</span></div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
          ${stepper}</div></div>`;
    }).join("");
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
      && TagFilter.match(st, "perk", p));
    const allocCount = allocatedPerks(spec).length, pts = specPoints(spec);
    const rows = perkEditRowsHtml(spec, list);
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(spec.label)} — Perks</h2>
        <input class="ovl-search" placeholder="Search perks…" value="${esc(st.search)}" data-action="perk-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="ovl-filterbar"><button class="chip" data-action="perk-all">Max all</button><button class="chip" data-action="perk-none">Clear all</button>${TagFilter.bar(st, "perk")}</div>
        <div class="ovl-center-scroll"><div class="perk-picker">${rows}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info">${allocCount}/${spec.perks.length} allocated · ${pts} pts</span>
        <button class="btn-confirm" data-action="close-detail">Done</button></div>
    </div></div>`;
  }

  // ── saved builds — library + save form; icon chosen from the wardrobe (front-facing frame) ──
  const buildDefaultIcon = () => {
    const spec = build.specId != null ? SPEC.get(build.specId) : null;
    if (spec && spec.costume) return spec.costume;
    const w = (D.wardrobe || []).find(x => x.category === "specialization") || (D.wardrobe || [])[0];
    return w ? w.img : null;
  };
  const buildSummary = (b) => {
    const spec = b.specId != null ? SPEC.get(b.specId) : null;
    return spec ? `${specEmblemIco(spec.label)}${esc(spec.label)}` : "No specialization";
  };
  const buildSpecLabel = (b) => { const s = (b.build && b.build.specId != null) ? SPEC.get(b.build.specId) : null; return s ? s.label : ""; };
  function sortBuilds(list, mode, rev) {
    const d = sortSign(rev);
    if (mode === "name") return list.sort((a, b) => d * (a.name || "").localeCompare(b.name || ""));
    if (mode === "spec") return list.sort((a, b) => { const sa = buildSpecLabel(a), sb = buildSpecLabel(b);
      if (!sa !== !sb) return sa ? -1 : 1;                                // builds with no spec stay last either way
      return (sa ? d * sa.localeCompare(sb) : 0) || (a.name || "").localeCompare(b.name || ""); });
    return list.sort((a, b) => d * ((b.ts || 0) - (a.ts || 0)));   // "edited" (default): newest first
  }
  function openBuilds() {
    ovState = { kind: "builds", draft: null, sel: null, flash: null, sort: "edited", render: renderBuilds };
    openOverlay(ovState.render());
  }
  function flashBuild(id) {   // brief "Saved ✓" confirmation on the tile + footer
    ovState.flash = id; refreshOverlay();
    setTimeout(() => { if (ovState && ovState.kind === "builds") { ovState.flash = null; refreshOverlay(); } }, 1200);
  }
  // selected-build preview: spec emblem + equipped anointment perk icons, then the party as a 2×3 grid
  function renderBuildPreview(b) {
    const bd = b.build || {};
    const spec = bd.specId != null ? SPEC.get(bd.specId) : null;
    const emblem = spec ? `<div class="bi-emblem" title="${esc(spec.label)}">${spriteImg(spec.emblem || spec.sprite, "px")}</div>` : "";
    const anoints = (bd.anoints || []).map(a => { const s = SPEC.get(a.specId); return s && s.perks.find(x => x.key === a.key); }).filter(Boolean);
    const anointRow = anoints.length ? `<div class="bi-anoints">${anoints.map(p => `<span class="bi-anoint" title="${esc(p.name)}">${p.icon ? spriteImg(p.icon, "px") : "✦"}</span>`).join("")}</div>` : "";
    const slots = bd.slots || [];
    const crits = `<div class="bi-crits">${Array.from({ length: 6 }, (_, i) => {
      const s = slots[i], c = s && s.cid != null ? CREA.get(s.cid) : null;
      // the saved slot exactly as the main screen shows it: equipped skin + fusion colour option
      return `<div class="bi-crit${c ? "" : " empty"}"${c ? ` title="${esc(c.name)}"` : ""}>${c ? slotFace(s, c) : ""}</div>`; }).join("")}</div>`;
    return `<div class="section-label" style="text-align:center">${esc(b.name)}</div>
      <div class="bi-head">${emblem}${anointRow}</div>${crits}`;
  }
  function renderBuilds() {
    const st = ovState;
    if (st.draft) {
      const d = st.draft;
      // No info panel here — the big dotted box IS the control; the animated preview lives in Choose Icon.
      return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
        <div class="overlay-header"><h2>New Build</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
        <div class="overlay-body">
          <div class="ovl-center"><div class="ovl-center-scroll build-create">
            <button class="build-sprite-box" data-action="builds-pick-icon" title="Choose a sprite">
              ${d.icon ? spriteImg(d.icon, "px") : `<span class="slot-empty-icon">＋</span>`}</button>
            <input class="ovl-search build-name" placeholder="Name this build" value="${esc(d.name)}" data-action="builds-name">
          </div></div>
        </div>
        <div class="overlay-footer"><button class="btn-ghost" data-action="builds-cancel">Cancel</button>
          <span class="foot-info"></span>
          <button class="btn-confirm" data-action="builds-save">Save build</button></div>
      </div></div>`;
    }
    const sel = st.sel != null ? builds.find(b => b.id === st.sel) : null;
    const tiles = sortBuilds(builds.slice(), st.sort, st.sortRev).map(b => {   // the SELECTED tile animates its costume
      const selB = st.sel === b.id, bframes = selB && b.icon ? wardrobeFramesFor(b.icon) : null;
      return `<div class="lib-tile ${selB ? "selected" : ""} ${st.flash === b.id ? "flash" : ""}" data-action="builds-sel" data-id="${b.id}">
        <div class="lib-icon"${bframes ? ` data-anim-frames='${JSON.stringify(bframes)}'` : ""}>${b.icon ? spriteImg(currentWardrobeImg(b.icon), "px") : `<span class="slot-empty-icon">✦</span>`}</div>
        <div class="lib-name">${esc(b.name)}</div>
        <div class="lib-sub">${buildSummary(b.build || {})}</div>
      </div>`; }).join("") || `<div class="slot-sub" style="padding:10px">No saved builds yet — save your current party.</div>`;
    const sortBar = builds.length ? `<div class="ovl-filterbar"><span class="foot-info">Sort</span><div class="seg">
      <button class="seg-btn ${st.sort === "edited" ? "on" : ""}" data-action="builds-sort" data-sort="edited">${sortLbl("Last edited", st.sort === "edited", st.sortRev, true)}</button>
      <button class="seg-btn ${st.sort === "name" ? "on" : ""}" data-action="builds-sort" data-sort="name">${sortLbl("Name", st.sort === "name", st.sortRev, false)}</button>
      <button class="seg-btn ${st.sort === "spec" ? "on" : ""}" data-action="builds-sort" data-sort="spec">${sortLbl("Spec", st.sort === "spec", st.sortRev, false)}</button>
    </div></div>` : "";
    // right info panel: preview the selected build — spec emblem + equipped anointment icons, then a 2×3 creature grid
    const infoPanel = sel ? `<div class="ovl-right build-info">${renderBuildPreview(sel)}</div>` : "";
    // a blank loadout (no creature in any slot) must never overwrite a saved build back to the template state
    const loadoutBlank = !build.slots.some(s => s && s.cid != null);
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Builds</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center" data-action="lib-deselect">${sortBar}<div class="ovl-center-scroll">
        <div class="lib-grid">${tiles}</div></div></div>${infoPanel}</div>
      <div class="overlay-footer">
        <button class="btn-ghost danger" data-action="builds-del" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Delete</button>
        <span class="foot-info">${st.flash ? "Saved ✓" : ""}</span>
        <div>
          <button class="btn-ghost" data-action="builds-overwrite" ${sel && !loadoutBlank ? `data-id="${sel.id}"` : "disabled"}${sel && loadoutBlank ? ` title="Your current loadout is empty — load or build a party before updating a saved build"` : ""}>Update</button>
          ${sel
            ? `<button class="btn-confirm" data-action="builds-load" data-id="${sel.id}">Load</button>`
            : `<button class="btn-confirm" data-action="builds-save-new">Save</button>`}
        </div></div>
    </div></div>`;
  }

  // ── build import / export (buildio.js, BUILD_IO.md) ─────────────────────────────────────────────────
  // Export = readable game-style text (level 1 + the app's stats) + the SUC1 code line (the whole build, lossless).
  // Import = paste either a game "Export Build" text or a Companion export; ALWAYS loads as the current party.
  let BIO = null;
  const bio = () => BIO || (BIO = window.SU_BUILDIO.create({ D, CREA, SPELL, SPELLPROP, RELIC, NETHER_TRIGGERS, anointList }));
  const sameContent = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // per-slot readable pieces for the export text (the app's own level-1 numbers)
  function exportViews(b) {
    const sp = (id) => SPELL.get(id);
    return b.slots.map(slot => {
      if (!slot || slot.cid == null) return null;
      const c = CREA.get(slot.cid), f = slot.fusion != null ? CREA.get(slot.fusion) : null, fs = finalStats(slot), base = baseStats(slot);
      const traits = [["Innate Trait", c && c.traitId], ["Fused Trait", f && f.traitId]].filter(([, id]) => id != null && TRAIT[id])
        .map(([label, id]) => ({ label, name: TRAIT[id].name, desc: TRAIT[id].desc || "" }));
      const a = resolveArtifact(slot), artLines = [], stoneLines = [];
      let traitSlot = null;
      if (a) {
        const rank = a.rank || 50, pr = PRIMARY.find(x => x.property === a.primary);
        if (pr) artLines.push(`${pr.perRank[rank] || 0}% ${pr.stat}`);
        for (const nm of [...(a.stat || []), ...(a.trick || [])]) { const g = propGroups.get(nm), e = g && g.entries[0];
          if (e) artLines.push(`${e.perRank[rank] ?? 0}${e.unit === "%" ? "%" : ""} ${nm}`); }
        for (const id of a.traits || []) { const ti = TRAITITEM.get(id), tr = ti && TRAIT[ti.traitId]; if (tr) { artLines.push(tr.name); traitSlot = { name: tr.name, desc: tr.desc || "" }; } }
        for (const id of a.spells || []) { const s = sp(id); if (s) artLines.push(s.name); }
        const n = nether.find(x => x.id === (a.netherIds || [])[0]);
        if (n) {
          artLines.push(`${n.name}${n.rarity != null ? ` (${n.rarity})` : ""}`);
          for (const p of n.props || []) {
            if (p.cat === "trait") { const ti = TRAITITEM.get(p.key); if (ti) stoneLines.push(`Trait: ${ti.traitName || ti.name}`); }
            else if (p.cat === "spell") { const s = sp(p.key); if (s) stoneLines.push(`${s.name} ${p.trigger || "On Attack"}`); }
            else { const g = propGroups.get(p.key), e = g && g.entries[0]; stoneLines.push(`${p.value}${e && e.unit !== "%" ? "" : "%"} ${p.key}`); }
          }
        }
      }
      const gemNames = (slot.spellGemIds || []).map(id => { const g = spellGems.find(x => x.id === id); return g && gemSpell(g) ? gemSpell(g).name : null; }).filter(Boolean);
      return { final: fs.final, cls: base.cls, traits, artLines, stoneLines, traitSlot, gemNames };
    });
  }
  async function exportBuildText(b) {
    const libs = { artifacts, nether, spellGems };
    return bio().exportText(bio().payloadFromApp(b, libs), exportViews(b));
  }
  // payload → current party. Artifacts / stones / gems are added to the libraries, reusing an exact duplicate
  // already there (SU_BUILDIO.sameStone / sameArtifactBody) instead of adding a copy. Each library item is claimed
  // at most once per import: the source party is assumed legal (one artifact per creature, no stone in two
  // artifacts), so a second identical artifact / stone in the import gets its own library entry.
  function applyImportedBuild(payload, warnings) {
    const usedGems = new Set(), usedArts = new Set(), usedStones = new Set();
    const { sameStone, sameArtifactBody } = window.SU_BUILDIO;
    const spellId = (key) => { const s = bio().SPELL_BY_KEY.get(key); return s ? s.id : null; };
    const stoneBody = (n) => {
      const props = (n.props || []).map(p => p.cat === "spell" ? { cat: "spell", key: spellId(p.spell), trigger: p.trigger || "On Attack" } : { cat: p.cat, key: p.key, value: p.value ?? 0 })
        .filter(p => p.key != null && (p.cat !== "trait" || TRAITITEM.has(p.key)));
      return { name: n.name || `Nether Stone ${nextNetherId}`, icon: GEM_ICONS.some(g => g.key === n.icon) ? n.icon : null, props, ...(n.rarity != null ? { rarity: n.rarity } : {}) };
    };
    const freeStone = (id) => !usedStones.has(id) && nether.some(x => x.id === id);
    // an existing artifact's stone matches the incoming one (both empty, or same content and not yet claimed)
    const stoneFits = (art, sb) => { const nid = (art.netherIds || [])[0];
      if (nid == null || !nether.some(x => x.id === nid)) return !sb;
      return !!sb && freeStone(nid) && sameStone(nether.find(x => x.id === nid), sb); };
    const ensureStone = (sb) => {
      const hit = nether.find(x => !usedStones.has(x.id) && sameStone(x, sb));
      const id = hit ? hit.id : nextNetherId++;
      if (!hit) nether.push({ id, ...sb, icon: sb.icon || (GEM_ICONS[0] || {}).key });
      usedStones.add(id); return id;
    };
    const ensureArtifact = (a) => {
      if (!a || !a.primary) return null;
      const sb = a.nether ? stoneBody(a.nether) : null;
      const body = { name: a.name || `Artifact ${nextArtId}`, rank: a.rank || 50, primary: a.primary, stat: (a.stat || []).slice(0, 3), trick: (a.trick || []).slice(0, 2),
        traits: (a.traits || []).filter(id => TRAITITEM.has(id)).slice(0, 1), spells: (a.spells || []).map(spellId).filter(x => x != null).slice(0, 1) };
      const hit = artifacts.find(x => !usedArts.has(x.id) && sameArtifactBody(x, body) && stoneFits(x, sb));
      if (hit) { usedArts.add(hit.id); (hit.netherIds || []).forEach(id => usedStones.add(id)); return hit.id; }
      const stoneId = sb ? ensureStone(sb) : null;
      const id = nextArtId++; artifacts.push({ id, ...body, netherIds: stoneId != null ? [stoneId] : [], _gemMigrated: true, _rawSpell: true });
      usedArts.add(id); return id;
    };
    const ensureGem = (g) => {
      const sid = spellId(g.spell); if (sid == null) { warnings.push(`Spell "${g.spell}" not found — gem skipped.`); return null; }
      const propIds = (g.props || []).map(k => (bio().PROP_BY_KEY.get(k) || {}).id).filter(x => x != null);
      const body = { name: "", spellId: sid, tier: g.tier ?? GT.max, propIds };
      const hit = spellGems.find(x => !usedGems.has(x.id) && sameContent({ name: "", spellId: x.spellId, tier: x.tier ?? GT.max, propIds: x.propIds || [] }, body));
      const id = hit ? hit.id : nextSpellGemId++;
      if (!hit) spellGems.push({ id, ...body });
      usedGems.add(id); return id;
    };
    const slots = (payload.slots || []).slice(0, 6).map(s => {
      const slot = emptySlot();
      if (!s || !CREA.has(s.cid)) return slot;
      Object.assign(slot, { cid: s.cid, fusion: CREA.has(s.fusion) ? s.fusion : null, personality: s.personality && PERS.has(s.personality) ? s.personality : null,
        scrolls: s.scrolls || {}, skinId: s.skinId ?? null, ...(s.fuseColor != null ? { fuseColor: s.fuseColor } : {}),
        relic: s.relic && RELIC.has(s.relic.id) ? { id: s.relic.id, rank: s.relic.rank } : null });
      slot.artifactId = ensureArtifact(s.artifact);
      slot.spellGemIds = (s.gems || []).map(ensureGem).filter(x => x != null);
      return slot;
    });
    build = normalizeBuild({ schema: 3, specIds: 2, skinIds: 2, specId: SPEC.has(payload.spec) ? payload.spec : null,
      perkAlloc: payload.perkAlloc || {}, anoints: (payload.anoints || []).filter(a => SPEC.has(a.specId)), slots });
    clearBookmarks(); persistNether(); persistArtifacts(); persistSpellGems(); persistBuild(); render();
    return { creatures: slots.filter(s => s.cid != null).length };
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try { const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok; } catch { return false; }
  }
  // compact pop-out (Riddle Dwarf style, top-right): Import | Export toggle. Export = the current party.
  function openBuildIO(mode = "import") {
    ovState = { kind: "bio", mode, text: "", out: "", status: "", warnings: null, error: null, busy: false, render: renderBuildIO };
    openOverlay(ovState.render());
    if (mode === "export") runExport(); else maybeFocusSearch(OV);
  }
  function runExport() {
    const st = ovState; st.busy = true; st.status = ""; refreshOverlay();
    exportBuildText(build).then(t => { if (ovState === st) { st.out = t; st.busy = false; refreshOverlay(); } })
      .catch(e => { if (ovState === st) { st.busy = false; st.error = String(e.message || e); refreshOverlay(); } });
  }
  function renderBuildIO() {
    const st = ovState, exp = st.mode === "export";
    const tabs = `<div class="seg bio-tabs"><button class="seg-btn ${!exp ? "on" : ""}" data-action="bio-mode" data-v="import">Import</button>
      <button class="seg-btn ${exp ? "on" : ""}" data-action="bio-mode" data-v="export">Export</button></div>`;
    let body, foot;
    if (exp) {
      body = st.busy ? `<div class="slot-sub" style="padding:12px">Preparing export…</div>`
        : `<textarea class="bio-text" readonly>${esc(st.out)}</textarea>`;
      foot = `<span class="foot-info">${esc(st.status || "")}</span><div><button class="btn-ghost" data-action="bio-copy" data-what="link" ${st.busy ? "disabled" : ""}>Copy link</button>
        <button class="btn-ghost" data-action="bio-copy" data-what="code" ${st.busy ? "disabled" : ""}>Copy code only</button>
        <button class="btn-confirm" data-action="bio-copy" data-what="all" ${st.busy ? "disabled" : ""}>Copy</button></div>`;
    } else if (st.warnings) {
      body = `<div class="bio-result"><b>Loaded ${st.loaded} creature${st.loaded === 1 ? "" : "s"} into your party${st.source === "code" ? " (Companion build code)" : " (game export)"}.</b>
        ${st.warnings.length ? `<ul class="bio-warn">${st.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</div>`;
      foot = `<span class="foot-info"></span><div><button class="btn-confirm" data-action="bio-done">Done</button></div>`;
    } else {
      body = `<textarea class="bio-text ovl-search" data-action="bio-text" placeholder="Paste a Siralim Ultimate “Export Build” text or a Companion export…">${esc(st.text)}</textarea>`;
      foot = `<span class="foot-info">${st.error ? `<span class="ns-issue">${esc(st.error)}</span>` : "Replaces your current party."}</span><div>
        <button class="btn-confirm" data-action="bio-run">Import</button></div>`;
    }
    return `<div class="ovl-backdrop riddle-backdrop" data-action="backdrop"><div class="overlay-panel riddle-pop bio-pop">
      <div class="riddle-pop-head"><span class="riddle-pop-title">Build</span>${tabs}<span class="bio-gap"></span><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="riddle-pop-body bio-body">${body}</div>
      <div class="bio-foot">${foot}</div>
    </div></div>`;
  }

  // ── shareable build link: <site>#b=<SUC1 code body>. Read once on load, then stripped from the address bar so a
  // refresh doesn't re-import. The visitor chooses: load as the current party, or save it to Builds (party untouched).
  const shareLink = (code) => `${location.origin}${location.pathname}#b=${code.replace(/^SUC1:/, "")}`;
  function checkSharedLink() {
    const m = location.hash.match(/^#b=([A-Za-z0-9_-]+)/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    bio().importText(`SUC1:${m[1]}`).then(r => {
      ovState = { kind: "share", payload: r.payload, warnings: r.warnings, name: "Shared build", done: null, render: renderSharePrompt };
      openOverlay(ovState.render());
    }).catch(() => {
      ovState = { kind: "share", error: "This build link is damaged or incomplete.", render: renderSharePrompt };
      openOverlay(ovState.render());
    });
  }
  function renderSharePrompt() {
    const st = ovState;
    let body, foot;
    if (st.error) {
      body = `<div class="bio-result"><span class="ns-issue">${esc(st.error)}</span></div>`;
      foot = `<span class="foot-info"></span><div><button class="btn-confirm" data-action="close-ovl">Close</button></div>`;
    } else if (st.done) {
      body = `<div class="bio-result"><b>${st.done === "load" ? "Loaded into your party." : `Saved to Builds as “${esc(st.name)}”.`}</b>
        ${st.warnings.length ? `<ul class="bio-warn">${st.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}</div>`;
      foot = `<span class="foot-info"></span><div><button class="btn-confirm" data-action="close-ovl">Done</button></div>`;
    } else {
      const p = st.payload, spec = p.spec != null ? SPEC.get(p.spec) : null;
      const crits = (p.slots || []).filter(x => x && CREA.has(x.cid)).map(x => {
        const c = CREA.get(x.cid), f = x.fusion != null ? CREA.get(x.fusion) : null;
        return `<li>${esc(c.name)}${f ? ` <span class="slot-sub">+ ${esc(f.name)}</span>` : ""}</li>`; }).join("");
      body = `<div class="bio-result">${spec ? `<b>${esc(spec.label)}</b>` : ""}${crits ? `<ul class="share-crits">${crits}</ul>` : ""}
        <label class="share-name">Name <input class="ovl-search" data-action="share-name" value="${esc(st.name)}"></label>
        <div class="slot-sub share-note">Load replaces your current party · Save to Builds keeps it.</div></div>`;
      foot = `<span class="foot-info"></span><div class="share-btns">
        <button class="btn-ghost" data-action="share-save">Save to Builds</button>
        <button class="btn-confirm" data-action="share-load">Load</button></div>`;
    }
    return `<div class="ovl-backdrop riddle-backdrop" data-action="backdrop"><div class="overlay-panel riddle-pop bio-pop">
      <div class="riddle-pop-head"><span class="riddle-pop-title">Shared build</span><span class="bio-gap"></span><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="riddle-pop-body bio-body">${body}</div>
      <div class="bio-foot">${foot}</div>
    </div></div>`;
  }

  // wardrobe icon picker (detail overlay) — full 820 costumes, front-facing frame, search + category
  // 4 groups, every costume in exactly one (_su_extract code/classify_wardrobe.py: spec tiers / "Master of" / god / misc)
  const WARDROBE_CATS = ["specialization", "master", "god", "misc"];
  const WARDROBE_CAT_LABEL = { specialization: "Specialization", master: "Master", god: "God", misc: "Misc" };
  const ICON_PAGE = 120;   // wardrobe sprites rendered per page; "Load more" adds another page
  function openIconPicker(onPick) {
    dovState = { kind: "iconpick", search: "", cat: null, limit: ICON_PAGE, onPick, render: renderIconPicker };
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderIconPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    let list = (D.wardrobe || []).filter(w => w.img
      && (!st.cat || w.category === st.cat)
      && (!q || (w.name || "").toLowerCase().includes(q)));
    list = list.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const limit = st.limit || ICON_PAGE, shown = list.slice(0, limit);
    const catChips = WARDROBE_CATS.map(c =>
      `<button class="facet ${st.cat === c ? "on" : ""}" data-action="iconpick-cat" data-c="${c}">${WARDROBE_CAT_LABEL[c]}</button>`).join("")
      + (st.cat ? `<button class="facet tag" data-action="iconpick-cat-clear">Clear ✕</button>` : "");
    // tap a tile to select it; the animated preview shows in the right info panel. Tap again / "Use" commits.
    const tiles = shown.map(w =>
      `<div class="pick-tile ${st.sel === w.sprite ? "selected" : ""}" data-action="iconpick-sel" data-k="${esc(w.sprite)}">
        <div class="pt-sprite">${spriteImg(w.img, "px")}</div><div class="pt-name">${esc(w.name)}</div></div>`).join("")
      || `<div class="slot-sub" style="padding:10px">No sprites match.</div>`;
    // info panel — only when a sprite is selected: show it large + animated (its 2-frame walk)
    const selW = st.sel ? (D.wardrobe || []).find(w => w.sprite === st.sel) : null;
    const infoPanel = selW ? `<div class="ovl-right build-preview">
        <div class="build-hero"${Array.isArray(selW.frames) ? ` data-anim-frames='${JSON.stringify(selW.frames)}'` : ""}>${spriteImg(selW.img, "px")}</div></div>` : "";
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Choose Icon</h2>
        <input class="ovl-search" placeholder="Search sprites…" value="${esc(st.search)}" data-action="iconpick-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center" data-action="dlib-deselect">
        <div class="ovl-filterbar">${catChips}</div>
        <div class="ovl-center-scroll"><div class="pick-grid">${tiles}</div>
        ${list.length > shown.length
          ? `<div class="crea-loadmore"><button class="btn-ghost" data-action="iconpick-more">Load more (${shown.length} of ${list.length})</button></div>`
          : list.length > ICON_PAGE ? `<div class="slot-sub" style="margin-top:10px;text-align:center">All ${list.length} shown</div>` : ""}</div>
      </div>${infoPanel}</div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="iconpick-use" ${st.sel ? "" : "disabled"}>Use this icon</button></div>
    </div></div>`;
  }

  // ── Appendix — cross-entity tag search: one tag surfaces every matching creature,
  //    trait, perk, spell and artifact trait-item across the whole dataset. ──────────
  // Category → Value index across every tagged surface (same drill-down as ＋Filter).
  // A bookmarked trait is "creature-innate" if some creature has it as its innate trait,
  // otherwise "item-only" (granted only by trait-items, or boss/other-owned).
  const bkTraitClass = (id) => traitSources().creatureByTrait.has(id) ? "creature" : "item";
  function appendixBkCounts() {
    const cbt = traitSources().creatureByTrait;
    let creature = 0; for (const id of bookmarks.traits) if (cbt.has(id)) creature++;
    const item = bookmarks.traits.length - creature;
    return { all: bookmarks.traits.length + bookmarks.perks.length + bookmarks.spells.length,
      creature, item, perk: bookmarks.perks.length, spell: bookmarks.spells.length };
  }
  // The result-surface universe, restricted by the active bookmark scope (ovState.bkScope):
  // null = everything · "all" = every bookmark · creature/item/perk/spell = one bookmarked kind.
  function appendixUniverse() {
    const scope = ovState.bkScope;
    let traits = Object.values(D.traits);
    let perks = D.specs.flatMap(s => s.perks.map(p => ({ ...p, spec: s.label })));
    let spells = (D.spells || []).slice();
    let relics = (D.relics || []).slice();
    let cards = (D.cards || []).slice();
    if (scope) {
      const bT = new Set(bookmarks.traits), bP = new Set(bookmarks.perks), bS = new Set(bookmarks.spells);
      relics = []; cards = [];                                   // relics/cards aren't bookmarkable
      if (scope === "all") { traits = traits.filter(t => bT.has(t.id)); perks = perks.filter(p => bP.has(p.key)); spells = spells.filter(s => bS.has(s.id)); }
      else if (scope === "creature") { traits = traits.filter(t => bT.has(t.id) && bkTraitClass(t.id) === "creature"); perks = []; spells = []; }
      else if (scope === "item") { traits = traits.filter(t => bT.has(t.id) && bkTraitClass(t.id) === "item"); perks = []; spells = []; }
      else if (scope === "perk") { traits = []; perks = perks.filter(p => bP.has(p.key)); spells = []; }
      else if (scope === "spell") { traits = []; perks = []; spells = spells.filter(s => bS.has(s.id)); }
    }
    return { traits, perks, spells, relics, cards };
  }
  // AND across every selected tag, within the current bookmark-scope universe.
  // A trait is the canonical entity: the creature that has it as its innate trait and the
  // trait-items that grant it both carry the same inherited taxo, so they fold into one row.
  function appendixResults(tags) {
    const u = appendixUniverse();
    const has = (x) => tags.every(t => objHasKey(x, t));
    return {
      traits: u.traits.filter(has),
      perks: u.perks.filter(has),
      spells: u.spells.filter(has),
      relics: u.relics.filter(has),
      cards: u.cards.filter(has),
    };
  }
  const appendixTotal = (res) => res.traits.length + res.perks.length + res.spells.length + res.relics.length + res.cards.length;
  // Browse index: Category → [{key,val,n}] where only values that co-occur with the current
  // tags (within scope) survive, and n = how many results adding that value would yield. As tags
  // narrow, empty categories/values drop out and every n updates. (Requirements 4 & 5.)
  function appendixBrowseIndex(tags) {
    const res = appendixResults(tags);
    const counts = new Map();
    const bump = (arr) => { for (const it of arr) for (const k of tagKeys(it)) counts.set(k, (counts.get(k) || 0) + 1); };
    bump(res.traits); bump(res.perks); bump(res.spells); bump(res.relics); bump(res.cards);
    const tagSet = new Set(tags.map(keyBase));   // a refined tag still counts as applied
    const byCat = new Map();
    for (const g of taxoGroups()) {
      const rows = [];
      for (const key of g.keys) {
        if (tagSet.has(key)) continue;                          // already applied
        const n = counts.get(key) || 0;
        if (n > 0 && taxoValVisible(key)) rows.push({ key, val: taxoRowLabel(key), n });
      }
      if (rows.length) byCat.set(g.name, rows);
    }
    return byCat;
  }
  // trait id → the creature that has it innately + the trait-items that grant it (built once)
  let TRAIT_SOURCES = null;
  function traitSources() {
    if (TRAIT_SOURCES) return TRAIT_SOURCES;
    const creatureByTrait = new Map(), itemsByTrait = new Map();
    for (const c of D.creatures) if (c.traitId != null && !creatureByTrait.has(c.traitId)) creatureByTrait.set(c.traitId, c);
    for (const ti of (D.traitItems || [])) {
      if (ti.traitId == null) continue;
      if (!itemsByTrait.has(ti.traitId)) itemsByTrait.set(ti.traitId, []);
      itemsByTrait.get(ti.traitId).push(ti);
    }
    TRAIT_SOURCES = { creatureByTrait, itemsByTrait };
    return TRAIT_SOURCES;
  }
  // Taxonomy page (internal ids say "appendix"/"apx", its old name; the page now titled Appendix is openErrata)
  function openAppendix() {
    ovState = { kind: "appendix", search: "", browsing: false, bkScope: null,
      collapsed: new Set(), expanded: new Set(), render: renderAppendix };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderAppendix() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const tags = TagFilter.get(st, "appendix");
    const bk = appendixBkCounts();
    const bkCount = bk.all;
    // Browse (filter-picking) view = the landing when nothing is applied, or when ＋ Filter is tapped.
    // Results view = whenever a taxonomy tag, a bookmark scope, or a name query is active.
    const browsing = st.browsing || (tags.length === 0 && !st.bkScope && !q);
    // active-tag chips (removable) — mirror the creature selector's multi-AND facet chips
    const tagChips = TagFilter.chips(st, "appendix");
    // Bookmark filtering is now a single footer button (toggles the "all-bookmarks" scope); the
    // creature-innate / item-only split logic stays wired (appendixBkCounts / appendixUniverse) for the
    // Item-only Traits section and future use, it's just no longer exposed as a chip row.
    const backToResults = (tags.length || st.bkScope) ? `<button class="facet" data-action="appendix-done-adding">‹ Results</button>` : "";
    let body, sub, placeholder;
    if (browsing) {
      // Collapsible category headers (all collapsed by default); each expands to its sub-category
      // values with an n = result count. Only categories/values that share the current filters and
      // have >0 matches are shown. A query filters both the categories and their values, and
      // auto-expands whatever matches.
      const idx = appendixBrowseIndex(tags);
      const parts = [];
      for (const cat of idx.keys()) {   // mechanic groups in their set order
        let vals = idx.get(cat);
        const catMatch = cat.toLowerCase().includes(q);
        if (q && !catMatch) vals = vals.filter(v => v.val.toLowerCase().includes(q));
        if (!vals.length) continue;
        const open = q ? true : st.expanded.has(cat);
        const rows = open ? `<div class="opt-list apx-vals">${vals.slice().sort(taxoRowSort).map(v =>
          `<button class="opt-row" data-action="appendix-tag" data-k="${esc(v.key)}"><span>${esc(v.val)}</span><span class="apx-val-n">${v.n}</span></button>`).join("")}</div>` : "";
        parts.push(`<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="appendix-cat-toggle" data-c="${esc(cat)}">
            <span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(cat)}</button>${rows}`);
      }
      placeholder = "Search categories & tags…";
      sub = `<div class="ovl-filterbar">${backToResults}${tagChips}${singlesToggle()}</div>`;
      body = parts.join("") || `<div class="slot-sub" style="padding:10px">No categories or tags match.</div>`;
    } else {
      const res = appendixResults(tags);
      // provenance chips (token/llm/…) live ONLY on the taxonomy detail page now — the result rows stay clean.
      const section = (title, items, renderRow) => {
        let list = items;
        if (q) list = list.filter(x => ((x._search || x.name) || "").toLowerCase().includes(q));
        if (!list.length) return "";
        const collapsed = st.collapsed.has(title);
        return `<button class="apx-sec-head${collapsed ? " collapsed" : ""}" data-action="appendix-toggle-sec" data-sec="${esc(title)}">
            <span class="apx-sec-caret">${collapsed ? "▸" : "▾"}</span>${esc(title)} <span class="apx-sec-n">${list.length}</span></button>
          ${collapsed ? "" : `<div class="perk-list">${list.map(renderRow).join("")}</div>`}`;
      };
      // Every result row now leads with a left-hand icon column of large (creature-sprite-sized) boxes,
      // vertically centred. Objects with an "owner" stack two boxes (object icon over owner icon).
      const apxBox = (inner, cls, attrs) => inner ? `<div class="apx-crea ${cls || ""}"${attrs || ""}>${inner}</div>` : "";
      const apxIcon = (icon, cls, attrs) => apxBox(icon ? spriteImg(icon, "px") : "", cls, attrs);
      const apxStack = (...boxes) => { const b = boxes.filter(Boolean); return b.length ? `<div class="apx-iconcol">${b.join("")}</div>` : ""; };
      // meta chips (material / creature / class name labels) render at the BOTTOM-LEFT of the row,
      // not beside the title — long names (e.g. a creature name) used to push the title into a wrap.
      const line = (iconCol, name, meta, desc, bk, open, avail) => `<div class="perk-line${open ? " apx-clickable" : ""}"${open ? ` data-action="apx-open" data-ek="${open.ek}" data-eid="${esc(String(open.eid))}"` : ""}>
        ${iconCol}
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(name)}</b>${avail || ""}${bk || ""}</div>
          ${desc ? `<div class="perk-desc">${desc}</div>` : ""}
          ${meta ? `<div class="perk-line-meta">${meta}</div>` : ""}
        </div></div>`;
      // one row per trait, folding in the creature that has it + the items that grant it.
      // _search covers trait / creature / boss-owner / item names so name search hits any of them.
      const { creatureByTrait, itemsByTrait } = traitSources();
      const traitRows = res.traits.map(t => {
        const creature = creatureByTrait.get(t.id);
        const items = itemsByTrait.get(t.id) || [];
        const itemNames = [...new Set(items.map(i => i.name))];   // dedup (a trait can carry duplicate material records)
        // search index: trait name + creature name (creature-owned) + boss owner + the boss ENCOUNTER group +
        // the False God's full display name (Althea part → "Saint Althea"), so searching a boss/False God
        // name surfaces its traits the same way a creature name does.
        const fg = falseGodFor(t);
        return { id: t.id, name: t.name, desc: t.desc, creature, items, itemNames, taxo2: t.taxo2,
          depth: t.depth, gate: t.gate,
          ownerType: t.ownerType, ownerCategory: t.ownerCategory, owner: t.owner, ownerGroup: t.ownerGroup,
          _search: [t.name, creature ? creature.name : "", t.owner || "", t.ownerGroup || "", fg ? fg.name : "", itemNames.join(" ")].join(" ") };
      }).sort((a, b) => a.name.localeCompare(b.name));
      // creature-innate (has a creature) · item-only (no creature, not boss) · boss — three sections
      const creatureTraitRows = traitRows.filter(g => g.ownerType !== "boss" && g.creature);
      const itemOnlyTraitRows = traitRows.filter(g => g.ownerType !== "boss" && !g.creature);
      const bossTraitRows = traitRows.filter(g => g.ownerType === "boss")
        .sort((a, b) => (a.ownerCategory || "").localeCompare(b.ownerCategory || "") || a.name.localeCompare(b.name));
      const itemNameMeta = (g) => g.itemNames.length ? `<span class="anoint-spec-tag" title="Trait material${g.itemNames.length > 1 ? "s" : ""}">${esc(g.itemNames.join(", "))}</span>` : "";
      const creatureNameMeta = (g) => g.creature ? `<span class="anoint-spec-tag" title="Innate trait of ${esc(g.creature.name)}">${esc(g.creature.name)}</span>` : "";
      const matBox = (g) => { const it = g.items.find(i => i.icon); return it ? apxIcon(it.icon, "", ` title="${esc(g.itemNames.join(", "))}"`) : ""; };
      // creature/item-only trait: creature sprite stacked over the material icon (both large, far left)
      const traitRow = (g) => {
        const creaBox = g.creature ? apxBox(critFace(g.creature), "apx-clickable", ` data-action="apx-crea-open" data-cid="${g.creature.id}" title="${esc(g.creature.name)} — view creature"`) : "";
        return line(apxStack(creaBox, matBox(g)), g.name, itemNameMeta(g) + creatureNameMeta(g),
          (g.desc ? richText(g.desc) : ""), bkBtn("traits", g.id), { ek: "trait", eid: g.id }, availTagsHtml(g));
      };
      // boss-owned trait: material icon stacked over the boss sprite (Deity/False God) or an owner-name chip
      const bossTraitRow = (g) => {
        const spr = bossSpriteFor(g);
        const fg = falseGodFor(g);   // False God parts open a boss detail page from their portrait
        const bossBox = spr
          ? (fg ? apxBox(spriteImg(spr), "apx-boss apx-clickable", ` data-action="apx-fg-open" data-fg="${esc(fg.key)}" title="${esc(fg.name)} — view boss"`)
                : apxBox(spriteImg(spr), "apx-boss", ` title="${esc(g.owner || g.ownerGroup || "")}"`))
          : `<div class="apx-boss-name" title="${esc(g.ownerCategory || "Boss")}">${esc(g.owner || g.ownerGroup || "—")}</div>`;
        const meta = `<span class="anoint-spec-tag apx-boss-cat">${esc(g.ownerCategory || "Boss")}</span>${itemNameMeta(g)}`;
        return line(apxStack(bossBox, matBox(g)), g.name, meta, (g.desc ? richText(g.desc) : ""), bkBtn("traits", g.id), { ek: "trait", eid: g.id }, availTagsHtml(g));
      };
      // a name query also lists the matching taxonomy sub-categories (e.g. "Persist" → every Persist tag, whatever its
      // category), limited to tags that still have results under the active filters; tapping one adds it as a filter
      const tagHits = [];
      const seenHit = new Set();   // v2: a tag in several mechanic groups is listed once
      if (q) for (const [cat, vals] of appendixBrowseIndex(tags)) for (const v of vals)
        if (!tags.includes(v.key) && !seenHit.has(v.key)) { seenHit.add(v.key); tagHits.push({ ...v, cat: taxoCatName(v.key), val: taxoValName(v.key), name: taxoValName(v.key), _search: `${cat} ${v.val}` }); }
      tagHits.sort((a, b) => a.val.localeCompare(b.val) || a.cat.localeCompare(b.cat));
      const body_sections = [
        section("Tags", tagHits, v => `<button class="opt-row" data-action="appendix-tag" data-k="${esc(v.key)}"><span>${esc(v.cat)}: <b>${esc(v.val)}</b></span><span class="apx-val-n">${v.n}</span></button>`),
        section("Traits", creatureTraitRows, traitRow),
        section("Item-only Traits", itemOnlyTraitRows, traitRow),
        section("Boss Traits", bossTraitRows, bossTraitRow),
        section("Perks", res.perks, p => line(apxStack(apxIcon(SPEC_EMBLEM.get(p.spec), "apx-spec", ` title="${esc(p.spec)}"`), apxIcon(p.icon)), p.name,
          `<span class="anoint-spec-tag">${esc(p.spec)}</span>`, perkText(p.desc, p.ranks), bkBtn("perks", p.key), { ek: "perk", eid: p.key })),
        section("Spells", res.spells, s => line(apxStack(apxIcon(spellIcon(s))), s.name,
          `${s.cls ? `<span class="anoint-spec-tag">${esc(s.cls)}</span>` : ""}${spellMeta(s) ? `<span class="anoint-spec-tag">${esc(spellMeta(s))}</span>` : ""}`, perkText(s.desc, null), bkBtn("spells", s.id), { ek: "spell", eid: s.id }, availTagsHtml(s))),
        section("Relics", res.relics, r => line(apxStack(apxIcon(relicArt(r))), r.name,
          r.statBonus ? `<span class="anoint-spec-tag">${esc(r.statBonus)}</span>` : "", relicRanksHtml(r.ranks), null, { ek: "relic", eid: r.id })),
        section("Realm Cards", res.cards.map(c => ({ ...c, name: c.family })), c => line(apxStack(apxIcon(c.sprite)), c.family,
          c.cls ? `<span class="anoint-spec-tag">${esc(c.cls)}</span>` : "", cardTiersHtml(c.effects, c.tiers), null, { ek: "card", eid: c.id })),
      ].join("");
      const total = traitRows.length + res.perks.length + res.spells.length + res.relics.length + res.cards.length;
      placeholder = "Search by name or tag…";
      sub = `<div class="ovl-filterbar">${tagChips}
        <button class="facet add" data-action="appendix-add">＋ Filter</button>
        <span class="foot-info">${total} result${total === 1 ? "" : "s"}</span></div>`;
      body = body_sections || `<div class="slot-sub" style="padding:10px">Nothing matches${q ? ` “${esc(st.search.trim())}”` : " these filters"}.</div>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Taxonomy</h2>
        <input class="ovl-search" placeholder="${placeholder}" value="${esc(st.search)}" data-action="appendix-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        ${sub}
        <div class="ovl-center-scroll">${body}</div>
      </div></div>
      <div class="overlay-footer">${bkCount
          ? `<button class="btn-ghost${st.bkScope ? " on" : ""}" data-action="appendix-bkscope" data-scope="all" title="Show only bookmarked objects">★ ${bkCount} Bookmarked</button>`
          : `<span class="foot-info"></span>`}
        ${bkCount ? `<button class="btn-ghost tb-danger" data-action="appendix-clear-bk" title="Remove all ${bkCount} bookmark${bkCount === 1 ? "" : "s"}">Clear bookmarks</button>` : ""}
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Entity taxonomy detail — every taxonomy tag on a single trait / spell / perk / relic / card,
  // grouped by category with its provenance source. Reusable from the Appendix rows + trait banners. ──
  let PERK_BY_KEY = null;
  const perkByKey = (key) => {
    if (!PERK_BY_KEY) { PERK_BY_KEY = new Map(); for (const s of D.specs) for (const p of s.perks) if (!PERK_BY_KEY.has(p.key)) PERK_BY_KEY.set(p.key, p); }
    return PERK_BY_KEY.get(key);
  };
  // trait icon = its trait-item's icon (traits carry no icon of their own)
  const traitItemIcon = (tid) => { const items = traitSources().itemsByTrait.get(+tid) || []; return (items.find(i => i.icon) || {}).icon || null; };
  // relic ranks → one line per rank ("Rank 10 · …"), not an illegible " · "-joined block
  const relicRanksHtml = (ranks, detail) => (ranks || []).length
    ? `<div class="apx-ranklist">${ranks.map(r => `<div class="apx-rank"><span class="apx-rank-n">Rank ${r.rank}</span><span class="apx-rank-d">${richText(r.desc || "")}${detail ? fxClarify(r) : ""}</span></div>`).join("")}</div>`
    : "";
  // card effects → one line per tier, labelled by the card count that unlocks it (effects legitimately
  // repeat per tier — they stack, they're not duplicates); tiers[i] = cards needed for effects[i]
  const cardTiersHtml = (effects, tiers) => (effects || []).length
    ? `<div class="apx-tierlist">${effects.map((e, i) => { const n = tiers && tiers[i] != null ? tiers[i] : null;
        return `<div class="apx-tier"><span class="apx-tier-n">${n != null ? `${n} card${n === 1 ? "" : "s"}` : `Tier ${i + 1}`}</span><span class="apx-tier-d">${richText(e || "")}</span></div>`; }).join("")}</div>`
    : "";
  // resolve (kind,id) → { e, icon, name, descHtml, kindLabel } for the detail view
  function resolveEntity(kind, id) {
    if (kind === "trait") { const e = TRAIT[+id]; return { e, icon: traitItemIcon(id), name: e && e.name, descHtml: e && richText(e.desc || "") + fxClarify(e), kindLabel: "Trait" }; }
    if (kind === "spell") { const e = SPELL.get(+id); return { e, icon: e && spellIcon(e), name: e && e.name, descHtml: e && perkText(e.desc || "") + fxClarify(e), kindLabel: "Spell" }; }
    if (kind === "relic") { const e = RELIC.get(+id); return { e, icon: relicArt(e), name: e && e.name, descHtml: e && relicRanksHtml(e.ranks, true), kindLabel: "Relic" }; }
    if (kind === "card") { const e = CARD.get(+id); return { e, icon: e && e.sprite, name: e && e.family, descHtml: e && cardTiersHtml(e.effects, e.tiers), kindLabel: "Realm Card" }; }
    if (kind === "perk") { const e = perkByKey(id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && perkText(e.desc, e.ranks) + fxClarify(e), kindLabel: "Perk" }; }
    if (kind === "condition") { const e = CONDITION.get(id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && richText(e.desc || "") + fxClarify(e), kindLabel: e && e.cat }; }
    return { e: null };
  }
  // grouped taxonomy: Category → its values, each a chip that (a) shows the provenance source and
  // (b) jumps to the Appendix filtered by that tag
  // v2: one chip per tag entry, by category in layer order. The chip names the tag (trigger role as its readable label)
  // and its attributes: scope, source, phase (After is the default and stays unsaid), delivery (only No Event is said), markers.
  // Unverified = a split the code couldn't settle (every candidate kept; dashed).
  // Relic tags carry the rank whose code clause holds them (rk): the same tag on several ranks is one chip, "×N" when N ≥ 2.
  function entityTaxHtmlV2(e) {
    const groups = new Map(), seen = new Map();
    for (const x of e.taxo2 || []) {
      const id = [x.t, x.s, x.so, x.r, x.p, x.d, x.cf, x.co, x.cn, x.ig, (x.x || []).join(","), x.v].join("|");
      if (seen.has(id)) { if (x.rk != null) seen.get(id).n++; continue; }
      const y = { ...x, n: x.rk != null ? 1 : 0 }; seen.set(id, y);
      const cat = taxoCatName(x.t); if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(y);
    }
    if (!groups.size) return `<div class="slot-sub" style="padding:10px">No taxonomy tags on this entry.</div>`;
    const cats = [...groups.keys()].sort((a, b) => (TAXO_CAT_ORDER.get(a) ?? 99) - (TAXO_CAT_ORDER.get(b) ?? 99));
    return cats.map(cat => `<div class="etax-group">
      <div class="etax-cat">${esc(cat)}</div>
      <div class="etax-vals">${groups.get(cat).map(x => {
        const k = roleKey(x) || x.t, attrs = [x.s, x.so, x.p && x.p !== "After" ? x.p : null, x.d === "No Event" ? "No Event" : null,
          x.cf, x.co, x.cn, x.ig ? `Ignores ${x.ig}` : null, ...(x.x || [])].filter(Boolean);
        const unv = x.v === "unverified";
        return `<button class="etax-tag${unv ? " etax-unv" : ""}" data-action="etax-filter" data-k="${esc(k)}" title="${unv ? "Unverified: the game code hasn't settled this tag. " : ""}Filter the Taxonomy to “${esc(taxoValName(k))}”">${esc(taxoValName(k))}${x.n >= 2 ? `<span class="etax-mult">×${x.n}</span>` : ""}${attrs.length ? `<span class="etax-attr">${esc(attrs.join(" · "))}</span>` : ""}${FEATURES.taxoSource && x.v ? `<span class="apx-src s-${esc(x.v)}">${esc(x.v)}</span>` : ""}</button>`;
      }).join("")}</div>
    </div>`).join("");
  }
  // trait provenance sections for the detail page: the granting material (or "No Material Exists"),
  // where that item is obtained, and the innate owner (a clickable creature, or the boss + category).
  function traitDetailSections(e) {
    const items = traitSources().itemsByTrait.get(+e.id) || [];
    const names = [...new Set(items.map(i => i.name))];
    const material = names.length ? esc(names.join(", ")) : `<span class="apx-none">No Material Exists</span>`;
    const src = e.itemSource ? esc(e.itemSource) : `<span class="slot-sub">—</span>`;
    let ownerHtml, ownerCat = e.ownerType === "boss" ? "Boss owner" : "Creature owner";
    if (e.ownerType === "creature" && e.owner) {
      const c = CREA_BY_NAME.get(e.owner.toLowerCase());
      ownerHtml = c
        ? `<button class="apx-owner apx-clickable" data-action="apx-crea-open" data-cid="${c.id}" title="View creature"><span class="apx-owner-ico">${critFace(c)}</span><b>${esc(e.owner)}</b></button>`
        : `<b>${esc(e.owner)}</b>`;
    } else if (e.ownerType === "boss") {
      const spr = bossSpriteFor(e), fg = falseGodFor(e);
      const inner = `${spr ? `<span class="apx-owner-ico">${spriteImg(spr)}</span>` : ""}<b>${esc(e.owner || e.ownerGroup || "—")}</b><span class="anoint-spec-tag apx-boss-cat">${esc(e.ownerCategory || "Boss")}</span>`;
      ownerHtml = fg
        ? `<button class="apx-owner apx-clickable" data-action="apx-fg-open" data-fg="${esc(fg.key)}" title="View boss">${inner}</button>`
        : `<span class="apx-owner">${inner}</span>`;
    } else {
      ownerHtml = `<span class="slot-sub">Item-only (no innate owner)</span>`;
    }
    return `<div class="etax-group"><div class="etax-cat">Material</div><div class="apx-fact">${material}</div></div>
      <div class="etax-group"><div class="etax-cat">Item source</div><div class="apx-fact">${src}</div></div>
      <div class="etax-group"><div class="etax-cat">${ownerCat}</div><div class="apx-fact">${ownerHtml}</div></div>`;
  }
  function openEntityDetail(kind, id) {
    const ret = dovState;   // if we're already in a detail (e.g. creature detail), return to it on close
    if (ret) { const sc = DOV.querySelector(".ovl-center-scroll"); ret.scrollTop = sc ? sc.scrollTop : 0; }
    dovState = { kind: "entity-detail", ekind: kind, eid: id, ret, render: renderEntityDetail };
    openDetail(dovState.render());
  }
  function closeEntityDetail() {
    const ret = dovState && dovState.ret;
    if (ret) { dovState = ret; openDetail(dovState.render());
      const sc = DOV.querySelector(".ovl-center-scroll"); if (sc && ret.scrollTop) sc.scrollTop = ret.scrollTop; } else closeDetail();
  }
  function renderEntityDetail() {
    const st = dovState, r = resolveEntity(st.ekind, st.eid), e = r.e;
    if (!e) return `<div class="ovl-backdrop" data-action="entity-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Not found</h2><button class="ovl-close" data-action="close-entity">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="slot-sub" style="padding:16px">This entry could not be resolved.</div></div></div></div></div>`;
    const n = new Set((e.taxo2 || []).map(x => [x.t, x.s, x.so, x.r, x.p, x.d, x.v].join("|"))).size;   // one per chip
    return `<div class="ovl-backdrop" data-action="entity-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${r.icon ? `<span class="hdr-ico">${spriteImg(r.icon, "px")}</span>` : ""}
        <h2>${esc(r.name || "—")}</h2><span class="anoint-spec-tag">${esc(r.kindLabel)}</span>
        ${availTagsHtml(e)}
        <button class="ovl-close" data-action="close-entity">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        ${r.descHtml ? `<div class="perk-desc" style="margin-bottom:12px">${r.descHtml}</div>` : ""}
        ${st.ekind === "condition" && e.exclusive && e.exclusive.show ? `<div class="excl-note">${e.exclusive.icon ? spriteImg(e.exclusive.icon, "px") : ""}<span>Exclusive to <b>${esc(e.exclusive.source)}</b></span></div>` : ""}
        ${st.ekind === "perk" ? perkSpellRow((D.specs.find(x => x.perks.includes(e)) || {}).id, e, true) : ""}
        ${st.ekind === "trait" ? traitSpellRow(+st.eid, true) : ""}
        ${st.ekind === "relic" ? relicUltimateCard(e.id) : ""}
        ${st.ekind === "spell" ? spellRowWrap(usedSpellCards(e) + usedCondCards(e), true) + spellGrantedByHtml(e.id) : ""}
        ${st.ekind === "trait" ? `<div class="section-label">Source</div>${traitDetailSections(e)}` : ""}
        <div class="section-label">Taxonomy — ${n} tag${n === 1 ? "" : "s"}</div>
        ${entityTaxHtmlV2(e)}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-entity">Done</button></div>
    </div></div>`;
  }

  // ── Synergy — taxonomy tags shared across the build, in two views (Matrix / List). ──
  // Members = the spec, each equipped anointment, each creature (+ its artifact/nether traits
  // and equipped spell gems). Matrix = a grid of members (rows) × tags (columns); the bottom
  // row sums each TAG (how many members carry it — that's the synergy strength). List = the
  // same data grouped per shared tag, showing each contributing effect's description + owner.

  // an effect's tags: one key per v2 tag (a trigger with a role counts as its role key, e.g. "Takes Damage"); a relic counts
  // only the tags of ranks up to the equipped rank (rk; unranked relic tags count for the whole relic). Involves (the
  // umbrella theme view) stays out: it would double-count every effect under its themes.
  const synTags = (o, rank) => !o ? [] : [...new Set((o.taxo2 || []).filter(e => !e.t.startsWith("Involves::") && (rank == null || e.rk == null || e.rk <= rank)).map(e => roleKey(e) || e.t))];

  // matrix data: one entry per build MEMBER, each a CONTAINER of individual effects. Spec = 1 row of its
  // allocated perks; ALL anointments collapse into 1 row of the equipped anoints; each creature = 1 row of
  // its traits + equipped spell-gem spells. Every row is expandable to those effect sub-rows. The counted
  // unit is always the EFFECT, never the container: a creature's tags come from its TRAITS ("Brilliant
  // Creation"), not the creature name ("Animatus") — so a fused creature's two-parent traits each count 1,
  // and a spec stacking 11 "Attack" perks counts 11. That per-tag count is what the matrix sums/weights/sorts.
  function buildTagCarriers() {
    const members = [];   // {id, label, kind, sub, tags:Set, counts:Map<tag,n>, children:[{label,sub,tags:Set}]}
    const mk = (id, label, kind) => ({ id, label, kind, sub: null, tags: new Set(), counts: new Map(), children: [] });
    const bump = (m, k) => { m.tags.add(k); m.counts.set(k, (m.counts.get(k) || 0) + 1); };
    // add one effect (perk/anoint/trait/spell) to a member: it contributes +1 to each of its tags
    const addEffect = (m, label, o, sub, rank) => { const t = synTags(o, rank); if (!t.length) return; m.children.push({ label, sub, tags: new Set(t) }); for (const k of t) bump(m, k); };
    if (build.specId != null) {
      const s = SPEC.get(build.specId);
      if (s) { const m = mk("spec", s.label, "spec");
        for (const p of allocatedPerks(s)) addEffect(m, p.name, p);
        if (m.tags.size) members.push(m); }
    }
    const anoints = equippedAnointObjs();
    if (anoints.length) { const m = mk("anoints", "Anointments", "anoint");
      for (const a of anoints) addEffect(m, a.name, a, a.spec);
      if (m.tags.size) { m.sub = `${m.children.length} equipped`; members.push(m); } }
    build.slots.forEach((slot, i) => {
      const c = CREA.get(slot.cid); if (!c) return;
      const m = mk("crea" + i, c.name, "crea");
      // the creature is just the container; each TRAIT (innate/fusion/artifact/nether) and spell-gem spell
      // it carries is the counted effect — the creature's own name never contributes.
      for (const tid of slotTraitIds(slot)) { const tr = TRAIT[tid]; if (tr) addEffect(m, tr.name, tr, "trait"); }
      for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid); const sp = g ? gemSpell(g) : null; if (sp) addEffect(m, sp.name, sp, "spell gem"); }
      for (const g of grantedSpellList(slot)) addEffect(m, g.sp.name, g.sp, "granted spell");
      // relic (equipped per creature; Deprived ignores relics) + nether spell props
      const rel = slot.relic && !FX.ignores("relics") ? RELIC.get(slot.relic.id) : null;
      if (rel) addEffect(m, rel.name, rel, "relic", slot.relic.rank);
      for (const sp of slotNetherSpells(slot)) addEffect(m, sp.name, sp, "nether spell");
      if (m.tags.size) members.push(m);
    });
    return members;
  }
  // list data: one entry per individual EFFECT (perk / anoint / trait / spell) with its description
  function buildTagEffects() {
    const effects = [];   // {name, desc, tags:[], themes:[], owner, kind}
    const push = (name, desc, o, owner, kind, rank) => { const tags = synTags(o, rank); if (tags.length) effects.push({ name, desc, tags, themes: o.theme2 || [], owner, kind }); };
    if (build.specId != null) { const s = SPEC.get(build.specId); if (s) for (const p of allocatedPerks(s)) push(p.name, perkText(p.desc, perkRank(s, p)), p, s.label, "Perk"); }
    for (const a of equippedAnointObjs()) push(a.name, perkText(a.desc, a.ranks), a, a.spec || "Anointment", "Anointment");
    for (const slot of build.slots) {
      const c = CREA.get(slot.cid); if (!c) continue;
      for (const tid of slotTraitIds(slot)) { const tr = TRAIT[tid]; if (tr) push(tr.name, richText(tr.desc || ""), tr, c.name, "Trait"); }
      for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid); const sp = g ? gemSpell(g) : null; if (sp) push(sp.name, richText(sp.desc || ""), sp, c.name, "Spell"); }
      for (const g of grantedSpellList(slot)) push(g.sp.name, richText(g.sp.desc || ""), g.sp, c.name, "Spell");
      const rel = slot.relic && !FX.ignores("relics") ? RELIC.get(slot.relic.id) : null;
      if (rel) push(rel.name, rel.ranks.filter(r => r.rank <= slot.relic.rank).map(r => r.desc).join(" · "), rel, c.name, "Relic", slot.relic.rank);
      for (const sp of slotNetherSpells(slot)) push(sp.name, richText(sp.desc || ""), sp, c.name, "Spell");
    }
    return effects;
  }

  // ── Threats advisor — realm properties + False God runes to avoid for the detected build theme ──
  const THEMES = D.buildThemes || [];
  const themeLabel = (k) => { const t = THEMES.find(x => x.key === k); return t ? t.label : k; };
  // tally how many build effects touch each theme (v2 theme2; reuses the synergy effect gathering)
  function detectBuildThemes() {
    const w = {};
    for (const e of buildTagEffects()) {
      const set = new Set(e.themes);
      for (const t of THEMES) if (t.themes.some(th => set.has(th))) w[t.key] = (w[t.key] || 0) + 1;
    }
    return w;   // { attack: n, cast: n, ... }
  }
  // classes the party leans on (≥2 creatures) — used for the STRONGCLASS_* realm properties
  function heavyPartyClasses() {
    const cnt = {};
    for (const slot of build.slots) {
      const c = CREA.get(slot.cid); if (!c) continue;
      const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
      const cls = f ? (f.cls || c.cls) : c.cls;               // fusion adopts the secondary's class
      if (cls) cnt[cls] = (cnt[cls] || 0) + 1;
    }
    return Object.keys(cnt).filter(k => cnt[k] >= 2);
  }
  function activeThemes() {
    if (ovState.themeSel) return [ovState.themeSel];           // a specific theme chosen from the dropdown
    return detectedThemeKeys();                                // else auto-detected from the build
  }
  // modifiers (realm props + runes) that counter the active themes / leaned-on classes
  function threatCounters(active, heavy) {
    const out = [];
    for (const [source, list] of [["Realm", D.realmProps || []], ["Rune", D.runes || []]]) {
      for (const m of list) {
        const hitThemes = (m.counters || []).filter(c => active.includes(c));
        const hitClass = m.counterClass && heavy.includes(m.counterClass) ? m.counterClass : null;
        if (hitThemes.length || hitClass) out.push({ ...m, source, hitThemes, hitClass });
      }
    }
    return out.sort((a, b) => (b.hitThemes.length + (b.hitClass ? 1 : 0)) - (a.hitThemes.length + (a.hitClass ? 1 : 0)) || a.name.localeCompare(b.name));
  }
  function openThreats() {
    ovState = { kind: "threats", themeSel: null, showGeneral: false,
      srcView: "realm", weights: detectBuildThemes(), render: renderThreats };   // themeSel null = auto-detected · "realm" = Realm Props / "fgod" = runes
    openOverlay(ovState.render());
  }
  // the auto-detected theme keys (≥2 effects; else the single strongest), for the "Auto" dropdown label
  function detectedThemeKeys() {
    const w = ovState.weights || {};
    let d = Object.keys(w).filter(k => w[k] >= 2);
    if (!d.length) { const top = Object.entries(w).sort((a, b) => b[1] - a[1])[0]; if (top) d = [top[0]]; }
    return d;
  }
  function threatRow(m) {
    const chips = [
      ...m.hitThemes.map(t => `<span class="thr-chip">${esc(themeLabel(t))}</span>`),
      ...(m.hitClass ? [`<span class="thr-chip cls">${esc(m.hitClass[0].toUpperCase() + m.hitClass.slice(1))}</span>`] : []),
      ...(m.visibleOnly ? [`<span class="thr-chip">Visible only</span>`] : []),
    ].join("");
    // same row layout as the Glossary: large icon column + name/effect body (perk-line / apx-iconcol)
    return `<div class="perk-line">
      <div class="apx-iconcol">${m.icon ? `<div class="apx-crea">${spriteImg(m.icon, "px")}</div>` : ""}</div>
      <div class="perk-line-body"><div class="perk-line-head"><b>${richText(m.name)}</b>${m.rewardPct != null ? `<span class="thr-reward">+${m.rewardPct}% Rewards</span>` : ""}</div>
        ${m.effect && m.effect !== m.name ? `<div class="perk-desc">${richText(m.effect)}</div>` : ""}
        ${chips ? `<div class="perk-line-meta">${chips}</div>` : ""}</div></div>`;
  }
  function renderThreats() {
    const st = ovState, w = st.weights, heavy = heavyPartyClasses(), active = activeThemes();
    // theme selector — a single dropdown (Auto-detected, or explore one theme) replaces the chip toggles
    const det = detectedThemeKeys();
    const themeSelect = `<select class="app-select" data-action="threat-navsel">
      <option value=""${st.themeSel ? "" : " selected"}>Auto</option>
      ${THEMES.map(t => `<option value="${t.key}"${st.themeSel === t.key ? " selected" : ""}>${esc(t.label)}${(w[t.key] || 0) > 0 ? ` · ${w[t.key]} in build` : ""}</option>`).join("")}
    </select>`;
    // source toggle: Realm Props (source "Realm") ⇆ False God runes (source "Rune")
    const srcView = st.srcView === "fgod" ? "fgod" : "realm";
    const wantSrc = srcView === "fgod" ? "Rune" : "Realm";
    const srcToggle = `<div class="art-view-toggle">
      <button class="av-tab ${srcView === "realm" ? "on" : ""}" data-action="threat-src" data-v="realm">Realm Properties</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${srcView === "fgod" ? "on" : ""}" data-action="threat-src" data-v="fgod">False God Runes</button></div>`;
    const counters = (active.length || heavy.length ? threatCounters(active, heavy) : []).filter(m => m.source === wantSrc);
    const general = [...(D.realmProps || []).map(m => ({ ...m, source: "Realm" })),
                     ...(D.runes || []).map(m => ({ ...m, source: "Rune" }))]
                    .filter(m => m.general && m.source === wantSrc).sort((a, b) => a.name.localeCompare(b.name));
    const srcLabel = srcView === "fgod" ? "False God runes" : "realm properties";
    const countersBody = active.length
      ? (counters.length ? counters.map(threatRow).join("")
          : `<div class="slot-sub" style="padding:10px">No ${srcLabel} directly counter ${active.map(themeLabel).join(", ")}. Watch the general list below.</div>`)
      : `<div class="slot-sub" style="padding:10px">Build a party (creatures + perks) to detect a theme, or pick one above to explore what would counter it.</div>`;
    const genRows = general.map(m => threatRow({ ...m, hitThemes: [], hitClass: null })).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>RI/Runes</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="thr-themebar">${themeSelect}</div>
        ${srcToggle}
        <div class="section-label">Counters your build</div>
        <div class="perk-list">${countersBody}</div>
        <button class="thr-genhead ${st.showGeneral ? "open" : ""}" data-action="threat-general">${st.showGeneral ? "▾" : "▸"} Generally punishing <span class="thr-w">${general.length}</span></button>
        ${st.showGeneral ? `<div class="perk-list">${genRows}</div>` : ""}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Shops — ONE overlay, 4-way toggle (God / Guild / Arena / Tavern) rotates the grid. Data = D.shops (code-grounded
  // scr_<X>ShopSetup stock, icons/links joined at build). God & Guild show a tile grid of gods/guilds → that shop's
  // items; Arena & Tavern show their items directly. Items are grouped by type. ──
  const SHOP_TYPE_ORDER = ["Creature Mana", "Trait Item", "Inscription", "Crafting Material", "Project Item", "Skin",
    "Decoration", "Background", "Wall", "Floor", "Music"];
  const shopTab = (k) => (D.shops || []).find(s => s.key === k);
  function openShops(tab, groupKey) {
    ovState = { kind: "shops", tab: tab || "god", sel: groupKey || null, search: "", collapsed: new Set(), render: renderShops };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function shopToggle(tab) {
    return `<div class="art-view-toggle">${(D.shops || []).map((s, i) =>
      `${i ? `<span class="av-pipe">|</span>` : ""}<button class="av-tab ${tab === s.key ? "on" : ""}" data-action="shop-tab" data-v="${s.key}">${esc(s.label)}</button>`).join("")}</div>`;
  }
  function shopItemIcon(it) {
    if (it.kind === "creature") { const c = CREA.get(it.cid); if (c) return `<span class="gs-item-ico">${critFace(c)}</span>`; }
    if (it.kind === "spell") { const ic = spellIcon(SPELL.get(it.spellId)); if (ic) return `<span class="gs-item-ico">${spriteImg(ic, "px")}</span>`; }
    if (it.icon) return `<span class="gs-item-ico">${spriteImg(it.icon, "px")}</span>`;
    return `<span class="gs-item-ico empty"></span>`;
  }
  function shopItemOpen(it) {
    if (it.kind === "creature" && it.cid != null) return ` data-action="apx-crea-open" data-cid="${it.cid}"`;
    if (it.kind === "spell" && it.spellId != null) return ` data-action="apx-open" data-ek="spell" data-eid="${it.spellId}"`;
    if (it.kind === "trait_item" && it.traitId != null) return ` data-action="apx-open" data-ek="trait" data-eid="${it.traitId}"`;
    return "";
  }
  function shopItemsHtml(items, shop, group) {
    const st = ovState, q = st.search.trim().toLowerCase();
    const cur = (group && group.currency) || shop.currency || "", curIco = (group && group.currencyIcon) || shop.currencyIcon || null;
    const byType = new Map();
    for (const it of items) {
      if (q && !(it.name || "").toLowerCase().includes(q) && !(it.type || "").toLowerCase().includes(q)) continue;
      const t = it.type || "Item"; (byType.get(t) || byType.set(t, []).get(t)).push(it);
    }
    const rankOf = (t) => { const i = SHOP_TYPE_ORDER.indexOf(t); return i < 0 ? 99 : i; };
    const order = [...byType.keys()].sort((x, y) => rankOf(x) - rankOf(y));
    const parts = order.map(t => {
      const open = q || !st.collapsed.has(t), list = byType.get(t);
      const rows = open ? list.map(it => {
        const go = shopItemOpen(it), tr = it.kind === "trait_item" && it.traitId != null && D.traits[it.traitId];
        const nmTitle = it.nameSrc ? ` title="Not statically resolvable in code — name from the God Shop reference"` : "";
        return `<div class="perk-line gs-line${go ? " apx-clickable" : ""}"${go}>${shopItemIcon(it)}
          <div class="perk-line-body"><div class="perk-line-head"><b${nmTitle}>${esc(shopItemName(it))}</b>
            <span class="perk-line-meta">${it.rank != null ? `<span class="anoint-spec-tag" title="Guild Reputation rank">Rank ${it.rank}</span>` : ""}${it.favorRank != null ? `<span class="anoint-spec-tag" title="Favor Rank required">Rank ${it.favorRank}</span>` : ""}${it.price != null ? `<span class="gs-price"${cur ? ` title="${esc(cur)}"` : ""}>${it.price}${curIco ? `<span class="gs-cur-ico">${spriteImg(curIco, "px")}</span>` : cur ? ` <span class="gs-cur">${esc(cur)}</span>` : ""}</span>` : ""}</span></div>
            ${tr ? `<div class="perk-desc">${esc(tr.name)}</div>` : ""}</div></div>`;
      }).join("") : "";
      return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="shop-sec" data-c="${esc(t)}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(t)}</button>${rows}`;
    });
    return parts.join("") || `<div class="slot-sub" style="padding:10px">No items match.</div>`;
  }
  function renderShops() {
    const st = ovState, shop = shopTab(st.tab) || (D.shops || [])[0];
    const q = st.search.trim().toLowerCase();
    const group = shop.groups && st.sel ? shop.groups.find(g => g.key === st.sel) : null;
    let header, body;
    if (shop.groups && !group) {
      const list = shop.groups.filter(g => !q || g.name.toLowerCase().includes(q) || g.items.some(it => (it.name || "").toLowerCase().includes(q)));
      const tiles = list.map(g => `<div class="pick-tile" data-action="shop-pick" data-k="${esc(g.key)}">
        <div class="pt-sprite">${g.img ? spriteImg(g.img, "px") : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="pt-name">${esc(g.name)}</div></div>`).join("") || `<div class="slot-sub" style="padding:10px">Nothing matches.</div>`;
      header = `<h2>Shops</h2>`;
      body = `${shopToggle(shop.key)}<div class="ovl-center-scroll"><div class="pick-grid gs-grid${shop.key === "guild" ? " guild-grid" : ""}">${tiles}</div></div>`;
    } else if (group) {
      header = `<button class="btn-ghost" data-action="shop-back">‹ ${esc(shop.label)}</button><h2 style="flex:1">${esc(group.name)}</h2>`;
      body = `${shopToggle(shop.key)}<div class="gs-detail-head">${group.img ? `<div class="gs-god-sprite">${spriteImg(group.img, "px")}</div>` : ""}<div class="gs-god-name">${esc(group.name)}</div>${group.currency ? `<div class="slot-sub gs-cur-line">${group.currencyIcon ? `<span class="gs-cur-ico">${spriteImg(group.currencyIcon, "px")}</span>` : ""}${esc(group.currency)}</div>` : ""}</div>
        <div class="ovl-center-scroll"><div class="perk-list">${shopItemsHtml(group.items, shop, group)}</div></div>`;
    } else {
      header = `<h2>Shops</h2>`;
      body = `${shopToggle(shop.key)}${shop.currency ? `<div class="slot-sub gs-cur-line">${shop.currencyIcon ? `<span class="gs-cur-ico">${spriteImg(shop.currencyIcon, "px")}</span>` : ""}${esc(shop.currency)}</div>` : ""}<div class="ovl-center-scroll"><div class="perk-list">${shopItemsHtml(shop.items, shop, null)}</div></div>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header">${header}
        <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="shop-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">${body}</div></div>
      <div class="overlay-footer">${group ? `<button class="btn-ghost" data-action="shop-back">‹ Back</button>` : `<span class="foot-info"></span>`}<button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Riddle Dwarf — fast trivia lookup (Class of Spell/Creature · Ruler of Realm · Realm of Ruler).
  // One screen: type the name you're given, the answer surfaces instantly. No menu navigation. ──
  function openRiddle() {
    ovState = { kind: "riddle", search: "", render: renderRiddle };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderRiddle() {
    // normalize away punctuation so a query missing it still hits — e.g. "tmer" → T'mere M'rgo
    const nrm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const st = ovState, q = nrm(st.search).trim(), CAP = 12;
    const rank = (name) => nrm(name).startsWith(q) ? 0 : 1;   // exact-prefix hits first
    const clsAns = (cls) => `<span class="riddle-a" style="color:${clsColor(cls)}">${D.classIcons && D.classIcons[cls] ? spriteImg(D.classIcons[cls], "px") : ""}${esc(cls || "—")}</span>`;
    const row = (name, ans) => `<div class="riddle-row"><span class="riddle-q">${esc(name)}</span>${ans}</div>`;
    const section = (title, items) => items.length ? `<div class="section-label">${title}</div><div class="riddle-list">${items.join("")}</div>` : "";
    let body;
    if (q.length < 2) {
      body = `<div class="riddle-hint">The Riddle Dwarf gives you a name — type it to reveal the answer:
        <ul><li><b>Ruler of</b> a realm</li><li><b>Realm of</b> a ruler (god)</li><li><b>Class of</b> a creature or spell</li></ul></div>`;
    } else {
      const byName = (k) => (a, b) => rank(a[k]) - rank(b[k]) || a[k].localeCompare(b[k]);
      const spells = D.spells.filter(s => nrm(s.name).includes(q)).sort(byName("name")).slice(0, CAP).map(s => row(s.name, clsAns(s.cls)));
      // Avatars (gods) are only ever asked about their REALM, never their class → exclude them from class lookups
      const creatures = D.creatures.filter(c => !isAvatar(c) && nrm(c.name).includes(q)).sort(byName("name")).slice(0, CAP).map(c => row(c.name, clsAns(c.cls)));
      const realms = D.realms.filter(r => nrm(r.realm).includes(q)).sort(byName("realm")).map(r => row(r.realm, `<span class="riddle-a">${esc(r.godName)}</span>`));
      const gods = D.realms.filter(r => nrm(r.godName).includes(q) || nrm(r.god).includes(q)).sort(byName("godName")).map(r => row(r.godName, `<span class="riddle-a">${esc(r.realm)}</span>`));
      body = section("Ruler of Realm", realms) + section("Realm of Ruler", gods) + section("Class of Creature", creatures) + section("Class of Spell", spells)
        || `<div class="slot-sub" style="padding:10px">No spell, creature, realm or god matches “${esc(st.search)}”.</div>`;
    }
    // compact popover anchored top-right — no full overlay, click-outside to close
    return `<div class="ovl-backdrop riddle-backdrop" data-action="backdrop"><div class="overlay-panel riddle-pop">
      <div class="riddle-pop-head">
        <span class="riddle-pop-title">Riddle Dwarf</span>
        <input class="ovl-search" placeholder="spell / creature / realm / god…" value="${esc(st.search)}" data-action="riddle-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="riddle-pop-body">${body}</div>
    </div></div>`;
  }

  // ── Appendix page (internal ids say "errata", its old name) — code-grounded mechanics the game doesn't show, plus the Status Effects
  // reference. The Effect Order page (user 2026-10-22: its own page, same layout) is the same overlay with page "order": the
  // effect-order rules, resurrection order, start of battle and every effect-order section.
  function openErrata(page = "appendix") {
    ovState = { kind: "errata", page, search: "", collapsed: new Set(["StatusEffects", "EffectOrderRules", "Resurrection", "StartOfBattle", ...(D.effectOrder || []).map(s => "EO:" + s.key), "ClassAdv", "RandomTargets", "NetherDrops", "PandShrine", "RealmBonusMax", "Masters"]), ndDiff: "normal", render: renderErrata };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderErrata() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const order = st.page === "order";
    const body = (order
      ? eoRulesSection(st, q) + resOrderSection(st, q) + sobSection(st, q) + (D.effectOrder || []).map(s => effectOrderSection(st, q, s)).join("")
      : statusSection(st, q) + classAdvSection(st, q) + randomTargetSection(st, q) + netherDropSection(st, q) + pandShrineSection(st, q) + realmBonusSection(st, q) + mastersSection(st, q))
      || `<div class="slot-sub" style="padding:10px">Nothing matches “${esc(st.search)}”.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>${order ? "Effect Order" : "Appendix"}</h2>
        <input class="ovl-search" placeholder="${order ? "Search effects / steps…" : "Search status effects / spells / realms…"}" value="${esc(st.search)}" data-action="errata-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }
  const GLOSSARY_CATS = ["Buff", "Debuff", "Minion"];
  // ── Resurrection order — bc_OnDeath, in execution order (_su_extract code/REVIVE_CHAIN_FINDINGS.md).
  // "rule": Somnus — not a resurrection source here; its own rule blocks every other resurrection (pinned, unnumbered).
  // "free": checked before the chain, outside the one-per-death rule (neither checks nor blocks it).
  // "stop": checked before the chain; if it fires, the chain is skipped. "chain": one per death — the first that fires
  // resurrects, the rest are skipped. Only actual resurrection sources are listed (Breath of Death excluded: its gate
  // is unresolved and its text resurrects nothing — _su_extract archive/handoffs/HANDOFF_resurrection_open_questions.md). Refs: perk = name, trait = code runtime id, relic = name fragment + app rank (10–100 = extract perk 1–10),
  // cond = glossary key, realm = realm-property key (matched by text: the only realm property that resurrects).
  // Code order (user ruling 2026-10-18): resurrection rows follow the bc_OnDeath call order 1–50, with the "cannot be
  // resurrected" blockers inserted where the code checks them (_su_extract data/model/resurrection_blocks.json `order`).
  // Row shapes: ["head", label] · [group, kind, ref, rank] (a resurrection) · ["block", kind, ref, desc] (unnumbered)
  // · ["qblock", kind, ref, desc] (numbered by the queue check order) · ["note", text].
  // Resurrection groups — "rule": Somnus, not a resurrection source here; its own rule blocks every other resurrection.
  // "free": outside the one-per-death rule. "stop": if it fires, the chain is skipped. "chain": one per death — the
  // first that fires resurrects, the rest are skipped. Refs: perk = name, trait = code runtime id, relic = name fragment
  // + app rank, cond = glossary key, realm = realm-property key, spell = name, null kind = plain text (no app record).
  // Breath of Death excluded (resurrects nothing); "Who Am I?" (call 46, runtime 1231) suppressed: nothing grants it.
  const RES_ORDER = [
    ["head", "Before the on-death checks"],
    ["block", "spell", "Disintegrating Arrow", "If the arrow's own damage kills the target, it can't be resurrected for the rest of the battle."],
    ["block", null, "Death By Boredom", "When Jotun or Lister falls, the remaining parts are killed and can't be resurrected."],
    ["head", "On death, in order"],
    ["rule", "perk", "Somnus"],
    ["block", "perk", "Epigraphy", "A creature killed by a Relic can't be resurrected for the rest of the battle."],
    // Angry Army (Imp Impington, enemy-side) is the resurrect in the slot first read as Breath of Death (extract answer 1)
    ["stop", "trait", 678], ["chain", "perk", "Born Again"], ["free", "trait", 1335],
    ["block", "trait", 640, "Outside boss battles: when a creature dies and the other side has this trait, the rest of the on-death checks are skipped, every row below included."],
    ["block", "trait", 2176, "A creature whose Mania damage exceeds its max Health can't be resurrected when the other side has this trait."],
    ["block", "trait", 2117, "A creature that dies while Feared can't be resurrected when the other side has this trait."],
    ["block", "perk", "Burn Their Corpses", "An enemy that dies while Burned can't be resurrected."],
    ["block", "perk", "Endwalker", "An enemy that dies while Blighted can't be resurrected."],
    ["free", "trait", 769], ["stop", "realm", "RESURRECT"], ["free", "trait", 1260], ["free", "trait", 1178], ["free", "trait", 891],
    ["free", "trait", 372], ["free", "trait", 188], ["chain", "trait", 839], ["stop", "perk", "Slam Shut"],
    ["chain", "trait", 1888], ["chain", "trait", 1927],
    ["chain", "trait", 1851], ["chain", "trait", 1993], ["chain", "relic", "Genaros", 100], ["chain", "trait", 1773],
    ["chain", "trait", 1715], ["chain", "trait", 1432], ["chain", "trait", 1461], ["chain", "perk", "Forbidden Magic"],
    ["chain", "relic", "Vulcanar", 100], ["chain", "trait", 1658], ["chain", "perk", "Bleed Out"], ["chain", "cond", "Buff:rebirth"],
    ["chain", "trait", 1286], ["chain", "trait", 2021], ["chain", "perk", "Martyr"], ["chain", "perk", "Soul Rending"],
    ["chain", "trait", 1587], ["chain", "perk", "New Moon"], ["chain", "perk", "From Ashes"], ["chain", "perk", "Gravewalker"],
    ["chain", "cond", "Minion:guardianofsurathli"], ["chain", "relic", "Surathli", 80], ["chain", "perk", "Feign Death"],
    ["chain", "trait", 354], ["chain", "trait", 331], ["chain", "trait", 97], ["chain", "trait", 486], ["chain", "trait", 454],
    ["chain", "trait", 187], ["chain", "trait", 189],
    // Kraynaks' three "None Of Your Business" variants (calls 47–49) shown as one row
    ["chain", "trait", 1345], ["chain", "trait", 1297],
    ["note", "Resurrections from elsewhere skip the rows above but still pass the checks below: resurrection spells, Terminus, Ever Upwards, Defy the Gods, Rescue Ride, Gambler's Fallacy, Dark Clarity, Repetitive Holiday, Bloodletting, Reinvigoration, Glaive of Prayer, Endless Swarm, Amongst Gods, Memento Vivere, Grayscale, The King Is Dead, Mass Resurrection, Secret Recipe, Revelation, Undying Exaltation, Dying Stars, Helping Hand, Live to Serve and Amalgam rank 30. Terminus, Defy the Gods, Reincarnation and Genesis set up their resurrection while the creature is still alive, so a \"can't be resurrected\" death doesn't stop it the first time. Every resurrection that happens fires the \"after a creature is resurrected\" effects."],
    ["head", "Checked whenever a resurrection is queued"],
    ["qblock", null, "False God battles", "Enemies in False God battles, and Vulcanar with Ultimate Ember, skip the resurrection limit, Scant Stamina, the \"can't be resurrected\" mark, Nightcap and Lay to Rest."],
    ["qblock", null, "Lister", "An enemy Lister is never resurrected."],
    ["qblock", null, "Jotun", "Jotun's parts are never resurrected."],
    ["qblock", "trait", 1973, "If an enemy has it, none of your creatures can be resurrected."],
    ["qblock", null, "Resurrection limit", "Each creature resurrects at most 10 times per battle (15 with the Phoenix card set's 3rd power, 5 fewer in Calm Mode)."],
    ["qblock", "trait", 1151, "A creature that has already resurrected can't again when the other side has this trait."],
    ["qblock", null, "Can't be resurrected", "Refuses every creature marked at its death by the blockers above (\"Prevented!\")."],
    ["qblock", "perk", "Nightcap", "An enemy hit by Booze spells 3 or more times can't be resurrected."],
    ["qblock", "perk", "Lay to Rest", "An enemy that has already resurrected can't again."],
    ["qblock", null, "Maximum Resurrections", "Realm property: your creatures stop resurrecting at the realm's limit."],
    ["qblock", "perk", "Somnus", "Graveborn: nothing but Somnus resurrects your creatures (not in the Arena)."],
  ];
  const specIco = (spec) => { const em = SPEC_EMBLEM.get(spec.label); return em ? { h: spriteImg(em, "px"), cls: "apx-spec", title: spec.label } : ""; };
  const icoBox = (ic) => typeof ic === "string" ? `<div class="apx-crea">${ic}</div>` : `<div class="apx-crea ${ic.cls || ""}"${ic.title ? ` title="${esc(ic.title)}"` : ""}>${ic.h}</div>`;
  let RES_ROWS = null;
  function resOrderRows() {
    if (RES_ROWS) return RES_ROWS;
    const perkBy = new Map(); for (const sp of D.specs) for (const p of sp.perks) if (!perkBy.has(p.name)) perkBy.set(p.name, { p, spec: sp });
    const traitByRt = new Map(); for (const t of Object.values(D.traits)) for (const r of t.runtimeIds || []) traitByRt.set(r, t);
    const { creatureByTrait, itemsByTrait } = traitSources();
    // 4th field: relic rank (app scale). enemy = only enemies can have it: a boss trait with no creature/item source,
    // or a realm property (enemies only).
    let qn = 0;
    RES_ROWS = RES_ORDER.map(([group, kind, ref, rank]) => {
      if (group === "head" || group === "note") return { group, name: kind, desc: "", icons: [], chips: [] };
      let r = null;
      const blk = group === "block" || group === "qblock";
      if (blk && kind === null) r = { name: ref, icons: [], chips: [] };
      else if (blk && kind === "spell") { const sp = (D.spells || []).find(x => x.name === ref);
        if (sp) r = { name: sp.name, icons: [spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""], chips: [], open: { ek: "spell", eid: sp.id } }; }
      // icons: up to two boxes like the Appendix (creature / boss sprite over the trait material); chips: source names
      // only (no "Trait ·" / "Perk ·" prefix) — prose labels stay where there's no named source (Buff, Minion, Realm Property)
      if (kind === "perk") { const h = perkBy.get(ref); if (h) r = { name: h.p.name, desc: h.p.desc, icons: [specIco(h.spec), h.p.icon && spriteImg(h.p.icon, "px")], chips: [h.spec.label] }; }
      else if (kind === "trait") { const t = traitByRt.get(ref); if (t) {
        const c = creatureByTrait.get(t.id), boss = bossSpriteFor(t), its = itemsByTrait.get(t.id) || [], it = its.find(x => x.icon);
        r = { name: t.name, desc: t.desc, icons: [c ? critFace(c) : boss ? spriteImg(boss) : "", it ? spriteImg(it.icon, "px") : ""],
          enemy: t.ownerType === "boss" && !c && !it,
          chips: [c ? c.name : t.owner || "", ...new Set(its.map(x => x.name))], open: { ek: "trait", eid: t.id }, spells: traitSpellRow(t.id) }; } }
      else if (kind === "relic") { const rl = D.relics.find(x => x.name.includes(ref)), rk = rl && rl.ranks.find(x => x.rank === rank);
        if (rl && rk) r = { name: rl.name.split(",")[0], desc: rk.desc, icons: [spriteImg(relicArt(rl), "px")], chips: [rl.name.split(",")[1].trim(), `Rank ${rank}`] }; }
      else if (kind === "cond") { const c = (D.conditions || []).find(x => `${x.cat}:${x.key}` === ref);
        if (c) r = { name: c.name, desc: c.desc, icons: [c.icon ? `<img src="${esc(c.icon)}" alt="">` : ""], chips: [c.cat], open: { ek: "condition", eid: ref } }; }
      else if (kind === "realm") { const rp = (D.realmProps || []).find(x => x.key === ref);
        if (rp) r = { name: rp.name, desc: rp.effect, icons: [spriteImg(rp.icon, "px")], chips: ["Realm Property"], enemy: true }; }
      if (!r) { console.error("RESURRECTION ORDER: unresolved", kind, ref); r = { name: String(ref), desc: "", icons: [], chips: [kind] }; }
      if (blk) { r.desc = rank; r.blocker = true; r.icons = r.icons.slice(0, 1); r.chips = []; r.enemy = false; if (group === "qblock") r.qn = ++qn; }
      r.icons = r.icons.filter(Boolean); r.chips = r.chips.filter(Boolean);
      // Angry Army's resurrect isn't in its in-game text (bc_OnDeath only: once per creature, full Health, "(HA! HA! HA!)")
      if (kind === "trait" && ref === 1335) r.note = "Not in the trait text: each enemy creature with Angry Army also resurrects once, at 100% Health.";
      return { group, ...r };
    });
    let n = 0; for (const r of RES_ROWS) if (["free", "stop", "chain"].includes(r.group)) r.n = ++n;   // resurrections only
    return RES_ROWS;
  }
  // ── Status Effects (Appendix section; internal ids say "gloss", its old page name) — Buff / Debuff / Minion reference
  // (name + prose + in-game status glyph), one collapsible sub-group per type (closed by default, all open while searching).
  function statusSection(st, q) {
    const list = (D.conditions || []).filter(e => !q || e.name.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q));
    if (!list.length) return "";
    const key = "StatusEffects", open = q ? true : !st.collapsed.has(key);
    // exclusivity glyph stacked below the status icon: minions summoned by only one spec/spell/creature
    // carry that source's emblem (spec emblem, creature sprite, or class gem). `show:false` keeps the
    // record but withholds the badge (Guardian of Surathli — no emblem art yet).
    const exclBox = (e) => (e.exclusive && e.exclusive.show && e.exclusive.icon)
      ? `<div class="apx-crea apx-excl" title="Exclusive to ${esc(e.exclusive.source)}">${spriteImg(e.exclusive.icon, "px")}</div>`
      : "";
    const body = open ? GLOSSARY_CATS.map(c => {
      const items = list.filter(e => e.cat === c);
      if (!items.length) return "";
      const sk = "Status:" + c, sopen = q ? true : st.sobOpen && st.sobOpen.has(sk);
      const rows = sopen ? `<div class="perk-list">${items.map(e => `<div class="perk-line apx-clickable" data-action="apx-open" data-ek="condition" data-eid="${esc(e.cat + ':' + e.key)}" title="View taxonomy">
        <div class="apx-iconcol">${e.icon ? `<div class="apx-crea"><img src="${esc(e.icon)}" alt=""></div>` : ""}${exclBox(e)}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(e.name)}</b></div><div class="perk-desc">${esc(e.desc)}</div></div></div>`).join("")}</div>` : "";
      return `<button class="sob-step${sopen ? " open" : ""}" data-action="sob-step" data-k="${sk}"><span class="apx-sec-caret">${sopen ? "▾" : "▸"}</span>${esc(c)}s</button>${rows}`;
    }).join("") : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Status Effects</button>${body}`;
  }

  // ── Start-of-battle order (D.startOfBattle, built from _su_extract START_OF_BATTLE_FINDINGS.md). One collapsible group per
  // step, titled with the in-game codex wording; rows numbered in execution order across the whole sequence.
  const SOB_STEPS = [["0a", "Battle setup"], ["0b", "Always-on effects applied"], ["0c", "Just before traits"],
    ["1a", "Traits are granted, then shared"], ["1b", "Classes and races are changed"], ["1c", "Trait sharing by class / race"],
    ["2", "Spell Gems are granted"], ["3", "Buffs, debuffs and minions are granted"], ["4", "Stats are increased"], ["5", "Stats are decreased"],
    ["6", "The battle starts"], ["7", "Creatures attack"], ["8", "Creatures cast spells"], ["9", "After all start-of-battle effects"]];
  let SOB_ROWS = null;
  function sobRows() {
    if (SOB_ROWS) return SOB_ROWS;
    const perkBy = new Map(); for (const sp of D.specs) for (const p of sp.perks) if (!perkBy.has(p.name)) perkBy.set(p.name, { p, spec: sp });
    const { creatureByTrait, itemsByTrait } = traitSources();
    SOB_ROWS = (D.startOfBattle || []).map((e, i) => {
      const ref = e.ref; let r = null;
      if (ref.k === "text") r = { name: ref.name, desc: ref.desc, icons: [ref.icon && spriteImg(ref.icon, "px")], chips: [ref.chip] };   // real source with no app record
      else if (ref.k === "always") r = { name: e.name, members: ref.members, icons: [], chips: [],
        desc: "Every “always” and “while” effect is applied here, after setup and before any trait is granted, so it doesn't yet see what the steps below change. After this it's re-checked on a timer (about every 40 frames), only in the gaps between steps, never in the middle of one; whether a re-check lands between two particular steps depends on timing. The first re-check after step 6 brings everything up to date before the first turn, but stats already granted in steps 1–5 stay as they were granted.",
        note: "The timeline here is still the one set during setup (step 0a), so Ancient DNA copies the race of last battle's leader, and Master of Maniacs counts that race in step 4. Speed changes made between battles reach the start of battle one battle later." };
      else if (ref.k === "trait") { const t = D.traits[ref.id]; if (t) {
        const c = creatureByTrait.get(t.id), boss = bossSpriteFor(t), its = itemsByTrait.get(t.id) || [], it = its.find(x => x.icon);
        r = { name: t.name, desc: t.desc, icons: [c ? critFace(c) : boss ? spriteImg(boss) : "", it ? spriteImg(it.icon, "px") : ""],
          chips: [c ? c.name : t.owner || "", ...new Set(its.map(x => x.name))], open: { ek: "trait", eid: t.id }, spells: traitSpellRow(t.id) }; } }
      else if (ref.k === "perk") { const h = perkBy.get(ref.name); if (h) r = { name: h.p.name, desc: h.p.desc, icons: [specIco(h.spec), h.p.icon && spriteImg(h.p.icon, "px")], chips: [h.spec.label], spells: perkSpellRow(h.spec.id, h.p) }; }
      else if (ref.k === "relic") { const rl = D.relics.find(x => x.id === ref.id), rk = rl && rl.ranks.find(x => x.rank === ref.rank);
        if (rl && rk) r = { name: rl.name.split(",")[0], desc: rk.desc, icons: [spriteImg(relicArt(rl), "px")], chips: [(rl.name.split(",")[1] || "").trim(), `Rank ${ref.rank}`], spells: spellRowWrap(usedSpellCards(rl, null, ref.rank) + usedCondCards(rl, ref.rank)) }; }
      else if (ref.k === "card") { const cd = (D.cards || []).find(x => x.family === ref.family);
        if (cd) r = { name: `${cd.family} set`, desc: cd.effects[ref.power - 1] || "", icons: [spriteImg(cd.sprite)], chips: ["Card Set", `Power ${ref.power}`] }; }
      else if (ref.k === "cond") { const c = (D.conditions || []).find(x => x.name === ref.name);
        if (c) r = { name: c.name, desc: c.desc, icons: [c.icon ? `<img src="${esc(c.icon)}" alt="">` : ""], chips: [c.cat], open: { ek: "condition", eid: `${c.cat}:${c.key}` } }; }
      else if (ref.k === "realm") { const rp = (D.realmProps || []).find(x => x.key === ref.key);
        if (rp) r = { name: rp.name, desc: rp.effect, icons: [spriteImg(rp.icon, "px")], chips: ["Realm Property"] }; }
      else if (ref.k === "boost") r = { name: "Realm Boost", desc: ref.name.charAt(0).toUpperCase() + ref.name.slice(1) + ".", icons: [], chips: [] };
      if (!r) { console.error("START OF BATTLE: unresolved", ref, e.name); r = { name: e.name, desc: e.effect, icons: [], chips: [] }; }
      r.icons = r.icons.filter(Boolean); r.chips = r.chips.filter(Boolean);
      return { ...r, step: e.sub || String(e.phase), enemy: e.enemy, note: r.note || e.note || null, secOf: e.secOf || null, res: e.res || null };
    });
    // secondary calls (a check made inside another effect) are not steps of their own: unnumbered, indented under the parent
    let n = 0; for (const r of SOB_ROWS) if (!r.secOf) r.n = ++n;
    // setup sorts the timeline between Pact of the Gods and Lust (bc_CreateCreatureList @0x1469b346c) using each creature's
    // RECORDED Speed (global.calc_stats off) — findings: "What the timeline is before phase 6" (S26). Unnumbered marker row.
    const at = SOB_ROWS.findIndex(r => r.step === "0a" && r.name === "Pact of the Gods");
    if (at >= 0) SOB_ROWS.splice(at + 1, 0, { marker: true, step: "0a", name: "Timeline set from last battle's Speed", icons: [], chips: [],
      desc: "Creatures are sorted by the Speed each had at the start of the last turn it took in its previous battle, including any buffs, debuffs or Speed gains active at that moment. Enemies are new to the battle and count as 0 Speed, as does a creature that hasn't fought yet, so your creatures usually lead. This order holds through step 5; step 6 re-sorts by current Speed." });
    else console.error("START OF BATTLE: timeline marker anchor (Pact of the Gods) not found");
    return SOB_ROWS;
  }
  function sobSection(st, q) {
    const all = sobRows().filter(r => !q || r.name.toLowerCase().includes(q) || (r.desc || "").toLowerCase().includes(q) || (r.members || []).some(m => m.toLowerCase().includes(q)));
    if (!all.length) return "";
    const key = "StartOfBattle", open = q ? true : !st.collapsed.has(key);
    const row = (r) => `<div class="perk-line res-line${r.enemy ? " res-enemy" : ""}${r.marker ? " sob-marker" : ""}${r.secOf ? " sob-sec" : ""}${r.open ? " apx-clickable" : ""}"${r.open ? ` data-action="apx-open" data-ek="${r.open.ek}" data-eid="${esc(String(r.open.eid))}" title="View taxonomy"` : ""}>
        <div class="res-n">${r.marker ? "⏱" : r.secOf ? "↳" : r.n}</div>
        <div class="apx-iconcol">${r.icons.map(icoBox).join("")}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(r.name)}</b>${resChip(r.res)}</div>${r.secOf ? `<div class="perk-desc res-note">Secondary call: checked by ${esc(r.secOf)}</div>` : ""}
          ${r.desc ? `<div class="perk-desc">${richText(r.desc)}</div>` : ""}${r.note ? `<div class="perk-desc res-note">${esc(r.note)}</div>` : ""}
          ${r.members ? `<button class="facet sob-mem-toggle" data-action="sob-members">${st.sobMembers || q ? "▾" : "▸"} ${r.members.length} effects</button>
            ${st.sobMembers || q ? `<div class="perk-line-meta sob-members">${r.members.filter(m => !q || m.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)).map(m => `<span class="anoint-spec-tag">${esc(m)}</span>`).join("")}</div>` : ""}` : ""}
          <div class="perk-line-meta">${r.chips.map(c => `<span class="anoint-spec-tag">${esc(c)}</span>`).join("")}</div>${r.spells || ""}</div></div>`;
    const steps = SOB_STEPS.map(([k, title]) => {
      const list = all.filter(r => r.step === k); if (!list.length) return "";
      const sk = "SOB:" + k, sopen = q ? true : st.sobOpen && st.sobOpen.has(sk);
      return `<button class="sob-step${sopen ? " open" : ""}" data-action="sob-step" data-k="${sk}"><span class="apx-sec-caret">${sopen ? "▾" : "▸"}</span>${k.replace(/^1(?=[abc])/, "1")}. ${esc(title)}</button>
        ${sopen ? `<div class="perk-list">${list.map(row).join("")}</div>` : ""}`;
    }).join("");
    const body = open ? `<div class="slot-sub sob-intro">Each step resolves fully before the next. Within a step, one effect at a time in this order — your side before the enemy's, and per-creature effects in timeline order (fastest first; before step 6 that's last battle's order, see step 0a).</div>${steps}` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Start of Battle Order</button>${body}`;
  }

  // ── Effect order: every other fixed-order combat function (D.effectOrder, built from _su_extract effect_order_all.json;
  // code/EFFECT_ORDER_FINDINGS.md). One Appendix section per pipeline, laid out like Start of Battle: rows numbered in execution
  // order per function. A section with one function opens its steps as the collapsible groups; with several, each function is
  // a collapsible group and its steps are sub-headings. Row keys are the app's refs (see build-data.mjs effectOrder).
  // How order works (_su_extract effect_order_all.json `rules`, in plain words)
  const EO_RULES = [
    "Effects run in the order listed. Each one finishes, or queues its event, before the next is checked. Nothing is sorted by Speed, slot or priority.",
    "An effect that covers a whole side (“your creatures…”, “this trait does not stack”) runs once for that side, however many creatures have it. When several creatures each check their own copy, they go in party slot order, or timeline order for effects on “each creature”.",
    "Where an effect sits says when its code runs, not when its change lands. Each row says which: “At once” = in place before the next row; “Runs now” = a whole attack or cast happens on the spot, but its hits are queued; “Queued” = lands later, when the queue reaches it (oldest first, after the current list); “Jumps the queue” = queued at the front; “Changes the amount” = only alters the number being worked out; “Check only” = just a check, its effect is in the rows that follow.",
    "A trigger list (after an attack, a critical hit, a death…) runs in full at once, and everything it queues goes to the back. So every hit of an attack on all enemies resolves before any of their follow-ups.",
    "When a trigger list repeats (Illusion, Fable, Master of Rift Dancers…), the whole list runs again from the top, not each effect twice in a row.",
    "Bonuses from different effects add together and reductions multiply, so their order doesn't change the result. Order matters for effects that cancel, cap or replace the amount: an effect that cancels a hit (Prevented!, Immune, a dodge) stops everything listed after it.",
  ];
  function eoRulesSection(st, q) {
    if (q && !"effect order rules queue trigger".includes(q) && !EO_RULES.some(r => r.toLowerCase().includes(q))) return "";
    const key = "EffectOrderRules", open = q ? true : !st.collapsed.has(key);
    const body = open ? `<div class="nd-wrap">${EO_RULES.map(r => `<div class="slot-sub eo-rule">${esc(r)}</div>`).join("")}</div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>How Effect Order Works</button>${body}`;
  }
  const EO_TAG = { top: "Placed first", bottom: "Placed last" };
  // when an effect's change lands (extract `resolution`, S44 / S44c); a mix joins its parts ("At once + Queued"); none = not judged
  const EO_RES = { immediate: "At once", inline: "Runs now", queued: "Queued", "queued-front": "Jumps the queue", value: "Changes the amount", container: "Check only" };
  const EO_RES_TIP = { immediate: "In place at once: every later row already sees it", inline: "A whole attack / cast runs right now, inside this step; its hits and spell effects are queued",
    queued: "Lands later, when the event queue reaches it", "queued-front": "Queued at the front: lands before the events already waiting",
    value: "Only changes the number being worked out (damage, healing, chance)", container: "Only a check: its effect is in the rows that follow" };
  const resChip = (res) => { if (!res) return ""; const parts = res.split("+").filter(p => EO_RES[p]); if (!parts.length) return "";
    return `<span class="anoint-spec-tag eo-res" title="${esc(parts.map(p => EO_RES_TIP[p]).join(" · "))}">${esc(parts.map(p => EO_RES[p]).join(" + "))}</span>`; };
  const EO_CACHE = new Map();
  function eoRef(key, extra) {
    const ck = key + "|" + extra; if (EO_CACHE.has(ck)) return EO_CACHE.get(ck);
    const [k, ...rest] = key.split(":"), id = rest.join(":");
    let r = null;
    if (k === "trait") { const t = D.traits[id]; if (t) { const { creatureByTrait, itemsByTrait } = traitSources();
      const c = creatureByTrait.get(t.id), boss = bossSpriteFor(t), its = itemsByTrait.get(t.id) || [], it = its.find(x => x.icon);
      r = { name: t.name, desc: t.desc, icons: [c ? critFace(c) : boss ? spriteImg(boss) : "", it ? spriteImg(it.icon, "px") : ""],
        chips: [c ? c.name : t.owner || "", ...new Set(its.map(x => x.name))], open: { ek: "trait", eid: t.id }, spells: traitSpellRow(t.id) }; } }
    else if (k === "perk") { const [sid, pk] = [rest[0], rest.slice(1).join(":")], sp = D.specs.find(x => String(x.id) === sid), p = sp && sp.perks.find(x => x.key === pk);
      if (p) r = { name: p.name, desc: p.desc, icons: [specIco(sp), p.icon && spriteImg(p.icon, "px")], chips: [sp.label], spells: perkSpellRow(sp.id, p) }; }
    else if (k === "relic") { const rl = D.relics.find(x => String(x.id) === id), rk = rl && extra != null && rl.ranks.find(x => x.rank === extra);
      if (rl) r = { name: rl.name.split(",")[0], desc: rk ? rk.desc : "", icons: [spriteImg(relicArt(rl), "px")], chips: [(rl.name.split(",")[1] || "").trim(), rk ? `Rank ${extra}` : ""], spells: rk ? spellRowWrap(usedSpellCards(rl, null, extra) + usedCondCards(rl, extra)) : "" }; }
    else if (k === "card") { const cd = (D.cards || []).find(x => String(x.id) === id);
      if (cd) r = { name: `${cd.family} set`, desc: extra ? cd.effects[extra - 1] || "" : "", icons: [spriteImg(cd.sprite)], chips: ["Card Set", extra ? `Power ${extra}` : ""] }; }
    else if (k === "spell") { const sp = (D.spells || []).find(x => String(x.id) === id);
      if (sp) r = { name: sp.name, desc: sp.desc, icons: [spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""], chips: ["Spell"], open: { ek: "spell", eid: sp.id } }; }
    else if (k === "cond") { const c = (D.conditions || []).find(x => `${x.cat}:${x.key}` === id);
      if (c) r = { name: c.name, desc: c.desc, icons: [c.icon ? `<img src="${esc(c.icon)}" alt="">` : ""], chips: [c.cat], open: { ek: "condition", eid: id } }; }
    else if (k === "realm") { const rp = (D.realmProps || []).find(x => x.key === id);
      if (rp) r = { name: rp.name, desc: rp.effect, icons: [spriteImg(rp.icon, "px")], chips: ["Realm Property"] }; }
    else if (k === "spec") { const sp = D.specs.find(x => String(x.id) === id);
      if (sp) r = { name: sp.label, desc: "", icons: [specIco(sp)], chips: ["Specialization"] }; }
    if (!r) { console.error("EFFECT ORDER: unresolved", key); r = { name: key, desc: "", icons: [], chips: [] }; }
    r.icons = r.icons.filter(Boolean); r.chips = r.chips.filter(Boolean);
    EO_CACHE.set(ck, r); return r;
  }
  function effectOrderSection(st, q, sec) {
    const hit = (r) => r.name.toLowerCase().includes(q) || (r.desc || "").toLowerCase().includes(q);
    const fns = sec.fns.map(f => { let n = 0;
      const steps = f.steps.map((s, i) => ({ t: s.t, i, rows: s.rows.map(([k, x, tag, res]) => ({ ...eoRef(k, x), n: ++n, tag, res })) }))
        .map(s => q ? { ...s, rows: s.rows.filter(hit) } : s).filter(s => s.rows.length);
      return { ...f, steps };
    }).filter(f => f.steps.length);
    if (!fns.length) return "";
    const key = "EO:" + sec.key, open = q ? true : !st.collapsed.has(key);
    const row = (r) => `<div class="perk-line res-line${r.open ? " apx-clickable" : ""}"${r.open ? ` data-action="apx-open" data-ek="${r.open.ek}" data-eid="${esc(String(r.open.eid))}" title="View taxonomy"` : ""}>
        <div class="res-n">${r.n}</div>
        <div class="apx-iconcol">${r.icons.map(icoBox).join("")}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(r.name)}</b>${r.tag ? `<span class="anoint-spec-tag">${EO_TAG[r.tag]}</span>` : ""}${resChip(r.res)}</div>
          ${r.desc ? `<div class="perk-desc">${richText(r.desc)}</div>` : ""}
          ${r.chips.length ? `<div class="perk-line-meta">${r.chips.map(c => `<span class="anoint-spec-tag">${esc(c)}</span>`).join("")}</div>` : ""}${r.spells || ""}</div></div>`;
    const list = (rows) => `<div class="perk-list">${rows.map(row).join("")}</div>`;
    const group = (k, title, inner) => { const sk = `${key}:${k}`, sopen = q ? true : st.sobOpen && st.sobOpen.has(sk);
      return `<button class="sob-step${sopen ? " open" : ""}" data-action="sob-step" data-k="${esc(sk)}"><span class="apx-sec-caret">${sopen ? "▾" : "▸"}</span>${esc(title)}</button>${sopen ? inner() : ""}`; };
    let body = "";
    if (open) {
      // one function: its steps are the groups (numbered like Start of Battle); several: one group per function
      if (sec.fns.length === 1) { const f = fns[0];
        body = f.steps.length === 1 && !f.steps[0].t ? list(f.steps[0].rows)
          : f.steps.map(s => group(s.i, `${s.i + 1}. ${s.t || ""}`, () => list(s.rows))).join(""); }
      else body = fns.map(f => group(f.id, f.title, () => f.steps.map(s => (s.t ? `<div class="res-sub">${esc(s.t)}</div>` : "") + list(s.rows)).join(""))).join("");
    }
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(sec.title)}</button>${body}`;
  }

  // ── Nether Stone drop breakpoints (code: inv_Loot, _su_extract code/LOOT.md +
  // archive/handoffs/HANDOFF_nether_stone_breakpoints.md). Each loot roll succeeds on 1..N ≤ X, X = (1 + realm bonus) × 1.25
  // (× 1.25 again with Pariah ascended) → k = floor(X) chances in N. Rows = every k reachable by the true maximum realm
  // bonus (D.realmBonusMax, code: scr_RealmGetProperties rules × scr_RealmBonus, instability 5 at deepest depth),
  // found by running the game's own arithmetic over each whole percent.
  const ND = { n: { normal: 5000, relaxed: 2000, ruthless: 8000 },
    maxBonus: Math.max(600, ...Object.values(D.realmBonusMax || {}).map(m => m.deep)) };
  let ND_ROWS = null;
  function netherDropRows() {
    if (ND_ROWS) return ND_ROWS;
    const kAt = (rb, pariah) => { let x = 1; x += x * rb / 100; x += x * 0.25; if (pariah) x += x * 0.25; return Math.floor(x); };
    const first = (pariah) => { const m = new Map(); for (let rb = 0; rb <= ND.maxBonus; rb++) { const k = kAt(rb, pariah); if (!m.has(k)) m.set(k, rb); } return m; };
    const plain = first(false), par = first(true);
    ND_ROWS = [...par.keys()].map(k => ({ k, plain: plain.get(k), pariah: par.get(k) }));
    return ND_ROWS;
  }
  function netherDropSection(st, q) {
    if (q && !"nether stone drop realm bonus pariah".includes(q)) return "";
    const key = "NetherDrops", open = q ? true : !st.collapsed.has(key), diff = st.ndDiff || "normal", N = ND.n[diff];
    const pct = (k) => `${+(k / N * 100).toFixed(3)}%`;
    const body = open ? `<div class="nd-wrap">
        <div class="seg nd-diff">${[["normal", "Normal"], ["relaxed", "Relaxed"], ["ruthless", "Ruthless"]].map(([v, l]) =>
          `<button class="seg-btn ${diff === v ? "on" : ""}" data-action="nd-diff" data-v="${v}">${l}</button>`).join("")}</div>
        <div class="nd-table">
          <div class="nd-row nd-hd"><span>Drop chance</span><span>Realm item bonus</span><span>With Pariah ascended</span></div>
          ${netherDropRows().map(r => `<div class="nd-row"><span class="nd-pct">${pct(r.k)}<small>1 in ${Math.round(N / r.k).toLocaleString()}</small></span>
            <span>${r.plain != null ? `${r.plain}%` : "—"}</span><span>${r.pariah}%</span></div>`).join("")}
        </div>
        <div class="slot-sub nd-note">Per loot bundle · after The True Enemy · not in the castle</div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Nether Stone Drops</button>${body}`;
  }
  // Pandemonium shrine outcomes (code: obj_demonstatue_KeyPress_69 — choice = irandom_range(1, 13), each 1 in 13)
  function pandShrineSection(st, q) {
    const ps = D.pandShrine; if (!ps) return "";
    if (q && !"pandemonium shrine king queen".includes(q) && !ps.outcomes.some(o => (o.label + " " + o.gives).toLowerCase().includes(q))) return "";
    const key = "PandShrine", open = q ? true : !st.collapsed.has(key), pct = `${+(100 / ps.outcomes.length).toFixed(1)}%`;
    const body = open ? `<div class="nd-wrap"><div class="nd-table">
        <div class="nd-row ps-row nd-hd"><span>Outcome</span><span>Chance</span><span>Gives</span></div>
        ${ps.outcomes.map(o => `<div class="nd-row ps-row"><span class="nd-pct">${esc(o.label)}</span><span>${pct}</span><span>${esc(o.gives)}</span></div>`).join("")}
      </div><div class="slot-sub nd-note">${esc(ps.note)}</div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Pandemonium Shrine</button>${body}`;
  }
  // true maximum realm bonus per instability (code: best legal visible + hidden property sets, scr_RealmBonus)
  // Class advantage (_su_extract code/COMBAT_RULES.md § Class advantage, code-certain: bc_EventDamage class block).
  const CLASS_WHEEL = ["Life", "Death", "Chaos", "Sorcery", "Nature"];   // each is strong against the next (Nature → Life)
  function classAdvSection(st, q) {
    if (q && !"class advantage strong weak wheel opal class swap".includes(q)) return "";
    const key = "ClassAdv", open = q ? true : !st.collapsed.has(key), n = CLASS_WHEEL.length;
    const cl = (c) => `<span class="ca-cls">${D.classIcons && D.classIcons[c] ? spriteImg(D.classIcons[c], "px") : ""}<b style="color:${clsColor(c)}">${esc(c)}</b></span>`;
    const body = open ? `<div class="nd-wrap"><div class="nd-table">
        <div class="nd-row ca-row nd-hd"><span>Class</span><span>Strong vs (×2)</span><span>Weak vs (×0.5)</span></div>
        ${CLASS_WHEEL.map((c, i) => `<div class="nd-row ca-row"><span>${cl(c)}</span><span>${cl(CLASS_WHEEL[(i + 1) % n])}</span><span>${cl(CLASS_WHEEL[(i + n - 1) % n])}</span></div>`).join("")}
      </div><div class="slot-sub nd-note">Attacks use the attacker's class. Spells use the Spell Gem's class, not the caster's: a Class Swap (Opal) property changes it, and Convoke the Spirits always counts as the class the target is weak against. The defender's current class is used. Widdershins reverses the wheel; True Strike, Bloodline and the Aurum relic always hit as strong.</div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Class Advantage</button>${body}`;
  }
  // Random targets of automatic casts (bc_CreatureCastSpellGem — _su_extract code/ARTIFACTS.md "Target selection"): per
  // spell.aim (record fields 5 + 18). A spell-name search lists the matching spells with their target rule (#9).
  const AIM_RULES = [
    ["enemy1", "One enemy", "A random living enemy."],
    ["ally1", "One ally", "A random living ally (the caster included). Buff spells prefer an ally without that buff, Heal spells the ally with the lowest Health, resurrection spells a random dead ally."],
    ["enemies", "All enemies", "Every living enemy."],
    ["allies", "All your creatures", "Every living ally, the caster included."],
    ["all", "All creatures", "Every living creature on both sides."],
    ["self", "Caster", "The caster only."],
  ];
  function randomTargetSection(st, q) {
    const spells = (D.spells || []).filter(sp => sp.aim && !sp.unused);
    const all = q && "random target targets automatic cast artifact nether booze".includes(q);
    const hits = q && !all ? spells.filter(sp => sp.name.toLowerCase().includes(q)).slice(0, 40) : [];
    if (q && !all && !hits.length) return "";
    const key = "RandomTargets", open = q ? true : !st.collapsed.has(key);
    const cnt = (k) => spells.filter(sp => sp.aim === k).length;
    const rule = new Map(AIM_RULES.map(([k, l]) => [k, l]));
    const body = !open ? "" : hits.length
      ? `<div class="nd-wrap"><div class="nd-table">
          <div class="nd-row rt-row nd-hd"><span>Spell</span><span>Automatic cast targets</span></div>
          ${hits.map(sp => `<div class="nd-row rt-row"><span class="mr-realm">${spellIco(sp)}<b>${esc(sp.name)}</b></span><span>${esc(rule.get(sp.aim))}</span></div>`).join("")}
        </div></div>`
      : `<div class="nd-wrap"><div class="slot-sub nd-note" style="margin:0 0 6px">Automatic casts (Artifact spell slot, Nether Stone spells, Booze and Arsenal auto-casts, scripted boss casts) pick their own targets from the spell's target rule:</div><div class="nd-table">
          <div class="nd-row rt-row3 nd-hd"><span>Spell targets</span><span>Who gets picked</span><span>Spells</span></div>
          ${AIM_RULES.map(([k, l, d]) => `<div class="nd-row rt-row3"><span><b>${esc(l)}</b></span><span>${esc(d)}</span><span>${cnt(k)}</span></div>`).join("")}
        </div><div class="slot-sub nd-note">No valid target: the cast fizzles (no fallback). A Confused caster can still send a harmful single-target spell to another random creature. Search a spell name to see its rule.</div></div>`;
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Random Targets</button>${body}`;
  }
  function realmBonusSection(st, q) {
    const M = D.realmBonusMax || {};
    if (!Object.keys(M).length || (q && !"realm bonus item bonus instability maximum".includes(q))) return "";
    const key = "RealmBonusMax", open = q ? true : !st.collapsed.has(key);
    const body = open ? `<div class="nd-wrap"><div class="nd-table">
        <div class="nd-row nd-hd"><span>Instability</span><span>Deepest depth</span><span>Below deepest</span></div>
        ${Object.entries(M).map(([ri, m]) => `<div class="nd-row"><span>${ri}</span><span>${m.deep}%</span><span>${m.below}%</span></div>`).join("")}
      </div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Maximum Realm Item Bonus</button>${body}`;
  }
  // Rodian Creature Masters per realm (code: D.masterRealms from master_realms.json, _su_extract code/MASTER_SPAWN_FINDINGS.md).
  // Master-only races (scr_GetMasterRaces extras, not realm spawns) get a dashed chip.
  function mastersSection(st, q) {
    const M = D.masterRealms || []; if (!M.length) return "";
    const all = q && "rodian creature masters".includes(q);
    const list = M.filter(m => !q || all || m.realm.toLowerCase().includes(q) || m.pool.some(r => r.toLowerCase().includes(q)));
    if (!list.length) return "";
    const key = "Masters", open = q ? true : !st.collapsed.has(key);
    const icon = (realm) => { const r = D.realms.find(x => x.realm === realm); return r && r.icon ? spriteImg(r.icon, "px") : ""; };
    const chip = (m, race) => { const ic = D.raceIcons && D.raceIcons[race], ex = m.extra.includes(race);
      return `<span class="realm-race${ex ? " mr-extra" : ""}"${ex ? ` title="Master only"` : ""}>${ic ? spriteImg(ic, "px") : ""}<span>${esc(race)}</span></span>`; };
    const body = open ? `<div class="nd-wrap"><div class="nd-table">
        <div class="nd-row mr-row nd-hd"><span>Realm</span><span>Masters</span></div>
        ${list.map(m => `<div class="nd-row mr-row"><span class="mr-realm">${icon(m.realm)}<b>${esc(m.realm)}</b></span>
          <span class="mr-pool">${m.pool.map(r => chip(m, r)).join("")}</span></div>`).join("")}
      </div><div class="slot-sub nd-note">Appears only at your deepest Realm Depth, once per depth, as the race in the realm's list you've defeated the fewest Masters of. Any realm: 1% chance of an Alemental or Construct Master, 1% of a Dumpling or Godspawn; first talking to it has a 1% chance to turn it into a Mimic Master. Nether realms: a random race from the list, or 3% chance of a Dumpling, Alemental or Construct.</div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Rodian Masters</button>${body}`;
  }
  function resOrderSection(st, q) {
    const all = resOrderRows(), hit = (r) => r.name.toLowerCase().includes(q) || (r.desc || "").toLowerCase().includes(q);
    const rows = q ? all.filter(r => r.group === "head" || (r.group !== "note" && hit(r))) : all;
    if (q && !rows.some(r => r.group !== "head")) return "";
    const key = "Resurrection", open = q ? true : !st.collapsed.has(key);
    const tag = { rule: "Blocks other resurrection", stop: "Skips the rest if it fires", chain: "Once per death" };
    const row = (r) => `<div class="perk-line res-line${r.group === "rule" ? " res-rule" : ""}${r.blocker ? " res-block" : ""}${r.enemy ? " res-enemy" : ""}${r.open ? " apx-clickable" : ""}"${r.open ? ` data-action="apx-open" data-ek="${r.open.ek}" data-eid="${esc(String(r.open.eid))}" title="View taxonomy"` : ""}>
        <div class="res-n">${r.n ?? r.qn ?? "⛔"}</div>
        <div class="apx-iconcol">${r.icons.map(icoBox).join("")}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(r.name)}</b>${r.blocker ? `<span class="anoint-spec-tag res-block-tag">Blocker</span>` : tag[r.group] ? `<span class="anoint-spec-tag">${tag[r.group]}</span>` : ""}</div>
          ${r.desc ? `<div class="perk-desc">${r.blocker ? esc(r.desc) : richText(r.desc)}</div>` : ""}${r.note ? `<div class="perk-desc res-note">${esc(r.note)}</div>` : ""}
          ${r.chips.length ? `<div class="perk-line-meta">${r.chips.map(c => `<span class="anoint-spec-tag">${esc(c)}</span>`).join("")}</div>` : ""}</div></div>`;
    let body = "", list = [];
    const flush = () => { if (list.length) body += `<div class="perk-list">${list.map(row).join("")}</div>`; list = []; };
    if (open) {
      rows.forEach((r, i) => {
        if (r.group === "head") { if (q && !(rows[i + 1] && rows[i + 1].group !== "head")) return; flush(); body += `<div class="res-sub">${esc(r.name)}</div>`; }
        else if (r.group === "note") { flush(); body += `<div class="slot-sub res-flow-note">${esc(r.name)}</div>`; }
        else list.push(r);
      });
      flush();
    }
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Resurrection Order</button>${body}`;
  }

  // L_IN_WEATHER's name is the runtime "{1}" (the weather is picked when you buy it) — show it as "Weather"
  const shopItemName = (it) => /^\{\d\}$/.test(it.name || "") ? (it.key === "L_IN_WEATHER" ? "Weather" : "?") : (it.name || "?");

  // ── Nether Realm helpers (code-grounded: _su_extract code/NETHER.md) ──
  // Faucet = room_nether_valves: 4 on/off valves form a code (read right→left, user ruling) that picks the single chest's contents;
  // the closed chest's sprite already previews the result. Mimic Mike = room_nether_treasurehuge: 35 chests whose
  // contents are rolled at room creation and shown by their sprite; 7 opens, each parchment adds 2–4 more.
  const NH = D.netherHelpers || { faucet: { table: [] }, treasury: { table: [] } };
  const FAUCET_ORDER = { item: 0, materials: 0, emblem: 0, mimic: 1, empty: 2 };
  function openNetherHelper() {
    ovState = { kind: "netherhelp", tab: "faucet", valves: [0, 0, 0, 0], render: renderNetherHelper };
    openOverlay(ovState.render());
  }
  // the code's 4-bit valve string reads RIGHT→LEFT across the on-screen valves (user, in-game, 2026-10-17): screen valve i
  // = code digit 3−i. st.valves stays in screen order; codes convert at the edges.
  const valveCode = (screen) => screen.slice().reverse().join("");
  const codeValves = (code) => [...code].reverse().map(Number);
  const valveImg = (on) => spriteImg(on ? NH.faucet.valveOn : NH.faucet.valveOff, on ? "px" : "px nh-off");
  function renderNetherHelper() {
    const st = ovState, faucet = st.tab === "faucet";
    const toggle = `<div class="art-view-toggle">
      <button class="av-tab ${faucet ? "on" : ""}" data-action="nh-tab" data-v="faucet">Faucet</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${!faucet ? "on" : ""}" data-action="nh-tab" data-v="mimic">Mimic Mike</button></div>`;
    let head = "", body;
    if (faucet) {
      // locked header: the 4 interactable valves + the chest they produce (defaults: all off → empty chest)
      const code = valveCode(st.valves), cur = NH.faucet.table.find(r => r.code === code);
      const valves = st.valves.map((v, i) => `<button class="nh-valve${v ? " on" : ""}" data-action="nh-valve" data-i="${i}" title="Faucet ${i + 1}">${valveImg(v)}</button>`).join("");
      head = `<div class="nh-head"><div class="nh-valves">${valves}</div><span class="nh-arrow">→</span>
        <div class="nh-result${cur && cur.kind === "mimic" ? " mimic" : ""}"><span class="nh-chest lg">${cur ? spriteImg(cur.img, "px") : ""}</span>
          <b>${cur ? esc(cur.reward) : ""}</b></div></div>`;
      const rows = NH.faucet.table.slice().sort((a, b) => (FAUCET_ORDER[a.kind] ?? 0) - (FAUCET_ORDER[b.kind] ?? 0) || a.code.localeCompare(b.code))
        .map(r => `<button class="nh-row${r.code === code ? " on" : ""}${r.kind === "mimic" ? " mimic" : r.kind === "empty" ? " empty" : ""}" data-action="nh-code" data-c="${r.code}">
          <span class="nh-row-valves">${codeValves(r.code).map(v => valveImg(v === 1)).join("")}</span>
          <span class="nh-chest">${spriteImg(r.img, "px")}</span><span class="nh-reward">${esc(r.reward)}</span></button>`).join("");
      body = `<div class="nh-list">${rows}</div>`;
    } else {
      // Mimic Mike: reference list only — chest icon, then what it holds
      const T = NH.treasury;
      const pct = (r) => r.filling === 11 ? T.pStone * 100 : (1 - T.pStone) * 10;
      const rows = T.table.slice().sort((a, b) => a.filling - b.filling).map(r =>
        `<div class="nh-mm-row"><span class="nh-chest">${spriteImg(r.img, "px")}</span>
          <div class="nh-mm-content"><span class="nh-reward">${esc(r.reward)}</span><span class="nh-pct">${+pct(r).toFixed(1)}%</span></div></div>`).join("");
      body = `<div class="nh-list">${rows}</div>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Nether Realm</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">${toggle}${head}<div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Projects — castle projects, missions and unlocks (code: cost, required items, prerequisites). ──
  function openProjects() {
    ovState = { kind: "projects", search: "", ruthless: false, collapsed: new Set(), render: renderProjects };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const PROJECT_GROUPS = ["Castle", "Missions", "Specializations", "Godspawn", "Unlocks"];
  const fmtInt = (n) => Number(n || 0).toLocaleString("en-US");
  function renderProjects() {
    const st = ovState, q = st.search.trim().toLowerCase(), all = D.projects || [];
    const match = (p) => !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
      || p.items.some(i => i.name.toLowerCase().includes(q)) || p.reqs.some(r => r.toLowerCase().includes(q));
    const list = all.filter(match);
    const row = (p) => {
      const c = st.ruthless ? p.costRuthless : p.cost;
      const items = p.items.map(i => `<span class="proj-item">${i.icon ? spriteImg(i.icon, "px") : ""}<span>${esc(i.name)}</span><b>×${fmtInt(i.qty)}</b></span>`).join("");
      return `<div class="perk-line">
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(p.name)}</b>
          <span class="perk-line-meta">${fmtInt(c.resources)} Resources · ${fmtInt(c.parts)} Parts · ${fmtInt(c.dust)} Dust</span></div>
          ${p.desc ? `<div class="perk-desc">${esc(p.desc)}</div>` : ""}
          ${items ? `<div class="proj-items">${items}</div>` : ""}
          ${p.reqs.length ? `<div class="proj-reqs">${p.reqs.map(r => `<span class="thr-chip">${esc(r)}</span>`).join("")}</div>` : ""}</div></div>`;
    };
    const body = PROJECT_GROUPS.map(g => {
      const items = list.filter(p => p.group === g);
      if (!items.length) return "";
      const open = q ? true : !st.collapsed.has(g);
      return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="proj-group-toggle" data-g="${esc(g)}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(g)}</button>${open ? `<div class="perk-list">${items.map(row).join("")}</div>` : ""}`;
    }).join("") || `<div class="slot-sub" style="padding:10px">No project matches “${esc(st.search)}”.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Projects</h2>
        <input class="ovl-search" placeholder="Search projects, items, quests…" value="${esc(st.search)}" data-action="proj-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="ovl-filterbar"><div class="seg">
        <button class="seg-btn ${st.ruthless ? "" : "on"}" data-action="proj-diff" data-v="normal">Normal</button>
        <button class="seg-btn ${st.ruthless ? "on" : ""}" data-action="proj-diff" data-v="ruthless">Ruthless</button></div></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Realms reference ────────────────────────────────────────────────────────
  function openRealms(realmId) {
    ovState = { kind: "realms", search: "", sortBy: "realm", mode: "list", cmpExpanded: new Set(),
      favorRank: 100, showCommon: false, favorView: "interactions", useCustom: favorPrefs.use, editingRanks: false,
      view: realmId != null ? "detail" : "list", sel: realmId != null ? realmId : null, detailIco: "realm", render: renderRealms };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderRealms() {
    const st = ovState, rs = D.realms || [];
    if (st.view === "detail") return renderRealmDetail(rs.find(r => r.id === st.sel));
    if (st.editingRanks) return renderRealmCustomize(rs);
    return st.mode === "compare" ? renderRealmCompare(rs) : renderRealmList(rs);
  }
  // ── Favor-track helpers (values sourced from Favor_MTX via D.realms[].favor) ───────────────────
  const favUnique = () => (D.favorCols && D.favorCols.unique) || [];
  const favGeneric = () => (D.favorCols && D.favorCols.generic) || [];
  const favAll = () => [...favUnique(), ...favGeneric()];   // matrix rows are aligned to this order
  const favRank = () => (ovState.favorRank == null ? 100 : ovState.favorRank);
  // the rank to read a realm at: its tracked custom rank when "My ranks" is on, else the global slider rank
  const rankFor = (realm) => ovState.useCustom && realm ? (favorPrefs.ranks[realm.id] != null ? favorPrefs.ranks[realm.id] : favRank()) : favRank();
  // yield difficulty (Relaxed / Normal / Ruthless) — realm.favor is keyed by difficulty
  const yDiff = () => ovState.yieldDiff || "normal";
  // value of column at flat index `i` for a realm at a given favor rank: yield columns per realm × difficulty,
  // common columns (identical in every realm) from D.favorCommonVals
  const favVal = (realm, i, rank = favRank()) => { const u = favUnique().length;
    if (i >= u) { const c = D.favorCommonVals && D.favorCommonVals[rank]; return c ? c[i - u] : null; }
    const m = realm.favor && realm.favor[yDiff()]; if (!m) return null; const row = m[rank] || m[100]; return row ? row[i] : null; };
  function fmtFav(col, v) { if (v == null || v === 0) return "—";
    const n = Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Number.isInteger(v) ? v : +(+v).toFixed(2);
    return col.unit === "%" ? `${n}%` : col.unit === "bool" ? "✓" : `${n}`; }
  // Relaxed | Normal | Ruthless toggle for the yield views
  function yieldDiffToggle() { const d = yDiff();
    return `<div class="seg nd-diff">${[["relaxed", "Relaxed"], ["normal", "Normal"], ["ruthless", "Ruthless"]].map(([v, l]) =>
      `<button class="seg-btn ${d === v ? "on" : ""}" data-action="realm-diff" data-v="${v}">${l}</button>`).join("")}</div>`; }
  // bar fill % for a unique column (scaled to the rank-100 cross-realm max so bars grow with the rank)
  function favBarPct(col, v) { const max = (D.favorColMax && D.favorColMax[yDiff()] && D.favorColMax[yDiff()][col.key]) || 1;
    return v == null || v <= 0 ? 0 : Math.max(3, Math.min(100, Math.round((v / max) * 100))); }
  function favBar(col, v) { return `<span class="rcat-mag"><i style="width:${favBarPct(col, v)}%"></i></span><span class="rcat-val">${fmtFav(col, v)}</span>`; }
  // in-place slider update: recompute [data-ci] bar rows + condense [data-rank] list rows to the slider's
  // value WITHOUT a full re-render, so dragging the range stays smooth (the slider is never replaced mid-drag).
  function favorLiveUpdate(root) {
    if (!root) return; const cols = favAll();
    const rangeEl = root.querySelector(".fav-range"); const sv = rangeEl ? +rangeEl.value : favRank();
    root.querySelectorAll(".fav-slider-lbl b, [data-favrank-text]").forEach(b => b.textContent = sv);
    root.querySelectorAll("[data-ci]").forEach(el => {
      const col = cols[+el.dataset.ci], realm = D.realms[+el.dataset.rid]; if (!col || !realm) return;
      const v = favVal(realm, +el.dataset.ci, sv);
      const bar = el.querySelector(".rcat-mag > i"); if (bar) bar.style.width = favBarPct(col, v) + "%";
      const val = el.querySelector(".rcat-val"); if (val) val.textContent = fmtFav(col, v);
    });
    root.querySelectorAll(".fav-tier[data-rank]").forEach(el => { el.style.display = (+el.dataset.rank <= sv) ? "" : "none"; });
  }
  // shared favor-rank slider (0..100) — `cur` is the rank it shows/edits (a realm's tracked rank in detail)
  function favorSlider(cur = favRank()) {
    return `<div class="fav-slider"><label class="fav-slider-lbl">Favor rank <b>${cur}</b></label>
      <input type="range" min="0" max="100" value="${cur}" class="fav-range" data-action="realm-rank"></div>`;
  }
  function renderRealmList(rs) {
    const st = ovState, q = st.search.trim().toLowerCase();
    const match = (r) => !q || r.realm.toLowerCase().includes(q) || r.godName.toLowerCase().includes(q) || r.creatures.some(c => c.toLowerCase().includes(q));
    const d = sortSign(st.sortRev);
    const list = rs.filter(match).sort((a, b) => st.sortBy === "god"
      ? d * a.godName.localeCompare(b.godName) || a.realm.localeCompare(b.realm)
      : d * a.realm.localeCompare(b.realm));
    // the Realm | God toggle also picks the icon: Realm → realm icon, God → god battle sprite
    const heroIco = (x) => st.sortBy === "god" ? (x.godBattle || x.icon) : (x.icon || x.godBattle);
    const rows = list.map(r => `<button class="realm-row" data-action="realm-sel" data-id="${r.id}">
      <span class="realm-icon">${heroIco(r) ? spriteImg(heroIco(r), "px") : ""}</span>
      <span class="opt-dot" style="background:${clsColor(r.cls)}"></span>
      <span class="realm-row-name">${esc(st.sortBy === "god" ? r.godName : r.realm)}</span>
      <span class="anoint-spec-tag">${esc(st.sortBy === "god" ? r.realm : r.godName)}</span>
      <span class="opt-chev">›</span></button>`).join("")
      || `<div class="slot-sub" style="padding:10px">No realms match.</div>`;
    const sortToggle = `<div class="art-view-toggle">
      <button class="av-tab ${st.sortBy === "realm" ? "on" : ""}" data-action="realm-sort" data-v="realm">${sortLbl("Realm", st.sortBy === "realm", st.sortRev, false)}</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${st.sortBy === "god" ? "on" : ""}" data-action="realm-sort" data-v="god">${sortLbl("God", st.sortBy === "god", st.sortRev, false)}</button></div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Realms</h2>
        <input class="ovl-search" placeholder="Search realm / god / race…" value="${esc(st.search)}" data-action="realm-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">${realmModeToggle("list")}${sortToggle}
        <div class="ovl-center-scroll"><div class="realm-list">${rows}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }
  // Browse (per-realm list) | Compare (cross-realm outcome comparison)
  function realmModeToggle(mode) {
    return `<div class="art-view-toggle">
      <button class="av-tab ${mode === "list" ? "on" : ""}" data-action="realm-mode" data-v="list">Browse</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${mode === "compare" ? "on" : ""}" data-action="realm-mode" data-v="compare">Compare</button></div>`;
  }
  // Cross-realm comparison: one collapsible accordion per Unique Bonus column; expand to rank every realm by
  // its value at the current favor rank, on a shared bar scale. The rank slider scrubs the whole comparison.
  // rank-source control shared by Compare: same rank for all (global slider) vs each realm's tracked rank
  function rankSourceCtl() {
    const uc = ovState.useCustom;
    // centered Same-rank | My-ranks toggle; the Customize-ranks button now lives in the footer
    return `<div class="fav-rankmode">
      <div class="art-view-toggle">
        <button class="av-tab ${!uc ? "on" : ""}" data-action="realm-usecustom" data-v="0">Same rank</button>
        <span class="av-pipe">|</span>
        <button class="av-tab ${uc ? "on" : ""}" data-action="realm-usecustom" data-v="1">My ranks</button>
      </div></div>`;
  }
  function renderRealmCompare(rs) {
    const st = ovState, q = st.search.trim().toLowerCase(), uc = st.useCustom;
    const uCols = favUnique();
    const groups = uCols.map((col, i) => {
      const rows = rs.map(r => ({ r, v: favVal(r, i, rankFor(r)) })).filter(x => x.v != null && x.v > 0)
        .filter(x => !q || x.r.realm.toLowerCase().includes(q) || col.label.toLowerCase().includes(q))
        .sort((a, b) => b.v - a.v);
      return { col, i, rows };
    }).filter(g => g.rows.length);
    const body = groups.length ? groups.map(g => {
      const open = st.cmpExpanded.has(g.col.key), top = g.rows[0];
      const bars = g.rows.map(({ r, v }) => `<button class="rcmp-row" data-action="realm-sel" data-id="${r.id}"${uc ? "" : ` data-rid="${r.id}" data-ci="${g.i}"`}>
        <span class="rcmp-realm">${esc(r.realm)}${uc ? ` <span class="rcmp-rk">r${rankFor(r)}</span>` : ""}</span>${favBar(g.col, v)}</button>`).join("");
      return `<div class="rcmp-grp"><button class="apx-sec-head apx-cat rcmp-head${open ? "" : " collapsed"}" data-action="realm-cat" data-k="${g.col.key}">
        <span class="apx-sec-caret">${open ? "▾" : "▸"}</span><span class="rcmp-cat">${esc(g.col.label)}</span>
        <span class="rcmp-meta">top ${esc(top.r.realm)} ${fmtFav(g.col, top.v)}</span></button>
        ${open ? `<div class="rcmp-bars">${bars}</div>` : ""}</div>`;
    }).join("") : `<div class="slot-sub" style="padding:12px">No yields yet${q ? ` matching “${esc(st.search)}”` : ""}.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Realms</h2>
        <input class="ovl-search" placeholder="Search category / realm…" value="${esc(st.search)}" data-action="realm-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="rcmp-controls">${realmModeToggle("compare")}${rankSourceCtl()}${yieldDiffToggle()}${uc ? "" : favorSlider()}</div>
        <div class="ovl-center-scroll"><div class="rcmp-list">${body}</div></div>
      </div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="realm-editranks">⚙ Customize ranks</button>
        <span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }
  // Customize Ranks editor — enter your current favor rank (0-100) per realm; drives the "My ranks" comparison.
  function renderRealmCustomize(rs) {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = rs.filter(r => !q || r.realm.toLowerCase().includes(q) || r.godName.toLowerCase().includes(q))
      .sort((a, b) => a.realm.localeCompare(b.realm));
    const rows = list.map(r => { const val = favorPrefs.ranks[r.id]; const ico = r.icon || r.godBattle;
      return `<div class="frank-row">
        <span class="realm-icon">${ico ? spriteImg(ico, "px") : ""}</span>
        <span class="frank-name"><b>${esc(r.realm)}</b><span class="anoint-spec-tag">${esc(r.godName)}</span></span>
        <input class="frank-input" type="number" min="0" max="100" inputmode="numeric" placeholder="0" value="${val != null ? val : ""}" data-action="realm-setrank" data-id="${r.id}"></div>`;
    }).join("") || `<div class="slot-sub" style="padding:10px">No realms match.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><button class="btn-ghost" data-action="realm-editdone">‹ Compare</button>
        <h2 style="flex:1">Customize favor ranks</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <label class="fav-common"><input type="checkbox" data-action="realm-usecustom-cb" ${st.useCustom ? "checked" : ""}> Use my ranks in the comparison</label>
        <div class="fav-rankmode" style="justify-content:flex-start;gap:8px">
          <input class="ovl-search" style="flex:1" placeholder="Search realm / god…" value="${esc(st.search)}" data-action="realm-search">
          <button class="btn-ghost" data-action="realm-clearranks">Clear all</button></div>
        <div class="slot-sub" style="margin:6px 0">Enter your current favor rank (0–100) for each realm. Saved automatically.</div>
        <div class="ovl-center-scroll"><div class="frank-list">${rows}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="realm-editdone">Done</button></div>
    </div></div>`;
  }
  // realm creature names don't always match the race key: plurals ("Modrons") and pairs ("Imler & Imling") →
  // one icon per race. Unresolved names fail loudly (console) rather than rendering a silent icon-less chip.
  function realmRaceIcons(name) {
    const RI = D.raceIcons || {};
    if (RI[name]) return [RI[name]];
    const out = String(name).split(/\s*(?:&|,|\band\b)\s*/).map(part => RI[part] || RI[part.replace(/e?s$/, "")] || RI[part.replace(/s$/, "")]);
    if (out.every(Boolean)) return out;
    console.error("REALM RACE ICON: no race icon for", name);
    return out.filter(Boolean);
  }
  function renderRealmDetail(sel) {
    if (!sel) { ovState.view = "list"; return renderRealmList(D.realms || []); }
    const facts = [["God", esc(sel.god)], ["Class", sel.cls ? `<span style="color:${clsColor(sel.cls)};font-weight:700">${esc(sel.cls)}</span>` : "—"],
      ["Gemstone", sel.gemstone ? esc(sel.gemstone) : "—"], ["Godspawn", sel.godspawn ? esc(sel.godspawn) : "—"]]
      .map(([k, v]) => `<div class="ss-row"><span class="ss-k">${k}</span><span class="ss-v">${v}</span></div>`).join("");
    // all creatures in one section, each tagged by how it appears: Roaming / Encounter / God Shop
    const critEntries = [
      ...sel.creatures.map(name => ({ name, cat: "Roaming", via: null })),
      ...sel.encounters.map(e => ({ name: e.value, cat: e.name === "God Shop" ? "God Shop" : "Encounter", via: e.name === "God Shop" ? null : e.name })),
    ];
    const critChip = (e) => { const ic = realmRaceIcons(e.name).map(src => spriteImg(src, "px")).join("");
      // colour = how it appears: Roaming (plain) · Encounter (object-container violet) · God Shop (favor-track gold)
      return `<span class="realm-race cat-${e.cat.replace(/\s+/g, "").toLowerCase()}" title="${esc(e.via ? e.cat + " — " + e.via : e.cat)}">${ic}<span>${esc(e.name)}</span></span>`; };
    const legend = [["Roaming", "roaming"], ["Encounter", "encounter"], ["God Shop", "godshop"]].filter(([c]) => critEntries.some(e => e.cat === c))
      .map(([c, k]) => `<span class="rc-key cat-${k}">${c}</span>`).join("");
    const creatures = critEntries.length ? `<div class="section-label rc-head">Creatures<span class="rc-legend">${legend}</span></div>
      <div class="realm-crits">${critEntries.map(critChip).join("")}</div>` : "";
    const encounters = "";
    const resources = sel.resources.length ? `<div class="section-label">Resources</div>
      <div class="prop-list">${sel.resources.map(e => `<div class="prop-row static"><span class="prop-name">${esc(e.object)}</span><span class="prop-stat">${esc(e.resource)}</span></div>`).join("")}</div>` : "";
    // ── three tabs: INTERACTIONS (creatures · resources · each object's rank-0 interaction + the favor-rank tiers that
    // upgrade it) | FAVOR (the god's reward track condensed to the rank) | YIELD (unique-bonus magnitude bars).
    // Each object's favor ranks come straight from the user's grouping in Realm_REF.csv (objects[].favor).
    // In "My ranks" mode the slider shows/edits THIS realm's tracked favor rank (persisted).
    const rank = rankFor(sel);
    const uCols = favUnique(), gCols = favGeneric();
    const view = ["interactions", "list", "bars"].includes(ovState.favorView) ? ovState.favorView : "interactions";
    const tab = (v, label) => `<button class="av-tab ${view === v ? "on" : ""}" data-action="realm-favview" data-v="${v}">${label}</button>`;
    const viewToggle = `<div class="art-view-toggle realm-tabs">${tab("interactions", "Interactions")}<span class="av-pipe">|</span>${tab("list", "Favor")}<span class="av-pipe">|</span>${tab("bars", "Yield")}</div>`;
    const commonToggle = `<label class="fav-common"><input type="checkbox" data-action="realm-common" ${ovState.showCommon ? "checked" : ""}> Show common (all-realm) bonuses</label>`;
    const rankNote = ovState.useCustom ? `<div class="slot-sub" style="margin:-4px 0 6px">Tracking <b>your</b> favor rank for this realm — drag to update it (saved).</div>` : "";
    // each Object = one container: header (icon · name · count), then one row per effect — the base interaction
    // as favor rank 0, followed by every favor-rank tier that upgrades it
    const objRow = (at, effect) => `<div class="robj-tier"><span class="fav-tier-rk" title="Favor rank">${at}</span><span>${esc(effect)}</span></div>`;
    const objects = sel.objects.length ? `<div class="section-label">Objects</div>
      <div class="robj-cards">${sel.objects.map(o => `<div class="robj-card">
        <div class="robj-card-head"><span class="realm-obj-ico">${o.sprite ? spriteImg(o.sprite, "px") : ""}</span>
          <b>${esc(o.name)}</b>${o.baseCount != null ? `<span class="realm-obj-ct"${o.countNote ? ` title="${esc(o.countNote)}"` : ""}>×${o.baseCount}</span>` : ""}</div>
        <div class="robj-tiers">${o.base ? objRow(0, o.base) : ""}${(o.favor || []).slice().sort((x, y) => x.at - y.at).map(t => objRow(t.at, t.effect)).join("")}</div></div>`).join("")}</div>` : "";
    const interactionsView = `${creatures}${resources}${objects}`;
    const barsView = `${yieldDiffToggle()}${favorSlider(rank)}${rankNote}${commonToggle}
      <div class="rcat-list">${uCols.map((c, i) => { const v = favVal(sel, i, rank);
        return `<div class="rcat-row rcat-static${v ? "" : " rcat-empty"}" data-rid="${sel.id}" data-ci="${i}"><span class="rcat-name">${esc(c.label)}</span>${favBar(c, v)}</div>`; }).join("")}</div>
      ${ovState.showCommon ? `<div class="section-label">Common bonuses (every realm)</div>
        <div class="rcat-list">${gCols.map((c, j) => { const i = uCols.length + j, v = favVal(sel, i, rank);
          return `<div class="rcat-row rcat-static rcat-generic${v ? "" : " rcat-empty"}" data-rid="${sel.id}" data-ci="${i}"><span class="rcat-name">${esc(c.label)}</span><span class="rcat-val rcat-val-wide">${fmtFav(c, v)}</span></div>`; }).join("")}</div>` : ""}`;
    // FAVOR: the god's Favor Reward track condensed to `rank`. Blessing ranks show this realm's unique effect
    // (sel.traits joined by rank); every other rank shows the common bonus from Favor_REF (hidden unless toggled).
    const traitByAt = {}; (sel.traits || []).forEach(t => { traitByAt[t.at] = t.effect; });
    const tierRows = (D.favorCommon || []).filter(c => ovState.showCommon || c.blessing).map(c => {
      const uniq = c.blessing, eff = uniq ? (traitByAt[c.rank] || c.effect) : c.effect;
      return `<div class="fav-tier${uniq ? " fav-tier-uniq" : ""}" data-rank="${c.rank}"${c.rank <= rank ? "" : ` style="display:none"`}><span class="fav-tier-rk">${c.rank}</span><span class="fav-tier-eff">${esc(eff)}</span>${uniq ? `<span class="fav-tier-tag">unique</span>` : ""}</div>`;
    }).join("");
    const listView = `${favorSlider(rank)}${rankNote}${commonToggle}
      <div class="fav-tiers">${tierRows}</div>`;
    // complex-interaction combination table (5 realms have a combine-objects puzzle)
    const combos = sel.combinations ? `<div class="section-label" style="margin-top:12px">Complex Interaction — ${esc(sel.combinations.title)}</div>
      <div class="realm-combos">${sel.combinations.rows.map(c => `<div class="rc-row"><span class="rc-combo">${esc(c.combo)}</span><span class="rc-arrow">→</span><span class="rc-result">${esc(c.result)}</span></div>`).join("")}</div>
      <div class="slot-sub" style="margin-top:4px">${esc(sel.combinations.note)}</div>` : "";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><button class="btn-ghost" data-action="realm-back">‹ Realms</button>
        <h2 style="flex:1">${esc(sel.realm)}</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="realm-detail-head">${(() => {
          // icon defaults to the Realm|God toggle at selection time; tap to swap (aesthetic) when both exist
          const canSwap = !!(sel.icon && sel.godBattle);
          const useGod = (ovState.detailIco || (ovState.sortBy === "god" ? "god" : "realm")) === "god";
          const ico = useGod ? (sel.godBattle || sel.icon) : (sel.icon || sel.godBattle);
          return ico ? `<div class="realm-icon-lg${canSwap ? " swap" : ""}"${canSwap ? ` data-action="realm-swapico" title="Tap to swap icon"` : ""}>${spriteImg(ico, "px")}</div>` : ""; })()}
          <div class="spell-stats" style="flex:1">${facts}</div></div>
        ${viewToggle}${view === "interactions" ? interactionsView + combos : view === "list" ? listView : barsView}
      </div></div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="realm-back">‹ Back to realms</button>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  function openSynergy() { ovState = { kind: "synergy", view: "matrix", sharedOnly: false, expanded: new Set(), listCollapsed: new Set(), render: renderSynergy }; openOverlay(ovState.render()); }

  // Matrix view — rows = members (Spec/Anointments/creatures expandable to their effect sub-rows),
  // columns = tags. A member cell shows its CONTRIBUTION COUNT as a number (1 if a single contributor,
  // higher for a stack); the collapsible sub-rows use a dot (each is a single effect). The sticky bottom
  // row totals the individual contributions per tag (11 Attack perks → 11). Cells/columns are coloured by
  // how the tag is SHARED across members: green = shared with the Spec, yellow = shared among others but
  // not the Spec, red = only one member has it.
  function synergyMatrixBody(st) {
    const members = buildTagCarriers();
    const weight = new Map();   // tag → total individual contributions across the build (each effect counts)
    const deg = new Map();      // tag → number of DISTINCT members carrying it
    const specHas = new Set();  // tags the Spec carries
    for (const m of members) {
      for (const [k, n] of m.counts) weight.set(k, (weight.get(k) || 0) + n);
      for (const k of m.counts.keys()) deg.set(k, (deg.get(k) || 0) + 1);
      if (m.kind === "spec") for (const k of m.counts.keys()) specHas.add(k);
    }
    const shareClass = (k) => (deg.get(k) || 0) < 2 ? "xc-none" : specHas.has(k) ? "xc-spec" : "xc-other";
    let tags = [...weight.keys()];
    if (st.sharedOnly) tags = tags.filter(k => (deg.get(k) || 0) >= 2);
    tags.sort((a, b) => weight.get(b) - weight.get(a)
      || taxoCatName(a).localeCompare(taxoCatName(b))
      || taxoValName(a).localeCompare(taxoValName(b)));
    const sharedCount = [...deg.values()].filter(n => n >= 2).length;
    const meta = `${members.length} member${members.length === 1 ? "" : "s"} · ${sharedCount} shared tag${sharedCount === 1 ? "" : "s"}`;
    if (!members.length) return { meta, body: `<div class="slot-sub" style="padding:14px">Add a specialization, anointments and creatures to see the tag matrix.</div>` };
    if (!tags.length) return { meta, body: `<div class="slot-sub" style="padding:14px">No ${st.sharedOnly ? "shared " : ""}tags in the current build yet.</div>` };
    const kindCls = { spec: "k-spec", anoint: "k-anoint", crea: "k-crea" };
    const head = `<thead><tr><th class="xref-corner">Member \\ Tag</th>${tags.map(k =>
      `<th><div class="xref-colhead"><span class="xc-dot ${shareClass(k)}"></span><span class="xc-name" title="${esc(taxoCatName(k))} → ${esc(taxoValName(k))}">${esc(taxoCatName(k))}: ${esc(taxoValName(k))}</span></div></th>`).join("")}</tr></thead>`;
    const rowFor = (m) => {
      const expandable = m.children && m.children.length;
      const isExp = expandable && st.expanded.has(m.id);
      const unit = m.kind === "crea" ? "traits" : m.kind === "anoint" ? "anointments" : "perks";
      const caret = expandable
        ? `<span class="xr-exp" data-action="matrix-expand-row" data-id="${m.id}" title="${isExp ? "Collapse" : "Expand"} ${unit}">${isExp ? "▾" : "▸"}</span>`
        : `<span class="xr-exp-sp"></span>`;
      const cells = tags.map(k => { const n = m.counts.get(k) || 0; return n
        ? `<td class="${shareClass(k)}" title="${esc(m.label)} — ${esc(taxoValName(k))} ×${n}">${n}</td>`
        : `<td></td>`; }).join("");
      let out = `<tr><th class="xref-rowhead" title="${esc(m.label)}${m.sub ? " · " + esc(m.sub) : ""}">${caret}<span class="xr-dot ${kindCls[m.kind] || ""}"></span><b>${esc(m.label)}</b>${m.sub ? `<span class="xr-cat">${esc(m.sub)}</span>` : ""}</th>${cells}</tr>`;
      if (isExp) for (const ch of m.children) {
        const ccells = tags.map(k => ch.tags.has(k)
          ? `<td class="xc-latent" title="${esc(ch.label)} — ${esc(taxoValName(k))}">•</td>`
          : `<td></td>`).join("");
        out += `<tr class="xref-subrow"><th class="xref-rowhead xref-subhead" title="${esc(ch.label)}${ch.sub ? " · " + esc(ch.sub) : ""}">${esc(ch.label)}</th>${ccells}</tr>`;
      }
      return out;
    };
    const rows = members.map(rowFor).join("");
    // sum EACH TAG: total individual contributions (coloured by share status like the cells above)
    const sumRow = `<tr class="xref-shared"><th class="xref-rowhead">Contributions</th>${tags.map(k =>
      `<td class="${shareClass(k)}">${weight.get(k)}</td>`).join("")}</tr>`;
    return { meta, body: `<div class="xref-wrap"><table class="xref-table">${head}<tbody>${rows}${sumRow}</tbody></table></div>` };
  }

  // List view — collapsible group per shared tag (+ a jump-link bar to any group).
  function synergyListBody(st) {
    const effects = buildTagEffects();
    const tagMap = new Map();
    for (const ef of effects) for (const k of ef.tags) (tagMap.get(k) || tagMap.set(k, []).get(k)).push(ef);
    const shared = [...tagMap.entries()].filter(([, es]) => es.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || taxoValName(a[0]).localeCompare(taxoValName(b[0])));
    st.lastShared = shared.map(([k]) => k);
    const meta = `${effects.length} build effect${effects.length === 1 ? "" : "s"}`;
    if (!shared.length) {
      const msg = effects.length ? "No tags are shared across your build's effects yet — add more matching pieces." : "Add a specialization, anointments and creatures to see shared tags.";
      return { meta, body: `<div class="ovl-center-scroll"><div class="slot-sub" style="padding:12px">${msg}</div></div>` };
    }
    const kindCls = { Perk: "k-spec", Anointment: "k-anoint", Trait: "k-crea", Spell: "k-spell", Relic: "k-crea" };
    const allCollapsed = shared.every(([k]) => st.listCollapsed.has(k));
    const jumpbar = `<div class="syn-navbar">
      <button class="btn-ghost" data-action="syn-collapse-all">${allCollapsed ? "Expand all" : "Collapse all"}</button>
      <select class="syn-nav" data-action="syn-nav" title="Jump to a shared tag">
        <option value="">Jump to tag…</option>
        ${shared.map(([k, es]) => `<option value="${esc(k)}">${esc(taxoValName(k))} · ${esc(taxoCatName(k))} (${es.length})</option>`).join("")}
      </select>
    </div>`;
    const groups = shared.map(([k, es]) => {
      const collapsed = st.listCollapsed.has(k);
      return `<div class="syn-group ${collapsed ? "collapsed" : ""}" data-key="${esc(k)}">
        <button class="syn-tag" data-action="syn-toggle" data-key="${esc(k)}">
          <span class="syn-count">×${es.length}</span><b>${esc(taxoValName(k))}</b><span class="opt-chev">${esc(taxoCatName(k))}</span>
          <span class="syn-caret">${collapsed ? "▸" : "▾"}</span></button>
        ${collapsed ? "" : `<div class="syn-effs">${es.map(e => `<div class="syn-eff">
          <div class="syn-eff-head"><b>${esc(e.name)}</b><span class="syn-owner ${kindCls[e.kind] || ""}" title="${esc(e.kind)}">${esc(e.owner)}</span></div>
          ${e.desc ? `<div class="trait-desc">${e.desc}</div>` : ""}</div>`).join("")}</div>`}
      </div>`;
    }).join("");
    return { meta, body: `${jumpbar}<div class="ovl-center-scroll"><div class="section-label">Shared tags — ${shared.length}</div><div class="syn-list">${groups}</div></div>` };
  }

  function renderSynergy() {
    const st = ovState;
    const { body, meta } = st.view === "list" ? synergyListBody(st) : synergyMatrixBody(st);
    const seg = `<div class="seg">
      <button class="seg-btn ${st.view !== "list" ? "on" : ""}" data-action="synergy-view" data-view="matrix">Matrix</button>
      <button class="seg-btn ${st.view === "list" ? "on" : ""}" data-action="synergy-view" data-view="list">List</button></div>`;
    const sharedBtn = st.view === "list" ? "" : `<button class="facet ${st.sharedOnly ? "on" : ""}" data-action="toggle-matrix-shared" title="Only tags shared by ≥2 members">Shared only</button>`;
    const legend = st.view === "list" ? "" : `<span class="xref-legend"><span class="lg xc-spec" title="Shared with your Spec">●</span>Spec<span class="lg xc-other" title="Shared among members, not the Spec">●</span>Shared<span class="lg xc-none" title="Only one member has it">●</span>Solo</span>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Synergy</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="ovl-filterbar">${seg}${sharedBtn}${legend}<span class="foot-info">${meta}</span></div>
        ${body}
      </div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── anointments — equip up to 5 anointment-eligible perks from any spec (flags from Perk_REF.csv) ──
  // In-game, anointments let you slot perks from OTHER specializations; the cap is 5 equipped
  // (raised up to 20 by Royal's Master of All / Highborn perks — see anointMax()).
  // A single Anointment point grants the perk's FULL bonus (as if maxed), so descriptions here
  // resolve their <N> value at the perk's max rank — not rank 1.
  let ANOINTS = null;
  // Exclude Highborn (Royal's cap-raiser — works only in your own spec tree, not as an anoint) and any
  // spec with no affiliated False God (removes the "Other" group — Highborn was its only member).
  const perkAnointable = (s, p) => !!(p.anointment && s.falseGod && p.key !== "HIGHBORN");
  const noAnointMark = (s, p) => perkAnointable(s, p) ? "" : `<span class="no-anoint" title="Can't be anointed">⊘</span>`;
  function anointList() {
    if (ANOINTS) return ANOINTS;
    ANOINTS = [];
    for (const s of D.specs) for (const p of s.perks)
      if (perkAnointable(s, p))
        ANOINTS.push({ ...p, spec: s.label, specId: s.id, falseGod: s.falseGod });
    ANOINTS.sort((a, b) => a.spec.localeCompare(b.spec) || a.name.localeCompare(b.name));
    return ANOINTS;
  }
  const anointEquipped = (a) => build.anoints.some(x => x.specId === a.specId && x.key === a.key);
  const equippedAnointObjs = () => build.anoints.map(x => anointList().find(a => a.specId === x.specId && a.key === x.key)).filter(Boolean);
  function openAnoint() {
    ovState = { kind: "anoint", search: "", specFilter: null, godFilter: null, collapsedGods: [], draft: build.anoints.map(x => ({ ...x })), render: renderAnoint };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  let ANOINT_SPECS = null;
  const anointSpecs = () => ANOINT_SPECS || (ANOINT_SPECS = [...new Set(anointList().map(a => a.spec))].sort());
  function renderAnoint() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = anointList().filter(a =>
      (!q || a.name.toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q)) &&
      (!st.godFilter || a.falseGod === st.godFilter) &&
      (!st.specFilter || a.spec === st.specFilter) &&
      (!st.bkOnly || bookmarks.perks.includes(a.key)) &&
      TagFilter.match(st, "anoint", a));
    const godChip = st.godFilter
      ? `<button class="facet on" data-action="anoint-fgod">False God: ${(godByKey.get(st.godFilter) || {}).icon ? `<span class="tag-ico">${spriteImg(godByKey.get(st.godFilter).icon, "px")}</span>` : ""}<b>${esc(godName(st.godFilter))}</b> <span class="facet-x" data-action="anoint-fgod-clear">✕</span></button>`
      : `<button class="facet" data-action="anoint-fgod">False God ▾</button>`;
    const specChip = st.specFilter
      ? `<button class="facet on" data-action="anoint-spec">Spec: ${specEmblemIco(st.specFilter)}<b>${esc(st.specFilter)}</b> <span class="facet-x" data-action="anoint-spec-clear">✕</span></button>`
      : `<button class="facet" data-action="anoint-spec">Spec ▾</button>`;
    const bkChip = bookmarks.perks.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="anoint-bkonly" title="Show only bookmarked perks">★ Bookmarked</button>` : "";
    const filterbar = `<div class="ovl-filterbar">${godChip}${specChip}${TagFilter.bar(st, "anoint")}${bkChip}</div>`;
    const draft = st.draft, full = draft.length >= anointMax();
    const picked = (a) => draft.some(x => x.specId === a.specId && x.key === a.key);
    const anointRow = (a) => { const on = picked(a), inCur = a.specId === build.specId;
      // a perk from your current spec is already in your tree: it can't be picked (removing it stays allowed)
      const blocked = !on && (inCur || full);
      return `<div class="perk-line anoint-pick${on ? " equipped" : ""}${blocked ? " blocked" : ""}${inCur ? " anoint-incur" : ""}"${blocked ? "" : ` data-action="anoint-pick" data-sid="${a.specId}" data-k="${esc(a.key)}"`}${inCur && !on ? ` title="Already available in your current specialization"` : ""}>
        <div class="apx-iconcol apx-clickable" data-action="apx-open" data-ek="perk" data-eid="${esc(a.key)}" title="View taxonomy">${a.icon ? `<div class="apx-crea">${spriteImg(a.icon, "px")}</div>` : ""}</div>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta">${specTagHtml(a.spec)}${inCur ? `<span class="anoint-badge">Current spec</span>` : ""}${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}</span>${bkBtn("perks", a.key)}</div>
          ${a.desc ? `<div class="perk-desc">${perkText(a.desc, a.ranks)}</div>` : ""}
        </div>
        ${on ? `<span class="anoint-check">✓</span>` : ""}
        </div>`; };
    const byName = (a, b) => a.spec.localeCompare(b.spec) || a.name.localeCompare(b.name);
    // group by the affiliated False God (pipeline order), sub-sorted by spec → name
    const byGod = new Map();
    for (const a of list) (byGod.get(a.falseGod) || byGod.set(a.falseGod, []).get(a.falseGod)).push(a);
    const godOrder = FALSE_GODS.map(g => g.key).filter(k => byGod.has(k));
    for (const k of byGod.keys()) if (!godOrder.includes(k)) godOrder.push(k);   // any unmapped bucket last
    const body = godOrder.map(k => {
      const g = godByKey.get(k);
      const rows = byGod.get(k);
      const collapsed = (st.collapsedGods || []).includes(k);
      const caret = `<span class="fgod-caret">${collapsed ? "▸" : "▾"}</span>`;
      const count = `<span class="fgod-count">${rows.length}</span>`;
      const head = g
        ? `<button class="fgod-head" data-action="anoint-god-toggle" data-k="${esc(k)}">${caret}<span class="fgod-portrait">${spriteImg(g.img, "px")}</span><span class="fgod-name">${esc(g.name)}</span>${count}</button>`
        : `<button class="fgod-head" data-action="anoint-god-toggle" data-k="${esc(k)}">${caret}<span class="fgod-name">Other</span>${count}</button>`;
      const rowsHtml = collapsed ? "" : rows.slice().sort(byName).map(anointRow).join("");
      return `<div class="fgod-group">${head}${rowsHtml}</div>`;
    }).join("")
      || `<div class="slot-sub" style="padding:10px">No anointments match.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Anointments</h2>
        <input class="ovl-search" placeholder="Search anointments…" value="${esc(st.search)}" data-action="anoint-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        ${filterbar}
        <div class="ovl-center-scroll"><div class="perk-list">${body}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info">${draft.length}/${anointMax()} selected${full ? " · full" : ""}</span>
        <button class="btn-confirm" data-action="anoint-commit">Equip</button></div>
    </div></div>`;
  }

  // anoint detail (view) — lists the equipped anointment perks; Edit routes back to the picker
  function openAnointDetail() {
    if (!build.anoints.length) { openAnoint(); return; }
    dovState = { kind: "anoint-detail", render: renderAnointDetail };
    openDetail(dovState.render());
  }
  function renderAnointDetail() {
    const eq = equippedAnointObjs();
    const rows = eq.map(a => `<div class="perk-line apx-clickable" data-action="apx-open" data-ek="perk" data-eid="${esc(a.key)}">
        <div class="apx-iconcol">${a.icon ? `<div class="apx-crea">${spriteImg(a.icon, "px")}</div>` : ""}</div>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta">${specTagHtml(a.spec)}${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}</span></div>
          ${a.desc ? `<div class="perk-desc">${perkText(a.desc, a.ranks)}</div>` : ""}
        </div></div>`).join("")
      || `<div class="slot-sub" style="padding:10px">No anointments equipped.</div>`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Anointments</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="ovl-filterbar"><span class="foot-info">${eq.length}/${anointMax()} equipped — each grants its full bonus.</span></div>
        <div class="ovl-center-scroll"><div class="perk-list">${rows}</div></div>
      </div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div><button class="btn-ghost" data-action="anoint-edit">Edit</button>
        <button class="btn-confirm" data-action="close-detail">Done</button></div></div>
    </div></div>`;
  }

  // ── artifact library (equip) ───────────────────────────────────────────────
  function openArtifactLibrary(slotIdx) {
    // no auto-selection — tiles show equip state (purple = this creature, gold = another); user picks to act
    ovState = { kind: "artlib", slotIdx, hideEquipped: false, sel: null, search: "", libType: null, libSort: "type", render: renderArtifactLibrary };
    openOverlay(ovState.render());
  }
  const libRow = (ico, name, sub, tail = "") => `<div class="prop-row static"><span class="prop-ico">${ico ? spriteImg(ico, "px") : ""}</span><span class="prop-name">${esc(name)}${tail}</span>${sub ? `<span class="prop-stat">${esc(sub)}</span>` : ""}</div>`;
  // a row that also shows the granted trait's tooltip (for trait-item entries in info panels)
  const libTraitRow = (ico, name, traitId) => {
    const tr = traitId != null ? TRAIT[traitId] : null;
    // clickable → the trait's taxonomy detail (same as a creature's innate-trait banner)
    const open = tr ? ` data-action="apx-open" data-ek="trait" data-eid="${traitId}"` : "";
    return `<div class="prop-row static rich${tr ? " apx-clickable" : ""}"${open}><span class="prop-ico">${ico ? spriteImg(ico, "px") : ""}</span>
      <div class="prop-body"><span class="prop-name">${esc(name)}</span>
        ${tr ? `<span class="prop-stat">grants <b>${esc(tr.name)}</b></span><div class="trait-desc">${richText(tr.desc || "")}</div>` : ""}</div></div>`;
  };
  function artContentRows(a, opts = {}) {
    const r = [];
    // opts.empties: after each slot group's filled rows, one dashed row per unfilled slot (opens the editor via
    // opts.emptyAction) — or a locked row when the artifact's rank hasn't unlocked that slot yet
    const empty = (key) => { if (!opts.empties) return; const sl = ART_SLOTS.find(x => x.key === key), open = artOpen(sl, a.rank || 50);
      const act = opts.emptyAction || `data-action="artpage-edit"`;
      for (let i = (a[key] || []).length; i < sl.max; i++) r.push(i < open
        ? `<div class="prop-row art-empty-slot" ${act} data-t="${sl.pick}" title="Add a ${esc(sl.label)}">
        <span class="prop-ico">＋</span><span class="prop-name">Empty ${esc(sl.label)} slot</span></div>`
        : `<div class="prop-row art-empty-slot locked"><span class="prop-ico">🔒</span><span class="prop-name">${esc(sl.label)} slot</span><span class="prop-stat">Tier ${sl.unlock[i]}</span></div>`); };
    // right side = what the socket adds at this rank (same numbers as the Bonuses view), e.g. "+59% Attack"
    const eff = (part, dflt) => { const { core, extra } = FX.foldBonus(FX.artifactContribs({ rank: a.rank || 50, ...part }));
      return [...STAT_KEYS.filter(k => core[k]).map(k => `+${fmtNum(core[k])}% ${STAT_LABEL[k]}`),
        ...[...extra].map(([p, { value, unit }]) => `+${fmtNum(value)}${unit === "%" ? "%" : ""} ${p}`)].join(" · ") || dflt; };
    if (a.primary) r.push(libRow(primaryIconAt(a.primary, a.rank), a.primary, eff({ primary: a.primary }, "primary")));
    for (const n of a.stat || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, eff({ stat: [n] }, n))); }
    empty("stat");
    for (const n of a.trick || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, eff({ trick: [n] }, n))); }
    empty("trick");
    for (const id of a.traits || []) { const t = TRAITITEM.get(id); r.push(libTraitRow(t && t.icon, t ? t.name : id, t ? t.traitId : null)); }
    empty("traits");
    for (const id of a.spells || []) { const sp = SPELL.get(id); r.push(libRow(spellIcon(sp), sp ? sp.name : id, sp ? (sp.cls || "spell") : "spell")); }
    empty("spells");
    for (const id of a.netherIds || []) { const nn = nether.find(x => x.id === id); r.push(libRow(gemSrc(nn), nn ? nn.name : id, "nether")); }
    empty("netherIds");
    return r.join("") || `<div class="slot-sub" style="padding:8px">Empty artifact.</div>`;
  }
  // artifact TYPE (its primary property) → the trigger its native spell-gem slot fires on.
  // Nether-stone spells socketed into the artifact carry their own stored trigger instead.
  const ART_TYPE_TRIGGER = { Helmet: "On Provoke", Sword: "On Attack", Staff: "On Cast", Shield: "On Defend", Boots: "On Turn" };
  // ── Spell Gem Slot activation chance (code-grounded model D.slotChance; _su_extract ARTIFACTS.md).
  // Artifact slot: base[type] → Smith p3 ×1.1 → (stone carries ANY spell ⇒ reset to base, or 100 with The Truth) →
  // + Hidden Hand 2/rank → + Battle Born 10; Ferro (rank ≥ 80) = second roll; Celebrate Decline = casts twice.
  // Nether spell: base[trigger], or 100 with The Truth. Luck re-rolls (Sleight of Hand / realm Luck) intentionally
  // not applied. Party = the player's side, so every player-only modifier applies.
  const SC = D.slotChance;
  const partyHasTrait = (tid) => tid != null && build.slots.some(s => s && s.cid != null && slotTraitIds(s).includes(tid));
  const hiddenHandRank = () => {
    const s = curSpec(), sp = s && s.perks.find(x => x.key === "HIDDENHAND"); let r = sp ? perkRank(s, sp) : 0;
    if ((build.anoints || []).some(x => x.key === "HIDDENHAND")) { const p = perkByKey("HIDDENHAND"); r = Math.max(r, p ? p.ranks : 0); }
    return r;
  };
  const artHasStoneSpell = (a) => (a.netherIds || []).some(nid => { const n = nether.find(x => x.id === nid); return n && (n.props || []).some(p => p.cat === "spell"); });
  function artSlotChance(a, slot) {
    if (!SC || !a || SC.base[a.primary] == null) return null;
    const base = SC.base[a.primary], parts = [`${a.primary} base ${base}%`];
    const truth = SC.truth && partyHasTrait(SC.truth.traitId);
    let c;
    if (artHasStoneSpell(a)) { c = truth ? SC.truth.value : base; parts.push(truth ? "The Truth → 100%" : "nether stone spell: chance resets to base"); }
    else { c = base; if (SC.smith && cardLevel(SC.smith.cardId) >= SC.smith.power) { c *= SC.smith.mult; parts.push("Smith card set ×1.1"); } }
    const hh = SC.hiddenHand ? hiddenHandRank() : 0;
    if (hh) { c += SC.hiddenHand.perRank * hh; parts.push(`Hidden Hand +${SC.hiddenHand.perRank * hh}%`); }
    if (SC.battleBorn && partyHasTrait(SC.battleBorn.traitId)) { c += SC.battleBorn.add; parts.push(`Battle Born +${SC.battleBorn.add}%`); }
    const p = Math.max(0, Math.min(100, Math.round(c)));
    const ferro = !!(SC.ferro && slot && slot.relic && slot.relic.id === SC.ferro.relicId && (+slot.relic.rank || 0) >= SC.ferro.minRank);
    const eff = ferro ? Math.round((1 - (1 - p / 100) ** 2) * 100) : p;
    if (ferro) parts.push(`Ferro: second roll (${p}% → ${eff}%)`);
    const twice = !!(SC.celebrateDecline && partyHasTrait(SC.celebrateDecline.traitId));
    if (twice) parts.push("Celebrate Decline: casts twice");
    return { pct: eff, twice, title: parts.join(" · ") };
  }
  const netherSpellChance = (trigger) => {
    if (!SC || SC.baseByTrigger[trigger] == null) return null;
    const truth = SC.truth && partyHasTrait(SC.truth.traitId);
    return { pct: truth ? 100 : SC.baseByTrigger[trigger], twice: false, title: truth ? "The Truth → 100%" : `${trigger} base ${SC.baseByTrigger[trigger]}%` };
  };
  const chanceTxt = (ch) => ch ? ` · ${ch.pct}%${ch.twice ? " ×2" : ""}` : "";
  // aggregate an artifact's stat contribution at its rank: core 5 stats (% each) + any non-core "trick"
  // effects, keyed by their full property name ("Snared On Damage") with their unit (% or flat count).
  const artifactBonusRows = (a) => FX.foldBonus(FX.artifactContribs(a));
  // render a bonus stat table from a {core, extra} aggregate (shared by artifacts + nether stones)
  function bonusTableHtml(core, extra) {
    const coreRows = STAT_KEYS.map(k => `<div class="stat-row ${core[k] ? "hl-med" : ""}"><span class="stat-name">${STAT_LABEL[k]}</span>
      <span class="stat-val art">${core[k] ? "+" + core[k] + "%" : "—"}</span></div>`).join("");
    const extraRows = [...extra].map(([prop, { value, unit }]) => `<div class="stat-row hl-med"><span class="stat-name">${esc(prop)}</span>
      <span class="stat-val art">+${value}${unit === "%" ? "%" : ""}</span></div>`).join("");
    return `<div class="stat-grid single">${coreRows}${extraRows}</div>`;
  }
  // trait containers mirroring the creature detail (trait banner + description, clickable to taxonomy).
  // Covers trait materials AND traits carried by socketed nether stones, deduped by trait id.
  function artifactTraitContainers(a) {
    const ids = (a.traits || []).map(id => { const ti = TRAITITEM.get(id); return ti ? ti.traitId : null; });
    for (const nid of a.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const pr of n.props || []) if (pr.cat === "trait") { const ti = TRAITITEM.get(pr.key); if (ti) ids.push(ti.traitId); } }
    const seen = new Set();
    return ids.filter(tid => tid != null && !seen.has(tid) && seen.add(tid))
      .map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div>${traitSpellRow(tid, true)}</div>`).join("");
  }
  // a class chip in the creature-class colour (Spells page tiles; `tail` e.g. " → Nature" for a class swap)
  const clsTag = (cls, tail = "") => cls ? `<span class="anoint-spec-tag" style="color:${clsColor(cls)}">${esc(cls)}${tail}</span>` : "";
  // one spell-gem container: name + trigger + description (clickable to the spell's taxonomy). Shared by artifact /
  // nether / relic / boss / owner displays and (opts.tile: class chip + stats) the Spells page's granted-spell tiles.
  let ULT_AVATAR = null;
  const ultAvatar = (spellId) => {
    if (!ULT_AVATAR) {
      ULT_AVATAR = new Map();
      const av = new Map(D.creatures.filter(c => c.race === "Avatar").map(c => [c.name.toLowerCase(), c.name]));
      for (const [rid, sid] of Object.entries(D.relicUltimates || {})) {
        const rl = RELIC.get(+rid), m = rl && /\bof\s+(.+)$/i.exec(rl.name), n = m && av.get(m[1].trim().toLowerCase());
        if (n) ULT_AVATAR.set(sid, n); else console.error("ULTIMATE AVATAR: no Avatar for relic", rid, rl && rl.name);
      }
    }
    return ULT_AVATAR.get(spellId) || null;
  };
  const spellGemCard = (sp, trigger, src, ch, { tile = false } = {}) => {
    const av = ultAvatar(sp.id), avChip = av ? `<span class="anoint-spec-tag ult-avatar" title="Avatar">${esc(av)}</span>` : "";
    const trig = (trigger ? `<span class="art-trigger"${ch ? ` title="Activation chance: ${esc(ch.title)}"` : ""}>${esc(trigger)}${chanceTxt(ch)}</span>` : "") + avChip;
    return `<div class="art-spellcard${tile ? " spell-page-tile" : ""} apx-clickable" data-action="apx-open" data-ek="spell" data-eid="${sp.id}" title="View taxonomy">
    <div class="art-spellcard-head">${spellIco(sp)}<b>${esc(sp.name)}</b>${tile ? `<span class="spt-tags">${clsTag(sp.cls)}${trig}</span>` : trig}</div>
    ${src ? `<div class="slot-sub" style="text-align:left">from ${esc(src)}</div>` : ""}
    ${sp.desc ? `<div class="trait-desc">${perkText(sp.desc)}</div>` : ""}${tile ? spellStatsHtml(sp) : ""}</div>`;
  };
  // Selectable "clean container" cards for the artifact / nether pickers: the full description shows
  // inline (no drill-in to read it), a link jumps to the trait's material/taxonomy, and the card
  // adds/toggles on click. `attrs` carries the owning wizard's action + data-* (art-confirm-add /
  // nether-pickprop). The inner link has its own data-action so it wins over the card's add-on-click.
  const traitPickCard = (t, chosen, attrs) => {
    const tr = t.traitId != null ? TRAIT[t.traitId] : null;
    return `<div class="pick-card${chosen ? " chosen" : ""}" ${attrs}>
      <div class="primary-traits">${traitBanner(t.traitId)}<div class="trait-desc">${tr ? richText(tr.desc || "") : esc(t.traitName || "")}</div></div>
      <button class="pick-card-src" data-action="apx-open" data-ek="trait" data-eid="${t.traitId}" title="View trait & material">
        <span class="prop-ico sm">${t.icon ? spriteImg(t.icon, "px") : ""}</span><span>${esc(t.name)}</span></button>
    </div>`;
  };
  // spell-gem containers for an artifact: native slot fires on the type trigger; nether stones keep their own
  function artifactSpellContainers(a, slot) {
    slot = slot || build.slots.find(s => s && s.artifactId === a.id) || null;   // equipped → that creature's relic counts
    const rows = [], typeTrig = ART_TYPE_TRIGGER[a.primary], ach = artSlotChance(a, slot);
    for (const id of a.spells || []) { const sp = SPELL.get(id); if (sp) rows.push(spellGemCard(sp, typeTrig, null, ach)); }
    for (const nid of a.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const pr of n.props || []) if (pr.cat === "spell") { const sp = SPELL.get(pr.key); if (sp) rows.push(spellGemCard(sp, pr.trigger, n.name, netherSpellChance(pr.trigger))); } }
    return rows.join("");
  }
  // "Bonuses" view (vs the raw "Sockets" list): Traits → Spell Gems → stat table
  function artifactBonusView(a) {
    const { core, extra } = artifactBonusRows(a);
    const traits = artifactTraitContainers(a), spells = artifactSpellContainers(a);
    return `${traits ? `<div class="section-label">Traits</div>${traits}` : ""}
      ${spells ? `<div class="section-label" ${traits ? `style="margin-top:12px"` : ""}>Spell Gems</div><div class="art-spellcards">${spells}</div>` : ""}
      <div class="section-label" ${traits || spells ? `style="margin-top:12px"` : ""}>Stat bonuses · rank ${a.rank || 50}</div>
      ${bonusTableHtml(core, extra)}`;
  }
  // Loadout rule (mirrors freely re-socketing stones in-game): a Nether Stone may sit in any number of saved
  // artifacts, but only ONE artifact holding it can be equipped across the active party — same as an artifact
  // itself can only be equipped by one creature.
  // equipped artifacts holding stone `nid`, other than `exceptArtId` and other than the one on `exceptSlot`
  // (the slot being equipped — its current artifact is about to be replaced) → [{art, slotIdx}]
  const netherUsers = (nid, exceptArtId, exceptSlot = null) => {
    const out = [];
    build.slots.forEach((s, i) => { if (i === exceptSlot) return; const b = resolveArtifact(s);
      if (b && b.id !== exceptArtId && (b.netherIds || []).includes(nid)) out.push({ art: b, slotIdx: i }); });
    return out;
  };
  // first socketed stone of `a` already in use by ANOTHER equipped artifact → {nid, art, slotIdx} | null
  const artNetherClash = (a, exceptSlot = null) => {
    for (const nid of (a && a.netherIds) || []) { const u = netherUsers(nid, a.id, exceptSlot); if (u.length) return { nid, ...u[0] }; }
    return null;
  };
  // the party slot an artifact being built/edited is (or will be, on save) equipped to; null = not in the loadout
  const artTargetSlot = (artId, slotIdx) => {
    const held = artId != null ? build.slots.findIndex(s => s.artifactId === artId) : -1;
    return held >= 0 ? held : (slotIdx != null ? slotIdx : null);
  };
  const clashText = (cl) => {
    const n = nether.find(x => x.id === cl.nid), cr = CREA.get(build.slots[cl.slotIdx].cid);
    return `${n ? n.name : "Its Nether Stone"} is already socketed in ${cl.art.name}${cr ? ` (equipped by ${cr.name})` : ""}`;
  };
  const artSearchText = (a) => [a.name, a.primary,
    ...[...(a.stat || []), ...(a.trick || [])].flatMap(n => { const m = MAT_BY_PROP.get(n); return [n, m ? m.name : ""]; }),
    ...(a.traits || []).flatMap(id => { const t = TRAITITEM.get(id); return t ? [t.name, t.traitName || ""] : []; }),
    ...(a.spells || []).map(id => (SPELL.get(id) || {}).name || ""),
    ...(a.netherIds || []).map(id => { const n = nether.find(x => x.id === id); return n ? n.name : ""; })].join(" ").toLowerCase();
  function renderArtifactLibrary() {
    const st = ovState, manage = st.slotIdx == null;
    const slot = manage ? null : build.slots[st.slotIdx], c = slot ? CREA.get(slot.cid) : null;
    const equippedId = slot ? slot.artifactId : null;
    const q = (st.search || "").trim().toLowerCase(), sortK = st.libSort || "recent", d = sortSign(st.libSortRev);
    let list = artifacts.filter(a => (!st.libType || a.primary === st.libType) && (!q || artSearchText(a).includes(q)));
    if (st.hideEquipped) list = list.filter(a => !artifactEquippedInBuild(a.id) || a.id === equippedId);
    list = list.slice().sort(sortK === "name" ? (x, y) => d * x.name.localeCompare(y.name)
      : sortK === "rank" ? (x, y) => d * ((y.rank || 50) - (x.rank || 50)) || x.name.localeCompare(y.name)
      : sortK === "type" ? (x, y) => d * String(x.primary || "").localeCompare(String(y.primary || "")) || x.name.localeCompare(y.name)
      : (x, y) => d * (y.id - x.id));
    const libBar = `<div class="ovl-filterbar lib-bar">
        <select class="app-select${st.libType ? " on" : ""}" data-action="lib-type" title="Filter by artifact type">
          <option value="" ${!st.libType ? "selected" : ""}>Type</option>${PRIMARY.map(p => `<option value="${esc(p.property)}" ${st.libType === p.property ? "selected" : ""}>${esc(p.property)}</option>`).join("")}</select>
        <span class="sg-sort-gap"></span>
        ${libSortSeg(st, [["recent", "Recent", true], ["name", "A–Z", false], ["rank", "Rank", true], ["type", "Type", false]])}</div>`;
    const sel = st.sel != null ? artifacts.find(a => a.id === st.sel) : null;
    // tile equip-state: purple = equipped by THIS creature. Equipped by ANOTHER creature is dimmed +
    // not equippable in the equip wizard (mirrors an off-class spell); in manage/Menu mode it keeps the
    // neutral "equipped somewhere" marker so you can still edit/delete it.
    const tiles = list.map(a => {
      const eqHere = !manage && a.id === equippedId;
      const eqOtherRaw = !eqHere && artifactEquippedInBuild(a.id);
      const blocked = !manage && eqOtherRaw;    // equip wizard: on another creature → can't equip here
      const eqOther = manage && eqOtherRaw;     // library marker only
      const clash = artNetherClash(a, manage ? null : st.slotIdx);
      const clashBlocked = !manage && !eqHere && !blocked && !!clash;   // its stone is in use on another creature
      const title = [eqHere ? "Equipped by this creature" : blocked ? "Equipped by another creature — not available" : eqOther ? "Equipped by another creature" : "",
        clash ? clashText(clash) + (clashBlocked ? " — not available" : "") : ""].filter(Boolean).join(" · ");
      return `
      <div class="pick-tile ${st.sel === a.id ? "selected" : ""}${eqHere ? " eq-here" : ""}${blocked || clashBlocked ? " disabled" : ""}${eqOther ? " eq-other" : ""}${clash ? " nether-clash" : ""}" data-action="artlib-sel" data-id="${a.id}"${title ? ` title="${esc(title)}"` : ""}>
        <div class="pt-sprite">${spriteImg(artIcon(a), "px")}</div>
        <div class="pt-name">${esc(a.name)}</div></div>`; }).join("")
      || `<div class="slot-sub" style="padding:10px">No artifacts${artifacts.length ? " match" : " yet — build one"}.</div>`;
    const equippedHere = sel && equippedId === sel.id;
    let info;
    if (sel) {
      // two views: Bonuses (resolved stat table + trait & spell-gem containers) | Sockets (raw socketed items)
      const view = st.artView === "sockets" ? "sockets" : "bonuses";
      const toggle = `<div class="art-view-toggle">
        <button class="av-tab ${view === "bonuses" ? "on" : ""}" data-action="art-view" data-v="bonuses">Bonuses</button>
        <span class="av-pipe">|</span>
        <button class="av-tab ${view === "sockets" ? "on" : ""}" data-action="art-view" data-v="sockets">Sockets</button></div>`;
      const viewBody = view === "sockets" ? `<div class="prop-list">${artContentRows(sel, { empties: true, emptyAction: `data-action="art-edit" data-id="${sel.id}"` })}</div>` : artifactBonusView(sel);
      const selClash = artNetherClash(sel, manage ? null : st.slotIdx);
      const otherNote = (!manage && !equippedHere && artifactEquippedInBuild(sel.id)
        ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">Equipped by another creature — unequip it there first to use it here.</div>` : "")
        + (selClash ? `<div class="slot-sub sg-clsnote clash-note">${esc(clashText(selClash))}${!manage && !equippedHere ? " — unequip that artifact first to use this one here" : ""}.</div>` : "");
      info = `<div class="ns-info-head"><span class="ns-info-icon">${spriteImg(artIcon(sel), "px")}</span><h3>${esc(sel.name)}</h3></div>
        ${otherNote}${toggle}${viewBody}`;
    }
    // footer selector bar (mirrors Builds): Edit/Delete act on the selection; the confirm button
    // switches between Equip (artifact selected, equip mode) and ＋ Build new artifact (none selected).
    const selOnOther = !manage && sel && !equippedHere && artifactEquippedInBuild(sel.id);   // on another creature
    const selStoneClash = !manage && sel && !equippedHere && !!artNetherClash(sel, st.slotIdx);   // a stone is in use elsewhere
    const selBlocked = selOnOther || selStoneClash;
    const canEquip = !manage && sel && !selBlocked;
    // single context-aware primary button: Unequip (this one is equipped) / Equip (a different selection) /
    // Build (manage mode, or nothing selected to equip).
    const onCreature = manage && sel && artifactEquippedInBuild(sel.id);   // menu mode: can't equip, but can unequip
    const holder = onCreature ? build.slots.map(s => s.artifactId === sel.id && CREA.get(s.cid)).find(Boolean) : null;
    const confAction = onCreature ? "art-unequip-any" : !canEquip ? "art-new" : equippedHere ? "art-unequip" : "art-equip";
    const confLabel = onCreature ? "Unequip" : !canEquip ? "Build" : equippedHere ? "Unequip" : "Equip";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Artifacts${manage ? "" : " — " + esc(c ? c.name : "")}</h2>
        <input class="ovl-search" placeholder="Search name or socketed item…" value="${esc(st.search || "")}" data-action="lib-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect">${libBar}<div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
        ${sel ? `<div class="ovl-right lib-info">${info}</div>` : ""}
      </div>
      <div class="overlay-footer"><button class="facet ${st.hideEquipped ? "on" : ""}" data-action="artlib-hide-equipped">Hide equipped</button>
        <div>
          <button class="btn-ghost" data-action="art-edit" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Edit</button>
          <button class="btn-ghost danger" data-action="art-del" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Delete</button>
          ${selBlocked
            ? `<button class="btn-confirm" style="min-width:96px" disabled title="${selOnOther ? "Equipped by another creature" : "Its Nether Stone is socketed in an artifact equipped on another creature"}">Can't equip</button>`
            : `<button class="btn-confirm" style="min-width:96px" data-action="${confAction}"${confAction === "art-equip" || confAction === "art-unequip-any" ? ` data-id="${sel.id}"` : ""}${holder ? ` title="Unequip from ${esc(holder.name)}"` : ""}>${confLabel}</button>`}
        </div></div>
    </div></div>`;
  }

  // full-screen artifact page (detail overlay on top of the library list; ‹ Artifacts backs out to the list)
  function openArtifactPage(artId, slotIdx) {
    dovState = { kind: "artpage", artId, slotIdx, view: "bonuses", render: renderArtifactPage };
    openDetail(dovState.render());
  }
  function renderArtifactPage() {
    const st = dovState, a = artifacts.find(x => x.id === st.artId);
    if (!a) { closeDetail(); return ""; }
    const slot = st.slotIdx != null ? build.slots[st.slotIdx] : null;
    const equippedHere = !!slot && slot.artifactId === a.id;
    const holder = build.slots.findIndex(s => s.artifactId === a.id), holderC = holder >= 0 ? CREA.get(build.slots[holder].cid) : null;
    const view = st.view === "sockets" ? "sockets" : "bonuses";
    const toggle = `<div class="art-view-toggle">
      <button class="av-tab ${view === "bonuses" ? "on" : ""}" data-action="artpage-view" data-v="bonuses">Bonuses</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${view === "sockets" ? "on" : ""}" data-action="artpage-view" data-v="sockets">Sockets</button></div>`;
    const clash = artNetherClash(a);
    const p = PRIMARY.find(x => x.property === a.primary);
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><button class="btn-ghost" data-action="artpage-back">‹ Artifacts</button>
        <h2 style="flex:1">${esc(a.name)}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="gs-detail-head">
          <div class="gs-god-sprite">${spriteImg(artIcon(a), "px")}</div>
          <div class="gs-god-name">${esc(a.name)}</div>
          <div class="slot-sub">${esc(a.primary || "—")}${p ? ` · ${esc(p.stat)} +${p.perRank[a.rank || 50] || 0}%` : ""} · Rank ${a.rank || 50}${holderC ? ` · equipped by ${esc(holderC.name)}` : ""}</div></div>
        <div class="ovl-center-scroll artpage-body">
          ${clash ? `<div class="slot-sub sg-clsnote clash-note">${esc(clashText(clash))}.</div>` : ""}
          ${toggle}${view === "sockets" ? `<div class="prop-list">${artContentRows(a, { empties: true })}</div>` : artifactBonusView(a)}</div>
      </div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="artpage-back">‹ Back</button>
        <div><button class="btn-ghost" data-action="artpage-edit">Edit</button>
        ${equippedHere ? `<button class="btn-confirm" data-action="artpage-unequip">Unequip</button>` : ""}</div></div>
    </div></div>`;
  }

  // ── artifact builder — guided wizard: 1) pick artifact  2) fill slots  3) name ──
  function openArtifactBuilder(artId, slotIdx) {
    let draft;
    if (artId != null) draft = JSON.parse(JSON.stringify(artifacts.find(a => a.id === artId)));
    else draft = { id: null, name: `Artifact ${nextArtId}`, rank: 50, primary: null, stat: [], trick: [], traits: [], spells: [], netherIds: [] };
    // editing an existing artifact jumps straight to the slots step. retLib = the library view we came from
    // (filters / sort / selection), restored on Save or Cancel so the overlay never drops back to the home screen.
    const retLib = ovState && ovState.kind === "artlib" ? ovState : null;
    ovState = { kind: "artbuild", artId, slotIdx, draft, step: artId != null ? "slots" : "type", pickType: null, search: "", retLib, render: renderArtifactBuilder };
    openOverlay(ovState.render());
  }
  function backToArtLib(st, selId) {
    if (st.retLib) { ovState = { ...st.retLib, sel: selId != null ? selId : st.retLib.sel }; openOverlay(ovState.render()); }
    else { openArtifactLibrary(st.slotIdx); if (selId != null) { ovState.sel = selId; refreshOverlay(); } }
  }
  // artifact slots step — right-hand info panel: picker list › item preview (confirm) › live bonus
  const artSlotKey = (type) => (ART_SLOTS.find(s => s.pick === type) || {}).key;
  const artHas = (a, type, v) => (a[artSlotKey(type)] || []).includes(v);
  const ART_PICK_CAP = 300;
  // spell potency tiers strongest-first (codex order); spells without a potency sort last
  const POTENCY_ORDER = ["Devastating", "Massive", "Large", "Moderate", "Small"];
  const potencyRank = (sp) => { const i = POTENCY_ORDER.indexOf(sp.potency); return i < 0 ? POTENCY_ORDER.length : i; };
  // spell `target` values (Spell_REF, blanks filled from the code's target scope) → dropdown labels; only values present
  const SPELL_TARGETS = [["Target", "Single target"], ["Enemies", "Enemies"], ["Your Creatures", "Your creatures"], ["All Creatures", "All creatures"], ["Self", "Self"]]
    .filter(([v]) => (D.spells || []).some(sp => sp.target === v));
  // ── shared spell picker (Spell Gem, Artifact and Nether Stone wizards) ──
  // state on the wizard's ovState: search, spellTarget, spellCls, spellSort, bkOnly, tags = TagFilter "spell"
  // Only spells that exist as holdable gems: battle-only spells (Ultimates, Runes, Mega Magic, Colorwave, boss kits) reach a
  // creature through their owner instead (FX.grantedSpells), and never-created spells don't reach play at all.
  function spellPickList(st, exclude) {
    const q = (st.search || "").trim().toLowerCase(), sort = st.spellSort || "name";
    return (D.spells || []).filter(sp => !sp.battleOnly && !sp.unused && !(exclude && exclude.has(sp.id))
        && (!q || sp.name.toLowerCase().includes(q) || (sp.desc || "").toLowerCase().includes(q) || tagKeys(sp).some(k => taxoValName(k).toLowerCase().includes(q)))
        && (!st.spellCls || sp.cls === st.spellCls)
        && (st.spellTarget == null || sp.target === st.spellTarget)
        && TagFilter.match(st, "spell", sp)
        && (!st.bkOnly || bookmarks.spells.includes(sp.id)))
      .sort((x, y) => {
        const d = sortSign(st.spellSortRev), byName = x.name.localeCompare(y.name);
        if (sort === "potency") { const rx = potencyRank(x), ry = potencyRank(y), none = POTENCY_ORDER.length;
          if ((rx === none) !== (ry === none)) return rx === none ? 1 : -1;   // no potency stays last either way
          return d * (rx - ry) || byName; }
        if (sort === "charges") { if ((x.charges == null) !== (y.charges == null)) return x.charges == null ? 1 : -1;
          return d * ((y.charges || 0) - (x.charges || 0)) || byName; }
        return d * byName;
      });
  }
  // rows (capped) with potency-tier headings under the Potency sort, a "showing N of M" note, or an empty note
  function spellPickRows(st, list, rowFn) {
    const shown = list.slice(0, ART_PICK_CAP), pot = st.spellSort === "potency";
    return shown.map((sp, i) => (pot && (i === 0 || potencyRank(shown[i - 1]) !== potencyRank(sp))
        ? `<div class="section-label sg-sort-sec">${esc(sp.potency || "No potency")}</div>` : "") + rowFn(sp)).join("")
      + (list.length > shown.length ? `<div class="slot-sub" style="padding:8px">Showing ${shown.length} of ${list.length} — narrow with search or a filter.</div>` : "")
      || `<div class="slot-sub" style="padding:10px">No spells match.</div>`;
  }
  // spell kind: Ultimate (Avatar ultimates, tagged "Related Spells::Ultimate Spells") · Rune (the Rune Knight's 5 runes)
  // the identical two-row bar: [lead] search · ＋ Filter · ★ Bookmarked  /  Target ▾ · Class ▾ · A–Z | Potency | Charges
  function spellFilterBar(st, searchAction, lead = "") {
    const sort = sortCur(st.spellSort, "name");
    const taxo = TagFilter.bar(st, "spell");
    const bk = bookmarks.spells.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="spf-bk" title="Show only bookmarked spells">★ Bookmarked</button>` : "";
    return `<div class="ovl-filterbar spf-row">${lead}<input class="ovl-search" placeholder="Search spells…" value="${esc(st.search || "")}" data-action="${searchAction}">${taxo}${bk}</div>
      <div class="ovl-filterbar sg-dropbar">
        <select class="app-select${st.spellTarget != null ? " on" : ""}" data-action="spf-target" title="Filter by target">
          <option value="*" ${st.spellTarget == null ? "selected" : ""}>-</option>${SPELL_TARGETS.map(([v, l]) => `<option value="${esc(v)}" ${st.spellTarget === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select class="app-select${st.spellCls ? " on" : ""}" data-action="spf-cls" title="Filter by class">
          <option value="" ${!st.spellCls ? "selected" : ""}>-</option>${SPELL_CLASSES.map(cl => `<option value="${cl}" ${st.spellCls === cl ? "selected" : ""}>${cl}</option>`).join("")}</select>
        <span class="sg-sort-gap"></span>
        <div class="seg">${[["name", "A–Z"], ["potency", "Potency"], ["charges", "Charges"]].map(([v, l]) =>
          `<button class="seg-btn ${sort === v ? "on" : ""}" data-action="spf-sort" data-v="${v}">${sortLbl(l, sort === v, st.spellSortRev, v !== "name")}</button>`).join("")}</div></div>`;
  }
  // one-line nether stone summary for list rows: core %s, other properties, trait + spell names
  function netherListSummary(n) {
    const { core, extra } = netherBonusRows(n), parts = [];
    for (const k of STAT_KEYS) if (core[k]) parts.push(`+${core[k]}% ${STAT_LABEL[k].slice(0, 3)}`);
    for (const [prop, { value, unit }] of extra) parts.push(`+${value}${unit === "%" ? "%" : ""} ${prop}`);
    for (const p of n.props || []) {
      if (p.cat === "trait") { const t = TRAITITEM.get(p.key); if (t) parts.push(t.traitName || t.name); }
      else if (p.cat === "spell") { const sp = SPELL.get(p.key); if (sp) parts.push(sp.name); }
    }
    return parts.join(" · ") || "No properties";
  }
  const netherSearchText = (n) => [n.name, netherListSummary(n)].join(" ").toLowerCase();
  function renderArtPicker(st, a, rank) {
    const type = st.pickType, q = st.search.trim().toLowerCase();
    // single-slot types (trait/spell/nether) mark a row "chosen"; stat slots allow repeats. Trick slots don't:
    // the blacksmith refuses a trick property already in trick1/trick2 (obj_bsupgrade_KeyPress_69, extract S34)
    const single = ((ART_SLOTS.find(s => s.pick === type) || {}).max || 1) === 1;
    const has = (v) => (single || type === "trick") && artHas(a, type, v);
    const matchTaxo = (keys) => q && keys.some(k => taxoValName(k).toLowerCase().includes(q));
    let rows = "";
    if (type === "stat" || type === "trick") {
      const pool = type === "stat" ? STATMAT : TRICKMAT;
      rows = pool.filter(m => !q || m.name.toLowerCase().includes(q) || m.property.toLowerCase().includes(q)).map(m => {
        const g = propGroups.get(m.property);
        const val = g ? propEffectText(g, rank) : esc(m.property);   // adds on click — no drill-in/confirm
        const dup = type === "trick" && has(m.property);
        return `<div class="prop-row ${has(m.property) ? "chosen" : ""}${dup ? " locked" : ""}"${dup ? "" : ` data-action="art-confirm-add" data-t="${type}" data-v="${esc(m.property)}"`}>
          <span class="prop-ico">${m.icon ? spriteImg(m.icon, "px") : ""}</span>
          <span class="prop-name">${esc(m.name)}</span><span class="prop-stat">${esc(val)}</span></div>`;
      }).join("");
    } else if (type === "trait") {
      // clean trait containers (banner + description + material link) that add on click — no drill-in
      rows = D.traitItems.filter(t => t.traitName
          && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q) || matchTaxo(TagFilter.keys("trait", t)))
          && TagFilter.match(st, "trait", t)
          && (!st.bkOnly || bookmarks.traits.includes(t.traitId))).slice(0, 300)
        .map(t => traitPickCard(t, has(t.id), `data-action="art-confirm-add" data-t="trait" data-v="${t.id}"`)).join("");
    } else if (type === "spell") {   // raw spells (no sockets), like nether stones — shared spell picker
      rows = spellPickRows(st, spellPickList(st), sp => spellRow(sp, { chosen: has(sp.id), attrs: `data-action="art-confirm-add" data-t="spell" data-v="${sp.id}"` }));
    } else {
      // nether stones: filters (has trait / has spell / hide in use) + sort (recent · name · a core stat %)
      const sum = (n) => netherBonusRows(n).core;
      const tgt = artTargetSlot(a.id, st.slotIdx);
      const inUse = (n) => netherUsers(n.id, a.id, tgt);
      const list = nether.filter(n => (!q || netherSearchText(n).includes(q))
          && (!st.nsTrait || (n.props || []).some(p => p.cat === "trait"))
          && nsSpellMatch(n, st.nsSpell)
          && (!st.nsHideUsed || !inUse(n).length));
      const sortK = st.nsSort || "recent", nd = sortSign(st.nsSortRev);
      list.sort(sortK === "name" ? (x, y) => nd * x.name.localeCompare(y.name)
        : STAT_KEYS.includes(sortK) ? (x, y) => nd * (sum(y)[sortK] - sum(x)[sortK]) || x.name.localeCompare(y.name)
        : (x, y) => nd * (y.id - x.id));
      rows = list.map(n => {
        const used = inUse(n), core = STAT_KEYS.includes(sortK) ? sum(n) : null;
        const lock = used.length && tgt != null && !has(n.id);   // this artifact is in the loadout → can't double up
        const usedTitle = used.length ? `Already socketed in ${used.map(u => u.art.name).join(", ")} (equipped)${lock ? " — unequip it there first" : ""}` : "";
        return `<div class="prop-row rich ${has(n.id) ? "chosen" : ""}${used.length ? " nether-clash" : ""}${lock ? " locked" : ""}"${lock ? "" : ` data-action="art-preview" data-t="nether" data-v="${n.id}"`}${usedTitle ? ` title="${esc(usedTitle)}"` : ""}>
          <span class="prop-ico">${spriteImg(gemSrc(n), "px")}</span>
          <div class="prop-body"><div class="prop-name">${esc(n.name)}${core && core[sortK] ? `<span class="prop-metatag">+${core[sortK]}% ${esc(STAT_LABEL[sortK])}</span>` : ""}${used.length ? `<span class="prop-metatag clash">in use</span>` : ""}</div>
            <div class="prop-sub">${esc(netherListSummary(n))}</div></div></div>`;
      }).join("")
        || (nether.length ? `<div class="slot-sub" style="padding:8px">No Nether Stones match.</div>`
          : `<div class="slot-sub" style="padding:8px">No Nether Stones yet — add them from the top-bar “Nether Stones” button.</div>`);
    }
    const traitFilter = type === "trait"
      ? TagFilter.bar(st, "trait") : "";
    const bkKind = type === "trait" ? "traits" : type === "spell" ? "spells" : null;
    const bkFilter = bkKind && bookmarks[bkKind].length
      ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="artb-bkonly" title="Show only bookmarked ${type === "trait" ? "traits" : "spells"}">★ Bookmarked</button>` : "";
    const seg = (act, cur, opts, rev) => `<div class="seg">${opts.map(([v, lbl]) => `<button class="seg-btn ${cur === v ? "on" : ""}" data-action="${act}" data-v="${v}">${sortLbl(lbl, cur === v, rev, v !== "name")}</button>`).join("")}</div>`;
    let extra = "";
    if (type === "spell") {
      extra = "";   // spell list uses the shared search + filter bar (rendered in place of the plain search below)
    } else if (type === "nether") {
      extra = `<div class="art-side-filter">
          <button class="facet ${st.nsTrait ? "on" : ""}" data-action="artb-nsfilter" data-f="nsTrait">Trait</button>
          ${nsSpellChip(st.nsSpell, "ns-spellcycle")}
          <button class="facet ${st.nsHideUsed ? "on" : ""}" data-action="artb-nsfilter" data-f="nsHideUsed" title="Hide stones already socketed in another equipped artifact">Hide in use</button></div>
        <div class="art-side-filter">${seg("artb-nssort", sortCur(st.nsSort, "recent"), [["recent", "Recent"], ["name", "A–Z"], ...STAT_KEYS.map(k => [k, STAT_LABEL[k].slice(0, 3)])], st.nsSortRev)}</div>`;
    } else if (traitFilter || bkFilter) extra = `<div class="art-side-filter">${traitFilter}${bkFilter}</div>`;
    const label = (ART_SLOTS.find(s => s.pick === type) || {}).label || "";
    return `<div class="art-side-head"><b>Add ${esc(label)}</b><button class="chip" data-action="artb-closecat">Done</button></div>
      ${type === "spell" ? spellFilterBar(st, "artb-search") : `<input class="ovl-search art-side-search" placeholder="${type === "nether" ? "Search by name, property, trait or spell…" : "Search by name or tag…"}" value="${esc(st.search)}" data-action="artb-search">
      ${extra}`}
      <div class="art-side-list">${rows}</div>`;
  }
  // item preview with an explicit confirm — socketing never applies silently (shows the effect first)
  function renderArtPreview(type, v, rank, opts) {
    const equipped = opts && opts.equipped, full = opts && opts.full;
    let icon = null, name = String(v), sub = "", lines = "", open = "";
    if (type === "stat" || type === "trick") {
      const mat = MAT_BY_PROP.get(v), g = propGroups.get(v);
      // main label = the MATERIAL name (e.g. "Red Amber"); the stat itself shows in the effect lines below,
      // so don't repeat it in the sub-label.
      icon = mat && mat.icon; name = mat ? mat.name : v; sub = "";
      lines = g ? `<div class="art-pv-line">${esc(propEffectText(g, rank))}</div>` : "";
    } else if (type === "trait") {
      const t = TRAITITEM.get(v), tr = t && t.traitId != null ? TRAIT[t.traitId] : null;
      icon = t && t.icon; name = t ? t.name : v; sub = t ? `grants ${t.traitName}` : "";
      // full trait-container style (banner + description), same as a creature's innate trait
      lines = tr ? `<div class="primary-traits">${traitBanner(t.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div>${traitSpellRow(t.traitId, true)}</div>`
        : `<div class="slot-sub">${esc(t ? t.traitName : "")}</div>`;
      if (tr) open = ` data-action="apx-open" data-ek="trait" data-eid="${t.traitId}"`;
    } else if (type === "spell") {
      const sp = SPELL.get(v);
      icon = spellIcon(sp); name = sp ? sp.name : v; sub = sp ? (sp.cls || "spell") : "spell";
      lines = sp ? `<div class="trait-desc">${richText(sp.desc || "")}</div>` : "";
      if (sp) open = ` data-action="apx-open" data-ek="spell" data-eid="${esc(String(v))}"`;
    } else {
      const n = nether.find(x => x.id === v);
      icon = gemSrc(n); name = n ? n.name : v; sub = "nether stone";
      // reuse the Nether Stone info panel's Bonuses view (resolved stat table + trait & spell-gem
      // containers) instead of a flat summary string, so the preview reads the same everywhere.
      lines = n ? netherBonusView(n) : "";
    }
    return `<div class="art-side-head"><button class="chip" data-action="art-preview-back">‹ Back</button></div>
      <div class="art-pv">
        <div class="art-pv-top${open ? " apx-clickable" : ""}"${open}${open ? ` title="View taxonomy"` : ""}><div class="as-ico">${icon ? spriteImg(icon, "px") : "◆"}</div>
          <div><div class="art-pv-name">${esc(name)}${open ? ` <span class="etax-hint">tags ›</span>` : ""}</div><div class="slot-sub">${esc(sub)}</div></div></div>
        <div class="art-pv-body">${lines || `<div class="slot-sub">No numeric effect.</div>`}</div>
        <button class="btn-confirm ${equipped ? "danger-confirm" : ""}" data-action="art-confirm-add" data-t="${type}" data-v="${esc(String(v))}" ${full ? "disabled" : ""}>${equipped ? "Remove from artifact" : full ? "Slots full" : "Add to artifact"}</button>
      </div>`;
  }
  function renderArtLiveBonus(a, rank) {
    // full live view: trait containers (trait materials + nether-stone traits) and spell-gem containers
    // (spell slot + nether-stone spells), then the resolved stat table — not just the stat percentages.
    const { core, extra } = artifactBonusRows(a);
    const traits = artifactTraitContainers(a), spells = artifactSpellContainers(a);
    // own scroll container: .art-side is overflow:hidden (for the picker's fixed head), so this flat
    // view needs its own scroller or it clips when the trait/spell/stat content is taller than the panel.
    return `<div class="art-side-scroll">
      <div class="section-label">Live bonus · rank ${rank}</div>
      ${traits ? `<div class="section-label" style="margin-top:8px">Traits</div>${traits}` : ""}
      ${spells ? `<div class="section-label" style="margin-top:12px">Spell Gems</div><div class="art-spellcards">${spells}</div>` : ""}
      <div class="section-label" style="margin-top:${traits || spells ? 12 : 8}px">Stat bonuses</div>
      ${bonusTableHtml(core, extra)}</div>`;
  }
  function renderArtifactBuilder() {
    const st = ovState, a = st.draft, rank = a.rank;
    const preview = artifactPctOf(a);
    let body = "", footer = "";

    if (st.step === "type") {
      const tiles = PRIMARY.map(p => `
        <div class="art-type-tile ${a.primary === p.property ? "chosen" : ""}" data-action="art-primary" data-p="${esc(p.property)}">
          <div class="att-ico">${spriteImg(primaryIconAt(p.property, a.rank), "px")}</div>
          <div class="att-name">${esc(p.property)}</div>
          <div class="att-stat">${esc(p.stat)} +${p.perRank[rank]}%</div></div>`).join("");
      body = `<div class="ovl-center" data-action="lib-deselect"><div class="ovl-center-scroll">
        <div class="rank-picker" style="margin-bottom:12px"><span class="slot-sub">Rank</span>
          <input type="range" min="1" max="50" value="${rank}" data-action="artb-rank"><span class="rank-badge">${rank}</span></div>
        <div class="art-type-grid">${tiles}</div></div></div>`;
      footer = `<button class="btn-ghost" data-action="artb-cancel">Cancel</button>
        <button class="btn-confirm" data-action="artb-next" ${a.primary ? "" : "disabled"}>Next: Fill slots ›</button>`;
    } else if (st.step === "slots") {
      // fixed slot template: 1 primary (from step 1) + stat×3 + trick×2 + trait×1 + spell×1 + nether×1
      // idx = position within the slot group, so removal targets THAT box (slots are independent;
      // the same item — e.g. 3 Attack Ambers — can occupy multiple slots)
      const filledBox = (type, v, idx) => {
        let ico = `<div class="as-ico glyph">◆</div>`, lab = v, sub = "";
        if (type === "stat" || type === "trick") { const mat = MAT_BY_PROP.get(v), g = propGroups.get(v);
          ico = `<div class="as-ico">${mat && mat.icon ? spriteImg(mat.icon, "px") : "◆"}</div>`;
          lab = mat ? mat.name : v;
          sub = g ? propEffectText(g, rank) : esc(v); }
        else if (type === "trait") { const t = TRAITITEM.get(v); ico = `<div class="as-ico">${t && t.icon ? spriteImg(t.icon, "px") : "✦"}</div>`; lab = t ? t.name : v; sub = t ? t.traitName : ""; }
        else if (type === "spell") { const sp = SPELL.get(v); const gi = spellIcon(sp); ico = `<div class="as-ico">${gi ? spriteImg(gi, "px") : "✷"}</div>`; lab = sp ? sp.name : v; sub = sp ? (sp.cls || "spell") : "spell"; }
        else if (type === "nether") { const n = nether.find(x => x.id === v); ico = `<div class="as-ico">${spriteImg(gemSrc(n), "px")}</div>`; lab = n ? n.name : v; }
        return `<div class="art-slot"><button class="as-rm" data-action="art-rm" data-t="${type}" data-i="${idx}">✕</button>${ico}<div class="as-lab">${esc(lab)}</div><div class="as-sub">${esc(sub)}</div></div>`;
      };
      const primaryBox = a.primary
        ? (() => `<div class="art-slot primary"><div class="as-ico">${spriteImg(primaryIconAt(a.primary, a.rank), "px")}</div><div class="as-lab">${esc(a.primary)}</div><div class="as-sub">${(() => { const p = PRIMARY.find(x => x.property === a.primary); return p ? `${esc(p.stat)} +${p.perRank[rank] || 0}%` : ""; })()}</div></div>`)()
        : `<div class="art-slot add" data-action="artb-back"><div class="as-ico glyph">＋</div><div class="as-lab">Primary</div></div>`;
      const groupsHtml = `<div class="art-slot-groups">` + [`<div class="art-slot-group" style="--n:1"><div class="section-label">Primary</div><div class="art-slot-grid">${primaryBox}</div></div>`]
        .concat(ART_SLOTS.map(sl => {
          const arr = a[sl.key] || [];
          const boxes = [];
          for (let i = 0; i < sl.max; i++) boxes.push(arr[i] !== undefined ? filledBox(sl.pick, arr[i], i)
            : i >= artOpen(sl, rank) ? `<div class="art-slot locked"><div class="as-ico glyph">🔒</div><div class="as-lab">Tier ${sl.unlock[i]}</div></div>`
            : `<div class="art-slot add ${st.pickType === sl.pick ? "picking" : ""}" data-action="art-slot" data-t="${sl.pick}"><div class="as-ico glyph">＋</div><div class="as-lab">${sl.label}</div></div>`);
          return `<div class="art-slot-group" style="--n:${sl.max}"><div class="section-label">${sl.label}</div><div class="art-slot-grid">${boxes.join("")}</div></div>`;
        })).join("") + `</div>`;

      // info panel (right): item preview (confirm) › picker list › live bonus — never appended below the slots
      let side;
      if (st.preview) {
        const psl = ART_SLOTS.find(s => s.pick === st.preview.type) || {};
        const parr = a[psl.key] || [];
        const equipped = psl.max === 1 && parr[0] === st.preview.value;   // single-slot toggle-off
        const full = parr.length >= artOpen(psl, rank) && !equipped;
        side = renderArtPreview(st.preview.type, st.preview.value, rank, { equipped, full });
      }
      else if (st.pickType) side = renderArtPicker(st, a, rank);
      else side = renderArtLiveBonus(a, rank);
      body = `<div class="ovl-center artb-slots" data-action="lib-deselect"><div class="ovl-center-scroll">${groupsHtml}</div></div>
        <div class="ovl-right art-side">${side}</div>`;
      footer = `<button class="btn-ghost" data-action="artb-back">‹ Back</button>
        <button class="btn-confirm" data-action="artb-next">Next: Name ›</button>`;
    } else { // name
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
        <div class="build-section"><h3>Name your artifact</h3>
          <input class="ovl-search name-field" placeholder="Artifact name" value="${esc(a.name)}" data-action="artb-name" style="max-width:320px"></div>
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
        <h2>${esc(a.name)}</h2>
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>${footer}</div></div>
    </div></div>`;
  }

  // ── relic builder ──────────────────────────────────────────────────────────
  // Relic name = "<Name>, <Item> of <God>" — the tile shows just the recognizable name (pre-comma).
  const relicShortName = (r) => String(r.name || "").split(",")[0].trim();
  // the relic's god = the end of its game name ("Ferro, Great Axe of Gonfurian"), cased as the realm's god name when one
  // matches (the game spells "SPARE BOOT OF TORUN" in caps); Caliban has no realm, so his comes from the name as is
  const relicGod = (r) => { const m = / of ([^,]+)$/i.exec(String(r.name || "")); if (!m) return "";
    const realm = (D.realms || []).find(x => normNm(x.godName) === normNm(m[1])); return realm ? realm.godName : m[1].trim(); };
  function openRelicBuilder(slotIdx) {
    ovState = { kind: "relic", slotIdx, search: "", render: renderRelicBuilder };
    openOverlay(ovState.render());
  }
  // List overlay: a tile grid like the God Shop / creature selector, sectioned by the stat each relic boosts.
  function renderRelicBuilder() {
    const st = ovState, c = CREA.get(build.slots[st.slotIdx].cid);
    const equipped = build.slots[st.slotIdx].relic;
    // a relic can only be equipped once per party: relics held by ANOTHER slot are greyed out and unselectable
    const takenBy = new Map();
    build.slots.forEach((sl, i) => { if (i !== st.slotIdx && sl.relic) takenBy.set(sl.relic.id, (CREA.get(sl.cid) || {}).name || `slot ${i + 1}`); });
    const q = st.search.trim().toLowerCase();
    const list = D.relics.filter(r => (!q || r.name.toLowerCase().includes(q) || relicGod(r).toLowerCase().includes(q) || (r.statBonus || "").toLowerCase().includes(q)) && TagFilter.match(st, "relic", r));
    // sort: Stat (default) = one section per stat in the app's canonical stat order; Name / God = one A–Z grid.
    // picking a tile opens the rank overlay
    const sortK = st.relicSort || "stat";
    const tileGrid = (rels) => `<div class="pick-grid relic-grid">${rels.map(r => { const taken = takenBy.get(r.id); return `<div class="pick-tile ${equipped && equipped.id === r.id ? "selected" : ""}${taken ? " disabled" : ""}" ${taken ? `title="Equipped by ${esc(taken)}"` : `data-action="relic-pick" data-id="${r.id}"`}>
        <div class="pt-sprite">${relicArt(r) ? spriteImg(relicArt(r), "px") : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="pt-name">${esc(relicShortName(r))}</div><div class="pt-god">${esc(relicGod(r))}</div></div>`; }).join("")}</div>`;
    const byName = (x, y) => relicShortName(x).localeCompare(relicShortName(y));
    const sections = sortK === "stat"
      ? STAT_KEYS.map(k => { const label = STAT_LABEL[k], rels = list.filter(r => r.statBonus === label);
          return rels.length ? `<div class="section-label">${esc(label)}</div>${tileGrid(rels)}` : ""; }).join("")
      : list.length ? tileGrid(list.slice().sort(sortK === "god" ? (x, y) => relicGod(x).localeCompare(relicGod(y)) || byName(x, y) : byName)) : "";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Relic — ${esc(c ? c.name : "")}</h2>
        <input class="ovl-search" placeholder="Search relic / god / stat…" value="${esc(st.search)}" data-action="relic-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-filterbar relic-bar">${TagFilter.bar(st, "relic")}
          <div class="seg">${[["stat", "Stat"], ["name", "Name"], ["god", "God"]].map(([v, l]) => `<button class="seg-btn ${sortK === v ? "on" : ""}" data-action="relic-sort" data-v="${v}">${l}</button>`).join("")}</div></div>
        <div class="ovl-center-scroll">${sections || `<div class="slot-sub" style="padding:10px">No relics match.</div>`}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>${equipped ? `<button class="btn-ghost" data-action="relic-clear">Clear equipped</button>` : ""}
        <button class="btn-confirm" data-action="close-ovl">Done</button></div></div>
    </div></div>`;
  }
  // Second full-screen overlay: rank slider + per-rank effects for the picked relic.
  function openRelicDetail(relicId) {
    const equipped = build.slots[ovState.slotIdx].relic, rel = RELIC.get(relicId);
    const maxRank = rel ? Math.max(...rel.ranks.map(r => r.rank), 10) : 100;
    const rank = equipped && equipped.id === relicId ? equipped.rank : maxRank;   // new picks default to max rank
    dovState = { kind: "relic-detail", slotIdx: ovState.slotIdx, sel: relicId, rank, render: renderRelicDetail };
    openDetail(dovState.render());
  }
  function renderRelicDetail() {
    const st = dovState, sel = RELIC.get(st.sel);
    if (!sel) { closeDetail(); return ""; }
    const maxRank = Math.max(...sel.ranks.map(r => r.rank), 10);
    const ranks = sel.ranks.map(rk => {
      const row = `<div class="prop-row ${st.rank >= rk.rank ? "chosen" : ""}">
        <span class="prop-name" style="flex:0 0 44px;color:var(--accent)">R${rk.rank}</span>
        <span class="prop-stat" style="flex:1;text-align:left">${richText(rk.desc)}</span>${spellRowWrap(usedSpellCards(sel, null, rk.rank) + usedCondCards(sel, rk.rank))}</div>`;
      return row;
    }).join("");
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><button class="btn-ghost" data-action="relic-back">‹ Relics</button>
        <h2 style="flex:1">${esc(sel.name)}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="gs-detail-head apx-clickable" data-action="apx-open" data-ek="relic" data-eid="${sel.id}" title="View taxonomy">
          ${relicArt(sel) ? `<div class="gs-god-sprite">${spriteImg(relicArt(sel), "px")}</div>` : ""}
          <div class="gs-god-name">${esc(sel.name)} <span class="etax-hint">tags ›</span></div>
          <div class="slot-sub">Boosts ${esc(sel.statBonus || "—")}</div></div>
        <div class="ovl-filterbar rank-picker"><span class="slot-sub">Rank</span>
          <input type="range" min="1" max="${maxRank}" step="1" value="${st.rank}" data-action="relic-rank"><span class="rank-badge">${st.rank}</span></div>
        <div class="ovl-center-scroll">${ranks}${relicUltimateCard(sel.id)}</div>
      </div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="relic-back">‹ Back</button>
        <div>${(build.slots[st.slotIdx].relic || {}).id === sel.id ? `<button class="btn-ghost" data-action="relic-unequip">Unequip</button>` : ""}
        <button class="btn-confirm" data-action="relic-confirm">Save Relic</button></div></div>
    </div></div>`;
  }

  // ── Macro Proposal — predict a creature's battle-AI "brain" from its loadout ────────────────
  // In-game, a Macro is an ordered list of conditional lines a creature uses to pick its turn action
  // (see _su_extract/code/MACRO_MODEL.md). We read the slot's equipped spells + traits + stats, classify
  // each spell by purpose/side/breadth from its taxonomy, infer the creature's role, and emit lines a
  // player can replicate in the in-game Macro editor so battles can be automated (default action = Macro).
  // This is a heuristic PROPOSAL, not a guaranteed-optimal brain — the game's real vocabulary is D.macroVocab.

  // ── Tuning knobs — every magic number the proposal engine uses, in one place. Percentages are % Health and must be
  // multiples of 10 (the in-game picker steps in 10s); counts are creature/status counts. ──
  const MACRO_TUNING = {
    maxLines: 30,          // in-game macro line cap (scr_MacroProcess forces 30; MACRO_MODEL.md point 9)
    healEmergency: 30,     // % Health — emergency heal on an ally below this
    healSustain: 60,       // % Health — top-up heal on an ally below this
    drainHeal: 50,         // % Health — a damage spell that also heals your side is used when an ally is below this
    buffFloor: 1,          // cast a buff on an ally with fewer than this many buffs
    debuffFloor: 1,        // cast a debuff on an enemy with fewer than this many debuffs
    minionCap: 3,          // summon while the creature has fewer than this many minions
    aoeMinEnemies: 2,      // whole-side damage while at least this many enemies are alive
    onceTargets: 2,        // once-per-battle ally spells (Sapphire Power): how many allies get one, one per turn
    holeHp: 50,            // % Health — the main target band: a hurt enemy with no Shelled / Barrier
    finishHp: 30,          // % Health — finish a nearly dead enemy even through Shelled / Barrier
    scalerMaxGate: 6,      // drop a "more damage per buff / debuff" line whose break-even count is above this
    focus: "has lowest Health",   // default target for single-target damage and attacks
  };
  // Per-spell classification overrides — force { purpose?, side?, multi?, focus? } by spell NAME. Empty by default.
  const SPELL_OVERRIDES = {};
  // spell tier → damage multiplier (bc_SpellDamage tier constants, _su_extract EFFECT_FORMULAS.md)
  const TIER_MULT = { Small: 0.9, Moderate: 1.1, Large: 1.2, Massive: 1.3, Devastating: 1.5 };
  // traits that forbid manual casting (MACRO_MODEL.md point 8) and that make attacks use Intelligence
  const NO_MANUAL_CAST = ["Channeling", "Burst of Power", "Spell Tap", "Hellblast", "Abaddon's Boon", "Wrath of the Underworld", "Zero to One", "The Great Beyond"];
  const INT_ATTACK_TRAITS = ["Myosotis", "Confusion and Empathy"];
  // relic ranks that make the bearer's attacks run on Intelligence (Ribcracker's needs 10 casts first)
  const INT_ATTACK_RELICS = [["Whisper,", 70], ["Ribcracker,", 90]];
  // artifact type → the action that fires its Spell Slot (ARTIFACTS.md)
  const SLOT_TRIGGER = { Sword: "attack", Staff: "cast", Shield: "defend", Helmet: "provoke", Boots: "turn" };
  let TRAIT_BY_NAME = null;
  const traitIdsNamed = (names) => {
    if (!TRAIT_BY_NAME) { TRAIT_BY_NAME = new Map(); for (const t of Object.values(TRAIT)) { if (!TRAIT_BY_NAME.has(t.name)) TRAIT_BY_NAME.set(t.name, []); TRAIT_BY_NAME.get(t.name).push(t.id); } }
    return new Set(names.flatMap(n => TRAIT_BY_NAME.get(n) || []));
  };
  // what the spell's own text says it scales with (the in-game description; the code agrees for these, EFFECT_FORMULAS.md)
  function spellScaling(sp) {
    const d = sp.desc || "", n = (re) => { const m = re.exec(d); return m ? +m[1] / 100 : null; };
    let f;
    if ((f = n(/(\d+)% (?:more )?damage for each debuff/i) ?? n(/increased by (\d+)% for each debuff/i)) != null) return { unit: "debuffs", f };
    if ((f = n(/(\d+)% (?:more )?damage for each buff/i) ?? n(/increased by (\d+)% for each buff/i)) != null) return { unit: "buffs", f };
    if ((f = n(/(\d+)% for each \{STAT_charge\} this Spell Gem has/i)) != null) return { unit: "charges", f };
    if (/for every 1% \{STAT_health\} the target is missing/i.test(d)) return { unit: "missing", focus: "has lowest Health" };
    if (/for every 1% \{STAT_health\} it has/i.test(d)) return { unit: "health", focus: "has highest Health" };
    if (/ignores \d+% of the target's \{STAT_defense\}/i.test(d)) return { unit: "pierce", focus: "has highest Defense" };
    return { unit: null };
  }
  // classify one spell → { sp, name, purpose, side, multi, ... }: in-game-text patterns first, then the taxonomy, then overrides
  // v2 taxonomy: am = the spell's theme (theme2, the old Action/Mechanic values), rs = its Spell Kind
  function classifySpell(sp) {
    const tx = tagKeys(sp), th = new Set(sp.theme2 || []), am = (v) => th.has(v), rs = (v) => tx.includes("Spell Kind::" + v);
    const d = sp.desc || "", dmgText = /takes? (?:a|an) [a-z]+ amount of damage|take (?:a|an) [a-z]+ amount of damage/i.test(d);
    const multi = sp.aim ? sp.aim === "enemies" || sp.aim === "allies" : rs("Multi-Target Spells");
    const statUp = tx.includes("Stats::Gain") || tx.includes("Stats::Has More");
    const statDown = tx.includes("Stats::Lose") || tx.includes("Stats::Has Less");
    let purpose, side;
    if (sp.aim === "ally1" && /for the rest of the battle/i.test(d)) { purpose = "once"; side = "ally"; }
    else if (sp.aim === "ally1" && /^Target \{ACTION_attacks\}/.test(d)) { purpose = "ally-attack"; side = "ally"; }
    else if (/\{CONDNAME_DEBUFF_SILENCE\} debuffs are removed/.test(d)) { purpose = "unsilence"; side = "ally"; }
    else if (am("Resurrection") && !dmgText) { purpose = "rez"; side = "ally"; }   // not "if this kills, it can't be resurrected"
    else if ((am("Healing") || rs("Healing Spells")) && !rs("Damaging Spells") && !dmgText) { purpose = "heal"; side = "ally"; }
    else if (rs("Damaging Spells") || dmgText || am("Attack") || am("Indirect Damage")) { purpose = "damage"; side = "enemy"; }
    else if (/sent to the bottom of the \{TIMELINE\}/.test(d)) { purpose = "control"; side = "enemy"; }
    else if (am("Debuff") || (am("Stats") && statDown && !statUp)) { purpose = "debuff"; side = "enemy"; }
    else if (am("Buff") || (am("Stats") && statUp)) { purpose = "buff"; side = "ally"; }
    else if (am("Provoke")) { purpose = "provoke"; side = "self"; }
    else if (am("Defend")) { purpose = "defend"; side = "self"; }
    else if (am("Minion")) { purpose = "summon"; side = "ally"; }
    else { purpose = "other"; side = null; }
    const o = SPELL_OVERRIDES[sp.name] || {};
    const sc = spellScaling(sp);
    return { sp, name: sp.name, purpose: o.purpose || purpose, side: o.side || side, multi: "multi" in o ? o.multi : multi,
      scale: sc, focus: o.focus || sc.focus || null,
      drains: purpose === "damage" && /your creatures recover \{STAT_health\}/i.test(d) };
  }
  // spells the creature can actually cast in a macro = its equipped spell GEMS only. Spells socketed into an
  // artifact (Spell slot) or a Nether Stone auto-proc and CANNOT be cast manually / by a macro — excluded.
  // Spells the game marks "cannot be cast manually" (Booze, Saving Grace, …) are left out; gems a perk / trait grants
  // (Runes, Mega Magic, Colorwave, Idolatry's Ultimate) are castable and count.
  // A gem with Citrine (Cast On Attack / Defend / Provoke / Heal) is one the player set up to fire from that action, so it
  // is not cast manually; `citrine` counts those gems per action.
  const CITRINE_ACTION = { CITRINE_ATTACK: "attack", CITRINE_DEFEND: "defend", CITRINE_PROVOKE: "provoke", CITRINE_HEAL: "heal" };
  function gatherSlotSpells(slot, citrine = {}) {
    const out = [], seen = new Set();
    const add = (sp) => { if (sp && !sp.noManual && !seen.has(sp.id)) { seen.add(sp.id); out.push(sp); } };
    for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid); if (!g) continue;
      const acts = [...new Set((g.propIds || []).map(pid => CITRINE_ACTION[(SPELLPROP.get(pid) || {}).key]).filter(Boolean))];
      if (acts.length) { acts.forEach(a => citrine[a] = (citrine[a] || 0) + 1); continue; }
      add(gemSpell(g)); }
    for (const g of grantedSpellList(slot)) if (g.mode === "gem") add(g.sp);
    return out;
  }
  // line + target helpers shared by the rules. Whole-side spells take no target ("cast X"); single-target ones act on
  // the line's Candidate ("cast X on that creature").
  const mLine = (en, why, chain) => ({ en, why, chain: !!chain });
  const castOn = (s) => s.multi ? `cast ${s.name}` : `cast ${s.name} on that creature`;
  const relicText = (slot) => { const r = slot.relic ? RELIC.get(slot.relic.id) : null;
    return r ? r.ranks.filter(k => k.rank <= slot.relic.rank).map(k => k.desc).join(" ") : ""; };
  // per-creature context every rule reads from — classify once, expose grouped spells + action flags
  function macroContext(slot, party = true) {
    const c = CREA.get(slot.cid); if (!c) return null;
    const fs = finalStats(slot), st = fs.final;
    const tids = slotTraitIds(slot), has = (set) => tids.some(t => set.has(t));
    const noManual = has(traitIdsNamed(NO_MANUAL_CAST)), citrine = {};
    const castable = gatherSlotSpells(slot, citrine), spells = noManual ? [] : castable.map(classifySpell);
    const by = (p) => spells.filter(s => s.purpose === p);
    const traitThemes = new Set();
    tids.forEach(tid => ((TRAIT[tid] || {}).theme2 || []).forEach(t => traitThemes.add(t)));
    const dom = STAT_KEYS.reduce((a, k) => st[k] > st[a] ? k : a, "hp");
    const dmg = by("damage"), rel = slot.relic ? RELIC.get(slot.relic.id) : null;
    const intAttacks = has(traitIdsNamed(INT_ATTACK_TRAITS))
      || !!(rel && INT_ATTACK_RELICS.some(([n, rk]) => rel.name.startsWith(n) && slot.relic.rank >= rk));
    const physical = st.atk >= st.int;
    // an effect that pays off when this creature Defends (Extension, Starwrath, …): Defend is a real action for it
    const ownText = tids.map(t => (TRAIT[t] || {}).desc || "").join(" ") + " " + relicText(slot);
    const defendValue = /after (?:this creature|the bearer) defends|while the bearer is defending/i.test(ownText);
    // its main action: the one its Citrine gems fire on (most gems wins), else attack for an Attack-led creature
    const citAct = ["attack", "defend", "provoke"].filter(a => citrine[a]).sort((a, b) => citrine[b] - citrine[a])[0] || null;
    const attackFirst = citAct ? citAct === "attack" : physical && dom === "atk";
    // party-wide: Expanded Power turns small / moderate / large damage spells massive
    const expanded = party && build.slots.some(s => s.cid != null && slotTraitIds(s).some(t => traitIdsNamed(["Expanded Power"]).has(t)));
    return {
      c, slot, st, spells, by, T: MACRO_TUNING, noManual, expanded, citrine, citAct,
      heals: by("heal"), dmg, singleDmg: dmg.filter(s => !s.multi), aoe: dmg.filter(s => s.multi),
      hasProvokeTrait: traitThemes.has("Provoke"),
      dom, tanky: dom === "def" || dom === "hp", physical, intAttacks, attackFirst,
      defendValue: defendValue || citAct === "defend", provokeMain: citAct === "provoke",
      attackWorth: physical || intAttacks,
    };
  }
  // a damage spell's multiplier before target-dependent bonuses: tier (Expanded Power → Massive) × its own charge bonus
  const tierMult = (x, s) => { const t = s.sp.potency; return TIER_MULT[x.expanded && ["Small", "Moderate", "Large"].includes(t) ? "Massive" : t] || 1; };
  const plainMult = (x, s) => tierMult(x, s) * (s.scale.unit === "charges" ? 1 + s.scale.f * Math.max(0, (s.sp.charges || 1) - 1) : 1);
  // single-target damage, in macro order: per-buff / per-debuff spells gated on the count where they beat the best
  // plain spell, then the plain spells strongest first (a spell out of charges falls through to the next line)
  function damageLines(x) {
    const out = [], sd = x.singleDmg; if (!sd.length) return out;
    const plain = sd.slice().sort((a, b) => plainMult(x, b) - plainMult(x, a));
    const scalers = sd.filter(s => s.scale.unit === "buffs" || s.scale.unit === "debuffs").sort((a, b) => b.scale.f - a.scale.f);
    for (const s of scalers) {
      const others = sd.filter(o => o !== s);
      if (!others.length) continue;   // its own plain line covers it
      const best = Math.max(...others.map(o => plainMult(x, o)));
      const n = Math.max(1, Math.ceil(((best / tierMult(x, s)) - 1) / s.scale.f - 1e-9));
      if (n - 1 > x.T.scalerMaxGate) continue;
      out.push(mLine(`If any enemy has > ${n - 1} ${s.scale.unit}, test next line`, `${s.name} beats your other spells from ${n} ${s.scale.unit} on`, true));
      out.push(mLine(`If any enemy has most ${s.scale.unit}, cast ${s.name} on that creature`, `+${Math.round(s.scale.f * 100)}% per ${s.scale.unit.slice(0, -1)} on the target`));
    }
    if (!x.attackFirst && !plain[0].focus) out.push({ block: `cast ${plain[0].name} on`, name: plain[0].name });
    plain.forEach((s, i) => out.push(mLine(`If any enemy ${s.focus || x.T.focus}, cast ${s.name} on that creature`,
      i ? `${s.name} — next strongest, used once the ones above are out of charges` : s.focus ? `${s.name} — best against that target` : `${s.name} — your strongest single-target spell`)));
    return out;
  }
  // once-per-battle ally spells (Sapphire Power): the allies whose Artifact Spell Slot fires on what they do most
  function onceTargets(x) {
    const out = [];
    build.slots.forEach((s, i) => {
      const a = s.cid != null ? resolveArtifact(s) : null; if (!a || !(a.spells || []).length) return;
      const trig = SLOT_TRIGGER[a.primary], ax = s === x.slot ? x : macroContext(s, false); if (!ax) return;
      const fits = trig === "turn" || (trig === "attack" && ax.attackFirst) || (trig === "cast" && ax.spells.length && !ax.attackFirst)
        || (trig === "defend" && ax.defendValue) || (trig === "provoke" && ax.provokeMain);
      out.push({ i, self: s === x.slot, name: ax.c.name, score: fits ? 2 : 1 });
    });
    return out.sort((p, q) => q.score - p.score || p.i - q.i).slice(0, x.T.onceTargets);
  }
  // ── The proposal rules, in priority order (first line that acts wins in-game). `when(x)` gates a rule, `lines(x)`
  // returns its lines. Rules follow the in-game facts in MACRO_ENGINE.md "Authoring rules". ──
  const MACRO_RULES = [
    { key: "rez", when: x => x.by("rez").length,
      lines: x => x.by("rez").map(s => mLine(`If any ally is dead, ${castOn(s)}`, `${s.name} resurrects a dead ally`)) },
    { key: "heal-emergency", when: x => x.heals.length,
      lines: x => x.heals.map(s => mLine(`If any ally has < ${x.T.healEmergency}% Health, ${castOn(s)}`, `${s.name} — emergency heal before an ally dies`)) },
    { key: "unsilence", when: x => x.by("unsilence").length,
      lines: x => x.by("unsilence").map(s => mLine(`If any ally has Silenced, ${castOn(s)}`, `${s.name} lifts Silence so your casters can act`)) },
    { key: "once", when: x => x.by("once").length,
      lines: x => x.by("once").flatMap(s => onceTargets(x).flatMap((t, k) => t.self
        ? [mLine(`If this creature is on turn ${k + 1}, cast ${s.name} on this creature`, `${s.name} lasts the whole battle — once, on turn ${k + 1}`)]
        : [mLine(`If this creature is on turn ${k + 1}, test next line`, `${s.name} lasts the whole battle — once per ally`, true),
           mLine(`If ally (${t.i + 1}) has > 0% Health, cast ${s.name} on that creature`, `${t.name} gets it on turn ${k + 1}`)])) },
    { key: "ally-attack", when: x => x.by("ally-attack").length,
      lines: x => x.by("ally-attack").map(s => mLine(`If any ally has highest Attack, cast ${s.name} on that creature`, `${s.name} — your hardest hitter attacks again`)) },
    { key: "provoke-spell", when: x => x.by("provoke").length,
      lines: x => x.by("provoke").map(s => mLine(`If this creature has > 0 living enemies, ${castOn(s)}`, `${s.name} draws enemy fire to this tank`)) },
    { key: "provoke-main", when: x => x.provokeMain,
      lines: x => [mLine(`If this creature has > 0% Health, provoke`, `Its Citrine gems cast when it Provokes (${x.citrine.provoke} gems)`)] },
    { key: "provoke-tank", when: x => !x.provokeMain && !x.by("provoke").length && x.tanky && x.hasProvokeTrait,
      lines: x => [mLine(`If this creature has > 0% Health, provoke`, `Tanky with a provoke trait — draw fire to protect the party`)] },
    { key: "heal-sustain", when: x => x.heals.length,
      lines: x => x.heals.map(s => mLine(`If any ally has < ${x.T.healSustain}% Health, ${castOn(s)}`, `${s.name} — keep allies healthy`)) },
    { key: "drain", when: x => x.singleDmg.some(s => s.drains),
      lines: x => x.singleDmg.filter(s => s.drains).flatMap(s => [
        mLine(`If any ally has < ${x.T.drainHeal}% Health, test next line`, `Someone is hurt`, true),
        mLine(`If any enemy ${x.T.focus}, cast ${s.name} on that creature`, `${s.name} heals your side by the damage dealt`)]) },
    { key: "debuff", when: x => x.by("debuff").length,
      lines: x => x.by("debuff").map(s => mLine(`If any enemy has < ${x.T.debuffFloor} debuffs, ${castOn(s)}`, `${s.name} — debuff an un-debuffed enemy`)) },
    { key: "buff", when: x => x.by("buff").length,
      lines: x => x.by("buff").map(s => mLine(`If any ally has < ${x.T.buffFloor} buffs, ${castOn(s)}`, `${s.name} — buff an un-buffed ally`)) },
    { key: "summon", when: x => x.by("summon").length,
      lines: x => x.by("summon").map(s => mLine(`If this creature has < ${x.T.minionCap} minions, ${castOn(s)}`, `${s.name} summons while you have room`)) },
    { key: "defend-value", when: x => x.defendValue,
      lines: x => [mLine(`If this creature has > 0% Health, defend`, x.citAct === "defend" ? `Its Citrine gems cast when it Defends (${x.citrine.defend} gems)` : `Its traits / relic pay off when it Defends`)] },
    { key: "attack-first", when: x => x.attackFirst,
      lines: x => [{ block: "attack", name: "Attack" },
        mLine(`If any enemy ${x.T.focus}, attack that creature`, x.citAct === "attack" ? `Its Citrine gems cast when it Attacks (${x.citrine.attack} gems)` : `An attacker: attack first; spells below are the fallback (e.g. while Scorned)`)] },
    { key: "aoe", when: x => x.aoe.length,
      lines: x => x.aoe.map(s => mLine(`If this creature has > ${x.T.aoeMinEnemies - 1} living enemies, ${castOn(s)}`, `${s.name} hits every enemy — worth it while ${x.T.aoeMinEnemies}+ remain`)) },
    { key: "damage-single", when: x => x.singleDmg.length, lines: damageLines },
    { key: "control", when: x => x.by("control").length,
      lines: x => x.by("control").map(s => mLine(`If any enemy is highest on Timeline, ${castOn(s)}`, `${s.name} pushes back the next enemy to act`)) },
    // always act: attack (if its attacks are worth a turn), then defend, then skip turn — nothing blocks skipping,
    // so the turn is never handed back to you
    { key: "tail-attack", when: x => x.attackWorth && !x.attackFirst,
      lines: x => [mLine(`If any enemy ${x.T.focus}, attack that creature`, x.intAttacks ? `Its attacks use Intelligence — also covers Silence and spells out of charges` : `Covers Silence and spells out of charges`)] },
    // a line whose target is Invisible does nothing; "a random enemy" re-rolls past Invisible and dead enemies (attacks)
    { key: "tail-random", when: x => x.attackWorth,
      lines: () => [mLine(`If this creature has > 0 living enemies, attack a random enemy`, `The lines above can pick an Invisible enemy and fail; a random attack re-rolls past it`)] },
    { key: "tail-defend", when: x => !x.defendValue,
      lines: () => [mLine(`If this creature has > 0% Health, defend`, `Nothing else can act (Scorned, every enemy Invisible, …)`)] },
    { key: "tail-skip", when: () => true,
      lines: () => [mLine(`If this creature has > 0% Health, skip turn`, `Last resort — nothing blocks skipping, so the macro never hands the turn back`)] },
  ];
  // role chips for the header — dominant spell purposes + stat lean
  function macroRoles(x) {
    const roles = [];
    if (x.by("rez").length || x.heals.length) roles.push("Healer");
    if (x.by("buff").length || x.by("summon").length || x.by("once").length || x.by("ally-attack").length || x.by("unsilence").length) roles.push("Support");
    if (x.by("debuff").length || x.by("control").length) roles.push("Debuffer");
    if (x.dmg.length && !x.attackFirst) roles.push("Caster");
    if (x.by("provoke").length || (x.tanky && x.hasProvokeTrait) || x.defendValue || x.provokeMain) roles.push("Tank");
    if (x.attackFirst) roles.push("Attacker");
    if (!roles.length) roles.push(x.dmg.length ? "Caster" : x.attackWorth ? "Attacker" : "Tank");
    return [...new Set(roles)];
  }
  // The main single-target action's target block (expanded into the free lines): Shelled negates the next hit and Barrier
  // absorbs it, and chains don't narrow, so each test needs its own enemy (n) chain.
  //   A: per slot, "< holeHp% Health" + "doesn't have Shelled" + "doesn't have Barrier" → act      (18 lines)
  //   F: "any enemy < finishHp% Health" → "lowest Health" → act, through Shelled / Barrier       (2)
  //   C: per slot, "doesn't have Shelled" + "doesn't have Barrier" → act (no Health band)          (12)
  //   B: per slot, "doesn't have Barrier" → act                                                   (6)
  // The biggest of A+F+B / A+B / A+F / A / F+C / C / F+B / B / F that fits is used.
  function targetBlock(x, act, name, room) {
    const at = act === "attack" ? "attack that creature" : `${act} that creature`, slots = [1, 2, 3, 4, 5, 6];
    const A = slots.flatMap(n => [
      mLine(`If enemy (${n}) has < ${x.T.holeHp}% Health, test next line`, `Enemy (${n}) is hurt…`, true),
      mLine(`If enemy (${n}) doesn't have Shelled, test next line`, `…has no Shelled (it negates the next hit)…`, true),
      mLine(`If enemy (${n}) doesn't have Barrier, ${at}`, `…and no Barrier: ${name} lands in full`)]);
    const F = [mLine(`If any enemy has < ${x.T.finishHp}% Health, test next line`, `Someone is nearly dead…`, true),
      mLine(`If any enemy has lowest Health, ${at}`, `…finish it even through Shelled / Barrier`)];
    const B = slots.map(n => mLine(`If enemy (${n}) doesn't have Barrier, ${at}`, `No Barrier to soak ${name}`));
    const C = slots.flatMap(n => [mLine(`If enemy (${n}) doesn't have Shelled, test next line`, `Enemy (${n}) has no Shelled…`, true),
      mLine(`If enemy (${n}) doesn't have Barrier, ${at}`, `…and no Barrier: ${name} lands in full`)]);
    for (const opt of [[A, F, B], [A, B], [A, F], [A], [F, C], [C], [F, B], [B], [F]]) { const l = opt.flat(); if (l.length <= room) return l; }
    return [];
  }
  // assemble the proposal: run each rule in order, collect its lines, expand the target block into the free lines, trim
  // to the in-game cap (the always-act tail is kept: trimming drops lines from the body)
  function proposeMacro(slot) {
    const x = macroContext(slot); if (!x) return null;
    let body = [], tail = [];
    for (const rule of MACRO_RULES) if (rule.when(x)) for (const l of rule.lines(x)) (rule.key.startsWith("tail-") ? tail : body).push(l);
    const bi = body.findIndex(l => l.block);
    if (bi >= 0) { const b = body[bi]; body = body.filter(l => !l.block);
      body.splice(bi, 0, ...targetBlock(x, b.block, b.name, x.T.maxLines - body.length - tail.length)); }
    let keep = body.slice(0, Math.max(0, x.T.maxLines - tail.length));
    while (keep.length && keep[keep.length - 1].chain) keep.pop();   // never end the body on a dangling "test next line"
    const lines = keep.concat(tail);
    const cit = Object.entries(x.citrine).map(([a, n]) => `${n} on ${a}`).join(", ");
    const note = x.noManual ? "Can't cast spells manually — attacks and defends only."
      : cit && !x.spells.length ? `Every gem has Citrine (${cit}) — they cast from its actions, not manually.`
      : !x.spells.length ? "No castable spell gems — attacks and defends only."
      : body.length > keep.length ? `Trimmed to the ${x.T.maxLines}-line in-game cap (${body.length + tail.length} proposed).`
      : cit ? `Citrine gems (${cit}) cast from its actions and are left out of the cast lines.` : null;
    return { roles: macroRoles(x), lines, spells: x.spells, note };
  }
  function macroProposalText(slotIdx) {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid), p = proposeMacro(slot);
    if (!c || !p) return "";
    // indent chained lines so the copied text mirrors the in-editor structure
    const body = p.lines.map((l, i) => `${i + 1}. ${l.chain ? "  " : ""}${l.en}`).join("\n");
    return `${c.name} Macro — proposed (${p.lines.length} lines)\n${body}`;
  }
  function renderMacroProposal(slotIdx) {
    const slot = build.slots[slotIdx], p = proposeMacro(slot);
    if (!p) return "";
    const roleChips = p.roles.map(r => `<span class="macro-role">${esc(r)}</span>`).join("");
    const rows = p.lines.map((l, i) => `<div class="macro-line ${l.chain ? "chain" : ""}">
      <span class="macro-ln">${i + 1}</span>
      <div class="macro-line-body"><div class="macro-en">${esc(l.en)}</div>
        <div class="macro-why">${esc(l.why)}</div></div></div>`).join("");
    return `<div class="macro-proposal">
      <div class="macro-head"><div class="macro-roles">${roleChips}<span class="macro-count">${p.lines.length}/${MACRO_TUNING.maxLines} lines</span></div>
        <button class="btn-ghost macro-copy" data-action="macro-copy" data-slot="${slotIdx}" title="Copy as plain text">Copy</button></div>
      ${p.note ? `<div class="slot-sub" style="margin:2px 0 6px">${esc(p.note)}</div>` : ""}
      <div class="macro-lines">${rows}</div>
      <div class="macro-foot">Lines run top-down; the first that matches acts. Chained lines (indented) must all
        pass before the action fires. Replicate this in the in-game Macro editor, then set the creature's
        default action to <b>Macro</b>.</div>
    </div>`;
  }
  // ── Macros (Menu) — party-wide macro proposals, one creature at a time ───────
  function openMacros() {
    const filled = build.slots.map((s, i) => i).filter(i => build.slots[i].cid != null);
    ovState = { kind: "macros", sel: filled.length ? filled[0] : null, render: renderMacros };
    openOverlay(ovState.render());
  }
  function renderMacros() {
    const st = ovState;
    const filled = build.slots.map((s, i) => i).filter(i => build.slots[i].cid != null);
    let body;
    if (!filled.length) {
      body = `<div class="slot-sub" style="padding:16px">Add creatures to your party, equip them with spell gems,
        then come back here for a proposed battle macro you can replicate in-game.</div>`;
    } else {
      if (st.sel == null || !filled.includes(st.sel)) st.sel = filled[0];
      const chips = filled.map(i => { const c = CREA.get(build.slots[i].cid);
        return `<button class="macro-crea ${st.sel === i ? "on" : ""}" data-action="macro-crea" data-slot="${i}" title="${esc(c.name)}">
          <span class="macro-crea-face">${slotFace(build.slots[i], c)}</span>
          <span class="macro-crea-name">${esc(c.name)}</span></button>`; }).join("");
      body = `<div class="macro-creabar">${chips}</div>${renderMacroProposal(st.sel)}`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Macros</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="thr-intro">Set each creature's default battle action to <b>Macro</b>, then hold to auto-battle.
          These proposals predict a sensible brain from each creature's spell gems, traits and stats.</div>
        ${body}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── creature detail ────────────────────────────────────────────────────────
  function openCreatureDetail(slotIdx) {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid); if (!c) return;
    dovState = { kind: "creature-detail", slotIdx, render: () => renderCreatureDetail(dovState.slotIdx) };
    openDetail(dovState.render());
  }
  // ── Creature detail "Triggers" (BACKLOG #5): every triggered effect the build attaches to this creature, grouped by
  // the event it fires on. Traits + relic ranks join by their Activates at / Activates When tags (relic ranks: per-rank
  // tags, relics[].ranks[].trig); spells by their slot trigger (artifact type / nether stone); spell-gem properties by
  // code (Citrine bc_OnAttack/Defend/Provoke/Heal, Bloodstone/Carnelian/Emerald/Garnet after a cast, Jade at battle
  // start); artifact "X On Damage" properties roll in bc_EventDamage on the attacker's artifact (roll_sites) → Deals Damage.
  // Tag matching is case-insensitive (the taxonomy carries both "Enemy Is Healed" and "Enemy is Healed").
  // v2: a group = the Trigger values it shows; an entry's chip = its side + the trigger (role label when it has one)
  const TRIG_GROUPS = [
    { key: "battle", label: "Start of Battle", trig: ["Battle Start"] },
    { key: "turn", label: "On Turn", trig: ["Turn Start", "Turn End"], slot: "On Turn" },
    { key: "attack", label: "Attack", trig: ["Attack"], slot: "On Attack" },
    { key: "cast", label: "Cast", trig: ["Cast"], slot: "On Cast" },
    { key: "defend", label: "Defend", trig: ["Defend"], slot: "On Defend" },
    { key: "provoke", label: "Provoke", trig: ["Provoke"], slot: "On Provoke" },
    { key: "damage", label: "Damage", trig: ["Damage", "DoT Tick"] },
    { key: "crit", label: "Critical Hits", trig: ["Critical Hit"] },
    { key: "dodge", label: "Dodge", trig: ["Dodge"] },
    { key: "heal", label: "Healing", trig: ["Heal"] },
    { key: "status", label: "Buffs & Debuffs", trig: ["Buff", "Debuff", "Buff Removed", "Debuff Removed"] },
    { key: "stats", label: "Stats", trig: ["Stat Gain", "Stat Loss"] },
    { key: "death", label: "Death & Resurrection", trig: ["Death", "Resurrection"] },
    { key: "timeline", label: "Timeline", trig: ["Timeline Move"] },
    { key: "minion", label: "Minions", trig: ["Minion Gained", "Minion Lost", "Minion Action"] },
    { key: "trait", label: "Trait Activates", trig: ["Trait Activation"] },
  ];
  const TRIG_VAL_GROUP = new Map(TRIG_GROUPS.flatMap(g => g.trig.map(v => [v, g.key])));
  const TRIG_SIDE_WORD = { Self: "This creature", Ally: "Ally", "Self or Ally": "Ally", Adjacent: "Adjacent", Enemy: "Enemy", Any: "Any creature" };
  const trigEvLabel = (e) => { const val = e.t.slice(9), verb = ((TRIG_ROLE_LABEL[val] || {})[e.r]) || val, side = TRIG_SIDE_WORD[e.s];
    return side ? `${side}: ${verb}` : verb; };
  const TRIG_GEM_PROP = { CITRINE_ATTACK: "attack", CITRINE_DEFEND: "defend", CITRINE_PROVOKE: "provoke", CITRINE_HEAL: "heal",
    BLOODSTONE: "cast", CARNELIAN: "cast", EMERALD: "cast", GARNET: "cast", JADE: "battle" };
  function slotTriggers(slot) {
    const by = new Map(TRIG_GROUPS.map(g => [g.key, []]));
    // an object's v2 Trigger tags → Map(group key → the event labels, for the chip); keep(e) picks entries (relic ranks)
    const byTags = (o, keep) => { const m = new Map();
      for (const e of (o && o.taxo2) || []) { if (!e.t.startsWith("Trigger::") || (keep && !keep(e))) continue;
        const k = TRIG_VAL_GROUP.get(e.t.slice(9)); if (!k) continue; if (!m.has(k)) m.set(k, []);
        const ev = trigEvLabel(e); if (!m.get(k).includes(ev)) m.get(k).push(ev); }
      return m; };
    const art = resolveArtifact(slot);
    // traits (innate / fusion / artifact material / nether stone); non-innate ones say where they come from
    const traitSrc = new Map(), noteSrc = (tid, name) => { if (tid != null && !traitSrc.has(tid)) traitSrc.set(tid, name); };
    if (art) {
      for (const id of art.traits || []) { const ti = TRAITITEM.get(id); if (ti) noteSrc(ti.traitId, art.name); }
      for (const nid of art.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
        for (const p of n.props || []) if (p.cat === "trait") { const ti = TRAITITEM.get(p.key); if (ti) noteSrc(ti.traitId, n.name); } }
    }
    const c = CREA.get(slot.cid), f = slot.fusion != null ? CREA.get(slot.fusion) : null, en = (baseStats(slot) || {}).endowed;
    const innate = new Set([c && c.traitId, f && f.traitId].filter(x => x != null));
    if (en) noteSrc(en.traitId, "Endowment");
    for (const tid of slotTraitIds(slot)) {
      const t = TRAIT[tid]; if (!t) continue;
      const src = innate.has(tid) ? null : traitSrc.get(tid) || null;
      for (const [k, evs] of byTags(t)) by.get(k).push({ kind: "trait", tid, evs, src });
    }
    // relic ranks up to the equipped rank, by the rank whose code clause holds each tag (rk; Deprived ignores relics).
    // A trigger tag with no rank (its site is in no rank clause) shows once for the relic as a whole.
    const relic = slot.relic && !FX.ignores("relics") ? RELIC.get(slot.relic.id) : null;
    if (relic) {
      for (const r of relic.ranks) if (r.rank <= slot.relic.rank)
        for (const [k, evs] of byTags(relic, (e) => e.rk === r.rank)) by.get(k).push({ kind: "relic", relic, r, evs });
      for (const [k, evs] of byTags(relic, (e) => e.rk == null)) by.get(k).push({ kind: "relic", relic, r: null, evs });
    }
    if (art) {
      // spells socketed in the artifact: the native slot fires on the type trigger, nether stone spells on their own
      const slotGroup = (trig) => (TRIG_GROUPS.find(g => g.slot === trig) || {}).key;
      const typeTrig = ART_TYPE_TRIGGER[art.primary], ach = artSlotChance(art, slot);
      for (const id of art.spells || []) { const sp = SPELL.get(id), k = slotGroup(typeTrig); if (sp && k) by.get(k).push({ kind: "spell", sp, trig: typeTrig, src: art.name, ch: ach }); }
      for (const nid of art.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
        for (const pr of n.props || []) if (pr.cat === "spell") { const sp = SPELL.get(pr.key), trig = pr.trigger || "On Attack", k = slotGroup(trig);
          if (sp && k) by.get(k).push({ kind: "spell", sp, trig, src: n.name, ch: netherSpellChance(trig) }); } }
      for (const [prop, { value, unit }] of artifactBonusRows(art).extra) if (/ On Damage$/i.test(prop))
        by.get("damage").push({ kind: "artprop", prop, value, unit, art });
    }
    // equipped spell gems' trigger properties
    for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid), sp = gemSpell(g); if (!sp) continue;
      for (const pid of g.propIds || []) { const p = SPELLPROP.get(pid), k = p && TRIG_GEM_PROP[p.key]; if (k) by.get(k).push({ kind: "gemprop", g, sp, p }); } }
    // spec perks (allocated rank) + anointments (full rank) whose trigger scope covers this creature
    const perks = new Map(), spec = curSpec();
    if (spec) for (const p of spec.perks) { const r = perkRank(spec, p); if (r > 0) perks.set(p.key, { p, rank: r, src: spec.label }); }
    for (const a of equippedAnointObjs()) if (!perks.has(a.key) || perks.get(a.key).rank < perkMax(a)) perks.set(a.key, { p: a, rank: perkMax(a), src: a.spec });
    for (const { p, rank, src } of perks.values()) if (p.trigScope && scopeCovers(slot, p.trigScope, rank))
      for (const [k, evs] of byTags(p)) by.get(k).push({ kind: "perk", p, rank, evs, src });
    // party members' traits that this creature can set off or carry out ("After your creatures attack …"); a trait whose
    // trigger is its bearer ("After this creature …") stays on the bearer's page. One entry per trait, its owners listed.
    const own = new Set(slotTraitIds(slot)), mates = new Map();
    for (const o of build.slots) if (o !== slot && o.cid != null) for (const tid of slotTraitIds(o)) {
      const t = TRAIT[tid]; if (!t || own.has(tid) || !t.trigScope || (t.trigScope.t || []).includes("self") || !scopeCovers(slot, t.trigScope)) continue;
      if (!mates.has(tid)) mates.set(tid, []); mates.get(tid).push((CREA.get(o.cid) || {}).name);
    }
    for (const [tid, owners] of mates) for (const [k, evs] of byTags(TRAIT[tid])) by.get(k).push({ kind: "trait", tid, evs, src: owners.join(", ") });
    return TRIG_GROUPS.map(g => ({ ...g, items: by.get(g.key) })).filter(g => g.items.length);
  }
  // does a trigger scope ({t, a}: build-data's read of the game text) cover this party slot? party = every creature;
  // race / class = the creature's race / class; first:n = the first n creatures in the party; top:<stat>:n = among the n
  // highest final values of that stat (ties count). "r<x>" counts scale with the perk's rank (x per rank).
  function scopeCovers(slot, sc, rank = 1) {
    const filled = build.slots.filter(s => s.cid != null), c = CREA.get(slot.cid), b = baseStats(slot);
    const n = (x) => String(x).startsWith("r") ? Math.round(parseFloat(String(x).slice(1)) * rank) : +x;
    return [...(sc.t || []), ...(sc.a || [])].some(v => {
      const [kind, x, y] = v.split(":");
      if (kind === "party") return true;
      if (kind === "race") return !!c && (c.race === x || (b && b.race === x));   // Endowment changes the race; "your Animatus" still means it
      if (kind === "class") return !!b && b.cls === x;
      if (kind === "first") return filled.indexOf(slot) > -1 && filled.indexOf(slot) < n(x);
      if (kind === "top") { const mine = finalStats(slot).final[x]; return filled.filter(s => finalStats(s).final[x] > mine).length < n(y); }
      return false;
    });
  }
  const trigChip = (txt) => `<span class="art-trigger">${esc(txt)}</span>`;
  function trigItemHtml(it) {
    if (it.kind === "spell") return spellGemCard(it.sp, it.trig, it.src, it.ch);
    if (it.kind === "gemprop") return spellGemCard(it.sp, `${it.p.name} · ${propShort(it.p, gemTier(it.g))}`, gemName(it.g) !== it.sp.name ? gemName(it.g) : null, null);
    if (it.kind === "trait") return `<div class="art-spellcard trig-card"><div class="art-spellcard-head">${traitBanner(it.tid)}${trigChip(it.evs.join(" · "))}</div>
        ${it.src ? `<div class="slot-sub" style="text-align:left">from ${esc(it.src)}</div>` : ""}
        <div class="trait-desc">${richText((TRAIT[it.tid] || {}).desc || "")}</div></div>`;
    if (it.kind === "perk") return `<div class="art-spellcard"><div class="art-spellcard-head">${it.p.icon ? `<span class="prop-ico sm">${spriteImg(it.p.icon, "px")}</span>` : ""}<b>${esc(it.p.name)}</b>${trigChip(it.evs.join(" · "))}</div>
        <div class="slot-sub" style="text-align:left">from ${esc(it.src)}</div>
        <div class="trait-desc">${perkText(it.p.desc || "", it.rank)}</div></div>`;
    if (it.kind === "relic") { const ra = relicArt(it.relic);
      return `<div class="art-spellcard apx-clickable" data-action="apx-open" data-ek="relic" data-eid="${it.relic.id}" title="View taxonomy">
        <div class="art-spellcard-head">${ra ? `<span class="prop-ico sm">${spriteImg(ra, "px")}</span>` : ""}<b>${esc(relicShortName(it.relic))}${it.r ? ` · R${it.r.rank}` : ""}</b>${trigChip(it.evs.join(" · "))}</div>
        ${it.r ? `<div class="trait-desc">${richText(it.r.desc || "")}</div>` : ""}</div>`; }
    if (it.kind === "artprop") { const ic = artIcon(it.art);
      return `<div class="art-spellcard"><div class="art-spellcard-head">${ic ? `<span class="prop-ico sm">${spriteImg(ic, "px")}</span>` : ""}<b>${esc(it.prop)}</b>${trigChip(`Deals Damage · ${it.value}${it.unit === "%" ? "%" : ""}`)}</div>
        <div class="slot-sub" style="text-align:left">from ${esc(it.art.name)}</div></div>`; }
    return "";
  }
  function triggersSectionHtml(slot) {
    const groups = slotTriggers(slot); if (!groups.length) return "";
    return `<div class="section-label" style="margin-top:14px">Triggers</div>
      ${groups.map(g => `<div class="trig-group"><div class="etax-cat">${esc(g.label)}</div>
        <div class="art-spellcards">${g.items.map(trigItemHtml).join("")}</div></div>`).join("")}`;
  }
  function renderCreatureDetail(slotIdx) {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid); if (!c) return "";
    const fs = finalStats(slot), b = fs.base;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const sc = slot.scrolls || {};
    // decompose the base: raw creature/fusion base, personality flat ±33%, and scroll bonus (each +1 base)
    const persCell = (d) => d ? `<span class="stat-val ${d > 0 ? "pos" : "neg"}">${d > 0 ? "+" : ""}${d}</span>` : `<span class="stat-val muted">—</span>`;
    const scrollCell = (n) => n ? `<span class="stat-val scroll">+${n}</span>` : `<span class="stat-val muted">—</span>`;
    const rows = STAT_KEYS.map(k => {
      const scroll = sc[k] || 0, rawBase = b[k] - scroll, persDelta = fs.adj[k] - b[k], pct = fs.pct[k];
      const touched = pct !== 0 || persDelta !== 0 || scroll !== 0;
      return `<div class="stat-row ${touched ? "hl-med" : ""}"><span class="stat-name">${STAT_LABEL[k]}</span>
        <span class="stat-val base">${rawBase}</span>${persCell(persDelta)}${scrollCell(scroll)}
        <span class="stat-val art">${pct ? "+" + pct + "%" : "—"}</span>
        <span class="stat-val total">${fs.final[k]}</span></div>`;
    }).join("");
    const scrollTot = STAT_KEYS.reduce((s, k) => s + (sc[k] || 0), 0);
    const rawBaseTot = b.total - scrollTot;
    const persTot = STAT_KEYS.reduce((s, k) => s + (fs.adj[k] - b[k]), 0);
    const traitIds = slotTraitIds(slot);
    const en = b.endowed || null;   // Endowment: the Animatus's battle-start fusion with creature #2
    const innateN = new Set([c.traitId, f ? f.traitId : null, en ? en.traitId : null].filter(x => x != null)).size;
    const hasArtifactTrait = traitIds.length > innateN;
    const traitHtml = traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}
      <div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div>${traitSpellRow(tid, true)}</div>`).join("");
    const relic = slot.relic ? RELIC.get(slot.relic.id) : null;
    // equipped artifact: header row + spell gems + resolved stat bonuses. Its traits are already listed
    // under Traits above (labelled "+ artifact"), so they aren't repeated here.
    const art = resolveArtifact(slot);
    const artHtml = art ? (() => {
      const { core, extra } = artifactBonusRows(art), spells = artifactSpellContainers(art, slot), clash = artNetherClash(art);
      return `<div class="section-label" style="margin-top:14px">Artifact — Rank ${art.rank || 50}</div>
        <div class="prop-list"><div class="prop-row static"><span class="prop-ico">${spriteImg(artIcon(art), "px")}</span>
          <span class="prop-name"><b>${esc(art.name)}</b></span><span class="prop-stat">${esc(art.primary || "")}</span></div></div>
        ${clash ? `<div class="slot-sub sg-clsnote clash-note">${esc(clashText(clash))}.</div>` : ""}
        ${spells ? `<div class="art-spellcards" style="margin-top:6px">${spells}</div>` : ""}
        <div style="margin-top:6px">${bonusTableHtml(core, extra)}</div>`;
    })() : "";
    // party navigation — step between filled creature slots (wraps); chevrons flank the sprite on
    // mobile, sit below it on web. Hidden entirely when there's only one creature.
    const filled = build.slots.map((s, i) => i).filter(i => build.slots[i].cid != null);
    const pos = filled.indexOf(slotIdx), total = filled.length, hasNav = total > 1;
    const chev = (dir, cls) => `<button class="cd-chev ${cls}" data-action="crea-nav" data-dir="${dir}" title="${dir < 0 ? "Previous" : "Next"} creature">${dir < 0 ? "‹" : "›"}</button>`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(c.name)}${f ? " ⚭ " + esc(f.name) : en ? ` ⚭ <span title="Endowment">${esc(en.name)}</span>` : ""}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left cd-left">
          <div class="cd-sprite-row">${hasNav ? chev(-1, "flank prev") : ""}
            <div class="cd-sprite">${slotFace(slot, c)}</div>${hasNav ? chev(1, "flank next") : ""}</div>
          <div class="slot-sub"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span>${b.race ? " · " + esc(b.race) : ""}</div>
          ${hasNav ? `<div class="cd-nav-below">${chev(-1, "prev")}<span class="cd-nav-pos">${pos + 1} / ${total}</span>${chev(1, "next")}</div>` : ""}</div>
        <div class="ovl-center"><div class="ovl-center-scroll">
          <div class="stat-grid detailed"><div class="stat-header"><span>Stat</span>
            <span style="text-align:right">Base</span><span style="text-align:right">Pers</span>
            <span style="text-align:right">Scroll</span><span style="text-align:right">Bonus</span>
            <span style="text-align:right">Total</span></div>${rows}
            <div class="stat-row hl-high"><span class="stat-name">Total</span>
              <span class="stat-val base">${rawBaseTot}</span>
              <span class="stat-val ${persTot > 0 ? "pos" : persTot < 0 ? "neg" : "muted"}">${persTot ? (persTot > 0 ? "+" : "") + persTot : "—"}</span>
              <span class="stat-val scroll">${scrollTot ? "+" + scrollTot : "—"}</span>
              <span class="stat-val art"></span><span class="stat-val total">${fs.total}</span></div></div>
          <div class="section-label" style="margin-top:14px">Traits (innate${f ? " + fusion" : ""}${en ? " + Endowment" : ""}${hasArtifactTrait ? " + artifact" : ""})</div>
          ${traitHtml || `<div class="slot-sub">No traits.</div>`}
          ${artHtml}
          ${relic ? `<div class="section-label" style="margin-top:14px">Relic — Rank ${slot.relic.rank}${FX.ignores("relics") ? ` <span style="color:var(--bad);font-weight:700">· ignored (Deprived)</span>` : ""}</div>
            <div class="prop-list">
              <div class="prop-row static apx-clickable" data-action="apx-open" data-ek="relic" data-eid="${slot.relic.id}" title="View taxonomy"><span class="prop-ico">${relicArt(relic) ? spriteImg(relicArt(relic), "px") : ""}</span><span class="prop-name"><b>${esc(relic.name)}</b> <span class="etax-hint">tags ›</span></span></div>

              ${relic.ranks.filter(r => r.rank <= slot.relic.rank).map(r => `<div class="prop-row static">
                <span class="prop-name" style="flex:0 0 40px;color:var(--accent)">R${r.rank}</span>
                <span class="prop-stat" style="flex:1;text-align:left">${richText(r.desc)}</span></div>`).join("")}
            </div>` : ""}
          ${triggersSectionHtml(slot)}
        </div></div>
      </div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div><button class="btn-ghost" data-action="crea-edit" data-slot="${slotIdx}">Edit</button>
        <button class="btn-confirm" data-action="close-detail">Done</button></div></div>
    </div></div>`;
  }

  // ── realm cards (leveled collection) ───────────────────────────────────────
  function openCards() { ovState = { kind: "cards", search: "", clsFilter: null, render: renderCards }; openOverlay(ovState.render()); maybeFocusSearch(OV); }
  function renderCards() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const applyAll = cards.applyAll;
    const list = D.cards.filter(c => (!q || c.family.toLowerCase().includes(q)) && (!st.clsFilter || c.cls === st.clsFilter) && TagFilter.match(st, "card", c));
    const clsChip = st.clsFilter
      ? `<button class="facet on" data-action="facet-class">Class: ${classIco(st.clsFilter)}<b>${esc(st.clsFilter)}</b> <span class="facet-x" data-action="facet-class-clear">✕</span></button>`
      : `<button class="facet" data-action="facet-class">Class ▾</button>`;
    const tiles = list.map(c => {
      const lv = cardLevel(c.id);
      const bg = c.cls && CLASS_BG[c.cls] ? CLASS_BG[c.cls] : null;
      const tiers = c.tiers || [];
      // per-effect the badge shows how many cards that tier needs to activate
      const effects = c.effects.map((e, i) => {
        const cnt = tiers[i] != null ? tiers[i] : null;
        return `<div class="card-effect ${i < lv ? "on" : "off"}"><span class="ce-tier" title="${cnt != null ? `Needs ${cnt} cards` : `Tier ${i + 1}`}">${cnt != null ? cnt : i + 1}</span>${richText(e)}</div>`;
      }).join("");
      // "n / n / n" summary — how many cards are needed for each tier, active tiers highlighted by level
      const tierSummary = tiers.map((n, i) => `<span class="ct-seg ${i < lv ? "on" : "off"}">${n}</span>`).join(`<span class="ct-sep">/</span>`);
      return `<div class="card-tile lv${lv} ${applyAll ? "locked" : ""} ${c.cls === "Life" ? "cls-life" : ""}" style="--cardcls:${clsColor(c.cls)}">
        <div class="card-head">
          <div class="card-art">${bg ? `<img class="card-bg" src="${esc(bg)}" alt="">` : ""}${c.sprite ? spriteImg(c.sprite, "card-crit") : ""}${c.cls && CLASS_FRAME[c.cls] ? `<img class="card-frame" src="${esc(CLASS_FRAME[c.cls])}" alt="">` : ""}</div>
          <div class="card-title"><b>${esc(c.family)}</b><span class="cls-chip" style="color:${clsColor(c.cls)}">${esc(c.cls || "—")}</span></div>
        </div>
        ${tiers.length ? `<div class="card-tiers" title="Cards needed per tier">${tierSummary}</div>` : ""}
        <div class="card-effects">${effects}</div>
        <div class="card-level">
          <button class="lvl-btn" data-action="card-dec" data-id="${c.id}" ${lv === 0 || applyAll ? "disabled" : ""}>−</button>
          <span class="lvl-badge">${lv === 0 ? "Off" : "Lv " + lv}</span>
          <button class="lvl-btn" data-action="card-inc" data-id="${c.id}" ${lv >= c.effects.length || applyAll ? "disabled" : ""}>＋</button>
        </div></div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Realm Cards</h2>
        <input class="ovl-search" placeholder="Search family…" value="${esc(st.search)}" data-action="cards-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-filterbar">
        ${clsChip}${TagFilter.bar(st, "card")}
        <button class="facet" data-action="cards-all-on" ${applyAll ? "disabled" : ""}>All on</button>
        <button class="facet" data-action="cards-all-off" ${applyAll ? "disabled" : ""}>All off</button>
        <button class="facet ${applyAll ? "on" : ""}" data-action="cards-applyall" title="Ignore saved selections and treat every card as maxed">Apply all</button></div>
        <div class="ovl-center-scroll"><div class="card-grid">${tiles}</div></div></div></div>
      <div class="overlay-footer"><span class="foot-info">${applyAll ? "Ignoring saved — all cards applied" : "Using saved selections"}</span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── nether stones: library + stepped builder wizard (full stat+trick property pool) ──
  const gemPath = (key) => { const g = GEM_ICONS.find(x => x.key === key); return g ? g.path : (GEM_ICONS[0] && GEM_ICONS[0].path); };
  const NETHER_CATS = [
    { c: "stat", label: "Stat" }, { c: "trick", label: "Trick" }, { c: "trait", label: "Trait" }, { c: "spell", label: "Spell" },
  ];
  // a nether-socketed spell is a RAW spell (no property modifiers) fired on a trigger
  const NETHER_TRIGGERS = ["On Attack", "On Defend", "On Cast", "On Provoke", "On Turn"];
  // stone "Spell" filter chip cycles: off → any spell → each trigger → off. A stone matches when ANY of its spells fits.
  const NS_SPELL_CYCLE = [false, true, ...NETHER_TRIGGERS];
  const nsSpellNext = (cur) => NS_SPELL_CYCLE[(NS_SPELL_CYCLE.indexOf(cur ?? false) + 1) % NS_SPELL_CYCLE.length];
  const nsSpellMatch = (n, f) => !f || (n.props || []).some(p => p.cat === "spell" && (f === true || (p.trigger || "On Attack") === f));
  const nsSpellChip = (f, action) => `<button class="facet ${f ? "on" : ""}" data-action="${action}">${f && f !== true ? `Spell: <b>${esc(f)}</b>` : "Spell"}</button>`;
  function netherPropLabel(p) {
    if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return t ? t.name : p.key; }
    if (p.cat === "spell") { const s = SPELL.get(p.key); return `${s ? s.name : p.key} (${p.trigger || "?"})`; }
    return `+${p.value}${isFlatProp(p.key) ? "" : "%"} ${p.key}`;
  }
  const netherSummary = (n) => (n.props || []).map(netherPropLabel).join(" · ") || "no properties";
  const netherPropIcon = (p) => {
    if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return t && t.icon ? t.icon : null; }
    if (p.cat === "spell") return spellIcon(SPELL.get(p.key));
    const m = MAT_BY_PROP.get(p.key); return m && m.icon ? m.icon : null;
  };
  // ── code-grounded generation rules (D.netherGen; inv_NetherStoneCreate / GetStat / Rarity) ──
  // ≤6 stat+trick props, ≤3 traits, ≤3 spells, no duplicates; each prop has a tier ≥10 and value = f(tier) (+ cap).
  // (the game's rarity score after the stone name is intentionally not shown — low value for the planner)
  const NG = D.netherGen || { limits: { props_max: 6, traits_max: 3, spells_max: 3 }, tierStart: 10, props: {}, score: { prop: 10, trait: 150, spell: 75 } };
  const ngVal = (key, t) => { const r = NG.props[key]; if (!r) return null;
    const v = r.div ? r.base + Math.floor(t / r.div) : Math.floor(r.base + r.mult * (t - 1) + 1e-9);
    return r.cap != null ? Math.min(v, r.cap) : v; };
  const ngMin = (key) => ngVal(key, NG.tierStart);
  const ngMax = (key) => { const r = NG.props[key]; return r && r.cap != null ? r.cap : null; };
  const isFlatProp = (key) => { const g = propGroups.get(key); return !!(g && g.entries.some(e => e.unit === "flat")); };
  const isPropCat = (p) => p.cat === "stat" || p.cat === "trick";
  const netherCounts = (n) => { const ps = n.props || [];
    return { props: ps.filter(isPropCat).length, traits: ps.filter(p => p.cat === "trait").length, spells: ps.filter(p => p.cat === "spell").length }; };
  // rule violations (e.g. stones saved before the guardrails) — Save stays disabled until resolved
  function netherIssues(n) {
    const c = netherCounts(n), L = NG.limits, out = [], ps = n.props || [];
    if (c.props > L.props_max) out.push(`${c.props}/${L.props_max} stat & trick properties`);
    if (c.traits > L.traits_max) out.push(`${c.traits}/${L.traits_max} traits`);
    if (c.spells > L.spells_max) out.push(`${c.spells}/${L.spells_max} spells`);
    const dup = (arr) => arr.length !== new Set(arr).size;
    if (dup(ps.filter(isPropCat).map(p => p.key))) out.push("duplicate property");
    if (dup(ps.filter(p => p.cat === "trait").map(p => { const ti = TRAITITEM.get(p.key); return ti ? ti.traitId : p.key; }))) out.push("duplicate trait");
    if (dup(ps.filter(p => p.cat === "spell").map(p => p.key))) out.push("duplicate spell");
    for (const p of ps) if (isPropCat(p) && NG.props[p.key]) {
      const lo = ngMin(p.key), hi = ngMax(p.key), v = Number(p.value) || 0;
      if (v < lo || (hi != null && v > hi)) out.push(`${p.key} must be ${lo}${hi != null ? `–${hi}` : "+"}`);
    }
    return [...new Set(out)];
  }
  function openNether() {   // library
    ovState = { kind: "nether", sel: null, hideEquipped: false, search: "", libSort: "recent", render: renderNether };
    openOverlay(ovState.render());
  }
  // nether "Bonuses" view helpers — mirror the artifact panel (stat table + trait & spell-gem containers)
  const netherBonusRows = (n) => FX.foldBonus(FX.netherContribs(n));
  function netherTraitContainers(n) {
    return (n.props || []).filter(p => p.cat === "trait").map(p => { const ti = TRAITITEM.get(p.key), tid = ti ? ti.traitId : null; if (tid == null) return "";
      return `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div>${traitSpellRow(tid, true)}</div>`; }).join("");
  }
  function netherSpellContainers(n) {
    return (n.props || []).filter(p => p.cat === "spell").map(p => { const sp = SPELL.get(p.key); return sp ? spellGemCard(sp, p.trigger) : ""; }).join("");
  }
  function netherBonusView(n) {
    const { core, extra } = netherBonusRows(n);
    const traits = netherTraitContainers(n), spells = netherSpellContainers(n);
    return `${traits ? `<div class="section-label">Traits</div>${traits}` : ""}
      ${spells ? `<div class="section-label" ${traits ? `style="margin-top:12px"` : ""}>Spell Gems</div><div class="art-spellcards">${spells}</div>` : ""}
      <div class="section-label" ${traits || spells ? `style="margin-top:12px"` : ""}>Stat bonuses</div>
      ${bonusTableHtml(core, extra)}`;
  }
  function renderNether() {
    const st = ovState;
    const sel = st.sel != null ? nether.find(n => n.id === st.sel) : null;
    const q = (st.search || "").trim().toLowerCase(), sortK = st.libSort || "recent", d = sortSign(st.libSortRev);
    const core = (n) => netherBonusRows(n).core;
    let list = nether.filter(n => (!q || netherSearchText(n).includes(q))
      && (!st.nsTrait || (n.props || []).some(p => p.cat === "trait"))
      && nsSpellMatch(n, st.nsSpell));
    if (st.hideEquipped) list = list.filter(n => !netherEquippedInBuild(n.id));
    list = list.slice().sort(sortK === "name" ? (x, y) => d * x.name.localeCompare(y.name)
      : STAT_KEYS.includes(sortK) ? (x, y) => d * (core(y)[sortK] - core(x)[sortK]) || x.name.localeCompare(y.name)
      : (x, y) => d * (y.id - x.id));
    const libBar = `<div class="ovl-filterbar lib-bar">
        <button class="facet ${st.nsTrait ? "on" : ""}" data-action="lib-flag" data-f="nsTrait">Trait</button>
        ${nsSpellChip(st.nsSpell, "ns-spellcycle")}
        <span class="sg-sort-gap"></span>
        ${libSortSeg(st, [["recent", "Recent", true], ["name", "A–Z", false], ...STAT_KEYS.map(k => [k, STAT_LABEL[k].slice(0, 3), true])])}</div>`;
    // compact tiles: gem + name only; effects live in the info panel on selection
    const tiles = list.map(n => `
      <div class="pick-tile ${st.sel === n.id ? "selected" : ""}" data-action="nether-sel" data-id="${n.id}">
        <div class="pt-sprite">${spriteImg(gemSrc(n), "px")}</div>
        <div class="pt-name">${esc(n.name)}</div></div>`).join("")
      || `<div class="slot-sub" style="padding:10px">No Nether Stones${nether.length ? " match" : " yet — build one"}.</div>`;
    let info = "";
    if (sel) {
      const rows = (sel.props || []).map(p => {
        if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return libTraitRow(netherPropIcon(p), t ? t.name : p.key, t ? t.traitId : null); }
        return `<div class="prop-row static">
          <span class="prop-ico">${netherPropIcon(p) ? spriteImg(netherPropIcon(p), "px") : ""}</span>
          <span class="prop-name">${esc(netherPropLabel(p))}</span></div>`;
      }).join("") || `<div class="slot-sub" style="padding:8px">No effects.</div>`;
      // two views: Bonuses (resolved stat table + trait & spell-gem containers) | Sockets (raw socketed props)
      const view = st.nsView === "sockets" ? "sockets" : "bonuses";
      const toggle = `<div class="art-view-toggle">
        <button class="av-tab ${view === "bonuses" ? "on" : ""}" data-action="ns-view" data-v="bonuses">Bonuses</button>
        <span class="av-pipe">|</span>
        <button class="av-tab ${view === "sockets" ? "on" : ""}" data-action="ns-view" data-v="sockets">Sockets</button></div>`;
      const viewBody = view === "sockets" ? `<div class="prop-list">${rows}</div>` : netherBonusView(sel);
      info = `<div class="ns-info-head"><span class="ns-info-icon">${spriteImg(gemSrc(sel), "px")}</span><h3>${esc(sel.name)}</h3></div>
        ${toggle}${viewBody}`;
    }
    // footer mirrors the Artifacts library: Hide equipped · Edit / Delete (act on the selection) · Build
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Nether Stones</h2>
        <input class="ovl-search" placeholder="Search name, property, trait or spell…" value="${esc(st.search || "")}" data-action="lib-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect">${libBar}<div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
        ${sel ? `<div class="ovl-right lib-info">${info}</div>` : ""}
      </div>
      <div class="overlay-footer"><button class="facet ${st.hideEquipped ? "on" : ""}" data-action="nether-hide-equipped">Hide equipped</button>
        <div>
          <button class="btn-ghost" data-action="nether-edit" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Edit</button>
          <button class="btn-ghost danger" data-action="nether-del" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Delete</button>
          <button class="btn-confirm" style="min-width:96px" data-action="nether-new">Build</button>
        </div></div>
    </div></div>`;
  }

  // single-page nether builder — order: traits/properties → name → shape → colour (no step wizard)
  function openNetherBuilder(id) {
    const draft = id != null ? JSON.parse(JSON.stringify(nether.find(n => n.id === id)))
      : { id: null, name: `Nether Stone ${nextNetherId}`, icon: (GEM_ICONS[0] || {}).key, props: [] };
    // no colour defaults — a new stone shows the raw cor_n icon until the player picks Main/Outline
    ovState = { kind: "netherbuild", editId: id, draft, picking: false, search: "", render: renderNetherBuilder };
    openOverlay(ovState.render());
  }
  function renderNetherBuilder() {
    const st = ovState, s = st.draft;
    // ── 1) TRAITS & properties (any number, from the full stat+trick+trait+spell pool) ──
    // each prop = {cat,key,value}; stat/trick carry a % value, trait/spell are item refs (icon)
    const rows = s.props.map((p, i) => {
        const rm = `<button class="as-rm" data-action="nether-prop-del" data-i="${i}">✕</button>`;
        if (p.cat === "trait") {
          const t = TRAITITEM.get(p.key), to = t && t.traitId != null ? ` data-action="apx-open" data-ek="trait" data-eid="${t.traitId}"` : "";
          return `<div class="art-slot${to ? " apx-clickable" : ""}"${to}${to ? ` title="View taxonomy"` : ""}>${rm}<div class="as-ico">${t && t.icon ? spriteImg(t.icon, "px") : "✦"}</div>
            <div class="as-lab">${esc(t ? t.name : p.key)}</div><div class="as-sub">trait</div></div>`;
        }
        if (p.cat === "spell") {
          const sp = SPELL.get(p.key), ic = spellIcon(sp);
          const trg = `<select class="np-trigger" data-action="nether-trigger" data-i="${i}">${NETHER_TRIGGERS.map(x => `<option ${p.trigger === x ? "selected" : ""}>${x}</option>`).join("")}</select>`;
          return `<div class="art-slot">${rm}<div class="as-ico">${ic ? spriteImg(ic, "px") : "✷"}</div>
            <div class="as-lab">${esc(sp ? sp.name : p.key)}</div>${trg}</div>`;
        }
        const mat = MAT_BY_PROP.get(p.key);
        return `<div class="art-slot">${rm}<div class="as-ico">${mat && mat.icon ? spriteImg(mat.icon, "px") : "◆"}</div>
          <div class="as-lab">${esc(mat ? mat.name : p.key)}</div><div class="as-sub">${esc(p.key)}</div>
          <div class="np-wrap"><input type="number" class="np-num" data-action="nether-propval" data-i="${i}" value="${p.value}" min="${ngMin(p.key) ?? 0}"${ngMax(p.key) != null ? ` max="${ngMax(p.key)}"` : ""} step="1"><span class="np-pct">${isFlatProp(p.key) ? "" : "%"}</span></div></div>`;
      }).join("");
      const cnt = netherCounts(s), L = NG.limits;
      const full = { stat: cnt.props >= L.props_max, trick: cnt.props >= L.props_max, trait: cnt.traits >= L.traits_max, spell: cnt.spells >= L.spells_max };
      const addTile = Object.values(full).every(Boolean) ? ""
        : `<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="nether-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Add</div></div>`;
      const slotsBox = `<div class="art-slot-grid">${rows}${addTile}</div>`;
      let picker = "";
      if (st.picking === "menu") {
        // Stat + Trick share the 6-property budget; traits and spells have their own 3 each
        const used = { stat: cnt.props, trick: cnt.props, trait: cnt.traits, spell: cnt.spells };
        const max = { stat: L.props_max, trick: L.props_max, trait: L.traits_max, spell: L.spells_max };
        picker = `<div class="art-addmenu" data-action="noop">${NETHER_CATS.map(x => `<button class="chip" ${full[x.c] ? "disabled" : `data-action="nether-pickcat" data-c="${x.c}"`}>${x.label} ${used[x.c]}/${max[x.c]}</button>`).join("")}</div>`;
      } else if (st.picking) {
        const q = st.search.trim().toLowerCase(); let rowsHtml = "";
        if (st.picking === "stat" || st.picking === "trick") {
          const have = new Set(s.props.filter(isPropCat).map(p => p.key));
          rowsHtml = [...propGroups.values()].filter(g => g.group === st.picking && !have.has(g.name) && (!q || g.name.toLowerCase().includes(q))).map(g => {
            const mat = MAT_BY_PROP.get(g.name);
            return `<div class="prop-row" data-action="nether-pickprop" data-k="${esc(g.name)}">
              <span class="prop-ico">${mat && mat.icon ? spriteImg(mat.icon, "px") : ""}</span><span class="prop-name">${esc(mat ? mat.name : g.name)}</span><span class="prop-stat">${esc(g.entries.map(e => e.stat).join(" / "))}</span></div>`;
          }).join("");
        } else if (st.picking === "trait") {
          const haveT = new Set(s.props.filter(p => p.cat === "trait").map(p => (TRAITITEM.get(p.key) || {}).traitId));
          rowsHtml = D.traitItems.filter(t => t.traitName && !haveT.has(t.traitId) && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q))).slice(0, 300)
            .map(t => traitPickCard(t, false, `data-action="nether-pickprop" data-k="${t.id}"`)).join("");
        } else {   // spell: raw spells (no property modifiers) — shared spell picker
          const haveS = new Set(s.props.filter(p => p.cat === "spell").map(p => p.key));
          rowsHtml = spellPickRows(st, spellPickList(st, haveS), sp => spellRow(sp, { attrs: `data-action="nether-pickprop" data-k="${sp.id}"` }));
        }
        const back = `<button class="chip" data-action="nether-addprop">‹ Category</button>`;
        picker = `<div class="art-picker" data-action="noop">
          ${st.picking === "spell" ? spellFilterBar(st, "nether-search", back)
            : `<div class="ovl-filterbar">${back}<input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="nether-search"></div>`}
          <div class="art-pick-scroll">${rowsHtml}</div></div>`;
      }
    // ── 3) ICON — the game's 16 pre-coloured nether-stone icons ──
    const shapeChoices = GEM_ICONS.map(g =>
      `<button class="gem-choice ${s.icon === g.key ? "on" : ""}" data-action="nether-icon" data-k="${g.key}">${spriteImg(g.path, "px")}</button>`).join("");
    const body = `<div class="ovl-center" data-action="lib-deselect"><div class="ovl-center-scroll">
      <div class="build-section"><h3>Traits &amp; properties</h3>${slotsBox}${picker}</div>
      <div class="build-section"><h3>Name</h3><input class="ovl-search name-field" style="max-width:none;width:100%" placeholder="Name" value="${esc(s.name)}" data-action="nether-name"></div>
      <div class="build-section"><h3>Icon</h3><div class="gem-picker">${shapeChoices}</div></div>
    </div></div>`;
    const issues = netherIssues(s);
    const footer = `<button class="btn-ghost" data-action="nether-cancel">Cancel</button>
      <button class="btn-confirm" data-action="nether-save" ${issues.length ? `disabled title="${esc("Not possible in game: " + issues.join("; "))}"` : ""}>Save Stone</button>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${gemImg(s, "px")}</span>
        <h2>${esc(s.name)}</h2>
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info">${issues.length ? `<span class="ns-issue">⚠ ${esc(issues.join(" · "))}</span>` : ""}</span><div>${footer}</div></div>
    </div></div>`;
  }

  // ── spell gems: library + stepped wizard (1 spell + up to 3 property items) ──
  function openSpellGems() {   // library (manage mode when equipCtx is null)
    ovState = { kind: "spellgemlib", equipCtx: null, hideEquipped: false, sel: null, search: "", libCls: null, libSort: "cls", render: renderSpellGemLib };
    openOverlay(ovState.render());
  }
  function renderSpellGemLib() {
    const st = ovState, ctx = st.equipCtx;   // {kind:'artifact'|'creature'} when equipping
    const equipped = ctx ? new Set(ctx.equipped()) : null;
    const q = (st.search || "").trim().toLowerCase(), sortK = st.libSort || "cls", d = sortSign(st.libSortRev);
    const gemText = (g) => { const sp = gemSpell(g); return [gemName(g), sp ? sp.name : "", sp ? sp.desc || "" : "",
      ...(g.propIds || []).map(pid => (SPELLPROP.get(pid) || {}).name || "")].join(" ").toLowerCase(); };
    let list = spellGems.filter(g => (!st.libCls || gemClass(g) === st.libCls) && (!q || gemText(g).includes(q)) && TagFilter.match(st, "spell", gemSpell(g)));
    if (st.hideEquipped) list = list.filter(g => !spellGemEquippedInBuild(g.id) || (equipped && equipped.has(g.id)));
    const potOf = (g) => { const sp = gemSpell(g); return sp ? potencyRank(sp) : POTENCY_ORDER.length; };
    // game class order: the gem's current class (Opal swap counts), or with libSortBase the spell's own class
    const clsRank = (g) => { const i = SPELL_CLASSES.indexOf(st.libSortBase ? (gemSpell(g) || {}).cls : gemClass(g)); return i < 0 ? SPELL_CLASSES.length : i; };
    list = list.slice().sort(sortK === "name" ? (x, y) => d * gemName(x).localeCompare(gemName(y))
      : sortK === "level" ? (x, y) => d * (gemTier(y) - gemTier(x)) || gemName(x).localeCompare(gemName(y))
      : sortK === "cls" ? (x, y) => d * (clsRank(x) - clsRank(y)) || gemName(x).localeCompare(gemName(y))
      : sortK === "potency" ? (x, y) => { const rx = potOf(x), ry = potOf(y), none = POTENCY_ORDER.length;
          if ((rx === none) !== (ry === none)) return rx === none ? 1 : -1;   // no potency stays last either way
          return d * (rx - ry) || gemName(x).localeCompare(gemName(y)); }
      : (x, y) => d * (y.id - x.id));
    const libBar = `<div class="ovl-filterbar lib-bar">
        <select class="app-select${st.libCls ? " on" : ""}" data-action="lib-cls" title="Filter by class">
          <option value="" ${!st.libCls ? "selected" : ""}>Class</option>${SPELL_CLASSES.map(cl => `<option value="${cl}" ${st.libCls === cl ? "selected" : ""}>${cl}</option>`).join("")}</select>
        <span class="sg-sort-gap"></span>
        ${libSortSeg(st, [["recent", "Recent", true], ["name", "A–Z", false], ["cls", st.libSortBase ? "Base class" : "Class", false, true], ["level", "Level", true], ["potency", "Potency", true]])}</div>
      <div class="ovl-filterbar taxo-bar">${TagFilter.bar(st, "spell")}</div>`;
    const sel = st.sel != null ? spellGems.find(g => g.id === st.sel) : null;
    // when equipping onto a creature, gems of a class the creature can't use are blocked (unless a
    // trait/perk permits cross-class or an Opal has re-classed the gem) — matches the in-game rule.
    const creatureSlot = ctx && ctx.kind === "creature" ? build.slots[ctx.slotIdx] : null;
    const creatureCls = creatureSlot ? (baseStats(creatureSlot) || {}).cls : null;
    const allowedCls = creatureSlot ? spellEquipClasses(creatureSlot) : null;   // null = any class permitted
    const gemAllowed = (g) => !creatureSlot || allowedCls === null || allowedCls.has(gemClass(g));
    // tile equip-state highlight: purple = equipped on THIS creature, gold = equipped on another
    // (in manage/Menu mode every equipped gem is "another")
    const tiles = list.map(g => {
      const eqHere = !!ctx && equipped.has(g.id);
      const eqOther = !eqHere && spellGemEquippedInBuild(g.id);
      const wrongClass = creatureSlot && !eqHere && !gemAllowed(g);
      const blockOther = !!ctx && eqOther;        // equip wizard: on another creature → not equippable
      const blocked = wrongClass || blockOther;
      const eqOtherMarker = !ctx && eqOther;      // manage library marker only
      const gcls = gemClass(g);
      const title = wrongClass ? `${gcls || "This"} spell — can't equip on a ${creatureCls || "different"}-class creature`
        : blockOther ? "Equipped on another creature — not available"
        : eqHere ? "Equipped on this creature" : eqOtherMarker ? "Equipped on another creature" : "";
      return `
      <div class="pick-tile ${st.sel === g.id ? "selected" : ""}${eqHere ? " eq-here" : ""}${blocked ? " disabled" : ""}${eqOtherMarker ? " eq-other" : ""}" data-action="sg-sel" data-id="${g.id}"${title ? ` title="${esc(title)}"` : ""}>
        ${gemSwapClass(g) ? `<span class="pt-cls sg-opal" style="--pt-cls:${clsColor((gemSpell(g) || {}).cls)}" title="Opal: ${esc((gemSpell(g) || {}).cls || "")} spell, now ${esc(gcls)}"></span>` : ""}
        <div class="pt-sprite">${spriteImg(gemIcon(g), "px")}</div>
        <div class="pt-name">${esc(gemName(g))}</div></div>`; }).join("")
      || `<div class="slot-sub" style="padding:10px">No spell gems${spellGems.length ? " match" : " yet — build one"}.</div>`;
    let info = "";
    if (sel) {
      const sp = gemSpell(sel);
      const propRows = (sel.propIds || []).map(pid => { const p = SPELLPROP.get(pid);
        return libRow(p && p.icon, p ? p.name : pid, p ? propShort(p, gemTier(sel)) : "", noFxChip(propNoEffect(sp, p, gemTier(sel)))); }).join("");
      const spellBlock = sp
        ? `<div class="section-label" style="margin-top:6px">Spell</div>
           ${spellRow(sp, { clamp: false, meta: false })}
           ${spellStatsHtml(sp, sel)}`
        : `<div class="slot-sub" style="padding:6px">No spell chosen.</div>`;
      const gcls = gemClass(sel);
      const clsNote = creatureSlot && !equipped.has(sel.id) && !gemAllowed(sel)
        ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">${esc(gcls || "This")}-class spell — a ${esc(creatureCls || "different")}-class creature can't equip it (an Opal or the right trait is needed).</div>`
        : (ctx && !equipped.has(sel.id) && spellGemEquippedInBuild(sel.id)
          ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">Equipped on another creature — unequip it there first to use it here.</div>` : "");
      info = `<div class="ns-info-head"><span class="ns-info-icon">${spriteImg(gemIcon(sel), "px")}</span><h3>${esc(gemName(sel))}</h3><span class="rank-badge">Lv ${gemTier(sel)}</span></div>
        ${clsNote}${spellBlock}
        ${propRows ? `<div class="section-label">Enchants</div><div class="prop-list">${propRows}</div>` : ""}`;
    }
    // footer selector bar (mirrors Artifacts/Builds): Edit/Delete act on the selection; the confirm
    // switches between Equip (equip context + selection) and ＋ Build new (manage mode / no selection).
    const on = ctx && sel ? equipped.has(sel.id) : false;
    const selWrongClass = creatureSlot && sel && !on && !gemAllowed(sel);       // wrong-class, no permission
    const selOnOther = !!ctx && sel && !on && spellGemEquippedInBuild(sel.id);  // already on another creature
    const selBlocked = selWrongClass || selOnOther;
    const canEquip = !!ctx && !!sel && !selBlocked;
    // only render the info panel when there's something selected (no empty placeholder panel)
    const infoPanel = sel ? `<div class="ovl-right lib-info">${info}</div>` : "";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header${creatureSlot ? " spells-hdr" : ""}">${creatureSlot ? spellsHeaderHtml(ctx.slotIdx) : `<h2>Spell Gems${ctx ? " — equip" : ""}</h2>`}
        <input class="ovl-search" placeholder="Search gem, spell or enchant…" value="${esc(st.search || "")}" data-action="lib-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect">${libBar}<div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
        ${infoPanel}
      </div>
      <div class="overlay-footer"><button class="facet ${st.hideEquipped ? "on" : ""}" data-action="sg-hide-equipped">Hide equipped</button>
        <div>
          <button class="btn-ghost" data-action="sg-edit" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Edit</button>
          <button class="btn-ghost danger" data-action="sg-del" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Delete</button>
          ${ctx && selBlocked
            ? `<button class="btn-confirm" style="min-width:96px" disabled title="${selOnOther ? "Equipped on another creature" : "Wrong class for this creature"}">Can't equip</button>`
            : `<button class="btn-confirm" style="min-width:96px" data-action="${canEquip ? "sg-equip" : "sg-new"}" ${canEquip ? `data-id="${sel.id}"` : ""}>${canEquip ? (on ? "Unequip" : "Equip") : "＋ Build new"}</button>`}
        </div></div>
    </div></div>`;
  }
  // retSlot = the creature whose equip list opened the builder (null = the plain library); Save / Cancel go back there
  function openSpellGemBuilder(id, retSlot = null) {
    const draft = id != null ? JSON.parse(JSON.stringify(spellGems.find(g => g.id === id)))
      : { id: null, name: "", spellId: null, tier: GT.max, propIds: [] };
    ovState = { kind: "sgbuild", editId: id, retSlot, draft, step: id != null ? "props" : "spell", search: "", render: renderSpellGemBuilder };
    openOverlay(ovState.render());
  }
  // back from the builder to the list it came from, optionally with a gem selected (a creature's list keeps its
  // equip context, so a freshly built gem shows Equip straight away)
  function backToGemList(retSlot, selId) {
    if (retSlot != null && build.slots[retSlot] && build.slots[retSlot].cid != null) openCreatureSpells(retSlot); else openSpellGems();
    if (selId != null) { ovState.sel = selId; refreshOverlay(); }
  }
  const gemListRetSlot = () => (ovState && ovState.equipCtx && ovState.equipCtx.kind === "creature" ? ovState.equipCtx.slotIdx : null);
  function renderSpellGemBuilder() {
    const st = ovState, g = st.draft, q = st.search.trim().toLowerCase();
    let body = "", footer = "";
    if (st.step === "spell") {
      const rows = spellPickRows(st, spellPickList(st), s => spellRow(s, { chosen: g.spellId === s.id, attrs: `data-action="sg-spell" data-id="${s.id}"` }));
      // right info panel — preview the highlighted spell's full effect + stats before committing to it
      // (only shown once a spell is chosen; no empty placeholder panel)
      const chosen = g.spellId != null ? SPELL.get(g.spellId) : null;
      const info = chosen
        ? `<div class="ns-info-head">${spellIco(chosen, "ns-info-icon")}<h3>${esc(chosen.name)}</h3></div>
           ${chosen.desc ? `<div class="prop-sub" style="margin-bottom:4px">${perkText(chosen.desc)}</div>` : ""}
           ${spellStatsHtml(chosen)}`
        : "";
      body = `<div class="ovl-center" data-action="lib-deselect">
        ${spellFilterBar(st, "sg-search")}
        <div class="ovl-center-scroll">${rows}</div></div>
        ${chosen ? `<div class="ovl-right lib-info">${info}</div>` : ""}`;
      footer = `<button class="btn-ghost" data-action="sg-cancel">Cancel</button>
        <button class="btn-confirm" data-action="sgb-next" ${g.spellId != null ? "" : "disabled"}>Next: Properties ›</button>`;
    } else {
      const tier = gemTier(g), slots = gemSlots(g);
      const boxes = [];
      for (let i = 0; i < SPELLGEM_MAX_PROPS; i++) {
        const pid = g.propIds[i], over = i >= slots;   // a socketed property past this level's slot count
        if (pid !== undefined) { const p = SPELLPROP.get(pid);
          boxes.push(`<div class="art-slot${over ? " over" : ""}"${p && p.textNote ? ` title="${esc(p.textNote)}"` : ""}><button class="as-rm" data-action="sg-prop-rm" data-i="${i}">✕</button>
            <div class="as-ico">${p && p.icon ? spriteImg(p.icon, "px") : "◆"}</div><div class="as-lab">${esc(p ? p.name : pid)}</div>
            <div class="as-sub">${esc(propShort(p, tier))}</div>${noFxChip(propNoEffect(gemSpell(g), p, tier))}</div>`); }
        else if (over) boxes.push(`<div class="art-slot locked"><div class="as-ico glyph">🔒</div><div class="as-lab">Level ${slotUnlockLevel(i)}</div></div>`);
        else boxes.push(`<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="sg-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Property</div></div>`);
      }
      const overCount = Math.max(0, g.propIds.length - slots);
      let picker = "";
      if (st.picking) {
        // only properties this spell can take (code compatibility; includes Opal's own-class swap)
        const gsp = gemSpell(g);
        const pr = D.spellProps.filter(p => {
          if (!gemPropOk(gsp, p)) return false;
          return !q || p.name.toLowerCase().includes(q) || propText(p, tier).toLowerCase().includes(q);
        }).map(p =>
          `<div class="prop-row ${g.propIds.includes(p.id) ? "chosen" : ""}" data-action="sg-pickprop" data-id="${p.id}"${p.textNote ? ` title="${esc(p.textNote)}"` : ""}>
            <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}${noFxChip(propNoEffect(gsp, p, tier))}</span><span class="prop-stat">${esc(propText(p, tier))}</span></div>`).join("");
        picker = `<div class="sgb-picker" data-action="noop">
          <div class="ovl-filterbar"><button class="chip" data-action="sg-closepick">‹ Done</button>
            <input class="ovl-search" placeholder="Search gemstone enchantments…" value="${esc(st.search)}" data-action="sg-search"></div>
          <div class="sgb-pick-scroll">${pr}</div></div>`;
      }
      body = `<div class="ovl-center" data-action="lib-deselect">
        <div class="sgb-top${st.picking ? " picking" : ""}">
          ${gemSpell(g) ? `<div class="build-section sgb-spell"><h3>Spell</h3>${spellRow(gemSpell(g), { clamp: false, meta: false })}${spellStatsHtml(gemSpell(g), g)}</div>` : ""}
          <div class="build-section"><h3>Level</h3>
            <div class="rank-picker"><input type="range" min="${GT.min}" max="${GT.max}" value="${tier}" data-action="sg-tier"><span class="rank-badge">${tier}</span></div></div>
          <div class="art-slot-group"><div class="section-label">Property items</div><div class="art-slot-grid">${boxes.join("")}</div></div>
          ${overCount ? `<div class="slot-sub ns-issue" style="text-align:left;padding-top:6px">⚠ Level ${tier} has ${slots} property slot${slots === 1 ? "" : "s"} — remove ${overCount} or raise the level.</div>` : ""}
        </div>
        ${picker}</div>`;
      footer = `<button class="btn-ghost" data-action="sgb-back">‹ Back</button>
        <button class="btn-confirm" data-action="sg-save" ${overCount ? `disabled title="More properties than this level allows"` : ""}>Save Spell Gem</button>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${spriteImg(gemIcon(g), "px")}</span>
        <h2>${esc(gemName(g) || "New Spell Gem")}</h2>
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }

  // spells a slot gets from a perk / trait / relic (FX.grantedSpells): no spell-gem slot used
  const grantedSpellList = (slot) => FX.grantedSpells(slot).map(g => ({ ...g, sp: SPELL.get(g.spellId) })).filter(g => g.sp);
  function grantOwnerName(o) {
    if (o.kind === "perk") { const s = SPEC.get(o.spec), p = s && s.perks.find(x => x.key === o.key); return p ? p.name : ""; }
    if (o.kind === "trait") return (TRAIT[o.id] || {}).name || "";
    if (o.kind === "relic") return String((RELIC.get(o.id) || {}).name || "").split(",")[0];
    return "";
  }
  const capFirst = (x) => x ? x[0].toUpperCase() + x.slice(1) : "";
  const grantTrigger = (g) => g.mode === "replaceArtifactSpell" ? "Replaces artifact spell"
    : g.mode === "cast" ? `${g.chance}% · ${capFirst(g.when)}` : capFirst(String(g.when || "start of battle").split(",")[0]);
  const grantedTile = (g) => spellGemCard(g.sp, grantTrigger(g), grantOwnerName(g.owner), null, { tile: true });

  // the tile's Spells button: equipped gems / slots, then +N granted spells (they use no slot)
  function spellsBtn(slot, i) {
    const n = (slot.spellGemIds || []).length, gr = grantedSpellList(slot).length;
    return `<button class="slot-mini ${n || gr ? "on" : ""}" data-action="creature-spells" data-slot="${i}" title="Spell gems">Spells${n ? ` ${n}/${creatureSlotMax(slot)}` : ""}${gr ? ` +${gr}` : ""}</button>`;
  }
  // creature spell-slot header: one circle per equipped gem in its spell's base class colour, then an outlined
  // "empty" circle per open slot (total = the creature's slot count incl. perk/trait grants). Shared by the Spells
  // page and the equip list opened from a creature's Spells button.
  function spellSlotDots(slot) {
    const max = creatureSlotMax(slot), ids = slot.spellGemIds || [];
    const dots = ids.map(id => { const sp = gemSpell(spellGems.find(x => x.id === id)), cls = sp ? sp.cls : null;
      return `<span class="sdot" style="--dc:${clsColor(cls)}" title="${esc(sp ? `${sp.name} · ${cls || "—"}` : "Spell gem")}"></span>`; });
    for (let i = ids.length; i < max; i++) dots.push(`<span class="sdot empty" title="Empty spell slot"></span>`);
    return `<span class="spell-dots" title="${ids.length}/${max} spell slots">${dots.join("")}</span>`;
  }
  const spellsHeaderHtml = (slotIdx, lead = "") => {
    const slot = build.slots[slotIdx], c = CREA.get(slot.cid);
    return `${lead}<h2 class="spells-hdr-title">Spells — ${esc(c ? c.name : "")}</h2>${spellSlotDots(slot)}`;
  };
  // full-screen Spells page (detail overlay over the equip list): one tile per equipped gem — spell description,
  // spell stats and the gem's properties at its level. ‹ Spell Gems backs out to the list.
  function openSpellsPage(slotIdx) {
    dovState = { kind: "spellpage", slotIdx, render: renderSpellsPage };
    openDetail(dovState.render());
  }
  function renderSpellsPage() {
    const st = dovState, slot = build.slots[st.slotIdx];
    const gems = (slot.spellGemIds || []).map(id => spellGems.find(g => g.id === id)).filter(Boolean);
    const granted = grantedSpellList(slot);
    if (!gems.length && !granted.length) { closeDetail(); return ""; }
    const tiles = gems.map((g, gi) => {
      const sp = gemSpell(g), tier = gemTier(g);
      const props = (g.propIds || []).map(pid => { const p = SPELLPROP.get(pid); return p ? `<div class="prop-row static"${p.textNote ? ` title="${esc(p.textNote)}"` : ""}>
        <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}${noFxChip(propNoEffect(sp, p, tier))}</span><span class="prop-stat">${esc(propShort(p, tier))}</span></div>` : ""; }).join("");
      const swapped = gemSwapClass(g);
      // ‹ › reorder the equipped gems (the header's class-colour dots follow the same order)
      const mv = gems.length > 1 ? `<span class="spt-move"><button class="spt-mv" data-action="spellpage-move" data-i="${gi}" data-d="-1" ${gi ? "" : "disabled"} title="Move earlier">‹</button><button class="spt-mv" data-action="spellpage-move" data-i="${gi}" data-d="1" ${gi < gems.length - 1 ? "" : "disabled"} title="Move later">›</button></span>` : "";
      return `<div class="art-spellcard spell-page-tile apx-clickable" data-action="spellpage-sel" data-id="${g.id}" title="Show in the Spell Gems list">
        <div class="art-spellcard-head">${mv}<span class="prop-ico">${spriteImg(gemIcon(g), "px")}</span>
          <b>${esc(gemName(g))}</b>${sp && gemName(g) !== sp.name ? `<span class="slot-sub">${esc(sp.name)}</span>` : ""}
          <span class="spt-tags">${sp ? clsTag(sp.cls, swapped ? ` → ${esc(swapped)}` : "") : ""}<span class="rank-badge">Lv ${tier}</span></span></div>
        ${sp && sp.desc ? `<div class="trait-desc">${perkText(sp.desc)}</div>` : ""}
        ${sp ? spellStatsHtml(sp, g) : ""}
        ${props ? `<div class="prop-list spt-props">${props}</div>` : ""}</div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header spells-hdr">${spellsHeaderHtml(st.slotIdx, `<button class="btn-ghost" data-action="spellpage-back">‹ Spell Gems</button>`)}<button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll"><div class="spell-page-list">${tiles}${granted.length ? `<div class="section-label">Granted</div>${granted.map(grantedTile).join("")}` : ""}</div></div></div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="spellpage-back">‹ Back</button>
        <button class="btn-confirm" data-action="spellpage-done">Done</button></div>
    </div></div>`;
  }

  // creature spell slots (up to 3 equipped spell gems) — equip from the library
  function openCreatureSpells(slotIdx) {
    ovState = { kind: "spellgemlib", hideEquipped: false, sel: null, search: "", libCls: null, libSort: "cls", equipCtx: {
      kind: "creature", slotIdx,
      equipped: () => build.slots[slotIdx].spellGemIds,
      max: creatureSlotMax(build.slots[slotIdx]),
    }, render: renderSpellGemLib };
    openOverlay(ovState.render());
  }

  // ── event delegation ───────────────────────────────────────────────────────
  function onClick(e) {
    const t = e.target.closest("[data-action]");
    const A = t ? t.dataset.action : null;
    // close the header Menu dropdown on any click except the toggle itself
    const menu = el("main-menu");
    if (menu && A !== "toggle-menu") menu.classList.add("hidden");
    if (!t) return;
    switch (A) {
      case "sub-toggle": { const row = t.closest(".perk-spell-row"), k = row.dataset.sk, on = !row.classList.contains("open");
        row.classList.toggle("open", on); t.setAttribute("aria-expanded", on); on ? subOpen.add(k) : subOpen.delete(k); break; }
      // home
      case "pick-creature": { const si = +t.dataset.slot; if (si >= creatureCap()) break; openCreaturePicker(si); break; }
      // with something equipped, open its page first; backing out lands on the list to pick another
      case "equip-artifact": { const si = +t.dataset.slot; openArtifactLibrary(si);
        const a = resolveArtifact(build.slots[si]); if (a) { ovState.sel = a.id; refreshOverlay(); openArtifactPage(a.id, si); } break; }
      case "build-relic": { const si = +t.dataset.slot; openRelicBuilder(si);
        const r = build.slots[si].relic; if (r && RELIC.get(r.id)) openRelicDetail(r.id); break; }
      case "artpage-back": closeDetail(); break;
      case "artpage-view": dovState.view = t.dataset.v; refreshDetail(); break;
      case "artpage-edit": { const { artId, slotIdx } = dovState; closeDetail(); openArtifactBuilder(artId, slotIdx);
        if (t.dataset.t) { ovState.pickType = t.dataset.t; refreshOverlay(true); } break; }   // empty-slot box → open that slot's picker
      case "artpage-unequip": build.slots[dovState.slotIdx].artifactId = null; persistBuild(); closeDetail(); render(); refreshOverlay(); break;
      case "relic-unequip": build.slots[dovState.slotIdx].relic = null; persistBuild(); closeDetail(); closeOverlay(); render(); break;
      case "creature-detail": openCreatureDetail(+t.dataset.slot); break;
      case "crea-info": e.stopPropagation(); openCreaturePreview(+t.dataset.cid); break;
      case "crea-edit": { const si = +t.dataset.slot; closeDetail(); openCreaturePicker(si); break; }
      case "macro-copy": {
        const txt = macroProposalText(+t.dataset.slot); if (!txt) break;
        const done = () => { t.textContent = "Copied ✓"; setTimeout(() => { if (t.isConnected) t.textContent = "Copy"; }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => {});
        else { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (_) {} ta.remove(); }
        break;
      }
      case "crea-nav": {
        const filled = build.slots.map((s, i) => i).filter(i => build.slots[i].cid != null);
        if (filled.length < 2 || !dovState) break;
        const cur = filled.indexOf(dovState.slotIdx), dir = +t.dataset.dir;
        dovState.slotIdx = filled[(cur + dir + filled.length) % filled.length];
        refreshDetail(); break;
      }
      case "pick-spec": openSpecPicker(); break;
      case "spec-detail": openSpecDetail(); break;
      case "specpage-back": closeDetail(); refreshOverlay(); syncSpecAnim(); break;   // → the selector grid underneath
      case "specpage-close": closeDetail(); closeOverlay(); render(); break;
      case "specpage-edit": dovState.editing = !dovState.editing; refreshDetail(); break;
      case "specpage-confirm": { const id = dovState.specId; closeDetail(); applySpec(id); break; }
      case "slot-move": { const i = +t.dataset.slot, j = i + +t.dataset.d;
        if (j < 0 || j >= build.slots.length) break;
        [build.slots[i], build.slots[j]] = [build.slots[j], build.slots[i]]; persistBuild(); render(); break; }
      case "remove-creature": armOrDo(t, () => { build.slots[+t.dataset.slot] = emptySlot(); persistBuild(); render(); }); break;
      case "clear-spec": e.stopPropagation(); build.specId = null; persistBuild(); render(); break;
      case "clear-anoints": e.stopPropagation(); build.anoints = []; persistBuild(); render(); break;
      case "clear-party": armOrDo(t, () => { build = freshBuild(); clearBookmarks(); persistBuild(); render(); }); break;
      case "home-view": { const v = t.dataset.view; if (v === homeView) break; homeView = v; persistHomeView(); syncLayoutMenu(); render(); break; }
      case "open-artifacts": openArtifactLibrary(null); break;
      case "toggle-menu": e.stopPropagation(); syncLayoutMenu(); el("main-menu").classList.toggle("hidden"); break;
      case "open-builds": openBuilds(); break;
      case "builds-save-new": ovState.draft = { name: `Build ${builds.length + 1}`, icon: buildDefaultIcon() }; refreshOverlay(); break;
      case "builds-cancel": ovState.draft = null; refreshOverlay(); break;
      case "builds-pick-icon": openIconPicker((w) => { ovState.draft.icon = w.img; }); break;
      case "builds-sel": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "builds-sort": sortPick(ovState, "sort", "sortRev", t.dataset.sort); refreshOverlay(); break;
      case "builds-save": {
        const d = ovState.draft;
        const nb = { id: nextBuildId++, name: (d.name || "").trim() || `Build ${builds.length + 1}`, icon: d.icon, ts: Date.now(), build: JSON.parse(JSON.stringify(build)) };
        builds.push(nb); persistBuilds(); ovState.draft = null; ovState.sel = nb.id; flashBuild(nb.id); break;
      }
      case "open-bio": openBuildIO("import"); break;
      case "bio-mode": { const st = ovState; if (!st || st.kind !== "bio" || st.mode === t.dataset.v) break;
        st.mode = t.dataset.v; st.warnings = null; st.error = null; st.status = "";
        if (st.mode === "export") runExport(); else { refreshOverlay(); maybeFocusSearch(OV); } break; }
      case "bio-copy": { const st = ovState; if (!st || !st.out) break;
        const w = t.dataset.what, code = (st.out.match(/SUC1:\S+/) || [""])[0];
        const txt = w === "code" ? code : w === "link" ? shareLink(code) : st.out;
        copyText(txt).then(ok => { st.status = ok ? (w === "code" ? "Code copied ✓" : w === "link" ? "Link copied ✓" : "Copied ✓") : "Copy failed — select the text and copy it manually"; refreshOverlay(); }); break; }
      case "bio-run": { const st = ovState; if (!st || !st.text.trim()) break;
        bio().importText(st.text).then(r => { const warn = [...r.warnings]; const res = applyImportedBuild(r.payload, warn);
          st.warnings = warn; st.loaded = res.creatures; st.source = r.source; st.error = null; refreshOverlay(); })
          .catch(e => { st.error = String(e.message || e); refreshOverlay(); }); break; }
      case "bio-done": closeOverlay(); break;
      case "share-load": { const st = ovState; if (!st || st.kind !== "share") break;
        applyImportedBuild(st.payload, st.warnings); st.done = "load"; refreshOverlay(); break; }
      case "share-save": { const st = ovState; if (!st || st.kind !== "share") break;
        // import into a temporary party, snapshot it into Builds, then put the visitor's party back
        const prev = JSON.parse(JSON.stringify(build));
        applyImportedBuild(st.payload, st.warnings);
        const nb = { id: nextBuildId++, name: (st.name || "").trim() || `Build ${builds.length + 1}`, icon: buildDefaultIcon(), ts: Date.now(), build: JSON.parse(JSON.stringify(build)) };
        builds.push(nb); persistBuilds();
        build = normalizeBuild(prev); persistBuild(); render();
        st.name = nb.name; st.done = "save"; refreshOverlay(); break; }
      case "builds-load": {
        const b = builds.find(x => x.id === +t.dataset.id);
        if (b) { build = normalizeBuild(JSON.parse(JSON.stringify(b.build))); clearBookmarks(); persistBuild(); closeOverlay(); render(); }
        break;
      }
      case "builds-overwrite": { const b = builds.find(x => x.id === +t.dataset.id); if (!b || !build.slots.some(s => s && s.cid != null)) break;
        const doUpdate = () => { b.build = JSON.parse(JSON.stringify(build)); b.ts = Date.now(); persistBuilds(); ovState.sel = b.id; flashBuild(b.id); };
        // guard: updating a saved build whose specialization differs from the current one needs a second press
        if ((b.build && b.build.specId != null ? b.build.specId : null) !== (build.specId != null ? build.specId : null)) {
          if (!t.classList.contains("armed")) { const label = t.textContent; t.textContent = "Confirm Update";
            t.title = "This saved build uses a different specialization — press again to overwrite it";
            setTimeout(() => { if (t.isConnected) { t.textContent = label; t.title = ""; } }, 2500); }
          armOrDo(t, doUpdate);
        } else doUpdate();
        break; }
      case "builds-del": armOrDo(t, () => { const id = +t.dataset.id; builds = builds.filter(b => b.id !== id); if (ovState.sel === id) ovState.sel = null; persistBuilds(); refreshOverlay(); }); break;
      case "iconpick-cat": dovState.cat = t.dataset.c; dovState.limit = ICON_PAGE; refreshDetail(); break;
      case "iconpick-cat-clear": e.stopPropagation(); dovState.cat = null; dovState.limit = ICON_PAGE; refreshDetail(); break;
      case "iconpick-more": dovState.limit = (dovState.limit || ICON_PAGE) + ICON_PAGE; refreshDetail(); break;
      case "iconpick-sel": { const k = t.dataset.k;   // tap selects (+animates); tapping the selected tile again deselects
        dovState.sel = dovState.sel === k ? null : k; refreshDetail(); break; }
      case "iconpick-use": { const w = (D.wardrobe || []).find(x => x.sprite === dovState.sel); if (w && dovState.onPick) { dovState.onPick(w); closeDetail(); refreshOverlay(); } break; }
      case "open-appendix": openAppendix(); break;
      case "open-realms": openRealms(); break;
      case "open-riddle": openRiddle(); break;
      case "riddle-search": break;   // handled in onInput
      case "open-errata": openErrata(); break;
      case "open-effect-order": openErrata("order"); break;
      case "errata-search": break;   // handled in onInput
      case "open-bosses": openBosses(); break;
      case "bosses-search": break;   // handled in onInput
      case "boss-open": openBossDetail(t.dataset.k); break;
      case "boss-tab": if (!t.disabled) { ovState.tab = t.dataset.v; refreshOverlay(); } break;
      case "nb-tier": dovState.tier = +t.dataset.v; refreshDetail(); break;
      case "boss-sec": { const k = t.dataset.k; dovState.open.has(k) ? dovState.open.delete(k) : dovState.open.add(k); refreshDetail(); break; }
      case "boss-jump": { const el = DOV.querySelector(`#boss-unit-${t.dataset.slot}`); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); break; }
      case "open-projects": if (FEATURES.projects) openProjects(); break;
      case "open-netherhelp": openNetherHelper(); break;
      case "nh-tab": ovState.tab = t.dataset.v; refreshOverlay(true); break;
      case "nh-valve": { const i = +t.dataset.i; ovState.valves[i] ^= 1; refreshOverlay(); break; }
      case "nh-code": ovState.valves = codeValves(t.dataset.c); refreshOverlay(); break;
      case "proj-search": break;     // handled in onInput
      case "proj-diff": ovState.ruthless = t.dataset.v === "ruthless"; refreshOverlay(true); break;
      case "realm-diff": ovState.yieldDiff = t.dataset.v; refreshOverlay(); break;
      case "proj-group-toggle": { const g = t.dataset.g; ovState.collapsed.has(g) ? ovState.collapsed.delete(g) : ovState.collapsed.add(g); refreshOverlay(); break; }
      case "sob-members": ovState.sobMembers = !ovState.sobMembers; refreshOverlay(); break;
      case "sob-step": { const k = t.dataset.k; ovState.sobOpen = ovState.sobOpen || new Set(); ovState.sobOpen.has(k) ? ovState.sobOpen.delete(k) : ovState.sobOpen.add(k); refreshOverlay(); break; }
      case "nd-diff": ovState.ndDiff = t.dataset.v; refreshOverlay(); break;
      case "gloss-cat-toggle": { const c = t.dataset.c; ovState.collapsed.has(c) ? ovState.collapsed.delete(c) : ovState.collapsed.add(c); refreshOverlay(); break; }
      case "realm-sel": ovState.sel = +t.dataset.id; ovState.view = "detail"; ovState.detailIco = ovState.sortBy === "god" ? "god" : "realm"; refreshOverlay(true); break;
      case "realm-swapico": ovState.detailIco = (ovState.detailIco === "god" ? "realm" : "god"); refreshOverlay(); break;
      case "realm-back": ovState.view = "list"; refreshOverlay(true); maybeFocusSearch(OV); break;
      case "realm-sort": sortPick(ovState, "sortBy", "sortRev", t.dataset.v); refreshOverlay(); break;
      case "realm-mode": ovState.mode = t.dataset.v; ovState.search = ""; refreshOverlay(true); maybeFocusSearch(OV); break;
      case "realm-favview": ovState.favorView = t.dataset.v; refreshOverlay(); break;
      case "realm-usecustom": ovState.useCustom = t.dataset.v === "1"; favorPrefs.use = ovState.useCustom; persistFavorPrefs(); refreshOverlay(); break;
      case "realm-editranks": ovState.editingRanks = true; ovState.search = ""; refreshOverlay(); maybeFocusSearch(OV); break;
      case "realm-editdone": ovState.editingRanks = false; ovState.search = ""; refreshOverlay(); break;
      case "realm-clearranks": favorPrefs.ranks = {}; persistFavorPrefs(); refreshOverlay(); break;
      case "realm-cat": { const k = t.dataset.k; ovState.cmpExpanded.has(k) ? ovState.cmpExpanded.delete(k) : ovState.cmpExpanded.add(k); refreshOverlay(); break; }
      case "realm-search": break;   // handled in onInput
      case "realm-shop": { const g = (shopTab("god").groups || []).find(x => normNm(x.name) === normNm(t.dataset.g)); openShops("god", g ? g.key : null); break; }
      case "open-shops": openShops(); break;
      case "shop-tab": ovState.tab = t.dataset.v; ovState.sel = null; ovState.search = ""; refreshOverlay(true); maybeFocusSearch(OV); break;
      case "shop-pick": ovState.sel = t.dataset.k; ovState.search = ""; refreshOverlay(true); break;
      case "shop-back": ovState.sel = null; ovState.search = ""; refreshOverlay(true); maybeFocusSearch(OV); break;
      case "shop-sec": { const c = t.dataset.c; ovState.collapsed.has(c) ? ovState.collapsed.delete(c) : ovState.collapsed.add(c); refreshOverlay(); break; }
      case "shop-search": break;    // handled in onInput
      case "open-threats": openThreats(); break;
      case "open-macros": if (FEATURES.macros) openMacros(); break;
      case "macro-crea": ovState.sel = +t.dataset.slot; refreshOverlay(); break;
      case "threat-general": ovState.showGeneral = !ovState.showGeneral; refreshOverlay(); break;
      case "threat-src": ovState.srcView = t.dataset.v; refreshOverlay(); break;
      case "open-synergy": openSynergy(); break;
      case "synergy-view": if (ovState && ovState.view !== t.dataset.view) { ovState.view = t.dataset.view; refreshOverlay(true); } break;
      case "toggle-matrix-shared": ovState.sharedOnly = !ovState.sharedOnly; refreshOverlay(); break;
      case "matrix-expand-row": { const id = t.dataset.id; ovState.expanded.has(id) ? ovState.expanded.delete(id) : ovState.expanded.add(id); refreshOverlay(); break; }
      case "syn-toggle": { const k = t.dataset.key; ovState.listCollapsed.has(k) ? ovState.listCollapsed.delete(k) : ovState.listCollapsed.add(k); refreshOverlay(); break; }
      case "syn-collapse-all": { const keys = ovState.lastShared || []; const allCol = keys.length && keys.every(k => ovState.listCollapsed.has(k));
        if (allCol) ovState.listCollapsed.clear(); else for (const k of keys) ovState.listCollapsed.add(k); refreshOverlay(); break; }
      case "syn-jump": { const k = t.dataset.key; ovState.listCollapsed.delete(k); refreshOverlay();
        for (const g of OV.querySelectorAll(".syn-group")) if (g.dataset.key === k) { g.scrollIntoView({ block: "start" }); break; } break; }
      case "appendix-cat-toggle": { const c = t.dataset.c; ovState.expanded.has(c) ? ovState.expanded.delete(c) : ovState.expanded.add(c); refreshOverlay(); break; }
      case "appendix-bkscope": { const sc = t.dataset.scope; ovState.bkScope = ovState.bkScope === sc ? null : sc; ovState.browsing = false; ovState.search = ""; refreshOverlay(); break; }
      case "appendix-tag": {           // add a tag to the AND set, then show results
        TagFilter.add(ovState, "appendix", t.dataset.k);
        ovState.browsing = false; refreshOverlay(); break;
      }
      case "appendix-add": ovState.browsing = true; ovState.search = ""; refreshOverlay(); break;
      case "appendix-toggle-sec": { const s = t.dataset.sec; ovState.collapsed.has(s) ? ovState.collapsed.delete(s) : ovState.collapsed.add(s); refreshOverlay(); break; }
      case "apx-bookmark": { e.stopPropagation(); const k = t.dataset.kind;   // perks key by string, traits/spells by numeric id
        toggleBk(k, k === "perks" ? t.dataset.id : +t.dataset.id); refreshOverlay(); break; }
      case "appendix-clear-bk": {   // tap-again-to-confirm guard (destructive)
        if (t.dataset.armed) { clearBookmarks(); ovState.bkScope = null; refreshOverlay(); break; }
        t.dataset.armed = "1"; t.classList.add("armed"); const orig = t.textContent; t.textContent = "Tap again to clear";
        setTimeout(() => { if (t.isConnected) { t.classList.remove("armed"); delete t.dataset.armed; t.textContent = orig; } }, 2500);
        break; }
      case "appendix-done-adding": ovState.browsing = false; ovState.search = ""; refreshOverlay(); break;
      case "open-anoint": openAnoint(); break;
      case "anoint-detail": openAnointDetail(); break;
      case "anoint-edit": closeDetail(); openAnoint(); break;
      case "anoint-pick": {                                    // toggles the picker's draft; nothing changes until Equip
        const sid = +t.dataset.sid, k = t.dataset.k, d = ovState.draft;
        const i = d.findIndex(x => x.specId === sid && x.key === k);
        if (i >= 0) d.splice(i, 1);                            // removing is always allowed
        else if (sid !== build.specId && d.length < anointMax()) d.push({ specId: sid, key: k });
        refreshOverlay(); break;
      }
      case "anoint-commit": build.anoints = ovState.draft.map(x => ({ ...x })); persistBuild(); closeOverlay(); render(); break;
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
        else {
          // guard the Avatar cap even if a disabled tile is somehow clicked
          if (ovState.primaryId !== id && isAvatar(CREA.get(id)) && (avatarCap() - avatarCount(ovState.slotIdx)) < 1) break;
          ovState.primaryId = ovState.primaryId === id ? null : id;
        }
        refreshOverlay(); break;
      }
      case "crea-nofuse": ovState.fusionId = null; refreshOverlay(); break;
      case "crea-fusecolor": ovState.fuseColor = +t.dataset.m; refreshOverlay(); break;
      case "crea-next":
        if (ovState.primaryId == null) break;
        ovState.step = ovState.step === "primary" ? "fusion" : ovState.step === "fusion" ? "customize" : (ovState.fusionId != null ? "color" : "customize");
        ovState.search = ""; ovState.limit = CREA_PAGE; refreshOverlay(); break;
      case "crea-back":
        ovState.step = ovState.step === "color" ? "customize" : ovState.step === "customize" ? "fusion" : "primary";
        ovState.search = ""; ovState.limit = CREA_PAGE; refreshOverlay(); break;
      case "crea-more": ovState.limit = (ovState.limit || CREA_PAGE) + CREA_PAGE; refreshOverlay(); break;
      case "crea-view": ovState.view = t.dataset.v === "traits" ? "traits" : "grid"; refreshOverlay(true); break;
      case "crea-bkonly": ovState.bkOnly = !ovState.bkOnly; resetCreaPage(); refreshOverlay(); break;
      case "crea-sort": { const k = t.dataset.k || null; if (k) sortPick(ovState, "sort", "sortRev", k); else { ovState.sort = null; ovState.sortRev = false; } resetCreaPage(); refreshOverlay(); break; }
      case "crea-confirm": {
        if (ovState.primaryId == null) break;
        const s = build.slots[ovState.slotIdx];
        s.cid = ovState.primaryId; s.fusion = ovState.fusionId;
        s.fuseColor = ovState.fusionId != null ? ovState.fuseColor : null;
        s.personality = ovState.personality; s.scrolls = ovState.scrolls || {};
        // keep the skin only if it's still allowed on the (possibly changed) primary creature
        const prim = CREA.get(s.cid);
        s.skinId = (ovState.skinId != null && skinsForCreature(prim).some(sk => sk.id === ovState.skinId)) ? ovState.skinId : null;
        persistBuild(); closeOverlay(); render(); break;
      }
      case "crea-pers": openPersonalityPicker(); break;
      case "crea-pers-pick": ovState.personality = t.dataset.k; closeDetail(); refreshOverlay(); break;
      case "crea-pers-clear": ovState.personality = null; refreshOverlay(); break;
      case "crea-skin": openSkinPicker(CREA.get(ovState.primaryId), (id) => { ovState.skinId = id; refreshOverlay(); }); break;
      case "crea-skin-clear": ovState.skinId = null; refreshOverlay(); break;
      case "skin-pick": { const raw = t.dataset.id; const cb = dovState.onPick; closeDetail(); if (cb) cb(raw === "" ? null : +raw); break; }
      case "crea-scroll-inc": { const k = t.dataset.k; const sc = ovState.scrolls;
        if (scrollTotal(sc) < SCROLL_MAX) { sc[k] = (sc[k] || 0) + 1; refreshOverlay(); } break; }
      case "crea-scroll-dec": { const k = t.dataset.k; const sc = ovState.scrolls;
        if (sc[k] > 0) { sc[k]--; if (!sc[k]) delete sc[k]; refreshOverlay(); } break; }
      case "facet-class": openFacetPicker("class"); break;
      case "facet-race": openFacetPicker("race"); break;
      case "taxo-singles": {
        taxoShowSingles = !taxoShowSingles;
        try { localStorage.setItem("subc.taxoSingles", taxoShowSingles ? "1" : "0"); } catch {}
        if (dovState) refreshDetail(); if (ovState) refreshOverlay(); break;
      }
      case "anoint-bkonly": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      case "anoint-spec": openFacetPicker("anoint-spec"); break;
      case "anoint-spec-clear": e.stopPropagation(); ovState.specFilter = null; refreshOverlay(); break;
      case "anoint-fgod": openFacetPicker("anoint-fgod"); break;
      case "anoint-fgod-clear": e.stopPropagation(); ovState.godFilter = null; refreshOverlay(); break;
      case "anoint-god-toggle": { const k = t.dataset.k; const set = ovState.collapsedGods || (ovState.collapsedGods = []);
        const i = set.indexOf(k); if (i >= 0) set.splice(i, 1); else set.push(k); refreshOverlay(); break; }
      case "taxo-back": dovState.facet = "taxo-cat"; dovState.taxoCat = null; dovState.search = ""; refreshDetail(); break;
      case "facet-class-clear": e.stopPropagation(); ovState.clsFilter = null; resetCreaPage(); refreshOverlay(); break;
      case "facet-race-clear": e.stopPropagation(); ovState.raceFilter = null; resetCreaPage(); refreshOverlay(); break;
      // TagFilter (every tag-filterable list): ＋ Filter, ✕ on a chip, the refinement toggles
      case "tf-add": case "tf-rm": case "taxo-refine": {
        e.stopPropagation();
        const st = t.dataset.l === "d" ? dovState : ovState, src = t.dataset.src;
        if (!st || !TF_SRC[src]) break;
        if (A === "tf-add") { TagFilter.open(st, src); break; }
        if (A === "tf-rm") TagFilter.rm(st, src, t.dataset.k); else TagFilter.refine(st, src, t.dataset.k, t.dataset.a);
        if (st === dovState) refreshDetail(); else refreshOverlay();
        break;
      }
      case "facet-pick": {
        const v = t.dataset.v;
        if (dovState.facet === "class") { ovState.clsFilter = v; resetCreaPage(); closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "anoint-spec") { ovState.specFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "anoint-fgod") { ovState.godFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "race") { ovState.raceFilter = v; resetCreaPage(); closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "taxo-cat") { dovState.facet = "taxo-val"; dovState.taxoCat = v; dovState.search = ""; refreshDetail(); }
        else if (dovState.onPick) { dovState.onPick(v); closeDetail(); if (ovState) refreshOverlay(); }  // TagFilter.add, trait-item picker, …
        break;
      }

      // spec picker + perks
      case "spec-pick": if (isPhone()) { ovState.sel = +t.dataset.id; openSpecPage(ovState.sel); break; }   // phones: full spec page
        ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "spec-confirm": applySpec(ovState.sel); break;
      case "customize-perks": if (ovState.sel != null) openPerkPicker(ovState.sel); break;
      case "perk-inc": case "perk-dec": case "perk-max": case "perk-zero": {
        const sp = SPEC.get(dovState.specId), p = sp.perks.find(x => x.key === t.dataset.k); if (!p) break;
        const cur = perkRank(sp, p);
        const next = A === "perk-inc" ? cur + 1 : A === "perk-dec" ? cur - 1 : A === "perk-max" ? perkMax(p) : 0;
        setPerkRank(sp, p, next); enforceAnointCap(); persistBuild(); refreshDetail(); break;
      }
      case "perk-all": { build.perkAlloc[dovState.specId] = {}; enforceAnointCap(); persistBuild(); refreshDetail(); break; } // absence = max
      case "perk-none": { const sp = SPEC.get(dovState.specId); const m = {}; sp.perks.forEach(p => m[p.key] = 0); build.perkAlloc[dovState.specId] = m; enforceAnointCap(); persistBuild(); refreshDetail(); break; }

      // artifact library + builder
      case "artlib-sel": { const id = +t.dataset.id; ovState.sel = ovState.sel === id ? null : id; refreshOverlay(); break; }
      case "art-view": ovState.artView = t.dataset.v; refreshOverlay(); break;
      case "artlib-hide-equipped": e.stopPropagation(); ovState.hideEquipped = !ovState.hideEquipped; refreshOverlay(); break;
      case "art-equip": { const id = +t.dataset.id; if (artifactEquippedInBuild(id)) break;   // exclusive: already on another creature
        if (artNetherClash(artifacts.find(a => a.id === id), ovState.slotIdx)) break;          // exclusive: its stone is in use elsewhere
        build.slots[ovState.slotIdx].artifactId = id; persistBuild(); closeOverlay(); render(); break; }
      case "art-unequip": build.slots[ovState.slotIdx].artifactId = null; persistBuild(); render(); refreshOverlay(); break;   // stay → pick another
      case "art-unequip-any": { const id = +t.dataset.id; build.slots.forEach(s => { if (s.artifactId === id) s.artifactId = null; });
        persistBuild(); render(); refreshOverlay(); break; }
      case "art-new": openArtifactBuilder(null, ovState.slotIdx); break;
      case "art-edit": openArtifactBuilder(+t.dataset.id, ovState.slotIdx); break;
      case "art-del": armOrDo(t, () => { const id = +t.dataset.id; artifacts = artifacts.filter(a => a.id !== id); pruneAllBuildRefs(); if (ovState.sel === id) ovState.sel = null; persistArtifacts(); refreshOverlay(); }); break;
      case "artb-next": ovState.step = ovState.step === "type" ? "slots" : "name"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-back": ovState.step = ovState.step === "name" ? "slots" : "type"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-closecat": ovState.pickType = null; ovState.preview = null; ovState.search = ""; ovState.bkOnly = false; refreshOverlay(true); break;
      case "artb-bkonly": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      // shared spell picker bar (Spell Gem / Artifact / Nether Stone wizards)
      case "spf-sort": if (ovState.spellSort === undefined) ovState.spellSort = "name"; sortPick(ovState, "spellSort", "spellSortRev", t.dataset.v); refreshOverlay(); break;
      case "spf-bk": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      case "artb-nsfilter": ovState[t.dataset.f] = !ovState[t.dataset.f]; refreshOverlay(); break;
      case "artb-nssort": if (ovState.nsSort === undefined) ovState.nsSort = "recent"; sortPick(ovState, "nsSort", "nsSortRev", t.dataset.v); refreshOverlay(); break;
      case "art-primary": ovState.draft.primary = ovState.draft.primary === t.dataset.p ? null : t.dataset.p; refreshOverlay(); break;
      case "art-slot": ovState.pickType = ovState.pickType === t.dataset.t && !ovState.preview ? null : t.dataset.t;   // tap the open slot again → close
        ovState.preview = null; ovState.search = ""; ovState.bkOnly = false; refreshOverlay(true); break;
      // socketing is a two-step: preview the item's effect, then confirm (never applies silently)
      case "art-preview": {
        const type = t.dataset.t;
        ovState.preview = { type, value: (type === "stat" || type === "trick") ? t.dataset.v : +t.dataset.v };
        refreshOverlay(true); break;
      }
      case "art-preview-back": ovState.preview = null; refreshOverlay(true); break;
      case "art-confirm-add": {
        const type = t.dataset.t, sl = ART_SLOTS.find(s => s.pick === type), arr = ovState.draft[sl.key];
        const v = (type === "stat" || type === "trick") ? t.dataset.v : +t.dataset.v;
        // a stone in use on another creature can't join an artifact that is (or will be) in the loadout
        if (type === "nether" && arr[0] !== v) { const tgt = artTargetSlot(ovState.draft.id, ovState.slotIdx);
          if (tgt != null && netherUsers(v, ovState.draft.id, tgt).length) break; }
        const open = artOpen(sl, ovState.draft.rank);
        if (!open) break;                                                       // tier hasn't unlocked this group
        if (sl.max === 1) { arr[0] === v ? (arr.length = 0) : (arr[0] = v); }   // single slot toggles/replaces
        else if (type === "trick" && arr.includes(v)) break;                    // one copy per trick property
        else if (arr.length < open) arr.push(v);                                // stat slots: duplicates OK
        ovState.preview = null;
        if (arr.length >= open) ovState.pickType = null;     // group full → back to the grid
        refreshOverlay(); break;
      }
      case "art-rm": {
        const type = t.dataset.t, sl = ART_SLOTS.find(s => s.pick === type), arr = ovState.draft[sl.key];
        const i = +t.dataset.i;                              // remove THIS specific slot box
        if (i >= 0 && i < arr.length) arr.splice(i, 1);
        refreshOverlay(); break;
      }
      case "artb-cancel": backToArtLib(ovState, ovState.artId); break;
      case "artb-save": {
        const d = ovState.draft;
        if (!d.name || !d.name.trim()) d.name = `Artifact ${nextArtId}`;
        const isNew = d.id == null;
        if (isNew) { d.id = nextArtId++; artifacts.push(d); }
        else { const idx = artifacts.findIndex(a => a.id === d.id); if (idx >= 0) artifacts[idx] = d; }
        persistArtifacts();
        if (isNew && ovState.slotIdx != null) { build.slots[ovState.slotIdx].artifactId = d.id; persistBuild(); closeOverlay(); render(); break; }
        render(); backToArtLib(ovState, d.id); break;   // edits (and menu builds) go back to the library
      }

      // relic
      case "relic-pick": openRelicDetail(+t.dataset.id); break;
      case "relic-sort": ovState.relicSort = t.dataset.v; refreshOverlay(); break;
      case "relic-back": closeDetail(); break;
      case "relic-clear": build.slots[ovState.slotIdx].relic = null; persistBuild(); closeOverlay(); render(); break;
      case "relic-confirm": build.slots[dovState.slotIdx].relic = { id: dovState.sel, rank: dovState.rank }; persistBuild(); closeDetail(); closeOverlay(); render(); break;

      // cards
      case "cards-all-on": if (!cards.applyAll) { for (const c of D.cards) cards.levels[c.id] = c.effects.length; persistCards(); refreshOverlay(); } break;
      case "cards-all-off": if (!cards.applyAll) { for (const c of D.cards) cards.levels[c.id] = 0; persistCards(); refreshOverlay(); } break;
      case "cards-applyall": cards.applyAll = !cards.applyAll; persistCards(); refreshOverlay(); break;
      case "card-inc": { if (cards.applyAll) break; const id = +t.dataset.id, c = CARD.get(id); cards.levels[id] = Math.min(cardLevel(id) + 1, c.effects.length); persistCards(); refreshOverlay(); break; }
      case "card-dec": { if (cards.applyAll) break; const id = +t.dataset.id; cards.levels[id] = Math.max(cardLevel(id) - 1, 0); persistCards(); refreshOverlay(); break; }

      // nether library + wizard
      case "nether-new": openNetherBuilder(null); break;
      case "nether-sel": { const id = +t.dataset.id; ovState.sel = ovState.sel === id ? null : id; refreshOverlay(); break; }
      case "ns-view": ovState.nsView = t.dataset.v; refreshOverlay(); break;
      case "nether-hide-equipped": e.stopPropagation(); ovState.hideEquipped = !ovState.hideEquipped; refreshOverlay(); break;
      case "nether-edit": openNetherBuilder(+t.dataset.id); break;
      case "nether-del": armOrDo(t, () => { const id = +t.dataset.id; nether = nether.filter(n => n.id !== id); artifacts.forEach(a => a.netherIds = (a.netherIds || []).filter(x => x !== id)); if (ovState.sel === id) ovState.sel = null; persistNether(); persistArtifacts(); refreshOverlay(); }); break;
      case "nether-cancel": openNether(); break;
      case "nether-icon": ovState.draft.icon = t.dataset.k; refreshOverlay(); break;
      case "nether-addprop": ovState.picking = ovState.picking && t.classList.contains("art-slot") ? false : "menu";   // the ＋ tile toggles; ‹ Category goes back
        ovState.search = ""; refreshOverlay(); break;
      case "nether-pickcat": ovState.picking = t.dataset.c; ovState.search = ""; refreshOverlay(); break;
      case "nether-closepick": ovState.picking = false; refreshOverlay(); break;
      case "nether-pickprop": {
        const cat = ovState.picking;
        if (cat === "spell") ovState.draft.props.push({ cat, key: +t.dataset.k, trigger: NETHER_TRIGGERS[0] });
        else if (cat === "trait") ovState.draft.props.push({ cat, key: +t.dataset.k, value: null });
        else ovState.draft.props.push({ cat, key: t.dataset.k, value: ngMin(t.dataset.k) ?? 10 });
        ovState.picking = false; refreshOverlay(); break;
      }
      case "nether-prop-del": ovState.draft.props.splice(+t.dataset.i, 1); refreshOverlay(); break;
      case "nether-save": {
        const d = ovState.draft;
        if (netherIssues(d).length) break;
        if (!d.name || !d.name.trim()) d.name = `Nether Stone ${nextNetherId}`;
        if (ovState.editId != null) { const idx = nether.findIndex(n => n.id === ovState.editId); if (idx >= 0) nether[idx] = d; }
        else { d.id = nextNetherId++; nether.push(d); }
        persistNether(); openNether(); break;
      }

      // spell gems: library + wizard + equip
      case "open-spellgems": openSpellGems(); break;
      case "creature-spells": { const si = +t.dataset.slot; openCreatureSpells(si);
        if ((build.slots[si].spellGemIds || []).some(id => spellGems.some(g => g.id === id)) || grantedSpellList(build.slots[si]).length) openSpellsPage(si); break; }
      case "spellpage-back": closeDetail(); break;
      case "spellpage-done": closeDetail(); closeOverlay(); break;
      case "spellpage-move": { const ids = build.slots[dovState.slotIdx].spellGemIds, i = +t.dataset.i, j = i + +t.dataset.d;
        if (j < 0 || j >= ids.length) break;
        [ids[i], ids[j]] = [ids[j], ids[i]]; persistBuild(); refreshDetail(); refreshOverlay(); render(); break; }
      case "spellpage-sel": { const id = +t.dataset.id; closeDetail(); if (ovState) { ovState.sel = id; refreshOverlay(); } break; }
      case "sg-sel": { const id = +t.dataset.id; ovState.sel = ovState.sel === id ? null : id; refreshOverlay(); break; }
      case "sg-hide-equipped": e.stopPropagation(); ovState.hideEquipped = !ovState.hideEquipped; refreshOverlay(); break;
      case "sg-new": openSpellGemBuilder(null, gemListRetSlot()); break;
      case "sg-edit": openSpellGemBuilder(+t.dataset.id, gemListRetSlot()); break;
      case "sg-del": armOrDo(t, () => { const id = +t.dataset.id; spellGems = spellGems.filter(g => g.id !== id);
        artifacts.forEach(a => a.spells = (a.spells || []).filter(x => x !== id));
        pruneAllBuildRefs();
        if (ovState.sel === id) ovState.sel = null;
        persistSpellGems(); persistArtifacts(); refreshOverlay(); }); break;
      case "sg-cancel": backToGemList(ovState.retSlot, ovState.editId); break;
      case "sg-spell": { const d = ovState.draft; d.spellId = d.spellId === +t.dataset.id ? null : +t.dataset.id;
        const sp = gemSpell(d); if (sp) d.propIds = d.propIds.filter(pid => { const p = SPELLPROP.get(pid); return p && gemPropOk(sp, p); });   // drop what the new spell can't take
        refreshOverlay(); break; }
      case "sgb-next": ovState.step = "props"; ovState.picking = false; ovState.search = ""; refreshOverlay(true); break;
      case "sgb-back": ovState.step = "spell"; ovState.picking = false; ovState.search = ""; refreshOverlay(true); break;
      case "sg-addprop": if (ovState.picking) { ovState.picking = false; ovState.search = ""; refreshOverlay(); break; }   // tap again closes
        if (ovState.draft.propIds.length >= gemSlots(ovState.draft)) break; ovState.picking = true; ovState.search = ""; refreshOverlay(true); break;
      case "sg-closepick": ovState.picking = false; refreshOverlay(true); break;
      case "sg-pickprop": { const id = +t.dataset.id, arr = ovState.draft.propIds, picked = SPELLPROP.get(id);
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else {
          if (picked && !gemPropOk(gemSpell(ovState.draft), picked)) break;   // incompatible with this spell
          const grp = gemExclusiveGroup(id);   // one Class Swap / one potency-from-stat per gem — replace the existing one
          if (grp) for (let j = arr.length - 1; j >= 0; j--) if (grp.includes(arr[j])) arr.splice(j, 1);
          if (arr.length < gemSlots(ovState.draft)) arr.push(id);
        }
        if (arr.length >= gemSlots(ovState.draft)) ovState.picking = false; refreshOverlay(); break; }
      case "sg-prop-rm": ovState.draft.propIds.splice(+t.dataset.i, 1); refreshOverlay(); break;
      case "sg-save": {
        const d = ovState.draft;
        if (d.spellId == null) break;
        if (d.propIds.length > gemSlots(d)) break;   // more properties than the level allows
        delete d.name;
        if (ovState.editId != null) { const idx = spellGems.findIndex(g => g.id === ovState.editId); if (idx >= 0) spellGems[idx] = d; }
        else { d.id = nextSpellGemId++; spellGems.push(d); }
        persistSpellGems(); backToGemList(ovState.retSlot, d.id); break;
      }
      case "sg-equip": {
        const id = +t.dataset.id, ctx = ovState.equipCtx; if (!ctx) break;
        const arr = ctx.equipped(); const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);                          // unequip is always allowed
        else {                                                 // equip — enforce the creature's class rule
          const g = spellGems.find(x => x.id === id);
          if (ctx.kind === "creature" && g && !canEquipGemOn(build.slots[ctx.slotIdx], g)) break;
          if (spellGemEquippedInBuild(id)) break;   // exclusive: already on another creature
          if (arr.length < ctx.max) arr.push(id);
          else if (ctx.max === 1) arr[0] = id;
        }
        persistBuild(); persistArtifacts(); render(); refreshOverlay(); break;   // render(): home "Spells n/m" chip
      }
      case "lib-deselect": clearHeldSelection(); break;
      case "dlib-deselect": if (dovState && dovState.sel != null) { dovState.sel = null; refreshDetail(); } break;
      case "noop": break;
      // saved-library header bars (Artifacts / Nether Stones / Spell Gems)
      case "lib-sort": {
        // Spell Gems' Class (the default, ascending only) cycles current class → base class (ignoring an Opal swap) → off
        const s = ovState, v = t.dataset.v;
        if (s.kind === "spellgemlib" && v === "cls") {
          if (s.libSort !== "cls") { s.libSort = "cls"; s.libSortBase = false; }
          else if (!s.libSortBase) s.libSortBase = true;
          else { s.libSort = null; s.libSortBase = false; }
          s.libSortRev = false;
        } else { s.libSortBase = false; sortPick(s, "libSort", "libSortRev", v); }
        refreshOverlay(); break;
      }
      case "lib-flag": ovState[t.dataset.f] = !ovState[t.dataset.f]; refreshOverlay(); break;
      case "ns-spellcycle": ovState.nsSpell = nsSpellNext(ovState.nsSpell); refreshOverlay(); break;

      // entity taxonomy detail (trait / spell / perk / relic / card)
      case "nav-trait": openEntityDetail("trait", +t.dataset.tid); break;
      case "apx-open": openEntityDetail(t.dataset.ek, t.dataset.eid); break;
      case "apx-crea-open": e.stopPropagation(); openCreaturePreview(t.dataset.cid); break;
      case "apx-fg-open": e.stopPropagation(); openFalseGodDetail(t.dataset.fg); break;
      case "close-entity": closeEntityDetail(); break;
      case "entity-backdrop": if (e.target === t) closeEntityDetail(); break;
      case "etax-filter": {   // jump to the Appendix filtered by the tapped tag
        const k = t.dataset.k; closeDetail();
        openAppendix(); TagFilter.set(ovState, "appendix", [k]); ovState.browsing = false; refreshOverlay(); break;
      }
    }
  }

  // Click-away deselection: a tap on empty space inside a list area (an element with data-action="lib-deselect")
  // drops the held selection of whichever overlay is open. Pickers/menus inside those areas are marked
  // data-action="noop" so their blank space doesn't count as "away".
  function clearHeldSelection() {
    const st = ovState; if (!st) return;
    switch (st.kind) {
      case "artlib": case "spellgemlib": case "nether": case "builds": case "spec":
        if (st.sel == null) return; st.sel = null; break;
      case "creature":
        if (st.step === "fusion") { if (st.fusionId == null) return; st.fusionId = null; }
        else if (st.step === "primary") { if (st.primaryId == null) return; st.primaryId = null; }
        else return;
        break;
      case "sgbuild":
        if (st.step === "spell") { if (st.draft.spellId == null) return; st.draft.spellId = null; }
        else { if (!st.picking) return; st.picking = false; st.search = ""; }
        break;
      case "artbuild":
        if (st.step === "type") { if (!st.draft.primary) return; st.draft.primary = null; }
        else if (st.step === "slots") { if (!st.pickType && !st.preview) return; st.pickType = null; st.preview = null; st.search = ""; st.bkOnly = false; }
        else return;
        break;
      case "netherbuild": if (!st.picking) return; st.picking = false; st.search = ""; break;
      default: return;
    }
    refreshOverlay();
  }
  function armOrDo(t, fn) { if (t.classList.contains("armed")) { fn(); return; } t.classList.add("armed"); setTimeout(() => t.classList.remove("armed"), 2500); }
  function toggleArr(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }

  function onInput(e) {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action, v = t.value;
    // range sliders / selects
    if (A === "artb-rank") { ovState.draft.rank = +v; artTrim(ovState.draft); refreshKeeping(OV, ovState.render(), t, () => refreshOverlay()); return; }
    if (A === "sg-tier") { ovState.draft.tier = +v; if (ovState.draft.propIds.length >= gemSlots(ovState.draft)) ovState.picking = false;
      refreshKeeping(OV, ovState.render(), t, () => refreshOverlay()); return; }
    if (A === "relic-rank") { dovState.rank = +v; refreshKeeping(DOV, dovState.render(), t, () => refreshDetail()); return; }
    // favor rank slider: live in-place update while dragging (no re-render → smooth); 'change' re-sorts (below).
    // In "My ranks" mode the detail slider edits THIS realm's tracked rank (persisted); otherwise the global rank.
    if (A === "realm-rank") {
      if (ovState.view === "detail" && ovState.useCustom && ovState.sel != null) { favorPrefs.ranks[ovState.sel] = +v; persistFavorPrefs(); }
      else ovState.favorRank = +v;
      favorLiveUpdate(OV); return;
    }
    // Customize-Ranks entry (0-100). Store the clamped value; don't re-render (keep caret) — 'change' reflects clamp.
    if (A === "realm-setrank") {
      const id = +t.dataset.id;
      if (v.trim() === "") { delete favorPrefs.ranks[id]; persistFavorPrefs(); return; }
      let n = parseInt(v, 10); if (isNaN(n)) return;
      favorPrefs.ranks[id] = Math.max(0, Math.min(100, n)); persistFavorPrefs(); return;
    }
    if (A === "nether-propval") { ovState.draft.props[+t.dataset.i].value = Number(v) || 0; return; }
    if (A === "nether-trigger") { ovState.draft.props[+t.dataset.i].trigger = v; return; }
    // name fields (no re-render — keep focus/caret)
    if (A === "artb-name") { ovState.draft.name = v; return; }
    if (A === "nether-name") { ovState.draft.name = v; return; }
    if (A === "builds-name") { ovState.draft.name = v; return; }
    if (A === "bio-text") { ovState.text = v; ovState.error = null; return; }
    if (A === "share-name") { ovState.name = v; return; }
    // search fields — live filter without losing caret
    const searchMap = { "crea-search": [OV, ovState], "spec-search": [OV, ovState], "artb-search": [OV, ovState],
      "relic-search": [OV, ovState], "cards-search": [OV, ovState], "anoint-search": [OV, ovState], "nether-search": [OV, ovState], "sg-search": [OV, ovState], "appendix-search": [OV, ovState], "shop-search": [OV, ovState], "realm-search": [OV, ovState], "riddle-search": [OV, ovState], "errata-search": [OV, ovState], "bosses-search": [OV, ovState], "proj-search": [OV, ovState], "lib-search": [OV, ovState], "facet-search": [DOV, dovState], "perk-search": [DOV, dovState], "pers-search": [DOV, dovState], "iconpick-search": [DOV, dovState], "skin-search": [DOV, dovState] };
    if (searchMap[A]) {
      const [root, state] = searchMap[A]; state.search = v;
      if (A === "crea-search") resetCreaPage();   // new query → back to page 1
      if (A === "iconpick-search") state.limit = ICON_PAGE;
      const panel = root.querySelector(".overlay-panel");
      const saved = SCROLLERS.map(sel => { const e = panel && panel.querySelector(sel); return e ? [e.scrollTop, e.scrollLeft] : [0, 0]; });
      const restoreScroll = () => { const p2 = root.querySelector(".overlay-panel");
        SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) [e.scrollTop, e.scrollLeft] = saved[k]; }); };
      // full re-render (old path): replaces the input, so refocus + restore the caret
      const replaceAll = () => {
        const caret = t.selectionStart;
        const cur = root.querySelector(".overlay-panel"); if (!cur) return;
        cur.outerHTML = state.render();
        const inp = root.querySelector(".overlay-panel .ovl-search");
        if (inp) { inp.focus(); try { inp.setSelectionRange(caret, caret); } catch {} }
        restoreScroll();
      };
      // Patch everything EXCEPT the input being typed in. Phone keyboards type inside an IME composition;
      // replacing the focused <input> mid-composition made the keyboard re-insert the whole composing word on
      // every keystroke ("Aft" → "AAfAftAft"). If the layout changed too much to patch while a word is still
      // composing, hold the full re-render until the composition ends.
      refreshKeeping(root, state.render(), t, () => {
        if (e.isComposing) { pendingSearchRender = replaceAll; return; }
        replaceAll();
      });
      restoreScroll();   // patched scrollers were replaced → put their scroll position back
    }
  }
  let pendingSearchRender = null;
  document.addEventListener("compositionend", () => { const f = pendingSearchRender; pendingSearchRender = null; if (f) f(); });

  // Typing on a phone: the first tap anywhere outside the focused text field only leaves the field (closing the
  // on-screen keyboard) — it never also presses whatever was under the finger. Touch/pen only: a mouse has no
  // keyboard to dismiss, and desktop auto-focuses search fields, so swallowing clicks there would cost every click.
  const isTextEntry = (n) => !!n && (n.tagName === "TEXTAREA" || (n.tagName === "INPUT" && !/^(range|checkbox|radio|button|submit|color|file)$/i.test(n.type)));
  let swallowTap = null;   // the field that was focused when the tap began
  document.addEventListener("pointerdown", (e) => {
    swallowTap = null;
    if (e.pointerType === "mouse") return;
    const f = document.activeElement;
    if (!isTextEntry(f) || f.contains(e.target) || isTextEntry(e.target)) return;   // tapping into a field is fine
    swallowTap = f;
    // a drag/scroll fires no click — expire the flag shortly after release so it can never eat a later, unrelated tap
    const done = () => { document.removeEventListener("pointerup", done, true); setTimeout(() => { if (swallowTap === f) swallowTap = null; }, 400); };
    document.addEventListener("pointerup", done, true);
  }, true);
  document.addEventListener("click", (e) => {
    if (!swallowTap) return;
    const f = swallowTap; swallowTap = null;
    e.preventDefault(); e.stopPropagation();
    if (document.activeElement === f) f.blur();
  }, true);
  document.addEventListener("click", onClick);

  // right-click a creature tile to (re)open the creature / fusion selector
  document.addEventListener("contextmenu", (e) => {
    const slotEl = e.target.closest(".slot[data-slot]");
    if (!slotEl || !OV.classList.contains("hidden")) return;   // ignore when an overlay is open
    e.preventDefault();
    openCreaturePicker(+slotEl.dataset.slot);
  });
  document.addEventListener("input", onInput);
  // 'change' fires on slider release / checkbox toggle: re-render so the compare view re-sorts by the new rank
  document.addEventListener("change", (e) => {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action;
    if (A === "realm-rank") {
      if (ovState.view === "detail" && ovState.useCustom && ovState.sel != null) { favorPrefs.ranks[ovState.sel] = +t.value; persistFavorPrefs(); }
      else ovState.favorRank = +t.value;
      refreshOverlay();
    } else if (A === "realm-common") { ovState.showCommon = t.checked; refreshOverlay(); }
    else if (A === "realm-usecustom-cb") { ovState.useCustom = t.checked; favorPrefs.use = t.checked; persistFavorPrefs(); refreshOverlay(); }
    else if (A === "realm-setrank") {   // reflect the clamped value on blur, without disturbing the caret mid-type
      const id = +t.dataset.id, cur = favorPrefs.ranks[id];
      t.value = cur != null ? cur : "";
    }
    else if (A === "syn-nav") {          // Synergy list quick-nav dropdown → expand + scroll to that tag group
      const k = t.value; if (!k) return;
      ovState.listCollapsed.delete(k); refreshOverlay();
      for (const g of OV.querySelectorAll(".syn-group")) if (g.dataset.key === k) { g.scrollIntoView({ block: "start" }); break; }
    }
    else if (A === "threat-navsel") { ovState.themeSel = t.value || null; refreshOverlay(); }
    // shared spell picker dropdowns ("*" / "" = "-" = no filter)
    else if (A === "spf-target") { ovState.spellTarget = t.value === "*" ? null : t.value; refreshOverlay(); }
    else if (A === "spf-cls") { ovState.spellCls = t.value || null; refreshOverlay(); }
    else if (A === "lib-type") { ovState.libType = t.value || null; refreshOverlay(); }
    else if (A === "lib-cls") { ovState.libCls = t.value || null; refreshOverlay(); }
    else if (A === "nether-propval" && ovState && ovState.kind === "netherbuild") {   // commit: clamp to the code range, refresh score
      const p = ovState.draft.props[+t.dataset.i]; if (!p) return;
      const lo = ngMin(p.key), hi = ngMax(p.key);
      let v = Math.round(Number(t.value) || 0);
      if (lo != null && v < lo) v = lo; if (hi != null && v > hi) v = hi;
      p.value = v; refreshOverlay();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!DOV.classList.contains("hidden")) closeDetail(); else if (!OV.classList.contains("hidden")) closeOverlay(); }
  });

  // Feature-flag gate: strip disabled entries from the menu so they're unreachable.
  if (!FEATURES.macros) document.querySelector('[data-action="open-macros"]')?.remove();
  if (!FEATURES.projects) document.querySelector('[data-action="open-projects"]')?.remove();   // not ready yet — code + data kept

  syncLayoutMenu();
  render();
  checkSharedLink();
})();
