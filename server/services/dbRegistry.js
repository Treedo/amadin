import { promises as fs } from 'fs';
import path from 'path';
import { buildUiArtifacts, validateConfig } from '@generator/schemaBuilder.js';
import { logger } from '../utils/logger.js';
const registry = new Map();
let defaultAppId;
export async function loadRegistry(configPath = path.resolve('examples/demo-config.json')) {
    const resolvedPath = configPath;
    logger.info(`Loading application config from ${resolvedPath}`);
    const file = await fs.readFile(resolvedPath, 'utf8');
    const config = validateConfig(JSON.parse(file));
    const artifacts = buildUiArtifacts(config);
    registry.clear();
    registry.set(config.appId, {
        config,
        manifest: artifacts.manifest,
        entityDefaults: artifacts.entityDefaults,
        sidebar: artifacts.sidebar
    });
    defaultAppId = config.appId;
}
export function listApplications() {
    return Array.from(registry.entries()).map(([id, app]) => ({ id, name: app.config.name }));
}
export function getApplication(appId) {
    return registry.get(appId);
}
export function getDefaultAppId() {
    return defaultAppId;
}
export function getDefaultApplication() {
    return defaultAppId ? registry.get(defaultAppId) : undefined;
}
export function getEntityDefaults(appId) {
    return registry.get(appId)?.entityDefaults;
}
export function getDefaultEntityDefaults() {
    return defaultAppId ? registry.get(defaultAppId)?.entityDefaults : undefined;
}
export function getSidebar(appId) {
    return registry.get(appId)?.sidebar;
}
export function getDefaultSidebar() {
    return defaultAppId ? registry.get(defaultAppId)?.sidebar : undefined;
}
