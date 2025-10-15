import { useEffect } from 'react';
import { FormRenderer } from './components/FormRenderer.js';
import { Layout } from './components/Layout.js';
import { TableView } from './components/TableView.js';
import { useAmadin } from './context/AmadinContext.js';
import { useSession } from './hooks/useSession.js';

export function App() {
  const { currentApp, loading, applications, selectApp } = useAmadin();
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
        !loading && <p>Немає доступних конфігурацій.</p>
      )}
    </Layout>
  );
}
