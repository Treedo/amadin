export interface SelectColumn {
  expr: string;
  alias?: string;
}

export interface SelectFrom {
  table: string;
  alias: string;
}

export interface SelectJoin {
  type: 'inner' | 'left';
  table: string;
  alias: string;
  on: string;
}

export interface OrderClause {
  expr: string;
  direction: 'ASC' | 'DESC';
}

export interface SelectStatement {
  columns: SelectColumn[];
  from: SelectFrom;
  joins: SelectJoin[];
  where: string[];
  orderBy: OrderClause[];
  limit?: number;
}
