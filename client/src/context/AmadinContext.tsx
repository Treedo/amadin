import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { AppManifest, AppOverviewEntry } from '../api/index.js';
import { fetchApplication, fetchAppOverview } from '../api/index.js';

interface AmadinContextValue {
  appId?: string;
  app?: AppManifest;
  overview?: AppOverviewEntry;
  loading: boolean;
  loadApp: (options?: { force?: boolean }) => Promise<AppManifest | undefined>;
}

const AmadinContext = createContext<AmadinContextValue | undefined>(undefined);

export function AmadinProvider({ children }: { children: ReactNode }) {
  const [appId, setAppId] = useState<string | undefined>();
  const [app, setApp] = useState<AppManifest | undefined>();
  const appRef = useRef<AppManifest | undefined>(undefined);
  appRef.current = app;
  const [overview, setOverview] = useState<AppOverviewEntry | undefined>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAppOverview()
      .then((response) => {
        const primaryApp = response.applications[0];
        setOverview(primaryApp);
        setAppId(primaryApp?.id);
      })
      .catch((error) => {
        console.error('Failed to load application overview', error);
      });
  }, []);

  const loadApp = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && appRef.current) {
      return appRef.current;
    }

    setLoading(true);
    try {
      const manifest = await fetchApplication();
      setAppId(manifest.meta.id);
      setApp(manifest);
      appRef.current = manifest;
      return manifest;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApp();
  }, [loadApp]);

  const value = useMemo<AmadinContextValue>(
    () => ({ appId, app, overview, loading, loadApp }),
    [appId, app, overview, loading, loadApp]
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
