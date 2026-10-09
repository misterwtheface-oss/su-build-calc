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

  // ── Fusion colour (CODE-EXACT; _su_extract code/fusion_palette.py + FUSION_MODEL.md, scr_GetFusionSurface) ──
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

  // ── sort toggles: tapping the ACTIVE sort flips its direction; picking another starts in its natural direction ──
  // st[key] = active sort value, st[revKey] = true when flipped from natural. `natDesc` = that sort's natural order is
  // descending (stats, potency, charges, recent, last-edited); name-style sorts are naturally ascending.
  const sortPick = (st, key, revKey, v) => { if (st[key] === v) st[revKey] = !st[revKey]; else { st[key] = v; st[revKey] = false; } };
  const sortSign = (rev) => (rev ? -1 : 1);
  // button label with the live direction arrow on the active sort (▼ descending, ▲ ascending)
  const sortLbl = (label, active, rev, natDesc) => active ? `${label} <span class="sort-dir">${(natDesc !== !!rev) ? "▼" : "▲"}</span>` : label;
  // saved-library sort control (Artifacts / Nether Stones / Spell Gems): opts = [[value, label, naturallyDescending]]
  const libSortSeg = (st, opts) => { const cur = st.libSort || opts[0][0];
    return `<div class="seg">${opts.map(([v, l, nd]) => `<button class="seg-btn ${cur === v ? "on" : ""}" data-action="lib-sort" data-v="${v}">${sortLbl(l, cur === v, st.libSortRev, nd)}</button>`).join("")}</div>`; };

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

  // taxonomy filter: a creature's innate trait's human-facing tags ("Category::Value")
  const creatureTaxo = (c) => {
    const t = c.traitId != null ? TRAIT[c.traitId] : null;
    return t && t.taxo ? t.taxo : [];
  };
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
      for (const it of arr) for (const k of new Set(it.taxo || [])) _taxoUse.set(k, (_taxoUse.get(k) || 0) + 1);
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
    for (const catObj of (D.taxonomy ? D.taxonomy.categories : [])) {
      const rows = [];
      for (const val of catObj.values) {
        const kk = catObj.category + "::" + val;
        if (counts.get(kk) && taxoValVisible(kk)) rows.push({ val, key: kk });
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
  });
  // "equipped in the current build" tests, for the saved-list Hide-equipped filter
  const artifactEquippedInBuild = (id) => build.slots.some(s => s.artifactId === id);
  const netherEquippedInBuild = (id) => build.slots.some(s => { const a = resolveArtifact(s); return a && (a.netherIds || []).includes(id); });
  const spellGemEquippedInBuild = (id) => build.slots.some(s => (s.spellGemIds || []).includes(id));   // gems only slot into creatures now
  function baseStats(slot) {
    const c = CREA.get(slot.cid); if (!c) return null;
    const f = slot.fusion != null ? CREA.get(slot.fusion) : null;
    const avg = (a, b) => f ? Math.floor((a + b) / 2) : a;   // game: fused base = floor((A+B)/2) (scr_UpdateCreature)
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
    // Deprived ignores Fused traits → keep only the primary creature's innate trait (+ artifact-granted traits below)
    const c = CREA.get(slot.cid);
    const ids = FX.ignores("fusionTraits") ? [c ? c.traitId : null].filter(x => x != null) : [...b.traitIds];
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
        <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
        <div class="roster-sprite-row">
          <div class="tile-badges roster-badges left">${clsIco}${raceIco}</div>
          <div class="roster-sprite" data-action="creature-detail" data-slot="${i}">${slotFace(slot, c)}</div>
          <div class="tile-badges roster-badges">${gearBadges(slot, i)}</div>
        </div>
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
      <div class="tile-badges gear-badges">${gearBadges(slot, i)}</div>
      <button class="slot-remove" data-action="remove-creature" data-slot="${i}" title="Remove">✕</button>
      <div class="slot-sprite-wrap" data-action="creature-detail" data-slot="${i}">${slotFace(slot, c)}</div>
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
      search: "", clsFilter: null, raceFilter: null, taxoFilters: [], limit: CREA_PAGE, sort: null, view: "traits",
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
      <div class="cd-sprite">${fusedFace(primary, st.skinId, secondary, st.step === "color" || st.fuseColor != null ? st.fuseColor : null)}</div>
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
                 idxFn: opts.idxFn || null, onPick: opts.onPick || null };   // idxFn: recomputed so display toggles apply live
    openDetail(dovState.render()); maybeFocusSearch(DOV);
  }
  function renderFacetPicker() {
    const st = dovState, q = st.search.trim().toLowerCase();
    const idx = st.idxFn ? st.idxFn() : taxoIndex();
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
        <div class="pt-sprite emblem">${spriteImg(s.emblem || s.sprite, "px")}</div><div class="pt-name">${esc(s.label)}</div></div>`).join("");
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
  function specPerkListHtml(spec) {
    return spec.perks.map(p => {
      const r = perkRank(spec, p), mx = perkMax(p), on = r > 0;
      const badge = mx > 1 ? `<span class="perk-rankbadge">${r}/${mx}</span>` : (on ? `<span class="perk-rankbadge">✓</span>` : "");
      const asc = p.ascension ? `<span class="anoint-badge asc">Ascension</span>` : "";
      const ico = `<div class="apx-iconcol">${p.icon ? `<div class="apx-crea">${spriteImg(p.icon, "px")}</div>` : ""}</div>`;   // same 48px centered icon as the Glossary
      return `<div class="perk-line apx-clickable ${on ? "on" : "off"} ${p.ascension ? "asc" : ""}" data-action="apx-open" data-ek="perk" data-eid="${esc(p.key)}">${ico}
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${asc}${badge}</span>${bkBtn("perks", p.key)}</div>
          ${p.desc ? `<div class="perk-desc">${perkText(p.desc, r)}</div>` : ""}
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
      <div class="overlay-footer"><span class="foot-info"></span>
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
          <div class="perk-row-head"><b>${esc(p.name)}</b><span class="perk-line-meta">${asc}${costLine}</span></div>
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
      && (!st.perkTaxo || (p.taxo || []).includes(st.perkTaxo)));
    // inline taxonomy drill-down over THIS spec's perks (values with ≥1 member only)
    const valsByCat = new Map();
    for (const p of spec.perks) for (const k of (p.taxo || [])) {
      if (!taxoValVisible(k)) continue;
      const c = taxoCatName(k); if (!valsByCat.has(c)) valsByCat.set(c, new Set()); valsByCat.get(c).add(k);
    }
    // taxonomy filter — mirrors the standard facet-picker drill-down (Category → Value as opt-rows,
    // not inline chips) so it matches the ＋ Filter used across the creature selector / artifact builder.
    const perkBrowsing = st.perkBrowse || !!st.perkCat;
    let taxobar, browseBody = "";
    if (st.perkTaxo) taxobar = `<button class="facet on tag" data-action="perk-taxo-clear">${esc(taxoCatName(st.perkTaxo))}: <b>${esc(taxoValName(st.perkTaxo))}</b> <span class="facet-x">✕</span></button>`;
    else if (st.perkCat) taxobar = `<button class="facet" data-action="perk-taxo-back">‹ Categories</button><span class="facet on">${esc(st.perkCat)}</span>${singlesToggle()}`;
    else if (st.perkBrowse) taxobar = `<button class="facet" data-action="perk-taxo-back">‹ Perks</button><span class="facet on">Filter by mechanic</span>${singlesToggle()}`;
    else taxobar = `<button class="facet add" data-action="perk-taxo-open">＋ Filter</button>`;
    if (st.perkCat) browseBody = `<div class="opt-list">${[...valsByCat.get(st.perkCat) || []].sort((a, b) => taxoValName(a).localeCompare(taxoValName(b))).map(k =>
      `<button class="opt-row" data-action="perk-taxo-val" data-v="${esc(k)}"><span>${esc(taxoValName(k))}</span></button>`).join("")}</div>`;
    else if (st.perkBrowse) browseBody = `<div class="opt-list">${[...valsByCat.keys()].sort().map(c =>
      `<button class="opt-row" data-action="perk-taxo-cat" data-c="${esc(c)}"><span>${esc(c)}</span><span class="opt-chev">›</span></button>`).join("")}</div>`;
    const allocCount = allocatedPerks(spec).length, pts = specPoints(spec);
    const rows = perkEditRowsHtml(spec, list);
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
      const body = { name: g.name || "", spellId: sid, tier: g.tier ?? GT.max, propIds };
      const hit = spellGems.find(x => !usedGems.has(x.id) && sameContent({ name: x.name || "", spellId: x.spellId, tier: x.tier ?? GT.max, propIds: x.propIds || [] }, body));
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
        if (n > 0 && taxoValVisible(key)) rows.push({ key, val, n });
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
    if (kind === "relic") { const e = RELIC.get(+id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && relicRanksHtml(e.ranks, true), kindLabel: "Relic" }; }
    if (kind === "card") { const e = CARD.get(+id); return { e, icon: e && e.sprite, name: e && e.family, descHtml: e && cardTiersHtml(e.effects, e.tiers), kindLabel: "Realm Card" }; }
    if (kind === "perk") { const e = perkByKey(id); return { e, icon: e && e.icon, name: e && e.name, descHtml: e && perkText(e.desc, e.ranks) + fxClarify(e), kindLabel: "Perk" }; }
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
      <div class="etax-vals">${vals.map(v => `<button class="etax-tag" data-action="etax-filter" data-k="${esc(v.key)}" title="Filter the Appendix to “${esc(v.val)}”">${esc(v.val)}${FEATURES.taxoSource && v.src ? `<span class="apx-src s-${esc(v.src)}">${esc(v.src)}</span>` : ""}</button>`).join("")}</div>
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
      const rel = slot.relic && !FX.ignores("relics") ? RELIC.get(slot.relic.id) : null;
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
      const rel = slot.relic && !FX.ignores("relics") ? RELIC.get(slot.relic.id) : null;
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
      ...(m.visibleOnly ? [`<span class="thr-chip">Visible only</span>`] : []),
    ].join("");
    // same row layout as the Glossary: large icon column + name/effect body (perk-line / apx-iconcol)
    return `<div class="perk-line">
      <div class="apx-iconcol">${m.icon ? `<div class="apx-crea">${spriteImg(m.icon, "px")}</div>` : ""}</div>
      <div class="perk-line-body"><div class="perk-line-head"><b>${esc(m.name)}</b>${m.rewardPct != null ? `<span class="thr-reward">+${m.rewardPct}% Rewards</span>` : ""}</div>
        <div class="perk-desc">${esc(m.effect)}</div>
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
        return `<div class="perk-line${go ? " apx-clickable" : ""}"${go}>${shopItemIcon(it)}
          <div class="perk-line-body"><div class="perk-line-head"><b${nmTitle}>${esc(shopItemName(it))}</b>
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

  // ── Glossary — Buff / Debuff / Minion reference (name + prose + in-game status glyph from the game). ──
  function openGlossary() {
    ovState = { kind: "glossary", search: "", collapsed: new Set([...GLOSSARY_CATS, "Resurrection", "NetherDrops", "StartOfBattle"]), ndDiff: "normal", render: renderGlossary };
    openOverlay(ovState.render()); maybeFocusSearch(OV);
  }
  const GLOSSARY_CATS = ["Buff", "Debuff", "Minion"];
  // ── Resurrection order — bc_OnDeath, in execution order (_su_extract code/REVIVE_CHAIN_FINDINGS.md).
  // "rule": Somnus — not a resurrection source here; its own rule blocks every other resurrection (pinned, unnumbered).
  // "free": checked before the chain, outside the one-per-death rule (neither checks nor blocks it).
  // "stop": checked before the chain; if it fires, the chain is skipped. "chain": one per death — the first that fires
  // resurrects, the rest are skipped. Only actual resurrection sources are listed (Breath of Death excluded: its gate
  // is unresolved and its text resurrects nothing — _su_extract code/HANDOFF_resurrection_open_questions.md). Refs: perk = name, trait = code runtime id, relic = name fragment + app rank (10–100 = extract perk 1–10),
  // cond = glossary key, realm = realm-property key (matched by text: the only realm property that resurrects).
  const RES_ORDER = [
    ["rule", "perk", "Somnus"],
    // Angry Army (Imp Impington, enemy-side) is the resurrect in the slot first read as Breath of Death (extract answer 1)
    ["stop", "trait", 678], ["free", "trait", 1335], ["free", "trait", 769],
    ["stop", "realm", "RESURRECT"], ["free", "trait", 1260], ["free", "trait", 1178], ["free", "trait", 891],
    ["free", "trait", 372], ["free", "trait", 188], ["stop", "perk", "Slam Shut"],
    ["chain", "perk", "Born Again"], ["chain", "trait", 839], ["chain", "trait", 1888], ["chain", "trait", 1927],
    ["chain", "trait", 1851], ["chain", "trait", 1993], ["chain", "relic", "Genaros", 100], ["chain", "trait", 1773],
    ["chain", "trait", 1715], ["chain", "trait", 1432], ["chain", "trait", 1461], ["chain", "perk", "Forbidden Magic"],
    ["chain", "relic", "Vulcanar", 100], ["chain", "trait", 1658], ["chain", "perk", "Bleed Out"], ["chain", "cond", "Buff:rebirth"],
    ["chain", "trait", 1286], ["chain", "trait", 2021], ["chain", "perk", "Martyr"], ["chain", "perk", "Soul Rending"],
    ["chain", "trait", 1587], ["chain", "perk", "New Moon"], ["chain", "perk", "From Ashes"], ["chain", "perk", "Gravewalker"],
    ["chain", "cond", "Minion:guardianofsurathli"], ["chain", "relic", "Surathli", 80], ["chain", "perk", "Feign Death"],
    ["chain", "trait", 354], ["chain", "trait", 331], ["chain", "trait", 97], ["chain", "trait", 486], ["chain", "trait", 454],
    ["chain", "trait", 187], ["chain", "trait", 189],
    // "Who Am I?" (runtime 1231) is suppressed: nothing in the data grants it (no creature / boss / item) — the
    // pre-split original of Kraynaks' three "None Of Your Business" variants, shown here as one row.
    ["chain", "trait", 1345], ["chain", "trait", 1297],
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
    RES_ROWS = RES_ORDER.map(([group, kind, ref, rank], i) => {
      let r = null;
      // icons: up to two boxes like the Appendix (creature / boss sprite over the trait material); chips: source names
      // only (no "Trait ·" / "Perk ·" prefix) — prose labels stay where there's no named source (Buff, Minion, Realm Property)
      if (kind === "perk") { const h = perkBy.get(ref); if (h) r = { name: h.p.name, desc: h.p.desc, icons: [specIco(h.spec), h.p.icon && spriteImg(h.p.icon, "px")], chips: [h.spec.label] }; }
      else if (kind === "trait") { const t = traitByRt.get(ref); if (t) {
        const c = creatureByTrait.get(t.id), boss = bossSpriteFor(t), its = itemsByTrait.get(t.id) || [], it = its.find(x => x.icon);
        r = { name: t.name, desc: t.desc, icons: [c ? critFace(c) : boss ? spriteImg(boss) : "", it ? spriteImg(it.icon, "px") : ""],
          enemy: t.ownerType === "boss" && !c && !it,
          chips: [c ? c.name : t.owner || "", ...new Set(its.map(x => x.name))], open: { ek: "trait", eid: t.id } }; } }
      else if (kind === "relic") { const rl = D.relics.find(x => x.name.includes(ref)), rk = rl && rl.ranks.find(x => x.rank === rank);
        if (rl && rk) r = { name: rl.name.split(",")[0], desc: rk.desc, icons: [spriteImg(rl.icon, "px")], chips: [rl.name.split(",")[1].trim(), `Rank ${rank}`] }; }
      else if (kind === "cond") { const c = (D.conditions || []).find(x => `${x.cat}:${x.key}` === ref);
        if (c) r = { name: c.name, desc: c.desc, icons: [c.icon ? `<img src="${esc(c.icon)}" alt="">` : ""], chips: [c.cat], open: { ek: "condition", eid: ref } }; }
      else if (kind === "realm") { const rp = (D.realmProps || []).find(x => x.key === ref);
        if (rp) r = { name: rp.name, desc: rp.effect, icons: [spriteImg(rp.icon, "px")], chips: ["Realm Property"], enemy: true }; }
      if (!r) { console.error("RESURRECTION ORDER: unresolved", kind, ref); r = { name: String(ref), desc: "", icons: [], chips: [kind] }; }
      r.icons = r.icons.filter(Boolean); r.chips = r.chips.filter(Boolean);
      // Angry Army's resurrect isn't in its in-game text (bc_OnDeath only: once per creature, full Health, "(HA! HA! HA!)")
      if (kind === "trait" && ref === 1335) r.note = "Not in the trait text: each enemy creature with Angry Army also resurrects once, at 100% Health.";
      return { group, ...r };
    });
    let n = 0; for (const r of RES_ROWS) if (r.group !== "rule") r.n = ++n;   // execution order, Somnus unnumbered
    return RES_ROWS;
  }
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
    }).join("") + resOrderSection(st, q) + sobSection(st, q) + netherDropSection(st, q) + realmBonusSection(st, q) || `<div class="slot-sub" style="padding:10px">No buff, debuff or minion matches “${esc(st.search)}”.</div>`;
    return `<div class="ovl-backdrop" data-action="backdrop"><div class="overlay-panel">
      <div class="overlay-header"><h2>Glossary</h2>
        <input class="ovl-search" placeholder="Search buffs / debuffs / minions / resurrection…" value="${esc(st.search)}" data-action="gloss-search">
        <button class="ovl-close" data-action="close-ovl">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll">${body}</div></div></div>
      <div class="overlay-footer"><span class="foot-info"></span><button class="btn-confirm" data-action="close-ovl">Done</button></div>
    </div></div>`;
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
          chips: [c ? c.name : t.owner || "", ...new Set(its.map(x => x.name))], open: { ek: "trait", eid: t.id } }; } }
      else if (ref.k === "perk") { const h = perkBy.get(ref.name); if (h) r = { name: h.p.name, desc: h.p.desc, icons: [specIco(h.spec), h.p.icon && spriteImg(h.p.icon, "px")], chips: [h.spec.label] }; }
      else if (ref.k === "relic") { const rl = D.relics.find(x => x.id === ref.id), rk = rl && rl.ranks.find(x => x.rank === ref.rank);
        if (rl && rk) r = { name: rl.name.split(",")[0], desc: rk.desc, icons: [spriteImg(rl.icon, "px")], chips: [(rl.name.split(",")[1] || "").trim(), `Rank ${ref.rank}`] }; }
      else if (ref.k === "card") { const cd = (D.cards || []).find(x => x.family === ref.family);
        if (cd) r = { name: `${cd.family} set`, desc: cd.effects[ref.power - 1] || "", icons: [spriteImg(cd.sprite)], chips: ["Card Set", `Power ${ref.power}`] }; }
      else if (ref.k === "cond") { const c = (D.conditions || []).find(x => x.name === ref.name);
        if (c) r = { name: c.name, desc: c.desc, icons: [c.icon ? `<img src="${esc(c.icon)}" alt="">` : ""], chips: [c.cat], open: { ek: "condition", eid: `${c.cat}:${c.key}` } }; }
      else if (ref.k === "realm") { const rp = (D.realmProps || []).find(x => x.key === ref.key);
        if (rp) r = { name: rp.name, desc: rp.effect, icons: [spriteImg(rp.icon, "px")], chips: ["Realm Property"] }; }
      else if (ref.k === "boost") r = { name: "Realm Boost", desc: ref.name.charAt(0).toUpperCase() + ref.name.slice(1) + ".", icons: [], chips: [] };
      if (!r) { console.error("START OF BATTLE: unresolved", ref, e.name); r = { name: e.name, desc: e.effect, icons: [], chips: [] }; }
      r.icons = r.icons.filter(Boolean); r.chips = r.chips.filter(Boolean);
      return { ...r, n: i + 1, step: e.sub || String(e.phase), enemy: e.enemy, note: r.note || e.note || null };
    });
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
    const row = (r) => `<div class="perk-line res-line${r.enemy ? " res-enemy" : ""}${r.marker ? " sob-marker" : ""}${r.open ? " apx-clickable" : ""}"${r.open ? ` data-action="apx-open" data-ek="${r.open.ek}" data-eid="${esc(String(r.open.eid))}" title="View taxonomy"` : ""}>
        <div class="res-n">${r.marker ? "⏱" : r.n}</div>
        <div class="apx-iconcol">${r.icons.map(icoBox).join("")}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(r.name)}</b></div>
          ${r.desc ? `<div class="perk-desc">${richText(r.desc)}</div>` : ""}${r.note ? `<div class="perk-desc res-note">${esc(r.note)}</div>` : ""}
          ${r.members ? `<button class="facet sob-mem-toggle" data-action="sob-members">${st.sobMembers || q ? "▾" : "▸"} ${r.members.length} effects</button>
            ${st.sobMembers || q ? `<div class="perk-line-meta sob-members">${r.members.filter(m => !q || m.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)).map(m => `<span class="anoint-spec-tag">${esc(m)}</span>`).join("")}</div>` : ""}` : ""}
          <div class="perk-line-meta">${r.chips.map(c => `<span class="anoint-spec-tag">${esc(c)}</span>`).join("")}</div></div></div>`;
    const steps = SOB_STEPS.map(([k, title]) => {
      const list = all.filter(r => r.step === k); if (!list.length) return "";
      const sk = "SOB:" + k, sopen = q ? true : st.sobOpen && st.sobOpen.has(sk);
      return `<button class="sob-step${sopen ? " open" : ""}" data-action="sob-step" data-k="${sk}"><span class="apx-sec-caret">${sopen ? "▾" : "▸"}</span>${k.replace(/^1(?=[abc])/, "1")}. ${esc(title)}</button>
        ${sopen ? `<div class="perk-list">${list.map(row).join("")}</div>` : ""}`;
    }).join("");
    const body = open ? `<div class="slot-sub sob-intro">Each step resolves fully before the next. Within a step, one effect at a time in this order — your side before the enemy's, and per-creature effects in timeline order (fastest first; before step 6 that's last battle's order, see step 0a).</div>${steps}` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Start of Battle Order</button>${body}`;
  }

  // ── Nether Stone drop breakpoints (code: inv_Loot, _su_extract code/DROP_RATES_FINDINGS.md +
  // HANDOFF_nether_stone_breakpoints.md). Each loot roll succeeds on 1..N ≤ X, X = (1 + realm bonus) × 1.25
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
          <div class="nd-row nd-hd"><span>Drop chance</span><span>Realm bonus</span><span>With Pariah ascended</span></div>
          ${netherDropRows().map(r => `<div class="nd-row"><span class="nd-pct">${pct(r.k)}<small>1 in ${Math.round(N / r.k).toLocaleString()}</small></span>
            <span>${r.plain != null ? `${r.plain}%` : "—"}</span><span>${r.pariah}%</span></div>`).join("")}
        </div>
        <div class="slot-sub nd-note">Per loot roll · after The True Enemy · not in the castle</div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Nether Stone Drops</button>${body}`;
  }
  // true maximum realm bonus per instability (code: best legal visible + hidden property sets, scr_RealmBonus)
  function realmBonusSection(st, q) {
    const M = D.realmBonusMax || {};
    if (!Object.keys(M).length || (q && !"realm bonus item bonus instability maximum".includes(q))) return "";
    const key = "RealmBonusMax", open = q ? true : !st.collapsed.has(key);
    const body = open ? `<div class="nd-wrap"><div class="nd-table">
        <div class="nd-row nd-hd"><span>Instability</span><span>Deepest depth</span><span>Below deepest</span></div>
        ${Object.entries(M).map(([ri, m]) => `<div class="nd-row"><span>${ri}</span><span>${m.deep}%</span><span>${m.below}%</span></div>`).join("")}
      </div></div>` : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Maximum Realm Bonus</button>${body}`;
  }
  function resOrderSection(st, q) {
    const rows = resOrderRows().filter(r => !q || r.name.toLowerCase().includes(q) || (r.desc || "").toLowerCase().includes(q));
    if (!rows.length) return "";
    const key = "Resurrection", open = q ? true : !st.collapsed.has(key);
    const row = (r) => `<div class="perk-line res-line${r.group === "rule" ? " res-rule" : ""}${r.enemy ? " res-enemy" : ""}${r.open ? " apx-clickable" : ""}"${r.open ? ` data-action="apx-open" data-ek="${r.open.ek}" data-eid="${esc(String(r.open.eid))}" title="View taxonomy"` : ""}>
        <div class="res-n">${r.n ?? "⛔"}</div>
        <div class="apx-iconcol">${r.icons.map(icoBox).join("")}</div>
        <div class="perk-line-body"><div class="perk-line-head"><b>${esc(r.name)}</b></div>
          ${r.desc ? `<div class="perk-desc">${richText(r.desc)}</div>` : ""}${r.note ? `<div class="perk-desc res-note">${esc(r.note)}</div>` : ""}
          <div class="perk-line-meta">${r.chips.map(c => `<span class="anoint-spec-tag">${esc(c)}</span>`).join("")}</div></div></div>`;
    const grp = (gs, label) => { const list = rows.filter(r => gs.includes(r.group));
      return list.length ? `<div class="res-sub">${label}</div><div class="perk-list">${list.map(row).join("")}</div>` : ""; };
    const body = open ? grp(["rule"], "Blocks other resurrection") + grp(["free", "stop"], "Checked first — outside once-per-death") + grp(["chain"], "Then once per death — the first that fires stops the rest") : "";
    return `<button class="apx-sec-head apx-cat${open ? "" : " collapsed"}" data-action="gloss-cat-toggle" data-c="${key}"><span class="apx-sec-caret">${open ? "▾" : "▸"}</span>Resurrection Order</button>${body}`;
  }

  // L_IN_WEATHER's name is the runtime "{1}" (the weather is picked when you buy it) — show it as "Weather"
  const shopItemName = (it) => /^\{\d\}$/.test(it.name || "") ? (it.key === "L_IN_WEATHER" ? "Weather" : "?") : (it.name || "?");

  // ── Nether Realm helpers (code-grounded: _su_extract code/NETHER_HELPERS_FINDINGS.md) ──
  // Faucet = room_nether_valves: 4 on/off valves form a code (left→right) that picks the single chest's contents;
  // the closed chest's sprite already previews the result. Mimic Mike = room_nether_treasurehuge: 35 chests whose
  // contents are rolled at room creation and shown by their sprite; 7 opens, each parchment adds 2–4 more.
  const NH = D.netherHelpers || { faucet: { table: [] }, treasury: { table: [] } };
  const FAUCET_ORDER = { item: 0, materials: 0, emblem: 0, mimic: 1, empty: 2 };
  function openNetherHelper() {
    ovState = { kind: "netherhelp", tab: "faucet", valves: [0, 0, 0, 0], render: renderNetherHelper };
    openOverlay(ovState.render());
  }
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
      const code = st.valves.join(""), cur = NH.faucet.table.find(r => r.code === code);
      const valves = st.valves.map((v, i) => `<button class="nh-valve${v ? " on" : ""}" data-action="nh-valve" data-i="${i}" title="Faucet ${i + 1}">${valveImg(v)}</button>`).join("");
      head = `<div class="nh-head"><div class="nh-valves">${valves}</div><span class="nh-arrow">→</span>
        <div class="nh-result${cur && cur.kind === "mimic" ? " mimic" : ""}"><span class="nh-chest lg">${cur ? spriteImg(cur.img, "px") : ""}</span>
          <b>${cur ? esc(cur.reward) : ""}</b></div></div>`;
      const rows = NH.faucet.table.slice().sort((a, b) => (FAUCET_ORDER[a.kind] ?? 0) - (FAUCET_ORDER[b.kind] ?? 0) || a.code.localeCompare(b.code))
        .map(r => `<button class="nh-row${r.code === code ? " on" : ""}${r.kind === "mimic" ? " mimic" : r.kind === "empty" ? " empty" : ""}" data-action="nh-code" data-c="${r.code}">
          <span class="nh-row-valves">${[...r.code].map(d => valveImg(d === "1")).join("")}</span>
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
          <b>${esc(o.name)}</b>${o.baseCount != null ? `<span class="realm-obj-ct">×${o.baseCount}</span>` : ""}</div>
        <div class="robj-tiers">${o.base ? objRow(0, o.base) : ""}${(o.favor || []).slice().sort((x, y) => x.at - y.at).map(t => objRow(t.at, t.effect)).join("")}</div></div>`).join("")}</div>` : "";
    const interactionsView = `${creatures}${resources}${objects}`;
    const barsView = `${favorSlider(rank)}${rankNote}${commonToggle}
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
      ? `<button class="facet on" data-action="anoint-fgod">False God: ${(godByKey.get(st.godFilter) || {}).icon ? `<span class="tag-ico">${spriteImg(godByKey.get(st.godFilter).icon, "px")}</span>` : ""}<b>${esc(godName(st.godFilter))}</b> <span class="facet-x" data-action="anoint-fgod-clear">✕</span></button>`
      : `<button class="facet" data-action="anoint-fgod">False God ▾</button>`;
    const specChip = st.specFilter
      ? `<button class="facet on" data-action="anoint-spec">Spec: ${specEmblemIco(st.specFilter)}<b>${esc(st.specFilter)}</b> <span class="facet-x" data-action="anoint-spec-clear">✕</span></button>`
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
        <div class="apx-iconcol">${a.icon ? `<div class="apx-crea">${spriteImg(a.icon, "px")}</div>` : ""}</div>
        <div class="perk-line-body">
          <div class="perk-line-head"><b>${esc(a.name)}</b>
            <span class="perk-line-meta">${specTagHtml(a.spec)}${inCur ? `<span class="anoint-badge">Current spec</span>` : ""}${a.ascension ? `<span class="anoint-badge asc">Ascension</span>` : ""}</span>${bkBtn("perks", a.key)}</div>
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
    if (a.primary) r.push(libRow(primaryIconAt(a.primary, a.rank), a.primary, "primary"));
    for (const n of a.stat || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, n)); }
    empty("stat");
    for (const n of a.trick || []) { const m = MAT_BY_PROP.get(n); r.push(libRow(m && m.icon, m ? m.name : n, n)); }
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
  // ── Spell Gem Slot activation chance (code-grounded model D.slotChance; _su_extract SPELL_GEM_SLOT_CHANCE_FINDINGS.md).
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
      .map(tid => `<div class="primary-traits" style="margin-bottom:6px">${traitBanner(tid)}<div class="trait-desc">${richText((TRAIT[tid] || {}).desc || "")}</div></div>`).join("");
  }
  // one spell-gem container: name + trigger + description (clickable to the spell's taxonomy)
  const spellGemCard = (sp, trigger, src, ch) => `<div class="art-spellcard apx-clickable" data-action="apx-open" data-ek="spell" data-eid="${sp.id}" title="View taxonomy">
    <div class="art-spellcard-head"><span class="prop-ico">${spellIcon(sp) ? spriteImg(spellIcon(sp), "px") : ""}</span>
      <b>${esc(sp.name)}</b>${trigger ? `<span class="art-trigger"${ch ? ` title="Activation chance: ${esc(ch.title)}"` : ""}>${esc(trigger)}${chanceTxt(ch)}</span>` : ""}</div>
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
  // state on the wizard's ovState: search, spellTarget, spellCls, spellSort, spellTaxo, bkOnly
  function spellPickList(st, exclude) {
    const q = (st.search || "").trim().toLowerCase(), sort = st.spellSort || "name";
    return (D.spells || []).filter(sp => !(exclude && exclude.has(sp.id))
        && (!q || sp.name.toLowerCase().includes(q) || (sp.desc || "").toLowerCase().includes(q) || (sp.taxo || []).some(k => taxoValName(k).toLowerCase().includes(q)))
        && (!st.spellCls || sp.cls === st.spellCls)
        && (st.spellTarget == null || sp.target === st.spellTarget)
        && (!st.spellTaxo || (sp.taxo || []).includes(st.spellTaxo))
        && (!st.bkOnly || bookmarks.spells.includes(sp.id))
        && (!st.spellKind || (st.spellKind === "core" ? !spellKind(sp) : spellKind(sp) === st.spellKind)))
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
  const spellKind = (sp) => (sp.taxo || []).includes("Related Spells::Ultimate Spells") ? "ultimate" : sp.source === "Rune Knight" ? "rune" : null;
  // the identical two-row bar: [lead] search · ＋ Filter · ★ Bookmarked  /  Target ▾ · Class ▾ · A–Z | Potency | Charges
  function spellFilterBar(st, searchAction, lead = "") {
    const sort = st.spellSort || "name";
    const taxo = st.spellTaxo
      ? `<button class="facet on tag" data-action="sg-taxofilter-clear">${esc(taxoCatName(st.spellTaxo))}: <b>${esc(taxoValName(st.spellTaxo))}</b> <span class="facet-x">✕</span></button>`
      : `<button class="facet add" data-action="sg-taxofilter">＋ Filter</button>`;
    const bk = bookmarks.spells.length ? `<button class="facet ${st.bkOnly ? "on" : ""}" data-action="spf-bk" title="Show only bookmarked spells">★ Bookmarked</button>` : "";
    return `<div class="ovl-filterbar spf-row">${lead}<input class="ovl-search" placeholder="Search spells…" value="${esc(st.search || "")}" data-action="${searchAction}">${taxo}${bk}</div>
      <div class="ovl-filterbar sg-dropbar">
        <select class="app-select${st.spellTarget != null ? " on" : ""}" data-action="spf-target" title="Filter by target">
          <option value="*" ${st.spellTarget == null ? "selected" : ""}>-</option>${SPELL_TARGETS.map(([v, l]) => `<option value="${esc(v)}" ${st.spellTarget === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select class="app-select${st.spellCls ? " on" : ""}" data-action="spf-cls" title="Filter by class">
          <option value="" ${!st.spellCls ? "selected" : ""}>-</option>${SPELL_CLASSES.map(cl => `<option value="${cl}" ${st.spellCls === cl ? "selected" : ""}>${cl}</option>`).join("")}</select>
        <select class="app-select${st.spellKind ? " on" : ""}" data-action="spf-kind" title="Filter by spell kind">
          ${[["", "-"], ["core", "No Ultimate / Rune"], ["ultimate", "Ultimate"], ["rune", "Rune"]].map(([v, l]) => `<option value="${v}" ${(st.spellKind || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select>
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
    } else if (type === "spell") {   // raw spells (no sockets), like nether stones — shared spell picker
      rows = spellPickRows(st, spellPickList(st), sp => spellPickCard(sp, has(sp.id), `data-action="art-confirm-add" data-t="spell" data-v="${sp.id}"`));
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
      ? (st.traitTaxo
          ? `<button class="facet on tag" data-action="artb-traitfilter-clear">${esc(taxoCatName(st.traitTaxo))}: <b>${esc(taxoValName(st.traitTaxo))}</b> <span class="facet-x">✕</span></button>`
          : `<button class="facet add" data-action="artb-traitfilter">＋ Filter</button>`)
      : "";
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
        <div class="art-side-filter">${seg("artb-nssort", st.nsSort || "recent", [["recent", "Recent"], ["name", "A–Z"], ...STAT_KEYS.map(k => [k, STAT_LABEL[k].slice(0, 3)])], st.nsSortRev)}</div>`;
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
  function openRelicBuilder(slotIdx) {
    ovState = { kind: "relic", slotIdx, search: "", taxoFilters: [], render: renderRelicBuilder };
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
    const list = D.relics.filter(r => (!q || r.name.toLowerCase().includes(q) || (r.statBonus || "").toLowerCase().includes(q)) && taxoMatch(st, r));
    // one section per stat, in the app's canonical stat order; picking a tile opens the rank overlay
    const sections = STAT_KEYS.map(k => {
      const label = STAT_LABEL[k];
      const rels = list.filter(r => r.statBonus === label);
      if (!rels.length) return "";
      const tiles = rels.map(r => { const taken = takenBy.get(r.id); return `<div class="pick-tile ${equipped && equipped.id === r.id ? "selected" : ""}${taken ? " disabled" : ""}" ${taken ? `title="Equipped by ${esc(taken)}"` : `data-action="relic-pick" data-id="${r.id}"`}>
        <div class="pt-sprite">${r.icon ? spriteImg(r.icon, "px") : `<span class="spec-tile-plus">✦</span>`}</div>
        <div class="pt-name">${esc(relicShortName(r))}</div></div>`; }).join("");
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
          <input type="range" min="1" max="${maxRank}" step="1" value="${st.rank}" data-action="relic-rank"><span class="rank-badge">${st.rank}</span></div>
        <div class="ovl-center-scroll">${ranks}</div>
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
      <div class="overlay-header"><h2>${esc(c.name)}${f ? " ⚭ " + esc(f.name) : ""}</h2><button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body">
        <div class="ovl-left cd-left">
          <div class="cd-sprite-row">${hasNav ? chev(-1, "flank prev") : ""}
            <div class="cd-sprite">${slotFace(slot, c)}</div>${hasNav ? chev(1, "flank next") : ""}</div>
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
          ${artHtml}
          ${relic ? `<div class="section-label" style="margin-top:14px">Relic — Rank ${slot.relic.rank}${FX.ignores("relics") ? ` <span style="color:var(--bad);font-weight:700">· ignored (Deprived)</span>` : ""}</div>
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
          rowsHtml = spellPickRows(st, spellPickList(st, haveS), sp => spellPickCard(sp, false, `data-action="nether-pickprop" data-k="${sp.id}"`));
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
    ovState = { kind: "spellgemlib", equipCtx: null, hideEquipped: false, sel: null, search: "", libCls: null, libSort: "recent", render: renderSpellGemLib };
    openOverlay(ovState.render());
  }
  function renderSpellGemLib() {
    const st = ovState, ctx = st.equipCtx;   // {kind:'artifact'|'creature'} when equipping
    const equipped = ctx ? new Set(ctx.equipped()) : null;
    const q = (st.search || "").trim().toLowerCase(), sortK = st.libSort || "recent", d = sortSign(st.libSortRev);
    const gemText = (g) => { const sp = gemSpell(g); return [gemName(g), sp ? sp.name : "", sp ? sp.desc || "" : "",
      ...(g.propIds || []).map(pid => (SPELLPROP.get(pid) || {}).name || "")].join(" ").toLowerCase(); };
    let list = spellGems.filter(g => (!st.libCls || gemClass(g) === st.libCls) && (!q || gemText(g).includes(q)));
    if (st.hideEquipped) list = list.filter(g => !spellGemEquippedInBuild(g.id) || (equipped && equipped.has(g.id)));
    const potOf = (g) => { const sp = gemSpell(g); return sp ? potencyRank(sp) : POTENCY_ORDER.length; };
    list = list.slice().sort(sortK === "name" ? (x, y) => d * gemName(x).localeCompare(gemName(y))
      : sortK === "level" ? (x, y) => d * (gemTier(y) - gemTier(x)) || gemName(x).localeCompare(gemName(y))
      : sortK === "potency" ? (x, y) => { const rx = potOf(x), ry = potOf(y), none = POTENCY_ORDER.length;
          if ((rx === none) !== (ry === none)) return rx === none ? 1 : -1;   // no potency stays last either way
          return d * (rx - ry) || gemName(x).localeCompare(gemName(y)); }
      : (x, y) => d * (y.id - x.id));
    const libBar = `<div class="ovl-filterbar lib-bar">
        <select class="app-select${st.libCls ? " on" : ""}" data-action="lib-cls" title="Filter by class">
          <option value="" ${!st.libCls ? "selected" : ""}>Class</option>${SPELL_CLASSES.map(cl => `<option value="${cl}" ${st.libCls === cl ? "selected" : ""}>${cl}</option>`).join("")}</select>
        <span class="sg-sort-gap"></span>
        ${libSortSeg(st, [["recent", "Recent", true], ["name", "A–Z", false], ["level", "Level", true], ["potency", "Potency", true]])}</div>`;
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
      || `<div class="slot-sub" style="padding:10px">No spell gems${spellGems.length ? " match" : " yet — build one"}.</div>`;
    let info = "";
    if (sel) {
      const sp = gemSpell(sel);
      const propRows = (sel.propIds || []).map(pid => { const p = SPELLPROP.get(pid);
        return libRow(p && p.icon, p ? p.name : pid, p ? propShort(p, gemTier(sel)) : ""); }).join("");
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
      const rows = spellPickRows(st, spellPickList(st), s => `<div class="prop-row rich ${g.spellId === s.id ? "chosen" : ""}" data-action="sg-spell" data-id="${s.id}">
          <span class="prop-ico">${spellIcon(s) ? spriteImg(spellIcon(s), "px") : ""}</span>
          <div class="prop-body"><div class="prop-name">${esc(s.name)}${spellMeta(s) ? `<span class="prop-metatag">${esc(spellMeta(s))}</span>` : ""}</div>
            ${s.desc ? `<div class="prop-sub clamp">${perkText(s.desc)}</div>` : ""}</div></div>`);
      // right info panel — preview the highlighted spell's full effect + stats before committing to it
      // (only shown once a spell is chosen; no empty placeholder panel)
      const chosen = g.spellId != null ? SPELL.get(g.spellId) : null;
      const info = chosen
        ? `<div class="ns-info-head"><span class="ns-info-icon">${spellIcon(chosen) ? spriteImg(spellIcon(chosen), "px") : ""}</span><h3>${esc(chosen.name)}</h3></div>
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
            <div class="as-sub">${esc(propShort(p, tier))}</div></div>`); }
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
            <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}</span><span class="prop-stat">${esc(propText(p, tier))}</span></div>`).join("");
        picker = `<div class="sgb-picker" data-action="noop">
          <div class="ovl-filterbar"><button class="chip" data-action="sg-closepick">‹ Done</button>
            <input class="ovl-search" placeholder="Search gemstone enchantments…" value="${esc(st.search)}" data-action="sg-search"></div>
          <div class="sgb-pick-scroll">${pr}</div></div>`;
      }
      body = `<div class="ovl-center" data-action="lib-deselect">
        <div class="sgb-top">
          <div class="build-section"><h3>Name</h3>
            <input class="ovl-search name-field" placeholder="${esc(gemSpell(g) ? gemSpell(g).name : "Spell gem name")}" value="${esc(g.name)}" data-action="sg-name" style="max-width:320px"></div>
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
    if (!gems.length) { closeDetail(); return ""; }
    const tiles = gems.map((g, gi) => {
      const sp = gemSpell(g), tier = gemTier(g);
      const props = (g.propIds || []).map(pid => { const p = SPELLPROP.get(pid); return p ? `<div class="prop-row static"${p.textNote ? ` title="${esc(p.textNote)}"` : ""}>
        <span class="prop-ico">${p.icon ? spriteImg(p.icon, "px") : ""}</span><span class="prop-name">${esc(p.name)}</span><span class="prop-stat">${esc(propShort(p, tier))}</span></div>` : ""; }).join("");
      const swapped = gemSwapClass(g);
      // ‹ › reorder the equipped gems (the header's class-colour dots follow the same order)
      const mv = gems.length > 1 ? `<span class="spt-move"><button class="spt-mv" data-action="spellpage-move" data-i="${gi}" data-d="-1" ${gi ? "" : "disabled"} title="Move earlier">‹</button><button class="spt-mv" data-action="spellpage-move" data-i="${gi}" data-d="1" ${gi < gems.length - 1 ? "" : "disabled"} title="Move later">›</button></span>` : "";
      return `<div class="art-spellcard spell-page-tile apx-clickable" data-action="spellpage-sel" data-id="${g.id}" title="Show in the Spell Gems list">
        <div class="art-spellcard-head">${mv}<span class="prop-ico">${spriteImg(gemIcon(g), "px")}</span>
          <b>${esc(gemName(g))}</b>${sp && gemName(g) !== sp.name ? `<span class="slot-sub">${esc(sp.name)}</span>` : ""}
          <span class="spt-tags">${sp && sp.cls ? `<span class="anoint-spec-tag" style="color:${clsColor(sp.cls)}">${esc(sp.cls)}${swapped ? ` → ${esc(swapped)}` : ""}</span>` : ""}<span class="rank-badge">Lv ${tier}</span></span></div>
        ${sp && sp.desc ? `<div class="trait-desc">${perkText(sp.desc)}</div>` : ""}
        ${sp ? spellStatsHtml(sp) : ""}
        ${props ? `<div class="prop-list spt-props">${props}</div>` : ""}</div>`;
    }).join("");
    return `<div class="ovl-backdrop" data-action="detail-backdrop"><div class="overlay-panel detail">
      <div class="overlay-header spells-hdr">${spellsHeaderHtml(st.slotIdx, `<button class="btn-ghost" data-action="spellpage-back">‹ Spell Gems</button>`)}<button class="ovl-close" data-action="close-detail">✕</button></div>
      <div class="overlay-body"><div class="ovl-center"><div class="ovl-center-scroll"><div class="spell-page-list">${tiles}</div></div></div></div>
      <div class="overlay-footer"><button class="btn-ghost" data-action="spellpage-back">‹ Back</button>
        <button class="btn-confirm" data-action="spellpage-done">Done</button></div>
    </div></div>`;
  }

  // creature spell slots (up to 3 equipped spell gems) — equip from the library
  function openCreatureSpells(slotIdx) {
    ovState = { kind: "spellgemlib", hideEquipped: false, sel: null, search: "", libCls: null, libSort: "recent", equipCtx: {
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
      case "open-glossary": openGlossary(); break;
      case "gloss-search": break;    // handled in onInput
      case "open-projects": if (FEATURES.projects) openProjects(); break;
      case "open-netherhelp": openNetherHelper(); break;
      case "nh-tab": ovState.tab = t.dataset.v; refreshOverlay(true); break;
      case "nh-valve": { const i = +t.dataset.i; ovState.valves[i] ^= 1; refreshOverlay(); break; }
      case "nh-code": ovState.valves = [...t.dataset.c].map(Number); refreshOverlay(); break;
      case "proj-search": break;     // handled in onInput
      case "proj-diff": ovState.ruthless = t.dataset.v === "ruthless"; refreshOverlay(true); break;
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
      case "facet-taxo": {
        const idxByKind = { cards: cardTaxoIndex, relic: relicTaxoIndex };
        const f = idxByKind[ovState.kind];
        openFacetPicker("taxo-cat", f ? { idxFn: f } : {});   // creature default = taxoIndex()
        break;
      }
      case "anoint-taxo": openFacetPicker("taxo-cat", { idxFn: anointTaxoIndex }); break;
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
      case "art-del": armOrDo(t, () => { const id = +t.dataset.id; artifacts = artifacts.filter(a => a.id !== id); build.slots.forEach(s => { if (s.artifactId === id) s.artifactId = null; }); if (ovState.sel === id) ovState.sel = null; persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
      case "artb-next": ovState.step = ovState.step === "type" ? "slots" : "name"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-back": ovState.step = ovState.step === "name" ? "slots" : "type"; ovState.pickType = null; ovState.preview = null; ovState.search = ""; refreshOverlay(true); break;
      case "artb-closecat": ovState.pickType = null; ovState.preview = null; ovState.search = ""; ovState.bkOnly = false; refreshOverlay(true); break;
      case "artb-traitfilter": openFacetPicker("taxo-cat", {
        idxFn: () => taxoIndexFor("titem", D.traitItems, ti => ti.taxo || []),
        onPick: (v) => { ovState.traitTaxo = v; } }); break;
      case "artb-traitfilter-clear": ovState.traitTaxo = null; refreshOverlay(); break;
      case "artb-bkonly": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      // shared spell picker bar (Spell Gem / Artifact / Nether Stone wizards)
      case "spf-sort": if (!ovState.spellSort) ovState.spellSort = "name"; sortPick(ovState, "spellSort", "spellSortRev", t.dataset.v); refreshOverlay(); break;
      case "spf-bk": ovState.bkOnly = !ovState.bkOnly; refreshOverlay(); break;
      case "artb-nsfilter": ovState[t.dataset.f] = !ovState[t.dataset.f]; refreshOverlay(); break;
      case "artb-nssort": if (!ovState.nsSort) ovState.nsSort = "recent"; sortPick(ovState, "nsSort", "nsSortRev", t.dataset.v); refreshOverlay(); break;
      // spell-gem builder spell picker filter (reuses the facet detail picker)
      case "sg-taxofilter": openFacetPicker("taxo-cat", {
        idxFn: () => taxoIndexFor("spell", D.spells, s => s.taxo || []),
        onPick: (v) => { ovState.spellTaxo = v; } }); break;
      case "sg-taxofilter-clear": ovState.spellTaxo = null; refreshOverlay(); break;
      // perk picker inline taxonomy filter
      case "perk-taxo-open": dovState.perkBrowse = true; refreshDetail(); break;
      case "perk-taxo-cat": dovState.perkCat = t.dataset.c; refreshDetail(); break;
      case "perk-taxo-val": dovState.perkTaxo = t.dataset.v; dovState.perkBrowse = false; dovState.perkCat = null; refreshDetail(); break;
      case "perk-taxo-clear": dovState.perkTaxo = null; dovState.perkCat = null; dovState.perkBrowse = false; refreshDetail(); break;
      case "perk-taxo-back": if (dovState.perkCat) dovState.perkCat = null; else dovState.perkBrowse = false; refreshDetail(); break;
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
        else if (arr.length < open) arr.push(v);                                // multi slot: independent, duplicates OK
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
        if ((build.slots[si].spellGemIds || []).some(id => spellGems.some(g => g.id === id))) openSpellsPage(si); break; }
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
        build.slots.forEach(s => s.spellGemIds = (s.spellGemIds || []).filter(x => x !== id));
        if (ovState.sel === id) ovState.sel = null;
        persistSpellGems(); persistArtifacts(); persistBuild(); refreshOverlay(); }); break;
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
        if (!d.name || !d.name.trim()) d.name = (SPELL.get(d.spellId) || {}).name || `Spell Gem ${nextSpellGemId}`;
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
      case "lib-sort": sortPick(ovState, "libSort", "libSortRev", t.dataset.v); refreshOverlay(); break;
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
        openAppendix(); ovState.tags = [k]; ovState.browsing = false; refreshOverlay(); break;
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
    if (A === "sg-name") { ovState.draft.name = v; return; }
    if (A === "builds-name") { ovState.draft.name = v; return; }
    if (A === "bio-text") { ovState.text = v; ovState.error = null; return; }
    if (A === "share-name") { ovState.name = v; return; }
    // search fields — live filter without losing caret
    const searchMap = { "crea-search": [OV, ovState], "spec-search": [OV, ovState], "artb-search": [OV, ovState],
      "relic-search": [OV, ovState], "cards-search": [OV, ovState], "anoint-search": [OV, ovState], "nether-search": [OV, ovState], "sg-search": [OV, ovState], "appendix-search": [OV, ovState], "shop-search": [OV, ovState], "realm-search": [OV, ovState], "riddle-search": [OV, ovState], "gloss-search": [OV, ovState], "proj-search": [OV, ovState], "lib-search": [OV, ovState], "facet-search": [DOV, dovState], "perk-search": [DOV, dovState], "pers-search": [DOV, dovState], "iconpick-search": [DOV, dovState], "skin-search": [DOV, dovState] };
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
    else if (A === "spf-kind") { ovState.spellKind = t.value || null; refreshOverlay(); }
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
