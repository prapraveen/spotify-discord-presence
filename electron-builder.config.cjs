const hasNotarizationCredentials = Boolean(
  process.env.APPLE_KEYCHAIN_PROFILE ||
  process.env.APPLE_API_KEY ||
  (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID),
);

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
  asar: true,
  mac: {
    category: "public.app-category.music",
    icon: "build/icon.png",
    target: ["dmg", "zip"],
    hardenedRuntime: true,
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
