import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { AppManifest, ApplicationMeta } from '../api/index.js';
import { fetchApplication, fetchApplications } from '../api/index.js';

interface AmadinContextValue {
  applications: ApplicationMeta[];
  currentApp?: AppManifest;
  selectApp: (appId: string) => Promise<void>;
  loading: boolean;
}

const AmadinContext = createContext<AmadinContextValue | undefined>(undefined);

export function AmadinProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<ApplicationMeta[]>([]);
  const [currentApp, setCurrentApp] = useState<AppManifest | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApplications()
      .then(setApplications)
      .catch((error) => {
        console.error('Failed to load applications', error);
      });
  }, []);

  const selectApp = async (appId: string) => {
    setLoading(true);
    try {
      const manifest = await fetchApplication(appId);
      setCurrentApp(manifest);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo<AmadinContextValue>(
    () => ({ applications, currentApp, selectApp, loading }),
    [applications, currentApp, loading]
  );

  return <AmadinContext.Provider value={value}>{children}</AmadinContext.Provider>;
}

export function useAmadin() {
  const context = useContext(AmadinContext);
  if (!context) {
    throw new Error('useAmadin must be used within an AmadinProvider');
  }
  return context;
}
