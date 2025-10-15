import { FastifyInstance, FastifyPluginAsync } from 'fastify';

import authRoute from './auth.js';
import entitiesRoute from './entities.js';

const apiRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.register(authRoute);
  fastify.register(entitiesRoute);
};

export default apiRoute;
