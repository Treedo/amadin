import { useEffect, useMemo, useState } from 'react';

import { fetchEntityRows } from '../api/index.js';
import type { AppManifest, UiForm, UiFormGroupItem } from '../api/index.js';

interface FormRendererProps {
  app: AppManifest;
}

export function FormRenderer({ app }: FormRendererProps) {
  const primaryForm = useMemo<UiForm | undefined>(() => {
    const preferred = app.manifest.find((form) => form.code === 'overview');
    return preferred ?? app.manifest[0];
  }, [app.manifest]);
  const [rows, setRows] = useState<unknown[]>([]);

  useEffect(() => {
    const entityCode = primaryForm?.primaryEntity;
    if (!primaryForm || !entityCode) {
      setRows([]);
      return;
    }
    fetchEntityRows(app.meta.id, entityCode)
      .then(setRows)
      .catch((error) => {
        console.error('Failed to load entity rows', error);
      });
  }, [app, primaryForm]);

  if (!primaryForm) {
    return <p>Жодної форми не знайдено 🤷‍♀️</p>;
  }

  return (
    <section>
      <header>
        <h2>{primaryForm.name}</h2>
        <p>Щоб побачити форму, відредагуйте `examples/demo-config.json`.</p>
      </header>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {primaryForm.groups.map((group) => (
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

                const linkHref = resolveLinkHref(app.meta.id, item);

                return (
                  <a
                    key={`${group.code}-${item.label}-${index}`}
                    href={linkHref}
                    style={{
                      display: 'block',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.75rem',
                      background: '#f9fafb',
                      textDecoration: 'none',
                      color: '#1f2937'
                    }}
                    target={item.targetType === 'url' ? '_blank' : '_self'}
                    rel="noreferrer"
                  >
                    <strong>{item.label}</strong>
                    {item.description ? <p style={{ margin: '0.25rem 0 0 0' }}>{item.description}</p> : null}
                    <small style={{ color: '#6b7280' }}>{linkHref}</small>
                  </a>
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

function resolveLinkHref(appId: string, item: Extract<UiFormGroupItem, { kind: 'link' }>): string {
  if (item.targetType === 'entity') {
    const [, entityCode = item.target] = item.target.split(':');
    return `/api/${appId}/entities/${entityCode}`;
  }
  if (item.targetType === 'form') {
    const [, formCode = item.target] = item.target.split(':');
    return `/app/${appId}/forms/${formCode}`;
  }
  return item.target;
}
