// Metro config for monorepo + pnpm in Expo SDK 53
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// Ensure metro can resolve modules from both app and workspace root (merge, keep unique)
config.watchFolders = Array.from(new Set([workspaceRoot, ...(config.watchFolders ?? [])]));
config.resolver = {
  ...(config.resolver ?? {}),
  disableHierarchicalLookup: true,
  nodeModulesPaths: Array.from(new Set([
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
    ...((config.resolver && config.resolver.nodeModulesPaths) ? config.resolver.nodeModulesPaths : [])
  ])),
  unstable_enableSymlinks: true
};

module.exports = config;


