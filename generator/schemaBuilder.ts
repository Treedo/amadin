import { z } from 'zod';

const referenceSchema = z.object({
  entity: z.string().min(1),
  labelField: z.string().min(1).optional()
});

const fieldSchema = z
  .object({
    code: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'decimal', 'date', 'boolean', 'grid', 'reference']).default('string'),
    required: z.boolean().default(false),
    reference: referenceSchema.optional()
  })
  .superRefine((data, ctx) => {
    if (data.type === 'reference' && !data.reference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: 'Reference fields must declare a reference configuration.'
      });
    }
    if (data.type !== 'reference' && data.reference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: 'Only reference fields may include reference metadata.'
      });
    }
  });

const entitySchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['catalog', 'document', 'register']).default('catalog'),
  defaultListForm: z.string().min(1).optional(),
  defaultItemForm: z.string().min(1).optional(),
  listInlineEditing: z.boolean().default(false),
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

const sidebarItemSchema = z.object({
  type: z.enum(['entity', 'form', 'overview', 'url']).default('entity'),
  target: z.string().min(1),
  label: z.string().min(1),
  icon: z.string().optional(),
  permissions: z.array(z.string().min(1)).optional()
});

const sidebarGroupSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  items: z.array(sidebarItemSchema).min(1)
});

const demoConfigSchema = z.object({
  appId: z.string().min(1),
  name: z.string().min(1),
  entities: z.array(entitySchema).min(1),
  forms: z.array(formSchema).default([]),
  sidebar: z.array(sidebarGroupSchema).default([])
});

export type DemoConfig = z.infer<typeof demoConfigSchema>;
export type DemoEntity = z.infer<typeof entitySchema>;
export type DemoField = z.infer<typeof fieldSchema>;
export type DemoForm = z.infer<typeof formSchema>;
export type DemoFormElement = z.infer<typeof formElementSchema>;
export type DemoFormField = z.infer<typeof formFieldSchema>;
export type DemoSidebarGroup = z.infer<typeof sidebarGroupSchema>;
export type DemoSidebarItem = z.infer<typeof sidebarItemSchema>;

export interface UiFormUsage {
  entity: string;
  role: 'list' | 'item';
  source: 'config' | 'generated';
}

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
          reference?: DemoField['reference'];
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

export interface UiArtifacts {
  manifest: UiManifest[];
  entityDefaults: Record<string, EntityFormDefaults>;
  sidebar: DemoSidebarGroup[];
}

const prismaTypeMap: Record<DemoField['type'], string> = {
  string: 'String',
  number: 'Int',
  decimal: 'Decimal',
  date: 'DateTime',
  boolean: 'Boolean',
  grid: 'String',
  reference: 'String'
};

const defaultScalarAttributes: Partial<Record<DemoField['type'], string>> = {
  grid: '@default(uuid())',
  date: '@default(now())'
};

const defaultWidgetByFieldType: Record<DemoField['type'], DemoFormField['widget']> = {
  string: 'input',
  number: 'input',
  decimal: 'input',
  date: 'datepicker',
  boolean: 'switch',
  grid: 'input',
  reference: 'select'
};

export function buildPrismaSchema(config: DemoConfig): string {
  const datasourceBlock = `datasource db {\n  provider = \"postgresql\"\n  url      = env(\"APP_DATABASE_URL\")\n}`;
  const generatorBlock = `generator client {\n  provider = \"prisma-client-js\"\n  output   = \"./prisma-client\"\n}`;
  const models = config.entities.map(buildModelBlock).join('\n\n');
  return [datasourceBlock, generatorBlock, models].filter(Boolean).join('\n\n') + '\n';
}

export function buildUiArtifacts(config: DemoConfig): UiArtifacts {
  const entityMap = new Map<string, DemoEntity>();
  for (const entity of config.entities) {
    entityMap.set(entity.code, entity);
  }
  const manifest: UiManifest[] = [];
  const manifestIndex = new Map<string, UiManifest>();

  const mapForm = (form: DemoForm): UiManifest => {
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
            required: fieldDefinition?.required ?? false,
            reference: fieldDefinition?.reference
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
  };

  for (const form of config.forms) {
    const mapped = mapForm(form);
    manifest.push(mapped);
    manifestIndex.set(mapped.code, mapped);
  }

  const entityDefaults: Record<string, EntityFormDefaults> = {};

  for (const entity of config.entities) {
    const defaults = resolveEntityDefaultsFor(entity, manifest, manifestIndex);
    entityDefaults[entity.code] = defaults;
  }

  return { manifest, entityDefaults, sidebar: config.sidebar };
}

export function validateConfig(data: unknown): DemoConfig {
  return demoConfigSchema.parse(data);
}

function buildModelBlock(entity: DemoEntity): string {
  const header = `model ${pascalCase(entity.code)} {`;
  const baseFields = ['  id        String   @id @default(uuid())', '  markedForDeletion Boolean @default(false)'];
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

function resolveEntityDefaultsFor(
  entity: DemoEntity,
  manifest: UiManifest[],
  manifestIndex: Map<string, UiManifest>
): EntityFormDefaults {
  const list = ensureFormForEntity(entity, 'list', manifest, manifestIndex);
  const item = ensureFormForEntity(entity, 'item', manifest, manifestIndex);

  return { list, item };
}

function ensureFormForEntity(
  entity: DemoEntity,
  role: 'list' | 'item',
  manifest: UiManifest[],
  manifestIndex: Map<string, UiManifest>
): EntityFormReference {
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

function applyUsage(form: UiManifest, entityCode: string, role: 'list' | 'item', generated: boolean) {
  const usageEntry: UiFormUsage = {
    entity: entityCode,
    role,
    source: generated ? 'generated' : 'config'
  };
  const existingUsage = form.usage ?? [];
  const alreadyPresent = existingUsage.some(
    (usage) => usage.entity === usageEntry.entity && usage.role === usageEntry.role && usage.source === usageEntry.source
  );
  if (!alreadyPresent) {
    form.usage = [...existingUsage, usageEntry];
  }
}

function createDefaultForm(entity: DemoEntity, code: string, role: 'list' | 'item'): UiManifest {
  const title = role === 'list' ? `Список ${entity.name}` : `Елемент ${entity.name}`;
  const items = entity.fields.map((field) => ({
    kind: 'field' as const,
    entity: entity.code,
    field: field.code,
    label: field.name,
    widget: defaultWidgetByFieldType[field.type] ?? 'input',
    required: Boolean(field.required),
    reference: field.reference
  }));

  const form: UiManifest = {
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

function defaultFormCode(entityCode: string, role: 'list' | 'item'): string {
  if (role === 'list') {
    return `${entityCode}List`;
  }
  return `${entityCode}Form`;
}

export function buildUiManifest(config: DemoConfig): UiManifest[] {
  return buildUiArtifacts(config).manifest;
}
