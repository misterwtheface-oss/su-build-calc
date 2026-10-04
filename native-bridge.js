/*
 * native-bridge.js — ads + "remove ads" purchase, active ONLY inside the Capacitor
 * Android shell (see app/). On the live website this is a HARD no-op: the first guard
 * returns before touching the DOM or any global, so GitHub Pages is completely unaffected.
 *
 * Why it can be a plain <script> on a remotely-loaded page (Option B, server.url):
 * Capacitor registers native plugins on window.Capacitor.Plugins.* at the native layer,
 * so we can call them without any bundler, npm import, or build step on the web side.
 *
 * Public API (only defined inside the shell):
 *   window.SUNative = { isNativeShell, isEntitled(), buyRemoveAds(), restorePurchases() }
 * app.js can feature-detect `window.SUNative?.isNativeShell` to show a "Remove ads"
 * menu item that exists only in the app build.
 */
(function () {
  const Cap = window.Capacitor;
  if (!Cap || typeof Cap.isNativePlatform !== "function" || !Cap.isNativePlatform()) {
    return; // ← WEBSITE PATH: do nothing at all.
  }

  const P = Cap.Plugins || {};
  const AdMob = P.AdMob || null;
  // Billing plugin global depends on which plugin you install — see app/README.md.
  // Left null in the stub; buy/restore fall back to a local entitlement so the flow is demoable.
  const Billing = P.InAppPurchase || P.InAppPurchases || P.CdvPurchase || null;

  const REMOVE_ADS_ID = "remove_ads";       // must match the Play Console managed product id
  const ENTITLEMENT_KEY = "su_remove_ads_entitled";

  const isEntitled = () => {
    try { return localStorage.getItem(ENTITLEMENT_KEY) === "1"; } catch { return false; }
  };
  const setEntitled = (v) => {
    try { localStorage.setItem(ENTITLEMENT_KEY, v ? "1" : "0"); } catch {}
  };

  // Google's official TEST banner unit — safe to ship while developing.
  // Replace with your real ad unit id (and set isTesting:false) before release.
  const TEST_BANNER_ID = "ca-app-pub-3940256099942544/6300978111";

  async function initAds() {
    if (!AdMob || isEntitled()) return;
    try {
      await AdMob.initialize({ initializeForTesting: true }); // TODO: remove for production
      await AdMob.showBanner({
        adId: TEST_BANNER_ID,                                 // TODO: real ad unit id
        adSize: "ADAPTIVE_BANNER",
        position: "BOTTOM_CENTER",
        margin: 0,
        isTesting: true,                                      // TODO: false before release
      });
    } catch (e) {
      console.warn("[native] AdMob init failed:", e);
    }
  }

  async function hideAds() {
    try { await AdMob?.hideBanner?.(); } catch {}
    try { await AdMob?.removeBanner?.(); } catch {}
  }

  // Query the store for owned products and reconcile the local entitlement flag.
  // STUB: with a real billing plugin, replace the body with a getPurchases() call.
  async function syncEntitlement() {
    if (Billing) {
      try {
        // const { purchases } = await Billing.getPurchases();
        // setEntitled(purchases.some((p) => p.productId === REMOVE_ADS_ID));
      } catch (e) {
        console.warn("[native] entitlement sync failed:", e);
      }
    }
    if (isEntitled()) await hideAds();
  }

  // Launch the purchase flow for the one-time "remove ads" unlock.
  // STUB: grants the entitlement locally so the end-to-end flow is demoable without
  // a real Play Billing product. Swap in Billing.purchase({ productId: REMOVE_ADS_ID }).
  async function buyRemoveAds() {
    try {
      // const result = await Billing.purchase({ productId: REMOVE_ADS_ID });
      // if (!result?.success) return { ok: false };
      setEntitled(true);
      await hideAds();
      return { ok: true, stub: !Billing };
    } catch (e) {
      console.warn("[native] purchase failed:", e);
      return { ok: false, error: String(e) };
    }
  }

  // Re-check entitlement (new device / reinstall). Play stores it per Google account,
  // so a non-consumable purchase comes back on restore. Google = good practice; Apple = required.
  async function restorePurchases() {
    try {
      // await Billing.restorePurchases();
      await syncEntitlement();
    } catch (e) {
      console.warn("[native] restore failed:", e);
    }
    return { entitled: isEntitled() };
  }

  window.SUNative = {
    isNativeShell: true,
    isEntitled,
    buyRemoveAds,
    restorePurchases,
  };

  const boot = async () => {
    await syncEntitlement();
    await initAds();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
