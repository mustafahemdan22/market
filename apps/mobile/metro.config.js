const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

/**
 * Metro configuration for a workspace package inside an npm monorepo.
 *
 * The default Expo config only watches the app directory. The Convex API
 * reference lives in `packages/convex/convex/_generated`, which is outside
 * `apps/mobile`, so Metro must be told to watch the repository root and be
 * allowed to resolve modules from the hoisted `node_modules` there.
 */
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// The generated Convex files are plain .js/.d.ts pairs.
config.resolver.sourceExts = [...config.resolver.sourceExts, "cjs", "mjs"];

module.exports = config;
