// metro.config.js — monorepo-aware Metro config for Expo
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")
const path = require("path")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// 1. Watch the monorepo root so Metro can resolve workspace packages.
config.watchFolders = [workspaceRoot]

// 2. Let Metro look up packages from the monorepo root before the app root,
//    so pnpm symlinks in the root node_modules are resolved correctly.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

// 3. NativeWind integration.
module.exports = withNativeWind(config, { input: "./global.css" })
