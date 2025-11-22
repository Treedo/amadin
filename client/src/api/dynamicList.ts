import type { ListContext } from '../types/dynamicList.js';
import { createEntityRecord, updateEntityRecord } from './index.js';

export interface DynamicListColumn {
  field: string;
  label: string;
  type: string;
  sortable?: boolean;
  filterable?: boolean;
}

export interface DynamicListRow {
  cursor: string;
  values: Record<string, unknown>;
}

export interface DynamicListCapabilities {
  inlineEditing?: boolean;
}

export interface DynamicListResponse {
  entityCode: string;
  listCode: string;
  columns: DynamicListColumn[];
  rows: DynamicListRow[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  capabilities?: DynamicListCapabilities;
}

export async function fetchDynamicList(
  appCode: string,
  entityCode: string,
  context: ListContext
): Promise<DynamicListResponse> {
  const response = await fetch(`/api/list/${entityCode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appCode, context })
  });
  if (!response.ok) {
    throw new Error('Не вдалося завантажити список');
  }
  return (await response.json()) as DynamicListResponse;
}

export async function deleteEntityRecord(entityCode: string, recordId: string): Promise<void> {
  const response = await fetch(`/api/entities/${entityCode}/${recordId}`, { method: 'DELETE' });
  if (!response.ok) {
    const errorText = await tryReadError(response);
    throw new Error(errorText ?? 'Не вдалося видалити запис');
  }
}

export async function persistListItem(
  entityCode: string,
  recordId: string | undefined,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  if (!recordId) {
    return createEntityRecord(entityCode, data);
  }
  return updateEntityRecord(entityCode, recordId, data);
}

async function tryReadError(response: Response): Promise<string | null> {
  try {
    const json = await response.json();
    if (json && typeof json === 'object' && 'error' in json) {
      return String(json.error);
    }
  } catch {
    // swallow JSON issues
  }
  return null;
}
