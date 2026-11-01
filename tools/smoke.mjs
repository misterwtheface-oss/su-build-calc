// Headless-Chrome smoke runner for su-build-calc (CDP over Node's built-in WebSocket). Serves the app on a local port, loads
// it in headless Chrome, runs an optional check module, prints JSON (results + JS errors + HTTP failures), then stops both.
// usage: node tools/smoke.mjs <nyi:on|off> <gods comma list> [check module path]
//   the check module default-exports async ({ act, probe, evalJS, sleep, out, shot, viewport }) => {...}; see tools/smoke_relic_rows.mjs
// SEED=<json file> preloads localStorage. Promoted from session scratchpads 2026-11-01.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NYI = process.argv[2] === "on";
const GODS = (process.argv[3] || "HYDRANOX").split(",");
const PORT = 5190 + (NYI ? 1 : 0), DBG = 9340 + (NYI ? 1 : 0);
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".webp": "image/webp", ".webmanifest": "application/json" };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  const file = path.join(ROOT, path.normalize(p));
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end("nf"); return; }
    if (p === "/app.js" && NYI) buf = Buffer.from(buf.toString("utf8").replace("nyi: false", "nyi: true"));
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" }).end(buf);
  });
}).listen(PORT);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "su-smoke-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe",
  ["--headless=new", `--remote-debugging-port=${DBG}`, `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const cleanup = () => { try { chrome.kill(); } catch {} try { srv.close(); } catch {} };
process.on("exit", cleanup);

let targets;
for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${DBG}/json`)).json(); if (targets.length) break; } catch {} await sleep(250); }
const page = targets.find(t => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r));
let id = 0; const pending = new Map(); const errors = []; const failed = [];
ws.addEventListener("message", (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d.error); pending.delete(d.id); return; }
  if (d.method === "Runtime.exceptionThrown") errors.push("EXC " + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push("console.error " + d.params.args.map(a => a.value ?? a.description).join(" "));
  if (d.method === "Network.responseReceived" && d.params.response.status >= 400) failed.push(d.params.response.status + " " + d.params.response.url.replace(/^http:\/\/localhost:\d+/, ""));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.value ?? r.exceptionDetails?.text; };

await send("Runtime.enable"); await send("Network.enable"); await send("Page.enable");
const SEED = process.env.SEED ? fs.readFileSync(process.env.SEED, "utf8") : null;
if (SEED) await send("Page.addScriptToEvaluateOnNewDocument", { source: `if (!sessionStorage.seeded) { const o = ${SEED}; for (const k in o) localStorage.setItem(k, JSON.stringify(o[k])); sessionStorage.seeded = 1; }` });
await send("Page.navigate", { url: `http://localhost:${PORT}/` });
await sleep(4500);

const act = (a, ds = {}) => evalJS(`(() => { const b = document.createElement("button"); b.dataset.action = ${JSON.stringify(a)}; Object.assign(b.dataset, ${JSON.stringify(ds)}); document.querySelector(".overlay-panel") ? document.querySelector(".overlay-panel").appendChild(b) : document.body.appendChild(b); b.click(); b.remove(); })()`).then(() => sleep(250));
const probe = (sel) => evalJS(`(() => { const r = [...document.querySelectorAll(${JSON.stringify(sel)})]; return { n: r.length, first: r[0] ? r[0].outerHTML.replace(/\s+/g," ").slice(0, 400) : null }; })()`);
const out = {};
const extra = process.argv[4] ? (await import("file:///" + path.resolve(process.argv[4]).replace(/\\/g, "/"))).default : null;
const shot = async (name, w = 390, h = 844) => { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }); await sleep(500); const r = await send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(name, Buffer.from(r.data, "base64")); };
const viewport = (w, h) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }).then(() => sleep(400));
if (extra) await extra({ act, probe, evalJS, sleep, out, shot, viewport });
out.js_errors = errors; out.http_failures = failed.slice(0, 8);
console.log(JSON.stringify(out, null, 1));
cleanup(); process.exit(0);
