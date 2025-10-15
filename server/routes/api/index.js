import authRoute from './auth.js';
import entitiesRoute from './entities.js';
const apiRoute = async (fastify) => {
    fastify.register(authRoute);
    fastify.register(entitiesRoute);
};
export default apiRoute;
