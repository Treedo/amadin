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

export type DemoConfig = z.infer<typeof demoConfigSchema>;
export type DemoEntity = z.infer<typeof entitySchema>;
export type DemoField = z.infer<typeof fieldSchema>;
export type DemoForm = z.infer<typeof formSchema>;
export type DemoFormElement = z.infer<typeof formElementSchema>;
export type DemoFormField = z.infer<typeof formFieldSchema>;

export interface UiManifest {
  code: string;
  name: string;
  groups: Array<{
    code: string;
    title: string;
    orientation: 'horizontal' | 'vertical';
    color: string;
    autoGrow: boolean;
    items: Array<
      | {
          kind: 'field';
          entity: string;
          field: string;
          label: string;
          widget: DemoFormField['widget'];
          required: boolean;
        }
      | {
          kind: 'link';
          label: string;
          target: string;
          targetType: 'entity' | 'form' | 'url';
          description?: string;
        }
    >;
  }>;
  primaryEntity?: string;
}

const prismaTypeMap: Record<DemoField['type'], string> = {
  string: 'String',
  number: 'Int',
  decimal: 'Decimal',
  date: 'DateTime',
  boolean: 'Boolean',
  grid: 'String'
};

const defaultScalarAttributes: Partial<Record<DemoField['type'], string>> = {
  grid: '@default(uuid())',
  date: '@default(now())'
};

export function buildPrismaSchema(config: DemoConfig): string {
  const datasourceBlock = `datasource db {\n  provider = \"postgresql\"\n  url      = env(\"APP_DATABASE_URL\")\n}`;
  const generatorBlock = `generator client {\n  provider = \"prisma-client-js\"\n  output   = \"./prisma-client\"\n}`;
  const models = config.entities.map(buildModelBlock).join('\n\n');
  return [datasourceBlock, generatorBlock, models].filter(Boolean).join('\n\n') + '\n';
}

export function buildUiManifest(config: DemoConfig): UiManifest[] {
  const entityMap = new Map<string, DemoEntity>();
  for (const entity of config.entities) {
    entityMap.set(entity.code, entity);
  }

  return config.forms.map((form: DemoForm) => {
    const groups = form.groups.map((group) => {
      const mappedItems = group.items.map((item: DemoFormElement) => {
        if (item.kind === 'field') {
          const entity = entityMap.get(item.entity);
          const fieldDefinition = entity?.fields.find((field: DemoField) => field.code === item.field);
          return {
            kind: 'field' as const,
            entity: item.entity,
            field: item.field,
            label: item.label ?? fieldDefinition?.name ?? item.field,
            widget: item.widget,
            required: fieldDefinition?.required ?? false
          };
        }

        return {
          kind: 'link' as const,
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

    type FieldItem = Extract<(typeof groups)[number]['items'][number], { kind: 'field' }>;

    const primaryField = groups
      .flatMap((group) => group.items)
      .find((item): item is FieldItem => item.kind === 'field');

    return {
      code: form.code,
      name: form.name,
      groups,
      primaryEntity: primaryField?.entity
    };
  });
}

export function validateConfig(data: unknown): DemoConfig {
  return demoConfigSchema.parse(data);
}

function buildModelBlock(entity: DemoEntity): string {
  const header = `model ${pascalCase(entity.code)} {`;
  const baseFields = ['  id        String   @id @default(uuid())'];
  const scalarFields = entity.fields.map((field: DemoField) => {
    const prismaType = prismaTypeMap[field.type];
    const optionalSuffix = field.required ? '' : '?';
    const attributeSuffix = defaultScalarAttributes[field.type] ? ` ${defaultScalarAttributes[field.type]}` : '';
    return `  ${camelCase(field.code)} ${prismaType}${optionalSuffix}${attributeSuffix}`;
  });
  const auditFields = ['  createdAt DateTime @default(now())', '  updatedAt DateTime @updatedAt'];
  return [header, ...baseFields, ...scalarFields, ...auditFields, '}'].join('\n');
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
