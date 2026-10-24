// Taxonomy v2 (TAXONOMY_INTENT.md "Taxonomy v2", ratified 2026-10-19). Builds each object's v2 tags from
//   (a) its final v1 tags mapped through data/reference/taxonomy_crosswalk.json (keeps every approved v1 correction), and
//   (b) the extract's code layer _su_extract/data/model/taxo_v2_tags.json (code tags + split / dup answers + attributes).
// Merge rule (user 2026-10-19): union. Where the code tags a value, its entries (with their attributes) replace the
// v1-mapped ones for that value. A v1 split the code decided becomes the code's pick; one it could not decide keeps every
// candidate marked unverified (v: 'unverified') for the review queue. Theme (old Action/Mechanic) is derived; an old
// Action/Mechanic tag nothing re-derives is kept as Involves::<theme>.
//
// Shipped entry: { t: 'Category::Value', s?: scope, so?: source, r?: role, p?: phase, d?: delivery, rk?: relic rank,
//   cf?: cast_from, co?: count_of, cn?: count, ig?: ignores, x?: [other markers: crit / tick_kind / property / except / suppresses],
//   ev?: [event], st?: [stat], sk?: [buff / debuff / minion], cl?: [class]   (round 7 markers, user 2026-10-24),
//   v: provenance }
// Themes (F5, user-ratified 2026-10-21): the crosswalk theme lines, a Source's own theme (Damage too only for adds_damage tags),
// marker themes (crosswalk marker_themes), what the object is; minus the object's code-layer involves_wrong themes.
// provenance = 'code' | the v1 tag's source (token / field / audit / llm / derived / …) | 'unverified'.

// An effect aimed at a participant of the triggering event ("event:damaged") takes the scope of the object's own trigger
// when that participant is the trigger's side (performer / receiver); otherwise the scope stays off.
const EVENT_SIDE = { damager: 'Performer', attacker: 'Performer', healer: 'Performer', caster: 'Performer', debuffer: 'Performer',
  gainer: 'Performer', 'turn creature': 'Performer', damaged: 'Receiver', attacked: 'Receiver', healed: 'Receiver',
  dying: 'Receiver', buffed: 'Receiver', debuffed: 'Receiver', recipient: 'Receiver', 'event target': 'Receiver' };
const FIXED_SCOPE = { 'gem owner': 'Self', 'event:each creature': 'Any' };
const CODE_BACKED = new Set(['code', 'code_boss', 'field']);
const SCOPE_OF_NAME = (old) => / Enemy /.test(' ' + old.slice(old.indexOf('::') + 2) + ' ') ? 'Enemy'
  : / Ally /.test(' ' + old.slice(old.indexOf('::') + 2) + ' ') ? 'Self or Ally' : null;

