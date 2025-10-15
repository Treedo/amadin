import { randomUUID } from 'crypto';

interface Session {
  id: string;
  username: string;
  createdAt: Date;
}

const sessions = new Map<string, Session>();

export function createSession(username: string): Session {
  const session: Session = {
    id: randomUUID(),
    username,
    createdAt: new Date()
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

export function invalidateSession(sessionId: string): void {
  sessions.delete(sessionId);
}
