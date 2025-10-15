import { useEffect } from 'react';
import { FormRenderer } from './components/FormRenderer.js';
import { Layout } from './components/Layout.js';
import { TableView } from './components/TableView.js';
import { useAmadin } from './context/AmadinContext.js';
import { useSession } from './hooks/useSession.js';

export function App() {
  const { currentApp, loading, applications, overview, selectApp } = useAmadin();
  const { session, login, logout } = useSession();

  useEffect(() => {
    if (!currentApp && applications[0]) {
      void selectApp(applications[0].id);
    }
  }, [applications, currentApp, selectApp]);

  return (
    <Layout>
      <section style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{currentApp?.meta.name ?? 'Оберіть застосунок'}</h2>
          <p>Це демо інтерфейсу Amadin. Ми рендеримо UI на основі конфігурації.</p>
        </div>
        <div>
          {session.sessionId ? (
            <button onClick={() => logout()}>Вийти ({session.username})</button>
          ) : (
            <button onClick={() => login('demo-user')}>Увійти як demo-user</button>
          )}
        </div>
      </section>

      {loading && <p>Завантаження...</p>}

      {currentApp ? (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <FormRenderer app={currentApp} />
          {currentApp.manifest[0]?.layout[0]?.entity ? (
            <TableView appId={currentApp.meta.id} entityCode={currentApp.manifest[0]?.layout[0]?.entity ?? ''} />
          ) : (
            <p>Додайте принаймні одне поле з прив'язкою до сутності, щоб побачити табличні дані.</p>
          )}
        </div>
      ) : (
        !loading && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            <h3>Доступні застосунки</h3>
            {overview?.map((app) => (
              <article key={app.id} style={{ border: '1px solid #eee', borderRadius: '1rem', padding: '1.5rem' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0' }}>{app.name}</h4>
                    <small style={{ color: '#666' }}>Каталоги: {app.summary.catalogCount} · Документи: {app.summary.documentCount}</small>
                  </div>
                  <button onClick={() => selectApp(app.id)}>Відкрити</button>
                </header>
                <section style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Каталоги</h5>
                    {app.links.catalogs.length ? (
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {app.links.catalogs.map((catalog) => (
                          <li key={catalog.code}>
                            <strong>{catalog.name}</strong>
                            <small style={{ marginLeft: '0.5rem', color: '#666' }}>({catalog.code})</small>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              Поля: {catalog.fields.map((field) => `${field.name}${field.required ? '*' : ''}`).join(', ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, color: '#666' }}>Немає довідників.</p>
                    )}
                  </div>
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0' }}>Документи</h5>
                    {app.links.documents.length ? (
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {app.links.documents.map((document) => (
                          <li key={document.code}>
                            <strong>{document.name}</strong>
                            <small style={{ marginLeft: '0.5rem', color: '#666' }}>({document.code})</small>
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>
                              Поля: {document.layout.map((field) => field.label).join(', ')}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p style={{ margin: 0, color: '#666' }}>Немає документів.</p>
                    )}
                  </div>
                </section>
              </article>
            ))}
          </div>
        )
      )}
    </Layout>
  );
}
