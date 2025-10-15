import { ReactNode } from 'react';
import { useMemo } from 'react';

import { useAmadin } from '../context/AmadinContext.js';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { applications, selectApp, currentApp, overview } = useAmadin();

  const activeOverview = useMemo(() => overview?.find((item) => item.id === currentApp?.meta.id), [overview, currentApp]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ borderRight: '1px solid #eee', padding: '1rem' }}>
        <h1 style={{ marginTop: 0 }}>Amadin</h1>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {applications.map((app) => (
            <li key={app.id}>
              <button
                style={{
                  border: 'none',
                  background: currentApp?.meta.id === app.id ? '#111' : '#f5f5f5',
                  color: currentApp?.meta.id === app.id ? '#fff' : '#333',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                  marginBottom: '0.5rem'
                }}
                onClick={() => selectApp(app.id)}
              >
                {app.name}
              </button>
            </li>
          ))}
        </ul>
        {activeOverview && (
          <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#555', display: 'grid', gap: '0.75rem' }}>
            <div>
              <strong>Каталоги</strong>
              <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0 0 0' }}>
                {activeOverview.links.catalogs.map((catalog) => (
                  <li key={catalog.code}>{catalog.name}</li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Документи</strong>
              <ul style={{ paddingLeft: '1.25rem', margin: '0.5rem 0 0 0' }}>
                {activeOverview.links.documents.map((document) => (
                  <li key={document.code}>{document.name}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
      <main style={{ padding: '2rem' }}>{children}</main>
    </div>
  );
}
