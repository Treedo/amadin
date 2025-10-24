import { MouseEvent } from 'react';
import { Outlet } from 'react-router-dom';

import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';
export function Layout() {
  const { app, overview } = useAmadin();
  const { windows, activeWindow, activateWindow, closeWindow, openView } = useWindowManager();

  const handleOpenEntity = (event: MouseEvent, entityCode: string, label: string) => {
    event.preventDefault();
    const newWindow = isAdditionalWindow(event);
    const defaultListForm = app?.defaults.entities[entityCode]?.list.formCode;
    if (defaultListForm) {
      openView({ kind: 'form', formCode: defaultListForm }, { newWindow, title: label });
      return;
    }
    openView({ kind: 'entity', entityCode }, { newWindow, title: label });
  };

  const handleOpenForm = (event: MouseEvent, formCode: string, label: string) => {
    event.preventDefault();
    const newWindow = isAdditionalWindow(event);
    openView({ kind: 'form', formCode }, { newWindow, title: label });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ borderRight: '1px solid #eee', padding: '1rem', display: 'grid', alignContent: 'start', gap: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0' }}>Amadin</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>{app?.meta.name ?? 'Застосунок завантажується'}</p>
        </div>

        {overview ? (
          <div style={{ fontSize: '0.9rem', color: '#555', display: 'grid', gap: '0.75rem' }}>
            <div>
              <strong>Каталоги</strong>
              <ul style={{ paddingLeft: '0', margin: '0.5rem 0 0 0', listStyle: 'none', display: 'grid', gap: '0.25rem' }}>
                {overview.links.catalogs.map((catalog) => (
                  <li key={catalog.code}>
                    <button
                      type="button"
                      onClick={(event) => handleOpenEntity(event, catalog.code, catalog.name)}
                      onAuxClick={(event) => handleOpenEntity(event, catalog.code, catalog.name)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{catalog.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#999' }}>↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <strong>Документи</strong>
              <ul style={{ paddingLeft: '0', margin: '0.5rem 0 0 0', listStyle: 'none', display: 'grid', gap: '0.25rem' }}>
                {overview.links.documents.map((document) => (
                  <li key={document.code}>
                    <button
                      type="button"
                      onClick={(event) => handleOpenForm(event, document.code, document.name)}
                      onAuxClick={(event) => handleOpenForm(event, document.code, document.name)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        border: '1px solid #e5e7eb',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      <span>{document.name}</span>
                      <span style={{ fontSize: '0.8rem', color: '#999' }}>↗</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#9ca3af' }}>Каталоги та документи завантажуються…</p>
        )}
      </aside>
      <main style={{ padding: '2rem', display: 'grid', gap: '1rem' }}>
        {windows.length > 0 && (
          <nav
            aria-label="Відкриті вікна"
            style={{
              display: 'flex',
              gap: '0.5rem',
              borderBottom: '1px solid #eee',
              paddingBottom: '0.5rem',
              height: '3rem',
              alignItems: 'center',
              overflowX: 'auto',
              overflowY: 'hidden'
            }}
          >
            {windows.map((window) => (
              <div
                key={window.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '0.5rem',
                  padding: '0.35rem 0.75rem',
                  background: activeWindow?.id === window.id ? '#111' : '#f3f4f6',
                  color: activeWindow?.id === window.id ? '#fff' : '#111'
                }}
              >
                <button
                  type="button"
                  onClick={() => activateWindow(window.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontWeight: activeWindow?.id === window.id ? 600 : 500
                  }}
                >
                  {window.title}
                </button>
                <button
                  type="button"
                  onClick={() => closeWindow(window.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                  aria-label={`Закрити ${window.title}`}
                >
                  ×
                </button>
              </div>
            ))}
          </nav>
        )}
        <div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function isAdditionalWindow(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
}
