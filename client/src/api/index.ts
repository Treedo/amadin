export interface ReferenceOption {
  value: string;
  label: string;
}

export interface ReferenceSearchParams {
  search?: string;
  limit?: number;
  labelField?: string;
  values?: string[];
}

export async function searchEntityReference(
  entityCode: string,
  params: ReferenceSearchParams
): Promise<ReferenceOption[]> {
  const query = new URLSearchParams();
  if (params.search) {
    query.set('search', params.search);
  }
  if (params.limit) {
    query.set('limit', String(params.limit));
  }
  if (params.labelField) {
    query.set('labelField', params.labelField);
  }
  if (params.values?.length) {
    query.set('values', params.values.join(','));
  }

  const url = `/api/entities/${entityCode}/reference${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch reference options');
  }
  const json = await response.json();
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((entry: any) => ({
    value: String(entry.value),
    label: typeof entry.label === 'string' ? entry.label : String(entry.value)
  }));
}
export type UiFormGroupItem =
  | {
      kind: 'field';
      entity: string;
      field: string;
      label: string;
      widget: string;
      required: boolean;
      reference?: {
        entity: string;
        labelField?: string;
      };
    }
  | {
      kind: 'link';
      label: string;
      target: string;
      targetType: 'entity' | 'form' | 'url';
      description?: string;
    };

export interface UiFormGroup {
  code: string;
  title: string;
  orientation: 'horizontal' | 'vertical';
  color: string;
  autoGrow: boolean;
  items: UiFormGroupItem[];
}

export interface UiFormUsage {
  entity: string;
  role: 'list' | 'item';
  source: 'config' | 'generated';
}

export interface UiForm {
  code: string;
  name: string;
  groups: UiFormGroup[];
  primaryEntity?: string;
  usage?: UiFormUsage[];
}

export interface EntityFormReference {
  formCode: string;
  generated: boolean;
}

export interface EntityFormDefaults {
  list: EntityFormReference;
  item: EntityFormReference;
}

export interface SidebarItem {
  type: 'entity' | 'form' | 'overview' | 'url';
  target: string;
  label: string;
  icon?: string;
  permissions?: string[];
}

export interface SidebarGroup {
  code: string;
  title: string;
  items: SidebarItem[];
}

export interface AppManifest {
  meta: {
    id: string;
    name: string;
  };
  manifest: UiForm[];
  defaults: {
    entities: Record<string, EntityFormDefaults>;
  };
  sidebar: SidebarGroup[];
}

export interface CatalogLink {
  code: string;
  name: string;
  kind: 'catalog' | 'document' | 'register';
  href: string;
  fields: Array<{ code: string; name: string; type: string; required: boolean }>;
  defaults?: {
    listForm: string;
    itemForm: string;
    generatedList: boolean;
    generatedItem: boolean;
  };
}

export interface DocumentLink {
  code: string;
  name: string;
  href: string;
  groups: UiFormGroup[];
  primaryEntity?: string;
  usage: UiFormUsage[];
}

export interface AppOverviewEntry {
  id: string;
  name: string;
  summary: {
    catalogCount: number;
    documentCount: number;
  };
  links: {
    manifest: string;
    catalogs: CatalogLink[];
    documents: DocumentLink[];
  };
  sidebar?: SidebarGroup[];
}

export interface AppOverviewResponse {
  generatedAt: string;
  applications: AppOverviewEntry[];
}

export async function fetchApplication(): Promise<AppManifest> {
  const response = await fetch('/app');
  if (!response.ok) {
    throw new Error('Failed to fetch application');
  }
  return (await response.json()) as AppManifest;
}

export async function fetchAppOverview(): Promise<AppOverviewResponse> {
  const response = await fetch('/api/overview');
  if (!response.ok) {
    throw new Error('Failed to fetch application overview');
  }
  return (await response.json()) as AppOverviewResponse;
}

export async function fetchEntityRows(entityCode: string): Promise<unknown[]> {
  const response = await fetch(`/api/entities/${entityCode}`);
  if (!response.ok) {
    throw new Error('Failed to fetch entity data');
  }
  const json = await response.json();
  return json.data as unknown[];
}

export async function fetchEntityRecord(entityCode: string, recordId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/entities/${entityCode}/${recordId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch entity record');
  }
  const json = await response.json();
  return json.data as Record<string, unknown>;
}

export async function createEntityRecord(
  entityCode: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/entities/${entityCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new Error(message ?? 'Failed to create entity record');
  }
  const json = await response.json();
  return json.data as Record<string, unknown>;
}

export async function updateEntityRecord(
  entityCode: string,
  recordId: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/entities/${entityCode}/${recordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data })
  });
  if (!response.ok) {
    const message = await safeErrorMessage(response);
    throw new Error(message ?? 'Failed to update entity record');
  }
  const json = await response.json();
  return json.data as Record<string, unknown>;
}

async function safeErrorMessage(response: Response): Promise<string | null> {
  try {
    const json = await response.json();
    if (json && typeof json === 'object' && 'error' in json) {
      return String(json.error);
    }
  } catch {
    // Ignore JSON parsing issues
  }
  return null;
}
