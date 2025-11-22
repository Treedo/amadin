import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getDefaultAppId, getDefaultApplication } from '../../services/dbRegistry.js';
import { canAccessEntity } from '../../services/security.js';
import {
  createEntityRecord,
  getEntityRecord as loadEntityRecord,
  listEntityRecords,
  markEntityRecordDeleted,
  searchEntityReferenceOptions,
  updateEntityRecord
} from '../../services/entityStore.js';
import type { DemoEntity } from '@generator/schemaBuilder.js';

interface EntityParams {
  entityCode: string;
}

interface CreateBody {
  data: Record<string, unknown>;
}

interface ReferenceQuery {
  search?: string;
  limit?: string;
  values?: string;
  labelField?: string;
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

      const rows = await listEntityRecords(entity);
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

      const record = await createEntityRecord(entity, request.body?.data ?? {});
      reply.code(201);
      return { data: record };
    }
  );

  fastify.put<{ Params: EntityParams & { recordId: string }; Body: CreateBody }>(
    '/entities/:entityCode/:recordId',
    async (request: FastifyRequest<{ Params: EntityParams & { recordId: string }; Body: CreateBody }>, reply: FastifyReply) => {
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

      const record = await updateEntityRecord(entity, recordId, request.body?.data ?? {});
      if (!record) {
        reply.code(404);
        return { error: 'Record not found' };
      }

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

      const record = await loadEntityRecord(entity, recordId);
      if (!record) {
        reply.code(404);
        return { error: 'Record not found' };
      }

      return { data: record };
    }
  );

  fastify.delete<{ Params: EntityParams & { recordId: string } }>(
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

      const isMarked = await markEntityRecordDeleted(entity, recordId);
      if (!isMarked) {
        reply.code(404);
        return { error: 'Record not found' };
      }

      reply.code(204);
    }
  );

  fastify.get<{ Params: EntityParams; Querystring: ReferenceQuery }>(
    '/entities/:entityCode/reference',
    async (request: FastifyRequest<{ Params: EntityParams; Querystring: ReferenceQuery }>, reply: FastifyReply) => {
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

      const { search, limit, labelField, values } = request.query;
      const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
      const safeLimit = parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined;
      const parsedValues = values
        ? values
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;

      const options = {
        search,
        limit: safeLimit,
        labelField,
        values: parsedValues
      };

      const rows = await searchEntityReferenceOptions(entity, options);
      return {
        data: rows.map((row) => ({ value: row.id, label: row.label }))
      };
    }
  );
};

export default entitiesRoute;
