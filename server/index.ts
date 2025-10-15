import Fastify from 'fastify';
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

import apiRoute from './routes/api/index.js';
import appRoute from './routes/app.js';
import rootRoute from './routes/root.js';
import { loadRegistry } from './services/dbRegistry.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  await loadRegistry();

  const server = Fastify({ logger: false });
  server.setErrorHandler((error: FastifyError, _request: FastifyRequest, reply: FastifyReply) => {
    logger.error(error);
    reply.status(error.statusCode ?? 500).send({ error: error.message });
  });

  server.register(rootRoute);
  server.register(appRoute);
  server.register(apiRoute, { prefix: '/api' });

  const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
  const host = '0.0.0.0';

  try {
    await server.listen({ port, host });
    logger.info(`Server listening at http://${host}:${port}`);
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

bootstrap();
