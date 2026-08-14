const hasNotarizationCredentials = Boolean(
  process.env.APPLE_KEYCHAIN_PROFILE ||
  process.env.APPLE_API_KEY ||
  (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID),
);

// Developer ID builds require Hardened Runtime for notarization. Community
// builds use Apple's ad-hoc identity instead, which keeps the app bundle
// consistently signed without claiming a trusted developer identity.
const useAdHocSigning = !hasNotarizationCredentials;

module.exports = {
  appId: "com.lyricpresence.app",
  productName: "Lyric Presence",
  directories: {
    output: "release",
  },
  files: [
    "src/**/*",
    "package.json",
    "!src/index.js",
  ],
  extraResources: [
    {
      from: "build/trayTemplate.png",
      to: "trayTemplate.png",
    },
    {
      from: "build/trayTemplate@2x.png",
      to: "trayTemplate@2x.png",
    },
  ],
  asar: true,
  mac: {
    category: "public.app-category.music",
    target: ["dmg", "zip"],
    identity: useAdHocSigning ? "-" : undefined,
    hardenedRuntime: !useAdHocSigning,
    entitlements: "build/entitlements.mac.plist",
    entitlementsInherit: "build/entitlements.mac.inherit.plist",
    notarize: hasNotarizationCredentials,
    extendInfo: {
      LSUIElement: true,
      NSAppleEventsUsageDescription: "Lyric Presence reads the current Spotify track and playback position to synchronize lyrics in Discord.",
    },
  },
  dmg: {
    sign: false,
  },
  artifactName: "${productName}-${version}-${arch}.${ext}",
};
