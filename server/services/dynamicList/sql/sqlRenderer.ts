import type { SelectStatement } from './sqlAst.js';

export interface RenderedQuery {
  text: string;
  params: unknown[];
}

export function renderSelect(ast: SelectStatement, params: unknown[]): RenderedQuery {
  const chunks: string[] = [];
  chunks.push('SELECT');
  chunks.push(ast.columns.map((column) => `${column.expr}${column.alias ? ` AS ${column.alias}` : ''}`).join(', '));
  chunks.push('FROM');
  chunks.push(`${ast.from.table} AS ${ast.from.alias}`);

  for (const join of ast.joins) {
    chunks.push(`${join.type === 'inner' ? 'INNER' : 'LEFT'} JOIN ${join.table} AS ${join.alias} ON ${join.on}`);
  }

  if (ast.where.length) {
    chunks.push('WHERE');
    chunks.push(ast.where.join(' AND '));
  }

  if (ast.orderBy.length) {
    chunks.push('ORDER BY');
    chunks.push(ast.orderBy.map((entry) => `${entry.expr} ${entry.direction}`).join(', '));
  }

  if (typeof ast.limit === 'number') {
    chunks.push(`LIMIT ${ast.limit}`);
  }

  return { text: chunks.join(' '), params };
}
