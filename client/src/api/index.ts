export type UiFormGroupItem =
  | {
      kind: 'field';
      entity: string;
      field: string;
      label: string;
      widget: string;
      required: boolean;
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
