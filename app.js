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
  const FEATURES = { macros: false, nyi: false };
  if (!FEATURES.nyi) {
    for (const id of Object.keys(D.traits)) if (D.traits[id].nyi) delete D.traits[id];
    D.falseGods = (D.falseGods || []).filter(g => !g.nyi);
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
  const TRAIT = D.traits;                                   // id -> {name,desc,cls,produces,consumes,labels}
  const CLS_COLOR = Object.fromEntries(D.classes.map(c => [c.key, c.color]));
  const CLASS_BG = D.classBg || {};
  const GEM_ICONS = D.gemIcons || [];
  const NETHER_COLORS = D.netherColors || { mains: [], outlines: [] };   // picker presets derived from in-game screenshots
  // Nether-stone tint. In-game the base cornether_* shapes are colored procedurally at drop time
  // (backlog: reverse the generator). Until then the user picks a main + outline colour, applied here by
  // gradient-mapping the base sprite's luminance to the main colour and its darkest ring to the outline.
  const DEFAULT_GEM_MAIN = "#7a4fe0";      // main body hue
  const DEFAULT_GEM_OUTLINE = "#3ad0e0";   // contrasting outline hue (in-game outlines are coloured, not white)
  const _gemBase = new Map();          // base sprite path -> ImageData (preloaded once)
  const _gemOut = new Map();           // "path|main|outline" -> recolored data URL
  let _gemsReady = false;
  function preloadGems(done) {
    let left = GEM_ICONS.length;
    if (!left) { _gemsReady = true; return done && done(); }
    for (const g of GEM_ICONS) {
      const im = new Image();
      im.onload = () => { try { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const cx = c.getContext("2d"); cx.drawImage(im, 0, 0); _gemBase.set(g.path, cx.getImageData(0, 0, im.width, im.height)); } catch (_) {} if (--left === 0) { _gemsReady = true; done && done(); } };
      im.onerror = () => { if (--left === 0) { _gemsReady = true; done && done(); } };
      im.src = g.path;
    }
  }
  const _hex = (h) => { h = String(h || "").replace("#", ""); return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0]; };
  // The base gem has TWO palette ramps (like the game's 2-colour roll): a saturated BODY ramp and a
  // desaturated bright OUTLINE ramp (the white ring). Segment by saturation, then gradient-map each ramp
  // onto its rolled colour (colour = midtone; shadows darker; highlights blend to white) so both keep
  // their built-in gradient.
  const _lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const _sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const _rgb2hsv = (r, g, b) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn; let h = 0; if (dl) { if (mx === r) h = ((g - b) / dl + 6) % 6; else if (mx === g) h = (b - r) / dl + 2; else h = (r - g) / dl + 4; h /= 6; } return [h, mx ? dl / mx : 0, mx]; };
  const _hsv2rgb = (h, s, v) => { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), u = v * (1 - (1 - f) * s); let r, g, b; switch (i % 6) { case 0: r = v; g = u; b = p; break; case 1: r = q; g = v; b = p; break; case 2: r = p; g = v; b = u; break; case 3: r = p; g = q; b = v; break; case 4: r = u; g = p; b = v; break; default: r = v; g = p; b = q; } return [r * 255, g * 255, b * 255]; };
  // The 16 cornether base shapes share ONE fixed 13-colour palette = two ramps. This is the HAND-ASSIGNED
  // routing (user-mapped each base hex to Main or Outline): deterministic, per-pixel, no heuristics.
  // Outline includes 2D304A (the shadowed rim, 99% border in the base). Each pixel routes by nearest hex.
  const _GEM_OUTLINE_RAMP = [[255, 255, 255], [216, 217, 226], [175, 177, 194], [129, 132, 158], [99, 102, 129], [73, 76, 100], [45, 48, 74]];
  const _GEM_BODY_RAMP = [[145, 124, 171], [102, 82, 128], [58, 49, 81], [41, 38, 64], [19, 17, 35], [2, 0, 22]];
  const _nearest = (r, g, b, pal) => { let d = 1e9; for (const c of pal) { const e = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2; if (e < d) d = e; } return d; };
  const _isOutlinePx = (r, g, b) => _nearest(r, g, b, _GEM_OUTLINE_RAMP) <= _nearest(r, g, b, _GEM_BODY_RAMP);
  // Each ramp is regenerated from its rolled colour, ANCHORED to that colour's brightness so the gradient
  // honours the input: shadow = 0.45×value, highlight = only halfway to white (v + (1-v)·0.5). So black →
  // black-to-grey (not stark white), dark colours stay deep, bright colours stay vibrant but not blown out.
  // Saturation eases slightly toward the highlight (×(1-0.30t)).
  const _shade = (c, t) => {
    const hsv = _rgb2hsv(c[0], c[1], c[2]);
    const shadowV = hsv[2] * 0.45, highV = hsv[2] + (1 - hsv[2]) * 0.5;
    return _hsv2rgb(hsv[0], hsv[1] * (1 - 0.30 * t), shadowV + (highV - shadowV) * t);
  };
  function recolorGem(path, main, outline) {
    const key = path + "|" + main + "|" + outline;
    if (_gemOut.has(key)) return _gemOut.get(key);
    const src = _gemBase.get(path); if (!src) return null;
    const W = src.width, H = src.height, m = _hex(main), o = _hex(outline), d = new Uint8ClampedArray(src.data);
    // Deterministic: each pixel routes to Main or Outline purely by which hand-assigned ramp its base
    // colour is nearest to. No border/shape heuristics.
    let bMn = 255, bMx = 0, oMn = 255, oMx = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const l = _lum(d[i], d[i + 1], d[i + 2]);
      if (_isOutlinePx(d[i], d[i + 1], d[i + 2])) { if (l < oMn) oMn = l; if (l > oMx) oMx = l; }
      else { if (l < bMn) bMn = l; if (l > bMx) bMx = l; }
    }
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      const l = _lum(d[i], d[i + 1], d[i + 2]);
      const out = _isOutlinePx(d[i], d[i + 1], d[i + 2])
        ? _shade(o, (l - oMn) / Math.max(1, oMx - oMn))
        : _shade(m, (l - bMn) / Math.max(1, bMx - bMn));
      d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2];
    }
    try { const c = document.createElement("canvas"); c.width = src.width; c.height = src.height; c.getContext("2d").putImageData(new ImageData(d, src.width, src.height), 0, 0); const url = c.toDataURL(); _gemOut.set(key, url); return url; } catch (_) { return null; }
  }
  // src STRING for a stone: RAW cor_n base until a colour is picked, then recoloured. drop-in for gemPath()
  const gemSrc = (stone) => {
    const p = gemPath(stone && stone.icon); if (!p) return p;
    const tinted = stone && (stone.mainColor || stone.outlineColor);   // no colour yet → placeholder = raw base
    const url = (_gemsReady && tinted) ? recolorGem(p, stone.mainColor || DEFAULT_GEM_MAIN, stone.outlineColor || DEFAULT_GEM_OUTLINE) : null;
    return url || p;
  };
  const gemImg = (stone, cls) => spriteImg(gemSrc(stone), cls);
  preloadGems(() => { try { if (typeof ovState !== "undefined" && ovState && ovState.render) refreshOverlay(); } catch (_) {} });

  // ── Alternate skins — a creature can wear a cosmetic skin whose RESTRICTION permits it (code-grounded from
  // scr_DatabaseSkins: race-restricted skins fit any creature of that race; creature-restricted skins fit one
  // specific creature). Fusion recolour is intentionally NOT implemented — the in-game recolour is a runtime
  // palette-swap not reproducible from static data (see _su_extract/FUSION_MODEL.md); a fused slot shows the
  // primary's sprite (its equipped skin still applies).
  const SKINS = D.skins || [];                                   // {id,name,race,restriction,creature,img}
  const SKIN_BY_ID = new Map(SKINS.map(s => [s.id, s]));
  const skinsForCreature = (c) => !c ? [] : SKINS.filter(s =>
    s.restriction === "race" ? s.race === c.race : s.creature === c.name);
  // sprite for a creature honouring an equipped skin id (falls back to the base sprite)
  const critFaceSkinned = (c, skinId) => {
    const s = skinId != null ? SKIN_BY_ID.get(skinId) : null;
    return s && s.img ? spriteImg(s.img) : critFace(c);
  };

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
  const SPELL_NAMES_DESC = [...SPELL_BY_NAME.keys()].sort((a, b) => b.length - a.length);
  const SPELLGEM = D.spellGems || {};                       // class -> class-coloured gem icon
  const spellIcon = (s) => s && s.cls ? SPELLGEM[s.cls] : null;
  // spells a piece of rules text triggers: match each "Cast(s) <Spell Name>" against the spell DB.
  // Generic casts ("Casts a spell", "Casts a random spell") start lowercase → never match a Title-Case name.
  const spellsCastInText = (desc) => {
    const out = [], re = /\bCasts?\s+/g; let m;
    while ((m = re.exec(desc || ""))) {
      const rest = desc.slice(m.index + m[0].length);
      const name = SPELL_NAMES_DESC.find(n => rest.startsWith(n) && (rest.length === n.length || /[^A-Za-z]/.test(rest[n.length])));
      const sp = name && SPELL_BY_NAME.get(name);
      if (sp && !out.includes(sp)) out.push(sp);
    }
    return out;
  };
  const SPELLPROP = new Map((D.spellProps || []).map(p => [p.id, p]));   // spell-gem property items (Slates/Curios)
  const SPELLGEM_MAX_PROPS = 3;                             // each spell gem holds up to 3 property items
  const SPELL_CLASSES = ["Nature", "Chaos", "Sorcery", "Death", "Life"];
  // built spell-gem helpers (a gem = {id,name,spellId,propIds[]})
  const gemSpell = (g) => g ? SPELL.get(g.spellId) : null;
  // Opal "Class Swap: <Class>" reclasses the gem — the swapped class overrides the spell's own class,
  // driving both the equip check and the class-coloured icon. Returns null if no Class-Swap prop is set.
  const gemSwapClass = (g) => { for (const pid of (g && g.propIds || [])) { const p = SPELLPROP.get(pid); if (p && p.swapClass) return p.swapClass; } return null; };
  const gemClass = (g) => { const s = gemSpell(g); return gemSwapClass(g) || (s ? s.cls : null); };
  const gemIcon = (g) => { const cls = gemClass(g); return cls ? SPELLGEM[cls] : null; };
  const gemName = (g) => g ? (g.name || (gemSpell(g) ? gemSpell(g).name : "Spell Gem")) : "";
  const gemSummary = (g) => { const s = gemSpell(g); const np = (g.propIds || []).length;
    return (s ? s.name : "—") + (np ? ` · ${np} propert${np === 1 ? "y" : "ies"}` : ""); };
  // compact stat readout for a spell — whatever we have (charges = code-certain; potency/target/source
  // = community compendium). Returns "" if nothing to show.
  function spellStatsHtml(sp) {
    if (!sp) return "";
    const rows = [];
    if (sp.cls) rows.push(["Class", `<span style="color:${clsColor(sp.cls)};font-weight:700">${esc(sp.cls)}</span>`]);
    if (sp.charges != null) rows.push(["Charges", sp.charges]);
    if (sp.potency) rows.push(["Potency", esc(sp.potency)]);
    if (sp.target) rows.push(["Target", esc(sp.target)]);
    if (sp.source) rows.push(["Source", esc(sp.source)]);
    return rows.length ? `<div class="spell-stats">${rows.map(([k, v]) =>
      `<div class="ss-row"><span class="ss-k">${k}</span><span class="ss-v">${v}</span></div>`).join("")}</div>` : "";
  }
  // brief inline meta (charges · potency) for spell picker rows
  const spellMeta = (sp) => sp ? [sp.charges != null ? `${sp.charges} charge${sp.charges === 1 ? "" : "s"}` : null,
    sp.potency ? sp.potency : null].filter(Boolean).join(" · ") : "";
  // fixed artifact slot template (all artifacts, max level): 1 primary + these; nether = 1 slot
  const ART_SLOTS = [
    { key: "stat", label: "Stat", max: 3, pick: "stat" },
    { key: "trick", label: "Trick", max: 2, pick: "trick" },
    { key: "traits", label: "Trait", max: 1, pick: "trait" },
    { key: "spells", label: "Spell", max: 1, pick: "spell" },
    { key: "netherIds", label: "Nether", max: 1, pick: "nether" },
  ];
  const RELIC = new Map(D.relics.map(r => [r.id, r]));
  const CARD = new Map(D.cards.map(c => [c.id, c]));
  const CONDITION = new Map((D.conditions || []).map(c => [`${c.cat}:${c.key}`, c]));   // keyed "Buff:agile" for the taxonomy viewer
  const PERS = new Map((D.personalities || []).map(p => [p.key, p]));   // personality key -> {name,raise,lower}
  const SCROLL_MAX = D.scrollMax || 15;                                  // total stat scrolls per creature (each +1 base)

  // ── persistence (schema 2) ─────────────────────────────────────────────────
  const LS = { build: "subc.build", cards: "subc.cards", nether: "subc.nether", artifacts: "subc.artifacts", spellgems: "subc.spellgems", builds: "subc.builds", bookmarks: "subc.bookmarks", favorRanks: "subc.favorRanks", homeView: "subc.homeView" };
  const jload = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? dflt : v; } catch { return dflt; } };
  const jsave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const emptySlot = () => ({ cid: null, fusion: null, artifactId: null, relic: null, spellGemIds: [], personality: null, scrolls: {}, skinId: null });
  const freshBuild = () => ({ schema: 3, specIds: 2, specId: null, perkAlloc: {}, anoints: [], slots: Array.from({ length: 6 }, emptySlot) });
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
    // colours are user-picked; leave unset so an untinted stone renders the raw cor_n placeholder
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
    if (!a._gemMigrated) { a.spells = []; a._gemMigrated = true; }   // artifact.spells now holds spell-GEM ids, not raw spells
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
  const normalizeBuild = (b) => {
    b.schema = 3; b.perkAlloc = b.perkAlloc || {};
    b.anoints = Array.isArray(b.anoints) ? b.anoints : [];
    b.slots = Array.isArray(b.slots) ? b.slots : [];
    while (b.slots.length < 6) b.slots.push(emptySlot());
    b.slots = b.slots.slice(0, 6).map(s => Object.assign(emptySlot(), s));
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

  const cardLevel = (id) => {
    if (cards.applyAll) { const c = CARD.get(id); return c ? c.effects.length : 3; }
    return cards.levels[id] == null ? 3 : cards.levels[id];
  };

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
    // [icon] and [icons, 1984]-style sprite refs are dropped (leaves the following spell name as text)
    const s = String(str), re = /\{([A-Za-z0-9_]+)\}|\[[a-z0-9_]+(?:\s*,\s*\d+)*\]|<(\d+(?:\.\d+)?)>/g;
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
  const cardTaxoIndex = () => taxoIndexFor("cards", D.cards, c => c.taxo || []);
  const relicTaxoIndex = () => taxoIndexFor("relics", D.relics, r => r.taxo || []);
  // shared ＋Filter bar (active tag chips + add button) for taxo-filterable list overlays (cards, relics)
  const taxoFilterBar = (st) => st.taxoFilters.map((k, i) =>
    `<button class="facet on tag" data-action="rm-taxo" data-i="${i}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`).join("")
    + `<button class="facet add" data-action="facet-taxo">＋ Filter</button>`;
  const taxoMatch = (st, item) => !st.taxoFilters.length || st.taxoFilters.every(k => (item.taxo || []).includes(k));
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
  // "equipped in the current build" tests, for the saved-list Hide-equipped filter
  const artifactEquippedInBuild = (id) => build.slots.some(s => s.artifactId === id);
  const netherEquippedInBuild = (id) => build.slots.some(s => { const a = resolveArtifact(s); return a && (a.netherIds || []).includes(id); });
  const spellGemEquippedInBuild = (id) => build.slots.some(s => (s.spellGemIds || []).includes(id));   // gems only slot into creatures now
  function baseStats(slot) {
    const c = CREA.get(slot.cid); if (!c) return null;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const avg = (a, b) => f ? Math.round((a + b) / 2) : a;
    const out = { fused: !!f };
    const sc = slot.scrolls || {};
    // BASE stats are level-1 and personality-independent (round). Scrolls (+1 base each) are part of BaseStat.
    // Personality is NOT applied here — it changes the per-LEVEL growth rate, applied in leveledStats().
    for (const k of STAT_KEYS) out[k] = avg(c[k], f ? f[k] : 0) + (sc[k] || 0);
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
  // relic: 0.1% of its stat per rank (→ 10% at rank 100)
  function relicPctOf(slot) {
    const out = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
    const rel = slot.relic; if (!rel) return out;
    const r = RELIC.get(rel.id); if (!r || !r.statBonus) return out;
    const k = PROP_STAT[r.statBonus]; if (k) out[k] += 0.1 * (rel.rank || 0);
    return out;
  }
  // Personality = flat ±33% on the base stat: raised ×4/3 (+33%), lowered ×2/3 (−33%), others unchanged.
  const persRatio = (slot, k) => { const p = slot.personality ? PERS.get(slot.personality) : null; return p ? (p.raise === k ? 4 / 3 : p.lower === k ? 2 / 3 : 1) : 1; };
  function finalStats(slot) {
    const b = baseStats(slot); if (!b) return null;
    const sc = slot.scrolls || {};
    const pct = artifactPct(slot);
    const rp = deprivedActive() ? { hp: 0, atk: 0, def: 0, int: 0, spd: 0 } : relicPctOf(slot);   // Deprived ignores Relic effects
    for (const k of STAT_KEYS) pct[k] = Math.round((pct[k] + rp[k]) * 100) / 100;   // fold relic % into the bonus column
    const adj = {}, final = {};
    for (const k of STAT_KEYS) {
      // Personality ±33% applies to the PURE base (b minus scrolls); scrolls (+1 each) are added flat after.
      const scroll = sc[k] || 0, rawBase = b[k] - scroll;
      const eff = Math.round(rawBase * persRatio(slot, k)) + scroll;   // effective base before bonus %
      adj[k] = eff;
      final[k] = Math.round(eff * (1 + pct[k] / 100));
    }
    return { base: b, pct, adj, final,
             baseTotal: STAT_KEYS.reduce((s, k) => s + b[k], 0),
             total: STAT_KEYS.reduce((s, k) => s + final[k], 0) };
  }
  function slotTraitIds(slot) {
    const b = baseStats(slot); if (!b) return [];
    // Deprived ignores Fused traits → keep only the primary creature's innate trait (+ artifact-granted traits below)
    const c = CREA.get(slot.cid);
    const ids = deprivedActive() ? [c ? c.traitId : null].filter(x => x != null) : [...b.traitIds];
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
  const SPELL_SLOT_BASE = 3;
  function creatureSlotMax(slot) {
    const c = CREA.get(slot.cid); if (!c) return SPELL_SLOT_BASE;
    let max = SPELL_SLOT_BASE;
    for (const g of (D.spellSlotGrants || [])) {
      if (g.kind === "perk") {
        if (build.specId !== g.specId) continue;
        const spec = SPEC.get(g.specId); if (!spec) continue;
        const perk = spec.perks.find(p => p.key === g.key); if (!perk) continue;
        const r = perkRank(spec, perk);
        if (r > 0 && (!g.targetRace || c.race === g.targetRace)) max += g.perRank * r;
      } else if (g.kind === "trait") {
        if (slotTraitIds(slot).includes(g.traitId) && (g.self || !g.targetRace || c.race === g.targetRace)) max += g.perRank;
      }
    }
    return max;
  }
  // A creature can only equip Spell Gems whose (effective) class matches its own — unless a trait/perk
  // permits otherwise, or an Opal has re-classed the gem (handled by gemClass). Returns null when ANY
  // class is allowed (a full cross-class grant), otherwise the Set of allowed class names.
  const traitDescs = (slot) => slotTraitIds(slot).map(id => (TRAIT[id] || {}).desc || "");
  const ANYCLASS_RE = /equip (all |spell gems from any class|.*from any class)|regardless of (their|its) class/i;
  // party-wide grants apply to every creature ("Your creatures can equip …"); self grants only the bearer
  function allocatedPerkDescs() {                            // spec perks (ranked) + equipped anointments
    const out = []; const spec = SPEC.get(build.specId);
    if (spec) for (const p of spec.perks) if (perkRank(spec, p) > 0) out.push(p.desc || "");
    for (const a of (build.anoints || [])) { const s = SPEC.get(a.specId); const p = s && s.perks.find(x => x.key === a.key); if (p) out.push(p.desc || ""); }
    return out;
  }
  function spellEquipClasses(slot) {
    const base = baseStats(slot); const own = base && base.cls ? base.cls : null;
    const set = new Set(own ? [own] : []);
    // self any-class trait on this creature
    if (traitDescs(slot).some(d => /this creature can (only )?equip.*(any class|from any class)/i.test(d) || (ANYCLASS_RE.test(d) && /this creature/i.test(d)))) return null;
    // party-wide any-class trait on ANY party member (e.g. Pandora)
    if (build.slots.some(s => traitDescs(s).some(d => /your creatures can equip all spell gems/i.test(d) || (/your creatures/i.test(d) && ANYCLASS_RE.test(d) && !/\{class_/i.test(d))))) return null;
    // per-class party grants: "Your creatures can equip {CLASS_X} Spell Gems, regardless of their class" (Evoker)
    for (const d of allocatedPerkDescs()) { const m = d.match(/\{CLASS_(\w+)\}\s*spell gems,\s*regardless of (their|its) class/i); if (m) { const cl = SPELL_CLASSES.find(c => c.toLowerCase() === m[1].toLowerCase()); if (cl) set.add(cl); } }
    return set;
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

  function renderHome() {
    const spec = build.specId != null ? SPEC.get(build.specId) : null;
    const specTile = `
      <div class="spec-tile ${spec ? "filled" : ""}" data-action="${spec ? "spec-detail" : "pick-spec"}" title="Specialization">
        <div class="spec-tile-icon">${spec ? spriteImg(spec.emblem || spec.sprite, "px") : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="spec-tile-label">${spec ? esc(spec.label) : "Specialization"}</div>
        ${spec ? `<div class="spec-tile-sub">${allocatedPerks(spec).length}/${spec.perks.length} perks · ${specPoints(spec)} pts</div>` : ""}
        ${spec ? `<button class="slot-remove" data-action="clear-spec" title="Remove">✕</button>` : ""}
      </div>`;

    const eqAnoints = equippedAnointObjs();
    const anointIcons = eqAnoints.length
      ? `<div class="anoint-tile-icons">${eqAnoints.map(a => `<span class="anoint-mini" title="${esc(a.name)}">${a.icon ? spriteImg(a.icon, "px") : "✦"}</span>`).join("")}</div>`
      : `<span class="spec-tile-plus">✦</span>`;
    const anointTile = `
      <div class="spec-tile anoint-tile ${build.anoints.length ? "filled" : ""}" data-action="${build.anoints.length ? "anoint-detail" : "open-anoint"}" title="Anointments">
        <div class="spec-tile-icon">${anointIcons}</div>
        <div class="spec-tile-label">Anointments</div>
        ${build.anoints.length ? `<div class="spec-tile-sub">${build.anoints.length}/${anointMax()} equipped</div>` : ""}
      </div>`;

    const body = homeView === "roster"
      ? `<div class="party-roster">${build.slots.map((s, i) => renderRosterRow(s, i)).join("")}</div>`
      : `<div class="party-grid">${build.slots.map((s, i) => renderSlot(s, i)).join("")}</div>`;
    return `
      <div class="home-top">${specTile}${anointTile}</div>
      ${body}
    `;
  }

  // The Grid/Roster switch lives in the header Menu (outside #app), so render() doesn't touch it —
  // reflect the active layout on its seg buttons whenever the menu opens / the layout changes.
  function syncLayoutMenu() {
    document.querySelectorAll('#main-menu [data-action="home-view"]').forEach(b =>
      b.classList.toggle("on", b.dataset.view === homeView));
  }

  // Party "at a glance" roster row: sprite (+ identity/stats/equip) on the left, all resolved traits
  // (innate + fusion + artifact/nether) stacked to the right, every row sharing one container. Mirrors
  // renderSlot's data-actions so editing (pick / remove / artifact / relic / spells / detail) still works.
  function renderRosterRow(slot, i) {
    const c = CREA.get(slot.cid);
    const locked = i >= creatureCap();   // Pariah caps the party at 3 creatures
    if (!c) {
      if (locked) return `<div class="roster-row locked" data-slot="${i}">
        <div class="roster-identity"><div class="roster-sprite"><div class="slot-empty-icon">🔒</div></div>
          <div class="roster-name">Locked</div><div class="slot-sub">Pariah — 3 max</div></div>
        <div class="roster-traits empty"><span class="roster-empty">Party capped at 3 creatures.</span></div></div>`;
      return `<div class="roster-row" data-slot="${i}">
        <div class="roster-identity">
          <div class="roster-sprite" data-action="pick-creature" data-slot="${i}"><div class="slot-empty-icon">＋</div></div>
        </div>
        <div class="roster-traits empty"></div></div>`;
    }
    const b = baseStats(slot);
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const a = resolveArtifact(slot);
    const fs = finalStats(slot);
    const cls = b.cls;
    const clsIco = cls && D.classIcons && D.classIcons[cls]
      ? `<span class="tile-badge" title="${esc(cls)}">${spriteImg(D.classIcons[cls], "px")}</span>` : "";
    const raceIco = c.race && D.raceIcons && D.raceIcons[c.race]
      ? `<span class="tile-badge" title="${esc(c.race)}">${spriteImg(D.raceIcons[c.race], "px")}</span>` : "";
    const traitIds = slotTraitIds(slot);
    const traitHtml = traitIds.length
      ? traitIds.map(tid => `<div class="primary-traits">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("")
      : `<div class="slot-sub" style="text-align:left">No traits.</div>`;
    const statLine = STAT_KEYS.map(k => `<span class="rstat"><i>${STAT_LABEL[k].slice(0, 3)}</i>${fs.final[k]}</span>`).join("")
      + `<span class="rstat total"><i>Total</i>${fs.total}</span>`;
    return `<div class="roster-row filled ${locked ? "locked" : ""}" data-slot="${i}" title="Right-click to change creature / fusion">
      <div class="roster-identity">
        <div class="tile-badges">${clsIco}${raceIco}</div>
        <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
        <div class="roster-sprite" data-action="creature-detail" data-slot="${i}">${critFaceSkinned(c, slot.skinId)}</div>
        <div class="roster-head">
          <div class="roster-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
          <div class="slot-sub roster-clsrace"><span style="color:${clsColor(cls)};font-weight:700">${esc(cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
        </div>
        ${locked ? `<div class="slot-sub" style="color:var(--bad);font-weight:700">Ignored (Pariah)</div>` : ""}
        <div class="roster-stats">${statLine}</div>
        <div class="roster-actions">
          <button class="slot-mini ${a ? "on" : ""}" data-action="equip-artifact" data-slot="${i}" title="Artifact">Artifact</button>
          <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
          <button class="slot-mini ${(slot.spellGemIds || []).length ? "on" : ""}" data-action="creature-spells" data-slot="${i}" title="Spell gems">Spells${(slot.spellGemIds || []).length ? ` ${slot.spellGemIds.length}/${creatureSlotMax(slot)}` : ""}</button>
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
    const raceIco = c.race && D.raceIcons && D.raceIcons[c.race]
      ? `<span class="tile-badge" title="${esc(c.race)}">${spriteImg(D.raceIcons[c.race], "px")}</span>` : "";
    return `<div class="slot filled ${locked ? "locked" : ""}" data-slot="${i}" title="Right-click to change creature / fusion">
      ${locked ? `<div class="slot-ignored" title="Pariah allows only 3 creatures — this slot is ignored">Ignored</div>` : ""}
      <div class="tile-badges">${clsIco}${raceIco}</div>
      <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
      <div class="slot-sprite-wrap" data-action="creature-detail" data-slot="${i}">${critFaceSkinned(c, slot.skinId)}</div>
      <div class="slot-name">${esc(c.name)}${f ? ` <span style="color:var(--accent2)">⚭</span>` : ""}</div>
      <div class="slot-actions">
        <button class="slot-mini ${a ? "on" : ""}" data-action="equip-artifact" data-slot="${i}" title="Artifact">Artifact</button>
        <button class="slot-mini ${slot.relic ? "on" : ""}" data-action="build-relic" data-slot="${i}" title="Relic">Relic</button>
        <button class="slot-mini ${(slot.spellGemIds || []).length ? "on" : ""}" data-action="creature-spells" data-slot="${i}" title="Spell gems">Spells${(slot.spellGemIds || []).length ? ` ${slot.spellGemIds.length}/${creatureSlotMax(slot)}` : ""}</button>
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
    if (ovState && ovState.kind === "spec" && ovState.sel != null) animateCostume(OV, SPEC.get(ovState.sel));
    else if (dovState && dovState.kind === "spec-detail" && dovState.specId != null) animateCostume(DOV, SPEC.get(dovState.specId));
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
  const wardrobeFramesFor = (imgOrSprite) => {   // resolve a wardrobe entry's [f0,f1] from its img path or sprite key
    const w = (D.wardrobe || []).find(x => x.img === imgOrSprite || x.sprite === imgOrSprite);
    return w && Array.isArray(w.frames) && w.frames.length >= 2 ? w.frames : null;
  };
  const SCROLLERS = [".ovl-center-scroll", ".ovl-left", ".ovl-right", ".art-side-list", ".art-side-scroll", ".art-pv-body", ".xref-wrap"];

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
  function closeDetailReal() { if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } stopWardrobeAnims(); DOV.classList.add("hidden"); DOV.innerHTML = ""; dovState = null; }

  function openOverlay(html) { OV.innerHTML = html; OV.classList.remove("hidden"); reconcileHistory(); }
  function closeOverlay() { closeOverlayReal(); reconcileHistory(); }
  function openDetail(html) { if (specAnimTimer) { clearInterval(specAnimTimer); specAnimTimer = null; } DOV.innerHTML = html; DOV.classList.remove("hidden"); reconcileHistory(); }
  function closeDetail() { closeDetailReal(); reconcileHistory(); }

  // resetTop=true when this refresh is a navigation to a NEW page/view (list→detail, tab swap):
  // the new page should start at the top instead of inheriting the previous page's scroll.
  function refreshOverlay(resetTop) {
    if (!ovState) return;
    const panel = OV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? e.scrollTop : 0; });
    panel.outerHTML = ovState.render();
    const p2 = OV.querySelector(".overlay-panel");
    if (!resetTop) SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
    maybeFocusSearch(OV);
    syncSpecAnim(); syncWardrobeAnims();
  }
  function refreshDetail(resetTop) {
    if (!dovState) return;
    const panel = DOV.querySelector(".overlay-panel"); if (!panel) return;
    const saved = SCROLLERS.map(sel => { const e = panel.querySelector(sel); return e ? e.scrollTop : 0; });
    panel.outerHTML = dovState.render();
    const p2 = DOV.querySelector(".overlay-panel");
    if (!resetTop) SCROLLERS.forEach((sel, k) => { const e = p2 && p2.querySelector(sel); if (e) e.scrollTop = saved[k]; });
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
  const sortCreatures = (list, key) => key
    ? list.slice().sort((a, b) => (b[key] || 0) - (a[key] || 0) || (a.name || "").localeCompare(b.name || ""))
    : list;
  function openCreaturePicker(slotIdx) {
    const slot = build.slots[slotIdx];
    ovState = {
      kind: "creature", slotIdx, step: "primary",
      primaryId: slot.cid, fusionId: slot.fusion, skinId: slot.skinId != null ? slot.skinId : null,
      personality: slot.personality || null, scrolls: { ...(slot.scrolls || {}) },
      search: "", clsFilter: null, raceFilter: null, taxoFilters: [], limit: CREA_PAGE, sort: null, view: "grid",
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
    if (st.taxoFilters.length) { const tx = creatureTaxo(c); if (!st.taxoFilters.every(k => tx.includes(k))) return false; }
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
    if (st.step === "customize") {
      const footer = `<button class="btn-ghost" data-action="crea-back">‹ Back</button>
        <button class="btn-confirm" data-action="crea-confirm" ${st.primaryId == null ? "disabled" : ""}>${st.fusionId == null ? "Commit (no fusion)" : "Commit fusion"}</button>`;
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
    const list = sortCreatures(D.creatures.filter(c => creatureMatches(c, st)), st.sort);
    const limit = st.limit || CREA_PAGE;
    const shown = list.slice(0, limit);
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
      ${bookmarks.traits.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="crea-bkonly" title="Show only creatures whose trait you bookmarked">★ Bookmarked</button>` : ""}
    </div>`;
    // stat sort — highest first; picking a stat draws a magnitude bar (value / roster max) on each tile
    const sortbar = `<div class="ovl-filterbar crea-sortbar"><span class="foot-info">Sort</span><div class="seg">
      <button class="seg-btn ${!st.sort ? "on" : ""}" data-action="crea-sort" data-k="">—</button>
      ${CREA_STAT_COLS.map(c => `<button class="seg-btn ${st.sort === c.k ? "on" : ""}" data-action="crea-sort" data-k="${c.k}">${c.lbl}</button>`).join("")}
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
      <div class="pick-tile ${sel === c.id ? "selected" : ""} ${blk ? "disabled" : ""}" ${blk ? `title="Avatar limit reached${avatarCap() === 0 ? " — Deprived can't use Avatars" : ""}"` : `data-action="crea-pick" data-id="${c.id}"`}>
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
            <div class="ctr-id"><b class="ctr-name">${esc(c.name)}</b>
              ${c.race ? `<span class="ctr-tag">${raceIco ? `<span class="ctr-ico">${raceIco}</span>` : ""}${esc(c.race)}</span>` : ""}
              ${c.cls ? `<span class="ctr-tag">${clsIco ? `<span class="ctr-ico">${clsIco}</span>` : ""}${esc(c.cls)}</span>` : ""}</div>
            <div class="ctr-stats">${STAT_KEYS.map(k => `<span class="ctr-stat"><span class="ctr-stat-k">${STAT_LABEL[k]}</span> <b>${c[k] ?? "—"}</b></span>`).join("")}
              <span class="ctr-stat"><span class="ctr-stat-k">Total</span> <b>${c.total ?? "—"}</b></span></div></div>`;
        return `<div class="crea-trait-row primary-traits ${sel === c.id ? "selected" : ""} ${blk ? "disabled" : ""}"${blk ? "" : ` data-action="crea-pick" data-id="${c.id}"`}>
          ${head}${traitBanner(c.traitId, { noNav: true })}<div class="trait-desc">${richText(tr ? tr.desc || "" : "")}</div></div>`; }).join("")}
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
        <div class="ovl-center">${filterbar}${sortbar}
          <div class="ovl-center-scroll">${traitsView ? traitList : `<div class="pick-grid crea-grid">${tiles}</div>`}
            ${list.length > shown.length
              ? `<div class="crea-loadmore"><button class="btn-ghost" data-action="crea-more">Load more (${shown.length} of ${list.length})</button></div>`
              : list.length > CREA_PAGE ? `<div class="slot-sub" style="margin-top:10px;text-align:center">All ${list.length} shown</div>` : ""}</div>
        </div>
        ${traitsView ? "" : `<div class="ovl-right">${side}</div>`}
      </div>
      <div class="overlay-footer"><span class="foot-info"></span><div class="crea-foot">${viewToggle}${footer}</div></div>
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
        <div class="primary-traits" style="margin-bottom:12px">${traitBanner(c.traitId)}<div class="trait-desc">${richText((TRAIT[c.traitId] || {}).desc || "")}</div></div>` : ""}
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
        ${tr ? `${traitBanner(p.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div>` : ""}
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
      <div class="cd-sprite">${critFaceSkinned(primary, st.skinId)}</div>
      <h3 style="text-align:center;margin:6px 0">${esc(primary.name)}${secondary ? ` <span style="color:var(--accent2)">⚭</span> ${esc(secondary.name)}` : ""}</h3>
      <div class="slot-sub" style="margin-bottom:10px"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span></div>
      ${traitIds.length ? `<div class="section-label">Traits</div><div style="margin-bottom:10px">${traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("")}</div>` : ""}
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
    else if (st.facet === "anoint-spec") { title = "Filter by Specialization"; opts = anointSpecs().map(s => ({ v: s, label: s })); }
    else if (st.facet === "anoint-fgod") { title = "Filter by False God"; opts = (D.falseGods || []).map(g => ({ v: g.key, label: g.name })); }
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
        ${back ? `<div class="ovl-filterbar">${back}</div>` : ""}
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
  const specPerkRank = (spec, key) => { if (!spec) return 0; const p = spec.perks.find(x => x.key === key); return p ? perkRank(spec, p) : 0; };
  const specPerkOn = (spec, key) => specPerkRank(spec, key) > 0;
  // Royal: Master of All (+10) & Highborn (+5) push the anointment cap up to 20
  function anointMax() { const s = curSpec(); let m = 5; if (s) { if (specPerkOn(s, "ROYALTY")) m += 10; if (specPerkOn(s, "HIGHBORN")) m += 5; } return m; }
  // Pariah: Introversion limits the party to 3 creatures
  const creatureCap = () => (specPerkOn(curSpec(), "INTROVERSION") ? 3 : 6);
  // Avatars: 1 by default, +1 per Army of Gods rank (Fanatic → 3), 0 under Deprived's Total Deprivation
  function avatarCap() { const s = curSpec(); if (!s) return 1; if (specPerkOn(s, "TOTALDEPRIVATION")) return 0; return 1 + specPerkRank(s, "ARMYOFGODS"); }
  const deprivedActive = () => specPerkOn(curSpec(), "TOTALDEPRIVATION");
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
        <div class="pt-sprite emblem">${spriteImg(s.emblem || s.sprite, "px")}</div><div class="pt-name">${esc(s.label)}</div></div>`).join("");
    let info = "";
    if (sel) {
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

  // spec detail (view) — mirrors the selector's info panel; Edit routes back to the picker
  function openSpecDetail() {
    if (build.specId == null) { openSpecPicker(); return; }
    dovState = { kind: "spec-detail", specId: build.specId, render: renderSpecDetail };
    openDetail(dovState.render()); syncSpecAnim();
  }
  // shared perk-list markup used by both the selector info panel and the detail page
  function specPerkListHtml(spec) {
    return spec.perks.map(p => {
      const r = perkRank(spec, p), mx = perkMax(p), on = r > 0;
      const badge = mx > 1 ? `<span class="perk-rankbadge">${r}/${mx}</span>` : (on ? `<span class="perk-rankbadge">✓</span>` : "");
      const asc = p.ascension ? `<span class="anoint-badge asc">Ascension</span>` : "";
      const ico = p.icon ? `<span class="perk-ico sm">${spriteImg(p.icon, "px")}</span>` : `<span class="perk-ico sm empty"></span>`;
      return `<div class="perk-line apx-clickable ${on ? "on" : "off"} ${p.ascension ? "asc" : ""}" data-action="apx-open" data-ek="perk" data-eid="${esc(p.key)}">${ico}
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${asc}${badge}</span>${bkBtn("perks", p.key)}</div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
        </div></div>`;
    }).join("");
  }
  function renderSpecDetail() {
    const spec = SPEC.get(dovState.specId); if (!spec) return "";
    const allocCount = allocatedPerks(spec).length, pts = specPoints(spec);
    const cos0 = spec.costumes && spec.costumes.length ? spec.costumes[0] : null;
    const costumeImg = cos0 ? (cos0.frames && cos0.frames[0]) || cos0.img : spec.sprite;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(spec.label)}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="spec-info">
          <div class="spec-info-sprite costume" id="specCostume">${spriteImg(costumeImg, "px")}</div>
          <h2 class="spec-info-name">${esc(spec.label)}</h2>
          <div class="trait-desc spec-play">${richText(spec.playstyle || spec.description || "")}</div>
          <div class="section-label" style="margin-top:12px">Perks — ${allocCount}/${spec.perks.length} allocated · ${pts} pts</div>
          <div class="perk-list">${specPerkListHtml(spec)}</div>
        </div>
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div><button class="btn-ghost" data-action="spec-edit">Edit</button>
        <button class="btn-confirm" data-action="close-detail">Done</button></div></div>
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
    // taxonomy filter — mirrors the standard facet-picker drill-down (Category → Value as opt-rows,
    // not inline chips) so it matches the ＋ Filter used across the creature selector / artifact builder.
    const perkBrowsing = st.perkBrowse || !!st.perkCat;
    let taxobar, browseBody = "";
    if (st.perkTaxo) taxobar = `<button class="facet on tag" data-action="perk-taxo-clear">${esc(taxoCatName(st.perkTaxo))}: <b>${esc(taxoValName(st.perkTaxo))}</b> <span class="facet-x">✕</span></button>`;
    else if (st.perkCat) taxobar = `<button class="facet" data-action="perk-taxo-back">‹ Categories</button><span class="facet on">${esc(st.perkCat)}</span>`;
    else if (st.perkBrowse) taxobar = `<button class="facet" data-action="perk-taxo-back">‹ Perks</button><span class="facet on">Filter by mechanic</span>`;
    else taxobar = `<button class="facet add" data-action="perk-taxo-open">＋ Filter</button>`;
    if (st.perkCat) browseBody = `<div class="opt-list">${[...valsByCat.get(st.perkCat) || []].sort((a, b) => taxoValName(a).localeCompare(taxoValName(b))).map(k =>
      `<button class="opt-row" data-action="perk-taxo-val" data-v="${esc(k)}"><span>${esc(taxoValName(k))}</span></button>`).join("")}</div>`;
    else if (st.perkBrowse) browseBody = `<div class="opt-list">${[...valsByCat.keys()].sort().map(c =>
      `<button class="opt-row" data-action="perk-taxo-cat" data-c="${esc(c)}"><span>${esc(c)}</span><span class="opt-chev">›</span></button>`).join("")}</div>`;
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
      const asc = p.ascension ? `<span class="anoint-badge asc">Ascension</span>` : "";
      const ico = p.icon ? `<div class="perk-ico">${spriteImg(p.icon, "px")}</div>` : `<div class="perk-ico empty"></div>`;
      return `<div class="perk-row ${on ? "on" : "off"} ${p.ascension ? "asc" : ""}">
        ${ico}<div class="perk-row-main">
          <div class="perk-row-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${asc}${costLine}</span></div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
          ${stepper}</div></div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="facet-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(spec.label)} — Perks</h2>
        <input class="ovl-search" placeholder="Search perks…" value="${esc(st.search)}" data-action="perk-search">
        <button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="ovl-filterbar"><button class="chip" data-action="perk-all">Max all</button><button class="chip" data-action="perk-none">Clear all</button>${taxobar}</div>
        <div class="ovl-center-scroll">${perkBrowsing ? browseBody : `<div class="perk-picker">${rows}</div>`}</div>
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
    return spec ? esc(spec.label) : "No specialization";
  };
  const buildSpecLabel = (b) => { const s = (b.build && b.build.specId != null) ? SPEC.get(b.build.specId) : null; return s ? s.label : ""; };
  function sortBuilds(list, mode) {
    if (mode === "name") return list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (mode === "spec") return list.sort((a, b) => (buildSpecLabel(a) || "￿").localeCompare(buildSpecLabel(b) || "￿") || (a.name || "").localeCompare(b.name || ""));
    return list.sort((a, b) => (b.ts || 0) - (a.ts || 0));   // "edited" (default)
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
      return `<div class="bi-crit${c ? "" : " empty"}"${c ? ` title="${esc(c.name)}"` : ""}>${c ? critFace(c) : ""}</div>`; }).join("")}</div>`;
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
    const tiles = sortBuilds(builds.slice(), st.sort).map(b => {   // the SELECTED tile animates its costume
      const selB = st.sel === b.id, bframes = selB && b.icon ? wardrobeFramesFor(b.icon) : null;
      return `<div class="lib-tile ${selB ? "selected" : ""} ${st.flash === b.id ? "flash" : ""}" data-action="builds-sel" data-id="${b.id}">
        <div class="lib-icon"${bframes ? ` data-anim-frames='${JSON.stringify(bframes)}'` : ""}>${b.icon ? spriteImg(b.icon, "px") : `<span class="slot-empty-icon">✦</span>`}</div>
        <div class="lib-name">${esc(b.name)}</div>
        <div class="lib-sub">${buildSummary(b.build || {})}</div>
      </div>`; }).join("") || `<div class="slot-sub" style="padding:10px">No saved builds yet — save your current party.</div>`;
    const sortBar = builds.length ? `<div class="ovl-filterbar"><span class="foot-info">Sort</span><div class="seg">
      <button class="seg-btn ${st.sort === "edited" ? "on" : ""}" data-action="builds-sort" data-sort="edited">Last edited</button>
      <button class="seg-btn ${st.sort === "name" ? "on" : ""}" data-action="builds-sort" data-sort="name">Name</button>
      <button class="seg-btn ${st.sort === "spec" ? "on" : ""}" data-action="builds-sort" data-sort="spec">Spec</button>
    </div></div>` : "";
    // right info panel: preview the selected build — spec emblem + equipped anointment icons, then a 2×3 creature grid
    const infoPanel = sel ? `<div class="ovl-right build-info">${renderBuildPreview(sel)}</div>` : "";
    // a blank loadout (no creature in any slot) must never overwrite a saved build back to the template state
    const loadoutBlank = !build.slots.some(s => s && s.cid != null);
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Builds</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">${sortBar}<div class="ovl-center-scroll">
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

  // wardrobe icon picker (detail overlay) — full 820 costumes, front-facing frame, search + category
  const WARDROBE_CATS = ["specialization", "npc", "master", "creature", "animal"];
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
      `<button class="facet ${st.cat === c ? "on" : ""}" data-action="iconpick-cat" data-c="${c}">${c[0].toUpperCase() + c.slice(1)}</button>`).join("")
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
      <div class="overlay-body"><div class="ovl-center">
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
    const has = (x) => { const s = x || []; return tags.every(t => s.includes(t)); };
    return {
      traits: u.traits.filter(t => has(t.taxo)),
      perks: u.perks.filter(p => has(p.taxo)),
      spells: u.spells.filter(s => has(s.taxo)),
      relics: u.relics.filter(r => has(r.taxo)),
      cards: u.cards.filter(c => has(c.taxo)),
    };
  }
  const appendixTotal = (res) => res.traits.length + res.perks.length + res.spells.length + res.relics.length + res.cards.length;
  // Browse index: Category → [{key,val,n}] where only values that co-occur with the current
  // tags (within scope) survive, and n = how many results adding that value would yield. As tags
  // narrow, empty categories/values drop out and every n updates. (Requirements 4 & 5.)
  function appendixBrowseIndex(tags) {
    const res = appendixResults(tags);
    const counts = new Map();
    const bump = (arr) => { for (const it of arr) for (const k of (it.taxo || [])) counts.set(k, (counts.get(k) || 0) + 1); };
    bump(res.traits); bump(res.perks); bump(res.spells); bump(res.relics); bump(res.cards);
    const tagSet = new Set(tags);
    const byCat = new Map();
    for (const catObj of (D.taxonomy ? D.taxonomy.categories : [])) {
      const rows = [];
      for (const val of catObj.values) {
        const key = catObj.category + "::" + val;
        if (tagSet.has(key)) continue;                          // already applied
        const n = counts.get(key) || 0;
        if (n > 0) rows.push({ key, val, n });
      }
      if (rows.length) byCat.set(catObj.category, rows);
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
  function openAppendix() {
    ovState = { kind: "appendix", search: "", tags: [], browsing: false, bkScope: null,
      collapsed: new Set(), expanded: new Set(), render: renderAppendix };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  function renderAppendix() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const tags = st.tags;
    const bk = appendixBkCounts();
    const bkCount = bk.all;
    // Browse (filter-picking) view = the landing when nothing is applied, or when ＋ Filter is tapped.
    // Results view = whenever a taxonomy tag, a bookmark scope, or a name query is active.
    const browsing = st.browsing || (tags.length === 0 && !st.bkScope && !q);
    // active-tag chips (removable) — mirror the creature selector's multi-AND facet chips
    const tagChips = tags.map(k =>
      `<button class="facet on tag" data-action="appendix-rm-tag" data-k="${esc(k)}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`).join("");
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
      for (const cat of [...idx.keys()].sort()) {
        let vals = idx.get(cat);
        const catMatch = cat.toLowerCase().includes(q);
        if (q && !catMatch) vals = vals.filter(v => v.val.toLowerCase().includes(q));
        if (!vals.length) continue;
        const open = q ? true : st.expanded.has(cat);
        const rows = open ? `<div class="opt-list apx-vals">${vals.slice().sort((a, b) => a.val.localeCompare(b.val)).map(v =>
          `<button class="opt-row" data-action="appendix-tag" data-k="${esc(v.key)}"><span>${esc(v.val)}</span><span class="apx-val-n">${v.n}</span></button>`).join("")}</div>` : "";
        parts.push(`<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="appendix-cat-toggle" data-c="${esc(cat)}">
            <span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(cat)}</button>${rows}`);
      }
      placeholder = "Search categories & tags…";
      sub = `<div class="ovl-filterbar">${backToResults}${tagChips}</div>`;
      body = parts.join("") || `<div class="slot-sub" style="padding:10px">No categories or tags match.</div>`;
    } else {
      const res = appendixResults(tags);
      const CAP = 60;
      // provenance chips (token/llm/…) live ONLY on the taxonomy detail page now — the result rows stay clean.
      const section = (title, items, renderRow) => {
        let list = items;
        if (q) list = list.filter(x => ((x._search || x.name) || "").toLowerCase().includes(q));
        if (!list.length) return "";
        const collapsed = st.collapsed.has(title);
        return `<button class="apx-sec-head${collapsed ? " collapsed" : ""}" data-action="appendix-toggle-sec" data-sec="${esc(title)}">
            <span class="apx-sec-caret">${collapsed ? "▸" : "▾"}</span>${esc(title)} <span class="apx-sec-n">${list.length}</span></button>
          ${collapsed ? "" : `<div class="perk-list">${list.slice(0, CAP).map(renderRow).join("")}
          ${list.length > CAP ? `<div class="slot-sub" style="padding:6px">Showing ${CAP} of ${list.length}.</div>` : ""}</div>`}`;
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
        return { id: t.id, name: t.name, desc: t.desc, creature, items, itemNames, taxo: t.taxo, taxoSrc: t.taxoSrc,
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
          g.desc ? richText(g.desc) : "", bkBtn("traits", g.id), { ek: "trait", eid: g.id }, availTagsHtml(g));
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
        return line(apxStack(bossBox, matBox(g)), g.name, meta, g.desc ? richText(g.desc) : "", bkBtn("traits", g.id), { ek: "trait", eid: g.id }, availTagsHtml(g));
      };
      const body_sections = [
        section("Traits", creatureTraitRows, traitRow),
        section("Item-only Traits", itemOnlyTraitRows, traitRow),
        section("Boss Traits", bossTraitRows, bossTraitRow),
        section("Perks", res.perks, p => line(apxStack(apxIcon(SPEC_EMBLEM.get(p.spec), "apx-spec", ` title="${esc(p.spec)}"`), apxIcon(p.icon)), p.name,
          `<span class="anoint-spec-tag">${esc(p.spec)}</span>`, perkText(p.desc, p.ranks), bkBtn("perks", p.key), { ek: "perk", eid: p.key })),
        section("Spells", res.spells, s => line(apxStack(apxIcon(spellIcon(s))), s.name,
          `${s.cls ? `<span class="anoint-spec-tag">${esc(s.cls)}</span>` : ""}${spellMeta(s) ? `<span class="anoint-spec-tag">${esc(spellMeta(s))}</span>` : ""}`, perkText(s.desc, null), bkBtn("spells", s.id), { ek: "spell", eid: s.id }, availTagsHtml(s))),
        section("Relics", res.relics, r => line(apxStack(apxIcon(r.icon)), r.name,
          r.statBonus ? `<span class="anoint-spec-tag">${esc(r.statBonus)}</span>` : "", relicRanksHtml(r.ranks), null, { ek: "relic", eid: r.id })),
        section("Realm Cards", res.cards.map(c => ({ ...c, name: c.family })), c => line(apxStack(apxIcon(c.sprite)), c.family,
          c.cls ? `<span class="anoint-spec-tag">${esc(c.cls)}</span>` : "", cardTiersHtml(c.effects, c.tiers), null, { ek: "card", eid: c.id })),
      ].join("");
      const total = traitRows.length + res.perks.length + res.spells.length + res.relics.length + res.cards.length;
      placeholder = "Search by name…";
      sub = `<div class="ovl-filterbar">${tagChips}
        <button class="facet add" data-action="appendix-add">＋ Filter</button>
        <span class="foot-info">${total} result${total === 1 ? "" : "s"}</span></div>`;
      body = body_sections || `<div class="slot-sub" style="padding:10px">Nothing matches${q ? ` “${esc(st.search.trim())}”` : " these filters"}.</div>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Appendix</h2>
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
  const relicRanksHtml = (ranks) => (ranks || []).length
    ? `<div class="apx-ranklist">${ranks.map(r => `<div class="apx-rank"><span class="apx-rank-n">Rank ${r.rank}</span><span class="apx-rank-d">${richText(r.desc || "")}</span></div>`).join("")}</div>`
    : "";
  // card effects → one line per tier, labelled by the card count that unlocks it (effects legitimately
  // repeat per tier — they stack, they're not duplicates); tiers[i] = cards needed for effects[i]
  const cardTiersHtml = (effects, tiers) => (effects || []).length
    ? `<div class="apx-tierlist">${effects.map((e, i) => { const n = tiers && tiers[i] != null ? tiers[i] : null;
        return `<div class="apx-tier"><span class="apx-tier-n">${n != null ? `${n} card${n === 1 ? "" : "s"}` : `Tier ${i + 1}`}</span><span class="apx-tier-d">${richText(e || "")}</span></div>`; }).join("")}</div>`
    : "";
  // resolve (kind,id) → { e, icon, name, descHtml, kindLabel } for the detail view
  function resolveEntity(kind, id) {
    if (kind === "trait") { const e = TRAIT[+id]; return { e, icon: traitItemIcon(id), name: e && e.name, descHtml: e && richText(e.desc || ""), kindLabel: "Trait" }; }
    if (kind === "spell") { const e = SPELL.get(+id); return { e, icon: e && spellIcon(e), name: e && e.name, descHtml: e && perkText(e.desc || ""), kindLabel: "Spell" }; }
    if (kind === "relic") { const e = RELIC.get(+id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && relicRanksHtml(e.ranks), kindLabel: "Relic" }; }
    if (kind === "card") { const e = CARD.get(+id); return { e, icon: e && e.sprite, name: e && e.family, descHtml: e && cardTiersHtml(e.effects, e.tiers), kindLabel: "Realm Card" }; }
    if (kind === "perk") { const e = perkByKey(id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && perkText(e.desc, e.ranks), kindLabel: "Perk" }; }
    if (kind === "condition") { const e = CONDITION.get(id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && richText(e.desc || ""), kindLabel: e && e.cat }; }
    return { e: null };
  }
  // grouped taxonomy: Category → its values, each a chip that (a) shows the provenance source and
  // (b) jumps to the Appendix filtered by that tag
  function entityTaxHtml(e) {
    const groups = new Map();
    (e.taxo || []).forEach((k, i) => { const cat = taxoCatName(k); if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push({ val: taxoValName(k), src: e.taxoSrc ? e.taxoSrc[i] : null, key: k }); });
    if (!groups.size) return `<div class="slot-sub" style="padding:10px">No taxonomy tags on this entry.</div>`;
    return [...groups].map(([cat, vals]) => `<div class="etax-group">
      <div class="etax-cat">${esc(cat)}</div>
      <div class="etax-vals">${vals.map(v => `<button class="etax-tag" data-action="etax-filter" data-k="${esc(v.key)}" title="Filter the Appendix to “${esc(v.val)}”">${esc(v.val)}${v.src ? `<span class="apx-src s-${esc(v.src)}">${esc(v.src)}</span>` : ""}</button>`).join("")}</div>
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
    dovState = { kind: "entity-detail", ekind: kind, eid: id, ret, render: renderEntityDetail };
    openDetail(dovState.render());
  }
  function closeEntityDetail() {
    const ret = dovState && dovState.ret;
    if (ret) { dovState = ret; openDetail(dovState.render()); } else closeDetail();
  }
  function renderEntityDetail() {
    const st = dovState, r = resolveEntity(st.ekind, st.eid), e = r.e;
    if (!e) return `<div class="ovl-backdrop" data-action="entity-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>Not found</h2><button class="ovl-close" data-action="close-entity">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="slot-sub" style="padding:16px">This entry could not be resolved.</div></div></div></div></div>`;
    const n = (e.taxo || []).length;
    return `<div class="ovl-backdrop" data-action="entity-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header">${r.icon ? `<span class="hdr-ico">${spriteImg(r.icon, "px")}</span>` : ""}
        <h2>${esc(r.name || "—")}</h2><span class="anoint-spec-tag">${esc(r.kindLabel)}</span>
        ${availTagsHtml(e)}
        <button class="ovl-close" data-action="close-entity">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        ${r.descHtml ? `<div class="perk-desc" style="margin-bottom:12px">${r.descHtml}</div>` : ""}
        ${st.ekind === "condition" && e.exclusive && e.exclusive.show ? `<div class="excl-note">${e.exclusive.icon ? spriteImg(e.exclusive.icon, "px") : ""}<span>Exclusive to <b>${esc(e.exclusive.source)}</b></span></div>` : ""}
        ${st.ekind === "trait" ? `<div class="section-label">Source</div>${traitDetailSections(e)}` : ""}
        <div class="section-label">Taxonomy — ${n} tag${n === 1 ? "" : "s"}</div>
        ${entityTaxHtml(e)}
      </div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-entity">Done</button></div>
    </div></div>`;
  }

  // ── Synergy — taxonomy tags shared across the build, in two views (Matrix / List). ──
  // Members = the spec, each equipped anointment, each creature (+ its artifact/nether traits
  // and equipped spell gems). Matrix = a grid of members (rows) × tags (columns); the bottom
  // row sums each TAG (how many members carry it — that's the synergy strength). List = the
  // same data grouped per shared tag, showing each contributing effect's description + owner.

  // "Does not stack" is on ~hundreds of traits and never indicates a synergy — drop it from both views.
  const SYN_EXCLUDE = new Set(["Effect Limitation::Does not stack"]);
  const synTags = (taxo) => (taxo || []).filter(k => !SYN_EXCLUDE.has(k));

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
    const addEffect = (m, label, taxo, sub) => { const t = synTags(taxo); if (!t.length) return; m.children.push({ label, sub, tags: new Set(t) }); for (const k of t) bump(m, k); };
    if (build.specId != null) {
      const s = SPEC.get(build.specId);
      if (s) { const m = mk("spec", s.label, "spec");
        for (const p of allocatedPerks(s)) addEffect(m, p.name, p.taxo);
        if (m.tags.size) members.push(m); }
    }
    const anoints = equippedAnointObjs();
    if (anoints.length) { const m = mk("anoints", "Anointments", "anoint");
      for (const a of anoints) addEffect(m, a.name, a.taxo, a.spec);
      if (m.tags.size) { m.sub = `${m.children.length} equipped`; members.push(m); } }
    build.slots.forEach((slot, i) => {
      const c = CREA.get(slot.cid); if (!c) return;
      const m = mk("crea" + i, c.name, "crea");
      // the creature is just the container; each TRAIT (innate/fusion/artifact/nether) and spell-gem spell
      // it carries is the counted effect — the creature's own name never contributes.
      for (const tid of slotTraitIds(slot)) { const tr = TRAIT[tid]; if (tr) addEffect(m, tr.name, tr.taxo, "trait"); }
      for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid); const sp = g ? gemSpell(g) : null; if (sp) addEffect(m, sp.name, sp.taxo, "spell gem"); }
      // relic (equipped per creature; Deprived ignores relics) + nether spell props
      const rel = slot.relic && !deprivedActive() ? RELIC.get(slot.relic.id) : null;
      if (rel) addEffect(m, rel.name, rel.taxo, "relic");
      for (const sp of slotNetherSpells(slot)) addEffect(m, sp.name, sp.taxo, "nether spell");
      if (m.tags.size) members.push(m);
    });
    return members;
  }
  // list data: one entry per individual EFFECT (perk / anoint / trait / spell) with its description
  function buildTagEffects() {
    const effects = [];   // {name, desc, tags:[], owner, kind}
    const push = (name, desc, taxo, owner, kind) => { const tags = synTags(taxo); if (tags.length) effects.push({ name, desc, tags, owner, kind }); };
    if (build.specId != null) { const s = SPEC.get(build.specId); if (s) for (const p of allocatedPerks(s)) push(p.name, perkText(p.desc, perkRank(s, p)), p.taxo, s.label, "Perk"); }
    for (const a of equippedAnointObjs()) push(a.name, perkText(a.desc, a.ranks), a.taxo, a.spec || "Anointment", "Anointment");
    for (const slot of build.slots) {
      const c = CREA.get(slot.cid); if (!c) continue;
      for (const tid of slotTraitIds(slot)) { const tr = TRAIT[tid]; if (tr) push(tr.name, richText(tr.desc || ""), tr.taxo, c.name, "Trait"); }
      for (const gid of slot.spellGemIds || []) { const g = spellGems.find(x => x.id === gid); const sp = g ? gemSpell(g) : null; if (sp) push(sp.name, richText(sp.desc || ""), sp.taxo, c.name, "Spell"); }
      const rel = slot.relic && !deprivedActive() ? RELIC.get(slot.relic.id) : null;
      if (rel) push(rel.name, rel.ranks.map(r => r.desc).join(" · "), rel.taxo, c.name, "Relic");
      for (const sp of slotNetherSpells(slot)) push(sp.name, richText(sp.desc || ""), sp.taxo, c.name, "Spell");
    }
    return effects;
  }

  // ── Threats advisor — realm properties + False God runes to avoid for the detected build theme ──
  const THEMES = D.buildThemes || [];
  const themeLabel = (k) => { const t = THEMES.find(x => x.key === k); return t ? t.label : k; };
  // tally how many build effects touch each theme's tags (reuses the synergy effect gathering)
  function detectBuildThemes() {
    const w = {};
    for (const e of buildTagEffects()) {
      const set = new Set(e.tags);
      for (const t of THEMES) if (t.tags.some(tag => set.has(tag))) w[t.key] = (w[t.key] || 0) + 1;
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
    ].join("");
    return `<div class="thr-row">
      <span class="thr-src ${m.source === "Rune" ? "rune" : "realm"}">${m.source}</span>
      <div class="thr-body"><div class="thr-head"><b>${esc(m.name)}</b>${chips}</div>
        <div class="thr-eff">${esc(m.effect)}</div></div></div>`;
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
      <button class="av-tab ${srcView === "realm" ? "on" : ""}" data-action="threat-src" data-v="realm">Realm Props</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${srcView === "fgod" ? "on" : ""}" data-action="threat-src" data-v="fgod">False God</button></div>`;
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
      <div class="overlay-header"><h2>Threats</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">
        <div class="thr-themebar">${themeSelect}</div>
        ${srcToggle}
        <div class="section-label">Counters your build</div>
        <div class="thr-list">${countersBody}</div>
        <button class="thr-genhead ${st.showGeneral ? "open" : ""}" data-action="threat-general">${st.showGeneral ? "▾" : "▸"} Generally punishing <span class="thr-w">${general.length}</span></button>
        ${st.showGeneral ? `<div class="thr-list">${genRows}</div>` : ""}
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
        return `<div class="perk-line${go ? " apx-clickable" : ""}"${go}>${shopItemIcon(it)}
          <div class="perk-line-body"><div class="perk-line-head"><b${nmTitle}>${esc(it.name || "?")}</b>
            <span class="perk-line-meta">${it.rank != null ? `<span class="anoint-spec-tag" title="Guild Reputation rank">Rank ${it.rank}</span>` : ""}${it.price != null ? `<span class="gs-price"${cur ? ` title="${esc(cur)}"` : ""}>${it.price}${curIco ? `<span class="gs-cur-ico">${spriteImg(curIco, "px")}</span>` : cur ? ` <span class="gs-cur">${esc(cur)}</span>` : ""}</span>` : ""}</span></div>
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
      body = `${shopToggle(shop.key)}<div class="ovl-center-scroll"><div class="pick-grid gs-grid">${tiles}</div></div>`;
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
        <ul><li><b>Class of</b> a spell or creature</li><li><b>Ruler of</b> a realm</li><li><b>Realm of</b> a ruler (god)</li></ul></div>`;
    } else {
      const byName = (k) => (a, b) => rank(a[k]) - rank(b[k]) || a[k].localeCompare(b[k]);
      const spells = D.spells.filter(s => nrm(s.name).includes(q)).sort(byName("name")).slice(0, CAP).map(s => row(s.name, clsAns(s.cls)));
      // Avatars (gods) are only ever asked about their REALM, never their class → exclude them from class lookups
      const creatures = D.creatures.filter(c => !isAvatar(c) && nrm(c.name).includes(q)).sort(byName("name")).slice(0, CAP).map(c => row(c.name, clsAns(c.cls)));
      const realms = D.realms.filter(r => nrm(r.realm).includes(q)).sort(byName("realm")).map(r => row(r.realm, `<span class="riddle-a">${esc(r.godName)}</span>`));
      const gods = D.realms.filter(r => nrm(r.godName).includes(q) || nrm(r.god).includes(q)).sort(byName("godName")).map(r => row(r.godName, `<span class="riddle-a">${esc(r.realm)}</span>`));
      body = section("Class of Spell", spells) + section("Class of Creature", creatures) + section("Ruler of Realm", realms) + section("Realm of Ruler", gods)
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

  // ── Glossary — Buff / Debuff / Minion reference (name + prose + in-game status glyph from the game). ──
  function openGlossary() {
    ovState = { kind: "glossary", search: "", collapsed: new Set(), render: renderGlossary };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const GLOSSARY_CATS = ["Buff", "Debuff", "Minion"];
  function renderGlossary() {
    const st = ovState, q = st.search.trim().toLowerCase(), all = D.conditions || [];
    const match = (e) => !q || e.name.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q);
    const list = all.filter(match);
    // exclusivity glyph stacked below the status icon: minions summoned by only one spec/spell/creature
    // carry that source's emblem (spec emblem, creature sprite, or class gem). `show:false` keeps the
    // record but withholds the badge (Guardian of Surathli — no emblem art yet).
    const exclBox = (e) => (e.exclusive && e.exclusive.show && e.exclusive.icon)
      ? `<div class="apx-crea apx-excl" title="Exclusive to ${esc(e.exclusive.source)}">${spriteImg(e.exclusive.icon, "px")}</div>`
      : "";
    // collapsible category headers (same style as the Appendix) + large icon on the left of each row
    const body = GLOSSARY_CATS.map(c => {
      const items = list.filter(e => e.cat === c);
      if (!items.length) return "";
      const open = q ? true : !st.collapsed.has(c);
      const rows = open ? `<div class="perk-list">${items.map(e => `<div class="perk-line apx-clickable" data-action="apx-open" data-ek="condition" data-eid="${esc(e.cat + ':' + e.key)}" title="View taxonomy">
        <div class="apx-iconcol">${e.icon ? `<div class="apx-crea"><img src="${esc(e.icon)}" alt=""></div>` : ""}${exclBox(e)}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(e.name)}</b></div><div class="perk-desc">${esc(e.desc)}</div></div></div>`).join("")}</div>` : "";
      return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${esc(c)}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>${esc(c)}s</button>${rows}`;
    }).join("") || `<div class="slot-sub" style="padding:10px">No buff, debuff or minion matches “${esc(st.search)}”.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Glossary</h2>
        <input class="ovl-search" placeholder="Search buffs / debuffs / minions…" value="${esc(st.search)}" data-action="gloss-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
  }

  // ── Realms reference ────────────────────────────────────────────────────────
  function openRealms(realmId) {
    ovState = { kind: "realms", search: "", sortBy: "realm", mode: "list", cmpExpanded: new Set(),
      favorRank: 100, showCommon: false, favorView: "bars", useCustom: favorPrefs.use, editingRanks: false,
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
  // value of column at flat index `i` for a realm at a given favor rank
  const favVal = (realm, i, rank = favRank()) => { const m = realm.favor; if (!m) return null; const row = m[rank] || m[100]; return row ? row[i] : null; };
  function fmtFav(col, v) { if (v == null || v === 0) return "—"; const n = Number.isInteger(v) ? v : +(+v).toFixed(2);
    return col.unit === "%" ? `${n}%` : col.unit === "bool" ? "✓" : `${n}`; }
  // bar fill % for a unique column (scaled to the rank-100 cross-realm max so bars grow with the rank)
  function favBarPct(col, v) { const max = (D.favorColMax && D.favorColMax[col.key]) || 1;
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
    const list = rs.filter(match).sort((a, b) => st.sortBy === "god"
      ? a.godName.localeCompare(b.godName) || a.realm.localeCompare(b.realm)
      : a.realm.localeCompare(b.realm));
    // the Realm | God toggle also picks the icon: Realm → realm icon, God → god battle sprite
    const heroIco = (x) => st.sortBy === "god" ? (x.godBattle || x.icon) : (x.icon || x.godBattle);
    const rows = list.map(r => `<button class="realm-row" data-action="realm-sel" data-id="${r.id}">
      <span class="realm-icon">${heroIco(r) ? spriteImg(heroIco(r), "px") : ""}</span>
      <span class="opt-dot" style="background:${clsColor(r.cls)}"></span>
      <span class="realm-row-name">${esc(r.realm)}</span>
      <span class="anoint-spec-tag">${esc(r.godName)}</span>
      <span class="opt-chev">›</span></button>`).join("")
      || `<div class="slot-sub" style="padding:10px">No realms match.</div>`;
    const sortToggle = `<div class="art-view-toggle">
      <button class="av-tab ${st.sortBy === "realm" ? "on" : ""}" data-action="realm-sort" data-v="realm">Realm</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${st.sortBy === "god" ? "on" : ""}" data-action="realm-sort" data-v="god">God</button></div>`;
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
    }).join("") : `<div class="slot-sub" style="padding:12px">No unique bonuses yet${q ? ` matching “${esc(st.search)}”` : ""}.</div>`;
    const intro = uc
      ? `Each realm's Unique Bonuses at <b>your</b> tracked favor rank. Tap ⚙ to edit ranks; tap a realm to open it.`
      : `Each realm's Unique Bonuses at favor rank <b data-favrank-text>${favRank()}</b>. Tap a category to rank realms; tap a realm to open it.`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Realms</h2>
        <input class="ovl-search" placeholder="Search category / realm…" value="${esc(st.search)}" data-action="realm-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="rcmp-controls">${realmModeToggle("compare")}${rankSourceCtl()}${uc ? "" : favorSlider()}
        <div class="slot-sub" style="margin:0">${intro}</div></div>
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
    const critChip = (e) => { const ic = D.raceIcons && D.raceIcons[e.name];
      return `<span class="realm-race" title="${esc(e.via ? e.cat + " — " + e.via : e.cat)}">${ic ? spriteImg(ic, "px") : ""}<span>${esc(e.name)}</span><span class="realm-cat cat-${e.cat.replace(/\s+/g, "").toLowerCase()}">${esc(e.cat)}</span></span>`; };
    const creatures = critEntries.length ? `<div class="section-label">Creatures</div>
      <div class="realm-crits">${critEntries.map(critChip).join("")}</div>` : "";
    const encounters = "";
    const resources = sel.resources.length ? `<div class="section-label">Resources</div>
      <div class="prop-list">${sel.resources.map(e => `<div class="prop-row static"><span class="prop-name">${esc(e.object)}</span><span class="prop-stat">${esc(e.resource)}</span></div>`).join("")}</div>` : "";
    // Realm Objects — the interactable world objects (name + spawn count + rank-0 base interaction).
    const objects = sel.objects.length ? `<div class="section-label">Realm Objects</div>
      <div class="realm-objlist">${sel.objects.map(o => `<div class="realm-objrow">
        <span class="realm-obj-ico">${o.sprite ? spriteImg(o.sprite, "px") : ""}</span>
        <span class="realm-objrow-name">${esc(o.name)}${o.baseCount != null ? ` <span class="realm-obj-ct">×${o.baseCount}</span>` : ""}</span>
        <span class="realm-objrow-base">${o.base ? esc(o.base) : ""}</span></div>`).join("")}</div>` : "";
    // What makes this realm unique — the Favor_MTX Unique Bonuses at the selected favor rank. The rank slider
    // scrubs 0→100; the common-bonuses toggle also shows the Generic Bonuses (shared by every realm).
    // Two ways to read the favor track (toggle), both driven by the rank slider: BARS = magnitude values at the
    // rank; LIST = the unlock schedule condensed to rank (unique blessing tiers interleaved with the common track).
    // In "My ranks" mode the slider shows/edits THIS realm's tracked favor rank (persisted).
    const rank = rankFor(sel);
    const uCols = favUnique(), gCols = favGeneric();
    const view = ovState.favorView || "bars";
    const commonToggle = `<label class="fav-common"><input type="checkbox" data-action="realm-common" ${ovState.showCommon ? "checked" : ""}> Show common (all-realm) bonuses</label>`;
    const viewToggle = `<div class="art-view-toggle" style="margin:2px 0 8px">
      <button class="av-tab ${view === "bars" ? "on" : ""}" data-action="realm-favview" data-v="bars">Bars</button>
      <span class="av-pipe">|</span>
      <button class="av-tab ${view === "list" ? "on" : ""}" data-action="realm-favview" data-v="list">List</button></div>`;
    const rankNote = ovState.useCustom ? `<div class="slot-sub" style="margin:-4px 0 6px">Tracking <b>your</b> favor rank for this realm — drag to update it (saved).</div>` : "";
    const barsView = `${favorSlider(rank)}${rankNote}${commonToggle}
      <div class="rcat-list">${uCols.map((c, i) => { const v = favVal(sel, i, rank);
        return `<div class="rcat-row rcat-static${v ? "" : " rcat-empty"}" data-rid="${sel.id}" data-ci="${i}"><span class="rcat-name">${esc(c.label)}</span>${favBar(c, v)}</div>`; }).join("")}</div>
      ${ovState.showCommon ? `<div class="section-label">Common bonuses (every realm)</div>
        <div class="slot-sub" style="margin:-2px 0 6px">Shared favor-rank rewards from the generic track — identical across all realms.</div>
        <div class="rcat-list">${gCols.map((c, j) => { const i = uCols.length + j, v = favVal(sel, i, rank);
          return `<div class="rcat-row rcat-static rcat-generic${v ? "" : " rcat-empty"}" data-rid="${sel.id}" data-ci="${i}"><span class="rcat-name">${esc(c.label)}</span><span class="rcat-val rcat-val-wide">${fmtFav(c, v)}</span></div>`; }).join("")}</div>` : ""}`;
    // LIST view: the god's Favor Reward track condensed to `rank`. Blessing ranks show this realm's unique effect
    // (sel.traits joined by rank); every other rank shows the common bonus from Favor_REF (hidden unless toggled).
    const traitByAt = {}; (sel.traits || []).forEach(t => { traitByAt[t.at] = t.effect; });
    const tierRows = (D.favorCommon || []).filter(c => ovState.showCommon || c.blessing).map(c => {
      const uniq = c.blessing, eff = uniq ? (traitByAt[c.rank] || c.effect) : c.effect;
      return `<div class="fav-tier${uniq ? " fav-tier-uniq" : ""}" data-rank="${c.rank}"${c.rank <= rank ? "" : ` style="display:none"`}><span class="fav-tier-rk">${c.rank}</span><span class="fav-tier-eff">${esc(eff)}</span>${uniq ? `<span class="fav-tier-tag">unique</span>` : ""}</div>`;
    }).join("");
    const listView = `${favorSlider(rank)}${rankNote}${commonToggle}
      <div class="slot-sub" style="margin:-2px 0 6px">The god's favor reward track up to rank <b data-favrank-text>${rank}</b>. ${ovState.showCommon ? "Unique tiers highlighted; the rest are shared by every realm." : "Unique tiers only — enable common bonuses for the full track."}</div>
      <div class="fav-tiers">${tierRows}</div>`;
    const profile = `<div class="section-label">What makes this realm unique</div>${viewToggle}${view === "list" ? listView : barsView}`;
    const other = "";
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
        ${profile}${other}${objects}${creatures}${encounters}${resources}${combos}
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
      `<th><div class="xref-colhead"><span class="xc-dot ${shareClass(k)}"></span><span class="xc-name" title="${esc(taxoCatName(k))} → ${esc(taxoValName(k))}">${esc(taxoValName(k))}</span></div></th>`).join("")}</tr></thead>`;
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
  function anointList() {
    if (ANOINTS) return ANOINTS;
    ANOINTS = [];
    // Exclude Highborn (Royal's cap-raiser — works only in your own spec tree, not as an anoint) and any
    // spec with no affiliated False God (removes the "Other" group — Highborn was its only member).
    for (const s of D.specs) for (const p of s.perks)
      if (p.anointment && s.falseGod && p.key !== "HIGHBORN")
        ANOINTS.push({ ...p, spec: s.label, specId: s.id, falseGod: s.falseGod });
    ANOINTS.sort((a, b) => a.spec.localeCompare(b.spec) || a.name.localeCompare(b.name));
    return ANOINTS;
  }
  const anointEquipped = (a) => build.anoints.some(x => x.specId === a.specId && x.key === a.key);
  const equippedAnointObjs = () => build.anoints.map(x => anointList().find(a => a.specId === x.specId && a.key === x.key)).filter(Boolean);
  function openAnoint() {
    ovState = { kind: "anoint", search: "", taxoFilters: [], specFilter: null, godFilter: null, collapsedGods: [], render: renderAnoint };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  let ANOINT_SPECS = null;
  const anointSpecs = () => ANOINT_SPECS || (ANOINT_SPECS = [...new Set(anointList().map(a => a.spec))].sort());
  const anointTaxoIndex = () => taxoIndexFor("anoint", anointList(), a => a.taxo || []);
  function renderAnoint() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const list = anointList().filter(a =>
      (!q || a.name.toLowerCase().includes(q) || (a.desc || "").toLowerCase().includes(q)) &&
      (!st.godFilter || a.falseGod === st.godFilter) &&
      (!st.specFilter || a.spec === st.specFilter) &&
      (!st.bkOnly || bookmarks.perks.includes(a.key)) &&
      (!st.taxoFilters.length || st.taxoFilters.every(k => (a.taxo || []).includes(k))));
    const godChip = st.godFilter
      ? `<button class="facet on" data-action="anoint-fgod">False God: <b>${esc(godName(st.godFilter))}</b> <span class="facet-x" data-action="anoint-fgod-clear">✕</span></button>`
      : `<button class="facet" data-action="anoint-fgod">False God ▾</button>`;
    const specChip = st.specFilter
      ? `<button class="facet on" data-action="anoint-spec">Spec: <b>${esc(st.specFilter)}</b> <span class="facet-x" data-action="anoint-spec-clear">✕</span></button>`
      : `<button class="facet" data-action="anoint-spec">Spec ▾</button>`;
    const taxoChips = st.taxoFilters.map((k, i) =>
      `<button class="facet on tag" data-action="rm-taxo" data-i="${i}">${esc(taxoCatName(k))}: <b>${esc(taxoValName(k))}</b> <span class="facet-x">✕</span></button>`).join("");
    const bkChip = bookmarks.perks.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="anoint-bkonly" title="Show only bookmarked perks">★ Bookmarked</button>` : "";
    const filterbar = `<div class="ovl-filterbar">${godChip}${specChip}${taxoChips}<button class="facet add" data-action="anoint-taxo">＋ Filter</button>${bkChip}</div>`;
    const full = build.anoints.length >= anointMax();
    const anointRow = (a) => { const on = anointEquipped(a); const inCur = a.specId === build.specId;
      // a perk from your current spec is already in your tree — block anointing it (removal still allowed)
      const btn = (inCur && !on)
        ? `<button class="slot-mini anoint-eq" disabled title="Already available in your current specialization">In your spec</button>`
        : `<button class="slot-mini anoint-eq ${on ? "on" : ""}" data-action="anoint-toggle" data-sid="${a.specId}" data-k="${esc(a.key)}" ${(!on && full) ? "disabled" : ""}>${on ? "Equipped ✓" : "Equip"}</button>`;
      return `<div class="perk-line apx-clickable ${on ? "equipped" : ""} ${inCur ? "anoint-incur" : ""}" data-action="apx-open" data-ek="perk" data-eid="${esc(a.key)}">
        <span class="perk-ico sm">${a.icon ? spriteImg(a.icon, "px") : ""}</span>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta"><span class="anoint-spec-tag">${esc(a.spec)}</span>${inCur ? `<span class="anoint-badge">Current spec</span>` : ""}${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}</span>${bkBtn("perks", a.key)}</div>
          ${a.desc ? `<div class="perk-desc">${perkText(a.desc, a.ranks)}</div>` : ""}
        </div>
        ${btn}
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
      <div class="overlay-footer"><span class="foot-info">${build.anoints.length}/${anointMax()} equipped${full ? " · full" : ""}</span>
        <button class="btn-confirm" data-action="close-ovl">Done</button></div>
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
        <span class="perk-ico sm">${a.icon ? spriteImg(a.icon, "px") : ""}</span>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta"><span class="anoint-spec-tag">${esc(a.spec)}</span>${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}</span></div>
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
    ovState = { kind: "artlib", slotIdx, hideEquipped: false, sel: null, render: renderArtifactLibrary };
    openOverlay(ovState.render());
  }
  const libRow = (ico, name, sub) => `<div class="prop-row static"><span class="prop-ico">${ico ? spriteImg(ico, "px") : ""}</span><span class="prop-name">${esc(name)}</span>${sub ? `<span class="prop-stat">${esc(sub)}</span>` : ""}</div>`;
  // a row that also shows the granted trait's tooltip (for trait-item entries in info panels)
  const libTraitRow = (ico, name, traitId) => {
    const tr = traitId != null ? TRAIT[traitId] : null;
    // clickable → the trait's taxonomy detail (same as a creature's innate-trait banner)
    const open = tr ? ` data-action="apx-open" data-ek="trait" data-eid="${traitId}"` : "";
    return `<div class="prop-row static rich${tr ? " apx-clickable" : ""}"${open}><span class="prop-ico">${ico ? spriteImg(ico, "px") : ""}</span>
      <div class="prop-body"><span class="prop-name">${esc(name)}</span>
        ${tr ? `<span class="prop-stat">grants <b>${esc(tr.name)}</b></span><div class="trait-desc">${richText(tr.desc || "")}</div>` : ""}</div></div>`;
  };
  function artContentRows(a) {
    const r = [];
    if (a.primary) r.push(libRow(primaryIconAt(a.primary, a.rank), a.primary, "primary"));
    for (const n of a.stat || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, n)); }
    for (const n of a.trick || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, n)); }
    for (const id of a.traits || []) { const t = TRAITITEM.get(id); r.push(libTraitRow(t && t.icon, t ? t.name : id, t ? t.traitId : null)); }
    for (const id of a.spells || []) { const sp = SPELL.get(id); r.push(libRow(spellIcon(sp), sp ? sp.name : id, sp ? (sp.cls || "spell") : "spell")); }
    for (const id of a.netherIds || []) { const nn = nether.find(x => x.id === id); r.push(libRow(gemSrc(nn), nn ? nn.name : id, "nether")); }
    return r.join("") || `<div class="slot-sub" style="padding:8px">Empty artifact.</div>`;
  }
  // artifact TYPE (its primary property) → the trigger its native spell-gem slot fires on.
  // Nether-stone spells socketed into the artifact carry their own stored trigger instead.
  const ART_TYPE_TRIGGER = { Helmet: "On Provoke", Sword: "On Attack", Staff: "On Cast", Shield: "On Defend", Boots: "On Turn" };
  // aggregate an artifact's stat contribution at its rank: core 5 stats (% each) + any non-core "trick"
  // effects, keyed by their full property name ("Snared On Damage") with their unit (% or flat count).
  function artifactBonusRows(a) {
    const rank = a.rank || 50, core = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 }, extra = new Map();
    const addEntry = (prop, stat, unit, val) => {
      if (!val) return; const k = PROP_STAT[stat];
      if (k) { core[k] += val; return; }
      const cur = extra.get(prop) || { value: 0, unit: unit || "%" }; cur.value += val; extra.set(prop, cur);
    };
    if (a.primary) { const p = PRIMARY.find(x => x.property === a.primary); if (p) addEntry(a.primary, p.stat, "%", p.perRank[rank] || 0); }
    for (const name of [...(a.stat || []), ...(a.trick || [])]) { const g = propGroups.get(name); if (g) for (const e of g.entries) addEntry(name, e.stat, e.unit, e.perRank[rank] || 0); }
    for (const nid of a.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const pr of n.props || []) { if (pr.cat !== "stat" && pr.cat !== "trick") continue; const g = propGroups.get(pr.key);
        if (g) for (const e of g.entries) addEntry(pr.key, e.stat, e.unit, Number(pr.value) || 0); else addEntry(pr.key, pr.key, "%", Number(pr.value) || 0); } }
    return { core, extra };
  }
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
      .map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("");
  }
  // one spell-gem container: name + trigger + description (clickable to the spell's taxonomy)
  const spellGemCard = (sp, trigger, src) => `<div class="art-spellcard apx-clickable" data-action="apx-open" data-ek="spell" data-eid="${sp.id}" title="View taxonomy">
    <div class="art-spellcard-head"><span class="prop-ico">${spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""}</span>
      <b>${esc(sp.name)}</b>${trigger ? `<span class="art-trigger">${esc(trigger)}</span>` : ""}</div>
    ${src ? `<div class="slot-sub">from ${esc(src)}</div>` : ""}
    ${sp.desc ? `<div class="trait-desc">${perkText(sp.desc)}</div>` : ""}</div>`;
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
  const spellPickCard = (sp, chosen, attrs) => `<div class="pick-card${chosen ? " chosen" : ""}" ${attrs}>
    <div class="art-spellcard-head"><span class="prop-ico">${spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""}</span><b>${esc(sp.name)}</b>
      <button class="pick-card-src plain" data-action="apx-open" data-ek="spell" data-eid="${sp.id}" title="View taxonomy">tags ›</button></div>
    ${sp.desc ? `<div class="trait-desc">${perkText(sp.desc)}</div>` : ""}</div>`;
  // spell-gem containers for an artifact: native slot fires on the type trigger; nether stones keep their own
  function artifactSpellContainers(a) {
    const rows = [], typeTrig = ART_TYPE_TRIGGER[a.primary];
    for (const id of a.spells || []) { const sp = SPELL.get(id); if (sp) rows.push(spellGemCard(sp, typeTrig)); }
    for (const nid of a.netherIds || []) { const n = nether.find(x => x.id === nid); if (!n) continue;
      for (const pr of n.props || []) if (pr.cat === "spell") { const sp = SPELL.get(pr.key); if (sp) rows.push(spellGemCard(sp, pr.trigger, n.name)); } }
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
  function renderArtifactLibrary() {
    const st = ovState, manage = st.slotIdx == null;
    const slot = manage ? null : build.slots[st.slotIdx], c = slot ? CREA.get(slot.cid) : null;
    const equippedId = slot ? slot.artifactId : null;
    let list = artifacts;
    if (st.hideEquipped) list = list.filter(a => !artifactEquippedInBuild(a.id) || a.id === equippedId);
    const sel = st.sel != null ? artifacts.find(a => a.id === st.sel) : null;
    // tile equip-state: purple = equipped by THIS creature. Equipped by ANOTHER creature is dimmed +
    // not equippable in the equip wizard (mirrors an off-class spell); in manage/Menu mode it keeps the
    // neutral "equipped somewhere" marker so you can still edit/delete it.
    const tiles = list.map(a => {
      const eqHere = !manage && a.id === equippedId;
      const eqOtherRaw = !eqHere && artifactEquippedInBuild(a.id);
      const blocked = !manage && eqOtherRaw;    // equip wizard: on another creature → can't equip here
      const eqOther = manage && eqOtherRaw;     // library marker only
      const title = eqHere ? "Equipped by this creature" : blocked ? "Equipped by another creature — not available" : eqOther ? "Equipped by another creature" : "";
      return `
      <div class="pick-tile ${st.sel === a.id ? "selected" : ""}${eqHere ? " eq-here" : ""}${blocked ? " disabled" : ""}${eqOther ? " eq-other" : ""}" data-action="artlib-sel" data-id="${a.id}"${title ? ` title="${esc(title)}"` : ""}>
        <div class="pt-sprite">${spriteImg(artIcon(a), "px")}</div>
        <div class="pt-name">${esc(a.name)}</div></div>`; }).join("")
      || `<div class="slot-sub" style="padding:10px">No artifacts${st.hideEquipped ? " match" : " yet — build one"}.</div>`;
    const equippedHere = sel && equippedId === sel.id;
    let info;
    if (sel) {
      // two views: Bonuses (resolved stat table + trait & spell-gem containers) | Sockets (raw socketed items)
      const view = st.artView === "sockets" ? "sockets" : "bonuses";
      const toggle = `<div class="art-view-toggle">
        <button class="av-tab ${view === "bonuses" ? "on" : ""}" data-action="art-view" data-v="bonuses">Bonuses</button>
        <span class="av-pipe">|</span>
        <button class="av-tab ${view === "sockets" ? "on" : ""}" data-action="art-view" data-v="sockets">Sockets</button></div>`;
      const viewBody = view === "sockets" ? `<div class="prop-list">${artContentRows(sel)}</div>` : artifactBonusView(sel);
      const otherNote = !manage && !equippedHere && artifactEquippedInBuild(sel.id)
        ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">Equipped by another creature — unequip it there first to use it here.</div>` : "";
      info = `<div class="ns-info-head"><span class="ns-info-icon">${spriteImg(artIcon(sel), "px")}</span><h3>${esc(sel.name)}</h3></div>
        ${otherNote}${toggle}${viewBody}`;
    }
    // footer selector bar (mirrors Builds): Edit/Delete act on the selection; the confirm button
    // switches between Equip (artifact selected, equip mode) and ＋ Build new artifact (none selected).
    const selBlocked = !manage && sel && !equippedHere && artifactEquippedInBuild(sel.id);   // on another creature
    const canEquip = !manage && sel && !selBlocked;
    // single context-aware primary button: Unequip (this one is equipped) / Equip (a different selection) /
    // Build (manage mode, or nothing selected to equip).
    const confAction = !canEquip ? "art-new" : equippedHere ? "art-unequip" : "art-equip";
    const confLabel = !canEquip ? "Build" : equippedHere ? "Unequip" : "Equip";
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Artifacts${manage ? "" : " — " + esc(c ? c.name : "")}</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect"><div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
        ${sel ? `<div class="ovl-right lib-info">${info}</div>` : ""}
      </div>
      <div class="overlay-footer"><button class="facet ${st.hideEquipped ? "on" : ""}" data-action="artlib-hide-equipped">Hide equipped</button>
        <div>
          <button class="btn-ghost" data-action="art-edit" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Edit</button>
          <button class="btn-ghost danger" data-action="art-del" data-id="${sel ? sel.id : ""}" ${sel ? "" : "disabled"}>Delete</button>
          ${selBlocked
            ? `<button class="btn-confirm" style="min-width:96px" disabled title="Equipped by another creature">Can't equip</button>`
            : `<button class="btn-confirm" style="min-width:96px" data-action="${confAction}"${confAction === "art-equip" ? ` data-id="${sel.id}"` : ""}>${confLabel}</button>`}
        </div></div>
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
  // artifact slots step — right-hand info panel: picker list › item preview (confirm) › live bonus
  const artSlotKey = (type) => (ART_SLOTS.find(s => s.pick === type) || {}).key;
  const artHas = (a, type, v) => (a[artSlotKey(type)] || []).includes(v);
  function renderArtPicker(st, a, rank) {
    const type = st.pickType, q = st.search.trim().toLowerCase();
    // only single-slot types (trait/spell/nether) mark a row "chosen"; multi-slot types
    // (stat/trick) allow the same item in several slots, so never grey it out
    const single = ((ART_SLOTS.find(s => s.pick === type) || {}).max || 1) === 1;
    const has = (v) => single && artHas(a, type, v);
    const matchTaxo = (taxo) => q && (taxo || []).some(k => taxoValName(k).toLowerCase().includes(q));
    let rows = "";
    if (type === "stat" || type === "trick") {
      const pool = type === "stat" ? STATMAT : TRICKMAT;
      rows = pool.filter(m => !q || m.name.toLowerCase().includes(q) || m.property.toLowerCase().includes(q)).map(m => {
        const g = propGroups.get(m.property);
        const val = g ? propEffectText(g, rank) : esc(m.property);   // adds on click — no drill-in/confirm
        return `<div class="prop-row ${has(m.property) ? "chosen" : ""}" data-action="art-confirm-add" data-t="${type}" data-v="${esc(m.property)}">
          <span class="prop-ico">${m.icon ? spriteImg(m.icon, "px") : ""}</span>
          <span class="prop-name">${esc(m.name)}</span><span class="prop-stat">${esc(val)}</span></div>`;
      }).join("");
    } else if (type === "trait") {
      // clean trait containers (banner + description + material link) that add on click — no drill-in
      rows = D.traitItems.filter(t => t.traitName
          && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q) || matchTaxo(t.taxo))
          && (!st.traitTaxo || (t.taxo || []).includes(st.traitTaxo))
          && (!st.bkOnly || bookmarks.traits.includes(t.traitId))).slice(0, 300)
        .map(t => traitPickCard(t, has(t.id), `data-action="art-confirm-add" data-t="trait" data-v="${t.id}"`)).join("");
    } else if (type === "spell") {   // raw spells (no sockets), like nether stones
      rows = (D.spells || []).filter(sp => (!q || sp.name.toLowerCase().includes(q) || (sp.desc || "").toLowerCase().includes(q) || matchTaxo(sp.taxo))
          && (!st.bkOnly || bookmarks.spells.includes(sp.id))).slice(0, 300)
        .map(sp => spellPickCard(sp, has(sp.id), `data-action="art-confirm-add" data-t="spell" data-v="${sp.id}"`)).join("");
    } else {
      rows = nether.filter(n => !q || n.name.toLowerCase().includes(q)).map(n => `<div class="prop-row ${has(n.id) ? "chosen" : ""}" data-action="art-preview" data-t="nether" data-v="${n.id}">
          <span class="prop-ico">${spriteImg(gemSrc(n), "px")}</span>
          <span class="prop-name">${esc(n.name)}</span></div>`).join("")
        || `<div class="slot-sub" style="padding:8px">No Nether Stones yet — add them from the top-bar “Nether Stones” button.</div>`;
    }
    const traitFilter = type === "trait"
      ? (st.traitTaxo
          ? `<button class="facet on tag" data-action="artb-traitfilter-clear">${esc(taxoCatName(st.traitTaxo))}: <b>${esc(taxoValName(st.traitTaxo))}</b> <span class="facet-x">✕</span></button>`
          : `<button class="facet add" data-action="artb-traitfilter">＋ Filter</button>`)
      : "";
    const bkKind = type === "trait" ? "traits" : type === "spell" ? "spells" : null;
    const bkFilter = bkKind && bookmarks[bkKind].length
      ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="artb-bkonly" title="Show only bookmarked ${type === "trait" ? "traits" : "spells"}">★ Bookmarked</button>` : "";
    const label = (ART_SLOTS.find(s => s.pick === type) || {}).label || "";
    return `<div class="art-side-head"><b>Add ${esc(label)}</b><button class="chip" data-action="artb-closecat">Done</button></div>
      <input class="ovl-search art-side-search" placeholder="Search by name or tag…" value="${esc(st.search)}" data-action="artb-search">
      ${traitFilter || bkFilter ? `<div class="art-side-filter">${traitFilter}${bkFilter}</div>` : ""}
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
      lines = tr ? `<div class="primary-traits">${traitBanner(t.traitId)}<div class="trait-desc">${richText(tr.desc || "")}</div></div>`
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
      body = `<div class="ovl-center"><div class="ovl-center-scroll">
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
        else if (type === "nether") { const n = nether.find(x => x.id === v); ico = `<div class="as-ico">${spriteImg(gemSrc(n), "px")}</div>`; lab = n ? n.name : v; sub = "nether"; }
        return `<div class="art-slot"><button class="as-rm" data-action="art-rm" data-t="${type}" data-i="${idx}">✕</button>${ico}<div class="as-lab">${esc(lab)}</div><div class="as-sub">${esc(sub)}</div></div>`;
      };
      const primaryBox = a.primary
        ? (() => `<div class="art-slot primary"><div class="as-ico">${spriteImg(primaryIconAt(a.primary, a.rank), "px")}</div><div class="as-lab">${esc(a.primary)}</div><div class="as-sub">primary</div></div>`)()
        : `<div class="art-slot add" data-action="artb-back"><div class="as-ico glyph">＋</div><div class="as-lab">Primary</div></div>`;
      const groupsHtml = [`<div class="art-slot-group"><div class="section-label">Primary</div><div class="art-slot-grid">${primaryBox}</div></div>`]
        .concat(ART_SLOTS.map(sl => {
          const arr = a[sl.key] || [];
          const boxes = [];
          for (let i = 0; i < sl.max; i++) boxes.push(arr[i] !== undefined ? filledBox(sl.pick, arr[i], i)
            : `<div class="art-slot add ${st.pickType === sl.pick ? "picking" : ""}" data-action="art-slot" data-t="${sl.pick}"><div class="as-ico glyph">＋</div><div class="as-lab">${sl.label}</div></div>`);
          return `<div class="art-slot-group"><div class="section-label">${sl.label}</div><div class="art-slot-grid">${boxes.join("")}</div></div>`;
        })).join("");

      // info panel (right): item preview (confirm) › picker list › live bonus — never appended below the slots
      let side;
      if (st.preview) {
        const psl = ART_SLOTS.find(s => s.pick === st.preview.type) || {};
        const parr = a[psl.key] || [];
        const equipped = psl.max === 1 && parr[0] === st.preview.value;   // single-slot toggle-off
        const full = parr.length >= psl.max && !equipped;
        side = renderArtPreview(st.preview.type, st.preview.value, rank, { equipped, full });
      }
      else if (st.pickType) side = renderArtPicker(st, a, rank);
      else side = renderArtLiveBonus(a, rank);
      body = `<div class="ovl-center"><div class="ovl-center-scroll">${groupsHtml}</div></div>
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
  function openRelicBuilder(slotIdx) {
    ovState = { kind: "relic", slotIdx, search: "", taxoFilters: [], render: renderRelicBuilder };
    openOverlay(ovState.render());
  }
  // List overlay: a tile grid like the God Shop / creature selector, sectioned by the stat each relic boosts.
  function renderRelicBuilder() {
    const st = ovState, c = CREA.get(build.slots[st.slotIdx].cid);
    const equipped = build.slots[st.slotIdx].relic;
    const q = st.search.trim().toLowerCase();
    const list = D.relics.filter(r => (!q || r.name.toLowerCase().includes(q) || (r.statBonus || "").toLowerCase().includes(q)) && taxoMatch(st, r));
    // one section per stat, in the app's canonical stat order; picking a tile opens the rank overlay
    const sections = STAT_KEYS.map(k => {
      const label = STAT_LABEL[k];
      const rels = list.filter(r => r.statBonus === label);
      if (!rels.length) return "";
      const tiles = rels.map(r => `<div class="pick-tile ${equipped && equipped.id === r.id ? "selected" : ""}" data-action="relic-pick" data-id="${r.id}">
        <div class="pt-sprite">${r.icon ? spriteImg(r.icon, "px") : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="pt-name">${esc(relicShortName(r))}</div></div>`).join("");
      return `<div class="section-label">${esc(label)}</div><div class="pick-grid relic-grid">${tiles}</div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Relic — ${esc(c ? c.name : "")}</h2>
        <input class="ovl-search" placeholder="Search relic / stat…" value="${esc(st.search)}" data-action="relic-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-filterbar">${taxoFilterBar(st)}</div>
        <div class="ovl-center-scroll">${sections || `<div class="slot-sub" style="padding:10px">No relics match.</div>`}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div>${equipped ? `<button class="btn-ghost" data-action="relic-clear">Clear equipped</button>` : ""}
        <button class="btn-confirm" data-action="close-ovl">Done</button></div></div>
    </div></div>`;
  }
  // Second full-screen overlay: rank slider + per-rank effects for the picked relic.
  function openRelicDetail(relicId) {
    const equipped = build.slots[ovState.slotIdx].relic;
    const rank = equipped && equipped.id === relicId ? equipped.rank : 50;
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
        <span class="prop-stat" style="flex:1;text-align:left">${richText(rk.desc)}</span></div>`;
      // if this rank casts a named spell, show its spell-gem container (icon + description) beneath the row
      const cards = spellsCastInText(rk.desc).map(sp => spellGemCard(sp)).join("");
      return cards ? row + `<div class="relic-cast-spells">${cards}</div>` : row;
    }).join("");
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><button class="btn-ghost" data-action="relic-back">‹ Relics</button>
        <h2 style="flex:1">${esc(sel.name)}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center">
        <div class="gs-detail-head apx-clickable" data-action="apx-open" data-ek="relic" data-eid="${sel.id}" title="View taxonomy">
          ${sel.icon ? `<div class="gs-god-sprite">${spriteImg(sel.icon, "px")}</div>` : ""}
          <div class="gs-god-name">${esc(sel.name)} <span class="etax-hint">tags ›</span></div>
          <div class="slot-sub">Boosts ${esc(sel.statBonus || "—")}</div></div>
        <div class="ovl-filterbar rank-picker"><span class="slot-sub">Rank</span>
          <input type="range" min="10" max="${maxRank}" step="10" value="${st.rank}" data-action="relic-rank"><span class="rank-badge">${st.rank}</span></div>
        <div class="ovl-center-scroll">${ranks}</div>
      </div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="relic-back">‹ Back</button>
        <button class="btn-confirm" data-action="relic-confirm">Save Relic</button></div>
    </div></div>`;
  }

  // ── Macro Proposal — predict a creature's battle-AI "brain" from its loadout ────────────────
  // In-game, a Macro is an ordered list of conditional lines a creature uses to pick its turn action
  // (see _su_extract/code/MACRO_MODEL.md). We read the slot's equipped spells + traits + stats, classify
  // each spell by purpose/side/breadth from its taxonomy, infer the creature's role, and emit lines a
  // player can replicate in the in-game Macro editor so battles can be automated (default action = Macro).
  // This is a heuristic PROPOSAL, not a guaranteed-optimal brain — the game's real vocabulary is D.macroVocab.

  // ── Tuning knobs — every magic number the proposal engine uses, in one place. Adjust freely; percentages
  // are % Health, counts are creature/status counts. See MACRO_RULES below for where each is applied. ──
  const MACRO_TUNING = {
    maxLines: 32,          // in-game macro line cap (scr_MacroIsLegal 0x20 guard)
    healEmergency: 25,     // % Health — cast an emergency heal on an ally below this
    healSustain: 50,       // % Health — top-up heal on an ally below this
    finishHp: 25,          // % Health — "finish the kill" trigger (spell + basic attack)
    selfPreserveHp: 25,    // % Health — a squishy caster with no heal defends below this
    buffFloor: 1,          // cast a buff on an ally with fewer than this many buffs
    debuffFloor: 1,        // cast a debuff on an enemy with fewer than this many debuffs
    minionCap: 3,          // summon while the creature has fewer than this many minions
    aoeMaxThreshold: 3,    // AoE enemy-count gate escalates per extra AoE gem, capped here
    // single-target focus priorities; each damage gem cycles through these so multiple gems each get a
    // live, distinct focus line. Reorder / extend to change targeting preference.
    focusRotation: [
      { cond: "has lowest Max Health", why: "finish the enemy with the smallest health pool" },
      { cond: "has highest Attack", why: "kill the biggest physical threat" },
      { cond: "has highest Intelligence", why: "kill the biggest spell threat" },
      { cond: "has lowest Defense", why: "hit whoever takes the most damage" },
      { cond: "has highest Max Health", why: "chip down the toughest enemy" },
    ],
  };
  // Per-spell classification overrides — force a purpose/side/multi for spells the taxonomy mislabels or that
  // need bespoke handling. Keyed by spell NAME (stable, human-readable). Empty by default; add as needs surface
  // (e.g. Antidote is tagged "Healing" but really cures debuffs → { "Antidote": { purpose: "cleanse" } }).
  const SPELL_OVERRIDES = {};
  // classify one spell → { sp, name, purpose, side, multi } (taxonomy-driven, then per-spell override)
  function classifySpell(sp) {
    const tx = sp.taxo || [], am = (v) => tx.includes("Action/Mechanic::" + v), rs = (v) => tx.includes("Related Spells::" + v);
    const multi = rs("Multi-Target Spells");
    const statUp = tx.includes("Affect on Stats::Stat is Increased");
    const statDown = tx.includes("Affect on Stats::Stat is Decreased");
    let purpose, side;
    if (am("Resurrection")) { purpose = "rez"; side = "ally"; }
    else if ((am("Healing") || rs("Healing Spells")) && !rs("Damaging Spells")) { purpose = "heal"; side = "ally"; }
    else if (rs("Damaging Spells") || am("Attack") || am("Indirect Damage")) { purpose = "damage"; side = "enemy"; }
    else if (am("Debuff") || (am("Stats") && statDown && !statUp)) { purpose = "debuff"; side = "enemy"; }
    else if (am("Buff") || (am("Stats") && statUp)) { purpose = "buff"; side = "ally"; }
    else if (am("Provoke")) { purpose = "provoke"; side = "self"; }
    else if (am("Defend")) { purpose = "defend"; side = "self"; }
    else if (am("Minion")) { purpose = "summon"; side = "ally"; }
    else { purpose = "other"; side = null; }
    const o = SPELL_OVERRIDES[sp.name] || {};
    return { sp, name: sp.name, purpose: o.purpose || purpose, side: o.side || side, multi: "multi" in o ? o.multi : multi };
  }
  // spells the creature can actually cast in a macro = its equipped spell GEMS only. Spells socketed into an
  // artifact (Spell slot) or a Nether Stone auto-proc and CANNOT be cast manually / by a macro — excluded.
  function gatherSlotSpells(slot) {
    const out = [], seen = new Set();
    for (const gid of slot.spellGemIds || []) {
      const g = spellGems.find(x => x.id === gid); const sp = g ? gemSpell(g) : null;
      if (sp && !seen.has(sp.id)) { seen.add(sp.id); out.push(sp); }
    }
    return out;
  }
  const TAUNT_TAGS = new Set(["Action/Mechanic::Provoke", "Action/Mechanic::Defend"]);
  // line + target helpers shared by the rules
  const mLine = (en, why, chain) => ({ en, why, chain: !!chain });
  const allyT = (s) => s.multi ? "ally (all)" : "that creature";
  const enemyT = (s) => s.multi ? "enemy (all)" : "that creature";
  // per-creature context every rule reads from — classify once, expose grouped spells + stat-derived flags
  function macroContext(slot) {
    const c = CREA.get(slot.cid); if (!c) return null;
    const fs = finalStats(slot), st = fs.final;
    const spells = gatherSlotSpells(slot).map(classifySpell);
    const by = (p) => spells.filter(s => s.purpose === p);
    const traitTags = new Set();
    slotTraitIds(slot).forEach(tid => (TRAIT[tid] || {}).taxo && TRAIT[tid].taxo.forEach(t => traitTags.add(t)));
    const dom = STAT_KEYS.reduce((a, k) => st[k] > st[a] ? k : a, "hp");
    const dmg = by("damage");
    return {
      c, slot, st, spells, by, T: MACRO_TUNING,
      heals: by("heal"), dmg, singleDmg: dmg.filter(s => !s.multi), aoe: dmg.filter(s => s.multi),
      hasTauntTrait: [...traitTags].some(t => TAUNT_TAGS.has(t)),
      dom, tanky: dom === "def" || dom === "hp", squishy: dom === "int" || dom === "spd",
      physical: st.atk >= st.int, canAttack: !!(dmg.length || st.atk >= st.int),
    };
  }
  // ── The proposal rules, in priority order (first matching line acts in-game). Each rule is standalone:
  // `when(x)` gates it, `lines(x)` returns its macro lines. THIS is the main surface to modify behavior —
  // add / remove / reorder rules here, tweak thresholds in MACRO_TUNING, force spell purposes in
  // SPELL_OVERRIDES. `x` is the macroContext (grouped spells + stat flags + the tuning object as `x.T`). ──
  const MACRO_RULES = [
    { key: "rez", when: x => x.by("rez").length,
      lines: x => x.by("rez").map(s => mLine(`If any ally is dead, cast ${s.name} on that creature`, `${s.name} resurrects a dead ally`)) },
    { key: "heal-emergency", when: x => x.heals.length,
      lines: x => x.heals.map(s => mLine(`If any ally has < ${x.T.healEmergency}% Health, cast ${s.name} on ${allyT(s)}`, `${s.name} — emergency top-up before an ally dies`)) },
    { key: "self-preserve", when: x => x.squishy && !x.heals.length,
      lines: x => [mLine(`If this creature has < ${x.T.selfPreserveHp}% Health, defend`, `Fragile and can't heal — turtle when low`)] },
    { key: "provoke-spell", when: x => x.by("provoke").length,
      lines: x => x.by("provoke").map(s => mLine(`If this creature has > 0 enemies, cast ${s.name}`, `${s.name} draws enemy fire to this tank`)) },
    { key: "provoke-tank", when: x => !x.by("provoke").length && x.tanky && x.hasTauntTrait,
      lines: x => [mLine(`If this creature has > 0 enemies, provoke`, `Tanky stats + a taunt trait — provoke to protect the party`)] },
    { key: "heal-sustain", when: x => x.heals.length,
      lines: x => x.heals.map(s => mLine(`If any ally has < ${x.T.healSustain}% Health, cast ${s.name} on ${allyT(s)}`, `${s.name} — keep allies healthy`)) },
    { key: "debuff", when: x => x.by("debuff").length,
      lines: x => x.by("debuff").map(s => mLine(`If any enemy has < ${x.T.debuffFloor} debuffs, cast ${s.name} on ${enemyT(s)}`, `${s.name} — debuff an un-debuffed enemy`)) },
    { key: "buff", when: x => x.by("buff").length,
      lines: x => x.by("buff").map(s => mLine(`If any ally has < ${x.T.buffFloor} buffs, cast ${s.name} on ${allyT(s)}`, `${s.name} — buff an un-buffed ally`)) },
    { key: "summon", when: x => x.by("summon").length,
      lines: x => x.by("summon").map(s => mLine(`If this creature has < ${x.T.minionCap} minions, cast ${s.name}`, `${s.name} summons while you have room`)) },
    { key: "aoe", when: x => x.aoe.length,
      lines: x => x.aoe.map((s, i) => { const n = Math.min(i + 1, x.T.aoeMaxThreshold);
        return mLine(`If this creature has > ${n} enemies, cast ${s.name} on enemy (all)`, `${s.name} hits all enemies — worth it while ${n + 1}+ remain`); }) },
    { key: "damage-single", when: x => x.singleDmg.length,
      lines: x => { const primary = x.singleDmg[0], out = [];
        out.push(mLine(`If any enemy has < ${x.T.finishHp}% Health, cast ${primary.name} on that creature`, `Secure the kill on a nearly-dead enemy`));
        out.push(mLine(`If any enemy doesn't have Barrier, test next line`, `Don't waste ${primary.name} into a Barrier (spells ignore Shell)`, true));
        x.singleDmg.forEach((s, i) => { const f = x.T.focusRotation[i % x.T.focusRotation.length];
          out.push(mLine(`If any enemy ${f.cond}, cast ${s.name} on that creature`, `${s.name} — ${f.why}`)); });
        return out; } },
    { key: "basic-attack", when: x => x.physical && (x.dom === "atk" || !x.dmg.length),
      lines: x => [
        mLine(`If any enemy has < ${x.T.finishHp}% Health, attack that creature`, `Finish a nearly-dead enemy with a basic attack`),
        mLine(`If any enemy doesn't have Shell, test next line`, `Shell blunts basic attacks — skip those enemies`, true),
        mLine(`If any enemy doesn't have Barrier, test next line`, `Barrier blocks the hit entirely`, true),
        mLine(`If any enemy has lowest Defense, attack that creature`, `Hit the enemy your attack does the most to`),
      ] },
    { key: "fallback", when: () => true,
      lines: x => [x.canAttack
        ? mLine(`If this creature has > 0 enemies, attack a random enemy`, `Catch-all so the macro always acts instead of asking you`)
        : mLine(`If this creature has > 0 enemies, defend`, `No offensive option left — defend to pass the turn safely`)] },
  ];
  // role chips for the header — dominant spell purposes + stat lean
  function macroRoles(x) {
    const roles = [];
    if (x.by("rez").length || x.heals.length) roles.push("Healer");
    if (x.by("buff").length || x.by("summon").length) roles.push("Support");
    if (x.by("debuff").length) roles.push("Debuffer");
    if (x.dmg.length && !x.physical) roles.push("Caster");
    if (x.by("provoke").length || (x.tanky && x.hasTauntTrait)) roles.push("Tank");
    if (x.physical && (x.dom === "atk" || !x.dmg.length)) roles.push("Attacker");
    if (!roles.length) roles.push(x.dmg.length ? "Caster" : "Attacker");
    return [...new Set(roles)];
  }
  // assemble the proposal: run each rule in order, collect its lines, trim to the in-game cap
  function proposeMacro(slot) {
    const x = macroContext(slot); if (!x) return null;
    const all = [];
    for (const rule of MACRO_RULES) if (rule.when(x)) for (const l of rule.lines(x)) all.push(l);
    const lines = all.slice(0, x.T.maxLines);
    const note = !x.spells.length ? "No spell gems equipped — this proposal assumes a basic-attack bruiser."
      : all.length > x.T.maxLines ? `Trimmed to the ${x.T.maxLines}-line in-game cap (${all.length} proposed).` : null;
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
          <span class="macro-crea-face">${critFaceSkinned(c, build.slots[i].skinId)}</span>
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
    const innateN = new Set([c.traitId, f ? f.traitId : null].filter(x => x != null)).size;
    const hasArtifactTrait = traitIds.length > innateN;
    const traitHtml = traitIds.map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}
      <div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("");
    const relic = slot.relic ? RELIC.get(slot.relic.id) : null;
    // party navigation — step between filled creature slots (wraps); chevrons flank the sprite on
    // mobile, sit below it on web. Hidden entirely when there's only one creature.
    const filled = build.slots.map((s, i) => i).filter(i => build.slots[i].cid != null);
    const pos = filled.indexOf(slotIdx), total = filled.length, hasNav = total > 1;
    const chev = (dir, cls) => `<button class="cd-chev ${cls}" data-action="crea-nav" data-dir="${dir}" title="${dir < 0 ? "Previous" : "Next"} creature">${dir < 0 ? "‹" : "›"}</button>`;
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><h2>${esc(c.name)}${f ? " ⚭ " + esc(f.name) : ""}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left cd-left">
          <div class="cd-sprite-row">${hasNav ? chev(-1, "flank prev") : ""}
            <div class="cd-sprite">${critFaceSkinned(c, slot.skinId)}</div>${hasNav ? chev(1, "flank next") : ""}</div>
          <div class="slot-sub"><span style="color:${clsColor(b.cls)};font-weight:700">${esc(b.cls || "—")}</span>${c.race ? " · " + esc(c.race) : ""}</div>
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
          <div class="section-label" style="margin-top:14px">Traits (innate${f ? " + fusion" : ""}${hasArtifactTrait ? " + artifact" : ""})</div>
          ${traitHtml || `<div class="slot-sub">No traits.</div>`}
          ${relic ? `<div class="section-label" style="margin-top:14px">Relic — Rank ${slot.relic.rank}${deprivedActive() ? ` <span style="color:var(--bad);font-weight:700">· ignored (Deprived)</span>` : ""}</div>
            <div class="prop-list">
              <div class="prop-row static apx-clickable" data-action="apx-open" data-ek="relic" data-eid="${slot.relic.id}" title="View taxonomy"><span class="prop-ico">${relic.icon ? spriteImg(relic.icon, "px") : ""}</span><span class="prop-name"><b>${esc(relic.name)}</b> <span class="etax-hint">tags ›</span></span></div>

              ${relic.ranks.filter(r => r.rank <= slot.relic.rank).map(r => `<div class="prop-row static">
                <span class="prop-name" style="flex:0 0 40px;color:var(--accent)">R${r.rank}</span>
                <span class="prop-stat" style="flex:1;text-align:left">${richText(r.desc)}</span></div>`).join("")}
            </div>` : ""}
        </div></div>
      </div>
      <div class="overlay-footer"><span class="foot-info"></span>
        <div><button class="btn-ghost" data-action="crea-edit" data-slot="${slotIdx}">Edit</button>
        <button class="btn-confirm" data-action="close-detail">Done</button></div></div>
    </div></div>`;
  }

  // ── realm cards (leveled collection) ───────────────────────────────────────
  function openCards() { ovState = { kind: "cards", search: "", clsFilter: null, taxoFilters: [], render: renderCards }; openOverlay(ovState.render()); maybeFocusSearch(OV); }
  function renderCards() {
    const st = ovState, q = st.search.trim().toLowerCase();
    const applyAll = cards.applyAll;
    const list = D.cards.filter(c => (!q || c.family.toLowerCase().includes(q)) && (!st.clsFilter || c.cls === st.clsFilter) && taxoMatch(st, c));
    const clsChip = st.clsFilter
      ? `<button class="facet on" data-action="facet-class">Class: <b>${esc(st.clsFilter)}</b> <span class="facet-x" data-action="facet-class-clear">✕</span></button>`
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
          <div class="card-art">${bg ? `<img class="card-bg" src="${esc(bg)}" alt="">` : ""}${c.sprite ? spriteImg(c.sprite, "card-crit") : ""}</div>
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
        ${clsChip}${taxoFilterBar(st)}
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
  function netherPropLabel(p) {
    if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return t ? t.name : p.key; }
    if (p.cat === "spell") { const s = SPELL.get(p.key); return `${s ? s.name : p.key} (${p.trigger || "?"})`; }
    return `+${p.value}% ${p.key}`;
  }
  const netherSummary = (n) => (n.props || []).map(netherPropLabel).join(" · ") || "no properties";
  const netherPropIcon = (p) => {
    if (p.cat === "trait") { const t = TRAITITEM.get(p.key); return t && t.icon ? t.icon : null; }
    if (p.cat === "spell") return spellIcon(SPELL.get(p.key));
    const m = MAT_BY_PROP.get(p.key); return m && m.icon ? m.icon : null;
  };
  function openNether() {   // library
    ovState = { kind: "nether", sel: nether[0] ? nether[0].id : null, hideEquipped: false, render: renderNether };
    openOverlay(ovState.render());
  }
  // nether "Bonuses" view helpers — mirror the artifact panel (stat table + trait & spell-gem containers)
  function netherBonusRows(n) {
    const core = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 }, extra = new Map();
    const addEntry = (prop, stat, unit, val) => { if (!val) return; const k = PROP_STAT[stat];
      if (k) { core[k] += val; return; } const cur = extra.get(prop) || { value: 0, unit: unit || "%" }; cur.value += val; extra.set(prop, cur); };
    for (const p of n.props || []) { if (p.cat !== "stat" && p.cat !== "trick") continue; const g = propGroups.get(p.key);
      if (g) for (const e of g.entries) addEntry(p.key, e.stat, e.unit, Number(p.value) || 0); else addEntry(p.key, p.key, "%", Number(p.value) || 0); }
    return { core, extra };
  }
  function netherTraitContainers(n) {
    return (n.props || []).filter(p => p.cat === "trait").map(p => { const ti = TRAITITEM.get(p.key), tid = ti ? ti.traitId : null; if (tid == null) return "";
      return `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`; }).join("");
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
    let list = nether;
    if (st.hideEquipped) list = list.filter(n => !netherEquippedInBuild(n.id));
    // compact tiles: gem + name only; effects live in the info panel on selection
    const tiles = list.map(n => `
      <div class="pick-tile ${st.sel === n.id ? "selected" : ""}" data-action="nether-sel" data-id="${n.id}">
        <div class="pt-sprite">${spriteImg(gemSrc(n), "px")}</div>
        <div class="pt-name">${esc(n.name)}</div></div>`).join("")
      || `<div class="slot-sub" style="padding:10px">No Nether Stones${st.hideEquipped ? " match" : " yet — build one"}.</div>`;
    let info;
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
        ${toggle}${viewBody}
        <div class="ns-info-actions">
          <button class="slot-mini" data-action="nether-edit" data-id="${sel.id}">Edit</button>
          <button class="slot-mini danger" data-action="nether-del" data-id="${sel.id}">Delete</button></div>`;
    } else info = `<div class="slot-sub" style="padding:12px">Select a stone to see its effects.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Nether Stones</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center"><div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
        <div class="ovl-right lib-info">${info}</div>
      </div>
      <div class="overlay-footer"><button class="facet ${st.hideEquipped ? "on" : ""}" data-action="nether-hide-equipped">Hide equipped</button>
        <button class="btn-confirm" data-action="nether-new">＋ Build new stone</button></div>
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
          <div class="np-wrap"><input type="number" class="np-num" data-action="nether-propval" data-i="${i}" value="${p.value}"><span class="np-pct">%</span></div></div>`;
      }).join("");
      const slotsBox = `<div class="art-slot-grid">${rows}<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="nether-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Add</div></div></div>`;
      let picker = "";
      if (st.picking === "menu") {
        picker = `<div class="art-addmenu">${NETHER_CATS.map(x => `<button class="chip" data-action="nether-pickcat" data-c="${x.c}">${x.label}</button>`).join("")}</div>`;
      } else if (st.picking) {
        const q = st.search.trim().toLowerCase(); let rowsHtml = "";
        if (st.picking === "stat" || st.picking === "trick") {
          rowsHtml = [...propGroups.values()].filter(g => g.group === st.picking && (!q || g.name.toLowerCase().includes(q))).map(g => {
            const mat = MAT_BY_PROP.get(g.name);
            return `<div class="prop-row" data-action="nether-pickprop" data-k="${esc(g.name)}">
              <span class="prop-ico">${mat && mat.icon ? spriteImg(mat.icon, "px") : ""}</span><span class="prop-name">${esc(mat ? mat.name : g.name)}</span><span class="prop-stat">${esc(g.entries.map(e => e.stat).join(" / "))}</span></div>`;
          }).join("");
        } else if (st.picking === "trait") {
          rowsHtml = D.traitItems.filter(t => t.traitName && (!q || t.name.toLowerCase().includes(q) || (t.traitName || "").toLowerCase().includes(q))).slice(0, 300)
            .map(t => traitPickCard(t, false, `data-action="nether-pickprop" data-k="${t.id}"`)).join("");
        } else {   // spell: raw spells (no property modifiers)
          rowsHtml = D.spells.filter(sp => !q || sp.name.toLowerCase().includes(q) || (sp.desc || "").toLowerCase().includes(q)).slice(0, 300)
            .map(sp => spellPickCard(sp, false, `data-action="nether-pickprop" data-k="${sp.id}"`)).join("");
        }
        picker = `<div class="art-picker">
          <div class="ovl-filterbar"><button class="chip" data-action="nether-addprop">‹ Category</button>
            <input class="ovl-search" placeholder="Search…" value="${esc(st.search)}" data-action="nether-search"></div>
          <div class="art-pick-scroll">${rowsHtml}</div></div>`;
      }
    // ── 3) SHAPE — raw cor_n base as placeholder; recoloured once a colour is picked ──
    const tinted = s.mainColor || s.outlineColor;
    const shapeChoices = GEM_ICONS.map(g => {
      const prev = (_gemsReady && tinted) ? recolorGem(g.path, s.mainColor || DEFAULT_GEM_MAIN, s.outlineColor || DEFAULT_GEM_OUTLINE) : null;
      return `<button class="gem-choice ${s.icon === g.key ? "on" : ""}" data-action="nether-icon" data-k="${g.key}" title="${g.key}">${spriteImg(prev || g.path, "px")}</button>`;
    }).join("");
    // ── 4) COLOUR — Main / Outline as header groups, palette beneath each ──
    const swatches = (list, act, cur) => (list || []).map(hx =>
      `<button class="gem-swatch ${cur && cur.toLowerCase() === hx.toLowerCase() ? "on" : ""}" style="background:${esc(hx)}" data-action="${act}" data-hx="${esc(hx)}" title="${esc(hx)}"></button>`).join("");
    const colGroup = (label, inputAct, val, list, presetAct) => `
      <div class="color-col">
        <div class="color-col-head"><span class="color-col-lab">${label}</span><input type="color" data-action="${inputAct}" value="${esc(val)}"></div>
        <div class="swatch-grid">${swatches(list, presetAct, val)}</div>
      </div>`;
    const colorBox = `<div class="nether-colors two">
        ${colGroup("Main", "nether-maincolor", s.mainColor || DEFAULT_GEM_MAIN, NETHER_COLORS.mains, "nether-mainpreset")}
        ${colGroup("Outline", "nether-outlinecolor", s.outlineColor || DEFAULT_GEM_OUTLINE, NETHER_COLORS.outlines, "nether-outlinepreset")}
      </div>
      <div class="nether-color-actions"><button class="chip" data-action="nether-randcolor" title="Roll colours">🎲 Roll colours</button></div>`;
    const body = `<div class="ovl-center"><div class="ovl-center-scroll">
      <div class="build-section"><h3>Traits &amp; properties</h3>${slotsBox}${picker}</div>
      <div class="build-section"><h3>Name</h3><input class="ovl-search name-field" style="max-width:none;width:100%" placeholder="Name" value="${esc(s.name)}" data-action="nether-name"></div>
      <div class="build-section"><h3>Shape</h3><div class="gem-picker">${shapeChoices}</div></div>
      <div class="build-section"><h3>Colour</h3>${colorBox}</div>
    </div></div>`;
    const footer = `<button class="btn-ghost" data-action="nether-cancel">Cancel</button>
      <button class="btn-confirm" data-action="nether-save">Save Stone</button>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${gemImg(s, "px")}</span>
        <h2>${esc(s.name)}</h2>
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }

  // ── spell gems: library + stepped wizard (1 spell + up to 3 property items) ──
  function openSpellGems() {   // library (manage mode when equipCtx is null)
    ovState = { kind: "spellgemlib", equipCtx: null, hideEquipped: false, sel: null, render: renderSpellGemLib };
    openOverlay(ovState.render());
  }
  function renderSpellGemLib() {
    const st = ovState, ctx = st.equipCtx;   // {kind:'artifact'|'creature'} when equipping
    const equipped = ctx ? new Set(ctx.equipped()) : null;
    let list = spellGems;
    if (st.hideEquipped) list = list.filter(g => !spellGemEquippedInBuild(g.id) || (equipped && equipped.has(g.id)));
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
        <div class="pt-sprite">${spriteImg(gemIcon(g), "px")}</div>
        <div class="pt-name">${esc(gemName(g))}</div></div>`; }).join("")
      || `<div class="slot-sub" style="padding:10px">No spell gems${st.hideEquipped ? " match" : " yet — build one"}.</div>`;
    let info = "";
    if (sel) {
      const sp = gemSpell(sel);
      const propRows = (sel.propIds || []).map(pid => { const p = SPELLPROP.get(pid);
        return libRow(p && p.icon, p ? p.name : pid, p ? (p.effect || "").split(":")[0].slice(0, 28) : ""); }).join("");
      const spellBlock = sp
        ? `<div class="section-label" style="margin-top:6px">Spell</div>
           <div class="prop-row rich"><span class="prop-ico">${spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""}</span>
             <div class="prop-body"><div class="prop-name">${esc(sp.name)}</div>
               ${sp.desc ? `<div class="prop-sub">${perkText(sp.desc)}</div>` : ""}</div></div>
           ${spellStatsHtml(sp)}`
        : `<div class="slot-sub" style="padding:6px">No spell chosen.</div>`;
      const gcls = gemClass(sel);
      const clsNote = creatureSlot && !equipped.has(sel.id) && !gemAllowed(sel)
        ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">${esc(gcls || "This")}-class spell — a ${esc(creatureCls || "different")}-class creature can't equip it (an Opal or the right trait is needed).</div>`
        : (ctx && !equipped.has(sel.id) && spellGemEquippedInBuild(sel.id)
          ? `<div class="slot-sub sg-clsnote" style="padding:8px 0">Equipped on another creature — unequip it there first to use it here.</div>` : "");
      info = `<div class="ns-info-head"><span class="ns-info-icon">${spriteImg(gemIcon(sel), "px")}</span><h3>${esc(gemName(sel))}</h3></div>
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
      <div class="overlay-header"><h2>Spell Gems${ctx ? " — equip" : ""}</h2><button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-center" data-action="lib-deselect"><div class="ovl-center-scroll"><div class="pick-grid equip-grid">${tiles}</div></div></div>
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
  function openSpellGemBuilder(id) {
    const draft = id != null ? JSON.parse(JSON.stringify(spellGems.find(g => g.id === id)))
      : { id: null, name: "", spellId: null, propIds: [] };
    ovState = { kind: "sgbuild", editId: id, draft, step: id != null ? "props" : "spell", search: "", render: renderSpellGemBuilder };
    openOverlay(ovState.render());
  }
  function renderSpellGemBuilder() {
    const st = ovState, g = st.draft, q = st.search.trim().toLowerCase();
    let body = "", footer = "";
    if (st.step === "spell") {
      const rows = D.spells.filter(s => (!q || s.name.toLowerCase().includes(q) || (s.desc || "").toLowerCase().includes(q))
          && (!st.spellTaxo || (s.taxo || []).includes(st.spellTaxo))
          && (!st.bkOnly || bookmarks.spells.includes(s.id))).slice(0, 300)
        .map(s => `<div class="prop-row rich ${g.spellId === s.id ? "chosen" : ""}" data-action="sg-spell" data-id="${s.id}">
          <span class="prop-ico">${spellIcon(s) ? spriteImg(spellIcon(s), "px") : ""}</span>
          <div class="prop-body"><div class="prop-name">${esc(s.name)}${spellMeta(s) ? `<span class="prop-metatag">${esc(spellMeta(s))}</span>` : ""}</div>
            ${s.desc ? `<div class="prop-sub clamp">${perkText(s.desc)}</div>` : ""}</div></div>`).join("");
      const sTaxo = st.spellTaxo
        ? `<button class="facet on tag" data-action="sg-taxofilter-clear">${esc(taxoCatName(st.spellTaxo))}: <b>${esc(taxoValName(st.spellTaxo))}</b> <span class="facet-x">✕</span></button>`
        : `<button class="facet add" data-action="sg-taxofilter">＋ Filter</button>`;
      // right info panel — preview the highlighted spell's full effect + stats before committing to it
      // (only shown once a spell is chosen; no empty placeholder panel)
      const chosen = g.spellId != null ? SPELL.get(g.spellId) : null;
      const info = chosen
        ? `<div class="ns-info-head"><span class="ns-info-icon">${spellIcon(chosen) ? spriteImg(spellIcon(chosen), "px") : ""}</span><h3>${esc(chosen.name)}</h3></div>
           ${chosen.desc ? `<div class="prop-sub" style="margin-bottom:4px">${perkText(chosen.desc)}</div>` : ""}
           ${spellStatsHtml(chosen)}`
        : "";
      body = `<div class="ovl-center">
        <div class="ovl-filterbar"><input class="ovl-search" placeholder="Search spells…" value="${esc(st.search)}" data-action="sg-search">${sTaxo}${bookmarks.spells.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="sgb-bkonly" title="Show only bookmarked spells">★ Bookmarked</button>` : ""}</div>
        <div class="ovl-center-scroll">${rows}</div></div>
        ${chosen ? `<div class="ovl-right lib-info">${info}</div>` : ""}`;
      footer = `<button class="btn-ghost" data-action="sg-cancel">Cancel</button>
        <button class="btn-confirm" data-action="sgb-next" ${g.spellId != null ? "" : "disabled"}>Next: Properties ›</button>`;
    } else {
      const propLabel = (p) => p ? (p.swapClass ? p.effect : (p.effect || "").split(":")[0]) : "";
      const boxes = [];
      for (let i = 0; i < SPELLGEM_MAX_PROPS; i++) {
        const pid = g.propIds[i];
        if (pid !== undefined) { const p = SPELLPROP.get(pid);
          boxes.push(`<div class="art-slot"><button class="as-rm" data-action="sg-prop-rm" data-i="${i}">✕</button>
            <div class="as-ico">${p && p.icon ? spriteImg(p.icon, "px") : "◆"}</div><div class="as-lab">${esc(p ? p.name : pid)}</div>
            <div class="as-sub">${esc(propLabel(p).slice(0, 24))}</div></div>`); }
        else boxes.push(`<div class="art-slot add ${st.picking ? "picking" : ""}" data-action="sg-addprop"><div class="as-ico glyph">＋</div><div class="as-lab">Property</div></div>`);
      }
      let picker = "";
      if (st.picking) {
        // Opal's "Class Swap: <Class>" variants can't target the spell's own class → hide that one.
        const spellCls = gemSpell(g) ? gemSpell(g).cls : null;
        const pr = D.spellProps.filter(p => {
          if (p.swapClass && p.swapClass === spellCls) return false;
          return !q || p.name.toLowerCase().includes(q) || (p.effect || "").toLowerCase().includes(q);
        }).map(p =>
          `<div class="prop-row ${g.propIds.includes(p.id) ? "chosen" : ""}" data-action="sg-pickprop" data-id="${p.id}">
            <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}</span><span class="prop-stat">${esc(p.effect || "")}</span></div>`).join("");
        picker = `<div class="sgb-picker">
          <div class="ovl-filterbar"><button class="chip" data-action="sg-closepick">‹ Done</button>
            <input class="ovl-search" placeholder="Search gemstone enchantments…" value="${esc(st.search)}" data-action="sg-search"></div>
          <div class="sgb-pick-scroll">${pr}</div></div>`;
      }
      body = `<div class="ovl-center">
        <div class="sgb-top">
          <div class="build-section"><h3>Name</h3>
            <input class="ovl-search name-field" placeholder="${esc(gemSpell(g) ? gemSpell(g).name : "Spell gem name")}" value="${esc(g.name)}" data-action="sg-name" style="max-width:320px"></div>
          <div class="art-slot-group"><div class="section-label">Property items</div><div class="art-slot-grid">${boxes.join("")}</div></div>
        </div>
        ${picker}</div>`;
      footer = `<button class="btn-ghost" data-action="sgb-back">‹ Back</button>
        <button class="btn-confirm" data-action="sg-save">Save Spell Gem</button>`;
    }
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel detail">
      <div class="overlay-header"><span class="hdr-ico">${spriteImg(gemIcon(g), "px")}</span>
        <h2>${esc(gemName(g) || "New Spell Gem")}</h2>
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body">${body}</div>
      <div class="overlay-footer"><span class="foot-info"></span><div>${footer}</div></div>
    </div></div>`;
  }

  // creature spell slots (up to 3 equipped spell gems) — equip from the library
  function openCreatureSpells(slotIdx) {
    ovState = { kind: "spellgemlib", hideEquipped: false, sel: null, equipCtx: {
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
      // home
      case "pick-creature": { const si = +t.dataset.slot; if (si >= creatureCap()) break; openCreaturePicker(si); break; }
      case "equip-artifact": openArtifactLibrary(+t.dataset.slot); break;
      case "build-relic": openRelicBuilder(+t.dataset.slot); break;
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
      case "spec-edit": closeDetail(); openSpecPicker(); break;
      case "remove-creature": armOrDo(t, () => { build.slots[+t.dataset.slot] = emptySlot(); persistBuild(); render(); }); break;
      case "clear-spec": e.stopPropagation(); build.specId = null; persistBuild(); render(); break;
      case "clear-party": armOrDo(t, () => { build = freshBuild(); clearBookmarks(); persistBuild(); render(); }); break;
      case "home-view": { const v = t.dataset.view; if (v === homeView) break; homeView = v; persistHomeView(); syncLayoutMenu(); render(); break; }
      case "open-artifacts": openArtifactLibrary(null); break;
      case "toggle-menu": e.stopPropagation(); syncLayoutMenu(); el("main-menu").classList.toggle("hidden"); break;
      case "open-builds": openBuilds(); break;
      case "builds-save-new": ovState.draft = { name: `Build ${builds.length + 1}`, icon: buildDefaultIcon() }; refreshOverlay(); break;
      case "builds-cancel": ovState.draft = null; refreshOverlay(); break;
      case "builds-pick-icon": openIconPicker((w) => { ovState.draft.icon = w.img; }); break;
      case "builds-sel": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "builds-sort": if (ovState.sort !== t.dataset.sort) { ovState.sort = t.dataset.sort; refreshOverlay(); } break;
      case "builds-save": {
        const d = ovState.draft;
        const nb = { id: nextBuildId++, name: (d.name || "").trim() || `Build ${builds.length + 1}`, icon: d.icon, ts: Date.now(), build: JSON.parse(JSON.stringify(build)) };
        builds.push(nb); persistBuilds(); ovState.draft = null; ovState.sel = nb.id; flashBuild(nb.id); break;
      }
      case "builds-load": {
        const b = builds.find(x => x.id === +t.dataset.id);
        if (b) { build = normalizeBuild(JSON.parse(JSON.stringify(b.build))); clearBookmarks(); persistBuild(); closeOverlay(); render(); }
        break;
      }
      case "builds-overwrite": { const b = builds.find(x => x.id === +t.dataset.id); if (b && build.slots.some(s => s && s.cid != null)) { b.build = JSON.parse(JSON.stringify(build)); b.ts = Date.now(); persistBuilds(); ovState.sel = b.id; flashBuild(b.id); } break; }
      case "builds-del": armOrDo(t, () => { const id = +t.dataset.id; builds = builds.filter(b => b.id !== id); if (ovState.sel === id) ovState.sel = null; persistBuilds(); refreshOverlay(); }); break;
      case "iconpick-cat": dovState.cat = t.dataset.c; dovState.limit = ICON_PAGE; refreshDetail(); break;
      case "iconpick-cat-clear": e.stopPropagation(); dovState.cat = null; dovState.limit = ICON_PAGE; refreshDetail(); break;
      case "iconpick-more": dovState.limit = (dovState.limit || ICON_PAGE) + ICON_PAGE; refreshDetail(); break;
      case "iconpick-sel": { const k = t.dataset.k;   // first tap selects (+animates); tapping the selected tile again commits
        if (dovState.sel === k) { const w = (D.wardrobe || []).find(x => x.sprite === k); if (w && dovState.onPick) dovState.onPick(w); closeDetail(); refreshOverlay(); }
        else { dovState.sel = k; refreshDetail(); } break; }
      case "iconpick-use": { const w = (D.wardrobe || []).find(x => x.sprite === dovState.sel); if (w && dovState.onPick) { dovState.onPick(w); closeDetail(); refreshOverlay(); } break; }
      case "open-appendix": openAppendix(); break;
      case "open-realms": openRealms(); break;
      case "open-riddle": openRiddle(); break;
      case "riddle-search": break;   // handled in onInput
      case "open-glossary": openGlossary(); break;
      case "gloss-search": break;    // handled in onInput
      case "gloss-cat-toggle": { const c = t.dataset.c; ovState.collapsed.has(c) ? ovState.collapsed.delete(c) : ovState.collapsed.add(c); refreshOverlay(); break; }
      case "realm-sel": ovState.sel = +t.dataset.id; ovState.view = "detail"; ovState.detailIco = ovState.sortBy === "god" ? "god" : "realm"; refreshOverlay(true); break;
      case "realm-swapico": ovState.detailIco = (ovState.detailIco === "god" ? "realm" : "god"); refreshOverlay(); break;
      case "realm-back": ovState.view = "list"; refreshOverlay(true); maybeFocusSearch(OV); break;
      case "realm-sort": ovState.sortBy = t.dataset.v; refreshOverlay(); break;
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
        const k = t.dataset.k;
        if (!ovState.tags.includes(k)) ovState.tags.push(k);
        ovState.browsing = false; ovState.search = ""; refreshOverlay(); break;
      }
      case "appendix-rm-tag": e.stopPropagation(); ovState.tags = ovState.tags.filter(x => x !== t.dataset.k); ovState.search = ""; refreshOverlay(); break;
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
      case "anoint-toggle": {
        const sid = +t.dataset.sid, k = t.dataset.k;
        const i = build.anoints.findIndex(x => x.specId === sid && x.key === k);
        if (i >= 0) build.anoints.splice(i, 1);                 // removing is always allowed
        else if (sid === build.specId) break;                  // guard: can't anoint a perk from your current spec
        else if (build.anoints.length < anointMax()) build.anoints.push({ specId: sid, key: k });
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
        else {
          // guard the Avatar cap even if a disabled tile is somehow clicked
          if (ovState.primaryId !== id && isAvatar(CREA.get(id)) && (avatarCap() - avatarCount(ovState.slotIdx)) < 1) break;
          ovState.primaryId = ovState.primaryId === id ? null : id;
        }
        refreshOverlay(); break;
      }
      case "crea-nofuse": ovState.fusionId = null; refreshOverlay(); break;
      case "crea-next":
        if (ovState.primaryId == null) break;
        ovState.step = ovState.step === "primary" ? "fusion" : "customize";
        ovState.search = ""; ovState.limit = CREA_PAGE; refreshOverlay(); break;
      case "crea-back":
        ovState.step = ovState.step === "customize" ? "fusion" : "primary";
        ovState.search = ""; ovState.limit = CREA_PAGE; refreshOverlay(); break;
      case "crea-more": ovState.limit = (ovState.limit || CREA_PAGE) + CREA_PAGE; refreshOverlay(); break;
      case "crea-view": ovState.view = t.dataset.v === "traits" ? "traits" : "grid"; refreshOverlay(true); break;
      case "crea-bkonly": ovState.bkOnly = !ovState.bkOnly; resetCreaPage(); refreshOverlay(); break;
      case "crea-sort": ovState.sort = t.dataset.k || null; resetCreaPage(); refreshOverlay(); break;
      case "crea-confirm": {
        if (ovState.primaryId == null) break;
        const s = build.slots[ovState.slotIdx];
        s.cid = ovState.primaryId; s.fusion = ovState.fusionId;
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
      case "facet-taxo": {
        const idxByKind = { cards: cardTaxoIndex, relic: relicTaxoIndex };
        const f = idxByKind[ovState.kind];
        openFacetPicker("taxo-cat", f ? { idx: f() } : {});   // creature default = taxoIndex()
        break;
      }
      case "anoint-taxo": openFacetPicker("taxo-cat", { idx: anointTaxoIndex() }); break;
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
      case "rm-taxo": ovState.taxoFilters.splice(+t.dataset.i, 1); resetCreaPage(); refreshOverlay(); break;
      case "facet-pick": {
        const v = t.dataset.v;
        if (dovState.facet === "class") { ovState.clsFilter = v; resetCreaPage(); closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "anoint-spec") { ovState.specFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "anoint-fgod") { ovState.godFilter = v; closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "race") { ovState.raceFilter = v; resetCreaPage(); closeDetail(); refreshOverlay(); }
        else if (dovState.facet === "taxo-cat") { dovState.facet = "taxo-val"; dovState.taxoCat = v; dovState.search = ""; refreshDetail(); }
        else if (dovState.onPick) { dovState.onPick(v); closeDetail(); refreshOverlay(); }  // context-specific target (e.g. trait-item picker)
        else { if (!ovState.taxoFilters.includes(v)) ovState.taxoFilters.push(v); resetCreaPage(); closeDetail(); refreshOverlay(); }
        break;
      }

      // spec picker + perks
      case "spec-pick": ovState.sel = ovState.sel === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "spec-confirm":
        build.specId = ovState.sel;
        // drop any equipped anointments that now belong to the current spec (can't double-dip)
        build.anoints = build.anoints.filter(x => x.specId !== build.specId);
        enforceAnointCap();   // new spec may lower the anoint cap (e.g. leaving Royal)
        persistBuild(); closeOverlay(); render(); break;
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
        build.slots[ovState.slotIdx].artifactId = id; persistBuild(); closeOverlay(); render(); break; }
      case "art-unequip": build.slots[ovState.slotIdx].artifactId = null; persistBuild(); closeOverlay(); render(); break;
      case "art-new": openArtifactBuilder(null, ovState.slotIdx); break;
      case "art-edit": openArtifactBuilder(+t.dataset.id, ovState.slotIdx); break;
      case "art-del": armOrDo(t, () => { const id = +t.dataset.id; artifacts = artifacts.filter(a => a.id !== id); build.slots.forEach(s => { if (s.artifactId === id) s.artifactId = null; }); if (ovState.sel === id) ovState.sel = artifacts[0] ? artifacts[0].id : null; persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
      case "artb-next": ovState.step = ovState.step === "type" ? "slots" : "name"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-back": ovState.step = ovState.step === "name" ? "slots" : "type"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-closecat": ovState.pickType = null; ovState.preview = null; ovState.search = ""; ovState.bkOnly = false; refreshOverlay(true); break;
      case "artb-traitfilter": openFacetPicker("taxo-cat", {
        idx: taxoIndexFor("titem", D.traitItems, ti => ti.taxo || []),
        onPick: (v) => { ovState.traitTaxo = v; } }); break;
      case "artb-traitfilter-clear": ovState.traitTaxo = null; refreshOverlay(); break;
      case "artb-bkonly": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      // spell-gem builder spell picker filter (reuses the facet detail picker)
      case "sg-taxofilter": openFacetPicker("taxo-cat", {
        idx: taxoIndexFor("spell", D.spells, s => s.taxo || []),
        onPick: (v) => { ovState.spellTaxo = v; } }); break;
      case "sg-taxofilter-clear": ovState.spellTaxo = null; refreshOverlay(); break;
      case "sgb-bkonly": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      // perk picker inline taxonomy filter
      case "perk-taxo-open": dovState.perkBrowse = true; refreshDetail(); break;
      case "perk-taxo-cat": dovState.perkCat = t.dataset.c; refreshDetail(); break;
      case "perk-taxo-val": dovState.perkTaxo = t.dataset.v; dovState.perkBrowse = false; dovState.perkCat = null; refreshDetail(); break;
      case "perk-taxo-clear": dovState.perkTaxo = null; dovState.perkCat = null; dovState.perkBrowse = false; refreshDetail(); break;
      case "perk-taxo-back": if (dovState.perkCat) dovState.perkCat = null; else dovState.perkBrowse = false; refreshDetail(); break;
      case "art-primary": ovState.draft.primary = ovState.draft.primary === t.dataset.p ? null : t.dataset.p; refreshOverlay(); break;
      case "art-slot": ovState.pickType = t.dataset.t; ovState.preview = null; ovState.search = ""; ovState.bkOnly = false; refreshOverlay(true); break;
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
        if (sl.max === 1) { arr[0] === v ? (arr.length = 0) : (arr[0] = v); }   // single slot toggles/replaces
        else if (arr.length < sl.max) arr.push(v);                              // multi slot: independent, duplicates OK
        ovState.preview = null;
        if (arr.length >= sl.max) ovState.pickType = null;   // group full → back to the grid
        refreshOverlay(); break;
      }
      case "art-rm": {
        const type = t.dataset.t, sl = ART_SLOTS.find(s => s.pick === type), arr = ovState.draft[sl.key];
        const i = +t.dataset.i;                              // remove THIS specific slot box
        if (i >= 0 && i < arr.length) arr.splice(i, 1);
        refreshOverlay(); break;
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
      case "relic-pick": openRelicDetail(+t.dataset.id); break;
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
      case "nether-sel": ovState.sel = +t.dataset.id; refreshOverlay(); break;
      case "ns-view": ovState.nsView = t.dataset.v; refreshOverlay(); break;
      case "nether-hide-equipped": e.stopPropagation(); ovState.hideEquipped = !ovState.hideEquipped; refreshOverlay(); break;
      case "nether-edit": openNetherBuilder(+t.dataset.id); break;
      case "nether-del": armOrDo(t, () => { const id = +t.dataset.id; nether = nether.filter(n => n.id !== id); artifacts.forEach(a => a.netherIds = (a.netherIds || []).filter(x => x !== id)); if (ovState.sel === id) ovState.sel = nether[0] ? nether[0].id : null; persistNether(); persistArtifacts(); refreshOverlay(); }); break;
      case "nether-cancel": openNether(); break;
      case "nether-icon": ovState.draft.icon = t.dataset.k; refreshOverlay(); break;
      case "nether-randcolor": {
        const pick = (list) => list && list.length ? list[Math.floor(Math.random() * list.length)]
          : "#" + Array.from({ length: 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
        ovState.draft.mainColor = pick(NETHER_COLORS.mains); ovState.draft.outlineColor = pick(NETHER_COLORS.outlines); refreshOverlay(); break;
      }
      case "nether-mainpreset": ovState.draft.mainColor = t.dataset.hx; refreshOverlay(); break;
      case "nether-outlinepreset": ovState.draft.outlineColor = t.dataset.hx; refreshOverlay(); break;
      case "nether-addprop": ovState.picking = "menu"; ovState.search = ""; refreshOverlay(); break;
      case "nether-pickcat": ovState.picking = t.dataset.c; ovState.search = ""; refreshOverlay(); break;
      case "nether-closepick": ovState.picking = false; refreshOverlay(); break;
      case "nether-pickprop": {
        const cat = ovState.picking;
        if (cat === "spell") ovState.draft.props.push({ cat, key: +t.dataset.k, trigger: NETHER_TRIGGERS[0] });
        else if (cat === "trait") ovState.draft.props.push({ cat, key: +t.dataset.k, value: null });
        else ovState.draft.props.push({ cat, key: t.dataset.k, value: 10 });
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
      case "sg-sel": { const id = +t.dataset.id; ovState.sel = ovState.sel === id ? null : id; refreshOverlay(); break; }
      case "sg-hide-equipped": e.stopPropagation(); ovState.hideEquipped = !ovState.hideEquipped; refreshOverlay(); break;
      case "sg-new": openSpellGemBuilder(null); break;
      case "sg-edit": openSpellGemBuilder(+t.dataset.id); break;
      case "sg-del": armOrDo(t, () => { const id = +t.dataset.id; spellGems = spellGems.filter(g => g.id !== id);
        artifacts.forEach(a => a.spells = (a.spells || []).filter(x => x !== id));
        build.slots.forEach(s => s.spellGemIds = (s.spellGemIds || []).filter(x => x !== id));
        if (ovState.sel === id) ovState.sel = spellGems[0] ? spellGems[0].id : null;
        persistSpellGems(); persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
      case "sg-cancel": openSpellGems(); break;
      case "sg-spell": ovState.draft.spellId = ovState.draft.spellId === +t.dataset.id ? null : +t.dataset.id; refreshOverlay(); break;
      case "sgb-next": ovState.step = "props"; ovState.picking = false; ovState.search = ""; refreshOverlay(true); break;
      case "sgb-back": ovState.step = "spell"; ovState.picking = false; ovState.search = ""; refreshOverlay(true); break;
      case "sg-addprop": ovState.picking = true; ovState.search = ""; refreshOverlay(true); break;
      case "sg-closepick": ovState.picking = false; refreshOverlay(true); break;
      case "sg-pickprop": { const id = +t.dataset.id, arr = ovState.draft.propIds, picked = SPELLPROP.get(id);
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else {
          if (picked && picked.swapClass)   // only one Opal Class Swap per gem — replace any existing swap
            for (let j = arr.length - 1; j >= 0; j--) { const pp = SPELLPROP.get(arr[j]); if (pp && pp.swapClass) arr.splice(j, 1); }
          if (arr.length < SPELLGEM_MAX_PROPS) arr.push(id);
        }
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
        if (i >= 0) arr.splice(i, 1);                          // unequip is always allowed
        else {                                                 // equip — enforce the creature's class rule
          const g = spellGems.find(x => x.id === id);
          if (ctx.kind === "creature" && g && !canEquipGemOn(build.slots[ctx.slotIdx], g)) break;
          if (spellGemEquippedInBuild(id)) break;   // exclusive: already on another creature
          if (arr.length < ctx.max) arr.push(id);
          else if (ctx.max === 1) arr[0] = id;
        }
        persistBuild(); persistArtifacts(); refreshOverlay(); break;
      }
      case "lib-deselect": if (ovState && ovState.sel != null) { ovState.sel = null; refreshOverlay(); } break;

      // entity taxonomy detail (trait / spell / perk / relic / card)
      case "nav-trait": openEntityDetail("trait", +t.dataset.tid); break;
      case "apx-open": openEntityDetail(t.dataset.ek, t.dataset.eid); break;
      case "apx-crea-open": e.stopPropagation(); openCreaturePreview(t.dataset.cid); break;
      case "apx-fg-open": e.stopPropagation(); openFalseGodDetail(t.dataset.fg); break;
      case "close-entity": closeEntityDetail(); break;
      case "entity-backdrop": if (e.target === t) closeEntityDetail(); break;
      case "etax-filter": {   // jump to the Appendix filtered by the tapped tag
        const k = t.dataset.k; closeDetail();
        openAppendix(); ovState.tags = [k]; ovState.browsing = false; refreshOverlay(); break;
      }
    }
  }

  function armOrDo(t, fn) { if (t.classList.contains("armed")) { fn(); return; } t.classList.add("armed"); setTimeout(() => t.classList.remove("armed"), 2500); }
  function toggleArr(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }

  function onInput(e) {
    const t = e.target.closest("[data-action]"); if (!t) return;
    const A = t.dataset.action, v = t.value;
    // range sliders / selects
    if (A === "artb-rank") { ovState.draft.rank = +v; refreshOverlay(); return; }
    if (A === "relic-rank") { dovState.rank = +v; refreshDetail(); return; }
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
    if (A === "nether-maincolor") { ovState.draft.mainColor = v; refreshOverlay(); return; }
    if (A === "nether-outlinecolor") { ovState.draft.outlineColor = v; refreshOverlay(); return; }
    if (A === "sg-name") { ovState.draft.name = v; return; }
    if (A === "builds-name") { ovState.draft.name = v; return; }
    // search fields — live filter without losing caret
    const searchMap = { "crea-search": [OV, ovState], "spec-search": [OV, ovState], "artb-search": [OV, ovState],
      "relic-search": [OV, ovState], "cards-search": [OV, ovState], "anoint-search": [OV, ovState], "nether-search": [OV, ovState], "sg-search": [OV, ovState], "appendix-search": [OV, ovState], "shop-search": [OV, ovState], "realm-search": [OV, ovState], "riddle-search": [OV, ovState], "gloss-search": [OV, ovState], "facet-search": [DOV, dovState], "perk-search": [DOV, dovState], "pers-search": [DOV, dovState], "iconpick-search": [DOV, dovState], "skin-search": [DOV, dovState] };
    if (searchMap[A]) {
      const [root, state] = searchMap[A]; state.search = v;
      if (A === "crea-search") resetCreaPage();   // new query → back to page 1
      if (A === "iconpick-search") state.limit = ICON_PAGE;
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
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!DOV.classList.contains("hidden")) closeDetail(); else if (!OV.classList.contains("hidden")) closeOverlay(); }
  });

  // Feature-flag gate: strip disabled entries from the menu so they're unreachable.
  if (!FEATURES.macros) document.querySelector('[data-action="open-macros"]')?.remove();

  syncLayoutMenu();
  render();
})();
