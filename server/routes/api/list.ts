import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { DynamicListSqlEngine } from '../../services/dynamicList/sqlEngine.js';
import type { ListContext, ListPagination } from '../../services/dynamicList/types.js';

const filterSchema = z.object({
  field: z.string(),
  operator: z.enum([
    'equals',
    'not_equals',
    'in',
    'not_in',
    'lt',
    'lte',
    'gt',
    'gte',
    'between',
    'contains',
    'starts_with',
    'ends_with',
    'is_null',
    'is_not_null',
    'custom'
  ]),
  value: z.any().optional(),
  negate: z.boolean().optional(),
  context: z.string().optional()
});

const sortSchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']),
  nulls: z.enum(['first', 'last', 'default']).optional(),
  context: z.string().optional()
});

const paginationSchema = z.object({
  direction: z.enum(['forward', 'backward']).default('forward'),
  after: z.string().optional(),
  before: z.string().optional(),
  limit: z.number().int().min(1).max(500).default(50)
});

const defaultPagination: ListPagination = paginationSchema.parse({});

const searchSchema = z.object({
  term: z.string(),
  fields: z.array(z.string()).nonempty(),
  mode: z.enum(['contains', 'prefix', 'exact']).optional()
});

const listContextSchema: z.ZodType<ListContext, z.ZodTypeDef, unknown> = z
  .object({
    listCode: z.string().optional(),
    filters: z.array(filterSchema).optional(),
    sorts: z.array(sortSchema).optional(),
    pagination: paginationSchema.optional(),
    search: searchSchema.optional(),
    viewPreferences: z.record(z.any()).optional(),
    session: z.record(z.any()).optional()
  })
  .transform((ctx) => ({
    listCode: ctx.listCode,
    filters: ctx.filters ?? [],
    sorts: ctx.sorts ?? [],
    pagination: ctx.pagination ?? { ...defaultPagination },
    search: ctx.search,
    viewPreferences: ctx.viewPreferences,
    session: ctx.session
  }));

const listRequestSchema = z.object({
  appCode: z.string().min(1),
  context: z.preprocess((value) => parseContext(value), listContextSchema)
});

function parseContext(value: unknown): unknown {
  if (!value) {
    return {
      filters: [],
      sorts: [],
      pagination: { direction: 'forward', limit: 50 }
    } satisfies ListContext;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw Object.assign(new Error('Invalid context JSON'), { cause: error, statusCode: 400 });
    }
  }
  return value;
}

interface ListRouteOptions {
  engine?: DynamicListSqlEngine;
}

const listRoute: FastifyPluginAsync<ListRouteOptions> = async (fastify: FastifyInstance, opts) => {
  const engine = opts?.engine ?? new DynamicListSqlEngine();
  fastify.post('/list/:entityCode', async (request, reply) => {
    const parsed = listRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      reply.status(400).send({ error: 'ValidationError', details: parsed.error.flatten() });
      return;
    }

    const { appCode, context } = parsed.data;
    const { entityCode } = request.params as { entityCode: string };
    const response = await engine.execute(appCode, entityCode, context);
    reply.send(response);
  });
};

export default listRoute;
