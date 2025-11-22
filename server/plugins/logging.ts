import type { FastifyPluginAsync } from 'fastify';
import { logger } from '../utils/logger.js';

export const loggingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request) => {
    logger.info(`→ ${request.method} ${request.url}`, {
      requestId: request.id
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info(`← ${request.method} ${request.url}`, {
      requestId: request.id,
      statusCode: reply.statusCode,
      duration: reply.getResponseTime()
    });
  });
};

export default loggingPlugin;
