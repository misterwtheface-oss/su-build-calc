/* Siralim Ultimate Companion — effects.js
 * The effect engine: every build-affecting stat source and perk/trait rule, computed in one place.
 * No DOM, no app state of its own — app.js hands it read accessors via SU_EFFECTS.create(env), so the
 * engine also runs under plain Node (tools/effects_test.mjs). See EFFECT_ENGINE.md. */
(function (root) {
  "use strict";
  const STAT_KEYS = ["hp", "atk", "def", "int", "spd"];
  const PROP_STAT = { Health: "hp", Attack: "atk", Defense: "def", Intelligence: "int", Speed: "spd" };
  const zero = () => ({ hp: 0, atk: 0, def: 0, int: 0, spd: 0 });
  // base values each cap starts from before rules apply
  const CAP_BASE = { anoints: 5, creatures: 6, avatars: 1 };
  const GEM_SLOT_BASE = 3;

  // env: {
  //   rules,                          D.effects.rules
  //   PRIMARY, propGroups, RELIC, TRAITITEM, CREA, SPEC,
  //   hasTrait(id),                   trait exists in the (feature-filtered) trait table
  //   build(), nether(),              current party + nether library
  //   resolveArtifact(slot),          slot -> artifact object | null
  //   perkRank(spec, perk),           allocated rank in the current build
  //   anointed(specId, key),          perk equipped as an anointment
  //   slotTraitIds(slot),             traits the slot carries (innate/fusion/artifact/nether)
  //   finalStats(slot),               the app's stat pipeline (for rules that read another creature's stats)
  //   slotClass(slot),                the slot's effective class (fusion → the secondary's)
  //   SPELL, spellGrants, relicUltimates, ultimateRoutes   granted spells (D.*, see grantedSpells)
  // }
  function create(env) {
    const rules = env.rules || [];

    // ── 1. stat contributions ───────────────────────────────────────────────
    // One ordered list per source: {prop, stat, unit, value}. `stat` is the raw property stat name
    // ("Attack", "Attack Damage", …); the folds below map the 5 core stats via PROP_STAT.
    function artifactContribs(a) {
      const out = []; if (!a) return out;
      const rank = a.rank || 50;
      if (a.primary) { const p = env.PRIMARY.find(x => x.property === a.primary); if (p) out.push({ prop: a.primary, stat: p.stat, unit: "%", value: p.perRank[rank] || 0 }); }
      for (const name of [...(a.stat || []), ...(a.trick || [])]) {
        const g = env.propGroups.get(name); if (!g) continue;
        for (const e of g.entries) out.push({ prop: name, stat: e.stat, unit: e.unit, value: e.perRank[rank] || 0 });
      }
      for (const nid of a.netherIds || []) out.push(...netherContribs(env.nether().find(x => x.id === nid)));
      return out;
    }
    // only stat/trick properties hit the stat table; an unknown property name falls back to itself as the stat
    function netherContribs(n) {
      const out = []; if (!n) return out;
      for (const pr of n.props || []) {
        if (pr.cat !== "stat" && pr.cat !== "trick") continue;
        const g = env.propGroups.get(pr.key), v = Number(pr.value) || 0;
        if (g) for (const e of g.entries) out.push({ prop: pr.key, stat: e.stat, unit: e.unit, value: v });
        else out.push({ prop: pr.key, stat: pr.key, unit: "%", value: v });
      }
      return out;
    }
    // relic: 0.1% of its stat per rank (→ 10% at rank 100). Deprived ignores relic effects. relicRanks rules (Forgotten
    // Blessing: +100) raise the rank for the stat bonus only (scr_RelicStatBonus), never the rank-gated Relic perks.
    function relicContribs(slot) {
      const rel = slot.relic; if (!rel || ignores("relics")) return [];
      const r = env.RELIC.get(rel.id); if (!r || !r.statBonus) return [];
      return [{ prop: r.name, stat: r.statBonus, unit: "%", value: 0.1 * ((rel.rank || 0) + relicRankBonus()) }];
    }
    function relicRankBonus() { return perkRules("relicRanks").reduce((n, x) => n + (x.rule.value || 0), 0); }
    // % per core stat (non-core entries dropped)
    function foldCore(list) {
      const out = zero();
      for (const c of list) { const k = PROP_STAT[c.stat]; if (k) out[k] += c.value; }
      return out;
    }
    // core % per stat + every non-core effect summed by property name with its unit (bonus tables)
    function foldBonus(list) {
      const core = zero(), extra = new Map();
      for (const c of list) {
        if (!c.value) continue;
        const k = PROP_STAT[c.stat];
        if (k) { core[k] += c.value; continue; }
        const cur = extra.get(c.prop) || { value: 0, unit: c.unit || "%" }; cur.value += c.value; extra.set(c.prop, cur);
      }
      return { core, extra };
    }
    // total bonus % per core stat for a party slot (artifact + its nether + relic), 2-dp rounded
    function slotBonusPct(slot) {
      const pct = foldCore(artifactContribs(env.resolveArtifact(slot)));
      const rp = foldCore(relicContribs(slot));
      for (const k of STAT_KEYS) pct[k] = Math.round((pct[k] + rp[k]) * 100) / 100;
      return pct;
    }

    // ── 2. rule sources ─────────────────────────────────────────────────────
    // A perk rule is live while its perk is allocated in the CURRENT spec (rank > 0) or, for
    // via "spec+anoint", while it is equipped as an Anointment (which counts at max rank).
    function perkRuleRank(src) {
      const b = env.build(), spec = env.SPEC.get(src.spec);
      const perk = spec && spec.perks.find(p => p.key === src.key); if (!perk) return 0;
      const specRank = b.specId === src.spec ? env.perkRank(spec, perk) : 0;
      const anoint = src.via === "spec+anoint" && env.anointed(src.spec, src.key) ? (perk.ranks || 1) : 0;
      return Math.max(specRank, anoint);
    }
    const slotHasTrait = (slot, id) => env.hasTrait(id) && env.slotTraitIds(slot).includes(id);
    const perkRules = (op) => rules.filter(r => r.op === op && r.src.kind === "perk")
      .map(r => ({ rule: r, rank: perkRuleRank(r.src) })).filter(x => x.rank > 0);
    // perk rules that don't depend on traits (caps / ignores) — kept separate so slotTraitIds can ask
    // `ignores("fusionTraits")` without recursing back into trait lookups
    function ignores(what) { return perkRules("ignore").some(x => x.rule.what === what); }

    // ── 3. rule ops ─────────────────────────────────────────────────────────
    // caps: base, then every "add" (value + perRank × rank), then any "set" overrides
    function cap(name) {
      let v = CAP_BASE[name];
      const live = perkRules("cap").filter(x => x.rule.cap === name);
      for (const { rule, rank } of live) if (rule.mode === "add") v += (rule.value || 0) + (rule.perRank || 0) * rank;
      for (const { rule } of live) if (rule.mode === "set") v = rule.value;
      return v;
    }
    const raceOf = (slot) => { const c = env.CREA.get(slot.cid); return c ? c.race : null; };
    const targets = (t, slot) => !t || (t.race == null || raceOf(slot) === t.race);
    // spell-gem slots = the game's scr_GetCreatureStat case 5 ("spellslots"): base 3 + the equipped artifact's "Spell Gem
    // Slots" property (trick slot or a socketed nether stone; flat +N by rank) + every gemSlots rule (effect_rules.json,
    // each with its code site). A rule applies to this creature when its source is live (perk: rank via scr_PerkLevel, so
    // anointments count; trait: on this creature, or scope "party" = on any creature on your side) and `target` (race)
    // matches. Amount: perRank x rank (perks) or value, x `per`: raceOnSide (your creatures of the target race),
    // uniqueClasses (distinct classes among your creatures), missingCreatures (6 - party size + perPlus perk ranks, max perCap).
    const SLOT_STAT = "Spell Gem Slot", PARTY_SIZE = 6;
    function gemSlotMax(slot) {
      if (!env.CREA.get(slot.cid)) return GEM_SLOT_BASE;
      let max = GEM_SLOT_BASE;
      for (const c of artifactContribs(env.resolveArtifact(slot))) if (c.stat === SLOT_STAT) max += c.value || 0;
      const party = env.build().slots.filter(s => env.CREA.get(s.cid));
      for (const r of rules) {
        if (r.op !== "gemSlots" || !targets(r.target, slot)) continue;
        let amt;
        if (r.src.kind === "perk") { const rank = perkRuleRank(r.src); if (!rank) continue; amt = r.perRank != null ? r.perRank * rank : r.value; }
        else { const on = r.scope === "party" ? party.some(s => slotHasTrait(s, r.src.id)) : slotHasTrait(slot, r.src.id); if (!on) continue; amt = r.value; }
        if (r.per === "raceOnSide") amt *= party.filter(s => raceOf(s) === r.target.race).length;
        else if (r.per === "uniqueClasses") amt *= new Set(party.map(s => env.slotClass(s)).filter(Boolean)).size;
        else if (r.per === "missingCreatures") {   // bc_GetMissingCreatureCount: empty slots + perPlus perk ranks (Companion), capped
          const n = Math.max(0, PARTY_SIZE - party.length) + (r.perPlus || []).reduce((t, p) => t + (perkRuleRank(p) || 0), 0);
          amt *= r.perCap != null ? Math.min(r.perCap, n) : n;
        }
        max += amt;
      }
      return max;
    }
    // spell-gem classes a slot may equip: null = any class, else the Set of allowed classes
    function equipClasses(slot, ownClass) {
      const set = new Set(ownClass ? [ownClass] : []);
      const any = rules.filter(r => r.op === "equip.anyClass");
      if (any.some(r => r.scope === "self" && slotHasTrait(slot, r.src.id))) return null;
      if (any.some(r => r.scope === "party" && env.build().slots.some(s => slotHasTrait(s, r.src.id)))) return null;
      for (const { rule } of perkRules("equip.addClass")) set.add(rule.cls);
      return set;
    }

    // ── 4. battle-start stat gains ──────────────────────────────────────────
    // Per party slot: the flat gains rules add at the start of battle, with a ledger naming each source.
    // Read-only (no UI consumes it yet); gains are exact (unrounded) shares of the source's STORED stats (pre-%; code-verified).
    function battleStart() {
      const slots = env.build().slots;
      const out = slots.map(() => ({ gain: zero(), ledger: [] }));
      for (const { rule, rank } of perkRules("stat.share")) {
        const from = slots[rule.from.slot];
        if (!from || !env.CREA.get(from.cid)) continue;            // the source party position must be filled
        const fs = env.finalStats(from); if (!fs) continue;
        const pct = (rule.pctPerRank || 0) * rank;
        slots.forEach((s, i) => {
          if (!env.CREA.get(s.cid) || !targets(rule.target, s)) return;
          for (const k of rule.stats) {
            const v = fs.adj[k] * pct / 100;   // game reads the source's STORED stat (before its % bonuses), unrounded
            out[i].gain[k] += v;
            out[i].ledger.push({ rule: rule.id, stat: k, value: v, pct, fromSlot: rule.from.slot });
          }
        });
      }
      return out;
    }

    // ── 4b. battle-start fusion copy (op fuse.copy, Animator's Endowment) ────────────────────
    // The live rule whose target is this slot → { rule, from } (from = the party slot it copies). The source position must
    // be filled and not the slot itself. Applied by the app's baseStats (stats, primary trait, race; class unchanged).
    function fuseCopy(slot) {
      const slots = env.build().slots;
      for (const { rule } of perkRules("fuse.copy")) {
        if (!targets(rule.target, slot)) continue;
        const from = slots[rule.from.slot];
        if (from && from !== slot && env.CREA.get(from.cid)) return { rule, from };
      }
      return null;
    }

    // ── 5. granted spells ───────────────────────────────────────────────────
    // Spells a slot gets from an owner instead of a held gem (D.spellGrants / relicUltimates / ultimateRoutes, code S28).
    // None of them use a spell-gem slot. Per entry: {spellId, mode, when, chance, owner}
    //   gem   — the creature gains the gem in battle (Rune perks, Zantai's traits, Colorwave, Idolatry → relic Ultimate)
    //   cast  — a chance to cast it (Fable rank 100, Doomsday, Immobility)
    //   replaceArtifactSpell — Weapons of Mass Distortion: the artifact's Spell-slot gem becomes the relic's Ultimate
    // False God part kits (mode boss) never reach a party slot. A perk counts while allocated in the current spec or
    // anointed; classGate = only creatures of the spell's own class (Rune of Cor → Chaos creatures, Colorwave per class).
    function grantedSpells(slot) {
      const c = env.CREA.get(slot.cid); if (!c) return [];
      const cls = env.slotClass ? env.slotClass(slot) : c.cls;   // a fused creature takes the secondary's class
      const out = [], seen = new Set();
      const live = (o) => o.kind === "perk" ? perkRuleRank({ spec: o.spec, key: o.key, via: "spec+anoint" }) > 0
        : o.kind === "trait" ? slotHasTrait(slot, o.id)
        : o.kind === "relic" ? !!slot.relic && slot.relic.id === o.id && !ignores("relics") : false;
      const add = (spellId, g) => {
        const k = spellId + "|" + g.mode; if (seen.has(k)) return; seen.add(k);
        out.push({ spellId, mode: g.mode, when: g.when || null, chance: g.chance || null, owner: g.owner });
      };
      for (const g of env.spellGrants || []) {
        if (g.mode === "boss" || !live(g.owner)) continue;
        if (g.minRank != null && (slot.relic.rank || 0) < g.minRank) continue;
        for (const id of g.spells) {
          if (g.classGate && (env.SPELL.get(id) || {}).cls !== cls) continue;
          add(id, g);
        }
      }
      const ult = slot.relic ? (env.relicUltimates || {})[slot.relic.id] : null;
      if (ult != null) for (const r of env.ultimateRoutes || []) {
        if (!live(r.owner)) continue;
        if (r.mode === "replaceArtifactSpell") { const a = env.resolveArtifact(slot); if (!a || !(a.spells || []).length) continue; }
        add(ult, r);
      }
      return out;
    }

    return { STAT_KEYS, artifactContribs, netherContribs, relicContribs, foldCore, foldBonus, slotBonusPct,
             ignores, cap, gemSlotMax, equipClasses, battleStart, fuseCopy, grantedSpells };
  }

  // Code-tier rules (prov 'code', decoded from the game's gated blocks) + the global combat pipeline ship lazily in
  // effects-code.json (D.effects.codeFile). Data only until an op in D.effects.codeOps gets an evaluator here.
  let _codeLoad = null;
  function loadCodeRules(url) {
    if (_codeLoad) return _codeLoad;
    if (typeof fetch !== "function") return Promise.reject(new Error("no fetch"));
    return (_codeLoad = fetch(url).then(r => r.json()));
  }

  const api = { create, loadCodeRules, STAT_KEYS, PROP_STAT, CAP_BASE, GEM_SLOT_BASE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.SU_EFFECTS = api;
})(typeof window !== "undefined" ? window : globalThis);
