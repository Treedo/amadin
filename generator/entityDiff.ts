import type { DemoConfig, DemoEntity, DemoField } from './schemaBuilder.js';

export interface FieldSnapshot {
  code: string;
  type: DemoField['type'];
  required: boolean;
}

export interface EntitySnapshot {
  code: string;
  name: string;
  kind: DemoEntity['kind'];
  fields: FieldSnapshot[];
}

export interface FieldChange {
  code: string;
  previous: FieldSnapshot;
  current: FieldSnapshot;
}

export interface EntityChange {
  code: string;
  name: string;
  kind: DemoEntity['kind'];
  previousKind?: DemoEntity['kind'];
  addedFields: FieldSnapshot[];
  removedFields: FieldSnapshot[];
  changedFields: FieldChange[];
}

export interface EntityDiff {
  added: EntitySnapshot[];
  removed: EntitySnapshot[];
  updated: EntityChange[];
}

export function snapshotConfig(config: DemoConfig): EntitySnapshot[] {
  return config.entities.map((entity) => ({
    code: entity.code,
    name: entity.name,
    kind: entity.kind,
    fields: entity.fields.map((field) => ({
      code: field.code,
      type: field.type,
      required: Boolean(field.required)
    }))
  }));
}

export function diffSnapshots(previous: EntitySnapshot[], next: EntitySnapshot[]): EntityDiff {
  const previousMap = new Map(previous.map((entity) => [entity.code, entity] as const));
  const nextMap = new Map(next.map((entity) => [entity.code, entity] as const));

  const added: EntitySnapshot[] = [];
  const removed: EntitySnapshot[] = [];
  const updated: EntityChange[] = [];

  for (const entity of next) {
    if (!previousMap.has(entity.code)) {
      added.push(entity);
    }
  }

  for (const entity of previous) {
    if (!nextMap.has(entity.code)) {
      removed.push(entity);
    }
  }

  for (const entity of next) {
    const previousEntity = previousMap.get(entity.code);
    if (!previousEntity) {
      continue;
    }

    const previousFieldMap = new Map(previousEntity.fields.map((field) => [field.code, field] as const));
    const nextFieldMap = new Map(entity.fields.map((field) => [field.code, field] as const));

    const addedFields: FieldSnapshot[] = [];
    const removedFields: FieldSnapshot[] = [];
    const changedFields: FieldChange[] = [];

    for (const field of entity.fields) {
      const previousField = previousFieldMap.get(field.code);
      if (!previousField) {
        addedFields.push(field);
        continue;
      }
      if (field.type !== previousField.type || field.required !== previousField.required) {
        changedFields.push({
          code: field.code,
          previous: previousField,
          current: field
        });
      }
    }

    for (const field of previousEntity.fields) {
      if (!nextFieldMap.has(field.code)) {
        removedFields.push(field);
      }
    }

    const kindChanged = previousEntity.kind !== entity.kind;
    if (kindChanged || addedFields.length > 0 || removedFields.length > 0 || changedFields.length > 0) {
      updated.push({
        code: entity.code,
        name: entity.name,
        kind: entity.kind,
        previousKind: kindChanged ? previousEntity.kind : undefined,
        addedFields,
        removedFields,
        changedFields
      });
    }
  }

  return { added, removed, updated };
}
