// metro.config.js — monorepo-aware Metro config for Expo
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")
const path = require("path")
const fs = require("fs")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// 1. Watch the monorepo root so Metro can resolve workspace packages.
config.watchFolders = [workspaceRoot]

// 2. Let Metro look up packages from the monorepo root before the app root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

// 3. pnpm symlinks cause Metro to resolve 'react' as '@types/react'.
//    withNativeWind/withCssInterop captures resolveRequest as its inner
//    resolver, so this MUST be set before calling withNativeWind.
function realPkgPath(name) {
  for (const base of [projectRoot, workspaceRoot]) {
    try {
      return fs.realpathSync(path.join(base, "node_modules", name))
    } catch {}
  }
  return null
}

const reactReal = realPkgPath("react")

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (reactReal && (moduleName === "react" || moduleName.startsWith("react/"))) {
    const subpath = moduleName === "react" ? null : moduleName.slice("react/".length)
    const pkg = require(path.join(reactReal, "package.json"))

    let filePath
    if (!subpath) {
      filePath = path.join(reactReal, pkg.main || "index.js")
    } else {
      const exportKey = "./" + subpath
      const exp = pkg.exports?.[exportKey]
      if (typeof exp === "string") {
        filePath = path.join(reactReal, exp)
      } else if (exp && typeof exp === "object") {
        const resolved = exp.default ?? exp.require ?? exp.node
        filePath = path.join(reactReal, typeof resolved === "string" ? resolved : subpath + ".js")
      } else {
        filePath = path.join(reactReal, subpath + ".js")
      }
    }

    return { filePath, type: "sourceFile" }
  }
  return context.resolveRequest(context, moduleName, platform)
}

// 4. NativeWind integration — must come AFTER resolveRequest is set.
module.exports = withNativeWind(config, { input: "./global.css" })
