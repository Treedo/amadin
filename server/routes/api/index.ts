import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import authRoute from './auth.js';
import entitiesRoute from './entities.js';
import listRoute from './list.js';

const apiRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.register(authRoute);
  fastify.register(entitiesRoute);
  fastify.register(listRoute);
};

export default apiRoute;
