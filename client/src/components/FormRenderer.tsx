import { MouseEvent, useEffect, useMemo, useState } from 'react';

import { fetchEntityRows } from '../api/index.js';
import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';
import { useWindowManager } from '../context/WindowManagerContext.js';

interface FormRendererProps {
  app: AppManifest;
  formCode?: string;
}

export function FormRenderer({ app, formCode }: FormRendererProps) {
  const { openView } = useWindowManager();
  const activeForm = useMemo<UiForm | undefined>(() => {
    if (formCode) {
      return app.manifest.find((form) => form.code === formCode);
    }
    const preferred = app.manifest.find((form) => form.code === 'overview');
    return preferred ?? app.manifest[0];
  }, [app.manifest, formCode]);
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    const entityCode = activeForm?.primaryEntity;
    if (!activeForm || !entityCode) {
      setRows([]);
      return;
    }
    fetchEntityRows(entityCode)
      .then(setRows)
      .catch((error) => {
        console.error('Failed to load entity rows', error);
      });
  }, [app, activeForm]);

  if (!activeForm) {
    return <p>Жодної форми не знайдено 🤷‍♀️</p>;
  }

  const handleLinkClick = (event: MouseEvent, item: Extract<UiFormGroupItem, { kind: 'link' }>) => {
    event.preventDefault();
    const newWindow = isAdditionalWindow(event);
    if (item.targetType === 'entity') {
      const [, entityCode = item.target] = item.target.split(':');
      const defaultListForm = app.defaults.entities[entityCode]?.list.formCode;
      if (defaultListForm) {
        openView({ kind: 'form', formCode: defaultListForm }, { newWindow, title: item.label });
        return;
      }
      openView({ kind: 'entity', entityCode }, { newWindow, title: item.label });
      return;
    }
    if (item.targetType === 'form') {
      const [, formCodeFromLink = item.target] = item.target.split(':');
      openView({ kind: 'form', formCode: formCodeFromLink }, { newWindow, title: item.label });
      return;
    }

    const targetUrl = resolveLinkHref(item);
    if (newWindow) {
      window.open(targetUrl, '_blank', 'noopener');
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <section>
      <header>
        <h2>{activeForm.name}</h2>
      </header>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {activeForm.groups.map((group) => (
          <section
            key={group.code}
            style={{
              border: '1px solid #e5e7eb',
              borderRadius: '1rem',
              padding: '1rem 1.5rem',
              background: group.color === 'accent' ? '#f5f3ff' : '#fff',
              display: 'grid',
              gap: '1rem'
            }}
          >
            <header>
              <h3 style={{ margin: 0 }}>{group.title}</h3>
            </header>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: group.orientation === 'horizontal' ? 'repeat(auto-fit, minmax(180px, 1fr))' : '1fr',
                gap: '1rem'
              }}
            >
              {group.items.map((item: UiFormGroupItem, index: number) => {
                if (item.kind === 'field') {
                  return (
                    <label
                      key={`${group.code}-${item.field}-${index}`}
                      style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
                    >
                      <span>
                        {item.label}
                        {item.required ? ' *' : ''}
                      </span>
                      <input type="text" placeholder={item.field} />
                    </label>
                  );
                }

                return (
                  <button
                    key={`${group.code}-${item.label}-${index}`}
                    type="button"
                    onClick={(event) => handleLinkClick(event, item)}
                    onAuxClick={(event) => handleLinkClick(event, item)}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      background: '#f9fafb',
                      textAlign: 'left',
                      color: '#1f2937',
                      cursor: 'pointer'
                    }}
                  >
                    <strong>{item.label}</strong>
                    {item.description ? <p style={{ margin: '0.25rem 0 0 0' }}>{item.description}</p> : null}
                    <small style={{ color: '#6b7280' }}>{resolveLinkHref(item)}</small>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <pre style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5' }}>
        {JSON.stringify(rows, null, 2)}
      </pre>
    </section>
  );
}

function resolveLinkHref(item: Extract<UiFormGroupItem, { kind: 'link' }>): string {
  if (item.targetType === 'entity') {
    const [, entityCode = item.target] = item.target.split(':');
    return `/entities/${entityCode}`;
  }
  if (item.targetType === 'form') {
    const [, formCode = item.target] = item.target.split(':');
    return `/forms/${formCode}`;
  }
  return item.target;
}

function isAdditionalWindow(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1;
}
