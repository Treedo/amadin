import { promises as fs } from 'fs';
import path from 'path';
import { buildUiManifest, validateConfig } from '@generator/schemaBuilder.js';
import { logger } from '../utils/logger.js';
const registry = new Map();
export async function loadRegistry(configPath = path.resolve('examples/demo-config.json')) {
    const resolvedPath = configPath;
    logger.info(`Loading application config from ${resolvedPath}`);
    const file = await fs.readFile(resolvedPath, 'utf8');
    const config = validateConfig(JSON.parse(file));
    registry.set(config.appId, {
        config,
        manifest: buildUiManifest(config)
    });
}
export function listApplications() {
    return Array.from(registry.entries()).map(([id, app]) => ({ id, name: app.config.name }));
}
export function getApplication(appId) {
    return registry.get(appId);
}
