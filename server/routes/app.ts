import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { getDefaultAppId, getDefaultApplication } from '../services/dbRegistry.js';

const appRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/app', async (_request: FastifyRequest, reply: FastifyReply) => {
    const application = getDefaultApplication();
    const appId = getDefaultAppId();

    if (!application || !appId) {
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

  fastify.get<{ Params: { formCode: string } }>('/app/forms/:formCode', async (
    request: FastifyRequest<{ Params: { formCode: string } }>,
    reply: FastifyReply
  ) => {
    const application = getDefaultApplication();
    const appId = getDefaultAppId();

    if (!application || !appId) {
      reply.code(404);
      return { error: 'Application not found' };
    }

    const { formCode } = request.params;
    const form = application.manifest.find((item) => item.code === formCode);
    if (!form) {
      reply.code(404);
      return { error: 'Form not found' };
    }

    return {
      meta: {
        id: appId,
        name: application.config.name
      },
      form
    };
  });
};

export default appRoute;
