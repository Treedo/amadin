import { MouseEvent } from 'react';
import { Outlet } from 'react-router-dom';

import type { SidebarGroup, SidebarItem } from '../api/index.js';
import { useAmadin } from '../context/AmadinContext.js';
import { useWindowManager } from '../context/WindowManagerContext.js';
export function Layout() {
  const { app, overview } = useAmadin();
  const { windows, activeWindow, activateWindow, closeWindow, openView } = useWindowManager();

  const handleSidebarItem = (event: MouseEvent, item: SidebarItem) => {
    event.preventDefault();
    const newWindow = isAdditionalWindow(event);

    if (item.type === 'entity') {
      const defaultListForm = app?.defaults.entities[item.target]?.list.formCode;
      if (defaultListForm) {
        openView({ kind: 'form', formCode: defaultListForm }, { newWindow, title: item.label });
        return;
      }
      openView({ kind: 'entity', entityCode: item.target }, { newWindow, title: item.label });
      return;
    }

    if (item.type === 'form') {
      openView({ kind: 'form', formCode: item.target }, { newWindow, title: item.label });
      return;
    }

    if (item.type === 'overview') {
      openView({ kind: 'overview' }, { newWindow, title: item.label });
      return;
    }

    if (item.type === 'url') {
      if (newWindow) {
        window.open(item.target, '_blank', 'noopener');
      } else {
        window.location.href = item.target;
      }
    }
  };

  const sidebarGroups: SidebarGroup[] = app?.sidebar?.length ? app.sidebar : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <aside style={{ borderRight: '1px solid #eee', padding: '1rem', display: 'grid', alignContent: 'start', gap: '1.5rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.25rem 0' }}>Amadin</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>{app?.meta.name ?? 'Застосунок завантажується'}</p>
        </div>

        {sidebarGroups.length > 0 ? (
          <div style={{ fontSize: '0.9rem', color: '#555', display: 'grid', gap: '0.75rem' }}>
            {sidebarGroups.map((group) => (
              <div key={group.code}>
                <strong>{group.title}</strong>
                <ul
                  style={{
                    paddingLeft: '0',
                    margin: '0.5rem 0 0 0',
                    listStyle: 'none',
                    display: 'grid',
                    gap: '0.25rem'
                  }}
                >
                  {group.items.map((item) => (
                    <li key={`${group.code}-${item.type}-${item.target}`}>
                      <button
                        type="button"
                        onClick={(event) => handleSidebarItem(event, item)}
                        onAuxClick={(event) => handleSidebarItem(event, item)}
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
                        <span>
                          {item.icon ? <span style={{ marginRight: '0.5rem' }}>{item.icon}</span> : null}
                          {item.label}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>↗</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : overview ? (
          <div style={{ fontSize: '0.9rem', color: '#555' }}>
            <p style={{ margin: 0, color: '#9ca3af' }}>Меню ще конфігурується…</p>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#9ca3af' }}>Дані завантажуються…</p>
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
