// Appendix › Speed › Dodge "Independent dodges ›" link: opens Taxonomy filtered to Dodge Chance + Roll: Independent, Back returns.
// usage: node tools/smoke.mjs off HYDRANOX tools/smoke_dodge_link.mjs   (SHOT=<png> saves 390 px screenshots)
export default async ({ act, evalJS, sleep, out, shot, viewport }) => {
  await viewport(390, 844);
  await act("open-errata"); await sleep(300);
  await evalJS(`document.querySelector('.apx-sec-head[data-c="Speed"]')?.click()`); await sleep(300);
  out.spdKeys = await evalJS(`[...document.querySelectorAll('[data-k^="SPD:"],[data-c^="SPD:"],[data-key^="SPD:"]')].map(b => (b.dataset.k||b.dataset.c||b.dataset.key) + ':' + b.dataset.action)`);
  await evalJS(`[...document.querySelectorAll('[data-k="SPD:dodge"],[data-c="SPD:dodge"],[data-key="SPD:dodge"]')][0]?.click()`); await sleep(300);
  out.link = await evalJS(`document.querySelector('[data-action="apx-tag-link"]')?.textContent`);
  if (process.env.SHOT) await shot(process.env.SHOT.replace('.png','_speed.png'));
  await evalJS(`document.querySelector('[data-action="apx-tag-link"]').click()`); await sleep(500);
  out.title = await evalJS(`document.querySelector('.overlay-header h2')?.textContent`);
  out.back = await evalJS(`document.querySelector('.ovl-nav-back')?.textContent`);
  out.chips = await evalJS(`[...document.querySelectorAll('.ovl-filterbar .facet')].map(b => b.textContent.trim())`);
  out.count = await evalJS(`document.querySelector('.ovl-filterbar .foot-info')?.textContent`);
  out.names = await evalJS(`[...document.querySelectorAll('.overlay-body .apx-name, .overlay-body .apx-line b')].slice(0,40).map(b=>b.textContent.trim())`);
  out.scrollW = await evalJS(`[document.documentElement.scrollWidth, innerWidth]`);
  if (process.env.SHOT) await shot(process.env.SHOT);
  await evalJS(`document.querySelector('.ovl-nav-back').click()`); await sleep(400);
  out.afterBack = await evalJS(`[document.querySelector('.overlay-header h2')?.textContent, !!document.querySelector('[data-action="apx-tag-link"]')]`);
};
