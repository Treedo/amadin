import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { listApplications } from '../services/dbRegistry.js';

const rootRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const handler = async () => ({ applications: listApplications() });
  fastify.get('/', handler);
  fastify.get('/api/apps', handler);
};

export default rootRoute;
