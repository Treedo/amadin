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

  fastify.get<{ Params: { appId: string; formCode: string } }>('/app/:appId/forms/:formCode', async (
    request: FastifyRequest<{ Params: { appId: string; formCode: string } }>,
    reply: FastifyReply
  ) => {
    const { appId, formCode } = request.params;
    const application = getApplication(appId);
    if (!application) {
      reply.code(404);
      return { error: 'Application not found' };
    }

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
