import { randomUUID } from 'crypto';
import { DemoConfig, DemoEntity, DemoField } from '@generator/schemaBuilder.js';

export interface EntityRecord {
  id: string;
  [key: string]: unknown;
}

interface DataStore {
  entities: Map<string, EntityRecord[]>;
}

const stores = new Map<string, DataStore>();

export function getDataStore(appId: string, config: DemoConfig): DataStore {
  if (stores.has(appId)) {
    return stores.get(appId)!;
  }

  const dataStore: DataStore = { entities: new Map() };
  for (const entity of config.entities) {
    dataStore.entities.set(entity.code, createDemoRows(entity));
  }
  stores.set(appId, dataStore);
  return dataStore;
}

export function listEntities(store: DataStore, entityCode: string): EntityRecord[] {
  return [...(store.entities.get(entityCode) ?? [])];
}

export function getEntityRecord(store: DataStore, entityCode: string, recordId: string): EntityRecord | undefined {
  const collection = store.entities.get(entityCode);
  if (!collection) {
    return undefined;
  }
  return collection.find((record) => record.id === recordId);
}

export function createEntity(
  store: DataStore,
  entity: DemoEntity,
  payload: Record<string, unknown>
): EntityRecord {
  const fields = new Set(entity.fields.map((field: DemoField) => field.code));
  const sanitized: EntityRecord = { id: randomUUID() };
  for (const [key, value] of Object.entries(payload)) {
    if (fields.has(key)) {
      sanitized[key] = value;
    }
  }
  const list = store.entities.get(entity.code) ?? [];
  list.push(sanitized);
  store.entities.set(entity.code, list);
  return sanitized;
}

function createDemoRows(entity: DemoEntity): EntityRecord[] {
  if (entity.fields.length === 0) {
    return [];
  }

  const firstField = entity.fields[0]?.code ?? 'name';
  return [
    { id: randomUUID(), [firstField]: `${entity.name} sample A` },
    { id: randomUUID(), [firstField]: `${entity.name} sample B` }
  ];
}
