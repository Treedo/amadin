import { promises as fs } from 'fs';
import path from 'path';

import { diffSnapshots, snapshotConfig } from './entityDiff.js';
import { buildPrismaSchema, buildUiArtifacts, DemoConfig, validateConfig } from './schemaBuilder.js';

export interface GenerationResult {
  config: DemoConfig;
  schemaPath: string;
  manifestPath: string;
  statePath: string;
  reportPath: string;
  diff: ReturnType<typeof diffSnapshots>;
  report: {
    generatedAt: string;
    appId: string;
    summary: {
      added: string[];
      removed: string[];
      updated: string[];
    };
    diff: ReturnType<typeof diffSnapshots>;
  };
}

export async function generateArtifacts(configPath: string, outputDir: string): Promise<GenerationResult> {
  const absoluteConfig = path.resolve(configPath);
  const output = path.resolve(outputDir);
  const schemaPath = path.join(output, 'app.prisma');
  const manifestPath = path.join(output, 'ui-manifest.json');
  const statePath = path.join(output, 'state.json');
  const reportPath = path.join(output, 'migration-report.json');

  const fileContent = await fs.readFile(absoluteConfig, 'utf8');
  const rawConfig = JSON.parse(fileContent);
  const config = validateConfig(rawConfig);

  await fs.mkdir(output, { recursive: true });

  const prismaSchema = buildPrismaSchema(config);
  const artifacts = buildUiArtifacts(config);

  let previousState: ReturnType<typeof snapshotConfig> = [];
  try {
    const existing = await fs.readFile(statePath, 'utf8');
    previousState = JSON.parse(existing);
  } catch {
    previousState = [];
  }

  const currentState = snapshotConfig(config);
  const diff = diffSnapshots(previousState, currentState);

  await fs.writeFile(schemaPath, prismaSchema, 'utf8');
  await fs.writeFile(manifestPath, JSON.stringify(artifacts.manifest, null, 2), 'utf8');
  await fs.writeFile(statePath, JSON.stringify(currentState, null, 2), 'utf8');

  const report = {
    generatedAt: new Date().toISOString(),
    appId: config.appId,
    summary: buildDiffSummary(diff),
    diff
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  return {
    config,
    schemaPath,
    manifestPath,
    statePath,
    reportPath,
    diff,
    report
  };
}

function buildDiffSummary(diff: ReturnType<typeof diffSnapshots>) {
  const added = diff.added.map((entity) => `${entity.kind}:${entity.code}`);
  const removed = diff.removed.map((entity) => `${entity.kind}:${entity.code}`);
  const updated = diff.updated.map((entity) => `${entity.kind}:${entity.code}`);
  return {
    added,
    removed,
    updated
  };
}
