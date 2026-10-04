// stamp-cache.mjs — the SW cache-correctness stamp, shared by build-data.mjs and the git pre-commit hook.
//
// index.html is network-first in sw.js (always fresh online), but the js/css/data sub-resources are
// cache-first — keyed by their full URL including ?v=. So whenever app.js / styles.css / data.js change,
// their ?v= token MUST change or the service worker keeps serving the stale cached copy ("nothing
// changed after deploy"). This also rotates sw.js's BUILD token, whose value names the SHELL cache
// (`su-shell-${BUILD}`) so the old shell cache is purged on the next activate.
//
//   node tools/stamp-cache.mjs        # stamp in-place (used by the pre-commit hook)
//   import { stampCache } from './tools/stamp-cache.mjs'   # called at the end of build-data.mjs

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const md5 = (buf) => crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);

// Re-stamp index.html ?v= tokens + sw.js BUILD from the current content of the shipped bundle.
// Only writes files that actually change; returns the list of files it touched.
export function stampCache(root) {
  const bundle = ['data.js', 'effects.js', 'app.js', 'styles.css', 'native-bridge.js'].filter((f) => fs.existsSync(path.join(root, f)));
  const touched = [];

  const idxPath = path.join(root, 'index.html');
  if (fs.existsSync(idxPath)) {
    const before = fs.readFileSync(idxPath, 'utf8');
    let idx = before;
    for (const file of bundle) {
      const v = md5(fs.readFileSync(path.join(root, file)));
      const esc = file.replace('.', '\\.');
      idx = idx.replace(new RegExp(`((?:src|href)=")((?:\\./)?${esc})(?:\\?v=[a-f0-9]+)?(")`, 'g'), `$1$2?v=${v}$3`);
    }
    if (idx !== before) { fs.writeFileSync(idxPath, idx); touched.push('index.html'); }
  }

  const swPath = path.join(root, 'sw.js');
  if (fs.existsSync(swPath) && bundle.length) {
    const build = md5(Buffer.concat(bundle.map((f) => fs.readFileSync(path.join(root, f)))));
    const before = fs.readFileSync(swPath, 'utf8');
    const sw = before.replace(/const BUILD = "[^"]*";/, `const BUILD = "${build}";`);
    if (sw !== before) { fs.writeFileSync(swPath, sw); touched.push('sw.js'); }
  }
  return touched;
}

// Run directly (git hook / manual): stamp and report.
if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const touched = stampCache(root);
  console.log(touched.length ? `stamp-cache: updated ${touched.join(', ')}` : 'stamp-cache: already current');
}
