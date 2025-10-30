import { randomUUID } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';

import { DemoEntity, DemoField } from '@generator/schemaBuilder.js';

import { logger } from '../utils/logger.js';
import { getAppPool } from './database.js';

export interface EntityRecord {
  id: string;
  [key: string]: unknown;
}

export async function listEntityRecords(entity: DemoEntity): Promise<EntityRecord[]> {
  const tableName = modelName(entity.code);
  const query = `SELECT * FROM "${tableName}" ORDER BY "createdAt" DESC`;
  const result = await runQuery(query);
  logger.debug(`Fetched ${result.rowCount ?? 0} record(s) from ${tableName}`);
  return result.rows.map(mapRowToRecord);
}

export async function getEntityRecord(entity: DemoEntity, recordId: string): Promise<EntityRecord | undefined> {
  const tableName = modelName(entity.code);
  const query = `SELECT * FROM "${tableName}" WHERE "id" = $1 LIMIT 1`;
  const result = await runQuery(query, [recordId]);
  return result.rows[0] ? mapRowToRecord(result.rows[0]) : undefined;
}

export async function createEntityRecord(
  entity: DemoEntity,
  payload: Record<string, unknown>
): Promise<EntityRecord> {
  const tableName = modelName(entity.code);
  const prepared = prepareInsert(entity.fields, payload);

  if (!prepared.columns.includes('id')) {
    prepared.columns.unshift('id');
    prepared.values.unshift(randomUUID());
  }

  const statement = buildInsertStatement(tableName, prepared.columns);
  const result = await runQuery(statement, prepared.values);
  const row = result.rows[0];
  if (!row) {
    throw new Error(`Failed to insert record into ${tableName}`);
  }
  return mapRowToRecord(row);
}

export async function updateEntityRecord(
  entity: DemoEntity,
  recordId: string,
  payload: Record<string, unknown>
): Promise<EntityRecord | undefined> {
  const tableName = modelName(entity.code);
  const prepared = prepareUpdate(entity.fields, payload);

  const assignments: string[] = [];
  const params: unknown[] = [];

  prepared.columns.forEach((column, index) => {
    assignments.push(`"${column}" = $${index + 1}`);
    params.push(prepared.values[index]);
  });

  assignments.push(`"updatedAt" = CURRENT_TIMESTAMP`);
  params.push(recordId);

  const whereParamIndex = prepared.columns.length + 1;
  const statement = `UPDATE "${tableName}" SET ${assignments.join(', ')} WHERE "id" = $${whereParamIndex} RETURNING *`;
  const result = await runQuery(statement, params);
  const row = result.rows[0];
  return row ? mapRowToRecord(row) : undefined;
}

function prepareInsert(fields: DemoField[], payload: Record<string, unknown>) {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const field of fields) {
    const columnName = fieldName(field.code);
    if (Object.prototype.hasOwnProperty.call(payload, field.code)) {
      const value = (payload as Record<string, unknown>)[field.code];
      if (value !== undefined) {
        columns.push(columnName);
        values.push(value);
      }
    }
  }

  return { columns, values };
}

function prepareUpdate(fields: DemoField[], payload: Record<string, unknown>) {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field.code)) {
      const value = (payload as Record<string, unknown>)[field.code];
      if (value !== undefined) {
        columns.push(fieldName(field.code));
        values.push(value);
      }
    }
  }

  return { columns, values };
}

function buildInsertStatement(tableName: string, columns: string[]): string {
  if (columns.length === 0) {
    return `INSERT INTO "${tableName}" DEFAULT VALUES RETURNING *`;
  }

  const placeholders = Array.from({ length: columns.length }, (_, index) => `$${index + 1}`).join(', ');
  const columnList = columns.map((column) => `"${column}"`).join(', ');
  return `INSERT INTO "${tableName}" (${columnList}) VALUES (${placeholders}) RETURNING *`;
}

async function runQuery(query: string, params: unknown[] = []): Promise<QueryResult<QueryResultRow>> {
  const pool = getAppPool();
  const client = await pool.connect();
  try {
    return await client.query<QueryResultRow>(query, params as any[]);
  } finally {
    client.release();
  }
}

function mapRowToRecord(row: QueryResultRow): EntityRecord {
  const result: Record<string, unknown> = { ...row };
  const { id } = result;
  if (id == null) {
    throw new Error('Entity record is missing primary key "id"');
  }
  delete result.id;
  return {
    id: String(id),
    ...result
  };
}

function modelName(code: string): string {
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
