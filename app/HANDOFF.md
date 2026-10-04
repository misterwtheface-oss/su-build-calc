# SU Build Calc — Android app shell: HANDOFF

Status as of 2026-09-30. Picking back up after data work is finished. Read this top-down.

---

## Intent

Ship a version of the SU Build Calculator on the **Google Play Store** that:
- Reuses the existing live site (no forked codebase).
- Shows **ads only in the store build**, never on the GitHub Pages website.
- Offers a **one-time "remove ads" in-app purchase** to cover the $25 publishing fee and
  give heavy users a clean experience.
- The real payoff is **distribution / discoverability**, not ad revenue (which is pennies at
  this scale).

Fee reminder: Play Console is **$25 one-time per account** (covers every calculator), 15% cut
on in-app purchases up to $1M/yr.

---

## Architecture decision: Option B (remote shell)

The app is a thin **Capacitor** Android webview pointed at the **live** site
(`https://misterwtheface-oss.github.io/su-build-calc/` via `server.url` in
`app/capacitor.config.json`).

**Consequence:** content updates ship with a normal `git push` to Pages — no store
re-release. A new store release is only needed when the *native* layer changes (ad ids,
plugins, app version, billing). The alternative (Option A, bundle the site into the APK) was
rejected because it would force a store re-release on every content change.

**Why ads are store-only:** all ad logic is in `native-bridge.js` (repo root, served by
Pages). Its first line returns unless `Capacitor.isNativePlatform()` is true, so it's a hard
no-op for website visitors. And AdMob is a native plugin that doesn't exist in a plain
browser anyway. Two independent guarantees.

---

## What's DONE and verified

- **Files created:**
  - `native-bridge.js` (repo root) — ads + remove-ads logic. Inert on web; active in shell.
    Uses Google's **test** ad unit. `window.SUNative` API: `isNativeShell`, `isEntitled()`,
    `buyRemoveAds()`, `restorePurchases()`. Purchase flow is a **working stub** (grants
    entitlement locally so it's demoable before a real Play product exists).
  - `index.html` — bridge `<script>` added (committed already; see blocker below).
  - `tools/stamp-cache.mjs` — now also stamps `native-bridge.js`'s `?v=` token.
  - `app/` — Capacitor project: `capacitor.config.json` (Option B), `package.json`,
    `README.md` (full build+publish guide), `.gitignore`, `www/index.html` (offline splash).
- **Toolchain confirmed:** Node v24, npm 11. No system Java — **Android Studio's bundled JDK
  25** at `C:\Program Files\Android\Android Studio\jbr` is used for Gradle (works fine with
  the scaffolded Gradle 8.2.1).
- **Native project generated:** `npm install` + `npx cap add android` done. AdMob plugin
  (`@capacitor-community/admob@6.2.0`) registered.
- **AdMob test App ID** added to `app/android/app/src/main/AndroidManifest.xml`
  (`ca-app-pub-3940256099942544~3347511713`).
- **Build + install works:** `gradlew installDebug` → BUILD SUCCESSFUL, installed on
  `emulator-5554` (Pixel 7, API 34, **has Google Play Services** — required for AdMob).
- **App runs and loads the live site:** logcat confirmed
  `Capacitor: Loading app at https://misterwtheface-oss.github.io/su-build-calc/` → App started.

---

## CURRENT BLOCKER (why no ad banner yet)

`native-bridge.js` returns **HTTP 404 on the live site** — it's an **untracked** file that was
never committed/pushed:

```
git status → ?? native-bridge.js      (new file, skipped by `git commit -a`)
            ?? app/
curl live native-bridge.js → HTTP 404
```

`index.html` *is* committed and references `native-bridge.js?v=443dd2af`, but the file behind
it isn't deployed → the webview can't load the ad code → no banner. (Verified it's NOT a GMS
or emulator problem — Play Services are present and the ad code simply never ran.)

---

## NEXT STEP when we revisit (the actual fix)

1. **Commit the new files so they deploy.** The trap last time: `git commit -a` only stages
   tracked files, so the brand-new `native-bridge.js` was skipped. Explicitly add it:
   ```
   git add native-bridge.js app/ tools/stamp-cache.mjs
   git commit            # pre-commit hook re-stamps index.html/sw.js; never --no-verify
   git push
   ```
   Note: `tools/stamp-cache.mjs` was edited to include `native-bridge.js`. The pre-commit
   hook re-stamps `index.html` from the working-tree `data.js`, so commit this **together with
   (or after) the finished data work** to avoid `?v=` token drift between `index.html` and the
   deployed `data.js`.
2. **Relaunch the app** (needs network). The SW is network-first for HTML, so it pulls the
   fresh `index.html`; `native-bridge.js?v=443dd2af` is then fetched (no longer 404). Test
   banner should appear at the bottom.
   - Quick rebuild/relaunch without Studio:
     ```
     ADB="/c/Users/miste/AppData/Local/Android/Sdk/platform-tools/adb.exe"
     "$ADB" shell monkey -p io.github.misterwtheface.subuildcalc -c android.intent.category.LAUNCHER 1
     "$ADB" logcat -d | grep -iE "admob|banner|Capacitor"   # confirm ad code ran
     ```

---

## REMAINING work after the banner shows (not started)

- **"Remove ads" button in `app.js`** — gate on the shell so it only appears in the app:
  ```js
  if (window.SUNative?.isNativeShell) { /* render Remove-ads + Restore menu items */ }
  // buy:     await window.SUNative.buyRemoveAds();
  // restore: await window.SUNative.restorePurchases();
  ```
  (Restore is good practice on Google, required by Apple if iOS ever happens.)
- **Real billing plugin** — swap the stub: `npm i @capacitor-community/in-app-purchases`
  (or RevenueCat), uncomment the `Billing.*` calls in `native-bridge.js`, set the plugin
  global. Create managed non-consumable product id **`remove_ads`** in Play Console.
- **Production AdMob** — real App ID in AndroidManifest + real ad unit id in
  `native-bridge.js`; set `isTesting:false` and `initializeForTesting:false`. (Never click
  your own live ads — account-flag risk.)
- **Release signing** — Play App Signing + an upload keystore (Android Studio:
  Build → Generate Signed Bundle). Keep keystore out of git (`.gitignore` already excludes
  `*.keystore`/`*.jks`).
- **Build the `.aab`** — `cd app && npm run build:aab` →
  `android/app/build/outputs/bundle/release/app-release.aab`.
- **Play listing** — icon, feature graphic, screenshots, **privacy policy URL** (required once
  ads are served), **Data safety form** (declare ad-identifier collection). Upload to
  internal-testing track first, then production.

See `app/README.md` for the full publish checklist.

---

## Environment / quick reference

| Thing | Value |
|---|---|
| App id (package) | `io.github.misterwtheface.subuildcalc` |
| Android SDK | `C:\Users\miste\AppData\Local\Android\Sdk` |
| adb | `…\Sdk\platform-tools\adb.exe` |
| JDK for Gradle | `C:\Program Files\Android\Android Studio\jbr` (set `JAVA_HOME`) |
| Emulator | `emulator-5554` — Pixel 7, API 34, Google Play image |
| Build from CLI | `cd app/android && JAVA_HOME=…jbr ./gradlew installDebug` |
| Open in Studio | open the **`app/android`** folder; wait for Gradle sync before Run |

Studio "Run → boots to home, no app" earlier = Run fired before Gradle sync finished, so
nothing installed. Wait for the module dropdown to show **`app`**, then Run (or use the CLI
install above).
