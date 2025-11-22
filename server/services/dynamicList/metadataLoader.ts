import { getApplication, getDefaultAppId, getDefaultApplication } from '../dbRegistry.js';
import type { DemoEntity, DemoField } from '@generator/schemaBuilder.js';
import type { EntityMetadata, EntityFieldMeta, ListSort } from './types.js';

export class DynamicListMetadataLoader {
  async load(appCode: string, entityCode: string): Promise<EntityMetadata> {
    const application = resolveApplication(appCode);
    const entity = application.config.entities.find((candidate) => candidate.code === entityCode);

    if (!entity) {
      throw Object.assign(new Error(`Entity ${entityCode} not found`), { statusCode: 404 });
    }

    const mappedFields = entity.fields.map((field) => mapField(field));
    const hasExplicitId = mappedFields.some((field) => field.field === 'id');
    const fields: EntityFieldMeta[] = [createIdFieldMeta(), createDeletionMarkerFieldMeta(), ...mappedFields];
    const uniqueFields = dedupeFields(fields, hasExplicitId);
    const defaultSort = buildDefaultSort(entity);
    const keyFields = inferKeyFields(entity, hasExplicitId);
    const deletionColumnRef = `root.${quoteIdentifier('markedForDeletion')}`;

    return {
      schema: 'public',
      baseTable: quoteIdentifier(pascalCase(entity.code)),
      baseAlias: 'root',
      fields: uniqueFields,
      joins: [],
      defaultSort,
      globalKeyFields: keyFields,
      securityFilters: [
        {
          clause: `${deletionColumnRef} = FALSE`,
          params: {}
        }
      ],
      inlineEditing: Boolean(entity.listInlineEditing)
    };
  }
}

function resolveApplication(appCode: string) {
  return getApplication(appCode) ?? getFallbackApplication(appCode);
}

function getFallbackApplication(appCode: string) {
  const fallback = getDefaultApplication();
  const fallbackId = getDefaultAppId();
  if (fallback && fallbackId && fallbackId === appCode) {
    return fallback;
  }
  throw Object.assign(new Error(`Application ${appCode} not found`), { statusCode: 404 });
}

function mapField(field: DemoField): EntityFieldMeta {
  return {
    field: field.code,
    column: quoteIdentifier(camelCase(field.code)),
    tableAlias: 'root',
    type: mapFieldType(field.type),
    sortable: true,
    filterable: true,
    searchable: field.type === 'string',
    reference: field.reference ? { entityCode: field.reference.entity, labelField: field.reference.labelField } : undefined
  };
}

function mapFieldType(type: DemoField['type']): EntityFieldMeta['type'] {
  switch (type) {
    case 'number':
    case 'decimal':
      return 'number';
    case 'date':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'grid':
      return 'json';
    case 'reference':
      return 'reference';
    default:
      return 'string';
  }
}

function buildDefaultSort(entity: DemoEntity): ListSort[] {
  const preferredOrder = ['updatedAt', 'createdAt', 'name', 'code', 'id'];
  for (const candidate of preferredOrder) {
    const field = entity.fields.find((item) => item.code === candidate);
    if (field) {
      return [{ field: field.code, direction: 'asc' }];
    }
  }
  if (entity.fields.length) {
    return [{ field: entity.fields[0].code, direction: 'asc' }];
  }
  return [];
}

function inferKeyFields(_entity: DemoEntity, _hasExplicitId: boolean): string[] {
  return ['id'];
}

function createIdFieldMeta(): EntityFieldMeta {
  return {
    field: 'id',
    column: quoteIdentifier('id'),
    tableAlias: 'root',
    type: 'string',
    sortable: true,
    filterable: true,
    searchable: false,
    hidden: true
  };
}

function createDeletionMarkerFieldMeta(): EntityFieldMeta {
  return {
    field: 'markedForDeletion',
    column: quoteIdentifier('markedForDeletion'),
    tableAlias: 'root',
    type: 'boolean',
    sortable: false,
    filterable: true,
    searchable: false,
    hidden: true
  };
}

function dedupeFields(fields: EntityFieldMeta[], hasExplicitId: boolean): EntityFieldMeta[] {
  const seen = new Set<string>();
  const result: EntityFieldMeta[] = [];
  for (const field of fields) {
    if (field.field === 'id' && hasExplicitId && seen.has('id')) {
      continue;
    }
    if (seen.has(field.field)) {
      continue;
    }
    seen.add(field.field);
    result.push(field);
  }
  return result;
}

function pascalCase(value: string): string {
  return value
    .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (chr) => chr.toUpperCase());
}

function camelCase(value: string): string {
  const pascal = pascalCase(value);
  return pascal.slice(0, 1).toLowerCase() + pascal.slice(1);
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
