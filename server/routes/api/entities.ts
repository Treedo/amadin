import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getDefaultAppId, getDefaultApplication } from '../../services/dbRegistry.js';
import { canAccessEntity } from '../../services/security.js';
import { createEntity, getDataStore, getEntityRecord, listEntities } from '../../utils/prismaLoader.js';
import type { DemoEntity } from '@generator/schemaBuilder.js';

interface EntityParams {
  entityCode: string;
}

interface CreateBody {
  data: Record<string, unknown>;
}

const entitiesRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: EntityParams }>(
    '/entities/:entityCode',
    async (request: FastifyRequest<{ Params: EntityParams }>, reply: FastifyReply) => {
      const application = getDefaultApplication();
      const appId = getDefaultAppId();
      const { entityCode } = request.params;

      if (!application || !appId) {
        reply.code(404);
        return { error: 'Application not found' };
      }

      if (!canAccessEntity({}, { appId, entityCode })) {
        reply.code(403);
        return { error: 'Access denied' };
      }

      const entity = application.config.entities.find((item: DemoEntity) => item.code === entityCode);
      if (!entity) {
        reply.code(404);
        return { error: 'Entity not found' };
      }

      const store = getDataStore(appId, application.config);
      const rows = listEntities(store, entityCode);
      return { data: rows };
    }
  );

  fastify.post<{ Params: EntityParams; Body: CreateBody }>(
    '/entities/:entityCode',
    async (request: FastifyRequest<{ Params: EntityParams; Body: CreateBody }>, reply: FastifyReply) => {
      const application = getDefaultApplication();
      const appId = getDefaultAppId();
      const { entityCode } = request.params;

      if (!application || !appId) {
        reply.code(404);
        return { error: 'Application not found' };
      }

      const entity = application.config.entities.find((item: DemoEntity) => item.code === entityCode);
      if (!entity) {
        reply.code(404);
        return { error: 'Entity not found' };
      }

      const store = getDataStore(appId, application.config);
      const record = createEntity(store, entity, request.body?.data ?? {});
      reply.code(201);
      return { data: record };
    }
  );

    fastify.get<{ Params: EntityParams & { recordId: string } }>(
      '/entities/:entityCode/:recordId',
      async (request: FastifyRequest<{ Params: EntityParams & { recordId: string } }>, reply: FastifyReply) => {
        const application = getDefaultApplication();
        const appId = getDefaultAppId();
        const { entityCode, recordId } = request.params;

        if (!application || !appId) {
          reply.code(404);
          return { error: 'Application not found' };
        }

        if (!canAccessEntity({}, { appId, entityCode })) {
          reply.code(403);
          return { error: 'Access denied' };
        }

        const entity = application.config.entities.find((item: DemoEntity) => item.code === entityCode);
        if (!entity) {
          reply.code(404);
          return { error: 'Entity not found' };
        }

        const store = getDataStore(appId, application.config);
        const record = getEntityRecord(store, entityCode, recordId);
        if (!record) {
          reply.code(404);
          return { error: 'Record not found' };
        }

        return { data: record };
      }
    );
};

export default entitiesRoute;
