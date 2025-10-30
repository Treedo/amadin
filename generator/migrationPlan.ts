import type { DemoField } from './schemaBuilder.js';
import type { EntityDiff, EntitySnapshot, EntityChange, FieldSnapshot, FieldChange } from './entityDiff.js';

export interface MigrationPlan {
  hasChanges: boolean;
  statements: string[];
  sql: string;
  summary: {
    createdTables: string[];
    droppedTables: string[];
    alteredTables: string[];
  };
  slug: string;
}

const sqlTypeMap: Record<DemoField['type'], string> = {
  string: 'TEXT',
  number: 'INTEGER',
  decimal: 'DECIMAL(65,30)',
  date: 'TIMESTAMP(3)',
  boolean: 'BOOLEAN',
  grid: 'TEXT',
  reference: 'TEXT'
};

export function createMigrationPlan(diff: EntityDiff): MigrationPlan {
  const statements: string[] = [];
  const createdTables: string[] = [];
  const droppedTables: string[] = [];
  const alteredTables: string[] = [];

  for (const entity of diff.added) {
    statements.push(renderCreateTable(entity));
    createdTables.push(modelName(entity.code));
  }

  for (const entity of diff.removed) {
    statements.push(renderDropTable(entity));
    droppedTables.push(modelName(entity.code));
  }

  for (const change of diff.updated) {
    const rendered = renderAlterTable(change);
    if (rendered.length > 0) {
      statements.push(...rendered);
      alteredTables.push(modelName(change.code));
    }
  }

  const sql = statements.join('\n\n');

  const summary = {
    createdTables,
    droppedTables,
    alteredTables
  };

  const slug = buildSlug(summary);

  return {
    hasChanges: statements.length > 0,
    statements,
    sql,
    summary,
    slug
  };
}

function renderCreateTable(entity: EntitySnapshot): string {
  const tableName = modelName(entity.code);
  const columnLines = [
    '  "id" TEXT PRIMARY KEY',
    ...entity.fields.map((field) => `  "${fieldName(field.code)}" ${sqlType(field)}${field.required ? ' NOT NULL' : ''}`),
    '  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    '  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP'
  ];

  return [
    `-- kind: ${entity.kind}`,
    `CREATE TABLE "${tableName}" (
${columnLines.join(',\n')}
);`
  ].join('\n');
}

function renderDropTable(entity: EntitySnapshot): string {
  const tableName = modelName(entity.code);
  return `DROP TABLE IF EXISTS "${tableName}";`;
}

function renderAlterTable(change: EntityChange): string[] {
  const tableName = modelName(change.code);
  const statements: string[] = [];

  for (const field of change.addedFields) {
    statements.push(
      `ALTER TABLE "${tableName}" ADD COLUMN "${fieldName(field.code)}" ${sqlType(field)}${field.required ? ' NOT NULL' : ''};`
    );
  }

  for (const field of change.removedFields) {
    statements.push(`ALTER TABLE "${tableName}" DROP COLUMN "${fieldName(field.code)}";`);
  }

  for (const field of change.changedFields) {
    const expressions: string[] = [];
    if (field.previous.type !== field.current.type) {
      expressions.push(`ALTER COLUMN "${fieldName(field.code)}" TYPE ${sqlType(field.current)}`);
    }
    if (field.previous.required !== field.current.required) {
      expressions.push(
        `ALTER COLUMN "${fieldName(field.code)}" ${field.current.required ? 'SET' : 'DROP'} NOT NULL`
      );
    }
    if (expressions.length > 0) {
      statements.push(`ALTER TABLE "${tableName}" ${expressions.join(', ')};`);
    }
  }

  if (change.previousKind && change.previousKind !== change.kind) {
    statements.unshift(`-- kind changed: ${change.previousKind} -> ${change.kind}`);
  }

  return statements;
}

function sqlType(field: FieldSnapshot | FieldChange['current']): string {
  return sqlTypeMap[field.type] ?? 'TEXT';
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

function buildSlug(summary: MigrationPlan['summary']): string {
  const [first] = summary.createdTables.length
    ? summary.createdTables
    : summary.alteredTables.length
    ? summary.alteredTables
    : summary.droppedTables;
  if (!first) {
    return 'update';
  }
  return first.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase();
}
