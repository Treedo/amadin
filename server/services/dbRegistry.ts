import path from 'path';

import { generateArtifacts, GenerationResult } from '@generator/generateArtifacts.js';
import { DemoConfig, DemoSidebarGroup, EntityFormDefaults, UiManifest } from '@generator/schemaBuilder.js';
import { logger } from '../utils/logger.js';

type RegisteredApp = {
  config: DemoConfig;
  manifest: UiManifest[];
  entityDefaults: Record<string, EntityFormDefaults>;
  sidebar: DemoSidebarGroup[];
};

const registry = new Map<string, RegisteredApp>();
let defaultAppId: string | undefined;

export async function loadRegistry(
  configPath = path.resolve('examples/demo-config.json'),
  outputDir = path.resolve('generated')
): Promise<GenerationResult> {
  const resolvedPath = configPath;
  logger.info(`Loading application config from ${resolvedPath}`);
  const result = await generateArtifacts(resolvedPath, outputDir);
  const { config } = result;
  const artifacts = result.artifacts;
  registry.clear();
  registry.set(config.appId, {
    config,
    manifest: artifacts.manifest,
    entityDefaults: artifacts.entityDefaults,
    sidebar: artifacts.sidebar
  });
  defaultAppId = config.appId;
  return result;
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

export function getSidebar(appId: string): DemoSidebarGroup[] | undefined {
  return registry.get(appId)?.sidebar;
}

export function getDefaultSidebar(): DemoSidebarGroup[] | undefined {
  return defaultAppId ? registry.get(defaultAppId)?.sidebar : undefined;
}
