import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { fetchApplication, fetchApplications } from '../api/index.js';
const AmadinContext = createContext(undefined);
export function AmadinProvider({ children }) {
    const [applications, setApplications] = useState([]);
    const [currentApp, setCurrentApp] = useState();
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        fetchApplications()
            .then(setApplications)
            .catch((error) => {
            console.error('Failed to load applications', error);
        });
    }, []);
    const selectApp = async (appId) => {
        setLoading(true);
        try {
            const manifest = await fetchApplication(appId);
            setCurrentApp(manifest);
        }
        finally {
            setLoading(false);
        }
    };
    const value = useMemo(() => ({ applications, currentApp, selectApp, loading }), [applications, currentApp, loading]);
    return _jsx(AmadinContext.Provider, { value: value, children: children });
}
export function useAmadin() {
    const context = useContext(AmadinContext);
    if (!context) {
        throw new Error('useAmadin must be used within an AmadinProvider');
    }
    return context;
}
