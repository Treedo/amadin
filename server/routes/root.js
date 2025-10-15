import { listApplications } from '../services/dbRegistry.js';
const rootRoute = async (fastify) => {
    const handler = async () => ({ applications: listApplications() });
    fastify.get('/', handler);
    fastify.get('/api/apps', handler);
};
export default rootRoute;
