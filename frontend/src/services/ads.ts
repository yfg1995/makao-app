// Card Rush Arena – mock rewarded ad service.
// Replace with Google AdMob (`react-native-google-mobile-ads`) before Play Store.
// All rewards are validated server-side via /api/ads/claim — this module only
// drives the simulated viewing experience.
export async function showRewardedAd(opts?: { simulateSeconds?: number }): Promise<{ completed: boolean }> {
  const seconds = opts?.simulateSeconds ?? 3;
  return new Promise(resolve => {
    setTimeout(() => resolve({ completed: true }), seconds * 1000);
  });
}

// Placeholders for future AdMob unit IDs (TEST IDs only; replace before release).
export const AD_UNITS = {
  rewarded: {
    android: "ca-app-pub-3940256099942544/5224354917", // Google test ID
    ios: "ca-app-pub-3940256099942544/1712485313",
  },
  interstitial: {
    android: "ca-app-pub-3940256099942544/1033173712",
    ios: "ca-app-pub-3940256099942544/4411468910",
  },
};
