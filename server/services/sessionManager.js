import { randomUUID } from 'crypto';
const sessions = new Map();
export function createSession(username) {
    const session = {
        id: randomUUID(),
        username,
        createdAt: new Date()
    };
    sessions.set(session.id, session);
    return session;
}
export function getSession(sessionId) {
    return sessions.get(sessionId);
}
export function invalidateSession(sessionId) {
    sessions.delete(sessionId);
}
