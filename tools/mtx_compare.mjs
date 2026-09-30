import fs from 'node:fs';
const MTX="C:/Users/miste/Downloads/Siralim Ultimate - Player Resource - Trait_MTX.csv";
const OUT="C:/Users/miste/claude_workspace";
function parseCSV(txt){const rows=[];let row=[],cur="",q=false;for(let i=0;i<txt.length;i++){const c=txt[i];
 if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}
 else{if(c==='"')q=true;else if(c===','){row.push(cur);cur="";}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur="";}else if(c==='\r'){}else cur+=c;}}
 if(cur.length||row.length){row.push(cur);rows.push(row);}return rows;}
const rows=parseCSV(fs.readFileSync(MTX,"utf8"));
const H=rows[0];
const colMap={};let cat=null;
for(let i=4;i<H.length;i++){const h=(H[i]||"").trim();if(!h)continue;
 if(h.endsWith(":")){cat=h.slice(0,-1).trim();continue;}
 if(["Manual Search","Search"].includes(h)){continue;}
 if(cat)colMap[i]={cat,val:h};}

const D=JSON.parse(fs.readFileSync(OUT+"/su-build-calc/data.js","utf8").replace(/^[^{]*/,"").replace(/;\s*$/,""));
const N=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,"");
const ND=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const CAT_ALIAS={"relatedminions":"relatedminion"};
const catKey=c=>CAT_ALIAS[N(c)]||N(c);
const sheetKeyOf=(cat,val)=>catKey(cat)+"|"+N(val);

// ---- classify a sheet row into a like-group ----
const groupOf=t=>{t=(t||"").trim();if(t==="Trait")return"trait";if(t==="Spell")return"spell";if(/ Perk$/.test(t))return"perk";return null;};

// ---- build our per-group lookups (by name + desc) and per-group vocab ----
function buildGroup(entities,descFn){const byName=new Map(),byDesc=new Map(),vocab=new Set();
 for(const e of entities){const m=new Map();const tx=e.taxo||[],sr=e.taxoSrc||[];
  for(let i=0;i<tx.length;i++){const [c,v]=tx[i].split("::");const k=catKey(c)+"|"+N(v);m.set(k,{cat:c,val:v,src:sr[i]||"?"});vocab.add(k);}
  const rec={name:e.name,desc:descFn(e)||"",tags:m,spec:e._spec};
  const nk=N(e.name);if(!byName.has(nk))byName.set(nk,rec);       // first wins
  const dk=ND(rec.desc);if(dk&&!byDesc.has(dk))byDesc.set(dk,rec);}
 return {byName,byDesc,vocab};}

const perkEnts=[].concat(...(D.specs||[]).map(s=>(s.perks||[]).map(p=>({...p,_spec:s.label}))));
const G={
 trait: buildGroup(Object.values(D.traits||{}), e=>e.desc),
 spell: buildGroup(D.spells||[], e=>e.desc),
 perk:  buildGroup(perkEnts, e=>e.desc),
};
// perks: also index by spec+name to disambiguate cross-spec name reuse
G.perk.bySpecName=new Map(); for(const e of perkEnts)G.perk.bySpecName.set(N(e._spec)+"|"+N(e.name),{name:e.name,desc:e.desc||"",tags:(()=>{const m=new Map();const tx=e.taxo||[],sr=e.taxoSrc||[];for(let i=0;i<tx.length;i++){const[c,v]=tx[i].split("::");m.set(catKey(c)+"|"+N(v),{cat:c,val:v,src:sr[i]||"?"});}return m;})()});

const sheetVals=new Set();for(const i in colMap){const{cat,val}=colMap[i];sheetVals.add(sheetKeyOf(cat,val));}
const comparableByGroup={trait:new Set([...sheetVals].filter(k=>G.trait.vocab.has(k))),spell:new Set([...sheetVals].filter(k=>G.spell.vocab.has(k))),perk:new Set([...sheetVals].filter(k=>G.perk.vocab.has(k)))};

const HEADER_NAMES=new Set(["","Name"]);
const stats={trait:{byName:0,byDesc:0,un:0},spell:{byName:0,byDesc:0,un:0},perk:{bySpec:0,byName:0,byDesc:0,un:0}};
const diffs=[]; const gaps={trait:[],spell:[],perk:[]};
const sc={}; // key: group||category||value

