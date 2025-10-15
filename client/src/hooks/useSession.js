import { useCallback, useState } from 'react';
export function useSession() {
    const [session, setSession] = useState({});
    const login = useCallback(async (username) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const json = await response.json();
        setSession({ sessionId: json.sessionId, username: json.username });
    }, []);
    const logout = useCallback(async () => {
        if (!session.sessionId) {
            return;
        }
        await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: session.sessionId })
        });
        setSession({});
    }, [session.sessionId]);
    return { session, login, logout };
}
