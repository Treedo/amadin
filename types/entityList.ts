import { z } from 'zod';

export const listPageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(200)
  .default(50);

export const listSearchSchema = z.string().min(1).max(200).optional();

export const filterOperatorSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'contains', 'startsWith']);

export const filterSchema = z.object({
  field: z.string().min(1),
  op: filterOperatorSchema,
  value: z.unknown()
});

export const filtersSchema = z.array(filterSchema).max(20).optional();

export const sortDirectionSchema = z.enum(['asc', 'desc']);

export const sortDescriptorSchema = z.object({
  field: z.string().min(1),
  dir: sortDirectionSchema
});

export const sortSchema = z.array(sortDescriptorSchema).max(5).optional();

export const uniqueKeySchema = z.string().min(1).optional();

export const listQuerySchema = z.object({
  entityCode: z.string().min(1),
  pageSize: listPageSizeSchema,
  cursor: z.string().min(1).optional(),
  search: listSearchSchema,
  filters: filtersSchema,
  sort: sortSchema,
  uniqueKey: uniqueKeySchema
});

export type FilterOperator = z.infer<typeof filterOperatorSchema>;
export type FilterDescriptor = z.infer<typeof filterSchema>;
export type SortDirection = z.infer<typeof sortDirectionSchema>;
export type SortDescriptor = z.infer<typeof sortDescriptorSchema>;

export interface ListCursor {
  lastKey: unknown;
  lastSort?: Record<string, unknown>;
  querySig: string;
}

export const listCursorSchema = z.object({
  lastKey: z.unknown(),
  lastSort: z.record(z.string(), z.unknown()).optional(),
  querySig: z.string().min(1)
});

export const listResponseSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
  pageInfo: z.object({
    nextCursor: z.string().optional().nullable(),
    hasNext: z.boolean()
  }),
  effectiveSort: z.array(sortDescriptorSchema),
  uniqueKey: z.string().min(1),
  debug: z
    .object({
      total: z.number().int().nonnegative().optional(),
      timingMs: z.number().nonnegative().optional()
    })
    .optional()
});

export type ListQuery = z.infer<typeof listQuerySchema>;
export type ListResponse = z.infer<typeof listResponseSchema>;
