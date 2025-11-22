import type { EntityMetadata, ListContext } from '../types.js';
import type { SelectStatement } from './sqlAst.js';

interface BuildResult {
  ast: SelectStatement;
  params: unknown[];
}

interface FilterHandlerArgs {
  column: string;
  value: unknown;
  params: unknown[];
}

type FilterHandler = (args: FilterHandlerArgs) => string;

const FILTER_HANDLERS: Record<string, FilterHandler> = {
  equals: ({ column, value, params }) => {
    params.push(value);
    return `${column} = $${params.length}`;
  },
  not_equals: ({ column, value, params }) => {
    params.push(value);
    return `${column} <> $${params.length}`;
  },
  lt: ({ column, value, params }) => {
    params.push(value);
    return `${column} < $${params.length}`;
  },
  lte: ({ column, value, params }) => {
    params.push(value);
    return `${column} <= $${params.length}`;
  },
  gt: ({ column, value, params }) => {
    params.push(value);
    return `${column} > $${params.length}`;
  },
  gte: ({ column, value, params }) => {
    params.push(value);
    return `${column} >= $${params.length}`;
  },
  contains: ({ column, value, params }) => {
    params.push(`%${value}%`);
    return `${column} ILIKE $${params.length}`;
  },
  starts_with: ({ column, value, params }) => {
    params.push(`${value}%`);
    return `${column} ILIKE $${params.length}`;
  },
  ends_with: ({ column, value, params }) => {
    params.push(`%${value}`);
    return `${column} ILIKE $${params.length}`;
  },
  in: ({ column, value, params }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('IN requires a non-empty array');
    }
    const placeholders = value.map((item) => {
      params.push(item);
      return `$${params.length}`;
    });
    return `${column} = ANY(ARRAY[${placeholders.join(', ')}])`;
  },
  not_in: ({ column, value, params }) => {
    if (!Array.isArray(value) || value.length === 0) {
      throw new Error('NOT IN requires a non-empty array');
    }
    const placeholders = value.map((item) => {
      params.push(item);
      return `$${params.length}`;
    });
    return `${column} <> ALL(ARRAY[${placeholders.join(', ')}])`;
  },
  is_null: ({ column }) => `${column} IS NULL`,
  is_not_null: ({ column }) => `${column} IS NOT NULL`
};

export class BaseQueryGenerator {
  constructor(private readonly metadata: EntityMetadata) {}

  build(ctx: ListContext): BuildResult {
    const params: unknown[] = [];
    const { schema, baseTable, baseAlias, fields, joins, defaultSort, securityFilters } = this.metadata;

    const columns = fields.map((field) => ({
      expr: `${field.tableAlias}.${field.column}`,
      alias: field.field
    }));

    const keyExpr = this.metadata.globalKeyFields
      .map((fieldName) => {
        const fieldMeta = fields.find((candidate) => candidate.field === fieldName);
        const column = fieldMeta ? `${fieldMeta.tableAlias}.${fieldMeta.column}` : `${baseAlias}.${fieldName}`;
        return `COALESCE(${column}::text, '')`;
      })
      .join(', ');

    columns.push({ expr: `array_to_string(ARRAY[${keyExpr}], '::')`, alias: 'global_key' });

    const select: SelectStatement = {
      columns,
      from: {
        table: `${schema}.${baseTable}`,
        alias: baseAlias
      },
      joins: joins.map((join) => ({
        type: join.required ? 'inner' : 'left',
        table: `${schema}.${join.table}`,
        alias: join.alias,
        on: join.on
      })),
      where: [],
      orderBy: []
    };

    for (const filter of ctx.filters) {
      const fieldMeta = fields.find((field) => field.field === filter.field);
      if (!fieldMeta) {
        continue;
      }
      const handler = FILTER_HANDLERS[filter.operator];
      if (!handler) {
        continue;
      }
      const clause = handler({ column: `${fieldMeta.tableAlias}.${fieldMeta.column}`, value: filter.value, params });
      select.where.push(filter.negate ? `NOT (${clause})` : clause);
    }

    for (const securityFilter of securityFilters) {
      let clause = securityFilter.clause;
      Object.values(securityFilter.params).forEach((value) => {
        params.push(value);
        clause = clause.replace('?', `$${params.length}`);
      });
      select.where.push(clause);
    }

    if (ctx.search?.term) {
      const searchColumns = fields.filter((field) => field.searchable).map((field) => `${field.tableAlias}.${field.column}`);
      if (searchColumns.length) {
        params.push(`%${ctx.search.term}%`);
        select.where.push(`(${searchColumns.map((column) => `${column} ILIKE $${params.length}`).join(' OR ')})`);
      }
    }

    const order = ctx.sorts.length ? ctx.sorts : defaultSort;
    select.orderBy = order
      .map((sort) => {
        const fieldMeta = fields.find((field) => field.field === sort.field);
        if (!fieldMeta) {
          return null;
        }
        return {
          expr: `${fieldMeta.tableAlias}.${fieldMeta.column}`,
          direction: sort.direction.toUpperCase() as 'ASC' | 'DESC'
        };
      })
      .filter(Boolean) as SelectStatement['orderBy'];

    return { ast: select, params };
  }
}
