import { getApplication } from '../services/dbRegistry.js';
const appRoute = async (fastify) => {
    fastify.get('/app/:appId', async (request, reply) => {
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
    fastify.get('/:appId', async (request, reply) => {
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
};
export default appRoute;
