import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getApplication } from '../services/dbRegistry.js';

const appRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get<{ Params: { appId: string } }>('/app/:appId', async (
    request: FastifyRequest<{ Params: { appId: string } }>,
    reply: FastifyReply
  ) => {
    const { appId } = request.params;
    const application = getApplication(appId);
    if (!application) {
      reply.code(404);
      return { error: 'Application not found' };
    }

    return {
      meta: {
        id: appId,
        name: application.config.name
      },
      manifest: application.manifest
    };
  });

  fastify.get<{ Params: { appId: string } }>('/:appId', async (
    request: FastifyRequest<{ Params: { appId: string } }>,
    reply: FastifyReply
  ) => {
    const { appId } = request.params;
    const application = getApplication(appId);
    if (!application) {
      reply.code(404);
      return { error: 'Application not found' };
    }

    return {
      meta: {
        id: appId,
        name: application.config.name
      },
      manifest: application.manifest
    };
  });
};

export default appRoute;
