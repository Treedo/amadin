import Fastify from 'fastify';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import listRoute from '../list.js';
import type { ListContext, ListResponse } from '../../../services/dynamicList/types.js';

class StubEngine {
  execute = vi.fn<(appCode: string, entityCode: string, ctx: ListContext) => Promise<ListResponse>>();
}

describe('Dynamic list route', () => {
  let fastify: ReturnType<typeof Fastify>;
  let engine: StubEngine;

  beforeEach(async () => {
    engine = new StubEngine();
    fastify = Fastify();
    await fastify.register(listRoute, { engine: engine as unknown as any });
    await fastify.ready();
  });

  it('rejects invalid context JSON', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/list/TestEntity',
      payload: {
        appCode: 'demo',
        context: '{invalid'
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it('invokes engine and returns payload', async () => {
    const mockResponse: ListResponse = {
      entityCode: 'Customer',
      listCode: 'CustomerList',
      columns: [],
      rows: [],
      pageInfo: {
        hasNextPage: false,
        hasPreviousPage: false,
        startCursor: null,
        endCursor: null
      },
      capabilities: { inlineEditing: true }
    };
    engine.execute.mockResolvedValueOnce(mockResponse);

    const context: ListContext = {
      filters: [],
      sorts: [],
      pagination: { direction: 'forward', limit: 25 }
    };

    const response = await fastify.inject({
      method: 'POST',
      url: '/list/Customer',
      payload: {
        appCode: 'demo',
        context
      }
    });

    expect(response.statusCode).toBe(200);
    expect(engine.execute).toHaveBeenCalledWith('demo', 'Customer', expect.objectContaining(context));
    expect(await response.json()).toEqual(mockResponse);
  });
});
