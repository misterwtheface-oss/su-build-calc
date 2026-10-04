# SU Build Calc — Android app shell (Capacitor)

A thin native Android wrapper around the **live** build calculator, so it can ship on the
**Google Play Store** with ads and a one-time "remove ads" purchase. This folder is **never
served by GitHub Pages** — Pages only publishes the repo root. This is a parallel build you
run by hand (or in CI) only when cutting a store release.

## How it's wired (Option B — remote shell)

- `capacitor.config.json` sets `server.url` to the **live site**
  (`https://misterwtheface-oss.github.io/su-build-calc/`). The app is a webview over the
  real deploy, so **content updates ship with a normal `git push`** — no new store release
  needed. You only re-release when the *native* layer changes (ad ids, plugins, app version).
- Ads + purchase logic live in **`../native-bridge.js`** (repo root, served from Pages).
  It is a **hard no-op in a normal browser** and only activates when
  `window.Capacitor.isNativePlatform()` is true — i.e. inside this app. So the live website
  is unaffected by its presence.
- Native plugins register on `window.Capacitor.Plugins.*`, which is why the bridge works as a
  plain `<script>` on the remote page with no bundler.

> Want a fully-offline, self-contained app instead? Remove the `server` block from
> `capacitor.config.json` and copy the built site into `www/`. Trade-off: every content
> change then needs a store re-release. Option B is the default because it keeps one source
> of truth (the Pages deploy).

## Prerequisites (one-time, on your machine)

- **Node.js** (already on PATH for this repo).
- **Android Studio** (bundles the Android SDK + JDK). Open it once so it installs an SDK
  platform + build-tools.
- A **Google Play Console** account — the **$25 fee is one-time per account**, not per app,
  so it covers every calculator you ever publish.

## First-time setup

```bash
cd app
npm run setup       # npm install + npx cap add android + npx cap sync
```

This generates the native `android/` project (gitignored — regenerate any time).

## Dev loop

```bash
cd app
npm run sync        # after changing capacitor.config.json or plugins
npm run open        # opens android/ in Android Studio → Run on a device/emulator
```

Because of Option B, editing the actual calculator is just your normal workflow at the repo
root (`git push` to Pages). You do **not** re-run anything here for content changes.

## Ads (AdMob)

The `@capacitor-community/admob` plugin is already a dependency. Two ids are involved —
don't mix them up:

1. **AdMob App ID** — identifies the app. Goes in the Android manifest. After `npm run setup`,
   add inside `<application>` in `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <meta-data
     android:name="com.google.android.gms.ads.APPLICATION_ID"
     android:value="ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"/>
   ```
   (The build uses Google's test App ID until you set this.)
2. **Ad Unit ID** — identifies one ad slot. Goes in `../native-bridge.js` (`TEST_BANNER_ID`).
   It currently uses Google's **test banner unit** so you can develop safely.

**Before release:** in `../native-bridge.js` swap in your real ad unit id, set `isTesting:false`,
and set `initializeForTesting:false`. Shipping test-ad config to production, or clicking your
own live ads, will get the AdMob account flagged.

## "Remove ads" purchase (Play Billing)

In Play Console → your app → **Monetize → In-app products**, create a **managed (non-consumable)
product** with id **`remove_ads`** (must match `REMOVE_ADS_ID` in `../native-bridge.js`) and a
price (e.g. $1.99). Google's cut is **15%** up to $1M/yr per account.

`native-bridge.js` ships a **working stub**: the buy/restore functions grant the entitlement
locally so you can demo the whole flow (tap buy → banner disappears; restore re-checks) before
real billing exists. To make it real:

1. Add a billing plugin, e.g. `npm i @capacitor-community/in-app-purchases` (or RevenueCat's
   `@revenuecat/purchases-capacitor` for a managed entitlement layer).
2. In `native-bridge.js`, uncomment the `Billing.*` calls in `syncEntitlement`,
   `buyRemoveAds`, and `restorePurchases`, and set the `Billing` plugin global to match.
3. Add a **"Remove ads" / "Restore purchases"** button in the app's menu. In `app.js`,
   feature-detect the shell so it only appears in the app build:
   ```js
   if (window.SUNative?.isNativeShell) { /* render the Remove-ads menu item */ }
   // onClick:  await window.SUNative.buyRemoveAds();
   // restore:  await window.SUNative.restorePurchases();
   ```
   A **Restore purchases** button is good practice on Google and **required** by Apple if you
   ever do the iOS build.

## Build a release `.aab`

```bash
cd app
npm run build:aab   # android/app/build/outputs/bundle/release/app-release.aab
```

First real release needs an **upload key** (signing). Easiest path: let **Play App Signing**
manage the app key and generate an upload keystore via Android Studio
(`Build → Generate Signed Bundle`). Keep the keystore safe and **out of git** (the `.gitignore`
here already excludes `*.keystore` / `*.jks`).

## Publish checklist

- [ ] App ID set in `capacitor.config.json` (reverse-domain, no hyphens) — currently
      `io.github.misterwtheface.subuildcalc`.
- [ ] Real AdMob App ID in AndroidManifest + real ad unit id in `native-bridge.js`,
      `isTesting:false`.
- [ ] `remove_ads` product created in Play Console; billing plugin wired (or ship ads-only
      first and add the unlock later).
- [ ] App icons + feature graphic + screenshots (Play listing assets).
- [ ] Privacy policy URL (required once you serve ads / collect any data).
- [ ] Data safety form filled (ads SDKs collect device/ad identifiers — declare it).
- [ ] Signed `.aab` uploaded to an internal-testing track first, then production.
```