export function makeTaxoV2(X, CL) {
  const CLASS_TYPES = new Set(X.themes['Creature Class'].filter(p => p.startsWith('Creature Type::')).map(p => p.slice(15)));
  const SPELL_CLASS = new Set(['Chaos Spells', 'Death Spells', 'Life Spells', 'Nature Spells', 'Sorcery Spells']);
  const lookup = (old) => X.map[old] || X.map[old.slice(0, old.indexOf('::')) + '::*'] || null;
  const target = (rule, old) => {
    const val = old.slice(old.indexOf('::') + 2);
    if (rule.kind === 'split3') {
      if (SPELL_CLASS.has(val)) return ['Spell Class::' + val];
      if (/ Spells$/.test(val)) return ['Spell Kind::' + val];
      return ['Named Spell::' + val];
    }
    return (rule.to || []).map(t => t.endsWith('::*') ? t.slice(0, -1) + val : t);
  };
  const match = (pat, tag) => {
    if (pat.endsWith('*!class')) { const p = pat.slice(0, -7); return tag.startsWith(p) && !CLASS_TYPES.has(tag.slice(p.length)); }
    if (pat.includes('*!')) { const [p, ex] = pat.split('*!'); return tag.startsWith(p) && !ex.split('|').includes(tag.slice(p.length)); }
    return pat.endsWith('*') ? tag.startsWith(pat.slice(0, -1)) : tag === pat;
  };
  const themesOf = (tags) => Object.entries(X.themes).filter(([k]) => k !== '_note')
    .filter(([, pats]) => tags.some(t => pats.some(p => match(p, t)))).map(([k]) => k);
  const SRC = X.attributes.source;
  const sourced = (t) => SRC.applies_to.some(p => match(p, t));
  const srcDamage = (t) => (SRC.adds_damage || []).some(p => match(p, t));
  // markers: the code layer's tag markers the app filters on / derives themes from
  const MT = X.marker_themes || {};
  const markerX = (c) => [c.crit ? 'Critical hits only' : null, c.tick_kind || null, c.property || null, c.except ? `Except ${c.except}` : null,
    ...(c.suppresses || []).map(t => `Suppresses ${t.slice(t.indexOf('::') + 2)}`),
    // F5 rounds 5b-6b (no theme): counts = the hook raises a counter the effect reads, not a firing event; match = Class / Race Match
    // against one named type (Fixed) or another creature's (Same as); first_only = the creature's first death this battle
    c.counts === 'Activation Count' ? 'Counter' : null, c.match ? `Match: ${c.match}` : null, c.first_only ? 'First death only' : null,
    // round 7 (user 2026-10-24): Defer Pain's delayed share; the artifact slot an Artifacts::More Activations raises
    c.delayed ? 'Delayed to next turn' : null, c.slot || null].filter(Boolean);
  const markerThemes = (c) => [c.crit ? (MT.crit || {}).true : null, (MT.count || {})[String(c.count || '').replace(/\s*\(.*\)$/, '')],
    (MT.tick_kind || {})[c.tick_kind], (MT.property || {})[c.property], (MT.except || {})[c.except], (MT.cast_from || {})[c.cast_from],
    (MT.count_of || {})[c.count_of], ...(c.suppresses || []).map(t => (MT.suppresses || {})[t]),
    ...(c.event || []).map(e => (MT.event || {})[e])].filter(Boolean);
  // "Buffs|Debuffs::Apply" / "Stats::Has More|Less" = an open polarity or direction: both candidates
  const expand = (tag) => {
    const cat = tag.slice(0, tag.indexOf('::')), val = tag.slice(tag.indexOf('::') + 2);
    if (cat.includes('|')) return cat.split('|').map(k => k + '::' + val);
    if (val.includes('|')) { const [a, b] = val.split('|'); return [cat + '::' + a, cat + '::' + a.replace(/\S+$/, b)]; }
    return [tag];
  };
  // values the code layer dropped or retagged (f5.corrections) and no longer tags on that object, + the app-only drops
  // the extract named (crosswalk object_drops): a v1-mapped entry of that value goes too; a dropped Involves::X = theme X wrong
  const codeDrops = new Map();
  const addDrop = (key, t) => { if (!codeDrops.has(key)) codeDrops.set(key, new Set()); codeDrops.get(key).add(t); };
  for (const c of ((CL.f5 && CL.f5.corrections) || [])) if ((c.action === 'drop' || c.action === 'retag')
    && !(((CL.objects[c.key] || {}).tags) || []).some(t => t.tag === c.t)) addDrop(c.key, c.t);
  for (const [key, ts] of Object.entries(X.object_drops || {})) if (key !== '_note') for (const t of ts) addDrop(key, t);
  const stats = { removed: 0, codeDropped: 0, removedBy: {}, other: 0, trigUnverified: 0, eventScope: 0, eventScopeOff: 0, objects: 0, withCode: 0, entries: 0, code: 0, v1: 0, unverified: 0, involves: 0, wrongDropped: 0, unknown: {} };

  // vocabulary: every value the crosswalk can produce + the code-only new values (+ open families)
  const vocab = new Set(Object.keys(X.new_values).filter(k => k !== '_note'));
  for (const r of Object.values(X.map)) for (const t of r.to || []) vocab.add(t);
  const known = (t) => vocab.has(t) || [...vocab].some(v => v.endsWith('::*') && t.startsWith(v.slice(0, -1)))
    || /^(Creature Type|Named Spell|Spell Class|Spell Kind|Involves)::/.test(t);

  // opts.rankOf(site) → the relic rank whose code clause holds that site (relics only; null when the site is in no clause)
  function build(kind, id, taxo, taxoSrc, opts = {}) {
    stats.objects++;
    const code = CL.objects[`${kind}:${id}`] || null;
    if (code && code.has_signature) stats.withCode++;
    const v1 = [];            // v1-mapped entries
    const oldThemes = [];
    const coSources = Object.entries(SRC.from_old).filter(([t]) => taxo.includes(t)).map(([, v]) => v);
    taxo.forEach((old, i) => {
      const prov = (taxoSrc && taxoSrc[i]) || 'derived';
      if (old.startsWith('Action/Mechanic::') && !X.map[old]) { oldThemes.push([old.slice(17), prov]); return; }
      const rule = lookup(old); if (!rule || rule.kind === 'drop') return;
      let tos = target(rule, old), v = prov;
      if (rule.kind === 'split') {
        const ans = code && code.split && code.split[old];
        if (ans && Array.isArray(ans.v2) && ans.v2.length) {
          tos = ans.v2.flatMap(expand); v = tos.length > ans.v2.length ? 'unverified' : 'code';
        } else v = 'unverified';
      } else if (rule.kind === 'dup') {
        const ans = code && ((code.dup && code.dup[old]) || (code.dupResolved && code.dupResolved[old]));
        if (ans && Array.isArray(ans.v2)) { tos = ans.v2; v = 'code'; }
        else if (taxo.some(t => { const r = lookup(t); return r && r.kind !== 'dup' && target(r, t).includes(rule.trigger); })) v = 'unverified';
      }
      const base = { s: rule.kind === 'scope' ? SCOPE_OF_NAME(old) : null, r: rule.role || null, v };
      for (const t of tos) {
        const srcs = rule.source ? [rule.source] : sourced(t) && coSources.length ? coSources : [null];
        for (const so of srcs) v1.push({ t, ...base, so, old, ...(v === 'unverified' ? { why: rule.kind === 'dup' ? 'outcome vs trigger the code did not settle' : 'split the code did not settle' } : {}) });
      }
    });
    // code entries: replace the v1-mapped entries of every value the code tags
    // An open polarity / direction ("Buffs|Debuffs::Apply", "Stats::Has More|Less") is both candidates, unverified.
    const codeE = ((code && code.tags) || []).flatMap(c => {
      const alts = expand(c.tag);
      // relic rank: the code layer's own `rank` (F5), else the rank clause that holds the site
      const rk = c.rank != null ? +c.rank : opts.rankOf ? opts.rankOf(c.site) : null;
      const mx = markerX(c);
      return alts.map(t => ({ t, s: c.scope || null, so: c.source || null, r: c.role || null, p: c.phase || null, rk,
        // "Cast Count (count_of Side Casts)" = count Cast Count + count_of Side Casts
        cf: c.cast_from || null, co: c.count_of || (/\(count_of ([^)]+)\)/.exec(c.count || '') || [])[1] || null,
        cn: c.count ? String(c.count).replace(/\s*\(count_of [^)]+\)$/, '') : null, ig: c.ignores || null, x: mx.length ? mx : null, mth: markerThemes(c),
        // round 7 markers (user 2026-10-24): ev = the event an Events:: value re-runs / suppresses; st / sk / cl = the stat /
        // status / class the code names on this very tag entry (tag-bound values only)
        ev: (c.event || []).length ? c.event : null, st: (c.stat_marker || []).length ? c.stat_marker : null,
        sk: (c.status_marker || []).length ? c.status_marker : null, cl: (c.class_marker || []).length ? c.class_marker : null,
        // round 7F (user 2026-10-24): an intercept / redirect resolves as Indirect (new event, no source) or the Same hit; its
        // share: Whole (original takes 0) / Split (original keeps part) / Copy (original keeps all, others take extra)
        ra: c.resolves_as || null, sh: c.share || null,
        // Targeting::All inferred only from "no picker call" is a guess while random-by-index picks are undecoded
        // (Abnegation hits a random enemy): unverified until the extract decodes it
        d: c.delivery || null, v: alts.length > 1 || / no picker call/.test(c.picker || '') ? 'unverified' : 'code',
        ...(alts.length > 1 ? { why: 'polarity / direction open in the code layer' } : / no picker call/.test(c.picker || '') ? { why: 'Targeting::All inferred from no picker call (random-by-index undecoded)' } : {}) }));
    });
    // event-relative scopes → the trigger's scope (see EVENT_SIDE)
    const trig = codeE.filter(e => e.t.startsWith('Trigger::') && e.s && !e.s.startsWith('event:'));
    for (const e of codeE) {
      if (!e.s) continue;
      if (FIXED_SCOPE[e.s]) { e.s = FIXED_SCOPE[e.s]; continue; }
      if (!e.s.startsWith('event:')) continue;
      const side = EVENT_SIDE[e.s.slice(6)];
      const m = [...new Set(trig.filter(x => (x.r || 'Performer') === side).map(x => x.s))];
      e.s = m.length === 1 ? m[0] : null; stats[m.length === 1 ? 'eventScope' : 'eventScopeOff']++;
    }
    const codeVals = new Set(codeE.map(e => e.t));
    // Triggers: a v1-only trigger on an object whose trigger(s) the code decoded is an anomaly (unverified): an old guess
    // (Abnegation's "Takes Damage") or a trigger the code layer missed (Furor's Turn Start).
    const codeTrig = codeE.some(e => e.t.startsWith('Trigger::'));
    const drops = codeDrops.get(`${kind}:${id}`) || new Set();
    const v1keep = v1.filter(e => !codeVals.has(e.t) && !(drops.has(e.t) && ++stats.codeDropped)).map(e => codeTrig && e.t.startsWith('Trigger::') && e.v !== 'unverified'
      ? (stats.trigUnverified++, { ...e, v: 'unverified', why: 'trigger the code layer does not have' }) : e);
    const all = [...codeE, ...v1keep];
    // user-ruled adds (crosswalk object_adds); each drops itself once the code layer tags its `unless_code_named` buff / debuff
    for (const a of (X.object_adds || {})[`${kind}:${id}`] || []) {
      const n = a.unless_code_named, codeHas = n && ((code && code.tags) || []).some(t => t.named === n || t.tag === `Named Buff::${n}` || t.tag === `Named Debuff::${n}`);
      if (codeHas) { (stats.addsDropped ||= []).push(`${kind}:${id} ${a.t} (code now has ${n})`); continue; }
      all.push({ t: a.t, s: null, r: null, v: 'code' }); stats.adds = (stats.adds || 0) + 1;
    }
    // dedupe on the full attribute key (an unverified duplicate of a firm entry goes)
    const seen = new Map();
    for (const e of all) {
      const k = [e.t, e.s, e.so, e.r, e.p, e.d, e.rk, e.cf, e.co, e.cn, e.ig, e.ra, e.sh, ...['x', 'ev', 'st', 'sk', 'cl'].map(a => (e[a] || []).join(','))].join('|');
      const prev = seen.get(k);
      if (!prev || (prev.v === 'unverified' && e.v !== 'unverified')) seen.set(k, e);
    }
    // an unverified candidate drops when the same value is already firm on the object
    const firm = new Set([...seen.values()].filter(e => e.v !== 'unverified').map(e => e.t));
    const merged = [...seen.values()].filter(e => e.v !== 'unverified' || !firm.has(e.t));
    // CODE-BACKED ONLY (user 2026-10-19: "remove anything that isn't code backed"; the extract works through the rest).
    // Kept: code (code layer or v1 code-grounded), code_boss, field (the game's own data fields). Removed and returned:
    // token / llm / audit / correction (build-time text fixes) / keyword / derived / every unverified candidate.
    const removed = merged.filter(e => !CODE_BACKED.has(e.v));
    const out = merged.filter(e => CODE_BACKED.has(e.v));
    // themes: derived from the tags + Source + what the object is; Involves for old code-grounded themes nothing re-derives
    const tags = out.map(e => e.t);
    const theme = new Set(themesOf(tags));
    // Source themes; a trait's spell-type "deals damage" (Inflict + Spell) is Damage, not Cast (crosswalk _theme_note)
    for (const e of out) if (e.so && sourced(e.t)) { if (srcDamage(e.t)) theme.add('Damage'); if (!(e.t === 'Damage::Inflict' && e.so === 'Spell')) theme.add(SRC.themes[e.so]); }
    for (const e of out) for (const th of e.mth || []) theme.add(th);
    for (const th of X.object_themes[kind] || []) theme.add(th);
    // the code layer's per-object rulings: a theme it found wrong on this object goes (involves_wrong, F5)
    const wrong = new Set([...((code && code.involves_wrong) || []).map(w => w.theme),
      ...[...drops].filter(t => t.startsWith('Involves::')).map(t => t.slice(10))]);
    for (const th of wrong) if (theme.delete(th)) stats.wrongDropped++;
    // theme-only = a theme carried only by an Involves tag (the code layer's own general tag, or an old v1 theme below):
    // no narrower tag, Source, marker or object kind gives it
    const narrow = new Set(themesOf(tags.filter(t => !t.startsWith('Involves::'))));
    for (const e of out) if (e.so && sourced(e.t)) { if (srcDamage(e.t)) narrow.add('Damage'); narrow.add(SRC.themes[e.so]); }
    for (const e of out) for (const th of e.mth || []) narrow.add(th);
    for (const th of X.object_themes[kind] || []) narrow.add(th);
    for (const [th, prov] of oldThemes) if (!theme.has(th) && !wrong.has(th)) {
      if (CODE_BACKED.has(prov)) { out.push({ t: 'Involves::' + th, v: prov }); theme.add(th); stats.involves++; }
      else removed.push({ t: 'Involves::' + th, v: prov });
    }
    for (const e of out) {
      stats.entries++; stats[e.v === 'code' ? 'code' : 'other']++;
      if (!known(e.t)) stats.unknown[e.t] = (stats.unknown[e.t] || 0) + 1;
      for (const k of ['s', 'so', 'r', 'p', 'd', 'rk', 'cf', 'co', 'cn', 'ig', 'x', 'ev', 'st', 'sk', 'cl', 'ra', 'sh']) if (e[k] == null) delete e[k];
      delete e.old; delete e.why; delete e.mth;
    }
    for (const e of removed) { stats.removed++; stats.removedBy[e.v] = (stats.removedBy[e.v] || 0) + 1; for (const k of ['s', 'so', 'r', 'p', 'd', 'rk', 'cf', 'co', 'cn', 'ig', 'x', 'ev', 'st', 'sk', 'cl', 'ra', 'sh']) if (e[k] == null) delete e[k]; delete e.mth; }
    return { taxo2: out, theme2: [...theme].sort(), removed, themeOnly: [...theme].filter(th => !narrow.has(th)).sort() };
  }

  // the v2 vocabulary in layer order (TAXONOMY_INTENT.md), values by use
  const LAYERS = ['Trigger', 'Condition', 'Damage', 'Calculation', 'Hit Resolution', 'Actions', 'Spell Gems', 'Buffs', 'Debuffs',
    'Life', 'Stats', 'Minions', 'Turns', 'Timeline', 'Traits', 'Type', 'Targeting', 'Scales With', 'Named Buff', 'Named Debuff',
    'Named Minion', 'Stat', 'Trait Kind', 'Creature Type', 'Spell Class', 'Spell Kind', 'Named Spell', 'Involves'];
  function vocabulary(counts) {
    const byCat = {};
    for (const [t, n] of Object.entries(counts)) { const c = t.slice(0, t.indexOf('::')); (byCat[c] ||= []).push([t.slice(c.length + 2), n]); }
    const cats = [...LAYERS.filter(c => byCat[c]), ...Object.keys(byCat).filter(c => !LAYERS.includes(c)).sort()];
    return cats.map(c => ({ category: c, values: byCat[c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v) }));
  }
  // mechanic groups (data/reference/taxonomy_groups.json): expand 'theme:X' + tag patterns over the vocabulary.
  // Returns [{ name, keys: ['Cat::Value', …] }] in vocabulary order + the values no group reaches.
  function groups(G, categories) {
    const all = categories.flatMap(c => c.values.map(v => c.category + '::' + v));
    const pats = (inc) => inc.flatMap(p => p.startsWith('theme:') ? [...(X.themes[p.slice(6)] || []), 'Involves::' + p.slice(6)] : [p]);
    const out = G.groups.map(g => { const ps = pats(g.include); return { name: g.name, keys: all.filter(t => ps.some(p => match(p, t))) }; });
    const reached = new Set(out.flatMap(g => g.keys));
    return { groups: out.filter(g => g.keys.length), orphans: all.filter(t => !reached.has(t)) };
  }
  return { build, vocabulary, groups, stats };
}
