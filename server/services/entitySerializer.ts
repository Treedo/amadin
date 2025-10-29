import path from 'path';

import type { GenerationResult } from '@generator/generateArtifacts.js';
import { diffSnapshots, snapshotConfig } from '@generator/entityDiff.js';
import type { DemoConfig } from '@generator/schemaBuilder.js';
import { createMigrationPlan, MigrationPlan } from '@generator/migrationPlan.js';
import { writeMigrationArtifacts } from '@generator/migrationWriter.js';

import { logger } from '../utils/logger.js';
import { withAppClient } from './database.js';

export interface EnsureEntityTablesOptions {
  generation: GenerationResult;
  outputDir?: string;
  applyMigrations?: boolean;
  writeMigrations?: boolean;
}

export interface EnsureEntityTablesResult {
  plans: MigrationPlan[];
}

export async function ensureEntityTables(
  options: EnsureEntityTablesOptions
): Promise<EnsureEntityTablesResult> {
  const {
    generation,
    outputDir = path.resolve('generated'),
    applyMigrations = true,
    writeMigrations = false
  } = options;

  const executedPlans: MigrationPlan[] = [];
  let executedStatements = 0;
  let summaryCreated = 0;
  let summaryAltered = 0;
  let summaryDropped = 0;

  const primaryPlan = createMigrationPlan(generation.diff);
  if (primaryPlan.hasChanges) {
    if (writeMigrations) {
      const { folderName } = await writeMigrationArtifacts(primaryPlan, outputDir);
      logger.info(`Prepared migration artifacts ${folderName}`);
    }
    if (applyMigrations) {
      executedStatements += await applyPlan(primaryPlan);
    }
    executedPlans.push(primaryPlan);
    summaryCreated += primaryPlan.summary.createdTables.length;
    summaryAltered += primaryPlan.summary.alteredTables.length;
    summaryDropped += primaryPlan.summary.droppedTables.length;
  }

  const fallbackPlan = await buildMissingTablesPlan(generation.config);
  if (fallbackPlan && fallbackPlan.hasChanges) {
    if (writeMigrations) {
      const { folderName } = await writeMigrationArtifacts(fallbackPlan, outputDir);
      logger.info(`Prepared fallback migration artifacts ${folderName}`);
    }
    if (applyMigrations) {
      executedStatements += await applyPlan(fallbackPlan);
    }
    executedPlans.push(fallbackPlan);
    summaryCreated += fallbackPlan.summary.createdTables.length;
    summaryAltered += fallbackPlan.summary.alteredTables.length;
    summaryDropped += fallbackPlan.summary.droppedTables.length;
  }

  if (executedPlans.length === 0) {
    logger.info('Entity tables are already in sync with the configuration.');
    return { plans: [] };
  }

  if (applyMigrations) {
    logger.info(`Applied ${executedStatements} entity migration statement(s).`);
  }
  logger.info(
    `Summary -> created: ${summaryCreated}, altered: ${summaryAltered}, dropped: ${summaryDropped}`
  );

  return { plans: executedPlans };
}

function sanitizeStatement(statement: string): string | null {
  const withoutComments = statement
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .trim();

  if (!withoutComments) {
    return null;
  }

  return withoutComments;
}

async function applyPlan(plan: MigrationPlan): Promise<number> {
  let executedStatements = 0;

  await withAppClient(async (client) => {
    await client.query('BEGIN');
    try {
      for (const statement of plan.statements) {
        const sanitized = sanitizeStatement(statement);
        if (!sanitized) {
          continue;
        }
        logger.debug(`Executing entity migration statement: ${sanitized}`);
        await client.query(sanitized);
        executedStatements += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  });

  return executedStatements;
}

async function buildMissingTablesPlan(config: DemoConfig): Promise<MigrationPlan | null> {
  const existingTables = await fetchExistingEntityTables();
  const snapshots = snapshotConfig(config);
  const existingSnapshots = snapshots.filter((snapshot) =>
    existingTables.has(entityTableName(snapshot.code))
  );
  const diff = diffSnapshots(existingSnapshots, snapshots);
  const plan = createMigrationPlan(diff);
  if (!plan.hasChanges) {
    return null;
  }
  return plan;
}

async function fetchExistingEntityTables(): Promise<Set<string>> {
  const rows = await withAppClient((client) =>
    client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = current_schema()`
    )
  );
  const names = new Set<string>();
  for (const row of rows.rows) {
    names.add(row.tablename);
  }
  return names;
}

function entityTableName(code: string): string {
  return pascalCase(code);
}

function pascalCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (chr) => chr.toUpperCase());
}
