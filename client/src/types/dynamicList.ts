export type Primitive = string | number | boolean | null;

export interface ListFilter {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'in'
    | 'not_in'
    | 'lt'
    | 'lte'
    | 'gt'
    | 'gte'
    | 'between'
    | 'contains'
    | 'starts_with'
    | 'ends_with'
    | 'is_null'
    | 'is_not_null'
    | 'custom';
  value?: Primitive | Primitive[] | Record<string, Primitive>;
  negate?: boolean;
  context?: string;
}

export interface ListSort {
  field: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last' | 'default';
  context?: string;
}

export interface ListPagination {
  direction: 'forward' | 'backward';
  after?: string;
  before?: string;
  limit: number;
}

export interface ListSearch {
  term: string;
  fields: string[];
  mode?: 'contains' | 'prefix' | 'exact';
}

export interface ListContext {
  listCode?: string;
  filters: ListFilter[];
  sorts: ListSort[];
  pagination: ListPagination;
  search?: ListSearch;
  viewPreferences?: Record<string, unknown>;
  session?: Record<string, unknown>;
}
