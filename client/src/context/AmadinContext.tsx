import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import type { AppManifest, ApplicationMeta, AppOverviewEntry } from '../api/index.js';
import { fetchApplication, fetchApplications, fetchAppOverview } from '../api/index.js';

interface AmadinContextValue {
  applications: ApplicationMeta[];
  currentApp?: AppManifest;
  selectApp: (appId: string) => Promise<void>;
  loading: boolean;
  overview?: AppOverviewEntry[];
}

const AmadinContext = createContext<AmadinContextValue | undefined>(undefined);

export function AmadinProvider({ children }: { children: ReactNode }) {
  const [applications, setApplications] = useState<ApplicationMeta[]>([]);
  const [currentApp, setCurrentApp] = useState<AppManifest | undefined>();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<AppOverviewEntry[] | undefined>();

  useEffect(() => {
    Promise.all([fetchApplications(), fetchAppOverview()])
      .then(([appList, overviewResponse]) => {
        setApplications(appList);
        setOverview(overviewResponse.applications);
      })
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
    () => ({ applications, currentApp, selectApp, loading, overview }),
    [applications, currentApp, loading, overview]
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
