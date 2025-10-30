import path from 'path';

import type { GenerationResult } from '@generator/generateArtifacts.js';
import { diffSnapshots, snapshotConfig } from '@generator/entityDiff.js';
import type { EntitySnapshot } from '@generator/entityDiff.js';
import type { DemoConfig, DemoEntity, DemoField } from '@generator/schemaBuilder.js';
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
  const snapshots = snapshotConfig(config);
  const existingSnapshots = await fetchExistingEntitySnapshots(config);
  const diff = diffSnapshots(existingSnapshots, snapshots);
  const plan = createMigrationPlan(diff);
  if (!plan.hasChanges) {
    return null;
  }
  return plan;
}

async function fetchExistingEntitySnapshots(config: DemoConfig): Promise<EntitySnapshot[]> {
  const tableNames = config.entities.map((entity) => entityTableName(entity.code));
  if (tableNames.length === 0) {
    return [];
  }

  const result = await withAppClient((client) =>
    client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
    }>(
      `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = ANY($1::text[])`,
      [tableNames]
    )
  );

  const grouped = new Map<string, typeof result.rows>();
  for (const row of result.rows) {
    const bucket = grouped.get(row.table_name);
    if (bucket) {
      bucket.push(row);
    } else {
      grouped.set(row.table_name, [row]);
    }
  }

  const snapshots: EntitySnapshot[] = [];

  for (const entity of config.entities) {
    const tableName = entityTableName(entity.code);
    const columns = grouped.get(tableName);
    if (!columns) {
      continue;
    }
    snapshots.push(entitySnapshotFromColumns(entity, columns));
  }

  return snapshots;
}

function entitySnapshotFromColumns(
  entity: DemoEntity,
  columns: Array<{ column_name: string; data_type: string; is_nullable: 'YES' | 'NO' }>
): EntitySnapshot {
  const columnMap = new Map(columns.map((column) => [column.column_name, column] as const));
  const fields = entity.fields
    .map((field) => {
      const columnName = fieldName(field.code);
      const column = columnMap.get(columnName);
      if (!column) {
        return undefined;
      }
      return {
        code: field.code,
        type: mapPgTypeToFieldType(column.data_type, field.type),
        required: column.is_nullable === 'NO'
      };
    })
    .filter((field): field is NonNullable<typeof field> => Boolean(field));

  return {
    code: entity.code,
    name: entity.name,
    kind: entity.kind,
    fields
  };
}

function mapPgTypeToFieldType(dataType: string, fallback: DemoField['type']): DemoField['type'] {
  const normalized = dataType.toLowerCase();
  if (normalized.includes('timestamp') || normalized.includes('date')) {
    return 'date';
  }
  if (normalized === 'boolean') {
    return 'boolean';
  }
  if (normalized === 'integer' || normalized === 'smallint' || normalized === 'bigint') {
    return 'number';
  }
  if (normalized === 'numeric' || normalized.startsWith('decimal')) {
    return 'decimal';
  }
  if (normalized === 'uuid') {
    return fallback === 'grid' ? 'grid' : 'string';
  }
  if (normalized === 'text' || normalized.includes('char')) {
    return fallback;
  }
  return fallback;
}

function entityTableName(code: string): string {
  return pascalCase(code);
}

function fieldName(code: string): string {
  return camelCase(code);
}

function pascalCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (chr) => chr.toUpperCase());
}

function camelCase(value: string): string {
  const pascal = pascalCase(value);
  return pascal.slice(0, 1).toLowerCase() + pascal.slice(1);
}
