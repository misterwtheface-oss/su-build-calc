// Trigger scope of a perk / trait (creature detail "Triggers"). Read off the game's own description:
// t = who the TRIGGER clause names ("After your creatures attack, …"), a = who ACTS in the main clause ("…, your Animatus casts").
// Values: party · self · race:<Race> · class:<Class> · first:<n> · top:<stat>:<n>. A count written <x> scales with rank ("r<x>").
// Used by build-data.mjs (perks[].trigScope, traits[].trigScope); the app matches them against a party slot.
const STAT = { attack: "atk", intelligence: "int", defense: "def", speed: "spd", health: "hp" };
const N = "(?:<(\\d+(?:\\.\\d+)?)>|(\\d+))?\\s*";
const cnt = (m) => m[1] ? "r" + m[1] : (m[2] || 1);
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// subject phrases, specific before generic; in a trigger clause the first specific match wins and party / self stack with it
const SPECIFIC = [
  [new RegExp(`your ${N}creatures?(?:\\(s\\))? with the highest (?:maximum )?\\{STAT_(\\w+)\\}`, "i"), m => `top:${STAT[m[3].toLowerCase()]}:${cnt(m)}`],
  [new RegExp(`the first ${N}creatures?(?:\\(s\\))? in your party`, "i"), m => `first:${cnt(m)}`],
  [/your \{RACE_(\w+)\}/i, m => `race:${m[1]}`],
];
const GENERIC = [
  [/your \{CLASS_(\w+)\} creatures/i, m => `class:${m[1]}`],
  [/\b(?:your|of your|all your) (?:other |dead )?creatures\b|\byour creatures'|\ban ally\b|\ballies\b|\ball creatures\b|\bremaining creatures\b|\ba creature\b|\beach creature's\b/i, () => "party"],
  [/\bthis creature\b|\bthe bearer\b/i, () => "self"],
];
let SUBJ = [...SPECIFIC, ...GENERIC];
// plain race names ("your Familiars", "your Animatus", "your Herbling's") — the list comes from the creature data
export function setRaces(races) {
  const alt = [...new Set(races)].filter(Boolean).sort((x, y) => y.length - x.length).map(esc).join("|");
  SUBJ = alt ? [...SPECIFIC, [new RegExp(`\\byour (${alt})(?:s|es)?\\b`), m => `race:${m[1]}`], ...GENERIC] : [...SPECIFIC, ...GENERIC];
}
const LEAD = /^\s*(after|when|whenever|at the (?:start|end)|the first|if|before|while|each time|as long as)\b/i;
const TRIGGERED = /\b(after|when|whenever|at the (?:start|end)|the first time|each time|before)\b/i;
const VERB = /\b(gain|gains|cast|casts|deal|deals|recover|recovers|attack|attacks|are|is|have|has|summon|summons|take|takes|give|gives|steal|steals|start|starts|lose|loses|always|cannot|can|heal|heals|split|splits|fuse|fuses|grant|grants|provoke|provokes|defend|defends|also|become|becomes|move|moves|trigger|triggers|persist|persists|afflict|afflicts|resurrect|resurrects|contribute|contributes|counter-attack|maintain|seal|seals|copy|copies|activate|activates|share|shares|swap|swaps)\b/i;
function scan(text, into) {
  for (const [re, f] of SUBJ) { const m = text.match(re); if (!m) continue; const v = f(m); into.add(v); if (v !== "party" && v !== "self") break; }
}
// the main clause's subject = the phrase it opens with (the earliest match), not every party mention after it
function scanFirst(text, into) {
  let best = null;
  for (const [re, f] of SUBJ) { const m = text.match(re); if (m && (!best || m.index < best.i)) best = { i: m.index, v: f(m) }; }
  if (best) into.add(best.v);
}
export function triggerScope(desc) {
  const s = String(desc || "").replace(/\\n|\n/g, " ").replace(/\{C(?:OND)?DESC_\w+\}/g, "").replace(/\[[a-z0-9_]+(?:\s*,\s*\d+)*\]/g, "")
    .replace(/\{(?:ACTION|SPELL)_(\w+)\}/g, "$1")
    .replace(/\b(?:one of )?its allies\b/gi, "the enemy side").replace(/\bthe (?:enemy|target)\b/gi, "the foe");
  const t = new Set(), a = new Set();
  // only sentences that describe a trigger count (a passive "Your creatures deal 25% more damage" sentence is not one);
  // a text with no trigger wording at all keeps every sentence
  const sents = s.split(/(?<=\.)\s+/), trig = sents.filter(x => TRIGGERED.test(x));
  for (const sent of trig.length ? trig : sents) {
    let main = sent;
    // leading subordinate clauses ("After …,", "If …,") name the trigger; the main clause follows the last of them
    while (LEAD.test(main) && main.indexOf(",") > 0) { const ci = main.indexOf(","); scan(main.slice(0, ci), t); main = main.slice(ci + 1); }
    const m = main.trim(), v = m.match(VERB);
    scanFirst(v ? m.slice(0, v.index) : m.split(/\s+/).slice(0, 8).join(" "), a);
  }
  return { t: [...t], a: [...a] };
}
