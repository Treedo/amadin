export interface ApplicationMeta {
  id: string;
  name: string;
}

export interface UiField {
  entity: string;
  field: string;
  label: string;
  widget: string;
}

export interface UiForm {
  code: string;
  name: string;
  layout: UiField[];
}

export interface AppManifest {
  meta: ApplicationMeta;
  manifest: UiForm[];
}

export async function fetchApplications(): Promise<ApplicationMeta[]> {
  const response = await fetch('/api/apps');
  if (!response.ok) {
    throw new Error('Failed to fetch applications');
  }
  const json = await response.json();
  return json.applications as ApplicationMeta[];
}

export async function fetchApplication(appId: string): Promise<AppManifest> {
  const response = await fetch(`/app/${appId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch application');
  }
  return (await response.json()) as AppManifest;
}

export async function fetchEntityRows(appId: string, entityCode: string): Promise<unknown[]> {
  const response = await fetch(`/api/${appId}/entities/${entityCode}`);
  if (!response.ok) {
    throw new Error('Failed to fetch entity data');
  }
  const json = await response.json();
  return json.data as unknown[];
}
