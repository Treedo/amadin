import { getApplication } from '../../services/dbRegistry.js';
import { canAccessEntity } from '../../services/security.js';
import { createEntity, getDataStore, listEntities } from '../../utils/prismaLoader.js';
const entitiesRoute = async (fastify) => {
    fastify.get('/:appId/entities/:entityCode', async (request, reply) => {
        const { appId, entityCode } = request.params;
        const application = getApplication(appId);
        if (!application) {
            reply.code(404);
            return { error: 'Application not found' };
        }
        if (!canAccessEntity({}, { appId, entityCode })) {
            reply.code(403);
            return { error: 'Access denied' };
        }
        const entity = application.config.entities.find((item) => item.code === entityCode);
        if (!entity) {
            reply.code(404);
            return { error: 'Entity not found' };
        }
        const store = getDataStore(appId, application.config);
        const rows = listEntities(store, entityCode);
        return { data: rows };
    });
    fastify.post('/:appId/entities/:entityCode', async (request, reply) => {
        const { appId, entityCode } = request.params;
        const application = getApplication(appId);
        if (!application) {
            reply.code(404);
            return { error: 'Application not found' };
        }
        const entity = application.config.entities.find((item) => item.code === entityCode);
        if (!entity) {
            reply.code(404);
            return { error: 'Entity not found' };
        }
        const store = getDataStore(appId, application.config);
        const record = createEntity(store, entity, request.body?.data ?? {});
        reply.code(201);
        return { data: record };
    });
};
export default entitiesRoute;
