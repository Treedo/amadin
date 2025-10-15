import { ReactNode } from 'react';
import { useAmadin } from '../context/AmadinContext.js';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { applications, selectApp, currentApp } = useAmadin();

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
      </aside>
      <main style={{ padding: '2rem' }}>{children}</main>
    </div>
  );
}
