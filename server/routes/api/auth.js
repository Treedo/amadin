import { createSession, getSession, invalidateSession } from '../../services/sessionManager.js';
const authRoute = async (fastify) => {
    fastify.post('/auth/login', async (request) => {
        const { username } = request.body;
        const session = createSession(username);
        return { sessionId: session.id, username: session.username };
    });
    fastify.get('/auth/session/:sessionId', async (request, reply) => {
        const session = getSession(request.params.sessionId);
        if (!session) {
            reply.code(404);
            return { error: 'Session not found' };
        }
        return { sessionId: session.id, username: session.username };
    });
    fastify.post('/auth/logout', async (request) => {
        const { sessionId } = request.body;
        invalidateSession(sessionId);
        return { success: true };
    });
};
export default authRoute;
