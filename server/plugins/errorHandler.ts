import type { FastifyPluginAsync } from 'fastify';
import { logger } from '../utils/logger.js';

export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    logger.error('Request failed', { requestId: request.id, error });

    const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
    reply.status(statusCode).send({
      error: error.name ?? 'Error',
      message: error.message ?? 'Unknown error'
    });
  });
};

export default errorHandlerPlugin;
