// Relic rank rows: opens Triumvir / Whisper / Fleshripper / Blazefury in the relic picker and lists each rank's drop-down cards.
// usage: node tools/smoke.mjs off HYDRANOX tools/smoke_relic_rows.mjs   (SHOT=<png> saves a 390 px screenshot of Triumvir)
export default async ({ act, evalJS, sleep, out, shot, viewport }) => {
  await viewport(390, 844);
  for (const id of [26, 29, 11, 4]) {
    await act("build-relic", { slot: "0" });
    await act("relic-pick", { id: String(id) });
    await sleep(400);
    out["relic" + id] = await evalJS(`(() => {
      const rows = [...document.querySelectorAll('.perk-spell-row')];
      return rows.map(r => { const lab = r.closest('div[class]')?.parentElement?.textContent.match(/^[^.]{0,60}/)?.[0] || '';
        return [...r.querySelectorAll('.art-spellcard-head b, .sg-name')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 8).join(' | '); });
    })()`);
    if (id === 26) {
      await evalJS(`document.querySelectorAll('.perk-spell-row .sub-toggle')[3]?.click()`); await sleep(300);
      out.scrollW = await evalJS(`[document.documentElement.scrollWidth, innerWidth]`);
      if (process.env.SHOT) await shot(process.env.SHOT);
    }
    await evalJS(`document.querySelectorAll('[data-action="ovl-close"],[data-action="close-detail"],[data-action="dov-close"]').forEach(b => b.click())`);
    await act("ovl-close"); await sleep(200);
  }
};
