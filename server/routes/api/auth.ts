import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import { createSession, getSession, invalidateSession } from '../../services/sessionManager.js';

interface LoginBody {
  username: string;
}

interface LoginResponse {
  sessionId: string;
  username: string;
}

const authRoute: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.post<{ Body: LoginBody }>('/auth/login', async (request: FastifyRequest<{ Body: LoginBody }>) => {
    const { username } = request.body;
    const session = createSession(username);
    return { sessionId: session.id, username: session.username } satisfies LoginResponse;
  });

  fastify.get('/auth/session/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    const session = getSession(request.params.sessionId);
    if (!session) {
      reply.code(404);
      return { error: 'Session not found' };
    }
    return { sessionId: session.id, username: session.username } satisfies LoginResponse;
  });

  fastify.post('/auth/logout', async (request: FastifyRequest<{ Body: { sessionId: string } }>) => {
    const { sessionId } = request.body;
    invalidateSession(sessionId);
    return { success: true };
  });
};

export default authRoute;