for(let r=1;r<rows.length;r++){const row=rows[r];const name=(row[0]||"").trim();if(HEADER_NAMES.has(name)||!name)continue;
 const g=groupOf(row[1]); if(!g)continue;
 const desc=(row[3]||"").trim();
 const uset=new Set();for(const i in colMap){if((row[i]||"").trim().toUpperCase()==="X"){const{cat,val}=colMap[i];uset.add(sheetKeyOf(cat,val));}}
 // resolve our record within the SAME group
 let o=null;
 if(g==="perk"){const spec=N((row[1]||"").replace(/ Perk$/,""));o=G.perk.bySpecName.get(spec+"|"+N(name));if(o)stats.perk.bySpec++;else{o=G.perk.byName.get(N(name));if(o)stats.perk.byName++;}if(!o){o=G.perk.byDesc.get(ND(desc));if(o)stats.perk.byDesc++;}}
 else{o=G[g].byName.get(N(name));if(o)stats[g].byName++;else{o=G[g].byDesc.get(ND(desc));if(o)stats[g].byDesc++;}}
 if(!o){(g==="perk"?stats.perk.un++:stats[g].un++);gaps[g].push(name);continue;}
 const comparable=comparableByGroup[g];
 for(const key of comparable){const uHas=uset.has(key);const oe=o.tags.get(key);const oHas=!!oe;
  const [ck,vk]=key.split("|");const col=Object.values(colMap).find(c=>sheetKeyOf(c.cat,c.val)===key)||{};
  const dcat=oHas?oe.cat:(col.cat||ck),dval=oHas?oe.val:(col.val||vk);
  if(uHas||oHas){const sk=g+"||"+dcat+"||"+dval;const rec=sc[sk]||(sc[sk]={g,cat:dcat,val:dval,agree:0,we:0,sheet:0,src:oe?oe.src:""});if(uHas&&oHas)rec.agree++;else if(oHas)rec.we++;else rec.sheet++;}
  if(uHas===oHas)continue;
  diffs.push({group:g,trait:o.name,cat:dcat,val:dval,verdict:oHas?"WE_ONLY":"SHEET_ONLY",src:oe?oe.src:"",desc:o.desc});}}

const by={};for(const d of diffs){const k=d.group+"/"+d.verdict;by[k]=(by[k]||0)+1;}
console.log("=== per-group join ===");
console.log("trait: name",stats.trait.byName,"desc",stats.trait.byDesc,"unmatched",stats.trait.un,"(our",Object.keys(D.traits).length+")");
console.log("spell: name",stats.spell.byName,"desc",stats.spell.byDesc,"unmatched",stats.spell.un,"(our",(D.spells||[]).length+")");
console.log("perk:  spec+name",stats.perk.bySpec,"name",stats.perk.byName,"desc",stats.perk.byDesc,"unmatched",stats.perk.un,"(our",perkEnts.length+")");
console.log("\n=== disagreements by group/verdict ===");console.log(by);
console.log("comparable values — trait",comparableByGroup.trait.size,"spell",comparableByGroup.spell.size,"perk",comparableByGroup.perk.size);

// write outliers (with group col)
const clean=s=>(s||"").replace(/\s+/g," ").trim().slice(0,180);
const esc=x=>{x=String(x);return /[",\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x;};
diffs.sort((a,b)=>a.group.localeCompare(b.group)||a.verdict.localeCompare(b.verdict)||a.cat.localeCompare(b.cat)||a.val.localeCompare(b.val)||a.trait.localeCompare(b.trait));
const ol=["ok?,group,verdict,category,value,our_src,name,description"];
for(const d of diffs)ol.push([" ",d.group,d.verdict,d.cat,d.val,d.src,d.trait,clean(d.desc)].map(esc).join(","));
fs.writeFileSync(OUT+"/taxonomy_mtx_outliers.csv",ol.join("\n"));
// scorecard
const scRows=Object.values(sc).map(r=>{const tot=r.agree+r.we+r.sheet;return{...r,tot,weRate:tot?r.we/tot:0,shRate:tot?r.sheet/tot:0};});
scRows.sort((a,b)=>a.g.localeCompare(b.g)||b.we-a.we);
const scl=["group,category,value,src,agree,we_only,sheet_only,total,we_only_rate,sheet_only_rate"];
for(const r of scRows)scl.push([r.g,r.cat,r.val,r.src,r.agree,r.we,r.sheet,r.tot,r.weRate.toFixed(2),r.shRate.toFixed(2)].map(esc).join(","));
fs.writeFileSync(OUT+"/taxonomy_mtx_scorecard.csv",scl.join("\n"));
fs.writeFileSync(OUT+"/taxonomy_mtx_name_gaps.txt",["# TRAIT gaps",...gaps.trait,"","# SPELL gaps",...gaps.spell,"","# PERK gaps",...gaps.perk].join("\n"));
console.log("\nwrote scorecard ("+scRows.length+" rows) + outliers ("+diffs.length+") + name_gaps");
console.log("\n=== TRAIT: top WE-OVER-TAG (we_only - agree) ===");
scRows.filter(r=>r.g==="trait"&&r.we>=10).sort((a,b)=>(b.we-b.agree)-(a.we-a.agree)).slice(0,12).forEach(r=>console.log((r.cat+"::"+r.val).slice(0,44).padEnd(45)+"agree "+String(r.agree).padStart(4)+"  we "+String(r.we).padStart(4)+"  sheet "+String(r.sheet).padStart(4)+"  ["+r.src+"]"));
