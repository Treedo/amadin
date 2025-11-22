import Fastify from 'fastify';
import dotenv from 'dotenv';
import path from 'path';

import apiRoute from './routes/api/index.js';
import appRoute from './routes/app.js';
import rootRoute from './routes/root.js';
import { loadRegistry } from './services/dbRegistry.js';
import { ensureEntityTables } from './services/entitySerializer.js';
import { logger } from './utils/logger.js';
import loggingPlugin from './plugins/logging.js';
import errorHandlerPlugin from './plugins/errorHandler.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function bootstrap() {
  const generation = await loadRegistry();
  await ensureEntityTables({ generation });

  const server = Fastify({ logger: false });
  await server.register(loggingPlugin);
  await server.register(errorHandlerPlugin);

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
