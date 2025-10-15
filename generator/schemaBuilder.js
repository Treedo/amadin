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
    fields: z.array(fieldSchema).min(1)
});
const formFieldSchema = z.object({
    entity: z.string().min(1),
    field: z.string().min(1),
    widget: z.enum(['input', 'textarea', 'select', 'datepicker', 'switch']).default('input')
});
const formSchema = z.object({
    code: z.string().min(1),
    name: z.string().min(1),
    layout: z.array(formFieldSchema).min(1)
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
export function buildPrismaSchema(config) {
    const datasourceBlock = `datasource db {\n  provider = \"postgresql\"\n  url      = env(\"APP_DATABASE_URL\")\n}`;
    const generatorBlock = `generator client {\n  provider = \"prisma-client-js\"\n  output   = \"./prisma-client\"\n}`;
    const models = config.entities.map(buildModelBlock).join('\n\n');
    return [datasourceBlock, generatorBlock, models].filter(Boolean).join('\n\n') + '\n';
}
export function buildUiManifest(config) {
    const entityMap = new Map();
    for (const entity of config.entities) {
        entityMap.set(entity.code, entity);
    }
    return config.forms.map((form) => ({
        code: form.code,
        name: form.name,
        layout: form.layout.map((item) => {
            const entity = entityMap.get(item.entity);
            const fieldDefinition = entity?.fields.find((field) => field.code === item.field);
            return {
                entity: item.entity,
                field: item.field,
                label: fieldDefinition?.name ?? item.field,
                widget: item.widget
            };
        })
    }));
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
