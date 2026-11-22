// Realm page › Yield: every row with a value expands to what makes it up (realm objects, Treasure Chests, God Altar,
// Realm Quest ...; lazy-loaded per realm from assets/yield/). The parts sum to the row's total, follow the favor-rank
// slider and the Weighted | Full value toggle. usage: node tools/smoke.mjs off HYDRANOX tools/smoke_favor_parts.mjs
// (SHOT=<png> saves 390 px screenshots)
export default async ({ act, evalJS, sleep, out, shot, viewport }) => {
  await viewport(390, 844);
  const id = await evalJS(`SU_DATA.realms.find(r => r.realm === "Forgotten Lab").id`);
  await act("open-realms"); await act("realm-sel", { id: String(id) }); await act("realm-favview", { v: "bars" });
  out.expandable = await evalJS(`[...document.querySelectorAll('.rcat-expand')].map(r => r.dataset.k)`);
  for (const k of ["favor", "treasure", "resources", "emblems", "buff"])
    await evalJS(`document.querySelector('.rcat-expand[data-k="${k}"]').click()`), await sleep(400);
  // per open row: total vs sum of its parts (values as displayed; >= 1000 shown rounded)
  const read = `[...document.querySelectorAll('.rcat-expand')].filter(r => r.nextElementSibling && r.nextElementSibling.classList.contains('rcat-parts')).map(r => {
    const num = (t) => +t.replace(/,/g, '').replace('%', '');
    const parts = [...r.nextElementSibling.querySelectorAll('.rcat-part')].map(p => [p.querySelector('.rcat-name').textContent, num(p.querySelector('.rcat-val').textContent)]);
    return [r.dataset.k, num(r.querySelector('.rcat-val').textContent), Math.round(parts.reduce((s, p) => s + p[1], 0) * 100) / 100, parts.length, parts.slice(0, 3)]; })`;
  out.weighted_r100 = await evalJS(read);
  if (process.env.SHOT) await shot(process.env.SHOT);
  await evalJS(`(() => { const s = document.querySelector('.fav-range'); s.value = 0; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  out.weighted_r0 = await evalJS(read);
  await evalJS(`document.querySelector('[data-action="realm-ymode"][data-v="full"]').click()`); await sleep(400);
  out.full = await evalJS(read);
  await evalJS(`document.querySelector('[data-action="realm-diff"][data-v="ruthless"]').click()`); await sleep(400);
  out.full_ruthless = await evalJS(read);
  await act("realm-back"); await act("realm-mode", { v: "compare" });
  out.compareToggle = await evalJS(`document.querySelector('.rcmp-controls [data-action="realm-ymode"].on')?.textContent`);
  out.scrollW = await evalJS(`[document.documentElement.scrollWidth, innerWidth]`);
};
