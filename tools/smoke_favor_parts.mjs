// Realm page › Yield › Favor row expands to its breakdown (objects, Realm Quest, God Altar, Pandemonium Shrine); the parts
// sum to the Favor total and follow the favor-rank slider. usage: node tools/smoke.mjs off HYDRANOX tools/smoke_favor_parts.mjs
// (SHOT=<png> saves a 390 px screenshot)
export default async ({ act, evalJS, sleep, out, shot, viewport }) => {
  await viewport(390, 844);
  const id = await evalJS(`SU_DATA.realms.find(r => r.realm === "Forgotten Lab").id`);
  await act("open-realms"); await act("realm-sel", { id: String(id) }); await act("realm-favview", { v: "bars" });
  out.closed = await evalJS(`[!!document.querySelector('.rcat-expand'), document.querySelectorAll('.rcat-part').length]`);
  await evalJS(`document.querySelector('.rcat-expand').click()`); await sleep(300);
  const read = `(() => { const tot = +document.querySelector('.rcat-expand .rcat-val').textContent.replace(/,/g, '');
    const parts = [...document.querySelectorAll('.rcat-part')].map(r => [r.querySelector('.rcat-name').textContent, +r.querySelector('.rcat-val').textContent.replace(/,/g, '')]);
    return { tot, sum: Math.round(parts.reduce((s, p) => s + p[1], 0) * 100) / 100, parts }; })()`;
  out.r100 = await evalJS(read);
  if (process.env.SHOT) await shot(process.env.SHOT);
  // drag the slider to 0 (live update path, no re-render)
  await evalJS(`(() => { const s = document.querySelector('.fav-range'); s.value = 0; s.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(300);
  out.r0 = await evalJS(read);
  // Weighted | Full value toggle: totals switch mode, the breakdown still sums to the total
  await evalJS(`document.querySelector('[data-action="realm-ymode"][data-v="full"]').click()`); await sleep(300);
  out.fullOn = await evalJS(`document.querySelector('[data-action="realm-ymode"].on')?.textContent`);
  out.full_r0 = await evalJS(read);
  await act("realm-back"); await act("realm-mode", { v: "compare" });
  out.compareToggle = await evalJS(`document.querySelector('.rcmp-controls [data-action="realm-ymode"].on')?.textContent`);
  out.scrollW = await evalJS(`[document.documentElement.scrollWidth, innerWidth]`);
  if (process.env.SHOT) await shot(process.env.SHOT.replace(".png", "_compare.png"));
};
