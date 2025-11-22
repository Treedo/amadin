import { getAppPool } from '../../services/database.js';
import type { ListContext, ListResponse, Primitive } from './types.js';
import { DynamicListMetadataLoader } from './metadataLoader.js';
import { BaseQueryGenerator } from './sql/baseQueryGenerator.js';
import { CustomQueryRegistry } from './sql/customQueryRegistry.js';
import { applyPagination, encodeGlobalKey } from './sql/pagination.js';
import { renderSelect } from './sql/sqlRenderer.js';

export class DynamicListSqlEngine {
  private readonly metadataLoader = new DynamicListMetadataLoader();
  private readonly customQueries = new CustomQueryRegistry();

  registerCustomQuery(listCode: string, hook: (ast: Parameters<CustomQueryRegistry['apply']>[1]) => ReturnType<CustomQueryRegistry['apply']>): void {
    this.customQueries.register(listCode, hook);
  }

  async execute(appCode: string, entityCode: string, ctx: ListContext): Promise<ListResponse> {
    const metadata = await this.metadataLoader.load(appCode, entityCode);
    const baseBuilder = new BaseQueryGenerator(metadata);
    const { ast, params } = baseBuilder.build(ctx);
    const tweakedAst = this.customQueries.apply(ctx.listCode ?? entityCode, ast);
    applyPagination(tweakedAst, ctx, metadata.globalKeyFields, params);
    const rendered = renderSelect(tweakedAst, params);
    const rows = await this.runQuery(rendered.text, rendered.params);
    const hasNextPage = rows.length > ctx.pagination.limit;
    const visibleRows = hasNextPage ? rows.slice(0, -1) : rows;

    const resultRows = visibleRows.map((row) => ({
      cursor: encodeGlobalKey({
        entity: entityCode,
        key: metadata.globalKeyFields.map((field) => coercePrimitive(row[field], field))
      }),
      values: row
    }));

    return {
      entityCode,
      listCode: ctx.listCode ?? `${entityCode}List`,
      columns: metadata.fields
        .filter((field) => !field.hidden)
        .map((field) => ({
          field: field.field,
          label: field.field,
          type: field.type,
          sortable: field.sortable,
          filterable: field.filterable
        })),
      rows: resultRows,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: Boolean(ctx.pagination.after),
        startCursor: resultRows[0]?.cursor ?? null,
        endCursor: resultRows[resultRows.length - 1]?.cursor ?? null
      },
      capabilities: {
        inlineEditing: metadata.inlineEditing
      }
    };
  }

  private async runQuery(text: string, params: unknown[]): Promise<Record<string, unknown>[]> {
    const pool = getAppPool();
    const client = await pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }
}

function coercePrimitive(value: unknown, fieldName: string): Primitive {
  if (value === null) {
    return null;
  }

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
    return value as Primitive;
  }

  throw new Error(`Field ${fieldName} is not a primitive and cannot be used in cursor encoding`);
}
