import { promises as fs } from 'fs';
import path from 'path';

import {
  buildUiArtifacts,
  DemoConfig,
  EntityFormDefaults,
  UiManifest,
  validateConfig
} from '@generator/schemaBuilder.js';
import { logger } from '../utils/logger.js';

type RegisteredApp = {
  config: DemoConfig;
  manifest: UiManifest[];
  entityDefaults: Record<string, EntityFormDefaults>;
};

const registry = new Map<string, RegisteredApp>();
let defaultAppId: string | undefined;

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
    entityDefaults: artifacts.entityDefaults
  });
  defaultAppId = config.appId;
}

export function listApplications(): Array<{ id: string; name: string }> {
  return Array.from(registry.entries()).map(([id, app]) => ({ id, name: app.config.name }));
}

export function getApplication(appId: string): RegisteredApp | undefined {
  return registry.get(appId);
}

export function getDefaultAppId(): string | undefined {
  return defaultAppId;
}

export function getDefaultApplication(): RegisteredApp | undefined {
  return defaultAppId ? registry.get(defaultAppId) : undefined;
}

export function getEntityDefaults(appId: string): Record<string, EntityFormDefaults> | undefined {
  return registry.get(appId)?.entityDefaults;
}

export function getDefaultEntityDefaults(): Record<string, EntityFormDefaults> | undefined {
  return defaultAppId ? registry.get(defaultAppId)?.entityDefaults : undefined;
}
