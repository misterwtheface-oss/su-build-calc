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
    // relic: 0.1% of its stat per rank (→ 10% at rank 100). Deprived ignores relic effects.
    function relicContribs(slot) {
      const rel = slot.relic; if (!rel || ignores("relics")) return [];
      const r = env.RELIC.get(rel.id); if (!r || !r.statBonus) return [];
      return [{ prop: r.name, stat: r.statBonus, unit: "%", value: 0.1 * (rel.rank || 0) }];
    }
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
    // spell-gem slots: base 3 + the equipped artifact's "Spell Gem Slots" property (trick slot or a socketed nether
    // stone; flat +N by rank) + perk grants (targeted by race) + trait grants on the bearer
    const SLOT_STAT = "Spell Gem Slot";
    function gemSlotMax(slot) {
      if (!env.CREA.get(slot.cid)) return GEM_SLOT_BASE;
      let max = GEM_SLOT_BASE;
      for (const c of artifactContribs(env.resolveArtifact(slot))) if (c.stat === SLOT_STAT) max += c.value || 0;
      for (const r of rules) {
        if (r.op !== "gemSlots") continue;
        if (r.src.kind === "perk") { const rank = perkRuleRank(r.src); if (rank > 0 && targets(r.target, slot)) max += r.perRank * rank; }
        else if (env.slotTraitIds(slot).includes(r.src.id) && targets(r.target, slot)) max += r.value;
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

    return { STAT_KEYS, artifactContribs, netherContribs, relicContribs, foldCore, foldBonus, slotBonusPct,
             ignores, cap, gemSlotMax, equipClasses, battleStart };
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
