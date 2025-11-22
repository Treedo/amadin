export type Primitive = string | number | boolean | null;

export interface ListColumnMeta {
  field: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'datetime' | 'date' | 'enum' | 'reference' | 'json';
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  alignment?: 'left' | 'right' | 'center';
  format?: string;
  reference?: { entityCode: string; labelField?: string };
}

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

export interface ListSearch {
  term: string;
  fields: string[];
  mode?: 'contains' | 'prefix' | 'exact';
}

export interface ListPagination {
  direction: 'forward' | 'backward';
  after?: string;
  before?: string;
  limit: number;
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

export interface ListResponseRow {
  cursor: string;
  values: Record<string, unknown>;
}

export interface ListResponse {
  entityCode: string;
  listCode: string;
  columns: ListColumnMeta[];
  rows: ListResponseRow[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  summary?: {
    totalCountApprox?: number;
    appliedFilters?: number;
    searchTerm?: string;
  };
  debug?: {
    baseQueryHash?: string;
    customQueryApplied?: boolean;
  };
  capabilities?: ListCapabilities;
}

export interface ListCapabilities {
  inlineEditing: boolean;
}

export interface EntityFieldMeta {
  field: string;
  column: string;
  tableAlias: string;
  type: ListColumnMeta['type'];
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
  reference?: { entityCode: string; labelField?: string };
  hidden?: boolean;
}

export interface EntityJoinMeta {
  alias: string;
  table: string;
  on: string;
  required?: boolean;
}

export interface SecurityFilterMeta {
  clause: string;
  params: Record<string, Primitive>;
}

export interface EntityMetadata {
  schema: string;
  baseTable: string;
  baseAlias: string;
  fields: EntityFieldMeta[];
  joins: EntityJoinMeta[];
  defaultSort: ListSort[];
  globalKeyFields: string[];
  securityFilters: SecurityFilterMeta[];
  inlineEditing: boolean;
}
