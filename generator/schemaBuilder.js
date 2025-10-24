import { z } from 'zod';
const fieldSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'decimal', 'date', 'boolean', 'grid']).default('string'),
    required: z.boolean().default(false)
});
const entitySchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    kind: z.enum(['catalog', 'document', 'register']).default('catalog'),
    defaultListForm: z.string().min(1).optional(),
    defaultItemForm: z.string().min(1).optional(),
    fields: z.array(fieldSchema).min(1)
});
const formFieldSchema = z.object({
    kind: z.literal('field'),
    entity: z.string().min(1),
    field: z.string().min(1),
    widget: z.enum(['input', 'textarea', 'select', 'datepicker', 'switch']).default('input'),
    label: z.string().optional()
});
const formLinkSchema = z.object({
    kind: z.literal('link'),
    label: z.string().min(1),
    target: z.string().min(1),
    targetType: z.enum(['entity', 'form', 'url']).default('url'),
    description: z.string().optional()
});
const formElementSchema = z.discriminatedUnion('kind', [formFieldSchema, formLinkSchema]);
const formGroupSchema = z.object({
    code: z.string().min(1),
    title: z.string().min(1),
    orientation: z.enum(['horizontal', 'vertical']).default('vertical'),
    color: z.string().default('neutral'),
    autoGrow: z.boolean().default(false),
    items: z.array(formElementSchema).min(1)
});
const formSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    groups: z.array(formGroupSchema).min(1)
});
const demoConfigSchema = z.object({
    appId: z.string().min(1),
    name: z.string().min(1),
    entities: z.array(entitySchema).min(1),
    forms: z.array(formSchema).default([])
});
const prismaTypeMap = {
    string: 'String',
    number: 'Int',
    decimal: 'Decimal',
    date: 'DateTime',
    boolean: 'Boolean',
    grid: 'String'
};
const defaultScalarAttributes = {
    grid: '@default(uuid())',
    date: '@default(now())'
};
const defaultWidgetByFieldType = {
    string: 'input',
    number: 'input',
    decimal: 'input',
    date: 'datepicker',
    boolean: 'switch',
    grid: 'input'
};
export function buildPrismaSchema(config) {
    const datasourceBlock = `datasource db {\n  provider = "postgresql"\n  url      = env("APP_DATABASE_URL")\n}`;
    const generatorBlock = `generator client {\n  provider = "prisma-client-js"\n  output   = "./prisma-client"\n}`;
    const models = config.entities.map(buildModelBlock).join('\n\n');
    return [datasourceBlock, generatorBlock, models].filter(Boolean).join('\n\n') + '\n';
}
export function buildUiArtifacts(config) {
    const entityMap = new Map();
    for (const entity of config.entities) {
        entityMap.set(entity.code, entity);
    }
    const manifest = [];
    const manifestIndex = new Map();
    const mapForm = (form) => {
        const groups = form.groups.map((group) => {
            const mappedItems = group.items.map((item) => {
                if (item.kind === 'field') {
                    const entity = entityMap.get(item.entity);
                    const fieldDefinition = entity?.fields.find((field) => field.code === item.field);
                    return {
                        kind: 'field',
                        entity: item.entity,
                        field: item.field,
                        label: item.label ?? (fieldDefinition?.name ?? item.field),
                        widget: item.widget,
                        required: fieldDefinition?.required ?? false
                    };
                }
                return {
                    kind: 'link',
                    label: item.label,
                    target: item.target,
                    targetType: item.targetType,
                    description: item.description
                };
            });
            return {
                code: group.code,
                title: group.title,
                orientation: group.orientation,
                color: group.color,
                autoGrow: group.autoGrow,
                items: mappedItems
            };
        });
        const primaryField = groups
            .flatMap((group) => group.items)
            .find((item) => item.kind === 'field');
        return {
            code: form.code,
            name: form.name,
            groups,
            primaryEntity: primaryField?.entity
        };
    };
    for (const form of config.forms) {
        const mapped = mapForm(form);
        manifest.push(mapped);
        manifestIndex.set(mapped.code, mapped);
    }
    const entityDefaults = {};
    for (const entity of config.entities) {
        const defaults = resolveEntityDefaultsFor(entity, manifest, manifestIndex);
        entityDefaults[entity.code] = defaults;
    }
    return { manifest, entityDefaults };
}
export function buildUiManifest(config) {
    return buildUiArtifacts(config).manifest;
}
export function validateConfig(data) {
    return demoConfigSchema.parse(data);
}
function buildModelBlock(entity) {
    const header = `model ${pascalCase(entity.code)} {`;
    const baseFields = ['  id        String   @id @default(uuid())'];
    const scalarFields = entity.fields.map((field) => {
        const prismaType = prismaTypeMap[field.type];
        const optionalSuffix = field.required ? '' : '?';
        const attributeSuffix = defaultScalarAttributes[field.type] ? ` ${defaultScalarAttributes[field.type]}` : '';
        return `  ${camelCase(field.code)} ${prismaType}${optionalSuffix}${attributeSuffix}`;
    });
    const auditFields = ['  createdAt DateTime @default(now())', '  updatedAt DateTime @updatedAt'];
    return [header, ...baseFields, ...scalarFields, ...auditFields, '}'].join('\n');
}
function pascalCase(value) {
    return value
        .replace(/[-_\s]+(.)?/g, (_, chr) => (chr ? chr.toUpperCase() : ''))
        .replace(/^(.)/, (chr) => chr.toUpperCase());
}
function camelCase(value) {
    const pascal = pascalCase(value);
    return pascal.slice(0, 1).toLowerCase() + pascal.slice(1);
}
function resolveEntityDefaultsFor(entity, manifest, manifestIndex) {
    const list = ensureFormForEntity(entity, 'list', manifest, manifestIndex);
    const item = ensureFormForEntity(entity, 'item', manifest, manifestIndex);
    return { list, item };
}
function ensureFormForEntity(entity, role, manifest, manifestIndex) {
    const requestedCode = role === 'list' ? entity.defaultListForm : entity.defaultItemForm;
    const fallbackCode = requestedCode ?? defaultFormCode(entity.code, role);
    const resolvedCode = fallbackCode;
    const existing = manifestIndex.get(resolvedCode);
    if (existing) {
        applyUsage(existing, entity.code, role, false);
        if (!existing.primaryEntity) {
            existing.primaryEntity = entity.code;
        }
        return { formCode: existing.code, generated: false };
    }
    const generated = createDefaultForm(entity, resolvedCode, role);
    manifest.push(generated);
    manifestIndex.set(generated.code, generated);
    return { formCode: generated.code, generated: true };
}
function applyUsage(form, entityCode, role, generated) {
    const usageEntry = {
        entity: entityCode,
        role,
        source: generated ? 'generated' : 'config'
    };
    const existingUsage = form.usage ?? [];
    const alreadyPresent = existingUsage.some((usage) => usage.entity === usageEntry.entity && usage.role === usageEntry.role && usage.source === usageEntry.source);
    if (!alreadyPresent) {
        form.usage = [...existingUsage, usageEntry];
    }
}
function createDefaultForm(entity, code, role) {
    const title = role === 'list' ? `Список ${entity.name}` : `Елемент ${entity.name}`;
    const items = entity.fields.map((field) => ({
        kind: 'field',
        entity: entity.code,
        field: field.code,
        label: field.name,
        widget: defaultWidgetByFieldType[field.type] ?? 'input',
        required: Boolean(field.required)
    }));
    const form = {
        code,
        name: title,
        groups: [
            {
                code: `${entity.code}-${role}-main`,
                title: 'Основні реквізити',
                orientation: 'vertical',
                color: 'neutral',
                autoGrow: true,
                items
            }
        ],
        primaryEntity: entity.code,
        usage: [
            {
                entity: entity.code,
                role,
                source: 'generated'
            }
        ]
    };
    return form;
}
function defaultFormCode(entityCode, role) {
    if (role === 'list') {
        return `${entityCode}List`;
    }
    return `${entityCode}Form`;
}
