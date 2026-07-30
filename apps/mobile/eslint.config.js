// ESLint 9 flat config for the Expo app. `eslint-config-expo/flat` bundles the
// core, TypeScript, React, and Expo presets. Without a discoverable flat config
// here, `eslint .` (the `lint` script) fails outright under ESLint 9.
const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  ...expoConfig,
  globalIgnores([".expo/**", "dist/**", "android/**", "ios/**", "expo-env.d.ts"]),
]);
