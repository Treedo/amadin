import type { ListContext } from '../types.js';
import type { SelectStatement } from './sqlAst.js';

export interface GlobalKey {
  entity: string;
  key: Array<string | number | boolean | null>;
}

export function encodeGlobalKey(key: GlobalKey): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

export function decodeGlobalKey(cursor: string): GlobalKey {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  return JSON.parse(raw) as GlobalKey;
}

export function applyPagination(
  ast: SelectStatement,
  ctx: ListContext,
  keyFields: string[],
  params: unknown[]
): void {
  const { pagination } = ctx;
  if (!pagination) {
    return;
  }

  const cursor = pagination.direction === 'forward' ? pagination.after : pagination.before;
  if (cursor) {
    const decoded = decodeGlobalKey(cursor);
    if (decoded.key.length !== keyFields.length) {
      throw new Error('Cursor key does not match list definition');
    }

    const comparator = pagination.direction === 'forward' ? '>' : '<';
    const tupleClauses: string[] = [];
    keyFields.forEach((field, index) => {
      const expr = ast.columns.find((column) => column.alias === field)?.expr ?? `${ast.from.alias}.${field}`;
      params.push(decoded.key[index]);
      tupleClauses.push(`${expr} ${comparator} $${params.length}`);
    });
    ast.where.push(`(${tupleClauses.join(' OR ')})`);
  }

  ast.limit = pagination.limit + 1;
}
