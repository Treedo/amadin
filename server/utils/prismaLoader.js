import { randomUUID } from 'crypto';
const stores = new Map();
export function getDataStore(appId, config) {
    if (stores.has(appId)) {
        return stores.get(appId);
    }
    const dataStore = { entities: new Map() };
    for (const entity of config.entities) {
        dataStore.entities.set(entity.code, createDemoRows(entity));
    }
    stores.set(appId, dataStore);
    return dataStore;
}
export function listEntities(store, entityCode) {
    return [...(store.entities.get(entityCode) ?? [])];
}
export function createEntity(store, entity, payload) {
    const fields = new Set(entity.fields.map((field) => field.code));
    const sanitized = { id: randomUUID() };
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
function createDemoRows(entity) {
    if (entity.fields.length === 0) {
        return [];
    }
    const firstField = entity.fields[0]?.code ?? 'name';
    return [
        { id: randomUUID(), [firstField]: `${entity.name} sample A` },
        { id: randomUUID(), [firstField]: `${entity.name} sample B` }
    ];
}
